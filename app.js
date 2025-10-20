/* LED Backpack Animator v2.6+ (ALL EFFECTS WIRED)
 * Keeps asset structure unchanged (repo/assets/thumbs/*_thumb.png; full image name without _thumb)
 * Live preview + true animated GIF export (FPS × Length)
 * Effects:
 *  - Scroll/Marquee (L/R/U/D + speed)
 *  - Typewriter (rate)
 *  - Pulse/Breathe (scale, vy)
 *  - Wave (ax, ay, cycles)
 *  - Jitter (amp, freq)
 *  - Shake (amp, freq)
 *  - Zoom In/Out (dir, speed)
 *  - Fade Out (auto tail fade)
 *  - Slide In (dir, speed)
 *  - Slide Away (dir, speed)
 *  - Color Cycle (speed)
 *  - Flicker (strength)
 *  - Glow Pulse (intensity)
 *  - Rainbow Sweep (speed)
 *  - Highlight Sweep (speed, width)
 *  - Strobe (rate)
 *  - Heartbeat (rate)
 *  - Ripple (amp, freq) — per-character vertical wave
 *  - Scramble/Decode (rate) — per-character resolve
 *  - Popcorn (rate) — random per-character blink
 */

const $ = (q, el=document)=>el.querySelector(q);
const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));

const canvas = $("#led");
const ctx = canvas.getContext("2d");
const wrap = $(".canvas-wrap");

const modeEditBtn = $("#modeEdit");
const modePrevBtn = $("#modePreview");
const zoomSlider = $("#zoom");
const fitBtn = $("#fitBtn");

const resSel = $("#resSelect");
const addWordBtn = $("#addWordBtn");
const addLineBtn = $("#addLineBtn");
const deleteWordFx = $("#deleteWordBtn");

const undoBtn = $("#undoBtn");
const redoBtn = $("#redoBtn");
const clearBtn = $("#clearAllBtn");
const clearWarn = $("#clearWarn");
const clearCancel = $("#clearCancel");
const clearConfirm = $("#clearConfirm");
const suppressClearWarn = $("#suppressClearWarn");

const mobileInput = $("#mobileInput");

const inspectorToggle = $("#toggleInspector");
const inspectorBody = $("#inspectorBody");
const toolbarTabs = $$(".toolbar .tab");
const accs = [$("#accFont"), $("#accLayout"), $("#accAnim")];

// Font/spacing
const fontSel = $("#fontSelect");
const fontSizeInput = $("#fontSize");
const autoSizeChk = $("#autoSize");
const fontColorInput = $("#fontColor");
const lineGapInput = $("#lineGap");
const wordGapInput = $("#wordGap");
const alignBtns = $$("[data-align]");
const valignBtns = $$("[data-valign]");
const applyAllAlign = $("#applyAllAlign");
const manualDragChk = $("#manualDragChk");

// Swatches
const swatchesWrap = $("#swatches");
const addSwatchBtn = $("#addSwatchBtn");
const clearSwatchesBtn = $("#clearSwatchesBtn");

// Backgrounds
const bgThumbs = $("#bgThumbs");
const bgSolidBtn = $("#bgSolidBtn");
const bgSolidColor = $("#bgSolidColor");
const bgUpload = $("#bgUpload");
const bgSwatches = $("#bgSwatches");
const addBgSwatchBtn = $("#addBgSwatchBtn");

// Config/Render
const saveJsonBtn = $("#saveJsonBtn");
const loadJsonInput = $("#loadJsonInput");
const fpsInput = $("#fps");
const secInput = $("#seconds");
const fileNameInput = $("#fileName");
const downloadGifBtn = $("#downloadGifBtn");

// Animations UI
const animList = $("#animList");
const animHelpBtn = $("#animHelpBtn");

// ------- State -------
let mode = "edit";
let zoom = parseFloat(zoomSlider.value || "0.8");
let history = [];
let future = [];
const MAX_STACK = 100;

const defaults = {
  fontFamily: "Orbitron",
  fontSize: 22,
  color: "#FFFFFF",
  lineGap: 4,
  wordGap: 6,
  align: "center",
  valign: "middle",
  bgColor: "#000000",
};

const defaultPalette = ["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customPalette = [];
let customBgPalette = [];

let doc = {
  res: { w: 96, h: 128 },
  lines: [{ words: [{ text: "HELLO", style: {} }], offsetY: 0 }],
  style: { ...defaults },
  bg: { type: "solid", color: "#000000", image: null, preset: null },
  animations: [], // {id, params}
};

let selected = { line: 0, word: 0, caret: null };
let showClearWarn = true;

// ------- History -------
function pushHistory() {
  history.push(JSON.stringify(doc));
  if (history.length > MAX_STACK) history.shift();
  future.length = 0;
}
function undo() {
  if (!history.length) return;
  future.push(JSON.stringify(doc));
  const prev = history.pop();
  doc = JSON.parse(prev);
  render(0, null);
}
function redo() {
  if (!future.length) return;
  history.push(JSON.stringify(doc));
  const next = future.pop();
  doc = JSON.parse(next);
  render(0, null);
}

// ------- Zoom + Mode -------
function setMode(m) {
  mode = m;
  modeEditBtn.classList.toggle("active", m==="edit");
  modePrevBtn.classList.toggle("active", m==="preview");
}
function setZoom(z) {
  zoom = z;
  zoomSlider.value = String(z.toFixed(2));
  canvas.style.transform = `translate(-50%, -50%) scale(${zoom})`;
}
function fitZoom() {
  const pad = 12;
  const w = Math.max(50, wrap.clientWidth - pad*2);
  const h = Math.max(50, wrap.clientHeight - pad*2);
  const sx = w / doc.res.w;
  const sy = h / doc.res.h;
  const s = Math.max(0.1, Math.min(sx, sy));
  setZoom(s);
}

// ------- Styles + Layout -------
function resolveStyle(overrides={}) {
  return {
    fontFamily: overrides.fontFamily || doc.style.fontFamily || defaults.fontFamily,
    fontSize: overrides.fontSize || doc.style.fontSize || defaults.fontSize,
    color: overrides.color || doc.style.color || defaults.color,
  };
}
function layoutDocument() {
  const positions = [];
  const fs = doc.style.fontSize || defaults.fontSize;
  const lineStep = fs + (doc.style.lineGap ?? defaults.lineGap);
  const totalH = doc.lines.length * lineStep;
  let startY = 0;
  if (doc.style.valign === "top") startY = fs + 6;
  else if (doc.style.valign === "middle") startY = (doc.res.h - totalH)/2 + fs;
  else startY = doc.res.h - totalH + fs - 6;

  doc.lines.forEach((line, li) => {
    const wordsW = line.words.map(w => {
      const st = resolveStyle(w.style);
      ctx.font = `${st.fontSize}px ${st.fontFamily}`;
      return Math.ceil(ctx.measureText(w.text||"").width);
    });
    const gaps = Math.max(0, line.words.length - 1) * (doc.style.wordGap ?? defaults.wordGap);
    const lineWidth = wordsW.reduce((a,b)=>a+b,0) + gaps;

    let startX = 0;
    if (doc.style.align === "left") startX = 4;
    else if (doc.style.align === "center") startX = (doc.res.w - lineWidth)/2;
    else startX = doc.res.w - lineWidth - 4;

    let x = startX;
    const y = startY + li * lineStep;
    line.words.forEach((w, wi) => {
      positions.push({ line: li, word: wi, x, y });
      x += wordsW[wi] + (doc.style.wordGap ?? defaults.wordGap);
    });
  });
  return { positions };
}
function measureWordBBox(li, wi) {
  const line = doc.lines[li]; if (!line) return null;
  const word = line.words[wi]; if (!word) return null;
  const st = resolveStyle(word.style);
  ctx.font = `${st.fontSize}px ${st.fontFamily}`;
  const text = word.text || "";
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width);
  const h = Math.ceil(st.fontSize * 1.15);
  const layout = layoutDocument();
  const item = layout.positions.find(p => p.line===li && p.word===wi);
  if (!item) return null;
  return { x: item.x, y: item.y - h, w, h };
}
function ensureSelectionDeleteBtn() {
  const box = selected ? measureWordBBox(selected.line, selected.word) : null;
  if (!box) { deleteWordFx.classList.add("hidden"); return; }
  const rect = canvas.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const cx = rect.left + (box.x + box.w) * zoom + 4;
  const cy = rect.top + (box.y) * zoom - 10;
  deleteWordFx.style.left = `${cx - wrapRect.left}px`;
  deleteWordFx.style.top  = `${cy - wrapRect.top}px`;
  deleteWordFx.classList.remove("hidden");
}

// Autosize the line so no words clip horizontally
function autosizeForLine(li) {
  if (!autoSizeChk.checked) return;
  const minSize = 6;
  let fs = doc.style.fontSize || defaults.fontSize;
  for (let tries=0; tries<40; tries++) {
    const layout = layoutDocument();
    let overflow = false;
    layout.positions
      .filter(p=>p.line===li)
      .forEach(p => {
        const w = doc.lines[p.line].words[p.word];
        const st = resolveStyle(w.style);
        ctx.font = `${st.fontSize}px ${st.fontFamily}`;
        const ww = Math.ceil(ctx.measureText(w.text||"").width);
        if (p.x + ww > doc.res.w - 2) overflow = true;
      });
    if (!overflow || fs<=minSize) break;
    fs = Math.max(minSize, fs - 1);
    doc.style.fontSize = fs;
  }
}

// ------- Background -------
function renderBg() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (doc.bg.type === "solid") {
    ctx.fillStyle = doc.bg.color || "#000";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if (doc.bg.type === "image" && doc.bg.image) {
    try { ctx.drawImage(doc.bg.image, 0, 0, canvas.width, canvas.height); } catch(e){}
  }
}
const presetThumbs = [
  "repo/assets/thumbs/Preset_A_thumb.png",
  "repo/assets/thumbs/Preset_B_thumb.png",
  "repo/assets/thumbs/Preset_C_thumb.png",
  "repo/assets/thumbs/Preset_D_thumb.png"
];
function initBackgroundPresets(){
  bgThumbs.innerHTML = "";
  presetThumbs.forEach((src, idx) => {
    const div = document.createElement("div");
    div.className = "thumb";
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Preset ${idx+1}`;
    div.appendChild(img);
    div.addEventListener("click", async ()=>{
      const full = src.replace("_thumb","");
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = full;
      await im.decode().catch(()=>{});
      doc.bg = { type: "image", color: null, image: im, preset: src };
      pushHistory(); render(0, null);
    });
    bgThumbs.appendChild(div);
  });
}

// ------- Animations (time-based) -------
function getActive(animId){ return doc.animations.find(a=>a.id===animId); }
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }

// random util
function prand(seed){ return Math.abs(Math.sin(seed*12.9898)*43758.5453)%1; }

function animatedProps(base, wordObj, t, totalDur){
  // per-word base props
  const props = {
    x: base.x, y: base.y, scale: 1, alpha: 1,
    text: wordObj.text, color: null, dx:0, dy:0,
    shadow: null,             // {blur, color}
    gradient: null,           // {type:"rainbow"|"sweep", speed, width}
    perChar: null             // {dy:[...], alpha:[...], textOverride?:string}
  };

  // SCROLL / MARQUEE
  const scroll = getActive("scroll");
  if (scroll){
    const dir = (scroll.params.dir||"L").toUpperCase();
    const sp  = Number(scroll.params.speed||1);   // ≈ 20px/s per 1x
    const v = 20 * sp;
    if (dir==="L")  props.dx -= (t*v) % (doc.res.w + 200);
    if (dir==="R")  props.dx += (t*v) % (doc.res.w + 200);
    if (dir==="U")  props.dy -= (t*v) % (doc.res.h + 200);
    if (dir==="D")  props.dy += (t*v) % (doc.res.h + 200);
  }

  // TYPEWRITER
  const type = getActive("typewriter");
  if (type && props.text){
    const rate = Number(type.params.rate||1); // chars per 0.1s => 10*rate cps
    const cps  = 10*rate;
    const shown = Math.max(0, Math.min(props.text.length, Math.floor(t * cps)));
    props.text = props.text.slice(0, shown);
  }

  // PULSE / BREATHE
  const pulse = getActive("pulse");
  if (pulse){
    const s = Number(pulse.params.scale || 0.03);
    const vy = Number(pulse.params.vy || 4);
    props.scale *= 1 + (Math.sin(t*2*Math.PI*1) * s);
    props.dy += Math.sin(t*2*Math.PI*1) * vy;
  }

  // WAVE
  const wave = getActive("wave");
  if (wave){
    const ax = Number(wave.params.ax||0.8);
    const ay = Number(wave.params.ay||1.4);
    const cyc = Number(wave.params.cycles||1.0);
    const ph  = (cyc * 2*Math.PI * t);
    props.dx += Math.sin(ph + base.x*0.05) * ax*4;
    props.dy += Math.sin(ph + base.y*0.06) * ay*4;
  }

  // JITTER
  const jit = getActive("jitter");
  if (jit){
    const a = Number(jit.params.amp||0.10);
    const f = Number(jit.params.freq||2.5);
    const seed = (base.x*13 + base.y*7) | 0;
    const r1 = Math.sin(seed + t*2*Math.PI*f)*a*3;
    const r2 = Math.cos(seed*0.3 + t*2*Math.PI*f)*a*3;
    props.dx += r1; props.dy += r2;
  }

  // SHAKE
  const shake = getActive("shake");
  if (shake){
    const a = Number(shake.params.amp||0.20) * 5;
    const f = Number(shake.params.freq||2);
    props.dx += Math.sin(t*2*Math.PI*f) * a;
    props.dy += Math.cos(t*2*Math.PI*f) * a * 0.6;
  }

  // ZOOM IN/OUT
  const zm = getActive("zoom");
  if (zm){
    const dir = (zm.params.dir||"in").toLowerCase();
    const sp  = Number(zm.params.speed||1);
    const k = 0.4*sp;
    props.scale *= (dir==="in")
      ? (1 + k*easeOutCubic(Math.min(1, t/1.0)))
      : Math.max(0.2, 1 + k*(1 - Math.min(1, t/1.0))*(-1));
  }

  // FADE OUT (last 20%)
  const fout = getActive("fadeout");
  if (fout && totalDur){
    const tail = 0.2 * totalDur;
    if (t > totalDur - tail){
      const r = (t - (totalDur - tail)) / tail;
      props.alpha *= Math.max(0, 1 - r);
    }
  }

  // SLIDE IN (first 20%)
  const slide = getActive("slide");
  if (slide && totalDur){
    const head = 0.2 * totalDur;
    const dir = (slide.params.dir||"L").toUpperCase();
    const sp  = Number(slide.params.speed||1);
    const d = Math.min(1, t / Math.max(0.001, head));
    const dist = (dir==="L"||dir==="R" ? doc.res.w : doc.res.h) * 0.6 * sp;
    const s = 1 - easeOutCubic(d);
    if (dir==="L")  props.dx -= dist*s;
    if (dir==="R")  props.dx += dist*s;
    if (dir==="U")  props.dy -= dist*s;
    if (dir==="D")  props.dy += dist*s;
  }

  // SLIDE AWAY (last 20%)
  const slideAway = getActive("slideaway");
  if (slideAway && totalDur){
    const tail = 0.2 * totalDur;
    if (t > totalDur - tail){
      const dir = (slideAway.params.dir||"L").toUpperCase();
      const sp  = Number(slideAway.params.speed||1);
      const r = (t - (totalDur - tail)) / tail;
      const dist = (dir==="L"||dir==="R" ? doc.res.w : doc.res.h) * 0.6 * sp;
      const s = easeOutCubic(r);
      if (dir==="L")  props.dx -= dist*s;
      if (dir==="R")  props.dx += dist*s;
      if (dir==="U")  props.dy -= dist*s;
      if (dir==="D")  props.dy += dist*s;
    }
  }

  // COLOR CYCLE
  const cc = getActive("colorcycle");
  if (cc){
    const sp = Number(cc.params.speed||0.5);
    const hue = Math.floor((t*60*sp) % 360);
    props.color = `hsl(${hue}deg 100% 60%)`;
  }

  // FLICKER (alpha jitter)
  const flicker = getActive("flicker");
  if (flicker){
    const str = Math.max(0, Math.min(1, Number(flicker.params.strength||0.5)));
    const seed = (base.x*31 + base.y*17);
    const n = (Math.sin(seed + t*23.7) + Math.sin(seed*0.7 + t*17.3)) * 0.25 + 0.5;
    props.alpha *= (1 - str*0.6) + n*str*0.6; // 0.4..1 range
  }

  // GLOW PULSE (shadow blur)
  const glow = getActive("glow");
  if (glow){
    const intensity = Math.max(0, Number(glow.params.intensity||0.6));
    const k = (Math.sin(t*2*Math.PI*1.2)*0.5 + 0.5) * intensity;
    props.shadow = { blur: 6 + k*10, color: props.color || null };
  }

  // RAINBOW SWEEP (gradient)
  const rainbow = getActive("rainbow");
  if (rainbow){
    const speed = Number(rainbow.params.speed||0.5);
    props.gradient = { type:"rainbow", speed };
  }

  // HIGHLIGHT SWEEP (bright band)
  const sweep = getActive("sweep");
  if (sweep){
    const speed = Number(sweep.params.speed||0.7);
    const width = Number(sweep.params.width||0.25); // fraction of word width
    props.gradient = { type:"sweep", speed, width };
  }

  // STROBE (hard flashes)
  const strobe = getActive("strobe");
  if (strobe){
    const rate = Number(strobe.params.rate||3); // Hz
    const phase = Math.sin(2*Math.PI*rate*t);
    props.alpha *= (phase > 0) ? 1 : 0.15;
  }

  // HEARTBEAT (periodic strong pulse)
  const hb = getActive("heartbeat");
  if (hb){
    const r = Number(hb.params.rate||1.2);
    const beat = Math.abs(Math.sin(2*Math.PI*r*t))**2; // 0..1
    props.scale *= 1 + beat*0.08;
  }

  // RIPPLE (per-character vertical offsets)
  const ripple = getActive("ripple");
  if (ripple && props.text){
    const amp = Number(ripple.params.amp||1.0) * 2.0;
    const freq = Number(ripple.params.freq||2.0);
    const arr = [];
    for (let i=0;i<props.text.length;i++){
      arr.push(Math.sin(2*Math.PI*freq*t + i*0.6) * amp);
    }
    props.perChar ??= {};
    props.perChar.dy = arr;
  }

  // SCRAMBLE/DECODE (per-char random until resolved)
  const scr = getActive("scramble");
  if (scr && props.text){
    const rate = Number(scr.params.rate||1); // chars per 0.1s
    const cps  = 10*rate;
    const goal = wordObj.text || "";
    let out = "";
    for (let i=0;i<goal.length;i++){
      const revealAt = i / cps; // reveal sequentially
      if (t >= revealAt) out += goal[i];
      else {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        const idx = Math.floor((t*20 + i*3) % chars.length);
        out += chars[idx];
      }
    }
    props.text = out;
  }

  // POPCORN (random per-char alpha)
  const pop = getActive("popcorn");
  if (pop && props.text){
    const rate = Number(pop.params.rate||1); // Hz
    const alphaArr = [];
    for (let i=0;i<props.text.length;i++){
      const seed = i*7 + (base.x|0)*3 + (base.y|0);
      const phase = Math.sin(2*Math.PI*rate*t + seed*0.17);
      alphaArr.push(phase>0 ? 1 : 0.2);
    }
    props.perChar ??= {};
    props.perChar.alpha = alphaArr;
  }

  return props;
}

// render helpers
function measureCharWidths(text, fontSpec){
  ctx.save();
  ctx.font = fontSpec;
  const widths = [];
  for (let i=0;i<text.length;i++){
    widths.push(Math.ceil(ctx.measureText(text[i]).width));
  }
  ctx.restore();
  return widths;
}

function renderText(t=0, totalDur=null) {
  const layout = layoutDocument();
  layout.positions.forEach((p) => {
    const word = doc.lines[p.line].words[p.word];
    const st = resolveStyle(word.style);
    const props = animatedProps(p, word, t, totalDur);
    const txt = props.text || "";

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, props.alpha));
    ctx.textBaseline = "alphabetic";

    // font scale
    const fsize = st.fontSize * props.scale;
    const fontSpec = `${fsize}px ${st.fontFamily}`;
    ctx.font = fontSpec;

    // shadow (glow)
    if (props.shadow){
      ctx.shadowBlur = props.shadow.blur;
      ctx.shadowColor = props.shadow.color || st.color;
    } else {
      ctx.shadowBlur = 0;
    }

    // Fill style (color or gradient)
    let fillStyle = props.color || st.color;

    // For gradient effects we need word width
    let wordWidth = Math.ceil(ctx.measureText(txt).width);
    if (props.gradient && txt.length>0){
      if (props.gradient.type==="rainbow"){
        const g = ctx.createLinearGradient(p.x, p.y, p.x + wordWidth, p.y);
        // sweep hue over time
        const baseHue = (t*120*props.gradient.speed) % 360;
        for (let i=0;i<=6;i++){
          const stop = i/6;
          const hue = Math.floor((baseHue + stop*360)%360);
          g.addColorStop(stop, `hsl(${hue}deg 100% 60%)`);
        }
        fillStyle = g;
      }
      if (props.gradient.type==="sweep"){
        const band = Math.max(0.05, Math.min(0.8, props.gradient.width||0.25));
        const pos = (t * (props.gradient.speed||0.7) * 1.2) % 1; // 0..1 along word
        const g = ctx.createLinearGradient(p.x, p.y, p.x + wordWidth, p.y);
        const a = Math.max(0, pos - band/2), b = Math.min(1, pos + band/2);
        g.addColorStop(0, fillStyle);
        g.addColorStop(a, fillStyle);
        g.addColorStop(pos, "#FFFFFF");
        g.addColorStop(b, fillStyle);
        g.addColorStop(1, fillStyle);
        fillStyle = g;
      }
    }
    ctx.fillStyle = fillStyle;

    // draw
    const baseX = p.x + (props.dx||0);
    const baseY = p.y + (props.dy||0);

    // per-character modes (ripple, popcorn, scramble already baked)
    if (props.perChar && txt.length){
      const widths = measureCharWidths(txt, fontSpec);
      let x = baseX;
      for (let i=0;i<txt.length;i++){
        const ch = txt[i];
        const dy = (props.perChar.dy?.[i] || 0);
        const aMul = (props.perChar.alpha?.[i] ?? 1);
        const oldA = ctx.globalAlpha;
        ctx.globalAlpha = oldA * aMul;
        ctx.fillText(ch, x, baseY + dy);
        ctx.globalAlpha = oldA;
        x += widths[i] + (doc.style.wordGapChar||0);
      }
    } else {
      ctx.fillText(txt, baseX, baseY);
    }

    // selection outline
    if (selected && selected.line===p.line && selected.word===p.word) {
      const box = measureWordBBox(p.line, p.word);
      if (box) {
        ctx.strokeStyle = "#00E0FF";
        ctx.lineWidth = 1;
        ctx.strokeRect(box.x-1, box.y-1, box.w+2, box.h+2);
      }
    }
    ctx.restore();
  });
}
function render(t=0, totalDur=null) {
  canvas.width = doc.res.w;
  canvas.height = doc.res.h;
  renderBg();
  renderText(t, totalDur);
  ensureSelectionDeleteBtn();
}

// ------- Preview loop -------
let rafId = null;
let t0 = null;
function startPreview(){
  if (rafId) cancelAnimationFrame(rafId);
  t0 = performance.now();
  const loop = (now)=>{
    const t = (now - t0)/1000;
    render(t, null);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}
function stopPreview(){
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  render(0, null);
}

// ------- Swatches -------
function drawSwatches() {
  // text swatches
  swatchesWrap.innerHTML = "";
  const all = [...defaultPalette.map(c=>({c,d:true})), ...customPalette.map(c=>({c,d:false}))];
  all.forEach(({c,d})=>{
    const wrap = document.createElement("div");
    wrap.className = "swatch-wrap";
    const s = document.createElement("div");
    s.className = "swatch";
    s.style.background = c;
    s.title = c + (d?" (default)":"");
    s.addEventListener("click", ()=>{
      doc.style.color = c;
      fontColorInput.value = c;
      pushHistory(); render(0, null);
    });
    wrap.appendChild(s);
    if (!d) {
      const x = document.createElement("button");
      x.textContent = "×";
      x.className = "x";
      x.addEventListener("click", (ev)=>{
        ev.stopPropagation();
        customPalette = customPalette.filter(cc=>cc!==c);
        drawSwatches();
      });
      wrap.appendChild(x);
    }
    swatchesWrap.appendChild(wrap);
  });

  // background swatches mirror palette
  bgSwatches.innerHTML = "";
  const allBg = [...defaultPalette.map(c=>({c,d:true})), ...customBgPalette.map(c=>({c,d:false}))];
  allBg.forEach(({c,d})=>{
    const wrap = document.createElement("div");
    wrap.className = "swatch-wrap";
    const s = document.createElement("div");
    s.className = "swatch";
    s.style.background = c;
    s.title = c + (d?" (default)":"");
    s.addEventListener("click", ()=>{
      doc.bg = { type: "solid", color: c, image: null, preset: null };
      bgSolidColor.value = c;
      pushHistory(); render(0, null);
    });
    wrap.appendChild(s);
    if (!d) {
      const x = document.createElement("button");
      x.textContent = "×";
      x.className = "x";
      x.addEventListener("click", (ev)=>{
        ev.stopPropagation();
        customBgPalette = customBgPalette.filter(cc=>cc!==c);
        drawSwatches();
      });
      wrap.appendChild(x);
    }
    bgSwatches.appendChild(wrap);
  });
}

// ------- Events -------
zoomSlider.addEventListener("input", e=> setZoom(parseFloat(e.target.value)));
fitBtn.addEventListener("click", fitZoom);

modePrevBtn.addEventListener("click", ()=>{
  setMode("preview");
  startPreview();
});
modeEditBtn.addEventListener("click", ()=>{
  setMode("edit");
  stopPreview();
});

resSel.addEventListener("change", ()=>{
  const [w,h] = resSel.value.split("x").map(Number);
  doc.res = { w, h };
  render(0, null); fitZoom();
});

addLineBtn.addEventListener("click", ()=>{
  pushHistory();
  doc.lines.push({ words: [{text:""}], offsetY:0 });
  selected = { line: doc.lines.length-1, word: 0, caret: 0 };
  openInspector(true);
  render(0, null);
});
addWordBtn.addEventListener("click", ()=>{
  pushHistory();
  const line = doc.lines[selected.line] || doc.lines[doc.lines.length-1];
  line.words.push({text:""});
  selected.word = line.words.length-1;
  selected.caret = 0;
  openInspector(true);
  render(0, null);
});

deleteWordFx.addEventListener("click", ()=>{
  if (!selected) return;
  pushHistory();
  const line = doc.lines[selected.line];
  if (!line) return;
  line.words.splice(selected.word,1);
  if (!line.words.length) {
    doc.lines.splice(selected.line,1);
    selected = doc.lines.length? { line:0, word:0, caret:0 } : null;
  } else {
    selected.word = Math.max(0, selected.word-1);
  }
  render(0, null);
});

canvas.addEventListener("click", (e)=>{
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left)/zoom;
  const y = (e.clientY - rect.top)/zoom;
  const layout = layoutDocument();
  let hit = null;
  layout.positions.forEach(p=>{
    const b = measureWordBBox(p.line, p.word);
    if (!b) return;
    if (x>=b.x-2 && x<=b.x+b.w+2 && y>=b.y-2 && y<=b.y+b.h+2) hit = p;
  });
  if (hit) {
    selected = { line: hit.line, word: hit.word, caret: (doc.lines[hit.line].words[hit.word].text||"").length };
    if (mode==="preview") { setMode("edit"); stopPreview(); }
    openInspector(true);
    try { mobileInput.focus(); } catch {}
    render(0, null);
  }
});

document.addEventListener("keydown", (e)=>{
  if (mode!=="edit") return;
  if (!selected) return;
  const line = doc.lines[selected.line];
  if (!line) return;
  const word = line.words[selected.word]; if (!word) return;

  if (e.key==="Enter") { // new line
    e.preventDefault();
    pushHistory();
    doc.lines.splice(selected.line+1,0,{words:[{text:""}],offsetY:0});
    selected = { line: selected.line+1, word: 0, caret: 0 };
    render(0, null); return;
  }
  if (e.key===" " && !e.ctrlKey && !e.metaKey) { // new word
    e.preventDefault();
    pushHistory();
    line.words.splice(selected.word+1,0,{text:""});
    selected = { line: selected.line, word: selected.word+1, caret: 0 };
    render(0, null); return;
  }
  if (e.key==="Backspace") {
    e.preventDefault();
    pushHistory();
    const t = word.text || "";
    if (!t.length) {
      line.words.splice(selected.word,1);
      if (!line.words.length) {
        doc.lines.splice(selected.line,1);
        selected = doc.lines.length? { line:0, word:0, caret:0 } : null;
      } else {
        selected.word = Math.max(0, selected.word-1);
      }
    } else {
      word.text = t.slice(0,-1);
      selected.caret = Math.max(0, (selected.caret??t.length)-1);
    }
    autosizeForLine(selected?selected.line:0);
    render(0, null); return;
  }
  if (e.key.length===1 && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    pushHistory();
    const t = word.text || "";
    const pos = (selected.caret==null)?t.length:selected.caret;
    word.text = t.slice(0,pos) + e.key + t.slice(pos);
    selected.caret = pos+1;
    autosizeForLine(selected.line);
    render(0, null);
  }

  // shortcuts
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase()==="z") { e.preventDefault(); undo(); }
    if (e.key.toLowerCase()==="y") { e.preventDefault(); redo(); }
  }
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

// Clear All with modal
clearBtn.addEventListener("click", ()=>{
  if (!showClearWarn) { reallyClear(); return; }
  clearWarn.classList.remove("hidden");
});
function reallyClear(){
  pushHistory();
  doc.lines = [{words:[{text:""}], offsetY:0}];
  selected = {line:0, word:0, caret:0};
  clearWarn.classList.add("hidden");
  render(0, null);
}
clearCancel?.addEventListener("click", ()=> clearWarn.classList.add("hidden"));
clearConfirm?.addEventListener("click", ()=>{
  if (suppressClearWarn?.checked) showClearWarn = false;
  reallyClear();
});

// Inspector: one accordion + toggler
function openInspector(open=true){
  inspectorBody.classList.toggle("open", open);
  inspectorToggle.setAttribute("aria-expanded", String(open));
}
inspectorToggle.addEventListener("click", ()=>{
  const open = !inspectorBody.classList.contains("open");
  openInspector(open);
});
accs.forEach(acc=>{
  acc.addEventListener("toggle", ()=>{
    if (acc.open) accs.filter(a=>a!==acc).forEach(a=>a.open=false);
  });
});
toolbarTabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const id = btn.getAttribute("data-acc");
    const target = document.getElementById(id);
    if (target) { target.open = true; accs.filter(a=>a!==target).forEach(a=>a.open=false); openInspector(true); }
  });
});

// Bind controls
fontSel.addEventListener("change", ()=>{ pushHistory(); doc.style.fontFamily = fontSel.value; autosizeForLine(selected?.line ?? 0); render(0, null); });
fontSizeInput.addEventListener("input", ()=>{ pushHistory(); doc.style.fontSize = Math.max(6, Math.min(64, parseInt(fontSizeInput.value||defaults.fontSize))); autosizeForLine(selected?.line ?? 0); render(0, null); });
fontColorInput.addEventListener("input", ()=>{ pushHistory(); doc.style.color = fontColorInput.value; render(0, null); });
lineGapInput.addEventListener("input", ()=>{ pushHistory(); doc.style.lineGap = parseInt(lineGapInput.value||4); render(0, null); });
wordGapInput.addEventListener("input", ()=>{ pushHistory(); doc.style.wordGap = parseInt(wordGapInput.value||6); render(0, null); });
alignBtns.forEach(b=> b.addEventListener("click", ()=>{ alignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); pushHistory(); doc.style.align = b.dataset.align; render(0, null); }));
valignBtns.forEach(b=> b.addEventListener("click", ()=>{ valignBtns.forEach(x=>x.classList.remove("active")); b.classList.add("active"); pushHistory(); doc.style.valign = b.dataset.valign; render(0, null); }));
manualDragChk.addEventListener("change", ()=>{/* hook for manual drag mode if needed */});
applyAllAlign.addEventListener("change", ()=>{/* hook for apply to all */});

// Palette
function drawBothPalettes(){ drawSwatches(); }
const addSwatch = (arr, c)=>{ if (!defaultPalette.includes(c) && !arr.includes(c)) arr.push(c); };
addSwatchBtn.addEventListener("click", ()=>{ addSwatch(customPalette, fontColorInput.value); drawBothPalettes(); });
clearSwatchesBtn.addEventListener("click", ()=>{ customPalette = []; drawBothPalettes(); });
addBgSwatchBtn.addEventListener("click", ()=>{ addSwatch(customBgPalette, bgSolidColor.value); drawBothPalettes(); });

bgSolidBtn.addEventListener("click", ()=>{ pushHistory(); doc.bg = { type:"solid", color:bgSolidColor.value, image:null, preset:null }; render(0, null); });
bgSolidColor.addEventListener("input", ()=>{ pushHistory(); doc.bg = { type:"solid", color:bgSolidColor.value, image:null, preset:null }; render(0, null); });
bgUpload.addEventListener("change", (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = ()=>{ URL.revokeObjectURL(url); pushHistory(); doc.bg = { type:"image", color:null, image:im, preset:null }; render(0, null); };
  im.src = url;
});

// Config
saveJsonBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(doc,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "config.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 500);
});
loadJsonInput.addEventListener("change", (e)=>{
  const f = e.target.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ()=>{ try { pushHistory(); doc = JSON.parse(r.result); render(0, null); fitZoom(); } catch{} };
  r.readAsText(f);
});

// ---- One-click GIF download with real motion ----
function encoderToBlob(encoder){
  const bytes = encoder.stream().bin || encoder.stream().getData();
  const u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
  return new Blob([u8], { type: "image/gif" });
}
async function downloadGif(){
  if (typeof GIFEncoder === "undefined") {
    alert("GIFEncoder didn't load. Keep internet on or ask me to inline the libs for offline use.");
    return;
  }
  const fps = Math.max(1, Math.min(30, parseInt(fpsInput.value||15)));
  const secs = Math.max(1, Math.min(60, parseInt(secInput.value||8)));
  const frames = Math.max(1, Math.min(1800, fps * secs));
  const delayMs = Math.round(1000 / fps);
  const W = canvas.width, H = canvas.height;

  const encoder = new GIFEncoder();
  encoder.setRepeat(0);
  encoder.setDelay(delayMs);
  encoder.setQuality(10);
  encoder.setSize(W, H);
  encoder.start();

  const wasPreview = (mode === "preview");
  if (wasPreview) stopPreview();

  for (let i=0; i<frames; i++){
    const t = i / fps;       // seconds into animation
    render(t, secs);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  const blob = encoderToBlob(encoder);
  const url = URL.createObjectURL(blob);
  const outName = (fileNameInput.value || "animation.gif").replace(/\.(png|jpg|jpeg|webp)$/i, ".gif");

  const a = document.createElement("a");
  a.href = url; a.download = outName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 4000);

  if (wasPreview) startPreview();
}
downloadGifBtn.addEventListener("click", downloadGif);

// Animations UI (checkboxes + params)
const ANIMS = [
  {id:"scroll", name:"Scroll / Marquee", params:{dir:"L", speed:1}},
  {id:"typewriter", name:"Typewriter", params:{rate:1}},
  {id:"pulse", name:"Pulse/Breathe", params:{scale:0.03, vy:4}},
  {id:"wave", name:"Wave", params:{ax:0.8, ay:1.4, cycles:1.0}},
  {id:"jitter", name:"Jitter", params:{amp:0.10, freq:2.5}},
  {id:"shake", name:"Shake", params:{amp:0.20, freq:2}},
  {id:"zoom", name:"Zoom In/Out", params:{dir:"in", speed:1}},
  {id:"fadeout", name:"Fade Out", params:{ }},
  {id:"slide", name:"Slide In", params:{dir:"L", speed:1}},
  {id:"slideaway", name:"Slide Away", params:{dir:"L", speed:1}},
  {id:"colorcycle", name:"Color Cycle", params:{speed:0.5}},
  {id:"flicker", name:"Flicker", params:{strength:0.5}},
  {id:"glow", name:"Glow Pulse", params:{intensity:0.6}},
  {id:"rainbow", name:"Rainbow Sweep", params:{speed:0.5}},
  {id:"sweep", name:"Highlight Sweep", params:{speed:0.7, width:0.25}},
  {id:"strobe", name:"Strobe", params:{rate:3}},
  {id:"heartbeat", name:"Heartbeat", params:{rate:1.2}},
  {id:"ripple", name:"Ripple", params:{amp:1.0, freq:2.0}},
  {id:"scramble", name:"Scramble/Decode", params:{rate:1}},
  {id:"popcorn", name:"Popcorn", params:{rate:1}},
];
function buildAnimUI(){
  animList.innerHTML = "";
  ANIMS.forEach(a=>{
    const row = document.createElement("div");
    const chk = document.createElement("input");
    chk.type="checkbox"; chk.id = "anim_"+a.id;

    chk.addEventListener("change", ()=>{
      const found = doc.animations.find(x=>x.id===a.id);
      if (chk.checked && !found) doc.animations.push({id:a.id, params:{...a.params}});
      if (!chk.checked) doc.animations = doc.animations.filter(x=>x.id!==a.id);
    });

    const label = document.createElement("label"); label.htmlFor = chk.id; label.textContent = a.name;
    const gear = document.createElement("button"); gear.textContent="⚙"; gear.className="button tiny";

    const params = document.createElement("div");
    params.style.display="none"; params.style.margin="6px 0";

    gear.addEventListener("click", ()=>{ params.style.display = params.style.display==="none" ? "block" : "none"; });

    Object.keys(a.params).forEach(k=>{
      const pwrap = document.createElement("div"); pwrap.style.display="inline-flex"; pwrap.style.gap="6px"; pwrap.style.marginRight="8px";
      const lab = document.createElement("span"); lab.textContent = k;
      const inp = document.createElement("input"); inp.value = a.params[k];
      inp.addEventListener("input", ()=>{
        const it = doc.animations.find(x=>x.id===a.id);
        if (it) it.params[k] = (isNaN(+inp.value) ? inp.value : +inp.value);
      });
      pwrap.appendChild(lab); pwrap.appendChild(inp);
      params.appendChild(pwrap);
    });

    row.appendChild(chk); row.appendChild(label); row.appendChild(gear); row.appendChild(params);
    animList.appendChild(row);
  });
}
animHelpBtn.addEventListener("click", ()=>{
  alert("Enable an animation with its checkbox; click ⚙ to tweak parameters.\nPreview shows live motion; Download GIF exports the same motion.\nEffects wired: Scroll/Typewriter/Pulse/Wave/Jitter/Shake/Zoom/Fade/Slide/ColorCycle + Flicker/Glow/Rainbow/Highlight/Strobe/Heartbeat/Ripple/Scramble/Popcorn.");
});

// Inspector open/close
function openInspector(open=true){
  inspectorBody.classList.toggle("open", open);
  inspectorToggle.setAttribute("aria-expanded", String(open));
}

// ------- Init -------
function initBackgrounds(){
  initBackgroundPresets();
  doc.bg = { type:"solid", color:"#000000", image:null, preset:null };
  bgSolidColor.value = "#000000";
}
function init(){
  doc.style = {...defaults};
  drawSwatches();
  initBackgrounds();
  buildAnimUI();
  setMode("edit");
  setZoom(zoom);
  render(0, null);
  fitZoom();
  openInspector(false);
}
window.addEventListener("resize", fitZoom);
init();
