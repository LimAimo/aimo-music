import test from 'node:test';
import assert from 'node:assert/strict';
import {smartRetry,cachedResource} from '../client/src/api/resilience.js';
test('相同请求在首次加载时会去重',async()=>{
 let calls=0;
 const load=async()=>{calls++;await new Promise(r=>setTimeout(r,15));return ['甲'];};
 const key='dup-'+Date.now();
 const [a,b]=await Promise.all([cachedResource(key,load),cachedResource(key,load)]);
 assert.deepEqual(a.value,['甲']);assert.deepEqual(b.value,['甲']);assert.equal(calls,1);
});
test('业务权限错误不自动重试',async()=>{
 let n=0;
 await assert.rejects(()=>smartRetry(async()=>{n++;throw Error('HTTP 403');}),/403/);
 assert.equal(n,1);
});
test('成功资源立即返回且不破坏源数据',async()=>{
 const data={songs:[{id:'1'}]};
 assert.deepEqual((await cachedResource('unique-'+Date.now(),async()=>data)).value,data);
});
