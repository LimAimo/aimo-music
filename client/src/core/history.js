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
  const {id,title,artist,album,cover,source,providerNamespace,duration}=track;
  return transaction('readwrite',store=>store.add({
    track:{id,title,artist,album,cover,source,providerNamespace,duration},
    playedAt:Date.now()
  }));
}
export async function readPlayHistory({limit=100,before=Infinity}={}) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const result=[];
    const range=Number.isFinite(before)?IDBKeyRange.upperBound(before,true):null;
    const req=tx.objectStore(STORE).index('playedAt').openCursor(range,'prev');
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
