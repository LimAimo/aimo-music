import {decodeShare,shareUrl,normalizeShare,posterLayout} from '../core/share.js';
import {icon} from './icons.js';
import {extractAmbientColors} from './ambient-palette.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const posterTitle=d=>d.title||d.track?.title||d.playlist?.title||'我的音乐';
const posterArtist=d=>d.subtitle||d.track?.artist||'';
const posterDescription=d=>d.description||d.track?.description||'';
const posterAlbum=d=>d.track?.album||'';
const coverUrl=d=>d.cover||d.track?.cover||d.playlist?.cover||'';
const promptFor=d=>d.type==='song'||d.type==='lyrics'?'打开 AimoMusic 听音乐 ↗':'打开 AimoMusic ↗';

export function cardMarkup(input){
 const data=normalizeShare(input),s=data.style,{density,coverFraction}=posterLayout(data);
 const cover=coverUrl(data);
 const coverHtml=/^https:\/\//.test(cover)?`<img src="${e(cover)}" alt="音乐封面" crossorigin="anonymous">`:'<span class="share-art-placeholder" aria-label="暂无封面">♪</span>';
 const description=posterDescription(data),album=posterAlbum(data);
 const extras=data.type==='lyrics'?`<div class="share-card-lines">${(data.lines||[]).map(line=>`<p>${e(line)}</p>`).join('')}</div>`:
  data.type==='stats'?`<div class="share-card-stats">${(data.stats||[]).map(row=>`<div><strong>${e(row.value)}</strong><small>${e(row.label)}</small></div>`).join('')}</div>`:'';
 const target=data.type==='song'||data.type==='lyrics'?'歌曲':data.type==='playlist'?'歌单':'统计';
 return `<article class="share-card share-card--poster share-card--${density}" data-kind="${data.type}" style="--share-color:${s.color};--share-color-2:${s.color2};--share-color-3:${s.color3};--poster-art:${Math.round(coverFraction*100)}%" aria-label="${target}分享卡片">
  <div class="share-card-inner">
   <div class="share-card-art">${coverHtml}</div>
   <div class="share-card-text">
    <h2>${e(posterTitle(data))}</h2>
    ${posterArtist(data)?`<p class="share-card-artist">${e(posterArtist(data))}</p>`:''}
    ${description?`<p class="share-card-description">${e(description)}</p>`:''}
    ${album?`<p class="share-card-album"><span>专辑</span>${e(album)}</p>`:''}
    ${extras}
   </div>
   <div class="share-card-foot"><span class="share-card-brand"><img src="/favicon.svg" alt="" width="20" height="20"><strong>AimoMusic</strong></span><span class="share-card-url">${e(promptFor(data))}</span></div>
  </div>
 </article>`;
}
export function shareEditorMarkup(data){
 return `<div class="share-modal-backdrop" data-share-backdrop><section class="share-modal" role="dialog" aria-modal="true" aria-label="音乐分享">
  <header class="share-modal-header"><h2>分享音乐</h2><button type="button" class="share-icon-btn" data-share-action="close" aria-label="关闭">${icon('close',20)}</button></header>
  <div class="share-modal-body"><div class="share-preview-wrap"><div class="share-preview" id="share-preview">${cardMarkup(data)}</div></div></div>
  <div class="share-inline-confirm" data-share-confirm hidden role="group" aria-label="确认分享"><p>任何获得链接的人都可以打开这张卡片，确定继续吗？</p><div><button class="share-btn share-btn-secondary" type="button" data-share-action="cancel-confirm">取消</button><button class="share-btn share-btn-primary" type="button" data-share-action="confirm">确认分享</button></div></div>
  <footer class="share-modal-actions"><button class="share-btn share-btn-secondary" type="button" data-share-action="copy">复制链接</button><button class="share-btn share-btn-secondary" type="button" data-share-action="save">保存 PNG</button><button class="share-btn share-btn-primary" type="button" data-share-action="native">系统分享</button></footer>
 </section></div>`;
}
export function shareViewerMarkup(data){
 return `<div class="page share-public-page"><div class="share-public-header"><h1>一份音乐分享</h1></div><div class="share-public-card">${cardMarkup(data)}</div><div class="share-public-actions">${data.type==='stats'?'':'<button type="button" class="share-btn share-btn-primary" data-action="share-open-content">打开对应内容</button>'}<button type="button" class="share-btn share-btn-secondary" data-action="share-recreate">分享这份音乐</button></div></div>`;
}
export function shareInvalidMarkup(message){
 return `<div class="page share-public-page"><h1>分享链接无法打开</h1><p>${e(message)}</p><button class="share-btn share-btn-primary" data-action="navigate" data-view="home">返回发现</button></div>`;
}

function wrap(ctx,text,maxWidth){
 const lines=[];let line='';
 for(const char of Array.from(String(text||''))){
  if(char==='\n'){lines.push(line);line='';continue;}
  if(line&&ctx.measureText(line+char).width>maxWidth){lines.push(line);line=char;}else line+=char;
 }
 if(line)lines.push(line);
 return lines;
}
function fitLines(ctx,text,maxWidth,maxLines){
 const lines=wrap(ctx,text,maxWidth);
 if(lines.length<=maxLines)return lines;
 const clipped=lines.slice(0,maxLines),last=clipped.length-1;
 let tail=clipped[last];while(tail&&ctx.measureText(tail+'…').width>maxWidth)tail=tail.slice(0,-1);
 clipped[last]=tail+'…';return clipped;
}
async function coverImage(url){
 if(!/^https:\/\//.test(url||''))return null;
 try{const response=await fetch(url,{mode:'cors'});if(!response.ok)throw Error('cover');const bitmap=await createImageBitmap(await response.blob());return bitmap;}catch{return null;}
}
function drawLogo(ctx,x,y){
 ctx.fillStyle='#1d1b18';ctx.beginPath();ctx.roundRect(x,y,49,49,12);ctx.fill();
 ctx.fillStyle='#95654f';ctx.beginPath();ctx.arc(x+24.5,y+24.5,17,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#f2ede4';ctx.beginPath();ctx.arc(x+24.5,y+24.5,9,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#1d1b18';ctx.beginPath();ctx.arc(x+24.5,y+24.5,2.5,0,Math.PI*2);ctx.fill();
}
export async function cardPng(input){
 const d=normalizeShare(input),s=d.style,{density,coverFraction}=posterLayout(d);
 const width=1080,height=1440,margin=78,footerY=1310;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法创建画布');
 ctx.fillStyle='#17191f';ctx.fillRect(0,0,width,height);
 const gradient=ctx.createLinearGradient(0,0,width,height);
 gradient.addColorStop(0,'#17191f');gradient.addColorStop(.29,s.color);gradient.addColorStop(.62,s.color2);gradient.addColorStop(1,s.color3);
 ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
 const shade=ctx.createLinearGradient(0,0,0,height);
 shade.addColorStop(0,'rgba(0,0,0,.07)');shade.addColorStop(1,'rgba(0,0,0,.48)');
 ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
 const fg='#fff',sub='#edeef3',contentWidth=width-2*margin;
 const title=posterTitle(d),artist=posterArtist(d),description=posterDescription(d),album=posterAlbum(d);
 let art=Math.round(contentWidth*(d.type==='stats'?Math.min(coverFraction,.40):coverFraction));
 const stats=d.type==='stats'?(d.stats||[]):[],lyrics=d.type==='lyrics'?(d.lines||[]):[];
 const sizeFactor=density==='dense'?.81:density==='balanced'?.9:1;
 const titleFont=Math.round(63*sizeFactor),textFont=Math.round(40*sizeFactor);
 function blockLines(){
  const parts=[];
  const add=(value,size,max,step,gap)=>{if(!value)return;ctx.font=`${size>=titleFont?'700':'400'} ${size}px system-ui`;const lines=fitLines(ctx,value,contentWidth,max);parts.push({lines,size,step,gap});};
  add(title,titleFont,3,Math.round(titleFont*1.2),19);
  add(artist,textFont,2,Math.round(textFont*1.35),13);
  add(description,Math.round(textFont*.90),3,Math.round(textFont*1.3),13);
  add(album?'专辑 · '+album:'',Math.round(textFont*.88),2,Math.round(textFont*1.3),13);
  add(lyrics.join(' / '),Math.round(textFont*.86),4,Math.round(textFont*1.3),10);
  return parts;
 }
 const parts=blockLines();
 const textHeight=parts.reduce((h,p)=>h+p.lines.length*p.step+p.gap,0);
 const statsRows=Math.ceil(stats.length/2),statsHeight=statsRows?statsRows*76+20:0;
 const available=footerY-80-52-textHeight-statsHeight;
 art=Math.max(0,Math.min(art,available));
 if(art>0){
  const x=(width-art)/2,y=80,img=await coverImage(coverUrl(d));
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,art,art,24);ctx.clip();
  if(img){const crop=Math.min(img.width,img.height),sx=(img.width-crop)/2,sy=(img.height-crop)/2;ctx.drawImage(img,sx,sy,crop,crop,x,y,art,art);img.close?.();}
  else{ctx.fillStyle=s.color2;ctx.fillRect(x,y,art,art);ctx.fillStyle='#fff';ctx.font=`700 ${Math.round(art*.25)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♪',width/2,y+art/2);ctx.textBaseline='alphabetic';ctx.textAlign='left';}
  ctx.restore();
 }
 let y=80+art+52;
 ctx.textBaseline='alphabetic';
 for(let i=0;i<parts.length;i++){
  const p=parts[i];ctx.fillStyle=i===0?fg:sub;ctx.font=`${i===0?'700':'400'} ${p.size}px system-ui`;
  for(const line of p.lines){if(y+p.step>footerY-24)break;y+=p.step;ctx.fillText(line,margin,y);}
  y+=p.gap;
 }
 if(stats.length&&y<footerY-30){
  const rows=stats.slice(0,12),colWidth=(contentWidth-30)/2;
  for(let i=0;i<rows.length;i++){
   const x=margin+(i%2)*(colWidth+30),rowY=y+Math.floor(i/2)*76;
   if(rowY+70>=footerY)break;
   ctx.fillStyle=fg;ctx.font='700 36px system-ui';ctx.fillText(fitLines(ctx,rows[i].value,colWidth,1)[0]||'',x,rowY+35);
   ctx.fillStyle=sub;ctx.font='26px system-ui';ctx.fillText(fitLines(ctx,rows[i].label,colWidth,1)[0]||'',x,rowY+69);
  }
 }
 ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(margin,footerY);ctx.lineTo(width-margin,footerY);ctx.stroke();
 drawLogo(ctx,margin,footerY+22);
 ctx.fillStyle=fg;ctx.font='700 34px system-ui';ctx.fillText('AimoMusic',margin+63,footerY+58);
 ctx.fillStyle=sub;ctx.font='26px system-ui';ctx.textAlign='right';ctx.fillText(promptFor(d),width-margin,footerY+56);ctx.textAlign='left';
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG 导出失败');return blob;
}
export function installShareUi({app,toast,onOpenContent,confirmPublish=async()=>true}){
 let draft=null,overlay=null,pendingAction=null,paletteRequest=0;
 const rerender=()=>{const p=overlay?.querySelector('#share-preview');if(p&&draft)p.innerHTML=cardMarkup(draft);};
 const syncPalette=async(data,token)=>{
  const colors=await extractAmbientColors(data.cover||data.track?.cover||data.playlist?.cover||'');
  if(token!==paletteRequest||!draft)return;
  const toHex=color=>{
   const m=String(color).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
   if(m)return '#'+m.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('');
   const h=String(color).match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
   if(h){const [H,S,L]=h.slice(1).map(Number);const a=S/100*Math.min(L/100,1-L/100);const f=n=>{const k=(n+H/30)%12;return Math.round((L/100-a*Math.max(-1,Math.min(k-3,9-k,1)))*255).toString(16).padStart(2,'0')};return '#'+f(0)+f(8)+f(4);}
   return '#8497b0';
  };
  draft.style.color=toHex(colors[0]);draft.style.color2=toHex(colors[1]||colors[0]);draft.style.color3=toHex(colors[2]||colors[0]);rerender();
 };
 const confirmBox=()=>overlay?.querySelector('[data-share-confirm]');
 const resetConfirm=()=>{pendingAction=null;const box=confirmBox();if(box)box.hidden=true;};
 const requestConfirm=action=>{pendingAction=action;const box=confirmBox();if(box){box.hidden=false;box.querySelector('[data-share-action="confirm"]')?.focus();}};

 const close=()=>{paletteRequest++;overlay?.remove();overlay=null;draft=null;pendingAction=null;document.body.classList.remove('share-dialog-open');};
 const open=input=>{close();draft=normalizeShare(input);overlay=document.createElement('div');overlay.innerHTML=shareEditorMarkup(draft);document.body.append(overlay);document.body.classList.add('share-dialog-open');overlay.querySelector('.share-icon-btn')?.focus();void syncPalette(draft,++paletteRequest);};
 const openUrl=()=>shareUrl(draft,location,window.__AIMO_BASE__||'/music');
 const download=async()=>{const blob=await cardPng(draft);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='AimoMusic-'+draft.type+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};
 const copy=async()=>{
  const url=openUrl();
  if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(url);toast('分享链接已复制');return;}catch{}}
  const input=document.createElement('textarea');input.value=url;input.style.cssText='position:fixed;top:-9999px;left:-9999px';document.body.append(input);input.select();
  const ok=document.execCommand?.('copy');input.remove();if(!ok)throw Error('无法自动复制，请使用浏览器分享或复制地址栏链接');toast('分享链接已复制');
 };
 const act=action=>{
  if(action==='close'){close();return;}
  if(action==='cancel-confirm'){resetConfirm();return;}
  if(action==='copy'||action==='native'){requestConfirm(action);return;}
  if(action==='save'){void download().then(()=>toast('图片已保存')).catch(err=>toast(err.message||'图片生成失败','error'));return;}
  if(action==='confirm'){
   const next=pendingAction;resetConfirm();
   if(next==='native'){
    let url;try{url=openUrl();}catch(err){toast(err.message||'分享链接生成失败','error');return;}
    if(typeof navigator.share==='function'){
     // Invoke navigator.share synchronously from this actual click, before any await.
     const sharePromise=navigator.share({title:draft.title||'AimoMusic 分享',text:'来自 AimoMusic 的音乐分享',url});
     void sharePromise.catch(err=>{if(err.name!=='AbortError')toast(err.message||'系统分享失败，请尝试复制链接','error');});
    }else void copy().catch(err=>toast(err.message||'复制失败','error'));
   }else if(next==='copy')void copy().catch(err=>toast(err.message||'复制失败','error'));
  }
 };
 document.addEventListener('click',e=>{
  if(overlay&&e.target.classList?.contains('share-modal-backdrop')){close();return;}
  const button=e.target.closest('[data-share-action]');if(!button||!overlay?.contains(button))return;e.preventDefault();try{act(button.dataset.shareAction);}catch(err){toast(err.message||'分享失败','error');}
 });
 document.addEventListener('keydown',e=>{if(overlay&&e.key==='Escape'){e.preventDefault();close();}});
 return {open,close,readLink:()=>decodeShare(location.hash),view:shareViewerMarkup,invalid:shareInvalidMarkup,get draft(){return draft},openContent:onOpenContent};
}
