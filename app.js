
// LED Backpack Animator — minimal but stable build
// State
const state = {
  mode: 'edit', // 'edit' or 'preview'
  zoom: 1,
  res: {w:96, h:128},
  background: {type:'solid', color:'#000000', image:null, name:'solid'},
  lines: [
    {words: [{text:'Hello', color:'#FFFFFF', font:'monospace', size:22, anim:{}, align:'center', manual:false, x:0,y:0}], align:'center'}
  ],
  selection: {line:0, word:0},
  undo: [],
  redo: [],
  preventCutoff: true,
  spacing: {lineGap:2, word:8},
  dragPromptDismissed: false
};

// Canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// UI refs
const btnPreview = document.getElementById('btnPreview');
const btnEdit = document.getElementById('btnEdit');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnClear = document.getElementById('btnClear');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const zoomLabel = document.getElementById('zoomLabel');
const btnToggleInspector = document.getElementById('btnToggleInspector');
const inspector = document.getElementById('inspector');
const deleteBtn = document.getElementById('btnDeleteWord');

// Inspector controls
const tabs = document.querySelectorAll('.inspector .tab');
const panels = {
  font: document.getElementById('panel-font'),
  color: document.getElementById('panel-color'),
  spacing: document.getElementById('panel-spacing'),
  align: document.getElementById('panel-align'),
  anim: document.getElementById('panel-anim'),
};
const fontFamily = document.getElementById('fontFamily');
const fontSize = document.getElementById('fontSize');
const autoSize = document.getElementById('autoSize');
const lineGap = document.getElementById('lineGap');
const wordSpacing = document.getElementById('wordSpacing');
const preventCutoff = document.getElementById('preventCutoff');
const alignButtons = document.querySelectorAll('.alignBtn');
const btnResetAlign = document.getElementById('btnResetAlign');
const swatches = document.getElementById('swatches');
const customColorInput = document.getElementById('customColor');
const btnAddSwatch = document.getElementById('btnAddSwatch');
const btnDelSwatch = document.getElementById('btnDelSwatch');
const animChecks = document.querySelectorAll('.animCheck');
const animCfgs = document.querySelectorAll('.animCfg');
const animSliders = document.querySelectorAll('.animSlider');
const btnAddLine = document.getElementById('btnAddLine');

// Background UI
const resolutionSel = document.getElementById('resolution');
const bgThumbsWrap = document.getElementById('bgThumbs');
const solidPicker = document.getElementById('solidPicker');
const bgUploadInput = document.getElementById('bgUpload');
const btnUploadConfig = document.getElementById('btnUploadConfig');
const uploadConfig = document.getElementById('uploadConfig');
const btnDownloadConfig = document.getElementById('btnDownloadConfig');

// Modal
const dragModal = document.getElementById('dragModal');
const dragCancel = document.getElementById('dragCancel');
const dragEnable = document.getElementById('dragEnable');
const noDragPrompt = document.getElementById('noDragPrompt');

// Utils
const clone = v => JSON.parse(JSON.stringify(v));
const pushHistory = () => { state.undo.push(clone(state)); state.redo.length=0; };

// Layout
function setCanvasSizeFromRes(){
  const {w,h} = state.res;
  canvas.width = w*4;
  canvas.height = h*4;
  draw();
}
function setResolution(val){
  if(val==='96x128'){ state.res={w:96,h:128}; }
  else { state.res={w:64,h:64}; }
  setCanvasSizeFromRes();
  filterPresetThumbs();
  layoutAll();
}
// Filter presets by res
function filterPresetThumbs(){
  const resVal = `${state.res.w}x${state.res.h}`;
  [...bgThumbsWrap.querySelectorAll('.thumb[data-type="preset"]')].forEach(t => {
    const showFor = t.getAttribute('data-for');
    t.style.display = (showFor===resVal) ? 'flex' : 'none';
  });
}
resolutionSel.addEventListener('change', e=>setResolution(e.target.value));

// Background selection
bgThumbsWrap.addEventListener('click', (e)=>{
  const t = e.target.closest('.thumb');
  if(!t) return;
  [...bgThumbsWrap.querySelectorAll('.thumb')].forEach(n=>n.classList.remove('active'));
  t.classList.add('active');
  const type = t.getAttribute('data-type');
  if(type==='preset'){
    const name = t.getAttribute('data-name');
    state.background = {type:'preset', name, image:`assets/presets/${name}.png`};
    solidPicker.style.display='none';
  } else if(type==='solid'){
    state.background = {type:'solid', color:solidPicker.value};
    solidPicker.style.display='inline-block';
  } else if(type==='upload'){
    bgUploadInput.click();
  }
  draw();
});
bgUploadInput.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  state.background = {type:'upload', image:url};
  draw();
});
solidPicker.addEventListener('input', e=>{
  if(state.background.type==='solid'){
    state.background.color = e.target.value;
    draw();
  }
});

// Inspector tabs toggle (collapse by default)
tabs.forEach(tab=>{
  tab.addEventListener('click', ()=>{
    const key = tab.dataset.tab;
    Object.values(panels).forEach(p=>p.classList.remove('active'));
    if(key) panels[key].classList.add('active');
  });
});
btnToggleInspector.addEventListener('click', ()=>{
  inspector.classList.toggle('hidden');
});

// Apply inspector changes
function selectedWord(){
  if(state.selection==null) return null;
  const line = state.lines[state.selection.line];
  if(!line) return null;
  return line.words[state.selection.word] || null;
}

function applyWordChange(){
  const w = selectedWord(); if(!w) return;
  w.font = fontFamily.value;
  w.size = parseInt(fontSize.value,10);
  state.spacing.lineGap = parseInt(lineGap.value,10);
  state.spacing.word = parseInt(wordSpacing.value,10);
  state.preventCutoff = preventCutoff.checked;
  layoutAll();
  draw();
}

fontFamily.addEventListener('change', applyWordChange);
fontSize.addEventListener('change', applyWordChange);
lineGap.addEventListener('change', applyWordChange);
wordSpacing.addEventListener('change', applyWordChange);
preventCutoff.addEventListener('change', applyWordChange);
autoSize.addEventListener('change', ()=>{ layoutAll(); draw(); });

// Color swatches
swatches.addEventListener('click', (e)=>{
  const b = e.target.closest('.sw'); if(!b) return;
  const w = selectedWord(); if(!w) return;
  w.color = b.dataset.color;
  draw();
});
btnAddSwatch.addEventListener('click', ()=>{
  const c = customColorInput.value;
  const el = document.createElement('button');
  el.className='sw'; el.dataset.color=c; el.style.setProperty('--c', c);
  swatches.appendChild(el);
});
btnDelSwatch.addEventListener('click', ()=>{
  const els = swatches.querySelectorAll('.sw');
  if(els.length>0) els[els.length-1].remove();
});

// Alignment
alignButtons.forEach(btn=>btn.addEventListener('click', ()=>{
  const mode = btn.dataset.align;
  const ln = state.lines[state.selection?.line ?? 0];
  if(!ln) return;
  if(mode==='manual'){
    if(!state.dragPromptDismissed){
      dragModal.classList.remove('hidden');
      return;
    }
    ln.align='manual';
  } else {
    ln.align = mode;
  }
  layoutAll();
  draw();
}));
btnResetAlign.addEventListener('click', ()=>{
  const ln = state.lines[state.selection?.line ?? 0];
  if(!ln) return;
  ln.align='center';
  layoutAll(); draw();
});
dragCancel.addEventListener('click', ()=> dragModal.classList.add('hidden'));
dragEnable.addEventListener('click', ()=>{
  state.lines[state.selection?.line ?? 0].align='manual';
  if(noDragPrompt.checked) state.dragPromptDismissed = true;
  dragModal.classList.add('hidden');
  layoutAll(); draw();
});

// Animations toggle (per-word)
function syncAnimUIFromWord(){
  const w = selectedWord(); if(!w) return;
  animChecks.forEach(ch=>{
    ch.checked = !!w.anim[ch.dataset.anim];
    document.querySelector(`.animCfg[data-for="${ch.dataset.anim}"]`).style.display = ch.checked ? 'block':'none';
  });
}
animChecks.forEach(ch=>ch.addEventListener('change', ()=>{
  const w = selectedWord(); if(!w) return;
  if(ch.checked){ w.anim[ch.dataset.anim] = {amount: parseFloat(document.querySelector(`.animCfg [data-anim="${ch.dataset.anim}"]`).value)}; }
  else { delete w.anim[ch.dataset.anim]; }
  syncAnimUIFromWord();
  draw();
}));
animSliders.forEach(sl=>sl.addEventListener('input', ()=>{
  const w = selectedWord(); if(!w) return;
  const a = w.anim[sl.dataset.anim]; if(!a) return;
  a.amount = parseFloat(sl.value);
  draw();
}));
document.querySelectorAll('.resetAnim').forEach(btn=>btn.addEventListener('click', ()=>{
  const w = selectedWord(); if(!w) return;
  const anim = btn.dataset.anim;
  const defaultVal = (anim==='bounce')?3: (anim==='flicker'?0.3:0.4);
  const slider = document.querySelector(`.animSlider[data-anim="${anim}"]`);
  slider.value = defaultVal;
  if(!w.anim[anim]) w.anim[anim] = {};
  w.anim[anim].amount = defaultVal;
  draw();
}));

// Undo/Redo/Clear
btnUndo.addEventListener('click', ()=>{ if(!state.undo.length) return; state.redo.push(clone(state)); Object.assign(state, state.undo.pop()); setCanvasSizeFromRes(); layoutAll(); draw(); });
btnRedo.addEventListener('click', ()=>{ if(!state.redo.length) return; state.undo.push(clone(state)); Object.assign(state, state.redo.pop()); setCanvasSizeFromRes(); layoutAll(); draw(); });
btnClear.addEventListener('click', ()=>{
  pushHistory();
  state.lines = [{words:[], align:'center'}];
  state.selection = null;
  layoutAll(); draw();
});

// Zoom
btnZoomIn.addEventListener('click', ()=>{ state.zoom = Math.min(3, state.zoom+0.1); zoomLabel.textContent = Math.round(state.zoom*100)+'%'; draw(); });
btnZoomOut.addEventListener('click', ()=>{ state.zoom = Math.max(0.25, state.zoom-0.1); zoomLabel.textContent = Math.round(state.zoom*100)+'%'; draw(); });

// Modes
btnPreview.addEventListener('click', ()=>{ state.mode='preview'; draw(); });
btnEdit.addEventListener('click', ()=>{ state.mode='edit'; draw(); });

// Config download/upload
btnDownloadConfig.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'led_animator_config.json';
  a.click();
});
btnUploadConfig.addEventListener('click', ()=> uploadConfig.click());
uploadConfig.addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try {
      const s = JSON.parse(r.result);
      Object.assign(state, s);
      setCanvasSizeFromRes();
      layoutAll(); draw();
    } catch(err){ alert('Invalid config'); }
  };
  r.readAsText(f);
});

// Interaction
let drag = null;
canvas.addEventListener('mousedown', (e)=>{
  const pos = canvasPos(e);
  // select word if hit
  const hit = hitTest(pos.x, pos.y);
  if(hit){
    state.selection = hit;
    syncInspectorFromSelection();
    draw();
    // drag when manual & in edit
    const ln = state.lines[hit.line];
    if(state.mode==='edit' && ln.align==='manual'){
      drag = {offset: pos, start: {x:selectedWord().x, y:selectedWord().y}};
    }
  } else {
    // click background -> deselect
    state.selection = null;
    draw();
  }
});
window.addEventListener('mouseup', ()=> drag = null);
window.addEventListener('mousemove', (e)=>{
  if(!drag) return;
  const pos = canvasPos(e);
  const dx = (pos.x - drag.offset.x);
  const dy = (pos.y - drag.offset.y);
  const w = selectedWord(); if(!w) return;
  w.x = drag.start.x + dx;
  w.y = drag.start.y + dy;
  draw();
});

// Double click to create a new word at click
canvas.addEventListener('dblclick', (e)=>{
  const p = canvasPos(e);
  ensureAtLeastOneLine();
  const ln = state.lines[state.lines.length-1];
  const w = {text:'', color:'#FFFFFF', font: fontFamily.value, size:parseInt(fontSize.value,10), anim:{}, align: ln.align || 'center', manual:false, x:p.x, y:p.y};
  ln.words.push(w);
  state.selection = {line: state.lines.length-1, word: ln.words.length-1};
  layoutAll(); draw();
  startEditing();
});

// Keyboard typing -> edit selected word; space = new word; Enter = new line
window.addEventListener('keydown', (e)=>{
  if(state.mode!=='edit') return;
  // typing requires selection
  if(!state.selection){
    // hitting any character should create first word
    if(e.key.length===1 || e.key==='Enter' || e.key===' '){
      ensureAtLeastOneLine();
      const ln = state.lines[state.lines.length-1];
      const w = {text:'', color:'#FFFFFF', font: fontFamily.value, size:parseInt(fontSize.value,10), anim:{}, align: ln.align || 'center', manual:false, x:0, y:0};
      ln.words.push(w);
      state.selection = {line: state.lines.length-1, word: ln.words.length-1};
    } else { return; }
  }
  const ln = state.lines[state.selection.line];
  const w = ln.words[state.selection.word];
  if(!w) return;
  if(e.key==='Backspace'){ w.text = w.text.slice(0,-1); e.preventDefault(); }
  else if(e.key==='Enter'){ // new line
    state.lines.push({words:[], align: ln.align});
    state.selection = {line: state.lines.length-1, word:0};
    e.preventDefault();
  }
  else if(e.key===' '){ // new word on same line
    ln.words.splice(state.selection.word+1, 0, {text:'', color:w.color, font:w.font, size:w.size, anim:clone(w.anim), align:ln.align, manual:false, x:0, y:0});
    state.selection.word++;
    e.preventDefault();
  }
  else if(e.key.length===1){
    w.text += e.key;
  }
  layoutAll(); draw();
});

function ensureAtLeastOneLine(){
  if(state.lines.length===0) state.lines=[{words:[],align:'center'}];
}

// Selection & Inspector sync
function syncInspectorFromSelection(){
  inspector.classList.toggle('hidden', !state.selection);
  if(!state.selection) return;
  const w = selectedWord();
  fontFamily.value = w.font; fontSize.value = w.size;
  lineGap.value = state.spacing.lineGap; wordSpacing.value = state.spacing.word; preventCutoff.checked = state.preventCutoff;
  syncAnimUIFromWord();
  // open nothing by default
  Object.values(panels).forEach(p=>p.classList.remove('active'));
}

function layoutAll(){
  const PADDING_X = 6, PADDING_Y = 6;
  const safeW = state.res.w - PADDING_X*2;
  const safeH = state.res.h - PADDING_Y*2;
  const lineBoxes = [];
  let totalH = 0;

  // 1) compute measures + autosize per line (shrink until fits safeW)
  state.lines.forEach((ln, li)=>{
    if(!ln.words || !ln.words.length){
      lineBoxes.push({w:0, h:0, ms:[]}); return;
    }
    // optional: autosize per line if flagged in state or via checkbox
    let guard=0;
    while(guard++<64){
      const ms = ln.words.map(w=> measureText(w));
      const spacing = state.spacing && state.spacing.word != null ? state.spacing.word : 8;
      const lineW = ms.reduce((a,m)=>a+m.w,0) + Math.max(0, ln.words.length-1)*spacing;
      if(lineW <= safeW) { lineBoxes.push({w:lineW, h: Math.max(...ms.map(m=>m.h)), ms}); break; }
      // shrink all words by 1 (min 6)
      ln.words.forEach(w => w.size = Math.max(6, (w.size||22)-1));
      if(guard===64){ lineBoxes.push({w:lineW, h: Math.max(...ms.map(m=>m.h)), ms}); }
    }
    if(lineBoxes[li]==null){
      const ms = ln.words.map(w=> measureText(w));
      lineBoxes.push({w: ms.reduce((a,m)=>a+m.w,0), h: Math.max(...ms.map(m=>m.h)), ms});
    }
  });

  // total height with gaps
  state.lines.forEach((ln, li)=>{
    const box = lineBoxes[li] || {h:0};
    totalH += box.h + (li? (state.spacing?.lineGap ?? 2) : 0);
  });

  // 2) vertical centering
  let y = Math.floor((safeH - totalH)/2) + PADDING_Y;

  // 3) position each word horizontally with alignment (default center)
  state.lines.forEach((ln, li)=>{
    const box = lineBoxes[li] || {w:0,h:0,ms:[]};
    const spacing = state.spacing && state.spacing.word != null ? state.spacing.word : 8;
    const align = ln.align || 'center';
    let startX = PADDING_X;
    const leftover = safeW - box.w;
    if(align==='center') startX += Math.floor(leftover/2);
    else if(align==='right') startX += leftover;

    let x = startX;
    const lineAsc = Math.max(0, ...(box.ms.map(m=>m.asc||Math.ceil(box.h*0.8))));
    ln.words.forEach((w, i)=>{
      const m = box.ms[i] || measureText(w);
      w.x = x;
      // y is baseline; store baseline via w.y + ascent in draw()
      w.y = y + lineAsc;
      x += m.w + spacing;
    });
    y += box.h + (li < state.lines.length-1 ? (state.spacing?.lineGap ?? 2) : 0);
  });
}
);
    }
    y += lineHeight + state.spacing.lineGap;
  });
}

function measureText(w){
  ctx.save();
  ctx.font = `${w.size}px ${w.font}`;
  const m = ctx.measureText(w.text || '');
  // Convert to LED units (canvas scaled by 4x in draw())
  const w4 = Math.ceil((m.width || 0) / 4);
  const asc = Math.ceil(((m.actualBoundingBoxAscent || (w.size*0.8)))/4);
  const desc = Math.ceil(((m.actualBoundingBoxDescent || (w.size*0.2)))/4);
  const h4 = asc + desc;
  ctx.restore();
  return { w: w4, h: h4, asc, desc };
}
px ${w.font}`;
  const metrics = {w: ctx.measureText(w.text||'').width/4, h: w.size/3}; // scale to LED grid feel
  ctx.restore();
  // Prevent cutoff & autosize rudimentary handling
  if(state.preventCutoff){
    const maxW = state.res.w - 8;
    if(metrics.w>maxW) metrics.w = maxW;
  }
  return metrics;
}

function canvasPos(e){
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / (r.width) * state.res.w;
  const y = (e.clientY - r.top) / (r.height) * state.res.h;
  return {x,y};
}

function hitTest(x,y){
  for(let li=0; li<state.lines.length; li++){
    const ln = state.lines[li];
    for(let wi=0; wi<ln.words.length; wi++){
      const w = ln.words[wi];
      const m = measureText(w);
      if(x>=w.x && x<=w.x+m.w && y>=w.y-m.h && y<=w.y+m.h*0.8){
        return {line:li, word:wi};
      }
    }
  }
  return null;
}

function drawBackground(){
  const {w,h} = state.res;
  if(state.background.type==='solid'){
    ctx.fillStyle = state.background.color || '#000';
    ctx.fillRect(0,0,w,h);
  } else if(state.background.image){
    const img = new Image();
    img.onload = ()=>{
      // cover
      ctx.drawImage(img, 0,0,w,h);
    };
    img.src = state.background.image;
  } else {
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
  }
}

let t0 = performance.now();
function draw(){
  // scale canvas CSS size based on zoom
  canvas.style.width = (state.res.w*4*state.zoom)+'px';
  canvas.style.height = (state.res.h*4*state.zoom)+'px';
  // clear
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,canvas.width, canvas.height);
  // LED pixel look scaling
  ctx.save();
  ctx.scale(4,4);
  drawBackground();
  // draw words
  const time = (performance.now()-t0)/1000;
  state.lines.forEach((ln, li)=>{
    ln.words.forEach((w, wi)=>{
      // animations (preview only)
      let dy=0, amp=0;
      if(state.mode==='preview'){
        if(w.anim.pulse){ amp = 0.3*w.anim.pulse.amount; }
        if(w.anim.bounce){ dy = Math.sin(time*4)*w.anim.bounce.amount; }
        if(w.anim.flicker && Math.random()<w.anim.flicker.amount*0.1){ ctx.globalAlpha = 0.6; } else ctx.globalAlpha=1;
      }
      ctx.fillStyle = w.color || '#fff';
      ctx.font = `${Math.round(w.size*(1+amp))}px ${w.font}`;
      ctx.fillText(w.text, w.x, w.y+dy);
      ctx.globalAlpha=1;
    });
  });
  // selection visuals
  if(state.selection && state.mode==='edit'){
    const w = selectedWord();
    if(w){
      const m = measureText(w);
      // selection box & caret
      ctx.strokeStyle = '#ff49c1';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([1,1]);
      ctx.strokeRect(w.x-1, w.y-m.h, m.w+2, m.h+2);
      // caret
      const caretX = w.x + ctx.measureText(w.text).width/4;
      const blink = ((performance.now()/500)|0)%2===0;
      if(blink){
        ctx.fillStyle='#fff'; ctx.fillRect(caretX, w.y-m.h, 0.5, m.h);
      }
      // place Delete button
      placeDeleteButton({x:(w.x+m.w)*4*state.zoom, y:(w.y-m.h)*4*state.zoom});
    }
  } else {
    deleteBtn.classList.add('hidden');
  }
  ctx.restore();
  requestAnimationFrame(()=>{ if(state.mode==='preview') draw(); });
}

function placeDeleteButton(p){
  const rect = canvas.getBoundingClientRect();
  deleteBtn.style.left = (rect.left + p.x + 12) + 'px';
  deleteBtn.style.top = (rect.top + p.y - 12) + 'px';
  deleteBtn.classList.remove('hidden');
}
deleteBtn.addEventListener('click', ()=>{
  if(!state.selection) return;
  const ln = state.lines[state.selection.line];
  ln.words.splice(state.selection.word,1);
  if(ln.words.length===0){ state.lines.splice(state.selection.line,1); state.selection=null; }
  layoutAll(); draw();
});

// Init
function init(){
  setResolution(resolutionSel.value);
  filterPresetThumbs();
  layoutAll();
  draw();
  syncInspectorFromSelection();
}
init();
