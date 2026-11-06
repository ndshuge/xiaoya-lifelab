// 开场 · A game-like opening: the book opens, the paper island pops up, Xiaoya introduces herself,
// asks (optionally) who you are, and offers the guided tour. Skippable at every moment.
const wait=ms=>new Promise(r=>setTimeout(r,ms));

export function createIntro({esc,faces,createIsland,islandModel,reduced,onDone}){
 let overlay=null,island=null,skipped=false,typing=null;
 function el(html){const d=document.createElement('div');d.innerHTML=html.trim();return d.firstElementChild}
 async function type(node,text){
  node.textContent='';if(reduced()||skipped){node.textContent=text;return}
  const chars=[...text];let i=0;
  await new Promise(res=>{typing={finish(){i=chars.length;node.textContent=text;res()}};
   const step=()=>{if(skipped||i>=chars.length){node.textContent=text;typing=null;res();return}node.textContent+=chars[i++];setTimeout(step,i<2?40:28)};step()});
 }
 function box(){return overlay.querySelector('.intro-dialog')}
 async function say(text,{face=4,choices=null,form=null}={}){
  const d=box();d.hidden=false;d.querySelector('.intro-face').src=faces[face];
  const t=d.querySelector('.intro-text'),actions=d.querySelector('.intro-actions'),f=d.querySelector('.intro-form');
  actions.innerHTML='';f.innerHTML='';f.hidden=true;
  await type(t,text);
  if(form){f.innerHTML=form;f.hidden=false;f.querySelector('input')?.focus({preventScroll:true})}
  const list=choices||[{label:'继续',value:'next',primary:true}];
  actions.innerHTML=list.map((c,i)=>'<button type="button" class="'+(c.primary?'ink-btn':'ghost-btn')+'" data-intro-choice="'+i+'">'+esc(c.label)+'</button>').join('');
  actions.querySelector('.ink-btn,button')?.focus({preventScroll:true});
  return new Promise(res=>{actions.onclick=e=>{const b=e.target.closest('[data-intro-choice]');if(!b)return;const c=list[Number(b.dataset.introChoice)];
   res({value:c.value,form:f.hidden?null:Object.fromEntries(new FormData(f))})}});
 }
 function close(result){
  if(!overlay)return;skipped=true;typing?.finish?.();
  overlay.classList.add('is-leaving');
  const o=overlay;overlay=null;
  setTimeout(()=>{island?.dispose();island=null;o.remove();document.body.classList.remove('intro-open')},reduced()?0:420);
  onDone(result);
 }
 async function play({profile=null}={}){
  skipped=false;document.body.classList.add('intro-open');
  overlay=el('<div class="intro" role="dialog" aria-modal="true" aria-label="小芽开场">'+
   '<div class="intro-stage"></div>'+
   '<button type="button" class="intro-skip" data-intro-skip>跳过</button>'+
   '<div class="intro-dialog" hidden><img class="intro-face" alt="" width="132" height="132"><div class="intro-body"><strong class="intro-name">小芽</strong><p class="intro-text" aria-live="polite"></p>'+
   '<form class="intro-form" hidden onsubmit="return false"></form><div class="intro-actions"></div></div></div></div>');
  document.body.append(overlay);
  overlay.querySelector('[data-intro-skip]').onclick=()=>close({choice:'skip'});
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close({choice:'skip'});if((e.key==='Enter'||e.key===' ')&&typing&&!e.target.closest('input')){e.preventDefault();typing.finish()}});
  overlay.addEventListener('click',e=>{if(typing&&e.target.closest('.intro-text'))typing.finish()});
  const stage=overlay.querySelector('.intro-stage');
  try{island=createIsland(stage,{reduced,faces,onPick:p=>{if(p.kind==='xiaoya')island?.celebrate()}})}catch{island=null}
  if(island){island.update(islandModel());await island.playOpening()}else{await wait(300)}
  if(!overlay)return;
  await say('你好，我是小芽。');if(!overlay)return;
  await say('我会住在你的时间里：帮你把要做的事排进日子，陪你记下心情，也陪你看看自己慢慢长成的样子。',{face:5});if(!overlay)return;
  const who=await say('先认识一下？这些只存在你的设备上，不想填也没关系。',{face:3,
   form:'<label>怎么称呼你<input name="name" maxlength="24" autocomplete="nickname" value="'+esc(profile?.name||'')+'"></label><label>学校<input name="school" maxlength="40" value="'+esc(profile?.school||'')+'" placeholder="例如：西安交通大学"></label><label>专业<input name="major" maxlength="40" value="'+esc(profile?.major||'')+'" placeholder="例如：电气工程"></label>',
   choices:[{label:'先跳过',value:'skip'},{label:'好了',value:'ok',primary:true}]});
  if(!overlay)return;
  const name=who.value==='ok'?String(who.form?.name||'').trim():'';
  await say((name?name+'，':'')+'记住一件事就好：我画的都是铅笔，你点头「落墨」才算数；落下的墨，也随时能擦掉。',{face:4});if(!overlay)return;
  const go=await say('要我带你走一圈吗？大概一分钟，用演示档案，不碰你的记录。',{face:5,choices:[
   {label:'直接开始我的生活',value:'personal'},{label:'随便逛逛演示',value:'demo'},{label:'带我走一圈',value:'tour',primary:true}]});
  close({choice:go.value,profile:who.value==='ok'?who.form:null});
 }
 return {play,close,isOpen:()=>!!overlay};
}
