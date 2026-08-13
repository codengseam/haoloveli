#!/usr/bin/env bash
# 一键把飞书「最新数据」tab 导出为前端可读取的 data/feishu_funds.json
# 用法：cd /workspace/lovenest && bash scripts/sync_feishu.sh
# 依赖：lark-cli 已授权（通过外部凭据或 lark-cli auth login）

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOVENEST_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$LOVENEST_ROOT"

WIKI_URL="${1:-https://my.feishu.cn/wiki/K6YDwZGP8im24Ek5WnecdJH5nrd?sheet=4e7337}"
SHEET_ID="${2:-4e7337}"

echo "==> 从飞书拉取 tab=${SHEET_ID}（最新数据）"
LARKSUITE_CLI_NO_UPDATE_NOTIFIER=1 LARKSUITE_CLI_NO_SKILLS_NOTIFIER=1 \
  lark-cli sheets +csv-get --url "$WIKI_URL" --sheet-id "$SHEET_ID" --format json \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
if not d.get('ok'):
    print('[FAIL] lark-cli 响应失败', file=sys.stderr)
    print(json.dumps(d, ensure_ascii=False, indent=2), file=sys.stderr)
    sys.exit(1)
print(d['data']['annotated_csv'])
" \
  | python3 scripts/export_feishu_funds.py --stdin

echo "==> ✅ 完成。前端刷新页面后会自动读取新数据。"
