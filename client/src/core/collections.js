import {trackIdentity} from '../api/providers.js';
import {isTrack} from './storage.js';
const NAME='aimo-collections',STORE='playlists';
function open(){return new Promise((yes,no)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});}
async function transact(mode,fn){const db=await open();return new Promise((yes,no)=>{const tx=db.transaction(STORE,mode);let r;try{r=fn(tx.objectStore(STORE));}catch(e){db.close();no(e);return;}tx.oncomplete=()=>{db.close();yes(r?.result);};tx.onerror=()=>{db.close();no(tx.error);};});}
export const emptyRules=()=>({kind:'group',mode:'all',not:false,items:[{kind:'test',field:'favorite',op:'eq',value:'true'}]});
export const freshPlaylist=(smart=false)=>({id:globalThis.crypto?.randomUUID?.()||'playlist-'+Date.now()+'-'+Math.random().toString(36).slice(2),name:'新歌单',description:'',cover:'',smart,tracks:[],rules:emptyRules(),sort:'recent',limit:0,created:Date.now()});
const fields=['favorite','played','count','artist','title','album','duration','source','daysSincePlayed'];
const ops=['eq','neq','has','notHas','gt','lt'];
export function ruleValid(r,depth=0){
  if(!r||depth>7)return false;
  if(r.kind==='test')return fields.includes(r.field)&&ops.includes(r.op)&&String(r.value??'').length<200;
  return r.kind==='group'&&['all','any'].includes(r.mode)&&typeof r.not==='boolean'&&Array.isArray(r.items)&&r.items.length<=30&&r.items.every(x=>ruleValid(x,depth+1));
}
export function validatePlaylist(p){
  if(!p||!String(p.name||'').trim())throw Error('歌单名称不能为空');
  if(p.smart&&!ruleValid(p.rules))throw Error('智能歌单规则无效');
  const cover=String(p.cover||'');
  if(cover&&!/^https?:\/\//i.test(cover)&&!/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(cover))throw Error('不支持的封面格式');
  if(cover.length>2600000)throw Error('封面超过大小限制');
  return {id:String(p.id||freshPlaylist().id).slice(0,100),name:String(p.name).trim().slice(0,80),
    description:String(p.description||'').slice(0,500),cover,smart:p.smart===true,
    tracks:Array.isArray(p.tracks)?p.tracks.filter(isTrack).slice(0,10000):[],rules:p.smart?structuredClone(p.rules):emptyRules(),
    sort:['recent','count','title','artist'].includes(p.sort)?p.sort:'recent',limit:Math.max(0,Math.min(10000,Number(p.limit)||0)),
    created:Number(p.created)||Date.now(),updated:Date.now()};
}
export const listPlaylists=async()=>((await transact('readonly',s=>s.getAll()))||[]).sort((a,b)=>b.updated-a.updated);
export const savePlaylist=p=>transact('readwrite',s=>s.put(validatePlaylist(p)));
export const deletePlaylist=id=>transact('readwrite',s=>s.delete(id));
export async function replacePlaylists(items){
  if(!Array.isArray(items)||items.length>1000)throw Error('歌单备份数量不合法');
  const clean=items.map(validatePlaylist),db=await open();
  return new Promise((yes,no)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);
    s.clear();for(const p of clean)s.put(p);
    tx.oncomplete=()=>{db.close();yes();};tx.onerror=()=>{db.close();no(tx.error);};
  });
}
function compare(a,op,b){
  a=String(a??'').toLowerCase();b=String(b??'').toLowerCase();
  if(op==='eq')return a===b;if(op==='neq')return a!==b;
  if(op==='has')return a.includes(b);if(op==='notHas')return !a.includes(b);
  if(op==='gt')return Number(a)>Number(b);if(op==='lt')return Number(a)<Number(b);
  return false;
}
export function evalRule(rule,track,stats){
  if(rule.kind==='group'){
    const ok=rule.mode==='all'?rule.items.every(x=>evalRule(x,track,stats)):rule.items.some(x=>evalRule(x,track,stats));
    return rule.not?!ok:ok;
  }
  const id=trackIdentity(track),n=stats.counts.get(id)||0,last=stats.last.get(id)||0;
  const values={favorite:String(stats.favorites.has(id)),played:String(n>0),count:n,artist:track.artist,title:track.title,album:track.album,duration:track.duration,source:track.source,daysSincePlayed:last?Math.floor((Date.now()-last)/86400000):100000};
  return compare(values[rule.field],rule.op,rule.value);
}
export function calculateSmart(p,{favorites=[],recent=[],localFiles=[],localPlaylists=[],history=[]}){
  const tracks=new Map(),counts=new Map(),last=new Map();
  for(const t of [...favorites,...recent,...localFiles,...localPlaylists.filter(x=>!x.smart).flatMap(x=>x.tracks||[]),...history.map(x=>x.track)]){
    if(isTrack(t))tracks.set(trackIdentity(t),t);
  }
  for(const row of history){if(!isTrack(row.track))continue;const id=trackIdentity(row.track);counts.set(id,(counts.get(id)||0)+1);last.set(id,Math.max(last.get(id)||0,row.playedAt||0));}
  const stats={favorites:new Set(favorites.map(trackIdentity)),counts,last};
  const arr=[...tracks.values()].filter(t=>evalRule(p.rules,t,stats));
  if(p.sort==='count')arr.sort((a,b)=>(counts.get(trackIdentity(b))||0)-(counts.get(trackIdentity(a))||0));
  else if(['title','artist'].includes(p.sort))arr.sort((a,b)=>String(a[p.sort]||'').localeCompare(String(b[p.sort]||''),'zh-CN'));
  else arr.sort((a,b)=>(last.get(trackIdentity(b))||0)-(last.get(trackIdentity(a))||0));
  return p.limit?arr.slice(0,p.limit):arr;
}
