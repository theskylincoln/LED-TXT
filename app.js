// === 1. GLOBAL STATE & CONFIGURATION ===
const appState = {
    resolution: '96x128',
    mode: 'edit', // 'edit' or 'preview'
    zoomLevel: 100,
    background: {
        type: 'preset',
        color: '#000000',
        preset: 'Preset_A.png'
    },
    words: [
        /* { id, text, x, y, color, fontSize, alignment, animations: { scroll: { enabled, speed } } } */
    ],
    selectedWordId: null,
    history: [],
    historyIndex: -1,
    manualDragWarningShown: false
};

const ANIMATIONS = [
    { name: 'scroll', setting: 'speed', default: 5 },
    { name: 'pulse', setting: 'intensity', default: 3 },
    { name: 'flicker', setting: 'speed', default: 5 },
    // ... add all other animations
];

// === 2. DOM ELEMENTS CACHE ===
const elements = {
    canvas: document.getElementById('led-canvas'),
    inspector: document.getElementById('inspector'),
    zoomDisplay: document.getElementById('zoom-display'),
    manualWarning: document.getElementById('manual-warning'),
    // ... other buttons and inputs
};

// === 3. STATE MANAGEMENT & RENDERING ===

/**
 * Saves the current state for Undo/Redo functionality.
 */
function saveState() {
    // Clear future history if not at the end
    if (appState.historyIndex < appState.history.length - 1) {
        appState.history.splice(appState.historyIndex + 1);
    }
    // Deep clone the state and push
    appState.history.push(JSON.parse(JSON.stringify(appState)));
    appState.historyIndex = appState.history.length - 1;
    
    // Update undo/redo button disabled status
    // (To be implemented)
}

/**
 * The core function that updates the DOM to reflect the appState.
 */
function renderCanvas() {
    // 1. Update Canvas Size & Zoom
    elements.canvas.className = `canvas-${appState.resolution}`;
    elements.canvas.style.transform = `scale(${appState.zoomLevel / 100})`;
    elements.zoomDisplay.textContent = `${appState.zoomLevel}%`;

    // 2. Clear existing words
    elements.canvas.innerHTML = '';

    // 3. Render words
    appState.words.forEach(word => {
        const wordEl = document.createElement('div');
        wordEl.classList.add('word');
        wordEl.id = word.id;
        wordEl.textContent = word.text;
        
        wordEl.style.color = word.color;
        wordEl.style.fontSize = `${word.fontSize}px`;
        wordEl.style.fontFamily = word.fontFamily;
        
        // Positioning logic (simplified, needs full implementation for alignment)
        wordEl.style.left = `${word.x}px`;
        wordEl.style.top = `${word.y}px`;

        if (word.id === appState.selectedWordId) {
            wordEl.classList.add('selected');
            
            // Add floating delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-btn');
            deleteBtn.textContent = 'X';
            deleteBtn.onclick = () => deleteWord(word.id);
            wordEl.appendChild(deleteBtn);
        }

        elements.canvas.appendChild(wordEl);
    });

    // 4. Update Inspector state
    updateInspectorUI();
}

/**
 * Updates the inspector UI based on the selected word's properties.
 */
function updateInspectorUI() {
    const isSelected = appState.selectedWordId !== null;
    if (!isSelected) {
        elements.inspector.classList.add('greyed-out');
        // Clear inputs
    } else {
        elements.inspector.classList.remove('greyed-out');
        const word = appState.words.find(w => w.id === appState.selectedWordId);
        // Bind word properties to input values (e.g., color, size, animation settings)
        // document.getElementById('font-size-input').value = word.fontSize;
    }
}

// === 4. CORE EVENT HANDLERS ===

/**
 * Handles clicks outside the word elements to deselect.
 */
elements.canvas.addEventListener('click', (e) => {
    if (e.target.id === 'led-canvas') {
        appState.selectedWordId = null;
        renderCanvas();
    }
});

/**
 * Handles word selection on click.
 */
elements.canvas.addEventListener('click', (e) => {
    const wordEl = e.target.closest('.word');
    if (wordEl) {
        // Prevent deselecting if clicking the delete button
        if (e.target.classList.contains('delete-btn')) return;
        
        // Select the word
        appState.selectedWordId = wordEl.id;
        renderCanvas();
        // Set focus for typing
        elements.canvas.focus(); 
    }
});

/**
 * Handles typing events directly on the canvas.
 */
elements.canvas.addEventListener('keydown', (e) => {
    const wordIndex = appState.words.findIndex(w => w.id === appState.selectedWordId);
    if (wordIndex === -1 || appState.mode !== 'edit') return;
    
    const word = appState.words[wordIndex];
    let keyHandled = true;

    if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9.,?!-]/)) {
        // Regular typing
        word.text += e.key.toUpperCase();
    } else if (e.key === 'Backspace') {
        word.text = word.text.slice(0, -1);
        if (word.text.length === 0) {
            deleteWord(word.id);
            return; // Exit as state changed
        }
    } else if (e.key === ' ') {
        // Space = adds a new word (same line)
        addNewWord(' ');
    } else if (e.key === 'Enter') {
        // Enter = adds a new line (centered automatically)
        addNewWord('\n');
    } else {
        keyHandled = false;
    }

    if (keyHandled) {
        e.preventDefault();
        saveState();
        renderCanvas();
    }
});

/**
 * Handles double-click to add a new word element.
 */
elements.canvas.addEventListener('dblclick', (e) => {
    addNewWord();
});

/**
 * Helper function to create and select a new word.
 */
function addNewWord(context = '') {
    const newId = `word-${Date.now()}`;
    const newWord = {
        id: newId,
        text: 'TEXT',
        x: elements.canvas.offsetWidth / 2, // Centered X
        y: elements.canvas.offsetHeight / 2, // Centered Y
        color: '#FFFFFF',
        fontFamily: 'VT323',
        fontSize: 16,
        alignment: 'center',
        animations: ANIMATIONS.reduce((acc, anim) => {
            acc[anim.name] = { enabled: false, [anim.setting]: anim.default };
            return acc;
        }, {})
    };

    if (context === '\n' && appState.selectedWordId) {
        // Logic to calculate position on a new line below the current word
        const selectedWord = appState.words.find(w => w.id === appState.selectedWordId);
        newWord.y = selectedWord.y + selectedWord.fontSize * 1.5; // Simple line gap
    }
    
    appState.words.push(newWord);
    appState.selectedWordId = newId;
    saveState();
    renderCanvas();
}

function deleteWord(id) {
    appState.words = appState.words.filter(word => word.id !== id);
    appState.selectedWordId = null;
    saveState();
    renderCanvas();
}

// === 5. ANIMATION & MODE CONTROL ===

let animationFrameId;

function toggleMode(newMode) {
    if (appState.mode === newMode) return;

    appState.mode = newMode;

    if (newMode === 'preview') {
        // Start animation loop
        elements.inspector.style.transition = 'opacity 0.3s';
        elements.inspector.classList.add('hidden');
        startAnimationLoop();
    } else {
        // Stop animation loop, return to static edit view
        cancelAnimationFrame(animationFrameId);
        elements.inspector.classList.remove('hidden');
        elements.inspector.style.transition = 'all 0.3s ease-in-out';
        renderCanvas(); // Redraw static positions
    }
}

function startAnimationLoop() {
    let lastTime = 0;
    const animate = (timestamp) => {
        if (appState.mode !== 'preview') return;
        
        const delta = timestamp - lastTime;
        lastTime = timestamp;

        appState.words.forEach(word => {
            // Apply animation logic based on 'word.animations' and 'delta'
            const wordEl = document.getElementById(word.id);
            if (wordEl && word.animations.scroll.enabled) {
                // Example: simple X offset for scrolling
                let currentX = parseFloat(wordEl.style.left) || 0;
                currentX -= (word.animations.scroll.speed * delta / 100); // Speed factor
                
                // Implement prevent cutoff / looping logic here
                
                wordEl.style.left = `${currentX}px`;
            }
            // ... implement other animations (Pulse, Flicker, etc.)
        });

        animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
}


// === 6. INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listeners to all toolbar buttons
    document.getElementById('preview-btn').addEventListener('click', () => toggleMode('preview'));
    document.getElementById('edit-btn').addEventListener('click', () => toggleMode('edit'));
    document.getElementById('zoom-in-btn').addEventListener('click', () => { 
        appState.zoomLevel = Math.min(400, appState.zoomLevel + 25); renderCanvas();
    });
    document.getElementById('zoom-out-btn').addEventListener('click', () => { 
        appState.zoomLevel = Math.max(25, appState.zoomLevel - 25); renderCanvas();
    });
    document.getElementById('toggle-inspector-btn').addEventListener('click', () => {
        elements.inspector.classList.toggle('hidden');
    });
    
    // Initial render
    saveState(); // Save the initial empty state
    renderCanvas();
});
