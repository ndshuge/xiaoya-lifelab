// Academy-inspired horizontal navigation: spring physics and velocity commit.
// Paint-only feedback preserves the single live workspace and its fixed hitboxes.
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const ORDER=['today','items','develop'];
const EDITABLE='input,textarea,select,[contenteditable],[role="textbox"],label';
const INTERACTIVE='button,a,summary,[role="button"],[role="switch"],[data-toggle],[data-edit],[data-mood],[data-item],[data-journal-date]';
const DRAG_CONTENT='.native-timeline-frame,.xy-timeline-scrub,.xy-swipe-ignore,[data-swipe-ignore],.v4-mood-picker,.v4-journal-paper,.v4-journal-history,.v4-goal-row,.v4-week-rail,.week-rail,.calendar-day-timeline';
const unsupported=()=>matchMedia('(pointer:coarse)').matches===false&&matchMedia('(hover:hover)').matches===true;
function springTo(start,end,draw,done,{velocity=0}={}){
 // From the SHUGE Academy motion lab: ζ=.8, response=.3s, ω=2π/response.
 const omega=2*Math.PI/.3,zeta=.8;
 let value=start,v=velocity,last=performance.now(),raf=0,active=true;
 function frame(now){
  if(!active)return;
  const dt=Math.max(.001,Math.min(.033,(now-last)/1000));last=now;
  const acc=-2*zeta*omega*v-omega*omega*(value-end);
  v+=acc*dt;value+=v*dt;
  draw(value);
  if(Math.abs(value-end)<.6&&Math.abs(v)<1){active=false;draw(end);done?.();return}
  raf=requestAnimationFrame(frame);
 }
 raf=requestAnimationFrame(frame);
 return ()=>{active=false;cancelAnimationFrame(raf)};
}
export function installSpatialSwipe({getRoute,onNavigate,onSegment,disabled=()=>false}={}){
 if(typeof getRoute!=='function'||typeof onNavigate!=='function'||typeof onSegment!=='function')throw Error('Swipe requires current route and navigation callbacks');
 const el=document.createElement('div');el.className='xy-swipe-surface';el.setAttribute('aria-hidden','true');
 el.innerHTML='<span class="xy-swipe-arrow"></span><span class="xy-swipe-name"></span>';
 document.body.append(el);
 let tracking=null,cancelSpring=null,guardUntil=0,session=0,paintValue=0;
 const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches||!!document.body.classList.contains('reduce-motion');
 const clearPaint=()=>{el.dataset.active='false';el.style.removeProperty('--xy-swipe-progress');el.style.removeProperty('--xy-swipe-translate');paintValue=0};
 const stopSpring=()=>{if(cancelSpring){cancelSpring();cancelSpring=null}};
 const can=()=>{
  if(disabled()||document.hidden||document.querySelector('#editor')?.open||
    document.body.classList.contains('assistant-is-open')||
    document.querySelector('[aria-modal="true"]:not([hidden])'))return false;
  const v=getRoute()?.view;
  return ORDER.includes(v)&&!document.body.classList.contains('keyboard-occluded');
 };
 const destination=(context,sign,segment)=>{
  if(segment==='items')return sign<0&&context.itemsTab==='schedule'?{scope:'items',target:'inbox',name:'待办'}:
    sign>0&&context.itemsTab==='inbox'?{scope:'items',target:'schedule',name:'日程'}:null;
  if(segment==='develop')return sign<0&&context.developTab==='record'?{scope:'develop',target:'goals',name:'目标'}:
    sign>0&&context.developTab==='goals'?{scope:'develop',target:'record',name:'记录'}:null;
  const ix=ORDER.indexOf(context.view),next=ORDER[ix+(sign<0?1:-1)];
  return next?{scope:'primary',target:next,name:{today:'今天',items:'事项',develop:'发展'}[next]}:null;
 };
 const paint=(dx,target)=>{
  paintValue=dx;
  if(reduce()||!target){clearPaint();return}
  el.dataset.active='true';el.dataset.side=dx<0?'right':'left';
  el.querySelector('.xy-swipe-arrow').textContent=dx<0?'›':'‹';
  el.querySelector('.xy-swipe-name').textContent=target.name;
  el.style.setProperty('--xy-swipe-progress',String(clamp(Math.abs(dx)/145,0,1).toFixed(3)));
  el.style.setProperty('--xy-swipe-translate',(Math.sign(dx)*Math.min(Math.abs(dx)*.22,58)).toFixed(2)+'px');
 };
 const release=(commit=false)=>{
  const s=tracking;tracking=null;
  if(!s){stopSpring();clearPaint();return}
  if(!s.started||!s.target||s.cancelled){clearPaint();return}
  stopSpring();const token=++session;
  const end=commit?Math.sign(s.dx)*Math.max(240,Math.min(window.innerWidth*.84,480)):0;
  // Commit the route on release, while the decorative spring continues settling.
  // This keeps controls responsive and prevents late route jumps in WebKit.
  if(commit&&can()){
   guardUntil=performance.now()+340;
   const cur=getRoute();
   if(s.target.scope==='primary'&&cur.view===s.context.view)onNavigate(s.target.target);
   if(s.target.scope==='items'&&cur.view==='items'&&cur.itemsTab===s.context.itemsTab)onSegment('items',s.target.target);
   if(s.target.scope==='develop'&&cur.view==='develop'&&cur.developTab===s.context.developTab)onSegment('develop',s.target.target);
  }
  const finalize=()=>{
   if(token!==session)return;
   cancelSpring=null;clearPaint();
  };
  if(reduce()){finalize();return}
  cancelSpring=springTo(s.dx,end,x=>paint(x,s.target),finalize,{velocity:s.velocity*1000});
 };
 const onDown=e=>{
  // On desktop, preserve ordinary text selection and pointer dragging.
  if((e.pointerType==='mouse'&&matchMedia('(pointer:fine)').matches)||e.button!==0||e.isPrimary===false||!can())return;
  const target=e.target instanceof Element?e.target:null;
  if(!target||!target.closest('#workspace'))return;
  const segment=target.closest('.v4-item-segments')?'items':target.closest('.v4-develop-segments')?'develop':null;
  if(!segment&&(target.closest(EDITABLE)||target.closest(INTERACTIVE)||target.closest(DRAG_CONTENT)))return;
  if(target.closest('.xy-agent-section details')||target.closest('dialog'))return;
  stopSpring();clearPaint();++session;
  tracking={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,started:false,cancelled:false,
   segment,context:getRoute(),target:null,samples:[],velocity:0};
 };
 const onMove=e=>{
  const s=tracking;if(!s||e.pointerId!==s.id||s.cancelled)return;
  const dx=e.clientX-s.x,dy=e.clientY-s.y;
  if(!s.started){
   if(Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*.72){s.cancelled=true;clearPaint();return}
   if(Math.abs(dx)<12)return;
   if(Math.abs(dx)<Math.abs(dy)*1.18){s.cancelled=true;clearPaint();return}
   s.target=destination(s.context,Math.sign(dx),s.segment);
   if(!s.target){s.cancelled=true;return}
   s.started=true;
  }
  if(Math.sign(dx)!==Math.sign(s.dx)&&Math.abs(dx)>10)s.target=destination(s.context,Math.sign(dx),s.segment);
  if(!s.target){clearPaint();return}
  s.dx=dx;
  const t=performance.now();s.samples.push({x:dx,t});
  while(s.samples.length>6||s.samples.length>1&&t-s.samples[0].t>120)s.samples.shift();
  if(s.samples.length>1){const a=s.samples[0],b=s.samples.at(-1);s.velocity=(b.x-a.x)/Math.max(1,b.t-a.t)}
  paint(dx,s.target);
  if(e.cancelable)e.preventDefault();
 };
 const onUp=e=>{
  if(!tracking||e.pointerId!==tracking.id)return;
  const s=tracking;
  const span=Math.min(window.innerWidth*.30,130);
  const complete=!!s.target&&s.started&&!s.cancelled&&
   (Math.abs(s.dx)>span||Math.abs(s.dx)>34&&Math.abs(s.velocity)>.5);
  release(complete);
 };
 const onCancel=()=>{if(tracking){tracking.cancelled=true;release(false)}else{stopSpring();clearPaint()}};
 const onClick=e=>{
  if(e.detail>0&&performance.now()<guardUntil&&e.target instanceof Element&&e.target.closest('#workspace')){
   e.preventDefault();e.stopImmediatePropagation();
  }
 };
 document.addEventListener('pointerdown',onDown,{capture:true,passive:true});
 document.addEventListener('pointermove',onMove,{capture:true,passive:false});
 document.addEventListener('pointerup',onUp,{capture:true});
 document.addEventListener('pointercancel',onCancel,{capture:true});
 document.addEventListener('click',onClick,true);
 window.addEventListener('blur',onCancel);
 return {cancel:()=>{++session;tracking=null;stopSpring();clearPaint()},
  destroy:()=>{onCancel();el.remove();document.removeEventListener('pointerdown',onDown,true);
   document.removeEventListener('pointermove',onMove,true);document.removeEventListener('pointerup',onUp,true);
   document.removeEventListener('pointercancel',onCancel,true);document.removeEventListener('click',onClick,true);window.removeEventListener('blur',onCancel)}};
}
