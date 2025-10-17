
const S = {
  res:{w:128,h:96},
  lines:[[ {text:"Hello", color:"#FFFFFF", size:22, font:"Monospace", offset:{x:2,y:2}} ]],
  font:{family:"Monospace", size:22, gap:2, wgap:3},
  alignH:"left",
  bg:{type:"solid",color:"#000"},
  fxIntensity:0.6,
  active:{line:0,word:0},
  _phase:0
};

function $(id){return document.getElementById(id)}
function bind(id,ev,fn){const el=$(id); if(el) el.addEventListener(ev,fn);}

document.addEventListener('DOMContentLoaded',()=>{
  const c=$('canvas'); c.width=S.res.w; c.height=S.res.h;

  document.querySelectorAll('.bgTile').forEach(t=>t.addEventListener('click',onTile));
  bind('bgSolidColor','input',e=>{S.bg.color=e.target.value; $('bgColorChip').style.background=e.target.value; draw();});
  bind('resolutionSelect','change',e=>handleResolution(e.target.value));

  bind('alignH','change',e=>{S.alignH=e.target.value; draw();});
  bind('wordInput','input',e=>{const W=currentWord(); if(W){W.text=e.target.value; draw();}});
  bind('wordColor','input',e=>{const W=currentWord(); if(W){W.color=e.target.value; draw();}});
  bind('fontFamily','change',e=>{S.font.family=e.target.value; draw();});
  bind('fontSize','input',e=>{S.font.size=+e.target.value||22; draw();});
  bind('lineGap','input',e=>{S.font.gap=+e.target.value||2; draw();});
  bind('wordGap','input',e=>{S.font.wgap=+e.target.value||3; draw();});
  bind('autosize','change',draw);

  bind('addLine','click',()=>{S.lines.push([{text:"",color:"#fff",size:S.font.size,font:S.font.family,offset:{x:2,y:2}}]); S.active={line:S.lines.length-1,word:0}; $('wordInput').value=""; draw();});
  bind('addWord','click',()=>{const L=S.lines[S.active.line]||[]; L.push({text:"",color:"#fff",size:S.font.size,font:S.font.family,offset:{x:2,y:2}}); S.active.word=L.length-1; $('wordInput').value=""; draw();});
  bind('delWord','click',()=>{const L=S.lines[S.active.line]; if(!L) return; L.splice(S.active.word,1); S.active.word=Math.max(0,S.active.word-1); draw();});

  bind('fxIntensity','input',e=>{S.fxIntensity=parseFloat(e.target.value)||0.6; const pct=document.getElementById('fxPct'); if(pct) pct.textContent=Math.round(S.fxIntensity*100)+'%';});
  document.querySelectorAll('.fxrow').forEach(row=>{
    const chk=row.querySelector('input[type=checkbox]');
    const refresh=()=>row.classList.toggle('active',chk.checked);
    chk.addEventListener('change',refresh); refresh();
    row.querySelectorAll('input[type=number]').forEach(n=>n.addEventListener('input',draw));
  });

  bind('showAnim','click',()=>startAnim());
  bind('hideAnim','click',()=>stopAnim());

  bind('zoomIn','click',()=>zoom(1.2));
  bind('zoomOut','click',()=>zoom(1/1.2));

  // swatches
  const palette=['#00B2FF','#29FF60','#FFF200','#FF4DD2','#FF5757','#FFFFFF','#000000'];
  const sw=document.getElementById('swatches'); palette.forEach(col=>{const b=document.createElement('button'); b.className='swatch'; b.style.background=col; b.addEventListener('click',()=>{const W=currentWord(); if(W){W.color=col; document.getElementById('wordColor').value=col; draw();}}); sw.appendChild(b);});

  enableCanvasIME(); enableDrag($('canvas'));
  handleResolution('96x128'); draw();
});

function onTile(ev){
  const t=ev.currentTarget.getAttribute('data-tile'); document.getElementById('solidColorRow').classList.add('hidden');
  if(t==='preset1'){S.bg={type:'preset',preset:1};}
  else if(t==='preset2'){S.bg={type:'preset',preset:2};}
  else if(t==='solid'){S.bg={type:'solid',color:document.getElementById('bgSolidColor').value}; document.getElementById('solidColorRow').classList.remove('hidden');}
  else if(t==='custom'){alert('Custom background upload in a later step.');}
  draw();
}

function handleResolution(v){
  const map={'96x128':{w:128,h:96}, '64x64':{w:64,h:64}};
  S.res=map[v]||{w:128,h:96};
  const c=document.getElementById('canvas'); c.width=S.res.w; c.height=S.res.h;
  draw();
}

function enableCanvasIME(){
  const c=document.getElementById('canvas'), ime=document.getElementById('canvasIME');
  c.addEventListener('click',(e)=>{
    const r=c.getBoundingClientRect();
    ime.style.left=(e.clientX-r.left)+'px'; ime.style.top=(e.clientY-r.top)+'px';
    ime.classList.remove('hidden'); const W=currentWord(); ime.value=W?W.text:''; ime.focus();
  });
  ime.addEventListener('input',()=>{const W=currentWord(); if(W){W.text=ime.value; document.getElementById('wordInput').value=W.text; draw();}});
  ime.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); ime.classList.add('hidden');}});
}

function enableDrag(canvas){
  let drag=false,dx=0,dy=0;
  canvas.addEventListener('mousedown',e=>{
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
    W.offset={x:Math.round(mx+dx), y:Math.round(my+dy)}; draw();
  }
  function up(){drag=false;}
  document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
}

function currentWord(){ return S.lines[S.active.line]?.[S.active.word]; }

function draw(){
  const c=document.getElementById('canvas'); if(!c) return; const ctx=c.getContext('2d');
  // full reset
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  ctx.clearRect(0,0,c.width,c.height);

  // background
  if(S.bg.type==='solid'){ ctx.fillStyle=S.bg.color||'#000'; ctx.fillRect(0,0,c.width,c.height); }
  else if(S.bg.type==='preset'){
    if(S.bg.preset===1){ const g=ctx.createLinearGradient(0,0,0,c.height); g.addColorStop(0,'#0b0d16'); g.addColorStop(1,'#16213f'); ctx.fillStyle=g; ctx.fillRect(0,0,c.width,c.height); }
    else { const g=ctx.createLinearGradient(0,0,0,c.height); g.addColorStop(0,'#121212'); g.addColorStop(1,'#2d0030'); ctx.fillStyle=g; ctx.fillRect(0,0,c.width,c.height); }
  } else { ctx.fillStyle='#000'; ctx.fillRect(0,0,c.width,c.height); }

  // measure block for vertical centering
  const pad=2, t=S._phase||0, I=S.fxIntensity||0.6;
  let blockH=0, lineDims=[];
  for(const line of S.lines){
    let lw=0, lh=0; for(const W of line){ const size=W.size||S.font.size; ctx.font=size+'px '+(W.font||S.font.family); lw += ctx.measureText(W.text||'').width + (S.font.wgap||3); lh=Math.max(lh,size); }
    lw=Math.max(0,lw-(S.font.wgap||3));
    let scale=1; if(document.getElementById('autosize')?.checked && lw>c.width-2*pad && lw>0){ scale=(c.width-2*pad)/lw; }
    lineDims.push({lw,lh,scale}); blockH += lh*scale + (S.font.gap||2);
  }
  blockH=Math.max(0,blockH-(S.font.gap||2));
  let y=Math.max(pad, Math.floor((c.height-blockH)/2));

  for(let li=0; li<S.lines.length; li++){
    const line=S.lines[li], d=lineDims[li];
    let x=pad; if(S.alignH==='center') x=Math.max(pad, Math.floor((c.width-d.lw*d.scale)/2)); else if(S.alignH==='right') x=Math.max(pad, c.width-pad-d.lw*d.scale);

    for(let i=0;i<line.length;i++){
      const W=line[i]; const size=(W.size||S.font.size)*d.scale; ctx.font=size+'px '+(W.font||S.font.family);
      let ox=(S.alignH==='manual'?(W.offset?.x??x):x), oy=(S.alignH==='manual'?(W.offset?.y??y):y);
      const text=W.text||'';

      ctx.save(); ctx.globalAlpha=1;

      // minimal effects (pulse/flicker) to validate reset logic
      if(document.getElementById('fx-pulse')?.checked){ const p=(parseFloat(document.getElementById('fxPulse')?.value)||0.08)*I; ctx.translate(ox,oy); ctx.scale(1+p*Math.sin(t*3+i), 1+p*Math.sin(t*3+i)); ctx.fillStyle=W.color||'#fff'; ctx.textBaseline='top'; ctx.fillText(text,0,0); }
      else { ctx.fillStyle=W.color||'#fff'; ctx.textBaseline='top'; ctx.fillText(text,ox,oy); }

      if(document.getElementById('fx-flicker')?.checked){ const f=(parseFloat(document.getElementById('fxFlicker')?.value)||0.3)*I; ctx.globalAlpha=1-(0.5+0.5*Math.sin(t*20+i))*f; }
      ctx.restore();

      x += ctx.measureText(text).width*d.scale + (S.font.wgap||3)*d.scale;
    }
    y += d.lh*d.scale + (S.font.gap||2);
  }
}

let _raf=null;
function tick(){ S._phase+=0.02; draw(); _raf=requestAnimationFrame(tick); }
function startAnim(){ if(_raf===null){ _raf=requestAnimationFrame(tick);} }
function stopAnim(){ if(_raf!==null){ cancelAnimationFrame(_raf); _raf=null; } draw(); }

function zoom(mult){ const p=document.getElementById('zoomPct'); const cur=parseInt(p.textContent)||100; const nxt=Math.max(25,Math.min(400,Math.round(cur*mult))); p.textContent=nxt+'%'; document.getElementById('canvas').style.width=nxt+'%'; document.getElementById('canvas').style.height='auto'; }

// ===== Render GIF with options (FPS, Length, Filename) =====
function setUIBusy(busy, msg=''){
  const ctrls = document.querySelectorAll('.toolbar .btn, #renderOpts select, #renderOpts input');
  ctrls.forEach(el => el.disabled = !!busy);
  const s = document.getElementById('renderStatus');
  if (s) s.textContent = busy ? msg : '';
}
const MAX_FRAMES = 500;
async function renderGIF(){
  const c = document.getElementById('canvas'); if(!c) return;
  const fps = parseInt(document.getElementById('renderFps')?.value || '15', 10);
  const lengthSec = Math.min(20, Math.max(1, parseFloat(document.getElementById('renderLen')?.value || '8')));
  const totalFrames = Math.min(MAX_FRAMES, Math.floor(lengthSec * fps));
  const fileBase = (document.getElementById('renderName')?.value || 'led_backpack').trim() || 'led_backpack';

  const wasRunning = (_raf !== null);
  if (wasRunning) stopAnim();

  setUIBusy(True, `Rendering ${totalFrames} frames @ ${fps} fps…`);
  const gif = new GIF({ workers:2, quality:8, width:c.width, height:c.height, workerScript:'https://unpkg.com/gif.js.optimized/dist/gif.worker.js' });

  const phaseStep = 0.02, startPhase = S._phase || 0;
  for(let i=0;i<totalFrames;i++){
    S._phase = startPhase + i * phaseStep;
    draw();
    gif.addFrame(c, { copy: true, delay: Math.round(1000 / fps) });
    if (i % Math.max(1, Math.floor(totalFrames/10)) === 0){
      setUIBusy(true, `Rendering… ${Math.round((i/totalFrames)*100)}%`);
    }
  }
  gif.on('finished', (blob)=>{
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fileBase+'.gif'; a.click();
    if (wasRunning) startAnim();
    setUIBusy(false,'');
  });
  gif.render();
}
(function(){ const btn=document.getElementById('render'); if(btn){ btn.onclick=()=>{ renderGIF().catch(()=> setUIBusy(false,'')); }; } })();
