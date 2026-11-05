// Xiaoya V5.6: two rigid canvases. Each page moves as one sheet, with
// the incoming page exactly one viewport away. Dock stays outside the stage.
const ORDER=['today','items','develop'];
const EDITABLE='input,textarea,select,[contenteditable],[role="textbox"],label';
const INTERACTIVE='button,a,summary,[role="button"],[role="switch"],[data-toggle],[data-edit],[data-mood],[data-item],[data-journal-date]';
const DRAG='.native-timeline-frame,.xy-timeline-scrub,[data-swipe-ignore],.v4-mood-picker,.v4-journal-paper,.v4-journal-history,.v4-goal-row,.v4-week-rail,.week-rail,.calendar-day-timeline';
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('reduce-motion');
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function glide(start,end,update,done,velocity=0){
 const k=500,c=37;let x=start,v=clamp(velocity,-2200,2200),last=performance.now(),born=last,raf=0,alive=true;
 const fallback=setTimeout(()=>{if(alive){alive=false;cancelAnimationFrame(raf);update(end);done?.()}},410);
 function frame(t){if(!alive)return;const dt=clamp((t-last)/1000,.001,.028);last=t;
  v+=(-k*(x-end)-c*v)*dt;x+=v*dt;
  if(t-born>=315||Math.abs(end-x)<.7&&Math.abs(v)<3){update(end);alive=false;clearTimeout(fallback);done?.();return}
  update(x);raf=requestAnimationFrame(frame);
 }raf=requestAnimationFrame(frame);return ()=>{alive=false;cancelAnimationFrame(raf);clearTimeout(fallback)};
}
export function installSpatialSwipe({getRoute,onNavigate,onSegment,getPreview=()=>'',disabled=()=>false}={}){
 if(![getRoute,onNavigate,onSegment].every(fn=>typeof fn==='function'))throw Error('Navigation callbacks missing');
 const ws=document.querySelector('#workspace');if(!ws)throw Error('Missing workspace');
 let drag=null,stage=null,stopSpring=null,sequence=0,guardUntil=0;
 const stop=()=>{if(stopSpring){stopSpring();stopSpring=null}};
 const restore=s=>{
  if(!s)return;s.next?.remove();
  if(s.old?.isConnected)for(const prop of ['transform','will-change','position','z-index','width'])s.old.style.removeProperty(prop);
  ws.classList.remove('xy-two-page-active');if(stage===s)stage=null;
 };
 const reset=()=>{++sequence;stop();const old=drag||stage;drag=null;restore(old)};
 const allowed=()=>!disabled()&&!document.hidden&&!document.querySelector('#editor')?.open&&
  !document.querySelector('[aria-modal="true"]:not([hidden])')&&!document.body.classList.contains('keyboard-occluded')&&
  ORDER.includes(getRoute()?.view);
 const destination=(r,sign,scope)=>{
  if(scope==='items')return sign<0&&r.itemsTab==='schedule'?{scope,target:'inbox'}:
    sign>0&&r.itemsTab==='inbox'?{scope,target:'schedule'}:null;
  if(scope==='develop')return sign<0&&r.developTab==='record'?{scope,target:'goals'}:
    sign>0&&r.developTab==='goals'?{scope,target:'record'}:null;
  const target=ORDER[ORDER.indexOf(r.view)+(sign<0?1:-1)];
  return target?{scope:'primary',target}:null;
 };
 const makeStage=s=>{
  const old=ws.querySelector(':scope > .page');if(!old)return false;
  s.old=old;s.width=ws.clientWidth||innerWidth;
  const next=document.createElement('section');
  next.className='xy-swipe-preview';next.inert=true;next.setAttribute('aria-hidden','true');
  next.style.width=s.width+'px';
  const prepared=getPreview(s.target,s.route);
  if(prepared instanceof Element){prepared.classList.add('xy-swipe-preview-page');next.append(prepared)}
  else next.innerHTML='<div class="page xy-swipe-preview-page">'+String(prepared||'')+'</div>';
  ws.insertBefore(next,old);s.next=next;stage=s;ws.classList.add('xy-two-page-active');
  old.style.position='relative';old.style.width=s.width+'px';old.style.zIndex='1';old.style.willChange='transform';next.style.willChange='transform';
  return true;
 };
 const paint=(s,x)=>{
  if(!s?.old?.isConnected||!s.next?.isConnected)return;
  const dx=clamp(x,-s.width,s.width);s.dx=dx;
  // Both canvases use the SAME displacement; individual page contents never move.
  s.old.style.transform='translate3d('+dx.toFixed(2)+'px,0,0)';
  s.next.style.transform='translate3d('+(dx+(s.side<0?s.width:-s.width)).toFixed(2)+'px,0,0)';
 };
 const onDown=e=>{
  if(e.button!==0||e.isPrimary===false||e.pointerType==='mouse'&&matchMedia('(pointer:fine)').matches||!allowed())return;
  const t=e.target instanceof Element?e.target:null;if(!t||!t.closest('#workspace'))return;
  const scope=t.closest('.v4-item-segments')?'items':t.closest('.v4-develop-segments')?'develop':null;
  if(!scope&&(t.closest(EDITABLE)||t.closest(INTERACTIVE)||t.closest(DRAG)))return;
  if(t.closest('dialog,.xy-agent-section details'))return;
  reset();drag={id:e.pointerId,x:e.clientX,y:e.clientY,route:getRoute(),scope,side:0,started:false,cancelled:false,
   old:null,next:null,dx:0,width:0,target:null,samples:[],velocity:0};
 };
 const onMove=e=>{
  const s=drag;if(!s||s.id!==e.pointerId||s.cancelled)return;
  const dx=e.clientX-s.x,dy=e.clientY-s.y;
  if(!s.started){
   if(Math.abs(dy)>13&&Math.abs(dy)>Math.abs(dx)*.76){s.cancelled=true;return}
   if(Math.abs(dx)<11)return;
   if(Math.abs(dx)<Math.abs(dy)*1.16){s.cancelled=true;return}
   s.side=Math.sign(dx);s.target=destination(s.route,s.side,s.scope);
   if(!s.target||!makeStage(s)){s.cancelled=true;return}s.started=true;
  }
  if(s.side*dx<=0){paint(s,0);return}
  const t=performance.now();s.samples.push({x:dx,t});
  while(s.samples.length>5||s.samples.length>1&&t-s.samples[0].t>90)s.samples.shift();
  if(s.samples.length>1){const a=s.samples[0],b=s.samples.at(-1);s.velocity=(b.x-a.x)/Math.max(1,b.t-a.t)}
  paint(s,dx);if(e.cancelable)e.preventDefault();
 };
 const complete=s=>{
  restore(s);if(!allowed())return;
  const r=getRoute();document.documentElement.dataset.xySwipeCommit='true';
  try{
   if(s.target.scope==='primary'&&r.view===s.route.view)onNavigate(s.target.target);
   else if(s.target.scope==='items'&&r.view==='items'&&r.itemsTab===s.route.itemsTab)onSegment('items',s.target.target);
   else if(s.target.scope==='develop'&&r.view==='develop'&&r.developTab===s.route.developTab)onSegment('develop',s.target.target);
  }finally{delete document.documentElement.dataset.xySwipeCommit}
 };
 const onUp=e=>{
  const s=drag;if(!s||s.id!==e.pointerId)return;drag=null;
  if(!s.started||s.cancelled||!s.target){restore(s);return}
  const commit=allowed()&&s.side*s.dx>0&&(Math.abs(s.dx)>Math.min(s.width*.28,132)||Math.abs(s.dx)>36&&s.side*s.velocity>.48);
  const end=commit?s.side*s.width:0;
  const ticket=++sequence;guardUntil=performance.now()+420;stop();
  const finish=()=>{if(ticket!==sequence)return;stopSpring=null;commit?complete(s):restore(s)};
  if(reduced()){paint(s,end);finish();return}
  stopSpring=glide(s.dx,end,x=>paint(s,x),finish,s.velocity*1000);
 };
 const onCancel=()=>{
  if(!drag){stop();restore(stage);return}
  const s=drag;drag=null;stop();
  if(!s.started||reduced()){restore(s);return}
  const ticket=++sequence;
  stopSpring=glide(s.dx,0,x=>paint(s,x),()=>{if(ticket===sequence){stopSpring=null;restore(s)}});
 };
 const onClick=e=>{
  if(e.detail>0&&performance.now()<guardUntil&&e.target instanceof Element&&e.target.closest('#workspace')){
   e.preventDefault();e.stopImmediatePropagation();
  }
 };
 document.addEventListener('pointerdown',onDown,true);
 document.addEventListener('pointermove',onMove,{capture:true,passive:false});
 document.addEventListener('pointerup',onUp,true);
 document.addEventListener('pointercancel',onCancel,true);
 document.addEventListener('click',onClick,true);
 window.addEventListener('blur',onCancel);
 return {cancel:reset,destroy(){reset();document.removeEventListener('pointerdown',onDown,true);
  document.removeEventListener('pointermove',onMove,true);document.removeEventListener('pointerup',onUp,true);
  document.removeEventListener('pointercancel',onCancel,true);document.removeEventListener('click',onClick,true);
  window.removeEventListener('blur',onCancel)}};
}
