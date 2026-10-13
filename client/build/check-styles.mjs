import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const css=html.match(/<style data-aimo-styles>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css,'生产 HTML 必须携带样式');
assert.doesNotMatch(html,/<link\b[^>]*rel=["']stylesheet["']/,'不能依赖独立样式请求');
for(const selector of [':root','body{','.header-inner{','.song-row{','.player-shell{','.share-card{','@media'])assert.ok(css.includes(selector),`样式缺失：${selector}`);
console.log('生产页面包含主题、导航、列表、播放器、分享卡片与响应式样式。');
