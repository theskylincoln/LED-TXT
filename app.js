/* =======================================================
 LED Backpack Animator — app.js
 - Seamless durations for animations
 - Conflict warnings
 - Emoji picker wired
 - Click canvas in Preview -> Edit
 - Live updates in Preview
 - GIF backgrounds: redraw each frame (browser animated <img>)
======================================================= */

/* ---------- UI notify (placeholder) ---------- */
function notifyUserError(message) {
  console.error("[UI]", message);
}

/* ---------- helpers ---------- */
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ---------- DOM ---------- */
const canvas  = $("#led"), ctx = canvas.getContext("2d"), wrap = $(".canvas-wrap");
const resSel  = $("#resSelect"), zoomSlider = $("#zoom"), fitBtn  = $("#fitBtn");
const modeEditBtn   = $("#modeEdit"), modePreviewBtn = $("#modePreview");
const bgGrid  = $("#bgGrid"), bgSolidTools = $("#bgSolidTools"),
      bgSolidColor = $("#bgSolidColor"),
      addBgSwatchBtn = $("#addBgSwatchBtn"),
      bgSwatches = $("#bgSwatches"), bgUpload = $("#bgUpload"),
      bgGreyRow = $("#bgGreyRow"), bgColorRow = $("#bgColorRow");
const progressBar = $("#progress"), tCur = $("#tCur"), tEnd = $("#tEnd");
const previewBtn = $("#previewRenderBtn"), gifBtn = $("#gifRenderBtn"), gifPreviewImg = $("#gifPreview");
const undoBtn = $("#undoBtn"), redoBtn = $("#redoBtn"), clearAllBtn = $("#clearAllBtn");
const aboutBtn = $("#aboutBtn"), aboutModal = $("#aboutModal"), aboutClose = $("#aboutClose");

const addWordBtn=$("#addWordBtn"), addLineBtn=$("#addLineBtn"), delWordBtn=$("#deleteWordBtn");
const emojiBtn=$("#emojiBtn"), emojiModal=$("#emojiModal"), emojiClose=$("#emojiClose"),
      emojiTabs=$("#emojiTabs"), emojiGrid=$("#emojiGrid");

const fontSelect=$("#fontSelect"), fontSizeInp=$("#fontSize"),
      autoSizeChk=$("#autoSize"), autoSizePerLine=$("#autoSizePerLine"),
      fontColorInp=$("#fontColor"), addSwatchBtn=$("#addSwatchBtn"), textSwatches=$("#swatches");
const lineGapInp=$("#lineGap"), wordGapInp=$("#wordGap");
const alignBtns=$$("[data-align]"), valignBtns=$$("[data-valign]");
const animList=$("#animList");
const conflictEl=$("#animConflict");
const multiToggle=$("#multiToggle"), manualDragBtn=$("#manualDragToggle");

/* ---------- state ---------- */
let mode="edit", zoom=1, selected=null;
let history = [], future = [];

const defaults = { font:"Orbitron", size:22, color:"#FFFFFF", lineGap:4, wordGap:6, align:"center", valign:"middle" };

/* preset hues per word (evenly spaced) */
const START_HUES = [210, 50, 310, 140, 0, 260, 90, 330];

const doc = {
  res: { w:96, h:128 },
  lines: [
    { words:[{text:"WILL", color:"#55a0ff", font:"Orbitron", size:22}] },
    { words:[{text:"WHEELIE", color:"#ffd95a", font:"Orbitron", size:22}] },
    { words:[{text:"FOR", color:"#ff7bda", font:"Orbitron", size:22}] },
    { words:[{text:"BOOKTOK", color:"#ffffff", font:"Orbitron", size:22}] },
    { words:[{text:"GIRLIES", color:"#ff6a6a", font:"Orbitron", size:22}] },
  ],
  bg: { type:"preset", image:null, preset:"assets/presets/96x128/Preset_A.gif", color:null }, // GIF allowed
  spacing:{ lineGap:4, wordGap:6 },
  style:{ align:"center", valign:"middle" },
  /* global anims used as editor buffer & bulk apply */
  anims:[
    {id:"glow", params:{ intensity:0.6, duration:2 }},
    {id:"wave", params:{ ax:0.4, ay:0.6, cycles:1, duration:4 }},
    {id:"colorcycle", params:{ duration:6, start:"#ff0000" }}
  ],
  multi:new Set()
};

/* ---------- Background presets (thumbs) ---------- */
const PRESETS = {
  "96x128": [
    { id:"A", thumb:"assets/thumbs/Preset_A_thumb.png", full:"assets/presets/96x128/Preset_A.gif" },
    { id:"B", thumb:"assets/thumbs/Preset_B_thumb.png", full:"assets/presets/96x128/Preset_B.png" }
  ],
  "64x64": [
    { id:"C", thumb:"assets/thumbs/Preset_C_thumb.png", full:"assets/presets/64x64/Preset_C.png" },
    { id:"D", thumb:"assets/thumbs/Preset_D_thumb.png", full:"assets/presets/64x64/Preset_D.png" }
  ]
};
function visibleSet(){ return PRESETS[`${doc.res.w}x${doc.res.h}`] || []; }

/* ---------- Multi / Manual-Drag state ---------- */
let manualDrag = { enabled:false, active:false, startX:0, startY:0, targets:[], startOffsets:[] };

/* ---------- Animations model ---------- */
/* added duration to applicable animations (seconds for a full phase) */
const ANIMS = [
  { id:"slide",      name:"Slide In",             params:{direction:"Left",  speed:1} },
  { id:"slideaway",  name:"Slide Away",           params:{direction:"Left",  speed:1} },
  { id:"zoom",       name:"Zoom",                 params:{direction:"In",    speed:1} },
  { id:"scroll",     name:"Scroll / Marquee",     params:{direction:"Left",  speed:1} },
  { id:"pulse",      name:"Pulse / Breathe",      params:{scale:0.03, vy:4, duration:2} },
  { id:"wave",       name:"Wave",                 params:{ax:0.8, ay:1.4, cycles:1.0, duration:4} },
  { id:"jitter",     name:"Jitter",               params:{amp:0.10, freq:2.5, duration:2} },
  { id:"shake",      name:"Shake",                params:{amp:0.20, freq:2, duration:2} },
  { id:"colorcycle", name:"Color Cycle",          params:{duration:6, start:"#ff0000"} },
  { id:"rainbow",    name:"Rainbow Sweep",        params:{duration:6, start:"#ff00ff"} },
  { id:"sweep",      name:"Highlight Sweep",      params:{duration:3, width:0.25} },
  { id:"flicker",    name:"Flicker",              params:{strength:0.5, duration:1.5} },
  { id:"strobe",     name:"Strobe",               params:{rate:3, duration:1} },
  { id:"glow",       name:"Glow Pulse",           params:{intensity:0.6, duration:2} },
  { id:"heartbeat",  name:"Heartbeat",            params:{rate:1.2, duration:1.5} },
  { id:"ripple",     name:"Ripple",               params:{amp:1.0, freq:2.0, duration:3} },
  { id:"typewriter", name:"Typewriter",           params:{rate:1, duration:3} },
  { id:"scramble",   name:"Scramble / Decode",    params:{rate:1, duration:3} },
  { id:"popcorn",    name:"Popcorn",              params:{rate:1, duration:2} },
  { id:"fadeout",    name:"Fade Out",             params:{} },
];

/* ---------- Emoji manifest (categories == folders you created) ---------- */
let EMOJI_DB = null;
async function loadEmojiManifest(){
  if (EMOJI_DB) return EMOJI_DB;
  try{
    const res = await fetch("assets/openmoji/emoji_manifest.json"); // your generated file
    EMOJI_DB = await res.json();
  }catch{
    // fallback to scanning known folders (simple)
    EMOJI_DB = {
      categories:["smileys","people","animals","food","travel","activities","objects","symbols","flags"],
      entries:[]
    };
  }
  return EMOJI_DB;
}

/* =======================================================
   Build UI pieces
======================================================= */

function showSolidTools(show){ bgSolidTools?.classList.toggle("hidden", !show); }

/* build BG grid (thumbs centered both axes) */
function buildBgGrid(){
  bgGrid.innerHTML="";
  const set = visibleSet();
  const tiles = [
    ...set.map(p=>({kind:"preset", thumb:p.thumb, full:p.full})),
    { kind:"solid",  thumb:"assets/thumbs/Solid_thumb.png" },
    { kind:"upload", thumb:"assets/thumbs/Upload_thumb.png" }
  ];
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
        doc.bg={type:"preset",color:null,image:im,preset:t.full};
        showSolidTools(false); render();
      }else if(t.kind==="solid"){
        doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null};
        showSolidTools(true); render();
      }else{
        bgUpload.click();
      }
    });
    bgGrid.appendChild(b);
  });
  // select whichever matches doc.bg
  const first = $(".bg-tile", bgGrid); if (first) first.classList.add("active");
}
on(bgUpload,"change",e=>{
  const f=e.target.files?.[0]; if(!f)return;
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=()=>{URL.revokeObjectURL(url);
    doc.bg={type:"image",color:null,image:im,preset:null};
    showSolidTools(false); render();
  };
  im.src=url; // animated GIFs will animate in the element; we redraw each frame in preview loop
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

/* ---------- pills (one visible) ---------- */
const pillTabs = $$(".pill[data-acc]");
const accFont   = $("#accFont"), accLayout = $("#accLayout"), accAnim = $("#accAnim");
pillTabs.forEach(p=>{
  on(p,"click",()=>{
    const id=p.dataset.acc;
    [accFont,accLayout,accAnim].forEach(x=>x.open=false);
    pillTabs.forEach(x=>x.classList.remove("active"));
    $("#"+id).open = true; p.classList.add("active");
  });
});

/* ---------- swatches ---------- */
const defaultTextPalette = ["#FFFFFF","#FF3B30","#00E25B","#1E5BFF","#FFE45A","#FF65D5","#40F2F2","#000000"];
let customTextPalette = [];
function rebuildTextSwatches(){
  textSwatches.innerHTML="";
  [...defaultTextPalette, ...customTextPalette].forEach(c=>{
    const b=document.createElement("button");
    b.className="swatch"; b.style.background=c; b.title=c;
    b.addEventListener("click",()=>{
      fontColorInp.value = c;
      forEachSelectedWord(w=>{ w.color = c; });
      render();
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

/* ---------- BG swatches (greys + colors + custom) ---------- */
const bgGreys = ["#000000","#0f0f0f","#1a1a1a","#222222","#2b2b2b","#333333","#444444","#555555","#666666","#777777"];
const bgColors = ["#111e3a","#1e2a55","#2c2f8a","#492c8a","#5f2c8a","#8a2c7e","#8a2c4c","#8a2c2c"];
let customBgPalette=[];
function fillRow(el, arr){
  el.innerHTML=""; arr.forEach(c=>{
    const b=document.createElement("button");
    b.className="swatch"; b.style.background=c; b.title=c;
    b.addEventListener("click",()=>{
      doc.bg={type:"solid",color:c,image:null,preset:null};
      showSolidTools(true); render();
    });
    el.appendChild(b);
  });
}
function rebuildBgSwatches(){
  fillRow(bgGreyRow, bgGreys);
  fillRow(bgColorRow, bgColors);
  bgSwatches.innerHTML="";
  customBgPalette.forEach(c=>{
    const b=document.createElement("button");
    b.className="swatch"; b.style.background=c; b.title=c;
    b.addEventListener("click",()=>{ doc.bg={type:"solid",color:c,image:null,preset:null}; render(); });
    bgSwatches.appendChild(b);
  });
}
on(addBgSwatchBtn,"click",()=>{
  const c=bgSolidColor.value;
  if(!bgGreys.includes(c)&&!bgColors.includes(c)&&!customBgPalette.includes(c)) customBgPalette.push(c);
  rebuildBgSwatches();
});
on(bgSolidColor,"input",()=>{ doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null}; render(); });
rebuildBgSwatches();

/* =======================================================
   Text metrics / layout + auto-size
======================================================= */
function measureText(w){
  ctx.font = `${w.size || defaults.size}px ${w.font || defaults.font}`;
  return ctx.measureText(w.text || "").width;
}
function lineHeight(line){ return Math.max(12, ...line.words.map(w => (w.size || defaults.size))); }
function lineWidth(line){
  const gap = doc.spacing.wordGap ?? defaults.wordGap;
  return line.words.reduce((s,w)=> s + measureText(w), 0) + Math.max(0,line.words.length-1)*gap;
}
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
      const gap = doc.spacing.wordGap ?? defaults.wordGap;
      let w= -gap;
      for(const word of line.words){
        ctx.font = `${s}px ${word.font || defaults.font}`;
        w += ctx.measureText(word.text||"").width + gap;
      }
      if (w <= maxW){
        line.words.forEach(word=> word.size = s);
        break;
      }
    }
  });

  // reflect live size
  const wSel = selected ? doc.lines[selected.line].words[selected.word] : doc.lines[0].words[0];
  if (wSel) fontSizeInp.value = Math.round(wSel.size || defaults.size);
}

/* =======================================================
   Animations runtime (with duration loops)
======================================================= */
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
function resolveWordAnims(word){
  const own = word.anims && word.anims.length ? word.anims : null;
  const base = doc.anims || [];
  return own ? own : base;
}
function phaseFrom(t, params){
  if (params?.duration && params.duration>0) return (t % params.duration) / params.duration;
  return null; // meaning "use raw t"
}

function animatedProps(base, word, t, totalDur){
  const props = { x:base.x, y:base.y, scale:1, alpha:1, text:word.text||"", color:word.color, dx:0, dy:0, shadow:null, gradient:null, perChar:null };
  const get = id => resolveWordAnims(word).find(a=>a.id===id);
  const usePhase = (a)=>phaseFrom(t, a?.params);

  // Scroll
  const scroll = get("scroll");
  if (scroll) {
    const dir = (scroll.params.direction || "Left");
    const sp  = Number(scroll.params.speed || 1);
    const v = 20 * sp; // px/s
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

  // Slide in
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

  // Slide away
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

  // Fade out
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
    const ph = usePhase(pulse);
    const s = Number(pulse.params.scale || 0.03);
    const vy = Number(pulse.params.vy || 4);
    const ang = ph!=null ? ph*2*Math.PI : t*2*Math.PI;
    props.scale *= 1 + (Math.sin(ang) * s);
    props.dy    += Math.sin(ang) * vy;
  }

  // Wave
  const wave = get("wave");
  if (wave) {
    const ph = usePhase(wave);
    const ax = Number(wave.params.ax || 0.8);
    const ay = Number(wave.params.ay || 1.4);
    const cyc= Number(wave.params.cycles || 1.0);
    const theta = (ph!=null ? ph : (t/(wave.params.duration||1))) * cyc * 2*Math.PI;
    props.dx += Math.sin(theta + base.x * 0.05) * ax * 4;
    props.dy += Math.sin(theta + base.y * 0.06) * ay * 4;
  }

  // Jitter
  const jit = get("jitter");
  if (jit) {
    const ph = usePhase(jit);
    const a = Number(jit.params.amp || 0.10), f = Number(jit.params.freq || 2.5);
    const time = ph!=null ? ph*3 : t;
    props.dx += Math.sin(time * 2 * Math.PI * f) * a * 3;
    props.dy += Math.cos(time * 2 * Math.PI * f) * a * 3;
  }

  // Shake
  const shake = get("shake");
  if (shake) {
    const ph = usePhase(shake);
    const a = Number(shake.params.amp || 0.20) * 5, f = Number(shake.params.freq || 2);
    const time = ph!=null ? ph*2 : t;
    props.dx += Math.sin(time * 2 * Math.PI * f) * a;
    props.dy += Math.cos(time * 2 * Math.PI * f) * a * 0.6;
  }

  // Typewriter
  const type = get("typewriter");
  if (type && props.text) {
    const ph = usePhase(type);
    const rate = Number(type.params.rate || 1);
    const cps  = 10 * rate;
    const shown = Math.max(0, Math.min(props.text.length, Math.floor((ph!=null ? ph*props.text.length : t * cps))));
    props.text = props.text.slice(0, shown);
  }

  // Scramble
  const scr = get("scramble");
  if (scr && word.text) {
    const rate = Number(scr.params.rate || 1), cps = 10 * rate;
    const goal = word.text || ""; let out = "";
    const tm = (scr.params.duration? ( (t % scr.params.duration) ) : t);
    for (let i = 0; i < goal.length; i++) {
      const revealAt = i / cps;
      if (tm >= revealAt) out += goal[i];
      else {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        const idx = Math.floor((tm * 20 + i * 3) % chars.length);
        out += chars[idx];
      }
    }
    props.text = out;
  }

  // Popcorn
  const pop = get("popcorn");
  if (pop && word.text) {
    const ph = usePhase(pop);
    const rate = Number(pop.params.rate || 1);
    const time = ph!=null ? ph*2 : t;
    const alphaArr = [];
    for (let i = 0; i < (word.text||"").length; i++) {
      const v = Math.sin(2 * Math.PI * rate * time + i * 0.4);
      alphaArr.push(v > 0 ? 1 : 0.25);
    }
    props.perChar ??= {}; props.perChar.alpha = alphaArr;
  }

  // Color cycle
  const cc = get("colorcycle");
  if (cc) {
    const ph = usePhase(cc);
    const base = (cc.params.start || "#ff0000");
    const hueBase = colorToHue(base);
    const hue = Math.floor((hueBase + ( (ph!=null ? ph*360 : t*60) )) % 360);
    props.color = `hsl(${hue}deg 100% 60%)`;
  }

  // Rainbow / sweep (gradient)
  const rainbow = get("rainbow");
  if (rainbow && (props.text||"").length) {
    const ph = usePhase(rainbow);
    const base = (rainbow.params.start || "#ff00ff");
    const hueBase = colorToHue(base);
    props.gradient = { type: "rainbow", phase: (ph!=null?ph:t), base: hueBase };
  }
  const sweep = get("sweep");
  if (sweep && (props.text||"").length) {
    const ph = usePhase(sweep);
    const width = Number(sweep.params.width || 0.25);
    props.gradient = { type: "sweep", phase: (ph!=null?ph:t), width };
  }

  // Flicker
  const flicker = get("flicker");
  if (flicker) {
    const ph = usePhase(flicker);
    const time = ph!=null ? ph*3 : t;
    const str = Math.max(0, Math.min(1, Number(flicker.params.strength || 0.5)));
    const n = (Math.sin(time * 23.7) + Math.sin(time * 17.3)) * 0.25 + 0.5;
    props.alpha *= (1 - str * 0.6) + n * str * 0.6;
  }

  // Strobe
  const strobe = get("strobe");
  if (strobe) {
    const ph = usePhase(strobe);
    const rate = Number(strobe.params.rate || 3);
    const time = ph!=null ? ph*2 : t;
    const phase = Math.sin(2 * Math.PI * rate * time);
    props.alpha *= (phase > 0) ? 1 : 0.15;
  }

  // Glow
  const glow = get("glow");
  if (glow) {
    const ph = usePhase(glow);
    const intensity = Math.max(0, Number(glow.params.intensity || 0.6));
    const time = ph!=null ? ph*2 : t;
    const k = (Math.sin(time * 2 * Math.PI * 1.2) * 0.5 + 0.5) * intensity;
    props.shadow = { blur: 6 + k * 10, color: props.color || word.color };
  }

  // Ripple
  const ripple = get("ripple");
  if (ripple && word.text) {
    const ph = usePhase(ripple);
    const amp = Number(ripple.params.amp || 1.0) * 2.0;
    const freq= Number(ripple.params.freq || 2.0);
    const time = ph!=null ? ph*2 : t;
    const arr = [];
    for (let i = 0; i < (word.text||"").length; i++) arr.push(Math.sin(2 * Math.PI * freq * time + i * 0.6) * amp);
    props.perChar ??= {}; props.perChar.dy = arr;
  }

  return props;
}

/* =======================================================
   Render
======================================================= */
function render(t=0, totalDur=getDuration()){
  const W = canvas.width  = doc.res.w;
  const H = canvas.height = doc.res.h;

  // BG
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = (doc.bg?.type==="solid" ? (doc.bg.color||"#000") : "#000");
  ctx.fillRect(0,0,W,H);
  if (doc.bg?.image) { try { ctx.drawImage(doc.bg.image,0,0,W,H); } catch {} }
  else if (doc.bg?.preset && doc.bg.type==="preset") {
    const im = new Image(); im.crossOrigin="anonymous"; im.src = doc.bg.preset;
    im.onload = ()=>{ doc.bg.image = im; render(t,totalDur); };
  }

  // text
  autoSizeAllIfOn();

  const lineGap = doc.spacing.lineGap ?? defaults.lineGap;
  const wordGap = doc.spacing.wordGap ?? defaults.wordGap;

  const heights = doc.lines.map(lineHeight);
  const contentH = heights.reduce((s,h)=>s+h,0) + (doc.lines.length-1)*lineGap;

  let y;
  const valign = (doc.style?.valign||defaults.valign);
  if (valign === "top") y = 4;
  else if (valign === "bottom") y = H - contentH - 4;
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
      // Give every word its own starting hue for colorcycle if not set
      if (!w.anims) w.anims = [];
      const hasPerWordCC = w.anims.find(a=>a.id==="colorcycle");
      if (!hasPerWordCC) {
        const hue = START_HUES[(li*8+wi) % START_HUES.length];
        w.anims.push({ id:"colorcycle", params:{ duration:6, start:`hsl(${hue}deg 100% 60%)` }});
      }
      // Booktok: add rainbow too (on top of base)
      if ((w.text||"").toUpperCase()==="BOOKTOK" && !w.anims.find(a=>a.id==="rainbow")){
        w.anims.push({ id:"rainbow", params:{ duration:6, start:"#ff00ff" }});
      }
      // All words also get Glow + Wave if missing (your request to match)
      if (!w.anims.find(a=>a.id==="glow")) w.anims.push({ id:"glow", params:{ intensity:0.6, duration:2 }});
      if (!w.anims.find(a=>a.id==="wave")) w.anims.push({ id:"wave", params:{ ax:0.4, ay:0.6, cycles:1, duration:4 }});

      const base = { x, y: y + lh*0.85 };
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

      // manual offsets
      const fx = Number(w.fx || 0), fy = Number(w.fy || 0);
      const drawX = base.x + (props.dx||0) + fx;
      const drawY = base.y + (props.dy||0) + fy;

      // gradient fill
      let fillStyle = props.color || (w.color || defaults.color);
      if (props.gradient && txt.length) {
        const wordWidth = Math.ceil(ctx.measureText(txt).width);
        if (props.gradient.type === "rainbow") {
          const g = ctx.createLinearGradient(drawX, drawY, drawX + wordWidth, drawY);
          const baseHue = (props.gradient.base + (props.gradient.phase * 360)) % 360;
          for (let i=0;i<=6;i++){ const stop=i/6; const hue=Math.floor((baseHue+stop*360)%360); g.addColorStop(stop, `hsl(${hue}deg 100% 60%)`); }
          fillStyle = g;
        } else if (props.gradient.type === "sweep") {
          const band = Math.max(0.05, Math.min(0.8, props.gradient.width || 0.25));
          const pos  = props.gradient.phase % 1;
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

      // selection boxes
      const thisKey = `${li}:${wi}`;
      if (doc.multi.has(thisKey)) {
        const ww = ctx.measureText(w.text||"").width;
        ctx.save();
        ctx.strokeStyle = "rgba(0,255,255,0.95)";
        ctx.lineWidth = 1; ctx.setLineDash([3,2]);
        ctx.strokeRect(drawX-2, (drawY)-lh, ww+4, lh+4);
        ctx.restore();
      } else if (selected && selected.line===li && selected.word===wi && mode==="edit") {
        const ww = ctx.measureText(w.text||"").width;
        ctx.save();
        ctx.strokeStyle = "rgba(255,0,255,0.95)";
        ctx.lineWidth = 1; ctx.setLineDash([3,2]);
        ctx.strokeRect(drawX-2, (drawY)-lh, ww+4, lh+4);
        ctx.restore();
      }

      x += measureText(w) + wordGap;
      ctx.restore();
    });

    y += lh + lineGap;
  });
}

/* =======================================================
   Selection / input
======================================================= */
function keyOf(li, wi){ return `${li}:${wi}`; }
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
function hitTestWord(px, py){
  const lineGap = doc.spacing.lineGap ?? defaults.lineGap;
  const heights = doc.lines.map(lineHeight);
  const contentH = heights.reduce((s,h)=>s+h,0) + (doc.lines.length-1)*lineGap;

  let y;
  const valign = (doc.style?.valign || defaults.valign);
  if (valign==="top") y=4; else if (valign==="bottom") y=doc.res.h-contentH-4; else y=(doc.res.h-contentH)/2;

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
      const fx = Number(w.fx || 0), fy = Number(w.fy || 0);
      const bx = x-2 + fx, by = (y+lh*0.85)-lh + fy, bw = ww+4, bh = lh+4;
      if (px>=bx && px<=bx+bw && py>=by && py<=by+bh) return { line:li, word:wi };
      x += ww + (doc.spacing.wordGap ?? defaults.wordGap);
    }
    y += lh + lineGap;
  }
  return null;
}

/* Click to select (Shift adds). If in Preview, click canvas -> Edit */
canvas.addEventListener("click",(e)=>{
  if (mode==="preview"){ setMode("edit"); return; }
  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)/zoom, py=(e.clientY-rect.top)/zoom;
  const hit = hitTestWord(px, py);

  if (hit) {
    const k = keyOf(hit.line, hit.word);
    if (e.shiftKey) {
      if (doc.multi.has(k)) doc.multi.delete(k);
      else doc.multi.add(k);
      selected = hit;
    } else {
      doc.multi.clear(); selected = hit;
    }
    buildAnimationsUI();              // refresh params for new selection
    render();
  }
});

/* Typing */
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
    autoSizeAllIfOn(); render();
  } else if (e.key==="Backspace"){
    e.preventDefault();
    targets.forEach(([li,wi])=>{
      const w = doc.lines[li]?.words[wi]; if(!w) return;
      w.text = (w.text || "").slice(0,-1);
    });
    autoSizeAllIfOn(); render();
  }
});

/* Add/line/delete */
addWordBtn?.addEventListener("click",()=>{
  const li = selected ? selected.line : (doc.lines.length-1);
  const line = doc.lines[li] || (doc.lines[li]={words:[]});
  line.words.push({ text:"NEW", color:defaults.color, font:defaults.font, size:defaults.size });
  selected = { line: li, word: line.words.length-1 };
  render();
});
addLineBtn?.addEventListener("click",()=>{
  doc.lines.push({ words:[{ text:"LINE", color:defaults.color, font:defaults.font, size:defaults.size }] });
  selected = { line: doc.lines.length-1, word: 0 };
  render();
});
delWordBtn?.addEventListener("click",()=>{
  if (!selected) return;
  const line = doc.lines[selected.line];
  line.words.splice(selected.word,1);
  if (!line.words.length) doc.lines.splice(selected.line,1);
  doc.multi.clear(); selected = null;
  render();
});

/* Font / size / color inputs */
fontSelect?.addEventListener("change",()=>{ forEachSelectedWord(w=>{ w.font = fontSelect.value || defaults.font; }); autoSizeAllIfOn(); render(); });
fontSizeInp?.addEventListener("input",()=>{ const v = Math.max(6, Math.min(64, parseInt(fontSizeInp.value||`${defaults.size}`,10))); forEachSelectedWord(w=>{ w.size = v; }); render(); });
autoSizeChk?.addEventListener("change",()=>{ autoSizeAllIfOn(); render(); });
fontColorInp?.addEventListener("input",()=>{ const c = fontColorInp.value || defaults.color; forEachSelectedWord(w=>{ w.color = c; }); render(); });

/* Spacing & alignment */
lineGapInp?.addEventListener("input",()=>{ doc.spacing.lineGap = Math.max(0, Math.min(40, parseInt(lineGapInp.value||"4",10))); autoSizeAllIfOn(); render(); });
wordGapInp?.addEventListener("input",()=>{ doc.spacing.wordGap = Math.max(0, Math.min(40, parseInt(wordGapInp.value||"6",10))); autoSizeAllIfOn(); render(); });
alignBtns.forEach(b=> b.addEventListener("click",()=>{
  if (manualDrag.enabled) return;
  alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active");
  doc.style ??= {}; doc.style.align = b.dataset.align || "center"; render();
}));
valignBtns.forEach(b=> b.addEventListener("click",()=>{
  if (manualDrag.enabled) return;
  valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active");
  doc.style ??= {}; doc.style.valign = b.dataset.valign || "middle"; render();
}));

/* Multi toggle visual */
multiToggle?.addEventListener("click", ()=>{ multiToggle.classList.toggle("active"); });

/* Manual drag sticky */
manualDragBtn?.addEventListener("click", () => {
  manualDrag.enabled = !manualDrag.enabled;
  manualDragBtn.classList.toggle("active", manualDrag.enabled);
  document.querySelector(".stage .canvas-wrap")?.classList.toggle("drag-ready", manualDrag.enabled);
  // Disable alignment buttons when manual drag is enabled
  document.querySelectorAll("[data-align],[data-valign]").forEach(b => {
    b.disabled = manualDrag.enabled;
    b.classList.toggle("disabled", manualDrag.enabled);
  });
});

/* Cmd/Ctrl = temporary drag */
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) / zoom;
  const py = (e.clientY - rect.top) / zoom;

  let willDrag = manualDrag.enabled || e.ctrlKey || e.metaKey;
  if (!willDrag) return;

  const pick = hitTestWord(px, py);
  if (!selected && !doc.multi.size && pick) selected = {line:pick.line, word:pick.word};

  const targets = doc.multi.size
    ? Array.from(doc.multi).map(k => k.split(":").map(Number))
    : (selected ? [[selected.line, selected.word]] : []);
  if (!targets.length) return;

  manualDrag.active = true;
  manualDrag.startX = e.clientX;
  manualDrag.startY = e.clientY;
  manualDrag.targets = targets;
  manualDrag.startOffsets = targets.map(([li, wi]) => {
    const w = doc.lines[li]?.words[wi];
    return { fx: Number(w?.fx || 0), fy: Number(w?.fy || 0) };
  });

  canvas.setPointerCapture(e.pointerId);
  document.body.classList.add("dragging");
  e.preventDefault();
});
window.addEventListener("pointermove", (e) => {
  if (!manualDrag.active) return;
  const dx = (e.clientX - manualDrag.startX) / zoom;
  const dy = (e.clientY - manualDrag.startY) / zoom;
  manualDrag.targets.forEach(([li, wi], i) => {
    const w = doc.lines[li]?.words[wi]; if (!w) return;
    const start = manualDrag.startOffsets[i];
    w.fx = (start.fx + dx);
    w.fy = (start.fy + dy);
  });
  render(mode === "preview" ? ((performance.now() - startT) / 1000) % getDuration() : 0);
});
window.addEventListener("pointerup", (e) => {
  if (!manualDrag.active) return;
  manualDrag.active = false; manualDrag.targets = []; manualDrag.startOffsets = [];
  document.body.classList.remove("dragging");
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
});

/* ---------- Animations UI + conflicts ---------- */
function cloneAnims(src){ return src.map(a=>({ id:a.id, params:{...a.params} })); }

function checkConflicts(animArr){
  // crude rules: slide vs scroll in same axis; zoom in & out; multiple slide directions
  const ids = new Set(animArr.map(a=>a.id));
  let conflict = false;

  const slide = animArr.find(a=>a.id==="slide");
  const scroll = animArr.find(a=>a.id==="scroll");
  if (slide && scroll){
    const s = (slide.params.direction||"Left");
    const c = (scroll.params.direction||"Left");
    if ((s==="Left"||s==="Right") && (c==="Left"||c==="Right")) conflict = true;
    if ((s==="Up"||s==="Down")   && (c==="Up"||c==="Down")) conflict = true;
  }
  const zooms = animArr.filter(a=>a.id==="zoom");
  if (zooms.length>1){
    const dirs = new Set(zooms.map(z=>z.params.direction));
    if (dirs.has("In") && dirs.has("Out")) conflict = true;
  }

  conflictEl.classList.toggle("hidden", !conflict);
}

function buildAnimationsUI(){
  animList.innerHTML = "";
  doc.anims = doc.anims || [];
  checkConflicts(doc.anims);

  ANIMS.forEach(def=>{
    const row = document.createElement("div"); row.className="anim-row";
    const left = document.createElement("div"); left.className="anim-left";
    const chk = document.createElement("input"); chk.type="checkbox"; chk.id = `anim_${def.id}`;
    chk.checked = !!doc.anims.find(a=>a.id===def.id);
    const lbl = document.createElement("label"); lbl.setAttribute("for", chk.id); lbl.textContent = def.name;
    const gear = document.createElement("button"); gear.type="button"; gear.className="button tiny"; gear.textContent="⚙";

    left.appendChild(chk); left.appendChild(lbl); left.appendChild(gear);
    const params = document.createElement("div"); params.className="anim-params";
    params.style.display = chk.checked ? "block" : "none";

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
        checkConflicts(doc.anims);
        if (mode === "preview") startPreview(); else render();
      });
      p.appendChild(la); p.appendChild(inp); params.appendChild(p);
    });

    chk.addEventListener("change",()=>{
      const has = !!doc.anims.find(a=>a.id===def.id);
      if (chk.checked && !has){ doc.anims.push({ id:def.id, params:{...def.params} }); params.style.display = "block"; }
      else if (!chk.checked && has){ doc.anims = doc.anims.filter(a=>a.id!==def.id); params.style.display = "none"; }
      checkConflicts(doc.anims);
      if (mode === "preview") startPreview(); else render();
    });
    gear.addEventListener("click",()=> params.style.display = params.style.display==="none" ? "block" : "none");

    row.appendChild(left); row.appendChild(params); animList.appendChild(row);
  });

  // Bulk apply
  $("#applySelectedAnimBtn")?.addEventListener("click", ()=>{
    const pack = cloneAnims(doc.anims);
    if (doc.multi.size){
      doc.multi.forEach(k=>{
        const [li,wi]=k.split(":").map(Number);
        const w = doc.lines[li]?.words[wi]; if (w) w.anims = cloneAnims(pack);
      });
    } else if (selected){
      const w = doc.lines[selected.line]?.words[selected.word];
      if (w) w.anims = cloneAnims(pack);
    }
    render();
  });
  $("#applyAllAnimBtn")?.addEventListener("click", ()=>{
    const pack = cloneAnims(doc.anims);
    doc.lines.forEach(line=> line.words.forEach(w=> w.anims = cloneAnims(pack)));
    render();
  });
}
buildAnimationsUI();

/* =======================================================
   Preview loop + GIF
======================================================= */
function getFPS(){ const v = parseInt($("#fps")?.value || "15",10); return Math.max(1,Math.min(30,v||15)); }
function getDuration(){ const v=parseInt($("#seconds")?.value || "8",10); return Math.max(1,Math.min(60,v||8)); }

let rafId=null, startT=0;
function startPreview(){
  stopPreview(); startT = performance.now();
  const dur = getDuration(); tEnd && (tEnd.textContent = `${dur.toFixed(1)}s`);

  function loop(now){
    const secs = (now - startT) / 1000; const tt = secs % dur;
    render(tt, dur);
    if (progressBar) progressBar.style.setProperty("--p", (tt / dur));
    if (tCur) tCur.textContent = `${tt.toFixed(1)}s`;
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}
function stopPreview(){ if (rafId) cancelAnimationFrame(rafId); rafId=null; render(0, getDuration()); }
function setMode(m){
  mode = m;
  modeEditBtn?.classList.toggle("active", m==="edit");
  modePreviewBtn?.classList.toggle("active", m==="preview");
  if (m==="preview") startPreview(); else stopPreview();
}
modeEditBtn?.addEventListener("click",()=>setMode("edit"));
modePreviewBtn?.addEventListener("click",()=>setMode("preview"));

/* About modal */
aboutBtn?.addEventListener("click",()=> aboutModal?.classList.remove("hidden"));
aboutClose?.addEventListener("click",()=> aboutModal?.classList.add("hidden"));

/* GIF render (preview image under buttons; download opens in new tab) */
function loadScriptLocal(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.async=true; s.onload=()=>res(true); s.onerror=rej; document.head.appendChild(s); }); }
async function ensureLocalGifLibs(){
  if (typeof GIFEncoder !== "undefined") return true;
  try{
    await loadScriptLocal("./assets/libs/jsgif/NeuQuant.js");
    await loadScriptLocal("./assets/libs/jsgif/LZWEncoder.js");
    await loadScriptLocal("./assets/libs/jsgif/GIFEncoder.js");
  }catch(e){ notifyUserError("GIF encoder library files not found."); return false; }
  return typeof GIFEncoder !== "undefined";
}
function encoderToBlob(enc){ const bytes = enc.stream().bin || enc.stream().getData(); const u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes); return new Blob([u8], { type: "image/gif" }); }

async function renderGifDownload(){
  const ok = await ensureLocalGifLibs(); if (!ok) return;

  const fps = getFPS(), secs = getDuration();
  const frames = Math.max(1, Math.floor(fps * secs));
  const delay = Math.max(1, Math.round(1000 / fps));

  const W = canvas.width = doc.res.w, H = canvas.height = doc.res.h;
  const resume = (mode === "preview"); stopPreview();

  try{
    const enc = new GIFEncoder(); enc.setRepeat(0); enc.setDelay(delay); enc.setQuality(10); enc.setSize(W, H); enc.start();
    for (let i = 0; i < frames; i++) { const t = i / fps; render(t, secs); enc.addFrame(ctx); if (progressBar) progressBar.style.setProperty("--p", (t / secs) % 1); if (tCur) tCur.textContent = `${(t % secs).toFixed(1)}s`; }
    enc.finish();
    const blob = encoderToBlob(enc); const url = URL.createObjectURL(blob);

    // Show preview image (long-press to save on iPhone)
    if (gifPreviewImg){ gifPreviewImg.classList.remove("hidden"); gifPreviewImg.src=url; gifPreviewImg.alt="Animated GIF preview"; }

    // Open in a new tab AND download
    window.open(url, "_blank");
    const a=document.createElement("a"); a.href=url; a.download=`${($("#fileName")?.value||"animation").replace(/\.(png|jpe?g|webp|gif)$/i,"")}.gif`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(err){ console.error(err); notifyUserError("GIF render failed."); }
  finally{ if(resume) startPreview(); }
}
previewBtn?.addEventListener("click", ()=> { setMode("preview"); /* also makes preview visible */ });
gifBtn?.addEventListener("click", ()=> renderGifDownload());
[$("#fps"), $("#seconds")].forEach(inp => inp && inp.addEventListener("input", () => { if (mode === "preview") startPreview(); tEnd && (tEnd.textContent = `${getDuration().toFixed(1)}s`); }));

/* ---------- Resolution change ---------- */
on(resSel,"change",()=>{
  const [w,h]=resSel.value.split("x").map(Number);
  doc.res={w,h}; buildBgGrid(); showSolidTools(doc.bg?.type==="solid"); render(); fitZoom();
});

/* ---------- Undo/Redo/Clear ---------- */
function snapshot(){ return JSON.parse(JSON.stringify(doc)); }
function pushHistory(){ history.push(snapshot()); future.length=0; }
undoBtn?.addEventListener("click",()=>{ if (!history.length) return; future.push(snapshot()); const last=history.pop(); Object.assign(doc,last); render(); });
redoBtn?.addEventListener("click",()=>{ if (!future.length) return; history.push(snapshot()); const next=future.pop(); Object.assign(doc,next); render(); });
clearAllBtn?.addEventListener("click",()=>{ pushHistory(); doc.lines=[{words:[{text:"NEW",font:defaults.font,size:defaults.size,color:defaults.color}]}]; render(); });

/* ---------- Config in/out ---------- */
$("#saveJsonBtn")?.addEventListener("click",()=>{
  const data = snapshot();
  if (data.bg?.image && data.bg.type==="image"){
    try{
      const tmp=document.createElement("canvas"); tmp.width=doc.res.w; tmp.height=doc.res.h;
      const tctx=tmp.getContext("2d"); tctx.drawImage(doc.bg.image,0,0,tmp.width,tmp.height);
      data.bg.dataURL = tmp.toDataURL("image/png");
    }catch{}
  }
  const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.target="_blank";
  a.download="led_anim_config.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
});
$("#loadJsonInput")?.addEventListener("change",async(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const txt=await f.text(); const obj=JSON.parse(txt);
    Object.assign(doc,obj);
    if (obj.bg?.dataURL){ const im=new Image(); im.src=obj.bg.dataURL; im.onload=()=>{ doc.bg.image=im; render(); }; }
    buildBgGrid(); render(); fitZoom();
  }catch(err){ notifyUserError("Invalid config file."); }
});

/* =======================================================
   Emoji picker
======================================================= */
function buildEmojiTabs(db){
  emojiTabs.innerHTML="";
  const cats = db.categories || [];
  cats.forEach((c,idx)=>{
    const btn = document.createElement("button");
    btn.className = "pill" + (idx===0 ? " active":"");
    btn.textContent = c;
    btn.addEventListener("click",()=>{
      $$(".emoji-tabs .pill").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      buildEmojiGrid(db, c);
    });
    emojiTabs.appendChild(btn);
  });
}
function buildEmojiGrid(db, cat){
  emojiGrid.innerHTML = "";
  const entries = (db.entries||[]).filter(e=> !cat || e.category===cat);
  entries.forEach(e=>{
    const cell = document.createElement("button");
    cell.type="button"; cell.className="emoji-cell";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = e.png || e.svg || e.path; // your manifest should provide one of these
    img.alt = e.name || "emoji";
    cell.appendChild(img);
    cell.addEventListener("click",()=>{
      // Add as a "word" that will be drawn as an image (rasterize SVGs at load time)
      addEmojiWord(img.src);
      emojiModal.classList.add("hidden");
    });
    emojiGrid.appendChild(cell);
  });
}
function addEmojiWord(src){
  const li = selected ? selected.line : (doc.lines.length-1);
  const line = doc.lines[li] || (doc.lines[li]={words:[]});
  line.words.push({ text:"", emoji:true, imgSrc:src, size:24, font:defaults.font, color:"#fff" });
  selected = { line: li, word: line.words.length-1 };
  // Preload image
  const im = new Image(); im.crossOrigin="anonymous"; im.src=src; im.onload=()=>{ line.words[selected.word].imgObj = im; render(); };
  render();
}
emojiBtn?.addEventListener("click", async ()=>{
  const db = await loadEmojiManifest();
  buildEmojiTabs(db);
  buildEmojiGrid(db, db.categories?.[0]);
  emojiModal.classList.remove("hidden");
});
emojiClose?.addEventListener("click", ()=> emojiModal.classList.add("hidden"));
emojiModal?.addEventListener("click",(e)=>{ if (e.target.classList.contains("modal-backdrop")) emojiModal.classList.add("hidden"); });

/* ---------- Init ---------- */
function init(){
  buildBgGrid();
  render();
  fitZoom();

  // defaults
  autoSizeChk.checked = true;
  autoSizeAllIfOn();

  // ⬇️ Start in Preview mode by default
  setMode("preview");
}
init();
