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
export function songMenuMarkup(track,lists){
 return `<div class="feat-menu" role="dialog" aria-label="歌曲快捷菜单"><h3>${e(track.title)}</h3><p>${e(track.artist)}</p>${[['next','下一首播放'],['queue','加入播放队列'],['favorite','收藏 / 取消收藏'],['info','查看歌曲信息'],['copy','复制歌曲信息'],['artist','查看歌手'],['album','查看专辑'],['link','复制歌曲链接']].map(([k,v])=>`<button data-feature="song-${k}">${v}</button>`).join('')}<h4>添加到歌单</h4>${lists.filter(p=>!p.smart).map(p=>`<button data-feature="song-add" data-id="${e(p.id)}">＋ ${e(p.name)}</button>`).join('')||'<p>请先创建一个普通歌单</p>'}<button data-feature="close-menu">关闭</button></div>`;
}
