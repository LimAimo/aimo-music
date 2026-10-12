import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitizeSettings,readPersisted} from '../client/src/core/storage.js';
import {settingsMarkup,fullPlayerMarkup,playerMarkup} from '../client/src/ui/render.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('新用户默认关闭氛围并使用15%底栏通透度',()=>{
 const settings=sanitizeSettings({});
 assert.equal(settings.ambient,'off');
 assert.equal(settings.miniTransparency,15);
 const html=settingsMarkup({apiView:'settings',settings});
 assert.match(html,/<option value="off" selected>关闭所有氛围效果<\/option>/);
 assert.match(html,/name="miniTransparency"[^>]*value="15"[^>]*--mini-slider-fill:15%/);
});

test('升级不能覆盖用户已保存的模式和通透度',()=>{
 const original={favorites:[],recent:[],queue:[],settings:{ambient:'gradient',miniTransparency:65}};
 const persisted=readPersisted({getItem:()=>JSON.stringify(original)});
 assert.equal(persisted.settings.ambient,'gradient');
 assert.equal(persisted.settings.miniTransparency,65);
 assert.equal(sanitizeSettings({ambient:'blur',miniTransparency:0}).miniTransparency,0);
});

test('歌词模式只保留原有返回封面操作，去掉歌词标题旁重复按钮',()=>{
 const track={id:'1',title:'歌名',artist:'歌手',source:'remote',duration:190};
 const state={current:track,settings:sanitizeSettings({}),favorites:[],repeat:'off',
  shuffle:false,buffering:false,playing:false,duration:190,time:0,fullPanel:'lyrics',
  lyrics:[],lyricsLoading:false,lyricsError:'',activeLyric:-1};
 const html=fullPlayerMarkup(state);
 assert.equal((html.match(/data-action="toggle-lyrics"/g)||[]).length,1);
 assert.match(html,/返回封面/);
 assert.match(html,/data-action="lyric-follow">回到当前歌词/);
 const heading=html.match(/<div class="lyric-heading">([\s\S]*?)<\/div>/)?.[1];
 assert.ok(heading,'歌词标题区域应存在');
 assert.doesNotMatch(heading,/data-action="toggle-lyrics"/);
 const mini=playerMarkup(state);
 assert.match(mini,/data-ambient="off"/);
 assert.match(html,/data-ambient="off"/);
});

test('Android滑块恢复可见轨道、填充和圆点，拖动时更新填充',()=>{
 const css=read('../client/src/ui/mini-transparency.css');
 assert.match(css,/input\[type="range"\]\s*\{[\s\S]*?background:\s*linear-gradient\(to right,/);
 assert.match(css,/var\(--mini-slider-fill\)/);
 assert.match(css,/::-webkit-slider-runnable-track\s*\{/);
 assert.match(css,/::-webkit-slider-thumb\s*\{[\s\S]*?opacity:\s*1/);
 assert.match(css,/::-moz-range-thumb\s*\{[\s\S]*?background:\s*var\(--accent\)/);
 const main=read('../client/src/main.js');
 assert.match(main,/style\.setProperty\('--mini-slider-fill',amount\+'%'\)/);
});
