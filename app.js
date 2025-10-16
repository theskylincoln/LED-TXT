
// ===== STATE =====
const S = {
  res: {w:128, h:96},
  lines: [[{text:"Hello", color:"#FFFFFF", size:22, font:"Monospace", offset:{x:2,y:2}}]],
  font: {family:"Monospace", size:22, gap:2, wgap:3},
  alignH: "left",
  bg: {type:"solid", color:"#000", img:null},
  fxIntensity: 0.6,
  active: {line:0, word:0},
  animated:false, _phase:0,
};

// ===== UTIL =====
function $(id){ return document.getElementById(id); }
function e(name){ return document.querySelector(name); }
function bind(id, ev, fn){ const el=$(id); if(el) el.addEventListener(ev, fn); }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Canvas
  const c = $('canvas') || $('canvas#canvas'); // safety
  const canvas = $('canvas#canvas');
  if(canvas){ canvas.width = S.res.w; canvas.height = S.res.h; }

  // Background tiles
  document.querySelectorAll('.bgTile').forEach(t=>t.addEventListener('click', onTile));
  // Solid color row toggle
  bind('bgSolidColor','input', ev => { S.bg.color = ev.target.value; $('bgColorChip').style.background = ev.target.value; draw(); });

  // Resolution
  bind('resolutionSelect','change', ev => handleResolution(ev.target.value));
  handleResolution($('resolutionSelect').value);

  // Inspector
  bind('alignH','change', ev => { S.alignH = ev.target.value; draw(); });
  bind('wordInput','input', ev => { const W=currentWord(); if(W){ W.text = ev.target.value; draw(); } });
  bind('wordColor','input', ev => { const W=currentWord(); if(W){ W.color = ev.target.value; draw(); } });
  bind('fontFamily','change', ev => { S.font.family = ev.target.value; draw(); });
  bind('fontSize','input', ev => { S.font.size = parseInt(ev.target.value)||22; draw(); });
  bind('lineGap','input', ev => { S.font.gap = parseInt(ev.target.value)||2; draw(); });
  bind('wordGap','input', ev => { S.font.wgap = parseInt(ev.target.value)||3; draw(); });
  bind('autosize','change', draw);

  // Buttons
  bind('addLine','click', () => { S.lines.push([{text:"", color:"#FFFFFF", size:S.font.size, font:S.font.family, offset:{x:2,y:2}}]); S.active={line:S.lines.length-1, word:0}; $('wordInput').value=""; draw(); });
  bind('addWord','click', () => { const L=S.lines[S.active.line]||[]; L.push({text:"", color:"#FFFFFF", size:S.font.size, font:S.font.family, offset:{x:2,y:2}}); S.active.word=L.length-1; $('wordInput').value=""; draw(); });
  bind('delWord','click', () => { const L=S.lines[S.active.line]; if(!L) return; L.splice(S.active.word,1); S.active.word = Math.max(0,S.active.word-1); draw(); });

  bind('showAnim','click', ()=> startAnim());
  bind('hideAnim','click', ()=> stopAnim());
  bind('zoomIn','click', ()=> zoom(1.2));
  bind('zoomOut','click', ()=> zoom(1/1.2));

  // Swatches
  const palette = ['#00B2FF','#29FF60','#FFF200','#FF4DD2','#FF5757','#FFFFFF','#000000'];
  const sw = $('swatches'); sw.innerHTML = '';
  for(const col of palette){
    const b = document.createElement('button'); b.className='swatch'; b.style.background = col; b.addEventListener('click', ()=>{ const W=currentWord(); if(W){ W.color=col; $('wordColor').value = col; draw(); }});
    sw.appendChild(b);
  }

  // Presets
  bind('downloadPreset','click', downloadPreset);
  bind('uploadPreset','change', uploadPreset);
  bind('unlock','click', onUnlock);
  bind('ownerKey','keydown', e=>{ if(e.key==='Enter') onUnlock(); });
  bind('presetA','click', ()=> loadOwnerPreset('A'));
  bind('presetB','click', ()=> loadOwnerPreset('B'));

  // Canvas typing / manual drag selection
  const canvasEl = $('canvas');
  if(canvasEl){
    canvasEl.tabIndex = 0;
    canvasEl.addEventListener('click', onCanvasClick);
    canvasEl.addEventListener('keydown', onCanvasKey);
    enableDrag(canvasEl);
  }

  draw();
});

// ===== BG TILES =====
function onTile(ev){
  const t = ev.currentTarget.getAttribute('data-tile');
  if(t==='solid'){
    S.bg={type:'solid', color: $('bgSolidColor').value, img:null};
    $('solidColorRow').classList.remove('hidden');
  }else if(t==='preset'){
    S.bg={type:'preset', color:'#000', img:null}; // placeholder still draws solid until images wired
    $('solidColorRow').classList.add('hidden');
  }else if(t==='custom'){
    // placeholder: future upload UI
    alert('Custom background upload coming soon in this build.');
  }
  draw();
}

function handleResolution(v){
  const map={'96x128':{w:128,h:96}, '64x64':{w:64,h:64}, '128x96':{w:96,h:128}};
  const R = map[v] || {w:128,h:96};
  S.res = {w:R.w, h:R.h};
  const c=$('canvas'); if(c){ c.width=R.w; c.height=R.h; }
  draw();
}

// ===== CANVAS EDIT =====
function currentWord(){ return S.lines[S.active.line]?.[S.active.word]; }
function onCanvasClick(e){
  const c=$('canvas'), ctx=c.getContext('2d'); const rect=c.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*(c.width/rect.width), my=(e.clientY-rect.top)*(c.height/rect.height);
  const L=S.lines[S.active.line]||[]; let x=2;
  let best=Infinity, idx=0;
  for(let i=0;i<L.length;i++){
    const W=L[i]; const s=W.size||S.font.size; ctx.font=s+'px '+(W.font||S.font.family);
    const w=ctx.measureText(W.text||'').width, h=s; const ox=x, oy=2; // baseline top-left
    const cx=ox+w/2, cy=oy+h/2; const d=(cx-mx)**2+(cy-my)**2;
    if(d<best){ best=d; idx=i; } x += w + (S.font.wgap||3);
  }
  S.active.word = idx; $('wordInput').focus(); $('wordInput').value = L[idx]?.text||''; draw();
}
function onCanvasKey(e){
  const W = currentWord(); if(!W) return;
  if(e.key==='Backspace'){ e.preventDefault(); W.text = (W.text||'').slice(0,-1); }
  else if(e.key.length===1){ W.text = (W.text||'') + e.key; }
  draw();
}
function enableDrag(canvas){
  let drag=false, dx=0, dy=0;
  canvas.addEventListener('mousedown', (e)=>{
    if(S.alignH!=='manual') return;
    const r=canvas.getBoundingClientRect();
    const mx=(e.clientX-r.left)*(canvas.width/r.width);
    const my=(e.clientY-r.top)*(canvas.height/r.height);
    const W=currentWord(); if(!W) return;
    drag=true; dx=(W.offset?.x??2)-mx; dy=(W.offset?.y??2)-my;
  });
  function move(e){
    if(!drag) return;
    const r=canvas.getBoundingClientRect();
    const mx=(e.clientX-r.left)*(canvas.width/r.width);
    const my=(e.clientY-r.top)*(canvas.height/r.height);
    const W=currentWord(); if(!W) return;
    W.offset = {x:Math.round(mx+dx), y:Math.round(my+dy)}; draw();
  }
  function up(){ drag=false; }
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

// ===== DRAW =====
function draw(){
  const c=$('canvas'); if(!c) return; const ctx=c.getContext('2d');
  // background
  if(S.bg.type==='solid'){ ctx.fillStyle=S.bg.color||'#000'; ctx.fillRect(0,0,c.width,c.height); }
  // text layout
  const pad=2; let y=pad;
  for(const line of S.lines){
    // measure & autosize per line (if enabled)
    let lw=0, lh=0;
    for(const W of line){ ctx.font=(W.size||S.font.size)+'px '+(W.font||S.font.family); lw += ctx.measureText(W.text||'').width + (S.font.wgap||3); lh = Math.max(lh, W.size||S.font.size); }
    lw=Math.max(0, lw - (S.font.wgap||3));
    let scale = 1;
    if($('autosize')?.checked && lw>c.width-2*pad && lw>0){ scale = (c.width-2*pad)/lw; }
    // compute start x by horizontal align (manual ignores)
    let x=pad;
    if(S.alignH==='center'){ x = Math.max(pad, Math.floor((c.width - lw*scale)/2)); }
    else if(S.alignH==='right'){ x = Math.max(pad, c.width - pad - lw*scale); }

    // draw words
    for(let i=0;i<line.length;i++){
      const W=line[i]; const size=(W.size||S.font.size)*scale;
      ctx.font=size+'px '+(W.font||S.font.family); ctx.textBaseline='top'; ctx.fillStyle=W.color||'#fff';
      let ox = (S.alignH==='manual' ? (W.offset?.x ?? x) : x);
      let oy = (S.alignH==='manual' ? (W.offset?.y ?? y) : y);

      // Animations
      const t=S._phase||0, I=S.fxIntensity||0.6;
      if($('fx-scroll')?.checked){ ox -= (t*(parseFloat($('fxScroll')?.value)||20)*I) % (c.width+100); }
      if($('fx-jitter')?.checked){ const j=(parseFloat($('fxJitter')?.value)||2)*I; ox+=Math.sin(t*17+i*13)*j; oy+=Math.cos(t*23+i*7)*j; }
      if($('fx-bounce')?.checked){ const b=(parseFloat($('fxBounce')?.value)||2)*I; oy+=Math.sin(t*2+i)*b; }
      if($('fx-wave')?.checked){ const w=(parseFloat($('fxWave')?.value)||2)*I; oy+=Math.sin((ox/10)+t*2)*w; }
      if($('fx-pulse')?.checked){ const p=(parseFloat($('fxPulse')?.value)||0.08)*I; ctx.save(); ctx.translate(ox,oy); ctx.scale(1+p*Math.sin(t*3+i), 1+p*Math.sin(t*3+i)); ctx.fillText(W.text||'', 0, 0); ctx.restore(); }
      else{
        const text = $('fx-typewriter')?.checked ? (W.text||'').slice(0, Math.max(0, Math.floor(t*(parseFloat($('fxTypeCPS')?.value)||12)*I))) : (W.text||'');
        ctx.fillText(text, ox, oy);
      }
      if($('fx-flicker')?.checked){ /* alpha handled implicitly per frame */ }

      x += ctx.measureText(W.text||'').width*scale + (S.font.wgap||3)*scale;
    }
    y += lh*scale + (S.font.gap||2);
  }
}

// ===== ANIM LOOP & ZOOM =====
let _raf=null;
function tick(){ S._phase += 0.02; draw(); if(S.animated) _raf = requestAnimationFrame(tick); }
function startAnim(){ if(!_raf){ S.animated=true; _raf=requestAnimationFrame(tick);} }
function stopAnim(){ S.animated=false; if(_raf){ cancelAnimationFrame(_raf); _raf=null; } draw(); }
function zoom(mult){ const p=$('zoomPct'); const current=parseInt(p.textContent)||100; const next=Math.max(25, Math.min(400, Math.round(current*mult))); p.textContent=next+'%'; $('canvas').style.width = next+'%'; $('canvas').style.height = 'auto'; }

// ===== PRESETS =====
function downloadPreset(){
  const data = { S };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'led_backpack_preset.json'; a.click();
}
function uploadPreset(ev){
  const file = ev.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      if(obj && obj.S){ Object.assign(S, obj.S); $('resolutionSelect').value = `${S.res.h}x${S.res.w}` === '96x128' ? '96x128' : (S.res.w===64? '64x64' : '128x96'); handleResolution($('resolutionSelect').value); draw(); }
    }catch(e){ alert('Bad preset JSON.'); }
  };
  reader.readAsText(file);
}

// ===== OWNER KEY =====
const OWNER_KEY = 'Abraham';
function onUnlock(){
  if($('ownerKey').value.trim() === OWNER_KEY){
    $('ownerRow').classList.remove('hidden');
    $('ownerKey').classList.add('hidden');
    $('unlock').classList.add('hidden');
  }
}
function loadOwnerPreset(which){
  if(which==='A'){
    S.lines = [[{text:"WILL WHEELIE", color:"#00B2FF", size:22, font:S.font.family, offset:{x:2,y:2}}]];
  }else{
    S.lines = [[{text:"FOR BOOKTOK GIRLIES", color:"#FF4DD2", size:22, font:S.font.family, offset:{x:2,y:26}}]];
  }
  S.active={line:0,word:0}; $('wordInput').value = S.lines[0][0].text; draw();
}
