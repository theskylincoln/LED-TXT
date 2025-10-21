/* ===============================
   LED Backpack Animator — app.js
   (Glass cyberpunk UI; on-canvas typing; inline GIF export)
   =============================== */

/* ---------- tiny helpers ---------- */
const $  = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

/* ---------- DOM ---------- */
const canvas = $("#led"), ctx = canvas.getContext("2d"), wrap = $(".canvas-wrap");
const resSel = $("#resSelect");
const bgGrid = $("#bgGrid");
const bgSolidTools = $("#bgSolidTools");
const bgSolidColor = $("#bgSolidColor");
const bgUpload = $("#bgUpload");

const zoomSlider = $("#zoom");
const fitBtn = $("#fitBtn");

const modeEditBtn = $("#modeEdit");
const modePrevBtn = $("#modePreview");

const addWordBtn = $("#addWordBtn");
const addLineBtn = $("#addLineBtn");
const deleteWordFx = $("#deleteWordBtn");

const inspectorToggle = $("#toggleInspector");
const inspectorBody = $("#inspectorBody");
const toolbarTabs = $$(".toolbar .tab");
const accFont   = $("#accFont");
const accLayout = $("#accLayout");
const accAnim   = $("#accAnim");

const fontSel        = $("#fontSelect");
const fontSizeInput  = $("#fontSize");
const autoSizeChk    = $("#autoSize");
const fontColorInput = $("#fontColor");

const lineGapInput = $("#lineGap");
const wordGapInput = $("#wordGap");
const alignBtns  = $$("[data-align]");
const valignBtns = $$("[data-valign]");

const swatchesWrap   = $("#swatches");
const addSwatchBtn   = $("#addSwatchBtn");
const bgSwatches     = $("#bgSwatches");
const addBgSwatchBtn = $("#addBgSwatchBtn");

const saveJsonBtn   = $("#saveJsonBtn");
const loadJsonInput = $("#loadJsonInput");

const fileNameInput  = $("#fileName");
const fpsInput       = $("#fps");
const secInput       = $("#seconds");
const downloadGifBtn = $("#downloadGifBtn");

const animList   = $("#animList");

const aboutBtn = $("#aboutBtn");
$("#aboutClose")?.addEventListener("click", () => $("#aboutModal").classList.add("hidden"));
aboutBtn?.addEventListener("click", () => $("#aboutModal").classList.remove("hidden"));

/* ---------- state ---------- */
let mode = "edit";
let zoom = parseFloat(zoomSlider.value || "0.8");
const PAD = { x: 14, top: 14, bottom: 18 }; // safe margins to avoid clipping/glow cutoffs
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
let customPalette = [], customBgPalette = [];

// DEFAULT DOCUMENT
let doc = {
  res: { w: 96, h: 128 },
  lines: [
    { words: [ { text: "WILL",     style:{ color:"#1E90FF" } } ] }, // blue
    { words: [ { text: "WHEELIE",  style:{ color:"#32CD32" } } ] }, // green
    { words: [ { text: "FOR",      style:{ color:"#FFFFFF" } } ] }, // white
    { words: [ { text: "BOOKTOK",  style:{ color:"#FF66CC" } } ] }, // pink
    { words: [ { text: "GIRLIES",  style:{ color:"#FF3333" } } ] }, // red
  ],
  style: {
    ...defaults
  },
  bg: { type:"image", preset:"assets/presets/96x128/Preset_A.png"},
  animations: [
    { id:"pulse", params:{ scale:0.02, vy:2 } },       // soft breathe
    { id:"glow",  params:{ intensity:0.35 } },         // subtle glow
    { id:"sweep", params:{ speed:0.5, width:0.18 } }   // highlight sweep
  ]
};
let selected = { line: 0, word: 0, caret: 5 };

let history = [], future = [];
const MAX_STACK = 100;

/* ---------- presets (paths auto-work on GitHub Pages) ---------- */
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

/* ---------- build BG selector ---------- */
function buildBgGrid() {
  bgGrid.innerHTML = "";
  const set = visibleSet();
  const tiles = [
    {...set[0], kind: "preset", label:"Preset 1"},
    {...set[1], kind: "preset", label:"Preset 2"},
    {kind: "solid", label:"Solid",  thumb:"assets/thumbs/Solid_thumb.png"},
    {kind: "upload",label:"Upload", thumb:"assets/thumbs/Upload_thumb.png"},
  ];
  tiles.forEach((t) => {
    const d = document.createElement("div");
    d.className = "bg-tile";
    d.dataset.kind = t.kind;

    const lab = document.createElement("div"); 
    lab.className = "lab"; 
    lab.textContent = t.label;
    d.appendChild(lab);

    const img = document.createElement("img");
    img.alt = t.label;
    img.draggable = false;
    img.src = t.kind === "preset" ? t.thumb : (t.thumb || "");
    d.appendChild(img);

    d.addEventListener("click", async () => {
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
      }
      render(0, null); fitZoom();
    });

    bgGrid.appendChild(d);
  });

  // activate current
  activateTile(doc.bg?.type==="solid" ? "solid" : "preset");
}
function setInitialBackground(){
  if (doc.bg && (doc.bg.type === "solid" || doc.bg.image || doc.bg.preset)) {
    if (doc.bg.type === "image" && !doc.bg.image && doc.bg.preset){
      const im = new Image(); im.crossOrigin="anonymous"; im.src = doc.bg.preset;
      im.onload = ()=>{ doc.bg.image = im; render(0,null); fitZoom(); };
    } else { render(0,null); fitZoom(); }
    showSolidTools(doc.bg.type==="solid");
    return;
  }
  const set = visibleSet();
  if (set && set[0]) {
    const im = new Image(); im.crossOrigin="anonymous"; im.src = set[0].full;
    im.onload = () => {
      doc.bg = { type:"image", color:null, image:im, preset:set[0].full };
      render(0,null); fitZoom();
    };
  } else {
    doc.bg = { type:"solid", color:"#000000", image:null, preset:null };
    render(0,null); fitZoom(); showSolidTools(true);
  }
}
function activateTile(kind) {
  const tiles = $$(".bg-tile", bgGrid);
  tiles.forEach((t) => {
    const k = t.dataset.kind;
    t.classList.toggle("active", k === kind);
  });
}
function showSolidTools(on) { bgSolidTools.style.display = on ? "" : "none"; }

bgUpload.addEventListener("change", (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {
    URL.revokeObjectURL(url);
    doc.bg = { type:"image", color:null, image:im, preset:null };
    showSolidTools(false); render(0, null); fitZoom(); activateTile("upload");
  };
  im.src = url;
});

/* ---------- history ---------- */
function pushHistory() { history.push(JSON.stringify(doc)); if (history.length > MAX_STACK) history.shift(); future.length = 0; }
function undo() { if (!history.length) return; future.push(JSON.stringify(doc)); doc = JSON.parse(history.pop()); render(0, null); }
function redo() { if (!future.length) return; history.push(JSON.stringify(doc)); doc = JSON.parse(future.pop()); render(0, null); }
$("#undoBtn")?.addEventListener("click", undo);
$("#redoBtn")?.addEventListener("click", redo);
$("#clearAllBtn")?.addEventListener("click", ()=>{ pushHistory(); doc.lines=[{words:[{text:""}]}]; selected={line:0,word:0,caret:0}; render(0,null); });

/* ---------- zoom / fit ---------- */
function setMode(m) {
  mode = m;
  modeEditBtn.classList.toggle("active", m === "edit");
  modePrevBtn.classList.toggle("active", m !== "edit");
}
function setZoom(z) {
  zoom = z;
  zoomSlider.value = String(z.toFixed(2));
  canvas.style.transform = `translate(-50%,-50%) scale(${zoom})`;
}
function fitZoom() {
  const pad = 18;
  const r = wrap.getBoundingClientRect();
  const availW = Math.max(40, r.width - pad * 2);
  const availH = Math.max(40, r.height - pad * 2);
  const s = Math.max(0.1, Math.min(availW / doc.res.w, availH / doc.res.h));
  setZoom(s);
}
window.addEventListener("resize", fitZoom);
window.addEventListener("orientationchange", () => setTimeout(fitZoom, 200));
fitBtn.addEventListener("click", fitZoom);
zoomSlider.addEventListener("input", (e) => setZoom(parseFloat(e.target.value)));

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
  let startY;
  if (doc.style.valign === "top") startY = PAD.top + fs;
  else if (doc.style.valign === "middle") startY = (doc.res.h - PAD.top - PAD.bottom - totalH) / 2 + PAD.top + fs;
  else startY = doc.res.h - PAD.bottom - totalH + fs - 4;

  const availW = doc.res.w - PAD.x * 2;

  doc.lines.forEach((line, li) => {
    const widths = line.words.map(w => {
      const st = resolveStyle(w.style); ctx.font = `${st.fontSize}px ${st.fontFamily}`;
      return Math.ceil(ctx.measureText(w.text || "").width);
    });
    const gaps = Math.max(0, line.words.length - 1) * (doc.style.wordGap ?? defaults.wordGap);
    const w = line.words.length ? widths.reduce((a, b) => a + b, 0) + gaps : 0;
    const startX = (doc.style.align === "left") ? PAD.x :
                   (doc.style.align === "center") ? PAD.x + Math.max(0, (availW - w) / 2) :
                   (PAD.x + Math.max(0, availW - w));
    let x = startX, y = startY + li * lineStep;
    line.words.forEach((_, wi) => { pos.push({ line: li, word: wi, x, y, width: widths[wi] }); x += widths[wi] + (doc.style.wordGap ?? defaults.wordGap); });
  });
  return { positions: pos, availW };
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

/* ---------- animations (subset, stackable) ---------- */
const ANIMS = [
  { id:"pulse", name:"Pulse / Breathe", params:{ scale:0.03, vy:4 } },
  { id:"sweep", name:"Highlight Sweep", params:{ speed:0.7, width:0.25 } },
  { id:"glow",  name:"Glow Pulse",      params:{ intensity:0.6 } },
];
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function colorToHue(hex){
  const c=hex.replace("#",""); const r=parseInt(c.slice(0,2),16)/255,g=parseInt(c.slice(2,4),16)/255,b=parseInt(c.slice(4,6),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0; if(max!==min){const d=max-min; switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6;}
  return Math.round(h*360);
}
const getActive = id => doc.animations.find(a => a.id === id);

function animatedProps(base, wordObj, t){
  const props = { x:base.x, y:base.y, scale:1, alpha:1, text:wordObj.text||"", color:null, dx:0, dy:0, shadow:null, gradient:null, perChar:null };

  const pulse = getActive("pulse");
  if (pulse) {
    const s = Number(pulse.params.scale || 0.03);
    const vy = Number(pulse.params.vy || 4);
    props.scale *= 1 + (Math.sin(t * 2 * Math.PI) * s);
    props.dy    += Math.sin(t * 2 * Math.PI) * vy;
  }

  const sweep = getActive("sweep");
  if (sweep) {
    const speed = Number(sweep.params.speed || 0.7), width = Number(sweep.params.width || 0.25);
    props.gradient = { type: "sweep", speed, width };
  }

  const glow = getActive("glow");
  if (glow) {
    const intensity = Math.max(0, Number(glow.params.intensity || 0.6));
    const k = (Math.sin(t * 2 * Math.PI * 1.2) * 0.5 + 0.5) * intensity;
    props.shadow = { blur: 6 + k * 10, color: props.color || null };
  }
  return props;
}

function measureCharWidths(text, fontSpec){
  ctx.save(); ctx.font = fontSpec; const arr = [];
  for (let i = 0; i < text.length; i++) arr.push(Math.ceil(ctx.measureText(text[i]).width));
  ctx.restore(); return arr;
}

/* ---------- render ---------- */
function renderBg() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (doc.bg.type === "solid") {
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if (doc.bg.type === "image" && doc.bg.image) {
    try { ctx.drawImage(doc.bg.image, 0, 0, canvas.width, canvas.height); } catch {}
  }
}

let caretBlink = true;
let caretTimer = setInterval(()=>{ caretBlink = !caretBlink; if(mode==="edit") render(0,null); }, 500);

function drawCaret(p, st, baseX, baseY){
  if (!selected) return;
  if (!caretBlink) return;
  const t = currentWordText();
  const pos = selected?.caret ?? t.length;
  ctx.save();
  ctx.font = `${st.fontSize}px ${st.fontFamily}`;
  const widths = measureCharWidths(t.slice(0,pos), `${st.fontSize}px ${st.fontFamily}`);
  const caretX = baseX + (widths.length ? widths.reduce((a,b)=>a+b,0) : 0);
  const h = Math.ceil(st.fontSize * 1.15);
  ctx.fillStyle = "#ff7ad9";  // magenta
  ctx.globalAlpha = 0.9;
  ctx.fillRect(caretX, baseY - h, 2, h);
  ctx.restore();
}

function render(t = 0) {
  canvas.width  = doc.res.w;
  canvas.height = doc.res.h;

  renderBg();

  const layout = layoutDocument();
  layout.positions.forEach((p) => {
    const word = doc.lines[p.line].words[p.word];
    const st = resolveStyle(word.style);
    const props = animatedProps(p, word, t);
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

    if (props.gradient && txt.length && props.gradient.type === "sweep") {
      const wordWidth = Math.ceil(ctx.measureText(txt).width);
      const band = Math.max(0.05, Math.min(0.8, props.gradient.width || 0.25));
      const pos  = (t * (props.gradient.speed || 0.7) * 1.2) % 1;
      const g = ctx.createLinearGradient(baseX, baseY, baseX + wordWidth, baseY);
      const a = Math.max(0, pos - band/2), b = Math.min(1, pos + band/2);
      g.addColorStop(0, fillStyle); g.addColorStop(a, fillStyle);
      g.addColorStop(pos, "#FFFFFF"); g.addColorStop(b, fillStyle); g.addColorStop(1, fillStyle);
      fillStyle = g;
    }
    ctx.fillStyle = fillStyle;
    ctx.fillText(txt, baseX, baseY);

    // caret for selected
    const isSel = selected && selected.line === p.line && selected.word === p.word;
    if (isSel && mode === "edit") drawCaret(p, st, baseX, baseY);

    // selection box + delete pin
    if (isSel) {
      const box = measureWordBBox(p.line, p.word);
      if (box) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,0,255,0.95)";
        ctx.lineWidth = 1; ctx.setLineDash([3,2]);
        ctx.shadowColor="rgba(255,0,255,0.85)"; ctx.shadowBlur=6;
        ctx.strokeRect(box.x-1, box.y-1, box.w+2, box.h+2);
        ctx.restore();

        // position × inside top-right
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

/* ---------- preview loop ---------- */
let rafId = null, t0 = null;
function startPreview() {
  if (rafId) cancelAnimationFrame(rafId);
  t0 = performance.now();
  const loop = (now) => {
    const t = (now - t0) / 1000;
    render(t);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}
function stopPreview() { if (rafId) cancelAnimationFrame(rafId); rafId = null; render(0); }

/* ---------- swatches ---------- */
function drawSwatchesUI(){
  const make=(wrap, list, isBg=false)=>{
    wrap.innerHTML = "";
    list.forEach(c=>{
      const d=document.createElement("div"); d.className="swatch"; d.style.background=c;
      d.addEventListener("click", ()=>{
        if(isBg){ doc.bg = { type:"solid", color:c, image:null, preset:null }; showSolidTools(true); activateTile("solid"); }
        else    { doc.style.color = c; fontColorInput.value = c; const w = doc.lines[selected?.line]?.words[selected?.word]; if (w) w.style={...w.style, color:c}; }
        render(0);
      });
      wrap.appendChild(d);
    });
  };
  make(swatchesWrap, [...defaultPalette, ...customPalette], false);
  make(bgSwatches,   [...defaultPalette, ...customBgPalette], true);
}
addSwatchBtn.addEventListener("click", ()=>{
  const c = fontColorInput.value;
  if(!defaultPalette.includes(c) && !customPalette.includes(c)) customPalette.push(c);
  drawSwatchesUI();
});
addBgSwatchBtn.addEventListener("click", ()=>{
  const c = bgSolidColor.value;
  if(!defaultPalette.includes(c) && !customBgPalette.includes(c)) customBgPalette.push(c);
  drawSwatchesUI();
});
bgSolidColor.addEventListener("input", ()=>{
  doc.bg = { type:"solid", color:bgSolidColor.value, image:null, preset:null };
  render(0);
});

/* ---------- Inspector & controls ---------- */
function openInspector(open=true){ inspectorBody.classList.toggle("open", open); inspectorToggle.setAttribute("aria-expanded", String(open)); }
inspectorToggle.addEventListener("click", ()=>{ const open=!inspectorBody.classList.contains("open"); openInspector(open); setTimeout(fitZoom,60); });
[accFont,accLayout,accAnim].forEach(a => a.addEventListener("toggle", ()=>{ if (a.open) [accFont,accLayout,accAnim].filter(x=>x!==a).forEach(x=>x.open=false); }));

toolbarTabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const id = btn.getAttribute("data-acc");
    const panel = document.getElementById(id);
    if (panel) { panel.open = true; [accFont,accLayout,accAnim].filter(x=>x!==panel).forEach(x=>x.open=false); openInspector(true); setTimeout(fitZoom,60); }
  });
});

// resolution
resSel.addEventListener("change", ()=>{
  const [w,h] = resSel.value.split("x").map(Number);
  doc.res = {w,h};
  buildBgGrid(); setInitialBackground();
  render(0); fitZoom();
});

// stage add
addLineBtn.addEventListener("click", ()=>{
  pushHistory(); doc.lines.push({words:[{text:""}]});
  selected = { line: doc.lines.length-1, word: 0, caret: 0 }; openInspector(true);
  render(0); focusCanvasIME();
});
addWordBtn.addEventListener("click", ()=>{
  pushHistory(); const line = doc.lines[selected?.line ?? 0] || doc.lines[0];
  line.words.push({text:""}); selected = { line: doc.lines.indexOf(line), word: line.words.length-1, caret: 0 };
  openInspector(true); render(0); focusCanvasIME();
});

/* ---------- on-canvas typing (IME hidden) ---------- */
const ime = document.createElement('textarea');
Object.assign(ime.style, { position:'absolute', left:'-9999px', top:'-9999px', width:'1px', height:'1px', opacity:'0', pointerEvents:'none' });
document.body.appendChild(ime);

function currentWordText(){ if(!selected) return ""; const line=doc.lines[selected.line]; if(!line) return ""; const word=line.words[selected.word]; return word?.text || ""; }
function placeIMEAtCanvas(x, y){
  const rect = canvas.getBoundingClientRect();
  ime.style.left = `${rect.left + x * zoom}px`;
  ime.style.top  = `${rect.top + y * zoom}px`;
}
function focusCanvasIME(){
  if(!selected) return;
  const pos=layoutDocument().positions.find(p=>p.line===selected.line && p.word===selected.word);
  if (!pos) return;
  placeIMEAtCanvas(pos.x, pos.y);
  ime.value = currentWordText();
  ime.setSelectionRange(selected.caret ?? ime.value.length, selected.caret ?? ime.value.length);
  ime.focus();
}

canvas.addEventListener("click", (e)=>{
  const rect=canvas.getBoundingClientRect(); const x=(e.clientX-rect.left)/zoom, y=(e.clientY-rect.top)/zoom;
  const pos=layoutDocument().positions; let hit=null;
  pos.forEach(p=>{ const b=measureWordBBox(p.line,p.word); if(!b) return; if(x>=b.x-2 && x<=b.x+b.w+2 && y>=b.y-2 && y<=b.y+b.h+2) hit=p; });
  if (hit){
    selected = { line: hit.line, word: hit.word, caret: currentWordText().length };
    if (mode === "preview"){ setMode("edit"); stopPreview(); }
    openInspector(true); render(0); placeIMEAtCanvas(x,y); ime.focus();
  }
});

ime.addEventListener("input", ()=>{
  if(!selected) return;
  const line = doc.lines[selected.line]; if(!line) return;
  const word = line.words[selected.word]; if(!word) return;
  pushHistory();
  word.text = ime.value; selected.caret = word.text.length; autoSizeIfOn(); render(0);
});

document.addEventListener("keydown", (e)=>{
  if (mode !== "edit") return;
  if (!selected) return;

  const line = doc.lines[selected.line]; if(!line) return;
  const word = line.words[selected.word]; if(!word) return;

  if (["Meta","Control","Alt"].includes(e.key)) return;

  if (e.key === "Enter"){ e.preventDefault();
    pushHistory(); doc.lines.splice(selected.line+1,0,{words:[{text:""}]});
    selected = { line:selected.line+1, word:0, caret:0 }; render(0); focusCanvasIME(); return;
  }
  if (e.key === " " && !e.ctrlKey && !e.metaKey){ e.preventDefault();
    pushHistory(); line.words.splice(selected.word+1,0,{text:""}); selected = { line:selected.line, word:selected.word+1, caret:0 };
    render(0); focusCanvasIME(); return;
  }
  if (e.key === "Backspace"){ e.preventDefault();
    pushHistory();
    const t = word.text || "";
    if (!t.length){
      line.words.splice(selected.word,1);
      if (!line.words.length){ doc.lines.splice(selected.line,1); selected = doc.lines.length? {line:0,word:0,caret:0} : null; deleteWordFx.classList.add("hidden"); }
      else selected.word = Math.max(0, selected.word-1);
    } else {
      word.text = t.slice(0,-1);
      selected.caret = Math.max(0, (selected.caret ?? t.length)-1);
    }
    autoSizeIfOn(); render(0); focusCanvasIME(); return;
  }
  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey){ e.preventDefault();
    pushHistory();
    const t = word.text || "";
    const pos = (selected.caret == null) ? t.length : selected.caret;
    word.text = t.slice(0,pos) + e.key + t.slice(pos);
    selected.caret = pos + 1; autoSizeIfOn(); render(0); focusCanvasIME();
  }
});

// delete word
deleteWordFx.addEventListener("click", ()=>{
  if (!selected) return;
  pushHistory();
  const line = doc.lines[selected.line]; if(!line) return;
  line.words.splice(selected.word, 1);
  if (!line.words.length){ doc.lines.splice(selected.line,1); selected = doc.lines.length? {line:0,word:0,caret:0} : null; }
  else selected.word = Math.max(0, selected.word-1);
  deleteWordFx.classList.add("hidden"); render(0);
});

/* ---------- font/spacing controls ---------- */
function applyStyleToCurrent(fn){
  const w = doc.lines[selected?.line]?.words[selected?.word];
  if (w) fn(w);
}
fontSel.addEventListener("change", ()=>{ doc.style.fontFamily = fontSel.value; applyStyleToCurrent(w=> w.style={...w.style, fontFamily:fontSel.value}); render(0); });
fontSizeInput.addEventListener("input", ()=>{ const v = Math.max(6, Math.min(64, +fontSizeInput.value||22)); doc.style.fontSize=v; applyStyleToCurrent(w=> w.style={...w.style, fontSize:v}); autoSizeIfOn(); render(0); });
fontColorInput.addEventListener("input", ()=>{ const v = fontColorInput.value; doc.style.color=v; applyStyleToCurrent(w=> w.style={...w.style, color:v}); render(0); });
lineGapInput.addEventListener("input", ()=>{ doc.style.lineGap = +lineGapInput.value || 4; render(0); fitZoom(); });
wordGapInput.addEventListener("input", ()=>{ doc.style.wordGap = +wordGapInput.value || 6; render(0); fitZoom(); });
alignBtns.forEach(b => b.addEventListener("click", ()=>{ alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); doc.style.align=b.dataset.align; render(0); }));
valignBtns.forEach(b => b.addEventListener("click", ()=>{ valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); doc.style.valign=b.dataset.valign; render(0); fitZoom(); }));

function autoSizeIfOn() {
  if (!autoSizeChk.checked) return;
  const layout = layoutDocument();
  const W = doc.res.w - PAD.x * 2;
  layout.positions.forEach(p=>{
    const w = doc.lines[p.line].words[p.word];
    const st = resolveStyle(w.style);
    ctx.font = `${st.fontSize}px ${st.fontFamily}`;
    const textW = Math.ceil(ctx.measureText(w.text||"").width);
    const overshoot = (p.x - PAD.x) + textW - W;
    if (overshoot > 0) { // shrink
      const s = Math.max(6, Math.floor(st.fontSize * (W / (textW + 1))));
      w.style = {...w.style, fontSize: s};
    }
  });
}

/* ---------- Animations UI ---------- */
function buildAnimUI(){
  animList.innerHTML="";
  ANIMS.forEach(a=>{
    const row=document.createElement("div"); row.style.display="flex"; row.style.gap="6px"; row.style.alignItems="center"; row.style.flexWrap="wrap";
    const chk=document.createElement("input"); chk.type="checkbox"; chk.id="anim_"+a.id;
    const lbl=document.createElement("label"); lbl.htmlFor=chk.id; lbl.textContent=a.name;
    const gear=document.createElement("button"); gear.textContent="⚙"; gear.className="chip tiny";
    const params=document.createElement("div"); params.style.display="none"; params.style.margin="6px 0";

    Object.keys(a.params).forEach(k=>{
      const p=document.createElement("div"); p.style.display="inline-flex"; p.style.gap="6px"; p.style.marginRight="8px"; p.style.alignItems="center";
      const lab=document.createElement("span"); lab.textContent=k[0].toUpperCase()+k.slice(1);
      const inp=document.createElement("input"); inp.value=a.params[k];
      if (k==="width"||k==="scale"||k==="intensity"||k==="speed"||k==="vy") inp.type="number";
      inp.addEventListener("input", ()=>{ const t=doc.animations.find(x=>x.id===a.id); if(t) t.params[k] = (inp.type==="number"? +inp.value : inp.value); });
      p.appendChild(lab); p.appendChild(inp); params.appendChild(p);
    });

    gear.addEventListener("click", ()=> params.style.display = params.style.display==="none" ? "block" : "none");
    chk.addEventListener("change", ()=>{
      const found = doc.animations.find(x=>x.id===a.id);
      if (chk.checked && !found) doc.animations.push({ id:a.id, params:{...a.params} });
      else if (!chk.checked) doc.animations = doc.animations.filter(x=>x.id!==a.id);
    });

    // set initial checkbox state
    chk.checked = !!doc.animations.find(x=>x.id===a.id);

    row.appendChild(chk); row.appendChild(lbl); row.appendChild(gear); row.appendChild(params);
    animList.appendChild(row);
  });
}

/* ---------- Config ---------- */
saveJsonBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(doc,null,2)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download="config.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
});
loadJsonInput.addEventListener("change",(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ try{ doc=JSON.parse(r.result); render(0); fitZoom(); }catch(err){ alert("Invalid config"); } }; r.readAsText(f);
});

/* ---------- Inline GIF Export (omggif + MMCQ quantizer) ---------- */
/*! omggif (GIFEncoder/GIFWriter) – MIT – https://github.com/deanm/omggif */
function GifWriter(buf, width, height, gopts) {
  this.buf = buf; this.cursor = 0;
  var p = this.write; p.call(this, [0x47,0x49,0x46,0x38,0x39,0x61]); // GIF89a
  this.width = width; this.height = height;
  this.writeShort(width); this.writeShort(height);
  var gp = (gopts && gopts.palette) || null;
  var gctFlag = gp ? 0x80 : 0; var colorRes = 7; var sorted = 0; var gctSize = gp ? (Math.log(gp.length)/Math.log(2) -1) : 0;
  this.writeByte(gctFlag | (colorRes<<4) | (sorted<<3) | (gp ? gctSize : 0));
  this.writeByte(0); this.writeByte(0); // bg + pixel aspect
  if (gp) { for (var i=0;i<gp.length;i++){ var c=gp[i]; this.writeByte((c>>16)&255); this.writeByte((c>>8)&255); this.writeByte(c&255);} }
}
GifWriter.prototype.write = function(arr){ for(var i=0;i<arr.length;i++) this.buf[this.cursor++] = arr[i]; };
GifWriter.prototype.writeByte = function(v){ this.buf[this.cursor++] = v&255; };
GifWriter.prototype.writeShort = function(v){ this.writeByte(v); this.writeByte(v>>8); };
GifWriter.prototype.addFrame = function (x, y, w, h, indexedPixels, opts) {
  var lzwMinCodeSize = Math.max(2, Math.ceil(Math.log(Math.max(2, (opts.palette ? opts.palette.length : 256)))/Math.log(2)));
  // GCE
  this.write([0x21,0xF9,0x04, (opts.disposal||0)<<2 | 0, (opts.delay||0)&255, ((opts.delay||0)>>8)&255, (opts.transparent===!0?0:0), 0]);
  // Image Descriptor
  this.write([0x2C]); this.writeShort(x); this.writeShort(y); this.writeShort(w); this.writeShort(h);
  var lctFlag = opts.palette ? 0x80 : 0; var interlace=0; var sorted=0; var lctSize = opts.palette ? (Math.log(opts.palette.length)/Math.log(2) -1) : 0;
  this.writeByte(lctFlag | (interlace<<6)|(sorted<<5)|lctSize);
  if (opts.palette) for (var i=0;i<opts.palette.length;i++){ var c=opts.palette[i]; this.writeByte((c>>16)&255); this.writeByte((c>>8)&255); this.writeByte(c&255); }
  this.writeByte(lzwMinCodeSize);
  // LZW encode
  var subLenIdx = this.cursor; this.writeByte(0); // placeholder
  var i, len = indexedPixels.length;
  var clearCode = 1 << lzwMinCodeSize, eoiCode = clearCode + 1, nextCode = eoiCode + 1, codeSize = lzwMinCodeSize + 1;
  var out = []; function writeBits(val, size) { for(var i=0;i<size;i++){ cur|=((val>>i)&1)<<bitPos; bitPos++; if (bitPos>=8){ out.push(cur); cur=0; bitPos=0; if (out.length>=255){ self.writeByte(255); self.write(out); out=[]; } } } }
  var self=this, cur=0, bitPos=0;
  function flush(){ if(bitPos>0){ out.push(cur); cur=0; bitPos=0; } if(out.length){ self.writeByte(out.length); self.write(out); out=[]; } }
  writeBits(clearCode, codeSize);
  var dict = new Map(); function key(a,b){ return (a<<8)|b; }
  var prev = indexedPixels[0];
  for (i=1;i<len;i++){
    var k = key(prev, indexedPixels[i]);
    if (dict.has(k)) { prev = dict.get(k); }
    else {
      writeBits(prev, codeSize);
      dict.set(k, nextCode++);
      if (nextCode === (1<<codeSize)) codeSize++;
      prev = indexedPixels[i];
    }
  }
  writeBits(prev, codeSize);
  writeBits(eoiCode, codeSize);
  flush();
  this.writeByte(0); // block terminator
};
GifWriter.prototype.end = function(){ this.write([0x3B]); return this.buf.subarray(0, this.cursor); };

/*! MMCQ quantizer (modified) – MIT – based on https://github.com/olav/extract-colors*/
function quantizeMMCQ(pixels, maxcolors){
  function VBox(r1,r2,g1,g2,b1,b2,histo){ this.r1=r1;this.r2=r2;this.g1=g1;this.g2=g2;this.b1=b1;this.b2=b2; this.histo=histo; this._count=-1; this._avg=null; }
  VBox.prototype.count=function(){ if(this._count<0){ var c=0; for(var r=this.r1;r<=this.r2;r++) for(var g=this.g1;g<=this.g2;g++) for(var b=this.b1;b<=this.b2;b++){ var idx=(r<<10)+(g<<5)+b; c+=this.histo[idx]||0; } this._count=c; } return this._count; };
  VBox.prototype.volume=function(){ return (this.r2-this.r1+1)*(this.g2-this.g1+1)*(this.b2-this.b1+1); };
  VBox.prototype.avg=function(){ if(!this._avg){ var ntot=0, rsum=0,gsum=0,bsum=0; for(var r=this.r1;r<=this.r2;r++) for(var g=this.g1;g<=this.g2;g++) for(var b=this.b1;b<=this.b2;b++){ var idx=(r<<10)+(g<<5)+b; var h=this.histo[idx]||0; ntot+=h; rsum+=h*(r+0.5)*8; gsum+=h*(g+0.5)*8; bsum+=h*(b+0.5)*8; } if(ntot){ this._avg=[~~(rsum/ntot),~~(gsum/ntot),~~(bsum/ntot)]; } else { this._avg=[~~(8*(this.r1+this.r2+1)/2),~~(8*(this.g1+this.g2+1)/2),~~(8*(this.b1+this.b2+1)/2)]; } } return this._avg; };
  VBox.prototype.split=function(){ var rw=this.r2-this.r1+1, gw=this.g2-this.g1+1, bw=this.b2-this.b1+1;
    var maxw=Math.max(rw,gw,bw), total=this.count(); if(!total) return [this];
    var histo=this.histo; function doCut(vbox, dim){ var dim1=dim+'1', dim2=dim+'2'; var lv=vbox[dim1], hv=vbox[dim2]; var partialSum=[], sum=0; for (var i=lv;i<=hv;i++){ var c=0; if(dim==='r'){ for(var g=vbox.g1;g<=vbox.g2;g++) for(var b=vbox.b1;b<=vbox.b2;b++) c+=histo[(i<<10)+(g<<5)+b]||0; }
      else if(dim==='g'){ for(var r=vbox.r1;r<=vbox.r2;r++) for(var b=vbox.b1;b<=vbox.b2;b++) c+=histo[(r<<10)+(i<<5)+b]||0; }
      else { for(var r=vbox.r1;r<=vbox.r2;r++) for(var g=vbox.g1;g<=vbox.g2;g++) c+=histo[(r<<10)+(g<<5)+i]||0; }
      sum+=c; partialSum[i]=sum; }
      var target=sum/2, cut=lv; for (var i=lv;i<=hv;i++){ if(partialSum[i]>=target){ cut=i; break; } }
      var vbox1=JSON.parse(JSON.stringify(vbox)); var vbox2=JSON.parse(JSON.stringify(vbox));
      vbox1[dim2]=cut; vbox2[dim1]=cut+1;
      return [new VBox(vbox1.r1,vbox1.r2,vbox1.g1,vbox1.g2,vbox1.b1,vbox1.b2,histo), new VBox(vbox2.r1,vbox2.r2,vbox2.g1,vbox2.g2,vbox2.b1,vbox2.b2,histo)];
    }
    var dim = (maxw===rw)?'r':(maxw===gw)?'g':'b';
    return doCut(this, dim);
  };
  // Build histogram in 5-bit per channel
  var histo={}; var rmin=31,gmin=31,bmin=31,rmax=0,gmax=0,bmax=0;
  for (var i=0;i<pixels.length;i+=4){
    var r=pixels[i]>>3, g=pixels[i+1]>>3, b=pixels[i+2]>>3, a=pixels[i+3];
    if (a<128) continue;
    var idx=(r<<10)+(g<<5)+b; histo[idx]=(histo[idx]||0)+1;
    if(r<rmin)rmin=r;if(r>rmax)rmax=r;if(g<gmin)gmin=g;if(g>gmax)gmax=g;if(b<bmin)bmin=b;if(b>bmax)bmax=b;
  }
  var pq=[new VBox(rmin,rmax,gmin,gmax,bmin,bmax,histo)];
  while(pq.length<maxcolors){
    pq.sort((a,b)=>b.volume()*b.count()-a.volume()*a.count());
    var v=pq.shift(); var pieces=v.split(); if(pieces.length===1){ pq.push(v); break; } pq.push(pieces[0], pieces[1]);
  }
  return pq.map(v=>{ var a=v.avg(); return (a[0]<<16)|(a[1]<<8)|(a[2]); });
}

function encodeGIFFrames(frames, w, h, fps){
  // frames: array of ImageData (RGBA)
  // Build GIF with per-frame palettes (fast + decent quality)
  const delay = Math.max(2, Math.round(100 / Math.max(1, fps))); // hundredths
  const writer = new GifWriter(new Uint8Array(w*h*10 + 1024*50), w, h, {});
  frames.forEach((img)=>{
    const pal = quantizeMMCQ(img.data, 256);
    // build index map
    const idx = new Uint8Array(w*h);
    for (let i=0,j=0;i<w*h;i++,j+=4){
      const r=img.data[j], g=img.data[j+1], b=img.data[j+2], a=img.data[j+3];
      if (a<128){ idx[i]=0; continue; }
      // nearest color
      let best=0, bestd=1e9; 
      for (let k=0;k<pal.length;k++){
        const pr=(pal[k]>>16)&255, pg=(pal[k]>>8)&255, pb=pal[k]&255;
        const dr=r-pr, dg=g-pg, db=b-pb; const d=dr*dr+dg*dg+db*db;
        if (d<bestd){ bestd=d; best=k; if (d===0) break; }
      }
      idx[i]=best;
    }
    writer.addFrame(0,0,w,h, idx, {palette:pal, delay:delay});
  });
  const bytes = writer.end();
  return new Blob([bytes], {type:"image/gif"});
}

async function downloadGif(){
  const fps   = Math.max(1, Math.min(30, parseInt(fpsInput.value||15)));
  const secs  = Math.max(1, Math.min(60, parseInt(secInput.value||8)));
  const frames= fps * secs;

  const W = canvas.width, H = canvas.height;
  const imgs = [];
  const wasPrev = (mode === "preview"); if (wasPrev) stopPreview();

  for (let i=0;i<frames;i++){
    const t = i / fps; // seconds
    render(t);
    const data = ctx.getImageData(0,0,W,H);
    imgs.push(data);
  }
  const blob = encodeGIFFrames(imgs, W, H, fps);
  const url  = URL.createObjectURL(blob);
  const name = (fileNameInput.value||"animation.gif").replace(/\.(png|jpe?g|webp)$/i,".gif");
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);

  if (wasPrev) startPreview();
}
downloadGifBtn.addEventListener("click", downloadGif);

/* ---------- init ---------- */
modeEditBtn.addEventListener("click", ()=>{ setMode("edit"); stopPreview(); });
modePrevBtn.addEventListener("click", ()=>{ setMode("preview"); startPreview(); });

function init(){
  buildBgGrid();
  setInitialBackground();
  drawSwatchesUI();
  buildAnimUI();
  setMode("edit");
  render(0);
  fitZoom();
  openInspector(false);
}
init();
