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


// ===== AUTOSIZE LOGIC =====
S.autosize = { enable:true, mode:'line', pad:2, min:8, max:64 };
function _wordBaseSize(W){ if(typeof W._baseSize!=='number') W._baseSize=W.size||22; return W._baseSize; }
function measureLineWidth(ctx, line, scale=1){
  let w=0; for(const W of line){ const s=Math.max(S.autosize.min, Math.min(S.autosize.max, _wordBaseSize(W)*scale)); ctx.font=s+'px '+(W.font||S.font.family); w+=ctx.measureText(W.text||'').width+(S.font.wgap||3);} return Math.max(0,w-(S.font.wgap||3));
}
function measureBlockHeight(scale=1){
  let h=0; for(const line of S.lines){ let mh=0; for(const W of line){ const s=Math.max(S.autosize.min, Math.min(S.autosize.max, _wordBaseSize(W)*scale)); mh=Math.max(mh,s);} h+=mh+(S.font.gap||2);} return Math.max(0,h-(S.font.gap||2));
}
function computeGlobalScale(ctx,W,H){
  let maxW=0; for(const line of S.lines){ maxW=Math.max(maxW, measureLineWidth(ctx,line,1)); }
  const pad=S.autosize.pad|0, targetW=Math.max(1,W-pad*2), baseH=measureBlockHeight(1), targetH=Math.max(1,H-pad*2);
  let scale=Math.min(maxW?targetW/maxW:1, baseH?targetH/baseH:1);
  if(!isFinite(scale)||scale<=0) scale=1;
  const base=_wordBaseSize({size:S.font.size})||22;
  return Math.min(S.autosize.max/base, Math.max(S.autosize.min/base, scale));
}
function computeLineScale(ctx, line, W, H){
  const pad=S.autosize.pad|0, targetW=Math.max(1,W-pad*2), baseW=measureLineWidth(ctx,line,1);
  let scaleW=baseW?targetW/baseW:1;
  const linesCount=Math.max(1,S.lines.length), targetH=Math.max(1,(H-pad*2)/linesCount);
  let maxLineH=0; for(const Wd of line){ maxLineH=Math.max(maxLineH, _wordBaseSize(Wd)); }
  let scaleH=maxLineH?targetH/maxLineH:1;
  let scale=Math.min(scaleW, scaleH); if(!isFinite(scale)||scale<=0) scale=1;
  const base=_wordBaseSize({size:S.font.size})||22;
  return Math.min(S.autosize.max/base, Math.max(S.autosize.min/base, scale));
}
function _autosizeSyncFromUI(){
  S.autosize.enable = !!document.getElementById('autosizeEnable')?.checked;
  S.autosize.mode   = document.getElementById('autosizeMode')?.value || 'line';
  S.autosize.pad    = parseInt(document.getElementById('autosizePad')?.value||'2')||0;
  S.autosize.min    = parseInt(document.getElementById('autosizeMin')?.value||'8')||8;
  S.autosize.max    = parseInt(document.getElementById('autosizeMax')?.value||'64')||64;
}
['autosizeEnable','autosizeMode','autosizePad','autosizeMin','autosizeMax'].forEach(id=>{
  const el=document.getElementById(id); if(el){ el.addEventListener('input', ()=>{ _autosizeSyncFromUI(); draw(); }); }
});

// ===== ALIGNMENT & VERTICAL ALIGNMENT =====
S.align = S.align || 'left';   // left | center | right | manual
S.valign = S.valign || 'top';  // top | middle | bottom
function setAlign(v){
  S.align = v || 'left';
  const prev = document.querySelector('.preview');
  if(prev){
    prev.classList.toggle('can-drag', S.align==='manual');
    if(S.align!=='manual'){ prev.classList.remove('dragging'); }
  }
  draw();
}
function setVAlign(v){ S.valign = v || 'top'; draw(); }
document.addEventListener('DOMContentLoaded', ()=>{
  const hSel=document.getElementById('alignmentSelect'); if(hSel){ hSel.value=S.align; hSel.addEventListener('change', e=> setAlign(e.target.value)); }
  const vSel=document.getElementById('valignSelect'); if(vSel){ vSel.value=S.valign; vSel.addEventListener('change', e=> setVAlign(e.target.value)); }

  const c=document.getElementById('canvas'); const prev=document.querySelector('.preview');
  if(prev) prev.classList.toggle('can-drag', S.align==='manual');
  if(c){
    let dragging=false, dx=0, dy=0;
    c.addEventListener('mousedown', (e)=>{
      if(S.align!=='manual') return;
      const rect=c.getBoundingClientRect();
      const mx=(e.clientX-rect.left)*(c.width/rect.width);
      const my=(e.clientY-rect.top)*(c.height/rect.height);
      const ctx=c.getContext('2d'); const L=S.lines[S.active.line]||[];
      let best=Infinity, idx=0, cx=2;
      for(let i=0;i<L.length;i++){
        const W=L[i]; const size=W.size||22; ctx.font=size+'px '+(W.font||S.font.family);
        const ox=(W.offset?.x ?? cx), oy=(W.offset?.y ?? 2); const w=ctx.measureText(W.text||'').width, h=size;
        const cxm=ox+w/2, cym=oy+h/2; const d=(cxm-mx)*(cxm-mx)+(cym-my)*(cym-my);
        if(d<best){ best=d; idx=i; } cx=ox+w+(S.font.wgap||3);
      }
      S.active.word=idx; const W=S.lines[S.active.line]?.[idx]; if(!W) return;
      dragging=true; if(prev) prev.classList.add('dragging');
      dx=(W.offset?.x ?? 2) - mx; dy=(W.offset?.y ?? 2) - my;
    });
    document.addEventListener('mousemove', (e)=>{
      if(!dragging) return;
      const rect=c.getBoundingClientRect();
      const mx=(e.clientX-rect.left)*(c.width/rect.width);
      const my=(e.clientY-rect.top)*(c.height/rect.height);
      const W=S.lines[S.active.line]?.[S.active.word]; if(!W) return;
      W.offset={x:round(mx+dx), y:round(my+dy)}; draw();
    });
    const endDrag=()=>{ if(dragging){ dragging=false; if(prev) prev.classList.remove('dragging'); } };
    document.addEventListener('mouseup', endDrag); c.addEventListener('mouseleave', endDrag);
  }
});
function round(n){ return Math.round(n); }

function draw(){
  const c=document.getElementById('canvas'); if(!c) return;
  const ctx=c.getContext('2d'); c.width=S.res.w; c.height=S.res.h;

  if(S.bg?.type==='solid'){ ctx.fillStyle=S.bg.color||'#000'; ctx.fillRect(0,0,c.width,c.height); }
  else if(S.bg?.img){ ctx.drawImage(S.bg.img,0,0,c.width,c.height); }

  if(typeof _autosizeSyncFromUI==='function') _autosizeSyncFromUI();

  const t=(S._phase||0);
  const on=k=>document.getElementById('fx-'+k)?.checked;
  const intensity=S.fxIntensity||0.6;
  const pad=(S.autosize?.pad|0)||0;

  let globalScale=1;
  if(S.autosize?.enable && S.autosize.mode==='global'){ globalScale=computeGlobalScale(ctx,c.width,c.height); }

  // Precompute dims
  const dims=[]; let blockH=0;
  for(const line of S.lines){
    let lineScale=1;
    if(S.autosize?.enable){ lineScale=(S.autosize.mode==='line')? computeLineScale(ctx,line,c.width,c.height):globalScale; }
    let h=0,w=0;
    for(const W of line){
      const base=(typeof W._baseSize==='number'?W._baseSize:(W._baseSize=W.size||22));
      const size=Math.max(S.autosize.min,Math.min(S.autosize.max,base*lineScale));
      ctx.font=size+'px '+(W.font||S.font.family);
      h=Math.max(h,size);
      w+=ctx.measureText(W.text||'').width+(S.font.wgap||3);
    }
    w=Math.max(0,w-(S.font.wgap||3));
    dims.push({scale:lineScale,h:h,w:w});
    blockH+=h+(S.font.gap||2);
  }
  blockH=Math.max(0,blockH-(S.font.gap||2));

  let y=pad;
  if(S.valign==='middle'){ y=Math.max(pad, Math.floor((c.height-blockH)/2)); }
  else if(S.valign==='bottom'){ y=Math.max(pad, c.height-pad-blockH); }

  for(let li=0; li<S.lines.length; li++){
    const line=S.lines[li]; const d=dims[li];
    let x=pad;
    if(S.align==='center'){ x=Math.max(pad, Math.floor((c.width-d.w)/2)); }
    else if(S.align==='right'){ x=Math.max(pad, c.width-pad-d.w); }

    for(let i=0;i<line.length;i++){
      const W=line[i];
      const base=(typeof W._baseSize==='number'?W._baseSize:(W._baseSize=W.size||22));
      const size=Math.max(S.autosize.min,Math.min(S.autosize.max,base*d.scale));
      ctx.font=size+'px '+(W.font||S.font.family);
      ctx.textBaseline='top'; ctx.fillStyle=W.color||'#fff';

      let ox,oy;
      if(S.align==='manual'){ ox=(W.offset?.x ?? x); oy=(W.offset?.y ?? y); } else { ox=x; oy=y; }

      if(on('scroll')) ox-=(t*(parseFloat(document.getElementById('fxScroll')?.value)||20)*intensity)%(c.width+100);
      if(on('jitter')){ const j=(parseFloat(document.getElementById('fxJitter')?.value)||2)*intensity; ox+=Math.sin(t*17+i*13)*j; oy+=Math.cos(t*23+i*7)*j; }
      if(on('bounce')){ const b=(parseFloat(document.getElementById('fxBounce')?.value)||2)*intensity; oy+=Math.sin(t*2+i)*b; }
      if(on('wave')){ const w=(parseFloat(document.getElementById('fxWave')?.value)||2)*intensity; oy+=Math.sin((ox/10)+t*2)*w; }
      let scale=1;
      if(on('pulse')){ const p=(parseFloat(document.getElementById('fxPulse')?.value)||0.08)*intensity; scale=1+Math.sin(t*3+i)*p; }
      if(on('flicker')){ const f=(parseFloat(document.getElementById('fxFlicker')?.value)||0.3)*intensity; ctx.globalAlpha=1-(0.5+0.5*Math.sin(t*20+i))*f; }
      const cps=(parseFloat(document.getElementById('fxTypeCPS')?.value)||12)*intensity;
      const text=on('typewriter')?(W.text||'').slice(0,Math.max(0,Math.floor(t*cps))):(W.text||'');

      if(scale!==1){ ctx.save(); ctx.translate(ox,oy); ctx.scale(scale,scale); ctx.fillText(text,0,0); ctx.restore(); } else { ctx.fillText(text,ox,oy); }
      ctx.globalAlpha=1;

      const adv=ctx.measureText(W.text||'').width+(S.font.wgap||3);
      if(S.align!=='manual') x+=adv;
    }
    y+=d.h+(S.font.gap||2);
  }
}
