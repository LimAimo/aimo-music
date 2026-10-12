import {listPlaylists,savePlaylist,deletePlaylist,replacePlaylists,freshPlaylist,emptyRules,calculateSmart} from '../core/collections.js';
import {songMenuMarkup} from './collections-view.js';
import {allPlayHistory,replaceHistory} from '../core/history.js';
import {trackIdentity} from '../api/providers.js';
export function mountCollections({app,state,render,toast,confirm,findSong,playCollection,onSong,getSnapshot,restoreSnapshot}){
 let menu=null,track=null,drag=-1;
 const close=()=>{menu?.remove();menu=null;track=null;};
 const refresh=async()=>{const p=state.localPlaylists.find(x=>x.id===state.selectedLocalPlaylist);
  state.selectedLocalTracks=p?(p.smart?calculateSmart(p,{...state,history:await allPlayHistory()}):p.tracks):[];render();};
 const load=async()=>{state.localPlaylists=await listPlaylists();await refresh();};
 const save=async p=>{await savePlaylist(p);state.localPlaylists=await listPlaylists();await refresh();};
 function node(path){let p=state.collectionDraft?.rules;for(const i of String(path).split('.').slice(1))p=p?.items?.[+i];return p;}
 function download(name,data){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
 async function importFile(f,full){if(!f||f.size>1e8)throw Error('导入文件过大');const data=JSON.parse(await f.text());
  if(full){if(data?.format!=='AimoMusic-Backup'||!Array.isArray(data.playlists)||!Array.isArray(data.history)||!data.state)throw Error('无效的完整备份');
   if(!await confirm('恢复备份','将替换当前歌单、播放历史、收藏和设置。建议先备份当前数据。',{confirm:'恢复'}))return;
   await replacePlaylists(data.playlists);await replaceHistory(data.history);restoreSnapshot(data.state);
  }else{const items=Array.isArray(data)?data:Array.isArray(data.playlists)?data.playlists:[data];if(items.length>1000)throw Error('歌单数量过多');for(const p of items)await savePlaylist({...p,id:freshPlaylist().id});}
  state.localPlaylists=await listPlaylists();state.collectionEdit=false;state.selectedLocalPlaylist=null;await refresh();toast(full?'数据已恢复（不含音频文件本体）':'歌单已导入');
 }
 async function action(b){const a=b.dataset.feature,id=b.dataset.id,i=+b.dataset.index;
  if(a==='song-menu'){const t=findSong(b.dataset.context,id,b.dataset.namespace);if(!t)return toast('找不到歌曲');
   close();track=t;menu=document.createElement('div');menu.className='feat-menu-backdrop';menu.innerHTML=songMenuMarkup(t,state.localPlaylists);
   document.body.append(menu);const r=b.getBoundingClientRect();menu.querySelector('.feat-menu').style.setProperty('--menu-y',Math.max(12,Math.min(r.top,innerHeight-470))+'px');
   menu.addEventListener('click',e=>{if(e.target===menu)close();});menu.querySelector('button')?.focus();return;}
  if(a==='close-menu'){close();return;}
  if(a.startsWith('song-')){const t=track;if(!t)return;
   if(a==='song-add'){const p=state.localPlaylists.find(x=>x.id===id&&!x.smart);if(p){if(p.tracks.some(x=>trackIdentity(x)===trackIdentity(t)))toast('该歌曲已在歌单中');else{await save({...p,tracks:[...p.tracks,t]});toast('已加入歌单');}}}
   else if(a==='song-copy'||a==='song-link'){const value=a==='song-copy'?[t.title,t.artist,t.album].filter(Boolean).join(' - '):String(t.url||t.link||'');if(!value||a==='song-link'&&!/^https?:\/\//i.test(value))toast('这个音乐来源没有可用链接');else try{await navigator.clipboard.writeText(value);toast('已复制');}catch{toast('复制失败');}}
   else if(a==='song-info')toast([t.title,t.artist,t.album,t.duration&&t.duration+'秒'].filter(Boolean).join(' · '));
   else onSong(a.slice(5),t);
   close();return;}
  if(a==='back'){if(state.collectionEdit)state.collectionEdit=false;else state.selectedLocalPlaylist=null;await refresh();return;}
  if(a==='new-list'){state.collectionEdit=true;state.collectionDraft=freshPlaylist();render();return;}
  if(a==='open-list'){state.selectedLocalPlaylist=id;await refresh();return;}
  if(a==='edit'){const p=state.localPlaylists.find(x=>x.id===id);if(p){state.collectionEdit=true;state.collectionDraft=structuredClone(p);render();}return;}
  if(a==='delete'){const p=state.localPlaylists.find(x=>x.id===id);if(p&&await confirm('删除歌单','确定删除「'+p.name+'」？不会删除歌曲文件。',{confirm:'删除',destructive:true})){await deletePlaylist(id);state.localPlaylists=await listPlaylists();state.selectedLocalPlaylist=null;await refresh();}return;}
  if(a==='play-list'||a==='play-one'){const p=state.localPlaylists.find(x=>x.id===state.selectedLocalPlaylist);if(!p)return;if(p.smart)await refresh();const songs=state.selectedLocalTracks||[];if(songs.length)playCollection(songs,a==='play-one'?i:0);else toast('歌单暂无歌曲');return;}
  if(['up','down','remove-song'].includes(a)){const p=state.localPlaylists.find(x=>x.id===state.selectedLocalPlaylist);if(!p||p.smart)return;const songs=[...p.tracks],target=i+(a==='up'?-1:1);if(a==='remove-song')songs.splice(i,1);else if(target>=0&&target<songs.length)[songs[i],songs[target]]=[songs[target],songs[i]];await save({...p,tracks:songs});return;}
  if(['add-rule','add-group','remove-rule'].includes(a)){const p=node(b.dataset.path),parts=b.dataset.path.split('.');if(a==='add-rule'&&p?.kind==='group')p.items.push({kind:'test',field:'favorite',op:'eq',value:'true'});if(a==='add-group'&&p?.kind==='group')p.items.push(emptyRules());if(a==='remove-rule'&&parts.length>1){const i=+parts.pop();node(parts.join('.'))?.items.splice(i,1);}render();return;}
  if(a==='export-list'){const p=state.localPlaylists.find(x=>x.id===id);if(p)download('AimoMusic-'+p.name+'.json',p);return;}
  if(a==='export-all'){download('AimoMusic-完整备份.json',{format:'AimoMusic-Backup',version:1,state:getSnapshot(),playlists:state.localPlaylists,history:await allPlayHistory()});return;}
  if(a==='import-lists'||a==='import-all'){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',()=>{void importFile(input.files[0],a==='import-all').catch(e=>toast(e.message));},{once:true});input.click();}
 }
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-feature]');if(!b)return;e.preventDefault();e.stopPropagation();void action(b).catch(err=>toast(err.message||'操作失败'));},true);
 document.addEventListener('keydown',e=>{if(menu&&e.key==='Escape'){e.stopImmediatePropagation();e.preventDefault();close();}},true);
 app.addEventListener('submit',e=>{if(e.target.id!=='collection-form')return;e.preventDefault();e.stopImmediatePropagation();const d=new FormData(e.target),p=state.collectionDraft;const next={...p,name:d.get('name'),description:d.get('description'),sort:d.get('sort')||'recent',limit:+d.get('limit')||0};void save(next).then(()=>{state.collectionEdit=false;state.selectedLocalPlaylist=next.id;return refresh();}).then(()=>toast('歌单已保存')).catch(err=>toast(err.message));},true);
 app.addEventListener('change',e=>{const t=e.target;if(t.hasAttribute('data-feature-smart')){state.collectionDraft.smart=t.checked;render();return;}if(t.hasAttribute('data-feature-cover')){const f=t.files?.[0];if(!f)return;if(f.size>1900000||!['image/png','image/jpeg','image/webp'].includes(f.type))return toast('封面需小于1.9MB，格式为 PNG、JPEG 或 WebP');const fr=new FileReader();fr.onload=()=>{state.collectionDraft.cover=String(fr.result);render();};fr.readAsDataURL(f);return;}if(t.dataset.ruleField){const r=node(t.dataset.path);if(r)r[t.dataset.ruleField]=t.type==='checkbox'?t.checked:t.value;if(t.type==='checkbox'||t.tagName==='SELECT')render();}},true);
 app.addEventListener('input',e=>{const t=e.target;if(t.dataset.ruleField==='value'){const r=node(t.dataset.path);if(r)r.value=t.value;}},true);
 app.addEventListener('dragstart',e=>{const row=e.target.closest('.feat-track[draggable=true]');if(row){drag=+row.dataset.trackIndex;e.dataTransfer.setData('text/plain',String(drag));}});
 app.addEventListener('dragover',e=>{if(e.target.closest('.feat-track[draggable=true]'))e.preventDefault();});
 app.addEventListener('drop',e=>{const row=e.target.closest('.feat-track[draggable=true]'),p=state.localPlaylists.find(x=>x.id===state.selectedLocalPlaylist);if(!row||!p||p.smart||drag<0)return;e.preventDefault();const i=+row.dataset.trackIndex;if(i!==drag){const songs=[...p.tracks];songs.splice(i,0,songs.splice(drag,1)[0]);void save({...p,tracks:songs}).catch(err=>toast(err.message));}drag=-1;});
 return {load,refresh,close};
}
