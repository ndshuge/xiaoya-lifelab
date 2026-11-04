// Small, interruptible shared-geometry motions. No #workspace clone or route snapshots.
const limit=(v,min,max)=>Math.max(min,Math.min(max,v));
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||
  document.body.classList.contains('reduce-motion');
const validRect=r=>r&&r.width>8&&r.height>8&&Number.isFinite(r.x)&&Number.isFinite(r.y);
function transformBetween(source,destination){
 if(!validRect(source)||!validRect(destination))return null;
 const sx=limit(source.width/destination.width,.42,1);
 const sy=limit(source.height/destination.height,.24,1);
 const cx=source.x+source.width/2,cy=source.y+source.height/2;
 const dx=cx-(destination.x+destination.width/2);
 const dy=cy-(destination.y+destination.height/2);
 return 'translate3d('+dx.toFixed(2)+'px,'+dy.toFixed(2)+'px,0) scale('+sx.toFixed(4)+','+sy.toFixed(4)+')';
}
// Paint-only geometry bridge. Actual input hitboxes never scale.
function paintShape(host,rect,color){
 const el=document.createElement('div');el.className='xy-magic-surface';
 el.setAttribute('aria-hidden','true');
 Object.assign(el.style,{position:'fixed',left:rect.x+'px',top:rect.y+'px',
  width:rect.width+'px',height:rect.height+'px',transformOrigin:'center center',
  borderRadius:'19px',background:color||'#eef4ef',boxShadow:'0 5px 20px rgba(30,67,41,.13)',
  pointerEvents:'none',zIndex:'5'});
 host.append(el);return el;
}
export function createSheetMotion(){
 let motion=null,surface=null,origin=null,originRect=null,focusTarget=null,session=0,closing=false,openedAt=0,closeTimer=null;
 const stop=()=>{if(motion){const a=motion;motion=null;a.onfinish=null;a.oncancel=null;a.cancel()}surface?.remove();surface=null};
 const settle=dialog=>{
  clearTimeout(closeTimer);closeTimer=null;
  stop();closing=false;
  const frame=dialog.querySelector('.sheet-frame');
  if(frame)frame.style.pointerEvents='';
  if(dialog.open)dialog.close();
  if(focusTarget?.isConnected)focusTarget.focus({preventScroll:true});
  focusTarget=null;origin=null;originRect=null;
 };
 const open=(dialog,source)=>{
  ++session;
  if(dialog.open)settle(dialog);
  openedAt=performance.now();
  stop();closing=false;
  const card=source?.closest?.('.v4-task-row,.dayflow-task-row,.row,.native-event,.v4-journal-row,.v4-goal-row')||source;
  origin=card?.isConnected?card:null;
  originRect=origin?origin.getBoundingClientRect():null;
  focusTarget=source?.isConnected?source:document.activeElement;
  dialog.showModal();
  const frame=dialog.querySelector('.sheet-frame');
  if(!frame||!originRect||reduced())return;
  const rect=frame.getBoundingClientRect(),from=transformBetween(originRect,rect);
  if(!from)return;
  motion=frame.animate([{opacity:.8},{opacity:1}],{
    duration:290,easing:'ease-out',fill:'both'
  });
  const marker=motion;marker.onfinish=()=>{if(motion===marker)stop()};
  surface=paintShape(dialog,rect,getComputedStyle(frame).backgroundColor);
  const shape=surface;
  shape.animate([{transform:from,opacity:.85},{transform:'none',opacity:0}],{
    duration:290,easing:'cubic-bezier(.2,.82,.27,1)',fill:'forwards'
  }).onfinish=()=>shape.remove();
 };
 const close=(dialog,{instant=false}={})=>{
  if(!dialog.open)return;
  if(closing)return;
  const frame=dialog.querySelector('.sheet-frame');
  if(instant||reduced()||!frame||!originRect||performance.now()-openedAt<140){settle(dialog);return}
  stop();
  const rect=frame.getBoundingClientRect();
  const targetRect=origin?.isConnected?origin.getBoundingClientRect():originRect;
  const dest=transformBetween(targetRect,rect);
  if(!dest){settle(dialog);return}
  closing=true;frame.style.pointerEvents='none';const token=++session;
  motion=frame.animate([{opacity:1},{opacity:.68}],{duration:230,easing:'ease-in',fill:'both'});
  surface=paintShape(dialog,rect,getComputedStyle(frame).backgroundColor);
  const shape=surface;
  shape.animate([{transform:'none',opacity:0},{transform:dest,opacity:.88}],{
   duration:230,easing:'cubic-bezier(.3,0,.5,1)',fill:'forwards'
  }).onfinish=()=>shape.remove();
  motion.onfinish=()=>{if(session===token)settle(dialog)};
  closeTimer=setTimeout(()=>{if(session===token)settle(dialog)},270);
 };
 return {open,close,settle,get closing(){return closing}};
}
let journalMotion=null,journalSurface=null;
export function cancelJournalMotion(){
 if(journalMotion){const a=journalMotion;journalMotion=null;a.onfinish=null;a.cancel()}
 journalSurface?.remove();journalSurface=null;
}
function journalMorph(target,sourceRect,reverse,onDone){
 cancelJournalMotion();
 if(!target||reduced()){onDone?.();return false}
 const rect=target.getBoundingClientRect(),flip=transformBetween(sourceRect,rect);
 if(!flip){onDone?.();return false}
 // Journal textarea remains at its final, untransformed layout during the flight.
 journalMotion=target.animate(reverse?[{opacity:1},{opacity:.75}]:[{opacity:.76},{opacity:1}],{
  duration:reverse?225:310,easing:'ease-out',fill:'both'});
 journalSurface=paintShape(document.body,rect,getComputedStyle(target).backgroundColor);
 const shape=journalSurface;
 shape.animate(reverse?[{transform:'none',opacity:0},{transform:flip,opacity:.8}]:
   [{transform:flip,opacity:.8},{transform:'none',opacity:0}],{
  duration:reverse?225:310,easing:'cubic-bezier(.2,.84,.3,1)',fill:'forwards'
 }).onfinish=()=>shape.remove();
 const current=journalMotion;
 current.onfinish=()=>{if(journalMotion===current){cancelJournalMotion();onDone?.()}};
 return true;
}
export function enterJournal(sourceRect,target){return journalMorph(target,sourceRect,false)}
export function leaveJournal(source,targetRect,onDone){journalMorph(source,targetRect,true,onDone)}
export function installEdgePop({enabled,surface,onPop}){
 let tracking=null;
 const down=e=>{
  if(!e.isPrimary||e.button!==0||e.clientX>26||!enabled())return;
  if(e.target.closest?.('textarea,input,select,[contenteditable]'))return;
  tracking={id:e.pointerId,x:e.clientX,y:e.clientY,target:surface(),moving:false};
 };
 const move=e=>{
  if(!tracking||tracking.id!==e.pointerId)return;
  const dx=e.clientX-tracking.x,dy=e.clientY-tracking.y;
  if(Math.abs(dy)>38&&Math.abs(dy)>Math.abs(dx)){cancel();return}
  if(dx>13&&Math.abs(dy)<38){
    tracking.moving=true;
    if(tracking.target&&!reduced())tracking.target.style.transform='translate3d('+limit(dx*.24,0,75)+'px,0,0)';
  }
 };
 const cancel=()=>{
  if(!tracking)return;
  const el=tracking.target;
  tracking=null;
  if(el){el.style.transform='';}
 };
 const up=e=>{
  if(!tracking||tracking.id!==e.pointerId)return;
  const dx=e.clientX-tracking.x,dy=e.clientY-tracking.y;
  const trigger=tracking.moving&&dx>88&&Math.abs(dy)<44;
  cancel();if(trigger)onPop();
 };
 document.addEventListener('pointerdown',down,{passive:true});
 document.addEventListener('pointermove',move,{passive:true});
 document.addEventListener('pointerup',up);
 document.addEventListener('pointercancel',cancel);
 window.addEventListener('blur',cancel);
 return ()=>{document.removeEventListener('pointerdown',down);document.removeEventListener('pointermove',move);
  document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);cancel()};
}
