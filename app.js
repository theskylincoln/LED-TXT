
/* LED Backpack Animator v1.4.7 - single-file core */
const resSel = document.getElementById('resolution');
const bgCanvas = document.getElementById('bgCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const bgCtx = bgCanvas.getContext('2d');
const ctx = drawCanvas.getContext('2d');
const wrap = document.querySelector('.canvasWrap');
const btnPreview = document.getElementById('btnPreview');
const btnEdit = document.getElementById('btnEdit');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnClear = document.getElementById('btnClear');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const zoomPct = document.getElementById('zoomPct');
const deletePill = document.getElementById('deletePill');
const inspector = document.getElementById('inspector');
const secFont = document.getElementById('secFont');
const fontFamily = document.getElementById('fontFamily');
const fontSize = document.getElementById('fontSize');
const autoSize = document.getElementById('autoSize');
const lineGap = document.getElementById('lineGap');
const wordSpacing = document.getElementById('wordSpacing');
const secAlign = document.getElementById('secAlign');
const alignBtns = secAlign.querySelectorAll('button[data-align]');
const btnReset = document.getElementById('btnReset');
const btnAddLine = document.getElementById('btnAddLine');
const btnAddWord = document.getElementById('btnAddWord');
const swatches = document.getElementById('swatches');
const colorPicker = document.getElementById('colorPicker');
const addSwatch = document.getElementById('addSwatch');
const anPulse = document.getElementById('anPulse');
const pulseAmt = document.getElementById('pulseAmt');
const anFlicker = document.getElementById('anFlicker');
const flickerAmt = document.getElementById('flickerAmt');
const bgUpload = document.getElementById('bgUpload');

let state = {
  res: {w:96,h:128},
  zoom: 3,               // canvas pixel zoom
  words: [],             // {text,color,font,size,x,y,line,align,manual,anim:{pulse,flicker}}
  lines: [[]],           // array of arrays of indices for state.words
  selected: -1,
  bg: {type:'solid', color:'#000000', img:null},
  mode: 'edit',          // 'edit' | 'preview'
  undo: [], redo: []
};

const MAX_UNDO = 20;

// ---------- Helpers
function pushUndo(){
  const snap = JSON.stringify(state, (k,v)=> (k==='undo'||k==='redo'||k==='bg'&&v?.img)? (k==='bg'? {...v, img:null}: undefined) : v );
  state.undo.push(snap);
  if(state.undo.length>MAX_UNDO) state.undo.shift();
  state.redo.length=0;
}
function applySnap(snap){
  const obj=JSON.parse(snap);
  // restore and keep bg image reference
  const img = state.bg.img;
  Object.assign(state, obj);
  state.bg.img = img;
  layout();
  render();
}

function setRes(str){
  const [w,h]=str.split('x').map(n=>parseInt(n,10));
  state.res={w,h};
  layout();
  render();
}
function layout(){
  const pad=10;
  const scal = Math.max(2, Math.min(6, state.zoom));
  const cw = state.res.w*scal;
  const ch = state.res.h*scal;
  bgCanvas.width = cw; bgCanvas.height = ch;
  drawCanvas.width = cw; drawCanvas.height = ch;
  wrap.style.width = (cw+pad*2)+'px';
  wrap.style.height = (ch+pad*2)+'px';
  renderBackground();
}
function renderBackground(){
  bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  if(state.bg.type==='image' && state.bg.img){
    // contain
    const iw = state.bg.img.width;
    const ih = state.bg.img.height;
    const rw = bgCanvas.width, rh = bgCanvas.height;
    const s = Math.min(rw/iw, rh/ih);
    const dw = iw*s, dh = ih*s;
    const dx = (rw-dw)/2, dy=(rh-dh)/2;
    bgCtx.drawImage(state.bg.img, dx, dy, dw, dh);
  } else {
    bgCtx.fillStyle = state.bg.color || '#000';
    bgCtx.fillRect(0,0,bgCanvas.width,bgCanvas.height);
  }
}

function selectWord(idx){
  state.selected = idx;
  updateInspectorEnabled();
  render();
}
function deselect(){
  state.selected = -1;
  updateInspectorEnabled();
  render();
}

function updateInspectorEnabled(){
  const disabled = (state.selected<0);
  inspector.classList.toggle('disabled', disabled);
  deletePill.style.display = disabled? 'none':'block';
}

function addWord(text, lineIndex, xCenter){
  const color = '#ffffff';
  const w = {text, color, font:fontFamily.value, size:parseInt(fontSize.value,10), x: xCenter||drawCanvas.width/2, y: 10, line: lineIndex, align:'center', manual:false, anim:{pulse:false,pulseAmt:60,flicker:false,flickerAmt:40}};
  const idx = state.words.push(w)-1;
  if(!state.lines[lineIndex]) state.lines[lineIndex]=[];
  state.lines[lineIndex].push(idx);
  autoPlaceLines();
  selectWord(idx);
}

function addLine(){
  pushUndo();
  state.lines.push([]);
  autoPlaceLines();
  render();
}

function measureWord(w){
  ctx.save();
  ctx.font = `${w.size}px ${w.font}`;
  const m = ctx.measureText(w.text);
  ctx.restore();
  return {w: Math.ceil(m.width), h: w.size};
}

function autoPlaceLines(){
  // set y positions spaced by lineGap with vertical centering
  const lg = parseInt(lineGap.value,10);
  const totalH = state.lines.length * (currentSize() + lg) - lg;
  let startY = (drawCanvas.height - totalH)/2 + currentSize();
  state.lines.forEach((line, i)=>{
    line.forEach(idx=>{
      const w = state.words[idx];
      w.y = startY + i*(currentSize()+lg);
    });
  });
  layoutLineX();
}

function currentSize(){
  return parseInt(fontSize.value,10);
}
function layoutLineX(){
  const ws = parseInt(wordSpacing.value,10);
  state.lines.forEach(line => {
    // center layout
    let widths = line.map(idx=>measureWord(state.words[idx]).w);
    let total = widths.reduce((a,b)=>a+b,0) + ws*(Math.max(0,line.length-1));
    let x = (drawCanvas.width-total)/2;
    for(let i=0;i<line.length;i++){
      const w = state.words[line[i]];
      if(!w.manual){
        w.x = x + widths[i]/2;
      }
      x += widths[i]+ws;
    }
  });
}

function render(){
  ctx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
  const caretBlink = (Date.now()/500|0)%2===0;
  state.lines.forEach(line=>{
    line.forEach(idx=>{
      const w = state.words[idx];
      ctx.save();
      // animations (only when previewing)
      let alpha=1, scale=1;
      if(state.mode==='preview'){
        if(w.anim.flicker && w.anim.flickerAmt>0){
          const f = w.anim.flickerAmt/100;
          alpha = 1 - (Math.random()*0.6*f);
        }
        if(w.anim.pulse && w.anim.pulseAmt>0){
          const p = w.anim.pulseAmt/100;
          scale = 1 + Math.sin(performance.now()/300)*0.15*p;
        }
      }
      ctx.globalAlpha = alpha;
      ctx.translate(w.x, w.y);
      ctx.scale(scale, scale);
      ctx.font = `${w.size}px ${w.font}`;
      ctx.fillStyle = w.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(w.text, 0, 0);
      ctx.restore();

      // selection box & caret
      if(state.selected===idx && state.mode==='edit'){
        const m = measureWord(w);
        const x = w.x - m.w/2;
        const y = w.y - m.h/2;
        ctx.save();
        ctx.strokeStyle = '#ff4dff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x-6,y-4,m.w+12,m.h+8);
        if(caretBlink){
          ctx.fillStyle='#ffffff';
          ctx.fillRect(w.x + m.w/2 + 2, y-2, 2, m.h+4);
        }
        ctx.restore();
        // position delete pill
        deletePill.style.left = (wrap.offsetLeft + 10 + x + m.w + 8)+'px';
        deletePill.style.top  = (wrap.offsetTop + 10 + y - 22)+'px';
      }
    });
  });
}

function setAlign(al){
  if(state.selected<0) return;
  pushUndo();
  const w = state.words[state.selected];
  w.align=al;
  w.manual=(al==='manual');
  if(al!=='manual') layoutLineX();
  render();
  alignBtns.forEach(b=>b.classList.toggle('active', b.dataset.align===al));
}

alignBtns.forEach(b=> b.addEventListener('click',()=> setAlign(b.dataset.align)) );
btnReset.addEventListener('click',()=>{
  if(state.selected<0) return;
  pushUndo();
  const w = state.words[state.selected];
  w.manual=false; w.align='center';
  layoutLineX(); render();
  alignBtns.forEach(b=>b.classList.toggle('active', b.dataset.align==='center'));
});

// zoom
function setZoom(delta){
  state.zoom = Math.max(1, Math.min(8, state.zoom + delta));
  zoomPct.textContent = (state.zoom*100/3|0)+'%';
  layout(); render();
}
zoomIn.addEventListener('click',()=>setZoom(+1));
zoomOut.addEventListener('click',()=>setZoom(-1));

// resolution
resSel.addEventListener('change', e=>{
  setRes(e.target.value);
});

// background thumbnails
document.querySelectorAll('.thumb').forEach(th=>{
  th.addEventListener('click', ()=>{
    pushUndo();
    document.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active'));
    th.classList.add('active');
    if(th.dataset.type==='preset'){
      const name = th.dataset.name;
      const img = new Image();
      img.onload = ()=>{ state.bg={type:'image',img}; renderBackground(); render(); };
      img.src = `assets/${name}.png`;
    } else if(th.dataset.type==='solid'){
      state.bg={type:'solid', color:'#000000'};
      renderBackground(); render();
    }
    deselect();
  });
});

bgUpload.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = ()=>{ state.bg={type:'image',img}; renderBackground(); render(); };
  img.src = url;
  deselect();
});

// canvas interactions
let dragActive=false;
drawCanvas.addEventListener('mousedown', (e)=>{
  const pt = canvasPoint(e);
  const hit = hitTest(pt.x, pt.y);
  if(hit>=0){
    if(state.mode==='preview'){ setMode('edit'); }
    selectWord(hit);
    // if double-click, enable manual drag
    if(e.detail===2){
      setAlign('manual');
      dragActive=true;
    }
  } else {
    // click on blank: start new word on that line center
    if(state.mode!=='edit') setMode('edit');
    pushUndo();
    const lineIndex = state.lines.length-1;
    addWord('', lineIndex, pt.x);
  }
});
drawCanvas.addEventListener('mousemove', (e)=>{
  if(dragActive && state.selected>=0){
    const pt = canvasPoint(e);
    const w = state.words[state.selected];
    w.x = pt.x; w.y = pt.y;
    render();
  }
});
window.addEventListener('mouseup', ()=> dragActive=false);

function hitTest(x,y){
  for(let i=state.words.length-1;i>=0;i--){
    const w=state.words[i];
    const m = measureWord(w);
    const rx = w.x - m.w/2 -6, ry = w.y - m.h/2 -4, rw=m.w+12, rh=m.h+8;
    if(x>=rx && x<=rx+rw && y>=ry && y<=ry+rh) return i;
  }
  return -1;
}
function canvasPoint(e){
  const r = drawCanvas.getBoundingClientRect();
  const x = (e.clientX - r.left);
  const y = (e.clientY - r.top);
  return {x,y};
}

// typing editing in place
window.addEventListener('keydown', (e)=>{
  if(state.selected<0) return;
  const w = state.words[state.selected];
  if(e.key==='Backspace'){
    e.preventDefault();
    pushUndo();
    w.text = w.text.slice(0,-1);
    layoutLineX(); render();
    return;
  }
  if(e.key===' '){
    e.preventDefault();
    pushUndo();
    // split into a new word on same line
    const idx = state.selected;
    const line = state.words[idx].line;
    addWord('', line);
    return;
  }
  if(e.key.length===1 && !e.ctrlKey && !e.metaKey){
    pushUndo();
    w.text += e.key;
    layoutLineX(); render();
  }
});

// inspector controls wiring
fontFamily.addEventListener('change', ()=>{
  if(state.selected<0) return;
  pushUndo();
  state.words[state.selected].font = fontFamily.value;
  render();
});
fontSize.addEventListener('change', ()=>{
  if(state.selected<0) return;
  pushUndo();
  state.words[state.selected].size = parseInt(fontSize.value,10);
  layoutLineX(); render();
});
autoSize.addEventListener('change', ()=>{
  // placeholder flag; auto-shrink can be enhanced further
});
lineGap.addEventListener('change', ()=>{ autoPlaceLines(); render(); });
wordSpacing.addEventListener('change', ()=>{ layoutLineX(); render(); });

swatches.addEventListener('click', (e)=>{
  const b = e.target.closest('.sw');
  if(!b || state.selected<0) return;
  pushUndo();
  const col = b.dataset.color;
  state.words[state.selected].color = col;
  render();
});
swatches.addEventListener('contextmenu', (e)=>{
  const b = e.target.closest('.sw.custom');
  if(!b) return;
  e.preventDefault();
  b.remove();
});

addSwatch.addEventListener('click', ()=>{
  const col = colorPicker.value;
  const btn = document.createElement('button');
  btn.className='sw custom';
  btn.dataset.color = col;
  btn.style.setProperty('--c', col);
  swatches.appendChild(btn);
});

btnAddLine.addEventListener('click', ()=>{
  addLine();
});
btnAddWord.addEventListener('click', ()=>{
  pushUndo();
  addWord('', state.lines.length-1);
});

// delete selected word
deletePill.addEventListener('click', ()=>{
  if(state.selected<0) return;
  pushUndo();
  const idx = state.selected;
  // remove from line
  const line = state.words[idx].line;
  state.lines[line] = state.lines[line].filter(i=>i!==idx);
  state.words.splice(idx,1);
  // fix indices in lines
  state.lines = state.lines.map(arr=>arr.map(i=> i>idx? i-1: i));
  deselect();
  render();
});

// mode switching and animation loop
let rafId = 0;
function setMode(m){
  state.mode=m;
  if(m==='preview'){
    loop();
  } else {
    cancelAnimationFrame(rafId);
    rafId=0;
    render();
  }
}
btnPreview.addEventListener('click', ()=> setMode('preview'));
btnEdit.addEventListener('click', ()=> setMode('edit'));

function loop(){
  renderBackground();
  render();
  rafId = requestAnimationFrame(loop);
}
// Anim toggles
anPulse.addEventListener('change',()=>{
  if(state.selected<0) return;
  pushUndo();
  const w = state.words[state.selected];
  w.anim.pulse = anPulse.checked;
  w.anim.pulseAmt = parseInt(pulseAmt.value,10);
});
pulseAmt.addEventListener('input',()=>{
  if(state.selected<0) return;
  const w = state.words[state.selected];
  w.anim.pulseAmt = parseInt(pulseAmt.value,10);
});

anFlicker.addEventListener('change',()=>{
  if(state.selected<0) return;
  pushUndo();
  const w = state.words[state.selected];
  w.anim.flicker = anFlicker.checked;
  w.anim.flickerAmt = parseInt(flickerAmt.value,10);
});
flickerAmt.addEventListener('input',()=>{
  if(state.selected<0) return;
  const w = state.words[state.selected];
  w.anim.flickerAmt = parseInt(flickerAmt.value,10);
});

// undo/redo
btnUndo.addEventListener('click', ()=>{
  if(state.undo.length===0) return;
  const snap = state.undo.pop();
  state.redo.push(JSON.stringify(state));
  applySnap(snap);
});
btnRedo.addEventListener('click', ()=>{
  if(state.redo.length===0) return;
  const snap = state.redo.pop();
  state.undo.push(JSON.stringify(state));
  applySnap(snap);
});
btnClear.addEventListener('click', ()=>{
  pushUndo();
  state.words=[]; state.lines=[[]];
  deselect();
  render();
});

// init
function init(){
  document.querySelector('.thumb[data-name="Preset_A"]').classList.add('active');
  // load initial background
  const img = new Image();
  img.onload = ()=>{ state.bg={type:'image',img}; layout(); render(); };
  img.src = 'assets/Preset_A.png';
  setRes(resSel.value);
  zoomPct.textContent = (state.zoom*100/3|0)+'%';
  updateInspectorEnabled();
  // open Font by default
  document.getElementById('secFont').setAttribute('open','');
}
init();
