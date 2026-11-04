// VNext long-press recognizer: aborts on scrolling, cancel or >10px travel.
// No touch-action override, no transform of live hitboxes, and no Dock changes.
const targets='[data-edit="task"],.native-event[data-edit],[data-journal-date]';
let activeCleanup=()=>{};
export function installContextLongPress(root,{onOpen}){
 activeCleanup();
 const doc=root.ownerDocument;
 let current=null,skip=null;
 const clear=()=>{
  if(!current)return;
  clearTimeout(current.timer);
  current=null;
 };
 const down=e=>{
  if(!e.isPrimary||e.button!==0||current)return;
  const target=e.target.closest?.(targets);
  if(!target||!root.contains(target)||target.disabled)return;
  const state={id:e.pointerId,x:e.clientX,y:e.clientY,target,timer:0};
  state.timer=setTimeout(()=>{
   if(current!==state)return;
   skip={target,until:performance.now()+800};
   clear();
   const label=target.dataset.journalDate?'journal':target.dataset.edit;
   onOpen({kind:label,id:target.dataset.id||null,date:target.dataset.journalDate||null,source:target});
  },500);
  current=state;
 };
 const move=e=>{
  if(!current||e.pointerId!==current.id)return;
  if(Math.hypot(e.clientX-current.x,e.clientY-current.y)>10)clear();
 };
 const up=e=>{if(current?.id===e.pointerId)clear()};
 const blur=()=>clear();
 const click=e=>{
  if(!skip)return;
  if(performance.now()>skip.until){skip=null;return}
  const pressed=e.target.closest?.(targets);
  if(pressed===skip.target){e.preventDefault();e.stopImmediatePropagation();skip=null}
 };
 const context=e=>{if(e.target.closest?.(targets)&&skip&&performance.now()<skip.until)e.preventDefault()};
 root.addEventListener('pointerdown',down);
 doc.addEventListener('pointermove',move,{passive:true});
 doc.addEventListener('pointerup',up);
 doc.addEventListener('pointercancel',up);
 root.addEventListener('click',click,{capture:true});
 root.addEventListener('contextmenu',context);
 window.addEventListener('blur',blur);
 activeCleanup=()=>{
  clear();root.removeEventListener('pointerdown',down);
  doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);
  doc.removeEventListener('pointercancel',up);root.removeEventListener('click',click,true);
  root.removeEventListener('contextmenu',context);window.removeEventListener('blur',blur);
 };
 return activeCleanup;
}
