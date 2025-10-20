
// LED Backpack Animator — minimal but stable build
// State
const state = {
  anim: { booktok: true, speed: 1.0 },
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
// ====== CONFIG THAT AFFECTS LAYOUT ======
const PADDING = { x: 6, y: 6 };        // safe margins so text won't hit edges
const MAX_UNDO = 20;

// Filter presets by res

function filterPresetThumbs(){
  const resVal = `${state.res.w}x${state.res.h}`;
  [...bgThumbsWrap.querySelectorAll('.thumb[data-type="preset"]')].forEach(t => {
    const showFor = t.getAttribute('data-for');
    t.style.display = (showFor===resVal) ? 'flex' : 'none';
  });
}
if(resolutionSel).addEventListener('change', e=>setResolution(e.target.value));

// Background selection
if(bgThumbsWrap).addEventListener('click', (e)=>{
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
if(bgUploadInput).addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  state.background = {type:'upload', image:url};
  draw();
});
if(solidPicker).addEventListener('input', e=>{
  if(state.background.type==='solid'){
    state.background.color = e.target.value;
    draw();
  }
});

// Inspector tabs toggle (collapse by default)
tabs.forEach(tab=>{
  if(tab).addEventListener('click', ()=>{
    const key = tab.dataset.tab;
    Object.values(panels).forEach(p=>p.classList.remove('active'));
    if(key) panels[key].classList.add('active');
  });
});
if(btnToggleInspector).addEventListener('click', ()=>{
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

if(fontFamily).addEventListener('change', applyWordChange);
if(fontSize).addEventListener('change', applyWordChange);
if(lineGap).addEventListener('change', applyWordChange);
if(wordSpacing).addEventListener('change', applyWordChange);
if(preventCutoff).addEventListener('change', applyWordChange);
if(autoSize).addEventListener('change', ()=>{ layoutAll(); draw(); });

// Color swatches
if(swatches).addEventListener('click', (e)=>{
  const b = e.target.closest('.sw'); if(!b) return;
  const w = selectedWord(); if(!w) return;
  w.color = b.dataset.color;
  draw();
});
if(btnAddSwatch).addEventListener('click', ()=>{
  const c = customColorInput.value;
  const el = document.createElement('button');
  el.className='sw'; el.dataset.color=c; el.style.setProperty('--c', c);
  swatches.appendChild(el);
});
if(btnDelSwatch).addEventListener('click', ()=>{
  const els = swatches.querySelectorAll('.sw');
  if(els.length>0) els[els.length-1].remove();
});

// Alignment
alignButtons.forEach(btn=if(>btn).addEventListener('click', ()=>{
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
if(btnResetAlign).addEventListener('click', ()=>{
  const ln = state.lines[state.selection?.line ?? 0];
  if(!ln) return;
  ln.align='center';
  layoutAll(); draw();
});
if(dragCancel).addEventListener('click', ()=> dragModal.classList.add('hidden'));
if(dragEnable).addEventListener('click', ()=>{
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
animChecks.forEach(ch=if(>ch).addEventListener('change', ()=>{
  const w = selectedWord(); if(!w) return;
  if(ch.checked){ w.anim[ch.dataset.anim] = {amount: parseFloat(document.querySelector(`.animCfg [data-anim="${ch.dataset.anim}"]`).value)}; }
  else { delete w.anim[ch.dataset.anim]; }
  syncAnimUIFromWord();
  draw();
}));
animSliders.forEach(sl=if(>sl).addEventListener('input', ()=>{
  const w = selectedWord(); if(!w) return;
  const a = w.anim[sl.dataset.anim]; if(!a) return;
  a.amount = parseFloat(sl.value);
  draw();
}));
document.querySelectorAll('.resetAnim').forEach(btn=if(>btn).addEventListener('click', ()=>{
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
if(btnUndo).addEventListener('click', ()=>{ if(!state.undo.length) return; state.redo.push(clone(state)); Object.assign(state, state.undo.pop()); setCanvasSizeFromRes(); layoutAll(); draw(); });
if(btnRedo).addEventListener('click', ()=>{ if(!state.redo.length) return; state.undo.push(clone(state)); Object.assign(state, state.redo.pop()); setCanvasSizeFromRes(); layoutAll(); draw(); });
if(btnClear).addEventListener('click', ()=>{
  pushHistory();
  state.lines = [{words:[], align:'center'}];
  state.selection = null;
  layoutAll(); draw();
});

// Zoom
if(btnZoomIn).addEventListener('click', ()=>{ state.zoom = Math.min(3, state.zoom+0.1); zoomLabel.textContent = Math.round(state.zoom*100)+'%'; draw(); });
if(btnZoomOut).addEventListener('click', ()=>{ state.zoom = Math.max(0.25, state.zoom-0.1); zoomLabel.textContent = Math.round(state.zoom*100)+'%'; draw(); });

// Modes
if(btnPreview).addEventListener('click', ()=>{ state.mode='preview'; draw(); });
if(btnEdit).addEventListener('click', ()=>{ state.mode='edit'; draw(); });

// Config download/upload
if(btnDownloadConfig).addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'led_animator_config.json';
  a.click();
});
if(btnUploadConfig).addEventListener('click', ()=> uploadConfig.click());
if(uploadConfig).addEventListener('change', e=>{
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
if(canvas).addEventListener('mousedown', (e)=>{
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
if(window).addEventListener('mouseup', ()=> drag = null);
if(window).addEventListener('mousemove', (e)=>{
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
if(canvas).addEventListener('dblclick', (e)=>{
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
if(window).addEventListener('keydown', (e)=>{
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

function layoutAll(){ layoutDocument(); });
    }
    y += lineHeight + state.spacing.lineGap;
  });
}

function measureText(w){
  ctx.save();
  ctx.font = `${w.size}px ${w.font}`;
  const m = ctx.measureText(w.text || '');
  const width = Math.ceil(m.width);
  const ascent = Math.ceil(m.actualBoundingBoxAscent || (w.size*0.8));
  const descent = Math.ceil(m.actualBoundingBoxDescent || (w.size*0.2));
  const height = ascent + descent;
  ctx.restore();
  return {w:width, h:height, ascent, descent};
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
if(deleteBtn).addEventListener('click', ()=>{
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


// Filter background thumbnails by selected resolution (data-for attr)
function filterThumbsByResolution(resStr){
  const thumbs = document.querySelectorAll('.bgThumbs .thumb, #bgThumbs .thumb, .thumb');
  thumbs.forEach(t=>{
    const onlyFor = t.getAttribute('data-for');
    if(!onlyFor){ t.style.display=''; return; }
    t.style.display = (onlyFor===resStr) ? '' : 'none';
  });
}


// --- Tiny GIF encoder (very small)—sufficient for LED backpack frames ---
class TinyGif {
  constructor(w,h,delay=8,repeat=0){ this.w=w; this.h=h; this.delay=delay; this.repeat=repeat; this.frames=[]; }
  addFrame(imgData){ this.frames.push(new Uint8Array(imgData.data)); }
  _toIndexed(rgba){
    const n = rgba.length/4;
    const pal = []; const map = new Map();
    const idx = new Uint8Array(n);
    function key(r,g,b){ return (r<<16)|(g<<8)|b; }
    let pi=0
    for(let i=0;i<rgba.length;i+=4){
      const r=rgba[i],g=rgba[i+1],b=rgba[i+2];
      const k=key(r,g,b);
      let id = map.get(k);
      if(id===undefined){ id = pal.length; map.set(k,id); pal.push([r,g,b]); }
      idx[i>>2]=id;
    }
    // cap palette to 256 (naive—OK for simple art)
    while(pal.length<2) pal.push([0,0,0]);
    if(pal.length>256){ pal.length=256; }
    return {pal, idx};
  }
  _lzw(data, minSize){
    const CLEAR = 1<<minSize, END = CLEAR+1;
    let codeSize = minSize+1;
    const dict = new Map();
    for(let i=0;i<CLEAR;i++) dict.set(String.fromCharCode(i), i);
    let next = END+1;
    const outCodes = [];
    outCodes.push(CLEAR);
    let w = String.fromCharCode(data[0]);
    for(let i=1;i<data.length;i++){
      const c = String.fromCharCode(data[i]);
      const wc = w + c;
      if(dict.has(wc)) w = wc;
      else {
        outCodes.push(dict.get(w));
        dict.set(wc, next++);
        if(next === (1<<codeSize) && codeSize<12) codeSize++;
        w = c;
      }
    }
    outCodes.push(dict.get(w));
    outCodes.push(END);
    // pack bits
    const bytes=[]; let cur=0, bits=0;
    function pushByte(){ bytes.push(cur & 0xFF); cur >>= 8; bits -= 8; }
    for(const code of outCodes){
      cur |= code << bits; bits += codeSize;
      while(bits >= 8) pushByte();
    }
    if(bits>0) pushByte();
    // sub blocks
    const blocks=[]; for(let i=0;i<bytes.length;i+=255) blocks.push(bytes.slice(i,i+255));
    return {minSize, blocks};
  }
  render(){
    const w=this.w,h=this.h;
    // use first frame to build palette
    const first = this.frames[0];
    const {pal, idx} = this._toIndexed(first);
    const out = [];
    function U8(a){ return new Uint8Array(a); }
    out.push(U8([71,73,70,56,57,97])); // GIF89a
    out.push(U8([w&255, w>>8, h&255, h>>8, 0xF7, 0, 0])); // gct 256
    const gct = new Uint8Array(256*3); gct.fill(0);
    for(let i=0;i<pal.length;i++){ gct[i*3]=pal[i][0]; gct[i*3+1]=pal[i][1]; gct[i*3+2]=pal[i][2]; }
    out.push(gct);
    // loop
    out.push(U8([0x21,0xFF,0x0B, 78,69,84,83,67,65,80,69,50,46,48, 3,1, this.repeat & 255, (this.repeat>>8)&255, 0]));
    // write frames
    for(const rgba of this.frames){
      const q = this._toIndexed(rgba);
      // GCE
      out.push(U8([0x21,0xF9,0x04, 0x00, this.delay & 255, this.delay>>8, 0, 0]));
      // Image descriptor
      out.push(U8([0x2C,0,0,0,0, w&255, w>>8, h&255, h>>8, 0]));
      // LZW
      const minSize = Math.max(2, Math.ceil(Math.log2(Math.max(2, q.pal.length))));
      const lzw = this._lzw(q.idx, minSize);
      out.push(U8([lzw.minSize]));
      for(const blk of lzw.blocks){ out.push(U8([blk.length])); out.push(U8(blk)); }
      out.push(U8([0]));
    }
    out.push(U8([0x3B]));
    // concat
    let total=0; for(const a of out) total+=a.length;
    const bin = new Uint8Array(total); let off=0; for(const a of out){ bin.set(a,off); off+=a.length; }
    return new Blob([bin], {type:'image/gif'});
  }
}

// Hook: render GIF button (uses on-screen canvas)
(function(){
  const btn = document.getElementById('btnRenderGif') || document.getElementById('renderGif') || document.querySelector('#gifRenderRow button');
  const fps = document.getElementById('gifFps');
  const secs = document.getElementById('gifSecs');
  const name = document.getElementById('gifName');
  const canvas = document.getElementById('canvas') || document.getElementById('previewCanvas') || document.querySelector('canvas');
  if(btn && fps && secs && name && canvas){
    if(btn).addEventListener('click', async ()=>{
      const f = Math.max(2, parseInt(fps.value||'12',10));
      const s = Math.max(1, parseInt(secs.value||'3',10));
      const frames = f*s;
      const delay = Math.max(2, Math.round(100/f));
      const enc = new TinyGif(canvas.width, canvas.height, delay, 0);
      if(typeof window.requestPreviewFrame === 'function'){
        for(let i=0;i<frames;i++){
          const t = i/f;
          await window.requestPreviewFrame(t); // let the app render state at time t
          const ctx = canvas.getContext('2d');
          enc.addFrame(ctx.getImageData(0,0,canvas.width,canvas.height));
          await new Promise(r=>setTimeout(r,0));
        }
        const blob = enc.render();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (name.value || 'animation') + '.gif';
        a.click();
      } else {
        // fallback: just capture current frame repeatedly
        const ctx = canvas.getContext('2d');
        for(let i=0;i<frames;i++){ enc.addFrame(ctx.getImageData(0,0,canvas.width,canvas.height)); }
        const blob = enc.render();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (name.value || 'animation') + '.gif';
        a.click();
      }
    });
  }
})();

// ====== DOCUMENT LAYOUT ======
// Vert + horiz centering with per-line autosize and safe padding
function layoutDocument(){
  const W = canvas.width;
  const H = canvas.height;
  const safeW = W - PADDING.x * 2;
  const safeH = H - PADDING.y * 2;

  const lineBoxes = [];
  let totalBlockH = 0;

  state.lines.forEach((ln, li)=>{
    const words = ln.words || [];
    if (!words.length){ lineBoxes.push({width:0,height:0,measures:[],words:[]}); return; }

    // optional autosize: shrink line until it fits inside safeW
    if (state.font?.autoSize || (typeof autoSize !== 'undefined' && autoSize.checked)) {
      let guard = 0;
      while (guard++ < 64){
        const ms = words.map(w => measureText(w));
        const spacing = state.spacing?.word ?? 8;
        const lineW = ms.reduce((a,m)=>a+m.w,0) + Math.max(0, words.length-1)*spacing;
        if (lineW <= safeW) break;
        words.forEach(w => w.size = Math.max(6, (w.size||22)-1));
      }
    }

    const ms = words.map(w => measureText(w));
    const spacing = state.spacing?.word ?? 8;
    const lineW = ms.reduce((a,m)=>a+m.w,0) + Math.max(0, words.length-1)*spacing;
    const lineH = ms.reduce((a,m)=>Math.max(a,m.h),0) || 16;

    totalBlockH += lineH + (li ? (state.spacing?.lineGap ?? 2) : 0);
    lineBoxes.push({ width:lineW, height:lineH, measures:ms, words:[] });
  });

  let y = Math.floor((safeH - totalBlockH)/2) + PADDING.y;

  state.lines.forEach((ln, li)=>{
    const box = lineBoxes[li];
    const spacing = state.spacing?.word ?? 8;
    const align = ln.align || state.align || 'center';

    let startX = PADDING.x;
    const leftover = (safeW - box.width);
    if (align === 'center') startX += Math.floor(leftover/2);
    else if (align === 'right') startX += leftover;

    let x = startX;
    const baseline = y + Math.ceil(box.height * 0.8);

    box.words = (ln.words||[]).map((w, wi)=>{
      const m = box.measures[wi];
      const rect = { x, y: baseline - m.ascent, w:m.w, h:m.h, baseline };
      // write back for hit testing when manual disabled
      w.x = rect.x; w.y = rect.y;
      x += m.w + spacing;
      return rect;
    });

    y += box.height + (li < state.lines.length-1 ? (state.spacing?.lineGap ?? 2) : 0);
  });

  state._layout = { lineBoxes, totalBlockH };
}

// ====== RENDER ======
function render(){
  // background
  if (state.background?.type === 'image' && state.background.image){
    ctx.drawImage(state.background.image, 0, 0, canvas.width, canvas.height);
  } else if (bg && bg.type === 'image' && bg.image){
    ctx.drawImage(bg.image, 0, 0, canvas.width, canvas.height);
  } else {
    const c = (state.background?.color || bg?.color || '#000');
    ctx.fillStyle = c; ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  const lb = (state._layout?.lineBoxes) || [];
  (state.lines||[]).forEach((ln, li)=>{
    const lineBox = lb[li]; if (!lineBox) return;
    (ln.words||[]).forEach((w, wi)=>{
      const rect = lineBox.words[wi]; if(!rect) return;
      ctx.save();
      ctx.font = `${w.size}px ${w.font}`;
      ctx.fillStyle = w.color || '#fff';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(w.text || '', rect.x, rect.baseline);
      ctx.restore();
      // selection outline (magenta dotted glow)
      if (state.selection && state.selection.line===li && state.selection.word===wi && state.mode==='edit'){
        ctx.save();
        ctx.strokeStyle = 'rgba(255,0,200,.9)';
        ctx.setLineDash([2,2]);
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x-1, rect.y-1, rect.w+2, rect.h+2);
        ctx.restore();
      }
    });
  });
}

function layoutAndRender(){ layoutAll(); render(); }


// Deterministic render with timeline 't' (seconds). If t is null, use realtime.
function renderAtTime(t){
  const nowSec = (t!=null) ? t : (performance.now()/1000);
  const speed = (state.anim?.speed ?? 1.0);
  const phase = nowSec * speed; // ~1 Hz when speed=1
  const baseAlpha = 0.85 + 0.15 * (0.5*(1+Math.sin(phase*6.28318))); // 0.85..1.0 gentle flicker

  // background
  if (state.background?.type === 'image' && state.background.image){
    ctx.drawImage(state.background.image, 0, 0, canvas.width, canvas.height);
  } else if (typeof bg!=='undefined' && bg?.type === 'image' && bg?.image){
    ctx.drawImage(bg.image, 0, 0, canvas.width, canvas.height);
  } else {
    const c = (state.background?.color || (typeof bg!=='undefined' && bg?.color) || '#000');
    ctx.fillStyle = c; ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  const lb = (state._layout?.lineBoxes) || [];
  (state.lines||[]).forEach((ln, li)=>{
    const lineBox = lb[li]; if (!lineBox) return;
    (ln.words||[]).forEach((w, wi)=>{
      const rect = lineBox.words[wi]; if(!rect) return;
      ctx.save();
      ctx.font = `${w.size}px ${w.font}`;
      ctx.fillStyle = w.color || '#fff';
      ctx.textBaseline = 'alphabetic';
      // Apply global BookTok flicker in preview and during GIF capture
      const alpha = (state.anim?.booktok && state.mode!=='edit') ? baseAlpha : 1;
      ctx.globalAlpha = alpha;
      ctx.fillText(w.text || '', rect.x, rect.baseline);
      ctx.restore();
      // selection outline
      if (state.selection && state.selection.line===li && state.selection.word===wi && state.mode==='edit'){
        ctx.save();
        ctx.strokeStyle = 'rgba(255,0,200,.9)';
        ctx.setLineDash([2,2]);
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x-1, rect.y-1, rect.w+2, rect.h+2);
        ctx.restore();
      }
    });
  });
}

// Back-compat: render() calls deterministic renderAtTime(null)
function render(){ renderAtTime(null); }


function tick(){
  if (state.mode==='preview'){ render(); }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);


// Animation UI bindings
(function(){
  const cb = document.getElementById('animBookTok');
  const sp = document.getElementById('animSpeed');
  if(cb){ if(cb).addEventListener('change', ()=>{ state.anim.booktok = cb.checked; if(state.mode!=='edit') render(); }); }
  if(sp){ if(sp).addEventListener('input', ()=>{ state.anim.speed = Math.max(0.2, Math.min(3, parseFloat(sp.value)||1.0)); }); }
})();    


async function loadPresetByName(name){
  // name like "Preset_A"
  const is96 = (canvas.width===96 && canvas.height===128);
  const candidates = [
    `assets/presets/${is96 ? '96x128' : '64x64'}/${name}.png`,
    `assets/presets/${name}.png`,
    `assets/${name}.png`
  ];
  for(const src of candidates){
    const img = new Image();
    try{
      await new Promise((resolve,reject)=>{ img.onload=resolve; img.onerror=reject; img.src=src; });
      bg = { type:'image', image: img, color:'#000', preset:name };
      layoutAndRender();
      return true;
    }catch(e){ /* try next */ }
  }
  alert(`Could not load preset: ${name}. Expected at: \n` + candidates.join('\n'));
  return false;
}
