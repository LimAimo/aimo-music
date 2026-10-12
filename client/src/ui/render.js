import { versionInfo } from '../version.js';
import { networkLog } from '../api/network-debug.js';
import { EXAMPLE_RULES } from '../api/providers.js';
import { icon } from './icons.js';
import { segmentedMarkup } from './controls.js';
import { formatTime } from '../core/lyrics.js';
import { safeExternalUrl } from '../api/music.js';
import {shortcutCatalog,validateBindings,formatCombo,scopeOptions} from '../core/keyboard.js';
import { collectionsMarkup } from './collections-view.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const e = escapeHtml;
export const safeImg = cover => safeExternalUrl(cover);

export function albumArt(song, size = 'medium', extra = '') {
  const url = safeImg(song?.cover);
  return `<span class="album-art album-art--${size} ${extra}">${url ? `<img src="${e(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="album-fallback">${icon('disc', 34)}</span>`}</span>`;
}

export function header(view, theme) {
  return `<header class="app-header" id="app-header"><div class="header-inner">
      
      ${segmentedMarkup([{ value: 'home', label: '发现' }, { value: 'search', label: '搜索' }, { value: 'library', label: '音乐库' }], view === 'playlist' ? 'home' : view, 'nav-segmented')}
      <div class="header-actions"><button class="button button-quiet desktop-upload" data-action="import">${icon('upload', 17)}<span>导入音乐</span></button><button class="icon-button" data-action="settings" aria-label="设置">${icon('settings', 19)}</button></div>
    </div></header>`;
}

export function shellMarkup() {
  return `<div class="app-shell"><div id="header-slot"></div><main id="main-view" class="main-view" tabindex="-1"></main><div id="player-slot"></div><div id="overlay-slot"></div><div id="toast-slot" role="status" aria-live="polite"></div></div>`;
}

export function heroMarkup(song, onPlay = false) {
  return `<section class="hero ${onPlay ? 'hero--playing' : ''}"><div class="hero-copy"><span class="eyebrow">你的音乐空间</span><h1>好音乐，<br><em>值得慢慢听。</em></h1><p>从此刻开始，找到你的下一首喜欢。</p><div class="hero-actions"><button class="button button-primary" data-action="navigate" data-view="search">${icon('search', 18)} 搜索音乐</button><button class="text-action" data-action="import">${icon('plus', 18)} 导入本地歌曲</button></div></div>
    <div class="hero-visual" aria-hidden="true"><div class="hero-paper"><span class="hero-paper-top">AIMO MUSIC</span><div class="hero-disc"><div class="hero-disc-label"><div class="hero-disc-hole"></div></div></div><span class="hero-paper-bottom">A quiet place for your sound.</span></div><div class="hero-small-mark">01 / LISTENING SPACE</div></div></section>`;
}

export function playlistCard(list) {
  return `<button class="playlist-card" data-action="open-playlist" data-id="${e(list.id)}" data-provider-id="${e(list.providerId||'')}" data-namespace="${e(list.providerNamespace||'netease')}">${albumArt({cover: list.cover}, 'card')}<span class="playlist-title">${e(list.title)}</span><span class="playlist-secondary">${list.count ? `${list.count} 首歌曲` : e(list.creator || '发现歌单')}</span></button>`;
}

export function songRow(song, index, { active = false, playing = false, context = 'results', removable = false } = {}) {
  const source = song.source === 'local' ? '本地' : (song.album || '歌曲');
  return `<article class="song-row ${active ? 'is-current' : ''}" data-song-id="${e(song.id)}" data-namespace="${e(song.source==='local'?'local':song.providerNamespace||'netease')}">
    <button class="song-main" data-action="play-row" data-context="${e(context)}" data-index="${index}" aria-label="播放 ${e(song.title)}"><span class="song-index">${active && playing ? '<span class="playing-bars"><i></i><i></i><i></i></span>' : String(index + 1).padStart(2,'0')}</span>${albumArt(song, 'row')}<span class="song-details"><strong>${e(song.title)}</strong><span>${e(song.artist)}</span></span></button>
    <span class="song-album">${e(source)}</span><span class="song-duration">${song.duration ? formatTime(song.duration) : '—'}</span>
    <div class="song-actions"><button class="icon-button ${song.favorite ? 'is-favorite' : ''}" data-action="favorite" data-id="${e(song.id)}" data-namespace="${e(song.source==='local'?'local':song.providerNamespace||'netease')}" data-context="${e(context)}" title="${song.favorite ? '取消喜欢' : '喜欢'}" aria-label="${song.favorite ? '取消喜欢' : '喜欢'}" aria-pressed="${Boolean(song.favorite)}">${icon('heart', 19)}</button><button class="icon-button" data-action="queue-add" data-id="${e(song.id)}" data-namespace="${e(song.source==='local'?'local':song.providerNamespace||'netease')}" data-context="${e(context)}" title="加入播放队列" aria-label="加入队列">${icon('plus', 19)}</button><button class="icon-button" data-feature="song-menu" data-id="${e(song.id)}" data-context="${e(context)}" data-namespace="${e(song.source==='local'?'local':song.providerNamespace||'netease')}" aria-label="更多操作" title="更多操作">${icon('more',18)}</button>${removable ? `<button class="icon-button" data-action="local-delete" data-id="${e(song.id)}" aria-label="移除本地歌曲" title="移除本地歌曲">${icon('trash',18)}</button>` : ''}</div>
  </article>`;
}

export function rowsMarkup(songs, opts) {
  if (!songs.length) return '';
  return `<div class="song-list-head"><span>歌曲</span><span>专辑 / 来源</span><span>时长</span><span></span></div><div class="song-list">${songs.map((song,i) => songRow(song, i, opts)).join('')}</div>`;
}

export function emptyState(title, detail, action = '') {
  return `<div class="empty-state"><span class="empty-emblem">${icon('music', 28)}</span><h3>${e(title)}</h3><p>${e(detail)}</p>${action}</div>`;
}

export function skeletonRows(count = 7) {
  return `<div class="song-skeleton" aria-label="正在加载歌曲">${Array.from({ length: count }, () => `<div class="skeleton-row"><span class="skeleton-index skeleton"></span><span class="skeleton-cover skeleton"></span><span class="skeleton-description"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-sub"></span></span><span class="skeleton skeleton-side"></span></div>`).join('')}</div>`;
}

export function homeRecentMarkup(state) {
  const recent = state.recent.slice(0, 5);
  return `<div class="section-heading"><div><h2>最近聆听</h2></div>${recent.length ? `<button class="text-action" data-action="navigate" data-view="library">全部记录 ${icon('chevronRight', 16)}</button>` : ''}</div>${recent.length ? rowsMarkup(recent.map(t => ({...t, favorite: state.favorites.some(f=> (f.source==='local'?'local':f.providerNamespace||'netease') === (t.source==='local'?'local':t.providerNamespace||'netease') && f.id===t.id)})), { context:'recent',active:false,playing:false }) : emptyState('还没有播放记录','找到喜欢的歌曲，它会出现在这里。',`<button class="text-action" data-action="navigate" data-view="search">去搜索 ${icon('chevronRight', 16)}</button>`)}`;
}

export function featuredMarkup(state) {
  return `${state.featuredLoading ? `<div class="feature-skeleton">${Array.from({length:4},()=>'<div class="feature-sk"><span class="skeleton"></span><span class="skeleton"></span></div>').join('')}</div>` : state.featured.length ? `<div class="feature-grid">${state.featured.slice(0,4).map(playlistCard).join('')}</div>` : `<div class="suggestion-note"><span class="suggestion-disc">${icon('disc',26)}</span><p>${state.featuredFailed ? '推荐暂时无法加载。' : '今天还没有推荐内容。'}</p><button class="text-action" data-action="retry-featured">重新加载 ${icon('chevronRight',15)}</button></div>`}`;
}

export function homeMarkup(state) {
  return `<div class="page page-home">${state.showEasterEgg ? `<div class="easter-record" aria-label="隐藏唱片彩蛋">${heroMarkup(state.current)}</div>` : ''}<div class="home-columns"><section class="home-main">${homeRecentMarkup(state)}</section>
  <section class="home-discover"><div class="section-heading"><div><h2>听点新的</h2></div></div><div id="featured-playlists">${featuredMarkup(state)}</div></section></div></div>`;
}

export function searchResultsMarkup(state) {
  const results = state.searchType === 'songs' ? state.searchSongs : state.searchPlaylists;
  return state.searchLoading ? skeletonRows(7) : state.searchError ? `<div class="error-state">${icon('info',24)}<h3>没有连接上音乐库</h3><p>${e(state.searchError)}</p><button class="button button-secondary" data-action="retry-search">重试</button><button class="text-action" data-action="settings">接口设置</button></div>`
    : state.searchQuery ? (results.length ? (state.searchType === 'songs' ? rowsMarkup(state.searchSongs.map(t=>({...t,favorite:state.favorites.some(f=> (f.source==='local'?'local':f.providerNamespace||'netease') === (t.source==='local'?'local':t.providerNamespace||'netease') && f.id===t.id)})), {context:'searchSongs'}) : `<div class="playlist-grid">${state.searchPlaylists.map(playlistCard).join('')}</div>`) : emptyState('没有找到结果','试试其他关键词，或换个歌手名称。')) : '';
}

export function searchMarkup(state) {
  const keyword = e(state.searchQuery);
  return `<div class="page page-search"><div class="page-intro"><h1>搜索音乐</h1></div><form id="search-form" class="search-form"><label for="search-input" class="sr-only">搜索歌曲、歌手或歌单</label>${icon('search', 22)}<input id="search-input" name="q" type="search" enterkeyhint="search" maxlength="100" autocomplete="off" placeholder="歌曲、歌手、歌单……" value="${keyword}" required><button class="search-submit" type="submit">搜索 ${icon('arrowUp',16)}</button></form>
  ${state.searchQuery ? `<div class="search-tabs"><div class="search-meta">关于「${keyword}」的结果</div>${segmentedMarkup([{value:'songs',label:'歌曲'},{value:'playlists',label:'歌单'}],state.searchType,'search-segmented')}</div>` : `<div class="search-suggestions"><span class="eyebrow">从熟悉的名字开始</span><div class="suggestion-chips">${['周杰伦','陈奕迅','Taylor Swift','RADWIMPS'].map(name=>`<button data-action="suggest-search" data-query="${e(name)}">${e(name)} ${icon('chevronRight',14)}</button>`).join('')}</div></div>`}
  <div class="search-results" id="search-results">${searchResultsMarkup(state)}</div></div>`;
}

export function libraryContentMarkup(state) {
  if(state.libraryTab==='playlists')return collectionsMarkup(state);
  if(state.libraryTab==='history') {
    let previousDay='';
    const rows=(state.historyEntries||[]).map(entry=>{
      const song=entry.track||{};
      const time=new Date(entry.playedAt);
      const day=`${time.getFullYear()}-${String(time.getMonth()+1).padStart(2,'0')}-${String(time.getDate()).padStart(2,'0')}`;
      const today=new Date(),yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
      const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const group=day===previousDay?'':`<h3 class="history-day-heading">${day===key(today)?'今天':day===key(yesterday)?'昨天':time.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}</h3>`;
      previousDay=day;
      return group+`<button class="history-entry" data-action="history-play" data-id="${e(entry.entryId)}">${albumArt(song,'row')}<span class="history-entry-text"><strong>${e(song.title||'未知歌曲')}</strong><small>${e(song.artist||'未知歌手')} · ${e(time.toLocaleString('zh-CN'))}</small></span>${icon('play',18)}</button>`;
    }).join('');
    return `<div class="history-tools"><span>完整播放历史 · ${state.historyEntries.length} 条已加载</span><button class="button button-quiet" data-action="history-clear">清空历史</button></div>${rows||'<div class="empty-state"><h2>还没有播放历史</h2><p>开始播放歌曲后会自动记录。</p></div>'}${state.historyHasMore?'<button class="button button-secondary history-more" data-action="history-more">加载更多</button>':''}${state.historyLoading?'<p class="history-loading">正在读取历史…</p>':''}`;
  }
  const lists = { favorites: state.favorites, recent: state.recent, local: state.localFiles };
  const list = lists[state.libraryTab] || [];
  return list.length ? rowsMarkup(list.map(t=>({...t,favorite:state.favorites.some(f=> (f.source==='local'?'local':f.providerNamespace||'netease') === (t.source==='local'?'local':t.providerNamespace||'netease') && f.id===t.id)})),{context:state.libraryTab,removable:state.libraryTab==='local'}) : emptyState(state.libraryTab==='favorites' ? '还没有喜欢的歌曲' : state.libraryTab==='recent' ? '尚无播放记录' : '本地音乐库是空的', state.libraryTab==='local' ? '可导入自己的 MP3、FLAC 等音频文件，存储在本浏览器中。' : '播放喜欢的歌曲，点击爱心就能收藏。', state.libraryTab==='local' ? `<button class="button button-primary" data-action="import">${icon('upload',16)} 导入本地歌曲</button>` : `<button class="text-action" data-action="navigate" data-view="search">去搜索 ${icon('chevronRight',16)}</button>`);
}

export function libraryMarkup(state) {
  return `<div class="page page-library"><div class="page-intro library-intro"><div><h1>你的音乐库</h1><p>喜欢的音乐，都在这里。</p></div><button class="button button-quiet" data-action="import">${icon('upload',17)} 导入音乐</button></div>
  <div class="library-header">${segmentedMarkup([{value:'favorites',label:`我喜欢的 · ${state.favorites.length}`},{value:'recent',label:'最近播放'},{value:'history',label:'播放历史'},{value:'playlists',label:'我的歌单'},{value:'local',label:'本地歌曲'}],state.libraryTab,'library-segmented')}</div>
  <div class="library-content" id="library-content" aria-live="polite">${libraryContentMarkup(state)}</div>
  <p class="library-footnote">收藏和播放记录只保存在当前浏览器，不会上传到音乐 API。清除浏览器网站数据会删除本地收藏及已导入的音频文件。</p></div>`;
}

export function playlistMarkup(state) {
  const list = state.playlist;
  return `<div class="page page-playlist"><button class="back-link" data-action="navigate" data-view="${e(state.backView||'home')}">${icon('chevronLeft',18)} 返回</button>${state.playlistLoading ? `<div class="playlist-hero playlist-hero-loading">${state.playlistPreview ? albumArt({cover:state.playlistPreview.cover},'hero','shared-cover-target') : '<div class="skeleton shared-cover-target"></div>'}<div><h1 class="shared-title-target">${e(state.playlistPreview?.title||'正在加载歌单')}</h1><span class="skeleton"></span></div></div>${skeletonRows(8)}` : state.playlistError ? `<div class="error-state"><h2>歌单暂时无法打开</h2><p>${e(state.playlistError)}</p><button class="button button-secondary" data-action="retry-playlist">重试</button></div>` : list ? `<div class="playlist-hero">${albumArt({cover:list.cover},'hero','shared-cover-target')}<div><h1 class="shared-title-target">${e(list.title)}</h1><p>${e(list.description || list.creator || '收藏属于你的声音。')}</p><span class="meta-line">${list.tracks.length}${list.count > list.tracks.length ? ` / ${list.count}` : ''} 首歌曲</span><div class="playlist-hero-actions"><button class="button button-primary" data-action="play-playlist">${icon('play',16)} 播放全部</button></div></div></div><div class="section-heading playlist-section"><div><span class="eyebrow">TRACKLIST</span><h2>曲目列表</h2></div></div>${list.tracks.length ? rowsMarkup(list.tracks.map(t=>({...t,favorite:state.favorites.some(f=> (f.source==='local'?'local':f.providerNamespace||'netease') === (t.source==='local'?'local':t.providerNamespace||'netease') && f.id===t.id)})),{context:'playlist'}) : emptyState('暂无可用曲目','这个歌单尚未返回歌曲列表。')}` : ''}</div>`;
}

export function playerMarkup(state) {
  const current = state.current;
  return `<div class="player-shell ${current ? 'has-track' : 'is-empty'}" data-ambient="${e(state.settings.ambient||'glow')}"><div class="player-inner">
    <button class="mini-now" data-action="open-full" ${current ? '' : 'disabled'} aria-label="打开完整播放器">${albumArt(current,'mini')}<span class="mini-meta"><strong>${e(current?.title || '还没有播放歌曲')}</strong><small>${e(current?.artist || '去搜索或导入一首音乐')}</small></span></button>
    <div class="player-center"><div class="transport"><button class="icon-button transport-shuffle ${state.shuffle?'is-active':''}" data-action="shuffle" title="随机播放" aria-label="${state.shuffle ? '关闭随机播放' : '开启随机播放'}" aria-pressed="${state.shuffle}">${icon('shuffle',17)}</button><button class="icon-button" data-action="prev" ${current?'':'disabled'} title="上一首" aria-label="上一首">${icon('prev',21)}</button><button class="transport-play ${state.buffering ? 'is-buffering' : ''}" data-action="toggle-play" aria-busy="${Boolean(state.buffering)}" ${current?'':'disabled'} aria-label="${state.playing?'暂停':'播放'}">${icon(state.playing?'pause':'play',20)}</button><button class="icon-button" data-action="next" ${current?'':'disabled'} title="下一首" aria-label="下一首">${icon('next',21)}</button><button class="icon-button transport-repeat ${state.repeat!=='off'?'is-active':''}" data-action="repeat" title="循环模式" aria-label="${({off:'不循环', all:'列表循环', one:'单曲循环'})[state.repeat]}" aria-pressed="${state.repeat!=='off'}">${icon(state.repeat==='one'?'repeatOne':'repeat',18)}${state.repeat==='one'?'<span class="repeat-dot"></span>':''}</button></div>
    <div class="progress-row"><span id="current-time">${formatTime(state.time)}</span><input id="seek-bar" aria-label="播放进度" type="range" min="0" max="1000" value="0" ${current?'':'disabled'}><span id="duration-time">${formatTime(state.duration||current?.duration||0)}</span></div></div>
    <div class="player-right"><button class="icon-button ${state.fullPanel==='lyrics'?'is-active':''}" data-action="open-lyrics" ${current?'':'disabled'} title="歌词" aria-label="歌词">${icon('lyric',19)}</button><button class="icon-button" data-action="open-queue" title="播放队列" aria-label="播放队列">${icon('list',19)}</button><div class="volume-control">${icon(state.settings.volume===0?'mute':'volume',19)}<input aria-label="音量" id="volume-slider" type="range" min="0" max="1" step="0.01" value="${state.settings.volume}"></div></div>
    <div class="mobile-transport"><button class="icon-button" data-action="open-queue" aria-label="播放队列">${icon('list',21)}</button><button class="icon-button" data-action="toggle-play" ${current?'':'disabled'} aria-label="${state.playing?'暂停':'播放'}">${icon(state.playing?'pause':'play',23)}</button></div>
    <div class="mobile-progress" id="mobile-progress" aria-hidden="true"><span></span></div></div></div>`;
}

export function fullPlayerMarkup(state) {
  const current = state.current;
  if (!current) return '';
  const showLyrics = state.fullPanel === 'lyrics';
  return `<div class="full-overlay" id="full-player" data-ambient="${e(state.settings.ambient||'glow')}" role="dialog" aria-modal="true" aria-label="完整播放器"><div class="full-header"><button class="icon-button" data-action="close-full" aria-label="收起完整播放器">${icon('chevronLeft',24)}</button><span>正在播放</span><button class="icon-button" data-action="open-queue" aria-label="打开队列">${icon('list',22)}</button></div>
    <div class="full-content"><div class="full-art-section">${albumArt(current,'full')}<div class="full-track"><div><h2>${e(current.title)}</h2><p>${e(current.artist)}</p></div><button class="icon-button ${state.favorites.some(f=>f.id===current.id)?'is-favorite':''}" data-action="favorite-current" aria-label="收藏" aria-pressed="${state.favorites.some(f=>f.id===current.id)}">${icon('heart',23)}</button></div>
    <div class="full-progress"><input id="full-seek" aria-label="播放进度" type="range" min="0" max="1000" value="0"><div><span id="full-current-time">${formatTime(state.time)}</span><span id="full-duration-time">${formatTime(state.duration)}</span></div></div>
    <div class="full-controls"><button class="icon-button ${state.shuffle?'is-active':''}" data-action="shuffle" aria-label="${state.shuffle ? '关闭随机播放' : '开启随机播放'}" aria-pressed="${state.shuffle}">${icon('shuffle',20)}</button><button class="icon-button" data-action="prev" aria-label="上一首">${icon('prev',27)}</button><button class="transport-play transport-play-full ${state.buffering ? 'is-buffering' : ''}" data-action="toggle-play" aria-label="${state.playing ? '暂停' : '播放'}" aria-busy="${Boolean(state.buffering)}">${icon(state.playing?'pause':'play',26)}</button><button class="icon-button" data-action="next" aria-label="下一首">${icon('next',27)}</button><button class="icon-button ${state.repeat!=='off'?'is-active':''}" data-action="repeat" aria-label="${({off:'不循环', all:'列表循环', one:'单曲循环'})[state.repeat]}" aria-pressed="${state.repeat!=='off'}">${icon(state.repeat==='one'?'repeatOne':'repeat',20)}</button></div><button class="full-lyrics-toggle" data-action="toggle-lyrics">${icon('lyric',18)} ${showLyrics?'返回封面':'打开歌词'}</button></div>
    <div class="full-lyric-section ${showLyrics?'show-on-mobile':''}" id="full-lyric-section"><div class="lyric-heading"><span class="eyebrow">LYRICS</span><button class="text-action lyric-back-current" data-action="lyric-follow">回到当前歌词</button><button class="text-action" data-action="toggle-lyrics">${showLyrics?'返回封面':'歌词'}</button></div><div class="lyric-viewport" id="lyric-viewport">${lyricMarkup(state)}</div></div></div>
  </div>`;
}

export function lyricMarkup(state) {
  if (state.lyricsLoading) return `<div class="lyric-placeholder"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>`;
  if (state.lyricsError) return `<div class="lyric-empty">${e(state.lyricsError)}</div>`;
  if (!state.lyrics.length) return `<div class="lyric-empty">这首歌曲暂时没有同步歌词。</div>`;
  return `<div class="lyric-lines">${state.lyrics.map((line,i)=>`<button type="button" class="lyric-line ${i===state.activeLyric?'is-current':''}" data-action="seek-lyric" data-time="${line.time}" data-lyric-index="${i}"><span>${e(line.text)}</span>${line.translation?`<small>${e(line.translation)}</small>`:''}</button>`).join('')}</div>`;
}

export function queueMarkup(state) {
  return `<div class="side-scrim" data-action="close-queue"></div><aside class="queue-panel" role="dialog" aria-modal="true" aria-label="播放队列"><div class="queue-top"><div><span class="eyebrow">UP NEXT</span><h2>播放队列 <small>${state.queue.length}</small></h2></div><button class="icon-button" data-action="close-queue" aria-label="关闭队列">${icon('close',22)}</button></div><div class="queue-list">${state.queue.length?state.queue.map((s,i)=>`<article class="queue-row ${i===state.queueIndex?'is-current':''}"><button data-action="queue-play" data-index="${i}" class="queue-entry">${albumArt(s,'row')}<span><strong>${e(s.title)}</strong><small>${e(s.artist)}</small></span></button><button class="icon-button" data-action="queue-remove" data-index="${i}" aria-label="移出队列">${icon('close',17)}</button></article>`).join(''):emptyState('队列里还没有歌','搜索并播放一首歌曲，或将歌曲加入队列。')}</div>${state.queue.length?'<div class="queue-footer"><button class="text-action" data-action="queue-clear">清空播放队列</button></div>':''}</aside>`;
}

function settingsFrame(title, contents, actions = '', back = '') {
  return `<div class="dialog-overlay" id="settings-overlay"><section class="dialog-panel settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="dialog-head"><div class="settings-heading">${back ? `<button type="button" class="icon-button" data-action="${e(back)}" aria-label="返回">${icon('chevronLeft',20)}</button>` : ''}<h2 id="settings-title">${e(title)}</h2></div><button type="button" class="icon-button" data-action="close-settings" aria-label="关闭">${icon('close',21)}</button></div>${contents}${actions}</section></div>`;
}
export function settingsMarkup(state) {
  if (state.apiView === 'manager') return apiManagerMarkup(state);
  if (state.apiView === 'editor') return apiEditorMarkup(state);
  const settings = state.settings;
  const content = `<form id="settings-form"><div class="settings-fields"><fieldset class="form-section"><legend>外观</legend><label class="form-label" for="theme-setting">主题</label><select id="theme-setting" name="theme"><option value="system" ${settings.theme==='system'?'selected':''}>跟随系统</option><option value="light" ${settings.theme==='light'?'selected':''}>浅色</option><option value="dark" ${settings.theme==='dark'?'selected':''}>深色</option></select><label class="form-label" for="ambient-setting">封面氛围背景</label><select id="ambient-setting" name="ambient"><option value="glow" ${settings.ambient==='glow'?'selected':''}>柔和光晕</option><option value="blur" ${settings.ambient==='blur'?'selected':''}>封面模糊</option><option value="gradient" ${settings.ambient==='gradient'?'selected':''}>多色渐变</option><option value="single" ${settings.ambient==='single'?'selected':''}>极简单色</option><option value="off" ${settings.ambient==='off'?'selected':''}>关闭所有氛围效果</option></select></fieldset>
  <fieldset class="form-section"><legend>播放</legend><label class="form-label" for="quality-setting">优先音质</label><select id="quality-setting" name="quality"><option value="standard" ${settings.quality==='standard'?'selected':''}>标准音质</option><option value="higher" ${settings.quality==='higher'?'selected':''}>较高音质</option><option value="exhigh" ${settings.quality==='exhigh'?'selected':''}>极高音质（如果可用）</option><option value="lossless" ${settings.quality==='lossless'?'selected':''}>无损（如果可用）</option></select><p>实际可用音质取决于音乐来源和授权。</p></fieldset>
  <fieldset class="form-section"><legend>音乐 API</legend><label class="form-label" for="api-mode">连接方式</label><select name="apiMode" id="api-mode"><option value="auto" ${settings.apiMode==='auto'?'selected':''}>自动（开发时代理，部署后直连）</option><option value="direct" ${settings.apiMode==='direct'?'selected':''}>浏览器直连</option><option value="proxy" ${settings.apiMode==='proxy'?'selected':''}>本站代理（需自行部署）</option></select><p>本站代理仅用于内置网易云接口；自定义 API 使用自己的服务地址。</p><button type="button" class="button button-secondary api-open-manager" data-action="open-api-manager">${icon('settings',16)} 管理音乐 API（${(settings.apiProfiles?.length || 1)}）</button></fieldset><fieldset class="form-section"><legend>桌面快捷键</legend><p>点击按键输入框，然后按下希望使用的快捷键；可设置作用页面与启停。</p><div class="shortcut-settings">${shortcutCatalog.map(([id,title])=>{const binding=validateBindings(settings.shortcuts)[id];return `<div class="shortcut-setting"><label>${e(title)}<input readonly aria-label="${e(title)}快捷键" name="shortcut-${id}" data-shortcut="${id}" value="${e(binding.combo)}" title="点击并按键设置快捷键"></label><select name="scope-${id}" aria-label="${e(title)}作用范围">${Object.entries(scopeOptions).map(([k,v])=>`<option value="${k}" ${binding.scope===k?'selected':''}>${e(v)}</option>`).join('')}</select><label class="shortcut-enabled"><input type="checkbox" name="enabled-${id}" ${binding.enabled?'checked':''}> 启用</label></div>`;}).join('')}</div><button type="button" class="button button-secondary" data-action="reset-shortcuts">恢复默认快捷键</button><p id="shortcut-feedback" role="status"></p></fieldset></div>
  <div class="dialog-actions"><button class="button button-ghost" type="button" data-action="close-settings">取消</button><button class="button button-primary" type="submit">保存设置</button></div></form>`;
  const version = '<div class="version-panel"><span>AimoMusic</span><strong>v'+e(versionInfo.version)+'</strong></div>';
  const developer = globalThis.__AIMO_DEV__ ? '<div class="dev-state"><div class="dev-title"><h3>网络调试器</h3><button type="button" data-action="developer-fullscreen">全屏查看</button></div><p>记录启用后的网络请求，敏感字段已遮盖。</p><div class="dev-tools"><button type="button" data-action="developer-refresh">刷新</button><button type="button" data-action="developer-export">导出 JSON</button><button type="button" data-action="developer-clear">清空</button><button type="button" data-action="developer-off">关闭模式</button></div><pre class="dev-network-log">'+e(JSON.stringify(networkLog.entries.slice(-30),null,2))+'</pre></div>' : '';
  const main = content.replace('<div class="settings-fields">','<div class="settings-fields"><button type="button" class="dev-secret-trigger" data-action="developer-tap" aria-label="播放设置">播放设置</button>')
    .replace('<div class="dialog-actions">',version+'<div class="dialog-actions">');
  return settingsFrame('播放设置',main+developer);
}
function apiManagerMarkup(state) {
  const settings=state.settings,profiles=settings.apiProfiles;
  const active=profiles.some(p=>p.enabled&&p.id===settings.activeApiId)?settings.activeApiId:(profiles.find(p=>p.enabled)?.id||profiles[0]?.id);
  const switches=`<form id="api-manager-form"><div class="api-manager-preferences"><fieldset class="form-section"><legend>服务选择</legend><label class="form-label" for="api-strategy">切换策略</label><select id="api-strategy" name="apiSwitchMode"><option value="auto" ${settings.apiSwitchMode==='auto'?'selected':''}>智能切换：优先选择主 API，失败时尝试备用</option><option value="manual" ${settings.apiSwitchMode==='manual'?'selected':''}>手动：只使用指定 API</option><option value="priority" ${settings.apiSwitchMode==='priority'?'selected':''}>优先级：按列表顺序尝试</option></select><label class="form-label" for="api-active">首选音乐 API</label><select id="api-active" name="activeApiId">${profiles.filter(p=>p.enabled).map(p=>`<option value="${e(p.id)}" ${p.id===active?'selected':''}>${e(p.name)}</option>`).join('')}</select><p>对于已保存的歌曲，只会在资源命名空间相同的 API 之间切换，避免不同平台的歌曲 ID 错配。网络、服务端故障可触发切换，但不绕过会员或版权限制。</p></fieldset></div><div class="api-save-row"><button type="submit" class="button button-secondary">应用切换策略</button></div></form>`;
  const list=profiles.map((p,index)=>`<article class="api-profile-row"><div class="api-profile-head"><strong>${e(p.name)}</strong><span class="api-profile-state">${p.enabled?'已启用':'已停用'}${p.id===active?' · 首选':''}</span></div><div class="api-profile-address">${e(p.base)}</div><div class="api-profile-sub">${p.type==='custom'?'自定义规则':'网易云兼容'} · 命名空间 ${e(p.namespace)}</div><div class="api-profile-actions"><button type="button" class="text-action" data-action="test-profile" data-id="${e(p.id)}">检测</button><button type="button" class="text-action" data-action="edit-api" data-id="${e(p.id)}">编辑</button><button type="button" class="text-action" data-action="toggle-api" data-id="${e(p.id)}">${p.enabled?'停用':'启用'}</button><button type="button" class="text-action" data-action="move-api-up" data-id="${e(p.id)}" ${index===0?'disabled':''}>上移</button><button type="button" class="text-action" data-action="move-api-down" data-id="${e(p.id)}" ${index===profiles.length-1?'disabled':''}>下移</button><button type="button" class="text-action" data-action="delete-api" data-id="${e(p.id)}">删除</button></div><div class="api-profile-status" id="api-status-${e(p.id)}" aria-live="polite"></div></article>`).join('');
  const fallback=state.apiFallback ? `<p class="api-switch-note">最近一次降级：${e(state.apiFallback.from)} → ${e(state.apiFallback.to)}</p>` : '';
  const body=`<div class="settings-fields api-manager-fields">${switches}${fallback}<div class="api-section-heading"><h3>接口列表</h3><span>${profiles.length} / 20</span></div>${list}<div class="api-toolbar"><button type="button" class="button button-secondary" data-action="add-api">${icon('plus',16)} 添加 API</button><button type="button" class="text-action" data-action="add-station-api">添加 CurrentStation 代理预设</button></div><details class="api-transfer"><summary>导入或导出 API 配置</summary><p>导出的 JSON 仅含公开地址和规则，不存储账户密码、Cookie 或 API 密钥。导入会替换现有列表，可先导出备份。</p><button type="button" class="text-action" data-action="export-api">导出配置 JSON</button><label class="form-label" for="api-import-json">粘贴配置 JSON</label><textarea id="api-import-json" rows="5" spellcheck="false" placeholder="粘贴 AimoMusic 导出的 JSON"></textarea><button type="button" class="button button-secondary" data-action="import-api">验证并导入</button></details><p class="api-hint">CurrentStation 文档列出的 <code>/cm/ncm/{path}</code> 为网易云代理路径，已提供手动预设；它与默认接口同属一个域名，不构成独立站点容灾。已验证搜索、歌词和歌曲详情；部分歌曲的播放地址仍可能为空。</p></div><div class="dialog-actions"><button type="button" class="button button-primary" data-action="back-to-settings">返回设置</button></div>`;
  return settingsFrame('API 管理',body,'','back-to-settings');
}
function apiEditorMarkup(state) {
  const profile=state.apiDraft;const editing=Boolean(state.apiEditingId);
  const custom=profile.type==='custom';
  const body=`<form id="api-profile-form"><div class="settings-fields"><fieldset class="form-section"><legend>接口配置</legend><label class="form-label" for="profile-id">接口标识（保存后不可更改）</label><input id="profile-id" name="id" maxlength="80" pattern="[a-zA-Z0-9_-]+" value="${e(profile.id)}" ${editing?'readonly':''} required><label class="form-label" for="profile-name">显示名称</label><input id="profile-name" name="name" maxlength="70" value="${e(profile.name)}" required><label class="form-label" for="profile-type">适配方式</label><select id="profile-type" name="type"><option value="netease" ${profile.type==='netease'?'selected':''}>网易云兼容协议</option><option value="station" ${profile.type==='station'?'selected':''}>CurrentStation 协议</option><option value="custom" ${custom?'selected':''}>自定义 JSON 映射规则</option></select><label class="form-label" for="profile-base">服务地址</label><input id="profile-base" type="url" spellcheck="false" name="base" value="${e(profile.base)}" placeholder="https://api.example.com/v1" required><label class="form-label" for="profile-namespace">资源命名空间</label><input id="profile-namespace" spellcheck="false" name="namespace" value="${e(profile.namespace)}" required><p>跨服务解析同一歌曲 ID 时，必须使用相同命名空间。不同音乐平台通常应使用不同命名空间。</p><label class="api-check"><input type="checkbox" name="enabled" ${profile.enabled?'checked':''}> 启用此接口</label></fieldset><fieldset id="custom-rules-block" class="form-section" ${custom?'':'hidden'}><legend>JSON 规则</legend><p>规则支持 GET/POST、查询参数、JSON 请求体、固定请求头、响应字段路径和 <code>{{id}}</code> 等变量。不执行任何 JavaScript。仅支持无需秘密凭据的公开 API。</p><label class="form-label" for="profile-rules">接口映射 JSON</label><textarea id="profile-rules" name="rules" rows="14" spellcheck="false">${e(JSON.stringify(custom?profile.rules:EXAMPLE_RULES,null,2))}</textarea></fieldset><p>带令牌的服务请通过自己部署的可信网关处理，不要把密钥写进网页配置。</p><button type="button" class="text-action" data-action="test-api-draft">${icon('wifi',16)} 测试当前填写的接口</button><div id="api-test-result" role="status" aria-live="polite"></div></div><div class="dialog-actions"><button class="button button-ghost" type="button" data-action="back-api-manager">取消</button><button class="button button-primary" type="submit">保存接口</button></div></form>`;
  return settingsFrame(editing?'编辑 API':'添加 API',body,'','back-api-manager');
}
