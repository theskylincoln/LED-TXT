window.S = window.S || {};
function $(id){ return document.getElementById(id); }
function bind(id, ev, fn){ const el=$(id); if(el) el.addEventListener(ev, fn); }

S.res = {w:128,h:96};
S.font = {family:'Monospace', size:22, wgap:3, gap:2};
S.lines = [[{text:'Hello', color:'#FFFFFF', size:22, font:'Monospace', offset:{x:2,y:2}}]];
S.bg = {type:'solid', color:'#000000', img:null};
S.active = {line:0, word:0};
S.animEffects = new Set();
S.fxIntensity = 0.6;

function draw(){
  const c = document.querySelector('#canvas'); if(!c) return;
  const ctx = c.getContext('2d'); c.width=S.res.w; c.height=S.res.h;
  if(S.bg.type==='solid'){ ctx.fillStyle=S.bg.color||'#000'; ctx.fillRect(0,0,c.width,c.height); }
  else if(S.bg.img){ ctx.drawImage(S.bg.img,0,0,c.width,c.height); }
  const L = S.lines[0]||[]; let x=2,y=2;
  for(const W of L){
    ctx.fillStyle=W.color||'#fff';
    ctx.font=(W.size||22)+'px '+(W.font||S.font.family);
    ctx.textBaseline='top';
    const ox = (W.offset?.x ?? x), oy = (W.offset?.y ?? y);
    ctx.fillText(W.text||'', ox, oy);
    x = ox + ctx.measureText(W.text||'').width + (S.font.wgap||3);
  }
}
let _raf=null; S.animated=false; S._phase=0;
function tick(){ S._phase+=0.02; draw(); if(S.animated) _raf=requestAnimationFrame(tick); }
function startAnim(){ if(!_raf){ S.animated=true; _raf=requestAnimationFrame(tick); } }
function stopAnim(){ S.animated=false; if(_raf){ cancelAnimationFrame(_raf); _raf=null; } draw(); }

document.addEventListener('DOMContentLoaded', ()=>{
  const resSel=$('resolutionSelect'); if(resSel) resSel.value='96x128';
  draw();

  bind('modeShowAnim','click', e=>{ e.preventDefault(); startAnim(); });
  bind('modeHideAnim','click', e=>{ e.preventDefault(); stopAnim(); });

  bind('zoomIn','click', ()=>{ const lbl=$('zoomLbl'); let z=parseInt((lbl?.textContent||'100%').replace('%',''))||100; z=Math.min(400,z+25); if(lbl) lbl.textContent=z+'%'; const cv=$('canvas'); if(cv){ cv.style.transform='scale('+(z/100)+')'; cv.style.transformOrigin='top left'; } });
  bind('zoomOut','click', ()=>{ const lbl=$('zoomLbl'); let z=parseInt((lbl?.textContent||'100%').replace('%',''))||100; z=Math.max(50,z-25); if(lbl) lbl.textContent=z+'%'; const cv=$('canvas'); if(cv){ cv.style.transform='scale('+(z/100)+')'; cv.style.transformOrigin='top left'; } });

  document.querySelectorAll('.bgTile[data-bg]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const name=el.getAttribute('data-bg');
      const img=new Image();
      img.onload=()=>{ S.bg={type:'image', name, img}; draw(); };
      img.src = name==='presetA' ? 'assets/Preset_A.png' : 'assets/Preset_B.png';
      document.querySelectorAll('.bgTile').forEach(t=> t.classList.toggle('active', t===el));
      $('bgSolidWrap')?.classList.add('hidden');
      const sel=$('bgType'); if(sel) sel.value='preset';
    });
  });
  bind('bgCustomUpload','change', e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const url=URL.createObjectURL(f); const img=new Image();
    img.onload=()=>{ S.bg={type:'image', name:f.name, img}; draw(); };
    img.src=url;
    document.querySelectorAll('.bgTile').forEach(t=> t.classList.remove('active'));
    $('bgSolidWrap')?.classList.add('hidden');
    const sel=$('bgType'); if(sel) sel.value='preset';
  });
  bind('bgType','change', e=>{
    if(e.target.value==='solid'){
      $('bgSolidWrap')?.classList.remove('hidden');
      S.bg={type:'solid', color:$('bgSolidColor')?.value||'#000000', img:null}; draw();
      document.querySelectorAll('.bgTile').forEach(t=> t.classList.remove('active'));
    }else{
      $('bgSolidWrap')?.classList.add('hidden');
    }
  });
  bind('bgSolidColor','input', e=>{ if(S.bg?.type==='solid'){ S.bg.color=e.target.value; draw(); } });

  bind('wordInput','input', e=>{ const W=S.lines[0][S.active.word]; if(W){ W.text=e.target.value; draw(); } });
  bind('wordColor','input', e=>{ const W=S.lines[0][S.active.word]; if(W){ W.color=e.target.value; draw(); } });
  const sw=$('colorSwatches'); if(sw){ sw.addEventListener('click', ev=>{ const btn=ev.target.closest('.swatch'); if(!btn) return; const col=btn.getAttribute('data-color'); if(!col) return; $('wordColor').value=col; const W=S.lines[0][S.active.word]; if(W){ W.color=col; draw(); } }); }
  bind('fontFamily','change', e=>{ S.font.family=e.target.value; const W=S.lines[0][S.active.word]; if(W){ W.font=e.target.value; draw(); } });
  bind('fontSize','input', e=>{ const W=S.lines[0][S.active.word]; if(W){ W.size=parseInt(e.target.value)||22; draw(); } });
  bind('lineGap','input', e=>{ S.font.gap=parseInt(e.target.value)||2; draw(); });
  bind('wordGap','input', e=>{ S.font.wgap=parseInt(e.target.value)||3; draw(); });
  bind('addWord','click', ()=>{ S.lines[0].push({text:'', color:'#FFFFFF', size:S.font.size, font:S.font.family, offset:{x:2,y:2}}); S.active.word=S.lines[0].length-1; draw(); });
  bind('addLine','click', ()=>{ S.lines.push([{text:'', color:'#FFFFFF', size:S.font.size, font:S.font.family, offset:{x:2,y:2}}]); S.active.line=S.lines.length-1; S.active.word=0; draw(); });
  bind('deleteWord','click', ()=>{ if(S.lines[0].length>0){ S.lines[0].splice(S.active.word,1); S.active.word=Math.max(0,S.active.word-1); draw(); } });

  bind('downloadJson','click', ()=>{
    const payload={version:1,res:S.res,bg:{type:S.bg?.type,name:S.bg?.name,color:S.bg?.color},lines:S.lines,font:S.font};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='led_preset.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  });
  bind('uploadJson','change', async e=>{
    const f=e.target.files?.[0]; if(!f) return;
    try{
      const data=JSON.parse(await f.text());
      if(data.res) S.res=data.res;
      if(data.bg){ S.bg = data.bg.type==='solid'? {type:'solid',color:data.bg.color||'#000000',img:null} : {...S.bg, ...data.bg}; }
      if(data.lines) S.lines=data.lines;
      document.querySelector('#canvas').width=S.res.w; document.querySelector('#canvas').height=S.res.h;
      draw();
    }catch(err){ alert('Invalid JSON'); }
  });

  const OWNER_KEY=(window.OWNER_KEY||'letmein');
  function unlockOwner(){ const val=$('ownerKeyInput')?.value||''; if(val===OWNER_KEY){ $('ownerPresetsInline')?.classList.remove('hidden'); $('ownerKeyInput')?.classList.add('hidden'); $('ownerKeyBtn')?.classList.add('hidden'); } }
  bind('ownerKeyBtn','click', e=>{ e.preventDefault(); unlockOwner(); });
  $('ownerKeyInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); unlockOwner(); }});
});


// === Reactive updates & background color swatches ===
function updateInspector(){
  const L = S.active.line, W = S.active.word;
  const word = (S.lines[L]||[])[W];
  if(word){
    const wi = $('wordInput'); if(wi && wi.value !== word.text) wi.value = word.text||'';
    const wc = $('wordColor'); if(wc && wc.value.toLowerCase() !== (word.color||'#ffffff').toLowerCase()) wc.value = word.color||'#FFFFFF';
    const ff = $('fontFamily'); if(ff && ff.value !== (word.font||S.font.family)) ff.value = word.font||S.font.family;
    const fs = $('fontSize'); if(fs && parseInt(fs.value)!==(word.size||22)) fs.value = word.size||22;
  }else{
    const wi=$('wordInput'); if(wi) wi.value='';
  }
}

function forceDraw(){ try{ draw(); }catch(e){ console.warn('draw failed', e); } }

// Word input reactive
['input','keyup','change','blur'].forEach(ev=>{
  $('wordInput')?.addEventListener(ev, (e)=>{ const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.text=e.target.value; forceDraw(); } });
  $('wordColor')?.addEventListener(ev, (e)=>{ const W=S.lines[S.active.line]?.[S.active.word]; if(W){ W.color=e.target.value; forceDraw(); } });
});

// Click canvas to select nearest word (basic hit test)
(function enableCanvasSelect(){
  const c=$('canvas'); if(!c) return;
  c.addEventListener('click', (e)=>{
    const rect=c.getBoundingClientRect();
    const x=Math.floor((e.clientX-rect.left) * (c.width/rect.width));
    const y=Math.floor((e.clientY-rect.top) * (c.height/rect.height));
    const ctx=c.getContext('2d');
    let best=Infinity, idx=0;
    const L=S.lines[S.active.line]||[];
    let cx=2, cy=2;
    for(let i=0;i<L.length;i++){
      const W=L[i];
      ctx.font=(W.size||22)+'px '+(W.font||S.font.family);
      const ox=(W.offset?.x ?? cx), oy=(W.offset?.y ?? cy);
      const w=ctx.measureText(W.text||'').width, h=(W.size||22);
      const centerX=ox+w/2, centerY=oy+h/2;
      const d=(centerX-x)**2 + (centerY-y)**2;
      if(d<best){ best=d; idx=i; }
      cx = ox + w + (S.font.wgap||3);
    }
    S.active.word=idx;
    updateInspector();
    forceDraw();
  });
})();

// Delete word button: always redraw and reseat selection
(function fixDelete(){
  const btn=$('deleteWord'); if(!btn) return;
  btn.addEventListener('click', ()=>{
    const L = S.active.line;
    if(!S.lines[L]) return;
    if(S.lines[L].length>0){
      S.lines[L].splice(S.active.word, 1);
      S.active.word = Math.max(0, S.active.word-1);
    }
    if(S.lines[L].length===0){
      // ensure at least one empty word exists for editing
      S.lines[L].push({text:'', color:'#FFFFFF', size:S.font.size, font:S.font.family, offset:{x:2,y:2}});
      S.active.word=0;
    }
    updateInspector();
    forceDraw();
  });
})();

// Background color swatches
(function bgSwatches(){
  const wrap = $('bgColorSwatches'); if(!wrap) return;
  wrap.addEventListener('click', (e)=>{
    const btn = e.target.closest('.swatch'); if(!btn) return;
    const col = btn.getAttribute('data-bgcolor'); if(!col) return;
    const inp = $('bgSolidColor'); if(inp) inp.value = col;
    S.bg = {type:'solid', color: col, img:null};
    // ensure bgType reflects solid and solid panel visible
    const sel=$('bgType'); if(sel) sel.value='solid';
    $('bgSolidWrap')?.classList.remove('hidden');
    forceDraw();
  });
})();

// Swatch clicks for word still apply & sync input
(function wordSwatches(){
  const sw=$('colorSwatches'); if(!sw) return;
  sw.addEventListener('click', (ev)=>{
    const btn=ev.target.closest('.swatch'); if(!btn) return;
    const col=btn.getAttribute('data-color'); if(!col) return;
    const W=S.lines[S.active.line]?.[S.active.word]; if(!W) return;
    W.color=col; const inp=$('wordColor'); if(inp) inp.value=col;
    forceDraw();
  });
})();

// Ensure inspector shows current selection on load
updateInspector();

