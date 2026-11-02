/* XiaoYa iOS26 shell: navigation, gestures, animation only. No persistence / API writes.
   Physically-based sheet retraction uses installed liquid-glass-web createSpring. */
import {createSpring} from './glass/liquid-glass.js';
const $=s=>document.querySelector(s),body=document.body;
if(body.classList.contains('design-apple')){
 body.classList.add('xy-ios26-v2');

 // Real structural refactor: secondary workflows become native disclosure rows.
 // Moving the existing forms (never cloning) preserves every live input, listener and ID.
 const quick=$('#quick-task-form');
 if(quick&&!$('#xy26-quick-panel')){
   const section=document.createElement('details');
   section.id='xy26-quick-panel';section.className='xy26-disclosure';
   const summary=document.createElement('summary');
   summary.innerHTML='<strong>快速记录</strong><span>随手写下新待办 <b aria-hidden="true">＋</b></span>';
   quick.replaceWith(section);section.append(summary,quick);
   const screen=matchMedia('(min-width:791px)');
   const size=()=>{if(screen.matches)section.open=true};
   size();screen.addEventListener?.('change',size);
 }
 const capabilities=$('#ai-mode-dashboard');
 if(capabilities&&!$('#xy26-ai-options')){
   const section=document.createElement('details');
   section.id='xy26-ai-options';section.className='xy26-disclosure';
   const summary=document.createElement('summary');
   summary.innerHTML='<strong>规划方式与 AI 状态</strong><span class="xy26-capability-description">基础规则规划无需 API</span>';
   capabilities.replaceWith(section);section.append(summary,capabilities);
   const status=()=>{
     const connected=capabilities.dataset.aiMode==='verified';
     summary.querySelector('.xy26-capability-description').textContent=connected?'已接入真实模型 · 点击查看':'规则规划无需 API · 点击查看';
   };
   new MutationObserver(status).observe(capabilities,{attributes:true,attributeFilter:['data-ai-mode']});status();
 }

 const dock=$('.mobile-tabs'),tabs=[...dock.querySelectorAll('button[data-view]')].filter(x=>x.dataset.view!=='settings');
 const topSettings=$('.topbar .top-actions>.icon-button[data-view="settings"]');
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches||body.classList.contains('reduce-motion');
 let current=$('#main>.view.active')?.id.replace('view-','')||'today',prior=current;
 let lastScroll=scrollY,throttle=0,expandUntil=0,skipClickUntil=0,skipButton=null,navTransition=null;
 const positions=new Map(),metrics={navigations:0,viewTransitions:0,swipes:0,swipeCancels:0,sheetDismissals:0,sheetCancel:0,keyboardHidden:0};
 const labels={today:'今天',schedule:'课表',tasks:'事项',goals:'成长',review:'复盘',settings:'设置'};
 const mini=document.createElement('button');
 mini.type='button';mini.className='xy-dock-minibutton';mini.tabIndex=-1;mini.setAttribute('aria-hidden','true');mini.setAttribute('aria-label','展开底部导航');
 mini.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5 10.5V20h14v-9.5M9.5 20v-7h5v7"/></svg><span>今天</span>';
 dock.after(mini);
 function compact(on){
   if(innerWidth>790||reduced()||body.classList.contains('xy-keyboard-open'))on=false;
   if(on&&performance.now()<expandUntil)return;
   body.classList.toggle('xy-dock-condensed',on);
   mini.tabIndex=on?0:-1;mini.setAttribute('aria-hidden',String(!on));
 }
 mini.addEventListener('click',()=>{expandUntil=performance.now()+3500;compact(false);tabs.find(t=>t.dataset.view===current)?.focus({preventScroll:true})});
 function sync(){
   current=$('#main>.view.active')?.id.replace('view-','')||current;
   for(const b of [...tabs,topSettings].filter(Boolean)){
     if(b.dataset.view===current)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
   }
   const selected=tabs.find(t=>t.dataset.view===(current==='settings'?prior:current));
   if(selected){
     const icon=selected.querySelector('svg'),old=mini.querySelector('svg');
     if(icon&&old)old.replaceWith(icon.cloneNode(true));
   }
   mini.querySelector('span').textContent=labels[current]||'导航';
   body.dataset.xyView=current;
 }
 sync();
 document.querySelectorAll('#main>.view').forEach(v=>new MutationObserver(sync).observe(v,{attributes:true,attributeFilter:['class']}));
 function navigate(next,fromGesture=false){
   if(!$('#view-'+next)||!window.OPC_TEST?.navigate)return;
   if(next===current){compact(false);return}
   const old=current;positions.set(old,scrollY);prior=old;
   const restore=positions.get(next)||0;
   const apply=()=>{
     window.OPC_TEST.navigate(next);current=next;sync();
     requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTo({top:restore,behavior:'instant'})));
   };
   // Never snapshot the entire app root: that produced ghosted overlapping text
   // on fast taps. The existing native-experience.js WAAPI animates ONLY the new
   // view and is interruptible without freezing business updates.
   apply();
   metrics.navigations++;if(fromGesture)metrics.swipes++;
   compact(false);expandUntil=performance.now()+650;
 }
 // Real app.js navigation function is used; we intercept only application chrome.
 document.addEventListener('click',e=>{
   const b=e.target.closest('.mobile-tabs>button[data-view],.sidebar button[data-view],.sidebar-bottom button[data-view],.topbar .top-actions>.icon-button[data-view]');
   if(!b)return;
   if(e.isTrusted&&b===skipButton&&performance.now()<skipClickUntil){skipButton=null;skipClickUntil=0;e.preventDefault();e.stopImmediatePropagation();return}
   e.preventDefault();e.stopImmediatePropagation();navigate(b.dataset.view);
 },true);
 const lens=dock.querySelector('.xy-glass-indicator');
 const nearest=x=>tabs.reduce((a,b)=>{
   const da=Math.abs(a.getBoundingClientRect().left+a.getBoundingClientRect().width/2-x);
   const db=Math.abs(b.getBoundingClientRect().left+b.getBoundingClientRect().width/2-x);
   return db<da?b:a;
 },tabs[0]);
 let dockGesture=null;
 dock.addEventListener('pointerdown',e=>{
   if(innerWidth>790||e.pointerType==='mouse'||!e.target.closest('button[data-view]:not([data-view="settings"])'))return;
   dockGesture={id:e.pointerId,x:e.clientX,y:e.clientY,source:e.target.closest('button[data-view]'),dragging:false};
 },{passive:true});
 dock.addEventListener('pointermove',e=>{
   const d=dockGesture;if(!d||d.id!==e.pointerId)return;
   const dx=e.clientX-d.x,dy=e.clientY-d.y;
   if(!d.dragging&&Math.abs(dy)>11&&Math.abs(dy)>Math.abs(dx)){dockGesture=null;metrics.swipeCancels++;return}
   if(!d.dragging&&Math.abs(dx)<9)return;
   d.dragging=true;
   if(lens){
     const rect=dock.getBoundingClientRect(),r=nearest(e.clientX).getBoundingClientRect();
     const min=tabs[0].getBoundingClientRect().left-rect.left;
     const max=tabs.at(-1).getBoundingClientRect().right-rect.left-r.width;
     const x=Math.max(min,Math.min(max,e.clientX-rect.left-r.width/2));
     lens.style.transform='translate3d('+x.toFixed(1)+'px,0,0)';
     lens.classList.add('is-pressed');
   }
   if(e.cancelable)e.preventDefault();
 },{passive:false});
 dock.addEventListener('pointerup',e=>{
   if(!dockGesture||e.pointerId!==dockGesture.id)return;
   const d=dockGesture;dockGesture=null;if(!d.dragging)return;
   skipClickUntil=performance.now()+145;skipButton=d.source;lens?.classList.remove('is-pressed');
   const target=nearest(e.clientX);
   if(target){navigate(target.dataset.view,true);target.focus({preventScroll:true})}
   else metrics.swipeCancels++;
 },{passive:true});
 dock.addEventListener('pointercancel',()=>{if(dockGesture?.dragging)metrics.swipeCancels++;dockGesture=null;lens?.classList.remove('is-pressed')},{passive:true});
 // Scroll aware: compact pill on downward scroll, full bar on upward scroll.
 function scrollWatch(){
   throttle=0;
   if(innerWidth>790||body.classList.contains('xy-keyboard-open'))return;
   if(!$('#modal-root').hidden||!$('#xy-window')?.hidden)return;
   const y=Math.max(0,scrollY),delta=y-lastScroll;
   if(y<85)compact(false);
   else if(delta>13)compact(true);
   else if(delta<-11)compact(false);
   lastScroll=y;
 }
 addEventListener('scroll',()=>{if(!throttle)throttle=requestAnimationFrame(scrollWatch)},{passive:true});
 addEventListener('resize',()=>{compact(false);sync()},{passive:true});
 const viewport=window.visualViewport;
 function keyboard(){
   if(!viewport||innerWidth>790){body.classList.remove('xy-keyboard-open');return}
   const occluded=innerHeight-viewport.height-viewport.offsetTop;
   const focus=document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable=true]');
   const open=occluded>150&&focus;
   if(open&&!body.classList.contains('xy-keyboard-open'))metrics.keyboardHidden++;
   body.classList.toggle('xy-keyboard-open',!!open);
   if(open)compact(false);
 }
 viewport?.addEventListener('resize',keyboard,{passive:true});
 viewport?.addEventListener('scroll',keyboard,{passive:true});
 document.addEventListener('focusin',keyboard);
 document.addEventListener('focusout',()=>setTimeout(keyboard,80));
 // Sheet gestures operate ONLY on the modal header. All business forms remain untouched.
 const modal=$('#modal-root'),card=modal.querySelector('.modal-card'),head=card.querySelector('.modal-header'),scrim=modal.querySelector('.modal-scrim');
 let origin=null,sheet=null,closing=false;
 const spring=createSpring(0,v=>{
   if(!modal.hidden&&!sheet&&!closing)card.style.transform='translate3d(0,'+Math.max(0,v).toFixed(1)+'px,0)';
 },{stiffness:390,damping:33});
 document.addEventListener('click',e=>{
   const item=e.target.closest('[data-open-kind],[data-propose],[data-add],[data-open-id]');
   if(!item)return;
   const rect=(item.closest('[data-item],.advice-card,.panel,.goal-card,.schedule-item')||item).getBoundingClientRect();
   origin={x:rect.left+rect.width/2,y:rect.top+rect.height/2,w:rect.width,h:rect.height};
 },true);
 function dismiss(){
   if(modal.hidden||closing)return;
   closing=true;metrics.sheetDismissals++;
   const done=()=>{
     card.style.transform='';card.style.opacity='';scrim.style.opacity='';
     // Guard stays active through the original delegated click, preventing recursive animation.
     modal.querySelector('.modal-header [data-close]')?.click();closing=false;
   };
   if(reduced()){done();return}
   const rect=card.getBoundingClientRect();
   const x=origin?origin.x-rect.left-rect.width/2:0;
   const y=origin?origin.y-rect.top-rect.height/2:Math.max(180,rect.height/2);
   const sx=origin?Math.max(.72,Math.min(1,origin.w/rect.width)):.96;
   const sy=origin?Math.max(.78,Math.min(1,origin.h/rect.height)):.96;
   const end='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0) scale('+sx.toFixed(2)+','+sy.toFixed(2)+')';
   try{
     const a=card.animate([{transform:card.style.transform||'translate3d(0,0,0)',opacity:1},{transform:end,opacity:.15}],{duration:230,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
     scrim.animate([{opacity:1},{opacity:0}],{duration:230}).finished.catch(()=>{});
     a.finished.then(done).catch(done);
   }catch{done()}
 }
 document.addEventListener('click',e=>{
   if(modal.hidden||closing||!e.target.closest('#modal-root [data-close]'))return;
   e.preventDefault();e.stopImmediatePropagation();dismiss();
 },true);
 head.addEventListener('pointerdown',e=>{
   if(innerWidth>790||e.pointerType==='mouse'||modal.hidden||closing)return;
   sheet={id:e.pointerId,start:e.clientY,last:e.clientY,lastT:performance.now(),velocity:0};
   spring.set(0,{immediate:true});
 },{passive:true});
 head.addEventListener('pointermove',e=>{
   const d=sheet;if(!d||d.id!==e.pointerId)return;
   const dy=Math.max(0,e.clientY-d.start),now=performance.now(),dt=Math.max(1,now-d.lastT);
   d.velocity=(e.clientY-d.last)/dt;d.last=e.clientY;d.lastT=now;
   card.style.transform='translate3d(0,'+dy.toFixed(1)+'px,0)';
   scrim.style.opacity=String(Math.max(.18,1-dy/Math.max(250,innerHeight*.65)));
   if(e.cancelable)e.preventDefault();
 },{passive:false});
 function sheetRelease(e){
   if(!sheet||sheet.id!==e.pointerId)return;
   const d=sheet;sheet=null;
   const distance=e.clientY-d.start;
   if(e.type==='pointercancel'||distance<84||(distance<112&&d.velocity<.6)){
     metrics.sheetCancel++;scrim.style.opacity='';spring.set(0);return;
   }
   dismiss();
 }
 head.addEventListener('pointerup',sheetRelease);
 head.addEventListener('pointercancel',sheetRelease);
 document.addEventListener('keydown',e=>{
   if(e.key!=='Escape'||modal.hidden||closing||!$('#xy-onboard')?.hidden||!$('#xy-window')?.hidden)return;
   e.preventDefault();e.stopImmediatePropagation();dismiss();
 },true);
 window.__XIAOYA_IOS26_V2={version:'2.0',get state(){return {current,condensed:body.classList.contains('xy-dock-condensed'),keyboardOpen:body.classList.contains('xy-keyboard-open'),...metrics}},openTab:navigate};
}
