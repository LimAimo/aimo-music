const KEY = 'aimo-music-v1';
export const defaultSettings = Object.freeze({
  theme: 'system', volume: 0.75, quality: 'standard',
  apiBase: 'https://music.20110208.xyz',
  apiMode: 'auto',
});

export function readPersisted(storage = globalThis.localStorage) {
  let raw = {};
  try { raw = JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { /* 旧数据损坏时安全回退 */ }
  return {
    favorites: Array.isArray(raw.favorites) ? raw.favorites.filter(isTrack).slice(0, 2000) : [],
    recent: Array.isArray(raw.recent) ? raw.recent.filter(isTrack).slice(0, 60) : [],
    queue: Array.isArray(raw.queue) ? raw.queue.filter(isTrack).slice(0, 500) : [],
    queueIndex: Number.isInteger(raw.queueIndex) ? raw.queueIndex : -1,
    repeat: ['off', 'all', 'one'].includes(raw.repeat) ? raw.repeat : 'off',
    shuffle: Boolean(raw.shuffle),
    settings: { ...defaultSettings, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) },
  };
}
export function savePersisted(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify({
      favorites: state.favorites.filter(s => s.source !== 'local' || !s.unavailable),
      recent: state.recent,
      queue: state.queue,
      queueIndex: state.queueIndex,
      repeat: state.repeat,
      shuffle: state.shuffle,
      settings: state.settings,
    }));
    return true;
  } catch { return false; }
}
export function isTrack(t) {
  return !!t && typeof t.id === 'string' && typeof t.title === 'string' && (t.source === 'local' || t.source === 'remote');
}

// IndexedDB 是本地文件唯一持久化位置；localStorage 仅保存歌曲元数据。
const DB_NAME = 'aimo-music-audio';
const STORE = 'files';
function dbOpen() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('当前浏览器不支持本地文件持久化'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact(mode, cb) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = cb(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function saveLocalFile(track, blob) { return transact('readwrite', s => s.put({ id: track.id, track, blob })); }
export async function loadLocalFiles() { return (await transact('readonly', s => s.getAll())).map(row => row.track); }
export async function loadLocalBlob(id) { return (await transact('readonly', s => s.get(id)))?.blob || null; }
export async function removeLocalFile(id) { return transact('readwrite', s => s.delete(id)); }
