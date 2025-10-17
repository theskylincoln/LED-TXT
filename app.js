// Canvas + state
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const dpi = () => window.devicePixelRatio || 1;

let zoom = 1;
let editMode = true;
let playing = true;

let model = [
  [{ text:'Hello', color:'#ffffff', size:22, align:'center', manual:false, x:0, y:40, fx:{pulse:false,pulseAmt:60,flicker:false,flickerAmt:40} }]
];
let selected = { line:0, word:0 };

const bg = { type:'solid', color:'#000000', img:null, preset:'A' };

// History
let history=[], redo=[];
function snapshot(){ return JSON.stringify({model,bg:Object.assign({},bg)}); }
function pushHistory(){ history.push(snapshot()); if(history.length>80) history.shift(); redo.length=0; }
function undo(){ if(!history.length) return; redo.push(snapshot()); const s=JSON.parse(history.pop()); model=s.model; Object.assign(bg,s.bg); draw(); }
function redoFn(){ if(!redo.length) return; history.push(snapshot()); const s=JSON.parse(redo.pop()); model=s.model; Object.assign(bg,s.bg); draw(); }

// Resolution
const resSel = document.getElementById('resolution');
function setResolution(val){
  const [w,h] = val.split('x').map(n=>parseInt(n,10));
  const scale = dpi();
  canvas.width = w*scale; canvas.height = h*scale;
  ctx.setTransform(scale,0,0,scale,0,0);
  canvas.style.width = (w*zoom*3)+'px';
  canvas.style.height = (h*zoom*3)+'px';
  buildBgThumbs(); // match presets by resolution
  draw();
}
resSel.addEventListener('change', e=> setResolution(e.target.value));

// BG thumbnails per resolution
const bgHost = document.getElementById('bgThumbs');
function makeThumb(name, className, onClick){
  const d=document.createElement('button');
  d.className='thumb'; d.type='button';
  d.innerHTML=`<div class="tile ${className}"></div><div class="name">${name}</div>`;
  d.addEventListener('click', onClick);
  return d;
}
function buildBgThumbs(){
  bgHost.innerHTML='';
  const res = resSel.value;
  const list = res==='96x128'
    ? [{id:'A', cls:'grad-a', name:'Preset A'},{id:'B', cls:'grad-b', name:'Preset B'}]
    : [{id:'C', cls:'grad-c', name:'Preset C'},{id:'D', cls:'grad-d', name:'Preset D'}];
  list.forEach(p=>{
    const t = makeThumb(p.name, p.cls, ()=>{ bg.type='preset'; bg.preset=p.id; clearSelection(); draw(); });
    bgHost.appendChild(t);
  });
  bgHost.appendChild(makeThumb('Solid','solid', ()=>{ bg.type='solid'; bg.color = '#000000'; clearSelection(); draw(); }));
  bgHost.appendChild(makeThumb('Custom','custom', ()=>{
    clearSelection();
    const i=document.createElement('input'); i.type='file'; i.accept='image/*';
    i.onchange=()=>{ const f=i.files[0]; if(!f) return; const img=new Image(); img.onload=()=>{ bg.type='image'; bg.img=img; draw();}; img.src=URL.createObjectURL(f); };
    i.click();
  }));
}
const style = document.createElement('style');
style.textContent = `.grad-a{background:linear-gradient(180deg,#1f3c77,#0b0f1d)}
.grad-b{background:linear-gradient(180deg,#3b003b,#0b001b)}
.grad-c{background:linear-gradient(180deg,#000044,#001111)}
.grad-d{background:linear-gradient(180deg,#301144,#000000)}
.solid{background:#000}
.custom{background:repeating-linear-gradient(45deg,#18233a 0 10px,#0e1627 10px 20px)}`;
document.head.appendChild(style);

// Toolbar
document.getElementById('btnToggleAnim').addEventListener('click', ()=>{
  editMode = !editMode;
  if(!editMode){ hideInspector(); hideDelete(); }
  draw();
});
document.getElementById('btnHideAnim').addEventListener('click', ()=>{ editMode=false; hideInspector(); hideDelete(); draw(); });
document.getElementById('btnRender').addEventListener('click', ()=>{
  // simple PNG export of current frame (sprite-strip/gif can be added later)
  canvas.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='led_frame.png'; a.click(); URL.revokeObjectURL(a.href); });
});
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnRedo').addEventListener('click', redoFn);
const zl = document.getElementById('zoomLabel');
document.getElementById('btnZoomIn').addEventListener('click', ()=>{ zoom=Math.min(4,zoom+0.1); zl.textContent=Math.round(zoom*100)+'%'; setResolution(resSel.value); });
document.getElementById('btnZoomOut').addEventListener('click', ()=>{ zoom=Math.max(0.25,zoom-0.1); zl.textContent=Math.round(zoom*100)+'%'; setResolution(resSel.value); });

// Selection + inline edit
const overlay = document.getElementById('uiOverlay');
const insp = document.getElementById('floatingInspector');
const pinned = document.getElementById('pinnedInspector');
const pinBtn = document.getElementById('btnPin');
const deleteBtn = document.getElementById('btnDeleteWord');

function clearSelection(){ selected={line:-1,word:-1}; hideInspector(); hideDelete(); }
function hasSelection(){ return selected.line>=0 && selected.word>=0; }

canvas.addEventListener('click', (e)=>{
  const p = toCanvasPoint(e);
  const hit = hitTest(p.x,p.y);
  if(hit){
    selected=hit;
    if(!editMode){ editMode=true; } // clicking while showing animation -> switch to edit mode
    showInspectorAtSelection();
    draw();
  }else{
    clearSelection(); draw();
  }
});

// double-click / long-press open inline <input> editor
let pressTimer=null;
canvas.addEventListener('dblclick', openInlineEditor);
canvas.addEventListener('touchstart',(e)=>{
  const t=e.touches[0]; const r=canvas.getBoundingClientRect();
  const p={x:(t.clientX-r.left)/(3*zoom)*dpi(), y:(t.clientY-r.top)/(3*zoom)*dpi()};
  const hit=hitTest(p.x,p.y);
  if(hit){ selected=hit; showInspectorAtSelection(); }
  pressTimer=setTimeout(()=>{ openInlineEditor(); navigator.vibrate && navigator.vibrate(15); }, 380);
},{passive:true});
canvas.addEventListener('touchend',()=> clearTimeout(pressTimer), {passive:true});

function openInlineEditor(){
  if(!hasSelection()) return;
  const w = wordAt(selected);
  const b = boundsOf(selected);
  const edit = document.createElement('input');
  edit.className='pill';
  const rect = canvas.getBoundingClientRect();
  edit.style.left = (rect.left + (b.x)*3*zoom/dpi())+'px';
  edit.style.top  = (rect.top  + (b.y-24)*3*zoom/dpi())+'px';
  edit.value = w.text;
  document.body.appendChild(edit);
  edit.focus();
  edit.addEventListener('input', ()=>{
    // split by spaces into subsequent words
    const parts = edit.value.split(' ');
    w.text = parts[0];
    const line = model[selected.line];
    // remove any extra words we previously appended from this editor session (simple approach: reset rest of line with remaining parts)
    // insert remaining parts after current
    for(let i=1;i<parts.length;i++){
      line.splice(selected.word+i,0,{text:parts[i], color:w.color, size:w.size, align:w.align, manual:w.manual, x:w.x, y:w.y, fx:Object.assign({},w.fx)});
    }
    draw();
  });
  function done(){ edit.remove(); pushHistory(); }
  edit.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key==='Escape'){ done(); }});
  edit.addEventListener('blur', done);
}

function toCanvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return { x:(e.clientX-r.left)/(3*zoom)*dpi(), y:(e.clientY-r.top)/(3*zoom)*dpi() };
}
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
function wordAt(sel){ return model[sel.line][sel.word]; }

// Inspectors & delete positioning
function showInspectorAtSelection(){
  if(!hasSelection()) return;
  const b = boundsOf(selected);
  const rect = canvas.getBoundingClientRect();
  // Delete: above-right
  deleteBtn.style.left = (rect.left + (b.x+b.w+8)*3*zoom/dpi())+'px';
  deleteBtn.style.top  = (rect.top + (b.y-20)*3*zoom/dpi())+'px';
  deleteBtn.classList.remove('hidden');
  // Inspector: prefer above, else below
  const inspLeft = rect.left + (b.x + b.w/2)*3*zoom/dpi() - 150; // approximately center
  let inspTop = rect.top + (b.y - insp.offsetHeight - 10)*3*zoom/dpi();
  if(inspTop < rect.top + 8) inspTop = rect.top + (b.y+b.h+10)*3*zoom/dpi();
  insp.style.left = Math.max(rect.left+8, Math.min(inspLeft, rect.right-8-300))+'px';
  insp.style.top = inspTop+'px';
  insp.classList.remove('hidden');
  requestAnimationFrame(()=> insp.classList.add('show'));
}
function hideInspector(){ insp.classList.remove('show'); insp.classList.add('hidden'); }
function hideDelete(){ deleteBtn.classList.add('hidden'); }

// Delete word
deleteBtn.addEventListener('click', ()=>{
  if(!hasSelection()) return;
  const line=model[selected.line];
  line.splice(selected.word,1);
  if(line.length===0){ model.splice(selected.line,1); selected={line:-1,word:-1}; }
  pushHistory(); clearSelection(); draw();
});

// Inspector controls
const fontSize = document.getElementById('fontSize');
const autoSize = document.getElementById('autoSize');
const lineGapCtl = document.getElementById('lineGap');
const wordSpacingCtl = document.getElementById('wordSpacing');
const fxPulse = document.getElementById('fxPulse');
const fxFlicker = document.getElementById('fxFlicker');
const fxPulseAmt = document.getElementById('fxPulseAmt');
const fxFlickerAmt = document.getElementById('fxFlickerAmt');

function currentWord(){ return hasSelection()? wordAt(selected): null; }

fontSize.addEventListener('input',()=>{ const w=currentWord(); if(!w) return; w.size=parseInt(fontSize.value,10)||22; draw(); });
autoSize.addEventListener('change',()=> draw());
lineGapCtl.addEventListener('input',()=> draw());
wordSpacingCtl.addEventListener('input',()=> draw());

fxPulse.addEventListener('change',()=>{ const w=currentWord(); if(!w) return; w.fx.pulse = fxPulse.checked; draw(); });
fxFlicker.addEventListener('change',()=>{ const w=currentWord(); if(!w) return; w.fx.flicker = fxFlicker.checked; draw(); });
fxPulseAmt.addEventListener('input',()=>{ const w=currentWord(); if(!w) return; w.fx.pulseAmt = parseInt(fxPulseAmt.value,10)||60; draw(); });
fxFlickerAmt.addEventListener('input',()=>{ const w=currentWord(); if(!w) return; w.fx.flickerAmt = parseInt(fxFlickerAmt.value,10)||35; draw(); });

document.querySelectorAll('.btn.align').forEach(btn=> btn.addEventListener('click',()=>{
  const a=btn.dataset.align; const w=currentWord(); if(!w) return;
  w.align = a==='manual'?'manual':a; w.manual = (a==='manual'); draw();
}));

document.getElementById('btnAddLine').addEventListener('click', ()=>{
  model.push([{ text:'New', color:'#ffffff', size:22, align:'center', manual:false, x:0, y: lineY(model.length), fx:{pulse:false,pulseAmt:60,flicker:false,flickerAmt:40} }]);
  selected = { line:model.length-1, word:0 };
  showInspectorAtSelection(); draw();
});

// Swatches for words
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
    d.addEventListener('click',()=>{ const w=currentWord(); if(!w) return; w.color=hex; draw(); pushHistory(); });
    wordSwatches.appendChild(d);
  });
}
addWordSwatch.addEventListener('click',()=>{
  const hex=(wordPicker.value||'').toUpperCase(); if(!hex) return;
  if(!customSwatches.includes(hex)){ if(customSwatches.length>=5) customSwatches.shift(); customSwatches.push(hex); localStorage.setItem('LED.customWordSwatches', JSON.stringify(customSwatches)); renderWordSwatches(); }
});
renderWordSwatches();

// Pin/unpin inspector
pinBtn.addEventListener('click', ()=>{
  if(pinnedInspectorVisible()){
    // unpin: move back to overlay
    document.getElementById('pinnedMirror').innerHTML='';
    document.getElementById('pinnedInspector').classList.add('hidden');
    document.getElementById('uiOverlay').appendChild(insp);
    showInspectorAtSelection();
  }else{
    // pin
    document.getElementById('pinnedInspector').classList.remove('hidden');
    document.getElementById('pinnedMirror').appendChild(insp);
    insp.style.left=''; insp.style.top=''; insp.classList.add('show'); insp.classList.remove('hidden');
  }
});
function pinnedInspectorVisible(){ return !document.getElementById('pinnedInspector').classList.contains('hidden'); }

// Layout helpers
function wordSpacing(){ return parseInt(wordSpacingCtl.value,10)||3; }
function lineGap(){ return parseInt(lineGapCtl.value,10)||2; }
function lineY(li){ const size = model[li]?.[0]?.size || 22; return size + li*(size+lineGap()); }
function textWidth(w){ ctx.font=`${w.size}px monospace`; return Math.ceil(ctx.measureText(w.text).width); }
function layoutStartX(li){
  const words = model[li]; const mode = words[0]?.align || 'center';
  if(mode==='left') return 2;
  if(mode==='right'){ let total=0; words.forEach((w,i)=> total += textWidth(w) + (i>0?wordSpacing():0)); return canvas.width/dpi() - total - 2; }
  // center
  let total=0; words.forEach((w,i)=> total += textWidth(w) + (i>0?wordSpacing():0)); return Math.floor((canvas.width/dpi() - total)/2);
}
function boundsOf(sel){
  const w=wordAt(sel); const tw=textWidth(w);
  const x = w.manual ? w.x : layoutStartX(sel.line) + sumPrev(sel.line, sel.word);
  const y = w.manual ? w.y : lineY(sel.line);
  return {x,y, w:tw, h:w.size};
}
function sumPrev(li, wi){
  let s=0; for(let i=0;i<wi;i++) s += textWidth(model[li][i]) + wordSpacing(); return s;
}

// Draw
function draw(ts){
  // bg
  if(bg.type==='solid'){ ctx.fillStyle = bg.color; ctx.fillRect(0,0,canvas.width,canvas.height); }
  else if(bg.type==='preset'){
    const g=ctx.createLinearGradient(0,0,0,canvas.height);
    if(bg.preset==='A'){ g.addColorStop(0,'#1f3c77'); g.addColorStop(1,'#0b0f1d'); }
    if(bg.preset==='B'){ g.addColorStop(0,'#3b003b'); g.addColorStop(1,'#0b001b'); }
    if(bg.preset==='C'){ g.addColorStop(0,'#000044'); g.addColorStop(1,'#001111'); }
    if(bg.preset==='D'){ g.addColorStop(0,'#301144'); g.addColorStop(1,'#000000'); }
    ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if(bg.type==='image' && bg.img){ ctx.drawImage(bg.img,0,0,canvas.width,canvas.height); }
  // lines
  for(let li=0; li<model.length; li++){
    const line=model[li];
    let x = layoutStartX(li);
    for(let wi=0; wi<line.length; wi++){
      const w=line[wi];
      // autosize (per line)
      if(document.getElementById('autoSize').checked){ fitLine(li); }
      // anim
      let scale=1, alpha=1;
      if(editMode===false){ // when "show animation" is active
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
      ctx.textBaseline = 'top';
      ctx.fillText(w.text, 0, 0);
      ctx.restore();

      if(hasSelection() && selEq({line:li,word:wi}, selected) && editMode){
        ctx.strokeStyle='#ff57f0'; ctx.lineWidth=1; ctx.strokeRect(drawX-1, drawY-1, Math.ceil(tw)+2, w.size+2);
        showInspectorAtSelection();
      }
      x += textWidth(w) + wordSpacing();
    }
  }
  if(editMode===false) requestAnimationFrame(draw);
}
function selEq(a,b){return a.line===b.line && a.word===b.word; }

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

// Init
document.getElementById('btnUndo').disabled=false;
document.getElementById('btnRedo').disabled=false;
document.getElementById('zoomLabel').textContent='100%';
setResolution('96x128');
buildBgThumbs();
pushHistory();
draw();

