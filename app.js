const $=id=>document.getElementById(id);

function updateFxUI(){
  const pr=document.getElementById('rowPulse');
  const fr=document.getElementById('rowFlick');
  pr.style.display=$('fx-pulse').checked?'':'none';
  fr.style.display=$('fx-flicker').checked?'':'none';
}

const S = {
  res:{w:96,h:128},
  bg:{type:'preset', preset:1, color:'#000000'},
  lines:[[{text:'Hello', color:'#ffffff', size:22, font:'Monospace', offset:{x:4,y:4}}]],
  font:{family:'Monospace', size:22, gap:2, wgap:3},
  alignH:'left',
  active:{line:0, word:0},
  anim:{show:false},
  layout:[],
  _phase:0,
};

const SWATCHES = ['#00d1ff','#2ecc71','#1abc9c','#ffee55','#ff66cc','#ff4d4d','#ffffff','#e9eef8','#000000'];

function init(){
  // build color swatches
  const host=$('swatches');
  SWATCHES.forEach(c=>{
    const b=document.createElement('button'); b.style.background=c; b.title=c;
    b.addEventListener('click',()=>{ const W=currentWord(); if(W){W.color=c; draw();}});
    host.appendChild(b);
  });

  // bg tiles
  document.querySelectorAll('.bg-tile').forEach(btn=>btn.addEventListener('click', ()=>{
    const kind=btn.dataset.bg;
    if(kind==='preset1'){ S.bg={type:'preset', preset:1}; }
    else if(kind==='preset2'){ S.bg={type:'preset', preset:2}; }
    else if(kind==='solid'){ S.bg={type:'solid', color:$('solidBg').value}; }
    draw();
  }));
  $('solidBg').addEventListener('input',()=>{ if(S.bg.type==='solid'){ S.bg.color=$('solidBg').value; draw(); }});

  // resolution
  $('resPick').addEventListener('change', e=> handleResolution(e.target.value));

  // inspector
  $('alignH').addEventListener('change',e=>{S.alignH=e.target.value; draw();});
  $('wordInput').addEventListener('input',e=>{ const W=currentWord(); if(W){W.text=e.target.value; draw();}});
  $('fontSize').addEventListener('input',e=>{ const W=currentWord(); if(W){W.size=parseInt(e.target.value)||22; draw();}});
  $('lineGap').addEventListener('input',e=>{ S.font.gap=parseInt(e.target.value)||2; draw();});
  $('wordGap').addEventListener('input',e=>{ S.font.wgap=parseInt(e.target.value)||3; draw();});

  // add/remove
  $('addWord').addEventListener('click', ()=>{
    ensureActiveLine();
    const L=S.lines[S.active.line];
    L.push({text:'Word', color:'#ffffff', size:S.font.size, font:S.font.family, offset:{x:4,y:4}});
    S.active.word=L.length-1;
    $('wordInput').value='Word';
    draw();
  });
  $('addLine').addEventListener('click', ()=>{
    S.lines.push([{text:'Word', color:'#ffffff', size:S.font.size, font:S.font.family, offset:{x:4,y:4}}]);
    S.active.line=S.lines.length-1; S.active.word=0;
    $('wordInput').value='Word';
    draw();
  });
  $('delWord').addEventListener('click', ()=>{
    ensureActiveLine();
    const L=S.lines[S.active.line]; if(!L.length) return;
    L.splice(S.active.word,1);
    if(L.length===0){ S.lines.splice(S.active.line,1); S.active.line=Math.max(0,S.active.line-1); ensureActiveLine(); }
    S.active.word=0; draw();
  });

  // effects
  $('fx-pulse').addEventListener('change',()=>{updateFxUI(); draw();});
  $('fx-flicker').addEventListener('change',()=>{updateFxUI(); draw();});
  $('fxPulse').addEventListener('input',draw);
  $('fxFlicker').addEventListener('input',draw);

  // Show/Hide animation
  $('btnShow').addEventListener('click',()=>{S.anim.show=true;});
  $('btnHide').addEventListener('click',()=>{S.anim.show=false;});

  // zoom
  $('zPlus').addEventListener('click',()=>setZoom(1.15));
  $('zMinus').addEventListener('click',()=>setZoom(1/1.15));

  enableCanvasIME();
  handleResolution('96x128');
  updateFxUI();
  syncInspector();
  tick();
}

function ensureActiveLine(){ if(!S.lines[S.active.line]) S.lines[S.active.line]=[]; }
function currentWord(){ ensureActiveLine(); return S.lines[S.active.line][S.active.word]; }

function handleResolution(v){
  const map={'96x128':{w:96,h:128}, '64x64':{w:64,h:64}};
  S.res = map[v] || {w:96,h:128};
  const c=$('canvas'); c.width=S.res.w; c.height=S.res.h; c.style.width='100%'; c.style.height='auto';
  $('zoomPct').textContent='100%';
  draw(); requestAnimationFrame(draw);
}

function setZoom(mult){
  const c=$('canvas'); const cur=parseFloat($('zoomPct').textContent)||100;
  const next=Math.max(25, Math.min(400, Math.round(cur*mult)));
  $('zoomPct').textContent=next+'%';
  c.style.width=next+'%'; c.style.height='auto';
}

function tick(ts){ S._phase=((ts||0)/1000)||0; if(S.anim.show) draw(); requestAnimationFrame(tick); }

function draw(){
  const c=$('canvas'); if(!c) return; const ctx=c.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='source-over'; ctx.clearRect(0,0,c.width,c.height);

  // bg
  if(S.bg.type==='solid'){ ctx.fillStyle=S.bg.color||'#000'; ctx.fillRect(0,0,c.width,c.height); }
  else if(S.bg.type==='preset'){
    const g=ctx.createLinearGradient(0,0,0,c.height);
    if(S.bg.preset===1){ g.addColorStop(0,'#0b0d16'); g.addColorStop(1,'#16213f'); }
    else { g.addColorStop(0,'#121212'); g.addColorStop(1,'#2d0030'); }
    ctx.fillStyle=g; ctx.fillRect(0,0,c.width,c.height);
  } else { ctx.fillStyle='#000'; ctx.fillRect(0,0,c.width,c.height); }

  // layout
  const pad=2, autosize=$('autosize').checked; S.layout=[];
  const pulseOn=$('fx-pulse').checked, flickOn=$('fx-flicker').checked;
  const pAmt=parseFloat($('fxPulse').value)||0.08, fAmt=parseFloat($('fxFlicker').value)||0.3;
  let blockH=0, lineDims=[];
  for(const line of S.lines){
    let lw=0, lh=0, maxWord=0;
    for(const W of line){
      const size=W.size||S.font.size; ctx.font=size+'px '+(W.font||S.font.family);
      const ww=ctx.measureText(W.text||'').width;
      lw += ww + (S.font.wgap||3);
      maxWord=Math.max(maxWord, ww);
      lh=Math.max(lh,size);
    }
    lw=Math.max(0,lw-(S.font.wgap||3));
    let scale=1;
    const limit=c.width-2*pad;
    if(autosize && lw>limit && lw>0){ scale=limit/lw; }
    if(autosize && maxWord>limit){ scale=Math.min(scale, limit/maxWord); }
    lineDims.push({lw,lh,scale}); blockH += lh*scale + (S.font.gap||2);
  }
  blockH=Math.max(0,blockH-(S.font.gap||2));
  let y=Math.max(pad, Math.floor((c.height-blockH)/2));

  for(let li=0; li<S.lines.length; li++){
    const line=S.lines[li], d=lineDims[li]; let x=pad;
    if(S.alignH==='center') x=Math.max(pad, Math.floor((c.width-d.lw*d.scale)/2));
    else if(S.alignH==='right') x=Math.max(pad, c.width-pad-d.lw*d.scale);

    for(let wi=0; wi<line.length; wi++){
      const W=line[wi]; const size=(W.size||S.font.size)*d.scale;
      ctx.font=size+'px '+(W.font||S.font.family); ctx.textBaseline='top';
      const text=W.text||''; const w=ctx.measureText(text).width;
      let ox=(S.alignH==='manual'?(W.offset?.x??x):x), oy=(S.alignH==='manual'?(W.offset?.y??y):y);

      let alpha=1; if(flickOn){ alpha = 1 - fAmt*(0.5+0.5*Math.sin(S._phase*20 + wi + li*0.7)); alpha=Math.max(0.15,Math.min(1,alpha)); }
      ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=W.color||'#fff';
      if(pulseOn){ const s=1 + pAmt*Math.sin(S._phase*3 + wi*0.6); ctx.translate(ox,oy); ctx.scale(s,s); ctx.fillText(text,0,0); }
      else{ ctx.fillText(text,ox,oy); }
      ctx.restore();

      S.layout.push({line:li,word:wi,x:ox,y:oy,w:Math.max(6,Math.ceil(w)),h:Math.max(6,Math.ceil(size))});
      x += w + (S.font.wgap||3)*d.scale;
    }
    y += d.lh*d.scale + (S.font.gap||2);
  }
}

function syncInspector(){
  const W=currentWord(); if(!W) return;
  $('wordInput').value=W.text||'';
  $('fontSize').value=W.size||S.font.size;
}

function openIMEAt(px,py){
  const ime=$('canvasIME'); const wrap=document.querySelector('.preview-canvas-wrap');
  ime.style.left=px+'px'; ime.style.top=py+'px';
  ime.value=currentWord()?.text||''; ime.classList.remove('hidden'); ime.focus();
}

function enableCanvasIME(){
  const c=$('canvas'), ime=$('canvasIME');
  let lastTap=0, dragging=false, dragDX=0, dragDY=0;

  function pos(e){
    const r=c.getBoundingClientRect(); const cx=(e.touches?e.touches[0].clientX:e.clientX);
    const cy=(e.touches?e.touches[0].clientY:e.clientY);
    const mx=(cx-r.left)*(c.width/r.width), my=(cy-r.top)*(c.height/r.height);
    return {rect:r, cx, cy, mx, my};
  }
  function hit(mx,my){
    for(let i=S.layout.length-1;i>=0;i--){ const h=S.layout[i]; if(mx>=h.x&&mx<=h.x+h.w&&my>=h.y&&my<=h.y+h.h) return h; }
    return null;
  }

  c.addEventListener('click',(e)=>{
    const p=pos(e); const h=hit(p.mx,p.my);
    const now=Date.now(), dbl=(now-lastTap)<350; lastTap=now;
    if(h){ S.active={line:h.line,word:h.word}; syncInspector(); draw();
      if(dbl){ const rx=p.cx-p.rect.left, ry=p.cy-p.rect.top; openIMEAt(rx,ry); }
    }
  });

  function startDrag(e){
    if(S.alignH!=='manual') return;
    const p=pos(e); const h=hit(p.mx,p.my);
    if(!h || h.line!==S.active.line || h.word!==S.active.word) return;
    const W=currentWord(); if(!W) return; dragging=true;
    dragDX=(W.offset?.x??h.x)-p.mx; dragDY=(W.offset?.y??h.y)-p.my; e.preventDefault();
  }
  function moveDrag(e){
    if(!dragging) return;
    const p=pos(e); const W=currentWord(); if(!W) return;
    W.offset={x:Math.round(p.mx+dragDX), y:Math.round(p.my+dragDY)}; draw();
  }
  function endDrag(){ dragging=false; }

  c.addEventListener('mousedown',startDrag);
  document.addEventListener('mousemove',moveDrag);
  document.addEventListener('mouseup',endDrag);
  c.addEventListener('touchstart',startDrag,{passive:false});
  document.addEventListener('touchmove',moveDrag,{passive:false});
  document.addEventListener('touchend',endDrag);

  ime.addEventListener('input',()=>{ const W=currentWord(); if(W){ W.text=ime.value; $('wordInput').value=W.text; draw(); } });
  ime.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); ime.classList.add('hidden'); } });
  ime.addEventListener('blur',()=> ime.classList.add('hidden'));
}

// stub render: download PNG of current canvas
window.addEventListener('load', ()=>{
  $('btnRender').addEventListener('click', ()=>{
    const a=document.createElement('a'); a.download=($('fileName').value||'led_backpack')+'.png';
    a.href=$('canvas').toDataURL('image/png'); a.click();
  });
});

window.addEventListener('load', init);
