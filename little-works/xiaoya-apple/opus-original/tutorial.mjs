// 新手任务 · Learn by doing, in chapters. Each step spotlights one real control and waits for the real action
// (an app event), never a fake click. Non-blocking: the dim layer never intercepts input.
// A step may: prepare the page (enter), offer a helper action, be optional (auto-skipped if its target
// is missing), or just explain (next). Chapters can be skipped one at a time, or the whole tour.
export function createTutorial({esc,face,steps,onFinish,onStep=()=>{}}){
 let i=-1,layer=null,hole=null,bubble=null,raf=0,active=false,waiting=null,missTimer=null;const skipped=new Set();
 const $=s=>document.querySelector(s);
 const chapters=[...new Set(steps.map(s=>s.chapter||''))];
 function build(){
  layer=document.createElement('div');layer.className='tour';layer.innerHTML='<div class="tour-hole"></div><div class="tour-bubble" role="dialog" aria-live="polite"></div>';
  document.body.append(layer);hole=layer.querySelector('.tour-hole');bubble=layer.querySelector('.tour-bubble');
  bubble.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.tour;
   if(k==='skip')finish('skipped');else if(k==='chapter')skipChapter();else if(k==='next')advance();else if(k==='action')steps[i].action?.run()});
 }
 function target(){const s=steps[i];if(!s?.target)return null;for(const sel of s.target.split('|')){const n=$(sel.trim());if(n&&n.getClientRects().length)return n}return null}
 function place(){
  if(!active)return;const s=steps[i],n=target();
  if(n){const r=n.getBoundingClientRect(),pad=s.pad??8;
   Object.assign(hole.style,{display:'block',left:(r.left-pad)+'px',top:(r.top-pad)+'px',width:(r.width+pad*2)+'px',height:(r.height+pad*2)+'px'});
   const bw=bubble.offsetWidth,bh=bubble.offsetHeight,vw=innerWidth,vh=innerHeight;
   let top=r.bottom+pad+14;if(top+bh>vh-12)top=Math.max(12,r.top-pad-14-bh);
   if(top<r.bottom&&top+bh>r.top&&r.height>vh*.45)top=Math.max(12,vh-bh-110); // tall targets (the island): park the bubble low
   let left=Math.min(Math.max(12,r.left+r.width/2-bw/2),vw-bw-12);
   Object.assign(bubble.style,{top:top+'px',left:left+'px',transform:'none'});layer.classList.remove('is-free');
  }else{hole.style.display='none';Object.assign(bubble.style,{top:'50%',left:'50%',transform:'translate(-50%,-50%)'});layer.classList.add('is-free')}
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
  requestAnimationFrame(()=>{const n=target();if(n){const r=n.getBoundingClientRect();if(r.top<80||r.bottom>innerHeight-140)n.scrollIntoView({block:'center',behavior:'instant'})}});
  waiting=s.until||null;
  // Optional steps whose target never appears (e.g. no pencil at night) are skipped instead of stalling.
  if(s.optional)missTimer=setTimeout(()=>{if(active&&steps[i]===s&&!target()){skipped.add(s.id);advance()}},900);
 }
 function onEvent(e){if(!active||!waiting)return;const type=e.detail?.type,val=e.detail?.value;
  const [want,wantVal]=waiting.split(':');if(type===want&&(!wantVal||String(val)===wantVal)){waiting=null;setTimeout(advance,steps[i].delay??450)}}
 function advance(){i++;if(i>=steps.length){finish('done');return}show()}
 function skipChapter(){const c=steps[i]?.chapter;let j=i;while(j<steps.length&&steps[j].chapter===c)j++;i=j-1;advance()}
 function start(){if(active)return;active=true;skipped.clear();build();document.addEventListener('xy',onEvent);i=-1;advance();raf=requestAnimationFrame(place)}
 function finish(reason){if(!active)return;active=false;clearTimeout(missTimer);cancelAnimationFrame(raf);document.removeEventListener('xy',onEvent);layer?.remove();layer=null;onFinish?.(reason)}
 return {start,finish,isActive:()=>active,step:()=>steps[i]?.id,chapter:()=>steps[i]?.chapter};
}
