import test from 'node:test';
import assert from 'node:assert/strict';
import {songMenuMarkup} from '../client/src/ui/collections-view.js';
const song={id:'1234',source:'remote',title:'歌曲<名>',artist:'歌手',album:'专辑'};
test('歌曲操作菜单分为播放、收藏、资料和分享四类',()=>{
 const html=songMenuMarkup(song,[{id:'1',name:'自定义<歌单>',smart:false},{id:'2',name:'智能',smart:true}]);
 for(const group of ['播放管理','收藏与歌单','歌曲资料','分享与复制'])assert.match(html,new RegExp(group));
 assert.match(html,/<details class="feat-menu-playlists">/);
 assert.match(html,/&lt;歌单&gt;/);assert.doesNotMatch(html,/自定义<歌单>/);
 assert.doesNotMatch(html,/data-id="2"/);
 assert.match(html,/下一首播放/);assert.match(html,/复制歌曲链接/);
});
test('已收藏歌曲的动作明确表示取消喜欢；无链接来源禁用分享按钮',()=>{
 const html=songMenuMarkup({id:'local:a',source:'local',title:'本地音乐'},[],true);
 assert.match(html,/取消喜欢/);
 assert.match(html,/data-feature="song-link" disabled aria-disabled="true"/);
});
