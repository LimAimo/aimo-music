import {encodeShare,decodeShare,shareUrl,normalizeShare} from '../core/share.js';
import {icon} from './icons.js';
import {extractAmbientColors} from './ambient-palette.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const templates={glass:'柔和氛围',minimal:'极简',poster:'杂志海报',vinyl:'唱片'};
const ratios={'1:1':[1,1],'4:5':[4,5],'3:4':[3,4],'9:16':[9,16],'16:9':[16,9]};
const defaults={template:'vinyl',ratio:'3:4',color:'#8497b0',background:'gradient',fields:{cover:true,title:true,artist:true,album:false,logo:true,qr:true,details:true}};
const clone=o=>JSON.parse(JSON.stringify(o));
const titleFor=d=>d.type==='song'?'歌曲分享':d.type==='playlist'?'歌单分享':d.type==='lyrics'?'歌词分享':'听歌统计';
function cardMarkup(data){
 const s=data.style;const [w,h]=ratios[s.ratio]||ratios['4:5'];
 const cover=s.fields.cover&&/^https:\/\//.test(data.cover||'')?`<img class="share-card-cover" src="${e(data.cover)}" alt="" crossorigin="anonymous">`:'';
 const lyrics=data.type==='lyrics'?'<div class="share-card-lines">'+(data.lines||[]).map(line=>`<p>${e(line)}</p>`).join('')+'</div>':'';
 const stats=data.type==='stats'?'<div class="share-card-stats">'+(data.stats||[]).map(row=>`<div><strong>${e(row.value)}</strong><small>${e(row.label)}</small></div>`).join('')+'</div>':'';
 const target=data.type==='song'||data.type==='lyrics'?'歌曲':data.type==='playlist'?'歌单':'统计';
 return `<article class="share-card share-card--${s.template} share-card--${s.background}" style="--share-color:${s.color};--share-color-2:${s.color2||s.color};--share-color-3:${s.color3||'#17191f'};--share-ratio:${w}/${h}" aria-label="${target}分享卡片">
 <div class="share-card-inner">${cover}<div class="share-card-text">
 <span class="share-card-kicker">AIMO music / ${e(titleFor(data))}</span>
 ${s.fields.title?`<h2>${e(data.title||data.track?.title||data.playlist?.title||'我的音乐')}</h2>`:''}
 ${s.fields.artist?`<p>${e(data.subtitle||data.track?.artist||'')}</p>`:''}
 ${s.fields.album&&data.track?.album?`<p class="share-card-album">${e(data.track.album)}</p>`:''}
 ${lyrics}${s.fields.details?stats:''}</div>
 <div class="share-card-foot">${s.fields.logo?'<span class="share-card-brand"><img src="/favicon.svg" alt="" width="20" height="20"><strong>AimoMusic</strong></span>':'<span></span>'}${s.fields.qr?'<span class="share-card-url">打开 AimoMusic ↗</span>':''}</div>
 </div></article>`;
}
const options=(items,current)=>Object.entries(items).map(([value,label])=>`<option value="${e(value)}" ${value===current?'selected':''}>${e(label)}</option>`).join('');
export function shareEditorMarkup(data){
 const s=data.style;
 return `<div class="share-modal-backdrop" data-share-backdrop><section class="share-modal" role="dialog" aria-modal="true" aria-label="分享卡片编辑器">
 <header class="share-modal-header"><div><span class="share-eyebrow">AIMO MUSIC / SHARE</span><h2>分享音乐</h2></div><button type="button" class="share-icon-btn" data-share-action="close" aria-label="关闭">${icon('close',20)}</button></header>
 <div class="share-modal-body"><div class="share-preview-wrap"><div class="share-preview" id="share-preview">${cardMarkup(data)}</div></div>
 <div class="share-fixed-details"><strong>音乐分享</strong><p>唱片模板 · 3:4 · 流动渐变</p><p>根据音乐封面自动搭配颜色，生成专属分享卡片。</p><p class="share-help">分享信息保存在链接中，不上传数据库。持有链接的人均可读取。</p></div></div>
 <div class="share-inline-confirm" data-share-confirm hidden role="group" aria-label="确认公开分享"><p>链接包含已选中的卡片信息，任何获得链接的人都能读取，且链接不会自动失效。确定继续吗？</p><div><button class="share-btn share-btn-secondary" type="button" data-share-action="cancel-confirm">取消</button><button class="share-btn share-btn-primary" type="button" data-share-action="confirm">确认分享</button></div></div>
 <footer class="share-modal-actions"><button class="share-btn share-btn-secondary" type="button" data-share-action="copy">复制链接</button><button class="share-btn share-btn-secondary" type="button" data-share-action="save">保存 PNG</button><button class="share-btn share-btn-primary" type="button" data-share-action="native">系统分享</button></footer>
 </section></div>`;
}
export function shareViewerMarkup(data){
 return `<div class="page share-public-page"><div class="share-public-header"><span class="share-eyebrow">AIMO MUSIC</span><h1>一份音乐分享</h1><p>来自 AimoMusic 的音乐卡片</p></div><div class="share-public-card">${cardMarkup(data)}</div><div class="share-public-actions">${data.type==='stats'?'': '<button type="button" class="share-btn share-btn-primary" data-action="share-open-content">打开对应内容</button>'}<button type="button" class="share-btn share-btn-secondary" data-action="share-recreate">分享这份音乐</button></div></div>`;
}
export function shareInvalidMarkup(message){
 return `<div class="page share-public-page"><h1>分享链接无法打开</h1><p>${e(message)}</p><button class="share-btn share-btn-primary" data-action="navigate" data-view="home">返回发现</button></div>`;
}
function wrap(ctx,text,maxWidth){
 const words=Array.from(text);let line='',lines=[];
 for(const char of words){if(ctx.measureText(line+char).width>maxWidth&&line){lines.push(line);line=char}else line+=char;}
 if(line)lines.push(line);return lines;
}
async function coverImage(url){
 if(!/^https:\/\//.test(url||''))return null;
 try{const response=await fetch(url,{mode:'cors'});if(!response.ok)throw Error('cover');const blob=await response.blob();const bitmap=await createImageBitmap(blob);return bitmap;}catch{return null;}
}
export async function cardPng(data){
 const d=normalizeShare(data),s=d.style;const [rw,rh]=ratios[s.ratio];const width=1080,height=Math.round(width*rh/rw);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法创建画布');
 const dark=s.template!=='minimal';ctx.fillStyle=dark?'#17191f':'#f7f5f0';ctx.fillRect(0,0,width,height);
 const gradient=ctx.createLinearGradient(0,0,width,height);
 gradient.addColorStop(0,s.color);gradient.addColorStop(.52,s.color2||s.color);gradient.addColorStop(1,s.color3||'#17191f');
 ctx.globalAlpha=s.background==='solid'?.78:s.background==='cover'?.85:.62;
 ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;
 if(s.background==='cover'&&d.cover){
  const backgroundImage=await coverImage(d.cover);
  if(backgroundImage){ctx.save();ctx.globalAlpha=.16;ctx.filter='blur(45px)';ctx.drawImage(backgroundImage,-60,-60,width+120,height+120);ctx.restore();backgroundImage.close?.();}
 }
 const fg=dark?'#ffffff':'#232323',sub=dark?'#e1e1e6':'#44444b';const margin=88;
 let y=margin;
 if(s.fields.cover){const img=await coverImage(d.cover);const size=Math.min(width-2*margin,Math.floor(height*.43));
  if(img){const crop=Math.min(img.width,img.height),sx=(img.width-crop)/2,sy=(img.height-crop)/2;ctx.drawImage(img,sx,sy,crop,crop,margin,y,size,size);img.close?.();}
  else{ctx.fillStyle=s.color;ctx.fillRect(margin,y,size,size);ctx.fillStyle='#fff';ctx.font='bold 80px system-ui';ctx.fillText('♫',margin+size/2-40,y+size/2+25);}
  y+=size+60;
 }
 ctx.fillStyle=sub;ctx.font='600 28px system-ui';ctx.fillText('AIMO music / '+titleFor(d),margin,y);y+=58;
 if(s.fields.title){ctx.fillStyle=fg;ctx.font='bold 62px system-ui';for(const line of wrap(ctx,d.title||d.track?.title||d.playlist?.title||'我的音乐',width-2*margin).slice(0,3)){ctx.fillText(line,margin,y);y+=76;}}
 if(s.fields.artist){ctx.fillStyle=sub;ctx.font='34px system-ui';for(const line of wrap(ctx,d.subtitle||d.track?.artist||'',width-2*margin).slice(0,2)){ctx.fillText(line,margin,y);y+=48;}}
 if(s.fields.album&&d.track?.album){ctx.fillText(d.track.album.slice(0,45),margin,y);y+=48;}
 if(d.type==='lyrics'){ctx.fillStyle=fg;ctx.font='32px system-ui';for(const item of d.lines||[]){for(const line of wrap(ctx,item,width-2*margin).slice(0,2)){if(y>height-140)break;ctx.fillText(line,margin,y);y+=43;}}}
 if(d.type==='stats'&&s.fields.details){ctx.fillStyle=fg;ctx.font='bold 36px system-ui';for(const item of d.stats||[]){if(y>height-150)break;ctx.fillText(item.label+': '+item.value,margin,y);y+=58;}}
 if(s.fields.logo){
  const logo=await coverImage(new URL('/favicon.svg',location.origin).href);
  if(logo){ctx.drawImage(logo,margin,height-106,42,42);logo.close?.();}
  ctx.fillStyle=fg;ctx.font='bold 33px system-ui';ctx.fillText('AimoMusic',margin+55,height-73);
 }
 if(s.fields.qr){ctx.fillStyle=sub;ctx.font='26px system-ui';ctx.textAlign='right';ctx.fillText('打开 AimoMusic ↗',width-margin,height-72);ctx.textAlign='left';}
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
 const open=input=>{close();draft=normalizeShare({...input,style:input.style||clone(defaults)});overlay=document.createElement('div');overlay.innerHTML=shareEditorMarkup(draft);document.body.append(overlay);document.body.classList.add('share-dialog-open');overlay.querySelector('.share-icon-btn')?.focus();void syncPalette(draft,++paletteRequest);};
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
