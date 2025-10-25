/* =======================================================================
   LED Backpack Animator v2.1 — app.js (Step 1: Core Structure, State, History)
   - Initializes core state (doc, appsettings) and history array.
   - Implements robust State.dispatch() for reliable undo/redo (Task A3).
   - Wires up Control Bar (A4) and basic Canvas Focus (A1).
   - Skeleton for Canvas rendering and initial sizing.
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
let currentZoom = 100; // Tracked separately from state for performance

// --- Default State (To be loaded from JSON later, but hardcoded for MVP start) ---
const defaultDoc = {
  res: { w: 96, h: 128 },
  bg: { type: 'preset', preset: 'A', color: '#000000', image: null, name: 'Preset_A' },
  spacing: { lineGap: 6, wordGap: 4, padding: 8 },
  style: { align: 'center', valign: 'middle' },
  lines: [
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


/**
 * Central state management object. All mutations must go through dispatch.
 */
const State = (() => {
    
    /**
     * Creates an immutable snapshot of the current project state (doc).
     * @returns {object} A deep clone of the 'doc'.
     */
    function snapshot() {
        return clone(doc);
    }
    
    /**
     * Restores the project state from a snapshot, updating UI and canvas.
     * @param {object} snap - The state to restore.
     */
    function restore(snap) {
        Object.assign(doc, snap);
        // NOTE: Functions to update resolution/background/style must be called here
        // to fully reflect the restored state (e.g., Layout.fitCanvasToStage()).
        
        UI.updateAll();
        Canvas.render();
    }

    /**
     * Executes a state change and records the previous state to history.
     * @param {string} actionType - The action type (e.g., 'TYPE_CHAR', 'SET_COLOR').
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
    
    // Public methods for the State module
    return {
        dispatch,
        restore,
        snapshot,
        getDoc: () => doc,
        getSettings: () => appsettings
    };
})();


/**
 * Undo functionality (Task A3).
 */
function undo() {
    if (history.length === 0) return;
    
    // 1. Move current state (the one being reverted from) to future
    const currentState = State.snapshot();
    future.unshift({ state: currentState });
    
    // 2. Pop the previous state from history and restore it
    const previousState = history.pop().state;
    State.restore(previousState);
}

/**
 * Redo functionality (Task A3).
 */
function redo() {
    if (future.length === 0) return;
    
    // 1. Pop the next state from future and restore it
    const nextState = future.shift().state;
    State.restore(nextState);
    
    // 2. The restored state becomes the new last state in history
    history.push({ 
        state: State.snapshot(), // Save the restored state as the new 'latest'
        actionType: 'REDO', 
        timestamp: Date.now() 
    });
}


/* ------------------ UI Module (Skeleton for Task A4) ------------------ */
const UI = (() => {
    
    function updateAll() {
        // Update Undo/Redo button states
        undoBtn.disabled = history.length <= 1; // Only disable if back to initial state
        redoBtn.disabled = future.length === 0;
        
        // Update zoom readout
        zoomReadout.textContent = `${Math.round(currentZoom)}%`;
        
        // NOTE: Add logic here to update other UI elements
        // (e.g., delete button enabled/disabled based on selection.word != null)
    }

    function setZoom(newZoom) {
        currentZoom = Math.max(50, Math.min(400, newZoom));
        zoomSlider.value = currentZoom;
        updateCanvasStyle();
        updateAll();
    }
    
    function updateCanvasStyle() {
        // Apply zoom scale and centering to the canvas element
        const scale = currentZoom / 100;
        canvas.style.transform = `scale(${scale})`;
    }
    
    function fitZoom() {
        // Calculates the maximum scale factor to fit the canvas in its wrapper
        const docRes = State.getDoc().res;
        const wrapRect = wrap.getBoundingClientRect();
        
        if (docRes.w === 0 || docRes.h === 0) return;

        // Account for 16px of padding around the canvas in the wrapper (adjust if needed)
        const paddedW = wrapRect.width - 32; 
        const paddedH = wrapRect.height - 32;
        
        const scaleW = (paddedW / docRes.w) * 100;
        const scaleH = (paddedH / docRes.h) * 100;
        
        const fitScale = Math.floor(Math.min(scaleW, scaleH));
        setZoom(fitScale);
    }
    
    return {
        updateAll,
        setZoom,
        fitZoom
    };
})();


/* ------------------ Canvas Module (Skeleton for Task A1) ------------------ */
const Canvas = (() => {
    
    function setupCanvas() {
        // Set physical canvas dimensions based on doc.res
        const docRes = State.getDoc().res;
        canvas.width = docRes.w;
        canvas.height = docRes.h;
        
        // Set canvas CSS size to its native resolution for pixel accuracy
        canvas.style.width = `${docRes.w}px`;
        canvas.style.height = `${docRes.h}px`;
    }
    
    function render() {
        const doc = State.getDoc();
        
        // 1. Clear Canvas
        ctx.fillStyle = doc.bg.color || '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 2. Draw Background Image/Preset (if implemented)
        
        // 3. Draw Lines and Words (MUST be implemented next)
        
        // 4. Draw Selection Box and Caret (Task A1)
    }

    function handleInputFocus() {
        wrap.classList.add('focused');
        // NOTE: Here you would show the mobile keyboard using a hidden input field
    }

    function handleInputBlur() {
        wrap.classList.remove('focused');
        // NOTE: Here you would hide the mobile keyboard
    }
    
    // Public methods for the Canvas module
    return {
        setupCanvas,
        render,
        handleInputFocus,
        handleInputBlur
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
    
    // 4. Wire up the Control Bar (Task A4)
    on(undoBtn, 'click', undo);
    on(redoBtn, 'click', redo);
    on(clearBtn, 'click', () => {
        if(confirm("Are you sure you want to clear the entire canvas and all text?")) {
             State.dispatch('CLEAR_CANVAS', (d) => {
                 d.lines = [{ words: [], align: 'center' }];
                 d.selection = { line: 0, word: 0, caret: { index: 0 }, multi: [] };
             });
        }
    });

    on(zoomSlider, 'input', (e) => UI.setZoom(e.target.value));
    on(fitBtn, 'click', UI.fitZoom);
    on(window, 'resize', UI.fitZoom); // Auto-fit on resize

    // 5. Wire Canvas focus (Task A1)
    on(wrap, 'focus', Canvas.handleInputFocus);
    on(wrap, 'blur', Canvas.handleInputBlur);
    // NOTE: Clicks must be handled by the Canvas module to manage selection
    
    // 6. Initial render and fit
    UI.fitZoom();
    Canvas.render();
    UI.updateAll();
}

// Start the application
on(document, 'DOMContentLoaded', init);

// NOTE: The next logical step is to implement the Canvas Editing Engine (Task A1)
// which includes handling keyboard events and text metrics.
