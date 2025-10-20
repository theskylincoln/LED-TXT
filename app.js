/* app.js — LED Backpack Animator v3.0.1
 * Fixes: invalid selector crash; stronger guards; solid BG wiring; init swatches; add word/line wiring
 */

(() => {
  const $ = (sel, p=document) => p.querySelector(sel);
  const $$ = (sel, p=document) => Array.from(p.querySelectorAll(sel));

  // ---- Core elements
  const canvas = $("#led");
  const ctx = canvas ? canvas.getContext("2d", { willReadFrequently: true }) : null;
  const wrap = $(".canvas-wrap");

  const resSelect = $("#resSelect");
  const zoomRange = $("#zoom");
  const fitBtn = $("#fitBtn");

  const modeEditBtn = $("#modeEdit");
  const modePrevBtn = $("#modePreview");
  const undoBtn = $("#undoBtn");
  const redoBtn = $("#redoBtn");
  const clearAllBtn = $("#clearAllBtn");

  const aboutBtn = $("#aboutBtn");
  const aboutModal = $("#aboutModal");
  const aboutClose = $("#aboutClose");

  const clearWarn = $("#clearWarn");
  const clearCancel = $("#clearCancel");
  const clearConfirm = $("#clearConfirm");
  const suppressClearWarn = $("#suppressClearWarn");

  // Inspector
  const toggleInspector = $("#toggleInspector");
  const inspectorBody = $("#inspectorBody");
  const accs = $$(".acc");

  // Font & color
  const fontSelect = $("#fontSelect");
  const fontSize = $("#fontSize");
  const autoSize = $("#autoSize");
  const fontColor = $("#fontColor");

  // Combined Spacing + Alignment
  const lineGap = $("#lineGap");
  const wordGap = $("#wordGap");
  const alignBtns = $$("[data-align]");
  const vAlignBtns = $$("[data-valign]");
  const applyAllAlign = $("#applyAllAlign");
  const manualDragChk = $("#manualDragChk");

  // Background
  const bgThumbs = $("#bgThumbs");
  const bgSolidBtn = $("#bgSolidBtn");
  const bgSolidColor = $("#bgSolidColor");
  const addBgSwatchBtn = $("#addBgSwatchBtn");
  const bgSwatches = $("#bgSwatches");
  const bgUpload = $("#bgUpload");

  // Words/Lines
  const addWordBtn = $("#addWordBtn");
  const addLineBtn = $("#addLineBtn");

  // Config / Render
  const saveJsonBtn = $("#saveJsonBtn");
  const loadJsonInput = $("#loadJsonInput");
  const fpsInput = $("#fps");
  const secInput = $("#seconds");
  const renderGifBtn = $("#renderGifBtn");
  const downloadLink = $("#downloadLink");
  const fileNameInput = $("#fileName");

  // Animations UI (FIXED selector)
  const animContainer = $("#accAnim .acc-body");
  let animList = $("#animList");
  let animHelpBtn = $("#animHelpBtn");

  // Mobile typing helper
  const mobileInput = $("#mobileInput");

  // Utilities
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  // ---- State
  const PRESET_COLORS = ["#000000","#FFFFFF","#FFD700","#FF7F50","#FF3B3B","#00FFAA","#00BFFF","#1E90FF","#8A2BE2","#FF00FF","#00FF00","#FFA500","#C0C0C0"];

  // Animation catalog (same as v3.0)
  const ANIM = [
    { key:"slide_in", label:"Slide In", group:"Core Motions", defaults:{ dir:"left", speed:40, distance:1.2 }, apply:(ctx, A)=>slideInOut(A,true) },
    { key:"slide_out", label:"Slide Out", group:"Core Motions", defaults:{ dir:"right", speed:40, distance:1.2 }, apply:(ctx, A)=>slideInOut(A,false) },
    { key:"bounce", label:"Bounce", group:"Core Motions", defaults:{ y:4, freq:6, int:1 }, apply:(_,A)=>({dx:0,dy:Math.round(A.y*Math.abs(Math.sin(A.t*A.freq*A.int)))}) },
    { key:"jitter", label:"Jitter", group:"Core Motions", defaults:{ ampl:0.6, freq:25 }, apply:(_,A)=>({dx:(Math.random()-0.5)*A.ampl, dy:(Math.random()-0.5)*A.ampl}) },
    { key:"shake", label:"Shake", group:"Core Motions", defaults:{ ampl:1.2, freq:20 }, apply:(_,A)=>({dx:Math.round(A.ampl*Math.sin(A.t*A.freq)), dy:0}) },
    { key:"zoom_in", label:"Zoom In", group:"Core Motions", defaults:{ rate:1 }, apply:(_,A)=>({scale:1 - 0.5*Math.exp(-A.t*A.rate)}) },
    { key:"zoom_out", label:"Zoom Out", group:"Core Motions", defaults:{ rate:1 }, apply:(_,A)=>({scale:1.2 - 0.2*Math.min(1, A.t*A.rate)}) },

    { key:"pulse", label:"Pulse/Breathe", group:"Looping Ambient", defaults:{ int:1, scale:0.06, y:3, freq:6 }, apply:(_,A)=>({scale:1 + A.scale*Math.sin(A.t*A.freq*A.int), dy:Math.round(A.y*Math.sin(A.t*A.freq*A.int))}) },
    { key:"flicker", label:"Flicker", group:"Looping Ambient", defaults:{ int:1 }, apply:(_,A)=>({alpha: (Math.sin(A.t*50*A.int)>0? 1:0.6)}) },
    { key:"wave", label:"Wave", group:"Looping Ambient", defaults:{ int:1, amp:3, phase:0 }, apply:(_,A)=>({dy:Math.round(A.amp*Math.sin((A.x + A.t*40*A.int)/10 + A.phase))}) },
    { key:"scroll", label:"Scroll (Marquee)", group:"Looping Ambient", defaults:{ dir:"left", speed:20, gap:12 }, apply:(_,A)=>scrollApply(A) },
    { key:"glow_pulse", label:"Glow Pulse", group:"Looping Ambient", defaults:{ int:1 }, apply:(_,A)=>({alpha: 0.85 + 0.15*Math.sin(A.t*4*A.int)}) },

    { key:"color_cycle", label:"Color Cycle", group:"Color / Light", defaults:{ speed:0.4 }, apply:(_,A)=>({colorMod: hsvShift(A.baseColor, (A.t*A.speed)%1 )}) },
    { key:"rainbow", label:"Rainbow Sweep", group:"Color / Light", defaults:{ speed:0.6 }, apply:(_,A)=>({colorMod: hsvFromPos(A.x*0.02 + A.t*A.speed)}) },
    { key:"strobe", label:"Strobe", group:"Color / Light", defaults:{ freq:10 }, apply:(_,A)=>({alpha: (Math.sin(A.t*A.freq*6.283)>0.2?1:0.15)}) },
    { key:"highlight", label:"Highlight Sweep", group:"Color / Light", defaults:{ speed:0.6, width:20 }, apply:(_,A)=>({highlight: ( (A.x % (A.width + A.width)) < (A.width) ? 0.3 : 0) }) },

    { key:"typewriter", label:"Typewriter", group:"Character-Level", defaults:{ speed:15 }, charLevel:true,
      apply:(_,A)=>({visibleChars: Math.floor(A.t*A.speed)}) },
    { key:"scramble", label:"Scramble/Decode", group:"Character-Level", defaults:{ speed:18 }, charLevel:true,
      apply:(_,A)=>({scramble: true, scrambleSpeed:A.speed}) },
    { key:"ripple", label:"Ripple", group:"Character-Level", defaults:{ amp:4, speed:5 }, charLevel:true,
      apply:(_,A)=>({dy: Math.round(A.amp*Math.sin((A.iChar*0.6) + A.t*A.speed))}) },
    { key:"popcorn", label:"Popcorn", group:"Character-Level", defaults:{ freq:6 }, charLevel:true,
      apply:(_,A)=>({alpha: 0.6 + 0.4*Math.max(0, Math.sin((A.iChar*0.7 + A.t*A.freq) ))) }) },
    { key:"glitch", label:"Glitch", group:"Character-Level", defaults:{ amp:1.5, freq:18 }, charLevel:true,
      apply:(_,A)=>({dx: ((A.iChar%2)?1:-1)*A.amp*Math.sin(A.t*A.freq), glitch:true}) },

    { key:"fade_out", label:"Fade Out", group:"Exit / Transitions", defaults:{ speed:1 }, apply:(_,A)=>({alpha: Math.max(0, 1 - A.t*A.speed)}) },
    { key:"slide_away", label:"Slide Away", group:"Exit / Transitions", defaults:{ dir:"left", speed:40, distance:1.2 }, apply:(ctx, A)=>slideAway(A) },
    { key:"shrink_vanish", label:"Shrink & Vanish", group:"Exit / Transitions", defaults:{ speed:1 }, apply:(_,A)=>({scale: Math.max(0.01, 1 - A.t*A.speed)}) },

    { key:"sparkle", label:"Sparkle", group:"Stylized", defaults:{ density:0.06 }, apply:(_,A)=>({sparkle:true, density:A.density}) },
    { key:"heartbeat", label:"Heartbeat", group:"Stylized", defaults:{ bpm:80, amp:0.08 }, apply:(_,A)=>({scale: 1 + A.amp*beat(A.t, A.bpm)}) },
  ];

  const ANIM_HELP = {
    slide_in: "Text enters from a direction. Settings: direction, speed.",
    slide_out: "Text exits toward a direction.",
    bounce: "Soft bounce on Y-axis.",
    jitter: "Tiny random shifts.",
    shake: "Rhythmic horizontal shake.",
    zoom_in: "Gradual scale up.",
    zoom_out: "Gradual scale down.",
    pulse: "Gentle scale + vertical breathe.",
    flicker: "Neon-like irregular flicker.",
    wave: "Small vertical wave across the line.",
    scroll: "Marquee crawl; direction+speed; starts off-screen.",
    glow_pulse: "Subtle alpha pulsing.",
    color_cycle: "Hue rotates over time.",
    rainbow: "Rainbow hue sweep across X.",
    strobe: "On/off flashes.",
    highlight: "Bright sweep passes across text.",
    typewriter: "Characters appear sequentially.",
    scramble: "Random characters resolve into real text.",
    ripple: "Per-character vertical ripple.",
    popcorn: "Random per-character pops.",
    glitch: "Per-character glitchy shifts.",
    fade_out: "Opacity fades to 0.",
    slide_away: "Text slides out (exit).",
    shrink_vanish: "Scale shrinks to zero.",
    sparkle: "Occasional bright sparkles.",
    heartbeat: "Pulse synced to BPM.",
  };

  const state = {
    mode: "edit",
    zoom: 1,
    res: { w: 96, h: 128 },
    vAlign: "middle",
    background: { type:"solid", color:"#000000", image:null, name:"solid" },
    lines: [
      { words: [{ text:"HELLO", color:"#FFFFFF", font:"Orbitron", size:22, align:"center", x:0, y:0, manual:false, caret:5, animations:[] }], align:"center" }
    ],
    selection: { line:0, word:0 },
    undo: [], redo: [],
    autoSize: true,
    spacing: { lineGap:4, word:6 },
    customSwatches: ["#000000"],
    bgImages: {
      "96x128": [
        { key:"Preset_A", preset:"assets/presets/96x128/Preset_A.png", thumb:"assets/thumbs/Preset_A_thumb.png" },
        { key:"Preset_B", preset:"assets/presets/96x128/Preset_B.png", thumb:"assets/thumbs/Preset_B_thumb.png" },
      ],
      "64x64": [
        { key:"Preset_C", preset:"assets/presets/64x64/Preset_C.png", thumb:"assets/thumbs/Preset_C_thumb.png" },
        { key:"Preset_D", preset:"assets/presets/64x64/Preset_D.png", thumb:"assets/thumbs/Preset_D_thumb.png" },
      ],
    }
  };

  // ---- Undo
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

  function selectedWord() {
    if (!state.selection) return null;
    const L = state.lines[state.selection.line]; if (!L) return null;
    return L.words[state.selection.word] || null;
  }
  function getActive() { return selectedWord(); }

  // ---- Zoom / Fit
  function applyZoom(){ if (!canvas) return; canvas.style.transform = `translate(-50%,-50%) scale(${state.zoom})`; }
  function setCanvasResolution(){ if(!canvas) return; canvas.width = state.res.w; canvas.height = state.res.h; applyZoom(); }
  function autoFitZoom() {
    if (!wrap) return;
    const R = wrap.getBoundingClientRect();
    const pad = 16;
    const availW = Math.max(50, R.width - pad);
    const availH = Math.max(50, R.height - pad);
    const z = clamp(Math.min(availW/state.res.w, availH/state.res.h), 0.5, 10);
    state.zoom = z;
    if (zoomRange) zoomRange.value = String(z.toFixed(2));
    applyZoom();
  }

  // ---- Layout & measurement
  function measureWordBounds(word) {
    const c = document.createElement("canvas").getContext("2d");
    c.font = `${word.size}px ${word.font}`;
    const tm = c.measureText(word.text || "");
    const w = Math.max(1, (tm.actualBoundingBoxRight - tm.actualBoundingBoxLeft) || tm.width);
    const h = Math.max(1, (tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent) || (word.size*0.8));
    return { w, h, tm };
  }
  function lineWidth(line) {
    let tot = 0;
    for (let i=0;i<line.words.length;i++){
      const m = measureWordBounds(line.words[i]);
      tot += m.w;
      if (i<line.words.length-1) tot += state.spacing.word;
    }
    return tot;
  }
  function totalLinesHeight() {
    return state.lines.reduce((sum, line, idx)=>{
      const maxH = Math.max(...line.words.map(w=>measureWordBounds(w).h), 1);
      return sum + maxH + (idx? state.spacing.lineGap : 0);
    }, 0);
  }
  function layoutContent() {
    const pad = 4;
    const totalH = totalLinesHeight();
    let y;
    if (state.vAlign==="top") y = pad+2;
    else if (state.vAlign==="bottom") y = Math.max(pad, state.res.h - totalH - pad);
    else y = Math.round((state.res.h - totalH)/2) + pad;

    for (let li=0; li<state.lines.length; li++) {
      const line = state.lines[li];
      const lh = Math.max(...line.words.map(w=>measureWordBounds(w).h), 1);
      const lw = lineWidth(line);
      let xStart = 0;
      const align = line.align || "center";
      if (align==="center") xStart = Math.round((state.res.w - lw)/2);
      else if (align==="right") xStart = Math.round(state.res.w - lw - pad);
      else xStart = pad;
      let x=xStart;
      for (let wi=0; wi<line.words.length; wi++){
        const w = line.words[wi];
        if (!w.manual) { w.x=x; w.y=y+lh; }
        const m = measureWordBounds(w);
        x += m.w + (wi<line.words.length-1? state.spacing.word : 0);
      }
      y += lh + state.spacing.lineGap;
    }
  }

  // ---- Background
  function drawBackground() {
    if (!ctx || !canvas) return;
    const {type,color,image} = state.background;
    if (type==="solid" || !image){ ctx.fillStyle=color||"#000"; ctx.fillRect(0,0,canvas.width,canvas.height); }
    else { ctx.drawImage(image,0,0,canvas.width,canvas.height); }
  }

  // ---- Color helpers
  function rgbToHsv(r,g,b){ r/=255;g/=255;b/=255; const max=Math.max(r,g,b),min=Math.min(r,g,b); let h,s,v=max; const d=max-min; s=max===0?0:d/max; if(max===min){h=0;} else { switch(max){case r:h=(g-b)/d + (g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6; } return [h,s,v]; }
  function hsvToRgb(h,s,v){ let r,g,b; let i=Math.floor(h*6); let f=h*6-i; let p=v*(1-s); let q=v*(1-f*s); let t=v*(1-(1-f)*s); switch(i%6){case 0:r=v,g=t,b=p;break;case 1:r=q,g=v,b=p;break;case 2:r=p,g=v,b=t;break;case 3:r=p,g	q,b=v;break;case 4:r=t,g	p,b=v;break;case 5:r=v,g	p,b=q;break;} return [Math.round(r*255),Math.round(g*255),Math.round(b*255)]; }
  function hexToRgb(hex){ const n=parseInt(hex.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  function rgbToHex(r,g,b){ return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1).toUpperCase(); }
  function hsvShift(baseHex, dH){ const [r,g,b]=hexToRgb(baseHex); let [h,s,v]=rgbToHsv(r,g,b); h=(h+dH)%1; if(h<0)h+=1; const [R,G,B]=hsvToRgb(h,s,v); return rgbToHex(R,G,B); }
  function hsvFromPos(pos){ const [R,G,B]=hsvToRgb((pos%1+1)%1, 1, 1); return rgbToHex(R,G,B); }

  function beat(t, bpm){ const secsPerBeat = 60/Math.max(1,bpm); const phase=(t%secsPerBeat)/secsPerBeat; return Math.pow(Math.sin(phase*Math.PI),2); }

  function getAnimSpec(word) {
    const map = new Map();
    (word.animations||[]).forEach(a=> map.set(a.type, {...a}));
    return map;
  }
  function setAnimSpec(word, map){ word.animations = Array.from(map.values()); }

  function offscreenStart(dir) {
    switch(dir){
      case "left": return { dx: -state.res.w*1.2 };
      case "right": return { dx: state.res.w*1.2 };
      case "up": return { dy: -state.res.h*1.2 };
      case "down": return { dy: state.res.h*1.2 };
      default: return {};
    }
  }
  function slideInOut(A, entering) {
    const prog = clamp(A.t*(A.speed/40),0,1);
    const f = entering ? (1-prog) : prog;
    const os = offscreenStart(A.dir);
    return { dx: Math.round((os.dx||0)*f), dy: Math.round((os.dy||0)*f) };
  }
  function slideAway(A) {
    const prog = clamp(A.t*(A.speed/40),0,1);
    const os = offscreenStart(A.dir);
    return { dx: Math.round((os.dx||0)*prog), dy: Math.round((os.dy||0)*prog) };
  }
  function scrollApply(A) {
    const speed = A.speed || 20;
    const dir = A.dir || "left";
    const total = A.textWidth + (A.gap||12);
    const cycle = total + A.width;
    const base = (A.t * speed) % cycle;
    if (dir==="left")   return { dx: Math.round(A.width - base) };
    if (dir==="right")  return { dx: Math.round(base - total) };
    if (dir==="up")     return { dy: Math.round(A.height - base) };
    if (dir==="down")   return { dy: Math.round(base - total) };
    return { dx:0, dy:0 };
  }

  function autosizeAllLines() {
    if (!state.autoSize) return;
    const pad=6, maxW=state.res.w - pad*2;
    for (const line of state.lines) {
      let tries=0;
      while (tries<80) {
        const lw=lineWidth(line);
        if (lw <= maxW) break;
        for (const w of line.words) w.size = Math.max(6, Math.floor(w.size*0.96));
        tries++;
      }
    }
  }
  const autosizeKick = ()=>{ autosizeAllLines(); requestAnimationFrame(autoFitZoom); };

  function render(timestamp=0) {
    try{
      if (!ctx || !canvas) return requestAnimationFrame(render);
      autosizeAllLines();
      layoutContent();
      drawBackground();

      const tSec = timestamp/1000;
      document.querySelectorAll(".word-fx").forEach(n=>n.remove());

      for (let li=0; li<state.lines.length; li++) {
        const line = state.lines[li];
        for (let wi=0; wi<line.words.length; wi++) {
          const w = line.words[wi];
          const m = measureWordBounds(w);

          const spec = getAnimSpec(w);
          const baseColor = w.color;
          const Acommon = { t:tSec, x:w.x, y:w.y, width: state.res.w, height: state.res.h, baseColor, w, m };

          let offX=0, offY=0, scale=1, alpha=1, colorMod=null, highlight=0;

          for (const [type, a] of spec) {
            const def = ANIM.find(d=>d.key===type);
            if (!def || def.charLevel) continue;
            const r = def.apply(ctx, { ...def.defaults, ...a, ...Acommon, textWidth:m.w }) || {};
            offX += r.dx||0; offY += r.dy||0;
            scale *= (r.scale||1); alpha *= (r.alpha||1);
            if (r.colorMod) colorMod = r.colorMod;
            if (r.highlight) highlight = Math.max(highlight, r.highlight);
          }

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(w.x + offX, w.y + offY);
          ctx.scale(scale, scale);
          ctx.font = `${w.size}px ${w.font}`;
          ctx.textBaseline = "alphabetic";
          const drawColor = colorMod || baseColor;
          ctx.fillStyle = drawColor;

          const text = w.text || "";
          const hasCharFX = Array.from(spec.keys()).some(k => (ANIM.find(a=>a.key===k)||{}).charLevel);
          if (!hasCharFX) {
            if (highlight>0){ ctx.save(); ctx.shadowColor = drawColor; ctx.shadowBlur = 10*highlight; ctx.fillText(text, 0, 0); ctx.restore(); }
            ctx.fillText(text, 0, 0);
          } else {
            const c2 = document.createElement("canvas").getContext("2d");
            c2.font = `${w.size}px ${w.font}`;
            let xCursor = 0;
            let visibleGate = text.length;
            if (spec.has("typewriter")) {
              const def = ANIM.find(a=>a.key==="typewriter");
              const r = def.apply(ctx, { ...def.defaults, ...spec.get("typewriter"), ...Acommon, iChar:0, nChars:text.length });
              visibleGate = r.visibleChars ?? text.length;
            }
            for (let ci=0; ci<text.length; ci++) {
              const ch = text[ci];
              const chW = c2.measureText(ch).width;
              if (ci>=visibleGate){ xCursor += chW; continue; }

              let cDx=0, cDy=0, cScale=1, cAlpha=1, cColor=null;
              let glyph = ch;
              for (const [type, a] of spec) {
                const def = ANIM.find(d=>d.key===type);
                if (!def || !def.charLevel) continue;
                const r = def.apply(ctx, { ...def.defaults, ...a, ...Acommon, iChar:ci, nChars:text.length }) || {};
                cDx += r.dx||0; cDy += r.dy||0; cScale *= (r.scale||1); cAlpha *= (r.alpha||1);
                if (r.colorMod) cColor = r.colorMod;
                if (r.scramble) {
                  const pool="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
                  const speed = (a.scrambleSpeed||18);
                  const phase=Math.floor((tSec*speed+ci)%pool.length);
                  const settle=Math.max(0,Math.floor(tSec*speed)-ci);
                  if (settle<2) glyph=pool[phase];
                }
              }
              const chColor = cColor || drawColor;
              ctx.save();
              ctx.globalAlpha = cAlpha;
              ctx.translate(Math.round(xCursor + cDx), Math.round(cDy));
              ctx.scale(cScale, cScale);
              if (highlight>0){ ctx.save(); ctx.shadowColor=chColor; ctx.shadowBlur=10*highlight; ctx.fillStyle=chColor; ctx.fillText(glyph,0,0); ctx.restore(); }
              ctx.fillStyle = chColor;
              ctx.fillText(glyph, 0, 0);
              ctx.restore();

              xCursor += chW;
            }
          }
          ctx.restore();

          if (state.mode==="edit" && state.selection && state.selection.line===li && state.selection.word===wi) {
            addFloatingDelete(w, m, li, wi);
            drawSelectionAndCaret(w, m);
          }
        }
      }
    } catch(e){
      console.error("Render error:", e);
    }
    requestAnimationFrame(render);
  }

  function addFloatingDelete(w, m, li, wi) {
    if (!canvas) return;
    const wrapRect = canvas.getBoundingClientRect();
    const scale = state.zoom;
    const fx = document.createElement("div");
    fx.className = "word-fx";
    fx.textContent = "×";
    const screenX = wrapRect.left + (w.x + m.w + 2) * scale - 9;
    const screenY = wrapRect.top + (w.y - m.h - 10) * scale - 9;
    fx.style.left = Math.round(screenX) + "px";
    fx.style.top  = Math.round(screenY) + "px";
    fx.style.position = "fixed";
    fx.addEventListener("mousedown", (ev)=>{
      ev.stopPropagation();
      pushUndo();
      const L = state.lines[li];
      L.words.splice(wi,1);
      if (!L.words.length) state.lines.splice(li,1);
      state.selection = null;
    });
    document.body.appendChild(fx);
  }

  function drawSelectionAndCaret(w, m) {
    if (!ctx) return;
    const padX=2, padY=1;
    const left = w.x - padX;
    const top = (w.y - m.h) - padY;
    const boxW = m.w + padX*2;
    const boxH = m.h + padY*2;
    ctx.save();
    ctx.shadowColor = "#ff49c1"; ctx.shadowBlur = 2;
    ctx.strokeStyle = "#ff49c1"; ctx.lineWidth = 1; ctx.setLineDash([2,2]);
    ctx.strokeRect(left, top, boxW, boxH);
    ctx.restore();

    const caretIdx = Math.max(0, Math.min((w.caret??(w.text||"").length), (w.text||"").length));
    const c2 = document.createElement("canvas").getContext("2d");
    c2.font = `${w.size}px ${w.font}`;
    const sub = (w.text||"").slice(0, caretIdx);
    const cx = c2.measureText(sub).width;
    const blink = ((performance.now()/500)|0)%2===0;
    if (blink && ctx) { ctx.fillStyle="#fff"; ctx.fillRect(w.x + cx, w.y - m.h, 1, m.h); }
  }

  // ---- Hit test & input
  function hitTest(cx, cy) {
    for (let li=0; li<state.lines.length; li++){
      const L = state.lines[li];
      for (let wi=0; wi<L.words.length; wi++){
        const w = L.words[wi];
        const c = document.createElement("canvas").getContext("2d");
        c.font = `${w.size}px ${w.font}`;
        const tm = c.measureText(w.text||"");
        const m = { w: Math.max(1, (tm.actualBoundingBoxRight - tm.actualBoundingBoxLeft) || tm.width), h: Math.max(1, (tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent) || (w.size*0.8)) };
        const left = w.x - 2, top = w.y - m.h - 1;
        const within = (cx>=left && cx<=left+m.w+4 && cy>=top && cy<=top+m.h+2);
        if (within) return {li, wi, w, m};
      }
    }
    return null;
  }

  function handlePointerDownLike(e){
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = state.zoom;
    const cx = Math.floor((e.clientX - rect.left)/scale);
    const cy = Math.floor((e.clientY - rect.top)/scale);

    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) mobileInput?.focus();

    const hit = hitTest(cx, cy);
    if (hit){
      if (state.mode==="preview") setMode("edit");
      state.selection = { line: hit.li, word: hit.wi };
      const w = hit.w;
      const c = document.createElement("canvas").getContext("2d");
      c.font = `${w.size}px ${w.font}`;
      let caret = 0;
      for (let i=0;i<=(w.text||"").length;i++){
        const sub = (w.text||"").slice(0,i);
        const width = c.measureText(sub).width;
        if (width <= (cx - w.x)) caret = i; else break;
      }
      w.caret = caret;
      refreshInspectorFromSelection();
    } else {
      state.selection = null;
    }
  }

  canvas?.addEventListener("pointerdown", handlePointerDownLike);
  canvas?.addEventListener("click", handlePointerDownLike);
  canvas?.addEventListener("touchstart", (e)=>{ if (e.touches && e.touches[0]) handlePointerDownLike(e.touches[0]); }, {passive:true});

  // Keyboard typing
  window.addEventListener("keydown", (e)=>{
    if (state.mode!=="edit") return;
    const w = selectedWord();
    if (!w) {
      if (e.key==="Backspace") {
        if (state.lines.length) {
          pushUndo();
          const L = state.lines[state.lines.length-1];
          L.words.pop();
          if (!L.words.length) state.lines.pop();
        }
      }
      return;
    }
    const text = w.text || "";
    const caret = Math.max(0, Math.min(w.caret ?? text.length, text.length));

    if (e.key === "Enter") {
      e.preventDefault();
      pushUndo();
      const li = state.selection.line;
      const L = state.lines[li];
      const head = text.slice(0, caret);
      const tailText = text.slice(caret);
      w.text = head;
      const newLine = { words: [{ ...w, text: tailText, manual:false }], align: L.align || "center" };
      state.lines.splice(li+1, 0, newLine);
      state.selection = { line: li+1, word: 0 };
      newLine.words[0].caret = 0;
      autosizeKick();
      refreshInspectorFromSelection();
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      pushUndo();
      const li = state.selection.line;
      const wi = state.selection.word;
      const L = state.lines[li];
      const head = text.slice(0, caret);
      const tailText = text.slice(caret);
      w.text = head;
      const newWord = { ...w, text: tailText, manual:false };
      L.words.splice(wi+1, 0, newWord);
      state.selection.word = wi+1;
      L.words[wi+1].caret = 0;
      autosizeKick();
      refreshInspectorFromSelection();
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      if (text.length===0) {
        pushUndo();
        const li = state.selection.line;
        const wi = state.selection.word;
        const L = state.lines[li];
        L.words.splice(wi,1);
        if (!L.words.length) { state.lines.splice(li,1); state.selection=null; }
        else {
          const prev = Math.max(0, wi-1);
          state.selection.word = prev;
          const pw = L.words[prev];
          pw.caret = (pw.text||"").length;
        }
      } else {
        pushUndo();
        w.text = text.slice(0, caret-1) + text.slice(caret);
        w.caret = Math.max(0, caret-1);
      }
      autosizeKick();
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      pushUndo();
      if (caret < text.length) w.text = text.slice(0, caret) + text.slice(caret+1);
      autosizeKick();
      return;
    }
    if (e.key === "ArrowLeft") { w.caret = Math.max(0, caret-1); return; }
    if (e.key === "ArrowRight"){ w.caret = Math.min(text.length, caret+1); return; }
    if (e.key.length === 1) {
      pushUndo();
      w.text = text.slice(0, caret) + e.key + text.slice(caret);
      w.caret = caret + 1;
      autosizeKick();
      return;
    }
  });

  // ---- Inspector sync
  function refreshInspectorFromSelection() {
    const w = selectedWord();
    if (!w) return;
    inspectorBody?.classList.add("open");
    toggleInspector?.setAttribute("aria-expanded","true");
    if (toggleInspector) toggleInspector.textContent="Inspector ▾";
    if (fontSelect) fontSelect.value = w.font || "monospace";
    if (fontSize) fontSize.value = w.size || 22;
    if (fontColor) fontColor.value = w.color || "#FFFFFF";
    syncAnimationUIFromWord(w);
  }

  // One open accordion at a time
  accs.forEach(d=>{
    d.addEventListener?.("toggle", ()=>{
      if (d.open) accs.forEach(o=>{ if (o!==d) o.removeAttribute("open"); });
      requestAnimationFrame(autoFitZoom);
    });
  });

  // Inspector toggle
  toggleInspector?.addEventListener("click", ()=>{
    const open = !inspectorBody?.classList.contains("open");
    inspectorBody?.classList.toggle("open", open);
    toggleInspector.setAttribute("aria-expanded", String(open));
    toggleInspector.textContent = open ? "Inspector ▾" : "Inspector ▴";
    requestAnimationFrame(autoFitZoom);
  });

  // ---- Mode / zoom / res
  function setMode(m){
    state.mode = m;
    modeEditBtn?.classList.toggle("active", m==="edit");
    modePrevBtn?.classList.toggle("active", m==="preview");
  }
  modeEditBtn?.addEventListener("click", ()=> setMode("edit"));
  modePrevBtn?.addEventListener("click", ()=> setMode("preview"));
  zoomRange?.addEventListener("input", ()=>{ state.zoom = parseFloat(zoomRange.value||"1"); applyZoom(); });
  fitBtn?.addEventListener("click", autoFitZoom);

  resSelect?.addEventListener("change", ()=>{
    const val=resSelect.value;
    state.res = (val==="96x128")? {w:96,h:128} : {w:64,h:64};
    setCanvasResolution();
    buildBgThumbs();
    autoFitZoom();
  });

  // ---- Undo/Redo/Clear
  undoBtn?.addEventListener("click", ()=>{
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
    state.lines=obj.lines; state.background=obj.background; state.spacing=obj.spacing;
    state.vAlign=obj.vAlign||"middle"; state.customSwatches = Array.isArray(obj.customSwatches)? obj.customSwatches: [];
    buildColorSwatches(); buildBgSwatches(); autosizeKick();
  });
  redoBtn?.addEventListener("click", ()=>{
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
    state.lines=obj.lines; state.background=obj.background; state.spacing=obj.spacing;
    state.vAlign=obj.vAlign||"middle"; state.customSwatches = Array.isArray(obj.customSwatches)? obj.customSwatches: [];
    buildColorSwatches(); buildBgSwatches(); autosizeKick();
  });

  clearAllBtn?.addEventListener("click", ()=>{
    if (!sessionStorage.getItem("LED_clearSuppressed")) { clearWarn?.classList.remove("hidden"); return; }
    doClearAll();
  });
  clearCancel?.addEventListener("click", ()=> clearWarn?.classList.add("hidden"));
  clearConfirm?.addEventListener("click", ()=>{
    if (suppressClearWarn?.checked) sessionStorage.setItem("LED_clearSuppressed","1");
    clearWarn?.classList.add("hidden");
    doClearAll();
  });
  function doClearAll(){ pushUndo(); state.lines=[]; state.selection=null; autosizeKick(); }

  // ---- About
  aboutBtn?.addEventListener("click", ()=> aboutModal?.classList.remove("hidden"));
  aboutClose?.addEventListener("click", ()=> aboutModal?.classList.add("hidden"));
  $("#aboutModal")?.addEventListener("click",(e)=>{ if(e.target===e.currentTarget || e.target.classList.contains("modal-backdrop")) aboutModal?.classList.add("hidden"); });
  $("#clearWarn")?.addEventListener("click",(e)=>{ if(e.target===e.currentTarget || e.target.classList.contains("modal-backdrop")) clearWarn?.classList.add("hidden"); });

  // ---- Swatches (font + background share custom list; black protected)
  function buildColorSwatches() {
    const wrap = $("#swatches"); if (!wrap) return;
    wrap.innerHTML="";
    const all = PRESET_COLORS.concat(state.customSwatches||[]);
    all.slice(0,48).forEach(col=>{
      const sw = document.createElement("div"); sw.className="swatch-wrap";
      const btn = document.createElement("button"); btn.className="swatch"; btn.style.background=col; btn.title=col;
      btn.addEventListener("click", ()=>{ const w=selectedWord(); if(!w)return; pushUndo(); w.color=col; if(fontColor) fontColor.value=col; });
      sw.appendChild(btn);
      if (state.customSwatches.includes(col) && col!=="#000000") {
        const x = document.createElement("span"); x.className="x"; x.textContent="×";
        x.addEventListener("click",(ev)=>{ ev.stopPropagation(); const i=state.customSwatches.indexOf(col); if(i>=0){ state.customSwatches.splice(i,1); buildColorSwatches(); buildBgSwatches(); }});
        sw.appendChild(x);
      }
      wrap.appendChild(sw);
    });
  }
  $("#addSwatchBtn")?.addEventListener("click", ()=>{
    const col = fontColor?.value || "#FFFFFF";
    if (!state.customSwatches.includes(col)) {
      state.customSwatches.push(col);
      if (state.customSwatches.length>48) state.customSwatches.shift();
      buildColorSwatches(); buildBgSwatches();
    }
  });
  $("#clearSwatchesBtn")?.addEventListener("click", ()=>{
    state.customSwatches = ["#000000"];
    buildColorSwatches(); buildBgSwatches();
  });

  function buildBgSwatches(){
    if (!bgSwatches) return;
    bgSwatches.innerHTML = "";
    const all = PRESET_COLORS.concat(state.customSwatches||[]);
    all.slice(0,48).forEach(col=>{
      const wrap = document.createElement("div"); wrap.className="swatch-wrap";
      const b = document.createElement("button"); b.className="swatch"; b.style.background=col; b.title=col;
      b.addEventListener("click", ()=>{ state.background = { type:"solid", color:col, image:null, name:"solid" }; if(bgSolidColor) bgSolidColor.value=col; });
      wrap.appendChild(b);
      if (state.customSwatches.includes(col) && col!=="#000000") {
        const x=document.createElement("span"); x.className="x"; x.textContent="×";
        x.addEventListener("click",(ev)=>{ ev.stopPropagation(); const i=state.customSwatches.indexOf(col); if(i>=0){ state.customSwatches.splice(i,1); buildColorSwatches(); buildBgSwatches(); }});
        wrap.appendChild(x);
      }
      bgSwatches.appendChild(wrap);
    });
  }
  addBgSwatchBtn?.addEventListener("click", ()=>{
    const col = bgSolidColor?.value || "#000000";
    if (!state.customSwatches.includes(col)) {
      state.customSwatches.push(col);
      if (state.customSwatches.length>48) state.customSwatches.shift();
      buildBgSwatches(); buildColorSwatches();
    }
  });
  bgSolidBtn?.addEventListener("click", ()=>{
    state.background = { type:"solid", color: bgSolidColor?.value || "#000000", image:null, name:"solid" };
  });
  bgUpload?.addEventListener("change", async (e)=>{
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    try{
      const img = await loadImage(url);
      pushUndo();
      state.background = { type:"image", color:"#000000", image:img, name:file.name };
    } finally {
      setTimeout(()=>URL.revokeObjectURL(url), 2500);
    }
  });

  // Background preset thumbs
  function buildBgThumbs(){
    if (!bgThumbs) return;
    const key = `${state.res.w}x${state.res.h}`;
    const list = state.bgImages[key] || [];
    bgThumbs.innerHTML = "";
    list.forEach(item=>{
      const div=document.createElement("div"); div.className="thumb"; div.title=item.key;
      const img=document.createElement("img"); img.src=item.thumb; img.alt=item.key+" thumb";
      img.onerror = ()=>{ img.style.opacity='0.4'; img.alt=item.key+" (thumb missing)"; };
      div.appendChild(img);
      div.addEventListener("click", async ()=>{
        try{
          const el=await loadImage(item.preset);
          pushUndo();
          state.background={ type:"image", color:"#000000", image:el, name:item.key };
        }catch(e){ alert("Could not load preset image:\n"+item.preset+"\nCheck filename/path and case."); }
      });
      bgThumbs.appendChild(div);
    });
  }
  function loadImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }

  // Word/Line add
  addWordBtn?.addEventListener("click", ()=>{
    pushUndo();
    const li = state.selection?.line ?? 0;
    const L = state.lines[li] || (state.lines[0]={words:[],align:"center"});
    const base = { text:"WORD", color:"#FFFFFF", font: (fontSelect?.value || "Orbitron"), size: parseInt(fontSize?.value||"22",10), align:L.align||"center", x:0,y:0, manual:false, caret:4, animations:[] };
    if (!state.lines[li]) state.lines.push({words:[base], align:"center"});
    else L.words.push(base);
    state.selection = { line: li, word: (state.lines[li] ? (state.lines[li].words.length-1) : 0) };
    autosizeKick(); refreshInspectorFromSelection();
  });
  addLineBtn?.addEventListener("click", ()=>{
    pushUndo();
    const baseW = { text:"NEW", color:"#FFFFFF", font:(fontSelect?.value || "Orbitron"), size: parseInt(fontSize?.value||"22",10), align:"center", x:0,y:0, manual:false, caret:3, animations:[] };
    state.lines.push({ words:[baseW], align:"center" });
    state.selection = { line: state.lines.length-1, word:0 };
    autosizeKick(); refreshInspectorFromSelection();
  });

  // Spacing + alignment combined
  alignBtns.forEach(btn=>btn.addEventListener("click", (e)=>{
    const align = e.currentTarget.getAttribute("data-align");
    pushUndo();
    const applyAll = applyAllAlign?.checked;
    if (applyAll) state.lines.forEach(L=> L.align = align);
    else { const L = state.lines[state.selection?.line||0]; if (L) L.align = align; }
    alignBtns.forEach(b=>b.classList.toggle("active", b.getAttribute("data-align")===align));
    autosizeKick();
  }));
  vAlignBtns.forEach(btn=>btn.addEventListener("click", (e)=>{
    const v = e.currentTarget.getAttribute("data-valign");
    pushUndo();
    state.vAlign = v;
    vAlignBtns.forEach(b=>b.classList.toggle("active", b.getAttribute("data-valign")===v));
    autosizeKick();
  }));
  lineGap?.addEventListener("change", ()=>{ pushUndo(); state.spacing.lineGap = parseInt(lineGap.value||"4",10); autosizeKick(); });
  wordGap?.addEventListener("change", ()=>{ pushUndo(); state.spacing.word    = parseInt(wordGap.value||"6",10); autosizeKick(); });

  // Font controls
  fontSelect?.addEventListener("change", ()=>{ const w=getActive(); if(!w)return; pushUndo(); w.font=fontSelect.value; autosizeKick(); });
  fontSize?.addEventListener("change", ()=>{ const w=getActive(); if(!w)return; pushUndo(); w.size=parseInt(fontSize.value||"22",10); autosizeKick(); });
  autoSize?.addEventListener("change", ()=>{ state.autoSize = !!autoSize.checked; autosizeKick(); });
  fontColor?.addEventListener("input", ()=>{ const w=getActive(); if(!w)return; pushUndo(); w.color=fontColor.value; });

  // Save/Load config
  saveJsonBtn?.addEventListener("click", ()=>{
    const payload = { lines: state.lines, background: { ...state.background, image: undefined }, spacing: state.spacing, vAlign: state.vAlign, customSwatches: state.customSwatches };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="led_animator_config.json"; a.click();
    URL.revokeObjectURL(url);
  });
  loadJsonInput?.addEventListener("change", async (e)=>{
    const file=e.target.files[0]; if(!file) return;
    try {
      const text=await file.text(); const obj=JSON.parse(text); loadFromJSON(obj);
    } catch { alert("Invalid JSON."); }
  });
  function loadFromJSON(obj){
    pushUndo();
    state.lines = obj.lines || state.lines;
    state.background = { ...(obj.background||state.background), image:null };
    state.spacing = obj.spacing || state.spacing;
    state.vAlign = obj.vAlign || "middle";
    state.customSwatches = Array.isArray(obj.customSwatches)? obj.customSwatches.slice(0,48) : ["#000000"];
    state.selection = { line:0, word:0 };
    buildColorSwatches(); buildBgSwatches(); autosizeKick(); refreshInspectorFromSelection();
  }

  // GIF render (same as 3.0)
  renderGifBtn?.addEventListener("click", async ()=>{
    const fps = clamp(parseInt(fpsInput?.value||"15",10),1,30);
    const seconds = clamp(parseInt(secInput?.value||"8",10),1,20);
    const frames = fps*seconds;
    const desiredName = (fileNameInput?.value || "animation.gif").trim() || "animation.gif";
    downloadLink?.setAttribute("download", desiredName);

    if (!canvas) return;

    const off = document.createElement("canvas");
    off.width=canvas.width; off.height=canvas.height;
    const octx = off.getContext("2d");

    function colorTable(p){ const u=new Uint8Array(p.length*3); for(let i=0;i<p.length;i++){ const c=p[i]; u[i*3]=c[0];u[i*3+1]=c[1];u[i*3+2]=c[2]; } return u; }
    function nearestIndex(p, r,g,b){ let best=0,bd=1e9; for(let i=0;i<p.length;i++){ const pr=p[i][0],pg=p[i][1],pb=p[i][2]; const d=(r-pr)*(r-pr)+(g-pg)*(g-pg)+(b-pb)*(b-pb); if(d<bd){bd=d;best=i;} } return best; }
    function buildPalette(imgData){ const set=new Map(); const d=imgData.data; for(let i=0;i<d.length;i+=4){ const a=d[i+3]; if(a<10) continue; const key=(d[i]<<16)|(d[i+1]<<8)|(d[i+2]); set.set(key,true); if(set.size>=256) break; } const arr=Array.from(set.keys()).map(k=>[(k>>16)&255,(k>>8)&255,k&255]); if(arr.length===0) arr.push([0,0,0]); while(arr.length&(arr.length-1)) arr.push(arr[arr.length-1]); if(arr.length>256) arr.length=256; return arr; }
    function lzwEncode(indices, minCodeSize){ const CLEAR=1<<minCodeSize, END=CLEAR+1; let dict=new Map(); let codeSize=minCodeSize+1; let next=END+1; const out=[]; let cur=0,curBits=0; function write(code){ cur |= code<<curBits; curBits += codeSize; while(curBits>=8){ out.push(cur&255); cur>>=8; curBits-=8; } } function reset(){ dict=new Map(); codeSize=minCodeSize+1; next=END+1; write(CLEAR);} reset(); let w=indices[0]; for(let i=1;i<indices.length;i++){ const k=indices[i]; const wk=(w<<8)|k; if(dict.has(wk)){ w=dict.get(wk);} else { write(w); dict.set(wk,next++); if(next===(1<<codeSize) && codeSize<12) codeSize++; w=k; } } write(w); write(END); if(curBits>0) out.push(cur&255); return new Uint8Array(out); }

    octx.drawImage(canvas,0,0);
    const firstData = octx.getImageData(0,0,off.width,off.height);
    const palette = buildPalette(firstData);
    const gct = colorTable(palette);
    const gctSizePower = Math.ceil(Math.log2(Math.max(2, palette.length)));

    const parts = [];
    function write(u8){ parts.push(u8); }
    function concat(){ let len=parts.reduce((s,a)=>s+a.length,0); let out=new Uint8Array(len); let offi=0; for(const a of parts){ out.set(a,offi); offi+=a.length; } return out; }

    write(new Uint8Array([71,73,70,56,57,97]));
    write(new Uint8Array([off.width&255,(off.width>>8)&255, off.height&255,(off.height>>8)&255]));
    write(new Uint8Array([0x80 | (gctSizePower-1), 0, 0])); write(gct);

    const delayCs = Math.round(100/Math.max(1, fps));

    for (let f=0; f<frames; f++){
      octx.clearRect(0,0,off.width,off.height);
      if (state.background.type==="image" && state.background.image) octx.drawImage(state.background.image, 0,0,off.width,off.height);
      else { octx.fillStyle = state.background.color || "#000"; octx.fillRect(0,0,off.width,off.height); }

      layoutContent();
      const tSec = f/Math.max(1,fps);
      for (const line of state.lines) {
        for (const w of line.words) {
          const m = measureWordBounds(w);
          const spec = getAnimSpec(w);
          let offX=0, offY=0, scale=1, alpha=1, colorMod=null, highlight=0;
          const Acommon = { t:tSec, x:w.x, y:w.y, width:off.width, height:off.height, baseColor:w.color, w, m, textWidth:m.w };
          for (const [type,a] of spec) {
            const def=ANIM.find(d=>d.key===type); if(!def || def.charLevel) continue;
            const r=def.apply(octx, { ...def.defaults, ...a, ...Acommon })||{};
            offX += r.dx||0; offY += r.dy||0; scale *= (r.scale||1); alpha *= (r.alpha||1); if(r.colorMod) colorMod=r.colorMod; if(r.highlight) highlight=Math.max(highlight,r.highlight);
          }

          octx.save();
          octx.globalAlpha = alpha;
          octx.translate(w.x+offX, w.y+offY);
          octx.scale(scale, scale);
          octx.font = `${w.size}px ${w.font}`;
          octx.textBaseline="alphabetic";
          const drawColor = colorMod || w.color;
          octx.fillStyle = drawColor;

          const text = w.text||"";
          const hasCharFX = Array.from(spec.keys()).some(k => (ANIM.find(a=>a.key===k)||{}).charLevel);
          if (!hasCharFX){
            if (highlight>0){ octx.save(); octx.shadowColor=drawColor; octx.shadowBlur=10*highlight; octx.fillText(text,0,0); octx.restore(); }
            octx.fillText(text,0,0);
          } else {
            const c2 = document.createElement("canvas").getContext("2d");
            c2.font = `${w.size}px ${w.font}`;
            let xCursor=0;
            let visibleGate=text.length;
            if (spec.has("typewriter")){
              const def=ANIM.find(a=>a.key==="typewriter");
              const r=def.apply(octx,{...def.defaults,...spec.get("typewriter"),...Acommon,iChar:0,nChars:text.length});
              visibleGate = r.visibleChars ?? text.length;
            }
            for (let ci=0; ci<text.length; ci++){
              const ch=text[ci]; const chW=c2.measureText(ch).width;
              if (ci>=visibleGate){ xCursor+=chW; continue; }
              let cDx=0,cDy=0,cScale=1,cAlpha=1,cColor=null; let glyph=ch;
              for (const [type,a] of spec){ const def=ANIM.find(d=>d.key===type); if(!def||!def.charLevel) continue; const r=def.apply(octx,{...def.defaults,...a,...Acommon,iChar:ci,nChars:text.length})||{}; cDx+=r.dx||0;cDy+=r.dy||0;cScale*=r.scale||1;cAlpha*=r.alpha||1;if(r.colorMod)cColor=r.colorMod; if(r.scramble){ const pool="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"; const speed=(a.scrambleSpeed||18); const phase=Math.floor((tSec*speed+ci)%pool.length); const settle=Math.max(0,Math.floor(tSec*speed)-ci); if(settle<2) glyph=pool[phase]; } }
              const chColor=cColor||drawColor;
              octx.save(); octx.globalAlpha=cAlpha; octx.translate(Math.round(xCursor+cDx),Math.round(cDy)); octx.scale(cScale,cScale);
              if (highlight>0){ octx.save(); octx.shadowColor=chColor; octx.shadowBlur=10*highlight; octx.fillStyle=chColor; octx.fillText(glyph,0,0); octx.restore(); }
              octx.fillStyle=chColor; octx.fillText(glyph,0,0); octx.restore();
              xCursor+=chW;
            }
          }
          octx.restore();
        }
      }

      const imgData=octx.getImageData(0,0,off.width,off.height);
      const indices=new Uint8Array(off.width*off.height);
      let p=0; for(let i=0;i<imgData.data.length;i+=4){ const idx=nearestIndex(palette,imgData.data[i],imgData.data[i+1],imgData.data[i+2]); indices[p++]=idx; }

      write(new Uint8Array([0x21,0xF9,0x04,0x04, delayCs & 255, (delayCs>>8)&255, 0, 0]));
      write(new Uint8Array([0x2C,0,0,0,0, off.width&255,(off.width>>8)&255, off.height&255,(off.height>>8)&255, 0]));
      const lzwMin = Math.max(2, gctSizePower);
      write(new Uint8Array([lzwMin]));
      const lzw = lzwEncode(indices, lzwMin);
      let si=0; while(si<lzw.length){ const n=Math.min(255, lzw.length-si); write(new Uint8Array([n])); write(lzw.slice(si,si+n)); si+=n; }
      write(new Uint8Array([0]));
    }

    write(new Uint8Array([0x3B]));
    const u8 = concat();
    const blob = new Blob([u8], {type:"image/gif"});
    const url = URL.createObjectURL(blob);
    if (downloadLink) downloadLink.href = url;
  });

  // ---- Animations UI
  function ensureAnimUI() {
    if (!animContainer) return;
    if (!animList) {
      animList = document.createElement("div");
      animList.id = "animList";
      animContainer.innerHTML = "";
      const topBar = document.createElement("div");
      topBar.style.display="flex"; topBar.style.justifyContent="space-between"; topBar.style.alignItems="center"; topBar.style.width="100%";
      animHelpBtn = document.createElement("button"); animHelpBtn.id="animHelpBtn"; animHelpBtn.className="button tiny"; animHelpBtn.textContent="Help";
      topBar.appendChild(animHelpBtn);
      animContainer.appendChild(topBar);
      animContainer.appendChild(animList);
    }
    animList.innerHTML = "";

    const groups = [...new Set(ANIM.map(a=>a.group))];
    groups.forEach(g=>{
      const gEl = document.createElement("div");
      const gTitle = document.createElement("div");
      gTitle.textContent = g;
      gTitle.style.opacity="0.8";
      gTitle.style.margin="8px 0 4px";
      gTitle.style.fontSize="12px";
      gEl.appendChild(gTitle);

      ANIM.filter(a=>a.group===g).forEach(def=>{
        const row = document.createElement("div");
        row.style.display="flex"; row.style.flexDirection="column"; row.style.gap="6px"; row.style.border="1px solid #2a2c31"; row.style.borderRadius="8px"; row.style.padding="8px";

        const head = document.createElement("div");
        head.style.display="flex"; head.style.alignItems="center"; head.style.justifyContent="space-between"; head.style.gap="8px";

        const left = document.createElement("label"); left.className="chk";
        const cb = document.createElement("input"); cb.type="checkbox"; cb.dataset.anim=def.key;
        const name = document.createElement("span"); name.textContent = def.label;
        left.appendChild(cb); left.appendChild(name);

        const gear = document.createElement("button"); gear.className="button tiny"; gear.textContent="⚙️";
        head.appendChild(left); head.appendChild(gear);

        const body = document.createElement("div");
        body.style.display="none";
        body.style.gap="6px"; body.style.flexWrap="wrap";
        body.style.marginTop="6px";

        Object.entries(def.defaults||{}).forEach(([k,v])=>{
          const wrap = document.createElement("div");
          wrap.style.display="grid"; wrap.style.gridTemplateColumns="auto 1fr"; wrap.style.gap="6px"; wrap.style.alignItems="center";
          const lab = document.createElement("label"); lab.textContent = k[0].toUpperCase()+k.slice(1);
          const input = document.createElement(typeof v==="number" ? "input" : "select");
          input.dataset.animKey = def.key;
          input.dataset.param = k;
          if (typeof v==="number"){ input.type="number"; input.step="0.1"; input.value=String(v); }
          else if (typeof v==="string"){
            const opts = (k==="dir")? ["left","right","up","down"] : [v];
            opts.forEach(o=>{ const op=document.createElement("option"); op.value=o; op.textContent=o; input.appendChild(op); });
          }
          wrap.appendChild(lab); wrap.appendChild(input);
          body.appendChild(wrap);
        });

        gear.addEventListener("click", ()=>{ body.style.display = (body.style.display==="none"?"flex":"none"); });
        cb.addEventListener("change", ()=>{
          const w = selectedWord(); if(!w) return;
          pushUndo();
          const map = getAnimSpec(w);
          if (cb.checked) map.set(def.key, { type:def.key, ...def.defaults });
          else map.delete(def.key);
          setAnimSpec(w, map);
        });
        body.addEventListener("change", (e)=>{
          const target = e.target;
          if (!target?.dataset?.animKey) return;
          const w = selectedWord(); if(!w) return;
          pushUndo();
          const map = getAnimSpec(w);
          const entry = map.get(target.dataset.animKey) || { type: target.dataset.animKey, ...(ANIM.find(a=>a.key===target.dataset.animKey)?.defaults||{}) };
          const key = target.dataset.param;
          let val = target.value;
          if (target.type==="number") val = parseFloat(val);
          entry[key] = val;
          map.set(target.dataset.animKey, entry);
          setAnimSpec(w, map);
        });

        row.appendChild(head); row.appendChild(body);
        gEl.appendChild(row);
      });

      animList.appendChild(gEl);
    });

    animHelpBtn?.addEventListener("click", ()=>{
      if (sessionStorage.getItem("LED_animHelpSuppressed")==="1") return;
      showAnimHelp();
    });
  }

  function showAnimHelp(){
    const modal = document.createElement("div");
    modal.className="modal";
    const backdrop = document.createElement("div"); backdrop.className="modal-backdrop";
    const card = document.createElement("div"); card.className="modal-card";
    const h3 = document.createElement("h3"); h3.textContent="Animations Help";
    const p = document.createElement("div"); p.style.maxHeight="60vh"; p.style.overflow="auto"; p.style.fontSize="13px";
    const ul = document.createElement("ul");
    Object.keys(ANIM_HELP).forEach(k=>{
      const li=document.createElement("li"); li.style.marginBottom="6px";
      li.innerHTML = `<strong>${(ANIM.find(a=>a.key===k)||{}).label||k}</strong>: ${ANIM_HELP[k]}`;
      ul.appendChild(li);
    });
    p.appendChild(ul);

    const chkWrap = document.createElement("label"); chkWrap.className="chk"; chkWrap.style.marginTop="8px";
    const chk = document.createElement("input"); chk.type="checkbox"; chk.id="animHelpDnsa";
    const txt = document.createElement("span"); txt.textContent="Don’t show again (this session)";
    chkWrap.appendChild(chk); chkWrap.appendChild(txt);

    const actions = document.createElement("div"); actions.className="modal-actions";
    const closeBtn = document.createElement("button"); closeBtn.className="primary"; closeBtn.textContent="Close";

    closeBtn.addEventListener("click", ()=>{ if (chk.checked) sessionStorage.setItem("LED_animHelpSuppressed","1"); document.body.removeChild(modal); });
    backdrop.addEventListener("click", ()=>{ document.body.removeChild(modal); });

    actions.appendChild(closeBtn);
    card.appendChild(h3); card.appendChild(p); card.appendChild(chkWrap); card.appendChild(actions);
    modal.appendChild(backdrop); modal.appendChild(card);
    document.body.appendChild(modal);
  }

  function syncAnimationUIFromWord(w){
    ensureAnimUI();
    if (!animList) return;
    const map = getAnimSpec(w);
    animList.querySelectorAll('input[type="checkbox"][data-anim]').forEach(cb=>{
      cb.checked = map.has(cb.dataset.anim);
      const def = ANIM.find(a=>a.key===cb.dataset.anim);
      if (!def) return;
      const cfg = map.get(cb.dataset.anim) || def.defaults;
      animList.querySelectorAll(`[data-anim-key="${cb.dataset.anim}"]`).forEach(inp=>{
        const k = inp.dataset.param;
        if (k in cfg) {
          if (inp.tagName==="SELECT") inp.value = String(cfg[k]);
          else inp.value = String(cfg[k]);
        }
      });
    });
  }

  // ---- Init
  function init(){
    const toolsToggle = $("#toolsToggle");
    const toolsDrawer = $("#toolsDrawer");
    toolsToggle?.addEventListener("click", ()=>{
      toolsDrawer?.classList.toggle("hidden");
      toolsToggle.textContent = toolsDrawer?.classList.contains("hidden") ? "Tools ▾" : "Tools ▴";
      requestAnimationFrame(autoFitZoom);
    });

    if (!canvas || !ctx) {
      console.error("Canvas or context missing; check index.html IDs.");
      return;
    }

    setCanvasResolution();
    buildBgThumbs();
    buildColorSwatches();
    buildBgSwatches();
    ensureAnimUI();
    setMode("edit");
    requestAnimationFrame(render);
    autoFitZoom();
    window.addEventListener("resize", autoFitZoom);
  }

  init();
})();