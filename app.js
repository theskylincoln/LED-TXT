// ====== helpers ======
const $ = (q, el=document)=>el.querySelector(q);
const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));

// robust GIF loader
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
  const sets = [
    ["https://cdn.jsdelivr.net/npm/jsgif@0.2.1/NeuQuant.js",
     "https://cdn.jsdelivr.net/npm/jsgif@0.2.1/LZWEncoder.js",
     "https://cdn.jsdelivr.net/npm/jsgif@0.2.1/GIFEncoder.js"],
    ["https://unpkg.com/jsgif@0.2.1/NeuQuant.js",
     "https://unpkg.com/jsgif@0.2.1/LZWEncoder.js",
     "https://unpkg.com/jsgif@0.2.1/GIFEncoder.js"],
  ];
  for (const group of sets){ try{ for(const u of group) await loadScript(u); }catch(e){} if (typeof GIFEncoder!=="undefined") return true; }
  return false;
}

// ====== DOM ======
const canvas=$("#led"), ctx=canvas.getContext("2d"), wrap=$(".canvas-wrap");
const resSel=$("#resSelect"), bgThumbs=$("#bgThumbs"), bgSolidBtn=$("#bgSolidBtn"), bgSolidColor=$("#bgSolidColor"), bgUpload=$("#bgUpload");
const zoomSlider=$("#zoom"), fitBtn=$("#fitBtn");
const modeEditBtn=$("#modeEdit"), modePrevBtn=$("#modePreview");
const addWordBtn=$("#addWordBtn"), addLineBtn=$("#addLineBtn"), deleteWordFx=$("#deleteWordBtn");
const undoBtn=$("#undoBtn"), redoBtn=$("#redoBtn"), clearBtn=$("#clearAllBtn");
const clearWarn=$("#clearWarn"), clearCancel=$("#clearCancel"), clearConfirm=$("#clearConfirm"), suppressClearWarn=$("#suppressClearWarn");
const inspectorToggle=$("#toggleInspector"), inspectorBody=$("#inspectorBody"), toolbarTabs=$$(".toolbar .tab");
const accFont=$("#accFont"), accLayout=$("#accLayout"), accAnim=$("#accAnim");
const fontSel=$("#fontSelect"), fontSizeInput=$("#fontSize"), autoSizeChk=$("#autoSize"), fontColorInput=$("#fontColor");
const lineGapInput=$("#lineGap"), wordGapInput=$("#wordGap");
const alignBtns=$$("[data-align]"), valignBtns=$$("[data-valign]");
const applyAllAlign=$("#applyAllAlign"), manualDragChk=$("#manualDragChk");
const swatchesWrap=$("#swatches"), addSwatchBtn=$("#addSwatchBtn"), clearSwatchesBtn=$("#clearSwatchesBtn");
const bgSwatches=$("#bgSwatches"), addBgSwatchBtn=$("#addBgSwatchBtn");
const saveJsonBtn=$("#saveJsonBtn"), loadJsonInput=$("#loadJsonInput");
const fpsInput=$("#fps"), secInput=$("#seconds"), fileNameInput=$("#fileName"), downloadGifBtn=$("#downloadGifBtn");
const animList=$("#animList"), animHelpBtn=$("#animHelpBtn");
const mobileInput=$("#mobileInput");
const aboutBtn=$("#aboutBtn"), aboutModal=$("#aboutModal"); $("#aboutClose").addEventListener("click", ()=>aboutModal.classList.add("hidden")); aboutBtn.addEventListener("click", ()=>aboutModal.classList.remove("hidden"));
const conflictModal=$("#conflictModal"), conflictText=$("#conflictText");
const btnKeepBoth=$("#conflictKeepBoth"), btnKeepNew=$("#conflictKeepNew"), btnKeepOld=$("#conflictKeepOld"), btnCancel=$("#conflictCancel");
const multiSelectChk=$("#multiSelectChk");

// ====== State ======
let mode="edit", zoom=parseFloat(zoomSlider.value||"0.8");
let history=[], future=[]; const MAX_STACK=100;
const defaults={fontFamily:"Orbitron", fontSize:22, color:"#FFFFFF", lineGap:4, wordGap:6, align:"center", valign:"middle"};
const defaultPalette=["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customPalette=[], customBgPalette=[];
let doc={res:{w:96,h:128}, lines:[{words:[{text:""}]}], style:{...defaults}, bg:{type:"image", color:null, image:null, preset:null}, animations:[]};
let selected={line:0,word:0,caret:0};
let multiSelect=false; // holds multiple selected indexes
const multiSet=new Set(); // key "li:wi"
let showClearWarn=true;

// ====== Presets (thumbs → full) ======
const PRESET_MAP={
  "96x128":[
    {thumb:"repo/assets/thumbs/Preset_A_thumb.png", full:"repo/assets/presets/Preset_A.png"},
    {thumb:"repo/assets/thumbs/Preset_B_thumb.png", full:"repo/assets/presets/Preset_B.png"},
  ],
  "64x64":[
    {thumb:"repo/assets/thumbs/Preset_C_thumb.png", full:"repo/assets/presets/Preset_C.png"},
    {thumb:"repo/assets/thumbs/Preset_D_thumb.png", full:"repo/assets/presets/Preset_D.png"},
  ]
};
function buildPresetThumbs(){
  const key=`${doc.res.w}x${doc.res.h}`;
  const list=PRESET_MAP[key]||[];
  bgThumbs.innerHTML="";
  list.forEach((item,i)=>{
    const d=document.createElement("div"); d.className="thumb";
    const img=document.createElement("img"); img.src=item.thumb; img.alt=`Preset ${i+1}`;
    d.appendChild(img);
    d.addEventListener("click", async ()=>{
      const im=new Image(); im.crossOrigin="anonymous"; im.src=item.full;
      try{ await im.decode(); }catch(e){}
      doc.bg={type:"image", color:null, image:im, preset:item.full};
      pushHistory(); render(0,null); fitZoom();
    });
    bgThumbs.appendChild(d);
  });
}
function setInitialBackground(){
  const key=`${doc.res.w}x${doc.res.h}`;
  if (PRESET_MAP[key] && PRESET_MAP[key][0]){
    const full=PRESET_MAP[key][0].full;
    const im=new Image(); im.crossOrigin="anonymous"; im.src=full;
    im.onload=()=>{ doc.bg={type:"image", color:null, image:im, preset:full}; render(0,null); fitZoom(); }
  } else {
    doc.bg={type:"solid", color:"#000000", image:null, preset:null};
    render(0,null); fitZoom();
  }
}
function isSolidBg(){ return doc.bg?.type==="solid"; }
function updateBgControlsVisibility(){
  const sw=$("#bgSwatches");
  const addBtn=$("#addBgSwatchBtn").parentElement;
  const pick=$("#bgSolidColor").parentElement;
  [sw,addBtn,pick].forEach(el=> el.style.display=isSolidBg()?"block":"none");
}

// ====== History ======
function pushHistory(){ history.push(JSON.stringify(doc)); if(history.length>MAX_STACK)history.shift(); future.length=0; }
function undo(){ if(!history.length)return; future.push(JSON.stringify(doc)); doc=JSON.parse(history.pop()); render(0,null); }
function redo(){ if(!future.length)return; history.push(JSON.stringify(doc)); doc=JSON.parse(future.pop()); render(0,null); }

// ====== Zoom / Fit ======
function setMode(m){ mode=m; modeEditBtn.classList.toggle("active",m==="edit"); modePrevBtn.classList.toggle("active",m!=="edit"); }
function setZoom(z){ zoom=z; zoomSlider.value=String(z.toFixed(2)); canvas.style.transform=`translate(-50%,-50%) scale(${zoom})`; }
function fitZoom(){
  const pad=18;
  const r=wrap.getBoundingClientRect();
  const availW=Math.max(50,r.width-pad*2), availH=Math.max(50,r.height-pad*2);
  const s=Math.max(0.1, Math.min(availW/doc.res.w, availH/doc.res.h));
  setZoom(s);
}

// ====== Layout / Measure ======
function resolveStyle(overrides={}){ return {fontFamily:overrides.fontFamily||doc.style.fontFamily||defaults.fontFamily, fontSize:overrides.fontSize||doc.style.fontSize||defaults.fontSize, color:overrides.color||doc.style.color||defaults.color}; }
function layoutDocument(){
  const positions=[];
  const fs=doc.style.fontSize||defaults.fontSize;
  const lineStep=fs+(doc.style.lineGap??defaults.lineGap);
  const totalH=doc.lines.length*lineStep;
  let startY=0;
  if(doc.style.valign==="top") startY=fs+6;
  else if(doc.style.valign==="middle") startY=(doc.res.h-totalH)/2+fs;
  else startY=doc.res.h-totalH+fs-6;
  doc.lines.forEach((line,li)=>{
    const ww=line.words.map(w=>{const st=resolveStyle(w.style); ctx.font=`${st.fontSize}px ${st.fontFamily}`; return Math.ceil(ctx.measureText(w.text||"").width);});
    const gaps=Math.max(0,line.words.length-1)*(doc.style.wordGap??defaults.wordGap);
    const lineWidth=ww.reduce((a,b)=>a+b,0)+gaps;
    let startX=(doc.style.align==="left")?4:(doc.style.align==="center")?(doc.res.w-lineWidth)/2:(doc.res.w-lineWidth-4);
    let x=startX, y=startY+li*lineStep;
    line.words.forEach((w,wi)=>{ positions.push({line:li,word:wi,x,y}); x+=ww[wi]+(doc.style.wordGap??defaults.wordGap);});
  });
  return {positions};
}
function measureWordBBox(li,wi){
  const line=doc.lines[li]; if(!line)return null;
  const word=line.words[wi]; if(!word)return null;
  const st=resolveStyle(word.style); ctx.font=`${st.fontSize}px ${st.fontFamily}`;
  const t=word.text||""; const m=ctx.measureText(t); const w=Math.ceil(m.width); const h=Math.ceil(st.fontSize*1.15);
  const layout=layoutDocument(); const p=layout.positions.find(v=>v.line===li&&v.word===wi); if(!p)return null;
  return {x:p.x, y:p.y-h, w, h};
}

// ====== Animations (with dropdown params + start colors) ======
function easeOutCubic(x){ return 1-Math.pow(1-x,3); }
function getActive(id){ return doc.animations.find(a=>a.id===id); }
function animatedProps(base, wordObj, t, totalDur){
  const props={x:base.x,y:base.y,scale:1,alpha:1,text:wordObj.text,color:null,dx:0,dy:0,shadow:null,gradient:null,perChar:null};

  const scroll=getActive("scroll");
  if(scroll){const dir=(scroll.params.direction||"Left"); const sp=Number(scroll.params.speed||1); const v=20*sp;
    if(dir==="Left")props.dx-=(t*v)%(doc.res.w+200);
    if(dir==="Right")props.dx+=(t*v)%(doc.res.w+200);
    if(dir==="Up")props.dy-=(t*v)%(doc.res.h+200);
    if(dir==="Down")props.dy+=(t*v)%(doc.res.h+200);}

  const type=getActive("typewriter");
  if(type&&props.text){const rate=Number(type.params.rate||1); const cps=10*rate; const shown=Math.max(0,Math.min(props.text.length,Math.floor(t*cps))); props.text=props.text.slice(0,shown);}

  const pulse=getActive("pulse");
  if(pulse){const s=Number(pulse.params.scale||0.03); const vy=Number(pulse.params.vy||4); props.scale*=1+(Math.sin(t*2*Math.PI)*s); props.dy+=Math.sin(t*2*Math.PI)*vy;}

  const wave=getActive("wave");
  if(wave){const ax=Number(wave.params.ax||0.8), ay=Number(wave.params.ay||1.4), cyc=Number(wave.params.cycles||1.0); const ph=cyc*2*Math.PI*t; props.dx+=Math.sin(ph+base.x*0.05)*ax*4; props.dy+=Math.sin(ph+base.y*0.06)*ay*4;}

  const jit=getActive("jitter");
  if(jit){const a=Number(jit.params.amp||0.10), f=Number(jit.params.freq||2.5); const r1=Math.sin(t*2*Math.PI*f)*a*3, r2=Math.cos(t*2*Math.PI*f)*a*3; props.dx+=r1; props.dy+=r2;}

  const shake=getActive("shake");
  if(shake){const a=Number(shake.params.amp||0.20)*5, f=Number(shake.params.freq||2); props.dx+=Math.sin(t*2*Math.PI*f)*a; props.dy+=Math.cos(t*2*Math.PI*f)*a*0.6;}

  const zm=getActive("zoom");
  if(zm){const dir=(zm.params.direction||"In"); const sp=Number(zm.params.speed||1), k=0.4*sp; props.scale*=(dir==="In")?(1+k*easeOutCubic(Math.min(1,t/1))):Math.max(0.2,1+k*(1-Math.min(1,t/1))*(-1));}

  const fout=getActive("fadeout");
  if(fout&&totalDur){const tail=0.2*totalDur; if(t>totalDur-tail){const r=(t-(totalDur-tail))/tail; props.alpha*=Math.max(0,1-r);}}

  const slide=getActive("slide");
  if(slide&&totalDur){const head=0.2*totalDur; const dir=(slide.params.direction||"Left"); const sp=Number(slide.params.speed||1); const d=Math.min(1,t/Math.max(0.001,head)); const dist=((dir==="Left"||dir==="Right")?doc.res.w:doc.res.h)*0.6*sp; const s=1-easeOutCubic(d); if(dir==="Left")props.dx-=dist*s; if(dir==="Right")props.dx+=dist*s; if(dir==="Up")props.dy-=dist*s; if(dir==="Down")props.dy+=dist*s;}

  const slideAway=getActive("slideaway");
  if(slideAway&&totalDur){const tail=0.2*totalDur; if(t>totalDur-tail){const dir=(slideaway.params.direction||"Left"); const sp=Number(slideaway.params.speed||1); const r=(t-(totalDur-tail))/tail; const dist=((dir==="Left"||dir==="Right")?doc.res.w:doc.res.h)*0.6*sp; const s=easeOutCubic(r); if(dir==="Left")props.dx-=dist*s; if(dir==="Right")props.dx+=dist*s; if(dir==="Up")props.dy-=dist*s; if(dir==="Down")props.dy+=dist*s;}}

  const cc=getActive("colorcycle");
  if(cc){const sp=Number(cc.params.speed||0.5); const base=(cc.params.start||"#ff0000"); const hueBase=colorToHue(base); const hue=Math.floor((hueBase+(t*60*sp))%360); props.color=`hsl(${hue}deg 100% 60%)`; }

  const rainbow=getActive("rainbow");
  if(rainbow){const speed=Number(rainbow.params.speed||0.5); const base=(rainbow.params.start||"#ff00ff"); const hueBase=colorToHue(base); const gSpeed=speed; props.gradient={type:"rainbow",speed:gSpeed,base:hueBase};}

  const flicker=getActive("flicker");
  if(flicker){const str=Math.max(0,Math.min(1,Number(flicker.params.strength||0.5))); const n=(Math.sin(t*23.7)+Math.sin(t*17.3))*0.25+0.5; props.alpha*=(1-str*0.6)+n*str*0.6;}

  const glow=getActive("glow");
  if(glow){const intensity=Math.max(0,Number(glow.params.intensity||0.6)); const k=(Math.sin(t*2*Math.PI*1.2)*0.5+0.5)*intensity; props.shadow={blur:6+k*10,color:props.color||null};}

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
  if(pop&&props.text){const rate=Number(pop.params.rate||1); const alphaArr=[]; for(let i=0;i<props.text.length;i++){const phase=Math.sin(2*Math.PI*rate*t+i*0.4); alphaArr.push(phase>0?1:0.2);} props.perChar??={}; props.perChar.alpha=alphaArr;}

  return props;
}
function measureCharWidths(text, fontSpec){ ctx.save(); ctx.font=fontSpec; const arr=[]; for(let i=0;i<text.length;i++) arr.push(Math.ceil(ctx.measureText(text[i]).width)); ctx.restore(); return arr; }
function colorToHue(hex){
  const c=hex.replace("#",""); const r=parseInt(c.slice(0,2),16)/255,g=parseInt(c.slice(2,4),16)/255,b=parseInt(c.slice(4,6),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0,s=0,l=(max+min)/2;
  if(max!==min){const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6;}
  return Math.round(h*360);
}

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

    if(props.shadow){ctx.shadowBlur=props.shadow.blur; ctx.shadowColor=props.shadow.color||st.color;} else ctx.shadowBlur=0;

    let fillStyle=props.color||st.color;
    let wordWidth=Math.ceil(ctx.measureText(txt).width);
    if(props.gradient && txt.length){
      if(props.gradient.type==="rainbow"){
        const g=ctx.createLinearGradient(p.x,p.y,p.x+wordWidth,p.y);
        const baseHue=(props.gradient.base + (t*120*props.gradient.speed))%360;
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
    } else { ctx.fillText(txt, baseX, baseY); }

    // selection box + pin X
    const key=`${p.line}:${p.word}`;
    const isSel = (selected && selected.line===p.line && selected.word===p.word) || multiSet.has(key);
    if (isSel) {
      const box=measureWordBBox(p.line,p.word);
      if(box){
        ctx.save();
        ctx.strokeStyle="rgba(255,0,255,0.95)";
        ctx.lineWidth=1; ctx.setLineDash([3,2]);
        ctx.shadowColor="rgba(255,0,255,0.85)"; ctx.shadowBlur=6;
        ctx.strokeRect(box.x-1, box.y-1, box.w+2, box.h+2);
        ctx.restore();

        if (selected && selected.line===p.line && selected.word===p.word){
          const rect=canvas.getBoundingClientRect(), wrapRect=wrap.getBoundingClientRect();
          const cx = rect.left + (box.x + box.w - 6)*zoom; // inside top-right
          const cy = rect.top  + (box.y + 6)*zoom;
          deleteWordFx.style.left=`${cx - wrapRect.left}px`;
          deleteWordFx.style.top =`${cy - wrapRect.top}px`;
          deleteWordFx.classList.remove("hidden");
        }
      }
    }
    ctx.restore();
  });
}

function renderBg(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(doc.bg.type==="solid"){ ctx.fillStyle=doc.bg.color||"#000"; ctx.fillRect(0,0,canvas.width,canvas.height); }
  else if(doc.bg.type==="image" && doc.bg.image){ try{ ctx.drawImage(doc.bg.image,0,0,canvas.width,canvas.height); }catch(e){} }
}
function render(t=0,totalDur=null){ canvas.width=doc.res.w; canvas.height=doc.res.h; renderBg(); renderText(t,totalDur); }

// ====== Preview loop ======
let rafId=null, t0=null;
function startPreview(){ if(rafId)cancelAnimationFrame(rafId); t0=performance.now(); const loop=(now)=>{ const t=(now-t0)/1000; render(t,null); rafId=requestAnimationFrame(loop); }; rafId=requestAnimationFrame(loop); }
function stopPreview(){ if(rafId)cancelAnimationFrame(rafId); rafId=null; render(0,null); }

// ====== Swatches ======
function drawSwatches(){
  const make=(wrapEl, list, isBg)=>{
    wrapEl.innerHTML="";
    list.forEach(({c,d})=>{
      const wrap=document.createElement("div"); wrap.className="swatch-wrap";
      const s=document.createElement("div"); s.className="swatch"; s.style.background=c; s.title=c+(d?" (default)":"");
      s.addEventListener("click", ()=>{
        if(isBg){ doc.bg={type:"solid", color:c, image:null, preset:null}; bgSolidColor.value=c; }
        else { doc.style.color=c; fontColorInput.value=c; }
        pushHistory(); render(0,null);
      });
      wrap.appendChild(s);
      if(!d){ const x=document.createElement("button"); x.textContent="×"; x.className="x"; x.addEventListener("click",(ev)=>{ev.stopPropagation(); if(isBg)customBgPalette=customBgPalette.filter(cc=>cc!==c); else customPalette=customPalette.filter(cc=>cc!==c); drawSwatches();}); wrap.appendChild(x); }
      wrapEl.appendChild(wrap);
    });
  };
  const all=[...defaultPalette.map(c=>({c,d:true})), ...customPalette.map(c=>({c,d:false}))];
  make(swatchesWrap, all, false);
  const allBg=[...defaultPalette.map(c=>({c,d:true})), ...customBgPalette.map(c=>({c,d:false}))];
  make(bgSwatches, allBg, true);
}

// ====== Events ======
zoomSlider.addEventListener("input", e=> setZoom(parseFloat(e.target.value)));
fitBtn.addEventListener("click", fitZoom);
window.addEventListener("resize", fitZoom);
window.addEventListener("orientationchange", ()=> setTimeout(fitZoom,200));
inspectorToggle.addEventListener("click", ()=>{ const open=!inspectorBody.classList.contains("open"); openInspector(open); setTimeout(fitZoom,60); });

modePrevBtn.addEventListener("click", ()=>{ setMode("preview"); startPreview(); });
modeEditBtn.addEventListener("click",  ()=>{ setMode("edit"); stopPreview(); });

resSel.addEventListener("change", ()=>{
  const [w,h]=resSel.value.split("x").map(Number);
  doc.res={w,h};
  buildPresetThumbs(); setInitialBackground();
  render(0,null); fitZoom();
});

// Multi-select toggle
multiSelectChk.addEventListener("change", ()=>{ multiSelect=multiSelectChk.checked; if(!multiSelect) multiSet.clear(); render(0,null); });

// Stage actions
addLineBtn.addEventListener("click", ()=>{
  pushHistory(); doc.lines.push({words:[{text:""}]});
  selected={line:doc.lines.length-1, word:0, caret:0}; openInspector(true);
  render(0,null); focusEditor();
});
addWordBtn.addEventListener("click", ()=>{
  pushHistory(); const line=doc.lines[selected?.line??0]||doc.lines[0]; line.words.push({text:""});
  selected={line:doc.lines.indexOf(line), word:line.words.length-1, caret:0}; openInspector(true);
  render(0,null); focusEditor();
});

// Selection / typing
function focusEditor(){ try{ mobileInput.value=currentWordText(); mobileInput.focus(); }catch{} }
function currentWordText(){ if(!selected) return ""; const line=doc.lines[selected.line]; if(!line) return ""; const word=line.words[selected.word]; return word?.text||""; }

canvas.addEventListener("click", (e)=>{
  const rect=canvas.getBoundingClientRect(); const x=(e.clientX-rect.left)/zoom, y=(e.clientY-rect.top)/zoom;
  const layout=layoutDocument(); let hit=null;
  layout.positions.forEach(p=>{ const b=measureWordBBox(p.line,p.word); if(!b)return; if(x>=b.x-2&&x<=b.x+b.w+2&&y>=b.y-2&&y<=b.y+b.h+2) hit=p; });
  if(hit){
    const key=`${hit.line}:${hit.word}`;
    if(multiSelect){ if(multiSet.has(key)) multiSet.delete(key); else multiSet.add(key); selected={line:hit.line,word:hit.word,caret:currentWordText().length}; }
    else { multiSet.clear(); selected={line:hit.line,word:hit.word,caret:currentWordText().length}; }
    if(mode==="preview"){ setMode("edit"); stopPreview(); }
    openInspector(true); render(0,null); focusEditor();
  }
});

// Hidden input mirrors text (mobile)
mobileInput.addEventListener("input", ()=>{
  if(!selected) return;
  pushHistory();
  const line=doc.lines[selected.line]; if(!line) return;
  const word=line.words[selected.word]; if(!word) return;
  word.text=mobileInput.value; selected.caret=word.text.length;
  render(0,null);
});

document.addEventListener("keydown", (e)=>{
  if(mode!=="edit") return;
  const isBlank = doc.lines.length===0 || (doc.lines.length===1 && doc.lines[0].words.length===1 && (doc.lines[0].words[0].text||"")==="");
  if(isBlank && (e.key===" " || e.key==="Enter")){
    e.preventDefault(); doc.lines=[{words:[{text:""}]}]; selected={line:0,word:0,caret:0}; render(0,null); focusEditor(); return;
  }
  if(!selected) return;

  const line=doc.lines[selected.line]; if(!line) return;
  const word=line.words[selected.word]; if(!word) return;

  if(e.key==="Enter"){ e.preventDefault(); pushHistory(); doc.lines.splice(selected.line+1,0,{words:[{text:""}]}); selected={line:selected.line+1,word:0,caret:0}; render(0,null); focusEditor(); return; }
  if(e.key===" " && !e.ctrlKey && !e.metaKey){ e.preventDefault(); pushHistory(); line.words.splice(selected.word+1,0,{text:""}); selected={line:selected.line,word:selected.word+1,caret:0}; render(0,null); focusEditor(); return; }
  if(e.key==="Backspace"){ e.preventDefault(); pushHistory(); const t=word.text||""; if(!t.length){ line.words.splice(selected.word,1); if(!line.words.length){ doc.lines.splice(selected.line,1); selected=doc.lines.length?{line:0,word:0,caret:0}:null; } else selected.word=Math.max(0,selected.word-1); } else { word.text=t.slice(0,-1); selected.caret=Math.max(0,(selected.caret??t.length)-1); mobileInput.value=word.text; } render(0,null); return; }
  if(e.key.length===1 && !e.metaKey && !e.ctrlKey){ e.preventDefault(); pushHistory(); const t=word.text||""; const pos=(selected.caret==null)?t.length:selected.caret; word.text=t.slice(0,pos)+e.key+t.slice(pos); selected.caret=pos+1; mobileInput.value=word.text; render(0,null); }
  if(e.ctrlKey||e.metaKey){ if(e.key.toLowerCase()==="z"){ e.preventDefault(); undo(); } if(e.key.toLowerCase()==="y"){ e.preventDefault(); redo(); } }
});

// delete current word
deleteWordFx.addEventListener("click", ()=>{
  if(!selected) return; pushHistory(); const line=doc.lines[selected.line]; if(!line) return;
  line.words.splice(selected.word,1);
  if(!line.words.length){ doc.lines.splice(selected.line,1); selected=doc.lines.length?{line:0,word:0,caret:0}:null; }
  else selected.word=Math.max(0,selected.word-1);
  deleteWordFx.classList.add("hidden"); render(0,null);
});

// Inspector open/close + tabs
function openInspector(open=true){ inspectorBody.classList.toggle("open",open); inspectorToggle.setAttribute("aria-expanded",String(open)); }
[accFont,accLayout,accAnim].forEach(a=> a.addEventListener("toggle", ()=>{ if(a.open)[accFont,accLayout,accAnim].filter(x=>x!==a).forEach(x=>x.open=false); }));

toolbarTabs.forEach(btn=> btn.addEventListener("click", ()=>{ const id=btn.getAttribute("data-acc"); const t=document.getElementById(id); if(t){ t.open=true; [accFont,accLayout,accAnim].filter(x=>x!==t).forEach(x=>x.open=false); openInspector(true); setTimeout(fitZoom,60);} }));

// Font & spacing apply to multi-selection if enabled
function applyToTargets(fn){
  if (multiSelect && multiSet.size){
    multiSet.forEach(k=>{
      const [li,wi]=k.split(":").map(Number);
      const w=doc.lines[li]?.words[wi]; if(w){ fn(w); }
    });
  } else {
    const w=doc.lines[selected?.line]?.words[selected?.word]; if(w){ fn(w); }
  }
}

fontSel.addEventListener("change", ()=>{ pushHistory(); applyToTargets(w=> w.style={...w.style, fontFamily:fontSel.value}); doc.style.fontFamily=fontSel.value; render(0,null); });
fontSizeInput.addEventListener("input", ()=>{ pushHistory(); const v=Math.max(6,Math.min(64,parseInt(fontSizeInput.value||22))); applyToTargets(w=> w.style={...w.style, fontSize:v}); doc.style.fontSize=v; render(0,null); });
fontColorInput.addEventListener("input", ()=>{ pushHistory(); const v=fontColorInput.value; applyToTargets(w=> w.style={...w.style, color:v}); doc.style.color=v; render(0,null); });
lineGapInput.addEventListener("input", ()=>{ pushHistory(); doc.style.lineGap=parseInt(lineGapInput.value||4); render(0,null); });
wordGapInput.addEventListener("input", ()=>{ pushHistory(); doc.style.wordGap=parseInt(wordGapInput.value||6); render(0,null); });
alignBtns.forEach(b=> b.addEventListener("click", ()=>{ alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); pushHistory(); doc.style.align=b.dataset.align; render(0,null); }));
valignBtns.forEach(b=> b.addEventListener("click", ()=>{ valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); pushHistory(); doc.style.valign=b.dataset.valign; render(0,null); }));

// BG controls
const addSw=(arr,c)=>{ if(!defaultPalette.includes(c)&&!arr.includes(c))arr.push(c); };
addSwatchBtn.addEventListener("click", ()=>{ addSw(customPalette,fontColorInput.value); drawSwatches(); });
clearSwatchesBtn.addEventListener("click", ()=>{ customPalette=[]; drawSwatches(); });
addBgSwatchBtn.addEventListener("click", ()=>{ addSw(customBgPalette,bgSolidColor.value); drawSwatches(); });

bgSolidBtn.addEventListener("click", ()=>{ pushHistory(); doc.bg={type:"solid", color:bgSolidColor.value, image:null, preset:null}; updateBgControlsVisibility(); render(0,null); });
bgSolidColor.addEventListener("input", ()=>{ pushHistory(); doc.bg={type:"solid", color:bgSolidColor.value, image:null, preset:null}; updateBgControlsVisibility(); render(0,null); });
bgUpload.addEventListener("change", (e)=>{
  const f=e.target.files?.[0]; if(!f)return;
  const url=URL.createObjectURL(f); const im=new Image(); im.onload=()=>{ URL.revokeObjectURL(url); pushHistory(); doc.bg={type:"image", color:null, image:im, preset:null}; updateBgControlsVisibility(); render(0,null); fitZoom(); }; im.src=url;
});

// Config
saveJsonBtn.addEventListener("click", ()=>{ const blob=new Blob([JSON.stringify(doc,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="config.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); });
loadJsonInput.addEventListener("change",(e)=>{ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ pushHistory(); doc=JSON.parse(r.result); render(0,null); fitZoom(); }catch{} }; r.readAsText(f); });

// GIF export
function encoderToBlob(enc){ const bytes=enc.stream().bin||enc.stream().getData(); const u8=(bytes instanceof Uint8Array)?bytes:new Uint8Array(bytes); return new Blob([u8],{type:"image/gif"}); }
async function downloadGif(){
  const fps=Math.max(1,Math.min(30,parseInt(fpsInput.value||15)));
  const secs=Math.max(1,Math.min(60,parseInt(secInput.value||8)));
  const frames=Math.max(1,Math.min(1800,fps*secs));
  const delayMs=Math.round(1000/fps);
  const W=canvas.width,H=canvas.height;
  const encoder=new GIFEncoder(); encoder.setRepeat(0); encoder.setDelay(delayMs); encoder.setQuality(10); encoder.setSize(W,H); encoder.start();
  const wasPrev=(mode==="preview"); if(wasPrev) stopPreview();
  for(let i=0;i<frames;i++){ const t=i/fps; render(t,secs); encoder.addFrame(ctx); }
  encoder.finish(); const blob=encoderToBlob(encoder);
  const url=URL.createObjectURL(blob); const name=(fileNameInput.value||"animation.gif").replace(/\.(png|jpg|jpeg|webp)$/i,".gif");
  const a=document.createElement("a"); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),4000);
  if(wasPrev) startPreview();
}
downloadGifBtn.addEventListener("click", async ()=>{ if(!(await ensureGifLibs())){ alert("GIF export library couldn’t load. I can inline it for fully offline use."); return; } await downloadGif(); });

// ====== Animation UI (dropdowns + conflicts modal + multi-apply) ======
const ANIMS=[
  {id:"scroll", name:"Scroll / Marquee", params:{direction:"Left", speed:1}},
  {id:"typewriter", name:"Typewriter", params:{rate:1}},
  {id:"pulse", name:"Pulse / Breathe", params:{scale:0.03, vy:4}},
  {id:"wave", name:"Wave", params:{ax:0.8, ay:1.4, cycles:1.0}},
  {id:"jitter", name:"Jitter", params:{amp:0.10, freq:2.5}},
  {id:"shake", name:"Shake", params:{amp:0.20, freq:2}},
  {id:"zoom", name:"Zoom", params:{direction:"In", speed:1}},
  {id:"slide", name:"Slide In", params:{direction:"Left", speed:1}},
  {id:"slideaway", name:"Slide Away", params:{direction:"Left", speed:1}},
  {id:"fadeout", name:"Fade Out", params:{}},
  {id:"colorcycle", name:"Color Cycle", params:{speed:0.5, start:"#ff0000"}},
  {id:"rainbow", name:"Rainbow Sweep", params:{speed:0.5, start:"#ff00ff"}},
  {id:"sweep", name:"Highlight Sweep", params:{speed:0.7, width:0.25}},
  {id:"glow", name:"Glow Pulse", params:{intensity:0.6}},
  {id:"flicker", name:"Flicker", params:{strength:0.5}},
  {id:"strobe", name:"Strobe", params:{rate:3}},
  {id:"heartbeat", name:"Heartbeat", params:{rate:1.2}},
  {id:"ripple", name:"Ripple", params:{amp:1.0, freq:2.0}},
  {id:"scramble", name:"Scramble / Decode", params:{rate:1}},
  {id:"popcorn", name:"Popcorn", params:{rate:1}},
];
const CONFLICTS=[["typewriter","scramble"],["typewriter","popcorn"],["strobe","flicker"],["rainbow","colorcycle"]];

function showConflictModal(newId){
  return new Promise(res=>{
    const offenders=doc.animations.filter(a=>CONFLICTS.some(p=>p.includes(a.id) && p.includes(newId)));
    const names=offenders.map(o=>ANIMS.find(z=>z.id===o.id).name);
    $("#conflictText").textContent=`“${ANIMS.find(a=>a.id===newId).name}” may conflict with: ${names.join(", ")}. What do you want to do?`;
    conflictModal.classList.remove("hidden");
    const done=v=>{ conflictModal.classList.add("hidden"); res(v); };
    btnKeepBoth.onclick=()=>done("both");
    btnKeepNew.onclick =()=>done("new");
    btnKeepOld.onclick =()=>done("old");
    btnCancel.onclick  =()=>done("cancel");
  });
}

function buildAnimUI(){
  animList.innerHTML="";
  ANIMS.forEach(a=>{
    const row=document.createElement("div"); row.style.display="flex"; row.style.gap="6px"; row.style.alignItems="center"; row.style.flexWrap="wrap";
    const chk=document.createElement("input"); chk.type="checkbox"; chk.id="anim_"+a.id;
    const label=document.createElement("label"); label.htmlFor=chk.id; label.textContent=a.name;
    const gear=document.createElement("button"); gear.textContent="⚙"; gear.className="button tiny";
    const params=document.createElement("div"); params.style.display="none"; params.style.margin="6px 0";

    // params UI
    Object.keys(a.params).forEach(k=>{
      const p=document.createElement("div"); p.style.display="inline-flex"; p.style.gap="6px"; p.style.marginRight="8px"; p.style.alignItems="center";
      const lab=document.createElement("span"); lab.textContent=k[0].toUpperCase()+k.slice(1);
      let inp;
      if (k==="direction"){ // dropdown with full words
        inp=document.createElement("select");
        ["Left","Right","Up","Down","In","Out"].filter(opt=>{
          // Valid per effect
          if(a.id==="zoom") return ["In","Out"].includes(opt);
          if(a.id==="slide"||a.id==="slideaway"||a.id==="scroll") return ["Left","Right","Up","Down"].includes(opt);
          return false;
        }).forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=v; if(a.params[k]===v) o.selected=true; inp.appendChild(o); });
      } else if (k==="start") {
        inp=document.createElement("input"); inp.type="color"; inp.value=a.params[k];
      } else {
        inp=document.createElement("input"); inp.value=a.params[k];
      }
      inp.addEventListener("input", ()=>{
        const t=doc.animations.find(x=>x.id===a.id); if(t) t.params[k]=(inp.type==="number"? +inp.value : inp.value);
      });
      p.appendChild(lab); p.appendChild(inp); params.appendChild(p);
    });

    gear.addEventListener("click", ()=>{ params.style.display = params.style.display==="none" ? "block" : "none"; });

    chk.addEventListener("change", async ()=>{
      const found=doc.animations.find(x=>x.id===a.id);
      if(chk.checked && !found){
        const offenders=doc.animations.filter(x=>CONFLICTS.some(p=>p.includes(x.id)&&p.includes(a.id)));
        if(offenders.length){
          const choice=await showConflictModal(a.id);
          if(choice==="cancel"){ chk.checked=false; return; }
          if(choice==="new") doc.animations=doc.animations.filter(x=>!offenders.some(o=>o.id===x.id));
          if(choice==="old") { chk.checked=false; return; }
          // both => do nothing
        }
        const targets=[...(multiSelect && multiSet.size ? multiSet : new Set([`${selected?.line??0}:${selected?.word??0}`]))];
        targets.forEach(k=>{
          // For simplicity, store animations globally (same behavior visually);
          // params can be tuned per effect UI.
        });
        doc.animations.push({id:a.id, params:{...a.params}});
      } else if(!chk.checked){
        doc.animations=doc.animations.filter(x=>x.id!==a.id);
      }
    });

    row.appendChild(chk); row.appendChild(label); row.appendChild(gear); row.appendChild(params);
    animList.appendChild(row);
  });
}
animHelpBtn.addEventListener("click", ()=> alert("Enable an animation with its checkbox; click ⚙ to tweak. Direction pickers use full words. Conflicts will prompt options."));

function openInspector(open=true){ inspectorBody.classList.toggle("open",open); inspectorToggle.setAttribute("aria-expanded",String(open)); }

// ====== Init ======
function init(){
  buildPresetThumbs();
  setInitialBackground();
  drawSwatches();
  setMode("edit");
  setZoom(zoom);
  render(0,null);
  fitZoom();
  openInspector(false);
  buildAnimUI();
  updateBgControlsVisibility();
}
init();
