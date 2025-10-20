
// LED Backpack Animator v2.1 (STABLE)

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const selectionOverlay = document.getElementById('selectionOverlay');
const deleteWordBtn = document.getElementById('deleteWord');

const modeSel = document.getElementById('mode');
const resSel = document.getElementById('resolution');
const btnAddWord = document.getElementById('btnAddWord');
const btnAddLine = document.getElementById('btnAddLine');
const btnClear = document.getElementById('btnClear');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnToggleInspector = document.getElementById('btnToggleInspector');
const btnDownloadCfg = document.getElementById('btnDownloadCfg');

const bgRadios = document.querySelectorAll('input[name="bgmode"]');
const presetGrid = document.getElementById('presetGrid');
const solidPicker = document.getElementById('solidPicker');
const customUpload = document.getElementById('customUpload');
const solidColor = document.getElementById('solidColor');
const fileInput = document.getElementById('fileInput');

const inspector = document.getElementById('inspector');
const btnInspectorOpenClose = document.getElementById('btnInspectorOpenClose');

const fontSelect = document.getElementById('fontSelect');
const fontSize = document.getElementById('fontSize');
const autoSize = document.getElementById('autoSize');
const fontColor = document.getElementById('fontColor');
const btnAddSwatch = document.getElementById('btnAddSwatch');
const btnDelSwatch = document.getElementById('btnDelSwatch');
const swatches = document.getElementById('swatches');

const lineSpacing = document.getElementById('lineSpacing');
const wordSpacing = document.getElementById('wordSpacing');
const paddingRange = document.getElementById('padding');

const hAlign = document.getElementById('hAlign');
const vAlign = document.getElementById('vAlign');
const btnResetAlign = document.getElementById('btnResetAlign');

const animToggles = document.querySelectorAll('.anim');
const animRanges = document.querySelectorAll('.animRange');
const btnAnimReset = document.getElementById('btnAnimReset');

const manualDrag = document.getElementById('manualDrag');
const dragWarning = document.getElementById('dragWarning');
const disableDragWarning = document.getElementById('disableDragWarning');

// State
let state = {
  resolution: "96x128",
  bgMode: "preset",
  bgSolid: "#000000",
  bgPreset: "A",
  bgCustom: null, // Image bitmap
  words: [], // [{text, x, y, color, font, size}]
  selection: { line: 0, word: 0 },
  history: [],
  future: [],
  swatches: ["#ffffff", "#ff007f", "#00e5ff", "#00ff7f", "#ffd000"],
  spacing: { line: 6, word: 4, padding: 2 },
  align: { h: "center", v: "middle", manualX: 0, manualY: 0 },
  animations: {
    pulse: { on:false, val:50 },
    flicker: { on:false, val:50 },
    bounce: { on:false, val:50 },
    wave:   { on:false, val:50 },
    scroll: { on:false, val:50 },
    bubble: { on:false, val:50 },
  },
  mode: "edit",
  showDragWarn: true
};

// Helpers
function pushHistory() {
  const clone = JSON.parse(JSON.stringify(state));
  // avoid cloning heavy images
  clone.bgCustom = !!state.bgCustom;
  state.history.push(clone);
  if (state.history.length > 20) state.history.shift();
  state.future = [];
}

function undo() {
  if (!state.history.length) return;
  state.future.push(JSON.parse(JSON.stringify(state)));
  const prev = state.history.pop();
  // restore shallow, ignoring bgCustom bitmap
  prev.bgCustom = state.bgCustom;
  state = prev;
  render();
}
function redo() {
  if (!state.future.length) return;
  state.history.push(JSON.parse(JSON.stringify(state)));
  const next = state.future.pop();
  next.bgCustom = state.bgCustom;
  state = next;
  render();
}

function setResolution(res) {
  const [w,h] = res.split('x').map(Number);
  canvas.width = w; canvas.height = h;
  state.resolution = res;
  buildPresetGrid(); // filter by resolution
  render();
}

function buildPresetGrid() {
  presetGrid.innerHTML = "";
  fetch('assets/manifest.json').then(r=>r.json()).then(man=>{
    const items = man[state.resolution] || [];
    // Add preset cards (from manifest)
    items.forEach((item)=>{
      const card = document.createElement('div');
      card.className = "preset-card";
      const img = document.createElement('img');
      img.src = item.thumb;
      img.alt = item.name;
      card.appendChild(img);
      const cap = document.createElement('div');
      cap.className = "small";
      cap.textContent = item.name;
      card.appendChild(cap);
      card.addEventListener('click', ()=>{
        state.bgPreset = item.path; // full path to preset image
        state.bgMode = "preset";
        document.querySelector('input[name="bgmode"][value="preset"]').checked = true;
        render();
      });
      presetGrid.appendChild(card);
    });
    // Add "special" cards for Solid and Upload
    man.special.forEach((sp)=>{
      const card = document.createElement('div');
      card.className = "preset-card";
      const img = document.createElement('img');
      img.src = sp.thumb;
      img.alt = sp.name;
      card.appendChild(img);
      const cap = document.createElement('div');
      cap.className = "small";
      cap.textContent = sp.name;
      card.appendChild(cap);
      card.addEventListener('click', ()=>{
        document.querySelector(`input[name="bgmode"][value="${sp.mode}"]`).checked = true;
        setBgMode(sp.mode);
        if (sp.mode === "solid") { /* keep current color */ }
        if (sp.mode === "custom") { /* user will upload */ }
        render();
      });
      presetGrid.appendChild(card);
    });
  });
}

function tick() {
  if (state.mode === "preview") {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawBackground();
    if (state.bgMode!=="preset") drawText();
  }
  requestAnimationFrame(tick);
}

// Event wiring
window.addEventListener('resize', ()=>{ getCanvasCSSScale(); drawSelectionOverlay(computeLayout()); });

btnAddWord.addEventListener('click', ()=>{ addWord("WORD"); });
btnAddLine.addEventListener('click', ()=>{ addLine(); });
btnClear.addEventListener('click', ()=>{ clearAll(); });
btnUndo.addEventListener('click', ()=>{ undo(); });
btnRedo.addEventListener('click', ()=>{ redo(); });

btnToggleInspector.addEventListener('click', ()=>{
  inspector.classList.toggle('open');
});
btnInspectorOpenClose.addEventListener('click', ()=>{
  inspector.classList.toggle('open');
});

btnDownloadCfg.addEventListener('click', ()=>{
  const cfg = JSON.stringify(state, null, 2);
  const blob = new Blob([cfg], {type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "LEDAnimator_v2.1_config.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

resSel.addEventListener('change', ()=>{
  setResolution(resSel.value);
});

modeSel.addEventListener('change', ()=>{
  state.mode = modeSel.value;
});

bgRadios.forEach(r=>r.addEventListener('change', ()=>{
  setBgMode(document.querySelector('input[name="bgmode"]:checked').value);
  render();
}));
solidColor.addEventListener('input', ()=>{
  state.bgSolid = solidColor.value;
  render();
});
fileInput.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const img = new Image();
    img.onload = ()=>{
      createImageBitmap(img).then(bmp=>{
        state.bgCustom = bmp;
        setBgMode("custom");
        document.querySelector('input[name="bgmode"][value="custom"]').checked = true;
        render();
      });
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

fontSelect.addEventListener('change', ()=>{ pushHistory(); render(); });
fontSize.addEventListener('input', ()=>{ pushHistory(); render(); });
autoSize.addEventListener('change', ()=>{ pushHistory(); render(); });
fontColor.addEventListener('input', ()=>{
  if (state.selection.word>=0) {
    // apply to selected
    state.words[state.selection.line][state.selection.word].color = fontColor.value;
  }
  pushHistory(); render();
});

btnAddSwatch.addEventListener('click', ()=>{
  state.swatches.push(fontColor.value);
  refreshSwatches();
});
btnDelSwatch.addEventListener('click', ()=>{
  state.swatches.pop();
  refreshSwatches();
});

lineSpacing.addEventListener('input', ()=>{ state.spacing.line = Number(lineSpacing.value); render(); });
wordSpacing.addEventListener('input', ()=>{ state.spacing.word = Number(wordSpacing.value); render(); });
paddingRange.addEventListener('input', ()=>{ state.spacing.padding = Number(paddingRange.value); render(); });

hAlign.addEventListener('change', ()=>{ state.align.h = hAlign.value; render(); });
vAlign.addEventListener('change', ()=>{ state.align.v = vAlign.value; render(); });
btnResetAlign.addEventListener('click', ()=>{ state.align = {h:"center", v:"middle", manualX:0, manualY:0}; hAlign.value="center"; vAlign.value="middle"; render(); });

animToggles.forEach(t=>t.addEventListener('change', ()=>{
  const name = t.dataset.name; state.animations[name].on = t.checked; render();
}));
animRanges.forEach(r=>r.addEventListener('input', ()=>{
  const name = r.dataset.name; state.animations[name].val = Number(r.value);
}));
btnAnimReset.addEventListener('click', ()=>{
  Object.keys(state.animations).forEach(k=>{ state.animations[k]={on:false,val:50}; });
  animToggles.forEach(t=>t.checked=false);
  animRanges.forEach(r=>r.value=50);
  render();
});

manualDrag.addEventListener('change', ()=>{
  if (manualDrag.checked && state.showDragWarn) {
    dragWarning.style.display = "block";
  } else {
    dragWarning.style.display = "none";
  }
});

disableDragWarning.addEventListener('change', ()=>{
  state.showDragWarn = !disableDragWarning.checked;
});

// Canvas interactions
document.querySelector('.canvas-stage').addEventListener('mousedown', (e)=>{
  const rect = canvas.getBoundingClientRect();
  const scale = getCanvasCSSScale();
  const x = (e.clientX - rect.left)/scale;
  const y = (e.clientY - rect.top)/scale;

  // hit test
  const lines = computeLayout();
  let hit = null;
  lines.forEach((L, li)=>{
    L.elements.forEach((E, wi)=>{
      const box = {x:E.x, y:E.y - E.height, w:E.width, h:E.height};
      if (x>=box.x && x<=box.x+box.w && y>=box.y && y<=box.y+box.h) hit = {li, wi};
    });
  });
  if (hit) {
    state.selection = { line: hit.li, word: hit.wi };
    render();
  } else {
    // deselect
    state.selection = { line: -1, word: -1 };
    render();
  }
});

deleteWordBtn.addEventListener('click', ()=>{
  const {line, word} = state.selection;
  if (line>=0 && word>=0 && state.words[line]) {
    state.words[line].splice(word,1);
    if (!state.words[line].length) state.words.splice(line,1);
    state.selection = {line:-1, word:-1};
    pushHistory();
    render();
  }
});

// Typing/editing
document.addEventListener('keydown', (e)=>{
  if (e.key === " "){ e.preventDefault(); addWord("WORD"); return; }
  if (e.key === "Enter"){ e.preventDefault(); addLine(); return; }

  const {line, word} = state.selection;
  if (line>=0 && word>=0) {
    if (e.key === "Backspace") {
      state.words[line][word].text = state.words[line][word].text.slice(0,-1);
      pushHistory(); render(); return;
    }
    if (e.key.length === 1) {
      state.words[line][word].text += e.key;
      pushHistory(); render(); return;
    }
  }
});

function refreshSwatches() {
  swatches.innerHTML = "";
  state.swatches.forEach(c=>{
    const div = document.createElement('div');
    div.className = "swatch";
    div.style.background = c;
    div.addEventListener('click', ()=>{
      fontColor.value = c;
      if (state.selection.word>=0) {
        state.words[state.selection.line][state.selection.word].color = c;
      }
      render();
    });
    swatches.appendChild(div);
  });
}

function init() {
  setResolution(state.resolution);
  buildPresetGrid();
  refreshSwatches();
  getCanvasCSSScale();
  render();
  requestAnimationFrame(tick);
}

init();
