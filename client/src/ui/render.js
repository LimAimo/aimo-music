import { icon } from './icons.js';
import { segmentedMarkup } from './controls.js';
import { formatTime } from '../core/lyrics.js';
import { safeExternalUrl } from '../api/music.js';

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
      <button class="brand" data-action="navigate" data-view="home" aria-label="Aimo Music 首页"><span class="brand-record"><span></span></span><span class="brand-wordmark">Aimo <em>Music</em></span></button>
      ${segmentedMarkup([{ value: 'home', label: '发现' }, { value: 'search', label: '搜索' }, { value: 'library', label: '音乐库' }], view === 'playlist' ? 'home' : view, 'nav-segmented')}
      <div class="header-actions"><button class="icon-button header-theme" data-action="cycle-theme" aria-label="切换主题" title="切换主题">${icon(theme === 'dark' ? 'sun' : 'moon', 19)}</button><button class="button button-quiet desktop-upload" data-action="import">${icon('upload', 17)}<span>导入音乐</span></button><button class="icon-button" data-action="settings" aria-label="设置">${icon('settings', 19)}</button></div>
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
  return `<button class="playlist-card" data-action="open-playlist" data-id="${e(list.id)}">${albumArt({cover: list.cover}, 'card')}<span class="playlist-title">${e(list.title)}</span><span class="playlist-secondary">${list.count ? `${list.count} 首歌曲` : e(list.creator || '发现歌单')}</span></button>`;
}

export function songRow(song, index, { active = false, playing = false, context = 'results', removable = false } = {}) {
  const source = song.source === 'local' ? '本地' : (song.album || '歌曲');
  return `<article class="song-row ${active ? 'is-current' : ''}" data-song-id="${e(song.id)}">
    <button class="song-main" data-action="play-row" data-context="${e(context)}" data-index="${index}" aria-label="播放 ${e(song.title)}"><span class="song-index">${active && playing ? '<span class="playing-bars"><i></i><i></i><i></i></span>' : String(index + 1).padStart(2,'0')}</span>${albumArt(song, 'row')}<span class="song-details"><strong>${e(song.title)}</strong><span>${e(song.artist)}</span></span></button>
    <span class="song-album">${e(source)}</span><span class="song-duration">${song.duration ? formatTime(song.duration) : '—'}</span>
    <div class="song-actions"><button class="icon-button ${song.favorite ? 'is-favorite' : ''}" data-action="favorite" data-id="${e(song.id)}" data-context="${e(context)}" title="${song.favorite ? '取消喜欢' : '喜欢'}" aria-label="${song.favorite ? '取消喜欢' : '喜欢'}">${icon('heart', 19)}</button><button class="icon-button" data-action="queue-add" data-id="${e(song.id)}" data-context="${e(context)}" title="加入播放队列" aria-label="加入队列">${icon('plus', 19)}</button>${removable ? `<button class="icon-button" data-action="local-delete" data-id="${e(song.id)}" aria-label="移除本地歌曲" title="移除本地歌曲">${icon('trash',18)}</button>` : ''}</div>
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

export function homeMarkup(state) {
  const recent = state.recent.slice(0, 5);
  return `<div class="page page-home">${heroMarkup(state.current)}<div class="home-columns"><section class="home-main"><div class="section-heading"><div><span class="eyebrow">THE SOUND YOU KEEP</span><h2>最近聆听</h2></div>${recent.length ? `<button class="text-action" data-action="navigate" data-view="library">全部记录 ${icon('chevronRight', 16)}</button>` : ''}</div>${recent.length ? rowsMarkup(recent.map(t => ({...t, favorite: state.favorites.some(f=>f.id===t.id)})), { context:'recent',active:false,playing:false }) : emptyState('还没有播放记录','找到喜欢的歌曲，它会出现在这里。',`<button class="text-action" data-action="navigate" data-view="search">去搜索 ${icon('chevronRight', 16)}</button>`)}</section>
  <section class="home-discover"><div class="section-heading"><div><span class="eyebrow">FIND SOMETHING NEW</span><h2>听点新的</h2></div></div><div id="featured-playlists">${state.featuredLoading ? `<div class="feature-skeleton">${Array.from({length:4},()=>'<div class="feature-sk"><span class="skeleton"></span><span class="skeleton"></span></div>').join('')}</div>` : state.featured.length ? `<div class="feature-grid">${state.featured.slice(0,4).map(playlistCard).join('')}</div>` : `<div class="suggestion-note"><span class="suggestion-disc">${icon('disc',26)}</span><p>按下搜索，<br>在浩瀚曲库中遇见一首新歌。</p><button class="text-action" data-action="navigate" data-view="search">探索音乐 ${icon('chevronRight',15)}</button></div>`}</div></section></div></div>`;
}

export function searchMarkup(state) {
  const keyword = e(state.searchQuery);
  const results = state.searchType === 'songs' ? state.searchSongs : state.searchPlaylists;
  return `<div class="page page-search"><div class="page-intro"><span class="eyebrow">EXPLORE / MUSIC</span><h1>搜索音乐</h1></div><form id="search-form" class="search-form"><label for="search-input" class="sr-only">搜索歌曲、歌手或歌单</label>${icon('search', 22)}<input id="search-input" name="q" type="search" enterkeyhint="search" maxlength="100" autocomplete="off" placeholder="歌曲、歌手、歌单……" value="${keyword}" required><button class="search-submit" type="submit">搜索 ${icon('arrowUp',16)}</button></form>
  ${state.searchQuery ? `<div class="search-tabs"><div class="search-meta">关于「${keyword}」的结果</div>${segmentedMarkup([{value:'songs',label:'歌曲'},{value:'playlists',label:'歌单'}],state.searchType,'search-segmented')}</div>` : `<div class="search-suggestions"><span class="eyebrow">从熟悉的名字开始</span><div class="suggestion-chips">${['周杰伦','陈奕迅','Taylor Swift','RADWIMPS'].map(name=>`<button data-action="suggest-search" data-query="${e(name)}">${e(name)} ${icon('chevronRight',14)}</button>`).join('')}</div></div>`}
  <div class="search-results">${state.searchLoading ? skeletonRows(7) : state.searchError ? `<div class="error-state">${icon('info',24)}<h3>没有连接上音乐库</h3><p>${e(state.searchError)}</p><button class="button button-secondary" data-action="retry-search">重试</button><button class="text-action" data-action="settings">接口设置</button></div>` : state.searchQuery ? (results.length ? (state.searchType === 'songs' ? rowsMarkup(state.searchSongs.map(t=>({...t,favorite:state.favorites.some(f=>f.id===t.id)})), {context:'searchSongs'}) : `<div class="playlist-grid">${state.searchPlaylists.map(playlistCard).join('')}</div>`) : emptyState('没有找到结果','试试其他关键词，或换个歌手名称。')) : ''}</div></div>`;
}

export function libraryMarkup(state) {
  const lists = { favorites: state.favorites, recent: state.recent, local: state.localFiles };
  const list = lists[state.libraryTab] || [];
  return `<div class="page page-library"><div class="page-intro library-intro"><div><span class="eyebrow">YOUR PERSONAL COLLECTION</span><h1>你的音乐库</h1><p>喜欢的音乐，都在这里。</p></div><button class="button button-quiet" data-action="import">${icon('upload',17)} 导入音乐</button></div>
  <div class="library-header">${segmentedMarkup([{value:'favorites',label:`我喜欢的 · ${state.favorites.length}`},{value:'recent',label:'最近播放'},{value:'local',label:'本地歌曲'}],state.libraryTab,'library-segmented')}</div>
  ${list.length ? rowsMarkup(list.map(t=>({...t,favorite:state.favorites.some(f=>f.id===t.id)})),{context:state.libraryTab,removable:state.libraryTab==='local'}) : emptyState(state.libraryTab==='favorites' ? '还没有喜欢的歌曲' : state.libraryTab==='recent' ? '尚无播放记录' : '本地音乐库是空的', state.libraryTab==='local' ? '可导入自己的 MP3、FLAC 等音频文件，存储在本浏览器中。' : '播放喜欢的歌曲，点击爱心就能收藏。', state.libraryTab==='local' ? `<button class="button button-primary" data-action="import">${icon('upload',16)} 导入本地歌曲</button>` : `<button class="text-action" data-action="navigate" data-view="search">去搜索 ${icon('chevronRight',16)}</button>`)}
  <p class="library-footnote">收藏和播放记录只保存在当前浏览器，不会上传到音乐 API。清除浏览器网站数据会删除本地收藏及已导入的音频文件。</p></div>`;
}

export function playlistMarkup(state) {
  const list = state.playlist;
  return `<div class="page page-playlist"><button class="back-link" data-action="navigate" data-view="${e(state.backView||'home')}">${icon('chevronLeft',18)} 返回</button>${state.playlistLoading ? `<div class="playlist-hero playlist-hero-loading"><div class="skeleton"></div><div><span class="skeleton"></span><span class="skeleton"></span></div></div>${skeletonRows(8)}` : state.playlistError ? `<div class="error-state"><h2>歌单暂时无法打开</h2><p>${e(state.playlistError)}</p><button class="button button-secondary" data-action="retry-playlist">重试</button></div>` : list ? `<div class="playlist-hero">${albumArt({cover:list.cover},'hero')}<div><span class="eyebrow">PLAYLIST / 歌单</span><h1>${e(list.title)}</h1><p>${e(list.description || list.creator || '收藏属于你的声音。')}</p><span class="meta-line">${list.tracks.length} 首歌曲</span><div class="playlist-hero-actions"><button class="button button-primary" data-action="play-playlist">${icon('play',16)} 播放全部</button></div></div></div><div class="section-heading playlist-section"><div><span class="eyebrow">TRACKLIST</span><h2>曲目列表</h2></div></div>${list.tracks.length ? rowsMarkup(list.tracks.map(t=>({...t,favorite:state.favorites.some(f=>f.id===t.id)})),{context:'playlist'}) : emptyState('暂无可用曲目','这个歌单尚未返回歌曲列表。')}` : ''}</div>`;
}

export function playerMarkup(state) {
  const current = state.current;
  return `<div class="player-shell ${current ? 'has-track' : 'is-empty'}"><div class="player-inner">
    <button class="mini-now" data-action="open-full" ${current ? '' : 'disabled'} aria-label="打开完整播放器">${albumArt(current,'mini')}<span class="mini-meta"><strong>${e(current?.title || '还没有播放歌曲')}</strong><small>${e(current?.artist || '去搜索或导入一首音乐')}</small></span></button>
    <div class="player-center"><div class="transport"><button class="icon-button transport-shuffle ${state.shuffle?'is-active':''}" data-action="shuffle" title="随机播放" aria-label="随机播放">${icon('shuffle',17)}</button><button class="icon-button" data-action="prev" ${current?'':'disabled'} title="上一首" aria-label="上一首">${icon('prev',21)}</button><button class="transport-play" data-action="toggle-play" ${current?'':'disabled'} aria-label="${state.playing?'暂停':'播放'}">${icon(state.playing?'pause':'play',20)}</button><button class="icon-button" data-action="next" ${current?'':'disabled'} title="下一首" aria-label="下一首">${icon('next',21)}</button><button class="icon-button transport-repeat ${state.repeat!=='off'?'is-active':''}" data-action="repeat" title="循环模式" aria-label="循环模式">${icon(state.repeat==='one'?'repeatOne':'repeat',18)}${state.repeat==='one'?'<span class="repeat-dot"></span>':''}</button></div>
    <div class="progress-row"><span id="current-time">${formatTime(state.time)}</span><input id="seek-bar" aria-label="播放进度" type="range" min="0" max="1000" value="0" ${current?'':'disabled'}><span id="duration-time">${formatTime(state.duration||current?.duration||0)}</span></div></div>
    <div class="player-right"><button class="icon-button ${state.fullPanel==='lyrics'?'is-active':''}" data-action="open-lyrics" ${current?'':'disabled'} title="歌词" aria-label="歌词">${icon('lyric',19)}</button><button class="icon-button" data-action="open-queue" title="播放队列" aria-label="播放队列">${icon('list',19)}</button><div class="volume-control">${icon(state.settings.volume===0?'mute':'volume',19)}<input aria-label="音量" id="volume-slider" type="range" min="0" max="1" step="0.01" value="${state.settings.volume}"></div></div>
    <div class="mobile-transport"><button class="icon-button" data-action="open-queue" aria-label="播放队列">${icon('list',21)}</button><button class="icon-button" data-action="toggle-play" ${current?'':'disabled'} aria-label="${state.playing?'暂停':'播放'}">${icon(state.playing?'pause':'play',23)}</button></div>
    <div class="mobile-progress" id="mobile-progress" aria-hidden="true"><span></span></div></div></div>`;
}

export function fullPlayerMarkup(state) {
  const current = state.current;
  if (!current) return '';
  const showLyrics = state.fullPanel === 'lyrics';
  return `<div class="full-overlay" role="dialog" aria-modal="true" aria-label="完整播放器"><div class="full-header"><button class="icon-button" data-action="close-full" aria-label="收起完整播放器">${icon('chevronLeft',24)}</button><span>正在播放</span><button class="icon-button" data-action="open-queue" aria-label="打开队列">${icon('list',22)}</button></div>
    <div class="full-content"><div class="full-art-section">${albumArt(current,'full')}<div class="full-track"><div><h2>${e(current.title)}</h2><p>${e(current.artist)}</p></div><button class="icon-button ${state.favorites.some(f=>f.id===current.id)?'is-favorite':''}" data-action="favorite-current" aria-label="收藏">${icon('heart',23)}</button></div>
    <div class="full-progress"><input id="full-seek" aria-label="播放进度" type="range" min="0" max="1000" value="0"><div><span id="full-current-time">${formatTime(state.time)}</span><span id="full-duration-time">${formatTime(state.duration)}</span></div></div>
    <div class="full-controls"><button class="icon-button ${state.shuffle?'is-active':''}" data-action="shuffle" aria-label="随机播放">${icon('shuffle',20)}</button><button class="icon-button" data-action="prev" aria-label="上一首">${icon('prev',27)}</button><button class="transport-play transport-play-full" data-action="toggle-play" aria-label="播放或暂停">${icon(state.playing?'pause':'play',26)}</button><button class="icon-button" data-action="next" aria-label="下一首">${icon('next',27)}</button><button class="icon-button ${state.repeat!=='off'?'is-active':''}" data-action="repeat" aria-label="循环模式">${icon(state.repeat==='one'?'repeatOne':'repeat',20)}</button></div><button class="full-lyrics-toggle" data-action="toggle-lyrics">${icon('lyric',18)} ${showLyrics?'返回封面':'打开歌词'}</button></div>
    <div class="full-lyric-section ${showLyrics?'show-on-mobile':''}" id="full-lyric-section"><div class="lyric-heading"><span class="eyebrow">LYRICS</span><button class="text-action" data-action="toggle-lyrics">${showLyrics?'返回封面':'歌词'}</button></div><div class="lyric-viewport" id="lyric-viewport">${lyricMarkup(state)}</div></div></div>
  </div>`;
}

export function lyricMarkup(state) {
  if (state.lyricsLoading) return `<div class="lyric-placeholder"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>`;
  if (state.lyricsError) return `<div class="lyric-empty">${e(state.lyricsError)}</div>`;
  if (!state.lyrics.length) return `<div class="lyric-empty">这首歌曲暂时没有同步歌词。<br>让音乐自己说话。</div>`;
  return `<div class="lyric-lines">${state.lyrics.map((line,i)=>`<button type="button" class="lyric-line ${i===state.activeLyric?'is-current':''}" data-action="seek-lyric" data-time="${line.time}" data-lyric-index="${i}"><span>${e(line.text)}</span>${line.translation?`<small>${e(line.translation)}</small>`:''}</button>`).join('')}</div>`;
}

export function queueMarkup(state) {
  return `<div class="side-scrim" data-action="close-queue"></div><aside class="queue-panel" role="dialog" aria-modal="true" aria-label="播放队列"><div class="queue-top"><div><span class="eyebrow">UP NEXT</span><h2>播放队列 <small>${state.queue.length}</small></h2></div><button class="icon-button" data-action="close-queue" aria-label="关闭队列">${icon('close',22)}</button></div><div class="queue-list">${state.queue.length?state.queue.map((s,i)=>`<article class="queue-row ${i===state.queueIndex?'is-current':''}"><button data-action="queue-play" data-index="${i}" class="queue-entry">${albumArt(s,'row')}<span><strong>${e(s.title)}</strong><small>${e(s.artist)}</small></span></button><button class="icon-button" data-action="queue-remove" data-index="${i}" aria-label="移出队列">${icon('close',17)}</button></article>`).join(''):emptyState('队列里还没有歌','搜索并播放一首歌曲，或将歌曲加入队列。')}</div>${state.queue.length?'<div class="queue-footer"><button class="text-action" data-action="queue-clear">清空播放队列</button></div>':''}</aside>`;
}

export function settingsMarkup(state) {
  const settings = state.settings;
  return `<div class="dialog-overlay" id="settings-overlay"><section class="dialog-panel settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="dialog-head"><h2 id="settings-title">播放设置</h2><button class="icon-button" data-action="close-settings" aria-label="关闭">${icon('close',21)}</button></div>
  <form id="settings-form"><fieldset class="form-section"><legend>外观</legend><label class="form-label" for="theme-setting">主题</label><select id="theme-setting" name="theme"><option value="system" ${settings.theme==='system'?'selected':''}>跟随系统</option><option value="light" ${settings.theme==='light'?'selected':''}>浅色</option><option value="dark" ${settings.theme==='dark'?'selected':''}>深色</option></select></fieldset>
  <fieldset class="form-section"><legend>播放</legend><label class="form-label" for="quality-setting">优先音质</label><select id="quality-setting" name="quality"><option value="standard" ${settings.quality==='standard'?'selected':''}>标准音质</option><option value="higher" ${settings.quality==='higher'?'selected':''}>较高音质</option><option value="exhigh" ${settings.quality==='exhigh'?'selected':''}>极高音质（如果可用）</option><option value="lossless" ${settings.quality==='lossless'?'selected':''}>无损（如果可用）</option></select><p>不同歌曲的可用音质由音乐 API 和版权授权决定。</p></fieldset>
  <fieldset class="form-section"><legend>音乐接口</legend><label class="form-label" for="api-mode">连接方式</label><select name="apiMode" id="api-mode"><option value="auto" ${settings.apiMode==='auto'?'selected':''}>自动（开发时代理，部署后直连）</option><option value="direct" ${settings.apiMode==='direct'?'selected':''}>直接连接</option><option value="proxy" ${settings.apiMode==='proxy'?'selected':''}>本站代理（需部署支持）</option></select><label class="form-label" for="api-base">API 服务地址</label><input name="apiBase" id="api-base" spellcheck="false" value="${e(settings.apiBase)}" type="url" placeholder="https://music.20110208.xyz" required><p>若搜索始终失败，可能是接口未启用或跨域被浏览器拦截。本项目不绕过第三方会员与版权限制。</p><button class="text-action" type="button" data-action="test-api">${icon('wifi',16)} 测试接口连接</button><div id="api-test-result" role="status" aria-live="polite"></div></fieldset>
  <div class="dialog-actions"><button class="button button-ghost" type="button" data-action="close-settings">取消</button><button class="button button-primary" type="submit">保存设置</button></div></form></section></div>`;
}
