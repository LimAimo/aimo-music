import test from 'node:test';
import assert from 'node:assert/strict';
import { readLrc, parseLrc, activeLyricIndex, formatTime } from '../client/src/core/lyrics.js';
import { nextQueueIndex, ShuffleHistory, appendToQueue, pushRecent } from '../client/src/core/queue.js';
import { readPersisted, savePersisted } from '../client/src/core/storage.js';

test('LRC 毫秒、重复时间戳和 offset 正确解析',()=>{
  const result=readLrc('[ar:test]\n[offset:+200]\n[00:01.25][00:03.500]第一句\n[00:06.00]第二句');
  assert.equal(result.length,3);
  assert.equal(result[0].time,1.45);
  assert.equal(result[1].time,3.7);
});
test('翻译按时间合并，时间轴二分定位',()=>{
  const parsed=parseLrc('[00:01.00]你好\n[00:03.00]再见','[00:01.00]Hello\n[00:03.00]Goodbye');
  assert.equal(parsed[0].translation,'Hello');
  assert.equal(activeLyricIndex(parsed,2),0);
  assert.equal(activeLyricIndex(parsed,3),1);
  assert.equal(activeLyricIndex(parsed,0),-1);
});
test('时间格式处理空值和小时累计',()=>{
  assert.equal(formatTime(Number.NaN),'0:00');
  assert.equal(formatTime(3601),'60:01');
});
test('队列循环、随机和单曲循环',()=>{
  const s={queue:[{id:'1'},{id:'2'},{id:'3'}],queueIndex:2,repeat:'off',shuffle:false};
  assert.equal(nextQueueIndex(s),-1);
  assert.equal(nextQueueIndex({...s,repeat:'all'}),0);
  assert.equal(nextQueueIndex({...s,repeat:'one'}),-1);
  assert.equal(nextQueueIndex({...s,repeat:'one'},1,Math.random,'ended'),2);
  assert.equal(nextQueueIndex({...s,repeat:'one',queueIndex:1}),2);
  assert.equal(nextQueueIndex({...s,shuffle:true},1,()=>0),0);
});
test('最近播放去重且保序，加入队列不更改原数组',()=>{
  const song={id:'b'};
  assert.deepEqual(pushRecent([{id:'a'},{id:'b'}],song).map(s=>s.id),['b','a']);
  const a=[{id:'1'}];const next=appendToQueue(a,song);
  assert.equal(a.length,1);assert.equal(next.length,2);
});
test('本地存储损坏时回退，保存及恢复关键设置',()=>{
  const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  map.set('aimo-music-v1','{not json}');
  assert.equal(readPersisted(storage).settings.volume,.75);
  const data=readPersisted(storage);data.repeat='one';data.settings.theme='dark';
  assert.equal(savePersisted(data,storage),true);
  assert.equal(readPersisted(storage).settings.theme,'dark');
  assert.equal(readPersisted(storage).repeat,'one');
});

test('随机队列每轮不重复，上一首回放历史，前进复用历史', () => {
  const history = new ShuffleHistory(() => 0);
  history.reset([{id:'a'},{id:'b'},{id:'c'}], 1);
  assert.equal(history.next('off'),0);
  assert.equal(history.next('off'),2);
  assert.equal(history.next('off'),-1);
  assert.equal(history.previous(),0);
  assert.equal(history.next('off'),2);
  assert.equal(history.next('all'),0);
});
test('超长队列可添加并保持索引', () => {
  const tracks = Array.from({length:501},(_,i)=>({id:String(i)}));
  assert.equal(appendToQueue(tracks,{id:'501'}).length,502);
});
test('存储设置及队列恢复需校验非法值',()=>{
  const state={queue:[{id:'a',title:'A',source:'remote'}],queueIndex:500,settings:{volume:2,theme:'unexpected',apiMode:'invalid',apiBase:'javascript:1'},shuffle:'false'};
  const storage={getItem:()=>JSON.stringify(state)};
  const recovered=readPersisted(storage);
  assert.equal(recovered.queueIndex,-1);
  assert.equal(recovered.settings.volume,1);
  assert.equal(recovered.settings.theme,'system');
  assert.equal(recovered.settings.apiMode,'auto');
  assert.equal(recovered.shuffle,false);
  assert.match(recovered.settings.apiBase,/^https:/);
});
