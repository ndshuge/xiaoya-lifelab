// 新手任务 · Learn by doing, in chapters. Each step spotlights one real control and waits for the real action
// (an app event), never a fake click. Non-blocking: the dim layer never intercepts input.
// The spotlight is a cut-out: everything else dims, the target stays at full brightness inside a ring, and
// when the step waits for a click a pulsing 「点这里」 tag points at the exact control to press next.
// A step may: prepare the page (enter), offer a helper action, be optional (auto-skipped if its target
// is missing), or just explain (next). Chapters can be skipped one at a time, or the whole tour.
// target / also / tap / tapLabel may be strings or functions (re-read every frame, so the tag can move
// from the input to 「落笔」 once something has been written).
export function createTutorial({esc,face,steps,onFinish,onStep=()=>{}}){
 let i=-1,layer=null,hole=null,bubble=null,tag=null,raf=0,active=false,waiting=null,missTimer=null;const skipped=new Set();
 const $=s=>document.querySelector(s);
 const val=v=>typeof v==='function'?v():v;
 const visible=n=>n&&n.getClientRects().length&&n.getBoundingClientRect().width>0;
 const chapters=[...new Set(steps.map(s=>s.chapter||''))];
 function build(){
  layer=document.createElement('div');layer.className='tour';
  layer.innerHTML='<div class="tour-hole"></div><div class="tour-tag" aria-hidden="true"><span></span></div><div class="tour-bubble" role="dialog" aria-live="polite"></div>';
  document.body.append(layer);hole=layer.querySelector('.tour-hole');tag=layer.querySelector('.tour-tag');bubble=layer.querySelector('.tour-bubble');
  bubble.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.tour;
   if(k==='skip')finish('skipped');else if(k==='chapter')skipChapter();else if(k==='next')advance();else if(k==='action')steps[i].action?.run()});
 }
 function pick(sel){if(!sel)return null;for(const one of String(sel).split('|')){const n=$(one.trim());if(visible(n))return n}return null}
 function target(){const s=steps[i];return s?pick(val(s.target)):null}
 // The lit area: the target plus any companions (the draft preview above the input).
 function litRect(n){const s=steps[i];let r=n.getBoundingClientRect(),L=r.left,T=r.top,R=r.right,B=r.bottom;
  for(const sel of [].concat(val(s.also)||[])){const m=pick(sel);if(!m)continue;const q=m.getBoundingClientRect();L=Math.min(L,q.left);T=Math.min(T,q.top);R=Math.max(R,q.right);B=Math.max(B,q.bottom)}
  return {left:L,top:T,right:R,bottom:B,width:R-L,height:B-T}}
 function place(){
  if(!active)return;const s=steps[i],n=target();
  if(n){const r=litRect(n),pad=s.pad??8,vw=innerWidth,vh=innerHeight;
   const H={left:r.left-pad,top:r.top-pad,width:r.width+pad*2,height:r.height+pad*2};
   Object.assign(hole.style,{display:'block',left:H.left+'px',top:H.top+'px',width:H.width+'px',height:H.height+'px'});
   // 「点这里」: only when the step waits for a real click/typing, pointed at the exact control.
   // The tag sits right on top of the control it names (above it, or below when there is no room).
   const tapEl=s.until?(pick(val(s.tap))||n):null;let tagTop=H.top,tagBottom=H.top+H.height;
   if(tapEl){const t=tapEl.getBoundingClientRect(),below=t.top<54;
    tag.querySelector('span').textContent=val(s.tapLabel)||'点这里';
    const cx=Math.min(Math.max(t.left+t.width/2,60),vw-60),y=below?t.bottom+8:t.top-8;
    Object.assign(tag.style,{display:'block',left:cx+'px',top:y+'px'});tag.classList.toggle('is-below',below);
    if(below)tagBottom=Math.max(tagBottom,y+38);else tagTop=Math.min(tagTop,y-38);
   }else tag.style.display='none';
   const bw=bubble.offsetWidth,bh=bubble.offsetHeight;
   let top=tagBottom+14;
   if(top+bh>vh-12)top=Math.max(12,tagTop-14-bh);
   if(top<r.bottom&&top+bh>r.top&&r.height>vh*.45)top=Math.max(12,vh-bh-110); // tall targets (the island): park the bubble low
   let left=Math.min(Math.max(12,r.left+r.width/2-bw/2),vw-bw-12);
   Object.assign(bubble.style,{top:top+'px',left:left+'px',transform:'none'});
   layer.classList.remove('is-free');hole.classList.toggle('is-act',!!s.until);
  }else{hole.style.display='none';tag.style.display='none';Object.assign(bubble.style,{top:'50%',left:'50%',transform:'translate(-50%,-50%)'});layer.classList.add('is-free')}
  raf=requestAnimationFrame(place);
 }
 function show(){
  const s=steps[i];clearTimeout(missTimer);
  // A step that only makes sense after another one (擦掉 after 落墨) is skipped when that one was skipped.
  if(s.after&&skipped.has(s.after)){skipped.add(s.id);advance();return}
  try{s.enter?.()}catch{}
  onStep(s,i);
  const inChapter=steps.filter(x=>(x.chapter||'')===(s.chapter||'')),pos=inChapter.indexOf(s)+1,ci=chapters.indexOf(s.chapter||'');
  const last=ci===chapters.length-1;
  bubble.innerHTML='<div class="tour-head"><img src="'+face(s.face||4)+'" alt="" width="40" height="40"><span><b>'+esc(s.chapter||'新手任务')+'</b> · '+pos+'/'+inChapter.length+'</span>'+
   '<span class="tour-dots" aria-hidden="true">'+chapters.map((c,k)=>'<i class="'+(k<ci?'done':k===ci?'now':'')+'"></i>').join('')+'</span></div>'+
   '<p class="tour-text">'+esc(s.text)+'</p>'+(s.hint?'<p class="tour-hint">'+esc(s.hint)+'</p>':'')+
   '<div class="tour-actions"><span class="tour-skips"><button type="button" class="tour-skip" data-tour="skip">跳过教学</button>'+(last?'':'<button type="button" class="tour-skip" data-tour="chapter">跳过本章</button>')+'</span>'+
   (s.action?'<button type="button" class="ghost-btn" data-tour="action">'+esc(s.action.label)+'</button>':'')+(s.until?'':'<button type="button" class="ink-btn" data-tour="next">'+esc(s.next||'下一步')+'</button>')+'</div>';
  bubble.classList.remove('is-in');void bubble.offsetWidth;bubble.classList.add('is-in');
  hole.classList.remove('is-moved');void hole.offsetWidth;hole.classList.add('is-moved');
  requestAnimationFrame(()=>{const n=target();if(n){const r=n.getBoundingClientRect();if(r.top<80||r.bottom>innerHeight-140)n.scrollIntoView({block:'center',behavior:'instant'})}});
  waiting=s.until||null;
  // Optional steps whose target never appears (e.g. no pencil at night) are skipped instead of stalling.
  if(s.optional)missTimer=setTimeout(()=>{if(active&&steps[i]===s&&waiting===(s.until||null)&&!target()){skipped.add(s.id);advance()}},900);
 }
 function onEvent(e){if(!active||!waiting)return;const type=e.detail?.type,v=e.detail?.value;
  const [want,wantVal]=waiting.split(':');
  // Done: cancel the "target never appeared" check, or it would see the target gone (an inked note vanishes) and skip twice.
  if(type===want&&(!wantVal||String(v)===wantVal)){waiting=null;clearTimeout(missTimer);setTimeout(advance,steps[i].delay??450)}}
 function advance(){i++;if(i>=steps.length){finish('done');return}show()}
 function skipChapter(){const c=steps[i]?.chapter;let j=i;while(j<steps.length&&steps[j].chapter===c)j++;i=j-1;advance()}
 function start(){if(active)return;active=true;skipped.clear();build();document.addEventListener('xy',onEvent);i=-1;advance();raf=requestAnimationFrame(place)}
 function finish(reason){if(!active)return;active=false;clearTimeout(missTimer);cancelAnimationFrame(raf);document.removeEventListener('xy',onEvent);layer?.remove();layer=null;onFinish?.(reason)}
 return {start,finish,isActive:()=>active,step:()=>steps[i]?.id,chapter:()=>steps[i]?.chapter};
}
