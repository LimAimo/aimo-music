// Stale-while-revalidate with bounded retries. Audio requests are intentionally excluded.
const NAME='aimo-network-cache',STORE='entries';
const pending=new Map();
const waiting=[];let running=0;
function flush(){
 while(running<4&&waiting.length){
  const job=waiting.shift();running++;
  Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{running--;flush();});
 }
}
function scheduled(key,load,signal){
 const current=pending.get(key);
 if(current&&!current.signal?.aborted)return current.promise;
 const promise=new Promise((resolve,reject)=>{waiting.push({work:()=>smartRetry(load,{signal}),resolve,reject});flush();});
 const item={promise,signal};pending.set(key,item);
 void promise.finally(()=>{if(pending.get(key)===item)pending.delete(key);}).catch(()=>{});
 return promise;
}
function open(){return new Promise((ok,fail)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'key'});r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);});}
async function cache(key,write){
 try{const db=await open();return await new Promise((ok,fail)=>{const tx=db.transaction(STORE,write?'readwrite':'readonly');const req=write?tx.objectStore(STORE).put({key,at:Date.now(),value:write}):tx.objectStore(STORE).get(key);tx.oncomplete=()=>{db.close();ok(req.result);};tx.onerror=()=>{db.close();fail(tx.error);};});}catch{return null;}
}
const isAborted=signal=>signal?.aborted;
function pause(ms,signal){return new Promise((resolve,reject)=>{if(isAborted(signal))return reject(new DOMException('请求已取消','AbortError'));const t=setTimeout(done,ms);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(t);signal?.removeEventListener('abort',abort);reject(new DOMException('请求已取消','AbortError'));}signal?.addEventListener('abort',abort,{once:true});});}
function waitOnline(signal){if(typeof navigator==='undefined'||navigator.onLine!==false)return Promise.resolve();return new Promise((resolve,reject)=>{const cleanup=()=>{globalThis.removeEventListener('online',online);signal?.removeEventListener('abort',abort);};const online=()=>{cleanup();resolve();},abort=()=>{cleanup();reject(new DOMException('请求已取消','AbortError'));};globalThis.addEventListener('online',online,{once:true});signal?.addEventListener('abort',abort,{once:true});});}
export async function smartRetry(load,{signal,retries=2}={}){
 for(let attempt=0;;attempt++){
  if(isAborted(signal))throw new DOMException('请求已取消','AbortError');
  await waitOnline(signal);
  try{return await load();}
  catch(error){if(isAborted(signal)||error?.name==='AbortError')throw error;
    const msg=String(error?.message||'');
    if(attempt>=retries||/\b(?:400|401|403|404|422)\b/.test(msg)||/权限|无版权|不可用|禁止访问/.test(msg))throw error;
    await pause(Math.min(5000,400*2**attempt),signal);
  }
 }
}
export async function cachedResource(key,load,{signal,onFresh,maxAgeDays=30}={}){
 const saved=await cache(key);
 const valid=saved&&Date.now()-saved.at<maxAgeDays*86400000;
 const getFresh=async()=>{
  const value=await scheduled(key,load,signal);
  await cache(key,value);
  return value;
 };
 if(valid){
  const current=saved.value;
  // A stale response is immediately usable, while refresh runs in the background.
  if(typeof navigator==='undefined'||navigator.onLine!==false){
   void getFresh().then(value=>{if(!isAborted(signal)&&JSON.stringify(value)!==JSON.stringify(current))onFresh?.(value);}).catch(()=>{});
  }
  return {value:current,cached:true};
 }
 if(isOffline())throw Error('当前离线且没有这部分内容的缓存，联网后会自动更新。');
 return {value:await getFresh(),cached:false};
}
export const isOffline=()=>typeof navigator!=='undefined'&&navigator.onLine===false;
