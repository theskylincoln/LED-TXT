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
    
    
    
    for(const b of S.boxes){
      const W=S.lines[b.line][b.word];
      const text=W.text||'';
      const size=W.size||S.font.size, fam=W.font||S.font.family;
      let ax=0, ay=0, scale=1, alpha=1;
      const t=S._phase||0; const k=(S.fxIntensity!=null? S.fxIntensity:0.6);
      // combine effects
      if(S.animated && S.animEffects){
        if(S.animEffects.has('scroll')){ const sp = (S.fxParams?.scroll||20)*(0.2+1.8*k); ay += -((t*sp) % (S.res.h+1)); }
        if(S.animEffects.has('jitter')){ const A=(S.fxParams?.jitter||2.0)*(0.2+0.8*k); ax += Math.sin((b.x+b.y+t*40))*A; ay += Math.cos((b.x-b.y+t*33))*A; }
        if(S.animEffects.has('bounce')){ const A=(S.fxParams?.bounce||2.0)*(0.2+0.8*k); ay += Math.sin(t*2 + b.line*0.8)*A; }
        if(S.animEffects.has('wave')){   const A=(S.fxParams?.wave||2.0)*(0.2+0.8*k); ax += Math.sin(t*3 + (b.x*0.08))*A; }
        if(S.animEffects.has('pulse')){  const A = (S.fxParams?.pulse||0.08)*(0.2+0.8*k); scale *= 1 + A*Math.sin(t*4 + b.word*0.7); }
        if(S.animEffects.has('bubble')){ const A = (S.fxParams?.bubble||0.12)*(0.2+0.8*k); scale *= 1 + A*Math.sin(t*2 + b.word*0.9); ay += (0.5+2.5*k)*Math.sin(t*2 + b.word); }
        if(S.animEffects.has('glitch')){ const A = (S.fxParams?.glitch||3.0)*(0.2+0.8*k); const F = (S.fxParams?.glitchF||18); if(((t*F)|0)%10===0){ ax += (Math.random()-0.5)*A; ay += (Math.random()-0.5)*(A*0.7); } }
        if(S.animEffects.has('flicker')){ const A = (S.fxParams?.flicker||0.3)*(0.5+0.5*k); alpha *= (1-A) + A*Math.abs(Math.sin(t*10 + (b.word*0.5))); }
      }
      CTX.save();
      CTX.globalAlpha = alpha;
      CTX.fillStyle = W.color||'#fff';
      CTX.textBaseline='top';
      const drawText = (str)=>{
        if(scale!==1){
          CTX.save();
          CTX.font = `${Math.round(size*scale)}px ${fam}`;
          CTX.fillText(str, b.x+ax, b.y+ay);
          CTX.restore();
        } else {
          CTX.font = `${size}px ${fam}`;
          CTX.fillText(str, b.x+ax, b.y+ay);
        }
      };
      if(S.animated && S.animEffects && S.animEffects.has('typewriter')){
        const cps = 12; // chars/sec
        const shown = Math.max(0, Math.min(text.length, Math.floor((t*cps) - (b.line*2)) ));
        const partial = text.slice(0, shown);
        drawText(partial);
        // caret
        if(shown < text.length){
          const w = CTX.measureText(partial).width;
          CTX.fillRect((b.x+ax)+w+1, (b.y+ay), 1, Math.max(8, Math.round(size*1.1)));
        }
      } else {
        drawText(text);
      }
      CTX.restore();
    }
    
    }
    
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

  // Owner Key flow (no auto-open)
  const OWNER_KEY='abraham';
  let ownerUnlocked=false;
  function showOwnerModal(){ const m=$('ownerModal'); if(m && ownerUnlocked){ m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); } }
  function hideOwnerModal(){ const m=$('ownerModal'); if(m){ m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); } }
  function unlockOwner(){
    const val = ($('ownerKeyInput')?.value || '').trim().toLowerCase();
    if(val===OWNER_KEY){ ownerUnlocked=true; $('ownerPresetsInline')?.classList.remove('hidden'); $('ownerKeyInput')?.classList.add('hidden'); $('ownerKeyBtn')?.classList.add('hidden'); }
    else { alert('Invalid key'); }
  }
  bind('ownerKeyBtn','click', unlockOwner);
  bind('ownerKeyInput','keydown', e=>{ if(e.key==='Enter') unlockOwner(); });
  bind('ownerClose','click', hideOwnerModal);
  bind('ownerPresetA','click', ()=>{ applyOwnerPreset('A'); });
  bind('ownerPresetB','click', ()=>{ applyOwnerPreset('B'); });
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
      dprSetup(); setZoom(2); renderGrid();
      const img=new Image();
      img.onload=()=>{ S.bg={type:'preset', name:'Preset_A', img}; draw(); };
      img.onerror=()=>{ S.bg={type:'solid', color:'#0d1320', img:null}; draw(); };
      img.src='assets/Preset_A.png';
    }catch(e){ console.error('Init error', e); }
  })();
});

// Animation loop
let _rafId=null;
function tick(){ S._phase=(S._phase||0)+0.02; draw(); if(S.animated) _rafId=requestAnimationFrame(tick); }
function startAnim(){ if(!S.animated){ S.animated=true; } if(_rafId==null){ _rafId=requestAnimationFrame(tick); } }
function stopAnim(){ S.animated=false; if(_rafId!=null){ cancelAnimationFrame(_rafId); _rafId=null; } draw(); }

bind('renderNow','click', ()=>{ startAnim(); setTimeout(()=>stopAnim(), 1200); });


bind('bgType','change', e=>{
  const v=e.target.value;
  if(v==='solid'){ S.bg={type:'solid', color: $('bgSolidColor')?.value || '#000000', img:null}; }
  draw();
});
bind('bgSolidColor','input', e=>{
  if(S.bg?.type==='solid'){ S.bg.color=e.target.value; draw(); }
});
bind('bgCustomUpload','change', e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f); const img=new Image();
  img.onload=()=>{ S.bg={type:'image', name:f.name, img}; draw(); };
  img.src=url;
});


bind('downloadJson','click', ()=>{
  const payload = {version:1, res:S.res, bg:{type:S.bg?.type||'preset', name:S.bg?.name||S.bg?.type, color:S.bg?.color||'#000000'}, lines:S.lines, font:S.font};
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='led_preset.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
});
bind('uploadJson','change', async e=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const txt=await f.text(); const data=JSON.parse(txt);
    if(data.lines) S.lines=data.lines;
    if(data.bg){ S.bg = data.bg.type==='solid' ? {type:'solid', color:data.bg.color||'#000000', img:null} : {...S.bg, ...data.bg}; }
    if(data.res) S.res=data.res;
    draw();
  }catch(err){ alert('Invalid JSON'); }
});


const sw = $('colorSwatches');
if(sw){
  sw.addEventListener('click', e=>{
    const btn = e.target.closest('.swatch'); if(!btn) return;
    const color = btn.getAttribute('data-color'); if(!color) return;
    const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.color=color; }
    const inp=$('wordColor'); if(inp) inp.value=color;
    draw();
  });
}


// Drag-to-move on canvas
const canvas=$('canvas'), selection=$('selection');
let dragging=null;
function hitTest(x,y){
  if(!Array.isArray(S.boxes)) return null;
  for(let i=S.boxes.length-1;i>=0;i--){
    const b=S.boxes[i];
    if(x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h) return b;
  }
  return null;
}
canvas.addEventListener('mousedown', e=>{
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/(S.zoom||1), y=(e.clientY-rect.top)/(S.zoom||1);
  const b=hitTest(x,y);
  if(b){
    S.active.line=b.line; S.active.word=b.word;
    dragging={ox:x-b.x, oy:y-b.y, b};
    if(selection){ selection.classList.remove('hidden'); selection.style.left=(b.x*(S.zoom||1))+'px'; selection.style.top=(b.y*(S.zoom||1))+'px'; selection.style.width=(b.w*(S.zoom||1))+'px'; selection.style.height=(b.h*(S.zoom||1))+'px'; }
  } else {
    dragging=null; if(selection) selection.classList.add('hidden');
  }
});
canvas.addEventListener('mousemove', e=>{
  if(!dragging) return;
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/(S.zoom||1), y=(e.clientY-rect.top)/(S.zoom||1);
  const W=S.lines[dragging.b.line]?.[dragging.b.word];
  if(W){
    W.offset = {x:Math.round(x-dragging.ox), y:Math.round(y-dragging.oy)};
    draw();
  }
});
window.addEventListener('mouseup', ()=> dragging=null);


function textWidth(ctx, text){ return ctx.measureText(text).width; }
function fitLine(ctx, lineWords, maxWidth, baseSize, family){
  // Reduce sizes until total width fits (with word gaps)
  const sizes = lineWords.map(w=> w.size || baseSize);
  const texts = lineWords.map(w=> w.text || '');
  let total = ()=> texts.reduce((acc, t, i)=>{
    ctx.font = `${sizes[i]}px ${lineWords[i].font || family}`;
    return acc + textWidth(ctx,t) + (i? (S.font?.wgap||3):0);
  },0);
  let safe=0;
  while(total() > maxWidth && safe<100){
    for(let i=0;i<sizes.length;i++){ if(sizes[i]>6) sizes[i]-=1; }
    safe++;
  }
  for(let i=0;i<lineWords.length;i++){ lineWords[i].size = sizes[i]; }
}
function fitAll(){
  const c=$('canvas'); if(!c) return; const ctx=c.getContext('2d');
  const maxW = c.width;
  for(let li=0; li<S.lines.length; li++){
    const line = S.lines[li];
    fitLine(ctx, line, maxW, S.font.size, S.font.family);
  }
}


// Refit after structure changes
['addLine','addWord','deleteWord','fontSize','fontFamily','lineGap','wordGap'].forEach(id=>{
  bind(id, 'change', ()=>{ fitAll(); draw(); });
  bind(id, 'click',  ()=>{ fitAll(); draw(); });
});


// Post-draw: rebuild S.boxes if missing using rough metrics
if(typeof draw==='function'){
  const _origDraw = draw;
  draw = function(){
    _origDraw();
    try{
      const c=$('canvas'), ctx=c.getContext('2d');
      const boxes=[];
      let y=0;
      for(let li=0; li<S.lines.length; li++){
        const line=S.lines[li]; let x=0; const gap=S.font?.wgap||3; const lgap=S.font?.gap||2;
        for(let wi=0; wi<line.length; wi++){
          const W=line[wi];
          const size = W.size || S.font.size;
          const fam  = W.font || S.font.family;
          ctx.font = `${size}px ${fam}`;
          const w = Math.ceil(ctx.measureText(W.text||'').width);
          const h = Math.ceil(size*1.2);
          const bx = (W.offset?.x!=null)? W.offset.x : x;
          const by = (W.offset?.y!=null)? W.offset.y : y;
          boxes.push({x:bx,y:by,w:w,h:h,line:li,word:wi});
          x += w + gap;
        }
        y += (S.font?.size||22) + lgap;
      }
      S.boxes = boxes;
    }catch(_e){}
  }
}


S.animStyle='none';
bind('animStyle','change', e=>{ S.animStyle=e.target.value; draw(); });

S.animEffects = new Set();
function setFx(name, on){
  if(on) S.animEffects.add(name); else S.animEffects.delete(name);
  draw();
}
const fxIds = ['scroll','jitter','bounce','wave','typewriter','pulse','glitch','bubble','flicker'];
fxIds.forEach(n=>{
  const el = document.getElementById('fx-'+n);
  if(el){ el.addEventListener('change', e=> setFx(n, e.target.checked)); }
});
// Presets
function applyFxPreset(name){
  const presets = {
    subtle:     ['wave','flicker'],
    energetic:  ['bounce','jitter','pulse'],
    retro:      ['typewriter'],
    scroller:   ['scroll'],
    calm:       ['wave']
  };
  const list = presets[name] || [];
  S.animEffects = new Set(list);
  fxIds.forEach(n=>{ const el=document.getElementById('fx-'+n); if(el) el.checked = S.animEffects.has(n); });
  draw();
}
['subtle','energetic','retro','scroller','calm'].forEach(p=>{
  const el = document.getElementById('fxPreset-'+p);
  if(el){ el.addEventListener('click', e=>{ e.preventDefault(); applyFxPreset(p); }); }
});

S.fxIntensity = 0.6; // 0..1
const fxIntEl = document.getElementById('fxIntensity');
const fxIntVal = document.getElementById('fxIntensityVal');
if(fxIntEl){
  fxIntEl.addEventListener('input', e=>{
    const v = Math.max(0, Math.min(100, parseInt(e.target.value)||0));
    S.fxIntensity = v/100;
    if(fxIntVal) fxIntVal.textContent = v+'%';
    draw();
  });
  // sync visual to state on load
  fxIntEl.value = Math.round(S.fxIntensity*100);
  if(fxIntVal) fxIntVal.textContent = Math.round(S.fxIntensity*100)+'%';
}

// Advanced per-effect parameters
S.fxParams = {
  scroll: 20,
  jitter: 2.0,
  bounce: 2.0,
  wave:   2.0,
  pulse:  0.08,
  bubble: 0.12,
  glitch: 3.0,
  glitchF:18,
  flicker:0.3,
  typeCPS:12
};
function _bindFxSlider(id, key, mul=1){
  const el=document.getElementById(id), v=document.getElementById(id+'Val');
  if(!el) return;
  const sync=()=>{ if(v) v.textContent = el.value; };
  el.addEventListener('input', ()=>{ S.fxParams[key]=parseFloat(el.value)*mul; sync(); draw(); });
  el.value = S.fxParams[key]/mul;
  sync();
}
['fxScroll','fxJitter','fxBounce','fxWave','fxPulse','fxBubble','fxGlitch','fxGlitchF','fxFlicker','fxTypeCPS'].forEach(()=>{}); // placeholder to keep order
_bindFxSlider('fxScroll','scroll',1);
_bindFxSlider('fxJitter','jitter',1);
_bindFxSlider('fxBounce','bounce',1);
_bindFxSlider('fxWave','wave',1);
_bindFxSlider('fxPulse','pulse',1);
_bindFxSlider('fxBubble','bubble',1);
_bindFxSlider('fxGlitch','glitch',1);
_bindFxSlider('fxGlitchF','glitchF',1);
_bindFxSlider('fxFlicker','flicker',1);
_bindFxSlider('fxTypeCPS','typeCPS',1);

// Ensure owner presets inline are hidden on load unless unlocked
(function ownerPresetsInlineInit(){
  const el = $('ownerPresetsInline'); if(el) el.classList.add('hidden');
})();

bind('quickPresetBookTok','click', ()=>{
  S.lines = [[
    {text:'Will', color:'#FFFFFF', size:28, font:S.font.family},
    {text:'Wheelie', color:'#00ACFF', size:32, font:S.font.family},
    {text:'for', color:'#FFD700', size:24, font:S.font.family},
    {text:'BookTok', color:'#FF3CC8', size:30, font:S.font.family},
    {text:'Girlies', color:'#00D200', size:30, font:S.font.family}
  ]];
  if(typeof fitAll==='function') try{ fitAll(); }catch(_){}
  draw();
});

// Dynamic visibility of Advanced FX controls
const fxMap = {
  scroll:['fxScroll'],
  jitter:['fxJitter'],
  bounce:['fxBounce'],
  wave:['fxWave'],
  pulse:['fxPulse'],
  bubble:['fxBubble'],
  glitch:['fxGlitch','fxGlitchF'],
  flicker:['fxFlicker'],
  typewriter:['fxTypeCPS']
};
function updateFxVisibility(){
  let anyChecked=false;
  for(const key in fxMap){
    const box=$('fx-'+key);
    const on=box && box.checked;
    for(const id of fxMap[key]){
      const row=document.getElementById(id)?.closest('.row');
      if(row) row.style.display=on?'grid':'none';
    }
    if(on) anyChecked=true;
  }
  // auto-expand Advanced section
  const adv=document.getElementById('fxAdv');
  if(adv && adv.tagName==='DETAILS'){ adv.open = anyChecked; }
}
Object.keys(fxMap).forEach(k=>{
  const box=$('fx-'+k);
  if(box){ box.addEventListener('change', updateFxVisibility); }
});
updateFxVisibility();
