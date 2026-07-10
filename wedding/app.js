/* =========================================================
   婚拍决策手记 · 交互逻辑
   ========================================================= */
(function(){
  "use strict";
  var STORE = "weddingplan:v1";

  /* ---------- 状态读写 ---------- */
  function load(){
    try{ return JSON.parse(localStorage.getItem(STORE)) || {}; }
    catch(e){ return {}; }
  }
  function save(state){
    try{ localStorage.setItem(STORE, JSON.stringify(state)); }catch(e){}
  }
  var state = load();

  /* ---------- 避坑清单数据 ---------- */
  var PITFALLS = [
    { group:"合同与资质", items:[
      "索要最新营业执照，确认当前签约主体（非已注销的旧个体户）",
      "索要丽江文旅局场地备案证明 / 景区拍摄许可",
      "合同写明私域场地备案编号，避免公共区域被清场",
      "雨季应急方案写入「免费置换同级室内场地」（非口头承诺）",
      "退定规则写明（建议定金 ≤20–30%，约定无责退定期限）"
    ]},
    { group:"价格透明", items:[
      "套餐逐条列明：航拍超时费、花艺重建费、礼服分区费、精修单价",
      "确认「底片全送」并写明张数 / 格式",
      "门票、车费、住宿升级是否包含",
      "指定化妆师 / 摄影师是否加价",
      "加选精修单价（行业 30–150 元/张）"
    ]},
    { group:"立式照专项", items:[
      "写明尺寸（180cm 大幅 vs 60cm 小幅）与材质",
      "写明「婚宴前 ≥15 天单独交付」（不等全部精修完成）",
      "加急是否免费（常规加急约 500–800 元）",
      "色差 / 重做条款"
    ]},
    { group:"客片与档期", items:[
      "索要近 3 个月真实客片原图（非模特样片）",
      "要求提供同季节、同场地的真实客户案例",
      "黄金期（3–5、9–11 月）提前 3–6 个月约档",
      "查黑猫 / 小红书 / 携程投诉与口碑"
    ]}
  ];

  /* ---------- 文档索引 ---------- */
  var DOCS = [
    { file:"00-first-principles.md", no:"00", title:"第一性原理拆解", desc:"6 条硬约束 · 倒推可行解空间 · 两人底层诉求" },
    { file:"01-shangyuehai-qingmubai.md", no:"01", title:"丽江双雄：叁月海 vs 青慕白", desc:"工商主体 · 投诉 · 资质风险 · 验证清单" },
    { file:"02-jinfulen-shanyushu.md", no:"02", title:"重庆本地：金夫人 vs 山屿树", desc:"关系澄清 · 山屿树名称待核实 · 本地备选" },
    { file:"03-climate-timing.md", no:"03", title:"丽江气候与时间窗", desc:"逐月气候 · 教师假期 · 四套方案推演" },
    { file:"04-chuanxi-xinjiang.md", no:"04", title:"川西 vs 新疆赛里木湖", desc:"三地横向对比 · 是否值得重新评估" },
    { file:"05-decision-framework.md", no:"05", title:"决策框架（三旋钮）", desc:"总开关 · 目的地 · 风险偏好 · 分步引导" },
    { file:"06-pitfall-checklist.md", no:"06", title:"避坑清单与立式照条款", desc:"隐形消费 · 合同必查 · 签约动作清单" }
  ];

  /* ---------- 渲染避坑清单 ---------- */
  function renderPitfalls(){
    var wrap = document.getElementById("pitfallGroups");
    if(!wrap) return;
    state.checklist = state.checklist || {};
    var html = "";
    PITFALLS.forEach(function(g, gi){
      html += '<div class="pitgroup"><h4>' + g.group + '</h4>';
      g.items.forEach(function(it, ii){
        var key = gi + "-" + ii;
        var checked = state.checklist[key] ? "checked" : "";
        var done = state.checklist[key] ? "done" : "";
        html += '<label class="' + done + '"><input type="checkbox" data-pit="' + key + '" ' + checked + '><span>' + it + '</span></label>';
      });
      html += '</div>';
    });
    wrap.innerHTML = html;
    updatePitfallProgress();
    wrap.querySelectorAll('input[data-pit]').forEach(function(el){
      el.addEventListener("change", function(){
        var k = el.getAttribute("data-pit");
        state.checklist[k] = el.checked;
        var lbl = el.closest("label");
        if(lbl) lbl.classList.toggle("done", el.checked);
        save(state);
        updatePitfallProgress();
        flashSave();
      });
    });
  }
  function updatePitfallProgress(){
    var total = 0, done = 0;
    PITFALLS.forEach(function(g){ total += g.items.length; });
    state.checklist = state.checklist || {};
    Object.keys(state.checklist).forEach(function(k){ if(state.checklist[k]) done++; });
    var cnt = document.getElementById("pitfallCount");
    var bar = document.getElementById("pitfallBar");
    if(cnt) cnt.textContent = "已勾选 " + done + " / " + total;
    if(bar) bar.style.width = (total ? (done/total*100) : 0) + "%";
  }

  /* ---------- 渲染文档索引 ---------- */
  function renderDocGrid(){
    var grid = document.getElementById("docGrid");
    if(!grid) return;
    grid.innerHTML = DOCS.map(function(d){
      return '<button class="doccard" data-doc="' + d.file + '">' +
        '<span class="doccard__no">' + d.no + '</span>' +
        '<h4 class="doccard__title">' + d.title + '</h4>' +
        '<p class="doccard__desc">' + d.desc + '</p>' +
        '</button>';
    }).join("");
  }

  /* ---------- md 弹窗 ---------- */
  var modal = document.getElementById("docModal");
  var modalTitle = document.getElementById("docModalTitle");
  var modalBody = document.getElementById("docModalBody");
  var modalOpen = document.getElementById("docModalOpen");
  var lastFocus = null;

  function findDoc(file){
    var exact = DOCS.find(function(d){ return d.file === file; });
    if(exact) return exact;
    // 兼容内联按钮 data-doc 不带 .md 后缀的写法
    var withMd = /\.md$/i.test(file) ? file : file + ".md";
    return DOCS.find(function(d){ return d.file === withMd; });
  }

  function openDoc(file){
    var d = findDoc(file);
    if(!d) return;
    file = d.file; // 统一用 DOCS 中带 .md 的真实文件名，保证 fetch 路径正确
    lastFocus = document.activeElement;
    modalTitle.textContent = d.no + " · " + d.title;
    modalOpen.setAttribute("href", "docs/" + file);
    modalBody.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px">加载中…</p>';
    modal.hidden = false;
    modal.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
    modal.querySelector(".doc-modal__close").focus();

    fetch("docs/" + file)
      .then(function(r){
        if(!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function(txt){
        if(window.marked){
          modalBody.innerHTML = marked.parse(txt);
        }else{
          modalBody.innerHTML = "<pre>" + escapeHtml(txt) + "</pre>";
        }
      })
      .catch(function(){
        modalBody.innerHTML =
          '<div class="doc-modal__fallback">' +
          '<p>无法直接读取文档。</p>' +
          '<p>请在本目录运行 <code>python3 -m http.server 8000</code>，</p>' +
          '<p>再访问 <code>http://localhost:8000</code>；</p>' +
          '<p>或 <a href="docs/' + file + '" target="_blank">点此直接打开 md 文件</a>。</p>' +
          '</div>';
      });
  }
  function closeDoc(){
    modal.hidden = true;
    modal.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function escapeHtml(s){ return s.replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }

  document.addEventListener("click", function(e){
    var t = e.target.closest("[data-doc]");
    if(t){
      e.preventDefault();
      openDoc(t.getAttribute("data-doc"));
      return;
    }
    if(e.target.closest("[data-close]")) closeDoc();
  });
  function modalFocusables(){
    return Array.prototype.slice.call(
      modal.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')
    ).filter(function(el){ return el.offsetParent !== null; });
  }
  document.addEventListener("keydown", function(e){
    if(modal.hidden) return;
    if(e.key === "Escape"){ closeDoc(); return; }
    if(e.key === "Tab"){
      // 焦点陷阱：Tab 不跑出弹窗
      var f = modalFocusables();
      if(!f.length){ e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- 决策旋钮 ---------- */
  var verdictEmpty = document.getElementById("verdictEmpty");
  var verdictResult = document.getElementById("verdictResult");

  function computeVerdict(){
    var k1 = state.k1, k2 = state.k2, k3 = state.k3;
    if(!k1 || !k2 || !k3){
      verdictEmpty.hidden = false;
      verdictResult.hidden = true;
      clearRecommended();
      return;
    }
    verdictEmpty.hidden = true;
    verdictResult.hidden = false;

    var scheme, schemeTag, reason, studio;
    if(k1 === "moveBefore"){
      scheme = "A"; schemeTag = "方案 A · 婚期前挪";
      reason = "把婚期前挪到 2026 年底，用 2026 国庆秋窗拍摄，天气最稳、留足缓冲，是最优时间相容解。";
    }else if(k1 === "moveAfter"){
      scheme = "C"; schemeTag = "方案 C · 婚期后挪";
      reason = "把婚期后挪到 2027 年底，用 2027 国庆秋窗拍摄，天气稳、与教师假期匹配。";
    }else{ // locked
      if(k2 === "local"){
        scheme = "D"; schemeTag = "方案 D · 重庆本地拍";
        reason = "婚期锁死且选本地，无天气与差旅风险，立式照交付链路最短，是风险最低的解。";
      }else if(k2 === "lijiang"){
        scheme = "B"; schemeTag = "方案 B · 坚持原婚期 + 丽江";
        reason = "只能 2027 五一拍丽江，5 月晴好率约 57% 偏边缘，必须锁死「立式照婚宴前单独交付」加急条款，并备好雨天应急。";
      }else{ // chuanxi
        scheme = "B′"; schemeTag = "方案 B′ · 坚持原婚期 + 川西";
        reason = "2027 年 6 月下旬川西高山杜鹃盛花，白天不冷且避开 7–8 月雨季；但需先确认佳力 6 月能否请假，并评估高反。";
      }
    }

    // 机构倾向
    if(k2 === "lijiang"){
      studio = (k3 === "value") ? "倾向叁月海（一价全包）或金夫人丽江直营店；务必先核实叁月海资质主体。"
            : (k3 === "quality") ? "倾向青慕白（文艺质感），但须当面确认签约主体、退定规则、化妆师是否全程跟妆。"
            : "丽江差异化大片可考虑，但川西更合适；若坚持丽江，选有私域场地的总监级团队。";
    }else if(k2 === "local"){
      studio = (k3 === "value") ? "倾向三毛摄影（自有麓颂庄园、全包无隐形、终身质保）；山屿树须先核实确切主体。"
            : (k3 === "quality") ? "倾向金夫人（37 年连锁、丽江直营、标准化流程），选总监级团队。"
            : "本地差异化可看三毛微电影套餐，或金佛山/四面山周边轻旅拍。";
    }else{ // chuanxi
      studio = "稻城亚丁 3 天 2 晚长线套餐（约 1.1 万起），6 月下旬高山杜鹃；确认机构提供高反应急（氧气、备用厅）。";
    }

    verdictResult.innerHTML =
      '<span class="v-tag">推荐</span>' +
      '<div class="v-scheme">' + schemeTag + '</div>' +
      '<p class="v-reason">' + reason + '</p>' +
      '<p class="v-reason" style="margin-top:12px"><strong>机构倾向：</strong>' + studio + '</p>' +
      '<p class="v-reason" style="margin-top:10px;color:var(--muted);font-size:.85rem">这只是基于三个旋钮的倾向，不是定论。请把它写进下方"我们的规划"再一起商量。</p>';

    highlightScheme(scheme);
  }
  function highlightScheme(scheme){
    clearRecommended();
    var map = {"A":0,"B":3,"C":2,"D":1}; // 顺序: A,D,C,B in HTML
    var cards = document.querySelectorAll("#timing .scheme");
    var idx = map[scheme];
    if(idx != null && cards[idx]) cards[idx].classList.add("is-recommended");
  }
  function clearRecommended(){
    document.querySelectorAll("#timing .scheme.is-recommended").forEach(function(el){ el.classList.remove("is-recommended"); });
  }

  function initKnobs(){
    state.knobs = state.knobs || {};
    ["k1","k2","k3"].forEach(function(name){
      document.querySelectorAll('input[name="' + name + '"]').forEach(function(el){
        if(state[name] === el.value) el.checked = true;
        el.addEventListener("change", function(){
          state[name] = el.value;
          save(state);
          computeVerdict();
          flashSave();
        });
      });
    });
    computeVerdict();
  }

  /* ---------- 规划笔记 ---------- */
  function initPlan(){
    state.plan = state.plan || {};
    document.querySelectorAll("[data-plan]").forEach(function(el){
      var key = el.getAttribute("data-plan");
      if(state.plan[key] != null) el.value = state.plan[key];
      var t;
      el.addEventListener("input", function(){
        state.plan[key] = el.value;
        save(state);
        flashSave();
      });
    });
  }

  /* ---------- 待办 ---------- */
  function renderTodos(){
    var ul = document.getElementById("todoItems");
    if(!ul) return;
    state.todos = state.todos || [];
    if(!state.todos.length){
      ul.innerHTML = '<li class="empty">还没有待办，添加一条吧～</li>';
      return;
    }
    ul.innerHTML = state.todos.map(function(t, i){
      return '<li class="' + (t.done ? "done" : "") + '">' +
        '<input type="checkbox" data-todo="' + i + '" ' + (t.done ? "checked" : "") + '>' +
        '<span class="t-text">' + escapeHtml(t.text) + '</span>' +
        '<button class="t-del" data-del="' + i + '" aria-label="删除">✕</button>' +
        '</li>';
    }).join("");
  }
  function initTodos(){
    renderTodos();
    var input = document.getElementById("todoInput");
    var addBtn = document.getElementById("todoAdd");
    function add(){
      var v = (input.value || "").trim();
      if(!v) return;
      state.todos = state.todos || [];
      state.todos.push({ text:v, done:false });
      input.value = "";
      save(state);
      renderTodos();
      flashSave();
    }
    if(addBtn) addBtn.addEventListener("click", add);
    if(input) input.addEventListener("keydown", function(e){ if(e.key === "Enter") add(); });

    var ul = document.getElementById("todoItems");
    if(ul){
      ul.addEventListener("click", function(e){
        var cb = e.target.closest("[data-todo]");
        var del = e.target.closest("[data-del]");
        if(cb){
          var i = +cb.getAttribute("data-todo");
          state.todos[i].done = cb.checked;
          cb.closest("li").classList.toggle("done", cb.checked);
          save(state);
        }else if(del){
          var j = +del.getAttribute("data-del");
          state.todos.splice(j, 1);
          save(state);
          renderTodos();
        }
      });
    }
  }

  /* ---------- 导出 / 清空 ---------- */
  function initExport(){
    var btn = document.getElementById("exportBtn");
    var clr = document.getElementById("clearBtn");
    if(btn) btn.addEventListener("click", exportPlan);
    if(clr) clr.addEventListener("click", function(){
      if(confirm("确定清空全部已保存内容？（避坑勾选、旋钮、规划笔记、待办都会被删除）")){
        localStorage.removeItem(STORE);
        state = {};
        renderPitfalls(); initKnobs(); initPlan(); renderTodos();
        location.reload();
      }
    });
  }
  function exportPlan(){
    state.plan = state.plan || {};
    state.knobs = state.knobs || {};
    state.todos = state.todos || [];
    var knobLabel = { k1:{moveBefore:"可前挪",moveAfter:"可后挪",locked:"锁死2027.7-8"},
      k2:{lijiang:"要丽江",local:"重庆本地",chuanxi:"川西"},
      k3:{value:"重性价比+怕坑",quality:"重质感+可承受风险",unique:"差异化大片+不怕车程"} };
    var L = {
      "1. 婚期是否可动": state.k1 ? knobLabel.k1[state.k1] : "（未选）",
      "2. 目的地": state.k2 ? knobLabel.k2[state.k2] : "（未选）",
      "3. 风险偏好": state.k3 ? knobLabel.k3[state.k3] : "（未选）"
    };
    var txt = "# 我们的婚拍规划\n\n师豪 ❤ 佳力\n生成于 " + new Date().toLocaleString("zh-CN") + "\n\n";
    txt += "## 三旋钮选择\n";
    txt += "- " + L["1. 婚期是否可动"] + "\n- " + L["2. 目的地"] + "\n- " + L["3. 风险偏好"] + "\n\n";
    txt += "## 先回答的 4 个问题\n";
    ["q1","q2","q3","q4"].forEach(function(k, i){
      txt += (i+1) + ". " + (state.plan[k] || "（空）") + "\n";
    });
    txt += "\n## 选定方案与机构\n";
    txt += "- 方案：" + (state.plan.scheme || "（空）") + "\n";
    txt += "- 机构：" + (state.plan.studio || "（空）") + "\n";
    txt += "- 预算：" + (state.plan.budget || "（空）") + "\n\n";
    txt += "## 待办清单\n";
    if(state.todos.length){
      state.todos.forEach(function(t){ txt += "- [" + (t.done ? "x" : " ") + "] " + t.text + "\n"; });
    }else{ txt += "（空）\n"; }
    var done = 0, total = 0;
    PITFALLS.forEach(function(g){ total += g.items.length; });
    Object.keys(state.checklist || {}).forEach(function(k){ if(state.checklist[k]) done++; });
    txt += "\n## 避坑清单进度：" + done + "/" + total + "\n\n";
    txt += "## 备忘\n" + (state.plan.memo || "（空）") + "\n";

    // 复制 + 下载
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){
        flash("已复制到剪贴板，并下载 .md 文件");
      }, function(){ flash("已下载 .md 文件"); });
    }else{ flash("已下载 .md 文件"); }
    var blob = new Blob([txt], {type:"text/markdown"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "我们的婚拍规划.md";
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- 保存提示 ---------- */
  var saveTimer;
  function flashSave(){
    var el = document.getElementById("saveStatus");
    if(!el) return;
    el.textContent = "已自动保存";
    el.classList.add("show");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function(){ el.classList.remove("show"); }, 1600);
  }
  var msgTimer;
  function flash(msg){
    var el = document.getElementById("saveStatus");
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function(){ el.classList.remove("show"); el.textContent="已自动保存"; }, 2600);
  }

  /* ---------- 滚动揭示 + 进度条 ---------- */
  function initReveal(){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold:0.12 });
    document.querySelectorAll(".reveal").forEach(function(el){ io.observe(el); });
  }
  function initProgress(){
    var bar = document.getElementById("progressBar");
    if(!bar) return;
    function onScroll(){
      var h = document.documentElement;
      var sc = h.scrollTop || document.body.scrollTop;
      var max = (h.scrollHeight - h.clientHeight) || 1;
      bar.style.width = (sc / max * 100) + "%";
    }
    window.addEventListener("scroll", onScroll, { passive:true });
    onScroll();
  }

  /* ---------- 移动端导航 ---------- */
  function initNav(){
    var toggle = document.getElementById("navToggle");
    var nav = document.querySelector(".topnav");
    if(!toggle || !nav) return;
    toggle.addEventListener("click", function(){
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function(e){
      if(e.target.tagName === "A") nav.classList.remove("open");
    });
  }

  /* ---------- 启动 ---------- */
  document.addEventListener("DOMContentLoaded", function(){
    renderPitfalls();
    renderDocGrid();
    initKnobs();
    initPlan();
    initTodos();
    initExport();
    initReveal();
    initProgress();
    initNav();
  });
})();
