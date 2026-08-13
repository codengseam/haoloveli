/* =========================================================================
   爱的小窝 · Supabase / 飞书代理配置入口
   =========================================================================
   【 GitHub Pages 部署 · 配置方法 】
   ⚡️ 只需要改一个文件：项目根目录下的 👉 env-config.js 👈
   打开它，把你的 PROJECT_URL 和 ANON_PUBLIC_KEY 填进去，保存，推送到 GitHub 即可。

   【 三种配置方式（优先级从高到低） 】
   1. localStorage 运行时配置（浏览器内生效，通过 deployment.html 向导设置）
   2. 根目录 env-config.js（推荐 · GitHub Pages 部署写死用这个）★
   3. 下方 HARDCODED_CFG 硬编码（不推荐修改，作为兜底占位）

   【 飞书基金自动化 —— 3 种模式 】
   · 模式 A（本地）：不开后端，每次你工作流跑完飞书，执行 `bash scripts/sync_feishu.sh` 导出 JSON，然后部署静态站
   · 模式 B（私有部署）：启 server/proxy_fund_feishu.py（Flask），Nginx 把 `/api/*` 反代过去，
                        此时 FEISHU_PROXY_BASE 留空或填 "/api"（相对路径）
   · 模式 C（零运维）：部署 Supabase Edge Function（server/supabase-edge-function/feishu-funds/index.ts），
                        然后把 FEISHU_PROXY_BASE 填成 Edge Function 完整 URL，例如：
                        "https://dfycvmzzbmuuyhsamsxp.supabase.co/functions/v1"
                        ⚠️ FEISHU_PROXY_PATH 一般不用改，除非你改了 Edge Function 名
                        默认拼出来就是：FEISHU_PROXY_BASE + FEISHU_PROXY_PATH + "funds"
                                         = https://xxx.supabase.co/functions/v1/feishu-funds

   【 安全说明 】
   - anon public key 写在前端是**安全的**：配合数据库 RLS（行级安全）策略，
     匿名用户只能读写 couple_id 匹配的那一行数据，无法碰别人的数据。
   - service_role key 绝对不能出现在前端！那个权限太大，只能在服务器端用。
   - LARK_APP_ID / LARK_APP_SECRET 绝不能填到前端 config！它们只存在服务器环境变量或 Supabase Secrets。
   ========================================================================= */
(function () {
  "use strict";

  // --- 兜底硬编码（优先级最低）· 建议不要改这里，改根目录 env-config.js ---
  var HARDCODED_CFG = {
    PROJECT_URL: "https://YOUR-PROJECT-REFERENCE-ID.supabase.co",
    ANON_PUBLIC_KEY: "YOUR-ANON-PUBLIC-JWT-KEY-REPLACE-ME",
    COUPLE_ID: "aaaa1111-bbbb-cccc-dddd-eeeeffff0001",
    MAX_RETRY: 3,
    QUEUE_FLUSH_INTERVAL_MS: 30 * 1000,
    REFRESH_INTERVAL_MS: 2 * 60 * 1000,
    // 飞书基金代理相关
    // 前端配置规则：
    //   模式 A（纯静态）：FEISHU_PROXY_BASE 留空 ""，会走 data/feishu_funds.json
    //   模式 B（Nginx + Flask 私有部署）：
    //        FEISHU_PROXY_BASE = ""，FEISHU_PROXY_PATH = "/feishu/"
    //        最终 URL = /api/feishu/funds
    //   模式 C（Supabase Edge Function 零运维）：
    //        FEISHU_PROXY_BASE = "https://<ref>.supabase.co/functions/v1"
    //        FEISHU_PROXY_PATH = "/feishu-"
    //        最终 URL = https://<ref>.supabase.co/functions/v1/feishu-funds
    FEISHU_PROXY_BASE: "",
    FEISHU_PROXY_PATH: "/feishu/",   // 在 URL 中 funds 前插入这一段（注意开头/结尾是否带 /）
    DEFAULT_SPREADSHEET_TOKEN: "K6YDwZGP8im24Ek5WnecdJH5nrd",
    DEFAULT_SHEET_ID: "4e7337",
  };

  // --- 根目录 env-config.js 注入（GitHub Pages 推荐方式）---
  var MS_ENV = (typeof window !== "undefined" && window.MS_ENV_CONFIG) || {};

  // 合并规则：env-config.js > HARDCODED_CFG
  var merged = Object.assign({}, HARDCODED_CFG);
  if (MS_ENV.PROJECT_URL && !/YOUR-PROJECT/i.test(MS_ENV.PROJECT_URL)) {
    merged.PROJECT_URL = MS_ENV.PROJECT_URL;
  }
  if (MS_ENV.ANON_PUBLIC_KEY && !/YOUR-ANON/i.test(MS_ENV.ANON_PUBLIC_KEY)) {
    merged.ANON_PUBLIC_KEY = MS_ENV.ANON_PUBLIC_KEY;
  }
  // 飞书基金代理：允许单独覆盖 BASE / PATH / spreadsheet_token / sheet_id
  ["FEISHU_PROXY_BASE", "FEISHU_PROXY_PATH", "DEFAULT_SPREADSHEET_TOKEN", "DEFAULT_SHEET_ID"]
    .forEach(function (k) {
      if (typeof MS_ENV[k] === "string") merged[k] = MS_ENV[k];
    });

  window.LOVENEST_SUPABASE_CONFIG = merged;
})();
