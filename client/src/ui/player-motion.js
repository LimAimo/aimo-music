// Interruptible shared-element motion between share / mini / full player.
let active=null;
const reduce=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const rectOf=element=>{const r=element?.getBoundingClientRect?.();return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null;};
const visible=element=>{const r=rectOf(element);return !!(r&&r.width&&r.height);};
function captureTitleStyle(element){
 const css=globalThis.getComputedStyle?.(element);
 if(!css)return null;
 return {
  font:css.font,fontSize:css.fontSize,fontFamily:css.fontFamily,fontWeight:css.fontWeight,
  color:css.color,lineHeight:css.lineHeight,letterSpacing:css.letterSpacing,
  textAlign:css.textAlign,whiteSpace:css.whiteSpace,display:css.display,
  textTransform:css.textTransform,webkitLineClamp:css.webkitLineClamp
 };
}
function applyTitleStyle(ghost,style){
 if(!style)return;
 Object.assign(ghost.style,style);
 if(style.webkitLineClamp&&style.webkitLineClamp!=='none'){
  ghost.style.display='-webkit-box';ghost.style.webkitBoxOrient='vertical';
 }
}

function createGhost(source,type,snapshot){
 const r=snapshot?.rect||rectOf(source);
 if(!r||!r.width||!r.height)return null;
 const base=snapshot?.node||source?.cloneNode?.(true);
 const ghost=base||source?.cloneNode?.(true);
 if(!ghost)return null;
 ghost.classList.add(type==='title'?'player-shared-title-ghost':'player-shared-ghost');
 Object.assign(ghost.style,{
  position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',
  maxWidth:'none',maxHeight:'none',aspectRatio:'auto',transform:'none',margin:'0',
  visibility:'visible',pointerEvents:'none',zIndex:type==='title'?'501':'500',overflow:'hidden'
 });
 if(type==='cover'){
  const corner=globalThis.getComputedStyle?.(source||ghost)?.borderTopLeftRadius||'12px';
  ghost.style.borderRadius=corner;
 }else{
  ghost.style.borderRadius='0';
  applyTitleStyle(ghost,snapshot?.titleStyle||captureTitleStyle(source));
 }
 document.body.append(ghost);
 return {ghost,rect:r};
}
function pushHidden(tx,element){if(element&&element.isConnected)tx.hidden.push({element,previous:element.style.visibility});}
export function cancelPlayerTransition(){
 if(!active)return;
 const tx=active;active=null;
 tx.animations?.forEach(anim=>anim?.cancel?.());
 tx.ghosts?.forEach(ghost=>ghost?.remove?.());
 tx.hidden?.forEach(({element,previous})=>{if(element?.isConnected)element.style.visibility=previous;});
}
export function snapshotPlayerSharedElements({cover,title}={}){
 const out=[];
 if(visible(cover))out.push({type:'cover',node:cover.cloneNode(true),rect:rectOf(cover)});
 if(visible(title))out.push({type:'title',node:title.cloneNode(true),rect:rectOf(title),titleStyle:captureTitleStyle(title)});
 return out;
}
export function animatePlayerTransition({fromCover,toCover,fromTitle,toTitle,fromSnapshots=null}={}){
 cancelPlayerTransition();
 if(reduce())return;
 const tx={animations:[],ghosts:[],hidden:[]};active=tx;
 const sources=fromSnapshots?.length?fromSnapshots:[
  fromCover&&visible(fromCover)?{type:'cover',element:fromCover}:null,
  fromTitle&&visible(fromTitle)?{type:'title',element:fromTitle}:null
 ].filter(Boolean);
 if(!sources.length){active=null;return;}
 for(const item of sources){
  const built=createGhost(item.element,item.type,item.node?item:null);
  if(!built)continue;
  const {ghost}=built;
  tx.ghosts.push(ghost);
  if(item.element){pushHidden(tx,item.element);item.element.style.visibility='hidden';}
  const dest=item.type==='title'?toTitle:toCover;
  if(dest&&visible(dest)){pushHidden(tx,dest);dest.style.visibility='hidden';}
  const a=item.rect||built.rect||rectOf(item.element)||rectOf(ghost), b=dest&&visible(dest)?rectOf(dest):null;
  if(!b)continue;
  let anim;
  try{
   if(item.type==='cover'){
    const radius=ghost.style.borderRadius||'12px';
    anim=ghost.animate([
    {left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px',opacity:1,borderRadius:radius},
    {left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px',opacity:1,borderRadius:radius}
   ],{duration:390,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
   } else {
    const startSize=ghost.style.fontSize||'18px';
    const endSize=globalThis.getComputedStyle?.(dest)?.fontSize||startSize;
    anim=ghost.animate([
     {left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px',fontSize:startSize,opacity:1},
     {left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px',fontSize:endSize,opacity:1}
    ],{duration:390,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
   }
  }catch{continue;}
  tx.animations.push(anim);
 }
 if(!tx.animations.length){cancelPlayerTransition();return;}
 const cleanup=()=>{if(active!==tx)return;cancelPlayerTransition();};
 Promise.allSettled(tx.animations.map(anim=>anim.finished)).then(cleanup,cleanup);
}

export function animateCoverTransition(from,to){
 animatePlayerTransition({fromCover:from,toCover:to});
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
  try{full.setPointerCapture(e.pointerId);}catch{}
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
