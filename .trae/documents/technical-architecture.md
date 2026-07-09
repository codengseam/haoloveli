# 技术架构 · 婚拍决策手记网页

## 一、技术选型
- 纯静态：HTML5 + CSS3（自定义属性）+ 原生 JS（ES6+）。
- 无框架、无构建。可直接 `python3 -m http.server` 起服务。
- 唯一外部依赖：`marked.js`（CDN，md 渲染）+ Google Fonts。CDN 不可用时降级为纯文本显示。

## 二、目录结构
```
/workspace/wedding/
├── index.html        # 单页结构 + 各 section
├── styles.css        # 设计系统 + 组件样式
├── app.js            # 交互逻辑（localStorage / modal / 旋钮 / 导出）
└── docs/
    ├── 00-first-principles.md
    ├── 01-shangyuehai-qingmubai.md
    ├── 02-jinfulen-shanyushu.md
    ├── 03-climate-timing.md
    ├── 04-chuanxi-xinjiang.md
    ├── 05-decision-framework.md
    └── 06-pitfall-checklist.md
```

## 三、设计系统（CSS 变量）
```css
--cream:#fdf6f0; --blush:#fbeae0; --peach:#f7d9c4;
--rose:#d98a7a; --terracotta:#c97b63; --burgundy:#7a4b3a;
--gold:#c9a96e; --ink:#4a3b32; --muted:#8a7568;
```
字体：标题 `Noto Serif SC`；浪漫点缀 `Ma Shan Zheng`；正文 `Noto Sans SC`。

## 四、关键交互
1. **localStorage 键命名空间**：`weddingplan:*`（notes / checklist / knobs / todos）。
2. **md modal**：`fetch('docs/xx.md')` → `marked.parse()` → 注入 `.doc-modal__body`；fetch 失败提示用 http 服务打开。
3. **决策旋钮逻辑**：三组单选 change → 计算 → 映射到 A/B/C/D 方案 → 高亮推荐卡。
4. **导出**：汇总规划区内容为 markdown 文本，复制到剪贴板 + 提供 .md 下载。

## 五、响应式
- 桌面：双栏（诉求对比、机构卡片网格 2-3 列）。
- ≤768px：单栏，导航折叠为顶部 chip 行。

## 六、可访问性
- 语义化 `section/nav/main/article`。
- 所有交互元素键盘可达，modal 有 Esc 关闭、焦点陷阱。
- 装饰性 SVG `aria-hidden`。

## 七、风险与降级
- CDN（marked/字体）失败：md 以 `<pre>` 纯文本显示；字体回退系统衬线。
- file:// 打开 md fetch 受 CORS 限制：提示用 `python3 -m http.server` 起服务。
