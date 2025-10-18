
// v1.7 STABLE with expanded animation panel
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

const fontFamily = document.getElementById('fontFamily');
const fontSize = document.getElementById('fontSize');
const autoSize = document.getElementById('autoSize');
const lineGap = document.getElementById('lineGap');
const wordSpacing = document.getElementById('wordSpacing');
const preventCutoff = document.getElementById('preventCutoff');
const alignBtns = document.querySelectorAll('.alignBtns button[data-align]');
const btnReset = document.getElementById('btnReset');
const swatches = document.getElementById('swatches');
const colorPicker = document.getElementById('colorPicker');
const addSwatch = document.getElementById('addSwatch');
const btnAddLine = document.getElementById('btnAddLine');
const btnAddWord = document.getElementById('btnAddWord');

const animCol = document.getElementById('animCol');

const MAX_UNDO = 20;

let state = {
  res:{w:96,h:128},
  zoom:3,
  words:[],
  lines:[[]],
  selected:-1,
  bg:{type:'image', img:null, color:'#000'},
  mode:'edit',
  undo:[],
  redo:[]
};

const ANIM_DEFAULTS = {
  pulse:  {enabled:false, amt:60},
  flicker:{enabled:false, amt:40},
  wave:   {enabled:false, amp:6,  spd:50},
  scroll: {enabled:false, dir:'left', spd:30},
  bounce: {enabled:false, hgt:8},
  fade:   {enabled:false, spd:40},
  type:   {enabled:false, spd:50},
  glitch: {enabled:false, int:4},
  bubble: {enabled:false, hgt:6}
};

function ensureAnimDefaults(w){
  if(!w.anim){ w.anim = JSON.parse(JSON.stringify(ANIM_DEFAULTS)); return; }
  for(const k in ANIM_DEFAULTS){
    if(!(k in w.anim)) w.anim[k] = {...ANIM_DEFAULTS[k]};
    else{
      for(const p in ANIM_DEFAULTS[k]) if(!(p in w.anim[k])) w.anim[k][p] = ANIM_DEFAULTS[k][p];
    }
  }
}

function setRes(str){
  const [w,h]=str.split('x').map(n=>parseInt(n,10));
  state.res={w,h};
  layout(); render();
}
function layout(){
  const s = Math.max(2, Math.min(6, state.zoom));
  const cw = state.res.w*s, ch = state.res.h*s;
  [bgCanvas, drawCanvas].forEach(c=>{ c.width=cw; c.height=ch; });
  wrap.style.width = (cw+20)+'px';
  wrap.style.height= (ch+20)+'px';
  renderBackground();
}
function renderBackground(){
  bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  if(state.bg.type==='image' && state.bg.img){
    const iw = state.bg.img.width, ih = state.bg.img.height;
    const s = Math.min(bgCanvas.width/iw, bgCanvas.height/ih);
    const dw = Math.round(iw*s), dh = Math.round(ih*s);
    const dx = Math.floor((bgCanvas.width-dw)/2), dy = Math.floor((bgCanvas.height-dh)/2);
    bgCtx.drawImage(state.bg.img, dx,dy,dw,dh);
  } else {
    bgCtx.fillStyle = state.bg.color || '#000';
    bgCtx.fillRect(0,0,bgCanvas.width,bgCanvas.height);
  }
}

function pushUndo(){
  const snap = JSON.stringify(state, (k,v)=> (k==='undo'||k==='redo'||(k==='img'&&v))? undefined : v);
  state.undo.push(snap);
  if(state.undo.length>MAX_UNDO) state.undo.shift();
  state.redo.length=0;
}
function applySnap(s){
  const prevImg = state.bg.img;
  state = JSON.parse(s);
  state.bg.img = prevImg;
  layout(); render();
}

function selectWord(i){ state.selected=i; updateInspector(); render(); }
function deselect(){ state.selected=-1; updateInspector(); render(); }
function getSel(){ return state.selected>=0 ? state.words[state.selected] : null; }

function updateInspector(){
  const dis = (state.selected<0);
  inspector.classList.toggle('disabled', dis);
  deletePill.style.display = dis? 'none':'block';
  if(dis) return;
  const w = getSel(); ensureAnimDefaults(w);
  animCol.querySelectorAll('.animItem').forEach(block=>{
    const name = block.dataset.anim;
    const cfg = w.anim[name];
    const chk = block.querySelector('.animChk');
    chk.checked = cfg.enabled;
    block.classList.toggle('active', cfg.enabled);
    block.querySelectorAll('.animSlider').forEach(sl=>{
      const key = sl.dataset.key; sl.value = cfg[key];
    });
    const sel = block.querySelector('.animSelect'); if(sel) sel.value = cfg.dir || sel.value;
  });
}

function measureWord(w){
  ctx.save();
  ctx.font = `${w.size}px ${w.font}`;
  const m = ctx.measureText(w.text || '');
  ctx.restore();
  return {w: Math.ceil(m.width), h: w.size};
}

function addWord(text, lineIndex, x){
  pushUndo();
  const w = {
    text: (text!==undefined && text!==null)? String(text):'',
    color: '#ffffff',
    font: fontFamily.value,
    size: parseInt(fontSize.value,10),
    x: x!=null? x : drawCanvas.width/2,
    y: 0,
    line: lineIndex,
    align: 'center',
    manual: false,
    anim: JSON.parse(JSON.stringify(ANIM_DEFAULTS))
  };
  const idx = state.words.push(w)-1;
  if(!state.lines[lineIndex]) state.lines[lineIndex]=[];
  state.lines[lineIndex].push(idx);
  autoPlaceLines();
  selectWord(idx);
}

function addLine(){
  pushUndo();
  state.lines.push([]);
  autoPlaceLines(); render();
}

function currentLineSize(lineIndex){
  const idxs = state.lines[lineIndex]||[];
  const sizes = idxs.map(i=>state.words[i].size);
  return sizes.length? sizes[0] : parseInt(fontSize.value,10);
}

function totalLineWidth(lineIndex){
  const ws = parseInt(wordSpacing.value,10)||0;
  const idxs = state.lines[lineIndex]||[];
  let sum = 0;
  idxs.forEach((i,k)=>{
    sum += measureWord(state.words[i]).w;
    if(k<idxs.length-1) sum += ws;
  });
  return sum;
}

function shrinkToFit(lineIndex){
  if(!autoSize.checked) return;
  const margin = 4;
  const maxW = drawCanvas.width - margin*2;
  let size = currentLineSize(lineIndex);
  while(totalLineWidth(lineIndex) > maxW && size>6){
    size -= 1;
    state.lines[lineIndex].forEach(i=> state.words[i].size = size);
  }
}

function autoPlaceLines(){
  const lg = parseInt(lineGap.value,10)||0;
  const sizes = state.lines.map((_,i)=> currentLineSize(i));
  const lineH = sizes.map(s=>s);
  const totalH = lineH.reduce((a,b)=>a+b,0) + lg*(Math.max(0,state.lines.length-1));
  let y = (drawCanvas.height - totalH)/2;
  state.lines.forEach((line, i)=>{
    y += lineH[i]/2;
    line.forEach(idx=> state.words[idx].y = Math.round(y));
    y += lineH[i]/2 + lg;
  });
  state.lines.forEach((_,i)=> { shrinkToFit(i); layoutLineX(i); });
}

function layoutLineX(lineIndex){
  const ws = parseInt(wordSpacing.value,10)||0;
  const idxs = state.lines[lineIndex]||[];
  const margin=2;
  let widths = idxs.map(i=>measureWord(state.words[i]).w);
  let total = widths.reduce((a,b)=>a+b,0) + ws*(Math.max(0,idxs.length-1));
  let x = (drawCanvas.width-total)/2;
  idxs.forEach((i,k)=>{
    const w = state.words[i];
    if(!w.manual){
      let cx = x + widths[k]/2;
      if(w.align==='left')  cx = Math.max(margin + widths[k]/2, cx);
      if(w.align==='right') cx = Math.min(drawCanvas.width - margin - widths[k]/2, cx);
      w.x = Math.round(cx);
    }
    x += widths[k] + ws;
  });
}

function render(){
  ctx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
  const preview = (state.mode==='preview');
  const blink = ((Date.now()/500)|0) % 2 === 0;

  state.lines.forEach(line=>{
    line.forEach(idx=>{
      const w = state.words[idx];
      ensureAnimDefaults(w);
      // compute animation transforms/alpha per word
      let alpha=1, scale=1, dx=0, dy=0;
      const now = performance.now();
      if(preview){
        // Flicker
        if(w.anim.flicker.enabled && w.anim.flicker.amt>0){
          const f = w.anim.flicker.amt/100;
          alpha = Math.max(0.2, 1 - (Math.random()*0.8*f));
        }
        // Pulse
        if(w.anim.pulse.enabled && w.anim.pulse.amt>0){
          const p = w.anim.pulse.amt/100;
          scale *= 1 + Math.sin(now/300)*0.15*p;
        }
        // Bounce
        if(w.anim.bounce.enabled && w.anim.bounce.hgt>0){
          dy += Math.sin(now/350 + idx)*w.anim.bounce.hgt;
        }
        // Bubble (gentle float)
        if(w.anim.bubble.enabled && w.anim.bubble.hgt>0){
          dy += Math.sin(now/600 + idx*0.7)*w.anim.bubble.hgt*0.6;
        }
        // Glitch
        if(w.anim.glitch.enabled && w.anim.glitch.int>0){
          dx += (Math.random()-0.5)*w.anim.glitch.int;
        }
        // Fade
        if(w.anim.fade.enabled && w.anim.fade.spd>0){
          const t = (Math.sin(now/(200 + (100-w.anim.fade.spd)))+1)/2;
          alpha *= 0.3 + 0.7*t;
        }
        // Wave (per character offset)
        // handled in draw call
        // Scroll
        if(w.anim.scroll.enabled && w.anim.scroll.spd>0){
          const s = w.anim.scroll.spd/3;
          const dir = w.anim.scroll.dir;
          if(dir==='left')  dx += -((now/10)% (drawCanvas.width + 50)) + drawCanvas.width/2;
          if(dir==='right') dx +=  ((now/10)% (drawCanvas.width + 50)) - drawCanvas.width/2;
          if(dir==='up')    dy += -((now/10)% (drawCanvas.height + 30)) + drawCanvas.height/2;
          if(dir==='down')  dy +=  ((now/10)% (drawCanvas.height + 30)) - drawCanvas.height/2;
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w.x + dx, w.y + dy);
      ctx.scale(scale, scale);
      ctx.font = `${w.size}px ${w.font}`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle = w.color;

      if(preview && w.anim.type.enabled){
        // typewriter: reveal chars progressively
        const speed = Math.max(1,w.anim.type.spd);
        const t = Math.floor((now/ (50 + (100-speed))) % (w.text.length+1));
        const sub = (w.text || '').substring(0, t);
        drawTextWithWave(w, sub, now);
      } else {
        drawTextWithWave(w, w.text||'', now);
      }

      ctx.restore();

      if(state.selected===idx && !preview){
        const m = measureWord(w);
        const x = w.x - m.w/2, y = w.y - m.h/2;
        ctx.save();
        ctx.strokeStyle = '#ff4dff'; ctx.lineWidth=2;
        ctx.strokeRect(x-6,y-4,m.w+12,m.h+8);
        if(blink){
          ctx.fillStyle='#ffffff';
          ctx.fillRect(w.x + m.w/2 + 2, y, 2, m.h);
        }
        ctx.restore();
        deletePill.style.display='block';
        deletePill.style.left = (wrap.offsetLeft + 10 + x + m.w + 8)+'px';
        deletePill.style.top  = (wrap.offsetTop + 10 + y - 22)+'px';
      }
    });
  });
}

function drawTextWithWave(w, text, now){
  if(!text) return;
  if(!(getSel() && getSel().anim.wave.enabled)){ // if wave is disabled, simple draw
    ctx.fillText(text, 0, 0);
    return;
  }
  const amp = getSel().anim.wave.amp;
  const spd = getSel().anim.wave.spd;
  // draw per character with vertical sine offset
  let x = 0;
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    const m = ctx.measureText(ch).width;
    const oy = Math.sin((now/ (50 + (100-spd))) + i*0.6)*amp;
    ctx.fillText(ch, x, oy);
    x += m;
  }
}

let raf=0;
function setMode(m){
  state.mode=m;
  if(m==='preview'){ loop(); } else { cancelAnimationFrame(raf); raf=0; render(); }
}
function loop(){ render(); raf=requestAnimationFrame(loop); }

// Events
zoomIn.addEventListener('click',()=>{ state.zoom=Math.min(8,state.zoom+1); zoomPct.textContent=(state.zoom*100/3|0)+'%'; layout(); });
zoomOut.addEventListener('click',()=>{ state.zoom=Math.max(1,state.zoom-1); zoomPct.textContent=(state.zoom*100/3|0)+'%'; layout(); });
resSel.addEventListener('change', e=> setRes(e.target.value));
btnPreview.addEventListener('click', ()=> setMode('preview'));
btnEdit.addEventListener('click', ()=> setMode('edit'));
btnUndo.addEventListener('click', ()=>{ if(!state.undo.length) return; const s=state.undo.pop(); state.redo.push(JSON.stringify(state)); applySnap(s); });
btnRedo.addEventListener('click', ()=>{ if(!state.redo.length) return; const s=state.redo.pop(); state.undo.push(JSON.stringify(state)); applySnap(s); });
btnClear.addEventListener('click', ()=>{ pushUndo(); state.words=[]; state.lines=[[]]; deselect(); render(); });

document.querySelectorAll('.thumb').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active')); t.classList.add('active');
    const type = t.dataset.type;
    if(type==='preset'){
      const img = new Image();
      img.onload = ()=>{ state.bg={type:'image',img}; renderBackground(); render(); };
      img.src = 'assets/'+t.dataset.name+'.png';
    }else if(type==='solid'){
      state.bg={type:'solid', color:'#000'}; renderBackground(); render();
    }
    if(state.mode==='preview') deselect();
  });
});
document.getElementById('bgUpload').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = ()=>{ state.bg={type:'image',img}; renderBackground(); render(); };
  img.src = url;
  if(state.mode==='preview') deselect();
});

let dragging=false, dragOff={x:0,y:0};
drawCanvas.addEventListener('pointerdown', e=>{
  const p = canvasPoint(e);
  const hit = hitTest(p.x,p.y);
  if(hit>=0){
    if(state.mode==='preview') setMode('edit');
    selectWord(hit);
    if(e.detail===2){
      const w = state.words[hit];
      w.align='manual'; w.manual=true;
      dragging=true; dragOff.x=p.x-w.x; dragOff.y=p.y-w.y;
    }
  }else{
    if(state.mode==='edit'){
      addWord('', state.lines.length-1, p.x);
    }else{
      deselect();
    }
  }
});
window.addEventListener('pointerup', ()=> dragging=false);
drawCanvas.addEventListener('pointermove', e=>{
  if(!dragging || state.selected<0) return;
  const p = canvasPoint(e);
  const w = state.words[state.selected];
  w.x = Math.max(0, Math.min(drawCanvas.width, p.x));
  w.y = Math.max(0, Math.min(drawCanvas.height, p.y));
  render();
});

function canvasPoint(e){
  const r = drawCanvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function hitTest(x,y){
  for(let i=state.words.length-1;i>=0;i--){
    const w = state.words[i];
    const m = measureWord(w);
    const rx = w.x - m.w/2 - 6, ry = w.y - m.h/2 - 4, rw = m.w + 12, rh = m.h + 8;
    if(x>=rx && x<=rx+rw && y>=ry && y<=ry+rh) return i;
  }
  return -1;
}

// typing
window.addEventListener('keydown', e=>{
  if(state.selected<0) return;
  const w = state.words[state.selected];
  if(e.key==='Backspace'){
    e.preventDefault(); pushUndo(); w.text = (w.text||'').slice(0,-1); autoPlaceLines(); render(); return;
  }
  if(e.key===' '){
    e.preventDefault(); pushUndo(); addWord('', w.line); return;
  }
  if(e.key.length===1 && !e.metaKey && !e.ctrlKey){
    pushUndo(); w.text += e.key; autoPlaceLines(); render();
  }
});

// Inspector bindings
fontFamily.addEventListener('change', ()=>{ if(state.selected<0) return; pushUndo(); getSel().font=fontFamily.value; render(); });
fontSize.addEventListener('change', ()=>{ if(state.selected<0) return; pushUndo(); getSel().size=parseInt(fontSize.value,10); autoPlaceLines(); render(); });
autoSize.addEventListener('change', ()=>{ autoPlaceLines(); render(); });
lineGap.addEventListener('change', ()=>{ autoPlaceLines(); render(); });
wordSpacing.addEventListener('change', ()=>{ autoPlaceLines(); render(); });

alignBtns.forEach(b=> b.addEventListener('click', ()=>{
  if(state.selected<0) return;
  alignBtns.forEach(x=>x.classList.remove('active')); b.classList.add('active');
  pushUndo();
  const w = getSel();
  w.align=b.dataset.align; w.manual = (w.align==='manual');
  autoPlaceLines(); render();
}));
btnReset.addEventListener('click', ()=>{ if(state.selected<0) return; pushUndo(); const w=getSel(); w.manual=false; w.align='center'; autoPlaceLines(); render(); });

swatches.addEventListener('click', e=>{
  const b = e.target.closest('.sw'); if(!b || state.selected<0) return;
  pushUndo(); getSel().color = b.dataset.color; render();
});
swatches.addEventListener('contextmenu', e=>{
  const b = e.target.closest('.sw.custom'); if(!b) return; e.preventDefault(); b.remove();
});
addSwatch.addEventListener('click', ()=>{
  const col = colorPicker.value;
  const btn = document.createElement('button');
  btn.className='sw custom'; btn.dataset.color=col; btn.style.setProperty('--c', col);
  swatches.appendChild(btn);
});

btnAddLine.addEventListener('click', ()=> addLine());
btnAddWord.addEventListener('click', ()=> addWord('', state.lines.length-1));

deletePill.addEventListener('click', ()=>{
  if(state.selected<0) return;
  pushUndo();
  const idx = state.selected;
  const line = state.words[idx].line;
  state.lines[line] = state.lines[line].filter(i=>i!==idx);
  state.words.splice(idx,1);
  state.lines = state.lines.map(arr=> arr.map(i=> i>idx? i-1:i));
  deselect(); render();
});

// Animation UI wiring (single column)
animCol.addEventListener('click', e=>{
  const head = e.target.closest('.animHead');
  if(head){
    const item = head.parentElement;
    const chk = head.querySelector('.animChk');
    if(e.target.classList.contains('gear')){
      // toggle settings visibility without changing enable
      item.classList.toggle('active');
      return;
    }
    if(chk && state.selected>=0){
      pushUndo();
      const w = getSel(); ensureAnimDefaults(w);
      const name = item.dataset.anim;
      w.anim[name].enabled = chk.checked = !chk.checked ? false : !chk.checked; // toggle
      // Correct the toggle: set based on current checked state after event default
    }
  }
  const btn = e.target.closest('button');
  if(btn && state.selected>=0){
    const item = e.target.closest('.animItem');
    const name = item.dataset.anim;
    const w = getSel(); ensureAnimDefaults(w);
    if(btn.classList.contains('reset')){
      pushUndo();
      w.anim[name] = {...ANIM_DEFAULTS[name]};
      updateInspector(); render();
    }
    if(btn.classList.contains('close')){
      item.classList.remove('active'); // collapse settings
    }
  }
});

// Because checkbox default click is prevented by our handler above, wire change events explicitly:
animCol.querySelectorAll('.animItem').forEach(item=>{
  const chk = item.querySelector('.animChk');
  chk.addEventListener('change', ()=>{
    if(state.selected<0) return;
    pushUndo();
    const w=getSel(); ensureAnimDefaults(w);
    w.anim[item.dataset.anim].enabled = chk.checked;
    item.classList.toggle('active', chk.checked); // show settings when enabled
    render();
  });
  item.querySelectorAll('.animSlider').forEach(sl=>{
    sl.addEventListener('input', ()=>{
      if(state.selected<0) return;
      const w=getSel(); ensureAnimDefaults(w);
      const key = sl.dataset.key;
      w.anim[item.dataset.anim][key] = parseInt(sl.value,10);
      render();
    });
  });
  const sel = item.querySelector('.animSelect');
  if(sel){
    sel.addEventListener('change', ()=>{
      if(state.selected<0) return;
      const w=getSel(); ensureAnimDefaults(w);
      w.anim[item.dataset.anim].dir = sel.value;
      render();
    });
  }
});

// Init
function init(){
  const img = new Image();
  img.onload = ()=>{ state.bg={type:'image',img}; layout(); render(); };
  img.src = 'assets/Preset_A.png';
  resSel.value='96x128'; setRes('96x128');
  zoomPct.textContent=(state.zoom*100/3|0)+'%';
  updateInspector();
}
init();
