// ---------- utils ----------
const $=(q,el=document)=>el.querySelector(q);
const $$=(q,el=document)=>Array.from(el.querySelectorAll(q));

// GIF libs loader (CDN with fallback)
async function loadScript(src){ return new Promise((res,rej)=>{const s=document.createElement('script'); s.src=src; s.async=true; s.onload=()=>res(true); s.onerror=()=>rej(); document.head.appendChild(s);});}
async function ensureGifLibs(){
  if(typeof GIFEncoder!=="undefined") return true;
  const sets=[
    ["https://cdn.jsdelivr.net/npm/jsgif@0.2.1/NeuQuant.js","https://cdn.jsdelivr.net/npm/jsgif@0.2.1/LZWEncoder.js","https://cdn.jsdelivr.net/npm/jsgif@0.2.1/GIFEncoder.js"],
    ["https://unpkg.com/jsgif@0.2.1/NeuQuant.js","https://unpkg.com/jsgif@0.2.1/LZWEncoder.js","https://unpkg.com/jsgif@0.2.1/GIFEncoder.js"],
  ];
  for(const group of sets){ try{ for(const u of group) await loadScript(u); }catch(e){} if(typeof GIFEncoder!=="undefined") return true; }
  return false;
}

// ---------- DOM ----------
const canvas=$("#led"), ctx=canvas.getContext("2d"), wrap=$(".canvas-wrap");
const resSel=$("#resSelect"), bgGrid=$("#bgGrid"), bgSolidTools=$("#bgSolidTools"), bgSolidColor=$("#bgSolidColor"), bgUpload=$("#bgUpload");
const zoomSlider=$("#zoom"), fitBtn=$("#fitBtn");
const modeEditBtn=$("#modeEdit"), modePrevBtn=$("#modePreview");
const addWordBtn=$("#addWordBtn"), addLineBtn=$("#addLineBtn"), deleteWordFx=$("#deleteWordBtn");
const inspectorToggle=$("#toggleInspector"), inspectorBody=$("#inspectorBody"), toolbarTabs=$$(".toolbar .tab");
const accFont=$("#accFont"), accLayout=$("#accLayout"), accAnim=$("#accAnim");
const fontSel=$("#fontSelect"), fontSizeInput=$("#fontSize"), autoSizeChk=$("#autoSize"), fontColorInput=$("#fontColor");
const lineGapInput=$("#lineGap"), wordGapInput=$("#wordGap");
const alignBtns=$$("[data-align]"), valignBtns=$$("[data-valign]");
const swatchesWrap=$("#swatches"), addSwatchBtn=$("#addSwatchBtn");
const bgSwatches=$("#bgSwatches"), addBgSwatchBtn=$("#addBgSwatchBtn");
const saveJsonBtn=$("#saveJsonBtn"), loadJsonInput=$("#loadJsonInput");
const fpsInput=$("#fps"), secInput=$("#seconds"), fileNameInput=$("#fileName"), downloadGifBtn=$("#downloadGifBtn");
const animList=$("#animList"), mobileInput=$("#mobileInput");
const aboutBtn=$("#aboutBtn"); $("#aboutClose").addEventListener("click",()=>$("#aboutModal").classList.add("hidden")); aboutBtn.addEventListener("click",()=>$("#aboutModal").classList.remove("hidden"));

// ---------- state ----------
let mode="edit", zoom=parseFloat(zoomSlider.value||"0.8");
const defaults={fontFamily:"Orbitron", fontSize:22, color:"#FFFFFF", lineGap:4, wordGap:6, align:"center", valign:"middle"};
const defaultPalette=["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customPalette=[], customBgPalette=[];
let doc={res:{w:96,h:128}, lines:[{words:[{text:"Hello"}]}], style:{...defaults}, bg:{type:"image", color:null, image:null, preset:null}, animations:[]};
let selected={line:0,word:0,caret:5};
let history=[], future=[]; const MAX_STACK=100;

// ---------- Presets & tiles ----------
const PRESETS={
  "96x128":[
    {id:"A", thumb:"repo/assets/thumbs/Preset_A_thumb.png", full:"repo/assets/presets/Preset_A.png"},
    {id:"B", thumb:"repo/assets/thumbs/Preset_B_thumb.png", full:"repo/assets/presets/Preset_B.png"},
  ],
  "64x64":[
    {id:"C", thumb:"repo/assets/thumbs/Preset_C_thumb.png", full:"repo/assets/presets/Preset_C.png"},
    {id:"D", thumb:"repo/assets/thumbs/Preset_D_thumb.png", full:"repo/assets/presets/Preset_D.png"},
  ]
};
function visibleSet(){ return PRESETS[`${doc.res.w}x${doc.res.h}`]||[]; }
function buildBgGrid(){
  bgGrid.innerHTML="";
  const set=visibleSet(); // two presets
  // four tiles: preset1, preset2, SOLID, UPLOAD
  const tiles=[
    {...set[0], kind:"preset", label:"Preset 1"},
    {...set[1], kind:"preset", label:"Preset 2"},
    {kind:"solid", label:"Solid", thumb:"repo/assets/thumbs/solid.png"},
    {kind:"upload", label:"Upload", thumb:"repo/assets/thumbs/upload.png"},
  ];
  tiles.forEach((t,i)=>{
    const d=document.createElement("div"); d.className="bg-tile"; d.dataset.kind=t.kind;
    const lab=document.createElement("div"); lab.className="lab"; lab.textContent=t.label;
    d.appendChild(lab);
    const img=document.createElement("img");
    img.alt=t.label;
    img.src=(t.kind==="preset")?t.thumb:(t.thumb||"");
    d.appendChild(img);
    d.addEventListener("click", async ()=>{
      $$(".bg-tile",bgGrid).forEach(x=>x.classList.remove("active"));
      d.classList.add("active");

      if(t.kind==="preset"){
        const im=new Image(); im.crossOrigin="anonymous"; im.src=t.full;
        try{ await im.decode(); }catch(e){}
        doc.bg={type:"image", color:null, image:im, preset:t.full};
        showSolidTools(false);
      } else if(t.kind==="solid"){
        doc.bg={type:"solid", color:bgSolidColor.value, image:null, preset:null};
        showSolidTools(true);
      } else if(t.kind==="upload"){
        // trigger file chooser
        bgUpload.click();
      }
      render(0,null); fitZoom();
    });
    bgGrid.appendChild(d);
  });
}
function setInitialBackground(){
  const set=visibleSet();
  if(set && set[0]){
    const im=new Image(); im.crossOrigin="anonymous"; im.src=set[0].full;
    im.onload=()=>{ doc.bg={type:"image", color:null, image:im, preset:set[0].full}; render(0,null); fitZoom(); activateTile("preset"); };
  }else{
    doc.bg={type:"solid", color:"#000000", image:null, preset:null}; render(0,null); fitZoom(); activateTile("solid"); showSolidTools(true);
  }
}
function activateTile(kind){
  const tiles=$$(".bg-tile",bgGrid);
  tiles.forEach((t,i)=>{
    const k=t.dataset.kind;
    if(kind==="preset"){
      // activate first preset by default
      if(i===0) t.classList.add("active"); else t.classList.remove("active");
    }else{
      t.classList.toggle("active", k===kind);
    }
  });
}
function showSolidTools(on){ bgSolidTools.classList.toggle("hidden", !on); }

// upload tile -> choose file
bgUpload.addEventListener("change",(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=()=>{ URL.revokeObjectURL(url); doc.bg={type:"image", color:null, image:im, preset:null}; showSolidTools(false); render(0,null); fitZoom(); activateTile("upload"); };
  im.src=url;
});

// ---------- history ----------
function pushHistory(){ history.push(JSON.stringify(doc)); if(history.length>MAX_STACK)history.shift(); future.length=0; }
function undo(){ if(!history.length)return; future.push(JSON.stringify(doc)); doc=JSON.parse(history.pop()); render(0,null); }
function redo(){ if(!future.length)return; history.push(JSON.stringify(doc)); doc=JSON.parse(future.pop()); render(0,null); }

// ---------- zoom / fit ----------
function setMode(m){ mode=m; modeEditBtn.classList.toggle("active",m==="edit"); modePrevBtn.classList.toggle("active",m!=="edit"); }
function setZoom(z){ zoom=z; zoomSlider.value=String(z.toFixed(2)); canvas.style.transform=`translate(-50%,-50%) scale(${zoom})`; }
function fitZoom(){
  const pad=18;
  const r=wrap.getBoundingClientRect();
  const availW=Math.max(40,r.width-pad*2), availH=Math.max(40,r.height-pad*2);
  const s=Math.max(0.1, Math.min(availW/doc.res.w, availH/doc.res.h));
  setZoom(s);
}
window.addEventListener("resize", fitZoom);
window.addEventListener("orientationchange", ()=> setTimeout(fitZoom,200));
fitBtn.addEventListener("click", fitZoom);
zoomSlider.addEventListener("input",(e)=> setZoom(parseFloat(e.target.value)));

// ---------- layout / measure ----------
function resolveStyle(over={}){ return {fontFamily:over.fontFamily||doc.style.fontFamily, fontSize:over.fontSize||doc.style.fontSize, color:over.color||doc.style.color}; }
function layoutDocument(){
  const pos=[];
  const fs=doc.style.fontSize;
  const lineStep=fs+(doc.style.lineGap??4);
  const totalH=doc.lines.length*lineStep;
  let startY=0;
  if(doc.style.valign==="top") startY=fs+6;
  else if(doc.style.valign==="middle") startY=(doc.res.h-totalH)/2+fs;
  else startY=doc.res.h-totalH+fs-6;
  doc.lines.forEach((line,li)=>{
    const widths=line.words.map(w=>{const st=resolveStyle(w.style); ctx.font=`${st.fontSize}px ${st.fontFamily}`; return Math.ceil(ctx.measureText(w.text||"").width);});
    const gaps=Math.max(0,line.words.length-1)*(doc.style.wordGap??6);
    const w=line.words.length?widths.reduce((a,b)=>a+b,0)+gaps:0;
    const startX=(doc.style.align==="left")?4:(doc.style.align==="center")?(doc.res.w-w)/2:(doc.res.w-w-4);
    let x=startX, y=startY+li*lineStep;
    line.words.forEach((w,wi)=>{ pos.push({line:li,word:wi,x,y,width:widths[wi]}); x+=widths[wi]+(doc.style.wordGap??6);});
  });
  return {positions:pos};
}
function measureWordBBox(li,wi){
  const line=doc.lines[li]; if(!line)return null;
  const word=line.words[wi]; if(!word)return null;
  const st=resolveStyle(word.style); ctx.font=`${st.fontSize}px ${st.fontFamily}`;
  const t=word.text||""; const m=ctx.measureText(t); const w=Math.ceil(m.width); const h=Math.ceil(st.fontSize*1.15);
  const p=layoutDocument().positions.find(v=>v.line===li&&v.word===wi); if(!p)return null;
  return {x:p.x,y:p.y-h,w,h};
}

// ---------- render ----------
function renderBg(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(doc.bg.type==="solid"){ ctx.fillStyle=doc.bg.color||"#000"; ctx.fillRect(0,0,canvas.width,canvas.height); }
  else if(doc.bg.type==="image" && doc.bg.image){ try{ ctx.drawImage(doc.bg.image,0,0,canvas.width,canvas.height); }catch(e){} }
}
function renderText(){
  const layout=layoutDocument();
  layout.positions.forEach(p=>{
    const w=doc.lines[p.line].words[p.word];
    const st=resolveStyle(w.style);
    ctx.save();
    ctx.textBaseline="alphabetic";
    ctx.font=`${st.fontSize}px ${st.fontFamily}`;
    ctx.fillStyle=st.color;
    ctx.fillText(w.text||"", p.x, p.y);

    // selection outline
    const isSel=(selected && selected.line===p.line && selected.word===p.word);
    if(isSel){
      const box=measureWordBBox(p.line,p.word);
      if(box){
        ctx.strokeStyle="rgba(255,0,255,.95)"; ctx.lineWidth=1; ctx.setLineDash([3,2]);
        ctx.shadowColor="rgba(255,0,255,.85)"; ctx.shadowBlur=6;
        ctx.strokeRect(box.x-1,box.y-1,box.w+2,box.h+2);

        // pin X inside top-right
        const rect=canvas.getBoundingClientRect(), host=wrap.getBoundingClientRect();
        const cx=rect.left + (box.x+box.w-6)*zoom;
        const cy=rect.top  + (box.y+6)*zoom;
        deleteWordFx.style.left=`${cx-host.left}px`;
        deleteWordFx.style.top =`${cy-host.top}px`;
        deleteWordFx.classList.remove("hidden");
      }
    }
    ctx.restore();
  });
}
function render(){ canvas.width=doc.res.w; canvas.height=doc.res.h; renderBg(); renderText(); }

// ---------- basic editing ----------
function pushText(str){
  const line=doc.lines[selected.line]; const word=line.words[selected.word];
  word.text = (word.text||"").slice(0,selected.caret) + str + (word.text||"").slice(selected.caret);
  selected.caret += str.length;
}
function focusEditor(){ mobileInput.value=doc.lines[selected.line].words[selected.word].text||""; mobileInput.focus(); }

canvas.addEventListener("click",(e)=>{
  const rect=canvas.getBoundingClientRect(); const x=(e.clientX-rect.left)/zoom, y=(e.clientY-rect.top)/zoom;
  const pos=layoutDocument().positions;
  let hit=null; pos.forEach(p=>{const b=measureWordBBox(p.line,p.word); if(!b)return; if(x>=b.x-2&&x<=b.x+b.w+2&&y>=b.y-2&&y<=b.y+b.h+2) hit=p;});
  if(hit){ selected={line:hit.line,word:hit.word,caret:(doc.lines[hit.line].words[hit.word].text||"").length}; render(); focusEditor(); }
});

document.addEventListener("keydown",(e)=>{
  if(mode!=="edit") return;
  if(e.key==="Enter"){ e.preventDefault(); doc.lines.splice(selected.line+1,0,{words:[{text:""}]}); selected={line:selected.line+1,word:0,caret:0}; render(); focusEditor(); return; }
  if(e.key===" " && !e.metaKey && !e.ctrlKey){ e.preventDefault(); const line=doc.lines[selected.line]; line.words.splice(selected.word+1,0,{text:""}); selected={line:selected.line,word:selected.word+1,caret:0}; render(); focusEditor(); return; }
  if(e.key.length===1 && !e.metaKey && !e.ctrlKey){ e.preventDefault(); pushText(e.key); render(); focusEditor(); }
});
mobileInput.addEventListener("input",()=>{ const w=doc.lines[selected.line].words[selected.word]; w.text=mobileInput.value; selected.caret=w.text.length; render(); });

deleteWordFx.addEventListener("click",()=>{
  const line=doc.lines[selected.line]; line.words.splice(selected.word,1);
  if(!line.words.length){ doc.lines.splice(selected.line,1); selected=doc.lines.length?{line:0,word:0,caret:0}:null; }
  else selected.word=Math.max(0,selected.word-1);
  deleteWordFx.classList.add("hidden"); render();
});

// inspector open logic (horizontal only)
function openInspector(open){ inspectorBody.classList.toggle("open", open); $("#toggleInspector").setAttribute("aria-expanded", String(open)); }
$("#toggleInspector").addEventListener("click",()=>{ const open=!inspectorBody.classList.contains("open"); openInspector(open); setTimeout(fitZoom,60); });
[accFont,accLayout,accAnim].forEach(a=> a.addEventListener("toggle",()=>{ if(a.open)[accFont,accLayout,accAnim].filter(x=>x!==a).forEach(x=>x.open=false); }));

// font & spacing controls
fontSel.addEventListener("change",()=>{ doc.style.fontFamily=fontSel.value; render(); });
fontSizeInput.addEventListener("input",()=>{ doc.style.fontSize=+fontSizeInput.value||22; render(); });
fontColorInput.addEventListener("input",()=>{ doc.style.color=fontColorInput.value; render(); });
lineGapInput.addEventListener("input",()=>{ doc.style.lineGap=+lineGapInput.value||4; render(); fitZoom(); });
wordGapInput.addEventListener("input",()=>{ doc.style.wordGap=+wordGapInput.value||6; render(); fitZoom(); });
alignBtns.forEach(b=> b.addEventListener("click",()=>{ alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); doc.style.align=b.dataset.align; render(); }));
valignBtns.forEach(b=> b.addEventListener("click",()=>{ valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); doc.style.valign=b.dataset.valign; render(); fitZoom(); }));

// swatches (font + BG default palette)
function drawSwatches(){
  const make=(wrap,list,isBg=false)=>{
    wrap.innerHTML="";
    list.forEach(c=>{
      const d=document.createElement("div"); d.className="swatch"; d.style.background=c;
      d.addEventListener("click",()=>{ if(isBg){ doc.bg={type:"solid", color:c, image:null, preset:null}; showSolidTools(true); activateTile("solid"); } else { doc.style.color=c; fontColorInput.value=c; } render(); });
      wrap.appendChild(d);
    });
  };
  make(swatchesWrap,[...defaultPalette,...customPalette],false);
  make(bgSwatches,[...defaultPalette,...customBgPalette],true);
}
addSwatchBtn.addEventListener("click",()=>{ const c=fontColorInput.value; if(!defaultPalette.includes(c)&&!customPalette.includes(c)) customPalette.push(c); drawSwatches(); });
addBgSwatchBtn.addEventListener("click",()=>{ const c=bgSolidColor.value; if(!defaultPalette.includes(c)&&!customBgPalette.includes(c)) customBgPalette.push(c); drawSwatches(); });
bgSolidColor.addEventListener("input",()=>{ doc.bg={type:"solid", color:bgSolidColor.value, image:null, preset:null}; render(); });

// modes
modePrevBtn.addEventListener("click",()=>{ mode="preview"; startPreview(); });
modeEditBtn.addEventListener("click",()=>{ mode="edit"; stopPreview(); });

// preview loop (simple for now)
let rafId=null,t0=0;
function startPreview(){ if(rafId)cancelAnimationFrame(rafId); t0=performance.now(); const loop=()=>{ render(); rafId=requestAnimationFrame(loop); }; rafId=requestAnimationFrame(loop); }
function stopPreview(){ if(rafId)cancelAnimationFrame(rafId); rafId=null; render(); }

// config
saveJsonBtn.addEventListener("click",()=>{ const blob=new Blob([JSON.stringify(doc,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="config.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); });
loadJsonInput.addEventListener("change",(e)=>{ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ doc=JSON.parse(r.result); render(); fitZoom(); }catch{} }; r.readAsText(f); });

// GIF export
function encoderToBlob(enc){ const bytes=enc.stream().bin||enc.stream().getData(); const u8=(bytes instanceof Uint8Array)?bytes:new Uint8Array(bytes); return new Blob([u8],{type:"image/gif"}); }
async function downloadGif(){
  const fps=Math.max(1,Math.min(30,parseInt(fpsInput.value||15)));
  const secs=Math.max(1,Math.min(60,parseInt(secInput.value||8)));
  const frames=fps*secs;
  const delayMs=Math.round(1000/fps);
  const W=canvas.width,H=canvas.height;
  const encoder=new GIFEncoder(); encoder.setRepeat(0); encoder.setDelay(delayMs); encoder.setQuality(10); encoder.setSize(W,H); encoder.start();
  const wasPrev=(mode==="preview"); if(wasPrev) stopPreview();
  for(let i=0;i<frames;i++){ render(); encoder.addFrame(ctx); }
  encoder.finish(); const blob=encoderToBlob(encoder);
  const url=URL.createObjectURL(blob); const name=(fileNameInput.value||"animation.gif").replace(/\.(png|jpe?g|webp)$/i,".gif");
  const a=document.createElement("a"); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),4000);
  if(wasPrev) startPreview();
}
downloadGifBtn.addEventListener("click", async ()=>{ if(!(await ensureGifLibs())){ alert("GIF export library couldn’t load. Keep internet on or ask me to inline for offline."); return; } await downloadGif(); });

// init
function init(){
  buildBgGrid();
  setInitialBackground();
  drawSwatches();
  setMode("edit");
  render();
  fitZoom();
  openInspector(false);
}
init();
