/* =======================================================================
   LED Backpack Animator v1.0 — app.js (updated, drop-in)
   - Startup preset loads from JSON (lines only) without altering backgrounds
   - Mobile-first fitZoom on init + resize; canvas renders immediately
   - Control bar logic unchanged in HTML; layout handled via CSS (2 rows)
   - Inspector pills: only active pill body shows; none => no bodies visible
   - Text Color Effects (ColorCycle, Rainbow, Glow) live under Font (not Animations)
   - Wave remains under Animations (motion)
   - Emoji modal: Static / Animated / Both tabs + search; insertion works
   - Background grid sizes responsive (2×2 mobile, 4-across desktop) via CSS
   - Generate Preview shows preview image without download; Download saves GIF
   - Selection delete “×” handle always visible (clamped inside canvas)
   - No IDs/classes removed; wired to your HTML and CSS as-is
   ======================================================================= */

/* ------------------ small helpers ------------------ */
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

/* ------------------ DOM refs ------------------ */
const canvas=$("#led"), ctx=canvas.getContext("2d"), wrap=$(".canvas-wrap");

/* toolbar */
const modeEditBtn=$("#modeEdit"), modePreviewBtn=$("#modePreview");
const zoomSlider=$("#zoom"), fitBtn=$("#fitBtn");
const undoBtn=$("#undoBtn"), redoBtn=$("#redoBtn"), clearAllBtn=$("#clearAllBtn");

/* BG + resolution */
const resSel=$("#resSelect"), bgGrid=$("#bgGrid");
const bgSolidTools=$("#bgSolidTools"), bgSolidColor=$("#bgSolidColor");
const addBgSwatchBtn=$("#addBgSwatchBtn"), bgSwatches=$("#bgSwatches");
const bgUpload=$("#bgUpload");

/* stage controls */
const multiToggle=$("#multiToggle"),
      manualDragBtn=$("#manualDragBtn") || $("#manualDragToggle");
const addWordBtn=$("#addWordBtn"), addLineBtn=$("#addLineBtn"), delWordBtn=$("#deleteWordBtn");
const emojiBtn=$("#emojiBtn");

/* inspector: font/layout/anims */
const pillTabs=$$(".pill[data-acc]");
const accFont=$("#accFont"), accLayout=$("#accLayout"), accAnim=$("#accAnim");

const fontSelect=$("#fontSelect"), fontSizeInp=$("#fontSize");
const autoSizeWordChk=$("#autoSize") || {checked:true};       // tolerate old markup
const autoSizeLineChk=$("#autoSizePerLine") || {checked:true}; // tolerate old markup
const fontColorInp=$("#fontColor"), addSwatchBtn=$("#addSwatchBtn"), textSwatches=$("#swatches");

const lineGapInp=$("#lineGap"), wordGapInp=$("#wordGap");
const alignBtns=$$("[data-align]"), valignBtns=$$("[data-valign]");

/* anims */
const animList=$("#animList");
const applySelBtn=$("#applySelectedAnimBtn"), applyAllBtn=$("#applyAllAnimBtn");

/* progress / preview */
const progressBar=$("#progress"), tCur=$("#tCur"), tEnd=$("#tEnd");

/* config + render */
const loadProjectInput = $("#loadWordsJsonInput");
const saveProjectBtn   = $("#saveWordsJsonBtn");
const loadAppCfgInput  = $("#loadAppCfgInput");
const saveAppCfgBtn    = $("#saveAppCfgBtn");
const fpsInp=$("#fps"), secondsInp=$("#seconds"), fileNameInp=$("#fileName");
const previewBtn=$("#previewRenderBtn"), gifBtn=$("#gifRenderBtn"), gifPreviewImg=$("#gifPreview");

/* about + info */
const aboutBtn=$("#aboutBtn"), aboutModal=$("#aboutModal"), aboutClose=$("#aboutClose");

/* emoji modal */
const emojiModal=$("#emojiModal"), emojiTabs=$("#emojiTabs"), emojiGrid=$("#emojiGrid");
const emojiSearch=$("#emojiSearch"), emojiClose=$("#emojiClose");

/* ------------------ state ------------------ */
let mode="edit", zoom=1, selected=null;
let history=[], future=[];
const UNDO_LIMIT=100;
let startT=0, rafId=null;
const uiLock = { emojiOpen: false };
const defaults={ font:"Orbitron", size:22, color:"#FFFFFF" };

const caret = { // <<< ADDED: CARET STATE FOR TEXT CURSOR
  active: false,
  line: 0,
  word: 0,
  index: 0,
  blinkOn: true,
  lastBlink: 0
};

const doc={
  version:"1.0",
  res:{ w:96, h:128 },
  bg:{ type:"preset", color:null, image:null, preset:"assets/presets/96x128/Preset_A.png" },
  spacing:{ lineGap:4, wordGap:6 }, style:{ align:"center", valign:"middle" },
  lines:[ // will be replaced by startup.json (lines only) if present
    { words:[{text:"LED",      color:"#E9EDFB", font:"Orbitron", size:24, anims:[]}] },
    { words:[{text:"Backpack", color:"#FF6BD6", font:"Orbitron", size:24, anims:[]}] },
    { words:[{text:"Animator", color:"#7B86FF", font:"Orbitron", size:24, anims:[]}] }
  ],
  anims:[], // panel defaults (used for Apply To All etc.)
  multi:new Set()
};

/* theme palette to match new CSS */
const THEME_COLORS = ["#FF6BD6","#7B86FF","#E9EDFB"];

/* ------------------ presets catalog ------------------ */
const PRESETS={
  "96x128":[
    {id:"A",thumb:"assets/thumbs/Preset_A_thumb.png",full:"assets/presets/96x128/Preset_A.png"},
    {id:"B",thumb:"assets/thumbs/Preset_B_thumb.png",full:"assets/presets/96x128/Preset_B.png"}
  ],
  "64x64":[
    {id:"C",thumb:"assets/thumbs/Preset_C_thumb.png",full:"assets/presets/64x64/Preset_C.png"},
    {id:"D",thumb:"assets/thumbs/Preset_D_thumb.png",full:"assets/presets/64x64/Preset_D.png"}
  ]
};
const visibleSet=()=>PRESETS[`${doc.res.w}x${doc.res.h}`]||[];

/* ------------------ emoji db ------------------ */
let EMOJI_DB=null; // static OpenMoji pack
let NOTO_DB=null;  // Animated (Noto) index via AnimatedEmoji helper
async function loadEmojiManifest(){
  if (EMOJI_DB) return EMOJI_DB;

  const r = await fetch("assets/openmoji/emoji_manifest.json", { cache: "no-store" });
  const j = await r.json();

  // Accept either an array or {entries:[...]}
  const entries = Array.isArray(j) ? j : (Array.isArray(j.entries) ? j.entries : []);
  EMOJI_DB = {
    categories: (j.categories && Array.isArray(j.categories)) ? j.categories : [],
    entries: entries.map(e => ({
      id: String(e.id || e.unicode || ""),
      name: e.name || "emoji",
      // prefer src, fall back to path
      path: e.src || e.path || "",
      category: e.category || "General"
    }))
  };
  if (!EMOJI_DB.categories.length) {
    EMOJI_DB.categories = Array.from(new Set(EMOJI_DB.entries.map(e => e.category)));
  }
  return EMOJI_DB;
}
function loadNotoIndex(){
  if (NOTO_DB) return NOTO_DB;
  if (window.AnimatedEmoji?.NOTO_INDEX) {
    // Normalize to {id,name,category,path?, code?}
    NOTO_DB = {
      categories:["Animated"],
      entries: window.AnimatedEmoji.NOTO_INDEX.map(e=>({
        id:e.cp, name:e.name, category:"Animated", // no file path; rendered by AnimatedEmoji
        cp:e.cp, ch:e.ch
      }))
    };
  } else {
    NOTO_DB = {categories:["Animated"], entries:[]};
  }
  return NOTO_DB;
}

/* ------------------ misc ui helpers ------------------ */
function notify(...a){ console.log("[INFO]",...a); }
function warn(...a){ console.warn("[WARN]",...a); }

/* =======================================================
   BACKGROUND GRID / SOLID / UPLOAD
======================================================= */
function showSolidTools(show){ bgSolidTools?.classList.toggle("hidden", !show); }
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
    const img=document.createElement("img"); img.src=t.thumb; img.alt=t.kind;
    b.appendChild(img);
    on(b,"click",async()=>{
      $$(".bg-tile",bgGrid).forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      if(t.kind==="preset"){
        const im=new Image(); im.crossOrigin="anonymous"; im.src=t.full;
        im.onload=()=>{ doc.bg={type:"preset",color:null,image:im,preset:t.full}; showSolidTools(false); render(); };
      }else if(t.kind==="solid"){
        doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null};
        showSolidTools(true); render();
      }else{
        bgUpload.click();
      }
    });
    bgGrid.appendChild(b);
  });
  const firstPreset=$(".bg-tile[data-kind='preset']",bgGrid);
  firstPreset&&firstPreset.classList.add("active");
}
on(bgUpload,"change",e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=()=>{ URL.revokeObjectURL(url); doc.bg={type:"image",color:null,image:im,preset:null}; showSolidTools(false); render(); };
  im.src=url;
});

/* ------------------ bg color swatches ------------------ */
const defaultBgPalette=["#FFFFFF","#000000","#101010","#1a1a1a","#222","#333","#444","#555","#666"];
let customBgPalette=[];
function rebuildBgSwatches(){
  bgSwatches.innerHTML="";
  [...defaultBgPalette,...customBgPalette].forEach(c=>{
    const b=document.createElement("button"); b.className="swatch"; b.style.background=c; b.title=c;
    b.onclick=()=>{ doc.bg={type:"solid",color:c,image:null,preset:null}; showSolidTools(true); render(); };
    bgSwatches.appendChild(b);
  });
}
on(addBgSwatchBtn,"click",()=>{
  const c=bgSolidColor.value||"#000000";
  if(!defaultBgPalette.includes(c)&&!customBgPalette.includes(c)) customBgPalette.push(c);
  rebuildBgSwatches();
});
on(bgSolidColor,"input",()=>{ doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null}; render(); });

/* =======================================================
   ZOOM / FIT / MODE
======================================================= */
function setZoom(z){ zoom=z; zoomSlider.value=String(z); canvas.style.transform=`translate(-50%,-50%) scale(${z})`; }
function fitZoom(){
  const pad=18, r=wrap.getBoundingClientRect();
  const availW=Math.max(40,r.width-pad*2), availH=Math.max(40,r.height-pad*2);
  setZoom(Math.max(0.1,Math.min(availW/doc.res.w, availH/doc.res.h)));
}
on(zoomSlider,"input",e=>setZoom(parseFloat(e.target.value)));
on(fitBtn,"click",fitZoom); window.addEventListener("resize",fitZoom);

function setMode(m){
  mode=m;
  modeEditBtn?.classList.toggle("active", m==="edit");
  modePreviewBtn?.classList.toggle("active", m==="preview");
  if (m==="preview") startPreview(); else stopPreview(0,true);
}
on(modeEditBtn,"click",()=>setMode("edit"));
on(modePreviewBtn,"click",()=>setMode("preview"));
on(canvas,"click",()=>{ if(mode==="preview") setMode("edit"); });

/* =======================================================
   PILLS (show only active; none => none visible)
======================================================= */
function syncPillsVisibility(){
  const active = $(".pill.active");
  [accFont,accLayout,accAnim].forEach(x=> x && (x.open=false, x.classList.remove("open")));
  pillTabs.forEach(x=> x.classList.remove("active"));
  if(active){
    const id=active.dataset.acc;
    const target=$("#"+id);
    if(target){ target.open=true; target.classList.add("open"); }
  }
  // hide all bodies unless open
  [accFont,accLayout,accAnim].forEach(x=>{
    if(!x) return;
    if(x.open){ x.style.display="block"; }
    else { x.style.display="none"; }
  });
}
pillTabs.forEach(p=>{
  on(p,"click",()=>{
    const isActive=p.classList.contains("active");
    pillTabs.forEach(x=>x.classList.remove("active"));
    if(!isActive){ p.classList.add("active"); }
    syncPillsVisibility();
  });
});
syncPillsVisibility();

/* =======================================================
   TEXT SWATCHES
======================================================= */
const defaultTextPalette=["#FFFFFF","#FF3B30","#00E25B","#1E5BFF","#FFE45A","#FF65D5","#40F2F2","#000000"];
let customTextPalette=[];
function rebuildTextSwatches(){
  textSwatches.innerHTML="";
  [...defaultTextPalette, ...customTextPalette, ...THEME_COLORS].forEach(c=>{
    const b=document.createElement("button"); b.className="swatch"; b.style.background=c; b.title=c;
    b.onclick=()=>{ forEachSelectedWord(w=>w.color=c); render(); fontColorInp.value=c; };
    textSwatches.appendChild(b);
  });
}
on(addSwatchBtn,"click",()=>{
  const c=fontColorInp.value||"#FFFFFF";
  if(!defaultTextPalette.includes(c)&&!customTextPalette.includes(c)) customTextPalette.push(c);
  rebuildTextSwatches();
});

/* =======================================================
   MEASURE / AUTOSIZE
======================================================= */
const emojiCache=new Map();
function getEmojiImage(url){
  if(emojiCache.has(url)) return emojiCache.get(url);
  const img=new Image(); img.crossOrigin="anonymous"; img.decoding="async"; img.src=url;
  emojiCache.set(url,img); return img;
}
function measureText(w){
  if(w?.emoji){ return (w.size??24) * (w.scale??1); }
  ctx.font=`${w.size||defaults.size}px ${w.font||defaults.font}`;
  return ctx.measureText(w.text||"").width;
}
function lineHeight(line){
  const hs = line.words.map(w=> w.emoji ? (w.size??24)*(w.scale??1) : (w.size||defaults.size));
  return Math.max(12, ...hs);
}
function lineWidth(line){
  const gap=doc.spacing.wordGap??6;
  return line.words.reduce((s,w)=>s+measureText(w),0)+Math.max(0,line.words.length-1)*gap;
}
function totalHeight(){
  const lg=doc.spacing.lineGap??4;
  return doc.lines.map(lineHeight).reduce((s,h)=>s+h,0)+ (doc.lines.length-1)*lg;
}
function autoSizeAllIfOn(){
  const padX=6, padY=6, maxW=doc.res.w-padX*2, maxH=doc.res.h-padY*2;
  const L=Math.max(1,doc.lines.length), lg=doc.spacing.lineGap??4;
  const perLineH=(maxH-(L-1)*lg)/L;

  doc.lines.forEach(line=>{
    if (autoSizeLineChk?.checked){
      // cap each word so whole line fits width; also cap by per-line height
      let s=Math.floor(perLineH);
      for(let test=s; test>=6; test-=0.5){
        let wsum=- (doc.spacing.wordGap??6);
        for(const w of line.words){
          const base = w.emoji ? (w.size??24)*(w.scale??1) : (test);
          if(!w.emoji){
            ctx.font=`${test}px ${w.font||defaults.font}`;
            wsum += ctx.measureText(w.text||"").width + (doc.spacing.wordGap??6);
          }else{
            wsum += base + (doc.spacing.wordGap??6);
          }
        }
        if(wsum<=maxW){ line.words.forEach(w=>{ if(!w.emoji) w.size=test; }); break; }
      }
    }else if (autoSizeWordChk?.checked){
      line.words.forEach(w=>{
        if (w.emoji) return;
        for(let s=(w.size||defaults.size); s>=6; s--){
          ctx.font=`${s}px ${w.font||defaults.font}`;
          if (lineWidth(line)<=maxW){ w.size=s; break; }
        }
      });
    }
  });

  const wSel = selected ? doc.lines[selected.line]?.words[selected.word] : doc.lines[0]?.words[0];
  if (wSel && !wSel.emoji && fontSizeInp) fontSizeInp.value=Math.round(wSel.size||defaults.size);
}

/* =======================================================
   ANIMATIONS DEFINITIONS
======================================================= */
function seconds(){ return Math.max(1,Math.min(60, parseInt(secondsInp?.value||"8",10))); }
function fps(){ return Math.max(1,Math.min(30, parseInt(fpsInp?.value||"15",10))); }
function colorToHue(hex){ const c=(hex||"#fff").replace("#",""); const r=parseInt(c.slice(0,2)||"ff",16)/255,g=parseInt(c.slice(2,4)||"ff",16)/255,b=parseInt(c.slice(4,6)||"ff",16)/255; const M=Math.max(r,g,b), m=Math.min(r,g,b); if(M===m) return 0; const d=M-m; let h=(M===r)?(g-b)/d+(g<b?6:0):(M===g)?(b-r)/d+2:(r-g)/d+4; return Math.round((h/6)*360); }
function easeOutCubic(x){ return 1-Math.pow(1-x,3); }

const ANIMS=[
  {id:"slide",name:"Slide In",params:{direction:"Left",speed:1,dur:0.6}},
  {id:"slideaway",name:"Slide Away",params:{direction:"Left",speed:1,dur:0.6}},
  {id:"zoom",name:"Zoom",params:{direction:"In",speed:1,dur:0.6}},
  {id:"scroll",name:"Scroll / Marquee",params:{direction:"Left",speed:1}},
  {id:"pulse",name:"Pulse / Breathe",params:{scale:0.03,vy:4,dur:seconds()}},
  {id:"wave",name:"Wave",params:{ax:0.8,ay:1.4,cycles:1,dur:seconds()}},
  {id:"jitter",name:"Jitter",params:{amp:0.1,freq:2.5,dur:seconds()}},
  {id:"shake",name:"Shake",params:{amp:0.2,freq:2,dur:seconds()}},
  {id:"colorcycle",name:"Color Change",params:{speed:0.5,start:"#ff0000",dur:seconds()}},
  {id:"rainbow",name:"Rainbow Sweep",params:{speed:0.6,start:"#ff00ff",dur:seconds()}},
  {id:"sweep",name:"Highlight Sweep",params:{speed:0.7,width:0.25,dur:seconds()}},
  {id:"flicker",name:"Flicker",params:{strength:0.5,dur:seconds()}},
  {id:"strobe",name:"Strobe",params:{rate:3,dur:seconds()}},
  {id:"glow",name:"Glow Pulse",params:{intensity:0.6,dur:seconds()}},
  {id:"heartbeat",name:"Heartbeat",params:{rate:1.2,dur:seconds()}},
  {id:"ripple",name:"Ripple",params:{amp:1.0,freq:2.0,dur:seconds()}},
  {id:"typewriter",name:"Typewriter",params:{rate:1}},
  {id:"scramble",name:"Scramble / Decode",params:{rate:1}},
  {id:"popcorn",name:"Popcorn",params:{rate:1,dur:seconds()}},
  {id:"fadeout",name:"Fade Out",params:{dur:0.6}}
];

/* group helpers */
function resolveWordAnims(w){ return (w.anims && w.anims.length)? w.anims : (doc.anims||[]); }
function checkConflicts(anims){
  const ids=new Set(anims.map(a=>a.id));
  const conflicts=[];
  const pos=["slide","scroll","slideaway","zoom"]; const count=pos.filter(p=>ids.has(p)).length; if(count>1) conflicts.push("Multiple position animations (slide/scroll/zoom/slideaway)");
  if(ids.has("strobe") && ids.has("flicker")) conflicts.push("Strobe + Flicker");
  return conflicts;
}

/* =======================================================
   TEXT COLOR EFFECTS (Font panel only)
======================================================= */
function ensureFontFXControls(){
  const body = accFont?.querySelector(".acc-body");
  if(!body || body.dataset.fxInit==="1") return;
  body.dataset.fxInit="1";

  const fxWrap=document.createElement("div");
  fxWrap.className="row fx-group";
  fxWrap.innerHTML=`
    <div class="block-label">Text Color Effects</div>
    <div class="row two-eq">
      <label class="checkbox"><input type="checkbox" id="fxColorCycle"><span>Color Cycle</span></label>
      <div class="row two-compact">
        <label>Start</label><input type="color" id="fxColorCycleStart" value="#ff00ff">
      </div>
      <div class="row two-compact">
        <label>Speed</label><input type="number" id="fxColorCycleSpeed" value="0.5" step="0.1" min="0" max="5">
      </div>
    </div>
    <div class="row two-eq">
      <label class="checkbox"><input type="checkbox" id="fxRainbow"><span>Rainbow</span></label>
      <div class="row two-compact">
        <label>Speed</label><input type="number" id="fxRainbowSpeed" value="0.6" step="0.1" min="0" max="5">
      </div>
    </div>
    <div class="row two-eq">
      <label class="checkbox"><input type="checkbox" id="fxGlow"><span>Glow</span></label>
      <div class="row two-compact">
        <label>Intensity</label><input type="number" id="fxGlowIntensity" value="0.6" step="0.1" min="0" max="5">
      </div>
    </div>
  `;
  body.appendChild(fxWrap);

  const fxColorCycle=$("#fxColorCycle"), fxCycleStart=$("#fxColorCycleStart"), fxCycleSpeed=$("#fxColorCycleSpeed");
  const fxRainbow=$("#fxRainbow"), fxRainbowSpeed=$("#fxRainbowSpeed");
  const fxGlow=$("#fxGlow"), fxGlowIntensity=$("#fxGlowIntensity");

  function upsert(word, id, params){
    word.anims ??= [];
    const i=word.anims.findIndex(a=>a.id===id);
    if(i<0) word.anims.push({id, params:{...params}});
    else word.anims[i].params={...word.anims[i].params, ...params};
  }
  function remove(word, id){
    if(!word.anims) return;
    const i=word.anims.findIndex(a=>a.id===id);
    if(i>=0) word.anims.splice(i,1);
  }
  function syncFromUI(){
    pushHistory();
    forEachSelectedWord(w=>{
      if(fxColorCycle.checked){
        upsert(w,"colorcycle",{start:fxCycleStart.value, speed:+fxCycleSpeed.value, dur:seconds()});
        // If rainbow also on, keep both; rendering blends gradient > cycle priority handled in render
      }else remove(w,"colorcycle");

      if(fxRainbow.checked){
        upsert(w,"rainbow",{start:"#ff00ff", speed:+fxRainbowSpeed.value, dur:seconds()});
      }else remove(w,"rainbow");

      if(fxGlow.checked){
        upsert(w,"glow",{intensity:+fxGlowIntensity.value, dur:seconds()});
      }else remove(w,"glow");
    });
    if(mode==="preview") startPreview(); else render();
  }

  [fxColorCycle,fxCycleStart,fxCycleSpeed,fxRainbow,fxRainbowSpeed,fxGlow,fxGlowIntensity].forEach(el=> on(el,"input",syncFromUI));
}
ensureFontFXControls();

/* =======================================================
   RENDER PROPS
======================================================= */
function animatedProps(base, word, t, totalDur){
  const props={x:base.x,y:base.y,scale:1,alpha:1,text:word.text||"",color:word.color,dx:0,dy:0,shadow:null,gradient:null,perChar:null};
  const get=id=>resolveWordAnims(word).find(a=>a.id===id);
  const dur=(id)=>Math.max(0.05,(get(id)?.params?.dur ?? totalDur ?? seconds()));

  // scroll
  const sc=get("scroll"); if(sc){ const dir=sc.params.direction||"Left"; const sp=Number(sc.params.speed||1); const v=20*sp; if(dir==="Left")props.dx-=(t*v)%(doc.res.w+200); if(dir==="Right")props.dx+=(t*v)%(doc.res.w+200); if(dir==="Up")props.dy-=(t*v)%(doc.res.h+200); if(dir==="Down")props.dy+=(t*v)%(doc.res.h+200); }

  // zoom
  const zm=get("zoom"); if(zm){ const k=0.4*(Number(zm.params.speed||1)); const d=Math.min(1,t/dur("zoom")); props.scale*=(zm.params.direction==="Out")? Math.max(0.2,1-k*easeOutCubic(d)) : (1+k*easeOutCubic(d)); }

  // slide in
  const sl=get("slide"); if(sl){ const head=0.25*dur("slide"); const d=Math.min(1,t/head); const dist=((["Left","Right"].includes(sl.params.direction))?doc.res.w:doc.res.h)*0.6*(Number(sl.params.speed||1)); const s=1-easeOutCubic(d); const dir=sl.params.direction||"Left"; if(dir==="Left")props.dx-=dist*s; if(dir==="Right")props.dx+=dist*s; if(dir==="Up")props.dy-=dist*s; if(dir==="Down")props.dy+=dist*s; }

  // slideaway tail
  const sw=get("slideaway"); if(sw && totalDur){ const tail=0.25*dur("slideaway"); if(t>totalDur-tail){ const d=(t-(totalDur-tail))/tail; const dist=((["Left","Right"].includes(sw.params.direction))?doc.res.w:doc.res.h)*0.6*(Number(sw.params.speed||1)); const s=easeOutCubic(d); const dir=sw.params.direction||"Left"; if(dir==="Left")props.dx-=dist*s; if(dir==="Right")props.dx+=dist*s; if(dir==="Up")props.dy-=dist*s; if(dir==="Down")props.dy+=dist*s; } }

  // fadeout
  const fo=get("fadeout"); if(fo && totalDur){ const tail=0.25*dur("fadeout"); if(t>totalDur-tail){ const d=(t-(totalDur-tail))/tail; props.alpha*=Math.max(0,1-d); } }

  // pulse / wave / jitter / shake / ripple
  const pu=get("pulse"); if(pu){ const s=Number(pu.params.scale||0.03), vy=Number(pu.params.vy||4); props.scale*=1+Math.sin(t*2*Math.PI)*s; props.dy+=Math.sin(t*2*Math.PI)*vy; }
  const wv=get("wave"); if(wv){ const ax=Number(wv.params.ax||0.8), ay=Number(wv.params.ay||1.4), cyc=Number(wv.params.cycles||1); const ph=cyc*2*Math.PI*(t/dur("wave")); props.dx+=Math.sin(ph+base.x*0.05)*ax*4; props.dy+=Math.sin(ph+base.y*0.06)*ay*4; }
  const jit=get("jitter"); if(jit){ const a=Number(jit.params.amp||0.1), f=Number(jit.params.freq||2.5); props.dx+=Math.sin(t*2*Math.PI*f)*a*3; props.dy+=Math.cos(t*2*Math.PI*f)*a*3; }
  const shk=get("shake"); if(shk){ const a=Number(shk.params.amp||0.2)*5, f=Number(shk.params.freq||2); props.dx+=Math.sin(t*2*Math.PI*f)*a; props.dy+=Math.cos(t*2*Math.PI*f)*a*0.6; }
  const rp=get("ripple"); if(rp && word.text){ const amp=Number(rp.params.amp||1)*2,fq=Number(rp.params.freq||2); props.perChar??={}; props.perChar.dy=Array.from(word.text).map((_,i)=>Math.sin(2*Math.PI*fq*t+i*0.6)*amp); }

  // typewriter / scramble / popcorn
  const tw=get("typewriter"); if(tw && props.text){ const cps=10*Number(tw.params.rate||1); const shown=Math.min(props.text.length, Math.floor(t*cps)); props.text=props.text.slice(0,shown); }
  const scb=get("scramble"); if(scb && word.text){ const cps=10*Number(scb.params.rate||1), goal=word.text; let out=""; for(let i=0;i<goal.length;i++){ const revealAt=i/cps; if(t>=revealAt) out+=goal[i]; else{ const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"; out+=chars[Math.floor((t*20+i*3)%chars.length)]; } } props.text=out; }
  const pop=get("popcorn"); if(pop && word.text){ const rate=Number(pop.params.rate||1); props.perChar??={}; props.perChar.alpha=Array.from(word.text).map((_,i)=> (Math.sin(2*Math.PI*rate*t+i*0.4)>0)?1:0.25 ); }

  // color fx
  const cc=get("colorcycle"); if(cc){ const durC=dur("colorcycle"); const sp=Number(cc.params.speed||0.5); const base=colorToHue(cc.params.start||"#ff0000"); const h=((base + (t/durC)*360*sp)%360)|0; props.color=`hsl(${h}deg 100% 60%)`; }
  const rb=get("rainbow"); if(rb && (props.text||"").length){ const durR=dur("rainbow"); const speed=Number(rb.params.speed||0.6); const base=colorToHue(rb.params.start||"#ff00ff"); props.gradient={type:"rainbow",speed,base,loop:durR}; }
  const swp=get("sweep"); if(swp && (props.text||"").length){ const durS=dur("sweep"); props.gradient={type:"sweep",speed:Number(swp.params.speed||0.7),width:Number(swp.params.width||0.25),loop:durS}; }
  const gl=get("glow"); if(gl){ const k=(Math.sin(t*2*Math.PI*1.2)*0.5+0.5)*Number(gl.params.intensity||0.6); props.shadow={blur:6+k*10,color:props.color||word.color}; }

  return props;
}

/* =======================================================
   RENDER (+ delete handle)
======================================================= */
function render(t=0,totalDur=seconds()){
  const W=canvas.width=doc.res.w, H=canvas.height=doc.res.h;
  ctx.clearRect(0,0,W,H);
  
  // ▼ FIX: Only draw solid background if specified (makes canvas clear/transparent for presets)
  if (doc.bg?.type==="solid") {
    ctx.fillStyle=(doc.bg.color||"#000"); 
    ctx.fillRect(0,0,W,H);
  }
  // ▲ END FIX
  
  // preset/image
  if(doc.bg?.image){ try{ ctx.drawImage(doc.bg.image,0,0,W,H); }catch{} }
  else if(doc.bg?.preset && !doc.bg.image){
    const im=new Image(); im.crossOrigin="anonymous"; im.src=doc.bg.preset;
    im.onload=()=>{ doc.bg.image=im; render(t,totalDur); };
  }

  autoSizeAllIfOn();

  const lg=doc.spacing.lineGap??4, wg=doc.spacing.wordGap??6;
  const heights=doc.lines.map(lineHeight);
  const contentH=heights.reduce((s,h)=>s+h,0)+(doc.lines.length-1)*lg;
  
  // ▼ FIX: yCursor tracks the running vertical position of the line block top edge
  let yCursor;
  if(doc.style.valign==="top") yCursor=4;
  else if(doc.style.valign==="bottom") yCursor=H-contentH-4;
  else yCursor=(H-contentH)/2;

  doc.lines.forEach((line,li)=>{
    const lh=heights[li], wLine=lineWidth(line);
    let xBase;
    if(doc.style.align==="left") xBase=4;
    else if(doc.style.align==="right") xBase=W-wLine-4;
    else xBase=(W-wLine)/2;

    // Adjusted to lh*0.9 for better vertical centering within the line
    let x=xBase, y=yCursor+lh*0.9;
    
    line.words.forEach((w,wi)=>{
      const base={x,y};
      const props=animatedProps(base,w,t,totalDur);
      const fx=Number(w.fx||0), fy=Number(w.fy||0);

      // Emoji
      if(w.emoji){
        const box=(w.size??24)*(w.scale??1)*(props.scale||1);
        const drawX=base.x+(props.dx||0)+fx, drawY=base.y+(props.dy||0)+fy;
        const topY=drawY-box;
        const img=getEmojiImage(w.src);
        if(img && img.complete && img.naturalWidth>0){
          ctx.save(); ctx.globalAlpha=Math.max(0,Math.min(1,props.alpha));
          if(props.shadow){ ctx.shadowBlur=props.shadow.blur; ctx.shadowColor=props.shadow.color||"#fff"; }
          ctx.drawImage(img, drawX, topY, box, box);
          ctx.restore();
        } else if(img){ img.onload=()=>{ if(mode==="preview") startPreview(); else render(t,totalDur); }; }

        // selection box + delete handle
        const key=`${li}:${wi}`;
        if(doc.multi.has(key) || (selected && selected.line===li && selected.word===wi && mode==="edit")){
          drawSelectionBox(drawX, topY, box, box, doc.multi.has(key));
        }
        x+= (w.size??24)*(w.scale??1) + wg;
        return;
      }

      // text
      const txt=props.text||"";
      const fsize=(w.size||defaults.size)*(props.scale||1);
      ctx.save(); ctx.globalAlpha=Math.max(0,Math.min(1,props.alpha));
      ctx.textBaseline="alphabetic"; ctx.font=`${fsize}px ${w.font||defaults.font}`;
      if(props.shadow){ ctx.shadowBlur=props.shadow.blur; ctx.shadowColor=props.shadow.color||(w.color||defaults.color); }

      let fillStyle=props.color||(w.color||defaults.color);
      const drawX=base.x+(props.dx||0)+fx, drawY=base.y+(props.dy||0)+fy;

      if(props.gradient && txt.length){
        const ww=Math.ceil(ctx.measureText(txt).width);
        if(props.gradient.type==="rainbow"){
          const g=ctx.createLinearGradient(drawX,drawY,drawX+ww,drawY);
          const baseHue=(props.gradient.base + (t/props.gradient.loop)*360*props.gradient.speed)%360;
          for(let i=0;i<=6;i++){ const stop=i/6, h=Math.floor((baseHue+stop*360)%360); g.addColorStop(stop,`hsl(${h}deg 100% 60%)`); } fillStyle=g;
        } else if(props.gradient.type==="sweep"){
          const band=Math.max(0.05,Math.min(0.8,props.gradient.width||0.25));
          const pos=((t/props.gradient.loop)*props.gradient.speed)%1;
          const g=ctx.createLinearGradient(drawX,drawY,drawX+ww,drawY);
          const a=Math.max(0,pos-band/2), b=Math.min(1,pos+band/2);
          g.addColorStop(0,fillStyle); g.addColorStop(a,fillStyle); g.addColorStop(pos,"#FFFFFF"); g.addColorStop(b,fillStyle); g.addColorStop(1,fillStyle); fillStyle=g;
        }
      }
      ctx.fillStyle=fillStyle;
      if(props.perChar && txt.length){
        const widths=Array.from(txt).map(ch=>{
          ctx.font=`${fsize}px ${w.font||defaults.font}`;
          return Math.ceil(ctx.measureText(ch).width);
        });
        let cx=drawX;
        for(let i=0;i<txt.length;i++){
          const ch=txt[i], dy=props.perChar.dy?.[i]||0, oa=ctx.globalAlpha;
          ctx.globalAlpha=oa*(props.perChar.alpha?.[i] ?? 1);
          ctx.fillText(ch, cx, drawY+dy);
          ctx.globalAlpha=oa;
          cx+=widths[i];
        }
      }else{
        ctx.fillText(txt, drawX, drawY);
        // draw caret if active on this word
        if (caret.active && caret.line===li && caret.word===wi && mode==="edit") {
          const baseSize = (w.size||defaults.size);
          ctx.save();
          ctx.font = `${baseSize}px ${w.font||defaults.font}`;
          const leftText = (w.text||"").slice(0, Math.min(caret.index, (w.text||"").length));
          const cx = drawX + ctx.measureText(leftText).width;
          // blink
          const now = performance.now();
          if (now - (caret.lastBlink||0) > 500) {
            caret.blinkOn = !caret.blinkOn;
            caret.lastBlink = now;
          }
          if (caret.blinkOn) {
            ctx.fillStyle = "#E9EDFB";
            ctx.fillRect(cx, drawY - baseSize, 1, baseSize + 2);
          }
          ctx.restore();
        }
      }
      // selection rectangle + delete handle
      const selKey=`${li}:${wi}`;
      const ww=ctx.measureText(w.text||"").width;
      if(doc.multi.has(selKey) || (selected && selected.line===li && selected.word===wi && mode==="edit")){
        drawSelectionBox(drawX-2, (drawY)-lh, ww+4, lh+4, doc.multi.has(selKey));
      }
      ctx.restore();
      x+= measureText(w) + wg;
    });
    
    // Advance the cursor to the top of the next line block
    yCursor+= lh + lg; 
    // ▲ END FIX
    
  });
  
  if(selected){
    const w=doc.lines[selected.line]?.words[selected.word];
    if(w){
      const conf=checkConflicts(resolveWordAnims(w));
      if(conf.length) warn("Animation conflicts: "+conf.join(", "));
    }
  }
}
/* draw selection + delete handle clamped inside canvas */
const HANDLE_SIZE=14; 
function drawSelectionBox(x,y,w,h,isMulti){ 
  ctx.save(); 
  ctx.setLineDash([3,2]); 
  ctx.lineWidth=1; 
  ctx.strokeStyle=isMulti?"rgba(0,255,255,0.95)":"rgba(255,0,255,0.95)"; 
  ctx.stroke...
}
