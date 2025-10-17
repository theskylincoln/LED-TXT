// v1.6.1 — self-contained, no external fonts; full animation set
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mobileInput = document.getElementById('mobileInput');
let zoom = 4, preview=false;

const state = {
  res:{w:96,h:128},
  bg:{mode:'solid', color:'#000000', image:null},
  lines:[], lineGap:2, wordSpacing:3,
  select:{li:-1,wi:-1},
  undo:[], redo:[]
};

// UI bindings
function setResolution(v){ const [w,h]=v.split('x').map(Number); state.res={w,h}; canvas.width=w; canvas.height=h; canvas.style.width=(w*zoom)+'px'; canvas.style.height=(h*zoom)+'px'; render(); }
document.getElementById('resolution').addEventListener('change',e=> setResolution(e.target.value));

document.querySelectorAll('.thumb').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const t=btn.dataset.type;
    if(t==='preset'){ const img=new Image(); img.onload=()=>{ state.bg={mode:'image',image:img}; render(); }; img.src=`assets/Preset_${btn.dataset.name}.png`; }
    if(t==='solid'){ state.bg.mode='solid'; render(); }
  });
});
document.getElementById('bgUpload').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return; const url=URL.createObjectURL(f); const img=new Image(); img.onload=()=>{ state.bg={mode:'image',image:img}; render(); }; img.src=url;
});

document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click',()=>{
  document.querySelectorAll('.panel').forEach(p=> p.style.display='none');
  const tgt=document.querySelector(t.dataset.target); if(tgt) tgt.style.display='block';
}));
document.querySelector('.tab[data-target="#secFont"]').click();

// Swatches
const swWrap=document.getElementById('swatches'); const bgWrap=document.getElementById('bgSwatches');
const defaultSw=['#2bd1ff','#36e05d','#ffd400','#ff63d1','#ff4444','#ffffff','#000000'];
const defaultBg=['#000000','#101010','#1e293b','#0f766e','#1e3a8a','#5b21b6','#7f1d1d'];

function addSwatchChip(container, hex, custom, onClick, onDelete){
  const chip=document.createElement('div'); chip.className='swatch-chip'+(custom?' custom':''); chip.style.background=hex; chip.title=hex;
  if(custom){ const x=document.createElement('span'); x.className='x'; x.textContent='x'; x.onclick=(e)=>{ e.stopPropagation(); onDelete&&onDelete(hex,chip);} ; chip.appendChild(x); }
  chip.onclick=()=> onClick && onClick(hex);
  container.appendChild(chip);
}
function buildTextSw(){ swWrap.innerHTML=''; defaultSw.forEach(h=> addSwatchChip(swWrap,h,false, (hex)=> applyTextColor(hex))); const custom=JSON.parse(localStorage.getItem('customSw')||'[]'); custom.forEach(h=> addSwatchChip(swWrap,h,true,(hex)=> applyTextColor(hex),(hex,node)=>{ let arr=JSON.parse(localStorage.getItem('customSw')||'[]'); arr=arr.filter(x=>x!==hex); localStorage.setItem('customSw', JSON.stringify(arr)); node.remove(); })); }
function buildBgSw(){ bgWrap.innerHTML=''; defaultBg.forEach(h=> addSwatchChip(bgWrap,h,false, (hex)=> applyBgColor(hex))); }
buildTextSw(); buildBgSw();

document.getElementById('addSwatch').onclick=()=>{ const v=document.getElementById('colorPicker').value; let arr=JSON.parse(localStorage.getItem('customSw')||'[]'); if(!arr.includes(v) && arr.length<5){ arr.push(v); localStorage.setItem('customSw', JSON.stringify(arr)); buildTextSw(); } };
document.getElementById('colorPicker').oninput=(e)=> applyTextColor(e.target.value);
document.getElementById('bgColorPicker').oninput=(e)=> applyBgColor(e.target.value);

function applyTextColor(hex){ const s=state.select; if(s.li<0) return; state.lines[s.li].words[s.wi].color=hex; render(); }
function applyBgColor(hex){ state.bg.mode='solid'; state.bg.color=hex; document.getElementById('solidSwatch').style.background=hex; render(); }

// Spacing
document.getElementById('lineGap').oninput=(e)=>{ state.lineGap=+e.target.value; centerAll(); };
document.getElementById('wordSpacing').oninput=(e)=>{ state.wordSpacing=+e.target.value; centerAll(); };
const preventCutoffEl = document.getElementById('preventCutoff');

// Alignment
let alignH='center', alignV='middle';
document.querySelectorAll('.alignH').forEach(b=> b.onclick=()=>{ alignH=b.dataset.h; document.querySelectorAll('.alignH').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.lines.forEach(l=>l.words.forEach(w=>w.manual=false)); centerAll(); });
document.querySelectorAll('.alignV').forEach(b=> b.onclick=()=>{ alignV=b.dataset.v; document.querySelectorAll('.alignV').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.lines.forEach(l=>l.words.forEach(w=>w.manual=false)); centerAll(); });
document.getElementById('alignManual').onclick=()=>{ const s=state.select; if(s.li<0) return; state.lines[s.li].words[s.wi].manual=true; render(); };
document.getElementById('alignReset').onclick=()=>{ state.lines.forEach(l=>l.words.forEach(w=>w.manual=false)); centerAll(); };

// Font
document.getElementById('fontFamily').onchange=(e)=>{ const s=state.select; if(s.li<0) return; state.lines[s.li].words[s.wi].font=e.target.value; render(); };
document.getElementById('fontSize').oninput=(e)=>{ const s=state.select; if(s.li<0) return; state.lines[s.li].words[s.wi].size=+e.target.value; centerAll(); };
document.getElementById('autoSize').onchange=()=> centerAll();

// Animations
const A = {
  pulse: {chk: id('pulseChk'), amt: id('pulseAmt'), speed: id('pulseSpeed')},
  flicker: {chk: id('flickerChk'), amt: id('flickerAmt'), jit: id('flickerJit')},
  bounce: {chk: id('bounceChk'), h: id('bounceH'), s: id('bounceS')},
  wave: {chk: id('waveChk'), a: id('waveA'), l: id('waveL'), s: id('waveS')},
  type: {chk: id('typeChk'), cps: id('typeCPS'), loop: id('typeLoop')},
  glitch: {chk: id('glitchChk'), f: id('glitchF'), m: id('glitchM')},
  bubble: {chk: id('bubbleChk'), sz: id('bubbleSz'), cad: id('bubbleCad')},
  fade: {chk: id('fadeChk'), p: id('fadeP'), floor: id('fadeFloor')},
  scroll: {dir: id('scrollDir'), speed: id('scrollSpeed'), whole: id('wholeWord')},
};
Object.values(A).forEach(obj=>{
  Object.values(obj).forEach(el=>{
    if(el && el.tagName) el.addEventListener('input', ()=> render());
    if(el && el.tagName==='SELECT') el.addEventListener('change', ()=> render());
  });
});

// Undo/Redo/Clear
const btnUndo = id('btnUndo'), btnRedo=id('btnRedo');
function pushUndo(){ state.undo.push(JSON.stringify(state,(k,v)=> (k==='undo'||k==='redo'||k==='image')?undefined:v)); if(state.undo.length>20) state.undo.shift(); state.redo.length=0; btnUndo.disabled=false; btnRedo.disabled=true; }
btnUndo.onclick=()=>{ if(!state.undo.length) return; const snap=state.undo.pop(); state.redo.push(JSON.stringify(state,(k,v)=> (k==='undo'||k==='redo'||k==='image')?undefined:v)); Object.assign(state, JSON.parse(snap)); btnUndo.disabled=state.undo.length===0; btnRedo.disabled=false; render(); };
btnRedo.onclick=()=>{ if(!state.redo.length) return; const snap=state.redo.pop(); state.undo.push(JSON.stringify(state,(k,v)=> (k==='undo'||k==='redo'||k==='image')?undefined:v)); Object.assign(state, JSON.parse(snap)); btnUndo.disabled=false; btnRedo.disabled=state.redo.length===0; render(); };
id('btnClear').onclick=()=>{ state.lines=[]; state.select={li:-1,wi:-1}; render(); };

// Add line
id('addLine').onclick=()=>{ pushUndo(); const y=state.lines.length? state.lines[state.lines.length-1].y + 14 + state.lineGap : 10; state.lines.push({y, words:[]}); state.select={li:state.lines.length-1, wi:-1}; centerAll(); };

// Typing + mobile keyboard
function ensureLine(){ if(!state.lines.length) state.lines.push({y:10,words:[]}); }
function focusMobile(){ mobileInput.value=''; mobileInput.style.left='0'; mobileInput.style.top='0'; mobileInput.focus(); }
canvas.addEventListener('pointerdown', e=>{
  const p=canvasPoint(e); const hit=hitTest(p.x,p.y);
  if(hit){ state.select=hit; render(); }
  else{ pushUndo(); ensureLine(); const li=state.lines.length-1; const w={text:'', x:p.x, y:state.lines[li].y, color:'#fff', font:getFont(), size:22, manual:false}; state.lines[li].words.push(w); state.select={li,wi:state.lines[li].words.length-1}; centerAll(); }
  focusMobile();
});
mobileInput.addEventListener('input', e=>{ const s=state.select; if(s.li<0) return; const w=state.lines[s.li].words[s.wi]; w.text += e.target.value; e.target.value=''; centerAll(); });
window.addEventListener('keydown', e=>{
  if(state.select.li<0) return;
  const w=state.lines[state.select.li].words[state.select.wi];
  if(e.key==='Backspace'){ e.preventDefault(); w.text=w.text.slice(0,-1); centerAll(); return; }
  if(e.key===' '){ e.preventDefault(); const m=measureWord(w); const x=w.x+m.w+state.wordSpacing; const nw={text:'', x, y:w.y, color:w.color, font:w.font, size:w.size, manual:false}; state.lines[state.select.li].words.splice(state.select.wi+1,0,nw); state.select.wi+=1; centerAll(); return; }
  if(e.key.length===1){ w.text+=e.key; centerAll(); }
});

// Dragging
let dragging=false, dragOff={x:0,y:0};
canvas.addEventListener('dblclick', e=>{ const p=canvasPoint(e); const hit=hitTest(p.x,p.y); if(hit){ state.select=hit; const w=state.lines[hit.li].words[hit.wi]; w.manual=true; dragging=true; dragOff.x=p.x-w.x; dragOff.y=p.y-w.y; }});
canvas.addEventListener('pointermove', e=>{ if(!dragging) return; const p=canvasPoint(e); const w=state.lines[state.select.li].words[state.select.wi]; w.x=Math.max(0,Math.min(state.res.w-1,Math.round(p.x-dragOff.x))); w.y=Math.max(0,Math.min(state.res.h-1,Math.round(p.y-dragOff.y))); render(); });
window.addEventListener('pointerup', ()=> dragging=false);

// Layout
function getFont(){ return document.getElementById('fontFamily').value || 'ui-monospace, monospace'; }
function measureWord(w){ ctx.font=`${w.size}px ${w.font||getFont()}`; const mw=Math.ceil(ctx.measureText(w.text||' ').width); return {w:mw, h:w.size}; }

let alignH='center', alignV='middle';
function centerAll(){
  const pad=2;
  let totalH=0, heights=[];
  for(const l of state.lines){ const lh=l.words.length? Math.max(...l.words.map(w=>w.size)) : 12; heights.push(lh); totalH += lh + state.lineGap; }
  if(totalH>0) totalH -= state.lineGap;
  let startY=pad;
  if(alignV==='middle') startY=Math.max(pad, Math.floor((state.res.h-totalH)/2));
  if(alignV==='bottom') startY=Math.max(pad, state.res.h-totalH-pad);
  let y=startY;
  state.lines.forEach((l,i)=>{
    const lh=heights[i]; l.y=y;
    let widths=[], totalW=0;
    for(let j=0;j<l.words.length;j++){ const mw=measureWord(l.words[j]).w; widths.push(mw); totalW += mw + (j<l.words.length-1? state.wordSpacing:0); }
    let startX=pad;
    if(alignH==='center') startX=Math.max(pad, Math.floor((state.res.w-totalW)/2));
    if(alignH==='right') startX=Math.max(pad, state.res.w-totalW-pad);
    let x=startX;
    l.words.forEach((w,j)=>{ if(!w.manual){ w.x=x; w.y=y; } x += widths[j] + (j<l.words.length-1? state.wordSpacing:0); });
    y += lh + state.lineGap;
  });
  render();
}

// Rendering
function renderBG(){
  if(state.bg.mode==='image' && state.bg.image){
    const iw=state.bg.image.width, ih=state.bg.image.height;
    const s=Math.min(canvas.width/iw, canvas.height/ih);
    const dw=Math.round(iw*s), dh=Math.round(ih*s);
    const dx=Math.floor((canvas.width-dw)/2), dy=Math.floor((canvas.height-dh)/2);
    ctx.drawImage(state.bg.image, dx,dy,dw,dh);
  }else{ ctx.fillStyle=state.bg.color||'#000'; ctx.fillRect(0,0,canvas.width,canvas.height); }
}

let lastTs=0, scrollX=0, scrollY=0, accX=0, accY=0, rafId=null;
function render(ts=0){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  renderBG();
  const dt=(ts-lastTs)/1000; lastTs=ts;
  const preventCut= document.getElementById('preventCutoff').checked;

  // animations
  const dir= document.getElementById('scrollDir').value, spd= +document.getElementById('scrollSpeed').value||20, whole= document.getElementById('wholeWord').checked;
  let allowScroll = true;
  if(preventCut){
    if(dir==='left' && avgWordWidth() > canvas.width) allowScroll=false;
    if((dir==='up'||dir==='down') && avgLineHeight() > canvas.height) allowScroll=false;
  }
  if(preview && dir!=='off' && allowScroll){
    if(dir==='left'){
      const step=spd*dt;
      if(whole){ accX += step; const wsize=avgWordWidth(); if(accX>=wsize){ scrollX += Math.floor(accX/wsize)*wsize; accX = accX%wsize; } }
      else scrollX += step;
    }else{
      const sgn=(dir==='up')? +1 : -1;
      const step=sgn*spd*dt;
      if(whole){ accY += Math.abs(step); const hsize=avgLineHeight(); if(accY>=hsize){ scrollY += Math.sign(step)*Math.floor(accY/hsize)*hsize; accY = accY%hsize; } }
      else scrollY += step;
    }
  }

  for(const l of state.lines){
    for(const w of l.words){
      drawWordAdvanced(w);
    }
  }
  drawSelection();
}

function drawWordAdvanced(w){
  const time=performance.now();
  const dir=document.getElementById('scrollDir').value;
  let x = w.x - (dir==='left'? scrollX:0);
  let y = w.y - ((dir==='up'||dir==='down')? scrollY:0);

  const tileX = canvas.width + state.wordSpacing + 10;
  const tileY = avgLineHeight() + state.lineGap;
  const tiles = (dir==='left'||dir==='up'||dir==='down') ? [-1,0,1] : [0];

  tiles.forEach(k=>{
    const rx = x + (dir==='left'? k*tileX : 0);
    const ry = y + ((dir==='up'||dir==='down')? k*tileY : 0);
    drawWordWithEffects(w, rx, ry, time);
  });
}

function drawWordWithEffects(w, x, y, time){
  const preventCut = document.getElementById('preventCutoff').checked;
  ctx.font = `${w.size}px ${w.font||getFont()}`;
  ctx.textBaseline='top';
  const text = w.text||'';

  // Controls
  const pulseOn=id('pulseChk').checked, pulseAmt=+id('pulseAmt').value/100, pulseSp=+id('pulseSpeed').value;
  const flickOn=id('flickerChk').checked, flickAmt=+id('flickerAmt').value/100, flickJit=+id('flickerJit').value/100;
  const bounceOn=id('bounceChk').checked, bounceH=+id('bounceH').value, bounceS=+id('bounceS').value;
  const waveOn=id('waveChk').checked, waveA=+id('waveA').value, waveL=+id('waveL').value, waveS=+id('waveS').value;
  const typeOn=id('typeChk').checked, cps=+id('typeCPS').value, loop=id('typeLoop').checked;
  const glitchOn=id('glitchChk').checked, gF=+id('glitchF').value/100, gM=+id('glitchM').value;
  const bubbleOn=id('bubbleChk').checked, bSz=+id('bubbleSz').value/100, bCad=+id('bubbleCad').value;
  const fadeOn=id('fadeChk').checked, fadeP=+id('fadeP').value, fadeFloor=+id('fadeFloor').value/100;

  // global effects
  let baseAlpha=1, baseScale=1;
  if(preview && fadeOn){ baseAlpha *= (fadeFloor + (1-fadeFloor)*(0.5+0.5*Math.sin(time/fadeP))); }
  if(preview && flickOn){ baseAlpha *= (0.8 + 0.2*Math.abs(Math.sin(time/50*(1+flickJit)))); }
  if(preview && pulseOn){ baseScale *= (1 + 0.15*pulseAmt*Math.sin(time/pulseSp)); }

  // Typewriter visibility
  const visibleChars = typeOn && preview ? Math.max(0, Math.floor((time/1000)*cps) % (loop? Math.max(1,text.length): (text.length+1))) : text.length;

  // Draw per-character for wave/bounce/bubble/glitch
  let cx=x;
  for(let i=0;i<text.length;i++){
    if(i>=visibleChars) break;
    const ch=text[i];
    const cw = Math.ceil(ctx.measureText(ch).width) || 1;
    let cy=y;

    if(preview && bounceOn){ cy += Math.round(bounceH * Math.abs(Math.sin((time + i*40)/bounceS))); }
    if(preview && waveOn){ cy += Math.round(waveA * Math.sin((i*(Math.PI*2/waveL)) + time/waveS)); }

    if(preventCut){
      if(cx<0 or cx+cw>canvas.width or cy<0 or cy+w.size>canvas.height){ cx += cw; continue; }
    }

    // bubble scale per char
    let scale=baseScale;
    if(preview && bubbleOn){ const phase=Math.sin((time + i*70)/bCad); scale *= (1 + bSz*phase*0.6); }

    ctx.save();
    ctx.globalAlpha=baseAlpha;
    ctx.fillStyle=w.color;
    if(scale!==1){ ctx.translate(cx,cy); ctx.scale(scale,scale); ctx.fillText(ch,0,0); }
    else{ ctx.fillText(ch,cx,cy); }

    if(preview && glitchOn && Math.random()<gF*0.05){
      const sliceY = cy + Math.floor(Math.random()*w.size*0.8);
      const sliceH = Math.max(1, Math.floor(Math.random()*3));
      const offs = (Math.random()<0.5?-1:1) * gM;
      const imgData = ctx.getImageData(cx, sliceY, Math.max(1,cw), sliceH);
      ctx.putImageData(imgData, cx+offs, sliceY);
    }
    ctx.restore();
    cx += cw;
  }
}

function avgWordWidth(){ let sum=0,c=0; for(const l of state.lines){ for(const w of l.words){ sum += measureWord(w).w + state.wordSpacing; c++; } } return c? sum/c : 16; }
function avgLineHeight(){ let sum=0,c=0; for(const l of state.lines){ sum += (l.words.length? Math.max(...l.words.map(w=>w.size)): 12) + state.lineGap; c++; } return c? sum/c : 16; }

// Selection UI
function drawSelection(){
  document.querySelectorAll('.sel,.delete-pill').forEach(el=>el.remove());
  const s=state.select; if(s.li<0){ document.querySelector('.inspector').classList.add('disabled'); return; }
  document.querySelector('.inspector').classList.remove('disabled');
  const l=state.lines[s.li]; const w=l.words[s.wi]; if(!w) return; const m=measureWord(w);
  const stage=document.querySelector('.stage'); const r=canvas.getBoundingClientRect(); const st=stage.getBoundingClientRect();
  const sel=document.createElement('div'); sel.className='sel'; sel.style.left=(r.left-st.left + w.x*zoom)+'px'; sel.style.top=(r.top-st.top + w.y*zoom)+'px'; sel.style.width=(m.w*zoom)+'px'; sel.style.height=(w.size*zoom)+'px';
  const del=document.createElement('button'); del.className='delete-pill'; del.textContent='Delete'; del.style.left=(r.left-st.left + (w.x+m.w)*zoom - 10)+'px'; del.style.top=(r.top-st.top + w.y*zoom - 14)+'px'; del.onclick=()=>{ l.words.splice(s.wi,1); if(!l.words.length) state.lines.splice(s.li,1); state.select={li:-1,wi:-1}; render(); };
  stage.append(sel,del);
}

// Preview loop
id('btnPreview').onclick=()=>{ preview=true; function loop(ts){ render(ts); rafId=requestAnimationFrame(loop);} if(!rafId) rafId=requestAnimationFrame(loop); };
id('btnEdit').onclick=()=>{ preview=false; if(rafId){ cancelAnimationFrame(rafId); rafId=null; } render(); };
let rafId=null;

// Zoom
id('zoomIn').onclick=()=>{ zoom=Math.min(12,zoom+1); setResolution(`${state.res.w}x${state.res.h}`); id('zoomPct').textContent=Math.round(zoom*25)+'%'; };
id('zoomOut').onclick=()=>{ zoom=Math.max(1,zoom-1); setResolution(`${state.res.w}x${state.res.h}`); id('zoomPct').textContent=Math.round(zoom*25)+'%'; };

// Utils
function id(s){ return document.getElementById(s); }
function canvasPoint(e){ const r=canvas.getBoundingClientRect(); return {x:Math.floor((e.clientX-r.left)/zoom), y:Math.floor((e.clientY-r.top)/zoom)}; }
function hitTest(x,y){ for(let li=0; li<state.lines.length; li++){ const line=state.lines[li]; for(let wi=0; wi<line.words.length; wi++){ const w=line.words[wi]; const m=measureWord(w); if(x>=w.x && x<=w.x+m.w && y>=w.y && y<=w.y+m.h){ return {li,wi}; } } } return null; }

// Init
(function init(){ setResolution('96x128'); document.getElementById('solidSwatch').style.background='#000'; centerAll(); })();
