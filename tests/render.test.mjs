import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, songRow, searchMarkup, fullPlayerMarkup, libraryMarkup, libraryContentMarkup, settingsMarkup, header } from '../client/src/ui/render.js';
import { segmentedMarkup } from '../client/src/ui/controls.js';

test('第三方歌曲信息被转义，恶意封面 URL 不进入 DOM',()=>{
  const track={id:'1',title:'<img src=x onerror=alert(1)>',artist:'<script>x</script>',cover:'javascript:alert(1)',duration:21,source:'remote'};
  const html=songRow(track,0,{context:'results'});
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('src="javascript:'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
  assert.equal(escapeHtml('"'), '&quot;');
});
test('所有分段均由统一组件输出可访问的 ARIA 状态',()=>{
  const html=segmentedMarkup([{label:'发现',value:'home'},{label:'搜索',value:'search'}],'search');
  assert.match(html,/role="tablist"/);
  assert.match(html,/aria-selected="true" tabindex="0" data-value="search"/);
  assert.match(html,/seg-text-invert/);
});
test('搜索和完整播放器可渲染空资源，不要求远程音乐先加载',()=>{
  const s={searchQuery:'',searchType:'songs',searchSongs:[],searchPlaylists:[],searchLoading:false,searchError:'',current:null};
  assert.match(searchMarkup(s),/搜索音乐/);
  assert.equal(fullPlayerMarkup(s),'');
});

test('切换音乐库仅更新列表容器，导航与脚注保持稳定', () => {
  const state = {libraryTab:'recent', favorites:[], recent:[], localFiles:[], settings:{theme:'system'}};
  assert.match(libraryMarkup(state), /id="library-content"/);
  assert.match(libraryContentMarkup(state), /尚无播放记录/);
  assert.match(libraryMarkup(state), /library-segmented/);
});

test('设置表单具有独立滚动区与固定按钮区，顶栏提供齿轮入口', () => {
  const state = {settings:{theme:'system',quality:'standard',apiMode:'auto',apiBase:'https://music.20110208.xyz'}};
  const markup = settingsMarkup(state);
  assert.match(markup, /class="settings-fields"/);
  assert.match(markup, /<\/div>\s*<div class="dialog-actions">/);
  assert.match(header('home','dark'), /data-action="settings"/);
  assert.doesNotMatch(header('home','dark'), /data-action="cycle-theme"/);
});
