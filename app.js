
document.addEventListener('DOMContentLoaded', ()=>{
  // ====== STATE ======
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const screenScale = 3; // 96x128 -> 288x384 CSS
  canvas.style.width = (canvas.width*screenScale)+'px';
  canvas.style.height = (canvas.height*screenScale)+'px';

  const state = {
    mode: 'edit',
    res: {w:96,h:128},
    background: { type:'preset', id:'A', image:null, color:'#000' },
    lines: [], // [ [ {text,color,font,size,anim:{}}, ... ], ... ]
    selection: { line:-1, word:-1 },
    spacing: { line:2, word:8 },
    align: 'center',
    history: [], future: [],
    anim: { booktok:true, speed:1.0 },
    _layout: null
  };

  // ====== DOM ======
  const $ = s => document.querySelector(s);
  const thumbs = document.getElementById('thumbs');
  const uploadBg = document.getElementById('uploadBg');
  const resSel = document.getElementById('resolution');
  const typeBox = document.getElementById('typebox');
  const chips = document.getElementById('chips');
  const btnAddWord = document.getElementById('btnAddWord');
  const btnAddLine = document.getElementById('btnAddLine');

  const btnPreview = document.getElementById('btnPreview');
  const btnEdit = document.getElementById('btnEdit');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnClear = document.getElementById('btnClear');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const zoomLabel = document.getElementById('zoomLabel');
  const btnToggleInspector = document.getElementById('btnToggleInspector');

  const fontFamily = document.getElementById('fontFamily');
  const fontSize = document.getElementById('fontSize');
  const autoSize = document.getElementById('autoSize');
  const lineGap = document.getElementById('lineGap');
  const wordSpacing = document.getElementById('wordSpacing');
  const alignButtons = document.querySelectorAll('.align');
  const alignReset = document.getElementById('alignReset');
  const inspector = document.getElementById('inspector');

  const animBookTok = document.getElementById('animBookTok');
  const animSpeed = document.getElementById('animSpeed');

  const gifFps = document.getElementById('gifFps');
  const gifSecs = document.getElementById('gifSecs');
  const gifName = document.getElementById('gifName');
  const btnRenderGif = document.getElementById('btnRenderGif');

  // ====== CONFIG ======
  const PADDING = { x:6, y:6 };
  const MAX_UNDO = 20;

  function pushHistory(){
    state.history.push(JSON.stringify({lines:state.lines, selection:state.selection, spacing:state.spacing, align:state.align}));
    if(state.history.length>MAX_UNDO) state.history.shift();
    state.future.length = 0;
  }
  function restoreHistory(idx){
    if(idx<0 || idx>=state.history.length) return;
    const snap = state.history[idx];
    const curr = JSON.stringify({lines:state.lines, selection:state.selection, spacing:state.spacing, align:state.align});
    state.future.push(curr);
    const o = JSON.parse(snap);
    state.lines=o.lines; state.selection=o.selection; state.spacing=o.spacing; state.align=o.align;
    state.history.splice(idx,1);
    layoutAndRender();
  }

  function applyFontToContext(word){
    const fam = word.font || fontFamily.value;
    const size = word.size || Number(fontSize.value||22);
    ctx.font = `${size}px ${fam}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }
  function measureWord(word){
    applyFontToContext(word);
    const metrics = ctx.measureText(word.text||'');
    const width = Math.ceil(metrics.width);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || (word.size*0.8));
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || (word.size*0.2));
    const height = ascent + descent;
    return {width,height,ascent,descent};
  }

  function layoutDocument(){
    const W = canvas.width, H = canvas.height;
    const safeW = W - PADDING.x*2, safeH = H - PADDING.y*2;
    const lineBoxes = [];
    let totalH = 0;
    state.lines.forEach((line, li)=>{
      if(!line.length){ lineBoxes.push({width:0,height:0,measures:[],words:[]}); return; }
      // autosize per line if needed
      if(autoSize.checked){
        let guard=0;
        while(guard++<64){
          const ms = line.map(measureWord);
          const spacing = Number(wordSpacing.value||8);
          const lw = ms.reduce((a,m)=>a+m.width,0) + Math.max(0,line.length-1)*spacing;
          if(lw <= safeW) break;
          line.forEach(w => w.size = Math.max(6,(w.size||Number(fontSize.value||22))-1));
        }
      }
      const ms = line.map(measureWord);
      const spacing = Number(wordSpacing.value||8);
      const lw = ms.reduce((a,m)=>a+m.width,0) + Math.max(0,line.length-1)*spacing;
      const lh = ms.reduce((a,m)=>Math.max(a,m.height),0) || Number(fontSize.value||22);
      totalH += lh + (li ? Number(lineGap.value||2) : 0);
      lineBoxes.push({width:lw,height:lh,measures:ms,words:[]});
    });
    let y = Math.floor((safeH-totalH)/2) + PADDING.y;
    state.lines.forEach((line, li)=>{
      const box = lineBoxes[li];
      const spacing = Number(wordSpacing.value||8);
      let startX = PADDING.x;
      const leftover = safeW - box.width;
      if(state.align==='center') startX += Math.floor(leftover/2);
      else if(state.align==='right') startX += leftover;
      let x = startX;
      const baseline = y + Math.ceil(box.height*0.8);
      box.words = line.map((w, wi)=>{
        const m = box.measures[wi];
        const rect = {x, y: baseline - m.ascent, w:m.width, h:m.height, baseline};
        x += m.width + spacing;
        return rect;
      });
      y += box.height + (li<state.lines.length-1? Number(lineGap.value||2) : 0);
    });
    state._layout = { lineBoxes };
  }

  function renderAtTime(t=null){
    // background
    if(state.background.type==='image' && state.background.image){
      ctx.drawImage(state.background.image, 0,0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = state.background.color || '#000';
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    const lb = state._layout?.lineBoxes || [];
    const baseAlpha = (state.mode==='preview' && state.anim.booktok)
      ? (0.85 + 0.15 * (0.5*(1+Math.sin((t??performance.now()/1000)*state.anim.speed*6.28318))))
      : 1;
    state.lines.forEach((line, li)=>{
      const lineBox = lb[li]; if(!lineBox) return;
      line.forEach((w, wi)=>{
        const rect = lineBox.words[wi]; if(!rect) return;
        ctx.save();
        ctx.globalAlpha = baseAlpha;
        applyFontToContext(w); ctx.fillStyle = w.color || '#fff';
        ctx.fillText(w.text||'', rect.x, rect.baseline);
        ctx.restore();
        // selection outline
        if(state.selection.line===li && state.selection.word===wi && state.mode==='edit'){
          ctx.save();
          ctx.setLineDash([2,2]); ctx.strokeStyle='rgba(255,0,200,.9)'; ctx.lineWidth=1;
          ctx.strokeRect(rect.x-1, rect.y-1, rect.w+2, rect.h+2);
          ctx.restore();
        }
      });
    });
  }
  function render(){ renderAtTime(null); }
  function layoutAndRender(){ layoutDocument(); render(); }

  // ====== WORD/LINE MGMT ======
  function addWord(text='WORD'){
    if(!state.lines.length) state.lines.push([]);
    const line = state.lines[state.lines.length-1];
    line.push({text, color:'#FFFFFF', font:fontFamily.value, size:Number(fontSize.value||22), anim:{}});
    state.selection={line:state.lines.length-1, word:line.length-1};
    pushHistory(); layoutAndRender();
  }
  function addLine(){ state.lines.push([]); pushHistory(); layoutAndRender(); }

  // typing behavior
  typeBox.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
      e.preventDefault();
      if(typeBox.value.trim()) addWord(typeBox.value.trim());
      typeBox.value='';
      addLine();
    }else if(e.key===' '){
      e.preventDefault();
      if(typeBox.value.trim()){ addWord(typeBox.value.trim()); typeBox.value=''; }
    }
  });
  btnAddWord.addEventListener('click', ()=>{
    if(typeBox.value.trim()){ addWord(typeBox.value.trim()); typeBox.value=''; } else addWord('WORD');
  });
  btnAddLine.addEventListener('click', ()=> addLine());

  // chips
  function rebuildChips(){
    chips.innerHTML='';
    state.lines.forEach((line, li)=>{
      const row = document.createElement('div'); row.className='row';
      line.forEach((w, wi)=>{
        const chip = document.createElement('div'); chip.className='wordchip'+(state.selection.line===li&&state.selection.word===wi?' active':'');
        chip.innerHTML = `<span>${w.text}</span> <span class="del">×</span>`;
        chip.onclick=()=>{ state.selection={line:li, word:wi}; layoutAndRender(); };
        chip.querySelector('.del').onclick=(ev)=>{ ev.stopPropagation(); line.splice(wi,1); state.selection={line:-1,word:-1}; pushHistory(); layoutAndRender(); };
        row.appendChild(chip);
      });
      chips.appendChild(row);
    });
  }

  // canvas click -> deselect or hit
  canvas.addEventListener('click', (e)=>{
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top)  * (canvas.height / r.height);
    const lb = state._layout?.lineBoxes || [];
    let hit=null;
    for(let li=0; li<lb.length; li++){
      const line = lb[li]; if(!line) continue;
      for(let wi=0; wi<line.words.length; wi++){
        const w = line.words[wi];
        if(x>=w.x && x<=w.x+w.w && y>=w.y && y<=w.y+w.h){ hit={line:li,word:wi}; break; }
      }
      if(hit) break;
    }
    state.selection = hit || {line:-1,word:-1};
    layoutAndRender();
  });
  canvas.addEventListener('dblclick', ()=>{
    const newWord = {text:'', color:'#FFFFFF', font:fontFamily.value, size:Number(fontSize.value||22), anim:{}};
    state.lines.push([newWord]); state.selection={line:state.lines.length-1, word:0};
    pushHistory(); layoutAndRender();
  });

  // inspector
  fontFamily.addEventListener('change', ()=> layoutAndRender());
  fontSize.addEventListener('input', ()=> layoutAndRender());
  autoSize.addEventListener('change', ()=> layoutAndRender());
  lineGap.addEventListener('input', ()=> layoutAndRender());
  wordSpacing.addEventListener('input', ()=> layoutAndRender());
  alignButtons.forEach(b=> b.addEventListener('click', ()=>{ state.align=b.dataset.align; layoutAndRender(); }));
  alignReset.addEventListener('click', ()=>{ state.align='center'; layoutAndRender(); });

  // undo/redo/clear
  btnUndo.addEventListener('click', ()=> restoreHistory(state.history.length-1));
  btnRedo.addEventListener('click', ()=>{
    if(!state.future.length) return;
    const snap = state.future.pop();
    state.history.push(JSON.stringify({lines:state.lines,selection:state.selection,spacing:state.spacing,align:state.align}));
    const o = JSON.parse(snap);
    state.lines=o.lines; state.selection=o.selection; state.spacing=o.spacing; state.align=o.align;
    layoutAndRender();
  });
  btnClear.addEventListener('click', ()=>{ state.lines=[]; state.selection={line:-1,word:-1}; pushHistory(); layoutAndRender(); });

  // zoom
  let scale=3;
  function setZoom(z){ scale=Math.max(1,Math.min(6,z)); canvas.style.width=(canvas.width*scale)+'px'; canvas.style.height=(canvas.height*scale)+'px'; $('#zoomLabel').textContent=(scale*100)+'%'; }
  btnZoomIn.addEventListener('click', ()=> setZoom(scale+0.5));
  btnZoomOut.addEventListener('click', ()=> setZoom(scale-0.5));

  // modes
  btnPreview.addEventListener('click', ()=>{ state.mode='preview'; });
  btnEdit.addEventListener('click', ()=>{ state.mode='edit'; });

  // preview loop
  function tick(){
    if(state.mode==='preview'){ render(); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // backgrounds
  function filterPresets(){
    const is96 = (state.res.w===96 && state.res.h===128);
    document.querySelectorAll('#thumbs .thumb[data-kind="preset"]').forEach(el=>{
      const id = el.dataset.id;
      el.style.display = (is96 ? (id==='A'||id==='B') : (id==='C'||id==='D')) ? '' : 'none';
    });
  }
  resSel.addEventListener('change', (e)=>{
    const [w,h]=e.target.value.split('x').map(n=>parseInt(n,10));
    state.res={w,h}; canvas.width=w; canvas.height=h; setZoom(scale);
    filterPresets(); applyBackground(state.background); layoutAndRender();
  });

  function applyBackground(bg){
    if(bg.type==='preset'){
      const id = bg.id;
      const path = (state.res.w===96 && state.res.h===128)
        ? `assets/presets/96x128/Preset_${id}.png`
        : `assets/presets/64x64/Preset_${id}.png`;
      const img = new Image();
      img.onload=()=>{ state.background={type:'image', image:img, id, color:'#000'}; layoutAndRender(); };
      img.src=path;
    } else if(bg.type==='solid'){
      state.background={type:'solid', color:bg.color||'#000', image:null, id:null};
      layoutAndRender();
    } else if(bg.type==='image' && bg.image){
      state.background=bg; layoutAndRender();
    }
  }

  thumbs.addEventListener('click', (e)=>{
    const t = e.target.closest('.thumb'); if(!t) return;
    document.querySelectorAll('#thumbs .thumb').forEach(x=>x.classList.remove('selected'));
    t.classList.add('selected');
    const kind = t.dataset.kind;
    if(kind==='preset'){
      applyBackground({type:'preset', id:t.dataset.id});
    } else if(kind==='solid'){
      applyBackground({type:'solid', color:'#000000'});
    } else if(kind==='upload'){
      uploadBg.click();
    }
  });
  uploadBg.addEventListener('change', (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload=()=> applyBackground({type:'image', image:img, id:null});
    img.src=url;
  });

  // Animation
  animBookTok.addEventListener('change', ()=>{ state.anim.booktok = animBookTok.checked; });
  animSpeed.addEventListener('input', ()=>{ state.anim.speed = Math.max(0.2, Math.min(3, parseFloat(animSpeed.value)||1.0)); });

  // GIF export
  btnRenderGif.addEventListener('click', async ()=>{
    const fps = Math.max(2, parseInt(gifFps.value||'12',10));
    const secs = Math.max(1, parseInt(gifSecs.value||'3',10));
    const frames = fps*secs;
    const delay = Math.max(2, Math.round(100/fps));
    const enc = new TinyGif(canvas.width, canvas.height, delay, 0);
    for(let i=0;i<frames;i++){
      const t = i/fps;
      layoutDocument(); renderAtTime(t);
      enc.addFrame(ctx);
      await new Promise(r=>setTimeout(r,0));
    }
    const blob = enc.render();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (gifName.value || 'animation') + '.gif';
    a.click();
  });

  // init
  function boot(){
    filterPresets();
    document.querySelector('#thumbs .thumb[data-kind="preset"]').classList.add('selected');
    applyBackground({type:'preset', id:'A'});
    pushHistory();
    layoutAndRender();
    setZoom(3);
  }
  boot();

  // expose for debugging
  window.__state = state;
});
