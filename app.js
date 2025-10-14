const PRESET_HEX = {Blue:'#008cff',Green:'#00d200',Yellow:'#ffd700',Magenta:'#ff3cc8',Red:'#ff2828',Orange:'#ff7f00',White:'#ffffff',Cyan:'#00ffff',Purple:'#8a2be2',Pink:'#ff69b4'};
const PRESET_NAMES = Object.keys(PRESET_HEX);

// =============== State & constants ===============
const COLORS = {
  "Blue":"#008cff","Green":"#00d200","Yellow":"#ffd700","Magenta":"#ff3cc8","Red":"#ff2828",
  "Orange":"#ff7f00","White":"#ffffff","Cyan":"#00ffff","Purple":"#8a2be2","Pink":"#ff69b4"
};
const COLOR_NAMES = Object.keys(COLORS);

// Preset map by resolution
const PRESETS = {
  "96x128": {"Wheelie (96×128)":"assets/Preset_A.png","2 Up (96×128)":"assets/Preset_B.png"},
  "64x64":  {"Wheelie (64×64)":"assets/Preset_C.png","2 Up (64×64)":"assets/Preset_D.png"}
};

const OWNER_KEY = "Abraham";

// Default state
const state = {
  resMode: "96x128",
  W: 96, H: 128,
  bgSource: "Preset",          // Preset | Solid | Custom
  bgChoice: "Wheelie (96×128)",
  solidHex: "#000000",
  customBgImg: null,           // ImageBitmap for custom upload
  // text model: array of lines; each line has array of words {text,color,scale,dx,dy}
  lines: [
    [{text:"WILL",color:"Blue",scale:1,dx:0,dy:0}],
    [{text:"WHEELIE",color:"Green",scale:1,dx:0,dy:0}],
    [{text:"FOR",color:"Yellow",scale:1,dx:0,dy:0}],
    [{text:"BOOKTOK",color:"Magenta",scale:1,dx:0,dy:0}],
    [{text:"GIRLIES",color:"Red",scale:1,dx:0,dy:0}]
  ],
  // layout
  autoFont: true,
  manualFontSize: 24,
  sizeMode: "Auto",
  lineGap: 2, wordSpacing: 3,
  autoSpacing: true,
  gutter: 2,
  // animation
  animEnabled: true,
  BY: 4.0, SC: 0.03, BC: 1.0, WX: 0.8, WY: 1.4, WC: 1.0, JJ: 0.10, JC: 2.5,
  // output
  seconds: 8, fps: 15, outName: "led",
  // preview
  live: true, perf: "smooth",
  // per-line modes
  lineAlign: {},     // {li:'left'|'center'|'right'}
  lineSpacing: {},   // {li:'natural'|'equal'|'equalNoOuter'}
  lineGutter: {},    // {li:number}
  advanced: false
  // selection
  sel: {li:0, wi:0},
  owner: false,
  history: [],
  future: [],
  nudgeStep: 5
};

// =============== DOM refs ===============
const resMode = document.getElementById("resMode");
const Winput = document.getElementById("W");
const Hinput = document.getElementById("H");
const customWH = document.getElementById("customWH");
const bgTabs = document.querySelectorAll(".tab");
const bgPreset = document.getElementById("bgPreset");
const bgSolid = document.getElementById("bgSolid");
const bgCustom = document.getElementById("bgCustom");
const solidHex = document.getElementById("solidHex");
const customBg = document.getElementById("customBg");
const autoMatch = document.getElementById("autoMatch");

const liveToggle = document.getElementById("liveToggle");
const perfMode = document.getElementById("perfMode");
const addLineBtn = document.getElementById("addLine");
const resetAutoBtn = document.getElementById("resetAuto");
const clearTextBtn = document.getElementById("clearText");
const centerAllBtn = document.getElementById("centerAll");

const sizeMode = document.getElementById("sizeMode");
const manualWrap = document.getElementById("manualSizeWrap");
const manualSize = document.getElementById("manualSize");
const lineGap = document.getElementById("lineGap");
const wordSpacing = document.getElementById("wordSpacing");
const gutterPx = document.getElementById("gutterPx");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const helpToggle = document.getElementById("helpToggle");
const helpOverlay = document.getElementById("helpOverlay");
const closeHelp = document.getElementById("closeHelp");
const nudgeUp = document.getElementById("nudgeUp");
const nudgeStepSel = document.getElementById("nudgeStep");
const snapBaselineBtn = document.getElementById("snapBaseline");
const showNudgePad = document.getElementById("showNudgePad");
const lockX = document.getElementById("lockX");
const lockY = document.getElementById("lockY");
const snapGuidesToggle = document.getElementById("snapGuidesToggle");
const snapToGuidesToggle = document.getElementById("snapToGuidesToggle");
const fineCrosshair = document.getElementById("fineCrosshair");
const nudgeDown = document.getElementById("nudgeDown");
const nudgeLeft = document.getElementById("nudgeLeft");
const nudgeRight = document.getElementById("nudgeRight");
const resetPositionsBtn = document.getElementById("resetPositionsBtn");
const metricFps = document.getElementById("metricFps");
const metricFrame = document.getElementById("metricFrame");
const metricBg = document.getElementById("metricBg");
const addPresetToSwatches = document.getElementById('addPresetToSwatches');
const eyedropperBtn = document.getElementById('eyedropperBtn');
const eyedropHint = document.getElementById('eyedropHint');
const advancedToggle = document.getElementById("advancedToggle");
const lineGutterPx = document.getElementById("lineGutterPx");

const animEnabled = document.getElementById("animEnabled");
const animBY = document.getElementById("animBY");
const animSC = document.getElementById("animSC");
const animBC = document.getElementById("animBC");
const animWX = document.getElementById("animWX");
const animWY = document.getElementById("animWY");
const animWC = document.getElementById("animWC");
const animJJ = document.getElementById("animJJ");
const animJC = document.getElementById("animJC");

const seconds = document.getElementById("seconds");
const fps = document.getElementById("fps");
const outName = document.getElementById("outName");
const renderGifBtn = document.getElementById("renderGif");
const dlLink = document.getElementById("dlLink");

const ownerKey = document.getElementById("ownerKey");
const ownerApply = document.getElementById("ownerApply");
const ownerActions = document.getElementById("ownerActions");
const loadOwnerA = document.getElementById("loadOwnerA");
const loadOwnerB = document.getElementById("loadOwnerB");

const downloadJson = document.getElementById("downloadJson");
const uploadJson = document.getElementById("uploadJson");

const canvas = document.getElementById("preview");
const ctx = canvas.getContext("2d");

// =============== Utilities ===============
function colorHex(name){ return COLORS[name] || "#ffffff"; }
function deviceScale(){ return Math.max(1, Math.floor(window.devicePixelRatio || 1)); }

// Fit canvas to screen nicely
function fitCanvas(){
  const s = deviceScale();
  const maxW = Math.min(320, Math.floor(window.innerWidth - 32));
  const ratio = state.H/state.W;
  let targetW = Math.min(maxW, 256);
  let targetH = Math.round(targetW * ratio);
  canvas.style.width = targetW+"px";
  canvas.style.height = targetH+"px";
  canvas.width = state.W * s;
  canvas.height = state.H * s;
}
window.addEventListener("resize", fitCanvas);

// =============== Background loading (client-only) ===============
let bgImageBitmap = null; // static
let bgAnimFrames = null;  // for future (animated backgrounds in-browser)
let bgFps = 0;

async function loadBg(){
  bgAnimFrames = null; bgImageBitmap = null; bgFps = 0;

  if(state.bgSource === "Solid"){
    // Solid drawn directly
    return;
  }
  if(state.bgSource === "Custom" && customBg.files && customBg.files[0]){
    const file = customBg.files[0];
    const img = await createImageBitmap(await file.arrayBuffer().then(b=>new Blob([b])));
    // Resize into a fixed bitmap matching W×H
    const off = new OffscreenCanvas(state.W, state.H);
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0, state.W, state.H);
    bgImageBitmap = off.transferToImageBitmap();
    return;
  }
  if(state.bgSource === "Preset"){
    const src = PRESETS[state.resMode]?.[state.bgChoice];
    if(!src) return;
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode().catch(()=>{});
    const off = new OffscreenCanvas(state.W, state.H);
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0, state.W, state.H);
    bgImageBitmap = off.transferToImageBitmap();
  }
}

// =============== Text layout & drawing ===============
function loadFont(size){
  // Browser default fonts; you can add WebFonts later if desired.
  return `${Math.max(1,Math.floor(size))}px "Outfit", "DejaVu Sans", "Liberation Sans", system-ui, sans-serif`;
}

function measure(text, size){
  const off = new OffscreenCanvas(1,1);
  const octx = off.getContext("2d");
  octx.font = loadFont(size);
  const m = octx.measureText(text || " ");
  const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  const w = Math.ceil(m.width);
  return {w:Math.max(1,w), h:Math.max(1,h)};
}

function autoBaseSize(){
  // Binary search for base size fitting all lines into H (with line gaps)
  let lo=1, hi=512;
  function fits(sz){
    let totalH=0;
    for(const line of state.lines){
      let maxH=1;
      for(const seg of line){
        const sc = Math.max(0.1, seg.scale||1);
        const m = measure(seg.text, sz*sc);
        maxH = Math.max(maxH, m.h);
      }
      totalH += maxH;
    }
    const gaps = state.lineGap * Math.max(0, state.lines.length-1);
    return totalH + gaps <= Math.floor(state.H*0.98);
  }
  while(lo<hi){
    const mid = Math.floor((lo+hi+1)/2);
    if(fits(mid)) lo=mid; else hi=mid-1;
  }
  return lo;
}

function layoutPositions(base){
  const sizesPerLine=[]; const lineHeights=[];
  for(const line of state.lines){
    let sizes=[]; let maxH=1;
    for(const seg of line){
      const sc = Math.max(0.1, seg.scale||1);
      const m = measure(seg.text, base*sc);
      sizes.push({w:m.w, h:m.h});
      maxH = Math.max(maxH, m.h);
    }
    sizesPerLine.push(sizes);
    lineHeights.push(maxH);
  }
  // vertical placement
  const ys=[];
  if(state.autoSpacing){
    const n = state.lines.length;
    const total = lineHeights.reduce((a,b)=>a+b,0);
    const minGap = state.lineGap * Math.max(0, n-1);
    const leftover = Math.max(0, state.H - total - minGap);
    const gap = n>1 ? state.lineGap + Math.floor(leftover/(n-1)) : 0;
    let y = Math.floor((state.H - (total + gap*(n-1)))/2);
    for(let i=0;i<n;i++){ ys.push(y); y += lineHeights[i] + gap; }
  }else{
    let y = Math.floor((state.H - (lineHeights.reduce((a,b)=>a+b,0) + state.lineGap*(Math.max(0,lineHeights.length-1))))/2);
    for(let i=0;i<lineHeights.length;i++){ ys.push(y); y += lineHeights[i] + state.lineGap; }
  }
  // horizontal positions (per-line align & spacing)
  const xsList=[];
  for(let li=0; li<sizesPerLine.length; li++){
    const sizes = sizesPerLine[li];
    const gutter = Math.max(0, (state.lineGutter[li] ?? state.gutter)|0);
    const spacingMode = state.lineSpacing[li] || 'natural';
    let gapsPix = state.wordSpacing;
    let totalW = sizes.reduce((a,s)=>a+s.w,0);
    let nGaps = Math.max(0, sizes.length-1);
    if((spacingMode==='equal' || spacingMode==='equalNoOuter') && nGaps>0){
      const leftover = Math.max(0, state.W - totalW);
      gapsPix = Math.floor(leftover / nGaps);
    }
    let allW = totalW + gapsPix*nGaps;
    let x0 = 0;
    const align = state.lineAlign[li] || 'center';
    if(spacingMode==='equalNoOuter'){
      // keep outer gutters fixed
      x0 = gutter;
      allW = state.W - gutter*2;
      const inner = allW - totalW;
      gapsPix = nGaps>0 ? Math.floor(inner / nGaps) : 0;
    }
    if(spacingMode!=='equalNoOuter'){
      if(align==='left') x0 = gutter;
      else if(align==='center') x0 = Math.floor((state.W - allW)/2);
      else if(align==='right') x0 = state.W - allW - gutter;
    }
    const xs=[]; let x = x0;
    for(let i=0;i<sizes.length;i++){
      xs.push(x);
      x += sizes[i].w + gapsPix;
    }
    xsList.push(xs);
  }
  return {ys, xsList, sizesPerLine, lineHeights};
}

function shrinkWithin(w, x0){
  const max = state.W - 2;
  if(x0 + w <= max) return 1.0;
  if(w<=0) return 1.0;
  const allow = Math.max(1, max - x0);
  return Math.max(0.3, allow / w);
}

function drawExactFrameTo(targetCtx, W, H, t){
  return new Promise(async (resolve)=>{
    // BG
    if(state.bgSource === "Solid"){
      targetCtx.fillStyle = state.solidHex; targetCtx.fillRect(0,0,W,H);
    }else if(bgImageBitmap){
      targetCtx.drawImage(bgImageBitmap, 0,0, W,H);
    }else{
      targetCtx.fillStyle = "#000"; targetCtx.fillRect(0,0,W,H);
    }

    const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
    const {ys, xsList, sizesPerLine} = layoutPositions(base);

    const animOn = state.animEnabled;
    const BY = animOn ? state.BY : 0, SC = animOn ? state.SC : 0,
          BC = animOn ? state.BC : 1, WX = animOn ? state.WX : 0,
          WY = animOn ? state.WY : 0, WC = animOn ? state.WC : 1,
          JJ = animOn ? state.JJ : 0, JC = animOn ? state.JC : 1;

    const bphase = 2*Math.PI*BC*t;
    const bcent  = (0.5 - 0.5*Math.cos(bphase) - 0.5)*2.0;
    const scaleA = 1.0 + SC*bcent;
    const phases = [0.00,0.80,1.55,2.30,3.05];

    for(let li=0; li<state.lines.length; li++){
      const line = state.lines[li];
      const ph = phases[li % phases.length];
      const wave_base = 2*Math.PI*WC*t;

      for(let wi=0; wi<line.length; wi++){
        const seg = line[wi];
        const sc = Math.max(0.1, seg.scale||1);
        const size = sizesPerLine[li][wi];
        let x0 = xsList[li][wi] + (seg.dx||0);
        let y0 = ys[li] + (seg.dy||0);

        // shrink if overflow
        const shrink = shrinkWithin(size.w, x0);
        const pxSize = (state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize) * sc * shrink;

        // animate offsets
        const wave_x = WX * Math.sin(wave_base + ph);
        const wave_y = WY * Math.cos(wave_base + ph/1.5);
        const jit_base = 2*Math.PI*JC*t;
        const jx = JJ * Math.sin(jit_base*1.3 + ph*1.1);
        const jy = JJ * Math.cos(jit_base*1.7 + ph*0.9);
        const off_x = wave_x + jx;
        const off_y = wave_y + jy + (BY * bcent * Math.cos(ph));

        // render text
        targetCtx.save();
        targetCtx.font = loadFont(pxSize);
        targetCtx.fillStyle = colorHex(seg.color);
        targetCtx.translate(Math.max(0,Math.min(W,Math.floor(x0 + off_x))), Math.max(0,Math.min(H,Math.floor(y0 + off_y))));
        if(Math.abs(scaleA-1)>1e-3) targetCtx.scale(scaleA, scaleA);
        targetCtx.fillText(seg.text || " ", 0, 0);
        targetCtx.restore();
      }
    }
    resolve();
  });
}

// Simple vs Exact live preview (we only implement exact here for accuracy)
let rafId=null, lastTs=0;
function targetFps(){ return (perfMode.value==="smooth") ? 18 : 10; }
function loop(ts){
  const minDelta = 1000/targetFps();
  if(ts-lastTs >= minDelta){
    lastTs = ts;
    const dt = (Date.now()%(state.seconds*1000))/(state.seconds*1000);
    // draw exact frame to preview canvas at device scale
    const s = deviceScale();
    const off = new OffscreenCanvas(state.W, state.H);
    const octx = off.getContext("2d");
    drawExactFrameTo(octx, state.W, state.H, dt).then(()=>{
      // upscale
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(off, 0,0, canvas.width, canvas.height);
      drawGuides(); // selection guides
    });
  }
  if(state.live) rafId = requestAnimationFrame(loop);
}
function startLive(){ if(!rafId){ state.live=true; rafId = requestAnimationFrame(loop);} }
function stopLive(){ state.live=false; if(rafId){ cancelAnimationFrame(rafId); rafId=null; } }

function drawGuides(){
  // selection rectangle
  const sel = state.sel;
  if(sel && state.lines[sel.li] && state.lines[sel.li][sel.wi]){
    // rough selection box by re-laying
    const s = deviceScale();
    const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
    const {ys, xsList, sizesPerLine} = layoutPositions(base);
    const seg = state.lines[sel.li][sel.wi];
    const size = sizesPerLine[sel.li][sel.wi];
    const x = (xsList[sel.li][sel.wi] + (seg.dx||0)) * s;
    const y = (ys[sel.li] + (seg.dy||0)) * s;
    ctx.strokeStyle = "rgba(0,255,225,.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.max(0,x), Math.max(0,y), Math.max(1,size.w*s), Math.max(1,size.h*s));
  }
}

// =============== UI wiring ===============
function refreshPresetThumbs(){
  const wrap = bgPreset;
  wrap.innerHTML = "";
  const group = PRESETS[state.resMode] || {};
  Object.entries(group).forEach(([name, url], idx)=>{
    const tile = document.createElement("div");
    tile.className = "tile"+(state.bgChoice===name?" selected":"");
    tile.innerHTML = `<img loading="lazy" src="${url}" alt="${name}"><div class="label">${name}</div>`;
    tile.addEventListener("click", ()=>{
      state.bgChoice = name;
      refreshPresetThumbs();
      loadBg();
    }, {passive:true});
    wrap.appendChild(tile);
  });
  bgPreset.classList.toggle("hidden", Object.keys(group).length===0);
}

function setRes(r){
  state.resMode = r;
  if(r==="96x128"){ state.W=96; state.H=128; }
  else if(r==="64x64"){ state.W=64; state.H=64; }
  else { document.getElementById("customWH").classList.remove("hidden"); }
  if(r!=="Custom"){ document.getElementById("customWH").classList.add("hidden"); }
  fitCanvas(); refreshPresetThumbs(); loadBg();
}

resMode.addEventListener("change", e=> setRes(e.target.value));
Winput.addEventListener("change", e=>{ state.W=parseInt(e.target.value)||96; fitCanvas(); loadBg(); });
Hinput.addEventListener("change", e=>{ state.H=parseInt(e.target.value)||128; fitCanvas(); loadBg(); });

bgTabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    bgTabs.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.tab;
    state.bgSource = t==="Preset" ? "Preset" : (t==="Solid" ? "Solid" : "Custom");
    bgPreset.classList.toggle("hidden", state.bgSource!=="Preset");
    bgSolid.classList.toggle("hidden", state.bgSource!=="Solid");
    bgCustom.classList.toggle("hidden", state.bgSource!=="Custom");
    loadBg();
  });
});
solidHex.addEventListener("input", e=>{ state.solidHex=e.target.value; });
customBg.addEventListener("change", loadBg);

liveToggle.addEventListener("change", e=>{
  if(e.target.checked) startLive(); else stopLive();
});
perfMode.addEventListener("change", ()=>{ if(state.live){ stopLive(); startLive(); } });

addLineBtn.addEventListener("click", ()=>{
  pushHistory(); state.lines.push([{text:"WORD",color:"White",scale:1,dx:0,dy:0}]); openInspector(state.lines.length-1, 0);
});
resetAutoBtn.addEventListener("click", ()=>{
  state.lines.forEach(line=> line.forEach(seg=>{ seg.dx=0; seg.dy=0; }));
});
clearTextBtn.addEventListener("click", ()=>{
  pushHistory(); state.lines = [[{text:"",color:"White",scale:1,dx:0,dy:0}]];
});
centerAllBtn.addEventListener("click", ()=>{ centerAllLines(); });

sizeMode.addEventListener("change", e=>{
  state.sizeMode = e.target.value;
  manualWrap.classList.toggle("hidden", state.sizeMode!=="Manual");
});
manualSize.addEventListener("change", e=> state.manualFontSize = parseInt(e.target.value)||24);
lineGap.addEventListener("change", e=> state.lineGap = parseInt(e.target.value)||2);
wordSpacing.addEventListener("change", e=> state.wordSpacing = parseInt(e.target.value)||3);

gutterPx.addEventListener("change", e=> state.gutter = Math.max(0, parseInt(e.target.value)||0));


animEnabled.addEventListener("change", e=> state.animEnabled = e.target.checked);
[animBY,animSC,animBC,animWX,animWY,animWC,animJJ,animJC].forEach(inp=>{
  inp.addEventListener("change", ()=>{
    state.BY=parseFloat(animBY.value); state.SC=parseFloat(animSC.value);
    state.BC=parseFloat(animBC.value); state.WX=parseFloat(animWX.value);
    state.WY=parseFloat(animWY.value); state.WC=parseFloat(animWC.value);
    state.JJ=parseFloat(animJJ.value); state.JC=parseFloat(animJC.value);
  });
});

seconds.addEventListener("change", e=> state.seconds = Math.max(1, parseInt(e.target.value)||8));
fps.addEventListener("change", e=> state.fps = Math.max(1, Math.min(30, parseInt(e.target.value)||15)));
outName.addEventListener("input", e=> state.outName = e.target.value || "led");

// Owner
ownerApply.addEventListener("click", ()=>{
  state.owner = (ownerKey.value.trim().toLowerCase() === OWNER_KEY.toLowerCase());
  ownerActions.classList.toggle("hidden", !state.owner);
});
loadOwnerA.addEventListener("click", ()=>{
  // Owner A — Wheelie 96×128
  setRes("96x128");
  state.bgSource="Preset"; state.bgChoice="Wheelie (96×128)"; refreshPresetThumbs(); loadBg();
  state.lines = [
    [{text:"WILL",color:"Blue",scale:1,dx:0,dy:0}],
    [{text:"WHEELIE",color:"Green",scale:1,dx:0,dy:0}],
    [{text:"FOR",color:"Yellow",scale:1,dx:0,dy:0}],
    [{text:"BOOKTOK",color:"Magenta",scale:1,dx:0,dy:0}],
    [{text:"GIRLIES",color:"Red",scale:1,dx:0,dy:0}]
  ];
});
loadOwnerB.addEventListener("click", ()=>{
  // Owner B — 2 Up 96×128 with requested text
  setRes("96x128");
  state.bgSource="Preset"; state.bgChoice="2 Up (96×128)"; refreshPresetThumbs(); loadBg();
  state.lines = [
    [{text:"FREE",color:"White",scale:1,dx:0,dy:0}],
    [{text:"RIDES",color:"White",scale:1,dx:0,dy:0}],
    [{text:"FOR",color:"White",scale:1,dx:0,dy:0}],
    [{text:"BOOKTOK",color:"White",scale:1,dx:0,dy:0}],
    [{text:"GIRLIES",color:"White",scale:1,dx:0,dy:0}]
  ];
});

// JSON IO
downloadJson.addEventListener("click", ()=>{
  const snap = JSON.stringify(state, null, 2);
  const blob = new Blob([snap], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "led_preset.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
uploadJson.addEventListener("change", async e=>{
  const f = e.target.files[0];
  if(!f) return;
  const text = await f.text();
  try{
    const data = JSON.parse(text);
    Object.assign(state, data);
    setRes(state.resMode);
    refreshPresetThumbs();
    await loadBg();
  }catch(err){ alert("Failed to load JSON: "+err); }
});

// Word color select options
(function fillColorSelect(){
  const sel = document.getElementById("wordColor");
  COLOR_NAMES.forEach(n=>{
    const opt = document.createElement("option"); opt.value=n; opt.textContent=n;
    sel.appendChild(opt);
  });
})();

// =============== Inspector controls ===============
// ---- Alignment helpers ----
function totalLineWidth(li, base){
  const {xsList, sizesPerLine} = layoutPositions(base);
  const sizes = sizesPerLine[li] || [];
  const total = sizes.reduce((a,s)=>a+s.w,0) + state.wordSpacing*Math.max(0, sizes.length-1);
  return total;
}

function alignLine(li, mode){
  // mode: 'left'|'center'|'right'
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList, sizesPerLine} = layoutPositions(base);
  const sizes = sizesPerLine[li] || [];
  const xs = xsList[li] || [];
  const total = sizes.reduce((a,s)=>a+s.w,0) + state.wordSpacing*Math.max(0, sizes.length-1);
  let offsetX = 0;
  if(mode==='left'){ offsetX = 0 - xs[0]; }
  else if(mode==='center'){ offsetX = Math.floor((state.W - total)/2) - xs[0]; }
  else if(mode==='right'){ offsetX = (state.W - total) - xs[0]; }
  // apply offset to all words' dx, keep dy unchanged
  for(let wi=0; wi<state.lines[li].length; wi++){
    state.lines[li][wi].dx = (state.lines[li][wi].dx||0) + offsetX;
  }
}

function centerAllLines(){
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {xsList, sizesPerLine} = layoutPositions(base);
  for(let li=0; li<state.lines.length; li++){
    const sizes = sizesPerLine[li] || [];
    const xs = xsList[li] || [];
    const total = sizes.reduce((a,s)=>a+s.w,0) + state.wordSpacing*Math.max(0, sizes.length-1);
    const targetX0 = Math.floor((state.W - total)/2);
    const offsetX = targetX0 - xs[0];
    for(let wi=0; wi<state.lines[li].length; wi++){
      state.lines[li][wi].dx = (state.lines[li][wi].dx||0) + offsetX;
    }
  }
}

const inspector = document.getElementById("inspector");
const wordText = document.getElementById("wordText");
const wordColor = document.getElementById("wordColor");
const wordScale = document.getElementById("wordScale");
const addWordBtn = document.getElementById("addWord");
const delWordBtn = document.getElementById("delWord");
const delLineBtn = document.getElementById("delLine");
const centerWordBtn = document.getElementById("centerWord");
const alignLeftLineBtn = document.getElementById("alignLeftLine");
const alignCenterLineBtn = document.getElementById("alignCenterLine");
const alignRightLineBtn = document.getElementById("alignRightLine");

function openInspector(li, wi){
  state.sel = {li, wi};
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  wordText.value = seg.text || "";
  wordColor.value = seg.color || "White";
  wordScale.value = seg.scale || 1;
  showPad.checked = !!state.showPad; lockX.checked = !!state.lockX; lockY.checked = !!state.lockY; const np = document.querySelector('.nudge-pad'); if(np) np.style.display = state.showPad ? 'flex' : 'none';
  spacingModeLine.value = state.lineSpacing[li] || 'natural';
  lineGutterPx.value = state.lineGutter[li] ?? 0;
  inspector.classList.remove("hidden");
}
function applyInspector(){
  const {li, wi} = state.sel || {};
  if(li==null || wi==null) return;
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  seg.text = wordText.value;
  seg.color = wordColor.value;
  seg.scale = Math.max(0.3, Math.min(4, parseFloat(wordScale.value)||1));
}
wordText.addEventListener("input", applyInspector);
wordColor.addEventListener("change", applyInspector);
wordScale.addEventListener("change", applyInspector);
addWordBtn.addEventListener("click", ()=>{
  const {li} = state.sel || {li:0};
  state.lines[li] = state.lines[li] || [];
  pushHistory(); state.lines[li].push({text:"WORD",color:"White",scale:1,dx:0,dy:0}); openInspector(li, state.lines[li].length-1);
});
delWordBtn.addEventListener("click", ()=>{
  const {li,wi} = state.sel || {};
  if(li==null || wi==null) return;
  pushHistory(); state.lines[li].splice(wi,1);
  if(state.lines[li].length===0){ pushHistory(); state.lines.splice(li,1); inspector.classList.add("hidden"); }
});
delLineBtn.addEventListener("click", ()=>{
  const {li} = state.sel || {};
  if(li==null) return;
  pushHistory(); state.lines.splice(li,1);
  inspector.classList.add("hidden");
});
centerWordBtn.addEventListener("click", ()=>{
  const {li,wi} = state.sel || {};
  if(li==null || wi==null) return;
  pushHistory(); state.lines[li][wi].dx = 0; state.lines[li][wi].dy = 0;
});
alignLeftLineBtn.addEventListener("click", ()=>{ const {li} = state.sel || {}; if(li==null) return; pushHistory(); alignLine(li,"left"); });
alignCenterLineBtn.addEventListener("click", ()=>{ const {li} = state.sel || {}; if(li==null) return; pushHistory(); alignLine(li,"center"); });
alignRightLineBtn.addEventListener("click", ()=>{ const {li} = state.sel || {}; if(li==null) return; pushHistory(); alignLine(li,"right"); });

// =============== Dragging on canvas (touch + mouse) ===============
let dragging=false, dragSel=null, dragOff={x:0,y:0};
const HIT_PAD = 6;

function hitWord(px, py){
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList, sizesPerLine} = layoutPositions(base);
  // prefer top-most (last drawn)
  for(let li=state.lines.length-1; li>=0; li--){
    for(let wi=state.lines[li].length-1; wi>=0; wi--){
      const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

      const size = sizesPerLine[li][wi];
      const x = xsList[li][wi] + (seg.dx||0) - HIT_PAD;
      const y = ys[li] + (seg.dy||0) - HIT_PAD;
      const w = size.w + HIT_PAD*2;
      const h = size.h + HIT_PAD*2;
      // scale canvas coords to native
      const s = deviceScale();
      const cx = px / (canvas.width/state.W);
      const cy = py / (canvas.height/state.H);
      if(cx>=x && cx<=x+w && cy>=y && cy<=y+h) return {li,wi};
    }
  }
  return null;
}

canvas.addEventListener("mousedown", e=>{
  const r = canvas.getBoundingClientRect();
  const hit = hitWord(e.clientX - r.left, e.clientY - r.top);
  if(hit){
    dragging=true; dragSel=hit;
    openInspector(hit.li, hit.wi);
  }else{
    inspector.classList.add("hidden");
  }
});
window.addEventListener("mousemove", e=>{
  if(!dragging || !dragSel) return;
  const r = canvas.getBoundingClientRect();
  const {li,wi} = dragSel;
  // map to native pixels
  const nx = (e.clientX - r.left) / (canvas.width/state.W);
  const ny = (e.clientY - r.top)  / (canvas.height/state.H);
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList} = layoutPositions(base);
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  // target center roughly on pointer
  // clamp within bounds
  let ndx = Math.round(nx - xsList[li][wi]);
  let ndy = Math.round(ny - ys[li]);
  // compute word width/height at base scale
  const size = sizesPerLine[li][wi];
  const minX = 0 - xsList[li][wi];
  const maxX = state.W - size.w - xsList[li][wi];
  const minY = 0 - ys[li];
  const maxY = state.H - size.h - ys[li];
  ndx = Math.max(minX, Math.min(maxX, ndx));
  ndy = Math.max(minY, Math.min(maxY, ndy));
  seg.dx = ndx; seg.dy = ndy;
});
window.addEventListener("mouseup", ()=>{ dragging=false; state.tempLockY=false; clearTimeout(dragTimer); dragSel=null; });

// touch
let longPressTimer=null;
canvas.addEventListener("touchstart", e=>{
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const hit = hitWord(t.clientX - r.left, t.clientY - r.top);
  if(hit){
    longPressTimer = setTimeout(()=> openInspector(hit.li, hit.wi), 600);
    dragging=true; dragSel=hit;
  }
},{passive:true});
canvas.addEventListener("touchmove", e=>{
  if(!dragging || !dragSel) return;
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const nx = (t.clientX - r.left) / (canvas.width/state.W);
  const ny = (t.clientY - r.top)  / (canvas.height/state.H);
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList} = layoutPositions(base);
  const {li,wi} = dragSel;
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  // clamp within bounds
  let ndx = Math.round(nx - xsList[li][wi]);
  let ndy = Math.round(ny - ys[li]);
  // compute word width/height at base scale
  const size = sizesPerLine[li][wi];
  const minX = 0 - xsList[li][wi];
  const maxX = state.W - size.w - xsList[li][wi];
  const minY = 0 - ys[li];
  const maxY = state.H - size.h - ys[li];
  ndx = Math.max(minX, Math.min(maxX, ndx));
  ndy = Math.max(minY, Math.min(maxY, ndy));
  seg.dx = ndx; seg.dy = ndy;
},{passive:true});
window.addEventListener("touchend", ()=>{ dragging=false; state.tempLockY=false; clearTimeout(dragTimer); dragSel=null; if(longPressTimer){clearTimeout(longPressTimer); longPressTimer=null;} }, {passive:true});

// =============== Render GIF (client) ===============
let prevUrl = null;
async function renderGifClientSide(){
  const W = state.W, H = state.H;
  let renderFps = state.fps;
  // (Optional) auto-match bg fps here in future if using animated backgrounds
  const total = Math.max(1, Math.round(state.seconds * renderFps));
  const encCanvas = document.createElement("canvas");
  encCanvas.width=W; encCanvas.height=H;
  const encCtx = encCanvas.getContext("2d");
  const enc = new GIFEncoder(W,H,"neuquant",true);
  enc.setDelay(Math.round(1000/renderFps));
  enc.setRepeat(0);
  enc.start();
  for(let i=0;i<total;i++){
    const t = i/total;
    await drawExactFrameTo(encCtx, W,H, t);
    const frame = encCtx.getImageData(0,0,W,H);
    enc.addFrame(frame.data);
  }
  enc.finish();
  const bin = enc.out.getData();
  const blob = new Blob([bin], {type:"image/gif"});
  const url = URL.createObjectURL(blob);
  if(prevUrl) try{ URL.revokeObjectURL(prevUrl); }catch(e){}
  prevUrl = url;
  dlLink.href = url;
  dlLink.download = `${(state.outName||'led')}_${state.seconds}s_${renderFps}fps_${W}x${H}.gif`;
  dlLink.classList.remove("hidden");
  dlLink.textContent = "⬇️ Download GIF";
}

// =============== Init ===============
async function init(){
  if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  fitCanvas();
  refreshPresetThumbs();
  await loadBg();
  // start live animation
  startLive();
  // inspector initial
  openInspector(0,0);
}
init();

renderGifBtn.addEventListener("click", ()=> renderGifClientSide());


document.addEventListener("visibilitychange", ()=>{
  if(document.hidden){ stopLive(); }
  else if(liveToggle.checked){ startLive(); }
});

function snapshot(){
  // shallow copy safe for our shape
  return JSON.parse(JSON.stringify({
    resMode: state.resMode, W: state.W, H: state.H,
    bgSource: state.bgSource, bgChoice: state.bgChoice, solidHex: state.solidHex,
    lines: state.lines, sizeMode: state.sizeMode, manualFontSize: state.manualFontSize,
    lineGap: state.lineGap, wordSpacing: state.wordSpacing, gutter: state.gutter,
    animEnabled: state.animEnabled, BY: state.BY, SC: state.SC, BC: state.BC, WX: state.WX, WY: state.WY, WC: state.WC, JJ: state.JJ, JC: state.JC
  }));
}
function pushHistory(){
  state.history.push(snapshot());
  if(state.history.length>100) state.history.shift();
  state.future.length = 0;
}
function restoreSnap(snap){
  Object.assign(state, snap);
  fitCanvas(); refreshPresetThumbs(); loadBg();
}
undoBtn.addEventListener("click", ()=>{
  if(state.history.length===0) return;
  const snap = state.history.pop();
  state.future.push(snapshot());
  restoreSnap(snap);
});
redoBtn.addEventListener("click", ()=>{
  if(state.future.length===0) return;
  const snap = state.future.pop();
  state.history.push(snapshot());
  restoreSnap(snap);
});

advancedToggle.addEventListener("change", (e)=>{
  state.advanced = !!e.target.checked;
  document.body.classList.toggle("advanced-on", state.advanced);
});

lineGutterPx.addEventListener("change", (e)=>{
  const {li} = state.sel || {}; if(li==null) return;
  const v = Math.max(0, parseInt(e.target.value)||0);
  state.lineGutter[li] = v;
});

async function decodeGifArrayBuffer(buf){
  try{
    const gif = new window.GIF(buf);
    const frames = gif.decompressFrames(true);
    const images = [];
    const durations = [];
    for(const fr of frames){
      const {patch, dims, delay} = fr;
      // Create image from patch
      const cw = dims.width, ch = dims.height;
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const ctx = c.getContext('2d');
      const imgData = ctx.createImageData(cw, ch);
      imgData.data.set(patch);
      ctx.putImageData(imgData, 0, 0);
      const im = new Image();
      im.src = c.toDataURL('image/png');
      await new Promise(r=> im.onload=r);
      images.push(im);
      durations.push(Math.max(10, delay||100)); // fallback 100ms
    }
    const median = durations.sort((a,b)=>a-b)[Math.floor(durations.length/2)] || 100;
    const bgFps = Math.max(1, Math.min(60, Math.round(1000/median)));
    return {images, durations, bgFps, size:[images[0].width, images[0].height]};
  }catch(e){
    console.warn('GIF decode failed', e);
    return null;
  }
}

helpToggle.addEventListener('change', e=>{
  helpOverlay.classList.toggle('hidden', !e.target.checked);
});
closeHelp.addEventListener('click', ()=>{
  helpOverlay.classList.add('hidden');
  helpToggle.checked = false;
});

function nudgeSelected(dx, dy){
  const {li, wi} = state.sel || {};
  if(li==null || wi==null) return;
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  seg.dx = (seg.dx||0) + dx;
  seg.dy = (seg.dy||0) + dy;
}
nudgeUp.addEventListener('click', ()=> nudgeSelected(0, -1));
nudgeDown.addEventListener('click', ()=> nudgeSelected(0, 1));
nudgeLeft.addEventListener('click', ()=> nudgeSelected(-1, 0));
nudgeRight.addEventListener('click', ()=> nudgeSelected(1, 0));

document.addEventListener('keydown', (ev)=>{
  const base = state.nudgeStep||1; const step = ev.shiftKey ? base*5 : base;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)){
    ev.preventDefault();
    if(ev.key==='ArrowUp') nudgeSelected(0, -(ev.altKey?0:step));
    if(ev.key==='ArrowDown') nudgeSelected(0, (ev.altKey?0:step));
    if(ev.key==='ArrowLeft') nudgeSelected((ev.altKey?-step:-step), (ev.altKey?0:0));
    if(ev.key==='ArrowRight') nudgeSelected((ev.altKey?step:step), (ev.altKey?0:0));
  }
});

nudgeStepSel.addEventListener('change', e=>{
  const v = parseInt(e.target.value)||5;
  state.nudgeStep = v;
});

snapBaselineBtn.addEventListener('click', ()=>{
  const {li, wi} = state.sel || {}; if(li==null||wi==null) return;
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys} = layoutPositions(base);
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  seg.dy = 0; // snap to baseline of its computed line
});

showNudgePad.addEventListener('change', e=>{
  state.showPad = !!e.target.checked;
  const np = document.querySelector('.nudge-pad');
  if(np) np.style.display = state.showPad ? 'flex' : 'none';
});
lockX.addEventListener('change', e=> state.lockX = !!e.target.checked);
lockY.addEventListener('change', e=> state.lockY = !!e.target.checked);

snapGuidesToggle.addEventListener('change', e=>{
  state.snapGuides = !!e.target.checked;
});

(function(){
  let dragging=false, startX=0, startY=0;
  fineCrosshair.addEventListener('pointerdown', (e)=>{
    dragging = true; startX = e.clientX; startY = e.clientY; fineCrosshair.setPointerCapture(e.pointerId);
  });
  fineCrosshair.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const dx = Math.round((e.clientX - startX)/3);
    const dy = Math.round((e.clientY - startY)/3);
    nudgeSelected(state.lockX?dx:dx, state.lockY?dy:dy); // locks already respected in nudgeSelected
    startX = e.clientX; startY = e.clientY;
  });
  const stop=()=>{ dragging=false; state.tempLockY=false; clearTimeout(dragTimer); };
  fineCrosshair.addEventListener('pointerup', stop);
  fineCrosshair.addEventListener('pointercancel', stop);
})();("H");
const customWH = document.getElementById("customWH");
const bgTabs = document.querySelectorAll(".tab");
const bgPreset = document.getElementById("bgPreset");
const bgSolid = document.getElementById("bgSolid");
const bgCustom = document.getElementById("bgCustom");
const solidHex = document.getElementById("solidHex");
const customBg = document.getElementById("customBg");
const autoMatch = document.getElementById("autoMatch");

const liveToggle = document.getElementById("liveToggle");
const perfMode = document.getElementById("perfMode");
const addLineBtn = document.getElementById("addLine");
const resetAutoBtn = document.getElementById("resetAuto");
const clearTextBtn = document.getElementById("clearText");
const centerAllBtn = document.getElementById("centerAll");

const sizeMode = document.getElementById("sizeMode");
const manualWrap = document.getElementById("manualSizeWrap");
const manualSize = document.getElementById("manualSize");
const lineGap = document.getElementById("lineGap");
const wordSpacing = document.getElementById("wordSpacing");
const gutterPx = document.getElementById("gutterPx");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const helpToggle = document.getElementById("helpToggle");
const helpOverlay = document.getElementById("helpOverlay");
const closeHelp = document.getElementById("closeHelp");
const nudgeUp = document.getElementById("nudgeUp");
const nudgeStepSel = document.getElementById("nudgeStep");
const snapBaselineBtn = document.getElementById("snapBaseline");
const showNudgePad = document.getElementById("showNudgePad");
const lockX = document.getElementById("lockX");
const lockY = document.getElementById("lockY");
const snapGuidesToggle = document.getElementById("snapGuidesToggle");
const snapToGuidesToggle = document.getElementById("snapToGuidesToggle");
const fineCrosshair = document.getElementById("fineCrosshair");
const nudgeDown = document.getElementById("nudgeDown");
const nudgeLeft = document.getElementById("nudgeLeft");
const nudgeRight = document.getElementById("nudgeRight");
const resetPositionsBtn = document.getElementById("resetPositionsBtn");
const metricFps = document.getElementById("metricFps");
const metricFrame = document.getElementById("metricFrame");
const metricBg = document.getElementById("metricBg");
const addPresetToSwatches = document.getElementById('addPresetToSwatches');
const eyedropperBtn = document.getElementById('eyedropperBtn');
const eyedropHint = document.getElementById('eyedropHint');
const advancedToggle = document.getElementById("advancedToggle");
const lineGutterPx = document.getElementById("lineGutterPx");

const animEnabled = document.getElementById("animEnabled");
const animBY = document.getElementById("animBY");
const animSC = document.getElementById("animSC");
const animBC = document.getElementById("animBC");
const animWX = document.getElementById("animWX");
const animWY = document.getElementById("animWY");
const animWC = document.getElementById("animWC");
const animJJ = document.getElementById("animJJ");
const animJC = document.getElementById("animJC");

const seconds = document.getElementById("seconds");
const fps = document.getElementById("fps");
const outName = document.getElementById("outName");
const renderGifBtn = document.getElementById("renderGif");
const dlLink = document.getElementById("dlLink");

const ownerKey = document.getElementById("ownerKey");
const ownerApply = document.getElementById("ownerApply");
const ownerActions = document.getElementById("ownerActions");
const loadOwnerA = document.getElementById("loadOwnerA");
const loadOwnerB = document.getElementById("loadOwnerB");

const downloadJson = document.getElementById("downloadJson");
const uploadJson = document.getElementById("uploadJson");

const canvas = document.getElementById("preview");
const ctx = canvas.getContext("2d");

// =============== Utilities ===============
function colorHex(name){ return COLORS[name] || "#ffffff"; }
function deviceScale(){ return Math.max(1, Math.floor(window.devicePixelRatio || 1)); }

// Fit canvas to screen nicely
function fitCanvas(){
  const s = deviceScale();
  const maxW = Math.min(320, Math.floor(window.innerWidth - 32));
  const ratio = state.H/state.W;
  let targetW = Math.min(maxW, 256);
  let targetH = Math.round(targetW * ratio);
  canvas.style.width = targetW+"px";
  canvas.style.height = targetH+"px";
  canvas.width = state.W * s;
  canvas.height = state.H * s;
}
window.addEventListener("resize", fitCanvas);

// =============== Background loading (client-only) ===============
let bgImageBitmap = null; // static
let bgAnimFrames = null;  // for future (animated backgrounds in-browser)
let bgFps = 0;

async function loadBg(){
  bgAnimFrames = null; bgImageBitmap = null; bgFps = 0;

  if(state.bgSource === "Solid"){
    // Solid drawn directly
    return;
  }
  if(state.bgSource === "Custom" && customBg.files && customBg.files[0]){
    const file = customBg.files[0];
    const img = await createImageBitmap(await file.arrayBuffer().then(b=>new Blob([b])));
    // Resize into a fixed bitmap matching W×H
    const off = new OffscreenCanvas(state.W, state.H);
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0, state.W, state.H);
    bgImageBitmap = off.transferToImageBitmap();
    return;
  }
  if(state.bgSource === "Preset"){
    const src = PRESETS[state.resMode]?.[state.bgChoice];
    if(!src) return;
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode().catch(()=>{});
    const off = new OffscreenCanvas(state.W, state.H);
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0, state.W, state.H);
    bgImageBitmap = off.transferToImageBitmap();
  }
}

// =============== Text layout & drawing ===============
function loadFont(size){
  // Browser default fonts; you can add WebFonts later if desired.
  return `${Math.max(1,Math.floor(size))}px "Outfit", "DejaVu Sans", "Liberation Sans", system-ui, sans-serif`;
}

function measure(text, size){
  const off = new OffscreenCanvas(1,1);
  const octx = off.getContext("2d");
  octx.font = loadFont(size);
  const m = octx.measureText(text || " ");
  const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  const w = Math.ceil(m.width);
  return {w:Math.max(1,w), h:Math.max(1,h)};
}

function autoBaseSize(){
  // Binary search for base size fitting all lines into H (with line gaps)
  let lo=1, hi=512;
  function fits(sz){
    let totalH=0;
    for(const line of state.lines){
      let maxH=1;
      for(const seg of line){
        const sc = Math.max(0.1, seg.scale||1);
        const m = measure(seg.text, sz*sc);
        maxH = Math.max(maxH, m.h);
      }
      totalH += maxH;
    }
    const gaps = state.lineGap * Math.max(0, state.lines.length-1);
    return totalH + gaps <= Math.floor(state.H*0.98);
  }
  while(lo<hi){
    const mid = Math.floor((lo+hi+1)/2);
    if(fits(mid)) lo=mid; else hi=mid-1;
  }
  return lo;
}

function layoutPositions(base){
  const sizesPerLine=[]; const lineHeights=[];
  for(const line of state.lines){
    let sizes=[]; let maxH=1;
    for(const seg of line){
      const sc = Math.max(0.1, seg.scale||1);
      const m = measure(seg.text, base*sc);
      sizes.push({w:m.w, h:m.h});
      maxH = Math.max(maxH, m.h);
    }
    sizesPerLine.push(sizes);
    lineHeights.push(maxH);
  }
  // vertical placement
  const ys=[];
  if(state.autoSpacing){
    const n = state.lines.length;
    const total = lineHeights.reduce((a,b)=>a+b,0);
    const minGap = state.lineGap * Math.max(0, n-1);
    const leftover = Math.max(0, state.H - total - minGap);
    const gap = n>1 ? state.lineGap + Math.floor(leftover/(n-1)) : 0;
    let y = Math.floor((state.H - (total + gap*(n-1)))/2);
    for(let i=0;i<n;i++){ ys.push(y); y += lineHeights[i] + gap; }
  }else{
    let y = Math.floor((state.H - (lineHeights.reduce((a,b)=>a+b,0) + state.lineGap*(Math.max(0,lineHeights.length-1))))/2);
    for(let i=0;i<lineHeights.length;i++){ ys.push(y); y += lineHeights[i] + state.lineGap; }
  }
  // horizontal positions (per-line align & spacing)
  const xsList=[];
  for(let li=0; li<sizesPerLine.length; li++){
    const sizes = sizesPerLine[li];
    const gutter = Math.max(0, (state.lineGutter[li] ?? state.gutter)|0);
    const spacingMode = state.lineSpacing[li] || 'natural';
    let gapsPix = state.wordSpacing;
    let totalW = sizes.reduce((a,s)=>a+s.w,0);
    let nGaps = Math.max(0, sizes.length-1);
    if((spacingMode==='equal' || spacingMode==='equalNoOuter') && nGaps>0){
      const leftover = Math.max(0, state.W - totalW);
      gapsPix = Math.floor(leftover / nGaps);
    }
    let allW = totalW + gapsPix*nGaps;
    let x0 = 0;
    const align = state.lineAlign[li] || 'center';
    if(spacingMode==='equalNoOuter'){
      // keep outer gutters fixed
      x0 = gutter;
      allW = state.W - gutter*2;
      const inner = allW - totalW;
      gapsPix = nGaps>0 ? Math.floor(inner / nGaps) : 0;
    }
    if(spacingMode!=='equalNoOuter'){
      if(align==='left') x0 = gutter;
      else if(align==='center') x0 = Math.floor((state.W - allW)/2);
      else if(align==='right') x0 = state.W - allW - gutter;
    }
    const xs=[]; let x = x0;
    for(let i=0;i<sizes.length;i++){
      xs.push(x);
      x += sizes[i].w + gapsPix;
    }
    xsList.push(xs);
  }
  return {ys, xsList, sizesPerLine, lineHeights};
}

function shrinkWithin(w, x0){
  const max = state.W - 2;
  if(x0 + w <= max) return 1.0;
  if(w<=0) return 1.0;
  const allow = Math.max(1, max - x0);
  return Math.max(0.3, allow / w);
}

function drawExactFrameTo(targetCtx, W, H, t){
  return new Promise(async (resolve)=>{
    // BG
    if(state.bgSource === "Solid"){
      targetCtx.fillStyle = state.solidHex; targetCtx.fillRect(0,0,W,H);
    }else if(bgImageBitmap){
      targetCtx.drawImage(bgImageBitmap, 0,0, W,H);
    }else{
      targetCtx.fillStyle = "#000"; targetCtx.fillRect(0,0,W,H);
    }

    const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
    const {ys, xsList, sizesPerLine} = layoutPositions(base);

    const animOn = state.animEnabled;
    const BY = animOn ? state.BY : 0, SC = animOn ? state.SC : 0,
          BC = animOn ? state.BC : 1, WX = animOn ? state.WX : 0,
          WY = animOn ? state.WY : 0, WC = animOn ? state.WC : 1,
          JJ = animOn ? state.JJ : 0, JC = animOn ? state.JC : 1;

    const bphase = 2*Math.PI*BC*t;
    const bcent  = (0.5 - 0.5*Math.cos(bphase) - 0.5)*2.0;
    const scaleA = 1.0 + SC*bcent;
    const phases = [0.00,0.80,1.55,2.30,3.05];

    for(let li=0; li<state.lines.length; li++){
      const line = state.lines[li];
      const ph = phases[li % phases.length];
      const wave_base = 2*Math.PI*WC*t;

      for(let wi=0; wi<line.length; wi++){
        const seg = line[wi];
        const sc = Math.max(0.1, seg.scale||1);
        const size = sizesPerLine[li][wi];
        let x0 = xsList[li][wi] + (seg.dx||0);
        let y0 = ys[li] + (seg.dy||0);

        // shrink if overflow
        const shrink = shrinkWithin(size.w, x0);
        const pxSize = (state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize) * sc * shrink;

        // animate offsets
        const wave_x = WX * Math.sin(wave_base + ph);
        const wave_y = WY * Math.cos(wave_base + ph/1.5);
        const jit_base = 2*Math.PI*JC*t;
        const jx = JJ * Math.sin(jit_base*1.3 + ph*1.1);
        const jy = JJ * Math.cos(jit_base*1.7 + ph*0.9);
        const off_x = wave_x + jx;
        const off_y = wave_y + jy + (BY * bcent * Math.cos(ph));

        // render text
        targetCtx.save();
        targetCtx.font = loadFont(pxSize);
        targetCtx.fillStyle = colorHex(seg.color);
        targetCtx.translate(Math.max(0,Math.min(W,Math.floor(x0 + off_x))), Math.max(0,Math.min(H,Math.floor(y0 + off_y))));
        if(Math.abs(scaleA-1)>1e-3) targetCtx.scale(scaleA, scaleA);
        targetCtx.fillText(seg.text || " ", 0, 0);
        targetCtx.restore();
      }
    }
    resolve();
  });
}

// Simple vs Exact live preview (we only implement exact here for accuracy)
let rafId=null, lastTs=0;
function targetFps(){ return (perfMode.value==="smooth") ? 18 : 10; }
function loop(ts){
  const minDelta = 1000/targetFps();
  if(ts-lastTs >= minDelta){
    lastTs = ts;
    const dt = (Date.now()%(state.seconds*1000))/(state.seconds*1000);
    // draw exact frame to preview canvas at device scale
    const s = deviceScale();
    const off = new OffscreenCanvas(state.W, state.H);
    const octx = off.getContext("2d");
    drawExactFrameTo(octx, state.W, state.H, dt).then(()=>{
      // upscale
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(off, 0,0, canvas.width, canvas.height);
      drawGuides(); // selection guides
    });
  }
  if(state.live) rafId = requestAnimationFrame(loop);
}
function startLive(){ if(!rafId){ state.live=true; rafId = requestAnimationFrame(loop);} }
function stopLive(){ state.live=false; if(rafId){ cancelAnimationFrame(rafId); rafId=null; } }

function drawGuides(){
  // selection rectangle
  const sel = state.sel;
  if(sel && state.lines[sel.li] && state.lines[sel.li][sel.wi]){
    // rough selection box by re-laying
    const s = deviceScale();
    const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
    const {ys, xsList, sizesPerLine} = layoutPositions(base);
    const seg = state.lines[sel.li][sel.wi];
    const size = sizesPerLine[sel.li][sel.wi];
    const x = (xsList[sel.li][sel.wi] + (seg.dx||0)) * s;
    const y = (ys[sel.li] + (seg.dy||0)) * s;
    ctx.strokeStyle = "rgba(0,255,225,.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.max(0,x), Math.max(0,y), Math.max(1,size.w*s), Math.max(1,size.h*s));
  }
}

// =============== UI wiring ===============
function refreshPresetThumbs(){
  const wrap = bgPreset;
  wrap.innerHTML = "";
  const group = PRESETS[state.resMode] || {};
  Object.entries(group).forEach(([name, url], idx)=>{
    const tile = document.createElement("div");
    tile.className = "tile"+(state.bgChoice===name?" selected":"");
    tile.innerHTML = `<img loading="lazy" src="${url}" alt="${name}"><div class="label">${name}</div>`;
    tile.addEventListener("click", ()=>{
      state.bgChoice = name;
      refreshPresetThumbs();
      loadBg();
    }, {passive:true});
    wrap.appendChild(tile);
  });
  bgPreset.classList.toggle("hidden", Object.keys(group).length===0);
}

function setRes(r){
  state.resMode = r;
  if(r==="96x128"){ state.W=96; state.H=128; }
  else if(r==="64x64"){ state.W=64; state.H=64; }
  else { document.getElementById("customWH").classList.remove("hidden"); }
  if(r!=="Custom"){ document.getElementById("customWH").classList.add("hidden"); }
  fitCanvas(); refreshPresetThumbs(); loadBg();
}

resMode.addEventListener("change", e=> setRes(e.target.value));
Winput.addEventListener("change", e=>{ state.W=parseInt(e.target.value)||96; fitCanvas(); loadBg(); });
Hinput.addEventListener("change", e=>{ state.H=parseInt(e.target.value)||128; fitCanvas(); loadBg(); });

bgTabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    bgTabs.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.tab;
    state.bgSource = t==="Preset" ? "Preset" : (t==="Solid" ? "Solid" : "Custom");
    bgPreset.classList.toggle("hidden", state.bgSource!=="Preset");
    bgSolid.classList.toggle("hidden", state.bgSource!=="Solid");
    bgCustom.classList.toggle("hidden", state.bgSource!=="Custom");
    loadBg();
  });
});
solidHex.addEventListener("input", e=>{ state.solidHex=e.target.value; });
customBg.addEventListener("change", loadBg);

liveToggle.addEventListener("change", e=>{
  if(e.target.checked) startLive(); else stopLive();
});
perfMode.addEventListener("change", ()=>{ if(state.live){ stopLive(); startLive(); } });

addLineBtn.addEventListener("click", ()=>{
  pushHistory(); state.lines.push([{text:"WORD",color:"White",scale:1,dx:0,dy:0}]); openInspector(state.lines.length-1, 0);
});
resetAutoBtn.addEventListener("click", ()=>{
  state.lines.forEach(line=> line.forEach(seg=>{ seg.dx=0; seg.dy=0; }));
});
clearTextBtn.addEventListener("click", ()=>{
  pushHistory(); state.lines = [[{text:"",color:"White",scale:1,dx:0,dy:0}]];
});
centerAllBtn.addEventListener("click", ()=>{ centerAllLines(); });

sizeMode.addEventListener("change", e=>{
  state.sizeMode = e.target.value;
  manualWrap.classList.toggle("hidden", state.sizeMode!=="Manual");
});
manualSize.addEventListener("change", e=> state.manualFontSize = parseInt(e.target.value)||24);
lineGap.addEventListener("change", e=> state.lineGap = parseInt(e.target.value)||2);
wordSpacing.addEventListener("change", e=> state.wordSpacing = parseInt(e.target.value)||3);

gutterPx.addEventListener("change", e=> state.gutter = Math.max(0, parseInt(e.target.value)||0));


animEnabled.addEventListener("change", e=> state.animEnabled = e.target.checked);
[animBY,animSC,animBC,animWX,animWY,animWC,animJJ,animJC].forEach(inp=>{
  inp.addEventListener("change", ()=>{
    state.BY=parseFloat(animBY.value); state.SC=parseFloat(animSC.value);
    state.BC=parseFloat(animBC.value); state.WX=parseFloat(animWX.value);
    state.WY=parseFloat(animWY.value); state.WC=parseFloat(animWC.value);
    state.JJ=parseFloat(animJJ.value); state.JC=parseFloat(animJC.value);
  });
});

seconds.addEventListener("change", e=> state.seconds = Math.max(1, parseInt(e.target.value)||8));
fps.addEventListener("change", e=> state.fps = Math.max(1, Math.min(30, parseInt(e.target.value)||15)));
outName.addEventListener("input", e=> state.outName = e.target.value || "led");

// Owner
ownerApply.addEventListener("click", ()=>{
  state.owner = (ownerKey.value.trim().toLowerCase() === OWNER_KEY.toLowerCase());
  ownerActions.classList.toggle("hidden", !state.owner);
});
loadOwnerA.addEventListener("click", ()=>{
  // Owner A — Wheelie 96×128
  setRes("96x128");
  state.bgSource="Preset"; state.bgChoice="Wheelie (96×128)"; refreshPresetThumbs(); loadBg();
  state.lines = [
    [{text:"WILL",color:"Blue",scale:1,dx:0,dy:0}],
    [{text:"WHEELIE",color:"Green",scale:1,dx:0,dy:0}],
    [{text:"FOR",color:"Yellow",scale:1,dx:0,dy:0}],
    [{text:"BOOKTOK",color:"Magenta",scale:1,dx:0,dy:0}],
    [{text:"GIRLIES",color:"Red",scale:1,dx:0,dy:0}]
  ];
});
loadOwnerB.addEventListener("click", ()=>{
  // Owner B — 2 Up 96×128 with requested text
  setRes("96x128");
  state.bgSource="Preset"; state.bgChoice="2 Up (96×128)"; refreshPresetThumbs(); loadBg();
  state.lines = [
    [{text:"FREE",color:"White",scale:1,dx:0,dy:0}],
    [{text:"RIDES",color:"White",scale:1,dx:0,dy:0}],
    [{text:"FOR",color:"White",scale:1,dx:0,dy:0}],
    [{text:"BOOKTOK",color:"White",scale:1,dx:0,dy:0}],
    [{text:"GIRLIES",color:"White",scale:1,dx:0,dy:0}]
  ];
});

// JSON IO
downloadJson.addEventListener("click", ()=>{
  const snap = JSON.stringify(state, null, 2);
  const blob = new Blob([snap], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "led_preset.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
uploadJson.addEventListener("change", async e=>{
  const f = e.target.files[0];
  if(!f) return;
  const text = await f.text();
  try{
    const data = JSON.parse(text);
    Object.assign(state, data);
    setRes(state.resMode);
    refreshPresetThumbs();
    await loadBg();
  }catch(err){ alert("Failed to load JSON: "+err); }
});

// Word color select options
(function fillColorSelect(){
  const sel = document.getElementById("wordColor");
  COLOR_NAMES.forEach(n=>{
    const opt = document.createElement("option"); opt.value=n; opt.textContent=n;
    sel.appendChild(opt);
  });
})();

// =============== Inspector controls ===============
// ---- Alignment helpers ----
function totalLineWidth(li, base){
  const {xsList, sizesPerLine} = layoutPositions(base);
  const sizes = sizesPerLine[li] || [];
  const total = sizes.reduce((a,s)=>a+s.w,0) + state.wordSpacing*Math.max(0, sizes.length-1);
  return total;
}

function alignLine(li, mode){
  // mode: 'left'|'center'|'right'
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList, sizesPerLine} = layoutPositions(base);
  const sizes = sizesPerLine[li] || [];
  const xs = xsList[li] || [];
  const total = sizes.reduce((a,s)=>a+s.w,0) + state.wordSpacing*Math.max(0, sizes.length-1);
  let offsetX = 0;
  if(mode==='left'){ offsetX = 0 - xs[0]; }
  else if(mode==='center'){ offsetX = Math.floor((state.W - total)/2) - xs[0]; }
  else if(mode==='right'){ offsetX = (state.W - total) - xs[0]; }
  // apply offset to all words' dx, keep dy unchanged
  for(let wi=0; wi<state.lines[li].length; wi++){
    state.lines[li][wi].dx = (state.lines[li][wi].dx||0) + offsetX;
  }
}

function centerAllLines(){
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {xsList, sizesPerLine} = layoutPositions(base);
  for(let li=0; li<state.lines.length; li++){
    const sizes = sizesPerLine[li] || [];
    const xs = xsList[li] || [];
    const total = sizes.reduce((a,s)=>a+s.w,0) + state.wordSpacing*Math.max(0, sizes.length-1);
    const targetX0 = Math.floor((state.W - total)/2);
    const offsetX = targetX0 - xs[0];
    for(let wi=0; wi<state.lines[li].length; wi++){
      state.lines[li][wi].dx = (state.lines[li][wi].dx||0) + offsetX;
    }
  }
}

const inspector = document.getElementById("inspector");
const wordText = document.getElementById("wordText");
const wordColor = document.getElementById("wordColor");
const wordScale = document.getElementById("wordScale");
const addWordBtn = document.getElementById("addWord");
const delWordBtn = document.getElementById("delWord");
const delLineBtn = document.getElementById("delLine");
const centerWordBtn = document.getElementById("centerWord");
const alignLeftLineBtn = document.getElementById("alignLeftLine");
const alignCenterLineBtn = document.getElementById("alignCenterLine");
const alignRightLineBtn = document.getElementById("alignRightLine");

function openInspector(li, wi){
  state.sel = {li, wi};
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  wordText.value = seg.text || "";
  wordColor.value = seg.color || "White";
  wordScale.value = seg.scale || 1;
  showPad.checked = !!state.showPad; lockX.checked = !!state.lockX; lockY.checked = !!state.lockY; const np = document.querySelector('.nudge-pad'); if(np) np.style.display = state.showPad ? 'flex' : 'none';
  spacingModeLine.value = state.lineSpacing[li] || 'natural';
  lineGutterPx.value = state.lineGutter[li] ?? 0;
  inspector.classList.remove("hidden");
}
function applyInspector(){
  const {li, wi} = state.sel || {};
  if(li==null || wi==null) return;
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  seg.text = wordText.value;
  seg.color = wordColor.value;
  seg.scale = Math.max(0.3, Math.min(4, parseFloat(wordScale.value)||1));
}
wordText.addEventListener("input", applyInspector);
wordColor.addEventListener("change", applyInspector);
wordScale.addEventListener("change", applyInspector);
addWordBtn.addEventListener("click", ()=>{
  const {li} = state.sel || {li:0};
  state.lines[li] = state.lines[li] || [];
  pushHistory(); state.lines[li].push({text:"WORD",color:"White",scale:1,dx:0,dy:0}); openInspector(li, state.lines[li].length-1);
});
delWordBtn.addEventListener("click", ()=>{
  const {li,wi} = state.sel || {};
  if(li==null || wi==null) return;
  pushHistory(); state.lines[li].splice(wi,1);
  if(state.lines[li].length===0){ pushHistory(); state.lines.splice(li,1); inspector.classList.add("hidden"); }
});
delLineBtn.addEventListener("click", ()=>{
  const {li} = state.sel || {};
  if(li==null) return;
  pushHistory(); state.lines.splice(li,1);
  inspector.classList.add("hidden");
});
centerWordBtn.addEventListener("click", ()=>{
  const {li,wi} = state.sel || {};
  if(li==null || wi==null) return;
  pushHistory(); state.lines[li][wi].dx = 0; state.lines[li][wi].dy = 0;
});
alignLeftLineBtn.addEventListener("click", ()=>{ const {li} = state.sel || {}; if(li==null) return; pushHistory(); alignLine(li,"left"); });
alignCenterLineBtn.addEventListener("click", ()=>{ const {li} = state.sel || {}; if(li==null) return; pushHistory(); alignLine(li,"center"); });
alignRightLineBtn.addEventListener("click", ()=>{ const {li} = state.sel || {}; if(li==null) return; pushHistory(); alignLine(li,"right"); });

// =============== Dragging on canvas (touch + mouse) ===============
let dragging=false, dragSel=null, dragOff={x:0,y:0};
const HIT_PAD = 6;

function hitWord(px, py){
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList, sizesPerLine} = layoutPositions(base);
  // prefer top-most (last drawn)
  for(let li=state.lines.length-1; li>=0; li--){
    for(let wi=state.lines[li].length-1; wi>=0; wi--){
      const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

      const size = sizesPerLine[li][wi];
      const x = xsList[li][wi] + (seg.dx||0) - HIT_PAD;
      const y = ys[li] + (seg.dy||0) - HIT_PAD;
      const w = size.w + HIT_PAD*2;
      const h = size.h + HIT_PAD*2;
      // scale canvas coords to native
      const s = deviceScale();
      const cx = px / (canvas.width/state.W);
      const cy = py / (canvas.height/state.H);
      if(cx>=x && cx<=x+w && cy>=y && cy<=y+h) return {li,wi};
    }
  }
  return null;
}

canvas.addEventListener("mousedown", e=>{
  const r = canvas.getBoundingClientRect();
  const hit = hitWord(e.clientX - r.left, e.clientY - r.top);
  if(hit){
    dragging=true; dragSel=hit;
    openInspector(hit.li, hit.wi);
  }else{
    inspector.classList.add("hidden");
  }
});
window.addEventListener("mousemove", e=>{
  if(!dragging || !dragSel) return;
  const r = canvas.getBoundingClientRect();
  const {li,wi} = dragSel;
  // map to native pixels
  const nx = (e.clientX - r.left) / (canvas.width/state.W);
  const ny = (e.clientY - r.top)  / (canvas.height/state.H);
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList} = layoutPositions(base);
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  // target center roughly on pointer
  // clamp within bounds
  let ndx = Math.round(nx - xsList[li][wi]);
  let ndy = Math.round(ny - ys[li]);
  // compute word width/height at base scale
  const size = sizesPerLine[li][wi];
  const minX = 0 - xsList[li][wi];
  const maxX = state.W - size.w - xsList[li][wi];
  const minY = 0 - ys[li];
  const maxY = state.H - size.h - ys[li];
  ndx = Math.max(minX, Math.min(maxX, ndx));
  ndy = Math.max(minY, Math.min(maxY, ndy));
  seg.dx = ndx; seg.dy = ndy;
});
window.addEventListener("mouseup", ()=>{ dragging=false; state.tempLockY=false; clearTimeout(dragTimer); dragSel=null; });

// touch
let longPressTimer=null;
canvas.addEventListener("touchstart", e=>{
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const hit = hitWord(t.clientX - r.left, t.clientY - r.top);
  if(hit){
    longPressTimer = setTimeout(()=> openInspector(hit.li, hit.wi), 600);
    dragging=true; dragSel=hit;
  }
},{passive:true});
canvas.addEventListener("touchmove", e=>{
  if(!dragging || !dragSel) return;
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const nx = (t.clientX - r.left) / (canvas.width/state.W);
  const ny = (t.clientY - r.top)  / (canvas.height/state.H);
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList} = layoutPositions(base);
  const {li,wi} = dragSel;
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  // clamp within bounds
  let ndx = Math.round(nx - xsList[li][wi]);
  let ndy = Math.round(ny - ys[li]);
  // compute word width/height at base scale
  const size = sizesPerLine[li][wi];
  const minX = 0 - xsList[li][wi];
  const maxX = state.W - size.w - xsList[li][wi];
  const minY = 0 - ys[li];
  const maxY = state.H - size.h - ys[li];
  ndx = Math.max(minX, Math.min(maxX, ndx));
  ndy = Math.max(minY, Math.min(maxY, ndy));
  seg.dx = ndx; seg.dy = ndy;
},{passive:true});
window.addEventListener("touchend", ()=>{ dragging=false; state.tempLockY=false; clearTimeout(dragTimer); dragSel=null; if(longPressTimer){clearTimeout(longPressTimer); longPressTimer=null;} }, {passive:true});

// =============== Render GIF (client) ===============
let prevUrl = null;
async function renderGifClientSide(){
  const W = state.W, H = state.H;
  let renderFps = state.fps;
  // (Optional) auto-match bg fps here in future if using animated backgrounds
  const total = Math.max(1, Math.round(state.seconds * renderFps));
  const encCanvas = document.createElement("canvas");
  encCanvas.width=W; encCanvas.height=H;
  const encCtx = encCanvas.getContext("2d");
  const enc = new GIFEncoder(W,H,"neuquant",true);
  enc.setDelay(Math.round(1000/renderFps));
  enc.setRepeat(0);
  enc.start();
  for(let i=0;i<total;i++){
    const t = i/total;
    await drawExactFrameTo(encCtx, W,H, t);
    const frame = encCtx.getImageData(0,0,W,H);
    enc.addFrame(frame.data);
  }
  enc.finish();
  const bin = enc.out.getData();
  const blob = new Blob([bin], {type:"image/gif"});
  const url = URL.createObjectURL(blob);
  if(prevUrl) try{ URL.revokeObjectURL(prevUrl); }catch(e){}
  prevUrl = url;
  dlLink.href = url;
  dlLink.download = `${(state.outName||'led')}_${state.seconds}s_${renderFps}fps_${W}x${H}.gif`;
  dlLink.classList.remove("hidden");
  dlLink.textContent = "⬇️ Download GIF";
}

// =============== Init ===============
async function init(){
  if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  fitCanvas();
  refreshPresetThumbs();
  await loadBg();
  // start live animation
  startLive();
  // inspector initial
  openInspector(0,0);
}
init();

renderGifBtn.addEventListener("click", ()=> renderGifClientSide());


document.addEventListener("visibilitychange", ()=>{
  if(document.hidden){ stopLive(); }
  else if(liveToggle.checked){ startLive(); }
});

function snapshot(){
  // shallow copy safe for our shape
  return JSON.parse(JSON.stringify({
    resMode: state.resMode, W: state.W, H: state.H,
    bgSource: state.bgSource, bgChoice: state.bgChoice, solidHex: state.solidHex,
    lines: state.lines, sizeMode: state.sizeMode, manualFontSize: state.manualFontSize,
    lineGap: state.lineGap, wordSpacing: state.wordSpacing, gutter: state.gutter,
    animEnabled: state.animEnabled, BY: state.BY, SC: state.SC, BC: state.BC, WX: state.WX, WY: state.WY, WC: state.WC, JJ: state.JJ, JC: state.JC
  }));
}
function pushHistory(){
  state.history.push(snapshot());
  if(state.history.length>100) state.history.shift();
  state.future.length = 0;
}
function restoreSnap(snap){
  Object.assign(state, snap);
  fitCanvas(); refreshPresetThumbs(); loadBg();
}
undoBtn.addEventListener("click", ()=>{
  if(state.history.length===0) return;
  const snap = state.history.pop();
  state.future.push(snapshot());
  restoreSnap(snap);
});
redoBtn.addEventListener("click", ()=>{
  if(state.future.length===0) return;
  const snap = state.future.pop();
  state.history.push(snapshot());
  restoreSnap(snap);
});

advancedToggle.addEventListener("change", (e)=>{
  state.advanced = !!e.target.checked;
  document.body.classList.toggle("advanced-on", state.advanced);
});

lineGutterPx.addEventListener("change", (e)=>{
  const {li} = state.sel || {}; if(li==null) return;
  const v = Math.max(0, parseInt(e.target.value)||0);
  state.lineGutter[li] = v;
});

async function decodeGifArrayBuffer(buf){
  try{
    const gif = new window.GIF(buf);
    const frames = gif.decompressFrames(true);
    const images = [];
    const durations = [];
    for(const fr of frames){
      const {patch, dims, delay} = fr;
      // Create image from patch
      const cw = dims.width, ch = dims.height;
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const ctx = c.getContext('2d');
      const imgData = ctx.createImageData(cw, ch);
      imgData.data.set(patch);
      ctx.putImageData(imgData, 0, 0);
      const im = new Image();
      im.src = c.toDataURL('image/png');
      await new Promise(r=> im.onload=r);
      images.push(im);
      durations.push(Math.max(10, delay||100)); // fallback 100ms
    }
    const median = durations.sort((a,b)=>a-b)[Math.floor(durations.length/2)] || 100;
    const bgFps = Math.max(1, Math.min(60, Math.round(1000/median)));
    return {images, durations, bgFps, size:[images[0].width, images[0].height]};
  }catch(e){
    console.warn('GIF decode failed', e);
    return null;
  }
}

helpToggle.addEventListener('change', e=>{
  helpOverlay.classList.toggle('hidden', !e.target.checked);
});
closeHelp.addEventListener('click', ()=>{
  helpOverlay.classList.add('hidden');
  helpToggle.checked = false;
});

function nudgeSelected(dx, dy){
  const {li, wi} = state.sel || {};
  if(li==null || wi==null) return;
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  seg.dx = (seg.dx||0) + dx;
  seg.dy = (seg.dy||0) + dy;
}
nudgeUp.addEventListener('click', ()=> nudgeSelected(0, -1));
nudgeDown.addEventListener('click', ()=> nudgeSelected(0, 1));
nudgeLeft.addEventListener('click', ()=> nudgeSelected(-1, 0));
nudgeRight.addEventListener('click', ()=> nudgeSelected(1, 0));

document.addEventListener('keydown', (ev)=>{
  const base = state.nudgeStep||1; const step = ev.shiftKey ? base*5 : base;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)){
    ev.preventDefault();
    if(ev.key==='ArrowUp') nudgeSelected(0, -(ev.altKey?0:step));
    if(ev.key==='ArrowDown') nudgeSelected(0, (ev.altKey?0:step));
    if(ev.key==='ArrowLeft') nudgeSelected((ev.altKey?-step:-step), (ev.altKey?0:0));
    if(ev.key==='ArrowRight') nudgeSelected((ev.altKey?step:step), (ev.altKey?0:0));
  }
});

nudgeStepSel.addEventListener('change', e=>{
  const v = parseInt(e.target.value)||5;
  state.nudgeStep = v;
});

snapBaselineBtn.addEventListener('click', ()=>{
  const {li, wi} = state.sel || {}; if(li==null||wi==null) return;
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys} = layoutPositions(base);
  const seg = state.lines[li][wi];
  // Color UI refs
  const colorPresetSel = document.getElementById('wordColorPreset');
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');

  if(colorPresetSel){
    colorPresetSel.innerHTML='';
    (window.PRESET_NAMES||Object.keys(PRESET_HEX)).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name; colorPresetSel.appendChild(opt);
    });
  }

  // Defaults/back-compat
  if(!seg.color) seg.color='White';
  if(!seg.colorMode) seg.colorMode='preset';
  if(!seg.customHex) seg.customHex = PRESET_HEX[seg.color] || '#ffffff';

  if(colorPresetSel) colorPresetSel.value = PRESET_HEX[seg.color] ? seg.color : 'White';
  if(customHexInput) customHexInput.value = (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')) ? seg.customHex : (PRESET_HEX[seg.color]||'#ffffff');
  if(useCustomToggle) useCustomToggle.checked = (seg.colorMode==='custom');

  if(colorPresetSel){
    colorPresetSel.onchange = ()=>{
      seg.color = colorPresetSel.value;
      if(seg.colorMode!=='custom') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }
  if(customHexInput){
    customHexInput.oninput = ()=>{
      seg.customHex = customHexInput.value;
      if(useCustomToggle && useCustomToggle.checked) seg.colorMode='custom';
    };
  }
  if(useCustomToggle){
    useCustomToggle.onchange = ()=>{
      seg.colorMode = useCustomToggle.checked ? 'custom' : 'preset';
      if(seg.colorMode==='preset') seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
    };
  }

  seg.dy = 0; // snap to baseline of its computed line
});

showNudgePad.addEventListener('change', e=>{
  state.showPad = !!e.target.checked;
  const np = document.querySelector('.nudge-pad');
  if(np) np.style.display = state.showPad ? 'flex' : 'none';
});
lockX.addEventListener('change', e=> state.lockX = !!e.target.checked);
lockY.addEventListener('change', e=> state.lockY = !!e.target.checked);

snapGuidesToggle.addEventListener('change', e=>{
  state.snapGuides = !!e.target.checked;
});

(function(){
  let dragging=false, startX=0, startY=0;
  fineCrosshair.addEventListener('pointerdown', (e)=>{
    dragging = true; startX = e.clientX; startY = e.clientY; fineCrosshair.setPointerCapture(e.pointerId);
  });
  fineCrosshair.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const dx = Math.round((e.clientX - startX)/3);
    const dy = Math.round((e.clientY - startY)/3);
    nudgeSelected(state.lockX?dx:dx, state.lockY?dy:dy); // locks already respected in nudgeSelected
    startX = e.clientX; startY = e.clientY;
  });
  const stop=()=>{ dragging=false; state.tempLockY=false; clearTimeout(dragTimer); };
  fineCrosshair.addEventListener('pointerup', stop);
  fineCrosshair.addEventListener('pointercancel', stop);
})();

snapToGuidesToggle.addEventListener('change', e=>{
  state.snapToGuides = !!e.target.checked;
});

function maybeSnapToGuides(li, wi, nx, ny){
  if(!state.snapToGuides) return {x:nx, y:ny, snapped:false, kind:null};
  const base = state.sizeMode==="Auto" ? autoBaseSize() : state.manualFontSize;
  const {ys, xsList, sizesPerLine} = layoutPositions(base);
  const size = sizesPerLine[li][wi];
  const cx = nx + size.w/2, cy = ny + size.h/2;
  const gutter = Math.max(0, state.gutter|0);
  const targets = [
    {type:'v', x: state.W/2, kind:'centerX'},
    {type:'v', x: gutter,    kind:'leftGutter'},
    {type:'v', x: state.W-gutter, kind:'rightGutter'},
    {type:'h', y: state.H/2, kind:'centerY'},
  ];
  const thresh = 12;
  let snapped=false, kind=null;
  for(const t of targets){
    if(t.type==='v'){
      const d = Math.abs(cx - t.x);
      if(d<=thresh){ nx = Math.round(t.x - size.w/2); snapped=true; kind=t.kind; break; }
    }else{
      const d = Math.abs(cy - t.y);
      if(d<=thresh){ ny = Math.round(t.y - size.h/2); snapped=true; kind=t.kind; break; }
    }
  }
  return {x:nx, y:ny, snapped, kind};
}

resetPositionsBtn.addEventListener('click', ()=>{
  if(!state.lines || !state.lines.length) return;
  for(const line of state.lines){
    for(const seg of line){ seg.dx = 0; seg.dy = 0; }
  }
});

let lastTick = 0, frameAvg = [];
function updateMetrics(now, renderFps){
  if(!now){ return; }
  if(lastTick){
    const dt = now - lastTick;
    frameAvg.push(dt);
    if(frameAvg.length>20) frameAvg.shift();
    const ms = Math.round(frameAvg.reduce((a,b)=>a+b,0)/frameAvg.length);
    const fps = Math.round(1000/Math.max(1,ms));
    state.metrics.fps = fps;
    state.metrics.frameMs = ms;
    if(metricFps) metricFps.textContent = `FPS: ${fps}`;
    if(metricFrame) metricFrame.textContent = `Frame time: ${ms} ms`;
  }
  lastTick = now;
  const bgMode = (bg.animated ? `GIF@${bg.fps||renderFps}fps` : 'Static');
  if(metricBg) metricBg.textContent = `BG: ${bgMode}`;
}

function hexToRgb(h){
  const s=(h||'').replace('#','').trim();
  if(s.length===3){const r=s[0]+s[0],g=s[1]+s[1],b=s[2]+s[2];return [parseInt(r,16),parseInt(g,16),parseInt(b,16)];}
  if(s.length===6){return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];}
  return [255,255,255];
}
function segFillRGBA(seg){
  if(seg.colorMode==='custom' && /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')){
    const [r,g,b]=hexToRgb(seg.customHex); return `rgba(${r},${g},${b},1)`;
  }
  const hex = PRESET_HEX[seg.color] || '#ffffff';
  const [r,g,b]=hexToRgb(hex); return `rgba(${r},${g},${b},1)`;
}

function normalizeLineSeg(seg){
  seg = Object.assign({text:'', color:'White', colorMode:'preset', customHex:'#ffffff', scale:1, dx:0, dy:0}, seg||{});
  if(!PRESET_HEX[seg.color]) seg.color = 'White';
  if(seg.colorMode!=='custom' && seg.colorMode!=='preset') seg.colorMode='preset';
  if(!/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(seg.customHex||'')){
    seg.customHex = PRESET_HEX[seg.color] || '#ffffff';
  }
  return seg;
}
function normalizeStateLines(lines){
  if(!Array.isArray(lines)) return [];
  for(let i=0;i<lines.length;i++){
    for(let j=0;j<lines[i].length;j++){
      lines[i][j]=normalizeLineSeg(lines[i][j]);
    }
  }
  return lines;
}

function isValidHex(h){
  return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test((h||'').trim());
}
function pushRecentSwatch(hex){
  if(!isValidHex(hex)) return;
  const H = hex.toLowerCase();
  const arr = Array.isArray(state.recentSwatches) ? state.recentSwatches.slice() : [];
  const out = [H];
  for(const c of arr){ if(c!==H) out.push(c); }
  state.recentSwatches = out.slice(0,8);
  try{ localStorage.setItem('recentSwatches', JSON.stringify(state.recentSwatches)); }catch(_){ }
  renderSwatchRow();
}

  if(!isValidHex(hex)) return;
  const H = hex.toLowerCase();
  const arr = state.recentSwatches || [];
  // De-dupe and promote
  const filtered = [H, *[x for x in arr if x!=H]] if false else None
}

function renderSwatchRow(){
  const host = document.getElementById('swatchHistory');
  if(!host) return;
  host.innerHTML = '';
  const arr = Array.isArray(state.recentSwatches) ? state.recentSwatches : [];
  for(const hex of arr){
    const d = document.createElement('div');
    d.className = 'swatch';
    d.setAttribute('draggable','true');
    d.dataset.idx = String(host.childElementCount);
    d.style.background = hex;
    d.title = hex.toUpperCase();
    d.addEventListener('click', ()=>{
      const sel = state.sel||{}; const li = sel.li, wi = sel.wi;
      if(li==null||wi==null) return;
      const seg = state.lines[li][wi];
      seg.customHex = hex; seg.colorMode='custom';
      const customHexInput = document.getElementById('wordCustomHex');
      const useCustomToggle = document.getElementById('useCustomColor');
      if(customHexInput) customHexInput.value = hex;
      if(useCustomToggle) useCustomToggle.checked = true;
    });
    // Drag & drop reorder
    d.addEventListener('dragstart', (ev)=>{
      d.classList.add('dragging');
      ev.dataTransfer.setData('text/plain', String(d.dataset.idx));
    });
    d.addEventListener('dragend', ()=>{ d.classList.remove('dragging'); });
    d.addEventListener('dragover', (ev)=>{ ev.preventDefault(); d.classList.add('drop-target'); });
    d.addEventListener('dragleave', ()=>{ d.classList.remove('drop-target'); });
    d.addEventListener('drop', (ev)=>{
      ev.preventDefault();
      d.classList.remove('drop-target');
      const fromIdx = parseInt(ev.dataTransfer.getData('text/plain')||'-1',10);
      const toIdx = parseInt(d.dataset.idx||'-1',10);
      if(Number.isNaN(fromIdx) || Number.isNaN(toIdx) || fromIdx===toIdx) return;
      const arr = Array.isArray(state.recentSwatches)? state.recentSwatches.slice():[];
      if(fromIdx<0||fromIdx>=arr.length||toIdx<0||toIdx>=arr.length) return;
      const item = arr.splice(fromIdx,1)[0];
      arr.splice(toIdx,0,item);
      state.recentSwatches = arr;
      try{ localStorage.setItem('recentSwatches', JSON.stringify(arr)); }catch(_){ }
      renderSwatchRow();
    });

      const sel = state.sel||{}; const li = sel.li, wi = sel.wi;
      if(li==null||wi==null) return;
      const seg = state.lines[li][wi];
      seg.customHex = hex; seg.colorMode='custom';
      const customHexInput = document.getElementById('wordCustomHex');
      const useCustomToggle = document.getElementById('useCustomColor');
      if(customHexInput) customHexInput.value = hex;
      if(useCustomToggle) useCustomToggle.checked = true;
    });
    host.appendChild(d);
  }
}

function rgbToHex(r,g,b){
  const to2 = v => ('0'+Math.max(0,Math.min(255,v|0)).toString(16)).slice(-2);
  return '#'+to2(r)+to2(g)+to2(b);
}

function sampleCanvasColor(canvas, clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(canvas.width-1, Math.round((clientX - rect.left) * (canvas.width/rect.width))));
  const y = Math.max(0, Math.min(canvas.height-1, Math.round((clientY - rect.top) * (canvas.height/rect.height))));
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(x, y, 1, 1).data;
  return rgbToHex(data[0], data[1], data[2]);
}

if(addPresetToSwatches){
  addPresetToSwatches.addEventListener('click', ()=>{
    const sel = state.sel||{}; const li=sel.li, wi=sel.wi;
    if(li==null||wi==null) return;
    const seg = state.lines[li][wi];
    const hex = PRESET_HEX[seg.color] || '#ffffff';
    pushRecentSwatch(hex);
  });
}

let eyeDropActive = false;
async function startEyedrop(){
  const canvas = document.getElementById('previewCanvas') || document.querySelector('canvas');
  if(!canvas) return;
  // EyeDropper API (Chromium)
  if('EyeDropper' in window){
    try{
      const ed = new window.EyeDropper();
      const res = await ed.open();
      const hex = res.sRGBHex;
      applySampledHex(hex);
      return;
    }catch(err){
      // canceled or unsupported
    }
  }
  // Fallback: click on canvas to pick
  eyeDropActive = true;
  eyedropHint && (eyedropHint.style.display='inline');
  const once = (ev)=>{
    if(!eyeDropActive) return;
    eyeDropActive=false;
    eyedropHint && (eyedropHint.style.display='none');
    canvas.style.cursor='';
    canvas.removeEventListener('click', once);
    const hex = sampleCanvasColor(canvas, ev.clientX, ev.clientY);
    applySampledHex(hex);
  };
  canvas.style.cursor='crosshair';
  canvas.addEventListener('click', once);
}
function applySampledHex(hex){
  if(!isValidHex(hex)) return;
  const sel = state.sel||{}; const li=sel.li, wi=sel.wi;
  if(li==null||wi==null) return;
  const seg = state.lines[li][wi];
  seg.customHex = hex; seg.colorMode='custom';
  const customHexInput = document.getElementById('wordCustomHex');
  const useCustomToggle = document.getElementById('useCustomColor');
  if(customHexInput) customHexInput.value = hex;
  if(useCustomToggle) useCustomToggle.checked = true;
  pushRecentSwatch(hex);
}

if(eyedropperBtn){
  eyedropperBtn.addEventListener('click', ()=>{
    startEyedrop();
  });
}

function exportPresetJSON(){
  const snapshot = buildPresetSnapshot ? buildPresetSnapshot() : (stateToSnapshot? stateToSnapshot() : defaultSnapshot());
  snapshot.recentSwatches = Array.isArray(state.recentSwatches) ? state.recentSwatches : [];
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'led_preset.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2500);
}
function importPresetJSONFile(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result||'{}');
      if(data.recentSwatches && Array.isArray(data.recentSwatches)){
        state.recentSwatches = data.recentSwatches.slice(0, 32);
        try{ localStorage.setItem('recentSwatches', JSON.stringify(state.recentSwatches)); }catch(_){ }
        renderSwatchRow();
      }
      if(applyPresetFromSnapshot) applyPresetFromSnapshot(data);
      else if(snapshotToState) snapshotToState(data);
    }catch(e){ console.error('Preset import failed', e); }
  };
  reader.readAsText(file);
}

(function wirePresetButtons(){
  const dl = document.getElementById('downloadPresetBtn') || document.getElementById('downloadPreset');
  if(dl){ dl.addEventListener('click', exportPresetJSON); }
  const up = document.getElementById('uploadPresetInput');
  if(up){ up.addEventListener('change', (e)=>{ const f=e.target.files&&e.target.files[0]; if(f) importPresetJSONFile(f); }); }
})();
