const $ = (s) => document.querySelector(s);

const GROUP_ORDER = ["Agent", "Chat", "Code", "Image", "Video"];

const DESC = {
  text: "各 AI 模型在文字對文字任務上的整體排名，涵蓋數學、程式、創意寫作與其他開放式領域。",
  webdev: "各模型在實際網頁開發任務上的排名，由使用者比較兩個模型做出的成品後投票。",
  vision: "各模型在看圖理解任務上的排名，包含 OCR、圖表、看圖寫作等。",
  document: "各模型在文件理解與處理任務上的排名。",
  search: "具備網路搜尋能力的模型在查詢任務上的排名。",
  text_to_image: "文字生成圖片模型的排名。",
  image_edit: "圖片編輯模型的排名。",
  text_to_video: "文字生成影片模型的排名。",
  image_to_video: "圖片生成影片模型的排名。",
  video_edit: "影片編輯模型的排名。",
  agent: "Agent 模式下各模型完成多步驟任務的表現排名。",
};

const VARIANT_LABEL = {
  style_control: "Style Control",
  default: "None",
  factuality: "Factuality",
  steerability: "Steerability",
  task_outcome: "Task Outcome",
  tool_hallucination: "Tool Hallucination",
  praise_complaint: "Praise / Complaint",
  bash_recovery: "Bash Recovery Steps",
  bash_reliability: "Bash Reliability",
};

const CAT = {
  overall: ["🏆", "Overall"], expert: ["🤓", "Expert"], math: ["🧮", "Math"],
  instruction_following: ["📝", "Instruction Following"], multi_turn: ["💬", "Multi-Turn"],
  creative_writing: ["✍️", "Creative Writing"], coding: ["💻", "Coding"],
  hard_prompts: ["🌶️", "Hard Prompts"], hard_prompts_english: ["🧠", "Hard Prompts (English)"],
  longer_query: ["📜", "Longer Query"], exclude_ties: ["⚖️", "Exclude Ties"],
  english: ["🇺🇸", "English"], non_english: ["🌐", "Non-English"], chinese: ["🇨🇳", "Chinese"],
  japanese: ["🇯🇵", "Japanese"], korean: ["🇰🇷", "Korean"], french: ["🇫🇷", "French"],
  german: ["🇩🇪", "German"], spanish: ["🇪🇸", "Spanish"], russian: ["🇷🇺", "Russian"], polish: ["🇵🇱", "Polish"],
  industry_business_and_management_and_financial_operations: ["💼", "Business & Finance"],
  industry_entertainment_and_sports_and_media: ["🎬", "Entertainment & Media"],
  industry_legal_and_government: ["⚖️", "Legal & Government"],
  industry_life_and_physical_and_social_science: ["🔬", "Life, Physical & Social Science"],
  industry_mathematical: ["📐", "Mathematical"],
  industry_medicine_and_healthcare: ["🩺", "Medicine & Healthcare"],
  industry_software_and_it_services: ["🖥️", "Software & IT"],
  industry_writing_and_literature_and_language: ["📚", "Writing & Literature"],
  captioning: ["🏷️", "Captioning"], creative_writing_vision: ["🎨", "Creative Writing (Vision)"],
  diagram: ["📊", "Diagram"], entity_recognition: ["🔎", "Entity Recognition"], homework: ["📓", "Homework"],
  humor: ["😄", "Humor"], ocr: ["🔤", "OCR"],
  "3d_modeling": ["🧊", "3D Modeling"], art: ["🖼️", "Art"], cartoon: ["🐭", "Cartoon"],
  commercial_design: ["🛍️", "Commercial Design"], photorealistic: ["📷", "Photorealistic"],
  portraits: ["🧑", "Portraits"], text_rendering: ["🔠", "Text Rendering"],
  multi_image_edit: ["🧩", "Multi-Image Edit"],
  webdev: ["🌐", "WebDev"], "webdev-html": ["📄", "HTML"], "webdev-react": ["⚛️", "React"],
  image_to_webdev: ["🖼️", "Image to WebDev"],
};
const catInfo = (c) => CAT[c] || ["•", c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())];

const ORG_COLOR = {
  google: "#4285f4", anthropic: "#d97757", openai: "#10a37f", meta: "#0866ff", xai: "#111111",
  deepseek: "#4d6bfe", alibaba: "#615ced", qwen: "#615ced", mistral: "#fa520f", "mistral ai": "#fa520f",
  microsoft: "#00a4ef", amazon: "#ff9900", nvidia: "#76b900", cohere: "#39594d", "01 ai": "#1f6f43",
  zhipu: "#3859ff", "zhipu ai": "#3859ff", moonshot: "#16191e", minimax: "#e8384f", tencent: "#0052d9",
  bytedance: "#325ab4", baidu: "#2932e1", ibm: "#0f62fe", "black forest labs": "#222", ideogram: "#6b4cf6",
  midjourney: "#000", runway: "#000", luma: "#5b3df5", kling: "#00c18f", recraft: "#ff5c35",
};
function orgColor(org) {
  const k = (org || "").toLowerCase();
  if (ORG_COLOR[k]) return ORG_COLOR[k];
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 35% 45%)`;
}
const ORG_NAME = {
  openai: "OpenAI", xai: "xAI", deepseek: "DeepSeek", "01 ai": "01 AI", ibm: "IBM", nvidia: "NVIDIA",
  minimax: "MiniMax", bytedance: "ByteDance", "zhipu ai": "Zhipu AI", zhipu: "Zhipu", ai2: "AI2",
  lmsys: "LMSYS", nexusflow: "NexusFlow", "black forest labs": "Black Forest Labs", stepfun: "StepFun",
};
const titleCase = (s) => ORG_NAME[(s || "").toLowerCase()] || (s || "Unknown").replace(/\b\w/g, (m) => m.toUpperCase());

const state = {
  arena: "text", variant: null, date: "", category: "overall",
  lic: "all", q: "", view: "models", sort: null, showAllCats: false, filtersHidden: false,
};
let META = null;
let BOARD = null;
let reqSeq = 0;

const arenaById = (id) => META.arenas.find((a) => a.id === id);
const currentVariant = () => {
  const a = arenaById(state.arena);
  return a.variants.find((v) => v.id === state.variant) || a.variants[0];
};

// ---------- URL hash ----------
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get("arena") && arenaById(p.get("arena"))) state.arena = p.get("arena");
  state.variant = p.get("adj") || null;
  // The date is deliberately not kept in the URL: every visit or refresh starts at today's leaderboard.
  state.category = p.get("cat") || "overall";
}
function writeHash() {
  const p = new URLSearchParams();
  p.set("arena", state.arena);
  p.set("adj", currentVariant().id);
  p.set("cat", state.category);
  history.replaceState(null, "", "#" + p.toString());
}

// ---------- Navigation ----------
function renderNav() {
  const groups = {};
  for (const a of META.arenas) (groups[a.group] ||= []).push(a);

  const top = $("#topbar");
  top.innerHTML = "";
  for (const g of GROUP_ORDER.filter((g) => groups[g])) {
    const wrap = document.createElement("div");
    wrap.className = "tb-group";
    const on = groups[g].some((a) => a.id === state.arena);
    wrap.innerHTML = `<button class="tb-btn ${on ? "on" : ""}">${g}<svg viewBox="0 0 10 10"><path d="M2.5 4l2.5 2.5L7.5 4"/></svg></button><div class="tb-menu"></div>`;
    const menu = wrap.querySelector(".tb-menu");
    for (const a of groups[g]) {
      const b = document.createElement("button");
      b.textContent = `${a.label} Arena`;
      if (a.id === state.arena) b.className = "on";
      b.onclick = () => selectArena(a.id);
      menu.appendChild(b);
    }
    top.appendChild(wrap);
  }

  const nav = $("#arenaNav");
  nav.innerHTML = "";
  for (const g of GROUP_ORDER.filter((g) => groups[g])) {
    const h = document.createElement("div");
    h.className = "nav-group";
    h.textContent = g;
    nav.appendChild(h);
    for (const a of groups[g]) {
      const d = document.createElement("div");
      d.className = "nav-item" + (a.id === state.arena ? " active" : "");
      const n = a.variants[0].dates.length;
      d.innerHTML = `${a.label}<span class="count">${n} 版</span>`;
      d.onclick = () => selectArena(a.id);
      nav.appendChild(d);
    }
  }
}

function selectArena(id) {
  state.arena = id;
  state.variant = null;
  state.category = "overall";
  state.sort = null;
  renderNav();
  load();
}

// ---------- Sidebar ----------
function renderAdjustments() {
  const a = arenaById(state.arena);
  const list = $("#adjList");
  list.innerHTML = "";
  $("#adjSec").hidden = a.variants.length < 2;
  const cur = currentVariant();
  for (const v of a.variants) {
    const l = document.createElement("label");
    l.className = "radio";
    const since = state.date && state.date < v.dates[0] ? ` <span class="muted">（${v.dates[0].slice(0, 7)} 起）</span>` : "";
    l.innerHTML = `<input type="radio" name="adj" value="${v.id}" ${v.id === cur.id ? "checked" : ""}><span></span>${VARIANT_LABEL[v.id] || v.id}${since}`;
    l.querySelector("input").onchange = () => { state.variant = v.id; load(); };
    list.appendChild(l);
  }
}

function renderDateControls() {
  const v = currentVariant();
  const ds = v.dates;
  const inp = $("#dateInput");
  inp.min = ds[0];
  const today = localToday();
  inp.max = today;
  inp.value = state.date || today;

  const sel = $("#snapSelect");
  sel.innerHTML = ds.slice().reverse().map((d) => `<option value="${d}">${d}</option>`).join("");
  if (BOARD) sel.value = BOARD.date;

  $("#prevBtn").disabled = !BOARD?.prev;
  $("#nextBtn").disabled = !BOARD?.next;
  $("#latestBtn").disabled = !BOARD?.next;

  const note = $("#resolvedNote");
  if (!BOARD) { note.textContent = ""; return; }
  const idx = ds.indexOf(BOARD.date) + 1;
  let msg = `顯示 <b>${BOARD.date}</b> 發布的版本（第 ${idx} / ${ds.length} 版）`;
  if (!state.date || (state.date >= today && !BOARD.next)) {
    msg = `今天（${today}）的最新榜是 <b>${BOARD.date}</b> 發布的版本（第 ${idx} / ${ds.length} 版）。`;
  } else if (state.date !== BOARD.date) {
    msg = state.date < ds[0]
      ? `${state.date} 早於這個榜第一次發布，改顯示最早的 <b>${BOARD.date}</b>。`
      : `${state.date} 當天看到的是 <b>${BOARD.date}</b> 發布的版本（第 ${idx} / ${ds.length} 版）。`;
  }
  const built = new Date(META.built_at);
  const builtText = `${built.getMonth() + 1}/${built.getDate()} ${hhmm(META.built_at)}`;
  msg += `<br>每 ${META.check_interval_minutes} 分鐘自動檢查新資料，最近一次更新在 ${builtText}。`;
  note.innerHTML = msg;
}

function renderCategories() {
  const cats = BOARD.categories;
  $("#catCount").textContent = `(${cats.length})`;
  const list = $("#catList");
  list.innerHTML = "";
  const LIMIT = 10;
  let shown = state.showAllCats ? cats : cats.slice(0, LIMIT);
  if (!shown.includes(BOARD.category)) shown = [...shown, BOARD.category];
  for (const c of shown) {
    const [emo, label] = catInfo(c);
    const b = document.createElement("button");
    b.className = "cat" + (c === BOARD.category ? " on" : "");
    b.innerHTML = `<span class="emo">${emo}</span>${label}<svg class="check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg>`;
    b.onclick = () => { state.category = c; load(); };
    list.appendChild(b);
  }
  const more = $("#catMore");
  more.hidden = cats.length <= LIMIT;
  more.textContent = state.showAllCats ? "− 收合" : `+ 顯示更多（${cats.length - LIMIT}）`;
}

// ---------- Table ----------
const isAgent = () => currentVariant().config.startsWith("agent");
const fmtScore = (x) => (x == null ? "—" : isAgent() ? x.toFixed(3) : Math.round(x).toString());
const fmtCI = (r) => {
  if (r.lo == null || r.hi == null) return "";
  const half = (r.hi - r.lo) / 2;
  return "±" + (isAgent() ? half.toFixed(3) : Math.round(half));
};
const fmtInt = (x) => (x == null ? "—" : Math.round(x).toLocaleString("en-US"));
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
const isOpen = (lic) => lic && !/proprietary/i.test(lic);

function filteredRows() {
  let rows = BOARD.rows;
  if (state.lic === "prop") rows = rows.filter((r) => !isOpen(r.license));
  if (state.lic === "open") rows = rows.filter((r) => isOpen(r.license));
  if (state.q) {
    const q = state.q.toLowerCase();
    rows = rows.filter((r) => r.model.toLowerCase().includes(q) || (r.org || "").toLowerCase().includes(q));
  }
  return rows;
}

function labRows(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = r.org || "unknown";
    const cur = by.get(k);
    if (!cur) by.set(k, { org: k, best: r, models: 1, votes: r.votes || 0 });
    else {
      cur.models++;
      cur.votes += r.votes || 0;
      if (r.score > cur.best.score) cur.best = r;
    }
  }
  return [...by.values()].sort((a, b) => b.best.score - a.best.score).map((x, i) => ({ ...x, labRank: i + 1 }));
}

function deltaCell(r) {
  if (!BOARD.prev) return `<span class="delta same">—</span>`;
  if (r.prev_rank == null) return `<span class="delta new">NEW</span>`;
  const d = r.prev_rank - r.rank;
  if (d > 0) return `<span class="delta up">▲ ${d}</span>`;
  if (d < 0) return `<span class="delta down">▼ ${-d}</span>`;
  return `<span class="delta same">–</span>`;
}

const MODEL_COLS = () => [
  { k: "rank", label: "Rank", cls: "ctr", get: (r) => r.rank },
  { k: "spread", label: "Rank Spread", cls: "ctr", get: (r) => r.rank_best },
  { k: "model", label: "Model", cls: "", get: (r) => r.model.toLowerCase() },
  { k: "score", label: "Score", cls: "", get: (r) => r.score, desc: true },
  { k: "votes", label: isAgent() ? "Observations" : "Votes", cls: "num", get: (r) => r.votes, desc: true },
  ...(isAgent() ? [{ k: "sessions", label: "Sessions", cls: "num", get: (r) => r.sessions, desc: true }] : []),
  { k: "delta", label: "vs 上一版", cls: "ctr", get: (r) => (r.prev_rank == null ? -1e9 : r.prev_rank - r.rank), desc: true },
];

function renderTable() {
  const wrap = $(".table-wrap");
  const rows0 = filteredRows();
  const thead = $("#thead");
  const tbody = $("#tbody");

  if (state.view === "labs") {
    const labs = labRows(rows0);
    thead.innerHTML = `<tr><th class="ctr">Rank</th><th>Lab</th><th>Top Model</th><th>Score</th><th class="num">Models</th><th class="num">${isAgent() ? "Observations" : "Votes"}</th></tr>`;
    tbody.innerHTML = labs.map((l) => `
      <tr>
        <td class="ctr rank">${l.labRank}</td>
        <td><div class="model"><span class="logo" style="background:${orgColor(l.org)}">${titleCase(l.org)[0]}</span><span class="mname">${esc(titleCase(l.org))}</span></div></td>
        <td><span class="mname">${esc(l.best.model)}</span></td>
        <td>${fmtScore(l.best.score)}<span class="ci">${fmtCI(l.best)}</span></td>
        <td class="num">${l.models}</td>
        <td class="num">${fmtInt(l.votes)}</td>
      </tr>`).join("");
    $("#empty").hidden = labs.length > 0;
    return;
  }

  const cols = MODEL_COLS();
  let rows = rows0.slice();
  if (state.sort) {
    const c = cols.find((c) => c.k === state.sort.k);
    if (c) {
      const dir = state.sort.dir;
      rows.sort((a, b) => {
        const x = c.get(a), y = c.get(b);
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * dir;
      });
    }
  }

  thead.innerHTML = "<tr>" + cols.map((c) => {
    const on = state.sort?.k === c.k;
    const arrow = on ? (state.sort.dir > 0 ? "↑" : "↓") : (c.k === "score" && !state.sort ? "↓" : "⇅");
    return `<th class="${c.cls} ${on || (c.k === "score" && !state.sort) ? "sorted" : ""}" data-k="${c.k}">${c.label}<span class="sort">${arrow}</span></th>`;
  }).join("") + "</tr>";
  thead.querySelectorAll("th").forEach((th) => {
    th.onclick = () => {
      const c = cols.find((c) => c.k === th.dataset.k);
      const first = c.desc ? -1 : 1;
      if (state.sort?.k === c.k) state.sort = state.sort.dir === first ? { k: c.k, dir: -first } : null;
      else state.sort = { k: c.k, dir: first };
      renderTable();
    };
  });

  tbody.innerHTML = rows.map((r) => {
    const org = r.org || "";
    const lic = r.license || "—";
    return `
    <tr>
      <td class="ctr rank">${r.rank ?? "—"}</td>
      <td class="ctr"><span class="spread">${r.rank_best}<i></i>${r.rank_worst}</span></td>
      <td><div class="model">
        <span class="logo" style="background:${orgColor(org)}">${titleCase(org)[0]}</span>
        <div><div class="mname">${esc(r.model)}</div><div class="msub">${esc(titleCase(org))} · ${esc(lic)}</div></div>
      </div></td>
      <td>${fmtScore(r.score)}<span class="ci">${fmtCI(r)}</span></td>
      <td class="num">${fmtInt(r.votes)}</td>
      ${isAgent() ? `<td class="num">${fmtInt(r.sessions)}</td>` : ""}
      <td class="ctr">${deltaCell(r)}</td>
    </tr>`;
  }).join("");
  $("#empty").hidden = rows.length > 0;
  wrap.scrollTop = 0;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderHead() {
  const a = arenaById(state.arena);
  const [emo, label] = catInfo(BOARD.category);
  $("#title").textContent = `${a.label} Arena`;
  $("#catChip").textContent = `${emo} ${label}`;
  $("#desc").textContent = DESC[a.id] || "";
  const d = new Date(BOARD.date + "T00:00:00");
  $("#mDate").textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  // Each battle vote is counted once for each of its two models.
  $("#mVotes").textContent = isAgent()
    ? `${fmtInt(BOARD.total_votes)} observations`
    : `≈ ${fmtInt(BOARD.total_votes / 2)} votes`;
  $("#mModels").textContent = `${BOARD.models} models`;
  document.title = `${a.label} Arena · ${BOARD.date} · Arena 歷史排行榜`;
}

// ---------- Data ----------
// Static files from build.py: meta.json lists publish dates and categories per config, and
// data/<config>/<date>/<category>.json holds one leaderboard as arrays in META.cols order.
async function fetchBoard(config, date, category) {
  const { dates, categories } = META.configs[config];
  const eligible = date ? dates.filter((d) => d <= date) : dates;
  const cur = eligible.length ? eligible[eligible.length - 1] : dates[0];
  const i = dates.indexOf(cur);
  const cats = categories[cur];
  if (!cats.includes(category)) category = cats.includes("overall") ? "overall" : cats[0];
  const res = await fetch(`data/${config}/${cur}/${encodeURIComponent(category)}.json`);
  const rows = (await res.json()).map((a) => Object.fromEntries(META.cols.map((c, j) => [c, a[j]])));
  return {
    config, requested: date, date: cur, category, categories: cats, rows,
    prev: dates[i - 1] || null, next: dates[i + 1] || null,
    models: rows.length, total_votes: rows.reduce((s, r) => s + (r.votes || 0), 0),
  };
}

async function load() {
  const v = currentVariant();
  state.variant = v.id;
  writeHash();
  renderAdjustments();
  const seq = ++reqSeq;
  document.body.classList.add("loading");
  const data = await fetchBoard(v.config, state.date, state.category);
  if (seq !== reqSeq) return;
  document.body.classList.remove("loading");
  BOARD = data;
  state.category = data.category;
  writeHash();
  renderHead();
  renderDateControls();
  renderCategories();
  renderTable();
}

function bind() {
  $("#dateInput").onchange = (e) => { state.date = e.target.value; load(); };
  $("#snapSelect").onchange = (e) => { state.date = e.target.value; load(); };
  $("#prevBtn").onclick = () => { if (BOARD?.prev) { state.date = BOARD.prev; load(); } };
  $("#nextBtn").onclick = () => { if (BOARD?.next) { state.date = BOARD.next; load(); } };
  $("#latestBtn").onclick = () => { state.date = ""; load(); };
  $("#catMore").onclick = () => { state.showAllCats = !state.showAllCats; renderCategories(); };
  document.querySelectorAll('input[name="lic"]').forEach((i) => (i.onchange = () => { state.lic = i.value; renderTable(); }));
  $("#search").oninput = (e) => { state.q = e.target.value.trim(); renderTable(); };
  document.querySelectorAll(".seg [data-view]").forEach((b) => (b.onclick = () => {
    state.view = b.dataset.view;
    document.querySelectorAll(".seg [data-view]").forEach((x) => x.classList.toggle("on", x === b));
    renderTable();
  }));
  $("#toggleFilters").onclick = () => {
    state.filtersHidden = !state.filtersHidden;
    $("#filters").classList.toggle("hidden", state.filtersHidden);
    $("#toggleLabel").textContent = state.filtersHidden ? "Show Filters" : "Hide Filters";
  };
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select")) return;
    if (e.key === "ArrowLeft") $("#prevBtn").click();
    if (e.key === "ArrowRight") $("#nextBtn").click();
  });
}

(async function init() {
  // Revalidate so a refresh always sees the newest build (GitHub Pages caches for 10 minutes).
  META = await (await fetch("meta.json", { cache: "no-cache" })).json();
  for (const a of META.arenas) for (const v of a.variants) v.dates = META.configs[v.config].dates;
  readHash();
  bind();
  // replaceState() in writeHash() doesn't fire this, so it only runs on manual URL edits.
  window.addEventListener("hashchange", () => {
    readHash();
    renderNav();
    load();
  });
  renderNav();
  load();
})();
