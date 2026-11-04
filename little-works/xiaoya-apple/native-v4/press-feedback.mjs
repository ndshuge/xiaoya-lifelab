/* Pointer-state bridge for iOS WebKit: :active alone may clear before a hold frame.
   Only registered controls get the class; no DOM wrapping or hitbox movement. */
const pressSelector=[
  '.bottom-nav .tab','.v4-week-tools .calendar-arrow button',
  '.v4-week-rail .day-pill','.v4-item-segments button',
  '.v4-develop-segments button','.v4-mood-option',
  '.v4-section-title button','.topbar .glass-btn',
  '.v4-journal-save','.v4-goal-checkin','.v4-ask-companion',
  '.v4-journal-delete','.v4-goal-name','.small-action',
  '.sheet .sheet-save','.sheet .sheet-cancel',
  '.assistant-shortcuts button','.assistant-config-actions button',
  '.dayflow-focus-bottom button'
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

// Lateral navigation and grouped choices intentionally do not inherit
// a 520ms Duolingo-style bounce after their DOM is re-rendered. Their shared
// selection indicator supplies the feedback; solo actions retain pressed class.
