import test from 'node:test';import assert from 'node:assert/strict';
import {encodeShare,decodeShare,shareUrl} from '../client/src/core/share.js';
const track={id:'123',title:'周杰伦 · 测试 🎵',artist:'测试歌手',cover:'https://example.com/a.jpg'};
test('歌曲分享无服务端，中文和 emoji 正确往返',()=>{
 const data=decodeShare(encodeShare({type:'song',title:track.title,track}));
 assert.equal(data.track.title,track.title);assert.equal(data.type,'song');
});
test('歌单分享只存 ID 不塞曲目列表',()=>{
 const value=encodeShare({type:'playlist',title:'歌单',playlist:{id:'123',namespace:'netease',count:50000},tracks:Array.from({length:50000},(_,i)=>i)});
 assert.ok(value.length<1000);assert.equal(decodeShare(value).playlist.id,'123');
});
test('歌词和统计有边界限制',()=>{
 const lyrics=decodeShare(encodeShare({type:'lyrics',track,lines:Array(100).fill('歌词')}));
 assert.equal(lyrics.lines.length,8);
 const stats=decodeShare(encodeShare({type:'stats',stats:[{label:'本月',value:'100'}]}));
 assert.equal(stats.stats[0].value,'100');
});
test('拒绝损坏和过长的分享数据',()=>{
 assert.throws(()=>decodeShare('v1=broken'));
 assert.throws(()=>decodeShare('v1='+('a'.repeat(9000))));
 assert.throws(()=>encodeShare({type:'bad'}));
});
test('分享链接为 fragment，不依赖服务器存储',()=>{
 assert.match(shareUrl({type:'song',track}, {origin:'https://example.com'}),/^https:\/\/example.com\/music\/share#v1=/);
});
