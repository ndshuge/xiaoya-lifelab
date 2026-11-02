/* XiaoYa Apple Edition — structural layout, honest empty states and tactile actions.
   This module never replaces app.js, data models, app listeners or persistence. */
import {createSpring} from './glass/liquid-glass.js';
const body=document.body;
const ready=()=> {
 if(!body.classList.contains('design-apple')||document.querySelector('#xy-native-focus'))return;
 const today=document.querySelector('#view-today'), hero=today?.querySelector('.hero');
 if(!today||!hero)return;
 body.classList.add('xy-native-rebuilt');
 // Replace the inherited generic AI-star glyph with Xiaoya's semantically relevant sprout.
 const star=document.getElementById('i-spark');
 if(star)star.innerHTML='<path d="M12 21v-9m0 4C5 16 3 10 3 6c6 0 9 3 9 10Zm0 0c7 0 9-5 9-10-6 0-9 3-9 10Z"/>';
 const section=document.createElement('section');
 section.id='xy-native-focus';section.className='xy-native-focus';
 section.setAttribute('aria-label','今天的快捷操作');
 section.innerHTML=`<div class="xy-native-focus-copy">
  <span class="xy-native-caption">今日安排</span>
  <strong>为今天留一点从容</strong>
  <span id="xy-native-status" role="status">你的安排和待办都在下面。</span>
 </div>
 <div class="xy-native-quick-actions">
  <button type="button" class="xy-native-quick xy-native-quick-primary" id="xy-native-add"><span aria-hidden="true">＋</span> 添加待办</button>
  <button type="button" class="xy-native-quick" id="xy-native-week"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M7 3.5v4M17 3.5v4M3.5 10h17"/></svg> 查看日程</button>
 </div>`;
 hero.insertAdjacentElement('afterend',section);
 section.querySelector('#xy-native-add').addEventListener('click',()=>today.querySelector('.hero-actions [data-add="task"]')?.click());
 section.querySelector('#xy-native-week').addEventListener('click',()=>today.querySelector('.hero-actions [data-view="schedule"]')?.click());
 // Display an informative, actionable empty state; business renders can replace it at any time.
 const empties=[
  ['today-tasks','暂无临近事项','添加一件待办','task'],
  ['today-schedule','今天还没有排入课程或活动','打开课表','schedule']
 ];
 let scheduled=false;
 function updateContent(){
  scheduled=false;
  for(const [id,message,label,target] of empties){
   const targetNode=document.getElementById(id);if(!targetNode)continue;
   const existing=targetNode.querySelector(':scope > .xy-native-empty');
   // Ignore our own placeholder when checking whether the real app produced content.
   const real=[...targetNode.childNodes].filter(n=>n!==existing&&(n.nodeType===1||n.textContent?.trim()));
   if(real.length&&real.some(n=>n.nodeType!==3||n.textContent.trim())){
     existing?.remove();continue;
   }
   if(existing)continue;
   const wrap=document.createElement('div');wrap.className='xy-native-empty';
   const title=document.createElement('p');title.textContent=message;
   const action=document.createElement('button');action.type='button';action.className='xy-native-inline-action';action.textContent=label+' →';
   action.addEventListener('click',()=>{
     if(target==='task')today.querySelector('.hero-actions [data-add="task"]')?.click();
     else today.querySelector('.hero-actions [data-view="schedule"]')?.click();
   });
   wrap.append(title,action);targetNode.append(wrap);
  }
 }
 for(const [id] of empties){
  const container=document.getElementById(id);if(!container)continue;
  new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(updateContent)}}).observe(container,{childList:true});
 }
 updateContent();
 // Use the already imported optical engine's native spring, not an independent CSS easing guess.
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches||body.classList.contains('reduce-motion');
 [...section.querySelectorAll('button')].forEach(btn=>{
   const spring=createSpring(0,v=>btn.style.setProperty('--xy-native-down',v.toFixed(3)),{stiffness:360,damping:30});
   const release=()=>spring.set(0);
   btn.addEventListener('pointerdown',e=>{if(e.button!==0)return;btn.setPointerCapture?.(e.pointerId);if(!reduced())spring.set(1)}, {passive:true});
   btn.addEventListener('pointerup',release);btn.addEventListener('pointercancel',release);
   btn.addEventListener('lostpointercapture',release);
   btn.addEventListener('blur',release);
 });
 window.__XY_NATIVE_REBUILD={version:'2026-10-29',layout:'daily-focus',engine:'liquid-glass/createSpring',state:'active'};
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
