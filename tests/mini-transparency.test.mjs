import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitizeSettings} from '../client/src/core/storage.js';
import {settingsMarkup} from '../client/src/ui/render.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('迷你播放器通透度有默认值、越界处理和持久化入口',()=>{
 assert.equal(sanitizeSettings({}).miniTransparency,15);
 assert.equal(sanitizeSettings({miniTransparency:0}).miniTransparency,0);
 assert.equal(sanitizeSettings({miniTransparency:100}).miniTransparency,100);
 assert.equal(sanitizeSettings({miniTransparency:200}).miniTransparency,100);
 assert.equal(sanitizeSettings({miniTransparency:-5}).miniTransparency,0);
 const s=settingsMarkup({apiView:'settings',settings:sanitizeSettings({miniTransparency:70})});
 assert.match(s,/id="mini-transparency"/);
 assert.match(s,/name="miniTransparency"/);
 assert.match(s,/70%/);
 assert.match(s,/不会改变完整播放器/);
});
test('透明参数仅作用于底部播放器，封面模糊模式在底栏具备可识别背景',()=>{
 const css=read('../client/src/ui/mini-transparency.css');
 assert.match(css,/\.player-shell\s*\{[^}]*--mini-surface-opacity/s);
 assert.doesNotMatch(css,/\.full-overlay\s*\{/);
 assert.match(css,/\.player-shell\[data-ambient="blur"\]::before\s*\{[^}]*blur\(14px\)/s);
 const main=read('../client/src/main.js');
 assert.match(main,/element\.classList\.contains\('player-shell'\)/);
 assert.match(main,/if\(!state\.settingsOpen\)/);
});
