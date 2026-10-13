// Share data is fully encoded in the URL fragment. No database or remote storage.
export const SHARE_VERSION=1;
const limit=(v,n)=>String(v??'').slice(0,n);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||a));
export function compactTrack(t){
 return {id:limit(t?.id,160),source:limit(t?.source||'remote',20),
  providerNamespace:limit(t?.providerNamespace||'netease',60),providerId:limit(t?.providerId,160),
  title:limit(t?.title,160),artist:limit(t?.artist,140),
  album:limit(t?.album,140),cover:limit(t?.cover,1500)};
}
export function normalizeShare(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('分享数据格式无效');
 if(!['song','playlist','lyrics','stats'].includes(raw.type))throw Error('不支持的分享类型');
 const style=raw.style||{};
 const result={v:SHARE_VERSION,type:raw.type,title:limit(raw.title,160),subtitle:limit(raw.subtitle,160),
  cover:limit(raw.cover,1500),style:{
   template:['minimal','glass','poster','vinyl'].includes(style.template)?style.template:'glass',
   ratio:['1:1','4:5','3:4','9:16','16:9'].includes(style.ratio)?style.ratio:'4:5',
   color:/^#[0-9a-f]{6}$/i.test(style.color||'')?style.color:'#8497b0',
   color2:/^#[0-9a-f]{6}$/i.test(style.color2||'')?style.color2:'#8497b0',
   color3:/^#[0-9a-f]{6}$/i.test(style.color3||'')?style.color3:'#17191f',
   background:['cover','gradient','solid'].includes(style.background)?style.background:'gradient',
   fields:{cover:style.fields?.cover!==false,title:style.fields?.title!==false,
    artist:style.fields?.artist!==false,album:style.fields?.album===true,
    logo:style.fields?.logo!==false,qr:style.fields?.qr!==false,details:style.fields?.details!==false}
  }};
 if(raw.type==='song'||raw.type==='lyrics'){
  result.track=compactTrack(raw.track);
  if(!result.track.id)throw Error('缺少歌曲 ID');
 }
 if(raw.type==='playlist'){
  result.playlist={id:limit(raw.playlist?.id,160),namespace:limit(raw.playlist?.namespace||'netease',60),
   providerId:limit(raw.playlist?.providerId,160),title:limit(raw.playlist?.title||raw.title,160),
   cover:limit(raw.playlist?.cover||raw.cover,1500),count:clamp(raw.playlist?.count,0,100000)};
  if(!result.playlist.id)throw Error('缺少歌单 ID');
 }
 if(raw.type==='lyrics')result.lines=(Array.isArray(raw.lines)?raw.lines:[]).slice(0,8).map(x=>limit(x,240)).filter(Boolean);
 if(raw.type==='stats')result.stats=(Array.isArray(raw.stats)?raw.stats:[]).slice(0,12).map(x=>({label:limit(x.label,40),value:limit(x.value,80)}));
 return result;
}
function toBase64(bytes){let out='';for(const byte of bytes)out+=String.fromCharCode(byte);return btoa(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function fromBase64(encoded){const s=encoded.replace(/-/g,'+').replace(/_/g,'/');const binary=atob(s);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
export function encodeShare(input){
 const data=normalizeShare(input);
 const result=toBase64(new TextEncoder().encode(JSON.stringify(data)));
 if(result.length>7000)throw Error('分享内容过长，请减少歌词或统计字段');
 return 'v1='+result;
}
export function decodeShare(fragment){
 const value=String(fragment||'').replace(/^#/,'');
 if(!value.startsWith('v1=')||value.length>7500)throw Error('分享链接无效或版本不支持');
 let raw;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(fromBase64(value.slice(3))))}catch{throw Error('分享链接已损坏')}
 if(raw.v!==SHARE_VERSION)throw Error('分享版本不支持');
 return normalizeShare(raw);
}
export function shareUrl(data,location=globalThis.location,base='/music'){
 return location.origin+base.replace(/\/$/,'')+'/share#'+encodeShare(data);
}
