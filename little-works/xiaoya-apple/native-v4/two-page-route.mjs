// Xiaoya V5.7 — paired rigid route slides with sampled physical springs.
import {springTranslations} from './physical-spring.mjs';
// Do not clone the old page. Move the real outgoing node into an inert stage.
// Incoming page is the only interactive destination after animation settles.
export function createTwoPageRoute({workspace,getReduced}){
 let finishCurrent=null;
 return function transitionContent(update,{animate=true,direction='neutral'}={}){
  // Retain in-flight displacement across rapid opposite-direction navigation.
  const active=workspace.querySelector(':scope > .page:not(.xy-route-outgoing)');
  const carry=active?new DOMMatrixReadOnly(getComputedStyle(active).transform).m41:0;
  // WebKit may keep a transform animation during a rapid re-entry.
  // Read its actual position even if the previous finish callback ran early.
  const hadMotion=!!finishCurrent;
  finishCurrent?.();
  if(!hadMotion){
   active?.getAnimations().filter(a=>a.id==='xy-incoming-page').forEach(a=>a.cancel());
   workspace.querySelectorAll(':scope > .xy-route-outgoing').forEach(node=>node.remove());
   workspace.classList.remove('xy-route-inflight');
  }
  const old=workspace.querySelector(':scope > .page');
  if(!animate||direction==='neutral'||getReduced()||
     document.documentElement.dataset.xySwipeCommit==='true'||!old){
    update();return;
  }
  // Render the next true page synchronously, retaining the old node only
  // while the two rigid canvases travel at identical velocities.
  old.remove();
  update();
  const next=workspace.querySelector(':scope > .page');
  if(!next?.animate)return;
  const width=Math.max(1,workspace.clientWidth||innerWidth),sign=direction==='backward'?-1:1;
  old.classList.add('xy-route-outgoing');old.inert=true;old.setAttribute('aria-hidden','true');
  // Do not expose duplicate IDs while an inert outgoing view is painted.
  for(const node of [old,...old.querySelectorAll('*')]){
    node.removeAttribute('id');
    for(const attr of [...node.attributes])if(attr.name.startsWith('data-'))node.removeAttribute(attr.name);
  }
  workspace.append(old);workspace.classList.add('xy-route-inflight');
  const x=n=>'translate3d('+n+'px,0,0)';
  const duration=690,physics={duration,response:.53,damping:.84,axis:'x'};
  const opts={duration,easing:'linear',fill:'both'};
  const outward=old.animate(springTranslations(carry,-sign*width,physics),opts);
  const inward=next.animate(springTranslations(sign*width+carry,0,physics),opts);
  outward.id='xy-outgoing-page';inward.id='xy-incoming-page';
  let finished=false;
  let timeout=null;
  const close=()=>{
   if(finished)return;finished=true;clearTimeout(timeout);
   outward.cancel();inward.cancel();old.remove();
   workspace.classList.remove('xy-route-inflight');
   if(finishCurrent===close)finishCurrent=null;
  };
  finishCurrent=close;
  inward.onfinish=close;
  timeout=setTimeout(close,duration+100); // Safari safeguard for interrupted animations
 };
}
