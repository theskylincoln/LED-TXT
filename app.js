const ASSETS = {
  "96×128": {
    "Wheelie (96×128)": "assets/Preset_A.png",
    "2 Up (96×128)":    "assets/Preset_B.png",
  },
  "64×64": {
    "Wheelie (64×64)":  "assets/Preset_C.png",
    "2 Up (64×64)":     "assets/Preset_D.png",
  }
};
const PRESET_HEX = {
  Blue:"#008cff", Green:"#00d200", Yellow:"#ffd700", Magenta:"#ff3cc8", Red:"#ff2828",
  Orange:"#ff7f00", White:"#ffffff", Cyan:"#00ffff", Purple:"#8a2be2", Pink:"#ff69b4"
};
const state = {
  resMode:"96×128", W:96, H:128,
  bgSource:"Preset", bgChoice:"Wheelie (96×128)", solidHex:"#000000", customBgBytes:null,
  playing:true, zoom:3, editMode:false,
  lines:[
    [ {text:"WILL", color:"Blue", colorMode:"preset", customHex:"#008cff", scale:1, dx:0, dy:0} ],
    [ {text:"WHEELIE", color:"Green", colorMode:"preset", customHex:"#00d200", scale:1, dx:0, dy:0} ],
    [ {text:"FOR", color:"Yellow", colorMode:"preset", customHex:"#ffd700", scale:1, dx:0, dy:0} ],
    [ {text:"BOOKTOK", color:"Magenta", colorMode:"preset", customHex:"#ff3cc8", scale:1, dx:0, dy:0} ],
    [ {text:"GIRLIES", color:"Red", colorMode:"preset", customHex:"#ff2828", scale:1, dx:0, dy:0} ],
  ],
  sel:{li:0, wi:0},
  anim:{ BREATH_Y_AMPL:4.0, SCALE_AMPL:0.03, BREATH_CYCLES:1.0, WAVE_X_AMPL:0.8, WAVE_Y_AMPL:1.4, WAVE_CYCLES:1.0, JITTER_AMPL:0.10, JITTER_CYCLES:2.5 },
  autoSize:true, lineGap:2, wordSpace:3,
  seconds:8, fps:15, autoMatch:true,
  ui:{ showGuides:false, snapEnabled:true, snapPx:8 },
  ownerUnlocked:false,
};
const q = sel=>document.querySelector(sel);
const resolutionSel = q("#resolutionSel");
const customRes = q("#customRes");
const customW = q("#customW");
const customH = q("#customH");
const bgPresetGrid = q("#bgPresetGrid");
const solidColor = q("#solidColor");
const customBgInput = q("#customBgInput");
const helpToggle = q("#helpToggle");
const helpOverlay = q("#helpOverlay");
const ownerKey = q("#ownerKey");
const playPauseBtn = q("#playPauseBtn");
const editToggle = q("#editModeToggle");
const zoomInBtn = q("#zoomInBtn");
const zoomOutBtn = q("#zoomOutBtn");
const zoomFitBtn = q("#zoomFitBtn");
const addLineBtn = q("#addLineBtn");
const addWordBtn = q("#addWordBtn");
const downloadPresetBtn = q("#downloadPresetBtn");
const uploadPresetInput = q("#uploadPresetInput");
const exportBundleBtn = q("#exportBundleBtn");
const renderBtn = q("#renderBtn");
const ins = {
  el: q("#inspector"),
  label: q("#insLabel"),
  done: q("#insDone"),
  text: q("#insText"),
  color: q("#insColor"),
  size: q("#insSize"),
  nL: q("#nudgeL"), nU:q("#nudgeU"), nD:q("#nudgeD"), nR:q("#nudgeR"),
  delBtn: q("#deleteWordBtn")
};
const canvas = q("#previewCanvas"); const ctx = canvas.getContext("2d");

function resizeCanvas(){ canvas.width=state.W; canvas.height=state.H; canvas.style.width=(state.W*state.zoom)+"px"; canvas.style.height=(state.H*state.zoom)+"px"; }
function refreshPresetGrid(){
  bgPresetGrid.innerHTML=""; if(state.resMode==="Custom") return;
  const group = ASSETS[state.resMode]||{};
  Object.entries(group).forEach(([name, path])=>{
    const div = document.createElement("div");
    div.className = "thumb" + (state.bgChoice===name ? " selected": "");
    const img = new Image(); img.src = path; img.width = 96; img.height = state.resMode==="96×128"?128:64;
    div.appendChild(img); div.title=name;
    div.onclick = ()=>{ state.bgSource="Preset"; state.bgChoice=name; if(state.ownerUnlocked && state.resMode==="96×128"){ if(name.includes("Wheelie")) ownerPhraseA(); if(name.includes("2 Up")) ownerPhraseB(); } refreshPresetGrid(); };
    bgPresetGrid.appendChild(div);
  });
}
function ownerPhraseA(){ state.lines=[[{text:"WILL",color:"Blue",colorMode:"preset",customHex:"#008cff",scale:1,dx:0,dy:0}], [{text:"WHEELIE",color:"Green",colorMode:"preset",customHex:"#00d200",scale:1,dx:0,dy:0}], [{text:"FOR",color:"Yellow",colorMode:"preset",customHex:"#ffd700",scale:1,dx:0,dy:0}], [{text:"BOOKTOK",color:"Magenta",colorMode:"preset",customHex:"#ff3cc8",scale:1,dx:0,dy:0}], [{text:"GIRLIES",color:"Red",colorMode:"preset",customHex:"#ff2828",scale:1,dx:0,dy:0}],]; }
function ownerPhraseB(){ state.lines=[[{text:"FREE",color:"Blue",colorMode:"preset",customHex:"#008cff",scale:1,dx:0,dy:0}], [{text:"RIDES",color:"Green",colorMode:"preset",customHex:"#00d200",scale:1,dx:0,dy:0}], [{text:"FOR",color:"Yellow",colorMode:"preset",customHex:"#ffd700",scale:1,dx:0,dy:0}], [{text:"BOOKTOK",color:"Magenta",colorMode:"preset",customHex:"#ff3cc8",scale:1,dx:0,dy:0}], [{text:"GIRLIES",color:"Red",colorMode:"preset",customHex:"#ff2828",scale:1,dx:0,dy:0}],]; }
let bgImg=null; async function getBackground(){ if(state.bgSource==="Solid"){ bgImg=null; } else if(state.bgSource==="Custom"){ bgImg=null; } else { const path=(ASSETS[state.resMode]||{})[state.bgChoice]; bgImg = path? await loadImage(path): null; } }
function loadImage(src){ return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src; }); }
function colorToHex(seg){ return seg.colorMode==="preset" ? (PRESET_HEX[seg.color] || "#ffffff") : (seg.customHex||"#ffffff"); }
function fitLineFontSize(words, W, H, lineGap){ const text=words.map(w=>w.text).join(" "); if(!text) return 20; let lo=6, hi=200; while(lo<hi){ const mid=Math.floor((lo+hi+1)/2); ctx.font=`bold ${mid}px sans-serif`; const width=ctx.measureText(text).width; const totalH=mid*1.1; if(width<=W*0.96 && totalH<=H) lo=mid; else hi=mid-1; } return lo; }
function measureLinesAndPositions(){ const W=state.W, H=state.H; const lineHeights=[], lineTexts=[]; for(const line of state.lines){ const text=line.map(w=>w.text).join(" "); let size=24; if(state.autoSize) size=fitLineFontSize(line,W,H,state.lineGap); lineTexts.push({text,size}); lineHeights.push(size*1.1); }
  const totalH=lineHeights.reduce((a,b)=>a+b,0)+state.lineGap*(lineHeights.length-1); let y=(H-totalH)/2; const ys=[]; for(const h of lineHeights){ ys.push(y); y+=h+state.lineGap; } return {lineTexts, lineHeights, ys}; }
function draw(){ if(state.playing){ ctx.clearRect(0,0,canvas.width, canvas.height); if(state.bgSource==="Solid"){ ctx.fillStyle=state.solidHex; ctx.fillRect(0,0,canvas.width,canvas.height); } else if(bgImg){ ctx.drawImage(bgImg,0,0,canvas.width,canvas.height); } else { ctx.fillStyle="#000"; ctx.fillRect(0,0,canvas.width,canvas.height); } const {lineTexts, ys}=measureLinesAndPositions(); for(let li=0; li<state.lines.length; li++){ const line=state.lines[li]; const size=lineTexts[li].size; ctx.font=`bold ${size}px sans-serif`; let cx = Math.round((state.W - ctx.measureText(line.map(w=>w.text).join(" ")).width)/2); const y=Math.round(ys[li]); for(const seg of line){ const segtxt=seg.text; const segw=ctx.measureText(segtxt+" ").width; ctx.fillStyle=colorToHex(seg); ctx.fillText(segtxt, cx+(seg.dx||0), y+size+(seg.dy||0)); cx += segw + state.wordSpace; } } if(state.ui.showGuides){ ctx.save(); ctx.globalAlpha=.35; ctx.strokeStyle='rgba(0,255,225,.8)'; ctx.beginPath(); ctx.moveTo(state.W/2,0); ctx.lineTo(state.W/2,state.H); ctx.stroke(); ctx.strokeStyle='rgba(255,60,200,.8)'; ctx.beginPath(); ctx.moveTo(0,state.H/2); ctx.lineTo(state.W,state.H/2); ctx.stroke(); ctx.restore(); } }
  requestAnimationFrame(draw); }
function openInspector(li, wi, clientX, clientY){ state.sel={li,wi}; const seg=state.lines[li][wi]; ins.text.value=seg.text; ins.color.value=(seg.colorMode==="preset")?(PRESET_HEX[seg.color]||"#ffffff"):(seg.customHex||"#ffffff"); ins.size.value=24; ins.el.hidden=false; const r=canvas.getBoundingClientRect(); const left=Math.min(Math.max(12, clientX|| (r.left+r.width/2)), r.right-272); const top=Math.max(12, (clientY|| (r.top+24))); ins.el.style.left=left+'px'; ins.el.style.top=top+'px'; }
function closeInspector(){ ins.el.hidden=true; }
canvas.addEventListener("click",(ev)=>{ if(!state.editMode) return; const li=Math.min(state.sel.li, state.lines.length-1); const wi=Math.min(state.sel.wi, state.lines[li].length-1); openInspector(li, wi, ev.clientX, ev.clientY); });
ins.done.onclick=()=>closeInspector();
ins.text.oninput = ()=>{ const {li,wi}=state.sel; if(li==null||wi==null) return; state.lines[li][wi].text = ins.text.value.toUpperCase(); };
ins.color.oninput= ()=>{ const {li,wi}=state.sel; if(li==null||wi==null) return; state.lines[li][wi].colorMode="custom"; state.lines[li][wi].customHex=ins.color.value; };
ins.nL.onclick = ()=>{ const s=state.sel; if(state.lines[s.li][s.wi]) state.lines[s.li][s.wi].dx=(state.lines[s.li][s.wi].dx||0)-1; };
ins.nR.onclick = ()=>{ const s=state.sel; if(state.lines[s.li][s.wi]) state.lines[s.li][s.wi].dx=(state.lines[s.li][s.wi].dx||0)+1; };
ins.nU.onclick = ()=>{ const s=state.sel; if(state.lines[s.li][s.wi]) state.lines[s.li][s.wi].dy=(state.lines[s.li][s.wi].dy||0)-1; };
ins.nD.onclick = ()=>{ const s=state.sel; if(state.lines[s.li][s.wi]) state.lines[s.li][s.wi].dy=(state.lines[s.li][s.wi].dy||0)+1; };
ins.delBtn.onclick= ()=>{ const {li,wi}=state.sel; if(li==null||wi==null) return; state.lines[li].splice(wi,1); if(state.lines[li].length===0) state.lines.splice(li,1); closeInspector(); };
document.querySelectorAll('input[name="bgsrc"]').forEach(r=>{ r.onchange=()=>{ state.bgSource=r.value; solidColor.style.display=(r.value==="Solid")?"block":"none"; customBgInput.style.display=(r.value==="Custom")?"block":"none"; getBackground(); }; });
solidColor.oninput= ()=>{ state.solidHex=solidColor.value; };
customBgInput.onchange = async (e)=>{ const f=e.target.files?.[0]; if(!f) return; state.customBgBytes=await f.arrayBuffer(); };
helpToggle.onchange = ()=>{ helpOverlay.hidden=!helpToggle.checked; localStorage.setItem("helpOn", helpToggle.checked? "1":"0"); };
helpToggle.checked = localStorage.getItem("helpOn")==="1"; helpOverlay.hidden = !helpToggle.checked;
ownerKey.onchange = ()=>{ state.ownerUnlocked = (ownerKey.value.trim().toLowerCase()==="abraham"); };
resolutionSel.onchange = ()=>{ state.resMode=resolutionSel.value; if(state.resMode==="96×128"){ state.W=96; state.H=128; } else if(state.resMode==="64×64"){ state.W=64; state.H=64; } customRes.style.display=(state.resMode==="Custom")? "flex":"none"; if(state.resMode!=="Custom"){ const group=ASSETS[state.resMode]; state.bgChoice=Object.keys(group)[0]; if(state.resMode==="96×128"){ ownerPhraseA(); } } resizeCanvas(); refreshPresetGrid(); getBackground(); };
customW.oninput= ()=>{ state.W=Math.max(8,Math.min(512,+customW.value||96)); resizeCanvas(); };
customH.oninput= ()=>{ state.H=Math.max(8,Math.min(512,+customH.value||128)); resizeCanvas(); };
playPauseBtn.onclick= ()=>{ state.playing=!state.playing; playPauseBtn.textContent= state.playing? "⏸ Pause":"▶️ Play"; };
editToggle.onchange = ()=>{ state.editMode=editToggle.checked; if(state.editMode && state.playing) playPauseBtn.click(); if(!state.editMode && !state.playing) playPauseBtn.click(); };
zoomInBtn.onclick = ()=>{ state.zoom=Math.min(6, state.zoom+1); resizeCanvas(); };
zoomOutBtn.onclick= ()=>{ state.zoom=Math.max(2, state.zoom-1); resizeCanvas(); };
zoomFitBtn.onclick= ()=>{ state.zoom=(state.resMode==="96×128")?3:4; resizeCanvas(); };
addLineBtn.onclick = ()=>{ state.lines.push([ {text:"WORD",color:"White",colorMode:"preset",customHex:"#ffffff",scale:1,dx:0,dy:0} ]); state.sel={li:state.lines.length-1, wi:0}; openInspector(state.sel.li, state.sel.wi, canvas.getBoundingClientRect().left+20, canvas.getBoundingClientRect().top+20); };
addWordBtn.onclick = ()=>{ const li=state.sel.li??0; if(!state.lines[li]) state.lines[li]=[]; state.lines[li].push({text:"WORD",color:"White",colorMode:"preset",customHex:"#ffffff",scale:1,dx:0,dy:0}); state.sel={li, wi:state.lines[li].length-1}; openInspector(li, state.sel.wi, canvas.getBoundingClientRect().left+20, canvas.getBoundingClientRect().top+20); };
function buildPresetSnapshot(){ return { resMode:state.resMode, W:state.W, H:state.H, bgSource:state.bgSource, bgChoice:state.bgChoice, solidHex:state.solidHex, customBgBase64: state.customBgBytes? btoa(String.fromCharCode(...new Uint8Array(state.customBgBytes))): null, lines:state.lines, anim:state.anim, autoSize:state.autoSize, lineGap:state.lineGap, wordSpace:state.wordSpace, seconds:state.seconds, fps:state.fps, autoMatch:state.autoMatch }; }
function exportPresetJSON(){ const blob=new Blob([JSON.stringify(buildPresetSnapshot(),null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="led_preset.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
async function exportBundleZip(){ const zip=new JSZip(); const data=buildPresetSnapshot(); zip.file("led_preset.json", JSON.stringify(data,null,2)); if(data.bgSource==="Preset" && data.bgChoice){ const path=(ASSETS[state.resMode]||{})[data.bgChoice]; if(path){ const resp=await fetch(path); zip.file(path, await resp.arrayBuffer()); } } if(data.bgSource==="Custom" && state.customBgBytes){ zip.file("assets/CustomBg.bin", state.customBgBytes); } const blob=await zip.generateAsync({type:"blob"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="led_bundle.zip"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
downloadPresetBtn.onclick=exportPresetJSON;
exportBundleBtn.onclick=exportBundleZip;
uploadPresetInput.addEventListener("change",(e)=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const d=JSON.parse(r.result); Object.assign(state,{ resMode:d.resMode||state.resMode, W:d.W||state.W, H:d.H||state.H, bgSource:d.bgSource||state.bgSource, bgChoice:d.bgChoice||state.bgChoice, solidHex:d.solidHex||state.solidHex, lines:Array.isArray(d.lines)?d.lines:state.lines, anim:Object.assign(state.anim,d.anim||{}), autoSize:d.autoSize??state.autoSize, lineGap:d.lineGap??state.lineGap, wordSpace:d.wordSpace??state.wordSpace, seconds:d.seconds??state.seconds, fps:d.fps??state.fps, autoMatch:d.autoMatch??state.autoMatch }); if(d.customBgBase64){ const bin=Uint8Array.from(atob(d.customBgBase64), c=>c.charCodeAt(0)); state.customBgBytes=bin.buffer; } resolutionSel.value=state.resMode; customRes.style.display=(state.resMode==="Custom")?"flex":"none"; customW.value=state.W; customH.value=state.H; resizeCanvas(); refreshPresetGrid(); getBackground(); }catch(err){ console.error(err); } }; r.readAsText(f); });
resizeCanvas(); refreshPresetGrid(); getBackground(); requestAnimationFrame(function loop(){ draw(); });