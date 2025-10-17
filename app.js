
// v1.4.3 background layout + background fit fix
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const dpi = () => window.devicePixelRatio || 1;

let zoom = 1;
let editMode = true; // true = Edit Mode (no animation), false = Preview Animation
let model = [
  [{ text:'Hello', color:'#ffffff', size:22, align:'center', manual:false, x:0, y:40, fx:{pulse:false,pulseAmt:60,flicker:false,flickerAmt:40} }]
];
let selected = { line:0, word:0 };

const bg = { type:'preset', preset:'A', color:'#000000', img:null };

// History
let history=[], redo=[];
const snapshot=()=> JSON.stringify({model,bg});
function pushHistory(){ history.push(snapshot()); if(history.length>80) history.shift(); redo.length=0; }
function undo(){ if(!history.length) return; redo.push(snapshot()); const s=JSON.parse(history.pop()); model=s.model; Object.assign(bg,s.bg); draw(); }
function redoFn(){ if(!redo.length) return; history.push(snapshot()); const s=JSON.parse(redo.pop()); model=s.model; Object.assign(bg,s.bg); draw(); }

// Resolution & backgrounds
const resSel = document.getElementById('resolution');
const bgGrid = document.getElementById('bgGrid');

function setResolution(val){
  const [w,h] = val.split('x').map(n=>parseInt(n,10));
  const scale = dpi();
  canvas.width = w*scale; canvas.height = h*scale;
  ctx.setTransform(scale,0,0,scale,0,0);
  canvas.style.width = (w*zoom*3)+'px';
  canvas.style.height = (h*zoom*3)+'px';
  buildBgGrid();
  draw();
}

function bgThumb(html, onClick, extraClass=''){
  const b=document.createElement('button');
  b.className='thumb '+extraClass;
  b.type='button';
  b.innerHTML=html;
  b.addEventListener('click', onClick);
  return b;
}

function buildBgGrid(){
  bgGrid.innerHTML='';
  const res = resSel.value;
  const list = res==='96x128'
    ? [{id:'A', file:'assets/Preset_A.png', name:'Preset A'},
       {id:'B', file:'assets/Preset_B.png', name:'Preset B'}]
    : [{id:'C', file:'assets/Preset_C.png', name:'Preset C'},
       {id:'D', file:'assets/Preset_D.png', name:'Preset D'}];
  // Row 1: Preset A/C next to B/D
  list.forEach(p=>{
    const btn = bgThumb(`<img src="${p.file}" alt="${p.name}"><div class="label">${p.name}</div>`, ()=>{ bg.type='preset'; bg.preset=p.id; draw(); });
    bgGrid.appendChild(btn);
  });
  // Row 2: Solid + Custom
  const solid = bgThumb(`<div style="width:100%;height:100%;background:#000"></div><div class="label">Solid Color</div>`, ()=>{ bg.type='solid'; bg.color='#000000'; draw(); }, 'solid');
  const custom = document.createElement('label'); custom.className='thumb custom';
  custom.innerHTML = `<input id="bgUpload" type="file" accept="image/*" hidden>
                      <div class="label">Custom Upload</div>`;
  custom.querySelector('#bgUpload').addEventListener('change', (e)=>{
    const f=e.target.files[0]; if(!f) return;
    const img=new Image(); img.onload=()=>{ bg.type='image'; bg.img=img; draw(); };
    img.src = URL.createObjectURL(f);
  });
  bgGrid.appendChild(solid);
  bgGrid.appendChild(custom);
}

// Inspector bar
const inspBar = document.getElementById('inspectorBar');
function setInspectorEnabled(enabled){
  inspBar.classList.toggle('disabled', !enabled);
}
['slotFont','slotColor','slotSpacing','slotAlign','slotAnim'].forEach(id=>{
  document.getElementById(id).open = false; // start collapsed
});

// Empty state
const emptyState = document.getElementById('emptyState');
const btnAddWord = document.getElementById('btnAddWord');
function refreshEmptyState(){
  const hasWords = model.some(line => line.length>0);
  emptyState.classList.toggle('hidden', hasWords);
  setInspectorEnabled(hasWords && hasSelection());
}
btnAddWord.addEventListener('click', ()=>{
  if(model.length===0) model=[[]];
  model[0].push({ text:'New', color:'#ffffff', size:22, align:'center', manual:false, x:0, y:40, fx:{pulse:false,pulseAmt:60,flicker:false,flickerAmt:40}});
  selected={line:0,word:model[0].length-1};
  pushHistory(); draw(); refreshEmptyState();
});

// Toolbar
document.getElementById('btnPreview').addEventListener('click',()=>{ editMode=false; clearSelection(); draw(); });
document.getElementById('btnEdit').addEventListener('click',()=>{ editMode=true; clearSelection(); draw(); });
document.getElementById('btnRender').addEventListener('click',()=>{
  canvas.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='led_frame.png'; a.click(); URL.revokeObjectURL(a.href); });
});
document.getElementById('btnClearText').addEventListener('click',()=>{
  model = [[]];
  selected={line:-1,word:-1};
  pushHistory(); draw(); refreshEmptyState();
});
document.getElementById('btnUndo').addEventListener('click', ()=>undo());
document.getElementById('btnRedo').addEventListener('click', ()=>redoFn());
const zl = document.getElementById('zoomLabel');
document.getElementById('btnZoomIn').addEventListener('click',()=>{ zoom=Math.min(4,zoom+0.1); zl.textContent=Math.round(zoom*100)+'%'; setResolution(resSel.value); });
document.getElementById('btnZoomOut').addEventListener('click',()=>{ zoom=Math.max(0.25,zoom-0.1); zl.textContent=Math.round(zoom*100)+'%'; setResolution(resSel.value); });

// Inspector controls
const fontSize = document.getElementById('fontSize');
const autoSize = document.getElementById('autoSize');
const lineGapCtl = document.getElementById('lineGap');
const wordSpacingCtl = document.getElementById('wordSpacing');
const fxPulse = document.getElementById('fxPulse');
const fxFlicker = document.getElementById('fxFlicker');
const fxPulseAmt = document.getElementById('fxPulseAmt');
const fxFlickerAmt = document.getElementById('fxFlickerAmt');
const wordSwatches = document.getElementById('wordSwatches');
const wordPicker = document.getElementById('wordColorPicker');
const addWordSwatch = document.getElementById('addWordSwatch');
const DEFAULT_SWATCHES = ['#23A8FF','#32D74B','#FFD60A','#FF7AB6','#FF453A','#FFFFFF','#000000'];
let customSwatches = JSON.parse(localStorage.getItem('LED.customWordSwatches')||'[]');
function allSwatches(){ return [...DEFAULT_SWATCHES, ...customSwatches]; }
function renderWordSwatches(){
  wordSwatches.innerHTML='';
  allSwatches().forEach(hex=>{
    const d=document.createElement('button');
    d.className='sw'; d.style.background=hex; d.title=hex; d.type='button';
    d.addEventListener('click',()=>{ if(hasSelection()){ wordAt(selected).color=hex; draw(); pushHistory(); }});
    wordSwatches.appendChild(d);
  });
}
addWordSwatch.addEventListener('click',()=>{
  const hex=(wordPicker.value||'').toUpperCase(); if(!hex) return;
  if(!customSwatches.includes(hex)){ if(customSwatches.length>=5) customSwatches.shift(); customSwatches.push(hex); localStorage.setItem('LED.customWordSwatches', JSON.stringify(customSwatches)); renderWordSwatches(); }
});
renderWordSwatches();

// Alignment buttons
document.querySelectorAll('.btn.align').forEach(btn=> btn.addEventListener('click',()=>{
  if(!hasSelection()) return;
  const a=btn.dataset.align; const w=wordAt(selected);
  w.align = a==='manual'?'manual':a; w.manual=(a==='manual'); draw();
}));

document.getElementById('btnAddLine').addEventListener('click',()=>{
  model.push([{ text:'New', color:'#ffffff', size:22, align:'center', manual:false, x:0, y: lineY(model.length), fx:{pulse:false,pulseAmt:60,flicker:false,flickerAmt:40} }]);
  selected={line:model.length-1, word:0};
  pushHistory(); draw(); refreshEmptyState();
});

// Selection + inline edit
const deleteBtn = document.getElementById('btnDeleteWord');
function clearSelection(){ selected={line:-1,word:-1}; positionDelete(); setInspectorEnabled(false); }
function hasSelection(){ return selected.line>=0 && selected.word>=0; }
function wordAt(sel){ return model[sel.line][sel.word]; }
function toCanvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return { x:(e.clientX-r.left)/(3*zoom)*dpi(), y:(e.clientY-r.top)/(3*zoom)*dpi() };
}
function wordSpacing(){ return parseInt(document.getElementById('wordSpacing').value,10)||3; }
function lineGap(){ return parseInt(document.getElementById('lineGap').value,10)||2; }
function lineY(li){ const size = model[li]?.[0]?.size || 22; return size + li*(size+lineGap()); }
function textWidth(w){ ctx.font=`${w.size}px monospace`; return Math.ceil(ctx.measureText(w.text).width); }
function layoutStartX(li){
  const words = model[li]; const mode = words[0]?.align || 'center';
  if(mode==='left') return 2;
  if(mode==='right'){ let total=0; words.forEach((w,i)=> total += textWidth(w) + (i>0?wordSpacing():0)); return canvas.width/dpi() - total - 2; }
  let total=0; words.forEach((w,i)=> total += textWidth(w) + (i>0?wordSpacing():0)); return Math.floor((canvas.width/dpi() - total)/2);
}
function sumPrev(li, wi){ let s=0; for(let i=0;i<wi;i++) s += textWidth(model[li][i]) + wordSpacing(); return s; }
function boundsOf(sel){
  const w=wordAt(sel); const tw=textWidth(w);
  const x = w.manual ? w.x : layoutStartX(sel.line) + sumPrev(sel.line, sel.word);
  const y = w.manual ? w.y : lineY(sel.line);
  return {x,y,w:tw,h:w.size};
}
function positionDelete(){
  if(!hasSelection()){ deleteBtn.classList.add('hidden'); return; }
  const b=boundsOf(selected); const rect=canvas.getBoundingClientRect();
  deleteBtn.style.left = (rect.left + (b.x + b.w + 8)*3*zoom/dpi())+'px';
  deleteBtn.style.top  = (rect.top  + (b.y - 20)*3*zoom/dpi())+'px';
  deleteBtn.classList.remove('hidden');
}

canvas.addEventListener('click', (e)=>{
  const p=toCanvasPoint(e);
  const hit=hitTest(p.x,p.y);
  if(hit){
    editMode = true;
    selected=hit;
    setInspectorEnabled(true);
    openInlineEditorAtSelection();
    draw();
  }else{
    clearSelection(); draw();
  }
});

function hitTest(x,y){
  for(let li=0; li<model.length; li++){
    const line=model[li];
    let xPos = layoutStartX(li);
    for(let wi=0; wi<line.length; wi++){
      const w=line[wi]; const tw=textWidth(w);
      const bx=(w.manual?w.x:xPos), by=(w.manual?w.y:lineY(li));
      if(x>=bx-2 && x<=bx+tw+2 && y>=by-w.size && y<=by+4) return {line:li,word:wi};
      xPos += tw + wordSpacing();
    }
  }
  return null;
}

deleteBtn.addEventListener('click', ()=>{
  if(!hasSelection()) return;
  const line=model[selected.line];
  line.splice(selected.word,1);
  if(line.length===0) model.splice(selected.line,1);
  clearSelection(); pushHistory(); draw(); refreshEmptyState();
});

// Inline editor
function openInlineEditorAtSelection(){
  if(!hasSelection()) return;
  const w=wordAt(selected);
  const b=boundsOf(selected);
  const rect=canvas.getBoundingClientRect();
  const edit=document.createElement('input');
  edit.className='pill';
  edit.value=w.text;
  edit.style.left = (rect.left + (b.x)*3*zoom/dpi())+'px';
  edit.style.top  = (rect.top  + (b.y - 26)*3*zoom/dpi())+'px';
  document.body.appendChild(edit);
  edit.focus();
  edit.addEventListener('input', ()=>{
    const parts = edit.value.split(' ');
    w.text = parts[0];
    if(parts.length>1){
      const rest = parts.slice(1).map(t=>({ text:t, color:w.color, size:w.size, align:w.align, manual:w.manual, x:w.x, y:w.y, fx:Object.assign({},w.fx) }));
      model[selected.line].splice(selected.word+1, 0, ...rest);
    }
    if(document.getElementById('autoSize').checked){ fitLine(selected.line); }
    positionDelete();
    draw();
  });
  function done(){ edit.remove(); pushHistory(); }
  edit.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key==='Escape'){ done(); } });
  edit.addEventListener('blur', done);
}

// Autosize per line
function fitLine(li){
  const words = model[li]; if(!words?.length) return;
  const max = canvas.width/dpi() - 4;
  let size = words[0].size||22;
  for(let tries=0; tries<40; tries++){
    let total=0;
    for(let i=0;i<words.length;i++){ ctx.font=`${size}px monospace`; total += ctx.measureText(words[i].text).width + (i>0?wordSpacing():0); }
    if(total<=max) break; size -= 1; if(size<8) break;
  }
  words.forEach(w=> w.size=size);
}

// Animation toggles
document.getElementById('fontSize').addEventListener('input',()=>{ if(hasSelection()){ wordAt(selected).size=parseInt(fontSize.value,10)||22; draw(); }});
document.getElementById('autoSize').addEventListener('change',()=>{ if(hasSelection()) fitLine(selected.line); draw(); });
document.getElementById('lineGap').addEventListener('input',()=> draw());
document.getElementById('wordSpacing').addEventListener('input',()=> draw());

document.getElementById('fxPulse').addEventListener('change',()=>{ if(hasSelection()){ wordAt(selected).fx.pulse = document.getElementById('fxPulse').checked; draw(); }});
document.getElementById('fxFlicker').addEventListener('change',()=>{ if(hasSelection()){ wordAt(selected).fx.flicker = document.getElementById('fxFlicker').checked; draw(); }});
document.getElementById('fxPulseAmt').addEventListener('input',()=>{ if(hasSelection()){ wordAt(selected).fx.pulseAmt = parseInt(document.getElementById('fxPulseAmt').value,10)||60; }});
document.getElementById('fxFlickerAmt').addEventListener('input',()=>{ if(hasSelection()){ wordAt(selected).fx.flickerAmt = parseInt(document.getElementById('fxFlickerAmt').value,10)||35; }});

// Draw background fit to canvas (no cropping)
function draw(ts){
  // Clear
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Background
  if(bg.type==='solid'){
    ctx.fillStyle = bg.color;
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if(bg.type==='preset'){
    const img = new Image();
    img.onload = ()=>{
      // Always fit exactly to canvas size (no cut off)
      ctx.drawImage(img, 0,0, canvas.width, canvas.height);
      drawWords(ts);
    };
    img.src = `assets/Preset_${bg.preset}.png`;
    return;
  } else if(bg.type==='image' && bg.img){
    // Fit custom to canvas
    ctx.drawImage(bg.img, 0,0, canvas.width, canvas.height);
  }
  drawWords(ts);
}

function drawWords(ts){
  refreshEmptyState();
  for(let li=0; li<model.length; li++){
    const line=model[li];
    if(document.getElementById('autoSize').checked && line.length) fitLine(li);
    let x = layoutStartX(li);
    for(let wi=0; wi<line.length; wi++){
      const w=line[wi];
      let scale=1, alpha=1;
      if(!editMode){
        if(w.fx.pulse){ scale = 1 + (w.fx.pulseAmt/100)*0.2*Math.sin((ts||0)/300 + wi + li*0.7); }
        if(w.fx.flicker){ alpha = 0.7 + 0.3*Math.max(0, Math.sin((ts||0)/90 + wi)); }
      }
      const tw=textWidth(w)*scale;
      const drawX = w.manual? w.x : x;
      const drawY = w.manual? w.y : lineY(li);
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = w.color;
      ctx.font = `${w.size}px monospace`;
      ctx.textBaseline='top';
      ctx.fillText(w.text, 0, 0);
      ctx.restore();

      if(hasSelection() && selected.line===li && selected.word===wi && editMode){
        ctx.strokeStyle='#ff57f0'; ctx.lineWidth=1; ctx.strokeRect(drawX-1, drawY-1, Math.ceil(tw)+2, w.size+2);
        positionDelete();
      }
      x += textWidth(w) + wordSpacing();
    }
  }
  if(!editMode) requestAnimationFrame(draw);
}

// Init
['slotFont','slotColor','slotSpacing','slotAlign','slotAnim'].forEach(id=> document.getElementById(id).open=false);
document.getElementById('zoomLabel').textContent='100%';
resSel.addEventListener('change', e=> setResolution(e.target.value));
setResolution('96x128');
buildBgGrid();
pushHistory();
draw();
refreshEmptyState();
