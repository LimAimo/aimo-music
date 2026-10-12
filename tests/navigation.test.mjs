import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRoute,routeFromState,historyEntry,readRoute,saveRoute,sameLocation,NAV_KEY} from '../client/src/core/navigation.js';
test('导航恢复会保留当前歌单、来源、搜索和音乐库标签',()=>{
 const selected={view:'playlist',playlistId:'42',playlistProviderId:'api-1',playlistNamespace:'other',
  backView:'search',searchQuery:'后摇',searchType:'playlists',libraryTab:'history',
  fullOpen:true,fullPanel:'lyrics'};
 const inHistory=historyEntry(selected);
 const route=readRoute(inHistory);
 assert.equal(route.playlistId,'42');assert.equal(route.playlistProviderId,'api-1');
 assert.equal(route.searchQuery,'后摇');assert.equal(route.libraryTab,'history');
 assert.equal(route.fullPanel,'lyrics');assert.equal(route.fullOpen,true);
});
test('刷新时恢复上次页面，但不会加载未定义页面或注入危险 ID',()=>{
 const memory=new Map();
 const store={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const route=normalizeRoute({view:'library',libraryTab:'playlists',selectedLocalPlaylist:'自定义歌单'});
 assert.ok(saveRoute(route,store));
 assert.equal(readRoute(null,store).selectedLocalPlaylist,'自定义歌单');
 assert.ok(memory.has(NAV_KEY));
 assert.equal(normalizeRoute({view:'playlist'}).view,'home');
 assert.equal(normalizeRoute({view:'unknown'}).view,'home');
 assert.equal(normalizeRoute({view:'search',searchType:'bad'}).searchType,'songs');
});
test('歌曲详情是一层独立遮罩，关闭不会改变下方歌单路由',()=>{
 const underlying=routeFromState({view:'playlist',playlistId:'9',backView:'home',fullOpen:false});
 const player=routeFromState({view:'playlist',playlistId:'9',backView:'home',fullOpen:true,fullPanel:'lyrics'});
 assert.ok(sameLocation(underlying,player));
 assert.equal(underlying.fullOpen,false);
 assert.equal(player.fullOpen,true);
 assert.equal(player.fullPanel,'lyrics');
});
