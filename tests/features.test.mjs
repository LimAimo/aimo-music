import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionsMarkup,songMenuMarkup,ruleMarkup} from '../client/src/ui/collections-view.js';
import {libraryContentMarkup,settingsMarkup} from '../client/src/ui/render.js';
import {sanitizeSettings} from '../client/src/core/storage.js';
import {freshPlaylist,emptyRules} from '../client/src/core/collections.js';
test('歌单列表、编辑器与智能条件组都能实际渲染',()=>{
 const item=freshPlaylist(true);item.name='我的收藏';const s={localPlaylists:[item],selectedLocalPlaylist:null,selectedLocalTracks:[],collectionEdit:false,collectionDraft:null};
 assert.match(collectionsMarkup(s),/我的收藏/);
 assert.match(collectionsMarkup(s),/新建歌单/);
 s.collectionEdit=true;s.collectionDraft=item;
 assert.match(collectionsMarkup(s),/智能筛选规则/);
 assert.match(ruleMarkup(emptyRules()),/嵌套条件组/);
});
test('歌曲快捷菜单使用 HTML 转义，不允许第三方歌曲名注入',()=>{
 const html=songMenuMarkup({title:'<img src=x onerror=alert(1)>',artist:'A'},[]);
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/&lt;img/);
 assert.match(html,/下一首播放/);
});
test('音乐库历史分组和可配置快捷键真实可见',()=>{
 const time=Date.now();
 const view=libraryContentMarkup({libraryTab:'history',historyEntries:[{entryId:1,playedAt:time,track:{title:'歌甲',id:'1',source:'remote'}}],historyHasMore:false,historyLoading:false});
 assert.match(view,/history-day-heading/);
 assert.match(view,/歌甲/);
 const settings=settingsMarkup({apiView:'settings',settings:sanitizeSettings({})});
 assert.match(settings,/data-shortcut="KeyF"/);
 assert.match(settings,/恢复默认快捷键/);
});
