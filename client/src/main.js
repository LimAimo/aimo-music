import { networkLog, installNetworkDebug } from './api/network-debug.js';
import { versionInfo } from './version.js';
import { MusicApi, DEFAULT_API_BASE } from './api/music.js';
import { ManagedMusicApi, CustomMusicApi, BUILTIN_ID, STATION_NCM_PRESET, EXAMPLE_RULES, validateProfile, importProfiles, exportProfiles, MAX_PROFILES, trackIdentity } from './api/providers.js';
import { parseLrc, activeLyricIndex, formatTime } from './core/lyrics.js';
import { readPersisted, savePersisted, saveLocalFile, loadLocalFiles, loadLocalBlob, removeLocalFile } from './core/storage.js';
import { nextQueueIndex, appendToQueue, pushRecent, ShuffleHistory } from './core/queue.js';
import { bindSegmentedControl } from './ui/controls.js';
import { showConfirmDialog } from './ui/dialog.js';
import { icon } from './ui/icons.js';
import {
  header, shellMarkup, homeMarkup, homeRecentMarkup, featuredMarkup, searchMarkup, libraryMarkup, playlistMarkup,
  playerMarkup, fullPlayerMarkup, queueMarkup, settingsMarkup, lyricMarkup, libraryContentMarkup, searchResultsMarkup, escapeHtml
} from './ui/render.js';

const app = document.getElementById('app');
let devTapCount=0;
let developerMode=sessionStorage.getItem('aimo-dev-mode')==='1';
globalThis.__AIMO_DEV__=developerMode;
installNetworkDebug();
const audio = document.getElementById('audio-engine');
const filePicker = document.getElementById('local-file-picker');
const saved = readPersisted();
const state = {
  ...saved,
  view: 'home', backView: 'home',
  current: saved.queue[saved.queueIndex] || null,
  playing: false, buffering: false, time: 0, duration: 0,
  fullOpen: false, fullPanel: 'cover', queueOpen: false, settingsOpen: false,
  featured: [], featuredLoading: true, featuredFailed: false,
  searchType: 'songs', searchQuery: '', searchSongs: [], searchPlaylists: [], searchLoading: false, searchError: '',
  libraryTab: 'favorites', localFiles: [],
  playlistId: null, playlist: null, playlistLoading: false, playlistError: '',
  lyrics: [], lyricsLoading: false, lyricsError: '', activeLyric: -1,
  apiView: 'settings', apiEditingId: null, apiDraft: null, apiFallback: null, playlistProviderId: null, playlistNamespace: null,
};
const api = new ManagedMusicApi();
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
const shuffleHistory = new ShuffleHistory();
shuffleHistory.reset(state.queue, state.queueIndex);
let activeDialog = null;
let focusBeforeOverlay = null;
let searchVersion = 0;

let themeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');

function actualApiMode(settings = state.settings) {
  if (settings.apiMode !== 'auto') return settings.apiMode;
  return import.meta.env?.DEV ? 'proxy' : 'direct';
}
function configureApi() {
  api.configure({...state.settings, apiMode: actualApiMode()});
  state.apiFallback = api.lastFallback;
}
function persist() { savePersisted(state); }
function toast(message, kind = 'normal') {
  const slot = document.getElementById('toast-slot');
  if (!slot) return;
  clearTimeout(toastTimer);
  slot.innerHTML = `<div class="toast ${kind==='error'?'toast--error':''}">${escapeHtml(message)}</div>`;
  toastTimer = setTimeout(() => { slot.innerHTML = ''; }, 4300);
}
function isFavorite(song) { return state.favorites.some(s => trackIdentity(s) === trackIdentity(song)); }
function currentTheme() {
  return state.settings.theme === 'system' ? (themeMedia?.matches ? 'dark' : 'light') : state.settings.theme;
}
function applyTheme() {
  const theme = currentTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171613' : '#F2EDE4');
}
function renderHeader() {
  const slot = document.getElementById('header-slot');
  const tab = state.view === 'playlist' ? state.backView : state.view;
  // 固定顶栏只装配一次。销毁并重建它会打断正在进行的滑块动画。
  if (!slot.firstElementChild) {
    slot.innerHTML = header(tab, currentTheme());
    bindHeader = bindSegmentedControl(slot.querySelector('.segmented'), value => navigate(value));
  } else {
    bindHeader?.setValue?.(tab);
  }
  const el = document.getElementById('app-header');
  el?.classList.toggle('is-scrolled', window.scrollY > 12);
}
function updateLibraryContent({ animate = false } = {}) {
  const target = document.getElementById('library-content');
  if (!target) return;
  target.innerHTML = libraryContentMarkup(state);
  if (animate) {
    target.classList.remove('is-changing');
    void target.offsetWidth;
    target.classList.add('is-changing');
  }
  const fav = document.querySelector('.library-segmented [data-value="favorites"]');
  if (fav) {
    const label = `我喜欢的 · ${state.favorites.length}`;
    fav.querySelector('.seg-label').textContent = label;
    fav.querySelector('.seg-text-invert').textContent = label;
  }
}
function updateSearchResults() {
  const target = document.getElementById('search-results');
  if (target) target.innerHTML = searchResultsMarkup(state);
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
    if (state.view === 'search' && value !== state.searchType) {
      state.searchType = value;
      updateSearchResults();
      if (value === 'playlists' && state.searchQuery && !state.searchPlaylists.length) void runSearch(state.searchQuery, { preserveTabs: true });
      if (value === 'songs' && state.searchQuery && !state.searchSongs.length) void runSearch(state.searchQuery, { preserveTabs: true });
    } else if (state.view === 'library' && value !== state.libraryTab) {
      state.libraryTab = value;
      updateLibraryContent({ animate: true });
    }
  });
  if (focusedSearch) {
    const input = main.querySelector('#search-input');
    input?.focus({ preventScroll: true });
    if (typeof cursor === 'number') input?.setSelectionRange(cursor, cursor);
  }
}
function renderPlayer() { document.getElementById('player-slot').innerHTML = playerMarkup(state); updateProgress(); }
function refreshRows() {
  document.querySelectorAll('#main-view .song-row').forEach(row => {
    const isCurrent = row.dataset.songId === state.current?.id && (row.dataset.namespace || 'netease') === (state.current?.source === 'local' ? 'local' : state.current?.providerNamespace || 'netease');
    row.classList.toggle('is-current', isCurrent);
    const number = row.querySelector('.song-index');
    const button = row.querySelector('[data-action="play-row"]');
    if (number && button) number.innerHTML = isCurrent && state.playing
      ? '<span class="playing-bars"><i></i><i></i><i></i></span>'
      : String(Number(button.dataset.index) + 1).padStart(2, '0');
  });
  document.querySelectorAll('#main-view [data-action="favorite"]').forEach(button => {
    const favorite = state.favorites.some(song => song.id === button.dataset.id && (song.source==='local'?'local':song.providerNamespace||'netease') === (button.dataset.namespace || 'netease'));
    button.classList.toggle('is-favorite', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    button.setAttribute('aria-label', favorite ? '取消喜欢' : '喜欢');
    button.title = favorite ? '取消喜欢' : '喜欢';
  });
}
function updateFeatured() {
  const target = document.getElementById('featured-playlists');
  if (target) target.innerHTML = featuredMarkup(state);
}
function refreshRecent() {
  if (state.view === 'home') {
    const target = document.querySelector('.home-main');
    if (target) target.innerHTML = homeRecentMarkup(state);
  } else if (state.view === 'library' && state.libraryTab === 'recent') updateLibraryContent();
}
function refreshBuffering() {
  document.querySelectorAll('[data-action="toggle-play"]').forEach(button => {
    button.classList.toggle('is-buffering', state.buffering);
    button.setAttribute('aria-busy', String(state.buffering));
    if (state.buffering) button.setAttribute('aria-label', '正在加载音频');
    else button.setAttribute('aria-label', state.playing ? '暂停' : '播放');
  });
}
function activeOverlay() {
  return document.querySelector('#settings-overlay:not(.is-leaving) .settings-panel')
    || document.querySelector('#queue-overlay:not(.is-leaving) .queue-panel')
    || document.querySelector('#full-player:not(.is-leaving)');
}
function synchronizeModalFocus() {
  const panel = activeOverlay();
  for (const id of ['header-slot','main-view','player-slot']) {
    const target = document.getElementById(id);
    if (target) target.inert = Boolean(panel);
  }
  const full = document.getElementById('full-player');
  const queue = document.querySelector('#queue-overlay .queue-panel');
  if (full) full.inert = Boolean(queue || document.getElementById('settings-overlay'));
  if (queue) queue.inert = Boolean(document.getElementById('settings-overlay'));
  if (panel !== activeDialog) {
    if (panel) {
      if (!activeDialog) focusBeforeOverlay = document.activeElement;
      const focused = panel.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
      focused?.focus({preventScroll:true});
    } else focusBeforeOverlay?.isConnected && focusBeforeOverlay?.focus({preventScroll:true});
    activeDialog = panel;
  }
}

function refreshOverlayLock() {
  document.body.classList.toggle('overlay-open', Boolean(document.querySelector('#overlay-slot .full-overlay, #overlay-slot .dialog-overlay, #overlay-slot .queue-panel')));
}
function dismissOverlay(node, delay = 350) {
  if (!node || node.classList.contains('is-leaving')) return;
  node.classList.add('is-leaving');
  const timeout = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : delay;
  setTimeout(() => { node.remove(); refreshOverlayLock(); synchronizeModalFocus(); }, timeout);
}
function renderOverlay() {
  const slot = document.getElementById('overlay-slot');
  const trackId = String(state.current?.id || '');
  let full = slot.querySelector('#full-player:not(.is-leaving)');
  let recreatedFull = false;
  if (!state.fullOpen || !state.current) {
    dismissOverlay(full);
  } else {
    if (full && full.dataset.trackId !== trackId) { full.remove(); full = null; }
    if (!full) {
      slot.querySelector('#full-player.is-leaving')?.remove();
      slot.insertAdjacentHTML('beforeend', fullPlayerMarkup(state));
      full = slot.querySelector('#full-player:not(.is-leaving)');
      if (full) { full.dataset.trackId = trackId; recreatedFull = true; }
    }
    if (full) {
      const lyrics = full.querySelector('#lyric-viewport');
      const key = JSON.stringify([state.lyricsLoading, state.lyricsError, state.lyrics]);
      if (lyrics && full.dataset.lyricsKey !== key) {
        const previousScroll = lyrics.scrollTop;
        lyrics.innerHTML = lyricMarkup(state);
        lyrics.scrollTop = previousScroll;
        full.dataset.lyricsKey = key;
      }
      const showLyrics = state.fullPanel === 'lyrics';
      full.querySelector('#full-lyric-section')?.classList.toggle('show-on-mobile', showLyrics);
      // full-player 内只有一个完整播放按钮，更新其图标即可。
      const fullPlay = full.querySelector('.transport-play-full');
      if (fullPlay) fullPlay.innerHTML = icon(state.playing ? 'pause' : 'play', 26);
      full.querySelectorAll('[data-action="toggle-lyrics"]').forEach(button => {
        const heading = button.closest('.lyric-heading');
        button.innerHTML = heading ? (showLyrics ? '返回封面' : '歌词') : `${icon('lyric',18)} ${showLyrics ? '返回封面' : '打开歌词'}`;
      });
      const favorite = full.querySelector('[data-action="favorite-current"]');
      favorite?.classList.toggle('is-favorite', isFavorite(state.current));
      favorite?.setAttribute('aria-pressed', String(isFavorite(state.current)));
      for (const action of ['shuffle', 'repeat']) {
        const button = full.querySelector(`[data-action="${action}"]`);
        if (button) {
          button.classList.toggle('is-active', action === 'shuffle' ? state.shuffle : state.repeat !== 'off');
          button.innerHTML = icon(action === 'shuffle' ? 'shuffle' : state.repeat === 'one' ? 'repeatOne' : 'repeat', 20);
          button.setAttribute('aria-pressed', String(action === 'shuffle' ? state.shuffle : state.repeat !== 'off'));
          button.setAttribute('aria-label', action === 'shuffle' ? (state.shuffle ? '关闭随机播放' : '开启随机播放') : ({off:'不循环',all:'列表循环',one:'单曲循环'})[state.repeat]);
        }
      }
    }
  }
  let queue = slot.querySelector('#queue-overlay:not(.is-leaving)');
  if (!state.queueOpen) dismissOverlay(queue);
  else if (!queue) {
    slot.querySelector('#queue-overlay.is-leaving')?.remove();
    slot.insertAdjacentHTML('beforeend', `<div id="queue-overlay" class="queue-overlay">${queueMarkup(state)}</div>`);
  } else {
    const template = document.createElement('div');
    template.innerHTML = queueMarkup(state);
    const current = queue.querySelector('.queue-list');
    const top = current?.scrollTop || 0;
    if (current) {
      current.innerHTML = template.querySelector('.queue-list').innerHTML;
      current.scrollTop = top;
    }
    queue.querySelector('.queue-top h2 small').textContent = String(state.queue.length);
    const newFooter = template.querySelector('.queue-footer');
    queue.querySelector('.queue-footer')?.remove();
    if (newFooter) queue.querySelector('.queue-panel').append(newFooter);
  }
  let settings = slot.querySelector('#settings-overlay:not(.is-leaving)');
  if (!state.settingsOpen) dismissOverlay(settings);
  else if (!settings) {
    slot.querySelector('#settings-overlay.is-leaving')?.remove();
    slot.insertAdjacentHTML('beforeend', settingsMarkup(state));
  }
  refreshOverlayLock();
  synchronizeModalFocus();
  refreshBuffering();
  updateProgress();
  updateLyricHighlight(recreatedFull);
}
function updatePlayingButtons() {
  renderPlayer();
  const fullPlay = document.querySelector('.transport-play-full');
  if (fullPlay) { fullPlay.innerHTML = icon(state.playing ? 'pause' : 'play', 26); fullPlay.setAttribute('aria-label', state.playing ? '暂停' : '播放'); }
  refreshBuffering();
  refreshRows();
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
function navigate(view, { record = true } = {}) {
  if (!['home', 'search', 'library'].includes(view)) return;
  state.view = view;
  if (record) window.history.pushState({view}, '', window.location.href);
  searchController?.abort();
  playlistController?.abort();
  renderHeader(); renderPage();
  if (view === 'home' && !state.featured.length && !state.featuredLoading) loadFeatured();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
async function loadFeatured() {
  state.featuredLoading = true;
  updateFeatured();
  try {
    state.featured = await api.discoverPlaylists();state.apiFallback=api.lastFallback;
    state.featuredFailed = false;
  } catch {
    // 首页推荐不可用不是致命错误，搜索与本地播放器仍可使用。
    state.featured = [];
    state.featuredFailed = true;
  } finally {
    state.featuredLoading = false;
    updateFeatured();
  }
}
async function runSearch(query = state.searchQuery, { preserveTabs = false } = {}) {
  query = String(query || '').trim();
  if (query !== state.searchQuery) { state.searchSongs = []; state.searchPlaylists = []; }
  state.searchQuery = query;
  searchController?.abort();
  const version = ++searchVersion;
  if (!query) { state.searchSongs = []; state.searchPlaylists = []; state.searchError=''; state.searchLoading=false; renderPage(); return; }
  const controller = new AbortController(); searchController = controller;
  const selectedType = state.searchType;
  state.searchLoading = true; state.searchError = '';
  if (preserveTabs) updateSearchResults(); else renderPage({ restoreFocus: true });
  try {
    const results = selectedType === 'songs'
      ? await api.searchSongs(query, controller.signal)
      : await api.searchPlaylists(query, controller.signal);
    if (version !== searchVersion || controller.signal.aborted) return;
    state.apiFallback=api.lastFallback;
    if (selectedType === 'songs') state.searchSongs = results;
    else state.searchPlaylists = results;
  } catch (error) {
    if (controller.signal.aborted) return;
    state.searchError = developerMode ? `${error.name || 'Error'}: ${error.message || String(error)} | API: ${api.activeId} | 来源: ${api.profile(api.activeId)?.base || '未知'}` : (error.message || '请求失败');
  } finally {
    if (searchController === controller && version === searchVersion) { state.searchLoading = false; if (preserveTabs) updateSearchResults(); else renderPage({ restoreFocus: true }); }
  }
}
async function openPlaylist(id, { record = true, providerId = null, namespace = null } = {}) {
  const backView = state.view === 'search' ? 'search' : state.view === 'library' ? 'library' : 'home';
  if (record) window.history.pushState({view:'playlist',id,providerId,namespace}, '', window.location.href);
  state.view='playlist'; state.backView=backView; state.playlistId=id; state.playlistProviderId=providerId; state.playlistNamespace=namespace; state.playlistLoading=true; state.playlistError=''; state.playlist=null;
  playlistController?.abort();
  const controller = new AbortController(); playlistController=controller;
  renderHeader(); renderPage(); window.scrollTo({top:0,behavior:'instant'});
  try { state.playlist = await api.playlistDetail(id,controller.signal,state.playlistProviderId,state.playlistNamespace); state.apiFallback=api.lastFallback; }
  catch (err) { if (controller.signal.aborted) return; state.playlistError=err.message || '网络请求失败'; }
  finally { if (playlistController===controller) { state.playlistLoading=false; renderPage(); } }
}
async function loadLyricsFor(song) {
  state.lyrics=[]; state.activeLyric=-1; state.lyricsError='';
  if (song.source === 'local') { state.lyricsLoading=false; renderOverlay(); return; }
  state.lyricsLoading=true; renderOverlay();
  const token=playToken;
  try {
    const data=await api.lyrics(song.id,playController?.signal,song.providerId,song.providerNamespace);
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
async function playIndex(index, { forceRefresh = false, fromNavigation = false } = {}) {
  const song=state.queue[index];
  if (!song) return;
  if (!fromNavigation) shuffleHistory.reset(state.queue, index);
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
  renderPlayer(); refreshRows(); renderOverlay();
  updateMediaSession(song);
  void loadLyricsFor(song);
  let url;
  try {
    if (song.source === 'local') {
      const blob=await loadLocalBlob(song.id);
      if (!blob) throw new Error('找不到本地音频文件，请重新导入。');
      if (token!==playToken) return;
      url=URL.createObjectURL(blob); localObjectUrl=url;
    } else url=await api.audioUrl(song.id,state.settings.quality,playController.signal,song.providerId,song.providerNamespace);
    if (token!==playToken) { if (song.source==='local' && localObjectUrl===url) cleanLocalObjectUrl(); return; }
    audio.src=url;
    audioTrackId=song.id;
    audio.volume=state.settings.volume;
    try { await audio.play(); }
    catch (error) {
      if (token!==playToken) return;
      state.buffering=false;
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
  state.queue=songs.map(({favorite,unavailable,...song})=>song);
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
function next(reason = 'manual') {
  const index=reason === 'ended' && state.repeat === 'one' ? state.queueIndex
    : state.shuffle ? shuffleHistory.next(state.repeat) : nextQueueIndex(state,1,Math.random,reason);
  if (index<0) { pause(); return; }
  void playIndex(index, {fromNavigation:true});
}
function previous() {
  if (audio.currentTime>3) { seek(0);return; }
  const index=state.shuffle ? shuffleHistory.previous() : nextQueueIndex(state,-1);
  if (index>=0) void playIndex(index,{fromNavigation:true});
  else seek(0);
}
function toggleFavorite(song) {
  if (!song) return;
  state.favorites=isFavorite(song) ? state.favorites.filter(s=>trackIdentity(s)!==trackIdentity(song)) : [song,...state.favorites].slice(0,2000);
  persist(); if (state.view === 'library') updateLibraryContent(); else refreshRows(); renderOverlay();
  toast(isFavorite(song)?'已加入我喜欢的音乐':'已取消收藏');
}
function findSong(context,id,namespace) {
  const groups={
    searchSongs:state.searchSongs, favorites:state.favorites, recent:state.recent,
    local:state.localFiles,playlist:state.playlist?.tracks||[],
  };
  return (groups[context]||[]).find(track=>track.id===id && (!namespace || (track.source==='local'?'local':track.providerNamespace||'netease')===namespace));
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
    shuffleHistory.reset(state.queue,state.queueIndex);persist();updateLibraryContent();renderPlayer();renderOverlay();toast('本地歌曲已移除。');
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
    case 'settings': state.settingsOpen=true;state.apiView='settings';renderOverlay();document.getElementById('theme-setting')?.focus();break;
    case 'close-settings':state.settingsOpen=false;renderOverlay();break;
    case 'developer-tap': {devTapCount++;if(devTapCount>=5){developerMode=true;globalThis.__AIMO_DEV__=true;sessionStorage.setItem('aimo-dev-mode','1');toast('开发者模式已启用');document.getElementById('settings-overlay')?.remove();renderOverlay();}break;}
    case 'developer-export': {const blob=new Blob([JSON.stringify({version:versionInfo,origin:location.origin,entries:networkLog.entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='aimomusic-network-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
    case 'developer-clear': {networkLog.entries.length=0;document.getElementById('settings-overlay')?.remove();renderOverlay();break;}
    case 'developer-fullscreen': {document.getElementById('settings-overlay')?.classList.toggle('dev-fullscreen');break;}
    case 'developer-refresh': {document.getElementById('settings-overlay')?.remove();renderOverlay();break;}
    case 'developer-off': {developerMode=false;globalThis.__AIMO_DEV__=false;sessionStorage.removeItem('aimo-dev-mode');devTapCount=0;document.getElementById('settings-overlay')?.remove();renderOverlay();break;}
    case 'open-api-manager':openApiView('manager');break;
    case 'back-to-settings':openApiView('settings');break;
    case 'back-api-manager':openApiView('manager');break;
    case 'add-api':openApiView('editor',null,{id:`api-${Date.now()}`,name:'新音乐 API',type:'custom',base:'https://example.com/v1',namespace:`api_${Date.now()}`,enabled:true,rules:structuredClone(EXAMPLE_RULES)});break;
    case 'add-station-api':{
      if(state.settings.apiProfiles.some(p=>p.id===STATION_NCM_PRESET.id)){toast('已添加 CurrentStation 代理预设');break;}
      openApiView('editor',null,{...STATION_NCM_PRESET});break;
    }
    case 'edit-api':openApiView('editor',id);break;
    case 'toggle-api':changeProfiles(list=>list.map(p=>p.id===id?{...p,enabled:!p.enabled}:p));break;
    case 'move-api-up':reorderProfile(id,-1);break;
    case 'move-api-down':reorderProfile(id,1);break;
    case 'delete-api':void removeProfile(id);break;
    case 'test-profile':void testManagedProfile(id);break;
    case 'test-api-draft':void testApiDraft();break;
    case 'export-api':downloadProfiles();break;
    case 'import-api':void applyImportedProfiles();break;
    case 'suggest-search':state.view='search';state.searchType='songs';renderHeader();void runSearch(button.dataset.query);break;
    case 'retry-search':void runSearch();break;
    case 'retry-featured':void loadFeatured();break;
    case 'open-playlist':void openPlaylist(id,{providerId:button.dataset.providerId||null,namespace:button.dataset.namespace||null});break;
    case 'retry-playlist':void openPlaylist(state.playlistId);break;
    case 'play-playlist':playCollection(state.playlist?.tracks||[],0);break;
    case 'play-row': {
      const list={searchSongs:state.searchSongs,recent:state.recent,favorites:state.favorites,local:state.localFiles,playlist:state.playlist?.tracks||[]}[context]||[];
      if (list[index]) playCollection(list,index);
      break;
    }
    case 'favorite':toggleFavorite(findSong(context,id,button.dataset.namespace));break;
    case 'favorite-current':toggleFavorite(state.current);break;
    case 'queue-add': {
      const song=findSong(context,id,button.dataset.namespace);
      if (!song)return;
      state.queue=appendToQueue(state.queue,song);shuffleHistory.reset(state.queue,state.queueIndex);persist();renderOverlay();toast('已加入播放队列');break;
    }
    case 'local-delete':void deleteLocal(id);break;
    case 'toggle-play': state.playing?pause():resume();break;
    case 'prev':previous();break;
    case 'next':next();break;
    case 'shuffle':state.shuffle=!state.shuffle;shuffleHistory.reset(state.queue,state.queueIndex);persist();renderPlayer();renderOverlay();toast(state.shuffle?'随机播放已开启':'随机播放已关闭');break;
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
      state.queue.splice(index,1);shuffleHistory.reset(state.queue,state.queueIndex);persist();renderPlayer();renderOverlay();break;
    }
    case 'queue-clear':{
      void showConfirmDialog('清空播放队列','将移除所有待播放歌曲，当前正在播放的歌曲也会停止。',{confirm:'清空',destructive:true}).then(yes=>{
        if(!yes)return; ++playToken;playController?.abort();audio.pause();audio.removeAttribute('src');audio.load();cleanLocalObjectUrl();audioTrackId=null;
        state.queue=[];state.queueIndex=-1;state.current=null;state.time=0;state.duration=0;state.playing=false;
        state.queueOpen=false;state.fullOpen=false;shuffleHistory.reset([], -1);persist();renderPlayer();renderOverlay();
      });break;
    }
    case 'seek-lyric':seek(Number(button.dataset.time));break;
  }
}
function openApiView(view,id=null,draft=null) {
  state.apiView=view;
  state.apiEditingId=id;
  state.apiDraft=view==='editor'?(draft||state.settings.apiProfiles.find(p=>p.id===id)||null):null;
  document.getElementById('settings-overlay')?.remove();
  renderOverlay();
}
function changeProfiles(transform) {
  let next;
  try {
    next=transform(state.settings.apiProfiles.map(p=>({...p})));
    if(!Array.isArray(next) || !next.length || next.length>MAX_PROFILES)throw Error('请保留 1 至 20 个 API');
    next=next.map(validateProfile);
    if(!next.some(p=>p.enabled))throw Error('至少保留一个已启用的接口');
  } catch(err) {toast(err.message||'配置错误','error');return false;}
  state.settings.apiProfiles=next;
  if(!next.some(p=>p.id===state.settings.activeApiId&&p.enabled))state.settings.activeApiId=next.find(p=>p.enabled).id;
  configureApi();persist();openApiView('manager');
  state.featured=[];state.featuredLoading=false;state.searchSongs=[];state.searchPlaylists=[];
  toast('接口配置已保存');return true;
}
function reorderProfile(id, offset) {
  changeProfiles(list=>{const i=list.findIndex(p=>p.id===id);const j=i+offset;if(i<0||j<0||j>=list.length) return list;[list[i],list[j]]=[list[j],list[i]];return list;});
}
async function removeProfile(id) {
  const profile=state.settings.apiProfiles.find(p=>p.id===id);
  if(!profile)return;
  const ok=await showConfirmDialog('删除音乐 API',`确定删除「${profile.name}」吗？保存在音乐库里的该来源歌曲不会被删除，但如果找不到同命名空间的备用接口，可能无法播放。`,{confirm:'删除',destructive:true});
  if(ok)changeProfiles(list=>list.filter(p=>p.id!==id));
}
function draftFromForm() {
  const form=document.getElementById('api-profile-form');
  if(!form?.reportValidity()) throw Error('请填写完整的接口信息');
  const data=new FormData(form);
  const type=String(data.get('type'));
  let rules={};
  if(type==='custom'){
    try{rules=JSON.parse(String(data.get('rules')));}catch{throw Error('自定义规则不是有效 JSON');}
  }
  return validateProfile({id:String(data.get('id')),name:String(data.get('name')),base:String(data.get('base')),type,namespace:String(data.get('namespace')),enabled:data.has('enabled'),rules});
}
async function testManagedProfile(id) {
  const slot=document.getElementById(`api-status-${CSS.escape(id)}`);
  if(!slot)return;
  slot.textContent='正在检测歌曲搜索……';
  try {const res=await api.testProfile(id);slot.textContent=`搜索接口有效（返回 ${res.count} 首，约 ${res.latency} 毫秒）。播放地址仍须试听验证。`;}
  catch(err){slot.textContent=`失败：${err.message}`;}
}
async function testApiDraft() {
  const slot=document.getElementById('api-test-result');if(!slot)return;
  let profile;try{profile=draftFromForm();}catch(err){slot.textContent=err.message;return;}
  slot.textContent='正在检测搜索……';
  try {
    const candidate=profile.type==='custom'?new CustomMusicApi(profile):new MusicApi(profile.base);
    const tracks=await candidate.searchSongs('音乐');
    slot.textContent=`搜索请求成功，返回 ${tracks.length} 首歌曲。音频链接和跨域限制需要另外验证。`;
  }catch(err){slot.textContent=`测试失败：${err.message}`;}
}
async function applyImportedProfiles() {
  const target=document.getElementById('api-import-json');let profiles;
  try{profiles=importProfiles(target?.value||'');if(!profiles.some(p=>p.enabled))throw Error('导入列表至少需要一个已启用的接口');}
  catch(err){toast(err.message,'error');return;}
  const okay=await showConfirmDialog('导入 API 配置',`将使用导入的 ${profiles.length} 个接口替换当前列表。建议先导出配置备份。`,{confirm:'导入'});
  if(okay)changeProfiles(()=>profiles);
}
function downloadProfiles() {
  const blob=new Blob([exportProfiles(state.settings.apiProfiles)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='AimoMusic-API-配置.json';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
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
  if(e.target.id==='api-manager-form') {
    e.preventDefault();
    const data=new FormData(e.target);
    state.settings.apiSwitchMode=String(data.get('apiSwitchMode'));
    state.settings.activeApiId=String(data.get('activeApiId'));
    configureApi();persist();toast('切换策略已保存');openApiView('manager');
  }
  if(e.target.id==='api-profile-form') {
    e.preventDefault();
    let profile;try{profile=draftFromForm();}catch(err){toast(err.message,'error');return;}
    changeProfiles(list=>{
      const original=state.apiEditingId;
      if(original){const index=list.findIndex(p=>p.id===original);if(index<0)throw Error('原 API 不存在');list[index]=profile;}
      else {if(list.some(p=>p.id===profile.id))throw Error('接口 ID 已存在');list.push(profile);}
      return list;
    });
  }
  if(e.target.id==='settings-form') {
    e.preventDefault();
    const data=new FormData(e.target);
    state.settings={...state.settings,theme:String(data.get('theme')),quality:String(data.get('quality')),apiMode:String(data.get('apiMode'))};
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
  if(e.target.id==='profile-type')document.getElementById('custom-rules-block').hidden=e.target.value!=='custom';
  if(e.target.id==='seek-bar'||e.target.id==='full-seek')seek((audio.duration||state.duration||0)*Number(e.target.value)/1000);
});
app.addEventListener('wheel',e=>{if(e.target.closest('#lyric-viewport'))lyricScrollSuspendUntil=Date.now()+5000;},{passive:true});
app.addEventListener('pointerdown',e=>{if(e.target.closest('#lyric-viewport'))lyricScrollSuspendUntil=Date.now()+5000;},{passive:true});
app.addEventListener('error',e=>{
  if(e.target.matches('.album-art img')){e.target.parentElement?.classList.add('image-failed');e.target.remove();}
},true);
filePicker.addEventListener('change',e=>{void importFiles(e.target.files);e.target.value='';});
document.addEventListener('keydown',e=>{
  const panel = activeOverlay();
  if (panel && e.key === 'Tab') {
    const tabs = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => !el.closest('[inert]') && el.getClientRects().length);
    if (tabs.length) {
      const first = tabs[0], last = tabs.at(-1);
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {e.preventDefault();last.focus();}
      else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {e.preventDefault();first.focus();}
    }
    return;
  }
  if(e.key==='Escape'){if (document.querySelector('body > .dialog-overlay:not(.is-leaving)')) return; closeTopOverlay();return;}
  if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
  if(e.code==='Space'&&state.current){e.preventDefault();state.playing?pause():resume();}
  if(e.altKey&&e.key==='ArrowRight')next();
  if(e.altKey&&e.key==='ArrowLeft')previous();
});
window.addEventListener('popstate', event => {
  const page=event.state;
  if (page?.view === 'playlist' && page.id) void openPlaylist(page.id, {record:false,providerId:page.providerId||null,namespace:page.namespace||null});
  else navigate(['home','search','library'].includes(page?.view) ? page.view : 'home', {record:false});
});
window.addEventListener('scroll',()=>document.getElementById('app-header')?.classList.toggle('is-scrolled',window.scrollY>12),{passive:true});
themeMedia?.addEventListener('change',()=>{if(state.settings.theme==='system'){applyTheme();renderHeader();}});

audio.addEventListener('timeupdate',()=>{state.time=audio.currentTime||0;updateProgress();updateLyricHighlight();});
audio.addEventListener('loadedmetadata',()=>{state.duration=Number.isFinite(audio.duration)?audio.duration:(state.current?.duration||0);updateProgress();});
audio.addEventListener('play',()=>{state.playing=true;updatePlayingButtons();});
audio.addEventListener('pause',()=>{state.playing=false;updatePlayingButtons();});
audio.addEventListener('waiting',()=>{state.buffering=true;refreshBuffering();});
audio.addEventListener('playing',()=>{
  state.buffering=false;refreshBuffering();
  if (state.current && audioTrackId===state.current.id) {
    state.recent=pushRecent(state.recent,state.current);persist();refreshRecent();refreshRows();
  }
});
audio.addEventListener('ended',()=>{next('ended');});
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
  window.history.replaceState({view:'home'}, '', window.location.href);
  app.innerHTML=shellMarkup();
  try {configureApi();} catch {state.settings.apiBase=DEFAULT_API_BASE;state.settings.apiProfiles=[{...STATION_NCM_PRESET,id:BUILTIN_ID,name:'默认音乐接口'}];configureApi();}
  applyTheme();audio.volume=Math.max(0,Math.min(1,state.settings.volume));
  renderHeader();renderPage();renderPlayer();
  try {state.localFiles=await loadLocalFiles();if(state.view==='library')renderPage();}catch{ /* 浏览器隐私模式可能不可用 */ }
  void loadFeatured();
}
void init().catch(error => {console.error('AimoMusic 启动失败',error);toast('应用初始化失败，请刷新页面重试。','error');});
