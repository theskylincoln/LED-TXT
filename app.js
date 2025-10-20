/* LED Backpack Animator v2.1 — app.js
 * Implements requested layout/behavior updates.
 */

(() => {
  // ---------- DOM ----------
  const $ = (sel, p=document) => p.querySelector(sel);
  const $$ = (sel, p=document) => Array.from(p.querySelectorAll(sel));

  const canvas = $("#led");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const resSelect = $("#resSelect");
  const zoomRange = $("#zoom");
  const modeEditBtn = $("#modeEdit");
  const modePrevBtn = $("#modePreview");
  const undoBtn = $("#undoBtn");
  const redoBtn = $("#redoBtn");
  const aboutBtn = $("#aboutBtn");
  const aboutModal = $("#aboutModal");
  const aboutClose = $("#aboutClose");

  const bgThumbs = $("#bgThumbs");
  const bgSolidBtn = $("#bgSolidBtn");
  const bgSolidColor = $("#bgSolidColor");
  const bgUpload = $("#bgUpload");

  const addWordBtn = $("#addWordBtn");
  const addLineBtn = $("#addLineBtn");
  const delWordBtn = $("#delWordBtn");
  const manualDragChk = $("#manualDragChk");
  const dragWarn = $("#dragWarn");
  const dragWarnOk = $("#dragWarnOk");
  const dragWarnCancel = $("#dragWarnCancel");
  const suppressDragWarn = $("#suppressDragWarn");

  const fpsInput = $("#fps");
  const secInput = $("#seconds");
  const renderGifBtn = $("#renderGifBtn");
  const downloadLink = $("#downloadLink");
  const fileNameInput = $("#fileName");
  const saveJsonBtn = $("#saveJsonBtn");
  const loadJsonInput = $("#loadJsonInput");

  const toggleInspector = $("#toggleInspector");
  const inspectorBody = $("#inspectorBody");
  const fontSelect = $("#fontSelect");
  const fontSize = $("#fontSize");
  const autoSize = $("#autoSize");
  const fontColor = $("#fontColor");
  const lineGap = $("#lineGap");
  const wordGap = $("#wordGap");
  const animSelect = $("#animSelect"); // kept for API compatibility, not shown in new layout

  const alignBtns = $$("[data-align]");
  const vAlignBtns = $$("[data-valign]");
  const applyAllAlign = $("#applyAllAlign");

  const addSwatchBtn = $("#addSwatchBtn");
  const clearSwatchesBtn = $("#clearSwatchesBtn");

  // ---------- STATE ----------
  const state = {
    mode: "edit",
    zoom: 2, // ~20% less than 2.5-3, good for laptop
    res: { w: 96, h: 128 },
    vAlign: "middle", // top|middle|bottom
    background: { type: "solid", color: "#000000", image: null, name: "solid" },
    lines: [
      { words: [ { text: "HELLO", color: "#FFFFFF", font: "monospace", size: 22, align: "center", anim: "none", x: 0, y: 0, manual:false } ], align: "center" }
    ],
    selection: { line: 0, word: 0 },
    undo: [],
    redo: [],
    preventCutoff: true,
    autoSize: true,
    spacing: { lineGap: 4, word: 6 },
    dragPromptDismissed: false,
    dragActive: false,
    customSwatches: [], // persisted in config
    bgImages: {
      "96x128": [
        { key:"Preset_A", preset:"assets/Presets/96x128/Preset_A.png", thumb:"assets/Thumbs/Preset_A_thumb.png" },
        { key:"Preset_B", preset:"assets/Presets/96x128/Preset_B.png", thumb:"assets/Thumbs/Preset_B_thumb.png" },
      ],
      "64x64": [
        { key:"Preset_C", preset:"assets/Presets/64x64/Preset_C.png", thumb:"assets/Thumbs/Preset_C_thumb.png" },
        { key:"Preset_D", preset:"assets/Presets/64x64/Preset_D.png", thumb:"assets/Thumbs/Preset_D_thumb.png" },
      ],
    }
  };

  // Built-in preset colors (still available)
  const PRESET_COLORS = [
    "#FFFFFF","#FFD700","#FF7F50","#FF3B3B","#00FFAA",
    "#00BFFF","#1E90FF","#8A2BE2","#FF00FF","#00FF00",
    "#FFA500","#C0C0C0"
  ];

  // ---------- UTIL ----------
  function pushUndo() {
    state.undo.push(JSON.stringify({
      lines: state.lines,
      background: { ...state.background, image: undefined },
      spacing: state.spacing,
      vAlign: state.vAlign,
      customSwatches: state.customSwatches
    }));
    if (state.undo.length > 100) state.undo.shift();
    state.redo.length = 0;
  }

  function loadFromJSON(obj) {
    pushUndo();
    state.lines = obj.lines || state.lines;
    state.background = { ...(obj.background||state.background), image: null };
    state.spacing = obj.spacing || state.spacing;
    state.vAlign = obj.vAlign || "middle";
    state.customSwatches = Array.isArray(obj.customSwatches) ? obj.customSwatches.slice(0,48) : [];
    state.selection = { line: 0, word: 0 };
    buildColorSwatches(); // rebuild custom swatches
    render();
  }

  function selectedWord() {
    if (!state.selection) return null;
    const L = state.lines[state.selection.line]; if (!L) return null;
    const W = L.words[state.selection.word]; return W || null;
  }

  // Zoom: center the canvas via CSS; only need to set scale value
  function applyZoom() {
    canvas.style.transform = `translate(-50%,-50%) scale(${state.zoom})`;
  }

  function setCanvasResolution() {
    const { w, h } = state.res;
    canvas.width = w;
    canvas.height = h;
    applyZoom();
  }

  function setMode(m) {
    state.mode = m;
    modeEditBtn.classList.toggle("active", m==="edit");
    modePrevBtn.classList.toggle("active", m==="preview");
  }

  function measureWordBounds(word) {
    ctx.save();
    ctx.font = `${word.size}px ${word.font}`;
    const tm = ctx.measureText(word.text || "");
    const w = Math.max(1, (tm.actualBoundingBoxRight - tm.actualBoundingBoxLeft) || tm.width);
    const h = Math.max(1, (tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent) || (word.size * 0.8));
    ctx.restore();
    return { w, h };
  }

  function lineWidth(line) {
    let tot = 0;
    for (let i=0;i<line.words.length;i++){
      const m = measureWordBounds(line.words[i]);
      tot += m.w;
      if (i < line.words.length-1) tot += state.spacing.word;
    }
    return tot;
  }

  function totalLinesHeight() {
    return state.lines.reduce((sum, line, idx) => {
      const maxH = Math.max(...line.words.map(w=>measureWordBounds(w).h), 1);
      return sum + maxH + (idx? state.spacing.lineGap:0);
    }, 0);
  }

  function layoutContent() {
    const pad = 4;
    const totalH = totalLinesHeight();
    let y;
    if (state.vAlign === "top") y = pad + 2;
    else if (state.vAlign === "bottom") y = Math.max(pad, state.res.h - totalH - pad);
    else y = Math.round((state.res.h - totalH)/2) + pad; // middle

    for (let li=0; li<state.lines.length; li++) {
      const line = state.lines[li];
      const lh = Math.max(...line.words.map(w=>measureWordBounds(w).h), 1);
      const lw = lineWidth(line);
      let xStart = 0;
      const align = line.align || "center";
      if (align === "center") {
        xStart = Math.round((state.res.w - lw)/2);
      } else if (align === "right") {
        xStart = Math.round(state.res.w - lw - pad);
      } else {
        xStart = pad;
      }
      let x = xStart;
      for (let wi=0; wi<line.words.length; wi++) {
        const w = line.words[wi];
        if (!w.manual) {
          w.x = x;
          w.y = y + lh; // baseline
        }
        const m = measureWordBounds(w);
        x += m.w + (wi<line.words.length-1 ? state.spacing.word : 0);
      }
      y += lh + state.spacing.lineGap;
    }
  }

  function drawBackground() {
    const { type, color, image } = state.background;
    if (type === "solid" || !image) {
      ctx.fillStyle = color || "#000";
      ctx.fillRect(0,0,canvas.width, canvas.height);
    } else {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
  }

  function applyAnimationToWord(w, tSec) {
    switch (w.anim) {
      case "pulse":   return { dx:0, dy:0, scale: 0.9 + 0.1*Math.sin(tSec*6), alpha:1 };
      case "flicker": return { dx:0, dy:0, scale:1, alpha: (Math.sin(tSec*50)>0? 1:0.6) };
      case "slide":   return { dx: Math.round(5*Math.sin(tSec*4)), dy:0, scale:1, alpha:1 };
      case "bounce":  return { dx:0, dy: Math.round(4*Math.abs(Math.sin(tSec*6))), scale:1, alpha:1 };
      case "wave":    return { dx:0, dy: Math.round(3*Math.sin((w.x + tSec*40)/10)), scale:1, alpha:1 };
      default:        return { dx:0, dy:0, scale:1, alpha:1 };
    }
  }

  function autosizeIfNeeded() {
    if (!state.autoSize) return;
    const pad = 6;
    const maxW = state.res.w - pad*2;

    for (const line of state.lines) {
      let tries = 0;
      while (tries < 40) {
        const lw = lineWidth(line);
        if (lw <= maxW) break;
        for (const w of line.words) {
          w.size = Math.max(6, Math.floor(w.size * 0.96));
        }
        tries++;
      }
    }
  }

  function render(timestamp=0) {
    autosizeIfNeeded();
    layoutContent();
    drawBackground();

    const tSec = timestamp/1000;
    for (let li=0; li<state.lines.length; li++) {
      const line = state.lines[li];
      for (let wi=0; wi<line.words.length; wi++) {
        const w = line.words[wi];
        const m = measureWordBounds(w);
        const { dx, dy, scale, alpha } = state.mode==="preview" ? applyAnimationToWord(w, tSec) : {dx:0,dy:0,scale:1,alpha:1};

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(w.x + dx, w.y + dy);
        ctx.scale(scale, scale);
        ctx.font = `${w.size}px ${w.font}`;
        ctx.fillStyle = w.color;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(w.text, 0, 0);
        ctx.restore();

        if (state.mode==="edit" && state.selection && state.selection.line===li && state.selection.word===wi) {
          const padX=2, padY=1;
          const left = w.x - padX;
          const top = (w.y - m.h) - padY;
          const boxW = m.w + padX*2;
          const boxH = m.h + padY*2;
          ctx.save();
          ctx.shadowColor = "#ff49c1";
          ctx.shadowBlur = 2;
          ctx.strokeStyle = "#ff49c1";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(left, top, boxW, boxH);
          ctx.restore();

          const blink = ((performance.now()/500)|0)%2===0;
          if (blink) {
            ctx.fillStyle="#fff";
            ctx.fillRect(w.x + m.w, w.y - m.h, 1, m.h);
          }
        }
      }
    }
    requestAnimationFrame(render);
  }

  // ---------- EVENTS ----------
  function setZoomFromUI() {
    state.zoom = parseFloat(zoomRange.value);
    applyZoom();
  }

  resSelect.addEventListener("change", () => {
    const val = resSelect.value;
    if (val==="96x128") state.res={w:96,h:128};
    else state.res={w:64,h:64};
    setCanvasResolution();
    buildBgThumbs();
  });

  modeEditBtn.addEventListener("click", () => setMode("edit"));
  modePrevBtn.addEventListener("click", () => setMode("preview"));
  zoomRange.addEventListener("input", setZoomFromUI);

  aboutBtn.addEventListener("click", ()=> aboutModal.classList.remove("hidden"));
  aboutClose.addEventListener("click", ()=> aboutModal.classList.add("hidden"));
  $("#aboutModal").addEventListener("click", (e)=>{ if (e.target.id==="aboutModal") aboutModal.classList.add("hidden"); });

  // Inspector toggle (manual)
  toggleInspector.addEventListener("click", () => {
    const nowCollapsed = inspectorBody.classList.toggle("collapsed");
    toggleInspector.setAttribute("aria-expanded", (!nowCollapsed).toString());
  });

  // Keep inspector in sync with selection
  function refreshInspectorFromSelection() {
    const w = selectedWord();
    if (!w) return;
    if ($("#autoOpenInspector")?.checked) {
      inspectorBody.classList.remove("collapsed");
      toggleInspector.setAttribute("aria-expanded", "true");
    }
    fontSelect.value = w.font || "monospace";
    fontSize.value = w.size || 22;
    fontColor.value = w.color || "#FFFFFF";
  }

  function getActive() { return selectedWord(); }

  fontSelect.addEventListener("change", ()=>{ const w=getActive(); if(!w)return; pushUndo(); w.font=fontSelect.value; });
  fontSize.addEventListener("change", ()=>{ const w=getActive(); if(!w)return; pushUndo(); w.size=parseInt(fontSize.value,10)||22; });
  autoSize.addEventListener("change", ()=>{ state.autoSize = autoSize.checked; });
  fontColor.addEventListener("input", ()=>{ const w=getActive(); if(!w)return; pushUndo(); w.color=fontColor.value; });
  lineGap.addEventListener("change", ()=>{ pushUndo(); state.spacing.lineGap = parseInt(lineGap.value,10)||4; });
  wordGap.addEventListener("change", ()=>{ pushUndo(); state.spacing.word = parseInt(wordGap.value,10)||6; });

  // Horizontal align
  alignBtns.forEach(btn=>btn.addEventListener("click", (e)=>{
    const align = e.currentTarget.getAttribute("data-align");
    pushUndo();
    const applyAll = applyAllAlign?.checked;
    if (applyAll) {
      state.lines.forEach(L => L.align = align);
    } else {
      const L = state.lines[state.selection?.line || 0];
      if (L){ L.align = align; }
    }
    alignBtns.forEach(b=>b.classList.toggle("active", b.getAttribute("data-align")===align));
  }));

  // Vertical align
  vAlignBtns.forEach(btn=>btn.addEventListener("click", (e)=>{
    const valign = e.currentTarget.getAttribute("data-valign"); // top/middle/bottom
    pushUndo();
    state.vAlign = valign;
    vAlignBtns.forEach(b=>b.classList.toggle("active", b.getAttribute("data-valign")===valign));
  }));

  // Color Swatches (preset + custom)
  function buildColorSwatches() {
    const wrap = document.getElementById("swatches");
    if (!wrap) return;
    wrap.innerHTML = "";
    const all = PRESET_COLORS.concat(state.customSwatches || []);
    all.slice(0, 48).forEach(col => {
      const btn = document.createElement("button");
      btn.className = "swatch";
      btn.style.background = col;
      btn.title = col;
      btn.addEventListener("click", ()=>{
        const w = selectedWord(); if (!w) return;
        pushUndo();
        w.color = col;
        if (fontColor) fontColor.value = col;
      });
      wrap.appendChild(btn);
    });
  }

  addSwatchBtn?.addEventListener("click", ()=>{
    const col = fontColor?.value || "#FFFFFF";
    if (!state.customSwatches.includes(col)) {
      state.customSwatches.push(col);
      if (state.customSwatches.length > 48) state.customSwatches.shift();
      buildColorSwatches();
    }
  });
  clearSwatchesBtn?.addEventListener("click", ()=>{
    state.customSwatches = [];
    buildColorSwatches();
  });

  // Background thumbnails
  function buildBgThumbs() {
    const key = `${state.res.w}x${state.res.h}`;
    const list = state.bgImages[key] || [];
    bgThumbs.innerHTML = "";
    list.forEach(item => {
      const div = document.createElement("div");
      div.className = "thumb";
      div.title = item.key;
      const img = document.createElement("img");
      img.src = item.thumb;
      img.alt = item.key + " thumb";
      img.onerror = () => { img.style.opacity = '0.4'; img.alt = item.key + " (thumb missing)"; };
      div.appendChild(img);
      div.addEventListener("click", async ()=>{
        try {
          const imgEl = await loadImage(item.preset);
          pushUndo();
          state.background = { type:"image", color:"#000000", image:imgEl, name:item.key };
        } catch (e) {
          console.warn("Preset load failed:", item.preset, e);
          alert("Could not load preset image:\\n" + item.preset + "\\nCheck filename/path and case.");
        }
      });
      bgThumbs.appendChild(div);
    });
  }

  bgSolidBtn.addEventListener("click", ()=>{
    pushUndo();
    state.background = { type:"solid", color:bgSolidColor.value, image:null, name:"solid" };
  });
  bgSolidColor.addEventListener("input", ()=>{
    if (state.background.type==="solid"){
      state.background.color = bgSolidColor.value;
    }
  });
  bgUpload.addEventListener("change", async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    pushUndo();
    state.background = { type:"image", color:"#000000", image:img, name:file.name };
  });

  function loadImage(src) {
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.onload = ()=> resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Canvas interactions
  let dragging = null;
  canvas.addEventListener("mousedown", (e)=>{
    const rect = canvas.getBoundingClientRect();
    const scale = state.zoom;
    const cx = Math.floor((e.clientX - rect.left)/scale);
    const cy = Math.floor((e.clientY - rect.top)/scale);

    let hit = null;
    for (let li=0; li<state.lines.length; li++){
      const L = state.lines[li];
      for (let wi=0; wi<L.words.length; wi++){
        const w = L.words[wi];
        const m = measureWordBounds(w);
        const left = w.x - 2, top = w.y - m.h - 1;
        if (cx>=left && cx<=left+m.w+4 && cy>=top && cy<=top+m.h+2){
          hit = {li, wi, w, m};
          break;
        }
      }
      if (hit) break;
    }

    if (hit){
      state.selection = { line: hit.li, word: hit.wi };
      refreshInspectorFromSelection();
      if (manualDragChk.checked) {
        if (!state.dragPromptDismissed && !sessionStorage.getItem("LED_dragSuppressed")) {
          dragWarn.classList.remove("hidden");
          return;
        }
        dragging = { li: hit.li, wi: hit.wi, offsetX: cx - hit.w.x, offsetY: cy - hit.w.y };
        state.lines[hit.li].words[hit.wi].manual = true;
      }
    } else {
      state.selection = null;
      inspectorBody.classList.add("collapsed");
      toggleInspector.setAttribute("aria-expanded", "false");
    }
  });

  canvas.addEventListener("mousemove", (e)=>{
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const scale = state.zoom;
    const cx = Math.floor((e.clientX - rect.left)/scale);
    const cy = Math.floor((e.clientY - rect.top)/scale);
    const w = state.lines[dragging.li].words[dragging.wi];
    w.x = cx - dragging.offsetX;
    w.y = cy - dragging.offsetY;
  });
  window.addEventListener("mouseup", ()=> dragging=null);

  // Word ops
  addWordBtn.addEventListener("click", ()=>{
    pushUndo();
    const L = state.lines[state.selection?.line || 0];
    const base = { text:"WORD", color:"#FFFFFF", font:"monospace", size:22, align:L?.align||"center", anim:"none", x:0,y:0, manual:false };
    if (!L) state.lines.push({ words:[base], align:"center" });
    else L.words.push(base);
    state.selection = { line: state.selection?.line || 0, word: (L? L.words.length-1:0) };
    refreshInspectorFromSelection();
  });

  addLineBtn.addEventListener("click", ()=>{
    pushUndo();
    state.lines.push({ words:[{ text:"NEW", color:"#FFFFFF", font:"monospace", size:22, align:"center", anim:"none", x:0,y:0, manual:false }], align:"center" });
    state.selection = { line: state.lines.length-1, word:0 };
    refreshInspectorFromSelection();
  });

  delWordBtn.addEventListener("click", ()=>{
    const sel = state.selection; if(!sel) return;
    pushUndo();
    const L = state.lines[sel.line];
    if (!L) return;
    L.words.splice(sel.word, 1);
    if (L.words.length===0) state.lines.splice(sel.line,1);
    state.selection = null;
    inspectorBody.classList.add("collapsed");
    toggleInspector.setAttribute("aria-expanded", "false");
  });

  // Typing
  window.addEventListener("keydown", (e)=>{
    if (state.mode!=="edit") return;
    const w = selectedWord(); if (!w) return;

    if (e.key === "Enter") {
      e.preventDefault();
      pushUndo();
      const li = state.selection.line;
      const wi = state.selection.word;
      const L = state.lines[li];
      const tail = L.words.splice(wi+1);
      state.lines.splice(li+1, 0, { words: [{ text:"", color:w.color, font:w.font, size:w.size, anim:w.anim, x:0,y:0, manual:false }].concat(tail), align:L.align || "center" });
      state.selection = { line: li+1, word: 0 };
      refreshInspectorFromSelection();
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      pushUndo();
      const li = state.selection.line;
      const wi = state.selection.word;
      const L = state.lines[li];
      L.words.splice(wi+1, 0, { text:"", color:w.color, font:w.font, size:w.size, anim:w.anim, x:0,y:0, manual:false });
      state.selection.word = wi+1;
      refreshInspectorFromSelection();
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      pushUndo();
      w.text = w.text.slice(0, -1);
      return;
    }

    if (e.key.length === 1) {
      pushUndo();
      w.text += e.key;
      return;
    }
  });

  // Undo/Redo
  undoBtn.addEventListener("click", ()=>{
    if (!state.undo.length) return;
    const snap = state.undo.pop();
    state.redo.push(JSON.stringify({
      lines: state.lines,
      background: { ...state.background, image: undefined },
      spacing: state.spacing,
      vAlign: state.vAlign,
      customSwatches: state.customSwatches
    }));
    const obj = JSON.parse(snap);
    state.lines = obj.lines; state.background = obj.background; state.spacing = obj.spacing;
    state.vAlign = obj.vAlign || "middle";
    state.customSwatches = Array.isArray(obj.customSwatches)? obj.customSwatches : [];
    buildColorSwatches();
  });

  redoBtn.addEventListener("click", ()=>{
    if (!state.redo.length) return;
    const snap = state.redo.pop();
    state.undo.push(JSON.stringify({
      lines: state.lines,
      background: { ...state.background, image: undefined },
      spacing: state.spacing,
      vAlign: state.vAlign,
      customSwatches: state.customSwatches
    }));
    const obj = JSON.parse(snap);
    state.lines = obj.lines; state.background = obj.background; state.spacing = obj.spacing;
    state.vAlign = obj.vAlign || "middle";
    state.customSwatches = Array.isArray(obj.customSwatches)? obj.customSwatches : [];
    buildColorSwatches();
  });

  // Save / Load JSON (persist customSwatches & vAlign)
  saveJsonBtn.addEventListener("click", ()=>{
    const payload = {
      lines: state.lines,
      background: { ...state.background, image: undefined },
      spacing: state.spacing,
      vAlign: state.vAlign,
      customSwatches: state.customSwatches
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "led_animator_config.json"; a.click();
    URL.revokeObjectURL(url);
  });

  loadJsonInput.addEventListener("change", async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      loadFromJSON(obj);
    } catch(err){
      alert("Invalid JSON.");
    }
  });

  // GIF encoder (same as before)
  function GifWriter() { this.parts = []; }
  GifWriter.prototype.write = function(u8){ this.parts.push(u8); };
  GifWriter.prototype.concat = function(){
    let len = this.parts.reduce((s,a)=>s+a.length,0);
    let out = new Uint8Array(len); let off=0;
    for(const a of this.parts){ out.set(a,off); off+=a.length; }
    return out;
  };
  function num(n){ return new Uint8Array([n&255]); }
  function word(n){ return new Uint8Array([n&255,(n>>8)&255]); }
  function colorTable(palette){
    const u = new Uint8Array(palette.length*3);
    for(let i=0;i<palette.length;i++){ const c=palette[i]; u[i*3]=c[0];u[i*3+1]=c[1];u[i*3+2]=c[2]; }
    return u;
  }
  function nearestIndex(palette, r,g,b){
    let best=0,bd=1e9;
    for(let i=0;i<palette.length;i++){
      const pr=palette[i][0], pg=palette[i][1], pb=palette[i][2];
      const d=(r-pr)*(r-pr)+(g-pg)*(g-pg)+(b-pb)*(b-pb);
      if(d<bd){bd=d;best=i;}
    }
    return best;
  }
  function buildPalette(imgData){
    const set = new Map();
    const d = imgData.data;
    for(let i=0;i<d.length;i+=4){
      const a=d[i+3]; if(a<10){ continue; }
      const key=(d[i]<<16)|(d[i+1]<<8)|(d[i+2]);
      set.set(key,true);
      if(set.size>=256) break;
    }
    const arr = Array.from(set.keys()).map(k=>[(k>>16)&255,(k>>8)&255,k&255]);
    if(arr.length===0) arr.push([0,0,0]);
    while(arr.length&(arr.length-1)) arr.push(arr[arr.length-1]);
    if(arr.length>256) arr.length=256;
    return arr;
  }
  function lzwEncode(indices, minCodeSize){
    const CLEAR = 1<<minCodeSize, END = CLEAR+1;
    let dict = new Map();
    let codeSize = minCodeSize+1;
    let next = END+1;
    const out=[]; let cur=0, curBits=0;
    function write(code){
      cur |= code<<curBits; curBits += codeSize;
      while(curBits>=8){ out.push(cur&255); cur>>=8; curBits-=8; }
    }
    function reset(){
      dict = new Map();
      codeSize = minCodeSize+1;
      next = END+1;
      write(CLEAR);
    }
    reset();
    let w = indices[0];
    for(let i=1;i<indices.length;i++){
      const k = indices[i];
      const wk = (w<<8)|k;
      if(dict.has(wk)){
        w = dict.get(wk);
      } else {
        write(w);
        dict.set(wk, next++);
        if(next === (1<<codeSize) && codeSize<12) codeSize++;
        w = k;
      }
    }
    write(w);
    write(END);
    if(curBits>0) out.push(cur&255);
    return new Uint8Array(out);
  }

  async function renderGIF() {
    const fps = Math.max(1, Math.min(30, parseInt(fpsInput.value,10)||8));
    const seconds = Math.max(1, Math.min(20, parseInt(secInput.value,10)||4));
    const frames = fps*seconds;
    const desiredName = (fileNameInput?.value || "animation.gif").trim() || "animation.gif";
    downloadLink.setAttribute("download", desiredName);

    const off = document.createElement("canvas");
    off.width = canvas.width; off.height = canvas.height;
    const octx = off.getContext("2d");

    octx.drawImage(canvas, 0,0);
    const firstData = octx.getImageData(0,0,off.width,off.height);
    const palette = buildPalette(firstData);
    const gct = colorTable(palette);
    const gctSizePower = Math.ceil(Math.log2(Math.max(2, palette.length)));

    const gif = new GifWriter();
    gif.write(new Uint8Array([71,73,70,56,57,97])); // GIF89a
    gif.write(word(off.width));
    gif.write(word(off.height));
    gif.write(new Uint8Array([0x80 | (gctSizePower-1), 0, 0]));
    gif.write(gct);

    const delayCs = Math.round(100/fps);

    for(let f=0; f<frames; f++){
      const prevMode = state.mode;
      state.mode = "preview";

      octx.clearRect(0,0,off.width,off.height);
      if (state.background.type==="image" && state.background.image){
        octx.drawImage(state.background.image, 0,0,off.width,off.height);
      } else {
        octx.fillStyle = state.background.color || "#000";
        octx.fillRect(0,0,off.width,off.height);
      }
      layoutContent();
      const tSec = f/fps;
      for (const line of state.lines){
        for (const w of line.words){
          const m = measureWordBounds(w);
          const {dx,dy,scale,alpha} = applyAnimationToWord(w, tSec);
          octx.save();
          octx.globalAlpha=alpha;
          octx.translate(w.x+dx, w.y+dy);
          octx.scale(scale, scale);
          octx.font = `${w.size}px ${w.font}`;
          octx.fillStyle = w.color;
          octx.textBaseline="alphabetic";
          octx.fillText(w.text, 0,0);
          octx.restore();
        }
      }
      state.mode = prevMode;

      const imgData = octx.getImageData(0,0,off.width,off.height);
      const indices = new Uint8Array(off.width*off.height);
      let p=0;
      for(let i=0;i<imgData.data.length;i+=4){
        const idx = nearestIndex(palette, imgData.data[i], imgData.data[i+1], imgData.data[i+2]);
        indices[p++]=idx;
      }

      gif.write(new Uint8Array([0x21,0xF9,0x04,0x04, delayCs & 255, (delayCs>>8)&255, 0, 0]));
      gif.write(new Uint8Array([0x2C, 0,0,0,0]));
      gif.write(word(off.width)); gif.write(word(off.height));
      gif.write(num(0));
      const lzwMin = Math.max(2, gctSizePower);
      gif.write(num(lzwMin));
      const lzw = lzwEncode(indices, lzwMin);
      let si=0;
      while(si<lzw.length){
        const n = Math.min(255, lzw.length-si);
        gif.write(num(n));
        gif.write(lzw.slice(si, si+n));
        si+=n;
      }
      gif.write(num(0));
    }

    gif.write(num(0x3B));
    const u8 = gif.concat();
    const blob = new Blob([u8], {type:"image/gif"});
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
  }

  renderGifBtn.addEventListener("click", renderGIF);

  // ---------- INIT ----------
  function buildColorSwatches() {
    const wrap = document.getElementById("swatches");
    if (!wrap) return;
    wrap.innerHTML = "";
    const all = PRESET_COLORS.concat(state.customSwatches || []);
    all.slice(0,48).forEach(col => {
      const btn = document.createElement("button");
      btn.className = "swatch";
      btn.style.background = col;
      btn.title = col;
      btn.addEventListener("click", ()=>{
        const w = selectedWord(); if (!w) return;
        pushUndo();
        w.color = col;
        if (fontColor) fontColor.value = col;
      });
      wrap.appendChild(btn);
    });
  }

  function init() {
    setCanvasResolution();
    buildBgThumbs();
    buildColorSwatches();
    setMode("edit"); // default
    requestAnimationFrame(render);
    zoomRange.value = String(state.zoom);
    applyZoom();
  }
  init();

})();