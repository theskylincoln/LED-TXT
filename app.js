window.addEventListener('error', e => alert('JS error: ' + (e?.error?.message || 

/* =======================================================
   LED Backpack Animator — app.js (Part 1 of 3)
   Boot / UI wiring / background presets / zoom & inspector
   ======================================================= */

/* ---------- helpers ---------- */
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ---------- DOM ---------- */
const canvas  = $("#led"),
      ctx     = canvas.getContext("2d"),
      wrap    = $(".canvas-wrap");

const resSel  = $("#resSelect"),
      zoomSlider = $("#zoom"),
      fitBtn  = $("#fitBtn");

const modeEditBtn   = $("#modeEdit"),
      modePrevBtn   = $("#modePreview"),
      inspectorToggle = $("#toggleInspector"),
      inspectorBody   = $("#inspectorBody");

const pillTabs  = $$(".pill[data-acc]");
const accFont   = $("#accFont"),
      accLayout = $("#accLayout"),
      accAnim   = $("#accAnim");

const bgGrid  = $("#bgGrid"),
      bgSolidTools = $("#bgSolidTools"),
      bgSolidColor = $("#bgSolidColor"),
      addBgSwatchBtn = $("#addBgSwatchBtn"),
      bgSwatches = $("#bgSwatches"),
      bgUpload   = $("#bgUpload");

const progressBar = $("#progress"),
      tCur = $("#tCur"),
      tEnd = $("#tEnd");

/* ---------- state ---------- */
let mode = "edit";
let zoom = 1;
let selected = null;

const defaults = {
  font: "Orbitron",
  size: 22,
  color: "#FFFFFF",
  lineGap: 4,
  wordGap: 6,
  align: "center",
  valign: "middle"
};

const doc = {
  res: { w:96, h:128 },
  lines: [
    { words:[{text:"HELLO", color:"#FFFFFF", font:"Orbitron", size:22}] }
  ],
  bg: { type:"image", image:null, preset:"assets/presets/96x128/Preset_A.png", color:null },
  spacing:{ lineGap:4, wordGap:6 },
  anims: [],
  multi:new Set()
};

/* ---------- Background presets ---------- */
const PRESETS = {
  "96x128": [
    { id:"A", thumb:"assets/thumbs/Preset_A_thumb.png", full:"assets/presets/96x128/Preset_A.png" },
    { id:"B", thumb:"assets/thumbs/Preset_B_thumb.png", full:"assets/presets/96x128/Preset_B.png" }
  ],
  "64x64": [
    { id:"C", thumb:"assets/thumbs/Preset_C_thumb.png", full:"assets/presets/64x64/Preset_C.png" },
    { id:"D", thumb:"assets/thumbs/Preset_D_thumb.png", full:"assets/presets/64x64/Preset_D.png" }
  ]
};
function visibleSet(){ return PRESETS[`${doc.res.w}x${doc.res.h}`] || []; }

function showSolidTools(show){ bgSolidTools.classList.toggle("hidden", !show); }

function buildBgGrid(){
  bgGrid.innerHTML = "";
  const set = visibleSet();
  const tiles = [
    set[0] && { ...set[0], kind:"preset" },
    set[1] && { ...set[1], kind:"preset" },
    { kind:"solid",  thumb:"assets/thumbs/Solid_thumb.png" },
    { kind:"upload", thumb:"assets/thumbs/Upload_thumb.png" }
  ].filter(Boolean);

  tiles.forEach(t=>{
    const b=document.createElement("button");
    b.type="button"; b.className="bg-tile"; b.dataset.kind=t.kind;
    const img=document.createElement("img");
    img.src=t.thumb; img.alt=t.kind;
    b.appendChild(img);

    on(b,"click",async()=>{
      $$(".bg-tile",bgGrid).forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      if(t.kind==="preset"){
        const im=new Image(); im.crossOrigin="anonymous"; im.src=t.full;
        try{await im.decode();}catch{}
        doc.bg={type:"image",color:null,image:im,preset:t.full};
        showSolidTools(false);
        render();
      }else if(t.kind==="solid"){
        doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null};
        showSolidTools(true);
        render();
      }else if(t.kind==="upload"){
        bgUpload.click();
      }
    });
    bgGrid.appendChild(b);
  });
  const first=$(".bg-tile",bgGrid);
  if(first) first.classList.add("active");
}
on(bgUpload,"change",e=>{
  const f=e.target.files?.[0]; if(!f)return;
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=()=>{URL.revokeObjectURL(url);
    doc.bg={type:"image",color:null,image:im,preset:null};
    showSolidTools(false); render();
  };
  im.src=url;
});

/* ---------- zoom / fit ---------- */
function setZoom(z){
  zoom=z; zoomSlider.value=String(z.toFixed(2));
  canvas.style.transform=`translate(-50%,-50%) scale(${z})`;
}
function fitZoom(){
  const pad=18, r=wrap.getBoundingClientRect();
  const availW=Math.max(40,r.width-pad*2);
  const availH=Math.max(40,r.height-pad*2);
  const s=Math.max(0.1,Math.min(availW/doc.res.w,availH/doc.res.h));
  setZoom(s);
}
on(zoomSlider,"input",e=>setZoom(parseFloat(e.target.value)));
on(fitBtn,"click",fitZoom);
window.addEventListener("resize",fitZoom);
window.addEventListener("orientationchange",()=>setTimeout(fitZoom,200));

/* ---------- inspector pills ---------- */
on(inspectorToggle,"click",()=>{
  const open=!inspectorBody.classList.contains("open");
  inspectorBody.classList.toggle("open",open);
  inspectorToggle.setAttribute("aria-expanded",String(open));
});
pillTabs.forEach(p=>{
  on(p,"click",()=>{
    const id=p.dataset.acc;
    [accFont,accLayout,accAnim].forEach(a=>a.open=a.id===id);
    pillTabs.forEach(x=>x.classList.toggle("active",x===p));
    inspectorBody.classList.add("open");
    inspectorToggle.setAttribute("aria-expanded","true");
  });
});

/* ---------- background color swatches ---------- */
const defaultPalette=["#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#000000"];
let customBgPalette=[];
function rebuildBgSwatches(){
  bgSwatches.innerHTML="";
  [...defaultPalette,...customBgPalette].forEach(c=>{
    const b=document.createElement("button");
    b.className="swatch"; b.style.background=c;
    b.addEventListener("click",()=>{
      doc.bg={type:"solid",color:c,image:null,preset:null};
      showSolidTools(true); render();
    });
    bgSwatches.appendChild(b);
  });
}
on(addBgSwatchBtn,"click",()=>{
  const c=bgSolidColor.value;
  if(!defaultPalette.includes(c)&&!customBgPalette.includes(c)) customBgPalette.push(c);
  rebuildBgSwatches();
});
on(bgSolidColor,"input",()=>{
  doc.bg={type:"solid",color:bgSolidColor.value,image:null,preset:null};
  render();
});

/* ---------- rendering ---------- */
function render(){
  canvas.width=doc.res.w; canvas.height=doc.res.h;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(doc.bg.type==="solid"){
    ctx.fillStyle=doc.bg.color||"#000"; ctx.fillRect(0,0,canvas.width,canvas.height);
  }else if(doc.bg.image){
    try{ctx.drawImage(doc.bg.image,0,0,canvas.width,canvas.height);}catch{}
  }else if(doc.bg.preset){
    const im=new Image(); im.crossOrigin="anonymous"; im.src=doc.bg.preset;
    im.onload=()=>{doc.bg.image=im; render();};
  }
}

/* ---------- resolution change ---------- */
on(resSel,"change",()=>{
  const [w,h]=resSel.value.split("x").map(Number);
  doc.res={w,h};
  buildBgGrid(); showSolidTools(doc.bg?.type==="solid");
  render(); fitZoom();
});

/* ---------- mode buttons ---------- */
function setMode(m){
  mode=m;
  modeEditBtn.classList.toggle("active",m==="edit");
  modePrevBtn.classList.toggle("active",m!=="edit");
}
on(modeEditBtn,"click",()=>setMode("edit"));
on(modePrevBtn,"click",()=>setMode("preview"));

/* ---------- init ---------- */
function init(){
  buildBgGrid();
  rebuildBgSwatches();
  render();
  fitZoom();
  accFont.open=true;
}
init();
