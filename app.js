/* ============================================
   LED Backpack Animator — v2.9.2 (Full Build)
   - Fully centered canvas (vertical + horizontal)
   - On-canvas typing, blinking caret
   - All 19 animations + mobile GIF export
   - Horizontal inspector toolbar only
   - About modal with @theskylincoln link
   ============================================ */

/* ---------- Tiny Helpers ---------- */
const $  = (q, el=document)=>el.querySelector(q);
const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));
const on = (el, ev, fn)=>el && el.addEventListener(ev, fn);

/* ---------- DOM ---------- */
const canvas=$("#led"), ctx=canvas.getContext("2d"), wrap=$(".canvas-wrap");
const resSel=$("#resSelect"), bgGrid=$("#bgGrid"), bgSolidTools=$("#bgSolidTools");
const bgSolidColor=$("#bgSolidColor"), bgSwatches=$("#bgSwatches");
const addBgSwatchBtn=$("#addBgSwatchBtn"), bgUpload=$("#bgUpload");

const zoomSlider=$("#zoom"), fitBtn=$("#fitBtn");
const modeEditBtn=$("#modeEdit"), modePrevBtn=$("#modePreview");
const undoBtn=$("#undoBtn"), redoBtn=$("#redoBtn"), clearAllBtn=$("#clearAllBtn");
const addWordBtn=$("#addWordBtn"), addLineBtn=$("#addLineBtn"), deleteWordFx=$("#deleteWordBtn");
const inspectorToggle=$("#toggleInspector"), inspectorBody=$("#inspectorBody");
const fontSel=$("#fontSelect"), fontSizeInput=$("#fontSize"), autoSizeChk=$("#autoSize");
const fontColorInput=$("#fontColor"), swatchesWrap=$("#swatches"), addSwatchBtn=$("#addSwatchBtn");
const lineGapInput=$("#lineGap"), wordGapInput=$("#wordGap");
const alignBtns=$$("[data-align]"), valignBtns=$$("[data-valign]");
const animList=$("#animList"), saveJsonBtn=$("#saveJsonBtn"), loadJsonInput=$("#loadJsonInput");
const fileNameInput=$("#fileName"), fpsInput=$("#fps"), secInput=$("#seconds");
const previewBtn=$("#previewRenderBtn"), gifBtn=$("#gifRenderBtn"), gifPreviewImg=$("#gifPreview");
const tCur=$("#tCur"), tEnd=$("#tEnd"), progressBar=$("#progress");
const aboutBtn=$("#aboutBtn");
$("#aboutClose")?.addEventListener("click",()=>$("#aboutModal").classList.add("hidden"));
aboutBtn?.addEventListener("click",()=>$("#aboutModal").classList.remove("hidden"));

/* ---------- State ---------- */
let mode="edit", zoom=parseFloat(zoomSlider?.value||"0.95");
const defaults={fontFamily:"Orbitron",fontSize:22,color:"#FFFFFF",lineGap:4,wordGap:6,align:"center",valign:"middle"};
const defaultPalette=["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customPalette=[],customBgPalette=[];
let history=[],future=[],selected={line:0,word:0,caret:0};
const MAX_STACK=100;

/* ---------- Default Document ---------- */
let doc={
  res:{w:96,h:128},
  lines:[
    {words:[{text:"WILL",style:{color:"#1E90FF"}}]},
    {words:[{text:"WHEELIE",style:{color:"#32CD32"}}]},
    {words:[{text:"FOR",style:{color:"#FFFFFF"}}]},
    {words:[{text:"BOOKTOK",style:{color:"#FF66CC"}}]},
    {words:[{text:"GIRLIES",style:{color:"#FF3333"}}]}
  ],
  style:{...defaults,align:"center",valign:"middle"},
  bg:{type:"image",preset:"assets/presets/96x128/Preset_A.png",image:null,color:null},
  animations:[{id:"pulse",params:{scale:0.02,vy:2}},{id:"glow",params:{intensity:0.35}},{id:"sweep",params:{speed:0.5,width:0.18}}]
};

/* ---------- Presets & Background Grid ---------- */
const PRESETS={
  "96x128":[
    {id:"A",thumb:"assets/thumbs/Preset_A_thumb.png",full:"assets/presets/96x128/Preset_A.png"},
    {id:"B",thumb:"assets/thumbs/Preset_B_thumb.png",full:"assets/presets/96x128/Preset_B.png"}
  ],
  "64x64":[
    {id:"C",thumb:"assets/thumbs/Preset_C_thumb.png",full:"assets/presets/64x64/Preset_C.png"},
    {id:"D",thumb:"assets/thumbs/Preset_D_thumb.png",full:"assets/presets/64x64/Preset_D.png"}
  ],
};
const visibleSet=()=>PRESETS[`${doc.res.w}x${doc.res.h}`]||[];

function buildBgGrid(){
  bgGrid.innerHTML="";
  const set=visibleSet();
  const tiles=[
    {...set[0],kind:"preset"},
    {...set[1],kind:"preset"},
    {kind:"solid",thumb:"assets/thumbs/Solid_thumb.png"},
    {kind:"upload",thumb:"assets/thumbs/Upload_thumb.png"},
  ].filter(Boolean);
  tiles.forEach(t=>{
    const d=document.createElement("div");
    d.className="bg-tile"; d.dataset.kind=t.kind;
    const img=document.createElement("img"); img.src=t.thumb; d.appendChild(img);
    on(d,"click",async()=>{
      $$(".bg-tile",bgGrid).forEach(x=>x.classList.remove("active"));
      d.classList.add("active");
      if(t.kind==="preset"){
        const im=new Image(); im.crossOrigin="anonymous"; im.src=t.full; await im.decode().catch(()=>{});
        doc.bg={type:"image",image:im,preset:t.full,color:null}; showSolidTools(false);
      }else if(t.kind==="solid"){doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null};showSolidTools(true);}
      else if(t.kind==="upload"){bgUpload.click();return;}
      autoSizeAllIfOn(); render(0,getTotalSeconds()); fitZoom();
    });
    bgGrid.appendChild(d);
  });
  const first=$(".bg-tile",bgGrid); if(first)first.classList.add("active");
}
function showSolidTools(show){bgSolidTools.classList.toggle("hidden",!show);}
on(bgUpload,"change",e=>{
  const f=e.target.files?.[0]; if(!f)return;
  const url=URL.createObjectURL(f); const im=new Image();
  im.onload=()=>{URL.revokeObjectURL(url);doc.bg={type:"image",image:im,preset:null,color:null};
    showSolidTools(false);autoSizeAllIfOn();render(0,getTotalSeconds());fitZoom();};
  im.src=url;
});
/* ============================================
   PART 2 — Layout, Render, Typing, Animations,
             Inspector bindings, Undo/Redo,
             Export (GIF/ZIP fallback), Utilities
   ============================================ */

/* ---------- Utilities & History ---------- */
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
function pushHistory(){
  history.push(JSON.stringify(doc));
  if(history.length>MAX_STACK) history.shift();
  future.length = 0;
}
function undo(){
  if(!history.length) return;
  future.push(JSON.stringify(doc));
  const prev = history.pop();
  Object.assign(doc, JSON.parse(prev));
  autoSizeAllIfOn(); render(0, getTotalSeconds());
}
function redo(){
  if(!future.length) return;
  history.push(JSON.stringify(doc));
  const nxt = future.pop();
  Object.assign(doc, JSON.parse(nxt));
  autoSizeAllIfOn(); render(0, getTotalSeconds());
}
on(undoBtn,'click',undo);
on(redoBtn,'click',redo);

/* ---------- Resolution / Zoom / Fit ---------- */
function setRes(w,h){
  doc.res = {w,h};
  canvas.width  = w;
  canvas.height = h;
  fitZoom(true);
  buildBgGrid();
  autoSizeAllIfOn(); render(0,getTotalSeconds());
}
function fitZoom(center=false){
  if(!wrap) return;
  const bw = wrap.clientWidth, bh = wrap.clientHeight || (wrap.parentElement?.clientHeight||400);
  const pad=16;
  const scale = Math.min((bw-pad)/doc.res.w, (bh-pad)/doc.res.h);
  zoom = Math.max(0.2, Math.min(3, scale));
  applyZoom(center);
}
function applyZoom(center=false){
  canvas.style.transform = `scale(${zoom})`;
  canvas.style.transformOrigin = 'top left';
  if(center){
    const w = doc.res.w*zoom, h = doc.res.h*zoom;
    wrap.style.setProperty('--cW', `${w}px`);
    wrap.style.setProperty('--cH', `${h}px`);
  }
}
on(zoomSlider,'input', (e)=>{ zoom=parseFloat(e.target.value); applyZoom(); });

/* ---------- Caret + Edit mode ---------- */
let caretBlink = {last:0, on:true};
let editActive = true; // mode === 'edit'
on(modeEditBtn,'click', ()=>{ mode='edit'; editActive=true; render(0,getTotalSeconds()); });
on(modePrevBtn,'click', ()=>{ mode='preview'; editActive=false; render(0,getTotalSeconds()); });

/* ---------- Layout & Autosize ---------- */
function measureWord(ctx, word){
  const fam = word.style?.fontFamily || doc.style.fontFamily || defaults.fontFamily;
  const size = word.style?.fontSize || doc.style.fontSize || defaults.fontSize;
  ctx.font = `${size}px ${fam}`;
  const met = ctx.measureText(word.text || '');
  const w = Math.ceil(met.width);
  const h = Math.ceil(size*1.2);
  return {w,h,size,fam};
}
function lineWidth(ctx, line, gap){
  let sum=0;
  line.words.forEach((w,i)=>{
    sum += measureWord(ctx,w).w;
    if(i<line.words.length-1) sum += gap;
  });
  return sum;
}
function autosizeLine(ctx, line, maxWidth, gap){
  // shrink uniformly until it fits; grow is off (keeps explicit sizes)
  // determine the max font size used in this line
  let sizes = line.words.map(w=>w.style?.fontSize || doc.style.fontSize || defaults.fontSize);
  let maxSz = Math.max(...sizes);
  if(maxSz<6) return;
  let width = lineWidth(ctx, line, gap);
  if(width<=maxWidth) return; // already fits
  while(width>maxWidth && maxSz>6){
    line.words.forEach(w=>{
      const cur = w.style?.fontSize ?? (w.style ||= {}, w.style.fontSize = doc.style.fontSize);
      w.style.fontSize = Math.max(6, Math.round((w.style.fontSize||doc.style.fontSize)*0.95));
    });
    maxSz = Math.max(...line.words.map(w=>w.style.fontSize||doc.style.fontSize));
    width = lineWidth(ctx, line, gap);
  }
}
function autoSizeAllIfOn(){
  if(!autoSizeChk?.checked) return;
  const pad=4;
  const maxW = doc.res.w - pad*2;
  const gapW = doc.style.wordGap ?? defaults.wordGap;
  const _snap = JSON.stringify(doc.lines);
  doc.lines.forEach(line=> autosizeLine(ctx, line, maxW, gapW));
  // only push history if something changed
  if(JSON.stringify(doc.lines)!==_snap) pushHistory();
}
function positionLines(ctx){
  // compute centered positions (horizontal + vertical)
  const pad=4;
  const gapL = doc.style.lineGap ?? defaults.lineGap;
  const gapW = doc.style.wordGap ?? defaults.wordGap;

  // vertical block height
  const heights = doc.lines.map(ln=>{
    if(ln.words.length===0) return 0;
    const h = Math.max(...ln.words.map(w=>measureWord(ctx,w).h));
    return h;
  });
  const totalH = heights.reduce((a,b)=>a+b,0) + gapL*(doc.lines.length-1);
  let startY;
  const valign = doc.style.valign || defaults.valign; // 'top','middle','bottom'
  if(valign==='top') startY = pad;
  else if(valign==='bottom') startY = doc.res.h - pad - totalH;
  else startY = Math.round((doc.res.h - totalH)/2);

  const out = [];
  let y = startY;
  for(let li=0; li<doc.lines.length; li++){
    const line = doc.lines[li];
    // per-line height
    const lh = Math.max(...line.words.map(w=>measureWord(ctx,w).h));
    // width of this line
    const widths = line.words.map(w=>measureWord(ctx,w).w);
    const lineW = widths.reduce((a,b)=>a+b,0) + gapW*(Math.max(0, widths.length-1));

    let xStart;
    const align = line.align || doc.style.align || defaults.align; // 'left','center','right'
    if(align==='left') xStart = pad;
    else if(align==='right') xStart = doc.res.w - pad - lineW;
    else xStart = Math.round((doc.res.w - lineW)/2);

    let x = xStart;
    const words = line.words.map((w,wi)=>{
      const m = measureWord(ctx, w);
      const obj = { li, wi, x, y, w:m.w, h:m.h, style: { size:m.size, fam:m.fam }, ref:w };
      x += m.w;
      if(wi<line.words.length-1) x += gapW;
      return obj;
    });
    out.push({ y, h: lh, words });
    y += lh + gapL;
  }
  return out;
}

/* ---------- Drawing ---------- */
function drawBackground(){
  const bg = doc.bg;
  if(bg?.type==='solid'){
    ctx.fillStyle = bg.color || '#000000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }else if(bg?.type==='image' && bg.image){
    ctx.drawImage(bg.image, 0,0, doc.res.w, doc.res.h);
  }else{
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
}
function drawWordPlaced(wp, tNorm){
  const word = wp.ref;
  const col  = word.style?.color || doc.style.color || defaults.color;
  const size = wp.style.size;
  ctx.font = `${size}px ${wp.style.fam}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // Apply animation transforms/style per-word
  ctx.save();
  const {x,y} = applyAnimationsBeforeDraw(wp, tNorm);

  ctx.fillStyle = col;
  ctx.fillText(word.text || '', x, y);

  applyAnimationsAfterDraw(wp, tNorm, x, y);
  ctx.restore();
}
function drawSelectionBox(wp){
  ctx.save();
  ctx.strokeStyle = '#ff33cc';
  ctx.setLineDash([3,3]);
  ctx.lineWidth = 1;
  const pad=1;
  ctx.strokeRect(wp.x-pad, wp.y-pad, wp.w+pad*2, wp.h+pad*2);
  // pinned ×
  ctx.setLineDash([]);
  ctx.fillStyle = '#ff33cc';
  ctx.font = '8px monospace';
  ctx.fillText('×', wp.x + wp.w - 5, wp.y - 7);
  ctx.restore();
}
function drawCaret(wp){
  // blinking caret at end of the selected word (based on selected.caret index)
  const time = performance.now();
  if(time - caretBlink.last > 500){ caretBlink.on = !caretBlink.on; caretBlink.last = time; }
  if(!caretBlink.on) return;

  ctx.save();
  ctx.strokeStyle = '#ff33cc';
  ctx.lineWidth = 1;
  const word = wp.ref;
  const textLeft = wp.x;
  // measure up to caret index:
  const upTo = (word.text||'').slice(0, Math.min(selected.caret, (word.text||'').length));
  const m = ctx.measureText(upTo);
  const cx = textLeft + m.width;
  const top = wp.y;
  const bot = wp.y + wp.h - 2;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, bot);
  ctx.stroke();
  ctx.restore();
}

/* ---------- Main Render ---------- */
function getTotalSeconds(){ return Math.max(1, parseFloat(secInput?.value||'4')); }
function getFPS(){ return Math.max(1, parseInt(fpsInput?.value||'10',10)); }

function render(curr=0,total=getTotalSeconds()){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBackground();

  const placed = positionLines(ctx);
  // normalized time for animations 0..1
  const tNorm = (mode==='preview') ? ((curr % total) / total) : 0;

  placed.forEach((line, li)=>{
    line.words.forEach((wp, wi)=>{
      drawWordPlaced(wp, tNorm);
      if(editActive && selected.line===li && selected.word===wi){
        drawSelectionBox(wp);
        drawCaret(wp);
      }
    });
  });
}

/* ---------- Pointer & Hit Testing ---------- */
function hitWord(px, py){
  const placed = positionLines(ctx);
  for(const line of placed){
    for(const wp of line.words){
      if(px>=wp.x-1 && px<=wp.x+wp.w+1 && py>=wp.y-1 && py<=wp.y+wp.h+1) return wp;
    }
  }
  return null;
}

canvas.addEventListener('mousedown', (e)=>{
  const r = canvas.getBoundingClientRect();
  const px = (e.clientX - r.left) * (canvas.width / r.width);
  const py = (e.clientY - r.top)  * (canvas.height / r.height);
  const wp = hitWord(px, py);
  if(!wp){
    // deselect
    selected = {line:0,word:0,caret:0};
    render(0,getTotalSeconds());
    return;
  }
  selected.line = wp.li;
  selected.word = wp.wi;

  // place caret based on click X
  const word = doc.lines[wp.li].words[wp.wi];
  ctx.font = `${wp.style.size}px ${wp.style.fam}`;
  let caret=0, bestDx=1e9, baseX=wp.x;
  for(let i=0;i<=word.text.length;i++){
    const m = ctx.measureText(word.text.slice(0,i));
    const x = baseX+m.width;
    const dx = Math.abs(px-x);
    if(dx<bestDx){ bestDx=dx; caret=i; }
  }
  selected.caret = caret;
  render(0,getTotalSeconds());
});

/* ---------- Keyboard / On-Canvas Typing ---------- */
window.addEventListener('keydown', (e)=>{
  if(!editActive) return;

  const ln = doc.lines[selected.line] || (doc.lines[0] ||= {words:[{text:'',style:{}}]});
  const w  = ln.words[selected.word]   || (ln.words[0]   ||= {text:'',style:{}});

  // actions
  if(e.key==='Enter'){
    e.preventDefault();
    pushHistory();
    // new line below, selection to first word
    const newLine = {words: [{text:'', style:{}}]};
    doc.lines.splice(selected.line+1, 0, newLine);
    selected.line += 1; selected.word = 0; selected.caret = 0;
    autoSizeAllIfOn(); render(0,getTotalSeconds());
    return;
  }
  if(e.key===' '){
    e.preventDefault();
    pushHistory();
    // new word on same line after current
    const newWord = {text:'', style:{color:w.style?.color, fontFamily:w.style?.fontFamily, fontSize:w.style?.fontSize}};
    ln.words.splice(selected.word+1, 0, newWord);
    selected.word += 1; selected.caret = 0;
    autoSizeAllIfOn(); render(0,getTotalSeconds());
    return;
  }
  if(e.key==='Backspace'){
    e.preventDefault();
    if(selected.caret>0){
      pushHistory();
      w.text = (w.text||'').slice(0,selected.caret-1) + (w.text||'').slice(selected.caret);
      selected.caret -= 1;
      autoSizeAllIfOn(); render(0,getTotalSeconds());
    }else{
      // caret at 0: merge with previous word or delete if empty
      if(selected.word>0){
        pushHistory();
        const prev = ln.words[selected.word-1];
        const prevLen = (prev.text||'').length;
        prev.text = (prev.text||'') + (w.text||'');
        ln.words.splice(selected.word,1);
        selected.word -= 1;
        selected.caret = prevLen;
        autoSizeAllIfOn(); render(0,getTotalSeconds());
      }else if(selected.line>0){
        pushHistory();
        // merge with end of previous line
        const pl = doc.lines[selected.line-1];
        const lastIdx = Math.max(0, pl.words.length-1);
        const last = pl.words[lastIdx];
        const lastLen = (last.text||'').length;
        last.text = (last.text||'') + (w.text||'');
        // remove the (now-empty) first word/line if applicable
        ln.words.splice(selected.word,1);
        if(ln.words.length===0) doc.lines.splice(selected.line,1);
        selected.line -= 1; selected.word = Math.max(0,lastIdx); selected.caret = lastLen;
        autoSizeAllIfOn(); render(0,getTotalSeconds());
      }
    }
    return;
  }
  if(e.key==='ArrowLeft'){
    e.preventDefault();
    if(selected.caret>0){ selected.caret--; render(0,getTotalSeconds()); }
    else if(selected.word>0){
      selected.word--; selected.caret = (ln.words[selected.word].text||'').length; render(0,getTotalSeconds());
    }
    return;
  }
  if(e.key==='ArrowRight'){
    e.preventDefault();
    const len = (w.text||'').length;
    if(selected.caret<len){ selected.caret++; render(0,getTotalSeconds()); }
    else if(selected.word<ln.words.length-1){
      selected.word++; selected.caret = 0; render(0,getTotalSeconds());
    }
    return;
  }
  if(e.key==='Delete'){
    e.preventDefault();
    pushHistory();
    if(selected.caret < (w.text||'').length){
      w.text = (w.text||'').slice(0,selected.caret) + (w.text||'').slice(selected.caret+1);
    }else if(selected.word < ln.words.length-1){
      const nxt = ln.words[selected.word+1];
      w.text = (w.text||'') + (nxt.text||'');
      ln.words.splice(selected.word+1,1);
    }else if(selected.line < doc.lines.length-1){
      const nxtLn = doc.lines[selected.line+1];
      if(nxtLn.words.length){
        const first = nxtLn.words[0];
        w.text = (w.text||'') + (first.text||'');
        nxtLn.words.shift();
        if(nxtLn.words.length===0) doc.lines.splice(selected.line+1,1);
      }
    }
    autoSizeAllIfOn(); render(0,getTotalSeconds());
    return;
  }

  // printable input
  if(e.key.length===1 && !e.metaKey && !e.ctrlKey){
    pushHistory();
    const txt = w.text||'';
    w.text = txt.slice(0,selected.caret) + e.key + txt.slice(selected.caret);
    selected.caret += 1;
    autoSizeAllIfOn(); render(0,getTotalSeconds());
  }
});

/* ---------- Toolbar Buttons ---------- */
on(addWordBtn,'click', ()=>{
  pushHistory();
  const ln = doc.lines[selected.line] || (doc.lines[0] ||= {words:[]});
  const src = ln.words[selected.word] || {style:{}};
  const newWord = {text:'', style:{color:src.style?.color, fontFamily:src.style?.fontFamily, fontSize:src.style?.fontSize}};
  ln.words.splice(selected.word+1,0,newWord);
  selected.word += 1; selected.caret=0;
  render(0,getTotalSeconds());
});
on(addLineBtn,'click', ()=>{
  pushHistory();
  doc.lines.splice(selected.line+1,0,{words:[{text:'',style:{}}]});
  selected.line += 1; selected.word=0; selected.caret=0;
  render(0,getTotalSeconds());
});
on(deleteWordFx,'click', ()=>{
  pushHistory();
  const ln = doc.lines[selected.line];
  ln.words.splice(selected.word,1);
  if(ln.words.length===0){ doc.lines.splice(selected.line,1); selected.line = Math.max(0, selected.line-1); selected.word=0; }
  else selected.word = Math.max(0, selected.word-1);
  selected.caret = (doc.lines[selected.line]?.words[selected.word]?.text||'').length;
  render(0,getTotalSeconds());
});
on(clearAllBtn,'click', ()=>{
  pushHistory();
  doc.lines = [{words:[{text:'',style:{}}]}];
  selected = {line:0,word:0,caret:0};
  render(0,getTotalSeconds());
});

/* ---------- Inspector Bindings ---------- */
on(fontSel,'change', ()=>{
  pushHistory();
  const w = doc.lines[selected.line]?.words[selected.word];
  if(!w) return;
  (w.style ||= {}).fontFamily = fontSel.value;
  render(0,getTotalSeconds());
});
on(fontSizeInput,'input', ()=>{
  pushHistory();
  const w = doc.lines[selected.line]?.words[selected.word];
  if(!w) return;
  (w.style ||= {}).fontSize = parseInt(fontSizeInput.value||`${defaults.fontSize}`,10);
  render(0,getTotalSeconds());
});
on(autoSizeChk,'change', ()=>{ pushHistory(); autoSizeAllIfOn(); render(0,getTotalSeconds()); });
on(fontColorInput,'input', ()=>{
  pushHistory();
  const w = doc.lines[selected.line]?.words[selected.word];
  if(!w) return;
  (w.style ||= {}).color = fontColorInput.value;
  render(0,getTotalSeconds());
});
on(lineGapInput,'input', ()=>{
  pushHistory();
  doc.style.lineGap = parseInt(lineGapInput.value||`${defaults.lineGap}`,10);
  render(0,getTotalSeconds());
});
on(wordGapInput,'input', ()=>{
  pushHistory();
  doc.style.wordGap = parseInt(wordGapInput.value||`${defaults.wordGap}`,10);
  render(0,getTotalSeconds());
});
alignBtns.forEach(btn=>{
  on(btn,'click', ()=>{
    pushHistory();
    doc.style.align = btn.dataset.align; // left|center|right
    render(0,getTotalSeconds());
  });
});
valignBtns.forEach(btn=>{
  on(btn,'click', ()=>{
    pushHistory();
    doc.style.valign = btn.dataset.valign; // top|middle|bottom
    render(0,getTotalSeconds());
  });
});

/* ---------- Swatches (Text + BG) ---------- */
function makeSwatch(color, onPick){
  const b = document.createElement('button');
  b.className = 'swatch';
  b.style.background = color;
  b.title = color;
  b.addEventListener('click', ()=> onPick(color));
  return b;
}
function rebuildSwatches(){
  swatchesWrap.innerHTML='';
  [...defaultPalette, ...customPalette].forEach(c=>{
    swatchesWrap.appendChild(makeSwatch(c, (col)=>{
      pushHistory();
      const w = doc.lines[selected.line]?.words[selected.word];
      if(!w) return;
      (w.style ||= {}).color = col;
      fontColorInput.value = col;
      render(0,getTotalSeconds());
    }));
  });
}
rebuildSwatches();
on(addSwatchBtn,'click', ()=>{
  const col = fontColorInput.value || '#FFFFFF';
  customPalette.push(col);
  rebuildSwatches();
});

function rebuildBgSwatches(){
  bgSwatches.innerHTML='';
  [...defaultPalette, ...customBgPalette].forEach(c=>{
    bgSwatches.appendChild(makeSwatch(c, (col)=>{
      pushHistory();
      doc.bg = {type:'solid', color:col, image:null, preset:null};
      bgSolidColor.value = col;
      showSolidTools(true);
      render(0,getTotalSeconds());
    }));
  });
}
rebuildBgSwatches();
on(addBgSwatchBtn,'click', ()=>{
  const col = bgSolidColor.value || '#000000';
  customBgPalette.push(col);
  rebuildBgSwatches();
});

/* ---------- Save/Load JSON ---------- */
on(saveJsonBtn,'click', ()=>{
  const name = (fileNameInput?.value || 'animation').replace(/[^\w\-]+/g,'_');
  const blob = new Blob([JSON.stringify(doc,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),0);
});
on(loadJsonInput,'change', (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  const rd = new FileReader();
  rd.onload = ()=>{
    try{
      pushHistory();
      Object.assign(doc, JSON.parse(rd.result));
      // reload background image if preset path exists
      if(doc.bg?.type==='image' && typeof doc.bg.image==='string'){
        const im = new Image(); im.crossOrigin='anonymous'; im.src = doc.bg.image;
        im.onload=()=>{ doc.bg.image = im; render(0,getTotalSeconds()); };
      }
      buildBgGrid();
      autoSizeAllIfOn(); render(0,getTotalSeconds());
    }catch(err){ console.error(err); }
  };
  rd.readAsText(f);
});

/* ---------- Preview Loop ---------- */
let rafId=null, startTs=null;
function tick(ts){
  if(!startTs) startTs = ts;
  const elapsed = (ts - startTs)/1000;
  const total = getTotalSeconds();
  render(elapsed, total);
  tCur && (tCur.textContent = (elapsed%total).toFixed(1)+'s');
  tEnd && (tEnd.textContent = total.toFixed(1)+'s');
  const pct = Math.min(100, ((elapsed%total)/total)*100);
  if(progressBar) progressBar.style.width = pct+'%';
  rafId = requestAnimationFrame(tick);
}
on(previewBtn,'click', ()=>{
  if(rafId){ cancelAnimationFrame(rafId); rafId=null; startTs=null; }
  mode='preview'; editActive=false;
  rafId = requestAnimationFrame(tick);
});

/* ---------- GIF Export (uses GIFEncoder if present; ZIP fallback) ---------- */
async function exportGIF(){
  const fps = getFPS();
  const seconds = getTotalSeconds();
  const frames = Math.max(1, Math.round(fps*seconds));
  const name = (fileNameInput?.value || 'animation').replace(/[^\w\-]+/g,'_');

  // If a global GIFEncoder is available (e.g., gif.js/omggif wrapper), use it:
  if(typeof GIFEncoder!=='undefined'){
    const enc = new GIFEncoder(doc.res.w, doc.res.h);
    enc.setRepeat(0);
    enc.setDelay(Math.round(1000/fps));
    enc.start();

    const off = document.createElement('canvas');
    off.width=doc.res.w; off.height=doc.res.h;
    const octx = off.getContext('2d',{willReadFrequently:true});

    for(let i=0;i<frames;i++){
      // render frame i
      octx.clearRect(0,0,off.width,off.height);
      // temporarily swap ctx/canvas
      const backup = {canvas, ctx, mode};
      window.canvas = off; window.ctx = octx; mode='preview';
      drawBackground(); // uses doc.bg, already points to off via globals
      const tNorm = (i/frames);
      const placed = positionLines(octx);
      placed.forEach(line=> line.words.forEach(wp=> drawWordPlaced(wp, tNorm)));
      // restore
      window.canvas = backup.canvas; window.ctx = backup.ctx; mode=backup.mode;

      const frameData = octx.getImageData(0,0,off.width,off.height).data;
      enc.addFrame(frameData, true);
    }
    enc.finish();
    const binary_gif = enc.stream().getData();
    const blob = new Blob([new Uint8Array(binary_gif)], {type:'image/gif'});
    triggerDownload(blob, `${name}.gif`);
    // preview
    if(gifPreviewImg){
      gifPreviewImg.src = URL.createObjectURL(blob);
      gifPreviewImg.classList.remove('hidden');
    }
    return;
  }

  // Fallback: ZIP of PNG frames (works everywhere, including iOS Files app)
  const zip = new JSZip();
  const off = document.createElement('canvas');
  off.width=doc.res.w; off.height=doc.res.h;
  const octx = off.getContext('2d');

  for(let i=0;i<frames;i++){
    octx.clearRect(0,0,off.width,off.height);
    const backup = {canvas, ctx, mode};
    window.canvas = off; window.ctx = octx; mode='preview';
    drawBackground();
    const tNorm = (i/frames);
    const placed = positionLines(octx);
    placed.forEach(line=> line.words.forEach(wp=> drawWordPlaced(wp, tNorm)));
    window.canvas = backup.canvas; window.ctx = backup.ctx; mode=backup.mode;

    const dataURL = off.toDataURL('image/png');
    const b64 = dataURL.split(',')[1];
    zip.file(`frame_${String(i).padStart(3,'0')}.png`, b64, {base64:true});
  }
  const blob = await zip.generateAsync({type:'blob'});
  triggerDownload(blob, `${name}_frames.zip`);
}
on(gifBtn,'click', exportGIF);

function triggerDownload(blob, filename){
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}

/* ---------- Animations (19) ---------- */
/*
  Applied per-word each frame. We split into two hooks:
  - applyAnimationsBeforeDraw(wp, tNorm) -> returns possibly shifted (x,y)
  - applyAnimationsAfterDraw(wp, tNorm, x, y) -> effects that require post-fill (e.g., outlines)
*/
const ANIMS = {
  none:      (wp,t)=>({x:wp.x,y:wp.y}),
  flicker:   (wp,t)=>({x:wp.x,y:wp.y, alpha: 0.7+0.3*Math.random()}),
  pulse:     (wp,t)=>({x:wp.x,y:wp.y, scale: 1+0.05*Math.sin(t*2*Math.PI)}),
  glow:      (wp,t)=>({x:wp.x,y:wp.y, shadowBlur: 6+6*Math.sin(t*2*Math.PI)}),
  sweep:     (wp,t)=>({x:wp.x,y:wp.y, sweep: t}), // used after draw
  waveX:     (wp,t)=>({x:wp.x + Math.sin(t*2*Math.PI + wp.li*0.7)*1.5, y:wp.y}),
  waveY:     (wp,t)=>({x:wp.x, y:wp.y + Math.sin(t*2*Math.PI + wp.wi*0.7)*2}),
  jitter:    (wp,t)=>({x:wp.x + (Math.random()-0.5)*1.0, y:wp.y + (Math.random()-0.5)*1.0}),
  bounceY:   (wp,t)=>({x:wp.x, y:wp.y + Math.abs(Math.sin(t*2*Math.PI))*2}),
  bounceX:   (wp,t)=>({x:wp.x + Math.abs(Math.sin(t*2*Math.PI))*2, y:wp.y}),
  shake:     (wp,t)=>({x:wp.x + (Math.random()<0.5?-1:1), y:wp.y+(Math.random()<0.5?-1:1)}),
  typeOn:    (wp,t)=>({x:wp.x, y:wp.y, chars: Math.max(0, Math.floor(((wp.ref.text||'').length)*t))}),
  fadeInOut: (wp,t)=>({x:wp.x, y:wp.y, alpha: 0.5+0.5*Math.sin(t*2*Math.PI)}),
  rainbow:   (wp,t)=>({x:wp.x, y:wp.y, hue: (t*360 + wp.wi*30)%360}),
  outlinePulse:(wp,t)=>({x:wp.x,y:wp.y, outline: 1+1*Math.abs(Math.sin(t*2*Math.PI))}),
  blurPulse: (wp,t)=>({x:wp.x,y:wp.y, shadowBlur: 2+4*Math.abs(Math.sin(t*2*Math.PI))}),
  marqueeLeft:(wp,t)=>({x:wp.x - (t*doc.res.w)% (wp.w+8), y:wp.y}),
  marqueeRight:(wp,t)=>({x:wp.x + (t*doc.res.w)% (wp.w+8), y:wp.y}),
  twinkle:   (wp,t)=>({x:wp.x, y:wp.y, alpha: (Math.sin((t+wp.wi*0.17)*25)*0.3+0.7)}),
};

function activeAnimList(){
  // doc.animations is an array of {id, params}
  // For simplicity we apply ALL listed animations to every word.
  // (You can later add per-word anim map if needed.)
  return doc.animations?.length ? doc.animations.map(a=>a.id) : [];
}

function applyAnimationsBeforeDraw(wp, t){
  const acts = activeAnimList();
  let x=wp.x, y=wp.y, alpha=1, scale=1, shadowBlur=0, hue=null, chars=null, outline=null;

  acts.forEach(id=>{
    const eff = ANIMS[id];
    if(!eff) return;
    const res = eff(wp,t) || {};
    if(res.x!=null) x=res.x;
    if(res.y!=null) y=res.y;
    if(res.alpha!=null) alpha*=res.alpha;
    if(res.scale!=null) scale*=res.scale;
    if(res.shadowBlur!=null) shadowBlur = Math.max(shadowBlur,res.shadowBlur);
    if(res.hue!=null) hue = res.hue;
    if(res.chars!=null) chars = res.chars;
    if(res.outline!=null) outline = res.outline;
  });

  // apply canvas-side styles
  if(alpha!==1) ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  if(shadowBlur>0){ ctx.shadowColor = '#ffffff'; ctx.shadowBlur = shadowBlur; }
  if(scale!==1){ ctx.translate(x,y); ctx.scale(scale,scale); ctx.translate(-x,-y); }

  // hue shift via fillStyle adjusted later (simple HSL hack)
  if(hue!=null){
    // We'll alter fill after this function in drawWordPlaced (via ctx.fillStyle = ...)
    // To keep simple, we'll draw baseline then overlay hue sweep in after hook.
  }

  // typeOn effect -> temporarily trim text
  if(chars!=null){
    const full = wp.ref.text||'';
    const tmp = full.slice(0, chars);
    ctx.save();
    ctx.beginPath(); // clip to width of typed portion
    ctx.rect(x, y, ctx.measureText(tmp).width+1, wp.h);
    ctx.clip();
  }

  // store for after hook:
  wp.__anim = {hue, outline, typeOn: chars!=null, typedChars: chars, x, y};
  return {x,y};
}
function applyAnimationsAfterDraw(wp, t, x, y){
  const a = wp.__anim || {};
  // typed clip cleanup
  if(a.typeOn){ ctx.restore(); }

  // outline pulse
  if(a.outline){
    ctx.save();
    ctx.lineWidth = a.outline;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(wp.ref.text||'', x, y);
    ctx.restore();
  }

  // simple sweep highlight
  if(activeAnimList().includes('sweep')){
    ctx.save();
    const grad = ctx.createLinearGradient(0,0,canvas.width,0);
    const p = (t*1.0)%1.0;
    grad.addColorStop(Math.max(0,p-0.1),'rgba(255,255,255,0)');
    grad.addColorStop(p,'rgba(255,255,255,0.7)');
    grad.addColorStop(Math.min(1,p+0.1),'rgba(255,255,255,0)');
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, wp.w, wp.h);
    ctx.restore();
  }
}

/* ---------- Background: solid picker change ---------- */
on(bgSolidColor,'input', ()=>{
  pushHistory();
  doc.bg = {type:'solid', color:bgSolidColor.value, image:null, preset:null};
  showSolidTools(true);
  render(0,getTotalSeconds());
});

/* ---------- File name defaults ---------- */
if(fileNameInput && !fileNameInput.value) fileNameInput.value = 'led_animation';

/* ---------- Init ---------- */
(function init(){
  // canvas size & zoom
  setRes(doc.res.w, doc.res.h);
  applyZoom(true);

  // try to preload default preset
  if(doc.bg?.preset && !doc.bg.image){
    const im = new Image(); im.crossOrigin='anonymous'; im.src = doc.bg.preset;
    im.onload = ()=>{ doc.bg.image = im; render(0,getTotalSeconds()); };
  }

  // set UI initial values
  zoomSlider && (zoomSlider.value = String(zoom));
  fontSel && (fontSel.value = doc.style.fontFamily || defaults.fontFamily);
  fontSizeInput && (fontSizeInput.value = doc.style.fontSize || defaults.fontSize);
  fontColorInput && (fontColorInput.value = doc.style.color || defaults.color);
  lineGapInput && (lineGapInput.value = doc.style.lineGap || defaults.lineGap);
  wordGapInput && (wordGapInput.value = doc.style.wordGap || defaults.wordGap);
  autoSizeChk && (autoSizeChk.checked = true);

  buildBgGrid();
  autoSizeAllIfOn();
  render(0,getTotalSeconds());
})();
