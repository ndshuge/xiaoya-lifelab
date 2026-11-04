// Accessible, pointer-driven scroll handle for the 24-hour schedule.
// One mounted instance at a time. No Dock or global gesture overrides.
let disposeActive=()=>{};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const pad=n=>String(n).padStart(2,'0');
export function installTimelineScrubber(root=document){
 disposeActive();
 disposeActive=()=>{};
 const frame=root.querySelector('.native-timeline-frame');
 if(!frame)return;
 const scroll=frame.querySelector('.native-timeline-scroll');
 const rail=frame.querySelector('.xy-timeline-scrub');
 const thumb=frame.querySelector('.xy-timeline-thumb');
 if(!scroll||!rail||!thumb)return;
 let active=null;
 let thumbHeight=36,travel=0,maxScroll=0;
 const update=()=>{
  const railHeight=rail.clientHeight;
  maxScroll=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
  thumbHeight=clamp(railHeight*scroll.clientHeight/Math.max(1,scroll.scrollHeight),36,Math.max(36,railHeight));
  thumbHeight=Math.min(railHeight,thumbHeight);
  travel=Math.max(0,railHeight-thumbHeight);
  const fraction=maxScroll?clamp(scroll.scrollTop/maxScroll,0,1):0;
  thumb.style.height=thumbHeight+'px';
  thumb.style.transform='translate3d(0,'+(fraction*travel)+'px,0)';
  rail.setAttribute('aria-valuemax',String(Math.round(maxScroll)));
  rail.setAttribute('aria-valuenow',String(Math.round(scroll.scrollTop)));
  const minute=clamp(Math.round(scroll.scrollTop/Math.max(1,scroll.scrollHeight)*1440),0,1439);
  rail.setAttribute('aria-valuetext',(frame.dataset.date||'')+' '+pad(Math.floor(minute/60))+':'+pad(minute%60));
  rail.classList.toggle('is-static',maxScroll<=0);
 };
 const fromPointer=e=>{
  const rect=rail.getBoundingClientRect();
  const top=clamp(e.clientY-rect.top-active.offset,0,travel);
  scroll.scrollTop=travel?top/travel*maxScroll:0;
  update();
 };
 const down=e=>{
  if(!e.isPrimary||e.button!==0||active)return;
  update();
  const rect=thumb.getBoundingClientRect();
  const inside=e.clientY>=rect.top&&e.clientY<=rect.bottom;
  active={id:e.pointerId,offset:inside?e.clientY-rect.top:thumbHeight/2};
  rail.classList.add('is-dragging');
  rail.setPointerCapture(e.pointerId);
  fromPointer(e);e.preventDefault();
 };
 const move=e=>{if(!active||e.pointerId!==active.id)return;fromPointer(e);e.preventDefault()};
 const end=e=>{
  if(!active||e.pointerId!==active.id)return;
  if(rail.hasPointerCapture(e.pointerId))rail.releasePointerCapture(e.pointerId);
  active=null;rail.classList.remove('is-dragging');update();
 };
 const key=e=>{
  const max=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
  const step=60, page=scroll.clientHeight*.82;
  const positions={ArrowDown:scroll.scrollTop+step,ArrowUp:scroll.scrollTop-step,
   PageDown:scroll.scrollTop+page,PageUp:scroll.scrollTop-page,Home:0,End:max};
  if(!Object.hasOwn(positions,e.key))return;
  e.preventDefault();scroll.scrollTop=clamp(positions[e.key],0,max);update();
 };
 const onScroll=()=>update();
 rail.addEventListener('pointerdown',down);
 rail.addEventListener('pointermove',move);
 rail.addEventListener('pointerup',end);
 rail.addEventListener('pointercancel',end);
 rail.addEventListener('lostpointercapture',end);
 rail.addEventListener('keydown',key);
 scroll.addEventListener('scroll',onScroll,{passive:true});
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):null;
 observer?.observe(scroll);observer?.observe(rail);
 update();
 disposeActive=()=>{
  observer?.disconnect();
  rail.removeEventListener('pointerdown',down);
  rail.removeEventListener('pointermove',move);
  rail.removeEventListener('pointerup',end);
  rail.removeEventListener('pointercancel',end);
  rail.removeEventListener('lostpointercapture',end);
  rail.removeEventListener('keydown',key);
  scroll.removeEventListener('scroll',onScroll);
 };
}
