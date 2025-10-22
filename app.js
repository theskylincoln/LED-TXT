/* ============================================
   LED Backpack Animator — Full app.js (v2.10)
   - Uses your existing /assets folder paths
   - Solid color tools show ONLY when "Solid" is selected + swatches
   - On-canvas typing w/ blinking caret + mid-word edits (Arrow/Home/End)
   - Auto-size on first paint + every edit/import/resolution change (no clipping)
   - Inspector = horizontal tabs only (no left labels)
   - Undo / Redo / Clear (includes deletions)
   - Full animations (19) in preview AND GIF export
   - Preview mode autoplays; progress bar under canvas
   - GIF export via CDN gif.js; mobile-friendly download
   - No localStorage — always fresh start
   ============================================ */

/* ---------- tiny helpers ---------- */
const $  = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ---------- DOM ---------- */
const canvas = $("#led"), ctx = canvas.getContext("2d"), wrap = $(".canvas-wrap");
const resSel = $("#resSelect");
const bgGrid = $("#bgGrid");
const bgSolidTools = $("#bgSolidTools");
const bgSolidColor = $("#bgSolidColor");
const bgSwatches = $("#bgSwatches");
const addBgSwatchBtn = $("#addBgSwatchBtn");
const bgUpload = $("#bgUpload");

const zoomSlider = $("#zoom");
const fitBtn = $("#fitBtn");

const modeEditBtn = $("#modeEdit");
const modePrevBtn = $("#modePreview");

const undoBtn = $("#undoBtn");
const redoBtn = $("#redoBtn");
const clearAllBtn = $("#clearAllBtn");

const addWordBtn = $("#addWordBtn");
const addLineBtn = $("#addLineBtn");
const deleteWordFx = $("#deleteWordBtn");

const inspectorToggle = $("#toggleInspector");
const inspectorBody = $("#inspectorBody");
const accFont = $("#accFont"), accLayout = $("#accLayout"), accAnim = $("#accAnim");

const fontSel = $("#fontSelect");
const fontSizeInput = $("#fontSize");
const autoSizeChk = $("#autoSize");
const fontColorInput = $("#fontColor");
const swatchesWrap = $("#swatches");
const addSwatchBtn = $("#addSwatchBtn");

const lineGapInput = $("#lineGap");
const wordGapInput = $("#wordGap");
const alignBtns  = $$("[data-align]");
const valignBtns = $$("[data-valign]");

const animList = $("#animList");

const saveJsonBtn = $("#saveJsonBtn");
const loadJsonInput = $("#loadJsonInput");

const fileNameInput = $("#fileName");
const fpsInput = $("#fps");
const secInput = $("#seconds");

const previewBtn = $("#previewRenderBtn");
const gifBtn = $("#gifRenderBtn");
const gifPreviewImg = $("#gifPreview");

const tCur = $("#tCur");
const tEnd = $("#tEnd");
const progressBar = $("#progress");

const aboutBtn = $("#aboutBtn");
$("#aboutClose")?.addEventListener("click", () => $("#aboutModal").classList.add("hidden"));
aboutBtn?.addEventListener("click", () => $("#aboutModal").classList.remove("hidden"));

/* ---------- state ---------- */
let mode = "edit";
let zoom = parseFloat(zoomSlider?.value || "1");

const defaults = {
  fontFamily: "Orbitron",
  fontSize: 22,
  color: "#FFFFFF",
  lineGap: 4,
  wordGap: 6,
  align: "center",
  valign: "middle",
};
const defaultPalette = ["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customPalette = [];
let customBgPalette = [];

/* Default document (fresh start) */
let doc = {
  res: { w: 96, h: 128 },
  lines: [
    { words: [ { text: "WILL",     style:{ color:"#1E90FF" } } ] },
    { words: [ { text: "WHEELIE",  style:{ color:"#32CD32" } } ] },
    { words: [ { text: "FOR",      style:{ color:"#FFFFFF" } } ] },
    { words: [ { text: "BOOKTOK",  style:{ color:"#FF66CC" } } ] },
    { words: [ { text: "GIRLIES",  style:{ color:"#FF3333" } } ] },
  ],
  style: {
    ...defaults,
    align: "center",
    valign: "middle",
    lineGap: 4,
    wordGap: 6
  },
  bg: { type:"image", preset:"assets/presets/96x128/Preset_A.png", image:null, color:null },
  animations: [
    { id:"pulse", params:{ scale:0.02, vy:2 } },
    { id:"glow",  params:{ intensity:0.35 } },
    { id:"sweep", params:{ speed:0.5, width:0.18 } }
  ]
};

let selected = { line: 0, word: 0, caret: 5 };

let history = [], future = [];
const MAX_STACK = 100;

/* ---------- presets & background grid ---------- */
const PRESETS = {
  "96x128": [
    { id: "A", thumb: "assets/thumbs/Preset_A_thumb.png", full: "assets/presets/96x128/Preset_A.png" },
    { id: "B", thumb: "assets/thumbs/Preset_B_thumb.png", full: "assets/presets/96x128/Preset_B.png" },
  ],
  "64x64": [
    { id: "C", thumb: "assets/thumbs/Preset_C_thumb.png", full: "assets/presets/64x64/Preset_C.png" },
    { id: "D", thumb: "assets/thumbs/Preset_D_thumb.png", full: "assets/presets/64x64/Preset_D.png" },
  ],
};
const visibleSet = () => PRESETS[`${doc.res.w}x${doc.res.h}`] || [];

function buildBgGrid() {
  bgGrid.innerHTML = "";
  const set = visibleSet();
  const tiles = [
    {...set[0], kind: "preset"},
    {...set[1], kind: "preset"},
    {kind: "solid",  thumb:"assets/thumbs/Solid_thumb.png"},
    {kind: "upload", thumb:"assets/thumbs/Upload_thumb.png"},
  ].filter(Boolean);

  tiles.forEach((t) => {
    const d = document.createElement("div");
    d.className = "bg-tile";
    d.dataset.kind = t.kind;
    const img = document.createElement("img");
    img.alt = "";
    img.src = t.kind === "preset" ? t.thumb : (t.thumb || "");
    d.appendChild(img);

    on(d, "click", async () => {
      $$(".bg-tile", bgGrid).forEach(x => x.classList.remove("active"));
      d.classList.add("active");
      if (t.kind === "preset") {
        const im = new Image(); im.crossOrigin = "anonymous"; im.src = t.full;
        try { await im.decode(); } catch {}
        doc.bg = { type:"image", color:null, image:im, preset:t.full };
        showSolidTools(false);
      } else if (t.kind === "solid") {
        doc.bg = { type:"solid", color:bgSolidColor.value, image:null, preset:null };
        showSolidTools(true);
      } else if (t.kind === "upload") {
        bgUpload.click();
        return;
      }
      autoSizeAllIfOn();
      render(0, getTotalSeconds());
      fitZoom();
    });

    bgGrid.appendChild(d);
  });

  const first = $(".bg-tile", bgGrid);
  if (first) first.classList.add("active");
}
function showSolidTools(show) { bgSolidTools.classList.toggle("hidden", !show); }

on(bgUpload, "change", (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {
    URL.revokeObjectURL(url);
    doc.bg = { type:"image", color:null, image:im, preset:null };
    showSolidTools(false);
    autoSizeAllIfOn();
    render(0, getTotalSeconds());
    fitZoom();
    $$(".bg-tile", bgGrid).forEach(x => x.classList.remove("active"));
  };
  im.src = url;
});

/* ---------- history ---------- */
function pushHistory() { history.push(JSON.stringify({doc, selected})); if (history.length > MAX_STACK) history.shift(); future.length = 0; }
function undo() {
  if (!history.length) return;
  future.push(JSON.stringify({doc, selected}));
  const st = JSON.parse(history.pop());
  doc = st.doc; selected = st.selected;
  autoSizeAllIfOn(); render(0, getTotalSeconds());
}
function redo() {
  if (!future.length) return;
  history.push(JSON.stringify({doc, selected}));
  const st = JSON.parse(future.pop());
  doc = st.doc; selected = st.selected;
  autoSizeAllIfOn(); render(0, getTotalSeconds());
}

/* ---------- zoom / fit (true centering) ---------- */
function setMode(m) {
  mode = m;
  modeEditBtn?.classList.toggle("active", m === "edit");
  modePrevBtn?.classList.toggle("active", m !== "edit");
  if (mode === "preview") startPreview(); else stopPreview();
}
function setZoom(z) {
  zoom = z;
  if (zoomSlider) zoomSlider.value = String(z.toFixed(2));
  canvas.style.transform = `translate(-50%,-50%) scale(${zoom})`;
}
function fitZoom() {
  if (!wrap) return;
  const pad = 18;
  const r = wrap.getBoundingClientRect();
  const availW = Math.max(40, r.width - pad * 2);
  const availH = Math.max(40, r.height - pad * 2);
  const s = Math.max(0.1, Math.min(availW / doc.res.w, availH / doc.res.h));
  setZoom(s);
}
window.addEventListener("resize", fitZoom);
window.addEventListener("orientationchange", () => setTimeout(fitZoom, 200));
fitBtn && on(fitBtn, "click", fitZoom);
zoomSlider && on(zoomSlider, "input", (e) => setZoom(parseFloat(e.target.value)));

/* ---------- layout / measure ---------- */
function resolveStyle(over = {}) {
  return {
    fontFamily: over.fontFamily || doc.style.fontFamily || defaults.fontFamily,
    fontSize:   over.fontSize   || doc.style.fontSize   || defaults.fontSize,
    color:      over.color      || doc.style.color      || defaults.color,
  };
}
function layoutDocument() {
  const pos = [];
  const fs = doc.style.fontSize || defaults.fontSize;
  const lineStep = fs + (doc.style.lineGap ?? defaults.lineGap);
  const totalH = doc.lines.length * lineStep;
  let startY = 0;
  if (doc.style.valign === "top") startY = fs + 6;
  else if (doc.style.valign === "middle") startY = (doc.res.h - totalH) / 2 + fs;
  else startY = doc.res.h - totalH + fs - 6;

  doc.lines.forEach((line, li) => {
    const widths = line.words.map(w => {
      const st = resolveStyle(w.style); ctx.font = `${st.fontSize}px ${st.fontFamily}`;
      return Math.ceil(ctx.measureText(w.text || "").width);
    });
    const gaps = Math.max(0, line.words.length - 1) * (doc.style.wordGap ?? defaults.wordGap);
    const w = line.words.length ? widths.reduce((a, b) => a + b, 0) + gaps : 0;
    const startX = (doc.style.align === "left") ? 4 :
                   (doc.style.align === "center") ? (doc.res.w - w) / 2 :
                   (doc.res.w - w - 4);
    let x = startX, y = startY + li * lineStep;
    line.words.forEach((_, wi) => { pos.push({ line: li, word: wi, x, y, width: widths[wi] }); x += widths[wi] + (doc.style.wordGap ?? defaults.wordGap); });
  });
  return { positions: pos };
}
function measureWordBBox(li, wi) {
  const line = doc.lines[li]; if (!line) return null;
  const word = line.words[wi]; if (!word) return null;
  const st = resolveStyle(word.style);
  ctx.font = `${st.fontSize}px ${st.fontFamily}`;
  const t = word.text || "";
  const m = ctx.measureText(t);
  const w = Math.ceil(m.width), h = Math.ceil(st.fontSize * 1.15);
  const p = layoutDocument().positions.find(v => v.line === li && v.word === wi); if (!p) return null;
  return { x: p.x, y: p.y - h, w, h };
}

/* ---------- caret & typing ---------- */
function measureCharWidths(text, fontSpec){
  ctx.save(); ctx.font = fontSpec; const arr = [];
  for (let i = 0; i < text.length; i++) arr.push(Math.ceil(ctx.measureText(text[i]).width));
  ctx.restore(); return arr;
}
function caretFromClick(li, wi, clickX){
  const line = doc.lines[li]; if (!line) return 0;
  const word = line.words[wi]; if (!word) return 0;
  const st = resolveStyle(word.style);
  const fontSpec = `${st.fontSize}px ${st.fontFamily}`;
  const widths = measureCharWidths(word.text || "", fontSpec);
  const pos = layoutDocument().positions.find(v => v.line===li && v.word===wi);
  if (!pos) return (word.text||"").length;
  let acc = pos.x;
  for (let i=0;i<widths.length;i++){
    const mid = acc + widths[i]/2;
    if (clickX < mid) return i;
    acc += widths[i];
  }
  return widths.length;
}

/* ---------- animations engine ---------- */
const ANIMS = [
  { id:"slide",      name:"Slide In",       params:{direction:"Left",  speed:1} },
  { id:"slideaway",  name:"Slide Away",     params:{direction:"Left",  speed:1} },
  { id:"zoom",       name:"Zoom",           params:{direction:"In",    speed:1} },
  { id:"scroll",     name:"Scroll / Marquee", params:{direction:"Left", speed:1} },
  { id:"pulse",      name:"Pulse / Breathe", params:{scale:0.03, vy:4} },
  { id:"wave",       name:"Wave",           params:{ax:0.8, ay:1.4, cycles:1.0} },
  { id:"jitter",     name:"Jitter",         params:{amp:0.10, freq:2.5} },
  { id:"shake",      name:"Shake",          params:{amp:0.20, freq:2} },
  { id:"colorcycle", name:"Color Cycle",    params:{speed:0.5, start:"#ff0000"} },
  { id:"rainbow",    name:"Rainbow Sweep",  params:{speed:0.5, start:"#ff00ff"} },
  { id:"sweep",      name:"Highlight Sweep",params:{speed:0.7, width:0.25} },
  { id:"flicker",    name:"Flicker",        params:{strength:0.5} },
  { id:"strobe",     name:"Strobe",         params:{rate:3} },
  { id:"glow",       name:"Glow Pulse",     params:{intensity:0.6} },
  { id:"heartbeat",  name:"Heartbeat",      params:{rate:1.2} },
  { id:"ripple",     name:"Ripple",         params:{amp:1.0, freq:2.0} },
  { id:"typewriter", name:"Typewriter",     params:{rate:1} },
  { id:"scramble",   name:"Scramble / Decode", params:{rate:1} },
  { id:"popcorn",    name:"Popcorn",        params:{rate:1} },
  { id:"fadeout",    name:"Fade Out",       params:{} },
];
const CONFLICTS = [
  ["typewriter","scramble"],
  ["typewriter","popcorn"],
  ["strobe","flicker"],
  ["rainbow","colorcycle"],
];

function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function colorToHue(hex){
  const c=hex.replace("#",""); const r=parseInt(c.slice(0,2),16)/255,g=parseInt(c.slice(2,4),16)/255,b=parseInt(c.slice(4,6),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0; if(max!==min){const d=max-min; switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6;}
  return Math.round(h*360);
}
const getActive = id => doc.animations.find(a => a.id === id);

function animatedProps(base, wordObj, t, totalDur){
  const props = { x:base.x, y:base.y, scale:1, alpha:1, text:wordObj.text||"", color:null, dx:0, dy:0, shadow:null, gradient:null, perChar:null };

  // Scroll/Marquee
  const scroll = getActive("scroll");
  if (scroll) {
    const dir = (scroll.params.direction || "Left");
    const sp  = Number(scroll.params.speed || 1);
    const v = 20 * sp;
    if(dir==="Left")  props.dx -= (t * v) % (doc.res.w + 200);
    if(dir==="Right") props.dx += (t * v) % (doc.res.w + 200);
    if(dir==="Up")    props.dy -= (t * v) % (doc.res.h + 200);
    if(dir==="Down")  props.dy += (t * v) % (doc.res.h + 200);
  }

  // Typewriter
  const type = getActive("typewriter");
  if (type && props.text) {
    const rate = Number(type.params.rate || 1);
    const cps  = 10 * rate; // chars/sec
    const shown = Math.max(0, Math.min(props.text.length, Math.floor(t * cps)));
    props.text = props.text.slice(0, shown);
  }

  // Pulse/Breathe
  const pulse = getActive("pulse");
  if (pulse) {
    const s = Number(pulse.params.scale || 0.03);
    const vy = Number(pulse.params.vy || 4);
    props.scale *= 1 + (Math.sin(t * 2 * Math.PI) * s);
    props.dy    += Math.sin(t * 2 * Math.PI) * vy;
  }

  // Wave
  const wave = getActive("wave");
  if (wave) {
    const ax = Number(wave.params.ax || 0.8);
    const ay = Number(wave.params.ay || 1.4);
    const cyc= Number(wave.params.cycles || 1.0);
    const ph = cyc * 2 * Math.PI * t;
    props.dx += Math.sin(ph + base.x * 0.05) * ax * 4;
    props.dy += Math.sin(ph + base.y * 0.06) * ay * 4;
  }

  // Jitter
  const jit = getActive("jitter");
  if (jit) {
    const a = Number(jit.params.amp || 0.10), f = Number(jit.params.freq || 2.5);
    const r1 = Math.sin(t * 2 * Math.PI * f) * a * 3, r2 = Math.cos(t * 2 * Math.PI * f) * a * 3;
    props.dx += r1; props.dy += r2;
  }

  // Shake
  const shake = getActive("shake");
  if (shake) {
    const a = Number(shake.params.amp || 0.20) * 5, f = Number(shake.params.freq || 2);
    props.dx += Math.sin(t * 2 * Math.PI * f) * a;
    props.dy += Math.cos(t * 2 * Math.PI * f) * a * 0.6;
  }

  // Zoom
  const zm = getActive("zoom");
  if (zm) {
    const dir = (zm.params.direction || "In");
    const sp  = Number(zm.params.speed || 1);
    const k = 0.4 * sp;
    props.scale *= (dir === "In")
      ? (1 + k * easeOutCubic(Math.min(1, t / 1)))
      : Math.max(0.2, 1 + k * (1 - Math.min(1, t / 1)) * (-1));
  }

  // Slide In (head)
  const slide = getActive("slide");
  if (slide && totalDur) {
    const head = 0.2 * totalDur;
    const dir = (slide.params.direction || "Left");
    const sp  = Number(slide.params.speed || 1);
    const d = Math.min(1, t / Math.max(0.001, head));
    const dist = ((dir==="Left"||dir==="Right") ? doc.res.w : doc.res.h) * 0.6 * sp;
    const s = 1 - easeOutCubic(d);
    if(dir==="Left")  props.dx -= dist * s;
    if(dir==="Right") props.dx += dist * s;
    if(dir==="Up")    props.dy -= dist * s;
    if(dir==="Down")  props.dy += dist * s;
  }

  // Slide Away (tail)
  const slideaway = getActive("slideaway");
  if (slideaway && totalDur) {
    const tail = 0.2 * totalDur;
    if (t > totalDur - tail) {
      const dir = (slideaway.params.direction || "Left");
      const sp  = Number(slideaway.params.speed || 1);
      const r = (t - (totalDur - tail)) / tail;
      const dist = ((dir==="Left"||dir==="Right") ? doc.res.w : doc.res.h) * 0.6 * sp;
      const s = easeOutCubic(r);
      if(dir==="Left")  props.dx -= dist * s;
      if(dir==="Right") props.dx += dist * s;
      if(dir==="Up")    props.dy -= dist * s;
      if(dir==="Down")  props.dy += dist * s;
    }
  }

  // Fade out (tail)
  const fout = getActive("fadeout");
  if (fout && totalDur) {
    const tail = 0.2 * totalDur;
    if (t > totalDur - tail) {
      const r = (t - (totalDur - tail)) / tail;
      props.alpha *= Math.max(0, 1 - r);
    }
  }

  // Color Cycle
  const cc = getActive("colorcycle");
  if (cc) {
    const sp = Number(cc.params.speed || 0.5);
    const base = (cc.params.start || "#ff0000");
    const hueBase = colorToHue(base);
    const hue = Math.floor((hueBase + (t * 60 * sp)) % 360);
    props.color = `hsl(${hue}deg 100% 60%)`;
  }

  // Rainbow gradient
  const rainbow = getActive("rainbow");
  if (rainbow) {
    const speed = Number(rainbow.params.speed || 0.5);
    const base = (rainbow.params.start || "#ff00ff");
    const hueBase = colorToHue(base);
    props.gradient = { type: "rainbow", speed, base: hueBase };
  }

  // Flicker / Strobe
  const flicker = getActive("flicker");
  if (flicker) {
    const str = Math.max(0, Math.min(1, Number(flicker.params.strength || 0.5)));
    const n = (Math.sin(t * 23.7) + Math.sin(t * 17.3)) * 0.25 + 0.5;
    props.alpha *= (1 - str * 0.6) + n * str * 0.6;
  }
  const strobe = getActive("strobe");
  if (strobe) {
    const rate = Number(strobe.params.rate || 3);
    const phase = Math.sin(2 * Math.PI * rate * t);
    props.alpha *= (phase > 0) ? 1 : 0.15;
  }

  // Glow
  const glow = getActive("glow");
  if (glow) {
    const intensity = Math.max(0, Number(glow.params.intensity || 0.6));
    const k = (Math.sin(t * 2 * Math.PI * 1.2) * 0.5 + 0.5) * intensity;
    props.shadow = { blur: 6 + k * 10, color: props.color || null };
  }

  // Sweep
  const sweep = getActive("sweep");
  if (sweep) {
    const speed = Number(sweep.params.speed || 0.7), width = Number(sweep.params.width || 0.25);
    props.gradient = { type: "sweep", speed, width };
  }

  // Heartbeat
  const hb = getActive("heartbeat");
  if (hb) {
    const r = Number(hb.params.rate || 1.2);
    const beat = Math.abs(Math.sin(2 * Math.PI * r * t)) ** 2;
    props.scale *= 1 + beat * 0.08;
  }

  // Ripple per-char
  const ripple = getActive("ripple");
  if (ripple && props.text) {
    const amp = Number(ripple.params.amp || 1.0) * 2.0;
    const freq= Number(ripple.params.freq || 2.0);
    const arr = [];
    for (let i = 0; i < props.text.length; i++) arr.push(Math.sin(2 * Math.PI * freq * t + i * 0.6) * amp);
    props.perChar ??= {}; props.perChar.dy = arr;
  }

  // Scramble / Popcorn per-char
  const scr = getActive("scramble");
  if (scr && props.text) {
    const rate = Number(scr.params.rate || 1), cps = 10 * rate;
    const goal = wordObj.text || ""; let out = "";
    for (let i = 0; i < goal.length; i++) {
      const revealAt = i / cps;
      if (t >= revealAt) out += goal[i];
      else {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        const idx = Math.floor((t * 20 + i * 3) % chars.length);
        out += chars[idx];
      }
    }
    props.text = out;
  }
  const pop = getActive("popcorn");
  if (pop && props.text) {
    const rate = Number(pop.params.rate || 1);
    const alphaArr = [];
    for (let i = 0; i < props.text.length; i++) {
      const phase = Math.sin(2 * Math.PI * rate * t + i * 0.4);
      alphaArr.push(phase > 0 ? 1 : 0.25);
    }
    props.perChar ??= {}; props.perChar.alpha = alphaArr;
  }

  return props;
}

/* ---------- render ---------- */
function renderBg() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (doc.bg.type === "solid") {
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if (doc.bg.type === "image") {
    if (doc.bg.image) {
      try { ctx.drawImage(doc.bg.image, 0, 0, canvas.width, canvas.height); } catch {}
    } else if (doc.bg.preset) {
      const im = new Image(); im.crossOrigin = "anonymous"; im.src = doc.bg.preset;
      im.onload = () => { doc.bg.image = im; render(0, getTotalSeconds()); };
    }
  }
}

function render(t = 0, totalDur = null) {
  canvas.width  = doc.res.w;
  canvas.height = doc.res.h;

  renderBg();

  const layout = layoutDocument();
  layout.positions.forEach((p) => {
    const word = doc.lines[p.line].words[p.word];
    const st = resolveStyle(word.style);
    const props = animatedProps(p, word, t, totalDur);
    const txt = props.text || "";

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, props.alpha));
    ctx.textBaseline = "alphabetic";
    const fsize = st.fontSize * props.scale;
    const fontSpec = `${fsize}px ${st.fontFamily}`; ctx.font = fontSpec;

    if (props.shadow) { ctx.shadowBlur = props.shadow.blur; ctx.shadowColor = props.shadow.color || st.color; }
    else ctx.shadowBlur = 0;

    let fillStyle = props.color || st.color;
    const baseX = p.x + (props.dx || 0), baseY = p.y + (props.dy || 0);

    // gradients
    if (props.gradient && txt.length) {
      const wordWidth = Math.ceil(ctx.measureText(txt).width);
      if (props.gradient.type === "rainbow") {
        const g = ctx.createLinearGradient(baseX, baseY, baseX + wordWidth, baseY);
        const baseHue = (props.gradient.base + (t * 120 * props.gradient.speed)) % 360;
        for (let i=0;i<=6;i++){ const stop=i/6; const hue=Math.floor((baseHue+stop*360)%360); g.addColorStop(stop, `hsl(${hue}deg 100% 60%)`); }
        fillStyle = g;
      } else if (props.gradient.type === "sweep") {
        const band = Math.max(0.05, Math.min(0.8, props.gradient.width || 0.25));
        const pos  = (t * (props.gradient.speed || 0.7) * 1.2) % 1;
        const g = ctx.createLinearGradient(baseX, baseY, baseX + wordWidth, baseY);
        const a = Math.max(0, pos - band/2), b = Math.min(1, pos + band/2);
        g.addColorStop(0, fillStyle); g.addColorStop(a, fillStyle);
        g.addColorStop(pos, "#FFFFFF"); g.addColorStop(b, fillStyle); g.addColorStop(1, fillStyle);
        fillStyle = g;
      }
    }
    ctx.fillStyle = fillStyle;

    // per-char support
    if (props.perChar && txt.length) {
      const widths = measureCharWidths(txt, fontSpec); let x = baseX;
      for (let i=0;i<txt.length;i++) {
        const ch = txt[i];
        const dy = (props.perChar.dy?.[i] || 0);
        const aMul = (props.perChar.alpha?.[i] ?? 1);
        const oa = ctx.globalAlpha; ctx.globalAlpha = oa * aMul;
        ctx.fillText(ch, x, baseY + dy);
        ctx.globalAlpha = oa;
        x += widths[i];
      }
    } else {
      ctx.fillText(txt, baseX, baseY);
    }

    // selection box & caret in EDIT mode only
    if (mode === "edit" && selected && selected.line === p.line && selected.word === p.word) {
      const box = measureWordBBox(p.line, p.word);
      if (box) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,0,255,0.95)";
        ctx.lineWidth = 1; ctx.setLineDash([3,2]);
        ctx.shadowColor="rgba(255,0,255,0.85)"; ctx.shadowBlur=6;
        ctx.strokeRect(box.x-1, box.y-1, box.w+2, box.h+2);
        ctx.restore();

        // caret
        const word = doc.lines[selected.line].words[selected.word];
        const st2 = resolveStyle(word.style);
        ctx.font = `${st2.fontSize}px ${st2.fontFamily}`;
        const pos = layout.positions.find(v => v.line===selected.line && v.word===selected.word);
        if (pos) {
          const widths = measureCharWidths(word.text||"", `${st2.fontSize}px ${st2.fontFamily}`);
          const caretX = pos.x + widths.slice(0, selected.caret || 0).reduce((a,b)=>a+b,0);
          const caretH = Math.ceil(st2.fontSize * 1.1);
          const blink = Math.floor(performance.now()/500)%2===0;
          if (blink) {
            ctx.save();
            ctx.strokeStyle = "#ff66ff"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(caretX, pos.y - caretH); ctx.lineTo(caretX, pos.y + 2); ctx.stroke();
            ctx.restore();
          }
        }

        // delete “×” pin inside top-right
        const rect = canvas.getBoundingClientRect(), host = wrap.getBoundingClientRect();
        const cx = rect.left + (box.x + box.w - 6) * zoom;
        const cy = rect.top  + (box.y + 6) * zoom;
        deleteWordFx.style.left = `${cx - host.left}px`;
        deleteWordFx.style.top  = `${cy - host.top}px`;
        deleteWordFx.classList.remove("hidden");
      }
    }
    ctx.restore();
  });
}

/* ---------- auto-size ---------- */
function autoSizeLine(lineIdx){
  const layout = layoutDocument();
  const items = layout.positions.filter(p=>p.line===lineIdx);
  items.forEach(p=>{
    const w = doc.lines[p.line].words[p.word];
    const st = resolveStyle(w.style);
    ctx.font = `${st.fontSize}px ${st.fontFamily}`;
    const textW = Math.ceil(ctx.measureText(w.text||"").width);
    const overshoot = (p.x + textW) - (doc.res.w - 4);
    if (overshoot > 0) {
      const s = Math.max(6, Math.floor(st.fontSize * (doc.res.w - 8) / (textW + 1)));
      w.style = {...w.style, fontSize: s};
    }
  });
}
function autoSizeAllIfOn(){ if (!autoSizeChk?.checked) return; for (let i=0;i<doc.lines.length;i++) autoSizeLine(i); }

/* ---------- preview loop ---------- */
let rafId = null, t0 = null;
function getTotalSeconds(){ return Math.max(1, Math.min(60, parseInt(secInput?.value || "8"))); }
function getFPS(){ return Math.max(1, Math.min(30, parseInt(fpsInput?.value || "15"))); }

function startPreview() {
  if (rafId) cancelAnimationFrame(rafId);
  t0 = performance.now();
  const dur = getTotalSeconds();
  const loop = (now) => {
    const t = (now - t0) / 1000;
    const tt = t % dur;
    render(tt, dur);

    // progress under canvas
    if (progressBar) {
      const frac = tt / dur;
      progressBar.style.setProperty("--p", frac);
      if (tCur) tCur.textContent = `${tt.toFixed(1)}s`;
      if (tEnd) tEnd.textContent = `${dur.toFixed(1)}s`;
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}
function stopPreview(){ if (rafId) cancelAnimationFrame(rafId); rafId = null; render(0, getTotalSeconds()); }

/* ---------- text swatches ---------- */
function rebuildTextSwatches(){
  swatchesWrap.innerHTML = "";
  [...defaultPalette, ...customPalette].forEach(c=>{
    const d=document.createElement("div"); d.className="swatch"; d.style.background=c;
    on(d,"click",()=>{ doc.style.color=c; const w=currentWord(); if(w) w.style={...w.style, color:c}; render(0,getTotalSeconds()); });
    swatchesWrap.appendChild(d);
  });
}
on(addSwatchBtn, "click", ()=>{
  const c = fontColorInput.value;
  if(!defaultPalette.includes(c) && !customPalette.includes(c)) customPalette.push(c);
  rebuildTextSwatches();
});

/* ---------- BG swatches (only visible when Solid) ---------- */
function rebuildBgSwatches(){
  bgSwatches.innerHTML = "";
  [...defaultPalette, ...customBgPalette].forEach(c=>{
    const d=document.createElement("div"); d.className="swatch"; d.style.background=c;
    on(d,"click",()=>{ doc.bg = { type:"solid", color:c, image:null, preset:null }; showSolidTools(true); render(0,getTotalSeconds()); });
    bgSwatches.appendChild(d);
  });
}
on(addBgSwatchBtn, "click", ()=>{
  const c = bgSolidColor.value;
  if(!defaultPalette.includes(c) && !customBgPalette.includes(c)) customBgPalette.push(c);
  rebuildBgSwatches();
});
on(bgSolidColor,"input",()=>{ doc.bg = { type:"solid", color:bgSolidColor.value, image:null, preset:null }; render(0,getTotalSeconds()); });

/* ---------- Animations UI ---------- */
const CONFLICT_GROUPS = CONFLICTS;
function conflictChoice(newId){
  const offenders = doc.animations.filter(a => CONFLICT_GROUPS.some(p => p.includes(a.id) && p.includes(newId)));
  if (!offenders.length) return "both";
  const decision = confirm(`“${ANIMS.find(a=>a.id===newId).name}” may conflict with: ${offenders.map(o=>ANIMS.find(z=>z.id===o.id).name).join(", ")}\nOK = keep both, Cancel = keep new only`);
  return decision ? "both" : "new";
}
function buildAnimUI(){
  animList.innerHTML="";
  ANIMS.forEach(a=>{
    const row=document.createElement("div"); row.className="anim-row";
    const chk=document.createElement("input"); chk.type="checkbox"; chk.id="anim_"+a.id;
    const lbl=document.createElement("label"); lbl.htmlFor=chk.id; lbl.textContent=a.name;
    const gear=document.createElement("button"); gear.textContent="⚙"; gear.className="button tiny";
    const params=document.createElement("div"); params.className="anim-params"; params.style.display="none";

    Object.keys(a.params).forEach(k=>{
      const p=document.createElement("div"); p.className="p";
      const lab=document.createElement("span"); lab.textContent=k[0].toUpperCase()+k.slice(1);
      let inp;
      if (k==="direction"){
        inp=document.createElement("select");
        (a.id==="zoom" ? ["In","Out"] : ["Left","Right","Up","Down"]).forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;if(a.params[k]===v)o.selected=true;inp.appendChild(o);});
      } else if (k==="start"){
        inp=document.createElement("input"); inp.type="color"; inp.value=a.params[k];
      } else {
        inp=document.createElement("input"); inp.value=a.params[k]; inp.type="number"; inp.step="0.1";
      }
      on(inp,"input",()=>{ const t=doc.animations.find(x=>x.id===a.id); if(t) t.params[k] = (inp.type==="number"? +inp.value : inp.value); });
      p.appendChild(lab); p.appendChild(inp); params.appendChild(p);
    });

    on(gear,"click",()=> params.style.display = params.style.display==="none" ? "block" : "none");

    on(chk,"change", ()=>{
      const found = doc.animations.find(x=>x.id===a.id);
      if (chk.checked && !found){
        const decision = conflictChoice(a.id);
        if (decision === "new")   doc.animations = doc.animations.filter(x=> !CONFLICT_GROUPS.some(p=>p.includes(x.id)&&p.includes(a.id)));
        doc.animations.push({ id:a.id, params:{...a.params} });
      } else if (!chk.checked){
        doc.animations = doc.animations.filter(x=>x.id!==a.id);
      }
    });

    row.appendChild(chk); row.appendChild(lbl); row.appendChild(gear); row.appendChild(params);
    animList.appendChild(row);
  });
}

/* ---------- Config & GIF ---------- */
on(saveJsonBtn,"click",()=>{
  const blob = new Blob([JSON.stringify(doc,null,2)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download="config.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
});
on(loadJsonInput,"change",(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ try{ doc=JSON.parse(r.result); autoSizeAllIfOn(); render(0,getTotalSeconds()); fitZoom(); }catch(err){ alert("Invalid config.json"); } }; r.readAsText(f);
});

// CDN jsgif loader + encoder
async function loadScript(src){ return new Promise((res,rej)=>{const s=document.createElement('script'); s.src=src; s.async=true; s.onload=()=>res(true); s.onerror=()=>rej(); document.head.appendChild(s);}); }
async function ensureGifLibs(){
  if (typeof GIFEncoder!=="undefined") return true;
  const sets = [
    ["https://cdn.jsdelivr.net/npm/jsgif@0.2.1/NeuQuant.js","https://cdn.jsdelivr.net/npm/jsgif@0.2.1/LZWEncoder.js","https://cdn.jsdelivr.net/npm/jsgif@0.2.1/GIFEncoder.js"],
    ["https://unpkg.com/jsgif@0.2.1/NeuQuant.js","https://unpkg.com/jsgif@0.2.1/LZWEncoder.js","https://unpkg.com/jsgif@0.2.1/GIFEncoder.js"],
  ];
  for (const group of sets){ try{ for (const u of group) await loadScript(u); }catch(e){} if (typeof GIFEncoder!=="undefined") return true; }
  return false;
}
function encoderToBlob(enc){
  const bytes = enc.stream().bin || enc.stream().getData();
  const u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
  return new Blob([u8], {type:"image/gif"});
}
async function renderGif(){
  const fps   = getFPS();
  const secs  = getTotalSeconds();
  const frames= fps * secs;
  const delay = Math.round(1000 / fps);

  const W = canvas.width, H = canvas.height;
  if (!(await ensureGifLibs())) { alert("GIF export library couldn’t load (stay online)."); return; }

  const enc = new GIFEncoder(); enc.setRepeat(0); enc.setDelay(delay); enc.setQuality(10); enc.setSize(W,H); enc.start();

  const wasPrev = (mode === "preview"); if (wasPrev) stopPreview();
  for (let i=0;i<frames;i++){
    const t = i / fps;
    render(t, secs);
    enc.addFrame(ctx);
  }
  enc.finish();
  const blob = encoderToBlob(enc);
  const url  = URL.createObjectURL(blob);
  const name = (fileNameInput.value||"animation.gif").replace(/\.(png|jpe?g|webp)$/i,".gif");
  gifPreviewImg.src = url; // in-page preview
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
  if (wasPrev) startPreview();
}

/* ---------- mode & inspector ---------- */
on(modePrevBtn, "click", ()=> setMode("preview"));
on(modeEditBtn, "click",  ()=> setMode("edit"));
on(inspectorToggle, "click", ()=>{
  const open = !inspectorBody.classList.contains("open");
  inspectorBody.classList.toggle("open", open);
  inspectorToggle.setAttribute("aria-expanded", String(open));
  setTimeout(fitZoom,60);
});
[accFont,accLayout,accAnim].forEach(a => on(a, "toggle", ()=>{
  if (a.open) [accFont,accLayout,accAnim].filter(x=>x!==a).forEach(x=>x.open=false);
}));

/* ---------- clicking / selection / typing ---------- */
function currentWord(){ return doc.lines[selected?.line]?.words[selected?.word]; }

on(canvas, "click", (e)=>{
  const rect=canvas.getBoundingClientRect(); const x=(e.clientX-rect.left)/zoom, y=(e.clientY-rect.top)/zoom;
  const pos=layoutDocument().positions; let hit=null;
  pos.forEach(p=>{ const b=measureWordBBox(p.line,p.word); if(!b) return;
    if(x>=b.x-2 && x<=b.x+b.w+2 && y>=b.y-2 && y<=b.y+b.h+2) hit=p; });
  if (hit){
    selected = { line: hit.line, word: hit.word, caret: caretFromClick(hit.line, hit.word, x) };
    if (mode === "preview"){ setMode("edit"); }
    render(0, getTotalSeconds());
  } else {
    selected = null; deleteWordFx.classList.add("hidden"); render(0, getTotalSeconds());
  }
});

on(document, "keydown", (e)=>{
  if (mode !== "edit" || !selected) return;

  const line = doc.lines[selected.line]; if(!line) return;
  const word = line.words[selected.word]; if(!word) return;

  const t = word.text || "";
  const pos = (selected.caret == null) ? t.length : selected.caret;

  if (e.key === "Enter"){ e.preventDefault();
    pushHistory(); doc.lines.splice(selected.line+1,0,{words:[{text:""}]});
    selected = { line:selected.line+1, word:0, caret:0 }; autoSizeLine(selected.line); render(0,getTotalSeconds()); return;
  }
  if (e.key === " " && !e.ctrlKey && !e.metaKey){ e.preventDefault();
    pushHistory(); line.words.splice(selected.word+1,0,{text:""}); selected = { line:selected.line, word:selected.word+1, caret:0 };
    autoSizeLine(selected.line); render(0,getTotalSeconds()); return;
  }
  if (e.key === "Backspace"){ e.preventDefault();
    pushHistory();
    if (pos>0){ word.text = t.slice(0,pos-1) + t.slice(pos); selected.caret = pos-1; }
    else {
      if (selected.word>0){
        const prev = line.words[selected.word-1]; const prevLen = (prev.text||"").length;
        prev.text = (prev.text||"") + t; line.words.splice(selected.word,1);
        selected.word--; selected.caret = prevLen;
      } else if (selected.line>0){
        const prevLine = doc.lines[selected.line-1];
        const prev = prevLine.words[prevLine.words.length-1];
        const prevLen = (prev.text||"").length;
        prev.text = (prev.text||"") + t;
        doc.lines.splice(selected.line,1);
        selected = { line:selected.line-1, word:prevLine.words.length-1, caret:prevLen };
      }
    }
    autoSizeLine(selected.line);
    render(0,getTotalSeconds()); return;
  }
  if (e.key === "Delete"){ e.preventDefault();
    pushHistory();
    if (pos < t.length){ word.text = t.slice(0,pos) + t.slice(pos+1); }
    else {
      if (selected.word < line.words.length-1){
        const next = line.words[selected.word+1]; word.text = t + (next.text||"");
        line.words.splice(selected.word+1,1);
      } else if (selected.line < doc.lines.length-1){
        const nextLine = doc.lines[selected.line+1];
        if (nextLine.words.length){ word.text = t + (nextLine.words[0].text||""); nextLine.words.shift(); }
        if (!nextLine.words.length) doc.lines.splice(selected.line+1,1);
      }
    }
    autoSizeLine(selected.line);
    render(0,getTotalSeconds()); return;
  }
  if (e.key === "ArrowLeft"){ e.preventDefault();
    if (pos>0) selected.caret = pos-1;
    else if (selected.word>0){ selected.word--; selected.caret = (line.words[selected.word].text||"").length; }
    render(0,getTotalSeconds()); return;
  }
  if (e.key === "ArrowRight"){ e.preventDefault();
    if (pos < t.length) selected.caret = pos+1;
    else if (selected.word < line.words.length-1){ selected.word++; selected.caret = 0; }
    render(0,getTotalSeconds()); return;
  }
  if (e.key === "Home"){ e.preventDefault(); selected.caret = 0; render(0,getTotalSeconds()); return; }
  if (e.key === "End"){ e.preventDefault(); selected.caret = t.length; render(0,getTotalSeconds()); return; }

  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey){ e.preventDefault();
    pushHistory();
    word.text = t.slice(0,pos) + e.key + t.slice(pos);
    selected.caret = pos + 1;
    autoSizeLine(selected.line);
    render(0,getTotalSeconds());
  }
});

// delete pin
on(deleteWordFx, "click", ()=>{
  if (!selected) return;
  pushHistory();
  const line = doc.lines[selected.line]; if(!line) return;
  line.words.splice(selected.word, 1);
  if (!line.words.length){ doc.lines.splice(selected.line,1); selected = doc.lines.length? {line:0,word:0,caret:0} : null; }
  else selected.word = Math.max(0, selected.word-1);
  deleteWordFx.classList.add("hidden"); render(0,getTotalSeconds());
});

/* ---------- font/spacing controls ---------- */
function applyStyleToCurrent(fn){ const w = currentWord(); if (w) fn(w); }
on(fontSel, "change", ()=>{ doc.style.fontFamily = fontSel.value; applyStyleToCurrent(w=> w.style={...w.style, fontFamily:fontSel.value}); autoSizeAllIfOn(); render(0,getTotalSeconds()); });
on(fontSizeInput, "input", ()=>{ const v = Math.max(6, Math.min(64, +fontSizeInput.value||22)); doc.style.fontSize=v; applyStyleToCurrent(w=> w.style={...w.style, fontSize:v}); autoSizeAllIfOn(); render(0,getTotalSeconds()); });
on(fontColorInput, "input", ()=>{ const v = fontColorInput.value; doc.style.color=v; applyStyleToCurrent(w=> w.style={...w.style, color:v}); render(0,getTotalSeconds()); });
on(lineGapInput, "input", ()=>{ doc.style.lineGap = +lineGapInput.value || 4; autoSizeAllIfOn(); render(0,getTotalSeconds()); fitZoom(); });
on(wordGapInput, "input", ()=>{ doc.style.wordGap = +wordGapInput.value || 6; autoSizeAllIfOn(); render(0,getTotalSeconds()); fitZoom(); });
alignBtns.forEach(b => on(b, "click", ()=>{ alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); doc.style.align=b.dataset.align; autoSizeAllIfOn(); render(0,getTotalSeconds()); }));
valignBtns.forEach(b => on(b, "click", ()=>{ valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); doc.style.valign=b.dataset.valign; autoSizeAllIfOn(); render(0,getTotalSeconds()); fitZoom(); }));

/* ---------- left panel actions ---------- */
on(resSel,"change", ()=>{
  const [w,h] = resSel.value.split("x").map(Number);
  doc.res = {w,h};
  buildBgGrid();
  showSolidTools(doc.bg?.type==="solid");
  autoSizeAllIfOn();
  render(0,getTotalSeconds()); fitZoom();
});
on(addLineBtn,"click", ()=>{
  pushHistory();
  doc.lines.push({words:[{text:""}]});
  selected = { line: doc.lines.length-1, word: 0, caret: 0 };
  render(0,getTotalSeconds());
});
on(addWordBtn,"click", ()=>{
  pushHistory();
  const line = doc.lines[selected?.line ?? 0] || doc.lines[0];
  line.words.push({text:""});
  selected = { line: doc.lines.indexOf(line), word: line.words.length-1, caret: 0 };
  render(0,getTotalSeconds());
});
on(undoBtn, "click", undo);
on(redoBtn, "click", redo);
on(clearAllBtn, "click", ()=>{ pushHistory(); doc.lines = [{words:[{text:""}]}]; selected={line:0,word:0,caret:0}; render(0,getTotalSeconds()); });

/* ---------- init ---------- */
function init(){
  rebuildTextSwatches();
  rebuildBgSwatches();
  buildBgGrid();
  showSolidTools(false);
  setMode("edit");
  autoSizeAllIfOn();
  render(0,getTotalSeconds());
  fitZoom();
  accFont.open = true;
  buildAnimUI();
}
init();
