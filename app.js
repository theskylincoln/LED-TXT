// Basic 2D text animator for LED backpack

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let zoom = 4; // initial zoom to make canvas visible
let previewMode = false;

// State
const state = {
  res: {w:96,h:128},
  bg: {mode:'solid', color:'#000000', image:null},
  lines: [], // [{y, words:[{text,x,y,color,font,size,manual,anim:{pulse:0..1,flicker:0..1}}]}]
  lineGap: 2,
  wordSpacing: 3,
  selection: {lineIdx:-1, wordIdx:-1},
  undo: [],
  redo: [],
};

// Helpers
function pushUndo(){
  const snapshot = JSON.stringify(state, (k,v)=> (k==='undo'||k==='redo'||k==='imageData')?undefined:v);
  state.undo.push(snapshot);
  if(state.undo.length>20) state.undo.shift();
  state.redo = [];
  document.getElementById('btnUndo').disabled = state.undo.length===0;
  document.getElementById('btnRedo').disabled = true;
}
function undo(){
  if(!state.undo.length) return;
  const curr = JSON.stringify(state, (k,v)=> (k==='undo'||k==='redo'||k==='imageData')?undefined:v);
  state.redo.push(curr);
  const snap = state.undo.pop();
  const obj = JSON.parse(snap);
  Object.assign(state, obj);
  document.getElementById('btnUndo').disabled = state.undo.length===0;
  document.getElementById('btnRedo').disabled = state.redo.length===0;
  render();
}
function redo(){
  if(!state.redo.length) return;
  const curr = JSON.stringify(state, (k,v)=> (k==='undo'||k==='redo'||k==='imageData')?undefined:v);
  state.undo.push(curr);
  const snap = state.redo.pop();
  const obj = JSON.parse(snap);
  Object.assign(state, obj);
  document.getElementById('btnUndo').disabled = state.undo.length===0;
  document.getElementById('btnRedo').disabled = state.redo.length===0;
  render();
}

function setResolution(v){
  const [w,h] = v.split('x').map(n=>parseInt(n,10));
  state.res = {w,h};
  canvas.width = w;
  canvas.height = h;
  fitCanvasOnScreen();
  render();
}

function fitCanvasOnScreen(){
  // scale canvas CSS according to zoom
  canvas.style.width = (canvas.width*zoom)+'px';
  canvas.style.height = (canvas.height*zoom)+'px';
}

function loadPreset(name){
  state.bg.mode = 'image';
  const path = `assets/Preset_${name}.png`;
  const img = new Image();
  img.onload = ()=> { state.bg.image = img; render(); };
  img.src = path;
  deselect();
}
function setSolidColor(hex){
  state.bg.mode='solid';
  state.bg.color=hex;
  document.getElementById('solidSwatch').style.background = hex;
  render();
  deselect();
}
function deselect(){
  state.selection = {lineIdx:-1, wordIdx:-1};
  drawSelection();
}

function ensureOneLineIfEmpty(){
  if(state.lines.length===0){
    state.lines.push({y: 0, words: []});
  }
}

function addWordAt(x,y, text=''){
  ensureOneLineIfEmpty();
  // Find line by nearest y or create new under last
  let lineIdx = state.lines.findIndex(l=> Math.abs(l.y - y) < 6 );
  if(lineIdx===-1){
    lineIdx = state.lines.length;
    const lastY = state.lines.length? state.lines[state.lines.length-1].y : 0;
    state.lines.push({y: lastY + 10 + state.lineGap, words: []});
  }
  const line = state.lines[lineIdx];
  const word = {text, x:x, y: line.y, color: currentColor(), font: currentFont(), size: currentSize(), manual:false, anim:{pulse:0, flicker:0}};
  // avoid overlap: if x intersects existing, place after last
  let lastRight = 0;
  for(const w of line.words){
    const m = measureWord(w);
    lastRight = Math.max(lastRight, w.x + m.w + state.wordSpacing);
  }
  if(x < lastRight) x = lastRight;
  word.x = x;
  line.words.push(word);
  state.selection = {lineIdx, wordIdx: line.words.length-1};
  pushUndo();
  render();
}

function measureWord(w){
  ctx.font = `${w.size}px ${w.font}`;
  const m = ctx.measureText(w.text||'');
  // approximate pixel font box
  return {w: Math.ceil(m.width), h: w.size};
}

function layoutCenterAll(){
  // center all lines horizontally, space lines vertically from top to bottom using lineGap
  let y = 10;
  for(const line of state.lines){
    // compute total width
    let total=0;
    for(let i=0;i<line.words.length;i++){
      const w = line.words[i];
      const m = measureWord(w);
      total += m.w;
      if(i<line.words.length-1) total += state.wordSpacing;
    }
    const startX = Math.max(0, Math.floor((state.res.w - total)/2));
    let x = startX;
    for(const w of line.words){
      if(!w.manual){
        w.x = x;
        w.y = y;
      }
      const m = measureWord(w);
      x += m.w + state.wordSpacing;
    }
    y += 10 + state.lineGap +  (line.words[0]? line.words[0].size: 8);
    line.y = (line.words[0]? line.words[0].y : y);
  }
  render();
}

function currentFont(){
  return document.getElementById('fontFamily').value;
}
function currentSize(){
  return parseInt(document.getElementById('fontSize').value,10);
}
function currentColor(){
  return document.getElementById('_currentColor')?.value || '#ffffff';
}

function renderBackground(){
  if(state.bg.mode==='image' && state.bg.image){
    // contain
    const iw=state.bg.image.width, ih=state.bg.image.height;
    const scale = Math.min(canvas.width/iw, canvas.height/ih);
    const w = Math.floor(iw*scale), h = Math.floor(ih*scale);
    const x = Math.floor((canvas.width - w)/2);
    const y = Math.floor((canvas.height - h)/2);
    ctx.drawImage(state.bg.image, x,y,w,h);
  }else{
    ctx.fillStyle = state.bg.color || '#000';
    ctx.fillRect(0,0,canvas.width, canvas.height);
  }
}

function renderWords(time){
  for(const line of state.lines){
    for(const w of line.words){
      let scale = 1, alpha = 1;
      if(previewMode){
        if(w.anim.pulse>0){
          const amt = w.anim.pulse;
          scale = 1 + 0.1*amt*Math.sin(time/200);
        }
        if(w.anim.flicker>0){
          const f = (Math.sin(time/50)+1)/2;
          alpha = 0.5 + 0.5*(1 - w.anim.flicker*0.9 + f* w.anim.flicker*0.9);
        }
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w.x + (measureWord(w).w/2), w.y);
      ctx.scale(scale, scale);
      ctx.translate(-(measureWord(w).w/2), 0);
      ctx.font = `${w.size}px ${w.font}`;
      ctx.fillStyle = w.color;
      ctx.textBaseline = 'top';
      ctx.fillText(w.text||'', 0, 0);
      ctx.restore();
    }
  }
}
function render(time=0){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  renderBackground();
  renderWords(time);
  drawSelection();
}

let rafId = null;
function startPreview(){
  previewMode = true;
  function tick(ts){
    render(ts);
    rafId = requestAnimationFrame(tick);
  }
  if(!rafId) rafId = requestAnimationFrame(tick);
}
function stopPreview(){
  previewMode = false;
  if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
  render();
}

function drawSelection(){
  // Remove old dom selection rectangles
  for(const el of document.querySelectorAll('.sel, .delete-pill')) el.remove();
  if(state.selection.lineIdx<0) return;
  const line = state.lines[state.selection.lineIdx];
  const w = line.words[state.selection.wordIdx];
  if(!w) return;
  const m = measureWord(w);
  const rect = {x:w.x, y:w.y, w:m.w, h:w.size};
  // create selection overlay elements positioned relative to canvas
  const stage = document.querySelector('.stage');
  const r = canvas.getBoundingClientRect();
  const stageR = stage.getBoundingClientRect();
  const selDiv = document.createElement('div');
  selDiv.className='sel';
  selDiv.style.left = (r.left - stageR.left + rect.x*zoom)+'px';
  selDiv.style.top =  (r.top - stageR.top + rect.y*zoom)+'px';
  selDiv.style.width = (rect.w*zoom)+'px';
  selDiv.style.height = (rect.h*zoom)+'px';
  stage.appendChild(selDiv);

  const del = document.createElement('button');
  del.className='delete-pill';
  del.textContent='Delete';
  del.style.left = (r.left - stageR.left + (rect.x+rect.w)*zoom - 10)+'px';
  del.style.top  = (r.top - stageR.top + rect.y*zoom - 14)+'px';
  del.onclick = ()=>{
    const line = state.lines[state.selection.lineIdx];
    line.words.splice(state.selection.wordIdx,1);
    if(line.words.length===0){
      state.lines.splice(state.selection.lineIdx,1);
    }
    state.selection = {lineIdx:-1, wordIdx:-1};
    pushUndo();
    render();
  };
  stage.appendChild(del);
}

// Canvas events
let dragging = false, dragOffset = {x:0,y:0};
canvas.addEventListener('mousedown', e=>{
  const pos = canvasPosFromEvent(e);
  const hit = hitTest(pos.x,pos.y);
  if(hit){
    state.selection = hit;
    drawSelection();
  }else{
    // create word
    addWordAt(pos.x, pos.y, '');
  }
});
canvas.addEventListener('dblclick', e=>{
  const pos = canvasPosFromEvent(e);
  const hit = hitTest(pos.x,pos.y);
  if(hit){
    const w = state.lines[hit.lineIdx].words[hit.wordIdx];
    w.manual = true;
    dragging = true;
    dragOffset.x = pos.x - w.x;
    dragOffset.y = pos.y - w.y;
  }
});
canvas.addEventListener('mousemove', e=>{
  const pos = canvasPosFromEvent(e);
  if(dragging && state.selection.lineIdx>=0){
    const w = state.lines[state.selection.lineIdx].words[state.selection.wordIdx];
    w.x = Math.max(0, Math.min(state.res.w-1, pos.x - dragOffset.x));
    w.y = Math.max(0, Math.min(state.res.h-1, pos.y - dragOffset.y));
    render();
  }
});
window.addEventListener('mouseup', ()=>{
  if(dragging){ dragging=false; pushUndo(); }
});

function canvasPosFromEvent(e){
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left)/zoom);
  const y = Math.floor((e.clientY - r.top)/zoom);
  return {x,y};
}
function hitTest(x,y){
  for(let li=0; li<state.lines.length; li++){
    const line = state.lines[li];
    for(let wi=0; wi<line.words.length; wi++){
      const w = line.words[wi];
      const m = measureWord(w);
      if(x>=w.x && x<=w.x+m.w && y>=w.y && y<=w.y+m.h){
        return {lineIdx:li, wordIdx:wi};
      }
    }
  }
  return null;
}

// Typing on canvas
window.addEventListener('keydown', e=>{
  if(state.selection.lineIdx<0) return;
  const line = state.lines[state.selection.lineIdx];
  const w = line.words[state.selection.wordIdx];
  if(e.key==='Backspace'){
    w.text = (w.text||'').slice(0,-1);
    render();
    e.preventDefault();
    return;
  }
  if(e.key===' '){
    // add next word on same line, respecting spacing
    const m = measureWord(w);
    const nextX = w.x + m.w + state.wordSpacing;
    addWordAt(nextX, w.y, '');
    e.preventDefault();
    return;
  }
  if(e.key.length===1){
    w.text = (w.text||'') + e.key;
    render();
  }
});

// Buttons
document.getElementById('zoomIn').onclick = ()=>{ zoom = Math.min(10, zoom+0.5); fitCanvasOnScreen(); drawSelection(); document.getElementById('zoomPct').textContent = Math.round(zoom*25)+'%'; };
document.getElementById('zoomOut').onclick = ()=>{ zoom = Math.max(1, zoom-0.5); fitCanvasOnScreen(); drawSelection(); document.getElementById('zoomPct').textContent = Math.round(zoom*25)+'%'; };
document.getElementById('btnPreview').onclick = ()=> startPreview();
document.getElementById('btnEdit').onclick = ()=> stopPreview();
document.getElementById('btnClear').onclick = ()=>{ if(confirm('Clear all text?')){ pushUndo(); state.lines=[]; state.selection={lineIdx:-1,wordIdx:-1}; render(); } };
document.getElementById('btnUndo').onclick = undo;
document.getElementById('btnRedo').onclick = redo;
document.getElementById('btnCenterTop').onclick = ()=>{ layoutCenterAll(); };
document.getElementById('btnCenterBottom').onclick = ()=>{ layoutCenterAll(); };

document.getElementById('resolution').addEventListener('change', e=>{
  setResolution(e.target.value);
});

// Align controls
document.getElementById('alignLeft').onclick = ()=>{ if(state.selection.lineIdx<0) return; const line=state.lines[state.selection.lineIdx]; let x=0; for(const w of line.words){ w.manual=false; w.x=x; w.y=line.y; x+=measureWord(w).w+state.wordSpacing; } render(); };
document.getElementById('alignCenter').onclick = ()=>{ layoutCenterAll(); };
document.getElementById('alignRight').onclick = ()=>{ if(state.selection.lineIdx<0) return; const line=state.lines[state.selection.lineIdx]; let total=0; for(let i=0;i<line.words.length;i++){ const m = measureWord(line.words[i]); total+=m.w; if(i<line.words.length-1) total+=state.wordSpacing; } let x=Math.max(0,state.res.w-total); for(const w of line.words){ w.manual=false; w.x=x; w.y=line.y; x+=measureWord(w).w+state.wordSpacing; } render(); };
document.getElementById('alignManual').onclick = ()=>{ if(state.selection.lineIdx<0) return; for(const w of state.lines[state.selection.lineIdx].words){ w.manual=true; } };
document.getElementById('alignReset').onclick = ()=>{ for(const line of state.lines){ for(const w of line.words){ w.manual=false; } } layoutCenterAll(); };

// Spacing
document.getElementById('lineGap').addEventListener('input', e=>{ state.lineGap=parseInt(e.target.value,10); layoutCenterAll(); });
document.getElementById('wordSpacing').addEventListener('input', e=>{ state.wordSpacing=parseInt(e.target.value,10); layoutCenterAll(); });

// Font & size
document.getElementById('fontFamily').addEventListener('change', ()=>{ if(state.selection.lineIdx<0) return; const w=state.lines[state.selection.lineIdx].words[state.selection.wordIdx]; w.font=currentFont(); render(); });
document.getElementById('fontSize').addEventListener('input', ()=>{ if(state.selection.lineIdx<0) return; const w=state.lines[state.selection.lineIdx].words[state.selection.wordIdx]; w.size=currentSize(); render(); });

// Color swatches
const defaultSwatches = ['#2bd1ff','#36e05d','#ffd400','#ff63d1','#ff4444','#ffffff','#000000'];
const swWrap = document.getElementById('swatches');
function setCurrentColor(hex){ 
  let holder = document.getElementById('_currentColor');
  if(!holder){ holder = document.createElement('input'); holder.type='hidden'; holder.id='_currentColor'; document.body.appendChild(holder); }
  holder.value = hex;
}
function buildSwatches(){
  swWrap.innerHTML='';
  const stored = JSON.parse(localStorage.getItem('customSwatches')||'[]');
  const all = [...defaultSwatches, ...stored];
  all.forEach((hex, idx)=>{
    const chip = document.createElement('div');
    chip.className='chip'+(idx>=defaultSwatches.length?' custom':'');
    chip.style.background=hex;
    chip.title=hex;
    chip.oncontextmenu = (e)=>{
      if(!chip.classList.contains('custom')) return;
      e.preventDefault();
      // delete
      const arr = JSON.parse(localStorage.getItem('customSwatches')||'[]');
      const i = arr.indexOf(hex);
      if(i>-1){ arr.splice(i,1); localStorage.setItem('customSwatches', JSON.stringify(arr)); buildSwatches(); }
    };
    chip.onclick = ()=>{ setCurrentColor(hex); if(state.selection.lineIdx>=0){ const w=state.lines[state.selection.lineIdx].words[state.selection.wordIdx]; w.color=hex; render(); } if(document.getElementById('solidSwatch')){ document.getElementById('solidSwatch').style.background = hex; if(state.bg.mode==='solid'){ state.bg.color=hex; render(); } } };
    swWrap.appendChild(chip);
  });
}
document.getElementById('addSwatch').onclick = ()=>{
  const hex = document.getElementById('colorPicker').value;
  const arr = JSON.parse(localStorage.getItem('customSwatches')||'[]');
  if(!arr.includes(hex) && arr.length<5){ arr.push(hex); localStorage.setItem('customSwatches', JSON.stringify(arr)); buildSwatches(); }
};
buildSwatches();
setCurrentColor('#ffffff');

// Background selection
document.querySelectorAll('.thumb').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const t = btn.dataset.type;
    if(t==='preset'){
      loadPreset(btn.dataset.name);
    }else if(t==='solid'){
      setSolidColor(document.getElementById('_currentColor').value);
    }
  });
});
document.getElementById('bgUpload').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = ()=>{ state.bg.mode='image'; state.bg.image=img; render(); deselect(); };
  img.src = url;
});

// Animations toggles
document.querySelectorAll('.animToggle').forEach(cb=>{
  cb.addEventListener('change', e=>{
    if(state.selection.lineIdx<0) return;
    const w=state.lines[state.selection.lineIdx].words[state.selection.wordIdx];
    const key = e.target.dataset.anim;
    w.anim[key] = e.target.checked ? (parseInt(document.querySelector(`.animAmt[data-anim="${key}"]`).value,10)/100) : 0;
    render();
  });
});
document.querySelectorAll('.animAmt').forEach(sl=>{
  sl.addEventListener('input', e=>{
    if(state.selection.lineIdx<0) return;
    const w=state.lines[state.selection.lineIdx].words[state.selection.wordIdx];
    const key = e.target.dataset.anim;
    if(w.anim[key]>0){ w.anim[key] = parseInt(e.target.value,10)/100; render(); }
  });
});

// Init
setResolution('96x128');
fitCanvasOnScreen();
setSolidColor('#000000');
render();
