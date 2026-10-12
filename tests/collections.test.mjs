import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRules,freshPlaylist,ruleValid,evalRule,calculateSmart} from '../client/src/core/collections.js';
import {defaultBindings,detectConflict,validateBindings,isReserved} from '../client/src/core/keyboard.js';
const song=(id,title)=>({id:String(id),title,artist:'歌手',album:'专辑',source:'remote',duration:120});
test('嵌套智能歌单支持与、或和排除条件',()=>{
 const p=freshPlaylist(true),t1=song(1,'甲'),t2=song(2,'乙');
 p.rules={kind:'group',mode:'all',not:false,items:[
  {kind:'group',mode:'any',not:false,items:[{kind:'test',field:'title',op:'eq',value:'甲'},{kind:'test',field:'title',op:'eq',value:'乙'}]},
  {kind:'group',mode:'all',not:true,items:[{kind:'test',field:'title',op:'eq',value:'乙'}]}
 ]};
 assert.ok(ruleValid(p.rules));
 assert.deepEqual(calculateSmart(p,{favorites:[t1,t2]}).map(x=>x.title),['甲']);
});
test('快捷键检测全局与页面范围的冲突',()=>{
 const a=defaultBindings();a.KeyM.combo='Space';assert.deepEqual(detectConflict(a),['Space','KeyM']);
 a.KeyM.scope='library';a.Space.scope='player';assert.equal(detectConflict(a),null);
 assert.ok(isReserved('Ctrl+KeyW'));
 assert.equal(validateBindings({KeyF:{combo:'Ctrl+KeyW'}}).KeyF.combo,'KeyF');
});
test('无效嵌套规则拒绝无限层级',()=>{
 let r=emptyRules();for(let i=0;i<9;i++)r={kind:'group',mode:'all',not:false,items:[r]};
 assert.equal(ruleValid(r),false);
});
