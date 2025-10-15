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
    font:{size:22, gap:2, wgap:3},
    anim:{by:4.0, sc:0.03, wx:0.8, wy:1.4},
    seconds:8, fps:15, rafId:null
  };

  const $ = (id)=>document.getElementById(id);
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
    if(S.bg.type==='solid'){ CTX.fillStyle=S.bg.color; CTX.fillRect(0,0,S.res.w,S.res.h); }
    else if(S.bg.img){ CTX.drawImage(S.bg.img,0,0,S.res.w,S.res.h); }
    else{ CTX.fillStyle='#000'; CTX.fillRect(0,0,S.res.w,S.res.h); }

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
      div.innerHTML=`<img class="thumb" src="${t.file}" alt="${t.label}"><div class="label">${t.label}</div>`;
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

  $('addLine').addEventListener('click',()=>{
    S.lines.push([{text:'WORD',color:'#ffffff'}]);
    S.active.line=S.lines.length-1; S.active.word=0;
    openInspector(); syncInspector(); draw();
  });
  $('addWord').addEventListener('click',()=>{
    S.lines[S.active.line].push({text:'WORD',color:'#ffffff'});
    S.active.word=S.lines[S.active.line].length-1;
    openInspector(); syncInspector(); draw();
  });
  $('deleteWord').addEventListener('click',()=>{
    const L=S.lines[S.active.line];
    if(L && L.length){ L.splice(S.active.word,1); S.active.word=Math.max(0,S.active.word-1); draw(); syncInspector(); }
  });

  const bind=(id,fn)=>$(id).addEventListener('input',fn);
  bind('activeLine', e=>{ S.active.line=Math.max(0,Math.min(S.lines.length-1, parseInt(e.target.value)||0)); syncInspector(); draw(); });
  bind('activeWord', e=>{ const L=S.lines[S.active.line]; S.active.word=Math.max(0,Math.min(L.length-1, parseInt(e.target.value)||0)); syncInspector(); draw(); });
  bind('wordText', e=>{ const W=S.lines[S.active.line][S.active.word]; if(W){ W.text=e.target.value; draw(); } });
  bind('wordColor', e=>{ const W=S.lines[S.active.line][S.active.word]; if(W){ W.color=e.target.value; draw(); } });
  bind('fontSize', e=>{ S.font.size=parseInt(e.target.value)||22; draw(); });
  bind('lineGap', e=>{ S.font.gap=parseInt(e.target.value)||2; draw(); });
  bind('wordGap', e=>{ S.font.wgap=parseInt(e.target.value)||3; draw(); });
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

  $('modeLive').addEventListener('click',()=>{
    $('modeLive').classList.add('active');
    $('modeRender').classList.remove('active');
    stopAnim(); // static edit
  });
  $('modeRender').addEventListener('click',()=>{
    $('modeRender').classList.add('active');
    $('modeLive').classList.remove('active');
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
    $('resMode').value='96x128';
    dprSetup(); setZoom(2); renderGrid();
    const img=new Image(); img.onload=()=>{ S.bg={type:'preset',name:'Preset_A',img}; draw(); }; img.src='assets/Preset_A.png';
    syncInspector(); stopAnim();
  })();
});
