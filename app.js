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
