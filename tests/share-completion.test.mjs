import test from 'node:test';
import assert from 'node:assert/strict';
import {routeUrl,parseRoute} from '../client/src/core/url-routes.js';
import {normalizeRoute,historyEntry} from '../client/src/core/navigation.js';
import {compactTrack,encodeShare,decodeShare} from '../client/src/core/share.js';
test('公开分享路由能保存到浏览器历史',()=>{
 const route=normalizeRoute({view:'share'});
 assert.equal(route.view,'share');
 assert.equal(normalizeRoute(historyEntry(route)).view,'share');
 assert.equal(routeUrl(route),'/music/share');
 assert.equal(parseRoute('https://example.com/music/share#v1=demo').view,'share');
});
test('歌曲分享保留音乐 API 来源',()=>{
 const track=compactTrack({id:'123',providerId:'custom-source',providerNamespace:'ncm',title:'测试'});
 assert.equal(decodeShare(encodeShare({type:'song',track})).track.providerId,'custom-source');
});
test('本地歌单只包含标识不泄露曲目',()=>{
 const data=decodeShare(encodeShare({type:'playlist',playlist:{id:'local-1',namespace:'local'},tracks:[{title:'私密歌曲'}]}));
 assert.equal(data.playlist.namespace,'local');
 assert.equal(JSON.stringify(data).includes('私密歌曲'),false);
});
test('所有模板和比例编码可往返',()=>{
 for(const template of ['glass','minimal','poster','vinyl'])
 for(const ratio of ['1:1','4:5','3:4','9:16','16:9']){
  const data=decodeShare(encodeShare({type:'stats',style:{template,ratio,color:'#abc123'}}));
  assert.equal(data.style.template,template);assert.equal(data.style.ratio,ratio);
 }
});
