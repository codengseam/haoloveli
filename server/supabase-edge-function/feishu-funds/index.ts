// @ts-nocheck
// Supabase Edge Function: feishu-funds
// 与 Python 版 server/proxy_fund_feishu.py 的 GET /api/feishu/funds 完全同构
// 前端只需把 LOVENEST_FEISHU_PROXY_BASE 改成 Edge Function 的 URL 即可无缝切换

// ----- 列名 -----
const HEADER_LATEST = [
  "code", "name", "fund_size", "establish_date", "nav", "nav_date",
  "one_year_return", "daily_change", "management_fee", "risk_level",
  "max_value", "min_value", "max_date", "min_date",
  "target_audience", "historical_win_rate", "peer_compare", "temp", "temp_comment",
  "daily_nav", "since_inception_return", "investment_sectors", "position_valuation",
  "halfyear_profit_prob", "indicator_1y_return", "future_trend", "change_date",
  "sector_allocation", "asset_allocation", "risk_rating"
];

// ---------- 工具 ----------
const CACHE_TTL_SEC = 600; // 10 分钟（Supabase Edge 不支持跨请求内存缓存，这里由前端 Cache-Control 缓存）
const LARK_HOST = Deno.env.get("LARK_HOST") || "https://open.feishu.cn";
const DEFAULT_SPREADSHEET_TOKEN = Deno.env.get("DEFAULT_SPREADSHEET_TOKEN") || "";
const DEFAULT_SHEET_ID = Deno.env.get("DEFAULT_SHEET_ID") || "4e7337";
const CORS_ORIGINS = (Deno.env.get("CORS_ORIGINS") || "*").split(",").map(s => s.trim()).filter(Boolean);

function normalizeCode(v) {
  if (v == null) return "";
  return String(v).replace(/[\s\u3000]+/g, "");
}

function corsHeaders(origin) {
  const allowOrigin =
    CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes("*") ? "*" :
    (origin && CORS_ORIGINS.some(o => o === origin || origin.endsWith(o.replace(/^[^/]*\/\//,"").split('/')[0])))
      ? origin : CORS_ORIGINS[0] || "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
  };
}

async function getTenantToken(appId, appSecret) {
  const res = await fetch(`${LARK_HOST}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const j = await res.json();
  if (j.code !== 0 || !j.tenant_access_token) throw new Error(`Lark token fail: ${JSON.stringify(j)}`);
  return { token: j.tenant_access_token, expire: Math.floor(Date.now()/1000) + (j.expire || 7200) - 120 };
}

// 全局 token（Edge Function 冷启动之间不共享，但单请求生命周期内够用）
let _token = null;
async function ensureToken(appId, appSecret) {
  const now = Math.floor(Date.now()/1000);
  if (_token && _token.expire > now) return _token.token;
  _token = await getTenantToken(appId, appSecret);
  return _token.token;
}

function parseValuesToItems(values, header) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const rows = values.slice(1); // 跳过表头
  const out = [];
  for (const row of rows) {
    if (!row || row.every(c => c === null || c === undefined || String(c).trim() === "")) continue;
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      let v = row[i];
      if (v == null) v = "";
      else if (typeof v === "number" && Number.isInteger(v)) v = String(v);
      else v = String(v).trim();
      obj[header[i]] = v;
    }
    const code = normalizeCode(obj.code);
    if (!code) continue;
    obj.code = code;
    out.push(obj);
  }
  return out;
}

async function getSheetValues(token, bearer, spreadsheetToken, sheetId) {
  const url = `${LARK_HOST}/open-apis/sheets/v3/spreadsheets/${encodeURIComponent(spreadsheetToken)}/sheets/${encodeURIComponent(sheetId)}/values`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const j = await res.json();
  if (j.code !== 0) {
    // 降级 v2
    const v2 = `${LARK_HOST}/open-apis/sheets/v2/spreadsheets/${encodeURIComponent(spreadsheetToken)}/values/${encodeURIComponent(sheetId)}%21A1%3AZZ9999`;
    const r2 = await fetch(v2, {
      method: "GET", headers: { Authorization: `Bearer ${bearer}` },
    });
    const j2 = await r2.json();
    if (j2.code !== 0) throw new Error(`Lark read fail v3=${JSON.stringify(j)} v2=${JSON.stringify(j2)}`);
    return j2?.data?.valueRange?.values || [];
  }
  return j?.data?.valueRange?.values || [];
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "仅支持 GET" }),
      { status: 405, headers: corsHeaders(origin) });
  }

  const appId = Deno.env.get("LARK_APP_ID");
  const appSecret = Deno.env.get("LARK_APP_SECRET");
  if (!appId || !appSecret) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Edge Function 未配置 LARK_APP_ID / LARK_APP_SECRET。请用 `supabase secrets set` 填上。"
    }), { status: 503, headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get("spreadsheet_token") || "").trim() || DEFAULT_SPREADSHEET_TOKEN;
  const sheetId = (url.searchParams.get("sheet_id") || "").trim() || DEFAULT_SHEET_ID;

  if (!token) {
    return new Response(JSON.stringify({
      ok: false, error: "缺少 spreadsheet_token（URL 传或在 secrets 设 DEFAULT_SPREADSHEET_TOKEN）"
    }), { status: 400, headers: corsHeaders(origin) });
  }

  try {
    const bearer = await ensureToken(appId, appSecret);
    const values = await getSheetValues(token, bearer, token, sheetId);
    const items = parseValuesToItems(values, HEADER_LATEST);
    const payload = {
      ok: true,
      source: "feishu_openapi_supabase_edge",
      spreadsheet_token: token,
      sheet_id: sheetId,
      exported_at: new Date().toISOString(),
      count: items.length,
      items,
    };
    const headers = corsHeaders(origin);
    headers["Cache-Control"] = `public, s-maxage=${CACHE_TTL_SEC}, max-age=${CACHE_TTL_SEC}`;
    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch (err) {
    console.error("[feishu-funds] error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 502, headers: corsHeaders(origin) });
  }
});
