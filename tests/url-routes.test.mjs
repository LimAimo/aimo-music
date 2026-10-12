import test from 'node:test';import assert from 'node:assert/strict';
import {appBase,routeUrl,parseRoute} from '../client/src/core/url-routes.js';
test('全部主要页面使用真实路径',()=>{
 for(const r of [{view:'home'},{view:'search',searchQuery:'周杰伦'},{view:'library',libraryTab:'history'},{view:'playlist',playlistId:'123',playlistNamespace:'netease'}]){
  const url=routeUrl(r),parsed=parseRoute(url);assert.equal(parsed.view,r.view);if(r.playlistId)assert.equal(parsed.playlistId,r.playlistId);
 }
});
test('歌曲与歌词独立链接可直接访问',()=>{
 const route={view:'playlist',fullOpen:true,songId:'1',songNamespace:'netease',fullPanel:'lyrics'};
 assert.equal(routeUrl(route),'/music/song/netease/1/lyrics');
 assert.equal(parseRoute(routeUrl(route)).directSong,true);
});
test('非法路径不误恢复为上一次的音乐库',()=>{assert.equal(parseRoute('/music/unknown'),null);assert.equal(parseRoute('/other'),null);});
test('支持部署在自定义域名前缀',()=>{assert.equal(appBase('/foo/music/library/history'),'/foo/music');assert.equal(routeUrl({view:'home'},'/foo/music'),'/foo/music');});
