/* =========================================================================
   爱的小窝 · Supabase 配置入口
   =========================================================================
   【 你需要在这里填 2 个值 】
   步骤：
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
  window.LOVENEST_SUPABASE_CONFIG = {
    // 把右边的占位替换成你的真实 Project URL
    PROJECT_URL: "https://YOUR-PROJECT-REFERENCE-ID.supabase.co",

    // 把右边的占位替换成你的 anon public key（JWT 长字符串）
    ANON_PUBLIC_KEY: "YOUR-ANON-PUBLIC-JWT-KEY-REPLACE-ME",

    // 你们 couple 的固定 uuid，和 data/supabase_init.sql 里保持一致，不要改
    COUPLE_ID: "aaaa1111-bbbb-cccc-dddd-eeeeffff0001",

    // 离线重试队列最大尝试次数（指数退避 10s → 20s → 40s）
    MAX_RETRY: 3,

    // 后台每 N 毫秒尝试把离线队列冲上去
    QUEUE_FLUSH_INTERVAL_MS: 30 * 1000,

    // 每 N 毫秒从云端拉一次最新数据做增量合并（防止两台手机同时写冲突）
    REFRESH_INTERVAL_MS: 2 * 60 * 1000,
  };
})();
