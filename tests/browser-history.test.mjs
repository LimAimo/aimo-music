import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeRoute,routeFromState,historyEntry,sameLocation} from '../client/src/core/navigation.js';

const source=readFileSync(new URL('../client/src/main.js',import.meta.url),'utf8');
const begin=source.indexOf('function restoreHistoryLocation(entry){');
const end=source.indexOf("window.addEventListener('popstate'",begin);
assert.ok(begin>=0&&end>begin,'history handler exists');
const implementation=source.slice(begin,end);
function harness(state){
 const events=[];
 const ctx={
  state,normalizeRoute,routeFromState,sameLocation,
  closePlayer:({fromHistory})=>{events.push('close-player');assert.equal(fromHistory,true);state.fullOpen=false;},
  renderDirectory:()=>events.push('render-directory'),
  openPlaylist:()=>{events.push('open-playlist');return Promise.resolve();},
  navigate:()=>events.push('navigate'),
  renderHeader:()=>events.push('render-header'),
  renderPage:()=>events.push('render-page'),
  restoreDirectoryTab:()=>events.push('restore-tab'),
  runSearch:()=>events.push('run-search'),
  openPlayer:(panel,options)=>{events.push('open-player:'+panel);state.fullOpen=true;assert.equal(options.record,false);},
  renderOverlay:()=>events.push('render-overlay'),
  saveRoute:()=>events.push('save-route'),
 };
 const fn=new Function(...Object.keys(ctx),implementation+'; return restoreHistoryLocation;')(...Object.values(ctx));
 return {fn,events};
}
test('听点新的歌单 → 歌曲详情 → Android 返回：仅关闭歌曲详情，不返回歌单封面',()=>{
 const state={view:'playlist',backView:'home',playlistId:'486',playlistProviderId:'api-1',
  playlistNamespace:'netease',fullOpen:true,fullPanel:'cover',
  libraryTab:'favorites',searchType:'songs',searchQuery:'',current:{id:'song-1'}};
 const {fn,events}=harness(state);
 fn(historyEntry({...state,fullOpen:false}));
 assert.equal(state.fullOpen,false);
 assert.equal(state.view,'playlist');
 assert.equal(state.playlistId,'486');
 assert.deepEqual(events,['close-player','render-directory','save-route']);
});
test('浏览器前进回到详情页，仍保留歌单与选定歌词面板',()=>{
 const state={view:'playlist',backView:'search',playlistId:'486',playlistProviderId:'api-1',
  playlistNamespace:'netease',fullOpen:false,fullPanel:'cover',current:{id:'song-1'}};
 const {fn,events}=harness(state);
 fn(historyEntry({...state,fullOpen:true,fullPanel:'lyrics'}));
 assert.equal(state.view,'playlist');
 assert.deepEqual(events,['open-player:lyrics','render-directory','save-route']);
});
test('只有真正离开歌单页面时才执行下层页面导航',()=>{
 const state={view:'playlist',backView:'home',playlistId:'486',fullOpen:false};
 const {fn,events}=harness(state);
 fn(historyEntry({view:'home'}));
 assert.ok(events.includes('navigate'));
 assert.ok(!events.includes('open-playlist'));
 assert.ok(!events.includes('close-player'));
});
test('启动时不能等待可能永不响应的在线歌单请求',()=>{
 assert.match(source,/void openPlaylist\(startupRoute\.playlistId/);
 assert.doesNotMatch(source,/await openPlaylist\(startupRoute\.playlistId/);
});
