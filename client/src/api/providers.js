/** 音乐 API 管理层：内置网易云兼容协议 + 无可执行代码的 JSON 字段映射。 */
import { MusicApi, DEFAULT_API_BASE, validateApiBase, safeExternalUrl } from './music.js';

export const BUILTIN_ID = 'netease-default';
export const DEFAULT_PROFILES = Object.freeze([
  { id: BUILTIN_ID, name: '默认音乐接口', type: 'netease', base: DEFAULT_API_BASE, namespace: 'netease', enabled: true, rules: {} },
]);
// 根据用户提供的 CurrentStation 接口目录：/cm/ncm/{path}；真实响应和 CORS 尚未实测。
export const STATION_NCM_PRESET = Object.freeze({
  id: 'currentstation-ncm', name: 'CurrentStation 网易云代理（待验证）',
  type: 'netease', base: 'https://music.20110208.xyz/cm/ncm', namespace: 'netease', enabled: true, rules: {},
});
export const MAX_PROFILES = 20;
const MAX_RULE_BYTES = 25000;
const OPERATIONS = ['searchSongs', 'searchPlaylists', 'discoverPlaylists', 'playlistDetail', 'lyrics', 'audioUrl'];
export const EXAMPLE_RULES = Object.freeze({
  response: { codePath: 'code', okCodes: [200] },
  maps: {
    track: { id: 'id', title: 'name', artist: 'artists[].name', album: 'album.name', cover: 'album.picUrl', duration: 'duration', durationUnit: 'ms' },
    playlist: { id: 'id', title: 'name', cover: 'coverImgUrl', description: 'description', count: 'trackCount', creator: 'creator.nickname' },
  },
  endpoints: {
    searchSongs: { path: 'search', query: { keywords: '{{keywords}}', limit: '{{limit}}', type: '1' }, items: 'result.songs' },
    searchPlaylists: { path: 'search', query: { keywords: '{{keywords}}', type: '1000' }, items: 'result.playlists' },
    discoverPlaylists: { path: 'personalized', items: 'result' },
    playlistDetail: { path: 'playlist/detail', query: { id: '{{id}}' }, root: 'playlist', tracks: 'tracks' },
    lyrics: { path: 'lyric', query: { id: '{{id}}' }, original: 'lrc.lyric', translation: 'tlyric.lyric' },
    audioUrl: { path: 'song/url', query: { id: '{{id}}', level: '{{quality}}' }, url: 'data.0.url' },
  },
});

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeString = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const FIELD_PATH = /^(?:[a-zA-Z_$][\w$]*|\d+)(?:(?:\.(?:[a-zA-Z_$][\w$]*|\d+))|\[\]){0,15}$/;
const FORBIDDEN_FIELDS = new Set(['__proto__', 'prototype', 'constructor']);
const validPath = value => typeof value === 'string' && FIELD_PATH.test(value) && !value.replaceAll('[]', '').split('.').some(p => FORBIDDEN_FIELDS.has(p));

export function readPath(root, path) {
  if (!validPath(path)) return undefined;
  return path.replaceAll('[]', '.[]').split('.').reduce((value, key) => {
    if (key === '[]') return Array.isArray(value) ? value : undefined;
    if (Array.isArray(value) && !/^\d+$/.test(key)) return value.map(v => object(v) && Object.hasOwn(v, key) ? v[key] : undefined).filter(v => v != null);
    return value != null && (object(value) || Array.isArray(value)) && Object.hasOwn(value, key) ? value[key] : undefined;
  }, root);
}
function validateFieldMap(value, name) {
  if (!object(value)) throw Error(`${name} 需要 JSON 对象`);
  for (const [key, path] of Object.entries(value)) {
    if (key === 'durationUnit') {
      if (!['ms', 's'].includes(path)) throw Error('durationUnit 只能是 ms 或 s');
    } else if (typeof path !== 'string' || (path && !validPath(path))) throw Error(`${name}.${key} 字段路径无效`);
  }
}
function validatePlainMap(value, name) {
  if (!object(value) || Object.keys(value).length > 30) throw Error(`${name} 必须是最多 30 项的 JSON 对象`);
  for (const [key, item] of Object.entries(value)) {
    if (!/^[\w.-]{1,80}$/.test(key) || FORBIDDEN_FIELDS.has(key) || /(?:api[-_]?key|access[-_]?token|client[-_]?secret|password|authorization)/i.test(key)) throw Error(`${name} 含非法字段名或可能泄露密钥的字段`);
    if (!['string','number','boolean'].includes(typeof item) || String(item).length > 3000) throw Error(`${name} 的值必须为简短的字符串、数字或布尔值`);
  }
}
export function validateRules(rules) {
  if (!object(rules) || JSON.stringify(rules).length > MAX_RULE_BYTES) throw Error('规则必须是小于 25 KB 的 JSON 对象');
  if (!object(rules.endpoints) || !object(rules.maps)) throw Error('规则缺少 endpoints 或 maps');
  validateFieldMap(rules.maps.track, 'maps.track');
  if (!rules.maps.track.id || !rules.maps.track.title) throw Error('歌曲映射必须包含 id 与 title');
  validateFieldMap(rules.maps.playlist || {}, 'maps.playlist');
  if (rules.response != null) {
    if (!object(rules.response)) throw Error('response 必须为对象');
    if (rules.response.codePath && !validPath(rules.response.codePath)) throw Error('response.codePath 不合法');
    if (rules.response.okCodes && (!Array.isArray(rules.response.okCodes) || rules.response.okCodes.length > 10 || rules.response.okCodes.some(v => !['string','number'].includes(typeof v)))) throw Error('okCodes 格式不正确');
  }
  for (const [name, ep] of Object.entries(rules.endpoints)) {
    if (!OPERATIONS.includes(name)) throw Error(`未知操作：${name}`);
    if (!object(ep) || typeof ep.path !== 'string' || !ep.path.trim() || ep.path.length > 300 || ep.path.startsWith('/') || /(?:\\|[?#]|(^|\/)\.\.(?:\/|$)|^[a-z][a-z\d+.-]*:)/i.test(ep.path)) throw Error(`${name}.path 无效`);
    if (!['GET','POST'].includes(ep.method || 'GET')) throw Error(`${name} 仅支持 GET / POST`);
    for (const key of ['query','headers','body']) if (ep[key] != null) validatePlainMap(ep[key], `${name}.${key}`);
    for (const key of ['items','root','tracks','original','translation','url']) if (ep[key] && !validPath(ep[key])) throw Error(`${name}.${key} 字段路径无效`);
  }
  if (!rules.endpoints.searchSongs || !rules.endpoints.audioUrl) throw Error('自定义接口至少需要配置歌曲搜索和播放地址');
  return rules;
}
export function validateProfile(input) {
  if (!object(input)) throw Error('API 配置必须为对象');
  const id = safeString(input.id, 80);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw Error('API ID 只能包含字母、数字、- 和 _');
  const name = safeString(input.name, 70);
  if (!name) throw Error('请输入 API 名称');
  const type = ['custom','netease'].includes(input.type) ? input.type : null;
  if (!type) throw Error('未知的 API 类型');
  const base = validateApiBase(input.base);
  if (type === 'custom' && base === '/music-api') throw Error('自定义接口请使用完整的 HTTPS 地址');
  const namespace = safeString(input.namespace || (type === 'netease' ? 'netease' : id), 90);
  if (!/^[a-zA-Z0-9_-]{1,90}$/.test(namespace)) throw Error('资源命名空间只能使用字母、数字、- 和 _');
  return { id, name, type, base, namespace, enabled: input.enabled !== false, rules: type === 'custom' ? validateRules(input.rules) : {} };
}
export function sanitizeProfiles(input, legacyBase = DEFAULT_API_BASE) {
  let base = DEFAULT_API_BASE;
  try {base = validateApiBase(legacyBase);} catch { /* 旧数据不合法时恢复默认 */ }
  const list = Array.isArray(input) ? input : [{ ...DEFAULT_PROFILES[0], base }];
  const profiles = [], ids = new Set();
  for (const raw of list.slice(0, MAX_PROFILES)) {
    try {const profile=validateProfile(raw);if(!ids.has(profile.id)){profiles.push(profile);ids.add(profile.id);}} catch { /* 独立跳过损坏项 */ }
  }
  return profiles.length ? profiles : [{...DEFAULT_PROFILES[0],base}];
}
export function exportProfiles(profiles) {return JSON.stringify({format:'aimomusic-api-profiles',version:1,profiles:sanitizeProfiles(profiles)},null,2);}
export function importProfiles(text) {
  if (typeof text !== 'string' || text.length > 600000) throw Error('导入文件过大');
  let doc;try{doc=JSON.parse(text);}catch{throw Error('导入内容不是有效 JSON');}
  if (!object(doc) || doc.format !== 'aimomusic-api-profiles' || doc.version !== 1 || !Array.isArray(doc.profiles) || !doc.profiles.length || doc.profiles.length > MAX_PROFILES) throw Error('不是受支持的 AimoMusic API 配置文件，或条目超过 20 个');
  const ids = new Set();
  return doc.profiles.map(raw=>{const profile=validateProfile(raw);if(ids.has(profile.id))throw Error(`重复的 API ID：${profile.id}`);ids.add(profile.id);return profile;});
}

const template = (value, vars) => String(value).replace(/\{\{([a-zA-Z]\w*)\}\}/g, (_, key) => String(vars[key] ?? ''));
const val = value => Array.isArray(value) ? value.map(val).filter(Boolean).join(' / ') : object(value) ? value.name ?? value.title ?? '' : value ?? '';
export function trackIdentity(song) {
  if (!song) return '';
  return song.source === 'local' ? `local::${song.id}` : `remote:${song.providerNamespace || 'netease'}:${song.id}`;
}
function mapTrack(data, fields, profile) {
  const id = readPath(data, fields.id);
  if (id == null || String(id).trim() === '') return null;
  const duration = Number(readPath(data, fields.duration) ?? 0);
  return {
    id:String(id), title:String(val(readPath(data, fields.title)) || '未命名歌曲'),
    artist:String(val(readPath(data, fields.artist)) || '未知音乐人'),
    album:String(val(readPath(data, fields.album))), cover:safeExternalUrl(readPath(data, fields.cover) || ''),
    duration:Number.isFinite(duration) && duration > 0 ? Math.round(duration/(fields.durationUnit === 's' ? 1 : 1000)) : 0,
    source:'remote', providerId:profile.id, providerNamespace:profile.namespace,
  };
}
function mapPlaylist(data, fields, profile) {
  const id=readPath(data, fields.id);
  if (id == null || String(id).trim() === '') return null;
  return {
    id:String(id),title:String(val(readPath(data,fields.title)) || '未命名歌单'),
    cover:safeExternalUrl(readPath(data,fields.cover)||''),description:String(val(readPath(data,fields.description))),
    count:Number(readPath(data,fields.count))||0, creator:String(val(readPath(data,fields.creator))),
    providerId:profile.id, providerNamespace:profile.namespace,
  };
}

export class CustomMusicApi {
  constructor(profile, fetcher = fetch) {
    this.profile=validateProfile(profile);
    if(this.profile.type !== 'custom') throw Error('只允许用自定义类型初始化映射适配器');
    this.fetcher=fetcher;
  }
  async request(name, vars={}, signal) {
    const rules=this.profile.rules, ep=rules.endpoints[name];
    if (!ep) throw Error(`此 API 未配置「${name}」功能`);
    const root = new URL(`${this.profile.base}/`);
    // 路径模板已在保存配置时校验；变量作为编码后的单个路径分段。
    // 对路径变量编码，避免用户关键词被解析为 ../ 或跨域 URL。
    const pathname=ep.path.replace(/\{\{([a-zA-Z]\w*)\}\}/g,(_,key)=>encodeURIComponent(String(vars[key]??'')));
    const url=new URL(pathname,root);
    if(url.origin!==root.origin || !url.pathname.startsWith(root.pathname))throw Error('接口路径不得跳出 API 根目录');
    for (const [k,v] of Object.entries(ep.query || {})) url.searchParams.set(k,template(v,vars));
    const headers={Accept:'application/json'};
    for (const [k,v] of Object.entries(ep.headers || {})) {
      if (!/^[a-zA-Z0-9-]{1,60}$/.test(k) || /^(host|cookie|authorization|proxy-authorization|referer|origin|sec-.*)$/i.test(k)) throw Error('敏感请求头必须由可信服务端处理');
      headers[k]=template(v,vars);
    }
    const method=ep.method||'GET';
    const options={method,headers,credentials:'omit',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(14000)]):AbortSignal.timeout(14000)};
    if(method==='POST') {
      headers['Content-Type']='application/json';
      options.body=JSON.stringify(Object.fromEntries(Object.entries(ep.body||{}).map(([k,v])=>[k,template(v,vars)])));
    }
    let response;
    try {response=await this.fetcher(url.toString(),options);}catch(error){if(signal?.aborted)throw error;throw Error('无法连接 API（网络、超时或跨域限制）');}
    if(!response.ok)throw Error(`音乐 API 返回 HTTP ${response.status}`);
    let data;try{data=await response.json();}catch{throw Error('音乐 API 未返回有效 JSON');}
    if (data===null || typeof data!=='object') throw Error('音乐 API 响应结构无效');
    if(rules.response?.codePath){const code=readPath(data,rules.response.codePath);if(code!==undefined && !(rules.response.okCodes||[200]).map(String).includes(String(code)))throw Error(`音乐 API 返回业务错误 ${code}`);}
    return {data,ep};
  }
  async searchSongs(keywords,signal){const {data,ep}=await this.request('searchSongs',{keywords,limit:45},signal);const items=readPath(data,ep.items);if(!Array.isArray(items))throw Error('音乐 API 歌曲列表响应结构无效');return items.map(t=>mapTrack(t,this.profile.rules.maps.track,this.profile)).filter(Boolean);}
  async searchPlaylists(keywords,signal){const {data,ep}=await this.request('searchPlaylists',{keywords,limit:30},signal);const items=readPath(data,ep.items);if(!Array.isArray(items))throw Error('音乐 API 歌单列表响应结构无效');return items.map(t=>mapPlaylist(t,this.profile.rules.maps.playlist||{},this.profile)).filter(Boolean);}
  async discoverPlaylists(signal){const {data,ep}=await this.request('discoverPlaylists',{},signal);const items=readPath(data,ep.items);if(!Array.isArray(items))throw Error('音乐 API 推荐歌单响应结构无效');return items.map(t=>mapPlaylist(t,this.profile.rules.maps.playlist||{},this.profile)).filter(Boolean);}
  async playlistDetail(id,signal){const {data,ep}=await this.request('playlistDetail',{id},signal);const root=readPath(data,ep.root)||data;const tracks=readPath(root,ep.tracks);if(!Array.isArray(tracks))throw Error('音乐 API 歌单曲目响应结构无效');return {...(mapPlaylist(root,this.profile.rules.maps.playlist||{},this.profile)||{id:String(id),title:'歌单',count:0,providerId:this.profile.id,providerNamespace:this.profile.namespace}),tracks:tracks.map(t=>mapTrack(t,this.profile.rules.maps.track,this.profile)).filter(Boolean)};}
  async lyrics(id,signal){const {data,ep}=await this.request('lyrics',{id},signal);return {original:String(readPath(data,ep.original)||''),translation:String(readPath(data,ep.translation)||'')};}
  async audioUrl(id,quality='standard',signal){const {data,ep}=await this.request('audioUrl',{id,quality},signal);const url=safeExternalUrl(readPath(data,ep.url)||'');if(!url)throw Error('此歌曲暂无可用播放地址（可能存在版权或会员限制）');return url;}
}

const recoverable = error => /(?:HTTP (?:404|408|410|425|429|5\d\d)|无法连接|跨域|网络|超时|无效 JSON|响应结构无效|未配置)/i.test(String(error?.message));
export class ManagedMusicApi {
  constructor(fetcher=fetch){this.fetcher=fetcher;this.configure({apiProfiles:DEFAULT_PROFILES,activeApiId:BUILTIN_ID,apiSwitchMode:'auto'});}
  configure(settings){
    this.profiles=sanitizeProfiles(settings.apiProfiles,settings.apiBase);
    this.activeId=this.profiles.some(p=>p.id===settings.activeApiId&&p.enabled)?settings.activeApiId:this.profiles.find(p=>p.enabled)?.id||this.profiles[0].id;
    this.strategy=['auto','manual','priority'].includes(settings.apiSwitchMode)?settings.apiSwitchMode:'auto';
    this.connectionMode=settings.apiMode||'direct';
    this.cache=new Map();
    this.lastFallback=null;
  }
  profile(id){return this.profiles.find(p=>p.id===id);}
  client(profile){
    if(!this.cache.has(profile.id)){
      const proxy = profile.id===BUILTIN_ID && profile.type==='netease' && (this.connectionMode==='proxy'||(this.connectionMode==='auto' && import.meta.env?.DEV));
      this.cache.set(profile.id,profile.type==='custom'?new CustomMusicApi(profile,this.fetcher):new MusicApi(proxy?'/music-api':profile.base,this.fetcher));
    }
    return this.cache.get(profile.id);
  }
  candidates(providerId,namespace,browse=false){
    const enabled=this.profiles.filter(p=>p.enabled);
    if(!enabled.length)throw Error('没有已启用的音乐 API，请在设置中启用一个');
    const exact=this.profile(providerId);
    const scope=namespace || exact?.namespace;
    // 已有歌曲只能交由相同命名空间的服务解析，不能用另一平台的同名 ID 冒险播放。
    const compatible=browse?enabled:enabled.filter(p=>!scope||p.namespace===scope);
    if(!compatible.length)throw Error('这首歌曲对应的 API 已移除，请添加相同资源命名空间的接口');
    const preferred=exact?.enabled ? exact : enabled.find(p=>p.id===this.activeId);
    const order=this.strategy==='priority' && !providerId ? compatible : [preferred,...compatible.filter(p=>p.id!==preferred?.id)].filter(p=>compatible.some(c=>c.id===p?.id));
    return this.strategy==='manual' ? order.slice(0,1) : order;
  }
  async run(method,args=[],providerId=null,namespace=null,browse=false){
    const candidates=this.candidates(providerId,namespace,browse);
    let error;
    for(let i=0;i<candidates.length;i++){
      const p=candidates[i];
      try {
        const result=await this.client(p)[method](...args);
        if (i>0) this.lastFallback={from:candidates[0].name,to:p.name,operation:method,at:Date.now()};
        if(Array.isArray(result))return result.map(item=>({...item,providerId:p.id,providerNamespace:p.namespace}));
        if(method==='playlistDetail')return {...result,providerId:p.id,providerNamespace:p.namespace,tracks:(result.tracks||[]).map(t=>({...t,providerId:p.id,providerNamespace:p.namespace}))};
        return result;
      } catch(err){error=err;if(args.at(-1)?.aborted||!recoverable(err)||i===candidates.length-1)throw err;}
    }
    throw error;
  }
  searchSongs(keywords,signal){return this.run('searchSongs',[keywords,signal],null,null,true);}
  searchPlaylists(keywords,signal){return this.run('searchPlaylists',[keywords,signal],null,null,true);}
  discoverPlaylists(signal){return this.run('discoverPlaylists',[signal],null,null,true);}
  playlistDetail(id,signal,providerId,namespace){return this.run('playlistDetail',[id,signal],providerId,namespace);}
  lyrics(id,signal,providerId,namespace){return this.run('lyrics',[id,signal],providerId,namespace);}
  audioUrl(id,quality,signal,providerId,namespace){return this.run('audioUrl',[id,quality,signal],providerId,namespace);}
  async testProfile(id){
    const p=this.profile(id);if(!p)throw Error('API 不存在');
    const start=Date.now();const songs=await this.client(p).searchSongs('音乐');
    return {ok:true,count:songs.length,latency:Date.now()-start};
  }
}
