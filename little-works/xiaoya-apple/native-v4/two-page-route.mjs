// Xiaoya V5.6 — paired rigid route slides for clicks / settings / search.
// Do not clone the old page. Move the real outgoing node into an inert stage.
// Incoming page is the only interactive destination after animation settles.
export function createTwoPageRoute({workspace,getReduced}){
 let finishCurrent=null;
 return function transitionContent(update,{animate=true,direction='neutral'}={}){
  finishCurrent?.();
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
  const opts={duration:305,easing:'cubic-bezier(.22,.85,.28,1)',fill:'both'};
  const outward=old.animate([{transform:x(0)},{transform:x(-sign*width)}],opts);
  const inward=next.animate([{transform:x(sign*width)},{transform:x(0)}],opts);
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
  timeout=setTimeout(close,395); // Safari safeguard for interrupted animations
 };
}
