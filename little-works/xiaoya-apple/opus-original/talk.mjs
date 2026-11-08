// 页边对话 · Margin conversation with Xiaoya, the companion agent.
// - Local rules by default (no network). "记住…", "排一下今天" and search all work offline.
// - With a user-supplied model (BYOK, key in memory only), Xiaoya answers by calling tools. Which records she may
//   read is set per category in 「小芽能看到」 (stored consent); every answer shows what she looked at.
// - Anything she proposes to write arrives as pencil draft cards; only the user's 落墨 writes (one erasable step).
// - The conversation itself is kept on this device (memory.chat), per archive, and can be cleared.
import {localAnswer} from './page-model.mjs';
import {runAgent,memoryCommand,isPlanRequest,planDayLocal,draftSummary} from './agent.mjs';
import {CATEGORIES,COMPANION_CONSENT,NO_CONSENT} from './memory.mjs';
import {dateKey} from '../domain.js';

export const PROVIDERS=Object.freeze({
 deepseek:{name:'DeepSeek',url:'https://api.deepseek.com/chat/completions',model:'deepseek-chat'},
 zhipu:{name:'智谱 GLM',url:'https://open.bigmodel.cn/api/paas/v4/chat/completions',model:'glm-4-flash'},
 openai:{name:'OpenAI',url:'https://api.openai.com/v1/chat/completions',model:'gpt-4o-mini'},
 dashscope:{name:'阿里百炼',url:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',model:'qwen-plus'},
 siliconflow:{name:'硅基流动',url:'https://api.siliconflow.cn/v1/chat/completions',model:''},
 moonshot:{name:'Moonshot',url:'https://api.moonshot.cn/v1/chat/completions',model:'moonshot-v1-8k'},
 openrouter:{name:'OpenRouter',url:'https://openrouter.ai/api/v1/chat/completions',model:''}
});
const $=s=>document.querySelector(s);
const HISTORY_SHOWN=30;

export function createTalk({esc,getData,getJournal,getContext,getCandidates,memory,inkDrafts,confirm,openSheet,closeSheet,whisper,setXiaoya,onChange}){
 const session={model:null,history:[],busy:false,controller:null,hydrated:false,drafts:new Map(),inked:new Map()};
 const panel=$('#talk'),log=$('#talk-log'),envelope=$('#envelope'),status=$('#talk-status');
 let lastTrigger=null;
 const text=s=>esc(s).replace(/\n/g,'<br>');
 const append=(el,html)=>{if(!html)return;el.querySelector('.msg-body').insertAdjacentHTML('beforeend',html);log.scrollTop=log.scrollHeight};
 const safe=(fn,fallback)=>{try{return fn()}catch{return fallback}};
 const consent=()=>safe(()=>memory.consent.get(),{...NO_CONSENT});
 function line(kind,html,meta=''){
  const el=document.createElement('div');el.className='msg msg-'+kind;
  el.innerHTML=(kind==='xy'?'<img src="../native-v4/assets/xiaoya-mood-3-hi.webp" alt="" width="26" height="26" class="msg-face">':'')+'<div class="msg-body"><div class="msg-text">'+html+'</div>'+(meta?'<small class="msg-meta">'+meta+'</small>':'')+'</div>';
  log.append(el);log.scrollTop=log.scrollHeight;return el;
 }
 function save(role,t,meta='',trace=null){safe(()=>memory.chat.add({role,text:t,meta,...(trace?{trace}:{})}))}
 function traceHtml(trace){
  if(!trace?.length)return '';
  const looked=[...new Set(trace.filter(t=>!t.blocked&&!/^draft_|^remember$/.test(t.name)).map(t=>t.label))];
  const blocked=trace.filter(t=>t.blocked).length;
  const head=looked.length?'这次查看了：'+looked.join('、'):'这次没有查看你的记录';
  return '<details class="trace"><summary>'+esc(head)+(blocked?' · '+blocked+' 处被拦下':'')+'</summary><ul>'+trace.map(t=>'<li class="'+(t.blocked?'is-blocked':'')+'"><b>'+esc(t.label)+'</b> '+esc(t.note||'')+'</li>').join('')+'</ul></details>';
 }
 function draftsHtml(drafts){
  if(!drafts?.length)return '';
  drafts.forEach(d=>session.drafts.set(d.id,d));
  const group='g'+drafts[0].id;
  return '<div class="draft-cards" data-group="'+group+'" data-ids="'+drafts.map(d=>d.id).join(',')+'">'+drafts.map(d=>{const s=draftSummary(d);
   return '<div class="draft-card" data-draft="'+d.id+'"><span class="dc-kind">✎ '+esc(s.kind)+'</span><b class="dc-title">'+esc(s.title)+'</b><small class="dc-when">'+esc(s.when)+'</small>'+(d.reason?'<small class="dc-why">'+esc(d.reason)+'</small>':'')+
    '<span class="dc-actions"><button type="button" class="ink-btn" data-draft-ink="'+d.id+'">落墨</button><button type="button" class="link" data-draft-drop="'+d.id+'">擦掉铅笔</button></span></div>'}).join('')+
   (drafts.length>1?'<button type="button" class="ghost-btn dc-all" data-draft-ink-all="'+group+'">全部落墨（'+drafts.length+' 笔，可一次擦掉）</button>':'')+'</div>';
 }
 function hydrate(){
  if(session.hydrated)return;session.hydrated=true;
  const past=safe(()=>memory.chat.all(),[]).slice(-HISTORY_SHOWN);
  for(const m of past){const el=line(m.role==='user'?'me':'xy',text(m.text),esc(m.meta||''));el.classList.add('is-past');if(m.trace?.length)append(el,traceHtml(m.trace))}
  if(past.length)log.insertAdjacentHTML('beforeend','<p class="talk-divider"><span>以上是之前的对话 · 只存在这台设备</span></p>');
 }
 function renderStatus(silent=false){
  status.textContent=session.model?'已连接 '+session.model.providerName+' · '+session.model.model:'本地规则 · 不联网';
  $('.talk-connect').textContent=session.model?'模型设置':'连接模型';
  renderEnvelope();if(!silent)onChange?.();
 }
 /** 「小芽能看到」: the standing consent for what a connected model may read, editable right where you talk. */
 function renderEnvelope(){
  const c=consent();const facts=safe(()=>memory.facts.all().length,0);
  const mem='<button type="button" class="link" data-open-memory>小芽记得 '+facts+' 件事</button>';
  if(!session.model){envelope.innerHTML='<p class="env-note">本地规则回答，只读这台设备上的记录，不发送任何网络请求。'+mem+'</p>';return}
  const on=CATEGORIES.filter(k=>c[k.key]).length;
  envelope.innerHTML='<div class="env-head"><span>小芽能看到</span><small>'+(on?on+' 类记录 · 她会按需查询，不会一次全发':'什么都看不到 · 只发送你输入的文字')+'</small></div>'+
   '<div class="env-chips" role="group" aria-label="连接模型时小芽可以查看的记录">'+CATEGORIES.map(k=>'<button type="button" class="env-chip'+(k.sensitive?' is-sensitive':'')+'" data-consent="'+k.key+'" aria-pressed="'+!!c[k.key]+'" title="'+esc(k.hint)+'">'+esc(k.label)+'</button>').join('')+'</div>'+
   '<p class="env-note"><button type="button" class="link" data-consent-companion>陪伴模式（除日记外全部打开）</button> · <button type="button" class="link" data-consent-none>全部关闭</button> · '+mem+'</p>';
 }
 async function toggleConsent(key){
  const c=consent();const next=!c[key];
  if(next&&key==='journal'){
   const ok=await confirm({title:'让小芽读日记正文？',body:'连接模型时，小芽在确有需要时可以读取最近的日记正文，内容会发送给你连接的模型服务商。',facts:['每次读取都会在回答下方写明。','随时可以在这里或封底关掉。'],ok:'允许读取日记',cancel:'不要'});
   if(!ok)return;
  }
  safe(()=>memory.consent.set({...c,[key]:next}));renderEnvelope();
 }
 function open(source){
  if(!panel.hidden)return;
  lastTrigger=source instanceof HTMLElement?source:document.activeElement;
  panel.hidden=false;document.body.classList.add('talk-open');
  $('#xiaoya').setAttribute('aria-expanded','true');
  hydrate();
  if(!log.querySelector('.msg:not(.is-past)')){
   const name=safe(()=>memory.profile.get().name,'');
   line('xy',text((name?name+'，':'')+'我在页边。问我今天、截止、空档或目标；说「记住……」我会记下来；说「排一下今天」我帮你画铅笔。'));
  }
  renderEnvelope();onChange?.();
 }
 function close(){
  if(panel.hidden)return;
  panel.hidden=true;document.body.classList.remove('talk-open');
  $('#xiaoya').setAttribute('aria-expanded','false');onChange?.();
  if(lastTrigger?.isConnected)lastTrigger.focus({preventScroll:true});
 }
 const toggle=source=>panel.hidden?open(source):close();
 /** "记住…" etc. are always handled on-device, model or not. Returns true if handled. */
 function handleMemory(q){
  const cmd=memoryCommand(q);if(!cmd)return false;
  let reply='';
  try{
   if(cmd.op==='add'){memory.facts.add(cmd.text,'user');reply='记住了：「'+cmd.text+'」。只记在这台设备上；点上方「小芽记得…」可以改或删。'}
   else if(cmd.op==='forget'){const hit=memory.facts.all().filter(f=>f.text.includes(cmd.text));hit.forEach(f=>memory.facts.remove(f.id));reply=hit.length?'忘掉了 '+hit.length+' 件和「'+cmd.text+'」有关的事。':'我没有记过和「'+cmd.text+'」有关的事。'}
   else{const all=memory.facts.all();reply=all.length?'我记得这些：\n'+all.slice(-12).map(f=>'· '+f.text).join('\n')+(all.length>12?'\n……还有 '+(all.length-12)+' 件':''):'我还没有记下关于你的事。说「记住……」就好。'}
  }catch(e){reply='这次没能记下：'+e.message}
  line('xy',text(reply),'本机记忆');save('xiaoya',reply,'本机记忆');setXiaoya('nod');renderEnvelope();
  return true;
 }
 async function ask(question){
  const q=String(question||'').trim();if(!q)return;
  open();line('me',text(q));save('user',q);
  if(handleMemory(q))return;
  if(!session.model){
   if(isPlanRequest(q)){
    const drafts=planDayLocal(getData(),dateKey(new Date()),{now:new Date()});
    const reply=drafts.length?'按截止先后，我在今天剩下的空档里画了 '+drafts.length+' 笔铅笔。合适就落墨，不合适擦掉就好。':'今天剩下的时间里没有合适的空档，或者没有待办需要排。';
    const el=line('xy',text(reply),'本地规则 · 依据你的空档和截止');append(el,draftsHtml(drafts));
    save('xiaoya',reply+(drafts.length?'（画了 '+drafts.length+' 笔铅笔）':''),'本地规则');setXiaoya(drafts.length?'happy':'idle');return;
   }
   const answer=localAnswer(q,getData(),{now:new Date(),candidates:getCandidates(),context:getContext(),journal:getJournal(true)});
   setXiaoya(answer?'nod':'idle');
   if(answer&&typeof answer==='object'){
    line('xy',text(answer.text)+'<ul class="msg-results">'+answer.results.map(r=>'<li><button type="button" data-edit="'+esc(r.kind)+'" data-id="'+esc(r.id)+'">'+esc(r.title)+'<small>'+esc(r.sub)+'</small></button></li>').join('')+'</ul>','本地搜索 · 不包含日记正文');
    save('xiaoya',answer.text+' '+answer.results.map(r=>r.title).join('、'),'本地搜索');return;
   }
   const reply=answer||'这个问题超出了本地规则能可靠回答的范围。连接你自己的模型后可以开放对话；我不会编造答案。';
   line('xy',text(reply),'本地规则 · 依据这台设备上的记录');save('xiaoya',reply,'本地规则');
   return;
  }
  if(session.busy){whisper('上一条还在路上');return}
  const pending=line('xy','<span class="thinking">正在想</span>','按需查询你允许的记录');
  session.busy=true;setXiaoya('listen');
  const c=consent();
  const ctx={data:getData(),journal:getJournal(false),consent:c,memory,facts:safe(()=>memory.facts.all(),[]),profile:safe(()=>memory.profile.get(),null),now:new Date()};
  // With 聊天记忆 allowed, earlier conversations (this device) give continuity; otherwise only this session.
  const history=c.chat?safe(()=>memory.chat.all(),[]).slice(0,-1).slice(-12).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text})):session.history.slice(-8);
  session.controller=new AbortController();
  const timer=setTimeout(()=>session.controller?.abort(),45000);
  try{
   const r=await runAgent({question:q,model:session.model,history,ctx,signal:session.controller.signal});
   const meta=session.model.providerName+(r.mode==='plain'?' · 不支持工具，使用已授权摘要':'');
   pending.querySelector('.msg-text').innerHTML=text(r.text);
   pending.querySelector('.msg-meta').textContent=meta;
   append(pending,traceHtml(r.trace)+draftsHtml(r.drafts));
   session.history.push({role:'user',content:q},{role:'assistant',content:r.text});
   save('xiaoya',r.text+(r.drafts.length?'（画了 '+r.drafts.length+' 笔铅笔）':''),meta,r.trace);
   if(r.remembered.length)renderEnvelope();
   setXiaoya(r.drafts.length?'happy':'nod');
  }catch(e){
   if(e.code==='auth')disconnect('密钥被服务商拒绝，已断开');
   const reason=e.name==='AbortError'?'等待超时（45 秒）':e instanceof TypeError?'浏览器拦截了跨域请求（CORS），这个服务商可能不支持网页直连':String(e.message).slice(0,120);
   pending.querySelector('.msg-text').innerHTML=text('这次没有连上模型：'+reason+'。');
   pending.querySelector('.msg-meta').textContent='没有任何内容被保存；可以重试，或断开后使用本地规则';
   pending.classList.add('is-error');setXiaoya('idle');
  }finally{clearTimeout(timer);session.busy=false;session.controller=null;log.scrollTop=log.scrollHeight}
 }
 function settleCards(ids,label){
  for(const id of ids){const card=log.querySelector('[data-draft="'+id+'"]');if(!card)continue;card.classList.add(label==='已落墨'?'is-inked':'is-dropped');card.querySelector('.dc-actions').innerHTML='<small>'+label+'</small>';session.drafts.delete(id)}
  log.querySelectorAll('.draft-cards').forEach(g=>{if(!g.querySelector('[data-draft-ink]'))g.querySelector('.dc-all')?.remove()});
 }
 function inkIds(ids){
  const drafts=ids.map(id=>session.drafts.get(id)).filter(Boolean);if(!drafts.length)return;
  const tx=inkDrafts(drafts);if(!tx)return;
  settleCards(drafts.map(d=>d.id),'已落墨');
  if(typeof tx==='string')session.inked.set(tx,drafts);
 }
 // A later 擦掉 of that transaction turns the cards back into pencil, so the log never claims something is written.
 document.addEventListener('xy',e=>{
  if(e.detail?.type!=='erased')return;const drafts=session.inked.get(e.detail.value);if(!drafts)return;session.inked.delete(e.detail.value);
  for(const d of drafts){const card=log.querySelector('[data-draft="'+d.id+'"]');if(!card)continue;session.drafts.set(d.id,d);card.classList.remove('is-inked');
   card.querySelector('.dc-actions').innerHTML='<button type="button" class="ink-btn" data-draft-ink="'+d.id+'">重新落墨</button><small>已擦掉</small>'}
 });
 /** 小芽记得的事: view / add / edit / forget facts, clear the conversation, see the consent at a glance. */
 function memorySheet(){
  const facts=safe(()=>memory.facts.all(),[]),chats=safe(()=>memory.chat.all().length,0),c=consent();
  openSheet('小芽记得的事',
   '<p class="sheet-lede">这些只存在这台设备的当前档案里。只有在「小芽能看到」里打开「小芽记得的事」，连接模型时她才会带上它们。</p>'+
   (facts.length?'<ul class="facts-list">'+facts.slice().reverse().map(f=>'<li><span>'+esc(f.text)+'<small>'+(f.source==='xiaoya'?'小芽从对话里记下':'你让她记住')+' · '+esc(f.at.slice(0,10))+'</small></span><button type="button" class="link text-danger" data-fact-del="'+esc(f.id)+'">忘掉</button></li>').join('')+'</ul>':'<p class="hint">还没有。可以在下面写一句，或者在对话里说「记住……」。</p>')+
   '<label class="field">让小芽记住<input name="fact" maxlength="200" placeholder="例如：我周三晚上有家教，别排事"></label>'+
   '<section class="cover-sec"><h3>对话记录</h3><p class="hint">共 '+chats+' 条，只存在这台设备。</p><div class="sheet-row wrap"><button type="button" class="text-danger" data-chat-clear'+(chats?'':' disabled')+'>清空对话记录</button></div></section>'+
   '<section class="cover-sec"><h3>连接模型时她能看到</h3><p class="hint">'+(CATEGORIES.filter(k=>c[k.key]).map(k=>k.label).join('、')||'什么都看不到')+'。在页边对话顶部可以逐项开关。</p></section>',
   {ok:'记住',onOk:form=>{const t=String(form.get('fact')||'').trim();if(!t)return true;try{memory.facts.add(t,'user');whisper('记住了');renderEnvelope();setTimeout(memorySheet,0);return true}catch(e){whisper(e.message,null,'error');return false}}});
 }
 function connectSheet(){
  const current=session.model;
  const options=Object.entries(PROVIDERS).map(([k,v])=>'<option value="'+k+'"'+(current?.providerKey===k?' selected':'')+'>'+esc(v.name)+'</option>').join('');
  openSheet(current?'模型设置':'连接你自己的模型',
   '<p class="sheet-lede">小芽默认完全离线。连接模型后，她能开放地聊天、按需查询你允许的记录，并把建议画成铅笔让你落墨。</p>'+
   '<ul class="facts"><li>密钥只存在这个标签页的内存里，刷新或关闭即消失，不写入存储、不进入代码。</li><li>她能查看哪些记录，由页边对话顶部的「小芽能看到」决定；默认什么都看不到。</li><li>公开网页没有代理服务，部分服务商会被浏览器跨域策略拦截；调用可能产生费用。</li></ul>'+
   (current?'<p class="state-ok">当前已连接：'+esc(current.providerName)+' · '+esc(current.model)+'</p>':'')+
   '<label class="field">服务商<select name="provider" id="model-provider">'+options+'</select></label>'+
   '<label class="field">模型 ID<input name="model" id="model-id" maxlength="120" autocomplete="off" spellcheck="false" value="'+esc(current?.model||PROVIDERS.deepseek.model)+'"></label>'+
   '<label class="field">API Key<input name="key" type="password" autocomplete="off" spellcheck="false" placeholder="'+(current?'如需更换请重新输入':'仅保存在内存')+'"></label>'+
   '<label class="check"><input type="checkbox" name="consent"> 我同意发送一条测试消息（“Say OK”）验证连接，并理解可能产生费用。</label>'+
   '<p class="form-error" id="model-feedback" role="status"></p>'+
   (current?'<button type="button" class="text-danger" data-model-disconnect>断开并清除密钥</button>':''),
   {ok:'测试并连接',onOk:connect});
  const p=$('#model-provider'),m=$('#model-id');
  p?.addEventListener('change',()=>{m.value=PROVIDERS[p.value]?.model||''});
 }
 async function connect(form){
  const fb=$('#model-feedback');
  const entry=PROVIDERS[form.get('provider')],model=String(form.get('model')||'').trim(),key=String(form.get('key')||'').trim();
  if(!entry||!model||model.length>120||/[\r\n]/.test(model)){fb.textContent='请选择服务商并填写有效的模型 ID。';return false}
  if(!key){fb.textContent='请填写 API Key。';return false}
  if(!form.get('consent')){fb.textContent='请先勾选测试授权。';return false}
  fb.textContent='正在发送测试消息…';const ok=$('#sheet-ok');ok.disabled=true;
  try{
   const r=await fetch(entry.url,{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+key},
    body:JSON.stringify({model,messages:[{role:'user',content:'Say OK'}],max_tokens:16}),signal:AbortSignal.timeout(18000)});
   if(!r.ok)throw Error(r.status===401||r.status===403?'密钥无效或无权限（HTTP '+r.status+'）':'服务商返回 HTTP '+r.status);
   const j=await r.json();if(typeof j?.choices?.[0]?.message?.content!=='string')throw Error('模型没有返回有效内容');
   session.model={providerKey:form.get('provider'),providerName:entry.name,url:entry.url,model,key};session.history=[];
   renderStatus();whisper('模型已连接。还没有发送任何记录。');
   if(!panel.hidden)line('xy',text('已通过真实连接测试（'+entry.name+' · '+model+'）。我能查看什么，由上方「小芽能看到」决定；每次回答下面都会写明查了什么。'));
   return true;
  }catch(e){
   fb.textContent=e.name==='TimeoutError'?'连接超时，请稍后再试。':e instanceof TypeError?'浏览器拦截了跨域请求（CORS）。请换一个支持网页直连的服务商。':'连接失败：'+String(e.message).slice(0,120);
   return false;
  }finally{ok.disabled=false;const k=document.querySelector('#sheet-body input[name=key]');if(k)k.value=''}
 }
 function disconnect(message='已断开，密钥已从内存清除'){
  session.controller?.abort();session.model=null;session.history=[];renderStatus();whisper(message);
 }
 /** Archive switch: forget the session (model, drafts, rendered log); the next open hydrates from the new archive. */
 function reset(){if(session.model||session.history.length)disconnect('已切换档案：模型连接与对话已清空');log.innerHTML='';session.hydrated=false;session.drafts.clear();renderEnvelope()}
 envelope.addEventListener('click',e=>{
  const b=e.target.closest('[data-consent]');if(b)return toggleConsent(b.dataset.consent);
  if(e.target.closest('[data-consent-companion]')){safe(()=>memory.consent.set({...COMPANION_CONSENT,journal:consent().journal}));renderEnvelope();whisper('陪伴模式已打开：日程、事项、目标、心情分值、聊天与记忆。日记正文仍需单独打开。');return}
  if(e.target.closest('[data-consent-none]')){safe(()=>memory.consent.set({...NO_CONSENT}));renderEnvelope();whisper('已全部关闭：连接模型时小芽只会看到你输入的文字');return}
 });
 panel.addEventListener('click',e=>{
  const b=e.target.closest('[data-ask]');if(b)return ask(b.dataset.ask);
  const ink=e.target.closest('[data-draft-ink]');if(ink)return inkIds([ink.dataset.draftInk]);
  const all=e.target.closest('[data-draft-ink-all]');if(all){const g=log.querySelector('[data-group="'+all.dataset.draftInkAll+'"]');return inkIds((g?.dataset.ids||'').split(',').filter(id=>session.drafts.has(id)))}
  const drop=e.target.closest('[data-draft-drop]');if(drop)return settleCards([drop.dataset.draftDrop],'铅笔已擦掉');
 });
 document.addEventListener('click',async e=>{
  if(e.target.closest('[data-model-disconnect]')){disconnect();closeSheet();return}
  if(e.target.closest('[data-open-memory]')){closeSheet();setTimeout(memorySheet,0);return}
  const del=e.target.closest('[data-fact-del]');if(del){safe(()=>memory.facts.remove(del.dataset.factDel));renderEnvelope();memorySheet();return}
  if(e.target.closest('[data-chat-clear]')){closeSheet();const ok=await confirm({title:'清空和小芽的对话记录？',body:'只清空当前档案在这台设备上的对话；小芽记得的事不受影响。',ok:'清空',cancel:'保留',danger:true});
   if(ok){safe(()=>memory.chat.clear());log.innerHTML='';session.hydrated=true;session.history=[];whisper('对话记录已清空')}}
 });
 window.addEventListener('pagehide',()=>{if(session.model){session.model.key=null;session.model=null}});
 renderStatus(true);
 return {open,close,toggle,ask,connectSheet,memorySheet,disconnect,reset,isOpen:()=>!panel.hidden,
  model:()=>session.model?{providerName:session.model.providerName,url:session.model.url,model:session.model.model}:null,
  // A short-lived growth provider sharing the in-memory key; caller must clear() it after use.
  growthCredentials:()=>session.model?{endpoint:session.model.url,model:session.model.model,apiKey:session.model.key}:null,
  /** One agent turn for the day planner (same model, consent and memory as the conversation). */
  async runPlan(prompt){
   if(!session.model)throw Error('还没有连接模型');
   if(session.busy)throw Error('上一条还在路上');
   session.busy=true;session.controller=new AbortController();const timer=setTimeout(()=>session.controller?.abort(),60000);
   try{
    const c=consent();
    const ctx={data:getData(),journal:getJournal(false),consent:c,memory,facts:safe(()=>memory.facts.all(),[]),profile:safe(()=>memory.profile.get(),null),now:new Date()};
    const r=await runAgent({question:prompt,model:session.model,history:[],ctx,signal:session.controller.signal});
    save('xiaoya','（今日方案）'+r.text+(r.drafts.length?'（画了 '+r.drafts.length+' 笔铅笔）':''),session.model.providerName+' · 今日方案',r.trace);
    return r;
   }catch(e){if(e.code==='auth')disconnect('密钥被服务商拒绝，已断开');throw e.name==='AbortError'?Error('等待超时（60 秒）'):e}
   finally{clearTimeout(timer);session.busy=false;session.controller=null}
  },
  /** Show drafts produced elsewhere (paste extraction, AI 排今天 button) as a Xiaoya message with cards. */
  offerDrafts(drafts,reply,meta='本地规则'){open();const el=line('xy',text(reply),esc(meta));append(el,draftsHtml(drafts));save('xiaoya',reply,meta)},
  refresh:renderEnvelope};
}
