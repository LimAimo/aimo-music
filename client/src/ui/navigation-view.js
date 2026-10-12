import {icon} from './icons.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={home:'发现',search:'搜索',library:'音乐库'};
const tabs={favorites:'我喜欢的',recent:'最近播放',history:'播放历史',playlists:'我的歌单',local:'本地歌曲'};
function crumb(label,view,tab){
 const value=esc(label);
 if(!view)return `<span class="nav-dir-current" aria-current="page" title="${value}">${value}</span>`;
 return `<button type="button" class="nav-dir-crumb" data-action="nav-go" data-view="${esc(view)}" ${tab?'data-tab="'+esc(tab)+'"':''}>${value}</button>`;
}
function menuGroup(title,items,state){
 const buttons=items.map(x=>`<button type="button" class="nav-dir-destination" data-action="nav-go" data-view="${x.view}" ${x.tab?'data-tab="'+x.tab+'"':''} aria-current="${state.view===x.view&&(!x.tab||x.tab===state.libraryTab)?'page':'false'}">${esc(x.label)}${icon('chevronRight',15)}</button>`).join('');
 return `<div class="nav-dir-group"><p>${title}</p>${buttons}</div>`;
}
export function directoryMarkup(state){
 let trail;
 if(state.view==='playlist'){
  const parent=state.backView||'home';
  trail=crumb(names[parent]||names.home,parent)+'<span class="nav-dir-divider" aria-hidden="true">›</span>'+crumb(state.playlist?.title||state.playlistPreview?.title||state.playlistTitle||'歌单详情');
 }else if(state.view==='library'){
  trail=crumb('音乐库','library')+'<span class="nav-dir-divider" aria-hidden="true">›</span>'+crumb(tabs[state.libraryTab]||tabs.favorites);
  if(state.libraryTab==='playlists'&&state.selectedLocalPlaylist){
   const p=state.localPlaylists?.find(x=>x.id===state.selectedLocalPlaylist);
   trail=crumb('音乐库','library')+'<span class="nav-dir-divider" aria-hidden="true">›</span>'+crumb('我的歌单','library','playlists')+'<span class="nav-dir-divider" aria-hidden="true">›</span>'+crumb(p?.name||'歌单详情');
  }
 }else trail=crumb(names[state.view]||names.home);
 const groups=menuGroup('主要页面',[{view:'home',label:'发现音乐'},{view:'search',label:'搜索音乐'},{view:'library',label:'音乐库'}],state)+
 menuGroup('音乐库',[{view:'library',tab:'favorites',label:'我喜欢的'},{view:'library',tab:'recent',label:'最近播放'},{view:'library',tab:'history',label:'播放历史'},{view:'library',tab:'playlists',label:'我的歌单'},{view:'library',tab:'local',label:'本地歌曲'}],state);
 return `<nav class="nav-directory" aria-label="导航目录与当前位置"><div class="nav-dir-trail"><button class="nav-dir-launch" type="button" data-action="nav-directory-toggle" aria-expanded="${state.navigationMenuOpen?'true':'false'}" aria-controls="nav-directory-menu" aria-label="打开导航目录">${icon('list',17)}<span>目录</span>${icon('chevronRight',13)}</button>${trail}</div>${state.navigationMenuOpen?`<div id="nav-directory-menu" class="nav-dir-menu" role="region" aria-label="选择页面"><div class="nav-dir-menu-head"><strong>前往</strong><button type="button" data-action="nav-directory-toggle" aria-label="关闭导航目录">${icon('close',16)}</button></div>${groups}</div>`:''}</nav>`;
}