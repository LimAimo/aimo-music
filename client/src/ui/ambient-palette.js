// 从许可跨域读取的封面提取轻量色板；无 CORS 时优雅退回到封面模糊背景。
const memo=new Map();
const safe=s=>/^https?:\/\//i.test(String(s||''))?s:null;
const rgb=(r,g,b)=>`rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
function fallback(key){
 let code=0;for(const ch of key)code=(code*33+ch.charCodeAt(0))>>>0;
 const hues=[code%360,(code*7+85)%360,(code*13+170)%360];
 return hues.map((h,i)=>`hsl(${h},${i===0?35:40}%,${i===0?35:42}%)`);
}
function extract(url){
 if(!safe(url))return Promise.resolve(fallback(String(url||'')));
 if(memo.has(url))return memo.get(url);
 const promise=new Promise(resolve=>{
  const image=new Image();image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';
  let finished=false;
  const end=colors=>{if(finished)return;finished=true;clearTimeout(timer);image.onload=image.onerror=null;resolve(colors);};
  const timer=setTimeout(()=>{image.src='';end(fallback(url));},4500);
  image.onerror=()=>end(fallback(url));
  image.onload=()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,20,20);
    const data=ctx.getImageData(0,0,20,20).data;
    const bins=new Map(),pixels=[];
    for(let i=0;i<data.length;i+=4){
     const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
     if(a<200)continue;
     const brightness=(r+g+b)/3;
     if(brightness<20||brightness>242)continue;
     const range=([r,g,b].map(x=>Math.floor(x/48)).join('-'));
     const group=bins.get(range)||{count:0,r:0,g:0,b:0};
     group.count++;group.r+=r;group.g+=g;group.b+=b;bins.set(range,group);
     pixels.push([r,g,b]);
    }
    const best=[...bins.values()].sort((a,b)=>b.count-a.count).slice(0,3);
    if(!best.length)return end(fallback(url));
    const selected=best.map(v=>rgb(v.r/v.count,v.g/v.count,v.b/v.count));
    while(selected.length<3)selected.push(selected[0]);
    end(selected);
   }catch{end(fallback(url));}
  };
  image.src=url;
 });
 memo.set(url,promise);
 if(memo.size>90)memo.delete(memo.keys().next().value);
 return promise;
}
export function applyAmbientPalette(cover,element){
 if(!element||element.dataset.ambient==='off')return;
 const url=safe(cover);if(!url)return;
 element.dataset.ambientImage=url;
 void extract(url).then(colors=>{
  if(!element.isConnected||element.dataset.ambient==='off'||element.dataset.ambientImage!==url)return;
  colors.forEach((c,i)=>element.style.setProperty('--ambient-tone-'+i,c));
 });
}
