"""
server/proxy_fund_feishu.py —— 「爱的小窝」飞书最新数据代理服务
=================================================================
功能：
  暴露 GET /api/feishu/funds 接口，接收 spreadsheet_token / sheet_id，
  内部调用飞书 OpenAPI（自建应用 AppId/AppSecret）获取 csv 数据并转为
  前端消费的结构化 JSON。
  由于浏览器直连飞书 OpenAPI 会有跨域 + 需要敏感凭证的问题，
  所以走这个后端代理做：
    1) 凭证保管（AppId/AppSecret 只存环境变量，绝不落到前端）
    2) CORS 放行（白名单只允许你们的部署域名）
    3) 响应缓存（10 分钟内同一请求不重复打飞书）

运行方式：
  # 1) 生产部署（推荐 docker-compose，已在仓库根的 docker-compose.yml 里加了 service）
  # 2) 本地开发：
  export LARK_APP_ID=cli_xxx
  export LARK_APP_SECRET=xxx
  export CORS_ORIGINS="*"      # 开发阶段允许所有；生产改成具体域名，如 https://xxx.gitee.io
  python3 server/proxy_fund_feishu.py

环境变量：
  LARK_APP_ID           必填：飞书自建应用 App ID（在飞书开放平台 → 凭证与基础信息里找）
  LARK_APP_SECRET       必填：飞书自建应用 App Secret
  DEFAULT_SPREADSHEET_TOKEN  可选：默认使用的 wiki spreadsheet token（用户没传时的兜底）
  DEFAULT_SHEET_ID      可选：默认 tab id，缺省 "4e7337"
  CORS_ORIGINS          可选：逗号分隔的允许跨域源，默认 "*"
  CACHE_TTL_SEC         可选：内存缓存时长（秒），默认 600
  PORT                  可选：监听端口，默认 8787
  BIND                  可选：绑定地址，默认 "0.0.0.0"
  FUND_CODES_SHEET_ID   可选：基金代码子表 sheet_id，缺省 "huWhGM"（保留，给后续扩展用）

输出 JSON 形态（完全兼容前端之前的 data/feishu_funds.json）：
  {
    "source": "feishu_openapi_proxy",
    "spreadsheet_token": "...",
    "sheet_id": "4e7337",
    "exported_at": "2026-08-13T12:41:48.247+08:00",
    "count": 35,
    "items": [
      { "code": "501302", "name": "南方恒指ETF联接A", "temp": "", "temp_comment": "", ... },
      ...
    ]
  }
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Any


# ----------------------------- 常量 -----------------------------

# 飞书 OpenAPI 域名
LARK_HOST = os.environ.get("LARK_HOST", "https://open.feishu.cn")
TOKEN_URL = f"{LARK_HOST}/open-apis/auth/v3/tenant_access_token/internal"
SHEET_VALUES_URL_FMT = "{host}/open-apis/sheets/v2/spreadsheets/{token}/values/{sheetId}"
SHEET_VALUES_RANGE_FMT = "{host}/open-apis/sheets/v3/spreadsheets/{token}/sheets/{sheetId}/values"

CST_TZ = timezone(timedelta(hours=8))

# 最新数据 tab 的列顺序（必须跟表头完全对应）
HEADER_LATEST = [
    "code", "name", "fund_size", "establish_date", "nav", "nav_date",
    "one_year_return", "daily_change", "management_fee", "risk_level",
    "max_value", "min_value", "max_date", "min_date",
    "target_audience", "historical_win_rate", "peer_compare", "temp", "temp_comment",
    "daily_nav", "since_inception_return", "investment_sectors", "position_valuation",
    "halfyear_profit_prob", "indicator_1y_return", "future_trend", "change_date",
    "sector_allocation", "asset_allocation", "risk_rating"
]


# ----------------------------- 缓存（单进程内存 LRU） -----------------------------

class MemCache:
    def __init__(self, ttl: int):
        self.ttl = ttl
        self._data: Dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._data:
                return None
            t, v = self._data[key]
            if time.time() - t > self.ttl:
                del self._data[key]
                return None
            return v

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = (time.time(), value)


# ----------------------------- 飞书 API -----------------------------

def _http_json(method: str, url: str, headers: Optional[Dict[str, str]] = None,
               body: Optional[Dict[str, Any]] = None, timeout: int = 10) -> Dict[str, Any]:
    """轻量级 HTTP JSON 客户端，避免引入第三方依赖。"""
    data = None
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        try:
            raw = e.read().decode("utf-8", errors="replace")
        except Exception:
            raw = str(e)
        raise RuntimeError(f"HTTP {e.code} {e.reason}: {raw[:500]}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"URLError: {e.reason}") from e


class LarkClient:
    def __init__(self, app_id: str, app_secret: str):
        self.app_id = app_id
        self.app_secret = app_secret
        self._token: Optional[tuple[float, str]] = None  # (expire_ts, access_token)
        self._lock = threading.Lock()

    def _ensure_token(self) -> str:
        now = time.time()
        with self._lock:
            if self._token and self._token[0] - 60 > now:
                return self._token[1]
            body = {"app_id": self.app_id, "app_secret": self.app_secret}
            resp = _http_json("POST", TOKEN_URL, body=body, timeout=8)
            if resp.get("code") != 0 or not resp.get("tenant_access_token"):
                raise RuntimeError(f"获取飞书 tenant_access_token 失败: {resp}")
            expire = now + int(resp.get("expire", 7200))
            self._token = (expire, resp["tenant_access_token"])
            return self._token[1]

    def get_sheet_values(self, spreadsheet_token: str, sheet_id: str,
                         range_str: Optional[str] = None) -> list[list[Any]]:
        """读子表的原始二维值。优先用 v3 values API 读整张表。"""
        token = self._ensure_token()
        range_param = range_str or ""
        # v3 需要带 sheetId + range；不传 range 默认读全表
        base = SHEET_VALUES_RANGE_FMT.format(
            host=LARK_HOST, token=urllib.parse.quote(spreadsheet_token),
            sheetId=urllib.parse.quote(sheet_id)
        )
        if range_param:
            base += f"?range={urllib.parse.quote(range_param)}"
        resp = _http_json(
            "GET", base,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        if resp.get("code") != 0:
            # v3 失败时，降级 v2
            v2 = SHEET_VALUES_URL_FMT.format(
                host=LARK_HOST, token=urllib.parse.quote(spreadsheet_token),
                sheetId=f"{urllib.parse.quote(sheet_id)}%21{range_param or 'A1:ZZ9999'}"
            )
            resp = _http_json(
                "GET", v2,
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            if resp.get("code") != 0:
                raise RuntimeError(f"读取飞书表格失败: {resp}")
            return resp.get("data", {}).get("valueRange", {}).get("values", [])
        return resp.get("data", {}).get("valueRange", {}).get("values", [])


# ----------------------------- 解析 / 清洗 -----------------------------

def _parse_sheet_to_items(values: list[list[Any]], header: list[str],
                         skip_header_row: bool = True) -> list[Dict[str, str]]:
    rows = list(values or [])
    if skip_header_row and rows:
        rows = rows[1:]
    items = []
    for row in rows:
        if not row:
            continue
        if not any((str(c).strip() if c is not None else "") for c in row):
            continue  # 空行跳过
        obj: Dict[str, str] = {}
        for i, key in enumerate(header):
            v = row[i] if i < len(row) else ""
            if v is None:
                v = ""
            elif isinstance(v, (int, float)):
                # 数值型直接转成字符串输出，便于前端统一处理
                if isinstance(v, float) and v.is_integer():
                    v = f"{int(v)}"
                else:
                    v = str(v)
            else:
                v = str(v).strip()
            obj[key] = v
        code = obj.get("code") or ""
        # 代码去前导空格（基金代码前有时会有空格、全角空格）
        code = re.sub(r"[\s\u3000]+", "", code)
        if not code:
            continue
        obj["code"] = code
        items.append(obj)
    return items


# ----------------------------- Flask App（零第三方依赖？不，Flask 要装；实际用内置 wsgiref 也可以，但可读性更好还是用 Flask）
#   为了让本地「pip install 尽量少」，这里提供一个 Flask 版本并写好 requirements.txt
# ---------------------------------------------------------------------

def create_app() -> "Flask":  # type: ignore[name-defined]
    from flask import Flask, request, jsonify, Response
    from flask_cors import CORS  # type: ignore

    app = Flask(__name__)

    # ------- 配置 -------
    cors_raw = os.environ.get("CORS_ORIGINS", "*").strip()
    cors_origins = [x.strip() for x in cors_raw.split(",") if x.strip()]
    CORS(app, resources={r"/api/*": {"origins": cors_origins or "*",
                                     "methods": ["GET", "OPTIONS"],
                                     "max_age": 86400}})

    app_id = os.environ.get("LARK_APP_ID", "").strip()
    app_secret = os.environ.get("LARK_APP_SECRET", "").strip()
    default_spreadsheet_token = os.environ.get("DEFAULT_SPREADSHEET_TOKEN", "").strip()
    default_sheet_id = os.environ.get("DEFAULT_SHEET_ID", "4e7337").strip() or "4e7337"
    cache_ttl = int(os.environ.get("CACHE_TTL_SEC", "600"))

    cache = MemCache(ttl=cache_ttl)
    lark: Optional[LarkClient] = None
    if app_id and app_secret:
        lark = LarkClient(app_id, app_secret)
    else:
        print("[WARN] 未设置 LARK_APP_ID/LARK_APP_SECRET，飞书代理接口将返回 503。"
              "仅本地静态 feishu_funds.json 能工作。", file=sys.stderr)

    # ------- 路由 -------
    @app.get("/health")
    def health() -> Response:
        return jsonify({
            "ok": True,
            "lark_configured": bool(lark),
            "cors_origins": cors_origins,
            "cache_ttl_sec": cache_ttl,
            "ts": datetime.now(CST_TZ).isoformat()
        })

    @app.get("/api/feishu/funds")
    def api_feishu_funds() -> Response:
        token = (request.args.get("spreadsheet_token") or "").strip() or default_spreadsheet_token
        sheet_id = (request.args.get("sheet_id") or "").strip() or default_sheet_id
        if not token:
            return jsonify({"ok": False, "error": "缺少 spreadsheet_token（需在环境变量 DEFAULT_SPREADSHEET_TOKEN 或 URL ?spreadsheet_token= 里提供）"}), 400
        if not lark:
            return jsonify({
                "ok": False,
                "error": "后端未配置 LARK_APP_ID/LARK_APP_SECRET，无法直连飞书。请先用本地 scripts/sync_feishu.sh 导出 JSON，或在代理里填上凭证。"
            }), 503

        cache_key = f"funds:{token}:{sheet_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            resp = jsonify(cached)
            resp.headers["X-Cache"] = "HIT"
            return resp

        # 读飞书
        try:
            values = lark.get_sheet_values(token, sheet_id)
        except Exception as e:
            return jsonify({"ok": False, "error": f"飞书 API 调用失败：{e}"}), 502

        items = _parse_sheet_to_items(values, HEADER_LATEST, skip_header_row=True)
        result = {
            "ok": True,
            "source": "feishu_openapi_proxy",
            "spreadsheet_token": token,
            "sheet_id": sheet_id,
            "exported_at": datetime.now(CST_TZ).isoformat(),
            "count": len(items),
            "items": items,
        }
        cache.set(cache_key, result)
        resp = jsonify(result)
        resp.headers["X-Cache"] = "MISS"
        resp.headers["Cache-Control"] = f"public, max-age={cache_ttl}"
        return resp

    return app


if __name__ == "__main__":
    try:
        app = create_app()
    except ImportError as e:
        print(f"[ERROR] 缺少依赖：{e}。请先 pip install -r server/requirements.txt", file=sys.stderr)
        sys.exit(2)

    port = int(os.environ.get("PORT", "8787"))
    bind = os.environ.get("BIND", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes")
    app.run(host=bind, port=port, debug=debug, threaded=True)
