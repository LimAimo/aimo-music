import { sanitizeProfiles, BUILTIN_ID } from '../api/providers.js';
import { validateBindings } from './keyboard.js';
const KEY = 'aimo-music-v1';
export const defaultSettings = Object.freeze({
  theme: 'system', volume: 0.75, quality: 'standard', ambient: 'glow', miniTransparency: 55,
  apiBase: 'https://music.20110208.xyz/cm/ncm',
  apiMode: 'auto',
  activeApiId: BUILTIN_ID, apiSwitchMode: 'auto',
});

const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;
export function sanitizeSettings(candidate) {
  const raw = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
  const volume = Number(raw.volume);
  let apiBase = defaultSettings.apiBase;
  if (typeof raw.apiBase === 'string' && raw.apiBase.length <= 2048) {
    try {
      const url = new URL(raw.apiBase);
      if ((url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) && !url.username && !url.password && !url.search && !url.hash) apiBase = url.toString().replace(/\/$/, '');
    } catch { /* 数据异常则保留默认接口 */ }
  }
  return {
    theme: allowed(raw.theme, ['system','light','dark'], defaultSettings.theme),
    ambient: allowed(raw.ambient,['glow','blur','gradient','single','off'],'glow'),
    miniTransparency: raw.miniTransparency==null||!Number.isFinite(Number(raw.miniTransparency)) ? 55 : Math.round(Math.max(0,Math.min(100,Number(raw.miniTransparency)))),
    shortcuts:validateBindings(raw.shortcuts),
    quality: allowed(raw.quality, ['standard','higher','exhigh','lossless'], defaultSettings.quality),
    apiMode: allowed(raw.apiMode, ['auto','direct','proxy'], defaultSettings.apiMode),
    apiBase,
    apiProfiles: sanitizeProfiles(raw.apiProfiles, apiBase),
    activeApiId: typeof raw.activeApiId === 'string' ? raw.activeApiId : BUILTIN_ID,
    apiSwitchMode: allowed(raw.apiSwitchMode, ['auto','manual','priority'], 'auto'),
    volume: raw.volume == null || !Number.isFinite(volume) ? defaultSettings.volume : Math.min(1,Math.max(0,volume)),
  };
}
export function readPersisted(storage = globalThis.localStorage) {
  let raw = {};
  try { raw = JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { /* 安全回退 */ }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  const queue = Array.isArray(raw.queue) ? raw.queue.filter(isTrack) : [];
  return {
    favorites: Array.isArray(raw.favorites) ? raw.favorites.filter(isTrack).slice(0, 2000) : [],
    recent: Array.isArray(raw.recent) ? raw.recent.filter(isTrack).slice(0, 60) : [],
    queue,
    queueIndex: Number.isInteger(raw.queueIndex) && raw.queueIndex >= 0 && raw.queueIndex < queue.length ? raw.queueIndex : -1,
    repeat: allowed(raw.repeat, ['off','all','one'], 'off'),
    shuffle: raw.shuffle === true,
    settings: sanitizeSettings(raw.settings),
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
      settings: sanitizeSettings(state.settings),
    }));
    return true;
  } catch { return false; }
}
export function isTrack(t) {
  return !!t && typeof t.id === 'string' && typeof t.title === 'string' && (t.source === 'local' || t.source === 'remote');
}

// 从旧版 files 存储读取元数据时仍可访问旧 Blob；新版 metadata 独立存储，不复制大文件。
const DB_NAME = 'aimo-music-audio';
const STORE = 'files';
const META_STORE = 'metadata';
function dbOpen() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('当前浏览器不支持本地文件持久化'));
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = event => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' });
      // 旧版迁移：游标逐条复制元数据，避免把 Blob 复制到新表。
      if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE)) {
        const source = request.transaction.objectStore(STORE);
        const meta = request.transaction.objectStore(META_STORE);
        source.openCursor().onsuccess = event => {
          const cursor = event.target.result;
          if (cursor) { if (cursor.value?.track) meta.put({id:cursor.key,track:cursor.value.track}); cursor.continue(); }
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact(stores, mode, cb) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const req = cb(tx);
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function saveLocalFile(track, blob) {
  return transact([STORE,META_STORE], 'readwrite', tx => {
    tx.objectStore(STORE).put({id:track.id,blob});
    return tx.objectStore(META_STORE).put({id:track.id,track});
  });
}
export async function loadLocalFiles() {
  return (await transact([META_STORE], 'readonly', tx => tx.objectStore(META_STORE).getAll())).map(row => row.track).filter(isTrack);
}
export async function loadLocalBlob(id) { return (await transact([STORE], 'readonly', tx => tx.objectStore(STORE).get(id)))?.blob || null; }
export async function removeLocalFile(id) {
  return transact([STORE,META_STORE], 'readwrite', tx => {
    tx.objectStore(STORE).delete(id);
    return tx.objectStore(META_STORE).delete(id);
  });
}
