
/* Core state */
const canvas = document.getElementById('ledCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('word-overlay');
const inspector = document.getElementById('inspector');

const resSelect = document.getElementById('resSelect');
const bgGrid = document.getElementById('bgGrid');
const bgUpload = document.getElementById('bgUpload');

const btnPreview = document.getElementById('btnPreview');
const btnEdit = document.getElementById('btnEdit');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnClear = document.getElementById('btnClear');
const zIn = document.getElementById('zIn');
const zOut = document.getElementById('zOut');
const zLabel = document.getElementById('zLabel');

// inspector controls
const fontSelect = document.getElementById('fontSelect');
const fontSize = document.getElementById('fontSize');
const autoSize = document.getElementById('autoSize');
const swatchesEl = document.getElementById('swatches');
const colorPicker = document.getElementById('colorPicker');
const addSwatch = document.getElementById('addSwatch');
const lineGap = document.getElementById('lineGap');
const wordSpacing = document.getElementById('wordSpacing');
const alignMode = document.getElementById('alignMode');
const resetAlign = document.getElementById('resetAlign');
const addLine = document.getElementById('addLine');
const addWord = document.getElementById('addWord');
const animDet = document.getElementById('animDet');

/* Model */
let ledW = 96, ledH = 128;
let zoom = 1.0;
let bgMode = { kind:'preset', id:'A', color:'#000000', img:null };
let words = []; // {id,text,x,y,color,size,font,anim:{pulse:0-1,flicker:0-1}}
let selectedId = null;
let playing = false;

const history = [];
const future = [];

function pushHistory(){
  history.push(JSON.stringify({words,bgMode,ledW,ledH}));
  future.length = 0;
}
function undo(){
  if(!history.length) return;
  future.push(JSON.stringify({words,bgMode,ledW,ledH}));
  const st = JSON.parse(history.pop());
  words = st.words; bgMode = st.bgMode; ledW=st.ledW; ledH=st.ledH;
  syncAll();
}
function redo(){
  if(!future.length) return;
  history.push(JSON.stringify({words,bgMode,ledW,ledH}));
  const st = JSON.parse(future.pop());
  words = st.words; bgMode = st.bgMode; ledW=st.ledW; ledH=st.ledH;
  syncAll();
}

btnUndo.onclick = undo;
btnRedo.onclick = redo;

function setResolution(val){
  const [w,h] = val.split('x').map(n=>parseInt(n,10));
  ledW = w; ledH = h;
  layoutCanvas();
  drawAll();
  renderOverlay();
}
resSelect.addEventListener('change', e=>{
  setResolution(e.target.value);
  // swap presets for 64×64 -> use C/D thumbnails automatically
  const tiles = bgGrid.querySelectorAll('.bg-tile');
  tiles.forEach((tile,i)=>{
    const kind = tile.dataset.kind;
    if(kind==='preset'){
      const id = (ledW===64&&ledH===64) ? (i===0?'C':'D') : (i===0?'A':'B');
      tile.dataset.id = id;
      tile.querySelector('img').src = `assets/Preset_${id}.png`;
      tile.querySelector('.label').textContent = `Preset ${id}`;
    }
  });
});

function layoutCanvas(){
  // scale canvas to keep correct aspect and fit container
  const wrap = document.getElementById('preview-wrap');
  const maxW = wrap.clientWidth - 32;
  const maxH = Math.max(220, wrap.clientHeight - 32);
  const s = Math.min(maxW/ledW, maxH/ledH) * zoom;
  canvas.width = Math.round(ledW * s);
  canvas.height = Math.round(ledH * s);
  overlay.style.inset = '16px';
  drawAll();
}
window.addEventListener('resize', layoutCanvas);

/* Background */
const bgImg = new Image();
bgImg.onload = ()=> { drawAll(); };
function setBgPreset(id){
  bgMode = {kind:'preset', id, color:'#000000', img:`assets/Preset_${id}.png`};
  bgImg.src = bgMode.img;
  pushHistory();
}
function setSolidColor(){
  bgMode = {kind:'solid', color:colorPicker.value || '#000000'};
  pushHistory(); drawAll();
}
function setCustom(file){
  const url = URL.createObjectURL(file);
  bgMode = {kind:'custom', img:url, color:'#000000'};
  bgImg.src = url;
  pushHistory();
}

bgGrid.addEventListener('click', (e)=>{
  const tile = e.target.closest('.bg-tile');
  if(!tile) return;
  const kind = tile.dataset.kind;
  if(kind==='preset'){
    const id = tile.dataset.id || 'A';
    setBgPreset(id);
  }else if(kind==='solid'){
    setSolidColor();
  }
});

bgUpload.addEventListener('change', e=>{
  const f = e.target.files?.[0];
  if(f) setCustom(f);
});

/* Words → overlay spans */
function pxFromLed(x,y){
  const r = canvas.getBoundingClientRect();
  return { x: x/ledW * canvas.width, y: y/ledH * canvas.height };
}
function ledFromPx(px,py){
  return { x: Math.max(0,Math.min(ledW, px/canvas.width*ledW)),
           y: Math.max(0,Math.min(ledH, py/canvas.height*ledH)) };
}

function renderOverlay(){
  overlay.innerHTML = '';
  words.forEach(w=>{
    const span = document.createElement('span');
    span.className = 'word-span';
    span.dataset.id = w.id;
    span.textContent = w.text;
    span.style.color = w.color;
    span.style.fontFamily = w.font;
    span.style.fontSize = `${w.size}px`;
    const {x,y} = pxFromLed(w.x,w.y);
    span.style.left = x + 'px';
    span.style.top  = y + 'px';
    if(w.id===selectedId){
      span.classList.add('is-selected');
      const del = document.createElement('button');
      del.className = 'delete-pill';
      del.textContent = '× Delete';
      del.addEventListener('mousedown', ev=>{
        ev.stopPropagation();
        words = words.filter(v=>v.id!==w.id);
        selectedId = null;
        pushHistory();
        syncAll();
      });
      span.appendChild(del);
      if(alignMode.value==='manual'){ span.classList.add('drag-allowed'); }
    }
    span.addEventListener('mousedown', ev=>{
      ev.stopPropagation();
      selectWord(w.id);
      if(alignMode.value==='manual'){
        startDrag(span,w,ev);
      }
    });
    overlay.appendChild(span);
  });
  inspector.setAttribute('aria-disabled', selectedId? 'false':'true');
}

function selectWord(id){
  selectedId = id;
  renderOverlay();
  const span = overlay.querySelector(`[data-id="${id}"]`);
  if(span){
    span.setAttribute('contenteditable','true');
    span.focus();
    placeCaretEnd(span);
    span.addEventListener('input', ()=>{
      const w = words.find(v=>v.id===id);
      w.text = span.textContent;
      if(autoSize.checked) autoSizeWord(w,span);
      drawAll();
    });
  }
}

function placeCaretEnd(el){
  const r = document.createRange();
  r.selectNodeContents(el); r.collapse(false);
  const s = window.getSelection();
  s.removeAllRanges(); s.addRange(r);
}

function startDrag(span,w,ev){
  span.classList.add('dragging');
  let lastX = ev.clientX, lastY = ev.clientY;
  function move(e){
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    const r = canvas.getBoundingClientRect();
    const sx = ledW / canvas.width;
    const sy = ledH / canvas.height;
    w.x = Math.max(0, Math.min(ledW, w.x + dx*sx));
    w.y = Math.max(0, Math.min(ledH, w.y + dy*sy));
    renderOverlay(); drawAll();
  }
  function up(){
    span.classList.remove('dragging');
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    pushHistory();
  }
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

function addWordAtCenter(txt='Hello'){
  const id = Math.random().toString(36).slice(2,9);
  const w = { id, text: txt, x: ledW/2, y: ledH/2, color: '#ffffff', size: 22, font: fontSelect.value, anim:{pulse:0,flicker:0} };
  words.push(w); selectedId = id;
  pushHistory();
  syncAll();
}

addWord.addEventListener('click', ()=> addWordAtCenter('Hello'));
addLine.addEventListener('click', ()=> addWordAtCenter('New Line'));
btnClear.addEventListener('click', ()=>{ words = []; selectedId=null; pushHistory(); syncAll(); });

/* Inspector bindings */
fontSelect.onchange = ()=> applyToSel('font', fontSelect.value);
fontSize.oninput = ()=> applyToSel('size', parseInt(fontSize.value,10));
lineGap.oninput = ()=> { /* reserved: affects multi-line layout later */ };
wordSpacing.oninput = ()=> { /* reserved */ };
alignMode.onchange = ()=> renderOverlay();
resetAlign.onclick = ()=>{
  const w = getSel(); if(!w) return;
  w.x = ledW/2; w.y = ledH/2; renderOverlay(); drawAll();
};

// swatches init + clicks change color immediately
const defaultSwatches = ['#00b7ff','#37d63c','#ffd13c','#ff68d9','#ff4d4d','#ffffff','#000000'];
function buildSwatches(){
  swatchesEl.innerHTML='';
  defaultSwatches.forEach(hex=>{
    const s=document.createElement('button');
    s.className='swatch'; s.style.background=hex;
    s.addEventListener('click', ()=>{
      colorPicker.value = hex;
      applyToSel('color', hex);
    });
    swatchesEl.appendChild(s);
  });
}
buildSwatches();
addSwatch.onclick = ()=>{
  defaultSwatches.push(colorPicker.value);
  buildSwatches();
};
colorPicker.oninput = ()=> applyToSel('color', colorPicker.value);

autoSize.onchange = ()=>{
  const w = getSel(); if(!w) return;
  const span = overlay.querySelector(`[data-id="${w.id}"]`);
  if(span) autoSizeWord(w,span);
  drawAll();
};

function getSel(){ return words.find(v=>v.id===selectedId); }
function applyToSel(k,v){
  const w = getSel(); if(!w) return;
  w[k]=v; renderOverlay(); drawAll();
  pushHistory();
}

function autoSizeWord(w,span){
  // shrink if overflow: ensure word fits within canvas width
  const maxPx = canvas.width - 8;
  let size = parseInt(window.getComputedStyle(span).fontSize,10);
  span.style.fontSize = size + 'px';
  while(span.offsetWidth > maxPx && size>6){
    size -= 1; span.style.fontSize = size + 'px';
  }
  w.size = size;
}

/* Draw loop */
function drawAll(){
  // background
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(bgMode.kind==='solid'){
    ctx.fillStyle = bgMode.color || '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  }else if(bgImg.complete && (bgMode.kind==='preset' || bgMode.kind==='custom')){
    const iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
    const s = Math.max(canvas.width/iw, canvas.height/ih); // COVER, so no letterboxing
    const w = iw*s, h = ih*s;
    const x = (canvas.width - w)/2, y = (canvas.height - h)/2;
    ctx.drawImage(bgImg, x,y,w,h);
  }else{
    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  // (optional) show animations rendering; for now we just rely on CSS overlay for typing/drag
}

/* Preview vs Edit */
btnPreview.onclick = ()=>{ playing = true; btnPreview.classList.add('active'); btnEdit.classList.remove('active'); };
btnEdit.onclick = ()=>{ playing = false; btnEdit.classList.add('active'); btnPreview.classList.remove('active'); };

// Deselect when clicking empty background to watch animations
overlay.addEventListener('mousedown', (e)=>{
  if(e.target===overlay){ selectedId=null; renderOverlay(); }
});

/* Zoom */
function setZoom(z){ zoom = Math.max(.25, Math.min(4, z)); zLabel.textContent = Math.round(zoom*100)+'%'; layoutCanvas(); }
zIn.onclick = ()=> setZoom(zoom+0.1);
zOut.onclick = ()=> setZoom(zoom-0.1);

/* Kickoff */
function syncAll(){
  layoutCanvas();
  // load bg if preset selected
  if(bgMode.kind==='preset' || bgMode.kind==='custom'){ if(bgMode.img) bgImg.src = bgMode.img; }
  renderOverlay();
  drawAll();
}
setResolution('96x128'); // default
setBgPreset('A');
syncAll();

// If no words, show Add Word prominently
if(words.length===0){ addWordAtCenter('Hello'); }

