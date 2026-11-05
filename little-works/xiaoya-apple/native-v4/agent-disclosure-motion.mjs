// Accessible Apple-style disclosure motion. The two quiet rows keep their
// native <details> semantics; only their existing content is animated.
export function installAgentDisclosureMotion(){
 const running=new WeakMap();
 const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches||
   document.body.classList.contains('reduce-motion');
 const click=e=>{
  const t=e.target instanceof Element?e.target:null;
  const summary=t?.closest('#xy-student-agent > details.xy-agent-disclosure > summary');
  if(!summary)return;
  const details=summary.parentElement,body=details.querySelector(':scope > .xy-agent-disclosure-body');
  if(!body)return;
  e.preventDefault();
  const prev=running.get(details);
  const opening=prev?!prev.opening:!details.open;
  const start=prev?body.getBoundingClientRect().height:(details.open?body.getBoundingClientRect().height:0);
  if(prev){prev.animation.onfinish=null;clearTimeout(prev.timer);prev.animation.cancel();running.delete(details)}
  if(opening)details.open=true;
  if(reduce()||!body.animate){details.open=opening;body.style.removeProperty('overflow');return}
  const height=Math.max(0,body.scrollHeight);
  const duration=opening?325:245;
  body.style.overflow='hidden';
  const animation=body.animate([
   {height:start+'px',opacity:opening?0:1},
   {height:(opening?height:0)+'px',opacity:opening?1:0}
  ],{duration,easing:opening?'cubic-bezier(.18,.83,.28,1)':'cubic-bezier(.3,0,.25,1)',fill:'both'});
  const state={opening,animation,timer:null};
  running.set(details,state);
  const settle=()=>{
   if(running.get(details)!==state)return;
   running.delete(details);clearTimeout(state.timer);
   animation.onfinish=null;animation.cancel();
   details.open=opening;body.style.removeProperty('overflow');
  };
  animation.onfinish=settle;
  state.timer=setTimeout(settle,duration+85);
 };
 document.addEventListener('click',click,true);
 return ()=>document.removeEventListener('click',click,true);
}
