
(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const CANVAS = $('#canvas');
  const CTX = CANVAS.getContext('2d');
  const SEL = $('#selection');

  const S = {
    res:{w:96,h:128},
    zoomMode:'fit',
    playing:true,
    exact:false,
    edit:true,
    snap:false,
    bgType:'preset',
    bgSolid:'#000000',
    bgImage:null,
    presetKey:'Wheelie (96×128)',
    lines:[
      [{text:'WILL',color:'#008cff', x:null, y:null}],
      [{text:'WHEELIE',color:'#00d200', x:null, y:null}],
      [{text:'FOR',color:'#ffd700', x:null, y:null}],
      [{text:'BOOKTOK',color:'#ff3cc8', x:null, y:null}],
      [{text:'GIRLIES',color:'#ff2828', x:null, y:null}],
    ],
    fontSize:22,
    lineGap:2,
    wordGap:3,
    seconds:8,
    fps:15,
    anim:{breathY:4.0, scale:0.03, waveX:0.8, waveY:1.4},
    activeLine:0, activeWord:0
  };

  const PRESETS = {
    '96x128': {
      'Wheelie (96×128)': 'assets/Preset_A.png',
      '2 Up (96×128)':    'assets/Preset_B.png',
    },
    '64x64': {
      'Wheelie (64×64)':  'assets/Preset_C.png',
      '2 Up (64×64)':     'assets/Preset_D.png',
    }
  };

  const HIT = [];

  function init(){
    buildPresetGrid();
    bindUI();
    populateSelectors();
    loadPresetBG().then(()=>{ resizeCanvas(); draw(0); requestAnimationFrame(loop); });
  }

  function buildPresetGrid(){
    const grid = $('#presetGrid'); grid.innerHTML='';
    const key = (S.res.w===96 && S.res.h===128) ? '96x128' : ((S.res.w===64 && S.res.h===64)?'64x64':null);
    if(!key) return;
    const map = PRESETS[key];
    Object.keys(map).forEach(name=>{
      const tile = document.createElement('div'); tile.className='tile';
      if(S.bgType==='preset' && S.presetKey===name) tile.classList.add('sel');
      const img = document.createElement('img'); img.className='thumb'; img.src = map[name];
      const cap = document.createElement('div'); cap.className='cap'; cap.textContent=name;
      tile.appendChild(img); tile.appendChild(cap);
      tile.onclick = async ()=>{
        S.bgType='preset'; S.presetKey=name;
        $$('.tile').forEach(t=>t.classList.remove('sel')); tile.classList.add('sel');
        await loadPresetBG(); autoRefresh();
      };
      grid.appendChild(tile);
    });

    const solidTile = $('#tileSolid'), customTile = $('#tileCustom');
    function syncSel(){ solidTile.classList.toggle('sel', S.bgType==='solid'); customTile.classList.toggle('sel', S.bgType==='custom'); }
    solidTile.onclick = ()=>{ S.bgType='solid'; syncSel(); autoRefresh(); };
    customTile.onclick = ()=> $('#bgFile').click();
    $('#bgFile').onchange = e=>{
      const f=e.target.files?.[0]; if(!f) return;
      const fr=new FileReader();
      fr.onload = ev=>{ const im=new Image(); im.onload=()=>{S.bgImage=im; S.bgType='custom'; syncSel(); autoRefresh();}; im.src=ev.target.result; };
      fr.readAsDataURL(f);
    };
    syncSel();
  }

  async function loadPresetBG(){
    const key = (S.res.w===96 && S.res.h===128) ? '96x128' : ((S.res.w===64 && S.res.h===64)?'64x64':null);
    if(!key){ S.bgImage=null; return; }
    const url = PRESETS[key][S.presetKey]; if(!url) return;
    const im = new Image(); im.src = url; await im.decode().catch(()=>{}); S.bgImage = im;
  }

  function bindUI(){
    $('#resSelect').onchange = e=>{
      const v = e.target.value;
      if(v==='96x128'){ S.res={w:96,h:128}; $('#customRes').style.display='none'; }
      else if(v==='64x64'){ S.res={w:64,h:64}; $('#customRes').style.display='none'; }
      else { $('#customRes').style.display='inline-block'; }
      buildPresetGrid(); resizeCanvas(); autoRefresh();
    };
    $('#w').oninput = e=>{ S.res.w = clamp(+e.target.value||96,8,512); resizeCanvas(); autoRefresh(); };
    $('#h').oninput = e=>{ S.res.h = clamp(+e.target.value||128,8,512); resizeCanvas(); autoRefresh(); };

    $('#modeLive').onclick = ()=>{ S.exact=false; $('#modeLive').classList.add('active'); $('#modeExact').classList.remove('active'); };
    $('#modeExact').onclick= ()=>{ S.exact=true;  $('#modeExact').classList.add('active'); $('#modeLive').classList.remove('active'); };

    $('#editMode').onclick = ()=>{ S.edit=true; $('#editMode').classList.add('active'); $('#playMode').classList.remove('active'); S.playing=false; };
    $('#playMode').onclick = ()=>{ S.edit=false; $('#playMode').classList.add('active'); $('#editMode').classList.remove('active'); S.playing=true; };

    $('#fit').onclick = ()=> setZoom('fit');
    $('#z1').onclick  = ()=> setZoom(1);
    $('#z2').onclick  = ()=> setZoom(2);
    $('#z35').onclick = ()=> setZoom(3.5);

    $('#snap').onclick = ()=>{ S.snap=!S.snap; $('#snap').textContent = 'Snap-to-grid: ' + (S.snap?'On':'Off'); };

    $('#solidPick').oninput = e=>{ S.bgSolid = e.target.value; S.bgType='solid'; autoRefresh(); };

    // Inspector actions
    $('#addLine').onclick = ()=>{ S.lines.push([{text:'WORD',color:'#ffffff',x:null,y:null}]); S.activeLine=S.lines.length-1; S.activeWord=0; populateSelectors(); autoRefresh(); };
    $('#addWord').onclick = ()=>{ const line=S.lines[S.activeLine]||[]; line.push({text:'WORD',color:'#ffffff',x:null,y:null}); S.activeWord=line.length-1; populateSelectors(); autoRefresh(); };
    $('#delWord').onclick = ()=>{ const line=S.lines[S.activeLine]||[]; if(line.length){ line.splice(S.activeWord,1); S.activeWord=Math.max(0,S.activeWord-1); populateSelectors(); autoRefresh(); } };
    $('#delLine').onclick = ()=>{ if(S.lines.length){ S.lines.splice(S.activeLine,1); S.activeLine=Math.max(0,S.activeLine-1); S.activeWord=0; populateSelectors(); autoRefresh(); } };

    $('#activeLine').onchange = e=>{ S.activeLine=+e.target.value||0; S.activeWord=0; populateSelectors(); };
    $('#activeWord').onchange = e=>{ S.activeWord=+e.target.value||0; refreshInspector(); highlightActive(); };

    $('#wordText').oninput = e=>{ const seg=getActiveSeg(); if(seg){ seg.text=e.target.value; autoRefresh(); } };
    $('#wordColor').oninput= e=>{ const seg=getActiveSeg(); if(seg){ seg.color=e.target.value; autoRefresh(); } };

    $('#posX').oninput = e=>{ const seg=getActiveSeg(); if(!seg) return; seg.x = clamp(+e.target.value||0, 0, S.res.w-1); autoRefresh(); highlightActive(); };
    $('#posY').oninput = e=>{ const seg=getActiveSeg(); if(!seg) return; seg.y = clamp(+e.target.value||0, 0, S.res.h-1); autoRefresh(); highlightActive(); };
    $('#resetPos').onclick = ()=>{ const seg=getActiveSeg(); if(!seg) return; seg.x=null; seg.y=null; autoRefresh(); highlightActive(); };

    $('#fontSize').oninput = e=>{ S.fontSize=+e.target.value||22; autoRefresh(); };
    $('#lineGap').oninput  = e=>{ S.lineGap =+e.target.value||2;  autoRefresh(); };
    $('#wordGap').oninput  = e=>{ S.wordGap =+e.target.value||3;  autoRefresh(); };

    $('#breathY').oninput  = e=> S.anim.breathY=+e.target.value||4.0;
    $('#scaleAmpl').oninput= e=> S.anim.scale  =+e.target.value||0.03;
    $('#waveX').oninput    = e=> S.anim.waveX  =+e.target.value||0.8;
    $('#waveY').oninput    = e=> S.anim.waveY  =+e.target.value||1.4;

    $('#downloadJSON').onclick = ()=>{
      const data = JSON.stringify(S,null,2);
      downloadBlob('led_preset.json', data, 'application/json');
    };
    $('#uploadJSON').onchange = e=>{
      const f=e.target.files?.[0]; if(!f) return;
      const fr=new FileReader();
      fr.onload = ev=>{
        try{ Object.assign(S, JSON.parse(ev.target.result)); resizeCanvas(); buildPresetGrid(); populateSelectors(); autoRefresh(); }
        catch(_){ alert('Invalid JSON'); }
      }; fr.readAsText(f);
    };

    makeDraggable($('#inspector'));

    CANVAS.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    $('#renderBtn').onclick = renderGIF;
  }

  function clamp(v,minv,maxv){ return Math.max(minv, Math.min(maxv, v)); }

  function setZoom(mode){
    S.zoomMode=mode;
    if(mode==='fit'){ CANVAS.style.width='100%'; $('#zoomLbl').textContent='Fit'; }
    else{ const mul=+mode; CANVAS.style.width=(S.res.w*mul)+'px'; $('#zoomLbl').textContent=mul+'×'; }
  }

  function resizeCanvas(){ CANVAS.width=S.res.w; CANVAS.height=S.res.h; setZoom(S.zoomMode); }

  function populateSelectors(){
    const lineSel=$('#activeLine'); lineSel.innerHTML='';
    S.lines.forEach((_,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent='Line '+(i+1); if(i===S.activeLine) o.selected=true; lineSel.appendChild(o); });
    const wordSel=$('#activeWord'); wordSel.innerHTML='';
    const line=S.lines[S.activeLine]||[];
    line.forEach((_,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent='Word '+(i+1); if(i===S.activeWord) o.selected=true; wordSel.appendChild(o); });
    refreshInspector();
    highlightActive();
  }

  function getActiveSeg(){ const line=S.lines[S.activeLine]||[]; return line[S.activeWord]||null; }

  function refreshInspector(){
    const seg = getActiveSeg();
    $('#wordText').value = seg? seg.text : '';
    $('#wordColor').value = seg? (seg.color||'#ffffff') : '#ffffff';
    $('#posX').value = seg && seg.x!=null ? Math.round(seg.x) : 0;
    $('#posY').value = seg && seg.y!=null ? Math.round(seg.y) : 0;
  }

  const HIT = [];
  function draw(time){
    if(S.bgType==='solid'){ CTX.fillStyle=S.bgSolid; CTX.fillRect(0,0,CANVAS.width,CANVAS.height); }
    else if(S.bgImage){ CTX.drawImage(S.bgImage,0,0,CANVAS.width,CANVAS.height); }
    else { CTX.fillStyle='#000'; CTX.fillRect(0,0,CANVAS.width,CANVAS.height); }

    HIT.length = 0;
    const lineImgs = S.lines.map(line=>{
      const off=document.createElement('canvas'); const c=off.getContext('2d');
      c.font = `${S.fontSize}px sans-serif`;
      let w=0,h=S.fontSize+6;
      const segs=line.map(seg=>{
        const t=(seg.text||'').toUpperCase();
        const tw=Math.ceil(c.measureText(t).width);
        const cs=document.createElement('canvas'); const ctx=cs.getContext('2d');
        cs.width=tw; cs.height=h;
        ctx.font=`${S.fontSize}px sans-serif`; ctx.fillStyle=seg.color||'#fff';
        ctx.fillText(t,0,S.fontSize); w+=tw; return {canvas:cs, w:tw, h};
      });
      w += S.wordGap*Math.max(0,segs.length-1);
      off.width=Math.max(1,w); off.height=h;
      let x=0; const c2=off.getContext('2d');
      segs.forEach((s,i)=>{ c2.drawImage(s.canvas,x,0); s.x=x; s.y=0; x+=s.w+(i<segs.length-1?S.wordGap:0); });
      return {canvas:off, segs};
    });

    const totalH = lineImgs.reduce((a,c)=>a+c.canvas.height,0)+S.lineGap*Math.max(0,lineImgs.length-1);
    let yAuto = Math.floor((CANVAS.height-totalH)/2);

    lineImgs.forEach((lineObj, li)=>{
      const phase=[0,0.8,1.55,2.3,3.05][li%5];
      const wave=Math.sin(time+phase);
      const jitter=Math.cos(time*1.3+phase*1.1)*0.1;
      const dy=S.anim.waveY*wave + S.anim.breathY*(0.5-0.5*Math.cos(time)) + jitter;
      const dx=S.anim.waveX*Math.sin(time+phase*0.5);
      const sc=1.0+ S.anim.scale*(0.5-0.5*Math.cos(time));

      const lineH = lineObj.canvas.height;
      const lineW = lineObj.canvas.width;

      let baseX = Math.floor((CANVAS.width - Math.floor(lineW*sc))/2 + dx);
      let baseY = Math.floor(yAuto + dy);

      lineObj.segs.forEach((segObj, wi)=>{
        const seg = S.lines[li][wi];
        const sw = Math.max(1, Math.floor(segObj.w * sc));
        const sh = Math.max(1, Math.floor(segObj.h * sc));
        const autoX = baseX + Math.floor(segObj.x * sc);
        const autoY = baseY;
        const drawX = seg.x!=null ? clamp(Math.floor(seg.x), 0, CANVAS.width - sw) : autoX;
        const drawY = seg.y!=null ? clamp(Math.floor(seg.y), 0, CANVAS.height - sh) : autoY;
        CTX.drawImage(segObj.canvas, drawX, drawY, sw, sh);
        HIT.push({line:li, word:wi, x:drawX, y:drawY, w:sw, h:sh});
        if(li===S.activeLine && wi===S.activeWord && S.edit){
          CTX.save();
          CTX.strokeStyle = '#00ffe1';
          CTX.setLineDash([2,2]);
          CTX.strokeRect(drawX, drawY, sw, sh);
          CTX.restore();
          placeSelection(drawX, drawY, sw, sh);
        }
      });

      yAuto += lineH + S.lineGap;
    });
  }

  function placeSelection(x,y,w,h){
    const r = CANVAS.getBoundingClientRect();
    const scaleX = r.width / CANVAS.width;
    const scaleY = r.height / CANVAS.height;
    SEL.style.display='block';
    SEL.style.left = (r.left + window.scrollX + x*scaleX) + 'px';
    SEL.style.top  = (r.top  + window.scrollY + y*scaleY) + 'px';
    SEL.style.width  = (w*scaleX) + 'px';
    SEL.style.height = (h*scaleY) + 'px';
  }

  let raf=0;
  function loop(ts){ if(S.playing && !S.exact) draw(ts/1000); raf=requestAnimationFrame(loop); }
  function autoRefresh(){ cancelAnimationFrame(raf); draw(performance.now()/1000); raf=requestAnimationFrame(loop); }

  let dragging=false, dragDX=0, dragDY=0;
  function canvasToLocal(clientX, clientY){
    const r = CANVAS.getBoundingClientRect();
    const scaleX = CANVAS.width / r.width;
    const scaleY = CANVAS.height / r.height;
    return { x: Math.round((clientX - r.left) * scaleX), y: Math.round((clientY - r.top) * scaleY) };
  }

  function onDown(e){
    if(!S.edit) return;
    const p = canvasToLocal(e.clientX, e.clientY);
    for(let i=HIT.length-1;i>=0;i--){
      const h = HIT[i];
      if(p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h){
        S.activeLine = h.line; S.activeWord = h.word; refreshInspector();
        dragging = true; dragDX = p.x - h.x; dragDY = p.y - h.y;
        highlightActive();
        break;
      }
    }
  }
  function onMove(e){
    if(!dragging) return;
    const p = canvasToLocal(e.clientX, e.clientY);
    const h = HIT.find(r=>r.line===S.activeLine && r.word===S.activeWord);
    if(!h) return;
    let nx = p.x - dragDX;
    let ny = p.y - dragDY;
    if(S.snap){ nx = Math.round(nx/2)*2; ny = Math.round(ny/2)*2; }
    const seg = getActiveSeg();
    seg.x = clamp(nx, 0, CANVAS.width - h.w);
    seg.y = clamp(ny, 0, CANVAS.height - h.h);
    autoRefresh();
    highlightActive();
  }
  function onUp(){ dragging=false; }

  function highlightActive(){
    const h = HIT.find(r=>r.line===S.activeLine && r.word===S.activeWord);
    if(!h){ SEL.style.display='none'; return; }
    placeSelection(h.x,h.y,h.w,h.h);
  }

  async function renderGIF(){
    const frames=S.seconds*S.fps;
    const gif=new GIF({workers:2,quality:10,workerScript:'https://cdn.jsdelivr.net/npm/gif.js.optimized@0.2.0/dist/gif.worker.js'});
    const tmp=document.createElement('canvas'); tmp.width=S.res.w; tmp.height=S.res.h;
    const ctx=tmp.getContext('2d');
    for(let i=0;i<frames;i++){
      const t = (i/frames)*Math.PI*2;
      if(S.bgType==='solid'){ ctx.fillStyle=S.bgSolid; ctx.fillRect(0,0,tmp.width,tmp.height); }
      else if(S.bgImage){ ctx.drawImage(S.bgImage,0,0,tmp.width,tmp.height); }
      else { ctx.fillStyle='#000'; ctx.fillRect(0,0,tmp.width,tmp.height); }

      const lineImgs = S.lines.map(line=>{
        const off=document.createElement('canvas'); const c=off.getContext('2d');
        c.font=`${S.fontSize}px sans-serif`;
        let w=0,h=S.fontSize+6;
        const segs=line.map(seg=>{
          const t=(seg.text||'').toUpperCase();
          const tw=Math.ceil(c.measureText(t).width);
          const cs=document.createElement('canvas'); const c2=cs.getContext('2d');
          cs.width=tw; cs.height=h; c2.font=`${S.fontSize}px sans-serif`; c2.fillStyle=seg.color||'#fff'; c2.fillText(t,0,S.fontSize);
          w+=tw; return {canvas:cs, w:tw, h};
        });
        w+=S.wordGap*Math.max(0,segs.length-1);
        off.width=Math.max(1,w); off.height=h;
        let x=0; const ctx2=off.getContext('2d');
        segs.forEach((s,i)=>{ ctx2.drawImage(s.canvas,x,0); s.x=x; s.y=0; x+=s.w+(i<segs.length-1?S.wordGap:0); });
        return {canvas:off, segs};
      });
      const totalH=lineImgs.reduce((a,c)=>a+c.canvas.height,0)+S.lineGap*Math.max(0,lineImgs.length-1);
      let yAuto=Math.floor((tmp.height-totalH)/2);
      lineImgs.forEach((lineObj,li)=>{
        const phase=[0,0.8,1.55,2.3,3.05][li%5];
        const wave=Math.sin(t+phase);
        const jitter=Math.cos(t*1.3+phase*1.1)*0.1;
        const dy=S.anim.waveY*wave + S.anim.breathY*(0.5-0.5*Math.cos(t)) + jitter;
        const dx=S.anim.waveX*Math.sin(t+phase*0.5);
        const sc=1.0+S.anim.scale*(0.5-0.5*Math.cos(t));
        const lineH=lineObj.canvas.height;
        const lineW=lineObj.canvas.width;

        let baseX = Math.floor((tmp.width - Math.floor(lineW*sc))/2 + dx);
        let baseY = Math.floor(yAuto + dy);

        lineObj.segs.forEach((segObj, wi)=>{
          const seg=S.lines[li][wi];
          const sw=Math.max(1,Math.floor(segObj.w*sc));
          const sh=Math.max(1,Math.floor(segObj.h*sc));
          const autoX = baseX + Math.floor(segObj.x*sc);
          const autoY = baseY;
          const drawX = seg.x!=null ? clamp(Math.floor(seg.x),0,tmp.width-sw) : autoX;
          const drawY = seg.y!=null ? clamp(Math.floor(seg.y),0,tmp.height-sh) : autoY;
          ctx.drawImage(segObj.canvas, drawX, drawY, sw, sh);
        });

        yAuto += lineH + S.lineGap;
      });
      gif.addFrame(tmp,{copy:true,delay:Math.max(16,Math.floor(1000/S.fps))});
    }
    gif.on('finished', blob=>{
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='led_anim.gif'; a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1200);
    });
    gif.render();
  }

  function makeDraggable(el){
    let sx=0,sy=0,ox=0,oy=0,drag=false;
    el.addEventListener('mousedown', e=>{
      if(['INPUT','SELECT','BUTTON','SUMMARY'].includes(e.target.tagName)) return;
      drag=true; sx=e.clientX; sy=e.clientY; const r=el.getBoundingClientRect(); ox=r.left; oy=r.top; document.body.style.userSelect='none';
    });
    window.addEventListener('mousemove', e=>{
      if(!drag) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      el.style.left=(ox+dx)+'px'; el.style.top=(oy+dy)+'px'; el.style.right='auto'; el.style.bottom='auto';
    });
    window.addEventListener('mouseup', ()=>{ drag=false; document.body.style.userSelect=''; });
  }

  function downloadBlob(name,data,mime='application/octet-stream'){
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type:mime})); a.download=name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1200);
  }

  function clamp(v,minv,maxv){ return Math.max(minv, Math.min(maxv, v)); }

  init();
})();
