/* =========================================================================
   豪❤力 · 爱的小窝 — Shared navigation & utilities
   Loaded on every page. Provides: top nav, mobile drawer, scroll reveal,
   smooth anchor, footer year, and a global APP namespace.
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- Site config (single source of truth for nav) ---------- */
  const NAV = [
    { id: "dashboard",  href: "index.html",        label: "首页",        desc: "爱的仪表盘 · 相恋天数 · 今日金句" },
    { id: "love-map",   href: "love-map.html",     label: "爱情地图",     desc: "深度了解彼此的内心世界" },
    { id: "bank",       href: "bank.html",         label: "情感账户",     desc: "日常的存款与取款记录" },
    { id: "milestones", href: "milestones.html",   label: "人生里程碑",   desc: "阶段规划与婚礼筹备" },
    { id: "family",     href: "family.html",       label: "家庭关系网",   desc: "父母档案与节日走动" },
    { id: "peace",      href: "peace.html",         label: "停战协议",     desc: "冲突解决机制与安全词" }
  ];

  const BRAND = { mark: "❀", name: "爱的小窝", sub: "豪 ❤ 力 · Our Life OS" };

  /* ---------- Auth (pure frontend gate · localStorage) ----------
     固定账号：djl / 19990108、dxsh / 19980720
     仅作小窝入口的轻量门禁，非真正安全鉴权。登录态写入 localStorage，
     各 lovenest 页面在 nav.js 自动初始化时校验，未登录则跳转 login.html。
  ---------------------------------------------------------------- */
  const AUTH = {
    accounts: { "djl": "19990108", "dxsh": "19980720" },
    names: { "djl": "师豪", "dxsh": "佳力" },
    key: "auth",
    _read() {
      try { return JSON.parse(localStorage.getItem("lovenest:" + this.key) || "null"); }
      catch (e) { return null; }
    },
    isLoggedIn() {
      const a = this._read();
      return !!(a && a.user && this.accounts[a.user] !== undefined);
    },
    current() { return this._read(); },
    displayName() {
      const a = this._read();
      if (!a || !a.user) return "";
      return this.names[a.user] || a.user;
    },
    login(user, pwd) {
      if (this.accounts[user] && this.accounts[user] === pwd) {
        localStorage.setItem("lovenest:" + this.key, JSON.stringify({ user: user, ts: Date.now() }));
        return true;
      }
      return false;
    },
    logout() {
      localStorage.removeItem("lovenest:" + this.key);
    },
    /* 未登录则跳转登录页（相对路径，lovenest 同级目录） */
    requireAuth() {
      if (!this.isLoggedIn()) {
        location.replace("login.html");
        return false;
      }
      return true;
    }
  };

  function escAttr(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* 尽早鉴权：未登录立即隐藏页面并跳转登录页，减少受保护内容闪现。
     nav.js 在 <body> 末尾同步执行，此处比 DOMContentLoaded 更早触发。 */
  var AUTHED = AUTH.isLoggedIn();
  if (!AUTHED) {
    document.documentElement.style.visibility = "hidden";
    location.replace("login.html");
  }

  /* ---------- Build top bar ---------- */
  function buildTopbar(activeId) {
    const navHtml = NAV.map(n =>
      `<a href="${n.href}" class="${n.id === activeId ? "is-active" : ""}">${n.label}</a>`
    ).join("");

    const mobileHtml = NAV.map(n =>
      `<a href="${n.href}" class="${n.id === activeId ? "is-active" : ""}">${n.label}<small>${n.desc}</small></a>`
    ).join("");

    // 登录态：右上角显示昵称 + 退出（桌面），移动端抽屉末尾追加退出项
    const user = AUTH.current();
    const who = AUTH.displayName();
    const desktopAuth = user
      ? `<span class="auth-chip" title="已登录：${escAttr(user.user)}">${escAttr(who)}</span>`
        + `<button class="auth-logout" id="logoutBtn" type="button" aria-label="退出登录">退出</button>`
      : "";
    const mobileAuth = user
      ? `<a href="#" id="logoutBtnM" class="nav-logout"><span>${escAttr(who)} · 退出登录</span><small>只在小窝内退出，不影响求婚页</small></a>`
      : "";

    return `
    <header class="topbar">
      <div class="topbar__inner">
        <a class="brand" href="index.html" aria-label="返回首页">
          <span class="brand__mark">${BRAND.mark}</span>
          <span class="brand__name">${BRAND.name}<small>${BRAND.sub}</small></span>
        </a>
        <nav class="topnav" aria-label="主导航">${navHtml}</nav>
        <div class="topbar__auth">${desktopAuth}</div>
        <button class="nav-toggle" id="navToggle" aria-label="展开导航" aria-expanded="false">☰</button>
      </div>
    </header>
    <div class="mobile-nav" id="mobileNav" aria-hidden="true">${mobileHtml}${mobileAuth}</div>`;
  }

  /* ---------- Build footer ---------- */
  function buildFooter() {
    const year = new Date().getFullYear();
    const links = NAV.map(n => `<a href="${n.href}">${n.label}</a>`).join("");
    return `
    <footer class="footer">
      <p class="footer__names">师豪 <span class="heart">❤</span> 佳力</p>
      <div class="footer__links">${links}</div>
      <p class="footer__note">爱的小窝 · 长期主义的人生合伙仪表盘 · ${year}<br/>
      以爱为基，慢慢来 — 愿这份经营，比婚礼更长久。</p>
    </footer>`;
  }

  /* ---------- Inject topbar + footer into the page ---------- */
  function inject(activeId) {
    // topbar: insert as first child of body
    const topbarHolder = document.createElement("div");
    topbarHolder.innerHTML = buildTopbar(activeId);
    document.body.insertBefore(topbarHolder.firstElementChild, document.body.firstChild);
    // mobile nav right after topbar
    const mobHolder = document.createElement("div");
    mobHolder.innerHTML = buildTopbar(activeId); // reuse to get mobileNav only
    const mobileNav = mobHolder.querySelector(".mobile-nav");
    if (mobileNav) document.body.insertBefore(mobileNav, document.body.children[1]);

    // footer: append to body
    const footHolder = document.createElement("div");
    footHolder.innerHTML = buildFooter();
    document.body.appendChild(footHolder.firstElementChild);

    wireNav();
  }

  /* ---------- Wire mobile nav toggle ---------- */
  function wireNav() {
    const toggle = document.getElementById("navToggle");
    const drawer = document.getElementById("mobileNav");
    if (!toggle || !drawer) return;
    toggle.addEventListener("click", () => {
      const open = drawer.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      drawer.setAttribute("aria-hidden", open ? "false" : "true");
      toggle.textContent = open ? "✕" : "☰";
    });
    drawer.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => {
        drawer.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰";
      })
    );

    // 退出登录（桌面 + 移动抽屉共用逻辑）
    const doLogout = (e) => {
      e.preventDefault();
      AUTH.logout();
      location.replace("login.html");
    };
    const deskBtn = document.getElementById("logoutBtn");
    const mobBtn = document.getElementById("logoutBtnM");
    if (deskBtn) deskBtn.addEventListener("click", doLogout);
    if (mobBtn) {
      mobBtn.addEventListener("click", (e) => {
        drawer.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰";
        doLogout(e);
      });
    }
  }

  /* ---------- Scroll reveal (IntersectionObserver) ---------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(e => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach(e => io.observe(e));
  }

  /* ---------- Modal (shared, for md content) ---------- */
  function buildModal() {
    const m = document.createElement("div");
    m.className = "modal";
    m.id = "sharedModal";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = `
      <div class="modal__overlay" data-close></div>
      <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="sharedModalTitle">
        <div class="modal__head">
          <h3 class="modal__title" id="sharedModalTitle">文档</h3>
          <button class="modal__close" data-close aria-label="关闭">✕</button>
        </div>
        <div class="modal__body" id="sharedModalBody"></div>
      </div>`;
    document.body.appendChild(m);
    m.querySelectorAll("[data-close]").forEach(el =>
      el.addEventListener("click", () => closeModal())
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }
  function openModal(title, html) {
    const m = document.getElementById("sharedModal");
    if (!m) return;
    document.getElementById("sharedModalTitle").textContent = title || "文档";
    document.getElementById("sharedModalBody").innerHTML = html || "";
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    m.querySelector(".modal__panel").scrollTop = 0;
  }
  function closeModal() {
    const m = document.getElementById("sharedModal");
    if (!m) return;
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /* ---------- Public APP namespace ---------- */
  window.LoveNest = {
    NAV,
    inject,
    initReveal,
    openModal,
    closeModal,
    auth: AUTH,
    /* localStorage helpers */
    store: {
      get(key, fallback) {
        try {
          const v = localStorage.getItem("lovenest:" + key);
          return v ? JSON.parse(v) : fallback;
        } catch (e) { return fallback; }
      },
      set(key, val) {
        try { localStorage.setItem("lovenest:" + key, JSON.stringify(val)); }
        catch (e) {}
      },
      remove(key) {
        try { localStorage.removeItem("lovenest:" + key); } catch (e) {}
      }
    },
    /* fetch JSON helper with graceful fallback */
    async getJSON(path, fallback) {
      try {
        const res = await fetch(path, { cache: "no-cache" });
        if (!res.ok) return fallback;
        return await res.json();
      } catch (e) {
        return fallback;
      }
    },
    /* date helpers */
    daysSince(dateStr) {
      const start = new Date(dateStr + "T00:00:00");
      const now = new Date();
      const ms = now - start;
      return Math.max(0, Math.floor(ms / 86400000));
    },
    /* day-of-year index for stable daily rotation */
    dayIndex() {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      return Math.floor((now - start) / 86400000);
    },
    todayISO() {
      const d = new Date();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${m}-${day}`;
    }
  };

  /* ---------- Auto-init on DOMContentLoaded ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    // 未登录：跳转已发起，停止渲染
    if (!AUTHED) return;
    const pageId = document.body.getAttribute("data-page") || "dashboard";
    inject(pageId);
    buildModal();
    initReveal();
  });
})();
