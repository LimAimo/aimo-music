import {icon} from './icons.js';
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cover=p=>(/^https?:\/\//i.test(p?.cover||'')||/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(p?.cover||''))?`<img alt="" src="${e(p.cover)}">`:'<span aria-hidden="true">♫</span>';
const fields={favorite:'已收藏',played:'曾经播放',count:'播放次数',artist:'歌手',title:'歌曲名',album:'专辑',duration:'时长（秒）',source:'来源',daysSincePlayed:'距离上次播放（天）'};
const ops={eq:'等于',neq:'不等于',has:'包含',notHas:'不包含',gt:'大于',lt:'小于'};
const options=(values,value)=>Object.entries(values).map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${e(v)}</option>`).join('');
export function ruleMarkup(rule,path='0',depth=0){
 if(rule.kind==='test')return `<div class="feat-rule-row"><select data-rule-field="field" data-path="${path}" aria-label="筛选字段">${options(fields,rule.field)}</select><select data-rule-field="op" data-path="${path}" aria-label="条件">${options(ops,rule.op)}</select><input aria-label="条件值" data-rule-field="value" data-path="${path}" value="${e(rule.value)}"><button type="button" class="button button-quiet" data-feature="remove-rule" data-path="${path}">移除</button></div>`;
 return `<fieldset class="feat-group"><legend>条件组</legend><label>匹配 <select data-rule-field="mode" data-path="${path}">${options({all:'全部满足',any:'任意满足'},rule.mode)}</select></label><label><input type="checkbox" data-rule-field="not" data-path="${path}" ${rule.not?'checked':''}> 排除整组</label><div class="feat-children">${rule.items.map((x,i)=>ruleMarkup(x,path+'.'+i,depth+1)).join('')}</div><div class="feat-buttons"><button type="button" class="button button-secondary" data-feature="add-rule" data-path="${path}">添加条件</button>${depth<6?`<button type="button" class="button button-secondary" data-feature="add-group" data-path="${path}">嵌套条件组</button>`:''}${depth?`<button type="button" class="button button-quiet" data-feature="remove-rule" data-path="${path}">移除条件组</button>`:''}</div></fieldset>`;
}
export function collectionsMarkup(state){
 const items=state.localPlaylists||[],p=items.find(x=>x.id===state.selectedLocalPlaylist);
 if(state.collectionEdit&&state.collectionDraft){
   const d=state.collectionDraft;
   return `<section class="feat-area"><div class="feat-header"><h2>编辑歌单</h2><button type="button" class="button button-quiet" data-feature="back">返回</button></div><form id="collection-form" class="feat-form">
   <label>歌单名称<input required maxlength="80" name="name" value="${e(d.name)}"></label>
   <label>描述<textarea name="description" rows="3" maxlength="500">${e(d.description)}</textarea></label>
   <label>封面图片<input type="file" data-feature-cover accept="image/png,image/jpeg,image/webp"></label>${d.cover?`<div class="feat-art">${cover(d)}</div>`:''}
   <label class="feat-inline"><input type="checkbox" data-feature-smart ${d.smart?'checked':''}> 智能歌单（根据规则自动筛选）</label>
   ${d.smart?`<div class="feat-editor"><h3>智能筛选规则</h3>${ruleMarkup(d.rules)}<label>结果排序<select name="sort">${options({recent:'最近播放',count:'播放次数',title:'歌曲名称',artist:'歌手'},d.sort)}</select></label><label>歌曲数量限制（0 为不限）<input type="number" min="0" max="10000" name="limit" value="${d.limit||0}"></label></div>`:''}
   <div class="feat-buttons"><button type="submit" class="button button-primary">保存歌单</button><button type="button" class="button button-quiet" data-feature="back">取消</button></div></form></section>`;
 }
 if(p){
  const tracks=state.selectedLocalTracks||[];
  return `<section class="feat-area"><div class="feat-header"><button class="button button-quiet" data-feature="back">全部歌单</button><h2>${e(p.name)}</h2></div><div class="feat-art">${cover(p)}</div><p>${e(p.description)}</p><p class="feat-secondary">${p.smart?'智能歌单':'普通歌单'} · ${tracks.length} 首歌曲</p>
  <div class="feat-buttons"><button class="button button-primary" data-feature="play-list">播放全部</button><button class="button button-secondary" data-feature="edit" data-id="${e(p.id)}">编辑</button><button class="button button-quiet" data-feature="export-list" data-id="${e(p.id)}">导出</button><button class="button button-quiet" data-feature="delete" data-id="${e(p.id)}">删除</button></div>
  <div class="feat-tracks">${tracks.length?tracks.map((t,i)=>`<div class="feat-track" draggable="${!p.smart}" data-track-index="${i}"><button data-feature="play-one" data-index="${i}"><strong>${e(t.title)}</strong><small>${e(t.artist)}</small></button><div><button title="更多操作" aria-label="更多操作" data-feature="song-menu" data-context="localPlaylist" data-id="${e(t.id)}" data-namespace="${e(t.source==='local'?'local':t.providerNamespace||'netease')}">···</button></div>${!p.smart?`<div><button title="上移" data-feature="up" data-index="${i}">↑</button><button title="下移" data-feature="down" data-index="${i}">↓</button><button title="移除" data-feature="remove-song" data-index="${i}">×</button></div>`:''}</div>`).join(''):'<p class="feat-secondary">这个歌单暂时没有歌曲。</p>'}</div></section>`;
 }
 return `<section class="feat-area"><div class="feat-header"><h2>我的歌单</h2><div class="feat-buttons"><button class="button button-primary" data-feature="new-list">＋ 新建歌单</button><button class="button button-secondary" data-feature="import-lists">导入</button><button class="button button-quiet" data-feature="export-all">备份全部</button><button class="button button-quiet" data-feature="import-all">恢复备份</button></div></div>
 ${items.length?`<div class="feat-grid">${items.map(p=>`<button class="feat-card" data-feature="open-list" data-id="${e(p.id)}"><span class="feat-card-art">${cover(p)}</span><strong>${e(p.name)}</strong><small>${p.smart?'智能歌单':(p.tracks?.length||0)+' 首歌曲'}</small></button>`).join('')}</div>`:'<p class="feat-secondary">还没有歌单。可以创建普通歌单或高级智能歌单。</p>'}</section>`;
}
const isLinkable=t=>/^https?:\/\//i.test(String(t?.link||t?.url||''))||(t?.source==='remote'&&(t?.providerNamespace||'netease')==='netease'&&/^\d+$/.test(String(t?.id||'')));
const menuButton=(id,title,iconName,{disabled=false,muted=false}={})=>
 `<button class="feat-menu-item" type="button" data-feature="song-${id}" ${disabled?'disabled aria-disabled="true"':''}>${icon(iconName,19)}<span>${e(title)}</span>${muted?'<small>暂不可用</small>':''}</button>`;
export function songMenuMarkup(track,lists,isFavorite=false){
 const playable=[
  menuButton('next','下一首播放','next'),
  menuButton('queue','加入播放队列','list')
 ].join('');
 const folderOptions=lists.filter(p=>!p.smart);
 const collections=folderOptions.length?
  folderOptions.map(p=>`<button class="feat-menu-list-option" data-feature="song-add" data-id="${e(p.id)}">${icon('plus',16)}<span>${e(p.name)}</span></button>`).join(''):
  '<p class="feat-menu-empty">暂无自定义歌单，可在音乐库中创建。</p>';
 const library=[
  menuButton('favorite',isFavorite?'取消喜欢':'添加到喜欢','heart'),
  `<details class="feat-menu-playlists"><summary>${icon('plus',19)}<span>添加到歌单</span>${icon('chevronRight',16)}</summary><div class="feat-menu-list-options">${collections}</div></details>`
 ].join('');
 const metadata=[
  menuButton('info','歌曲信息','info'),
  menuButton('artist','查看歌手','music',{disabled:!track.artist}),
  menuButton('album','查看专辑','disc',{disabled:!track.album})
 ].join('');
 const sharing=[
  menuButton('share','制作分享卡片','external'),
  menuButton('copy','复制歌曲信息','list'),
  menuButton('link','复制歌曲链接','external',{disabled:!isLinkable(track)})
 ].join('');
 const section=(name,content)=>`<section class="feat-menu-section" aria-label="${name}"><h4>${name}</h4><div class="feat-menu-actions">${content}</div></section>`;
 return `<section class="feat-menu" role="dialog" aria-modal="true" aria-label="歌曲操作：${e(track.title)}" tabindex="-1">
  <div class="feat-menu-top"><div class="feat-menu-song"><span class="feat-menu-symbol" aria-hidden="true">${icon('music',22)}</span><div><strong title="${e(track.title)}">${e(track.title)}</strong><small>${e(track.artist||'未知歌手')}</small></div></div><button type="button" class="feat-menu-close" data-feature="close-menu" aria-label="关闭歌曲菜单">${icon('close',19)}</button></div>
  <div class="feat-menu-scroll">${section('播放管理',playable)}${section('收藏与歌单',library)}${section('歌曲资料',metadata)}${section('分享与复制',sharing)}</div>
 </section>`;
}
