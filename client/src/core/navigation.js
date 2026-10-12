// Navigation state is per browser tab and never mixed with account/music preferences.
export const NAV_KEY='aimo-music-navigation-v1';
const pages=new Set(['home','search','library','playlist']);
const tabs=new Set(['favorites','recent','history','playlists','local']);
const types=new Set(['songs','playlists']);
const root=new Set(['home','search','library']);
const short=(value,length=180)=>typeof value==='string'?value.slice(0,length):'';
export function normalizeRoute(input){
 const r=input?.aimoMusicRoute===1&&input.route?input.route:input;
 if(!r||typeof r!=='object'||Array.isArray(r))return null;
 const view=pages.has(r.view)?r.view:'home';
 const id=short(r.playlistId||r.id,150);
 const output={
  view:view==='playlist'&&!id?'home':view,
  backView:root.has(r.backView)?r.backView:'home',
  libraryTab:tabs.has(r.libraryTab)?r.libraryTab:'favorites',
  searchType:types.has(r.searchType)?r.searchType:'songs',
  searchQuery:short(r.searchQuery,100),
  selectedLocalPlaylist:short(r.selectedLocalPlaylist,120)||null,
  playlistId:id||null,
  playlistProviderId:short(r.playlistProviderId||r.providerId,150)||null,
  playlistNamespace:short(r.playlistNamespace||r.namespace,120)||null,
  playlistTitle:short(r.playlistTitle,160),
  fullOpen:r.fullOpen===true||r.overlay==='player',
  fullPanel:r.fullPanel==='lyrics'?'lyrics':'cover'
 };
 if(!output.fullOpen)output.fullPanel='cover';
 return output;
}
export function routeFromState(state,{overlay=state.fullOpen?'player':null}={}){
 return normalizeRoute({
  view:state.view,backView:state.backView,
  libraryTab:state.libraryTab,searchType:state.searchType,searchQuery:state.searchQuery,
  selectedLocalPlaylist:state.selectedLocalPlaylist,
  playlistId:state.playlistId,playlistProviderId:state.playlistProviderId,playlistNamespace:state.playlistNamespace,
  playlistTitle:state.playlist?.title||state.playlistPreview?.title||state.playlistTitle||'',
  fullOpen:overlay==='player',fullPanel:state.fullPanel
 });
}
export const historyEntry=route=>({aimoMusicRoute:1,route:normalizeRoute(route)});
export function readRoute(historyState,storage=globalThis.sessionStorage){
 const fromHistory=normalizeRoute(historyState);
 if(fromHistory)return fromHistory;
 try{return normalizeRoute(JSON.parse(storage?.getItem(NAV_KEY)||'null'));}catch{return null;}
}
export function saveRoute(route,storage=globalThis.sessionStorage){
 try{storage?.setItem(NAV_KEY,JSON.stringify(normalizeRoute(route)));return true;}catch{return false;}
}
export const sameLocation=(a,b)=>{
 const x=normalizeRoute(a),y=normalizeRoute(b);
 return !!x&&!!y&&x.view===y.view&&(x.view!=='playlist'||x.playlistId===y.playlistId&&x.playlistProviderId===y.playlistProviderId&&x.playlistNamespace===y.playlistNamespace);
};
export const rootView=view=>root.has(view)?view:'home';
