/* =========================================================================
   爱的小窝 · Supabase 配置入口
   =========================================================================
   【 两种方式配置，任选其一 】

   方式 A · 浏览器内向导（最简单，不用改代码）★ 推荐
     直接在浏览器里打开项目里的 👉 deployment.html 👈  跟着 5 步走：
     ① 建 Supabase 项目 → ② 点一下复制 SQL 在 SQL Editor 里 Run → ③ 粘贴 URL+Key 点测试连接
     → ④ 一键把本机已填好的数据同步到云端 → ⑤ 完成。
     所有配置存放在本浏览器 localStorage 的 `lovenest:runtime:supabase-config`。

   方式 B · 改代码文件（适合部署到 Vercel / Netlify / GitHub Pages 前一次性写死）
     按下面注释手动填 PROJECT_URL / ANON_PUBLIC_KEY，保存后刷新任意页面：
     1. 登录 https://supabase.com 新建项目（Region 选新加坡 ap-southeast-1 或东京 ap-northeast-1，延迟最低）
     2. 左侧菜单 → SQL Editor → New query，粘贴 data/supabase_init.sql 全量执行一次（只需一次）
     3. 左侧菜单 → Project Settings → API，复制下面 2 项：
          - Project URL（形如 https://xxxx.supabase.co） → 填到 LOVENEST_SUPABASE_URL
          - Project API keys → anon public（长 JWT 字符串，开头一般是 eyJhbGc...） → 填到 LOVENEST_SUPABASE_ANON_KEY
        ⚠️  千万不要用 service_role key！那个权限太大，只能在服务器端用，不能写进前端代码
     4. 保存本文件，刷新任意页面 → F12 → Console 看到 "LoveNest DB: Supabase 已连接, 启用云端同步" 就 OK
     5. 如果不填，保持下面的占位值，页面也会完全正常运行，只是数据只存在浏览器 localStorage，不会云端同步

   【 注意事项 】
   - anon public key 写在前端是**安全的**：配合数据库里的 RLS（行级安全）策略，匿名用户只能读写
     couple_id=aaaa1111... 这一行的数据（即你们俩的），无法碰别人的数据。service_role key 绝对不能
     出现在前端，否则任何人都能 truncate 你的表。
   - 如果未来要加"师豪 / 佳力 独立登录"，可以启用 Supabase Auth，把 policy 从 "anon allow all"
     收紧到 "auth.uid() 匹配"。到时候改 RLS 就行，不用改前端代码。
   ========================================================================= */
(function () {
  "use strict";

  // --- 代码里写死的默认值（优先级最低）---
  var HARDCODED_CFG = {
    PROJECT_URL: "https://YOUR-PROJECT-REFERENCE-ID.supabase.co",
    ANON_PUBLIC_KEY: "YOUR-ANON-PUBLIC-JWT-KEY-REPLACE-ME",
    COUPLE_ID: "aaaa1111-bbbb-cccc-dddd-eeeeffff0001",
    MAX_RETRY: 3,
    QUEUE_FLUSH_INTERVAL_MS: 30 * 1000,
    REFRESH_INTERVAL_MS: 2 * 60 * 1000,
  };

  // --- 魔搭 ModelScope 注入：entrypoint.sh 生成的 env-config.js（优先级中等）---
  // 只要你在魔搭部署设置里填了密文 Project_URL + anon_public_key，
  // 容器启动时 entrypoint.sh 会把它们写到根目录的 env-config.js，
  // HTML 页面在 config.js 之前加载 env-config.js，值会出现在 window.MS_ENV_CONFIG 里。
  var MS_ENV = (typeof window !== "undefined" && window.MS_ENV_CONFIG) || {};

  // 合并规则：MS_ENV > HARDCODED_CFG
  // 注意：不要覆盖 COUPLE_ID / 时间间隔等非敏感字段，只允许 MS_ENV 覆盖 URL 和 key
  var merged = Object.assign({}, HARDCODED_CFG);
  if (MS_ENV.PROJECT_URL && !/YOUR-PROJECT/i.test(MS_ENV.PROJECT_URL)) {
    merged.PROJECT_URL = MS_ENV.PROJECT_URL;
  }
  if (MS_ENV.ANON_PUBLIC_KEY && !/YOUR-ANON/i.test(MS_ENV.ANON_PUBLIC_KEY)) {
    merged.ANON_PUBLIC_KEY = MS_ENV.ANON_PUBLIC_KEY;
  }

  window.LOVENEST_SUPABASE_CONFIG = merged;
})();
