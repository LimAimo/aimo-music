// User-editable shortcut map with page scopes and browser-reserved key avoidance.
export const shortcutCatalog=Object.freeze([
 ['Space','播放 / 暂停','Space'],['ArrowRight','快进 5 秒','ArrowRight'],['ArrowLeft','快退 5 秒','ArrowLeft'],
 ['KeyN','下一首','KeyN'],['KeyP','上一首','KeyP'],['ArrowUp','提高音量','ArrowUp'],['ArrowDown','降低音量','ArrowDown'],
 ['KeyM','静音','KeyM'],['Slash','搜索','Slash'],['Escape','关闭弹窗 / 返回','Escape'],['KeyF','收藏歌曲','KeyF'],
 ['KeyQ','播放队列','KeyQ'],['KeyL','切换歌词','KeyL']
]);
export const scopeOptions={global:'全局',player:'完整播放器',library:'音乐库',search:'搜索页',home:'发现页'};
const known=new Set(shortcutCatalog.map(x=>x[0]));
export const defaultBindings=()=>Object.fromEntries(shortcutCatalog.map(([id,,combo])=>[id,{combo,scope:'global',enabled:true}]));
export const isReserved=combo=>/^(?:F5|F11|Ctrl\+(?:Key[WTRNL]|Tab|Digit[0-9])|Meta\+|Alt\+(?:ArrowLeft|ArrowRight|F4))/.test(combo);
export function validateBindings(candidate){
 const raw=candidate&&typeof candidate==='object'?candidate:{},out=defaultBindings();
 for(const [id,record] of Object.entries(raw)){
  if(!known.has(id)||!record||typeof record!=='object')continue;
  const combo=String(record.combo||'').slice(0,80);
  if(!/^(?:(?:Ctrl|Shift|Alt)\+){0,3}(?:Key[A-Z]|Digit[0-9]|Arrow(?:Left|Right|Up|Down)|Space|Slash|Escape|Enter|Comma|Period|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote)$/.test(combo)||isReserved(combo))continue;
  out[id]={combo,scope:scopeOptions[record.scope]?record.scope:'global',enabled:record.enabled!==false};
 }
 return out;
}
export function detectConflict(bindings){
 const active=Object.entries(bindings).filter(([,x])=>x.enabled);
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const [a,x]=active[i],[b,y]=active[j];
  if(x.combo===y.combo&&(x.scope===y.scope||x.scope==='global'||y.scope==='global'))return [a,b];
 }
 return null;
}
export function formatCombo(combo){return String(combo||'').replaceAll('Key','').replaceAll('Digit','').replace('Space','空格').replace('Arrow','方向').replace('Slash','/').replace('Escape','Esc');}
export function comboFromEvent(e){
 if(['Control','Alt','Shift','Meta'].includes(e.key))return '';
 const prefix=[e.ctrlKey?'Ctrl':null,e.altKey?'Alt':null,e.shiftKey?'Shift':null].filter(Boolean);
 const combo=[...prefix,e.code].join('+');
 return isReserved(combo)?'':combo;
}
export function parseShortcutForm(form){
 const data=new FormData(form),out={};
 for(const [id] of shortcutCatalog){
  out[id]={combo:String(data.get('shortcut-'+id)||''),scope:String(data.get('scope-'+id)||'global'),enabled:data.has('enabled-'+id)};
 }
 const result=validateBindings(out);
 for(const [id,value] of Object.entries(out))if(result[id].combo!==value.combo)throw Error('不支持的快捷键：'+id);
 const conflict=detectConflict(result);
 if(conflict)throw Error('快捷键冲突：'+conflict.join(' 与 '));
 return result;
}
export function installKeyboardShortcuts(actions,{getBindings=defaultBindings,getContext=()=>({})}={}){
 const handler=e=>{
  if(e.defaultPrevented||e.isComposing||e.repeat&&e.code!=='ArrowRight'&&e.code!=='ArrowLeft')return;
  if(e.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
  if(e.code==='Space'&&e.target?.closest?.('button,a,[role="button"]'))return;
  if(e.code!=='Escape'&&document.querySelector('#settings-overlay:not(.is-leaving)'))return;
  const combo=comboFromEvent(e);if(!combo)return;
  const context=getContext();
  for(const [id,setting] of Object.entries(getBindings())){
   if(!setting.enabled||setting.combo!==combo)continue;
   if(setting.scope!=='global'&&!context[setting.scope])continue;
   const run=actions[id];if(!run)continue;
   e.preventDefault();run();break;
  }
 };
 document.addEventListener('keydown',handler);
 return ()=>document.removeEventListener('keydown',handler);
}
