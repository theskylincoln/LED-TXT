document.addEventListener('DOMContentLoaded',()=>{
  const S={
    resMode:'96x128', res:{w:96,h:128}, zoom:2, animated:false,
    bg:{type:'preset', name:'Preset_A', color:'#000000', img:null},
    lines:[ [{text:'WILL',color:'#00ACFF'}],
            [{text:'WHEELIE',color:'#00D200'}],
            [{text:'FOR',color:'#FFD700'}],
            [{text:'BOOKTOK',color:'#FF3CC8'}],
            [{text:'GIRLIES',color:'#FF2828'}] ],
    active:{line:0, word:0},
    font:{size:22, gap:2, wgap:3, family:'monospace'},
    boxes:[], lineMeta:[], showSel:false
  };

  const $ = id => document.getElementById(id);
  function bind(id, ev, fn){ const el=$(id); if(el && el.addEventListener) el.addEventListener(ev, fn); }
  function show(id){ const el=$(id); if(el) el.classList.remove('hidden'); }
  function hide(id){ const el=$(id); if(el) el.classList.add('hidden'); }

  const CANVAS=$('canvas'); const CTX=CANVAS.getContext('2d'); const SEL=$('selection'); const GRID=$('bgGrid');

  // Background tiles
  const TILES=[
    {id:'Preset_A', label:'Preset A', file:'assets/Preset_A.png', mode:'96x128'},
    {id:'Preset_B', label:'Preset B', file:'assets/Preset_B.png', mode:'96x128'},
    {id:'SOLID', label:'Solid', solid:true, mode:'both'},
    {id:'CUSTOM', label:'Custom', custom:true, mode:'both'}
  ];

  function dprSetup(){
    const dpr=Math.max(1,window.devicePixelRatio||1);
    CANVAS.width = Math.floor(S.res.w*dpr); CANVAS.height = Math.floor(S.res.h*dpr);
    CANVAS.style.width = S.res.w+'px'; CANVAS.style.height = S.res.h+'px';
    CTX.setTransform(dpr,0,0,dpr,0,0);
  }
  function setZoom(z){ S.zoom=Math.max(.5,Math.min(5,z)); CANVAS.style.width=(S.res.w*S.zoom)+'px'; CANVAS.style.height=(S.res.h*S.zoom)+'px'; const zl=$('zoomLabel'); if(zl) zl.textContent=Math.round(S.zoom*100)+'%'; }

  function ensureLineMeta(){ while(S.lineMeta.length < S.lines.length){ S.lineMeta.push({align:'center'}); } }
  function measureWord(w){ const avg=Math.max(3, Math.floor(S.font.size*0.6)); return Math.max(avg, Math.floor(avg*(w.text?.length||1))); }
  function computeLayout(){
    ensureLineMeta(); S.boxes.length=0;
    const lh=S.font.size+S.font.gap; const total=lh*S.lines.length - S.font.gap; const startY=Math.floor((S.res.h-total)/2);
    for(let li=0; li<S.lines.length; li++){
      const line=S.lines[li], meta=S.lineMeta[li]; const widths=line.map(measureWord);
      const totalW = widths.reduce((a,b)=>a+b,0) + (line.length-1)*S.font.wgap;
      let x = meta.align==='left' ? 2 : meta.align==='right' ? (S.res.w-2-totalW) : Math.floor((S.res.w-totalW)/2);
      const y = startY + li*lh;
      for(let wi=0; wi<line.length; wi++){ const w=line[wi]; const box={line:li,word:wi,x,y,w:widths[wi],h:S.font.size}; S.boxes.push(box); x += widths[wi] + S.font.wgap; }
    }
  }
  function draw(){
    CTX.clearRect(0,0,S.res.w,S.res.h);
    if(S.bg.type==='solid'){ CTX.fillStyle=S.bg.color||'#0d1320'; CTX.fillRect(0,0,S.res.w,S.res.h); }
    else if(S.bg.img){ CTX.drawImage(S.bg.img,0,0,S.res.w,S.res.h); }
    else { CTX.fillStyle='#0d1320'; CTX.fillRect(0,0,S.res.w,S.res.h); }
    computeLayout();
    for(const b of S.boxes){ const W=S.lines[b.line][b.word]; CTX.fillStyle=W.color||'#fff'; CTX.font=`${S.font.size}px ${S.font.family}`; CTX.textBaseline='top'; CTX.fillText(W.text||'', b.x, b.y); }
    const nb=S.boxes.find(bb=> bb.line===S.active.line && bb.word===S.active.word);
    if(nb && !S.animated && S.showSel){ placeSelection(nb); } else { clearSelection(); }
  }
  function placeSelection(nb){
    const cr=CANVAS.getBoundingClientRect(); const sx=cr.width/S.res.w, sy=cr.height/S.res.h;
    SEL.classList.remove('hidden'); SEL.style.left=(nb.x*sx)+'px'; SEL.style.top=(nb.y*sy)+'px'; SEL.style.width=(nb.w*sx)+'px'; SEL.style.height=(nb.h*sy)+'px';
  }
  function clearSelection(){ SEL.classList.add('hidden'); }

  function renderGrid(){
    if(!GRID) return; GRID.innerHTML=''; const mode=S.resMode;
    TILES.filter(t=> t.mode==='both' || t.mode===mode).forEach(t=>{
      const div=document.createElement('div'); div.className='tile'; div.dataset.id=t.id;
      if(t.solid){ div.innerHTML=`<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#000;color:#fff">Solid</div><div class="label">Solid</div>`; }
      else if(t.custom){ div.innerHTML=`<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#142033;color:#cfe9ff">Custom</div><div class="label">Custom</div>`; }
      else { div.innerHTML=`<img class="thumb" src="${t.file}" alt="${t.label}"><div class="label">${t.label}</div>`; }
      div.addEventListener('click', ()=> selectTile(t));
      GRID.appendChild(div);
    });
  }
  function selectTile(t){
    S.showSel=false;
    hide('solidWrap'); hide('customWrap');
    if(t.solid){ show('solidWrap'); S.bg={type:'solid', color:'#000000', img:null}; draw(); }
    else if(t.custom){ show('customWrap'); }
    else {
      const img=new Image(); img.onload=()=>{ S.bg={type:'preset', name:t.id, img}; draw(); }; img.src=t.file;
    }
  }

  // Canvas: one-click inline edit
  CANVAS.addEventListener('mouseup', (e)=>{
    const cr=CANVAS.getBoundingClientRect(); const sx=cr.width/S.res.w, sy=cr.height/S.res.h;
    const x=(e.clientX-cr.left)/sx, y=(e.clientY-cr.top)/sy;
    const hit=S.boxes.find(b=> x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h);
    if(!hit) return;
    S.active.line=hit.line; S.active.word=hit.word; S.showSel=true; draw();
    const wrap=CANVAS.parentElement; const input=document.createElement('input'); input.type='text'; input.value=S.lines[hit.line][hit.word].text||'';
    input.style.position='absolute'; input.style.left=(hit.x*sx)+'px'; input.style.top=(hit.y*sy)+'px';
    input.style.width=(Math.max(60,hit.w)*sx+24)+'px'; input.style.height=(S.font.size*sy+8)+'px';
    input.style.font=`${S.font.size*sy}px ${S.font.family}`; input.style.padding='2px 4px';
    input.style.border='1px solid rgba(255,255,255,.4)'; input.style.borderRadius='6px'; input.style.background='#0d1320'; input.style.color='#e9f3ff'; input.style.zIndex='5';
    wrap.appendChild(input); input.focus(); input.select();
    const commit=()=>{ if(!input.parentElement) return; S.lines[hit.line][hit.word].text=input.value; wrap.removeChild(input); draw(); };
    input.addEventListener('keydown', ev=>{ if(ev.key==='Enter') commit(); if(ev.key==='Escape'){ wrap.removeChild(input);} });
    input.addEventListener('blur', commit);
  });

  // Inspector + controls
  function valNum(id,def=0){ const el=$(id); const v=el?parseInt(el.value,10):NaN; return Number.isFinite(v)?v:def; }
  bind('zoomIn','click', ()=> setZoom(S.zoom+0.25));
  bind('zoomOut','click', ()=> setZoom(S.zoom-0.25));
  bind('addLine','click', ()=>{ S.lines.push([{text:'WORD',color:'#ffffff'}]); S.active.line=S.lines.length-1; S.active.word=0; draw(); });
  bind('addWord','click', ()=>{ if(!S.lines.length){ S.lines.push([{text:'WORD',color:'#ffffff'}]); S.active.line=0; } S.lines[S.active.line].push({text:'WORD',color:'#ffffff'}); S.active.word=S.lines[S.active.line].length-1; draw(); });
  bind('deleteWord','click', ()=>{ const L=S.lines[S.active.line]; if(L&&L.length){ L.splice(S.active.word,1); S.active.word=Math.max(0,S.active.word-1); if(L.length===0){ S.lines.splice(S.active.line,1); S.active.line=Math.max(0,S.active.line-1); S.active.word=0; } draw(); } });

  bind('wordText','input', e=>{ const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.text=e.target.value; draw(); } });
  bind('wordColor','input', e=>{ const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.color=e.target.value; draw(); } });
  bind('fontSize','input', e=>{ S.font.size=parseInt(e.target.value)||22; draw(); });
  bind('fontFamily','change', e=>{ S.font.family=e.target.value||'monospace'; draw(); });
  bind('lineGap','input', e=>{ S.font.gap=parseInt(e.target.value)||2; draw(); });
  bind('wordGap','input', e=>{ S.font.wgap=parseInt(e.target.value)||3; draw(); });

  bind('alignLeft','click', ()=>{ ensureLineMeta(); S.lineMeta[S.active.line].align='left'; draw(); });
  bind('alignCenter','click', ()=>{ ensureLineMeta(); S.lineMeta[S.active.line].align='center'; draw(); });
  bind('alignRight','click', ()=>{ ensureLineMeta(); S.lineMeta[S.active.line].align='right'; draw(); });

  bind('modeHideAnim','click', stopAnim);
  bind('modeShowAnim','click', startAnim);

  // Resolution + background
  bind('resMode','change', ()=>{
    const v=$('resMode').value; S.resMode=v;
    if(v==='96x128'){ S.res={w:96,h:128}; }
    else if(v==='64x64'){ S.res={w:64,h:64}; }
    $('customRes')?.classList.toggle('hidden', v!=='custom');
    dprSetup(); setZoom(S.zoom); renderGrid(); draw();
  });
  bind('applyRes','click', ()=>{
    S.res={w:valNum('customW',96), h:valNum('customH',128)}; S.resMode='custom';
    dprSetup(); setZoom(S.zoom); renderGrid(); draw();
  });
  bind('solidPicker','input', e=>{ S.bg={type:'solid', color:e.target.value, img:null}; draw(); });
  bind('customFile','change', e=>{
    const f = e.target && e.target.files && e.target.files[0]; if(!f) return;
    const url = URL.createObjectURL(f); const img=new Image(); img.onload=()=>{ S.bg={type:'custom', img}; draw(); }; img.src=url;
  });

  
// --- Animation loop (RAF) ---
let _rafId = null;
function tick(){
  S._phase = (S._phase || 0) + 0.02;
  draw();
  if(S.animated) _rafId = requestAnimationFrame(tick);
}
function startAnim(){
  if(!S.animated){ S.animated = true; }
  if(_rafId == null){ _rafId = requestAnimationFrame(tick); }
}
function stopAnim(){
  S.animated = false;
  if(_rafId != null){ cancelAnimationFrame(_rafId); _rafId = null; }
  draw();
}

// Owner Key flow (no auto-open)
  const OWNER_KEY='abraham';
  let ownerUnlocked=false;
  function showOwnerModal(){}
  function hideOwnerModal(){}
  function unlockOwner(){
    const val = ($('ownerKeyInput')?.value || '').trim().toLowerCase();
    if(val===OWNER_KEY){ ownerUnlocked=true; $('ownerPresetsInline')?.classList.remove('hidden'); $('ownerKeyInput')?.classList.add('hidden'); $('ownerKeyBtn')?.classList.add('hidden'); }
    else { alert('Invalid key'); }
  }
  bind('ownerKeyBtn','click', unlockOwner);
  bind('ownerKeyInput','keydown', e=>{ if(e.key==='Enter') unlockOwner(); });
  bind('ownerClose','click', hideOwnerModal);
  bind('ownerPresetA','click', ()=>{ applyOwnerPreset('A'); hideOwnerModal(); });
  bind('ownerPresetB','click', ()=>{ applyOwnerPreset('B'); hideOwnerModal(); });
  function applyOwnerPreset(which){
    S.resMode='96x128'; S.res={w:96,h:128}; dprSetup(); setZoom(2);
    const img=new Image(); const file = which==='A' ? 'assets/Preset_A.png' : 'assets/Preset_B.png';
    img.onload=()=>{ S.bg={type:'preset', name:which==='A'?'Preset_A':'Preset_B', img}; draw(); };
    img.src=file;
    const A=[[{text:'WILL',color:'#00ACFF'}],[{text:'WHEELIE',color:'#00D200'}],[{text:'FOR',color:'#FFD700'}],[{text:'BOOKTOK',color:'#FF3CC8'}],[{text:'GIRLIES',color:'#FF2828'}]];
    const B=[[{text:'FREE',color:'#00ACFF'}],[{text:'RIDES',color:'#00D200'}],[{text:'FOR',color:'#FFD700'}],[{text:'BOOKTOK',color:'#FF3CC8'}],[{text:'GIRLIES',color:'#FF2828'}]];
    S.lines = which==='A' ? A : B; S.active={line:0,word:0}; S.showSel=false; draw();
  }

  // INIT (never opens modal)
  (function init(){
    try{
      hideOwnerModal();
      dprSetup(); setZoom(2); renderGrid();
      const img=new Image();
      img.onload=()=>{ S.bg={type:'preset', name:'Preset_A', img}; draw(); };
      img.onerror=()=>{ S.bg={type:'solid', color:'#0d1320', img:null}; draw(); };
      img.src='assets/Preset_A.png';
    }catch(e){ console.error('Init error', e); }
  })();
});
});

bind('clearAll','click', ()=>{ if(confirm('Clear all words?')){ S.lines=[]; S.active={line:0,word:0}; S.boxes=[]; draw(); }});

bind('downloadJson','click', ()=>{
  const payload = {version:1, res:S.res, bg:S.bg, lines:S.lines, font:S.font};
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='led_preset.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
});
bind('uploadJson','change', async e=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const txt=await f.text(); const data=JSON.parse(txt);
    if(data.lines) S.lines=data.lines;
    if(data.bg) S.bg=data.bg;
    if(data.res) S.res=data.res;
    draw();
  }catch(err){ alert('Invalid JSON'); }
});

bind('bgCustomUpload','change', e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  const img=new Image();
  img.onload=()=>{ S.bg={type:'image', name:f.name, img}; draw(); };
  img.src=url;
});

function autoFitWord(ctx, text, maxWidth, baseSize, family){
  let size = baseSize;
  ctx.font = `${size}px ${family}`;
  let w = ctx.measureText(text).width;
  if(w<=maxWidth) return size;
  // shrink until it fits (min 6px)
  while(size>6 && w>maxWidth){
    size -= 1;
    ctx.font = `${size}px ${family}`;
    w = ctx.measureText(text).width;
  }
  return size;
}

// Canvas interactions: select, drag, inline edit
let dragState=null;
const canvas=$('canvas'), sel=$('selection'), editIn=$('canvasEditOverlay');
let lastBoxes=[];

function hitTest(x,y){
  // lastBoxes contains {x,y,w,h,line,word}
  for(let i=lastBoxes.length-1;i>=0;i--){
    const b=lastBoxes[i];
    if(x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h) return b;
  }
  return null;
}

canvas.addEventListener('mousedown',e=>{
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/(S.zoom||1);
  const y=(e.clientY-rect.top)/(S.zoom||1);
  const b=hitTest(x,y);
  if(b){
    S.active.line=b.line; S.active.word=b.word;
    dragState={dx:x-b.x, dy:y-b.y, target:b};
    placeSelection(b);
  } else {
    dragState=null; hideSelection();
  }
});
canvas.addEventListener('mousemove',e=>{
  if(!dragState) return;
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/(S.zoom||1);
  const y=(e.clientY-rect.top)/(S.zoom||1);
  const b=dragState.target;
  const W = S.lines[b.line]?.[b.word];
  if(W){ W.offset = {x: Math.round(x - dragState.dx), y: Math.round(y - dragState.dy)}; draw(); placeSelection({...b, x:W.offset.x, y:W.offset.y}); }
});
window.addEventListener('mouseup',()=>{ dragState=null; });

canvas.addEventListener('dblclick',e=>{
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left), y=(e.clientY-rect.top);
  const b=hitTest(x/(S.zoom||1), y/(S.zoom||1));
  if(!b) return;
  const W=S.lines[b.line]?.[b.word]; if(!W) return;
  // position overlay
  editIn.classList.remove('hidden');
  editIn.value = W.text || '';
  editIn.style.left = `${x}px`; editIn.style.top = `${y}px`;
  editIn.focus();
  editIn.onkeydown = ev=>{
    if(ev.key==='Enter'){ ev.preventDefault(); W.text = editIn.value; editIn.classList.add('hidden'); draw(); }
    if(ev.key==='Escape'){ editIn.classList.add('hidden'); }
  };
});

function hideSelection(){ sel?.classList.add('hidden'); }
function placeSelection(b){
  if(!sel) return;
  sel.classList.remove('hidden');
  sel.style.left = (b.x*(S.zoom||1))+'px';
  sel.style.top = (b.y*(S.zoom||1))+'px';
  sel.style.width = (b.w*(S.zoom||1))+'px';
  sel.style.height = (b.h*(S.zoom||1))+'px';
}

bind('wordText','input', e=>{ const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.text=e.target.value; draw(); }});
bind('wordColor','input', e=>{ const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.color=e.target.value; draw(); }});
bind('wordFont','change', e=>{ const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.font=e.target.value||S.font.family; draw(); }});
bind('wordSize','input', e=>{ const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.size=parseInt(e.target.value)||S.font.size; draw(); }});

// --- Direct typing on canvas ---
canvas.setAttribute('tabindex','0');
canvas.addEventListener('keydown', (e)=>{
  // Pause animation while editing
  if(S.animated) stopAnim();
  const L=S.active.line, Widx=S.active.word;
  const W=S.lines[L]?.[Widx];
  if(!W) return;
  if(e.key.length===1 && !e.ctrlKey && !e.metaKey){
    e.preventDefault();
    W.text = (W.text||'') + e.key;
    draw();
    return;
  }
  if(e.key==='Backspace'){
    e.preventDefault();
    W.text = (W.text||'').slice(0,-1);
    draw();
    return;
  }
  if(e.key==='Enter'){
    e.preventDefault();
    // New word on same line at approximate next position
    const newW = {text:'', color:W.color || '#FFFFFF', font: W.font || S.font.family, size: W.size || S.font.size, offset:{x:(W.offset?.x||0)+ (W.w||10) + (S.font.wgap||3), y: W.offset?.y||0}};
    S.lines[L].splice(Widx+1,0,newW);
    S.active.word = Widx+1;
    draw();
    return;
  }
  if(e.key==='Escape'){
    e.preventDefault();
    hideSelection();
    return;
  }
});

// Show a caret at the end of the active word when canvas is focused and not animating
let _caretBlink=true;
setInterval(()=>{ _caretBlink=!_caretBlink; if(document.activeElement===canvas && !S.animated) draw(); }, 500);

// Patch draw() to paint caret
if(typeof draw==='function'){
  const __origDraw = draw;
  draw = function(){
    __origDraw();
    try{
      if(document.activeElement===canvas && !S.animated){
        const L=S.active.line, Widx=S.active.word;
        const b = (Array.isArray(S.boxes)? S.boxes.find(B=>B.line===L && B.word===Widx): null);
        if(b && _caretBlink){
          const ctx = $('canvas').getContext('2d');
          ctx.save();
          ctx.fillStyle = '#32d1ff';
          const x = Math.round(b.x + b.w + 1);
          const y = Math.round(b.y);
          const h = Math.max(8, Math.round(b.h));
          ctx.fillRect(x, y, 1, h);
          ctx.restore();
        }
      }
    }catch(_e){}
  }
}
