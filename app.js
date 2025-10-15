
(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const CANVAS = $('#canvas');
  const CTX = CANVAS.getContext('2d');
  let ZOOM = 1;
  let playing = true;
  let modeExact = false;

  // State
  const S = {
    res: {w:96,h:128},
    bgType: 'preset', // preset | solid | custom
    bgSolid: '#000000',
    bgImage: null, // Image() or offscreen canvas for custom
    presetKey: 'A',
    lines: [
      [{text:'WILL', color:'#008cff'}],
      [{text:'WHEELIE', color:'#00d200'}],
      [{text:'FOR', color:'#ffd700'}],
      [{text:'BOOKTOK', color:'#ff3cc8'}],
      [{text:'GIRLIES', color:'#ff2828'}],
    ],
    fontSize: 22,
    lineGap: 2,
    wordGap: 3,
    seconds: 8,
    fps: 15,
    anim: {breathY:4.0, scale:0.03, waveX:0.8, waveY:1.4},
  };

  const PRESETS = {
    '96x128': {
      'Wheelie (96×128)': 'assets/Preset_A.png',
      '2 Up (96×128)': 'assets/Preset_B.png',
    },
    '64x64': {
      'Wheelie (64×64)': 'assets/Preset_C.png',
      '2 Up (64×64)': 'assets/Preset_D.png',
    }
  };

  // UI init
  function init() {
    buildPresetGrid();
    bind();
    resizeCanvas();
    requestAnimationFrame(tick);
  }

  function buildPresetGrid() {
    const key = S.res.w===96 && S.res.h===128 ? '96x128' : (S.res.w===64 && S.res.h===64 ? '64x64' : null);
    const grid = $('#presetGrid');
    grid.innerHTML = '';
    if (!key) return;
    const map = PRESETS[key];
    Object.keys(map).forEach(name => {
      const div = document.createElement('div');
      div.className = 'tile';
      const img = document.createElement('img');
      img.src = map[name];
      const cap = document.createElement('div'); cap.style.padding='6px'; cap.textContent = name;
      div.appendChild(img); div.appendChild(cap);
      div.addEventListener('click', async () => {
        S.bgType='preset';
        S.presetKey=name;
        const im = new Image(); im.src = map[name];
        await im.decode().catch(()=>{});
        S.bgImage = im;
        $$('.tile').forEach(t=>t.classList.remove('sel')); div.classList.add('sel');
      });
      grid.appendChild(div);
    });
  }

  function bind(){
    $('#resSelect').addEventListener('change', e=>{
      const v = e.target.value;
      if (v==='96x128'){ S.res={w:96,h:128}; $('#customRes').style.display='none'; }
      else if (v==='64x64'){ S.res={w:64,h:64}; $('#customRes').style.display='none'; }
      else { $('#customRes').style.display='inline-block'; }
      resizeCanvas(); buildPresetGrid();
    });
    $('#w').addEventListener('input', e=>{ S.res.w = Math.max(8, Math.min(512, +e.target.value||96)); resizeCanvas(); });
    $('#h').addEventListener('input', e=>{ S.res.h = Math.max(8, Math.min(512, +e.target.value||128)); resizeCanvas(); });

    $('#modeLive').addEventListener('click', ()=>{ modeExact=false; $('#modeLive').classList.add('active'); $('#modeExact').classList.remove('active'); });
    $('#modeExact').addEventListener('click', ()=>{ modeExact=true; $('#modeExact').classList.add('active'); $('#modeLive').classList.remove('active'); });

    $('#play').addEventListener('click', ()=> playing=!playing);
    $('#zoomIn').addEventListener('click', ()=> setZoom(ZOOM*1.15));
    $('#zoomOut').addEventListener('click', ()=> setZoom(ZOOM/1.15));

    $('#solidBtn').addEventListener('click', ()=>{ S.bgType='solid'; });
    $('#solidPick').addEventListener('input', e=>{ S.bgSolid = e.target.value; S.bgType='solid'; });

    $('#uploadBtn').addEventListener('click', ()=> $('#bgFile').click());
    $('#bgFile').addEventListener('change', e=>{
      const f = e.target.files?.[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = ev => {
        const im = new Image();
        im.onload = ()=>{ S.bgImage = im; S.bgType='custom'; };
        im.src = ev.target.result;
      };
      fr.readAsDataURL(f);
    });

    $('#addLine').addEventListener('click', ()=>{
      S.lines.push([{text:'WORD', color:'#ffffff'}]);
      renderLinesEditor();
    });

    $('#renderBtn').addEventListener('click', renderGIF);
    $('#downloadJSON').addEventListener('click', ()=>{
      const data = JSON.stringify(S, null, 2);
      downloadBlob('led_preset.json', data, 'application/json');
    });
    $('#uploadJSON').addEventListener('change', e=>{
      const f = e.target.files?.[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = ev => {
        try{
          const obj = JSON.parse(ev.target.result);
          Object.assign(S, obj);
          resizeCanvas(); buildPresetGrid(); renderLinesEditor();
        }catch(err){ alert('Invalid JSON'); }
      };
      fr.readAsText(f);
    });

    renderLinesEditor();
  }

  function renderLinesEditor(){
    const box = $('#lines'); box.innerHTML='';
    S.lines.forEach((line, li)=>{
      const row = document.createElement('div'); row.className='row'; row.style.marginBottom='6px';
      const label = document.createElement('div'); label.textContent = `Line ${li+1}`; label.style.minWidth='60px';
      row.appendChild(label);
      const addWord = document.createElement('button'); addWord.textContent = '+ word'; addWord.className='btnTiny';
      addWord.onclick = ()=>{ line.push({text:'WORD', color:'#ffffff'}); renderLinesEditor(); };
      const delLine = document.createElement('button'); delLine.textContent='🗑 line'; delLine.className='btnTiny';
      delLine.onclick = ()=>{ S.lines.splice(li,1); renderLinesEditor(); };
      row.appendChild(addWord); row.appendChild(delLine);
      box.appendChild(row);

      line.forEach((seg, wi)=>{
        const r = document.createElement('div'); r.className='row';
        const ti = document.createElement('input'); ti.value = seg.text; ti.style.minWidth='160px';
        ti.oninput = e=>{ seg.text = e.target.value; };
        const cp = document.createElement('input'); cp.type='color'; cp.value=seg.color||'#ffffff';
        cp.oninput = e=>{ seg.color = e.target.value; };
        const del = document.createElement('button'); del.className='btnTiny'; del.textContent='🗑 word';
        del.onclick = ()=>{ line.splice(wi,1); renderLinesEditor(); };
        r.appendChild(ti); r.appendChild(cp); r.appendChild(del);
        box.appendChild(r);
      });
    });
  }

  function setZoom(z){ ZOOM = Math.max(.5, Math.min(6, z)); $('#zoomLbl').textContent = Math.round(ZOOM*100)+'%'; resizeCanvas(false); }

  function resizeCanvas(resetBG=true){
    CANVAS.width = S.res.w; CANVAS.height = S.res.h;
    CANVAS.style.width = (S.res.w*ZOOM)+'px'; CANVAS.style.height = (S.res.h*ZOOM)+'px';
  }

  function draw(t){
    // background
    if (S.bgType==='solid'){
      CTX.fillStyle = S.bgSolid; CTX.fillRect(0,0,CANVAS.width, CANVAS.height);
    } else if (S.bgImage){
      CTX.drawImage(S.bgImage, 0,0, CANVAS.width, CANVAS.height);
    } else {
      CTX.fillStyle = '#000'; CTX.fillRect(0,0,CANVAS.width, CANVAS.height);
    }

    // text layout (simple vertical stack, center each line)
    const lineImgs = S.lines.map(line => {
      const parts = line.map(seg => {
        const off = document.createElement('canvas');
        const ctx = off.getContext('2d');
        ctx.font = `${S.fontSize}px sans-serif`;
        const w = Math.ceil(ctx.measureText(seg.text.toUpperCase()).width);
        off.width=w; off.height= S.fontSize+4;
        ctx.font = `${S.fontSize}px sans-serif`;
        ctx.fillStyle = seg.color||'#fff';
        ctx.fillText(seg.text.toUpperCase(), 0, S.fontSize);
        return off;
      });
      const totalW = parts.reduce((a,c)=>a+c.width,0) + S.wordGap*(Math.max(0,parts.length-1));
      const h = Math.max(...parts.map(p=>p.height), S.fontSize+4);
      const out = document.createElement('canvas'); out.width=totalW; out.height=h;
      const c2 = out.getContext('2d');
      let x=0;
      parts.forEach((p,i)=>{ c2.drawImage(p, x, 0); x += p.width + (i<parts.length-1?S.wordGap:0); });
      return out;
    });
    const totalH = lineImgs.reduce((a,c)=>a+c.height,0) + S.lineGap*(Math.max(0,lineImgs.length-1));
    let y = (CANVAS.height - totalH)/2;

    const BY=S.anim.breathY, SC=S.anim.scale;
    const wx=S.anim.waveX, wy=S.anim.waveY;

    lineImgs.forEach((img, i) => {
      const phase = [0,0.8,1.55,2.3,3.05][i%5];
      const wave = Math.sin(t + phase);
      const jitter = Math.cos(t*1.3 + phase*1.1)*0.1;
      const dy = wy*wave + BY*(0.5-0.5*Math.cos(t)) + jitter;
      const dx = wx*Math.sin(t + phase*0.5);
      const sc = 1.0 + SC*(0.5-0.5*Math.cos(t));
      const w = Math.max(1, Math.floor(img.width*sc));
      const h = Math.max(1, Math.floor(img.height*sc));
      const cx = Math.floor((CANVAS.width - w)/2 + dx);
      const cy = Math.floor(y + dy);
      CTX.drawImage(img, cx, cy, w, h);
      y += img.height + S.lineGap;
    });
  }

  let last = 0;
  function tick(ts){
    const t = ts/1000;
    if (playing && !modeExact) draw(t);
    requestAnimationFrame(tick);
  }

  async function renderGIF(){
    // Use gif.js from CDN (simple exact render)
    const frames = S.seconds * S.fps;
    const gif = new GIF({
      workers: 2, quality: 10, workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized@0.2.0/dist/gif.worker.js'
    });
    const tmp = document.createElement('canvas'); tmp.width=S.res.w; tmp.height=S.res.h;
    const ctx = tmp.getContext('2d');
    for (let i=0;i<frames;i++){
      const t = i/frames * Math.PI*2;
      // draw same as live to tmp
      // bg
      if (S.bgType==='solid'){
        ctx.fillStyle = S.bgSolid; ctx.fillRect(0,0,tmp.width,tmp.height);
      } else if (S.bgImage){
        ctx.drawImage(S.bgImage, 0,0,tmp.width,tmp.height);
      } else {
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,tmp.width,tmp.height);
      }
      // text
      const parts = S.lines.map(line => {
        const canv = document.createElement('canvas'); const c = canv.getContext('2d');
        // measure
        let w=0; let h=0; const segs=[];
        line.forEach(seg=>{
          const ctmp = document.createElement('canvas').getContext('2d');
          ctmp.font = `${S.fontSize}px sans-serif`;
          const tw = Math.ceil(ctmp.measureText(seg.text.toUpperCase()).width);
          w += tw; h = Math.max(h, S.fontSize+4); segs.push({seg, tw});
        });
        w += S.wordGap*(Math.max(0, line.length-1));
        canv.width=w; canv.height=h;
        c.font = `${S.fontSize}px sans-serif`;
        let x=0;
        segs.forEach((o,idx)=>{
          c.fillStyle = o.seg.color||'#fff';
          c.fillText(o.seg.text.toUpperCase(), x, S.fontSize);
          x += o.tw + (idx<segs.length-1?S.wordGap:0);
        });
        return canv;
      });
      const totalH = parts.reduce((a,c)=>a+c.height,0) + S.lineGap*(Math.max(0,parts.length-1));
      let y = (tmp.height - totalH)/2;
      parts.forEach((img, idx)=>{
        const phase = [0,0.8,1.55,2.3,3.05][idx%5];
        const wave = Math.sin(t + phase);
        const jitter = Math.cos(t*1.3 + phase*1.1)*0.1;
        const dy = S.anim.waveY*wave + S.anim.breathY*(0.5-0.5*Math.cos(t)) + jitter;
        const dx = S.anim.waveX*Math.sin(t + phase*0.5);
        const sc = 1.0 + S.anim.scale*(0.5-0.5*Math.cos(t));
        const wsc = Math.max(1, Math.floor(img.width*sc));
        const hsc = Math.max(1, Math.floor(img.height*sc));
        const cx = Math.floor((tmp.width - wsc)/2 + dx);
        const cy = Math.floor(y + dy);
        ctx.drawImage(img, cx, cy, wsc, hsc);
        y += img.height + S.lineGap;
      });

      gif.addFrame(tmp, {copy:true, delay: Math.max(16, Math.floor(1000/S.fps))});
    }
    gif.on('finished', function(blob){
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'led_anim.gif';
      a.click();
      setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
    });
    gif.render();
  }

  // Hook form inputs
  $('#fontSize').oninput = e=> S.fontSize = +e.target.value||22;
  $('#lineGap').oninput = e=> S.lineGap = +e.target.value||2;
  $('#wordGap').oninput = e=> S.wordGap = +e.target.value||3;
  $('#seconds').oninput = e=> S.seconds = +e.target.value||8;
  $('#fps').oninput     = e=> S.fps     = +e.target.value||15;
  $('#breathY').oninput = e=> S.anim.breathY = +e.target.value||4.0;
  $('#scaleAmpl').oninput= e=> S.anim.scale = +e.target.value||0.03;
  $('#waveX').oninput   = e=> S.anim.waveX = +e.target.value||0.8;
  $('#waveY').oninput   = e=> S.anim.waveY = +e.target.value||1.4;

  function downloadBlob(name, data, mime='application/octet-stream'){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data],{type:mime}));
    a.download = name;
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
  }

  // Kick
  init();
})();
