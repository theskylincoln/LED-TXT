// Basic state
const canvas = document.getElementById('led');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvasWrap');
const deletePill = document.getElementById('deleteWord');
const inspector = document.getElementById('inspector');

let state = {
  res: {w:96, h:128},
  zoom: 4,
  bg: {type:'solid', color:'#000000', image:null},
  lines: [
    { y: 10, words: [{text:'Hello', x:0, color:'#FFFFFF'}], align:'center', size:22, font:'monospace', manual:false }
  ],
  selection: { line:0, word:0 }, // selected word
  anim: { pulse:false, pulseAmt:60, flicker:false, flickerAmt:40 },
  mode: 'edit' // edit | preview
};

// UI elements
const resSel = document.getElementById('resolution');
const zoomOut = document.getElementById('zoomOut');
const zoomIn = document.getElementById('zoomIn');
const zoomPct = document.getElementById('zoomPct');
const btnPreview = document.getElementById('btnPreview');
const btnEdit = document.getElementById('btnEdit');
const btnClear = document.getElementById('btnClear');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');

// Inspector controls
const fontFamily = document.getElementById('fontFamily');
const fontSize = document.getElementById('fontSize');
const autoSize = document.getElementById('autoSize');
const lineGap = document.getElementById('lineGap');
const wordSpacing = document.getElementById('wordSpacing');
const alignButtons = [...document.querySelectorAll('.align')];
const alignReset = document.getElementById('alignReset');
const swatchesEl = document.getElementById('swatches');
const addSwatchBtn = document.getElementById('addSwatch');
const colorPicker = document.getElementById('colorPicker');
const addLineBtn = document.getElementById('addLine');

// Anim
const animPulse = document.getElementById('animPulse');
const pulseAmt = document.getElementById('pulseAmt');
const animFlicker = document.getElementById('animFlicker');
const flickerAmt = document.getElementById('flickerAmt');

// Defaults
const defaultSwatches = ['#25b7ff','#27d845','#ffd633','#ff66cc','#ff3347','#ffffff','#000000'];

function buildSwatches(){
  swatchesEl.innerHTML='';
  defaultSwatches.forEach(c => {
    const d = document.createElement('div');
    d.className='swatch';
    d.style.background=c;
    d.title=c;
    d.onclick = ()=> applyColor(c);
    swatchesEl.appendChild(d);
  });
  // custom storage
  const custom = JSON.parse(localStorage.getItem('custom_swatches')||'[]');
  custom.forEach(c => {
    const d = document.createElement('div');
    d.className='swatch custom';
    d.style.background=c;
    d.title=c;
    d.onclick = (e)=>{
      if(e.target===d){ applyColor(c); }
    };
    d.addEventListener('click', (e)=>{
      // click X remove (pseudo via hover)
      if(e.offsetX > d.clientWidth-4 && e.offsetY < 10){
        removeCustomSwatch(c);
        e.stopPropagation();
      }
    });
    swatchesEl.appendChild(d);
  });
}

function addCustomSwatch(c){
  const arr = JSON.parse(localStorage.getItem('custom_swatches')||'[]');
  if(arr.length>=5) arr.shift();
  if(!arr.includes(c)) arr.push(c);
  localStorage.setItem('custom_swatches', JSON.stringify(arr));
  buildSwatches();
}
function removeCustomSwatch(c){
  let arr = JSON.parse(localStorage.getItem('custom_swatches')||'[]');
  arr = arr.filter(x=>x!==c);
  localStorage.setItem('custom_swatches', JSON.stringify(arr));
  buildSwatches();
}
addSwatchBtn.onclick = ()=> addCustomSwatch(colorPicker.value);

function applyColor(c){
  const sel = state.selection;
  if(sel){
    const w = state.lines[sel.line].words[sel.word];
    w.color = c;
    render();
  }
}

// Accordion
document.querySelectorAll('.accordion').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const target = document.querySelector(btn.dataset.target);
    target.style.display = target.style.display==='block' ? 'none' : 'block';
  });
});

// Background tiles
const bgGrid = document.getElementById('bgGrid');
bgGrid.addEventListener('click', (e)=>{
  const tile = e.target.closest('.tile');
  if(!tile) return;
  const type = tile.dataset.type;
  if(type==='solid'){
    state.bg = {type:'solid',color:'#000000',image:null};
  }else if(type==='custom'){
    document.getElementById('bgUpload').click();
  }else if(type==='preset'){
    const id = tile.dataset.id;
    state.bg = {type:'preset',image:`assets/presets/Preset_${id}.png`};
  }
  state.selection=null; // deselect
  inspector.classList.add('disabled');
  render();
});
document.getElementById('bgUpload').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  state.bg = {type:'custom', image:url};
  state.selection=null;
  render();
});

// Canvas sizing & zoom
function updateCanvasScale(){
  canvas.style.width = (state.res.w*state.zoom)+'px';
  canvas.style.height = (state.res.h*state.zoom)+'px';
  zoomPct.textContent = (state.zoom*25)+'%';
}
zoomIn.onclick = ()=>{ state.zoom=Math.min(12,state.zoom+1); updateCanvasScale(); };
zoomOut.onclick = ()=>{ state.zoom=Math.max(2,state.zoom-1); updateCanvasScale(); };

// Resolution
resSel.onchange = ()=>{
  const [w,h] = resSel.value.split('x').map(n=>parseInt(n,10));
  state.res = {w, h};
  canvas.width = w; canvas.height = h;
  updateCanvasScale();
  // Auto-swap 64x64 presets visibility is handled by click availability; we still render fine.
  render();
};

// Undo/Redo (simple)
let history = [];
let future = [];
function snapshot(){
  history.push(JSON.stringify(state));
  if(history.length>30) history.shift();
  future.length=0;
}
btnUndo.onclick = ()=>{
  const prev = history.pop();
  if(prev){
    future.push(JSON.stringify(state));
    state = JSON.parse(prev);
    rebind();
    render();
  }
};
btnRedo.onclick = ()=>{
  const next = future.pop();
  if(next){
    history.push(JSON.stringify(state));
    state = JSON.parse(next);
    rebind();
    render();
  }
};

btnClear.onclick = ()=>{
  snapshot();
  state.lines = [];
  state.selection=null;
  inspector.classList.add('disabled');
  render();
};

btnPreview.onclick = ()=>{ state.mode='preview'; render(); };
btnEdit.onclick = ()=>{ state.mode='edit'; render(); };

// Inspector bindings
function rebind(){
  // align defaults to center
  alignButtons.forEach(b=>b.classList.remove('active'));
  const sel = state.selection;
  if(sel){
    const line = state.lines[sel.line];
    const word = line.words[sel.word];
    fontFamily.value=line.font;
    fontSize.value=line.size;
    autoSize.checked = true;
    // alignment
    const ax = line.manual ? 'manual' : (line.align||'center');
    const btn = alignButtons.find(b=>b.dataset.align===ax);
    if(btn) btn.classList.add('active');
  }
}
fontFamily.onchange = ()=>{ const s=state.selection; if(s){ state.lines[s.line].font=fontFamily.value; render(); }};
fontSize.onchange = ()=>{ const s=state.selection; if(s){ state.lines[s.line].size=parseInt(fontSize.value,10); render(); }};
autoSize.onchange = ()=> render();
lineGap.onchange = ()=> render();
wordSpacing.onchange = ()=> render();

alignButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const a = btn.dataset.align;
    alignButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const s=state.selection; if(!s) return;
    const line = state.lines[s.line];
    line.manual = (a==='manual');
    if(!line.manual){ line.align=a; }
    render();
  });
});
alignReset.onclick = ()=>{
  const s=state.selection; if(!s) return;
  const line = state.lines[s.line];
  line.manual=false; line.align='center';
  render();
};

// Add line
addLineBtn.onclick = ()=>{
  snapshot();
  const y = state.lines.length? (state.lines[state.lines.length-1].y + (parseInt(lineGap.value,10)||2) + 20) : 10;
  state.lines.push({y, words:[{text:"New", x:0, color:'#FFFFFF'}], align:'center', size:22, font:'monospace', manual:false});
  state.selection = {line:state.lines.length-1, word:0};
  inspector.classList.remove('disabled');
  rebind(); render();
};

// Animation controls
animPulse.onchange = ()=>{ state.anim.pulse = animPulse.checked; render(); };
pulseAmt.oninput = ()=>{ state.anim.pulseAmt = parseInt(pulseAmt.value,10); if(state.anim.pulse) render(); };
animFlicker.onchange = ()=>{ state.anim.flicker = animFlicker.checked; render(); };
flickerAmt.oninput = ()=>{ state.anim.flickerAmt = parseInt(flickerAmt.value,10); if(state.anim.flicker) render(); };

// Selection + Editing
let dragging=false;
let dragOffset={x:0,y:0};

canvas.addEventListener('click', (e)=>{
  const pos = getCanvasPos(e);
  const hit = hitTest(pos.x,pos.y);
  if(hit){
    state.selection = hit;
    inspector.classList.remove('disabled');
    rebind();
    updateDeletePill();
    render();
  }else{
    // deselect when clicking background
    state.selection=null;
    inspector.classList.add('disabled');
    deletePill.classList.add('hidden');
    render();
  }
});

let clickTime=0;
canvas.addEventListener('mousedown', (e)=>{
  const now = Date.now();
  const dbl = (now - clickTime) < 350;
  clickTime = now;
  const pos = getCanvasPos(e);
  const hit = hitTest(pos.x,pos.y);
  if(hit){
    state.selection=hit;
    inspector.classList.remove('disabled');
    rebind();
    if(dbl){
      // switch to manual drag
      const line = state.lines[hit.line];
      line.manual=true;
      alignButtons.forEach(b=>b.classList.remove('active'));
      alignButtons.find(b=>b.dataset.align==='manual').classList.add('active');
      dragging=true;
      dragOffset = {x: pos.x - line.words[hit.word].x, y: pos.y - line.y};
      canvas.style.cursor='move';
    }
    updateDeletePill();
    render();
  }
});
window.addEventListener('mouseup', ()=>{ dragging=false; canvas.style.cursor='default'; });
canvas.addEventListener('mousemove', (e)=>{
  if(!dragging) return;
  const s = state.selection; if(!s) return;
  const pos = getCanvasPos(e);
  const line = state.lines[s.line];
  line.words[s.word].x = Math.max(0, Math.min(state.res.w-1, Math.round(pos.x - dragOffset.x)));
  line.y = Math.max(0, Math.min(state.res.h-1, Math.round(pos.y - dragOffset.y)));
  updateDeletePill();
  render();
});

// Keyboard typing edits selected word directly
window.addEventListener('keydown', (e)=>{
  const s=state.selection; if(!s) return;
  const word = state.lines[s.line].words[s.word];
  if(e.key.length===1){
    e.preventDefault();
    if(e.key===' '){
      // split into a new word after this one
      state.lines[s.line].words.splice(s.word+1,0,{text:'',x:word.x+ (parseInt(wordSpacing.value,10)||3)*2, color:word.color});
      state.selection.word += 1;
    }else{
      word.text += e.key;
    }
    render();
  }else if(e.key==='Backspace'){
    e.preventDefault();
    word.text = word.text.slice(0,-1);
    render();
  }
});

deletePill.onclick = ()=>{
  const s=state.selection; if(!s) return;
  const line = state.lines[s.line];
  line.words.splice(s.word,1);
  if(line.words.length===0){
    state.lines.splice(s.line,1);
    state.selection=null; inspector.classList.add('disabled');
  }else{
    state.selection.word = Math.max(0, s.word-1);
  }
  deletePill.classList.add('hidden');
  render();
};

function updateDeletePill(){
  const s=state.selection; if(!s){ deletePill.classList.add('hidden'); return; }
  const line = state.lines[s.line];
  const word = line.words[s.word];
  const metrics = measureWord(word, line);
  const x = (word.x*state.zoom) + wrap.offsetLeft + metrics.w*state.zoom + 8;
  const y = (line.y*state.zoom) + wrap.offsetTop - 12;
  deletePill.style.left = (word.x*state.zoom + metrics.w*state.zoom + 30) + 'px';
  deletePill.style.top = (line.y*state.zoom + 10) + 'px';
  deletePill.classList.remove('hidden');
}

function getCanvasPos(e){
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / state.zoom);
  const y = Math.floor((e.clientY - rect.top) / state.zoom);
  return {x,y};
}

function hitTest(x,y){
  for(let li=0; li<state.lines.length; li++){
    const line = state.lines[li];
    for(let wi=0; wi<line.words.length; wi++){
      const w = line.words[wi];
      const m = measureWord(w, line);
      const inBox = (x>=w.x && x<=w.x+m.w && y>=line.y-m.h && y<=line.y);
      if(inBox) return {line:li, word:wi};
    }
  }
  return null;
}

function measureWord(word, line){
  ctx.font = `${line.size}px ${line.font}`;
  const w = Math.ceil(ctx.measureText(word.text||' ').width);
  const h = Math.ceil(line.size);
  return {w,h};
}

function autoFit(line){
  if(!document.getElementById('autoSize').checked) return;
  // shrink per word to fit width
  const margin=4;
  line.words.forEach(w=>{
    ctx.font = `${line.size}px ${line.font}`;
    let met = measureWord(w,line);
    while(met.w + w.x > state.res.w - margin && line.size>6){
      line.size -= 1;
      ctx.font = `${line.size}px ${line.font}`;
      met = measureWord(w,line);
    }
  });
}

function drawBackground(){
  if(state.bg.type==='solid'){
    ctx.fillStyle = state.bg.color;
    ctx.fillRect(0,0,state.res.w,state.res.h);
  }else{
    // draw image scaled to fit
    const img = new Image();
    img.onload = ()=>{
      // contain
      const r = Math.min(state.res.w/img.width, state.res.h/img.height);
      const w = Math.round(img.width*r), h = Math.round(img.height*r);
      const x = Math.floor((state.res.w - w)/2);
      const y = Math.floor((state.res.h - h)/2);
      ctx.fillStyle='#000'; ctx.fillRect(0,0,state.res.w,state.res.h);
      ctx.drawImage(img, x,y,w,h);
      drawForeground(); // ensure top after bg load
    };
    img.src = state.bg.image || `assets/presets/Preset_A.png`;
  }
}

function drawForeground(){
  // animation sampling
  let flick = 1.0;
  if(state.mode==='preview' && state.anim.flicker){
    flick = 1 - (Math.random()*state.anim.flickerAmt/200);
  }
  state.lines.forEach((line, li)=>{
    autoFit(line);
    const baseY = line.y;
    line.words.forEach((w, wi)=>{
      ctx.font = `${line.size}px ${line.font}`;
      // alignment if not manual
      if(!line.manual){
        const m = measureWord(w,line);
        if(line.align==='center') w.x = Math.round((state.res.w - m.w)/2);
        else if(line.align==='right') w.x = Math.max(0,state.res.w - m.w - 1);
        else if(line.align==='left') w.x = 0;
      }
      // pulse scale
      let scale = 1.0;
      if(state.mode==='preview' && state.anim.pulse){
        const t = performance.now()/500;
        const amt = state.anim.pulseAmt/100*0.25;
        scale = 1 + Math.sin(t)*amt;
      }
      ctx.save();
      ctx.translate(w.x, baseY);
      ctx.scale(scale, scale);
      ctx.fillStyle = w.color;
      ctx.globalAlpha = flick;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();

      // selection box
      if(state.selection && state.selection.line===li && state.selection.word===wi && state.mode==='edit'){
        const m = measureWord(w,line);
        ctx.strokeStyle = '#ff35d9';
        ctx.lineWidth = 1;
        ctx.strokeRect(w.x-2, baseY-m.h, m.w+4, m.h+2);
      }
    });
  });
}

function render(){
  ctx.clearRect(0,0,canvas.width, canvas.height);
  drawBackground();
  // foreground in drawBackground on load, but also draw now for solid
  if(state.bg.type==='solid'){ drawForeground(); }
}

// Init
function init(){
  buildSwatches();
  updateCanvasScale();
  render();
  // open panels collapsed by default
  document.querySelectorAll('.panel').forEach(p=>p.style.display='none');
  // enable inspector if selection exists
  inspector.classList.remove('disabled');
  render();
}
init();
