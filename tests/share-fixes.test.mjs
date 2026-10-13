import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeShare,decodeShare} from '../client/src/core/share.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('封面取色可持久化到分享链接并复现卡片',()=>{
 const data=decodeShare(encodeShare({type:'song',track:{id:'123'},style:{color:'#123456',color2:'#aabbcc',color3:'#001122'}}));
 assert.equal(data.style.color,'#123456');assert.equal(data.style.color2,'#aabbcc');assert.equal(data.style.color3,'#001122');
});
test('分享 UI 不再显示手动颜色选择器',()=>{
 const source=read('client/src/ui/share.js');
 assert.doesNotMatch(source,/id="share-color"/);
 assert.match(source,/extractAmbientColors/);
 assert.doesNotMatch(source,/id="share-template"/);
 assert.doesNotMatch(source,/id="share-ratio"/);
 assert.match(source,/share-inline-confirm/);
});
test('系统分享直接在点击确认时调用，不在异步确认之后调用',()=>{
 const source=read('client/src/ui/share.js');
 const start=source.indexOf("if(next==='native')");
 const end=source.indexOf("}else if(next==='copy')",start);
 assert.ok(start>=0&&end>start);
 const segment=source.slice(start,end);
 assert.match(segment,/navigator\.share\(/);
 assert.doesNotMatch(segment,/await\s/);
});
test('分享编辑器支持移动端安全区域和可见确认层',()=>{
 const css=read('client/src/ui/share.css');
 assert.match(css,/\.share-inline-confirm/);
 assert.match(css,/\.share-inline-confirm\[hidden\]/);
 assert.match(css,/safe-area-inset-bottom/);
});
