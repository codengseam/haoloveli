#!/bin/sh
set -e

# =========================================================================
# 魔搭 ModelScope 容器启动脚本：把环境变量注入到前端可读取的 env-config.js
# =========================================================================
# 原理：
#   魔搭在「明文变量」和「密文管理」里配置的值，会以 Linux 环境变量的形式
#   注入到容器中。但前端 JS 在用户浏览器里跑，读不到容器的环境变量。
#   所以我们在 nginx 启动前，把这些值写到一个静态 env-config.js 文件里，
#   前端页面在加载 config.js 之前先加载它，就能拿到配置了。
#
# 魔搭里的 key 名（必须完全一致，大小写敏感）：
#   Project_URL      → Supabase 项目 URL
#   anon_public_key  → Supabase anon public key
# =========================================================================

OUTPUT_DIR="/usr/share/nginx/html"
OUTPUT_FILE="${OUTPUT_DIR}/env-config.js"

# 读取环境变量，如果空则给占位值（前端 detectEnabled 会自动识别占位而不启用云端）
PROJECT_URL_VAL="${Project_URL:-https://YOUR-PROJECT-REFERENCE-ID.supabase.co}"
ANON_KEY_VAL="${anon_public_key:-YOUR-ANON-PUBLIC-JWT-KEY-REPLACE-ME}"

# 确保输出目录存在
mkdir -p "${OUTPUT_DIR}"

# 生成 env-config.js（注意用单引号包裹变量，防止 shell 解析 JS 大括号）
cat > "${OUTPUT_FILE}" <<EOF
/* 由容器 entrypoint.sh 在启动时自动生成 —— 来源：魔搭明文/密文环境变量 */
(function () {
  "use strict";
  window.MS_ENV_CONFIG = {
    PROJECT_URL: '$(echo "${PROJECT_URL_VAL}" | sed "s/'/\\\\'/g")',
    ANON_PUBLIC_KEY: '$(echo "${ANON_KEY_VAL}" | sed "s/'/\\\\'/g")'
  };
})();
EOF

echo "[entrypoint] 已生成 env-config.js"
echo "  PROJECT_URL     = ${PROJECT_URL_VAL}"
if [ "${ANON_KEY_VAL}" = "YOUR-ANON-PUBLIC-JWT-KEY-REPLACE-ME" ]; then
  echo "  ANON_PUBLIC_KEY = <占位未配置>"
else
  echo "  ANON_PUBLIC_KEY = <已配置，长度 ${#ANON_KEY_VAL}>"
fi

# 把 CMD 里的参数接过来执行（即原来的 nginx -g daemon off;）
exec "$@"
