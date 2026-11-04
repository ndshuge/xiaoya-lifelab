// Shared press roles for all Xiaoya buttons. Grouped controls have no 3D key.
const group='.bottom-nav button,.side-nav button,.v4-item-segments button,.v4-develop-segments button,.v4-mood-picker button,.v4-week-rail button,.v4-week-tools button,.calendar-arrow button,.filterbar button,.dayflow-plan-tabs button,[data-filter],[data-day],[data-items-tab],[data-develop-tab],[data-mood],[data-assistant-nav]';
const check='[data-toggle],.circle-check,[role=switch]';
const solo='#journal-save,#sheet-save,#assistant-send,.xy-action-main,.xy-create-option,.dayflow-approve,.v4-goal-checkin,.assistant-config-actions #assistant-verify,.assistant-compose button[type=submit]';
const icon='.icon-button,.topbar .glass-btn,.assistant-icon,.xiaoya-avatar';
function role(b){
 if(b.matches(group))return 'group';
 if(b.matches(check))return 'check';
 if(b.matches(solo))return 'solo';
 if(b.matches(icon)||(!b.textContent?.trim()&&b.querySelector('svg')))return 'icon';
 return 'quiet';
}
function enhance(root){
 const found=root?.matches?.('button')?[root]:[...root?.querySelectorAll?.('button')||[]];
 for(const btn of found){const kind=role(btn);if(btn.dataset.pressRole!==kind)btn.dataset.pressRole=kind;}
}
enhance(document.body);
new MutationObserver(records=>{
 for(const record of records)for(const item of record.addedNodes)if(item.nodeType===1)enhance(item);
}).observe(document.body,{childList:true,subtree:true});
const active=new Map();
function clear(id){const b=active.get(id);if(!b)return;b.classList.remove('xy-is-pressed');active.delete(id)}
document.addEventListener('pointerdown',e=>{
 if(e.button!==0||!e.isPrimary)return;
 const b=e.target.closest?.('button');if(!b||b.disabled)return;
 if(!b.dataset.pressRole)enhance(b);
 clear(e.pointerId);active.set(e.pointerId,b);b.classList.add('xy-is-pressed');
},{capture:true,passive:true});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>clear(e.pointerId),{capture:true,passive:true});
const reset=()=>{for(const id of [...active.keys()])clear(id)};
window.addEventListener('blur',reset);
document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
document.addEventListener('keydown',e=>{
 if(e.repeat||![' ','Enter'].includes(e.key))return;
 const b=e.target.closest?.('button');if(!b||b.disabled)return;
 if(!b.dataset.pressRole)enhance(b);
 b.classList.add('xy-is-pressed');
},{capture:true});
document.addEventListener('keyup',e=>{
 if([' ','Enter'].includes(e.key))e.target.closest?.('button')?.classList.remove('xy-is-pressed');
},{capture:true});
