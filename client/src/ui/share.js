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
   <div class="share-card-atmo" aria-hidden="true"></div>
   <div class="share-card-kicker"><span>MAGAZINE POSTER</span><span>流动封面</span></div>
   <div class="share-card-hero">
    <div class="share-card-art-wrap"><div class="share-card-art" data-share-cover>${coverHtml}</div></div>
    <div class="share-card-copy">
     <p class="share-card-tag">一份音乐分享</p>
     <h2 class="share-card-title" data-share-title>${e(posterTitle(data))}</h2>
     ${posterArtist(data)?`<p class="share-card-artist">${e(posterArtist(data))}</p>`:''}
     ${description?`<p class="share-card-description">${e(description)}</p>`:''}
     ${album?`<p class="share-card-album"><span>专辑</span>${e(album)}</p>`:''}
     ${extras}
    </div>
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
 const width=1080,height=1440,margin=74,footerY=1304;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法创建画布');
 ctx.fillStyle='#17191f';ctx.fillRect(0,0,width,height);
 const gradient=ctx.createLinearGradient(0,0,width,height);
 gradient.addColorStop(0,'#14161c');gradient.addColorStop(.22,s.color3);gradient.addColorStop(.56,s.color);gradient.addColorStop(1,s.color2);
 ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
 const glow=ctx.createRadialGradient(width*.25,height*.18,40,width*.25,height*.18,420);
 glow.addColorStop(0,'rgba(255,255,255,.20)');glow.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
 const glow2=ctx.createRadialGradient(width*.78,height*.28,50,width*.78,height*.28,500);
 glow2.addColorStop(0,'rgba(255,255,255,.13)');glow2.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=glow2;ctx.fillRect(0,0,width,height);
 // Match the in-page poster's translucent copy area instead of leaving a blank block.
 const panelTop=Math.max(artY+art+42,height*.48),panelBottom=footerY-26;
 ctx.fillStyle='rgba(255,255,255,.10)';ctx.beginPath();ctx.roundRect(margin,panelTop,width-margin*2,panelBottom-panelTop,36);ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;ctx.stroke();
 const fg='#fff',sub='rgba(255,255,255,.92)',muted='rgba(255,255,255,.78)',contentWidth=width-2*margin;
 const title=posterTitle(d),artist=posterArtist(d),description=posterDescription(d),album=posterAlbum(d);
 let art=Math.round(Math.min(contentWidth*coverFraction, 700));
 if(density==='dense')art=Math.min(art,465); else if(density==='balanced')art=Math.min(art,600);
 const stats=d.type==='stats'?(d.stats||[]):[],lyrics=d.type==='lyrics'?(d.lines||[]):[];
 const artX=margin,artY=112;
 const img=art>0?await coverImage(coverUrl(d)):null;
 if(art>0){
  ctx.save();ctx.shadowColor='rgba(0,0,0,.30)';ctx.shadowBlur=48;ctx.shadowOffsetY=16;ctx.beginPath();ctx.roundRect(artX,artY,art,art,34);ctx.clip();
  if(img){const crop=Math.min(img.width,img.height),sx=(img.width-crop)/2,sy=(img.height-crop)/2;ctx.drawImage(img,sx,sy,crop,crop,artX,artY,art,art);img.close?.();}
  else{ctx.fillStyle=s.color2;ctx.fillRect(artX,artY,art,art);ctx.fillStyle='#fff';ctx.font=`700 ${Math.round(art*.25)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♪',artX+art/2,artY+art/2);ctx.textBaseline='alphabetic';ctx.textAlign='left';}
  ctx.restore();
 }
 ctx.fillStyle='rgba(255,255,255,.86)';ctx.font='600 24px system-ui';ctx.fillText('MAGAZINE POSTER',margin,70);
 ctx.textAlign='right';ctx.fillText('流动封面',width-margin,70);ctx.textAlign='left';
 const textX=margin+30,textWidth=contentWidth-60,copyTop=panelTop+43;
 let y=copyTop;
 ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='600 25px system-ui';ctx.fillText('一份音乐分享',textX+6,y);
 y+=56;
 const titleSize=density==='dense'?62:density==='balanced'?68:76;
 ctx.fillStyle=fg;ctx.font=`700 ${titleSize}px system-ui`;
 for(const line of fitLines(ctx,title,textWidth-20,3)){y+=Math.round(titleSize*1.14);ctx.fillText(line,textX+6,y);}
 if(artist){y+=24;ctx.fillStyle=sub;ctx.font='600 38px system-ui';for(const line of fitLines(ctx,artist,textWidth-20,2)){y+=50;ctx.fillText(line,textX+6,y);}}
 if(description){y+=16;ctx.fillStyle=muted;ctx.font='31px system-ui';for(const line of fitLines(ctx,description,textWidth-20,3)){if(y>footerY-220)break;y+=41;ctx.fillText(line,textX+6,y);}}
 if(album&&y<footerY-180){y+=20;ctx.fillStyle=sub;ctx.font='600 28px system-ui';const label='专辑 ';ctx.fillText(label,textX+6,y+34);ctx.fillStyle=muted;ctx.font='27px system-ui';for(const line of fitLines(ctx,album,textWidth-120,2)){y+=34;ctx.fillText(line,textX+102,y);break;}}
 if(lyrics.length&&y<footerY-160){y+=26;ctx.fillStyle='rgba(255,255,255,.74)';ctx.font='26px system-ui';for(const line of lyrics.slice(0,4)){y+=36;ctx.fillText(fitLines(ctx,line,textWidth-20,1)[0]||'',textX+6,y);}}
 if(stats.length&&y<footerY-110){
  y+=28;const cardW=(contentWidth-22)/2;
  for(let i=0;i<Math.min(stats.length,6);i++){
   const x=textX+(i%2)*(cardW+22), rowY=y+Math.floor(i/2)*96;
   if(rowY+84>footerY)break;
   ctx.fillStyle='rgba(255,255,255,.10)';ctx.beginPath();ctx.roundRect(x,rowY,cardW,78,24);ctx.fill();
   ctx.fillStyle=fg;ctx.font='700 34px system-ui';ctx.fillText(fitLines(ctx,stats[i].value,cardW-34,1)[0]||'',x+18,rowY+34);
   ctx.fillStyle=muted;ctx.font='24px system-ui';ctx.fillText(fitLines(ctx,stats[i].label,cardW-34,1)[0]||'',x+18,rowY+62);
  }
 }
 ctx.strokeStyle='rgba(255,255,255,.33)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(margin,footerY);ctx.lineTo(width-margin,footerY);ctx.stroke();
 drawLogo(ctx,margin,footerY+26);
 ctx.fillStyle=fg;ctx.font='700 34px system-ui';ctx.fillText('AimoMusic',margin+63,footerY+60);
 ctx.fillStyle=sub;ctx.font='26px system-ui';ctx.textAlign='right';ctx.fillText(promptFor(d),width-margin,footerY+58);ctx.textAlign='left';
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
