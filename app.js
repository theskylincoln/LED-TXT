document.addEventListener('DOMContentLoaded',()=>{
  const S={resMode:'96x128',res:{w:96,h:128},zoom:2,animated:false,bg:{type:'preset',name:'Preset_A',img:null,color:'#000'},
    lines:[[{text:'WILL',color:'#00ACFF'}],[{text:'WHEELIE',color:'#00D200'}],[{text:'FOR',color:'#FFD700'}],[{text:'BOOKTOK',color:'#FF3CC8'}],[{text:'GIRLIES',color:'#FF2828'}]],
    active:{line:0,word:0},font:{size:22,gap:2,wgap:3,family:'monospace'},boxes:[],lineMeta:[],showSel:false};
  const $=id=>document.getElementById(id);
  function bind(id,ev,fn){const el=$(id); if(el) el.addEventListener(ev,fn);}
  const CANVAS=$('canvas'), CTX=CANVAS.getContext('2d'), SEL=$('selection'), GRID=$('bgGrid');
  const TILES=[
    {id:'Preset_A',label:'Preset A',file:'assets/Preset_A.png',mode:'96x128'},
    {id:'Preset_B',label:'Preset B',file:'assets/Preset_B.png',mode:'96x128'},
    {id:'SOLID',label:'Solid Color',file:'',mode:'both',solid:true},
    {id:'CUSTOM',label:'Custom Upload',file:'',mode:'both',custom:true},
  ];
  function dprSetup(){const dpr=Math.max(1,window.devicePixelRatio||1); CANVAS.width=S.res.w*dpr; CANVAS.height=S.res.h*dpr; CANVAS.style.width=S.res.w+'px'; CANVAS.style.height=S.res.h+'px'; CTX.setTransform(dpr,0,0,dpr,0,0);}
  function setZoom(z){S.zoom=Math.max(.5,Math.min(5,z)); CANVAS.style.width=(S.res.w*S.zoom)+'px'; CANVAS.style.height=(S.res.h*S.zoom)+'px'; $('zoomLabel').textContent=Math.round(S.zoom*100)+'%';}
  function ensureLineMeta(){while(S.lineMeta.length<S.lines.length) S.lineMeta.push({align:'center'});}
  function measureWord(w){const avg=Math.max(3,Math.floor(S.font.size*0.6)); return Math.max(avg,Math.floor(avg*(w.text?.length||1)));}
  function computeLayout(){ensureLineMeta(); S.boxes.length=0; const lh=S.font.size+S.font.gap; const total=lh*S.lines.length-S.font.gap; const startY=Math.floor((S.res.h-total)/2);
    for(let li=0;li<S.lines.length;li++){let y=startY+li*lh; const line=S.lines[li]; const widths=line.map(measureWord); const totalW=widths.reduce((a,b)=>a+b,0)+(line.length-1)*S.font.wgap;
      let x=S.lineMeta[li].align==='left'?2: S.lineMeta[li].align==='right'? (S.res.w-2-totalW) : Math.floor((S.res.w-totalW)/2);
      for(let wi=0;wi<line.length;wi++){const w=line[wi]; const box={line:li,word:wi,x,y,w:widths[wi],h:S.font.size}; S.boxes.push(box); x+=widths[wi]+S.font.wgap;}
    }}
  function draw(){CTX.clearRect(0,0,S.res.w,S.res.h); if(S.bg.type==='solid'){CTX.fillStyle=S.bg.color||'#0d1320'; CTX.fillRect(0,0,S.res.w,S.res.h);} else if(S.bg.img){CTX.drawImage(S.bg.img,0,0,S.res.w,S.res.h);} else {CTX.fillStyle='#0d1320'; CTX.fillRect(0,0,S.res.w,S.res.h);}
    computeLayout(); for(const b of S.boxes){const W=S.lines[b.line][b.word]; CTX.fillStyle=W.color||'#fff'; CTX.font=`${S.font.size}px ${S.font.family}`; CTX.textBaseline='top'; CTX.fillText(W.text||'',b.x,b.y);}
    const nb=S.boxes.find(bb=>bb.line===S.active.line&&bb.word===S.active.word); if(nb && !S.animated && S.showSel){placeSel(nb);} else {clearSel();} }
  function placeSel(nb){const r=CANVAS.getBoundingClientRect(); const sx=r.width/S.res.w, sy=r.height/S.res.h; SEL.classList.remove('hidden'); SEL.style.left=(nb.x*sx)+'px'; SEL.style.top=(nb.y*sy)+'px'; SEL.style.width=(nb.w*sx)+'px'; SEL.style.height=(nb.h*sy)+'px';}
  function clearSel(){SEL.classList.add('hidden');}
  function renderGrid(){GRID.innerHTML=''; const mode=S.resMode; TILES.filter(t=>t.mode==='both'||t.mode===mode).forEach(t=>{const div=document.createElement('div'); div.className='tile'; div.dataset.id=t.id;
    if(t.solid){div.innerHTML=`<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#000;color:#fff">Solid Color</div><div class="label">Solid</div>`;}
    else if(t.custom){div.innerHTML=`<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#0e1422;color:#cfe9ff">Custom Upload</div><div class="label">Custom</div>`;}
    else {div.innerHTML=`<img class="thumb" src="${t.file}"><div class="label">${t.label}</div>`;}
    div.addEventListener('click',()=>selectTile(t)); GRID.appendChild(div); });}
  function selectTile(t){S.showSel=false; if(t.solid){S.bg={type:'solid',color:'#000',img:null}; draw(); $('solidWrap').classList.remove('hidden'); $('customWrap').classList.add('hidden');}
    else if(t.custom){$('customWrap').classList.remove('hidden'); $('solidWrap').classList.add('hidden');}
    else {const img=new Image(); img.onload=()=>{S.bg={type:'preset',name:t.id,img}; draw();}; img.src=t.file; $('solidWrap').classList.add('hidden'); $('customWrap').classList.add('hidden');}}
  // canvas click -> select + inline edit
  CANVAS.addEventListener('mouseup',(e)=>{const r=CANVAS.getBoundingClientRect(); const sx=r.width/S.res.w, sy=r.height/S.res.h; const x=(e.clientX-r.left)/sx, y=(e.clientY-r.top)/sy;
    const hit=S.boxes.find(b=>x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h); if(!hit) return; S.active.line=hit.line; S.active.word=hit.word; S.showSel=true; draw();
    const nb=hit; const wrap=CANVAS.parentElement; const input=document.createElement('input'); input.type='text'; input.value=S.lines[nb.line][nb.word].text||'';
    input.style.position='absolute'; input.style.left=(nb.x*sx)+'px'; input.style.top=(nb.y*sy)+'px'; input.style.width=(Math.max(60,nb.w)*sx+24)+'px'; input.style.height=(S.font.size*sy+8)+'px';
    input.style.font=`${S.font.size*sy}px ${S.font.family}`; input.style.padding='2px 4px'; input.style.border='1px solid rgba(255,255,255,.4)'; input.style.borderRadius='6px'; input.style.background='#0d1320'; input.style.color='#e9f3ff'; input.style.zIndex='5';
    wrap.appendChild(input); input.focus(); input.select(); const commit=()=>{ if(!input.parentElement) return; S.lines[nb.line][nb.word].text=input.value; wrap.removeChild(input); draw(); };
    input.addEventListener('keydown',ev=>{ if(ev.key==='Enter') commit(); if(ev.key==='Escape'){ wrap.removeChild(input);} }); input.addEventListener('blur',commit);
  });
  // binds
  function valNum(id,def=0){const v=parseInt($(id).value); return isNaN(v)?def:v;}
  bind('zoomIn','click',()=>{setZoom(S.zoom+0.25)}); bind('zoomOut','click',()=>{setZoom(S.zoom-0.25)});
  bind('addLine','click',()=>{S.lines.push([{text:'WORD',color:'#ffffff'}]); S.active.line=S.lines.length-1; S.active.word=0; draw();});
  bind('addWord','click',()=>{if(!S.lines.length){S.lines.push([{text:'WORD',color:'#ffffff'}]); S.active.line=0;} S.lines[S.active.line].push({text:'WORD',color:'#ffffff'}); S.active.word=S.lines[S.active.line].length-1; draw();});
  bind('deleteWord','click',()=>{const L=S.lines[S.active.line]; if(L&&L.length){L.splice(S.active.word,1); S.active.word=Math.max(0,S.active.word-1); if(L.length===0){S.lines.splice(S.active.line,1); S.active.line=Math.max(0,S.active.line-1); S.active.word=0;} draw();}});
  bind('wordText','input',e=>{const W=S.lines[S.active.line]?.[S.active.word]; if(W){W.text=e.target.value; draw();}});
  bind('wordColor','input',e=>{const W=S.lines[S.active.line]?.[S.active.word]; if(W){W.color=e.target.value; draw();}});
  bind('fontSize','input',e=>{S.font.size=parseInt(e.target.value)||22; draw();});
  bind('fontFamily','change',e=>{S.font.family=e.target.value||'monospace'; draw();});
  bind('lineGap','input',e=>{S.font.gap=parseInt(e.target.value)||2; draw();});
  bind('wordGap','input',e=>{S.font.wgap=parseInt(e.target.value)||3; draw();});
  bind('alignLeft','click',()=>{ensureLineMeta(); S.lineMeta[S.active.line].align='left'; draw();});
  bind('alignCenter','click',()=>{ensureLineMeta(); S.lineMeta[S.active.line].align='center'; draw();});
  bind('alignRight','click',()=>{ensureLineMeta(); S.lineMeta[S.active.line].align='right'; draw();});
  bind('modeHideAnim','click',()=>{S.animated=false; draw();});
  bind('modeShowAnim','click',()=>{S.animated=true; draw();});
  bind('resMode','change',()=>{const v=$('resMode').value; S.resMode=v; if(v==='96x128') S.res={w:96,h:128}; else if(v==='64x64') S.res={w:64,h:64}; dprSetup(); setZoom(S.zoom); renderGrid(); draw(); $('customRes').classList.toggle('hidden', v!=='custom');});
  bind('applyRes','click',()=>{S.res={w:valNum('customW',96), h:valNum('customH',128)}; S.resMode='custom'; dprSetup(); setZoom(S.zoom); renderGrid(); draw();});
  bind('solidPicker','input',e=>{S.bg={type:'solid',color:e.target.value,img:null}; draw();});
  bind('customFile','change',e=>{const f=e.target.files && e.target.files[0]; if(!f) return; const url=URL.createObjectURL(f); const img=new Image(); img.onload=()=>{S.bg={type:'custom',img}; draw();}; img.src=url;});
  // owner
  const OWNER_KEY='abraham'; let ownerUnlocked=false;
  function showOwnerModal(){const m=$('ownerModal'); if(m){m.classList.remove('hidden'); m.setAttribute('aria-hidden','false');}}
  function hideOwnerModal(){const m=$('ownerModal'); if(m){m.classList.add('hidden'); m.setAttribute('aria-hidden','true');}}
  function unlockOwner(){const val=($('ownerKeyInput').value||'').trim().toLowerCase(); if(val===OWNER_KEY){ownerUnlocked=true; $('openOwnerPresets')?.classList.remove('hidden');} else {alert('Invalid key');}}
  bind('ownerKeyBtn','click',unlockOwner); bind('ownerKeyInput','keydown',e=>{if(e.key==='Enter') unlockOwner();});
  bind('openOwnerPresets','click',showOwnerModal); bind('ownerClose','click',hideOwnerModal);
  bind('ownerPresetA','click',()=>{applyOwnerPreset('A'); hideOwnerModal();}); bind('ownerPresetB','click',()=>{applyOwnerPreset('B'); hideOwnerModal();});
  function applyOwnerPreset(which){S.resMode='96x128'; S.res={w:96,h:128}; dprSetup(); setZoom(2); const img=new Image(); img.onload=()=>{S.bg={type:'preset',name:which==='A'?'Preset_A':'Preset_B',img}; draw();}; img.src= which==='A'?'assets/Preset_A.png':'assets/Preset_B.png';
    const A=[[{text:'WILL',color:'#00ACFF'}],[{text:'WHEELIE',color:'#00D200'}],[{text:'FOR',color:'#FFD700'}],[{text:'BOOKTOK',color:'#FF3CC8'}],[{text:'GIRLIES',color:'#FF2828'}]];
    const B=[[{text:'FREE',color:'#00ACFF'}],[{text:'RIDES',color:'#00D200'}],[{text:'FOR',color:'#FFD700'}],[{text:'BOOKTOK',color:'#FF3CC8'}],[{text:'GIRLIES',color:'#FF2828'}]];
    S.lines=which==='A'?A:B; S.active={line:0,word:0}; S.showSel=false; draw(); }
  // init
  (function init(){ dprSetup(); setZoom(2); renderGrid(); const img=new Image(); img.onload=()=>{S.bg={type:'preset',name:'Preset_A',img}; draw();}; img.src='assets/Preset_A.png'; })();
});