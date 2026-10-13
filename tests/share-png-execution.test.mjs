import test from 'node:test';
import assert from 'node:assert/strict';
import {cardPng} from '../client/src/ui/share.js';

test('PNG export executes the full drawing path without a cover or uninitialized geometry', async()=>{
  const previous=globalThis.document;
  const gradient={addColorStop(){}};
  const ctx=new Proxy({measureText:text=>({width:String(text).length*20}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
  const expected=new Blob(['png'],{type:'image/png'});
  const canvas={getContext:()=>ctx,toBlob:callback=>callback(expected)};
  globalThis.document={createElement:()=>canvas};
  try {
    assert.equal(await cardPng({type:'song',title:'歌曲',subtitle:'歌手',track:{id:'1',album:'专辑'}}),expected);
    assert.equal(canvas.width,1080);
    assert.equal(canvas.height,1440);
  } finally {
    if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
  }
});
