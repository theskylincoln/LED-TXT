/* =======================================================
   LED Backpack Animator — app.js (FULL)
   - UI wiring
   - Background presets, Solid, Upload (GIF supported)
   - Zoom & Preview
   - Text editing (single/multi-select), autosize (default ON)
   - Animations (Glow, Rainbow Sweep, Sweep highlight, Zoom, Slide, Scroll, etc.)
   - GIF render (preview image + file download)
   - Import/Export config (includes uploaded BGs; GIFs re-decoded at load)
   - Undo/Redo + Clear
   ======================================================= */

/* ---------- helpers ---------- */
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

/* ---------- DOM ---------- */
const canvas  = $("#led"),
      ctx     = canvas.getContext("2d", { willReadFrequently:true }),
      wrap    = $(".canvas-wrap");

const resSel  = $("#resSelect"),
      zoomSlider = $("#zoom"),
      fitBtn  = $("#fitBtn");

const modeEditBtn   = $("#modeEdit"),
      modePreviewBtn= $("#modePreview");

const undoBtn = $("#undoBtn"),
      redoBtn = $("#redoBtn"),
      clearAllBtn = $("#clearAllBtn");

const inspectorBody   = $("#inspectorBody");
const pillTabs  = $$(".pill[data-acc]");
const accFont   = $("#accFont"),
      accLayout = $("#accLayout"),
      accAnim   = $("#accAnim");

const bgGrid  = $("#bgGrid"),
      bgSolidTools = $("#bgSolidTools"),
      bgSolidColor = $("#bgSolidColor"),
      addBgSwatchBtn = $("#addBgSwatchBtn"),
      bgSwatches = $("#bgSwatches"),
      bgUpload   = $("#bgUpload");

const progressFill = $("#progress"),
      tCur = $("#tCur"),
      tEnd = $("#tEnd");

const multiToggle = $("#multiToggle");

/* Stage actions */
const addWordBtn   = $("#addWordBtn");
const addLineBtn   = $("#addLineBtn");
const delWordBtn   = $("#deleteWordBtn");

/* Font/Layout */
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

/* Animations UI */
const animList     = $("#animList");
const applySelBtn  = $("#applySelectedAnimBtn");
const applyAllBtn  = $("#applyAllAnimBtn");

/* Render / GIF controls */
const fpsInput      = $("#fps");
const secondsInput  = $("#seconds");
const fileNameInput = $("#fileName");
const previewBtn    = $("#previewRenderBtn");
const gifBtn        = $("#gifRenderBtn");
const gifPreviewImg = $("#gifPreview");

/* Config IO */
const loadJsonInput = $("#loadJsonInput");
const saveJsonBtn   = $("#saveJsonBtn");

/* ---------- state ---------- */
let mode = "edit";
let zoom = 1;
let selected = null;           // {line, word} or null
const history = { past:[], future:[] };

const defaults = {
  font: "Orbitron",
  size: 22,
  color: "#FFFFFF",
  lineGap: 4,
  wordGap: 6,
  align: "center",
  valign: "middle"
};

/* Seed document with phrase—one letter per line for “WILL WHEELIE FOR BOOKTOK GIRLIES” */
function linesFromStringLetters(str){
  const arr = [];
  for (const ch of str) {
    arr.push({ words:[{ text: ch === " " ? " " : ch, color: "#FFFFFF", font: "Orbitron", size: 22 }] });
  }
  return arr;
}

const doc = {
  res: { w:96, h:128 },
  // One letter per line by request
  lines: linesFromStringLetters("WILL WHEELIE FOR BOOKTOK GIRLIES"),
  bg: { type:"solid", image:null, preset:null, color:"#000000", dataURL:null, gif:null },
  spacing:{ lineGap:4, wordGap:6 },
  anims: [ // default global anims: subtle Glow, Scroll to “move all the words”
    { id:"glow", params:{ intensity:0.6 } },
    { id:"scroll", params:{ direction:"Left", speed:0.8 } }
  ],
  style: { align:"center", valign:"middle" },
  multi:new Set()
};

/* Apply rainbow sweep to lines that spell BOOKTOK (per request) */
(function seedBooktokRainbow(){
  const phrase = doc.lines.map(l=> (l.words[0]?.text||"")).join("");
  const idx = phrase.indexOf("BOOKTOK");
  if (idx >= 0) {
    for (let i=idx;i<idx+7;i++){
      const w = doc.lines[i]?.words?.[0];
      if (!w) continue;
      w.anims = [
        { id:"rainbow", params:{ speed:0.7, start:"#0000ff" } }, // starts blue → cycles
        { id:"glow",    params:{ intensity:0.8 } }
      ];
    }
  }
})();

/* ---------- Background presets (2×2 visible set) ---------- */
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
  bgGrid.innerHTML = "";
  const set = visibleSet();
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
    img.src=t.thumb; img.alt=t.kind;
    b.appendChild(img);

    on(b,"click",async()=>{
      $$(".bg-tile",bgGrid).forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      if(t.kind==="preset"){
        const im=new Image(); im.crossOrigin="anonymous"; im.src=t.full;
        try{await im.decode();}catch{}
        doc.bg={type:"image",color:null,image:im,preset:t.full,dataURL:null,gif:null};
        showSolidTools(false);
        pushHistory();
        render();
      }else if(t.kind==="solid"){
        doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null,dataURL:null,gif:null};
        showSolidTools(true);
        pushHistory();
        render();
      }else if(t.kind==="upload"){
        bgUpload.click();
      }
    });
    bgGrid.appendChild(b);
  });

  // Mark active tile if matches current bg
  if (doc.bg?.preset) {
    const set = visibleSet();
    const idx = set.findIndex(p=>p.full===doc.bg.preset);
    const tile = $$(".bg-tile",bgGrid)[idx];
    tile && tile.classList.add("active");
  } else if (doc.bg?.type==="solid") {
    const tile = $$(".bg-tile",bgGrid).find(x=>x.dataset.kind==="solid");
    tile && tile.classList.add("active");
  }
}

/* ---------- Swatch helpers ---------- */
const defaultBgPalette=["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customBgPalette=[];
function rebuildBgSwatches(){
  bgSwatches.innerHTML="";
  [...defaultBgPalette,...customBgPalette].forEach(c=>{
    const b=document.createElement("button");
    b.type="button"; b.className="swatch"; b.style.background=c; b.title=c;
    b.addEventListener("click",()=>{
      doc.bg={type:"solid",color:c,image:null,preset:null,dataURL:null,gif:null};
      showSolidTools(true); pushHistory(); render();
    });
    bgSwatches.appendChild(b);
  });
}
on(addBgSwatchBtn,"click",()=>{
  const c=bgSolidColor.value;
  if(!defaultBgPalette.includes(c)&&!customBgPalette.includes(c)) customBgPalette.push(c);
  rebuildBgSwatches();
});
on(bgSolidColor,"input",()=>{
  doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null,dataURL:null,gif:null};
  pushHistory(); render();
});

/* ---------- Upload: PNG/JPG/GIF (animated) ---------- */
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
/* gifuct decoder lazy loader */
function ensureGifDecodeLib() {
  if (window.gifuct) return Promise.resolve(true);
  return loadScriptLocal("./assets/libs/gifuct/gifuct.min.js")
    .then(() => !!window.gifuct)
    .catch(e => { console.error("gifuct load failed", e); return false; });
}
async function dataURLToU8(dataURL) {
  const res = await fetch(dataURL);
  return new Uint8Array(await res.arrayBuffer());
}
async function decodeGifBackground(dataURL, maxFrames=200) {
  const ok = await ensureGifDecodeLib();
  if (!ok) return null;

  const u8 = await dataURLToU8(dataURL);
  const { Gif } = window.gifuct;
  const gif = new Gif(u8);
  const frames = gif.decompressFrames(true);

  const W = gif.raw.lsd.width, H = gif.raw.lsd.height;
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const ox = off.getContext("2d", { willReadFrequently:true });

  const bitmaps = [];
  const delays = [];
  let total = 0;

  for (let i=0;i<frames.length && i<maxFrames;i++){
    const f = frames[i];
    if (f.disposalType === 2) ox.clearRect(0,0,W,H);
    const imgData = ox.createImageData(f.dims.width, f.dims.height);
    imgData.data.set(f.patch);
    ox.putImageData(imgData, f.dims.left, f.dims.top);

    let bmp;
    if (window.createImageBitmap) bmp = await createImageBitmap(off);
    else {
      const url = off.toDataURL("image/png");
      bmp = await new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.src=url; });
    }

    bitmaps.push(bmp);
    const delayMs = Math.max(10, (f.delay || 10) * 10);
    delays.push(delayMs);
    total += delayMs;
  }
  return { W, H, bitmaps, delays, totalMs: Math.max(total, 10) };
}
function gifFrameAt(g, tSec) {
  if (!g?.bitmaps?.length) return 0;
  const ms = Math.max(0, (tSec*1000) % g.totalMs);
  let acc = 0;
  for (let i=0;i<g.delays.length;i++){
    acc += g.delays[i];
    if (ms < acc) return i;
  }
  return g.bitmaps.length-1;
}

on(bgUpload,"change", async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const dataURL = String(reader.result || "");
    try {
      if (/^image\/gif$/i.test(f.type) || dataURL.startsWith("data:image/gif")) {
        const decoded = await decodeGifBackground(dataURL);
        if (decoded?.bitmaps?.length) {
          doc.bg = { type:"gif", color:null, image:null, preset:null, dataURL, gif:decoded };
        } else {
          const im = new Image();
          im.onload=()=>{ doc.bg={type:"image", color:null, image:im, preset:null, dataURL, gif:null}; render(); };
          im.src = dataURL;
        }
      } else {
        const im = new Image();
        im.onload=()=>{ doc.bg={type:"image", color:null, image:im, preset:null, dataURL, gif:null}; render(); };
        im.src = dataURL;
      }
      showSolidTools(false);
      pushHistory();
      render();
    } catch (err) {
      console.error("BG load failed:", err);
    }
  };
  reader.readAsDataURL(f);
});

/* ---------- zoom / fit ---------- */
function setZoom(z){
  zoom=z; zoomSlider.value=String(z.toFixed(2));
  canvas.style.transform=`translate(-50%,-50%) scale(${z})`;
}
function fitZoom(){
  const pad=18, r=wrap.getBoundingClientRect();
  const availW=Math.max(40,r.width-pad*2);
  const availH=Math.max(40,r.height-pad*2);
  const s=Math.max(0.1,Math.min(availW/doc.res.w,availH/doc.res.h));
  setZoom(s);
}
on(zoomSlider,"input",e=>setZoom(parseFloat(e.target.value)));
on(fitBtn,"click",fitZoom);
window.addEventListener("resize",fitZoom);
window.addEventListener("orientationchange",()=>setTimeout(fitZoom,150));

/* ---------- inspector pills (only one open section visible) ---------- */
pillTabs.forEach(p=>{
  on(p,"click",()=>{
    const id=p.dataset.acc;
    [accFont,accLayout,accAnim].forEach(a=>a.open = (a.id===id));
    pillTabs.forEach(x=>x.classList.toggle("active",x===p));
    inspectorBody.classList.add("open");
  });
});

/* ---------- measure helpers ---------- */
function measureTextWord(w, fontSizeOverride=null){
  const size = fontSizeOverride ?? (w.size || defaults.size);
  ctx.font = `${size}px ${w.font || defaults.font}`;
  return ctx.measureText(w.text || "").width;
}
function lineHeight(line){
  return Math.max(12, ...line.words.map(w => (w.size || defaults.size)));
}
function totalHeight(){
  return doc.lines.map(lineHeight).reduce((s,h)=>s+h,0) + (doc.lines.length-1)*(doc.spacing.lineGap||defaults.lineGap);
}
function lineWidth(line){
  const gap = doc.spacing.wordGap ?? defaults.wordGap;
  return line.words.reduce((s,w)=> s + measureTextWord(w), 0) + Math.max(0,line.words.length-1)*gap;
}

/* ---------- auto-size (per line, default ON) ---------- */
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
    let chosen = size;
    for(let s=size; s>=6; s-=0.5){
      const gap = doc.spacing.wordGap ?? defaults.wordGap;
      let w= -gap;
      for(const word of line.words){
        ctx.font = `${s}px ${word.font || defaults.font}`;
        w += ctx.measureText(word.text||"").width + gap;
      }
      if (w <= maxW){ chosen = s; break; }
    }
    line.words.forEach(word=> word.size = chosen);
  });

  // reflect the active selected word size in UI
  if (selected) {
    const w = doc.lines[selected.line]?.words[selected.word];
    if (w && fontSizeInp) fontSizeInp.value = String(Math.round(w.size||defaults.size));
  }
}

/* ---------- ANIMATIONS ---------- */
const ANIMS = [
  { id:"slide",      name:"Slide In",             params:{direction:"Left",  speed:1} },
  { id:"slideaway",  name:"Slide Away",           params:{direction:"Left",  speed:1} },
  { id:"zoom",       name:"Zoom",                 params:{direction:"In",    speed:1} },
  { id:"scroll",     name:"Scroll / Marquee",     params:{direction:"Left",  speed:1} },
  { id:"pulse",      name:"Pulse / Breathe",      params:{scale:0.03, vy:4} },
  { id:"wave",       name:"Wave",                 params:{ax:0.8, ay:1.4, cycles:1.0} },
  { id:"jitter",     name:"Jitter",               params:{amp:0.10, freq:2.5} },
  { id:"shake",      name:"Shake",                params:{amp:0.20, freq:2} },
  { id:"colorcycle", name:"Color Cycle",          params:{speed:0.5, start:"#ff0000"} },
  { id:"rainbow",    name:"Rainbow Sweep",        params:{speed:0.7, start:"#0000ff"} },
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
function animDef(id){ return ANIMS.find(a=>a.id===id); }
function cloneAnims(src){ return src.map(a=>({ id:a.id, params:{...a.params} })); }
function resolveWordAnims(word){
  return (word.anims && word.anims.length) ? word.anims : (doc.anims || []);
}
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

/* The runtime parameterization */
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

  // Pulse
  const pulse = get("pulse");
  if (pulse) {
    const s = Number(pulse.params.scale || 0.03);
    const vy = Number(pulse.params.vy || 4);
    props.scale *= 1 + (Math.sin(t * 2 * Math.PI) * s);
    props.dy    += Math.sin(t * 2 * Math.PI) * vy;
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

  // Jitter / Shake
  const jit = get("jitter");
  if (jit) {
    const a = Number(jit.params.amp || 0.10), f = Number(jit.params.freq || 2.5);
    props.dx += Math.sin(t * 2 * Math.PI * f) * a * 3;
    props.dy += Math.cos(t * 2 * Math.PI * f) * a * 3;
  }
  const shake = get("shake");
  if (shake) {
    const a = Number(shake.params.amp || 0.20) * 5, f = Number(shake.params.freq || 2);
    props.dx += Math.sin(t * 2 * Math.PI * f) * a;
    props.dy += Math.cos(t * 2 * Math.PI * f) * a * 0.6;
  }

  // Typewriter / Scramble / Popcorn
  const type = get("typewriter");
  if (type && props.text) {
    const rate = Number(type.params.rate || 1);
    const cps  = 10 * rate;
    const shown = Math.max(0, Math.min(props.text.length, Math.floor(t * cps)));
    props.text = props.text.slice(0, shown);
  }
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

  // Color Cycle / Rainbow gradient / Sweep
  const cc = get("colorcycle");
  if (cc) {
    const sp = Number(cc.params.speed || 0.5);
    const base = (cc.params.start || "#ff0000");
    const hueBase = colorToHue(base);
    const hue = Math.floor((hueBase + (t * 60 * sp)) % 360);
    props.color = `hsl(${hue}deg 100% 60%)`;
  }
  const rainbow = get("rainbow");
  if (rainbow) {
    const speed = Number(rainbow.params.speed || 0.5);
    const base = (rainbow.params.start || "#ff00ff");
    const hueBase = colorToHue(base);
    props.gradient = { type: "rainbow", speed, base: hueBase };
  }
  const sweep = get("sweep");
  if (sweep) {
    const speed = Number(sweep.params.speed || 0.7), width = Number(sweep.params.width || 0.25);
    props.gradient = { type: "sweep", speed, width };
  }

  // Flicker / Strobe / Glow
  const flicker = get("flicker");
  if (flicker) {
    const str = clamp(Number(flicker.params.strength || 0.5), 0, 1);
    const n = (Math.sin(t * 23.7) + Math.sin(t * 17.3)) * 0.25 + 0.5;
    props.alpha *= (1 - str * 0.6) + n * str * 0.6;
  }
  const strobe = get("strobe");
  if (strobe) {
    const rate = Number(strobe.params.rate || 3);
    const phase = Math.sin(2 * Math.PI * rate * t);
    props.alpha *= (phase > 0) ? 1 : 0.15;
  }
  const glow = get("glow");
  if (glow) {
    const intensity = Math.max(0, Number(glow.params.intensity || 0.6));
    const k = (Math.sin(t * 2 * Math.PI * 1.2) * 0.5 + 0.5) * intensity;
    props.shadow = { blur: 6 + k * 10, color: props.color || word.color };
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

/* ---------- FULL render ---------- */
function render(t=0, totalDur=null){
  const W = canvas.width  = doc.res.w;
  const H = canvas.height = doc.res.h;

  // BG (always paint a base so preview isn’t blank during image loads)
  ctx.clearRect(0,0,W,H);

  if (doc.bg?.type === "solid") {
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,W,H);

  } else if (doc.bg?.type === "gif" && doc.bg.gif?.bitmaps?.length) {
    ctx.fillStyle = "#000"; ctx.fillRect(0,0,W,H);
    const tt = Number.isFinite(t) ? t : ((performance.now() % (doc.bg.gif.totalMs||1000)) / 1000);
    const idx = gifFrameAt(doc.bg.gif, tt);
    const bmp = doc.bg.gif.bitmaps[idx];
    try { ctx.drawImage(bmp, 0, 0, W, H); } catch{}

  } else if (doc.bg?.image) {
    try { ctx.drawImage(doc.bg.image,0,0,W,H); } catch{}

  } else if (doc.bg?.preset) {
    const im = new Image(); im.crossOrigin="anonymous"; im.src = doc.bg.preset;
    im.onload = ()=>{ doc.bg.image = im; render(t,totalDur); };
    ctx.fillStyle="#000"; ctx.fillRect(0,0,W,H);
  } else {
    ctx.fillStyle="#000"; ctx.fillRect(0,0,W,H);
  }

  // text
  autoSizeAllIfOn();

  const lineGap = doc.spacing.lineGap ?? defaults.lineGap;
  const wordGap = doc.spacing.wordGap ?? defaults.wordGap;

  const heights = doc.lines.map(lineHeight);
  const contentH = heights.reduce((s,h)=>s+h,0) + (doc.lines.length-1)*lineGap;

  let y;
  const vAlign = (doc.style?.valign||defaults.valign);
  if (vAlign === "top") y = 4;
  else if (vAlign === "bottom") y = H - contentH - 4;
  else y = (H - contentH)/2;

  const hAlign = (doc.style?.align || defaults.align);

  doc.lines.forEach((line, li)=>{
    const lh = heights[li];
    const wLine = lineWidth(line);

    let x;
    if (hAlign === "left") x = 4;
    else if (hAlign === "right") x = W - wLine - 4;
    else x = (W - wLine)/2;

    line.words.forEach((w, wi)=>{
      const base = { x, y: y + lh*0.85 };
      const props = animatedProps(base, w, t, totalDur);
      const txt = props.text || "";

      ctx.save();
      ctx.globalAlpha = clamp(props.alpha, 0, 1);
      ctx.textBaseline="alphabetic";
      const fsize = (w.size||defaults.size) * (props.scale||1);
      const fontSpec = `${fsize}px ${w.font||defaults.font}`;
      ctx.font = fontSpec;

      if (props.shadow) { ctx.shadowBlur = props.shadow.blur; ctx.shadowColor = props.shadow.color || (w.color||defaults.color); }
      else ctx.shadowBlur = 0;

      const drawX = base.x + (props.dx||0);
      const drawY = base.y + (props.dy||0);

      let fillStyle = props.color || (w.color || defaults.color);
      if (props.gradient && txt.length) {
        const wordWidth = Math.ceil(ctx.measureText(txt).width);
        if (props.gradient.type === "rainbow") {
          const g = ctx.createLinearGradient(drawX, drawY, drawX + wordWidth, drawY);
          const baseHue = (props.gradient.base + (t * 120 * props.gradient.speed)) % 360;
          for (let i=0;i<=6;i++){ const stop=i/6; const hue=Math.floor((baseHue+stop*360)%360); g.addColorStop(stop, `hsl(${hue}deg 100% 60%)`); }
          fillStyle = g;
        } else if (props.gradient.type === "sweep") {
          const band = clamp(props.gradient.width || 0.25, 0.05, 0.8);
          const pos  = (t * (props.gradient.speed || 0.7) * 1.2) % 1;
          const g = ctx.createLinearGradient(drawX, drawY, drawX + wordWidth, drawY);
          const a = Math.max(0, pos - band/2), b = Math.min(1, pos + band/2);
          g.addColorStop(0, fillStyle); g.addColorStop(a, fillStyle);
          g.addColorStop(pos, "#FFFFFF"); g.addColorStop(b, fillStyle); g.addColorStop(1, fillStyle);
          fillStyle = g;
        }
      }
      ctx.fillStyle = fillStyle;

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
          cx += widths[i];
        }
      } else {
        ctx.fillText(txt, drawX, drawY);
      }

      // selection boxes (visible in edit mode)
      if (mode==="edit") {
        const thisKey = `${li}:${wi}`;
        const ww = ctx.measureText(w.text||"").width;
        ctx.save();
        if (doc.multi.has(thisKey)) {
          ctx.strokeStyle = "rgba(0,255,255,0.95)"; // cyan
        } else if (selected && selected.line===li && selected.word===wi) {
          ctx.strokeStyle = "rgba(255,0,255,0.95)"; // magenta
        } else ctx.strokeStyle = "rgba(0,0,0,0)";
        if (ctx.strokeStyle !== "rgba(0,0,0,0)") {
          ctx.lineWidth = 1; ctx.setLineDash([3,2]);
          ctx.strokeRect(x-2, (y+lh*0.85)-lh, ww+4, lh+4);
        }
        ctx.restore();
      }

      x += measureTextWord(w) + wordGap;
      ctx.restore();
    });

    y += lh + lineGap;
  });
}

/* ---------- selection / multi-select ---------- */
function keyOf(li, wi){ return `${li}:${wi}`; }
canvas.addEventListener("click",(e)=>{
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
      const ww = measureTextWord(w);
      const bx = x-2, by = (y+lh*0.85)-lh, bw = ww+4, bh = lh+4;
      if (px>=bx && px<=bx+bw && py>=by && py<=by+bh){ hit = { line:li, word:wi }; break; }
      x += ww + (doc.spacing.wordGap ?? defaults.wordGap);
    }
    if (hit) break;
    y += lh + lineGap;
  }

  if (hit) {
    const k = keyOf(hit.line, hit.word);
    if (multiToggle?.classList.contains("active") || e.shiftKey || e.metaKey || e.ctrlKey) {
      if (doc.multi.has(k)) doc.multi.delete(k);
      else doc.multi.add(k);
      selected = hit;
    } else {
      doc.multi.clear();
      selected = hit;
    }
  } else {
    if (!multiToggle?.classList.contains("active")){
      doc.multi.clear();
      selected = null;
    }
  }
  render(0, null);
  buildAnimationsUI(); // refresh anim panel per selection
});

/* ---------- typing ---------- */
document.addEventListener("keydown",(e)=>{
  if (mode!=="edit") return;

  const targets = doc.multi.size
    ? Array.from(doc.multi).map(k=>k.split(":").map(Number))
    : (selected ? [[selected.line, selected.word]] : []);

  if (!targets.length) return;

  if (e.key.length===1 && !e.metaKey && !e.ctrlKey){
    e.preventDefault();
    targets.forEach(([li,wi])=>{
      const w = doc.lines[li]?.words[wi]; if(!w) return;
      w.text = (w.text || "") + e.key;
    });
    pushHistory();
    autoSizeAllIfOn();
    render(0,null);
  } else if (e.key==="Backspace"){
    e.preventDefault();
    targets.forEach(([li,wi])=>{
      const w = doc.lines[li]?.words[wi]; if(!w) return;
      w.text = (w.text || "").slice(0,-1);
    });
    pushHistory();
    autoSizeAllIfOn();
    render(0,null);
  }
});

/* ---------- stage actions ---------- */
addWordBtn && addWordBtn.addEventListener("click",()=>{
  const li = selected ? selected.line : (doc.lines.length-1);
  const line = doc.lines[li] || (doc.lines[li]={words:[]});
  line.words.push({ text:"NEW", color:defaults.color, font:defaults.font, size:defaults.size });
  selected = { line: li, word: line.words.length-1 };
  pushHistory(); render(0,null);
});
addLineBtn && addLineBtn.addEventListener("click",()=>{
  doc.lines.push({ words:[{ text:"LINE", color:defaults.color, font:defaults.font, size:defaults.size }] });
  selected = { line: doc.lines.length-1, word: 0 };
  pushHistory(); render(0,null);
});
delWordBtn && delWordBtn.addEventListener("click",()=>{
  if (!selected) return;
  const line = doc.lines[selected.line];
  line.words.splice(selected.word,1);
  if (!line.words.length) doc.lines.splice(selected.line,1);
  doc.multi.clear();
  selected = null;
  pushHistory(); render(0,null);
});

/* ---------- Multi-toggle ---------- */
multiToggle?.addEventListener("click",()=>{
  multiToggle.classList.toggle("active");
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
  pushHistory();
}
fontSelect && fontSelect.addEventListener("change",()=>{
  forEachSelectedWord(w=>{ w.font = fontSelect.value || defaults.font; });
  autoSizeAllIfOn(); render(0,null);
});
fontSizeInp && fontSizeInp.addEventListener("input",()=>{
  const v = clamp(parseInt(fontSizeInp.value||`${defaults.size}`,10)||defaults.size,6,64);
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
  textSwatches.innerHTML = "";
  [...defaultTextPalette, ...customTextPalette].forEach(c=>{
    const b=document.createElement("button");
    b.type="button"; b.className="swatch"; b.style.background=c; b.title=c;
    b.addEventListener("click",()=>{
      fontColorInp.value = c;
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
  const c = fontColorInp.value || defaults.color;
  if (!defaultTextPalette.includes(c) && !customTextPalette.includes(c)) customTextPalette.push(c);
  rebuildTextSwatches();
});
rebuildTextSwatches();

/* ---------- spacing & alignment ---------- */
lineGapInp && lineGapInp.addEventListener("input",()=>{
  doc.spacing.lineGap = clamp(parseInt(lineGapInp.value||"4",10)||4,0,40);
  autoSizeAllIfOn(); pushHistory(); render(0,null);
});
wordGapInp && wordGapInp.addEventListener("input",()=>{
  doc.spacing.wordGap = clamp(parseInt(wordGapInp.value||"6",10)||6,0,40);
  autoSizeAllIfOn(); pushHistory(); render(0,null);
});
alignBtns.forEach(b=> b.addEventListener("click",()=>{
  alignBtns.forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  doc.style ??= {};
  doc.style.align = b.dataset.align || "center";
  pushHistory(); render(0,null);
}));
valignBtns.forEach(b=> b.addEventListener("click",()=>{
  valignBtns.forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  doc.style ??= {};
  doc.style.valign = b.dataset.valign || "middle";
  pushHistory(); render(0,null);
}));

/* ---------- Animations UI ---------- */
function buildAnimationsUI(){
  animList.innerHTML = "";

  // choose “edit buffer”: prefer focused word, else global doc.anims
  let bufferSource = null, buffer = null;
  if (selected) {
    const w = doc.lines[selected.line]?.words[selected.word];
    if (w) { bufferSource = w; buffer = w.anims || []; }
  }
  if (!buffer) { bufferSource = doc; buffer = doc.anims || []; }

  ANIMS.forEach(def=>{
    const row = document.createElement("div");
    row.className = "anim-row";

    const left = document.createElement("div");
    left.className = "anim-left";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.id = `anim_${def.id}`;
    chk.checked = !!buffer.find(a=>a.id===def.id);

    const lbl = document.createElement("label");
    lbl.setAttribute("for", chk.id);
    lbl.textContent = def.name;

    const params = document.createElement("div");
    params.className = "anim-params";
    params.style.display = chk.checked ? "block" : "none";

    // params controls
    const currentParams = (buffer.find(a=>a.id===def.id)?.params) || def.params;
    Object.entries(def.params).forEach(([k,v])=>{
      const p = document.createElement("div"); p.className="p";
      const la = document.createElement("label"); la.textContent = k[0].toUpperCase()+k.slice(1);
      let inp;
      if (k==="direction"){
        inp = document.createElement("select");
        const opts = (def.id==="zoom") ? ["In","Out"] : ["Left","Right","Up","Down"];
        opts.forEach(op=>{
          const o=document.createElement("option"); o.value=op; o.textContent=op;
          if ((currentParams[k]??v)===op) o.selected = true;
          inp.appendChild(o);
        });
      } else if (k==="start"){
        inp = document.createElement("input"); inp.type="color"; inp.value = currentParams[k] ?? v;
      } else {
        inp = document.createElement("input"); inp.type="number"; inp.step="0.1"; inp.value = currentParams[k] ?? v;
      }
      inp.addEventListener("input",()=>{
        // real-time update
        const arr = bufferSource === doc ? (doc.anims ||= []) : (bufferSource.anims ||= []);
        let a = arr.find(x=>x.id===def.id);
        if (!a) { a = { id:def.id, params:{...def.params} }; arr.push(a); }
        a.params[k] = (inp.type==="number") ? +inp.value : inp.value;
        render(mode==="preview" ? (performance.now()-startT)/1000 % getDuration() : 0, getDuration());
      });
      p.appendChild(la); p.appendChild(inp); params.appendChild(p);
    });

    chk.addEventListener("change",()=>{
      const arr = bufferSource === doc ? (doc.anims ||= []) : (bufferSource.anims ||= []);
      const has = !!arr.find(a=>a.id===def.id);
      if (chk.checked && !has){
        arr.push({ id:def.id, params:{...def.params} });
        params.style.display = "block";
      } else if (!chk.checked && has){
        const idx = arr.findIndex(a=>a.id===def.id);
        if (idx>=0) arr.splice(idx,1);
        params.style.display = "none";
      }
      pushHistory();
      render(mode==="preview" ? (performance.now()-startT)/1000 % getDuration() : 0, getDuration());
    });

    left.appendChild(chk);
    left.appendChild(lbl);

    row.appendChild(left);
    row.appendChild(params);
    animList.appendChild(row);
  });
}
applySelBtn?.addEventListener("click", ()=>{
  if (!selected && !doc.multi.size) return;
  // use doc.anims as template
  const pack = cloneAnims(doc.anims||[]);
  if (doc.multi.size){
    doc.multi.forEach(k=>{
      const [li,wi]=k.split(":").map(Number);
      const w = doc.lines[li]?.words[wi]; if (w) w.anims = cloneAnims(pack);
    });
  } else if (selected){
    const w = doc.lines[selected.line]?.words[selected.word];
    if (w) w.anims = cloneAnims(pack);
  }
  pushHistory(); render(0,null);
  buildAnimationsUI();
});
applyAllBtn?.addEventListener("click", ()=>{
  const pack = cloneAnims(doc.anims||[]);
  doc.lines.forEach(line=> line.words.forEach(w=> w.anims = cloneAnims(pack)));
  pushHistory(); render(0,null);
  buildAnimationsUI();
});

/* ---------- Undo / Redo / Clear ---------- */
function deepCloneDocForHistory(d){
  const j = JSON.stringify({...d, multi:[]}); // ignore Set
  return JSON.parse(j);
}
function pushHistory(){
  history.past.push(deepCloneDocForHistory(doc));
  history.future = [];
  updateUndoRedo();
}
function restoreDocFromState(s){
  // assign primitives; rebuild images/gifs on demand if present
  doc.res = s.res;
  doc.lines = s.lines;
  doc.spacing = s.spacing;
  doc.anims = s.anims || [];
  doc.style = s.style || {};
  doc.multi = new Set();
  if (s.bg?.type === "gif" && s.bg.dataURL) {
    decodeGifBackground(s.bg.dataURL).then(decoded=>{
      doc.bg = { ...s.bg, gif: decoded || null, image:null };
      buildBgGrid(); showSolidTools(doc.bg?.type==="solid"); render(0,getDuration());
    });
  } else if (s.bg?.type==="image" && s.bg.dataURL) {
    const im=new Image(); im.onload=()=>{ doc.bg={...s.bg, image:im, gif:null}; buildBgGrid(); showSolidTools(false); render(0,getDuration()); };
    im.src = s.bg.dataURL;
  } else {
    doc.bg = s.bg || { type:"solid", color:"#000", image:null, preset:null, dataURL:null, gif:null };
    buildBgGrid(); showSolidTools(doc.bg?.type==="solid"); render(0,getDuration());
  }
}
function updateUndoRedo(){
  if (undoBtn) undoBtn.disabled = history.past.length<=1;
  if (redoBtn) redoBtn.disabled = history.future.length===0;
}
undoBtn?.addEventListener("click", ()=>{
  if (history.past.length>1){
    const cur = history.past.pop(); // current
    history.future.push(cur);
    const prev = history.past[history.past.length-1];
    restoreDocFromState(prev);
    updateUndoRedo();
  }
});
redoBtn?.addEventListener("click", ()=>{
  if (history.future.length){
    const next = history.future.pop();
    history.past.push(next);
    restoreDocFromState(next);
    updateUndoRedo();
  }
});
clearAllBtn?.addEventListener("click", ()=>{
  doc.lines = [{ words:[{ text:"", color:defaults.color, font:defaults.font, size:defaults.size }] }];
  selected = { line:0, word:0 }; doc.multi.clear();
  pushHistory(); render(0,null);
});

/* ---------- Config Import / Export ---------- */
function safeDocForExport() {
  const copy = JSON.parse(JSON.stringify(doc));
  if (copy.bg && copy.bg.gif) delete copy.bg.gif; // runtime cache only
  return copy;
}
saveJsonBtn?.addEventListener("click", ()=>{
  const payload = safeDocForExport();
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "led-backpack-config.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 8000);
});
loadJsonInput?.addEventListener("change", async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const txt = await f.text().catch(()=>null);
  if (!txt) return;
  let json = null;
  try { json = JSON.parse(txt); } catch{ return; }
  pushHistory(); // snapshot before load
  await applyImportedDoc(json);
  buildAnimationsUI();
});
async function applyImportedDoc(newDoc) {
  restoreDocFromState(newDoc);
}

/* ---------- Preview Loop ---------- */
let rafId = null;
let startT = 0;

function getFPS() {
  const v = parseInt(fpsInput?.value || "15", 10);
  return clamp(v||15,1,30);
}
function getDuration() {
  const v = parseInt(secondsInput?.value || "8", 10);
  return clamp(v||8,1,60);
}
function startPreview() {
  stopPreview();
  startT = performance.now();
  const dur = getDuration();
  if (tEnd) tEnd.textContent = `${dur.toFixed(1)}s`;

  function loop(now) {
    const secs = (now - startT) / 1000;
    const tt = secs % dur;

    render(tt, dur);

    if (progressFill) progressFill.style.setProperty("--p", (tt / dur));
    if (tCur) tCur.textContent = `${tt.toFixed(1)}s`;

    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}
function stopPreview() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  render(0, getDuration());
}

function setMode(m) {
  mode = m;
  modeEditBtn?.classList.toggle("active", m === "edit");
  modePreviewBtn?.classList.toggle("active", m === "preview");
  if (m === "preview") startPreview();
  else stopPreview();
}
modeEditBtn && modeEditBtn.addEventListener("click", () => setMode("edit"));
modePreviewBtn && modePreviewBtn.addEventListener("click", () => setMode("preview"));

/* ---------- GIF Encoder (local) ---------- */
async function ensureLocalGifLibs() {
  if (typeof GIFEncoder !== "undefined") return true;
  try {
    await loadScriptLocal("./assets/libs/jsgif/NeuQuant.js");
    await loadScriptLocal("./assets/libs/jsgif/LZWEncoder.js");
    await loadScriptLocal("./assets/libs/jsgif/GIFEncoder.js");
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

/* ---------- Render GIF (Preview image + Download file) ---------- */
previewBtn && previewBtn.addEventListener("click", async ()=>{
  const ok = await ensureLocalGifLibs(); if (!ok) return;
  const fps = getFPS();
  const secs = getDuration();
  const frames = Math.max(1, Math.floor(fps * secs));
  const delay = Math.max(1, Math.round(1000 / fps));

  const W = canvas.width = doc.res.w;
  const H = canvas.height = doc.res.h;

  const wasPreview = (mode === "preview");
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

      if (progressFill) progressFill.style.setProperty("--p", (t / secs) % 1);
      if (tCur) tCur.textContent = `${(t % secs).toFixed(1)}s`;
    }

    enc.finish();
    const blob = encoderToBlob(enc);
    const url = URL.createObjectURL(blob);

    // Show preview image under the controls (no new tab)
    if (gifPreviewImg) {
      gifPreviewImg.classList.remove("hidden");
      gifPreviewImg.src = url;
      gifPreviewImg.alt = "Animated GIF preview";
    }

  } catch (err) {
    console.error("GIF render failed:", err);
  } finally {
    if (wasPreview) startPreview();
  }
});
gifBtn && gifBtn.addEventListener("click", async ()=>{
  const ok = await ensureLocalGifLibs(); if (!ok) return;
  const fps = getFPS();
  const secs = getDuration();
  const frames = Math.max(1, Math.floor(fps * secs));
  const delay = Math.max(1, Math.round(1000 / fps));

  const W = canvas.width = doc.res.w;
  const H = canvas.height = doc.res.h;

  const wasPreview = (mode === "preview");
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
    }

    enc.finish();
    const blob = encoderToBlob(enc);
    const url = URL.createObjectURL(blob);
    const name = `${(fileNameInput?.value || "animation").replace(/\.(png|jpe?g|webp|gif)$/i, "")}.gif`;

    const a = document.createElement("a");
    a.href = url; a.download = name;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 15000);
  } catch (err) {
    console.error("GIF download failed:", err);
  } finally {
    if (wasPreview) startPreview();
  }
});

/* ---------- resolution change ---------- */
on(resSel,"change",()=>{
  const [w,h]=resSel.value.split("x").map(Number);
  doc.res={w,h};
  buildBgGrid(); showSolidTools(doc.bg?.type==="solid");
  pushHistory(); render(); fitZoom();
});

/* ---------- init ---------- */
function init(){
  buildBgGrid();
  rebuildBgSwatches();

  // default ON
  if (autoSizeChk) autoSizeChk.checked = true;

  // Make sure UI reflects first selected element
  selected = { line:0, word:0 };

  pushHistory();
  render();
  fitZoom();
  buildAnimationsUI();
}
init();
