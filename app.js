// LED Backpack Animator — Functional Layout Refactor
// State
const state = {
  mode: 'edit', // 'edit' or 'preview'
  zoom: 1,
  res: {w:96, h:128},
  background: {type:'solid', color:'#000000', image:null, name:'solid'},
  // Lines structure is crucial: each line holds an array of words
  lines: [
    {words: [{text:'HELLO', color:'#FFFFFF', font:'monospace', size:22, anim:{}, align:'center', manual:false, x:0,y:0}], align:'center'}
  ],
  selection: {line:0, word:0}, // Pointer to the selected word
  undo: [],
  redo: [],
  preventCutoff: true,
  autoSize: true, // New state property for autosize
  spacing: {lineGap:2, word:8},
  dragPromptDismissed: false
};

// Canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
// Virtual scale factor: Canvas elements are drawn 4x the LED grid for sharpness
const VIRTUAL_SCALE = 4;
const SAFE_PADDING = 4; // 4 LED pixels safe padding on all sides

// UI refs (omitted for brevity, assume they are still defined)
// ... (All UI references from the original file remain here)
const btnAddLine = document.getElementById('btnAddLine');
const autoSize = document.getElementById('autoSize'); // Added ref

// Utils
const clone = v => JSON.parse(JSON.stringify(v));
// Function to push state to history
const pushHistory = () => { 
    // Only save the parts of state that matter for UI/config
    const stateToSave = {
        mode: 'edit', // Always save history in edit mode state
        zoom: state.zoom,
        res: state.res,
        background: state.background,
        lines: state.lines,
        spacing: state.spacing,
        preventCutoff: state.preventCutoff,
        autoSize: state.autoSize,
    };
    state.undo.push(clone(stateToSave)); 
    state.redo.length=0; 
    // Limit history length (e.g., 20 steps)
    if(state.undo.length > 20) state.undo.shift();
};
const selectedWord = () => {
    if(state.selection==null) return null;
    const line = state.lines[state.selection.line];
    if(!line) return null;
    return line.words[state.selection.word] || null;
};
const selectedLine = () => state.lines[state.selection?.line];


// --- 1. LAYOUT & MEASUREMENT ---

/**
 * Measures text using canvas context, returning virtual (LED grid) dimensions.
 * @param {object} w - word object
 * @returns {{w: number, h: number}} - virtual width and height
 */
function measureText(w){
  ctx.save();
  ctx.font = `${w.size * VIRTUAL_SCALE}px ${w.font}`;
  // TextMetrics gives width in true pixels, divide by VIRTUAL_SCALE
  const textWidth = ctx.measureText(w.text || '').width / VIRTUAL_SCALE;
  // Canvas does not give reliable height; approximate based on size
  const textHeight = w.size * 1.2; 
  ctx.restore();
  
  return {w: textWidth, h: textHeight};
}

/**
 * Performs layout for all lines, calculating final X, Y positions.
 * Implements centering, padding, autosize, and line/word spacing.
 */
function layoutAll(){
  pushHistory(); // Save state before applying new layout
  const maxW = state.res.w - 2 * SAFE_PADDING;
  let currentY = SAFE_PADDING;
  
  state.lines.forEach((ln, li)=>{
    let initialFontSize = ln.words[0]?.size || 22; // Use first word's size as base
    let effectiveFontSize = initialFontSize;
    let metrics = ln.words.map(w => measureText(w));
    
    // --- AUTOSIZE LOGIC (Per line) ---
    if(state.autoSize && ln.words.length > 0){
        let totalWidth = metrics.reduce((a,m)=> a+m.w, 0) + Math.max(0, ln.words.length-1)*state.spacing.word;
        if(totalWidth > maxW){
            effectiveFontSize = Math.floor((maxW / totalWidth) * initialFontSize);
            effectiveFontSize = Math.max(1, effectiveFontSize); // Don't go below 1
            // Recalculate metrics with the scaled font size
            ln.words.forEach(w => w.size = effectiveFontSize);
            metrics = ln.words.map(w => measureText(w));
            totalWidth = metrics.reduce((a,m)=> a+m.w, 0) + Math.max(0, ln.words.length-1)*state.spacing.word;
        } else {
             // Reset to user's set font size if it fits (only for the selected line in edit mode)
             if(state.selection?.line === li){
                 ln.words.forEach(w => w.size = parseInt(fontSize.value, 10));
             }
             metrics = ln.words.map(w => measureText(w));
             totalWidth = metrics.reduce((a,m)=> a+m.w, 0) + Math.max(0, ln.words.length-1)*state.spacing.word;
        }
    }
    
    // Determine line height based on largest word in the line
    const lineHeight = metrics.reduce((a,m)=> Math.max(a, m.h), 0);
    
    // --- HORIZONTAL ALIGNMENT (Word Positioning) ---
    let startX = 0;
    if(ln.align === 'center'){
        startX = (state.res.w - totalWidth) / 2;
    } else if(ln.align === 'left'){
        startX = SAFE_PADDING;
    } else if(ln.align === 'right'){
        startX = state.res.w - totalWidth - SAFE_PADDING;
    }
    // Manual alignment is handled by using existing w.x/w.y values (set during drag)
    
    let currentX = startX;
    ln.words.forEach((w, i)=>{
        // Set Y position: center the word vertically within the line height
        w.y = currentY + lineHeight * 0.8; // Baseline position
        
        if(ln.align !== 'manual'){
             // Set X position for auto-aligned words
            w.x = currentX;
            currentX += metrics[i].w + state.spacing.word;
        }
        // If manual, w.x is preserved from drag
    });
    
    // Update Y for the next line
    currentY += lineHeight + state.spacing.lineGap;
  });
  
  // --- VERTICAL CENTERING (Block Positioning) ---
  // The total height of the text block is currentY (minus the last lineGap)
  const totalTextHeight = currentY - state.spacing.lineGap;
  const verticalOffset = (state.res.h - totalTextHeight) / 2;

  // Apply vertical offset to all words
  state.lines.forEach(ln => {
    ln.words.forEach(w => {
      // Ensure vertical centering only applies if ALL lines are not manual
      if(!state.lines.some(l => l.align === 'manual')){
        w.y += verticalOffset;
      }
    });
  });
}


// --- 2. CANVAS DRAWING & SELECTION ---

let t0 = performance.now();
function draw(){
  // scale canvas CSS size based on zoom
  canvas.style.width = (state.res.w * VIRTUAL_SCALE * state.zoom) + 'px';
  canvas.style.height = (state.res.h * VIRTUAL_SCALE * state.zoom) + 'px';
  
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,canvas.width, canvas.height);
  
  ctx.save();
  ctx.scale(VIRTUAL_SCALE, VIRTUAL_SCALE);
  drawBackground();
  
  const time = (performance.now()-t0)/1000;
  
  state.lines.forEach((ln, li)=>{
    ln.words.forEach((w, wi)=>{
      // Get current metrics (must use the actual drawn size, which may be autosized)
      const m = measureText(w);
      
      // Animations (preview only)
      let dy=0, amp=0;
      if(state.mode==='preview'){
        // ... (animation logic remains here) ...
      }
      
      ctx.fillStyle = w.color || '#fff';
      // Use metrics.h as the font size for rendering (since it's the effective size)
      ctx.font = `${Math.round(w.size * (1 + amp))}px ${w.font}`;
      // Draw text
      ctx.fillText(w.text, w.x, w.y + dy);

      // --- SELECTION BOX & CARET ---
      if(state.selection?.line === li && state.selection?.word === wi && state.mode==='edit'){
        // Selection Box (Magenta Dotted Glow)
        ctx.strokeStyle = '#ff49c1';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([1, 1]);
        // Box wraps the full word (x, y-height, width, height)
        ctx.strokeRect(w.x - 1, w.y - m.h * 0.9, m.w + 2, m.h * 1.1);

        // Caret (Flashing)
        const caretX = w.x + ctx.measureText(w.text).width / VIRTUAL_SCALE;
        const blink = ((performance.now()/500)|0)%2===0;
        if(blink){
          ctx.fillStyle='#fff'; 
          ctx.fillRect(caretX, w.y - m.h * 0.9, 0.5, m.h);
        }
        
        // Place Delete button relative to the selected word box
        placeDeleteButton({x: (w.x + m.w) * VIRTUAL_SCALE * state.zoom, y: (w.y - m.h * 0.9) * VIRTUAL_SCALE * state.zoom});
      }
    });
  });
  
  if(!state.selection) deleteBtn.classList.add('hidden');
  
  ctx.restore();
  requestAnimationFrame(()=>{ if(state.mode==='preview') draw(); });
}

// ... (drawBackground, placeDeleteButton, hitTest, canvasPos functions remain) ...

/**
 * HitTest function updated to use text bounds (approximate)
 */
function hitTest(x,y){
  for(let li=0; li<state.lines.length; li++){
    const ln = state.lines[li];
    for(let wi=0; wi<ln.words.length; wi++){
      const w = ln.words[wi];
      const m = measureText(w);
      // Check if click is within the word's bounding box
      if(x >= w.x && x <= w.x + m.w && y >= w.y - m.h && y <= w.y + m.h * 0.2){
        return {line:li, word:wi};
      }
    }
  }
  return null;
}


// --- 3. INTERACTION & EDITING ---

// Apply inspector changes and update autoSize state
function applyWordChange(){
  const w = selectedWord(); if(!w) return;
  w.font = fontFamily.value;
  // Only update size if autosize is off
  if(!state.autoSize) w.size = parseInt(fontSize.value,10);
  
  state.autoSize = autoSize.checked; // Update state for autosize
  state.spacing.lineGap = parseInt(lineGap.value,10);
  state.spacing.word = parseInt(wordSpacing.value,10);
  state.preventCutoff = preventCutoff.checked;
  layoutAll();
  draw();
}

fontFamily.addEventListener('change', applyWordChange);
fontSize.addEventListener('change', applyWordChange);
autoSize.addEventListener('change', applyWordChange); // Updated to call applyWordChange
lineGap.addEventListener('change', applyWordChange);
wordSpacing.addEventListener('change', applyWordChange);
preventCutoff.addEventListener('change', applyWordChange);

// Keyboard typing -> edit selected word; space = new word; Enter = new line
window.addEventListener('keydown', (e)=>{
  if(state.mode!=='edit') return;
  
  // Use a flag to track if the event should be prevented (only for typing/commands)
  let shouldPreventDefault = false; 

  if(!state.selection && e.key.length===1 && e.key!==' ' && e.key!=='Enter'){
    // No selection, but user started typing -> create first word
    addNewLine(true); // Create a new line and word, then fall through to typing
  }

  if(!state.selection) return;

  const ln = selectedLine();
  const w = selectedWord();
  if(!w) return;

  if(e.key==='Backspace'){ 
    w.text = w.text.slice(0,-1); 
    if(w.text.length === 0){
        // Delete word if empty
        const nextWordIndex = state.selection.word - 1;
        ln.words.splice(state.selection.word, 1);
        if(ln.words.length === 0){
            // Delete line if empty
            state.lines.splice(state.selection.line, 1);
            state.selection = null;
        } else {
            // Select the previous word, or the first word
            state.selection.word = Math.max(0, nextWordIndex);
        }
    }
    shouldPreventDefault = true;
  }
  else if(e.key==='Enter' || e.key==='NumpadEnter'){ 
    // ENTER = new line (always centered by default)
    addNewLine();
    shouldPreventDefault = true;
  }
  else if(e.key===' '){ 
    // SPACE = new editable word on same line
    ln.words.splice(state.selection.word+1, 0, {
        text:'', 
        color:w.color, 
        font:w.font, 
        size:w.size, 
        anim:clone(w.anim), 
        align:ln.align, 
        manual:false, x:0, y:0
    });
    state.selection.word++;
    shouldPreventDefault = true;
  }
  else if(e.key.length===1){
    w.text += e.key.toUpperCase(); // Text appears directly on canvas
    shouldPreventDefault = true;
  }
  
  if (shouldPreventDefault) {
    e.preventDefault();
    layoutAll(); // Re-layout to reflect new text/words/lines
    draw();
  }
});

/**
 * Creates a new line and selects the first word on it.
 * @param {boolean} selectExistingWord - If true, keeps current word selection and only adds a line if needed.
 */
function addNewLine(selectExistingWord = false){
    // If a word is selected, start the new line's word with the properties of the current word
    const currentLine = selectedLine();
    const currentWord = selectedWord();
    const newWordDefaults = {
        text: '',
        color: currentWord?.color || '#FFFFFF', 
        font: currentWord?.font || fontFamily.value, 
        size: currentWord?.size || parseInt(fontSize.value, 10), 
        anim: currentWord ? clone(currentWord.anim) : {}, 
        align: currentLine?.align || 'center', 
        manual: false, 
        x: 0, y: 0
    };

    if (selectExistingWord && currentWord) {
        // This is for initial typing, the new line might not be needed
        ensureAtLeastOneLine();
        return;
    }

    const newLine = {
        words: [newWordDefaults],
        align: currentLine?.align || 'center'
    };
    state.lines.push(newLine);
    state.selection = {line: state.lines.length-1, word: 0};
    layoutAll();
    draw();
}
btnAddLine.addEventListener('click', () => addNewLine());

// Double click to create a new word centered on the canvas
canvas.addEventListener('dblclick', (e)=>{
  ensureAtLeastOneLine();
  const ln = state.lines[state.lines.length-1];
  const w = {
      text:'TEXT', 
      color:'#FFFFFF', 
      font: fontFamily.value, 
      size:parseInt(fontSize.value,10), 
      anim:{}, 
      align: 'center', // Always start new word as centered
      manual:false, 
      x:0, y:0
    };
  ln.words.push(w);
  state.selection = {line: state.lines.length-1, word: ln.words.length-1};
  layoutAll(); draw();
});


// Initialise
function init(){
  setResolution(resolutionSel.value);
  filterPresetThumbs();
  // Ensure we have correct initial values
  state.autoSize = autoSize.checked;
  state.spacing.lineGap = parseInt(lineGap.value,10);
  state.spacing.word = parseInt(wordSpacing.value,10);
  
  // Initial layout and draw
  layoutAll();
  draw();
  syncInspectorFromSelection();
}
init();
