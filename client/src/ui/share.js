import {encodeShare,decodeShare,shareUrl,normalizeShare} from '../core/share.js';
import {icon} from './icons.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const templates={glass:'柔和氛围',minimal:'极简',poster:'杂志海报',vinyl:'唱片'};
const ratios={'1:1':[1,1],'4:5':[4,5],'3:4':[3,4],'9:16':[9,16],'16:9':[16,9]};
const defaults={template:'glass',ratio:'4:5',color:'#8497b0',background:'gradient',fields:{cover:true,title:true,artist:true,album:false,logo:true,qr:true,details:true}};
const clone=o=>JSON.parse(JSON.stringify(o));
const titleFor=d=>d.type==='song'?'歌曲分享':d.type==='playlist'?'歌单分享':d.type==='lyrics'?'歌词分享':'听歌统计';
function cardMarkup(data){
 const s=data.style;const [w,h]=ratios[s.ratio]||ratios['4:5'];
 const cover=s.fields.cover&&/^https:\/\//.test(data.cover||'')?`<img class="share-card-cover" src="${e(data.cover)}" alt="" crossorigin="anonymous">`:'';
 const lyrics=data.type==='lyrics'?'<div class="share-card-lines">'+(data.lines||[]).map(line=>`<p>${e(line)}</p>`).join('')+'</div>':'';
 const stats=data.type==='stats'?'<div class="share-card-stats">'+(data.stats||[]).map(row=>`<div><strong>${e(row.value)}</strong><small>${e(row.label)}</small></div>`).join('')+'</div>':'';
 const target=data.type==='song'||data.type==='lyrics'?'歌曲':data.type==='playlist'?'歌单':'统计';
 return `<article class="share-card share-card--${s.template} share-card--${s.background}" style="--share-color:${s.color};--share-ratio:${w}/${h}" aria-label="${target}分享卡片">
 <div class="share-card-inner">${cover}<div class="share-card-text">
 <span class="share-card-kicker">AIMO / ${e(titleFor(data))}</span>
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
 <header class="share-modal-header"><div><span class="share-eyebrow">AIMO MUSIC / SHARE</span><h2>分享卡片</h2></div><button type="button" class="share-icon-btn" data-share-action="close" aria-label="关闭">${icon('close',20)}</button></header>
 <div class="share-modal-body"><div class="share-preview-wrap"><div class="share-preview" id="share-preview">${cardMarkup(data)}</div></div>
 <form class="share-editor-controls" id="share-editor-form"><h3>自定义卡片</h3>
 <div class="share-control-row"><label for="share-template">卡片模板</label><select id="share-template" name="template">${options(templates,s.template)}</select></div>
 <div class="share-control-row"><label for="share-ratio">画面比例</label><select id="share-ratio" name="ratio">${options(Object.fromEntries(Object.keys(ratios).map(x=>[x,x])),s.ratio)}</select></div>
 <div class="share-control-row"><label for="share-background">背景样式</label><select id="share-background" name="background">${options({gradient:'渐变',cover:'封面氛围',solid:'纯色'},s.background)}</select></div>
 <div class="share-control-row"><label for="share-color">主题颜色</label><input id="share-color" name="color" type="color" value="${s.color}"></div>
 <fieldset class="share-fields"><legend>显示信息</legend>${Object.entries({cover:'封面',title:'标题',artist:'歌手 / 描述',album:'专辑',logo:'AimoMusic Logo',qr:'打开音乐提示',details:'统计数据'}).map(([key,label])=>`<label class="share-check"><input type="checkbox" name="field-${key}" ${s.fields[key]?'checked':''}><span>${label}</span></label>`).join('')}</fieldset>
 ${data.type==='lyrics'?'<p class="share-help">歌词片段来自当前歌曲的歌词，分享前请确认内容。</p>':''}
 <p class="share-help">分享数据直接保存在链接中，不上传数据库。链接中的信息可以被任何获得链接的人读取。</p>
 </form></div>
 <footer class="share-modal-actions"><button class="share-btn share-btn-secondary" type="button" data-share-action="copy">复制链接</button><button class="share-btn share-btn-secondary" type="button" data-share-action="save">保存 PNG</button><button class="share-btn share-btn-primary" type="button" data-share-action="native">系统分享</button></footer>
 </section></div>`;
}
export function shareViewerMarkup(data){
 return `<div class="page share-public-page"><div class="share-public-header"><span class="share-eyebrow">AIMO MUSIC</span><h1>一份音乐分享</h1><p>来自 AimoMusic 的音乐卡片</p></div><div class="share-public-card">${cardMarkup(data)}</div><div class="share-public-actions">${data.type==='stats'?'': '<button type="button" class="share-btn share-btn-primary" data-action="share-open-content">打开对应内容</button>'}<button type="button" class="share-btn share-btn-secondary" data-action="share-recreate">制作同款卡片</button></div></div>`;
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
 const dark=s.template!=='minimal';ctx.fillStyle=dark?'#1c1d23':'#f7f5f0';ctx.fillRect(0,0,width,height);
 if(s.background!=='solid'){const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,s.color);gradient.addColorStop(1,dark?'#181a20':'#e9e7e2');ctx.globalAlpha=s.background==='cover'?.7:.55;ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;}
 const fg=dark?'#ffffff':'#232323',sub=dark?'#d5d5da':'#55565b';const margin=88;
 let y=margin;
 if(s.fields.cover){const img=await coverImage(d.cover);const size=Math.min(width-2*margin,Math.floor(height*.43));
  if(img){const crop=Math.min(img.width,img.height),sx=(img.width-crop)/2,sy=(img.height-crop)/2;ctx.drawImage(img,sx,sy,crop,crop,margin,y,size,size);img.close?.();}
  else{ctx.fillStyle=s.color;ctx.fillRect(margin,y,size,size);ctx.fillStyle='#fff';ctx.font='bold 80px system-ui';ctx.fillText('♫',margin+size/2-40,y+size/2+25);}
  y+=size+60;
 }
 ctx.fillStyle=sub;ctx.font='600 28px system-ui';ctx.fillText('AIMO / '+titleFor(d),margin,y);y+=58;
 if(s.fields.title){ctx.fillStyle=fg;ctx.font='bold 62px system-ui';for(const line of wrap(ctx,d.title||d.track?.title||d.playlist?.title||'我的音乐',width-2*margin).slice(0,3)){ctx.fillText(line,margin,y);y+=76;}}
 if(s.fields.artist){ctx.fillStyle=sub;ctx.font='34px system-ui';for(const line of wrap(ctx,d.subtitle||d.track?.artist||'',width-2*margin).slice(0,2)){ctx.fillText(line,margin,y);y+=48;}}
 if(s.fields.album&&d.track?.album){ctx.fillText(d.track.album.slice(0,45),margin,y);y+=48;}
 if(d.type==='lyrics'){ctx.fillStyle=fg;ctx.font='32px system-ui';for(const item of d.lines||[]){for(const line of wrap(ctx,item,width-2*margin).slice(0,2)){if(y>height-140)break;ctx.fillText(line,margin,y);y+=43;}}}
 if(d.type==='stats'&&s.fields.details){ctx.fillStyle=fg;ctx.font='bold 36px system-ui';for(const item of d.stats||[]){if(y>height-150)break;ctx.fillText(item.label+': '+item.value,margin,y);y+=58;}}
 if(s.fields.logo){
  const logo=await coverImage(location.origin+'/favicon.svg');
  if(logo){ctx.drawImage(logo,margin,height-106,42,42);logo.close?.();}
  ctx.fillStyle=fg;ctx.font='bold 33px system-ui';ctx.fillText('AimoMusic',margin+55,height-73);
 }
 if(s.fields.qr){ctx.fillStyle=sub;ctx.font='26px system-ui';ctx.textAlign='right';ctx.fillText('打开 AimoMusic ↗',width-margin,height-72);ctx.textAlign='left';}
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG 导出失败');return blob;
}
export function installShareUi({app,toast,onOpenContent,confirmPublish=async()=>true}){
 let draft=null,overlay=null;
 const rerender=()=>{const p=overlay?.querySelector('#share-preview');if(p)p.innerHTML=cardMarkup(draft);};
 const close=()=>{overlay?.remove();overlay=null;draft=null;document.body.classList.remove('share-dialog-open');};
 const open=input=>{close();draft=normalizeShare({...input,style:input.style||clone(defaults)});overlay=document.createElement('div');overlay.innerHTML=shareEditorMarkup(draft);document.body.append(overlay);document.body.classList.add('share-dialog-open');overlay.querySelector('.share-icon-btn')?.focus();};
 const openUrl=()=>shareUrl(draft,location,window.__AIMO_BASE__||'/music');
 const download=async()=>{const blob=await cardPng(draft);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='AimoMusic-'+draft.type+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};
 const copy=async()=>{await navigator.clipboard.writeText(openUrl());toast('分享链接已复制');};
 const act=async action=>{
  if(action==='close'){close();return;}
  if(action==='copy'){if(await confirmPublish(draft))await copy();return;}
  if(action==='save'){await download();toast('图片已保存');return;}
  if(action==='native'){
   if(!await confirmPublish(draft))return;
   const url=openUrl();if(navigator.share)await navigator.share({title:draft.title||'AimoMusic 分享',url});else await copy();
  }
 };
 document.addEventListener('click',e=>{
  if(overlay&&e.target.classList?.contains('share-modal-backdrop')){close();return;}
  const button=e.target.closest('[data-share-action]');if(!button)return;e.preventDefault();void act(button.dataset.shareAction).catch(err=>{if(err.name!=='AbortError')toast(err.message||'分享失败','error');});
 });
 document.addEventListener('change',e=>{
  if(!overlay||!e.target.closest('#share-editor-form'))return;
  const form=overlay.querySelector('#share-editor-form');const data=new FormData(form);
  draft.style.template=data.get('template');draft.style.ratio=data.get('ratio');draft.style.background=data.get('background');draft.style.color=data.get('color');
  for(const key of Object.keys(draft.style.fields))draft.style.fields[key]=data.has('field-'+key);
  rerender();
 });
 document.addEventListener('keydown',e=>{if(overlay&&e.key==='Escape'){e.preventDefault();close();}});
 return {open,close,readLink:()=>decodeShare(location.hash),view:shareViewerMarkup,invalid:shareInvalidMarkup,get draft(){return draft},openContent:onOpenContent};
}
