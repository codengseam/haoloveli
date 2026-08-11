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
    { id: "food",       href: "food.html",         label: "美食偏好",     desc: "记录 ta 爱吃的每一样" },
    { id: "milestones", href: "milestones.html",   label: "人生里程碑",   desc: "阶段规划与婚礼筹备" },
    { id: "travel",     href: "travel.html",       label: "旅行相册",     desc: "已走过的风景 · 想去的远方" },
    { id: "family",     href: "family.html",       label: "家庭关系网",   desc: "父母档案与节日走动" },
    { id: "peace",      href: "peace.html",         label: "停战协议",     desc: "冲突解决机制与安全词" }
  ];

  const ADMIN_NAV = { id: "admin", href: "admin.html", label: "🛡 后台", desc: "站点管理面板 · 配置与账号" };

  const BRAND = { mark: "❀", name: "爱的小窝", sub: "豪 ❤ 力 · Our Life OS" };

  /* ---------- DEFAULT_ACCOUNTS 静态账号定义 ----------
     本地静态兜底账号，云端 site_accounts 表未配置或拉取失败时使用。
     admin 账号永远保留作为兜底，防止云端配置错误导致后台锁死。
  -------------------------------------------------------------------- */
  const DEFAULT_ACCOUNTS = [
    { username: "djl",   password: "19990108", display_name: "佳力",   role: "user"  },
    { username: "dxsh",  password: "19980720", display_name: "师豪",   role: "user"  },
    { username: "admin", password: "admin",    display_name: "后台管理员", role: "admin" }
  ];

  /* ---------- Auth (pure frontend gate · localStorage + 云端合并) ----------
     登录态写入 localStorage，各 lovenest 页面在 nav.js 自动初始化时校验。
     支持从 Supabase site_accounts 表拉取账号并合并覆盖本地（admin 永远兜底）。
  ---------------------------------------------------------------- */
  const AUTH = (function buildAuth() {
    // 从 DEFAULT_ACCOUNTS 派生基础字典
    let accounts = {};
    let names = {};
    let roles = {};
    DEFAULT_ACCOUNTS.forEach(a => {
      accounts[a.username] = a.password;
      names[a.username] = a.display_name;
      roles[a.username] = a.role;
    });

    let _cloudLoaded = false;
    let _loadingPromise = null;
    const key = "auth";

    function _read() {
      try { return JSON.parse(localStorage.getItem("lovenest:" + key) || "null"); }
      catch (e) { return null; }
    }
    function _write(session) {
      try { localStorage.setItem("lovenest:" + key, JSON.stringify(session)); }
      catch (e) {}
    }
    function isLoggedIn() {
      const a = _read();
      if (!a || !a.user) return false;
      // 用户名大小写不敏感匹配
      const u = String(a.user).toLowerCase();
      return Object.keys(accounts).some(k => k.toLowerCase() === u);
    }
    function current() { return _read(); }
    function displayName() {
      const a = _read();
      if (!a || !a.user) return "";
      const u = String(a.user).toLowerCase();
      const matchKey = Object.keys(accounts).find(k => k.toLowerCase() === u);
      if (matchKey) return names[matchKey] || a.user;
      return a.user;
    }
    function role() {
      const a = _read();
      if (!a || !a.user) return "";
      const u = String(a.user).toLowerCase();
      const matchKey = Object.keys(accounts).find(k => k.toLowerCase() === u);
      if (matchKey) return roles[matchKey] || "user";
      // 登录态里的 role 字段作为次选（可能旧版 localStorage 里写的）
      return a.role || "user";
    }
    function isAdmin() {
      return role() === "admin";
    }
    function login(user, pwd) {
      if (!user || !pwd) return false;
      const u = String(user).toLowerCase();
      const matchKey = Object.keys(accounts).find(k => k.toLowerCase() === u);
      if (matchKey && accounts[matchKey] === pwd) {
        const session = {
          user: matchKey,                  // 统一存 canonical 用户名
          role: roles[matchKey] || "user", // 登录时写入 role 字段
          ts: Date.now()
        };
        _write(session);
        return true;
      }
      return false;
    }
    function logout() {
      localStorage.removeItem("lovenest:" + key);
    }
    function requireAuth() {
      if (!isLoggedIn()) {
        location.replace("login.html");
        return false;
      }
      return true;
    }
    function requireAdmin() {
      if (!requireAuth()) return false;
      if (!isAdmin()) {
        // 非管理员：跳登录页并带提示标记
        location.replace("login.html?needAdmin=1");
        return false;
      }
      return true;
    }
    async function refreshFromCloud() {
      // 防重复请求：如果已经在加载，直接返回同一个 Promise
      if (_loadingPromise) return _loadingPromise;
      _loadingPromise = (async () => {
        try {
          const db = window.LoveNest && window.LoveNest.db;
          if (!db || !db.enabled) { _cloudLoaded = true; return; }
          // 从 Supabase site_accounts 拉账号
          const rows = await db.list("site_accounts");
          if (!Array.isArray(rows) || !rows.length) { _cloudLoaded = true; return; }

          // 先保存本地 admin 作为兜底
          const adminBackup = DEFAULT_ACCOUNTS.find(a => a.role === "admin");

          // 先用云端数据覆盖重建字典
          const newAccounts = {};
          const newNames = {};
          const newRoles = {};
          rows.forEach(r => {
            if (!r || !r.username) return;
            if (r.is_active === false) return; // 跳过已停用账号
            const u = String(r.username);
            newAccounts[u] = r.password;
            newNames[u] = r.display_name || u;
            newRoles[u] = r.role || "user";
          });

          // admin 账号永远保留兜底（防止云端误删/误改导致后台锁死）
          if (adminBackup && !newAccounts[adminBackup.username]) {
            newAccounts[adminBackup.username] = adminBackup.password;
            newNames[adminBackup.username] = adminBackup.display_name;
            newRoles[adminBackup.username] = adminBackup.role;
          }

          // 原子切换
          accounts = newAccounts;
          names = newNames;
          roles = newRoles;
          _cloudLoaded = true;
        } catch (e) {
          console.warn("[LoveNest Auth] refreshFromCloud 失败，保持本地静态账号:", e.message || e);
          _cloudLoaded = true;
        } finally {
          _loadingPromise = null;
        }
      })();
      return _loadingPromise;
    }

    return {
      // 只读访问器（不暴露内部对象引用，避免被外部篡改）
      get accounts() { return Object.assign({}, accounts); },
      get names() { return Object.assign({}, names); },
      get roles() { return Object.assign({}, roles); },
      get key() { return key; },
      get cloudLoaded() { return _cloudLoaded; },
      _read, _write,
      isLoggedIn, current, displayName, role,
      isAdmin, login, logout, requireAuth, requireAdmin,
      refreshFromCloud
    };
  })();

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
  // 后台页：额外校验 admin 角色
  (function earlyAdminCheck() {
    const page = document.body.getAttribute("data-page");
    if (page === "admin" && AUTHED && !AUTH.isAdmin()) {
      document.documentElement.style.visibility = "hidden";
      location.replace("login.html?needAdmin=1");
    }
  })();

  /* ---------- Build top bar ---------- */
  function buildTopbar(activeId) {
    // 根据角色追加管理员入口
    const isAdm = AUTH.isAdmin();
    const fullNav = isAdm ? NAV.concat([ADMIN_NAV]) : NAV.slice();

    const navHtml = fullNav.map(n => {
      const extraCls = n.id === "admin" ? " is-admin-entry" : "";
      return `<a href="${n.href}" class="${(n.id === activeId ? "is-active" : "") + extraCls}">${n.label}</a>`;
    }).join("");

    const mobileHtml = fullNav.map(n => {
      const extraCls = n.id === "admin" ? " is-admin-entry" : "";
      return `<a href="${n.href}" class="${(n.id === activeId ? "is-active" : "") + extraCls}">${n.label}<small>${n.desc}</small></a>`;
    }).join("");

    // 登录态：右上角显示昵称 + 退出（桌面），移动端抽屉末尾追加退出项
    const user = AUTH.current();
    const who = AUTH.displayName();
    const isAdmChip = AUTH.isAdmin();
    const desktopAuth = user
      ? `<span class="auth-chip ${isAdmChip ? "auth-chip--admin" : ""}" title="已登录：${escAttr(user.user)}${isAdmChip ? "（管理员）" : ""}">${escAttr(who)}${isAdmChip ? " 🛡" : ""}</span>`
        + `<button class="auth-logout" id="logoutBtn" type="button" aria-label="退出登录">退出</button>`
      : "";
    const mobileAuth = user
      ? `<a href="#" id="logoutBtnM" class="nav-logout"><span>${escAttr(who)}${isAdmChip ? "（管理员）" : ""} · 退出登录</span><small>只在小窝内退出，不影响求婚页</small></a>`
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
    const isAdm = AUTH.isAdmin();
    const fullNav = isAdm ? NAV.concat([ADMIN_NAV]) : NAV.slice();
    const links = fullNav.map(n => {
      const extraCls = n.id === "admin" ? " is-admin-entry" : "";
      return `<a href="${n.href}" class="${extraCls}" style="${n.id === "admin" ? "background:linear-gradient(135deg,var(--taupe-soft),var(--taupe));color:#fff;padding:4px 12px;border-radius:var(--r-pill);font-size:.8rem" : ""}">${n.label}</a>`;
    }).join("");
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
  // ⚠️ 重要：不要直接覆盖 window.LoveNest，否则会丢失 db.js 等前置脚本挂载的属性（如 .db）
  window.LoveNest = window.LoveNest || {};
  const LN = window.LoveNest;

  // 逐个属性挂载，已存在的不强行覆盖（避免破坏前置脚本挂载的内容）
  if (LN.NAV === undefined) LN.NAV = NAV;
  if (LN.ADMIN_NAV === undefined) LN.ADMIN_NAV = ADMIN_NAV;
  if (LN.inject === undefined) LN.inject = inject;
  if (LN.initReveal === undefined) LN.initReveal = initReveal;
  if (LN.openModal === undefined) LN.openModal = openModal;
  if (LN.closeModal === undefined) LN.closeModal = closeModal;
  if (LN.auth === undefined) LN.auth = AUTH;

  // localStorage helpers
  if (LN.store === undefined) {
    LN.store = {
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
    };
  }

  // fetch JSON helper with graceful fallback
  if (LN.getJSON === undefined) {
    LN.getJSON = async function getJSON(path, fallback) {
      try {
        const res = await fetch(path, { cache: "no-cache" });
        if (!res.ok) return fallback;
        return await res.json();
      } catch (e) {
        return fallback;
      }
    };
  }

  // date helpers
  if (LN.daysSince === undefined) {
    LN.daysSince = function daysSince(dateStr) {
      const start = new Date(dateStr + "T00:00:00");
      const now = new Date();
      const ms = now - start;
      return Math.max(0, Math.floor(ms / 86400000));
    };
  }
  if (LN.dayIndex === undefined) {
    LN.dayIndex = function dayIndex() {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      return Math.floor((now - start) / 86400000);
    };
  }
  if (LN.todayISO === undefined) {
    LN.todayISO = function todayISO() {
      const d = new Date();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${m}-${day}`;
    };
  }

  /* ---------- Auto-init on DOMContentLoaded ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    // 未登录：跳转已发起，停止渲染
    if (!AUTHED) return;
    // 后台页 admin 校验（data-page="admin"）
    const pageId = document.body.getAttribute("data-page") || "dashboard";
    if (pageId === "admin" && !AUTH.isAdmin()) return;

    // 尝试从云端刷新账号表（不阻塞渲染，失败静默保持本地静态账号）
    AUTH.refreshFromCloud().catch(() => {});

    inject(pageId);
    buildModal();
    initReveal();
  });
})();
