import { MusicApi, DEFAULT_API_BASE, validateApiBase } from './api/music.js';
import { parseLrc, activeLyricIndex, formatTime } from './core/lyrics.js';
import { readPersisted, savePersisted, saveLocalFile, loadLocalFiles, loadLocalBlob, removeLocalFile } from './core/storage.js';
import { nextQueueIndex, appendToQueue, pushRecent } from './core/queue.js';
import { bindSegmentedControl } from './ui/controls.js';
import { showConfirmDialog } from './ui/dialog.js';
import { icon } from './ui/icons.js';
import {
  header, shellMarkup, homeMarkup, searchMarkup, libraryMarkup, playlistMarkup,
  playerMarkup, fullPlayerMarkup, queueMarkup, settingsMarkup, escapeHtml
} from './ui/render.js';

const app = document.getElementById('app');
const audio = document.getElementById('audio-engine');
const filePicker = document.getElementById('local-file-picker');
const saved = readPersisted();
const state = {
  ...saved,
  view: 'home', backView: 'home',
  current: saved.queue[saved.queueIndex] || null,
  playing: false, buffering: false, time: 0, duration: 0,
  fullOpen: false, fullPanel: 'cover', queueOpen: false, settingsOpen: false,
  featured: [], featuredLoading: true,
  searchType: 'songs', searchQuery: '', searchSongs: [], searchPlaylists: [], searchLoading: false, searchError: '',
  libraryTab: 'favorites', localFiles: [],
  playlistId: null, playlist: null, playlistLoading: false, playlistError: '',
  lyrics: [], lyricsLoading: false, lyricsError: '', activeLyric: -1,
};
const api = new MusicApi();
let searchController = null;
let playlistController = null;
let playController = null;
let playToken = 0;
let localObjectUrl = null;
let audioTrackId = null;
let audioRetry = false;
let bindHeader = null;
let bindPage = null;
let lyricScrollSuspendUntil = 0;
let toastTimer = null;
let themeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');

function actualApiMode(settings = state.settings) {
  if (settings.apiMode !== 'auto') return settings.apiMode;
  return import.meta.env?.DEV ? 'proxy' : 'direct';
}
function configureApi() {
  const base = actualApiMode() === 'proxy' ? '/music-api' : state.settings.apiBase || DEFAULT_API_BASE;
  api.setBase(base);
}
function persist() { savePersisted(state); }
function toast(message, kind = 'normal') {
  const slot = document.getElementById('toast-slot');
  if (!slot) return;
  clearTimeout(toastTimer);
  slot.innerHTML = `<div class="toast ${kind==='error'?'toast--error':''}">${escapeHtml(message)}</div>`;
  toastTimer = setTimeout(() => { slot.innerHTML = ''; }, 4300);
}
function isFavorite(song) { return state.favorites.some(s => s.id === song.id); }
function currentTheme() {
  return state.settings.theme === 'system' ? (themeMedia?.matches ? 'dark' : 'light') : state.settings.theme;
}
function applyTheme() {
  const theme = currentTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171613' : '#F2EDE4');
}
function renderHeader() {
  bindHeader?.();
  const slot = document.getElementById('header-slot');
  slot.innerHTML = header(state.view, currentTheme());
  bindHeader = bindSegmentedControl(slot.querySelector('.segmented'), value => navigate(value));
  const el = document.getElementById('app-header');
  const update = () => el?.classList.toggle('is-scrolled', window.scrollY > 12);
  update();
}
function renderPage({ restoreFocus = false } = {}) {
  bindPage?.(); bindPage = null;
  const main = document.getElementById('main-view');
  const focusedSearch = restoreFocus && document.activeElement?.id === 'search-input';
  const cursor = focusedSearch ? document.activeElement.selectionStart : null;
  main.innerHTML = state.view === 'search' ? searchMarkup(state)
    : state.view === 'library' ? libraryMarkup(state)
    : state.view === 'playlist' ? playlistMarkup(state)
    : homeMarkup(state);
  const segmented = main.querySelector('.segmented');
  if (segmented) bindPage = bindSegmentedControl(segmented, value => {
    if (state.view === 'search') {
      if (value !== state.searchType) {
        state.searchType = value;
        renderPage();
        if (value === 'playlists' && state.searchQuery && !state.searchPlaylists.length) runSearch();
      }
    } else if (state.view === 'library') {
      state.libraryTab = value; renderPage();
    }
  });
  if (focusedSearch) {
    const input = main.querySelector('#search-input');
    input?.focus({ preventScroll: true });
    if (typeof cursor === 'number') input?.setSelectionRange(cursor, cursor);
  }
}
function renderPlayer() { document.getElementById('player-slot').innerHTML = playerMarkup(state); updateProgress(); }
function renderOverlay() {
  const slot = document.getElementById('overlay-slot');
  const oldLyricViewport = document.getElementById('lyric-viewport');
  const oldScroll = oldLyricViewport?.scrollTop ?? 0;
  const previousTrackId = slot.dataset.currentId;
  slot.innerHTML = (state.fullOpen ? fullPlayerMarkup(state) : '')
    + (state.queueOpen ? queueMarkup(state) : '')
    + (state.settingsOpen ? settingsMarkup(state) : '');
  document.body.classList.toggle('overlay-open', state.fullOpen || state.queueOpen || state.settingsOpen);
  const newLyricViewport = document.getElementById('lyric-viewport');
  if (newLyricViewport && previousTrackId === state.current?.id) newLyricViewport.scrollTop = oldScroll;
  slot.dataset.currentId = state.current?.id || '';
  updateProgress();
  updateLyricHighlight(previousTrackId !== state.current?.id);
}
function updatePlayingButtons() {
  renderPlayer();
  const fullPlay = document.querySelector('.transport-play-full');
  if (fullPlay) { fullPlay.innerHTML = icon(state.playing ? 'pause' : 'play', 26); fullPlay.setAttribute('aria-label', state.playing ? '暂停' : '播放'); }
  updateProgress();
}
function updateProgress() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : (state.current?.duration || state.duration || 0);
  state.duration = duration;
  for (const id of ['seek-bar', 'full-seek']) {
    const input = document.getElementById(id);
    if (input && !input.matches(':active')) {
      input.value = String(duration ? Math.min(1000, Math.floor(state.time / duration * 1000)) : 0);
      input.style.setProperty('--seek-fill', `${duration ? state.time / duration * 100 : 0}%`);
    }
  }
  for (const id of ['current-time','full-current-time']) {
    const node = document.getElementById(id); if (node) node.textContent = formatTime(state.time);
  }
  for (const id of ['duration-time','full-duration-time']) {
    const node = document.getElementById(id); if (node) node.textContent = formatTime(duration);
  }
  const mobile = document.querySelector('#mobile-progress span');
  if (mobile) mobile.style.width = `${duration ? state.time / duration * 100 : 0}%`;
}
function updateLyricHighlight(force = false) {
  if (!state.lyrics.length) return;
  const index = activeLyricIndex(state.lyrics, state.time);
  if (!force && state.activeLyric === index) return;
  state.activeLyric = index;
  const viewport = document.getElementById('lyric-viewport');
  if (!viewport) return;
  const active = viewport.querySelector(`[data-lyric-index="${index}"]`);
  viewport.querySelectorAll('.lyric-line.is-current').forEach(node => { if (node !== active) node.classList.remove('is-current'); });
  if (active) active.classList.add('is-current');
  if (active && Date.now() > lyricScrollSuspendUntil) {
    const top = active.offsetTop - viewport.offsetTop - viewport.clientHeight * 0.39;
    viewport.scrollTo({ top: Math.max(0, top), behavior: force || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
}
function navigate(view) {
  if (!['home', 'search', 'library'].includes(view)) return;
  state.view = view;
  searchController?.abort();
  playlistController?.abort();
  renderHeader(); renderPage();
  if (view === 'home' && !state.featured.length && !state.featuredLoading) loadFeatured();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
async function loadFeatured() {
  state.featuredLoading = true;
  if (state.view === 'home') renderPage();
  try {
    state.featured = await api.discoverPlaylists();
  } catch {
    // 首页推荐不可用不是致命错误，搜索与本地播放器仍可使用。
    state.featured = [];
  } finally {
    state.featuredLoading = false;
    if (state.view === 'home') renderPage();
  }
}
async function runSearch(query = state.searchQuery) {
  query = String(query || '').trim();
  if (query !== state.searchQuery) { state.searchSongs = []; state.searchPlaylists = []; }
  state.searchQuery = query;
  if (!query) { state.searchSongs = []; state.searchPlaylists = []; state.searchError=''; renderPage(); return; }
  searchController?.abort();
  const controller = new AbortController(); searchController = controller;
  const selectedType = state.searchType;
  state.searchLoading = true; state.searchError = '';
  renderPage();
  try {
    if (selectedType === 'songs') state.searchSongs = await api.searchSongs(query, controller.signal);
    else state.searchPlaylists = await api.searchPlaylists(query, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) return;
    state.searchError = error.message || '请求失败';
  } finally {
    if (searchController === controller) { state.searchLoading = false; renderPage(); }
  }
}
async function openPlaylist(id) {
  const backView = state.view === 'search' ? 'search' : state.view === 'library' ? 'library' : 'home';
  state.view='playlist'; state.backView=backView; state.playlistId=id; state.playlistLoading=true; state.playlistError=''; state.playlist=null;
  playlistController?.abort();
  const controller = new AbortController(); playlistController=controller;
  renderHeader(); renderPage(); window.scrollTo({top:0,behavior:'instant'});
  try { state.playlist = await api.playlistDetail(id,controller.signal); }
  catch (err) { if (controller.signal.aborted) return; state.playlistError=err.message || '网络请求失败'; }
  finally { if (playlistController===controller) { state.playlistLoading=false; renderPage(); } }
}
async function loadLyricsFor(song) {
  state.lyrics=[]; state.activeLyric=-1; state.lyricsError='';
  if (song.source === 'local') { state.lyricsLoading=false; renderOverlay(); return; }
  state.lyricsLoading=true; renderOverlay();
  const token=playToken;
  try {
    const data=await api.lyrics(song.id,playController?.signal);
    if (token!==playToken) return;
    state.lyrics=parseLrc(data.original,data.translation);
  } catch (error) {
    if (token!==playToken) return;
    state.lyricsError='歌词暂时无法获取。';
  } finally { if (token===playToken) { state.lyricsLoading=false; renderOverlay(); } }
}

function updateMediaSession(song) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata=new MediaMetadata({ title:song.title, artist:song.artist, album:song.album||'', artwork:song.cover?[{src:song.cover,sizes:'512x512'}]:[] });
    navigator.mediaSession.setActionHandler('play',()=>resume());
    navigator.mediaSession.setActionHandler('pause',()=>pause());
    navigator.mediaSession.setActionHandler('previoustrack',()=>previous());
    navigator.mediaSession.setActionHandler('nexttrack',()=>next());
    navigator.mediaSession.setActionHandler('seekto',details=>seek(details.seekTime));
  } catch { /* 不支持完整 Media Session 的浏览器继续使用 HTMLAudioElement */ }
}
function cleanLocalObjectUrl() {
  if (localObjectUrl) { URL.revokeObjectURL(localObjectUrl); localObjectUrl=null; }
}
async function playIndex(index, { forceRefresh = false } = {}) {
  const song=state.queue[index];
  if (!song) return;
  ++playToken;
  playController?.abort();
  playController=new AbortController();
  const token=playToken;
  if (!forceRefresh) audioRetry=false;
  const previousId=audioTrackId;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  cleanLocalObjectUrl();
  audioTrackId=null;
  state.queueIndex=index; state.current=song; state.time=0; state.duration=song.duration||0;
  state.playing=false; state.buffering=true; persist();
  state.recent=pushRecent(state.recent,song); persist();
  renderPlayer(); renderPage(); renderOverlay();
  updateMediaSession(song);
  void loadLyricsFor(song);
  let url;
  try {
    if (song.source === 'local') {
      const blob=await loadLocalBlob(song.id);
      if (!blob) throw new Error('找不到本地音频文件，请重新导入。');
      if (token!==playToken) return;
      url=URL.createObjectURL(blob); localObjectUrl=url;
    } else url=await api.audioUrl(song.id,state.settings.quality,playController.signal);
    if (token!==playToken) { if (song.source==='local' && localObjectUrl===url) cleanLocalObjectUrl(); return; }
    audio.src=url;
    audioTrackId=song.id;
    audio.volume=state.settings.volume;
    state.buffering=false;
    try { await audio.play(); }
    catch (error) {
      if (token!==playToken) return;
      if (error.name==='NotAllowedError') toast('浏览器阻止了自动播放，请点击播放按钮。');
      else if (error.name!=='AbortError') toast('播放失败，请尝试下一首。','error');
      state.playing=false;
    }
  } catch (error) {
    if (token!==playToken) return;
    state.buffering=false; state.playing=false;
    toast(error.message || '播放失败，请重试。','error');
  } finally { if (token===playToken) { renderPlayer(); renderOverlay(); } }
}
function playCollection(songs, index) {
  if (!songs.length || index<0) return;
  state.queue=songs.map(({favorite,unavailable,...song})=>song).slice(0,500);
  void playIndex(index);
}
function resume() {
  if (!state.current) return toast('先搜索或导入一首音乐。');
  if (!audioTrackId || audioTrackId!==state.current.id) return void playIndex(state.queueIndex);
  audio.play().catch(() => toast('播放失败，请点击重试。','error'));
}
function pause() { audio.pause(); }
function seek(time) {
  if (!state.current || !audioTrackId || !Number.isFinite(time)) return;
  audio.currentTime=Math.min(audio.duration || time,Math.max(0,time));
  state.time=audio.currentTime; updateProgress(); updateLyricHighlight(true);
}
function next() {
  const index=nextQueueIndex(state,1);
  if (index<0) { pause(); return; }
  void playIndex(index);
}
function previous() {
  if (audio.currentTime>3) { seek(0);return; }
  const index=nextQueueIndex(state,-1);
  if (index>=0) void playIndex(index);
  else seek(0);
}
function toggleFavorite(song) {
  if (!song) return;
  state.favorites=isFavorite(song) ? state.favorites.filter(s=>s.id!==song.id) : [song,...state.favorites].slice(0,2000);
  persist(); renderPage(); renderOverlay();
  toast(isFavorite(song)?'已加入我喜欢的音乐':'已取消收藏');
}
function findSong(context,id) {
  const groups={
    searchSongs:state.searchSongs, favorites:state.favorites, recent:state.recent,
    local:state.localFiles,playlist:state.playlist?.tracks||[],
  };
  return (groups[context]||[]).find(track=>track.id===id);
}
async function importFiles(files) {
  const accepted=[...files].filter(file=>file.type.startsWith('audio/')||/\.(mp3|m4a|aac|flac|ogg|wav|opus)$/i.test(file.name));
  if (!accepted.length) return toast('请选择有效的音频文件。','error');
  let success=0;
  for (const file of accepted) {
    if (file.size > 250*1024*1024) { toast(`${file.name} 超过 250MB，已跳过。`,'error'); continue; }
    const track={id:`local:${crypto.randomUUID()}`,title:file.name.replace(/\.[^.]+$/,'')||file.name,artist:'本地音乐',album:'我的设备',cover:'',duration:0,source:'local'};
    try {
      await saveLocalFile(track,file);
      state.localFiles.unshift(track); success++;
    } catch {
      // IndexedDB 不可用时，不宣称导入成功：无法保证刷新后的文件仍存在。
      toast(`${file.name} 未能保存，可能是浏览器存储空间不足。`,'error');
    }
  }
  if (success) { state.view='library';state.libraryTab='local';renderHeader();renderPage();toast(`已导入 ${success} 首本地歌曲。`); }
}
async function deleteLocal(id) {
  const target=state.localFiles.find(t=>t.id===id);
  if (!target) return;
  const confirmed=await showConfirmDialog('移除本地歌曲',`将「${target.title}」从当前浏览器的音乐库中删除。此操作不会删除设备上的原文件。`,{confirm:'移除',destructive:true});
  if (!confirmed) return;
  try {
    await removeLocalFile(id);
    state.localFiles=state.localFiles.filter(t=>t.id!==id);
    state.favorites=state.favorites.filter(t=>t.id!==id);
    state.recent=state.recent.filter(t=>t.id!==id);
    const old=state.queueIndex;
    const removedBefore=state.queue.slice(0,old).filter(t=>t.id===id).length;
    const isCurrent=state.current?.id===id;
    state.queue=state.queue.filter(t=>t.id!==id);
    state.queueIndex=Math.min(Math.max(-1,old-removedBefore),state.queue.length-1);
    if (isCurrent) { ++playToken;playController?.abort();audio.pause();audio.removeAttribute('src');audio.load();audioTrackId=null;cleanLocalObjectUrl();state.current=null;state.queueIndex=-1;state.playing=false;state.lyrics=[]; }
    persist();renderPage();renderPlayer();renderOverlay();toast('本地歌曲已移除。');
  } catch { toast('移除失败，请检查浏览器存储权限。','error'); }
}
function closeTopOverlay() {
  if (state.settingsOpen) {state.settingsOpen=false;renderOverlay();return;}
  if (state.queueOpen) {state.queueOpen=false;renderOverlay();return;}
  if (state.fullOpen) {state.fullOpen=false;renderOverlay();}
}

function handleAction(button) {
  const action=button.dataset.action;
  const id=button.dataset.id;
  const context=button.dataset.context;
  const index=Number(button.dataset.index);
  switch(action) {
    case 'navigate': navigate(button.dataset.view);break;
    case 'import': filePicker.click();break;
    case 'cycle-theme': {
      state.settings.theme=currentTheme()==='dark'?'light':'dark';applyTheme();persist();renderHeader();break;
    }
    case 'settings': state.settingsOpen=true;renderOverlay();document.getElementById('theme-setting')?.focus();break;
    case 'close-settings':state.settingsOpen=false;renderOverlay();break;
    case 'test-api':void testApi();break;
    case 'suggest-search':state.view='search';state.searchType='songs';renderHeader();void runSearch(button.dataset.query);break;
    case 'retry-search':void runSearch();break;
    case 'open-playlist':void openPlaylist(id);break;
    case 'retry-playlist':void openPlaylist(state.playlistId);break;
    case 'play-playlist':playCollection(state.playlist?.tracks||[],0);break;
    case 'play-row': {
      const list={searchSongs:state.searchSongs,recent:state.recent,favorites:state.favorites,local:state.localFiles,playlist:state.playlist?.tracks||[]}[context]||[];
      if (list[index]) playCollection(list,index);
      break;
    }
    case 'favorite':toggleFavorite(findSong(context,id));break;
    case 'favorite-current':toggleFavorite(state.current);break;
    case 'queue-add': {
      const song=findSong(context,id);
      if (!song)return;
      state.queue=appendToQueue(state.queue,song);persist();renderOverlay();toast('已加入播放队列');break;
    }
    case 'local-delete':void deleteLocal(id);break;
    case 'toggle-play': state.playing?pause():resume();break;
    case 'prev':previous();break;
    case 'next':next();break;
    case 'shuffle':state.shuffle=!state.shuffle;persist();renderPlayer();renderOverlay();toast(state.shuffle?'随机播放已开启':'随机播放已关闭');break;
    case 'repeat':state.repeat=({off:'all',all:'one',one:'off'})[state.repeat];persist();renderPlayer();renderOverlay();toast(({off:'循环播放已关闭',all:'列表循环',one:'单曲循环'})[state.repeat]);break;
    case 'open-full':if(state.current){state.fullOpen=true;state.fullPanel='cover';renderOverlay();}break;
    case 'close-full':state.fullOpen=false;renderOverlay();break;
    case 'open-lyrics':if(state.current){state.fullOpen=true;state.fullPanel='lyrics';renderOverlay();}break;
    case 'toggle-lyrics':state.fullPanel=state.fullPanel==='lyrics'?'cover':'lyrics';renderOverlay();break;
    case 'open-queue':state.queueOpen=true;renderOverlay();break;
    case 'close-queue':state.queueOpen=false;renderOverlay();break;
    case 'queue-play':void playIndex(index);break;
    case 'queue-remove':{
      if(index<0||index>=state.queue.length)return;
      if(index===state.queueIndex) {
        ++playToken;playController?.abort();audio.pause();audio.removeAttribute('src');audio.load();cleanLocalObjectUrl();audioTrackId=null;
        state.current=null;state.playing=false;state.queueIndex=-1;state.time=0;
      } else if(index<state.queueIndex) state.queueIndex--;
      state.queue.splice(index,1);persist();renderPlayer();renderOverlay();break;
    }
    case 'queue-clear':{
      void showConfirmDialog('清空播放队列','将移除所有待播放歌曲，当前正在播放的歌曲也会停止。',{confirm:'清空',destructive:true}).then(yes=>{
        if(!yes)return; ++playToken;playController?.abort();audio.pause();audio.removeAttribute('src');audio.load();cleanLocalObjectUrl();audioTrackId=null;
        state.queue=[];state.queueIndex=-1;state.current=null;state.time=0;state.duration=0;state.playing=false;
        state.queueOpen=false;state.fullOpen=false;persist();renderPlayer();renderOverlay();
      });break;
    }
    case 'seek-lyric':seek(Number(button.dataset.time));break;
  }
}
async function testApi() {
  const result=document.getElementById('api-test-result');
  const form=document.getElementById('settings-form');
  if(!result||!form)return;
  let candidate;
  try {
    const data=new FormData(form);
    const mode=data.get('apiMode')==='auto'?(import.meta.env?.DEV?'proxy':'direct'):data.get('apiMode');
    candidate=new MusicApi(mode==='proxy'?'/music-api':validateApiBase(String(data.get('apiBase'))));
  } catch(err) {result.textContent=err.message;return;}
  result.textContent='正在检测接口……';
  try {
    await candidate.get('search',{keywords:'音乐',limit:1,type:1});
    result.textContent='接口连接成功。播放地址及跨域音频仍需实际歌曲验证。';
  }catch(err){result.textContent=`连接失败：${err.message}`;}
}

app.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');
  if(!button||!app.contains(button))return;
  handleAction(button);
});
app.addEventListener('submit',e=>{
  if(e.target.id==='search-form') {
    e.preventDefault();
    void runSearch(new FormData(e.target).get('q'));
  }
  if(e.target.id==='settings-form') {
    e.preventDefault();
    const data=new FormData(e.target);
    let base;
    try {base=validateApiBase(String(data.get('apiBase')));} catch(err){toast(err.message,'error');return;}
    state.settings={...state.settings,theme:String(data.get('theme')),quality:String(data.get('quality')),apiMode:String(data.get('apiMode')),apiBase:base};
    try {configureApi();}catch(err){toast(err.message,'error');return;}
    applyTheme();persist();state.settingsOpen=false;renderHeader();renderOverlay();toast('设置已保存');
    if(state.view==='home')loadFeatured();
  }
});
app.addEventListener('input',e=>{
  if(e.target.id==='volume-slider') {
    const volume=Math.max(0,Math.min(1,Number(e.target.value)));
    state.settings.volume=volume;audio.volume=volume;persist();
    const node=e.target.closest('.volume-control')?.querySelector('svg');if(node)node.outerHTML=icon(volume===0?'mute':'volume',19);
  }
  if(e.target.id==='seek-bar'||e.target.id==='full-seek') {
    const sec=(audio.duration||state.duration||0)*Number(e.target.value)/1000;
    e.target.style.setProperty('--seek-fill',`${e.target.value/10}%`);
    const label=document.getElementById(e.target.id==='full-seek'?'full-current-time':'current-time');
    if(label)label.textContent=formatTime(sec);
  }
});
app.addEventListener('change',e=>{
  if(e.target.id==='seek-bar'||e.target.id==='full-seek')seek((audio.duration||state.duration||0)*Number(e.target.value)/1000);
});
app.addEventListener('wheel',e=>{if(e.target.closest('#lyric-viewport'))lyricScrollSuspendUntil=Date.now()+5000;},{passive:true});
app.addEventListener('pointerdown',e=>{if(e.target.closest('#lyric-viewport'))lyricScrollSuspendUntil=Date.now()+5000;},{passive:true});
app.addEventListener('error',e=>{
  if(e.target.matches('.album-art img')){e.target.parentElement?.classList.add('image-failed');e.target.remove();}
},true);
filePicker.addEventListener('change',e=>{void importFiles(e.target.files);e.target.value='';});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeTopOverlay();return;}
  if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
  if(e.code==='Space'&&state.current){e.preventDefault();state.playing?pause():resume();}
  if(e.altKey&&e.key==='ArrowRight')next();
  if(e.altKey&&e.key==='ArrowLeft')previous();
});
window.addEventListener('scroll',()=>document.getElementById('app-header')?.classList.toggle('is-scrolled',window.scrollY>12),{passive:true});
themeMedia?.addEventListener('change',()=>{if(state.settings.theme==='system'){applyTheme();renderHeader();}});

audio.addEventListener('timeupdate',()=>{state.time=audio.currentTime||0;updateProgress();updateLyricHighlight();});
audio.addEventListener('loadedmetadata',()=>{state.duration=Number.isFinite(audio.duration)?audio.duration:(state.current?.duration||0);updateProgress();});
audio.addEventListener('play',()=>{state.playing=true;updatePlayingButtons();});
audio.addEventListener('pause',()=>{state.playing=false;updatePlayingButtons();});
audio.addEventListener('waiting',()=>{state.buffering=true;});
audio.addEventListener('playing',()=>{state.buffering=false;});
audio.addEventListener('ended',()=>{if(state.repeat==='one') {seek(0);resume();}else next();});
audio.addEventListener('error',()=>{
  if(!state.current||!audioTrackId)return;
  if(state.current.source==='remote'&&!audioRetry){
    audioRetry=true;
    const index=state.queueIndex;
    toast('播放中断，正在重新获取地址……');
    void playIndex(index,{forceRefresh:true});
  }else{state.playing=false;renderPlayer();toast('音频无法播放。可尝试切换音质或播放其他歌曲。','error');}
});

async function init() {
  app.innerHTML=shellMarkup();
  try {configureApi();} catch {state.settings.apiBase=DEFAULT_API_BASE;state.settings.apiMode='direct';configureApi();}
  applyTheme();audio.volume=state.settings.volume;
  renderHeader();renderPage();renderPlayer();
  try {state.localFiles=await loadLocalFiles();if(state.view==='library')renderPage();}catch{ /* 浏览器隐私模式可能不可用 */ }
  void loadFeatured();
}
void init();
