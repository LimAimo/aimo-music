// Real path routes, independent of the host name. Keep application root configurable.
const safe=x=>encodeURIComponent(String(x??''));
const dec=x=>{try{return decodeURIComponent(x)}catch{return ''}};
export function appBase(pathname='/music'){
 const match=pathname.match(/^(.*?)(?:\/music)(?:\/|$)/);
 return match?match[1]+'/music':'/music';
}
export function routeUrl(route,base='/music'){
 const r=route||{};const root=base.replace(/\/$/,'');
 if(r.view==='share')return root+'/share'+(r.shareId?'/'+safe(r.shareId):'');
 if(r.fullOpen&&r.songId&&r.songSource!=='local')return root+'/song/'+safe(r.songNamespace||'netease')+'/'+safe(r.songId)+(r.fullPanel==='lyrics'?'/lyrics':'');
 if(r.view==='playlist'&&r.playlistId)return root+'/playlist/'+safe(r.playlistNamespace||r.playlistProviderId||'netease')+'/'+safe(r.playlistId);
 if(r.view==='library'){
  if(r.selectedLocalPlaylist&&r.libraryTab==='playlists')return root+'/library/playlists/'+safe(r.selectedLocalPlaylist);
  return root+'/library/'+safe(r.libraryTab||'favorites');
 }
 if(r.view==='search')return root+'/search'+(r.searchQuery?'?q='+safe(r.searchQuery)+(r.searchType==='playlists'?'&type=playlists':''):'');
 return root;
}
export function parseRoute(url,base='/music'){
 const u=new URL(url,'https://local.invalid'),root=base.replace(/\/$/,'');
 if(u.pathname!==root&&!u.pathname.startsWith(root+'/'))return null;
 const p=u.pathname.slice(root.length).split('/').filter(Boolean).map(dec);
 if(!p.length)return {view:'home'};
 if(p[0]==='search'&&p.length===1)return {view:'search',searchQuery:(u.searchParams.get('q')||'').slice(0,100),searchType:u.searchParams.get('type')==='playlists'?'playlists':'songs'};
 if(p[0]==='library'){
  if(p.length===1)return {view:'library',libraryTab:'favorites'};
  if(['favorites','recent','history','playlists','local'].includes(p[1])&&p.length===2)return {view:'library',libraryTab:p[1]};
  if(p[1]==='playlists'&&p.length===3)return {view:'library',libraryTab:'playlists',selectedLocalPlaylist:p[2]};
 }
 if(p[0]==='playlist'&&p.length===3&&p[1]&&p[2])return {view:'playlist',playlistNamespace:p[1],playlistId:p[2],backView:'home'};
 if(p[0]==='song'&&(p.length===3||p.length===4)&&p[1]&&p[2]&&(!p[3]||p[3]==='lyrics'))return {view:'home',fullOpen:true,fullPanel:p[3]==='lyrics'?'lyrics':'cover',songNamespace:p[1],songId:p[2],directSong:true};
 if(p[0]==='share'&&p.length===1)return {view:'share'};
 return null;
}
