document.addEventListener('DOMContentLoaded', () => {
  const S = {
    resMode:'96x128', res:{w:96,h:128}, zoom:2,
    animated:false,
    bg:{type:'preset', name:'Preset_A', color:'#000000', img:null},
    lines:[ [{text:'WILL',color:'#00ACFF'}],
            [{text:'WHEELIE',color:'#00D200'}],
            [{text:'FOR',color:'#FFD700'}],
            [{text:'BOOKTOK',color:'#FF3CC8'}],
            [{text:'GIRLIES',color:'#FF2828'}] ],
    active:{line:0, word:0},
    font:{size:22, gap:2, wgap:3, family:'monospace'},
    anim:{by:4.0, sc:0.03, wx:0.8, wy:1.4},
    seconds:8, fps:15, rafId:null,
    boxes:[], lineMeta:[]
  };

  const $ = (id)=>document.getElementById(id);
  function bind(id, ev, fn){ const el=$(id); if(el) el.addEventListener(ev, fn); }
  function setVal(id,val){ const el=$(id); if(el) el.value=val; }
  function show(id){ const el=$(id); if(el) el.classList.remove('hidden'); }
  function hide(id){ const el=$(id); if(el) el.classList.add('hidden'); }

  const CANVAS=$('canvas'); const CTX=CANVAS.getContext('2d');
  const SEL=$('selection'); const grid=$('bgGrid');

  const TILES=[
    {id:'Preset_A', label:'Wheelie 96×128', file:'assets/Preset_A.png', mode:'96x128'},
    {id:'Preset_B', label:'2 Up 96×128',    file:'assets/Preset_B.png', mode:'96x128'},
    {id:'SOLID',    label:'Solid Color',    file:'',                     mode:'both', solid:true},
    {id:'CUSTOM',   label:'Custom Upload',  file:'',                     mode:'both', custom:true}
  ];

  // History
  const History = { past:[], future:[], max:100 };
  function cloneState(){
    return JSON.parse(JSON.stringify({
      resMode:S.resMode, res:S.res, bg:{type:S.bg.type, name:S.bg.name||null, color:S.bg.color||null},
      lines:S.lines, lineMeta:S.lineMeta, active:S.active, font:S.font, anim:S.anim, seconds:S.seconds, fps:S.fps
    }));
  }
  function pushHistory(){ History.past.push(cloneState()); if(History.past.length>History.max) History.past.shift(); History.future.length=0; }
  function restoreState(snap){
     Object.assign(S, snap);
     dprSetup(); setZoom(S.zoom); renderGrid(); draw(); syncInspector();
  }
  function undo(){ if(!History.past.length) return; const cur=cloneState(); const prev=History.past.pop(); History.future.push(cur); restoreState(prev); }
  function redo(){ if(!History.future.length) return; const cur=cloneState(); const next=History.future.pop(); History.past.push(cur); restoreState(next); }

  // Layout
  function ensureLineMeta(){ while(S.lineMeta.length < S.lines.length){ S.lineMeta.push({align:'center',gapBefore:0,gapAfter:0}); } }
  function measureWord(w){ const avg=Math.max(3, Math.floor(S.font.size*0.6)); return Math.max(avg, Math.floor(avg*(w.text?.length||1))); }
  function computeLayout(){
    ensureLineMeta(); S.boxes.length=0;
    const estLineH = S.font.size + S.font.gap;
    const totalH = estLineH * S.lines.length - S.font.gap;
    let startY = Math.floor((S.res.h - totalH)/2);
    for(let li=0; li<S.lines.length; li++){
      const meta=S.lineMeta[li];
      const line=S.lines[li];
      let widths=line.map(measureWord);
      let totalW=widths.reduce((a,b)=>a+b,0) + (line.length-1)*S.font.wgap;
      let x = meta.align==='left' ? 2 : meta.align==='right' ? (S.res.w-2-totalW) : Math.floor((S.res.w-totalW)/2);
      const y = startY + li*estLineH + (meta.gapBefore||0);
      for(let wi=0; wi<line.length; wi++){
        const w=line[wi];
        const box={line:li, word:wi, x, y, w:widths[wi], h:S.font.size};
        S.boxes.push(box);
        x += widths[wi] + S.font.wgap;
      }
    }
  }

  function dprSetup(){
    const dpr=Math.max(1,window.devicePixelRatio||1);
    CANVAS.width=Math.floor(S.res.w*dpr); CANVAS.height=Math.floor(S.res.h*dpr);
    CANVAS.style.width=S.res.w+'px'; CANVAS.style.height=S.res.h+'px';
    const wrap = CANVAS.parentElement; if(wrap){ wrap.style.aspectRatio = `${S.res.w} / ${S.res.h}`; }
    CTX.setTransform(dpr,0,0,dpr,0,0);
    $('resLabel').textContent=`${S.res.w} × ${S.res.h}`;
  }
  function setZoom(z){ S.zoom=Math.max(.5,Math.min(5,z)); CANVAS.style.width=(S.res.w*S.zoom)+'px'; CANVAS.style.height=(S.res.h*S.zoom)+'px'; $('zoomLabel').textContent=Math.round(S.zoom*100)+'%'; draw(); }

  function draw(){
    CTX.clearRect(0,0,S.res.w,S.res.h);
    if(S.bg.type==='solid'){ CTX.fillStyle=S.bg.color||'#0d1320'; CTX.fillRect(0,0,S.res.w,S.res.h); }
    else if(S.bg.img){ CTX.drawImage(S.bg.img,0,0,S.res.w,S.res.h); }
    else { CTX.fillStyle='#0d1320'; CTX.fillRect(0,0,S.res.w,S.res.h); }

    computeLayout();
    for(const box of S.boxes){
      const W=S.lines[box.line][box.word];
      CTX.fillStyle=W.color||'#fff';
      CTX.font=`${S.font.size}px ${S.font.family}`;
      CTX.textBaseline='top';
      CTX.fillText(W.text||'', box.x, box.y);
    }
    const nb=S.boxes.find(b=> b.line===S.active.line && b.word===S.active.word);
    if(nb && !S.animated){ placeSelection(nb.x, nb.y, nb.w, nb.h); } else { clearSelection(); }
  }

  function placeSelection(x,y,w,h){
    const cr=CANVAS.getBoundingClientRect();
    const sx=cr.width/S.res.w, sy=cr.height/S.res.h;
    SEL.classList.remove('hidden');
    SEL.style.left=(x*sx)+'px'; SEL.style.top=(y*sy)+'px';
    SEL.style.width=(w*sx)+'px'; SEL.style.height=(h*sy)+'px';
  }
  function clearSelection(){ SEL.classList.add('hidden'); }

  // Background grid
  function renderGrid(){
    if(!grid) return;
    grid.innerHTML='';
    const mode=S.resMode;
    TILES.filter(t=> t.mode==='both' || t.mode===mode).forEach(t=>{
      const div=document.createElement('div'); div.className='tile'; div.dataset.id=t.id;
      if(t.solid){ div.innerHTML=`<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-weight:800">Solid Color</div><div class="label">Solid Color</div>`; }
      else if(t.custom){ div.innerHTML=`<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#101726;color:#cfe9ff;font-weight:700">Custom Upload</div><div class="label">Custom Upload</div>`; }
      else { div.innerHTML=`<img class="thumb" src="${t.file}"><div class="label">${t.label}</div>`; }
      div.addEventListener('click', ()=> selectTile(t));
      grid.appendChild(div);
    });
    highlightSelected();
  }
  function highlightSelected(){
    document.querySelectorAll('.tile').forEach(el=>{
      el.classList.toggle('selected', (S.bg.type==='preset' && el.dataset.id===S.bg.name) || (S.bg.type==='solid' && el.dataset.id==='SOLID') || (S.bg.type==='custom' && el.dataset.id==='CUSTOM'));
    });
  }
  function selectTile(t){
    hide('solidWrap'); hide('customWrap');
    if(t.solid){ show('solidWrap'); S.bg={type:'solid', color:'#000000', img:null}; draw(); }
    else if(t.custom){ show('customWrap'); }
    else {
      const img=new Image();
      img.onload=()=>{ S.bg={type:'preset', name:t.id, img}; draw(); };
      img.onerror=()=>{ S.bg={type:'solid', color:'#000000', img:null}; draw(); };
      img.src=t.file;
    }
    highlightSelected(); draw();
  }

  // Editing
  function syncInspector(){
    try{
      const W=S.lines[S.active.line]?.[S.active.word];
      if(!W) return;
      $('wordText').value=W.text||'';
      $('wordColor').value=W.color||'#ffffff';
      $('fontSize').value=S.font.size;
      $('fontFamily').value=S.font.family;
      $('lineGap').value=S.font.gap;
      $('wordGap').value=S.font.wgap;
    }catch(_){}
  }

  // click-select & one-click inline edit
  function canvasScale(){ const r=CANVAS.getBoundingClientRect(); return {sx:r.width/S.res.w, sy:r.height/S.res.h, rect:r}; }
  CANVAS.addEventListener('mousedown', (e)=>{
    const {sx,sy,rect}=canvasScale(); const x=(e.clientX-rect.left)/sx, y=(e.clientY-rect.top)/sy;
    const hit=S.boxes.find(b=> x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h);
    if(hit){ pushHistory(); S.active.line=hit.line; S.active.word=hit.word; syncInspector(); placeSelection(hit.x,hit.y,hit.w,hit.h); }
  });
  CANVAS.addEventListener('mouseup', (e)=>{
    const {sx,sy,rect}=canvasScale(); const x=(e.clientX-rect.left)/sx, y=(e.clientY-rect.top)/sy;
    const hit=S.boxes.find(b=> x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h);
    if(!hit) return;
    const nb=hit;
    let input=document.createElement('input'); input.type='text'; input.className='inlineEditor'; input.value=S.lines[nb.line][nb.word].text||'';
    const wrap=CANVAS.parentElement;
    input.style.position='absolute'; input.style.left=(nb.x*sx)+'px'; input.style.top=(nb.y*sy)+'px';
    input.style.width=(Math.max(60, nb.w)*sx+24)+'px'; input.style.height=(S.font.size*sy+8)+'px';
    input.style.font=`${S.font.size*sy}px ${S.font.family}`;
    input.style.padding='2px 4px'; input.style.border='1px solid rgba(255,255,255,.4)'; input.style.borderRadius='6px';
    input.style.background='#0d1320'; input.style.color='#e9f3ff'; input.style.zIndex='5';
    wrap.appendChild(input); input.focus(); input.select();
    const commit=()=>{ if(!input.parentElement) return; pushHistory(); S.lines[nb.line][nb.word].text=input.value; wrap.removeChild(input); draw(); syncInspector(); };
    input.addEventListener('keydown', ev=>{ if(ev.key==='Enter') commit(); if(ev.key==='Escape'){ wrap.removeChild(input);} });
    input.addEventListener('blur', commit);
  });

  // Bind inputs
  bind('wordText','input', e=>{ const W=S.lines[S.active.line][S.active.word]; if(W){ pushHistory(); W.text=e.target.value; draw(); } });
  bind('wordColor','input', e=>{ const W=S.lines[S.active.line][S.active.word]; if(W){ pushHistory(); W.color=e.target.value; draw(); } });
  bind('fontSize','input', e=>{ pushHistory(); S.font.size=parseInt(e.target.value)||22; draw(); });
  bind('fontFamily','change', e=>{ pushHistory(); S.font.family=e.target.value||'monospace'; draw(); });
  bind('lineGap','input', e=>{ pushHistory(); S.font.gap=parseInt(e.target.value)||2; draw(); });
  bind('wordGap','input', e=>{ pushHistory(); S.font.wgap=parseInt(e.target.value)||3; draw(); });

  // Align
  bind('alignLeft','click', ()=>{ ensureLineMeta(); pushHistory(); S.lineMeta[S.active.line].align='left'; draw(); });
  bind('alignCenter','click', ()=>{ ensureLineMeta(); pushHistory(); S.lineMeta[S.active.line].align='center'; draw(); });
  bind('alignRight','click', ()=>{ ensureLineMeta(); pushHistory(); S.lineMeta[S.active.line].align='right'; draw(); });

  // Toolbar
  bind('modeHideAnim','click', ()=>{ stopAnim(); });
  bind('modeShowAnim','click', ()=>{ startAnim(); });
  bind('zoomIn','click', ()=> setZoom(S.zoom+0.25));
  bind('zoomOut','click', ()=> setZoom(S.zoom-0.25));
  bind('undoBtn','click', undo);
  bind('redoBtn','click', redo);

  // Actions
  bind('addLine','click', ()=>{ pushHistory(); S.lines.push([{text:'WORD', color:'#ffffff'}]); ensureLineMeta(); S.active.line=S.lines.length-1; S.active.word=0; draw(); syncInspector(); });
  bind('addWord','click', ()=>{ pushHistory(); if(S.lines.length===0){ S.lines.push([{text:'WORD',color:'#ffffff'}]); ensureLineMeta(); S.active.line=0; S.active.word=0; } else { S.lines[S.active.line].push({text:'WORD',color:'#ffffff'}); S.active.word=S.lines[S.active.line].length-1; } draw(); syncInspector(); });
  bind('deleteWord','click', ()=>{ const L=S.lines[S.active.line]; if(L && L.length){ pushHistory(); L.splice(S.active.word,1); S.active.word=Math.max(0,S.active.word-1); if(L.length===0){ S.lines.splice(S.active.line,1); S.active.line=Math.max(0,S.active.line-1); S.active.word=0; } draw(); syncInspector(); }});

  // Background inputs
  bind('solidPicker','input', e=>{ S.bg={type:'solid',color:e.target.value,img:null}; draw(); });
  bind('customFile','change', e=>{ const f=e.target.files?.[0]; if(!f) return; const url=URL.createObjectURL(f); const img=new Image(); img.onload=()=>{ S.bg={type:'custom',img}; draw(); }; img.src=url; });

  // Resolution
  bind('resMode','change', ()=>{
    S.resMode=$('resMode').value; $('customRes').classList.toggle('hidden', S.resMode!=='custom');
    if(S.resMode==='96x128'){ S.res={w:96,h:128}; }
    else if(S.resMode==='64x64'){ S.res={w:64,h:64}; }
    dprSetup(); setZoom(S.zoom); renderGrid(); draw();
  });
  bind('applyRes','click', ()=>{
    const w=parseInt($('customW').value)||96; const h=parseInt($('customH').value)||128;
    S.resMode='custom'; S.res={w,h}; dprSetup(); setZoom(S.zoom); renderGrid(); draw();
  });

  // Export/Import Preset
  bind('downloadPreset','click', (e)=>{
    e.preventDefault();
    const snapshot={resMode:S.resMode,res:S.res,bg:{type:S.bg.type,name:S.bg.name||null,color:S.bg.color||null},lines:S.lines,lineMeta:S.lineMeta,active:S.active,font:S.font,anim:S.anim,seconds:S.seconds,fps:S.fps};
    const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='led_preset.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
  });
  bind('uploadPresetBtn','click', ()=> $('uploadPreset')?.click());
  bind('uploadPreset','change', (e)=>{
    const f=e.target.files?.[0]; if(!f) return; const reader=new FileReader();
    reader.onload=()=>{ try{ const o=JSON.parse(reader.result); restoreState(Object.assign(cloneState(), o)); }catch(_){ alert('Invalid preset JSON'); } };
    reader.readAsText(f);
  });

  // Animation loop
  function loop(){ if(S.animated){ draw(); S.rafId=requestAnimationFrame(loop);} }
  function startAnim(){ if(!S.animated){ S.animated=true; loop(); } }
  function stopAnim(){ S.animated=false; if(S.rafId){ cancelAnimationFrame(S.rafId); S.rafId=null; } draw(); }

  // Owner unlock (About)
  const OWNER_KEY='abraham';
  let ownerUnlocked=false;
  function showOwnerModal(){ const m=$('ownerModal'); if(m){ m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); } }
  function hideOwnerModal(){ const m=$('ownerModal'); if(m){ m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); } }
  function toast(msg){
    let t=document.getElementById('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); t.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:24px;background:#0d1320;color:#e9f3ff;padding:10px 14px;border:1px solid rgba(255,255,255,.2);border-radius:10px;opacity:0;transition:.2s;pointer-events:none;z-index:9999';}
    t.textContent=msg; t.style.opacity='1'; setTimeout(()=>{ t.style.opacity='0'; }, 1600);
  }
  bind('ownerKeyBtn','click', unlockOwner);
  bind('ownerKeyInput','keydown', (e)=>{ if(e.key==='Enter') unlockOwner(); });
  function unlockOwner(){
    const val=$('ownerKeyInput')?.value?.trim().toLowerCase();
    if(val===OWNER_KEY){ ownerUnlocked=true; $('openOwnerPresets')?.classList.remove('hidden'); toast('Owner presets unlocked'); }
    else { toast('Invalid key'); }
  }
  bind('openOwnerPresets','click', showOwnerModal);
  bind('ownerClose','click', hideOwnerModal);
  bind('ownerPresetA','click', ()=>{ applyOwnerPreset('A'); hideOwnerModal(); });
  bind('ownerPresetB','click', ()=>{ applyOwnerPreset('B'); hideOwnerModal(); });

  function applyOwnerPreset(which){
    S.resMode='96x128'; S.res={w:96,h:128}; dprSetup(); setZoom(2);
    const img=new Image(); const file=which==='A'?'assets/Preset_A.png':'assets/Preset_B.png';
    img.onload=()=>{ S.bg={type:'preset',name:which==='A'?'Preset_A':'Preset_B',img}; draw(); };
    img.src=file;
    const A=[[{text:'WILL',color:'#00ACFF'}],[{text:'WHEELIE',color:'#00D200'}],[{text:'FOR',color:'#FFD700'}],[{text:'BOOKTOK',color:'#FF3CC8'}],[{text:'GIRLIES',color:'#FF2828'}]];
    const B=[[{text:'FREE',color:'#00ACFF'}],[{text:'RIDES',color:'#00D200'}],[{text:'FOR',color:'#FFD700'}],[{text:'BOOKTOK',color:'#FF3CC8'}],[{text:'GIRLIES',color:'#FF2828'}]];
    S.lines = which==='A'?A:B; ensureLineMeta(); for(let i=0;i<S.lines.length;i++){ S.lineMeta[i]={align:'center',gapBefore:0,gapAfter:0}; }
    S.active={line:0,word:0}; draw(); syncInspector();
  }

  // INIT
  (function init(){
    try{
      setVal('resMode','96x128');
      dprSetup(); setZoom(2); renderGrid();
      const img=new Image(); img.onload=()=>{ S.bg={type:'preset',name:'Preset_A',img}; draw(); }; img.src='assets/Preset_A.png';
      syncInspector(); stopAnim();
    }catch(e){ console.error('Init error', e); }
  })();
});