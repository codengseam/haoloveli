# =========================================================================
# 爱的小窝 (Love Nest) · 多阶段 Dockerfile
# 适配 GitHub Pages / 阿里魔搭 ModelScope 等容器平台
# 纯静态站点：Stage 1 预留构建位（未来可接入 Astro/构建），Stage 2 用 nginx 运行
# =========================================================================

# ---------- Stage 1: Builder（预留构建层） ----------
# 当前为纯静态站点无需构建；若未来引入 Astro/Tailwind 等，在此 stage 执行 build
# 并把产物输出到 /out 即可，Stage 2 无需改动。
FROM node:20-alpine AS builder
WORKDIR /src

# 拷贝静态源码（求婚站 /lovenest/ /wedding/ 均保留）
COPY . /src

# 准备发布目录：把整个 workspace 作为静态根（求婚站留于 /，爱的小窝于 /lovenest/）
RUN mkdir -p /out && cp -r /src/. /out/

# ---------- Stage 2: 运行时（nginx） ----------
FROM nginx:alpine AS runtime

# 清空默认页
RUN rm -rf /usr/share/nginx/html/*

# 从 builder 拷贝静态产物
COPY --from=builder /out /usr/share/nginx/html

# 自定义 nginx 配置（gzip + 中文文件名 + 静态回退）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口（魔搭默认监听 80）
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/lovenest/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
