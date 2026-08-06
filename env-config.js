/* 占位版 env-config.js · 不在容器里时使用（例如本地直接打开 HTML 文件）
 * 魔搭 Docker 容器启动时，entrypoint.sh 会用真实环境变量覆盖本文件内容 */
(function () {
  "use strict";
  // 这里的值保持占位即可；config.js 里有正则检测占位并忽略
  window.MS_ENV_CONFIG = {
    PROJECT_URL: "https://YOUR-PROJECT-REFERENCE-ID.supabase.co",
    ANON_PUBLIC_KEY: "YOUR-ANON-PUBLIC-JWT-KEY-REPLACE-ME"
  };
})();
