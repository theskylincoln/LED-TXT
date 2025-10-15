document.addEventListener('DOMContentLoaded', () => {
  const S = {
    resMode:'96x128', res:{w:96,h:128}, zoom:2,
    animated:false, // false = ⚡ Live (static), true = 🎯 Render (animated)
    bg:{type:'preset', name:'Preset_A', color:'#000000', img:null},
    lines:[ [{text:'WILL',color:'#00ACFF'}],
            [{text:'WHEELIE',color:'#00D200'}],
            [{text:'FOR',color:'#FFD700'}],
            [{text:'BOOKTOK',color:'#FF3CC8'}],
            [{text:'GIRLIES',color:'#FF2828'}] ],
    active:{line:0, word:0},
    font:{size:22, gap:2, wgap:3, family:'monospace'},
    anim:{by:4.0, sc:0.03, wx:0.8, wy:1.4},
    seconds:8, fps:15, rafId:null
  };

  const $ = (id)=>document.getElementById(id);
  // --- History (Undo/Redo) ---
  const History = { past:[], future:[], max:100 };
  function cloneState(){
    return JSON.parse(JSON.stringify({
      resMode:S.resMode, res:S.res, bg:{type:S.bg.type, name:S.bg.name||null, color:S.bg.color||null},
      lines:S.lines, lineMeta:S.lineMeta, active:S.active, font:S.font, anim:S.anim, seconds:S.seconds, fps:S.fps
    }));
  }
  function restoreState(snap){
    S.resMode=snap.resMode; S.res=snap.res;
    if(snap.bg?.type==='preset'){
      const img=new Image();
      const file = snap.bg.name==='Preset_A' ? 'assets/Preset_A.png' :
                   snap.bg.name==='Preset_B' ? 'assets/Preset_B.png' :
                   snap.bg.name==='Preset_C' ? 'assets/Preset_C.png' :
                   snap.bg.name==='Preset_D' ? 'assets/Preset_D.png' : '';
      if(file){
        img.onload=()=>{ S.bg={type:'preset',name:snap.bg.name,img}; draw(); };
        img.src=file;
      }else{
        S.bg={type:'solid',color:'#0d1320',img:null};
      }
    }else if(snap.bg?.type==='solid'){
      S.bg={type:'solid',color:snap.bg.color||'#0d1320',img:null};
    }else{
      S.bg={type:'custom', img:S.bg.img||null, name:null, color:null};
    }
    S.lines = snap.lines; S.lineMeta = snap.lineMeta||[];
    S.active = snap.active; S.font = snap.font; S.anim = snap.anim;
    S.seconds = snap.seconds; S.fps = snap.fps;
    dprSetup(); setZoom(S.zoom); renderGrid(); draw(); syncInspector();
  }
  function pushHistory(){
    History.past.push(cloneState());
    if(History.past.length>History.max) History.past.shift();
    History.future.length=0;
  }
  function undo(){
    if(History.past.length===0) return;
    const current = cloneState();
    const prev = History.past.pop();
    History.future.push(current);
    restoreState(prev);
  }
  function redo(){
    if(History.future.length===0) return;
    const current = cloneState();
    const next = History.future.pop();
    History.past.push(current);
    restoreState(next);
  }
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  window.addEventListener('keydown', (e)=>{
    const mac = navigator.platform.toUpperCase().includes('MAC');
    const mod = mac ? e.metaKey : e.ctrlKey;
    if(mod && !e.shiftKey && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
    if(mod && (e.shiftKey || e.key.toLowerCase()==='y')){ e.preventDefault(); redo(); }
  });

  // --- Owner Key Easter Egg ---
  const OWNER_KEY = 'abraham';
  function loadOwnerPreset(){
    // Example favorite preset tailored for Abraham
    S.resMode='96x128'; S.res={w:96,h:128};
    S.bg={type:'preset',name:'Preset_A', img: S.bg.img}; // keep current image if loaded; preset A by default
    S.lines=[
      [{text:'WILL',color:'#00ACFF'}],
      [{text:'WHEELIE',color:'#00D200'}],
      [{text:'FOR',color:'#FFD700'}],
      [{text:'BOOKTOK',color:'#FF3CC8'}],
      [{text:'GIRLIES',color:'#FF2828'}]
    ];
    ensureLineMeta(); for(let i=0;i<S.lines.length;i++){ S.lineMeta[i]={align:'center',gapBefore:0,gapAfter:0}; }
    S.active={line:0,word:0}; S.font={size:22,gap:2,wgap:3};
    dprSetup(); setZoom(2); renderGrid(); draw(); syncInspector();
    toast('Loaded Abraham preset');
  }
  let _typedBuffer='';
  window.addEventListener('keydown', (e)=>{
    if(e.key && e.key.length===1){
      _typedBuffer = (_typedBuffer + e.key.toLowerCase()).slice(-32);
      if(_typedBuffer.includes(OWNER_KEY)){ loadOwnerPreset(); }
    }
  });
  function toast(msg){
    let t=document.getElementById('toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
    t.textContent=msg; t.className='show'; setTimeout(()=> t.classList.remove('show'), 1600);
  }

  // --- New layout/hit-test state ---
  S.boxes = []; // [{line, word, x,y,w,h}]
  S.lineMeta = []; // per line: {align:'center'|'left'|'right', gapBefore:0, gapAfter:0}
  function ensureLineMeta(){
    while(S.lineMeta.length < S.lines.length){
      S.lineMeta.push({align:'center', gapBefore:0, gapAfter:0});
    }
  }

  // compute layout and fill S.boxes
  function computeLayout(){
    ensureLineMeta();
    S.boxes.length = 0;
    const padding = 2;
    // baseline y start: center stack around middle if no explicit offsets
    let y = Math.floor((S.res.h)/2);
    // compute total height to center lines if align center and no manual y
    const estLineH = S.font.size + S.font.gap;
    const totalH = estLineH * S.lines.length - S.font.gap;
    let startY = Math.floor((S.res.h - totalH)/2);
    if(startY < padding) startY = padding;

    for(let li=0; li<S.lines.length; li++){
      const meta = S.lineMeta[li] || {align:'center', gapBefore:0, gapAfter:0};
      const lineWords = S.lines[li];
      let lineY = startY + li * estLineH + (meta.gapBefore||0);
      // measure words
      let widths = lineWords.map(w=> measureWord(w));
      let totalW = widths.reduce((a,b)=>a+b, 0) + (lineWords.length-1)*S.font.wgap;
      let x;
      if(meta.align==='left'){ x = padding; }
      else if(meta.align==='right'){ x = S.res.w - padding - totalW; }
      else { x = Math.floor((S.res.w - totalW)/2); } // center
      for(let wi=0; wi<lineWords.length; wi++){
        const w = lineWords[wi];
        const wgapBefore = (w.gapBefore||0);
        const wgapAfter = (w.gapAfter||0);
        x += wgapBefore;
        const box = {line:li, word:wi, x, y:lineY, w:widths[wi], h:S.font.size};
        S.boxes.push(box);
        x += widths[wi] + S.font.wgap + wgapAfter;
      }
    }
  }

  function measureWord(w){
    // crude monospace-ish estimate proportional to text length and size
    const avg = Math.max(3, Math.floor(S.font.size*0.6));
    return Math.max(avg, Math.floor(avg * (w.text?.length||1)));
  }

  // hit-test
  function boxAtPoint(px,py){
    for(const b of S.boxes){
      if(px>=b.x && px<=b.x+b.w && py>=b.y && py<=b.y+b.h) return b;
    }
    return null;
  }

  // snapping
  function snapPos(x,y,w){
    const thresh = 4;
    let snapped=false;
    // center vertical line
    const cx = Math.floor(S.res.w/2);
    if(Math.abs((x+w/2) - cx) <= thresh){ x = Math.floor(cx - w/2); snapped=true; }
    // left/right margins
    const pad=2;
    if(Math.abs(x-pad)<=thresh){ x = pad; snapped=true; }
    if(Math.abs((x+w) - (S.res.w-pad))<=thresh){ x = S.res.w - pad - w; snapped=true; }
    // horizontal center
    const cy = Math.floor(S.res.h/2);
    if(Math.abs((y + S.font.size/2) - cy) <= thresh){ y = Math.floor(cy - S.font.size/2); snapped=true; }
    return {x,y,snapped};
  }

  // mouse interactions
  let drag = {on:false, idx:-1, offsetX:0, offsetY:0};
  CANVAS.addEventListener('mousedown', (e)=>{
    const rect = CANVAS.getBoundingClientRect();
    const sx = rect.width / S.res.w, sy = rect.height / S.res.h;
    const x = (e.clientX - rect.left)/sx, y=(e.clientY - rect.top)/sy;
    const hit = boxAtPoint(x,y);
    if(hit){ pushHistory();
      S.active.line = hit.line; S.active.word = hit.word; openInspector(); syncInspector();
      placeSelection(hit.x, hit.y, hit.w, hit.h);
      drag.on = true; drag.idx = S.boxes.findIndex(b=>b===hit);
      drag.offsetX = x - hit.x; drag.offsetY = y - hit.y;
    } else {
      clearSelection();
    }
  });
  window.addEventListener('mousemove', (e)=>{
    if(!drag.on) return;
    const rect = CANVAS.getBoundingClientRect();
    const sx = rect.width / S.res.w, sy = rect.height / S.res.h;
    let x = (e.clientX - rect.left)/sx - drag.offsetX;
    let y = (e.clientY - rect.top)/sy - drag.offsetY;
    const b = S.boxes[drag.idx];
    const snap = snapPos(x,y,b.w);
    const sel = $('selection');
    sel.classList.toggle('snap', snap.snapped);
    x = snap.x; y = snap.y;
    // bake position by converting to per-word gapBefore so layout keeps it
    const lineWords = S.lines[b.line];
    const meta = S.lineMeta[b.line];
    // recompute baseline x for current alignment
    let widths = lineWords.map(w=> measureWord(w));
    let totalW = widths.reduce((a,b)=>a+b,0) + (lineWords.length-1)*S.font.wgap;
    let baseX = meta.align==='left' ? 2 : meta.align==='right' ? (S.res.w-2-totalW) : Math.floor((S.res.w-totalW)/2);
    // compute desired gapBefore for this word relative to baseX + preceding words
    let before = baseX;
    for(let i=0;i<b.word;i++){ before += widths[i] + S.font.wgap + (lineWords[i].gapBefore||0) + (lineWords[i].gapAfter||0); }
    const neededGap = Math.max(-64, Math.min(128, Math.round(x - before)));
    lineWords[b.word].gapBefore = neededGap;
    // set line y by adjusting gapBefore on line (coarse)
    const estLineH = S.font.size + S.font.gap;
    const totalH = estLineH * S.lines.length - S.font.gap;
    let startY = Math.floor((S.res.h - totalH)/2);
    const baselineY = startY + b.line * estLineH + (meta.gapBefore||0);
    meta.gapBefore = Math.max(-64, Math.min(128, Math.round(y - (startY + b.line * estLineH))));
    computeLayout(); draw(); // refresh
    // update selection
    const nb = S.boxes.find(bb => bb.line===b.line && bb.word===b.word);
    if(nb) placeSelection(nb.x, nb.y, nb.w, nb.h);
  });
  window.addEventListener('mouseup', ()=>{ drag.on=false; $('selection').classList.remove('snap'); });
  // Single-click to edit (open inline input if click without drag)
  CANVAS.addEventListener('mouseup', (e)=>{
    if(drag.on){ return; }
    const rect = CANVAS.getBoundingClientRect();
    const sx = rect.width / S.res.w, sy = rect.height / S.res.h;
    const x = (e.clientX - rect.left)/sx, y=(e.clientY - rect.top)/sy;
    const hit = boxAtPoint(x,y);
    if(!hit) return;
    // avoid spawning if already an input present
    if(document.querySelector('.canvasWrap input[type="text"].inlineEditor')) return;
    S.active.line = hit.line; S.active.word = hit.word; openInspector(); syncInspector();
    const nb = S.boxes.find(bb => bb.line===hit.line && bb.word===hit.word);
    if(!nb) return;
    let input = document.createElement('input');
    input.type='text'; input.className='inlineEditor';
    input.value = S.lines[hit.line][hit.word].text || '';
    input.style.position='absolute';
    input.style.left = (nb.x * sx) + 'px';
    input.style.top = (nb.y * sy) + 'px';
    input.style.width = (Math.max(60, nb.w) * sx + 24) + 'px';
    input.style.height = (S.font.size * sy + 8) + 'px';
    input.style.transformOrigin='top left';
    input.style.zIndex = 5;
    input.style.padding = '2px 4px';
    input.style.borderRadius = '6px';
    input.style.border = '1px solid rgba(255,255,255,.4)';
    input.style.background = '#0d1320';
    input.style.color = '#e9f3ff';
    input.style.font = `${S.font.size * sy}px ${S.font.family}`;
    const wrap = CANVAS.parentElement;
    wrap.appendChild(input);
    input.focus(); input.select();
    const commit = ()=>{ if(!input.parentElement) return; S.lines[hit.line][hit.word].text = input.value; wrap.removeChild(input); draw(); syncInspector(); };
    input.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter'){ commit(); } if(ev.key==='Escape'){ wrap.removeChild(input); }});
    input.addEventListener('blur', commit);
  });


  // flip button + res label
  function updateResLabel(){
    $('resLabel').textContent = `${S.res.w} × ${S.res.h}`;
  }
  $('flipRes').addEventListener('click', ()=>{ pushHistory();
    const w=S.res.w, h=S.res.h;
    S.res={w:h, h:w}; S.resMode='custom';
    dprSetup(); setZoom(S.zoom); renderGrid(); draw(); updateResLabel();
  });

  const CANVAS=$('canvas'); const CTX=CANVAS.getContext('2d');
  const SEL=$('selection'); const grid=$('bgGrid');

  const TILES=[
    {id:'Preset_A', label:'Wheelie 96×128', file:'assets/Preset_A.png', mode:'96x128'},
    {id:'Preset_B', label:'2 Up 96×128',    file:'assets/Preset_B.png', mode:'96x128'},
    {id:'Preset_C', label:'Wheelie 64×64',  file:'assets/Preset_C.png', mode:'64x64'},
    {id:'Preset_D', label:'2 Up 64×64',     file:'assets/Preset_D.png', mode:'64x64'},
    {id:'SOLID',    label:'Solid Color',    file:'assets/Solid.png',    mode:'both'},
    {id:'CUSTOM',   label:'Custom Upload',  file:'assets/Custom.png',   mode:'both'}
  ];

  function dprSetup(){
    const dpr=Math.max(1,window.devicePixelRatio||1);
    CANVAS.width=Math.floor(S.res.w*dpr);
    CANVAS.height=Math.floor(S.res.h*dpr);
    CANVAS.style.width=S.res.w+'px';
    CANVAS.style.height=S.res.h+'px';
    const wrap = CANVAS.parentElement; if(wrap){ wrap.style.aspectRatio = `${S.res.w} / ${S.res.h}`; }
    CTX.setTransform(dpr,0,0,dpr,0,0);
  }
  function setZoom(z){
    S.zoom=Math.max(.5,Math.min(5,z));
    CANVAS.style.width=(S.res.w*S.zoom)+'px';
    CANVAS.style.height=(S.res.h*S.zoom)+'px';
    $('zoomLabel').textContent=Math.round(S.zoom*100)+'%';
    draw();
  }
  function placeSelection(x,y,w,h){
    const cr=CANVAS.getBoundingClientRect();
    const sx=cr.width/S.res.w, sy=cr.height/S.res.h;
    SEL.classList.remove('hidden');
    SEL.style.left=(x*sx)+'px'; SEL.style.top=(y*sy)+'px';
    SEL.style.width=(w*sx)+'px'; SEL.style.height=(h*sy)+'px';
    SEL.style.pointerEvents='none';
  }
  function clearSelection(){ SEL.classList.add('hidden'); }

  
  function draw(){
    CTX.clearRect(0,0,S.res.w,S.res.h);
    // background
    if(S.bg.type==='solid'){
      CTX.fillStyle=S.bg.color; CTX.fillRect(0,0,S.res.w,S.res.h);
    } else if(S.bg.img){
      CTX.drawImage(S.bg.img, 0, 0, S.res.w, S.res.h);
    } else {
      CTX.fillStyle='#0d1320'; CTX.fillRect(0,0,S.res.w,S.res.h);
    }
    // layout + text
    computeLayout();
    for(const box of S.boxes){
      const W = S.lines[box.line][box.word];
      CTX.fillStyle = W.color || '#fff';
      CTX.font = `${S.font.size}px ${S.font.family}`;
      CTX.textBaseline = 'top';
      CTX.fillText(W.text||'', box.x, box.y);
    }
    // refresh selection if matching active
    const nb = S.boxes.find(bb => bb.line===S.active.line && bb.word===S.active.word);
    if(nb && !S.animated){ placeSelection(nb.x, nb.y, nb.w, nb.h); } else { clearSelection(); }
  }
    else if(S.bg.img){ CTX.drawImage(S.bg.img,0,0,S.res.w,S.res.h); }
    else{ CTX.fillStyle='#0d1320'; CTX.fillRect(0,0,S.res.w,S.res.h); }

    CTX.textBaseline='top';
    CTX.font=`bold ${S.font.size}px sans-serif`;
    const totalH = S.lines.length*S.font.size + (S.lines.length-1)*S.font.gap;
    let y=(S.res.h-totalH)/2;
    const tSec = performance.now()/1000;

    S.lines.forEach((line, li)=>{
      const text=line.map(w=>w.text).join(' ');
      const tw=CTX.measureText(text).width;
      let x=(S.res.w-tw)/2;

      let offY=0;
      if(S.animated){ offY = S.anim.by*0.5*Math.sin(tSec*2*Math.PI + li); }

      line.forEach((w, wi)=>{
        CTX.fillStyle=w.color||'#fff';
        CTX.fillText(w.text,x,y+offY);
        x+=CTX.measureText(w.text+' ').width;
      });

      if(!S.animated && li===S.active.line){
        placeSelection((S.res.w-tw)/2,y,tw,S.font.size*1.25);
      }
      y+=S.font.size+S.font.gap;
    });

    if(S.animated){ clearSelection(); }
  }

  function loop(){ if(S.animated){ draw(); S.rafId=requestAnimationFrame(loop);} }
  function startAnim(){ if(!S.animated){ S.animated=true; loop(); } }
  function stopAnim(){ S.animated=false; if(S.rafId){ cancelAnimationFrame(S.rafId); S.rafId=null; } draw(); }

  function renderGrid(){
    grid.innerHTML='';
    const mode=S.resMode;
    TILES.filter(t=> t.mode==='both' || t.mode===mode).forEach(t=>{
      const div=document.createElement('div');
      div.className='tile'; div.dataset.id=t.id;
      if(t.id==='SOLID'){
        div.innerHTML = `<div class="thumb solid-thumb">Solid Color</div><div class="label">Solid Color</div>`;
      } else {
        div.innerHTML=`<img class="thumb" src="${t.file}" alt="${t.label}"><div class="label">${t.label}</div>`;
      }
      div.addEventListener('click',()=>selectTile(t));
      grid.appendChild(div);
    });
    highlightSelected();
  }
  function highlightSelected(){
    document.querySelectorAll('.tile').forEach(el=>{
      el.classList.toggle('selected', el.dataset.id===S.bg.name || (S.bg.type==='solid' && el.dataset.id==='SOLID') || (S.bg.type==='custom' && el.dataset.id==='CUSTOM'));
    });
  }
  function selectTile(t){
    $('solidWrap').classList.add('hidden');
    $('customWrap').classList.add('hidden');
    if(t.id==='SOLID'){
      S.bg={type:'solid',color:$('solidPicker').value,img:null};
      $('solidWrap').classList.remove('hidden');
    }else if(t.id==='CUSTOM'){
      S.bg={type:'custom',img:null};
      $('customWrap').classList.remove('hidden');
    }else{
      const img=new Image();
      img.onload=()=>{ S.bg={type:'preset',name:t.id,img}; draw(); };
      img.onerror=()=>{ console.warn('Missing asset:', t.file); S.bg={type:'solid',color:'#000',img:null}; draw(); };
      img.src=t.file;
    }
    highlightSelected(); draw();
  }

  $('solidPicker').addEventListener('input', e=>{ S.bg={type:'solid',color:e.target.value,img:null}; draw(); });
  $('customFile').addEventListener('change', e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const url=URL.createObjectURL(f);
    const img=new Image();
    img.onload=()=>{ S.bg={type:'custom',img}; draw(); };
    img.src=url;
  });

  $('resMode').addEventListener('change',()=>{
    S.resMode=$('resMode').value;
    $('customRes').classList.toggle('hidden', S.resMode!=='custom');
    if(S.resMode==='96x128'){ S.res={w:96,h:128}; }
    else if(S.resMode==='64x64'){ S.res={w:64,h:64}; }
    dprSetup(); setZoom(S.zoom); renderGrid(); draw();
  });
  $('applyRes').addEventListener('click',()=>{
    const w=parseInt($('customW').value)||96;
    const h=parseInt($('customH').value)||128;
    S.resMode='custom'; S.res={w,h}; dprSetup(); setZoom(S.zoom); renderGrid(); draw();
  });

  $('inspectorToggle').addEventListener('click',()=>{
    const insp=$('inspector');
    insp.classList.toggle('collapsed');
    $('inspectorToggle').textContent = insp.classList.contains('collapsed') ? '▸' : '▾';
  });
  function openInspector(){
    const insp=$('inspector');
    if(insp.classList.contains('collapsed')){
      insp.classList.remove('collapsed');
      $('inspectorToggle').textContent='▾';
    }
  }

  
$('addLine').addEventListener('click',()=>{ pushHistory(); 
    if(S.lines.length===0){ S.lines.push([{text:'WORD', color:'#ffffff'}]); S.active.line=0; S.active.word=0; ensureLineMeta(); S.lineMeta[0].align='center'; computeLayout(); draw(); syncInspector(); return; }

    S.lines.push([{text:'WORD',color:'#ffffff'}]);
    S.active.line=S.lines.length-1; S.active.word=0;
    openInspector(); syncInspector(); draw();
  });
  
$('addWord').addEventListener('click',()=>{ pushHistory(); 
    if(S.lines.length===0){ S.lines.push([{text:'WORD', color:'#ffffff'}]); S.active.line=0; S.active.word=0; ensureLineMeta(); S.lineMeta[0].align='center'; computeLayout(); draw(); syncInspector(); return; }

    S.lines[S.active.line].push({text:'WORD',color:'#ffffff'});
    S.active.word=S.lines[S.active.line].length-1;
    openInspector(); syncInspector(); draw();
  });
  $('deleteWord').addEventListener('click',()=>{
    const L=S.lines[S.active.line];
    if(L && L.length){ pushHistory(); L.splice(S.active.word,1); S.active.word=Math.max(0,S.active.word-1); draw(); syncInspector(); }
  });

  const bind=(id,fn)=>$(id).addEventListener('input',fn);
  bind('activeLine', e=>{ S.active.line=Math.max(0,Math.min(S.lines.length-1, parseInt(e.target.value)||0)); syncInspector(); draw(); });
  bind('activeWord', e=>{ const L=S.lines[S.active.line]; S.active.word=Math.max(0,Math.min(L.length-1, parseInt(e.target.value)||0)); syncInspector(); draw(); });
  bind('wordText', e=>{ const W=S.lines[S.active.line][S.active.word]; if(W){ pushHistory(); W.text=e.target.value; draw(); } });
  bind('wordColor', e=>{ const W=S.lines[S.active.line][S.active.word]; if(W){ pushHistory(); W.color=e.target.value; draw(); } });
  bind('fontSize', e=>{ pushHistory(); S.font.size=parseInt(e.target.value)||22; draw(); });
  bind('lineGap', e=>{ pushHistory(); S.font.gap=parseInt(e.target.value)||2; draw(); });
  bind('wordGap', e=>{ pushHistory(); S.font.wgap=parseInt(e.target.value)||3; draw(); });
  bind('lineGap', e=>{ pushHistory(); S.font.gap=parseInt(e.target.value)||2; draw(); });
  $('fontFamily').addEventListener('change', e=>{ S.font.family=e.target.value; draw(); });

  // Alignment buttons
  $('alignLeft').addEventListener('click', ()=>{ pushHistory(); ensureLineMeta(); S.lineMeta[S.active.line].align='left'; draw(); });
  $('alignCenter').addEventListener('click', ()=>{ pushHistory(); ensureLineMeta(); S.lineMeta[S.active.line].align='center'; draw(); });
  $('alignRight').addEventListener('click', ()=>{ pushHistory(); ensureLineMeta(); S.lineMeta[S.active.line].align='right'; draw(); });

  // Gap controls
        
  // Advanced export: single frame PNG
  $('downloadFrames').addEventListener('click', ()=>{
    try{
      const url = CANVAS.toDataURL('image/png');
      const a = document.createElement('a');
      a.href=url; a.download='frame.png'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 500);
    } catch(err){ alert('Export failed'); }
  });

  // Update res label on init + on res changes
  updateResLabel();

  bind('breathY', e=>{ S.anim.by=parseFloat(e.target.value)||0; });
  bind('scaleAmpl', e=>{ S.anim.sc=parseFloat(e.target.value)||0; });
  bind('waveX', e=>{ S.anim.wx=parseFloat(e.target.value)||0; });
  bind('waveY', e=>{ S.anim.wy=parseFloat(e.target.value)||0; });
  bind('seconds', e=>{ S.seconds=parseInt(e.target.value)||8; });
  bind('fps', e=>{ S.fps=parseInt(e.target.value)||15; });

  function syncInspector(){
    $('activeLine').value=S.active.line;
    $('activeWord').value=S.active.word;
    const W=S.lines[S.active.line][S.active.word];
    if(W){ $('wordText').value=W.text; $('wordColor').value=W.color||'#ffffff'; }
  }

  $('modeHideAnim').addEventListener('click',()=>{
    $('modeHideAnim').classList.add('active');
    $('modeShowAnim').classList.remove('active');
    stopAnim(); // static edit
  });
  $('modeShowAnim').addEventListener('click',()=>{
    $('modeShowAnim').classList.add('active');
    $('modeHideAnim').classList.remove('active');
    startAnim(); // animated
  });

  $('zoomIn').addEventListener('click',()=>setZoom(S.zoom+0.25));
  $('zoomOut').addEventListener('click',()=>setZoom(S.zoom-0.25));

  $('downloadPreset').addEventListener('click',(e)=>{
    e.preventDefault();
    const snapshot = {resMode:S.resMode, res:S.res, bg:S.bg, lines:S.lines, font:S.font, anim:S.anim, seconds:S.seconds, fps:S.fps};
    const blob = new Blob([JSON.stringify(snapshot,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href=url; a.download='led_preset.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 500);
  });
  $('uploadPresetBtn').addEventListener('click',()=> $('uploadPreset').click());
  $('uploadPreset').addEventListener('change',(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const o=JSON.parse(reader.result);
        Object.assign(S, { resMode:o.resMode||S.resMode, res:o.res||S.res, bg:o.bg||S.bg, lines:o.lines||S.lines, font:o.font||S.font, anim:o.anim||S.anim, seconds:o.seconds??S.seconds, fps:o.fps??S.fps });
        $('resMode').value=S.resMode; dprSetup(); setZoom(S.zoom); renderGrid(); draw(); syncInspector();
      }catch(err){ alert('Invalid preset JSON'); }
    };
    reader.readAsText(f);
  });

  
  (function init(){
    S.resMode='96x128'; S.res={w:96,h:128};
    $('resMode').value='96x128';
    dprSetup(); setZoom(2); renderGrid();
    const img=new Image(); img.onload=()=>{ S.bg={type:'preset',name:'Preset_A',img}; draw(); }; img.src='assets/Preset_A.png';
    syncInspector(); openInspector(); stopAnim();
  })();

});


  // --- Enhanced Owner Key: opens chooser modal with two presets ---
  function applyOwnerPreset(which){
    S.resMode='96x128'; S.res={w:96,h:128};
    const img = new Image();
    const file = which==='A' ? 'assets/Preset_A.png' : 'assets/Preset_B.png';
    img.onload = ()=>{ S.bg={type:'preset', name: which==='A'?'Preset_A':'Preset_B', img}; draw(); };
    img.src = file;

    const A = [
      [{text:'WILL',color:'#00ACFF'}],
      [{text:'WHEELIE',color:'#00D200'}],
      [{text:'FOR',color:'#FFD700'}],
      [{text:'BOOKTOK',color:'#FF3CC8'}],
      [{text:'GIRLIES',color:'#FF2828'}]
    ];
    const B = [
      [{text:'FREE',color:'#00ACFF'}],
      [{text:'RIDES',color:'#00D200'}],
      [{text:'FOR',color:'#FFD700'}],
      [{text:'BOOKTOK',color:'#FF3CC8'}],
      [{text:'GIRLIES',color:'#FF2828'}]
    ];
    S.lines = which==='A' ? A : B;
    ensureLineMeta(); for(let i=0;i<S.lines.length;i++){ S.lineMeta[i]={align:'center',gapBefore:0,gapAfter:0}; }
    S.active={line:0,word:0}; S.font={size:22,gap:2,wgap:3};
    dprSetup(); setZoom(2); renderGrid(); draw(); syncInspector();
    toast(`Loaded Abraham preset ${which}`);
  }
  function showOwnerModal(){
    const m=$('ownerModal'); m.classList.remove('hidden'); m.setAttribute('aria-hidden','false');
  }
  function hideOwnerModal(){
    const m=$('ownerModal'); m.classList.add('hidden'); m.setAttribute('aria-hidden','true');
  }
  $('ownerPresetA').addEventListener('click', ()=>{ applyOwnerPreset('A'); hideOwnerModal(); });
  $('ownerPresetB').addEventListener('click', ()=>{ applyOwnerPreset('B'); hideOwnerModal(); });
  $('ownerClose').addEventListener('click', hideOwnerModal);
  // Update the easter key to open the modal instead of auto-loading
  window.removeEventListener && window.removeEventListener('keydown', ()=>{}); // noop guard
  window.addEventListener('keydown', (e)=>{
    if(e.key && e.key.length===1){
      _typedBuffer = (_typedBuffer + e.key.toLowerCase()).slice(-32);
      if(_typedBuffer.includes(OWNER_KEY)){ showOwnerModal(); }
    }
  });


  // Inline edit: double-click places an input at word bbox
  

  // Improved inline edit: place in canvasWrap and scale with canvas
  function canvasScale(){ const r=CANVAS.getBoundingClientRect(); return {sx:r.width/S.res.w, sy:r.height/S.res.h, rect:r}; }
  CANVAS.addEventListener('dblclick', (e)=>{
    const {sx,sy,rect} = canvasScale();
    const x = (e.clientX - rect.left)/sx, y=(e.clientY - rect.top)/sy;
    const hit = boxAtPoint(x,y);
    if(!hit) return;
    S.active.line = hit.line; S.active.word = hit.word; openInspector(); syncInspector();
    const nb = S.boxes.find(bb => bb.line===hit.line && bb.word===hit.word);
    if(!nb) return;
    let input = document.createElement('input');
    input.type='text';
    input.value = S.lines[hit.line][hit.word].text || '';
    input.style.position='absolute';
    input.style.left = (nb.x * sx) + 'px';
    input.style.top = (nb.y * sy) + 'px';
    input.style.width = (Math.max(60, nb.w) * sx + 24) + 'px';
    input.style.height = (S.font.size * sy + 8) + 'px';
    input.style.transformOrigin='top left';
    input.style.zIndex = 5;
    input.style.padding = '2px 4px';
    input.style.borderRadius = '6px';
    input.style.border = '1px solid rgba(255,255,255,.4)';
    input.style.background = '#0d1320';
    input.style.color = '#e9f3ff';
    input.style.font = `${S.font.size * sy}px ${S.font.family}`;
    const wrap = CANVAS.parentElement;
    wrap.appendChild(input);
    input.focus(); input.select();
    const commit = ()=>{ pushHistory(); S.lines[hit.line][hit.word].text = input.value; wrap.removeChild(input); draw(); syncInspector(); };
    input.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter'){ commit(); } if(ev.key==='Escape'){ wrap.removeChild(input); }});
    input.addEventListener('blur', commit);
  });

  // --- Owner Key via input, persistent for session ---
  let ownerUnlocked = false;
  function showOwnerModal(){ const m=$('ownerModal'); m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); }
  function hideOwnerModal(){ const m=$('ownerModal'); m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); }
  function unlockOwner(){
    const val = $('ownerKeyInput')?.value?.trim().toLowerCase();
    if(val === OWNER_KEY){ ownerUnlocked = true; $('openOwnerPresets').classList.remove('hidden'); toast('Owner presets unlocked'); }
    else { toast('Invalid key'); }
  }
  $('ownerKeyBtn').addEventListener('click', unlockOwner);
  $('ownerKeyInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ unlockOwner(); }});
  $('openOwnerPresets').addEventListener('click', showOwnerModal);
  $('ownerClose').addEventListener('click', hideOwnerModal);
  $('ownerPresetA').addEventListener('click', ()=>{ applyOwnerPreset('A'); hideOwnerModal(); });
  $('ownerPresetB').addEventListener('click', ()=>{ applyOwnerPreset('B'); hideOwnerModal(); });
