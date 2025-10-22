/* ============================================
   LED Backpack Animator — app.js (Part 1 of 3)
   Boot + UI wiring + backgrounds + zoom/fit/inspector
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

const inspectorToggle = $("#toggleInspector");
const inspectorBody = $("#inspectorBody");
const pillTabs = $$(".pill[data-acc]");
const accFont = $("#accFont"), accLayout = $("#accLayout"), accAnim = $("#accAnim");

const swatchesWrap = $("#swatches");
const addSwatchBtn = $("#addSwatchBtn");
const fontColorInput = $("#fontColor");

const progressBar = $("#progress");
const tCur = $("#tCur"), tEnd = $("#tEnd");

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

/* ---------- document model (minimal for Part 1) ---------- */
let doc = {
  res: { w: 96, h: 128 },
  lines: [
    { words: [ { text: "WILL",     style:{ color:"#1E90FF" } } ] },
    { words: [ { text: "WHEELIE",  style:{ color:"#32CD32" } } ] },
    { words: [ { text: "FOR",      style:{ color:"#FFFFFF" } } ] },
    { words: [ { text: "BOOKTOK",  style:{ color:"#FF66CC" } } ] },
    { words: [ { text: "GIRLIES",  style:{ color:"#FF3333" } } ] },
  ],
  style: { ...defaults },
  bg: { type:"image", preset:"assets/presets/96x128/Preset_A.png", image:null, color:null },
  animations: []
};

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

function showSolidTools(show) {
  bgSolidTools?.classList.toggle("hidden", !show);
}

function buildBgGrid() {
  if (!bgGrid) return;
  bgGrid.innerHTML = "";

  const set = visibleSet();
  const tiles = [
    set[0] && { ...set[0], kind: "preset" },
    set[1] && { ...set[1], kind: "preset" },
    { kind: "solid",  thumb: "assets/thumbs/Solid_thumb.png" },
    { kind: "upload", thumb: "assets/thumbs/Upload_thumb.png" },
  ].filter(Boolean);

  tiles.forEach((t, i) => {
    const d = document.createElement("button");
    d.type = "button";
    d.className = "bg-tile";
    d.dataset.kind = t.kind;

    const img = document.createElement("img");
    img.alt = t.kind === "preset" ? `Preset ${t.id}` : t.kind;
    img.loading = "lazy";
    img.src = t.kind === "preset" ? t.thumb : t.thumb;
    d.appendChild(img);

    on(d, "click", async () => {
      $$(".bg-tile", bgGrid).forEach(x => x.classList.remove("active"));
      d.classList.add("active");

      if (t.kind === "preset") {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.src = t.full;
        try { await im.decode(); } catch {}
        doc.bg = { type:"image", color:null, image:im, preset:t.full };
        showSolidTools(false);
        render(0);
      } else if (t.kind === "solid") {
        doc.bg = { type:"solid", color:bgSolidColor.value || "#000000", image:null, preset:null };
        showSolidTools(true);
        render(0);
      } else if (t.kind === "upload") {
        bgUpload?.click();
      }
    });

    bgGrid.appendChild(d);
  });

  // mark first tile active for visual feedback
  const first = $(".bg-tile", bgGrid);
  if (first) first.classList.add("active");
}

on(bgUpload, "change", (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {
    URL.revokeObjectURL(url);
    doc.bg = { type:"image", color:null, image:im, preset:null };
    showSolidTools(false);
    render(0);
  };
  im.src = url;
});

/* ---------- text + bg swatches (UI containers only for Part 1) ---------- */
function rebuildTextSwatches(){
  if (!swatchesWrap) return;
  swatchesWrap.innerHTML = "";
  [...defaultPalette, ...customPalette].forEach(c=>{
    const d=document.createElement("button");
    d.type="button";
    d.className="swatch";
    d.style.background=c;
    on(d,"click",()=>{ /* color picked -> handled in Part 2 */ });
    swatchesWrap.appendChild(d);
  });
}
on(addSwatchBtn, "click", ()=>{
  const c = fontColorInput?.value || "#FFFFFF";
  if(!defaultPalette.includes(c) && !customPalette.includes(c)) customPalette.push(c);
  rebuildTextSwatches();
});

function rebuildBgSwatches(){
  if (!bgSwatches) return;
  bgSwatches.innerHTML = "";
  [...defaultPalette, ...customBgPalette].forEach(c=>{
    const d=document.createElement("button");
    d.type="button";
    d.className="swatch";
    d.style.background=c;
    on(d,"click",()=>{ doc.bg = { type:"solid", color:c, image:null, preset:null }; showSolidTools(true); render(0); });
    bgSwatches.appendChild(d);
  });
}
on(addBgSwatchBtn, "click", ()=>{
  const c = bgSolidColor?.value || "#000000";
  if(!defaultPalette.includes(c) && !customBgPalette.includes(c)) customBgPalette.push(c);
  rebuildBgSwatches();
});
on(bgSolidColor, "input", ()=>{ doc.bg = { type:"solid", color:bgSolidColor.value, image:null, preset:null }; render(0); });

/* ---------- zoom / fit (true centering) ---------- */
function setZoom(z) {
  zoom = z;
  if (zoomSlider) zoomSlider.value = String(z.toFixed(2));
  // center from the middle, not top-left
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
on(zoomSlider, "input", (e)=> setZoom(parseFloat(e.target.value)));
on(fitBtn, "click", fitZoom);
window.addEventListener("resize", fitZoom);
window.addEventListener("orientationchange", ()=> setTimeout(fitZoom, 200));

/* ---------- inspector behavior (pills only; no left labels) ---------- */
on(inspectorToggle, "click", ()=>{
  const open = !inspectorBody.classList.contains("open");
  inspectorBody.classList.toggle("open", open);
  inspectorToggle.setAttribute("aria-expanded", String(open));
  setTimeout(fitZoom, 60);
});
pillTabs.forEach(p=>{
  on(p,"click", ()=>{
    const id = p.dataset.acc;
    [accFont, accLayout, accAnim].forEach(a=>{
      a.open = (a.id === id);
    });
    pillTabs.forEach(x=> x.classList.toggle("active", x===p));
    inspectorBody.classList.add("open");
    inspectorToggle.setAttribute("aria-expanded", "true");
  });
});

/* ---------- simple layout helpers for Part 1 ---------- */
function resolveStyle(over = {}) {
  return {
    fontFamily: over.fontFamily || doc.style.fontFamily || defaults.fontFamily,
    fontSize:   over.fontSize   || doc.style.fontSize   || defaults.fontSize,
    color:      over.color      || doc.style.color      || defaults.color,
  };
}
function layoutDocument() {
  // Part 1 draws background only; full text rendering arrives in Part 2.
  return { positions: [] };
}

/* ---------- render (background only in Part 1) ---------- */
function render() {
  canvas.width  = doc.res.w;
  canvas.height = doc.res.h;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (doc.bg.type === "solid") {
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if (doc.bg.type === "image") {
    if (doc.bg.image) {
      try { ctx.drawImage(doc.bg.image, 0, 0, canvas.width, canvas.height); } catch {}
    } else if (doc.bg.preset) {
      const im = new Image(); im.crossOrigin = "anonymous"; im.src = doc.bg.preset;
      im.onload = () => { doc.bg.image = im; render(); };
    } else {
      ctx.fillStyle = "#000"; ctx.fillRect(0,0,canvas.width,canvas.height);
    }
  }
}

/* ---------- resolution change ---------- */
on(resSel,"change", ()=>{
  const [w,h] = resSel.value.split("x").map(Number);
  doc.res = {w,h};
  buildBgGrid();
  showSolidTools(doc.bg?.type==="solid");
  render();
  fitZoom();
});

/* ---------- mode buttons (preview logic comes in Part 3) ---------- */
function setMode(m){
  mode = m;
  modeEditBtn?.classList.toggle("active", m === "edit");
  modePrevBtn?.classList.toggle("active", m !== "edit");
}
on(modeEditBtn, "click", ()=> setMode("edit"));
on(modePrevBtn, "click", ()=> setMode("preview"));

/* ---------- init ---------- */
function init(){
  // prepare swatches containers (text + bg)
  rebuildTextSwatches();
  rebuildBgSwatches();

  // initial grid for current resolution
  buildBgGrid();
  showSolidTools(false);

  // set canvas size & center
  render();
  fitZoom();

  // open Font tab by default
  accFont.open = true;
}
init();
