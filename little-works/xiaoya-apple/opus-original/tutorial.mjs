// 新手任务 · Learn by doing. Each step spotlights one real control and waits for the real action
// (an app event), never a fake click. Non-blocking: the dim layer never intercepts input. Skippable.
export function createTutorial({esc,face,steps,onFinish,onStep=()=>{}}){
 let i=-1,layer=null,hole=null,bubble=null,raf=0,active=false,waiting=null;
 const $=s=>document.querySelector(s);
 function build(){
  layer=document.createElement('div');layer.className='tour';layer.innerHTML='<div class="tour-hole"></div><div class="tour-bubble" role="dialog" aria-live="polite"></div>';
  document.body.append(layer);hole=layer.querySelector('.tour-hole');bubble=layer.querySelector('.tour-bubble');
  bubble.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
   if(b.dataset.tour==='skip')finish('skipped');else if(b.dataset.tour==='next')advance();else if(b.dataset.tour==='action')steps[i].action?.run()});
 }
 function target(){const s=steps[i];if(!s?.target)return null;for(const sel of s.target.split('|')){const n=$(sel.trim());if(n&&n.getClientRects().length)return n}return null}
 function place(){
  if(!active)return;const s=steps[i],n=target();
  if(n){const r=n.getBoundingClientRect(),pad=s.pad??8;
   Object.assign(hole.style,{display:'block',left:(r.left-pad)+'px',top:(r.top-pad)+'px',width:(r.width+pad*2)+'px',height:(r.height+pad*2)+'px'});
   const bw=bubble.offsetWidth,bh=bubble.offsetHeight,vw=innerWidth,vh=innerHeight;
   let top=r.bottom+pad+14;if(top+bh>vh-12)top=Math.max(12,r.top-pad-14-bh);
   let left=Math.min(Math.max(12,r.left+r.width/2-bw/2),vw-bw-12);
   Object.assign(bubble.style,{top:top+'px',left:left+'px',transform:'none'});layer.classList.remove('is-free');
  }else{hole.style.display='none';Object.assign(bubble.style,{top:'50%',left:'50%',transform:'translate(-50%,-50%)'});layer.classList.add('is-free')}
  raf=requestAnimationFrame(place);
 }
 function show(){
  const s=steps[i];onStep(s,i);
  bubble.innerHTML='<div class="tour-head"><img src="'+face(s.face||4)+'" alt="" width="40" height="40"><span>新手任务 '+(i+1)+'/'+steps.length+'</span><button type="button" class="tour-skip" data-tour="skip">跳过教学</button></div>'+
   '<p class="tour-text">'+esc(s.text)+'</p>'+(s.hint?'<p class="tour-hint">'+esc(s.hint)+'</p>':'')+
   '<div class="tour-actions">'+(s.action?'<button type="button" class="ghost-btn" data-tour="action">'+esc(s.action.label)+'</button>':'')+(s.until?'':'<button type="button" class="ink-btn" data-tour="next">'+esc(s.next||'下一步')+'</button>')+'</div>';
  bubble.classList.remove('is-in');void bubble.offsetWidth;bubble.classList.add('is-in');
  const n=target();if(n){const r=n.getBoundingClientRect();if(r.top<80||r.bottom>innerHeight-140)n.scrollIntoView({block:'center',behavior:'instant'})}
  waiting=s.until||null;
 }
 function onEvent(e){if(!active||!waiting)return;const type=e.detail?.type,val=e.detail?.value;
  const [want,wantVal]=waiting.split(':');if(type===want&&(!wantVal||String(val)===wantVal)){waiting=null;setTimeout(advance,steps[i].delay??450)}}
 function advance(){i++;if(i>=steps.length){finish('done');return}show()}
 function start(){if(active)return;active=true;build();document.addEventListener('xy',onEvent);i=-1;advance();raf=requestAnimationFrame(place)}
 function finish(reason){if(!active)return;active=false;cancelAnimationFrame(raf);document.removeEventListener('xy',onEvent);layer?.remove();layer=null;onFinish?.(reason)}
 return {start,finish,isActive:()=>active,step:()=>steps[i]?.id};
}
