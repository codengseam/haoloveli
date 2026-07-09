/* =========================================================================
   豪❤力 · 爱的小窝 — Content loader + tag-based md adaptation
   =========================================================================
   标签系统设计 (Tag system):
   - 每页通过 data-page="love-map" 等声明自己的页面标签
   - 每个 md 内容在 data/content-manifest.json 中登记,带 pages/tags/type 字段
   - 内容容器 [data-content-for="<pageId>"] 会自动渲染匹配该页的条目
   - 点击条目 → fetch md 文件 → marked.js 渲染 → 弹窗展示
   - 新增内容只需: 在 docs/ 放 md + 在 manifest 登记 (md 内 frontmatter 可覆盖)
   ========================================================================= */
(function () {
  "use strict";

  /* marked.js 可用则配置; 不可用则降级为 <pre> 纯文本 */
  function ensureMarked() {
    if (typeof window.marked !== "undefined") {
      try {
        window.marked.setOptions({ breaks: true, gfm: true });
      } catch (e) {}
      return true;
    }
    return false;
  }

  /* 解析 md frontmatter (--- ... ---) 为对象, 返回 {meta, body} */
  function parseFrontmatter(text) {
    const meta = {};
    let body = text;
    const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (m) {
      body = text.slice(m[0].length);
      m[1].split("\n").forEach(line => {
        const idx = line.indexOf(":");
        if (idx < 0) return;
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        // 去引号
        val = val.replace(/^["'](.*)["']$/, "$1");
        // 数组形式 [a, b]
        if (/^\[.*\]$/.test(val)) {
          val = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        }
        if (key) meta[key] = val;
      });
    }
    return { meta, body };
  }

  function renderMd(text) {
    const { meta, body } = parseFrontmatter(text);
    if (ensureMarked()) {
      try { return window.marked.parse(body); } catch (e) {}
    }
    return "<pre>" + body.replace(/</g, "&lt;") + "</pre>";
  }

  /* 渲染一个内容条目卡片 */
  function itemCard(item) {
    const tags = (item.tags || []).map(t => `<span class="tag tag--sage">${t}</span>`).join("");
    const typeMap = { book: "📚 书", note: "📝 笔记", quote: "💬 语录", planning: "🗂 规划" };
    const typeLabel = typeMap[item.type] || "📄 文档";
    return `
    <article class="card card--plain reveal">
      <div class="flex aic gap-1 mb-2 wrap">
        <span class="tag">${typeLabel}</span>
        ${tags}
      </div>
      <h3>${item.title || "未命名文档"}</h3>
      ${item.author ? `<p class="faint" style="margin-bottom:6px;font-size:.82rem">${item.author}</p>` : ""}
      ${item.summary ? `<p>${item.summary}</p>` : ""}
      <button class="btn btn--ghost btn--small mt-2" data-md="${item.id}">阅读全文 →</button>
    </article>`;
  }

  /* 主入口: 为所有 [data-content-for] 容器加载匹配内容。
     页面归属由容器自身的 data-content-for 属性驱动(无需传参),
     这样一份 manifest 可同时服务多个页面的多个容器。 */
  async function loadContentForPage(manifestUrl) {
    const containers = document.querySelectorAll("[data-content-for]");
    if (!containers.length) return;
    const manifest = await window.LoveNest.getJSON(manifestUrl || "data/content-manifest.json", { items: [] });
    if (!manifest.items || !manifest.items.length) {
      containers.forEach(c => { c.innerHTML = `<p class="muted center">暂无匹配内容。可在 docs/ 添加 md 并在 data/content-manifest.json 登记。</p>`; });
      return;
    }
    containers.forEach(container => {
      const wantPage = container.getAttribute("data-content-for");
      const wantTag = container.getAttribute("data-content-tag"); // 可选: 进一步按 tag 过滤
      const matches = manifest.items.filter(it => {
        const inPages = (it.pages || []).includes(wantPage);
        const tagOk = !wantTag || (it.tags || []).includes(wantTag);
        return inPages && tagOk;
      });
      if (!matches.length) {
        container.innerHTML = `<p class="muted center">这一区暂无内容。后续补充 md 时,在 frontmatter 写 <code>pages: [${wantPage}]</code> 即会出现在此。</p>`;
        return;
      }
      container.innerHTML = matches.map(itemCard).join("");
      // 重新触发 reveal
      container.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
      // 绑定点击
      container.querySelectorAll("[data-md]").forEach(btn =>
        btn.addEventListener("click", () => openDoc(btn.getAttribute("data-md"), manifest))
      );
    });
  }

  /* 打开一个文档: 先用 manifest 元数据, 再 fetch md body */
  async function openDoc(id, manifest) {
    const item = (manifest.items || []).find(i => i.id === id);
    if (!item) { window.LoveNest.openModal("文档", "<p>未找到该文档。</p>"); return; }
    window.LoveNest.openModal(item.title || "文档", `<p class="muted">加载中…</p>`);
    try {
      const res = await fetch(item.file, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      const html = renderMd(text);
      window.LoveNest.openModal(item.title || "文档", html);
    } catch (e) {
      window.LoveNest.openModal(item.title || "文档",
        `<div class="callout callout--rose"><p><strong>无法加载文档。</strong></p>
         <p>可能是因为用 <code>file://</code> 直接打开了网页 (浏览器禁止本地 fetch)。</p>
         <p>请在 <code>lovenest</code> 目录运行: <code>python3 -m http.server 8000</code><br/>然后访问 <code>http://localhost:8000</code></p></div>`);
    }
  }

  /* 公开 */
  window.LoveNest = window.LoveNest || {};
  window.LoveNest.loadContentForPage = loadContentForPage;
  window.LoveNest.renderMd = renderMd;
})();
