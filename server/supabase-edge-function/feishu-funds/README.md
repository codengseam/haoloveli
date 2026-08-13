# server/supabase-edge-function/feishu-funds/index.ts
# ==============================================================================
# Supabase Edge Function 版飞书基金代理（部署到云端后，任何地方打开页面都能读最新飞书数据）
# 与 server/proxy_fund_feishu.py 接口完全一致，前端配置一个 BASE_URL 即可切
#
# 部署步骤：
#   1) 安装 Supabase CLI: https://supabase.com/docs/guides/cli
#   2) 链接项目: supabase link --project-ref <your_project_ref>
#   3) 设置 Secrets:
#        supabase secrets set LARK_APP_ID=cli_xxx
#        supabase secrets set LARK_APP_SECRET=xxx
#        supabase secrets set DEFAULT_SPREADSHEET_TOKEN=K6YDwZGP8im24Ek5WnecdJH5nrd   （可选）
#        supabase secrets set DEFAULT_SHEET_ID=4e7337                              （可选）
#        supabase secrets set CORS_ORIGINS='https://xxx.gitee.io,https://xxx.com'   （推荐填生产域名）
#   4) 部署：supabase functions deploy feishu-funds --no-verify-jwt
#   5) 前端 shared/config.js 里：
#        LOVENEST_FEISHU_PROXY_BASE = "https://<your_project_ref>.supabase.co/functions/v1/feishu-funds"
# ==============================================================================
