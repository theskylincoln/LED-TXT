/* LED Backpack Animator — full build with requested fixes
 * - Presets by res: 96x128 => A,B (default A); 64x64 => C,D (default C); others => solid black
 * - Inspector = horizontal toolbar; opens below
 * - Canvas auto-fit, centered; visible edge; re-fit on resize/orientation/inspector/preset
 * - Selection box: glowing magenta dotted; X pinned to top-right
 * - Blank canvas: Enter/Space create first word; always open keyboard
 * - Animation conflict warnings
 * - GIF export: robust loader (jsDelivr → unpkg)
 */

const $ = (q, el=document)=>el.querySelector(q);
const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));

/* -------- Robust GIF loader -------- */
async function loadScript(src){
  return new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src=src; s.async=true; s.crossOrigin="anonymous";
    s.onload=()=>res(true); s.onerror=()=>rej(new Error("load fail "+src));
    document.head.appendChild(s);
  });
}
async function ensureGifLibs(){
  if (typeof GIFEncoder!=="undefined") return true;
  const groups = [
    [
      "https://cdn.jsdelivr.net/npm/jsgif@0.2.1/NeuQuant.js",
      "https://cdn.jsdelivr.net/npm/jsgif@0.2.1/LZWEncoder.js",
      "https://cdn.jsdelivr.net/npm/jsgif@0.2.1/GIFEncoder.js",
    ],
    [
      "https://unpkg.com/jsgif@0.2.1/NeuQuant.js",
      "https://unpkg.com/jsgif@0.2.1/LZWEncoder.js",
      "https://unpkg.com/jsgif@0.2.1/GIFEncoder.js",
    ],
  ];
  for (const g of groups){
    try{ for (const u of g) await loadScript(u); }catch(e){}
    if (typeof GIFEncoder!=="undefined") return true;
  }
  return false;
}

/* -------- DOM refs -------- */
const canvas = $("#led");
const ctx = canvas.getContext("2d");
const wrap = $(".canvas-wrap");

const modeEditBtn = $("#modeEdit");
const modePrevBtn = $("#modePreview");
const zoomSlider = $("#zoom");
const fitBtn = $("#fitBtn");

const resSel = $("#resSelect");
const addWordBtn = $("#addWordBtn");
const addLineBtn = $("#addLineBtn");
const deleteWordFx = $("#deleteWordBtn");

const undoBtn = $("#undoBtn");
const redoBtn = $("#redoBtn");
const clearBtn = $("#clearAllBtn");
const clearWarn = $("#clearWarn");
const clearCancel = $("#clearCancel");
const clearConfirm = $("#clearConfirm");
const suppressClearWarn = $("#suppressClearWarn");

const mobileInput = $("#mobileInput");

const inspectorToggle = $("#toggleInspector");
const inspectorBody = $("#inspectorBody");
const toolbarTabs = $$(".toolbar .tab");
const accs = [$("#accFont"), $("#accLayout"), $("#accAnim")];

// Font/spacing
const fontSel = $("#fontSelect");
const fontSizeInput = $("#fontSize");
const autoSizeChk = $("#autoSize");
const fontColorInput = $("#fontColor");
const lineGapInput = $("#lineGap");
const wordGapInput = $("#wordGap");
const alignBtns = $$("[data-align]");
const valignBtns = $$("[data-valign]");
const applyAllAlign = $("#applyAllAlign");
const manualDragChk = $("#manualDragChk");

// Swatches
const swatchesWrap = $("#swatches");
const addSwatchBtn = $("#addSwatchBtn");
const clearSwatchesBtn = $("#clearSwatchesBtn");

// Backgrounds
const bgThumbs = $("#bgThumbs");
const bgSolidBtn = $("#bgSolidBtn");
const bgSolidColor = $("#bgSolidColor");
const bgUpload = $("#bgUpload");
const bgSwatches = $("#bgSwatches");
const addBgSwatchBtn = $("#addBgSwatchBtn");

// Config/Render
const saveJsonBtn = $("#saveJsonBtn");
const loadJsonInput = $("#loadJsonInput");
const fpsInput = $("#fps");
const secInput = $("#seconds");
const fileNameInput = $("#fileName");
const downloadGifBtn = $("#downloadGifBtn");

// Animations UI
const animList = $("#animList");
const animHelpBtn = $("#animHelpBtn");
const aboutBtn = $("#aboutBtn");
const aboutModal = $("#aboutModal");
$("#aboutClose")?.addEventListener("click", ()=> aboutModal.classList.add("hidden"));
aboutBtn?.addEventListener("click", ()=> aboutModal.classList.remove("hidden"));

/* -------- State -------- */
let mode = "edit";
let zoom = parseFloat(zoomSlider.value || "0.8");
let history = [];
let future = [];
const MAX_STACK = 100;

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

// Start blank (one empty word) so Enter/Space create correctly
let doc = {
  res: { w: 96, h: 128 },
  lines: [{ words: [{ text: "", style: {} }], offsetY: 0 }],
  style: { ...defaults },
  bg: { type: "solid", color: "#000000", image: null, preset: null },
  animations: [], // {id, params}
};

let selected = { line: 0, word: 0, caret: 0 };
let showClearWarn = true;

/* -------- Presets by resolution -------- */
const PRESET_MAP = {
  "96x128": [
    "repo/assets/thumbs/Preset_A_96x128_thumb.png",
    "repo/assets/thumbs/Preset_B_96x128_thumb.png",
  ],
  "64x64": [
    "repo/assets/thumbs/Preset_C_64x64_thumb.png",
    "repo/assets/thumbs/Preset_D_64x64_thumb.png",
  ],
};
function buildPresetThumbs(){
  const key = `${doc.res.w}x${doc.res.h}`;
  const list = PRESET_MAP[key] || [];
  bgThumbs.innerHTML = "";
  list.forEach((thumbSrc, idx)=>{
    const div = document.createElement("div");
    div.className = "thumb";
    const img = document.createElement("img");
    img.src = thumbSrc; img.alt = `Preset ${idx+1}`;
    div.appendChild(img);
    div.addEventListener("click", async ()=>{
      const full = thumbSrc.replace("_thumb","");
      const im = new Image(); im.crossOrigin="anonymous"; im.src=full;
      try { await im.decode(); } catch(e){}
      doc.bg = { type:"image", color:null, image:im, preset:full };
      pushHistory(); render(0,null); fitZoom();
    });
    bgThumbs.appendChild(div);
  });
}
function setInitialBackground(){
  const key = `${doc.res.w}x${doc.res.h}`;
  if (PRESET_MAP[key]){
    const first = PRESET_MAP[key][0]; // A for 96x128, C for 64x64
    const full = first.replace("_thumb","");
    const im = new Image(); im.crossOrigin="anonymous"; im.src=full;
    im.onload = ()=>{ doc.bg = { type:"image", color:null, image:im, preset:full }; render(0,null); fitZoom(); };
  } else {
    doc.bg = { type:"solid", color:"#000000", image:null, preset:null };
  }
}
function isSolidBg(){ return doc.bg?.type === "solid"; }
function updateBgControlsVisibility(){
  const sw = document.getElementById("bgSwatches");
  const addBtn = document.getElementById("addBgSwatchBtn").parentElement;
  const pick = document.getElementById("bgSolidColor").parentElement;
  sw.style.display = addBtn.style.display = pick.style.display = isSolidBg()? "block":"none";
}

/* -------- History -------- */
function pushHistory(){ history.push(JSON.stringify(doc)); if(history.length>MAX_STACK)history.shift(); future.length=0; }
function undo(){ if(!history.length)return; future.push(JSON.stringify(doc)); doc=JSON.parse(history.pop()); render(0,null); }
function redo(){ if(!future.length)return; history.push(JSON.stringify(doc)); doc=JSON.parse(future.pop()); render(0,null); }

/* -------- Zoom / Fit -------- */
function setMode(m){ mode=m; modeEditBtn.classList.toggle("active", m==="edit"); modePrevBtn.classList.toggle("active", m==="preview"); }
function setZoom(z){ zoom=z; zoomSlider.value=String(z.toFixed(2)); canvas.style.transform = `translate(-50%, -50%) scale(${zoom})`; }
function fitZoom(){
  const pad=16;
  const wrapRect = wrap.getBoundingClientRect();
  const availW = Math.max(50, wrapRect.width - pad*2);
  const availH = Math.max(50, wrapRect.height - pad*2);
  const sx = availW / doc.res.w, sy = availH / doc.res.h;
  const s = Math.max(0.1, Math.min(sx, sy));
  setZoom(s);
}

/* -------- Styles + Layout -------- */
function resolveStyle(overrides={}) {
  return {
    fontFamily: overrides.fontFamily || doc.style.fontFamily || defaults.fontFamily,
    fontSize: overrides.fontSize || doc.style.fontSize || defaults.fontSize,
    color: overrides.color || doc.style.color || defaults.color,
  };
}
function layoutDocument(){
  const positions=[];
  const fs = doc.style.fontSize || defaults.fontSize;
  const lineStep = fs + (doc.style.lineGap ?? defaults.lineGap);
  const totalH = doc.lines.length * lineStep;
  let startY = 0;
  if (doc.style.valign === "top") startY = fs + 6;
  else if (doc.style.valign === "middle") startY = (doc.res.h - totalH)/2 + fs;
  else startY = doc.res.h - totalH + fs - 6;
  doc.lines.forEach((line, li)=>{
    const wordsW = line.words.map(w=>{ const st=resolveStyle(w.style); ctx.font=`${st.fontSize}px ${st.fontFamily}`; return Math.ceil(ctx.measureText(w.text||"").width); });
    const gaps = Math.max(0, line.words.length-1) * (doc.style.wordGap ?? defaults.wordGap);
    const lineWidth = wordsW.reduce((a,b)=>a+b,0)+gaps;
    let startX = (doc.style.align === "left") ? 4 : (doc.style.align === "center") ? (doc.res.w - lineWidth)/2 : (doc.res.w - lineWidth - 4);
    let x = startX, y = startY + li * lineStep;
    line.words.forEach((w, wi)=>{ positions.push({line:li, word:wi, x, y}); x += wordsW[wi] + (doc.style.wordGap ?? defaults.wordGap); });
  });
  return {positions};
}
function measureWordBBox(li, wi){
  const line=doc.lines[li]; if(!line)return null;
  const word=line.words[wi]; if(!word)return null;
  const st=resolveStyle(word.style); ctx.font=`${st.fontSize}px ${st.fontFamily}`;
  const t=word.text||""; const m=ctx.measureText(t); const w=Math.ceil(m.width); const h=Math.ceil(st.fontSize*1.15);
  const layout=layoutDocument(); const item=layout.positions.find(p=>p.line===li&&p.word===wi); if(!item)return null;
  return {x:item.x, y:item.y-h, w, h};
}

/* -------- Animations (same as previous “ALL WIRED”) -------- */
// (omitted here for brevity — this section is identical to the “ALL EFFECTS WIRED” you pasted last.
// Keep your existing animatedProps()/renderText() implementations.)
// BEGIN EFFECTS
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function getActive(id){ return doc.animations.find(a=>a.id===id); }
function prand(seed){ return Math.abs(Math.sin(seed*12.9898)*43758.5453)%1; }

function animatedProps(base, wordObj, t, totalDur){
  const props={x:base.x,y:base.y,scale:1,alpha:1,text:wordObj.text,color:null,dx:0,dy:0,shadow:null,gradient:null,perChar:null};

  const scroll=getActive("scroll");
  if(scroll){const dir=(scroll.params.dir||"L").toUpperCase(); const sp=Number(scroll.params.speed||1); const v=20*sp;
    if(dir==="L")props.dx-=(t*v)%(doc.res.w+200);
    if(dir==="R")props.dx+=(t*v)%(doc.res.w+200);
    if(dir==="U")props.dy-=(t*v)%(doc.res.h+200);
    if(dir==="D")props.dy+=(t*v)%(doc.res.h+200);}

  const type=getActive("typewriter");
  if(type&&props.text){const rate=Number(type.params.rate||1); const cps=10*rate; const shown=Math.max(0,Math.min(props.text.length,Math.floor(t*cps))); props.text=props.text.slice(0,shown);}

  const pulse=getActive("pulse");
  if(pulse){const s=Number(pulse.params.scale||0.03); const vy=Number(pulse.params.vy||4); props.scale*=1+(Math.sin(t*2*Math.PI)*s); props.dy+=Math.sin(t*2*Math.PI)*vy;}

  const wave=getActive("wave");
  if(wave){const ax=Number(wave.params.ax||0.8), ay=Number(wave.params.ay||1.4), cyc=Number(wave.params.cycles||1.0); const ph=cyc*2*Math.PI*t; props.dx+=Math.sin(ph+base.x*0.05)*ax*4; props.dy+=Math.sin(ph+base.y*0.06)*ay*4;}

  const jit=getActive("jitter");
  if(jit){const a=Number(jit.params.amp||0.10), f=Number(jit.params.freq||2.5); const seed=(base.x*13+base.y*7)|0; const r1=Math.sin(seed+t*2*Math.PI*f)*a*3, r2=Math.cos(seed*0.3+t*2*Math.PI*f)*a*3; props.dx+=r1; props.dy+=r2;}

  const shake=getActive("shake");
  if(shake){const a=Number(shake.params.amp||0.20)*5, f=Number(shake.params.freq||2); props.dx+=Math.sin(t*2*Math.PI*f)*a; props.dy+=Math.cos(t*2*Math.PI*f)*a*0.6;}

  const zm=getActive("zoom");
  if(zm){const dir=(zm.params.dir||"in").toLowerCase(), sp=Number(zm.params.speed||1), k=0.4*sp; props.scale*=(dir==="in")?(1+k*easeOutCubic(Math.min(1,t/1))):Math.max(0.2,1+k*(1-Math.min(1,t/1))*(-1));}

  const fout=getActive("fadeout");
  if(fout&&totalDur){const tail=0.2*totalDur; if(t>totalDur-tail){const r=(t-(totalDur-tail))/tail; props.alpha*=Math.max(0,1-r);}}

  const slide=getActive("slide");
  if(slide&&totalDur){const head=0.2*totalDur; const dir=(slide.params.dir||"L").toUpperCase(); const sp=Number(slide.params.speed||1); const d=Math.min(1,t/Math.max(0.001,head)); const dist=((dir==="L"||dir==="R")?doc.res.w:doc.res.h)*0.6*sp; const s=1-easeOutCubic(d); if(dir==="L")props.dx-=dist*s; if(dir==="R")props.dx+=dist*s; if(dir==="U")props.dy-=dist*s; if(dir==="D")props.dy+=dist*s;}

  const slideAway=getActive("slideaway");
  if(slideAway&&totalDur){const tail=0.2*totalDur; if(t>totalDur-tail){const dir=(slideAway.params.dir||"L").toUpperCase(); const sp=Number(slideAway.params.speed||1); const r=(t-(totalDur-tail))/tail; const dist=((dir==="L"||dir==="R")?doc.res.w:doc.res.h)*0.6*sp; const s=easeOutCubic(r); if(dir==="L")props.dx-=dist*s; if(dir==="R")props.dx+=dist*s; if(dir==="U")props.dy-=dist*s; if(dir==="D")props.dy+=dist*s;}}

  const cc=getActive("colorcycle");
  if(cc){const sp=Number(cc.params.speed||0.5); const hue=Math.floor((t*60*sp)%360); props.color=`hsl(${hue}deg 100% 60%)`; }

  const flicker=getActive("flicker");
  if(flicker){const str=Math.max(0,Math.min(1,Number(flicker.params.strength||0.5))); const seed=(base.x*31+base.y*17); const n=(Math.sin(seed+t*23.7)+Math.sin(seed*0.7+t*17.3))*0.25+0.5; props.alpha*=(1-str*0.6)+n*str*0.6;}

  const glow=getActive("glow");
  if(glow){const intensity=Math.max(0,Number(glow.params.intensity||0.6)); const k=(Math.sin(t*2*Math.PI*1.2)*0.5+0.5)*intensity; props.shadow={blur:6+k*10,color:props.color||null};}

  const rainbow=getActive("rainbow");
  if(rainbow){const speed=Number(rainbow.params.speed||0.5); props.gradient={type:"rainbow",speed};}

  const sweep=getActive("sweep");
  if(sweep){const speed=Number(sweep.params.speed||0.7), width=Number(sweep.params.width||0.25); props.gradient={type:"sweep",speed,width};}

  const strobe=getActive("strobe");
  if(strobe){const rate=Number(strobe.params.rate||3); const phase=Math.sin(2*Math.PI*rate*t); props.alpha*=(phase>0)?1:0.15;}

  const hb=getActive("heartbeat");
  if(hb){const r=Number(hb.params.rate||1.2); const beat=Math.abs(Math.sin(2*Math.PI*r*t))**2; props.scale*=1+beat*0.08;}

  const ripple=getActive("ripple");
  if(ripple&&props.text){const amp=Number(ripple.params.amp||1.0)*2.0, freq=Number(ripple.params.freq||2.0); const arr=[]; for(let i=0;i<props.text.length;i++){arr.push(Math.sin(2*Math.PI*freq*t+i*0.6)*amp);} props.perChar??={}; props.perChar.dy=arr;}

  const scr=getActive("scramble");
  if(scr&&props.text){const rate=Number(scr.params.rate||1), cps=10*rate; const goal=wordObj.text||""; let out=""; for(let i=0;i<goal.length;i++){const revealAt=i/cps; if(t>=revealAt)out+=goal[i]; else{const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"; const idx=Math.floor((t*20+i*3)%chars.length); out+=chars[idx];}} props.text=out;}

  const pop=getActive("popcorn");
  if(pop&&props.text){const rate=Number(pop.params.rate||1); const alphaArr=[]; for(let i=0;i<props.text.length;i++){const seed=i*7+(base.x|0)*3+(base.y|0); const phase=Math.sin(2*Math.PI*rate*t+seed*0.17); alphaArr.push(phase>0?1:0.2);} props.perChar??={}; props.perChar.alpha=alphaArr;}

  return props;
}

function measureCharWidths(text, fontSpec){ ctx.save(); ctx.font=fontSpec; const widths=[]; for(let i=0;i<text.length;i++){widths.push(Math.ceil(ctx.measureText(text[i]).width));} ctx.restore(); return widths; }

function renderText(t=0,totalDur=null){
  const layout=layoutDocument();
  layout.positions.forEach((p)=>{
    const word=doc.lines[p.line].words[p.word];
    const st=resolveStyle(word.style);
    const props=animatedProps(p,word,t,totalDur);
    const txt=props.text||"";

    ctx.save();
    ctx.globalAlpha=Math.max(0,Math.min(1,props.alpha));
    ctx.textBaseline="alphabetic";
    const fsize=st.fontSize*props.scale;
    const fontSpec=`${fsize}px ${st.fontFamily}`; ctx.font=fontSpec;

    if(props.shadow){ctx.shadowBlur=props.shadow.blur; ctx.shadowColor=props.shadow.color||st.color;} else {ctx.shadowBlur=0;}

    let fillStyle = props.color || st.color;
    let wordWidth = Math.ceil(ctx.measureText(txt).width);
    if(props.gradient && txt.length){
      if(props.gradient.type==="rainbow"){
        const g=ctx.createLinearGradient(p.x,p.y,p.x+wordWidth,p.y);
        const baseHue=(t*120*props.gradient.speed)%360;
        for(let i=0;i<=6;i++){const stop=i/6; const hue=Math.floor((baseHue+stop*360)%360); g.addColorStop(stop,`hsl(${hue}deg 100% 60%)`);}
        fillStyle=g;
      }
      if(props.gradient.type==="sweep"){
        const band=Math.max(0.05,Math.min(0.8,props.gradient.width||0.25));
        const pos=(t*(props.gradient.speed||0.7)*1.2)%1;
        const g=ctx.createLinearGradient(p.x,p.y,p.x+wordWidth,p.y);
        const a=Math.max(0,pos-band/2), b=Math.min(1,pos+band/2);
        g.addColorStop(0, fillStyle); g.addColorStop(a, fillStyle);
        g.addColorStop(pos, "#FFFFFF"); g.addColorStop(b, fillStyle);
        g.addColorStop(1, fillStyle);
        fillStyle=g;
      }
    }
    ctx.fillStyle=fillStyle;

    const baseX=p.x+(props.dx||0), baseY=p.y+(props.dy||0);

    if(props.perChar && txt.length){
      const widths=measureCharWidths(txt,fontSpec); let x=baseX;
      for(let i=0;i<txt.length;i++){
        const ch=txt[i]; const dy=(props.perChar.dy?.[i]||0); const aMul=(props.perChar.alpha?.[i]??1);
        const oldA=ctx.globalAlpha; ctx.globalAlpha=oldA*aMul; ctx.fillText(ch,x,baseY+dy); ctx.globalAlpha=oldA;
        x += widths[i];
      }
    } else {
      ctx.fillText(txt, baseX, baseY);
    }

    // selection: glowing magenta dotted box
    if (selected && selected.line===p.line && selected.word===p.word) {
      const box = measureWordBBox(p.line, p.word);
      if (box) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,0,255,0.95)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3,2]);
        ctx.shadowColor = "rgba(255,0,255,0.85)";
        ctx.shadowBlur = 6;
        ctx.strokeRect(box.x-1, box.y-1, box.w+2, box.h+2);
        ctx.restore();

        // position floating X at top-right corner of the box
        const rect = canvas.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const cx = rect.left + (box.x + box.w + 2) * zoom;   // right edge
        const cy = rect.top  + (box.y - 10) * zoom;          // a bit above
        deleteWordFx.style.left = `${cx - wrapRect.left}px`;
        deleteWordFx.style.top  = `${cy - wrapRect.top}px`;
        deleteWordFx.classList.remove("hidden");
      }
    }
    ctx.restore();
  });
}
// END EFFECTS

function renderBg(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (doc.bg.type === "solid") {
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if (doc.bg.type === "image" && doc.bg.image) {
    try { ctx.drawImage(doc.bg.image, 0, 0, canvas.width, canvas.height); } catch(e){}
  }
}
function render(t=0,totalDur=null){
  canvas.width = doc.res.w; canvas.height = doc.res.h;
  renderBg(); renderText(t,totalDur);
}

/* -------- Preview loop -------- */
let rafId=null, t0=null;
function startPreview(){ if(rafId)cancelAnimationFrame(rafId); t0=performance.now(); const loop=(now)=>{ const t=(now-t0)/1000; render(t,null); rafId=requestAnimationFrame(loop); }; rafId=requestAnimationFrame(loop); }
function stopPreview(){ if(rafId)cancelAnimationFrame(rafId); rafId=null; render(0,null); }

/* -------- Swatches (font + bg mirror) -------- */
function drawSwatches(){
  swatchesWrap.innerHTML=""; bgSwatches.innerHTML="";
  const make = (wrapEl, list, isBg)=>{
    list.forEach(({c,d})=>{
      const wrap=document.createElement("div"); wrap.className="swatch-wrap";
      const s=document.createElement("div"); s.className="swatch"; s.style.background=c; s.title=c+(d?" (default)":"");
      s.addEventListener("click", ()=>{
        if (isBg){ doc.bg={type:"solid", color:c, image:null, preset:null}; bgSolidColor.value=c; updateBgControlsVisibility(); }
        else { doc.style.color=c; fontColorInput.value=c; }
        pushHistory(); render(0,null);
      });
      wrap.appendChild(s);
      if(!d){
        const x=document.createElement("button"); x.textContent="×"; x.className="x";
        x.addEventListener("click",(ev)=>{ev.stopPropagation(); if(isBg)customBgPalette=customBgPalette.filter(cc=>cc!==c); else customPalette=customPalette.filter(cc=>cc!==c); drawSwatches();});
        wrap.appendChild(x);
      }
      wrapEl.appendChild(wrap);
    });
  };
  const all=[...defaultPalette.map(c=>({c,d:true})), ...customPalette.map(c=>({c,d:false}))];
  make(swatchesWrap, all, false);
  const allBg=[...defaultPalette.map(c=>({c,d:true})), ...customBgPalette.map(c=>({c,d:false}))];
  make(bgSwatches, allBg, true);
}

/* -------- Events -------- */
zoomSlider.addEventListener("input", e=> setZoom(parseFloat(e.target.value)));
fitBtn.addEventListener("click", fitZoom);

modePrevBtn.addEventListener("click", ()=>{ setMode("preview"); startPreview(); });
modeEditBtn.addEventListener("click",  ()=>{ setMode("edit"); stopPreview(); });

resSel.addEventListener("change", ()=>{
  const [w,h]=resSel.value.split("x").map(Number);
  doc.res={w,h};
  buildPresetThumbs();
  setInitialBackground();
  render(0,null); fitZoom();
});

addLineBtn.addEventListener("click", ()=>{
  pushHistory();
  doc.lines.push({words:[{text:""}], offsetY:0});
  selected = { line: doc.lines.length-1, word: 0, caret: 0 };
  openInspector(true);
  render(0,null); try{ mobileInput.focus(); }catch{}
});
addWordBtn.addEventListener("click", ()=>{
  pushHistory();
  const line = doc.lines[selected?.line ?? 0] || doc.lines[0];
  line.words.push({text:""});
  selected = { line: doc.lines.indexOf(line), word: line.words.length-1, caret: 0 };
  openInspector(true);
  render(0,null); try{ mobileInput.focus(); }catch{}
});

deleteWordFx.addEventListener("click", ()=>{
  if (!selected) return;
  pushHistory();
  const line = doc.lines[selected.line]; if(!line) return;
  line.words.splice(selected.word,1);
  if (!line.words.length){ doc.lines.splice(selected.line,1); selected = doc.lines.length? {line:0,word:0,caret:0} : null; }
  else { selected.word = Math.max(0, selected.word-1); }
  deleteWordFx.classList.add("hidden");
  render(0,null);
});

canvas.addEventListener("click", (e)=>{
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/zoom, y=(e.clientY-rect.top)/zoom;
  const layout=layoutDocument(); let hit=null;
  layout.positions.forEach(p=>{ const b=measureWordBBox(p.line,p.word); if(!b)return; if(x>=b.x-2&&x<=b.x+b.w+2&&y>=b.y-2&&y<=b.y+b.h+2) hit=p; });
  if (hit){
    selected={ line:hit.line, word:hit.word, caret:(doc.lines[hit.line].words[hit.word].text||"").length };
    if (mode==="preview"){ setMode("edit"); stopPreview(); }
    openInspector(true);
    render(0,null); try{ mobileInput.focus(); }catch{}
  }
});

document.addEventListener("keydown", (e)=>{
  if (mode!=="edit") return;

  // If totally empty first word, Enter/Space should create a new word
  const isBlank = doc.lines.length===0 || (doc.lines.length===1 && doc.lines[0].words.length===1 && (doc.lines[0].words[0].text||"") === "");
  if (isBlank && (e.key===" " || e.key==="Enter")){
    e.preventDefault();
    doc.lines = [{words:[{text:""}], offsetY:0}];
    selected = {line:0,word:0,caret:0};
    try{ mobileInput.focus(); }catch{}
    render(0,null);
    return;
  }

  if (!selected) return;
  const line = doc.lines[selected.line]; if(!line) return;
  const word = line.words[selected.word]; if(!word) return;

  if (e.key==="Enter"){ // new line
    e.preventDefault(); pushHistory();
    doc.lines.splice(selected.line+1,0,{words:[{text:""}],offsetY:0});
    selected={line:selected.line+1,word:0,caret:0};
    render(0,null); try{ mobileInput.focus(); }catch{}; return;
  }
  if (e.key===" " && !e.ctrlKey && !e.metaKey){ // new word
    e.preventDefault(); pushHistory();
    line.words.splice(selected.word+1,0,{text:""});
    selected={line:selected.line,word:selected.word+1,caret:0};
    render(0,null); try{ mobileInput.focus(); }catch{}; return;
  }
  if (e.key==="Backspace"){
    e.preventDefault(); pushHistory();
    const t=word.text||"";
    if (!t.length){
      line.words.splice(selected.word,1);
      if (!line.words.length){ doc.lines.splice(selected.line,1); selected=doc.lines.length?{line:0,word:0,caret:0}:null; }
      else { selected.word=Math.max(0,selected.word-1); }
    } else {
      word.text=t.slice(0,-1); selected.caret=Math.max(0,(selected.caret??t.length)-1);
    }
    render(0,null); return;
  }
  if (e.key.length===1 && !e.metaKey && !e.ctrlKey){
    e.preventDefault(); pushHistory();
    const t=word.text||""; const pos=(selected.caret==null)?t.length:selected.caret;
    word.text = t.slice(0,pos) + e.key + t.slice(pos);
    selected.caret = pos+1;
    render(0,null);
  }

  if (e.ctrlKey||e.metaKey){
    if (e.key.toLowerCase()==="z"){ e.preventDefault(); undo(); }
    if (e.key.toLowerCase()==="y"){ e.preventDefault(); redo(); }
  }
});

/* -------- Inspector: horizontal toolbar -------- */
function openInspector(open=true){
  inspectorBody.classList.toggle("open", open);
  inspectorToggle.setAttribute("aria-expanded", String(open));
}
inspectorToggle.addEventListener("click", ()=>{ const open=!inspectorBody.classList.contains("open"); openInspector(open); setTimeout(fitZoom,60); });
accs.forEach(acc=> acc.addEventListener("toggle", ()=>{ if(acc.open) accs.filter(a=>a!==acc).forEach(a=>a.open=false); }));
toolbarTabs.forEach(btn=> btn.addEventListener("click", ()=>{ const id=btn.getAttribute("data-acc"); const target=document.getElementById(id); if(target){ target.open=true; accs.filter(a=>a!==target).forEach(a=>a.open=false); openInspector(true); setTimeout(fitZoom,60);} }));

/* -------- Bind controls -------- */
fontSel.addEventListener("change", ()=>{ pushHistory(); doc.style.fontFamily=fontSel.value; render(0,null); });
fontSizeInput.addEventListener("input", ()=>{ pushHistory(); doc.style.fontSize=Math.max(6,Math.min(64,parseInt(fontSizeInput.value||22))); render(0,null); });
fontColorInput.addEventListener("input", ()=>{ pushHistory(); doc.style.color=fontColorInput.value; render(0,null); });
lineGapInput.addEventListener("input", ()=>{ pushHistory(); doc.style.lineGap=parseInt(lineGapInput.value||4); render(0,null); });
wordGapInput.addEventListener("input", ()=>{ pushHistory(); doc.style.wordGap=parseInt(wordGapInput.value||6); render(0,null); });
alignBtns.forEach(b=> b.addEventListener("click", ()=>{ alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); pushHistory(); doc.style.align=b.dataset.align; render(0,null); }));
valignBtns.forEach(b=> b.addEventListener("click", ()=>{ valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); pushHistory(); doc.style.valign=b.dataset.valign; render(0,null); }));

/* -------- BG controls -------- */
function drawBothPalettes(){ drawSwatches(); }
const addSwatch=(arr,c)=>{ if(!defaultPalette.includes(c)&&!arr.includes(c)) arr.push(c); };
addSwatchBtn.addEventListener("click", ()=>{ addSwatch(customPalette, fontColorInput.value); drawBothPalettes(); });
clearSwatchesBtn.addEventListener("click", ()=>{ customPalette=[]; drawBothPalettes(); });
addBgSwatchBtn.addEventListener("click", ()=>{ addSwatch(customBgPalette, bgSolidColor.value); drawBothPalettes(); });

bgSolidBtn.addEventListener("click", ()=>{ pushHistory(); doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null}; updateBgControlsVisibility(); render(0,null); });
bgSolidColor.addEventListener("input", ()=>{ pushHistory(); doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null}; updateBgControlsVisibility(); render(0,null); });
bgUpload.addEventListener("change", (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f); const im=new Image();
  im.onload=()=>{ URL.revokeObjectURL(url); pushHistory(); doc.bg={type:"image", color:null, image:im, preset:null}; updateBgControlsVisibility(); render(0,null); fitZoom(); };
  im.src=url;
});

/* -------- Config -------- */
saveJsonBtn.addEventListener("click", ()=>{
  const blob=new Blob([JSON.stringify(doc,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="config.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
});
loadJsonInput.addEventListener("change",(e)=>{
  const f=e.target.files?.[0]; if(!f)return;
  const r=new FileReader(); r.onload=()=>{ try{ pushHistory(); doc=JSON.parse(r.result); render(0,null); fitZoom(); }catch{} }; r.readAsText(f);
});

/* -------- GIF export -------- */
function encoderToBlob(encoder){ const bytes=encoder.stream().bin||encoder.stream().getData(); const u8=(bytes instanceof Uint8Array)?bytes:new Uint8Array(bytes); return new Blob([u8],{type:"image/gif"}); }
async function downloadGif(){
  const fps=Math.max(1,Math.min(30,parseInt(fpsInput.value||15)));
  const secs=Math.max(1,Math.min(60,parseInt(secInput.value||8)));
  const frames=Math.max(1,Math.min(1800,fps*secs));
  const delayMs=Math.round(1000/fps);
  const W=canvas.width,H=canvas.height;

  const encoder=new GIFEncoder();
  encoder.setRepeat(0); encoder.setDelay(delayMs); encoder.setQuality(10); encoder.setSize(W,H); encoder.start();

  const wasPreview=(mode==="preview"); if(wasPreview) stopPreview();
  for(let i=0;i<frames;i++){ const t=i/fps; render(t,secs); encoder.addFrame(ctx); }
  encoder.finish();
  const blob=encoderToBlob(encoder);
  const url=URL.createObjectURL(blob);
  const outName=(fileNameInput.value||"animation.gif").replace(/\.(png|jpg|jpeg|webp)$/i,".gif");
  const a=document.createElement("a"); a.href=url; a.download=outName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  if(wasPreview) startPreview();
}
downloadGifBtn.addEventListener("click", async ()=>{
  if (!(await ensureGifLibs())) { alert("GIF export library couldn’t load. Want me to inline it for offline use?"); return; }
  await downloadGif();
});

/* -------- Animation UI + conflict warnings -------- */
const ANIMS=[
  {id:"scroll", name:"Scroll / Marquee", params:{dir:"L", speed:1}},
  {id:"typewriter", name:"Typewriter", params:{rate:1}},
  {id:"pulse", name:"Pulse/Breathe", params:{scale:0.03, vy:4}},
  {id:"wave", name:"Wave", params:{ax:0.8, ay:1.4, cycles:1.0}},
  {id:"jitter", name:"Jitter", params:{amp:0.10, freq:2.5}},
  {id:"shake", name:"Shake", params:{amp:0.20, freq:2}},
  {id:"zoom", name:"Zoom In/Out", params:{dir:"in", speed:1}},
  {id:"fadeout", name:"Fade Out", params:{}},
  {id:"slide", name:"Slide In", params:{dir:"L", speed:1}},
  {id:"slideaway", name:"Slide Away", params:{dir:"L", speed:1}},
  {id:"colorcycle", name:"Color Cycle", params:{speed:0.5}},
  {id:"flicker", name:"Flicker", params:{strength:0.5}},
  {id:"glow", name:"Glow Pulse", params:{intensity:0.6}},
  {id:"rainbow", name:"Rainbow Sweep", params:{speed:0.5}},
  {id:"sweep", name:"Highlight Sweep", params:{speed:0.7, width:0.25}},
  {id:"strobe", name:"Strobe", params:{rate:3}},
  {id:"heartbeat", name:"Heartbeat", params:{rate:1.2}},
  {id:"ripple", name:"Ripple", params:{amp:1.0, freq:2.0}},
  {id:"scramble", name:"Scramble/Decode", params:{rate:1}},
  {id:"popcorn", name:"Popcorn", params:{rate:1}},
];
const CONFLICTS=[
  ["typewriter","scramble"],
  ["typewriter","popcorn"],
  ["strobe","flicker"],
  ["rainbow","colorcycle"]
];
function conflictsWithCurrent(id){
  const active = doc.animations.map(a=>a.id);
  const hits = CONFLICTS.filter(pair=> pair.includes(id) && pair.some(p=>active.includes(p) && p!==id));
  return hits.map(pair=> pair.find(p=>p!==id && active.includes(p)));
}
function buildAnimUI(){
  animList.innerHTML="";
  ANIMS.forEach(a=>{
    const row=document.createElement("div");
    const chk=document.createElement("input"); chk.type="checkbox"; chk.id="anim_"+a.id;
    const label=document.createElement("label"); label.htmlFor=chk.id; label.textContent=a.name;
    const gear=document.createElement("button"); gear.textContent="⚙"; gear.className="button tiny";
    const params=document.createElement("div"); params.style.display="none"; params.style.margin="6px 0";

    gear.addEventListener("click", ()=>{ params.style.display = params.style.display==="none" ? "block" : "none"; });

    Object.keys(a.params).forEach(k=>{
      const pwrap=document.createElement("div"); pwrap.style.display="inline-flex"; pwrap.style.gap="6px"; pwrap.style.marginRight="8px";
      const lab=document.createElement("span"); lab.textContent=k;
      const inp=document.createElement("input"); inp.value=a.params[k];
      inp.addEventListener("input", ()=>{ const it=doc.animations.find(x=>x.id===a.id); if(it) it.params[k]=(isNaN(+inp.value)?inp.value:+inp.value); });
      pwrap.appendChild(lab); pwrap.appendChild(inp); params.appendChild(pwrap);
    });

    chk.addEventListener("change", ()=>{
      const found = doc.animations.find(x=>x.id===a.id);
      if (chk.checked && !found){
        const offenders = conflictsWithCurrent(a.id);
        if (offenders.length){
          const msg = `These may cancel each other out: ${a.name} ↔ ${offenders.map(id=>ANIMS.find(z=>z.id===id).name).join(", ")}. Keep both?`;
          if (!confirm(msg)){ chk.checked=false; return; }
        }
        doc.animations.push({id:a.id, params:{...a.params}});
      } else if (!chk.checked){
        doc.animations = doc.animations.filter(x=>x.id!==a.id);
      }
    });

    row.appendChild(chk); row.appendChild(label); row.appendChild(gear); row.appendChild(params);
    animList.appendChild(row);
  });
}
animHelpBtn.addEventListener("click", ()=> alert("Enable an animation with its checkbox; click ⚙ to tweak. If two effects clash, you’ll be warned."));

/* -------- BG visibility toggles -------- */
function updateAfterBgChange(){ updateBgControlsVisibility(); render(0,null); }

/* -------- Init -------- */
function drawSwatchesInit(){ drawSwatches(); }
function init(){
  drawSwatchesInit();
  buildPresetThumbs();
  setInitialBackground();
  setMode("edit");
  setZoom(zoom);
  render(0,null);
  fitZoom();
  openInspector(false);
  buildAnimUI();
  updateBgControlsVisibility();
}
window.addEventListener("resize", fitZoom);
window.addEventListener("orientationchange", ()=> setTimeout(fitZoom, 200));
fitBtn.addEventListener("click", fitZoom);
init();
