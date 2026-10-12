// 默认桌面快捷键基础层；忽略输入区和浏览器/系统组合键。
export function installKeyboardShortcuts(actions) {
  const handler = event => {
    if(event.defaultPrevented || event.isComposing || event.repeat && ['KeyF','KeyQ','KeyL','KeyM','KeyN','KeyP'].includes(event.code)) return;
    if(event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target=event.target;
    if(target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="dialog"]')) {
      if(event.code!=='Escape')return;
    }
    if(event.code==='Space' && target?.closest?.('button,a,[role="button"]'))return;
    const action=actions[event.code];
    if(!action)return;
    event.preventDefault();action();
  };
  document.addEventListener('keydown',handler);
  return ()=>document.removeEventListener('keydown',handler);
}
