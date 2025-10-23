/* =======================================================
   LED Backpack Animator — app.js (Part 1 of 4)
   Boot / helpers / DOM / state / undo-redo / BG presets
   grid + solid color + upload / zoom / inspector / IO
   ======================================================= */

/* ---------- global error (quiet, non-blocking) ---------- */
window.addEventListener("error", (e) => {
  console.error("JS error:", e?.error?.message || e.message, e);
});

/* ---------- helpers ---------- */
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ---------- DOM ---------- */
const canvas  = $("#led");
const ctx     = canvas.getContext("2d");
const wrap    = $(".canvas-wrap");

const resSel      = $("#resSelect");
const zoomSlider  = $("#zoom");
const fitBtn      = $("#fitBtn");

const modeEditBtn   = $("#modeEdit");
const modePreviewBtn= $("#modePreview");

const inspectorToggle = $("#toggleInspector");
const inspectorBody   = $("#inspectorBody");
const pillTabs  = $$(".pill[data-acc]");

const accFont   = $("#accFont");
const accLayout = $("#accLayout");
const accAnim   = $("#accAnim");
const accConfig = $("#accConfig");
const accRender = $("#accRender");

const bgPanel      = $("#bgPanel");
const bgGrid       = $("#bgGrid");
const bgSolidTools = $("#bgSolidTools");
const bgSolidColor = $("#bgSolidColor");
const addBgSwatchBtn = $("#addBgSwatchBtn");
const bgSwatches   = $("#bgSwatches");
const bgUpload     = $("#bgUpload");

const progressBar = $("#progress");
const tCur = $("#tCur");
const tEnd = $("#tEnd");

const multiSelectBtn = $("#multiSelectBtn");

const addWordBtn   = $("#addWordBtn");
const addLineBtn   = $("#addLineBtn");
const delWordBtn   = $("#deleteWordBtn");

const fontSelect   = $("#fontSelect");
const fontSizeInp  = $("#fontSize");
const autoSizeChk  = $("#autoSize");
const fontColorInp = $("#fontColor");
const addSwatchBtn = $("#addSwatchBtn");
const textSwatches = $("#swatches");

const lineGapInp   = $("#lineGap");
const wordGapInp   = $("#wordGap");
const alignBtns    = $$("[data-align]");
const valignBtns   = $$("[data-valign]");

const animList     = $("#animList");
const applySelectedAnimBtn = $("#applySelectedAnimBtn");
const applyAllAnimBtn      = $("#applyAllAnimBtn");

const fileNameInput = $("#fileName");
const fpsInput      = $("#fps");
const secondsInput  = $("#seconds");
const gifPreviewImg = $("#gifPreview");
const previewBtn    = $("#previewRenderBtn");
const gifBtn        = $("#gifRenderBtn");

const saveJsonBtn   = $("#saveJsonBtn");
const loadJsonInput = $("#loadJsonInput");

const clearAllBtn   = $("#clearAllBtn");
const undoBtn       = $("#undoBtn");
const redoBtn       = $("#redoBtn");

/* ---------- small alias used later ---------- */
const progressFill = progressBar;

/* ---------- state ---------- */
let mode = "edit";
let zoom = 1;
let selected = null;          // { line, word } | null
let multiMode = false;        // UI toggle for multi-select button
let rafId = null;             // preview loop id
let startT = 0;               // preview loop start time (ms)

/* defaults */
const defaults = {
  font: "Orbitron",
  size: 22,
  color: "#FFFFFF",
  lineGap: 4,
  wordGap: 6,
  align: "center",
  valign: "middle"
};

/* document model */
let doc = {
  res: { w:96, h:128 },
  lines: [
    { words:[{ text:"WILL", color:"#FFFFFF", font:"Orbitron", size:22 }] },
    { words:[{ text:"WHEELIE", color:"#FFFFFF", font:"Orbitron", size:22 }] },
    { words:[{ text:"FOR", color:"#FFFFFF", font:"Orbitron", size:22 }] },
    { words:[{ text:"BOOKTOK", color:"#FFFFFF", font:"Orbitron", size:22 }] },
    { words:[{ text:"GIRLIES", color:"#FFFFFF", font:"Orbitron", size:22 }] },
  ],
  bg: { type:"image", image:null, preset:"assets/presets/96x128/Preset_A.png", color:null },
  spacing:{ lineGap:4, wordGap:6 },
  style:{ align:"center", valign:"middle" },
  anims: [],     // global "edit buffer" animations (UI list)
  multi:new Set()
};

/* ---------- undo / redo ---------- */
const UNDO_MAX = 50;
const undoStack = [];
const redoStack = [];

function snapshot() {
  // drop image element references (not serializable / heavy)
  const bg = doc.bg ? {
    type: doc.bg.type,
    preset: doc.bg.preset || null,
    color: doc.bg.color || null,
    image: null
  } : null;

  // shallow-safe copy of doc
  const clone = JSON.parse(JSON.stringify({
    res: doc.res, lines: doc.lines, spacing: doc.spacing, style: doc.style,
    anims: doc.anims, bg, multi: Array.from(doc.multi || [])
  }));
  return clone;
}
function restore(state){
  // replace doc with restored values
  const wasPreset = state?.bg?.preset;
  doc.res = {...state.res};
  doc.lines = JSON.parse(JSON.stringify(state.lines || []));
  doc.spacing = {...(state.spacing||{})};
  doc.style = {...(state.style||{})};
  doc.anims = JSON.parse(JSON.stringify(state.anims||[]));
  doc.multi = new Set(state.multi || []);
  doc.bg = { type: state.bg?.type || "solid", color: state.bg?.color || "#000", preset: wasPreset || null, image:null };

  // if a preset is specified, lazy-load the image
  if (doc.bg.preset) {
    const im = new Image(); im.crossOrigin="anonymous"; im.src = doc.bg.preset;
    im.onload = ()=>{ doc.bg.image = im; render(0, getDuration()); };
  }
  selected = null;
  render(0, getDuration());
  updateUndoRedoButtons();
}
function pushUndo(label="change") {
  undoStack.push(snapshot());
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  // any new op clears redo stack
  redoStack.length = 0;
  updateUndoRedoButtons();
}
function doUndo(){
  if (!undoStack.length) return;
  const cur = snapshot();
  const prev = undoStack.pop();
  redoStack.push(cur);
  restore(prev);
  updateUndoRedoButtons();
}
function doRedo(){
  if (!redoStack.length) return;
  const cur = snapshot();
  const next = redoStack.pop();
  undoStack.push(cur);
  restore(next);
  updateUndoRedoButtons();
}
function updateUndoRedoButtons(){
  if (undoBtn) undoBtn.disabled = (undoStack.length===0);
  if (redoBtn) redoBtn.disabled = (redoStack.length===0);
}

/* ---------- Presets (2×2 grid: 2 presets + Solid + Upload) ---------- */
const PRESETS = {
  "96x128": [
    { id:"A", thumb:"assets/thumbs/Preset_A_thumb.png", full:"assets/presets/96x128/Preset_A.png" },
    { id:"B", thumb:"assets/thumbs/Preset_B_thumb.png", full:"assets/presets/96x128/Preset_B.png" }
  ],
  "64x64": [
    { id:"C", thumb:"assets/thumbs/Preset_C_thumb.png", full:"assets/presets/64x64/Preset_C.png" },
    { id:"D", thumb:"assets/thumbs/Preset_D_thumb.png", full:"assets/presets/64x64/Preset_D.png" }
  ]
};
function visibleSet(){ return PRESETS[`${doc.res.w}x${doc.res.h}`] || []; }

function showSolidTools(show){ bgSolidTools?.classList.toggle("hidden", !show); }

function buildBgGrid(){
  if (!bgGrid) return;
  bgGrid.innerHTML = "";
  const set = visibleSet();

  // Order: two presets + Solid + Upload
  const tiles = [
    set[0] && { ...set[0], kind:"preset" },
    set[1] && { ...set[1], kind:"preset" },
    { kind:"solid",  thumb:"assets/thumbs/Solid_thumb.png" },
    { kind:"upload", thumb:"assets/thumbs/Upload_thumb.png" }
  ].filter(Boolean);

  tiles.forEach(t=>{
    const b=document.createElement("button");
    b.type="button"; b.className="bg-tile"; b.dataset.kind=t.kind;
    const img=document.createElement("img");
    img.loading="lazy";
    img.src=t.thumb; img.alt=t.kind;
    b.appendChild(img);

    on(b,"click",async()=>{
      $$(".bg-tile",bgGrid).forEach(x=>x.classList.remove("active"));
      b.classList.add("active");

      pushUndo("bg-change");

      if(t.kind==="preset"){
        const im=new Image(); im.crossOrigin="anonymous"; im.src=t.full;
        try{ await im.decode(); }catch{}
        doc.bg={type:"image",color:null,image:im,preset:t.full};
        showSolidTools(false);
        render(0, getDuration());
      }else if(t.kind==="solid"){
        doc.bg={type:"solid",color:bgSolidColor?.value||"#000000",image:null,preset:null};
        showSolidTools(true);
        render(0, getDuration());
      }else if(t.kind==="upload"){
        bgUpload?.click();
      }
    });
    bgGrid.appendChild(b);
  });

  // mark first active (visual)
  const first=$(".bg-tile",bgGrid);
  if(first) first.classList.add("active");
}

on(bgUpload,"change",(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=()=>{
    URL.revokeObjectURL(url);
    pushUndo("bg-upload");
    doc.bg={type:"image",color:null,image:im,preset:null};
    showSolidTools(false);
    render(0, getDuration());
  };
  im.src=url;
});

/* ---------- BG swatches (layout = swatches above custom color row) ---------- */
const defaultBgPalette = ["#000000","#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF"];
let customBgPalette = [];

function rebuildBgSwatches(){
  if (!bgSwatches) return;
  bgSwatches.innerHTML = "";
  [...defaultBgPalette, ...customBgPalette].forEach(c=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="swatch";
    b.title=c;
    b.style.setProperty("--swatch-color", c);
    on(b,"click",()=>{
      pushUndo("bg-color");
      doc.bg={type:"solid", color:c, image:null, preset:null};
      showSolidTools(true);
      if (bgSolidColor) bgSolidColor.value = c;
      render(0, getDuration());
    });
    bgSwatches.appendChild(b);
  });
}
on(addBgSwatchBtn,"click",()=>{
  const c = bgSolidColor?.value || "#000000";
  if (!defaultBgPalette.includes(c) && !customBgPalette.includes(c)) {
    customBgPalette.push(c);
    rebuildBgSwatches();
  }
});
on(bgSolidColor,"input",()=>{
  pushUndo("bg-color-live");
  doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null};
  render(0, getDuration());
});

/* ---------- basic render (overridden in Part 3) ---------- */
function render(){
  // In Part 3 this becomes the full animated renderer.
  canvas.width = doc.res.w; canvas.height = doc.res.h;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (doc.bg?.type === "solid"){
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if (doc.bg?.image){
    try { ctx.drawImage(doc.bg.image,0,0,canvas.width,canvas.height); } catch{}
  } else if (doc.bg?.preset){
    const im = new Image(); im.crossOrigin="anonymous"; im.src = doc.bg.preset;
    im.onload=()=>{ doc.bg.image = im; render(0, getDuration()); };
  }
}

/* ---------- resolution + zoom/fit ---------- */
on(resSel,"change",()=>{
  pushUndo("res-change");
  const [w,h]=resSel.value.split("x").map(Number);
  doc.res={w,h};
  buildBgGrid();
  showSolidTools(doc.bg?.type==="solid");
  render(0, getDuration());
  fitZoom();
});

function setZoom(z){
  zoom=z;
  if (zoomSlider) zoomSlider.value = String(z.toFixed(2));
  if (canvas) canvas.style.transform=`translate(-50%,-50%) scale(${z})`;
}
function fitZoom(){
  const pad=18;
  const r=wrap.getBoundingClientRect();
  const availW=Math.max(40, r.width - pad*2);
  const availH=Math.max(40, r.height - pad*2);
  const s=Math.max(0.2, Math.min(availW/doc.res.w, availH/doc.res.h));
  setZoom(s);
}
on(zoomSlider,"input",(e)=> setZoom(parseFloat(e.target.value)));
on(fitBtn,"click",fitZoom);
window.addEventListener("resize",fitZoom);
window.addEventListener("orientationchange",()=> setTimeout(fitZoom,200));

/* ---------- inspector (collapsible + pills) ---------- */
on(inspectorToggle,"click",()=>{
  const open = !inspectorBody.classList.contains("open");
  inspectorBody.classList.toggle("open", open);
  inspectorToggle.setAttribute("aria-expanded", String(open));
});

function openOnly(detailsEl){
  [accFont, accLayout, accAnim, accConfig, accRender].forEach(d => { if (d) d.open = (d === detailsEl); });
}
pillTabs.forEach(p=>{
  on(p,"click",()=>{
    const id = p.dataset.acc;
    const target = document.getElementById(id);
    if (!target) return;
    pillTabs.forEach(x=>x.classList.toggle("active", x===p));
    inspectorBody.classList.add("open");
    inspectorToggle.setAttribute("aria-expanded","true");
    openOnly(target);
  });
});

/* ---------- multi-select button ---------- */
on(multiSelectBtn,"click",()=>{
  multiMode = !multiMode;
  multiSelectBtn.classList.toggle("active", multiMode);
});

/* ---------- Clear / Undo / Redo ---------- */
on(clearAllBtn,"click", ()=>{
  pushUndo("clear-all");
  doc.lines = [{ words:[{ text:"HELLO", color:defaults.color, font:defaults.font, size:defaults.size }] }];
  doc.multi.clear();
  selected = null;
  render(0, getDuration());
});

on(undoBtn,"click", doUndo);
on(redoBtn,"click", doRedo);

/* ---------- Import / Export Config ---------- */
on(saveJsonBtn,"click",()=>{
  // export a clean snapshot
  const json = JSON.stringify(snapshot(), null, 2);
  const blob = new Blob([json], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "led-backpack-config.json";
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 5000);
});

on(loadJsonInput,"change", async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  try{
    const text = await f.text();
    const obj = JSON.parse(text);
    pushUndo("import-config");
    restore(obj);
  }catch(err){
    console.error("Import failed:", err);
  }finally{
    e.target.value = "";
  }
});

/* ---------- helpers used by later parts ---------- */
function getFPS(){
  const v = parseInt(fpsInput?.value || "15", 10);
  return Math.max(1, Math.min(30, v || 15));
}
function getDuration(){
  const v = parseInt(secondsInput?.value || "8", 10);
  return Math.max(1, Math.min(60, v || 8));
}

/* ---------- init ---------- */
function init(){
  // initial undo baseline
  undoStack.length = 0;
  redoStack.length = 0;
  undoStack.push(snapshot());
  updateUndoRedoButtons();

  buildBgGrid();
  rebuildBgSwatches();
  showSolidTools(doc.bg?.type === "solid");
  render(0, getDuration());
  fitZoom();

  // inspector default: open container, only Font visible
  if (inspectorBody) inspectorBody.classList.add("open");
  openOnly(accFont);
}
init();

/* ===== End of Part 1 ===== */
/* =======================================================
   LED Backpack Animator — app.js (Part 2 of 4)
   Text editing, CARET engine, selection (multi-select),
   auto-size, font/color/spacing/alignment,
   full animations panel + bulk apply
   ======================================================= */

/* ---------- extra DOM refs used in Part 2 ---------- */
const addWordBtn   = $("#addWordBtn");
const addLineBtn   = $("#addLineBtn");
const delWordBtn   = $("#deleteWordBtn");

const fontSelect   = $("#fontSelect");
const fontSizeInp  = $("#fontSize");
const autoSizeChk  = $("#autoSize");
const fontColorInp = $("#fontColor");
const addSwatchBtn = $("#addSwatchBtn");
const textSwatches = $("#swatches");

const lineGapInp   = $("#lineGap");
const wordGapInp   = $("#wordGap");
const alignBtns    = $$("[data-align]");
const valignBtns   = $$("[data-valign]");

const animList     = $("#animList");

/* ---------- selection & key helpers ---------- */
function keyOf(li, wi){ return `${li}:${wi}`; }

/* ---------- measure helpers ---------- */
function measureTextWithFont(text, size, font){
  ctx.font = `${size}px ${font}`;
  return ctx.measureText(text).width;
}
function measureText(w){
  return measureTextWithFont(w.text || "", (w.size || defaults.size), (w.font || defaults.font));
}
function lineHeight(line){
  return Math.max(12, ...line.words.map(w => (w.size || defaults.size)));
}
function totalHeight(){
  return doc.lines.map(lineHeight).reduce((s,h)=>s+h,0) + (doc.lines.length-1)*(doc.spacing.lineGap||defaults.lineGap);
}
function lineWidth(line){
  const gap = doc.spacing.wordGap ?? defaults.wordGap;
  return line.words.reduce((s,w)=> s + measureText(w), 0) + Math.max(0,line.words.length-1)*gap;
}

/* =======================================================
   CARET / TYPING ENGINE
   - click inside word to set caret char-index
   - blink caret
   - insert/backspace/delete
   - arrow/home/end navigation
   - when multi-select is active, typing appends to each selected word
   ======================================================= */
const CARET_BLINK_MS = 500;
let caret = {
  li: 0, wi: 0, ci: 0, // line index, word index, char index within word
  show: true,
  lastBlink: performance.now()
};

function setCaret(li, wi, ci=0){
  caret.li = li; caret.wi = wi;
  const w = doc.lines[li]?.words[wi];
  caret.ci = Math.max(0, Math.min((w?.text||"").length, ci));
  caret.show = true; caret.lastBlink = performance.now();
}

function resetBlink(){
  caret.show = true;
  caret.lastBlink = performance.now();
}

function updateCaretBlink(now){
  if (now - caret.lastBlink >= CARET_BLINK_MS){
    caret.show = !caret.show;
    caret.lastBlink = now;
  }
}

function wordCharXAtIndex(w, baseX, fontSpec, idx){
  // width of substring up to idx
  ctx.font = fontSpec;
  const text = w.text || "";
  const sub = text.slice(0, idx);
  return baseX + Math.ceil(ctx.measureText(sub).width);
}

function hitIndexInWord(w, baseX, fontSpec, px){
  // find closest char index for hit x
  ctx.font = fontSpec;
  const t = w.text || "";
  let low=0, high=t.length;
  // linear scan is fine (short words); binary also ok. Use linear for simplicity:
  let bestIdx = 0, bestDist = Infinity;
  for (let i=0;i<=t.length;i++){
    const x = wordCharXAtIndex(w, baseX, fontSpec, i);
    const d = Math.abs(px - x);
    if (d < bestDist){ bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

/* ---------- auto-size (per line) ---------- */
function autoSizeAllIfOn(){
  if(!autoSizeChk?.checked) return;
  const padX = 6, padY = 6;
  const maxW = doc.res.w - padX*2;
  const maxH = doc.res.h - padY*2;
  const L = Math.max(1, doc.lines.length);
  const lineGap = doc.spacing.lineGap ?? defaults.lineGap;

  const perLineH = (maxH - (L-1)*lineGap)/L;

  doc.lines.forEach(line=>{
    let size = Math.floor(perLineH); if (!isFinite(size)) size = defaults.size;
    for(let s=size; s>=6; s-=0.5){
      // simulate widths with this size
      const gap = doc.spacing.wordGap ?? defaults.wordGap;
      let w= -gap;
      for(const word of line.words){
        ctx.font = `${s}px ${word.font || defaults.font}`;
        w += ctx.measureText(word.text||"").width + gap;
      }
      if (w <= maxW){ line.words.forEach(word=> word.size = s); break; }
    }
  });
}

/* ---------- ANIMATIONS: defs & conflicts ---------- */
const ANIMS = [
  { id:"slide",      name:"Slide In",             params:{direction:"Left",  speed:1} },
  { id:"slideaway",  name:"Slide Away",           params:{direction:"Left",  speed:1} },
  { id:"zoom",       name:"Zoom",                 params:{direction:"In",    speed:1} },
  { id:"scroll",     name:"Scroll / Marquee",     params:{direction:"Left",  speed:1} },
  { id:"pulse",      name:"Glow Pulse",           params:{intensity:0.6} },  // renamed for clarity; our runtime treats as glow
  { id:"wave",       name:"Wave",                 params:{ax:0.8, ay:1.4, cycles:1.0} },
  { id:"jitter",     name:"Jitter",               params:{amp:0.10, freq:2.5} },
  { id:"shake",      name:"Shake",                params:{amp:0.20, freq:2} },
  { id:"colorcycle", name:"Color Cycle",          params:{speed:0.5, start:"#ff0000"} },
  { id:"rainbow",    name:"Rainbow Sweep",        params:{speed:0.5, start:"#ff00ff"} },
  { id:"sweep",      name:"Highlight Sweep",      params:{speed:0.7, width:0.25} },
  { id:"flicker",    name:"Flicker",              params:{strength:0.5} },
  { id:"strobe",     name:"Strobe",               params:{rate:3} },
  { id:"glow",       name:"Glow Pulse",           params:{intensity:0.6} },
  { id:"heartbeat",  name:"Heartbeat",            params:{rate:1.2} },
  { id:"ripple",     name:"Ripple",               params:{amp:1.0, freq:2.0} },
  { id:"typewriter", name:"Typewriter",           params:{rate:1} },
  { id:"scramble",   name:"Scramble / Decode",    params:{rate:1} },
  { id:"popcorn",    name:"Popcorn",              params:{rate:1} },
  { id:"fadeout",    name:"Fade Out",             params:{} },
];
const CONFLICTS = [
  ["typewriter","scramble"],
  ["typewriter","popcorn"],
  ["strobe","flicker"],
  ["rainbow","colorcycle"],
];

/* ---------- anim helpers ---------- */
function animDef(id){ return ANIMS.find(a=>a.id===id); }
function cloneAnims(src){ return src.map(a=>({ id:a.id, params:{...a.params} })); }
function resolveWordAnims(word){
  // prefer per-word anims; fallback to doc-wide anims (doc.anims)
  return (word.anims && word.anims.length) ? word.anims : (doc.anims || []);
}

/* ---------- color helpers for animated props ---------- */
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function colorToHue(hex){
  const c = (hex||"#fff").replace("#","");
  const r=parseInt(c.slice(0,2)||"ff",16)/255,
        g=parseInt(c.slice(2,4)||"ff",16)/255,
        b=parseInt(c.slice(4,6)||"ff",16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0; if(max!==min){ const d=max-min;
    switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}
    h/=6;
  }
  return Math.round(h*360);
}

/* ---------- animation runtime ---------- */
function animatedProps(base, word, t, totalDur){
  const props = { x:base.x, y:base.y, scale:1, alpha:1, text:word.text||"", color:word.color, dx:0, dy:0, shadow:null, gradient:null, perChar:null };

  const active = resolveWordAnims(word);
  const get = id => active.find(a=>a.id===id);

  // Scroll
  const scroll = get("scroll");
  if (scroll) {
    const dir = (scroll.params.direction || "Left");
    const sp  = Number(scroll.params.speed || 1);
    const v = 20 * sp;
    if(dir==="Left")  props.dx -= (t * v) % (doc.res.w + 200);
    if(dir==="Right") props.dx += (t * v) % (doc.res.w + 200);
    if(dir==="Up")    props.dy -= (t * v) % (doc.res.h + 200);
    if(dir==="Down")  props.dy += (t * v) % (doc.res.h + 200);
  }

  // Zoom
  const zm = get("zoom");
  if (zm) {
    const dir = (zm.params.direction || "In");
    const sp  = Number(zm.params.speed || 1);
    const k = 0.4 * sp;
    props.scale *= (dir === "In")
      ? (1 + k * easeOutCubic(Math.min(1, t / 1)))
      : Math.max(0.2, 1 + k * (1 - Math.min(1, t / 1)) * (-1));
  }

  // Slide In
  const slide = get("slide");
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

  // Slide Away
  const slideaway = get("slideaway");
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

  // Fade Out
  const fout = get("fadeout");
  if (fout && totalDur) {
    const tail = 0.2 * totalDur;
    if (t > totalDur - tail) {
      const r = (t - (totalDur - tail)) / tail;
      props.alpha *= Math.max(0, 1 - r);
    }
  }

  // Glow Pulse (glow)
  const glow = get("glow") || get("pulse");
  if (glow) {
    const intensity = Math.max(0, Number(glow.params.intensity || 0.6));
    const k = (Math.sin(t * 2 * Math.PI * 1.2) * 0.5 + 0.5) * intensity;
    props.shadow = { blur: 6 + k * 10, color: props.color || word.color };
  }

  // Wave
  const wave = get("wave");
  if (wave) {
    const ax = Number(wave.params.ax || 0.8);
    const ay = Number(wave.params.ay || 1.4);
    const cyc= Number(wave.params.cycles || 1.0);
    const ph = cyc * 2 * Math.PI * t;
    props.dx += Math.sin(ph + base.x * 0.05) * ax * 4;
    props.dy += Math.sin(ph + base.y * 0.06) * ay * 4;
  }

  // Jitter
  const jit = get("jitter");
  if (jit) {
    const a = Number(jit.params.amp || 0.10), f = Number(jit.params.freq || 2.5);
    props.dx += Math.sin(t * 2 * Math.PI * f) * a * 3;
    props.dy += Math.cos(t * 2 * Math.PI * f) * a * 3;
  }

  // Shake
  const shake = get("shake");
  if (shake) {
    const a = Number(shake.params.amp || 0.20) * 5, f = Number(shake.params.freq || 2);
    props.dx += Math.sin(t * 2 * Math.PI * f) * a;
    props.dy += Math.cos(t * 2 * Math.PI * f) * a * 0.6;
  }

  // Typewriter
  const type = get("typewriter");
  if (type && props.text) {
    const rate = Number(type.params.rate || 1);
    const cps  = 10 * rate;
    const shown = Math.max(0, Math.min(props.text.length, Math.floor(t * cps)));
    props.text = props.text.slice(0, shown);
  }

  // Scramble
  const scr = get("scramble");
  if (scr && word.text) {
    const rate = Number(scr.params.rate || 1), cps = 10 * rate;
    const goal = word.text || ""; let out = "";
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

  // Popcorn per-char alpha flicker
  const pop = get("popcorn");
  if (pop && word.text) {
    const rate = Number(pop.params.rate || 1);
    const alphaArr = [];
    for (let i = 0; i < (word.text||"").length; i++) {
      const phase = Math.sin(2 * Math.PI * rate * t + i * 0.4);
      alphaArr.push(phase > 0 ? 1 : 0.25);
    }
    props.perChar ??= {}; props.perChar.alpha = alphaArr;
  }

  // Color Cycle
  const cc = get("colorcycle");
  if (cc) {
    const sp = Number(cc.params.speed || 0.5);
    const base = (cc.params.start || "#ff0000");
    const hueBase = colorToHue(base);
    const hue = Math.floor((hueBase + (t * 60 * sp)) % 360);
    props.color = `hsl(${hue}deg 100% 60%)`;
  }

  // Rainbow gradient
  const rainbow = get("rainbow");
  if (rainbow) {
    const speed = Number(rainbow.params.speed || 0.5);
    const base = (rainbow.params.start || "#ff00ff");
    const hueBase = colorToHue(base);
    props.gradient = { type: "rainbow", speed, base: hueBase };
  }

  // Highlight sweep gradient
  const sweep = get("sweep");
  if (sweep) {
    const speed = Number(sweep.params.speed || 0.7), width = Number(sweep.params.width || 0.25);
    props.gradient = { type: "sweep", speed, width };
  }

  // Flicker / Strobe (alpha)
  const flicker = get("flicker");
  if (flicker) {
    const str = Math.max(0, Math.min(1, Number(flicker.params.strength || 0.5)));
    const n = (Math.sin(t * 23.7) + Math.sin(t * 17.3)) * 0.25 + 0.5;
    props.alpha *= (1 - str * 0.6) + n * str * 0.6;
  }
  const strobe = get("strobe");
  if (strobe) {
    const rate = Number(strobe.params.rate || 3);
    const phase = Math.sin(2 * Math.PI * rate * t);
    props.alpha *= (phase > 0) ? 1 : 0.15;
  }

  // Ripple per-char Y offset
  const ripple = get("ripple");
  if (ripple && word.text) {
    const amp = Number(ripple.params.amp || 1.0) * 2.0;
    const freq= Number(ripple.params.freq || 2.0);
    const arr = [];
    for (let i = 0; i < (word.text||"").length; i++) arr.push(Math.sin(2 * Math.PI * freq * t + i * 0.6) * amp);
    props.perChar ??= {}; props.perChar.dy = arr;
  }

  return props;
}

/* ---------- FULL render (overrides Part 1 render) ---------- */
function render(t=0, totalDur=null){
  const W = canvas.width  = doc.res.w;
  const H = canvas.height = doc.res.h;

  // BG
  ctx.clearRect(0,0,W,H);
  if (doc.bg?.type === "solid") {
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,W,H);
  } else if (doc.bg?.image) {
    try { ctx.drawImage(doc.bg.image,0,0,W,H); } catch {}
  } else if (doc.bg?.preset) {
    const im = new Image(); im.crossOrigin="anonymous"; im.src = doc.bg.preset;
    im.onload = ()=>{ doc.bg.image = im; render(t,totalDur); };
  }

  // text & caret blink upkeep
  autoSizeAllIfOn();
  updateCaretBlink(performance.now());

  const lineGap = doc.spacing.lineGap ?? defaults.lineGap;
  const wordGap = doc.spacing.wordGap ?? defaults.wordGap;

  const heights = doc.lines.map(lineHeight);
  const contentH = heights.reduce((s,h)=>s+h,0) + (doc.lines.length-1)*lineGap;

  let y;
  if ((doc.style?.valign||defaults.valign) === "top") y = 4;
  else if ((doc.style?.valign||defaults.valign) === "bottom") y = H - contentH - 4;
  else y = (H - contentH)/2;

  doc.lines.forEach((line, li)=>{
    const lh = heights[li];
    const wLine = lineWidth(line);
    let x;
    const align = (doc.style?.align || defaults.align);
    if (align === "left") x = 4;
    else if (align === "right") x = W - wLine - 4;
    else x = (W - wLine)/2;

    line.words.forEach((w, wi)=>{
      const base = { x, y: y + lh*0.85 };

      // animated drawing
      const props = animatedProps(base, w, t, totalDur);
      const txt = props.text || "";

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, props.alpha));
      ctx.textBaseline="alphabetic";
      const fsize = (w.size||defaults.size) * (props.scale||1);
      const fontSpec = `${fsize}px ${w.font||defaults.font}`;
      ctx.font = fontSpec;

      if (props.shadow) { ctx.shadowBlur = props.shadow.blur; ctx.shadowColor = props.shadow.color || (w.color||defaults.color); }
      else ctx.shadowBlur = 0;

      // animated draw position
      const drawX = base.x + (props.dx||0);
      const drawY = base.y + (props.dy||0);

      // gradient fill
      let fillStyle = props.color || (w.color || defaults.color);
      if (props.gradient && txt.length) {
        const wordWidth = Math.ceil(ctx.measureText(txt).width);
        if (props.gradient.type === "rainbow") {
          const g = ctx.createLinearGradient(drawX, drawY, drawX + wordWidth, drawY);
          const baseHue = (props.gradient.base + (t * 120 * props.gradient.speed)) % 360;
          for (let i=0;i<=6;i++){ const stop=i/6; const hue=Math.floor((baseHue+stop*360)%360); g.addColorStop(stop, `hsl(${hue}deg 100% 60%)`); }
          fillStyle = g;
        } else if (props.gradient.type === "sweep") {
          const band = Math.max(0.05, Math.min(0.8, props.gradient.width || 0.25));
          const pos  = (t * (props.gradient.speed || 0.7) * 1.2) % 1;
          const g = ctx.createLinearGradient(drawX, drawY, drawX + wordWidth, drawY);
          const a = Math.max(0, pos - band/2), b = Math.min(1, pos + band/2);
          g.addColorStop(0, fillStyle); g.addColorStop(a, fillStyle);
          g.addColorStop(pos, "#FFFFFF"); g.addColorStop(b, fillStyle); g.addColorStop(1, fillStyle);
          fillStyle = g;
        }
      }
      ctx.fillStyle = fillStyle;

      // per-char?
      if (props.perChar && txt.length) {
        const widths = Array.from(txt).map(ch => { ctx.font = fontSpec; return Math.ceil(ctx.measureText(ch).width); });
        let cx = drawX;
        for (let i=0;i<txt.length;i++){
          const ch = txt[i];
          const dy = props.perChar.dy?.[i] || 0;
          const oa = ctx.globalAlpha;
          ctx.globalAlpha = oa * (props.perChar.alpha?.[i] ?? 1);
          ctx.fillText(ch, cx, drawY + dy);
          ctx.globalAlpha = oa;

          // CARET drawing (inside this word)
          const isCaretWord = (li===caret.li && wi===caret.wi && caret.show && mode==="edit");
          if (isCaretWord && caret.ci===i){
            const caretX = cx;
            drawCaret(caretX, drawY, fsize);
          }

          cx += widths[i];
        }
        // caret at end-of-word
        if (li===caret.li && wi===caret.wi && caret.show && caret.ci===txt.length && mode==="edit"){
          const endX = drawX + Math.ceil(ctx.measureText(txt).width);
          drawCaret(endX, drawY, fsize);
        }
      } else {
        // simple draw
        ctx.fillText(txt, drawX, drawY);

        // caret (no per-char anim case)
        if (li===caret.li && wi===caret.wi && caret.show && mode==="edit"){
          const caretX = wordCharXAtIndex(w, drawX, fontSpec, caret.ci);
          drawCaret(caretX, drawY, fsize);
        }
      }

      // selection boxes (visual aid)
      const thisKey = keyOf(li, wi);
      if (doc.multi.has(thisKey)) {
        // multi-select: cyan
        const ww = ctx.measureText(w.text||"").width;
        ctx.save();
        ctx.strokeStyle = "rgba(0,255,255,0.95)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3,2]);
        ctx.strokeRect(x-2, (y+lh*0.85)-lh, ww+4, lh+4);
        ctx.restore();
      } else if (selected && selected.line===li && selected.word===wi && mode==="edit") {
        // single: magenta
        const ww = ctx.measureText(w.text||"").width;
        ctx.save();
        ctx.strokeStyle = "rgba(255,0,255,0.95)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3,2]);
        ctx.strokeRect(x-2, (y+lh*0.85)-lh, ww+4, lh+4);
        ctx.restore();
      }

      // advance
      x += measureText(w) + wordGap;
      ctx.restore();
    });

    y += lh + lineGap;
  });
}

function drawCaret(x, baselineY, fsize){
  const h = Math.max(10, fsize * 0.95);
  const top = baselineY - h;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, baselineY + 2);
  ctx.stroke();
  ctx.restore();
}

/* ---------- clicking / selection with precise caret placement ---------- */
canvas.addEventListener("click",(e)=>{
  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)/zoom, py=(e.clientY-rect.top)/zoom;

  // hit test
  const lineGap = doc.spacing.lineGap ?? defaults.lineGap;
  const heights = doc.lines.map(lineHeight);
  const contentH = heights.reduce((s,h)=>s+h,0) + (doc.lines.length-1)*lineGap;
  let y;
  const valign = (doc.style?.valign || defaults.valign);
  if (valign==="top") y=4; else if (valign==="bottom") y=doc.res.h-contentH-4; else y=(doc.res.h-contentH)/2;

  let hit = null;
  for (let li=0; li<doc.lines.length; li++){
    const lh = heights[li];
    const wLine = lineWidth(doc.lines[li]);
    let x;
    const align = (doc.style?.align || defaults.align);
    if (align === "left") x = 4;
    else if (align === "right") x = doc.res.w - wLine - 4;
    else x = (doc.res.w - wLine)/2;

    for (let wi=0; wi<doc.lines[li].words.length; wi++){
      const w = doc.lines[li].words[wi];
      const ww = measureText(w);
      const bx = x-2, by = (y+lh*0.85)-lh, bw = ww+4, bh = lh+4;
      if (px>=bx && px<=bx+bw && py>=by && py<=by+bh){
        hit = { line:li, word:wi, baseX:x, lh };
        break;
      }
      x += ww + (doc.spacing.wordGap ?? defaults.wordGap);
    }
    if (hit) break;
    y += lh + lineGap;
  }

  if (hit) {
    const k = keyOf(hit.line, hit.word);
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      // toggle multi
      if (doc.multi.has(k)) doc.multi.delete(k);
      else doc.multi.add(k);
      selected = { line: hit.line, word: hit.word };
      // caret stays where it was (multi typically appends)
    } else {
      // single
      doc.multi.clear();
      selected = { line: hit.line, word: hit.word };

      // place caret at character index within this word
      const w = doc.lines[hit.line].words[hit.word];
      const fontSpec = `${w.size||defaults.size}px ${w.font||defaults.font}`;
      const ci = hitIndexInWord(w, hit.baseX, fontSpec, px);
      setCaret(hit.line, hit.word, ci);
    }
  } else {
    doc.multi.clear();
    selected = null;
  }
  render(0, null);
});

/* ---------- typing & navigation ---------- */
document.addEventListener("keydown",(e)=>{
  if (mode!=="edit") return;

  // MULTI-SELECT: typing appends to all selected words (simple & predictable)
  if (doc.multi.size && (e.key.length===1 || e.key==="Backspace" || e.key==="Delete")){
    e.preventDefault();
    doc.multi.forEach(k=>{
      const [li,wi] = k.split(":").map(Number);
      const w = doc.lines[li]?.words[wi]; if (!w) return;
      if (e.key.length===1 && !e.metaKey && !e.ctrlKey){
        w.text = (w.text||"") + e.key;
      } else if (e.key==="Backspace"){
        w.text = (w.text||"").slice(0,-1);
      } else if (e.key==="Delete"){
        // no-op for simple multi delete
      }
    });
    autoSizeAllIfOn();
    render(0,null);
    return;
  }

  // SINGLE selection caret editing
  if (!selected) return;
  const w = doc.lines[selected.line]?.words[selected.word]; if (!w) return;

  // navigation keys
  if (e.key === "ArrowLeft"){
    if (caret.ci > 0) { caret.ci--; resetBlink(); render(0,null); }
    e.preventDefault(); return;
  }
  if (e.key === "ArrowRight"){
    if (caret.ci < (w.text||"").length) { caret.ci++; resetBlink(); render(0,null); }
    e.preventDefault(); return;
  }
  if (e.key === "Home"){
    caret.ci = 0; resetBlink(); render(0,null);
    e.preventDefault(); return;
  }
  if (e.key === "End"){
    caret.ci = (w.text||"").length; resetBlink(); render(0,null);
    e.preventDefault(); return;
  }

  // insert/delete
  if (e.key.length===1 && !e.metaKey && !e.ctrlKey){
    e.preventDefault();
    const t = w.text || "";
    w.text = t.slice(0, caret.ci) + e.key + t.slice(caret.ci);
    caret.ci += 1;
    autoSizeAllIfOn();
    resetBlink();
    render(0,null);
    return;
  }
  if (e.key==="Backspace"){
    e.preventDefault();
    const t = w.text || "";
    if (caret.ci > 0){
      w.text = t.slice(0, caret.ci-1) + t.slice(caret.ci);
      caret.ci -= 1;
      autoSizeAllIfOn();
      resetBlink();
      render(0,null);
    }
    return;
  }
  if (e.key==="Delete"){
    e.preventDefault();
    const t = w.text || "";
    if (caret.ci < t.length){
      w.text = t.slice(0, caret.ci) + t.slice(caret.ci+1);
      autoSizeAllIfOn();
      resetBlink();
      render(0,null);
    }
    return;
  }
});

/* ---------- add / line / delete ---------- */
addWordBtn && addWordBtn.addEventListener("click",()=>{
  const li = selected ? selected.line : (doc.lines.length-1);
  const line = doc.lines[li] || (doc.lines[li]={words:[]});
  line.words.push({ text:"NEW", color:defaults.color, font:defaults.font, size:defaults.size });
  selected = { line: li, word: line.words.length-1 };
  setCaret(selected.line, selected.word, (doc.lines[li].words.at(-1).text || "").length);
  render(0,null);
});
addLineBtn && addLineBtn.addEventListener("click",()=>{
  doc.lines.push({ words:[{ text:"LINE", color:defaults.color, font:defaults.font, size:defaults.size }] });
  selected = { line: doc.lines.length-1, word: 0 };
  setCaret(selected.line, selected.word, (doc.lines.at(-1).words[0].text||"").length);
  render(0,null);
});
delWordBtn && delWordBtn.addEventListener("click",()=>{
  if (!selected) return;
  const line = doc.lines[selected.line];
  line.words.splice(selected.word,1);
  if (!line.words.length) doc.lines.splice(selected.line,1);
  doc.multi.clear();
  selected = null;
  render(0,null);
});

/* ---------- font / size / color ---------- */
function forEachSelectedWord(fn){
  if (doc.multi.size){
    doc.multi.forEach(k=>{
      const [li,wi] = k.split(":").map(Number);
      const w = doc.lines[li]?.words[wi]; if (w) fn(w, li, wi);
    });
  } else if (selected){
    const w = doc.lines[selected.line]?.words[selected.word];
    if (w) fn(w, selected.line, selected.word);
  }
}
fontSelect && fontSelect.addEventListener("change",()=>{
  forEachSelectedWord(w=>{ w.font = fontSelect.value || defaults.font; });
  autoSizeAllIfOn(); render(0,null);
});
fontSizeInp && fontSizeInp.addEventListener("input",()=>{
  const v = Math.max(6, Math.min(64, parseInt(fontSizeInp.value||`${defaults.size}`,10)));
  forEachSelectedWord(w=>{ w.size = v; });
  render(0,null);
});
autoSizeChk && autoSizeChk.addEventListener("change",()=>{ autoSizeAllIfOn(); render(0,null); });
fontColorInp && fontColorInp.addEventListener("input",()=>{
  const c = fontColorInp.value || defaults.color;
  forEachSelectedWord(w=>{ w.color = c; });
  render(0,null);
});

/* ---------- text color swatches ---------- */
const defaultTextPalette = ["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customTextPalette = [];
function rebuildTextSwatches(){
  if (!textSwatches) return;
  textSwatches.innerHTML = "";
  // swatches first
  [...defaultTextPalette, ...customTextPalette].forEach(c=>{
    const b=document.createElement("button");
    b.type="button"; b.className="swatch"; b.style.background=c; b.title=c;
    b.addEventListener("click",()=>{
      if (fontColorInp) fontColorInp.value = c;
      forEachSelectedWord(w=>{ w.color = c; });
      render(0,null);
    });
    b.addEventListener("contextmenu",(e)=>{
      e.preventDefault();
      const idx = customTextPalette.indexOf(c);
      if (idx>=0){ customTextPalette.splice(idx,1); rebuildTextSwatches(); }
    });
    textSwatches.appendChild(b);
  });
}
addSwatchBtn && addSwatchBtn.addEventListener("click",()=>{
  const c = fontColorInp?.value || defaults.color;
  if (!defaultTextPalette.includes(c) && !customTextPalette.includes(c)) customTextPalette.push(c);
  rebuildTextSwatches();
});
rebuildTextSwatches();

/* ---------- spacing & alignment ---------- */
lineGapInp && lineGapInp.addEventListener("input",()=>{
  doc.spacing.lineGap = Math.max(0, Math.min(40, parseInt(lineGapInp.value||"4",10)));
  autoSizeAllIfOn(); render(0,null);
});
wordGapInp && wordGapInp.addEventListener("input",()=>{
  doc.spacing.wordGap = Math.max(0, Math.min(40, parseInt(wordGapInp.value||"6",10)));
  autoSizeAllIfOn(); render(0,null);
});
alignBtns.forEach(b=> b.addEventListener("click",()=>{
  alignBtns.forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  doc.style ??= {};
  doc.style.align = b.dataset.align || "center";
  render(0,null);
}));
valignBtns.forEach(b=> b.addEventListener("click",()=>{
  valignBtns.forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  doc.style ??= {};
  doc.style.valign = b.dataset.valign || "middle";
  render(0,null);
}));

/* ---------- Animations UI (with multi-select + bulk apply) ---------- */
function conflictsFiltered(list){
  return list.filter(a=>{
    const hasConflict = list.some(b=> b.id!==a.id && CONFLICTS.some(pair=> pair.includes(a.id) && pair.includes(b.id)));
    // keep both by default; last wins visually—UI keeps it simple
    return true;
  });
}

function buildAnimationsUI(){
  if (!animList) return;
  animList.innerHTML = "";

  // Controls bar: Select All / Line / Clear + Apply to Selection + Apply to All
  const bar = document.createElement("div");
  bar.className = "anim-controls";
  bar.innerHTML = `
    <div class="anim-bulk">
      <button type="button" class="button tiny" id="msSelectAll">Select All Words</button>
      <button type="button" class="button tiny" id="msSelectLine">Select Line</button>
      <button type="button" class="button tiny" id="msClear">Clear Selection</button>
      <span class="sep"></span>
      <button type="button" class="button tiny" id="applyToSel">Apply Animations → Selection</button>
      <button type="button" class="button tiny" id="applyToAll">Apply Animations → All Words</button>
      <span class="hint">Tip: multi-select = <b style="color:#0ff;">cyan</b> outlines; single = <b style="color:#f0f;">magenta</b>.</span>
    </div>
  `;
  animList.appendChild(bar);

  const list = document.createElement("div");
  list.className = "anim-rows";
  animList.appendChild(list);

  // Current global anims model used as "edit buffer"
  doc.anims = doc.anims || [];

  ANIMS.forEach(def=>{
    const row = document.createElement("div");
    row.className = "anim-row";

    const left = document.createElement("div");
    left.className = "anim-left";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.id = `anim_${def.id}`;
    chk.checked = !!doc.anims.find(a=>a.id===def.id);

    const lbl = document.createElement("label");
    lbl.setAttribute("for", chk.id);
    lbl.textContent = def.name;

    const gear = document.createElement("button");
    gear.type="button"; gear.className="button tiny"; gear.textContent="⚙";
    gear.title = "Parameters";

    left.appendChild(chk);
    left.appendChild(lbl);
    left.appendChild(gear);

    const params = document.createElement("div");
    params.className = "anim-params";
    params.style.display = chk.checked ? "block" : "none";

    // build params controls
    const cur = doc.anims.find(a=>a.id===def.id)?.params || def.params;
    Object.entries(def.params).forEach(([k,v])=>{
      const p = document.createElement("div"); p.className="p";
      const la = document.createElement("label"); la.textContent = k[0].toUpperCase()+k.slice(1);
      let inp;
      if (k==="direction"){
        inp = document.createElement("select");
        const opts = (def.id==="zoom") ? ["In","Out"] : ["Left","Right","Up","Down"];
        opts.forEach(op=>{
          const o=document.createElement("option"); o.value=op; o.textContent=op;
          if ((cur[k]??v)===op) o.selected = true;
          inp.appendChild(o);
        });
      } else if (k==="start"){
        inp = document.createElement("input"); inp.type="color"; inp.value = cur[k] ?? v;
      } else {
        inp = document.createElement("input"); inp.type="number"; inp.step="0.1"; inp.value = cur[k] ?? v;
      }
      inp.addEventListener("input",()=>{
        const a = doc.anims.find(x=>x.id===def.id);
        if (a) a.params[k] = (inp.type==="number") ? +inp.value : inp.value;
        render(0,null);
      });
      p.appendChild(la); p.appendChild(inp); params.appendChild(p);
    });

    chk.addEventListener("change",()=>{
      const has = !!doc.anims.find(a=>a.id===def.id);
      if (chk.checked && !has){
        doc.anims.push({ id:def.id, params:{...def.params} });
        params.style.display = "block";
      } else if (!chk.checked && has){
        doc.anims = doc.anims.filter(a=>a.id!==def.id);
        params.style.display = "none";
      }
      render(0,null);
    });
    gear.addEventListener("click",()=> params.style.display = params.style.display==="none" ? "block" : "none");

    row.appendChild(left);
    row.appendChild(params);
    list.appendChild(row);
  });

  // bulk buttons bindings
  $("#msSelectAll")?.addEventListener("click", ()=>{
    doc.multi.clear();
    doc.lines.forEach((line,li)=> line.words.forEach((_,wi)=> doc.multi.add(keyOf(li,wi))));
    render(0,null);
  });
  $("#msSelectLine")?.addEventListener("click", ()=>{
    if (!selected) return;
    doc.multi.clear();
    const li = selected.line;
    doc.lines[li].words.forEach((_,wi)=> doc.multi.add(keyOf(li,wi)));
    render(0,null);
  });
  $("#msClear")?.addEventListener("click", ()=>{
    doc.multi.clear(); render(0,null);
  });

  $("#applyToSel")?.addEventListener("click", ()=>{
    const pack = cloneAnims(conflictsFiltered(doc.anims));
    if (doc.multi.size){
      doc.multi.forEach(k=>{
        const [li,wi]=k.split(":").map(Number);
        const w = doc.lines[li]?.words[wi]; if (w) w.anims = cloneAnims(pack);
      });
    } else if (selected){
      const w = doc.lines[selected.line]?.words[selected.word];
      if (w) w.anims = cloneAnims(pack);
    }
    render(0,null);
  });

  $("#applyToAll")?.addEventListener("click", ()=>{
    const pack = cloneAnims(conflictsFiltered(doc.anims));
    doc.lines.forEach(line=> line.words.forEach(w=> w.anims = cloneAnims(pack)));
    render(0,null);
  });
}
buildAnimationsUI();

// External bridge buttons (if present in toolbar)
$("#applySelectedAnimBtn")?.addEventListener("click", ()=> $("#applyToSel")?.click());
$("#applyAllAnimBtn")?.addEventListener("click", ()=> $("#applyToAll")?.click());
/* ===================== End of Part 2 of 4 ===================== */
/* =======================================================
   LED Backpack Animator — app.js (Part 3 of 4)
   Preview loop + progress UI + local GIF export
   ======================================================= */

/* ---------- DOM (used in this part) ---------- */
const previewBtn    = $("#previewRenderBtn");
const gifBtn        = $("#gifRenderBtn");
const fpsInput      = $("#fps");
const secondsInput  = $("#seconds");
const fileNameInput = $("#fileName");
const gifPreviewImg = $("#gifPreview");

const progressBarEl = $("#progress");  // inner bar that fills
const tCurEl        = $("#tCur");
const tEndEl        = $("#tEnd");

/* ---------- Small notify fallback (non-blocking) ---------- */
function notify(msg){
  // If you have a toast system, you can swap this out.
  // For now, keep it light + non-blocking:
  console.log("[INFO]", msg);
}

/* ---------- Helpers ---------- */
function getFPS() {
  const v = parseInt(fpsInput?.value || "15", 10);
  return Math.max(1, Math.min(30, v || 15));
}
function getDuration() {
  const v = parseInt(secondsInput?.value || "8", 10);
  return Math.max(1, Math.min(60, v || 8));
}
function setProgress(f01) {
  if (!progressBarEl) return;
  const p = Math.max(0, Math.min(1, f01 || 0));
  progressBarEl.style.width = `${p * 100}%`;
}
function setTimeLabels(curSec, endSec) {
  if (tCurEl) tCurEl.textContent = `${(curSec || 0).toFixed(1)}s`;
  if (tEndEl) tEndEl.textContent = `${(endSec || getDuration()).toFixed(1)}s`;
}

/* ---------- Preview Loop ---------- */
let rafId = null;
let startT_ms = 0;
let previewRunning = false;

function loopFrame(now_ms) {
  const dur = getDuration();
  const elapsed = (now_ms - startT_ms) / 1000;
  const t = elapsed % dur;

  render(t, dur);

  setProgress(t / dur);
  setTimeLabels(t, dur);

  rafId = requestAnimationFrame(loopFrame);
}

function startPreview() {
  if (previewRunning) return;
  previewRunning = true;
  startT_ms = performance.now();
  setTimeLabels(0, getDuration());
  setProgress(0);
  rafId = requestAnimationFrame(loopFrame);
  previewBtn?.classList.add("active");
  previewBtn && (previewBtn.textContent = "Stop Preview");
}

function stopPreview() {
  if (!previewRunning) return;
  previewRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  // Draw a stable first frame after stopping
  render(0, getDuration());
  setProgress(0);
  setTimeLabels(0, getDuration());
  previewBtn?.classList.remove("active");
  previewBtn && (previewBtn.textContent = "Render Preview");
}

function togglePreview() {
  if (previewRunning) stopPreview();
  else startPreview();
}

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
    // Ensure these files exist in your project:
    // ./assets/libs/jsgif/NeuQuant.js
    // ./assets/libs/jsgif/LZWEncoder.js
    // ./assets/libs/jsgif/GIFEncoder.js
    await loadScriptLocal("./assets/libs/jsgif/NeuQuant.js");
    await loadScriptLocal("./assets/libs/jsgif/LZWEncoder.js");
    await loadScriptLocal("./assets/libs/jsgif/GIFEncoder.js");
  } catch (e) {
    console.error("Local GIF libs failed to load", e);
    notify("GIF encoder libraries not found. Check ./assets/libs/jsgif/ files.");
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
  if (!ok) return;

  const fps = getFPS();
  const secs = getDuration();
  const frames = Math.max(1, Math.floor(fps * secs));
  const delay = Math.max(1, Math.round(1000 / fps));

  // Pause preview while exporting (so frames are deterministic)
  const resume = previewRunning;
  stopPreview();

  const W = canvas.width  = doc.res.w;
  const H = canvas.height = doc.res.h;

  try {
    const enc = new GIFEncoder();
    enc.setRepeat(0);   // loop forever
    enc.setDelay(delay);
    enc.setQuality(10);
    enc.setSize(W, H);
    enc.start();

    for (let i = 0; i < frames; i++) {
      const t = i / fps;
      render(t, secs);
      enc.addFrame(ctx);

      // progress UI during export
      setProgress((t % secs) / secs);
      setTimeLabels(t % secs, secs);
    }

    enc.finish();
    const blob = encoderToBlob(enc);
    const url = URL.createObjectURL(blob);

    // Show preview
    if (gifPreviewImg) {
      gifPreviewImg.classList.remove("hidden");
      gifPreviewImg.src = url;
      gifPreviewImg.alt = "Animated GIF preview";
    }

    // Download (desktop) or open in new tab (mobile → Save Image)
    const base = (fileNameInput?.value || "animation").replace(/\.(png|jpe?g|webp|gif)$/i, "");
    const name = `${base}.gif`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();

    // Free the blob URL later
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    notify("GIF export complete.");
  } catch (err) {
    console.error("GIF render failed:", err);
    notify("GIF render failed. See console for details.");
  } finally {
    setProgress(0);
    setTimeLabels(0, secs);
    if (resume) startPreview();
  }
}

/* ---------- Bind controls ---------- */
previewBtn && previewBtn.addEventListener("click", togglePreview);
gifBtn && gifBtn.addEventListener("click", renderGifDownload);

[fpsInput, secondsInput].forEach(inp => inp && inp.addEventListener("input", () => {
  // live updates when preview is running
  if (previewRunning) {
    // restart to rebase timeline and end-time label
    stopPreview();
    startPreview();
  } else {
    // keep labels in sync if idle
    setTimeLabels(0, getDuration());
  }
}));

// Keep labels sane on load for Part 3
setTimeLabels(0, getDuration());
setProgress(0);

/* ===================== End of Part 3 of 4 ===================== */
/* =======================================================
   LED Backpack Animator — app.js (Part 4 of 4)
   Undo/Redo + Import/Export + Auto-save + Multi-Select btn
   + Default "WILL WHEELIE FOR BOOKTOK GIRLIES" preset
   ======================================================= */

/* ---------- DOM (used in this part) ---------- */
const undoBtn         = $("#undoBtn");
const redoBtn         = $("#redoBtn");
const clearAllBtn     = $("#clearAllBtn");
const saveJsonBtn     = $("#saveJsonBtn");
const loadJsonInput   = $("#loadJsonInput");

// Optional (if present in your HTML below the preview box)
const multiSelectBtn  = $("#multiSelectBtn");
const multiTipEl      = $("#multiTip");

/* ---------- Utilities ---------- */
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

function serializeDoc() {
  // strip live objects (Image) to keep JSON clean
  const j = deepClone({
    ...doc,
    bg: { ...doc.bg, image: null }, // image objects aren’t serializable
  });
  return j;
}

function hydrateDoc(j) {
  // restore doc fields; try to reload preset image if needed
  doc.res      = j.res || doc.res;
  doc.lines    = Array.isArray(j.lines) ? j.lines : doc.lines;
  doc.spacing  = j.spacing || doc.spacing;
  doc.style    = j.style || doc.style;
  doc.anims    = Array.isArray(j.anims) ? j.anims : (doc.anims || []);
  doc.multi    = new Set(); // never persisted
  doc.bg       = j.bg || doc.bg;

  if (doc.bg?.preset && !doc.bg.image) {
    const im = new Image(); im.crossOrigin = "anonymous"; im.src = doc.bg.preset;
    im.onload = () => { doc.bg.image = im; render(0, getDuration()); };
  }
}

/* ---------- Undo/Redo ---------- */
const UNDO_LIMIT = 50;
const undoStack = [];
const redoStack = [];

function snapshot() {
  // push current doc state to undo
  undoStack.push(JSON.stringify(serializeDoc()));
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  // whenever we snapshot for a forward action, redo is cleared
  redoStack.length = 0;
  updateUndoRedoButtons();
}

function applyStateFromString(s) {
  try {
    const j = JSON.parse(s);
    hydrateDoc(j);
    render(0, getDuration());
    saveToStorageThrottled();
  } catch (e) {
    console.error("Failed to apply state:", e);
  }
}

function doUndo() {
  if (!undoStack.length) return;
  // current state goes to redo, pop last undo to apply
  const cur = JSON.stringify(serializeDoc());
  const prev = undoStack.pop();
  redoStack.push(cur);
  applyStateFromString(prev);
  updateUndoRedoButtons();
}
function doRedo() {
  if (!redoStack.length) return;
  const cur = JSON.stringify(serializeDoc());
  const next = redoStack.pop();
  undoStack.push(cur);
  applyStateFromString(next);
  updateUndoRedoButtons();
}
function updateUndoRedoButtons() {
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

/* Wire toolbar buttons (if present) */
undoBtn && undoBtn.addEventListener("click", doUndo);
redoBtn && redoBtn.addEventListener("click", doRedo);

/* Keyboard shortcuts */
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;

  // Undo: Cmd/Ctrl+Z (no Shift)
  if (e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    doUndo();
  }
  // Redo: Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y
  if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
    e.preventDefault();
    doRedo();
  }
});

/* ---------- Multi-select Toggle Button (optional) ---------- */
let multiToggleMode = false; // when true, clicks toggle membership; when false, single-select clicks
if (multiSelectBtn) {
  multiSelectBtn.addEventListener("click", () => {
    multiToggleMode = !multiToggleMode;
    multiSelectBtn.classList.toggle("active", multiToggleMode);
    multiSelectBtn.setAttribute("aria-pressed", String(multiToggleMode));
    if (multiTipEl) {
      multiTipEl.textContent = multiToggleMode
        ? "Tip: Click words to add/remove. Hold Shift/Cmd for momentary multi-select."
        : "Tip: Hold Shift/Cmd to multi-select.";
    }
  });
}

/* Patch canvas click behavior to respect multiToggleMode without modifiers */
const _canvasClickHandlers = [];
function rebindCanvasClickForMultiToggle() {
  // Remove prior handlers we added (if any) to avoid duplicates
  _canvasClickHandlers.forEach(fn => canvas.removeEventListener("click", fn));
  _canvasClickHandlers.length = 0;

  const handler = (e) => {
    // Re-run the hit testing from Part 2 but change the multi-select rule:
    const rect=canvas.getBoundingClientRect();
    const px=(e.clientX-rect.left)/zoom, py=(e.clientY-rect.top)/zoom;

    const lineGap = doc.spacing.lineGap ?? defaults.lineGap;
    const heights = doc.lines.map(lineHeight);
    const contentH = heights.reduce((s,h)=>s+h,0) + (doc.lines.length-1)*lineGap;
    let y;
    const valign = (doc.style?.valign || defaults.valign);
    if (valign==="top") y=4; else if (valign==="bottom") y=doc.res.h-contentH-4; else y=(doc.res.h-contentH)/2;

    let hit = null;
    for (let li=0; li<doc.lines.length; li++){
      const lh = heights[li];
      const wLine = lineWidth(doc.lines[li]);
      let x;
      const align = (doc.style?.align || defaults.align);
      if (align === "left") x = 4;
      else if (align === "right") x = doc.res.w - wLine - 4;
      else x = (doc.res.w - wLine)/2;

      for (let wi=0; wi<doc.lines[li].words.length; wi++){
        const w = doc.lines[li].words[wi];
        const ww = measureText(w);
        const bx = x-2, by = (y+lh*0.85)-lh, bw = ww+4, bh = lh+4;
        if (px>=bx && px<=bx+bw && py>=by && py<=by+bh){ hit = { line:li, word:wi }; break; }
        x += ww + (doc.spacing.wordGap ?? defaults.wordGap);
      }
      if (hit) break;
      y += lh + lineGap;
    }

    if (hit) {
      const k = keyOf(hit.line, hit.word);
      const modifier = (e.shiftKey || e.metaKey || e.ctrlKey);
      const useMulti = modifier || multiToggleMode;
      if (useMulti) {
        if (doc.multi.has(k)) doc.multi.delete(k);
        else doc.multi.add(k);
        selected = hit;
      } else {
        doc.multi.clear();
        selected = hit;
      }
    } else {
      if (!multiToggleMode) doc.multi.clear();
      selected = null;
    }
    render(0, null);
  };

  canvas.addEventListener("click", handler);
  _canvasClickHandlers.push(handler);
}
rebindCanvasClickForMultiToggle();

/* ---------- State Mutation Helpers (wrap changes with snapshot) ---------- */
// Call snapshot() right BEFORE you mutate doc in handlers we own here
function clearAll() {
  snapshot();
  doc.lines = [{ words:[{ text:"", color:defaults.color, font:defaults.font, size:defaults.size }] }];
  doc.multi.clear();
  selected = { line:0, word:0 };
  render(0, getDuration());
  saveToStorageThrottled();
}
clearAllBtn && clearAllBtn.addEventListener("click", clearAll);

/* Hook into key text edits coming from Part 2
   — If you add more editing handlers later, call snapshot() before the change. */
(function patchTypingSnapshot(){
  let typingArmed = false;
  document.addEventListener("keydown",(e)=>{
    // Begin a snapshot when user starts typing/backspacing into selection
    if (!typingArmed && mode === "edit") {
      const isChar = (e.key.length === 1 && !e.metaKey && !e.ctrlKey);
      const isBack = (e.key === "Backspace" || e.key === "Delete");
      if (isChar || isBack) {
        snapshot();
        typingArmed = true;
        // disarm on next idle render tick
        requestAnimationFrame(()=> typingArmed = false);
      }
    }
  }, true);
})();

/* ---------- Import / Export JSON ---------- */
saveJsonBtn && saveJsonBtn.addEventListener("click", ()=>{
  try {
    const data = JSON.stringify(serializeDoc(), null, 2);
    const blob = new Blob([data], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "led-backpack-config.json";
    a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 5000);
  } catch (e) {
    console.error("Download failed:", e);
  }
});

loadJsonInput && loadJsonInput.addEventListener("change", (e)=>{
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      snapshot();
      const j = JSON.parse(rd.result);
      hydrateDoc(j);
      // Keep UI in sync
      buildBgGrid();
      showSolidTools(doc.bg?.type === "solid");
      render(0, getDuration());
      fitZoom();
      saveToStorageThrottled();
    } catch (err) {
      console.error("Invalid config JSON:", err);
    } finally {
      loadJsonInput.value = "";
    }
  };
  rd.readAsText(f);
});

/* ---------- Auto-save to localStorage ---------- */
const LS_KEY = "led_backpack_animator_doc_v3";
let _saveBusy = false;
function saveToStorageThrottled() {
  if (_saveBusy) return;
  _saveBusy = true;
  setTimeout(()=>{
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(serializeDoc()));
    } catch (e) {
      console.warn("LocalStorage save failed", e);
    } finally {
      _saveBusy = false;
    }
  }, 120);
}
function tryLoadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const j = JSON.parse(raw);
    hydrateDoc(j);
    return true;
  } catch { return false; }
}

/* ---------- Default “BookTok” preset seeding ---------- */
function seedBookTokDefault() {
  // 3 lines works nicely on 96×128
  const L = [
    { words: [ {text:"WILL"}, {text:"WHEELIE"} ] },
    { words: [ {text:"FOR"} ] },
    { words: [ {text:"BOOKTOK"}, {text:"GIRLIES"} ] },
  ];
  L.forEach(line => line.words.forEach(w=>{
    w.font  = defaults.font;
    w.size  = 22;
    w.color = "#FFFFFF";
  }));

  // Global animations for all words: Glow Pulse + Wave (movement)
  const globalAnims = [
    { id:"glow",  params:{ intensity:0.65 } },
    { id:"wave",  params:{ ax:0.8, ay:1.4, cycles:1.1 } },
  ];

  // Add Rainbow Sweep specifically to "BOOKTOK"
  const target = L[2].words[0]; // "BOOKTOK"
  target.anims = [
    { id:"glow",   params:{ intensity:0.65 } },
    { id:"wave",   params:{ ax:0.8, ay:1.4, cycles:1.1 } },
    { id:"rainbow",params:{ speed:0.5, start:"#ff00ff" } }
  ];

  snapshot();
  doc.lines = L;
  doc.anims = globalAnims;
  doc.spacing = { lineGap: 6, wordGap: 8 };
  doc.style   = { align:"center", valign:"middle" };
  selected = { line: 0, word: 0 };

  // Seed a visible background preset if available
  const set = visibleSet();
  const preset = set?.[0]?.full || "assets/presets/96x128/Preset_A.png";
  const im = new Image(); im.crossOrigin="anonymous"; im.src = preset;
  doc.bg = { type:"image", image:null, preset, color:null };
  im.onload = ()=>{ doc.bg.image = im; render(0, getDuration()); saveToStorageThrottled(); };

  // Sync UI
  buildBgGrid();
  showSolidTools(false);
  render(0, getDuration());
  fitZoom();
  saveToStorageThrottled();
}

/* ---------- First-load boot strap (Part 4) ---------- */
(function firstBoot() {
  // If there’s saved content, use it. Otherwise seed BookTok default.
  const hadSaved = tryLoadFromStorage();
  if (!hadSaved) {
    seedBookTokDefault();
  } else {
    // Ensure BG tools/presets reflect loaded doc
    buildBgGrid();
    showSolidTools(doc.bg?.type === "solid");
    render(0, getDuration());
    fitZoom();
  }
  // Disable redo/undo to correct initial state
  undoStack.length = 0;
  redoStack.length = 0;
  updateUndoRedoButtons();
})();

/* ---------- Save on meaningful actions ---------- */
window.addEventListener("beforeunload", saveToStorageThrottled);
// Also save whenever the preview settings or file name changes
[fpsInput, secondsInput, fileNameInput].forEach(inp =>
  inp && inp.addEventListener("input", saveToStorageThrottled)
);

// Re-save after background changes from Part 1 controls
resSel && resSel.addEventListener("change", saveToStorageThrottled);
bgSolidColor && bgSolidColor.addEventListener("input", saveToStorageThrottled);
bgUpload && bgUpload.addEventListener("change", saveToStorageThrottled);

/* ===================== End of Part 4 of 4 ===================== */
