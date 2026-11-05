// iPhone Safari / embedded WebKit fixed-scale gesture guard.
// Only multi-touch and WebKit's pinch gesture events are canceled.
// Single-finger page scroll, horizontal page-swipe and typing remain native.
// Note: browser/OS accessibility zoom may remain available by design.
export function installPinchGuard(doc=document){
 const cancelGesture=e=>{if(e.cancelable)e.preventDefault()};
 const cancelMulti=e=>{if(e.touches?.length>=2&&e.cancelable)e.preventDefault()};
 const settings={capture:true,passive:false};
 for(const name of ['gesturestart','gesturechange'])doc.addEventListener(name,cancelGesture,settings);
 for(const name of ['touchstart','touchmove'])doc.addEventListener(name,cancelMulti,settings);
 return ()=>{
  for(const name of ['gesturestart','gesturechange'])doc.removeEventListener(name,cancelGesture,true);
  for(const name of ['touchstart','touchmove'])doc.removeEventListener(name,cancelMulti,true);
 };
}
if(typeof document!=='undefined')installPinchGuard(document);
