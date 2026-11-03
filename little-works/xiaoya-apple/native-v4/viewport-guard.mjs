// Native V4: iOS/Safari visual viewport keyboard guard.
// Compensates only while a real editable control owns focus. No polling,
// hidden data access, UA sniffing, or dependence on a JS animation engine.
const isTextEditor = element => {
 if(!(element instanceof HTMLElement))return false;
 if(element.isContentEditable||element.matches('textarea'))return true;
 if(!element.matches('input'))return false;
 return !/^(?:hidden|button|submit|reset|file|checkbox|radio|range|color|image)$/i.test(element.type);
};

export function installViewportGuard(win=window,doc=document){
 let raf=0;
 const sync=()=>{
  raf=0;
  const viewport=win.visualViewport;
  const mobile=win.matchMedia('(max-width:700px)').matches;
  const editing=mobile&&isTextEditor(doc.activeElement);
  const visualHeight=Math.max(180,viewport?.height||win.innerHeight);
  const viewportBottom=(viewport?.offsetTop||0)+visualHeight;
  // The browser chrome may already cost a few CSS pixels. Treat the
  // remainder as keyboard occlusion only above a substantial threshold.
  const hiddenBottom=Math.max(0,win.innerHeight-viewportBottom);
  const inset=editing&&hiddenBottom>=120?Math.round(hiddenBottom):0;
  // A virtual keyboard can arrive while the companion sheet is still
  // flying in from its avatar. Cancel only the sheet's own transform so
  // the live composer is never dragged below the newly visible viewport.
  if(inset>0){
   const sheet=doc.querySelector('.assistant-panel:not([hidden])');
   for(const anim of sheet?.getAnimations()||[]){
    if(anim.playState==='running'&&anim.effect?.target===sheet)anim.cancel();
   }
  }
  doc.documentElement.style.setProperty('--xy-visual-height',visualHeight+'px');
  doc.documentElement.style.setProperty('--xy-visual-bottom-inset',inset+'px');
  doc.body.classList.toggle('xy-viewport-editing',!!editing);
  // Focusing the composer precedes the keyboard opening. Preserve the
  // original sheet position until the visual viewport is truly occluded.
  doc.body.classList.toggle('xy-keyboard-occluded',!!editing&&inset>0);
 };
 const requestSync=()=>{
  if(raf)return;
  raf=win.requestAnimationFrame(sync);
 };
 doc.addEventListener('focusin',requestSync,true);
 doc.addEventListener('focusout',requestSync,true);
 win.addEventListener('resize',requestSync,{passive:true});
 win.visualViewport?.addEventListener('resize',sync,{passive:true});
 win.visualViewport?.addEventListener('scroll',sync,{passive:true});
 requestSync();
 return ()=>{
  if(raf)win.cancelAnimationFrame(raf);
  doc.removeEventListener('focusin',requestSync,true);
  doc.removeEventListener('focusout',requestSync,true);
  win.removeEventListener('resize',requestSync);
  win.visualViewport?.removeEventListener('resize',sync);
  win.visualViewport?.removeEventListener('scroll',sync);
  doc.body.classList.remove('xy-viewport-editing','xy-keyboard-occluded');
  doc.documentElement.style.removeProperty('--xy-visual-height');
  doc.documentElement.style.removeProperty('--xy-visual-bottom-inset');
 };
}

if(typeof window!=='undefined'&&typeof document!=='undefined')installViewportGuard();
