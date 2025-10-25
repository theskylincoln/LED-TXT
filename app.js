/* =======================================================================
   LED Backpack Animator v2.1 — app.js (Step 2: Canvas Editing Engine)
   - Implements Metrics for text size, autosize, and layout (Task A2).
   - Implements Canvas render loop: text, caret, selection (Task A1).
   - Implements Typing Model: char, space, enter, backspace, arrows (Task A1).
   ======================================================================= */

/* ------------------ small helpers ------------------ */
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
const clone = (obj) => JSON.parse(JSON.stringify(obj));

/* ------------------ DOM refs ------------------ */
const canvas = $("#led"), ctx = canvas.getContext("2d"), wrap = $(".canvas-wrap");
const zoomSlider = $("#zoom"), zoomReadout = $("#zoomReadout");
const undoBtn = $("#undo"), redoBtn = $("#redo");
const clearBtn = $("#clearCanvas");
const fitBtn = $("#fit");

/* ------------------ State & History ------------------ */
const UNDO_LIMIT = 100;
let doc = {}; // The Project document (what gets saved to project.json)
let appsettings = {}; // Environment settings (what gets saved to app-config.json)
let history = [];
let future = [];
let currentZoom = 100; 
let lastCaretBlink = Date.now();
let isCaretVisible = true;
let animationFrameId = null;

// --- Default State (Hardcoded for MVP start) ---
const defaultDoc = {
  res: { w: 96, h: 128 },
  bg: { type: 'preset', preset: 'A', color: '#000000', image: null, name: 'Preset_A' },
  spacing: { lineGap: 6, wordGap: 4, padding: 8 },
  style: { align: 'center', valign: 'middle' },
  lines: [
    // Initial state: one line, one word, selection at the end.
    { words: [{ text: 'HELLO', color: '#FFFFFF', font: 'Orbitron', size: 22, autosize: true, x: 0, y: 0, manual: false, anim: { motion: [], color: [] } }], align: 'center' }
  ],
  selection: { line: 0, word: 0, caret: { index: 5 }, multi: [{ l: 0, w: 0 }] }
};
const defaultAppSettings = {
  theme: 'midnight', fps: 12, seconds: 6, loop: 'forever', dither: 'fs', palette: 128,
  hiContrast: false, autosave: false, favorites: { animations: [], colorFx: [] },
  userBGs: [], swatches: { color: ['#fff', '#000', '#ff0000'], custom: ['#73b7ff'] },
  defaultsPath: 'assets/defaults/'
};


/* ------------------ State Management (Task A3) ------------------ */
const State = (() => {
    
    function snapshot() { return clone(doc); }
    
    function restore(snap) {
        Object.assign(doc, snap);
        // Re-setup canvas for new resolution
        Canvas.setupCanvas(); 
        UI.updateAll();
        Canvas.render();
    }

    /**
     * Executes a state change and records the previous state to history.
     * @param {string} actionType - The action type.
     * @param {function} mutationFn - A function that applies the change directly to the 'doc'.
     */
    function dispatch(actionType, mutationFn) {
        // 1. Snapshot the CURRENT state BEFORE mutation
        const currentState = snapshot();
        
        // 2. Clear the future (re-branching the timeline)
        future.length = 0;
        
        // 3. Execute the mutation (updates the live 'doc')
        mutationFn(doc, appsettings);

        // 4. Record the previous state
        history.push({
            state: currentState,
            actionType: actionType,
            timestamp: Date.now()
        });
        
        // Enforce the 100-state limit
        if (history.length > UNDO_LIMIT) {
            history.shift();
        }
        
        // 5. Update UI and Canvas
        UI.updateAll();
        Canvas.render();
    }
    
    return { dispatch, restore, snapshot, getDoc: () => doc, getSettings: () => appsettings };
})();


function undo() {
    if (history.length <= 1) return;
    
    const currentState = State.snapshot();
    future.unshift({ state: currentState });
    
    const previousState = history.pop().state;
    State.restore(previousState);
}

function redo() {
    if (future.length === 0) return;
    
    const nextState = future.shift().state;
    State.restore(nextState);
    
    // The restored state becomes the new last state in history
    history.push({ state: State.snapshot(), actionType: 'REDO', timestamp: Date.now() });
}

/* ------------------ UI Module (Task A4) ------------------ */
const UI = (() => {
    
    function updateAll() {
        undoBtn.disabled = history.length <= 1;
        redoBtn.disabled = future.length === 0;
        zoomReadout.textContent = `${Math.round(currentZoom)}%`;
        
        // Enable/Disable delete button based on selection
        const { selection, lines } = State.getDoc();
        const line = lines[selection.line];
        const delSelBtn = $("#delSelBtn");

        if (delSelBtn) {
            // Check if a word is selected or if there's text to delete
            const hasText = line && line.words[selection.word] && line.words[selection.word].text.length > 0;
            const hasSelection = selection.multi.length > 0 || hasText;
            delSelBtn.disabled = !hasSelection;
        }
    }

    function setZoom(newZoom) {
        currentZoom = Math.max(50, Math.min(400, newZoom));
        zoomSlider.value = currentZoom;
        updateCanvasStyle();
        updateAll();
    }
    
    function updateCanvasStyle() {
        const scale = currentZoom / 100;
        canvas.style.transform = `scale(${scale})`;
    }
    
    function fitZoom() {
        const docRes = State.getDoc().res;
        const wrapRect = wrap.getBoundingClientRect();
        
        if (docRes.w === 0 || docRes.h === 0) return;

        // Account for canvas borders/padding (2px border + 10px visual gap from wrapper edge)
        const paddedW = wrapRect.width - 24; 
        const paddedH = wrapRect.height - 24;
        
        const scaleW = (paddedW / docRes.w) * 100;
        const scaleH = (paddedH / docRes.h) * 100;
        
        const fitScale = Math.floor(Math.min(scaleW, scaleH));
        setZoom(fitScale);
    }
    
    return { updateAll, setZoom, fitZoom };
})();

/* ------------------ Metrics Module (Task A2 - Text Sizing) ------------------ */
const Metrics = (() => {
    
    const CARET_WIDTH = 1;
    const CARET_HEIGHT = 10; // Fixed pixel height for the blinking line
    const DEFAULT_FONT = '9px Orbitron'; // We'll assume a fixed pixel-art font size/family for initial text metrics.

    /**
     * Measure the width of a string at a specific size, handling pixel-perfect fonts.
     * NOTE: For true LED/Pixel accuracy, this often requires a pre-rendered font sheet or fixed-width font.
     * We use Canvas `measureText` for layout initially, but final render must be pixel-accurate.
     * @param {string} text - The text content.
     * @param {number} size - The font size (e.g., 22).
     * @param {string} font - The font family (e.g., 'Orbitron').
     * @returns {number} The measured width in canvas pixels.
     */
    function measureWord(text, size, font) {
        ctx.font = `${size}px ${font || 'Orbitron'}`;
        // Return text.length * X if using a strict monospace pixel font
        // For now, use measureText as a proxy.
        return ctx.measureText(text).width;
    }

    /**
     * Calculates the width of an entire line, including word gaps.
     */
    function measureLine(words, wordGap) {
        if (words.length === 0) return 0;
        const textWidth = words.reduce((sum, word) => sum + measureWord(word.text, word.size, word.font), 0);
        const gapWidth = (words.length - 1) * wordGap;
        return textWidth + gapWidth;
    }

    /**
     * Applies autosize logic to a line to ensure it fits within the padded width. (Task A2)
     * @param {object} line - The line object containing words.
     * @param {number} maxWidth - The maximum available width (canvas width - 2 * padding).
     */
    function fitLineToWidth(line, maxWidth, wordGap) {
        // Simple autosize: if any word has autosize=true, scale the whole line down.
        const autosizeWords = line.words.filter(w => w.autosize);

        if (autosizeWords.length === 0) {
            // If no autosize words, just check if it fits
            line.words.forEach(word => { word.scale = 1; });
            return; 
        }

        let currentWidth = measureLine(line.words.map(w => ({ ...w, scale: 1 })), wordGap);
        let scale = 1;
        
        if (currentWidth > maxWidth && currentWidth > 0) {
            scale = maxWidth / currentWidth;
        }

        // Apply scale to all autosize words
        line.words.forEach(word => {
            word.scale = word.autosize ? scale : 1; 
        });
    }

    /**
     * Calculates the exact {x, y, w, h} coordinates for a single word and the caret position.
     * This function is crucial for hit detection and rendering.
     * NOTE: This is a simplified implementation. Real-world needs a fixed-width font map.
     */
    function calculateLayout() {
        const { res, spacing, lines, style } = State.getDoc();
        const paddedWidth = res.w - (spacing.padding * 2);
        const { lineGap, wordGap } = spacing;
        
        // 1. Calculate the total height of the content block
        let totalContentHeight = 0;
        lines.forEach(line => {
            // 2. Pre-calculate autosize for the line (Task A2)
            Metrics.fitLineToWidth(line.words, paddedWidth, wordGap);

            // Rough max height for line (using max font size + scale)
            const maxWordSize = line.words.reduce((max, w) => Math.max(max, w.size * (w.scale || 1)), 0);
            line.height = maxWordSize || CARET_HEIGHT; 
            totalContentHeight += line.height + lineGap;
        });
        totalContentHeight -= lineGap; // Remove last gap

        // 3. Determine the vertical start position (Task A6 - V-Align)
        let vStart = spacing.padding;
        if (style.valign === 'middle') {
            vStart = (res.h / 2) - (totalContentHeight / 2);
        } else if (style.valign === 'bottom') {
            vStart = res.h - totalContentHeight - spacing.padding;
        }
        
        // 4. Calculate X/Y for each word
        let currentY = vStart;
        lines.forEach((line, lineIndex) => {
            let lineContentWidth = Metrics.measureLine(line.words.map(w => ({ ...w, text: w.text, size: w.size * (w.scale || 1) })), wordGap);

            // Determine the horizontal start position (Task A6 - H-Align)
            let currentX = spacing.padding;
            if (line.align === 'center') {
                currentX = (res.w / 2) - (lineContentWidth / 2);
            } else if (line.align === 'right') {
                currentX = res.w - lineContentWidth - spacing.padding;
            }

            line.x = currentX;
            line.y = currentY;

            line.words.forEach(word => {
                const scaledSize = word.size * (word.scale || 1);
                const wordW = Metrics.measureWord(word.text, scaledSize, word.font);
                const wordH = line.height;

                word.x = currentX;
                word.y = currentY;
                word.w = wordW;
                word.h = wordH;

                currentX += wordW + wordGap;
            });

            currentY += line.height + lineGap;
        });
    }

    return {
        measureWord,
        measureLine,
        calculateLayout,
        CARET_WIDTH,
        CARET_HEIGHT
    };
})();

/* ------------------ Canvas Module (Tasks A1, A2) ------------------ */
const Canvas = (() => {
    
    function setupCanvas() {
        const docRes = State.getDoc().res;
        canvas.width = docRes.w;
        canvas.height = docRes.h;
        canvas.style.width = `${docRes.w}px`;
        canvas.style.height = `${docRes.h}px`;
    }

    function render(t) {
        const doc = State.getDoc();
        
        // 1. Re-calculate layout based on current text
        Metrics.calculateLayout();

        // 2. Clear Canvas & Draw Background
        ctx.fillStyle = doc.bg.color || '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 3. Draw Lines and Words
        doc.lines.forEach((line, lineIndex) => {
            line.words.forEach((word, wordIndex) => {
                
                // Set font and style
                const scaledSize = word.size * (word.scale || 1);
                ctx.font = `${scaledSize}px ${word.font || 'Orbitron'}`;
                ctx.fillStyle = word.color || '#FFFFFF';
                ctx.textBaseline = 'top';

                // NOTE: Animations logic (motion/color) would modify x/y/fillstyle here
                
                // Draw Text
                ctx.fillText(word.text, word.x, word.y);

                // 4. Draw Selection Glow (Task A1)
                const isSelected = doc.selection.line === lineIndex && doc.selection.word === wordIndex;
                if (isSelected) {
                    // Selection Glow (magenta blinking glow)
                    ctx.strokeStyle = `var(--grid-sel)`;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(word.x - 1, word.y - 1, word.w + 2, word.h + 2);
                    
                    // Red 'x' Handle (Task A1)
                    ctx.fillStyle = `var(--danger)`;
                    ctx.font = 'bold 14px sans-serif'; // Fixed size for the handle
                    const handleX = word.x + word.w - 1; // Top right inside bounds
                    const handleY = word.y;
                    ctx.fillText('×', handleX, handleY);
                }
            });
        });

        // 5. Draw Caret (Task A1)
        drawCaret(doc);
    }
    
    function drawCaret(doc) {
        // Caret blinking logic
        const now = Date.now();
        if (now - lastCaretBlink > 800) { // 0.8s blink cycle
            isCaretVisible = !isCaretVisible;
            lastCaretBlink = now;
        }

        if (!isCaretVisible || wrap.classList.contains('mode-play')) return; // Hide in Play mode

        const { line: l, word: w, caret: { index: i } } = doc.selection;
        const currentLine = doc.lines[l];
        if (!currentLine) return;
        const currentWord = currentLine.words[w];
        if (!currentWord && currentLine.words.length > 0 && w === currentLine.words.length) {
            // Caret at the start of a new, imaginary word after the last
            const lastWord = currentLine.words[currentLine.words.length - 1];
            const x = lastWord.x + lastWord.w + doc.spacing.wordGap;
            const y = currentLine.y;
            renderCaretAt(x, y);
            return;
        }
        if (!currentWord) return;

        // Measure text before caret
        const textBeforeCaret = currentWord.text.substring(0, i);
        const scaledSize = currentWord.size * (currentWord.scale || 1);
        const offsetW = Metrics.measureWord(textBeforeCaret, scaledSize, currentWord.font);
        
        const x = currentWord.x + offsetW;
        const y = currentWord.y;

        renderCaretAt(x, y);
    }

    function renderCaretAt(x, y) {
        ctx.fillStyle = `var(--caret)`;
        ctx.fillRect(x, y, Metrics.CARET_WIDTH, Metrics.CARET_HEIGHT);
    }

    // The main animation loop (used for blinking caret)
    function loop(t) {
        render(t);
        animationFrameId = requestAnimationFrame(loop);
    }


    /* ------------------ Input/Typing Logic (Task A1) ------------------ */
    function handleKeydown(e) {
        const { selection, lines } = State.getDoc();
        let { line: l, word: w, caret: { index: i } } = selection;
        const currentLine = lines[l];
        const currentWord = currentLine?.words[w];
        
        // Always reset blink on keypress
        isCaretVisible = true;
        lastCaretBlink = Date.now();
        
        const actionType = 'TYPE_CHAR'; // Default action type

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // --- Standard Character Input ---
            e.preventDefault();
            State.dispatch(actionType, (d) => {
                // Ensure a word exists to type into
                if (!d.lines[l].words[w]) {
                     d.lines[l].words[w] = { text: '', color: '#FFFFFF', font: 'Orbitron', size: 22, autosize: true, x: 0, y: 0, manual: false, anim: { motion: [], color: [] } };
                }

                const word = d.lines[l].words[w];
                word.text = word.text.slice(0, i) + e.key.toUpperCase() + word.text.slice(i);
                d.selection.caret.index++;
            });

        } else if (e.key === ' ') {
            // --- Space = New Word ---
            e.preventDefault();
            State.dispatch('ADD_WORD', (d) => {
                if (currentWord && currentWord.text.length === 0 && w > 0) {
                    // Do nothing if pressing space inside an empty word that isn't the first
                    return;
                }
                
                // Split the current word into two if caret is in the middle
                if (currentWord && i < currentWord.text.length) {
                    const nextText = currentWord.text.slice(i);
                    currentWord.text = currentWord.text.slice(0, i);
                    
                    // Insert new word at w + 1
                    d.lines[l].words.splice(w + 1, 0, { ...currentWord, text: nextText });
                }
                
                // Add a new empty word after the current one
                const newWord = { text: '', color: currentWord?.color || '#FFFFFF', font: currentWord?.font || 'Orbitron', size: currentWord?.size || 22, autosize: true, x: 0, y: 0, manual: false, anim: { motion: [], color: [] } };
                d.lines[l].words.splice(w + 1, 0, newWord);

                // Move selection to the new word
                d.selection.word = w + 1;
                d.selection.caret.index = 0;
            });
            
        } else if (e.key === 'Enter') {
            // --- Enter = New Line ---
            e.preventDefault();
            State.dispatch('ADD_LINE', (d) => {
                // Split current line at caret position
                const currentWord = d.lines[l].words[w];
                const wordsToMove = d.lines[l].words.splice(w + 1);

                // Split the current word and move the remainder to the new line
                if (currentWord) {
                    wordsToMove.unshift({ ...currentWord, text: currentWord.text.slice(i) });
                    currentWord.text = currentWord.text.slice(0, i);
                }

                // Create the new line object
                const newLine = { words: wordsToMove, align: d.lines[l].align };
                d.lines.splice(l + 1, 0, newLine);

                // Move selection to the new line
                d.selection.line = l + 1;
                d.selection.word = 0;
                d.selection.caret.index = 0;
            });

        } else if (e.key === 'Backspace') {
            // --- Backspace ---
            e.preventDefault();
            State.dispatch('DELETE_CHAR', (d) => {
                const { line: l, word: w, caret: { index: i } } = d.selection;
                const word = d.lines[l].words[w];

                if (i > 0) {
                    // Delete character before caret
                    word.text = word.text.slice(0, i - 1) + word.text.slice(i);
                    d.selection.caret.index--;
                } else if (w > 0) {
                    // Merge current word with previous word
                    const prevWord = d.lines[l].words[w - 1];
                    const newCaretIndex = prevWord.text.length;
                    
                    prevWord.text += word.text;
                    d.lines[l].words.splice(w, 1); // Remove current word

                    d.selection.word = w - 1;
                    d.selection.caret.index = newCaretIndex;

                } else if (l > 0 && w === 0) {
                    // Merge line with previous line
                    const prevLine = d.lines[l - 1];
                    const lastWordOfPrevLine = prevLine.words[prevLine.words.length - 1];
                    const newCaretIndex = lastWordOfPrevLine ? lastWordOfPrevLine.text.length : 0;
                    
                    // Merge all words from current line into previous line
                    prevLine.words = prevLine.words.concat(d.lines[l].words);
                    d.lines.splice(l, 1); // Remove current line

                    d.selection.line = l - 1;
                    d.selection.word = prevLine.words.length - (d.lines[l] ? d.lines[l].words.length : 1);
                    d.selection.caret.index = newCaretIndex;
                }
            });

        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            State.dispatch('MOVE_CARET', (d) => {
                if (i > 0) {
                    d.selection.caret.index--;
                } else if (w > 0) {
                    d.selection.word--;
                    d.selection.caret.index = d.lines[l].words[d.selection.word].text.length;
                } else if (l > 0) {
                    d.selection.line--;
                    d.selection.word = d.lines[d.selection.line].words.length - 1;
                    const word = d.lines[d.selection.line].words[d.selection.word];
                    d.selection.caret.index = word ? word.text.length : 0;
                }
            });
        
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            State.dispatch('MOVE_CARET', (d) => {
                const { line: l, word: w, caret: { index: i } } = d.selection;
                const word = d.lines[l].words[w];

                if (word && i < word.text.length) {
                    d.selection.caret.index++;
                } else if (w < d.lines[l].words.length - 1) {
                    d.selection.word++;
                    d.selection.caret.index = 0;
                } else if (l < d.lines.length - 1) {
                    d.selection.line++;
                    d.selection.word = 0;
                    d.selection.caret.index = 0;
                }
            });
        }
        // NOTE: ArrowUp/ArrowDown logic is complex and will be added later if needed, 
        // as vertical movement is non-trivial in a pixel canvas.
    }


    function handleInputFocus() {
        wrap.classList.add('focused');
        if (!animationFrameId) loop();
    }

    function handleInputBlur() {
        wrap.classList.remove('focused');
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Public methods for the Canvas module
    return {
        setupCanvas,
        render,
        handleKeydown,
        handleInputFocus,
        handleInputBlur,
        loop // expose for manual start if needed
    };
})();


/* ------------------ Initialization ------------------ */

function init() {
    // 1. Load initial state
    Object.assign(doc, defaultDoc);
    Object.assign(appsettings, defaultAppSettings);
    
    // 2. Record the initial state for the undo stack (history[0])
    history.push({ state: State.snapshot(), actionType: 'INIT', timestamp: Date.now() });

    // 3. Setup Canvas dimensions
    Canvas.setupCanvas();
    
    // 4. Wire up the Control Bar (Task A4) & Shortcuts (Task A3)
    on(undoBtn, 'click', undo);
    on(redoBtn, 'click', redo);
    on(clearBtn, 'click', () => {
        if(confirm("Are you sure you want to clear the entire canvas and all text? This is irreversible.")) {
             State.dispatch('CLEAR_CANVAS', (d) => {
                 d.lines = [{ words: [], align: 'center' }];
                 d.selection = { line: 0, word: 0, caret: { index: 0 }, multi: [] };
             });
        }
    });

    on(zoomSlider, 'input', (e) => UI.setZoom(e.target.value));
    on(fitBtn, 'click', UI.fitZoom);
    on(window, 'resize', UI.fitZoom);

    // 5. Wire Canvas focus & input (Task A1)
    on(wrap, 'focus', Canvas.handleInputFocus);
    on(wrap, 'blur', Canvas.handleInputBlur);
    on(wrap, 'keydown', Canvas.handleKeydown);

    // 6. Global keyboard shortcuts (Task A3)
    document.addEventListener('keydown', (e) => {
        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
        
        if (e.target.closest('.modal') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (isCmdOrCtrl && e.key === 'z') {
            e.preventDefault();
            e.shiftKey ? redo() : undo(); // Shift+Z for Redo, Z for Undo
        } else if (isCmdOrCtrl && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });
    
    // 7. Initial render and fit
    UI.fitZoom();
    Canvas.loop(); // Start the animation loop for caret blinking
    UI.updateAll();
}

// Start the application
on(document, 'DOMContentLoaded', init);
