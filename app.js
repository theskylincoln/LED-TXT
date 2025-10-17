// Core canvas/state logic for v1.4.1
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const dpi = () => window.devicePixelRatio || 1;

let zoom = 1;
let editMode = true; // true = edit mode; false = show animation
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
const bgHost = document.getElementById('bgThumbs');

function setResolution(val){
  const [w,h] = val.split('x').map(n=>parseInt(n,10));
  const scale = dpi();
  canvas.width = w*scale; canvas.height = h*scale;
  ctx.setTransform(scale,0,0,scale,0,0);
  canvas.style.width = (w*zoom*3)+'px';
  canvas.style.height = (h*zoom*3)+'px';
  buildBgThumbs();
  draw();
}

function buildBgThumbs(){
  bgHost.innerHTML='';
  const res = resSel.value;
  const list = res==='96x128'
    ? [{id:'A', file:'assets/Preset_A.png', name:'Preset A'},{id:'B', file:'assets/Preset_B.png', name:'Preset B'}]
    : [{id:'C', file:'assets/Preset_C.png', name:'Preset C'},{id:'D', file:'assets/Preset_D.png', name:'Preset D'}];

  list.forEach(p=>{
    const t = document.createElement('button'); t.className='thumb'; t.type='button';
    t.innerHTML = `<img src="${p.file}" alt="${p.name}"><div class="name">${p.name}</div>`;
    t.addEventListener('click', ()=>{ bg.type='preset'; bg.preset=p.id; draw(); });
    bgHost.appendChild(t);
  });

  const solid = document.createElement('button'); solid.className='thumb'; solid.type='button';
  solid.innerHTML = `<img src="${list[0].file}" alt="Solid" style="filter:brightness(0)"><div class="name">Solid Color</div>`;
  solid.addEventListener('click', ()=>{ bg.type='solid'; bg.color='#000000'; draw(); });
  bgHost.appendChild(solid);

  const custom = document.createElement('label'); custom.className='thumb';
  custom.innerHTML = `<input id="bgUpload" type="file" accept="image/*" hidden>
                      <img src="${list[1].file}" alt="Custom" style="filter:saturate(0.2) brightness(1.2)"><div class="name">Custom</div>`;
  custom.querySelector('#bgUpload').addEventListener('change', (e)=>{
    const f=e.target.files[0]; if(!f) return;
    const img=new Image(); img.onload=()=>{ bg.type='image'; bg.img=img; draw(); };
    img.src = URL.createObjectURL(f);
  });
  bgHost.appendChild(custom);
}

// Inspector bar
const inspBar = document.getElementById('inspectorBar');
function setInspectorEnabled(enabled){
  if(enabled) inspBar.classList.remove('disabled');
  else inspBar.classList.add('disabled');
}

// Empty state (Add word if no words)
const emptyState = document.getElementById('emptyState');
const btnAddWord = document.getElementById('btnAddWord');
function refreshEmptyState(){
  const hasWords = model.some(line => line.length>0);
  if(!hasWords){ emptyState.classList.remove('hidden'); setInspectorEnabled(false); }
  else { emptyState.classList.add('hidden'); setInspectorEnabled(true); }
}
btnAddWord.addEventListener('click', ()=>{
  if(model.length===0) model=[[]];
  model[0].push({ text:'New', color:'#ffffff', size:22, align:'center', manual:false, x:0, y:40, fx:{pulse:false,pulseAmt:60,flicker:false,flickerAmt:40}});
  selected={line:0,word:model[0].length-1};
  pushHistory(); draw(); refreshEmptyState();
});

// Toolbar
document.getElementById('btnShow').addEventListener('click',()=>{ editMode=false; draw(); });
document.getElementById('btnEdit').addEventListener('click',()=>{ editMode=true; draw(); });
document.getElementById('btnRender').addEventListener('click',()=>{
  canvas.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='led_frame.png'; a.click(); URL.revokeObjectURL(a.href); });
});
document.getElementById('btnClearText').addEventListener('click',()=>{
  model = [[]];
  selected={line:-1,word:-1};
  pushHistory(); draw(); refreshEmptyState();
});
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnRedo').addEventListener('click', redoFn);
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

// Selection & inline edit (single-click to edit now)
const overlay = document.getElementById('uiOverlay');
const deleteBtn = document.getElementById('btnDeleteWord');

function clearSelection(){ selected={line:-1,word:-1}; setInspectorEnabled(false); deleteBtn.classList.add('hidden'); }
function hasSelection(){ return selected.line>=0 && selected.word>=0; }
function wordAt(sel){ return model[sel.line][sel.word]; }
function boundsOf(sel){
  const w=wordAt(sel); const tw=textWidth(w);
  const x = w.manual ? w.x : layoutStartX(sel.line) + sumPrev(sel.line, sel.word);
  const y = w.manual ? w.y : lineY(sel.line);
  return {x,y,w:tw,h:w.size};
}

canvas.addEventListener('click', (e)=>{
  const p=toCanvasPoint(e);
  const hit=hitTest(p.x,p.y);
  if(hit){
    selected=hit;
    if(!editMode){ editMode=true; } // selecting a word while animating switches to edit mode
    // Start inline edit immediately on click
    openInlineEditorAtSelection();
    positionDelete();
    setInspectorEnabled(true);
    draw();
  }else{
    clearSelection(); draw();
  }
});

function positionDelete(){
  if(!hasSelection()) return;
  const b=boundsOf(selected); const rect=canvas.getBoundingClientRect();
  // top-right of word
  deleteBtn.style.left = (rect.left + (b.x + b.w + 8)*3*zoom/dpi())+'px';
  deleteBtn.style.top  = (rect.top  + (b.y - 20)*3*zoom/dpi())+'px';
  deleteBtn.classList.remove('hidden');
}

deleteBtn.addEventListener('click', ()=>{
  if(!hasSelection()) return;
  const line=model[selected.line];
  line.splice(selected.word,1);
  if(line.length===0) model.splice(selected.line,1);
  clearSelection(); pushHistory(); draw(); refreshEmptyState();
});

// Inline editor (single-click starts editing)
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
      // insert remaining words after current
      const rest = parts.slice(1).map(t=>({ text:t, color:w.color, size:w.size, align:w.align, manual:w.manual, x:w.x, y:w.y, fx:Object.assign({},w.fx) }));
      model[selected.line].splice(selected.word+1, 0, ...rest);
    }
    if(document.getElementById('autoSize').checked){ fitLine(selected.line); }
    draw();
  });
  function done(){ edit.remove(); pushHistory(); }
  edit.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key==='Escape'){ done(); } });
  edit.addEventListener('blur', done);
}

// Layout helpers
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
  // center
  let total=0; words.forEach((w,i)=> total += textWidth(w) + (i>0?wordSpacing():0)); return Math.floor((canvas.width/dpi() - total)/2);
}
function sumPrev(li, wi){
  let s=0; for(let i=0;i<wi;i++) s += textWidth(model[li][i]) + wordSpacing(); return s;
}

// Autosize per line
function fitLine(li){
  const words = model[li]; if(!words?.length) return;
  const max = canvas.width/dpi() - 4; // pad
  let size = words[0].size||22;
  for(let tries=0; tries<40; tries++){
    let total=0;
    for(let i=0;i<words.length;i++){ ctx.font=`${size}px monospace`; total += ctx.measureText(words[i].text).width + (i>0?wordSpacing():0); }
    if(total<=max) break; size -= 1; if(size<8) break;
  }
  words.forEach(w=> w.size=size);
}

// Inspector inputs wire-up
document.getElementById('fontSize').addEventListener('input',()=>{ if(hasSelection()){ wordAt(selected).size=parseInt(fontSize.value,10)||22; draw(); }});
document.getElementById('autoSize').addEventListener('change',()=>{ if(hasSelection()) fitLine(selected.line); draw(); });
document.getElementById('lineGap').addEventListener('input',()=> draw());
document.getElementById('wordSpacing').addEventListener('input',()=> draw());

document.getElementById('fxPulse').addEventListener('change',()=>{ if(hasSelection()){ wordAt(selected).fx.pulse = document.getElementById('fxPulse').checked; draw(); }});
document.getElementById('fxFlicker').addEventListener('change',()=>{ if(hasSelection()){ wordAt(selected).fx.flicker = document.getElementById('fxFlicker').checked; draw(); }});
document.getElementById('fxPulseAmt').addEventListener('input',()=>{ if(hasSelection()){ wordAt(selected).fx.pulseAmt = parseInt(document.getElementById('fxPulseAmt').value,10)||60; }});
document.getElementById('fxFlickerAmt').addEventListener('input',()=>{ if(hasSelection()){ wordAt(selected).fx.flickerAmt = parseInt(document.getElementById('fxFlickerAmt').value,10)||35; }});

// Draw
function draw(ts){
  // bg
  if(bg.type==='solid'){ ctx.fillStyle = bg.color; ctx.fillRect(0,0,canvas.width,canvas.height); }
  else if(bg.type==='preset'){
    // load correct preset asset per id and paint as image
    const img = new Image();
    img.onload = ()=>{ ctx.drawImage(img, 0,0, canvas.width, canvas.height); drawWords(ts); };
    img.src = `assets/Preset_${bg.preset}.png`;
    return; // drawWords will be called in onload
  } else if(bg.type==='image' && bg.img){ ctx.drawImage(bg.img,0,0,canvas.width,canvas.height); }
  drawWords(ts);
}

function drawWords(ts){
  for(let li=0; li<model.length; li++){
    const line=model[li];
    if(document.getElementById('autoSize').checked) fitLine(li);
    let x = layoutStartX(li);
    for(let wi=0; wi<line.length; wi++){
      const w=line[wi];
      // anim only when Show Animation mode
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
      x += textWidth(w) + (parseInt(document.getElementById('wordSpacing').value,10)||3);
    }
  }
  if(!editMode) requestAnimationFrame(draw);
}

// Helpers
resSel.addEventListener('change', e=> setResolution(e.target.value));
document.getElementById('btnZoomIn').addEventListener('click',()=> document.getElementById('zoomLabel').textContent=Math.round(++zoom*100)+'%');
document.getElementById('btnZoomOut').addEventListener('click',()=> document.getElementById('zoomLabel').textContent=Math.round(Math.max(0.25,--zoom)*100)+'%');

// Init
setResolution('96x128');
buildBgThumbs();
pushHistory();
draw();
refreshEmptyState();
