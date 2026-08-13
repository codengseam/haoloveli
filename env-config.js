/* ============================================================
 * 🔧 集中配置文件 · GitHub Pages 部署请直接在这里填写配置
 * ============================================================
 * 【使用说明】
 * 1. 登录 https://supabase.com 新建项目
 *    （Region 推荐选新加坡 ap-southeast-1 或东京 ap-northeast-1，延迟最低）
 * 2. 左侧菜单 → SQL Editor → New query
 *    粘贴 lovenest/data/supabase_init.sql 全量执行一次（只需一次）
 * 3. 左侧菜单 → Project Settings → API，复制下面 2 项填到下方：
 *    - Project URL（形如 https://xxxx.supabase.co）→ 填 PROJECT_URL
 *    - Project API keys → anon public（长 JWT 字符串，开头 eyJhbGc...）→ 填 ANON_PUBLIC_KEY
 *
 * ⚠️  注意：anon public key 写在前端是安全的
 *    配合数据库 RLS 策略，匿名用户只能读写你们 couple_id 的那一行数据
 *    service_role key 绝对不能出现在前端！
 *
 * 【飞书基金自动化 · 3 种模式】
 * · 模式 A（纯静态）：FEISHU_PROXY_BASE 留空 ""，会走 data/feishu_funds.json（每次工作流跑完 bash scripts/sync_feishu.sh 手动同步）
 * · 模式 B（Nginx + Flask）：FEISHU_PROXY_BASE 留空 ""，Nginx 会把 /api/* 反代到 server/proxy_fund_feishu.py
 * · 模式 C（零运维 · 推荐）：
 *     部署 server/supabase-edge-function/feishu-funds/index.ts 后，把 FEISHU_PROXY_BASE 填成：
 *     "https://<你的 project_ref>.supabase.co/functions/v1"
 *     然后在 Supabase Secrets 里设置 LARK_APP_ID / LARK_APP_SECRET 即可在任何地方打开页面都能读到最新飞书数据
 * ============================================================ */
(function () {
  "use strict";

  // ====== ✏️  请在这里填写配置  ======
  window.MS_ENV_CONFIG = {
    PROJECT_URL: "https://dfycvmzzbmuuyhsamsxp.supabase.co",
    ANON_PUBLIC_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmeWN2bXp6Ym11dXloc2Ftc3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMzA0MTUsImV4cCI6MjEwMTYwNjQxNX0.Mlye9gUGefBgvvHBc2TOCLaKDcxJCcSM3qHVTY2CZd8",

    // ---- 飞书基金自动化 ----
    // 三种模式选一种：
    //
    // 模式 A【纯静态 · 零依赖】：
    //   FEISHU_PROXY_BASE 留空 ""。每次你工作流跑完飞书后执行 bash scripts/sync_feishu.sh 导出 JSON，然后部署静态站。
    //   结果：funds URL → 直接降级读 data/feishu_funds.json
    //
    // 模式 B【Nginx + Flask 私有部署 · 有服务器】：
    //   FEISHU_PROXY_BASE = ""，FEISHU_PROXY_PATH = "/feishu/"，docker-compose up 启 feishu_proxy 服务
    //   结果：funds URL → /api/feishu/funds (Nginx 反代到 Flask)
    //
    // 模式 C【Supabase Edge · 零运维推荐 · 任何地方打开都读最新】：
    //   部署 server/supabase-edge-function/feishu-funds/index.ts 后填：
    //     FEISHU_PROXY_BASE = "https://dfycvmzzbmuuyhsamsxp.supabase.co/functions/v1"
    //     FEISHU_PROXY_PATH = "/feishu-"
    //   结果：funds URL → https://<ref>.supabase.co/functions/v1/feishu-funds
    FEISHU_PROXY_BASE: "",
    FEISHU_PROXY_PATH: "/feishu/",
    DEFAULT_SPREADSHEET_TOKEN: "K6YDwZGP8im24Ek5WnecdJH5nrd",
    DEFAULT_SHEET_ID: "4e7337",
  };
  // ====================================================

})();
