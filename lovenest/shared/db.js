/* =========================================================================
   爱的小窝 · 统一数据访问层 LoveNest.db
   =========================================================================
   三层读写策略：
     Layer 1. localStorage 缓存层（0ms 立刻返回，离线也能用，无网络阻塞）
     Layer 2. Supabase 云同步层（异步 upsert/select，updated_at 做冲突合并：谁新取谁）
     Layer 3. 离线重试队列（写 Supabase 失败暂存 localStorage，定时/启动时指数退避重试）

   对外 API（Promise 风格，调用方式与 Supabase JS SDK 高度相似，未来换 BaaS 只要改本文件）：
     LoveNest.db.init()                         → Promise<void>, 页面启动时调一次
     LoveNest.db.list(table, filters, options)  → Promise<rows>
     LoveNest.db.insert(table, row)             → Promise<row>
     LoveNest.db.upsert(table, row, onConflict) → Promise<row>  (onConflict 可选：unique key 字段名数组)
     LoveNest.db.update(table, match, patch)    → Promise<void> (match 是 where 条件 {field: val})
     LoveNest.db.remove(table, match)           → Promise<void>
     LoveNest.db.watch(table, onChange)         → unsubscribe fn  (轮询式 watch，无实时订阅也能工作)
     LoveNest.db.enabled                        → true/false, 是否正确配置了 Supabase URL/key
     LoveNest.db.ready                          → Promise<void>, 等一次全量冷数据从云端合并完成
   ========================================================================= */
(function () {
  "use strict";
  if (!window.LoveNest) window.LoveNest = {};
  const CFG = window.LOVENEST_SUPABASE_CONFIG || {};
  const CACHE_PREFIX = "lovenest:db:cache:";
  const QUEUE_KEY = "lovenest:db:queue";
  const LS_PREFIX = "lovenest:";

  /* ---------- 工具 ---------- */
  function nowISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) +
      "T" + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + "Z";
  }
  function uuid() {
    // 不需要严格 rfc4122，只要足够唯一做 row id
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function cacheRead(table) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + table);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function cacheWrite(table, rows) {
    try { localStorage.setItem(CACHE_PREFIX + table, JSON.stringify(rows)); } catch (e) {}
  }
  function queueRead() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function queueWrite(arr) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  // 兼容旧版 localStorage 里的 legacy key（lovenest:bank-records 这些），一次性搬过来
  function migrateLegacyToCache(table, legacyKey, xform) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + legacyKey);
      if (raw == null) return;
      const cached = cacheRead(table);
      if (cached && cached.length) return;  // 已经有了，别覆盖
      const data = JSON.parse(raw);
      const rows = Array.isArray(data) ? data.map(xform || (r => r)) : [];
      if (rows.length) cacheWrite(table, rows);
    } catch (e) {}
  }

  /* ---------- 冲突合并：按 unique key 对两个 row[] 合并，updated_at 新的赢 ---------- */
  function mergeRowsByKey(localRows, remoteRows, keyField) {
    const map = new Map();
    (localRows || []).forEach(r => {
      const k = r[keyField];
      if (k != null) map.set(String(k), { ...r, __src: "local" });
    });
    (remoteRows || []).forEach(r => {
      const k = r[keyField];
      if (k == null) return;
      const sk = String(k);
      const existing = map.get(sk);
      if (!existing) {
        map.set(sk, { ...r, __src: "remote" });
      } else {
        // 都有，按 updated_at 比较
        const eu = existing.updated_at || 0;
        const ru = r.updated_at || 0;
        if (new Date(ru) > new Date(eu)) map.set(sk, { ...r, __src: "remote" });
      }
    });
    return Array.from(map.values()).map(({ __src, ...rest }) => rest);
  }

  /* ---------- Supabase 客户端懒初始化 ---------- */
  let supabase = null;
  let enabled = false;
  function detectEnabled() {
    const u = CFG.PROJECT_URL || "";
    const k = CFG.ANON_PUBLIC_KEY || "";
    return !(u.includes("YOUR-PROJECT") || u === "" || k.includes("YOUR-ANON") || k === "");
  }
  function ensureClient() {
    if (supabase) return supabase;
    if (!window.supabase) {
      // 用户没引入 CDN 或 CDN 加载失败
      return null;
    }
    try {
      enabled = detectEnabled();
      if (!enabled) return null;
      supabase = window.supabase.createClient(CFG.PROJECT_URL, CFG.ANON_PUBLIC_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },  // 不启用登录，省掉一堆存储
        global: { fetch: window.fetch.bind(window) },
      });
      return supabase;
    } catch (e) {
      console.warn("[LoveNest DB] Supabase client 初始化失败:", e);
      return null;
    }
  }

  /* ---------- 离线重试队列 ---------- */
  function enqueue(op) {
    // op: { ts, attempt, table, method, payload }
    const q = queueRead();
    q.push({ ts: Date.now(), attempt: 0, ...op });
    queueWrite(q);
  }
  async function flushQueueOnce() {
    const client = ensureClient();
    if (!client) return;
    const q = queueRead();
    if (!q.length) return;
    const next = [];
    for (const op of q) {
      try {
        await applyRemote(client, op);
      } catch (e) {
        op.attempt += 1;
        if (op.attempt < (CFG.MAX_RETRY || 3)) next.push(op);
        else console.warn("[LoveNest DB] 队列丢弃(超过重试):", op, e);
      }
    }
    queueWrite(next);
  }
  async function applyRemote(client, op) {
    const { table, method, payload } = op;
    const withCouple = (row) => ({ ...row, couple_id: CFG.COUPLE_ID });
    switch (method) {
      case "insert": {
        const { data, error } = await client.from(table).insert(withCouple(payload.row)).select().limit(1).maybeSingle();
        if (error) throw error;
        return data;
      }
      case "upsert": {
        const opts = payload.onConflict ? { onConflict: payload.onConflict.join(",") } : {};
        const { data, error } = await client.from(table).upsert(withCouple(payload.row), opts).select().limit(1).maybeSingle();
        if (error) throw error;
        return data;
      }
      case "update": {
        const b = client.from(table).update({ ...payload.patch, updated_at: nowISO() });
        let q = b;
        Object.entries(payload.match || {}).forEach(([k, v]) => { q = q.eq(k, v); });
        q = q.eq("couple_id", CFG.COUPLE_ID);
        const { error } = await q;
        if (error) throw error;
        return;
      }
      case "remove": {
        let q = client.from(table).delete();
        Object.entries(payload.match || {}).forEach(([k, v]) => { q = q.eq(k, v); });
        q = q.eq("couple_id", CFG.COUPLE_ID);
        const { error } = await q;
        if (error) throw error;
        return;
      }
      default:
        throw new Error("unknown queue method: " + method);
    }
  }

  /* ---------- 从云端拉表全量，与本地缓存合并 ---------- */
  async function refreshTableFromRemote(table, keyField) {
    const client = ensureClient();
    const cached = cacheRead(table) || [];
    if (!client) return cached;
    try {
      const { data, error } = await client.from(table).select("*").eq("couple_id", CFG.COUPLE_ID);
      if (error) throw error;
      const merged = mergeRowsByKey(cached, data || [], keyField || "id");
      cacheWrite(table, merged);
      return merged;
    } catch (e) {
      console.warn("[LoveNest DB] refreshTableFromRemote 失败 " + table + ":", e.message || e);
      return cached;
    }
  }

  /* ---------- 对外 API ---------- */
  const COLD_TABLES = [
    // [表名, 主键字段名, 旧版 localStorage key 迁移(可选), 迁移 xform(可选)]
    ["bank_records", "id", "bank-records", (r) => ({ id: uuid(), date: r.date, type: r.type, who: r.who, event: r.event, weight: r.weight, source: r.source || "user", updated_at: nowISO() })],
    ["family_members", "id"],
    ["holiday_checks", "id"],
    ["milestone_items", "id"],
    ["lovemap_answers", "id"],
    ["lovemap_cards", "id"],
    ["lovemap_magic5h", "id"],
    ["peace_signatures", "side"],
    ["conflict_reviews", "id"],
    ["bank_weekly_checks", "id"],
    ["monthly_goals", "id"],
    ["wedding_decisions", "id"],
  ];

  let resolveReady = null;
  const readyPromise = new Promise(res => { resolveReady = res; });

  async function init() {
    // 1. 旧版 localStorage → 缓存迁移（只在缓存空的时候搬）
    COLD_TABLES.forEach(([t, k, legacyKey, xform]) => {
      if (legacyKey) migrateLegacyToCache(t, legacyKey, xform);
    });
    // 2. 尝试从 Supabase 全量拉一下
    const client = ensureClient();
    if (client) {
      console.log("[LoveNest DB] Supabase 已连接，启用云端同步。");
      try {
        await Promise.all(COLD_TABLES.map(([t, k]) => refreshTableFromRemote(t, k)));
        flushQueueOnce().catch(() => {});
      } catch (e) {
        console.warn("[LoveNest DB] 启动时冷数据拉取失败, 仅用本地缓存:", e);
      }
    } else {
      if (!detectEnabled()) {
        console.log(
          "%c[LoveNest DB] 未配置 Supabase（shared/config.js 保持占位），使用本地 localStorage 模式。\n配置步骤见 shared/config.js 文件头部注释。",
          "color:#A0607A;font-weight:bold"
        );
      } else {
        console.warn("[LoveNest DB] 配置了 URL/key，但 supabase-js CDN 未加载（检查是否引入了 https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2）");
      }
    }
    // 3. 定时器：离线队列 + 每 2 分钟增量合并
    setInterval(() => {
      flushQueueOnce().catch(() => {});
    }, CFG.QUEUE_FLUSH_INTERVAL_MS || 30000);
    setInterval(() => {
      if (!ensureClient()) return;
      // 只刷新变更较多的表，避免无意义请求
      ["bank_records", "milestone_items", "lovemap_answers", "conflict_reviews", "monthly_goals", "wedding_decisions"].forEach(t => {
        const keyDef = COLD_TABLES.find(x => x[0] === t);
        refreshTableFromRemote(t, keyDef ? keyDef[1] : "id").then(() => {
          // 通知 watch 订阅者
          emitWatch(t);
        }).catch(() => {});
      });
    }, CFG.REFRESH_INTERVAL_MS || 120000);

    resolveReady && resolveReady();
  }

  /* ---------- list: 先返回缓存；如果有客户端就在后台 refresh 并二次触发 watch ---------- */
  async function list(table, filters, options) {
    const keyDef = COLD_TABLES.find(x => x[0] === table);
    const cache = cacheRead(table);
    let rows = Array.isArray(cache) ? cache.slice() : [];
    const client = ensureClient();
    if (client && rows.length === 0) {
      // 缓存空 → 等云端一次
      rows = await refreshTableFromRemote(table, keyDef ? keyDef[1] : "id");
    } else if (client) {
      // 缓存有值 → 后台异步刷新
      refreshTableFromRemote(table, keyDef ? keyDef[1] : "id").then(() => emitWatch(table)).catch(() => {});
    }
    // filters: { field: val } 精确匹配
    if (filters && typeof filters === "object") {
      Object.entries(filters).forEach(([k, v]) => {
        if (v == null) return;
        rows = rows.filter(r => String(r[k]) === String(v));
      });
    }
    if (options && Array.isArray(options.order)) {
      rows.sort((a, b) => {
        for (const [field, dir] of options.order) {
          const av = a[field], bv = b[field];
          if (av === bv) continue;
          const cmp = av > bv ? 1 : -1;
          return dir === "desc" ? -cmp : cmp;
        }
        return 0;
      });
    }
    if (options && options.limit) rows = rows.slice(0, options.limit);
    return rows;
  }

  /* ---------- insert：先写缓存 → 立即 resolve，后台写云端(失败进队列) ---------- */
  async function insert(table, row) {
    if (!row || typeof row !== "object") throw new Error("insert row must be object");
    const keyDef = COLD_TABLES.find(x => x[0] === table);
    const kf = keyDef ? keyDef[1] : "id";
    // 填充默认字段
    const newRow = {
      couple_id: CFG.COUPLE_ID,
      created_at: nowISO(),
      updated_at: nowISO(),
      ...row,
    };
    if (!newRow[kf]) newRow[kf] = uuid();
    const cache = cacheRead(table) || [];
    cache.push(newRow);
    cacheWrite(table, cache);
    emitWatch(table);
    const client = ensureClient();
    if (client) {
      (async () => {
        try {
          const { data, error } = await client.from(table).insert(newRow).select().limit(1).maybeSingle();
          if (error) throw error;
          // 回写云端返回的字段（含 server 端 created_at/updated_at 等）
          if (data) {
            const c = cacheRead(table) || [];
            const idx = c.findIndex(x => String(x[kf]) === String(data[kf]));
            if (idx >= 0) c[idx] = data; else c.push(data);
            cacheWrite(table, c);
            emitWatch(table);
          }
        } catch (e) {
          console.warn("[LoveNest DB] insert 写入云端失败，已加入离线队列:", e.message || e);
          enqueue({ table, method: "insert", payload: { row: newRow } });
        }
      })();
    }
    return newRow;
  }

  /* ---------- upsert ---------- */
  async function upsert(table, row, onConflict) {
    if (!row || typeof row !== "object") throw new Error("upsert row must be object");
    const keyDef = COLD_TABLES.find(x => x[0] === table);
    const kf = keyDef ? keyDef[1] : "id";
    const keys = Array.isArray(onConflict) && onConflict.length ? onConflict : [kf];
    const patch = { ...row, updated_at: nowISO(), couple_id: CFG.COUPLE_ID };
    // 本地缓存按 key 合并
    let cache = cacheRead(table) || [];
    const idx = cache.findIndex(r => keys.every(k => r[k] != null && String(r[k]) === String(patch[k])));
    if (idx >= 0) cache[idx] = { ...cache[idx], ...patch };
    else cache.push({ [kf]: uuid(), created_at: nowISO(), ...patch });
    cacheWrite(table, cache);
    emitWatch(table);
    const client = ensureClient();
    if (client) {
      (async () => {
        try {
          const opts = { onConflict: keys.join(",") };
          const { data, error } = await client.from(table).upsert(cache[idx >= 0 ? idx : cache.length - 1], opts).select().limit(1).maybeSingle();
          if (error) throw error;
          if (data) {
            cache = cacheRead(table) || [];
            const i2 = cache.findIndex(x => String(x[kf]) === String(data[kf]));
            if (i2 >= 0) cache[i2] = data; else cache.push(data);
            cacheWrite(table, cache);
            emitWatch(table);
          }
        } catch (e) {
          console.warn("[LoveNest DB] upsert 写入云端失败，已加入离线队列:", e.message || e);
          enqueue({ table, method: "upsert", payload: { row: cache[idx >= 0 ? idx : cache.length - 1], onConflict: keys } });
        }
      })();
    }
    return cache[idx >= 0 ? idx : cache.length - 1];
  }

  /* ---------- update(match {field: val}, patch) ---------- */
  async function update(table, match, patch) {
    const keyDef = COLD_TABLES.find(x => x[0] === table);
    const kf = keyDef ? keyDef[1] : "id";
    const cache = cacheRead(table) || [];
    const ts = nowISO();
    let changed = false;
    const updated = cache.map(r => {
      const ok = Object.entries(match || {}).every(([k, v]) => String(r[k]) === String(v));
      if (!ok) return r;
      changed = true;
      return { ...r, ...patch, updated_at: ts };
    });
    if (!changed) return;
    cacheWrite(table, updated);
    emitWatch(table);
    const client = ensureClient();
    if (client) {
      (async () => {
        try {
          let q = client.from(table).update({ ...patch, updated_at: ts });
          Object.entries(match || {}).forEach(([k, v]) => { q = q.eq(k, v); });
          q = q.eq("couple_id", CFG.COUPLE_ID);
          const { error } = await q;
          if (error) throw error;
        } catch (e) {
          console.warn("[LoveNest DB] update 写入云端失败，已加入离线队列:", e.message || e);
          enqueue({ table, method: "update", payload: { match, patch } });
        }
      })();
    }
  }

  /* ---------- remove ---------- */
  async function remove(table, match) {
    const cache = cacheRead(table) || [];
    const next = cache.filter(r =>
      !Object.entries(match || {}).every(([k, v]) => String(r[k]) === String(v))
    );
    if (next.length === cache.length) return;
    cacheWrite(table, next);
    emitWatch(table);
    const client = ensureClient();
    if (client) {
      (async () => {
        try {
          let q = client.from(table).delete();
          Object.entries(match || {}).forEach(([k, v]) => { q = q.eq(k, v); });
          q = q.eq("couple_id", CFG.COUPLE_ID);
          const { error } = await q;
          if (error) throw error;
        } catch (e) {
          console.warn("[LoveNest DB] remove 云端失败，已加入离线队列:", e.message || e);
          enqueue({ table, method: "remove", payload: { match } });
        }
      })();
    }
  }

  /* ---------- watch（简单轮询式 + 写操作内触发 emit，够用）---------- */
  const watchers = new Map();  // table → Set<fn>
  function watch(table, onChange) {
    if (!watchers.has(table)) watchers.set(table, new Set());
    watchers.get(table).add(onChange);
    return () => { watchers.get(table)?.delete(onChange); };
  }
  function emitWatch(table) {
    const set = watchers.get(table);
    if (!set || !set.size) return;
    // 给它最新 rows
    list(table).then(rows => {
      set.forEach(fn => {
        try { fn(rows); } catch (e) { console.warn(e); }
      });
    });
  }

  /* ---------- 挂载到 LoveNest ---------- */
  Object.defineProperty(window.LoveNest, "db", {
    value: Object.freeze({
      init,
      list, insert, upsert, update, remove, watch,
      get enabled() { return detectEnabled() && !!ensureClient(); },
      get ready() { return readyPromise; },
      get coupleId() { return CFG.COUPLE_ID; },
      // 暴露给页面需要用 row id 时
      uuid, nowISO,
    }),
    configurable: false,
  });

  /* ---------- DOMContentLoaded 后自动 init（如果页面没有手动先调）---------- */
  let inited = false;
  function autoInit() {
    if (inited) return;
    inited = true;
    init();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();
