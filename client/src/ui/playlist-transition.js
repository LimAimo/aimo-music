// 歌单封面共享元素转场：独立的固定定位层，避免异步歌单数据造成跳帧。
const DURATION = 380;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
let running = false;
export const isPlaylistTransitionRunning = () => running;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function box(el) {const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};}
function usable(el){if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;}
function animate(el,frames,options){return el.animate(frames,{duration:DURATION,easing:EASE,fill:'both',...options});}
export async function sharedPlaylistTransition({source,render,target,restoreScroll}) {
  if(running)return false;
  running=true;
  const main=document.getElementById('main-view');
  const oldPage=main?.firstElementChild;
  const supported=!!source&&usable(source)&&!reduceMotion()&&typeof source.animate==='function';
  let ghost=null,shade=null,sourceHidden=false,targetHidden=false,targetEl=null;
  try {
    const start=supported?box(source):null;
    if(supported){
      ghost=source.cloneNode(true);
      ghost.classList.add('shared-cover-ghost');
      Object.assign(ghost.style,{position:'fixed',left:start.left+'px',top:start.top+'px',width:start.width+'px',height:start.height+'px',margin:'0',pointerEvents:'none',zIndex:'1002',transformOrigin:'top left'});
      document.body.appendChild(ghost);
      source.style.visibility='hidden';sourceHidden=true;
      shade=document.createElement('div');shade.className='shared-transition-shade';document.body.appendChild(shade);
    }
    // render 可同步切换页面。返回时必须先恢复旧滚动位置再测量目标。
    render();
    if(restoreScroll!=null)scrollTo({top:restoreScroll,behavior:'instant'});
    targetEl=target?.()||null;
    const end=targetEl&&usable(targetEl)?box(targetEl):null;
    if(!start||!end||!ghost){return true;}
    targetEl.style.visibility='hidden';targetHidden=true;
    const dx=end.left-start.left,dy=end.top-start.top;
    const sx=end.width/start.width,sy=end.height/start.height;
    const radiusStart=getComputedStyle(source).borderRadius;
    const radiusEnd=getComputedStyle(targetEl).borderRadius;
    const motions=[
      animate(ghost,[{transform:'translate(0,0) scale(1,1)',borderRadius:radiusStart},{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,borderRadius:radiusEnd}]),
      animate(shade,[{opacity:0},{opacity:1},{opacity:0}],{easing:'ease-in-out'}),
    ];
    const page=main?.firstElementChild;
    if(page)motions.push(animate(page,[{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'}));
    await Promise.allSettled(motions.map(x=>x.finished));
    return true;
  } finally {
    if(sourceHidden&&source)source.style.visibility='';
    if(targetHidden&&targetEl?.isConnected)targetEl.style.visibility='';
    ghost?.remove();shade?.remove();running=false;
  }
}
