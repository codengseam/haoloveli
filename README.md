# haoloveli 💍

> 豪❤力 · 谐音"好爱你"  
> 一个为大屏投影现场求婚设计的静态浪漫网页。

## 关于名字

**haoloveli** = **豪** (师豪) ❤ **力** (佳力)

这个名字融合了：
- 男主角：**师豪**
- 女主角：**佳力**
- 谐音：**好爱你** ❤️

寓意着师豪对佳力的深情厚意，希望这份爱意能够永远传递下去。

## 在线预览

- Gitee Pages：https://aicodeng.gitee.io/love
  - 仓库地址：https://gitee.com/aicodeng/love
  - 需在 Gitee 仓库设置中开启 Pages 服务
- GitHub Pages：可推送到 `origin` 远程后启用
- 魔搭创空间：可打包本项目上传为静态站点

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
├── index.html          # 主页面（haoloveli 求婚演示网页）
├── lihao.img/          # 旅行照片（42 张，含 HEIC 转换后的 JPG）
├── lovebgm.mp3         # 背景音乐
├── .gitignore          # Git 忽略配置
└── README.md           # 本文件
```

## 核心功能

- 🎬 全屏幻灯片式展示，适合大屏投影
- 🌸 封面启动层，点击后音乐 + 幻灯片全自动播放
- 📸 宝丽来相框 + 竖版/横版照片自动适配
- 👤 单人照配对展示：左右分栏，两张单人照同页
- 👫 合照单页展示：文字 + 照片，左右交替
- ⏳ 时间轴导轨，串联相识/相恋/每一站
- 💍 心形照片墙求婚高潮（42 张照片组成爱心）
- ✉️ 手写情书页
- ⏰ 实时计时器：相识天数、相恋天数
- 🎵 背景音乐自动播放（带开关）
- 🖱️ 支持点击、键盘方向键、空格键、触摸滑动翻页
- ▶️ 自动播放（播放到最后一页停止）
- ❤️ 专属名字展示：师豪 ❤ 佳力

## 部署到 Gitee Pages

当前项目已推送到 `git@gitee.com:aicodeng/love.git`。

1. 打开 https://gitee.com/aicodeng/love
2. 进入「仓库设置」→「Pages 服务」
3. 选择 `master` 分支和 `/(root)` 目录，点击部署
4. 等待 1-2 分钟后访问 https://aicodeng.gitee.io/love

## 部署到 GitHub Pages

1. 推送当前项目到 GitHub 仓库：

```bash
git remote add origin https://github.com/<你的用户名>/love-proposal.git
git push -u origin master
```

2. 进入仓库 Settings → Pages → Source，选择 `master` 分支和 `/(root)` 目录
3. 等待几分钟后访问 `https://<你的用户名>.github.io/love-proposal`

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
- 求婚：2026 年 动态时间

## 后续添加照片

1. 将新的照片放入 `lihao.img/`
2. 在 `index.html` 中编辑 `photoPages` 数组，添加/删除照片页
3. 单人照使用 `type: 'pair'`，合照使用 `type: 'couple'`
4. 中文文件名需要 URL 编码（可参考 `lihao.img/` 中已有图片的编码方式）

## 照片处理说明

- 大于 30MB 的照片会自动压缩
- HEIC 格式会自动转换为浏览器兼容的 JPG
- 竖版照片使用 3:4 相框展示，优先保留人脸区域
- 横版照片使用 16:9 相框展示，适合风景/全身照

## 音乐说明

- 使用 `lovebgm.mp3` 作为背景音乐
- 如需替换，直接覆盖同名文件即可
- 浏览器要求音频播放必须有用户手势（点击启动层后自动播放）

## 浏览器兼容

- Chrome / Edge / Safari / Firefox 最新版本
- 推荐分辨率：1920×1080 或 4K 大屏投影
- 已做横屏大屏适配

---

**haoloveli** · 豪❤力 · 好爱你

祝师豪和佳力幸福美满！💕
