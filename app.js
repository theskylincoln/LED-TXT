/* =======================================================================
   LED Backpack Animator v1.0 — app.js (Updated for Animated GIF Backgrounds)
   - Integrated SuperGif (libgif.js) for frame-by-frame animated GIF parsing.
   - Added UI controls for Play/Pause and Reset of the background GIF.
   - Ensured GIF playback starts immediately and toggles the main preview mode.
   ======================================================================= */

/* ------------------ small helpers ------------------ */
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

/* ------------------ DOM refs ------------------ */
const canvas=$("#led"), ctx=canvas.getContext("2d"), wrap=$(".canvas-wrap");

/* toolbar */
const modeEditBtn=$("#modeEdit"), modePreviewBtn=$("#modePreview");
const zoomSlider=$("#zoom"), fitBtn=$("#fit");
const undoBtn=$("#undoBtn"), redoBtn=$("#redoBtn"), clearAllBtn=$("#clearAllBtn");
const addWordBtn=$("#addWordBtn"), addLineBtn=$("#addLineBtn");
const multiToggle=$("#multiToggle");

/* inspector */
const accFont=$("#accFont"), accLayout=$("#accLayout"), accAnim=$("#accAnim");
const fontSelect=$("#fontSelect"), fontSize=$("#fontSize"), autoSize=$("#autoSize");
const fontColor=$("#fontColor"), swatches=$("#swatches"), addSwatchBtn=$("#addSwatchBtn");
const lineGap=$("#lineGap"), wordGap=$("#wordGap");
const hAlignBtns=$$(".acc-body .row:nth-of-type(3) .seg button");
const vAlignBtns=$$(".acc-body .row:nth-of-type(4) .seg button");

/* background */
const bgPanel=$("#bgPanel"), bgGrid=$("#bgGrid"), bgUpload=$("#bgUpload");
const bgSolidTools=$("#bgSolidTools"), bgSolidColor=$("#bgSolidColor"), bgSwatches=$("#bgSwatches");
const addBgSwatchBtn=$("#addBgSwatchBtn");

// ▼ NEW: GIF Controls DOM refs
const bgGifTools=$("#bgGifTools");
const bgGifPlayBtn=$("#bgGifPlayBtn");
const bgGifResetBtn=$("#bgGifResetBtn");
// ▲ NEW

/* render */
const renderPanel=$("#renderPanel");
const fpsInput=$("#fps"), secondsInput=$("#seconds");
const previewRenderBtn=$("#previewRenderBtn"), gifRenderBtn=$("#gifRenderBtn");
const progress=$("#progress"), progressFill=$(".progress-fill", progress);
const progressTime=$(".progress-time"), tCur=$("#tCur"), tEnd=$("#tEnd");
const gifPreview=$("#gifPreview");

/* modals */
const emojiModal=$("#emojiModal");

/* ------------------ state ------------------ */
let mode="edit", zoom=1, selected=null;
let history=[], future=[];
const UNDO_LIMIT=100;
let startT=0, rafId=null;
const uiLock = { emojiOpen: false };
const defaults={ font:"Orbitron", size:22, color:"#FFFFFF" };

const doc={
  version:"1.0",
  res:{ w:96, h:128 },
  bg:{ type:"preset", color:null, image:null, preset:"assets/presets/96x128/Preset_A.png", isAnimatedGif:false },
  spacing:{ lineGap:4, wordGap:6 }, style:{ align:"center", valign:"middle" },
  lines:[
    { words:[{text:"LED",      color:"#E9EDFB", font:"Orbitron", size:24, anims:[]}] },
    { words:[{text:"Backpack", color:"#FF6BD6", font:"Orbitron", size:24, anims:[]}] },
    { words:[{text:"Animator", color:"#7B86FF", font:"Orbitron", size:24, anims:[]}] }
  ],
  anims:[],
  multi:new Set()
};

let gifPlayer = null; // Global SuperGif player instance
let currentZoom = 100; // Assuming a percentage zoom for the canvas transform

const PRESETS = {
  '96x128': [
    { thumb: 'assets/thumbs/Preset_A_thumb.png', full: 'assets/presets/96x128/Preset_A.png' },
    { thumb: 'assets/thumbs/Preset_B_thumb.png', full: 'assets/presets/96x128/Preset_B.png' }
  ],
  '64x64': [
    { thumb: 'assets/thumbs/Preset_C_thumb.png', full: 'assets/presets/64x64/Preset_C.png' },
    { thumb: 'assets/thumbs/Preset_D_thumb.png', full: 'assets/presets/64x64/Preset_D.png' }
  ]
};

// ... (PALETTE, UTILS, and STATE/HISTORY functions remain the same) ...

/* ------------------ UTILS ------------------ */
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}
function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

/* ------------------ STATE & HISTORY ------------------ */
function snapshot() { return JSON.parse(JSON.stringify(doc)); }
function restore(snap) { Object.assign(doc, snap); initCanvas(); render(); updateUI(); }
function pushState(actionType) {
  future.length = 0;
  history.push({ state: snapshot(), actionType, timestamp: Date.now() });
  if (history.length > UNDO_LIMIT) history.shift();
  updateUI();
}
function undo() {
  if (history.length <= 1) return;
  future.unshift({ state: snapshot() });
  history.pop();
  restore(history[history.length - 1].state);
}
function redo() {
  if (future.length === 0) return;
  const nextState = future.shift().state;
  history.push({ state: nextState, actionType: 'REDO', timestamp: Date.now() });
  restore(nextState);
}

/* ------------------ CANVAS & RENDERING ------------------ */
function initCanvas(){
  canvas.width=doc.res.w; canvas.height=doc.res.h;
  canvas.style.width=`${doc.res.w}px`; canvas.style.height=`${doc.res.h}px`;
  fitZoom();
}

function startPreview(){
  mode="preview"; startT=Date.now(); modeEditBtn.classList.remove("active"); modePreviewBtn.classList.add("active");
  if(rafId) cancelAnimationFrame(rafId);
  loop();
}

function stopPreview(){
  mode="edit"; modeEditBtn.classList.add("active"); modePreviewBtn.classList.remove("active");
  if(rafId) cancelAnimationFrame(rafId);
  rafId=null;
  render(); // Final static render
}

function loop(){
  const t = (Date.now() - startT) / 1000;
  render(t * 1000); // Pass time in milliseconds
  rafId = requestAnimationFrame(loop);
}

/**
 * Renders a single frame.
 * @param {number} t - Time in milliseconds since animation start, used for FX.
 */
function render(t=0){
  const w = doc.res.w, h = doc.res.h;
  ctx.clearRect(0, 0, w, h);

  // 1. Background
  if(doc.bg.type==="solid"){
    ctx.fillStyle=doc.bg.color||"#000000";
    ctx.fillRect(0, 0, w, h);
  } else if (doc.bg.image) {
    if (doc.bg.isAnimatedGif && gifPlayer) {
      // If the GIF is explicitly playing OR we are in the main preview mode, advance the frame
      if (gifPlayer.get_playing() || mode === "preview") {
        // SuperGif frame delay is in centiseconds (10ms units)
        const frameDur = gifPlayer.get_delay_point(gifPlayer.get_frame_index()) * 10;
        
        if (!gifPlayer.lastFrameTime) gifPlayer.lastFrameTime = t;

        if (t >= gifPlayer.lastFrameTime + frameDur) {
           gifPlayer.advance_frame();
           gifPlayer.lastFrameTime = t;
        }
      }
      // Draw the GIF's current frame
      ctx.drawImage(doc.bg.image, 0, 0, w, h);

    } else {
      // Static Image/Preset
      ctx.drawImage(doc.bg.image, 0, 0, w, h);
    }
  }

  // 2. Layout Calculation (Simplified for this file)
  let currentY = doc.spacing.lineGap;
  const padding = 8;
  const lineGap = doc.spacing.lineGap;
  const wordGap = doc.spacing.wordGap;
  
  doc.lines.forEach((line, lIdx) => {
    let lineContentWidth = 0;
    line.words.forEach(word => {
      ctx.font = `${word.size}px ${word.font}`;
      word.w = ctx.measureText(word.text).width;
      lineContentWidth += word.w + wordGap;
    });
    lineContentWidth -= wordGap;
    
    // Simple vertical centering for top-level line positioning
    if(lIdx === 0 && doc.style.valign === "middle") {
       currentY = (h / 3); 
    }
    
    let currentX = padding;
    if (doc.style.align === 'center') currentX = (w / 2) - (lineContentWidth / 2);
    else if (doc.style.align === 'right') currentX = w - lineContentWidth - padding;
    
    line.words.forEach((word, wIdx) => {
      word.x = currentX;
      word.y = currentY;
      
      let finalColor = word.color;
      let finalX = word.x;
      let finalY = word.y;
      
      // --- Apply Animation/Color FX ---
      if (word.anims.includes('rainbow')) {
          finalColor = hsvToRgb((t / 3000) % 1, 1, 1);
      }
      if (word.anims.includes('wave')) {
          finalY += Math.sin(t / 500 * Math.PI) * 2; 
      }
      
      // 3. Draw Text
      ctx.font = `${word.size}px ${word.font}`;
      ctx.fillStyle = finalColor;
      ctx.textBaseline = 'top';
      ctx.fillText(word.text, finalX, finalY);

      // 4. Draw Selection
      if (mode === 'edit' && lIdx === selected?.l && wIdx === selected?.w) {
         ctx.strokeStyle = '#a675ff';
         ctx.lineWidth = 1;
         ctx.strokeRect(word.x - 1, word.y - 1, word.w + 2, word.size + 2);
      }
      
      currentX += word.w + wordGap;
    });
    
    // Simple line height approximation
    currentY += (line.words[0]?.size || 24) + lineGap;
  });
}


/* ------------------ UI ------------------ */
function updateUI(){
  undoBtn.disabled=history.length<=1;
  redoBtn.disabled=future.length===0;
  
  const scale=currentZoom/100;
  canvas.style.transform=`scale(${scale})`;
  zoomSlider.value=currentZoom;
  
  $$(".bg-tile",bgGrid).forEach(x=>{
    x.classList.toggle("active", doc.bg.preset === x.dataset.full || doc.bg.type === x.dataset.kind);
  });
  
  // Update GIF play/pause button icon
  if (doc.bg.isAnimatedGif && gifPlayer) {
    bgGifPlayBtn.textContent = gifPlayer.get_playing() ? '⏸️' : '▶️';
  }
}

function fitZoom(){
  const wrapRect=wrap.getBoundingClientRect();
  const scaleW=(wrapRect.width-24)/doc.res.w;
  const scaleH=(wrapRect.height-24)/doc.res.h;
  const fitScale=Math.floor(Math.min(scaleW, scaleH)*100);
  currentZoom=Math.max(50, Math.min(400, fitScale));
  updateUI();
}

/* ------------------ Backgrounds ------------------ */
function visibleSet(){
  const resKey = `${doc.res.w}x${doc.res.h}`;
  return PRESETS[resKey] || [];
}

function showSolidTools(show){ bgSolidTools?.classList.toggle("hidden", !show); }

function showGifTools(show){
  bgGifTools?.classList.toggle("hidden", !show);
  // Update play/pause button state
  if (show && gifPlayer) {
    bgGifPlayBtn.textContent = gifPlayer.get_playing() ? '⏸️' : '▶️';
  }
}


function buildBgGrid(){
  bgGrid.innerHTML="";
  const tiles=[
    ...visibleSet().map(p=>({kind:"preset",thumb:p.thumb,full:p.full})),
    {kind:"solid",thumb:"assets/thumbs/Solid_thumb.png"},
    {kind:"upload",thumb:"assets/thumbs/Upload_thumb.png"}
  ];
  
  tiles.forEach((t,i)=>{
    const b=document.createElement("button");
    b.type="button"; b.className="bg-tile"; b.dataset.kind=t.kind;
    if (t.full) b.dataset.full = t.full;
    const img=document.createElement("img"); img.src=t.thumb; img.alt=t.kind;
    b.appendChild(img);
    
    on(b,"click",async()=>{
      // 1. Clean up existing player (GIF or static) and hide controls
      if(gifPlayer){ gifPlayer.pause(); gifPlayer.remove(); gifPlayer=null; }
      showGifTools(false);
      
      $$(".bg-tile",bgGrid).forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      
      if(t.kind==="preset"){
        const im=new Image(); im.crossOrigin="anonymous"; im.src=t.full;
        im.onload=()=>{ doc.bg={type:"preset",color:null,image:im,preset:t.full, isAnimatedGif:false}; showSolidTools(false); showGifTools(false); render(); };
        im.src=t.full;
        pushState("SET_BG_PRESET");
      }else if(t.kind==="solid"){
        doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null, isAnimatedGif:false};
        showSolidTools(true); showGifTools(false); render();
        pushState("SET_BG_SOLID");
      }else{
        bgUpload.click();
      }
    });
    bgGrid.appendChild(b);
  });
  
  const initialTile = doc.bg.type === 'preset' 
    ? $(`[data-full="${doc.bg.preset}"]`, bgGrid)
    : $(`.bg-tile[data-kind="${doc.bg.type}"]`, bgGrid);
  
  initialTile?.classList.add("active");
}

on(bgUpload,"change",e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f);

  // 1. Clean up existing player and hide controls
  if(gifPlayer){ gifPlayer.pause(); gifPlayer.remove(); gifPlayer=null; }
  showGifTools(false); 

  // 2. Handle Animated GIF
  if (f.type === 'image/gif' && window.SuperGif) {
    const img = document.createElement('img');
    img.src = url;

    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);

    gifPlayer = new window.SuperGif({ 
      gif: img,
      auto_play: false, // We control playback
      max_width: doc.res.w,
      max_height: doc.res.h,
      draw_canvas: false,
      vp_obj: tempContainer
    });

    gifPlayer.load(()=>{
      URL.revokeObjectURL(url);
      tempContainer.remove();

      doc.bg = {
        type:"upload", color:null,
        image: gifPlayer.get_canvas(),
        preset:null, isAnimatedGif:true
      };
      
      // Show GIF controls, start playing, and ensure RAF loop is running
      showGifTools(true);
      gifPlayer.play();
      
      gifPlayer.lastFrameTime = 0;
      showSolidTools(false);
      pushState("UPLOAD_BG_GIF");
      
      if (mode === "edit") startPreview(); 
      else render();
    });

  } else {
    // 3. Handle Static Image (PNG/JPG etc.)
    const im=new Image();
    im.onload=()=>{
      URL.revokeObjectURL(url);
      doc.bg={type:"upload",color:null,image:im,preset:null, isAnimatedGif:false};
      showSolidTools(false);
      pushState("UPLOAD_BG_STATIC");
      render();
    };
    im.src=url;
  }
});


/* ------------------ Initialization ------------------ */
function init() {
  // 1. Load initial preset image if available (only for non-animated)
  const initialPreset = visibleSet()[0];
  if (initialPreset) {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => { doc.bg.image = im; render(); };
      im.src = initialPreset.full;
      doc.bg.preset = initialPreset.full;
  }
  
  // 2. Setup Canvas, Layout, and UI
  initCanvas();
  
  // 3. Wire up general listeners
  on(modeEditBtn, "click", stopPreview);
  on(modePreviewBtn, "click", startPreview);
  on(undoBtn, "click", undo);
  on(redoBtn, "click", redo);
  on(fitBtn, "click", fitZoom);
  on(window, "resize", fitZoom);
  on(zoomSlider, "input", e => { currentZoom = e.target.value; updateUI(); });
  
  on(clearAllBtn, "click", () => {
    doc.lines = [{ words: [{ text: "", color: "#FFFFFF", font: "Orbitron", size: 24, anims: [] }] }];
    selected = { l: 0, w: 0 };
    pushState("CLEAR_CANVAS");
  });

  // 4. Backgrounds
  buildBgGrid();
  on(bgSolidColor, "input", e => { doc.bg.color = e.target.value; doc.bg.type="solid"; render(); pushState("SET_BG_COLOR"); });

  // 5. GIF Background Controls
  on(bgGifPlayBtn, "click", () => {
    if (gifPlayer) {
      if (gifPlayer.get_playing()) {
        gifPlayer.pause();
      } else {
        // Start main RAF loop if needed, then play the GIF
        if (mode === "edit") startPreview();
        gifPlayer.play();
      }
      updateUI(); // Update play/pause icon
    }
  });

  on(bgGifResetBtn, "click", () => {
    if (gifPlayer) {
      gifPlayer.reset();
      // Ensure we are in preview mode and playing after reset
      if (mode === "edit") startPreview();
      gifPlayer.play();
      updateUI(); // Update play/pause icon
    }
  });
  
  // 6. Initial State Update
  updateUI();
  render();
}

// Start the application
on(document, 'DOMContentLoaded', init);
