/* XiaoYa native-feeling interaction layer. No storage, network, or agent writes.
   Reuses the bundled liquidglass.dev native Skill engine/components. */
import { createSpring } from './glass/liquid-glass.js';
import './glass/components.js';
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('reduce-motion');
const animations=new WeakMap();
function animate(el,frames,options){
 if(!el||reduceMotion()||!el.animate)return;
 animations.get(el)?.cancel();
 const animation=el.animate(frames,{fill:'both',...options});
 animations.set(el,animation);
 animation.finished.then(()=>{if(animations.get(el)===animation){animation.cancel();animations.delete(el)}}).catch(()=>{});
}
const easing='cubic-bezier(.16,1,.3,1)';
let active=null,longTimer=null;
const release=()=>{
 if(!active)return;
 const el=active.el;clearTimeout(longTimer);longTimer=null;
 el.classList.remove('xy-long-held','xy-press-held');active=null;
};
document.addEventListener('pointerdown',e=>{
 if(e.button!==0&&e.pointerType==='mouse')return;
 const el=e.target.closest('button,.xy-settings-item');
 if(!el||el.disabled||el.closest('.mobile-tabs')||el.closest('lg-segmented')||el.closest('.xy-glass-content'))return;
 release();active={el,id:e.pointerId,x:e.clientX,y:e.clientY};
 el.classList.add('xy-press-held');
 longTimer=setTimeout(()=>{if(active?.el===el)el.classList.add('xy-long-held')},310);
},{capture:true,passive:true});
document.addEventListener('pointermove',e=>{
 if(active?.id===e.pointerId&&Math.hypot(e.clientX-active.x,e.clientY-active.y)>12)release();
},{capture:true,passive:true});
['pointerup','pointercancel','dragstart'].forEach(name=>document.addEventListener(name,release,true));
window.addEventListener('blur',release);
document.addEventListener('keydown',e=>{
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('button')&&!e.repeat)e.target.classList.add('xy-press-held')
},true);
document.addEventListener('keyup',e=>{if(e.target.matches('button'))e.target.classList.remove('xy-press-held')},true);
// Bridge the Skill's native radio component to the app's existing authoritative data-filter listener.
// Clicking is already delegated by app.js; keyboard arrow selection emits change only.
const filters=document.querySelector('lg-segmented#task-filters');
if(filters)filters.addEventListener('change',event=>{
 const chosen=[...filters.querySelectorAll(':scope > button')].find(b=>b.value===event.detail?.value);
 if(chosen)chosen.click();
});
// Retain existing app navigation and synchronous business updates. Animate only the newly
// revealed content, never re-render records or delay a save/approval.
const views=[...document.querySelectorAll('#main>.view')];
let lastView=document.querySelector('#main>.view.active');
const navObserver=new MutationObserver(()=>{
 const incoming=document.querySelector('#main>.view.active');
 if(!incoming||incoming===lastView)return;
 lastView=incoming;
 animate(incoming,[
   {opacity:.74,transform:'translate3d(12px,0,0) scale(.993)'},
   {opacity:1,transform:'translate3d(0,0,0) scale(1)'}
 ],{duration:350,easing});
 const title=incoming.querySelector('h1');
 if(title)animate(title,[{opacity:.72,transform:'translate3d(0,9px,0)'},{opacity:1,transform:'none'}],{duration:430,easing});
});
for(const v of views)navObserver.observe(v,{attributes:true,attributeFilter:['class']});
// Actual position/size FLIP from an existing task/course/goal/proposal row to the editing sheet.
// The source remains owned by app.js; the animation is purely visual and can be cancelled.
let pendingSource=null;
document.addEventListener('click',e=>{
 const src=e.target.closest('[data-open-kind],[data-propose],[data-add],[data-source]');
 if(!src)return;
 const card=src.closest('[data-item],.advice-card,.panel,.goal-card,.schedule-item')||src;
 const rect=card.getBoundingClientRect();
 pendingSource={rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},kind:src.dataset.openKind||src.dataset.add||src.dataset.propose||'source'};
 requestAnimationFrame(()=>{
  const token=pendingSource;pendingSource=null;
  if(!token||document.querySelector('#modal-root')?.hidden)return;
  const modal=document.querySelector('#modal-root .modal-card');if(!modal)return;
  const to=modal.getBoundingClientRect(),from=token.rect;
  const dx=from.left+from.width/2-(to.left+to.width/2);
  const dy=from.top+from.height/2-(to.top+to.height/2);
  const sx=Math.max(.78,Math.min(1,from.width/Math.max(1,to.width)));
  const sy=Math.max(.82,Math.min(1,from.height/Math.max(1,to.height)));
  animate(modal,[
   {opacity:.7,transform:`translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) scale(${sx.toFixed(3)},${sy.toFixed(3)})`,borderRadius:'24px'},
   {opacity:1,transform:'translate3d(0,0,0) scale(1)',borderRadius:getComputedStyle(modal).borderRadius}
  ],{duration:420,easing});
 });
},true);
// Hierarchical Settings gets true interruptible WAAPI entrance rather than a one-frame replacement.
const settings=document.querySelector('#view-settings');
if(settings){
 const observer=new MutationObserver(()=>{
  if(!settings.classList.contains('active'))return;
  const visible=settings.querySelector('.xy-settings-sections [data-xy-group]:not([hidden])')||settings.querySelector('.xy-settings-menu:not([hidden])');
  animate(visible,[{opacity:.42,transform:'translate3d(19px,0,0)'},{opacity:1,transform:'none'}],{duration:350,easing});
 });
 observer.observe(settings,{attributes:true,attributeFilter:['data-xy-active']});
 const back=settings.querySelector('.xy-settings-back');
 if(back)back.addEventListener('click',()=>requestAnimationFrame(()=>{
   animate(settings.querySelector('.xy-settings-menu'),[{opacity:.65,transform:'translate3d(-15px,0,0)'},{opacity:1,transform:'none'}],{duration:300,easing});
 }),true);
}
// Accessible state labels; never infer or spoof model connection.
const indicator=document.createElement('span');
indicator.className='xy-app-announce';indicator.setAttribute('aria-live','polite');
document.body.append(indicator);
const navButtons=document.querySelectorAll('.mobile-tabs button[data-view],.side-nav button[data-view]');
for(const btn of navButtons)btn.addEventListener('click',()=>{indicator.textContent='已切换到'+btn.textContent.trim()},false);

// Preserve the gallery comparison links, but treat them as secondary app settings,
// not a persistent system-looking bar above every app screen.
function relocateGalleryLinks(){
 const gallery=document.querySelector('body > .comparison-nav');
 const settings=document.querySelector('#view-settings');
 if(!gallery||!settings||gallery.closest('.xy-compare-drawer'))return;
 const panel=document.createElement('details');
 panel.className='xy-compare-drawer';
 const summary=document.createElement('summary');summary.textContent='版本对照与返回小东西';
 panel.append(summary,gallery);
 settings.append(panel);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',relocateGalleryLinks,{once:true});
else relocateGalleryLinks();

window.__XIAOYA_NATIVE_EXPERIENCE={version:'20261028',glassComponent:customElements.get('lg-segmented')?.name||'unavailable',filters:!!filters,animations:'WAAPI',storageWrites:0};
