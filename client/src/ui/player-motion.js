// Interruptible cover FLIP transition between docked and full player.
let active=null;
const reduce=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function cancelPlayerTransition(){
 if(!active)return;
 const tx=active;active=null;
 tx.anim?.cancel();tx.ghost?.remove();
 tx.hidden.forEach(el=>{if(el.isConnected)el.style.visibility='';});
}
export function animateCoverTransition(from,to){
 cancelPlayerTransition();
 if(reduce()||!from||!to||typeof from.animate!=='function')return;
 const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
 if(!a.width||!b.width||!a.height||!b.height)return;
 const ghost=from.cloneNode(true),hidden=[from,to];
 ghost.classList.add('player-shared-ghost');
 Object.assign(ghost.style,{position:'fixed',left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px',margin:'0',pointerEvents:'none',zIndex:'500',transformOrigin:'top left'});
 document.body.append(ghost);
 hidden.forEach(x=>x.style.visibility='hidden');
 const frames=[{transform:'translate(0px,0px) scale(1,1)',opacity:1},
 {transform:`translate(${b.left-a.left}px,${b.top-a.top}px) scale(${b.width/a.width},${b.height/a.height})`,opacity:1}];
 const anim=ghost.animate(frames,{duration:390,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
 const tx={anim,ghost,hidden};active=tx;
 const cleanup=()=>{if(active!==tx)return;active=null;ghost.remove();hidden.forEach(x=>{if(x.isConnected)x.style.visibility='';});};
 anim.finished.then(cleanup,cleanup);
}
export function enablePlayerSwipe(full,onClose){
 if(!full||full.dataset.swipeBound)return;
 full.dataset.swipeBound='1';
 let start=null,last=null,amount=0,tracking=false;
 const eligible=e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return false;
  if(e.target.closest('button,input,textarea,select,a,[data-action],#lyric-viewport'))return false;
  return !!e.target.closest('.full-header,.full-art-section');
 };
 full.addEventListener('pointerdown',e=>{
  if(!eligible(e))return;
  start={x:e.clientX,y:e.clientY,time:performance.now()};
  last=start;amount=0;tracking=false;
 },{passive:true});
 full.addEventListener('pointermove',e=>{
  if(!start||e.pointerId===undefined)return;
  const dy=e.clientY-start.y,dx=e.clientX-start.x;
  if(!tracking){if(Math.abs(dx)>Math.abs(dy)||dy<10)return;tracking=true;full.style.animation='none';}
  amount=Math.max(0,dy);last={x:e.clientX,y:e.clientY,time:performance.now()};
  full.style.transform=`translateY(${Math.round(amount)}px)`;
  full.style.opacity=String(Math.max(.55,1-amount/innerHeight*.45));
 },{passive:true});
 function finish(e){
  if(!start)return;
  const elapsed=Math.max(1,(last?.time||performance.now())-start.time);
  const velocity=amount/elapsed;
  const close=tracking&&(amount>innerHeight*.26||amount>90&&velocity>.7);
  start=null;
  if(!tracking)return;
  tracking=false;
  if(close){full.style.animation='';full.style.transform='';full.style.opacity='';onClose();return;}
  if(reduce()){full.style.animation='';full.style.transform='';full.style.opacity='';return;}
  const anim=full.animate([{transform:`translateY(${amount}px)`,opacity:full.style.opacity},{transform:'translateY(0px)',opacity:1}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
  anim.finished.finally(()=>{full.style.transform='';full.style.opacity='';full.style.animation='';}).catch(()=>{});
 }
 full.addEventListener('pointerup',finish);
 full.addEventListener('pointercancel',finish);
}
