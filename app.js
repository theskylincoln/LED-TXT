
// LED Backpack Animator v2.1-STABLE
// Default: 96x128 portrait, thumbnails, words/lines, inspector, animations (preview-only), undo/redo, config save, GIF render.

const $ = (sel, el=document)=> el.querySelector(sel);
const $$ = (sel, el=document)=> Array.from(el.querySelectorAll(sel));

const state = {
  res: {w:96,h:128}, // default portrait
  bg: {type:'preset', name:'Preset_A', img:null, color:'#000000'},
  words: [ // array of lines -> each line is array of word objects
  ],
  selection: {line:-1, word:-1},
  align: {h:'center', v:'center', manual:false, offsetX:0, offsetY:0},
  spacing: {line:6, word:6},
  font: {family:'Inter, Arial', size:12, autosize:true},
  swatches: ['#00ff00','#ff0000','#00aaff','#ff00ff','#ffff00','#ffffff'],
  animationsEnabled: true,
  mode: 'edit', // 'edit'|'preview'
  history: [],
  future: [],
  manualDrag: false, showDragWarn: true,
  render: {fps:12, seconds:3, filename:'animation.gif'}
};

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const screen = $('#screen');
const screenCtx = screen.getContext('2d');

function setResolution(w,h){
  state.res={w,h};
  canvas.width=w; canvas.height=h;
  screen.width=w; screen.height=h;
  screen.style.width = (w*3)+'px';
  screen.style.height = (h*3)+'px';
  loadVisibleThumbs();
  render();
}

function pushHistory(){
  state.history.push(JSON.stringify({words:state.words, selection:state.selection, font:state.font, spacing:state.spacing, align:state.align}));
  if(state.history.length>20) state.history.shift();
  state.future.length=0;
}

function undo(){ if(!state.history.length) return;
  const snap = state.history.pop();
  state.future.push(JSON.stringify({words:state.words, selection:state.selection, font:state.font, spacing:state.spacing, align:state.align}));
  const o = JSON.parse(snap);
  state.words = o.words; state.selection=o.selection; state.font=o.font; state.spacing=o.spacing; state.align=o.align;
  render();
}
function redo(){ if(!state.future.length) return;
  const snap = state.future.pop();
  pushHistory();
  const o = JSON.parse(snap);
  state.words = o.words; state.selection=o.selection; state.font=o.font; state.spacing=o.spacing; state.align=o.align;
  render();
}

function clearAll(){
  pushHistory();
  state.words=[]; state.selection={line:-1, word:-1};
  render();
}

function loadBgPreset(name){
  const path96 = `assets/presets/96x128/${name}.png`;
  const path64 = `assets/presets/64x64/${name}.png`;
  const use96 = (state.res.w===96 && state.res.h===128);
  const use64 = (state.res.w===64 && state.res.h===64);
  const src = use96 ? path96 : path64;
  const img = new Image();
  img.onload = ()=>{ state.bg={type:'preset', name, img, color:'#000000'}; render(); };
  img.src = src;
}

function setSolidColor(hex){
  state.bg={type:'solid', color:hex, img:null, name:'Solid'};
  render();
}

function loadCustomBg(file){
  const img = new Image();
  const reader = new FileReader();
  reader.onload = e=>{ img.onload=()=>{ state.bg={type:'upload', name:'Upload', img, color:'#000'}; render(); }; img.src=e.target.result; };
  reader.readAsDataURL(file);
}

function addWord(text='WORD'){
  if(!state.words.length) state.words.push([]);
  const line = state.words.length-1;
  state.words[line].push({text, color:'#ffffff', anim:'none', animOpts:{speed:1, amp:2}, x:0, y:0});
  state.selection={line, word:state.words[line].length-1};
  pushHistory();
  render();
}
function addLine(){ state.words.push([]); pushHistory(); render(); }

// Input handling (space -> new word, enter -> new line)
const inputBox = $('#typebox');
inputBox.addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){
    e.preventDefault(); if(inputBox.value.trim().length){ addWord(inputBox.value.trim()); } addLine(); inputBox.value=''; return;
  }
  if(e.key===' '){
    e.preventDefault();
    if(inputBox.value.trim().length){ addWord(inputBox.value.trim()); inputBox.value=''; }
  }
});

$('#addWord').onclick=()=>{ if(inputBox.value.trim().length){ addWord(inputBox.value.trim()); inputBox.value=''; } else addWord('WORD'); };
$('#addLine').onclick=()=> addLine();

function deselect(){ state.selection={line:-1, word:-1}; render(); }

screen.addEventListener('click', (e)=>{
  // Click to deselect if blank area (simple)
  deselect();
});

// Selection chips
function rebuildChips(){
  const wrap = $('#chips'); wrap.innerHTML='';
  state.words.forEach((line, li)=>{
    const row = document.createElement('div'); row.className='row';
    line.forEach((w, wi)=>{
      const chip = document.createElement('div'); chip.className='wordchip'+(state.selection.line===li&&state.selection.word===wi?' active':'');
      chip.innerHTML = `<span>${w.text}</span> <span class="del" title="Delete">×</span>`;
      chip.onclick=()=>{ state.selection={line:li, word:wi}; render(); };
      chip.querySelector('.del').onclick=(ev)=>{ ev.stopPropagation(); line.splice(wi,1); state.selection={line:-1, word:-1}; pushHistory(); render(); };
      row.appendChild(chip);
    });
    wrap.appendChild(row);
  });
}

function applyFont(){
  const fam = $('#fontFamily').value;
  const size = parseInt($('#fontSize').value,10);
  state.font.family=fam; state.font.size=size;
  state.font.autosize = $('#autoSize').checked;
  render();
}

function changeSpacing(){
  state.spacing.line = parseInt($('#lineSpace').value,10);
  state.spacing.word = parseInt($('#wordSpace').value,10);
  render();
}

$('#fontFamily').onchange=applyFont;
$('#fontSize').oninput=applyFont;
$('#autoSize').onchange=applyFont;
$('#lineSpace').oninput=changeSpacing;
$('#wordSpace').oninput=changeSpacing;

$('#alignLeft').onclick=()=>{ state.align.h='left'; render(); };
$('#alignCenter').onclick=()=>{ state.align.h='center'; render(); };
$('#alignRight').onclick=()=>{ state.align.h='right'; render(); };
$('#alignReset').onclick=()=>{ state.align={h:'center', v:'center', manual:false, offsetX:0, offsetY:0}; render(); };

$('#toggleInspector').onclick=()=> $('#inspector').classList.toggle('open');
$('#undo').onclick=undo; $('#redo').onclick=redo; $('#clear').onclick=clearAll;

$('#modeEdit').onclick=()=>{ state.mode='edit'; render(); };
$('#modePreview').onclick=()=>{ state.mode='preview'; render(); };

$('#solidColor').oninput=(e)=> setSolidColor(e.target.value);
$('#uploadBg').onchange=(e)=> loadCustomBg(e.target.files[0]);

$('#saveCfg').onclick=()=>{
  const out = {
    res: state.res, bgtype: state.bg.type, words: state.words, font: state.font, spacing: state.spacing, align: state.align, swatches: state.swatches
  };
  const blob = new Blob([JSON.stringify(out,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='session.json'; a.click();
};

$('#renderGIF').onclick=async()=>{
  const fps = parseInt($('#fps').value,10)||12;
  const seconds = parseInt($('#seconds').value,10)||3;
  const frames = fps*seconds;
  const delay = Math.max(2, Math.round(100/fps)); // hundredths
  const encoder = new TinyGIF(canvas.width, canvas.height, {repeat:0, delay});
  // simulate preview timeline while capturing
  const start = performance.now();
  for(let i=0;i<frames;i++){
    const t = i / fps;
    render(t);
    encoder.addFrame(ctx);
    await new Promise(r=>setTimeout(r,0));
  }
  const blob = encoder.render();
  const name = ($('#filename').value || 'animation') + '.gif';
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
};

// Rendering
function applyAnimOffset(word, baseX, baseY, t){
  if(!t) t=0; // when not preview-rendering, t=0
  const sp = (word.animOpts?.speed ?? 1);
  const amp = (word.animOpts?.amp ?? 2);
  switch(word.anim){
    case 'pulse': return {x:baseX, y:baseY, scale: 1 + 0.1*Math.sin((t*sp)*6.28)};
    case 'flicker': return {x:baseX, y:baseY, alpha: 0.7 + 0.3*Math.random()};
    case 'bounce': return {x:baseX, y:baseY + Math.round(Math.sin((t*sp)*6.28)*amp)};
    case 'wave': return {x:baseX + Math.round(Math.sin((t*sp)*6.28)*amp), y:baseY};
    case 'scroll': return {x:baseX - Math.round((t*sp*10)% (canvas.width+40)), y:baseY};
    case 'bubble': return {x:baseX + Math.round(Math.sin((t*sp)*6.28)*amp), y:baseY + Math.round(Math.cos((t*sp)*6.28)*amp)};
    default: return {x:baseX, y:baseY};
  }
}

function render(t=0){
  // background
  if(state.bg.type==='solid'){
    ctx.fillStyle = state.bg.color; ctx.fillRect(0,0,canvas.width,canvas.height);
  }else if(state.bg.img){
    ctx.drawImage(state.bg.img, 0,0, canvas.width, canvas.height);
  }else{
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  // calculate layout
  ctx.textBaseline='top';
  ctx.fillStyle='#fff';
  ctx.font = `${state.font.size}px ${state.font.family}`;
  // autosize
  if(state.font.autosize){
    let size = state.res.w>state.res.h ? Math.floor(state.res.h/8) : Math.floor(state.res.w/8);
    size = Math.max(8, Math.min(28, size));
    ctx.font = `${size}px ${state.font.family}`;
  }
  // measure
  const lines = state.words.map(line=> line.map(w=>{
    const m = ctx.measureText(w.text);
    return {w: Math.ceil(m.width), h: Math.ceil(state.font.autosize? parseInt(ctx.font): state.font.size)};
  }));
  const lineHeights = lines.map(words=> words.length? Math.max(...words.map(m=>m.h)): (state.font.autosize? parseInt(ctx.font): state.font.size));
  const totalH = lineHeights.reduce((a,b)=>a+b,0) + Math.max(0,(state.words.length-1)*state.spacing.line);
  let y0 = (canvas.height-totalH)/2;
  if(state.align.v==='top') y0=0; if(state.align.v==='bottom') y0=canvas.height-totalH;
  y0 += state.align.offsetY;
  // Render words
  state.words.forEach((line, li)=>{
    const lw = lines[li].reduce((a,m)=>a+m.w,0) + Math.max(0,(line.length-1)*state.spacing.word);
    let x = (canvas.width-lw)/2;
    if(state.align.h==='left') x=0; if(state.align.h==='right') x=canvas.width-lw;
    x += state.align.offsetX;
    const h = lineHeights[li];
    line.forEach((word, wi)=>{
      const m = lines[li][wi];
      const sel = (state.selection.line===li && state.selection.word===wi);
      const pos = applyAnimOffset(word, x, y0, state.mode==='preview'? t : 0);
      const alpha = (pos.alpha!==undefined? pos.alpha : 1);
      const scale = (pos.scale||1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = word.color||'#fff';
      ctx.translate(pos.x, pos.y);
      ctx.scale(scale, scale);
      ctx.fillText(word.text, 0, 0);
      ctx.restore();
      if(sel){
        // magenta glowing dotted outline
        ctx.save();
        ctx.strokeStyle='rgba(255,0,200,.8)';
        ctx.setLineDash([2,2]);
        ctx.strokeRect(x-2, y0-2, m.w+4, h+4);
        ctx.restore();
      }
      x += m.w + state.spacing.word;
    });
    y0 += h + state.spacing.line;
  });
  // blit to screen (scaled)
  screenCtx.imageSmoothingEnabled=false;
  screenCtx.clearRect(0,0,screen.width,screen.height);
  screenCtx.drawImage(canvas,0,0);
  rebuildChips();
}

function loadVisibleThumbs(){
  const grid = $('#thumbgrid'); grid.innerHTML='';
  const is96 = (state.res.w===96 && state.res.h===128);
  const list = [
    ...(is96? ['Preset_A','Preset_B'] : ['Preset_C','Preset_D']),
    'Solid', 'Upload'
  ];
  for(const name of list){
    const div=document.createElement('div'); div.className='thumb';
    const img=document.createElement('img');
    img.alt=name;
    if(name==='Solid') img.src='assets/thumbs/Solid_thumb.png';
    else if(name==='Upload') img.src='assets/thumbs/Upload_thumb.png';
    else img.src=`assets/thumbs/${name}_thumb.png`;
    div.onclick=()=>{
      $$('.thumb').forEach(x=>x.classList.remove('active'));
      div.classList.add('active');
      if(name==='Solid'){ setSolidColor($('#solidColor').value); }
      else if(name==='Upload'){ $('#uploadBg').click(); }
      else{ loadBgPreset(name); }
    };
    grid.appendChild(div);
  }
}

function init(){
  setResolution(96,128);
  loadBgPreset('Preset_A');
  render();
  // UI bindings
  $('#res96').onclick=()=> setResolution(96,128);
  $('#res64').onclick=()=> setResolution(64,64);
  $('#manualDrag').onchange=(e)=>{ state.manualDrag=e.target.checked; };
  $('#aboutBtn').onclick=()=> alert('LED Backpack Animator v2.1 — local, offline, no tracking.');
  // Defaults in form
  $('#fps').value=state.render.fps;
  $('#seconds').value=state.render.seconds;
  $('#filename').value='animation';
}

window.addEventListener('load', init);
