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
 * ============================================================ */
(function () {
  "use strict";

  // ====== ✏️  请在这里填写你的 Supabase 配置  ======
  window.MS_ENV_CONFIG = {
    PROJECT_URL: "https://dfycvmzzbmuuyhsamsxp.supabase.co",
    ANON_PUBLIC_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmeWN2bXp6Ym11dXloc2Ftc3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMzA0MTUsImV4cCI6MjEwMTYwNjQxNX0.Mlye9gUGefBgvvHBc2TOCLaKDcxJCcSM3qHVTY2CZd8"
  };
  // ====================================================

})();
