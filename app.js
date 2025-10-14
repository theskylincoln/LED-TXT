(() => {
  const ASSETS = {
    "96×128": {
      "Wheelie (96×128)": "assets/Preset_A.png",
      "2 Up (96×128)":    "assets/Preset_B.png"
    },
    "64×64": {
      "Wheelie (64×64)":  "assets/Preset_C.png",
      "2 Up (64×64)":     "assets/Preset_D.png"
    }
  };
  const PRESET_HEX = {
    Blue:"#008cff", Green:"#00d200", Yellow:"#ffd700", Magenta:"#ff3cc8", Red:"#ff2828",
    Orange:"#ff7f00", White:"#ffffff", Cyan:"#00ffff", Purple:"#8a2be2", Pink:"#ff69b4"
  };

  const state = {
    resMode:"96×128", W:96, H:128,
    bgSource:"Preset", bgChoice:"Wheelie (96×128)",
    solidHex:"#000000",
    customBgBytes:null, customBgIsGif:false,

    playing:true, editMode:false, zoom:3,

    lines: [
      [ {text:"WILL", color:"Blue", colorMode:"preset", customHex:"#008cff", scale:1, dx:0, dy:0} ],
      [ {text:"WHEELIE", color:"Green", colorMode:"preset", customHex:"#00d200", scale:1, dx:0, dy:0} ],
      [ {text:"FOR", color:"Yellow", colorMode:"preset", customHex:"#ffd700", scale:1, dx:0, dy:0} ],
      [ {text:"BOOKTOK", color:"Magenta", colorMode:"preset", customHex:"#ff3cc8", scale:1, dx:0, dy:0} ],
      [ {text:"GIRLIES", color:"Red", colorMode:"preset", customHex:"#ff2828", scale:1, dx:0, dy:0} ]
    ],
    sel:{li:0, wi:0},

    animEnableBreath:true,
    animEnableWave:true,
    animEnableJitter:true,
    anim:{ BREATH_Y_AMPL:4.0, SCALE_AMPL:0.03, BREATH_CYCLES:1.0, WAVE_X_AMPL:0.8, WAVE_Y_AMPL:1.4, WAVE_CYCLES:1.0, JITTER_AMPL:0.10, JITTER_CYCLES:2.5 },

    autoSize:true, lineGap:2, wordSpace:3,

    seconds:8, fps:15, autoMatch:true,

    ownerUnlocked:false
  };

  const q = s => document.querySelector(s);

  // About/left
  const helpToggle = q("#helpToggle");
  const helpOverlay = q("#helpOverlay");
  const ownerKey = q("#ownerKey");
  const uploadPresetInput = q("#uploadPresetInput");
  const downloadPresetBtn = q("#downloadPresetBtn");
  const exportBundleBtn = q("#exportBundleBtn");

  // BG/Res row
  const resolutionSel = q("#resolutionSel");
  const customRes = q("#customRes");
  const customW = q("#customW");
  const customH = q("#customH");
  const chipPreset = q("#chipPreset");
  const chipSolid  = q("#chipSolid");
  const chipCustom = q("#chipCustom");
  const inlineUploadLbl = q("#inlineUploadLbl");
  const customBgInput = q("#customBgInput");
  const bgPresetGrid = q("#bgPresetGrid");
  const solidColor = q("#solidColor");

  // Preview
  const playBtn = q("#playBtn");
  const pauseBtn = q("#pauseBtn");
  const editBtn = q("#editBtn");
  const zoomInBtn = q("#zoomInBtn");
  const zoomOutBtn = q("#zoomOutBtn");
  const zoomFitBtn = q("#zoomFitBtn");
  const canvas = q("#previewCanvas");
  const ctx = canvas.getContext("2d");

  // Inspector
  const ins = {
    el: q("#inspector"),
    label: q("#insLabel"),
    done: q("#insDone"),
    text: q("#insText"),
    colorPreset: q("#insColorPreset"),
    colorCustom: q("#insColorCustom"),
    size: q("#insSize"),
    nL: q("#nudgeL"), nU:q("#nudgeU"), nD:q("#nudgeD"), nR:q("#nudgeR"),
    delBtn: q("#deleteWordBtn")
  };

  const addLineBtn = q("#addLineBtn");
  const addWordBtn = q("#addWordBtn");

  // Typog
  const autoSizeToggle = q("#autoSizeToggle");
  const lineGap = q("#lineGap");
  const wordSpace = q("#wordSpace");

  // Anim
  const animEnableBreath = q("#animEnableBreath");
  const animBY = q("#animBY");
  const animSC = q("#animSC");
  const animBC = q("#animBC");
  const animEnableWave = q("#animEnableWave");
  const animWX = q("#animWX");
  const animWY = q("#animWY");
  const animWC = q("#animWC");
  const animEnableJitter = q("#animEnableJitter");
  const animJJ = q("#animJJ");
  const animJC = q("#animJC");

  // Output
  const seconds = q("#seconds");
  const fps = q("#fps");
  const autoMatch = q("#autoMatch");
  const gifPalette = q("#gifPalette");
  const gifPaletteVal = q("#gifPaletteVal");
  const gifDither = q("#gifDither");
  const gifDiff = q("#gifDiff");
  const renderBtn = q("#renderBtn");

  function resizeCanvas(){
    canvas.width = state.W;
    canvas.height = state.H;
    canvas.style.width = (state.W * state.zoom) + "px";
    canvas.style.height = (state.H * state.zoom) + "px";
  }

  function setBgSource(src){
    state.bgSource = src;
    [chipPreset, chipSolid, chipCustom].forEach(el => el.classList.remove("selected"));
    if (src === "Preset") chipPreset.classList.add("selected");
    if (src === "Solid")  chipSolid.classList.add("selected");
    if (src === "Custom") chipCustom.classList.add("selected");
    inlineUploadLbl.style.display = (src === "Custom") ? "inline-flex" : "none";
  }

  function refreshPresetGrid(){
    bgPresetGrid.innerHTML = "";
    if (state.resMode === "Custom") return;
    const group = ASSETS[state.resMode] || {};
    Object.entries(group).forEach(([name, path]) => {
      const div = document.createElement("div");
      div.className = "thumb" + (state.bgChoice === name ? " selected" : "");
      const img = new Image();
      img.src = path; img.width = 96; img.height = (state.resMode === "96×128") ? 128 : 64;
      img.loading = "eager";
      div.appendChild(img);
      div.title = name;
      div.onclick = () => {
        setBgSource("Preset");
        state.bgChoice = name;
        if (state.ownerUnlocked && state.resMode === "96×128") {
          if (name.includes("Wheelie")) ownerPhraseA();
          if (name.includes("2 Up")) ownerPhraseB();
        }
        refreshPresetGrid();
      };
      bgPresetGrid.appendChild(div);
    });
  }

  function ownerPhraseA(){
    state.lines = [
      [ {text:"WILL", color:"Blue", colorMode:"preset", customHex:"#008cff", scale:1, dx:0, dy:0} ],
      [ {text:"WHEELIE", color:"Green", colorMode:"preset", customHex:"#00d200", scale:1, dx:0, dy:0} ],
      [ {text:"FOR", color:"Yellow", colorMode:"preset", customHex:"#ffd700", scale:1, dx:0, dy:0} ],
      [ {text:"BOOKTOK", color:"Magenta", colorMode:"preset", customHex:"#ff3cc8", scale:1, dx:0, dy:0} ],
      [ {text:"GIRLIES", color:"Red", colorMode:"preset", customHex:"#ff2828", scale:1, dx:0, dy:0} ]
    ];
  }
  function ownerPhraseB(){
    state.lines = [
      [ {text:"FREE", color:"Blue", colorMode:"preset", customHex:"#008cff", scale:1, dx:0, dy:0} ],
      [ {text:"RIDES", color:"Green", colorMode:"preset", customHex:"#00d200", scale:1, dx:0, dy:0} ],
      [ {text:"FOR", color:"Yellow", colorMode:"preset", customHex:"#ffd700", scale:1, dx:0, dy:0} ],
      [ {text:"BOOKTOK", color:"Magenta", colorMode:"preset", customHex:"#ff3cc8", scale:1, dx:0, dy:0} ],
      [ {text:"GIRLIES", color:"Red", colorMode:"preset", customHex:"#ff2828", scale:1, dx:0, dy:0} ]
    ];
  }

  function colorHex(seg){
    return seg.colorMode === "preset" ? (PRESET_HEX[seg.color] || "#ffffff") : (seg.customHex || "#ffffff");
  }

  function fitLineFontSize(words, W, H){
    const text = words.map(w => w.text).join(" ");
    if (!text) return 20;
    let lo=6, hi=200;
    const margin = 0.96;
    while (lo < hi) {
      const mid = Math.floor((lo+hi+1)/2);
      const width = measureLineWidth(words, mid);
      const totalH = mid * 1.1;
      if (width <= W * margin && totalH <= H) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  function measureLineWidth(words, size){
    const text = words.map(w=>w.text).join(" ");
    ctx.font = `bold ${size}px sans-serif`;
    return ctx.measureText(text).width + state.wordSpace*(Math.max(0,words.length-1));
  }

  function measureLayout(){
    const W = state.W, H = state.H;
    const sizes = [], heights=[];
    for (const line of state.lines){
      const size = state.autoSize ? fitLineFontSize(line, W, H) : 24;
      sizes.push(size);
      heights.push(size*1.1);
    }
    const totalH = heights.reduce((a,b)=>a+b,0) + state.lineGap * (heights.length-1);
    let y=(H-totalH)/2; const ys=[];
    for (const h of heights){ ys.push(y); y+=h+state.lineGap; }
    return { sizes, ys };
  }

  let presetBgImg = null;
  async function loadPresetBg(){
    try{
      if (state.bgSource !== "Preset"){ presetBgImg = null; return; }
      const path = (ASSETS[state.resMode]||{})[state.bgChoice];
      if (!path){ presetBgImg = null; return; }
      presetBgImg = await loadImage(path);
    }catch(e){ presetBgImg = null; }
  }
  function loadImage(src){
    return new Promise((resolve, reject)=>{ const im=new Image(); im.onload=()=>resolve(im); im.onerror=reject; im.src=src; });
  }

  function draw(){
    if (state.playing){
      // background
      if (state.bgSource === "Solid"){
        ctx.fillStyle = state.solidHex;
        ctx.fillRect(0,0,canvas.width, canvas.height);
      } else if (state.bgSource === "Preset"){
        if (presetBgImg) ctx.drawImage(presetBgImg,0,0,canvas.width,canvas.height);
        else { ctx.fillStyle="#000"; ctx.fillRect(0,0,canvas.width,canvas.height); }
      } else if (state.bgSource === "Custom"){
        // Keep preview black; uploaded custom can be used in export (clean UI).
        ctx.fillStyle="#000";
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }

      // text
      const { sizes, ys } = measureLayout();
      const t = performance.now()/1000;

      for (let li=0; li<state.lines.length; li++){
        const line = state.lines[li];
        const size = sizes[li] || 24;
        ctx.font = `bold ${size}px sans-serif`;

        const fullText = line.map(w=>w.text).join(" ");
        const fullW = ctx.measureText(fullText).width + state.wordSpace*(Math.max(0,line.length-1));
        let cx = Math.round((state.W - fullW)/2);
        const yBase = Math.round(ys[li]) + size;

        for (const seg of line){
          const segTxt = seg.text || "";
          const segW = ctx.measureText(segTxt).width + state.wordSpace;

          let dx = seg.dx||0, dy = seg.dy||0, sx=1.0, sy=1.0;
          const ph = li*0.7;

          if (state.animEnableBreath){
            const BY=+animBY.value, SC=+animSC.value, BC=+animBC.value;
            const bphase = 2*Math.PI*BC*(t+ph);
            const bcent = (0.5 - 0.5*Math.cos(bphase) - 0.5) * 2.0;
            dy += BY*bcent;
            const sc = 1.0 + SC*bcent;
            sx*=sc; sy*=sc;
          }
          if (state.animEnableWave){
            const WX=+animWX.value, WY=+animWY.value, WC=+animWC.value;
            const wbase = 2*Math.PI*WC*(t+ph);
            dx += WX*Math.sin(wbase);
            dy += WY*Math.cos(wbase/1.5);
          }
          if (state.animEnableJitter){
            const JJ=+animJJ.value, JC=+animJC.value;
            const jbase = 2*Math.PI*JC*(t+ph);
            dx += JJ*Math.sin(jbase*1.3 + ph*1.1);
            dy += JJ*Math.cos(jbase*1.7 + ph*0.9);
          }

          ctx.save();
          ctx.translate(cx+dx, yBase+dy);
          ctx.scale(sx, sy);
          ctx.fillStyle = seg.colorMode==="preset" ? (PRESET_HEX[seg.color]||"#fff") : (seg.customHex||"#fff");
          ctx.fillText(segTxt, 0, 0);
          ctx.restore();

          cx += segW;
        }
      }
    }
    requestAnimationFrame(draw);
  }

  function openInspector(li, wi, clientX, clientY){
    state.sel = { li, wi };
    const seg = state.lines[li][wi];
    ins.text.value = (seg.text || "").toUpperCase();

    if (seg.colorMode === "custom"){
      ins.colorPreset.value = "__custom__";
      ins.colorCustom.style.display = "inline-block";
      ins.colorCustom.value = seg.customHex || "#ffffff";
    } else {
      ins.colorPreset.value = seg.color || "White";
      ins.colorCustom.style.display = "none";
    }

    ins.size.value = 24;

    const r = canvas.getBoundingClientRect();
    const left = Math.min(Math.max(12, clientX || (r.left + r.width/2)), r.right - 300);
    const top  = Math.max(12, (clientY || (r.top + 24)));
    ins.el.style.left = left + "px";
    ins.el.style.top  = top + "px";
    ins.el.hidden = false;
  }
  function closeInspector(){ ins.el.hidden = true; }

  function bindEvents(){
    helpToggle.onchange = () => {
      const on = !!helpToggle.checked;
      helpOverlay.hidden = !on;
      localStorage.setItem("helpOn", on ? "1" : "0");
    };
    helpToggle.checked = localStorage.getItem("helpOn") === "1";
    helpOverlay.hidden = !helpToggle.checked;

    ownerKey.addEventListener("change", () => {
      state.ownerUnlocked = ownerKey.value.trim().toLowerCase() === "abraham";
    });

    resolutionSel.addEventListener("change", () => {
      state.resMode = resolutionSel.value;
      if (state.resMode === "96×128"){ state.W=96; state.H=128; }
      else if (state.resMode === "64×64"){ state.W=64; state.H=64; }
      customRes.style.display = (state.resMode === "Custom") ? "flex" : "none";
      if (state.resMode !== "Custom"){
        const group = ASSETS[state.resMode];
        state.bgChoice = Object.keys(group)[0];
      }
      resizeCanvas();
      refreshPresetGrid();
      loadPresetBg();
    });
    customW.addEventListener("input", () => { state.W=Math.max(8,Math.min(512,+customW.value||96)); resizeCanvas(); });
    customH.addEventListener("input", () => { state.H=Math.max(8,Math.min(512,+customH.value||128)); resizeCanvas(); });

    [chipPreset, chipSolid, chipCustom].forEach(chip => {
      chip.addEventListener("click", () => {
        const src = chip.dataset.bgsrc;
        setBgSource(src);
        if (src === "Preset"){ refreshPresetGrid(); loadPresetBg(); }
      });
    });

    customBgInput.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const abuf = await f.arrayBuffer();
      state.customBgBytes = abuf;
      state.customBgIsGif = /\.gif$/i.test(f.name);
      setBgSource("Custom");
    });

    playBtn.addEventListener("click", () => { state.playing = true; playBtn.classList.add("on"); pauseBtn.classList.remove("on"); });
    pauseBtn.addEventListener("click", () => { state.playing = false; pauseBtn.classList.add("on"); playBtn.classList.remove("on"); });
    editBtn.addEventListener("click", () => {
      state.editMode = !state.editMode;
      editBtn.classList.toggle("on", state.editMode);
      if (state.editMode && state.playing) pauseBtn.click();
      if (!state.editMode && !state.playing) playBtn.click();
    });
    zoomInBtn.addEventListener("click", () => { state.zoom=Math.min(6,state.zoom+1); resizeCanvas(); });
    zoomOutBtn.addEventListener("click", () => { state.zoom=Math.max(2,state.zoom-1); resizeCanvas(); });
    zoomFitBtn.addEventListener("click", () => { state.zoom=(state.resMode==="96×128")?3:4; resizeCanvas(); });

    canvas.addEventListener("click", (ev) => {
      if (!state.editMode) return;
      const li = Math.min(state.sel.li, state.lines.length-1);
      const wi = Math.min(state.sel.wi, state.lines[li].length-1);
      openInspector(li, wi, ev.clientX, ev.clientY);
    });

    ins.done.addEventListener("click", closeInspector);
    ins.text.addEventListener("input", () => {
      const {li,wi} = state.sel; if (li==null||wi==null) return;
      state.lines[li][wi].text = (ins.text.value || "").toUpperCase();
    });
    ins.colorPreset.addEventListener("change", () => {
      const {li,wi} = state.sel; if (li==null||wi==null) return;
      const val = ins.colorPreset.value;
      const seg = state.lines[li][wi];
      if (val === "__custom__"){
        seg.colorMode = "custom";
        ins.colorCustom.style.display = "inline-block";
      } else {
        seg.colorMode = "preset";
        seg.color = val;
        ins.colorCustom.style.display = "none";
      }
    });
    ins.colorCustom.addEventListener("input", () => {
      const {li,wi} = state.sel; if (li==null||wi==null) return;
      state.lines[li][wi].customHex = ins.colorCustom.value;
    });

    ins.nL.addEventListener("click", () => { const s=state.sel; const seg=state.lines[s.li]?.[s.wi]; if (seg) seg.dx=(seg.dx||0)-1; });
    ins.nR.addEventListener("click", () => { const s=state.sel; const seg=state.lines[s.li]?.[s.wi]; if (seg) seg.dx=(seg.dx||0)+1; });
    ins.nU.addEventListener("click", () => { const s=state.sel; const seg=state.lines[s.li]?.[s.wi]; if (seg) seg.dy=(seg.dy||0)-1; });
    ins.nD.addEventListener("click", () => { const s=state.sel; const seg=state.lines[s.li]?.[s.wi]; if (seg) seg.dy=(seg.dy||0)+1; });
    ins.delBtn.addEventListener("click", () => {
      const {li,wi} = state.sel; if (li==null||wi==null) return;
      state.lines[li].splice(wi,1);
      if (state.lines[li].length===0) state.lines.splice(li,1);
      closeInspector();
    });

    addLineBtn.addEventListener("click", () => {
      state.lines.push([{text:"WORD", color:"White", colorMode:"preset", customHex:"#ffffff", scale:1, dx:0, dy:0}]);
      state.sel = {li: state.lines.length-1, wi: 0};
      const r = canvas.getBoundingClientRect();
      openInspector(state.sel.li, state.sel.wi, r.left+20, r.top+20);
    });
    addWordBtn.addEventListener("click", () => {
      const li = state.sel.li ?? 0;
      if (!state.lines[li]) state.lines[li]=[];
      state.lines[li].push({text:"WORD", color:"White", colorMode:"preset", customHex:"#ffffff", scale:1, dx:0, dy:0});
      state.sel = {li, wi: state.lines[li].length-1};
      const r = canvas.getBoundingClientRect();
      openInspector(li, state.sel.wi, r.left+20, r.top+20);
    });

    autoSizeToggle.addEventListener("change", () => state.autoSize = !!autoSizeToggle.checked);
    lineGap.addEventListener("input", () => state.lineGap = +lineGap.value || 2);
    wordSpace.addEventListener("input", () => state.wordSpace = +wordSpace.value || 3);

    animEnableBreath.addEventListener("change", () => state.animEnableBreath = !!animEnableBreath.checked);
    animEnableWave.addEventListener("change",   () => state.animEnableWave = !!animEnableWave.checked);
    animEnableJitter.addEventListener("change", () => state.animEnableJitter = !!animEnableJitter.checked);

    [animBY,animSC,animBC,animWX,animWY,animWC,animJJ,animJC].forEach(inp => {
      inp.addEventListener("input", ()=>{});
    });

    seconds.addEventListener("input", () => state.seconds = Math.max(1, Math.min(30, +seconds.value||8)));
    fps.addEventListener("input", () => state.fps = Math.max(1, Math.min(30, +fps.value||15)));
    autoMatch.addEventListener("change", () => state.autoMatch = !!autoMatch.checked);
    gifPalette.addEventListener("input", () => { gifPaletteVal.textContent = gifPalette.value; });

    downloadPresetBtn.addEventListener("click", () => {
      const payload = buildPresetSnapshot();
      const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "led_preset.json";
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    });
    uploadPresetInput.addEventListener("change", e => {
      const f = e.target.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try{ const d=JSON.parse(r.result); applyPresetSnapshot(d); } catch(e){} };
      r.readAsText(f);
    });

    exportBundleBtn.addEventListener("click", async () => {
      const zip = new JSZip();
      const data = buildPresetSnapshot();
      zip.file("led_preset.json", JSON.stringify(data,null,2));
      if (data.bgSource==="Preset" && data.bgChoice){
        const path=(ASSETS[state.resMode]||{})[data.bgChoice];
        if (path){ const resp=await fetch(path); zip.file(path, await resp.arrayBuffer()); }
      }
      if (data.bgSource==="Custom" && state.customBgBytes){
        zip.file("assets/CustomBg.bin", state.customBgBytes);
      }
      const blob = await zip.generateAsync({type:"blob"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="led_bundle.zip"; a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    });
  }

  function buildPresetSnapshot(){
    return {
      resMode: state.resMode, W:state.W, H:state.H,
      bgSource: state.bgSource, bgChoice: state.bgChoice,
      solidHex: state.solidHex,
      customBgBase64: state.customBgBytes ? btoa(String.fromCharCode(...new Uint8Array(state.customBgBytes))) : null,
      customBgIsGif: state.customBgIsGif,
      lines: state.lines,
      anim: state.anim,
      animEnableBreath: state.animEnableBreath,
      animEnableWave: state.animEnableWave,
      animEnableJitter: state.animEnableJitter,
      autoSize: state.autoSize,
      lineGap: state.lineGap,
      wordSpace: state.wordSpace,
      seconds: state.seconds,
      fps: state.fps,
      autoMatch: state.autoMatch
    };
  }

  function applyPresetSnapshot(d){
    state.resMode = d.resMode || state.resMode;
    state.W = d.W || state.W; state.H = d.H || state.H;
    state.bgSource = d.bgSource || state.bgSource;
    state.bgChoice = d.bgChoice || state.bgChoice;
    state.solidHex = d.solidHex || state.solidHex;

    state.customBgBytes = d.customBgBase64 ? Uint8Array.from(atob(d.customBgBase64), c=>c.charCodeAt(0)).buffer : null;
    state.customBgIsGif = !!d.customBgIsGif;

    if (Array.isArray(d.lines)) state.lines = d.lines;
    state.anim = Object.assign(state.anim, d.anim || {});
    state.animEnableBreath = d.animEnableBreath ?? state.animEnableBreath;
    state.animEnableWave   = d.animEnableWave   ?? state.animEnableWave;
    state.animEnableJitter = d.animEnableJitter ?? state.animEnableJitter;

    state.autoSize = d.autoSize ?? state.autoSize;
    state.lineGap  = d.lineGap  ?? state.lineGap;
    state.wordSpace= d.wordSpace?? state.wordSpace;

    state.seconds  = d.seconds  ?? state.seconds;
    state.fps      = d.fps      ?? state.fps;
    state.autoMatch= d.autoMatch?? state.autoMatch;

    resolutionSel.value = state.resMode;
    customRes.style.display = (state.resMode==="Custom")?"flex":"none";
    customW.value = state.W; customH.value = state.H;
    resizeCanvas();
    refreshPresetGrid();
    loadPresetBg();
  }

  function init(){
    resizeCanvas();
    setBgSource("Preset");
    refreshPresetGrid();
    loadPresetBg();
    bindEvents();
    requestAnimationFrame(draw);
    helpToggle.checked = localStorage.getItem("helpOn")==="1";
    helpOverlay.hidden = !helpToggle.checked;
    playBtn.classList.add("on");
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();