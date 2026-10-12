/** 网易云兼容接口适配层；所有可能随上游变化的字段仅在此转换。 */
export const DEFAULT_API_BASE = 'https://music.20110208.xyz';

export function safeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    return url.toString();
  } catch { return ''; }
}

export function validateApiBase(value) {
  if (value === '/music-api') return '/music-api';
  const normalized = safeExternalUrl(value);
  if (!normalized) throw new Error('API 地址必须是有效的 HTTP(S) 地址');
  const url = new URL(normalized);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('远程 API 必须使用 HTTPS');
  }
  if (url.search || url.hash) throw new Error('API 地址不应包含参数或锚点');
  return url.toString().replace(/\/$/, '');
}

export function normalizeTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rawId = raw.id ?? raw.songId;
  if (rawId == null || !String(rawId).trim()) return null;
  const artists = raw.ar ?? raw.artists ?? raw.artist;
  let artist = '';
  if (Array.isArray(artists)) artist = artists.map(a => typeof a === 'string' ? a : a?.name).filter(Boolean).join(' / ');
  else if (typeof artists === 'string') artist = artists;
  else if (artists?.name) artist = artists.name;
  const albumData = raw.al ?? raw.album ?? {};
  const album = typeof albumData === 'string' ? albumData : albumData.name ?? '';
  const cover = safeExternalUrl(raw.cover || raw.picUrl || albumData.picUrl || albumData.blurPicUrl || '');
  const durationMs = Number(raw.dt ?? raw.duration ?? 0);
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs / 1000) : 0;
  return {
    id: String(rawId),
    title: String(raw.name ?? raw.title ?? '未命名歌曲'),
    artist: String(artist || '未知音乐人'),
    album: String(album || ''),
    cover,
    duration,
    source: 'remote',
  };
}

export function normalizePlaylist(raw) {
  if (!raw || raw.id == null) return null;
  return {
    id: String(raw.id), title: String(raw.name || '未命名歌单'),
    cover: safeExternalUrl(raw.picUrl || raw.coverImgUrl || ''),
    description: String(raw.copywriter || raw.description || ''),
    count: Number(raw.trackCount ?? raw.songCount ?? 0) || 0,
    creator: String(raw.creator?.nickname ?? ''),
  };
}

export class MusicApi {
  constructor(base = DEFAULT_API_BASE, fetcher = fetch) {
    this.base = validateApiBase(base);
    this.fetcher = fetcher;
  }
  setBase(base) { this.base = validateApiBase(base); }

  async get(path, params = {}, signal) {
    const origin = this.base === '/music-api' ? `${location.origin}/music-api/` : `${this.base}/`;
    const url = new URL(path.replace(/^\//, ''), origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    });
    const timeout = AbortSignal.timeout(14000);
    const merged = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try { response = await this.fetcher(url.toString(), { signal: merged, headers: { Accept: 'application/json' } }); }
    catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('无法连接音乐 API。请检查网络、服务地址和跨域设置。');
    }
    if (!response.ok) throw new Error(`音乐 API 返回 HTTP ${response.status}`);
    try {
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('音乐 API 返回了无效响应');
      if (data.code != null && Number(data.code) !== 200) throw new Error(`音乐 API 返回错误 ${data.code}${data.msg ? `：${String(data.msg).slice(0, 100)}` : ''}`);
      return data;
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('音乐 API 未返回有效 JSON');
      throw error;
    }
  }

  async searchSongs(keywords, signal) {
    const query = String(keywords || '').trim();
    if (!query) return [];
    let data;
    try { data = await this.get('search', { keywords: query, limit: 45, type: 1 }, signal); }
    catch (error) {
      if (signal?.aborted) throw error;
      data = await this.get('cloudsearch', { keywords: query, limit: 45, type: 1 }, signal);
    }
    return (data?.result?.songs || data?.songs || []).map(normalizeTrack).filter(Boolean);
  }

  async searchPlaylists(keywords, signal) {
    if (!String(keywords).trim()) return [];
    const data = await this.get('search', { keywords: keywords.trim(), limit: 30, type: 1000 }, signal);
    return (data?.result?.playlists || data?.playlists || []).map(normalizePlaylist).filter(Boolean);
  }

  async discoverPlaylists(signal) {
    const data = await this.get('personalized', { limit: 8 }, signal);
    return (data?.result || []).map(normalizePlaylist).filter(Boolean);
  }

  async playlistDetail(id, signal) {
    const data = await this.get('playlist/detail', { id }, signal);
    const raw = data?.playlist || data?.result || {};
    const tracks = (raw.tracks || []).map(normalizeTrack).filter(Boolean);
    const byId = new Map(tracks.map(track => [track.id, track]));
    const trackIds = (raw.trackIds || []).map(track => String(track?.id ?? '')).filter(Boolean);
    const missing = [...new Set(trackIds)].filter(trackId => !byId.has(trackId));
    // 歌单可返回少量 tracks 和完整 trackIds；每批请求缺失部分，保持原顺序。
    for (let start = 0; start < missing.length; start += 100) {
      const songData = await this.get('song/detail', { ids: missing.slice(start, start + 100).join(',') }, signal);
      for (const track of (songData?.songs || []).map(normalizeTrack).filter(Boolean)) byId.set(track.id, track);
    }
    const ordered = trackIds.length ? trackIds.map(trackId => byId.get(trackId)).filter(Boolean) : tracks;
    return { ...normalizePlaylist(raw), tracks: [...new Map(ordered.map(track => [track.id, track])).values()], count: raw.trackCount ?? trackIds.length ?? ordered.length };
  }

  async lyrics(id, signal) {
    const data = await this.get('lyric', { id }, signal);
    return { original: data?.lrc?.lyric || data?.klyric?.lyric || '', translation: data?.tlyric?.lyric || '' };
  }

  async audioUrl(id, quality = 'standard', signal) {
    const params = { id, level: quality };
    let data;
    try { data = await this.get('song/url/v1', params, signal); }
    catch (error) {
      if (signal?.aborted) throw error;
      data = null;
    }
    const pickUrl = response => {
      let item = response?.data?.[0] || response?.data || response?.result;
      if (Array.isArray(item)) item = item[0];
      return safeExternalUrl(item?.url || '');
    };
    let url = pickUrl(data);
    // 只尝试公开可用的旧接口，不绕过上游鉴权/付费限制。
    if (!url) {
      data = await this.get('song/url', { id, br: quality === 'exhigh' ? 320000 : 128000 }, signal);
      url = pickUrl(data);
    }
    if (!url) throw new Error('这首歌曲暂无可用播放地址，可能存在版权或会员限制。');
    return url;
  }
}
