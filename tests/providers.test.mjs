import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROFILES, STATION_NCM_PRESET, EXAMPLE_RULES, validateProfile, validateRules,
  sanitizeProfiles, readPath, trackIdentity, ManagedMusicApi, CustomMusicApi,
  exportProfiles, importProfiles,
} from '../client/src/api/providers.js';
import { readPersisted, sanitizeSettings } from '../client/src/core/storage.js';
import { pushRecent } from '../client/src/core/queue.js';
import { settingsMarkup, songRow, playlistCard } from '../client/src/ui/render.js';

const json = (data,status=200) => ({ok:status>=200&&status<300,status,json:async()=>data});
const base = (id,base,namespace='netease') => ({id,name:id,type:'netease',base,namespace,enabled:true,rules:{}});
const custom = (id, rules=structuredClone(EXAMPLE_RULES)) => ({id,name:id,type:'custom',base:'https://custom.example/v1',namespace:id,enabled:true,rules});

test('迁移旧接口地址到默认服务，损坏的列表不会导致设置崩溃',()=>{
  const s=sanitizeSettings({apiBase:'https://legacy.example/api'});
  assert.equal(s.apiProfiles[0].base,'https://legacy.example/api');
  assert.equal(s.apiProfiles[0].namespace,'netease');
  assert.equal(s.apiSwitchMode,'auto');
  assert.equal(sanitizeProfiles([{id:'',base:'javascript:1'}]).length,1);
  assert.equal(readPersisted({getItem:()=>JSON.stringify({settings:{apiSwitchMode:'none',apiProfiles:[{}]}})}).settings.apiProfiles.length,1);
});

test('JSON 安全字段路径支持列表和索引，但不读取原型',()=>{
  assert.deepEqual(readPath({a:[{name:'甲'},{name:'乙'}]},'a[].name'),['甲','乙']);
  assert.equal(readPath({items:[{url:'ok'}]},'items.0.url'),'ok');
  assert.equal(readPath({},'constructor.prototype'),undefined);
  assert.equal(readPath({__proto__:{password:'x'}},'__proto__.password'),undefined);
});

test('自定义规则映射 GET，字段兼容毫秒与歌手数组',async()=>{
  const seen=[];
  const p=custom('vendor');
  const api=new CustomMusicApi(p,async (url,opts)=>{
    seen.push({url:new URL(url),opts});
    return json({code:200,result:{songs:[{id:'x',name:'曲目',artists:[{name:'歌手一'},{name:'歌手二'}],album:{name:'专辑',picUrl:'https://img.example/c.png'},duration:200000}]}});
  });
  const songs=await api.searchSongs('你好 / world');
  assert.equal(seen[0].url.pathname,'/v1/search');
  assert.equal(seen[0].url.searchParams.get('keywords'),'你好 / world');
  assert.equal(songs[0].artist,'歌手一 / 歌手二');
  assert.equal(songs[0].duration,200);
  assert.equal(songs[0].providerNamespace,'vendor');
});

test('自定义 POST JSON 的变量插入与音频地址提取',async()=>{
  const rules=structuredClone(EXAMPLE_RULES);
  rules.endpoints.audioUrl={path:'media/url',method:'POST',body:{id:'{{id}}',quality:'{{quality}}'},url:'data.audio'};
  const received=[];
  const api=new CustomMusicApi(custom('vendor',rules),async (url,opts)=>{received.push({url,opts});return json({code:200,data:{audio:'https://cdn.example/music.mp3'}});});
  assert.equal(await api.audioUrl('abc','exhigh'),'https://cdn.example/music.mp3');
  assert.deepEqual(JSON.parse(received[0].opts.body),{id:'abc',quality:'exhigh'});
  assert.equal(received[0].opts.credentials,'omit');
});

test('绝不运行任意 JS、不发送凭据或跳出 API 根路径',()=>{
  assert.throws(()=>validateRules({...structuredClone(EXAMPLE_RULES),endpoints:{...EXAMPLE_RULES.endpoints,searchSongs:{path:'../escape',items:'result.songs'}}}),/path 无效/);
  assert.throws(()=>validateRules({...structuredClone(EXAMPLE_RULES),endpoints:{...EXAMPLE_RULES.endpoints,aBad:{path:'evil'}}}),/未知操作/);
  assert.throws(()=>validateProfile({...custom('x'),base:'javascript:alert(1)'}),/地址/);
  const rules=structuredClone(EXAMPLE_RULES);
  rules.endpoints.searchSongs.headers={Authorization:'Bearer PRIVATE'};
  assert.throws(()=>new CustomMusicApi(custom('x',rules)),/密钥|非法字段名/);
  const withKey=structuredClone(EXAMPLE_RULES);
  withKey.endpoints.searchSongs.query.api_key='MY_KEY';
  assert.throws(()=>validateRules(withKey),/密钥/);
});

test('主服务 503 失败时自动切换同命名空间备用服务',async()=>{
  const paths=[];
  const client=new ManagedMusicApi(async url=>{
    const u=new URL(url);paths.push(u.host);
    if(u.host==='down.example')return json({error:'down'},503);
    if(u.pathname.includes('search'))return json({code:200,result:{songs:[{id:42,name:'备用歌曲'}]}});
    return json({code:200,data:[{url:'https://cdn.example/42.mp3'}]});
  });
  client.configure({apiProfiles:[base('a','https://down.example'),base('b','https://good.example')],activeApiId:'a',apiSwitchMode:'auto',apiMode:'direct'});
  const songs=await client.searchSongs('音乐');
  assert.deepEqual(paths,['down.example','down.example','good.example']); // 网易云搜索先尝试 search 和 cloudsearch
  assert.equal(songs[0].providerId,'b');
  assert.equal(client.lastFallback.to,'b');
  assert.equal(await client.audioUrl(songs[0].id,'standard',null,songs[0].providerId,songs[0].providerNamespace),'https://cdn.example/42.mp3');
});

test('同一个歌曲 ID 的不同命名空间不能相互顶替、收藏和最近记录不能冲突',async()=>{
  const hit=[];
  const client=new ManagedMusicApi(async url=>{hit.push(new URL(url).hostname);return json({code:200,data:[{url:'https://cdn.example/x.mp3'}]});});
  client.configure({apiProfiles:[base('a','https://a.example','net'),base('b','https://b.example','other')],activeApiId:'a',apiSwitchMode:'auto'});
  const a={id:'17',source:'remote',providerId:'a',providerNamespace:'net'};
  const b={id:'17',source:'remote',providerId:'b',providerNamespace:'other'};
  assert.notEqual(trackIdentity(a),trackIdentity(b));
  assert.notEqual(trackIdentity({...a,source:'local'}),trackIdentity({...a,providerNamespace:'local'}));
  assert.equal(pushRecent([a],b).length,2);
  await client.audioUrl('17','standard',null,'b','other');
  assert.deepEqual(hit,['b.example']);
});

test('手动模式不故障切换；业务 403 不尝试绕过',async()=>{
  const seen=[];
  const client=new ManagedMusicApi(async url=>{seen.push(new URL(url).hostname);return json({code:403},403);});
  client.configure({apiProfiles:[base('a','https://a.example'),base('b','https://b.example')],activeApiId:'a',apiSwitchMode:'manual'});
  await assert.rejects(()=>client.audioUrl('1','standard'),/403/);
  assert.deepEqual(seen,['a.example','a.example']);
  seen.length=0;
  client.configure({apiProfiles:[base('a','https://a.example'),base('b','https://b.example')],activeApiId:'a',apiSwitchMode:'auto'});
  await assert.rejects(()=>client.audioUrl('1','standard'),/403/);
  assert.deepEqual(seen,['a.example','a.example']);
});

test('优先级模式按列表顺序；导入导出保留所有配置并拒绝恶意文件',async()=>{
  const seen=[];
  const client=new ManagedMusicApi(async url=>{seen.push(new URL(url).hostname);return json({code:200,result:{songs:[{id:3,name:'成功'}]}});});
  client.configure({apiProfiles:[base('first','https://first.example'),base('second','https://second.example')],activeApiId:'second',apiSwitchMode:'priority'});
  const res=await client.searchSongs('歌');assert.equal(res[0].providerId,'first');assert.deepEqual(seen,['first.example']);
  const exported=exportProfiles([base('first','https://first.example'),custom('vendor')]);
  const imported=importProfiles(exported);assert.equal(imported.length,2);assert.equal(imported[1].type,'custom');
  assert.throws(()=>importProfiles(JSON.stringify({format:'aimomusic-api-profiles',version:1,profiles:[imported[0],imported[0]]})),/重复/);
  assert.throws(()=>importProfiles('{bad-json'),/JSON/);
});

test('CurrentStation 手动预设保持用户文档给出的 /cm/ncm 路径',()=>{
  assert.equal(STATION_NCM_PRESET.base,'https://music.20110208.xyz/cm/ncm');
  assert.equal(STATION_NCM_PRESET.namespace,DEFAULT_PROFILES[0].namespace);
  assert.match(playlistCard({id:'44',title:'好歌单',providerId:'station',providerNamespace:'netease'}),/data-provider-id="station"/);
  assert.match(songRow({id:'3',title:'曲目',artist:'歌手',source:'remote',providerNamespace:'custom1'},0),/data-namespace="custom1"/);
  const state={settings:{theme:'system',quality:'standard',apiMode:'auto',apiProfiles:[DEFAULT_PROFILES[0]],apiSwitchMode:'auto',activeApiId:'netease-default'},apiView:'manager'};
  assert.match(settingsMarkup(state),/api-manager-form/);
  assert.match(settingsMarkup(state),/CurrentStation/);
});


test('CurrentStation 新响应结构与逐行歌词适配',async()=>{
  const {StationMusicApi}=await import('../client/src/api/providers.js');
  const api=new StationMusicApi('https://music.20110208.xyz/cm/ncm',async url=>{
    const u=new URL(url);
    if(u.pathname.endsWith('/search'))return json({songs:[{ncm_id:9,name:'测试',artists:'歌手',album:'专辑',pic:'https://example.org/p.png',duration:123000}]});
    if(u.pathname.endsWith('/lyric'))return json({lines:[{t:1234,txt:'你好',trans:'Hello'}]});
    if(u.pathname.endsWith('/song/detail'))return json({songs:[{ncm_id:9,name:'测试'}]});
    if(u.pathname.endsWith('/song/url/v1'))return json({code:200,data:[{id:9,url:null,code:404}]});
    return json({});
  });
  const songs=await api.searchSongs('测试');assert.equal(songs[0].id,'9');assert.equal(songs[0].duration,123);
  const lyrics=await api.lyrics(9);assert.match(lyrics.original,/\[00:01\.234\]你好/);assert.match(lyrics.translation,/Hello/);
  await assert.rejects(()=>api.audioUrl(9),/暂无可用播放地址/);
});
