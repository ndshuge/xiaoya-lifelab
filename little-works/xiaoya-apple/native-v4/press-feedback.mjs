/* Pointer-state bridge for iOS WebKit: :active alone may clear before a hold frame.
   Only registered controls get the class; no DOM wrapping or hitbox movement. */
const pressSelector=[
  '.bottom-nav .tab','.v4-week-tools .calendar-arrow button',
  '.v4-week-rail .day-pill','.v4-item-segments button',
  '.v4-develop-segments button','.v4-mood-option',
  '.v4-section-title button','.topbar .glass-btn',
  '.v4-journal-save'
].join(',');
const pointers=new Map();
const clear=id=>{const b=pointers.get(id);if(!b)return;b.classList.remove('xy-is-pressed');pointers.delete(id)};
document.addEventListener('pointerdown',e=>{
  if(e.button!==0 || !e.isPrimary)return;
  const b=e.target.closest?.('button');
  if(!b?.matches(pressSelector)||b.disabled)return;
  clear(e.pointerId);
  pointers.set(e.pointerId,b);
  b.classList.add('xy-is-pressed');
},{capture:true,passive:true});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>clear(e.pointerId),{capture:true,passive:true});
const clearAll=()=>{for(const id of pointers.keys())clear(id)};
window.addEventListener('blur',clearAll);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearAll()});
document.addEventListener('keydown',e=>{
  if(e.repeat||![' ','Enter'].includes(e.key))return;
  const b=e.target.closest?.('button');
  if(b?.matches(pressSelector)&&!b.disabled)b.classList.add('xy-is-pressed');
},{capture:true});
document.addEventListener('keyup',e=>{
  if(![' ','Enter'].includes(e.key))return;
  e.target.closest?.('button')?.classList.remove('xy-is-pressed');
},{capture:true});

// Clicking a calendar date or a segmented control can replace the original
// button immediately. Rebind the spring to its newly rendered counterpart,
// otherwise a quick tap removes the visual feedback before it has time to settle.
document.addEventListener('click',e=>{
  const button=e.target.closest?.('button');
  if(!button)return;
  let selector='';
  if(button.dataset.itemsTab)selector='[data-items-tab="'+CSS.escape(button.dataset.itemsTab)+'"]';
  else if(button.dataset.day)selector='[data-day="'+CSS.escape(button.dataset.day)+'"]';
  else if(['prev-week','next-week','now-week'].includes(button.dataset.action)){
    selector='[data-action="'+CSS.escape(button.dataset.action)+'"]';
  }
  if(!selector||matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('reduce-motion'))return;
  requestAnimationFrame(()=>{
    const successor=document.querySelector('#workspace button'+selector);
    if(!successor||successor===button)return;
    const face=successor.querySelector('.xy-elastic-face,svg,strong,span');
    if(!face||typeof face.animate!=='function')return;
    face.animate([
      {transform:'scale(.9)',offset:0},
      {transform:'scale(1.045)',offset:.42},
      {transform:'scale(.986)',offset:.67},
      {transform:'scale(1.004)',offset:.84},
      {transform:'scale(1)',offset:1}
    ],{duration:520,easing:'cubic-bezier(.32,.72,0,1)'});
  });
},{capture:true});
