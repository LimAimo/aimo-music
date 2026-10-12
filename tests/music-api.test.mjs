import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicApi, normalizeTrack, normalizePlaylist, safeExternalUrl, validateApiBase } from '../client/src/api/music.js';

const mockFetch = handler => async (url, options) => {
  const result = handler(new URL(url), options);
  if (result instanceof Error) throw result;
  return { ok: true, status: 200, json: async () => result };
};

test('搜索：同时兼容老、新网易云响应字段', async () => {
  const api = new MusicApi('https://example.com', mockFetch(url => ({ result:{ songs: [{ id:123, name:'Hello',artists:[{name:'歌手'}],album:{name:'专辑',picUrl:'https://example.com/a.jpg'},duration:210000 }] } })));
  const tracks=await api.searchSongs('Hello');
  assert.equal(tracks.length,1);
  assert.deepEqual(tracks[0],{id:'123',title:'Hello',artist:'歌手',album:'专辑',cover:'https://example.com/a.jpg',duration:210,source:'remote'});
});
test('搜索：主接口失败时使用 cloudsearch 降级',async()=>{
  const seen=[];
  const api=new MusicApi('https://example.com',async url=>{
    seen.push(new URL(url).pathname);
    if(url.includes('/search?')) return {ok:false,status:404};
    return {ok:true,status:200,json:async()=>({result:{songs:[{id:1,name:'OK'}]}})};
  });
  assert.equal((await api.searchSongs('x')).length,1);
  assert.deepEqual(seen,['/search','/cloudsearch']);
});
test('播放：从 /song/url/v1 降级到 /song/url',async()=>{
  const api=new MusicApi('https://example.com',async url=> url.includes('/song/url/v1')
    ? {ok:false,status:404}
    : {ok:true,status:200,json:async()=>({data:[{url:'https://cdn.example.com/song.mp3'}]})});
  assert.equal(await api.audioUrl('1'),'https://cdn.example.com/song.mp3');
});
test('无地址时明确返回资源不可用，不伪造播放地址',async()=>{
  const api=new MusicApi('https://example.com',mockFetch(()=>({data:[{url:null}]})));
  await assert.rejects(()=>api.audioUrl('123'),/暂无可用播放地址/);
});
test('API 地址和封面阻止脚本协议、用户凭证和明文远程 API',()=>{
  assert.equal(safeExternalUrl('javascript:alert(1)'),'');
  assert.equal(safeExternalUrl('https://a:b@example.com/img'),'');
  assert.throws(()=>validateApiBase('http://example.com'),/HTTPS/);
  assert.equal(validateApiBase('http://localhost:5200/'),'http://localhost:5200');
});
test('歌单兼容 playlist/detail',async()=>{
  const api=new MusicApi('https://example.com',mockFetch(()=>({playlist:{id:7,name:'Mix',trackCount:1,tracks:[{id:9,name:'Track',ar:[{name:'Singer'}],al:{name:'Record'}}]}})));
  const detail=await api.playlistDetail(7);
  assert.equal(detail.title,'Mix');assert.equal(detail.tracks[0].artist,'Singer');
});
test('非法内容不成为歌曲',()=>{
  assert.equal(normalizeTrack({name:'没有 id'}),null);
  assert.equal(normalizePlaylist({name:'没有 id'}),null);
});

test('HTTP 200 但业务错误 301 时不视为接口成功', async()=>{
  const api=new MusicApi('https://example.com',mockFetch(()=>({code:301,msg:'need login'})));
  await assert.rejects(()=>api.get('search'),/错误 301/);
});
test('大型歌单补齐缺失曲目，保留 trackIds 原始顺序',async()=>{
  const seen=[];
  const api=new MusicApi('https://example.com',mockFetch(url=>{
    if(url.pathname==='/playlist/detail')return {code:200,playlist:{id:3,name:'大歌单',trackCount:203,tracks:[{id:2,name:'曲目2'}],trackIds:Array.from({length:203},(_,i)=>({id:i+1}))}};
    const ids=url.searchParams.get('ids').split(','); seen.push(ids.length);
    return {code:200,songs:ids.map(id=>({id,name:'曲目'+id}))};
  }));
  const detail=await api.playlistDetail(3);
  assert.equal(detail.tracks.length,203);
  assert.deepEqual([detail.tracks[0].id,detail.tracks[1].id,detail.tracks.at(-1).id],['1','2','203']);
  assert.deepEqual(seen,[100,100,2]);
});
test('新接口空 URL 时检查旧接口；两者均空时报资源不可用',async()=>{
  let count=0;
  const api=new MusicApi('https://example.com',mockFetch(url=>{
    count++;
    return {code:200,data:[{url:url.pathname==='/song/url'?'https://example.com/test.mp3':null}]};
  }));
  assert.equal(await api.audioUrl('1'),'https://example.com/test.mp3');
  assert.equal(count,2);
});
