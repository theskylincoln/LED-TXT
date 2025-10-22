window.addEventListener('error', e => alert('JS error: ' + (e?.error?.message || e.message)));

/* =======================================================
   LED Backpack Animator — app.js (Part 1 of 3)
   ======================================================= */

/* ---------- helpers ---------- */
const $  = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

/* ---------- DOM ---------- */
const canvas = $("#led"), ctx = canvas.getContext("2d"), wrap = $(".canvas-wrap");
const resSel = $("#resSelect"), zoomSlider = $("#zoom"), fitBtn = $("#fitBtn");
const modeEditBtn = $("#modeEdit"), modePrevBtn = $("#modePreview");
const undoBtn = $("#undoBtn"), redoBtn = $("#redoBtn"), clearAllBtn = $("#clearAllBtn");

const addWordBtn = $("#addWordBtn"), addLineBtn = $("#addLineBtn"), delWordBtn = $("#deleteWordBtn");

const fontSel = $("#fontSelect"), fontSizeInput = $("#fontSize"), autoSizeChk = $("#autoSize");
const fontColor = $("#fontColor"), addSwatchBtn = $("#addSwatchBtn"), swatchWrap = $("#swatches");
const lineGapInput = $("#lineGap"), wordGapInput = $("#wordGap");

const alignBtns = $$(".seg-btn[data-align]"), valignBtns = $$(".seg-btn[data-valign]");
const animList = $("#animList");

const previewBtn = $("#previewRenderBtn"), gifBtn = $("#gifRenderBtn");
const fileNameInput = $("#fileName"), fpsInput = $("#fps"), secInput = $("#seconds");
const gifPreviewImg = $("#gifPreview");

const saveJsonBtn = $("#saveJsonBtn"), loadJsonInput = $("#loadJsonInput");

const bgGrid = $("#bgGrid"), bgUpload = $("#bgUpload"), bgSolidColor = $("#bgSolidColor");
const addBgSwatchBtn = $("#addBgSwatchBtn"), bgSwatchWrap = $("#bgSwatches");

const aboutBtn = $("#aboutBtn"), aboutModal = $("#aboutModal"), aboutClose = $("#aboutClose");

let selected = { line: 0, word: 0, caret: 0 };

/* ---------- App state ---------- */
const state = {
  mode: "edit", // 'edit' | 'preview'
  zoom: 1,
  res: { w: 96, h: 128 },
  background: { type: "solid", color: "#000000", image: null, name: "solid" },
  lines: [
    {
      words: [
        { text: "HELLO", color: "#FFFFFF", font: "Orbitron", size: 22, anim: {}, align: "center", manual: false, x: 0, y: 0 }
      ],
      align: "center"
    }
  ],
  selection: { line: 0, word: 0 },
  undo: [],
  redo: [],
  spacing: { lineGap: 4, wordGap: 6 },
  dragPromptDismissed: false,
  animations: [],
};

/* ---------- Rendering helpers ---------- */
function resizeCanvas() {
  canvas.width = state.res.w;
  canvas.height = state.res.h;
  render();
}

function fitCanvas() {
  const bounds = wrap.getBoundingClientRect();
  const scale = Math.min(bounds.width / state.res.w, bounds.height / state.res.h);
  state.zoom = scale;
  canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

zoomSlider.addEventListener("input", e => {
  state.zoom = parseFloat(e.target.value);
  canvas.style.transform = `translate(-50%, -50%) scale(${state.zoom})`;
});
fitBtn.addEventListener("click", fitCanvas);

/* ---------- Undo / redo ---------- */
function pushUndo() {
  state.undo.push(JSON.stringify(state.lines));
  if (state.undo.length > 20) state.undo.shift();
  state.redo = [];
}
undoBtn.addEventListener("click", () => {
  if (!state.undo.length) return;
  state.redo.push(JSON.stringify(state.lines));
  state.lines = JSON.parse(state.undo.pop());
  render();
});
redoBtn.addEventListener("click", () => {
  if (!state.redo.length) return;
  state.undo.push(JSON.stringify(state.lines));
  state.lines = JSON.parse(state.redo.pop());
  render();
});
clearAllBtn.addEventListener("click", () => {
  if (confirm("Clear all text?")) {
    pushUndo();
    state.lines = [{ words: [] }];
    render();
  }
});

/* ---------- Autosize ---------- */
function autoSizeLines() {
  const padding = 6;
  const maxW = state.res.w - padding * 2;
  ctx.textBaseline = "top";

  for (const line of state.lines) {
    let maxFont = parseFloat(fontSizeInput.value);
    if (!autoSizeChk.checked) continue;

    const measureLine = (size) => {
      ctx.font = `${size}px ${line.words[0]?.font || "Orbitron"}`;
      let totalW = 0;
      for (const word of line.words) {
        ctx.font = `${size}px ${word.font}`;
        totalW += ctx.measureText(word.text).width + state.spacing.wordGap;
      }
      return totalW - state.spacing.wordGap;
    };

    while (measureLine(maxFont) > maxW && maxFont > 6) maxFont -= 0.5;
    for (const word of line.words) word.size = maxFont;
  }
}

/* ---------- Drawing ---------- */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  if (state.background.type === "solid") {
    ctx.fillStyle = state.background.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (state.background.image) {
    ctx.drawImage(state.background.image, 0, 0, canvas.width, canvas.height);
  }

  autoSizeLines();

  const totalH = state.lines.reduce((sum, l) => {
    const lh = Math.max(...l.words.map(w => w.size || 20));
    return sum + lh + state.spacing.lineGap;
  }, -state.spacing.lineGap);

  let y = (canvas.height - totalH) / 2;
  for (const line of state.lines) {
    const lineH = Math.max(...line.words.map(w => w.size || 20));
    const totalW = line.words.reduce((s, w) => {
      ctx.font = `${w.size}px ${w.font}`;
      return s + ctx.measureText(w.text).width + state.spacing.wordGap;
    }, -state.spacing.wordGap);

    let x = (canvas.width - totalW) / 2;

    for (const word of line.words) {
      ctx.font = `${word.size}px ${word.font}`;
      ctx.fillStyle = word.color;
      ctx.fillText(word.text, x, y);
      x += ctx.measureText(word.text).width + state.spacing.wordGap;
    }

    y += lineH + state.spacing.lineGap;
  }
}

/* ---------- Background grid ---------- */
function makeBgTile(src, name, kind = "preset") {
  const div = document.createElement("div");
  div.className = "bg-tile";
  div.dataset.name = name;
  div.dataset.kind = kind;
  const img = new Image();
  img.src = src;
  div.appendChild(img);
  div.addEventListener("click", () => selectBgTile(div, src, kind));
  return div;
}

function selectBgTile(tile, src, kind) {
  $$(".bg-tile").forEach(t => t.classList.remove("active"));
  tile.classList.add("active");

  if (kind === "solid") {
    state.background = { type: "solid", color: bgSolidColor.value, image: null, name: "solid" };
  } else if (kind === "upload") {
    bgUpload.click();
  } else {
    const img = new Image();
    img.onload = () => {
      state.background = { type: "image", image: img, name: tile.dataset.name };
     /* =======================================================
   LED Backpack Animator — app.js (Part 2A of 3)
   Text editing, selection, and inspector setup
   ======================================================= */

/* ---------- Selection ---------- */
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / state.zoom;
  const y = (e.clientY - rect.top) / state.zoom;

  const lines = state.lines;
  let hit = null;
  let yCursor = (canvas.height - calcTotalHeight()) / 2;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineH = Math.max(...line.words.map(w => w.size || 20));
    const totalW = calcLineWidth(line);
    let xCursor = (canvas.width - totalW) / 2;

    for (let wi = 0; wi < line.words.length; wi++) {
      const word = line.words[wi];
      ctx.font = `${word.size}px ${word.font}`;
      const w = ctx.measureText(word.text).width;
      if (x >= xCursor && x <= xCursor + w && y >= yCursor && y <= yCursor + lineH) {
        hit = { line: li, word: wi };
        break;
      }
      xCursor += w + state.spacing.wordGap;
    }
    yCursor += lineH + state.spacing.lineGap;
  }

  if (hit) {
    state.selection = hit;
  } else {
    state.selection = null;
  }
  render();
});

/* ---------- Helper Calculations ---------- */
function calcLineWidth(line) {
  let totalW = 0;
  for (const w of line.words) {
    ctx.font = `${w.size}px ${w.font}`;
    totalW += ctx.measureText(w.text).width + state.spacing.wordGap;
  }
  return totalW - state.spacing.wordGap;
}
function calcTotalHeight() {
  return state.lines.reduce((sum, l) => {
    const lh = Math.max(...l.words.map(w => w.size || 20));
    return sum + lh + state.spacing.lineGap;
  }, -state.spacing.lineGap);
}

/* ---------- Typing + Editing ---------- */
document.addEventListener("keydown", (e) => {
  if (state.mode !== "edit") return;
  const sel = state.selection;
  if (!sel) return;

  const line = state.lines[sel.line];
  const word = line.words[sel.word];
  if (!word) return;

  const text = word.text;

  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    pushUndo();
    word.text += e.key;
    render();
  } else if (e.key === "Backspace") {
    e.preventDefault();
    pushUndo();
    word.text = text.slice(0, -1);
    render();
  } else if (e.key === "Enter") {
    e.preventDefault();
    pushUndo();
    state.lines.splice(sel.line + 1, 0, { words: [{ text: "", font: word.font, size: word.size, color: word.color }] });
    state.selection = { line: sel.line + 1, word: 0 };
    render();
  } else if (e.key === " ") {
    e.preventDefault();
    pushUndo();
    line.words.splice(sel.word + 1, 0, { text: "", font: word.font, size: word.size, color: word.color });
    state.selection = { line: sel.line, word: sel.word + 1 };
    render();
  }
});

/* ---------- Add / Delete ---------- */
addWordBtn.addEventListener("click", () => {
  const sel = state.selection;
  const line = sel ? state.lines[sel.line] : state.lines[state.lines.length - 1];
  line.words.push({ text: "NEW", font: "Orbitron", size: 22, color: "#FFFFFF" });
  render();
});
addLineBtn.addEventListener("click", () => {
  state.lines.push({ words: [{ text: "LINE", font: "Orbitron", size: 22, color: "#FFFFFF" }] });
  render();
});
delWordBtn.addEventListener("click", () => {
  const sel = state.selection;
  if (!sel) return;
  const line = state.lines[sel.line];
  line.words.splice(sel.word, 1);
  if (!line.words.length) state.lines.splice(sel.line, 1);
  state.selection = null;
  render();
});

/* ---------- Inspector Tabs ---------- */
const inspectorToggle = $("#toggleInspector");
const inspectorBody = $("#inspectorBody");
const pillTabs = $$(".pill[data-acc]");
const accFont = $("#accFont"), accLayout = $("#accLayout"), accAnim = $("#accAnim");

inspectorToggle.addEventListener("click", () => {
  const open = !inspectorBody.classList.contains("open");
  inspectorBody.classList.toggle("open", open);
  inspectorToggle.setAttribute("aria-expanded", String(open));
});
pillTabs.forEach(p => {
  p.addEventListener("click", () => {
    const id = p.dataset.acc;
    [accFont, accLayout, accAnim].forEach(a => a.open = a.id === id);
    pillTabs.forEach(x => x.classList.toggle("active", x === p));
    inspectorBody.classList.add("open");
  });
});
/* =======================================================
   LED Backpack Animator — app.js (Part 2B of 3)
   Font & color controls, swatches, spacing/alignment,
   animations panel (19 anims) + undo helpers
   ======================================================= */

/* ---------- Undo helpers (lightweight) ---------- */
const UNDO_MAX = 80;
const undoStack = [];
const redoStack = [];
function snapshot() {
  return JSON.stringify({ lines: state.lines, spacing: state.spacing, align: state.align, valign: state.valign, anims: state.anims });
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack.length = 0;
}
function doUndo() {
  if (!undoStack.length) return;
  const cur = snapshot();
  const prev = undoStack.pop();
  redoStack.push(cur);
  const s = JSON.parse(prev);
  state.lines = s.lines;
  state.spacing = s.spacing;
  state.align = s.align;
  state.valign = s.valign;
  state.anims = s.anims;
  render();
}
function doRedo() {
  if (!redoStack.length) return;
  const cur = snapshot();
  const nxt = redoStack.pop();
  undoStack.push(cur);
  const s = JSON.parse(nxt);
  state.lines = s.lines;
  state.spacing = s.spacing;
  state.align = s.align;
  state.valign = s.valign;
  state.anims = s.anims;
  render();
}

/* ---------- Font controls ---------- */
const fontSelect   = $("#fontSelect");
const fontSize     = $("#fontSize");
const autoSize     = $("#autoSize");
const fontColorInp = $("#fontColor");
const swatchesWrap = $("#swatches");
const addSwatchBtn = $("#addSwatchBtn");

/* text swatch model */
const defaultPalette = ["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customPalette = [];

function applyToSelection(fn) {
  const sel = state.selection;
  if (!sel) return;
  const w = state.lines[sel.line]?.words[sel.word];
  if (!w) return;
  pushUndo();
  fn(w);
  render();
}

/* Font family */
fontSelect.addEventListener("change", () => {
  applyToSelection(w => { w.font = fontSelect.value || "Orbitron"; });
});

/* Font size (manual override) */
fontSize.addEventListener("input", () => {
  const v = Math.max(6, Math.min(64, parseInt(fontSize.value || "22", 10)));
  applyToSelection(w => { w.size = v; });
});

/* Auto-size toggle (store-only; sizing happens in render) */
autoSize.addEventListener("change", () => {
  state.autoSize = !!autoSize.checked;
  render();
});

/* Color input */
fontColorInp.addEventListener("input", () => {
  const c = fontColorInp.value || "#FFFFFF";
  applyToSelection(w => { w.color = c; });
});

/* Swatches UI */
function rebuildTextSwatches() {
  swatchesWrap.innerHTML = "";
  [...defaultPalette, ...customPalette].forEach(c => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.background = c;
    b.title = c;
    b.addEventListener("click", () => {
      fontColorInp.value = c;
      applyToSelection(w => { w.color = c; });
    });
    b.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      // allow removing custom swatches on right-click
      const idx = customPalette.indexOf(c);
      if (idx >= 0) { customPalette.splice(idx, 1); rebuildTextSwatches(); }
    });
    swatchesWrap.appendChild(b);
  });
}
addSwatchBtn.addEventListener("click", () => {
  const c = fontColorInp.value || "#FFFFFF";
  if (!defaultPalette.includes(c) && !customPalette.includes(c)) customPalette.push(c);
  rebuildTextSwatches();
});

/* ---------- Spacing & Alignment ---------- */
const lineGapInput = $("#lineGap");
const wordGapInput = $("#wordGap");
const alignBtns  = $$("[data-align]");
const valignBtns = $$("[data-valign]");

/* line gap */
lineGapInput.addEventListener("input", () => {
  pushUndo();
  const v = Math.max(0, Math.min(40, parseInt(lineGapInput.value || "4", 10)));
  state.spacing.lineGap = v;
  render();
});

/* word gap */
wordGapInput.addEventListener("input", () => {
  pushUndo();
  const v = Math.max(0, Math.min(40, parseInt(wordGapInput.value || "6", 10)));
  state.spacing.wordGap = v;
  render();
});

/* horizontal align */
alignBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    alignBtns.forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    pushUndo();
    state.align = btn.dataset.align; // "left" | "center" | "right"
    render();
  });
});

/* vertical align */
valignBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    valignBtns.forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    pushUndo();
    state.valign = btn.dataset.valign; // "top" | "middle" | "bottom"
    render();
  });
});

/* ---------- Animations Panel UI ---------- */
const animList = $("#animList");

const ANIMS = [
  { id:"slide",      name:"Slide In",           params:{direction:"Left",  speed:1} },
  { id:"slideaway",  name:"Slide Away",         params:{direction:"Left",  speed:1} },
  { id:"zoom",       name:"Zoom",               params:{direction:"In",    speed:1} },
  { id:"scroll",     name:"Scroll / Marquee",   params:{direction:"Left",  speed:1} },
  { id:"pulse",      name:"Pulse / Breathe",    params:{scale:0.03, vy:4} },
  { id:"wave",       name:"Wave",               params:{ax:0.8, ay:1.4, cycles:1.0} },
  { id:"jitter",     name:"Jitter",             params:{amp:0.10, freq:2.5} },
  { id:"shake",      name:"Shake",              params:{amp:0.20, freq:2} },
  { id:"colorcycle", name:"Color Cycle",        params:{speed:0.5, start:"#ff0000"} },
  { id:"rainbow",    name:"Rainbow Sweep",      params:{speed:0.5, start:"#ff00ff"} },
  { id:"sweep",      name:"Highlight Sweep",    params:{speed:0.7, width:0.25} },
  { id:"flicker",    name:"Flicker",            params:{strength:0.5} },
  { id:"strobe",     name:"Strobe",             params:{rate:3} },
  { id:"glow",       name:"Glow Pulse",         params:{intensity:0.6} },
  { id:"heartbeat",  name:"Heartbeat",          params:{rate:1.2} },
  { id:"ripple",     name:"Ripple",             params:{amp:1.0, freq:2.0} },
  { id:"typewriter", name:"Typewriter",         params:{rate:1} },
  { id:"scramble",   name:"Scramble / Decode",  params:{rate:1} },
  { id:"popcorn",    name:"Popcorn",            params:{rate:1} },
  { id:"fadeout",    name:"Fade Out",           params:{} },
];
const CONFLICTS = [
  ["typewriter","scramble"],
  ["typewriter","popcorn"],
  ["strobe","flicker"],
  ["rainbow","colorcycle"],
];

function getAnim(id){ return state.anims.find(a => a.id === id); }
function setAnimEnabled(id, enabled){
  const has = !!getAnim(id);
  if (enabled && !has) {
    // conflict handling
    const offenders = state.anims.filter(a => CONFLICTS.some(p => p.includes(a.id) && p.includes(id)));
    if (offenders.length) {
      // keep new; remove conflicts
      state.anims = state.anims.filter(a => !offenders.some(o => o.id === a.id));
    }
    const base = ANIMS.find(a => a.id === id);
    state.anims.push({ id, params: { ...base.params } });
  } else if (!enabled && has) {
    state.anims = state.anims.filter(a => a.id !== id);
  }
}
function buildAnimParamsUI(animDef, row, enabled) {
  const params = document.createElement("div");
  params.className = "anim-params";
  params.style.display = enabled ? "block" : "none";

  const current = getAnim(animDef.id)?.params || animDef.params;

  Object.entries(animDef.params).forEach(([k, v]) => {
    const item = document.createElement("div");
    item.className = "p";

    const label = document.createElement("label");
    label.textContent = k[0].toUpperCase() + k.slice(1);

    let input;
    if (k === "direction") {
      input = document.createElement("select");
      const opts = (animDef.id === "zoom") ? ["In","Out"] : ["Left","Right","Up","Down"];
      opts.forEach(val => {
        const o = document.createElement("option");
        o.value = val; o.textContent = val;
        if ((current[k] ?? v) === val) o.selected = true;
        input.appendChild(o);
      });
    } else if (k === "start") {
      input = document.createElement("input");
      input.type = "color";
      input.value = current[k] ?? v;
    } else {
      input = document.createElement("input");
      input.type = "number";
      input.step = "0.1";
      input.value = current[k] ?? v;
    }

    input.addEventListener("input", () => {
      const a = getAnim(animDef.id);
      if (!a) return;
      pushUndo();
      a.params[k] = (input.type === "number") ? +input.value : input.value;
      render();
    });

    item.appendChild(label);
    item.appendChild(input);
    params.appendChild(item);
  });

  row.appendChild(params);
  return params;
}

function buildAnimationsUI() {
  animList.innerHTML = "";
  ANIMS.forEach(def => {
    const row = document.createElement("div");
    row.className = "anim-row";

    const left = document.createElement("div");
    left.className = "anim-left";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.id = `anim_${def.id}`;
    chk.checked = !!getAnim(def.id);

    const lbl = document.createElement("label");
    lbl.setAttribute("for", chk.id);
    lbl.textContent = def.name;

    const gear = document.createElement("button");
    gear.type = "button";
    gear.className = "button tiny";
    gear.title = "Params";
    gear.textContent = "⚙";

    left.appendChild(chk);
    left.appendChild(lbl);
    left.appendChild(gear);

    const paramsUI = buildAnimParamsUI(def, row, chk.checked);

    chk.addEventListener("change", () => {
      pushUndo();
      setAnimEnabled(def.id, chk.checked);
      paramsUI.style.display = chk.checked ? "block" : "none";
      render();
    });
    gear.addEventListener("click", () => {
      paramsUI.style.display = paramsUI.style.display === "none" ? "block" : "none";
    });

    row.appendChild(left);
    animList.appendChild(row);
  });
}

/* ---------- Hook Undo/Redo buttons if present ---------- */
const undoBtn = $("#undoBtn");
const redoBtn = $("#redoBtn");
undoBtn && undoBtn.addEventListener("click", doUndo);
redoBtn && redoBtn.addEventListener("click", doRedo);

/* ---------- Initial UI sync ---------- */
rebuildTextSwatches();
buildAnimationsUI();

/* Keep inputs in sync when selection changes (best-effort) */
function syncInspectorFromSelection() {
  const sel = state.selection;
  const w = sel ? state.lines[sel.line]?.words[sel.word] : null;
  if (!w) return;
  fontSelect.value = w.font || "Orbitron";
  fontSize.value   = w.size || 22;
  fontColorInp.value = w.color || "#FFFFFF";
}
document.addEventListener("click", (e) => {
  if (e.target.closest("canvas")) setTimeout(syncInspectorFromSelection, 0);
});
/* =======================================================
   LED Backpack Animator — app.js (Part 2C of 3)
   Auto-size logic + render sync + config I/O + persistence
   ======================================================= */

/* ---------- Auto-size font engine ---------- */
function autoSizeLines() {
  if (!state.autoSize) return;
  const pad = 6;
  const maxW = state.res.w - pad * 2;
  const maxH = state.res.h - pad * 2;
  const totalLines = state.lines.length;
  const lineGap = state.spacing.lineGap || 2;

  const perLineH = (maxH - (totalLines - 1) * lineGap) / totalLines;

  state.lines.forEach(line => {
    let maxSize = perLineH;
    // try reducing size until all words fit
    for (let s = maxSize; s >= 6; s -= 0.5) {
      let totalWidth = -state.spacing.wordGap;
      line.words.forEach(w => {
        ctx.font = `${s}px ${w.font}`;
        totalWidth += ctx.measureText(w.text || "").width + state.spacing.wordGap;
      });
      if (totalWidth <= maxW) {
        line.words.forEach(w => w.size = s);
        break;
      }
    }
  });
}

/* ---------- Full render with safe centering ---------- */
function render() {
  const W = canvas.width = state.res.w;
  const H = canvas.height = state.res.h;

  // Background
  ctx.clearRect(0, 0, W, H);
  if (state.background?.type === "solid") {
    ctx.fillStyle = state.background.color || "#000";
    ctx.fillRect(0, 0, W, H);
  } else if (state.background?.image) {
    ctx.drawImage(state.background.image, 0, 0, W, H);
  }

  autoSizeLines();

  // measure total height
  const lineHeights = state.lines.map(l => Math.max(...l.words.map(w => w.size || 20)));
  const totalH = lineHeights.reduce((sum, h) => sum + h, 0) + state.spacing.lineGap * (state.lines.length - 1);
  let y;
  if (state.valign === "top") y = 4;
  else if (state.valign === "bottom") y = H - totalH - 4;
  else y = (H - totalH) / 2;

  state.lines.forEach((line, li) => {
    const lh = lineHeights[li] || 20;
    // width
    let totalW = -state.spacing.wordGap;
    line.words.forEach(w => {
      ctx.font = `${w.size}px ${w.font}`;
      totalW += ctx.measureText(w.text || "").width + state.spacing.wordGap;
    });

    let x;
    if (line.align === "left" || state.align === "left") x = 4;
    else if (line.align === "right" || state.align === "right") x = W - totalW - 4;
    else x = (W - totalW) / 2;

    line.words.forEach((w, wi) => {
      ctx.font = `${w.size}px ${w.font}`;
      ctx.fillStyle = w.color;
      const baseY = y + lh * 0.85;
      ctx.fillText(w.text, x, baseY);
      // draw selection box
      if (state.selection && state.selection.line === li && state.selection.word === wi && state.mode === "edit") {
        const ww = ctx.measureText(w.text).width;
        ctx.strokeStyle = "rgba(255,255,255,.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 2, baseY - lh, ww + 4, lh + 4);
      }
      x += ctx.measureText(w.text).width + state.spacing.wordGap;
    });

    y += lh + state.spacing.lineGap;
  });
}

/* ---------- Config Export / Import ---------- */
const exportBtn = $("#exportBtn");
const importBtn = $("#importBtn");
const fileInput = $("#importFile");

function exportConfig() {
  const blob = new Blob([snapshot()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "LEDAnimator_Config.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      Object.assign(state, data);
      render();
      saveState();
    } catch {
      alert("Invalid config file");
    }
  };
  reader.readAsText(file);
}

exportBtn?.addEventListener("click", exportConfig);
importBtn?.addEventListener("click", () => fileInput?.click());
fileInput?.addEventListener("change", e => {
  const f = e.target.files?.[0];
  if (f) importConfig(f);
});

/* ---------- Local persistence ---------- */
function saveState() {
  try { localStorage.setItem("ledAnimatorState", snapshot()); }
  catch (err) { console.warn("Save error", err); }
}
function restoreState() {
  try {
    const s = localStorage.getItem("ledAnimatorState");
    if (s) {
      const d = JSON.parse(s);
      Object.assign(state, d);
    }
  } catch {}
}
window.addEventListener("beforeunload", saveState);
restoreState();

/* ---------- Fit canvas & initial render ---------- */
function fitCanvas() {
  const pad = 18;
  const r = wrap.getBoundingClientRect();
  const availW = Math.max(40, r.width - pad * 2);
  const availH = Math.max(40, r.height - pad * 2);
  const s = Math.max(0.1, Math.min(availW / state.res.w, availH / state.res.h));
  state.zoom = s;
  canvas.style.transform = `translate(-50%,-50%) scale(${s})`;
}
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", () => setTimeout(fitCanvas, 150));

/* ---------- Init ---------- */
function init() {
  rebuildTextSwatches?.();
  buildAnimationsUI?.();
  fitCanvas();
  render();
}
init();
/* =======================================================
   LED Backpack Animator — app.js (Part 3 of 3)
   Preview loop + local GIF export + controls wiring
   ======================================================= */

/* ---------- DOM (controls used here) ---------- */
const fpsInput        = $("#fps");
const secondsInput    = $("#seconds");
const fileNameInput   = $("#fileName");
const previewBtn      = $("#previewRenderBtn");
const gifBtn          = $("#gifRenderBtn");
const gifPreviewImg   = $("#gifPreview");
const progressFill    = $("#progress");
const tCur            = $("#tCur");
const tEnd            = $("#tEnd");

const modeEditBtn     = $("#modeEdit");
const modePreviewBtn  = $("#modePreview");

/* ---------- Helpers ---------- */
function getFPS() {
  const v = parseInt(fpsInput?.value || "15", 10);
  return Math.max(1, Math.min(30, v || 15));
}
function getDuration() {
  const v = parseInt(secondsInput?.value || "8", 10);
  return Math.max(1, Math.min(60, v || 8));
}

/* ---------- Preview Loop ---------- */
let rafId = null;
let startT = 0;

function startPreview() {
  stopPreview();
  startT = performance.now();
  const dur = getDuration();
  if (tEnd) tEnd.textContent = `${dur.toFixed(1)}s`;

  function loop(now) {
    const secs = (now - startT) / 1000;
    const tt = secs % dur;

    // Render animated frame (state.animations is already in Part 2)
    render(tt, dur);

    // progress bar + timestamp
    if (progressFill) progressFill.style.setProperty("--p", (tt / dur));
    if (tCur) tCur.textContent = `${tt.toFixed(1)}s`;

    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}
function stopPreview() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  // draw a stable frame (t=0)
  render(0, getDuration());
}

/* Mode buttons (hide selection box in preview via state.mode flag) */
function setMode(m) {
  state.mode = m;
  modeEditBtn?.classList.toggle("active", m === "edit");
  modePreviewBtn?.classList.toggle("active", m === "preview");
  if (m === "preview") startPreview();
  else stopPreview();
}
modeEditBtn && modeEditBtn.addEventListener("click", () => setMode("edit"));
modePreviewBtn && modePreviewBtn.addEventListener("click", () => setMode("preview"));

/* ---------- Local GIF encoder loader (no CDN) ---------- */
function loadScriptLocal(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function ensureLocalGifLibs() {
  if (typeof GIFEncoder !== "undefined") return true;
  try {
    // Put these files in ./libs/jsgif/
    await loadScriptLocal("./libs/jsgif/NeuQuant.js");
    await loadScriptLocal("./libs/jsgif/LZWEncoder.js");
    await loadScriptLocal("./libs/jsgif/GIFEncoder.js");
  } catch (e) {
    console.error("Local GIF libs failed to load", e);
    return false;
  }
  return typeof GIFEncoder !== "undefined";
}

function encoderToBlob(enc) {
  const bytes = enc.stream().bin || enc.stream().getData();
  const u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
  return new Blob([u8], { type: "image/gif" });
}

/* ---------- Render GIF (preview + download) ---------- */
async function renderGifDownload() {
  const ok = await ensureLocalGifLibs();
  if (!ok) { alert("GIF encoder not found. Make sure libs are in ./libs/jsgif/."); return; }

  const fps = getFPS();
  const secs = getDuration();
  const frames = Math.max(1, Math.floor(fps * secs));
  const delay = Math.max(1, Math.round(1000 / fps));

  const W = canvas.width = state.res.w;
  const H = canvas.height = state.res.h;

  // Pause preview rendering to avoid flicker
  const resume = (state.mode === "preview");
  stopPreview();

  try {
    const enc = new GIFEncoder();
    enc.setRepeat(0);
    enc.setDelay(delay);
    enc.setQuality(10);
    enc.setSize(W, H);
    enc.start();

    for (let i = 0; i < frames; i++) {
      const t = i / fps;
      render(t, secs);
      enc.addFrame(ctx);
      // Optional: small yield to keep UI responsive
      // await new Promise(r => setTimeout(r, 0));
      if (progressFill) progressFill.style.setProperty("--p", (t / secs) % 1);
      if (tCur) tCur.textContent = `${(t % secs).toFixed(1)}s`;
    }

    enc.finish();
    const blob = encoderToBlob(enc);
    const url = URL.createObjectURL(blob);

    // Show preview and try to trigger a download
    if (gifPreviewImg) {
      gifPreviewImg.classList.remove("hidden");
      gifPreviewImg.src = url;
      gifPreviewImg.alt = "Animated GIF preview";
    }

    // Desktop download
    const name = `${(fileNameInput?.value || "animation").replace(/\.(png|jpe?g|webp|gif)$/i, "")}.gif`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    // For mobile: opening in a new tab helps “Save Image”
    a.target = "_blank";
    a.rel = "noopener";
    a.click();

    // Revoke later (keep it a bit for the preview img)
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  } catch (err) {
    console.error("GIF render failed:", err);
    alert("GIF render failed. Check console for details.");
  } finally {
    if (resume) startPreview();
  }
}

/* ---------- Bind controls ---------- */
previewBtn && previewBtn.addEventListener("click", () => {
  // Ensure user sees motion; set mode to preview
  setMode("preview");
});

gifBtn && gifBtn.addEventListener("click", () => {
  renderGifDownload();
});

// If FPS / seconds change during preview, update time scale & labels
[fpsInput, secondsInput].forEach(inp => inp && inp.addEventListener("input", () => {
  if (state.mode === "preview") startPreview();
  if (tEnd) tEnd.textContent = `${getDuration().toFixed(1)}s`;
}));

/* ---------- Final touch: start in EDIT, first paint ---------- */
setMode("edit");
render(0, getDuration());
