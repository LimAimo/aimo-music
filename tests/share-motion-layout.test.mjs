import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cardMarkup} from '../client/src/ui/share.js';
import {snapshotPlayerSharedElements} from '../client/src/ui/player-motion.js';
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('海报的封面和标题有独立共享转场锚点，且页面打开歌曲将两个元素传入播放器',()=>{
 const html=cardMarkup({type:'song',title:'东方红',subtitle:'群星',track:{id:'1',album:'红歌经典唱中国'}});
 assert.match(html,/data-share-cover/);
 assert.match(html,/data-share-title/);
 const main=source('../client/src/main.js');
 assert.match(main,/snapshotPlayerSharedElements\(/);
 assert.match(main,/openPlayer\(data\.type==='lyrics'\?'lyrics':'cover',\{sharedSnapshots\}\)/);
 assert.match(main,/fromCover:from,toCover:document\.querySelector\('#player-slot \.mini-now \.album-art'\)/);
 assert.match(main,/fromTitle:titleFrom,toTitle:document\.querySelector\('#player-slot \.mini-now \.mini-track-title'\)/);
});

test('消失前保存分享页标题的实际计算字号，避免失去容器上下文后跳变',()=>{
 const oldStyle=globalThis.getComputedStyle;
 globalThis.getComputedStyle=()=>({font:'700 20px sans-serif',fontSize:'20px',fontFamily:'sans-serif',fontWeight:'700',color:'#fff',lineHeight:'24px',letterSpacing:'0px',textAlign:'left',whiteSpace:'normal',display:'-webkit-box',textTransform:'none',webkitLineClamp:'3'});
 const node=()=>({getBoundingClientRect:()=>({left:12,top:40,width:160,height:30}),cloneNode:()=>({}),style:{}});
 try{
  const fragments=snapshotPlayerSharedElements({cover:node(),title:node()});
  assert.equal(fragments.length,2);
  assert.equal(fragments[1].titleStyle.fontSize,'20px');
 }finally{if(oldStyle)globalThis.getComputedStyle=oldStyle;else delete globalThis.getComputedStyle;}
});

test('窄屏音乐库分段使用容器内宽度分配而非可横向溢出的 max-content',()=>{
 const css=source('../client/src/ui/collections.css');
 assert.match(css,/\.library-segmented\{display:flex;width:100%;min-width:0\}/);
 assert.doesNotMatch(css,/\.library-segmented\{display:flex;width:max-content/);
 const responsive=source('../client/src/styles/responsive.css');
 assert.match(responsive,/\.library-header\{overflow-x:hidden\}/);
 assert.match(responsive,/\.library-segmented \.seg-item\{flex:1 1 auto;min-width:0/);
});
