import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playerMarkup, fullPlayerMarkup} from '../client/src/ui/render.js';

const read=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const playerCSS=read('../client/src/styles/player.css');
const ambientCSS=read('../client/src/ui/ambient.css');
const mainJS=read('../client/src/main.js');

test('桌面和移动端迷你播放器始终固定于视口底部',()=>{
  assert.match(playerCSS,/\.player-shell\s*\{[^}]*\bposition\s*:\s*fixed\s*;/);
  assert.match(playerCSS,/\.player-shell\s*\{[^}]*\bbottom\s*:\s*0\s*;/);
  for(const [,selector,body] of ambientCSS.matchAll(/([^{}]+)\{([^{}]+)\}/g)){
    const containerSelectors=selector.split(',').map(s=>s.trim()).filter(s=>s==='.player-shell'||s==='.full-overlay');
    if(containerSelectors.length)assert.doesNotMatch(body,/\bposition\s*:/,'氛围背景不得重写播放器容器定位');
  }
});

test('完整播放器必须覆盖视口，且展开/收起仍调用完整流程',()=>{
  assert.match(playerCSS,/\.full-overlay\s*\{[^}]*\bposition\s*:\s*fixed\s*;/);
  assert.match(playerCSS,/\.full-overlay\s*\{[^}]*\binset\s*:\s*0\s*;/);
  assert.match(mainJS,/case 'open-full'\s*:\s*openPlayer\('cover'\)/);
  assert.match(mainJS,/case 'close-full'\s*:\s*closePlayer\(\)/);
});

test('有曲目时迷你播放器可点击打开完整播放器',()=>{
  const track={id:'test-1',title:'测试歌曲',artist:'音乐人',source:'remote',duration:180};
  const state={current:track,settings:{ambient:'glow',volume:.6},shuffle:false,buffering:false,
    repeat:'off',playing:false,time:0,duration:180,fullPanel:'cover',favorites:[],lyrics:[],lyricsLoading:false,lyricsError:''};
  const mini=playerMarkup(state);
  const full=fullPlayerMarkup(state);
  assert.match(mini,/<button class="mini-now" data-action="open-full"\s+aria-label="打开完整播放器">/);
  assert.match(mini,/class="album-art album-art--mini/);
  assert.match(full,/class="full-overlay" id="full-player"/);
  assert.match(full,/data-action="close-full"/);
  assert.match(full,/class="album-art album-art--full/);
});
