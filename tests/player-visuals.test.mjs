import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {animateCoverTransition,cancelPlayerTransition} from '../client/src/ui/player-motion.js';
import {settingsMarkup} from '../client/src/ui/render.js';
import {sanitizeSettings} from '../client/src/core/storage.js';

const source=path=>readFileSync(new URL('../client/src/ui/'+path,import.meta.url),'utf8');
const ambient=source('ambient.css'),keyboard=source('keyboard.css'),coverCSS=source('player-motion.css');
const readRule=selector=>{
 const at=ambient.indexOf(selector);
 assert.ok(at>=0,'缺少氛围模式规则：'+selector);
 const begin=ambient.indexOf('{',at);
 return ambient.slice(begin+1,ambient.indexOf('}',begin));
};
test('氛围层不修改播放器定位，始终压在背景和交互层之间',()=>{
 assert.doesNotMatch(ambient,/\.player-shell\s*,\s*\.full-overlay\s*\{[^}]*position\s*:/);
 assert.match(ambient,/\.player-shell::before,\s*\.full-overlay::before\s*\{[^}]*z-index:\s*0/s);
 assert.match(ambient,/\.full-overlay\s*>\s*\.full-content\s*\{[^}]*z-index:\s*1/s);
 assert.doesNotMatch(ambient,/z-index:\s*-1/);
});
test('光晕、模糊、渐变、单色和关闭，使用五套不同渲染方案',()=>{
 const glow=readRule('.full-overlay[data-ambient="glow"]::before');
 const blur=readRule('.full-overlay[data-ambient="blur"]::before');
 const gradient=readRule('.full-overlay[data-ambient="gradient"]::before');
 const single=readRule('.full-overlay[data-ambient="single"]::before');
 const off=readRule('.full-overlay[data-ambient="off"]::before');
 assert.match(glow,/radial-gradient/);
 assert.match(blur,/var\(--ambient-cover/);
 assert.match(blur,/blur\(32px\)/);
 assert.match(gradient,/linear-gradient/);
 assert.doesNotMatch(gradient,/blur\(/);
 assert.match(single,/background-color:\s*var\(--ambient-tone-0\)/);
 assert.match(single,/background-image:\s*none/);
 assert.match(off,/display:\s*none/);
});
test('统一封面圆角，FLIP 不允许通过 scale 放大圆角',()=>{
 const views=readFileSync(new URL('../client/src/styles/views.css',import.meta.url),'utf8');
 assert.match(views,/\.album-art--mini\s*\{[^}]*border-radius:\s*var\(--player-cover-radius/);
 assert.match(views,/\.album-art--full\s*\{[^}]*border-radius:\s*var\(--player-cover-radius/);
 assert.match(coverCSS,/\.player-shared-ghost\s*\{[^}]*border-radius:\s*var\(--player-cover-radius/s);
 const previous={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle,matchMedia:globalThis.matchMedia};
 let frames,ghost;
 const from={style:{},getBoundingClientRect:()=>({left:15,top:650,width:48,height:48}),cloneNode:()=>{
  ghost={style:{},classList:{add(){}},animate:keyframes=>{frames=keyframes;return {finished:Promise.resolve(),cancel(){}};},remove(){}};
  return ghost;
 },animate(){}};
 const to={style:{},getBoundingClientRect:()=>({left:125,top:150,width:360,height:360})};
 globalThis.document={body:{append(){}}};
 globalThis.getComputedStyle=()=>({borderRadius:'12px'});
 globalThis.matchMedia=()=>({matches:false});
 try {
  animateCoverTransition(from,to);
  assert.equal(frames[0].borderRadius,'12px');
  assert.equal(frames[1].borderRadius,'12px');
  assert.equal(frames[0].width,'48px');
  assert.equal(frames[1].width,'360px');
  assert.equal('transform' in frames[0],false);
  assert.equal('transform' in frames[1],false);
  assert.equal(ghost.style.borderRadius,'12px');
 }finally{
  cancelPlayerTransition();
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
 }
});
test('快捷键复选框使用主题样式，手机整段隐藏但保留表单数据',()=>{
 assert.match(keyboard,/input\[type="checkbox"\][^{]*\{[^}]*appearance:\s*none/s);
 assert.match(keyboard,/input\[type="checkbox"\]:checked\s*\{/);
 assert.match(keyboard,/@media\s*\(max-width:\s*767px\)\s*\{[^}]*\.desktop-shortcuts-section\s*\{[^}]*display:\s*none/s);
 const ui=settingsMarkup({apiView:'settings',settings:sanitizeSettings({})});
 assert.match(ui,/class="form-section desktop-shortcuts-section"/);
 assert.match(ui,/class="shortcut-enabled"><input type="checkbox"/);
});
