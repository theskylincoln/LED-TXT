/* =======================================================
 LED Backpack Animator — app.js (Part 1 of 3)
 Boot / DOM / state / backgrounds (PNG+GIF) / zoom & pills
 Autosize (live) / conflict warnings / emoji picker shell
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

const bgGrid  = $("#bgGrid"),
      bgSolidTools = $("#bgSolidTools"),
      bgSolidColor = $("#bgSolidColor"),
      addBgSwatchBtn = $("#addBgSwatchBtn"),
      bgSwatches = $("#bgSwatches"),
      bgUpload   = $("#bgUpload");

const progressFill = $("#progress"),
      tCur = $("#tCur"),
      tEnd = $("#tEnd");

const previewBtn    = $("#previewRenderBtn"),
      gifBtn        = $("#gifRenderBtn"),
      gifPreviewImg = $("#gifPreview");

const undoBtn = $("#undoBtn"),
      redoBtn = $("#redoBtn"),
      clearAllBtn = $("#clearAllBtn");

const aboutBtn  = $("#aboutBtn"),
      aboutModal= $("#aboutModal"),
      aboutClose= $("#aboutClose");

const addWordBtn=$("#addWordBtn"),
      addLineBtn=$("#addLineBtn"),
      delWordBtn=$("#deleteWordBtn");

const emojiBtn   = $("#emojiBtn"),
      emojiModal = $("#emojiModal"),
      emojiClose = $("#emojiClose"),
      emojiTabs  = $("#emojiTabs"),
      emojiGrid  = $("#emojiGrid"),
      emojiPager = $("#emojiPager");

const fontSelect=$("#fontSelect"),
      fontSizeInp=$("#fontSize"),
      autoSizeChk=$("#autoSize"),
      fontColorInp=$("#fontColor"),
      addSwatchBtn=$("#addSwatchBtn"),
      textSwatches=$("#swatches");

const lineGapInp=$("#lineGap"),
      wordGapInp=$("#wordGap");

const alignBtns=$$("[data-align]"),
      valignBtns=$$("[data-valign]");

const animList=$("#animList");

const multiToggle=$("#multiToggle"),
      manualDragBtn=$("#manualDragToggle");

/* ---------- state ---------- */
let mode="edit", zoom=1, selected=null;
let history = [], future = [];

const defaults = { font:"Orbitron", size:22, color:"#FFFFFF", lineGap:4, wordGap:6, align:"center", valign:"middle" };

/* Words preset: “WILL WHEELIE FOR BOOKTOK GIRLIES” — each word has its own color-cycle starting hue.
   BOOKTOK also has rainbow + glow. All words get wave to “move everything”. */
const seedHues = [210, 50, 310, 0, 20]; // starting hues (blue, yellow, magenta-ish, red, orange)
function hslHex(h, s=100, l=60){ return `hsl(${h}deg ${s}% ${l}%)`; }

const doc = {
  res: { w:96, h:128 },
  lines: [
    { words:[{text:"WILL",     font:"Orbitron", size:22, color:hslHex(seedHues[0]), anims:[{id:"colorcycle",params:{speed:0.6,start:"#407BFF"}},{id:"wave",params:{ax:0.6,ay:1.0,cycles:1}}]}] },
    { words:[{text:"WHEELIE",  font:"Orbitron", size:22, color:hslHex(seedHues[1]), anims:[{id:"colorcycle",params:{speed:0.6,start:"#FFD54A"}},{id:"wave",params:{ax:0.6,ay:1.0,cycles:1}}]}] },
    { words:[{text:"FOR",      font:"Orbitron", size:22, color:hslHex(seedHues[2]), anims:[{id:"colorcycle",params:{speed:0.6,start:"#FF69CF"}},{id:"wave",params:{ax:0.6,ay:1.0,cycles:1}}]}] },
    { words:[{text:"BOOKTOK",  font:"Orbitron", size:22, color:"#ffffff",
              anims:[
                {id:"rainbow",params:{speed:0.55,start:"#ff00ff"}},
                {id:"glow",params:{intensity:0.65}},
                {id:"wave",params:{ax:0.6,ay:1.0,cycles:1}}
              ]}] },
    { words:[{text:"GIRLIES",  font:"Orbitron", size:22, color:hslHex(seedHues[3]), anims:[{id:"colorcycle",params:{speed:0.6,start:"#FF6464"}},{id:"wave",params:{ax:0.6,ay:1.0,cycles:1}}]}] },
  ],
  // BG default = Preset_A (PNG) — supports GIFs if user uploads or preset GIF provided
  bg: { type:"preset", image:null, preset:"assets/presets/96x128/Preset_A.png", color:null, isGif:false },
  spacing:{ lineGap:4, wordGap:6 },
  style:{ align:"center", valign:"middle" },
  // global animations “buffer” (used by the UI’s Apply buttons)
  anims:[ {id:"glow",params:{intensity:0.6}}, {id:"zoom",params:{direction:"In",speed:1,duration:1.0}}, {id:"wave",params:{ax:0.4,ay:0.6,cycles:1}} ],
  multi:new Set()
};

/* ---------- Background presets ---------- */
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

/* ---------- Multi / Manual-Drag state ---------- */
let manualDrag = { enabled:false, active:false, startX:0, startY:0, targets:[], startOffsets:[] };

/* ---------- Animations model + conflicts ---------- */
const ANIMS = [
  { id:"slide",      name:"Slide In",             params:{direction:"Left",  speed:1} },
  { id:"slideaway",  name:"Slide Away",           params:{direction:"Left",  speed:1} },
  { id:"zoom",       name:"Zoom",                 params:{direction:"In", speed:1, duration:1.0} }, // duration affects easing length
  { id:"scroll",     name:"Scroll / Marquee",     params:{direction:"Left",  speed:1} },
  { id:"pulse",      name:"Pulse / Breathe",      params:{scale:0.03, vy:4} },
  { id:"wave",       name:"Wave",                 params:{ax:0.8, ay:1.4, cycles:1.0} },
  { id:"jitter",     name:"Jitter",               params:{amp:0.10, freq:2.5} },
  { id:"shake",      name:"Shake",                params:{amp:0.20, freq:2} },
  { id:"colorcycle", name:"Color Cycle",          params:{speed:0.6, start:"#ff0000"} },
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
// All pairs in this list will trigger a visible warning if they’re both active
const CONFLICTS = [
  ["typewriter","scramble"], ["typewriter","popcorn"], ["typewriter","scroll"],
  ["strobe","flicker"], ["rainbow","colorcycle"], ["slide","scroll"], ["zoom","scroll"]
];
function listConflicts(activeIds){
  const hits=[];
  for(const [a,b] of CONFLICTS){
    if(activeIds.includes(a) && activeIds.includes(b)) hits.push([a,b]);
  }
  return hits;
}

/* =======================================================
   Build UI pieces — background grid (centered PNGs)
======================================================= */
function showSolidTools(show){ bgSolidTools?.classList.toggle("hidden", !show); }

function buildBgGrid(){
  if(!bgGrid) return;
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
        const isGif = /\.gif(\?|$)/i.test(t.full);
        try{await im.decode();}catch{}
        doc.bg={type:"preset",color:null,image:im,preset:t.full,isGif};
        showSolidTools(false); render();
      }else if(t.kind==="solid"){
        doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null,isGif:false};
        showSolidTools(true); render();
      }else{
        bgUpload.click();
      }
    });
    bgGrid.appendChild(b);
  });
  // Select current preset if applicable
  const firstPreset = $(".bg-tile[data-kind='preset']", bgGrid);
  if(firstPreset) firstPreset.classList.add("active");
}
on(bgUpload,"change",e=>{
  const f=e.target.files?.[0]; if(!f)return;
  const url=URL.createObjectURL(f);
  const im=new Image();
  const isGif = /\.gif(\?|$)/i.test(f.name||"");
  im.onload=()=>{URL.revokeObjectURL(url);
    doc.bg={type:"image",color:null,image:im,preset:null,isGif};
    showSolidTools(false); render();
  };
  im.src=url;
});

/* ---------- zoom / fit ---------- */
function setZoom(z){
  zoom=z; if(zoomSlider) zoomSlider.value=String(z.toFixed(2));
  if (canvas) canvas.style.transform=`translate(-50%,-50%) scale(${z})`;
}
function fitZoom(){
  if(!wrap) return;
  const pad=18, r=wrap.getBoundingClientRect();
  const availW=Math.max(40,r.width-pad*2);
  const availH=Math.max(40,r.height-pad*2);
  const s=Math.max(0.1,Math.min(availW/doc.res.w,availH/doc.res.h));
  setZoom(s);
}
on(zoomSlider,"input",e=>setZoom(parseFloat(e.target.value)));
on(fitBtn,"click",fitZoom);
window.addEventListener("resize",fitZoom);

/* ---------- pills behavior (only active section is visible) ---------- */
const pillTabs = $$(".pill[data-acc]");
const accFont   = $("#accFont"), accLayout = $("#accLayout"), accAnim = $("#accAnim");
function showOnly(id){
  [accFont,accLayout,accAnim].forEach(x=> x && (x.open=false));
  pillTabs.forEach(x=>x.classList.remove("active"));
  const target = $("#"+id); const pill = $(`.pill[data-acc="${id}"]`);
  if(target){ target.open=true; }
  if(pill){ pill.classList.add("active"); }
}
pillTabs.forEach(p=>{
  on(p,"click",()=> showOnly(p.dataset.acc));
});

/* ---------- Swatches (text + background) ---------- */
const defaultTextPalette = ["#FFFFFF","#FF3B30","#00E25B","#1E5BFF","#FFE45A","#FF65D5","#40F2F2","#000000"];
let customTextPalette = [];
function rebuildTextSwatches(){
  if(!textSwatches) return;
  textSwatches.innerHTML="";
  [...defaultTextPalette, ...customTextPalette].forEach(c=>{
    const b=document.createElement("button");
    b.className="swatch"; b.style.background=c; b.title=c;
    b.addEventListener("click",()=>{
      if (fontColorInp) fontColorInp.value = c;
      forEachSelectedWord(w=>{ w.color = c; });
      requestPreviewSafeRender();
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

const defaultBgPalette=["#000000","#101010","#1a1a1a","#222222","#333333","#444444","#555555","#666666"];
let customBgPalette=[];
function rebuildBgSwatches(){
  if(!bgSwatches) return;
  bgSwatches.innerHTML="";
  [...defaultBgPalette,...customBgPalette].forEach(c=>{
    const b=document.createElement("button");
    b.className="swatch"; b.style.background=c; b.title=c;
    b.addEventListener("click",()=>{
      doc.bg={type:"solid",color:c,image:null,preset:null,isGif:false};
      showSolidTools(true); requestPreviewSafeRender();
    });
    bgSwatches.appendChild(b);
  });
}
on(addBgSwatchBtn,"click",()=>{
  const c=bgSolidColor?.value || "#000000";
  if(!defaultBgPalette.includes(c)&&!customBgPalette.includes(c)) customBgPalette.push(c);
  rebuildBgSwatches();
});
on(bgSolidColor,"input",()=>{
  doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null,isGif:false};
  requestPreviewSafeRender();
});
rebuildBgSwatches();

/* =======================================================
   Text metrics / layout / autosize (live + reflects UI)
======================================================= */
function measureText(w){
  ctx.font = `${w.size || defaults.size}px ${w.font || defaults.font}`;
  return ctx.measureText(w.text || "").width;
}
function lineHeight(line){ return Math.max(12, ...line.words.map(w => (w.size || defaults.size))); }
function totalHeight(){ return doc.lines.map(lineHeight).reduce((s,h)=>s+h,0) + (doc.lines.length-1)*(doc.spacing.lineGap||defaults.lineGap); }
function lineWidth(line){
  const gap = doc.spacing.wordGap ?? defaults.wordGap;
  return line.words.reduce((s,w)=> s + measureText(w), 0) + Math.max(0,line.words.length-1)*gap;
}

/* Auto-size (per line) */
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

  // reflect live size of selected (or first word)
  const ref = selected ? doc.lines[selected.line]?.words[selected.word] : doc.lines[0]?.words?.[0];
  if (ref && fontSizeInp) fontSizeInp.value = Math.round(ref.size || defaults.size);
}

/* ---------- Emoji picker data shell (loaded on demand) ---------- */
let EMOJI_DB = null;
async function loadEmojiManifest() {
  if (EMOJI_DB) return EMOJI_DB;
  try{
    const res = await fetch("assets/openmoji/emoji_manifest.json");
    EMOJI_DB = await res.json(); // {categories:[{id,name,items:[{name,path}]}]}
  }catch(e){ notifyUserError("Could not load emoji manifest."); }
  return EMOJI_DB;
}
/* =======================================================
   Part 2 of 3 — Animations runtime / Render / Input
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
  // word.anims plus mandatory “everyone moves” wave added if absent
  const base = (word.anims && word.anims.length) ? [...word.anims] : (doc.anims ? [...doc.anims] : []);
  if (!base.find(a=>a.id==="wave")) base.push({id:"wave",params:{ax:0.5,ay:0.9,cycles:1}});
  return base;
}

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

  // Zoom with duration
  const zm = get("zoom");
  if (zm) {
    const dir = (zm.params.direction || "In");
    const sp  = Number(zm.params.speed || 1);
    const dur = Math.max(0.1, Number(zm.params.duration || 1.0));
    const k = 0.4 * sp;
    const d = Math.min(1, t / dur);
    props.scale *= (dir === "In")
      ? (1 + k * easeOutCubic(d))
      : Math.max(0.2, 1 + k * (1 - easeOutCubic(d)) * (-1));
  }

  // Slide In
  const slide = get("slide");
  if (slide && totalDur) {
    const head = Math.max(0.1, 0.2 * totalDur);
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
    const tail = Math.max(0.1, 0.2 * totalDur);
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
    const tail = Math.max(0.1, 0.2 * totalDur);
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

  // Jitter & Shake
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

  // Color Cycle / Rainbow / Sweep
  const cc = get("colorcycle");
  if (cc) {
    const sp = Number(cc.params.speed || 0.5);
    const base = (cc.params.start || "#ff0000");
    const hueBase = colorToHue(base);
    const hue = Math.floor((hueBase + (t * 60 * sp)) % 360);
    props.color = `hsl(${hue}deg 100% 60%)`;
  }
  const rainbow = get("rainbow");
  if (rainbow && (props.text||"").length) {
    const speed = Number(rainbow.params.speed || 0.5);
    const base = (rainbow.params.start || "#ff00ff");
    const hueBase = colorToHue(base);
    props.gradient = { type: "rainbow", speed, base: hueBase };
  }
  const sweep = get("sweep");
  if (sweep && (props.text||"").length) {
    const speed = Number(sweep.params.speed || 0.7), width = Number(sweep.params.width || 0.25);
    props.gradient = { type: "sweep", speed, width };
  }

  // Flicker / Strobe / Glow
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
  const glow = get("glow");
  if (glow) {
    const intensity = Math.max(0, Number(glow.params.intensity || 0.6));
    const k = (Math.sin(t * 2 * Math.PI * 1.2) * 0.5 + 0.5) * intensity;
    props.shadow = { blur: 6 + k * 10, color: props.color || word.color };
  }

  // Ripple per-char Y
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

/* =======================================================
   Render (BG PNG/GIF + live autosize + selection)
======================================================= */
function render(t=0, totalDur=getDuration()){
  const W = canvas.width  = doc.res.w;
  const H = canvas.height = doc.res.h;

  // BG (always paint a solid first)
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = (doc.bg?.type==="solid" ? (doc.bg.color||"#000") : "#000");
  ctx.fillRect(0,0,W,H);
  if (doc.bg?.image) {
    try { ctx.drawImage(doc.bg.image,0,0,W,H); } catch {}
  } else if (doc.bg?.preset && doc.bg.type==="preset") {
    const im = new Image(); im.crossOrigin="anonymous"; im.src = doc.bg.preset;
    im.onload = ()=>{ doc.bg.image = im; requestPreviewSafeRender(); };
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

      // apply manual free-position
      const fx = Number(w.fx || 0), fy = Number(w.fy || 0);
      const drawX = base.x + (props.dx||0) + fx;
      const drawY = base.y + (props.dy||0) + fy;

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
   Selection / typing / manual drag / multi-select
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

/* Hit test includes manual offsets */
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

/* In preview: click canvas returns to edit mode (quick toggle) */
canvas.addEventListener("click",(e)=>{
  if (mode==="preview") { setMode("edit"); return; }

  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)/zoom, py=(e.clientY-rect.top)/zoom;
  const hit = hitTestWord(px, py);

  if (hit) {
    const k = keyOf(hit.line, hit.word);
    if (e.shiftKey) {                 // Shift = multi-select toggle
      if (doc.multi.has(k)) doc.multi.delete(k);
      else doc.multi.add(k);
      selected = hit;
    } else {
      doc.multi.clear(); selected = hit;
    }
    buildAnimationsUI();              // refresh params / warnings for new selection
    requestPreviewSafeRender();
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
    autoSizeAllIfOn(); requestPreviewSafeRender();
  } else if (e.key==="Backspace"){
    e.preventDefault();
    targets.forEach(([li,wi])=>{
      const w = doc.lines[li]?.words[wi]; if(!w) return;
      w.text = (w.text || "").slice(0,-1);
    });
    autoSizeAllIfOn(); requestPreviewSafeRender();
  }
});

/* Add/line/delete */
addWordBtn?.addEventListener("click",()=>{
  const li = selected ? selected.line : (doc.lines.length-1);
  const line = doc.lines[li] || (doc.lines[li]={words:[]});
  line.words.push({ text:"NEW", color:defaults.color, font:defaults.font, size:defaults.size });
  selected = { line: li, word: line.words.length-1 };
  requestPreviewSafeRender();
});
addLineBtn?.addEventListener("click",()=>{
  doc.lines.push({ words:[{ text:"LINE", color:defaults.color, font:defaults.font, size:defaults.size }] });
  selected = { line: doc.lines.length-1, word: 0 };
  requestPreviewSafeRender();
});
delWordBtn?.addEventListener("click",()=>{
  if (!selected) return;
  const line = doc.lines[selected.line];
  line.words.splice(selected.word,1);
  if (!line.words.length) doc.lines.splice(selected.line,1);
  doc.multi.clear(); selected = null;
  requestPreviewSafeRender();
});

/* Font / size / color inputs */
fontSelect?.addEventListener("change",()=>{ forEachSelectedWord(w=>{ w.font = fontSelect.value || defaults.font; }); autoSizeAllIfOn(); requestPreviewSafeRender(); });
fontSizeInp?.addEventListener("input",()=>{ const v = Math.max(6, Math.min(64, parseInt(fontSizeInp.value||`${defaults.size}`,10))); forEachSelectedWord(w=>{ w.size = v; }); requestPreviewSafeRender(); });
autoSizeChk?.addEventListener("change",()=>{ autoSizeAllIfOn(); requestPreviewSafeRender(); });
fontColorInp?.addEventListener("input",()=>{ const c = fontColorInp.value || defaults.color; forEachSelectedWord(w=>{ w.color = c; }); requestPreviewSafeRender(); });

/* Spacing & alignment */
lineGapInp?.addEventListener("input",()=>{ doc.spacing.lineGap = Math.max(0, Math.min(40, parseInt(lineGapInp.value||"4",10))); autoSizeAllIfOn(); requestPreviewSafeRender(); });
wordGapInp?.addEventListener("input",()=>{ doc.spacing.wordGap = Math.max(0, Math.min(40, parseInt(wordGapInp.value||"6",10))); autoSizeAllIfOn(); requestPreviewSafeRender(); });
alignBtns.forEach(b=> b.addEventListener("click",()=>{
  if (manualDrag.enabled) return;
  alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active");
  doc.style ??= {}; doc.style.align = b.dataset.align || "center"; requestPreviewSafeRender();
}));
valignBtns.forEach(b=> b.addEventListener("click",()=>{
  if (manualDrag.enabled) return;
  valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active");
  doc.style ??= {}; doc.style.valign = b.dataset.valign || "middle"; requestPreviewSafeRender();
}));

/* Multi toggle visual (Shift still works) */
multiToggle?.addEventListener("click", ()=>{
  multiToggle.classList.toggle("active");
});

/* Manual drag toggle (sticky) */
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

/* Cmd/Ctrl = temporary drag (no toggle needed) */
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) / zoom;
  const py = (e.clientY - rect.top) / zoom;

  let willDrag = manualDrag.enabled || e.ctrlKey || e.metaKey;
  if (!willDrag) return; // selection handled via click

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
  requestPreviewSafeRender();
});
window.addEventListener("pointerup", (e) => {
  if (!manualDrag.active) return;
  manualDrag.active = false; manualDrag.targets = []; manualDrag.startOffsets = [];
  document.body.classList.remove("dragging");
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
});

/* ---------- Emoji Picker UI ---------- */
function pageArray(arr, page, per){ return arr.slice(page*per, page*per+per); }
function buildEmojiTabs(db){
  if(!emojiTabs || !db?.categories) return;
  emojiTabs.innerHTML="";
  db.categories.forEach((cat, i)=>{
    const btn = document.createElement("button");
    btn.type="button"; btn.className="pill" + (i===0?" active":"");
    btn.textContent = cat.name;
    btn.addEventListener("click", ()=>{
      Array.from(emojiTabs.children).forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      buildEmojiGrid(cat, 0);
    });
    emojiTabs.appendChild(btn);
  });
}
function buildEmojiGrid(cat, page){
  if(!emojiGrid || !cat) return;
  const per = 60;
  emojiGrid.innerHTML="";
  const slice = pageArray(cat.items||[], page, per);
  slice.forEach(item=>{
    const b=document.createElement("button");
    b.type="button"; b.className="emoji-cell";
    const img = document.createElement("img");
    img.loading="lazy";
    img.src = item.path; // SVG is OK for drawImage
    img.alt = item.name || "emoji";
    b.appendChild(img);
    b.addEventListener("click", ()=>{
      addEmojiAsWord(item);
      emojiModal?.classList.add("hidden");
    });
    emojiGrid.appendChild(b);
  });
  // pager
  if(!emojiPager) return;
  emojiPager.innerHTML="";
  const total = Math.ceil((cat.items||[]).length / per);
  if (total<=1) return;
  const prev = document.createElement("button");
  prev.textContent="‹"; prev.disabled = page<=0;
  prev.addEventListener("click", ()=> buildEmojiGrid(cat, Math.max(0,page-1)));
  const next = document.createElement("button");
  next.textContent="›"; next.disabled = page>=total-1;
  next.addEventListener("click", ()=> buildEmojiGrid(cat, Math.min(total-1,page+1)));
  emojiPager.appendChild(prev);
  emojiPager.appendChild(document.createTextNode(` Page ${page+1}/${total} `));
  emojiPager.appendChild(next);
}
async function openEmojiPicker(){
  const db = await loadEmojiManifest(); if(!db) return;
  buildEmojiTabs(db);
  buildEmojiGrid(db.categories[0], 0);
  emojiModal?.classList.remove("hidden");
}
emojiBtn?.addEventListener("click", openEmojiPicker);
emojiClose?.addEventListener("click", ()=> emojiModal?.classList.add("hidden"));
function addEmojiAsWord(entry){
  // Treat emoji as image word rendered via <img> (SVG supported by drawImage in modern browsers)
  const li = selected ? selected.line : (doc.lines.length-1);
  const line = doc.lines[li] || (doc.lines[li]={words:[]});
  const im = new Image();
  im.onload = ()=>{ line.words.push({ text:"", image:im, size:24, font:defaults.font, color:"#fff", emoji:true }); selected={line:li,word:line.words.length-1}; requestPreviewSafeRender(); };
  im.src = entry.path;
}
/* =======================================================
   Part 3 of 3 — Animations UI / Preview / GIF / Config
======================================================= */

function cloneAnims(src){ return src.map(a=>({ id:a.id, params:{...a.params} })); }

function buildAnimationsUI(){
  if (!animList) return;
  animList.innerHTML = "";

  // (Live) conflict banner
  const banner = document.createElement("div");
  banner.className = "anim-warning hidden";
  animList.appendChild(banner);

  // helper to recompute conflicts on change
  function refreshConflicts(){
    const activeIds = (doc.anims||[]).map(a=>a.id);
    const conflicts = listConflicts(activeIds);
    if (conflicts.length){
      banner.classList.remove("hidden");
      banner.textContent = "⚠ Conflicting animations: " + conflicts.map(pair=> pair.join(" ↔ ")).join("  •  ");
    } else {
      banner.classList.add("hidden");
      banner.textContent = "";
    }
  }

  // Build rows
  (ANIMS).forEach(def=>{
    const row = document.createElement("div"); row.className="anim-row";
    const left = document.createElement("div"); left.className="anim-left";

    const chk = document.createElement("input"); chk.type = "checkbox"; chk.id = `anim_${def.id}`;
    chk.checked = !!doc.anims.find(a=>a.id===def.id);

    const lbl = document.createElement("label"); lbl.setAttribute("for", chk.id); lbl.textContent = def.name;

    const gear = document.createElement("button"); gear.type="button"; gear.className="button tiny"; gear.textContent="⚙";

    left.appendChild(chk); left.appendChild(lbl); left.appendChild(gear);

    // params
    const params = document.createElement("div"); params.className="anim-params"; params.style.display = chk.checked ? "block" : "none";
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
        refreshConflicts();
        requestPreviewSafeRender(true);
      });
      p.appendChild(la); p.appendChild(inp); params.appendChild(p);
    });

    chk.addEventListener("change",()=>{
      const has = !!doc.anims.find(a=>a.id===def.id);
      if (chk.checked && !has){ doc.anims.push({ id:def.id, params:{...def.params} }); params.style.display = "block"; }
      else if (!chk.checked && has){ doc.anims = doc.anims.filter(a=>a.id!==def.id); params.style.display = "none"; }
      refreshConflicts();
      requestPreviewSafeRender(true);
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
    requestPreviewSafeRender(true);
  });
  $("#applyAllAnimBtn")?.addEventListener("click", ()=>{
    const pack = cloneAnims(doc.anims);
    doc.lines.forEach(line=> line.words.forEach(w=> w.anims = cloneAnims(pack)));
    requestPreviewSafeRender(true);
  });

  refreshConflicts();
}

/* =======================================================
   Preview loop (+ keep BG GIFs active), GIF export
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
    if (progressFill) progressFill.style.setProperty("--p", (tt / dur));
    if (tCur) tCur.textContent = `${tt.toFixed(1)}s`;
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}
function stopPreview(){ if (rafId) cancelAnimationFrame(rafId); rafId=null; render(0, getDuration()); }

// If we’re previewing, restart the loop for live updates; else just render once
function requestPreviewSafeRender(restart=false){
  if (mode==="preview"){
    if (restart) startPreview(); else render(((performance.now()-startT)/1000)%getDuration(), getDuration());
  } else {
    render(0, getDuration());
  }
}

function setMode(m){
  mode = m;
  modeEditBtn?.classList.toggle("active", m==="edit");
  modePreviewBtn?.classList.toggle("active", m==="preview");
  if (m==="preview") startPreview();
  else stopPreview();
}
modeEditBtn?.addEventListener("click",()=>setMode("edit"));
modePreviewBtn?.addEventListener("click",()=>setMode("preview"));

/* About modal */
aboutBtn?.addEventListener("click",()=> aboutModal?.classList.remove("hidden"));
aboutClose?.addEventListener("click",()=> aboutModal?.classList.add("hidden"));

/* ---------- Local GIF (preview image under buttons) ---------- */
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
    for (let i = 0; i < frames; i++) { const t = i / fps; render(t, secs); enc.addFrame(ctx); if (progressFill) progressFill.style.setProperty("--p", (t / secs) % 1); if (tCur) tCur.textContent = `${(t % secs).toFixed(1)}s`; }
    enc.finish();
    const blob = encoderToBlob(enc); const url = URL.createObjectURL(blob);

    // Show preview image under buttons (long-press to save on iPhone)
    if (gifPreviewImg){ gifPreviewImg.classList.remove("hidden"); gifPreviewImg.src=url; gifPreviewImg.alt="Animated GIF preview"; }
  }catch(err){ console.error(err); notifyUserError("GIF render failed."); }
  finally{ if(resume) startPreview(); }
}
previewBtn?.addEventListener("click", ()=> setMode("preview"));
gifBtn?.addEventListener("click", ()=> renderGifDownload());
[$("#fps"), $("#seconds")].forEach(inp => inp && inp.addEventListener("input", () => {
  if (mode === "preview") startPreview();
  if (tEnd) tEnd.textContent = `${getDuration().toFixed(1)}s`;
}));

/* ---------- Resolution change ---------- */
on(resSel,"change",()=>{
  const [w,h]=resSel.value.split("x").map(Number);
  doc.res={w,h}; buildBgGrid(); showSolidTools(doc.bg?.type==="solid"); requestPreviewSafeRender(true); fitZoom();
});

/* ---------- Undo/Redo/Clear ---------- */
function snapshot(){ return JSON.parse(JSON.stringify(doc)); }
function pushHistory(){ history.push(snapshot()); future.length=0; }
undoBtn?.addEventListener("click",()=>{ if (!history.length) return; future.push(snapshot()); const last=history.pop(); Object.assign(doc,last); requestPreviewSafeRender(true); });
redoBtn?.addEventListener("click",()=>{ if (!future.length) return; history.push(snapshot()); const next=future.pop(); Object.assign(doc,next); requestPreviewSafeRender(true); });
clearAllBtn?.addEventListener("click",()=>{ pushHistory(); doc.lines=[{words:[{text:"NEW",font:defaults.font,size:defaults.size,color:defaults.color}]}]; requestPreviewSafeRender(true); });

/* ---------- Config import/export (embeds uploaded BG as PNG dataURL) ---------- */
$("#saveJsonBtn")?.addEventListener("click",()=>{
  const data = snapshot();
  if (doc.bg?.image && (doc.bg.type==="image")){
    try{
      const tmp=document.createElement("canvas"); tmp.width=doc.res.w; tmp.height=doc.res.h;
      const tctx=tmp.getContext("2d"); tctx.drawImage(doc.bg.image,0,0,tmp.width,tmp.height);
      data.bg.dataURL = tmp.toDataURL("image/png");
      data.bg.isGif = !!doc.bg.isGif;
    }catch{}
  }
  const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="led_anim_config.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
});
$("#loadJsonInput")?.addEventListener("change",async(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const txt=await f.text(); const obj=JSON.parse(txt);
    Object.assign(doc,obj);
    if (obj.bg?.dataURL){ const im=new Image(); im.src=obj.bg.dataURL; im.onload=()=>{ doc.bg.image=im; requestPreviewSafeRender(true); }; }
    buildBgGrid(); requestPreviewSafeRender(true); fitZoom();
  }catch(err){ notifyUserError("Invalid config file."); }
});

/* ---------- Init ---------- */
function init(){
  buildBgGrid();
  autoSizeChk && (autoSizeChk.checked = true);
  render(0, getDuration());
  fitZoom();
  showOnly("accFont"); // only active pill visible
  buildAnimationsUI(); // build with conflict banner
}
init();
