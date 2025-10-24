/* =======================================================================
   LED Backpack Animator v1.0 — app.js (complete + Animated Emoji)
   - Preview/edit toolbar
   - Background presets + solid + upload (PNG/JPG/GIF)
   - Centered canvas, fit/zoom
   - Words, lines, emojis (static OpenMoji) + animated Noto emoji (Lottie)
   - Manual drag, multi-select
   - Real-time animations with conflict warnings
   - Autosize (Word) + Autosize (Line)
   - GIF render (preview image + download in new tab) with frame-locked Lottie
   - Emoji picker (tabs, search), pinch/drag-handle resize
   - Undo/Redo covers typing/deletes/drag/emoji
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
const multiToggle=$("#multiToggle"), manualDragBtn=$("#manualDragToggle");
const addWordBtn=$("#addWordBtn"), addLineBtn=$("#addLineBtn"), delWordBtn=$("#deleteWordBtn");
const emojiBtn=$("#emojiBtn");

/* inspector: font/layout/anims */
const pillTabs=$$(".pill[data-acc]");  // pills
const accFont=$("#accFont"), accLayout=$("#accLayout"), accAnim=$("#accAnim");

const fontSelect=$("#fontSelect"), fontSizeInp=$("#fontSize");
const autoSizeWordChk=$("#autoSize");          // Autosize (Word)
const autoSizeLineChk=$("#autoSizePerLine");   // Autosize (Line) — HTML label
const fontColorInp=$("#fontColor"), addSwatchBtn=$("#addSwatchBtn"), textSwatches=$("#swatches");

const lineGapInp=$("#lineGap"), wordGapInp=$("#wordGap");
const alignBtns=$$("[data-align]"), valignBtns=$$("[data-valign]");

/* anims */
const animList=$("#animList");
const applySelBtn=$("#applySelectedAnimBtn"), applyAllBtn=$("#applyAllAnimBtn");

/* progress / preview */
const progressBar=$("#progress"), tCur=$("#tCur"), tEnd=$("#tEnd");

/* config + render */
const loadJsonInput=$("#loadJsonInput"), saveJsonBtn=$("#saveJsonBtn");
const fpsInp=$("#fps"), secondsInp=$("#seconds"), fileNameInp=$("#fileName");
const previewBtn=$("#previewRenderBtn"), gifBtn=$("#gifRenderBtn"), gifPreviewImg=$("#gifPreview");

/* about + info */
const aboutBtn=$("#aboutBtn"), aboutModal=$("#aboutModal"), aboutClose=$("#aboutClose");

/* ===== Emoji modal (Static + Animated tabs) ===== */
const emojiModal=$("#emojiModal"), emojiTabs=$("#emojiTabs");
/* Static */
const emojiGrid=$("#emojiGrid"), emojiSearch=$("#emojiSearch"), emojiClose=$("#emojiClose");
/* Animated (new) */
const emojiPaneStatic = $("#emojiPaneStatic");
const emojiPaneAnimated = $("#emojiPaneAnimated");
const aeSearch = $("#aeSearch");
const aeGrid   = $("#aeGrid");

/* ------------------ state ------------------ */
let mode="edit", zoom=1, selected=null;             // selected = {line, word}
let history=[], future=[];
let startT=0, rafId=null;
let RENDER_EXPORT = null; // {frameIndex, fps} used to lock Lottie frames during GIF export
const defaults={ font:"Orbitron", size:22, color:"#FFFFFF" };

const doc={
  version:"1.0",
  res:{ w:96, h:128 },
  bg:{ type:"preset", color:null, image:null, preset:"assets/presets/96x128/Preset_A.png" },
  spacing:{ lineGap:4, wordGap:6 }, style:{ align:"center", valign:"middle" },
  lines:[
    { words:[{text:"WILL",     color:"#67bfff", font:"Orbitron", size:22, anims:[{id:"colorcycle",params:{speed:0.55,start:"#67bfff",dur:2}}]}] },
    { words:[{text:"WHEELIE",  color:"#ffd95a", font:"Orbitron", size:22, anims:[{id:"colorcycle",params:{speed:0.55,start:"#ffd95a",dur:2}}]}] },
    { words:[{text:"FOR",      color:"#ff7bda", font:"Orbitron", size:22, anims:[{id:"colorcycle",params:{speed:0.55,start:"#ff7bda",dur:2}}]}] },
    { words:[{text:"BOOKTOK",  color:"#ffffff", font:"Orbitron", size:22, anims:[
      {id:"glow",params:{intensity:0.6}},
      {id:"wave",params:{ax:0.5,ay:0.7,cycles:1}},
      {id:"rainbow",params:{speed:0.6,start:"#ff00ff",dur:seconds()}},
      {id:"colorcycle",params:{speed:0.55,start:"#00ffd0",dur:2}}
    ]}] },
    { words:[{text:"GIRLIES",  color:"#ff6a6a", font:"Orbitron", size:22, anims:[{id:"colorcycle",params:{speed:0.55,start:"#ff6a6a",dur:2}}]}] }
  ],
  anims:[{id:"glow",params:{intensity:0.6}}],  // panel defaults
  multi:new Set()
};

/* ------------------ presets ------------------ */
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

/* ------------------ emoji db (Static OpenMoji) ------------------ */
let EMOJI_DB=null;                // {entries:[{id,name,category,path}], categories:[...]}
async function loadEmojiManifest(){
  if (EMOJI_DB) return EMOJI_DB;
  const r=await fetch("assets/openmoji/emoji_manifest.json");
  EMOJI_DB=await r.json();
  EMOJI_DB.categories = EMOJI_DB.categories || Array.from(new Set(EMOJI_DB.entries.map(e=>e.category)));
  return EMOJI_DB;
}

/* ------------------ misc ui helpers ------------------ */
function notify(msg){ console.log("[INFO]",msg); }
function warn(msg){ console.warn("[WARN]",msg); }

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
  tiles.forEach(t=>{
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
  const firstPreset=$(".bg-tile[data-kind='preset']",bgGrid); firstPreset&&firstPreset.classList.add("active");
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
   PILLS (only one visible; tap active closes)
======================================================= */
pillTabs.forEach(p=>{
  on(p,"click",()=>{
    const id=p.dataset.acc, target=$("#"+id);
    const wasOpen=target.open;
    [accFont,accLayout,accAnim].forEach(x=>x.open=false);
    pillTabs.forEach(x=>x.classList.remove("active"));
    if(!wasOpen){ target.open=true; p.classList.add("active"); }
  });
});

/* =======================================================
   TEXT/EMOJI MEASURE / AUTOSIZE
======================================================= */
const emojiCache=new Map(); // static (OpenMoji) images
function getEmojiImage(url){
  if(emojiCache.has(url)) return emojiCache.get(url);
  const img=new Image(); img.crossOrigin="anonymous"; img.decoding="async"; img.src=url;
  emojiCache.set(url,img); return img;
}
function isEmojiLike(w){ return !!(w?.emoji || w?.emojiAnimated); }
function measureText(w){
  if(isEmojiLike(w)){ return (w.size??24) * (w.scale??1); }
  ctx.font=`${w.size||defaults.size}px ${w.font||defaults.font}`;
  return ctx.measureText(w.text||"").width;
}
function lineHeight(line){
  const hs = line.words.map(w=> isEmojiLike(w) ? (w.size??24)*(w.scale??1) : (w.size||defaults.size));
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
          const base = isEmojiLike(w) ? (w.size??24)*(w.scale??1) : (test);
          if(!isEmojiLike(w)){
            ctx.font=`${test}px ${w.font||defaults.font}`;
            wsum += ctx.measureText(w.text||"").width + (doc.spacing.wordGap??6);
          }else{
            wsum += base + (doc.spacing.wordGap??6);
          }
        }
        if(wsum<=maxW){ line.words.forEach(w=>{ if(!isEmojiLike(w)) w.size=test; }); break; }
      }
    }else if (autoSizeWordChk?.checked){
      line.words.forEach(w=>{
        if (isEmojiLike(w)) return;
        for(let s=(w.size||defaults.size); s>=6; s--){
          ctx.font=`${s}px ${w.font||defaults.font}`;
          if (lineWidth(line)<=maxW){ w.size=s; break; }
        }
      });
    }
  });

  const wSel = selected ? doc.lines[selected.line]?.words[selected.word] : doc.lines[0]?.words[0];
  if (wSel && !isEmojiLike(wSel)) fontSizeInp.value=Math.round(wSel.size||defaults.size);
}

/* =======================================================
   ANIMATIONS
======================================================= */
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
function seconds(){ return Math.max(1,Math.min(60, parseInt(secondsInp?.value||"8",10))); }
function fps(){ return Math.max(1,Math.min(30, parseInt(fpsInp?.value||"15",10))); }
function colorToHue(hex){ const c=(hex||"#fff").replace("#",""); const r=parseInt(c.slice(0,2)||"ff",16)/255,g=parseInt(c.slice(2,4)||"ff",16)/255,b=parseInt(c.slice(4,6)||"ff",16)/255; const M=Math.max(r,g,b), m=Math.min(r,g,b); if(M===m) return 0; const d=M-m; let h=(M===r)?(g-b)/d+(g<b?6:0):(M===g)?(b-r)/d+2:(r-g)/d+4; return Math.round((h/6)*360); }
function easeOutCubic(x){ return 1-Math.pow(1-x,3); }

function resolveWordAnims(w){ return (w.anims && w.anims.length)? w.anims : (doc.anims||[]); }
function checkConflicts(anims){
  const ids=new Set(anims.map(a=>a.id));
  const conflicts=[];
  const pos=["slide","scroll","slideaway","zoom"]; const count=pos.filter(p=>ids.has(p)).length; if(count>1) conflicts.push("Multiple position animations (slide/scroll/zoom/slideaway)");
  if(ids.has("strobe") && ids.has("flicker")) conflicts.push("Strobe + Flicker");
  return conflicts;
}

function animatedProps(base, word, t, totalDur){
  const props={x:base.x,y:base.y,scale:1,alpha:1,text:word.text||"",color:word.color,dx:0,dy:0,shadow:null,gradient:null,perChar:null};
  const get=id=>resolveWordAnims(word).find(a=>a.id===id);
  const dur=(id)=>Math.max(0.05,(get(id)?.params?.dur ?? totalDur ?? seconds()));

  const sc=get("scroll"); if(sc){ const dir=sc.params.direction||"Left"; const sp=Number(sc.params.speed||1); const v=20*sp; if(dir==="Left")props.dx-=(t*v)%(doc.res.w+200); if(dir==="Right")props.dx+=(t*v)%(doc.res.w+200); if(dir==="Up")props.dy-=(t*v)%(doc.res.h+200); if(dir==="Down")props.dy+=(t*v)%(doc.res.h+200); }
  const zm=get("zoom"); if(zm){ const k=0.4*(Number(zm.params.speed||1)); const d=Math.min(1,t/dur("zoom")); props.scale*=(zm.params.direction==="Out")? Math.max(0.2,1-k*easeOutCubic(d)) : (1+k*easeOutCubic(d)); }
  const sl=get("slide"); if(sl){ const head=0.25*dur("slide"); const d=Math.min(1,t/head); const dist=((["Left","Right"].includes(sl.params.direction))?doc.res.w:doc.res.h)*0.6*(Number(sl.params.speed||1)); const s=1-easeOutCubic(d); const dir=sl.params.direction||"Left"; if(dir==="Left")props.dx-=dist*s; if(dir==="Right")props.dx+=dist*s; if(dir==="Up")props.dy-=dist*s; if(dir==="Down")props.dy+=dist*s; }
  const sw=get("slideaway"); if(sw && totalDur){ const tail=0.25*dur("slideaway"); if(t>totalDur-tail){ const d=(t-(totalDur-tail))/tail; const dist=((["Left","Right"].includes(sw.params.direction))?doc.res.w:doc.res.h)*0.6*(Number(sw.params.speed||1)); const s=easeOutCubic(d); const dir=sw.params.direction||"Left"; if(dir==="Left")props.dx-=dist*s; if(dir==="Right")props.dx+=dist*s; if(dir==="Up")props.dy-=dist*s; if(dir==="Down")props.dy+=dist*s; } }
  const fo=get("fadeout"); if(fo && totalDur){ const tail=0.25*dur("fadeout"); if(t>totalDur-tail){ const d=(t-(totalDur-tail))/tail; props.alpha*=Math.max(0,1-d); } }
  const pu=get("pulse"); if(pu){ const s=Number(pu.params.scale||0.03), vy=Number(pu.params.vy||4); props.scale*=1+Math.sin(t*2*Math.PI)*s; props.dy+=Math.sin(t*2*Math.PI)*vy; }
  const wv=get("wave"); if(wv){ const ax=Number(wv.params.ax||0.8), ay=Number(wv.params.ay||1.4), cyc=Number(wv.params.cycles||1); const ph=cyc*2*Math.PI*(t/dur("wave")); props.dx+=Math.sin(ph+base.x*0.05)*ax*4; props.dy+=Math.sin(ph+base.y*0.06)*ay*4; }
  const jit=get("jitter"); if(jit){ const a=Number(jit.params.amp||0.1), f=Number(jit.params.freq||2.5); props.dx+=Math.sin(t*2*Math.PI*f)*a*3; props.dy+=Math.cos(t*2*Math.PI*f)*a*3; }
  const shk=get("shake"); if(shk){ const a=Number(shk.params.amp||0.2)*5, f=Number(shk.params.freq||2); props.dx+=Math.sin(t*2*Math.PI*f)*a; props.dy+=Math.cos(t*2*Math.PI*f)*a*0.6; }
  const tw=get("typewriter"); if(tw && props.text){ const cps=10*Number(tw.params.rate||1); const shown=Math.min(props.text.length, Math.floor(t*cps)); props.text=props.text.slice(0,shown); }
  const scb=get("scramble"); if(scb && word.text){ const cps=10*Number(scb.params.rate||1), goal=word.text; let out=""; for(let i=0;i<goal.length;i++){ const revealAt=i/cps; if(t>=revealAt) out+=goal[i]; else{ const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"; out+=chars[Math.floor((t*20+i*3)%chars.length)]; } } props.text=out; }
  const pop=get("popcorn"); if(pop && word.text){ const rate=Number(pop.params.rate||1); props.perChar??={}; props.perChar.alpha=Array.from(word.text).map((_,i)=> (Math.sin(2*Math.PI*rate*t+i*0.4)>0)?1:0.25 ); }
  const cc=get("colorcycle"); if(cc){ const durC=dur("colorcycle"); const sp=Number(cc.params.speed||0.5); const base=colorToHue(cc.params.start||"#ff0000"); const h=((base + (t/durC)*360*sp)%360)|0; props.color=`hsl(${h}deg 100% 60%)`; }
  const rb=get("rainbow"); if(rb && (props.text||"").length){ const durR=dur("rainbow"); const speed=Number(rb.params.speed||0.6); const base=colorToHue(rb.params.start||"#ff00ff"); props.gradient={type:"rainbow",speed,base,loop:durR}; }
  const swp=get("sweep"); if(swp && (props.text||"").length){ const durS=dur("sweep"); props.gradient={type:"sweep",speed:Number(swp.params.speed||0.7),width:Number(swp.params.width||0.25),loop:durS}; }
  const fl=get("flicker"); if(fl){ const str=Math.max(0,Math.min(1,Number(fl.params.strength||0.5))); const n=(Math.sin(t*23.7)+Math.sin(t*17.3))*0.25+0.5; props.alpha*=(1-str*0.6)+n*str*0.6; }
  const st=get("strobe"); if(st){ const ph=Math.sin(2*Math.PI*Number(st.params.rate||3)*t); props.alpha*= (ph>0)?1:0.15; }
  const gl=get("glow"); if(gl){ const k=(Math.sin(t*2*Math.PI*1.2)*0.5+0.5)*Number(gl.params.intensity||0.6); props.shadow={blur:6+k*10,color:props.color||word.color}; }
  const rp=get("ripple"); if(rp && word.text){ const amp=Number(rp.params.amp||1)*2,fq=Number(rp.params.freq||2); props.perChar??={}; props.perChar.dy=Array.from(word.text).map((_,i)=>Math.sin(2*Math.PI*fq*t+i*0.6)*amp); }
  return props;
}

/* =======================================================
   RENDER (async for Animated Emoji)
======================================================= */
async function render(t=0,totalDur=seconds()){
  const W=canvas.width=doc.res.w, H=canvas.height=doc.res.h;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=(doc.bg?.type==="solid" ? (doc.bg.color||"#000") : "#000"); ctx.fillRect(0,0,W,H);

  // preset/image (gif animates independently)
  if(doc.bg?.image){ try{ ctx.drawImage(doc.bg.image,0,0,W,H); }catch{} }
  else if(doc.bg?.preset && !doc.bg.image){
    const im=new Image(); im.crossOrigin="anonymous"; im.src=doc.bg.preset;
    im.onload=()=>{ doc.bg.image=im; render(t,totalDur); };
  }

  autoSizeAllIfOn();

  const lg=doc.spacing.lineGap??4, wg=doc.spacing.wordGap??6;
  const heights=doc.lines.map(lineHeight);
  const contentH=heights.reduce((s,h)=>s+h,0)+(doc.lines.length-1)*lg;
  let yBase;
  if(doc.style.valign==="top") yBase=4;
  else if(doc.style.valign==="bottom") yBase=H-contentH-4;
  else yBase=(H-contentH)/2;

  for (let li=0; li<doc.lines.length; li++){
    const line=doc.lines[li];
    const lh=heights[li], wLine=lineWidth(line);
    let xBase;
    if(doc.style.align==="left") xBase=4;
    else if(doc.style.align==="right") xBase=W-wLine-4;
    else xBase=(W-wLine)/2;

    let x=xBase, y=yBase+lh*0.85;

    for (let wi=0; wi<line.words.length; wi++){
      const w=line.words[wi];
      const base={x,y};
      const props=animatedProps(base,w,t,totalDur);
      const fx=Number(w.fx||0), fy=Number(w.fy||0);

      /* -------- Animated Emoji branch -------- */
      if (w.emojiAnimated){
        const box=(w.size??24)*(w.scale??1)*(props.scale||1);
        const drawX=base.x+(props.dx||0)+fx;
        const drawY=base.y+(props.dy||0)+fy;
        const topY=drawY-box;

        // draw via AnimatedEmoji helper (preview vs export)
        const el = { codepoint:w.codepoint, x:drawX, y:topY, w:box, h:box, speed:w.speed||1 };
        try{
          if (RENDER_EXPORT){
            await AnimatedEmoji.drawAtFrame(ctx, el, RENDER_EXPORT.frameIndex, RENDER_EXPORT.fps);
          } else {
            await AnimatedEmoji.draw(ctx, el);
          }
        }catch(e){ /* swallow draw errors until asset loads */ }

        // selection overlay
        const key=`${li}:${wi}`;
        if(doc.multi.has(key) || (selected && selected.line===li && selected.word===wi && mode==="edit")){
          ctx.save(); ctx.setLineDash([3,2]); ctx.lineWidth=1; ctx.strokeStyle=doc.multi.has(key)?"rgba(0,255,255,0.95)":"rgba(255,0,255,0.95)";
          ctx.strokeRect(drawX-2, topY-2, box+4, box+4);
          const h=8; ctx.setLineDash([]); ctx.fillStyle="#8d79ff"; ctx.strokeStyle="rgba(0,0,0,0.55)"; ctx.lineWidth=1;
          ctx.fillRect(drawX+box-h, topY+box-h, h, h); ctx.strokeRect(drawX+box-h, topY+box-h, h, h);
          ctx.restore();
        }
        x+= (w.size??24)*(w.scale??1) + wg;
        continue;
      }

      /* -------- Static Emoji branch -------- */
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
        const key=`${li}:${wi}`;
        if(doc.multi.has(key) || (selected && selected.line===li && selected.word===wi && mode==="edit")){
          ctx.save(); ctx.setLineDash([3,2]); ctx.lineWidth=1; ctx.strokeStyle=doc.multi.has(key)?"rgba(0,255,255,0.95)":"rgba(255,0,255,0.95)"; ctx.strokeRect(drawX-2, topY-2, box+4, box+4);
          const h=8; ctx.setLineDash([]); ctx.fillStyle="#8d79ff"; ctx.strokeStyle="rgba(0,0,0,0.55)"; ctx.lineWidth=1; ctx.fillRect(drawX+box-h, topY+box-h, h, h); ctx.strokeRect(drawX+box-h, topY+box-h, h, h);
          ctx.restore();
        }
        x+= (w.size??24)*(w.scale??1) + wg;
        continue;
      }

      /* -------- Text branch -------- */
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
          for(let i=0;i<=6;i++){ const stop=i/6, h=Math.floor((baseHue+stop*360)%360); g.addColorStop(stop,`hsl(${h}deg 100% 60%)`); }
          fillStyle=g;
        } else if(props.gradient.type==="sweep"){
          const band=Math.max(0.05,Math.min(0.8,props.gradient.width||0.25));
          const pos=((t/props.gradient.loop)*props.gradient.speed)%1;
          const g=ctx.createLinearGradient(drawX,drawY,drawX+ww,drawY);
          const a=Math.max(0,pos-band/2), b=Math.min(1,pos+band/2);
          g.addColorStop(0,fillStyle); g.addColorStop(a,fillStyle); g.addColorStop(pos,"#FFFFFF");
          g.addColorStop(b,fillStyle); g.addColorStop(1,fillStyle); fillStyle=g;
        }
      }
      ctx.fillStyle=fillStyle;

      if(props.perChar && txt.length){
        const widths=Array.from(txt).map(ch=>{ ctx.font=`${fsize}px ${w.font||defaults.font}`; return Math.ceil(ctx.measureText(ch).width); });
        let cx=drawX;
        for(let i=0;i<txt.length;i++){
          const ch=txt[i], dy=props.perChar.dy?.[i]||0, oa=ctx.globalAlpha;
          ctx.globalAlpha=oa*(props.perChar.alpha?.[i] ?? 1);
          ctx.fillText(ch, cx, drawY+dy);
          ctx.globalAlpha=oa; cx+=widths[i];
        }
      }else{
        ctx.fillText(txt, drawX, drawY);
      }

      const selKey=`${li}:${wi}`;
      const ww=ctx.measureText(w.text||"").width;
      if(doc.multi.has(selKey) || (selected && selected.line===li && selected.word===wi && mode==="edit")){
        ctx.save(); ctx.setLineDash([3,2]); ctx.lineWidth=1;
        ctx.strokeStyle=doc.multi.has(selKey)?"rgba(0,255,255,0.95)":"rgba(255,0,255,0.95)";
        ctx.strokeRect(drawX-2, (drawY)-lh, ww+4, lh+4); ctx.restore();
      }
      ctx.restore();

      x+= measureText(w) + wg;
    }

    yBase+= lh + lg;
  }

  if(selected){
    const w=doc.lines[selected.line]?.words[selected.word];
    if(w){ const conf=checkConflicts(resolveWordAnims(w)); if(conf.length) warn("Animation conflicts: "+conf.join(", ")); }
  }
}

/* =======================================================
   SELECTION / INPUT / DRAG / RESIZE
======================================================= */
function keyOf(li,wi){ return `${li}:${wi}`; }
function forEachSelectedWord(fn){
  if(doc.multi.size){
    doc.multi.forEach(k=>{ const [li,wi]=k.split(":").map(Number); const w=doc.lines[li]?.words[wi]; if(w) fn(w,li,wi); });
  }else if(selected){ const w=doc.lines[selected.line]?.words[selected.word]; if(w) fn(w,selected.line,selected.word); }
}
function hitTestWord(px,py){
  const lg=doc.spacing.lineGap??4, heights=doc.lines.map(lineHeight);
  const contentH=heights.reduce((s,h)=>s+h,0)+(doc.lines.length-1)*lg;
  let y; if(doc.style.valign==="top") y=4; else if(doc.style.valign==="bottom") y=doc.res.h-contentH-4; else y=(doc.res.h-contentH)/2;

  for(let li=0; li<doc.lines.length; li++){
    const lh=heights[li], wLine=lineWidth(doc.lines[li]);
    let x; if(doc.style.align==="left") x=4; else if(doc.style.align==="right") x=doc.res.w-wLine-4; else x=(doc.res.w-wLine)/2;

    for(let wi=0; wi<doc.lines[li].words.length; wi++){
      const w=doc.lines[li].words[wi];
      const treatEmoji = isEmojiLike(w);
      const ww=treatEmoji ? ((w.size??24)*(w.scale??1)) : measureText(w);
      const fx=Number(w.fx||0), fy=Number(w.fy||0);
      const by=(treatEmoji ? (y+lh*0.85 - ww) : (y+lh*0.85 - lh)) + fy;
      const bx=x-2+fx, bw=ww+4, bh=treatEmoji ? ww : (lh+4);
      if(px>=bx && px<=bx+bw && py>=by && py<=by+bh) return {line:li, word:wi, isEmoji:treatEmoji};
      x+= ww + (doc.spacing.wordGap??6);
    }
    y+= lh + lg;
  }
  return null;
}

/* history helpers */
const snapshot=()=>JSON.parse(JSON.stringify(doc));
function pushHistory(){ history.push(snapshot()); if(history.length>200) history.shift(); future.length=0; }

on(canvas,"click",(e)=>{
  if(mode!=="edit") return;
  const r=canvas.getBoundingClientRect(), px=(e.clientX-r.left)/zoom, py=(e.clientY-r.top)/zoom;
  const hit=hitTestWord(px,py);
  if(hit){
    const k=keyOf(hit.line,hit.word);
    if(e.shiftKey){ if(doc.multi.has(k)) doc.multi.delete(k); else doc.multi.add(k); selected=hit; }
    else { doc.multi.clear(); selected=hit; }
    buildAnimationsUI(); render();
  }else{ doc.multi.clear(); selected=null; render(); }
});

/* typing */
document.addEventListener("keydown",(e)=>{
  if(mode!=="edit") return;
  const targets = doc.multi.size ? Array.from(doc.multi).map(k=>k.split(":").map(Number)) : (selected?[[selected.line,selected.word]]:[]);
  if(!targets.length) return;

  if(e.key.length===1 && !e.metaKey && !e.ctrlKey){
    e.preventDefault(); pushHistory();
    targets.forEach(([li,wi])=>{ const w=doc.lines[li]?.words[wi]; if(w && !isEmojiLike(w)) w.text=(w.text||"")+e.key; });
    autoSizeAllIfOn(); render();
  } else if(e.key==="Backspace"){
    e.preventDefault(); pushHistory();
    targets.forEach(([li,wi])=>{ const w=doc.lines[li]?.words[wi]; if(w && !isEmojiLike(w)) w.text=(w.text||"").slice(0,-1); });
    autoSizeAllIfOn(); render();
  }
});

/* add / line / delete */
on(addWordBtn,"click",()=>{ pushHistory(); const li=doc.lines.length? (selected?selected.line:doc.lines.length-1):0; doc.lines[li]??={words:[]}; doc.lines[li].words.push({text:"NEW",font:defaults.font,size:defaults.size,color:defaults.color,anims:[]}); selected={line:li,word:doc.lines[li].words.length-1}; render(); });
on(addLineBtn,"click",()=>{ pushHistory(); doc.lines.push({words:[{text:"LINE",font:defaults.font,size:defaults.size,color:defaults.color,anims:[]}]}); selected={line:doc.lines.length-1,word:0}; render(); });
on(delWordBtn,"click",()=>{ if(!selected) return; pushHistory(); const L=doc.lines[selected.line]; L.words.splice(selected.word,1); if(!L.words.length) doc.lines.splice(selected.line,1); doc.multi.clear(); selected=null; render(); });

/* font / size / color / autosize */
on(fontSelect,"change",()=>{ pushHistory(); forEachSelectedWord(w=>w.font=fontSelect.value||defaults.font); autoSizeAllIfOn(); render(); });
on(fontSizeInp,"input",()=>{ const v=Math.max(6,Math.min(64,parseInt(fontSizeInp.value||`${defaults.size}`,10))); pushHistory(); forEachSelectedWord(w=>{ if(!isEmojiLike(w)) w.size=v; else w.size=v; }); render(); });
on(fontColorInp,"input",()=>{ const c=fontColorInp.value||defaults.color; pushHistory(); forEachSelectedWord(w=>{ if(!isEmojiLike(w)) w.color=c; }); render(); });
on(autoSizeWordChk,"change",()=>{ autoSizeAllIfOn(); render(); });
on(autoSizeLineChk,"change",()=>{ autoSizeAllIfOn(); render(); });

/* spacing & alignment */
on(lineGapInp,"input",()=>{ doc.spacing.lineGap=Math.max(0,Math.min(40,parseInt(lineGapInp.value||"4",10))); autoSizeAllIfOn(); render(); });
on(wordGapInp,"input",()=>{ doc.spacing.wordGap=Math.max(0,Math.min(40,parseInt(wordGapInp.value||"6",10))); autoSizeAllIfOn(); render(); });
alignBtns.forEach(b=>on(b,"click",()=>{ if(b.disabled) return; alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); doc.style.align=b.dataset.align||"center"; render(); }));
valignBtns.forEach(b=>on(b,"click",()=>{ if(b.disabled) return; valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); doc.style.valign=b.dataset.valign||"middle"; render(); }));

/* multi toggle (visual) */
on(multiToggle,"click",()=> multiToggle.classList.toggle("active"));

/* manual drag toggle */
const manualDrag={enabled:false,active:false,startX:0,startY:0,targets:[],startOffsets:[]};
on(manualDragBtn,"click",()=>{
  manualDrag.enabled=!manualDrag.enabled; manualDragBtn.classList.toggle("active",manualDrag.enabled);
  document.querySelectorAll("[data-align],[data-valign]").forEach(b=>{ b.disabled=manualDrag.enabled; b.classList.toggle("disabled",manualDrag.enabled); });
});

/* temp drag with Cmd/Ctrl or manual toggle */
on(canvas,"pointerdown",(e)=>{
  const rect=canvas.getBoundingClientRect(); const px=(e.clientX-rect.left)/zoom, py=(e.clientY-rect.top)/zoom;
  const willDrag = manualDrag.enabled || e.ctrlKey || e.metaKey;
  if(!willDrag) return;
  const pick=hitTestWord(px,py);
  if(!selected && !doc.multi.size && pick) selected={line:pick.line,word:pick.word};

  const targets=doc.multi.size? Array.from(doc.multi).map(k=>k.split(":").map(Number)) : (selected?[[selected.line,selected.word]]:[]);
  if(!targets.length) return;

  manualDrag.active=true; manualDrag.startX=e.clientX; manualDrag.startY=e.clientY; manualDrag.targets=targets;
  manualDrag.startOffsets=targets.map(([li,wi])=>{ const w=doc.lines[li]?.words[wi]; return {fx:Number(w?.fx||0), fy:Number(w?.fy||0)}; });
  canvas.setPointerCapture(e.pointerId); e.preventDefault();
});
on(window,"pointermove",(e)=>{
  if(!manualDrag.active) return;
  const dx=(e.clientX-manualDrag.startX)/zoom, dy=(e.clientY-manualDrag.startY)/zoom;
  manualDrag.targets.forEach(([li,wi],i)=>{ const w=doc.lines[li]?.words[wi]; if(!w) return; const start=manualDrag.startOffsets[i]; w.fx=start.fx+dx; w.fy=start.fy+dy; });
  render(mode==="preview"?((performance.now()-startT)/1000)%seconds():0);
});
on(window,"pointerup",(e)=>{
  if(!manualDrag.active) return;
  manualDrag.active=false; manualDrag.targets=[]; manualDrag.startOffsets=[];
  try{ canvas.releasePointerCapture(e.pointerId); }catch{}
  pushHistory();
});

/* =======================================================
   ANIMATIONS UI
======================================================= */
function cloneAnims(src){ return src.map(a=>({id:a.id, params:{...a.params}})); }
function buildAnimationsUI(){
  animList.innerHTML="";
  ANIMS.forEach(def=>{
    const row=document.createElement("div"); row.className="anim-row";
    const left=document.createElement("div"); left.className="anim-left";

    const chk=document.createElement("input"); chk.type="checkbox"; chk.id=`anim_${def.id}`;
    let editPack = doc.anims;
    if(selected){ const w=doc.lines[selected.line]?.words[selected.word]; if(w?.anims) editPack=w.anims; }
    chk.checked=!!editPack.find(a=>a.id===def.id);

    const lbl=document.createElement("label"); lbl.setAttribute("for",chk.id); lbl.textContent=def.name;
    const gear=document.createElement("button"); gear.type="button"; gear.className="gear"; gear.title="Settings"; gear.textContent="⚙";

    left.appendChild(chk); left.appendChild(lbl); left.appendChild(gear);
    const params=document.createElement("div"); params.className="anim-params"; params.style.display=chk.checked?"grid":"none";

    const cur = (editPack.find(a=>a.id===def.id)?.params) || def.params;
    Object.entries(def.params).forEach(([k,v])=>{
      const p=document.createElement("div"); p.className="p";
      const la=document.createElement("label"); la.textContent=k==="dur"?"Duration (s)": k[0].toUpperCase()+k.slice(1);
      let inp;
      if(k==="direction"){ inp=document.createElement("select"); (def.id==="zoom"?["In","Out"]:["Left","Right","Up","Down"]).forEach(op=>{ const o=document.createElement("option"); o.value=op; o.textContent=op; if((cur[k]??v)===op) o.selected=true; inp.appendChild(o); }); }
      else if(k==="start"){ inp=document.createElement("input"); inp.type="color"; inp.value=cur[k]??v; }
      else { inp=document.createElement("input"); inp.type="number"; inp.step=(k==="dur"||k==="speed"||k==="width"||k==="amp"||k==="freq"||k==="scale")?"0.1":"1"; inp.value=cur[k]??v; }
      p.appendChild(la); p.appendChild(inp); params.appendChild(p);

      on(inp,"input",()=>{
        let targetPack = doc.anims;
        if(selected){ const w=doc.lines[selected.line]?.words[selected.word]; if(w?.anims) targetPack=w.anims; }
        const a=targetPack.find(x=>x.id===def.id); if(a) a.params[k] = (inp.type==="number")? +inp.value : inp.value;
        if(mode==="preview") startPreview(); else render();
      });
    });

    on(chk,"change",()=>{
      let targetPack=doc.anims;
      if(selected){ const w=doc.lines[selected.line]?.words[selected.word]; w.anims ??=[]; targetPack=w.anims; }
      const has=!!targetPack.find(a=>a.id===def.id);
      if(chk.checked && !has){ targetPack.push({id:def.id, params:{...def.params}}); params.style.display="grid"; }
      else if(!chk.checked && has){ targetPack.splice(targetPack.findIndex(a=>a.id===def.id),1); params.style.display="none"; }
      if(mode==="preview") startPreview(); else render();
    });
    on(gear,"click",()=> params.style.display = params.style.display==="none" ? "grid" : "none");

    row.appendChild(left); row.appendChild(params); animList.appendChild(row);
  });

  on(applySelBtn,"click",()=>{ if(!selected && !doc.multi.size) return;
    const pack = cloneAnims(doc.anims);
    if(doc.multi.size){ doc.multi.forEach(k=>{ const [li,wi]=k.split(":").map(Number); const w=doc.lines[li]?.words[wi]; if(w) w.anims=cloneAnims(pack); }); }
    else { const w=doc.lines[selected.line]?.words[selected.word]; if(w) w.anims=cloneAnims(pack); }
    render();
  });
  on(applyAllBtn,"click",()=>{ const pack=cloneAnims(doc.anims); doc.lines.forEach(line=>line.words.forEach(w=>w.anims=cloneAnims(pack))); render(); });
}

/* =======================================================
   PREVIEW LOOP / GIF RENDER
======================================================= */
function startPreview(){
  stopPreview(0,true); startT=performance.now(); const dur=seconds(); if(tEnd) tEnd.textContent=`${dur.toFixed(1)}s`;
  function loop(now){ const s=(now-startT)/1000, tt=s%dur; render(tt,dur); if(progressBar) progressBar.style.setProperty("--p", (tt/dur)); if(tCur) tCur.textContent=`${tt.toFixed(1)}s`; rafId=requestAnimationFrame(loop); }
  rafId=requestAnimationFrame(loop);
}
function stopPreview(t=0,keepProgress=false){ if(rafId) cancelAnimationFrame(rafId); rafId=null; render(t,seconds()); if(!keepProgress && progressBar) progressBar.style.setProperty("--p","0"); }

function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=()=>res(true); s.onerror=rej; document.head.appendChild(s); }); }
async function ensureGifLibs(){
  if(typeof GIFEncoder!=="undefined") return true;
  try{
    await loadScript("assets/libs/jsgif/NeuQuant.js");
    await loadScript("assets/libs/jsgif/LZWEncoder.js");
    await loadScript("assets/libs/jsgif/GIFEncoder.js");
    return typeof GIFEncoder!=="undefined";
  }catch{ warn("GIF libs missing"); return false; }
}
function encoderBlob(enc){ const bytes=enc.stream().bin||enc.stream().getData(); return new Blob([bytes instanceof Uint8Array?bytes:new Uint8Array(bytes)],{type:"image/gif"}); }

async function renderGif(){
  const ok=await ensureGifLibs(); if(!ok) return;
  const F=fps(), S=seconds(), frames=Math.max(1,Math.floor(F*S)), delay=Math.max(1,Math.round(1000/F));
  const resume=(mode==="preview"); stopPreview();

  const W=canvas.width=doc.res.w, H=canvas.height=doc.res.h;
  const enc=new GIFEncoder(); enc.setRepeat(0); enc.setDelay(delay); enc.setQuality(10); enc.setSize(W,H); enc.start();
  for(let i=0;i<frames;i++){
    const t=i/F;
    RENDER_EXPORT = { frameIndex:i, fps:F };          // lock Lottie to exact frame
    await render(t,S);
    RENDER_EXPORT = null;

    enc.addFrame(ctx);
    if(progressBar) progressBar.style.setProperty("--p",(t/S)%1);
    if(tCur) tCur.textContent=`${(t%S).toFixed(1)}s`;
  }
  enc.finish();
  const blob=encoderBlob(enc); const url=URL.createObjectURL(blob);

  if(gifPreviewImg){ gifPreviewImg.classList.remove("hidden"); gifPreviewImg.src=url; gifPreviewImg.alt="Preview GIF"; }

  const a=document.createElement("a");
  a.href=url; a.download=`${(fileNameInp?.value||"animation").replace(/\.(gif|png|jpe?g|webp)$/i,"")}.gif`;
  a.target="_blank"; a.rel="noopener"; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),15000);

  if(resume) startPreview();
}
on(previewBtn,"click",()=>{ setMode("preview"); if(gifPreviewImg){ gifPreviewImg.src=""; gifPreviewImg.classList.add("hidden"); } });
on(gifBtn,"click",renderGif);
[fpsInp, secondsInp].forEach(inp=> on(inp,"input",()=>{ if(mode==="preview") startPreview(); if(tEnd) tEnd.textContent=`${seconds().toFixed(1)}s`; }));

/* =======================================================
   RESOLUTION / UNDO / REDO / CLEAR
======================================================= */
on(resSel,"change",()=>{
  const [w,h]=resSel.value.split("x").map(Number); doc.res={w,h};
  buildBgGrid(); showSolidTools(doc.bg?.type==="solid"); render(); fitZoom();
});
on(undoBtn,"click",()=>{ if(!history.length) return; future.push(snapshot()); const last=history.pop(); Object.assign(doc,last); render(); });
on(redoBtn,"click",()=>{ if(!future.length) return; history.push(snapshot()); const next=future.pop(); Object.assign(doc,next); render(); });
on(clearAllBtn,"click",()=>{ pushHistory(); doc.lines=[{words:[{text:"NEW",font:defaults.font,size:defaults.size,color:defaults.color,anims:[]}]}]; doc.multi.clear(); selected={line:0,word:0}; render(); });

/* =======================================================
   CONFIG SAVE / LOAD
======================================================= */
on(saveJsonBtn,"click",()=>{
  const data=snapshot();
  if(data.bg?.image && data.bg.type==="image"){
    try{ const c=document.createElement("canvas"); c.width=doc.res.w; c.height=doc.res.h; const c2=c.getContext("2d"); c2.drawImage(doc.bg.image,0,0,c.width,c.height); data.bg.dataURL=c.toDataURL("image/png"); }catch{}
  }
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="led_anim_config.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
});
on(loadJsonInput,"change",async(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const txt=await f.text(); const obj=JSON.parse(txt);
    Object.assign(doc,obj);
    if(obj.bg?.dataURL){ const im=new Image(); im.src=obj.bg.dataURL; im.onload=()=>{ doc.bg.image=im; render(); }; }
    buildBgGrid(); render(); fitZoom();
  }catch{ warn("Invalid config"); }
});

/* =======================================================
   ABOUT
======================================================= */
on(aboutBtn,"click",()=> aboutModal?.classList.remove("hidden"));
on(aboutClose,"click",()=> aboutModal?.classList.add("hidden"));

/* =======================================================
   EMOJI PICKER — Static (OpenMoji) + Animated (Noto)
======================================================= */
/* ---- Tabs (Static | Animated) ---- */
function setEmojiTab(tab){ // 'static' | 'animated'
  const btns = $$("#emojiTabs .tab-btn");
  btns.forEach(b=> b.classList.toggle("active", b.dataset.tab===tab));
  if (emojiPaneStatic)   emojiPaneStatic.classList.toggle("hidden", tab!=="static");
  if (emojiPaneAnimated) emojiPaneAnimated.classList.toggle("hidden", tab!=="animated");
  if (tab==="animated") refreshAE();
}
on(emojiTabs, "click", (e)=>{
  const b=e.target.closest(".tab-btn"); if(!b) return;
  setEmojiTab(b.dataset.tab);
});

on(emojiBtn,"click",async ()=>{
  // default to Static tab when opening
  setEmojiTab("static");
  const db=await loadEmojiManifest();
  buildEmojiTabs(db.categories);
  emojiSearch.value=""; filterEmoji();
  emojiModal.classList.remove("hidden");
});
on(emojiClose,"click",()=>emojiModal.classList.add("hidden"));

/* ---- Static tab ---- */
function buildEmojiTabs(cats){
  // build if empty or rebuild — keep your existing 'chip' style for static categories
  const hasChips = $$(".chip", emojiTabs).length>0;
  if (hasChips) return; // already built once
  cats.forEach((c,i)=>{
    const b=document.createElement("button");
    b.className=`chip ${i===0?"active":""}`; b.textContent=c;
    b.onclick=()=>{ $$(".chip",emojiTabs).forEach(x=>x.classList.remove("active")); b.classList.add("active"); filterEmoji(); };
    emojiTabs.appendChild(b);
  });
}
function renderEmojiGrid(list){
  emojiGrid.innerHTML="";
  const frag=document.createDocumentFragment();
  list.forEach(e=>{
    const item=document.createElement("button"); item.className="emoji-item"; item.title=e.name;
    const img=document.createElement("img"); img.alt=e.name; img.loading="lazy"; img.src=e.path;
    item.appendChild(img);
    item.onclick=()=>{ insertStaticEmoji(e); emojiModal.classList.add("hidden"); };
    frag.appendChild(item);
  });
  emojiGrid.appendChild(frag);
}
function filterEmoji(){
  if(!EMOJI_DB) return;
  const activeCat = $(".chip.active",emojiTabs)?.textContent;
  const q=(emojiSearch.value||"").toLowerCase().trim();
  const list = EMOJI_DB.entries.filter(e=>{
    const hitCat = activeCat? e.category===activeCat : true;
    const hitQ = q? (e.name.toLowerCase().includes(q) || e.id.includes(q)) : true;
    return hitCat && hitQ;
  });
  renderEmojiGrid(list.slice(0,1200));
}
on(emojiSearch,"input",filterEmoji);

/* ---- Insertions ---- */
function insertStaticEmoji(entry){
  pushHistory();
  const li = selected? selected.line : (doc.lines.length? doc.lines.length-1 : 0);
  doc.lines[li] ??= {words:[]};
  const w = { emoji:true, src:entry.path, size:24, scale:1, fx:0, fy:0, anims:[] };
  doc.lines[li].words.push(w);
  selected={line:li,word:doc.lines[li].words.length-1};
  render();
}

/* ---- Animated tab (Noto / Lottie) ---- */
function renderAEGrid(list){
  aeGrid.innerHTML="";
  const frag=document.createDocumentFragment();
  list.forEach(e=>{
    const btn=document.createElement("button");
    btn.className="emoji-item";
    btn.title=`${e.name} (${e.cp})`;
    btn.textContent = e.ch || "🙂";
    btn.onclick=()=> addAnimatedEmojiToLine(e);
    frag.appendChild(btn);
  });
  aeGrid.appendChild(frag);
}
function refreshAE(){
  if (!window.AnimatedEmoji) return;
  const list = AnimatedEmoji.filterIndex(aeSearch?.value||"");
  renderAEGrid(list);
}
on(aeSearch,"input",refreshAE);

function addAnimatedEmojiToLine(entry){
  pushHistory();
  const li = selected? selected.line : (doc.lines.length? doc.lines.length-1 : 0);
  doc.lines[li] ??= {words:[]};
  const sz = doc.res.w===96 ? 28 : 20;
  const w = {
    emojiAnimated:true,
    codepoint: entry.cp,
    name: entry.name,
    size: sz, scale:1,
    speed: 1.0,
    fx:0, fy:0,
    anims:[]
  };
  doc.lines[li].words.push(w);
  selected={line:li,word:doc.lines[li].words.length-1};
  render();
}

/* =======================================================
   INIT
======================================================= */
function init(){
  // init AnimatedEmoji helper if present (safe if script not loaded)
  if (window.AnimatedEmoji && typeof AnimatedEmoji.init==="function"){
    AnimatedEmoji.init({ useLocal:false }); // flip to true if you bundle JSON under /assets/noto/<cp>/lottie.json
  }

  buildBgGrid(); rebuildTextSwatches(); rebuildBgSwatches();
  render(); fitZoom();

  autoSizeWordChk.checked = true;     // Autosize (Word)
  if (autoSizeLineChk) autoSizeLineChk.checked = true; // if present in HTML
  autoSizeAllIfOn(); render();

  setMode("edit");
}
init();
