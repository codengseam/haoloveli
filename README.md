# 求婚回忆录 💍

> 一个为大屏投影现场求婚设计的静态浪漫网页。

## 在线预览

- GitHub Pages：待部署后填写
- 魔搭创空间：待部署后填写

## 本地使用

```bash
# 方式一：直接用浏览器打开
open index.html

# 方式二：启动本地静态服务器
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

## 项目结构

```
.
├── index.html          # 主页面（求婚演示网页）
├── lihao.img/          # 旅行照片（竖版 15 张）
├── lovebgm.mp3         # 背景音乐
├── .gitignore          # Git 忽略配置
└── README.md           # 本文件
```

## 核心功能

- 🎬 全屏幻灯片式展示，适合大屏投影
- 🌸 封面爱心飘落特效
- 📸 宝丽来相框 + 竖版照片适配
- ⏳ 时间轴导轨，串联相识/相恋/求婚节点
- 💍 心形照片墙求婚高潮
- ✉️ 手写情书页
- ⏰ 实时计时器：相识天数、相恋天数
- 🎵 背景音乐自动播放（带开关）
- 🖱️ 支持点击、键盘方向键、空格键、触摸滑动翻页
- ▶️ 自动播放（播放到最后一页停止）

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库（例如 `love-proposal`）
2. 将当前项目推送到仓库：

```bash
git remote add origin https://github.com/<你的用户名>/love-proposal.git
git add -A
git commit -m "feat: 重新整理为静态求婚站点"
git push -u origin main
```

3. 进入仓库 Settings → Pages → Source，选择 `main` 分支和 `/(root)` 目录
4. 等待几分钟，访问 `https://<你的用户名>.github.io/love-proposal`

> 注意：GitHub Pages 对中文文件名的 URL 支持较好，本项目的图片路径已使用 URL 编码。

## 部署到魔搭创空间（ModelScope）

1. 登录 [魔搭创空间](https://www.modelscope.cn/studios)
2. 新建一个创空间，选择**静态站点**模板
3. 将本项目文件打包上传，或关联 Git 仓库
4. 点击部署，等待上线

### 魔搭部署要点

- 确保 `index.html` 位于仓库根目录
- `lihao.img/` 和 `lovebgm.mp3` 需要随代码一起上传
- 静态站点模板通常不需要后端服务

## 重要日期

- 相识：2024 年 12 月 30 日
- 相恋：2025 年 5 月 10 日
- 求婚：2026 年 6 月 22 日

## 后续添加照片

1. 将新的竖版照片放入 `lihao.img/`
2. 在 `index.html` 中复制一个 `.slide` 照片页区块
3. 修改 `src` 为对应文件名（中文名需要 URL 编码）
4. 更新 `photoDates` 数组中的日期和文案

## 音乐说明

- 使用 `lovebgm.mp3` 作为背景音乐
- 如需替换，直接覆盖同名文件即可
- 支持浏览器自动播放策略（首次需要用户交互后才会播放）

## 浏览器兼容

- Chrome / Edge / Safari / Firefox 最新版本
- 推荐分辨率：1920×1080 或 4K 大屏投影
- 已做横屏大屏适配

---

祝求婚成功！💕
