/* =========================================================================
   爱的小窝 · Supabase 配置入口
   =========================================================================
   【 GitHub Pages 部署 · 配置方法 】
   ⚡️ 只需要改一个文件：项目根目录下的 👉 env-config.js 👈
   打开它，把你的 PROJECT_URL 和 ANON_PUBLIC_KEY 填进去，保存，推送到 GitHub 即可。

   【 三种配置方式（优先级从高到低） 】
   1. localStorage 运行时配置（浏览器内生效，通过 deployment.html 向导设置）
   2. 根目录 env-config.js（推荐 · GitHub Pages 部署写死用这个）★
   3. 下方 HARDCODED_CFG 硬编码（不推荐修改，作为兜底占位）

   【 配置步骤 】
   1. 登录 https://supabase.com 新建项目
      （Region 推荐新加坡 ap-southeast-1 或东京 ap-northeast-1，延迟最低）
   2. 左侧菜单 → SQL Editor → New query
      粘贴 lovenest/data/supabase_init.sql 全量执行一次（只需一次）
   3. 左侧菜单 → Project Settings → API，复制：
        - Project URL（https://xxxx.supabase.co）→ 填入 env-config.js 的 PROJECT_URL
        - anon public key（开头 eyJhbGc...）→ 填入 env-config.js 的 ANON_PUBLIC_KEY
   4. 保存后推送代码到 GitHub，等待 Pages 部署完成

   【 安全说明 】
   - anon public key 写在前端是**安全的**：配合数据库 RLS（行级安全）策略，
     匿名用户只能读写 couple_id 匹配的那一行数据，无法碰别人的数据。
   - service_role key 绝对不能出现在前端！那个权限太大，只能在服务器端用。
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
  };

  // --- 根目录 env-config.js 注入（GitHub Pages 推荐方式）---
  var MS_ENV = (typeof window !== "undefined" && window.MS_ENV_CONFIG) || {};

  // 合并规则：env-config.js > HARDCODED_CFG
  // 只允许覆盖 URL 和 Key，不动 COUPLE_ID / 时间间隔等
  var merged = Object.assign({}, HARDCODED_CFG);
  if (MS_ENV.PROJECT_URL && !/YOUR-PROJECT/i.test(MS_ENV.PROJECT_URL)) {
    merged.PROJECT_URL = MS_ENV.PROJECT_URL;
  }
  if (MS_ENV.ANON_PUBLIC_KEY && !/YOUR-ANON/i.test(MS_ENV.ANON_PUBLIC_KEY)) {
    merged.ANON_PUBLIC_KEY = MS_ENV.ANON_PUBLIC_KEY;
  }

  window.LOVENEST_SUPABASE_CONFIG = merged;
})();
