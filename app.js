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
/* =====================================================
   PART 2 — Rendering, Text Editing, Animations Engine
   ===================================================== */

/* ---------- layout & measuring ---------- */
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
      const st = resolveStyle(w.style);
      ctx.font = `${st.fontSize}px ${st.fontFamily}`;
      return Math.ceil(ctx.measureText(w.text || "").width);
    });

    const gaps = Math.max(0, line.words.length - 1) * (doc.style.wordGap ?? defaults.wordGap);
    const w = line.words.length ? widths.reduce((a, b) => a + b, 0) + gaps : 0;

    const startX =
      doc.style.align === "left" ? 4 :
      doc.style.align === "center" ? (doc.res.w - w) / 2 :
      (doc.res.w - w - 4);

    let x = startX, y = startY + li * lineStep;
    line.words.forEach((_, wi) => {
      pos.push({ line: li, word: wi, x, y, width: widths[wi] });
      x += widths[wi] + (doc.style.wordGap ?? defaults.wordGap);
    });
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
  const p = layoutDocument().positions.find(v => v.line === li && v.word === wi);
  if (!p) return null;
  return { x: p.x, y: p.y - h, w, h };
}

/* ---------- caret & typing ---------- */
function measureCharWidths(text, fontSpec) {
  ctx.save();
  ctx.font = fontSpec;
  const arr = [];
  for (let i = 0; i < text.length; i++)
    arr.push(Math.ceil(ctx.measureText(text[i]).width));
  ctx.restore();
  return arr;
}

function caretFromClick(li, wi, clickX) {
  const line = doc.lines[li]; if (!line) return 0;
  const word = line.words[wi]; if (!word) return 0;
  const st = resolveStyle(word.style);
  const fontSpec = `${st.fontSize}px ${st.fontFamily}`;
  const widths = measureCharWidths(word.text || "", fontSpec);
  const pos = layoutDocument().positions.find(v => v.line === li && v.word === wi);
  if (!pos) return (word.text || "").length;
  let acc = pos.x;
  for (let i = 0; i < widths.length; i++) {
    const mid = acc + widths[i] / 2;
    if (clickX < mid) return i;
    acc += widths[i];
  }
  return widths.length;
}

/* ---------- easing & helpers ---------- */
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function colorToHue(hex){
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0,2),16)/255,
        g = parseInt(c.slice(2,4),16)/255,
        b = parseInt(c.slice(4,6),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h /= 6;
  }
  return Math.round(h*360);
}
const getActive = id => doc.animations.find(a => a.id === id);

/* ---------- animation engine ---------- */
function animatedProps(base, wordObj, t, totalDur){
  const props = { x:base.x, y:base.y, scale:1, alpha:1, text:wordObj.text||"", color:null, dx:0, dy:0, shadow:null, gradient:null, perChar:null };

  // Scroll
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

  // Pulse
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
    props.dx += Math.sin(t * 2 * Math.PI * f) * a * 3;
    props.dy += Math.cos(t * 2 * Math.PI * f) * a * 3;
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

  // Typewriter
  const type = getActive("typewriter");
  if (type && props.text) {
    const rate = Number(type.params.rate || 1);
    const cps  = 10 * rate;
    const shown = Math.max(0, Math.min(props.text.length, Math.floor(t * cps)));
    props.text = props.text.slice(0, shown);
  }

  // Color cycle / rainbow
  const cc = getActive("colorcycle");
  if (cc) {
    const sp = Number(cc.params.speed || 0.5);
    const base = (cc.params.start || "#ff0000");
    const hueBase = colorToHue(base);
    const hue = Math.floor((hueBase + (t * 60 * sp)) % 360);
    props.color = `hsl(${hue}deg 100% 60%)`;
  }

  const rainbow = getActive("rainbow");
  if (rainbow) {
    const speed = Number(rainbow.params.speed || 0.5);
    const base = (rainbow.params.start || "#ff00ff");
    const hueBase = colorToHue(base);
    props.gradient = { type: "rainbow", speed, base: hueBase };
  }

  return props;
}

/* ---------- background & main render ---------- */
function renderBg() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (doc.bg.type === "solid") {
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if (doc.bg.type === "image") {
    if (doc.bg.image) {
      try { ctx.drawImage(doc.bg.image, 0, 0, canvas.width, canvas.height); } catch {}
    } else if (doc.bg.preset) {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = doc.bg.preset;
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
    const fontSpec = `${fsize}px ${st.fontFamily}`;
    ctx.font = fontSpec;

    if (props.shadow) {
      ctx.shadowBlur = props.shadow.blur;
      ctx.shadowColor = props.shadow.color || st.color;
    } else ctx.shadowBlur = 0;

    let fillStyle = props.color || st.color;
    const baseX = p.x + (props.dx || 0), baseY = p.y + (props.dy || 0);

    // gradient fills
    if (props.gradient && txt.length) {
      const wordWidth = Math.ceil(ctx.measureText(txt).width);
      if (props.gradient.type === "rainbow") {
        const g = ctx.createLinearGradient(baseX, baseY, baseX + wordWidth, baseY);
        const baseHue = (props.gradient.base + (t * 120 * props.gradient.speed)) % 360;
        for (let i=0;i<=6;i++){
          const stop=i/6;
          const hue=Math.floor((baseHue+stop*360)%360);
          g.addColorStop(stop, `hsl(${hue}deg 100% 60%)`);
        }
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
    ctx.fillText(txt, baseX, baseY);
    ctx.restore();
  });
}
/* =====================================================
   PART 3 — Preview Loop, GIF Export, UI + Events
   ===================================================== */

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

    // progress bar sync
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

/* ---------- GIF export ---------- */
async function loadScript(src){return new Promise((r,j)=>{const s=document.createElement("script");s.src=src;s.async=true;s.onload=()=>r(true);s.onerror=j;document.head.appendChild(s);});}
async function ensureGifLibs(){
  if(typeof GIFEncoder!=="undefined")return true;
  const urls=[
    "https://cdn.jsdelivr.net/npm/jsgif@0.2.1/NeuQuant.js",
    "https://cdn.jsdelivr.net/npm/jsgif@0.2.1/LZWEncoder.js",
    "https://cdn.jsdelivr.net/npm/jsgif@0.2.1/GIFEncoder.js"
  ];
  for(const u of urls)await loadScript(u);
  return typeof GIFEncoder!=="undefined";
}
function encoderToBlob(enc){
  const bytes=enc.stream().bin||enc.stream().getData();
  const u8=(bytes instanceof Uint8Array)?bytes:new Uint8Array(bytes);
  return new Blob([u8],{type:"image/gif"});
}

async function renderGif(previewOnly=false){
  const fps=getFPS(), secs=getTotalSeconds(), frames=fps*secs, delay=Math.round(1000/fps);
  const W=canvas.width, H=canvas.height;

  if(!(await ensureGifLibs())){alert("GIF encoder failed to load (stay online).");return;}
  const enc=new GIFEncoder(); enc.setRepeat(0); enc.setDelay(delay); enc.setQuality(10); enc.setSize(W,H); enc.start();

  const wasPrev=(mode==="preview"); if(wasPrev)stopPreview();
  for(let i=0;i<frames;i++){const t=i/fps; render(t,secs); enc.addFrame(ctx);}
  enc.finish();
  const blob=encoderToBlob(enc);
  const url=URL.createObjectURL(blob);
  const name=(fileNameInput.value||"animation.gif").replace(/\.(png|jpg|jpeg|webp)$/i,".gif");
  gifPreviewImg.classList.remove("hidden");
  gifPreviewImg.src=url;
  if(!previewOnly){
    const a=document.createElement("a"); a.href=url; a.download=name; a.click();
  }
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  if(wasPrev)startPreview();
}

/* ---------- UI wiring ---------- */
function setMode(m) {
  mode = m;
  modeEditBtn?.classList.toggle("active", m === "edit");
  modePrevBtn?.classList.toggle("active", m !== "edit");
  if (mode === "preview") startPreview();
  else stopPreview();
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

/* ---------- click selection & typing ---------- */
on(canvas,"click",(e)=>{
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/zoom, y=(e.clientY-rect.top)/zoom;
  const pos=layoutDocument().positions;
  let hit=null;
  pos.forEach(p=>{
    const b=measureWordBBox(p.line,p.word); if(!b)return;
    if(x>=b.x-2&&x<=b.x+b.w+2&&y>=b.y-2&&y<=b.y+b.h+2)hit=p;
  });
  if(hit){selected={line:hit.line,word:hit.word,caret:caretFromClick(hit.line,hit.word,x)};render(0,getTotalSeconds());}
  else{selected=null;render(0,getTotalSeconds());}
});

/* simple typing */
on(document,"keydown",(e)=>{
  if(mode!=="edit"||!selected)return;
  const line=doc.lines[selected.line],word=line.words[selected.word];
  if(!word)return;
  const text=word.text||"",pos=selected.caret??text.length;

  if(e.key.length===1&&!e.metaKey&&!e.ctrlKey){e.preventDefault();
    word.text=text.slice(0,pos)+e.key+text.slice(pos);
    selected.caret=pos+1; render(0,getTotalSeconds()); return;}
  if(e.key==="Backspace"){e.preventDefault();
    if(pos>0){word.text=text.slice(0,pos-1)+text.slice(pos);selected.caret=pos-1;}
    render(0,getTotalSeconds());}
});

/* ---------- inspector toggle ---------- */
on(inspectorToggle,"click",()=>{
  const open=!inspectorBody.classList.contains("open");
  inspectorBody.classList.toggle("open",open);
  inspectorToggle.setAttribute("aria-expanded",String(open));
  setTimeout(fitZoom,60);
});

/* ---------- buttons / sliders ---------- */
on(modePrevBtn,"click",()=>setMode("preview"));
on(modeEditBtn,"click",()=>setMode("edit"));
zoomSlider && on(zoomSlider,"input",(e)=>setZoom(parseFloat(e.target.value)));
fitBtn && on(fitBtn,"click",fitZoom);
on(previewBtn,"click",()=>{startPreview();});
on(gifBtn,"click",()=>renderGif(false));

/* ---------- backgrounds UI ---------- */
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
        bgUpload.click(); return;
      }
      render(0, getTotalSeconds());
      fitZoom();
    });

    bgGrid.appendChild(d);
  });

  const first = $(".bg-tile", bgGrid);
  if (first) first.classList.add("active");
}
function showSolidTools(show) {
  bgSolidTools.classList.toggle("hidden", !show);
}
on(bgUpload, "change", (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {
    URL.revokeObjectURL(url);
    doc.bg = { type:"image", color:null, image:im, preset:null };
    showSolidTools(false);
    render(0, getTotalSeconds());
    fitZoom();
    $$(".bg-tile", bgGrid).forEach(x => x.classList.remove("active"));
  };
  im.src = url;
});

/* ---------- init ---------- */
function init(){
  buildBgGrid();
  setMode("edit");
  render(0,getTotalSeconds());
  fitZoom();
}
init();
