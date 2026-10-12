import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryMarkup} from '../client/src/ui/navigation-view.js';
test('导航目录展示当前位置并支持音乐库标签跳转',()=>{
 const html=directoryMarkup({view:'library',libraryTab:'history',navigationMenuOpen:true});
 assert.match(html,/aria-label="导航目录与当前位置"/);
 assert.match(html,/播放历史/);
 assert.match(html,/data-tab="playlists"/);
 assert.match(html,/data-action="nav-go"/);
});
test('歌单路径正确转义第三方标题',()=>{
 const html=directoryMarkup({view:'playlist',backView:'home',playlist:{title:'<svg onload=alert(1)>'}});
 assert.match(html,/发现/);assert.match(html,/&lt;svg/);assert.doesNotMatch(html,/<svg onload=/);
});
