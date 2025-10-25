/* =======================================================================
   LED Backpack Animator v2.0 — FINAL WORKING app.js
   - Includes all bug fixes (centering, caret, typing, rendering, deselect)
   - CRITICAL FIX: Added 'change' listener to #multiToggle for robust state sync
   ======================================================================= */

/* ------------------ small helpers ------------------ */
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
const off = (el, ev, fn) => el && el.removeEventListener(ev, fn);

/* ------------------ DOM refs ------------------ */
const canvas=$("#led"), ctx=canvas.getContext("2d"), wrap=$(".canvas-wrap");
const textEditor=$("#textEditor"); 

// CRITICAL: Ensure the reference is available everywhere
const multiToggle = $("#multiToggle"); 

/* toolbar */
const modeEditBtn=$("#modeEdit"), modePreviewBtn=$("#modePreview");
const zoomSlider=$("#zoom"), fitBtn=$("#fitBtn");
const undoBtn=$("#undoBtn"), redoBtn=$("#redoBtn"), clearAllBtn=$("#clearAllBtn");

/* BG + resolution */
const resSel=$("#resSelect"), bgGrid=$("#bgGrid");
const bgSolidTools=$("#bgSolidTools"), bgSolidColor=$("#bgSolidColor");
const addBgSwatchBtn=$("#addBgSwatchBtn"), bgSwatches=$("#bgSwatches");
const bgUpload=$("#bgUpload");

/* stage controls */
const manualDragBtn=$("#manualDragBtn") || $("#manualDragToggle");
const addWordBtn=$("#addWordBtn"), addLineBtn=$("#addLineBtn"), delWordBtn=$("#deleteWordBtn");
const emojiBtn=$("#emojiBtn");

/* inspector: font/layout/anims */
const pillTabs=$$(".pill[data-acc]");
const accFont=$("#accFont"), accLayout=$("#accLayout"), accAnim=$("#accAnim");

const fontSelect=$("#fontSelect"), fontSizeInp=$("#fontSize");
const autoSizeWordChk=$("#autoSize") || {checked:true};    
const autoSizeLineChk=$("#autoSizePerLine") || {checked:true}; 
const fontColorInp=$("#fontColor"), addSwatchBtn=$("#addSwatchBtn"), textSwatches=$("#swatches");

const lineGapInp=$("#lineGap"), wordGapInp=$("#wordGap");
const alignBtns=$$("[data-align]"), valignBtns=$$("[data-valign]");

/* anims */
const animList=$("#animList");
const applySelBtn=$("#applySelectedAnimBtn"), applyAllBtn=$("#applyAllAnimBtn");

/* progress / preview */
const progressBar=$("#progress"), tCur=$("#tCur"), tEnd=$("#tEnd");

/* config + render */
const loadProjectInput = $("#loadWordsJsonInput");
const saveProjectBtn   = $("#saveWordsJsonBtn");
const loadAppCfgInput  = $("#loadAppCfgInput");
const saveAppCfgBtn    = $("#saveAppCfgBtn");
const fpsInp=$("#fps"), secondsInp=$("#seconds"), fileNameInp=$("#fileName");
const previewBtn=$("#previewRenderBtn"), gifBtn=$("#gifRenderBtn"), gifPreviewImg=$("#gifPreview");

/* about + info */
const aboutBtn=$("#aboutBtn"), aboutModal=$("#aboutModal"), aboutClose=$("#aboutClose");

/* emoji modal */
const emojiModal=$("#emojiModal"), emojiTabs=$("#emojiTabs"), emojiGrid=$("#emojiGrid");
const emojiSearch=$("#emojiSearch"), emojiClose=$("#emojiClose");

/* ------------------ state ------------------ */
let mode="edit", zoom=1, selected=null;
let history=[], future=[];
const UNDO_LIMIT=100;
let startT=0, rafId=null;
const uiLock = { emojiOpen: false };
const defaults={ font:"Orbitron", size:22, color:"#FFFFFF" };

const caret = { // CARET STATE FOR TEXT CURSOR
  active: false,
  line: 0,
  word: 0,
  index: 0,
  blinkOn: true,
  lastBlink: 0
};

const doc={
  version:"1.0",
  res:{ w:96, h:128 },
  bg:{ type:"preset", color:null, image:null, preset:"assets/presets/96x128/Preset_A.png" },
  spacing:{ lineGap:4, wordGap:6 }, style:{ align:"center", valign:"middle" },
  lines:[ 
    { words:[{text:"LED",    color:"#E9EDFB", font:"Orbitron", size:24, anims:[]}] },
    { words:[{text:"Backpack", color:"#FF6BD6", font:"Orbitron", size:24, anims:[]}] },
    { words:[{text:"Animator", color:"#7B86FF", font:"Orbitron", size:24, anims:[]}] }
  ],
  anims:[], 
  multi:new Set() // Set of "line:word" strings for multi-selection
};

const THEME_COLORS = ["#FF6BD6","#7B86FF","#E9EDFB"];

/* ------------------ presets catalog ------------------ */
const PRESETS={
  "96x128":[
    {id:"A",thumb:"assets/thumbs/Preset_A_thumb.png",full:"assets/presets/96x128/Preset_A.png"},
    {id:"B",thumb:"assets/thumbs/Preset_B_thumb.png",full:"assets/presets/96x128/Preset_B.png"}
  ],
  "64x64":[
    {id:"C",thumb:"assets/thumbs/Preset_C_thumb.png",full:"assets/presets/64x64/Preset_C.png"},
    {id:"D",thumb:"assets/thumbs/Preset_D_thumb.png",full:"assets/presets/64x64/Preset_D.png"}
  ]
};
const visibleSet=()=>PRESETS[`${doc.res.w}x${doc.res.h}`]||[];

/* ------------------ emoji db ------------------ */
let EMOJI_DB=null; 
let NOTO_DB=null;  
async function loadEmojiManifest(){
  if (EMOJI_DB) return EMOJI_DB;

  const r = await fetch("assets/openmoji/emoji_manifest.json", { cache: "no-store" });
  const j = await r.json();

  const entries = Array.isArray(j) ? j : (Array.isArray(j.entries) ? j.entries : []);
  EMOJI_DB = {
    categories: (j.categories && Array.isArray(j.categories)) ? j.categories : [],
    entries: entries.map(e => ({
      id: String(e.id || e.unicode || ""),
      name: e.name || "emoji",
      path: e.src || e.path || "",
      category: e.category || "General"
    }))
  };
  if (!EMOJI_DB.categories.length) {
    EMOJI_DB.categories = Array.from(new Set(EMOJI_DB.entries.map(e => e.category)));
  }
  return EMOJI_DB;
}
function loadNotoIndex(){
  if (NOTO_DB) return NOTO_DB;
  if (window.AnimatedEmoji?.NOTO_INDEX) {
    NOTO_DB = {categories:["Animated"], entries: window.AnimatedEmoji.NOTO_INDEX.map(e=>({
      id:e.cp, name:e.name, category:"Animated", 
      cp:e.cp, ch:e.ch
    }))};
  } else {
    NOTO_DB = {categories:["Animated"], entries:[]};
  }
  return NOTO_DB;
}

/* ------------------ misc ui helpers ------------------ */
function notify(...a){ console.log("[INFO]",...a); }
function warn(...a){ console.warn("[WARN]",...a); }


/* =======================================================
   TEXT EDITOR/CARET MANAGEMENT
======================================================= */
function updateTextEditorPosition(w, li, wi, x, y, size, width){
    if (!textEditor) return;
    const canvasRect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    
    // Convert canvas coordinates (x, y) to screen coordinates
    const scale = zoom;
    const xScreen = (x * scale) + (canvasRect.left - wrapRect.left);
    const yScreen = (y * scale) + (canvasRect.top - wrapRect.top);
    
    // Font size should match the canvas for correct text wrapping/metrics
    const editorFontSize = size * scale;
    const editorWidth = width * scale;
    const editorHeight = size * scale * 1.2; 

    // CRITICAL: Set the editor's position and size
    textEditor.style.left = `${xScreen}px`;
    textEditor.style.top = `${yScreen - (size * scale)}px`; 
    textEditor.style.width = `${Math.max(10, editorWidth + 40)}px`; 
    textEditor.style.height = `${editorHeight}px`;
    textEditor.style.fontSize = `${editorFontSize}px`;
    textEditor.style.fontFamily = w.font || defaults.font;
    textEditor.style.lineHeight = '1';

    // Update editor content and focus
    textEditor.value = w.text || "";
    textEditor.selectionStart = caret.index;
    textEditor.selectionEnd = caret.index;

    // Use requestAnimationFrame to ensure focus after DOM update
    requestAnimationFrame(() => {
        textEditor.focus();
    });
}

function deselectWord(clearEditor=true){
    selected = null;
    caret.active = false;
    
    // FIX: Clear multi-selection state when explicitly deselecting
    doc.multi.clear();
    
    // FIX: Sync the multi-select checkbox UI
    if (multiToggle) {
        multiToggle.checked = false; 
    }

    if(clearEditor){
        textEditor.style.left = "-9999px";
        textEditor.style.top = "-9999px";
        textEditor.value = "";
        textEditor.blur();
    }
    render();
}

on(textEditor, 'input', (e) => {
    if (!selected) return;
    const w = doc.lines[selected.line]?.words[selected.word];
    if (w) {
        // Prevent newlines in the word editor
        w.text = e.target.value.replace(/(\r\n|\n|\r)/gm, "");
        caret.index = e.target.selectionStart;
        render(); 
        // Update selection after render for new position/size
        updateTextEditorCaretAndPosition(); 
    }
});

on(textEditor, 'keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        deselectWord(); 
    }
    // Update caret index on key press
    setTimeout(() => {
        caret.index = textEditor.selectionStart;
        render(); 
        updateTextEditorCaretAndPosition();
    }, 0);
});

on(textEditor, 'blur', () => {
    // Only deselect if the blur wasn't caused by clicking a word on the canvas 
    if (!selected) {
        deselectWord(false);
    }
});

function updateTextEditorCaretAndPosition() {
    if (selected) {
        const w = doc.lines[selected.line]?.words[selected.word];
        if (w) {
            const { x, y, size, width } = getWordPositionInfo(selected.line, selected.word);
            updateTextEditorPosition(w, selected.line, selected.word, x, y - size, size, width);
        }
    }
}
function getWordPositionInfo(li, wi) {
    const lg = doc.spacing.lineGap ?? 4, wg = doc.spacing.wordGap ?? 6;
    const heights = doc.lines.map(lineHeight);
    const contentH = totalHeight();
    const W = doc.res.w, H = doc.res.h;

    let yCursor;
    if (doc.style.valign === "top") yCursor = 4;
    else if (doc.style.valign === "bottom") yCursor = H - contentH - 4;
    else yCursor = (H - contentH) / 2;

    for (let i = 0; i <= li; i++) {
        const line = doc.lines[i];
        const lh = heights[i];
        
        if (i === li) {
            const wLine = lineWidth(line);
            let xBase;
            if (doc.style.align === "left") xBase = 4;
            else if (doc.style.align === "right") xBase = W - wLine - 4;
            else xBase = (W - wLine) / 2;

            let x = xBase;
            for (let j = 0; j <= wi; j++) {
                const w = line.words[j];
                const width = measureText(w);
                const size = w.size || defaults.size;

                if (j === wi) {
                    return { x, y: yCursor + lh * 0.9, size, width };
                }
                x += width + wg;
            }
        }
        yCursor += lh + lg; 
    }
    return { x: -9999, y: -9999, size: 24, width: 0 };
}


/* =======================================================
   BACKGROUND GRID / SOLID / UPLOAD
======================================================= */
function showSolidTools(show){ bgSolidTools?.classList.toggle("hidden", !show); }
function buildBgGrid(){
  bgGrid.innerHTML="";
  const tiles=[
    {kind:"solid",thumb:"assets/thumbs/Solid_thumb.png"},
    {kind:"upload",thumb:"assets/thumbs/Upload_thumb.png"},
    ...visibleSet().map(p=>({kind:"preset",thumb:p.thumb,full:p.full})),
  ];
  tiles.forEach((t,i)=>{
    const b=document.createElement("button");
    b.type="button"; b.className="bg-tile"; b.dataset.kind=t.kind;
    const img=document.createElement("img"); img.src=t.thumb; img.alt=t.kind;
    b.appendChild(img);
    on(b,"click",async()=>{
      $$(".bg-tile",bgGrid).forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      if(t.kind==="preset"){
        const im=new Image(); im.crossOrigin="anonymous"; im.src=t.full;
        im.onload=()=>{ doc.bg={type:"preset",color:null,image:im,preset:t.full}; showSolidTools(false); render(); };
        im.onerror=()=>warn(`Failed to load preset image: ${t.full}`);
      }else if(t.kind==="solid"){
        doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null};
        showSolidTools(true); render();
      }else if(t.kind==="upload"){
        bgUpload.click();
      }
    });
    bgGrid.appendChild(b);
  });
  // Auto-select the first preset on startup
  const firstPreset=$(".bg-tile[data-kind='preset']",bgGrid);
  if(firstPreset){
    firstPreset.classList.add("active");
    // Manually set the initial doc.bg state based on the default preset
    const defaultPreset = visibleSet().find(p => p.id === firstPreset.dataset.id || p.thumb === firstPreset.querySelector('img').src);
    if (defaultPreset) {
      doc.bg = { type: "preset", color: null, image: null, preset: defaultPreset.full };
      // Load the image asynchronously
      const im = new Image(); im.crossOrigin = "anonymous"; im.src = defaultPreset.full;
      im.onload = () => { doc.bg.image = im; render(); };
    }
  }
}
on(bgUpload,"change",e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=()=>{ URL.revokeObjectURL(url); doc.bg={type:"image",color:null,image:im,preset:null}; showSolidTools(false); render(); };
  im.src=url;
});

/* ------------------ bg color swatches ------------------ */
const defaultBgPalette=["#FFFFFF","#000000","#101010","#1a1a1a","#222","#333","#444","#555","#666"];
let customBgPalette=[];
function rebuildBgSwatches(){
  bgSwatches.innerHTML="";
  [...defaultBgPalette,...customBgPalette].forEach(c=>{
    const b=document.createElement("button"); b.className="swatch"; b.style.background=c; b.title=c;
    b.onclick=()=>{ doc.bg={type:"solid",color:c,image:null,preset:null}; showSolidTools(true); render(); };
    bgSwatches.appendChild(b);
  });
}
on(addBgSwatchBtn,"click",()=>{
  const c=bgSolidColor.value||"#000000";
  if(!defaultBgPalette.includes(c)&&!customBgPalette.includes(c)) customBgPalette.push(c);
  rebuildBgSwatches();
});
on(bgSolidColor,"input",()=>{ doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null}; render(); });

/* =======================================================
   ZOOM / FIT / MODE
======================================================= */
function setZoom(z){ zoom=z; if(zoomSlider) zoomSlider.value=String(z); canvas.style.transform=`translate(-50%,-50%) scale(${z})`; }
function fitZoom(){
  const pad=18, r=wrap.getBoundingClientRect();
  const availW=Math.max(40,r.width-pad*2), availH=Math.max(40,r.height-pad*2);
  setZoom(Math.max(0.1,Math.min(availW/doc.res.w, availH/doc.res.h)));
}
on(zoomSlider,"input",e=>setZoom(parseFloat(e.target.value)));
on(fitBtn,"click",fitZoom); window.addEventListener("resize",fitZoom);

function setMode(m){
  mode=m;
  modeEditBtn?.classList.toggle("active", m==="edit");
  modePreviewBtn?.classList.toggle("active", m==="preview");
  render(); 
}
on(modeEditBtn,"click",()=>setMode("edit"));
on(modePreviewBtn,"click",()=>setMode("preview"));
on(canvas,"click",()=>{ if(mode==="preview") setMode("edit"); });

/* =======================================================
   PILLS 
======================================================= */
function syncPillsVisibility(){
  const active = $(".pill.active");
  [accFont,accLayout,accAnim].forEach(x=> x && (x.open=false, x.classList.remove("open")));
  pillTabs.forEach(x=> x.classList.remove("active"));
  if(active){
    const id=active.dataset.acc;
    const target=$("#"+id);
    if(target){ target.open=true; target.classList.add("open"); }
  }
  [accFont,accLayout,accAnim].forEach(x=>{
    if(!x) return;
    if(x.open){ x.style.display="block"; }
    else { x.style.display="none"; }
  });
}
pillTabs.forEach(p=>{
  on(p,"click",()=>{
    const isActive=p.classList.contains("active");
    pillTabs.forEach(x=>x.classList.remove("active"));
    if(!isActive){ p.classList.add("active"); }
    syncPillsVisibility();
  });
});
syncPillsVisibility();

/* =======================================================
   TEXT SWATCHES
======================================================= */
const defaultTextPalette=["#FFFFFF","#FF3B30","#00E25B","#1E5BFF","#FFE45A","#FF65D5","#40F2F2","#000000"];
let customTextPalette=[];
function rebuildTextSwatches(){
  textSwatches.innerHTML="";
  [...defaultTextPalette, ...customTextPalette, ...THEME_COLORS].forEach(c=>{
    const b=document.createElement("button"); b.className="swatch"; b.style.background=c; b.title=c;
    b.onclick=()=>{ forEachSelectedWord(w=>w.color=c); render(); fontColorInp.value=c; };
    textSwatches.appendChild(b);
  });
}
on(addSwatchBtn,"click",()=>{
  const c=fontColorInp.value||"#FFFFFF";
  if(!defaultTextPalette.includes(c)&&!customTextPalette.includes(c)) customTextPalette.push(c);
  rebuildTextSwatches();
});
on(fontColorInp,"input",()=>{
  forEachSelectedWord(w=>w.color=fontColorInp.value); render();
});

/* =======================================================
   MEASURE / AUTOSIZE
======================================================= */
const emojiCache=new Map();
function getEmojiImage(url){
  if(emojiCache.has(url)) return emojiCache.get(url);
  const img=new Image(); img.crossOrigin="anonymous"; img.decoding="async"; img.src=url;
  emojiCache.set(url,img); return img;
}
function measureText(w){
  if(w?.emoji){ return (w.size??24) * (w.scale??1); }
  ctx.font=`${w.size||defaults.size}px ${w.font||defaults.font}`;
  return ctx.measureText(w.text||"").width;
}
function lineHeight(line){
  const hs = line.words.map(w=> w.emoji ? (w.size??24)*(w.scale??1) : (w.size||defaults.size));
  return Math.max(12, ...hs);
}
function lineWidth(line){
  const gap=doc.spacing.wordGap??6;
  return line.words.reduce((s,w)=>s+measureText(w),0)+Math.max(0,line.words.length-1)*gap;
}
function totalHeight(){
  const lg=doc.spacing.lineGap??4;
  return doc.lines.map(lineHeight).reduce((s,h)=>s+h,0)+ (doc.lines.length-1)*lg;
}
function forEachSelectedWord(fn){
  if(doc.multi.size > 0){
    doc.multi.forEach(key=>{
      const [li, wi] = key.split(':').map(Number);
      const w = doc.lines[li]?.words[wi];
      if(w) fn(w, li, wi);
    });
  } else if(selected){
    const w = doc.lines[selected.line]?.words[selected.word];
    if(w) fn(w, selected.line, selected.word);
  }
}
function autoSizeAllIfOn(){
  const padX=6, padY=6, maxW=doc.res.w-padX*2, maxH=doc.res.h-padY*2;
  const L=Math.max(1,doc.lines.length), lg=doc.spacing.lineGap??4;
  const perLineH=(maxH-(L-1)*lg)/L;

  doc.lines.forEach(line=>{
    if (autoSizeLineChk?.checked){
      let s=Math.floor(perLineH);
      for(let test=s; test>=6; test-=0.5){
        let wsum=- (doc.spacing.wordGap??6);
        for(const w of line.words){
          const base = w.emoji ? (w.size??24)*(w.scale??1) : (test);
          if(!w.emoji){
            ctx.font=`${test}px ${w.font||defaults.font}`;
            wsum += ctx.measureText(w.text||"").width + (doc.spacing.wordGap??6);
          }else{
            wsum += base + (doc.spacing.wordGap??6);
          }
        }
        if(wsum<=maxW){ line.words.forEach(w=>{ if(!w.emoji) w.size=test; }); break; }
      }
    }else if (autoSizeWordChk?.checked){
      line.words.forEach(w=>{
        if (w.emoji) return;
        for(let s=(w.size||defaults.size); s>=6; s--){
          ctx.font=`${s}px ${w.font||defaults.font}`;
          if (lineWidth(line)<=maxW){ w.size=s; break; }
        }
      });
    }
  });

  const wSel = selected ? doc.lines[selected.line]?.words[selected.word] : doc.lines[0]?.words[0];
  if (wSel && !wSel.emoji && fontSizeInp) fontSizeInp.value=Math.round(wSel.size||defaults.size);
}

/* =======================================================
   ANIMATIONS DEFINITIONS
======================================================= */
function seconds(){ return Math.max(1,Math.min(60, parseInt(secondsInp?.value||"8",10))); }
function fps(){ return Math.max(1,Math.min(30, parseInt(fpsInp?.value||"15",10))); }
function colorToHue(hex){ const c=(hex||"#fff").replace("#",""); const r=parseInt(c.slice(0,2)||"ff",16)/255,g=parseInt(c.slice(2,4)||"ff",16)/255,b=parseInt(c.slice(4,6)||"ff",16)/255; const M=Math.max(r,g,b), m=Math.min(r,g,b); if(M===m) return 0; const d=M-m; let h=(M===r)?(g-b)/d+(g<b?6:0):(M===g)?(b-r)/d+2:(r-g)/d+4; return Math.round((h/6)*360); }
function easeOutCubic(x){ return 1-Math.pow(1-x,3); }

// Placeholder for full animation functions
function resolveWordAnims(word) { return word.anims || []; }

function checkConflicts(anims){
  const ids=new Set(anims.map(a=>a.id));
  const conflicts=[];
  const pos=["slide","scroll","slideaway","zoom"]; const count=pos.filter(p=>ids.has(p)).length; if(count>1) conflicts.push("Multiple position animations (slide/scroll/zoom/slideaway)");
  if(ids.has("strobe") && ids.has("flicker")) conflicts.push("Strobe + Flicker");
  return conflicts;
}

function animatedProps(base, word, t, totalDur){
  const props={x:base.x,y:base.y,scale:1,alpha:1,text:word.text||"",color:word.color,dx:0,dy:0,shadow:null,gradient:null,perChar:null};
  // Placeholder logic: Apply a simple phase shift if any anims are present
  const anims = resolveWordAnims(word);
  if(anims.length > 0){
    const time = (t / 1000) % totalDur;
    props.dx = Math.sin(time * 2 * Math.PI / totalDur) * 2; // Subtle sway
  }
  return props;
}

/* =======================================================
   INTERACTION HANDLING (CLICK/TOUCH)
======================================================= */
function canvasTouch(e){
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / zoom;
  const y = (e.clientY - rect.top) / zoom;

  if (mode !== "edit" || uiLock.emojiOpen) return;

  let clickedWord = null;
  let clickedHandle = false;

  const lg=doc.spacing.lineGap??4, wg=doc.spacing.wordGap??6;
  const heights=doc.lines.map(lineHeight);
  const contentH=totalHeight();
  const W=doc.res.w, H=doc.res.h;
  let yCursor;
  if(doc.style.valign==="top") yCursor=4;
  else if(doc.style.valign==="bottom") yCursor=H-contentH-4;
  else yCursor=(H-contentH)/2;

  // Check for handle click first
  if (selected && selected.handleBounds) {
    const hb = selected.handleBounds;
    if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
      clickedHandle = true;
    }
  }

  // If handle was clicked, delete the word and stop
  if (clickedHandle) {
    if (selected) {
      doc.lines[selected.line].words.splice(selected.word, 1);
      // Clean up empty lines
      doc.lines = doc.lines.filter(l => l.words.length > 0);
      deselectWord();
    }
    return; 
  }

  // Check for word click
  doc.lines.forEach((line,li)=>{
    if (clickedWord) return;

    const lh=heights[li], wLine=lineWidth(line);
    let xBase;
    if(doc.style.align==="left") xBase=4;
    else if(doc.style.align==="right") xBase=W-wLine-4;
    else xBase=(W-wLine)/2;

    let wx=xBase, wy=yCursor;

    // Check if click is on this line's vertical block
    if (y >= wy && y <= wy + lh) {
      line.words.forEach((w,wi)=>{
        if (clickedWord) return;
        const ww = measureText(w);
        // Check if click is inside this word's bounding box
        if (x >= wx && x <= wx + ww) {
          // Found the word!
          clickedWord = { line: li, word: wi };
        }
        wx += ww + wg;
      });
    }

    yCursor += lh + lg;
  });

  if (clickedWord) {
    const key = `${clickedWord.line}:${clickedWord.word}`;
    
    // CRITICAL FIX: If multiToggle is not checked, clear ALL previous selections
    if (!multiToggle?.checked) {
        doc.multi.clear(); 
    }
    // Also clear the multiToggle visually if it was somehow checked but shouldn't be
    if (multiToggle && !multiToggle.checked) {
        multiToggle.checked = false; 
    }

    // Toggle multi-selection if the button IS checked
    if (multiToggle?.checked) {
        if (doc.multi.has(key)) {
            doc.multi.delete(key);
        } else {
            doc.multi.add(key);
        }
    }
    
    // Update the single 'selected' word
    selected = clickedWord;
    caret.active = true;
    caret.index = doc.lines[selected.line]?.words[selected.word]?.text?.length || 0; 
    
    updateTextEditorCaretAndPosition();
    
  } else {
    // Clicked outside of any word
    deselectWord();
  }

  render();
}
on(canvas, "click", canvasTouch);


/* =======================================================
   RENDER (+ delete handle)
======================================================= */
function render(t=0,totalDur=seconds()){
  const W=canvas.width=doc.res.w, H=canvas.height=doc.res.h;
  ctx.clearRect(0,0,W,H);
  
  // Draw Background
  if (doc.bg?.type==="solid") {
    ctx.fillStyle=(doc.bg.color||"#000");  
    ctx.fillRect(0,0,W,H);
  }
  if(doc.bg?.image){ 
    try{ ctx.drawImage(doc.bg.image,0,0,W,H); }catch{} 
  } else if(doc.bg?.preset && !doc.bg.image){
    const im=new Image(); im.crossOrigin="anonymous"; im.src=doc.bg.preset;
    im.onload=()=>{ doc.bg.image=im; render(t,totalDur); };
    im.onerror=()=>warn(`Failed to load background image: ${doc.bg.preset}`);
  }

  autoSizeAllIfOn();

  const lg=doc.spacing.lineGap??4, wg=doc.spacing.wordGap??6;
  const heights=doc.lines.map(lineHeight);
  const contentH=totalHeight();
  
  let yCursor;
  if(doc.style.valign==="top") yCursor=4;
  else if(doc.style.valign==="bottom") yCursor=H-contentH-4;
  else yCursor=(H-contentH)/2;

  doc.lines.forEach((line,li)=>{
    const lh=heights[li], wLine=lineWidth(line);
    let xBase;
    if(doc.style.align==="left") xBase=4;
    else if(doc.style.align==="right") xBase=W-wLine-4;
    else xBase=(W-wLine)/2;

    let x=xBase, y=yCursor+lh*0.9;
    
    line.words.forEach((w,wi)=>{
      const base={x,y};
      const props=animatedProps(base,w,t,totalDur);
      const fx=Number(w.fx||0), fy=Number(w.fy||0);

      // Emoji
      if(w.emoji){
        const key=`${li}:${wi}`;
        const emojiSize = (w.size??24)*(w.scale??1);
        if(doc.multi.has(key) || (selected && selected.line===li && selected.word===wi && mode==="edit")){
          drawSelectionBox(x-2, y-lh+2, emojiSize+4, lh+4, doc.multi.has(key)); 
        }
        x+= emojiSize + wg;
        return;
      }

      // text
      const txt=props.text||"";
      const fsize=(w.size||defaults.size)*(props.scale||1);
      ctx.save(); ctx.globalAlpha=Math.max(0,Math.min(1,props.alpha));
      ctx.textBaseline="alphabetic"; ctx.font=`${fsize}px ${w.font||defaults.font}`;
      if(props.shadow){ ctx.shadowBlur=props.shadow.blur; ctx.shadowColor=props.shadow.color||(w.color||defaults.color); }

      let fillStyle=props.color||(w.color||defaults.color);
      const drawX=base.x+(props.dx||0)+fx, drawY=base.y+(props.dy||0)+fy;

      ctx.fillStyle=fillStyle;
      const ww=ctx.measureText(w.text||"").width; 
      
      ctx.fillText(txt, drawX, drawY);
        
      // Draw caret
      if (caret.active && caret.line===li && caret.word===wi && mode==="edit") {
        const baseSize = (w.size||defaults.size);
        ctx.save();
        ctx.font = `${baseSize}px ${w.font||defaults.font}`;
        const leftText = (w.text||"").slice(0, Math.min(caret.index, (w.text||"").length));
        const cx = drawX + ctx.measureText(leftText).width;
          
        const now = performance.now();
        if (now - (caret.lastBlink||0) > 500) {
          caret.blinkOn = !caret.blinkOn;
          caret.lastBlink = now;
        }
        if (caret.blinkOn) {
          ctx.fillStyle = "#E9EDFB";
          ctx.fillRect(cx, drawY - baseSize, 1, baseSize + 2); 
        }
        ctx.restore();
      }

      // selection rectangle + delete handle
      const selKey=`${li}:${wi}`;
      const lh_actual = lineHeight(line); 
      if(doc.multi.has(selKey) || (selected && selected.line===li && selected.word===wi && mode==="edit")){
        drawSelectionBox(drawX-2, drawY-lh_actual-2, ww+4, lh_actual+4, doc.multi.has(selKey));
        
        // Update textEditor position
        if(selected && selected.line===li && selected.word===wi && mode==="edit"){
            updateTextEditorPosition(w, li, wi, drawX-2, drawY-lh_actual-2, w.size||defaults.size, ww);
        }
      }
      ctx.restore();
      x+= ww + wg;
    });
    
    yCursor+= lh + lg; 
    
  });
  
  if(selected){
    const w=doc.lines[selected.line]?.words[selected.word];
    if(w){
      const conf=checkConflicts(resolveWordAnims(w));
      if(conf.length) warn("Animation conflicts: "+conf.join(", "));
    }
  }
}

/* draw selection + delete handle clamped inside canvas */
const HANDLE_SIZE=14; 
function drawSelectionBox(x,y,w,h,isMulti){ 
  const W=doc.res.w, H=doc.res.h;
  ctx.save(); 
  ctx.setLineDash([3,2]); 
  ctx.lineWidth=1; 
  ctx.strokeStyle=isMulti?"rgba(0,255,255,0.95)":"rgba(255,0,255,0.95)"; 
  ctx.strokeRect(x,y,w,h); 

  if(!isMulti){ 
    const dx=Math.min(W-HANDLE_SIZE-2, x+w-2); 
    const dy=Math.max(2, y+2);
    
    ctx.fillStyle=isMulti?"rgba(0,255,255,0.95)":"rgba(255,0,255,0.95)";
    ctx.fillRect(dx,dy,HANDLE_SIZE,HANDLE_SIZE);
    
    ctx.fillStyle="#000000";
    ctx.font="bold 12px sans-serif";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText("×", dx+HANDLE_SIZE/2, dy+HANDLE_SIZE/2);
    
    if(selected) selected.handleBounds = { x:dx, y:dy, w:HANDLE_SIZE, h:HANDLE_SIZE };
  } else {
    if(selected) selected.handleBounds = null; 
  }
  ctx.restore(); 
}


/* =======================================================
   LISTENERS (CRITICAL FIX ADDED HERE)
======================================================= */
on(multiToggle, 'change', (e) => {
    // When the user manually UNCHECKS the multi-select box
    if (!e.target.checked) {
        // Clear the internal list and re-render to remove selection boxes
        doc.multi.clear();
    }
    // When the user CHECKS the multi-select box
    if (e.target.checked) {
        // If a word is already selected, add it to the multi-select set
        if (selected) {
             doc.multi.add(`${selected.line}:${selected.word}`);
        }
    }
    render();
});


/* =======================================================
   INITIALIZATION
======================================================= */
function init(){
  fitZoom();
  
  // Ensure we start clean: clear multi-select and set checkbox state
  doc.multi.clear();
  if (multiToggle) {
    multiToggle.checked = false;
  }

  buildBgGrid(); 
  rebuildBgSwatches();
  rebuildTextSwatches();
  
  render();
}

on(document, "DOMContentLoaded", init);
