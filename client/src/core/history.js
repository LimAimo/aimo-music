// 独立的追加式播放历史，不修改旧版 localStorage 或音频数据库。
const NAME = 'aimo-music-library';
const STORE = 'play-history';
const open = () => new Promise((resolve,reject) => {
  if (!globalThis.indexedDB) return reject(new Error('浏览器不支持 IndexedDB'));
  const req = indexedDB.open(NAME,1);
  req.onupgradeneeded = () => {
    const db=req.result;
    if (!db.objectStoreNames.contains(STORE)) {
      const store=db.createObjectStore(STORE,{keyPath:'entryId',autoIncrement:true});
      store.createIndex('playedAt','playedAt');
    }
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});
const transaction = async (mode,callback) => {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    let req;
    try {req=callback(tx.objectStore(STORE));}catch(error){db.close();reject(error);return;}
    tx.oncomplete=()=>{db.close();resolve(req?.result);};
    tx.onerror=()=>{db.close();reject(tx.error);};
    tx.onabort=()=>{db.close();reject(tx.error);};
  });
};
export async function recordPlayHistory(track) {
  if (!track || typeof track.id!=='string') return;
  const {id,title,artist,album,cover,source,providerNamespace,providerId,duration}=track;
  return transaction('readwrite',store=>store.add({
    track:{id,title,artist,album,cover,source,providerNamespace,providerId,duration},
    playedAt:Date.now()
  }));
}
export async function readPlayHistory({limit=100,before=Infinity,beforeId=null}={}) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const result=[];
    const range=beforeId!=null?IDBKeyRange.upperBound(beforeId,true):Number.isFinite(before)?IDBKeyRange.upperBound(before,true):null;
    const req=beforeId!=null?tx.objectStore(STORE).openCursor(range,'prev'):tx.objectStore(STORE).index('playedAt').openCursor(range,'prev');
    req.onsuccess=()=>{
      const cursor=req.result;
      if(!cursor||result.length>=Math.min(500,Math.max(1,limit)))return;
      result.push(cursor.value);cursor.continue();
    };
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
export async function clearPlayHistory(){return transaction('readwrite',store=>store.clear());}

export async function allPlayHistory(){
 const rows=[];let beforeId=null;
 for(;;){const page=await readPlayHistory({limit:500,beforeId});if(!page.length)break;rows.push(...page);beforeId=page.at(-1).entryId;if(page.length<500)break;}
 return rows;
}
export async function replaceHistory(rows){
 if(!Array.isArray(rows)||rows.length>1000000)throw Error('历史文件太大');
 const db=await open();return new Promise((yes,no)=>{
  const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.clear();
  for(const row of rows)if(row?.track?.id&&Number.isFinite(row.playedAt))s.add({track:row.track,playedAt:row.playedAt});
  tx.oncomplete=()=>{db.close();yes();};tx.onerror=()=>{db.close();no(tx.error);};
 });
}
