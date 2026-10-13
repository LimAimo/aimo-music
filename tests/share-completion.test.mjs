import test from 'node:test';
import assert from 'node:assert/strict';
import {routeUrl,parseRoute} from '../client/src/core/url-routes.js';
import {normalizeRoute,historyEntry} from '../client/src/core/navigation.js';
import {compactTrack,encodeShare,decodeShare,posterLayout} from '../client/src/core/share.js';
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
test('卡片样式固定为杂志海报、3:4 与流动渐变',()=>{
 for(const template of ['glass','minimal','poster','vinyl'])
 for(const ratio of ['1:1','4:5','3:4','9:16','16:9']){
  const data=decodeShare(encodeShare({type:'stats',style:{template,ratio,background:'solid',color:'#abc123'}}));
  assert.equal(data.style.template,'poster');assert.equal(data.style.ratio,'3:4');assert.equal(data.style.background,'gradient');
 }
});

test('旧链接的内容开关不会隐藏海报信息',()=>{
 const track={id:'42',title:'歌曲',artist:'歌手',album:'专辑',description:'真实歌曲介绍'};
 const data=decodeShare(encodeShare({type:'song',track,style:{fields:{cover:false,title:false,artist:false,album:false,logo:false,qr:false}}}));
 assert.equal(data.track.description,'真实歌曲介绍');
 assert.equal(data.description,'真实歌曲介绍');
 assert.equal(data.track.album,'专辑');
 assert.equal('fields' in data.style,false);
});
test('海报根据曲名、描述、统计密度自动缩小封面',()=>{
 const simple=posterLayout({type:'song',title:'音乐'});
 const detailed=posterLayout({type:'song',title:'很长很长很长的歌曲名字需要自动适配排版和显示',description:'一段较长的歌曲描述'.repeat(15)});
 const stats=posterLayout({type:'stats',stats:Array.from({length:12},(_,i)=>({label:'播放',value:i}))});
 assert.ok(simple.coverFraction>detailed.coverFraction);
 assert.ok(simple.coverFraction>stats.coverFraction);
});
