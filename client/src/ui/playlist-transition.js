// 歌单封面和名称共享元素：保留动画中的真实位置，允许点击返回时直接逆转。
const DURATION=380, EASE='cubic-bezier(0.22, 1, 0.36, 1)';
let active=null;
export const isPlaylistTransitionRunning=()=>!!active;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;};
const motion=(el,frames,duration=DURATION)=>el.animate(frames,{duration,easing:EASE,fill:'both'});
function createGhost(el,type){
  const r=rect(el),ghost=el.cloneNode(true);
  ghost.classList.add('shared-transition-ghost',type==='title'?'shared-title-ghost':'shared-cover-ghost');
  Object.assign(ghost.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:0,pointerEvents:'none',zIndex:'1002',transformOrigin:'top left'});
  if(type==='title'){const css=getComputedStyle(el);ghost.style.font=css.font;ghost.style.color=css.color;ghost.style.lineHeight=css.lineHeight;ghost.style.whiteSpace='nowrap';ghost.style.overflow='hidden';}
  document.body.appendChild(ghost);return ghost;
}
function cleanup(tx){
  tx.animations.forEach(a=>a.cancel());
  tx.ghosts.forEach(g=>g.remove());
  tx.hidden.forEach(el=>{if(el.isConnected)el.style.visibility='';});
  tx.shade?.remove();
  if(active===tx)active=null;
}
export function interruptPlaylistTransition(){
  if(!active)return null;
  const tx=active;
  const snapshots=tx.ghosts.map(g=>({type:g.classList.contains('shared-title-ghost')?'title':'cover',rect:rect(g),node:g.cloneNode(true)}));
  cleanup(tx);return snapshots;
}
export async function sharedPlaylistTransition({source,sourceTitle,render,target,targetTitle,restoreScroll,fromSnapshots}){
  if(active)return false;
  const tx={animations:[],ghosts:[],hidden:[],shade:null};active=tx;
  const sources=fromSnapshots||[{type:'cover',element:source},{type:'title',element:sourceTitle}].filter(x=>visible(x.element));
  const canAnimate=!reduced()&&typeof Element.prototype.animate==='function';
  try{
    if(canAnimate)for(const item of sources){
      const ghost=item.node||createGhost(item.element,item.type);
      if(item.node){const r=item.rect;Object.assign(ghost.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:0,pointerEvents:'none',zIndex:'1002',transformOrigin:'top left'});document.body.appendChild(ghost);}
      tx.ghosts.push(ghost);
      if(item.element){item.element.style.visibility='hidden';tx.hidden.push(item.element);}
    }
    render();
    if(restoreScroll!=null)scrollTo({top:restoreScroll,behavior:'instant'});
    if(!canAnimate||!tx.ghosts.length)return true;
    tx.shade=document.createElement('div');tx.shade.className='shared-transition-shade';document.body.appendChild(tx.shade);
    for(const ghost of tx.ghosts){
      const isTitle=ghost.classList.contains('shared-title-ghost');
      const dest=isTitle?targetTitle?.():target?.();
      if(!visible(dest))continue;
      dest.style.visibility='hidden';tx.hidden.push(dest);
      const a=rect(ghost),b=rect(dest);
      const sx=b.width/a.width,sy=b.height/a.height;
      if(isTitle){
        const startSize=parseFloat(getComputedStyle(ghost).fontSize)||13;
        const endSize=parseFloat(getComputedStyle(dest).fontSize)||startSize;
        tx.animations.push(motion(ghost,[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${b.left-a.left}px,${b.top-a.top}px) scale(${endSize/startSize})`,opacity:1}]));
      }else tx.animations.push(motion(ghost,[{transform:'translate(0,0) scale(1,1)'},{transform:`translate(${b.left-a.left}px,${b.top-a.top}px) scale(${sx},${sy})`}]));
    }
    tx.animations.push(motion(tx.shade,[{opacity:0},{opacity:.12},{opacity:0}]));
    const page=document.querySelector('#main-view .page');
    if(page)tx.animations.push(motion(page,[{opacity:.4},{opacity:1}],300));
    await Promise.allSettled(tx.animations.map(a=>a.finished));
    return true;
  }finally{cleanup(tx);}
}
