/* compact app.js – see analysis block for features */
const $ = s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const state={mode:'edit',zoom:1,res:{w:96,h:128},bg:{type:'solid',color:'#000',image:null},
  lines:[{words:[{text:'Hello',color:'#fff'}],align:'center',manual:false,pos:{x:0,y:0}}],
  font:{family:'Monospace',size:22,autosize:true},spacing:{lineGap:2,word:8,preventCutoff:true},
  anim:{applyAll:true,scroll:{on:false,speed:3},pulse:{on:false,amt:60},flicker:{on:false,amt:40},bounce:{on:false,amt:6},wave:{on:false,amp:6,len:16},type:{on:false,speed:5}},
  selection:{line:0,word:0},history:[],future:[],session:{dontShowManual:false},swatches:null
};
function pushHistory(){state.history.push(JSON.stringify({lines:state.lines,font:state.font,spacing:state.spacing,anim:state.anim})); if(state.history.length>20)state.history.shift(); state.future.length=0; updateUndoRedo();}
function undo(){if(!state.history.length)return; state.future.push(JSON.stringify({lines:state.lines,font:state.font,spacing:state.spacing,anim:state.anim})); const o=JSON.parse(state.history.pop()); Object.assign(state,o); updateUndoRedo(); draw();}
function redo(){if(!state.future.length)return; state.history.push(JSON.stringify({lines:state.lines,font:state.font,spacing:state.spacing,anim:state.anim})); const o=JSON.parse(state.future.pop()); Object.assign(state,o); updateUndoRedo(); draw();}
function updateUndoRedo(){ $('#btnUndo').disabled=state.history.length===0; $('#btnRedo').disabled=state.future.length===0; }
const canvas=$('#preview'), ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false; const caret=$('#caret');

function setResolution(val){const [w,h]=val.split('x').map(Number); state.res={w,h}; canvas.width=w; canvas.height=h; buildThumbs(); draw();}
function buildThumbs(){const cont=$('#thumbs'); cont.innerHTML=''; const res=state.res.w+'x'+state.res.h; const arr=[];
  if(res==='96x128'){arr.push({k:'Preset_A',path:'assets/presets/96x128/Preset_A.png',thumb:'assets/thumbs/Preset_A_thumb.png'}); arr.push({k:'Preset_B',path:'assets/presets/96x128/Preset_B.png',thumb:'assets/thumbs/Preset_B_thumb.png'});}
  if(res==='64x64'){arr.push({k:'Preset_C',path:'assets/presets/64x64/Preset_C.png',thumb:'assets/thumbs/Preset_C_thumb.png'}); arr.push({k:'Preset_D',path:'assets/presets/64x64/Preset_D.png',thumb:'assets/thumbs/Preset_D_thumb.png'});}
  arr.push({k:'Solid',path:'solid',thumb:'assets/thumbs/Solid_thumb.png'}); arr.push({k:'Upload',path:'upload',thumb:'assets/thumbs/Upload_thumb.png'});
  for(const it of arr){const d=document.createElement('div'); d.className='thumb'; d.innerHTML=`<img src="${it.thumb}"/>`; d.title=it.k; d.onclick=()=>{
    $$('.thumb').forEach(t=>t.classList.remove('active')); d.classList.add('active');
    if(it.path==='solid'){state.bg={type:'solid',color:'#000',image:null}; draw();}
    else if(it.path==='upload'){const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=e=>{const f=e.target.files[0]; if(!f)return; const fr=new FileReader(); fr.onload=()=>{const img=new Image(); img.onload=()=>{state.bg={type:'image',image:img}; draw();}; img.src=fr.result;}; fr.readAsDataURL(f);}; inp.click();}
    else {const img=new Image(); img.onload=()=>{state.bg={type:'image',image:img}; draw();}; img.src=it.path;}
  }; cont.appendChild(d);}}

function fontToCanvas(f){if(f==='Monospace')return'monospace'; if(f==='Sans')return'system-ui, sans-serif'; if(f==='Serif')return'serif'; return'monospace';}
function measureWord(w){ctx.font=`${state.font.size}px ${fontToCanvas(state.font.family)}`; const m=ctx.measureText(w.text||''); return Math.ceil(m.width);}
function autoLayout(){const pad=2; for(const line of state.lines){let total=0; for(let i=0;i<line.words.length;i++){total+=measureWord(line.words[i]); if(i<line.words.length-1) total+=state.spacing.word;}
  if(state.font.autosize){let s=state.font.size; while(total>state.res.w-2*pad && s>6){s--; state.font.size=s; total=0; for(let i=0;i<line.words.length;i++){total+=measureWord(line.words[i]); if(i<line.words.length-1) total+=state.spacing.word;}}}
  if(!line.manual){ if(line.align==='center') line.pos.x=Math.floor((state.res.w-total)/2); if(line.align==='left') line.pos.x=pad; if(line.align==='right') line.pos.x=Math.max(pad,state.res.w-total-pad);}}
  let y=10; for(const line of state.lines){line.pos.y=y; y+=state.font.size+state.spacing.lineGap;}}
function drawBG(){ if(state.bg.type==='image' && state.bg.image){const iw=state.bg.image.width, ih=state.bg.image.height; const cw=state.res.w, ch=state.res.h; const ir=iw/ih, cr=cw/ch; let sw,sh,sx,sy; if(ir>cr){sh=ih; sw=sh*cr; sx=(iw-sw)/2; sy=0;} else {sw=iw; sh=sw/cr; sx=0; sy=(ih-sh)/2;} ctx.drawImage(state.bg.image,sx,sy,sw,sh,0,0,cw,ch);} else {ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);}}
let t0=performance.now();
function draw(){drawBG(); ctx.save(); ctx.fillStyle='#fff'; ctx.textBaseline='top'; ctx.font=`${state.font.size}px ${fontToCanvas(state.font.family)}`; autoLayout();
  const t=(performance.now()-t0)/1000;
  for(let li=0; li<state.lines.length; li++){const line=state.lines[li]; let x=line.pos.x, y=line.pos.y; let yShift=0, scale=1, opacity=1, scrollX=0;
    if(state.anim.bounce.on) yShift+=Math.round(Math.sin(t*2)*state.anim.bounce.amt);
    if(state.anim.pulse.on) scale=1+0.01*state.anim.pulse.amt*Math.sin(t*2);
    if(state.anim.flicker.on) opacity=0.6+0.4*Math.abs(Math.sin(t*8+li));
    if(state.anim.scroll.on) scrollX=Math.round(-t*20*state.anim.scroll.speed);
    let cx=x+scrollX; ctx.globalAlpha=opacity;
    for(let wi=0; wi<line.words.length; wi++){const w=line.words[wi]; const wWidth=measureWord(w); ctx.save(); ctx.translate(0,yShift); ctx.translate(cx,y); ctx.scale(scale,scale);
      let visible=w.text.length; if(state.anim.type.on){const cps=state.anim.type.speed*2; visible=Math.max(1, Math.floor((t*cps)% (w.text.length+1)));}
      let accX=0; for(let i=0;i<w.text.length;i++){const ch=w.text[i]; if(i>=visible)break; const chW=ctx.measureText(ch).width; let chY=0; if(state.anim.wave.on){chY=Math.round(Math.sin((i*0.8)+(t*3))*state.anim.wave.amp);} ctx.fillStyle=w.color||'#fff'; ctx.fillText(ch,accX,chY); accX+=chW;}
      ctx.restore(); cx+=wWidth+(wi<line.words.length-1?state.spacing.word:0);
    } ctx.globalAlpha=1;}
  ctx.restore(); updateSelectionBox();}
function updateSelectionBox(){document.querySelector('.selection')?.remove(); document.querySelector('.deletePin')?.remove(); if(state.mode!=='edit')return;
  if(state.selection.line==null||state.selection.word==null)return; const line=state.lines[state.selection.line]; if(!line)return; const word=line.words[state.selection.word]; if(!word)return;
  ctx.font=`${state.font.size}px ${fontToCanvas(state.font.family)}`; let x=line.pos.x,y=line.pos.y; for(let i=0;i<state.selection.word;i++){x+=measureWord(line.words[i])+state.spacing.word;}
  const w=measureWord(word),h=state.font.size+2; const r=canvas.getBoundingClientRect(), wrap=$('#previewWrap').getBoundingClientRect(); const sx=r.width/canvas.width, sy=r.height/canvas.height;
  const sel=document.createElement('div'); sel.className='selection'; sel.style.left=(r.left+x*sx-wrap.left)+'px'; sel.style.top=(r.top+y*sy-wrap.top)+'px'; sel.style.width=(w*sx)+'px'; sel.style.height=(h*sy)+'px'; $('#previewWrap').appendChild(sel);
  const del=document.createElement('button'); del.className='deletePin'; del.textContent='× Delete'; del.style.left=(r.left+(x+w)*sx-wrap.left-52)+'px'; del.style.top=(r.top+(y-16)*sy-wrap.top)+'px';
  del.onclick=()=>{pushHistory(); line.words.splice(state.selection.word,1); if(!line.words.length){state.lines.splice(state.selection.line,1); state.selection.line=0; state.selection.word=0;} draw();}; $('#previewWrap').appendChild(del);}
canvas.addEventListener('mousedown',e=>{const r=canvas.getBoundingClientRect(); const x=(e.clientX-r.left)*(canvas.width/r.width); const y=(e.clientY-r.top)*(canvas.height/r.height); selectOrInsertAt(x,y);});
function selectOrInsertAt(x,y){let li=state.lines.findIndex(l=>y>=l.pos.y-4&&y<(l.pos.y+state.font.size+6)); if(li<0){state.lines.push({words:[{text:'',color:$('#colorPicker').value}],align:'center',manual:false,pos:{x:0,y:0}}); li=state.lines.length-1; state.selection.line=li; state.selection.word=0;}
  else state.selection.line=li; const line=state.lines[li]; let xCursor=line.pos.x; for(let wi=0;wi<line.words.length;wi++){const wWidth=measureWord(line.words[wi]); if(x<xCursor+wWidth){state.selection.word=wi; break;} xCursor+=wWidth+state.spacing.word; if(wi===line.words.length-1){state.selection.word=wi;}} state.mode='edit'; draw();}
document.addEventListener('keydown',e=>{if(state.mode!=='edit')return; const line=state.lines[state.selection.line]; if(!line)return; const word=line.words[state.selection.word]; if(!word)return;
  if(e.key==='Backspace'){e.preventDefault(); pushHistory(); word.text=word.text.slice(0,-1); if(word.text.length===0&&line.words.length>1){line.words.splice(state.selection.word,1); state.selection.word=Math.max(0,state.selection.word-1);} draw(); return;}
  if(e.key==='Enter'){e.preventDefault(); pushHistory(); const nl={words:[{text:'',color:$('#colorPicker').value}],align:line.align,manual:false,pos:{x:0,y:0}}; state.lines.splice(state.selection.line+1,0,nl); state.selection.line+=1; state.selection.word=0; draw(); return;}
  if(e.key===' '){e.preventDefault(); pushHistory(); line.words.splice(state.selection.word+1,0,{text:'',color:$('#colorPicker').value}); state.selection.word+=1; draw(); return;}
  if(e.key.length===1){pushHistory(); word.text+=e.key; draw();}
});
$('#btnInspector').onclick=()=>$('#inspector').classList.toggle('hidden');
$$('.acc').forEach(b=>b.onclick=()=>{$$('.panel').forEach(p=>p.classList.remove('open')); $('#acc-'+b.dataset.acc).classList.add('open');});
$('#fontFamily').onchange=e=>{pushHistory(); state.font.family=e.target.value; draw();}; $('#fontSize').oninput=e=>{pushHistory(); state.font.size=+e.target.value; draw();}; $('#autoSize').onchange=e=>{pushHistory(); state.font.autosize=e.target.checked; draw();};
const defaultSwatches=['#35bcff','#41e05e','#ffe14a','#ff66d9','#ff4d57','#ffffff','#000000']; function renderSwatches(){const b=$('#swatches'); b.innerHTML=''; (state.swatches||(state.swatches=[...defaultSwatches])).forEach((c,i)=>{const d=document.createElement('div'); d.className='swatch'+(i>=7?' custom':''); d.style.background=c; d.onclick=()=>{$('#colorPicker').value=c;}; if(i>=7){const del=document.createElement('button'); del.className='del'; del.textContent='×'; del.onclick=(e)=>{e.stopPropagation(); state.swatches.splice(i,1); renderSwatches();}; d.appendChild(del);} b.appendChild(d);});}
$('#addSwatch').onclick=()=>{const c=$('#colorPicker').value; if(!(state.swatches)) state.swatches=[...defaultSwatches]; if(state.swatches.length<12) state.swatches.push(c); renderSwatches();};
$('#colorPicker').oninput=e=>{const line=state.lines[state.selection.line]; if(!line)return; const word=line.words[state.selection.word]; if(!word)return; word.color=e.target.value; draw();}; renderSwatches();
$('#lineGap').oninput=e=>{pushHistory(); state.spacing.lineGap=+e.target.value; draw();}; $('#wordSpacing').oninput=e=>{pushHistory(); state.spacing.word=+e.target.value; draw();}; $('#preventCutoff').onchange=e=>{pushHistory(); state.spacing.preventCutoff=e.target.checked; draw();};
$('.align-row').addEventListener('click', e=>{if(!e.target.classList.contains('alignBtn'))return; const kind=e.target.dataset.align; const line=state.lines[state.selection.line]; if(!line)return;
  if(kind==='manual'){ if(!state.session.dontShowManual){$('#manualPopup').classList.remove('hidden'); $('#confirmManual').onclick=()=>{$('#manualPopup').classList.add('hidden'); finishManual();}; $('#closeManual').onclick=()=>$('#manualPopup').classList.add('hidden'); $('#dontShowManual').onchange=ev=>{state.session.dontShowManual=ev.target.checked;};} else finishManual(); }
  else {pushHistory(); line.align=kind; line.manual=false; draw();}
  function finishManual(){pushHistory(); line.align='manual'; line.manual=true; draw();}
});
$('#resetAlign').onclick=()=>{const line=state.lines[state.selection.line]; if(!line)return; pushHistory(); line.manual=false; line.align='center'; draw();};
$$('.anim-toggle').forEach(cb=>cb.onchange=e=>{const key=e.target.dataset.key; state.anim[key].on=e.target.checked; document.querySelector(`.anim-settings[data-for="${key}"]`).style.display=e.target.checked?'block':'none'; if(key==='scroll'&&state.anim.scroll.on){state.spacing.preventCutoff=true; $('#preventCutoff').checked=true;} draw();});
$('#scrollSpeed').oninput=e=>state.anim.scroll.speed=+e.target.value; $('#pulseAmt').oninput=e=>state.anim.pulse.amt=+e.target.value; $('#flickerAmt').oninput=e=>state.anim.flicker.amt=+e.target.value; $('#bounceAmt').oninput=e=>state.anim.bounce.amt=+e.target.value; $('#waveAmp').oninput=e=>state.anim.wave.amp=+e.target.value; $('#waveLen').oninput=e=>state.anim.wave.len=+e.target.value; $('#typeSpeed').oninput=e=>state.anim.type.speed=+e.target.value; $('#applyAll').onchange=e=>state.anim.applyAll=e.target.checked;
function setInspectorVisible(v){ if(v) $('#inspector').classList.remove('hidden'); else $('#inspector').classList.add('hidden'); } setInspectorVisible(true);
$('#btnPreview').onclick=()=>{state.mode='preview'; document.querySelector('.selection')?.remove(); document.querySelector('.deletePin')?.remove(); draw();};
$('#btnEdit').onclick=()=>{state.mode='edit'; draw();};
$('#btnClear').onclick=()=>{pushHistory(); state.lines=[{words:[{text:'',color:'#fff'}],align:'center',manual:false,pos:{x:0,y:0}}]; state.selection={line:0,word:0}; draw();};
$('#btnUndo').onclick=undo; $('#btnRedo').onclick=redo;
function setZoom(z){state.zoom=Math.min(4,Math.max(.25,z)); $('#zoomPct').textContent=Math.round(state.zoom*100)+'%'; $('#preview').style.transform=`scale(${state.zoom})`; } $('#zoomIn').onclick=()=>setZoom(state.zoom+.25); $('#zoomOut').onclick=()=>setZoom(state.zoom-.25);
let drag=null; canvas.addEventListener('mousemove',e=>{if(!drag)return; const r=canvas.getBoundingClientRect(); const x=(e.clientX-r.left)*(canvas.width/r.width); const y=(e.clientY-r.top)*(canvas.height/r.height); const line=state.lines[state.selection.line]; line.pos.x=Math.round(x-drag.dx); line.pos.y=Math.round(y-drag.dy); draw();}); canvas.addEventListener('mouseup',()=>drag=null); canvas.addEventListener('mouseleave',()=>drag=null);
canvas.addEventListener('dblclick',e=>{const line=state.lines[state.selection.line]; if(!line)return; if(line.manual){const r=canvas.getBoundingClientRect(); const x=(e.clientX-r.left)*(canvas.width/r.width); const y=(e.clientY-r.top)*(canvas.height/r.height); drag={dx:x-line.pos.x,dy:y-line.pos.y};}});
$('#resolution').onchange=e=>setResolution(e.target.value); setResolution('96x128'); buildThumbs(); pushHistory(); draw();
function tick(){ if(state.mode==='preview') draw(); requestAnimationFrame(tick);} tick();
