// 第一次见到 · Contextual first-time tips. Each feature explains itself once, the first time it actually
// appears on the page — never during the guided tour, the opening or an open sheet. The card is small,
// never blocks input (only its close button is clickable) and fades by itself.
// Seen ids are a non-private per-device flag list.
const KEY='xiaoya-opus-original:tips:v1';
export const TIPS=[
 {id:'pencil',sel:'.blk.pencil',text:'虚线框是小芽画的铅笔建议，还没写进日程。点开能看到为什么这样排；落墨才算数。'},
 {id:'attention',sel:'.attention',text:'这个小标记表示今天有需要你看一眼的事：冲突、临近的截止，或者小芽的一条建议。'},
 {id:'free',sel:'.free-band:not(.is-past)',text:'浅色空白带是真正空着的时间。点一下就能放一件事，或者从口袋里拿一件进来。'},
 {id:'ghost',sel:'.blk.ghost|.witem.ghost',text:'划掉的半透明块是「这一次」停掉或调走的课，原来的位置留个痕迹，方便你记得。'},
 {id:'pocket',sel:'.pocket:not(.is-empty)',text:'口袋里是没有截止的小事。有空时点「放进今天」，小芽会帮你找一段空闲。'},
 {id:'week',sel:'#island-slot',scale:'week',text:'这一周折成了生活小岛：每天一根旗杆，旗子的颜色说明忙闲。拖动转岛，点旗子、房子或灯塔都会翻回那张纸。'},
 {id:'line',sel:'.lgrid-scroll',scale:'line',text:'长线只记真实发生的事：每一格是一周，结是你为目标做的一次行动。点目标名可以打卡。'},
 {id:'talk',sel:'#talk:not([hidden]) .talk-log|#talk:not([hidden])',event:'talk-opened',text:'在这里说的话，小芽会记在这台设备上。说「记住……」它会记下来；封底里可以查看、管理或清空。'}
];
export function createTips({esc,face,local=globalThis.localStorage,blocked=()=>false,disabled=false}){
 let seen=new Set(),card=null,timer=0,pending=0,shown=null;
 try{seen=new Set(JSON.parse(local.getItem(KEY)||'[]'))}catch{}
 const save=()=>{try{local.setItem(KEY,JSON.stringify([...seen]))}catch{}};
 const find=sel=>{for(const s of sel.split('|')){const n=document.querySelector(s.trim());if(n&&n.getClientRects().length){const r=n.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight)return n}}return null};
 function hide(){clearTimeout(timer);if(card){const c=card;card=null;c.classList.remove('is-in');setTimeout(()=>c.remove(),260)}shown=null}
 function show(tip,node){
  hide();seen.add(tip.id);save();shown=tip.id;
  card=document.createElement('div');card.className='tip';card.setAttribute('role','status');card.dataset.tip=tip.id;
  card.innerHTML='<img src="'+face(4)+'" alt="" width="28" height="28"><p><b>第一次见到</b>'+esc(tip.text)+'</p><button type="button" class="tip-x" aria-label="知道了">知道了</button>';
  card.querySelector('.tip-x').addEventListener('click',hide);
  document.body.append(card);
  const r=node.getBoundingClientRect(),w=card.offsetWidth,h=card.offsetHeight;
  let top=r.bottom+10;if(top+h>innerHeight-96)top=Math.max(64,r.top-h-10);
  if(r.height>innerHeight*.45)top=Math.min(Math.max(64,r.top+16),innerHeight-h-110);
  const left=Math.min(Math.max(12,r.left+Math.min(r.width,360)/2-w/2),innerWidth-w-12);
  Object.assign(card.style,{top:top+'px',left:left+'px'});
  requestAnimationFrame(()=>card?.classList.add('is-in'));
  timer=setTimeout(hide,9000);
 }
 /** Look for the first unseen tip whose element is on screen now. Called after every render. */
 function check({scale,event}={}){
  if(disabled)return;clearTimeout(pending);
  pending=setTimeout(()=>{
   if(blocked()||(card&&!event))return; // an explicit action (opening the talk) outranks an ambient tip
   for(const t of TIPS){
    if(seen.has(t.id))continue;
    if(event?t.event!==event:t.event)continue;
    if(t.scale&&t.scale!==scale)continue;
    const n=find(t.sel);if(n){show(t,n);return}
   }
  },event?500:1100);
 }
 function reset(){seen=new Set();save()}
 function mark(ids){ids.forEach(id=>seen.add(id));save()}
 return {check,hide,reset,mark,seen:()=>[...seen],shown:()=>shown};
}
