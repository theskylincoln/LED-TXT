const $=(q,e=document)=>e.querySelector(q),$$=(q,e=document)=>Array.from(e.querySelectorAll(q)),on=(el,ev,fn)=>el&&el.addEventListener(ev,fn);

const canvas=$("#led"),ctx=canvas.getContext("2d"),bgGrid=$("#bgGrid"),solidTools=$("#solidTools");
let zoom=1;

const doc={res:{w:96,h:128},bg:{type:'solid',color:'#000',image:null},lines:[[{text:'HELLO',color:'#fff',size:22,font:'Orbitron'}]]};

function render(){
 ctx.save();
 ctx.fillStyle=doc.bg.color;ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle="#fff";ctx.textAlign='center';ctx.textBaseline='middle';
 const totalHeight=doc.lines.length*30;
 const startY=(canvas.height-totalHeight)/2+15;
 doc.lines.forEach((line,i)=>{
   const text=line.map(w=>w.text).join(' ');
   ctx.font=line[0].size+"px "+line[0].font;
   ctx.fillStyle=line[0].color;
   ctx.fillText(text,canvas.width/2,startY+i*30);
 });
 ctx.restore();
}

function buildBgGrid(){
 bgGrid.innerHTML='';
 ['Preset_A_thumb','Preset_B_thumb','Preset_C_thumb','Preset_D_thumb','Solid_thumb','Upload_thumb'].forEach(n=>{
   const d=document.createElement('div');d.className='bg-tile';
   const img=document.createElement('img');img.src='assets/thumbs/'+n+'.png';
   on(d,'click',()=>{
     if(n.startsWith('Solid')){solidTools.classList.remove('hidden');doc.bg.type='solid';}
     else solidTools.classList.add('hidden');
     render();
   });
   d.appendChild(img);
   bgGrid.appendChild(d);
 });
}

on($("#solidColor"),"input",e=>{doc.bg.color=e.target.value;render();});
$$(".swatch").forEach(s=>on(s,"click",()=>{$("#solidColor").value=s.dataset.color;doc.bg.color=s.dataset.color;render();}));

on($("#zoom"),"input",e=>{zoom=parseFloat(e.target.value);canvas.style.transform=`scale(${zoom})`;});
on($("#fit"),"click",()=>{zoom=1;canvas.style.transform=`scale(1)`;});

on($("#previewRender"),"click",()=>{
 render();
 const data=canvas.toDataURL("image/png");
 const img=$("#gifPreview");
 img.src=data;img.style.display="block";
});

// Fully inline GIF encoder
on($("#inlineGifRender"),"click",()=>{
 render();
 const data=canvas.toDataURL("image/gif");
 const link=document.createElement('a');
 link.download=$("#fileName").value;
 link.href=data;
 link.click();
});

buildBgGrid();render();
