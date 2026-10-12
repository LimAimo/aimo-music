import './ui/lyrics-enhanced.css';
import './ui/keyboard.css';
import './ui/ambient.css';
import './ui/mini-transparency.css';
import {applyAmbientPalette} from './ui/ambient-palette.js';
import './ui/history.css';
import './ui/navigation.css';
import {directoryMarkup} from './ui/navigation-view.js';
import {normalizeRoute,readRoute,saveRoute,routeFromState,historyEntry,sameLocation} from './core/navigation.js';
import { sharedPlaylistTransition, isPlaylistTransitionRunning, interruptPlaylistTransition } from './ui/playlist-transition.js';
import { animateCoverTransition,cancelPlayerTransition,enablePlayerSwipe } from './ui/player-motion.js';
import './ui/player-motion.css';
import { recordPlayHistory, readPlayHistory, clearPlayHistory, allPlayHistory, replaceHistory } from './core/history.js';
import { mountCollections } from './ui/collections-controller.js';
import './ui/collections.css';
import { installKeyboardShortcuts,parseShortcutForm,comboFromEvent,formatCombo,defaultBindings } from './core/keyboard.js';
import { networkLog, installNetworkDebug } from './api/network-debug.js';
import {cachedResource,smartRetry,isOffline} from './api/resilience.js';
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
const startupRoute=readRoute(window.history.state);
const startupHadOverlay=normalizeRoute(window.history.state)?.fullOpen===true;
let restoringStartup=true;
const state = {
  ...saved,
  view: 'home', backView: 'home', showEasterEgg: false, navigationMenuOpen:false, playlistTitle:'',
  current: saved.queue[saved.queueIndex] || null,
  playing: false, buffering: false, time: 0, duration: 0,
  fullOpen: false, fullPanel: 'cover', queueOpen: false, settingsOpen: false,
  featured: [], featuredLoading: true, featuredFailed: false,
  searchType: 'songs', searchQuery: '', searchSongs: [], searchPlaylists: [], searchLoading: false, searchError: '',
  libraryTab: 'favorites', localFiles: [], historyEntries: [], historyHasMore: true, historyLoading: false,
  localPlaylists:[],selectedLocalPlaylist:null,selectedLocalTracks:[],collectionEdit:false,collectionDraft:null,
  playlistId: null, playlist: null, playlistPreview: null, playlistLoading: false, playlistError: '',
  lyrics: [], lyricsLoading: false, lyricsError: '', activeLyric: -1,
  apiView: 'settings', apiEditingId: null, apiDraft: null, apiFallback: null, playlistProviderId: null, playlistNamespace: null,
};
const api = new ManagedMusicApi();
let searchController = null;
let playlistController = null;
let playController = null;
let playToken = 0;
let historyRecordedToken = -1;
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
let pageTransitionDirection = 0;
let sharedPlaylistOrigin = null;
let easterSequence = 0;
const easterPath = ['home','library','search','home'];

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
function snapshotLocation({push=false,overlay=state.fullOpen?'player':null}={}){
  const route=routeFromState(state,{overlay});
  if(restoringStartup){saveRoute(route);return;}
  try{
    const entry=historyEntry(route);
    if(push)window.history.pushState(entry,'',window.location.href);
    else window.history.replaceState(entry,'',window.location.href);
  }catch{/* 浏览器受限时仍保留站内导航。 */}
  saveRoute(route);
}
function renderDirectory(){
  const main=document.getElementById('main-view');
  if(!main)return;
  const existing=main.querySelector(':scope > .nav-directory');
  if(existing)existing.outerHTML=directoryMarkup(state);
  else main.insertAdjacentHTML('afterbegin',directoryMarkup(state));
}
function restoreDirectoryTab(){
  if(state.view==='library'&&state.libraryTab==='history'&&!state.historyEntries.length)void loadHistoryPage(true);
  if(state.view==='library'&&state.libraryTab==='playlists')void collections.refresh();
}
function renderHeader() {
  const slot = document.getElementById('header-slot');
  const tab = state.view === 'playlist' ? state.backView : state.view;
  // 固定顶栏只装配一次。销毁并重建它会打断正在进行的滑块动画。
  if (!slot.firstElementChild) {
    slot.innerHTML = header(tab, currentTheme());
    bindHeader = bindSegmentedControl(slot.querySelector('.segmented'), value => navigate(value), { draggable: false });
  } else {
    bindHeader?.setValue?.(tab);
  }
  const el = document.getElementById('app-header');
  el?.classList.toggle('is-scrolled', window.scrollY > 12);
}
async function loadHistoryPage(reset=false) {
  if(state.historyLoading)return;
  if(reset){state.historyEntries=[];state.historyHasMore=true;}
  if(!state.historyHasMore)return;
  state.historyLoading=true;
  if(state.view==='library'&&state.libraryTab==='history')updateLibraryContent();
  try {
    const last=state.historyEntries.at(-1);
    const page=await readPlayHistory({limit:50,beforeId:last?.entryId??null});
    state.historyEntries.push(...page);
    state.historyHasMore=page.length===50;
  } catch(error){toast('播放历史读取失败：'+error.message,'error');}
  finally {state.historyLoading=false;if(state.view==='library'&&state.libraryTab==='history')updateLibraryContent();}
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
  renderDirectory();
  const page = main.querySelector('.page');
  if (page && pageTransitionDirection) {
    page.classList.add(pageTransitionDirection > 0 ? 'page-enter-from-right' : 'page-enter-from-left');
    pageTransitionDirection = 0;
  }
  const segmented = main.querySelector('.segmented');
  if (segmented) bindPage = bindSegmentedControl(segmented, value => {
    if (state.view === 'search' && value !== state.searchType) {
      state.searchType = value;
      snapshotLocation();
      updateSearchResults();
      if (value === 'playlists' && state.searchQuery && !state.searchPlaylists.length) void runSearch(state.searchQuery, { preserveTabs: true });
      if (value === 'songs' && state.searchQuery && !state.searchSongs.length) void runSearch(state.searchQuery, { preserveTabs: true });
    } else if (state.view === 'library' && value !== state.libraryTab) {
      state.libraryTab = value;
      state.selectedLocalPlaylist=null;
      state.collectionEdit=false;
      snapshotLocation();
      renderDirectory();
      updateLibraryContent({ animate: true });
      if(value==='history'&&!state.historyEntries.length)void loadHistoryPage(true);
      if(value==='playlists')void collections.refresh();
    }
  });
  if (focusedSearch) {
    const input = main.querySelector('#search-input');
    input?.focus({ preventScroll: true });
    if (typeof cursor === 'number') input?.setSelectionRange(cursor, cursor);
  }
}

function updateAmbient() {
  const cover=state.current?.cover;
  for(const element of document.querySelectorAll('.player-shell,#full-player')){
    // 迷你播放器与全屏播放器的背景是两套独立配置。
    if(element.classList.contains('player-shell')){
      const value=Math.max(0,Math.min(100,Number(state.settings.miniTransparency??15)));
      element.style.setProperty('--mini-surface-opacity', (100-value)+'%');
    }
    const mode=state.settings.ambient||'off';
    element.dataset.ambient=mode;
    const image=element.querySelector('.album-art img');
    const src=image?.getAttribute('src')||'';
    // CSS 只使用封面 URL 作背景，不读取跨域图片像素，避免画布污染。
    if(mode!=='off' && cover && src){element.style.setProperty('--ambient-cover',`url("${src.replaceAll('"','%22')}")`);applyAmbientPalette(src,element);}
    else {element.style.removeProperty('--ambient-cover');element.dataset.ambientImage='';}
  }
}

function renderPlayer() { document.getElementById('player-slot').innerHTML = playerMarkup(state); updateProgress(); updateAmbient(); }
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
let sharedPlayerOpening=false;
function openPlayer(panel='cover',{record=true}={}){
  if(!state.current)return;
  const wasOpen=state.fullOpen;
  if(!wasOpen&&isPlaylistTransitionRunning())interruptPlaylistTransition();
  const from=wasOpen?null:document.querySelector('#player-slot .mini-now .album-art');
  sharedPlayerOpening=!wasOpen;
  state.fullOpen=true;state.fullPanel=panel;
  snapshotLocation({push:record&&!wasOpen,overlay:'player'});
  try{renderOverlay();}finally{sharedPlayerOpening=false;}
  if(!wasOpen){
    const full=document.querySelector('#full-player:not(.is-leaving)');
    if(full){
      // 共享动画仅执行一遍。标记已入场，结束时不可重新触发原来的 full-enter 平移动画。
      animateCoverTransition(from,full.querySelector('.album-art--full'));
      window.setTimeout(()=>{
        if(!full.isConnected||!full.classList.contains('is-shared-entering'))return;
        full.classList.add('has-entered');
        full.classList.remove('is-shared-entering');
      },405);
    }
  }
}
function closePlayer({fromHistory=false}={}){
  if(!state.fullOpen)return;
  if(!fromHistory&&normalizeRoute(window.history.state)?.fullOpen){window.history.back();return;}
  const full=document.querySelector('#full-player:not(.is-leaving)');
  const from=full?.querySelector('.album-art--full');
  full?.classList.add('is-shared-leaving');
  state.fullOpen=false;renderOverlay();
  if(!fromHistory)snapshotLocation({overlay:null});
  animateCoverTransition(from,document.querySelector('#player-slot .mini-now .album-art'));
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
      const markup=fullPlayerMarkup(state);
      // 必须在插入 DOM 时就指定共享入场动画，避免普通入场动画先运行一帧。
      slot.insertAdjacentHTML('beforeend',sharedPlayerOpening
        ? markup.replace('class="full-overlay"','class="full-overlay is-shared-entering"')
        : markup);
      full = slot.querySelector('#full-player:not(.is-leaving)');
      if (full) { full.dataset.trackId = trackId; recreatedFull = true; updateAmbient();enablePlayerSwipe(full,closePlayer); }
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
        button.innerHTML = `${icon('lyric',18)} ${showLyrics ? '返回封面' : '打开歌词'}`;
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
  // 关闭设置而未保存时，撤销滑块的临时预览。
  if(!state.settingsOpen)document.querySelector('.player-shell')?.style.setProperty('--mini-surface-opacity',(100-Math.max(0,Math.min(100,Number(state.settings.miniTransparency??15))))+'%');
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
  if(index!==state.activeLyric && lyricScrollSuspendUntil===Infinity){lyricScrollSuspendUntil=0;document.getElementById('full-lyric-section')?.classList.remove('is-manual');}
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
function navigate(view, { record = true, skipShared = false } = {}) {
  // 全屏播放器高于页面导航；返回键先关闭它而不是倒放歌单封面。
  if(state.fullOpen&&record)closePlayer({fromHistory:true});
  state.navigationMenuOpen=false;
  if (!skipShared && state.view === 'playlist' && view === 'home' && sharedPlaylistOrigin?.view === 'home') {
    const origin=sharedPlaylistOrigin;
    sharedPlaylistOrigin=null;
    playlistController?.abort();
    const snapshots=interruptPlaylistTransition();
    const card=()=>[...document.querySelectorAll('.home-discover .playlist-card')].find(x=>x.dataset.id===origin.id&&x.dataset.providerId===origin.providerId);
    void sharedPlaylistTransition({source:document.querySelector('.page-playlist .playlist-hero .album-art'),sourceTitle:document.querySelector('.page-playlist .shared-title-target'),fromSnapshots:snapshots,render:()=>navigate('home',{record,skipShared:true}),restoreScroll:origin.scrollY,target:()=>card()?.querySelector('.album-art'),targetTitle:()=>card()?.querySelector('.playlist-title')});
    return;
  }
  if (state.view === 'playlist' && view !== 'home') sharedPlaylistOrigin=null;
  if (!['home', 'search', 'library'].includes(view)) return;
  if (record && state.view !== view) {
    if (view === easterPath[easterSequence + 1]) easterSequence++;
    else easterSequence = view === 'home' ? 0 : -1;
    if (easterSequence === easterPath.length - 1) {state.showEasterEgg = true; easterSequence = -1;}
    else state.showEasterEgg = false;
  } else if (!record) { easterSequence = 0; state.showEasterEgg = false; }
  const navigationOrder = ['home','search','library'];
  const fromIndex = navigationOrder.indexOf(state.view);
  const toIndex = navigationOrder.indexOf(view);
  pageTransitionDirection = fromIndex >= 0 && toIndex >= 0 ? Math.sign(toIndex - fromIndex) : 0;
  state.view = view;
  snapshotLocation({push:record});
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
    const data=await cachedResource('discover:'+api.activeId,()=>api.discoverPlaylists(),{onFresh:updated=>{if(!state.featuredLoading){state.featured=updated;updateFeatured();}}});
    state.featured=data.value;state.apiFallback=api.lastFallback;
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
  snapshotLocation();
  searchController?.abort();
  const version = ++searchVersion;
  if (!query) { state.searchSongs = []; state.searchPlaylists = []; state.searchError=''; state.searchLoading=false; renderPage(); return; }
  const controller = new AbortController(); searchController = controller;
  const selectedType = state.searchType;
  state.searchLoading = true; state.searchError = '';
  if (preserveTabs) updateSearchResults(); else renderPage({ restoreFocus: true });
  try {
    const results = selectedType === 'songs'
      ? (await cachedResource('search:songs:'+api.activeId+':'+query,()=>api.searchSongs(query,controller.signal),{signal:controller.signal,onFresh:items=>{if(version===searchVersion&&!controller.signal.aborted){state.searchSongs=items;updateSearchResults();}}})).value
      : (await cachedResource('search:playlists:'+api.activeId+':'+query,()=>api.searchPlaylists(query,controller.signal),{signal:controller.signal,onFresh:items=>{if(version===searchVersion&&!controller.signal.aborted){state.searchPlaylists=items;updateSearchResults();}}})).value;
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
async function openPlaylist(id, { record = true, providerId = null, namespace = null, sourceElement = null, backView:restoredBackView=null } = {}) {
  if (isPlaylistTransitionRunning()) return;
  const isFeatured = record && state.view === 'home' && !!sourceElement?.closest('.home-discover');
  if(isFeatured)sharedPlaylistOrigin={view:'home',id:String(id),providerId:providerId||'',scrollY:window.scrollY};
  else if(record)sharedPlaylistOrigin=null;
  const backView = restoredBackView || (state.view === 'search' ? 'search' : state.view === 'library' ? 'library' : 'home');
  state.playlistPreview=isFeatured ? state.featured.find(x=>String(x.id)===String(id))||null : null;
  state.view='playlist'; state.backView=backView; state.playlistId=id; state.playlistProviderId=providerId; state.playlistNamespace=namespace; state.playlistLoading=true; state.playlistError=''; state.playlist=null; state.playlistTitle='';state.navigationMenuOpen=false;
  snapshotLocation({push:record});
  playlistController?.abort();
  const controller = new AbortController(); playlistController=controller;
  const transition=isFeatured
    ? sharedPlaylistTransition({source:sourceElement.querySelector('.album-art'),sourceTitle:sourceElement.querySelector('.playlist-title'),render:()=>{renderHeader();renderPage();window.scrollTo({top:0,behavior:'instant'});},target:()=>document.querySelector('.page-playlist .shared-cover-target'),targetTitle:()=>document.querySelector('.page-playlist .shared-title-target')})
    : (renderHeader(),renderPage(),window.scrollTo({top:0,behavior:'instant'}),Promise.resolve());
  // 网络加载与动画并行，但加载完成后等转场交接完毕再重绘。
  try { const key=['playlist',api.activeId,id,state.playlistProviderId,state.playlistNamespace].join(':');
    const result=(await cachedResource(key,()=>api.playlistDetail(id,controller.signal,state.playlistProviderId,state.playlistNamespace),
      {signal:controller.signal,onFresh:updated=>{if(playlistController===controller&&!controller.signal.aborted&&state.view==='playlist'){state.playlist=updated;state.playlistTitle=updated.title||'';snapshotLocation();renderPage();}}})).value;
    if(!controller.signal.aborted){state.playlist=result;state.playlistTitle=result?.title||'';state.apiFallback=api.lastFallback;snapshotLocation();} }
  catch (err) { if (controller.signal.aborted) return; state.playlistError=err.message || '网络请求失败'; }
  finally { await transition; if (playlistController===controller && !controller.signal.aborted && state.view==='playlist') {state.playlistLoading=false;renderPage();} }
}
async function loadLyricsFor(song) {
  state.lyrics=[]; state.activeLyric=-1; state.lyricsError='';
  if (song.source === 'local') { state.lyricsLoading=false; renderOverlay(); return; }
  state.lyricsLoading=true; renderOverlay();
  const token=playToken;
  try {
    const data=await smartRetry(()=>api.lyrics(song.id,playController?.signal,song.providerId,song.providerNamespace),{signal:playController?.signal});
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
async function playIndex(index, { forceRefresh = false, fromNavigation = false, resumeAt = 0, preserveHistory = false } = {}) {
  const song=state.queue[index];
  if (!song) return;
  cancelPlayerTransition();
  if (!fromNavigation) shuffleHistory.reset(state.queue, index);
  const previouslyRecorded=historyRecordedToken===playToken;
  ++playToken;
  historyRecordedToken=preserveHistory&&previouslyRecorded?playToken:-1;
  playController?.abort();
  playController=new AbortController();
  const token=playToken;
  if (!forceRefresh) audioRetry=false;
  const previousId=audioTrackId;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  cleanLocalObjectUrl();
  audioTrackId=null;
  state.queueIndex=index; state.current=song; state.time=resumeAt||0; state.duration=song.duration||0;
  state.playing=false; state.buffering=true; persist();
  renderPlayer(); refreshRows(); renderOverlay();
  updateMediaSession(song);
  if(!preserveHistory)void loadLyricsFor(song);
  let url;
  try {
    if (song.source === 'local') {
      const blob=await loadLocalBlob(song.id);
      if (!blob) throw new Error('找不到本地音频文件，请重新导入。');
      if (token!==playToken) return;
      url=URL.createObjectURL(blob); localObjectUrl=url;
    } else url=await smartRetry(()=>api.audioUrl(song.id,state.settings.quality,playController.signal,song.providerId,song.providerNamespace),{signal:playController.signal});
    if (token!==playToken) { if (song.source==='local' && localObjectUrl===url) cleanLocalObjectUrl(); return; }
    audio.src=url;
    if(resumeAt>0){
      const restore=()=>{if(token!==playToken)return;try{audio.currentTime=resumeAt;}catch{};};
      audio.addEventListener('loadedmetadata',restore,{once:true});
      audio.addEventListener('canplay',restore,{once:true});
    }
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
  persist();
  if(state.view==='library'&&state.libraryTab==='playlists')void collections.refresh();
  else if (state.view === 'library') updateLibraryContent(); else refreshRows();
  renderOverlay();
  toast(isFavorite(song)?'已加入我喜欢的音乐':'已取消收藏');
}
function findSong(context,id,namespace) {
  const groups={
    searchSongs:state.searchSongs, favorites:state.favorites, recent:state.recent,
    local:state.localFiles,playlist:state.playlist?.tracks||[],localPlaylist:state.selectedLocalTracks||[],
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
  if (success) { state.view='library';state.libraryTab='local';snapshotLocation({push:true});renderHeader();renderPage();toast(`已导入 ${success} 首本地歌曲。`); }
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
  if (state.fullOpen) closePlayer();
}

function handleAction(button) {
  const action=button.dataset.action;
  const id=button.dataset.id;
  const context=button.dataset.context;
  const index=Number(button.dataset.index);
  switch(action) {
    case 'navigate':navigate(button.dataset.view);break;
    case 'nav-directory-toggle':
      state.navigationMenuOpen=!state.navigationMenuOpen;renderDirectory();break;
    case 'nav-go':{
      const view=button.dataset.view,tab=button.dataset.tab;
      state.navigationMenuOpen=false;
      if(view==='library'&&tab){
        state.libraryTab=tab;
        state.selectedLocalPlaylist=null;
        state.collectionEdit=false;
        if(state.view==='library'){
          snapshotLocation();renderPage();restoreDirectoryTab();
        }else{navigate('library');restoreDirectoryTab();}
      }else navigate(view);
      renderDirectory();
      break;
    }
    case 'playlist-back':navigate(state.backView,{record:false});break;
    case 'history-more':void loadHistoryPage();break;
    case 'history-clear':void (async()=>{
      if(!await showConfirmDialog('清空播放历史','这将永久删除当前浏览器中的全部播放历史，不影响收藏和歌单。',{confirm:'清空',destructive:true}))return;
      try{await clearPlayHistory();state.historyEntries=[];state.historyHasMore=false;updateLibraryContent();if(state.view==='library'&&state.libraryTab==='playlists')await collections.refresh();toast('播放历史已清空');}
      catch(e){toast(e.message,'error');}
    })();break;
    case 'history-play':{
      const entry=state.historyEntries.find(x=>String(x.entryId)===id);
      if(entry?.track)playCollection([entry.track],0);
      break;
    }
    case 'import': filePicker.click();break;
    case 'cycle-theme': {
      state.settings.theme=currentTheme()==='dark'?'light':'dark';applyTheme();persist();renderHeader();break;
    }
    case 'settings': state.settingsOpen=true;state.apiView='settings';renderOverlay();document.getElementById('theme-setting')?.focus();break;
    case 'reset-shortcuts':{for(const [id,bind] of Object.entries(defaultBindings())){const input=document.querySelector(`[name="shortcut-${id}"]`),scope=document.querySelector(`[name="scope-${id}"]`),check=document.querySelector(`[name="enabled-${id}"]`);if(input)input.value=bind.combo;if(scope)scope.value=bind.scope;if(check)check.checked=true;}toast('默认快捷键已填入，点击保存设置生效');break;}
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
    case 'open-playlist':void openPlaylist(id,{providerId:button.dataset.providerId||null,namespace:button.dataset.namespace||null,sourceElement:button});break;
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
    case 'open-full':openPlayer('cover');break;
    case 'close-full':closePlayer();break;
    case 'open-lyrics':openPlayer('lyrics');break;
    case 'toggle-lyrics':state.fullPanel=state.fullPanel==='lyrics'?'cover':'lyrics';snapshotLocation();renderOverlay();break;
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
    case 'lyric-follow':lyricScrollSuspendUntil=0;document.getElementById('full-lyric-section')?.classList.remove('is-manual');updateLyricHighlight(true);break;
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

const collections=mountCollections({
 app,state,render:()=>{if(state.view==='library'&&state.libraryTab==='playlists')updateLibraryContent();},onNavigation:()=>{snapshotLocation();renderDirectory();},toast,
 confirm:showConfirmDialog,findSong,playCollection,
 getSnapshot:()=>({favorites:state.favorites,recent:state.recent,queue:state.queue,queueIndex:state.queueIndex,repeat:state.repeat,shuffle:state.shuffle,settings:state.settings}),
 restoreSnapshot:data=>{
  Object.assign(state,readPersisted({getItem:()=>JSON.stringify(data)}));
  try{configureApi();}catch{}applyTheme();persist();renderHeader();renderPlayer();renderOverlay();renderPage();
  state.historyEntries=[];state.historyHasMore=true;
 },
 onSong:(action,track)=>{
  if(action==='next'){state.queue.splice(Math.max(0,state.queueIndex+1),0,track);shuffleHistory.reset(state.queue,state.queueIndex);persist();renderOverlay();toast('已安排下一首');}
  else if(action==='queue'){state.queue=appendToQueue(state.queue,track);shuffleHistory.reset(state.queue,state.queueIndex);persist();renderOverlay();toast('已加入播放队列');}
  else if(action==='favorite')toggleFavorite(track);
  else if(action==='artist'||action==='album'){const q=action==='artist'?track.artist:track.album;if(q){navigate('search');void runSearch(q);}else toast('没有对应的资料');}
 }
});

app.addEventListener('click',e=>{
  if(state.navigationMenuOpen&&!e.target.closest('.nav-directory')){state.navigationMenuOpen=false;renderDirectory();}
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
    let shortcuts;try{shortcuts=parseShortcutForm(e.target);}catch(error){toast(error.message,'error');return;}
    state.settings={...state.settings,shortcuts,theme:String(data.get('theme')),ambient:String(data.get('ambient')||'glow'),miniTransparency:Math.max(0,Math.min(100,Number(data.get('miniTransparency')??15))),quality:String(data.get('quality')),apiMode:String(data.get('apiMode'))};
    try {configureApi();}catch(err){toast(err.message,'error');return;}
    applyTheme();persist();state.settingsOpen=false;renderHeader();renderPlayer();renderOverlay();updateAmbient();toast('设置已保存');
    if(state.view==='home')loadFeatured();
  }
});
app.addEventListener('keydown',e=>{
  const target=e.target;
  if(!target.matches?.('[data-shortcut]'))return;
  e.preventDefault();e.stopImmediatePropagation();
  const combo=comboFromEvent(e);
  if(combo){target.value=combo;const feedback=document.getElementById('shortcut-feedback');if(feedback)feedback.textContent='已录入 '+formatCombo(combo)+'，保存设置后生效';}
  else if(!['Control','Shift','Alt','Meta'].includes(e.key)){const feedback=document.getElementById('shortcut-feedback');if(feedback)feedback.textContent='该组合键由浏览器保留，不能覆盖';}
},true);
app.addEventListener('input',e=>{
  if(e.target.id==='mini-transparency'){
    const amount=Math.max(0,Math.min(100,Number(e.target.value)));
    const output=document.getElementById('mini-transparency-value');
    if(output)output.textContent=amount+'%';
    e.target.style.setProperty('--mini-slider-fill',amount+'%');
    document.querySelector('.player-shell')?.style.setProperty('--mini-surface-opacity',(100-amount)+'%');
  }
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
app.addEventListener('wheel',e=>{if(e.target.closest('#lyric-viewport')){lyricScrollSuspendUntil=Infinity;document.getElementById('full-lyric-section')?.classList.add('is-manual');}},{passive:true});
app.addEventListener('pointerdown',e=>{if(e.target.closest('#lyric-viewport')){lyricScrollSuspendUntil=Infinity;document.getElementById('full-lyric-section')?.classList.add('is-manual');}},{passive:true});
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
  // 播放和导航按键由统一的可配置快捷键管理器处理。
});
window.addEventListener('online',()=>{
  toast('网络已恢复，正在更新在线内容');
  if(state.view==='home')void loadFeatured();
  if(state.view==='search'&&state.searchQuery)void runSearch(state.searchQuery,{preserveTabs:true});
  if(state.view==='playlist'&&state.playlistId)void openPlaylist(state.playlistId,{record:false,providerId:state.playlistProviderId,namespace:state.playlistNamespace});
});
window.addEventListener('offline',()=>toast('网络已断开，仍可浏览缓存内容和本地歌曲'));
function restoreHistoryLocation(entry){
  const target=normalizeRoute(entry)||normalizeRoute({view:'home'});
  const existing=routeFromState(state);
  state.navigationMenuOpen=false;
  state.libraryTab=target.libraryTab;
  state.searchType=target.searchType;
  state.searchQuery=target.searchQuery;
  state.selectedLocalPlaylist=target.selectedLocalPlaylist;
  state.collectionEdit=false;
  // Pop from song details to its underlying playlist: close the top layer only.
  if(state.fullOpen&&!target.fullOpen)closePlayer({fromHistory:true});
  if(target.view==='playlist'){
    if(state.view!=='playlist'||!sameLocation(existing,target)){
      void openPlaylist(target.playlistId,{record:false,providerId:target.playlistProviderId,
        namespace:target.playlistNamespace,backView:target.backView}).then(()=>{
          if(target.fullOpen&&state.current&&!state.fullOpen)openPlayer(target.fullPanel,{record:false});
        });
    }else{
      state.backView=target.backView;
      if(target.fullOpen&&state.current&&!state.fullOpen)openPlayer(target.fullPanel,{record:false});
      else if(state.fullOpen&&target.fullPanel!==state.fullPanel){state.fullPanel=target.fullPanel;renderOverlay();}
      renderDirectory();
    }
  }else{
    if(state.view!==target.view)navigate(target.view,{record:false});
    else{renderHeader();renderPage();}
    restoreDirectoryTab();
    if(target.view==='search'&&target.searchQuery)void runSearch(target.searchQuery,{preserveTabs:true});
    if(target.fullOpen&&state.current&&!state.fullOpen)openPlayer(target.fullPanel,{record:false});
  }
  saveRoute(target);
}
window.addEventListener('popstate', event => restoreHistoryLocation(event.state));
window.addEventListener('scroll',()=>document.getElementById('app-header')?.classList.toggle('is-scrolled',window.scrollY>12),{passive:true});
themeMedia?.addEventListener('change',()=>{if(state.settings.theme==='system'){applyTheme();renderHeader();}});


installKeyboardShortcuts({
  'Space': () => state.playing ? pause() : resume(),
  'ArrowRight': () => seek((audio.currentTime || 0) + 5),
  'ArrowLeft': () => seek((audio.currentTime || 0) - 5),
  'ArrowUp': () => { audio.volume = Math.min(1, audio.volume + .05); state.settings.volume = audio.volume; persist(); renderPlayer(); },
  'ArrowDown': () => { audio.volume = Math.max(0, audio.volume - .05); state.settings.volume = audio.volume; persist(); renderPlayer(); },
  'KeyN': () => next(),
  'KeyP': () => previous(),
  'KeyM': () => { audio.muted = !audio.muted; },
  'Slash': () => { navigate('search'); requestAnimationFrame(() => document.getElementById('search-input')?.focus()); },
  'Escape': () => { if(document.querySelector('body > .dialog-overlay:not(.is-leaving)'))return;closeTopOverlay(); },
  'KeyF': () => { if(state.current) toggleFavorite(state.current); },
  'KeyQ': () => { state.queueOpen=!state.queueOpen; renderOverlay(); },
  'KeyL': () => { if(state.current){if(!state.fullOpen)openPlayer('lyrics');else{state.fullPanel=state.fullPanel==='lyrics'?'cover':'lyrics';renderOverlay();}} },
},{getBindings:()=>state.settings.shortcuts,getContext:()=>({player:state.fullOpen,library:state.view==='library',search:state.view==='search',home:state.view==='home'})});

audio.addEventListener('timeupdate',()=>{state.time=audio.currentTime||0;updateProgress();updateLyricHighlight();});
audio.addEventListener('loadedmetadata',()=>{state.duration=Number.isFinite(audio.duration)?audio.duration:(state.current?.duration||0);updateProgress();});
audio.addEventListener('play',()=>{state.playing=true;updatePlayingButtons();});
audio.addEventListener('pause',()=>{state.playing=false;updatePlayingButtons();});
audio.addEventListener('waiting',()=>{state.buffering=true;refreshBuffering();});
audio.addEventListener('playing',()=>{
  state.buffering=false;refreshBuffering();
  if (state.current && audioTrackId === state.current.id && historyRecordedToken !== playToken) {
    historyRecordedToken = playToken;
    void recordPlayHistory(state.current).then(()=>{
      if(state.view==='library'&&state.libraryTab==='playlists')return collections.refresh();
    }).catch(()=>{});
  }
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
    const interruptedAt=Math.max(0,Number(audio.currentTime)||state.time||0);
    if(isOffline()){
      toast('网络已断开，等待联网后恢复当前歌曲');
      window.addEventListener('online',()=>{if(state.queueIndex===index)void playIndex(index,{forceRefresh:true,resumeAt:interruptedAt,fromNavigation:true,preserveHistory:true});},{once:true});
    }else void playIndex(index,{forceRefresh:true,resumeAt:interruptedAt,fromNavigation:true,preserveHistory:true});
  }else{state.playing=false;renderPlayer();toast('音频无法播放。可尝试切换音质或播放其他歌曲。','error');}
});

async function init() {
  app.innerHTML=shellMarkup();
  try {configureApi();} catch {state.settings.apiBase=DEFAULT_API_BASE;state.settings.apiProfiles=[{...STATION_NCM_PRESET,id:BUILTIN_ID,name:'默认音乐接口'}];configureApi();}
  applyTheme();audio.volume=Math.max(0,Math.min(1,state.settings.volume));
  if(startupRoute){
    state.view=startupRoute.view==='playlist'?'home':startupRoute.view;
    state.backView=startupRoute.backView;
    state.searchQuery=startupRoute.searchQuery;
    state.searchType=startupRoute.searchType;
    state.libraryTab=startupRoute.libraryTab;
    state.selectedLocalPlaylist=startupRoute.selectedLocalPlaylist;
    state.playlistTitle=startupRoute.playlistTitle;
  }
  renderHeader();renderPage();renderPlayer();
  try {state.localFiles=await loadLocalFiles();if(state.view==='library')renderPage();}catch{ /* 浏览器隐私模式可能不可用 */ }
  try{await collections.load();}catch(err){toast('歌单存储不可用：'+err.message,'error');}
  if(startupRoute?.view==='playlist'){
    await openPlaylist(startupRoute.playlistId,{record:false,providerId:startupRoute.playlistProviderId,
      namespace:startupRoute.playlistNamespace,backView:startupRoute.backView});
  }else if(state.view==='search'&&state.searchQuery){
    void runSearch(state.searchQuery,{preserveTabs:true});
  }
  restoreDirectoryTab();
  void loadFeatured();
  restoringStartup=false;
  if(startupRoute?.fullOpen&&state.current){
    // 对 sessionStorage 恢复的播放器新增可回退的一层；原本就在历史中的播放器只需恢复显示。
    if(!startupHadOverlay)snapshotLocation({overlay:null});
    openPlayer(startupRoute.fullPanel,{record:!startupHadOverlay});
  }else snapshotLocation({overlay:null});
}
void init().catch(error => {console.error('AimoMusic 启动失败',error);toast('应用初始化失败，请刷新页面重试。','error');});
