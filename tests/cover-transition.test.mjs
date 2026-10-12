import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {animateCoverTransition,cancelPlayerTransition} from '../client/src/ui/player-motion.js';
const file=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('迷你与完整封面使用完全相同的静态物理圆角',()=>{
 const css=file('../client/src/styles/views.css');
 const motion=file('../client/src/ui/player-motion.css');
 assert.match(css,/\.album-art--mini\s*\{[^}]*border-radius:\s*var\(--player-cover-radius/);
 assert.match(css,/\.album-art--full\s*\{[^}]*border-radius:\s*var\(--player-cover-radius/);
 assert.match(motion,/\.player-shared-ghost[\s\S]*?border-radius:\s*var\(--player-cover-radius/);
});

test('共享元素不再用 transform scale 放大圆角',()=>{
 let frames;
 const make=box=>({
  isConnected:true,style:{visibility:''},getBoundingClientRect:()=>box,
  cloneNode(){return {style:{},classList:{add(){}},remove(){},
   animate(f){frames=f;return {finished:new Promise(()=>{}),cancel(){}};}};}
 });
 const oldDoc=globalThis.document,oldGetStyle=globalThis.getComputedStyle;
 globalThis.document={body:{append(){}}};globalThis.getComputedStyle=()=>({borderTopLeftRadius:'12px'});
 try{
  const from=make({left:10,top:630,width:44,height:44});
  const to=make({left:36,top:130,width:320,height:320});
  animateCoverTransition(from,to);
  assert.deepEqual(frames.map(f=>f.borderRadius),['12px','12px']);
  assert.deepEqual(frames.map(f=>f.width),['44px','320px']);
  assert.deepEqual(frames.map(f=>f.height),['44px','320px']);
  assert.ok(frames.every(f=>!('transform' in f)));
  cancelPlayerTransition();
  assert.equal(from.style.visibility,'');
  assert.equal(to.style.visibility,'');
 }finally{cancelPlayerTransition();globalThis.document=oldDoc;globalThis.getComputedStyle=oldGetStyle;}
});

test('展开与收起页面不会拖动完整播放器定位',()=>{
 const css=file('../client/src/ui/player-motion.css');
 assert.match(css,/\.full-overlay\.is-shared-entering/);
 assert.match(css,/\.full-overlay\.is-leaving\.is-shared-leaving/);
 assert.doesNotMatch(css,/@keyframes full-shared-fade-(?:in|out)\s*\{[^}]*transform/);
});
