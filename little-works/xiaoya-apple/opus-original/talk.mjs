// 页边对话 · Margin conversation with Xiaoya.
// Local rule answers by default. A user-supplied model (BYOK) is optional; its key lives only in memory.
// Every model message shows its 信封 (envelope): exactly which records are attached. Journal text is never attachable.
import {buildEnvelope,SCOPES,SYSTEM_PROMPT} from './envelope.mjs';
import {localAnswer} from './page-model.mjs';

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

export function createTalk({esc,getData,getJournal,getContext,getCandidates,getMoodToday,openSheet,closeSheet,whisper,setXiaoya,onChange}){
 const session={model:null,history:[],envelope:new Set(),busy:false,controller:null};
 const panel=$('#talk'),log=$('#talk-log'),envelope=$('#envelope'),status=$('#talk-status');
 let lastTrigger=null;
 function line(kind,html,meta=''){
  const el=document.createElement('div');el.className='msg msg-'+kind;
  el.innerHTML=(kind==='xy'?'<img src="../native-v4/assets/xiaoya-mood-3-hi.webp" alt="" width="26" height="26" class="msg-face">':'')+'<div class="msg-body"><div class="msg-text">'+html+'</div>'+(meta?'<small class="msg-meta">'+meta+'</small>':'')+'</div>';
  log.append(el);log.scrollTop=log.scrollHeight;return el;
 }
 const text=s=>esc(s).replace(/\n/g,'<br>');
 function renderStatus(silent=false){
  status.textContent=session.model?'已连接 '+session.model.providerName+' · '+session.model.model:'本地规则 · 不联网';
  $('.talk-connect').textContent=session.model?'模型设置':'连接模型';
  renderEnvelope();if(!silent)onChange?.();
 }
 function renderEnvelope(){
  if(!session.model){envelope.innerHTML='<p class="env-note">现在用本地规则回答，只读取这台设备上的记录，不发送任何网络请求。</p>';return}
  const mood=getMoodToday();
  const env=buildEnvelope(getData(),[...session.envelope],{now:new Date(),moodToday:mood});
  envelope.innerHTML='<div class="env-head"><span>下一条消息的信封</span><small>'+(env.items.length?'附带 '+env.items.length+' 类记录 · '+env.bytes+' 字节':'只发送你输入的文字')+'</small></div>'+
   '<div class="env-chips" role="group" aria-label="选择本条消息附带的记录">'+SCOPES.map(s=>{
    const disabled=s.key==='mood'&&!Number.isInteger(mood);
    const on=session.envelope.has(s.key)&&!disabled;
    return '<button type="button" class="env-chip'+(s.sensitive?' is-sensitive':'')+'" data-env="'+s.key+'" aria-pressed="'+on+'"'+(disabled?' disabled title="今天还没有保存心情"':'')+'>'+esc(s.label)+'</button>';
   }).join('')+'</div>'+
   (env.items.length?'<details class="env-peek"><summary>看看信封里有什么</summary><pre>'+esc(env.text)+'</pre></details>':'')+
   '<p class="env-note">日记正文永远不会放进信封。信封在每条消息发送后清空，需要时再勾选。</p>';
 }
 function open(source){
  if(!panel.hidden)return;
  lastTrigger=source instanceof HTMLElement?source:document.activeElement;
  panel.hidden=false;document.body.classList.add('talk-open');
  $('#xiaoya').setAttribute('aria-expanded','true');
  if(!log.children.length)line('xy',text('我在页边。问我今天、截止、空档、冲突或目标都可以；我只按你保存的记录回答。'));
  renderEnvelope();onChange?.();
 }
 function close(){
  if(panel.hidden)return;
  panel.hidden=true;document.body.classList.remove('talk-open');
  $('#xiaoya').setAttribute('aria-expanded','false');onChange?.();
  if(lastTrigger?.isConnected)lastTrigger.focus({preventScroll:true});
 }
 const toggle=source=>panel.hidden?open(source):close();
 async function ask(question){
  const q=String(question||'').trim();if(!q)return;
  open();line('me',text(q));
  if(!session.model){
   const answer=localAnswer(q,getData(),{now:new Date(),candidates:getCandidates(),context:getContext(),journal:getJournal()});
   setXiaoya(answer?'nod':'idle');
   if(answer&&typeof answer==='object'){
    line('xy',text(answer.text)+'<ul class="msg-results">'+answer.results.map(r=>'<li><button type="button" data-edit="'+esc(r.kind)+'" data-id="'+esc(r.id)+'">'+esc(r.title)+'<small>'+esc(r.sub)+'</small></button></li>').join('')+'</ul>','本地搜索 · 不包含日记正文');
    return;
   }
   line('xy',text(answer||'这个问题超出了本地规则能可靠回答的范围。连接你自己的模型后可以开放对话；我不会编造答案。'),'本地规则 · 依据这台设备上的记录');
   return;
  }
  if(session.busy){whisper('上一条还在路上');return}
  const env=buildEnvelope(getData(),[...session.envelope],{now:new Date(),moodToday:getMoodToday()});
  const pending=line('xy','<span class="thinking">正在想</span>',env.items.length?'已附带：'+esc(env.items.map(i=>i.label+'（'+i.count+'）').join('、')):'未附带任何记录');
  session.busy=true;setXiaoya('listen');
  const {url,model,key,providerName}=session.model;
  const messages=[{role:'system',content:SYSTEM_PROMPT},...session.history.slice(-8),{role:'user',content:(env.text?env.text+'\n\n':'')+'用户的问题：'+q}];
  session.controller=new AbortController();
  const timer=setTimeout(()=>session.controller?.abort(),35000);
  try{
   const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+key},
    body:JSON.stringify({model,messages,max_tokens:600,temperature:.5}),signal:session.controller.signal});
   if(!r.ok){if(r.status===401||r.status===403){disconnect('密钥被服务商拒绝（HTTP '+r.status+'），已断开');}throw Error('HTTP '+r.status)}
   const json=await r.json();const answer=json?.choices?.[0]?.message?.content;
   if(typeof answer!=='string'||!answer.trim())throw Error('模型没有返回内容');
   pending.querySelector('.msg-text').innerHTML=text(answer.slice(0,6000));
   pending.querySelector('.msg-meta').textContent=providerName+' · '+(env.items.length?'参考了你附带的 '+env.items.length+' 类记录':'没有读取你的记录');
   session.history.push({role:'user',content:q},{role:'assistant',content:answer.slice(0,6000)});
   setXiaoya('nod');
  }catch(e){
   const reason=e.name==='AbortError'?'等待超时（35 秒）':e instanceof TypeError?'浏览器拦截了跨域请求（CORS），这个服务商可能不支持网页直连':String(e.message).slice(0,120);
   pending.querySelector('.msg-text').innerHTML=text('这次没有连上模型：'+reason+'。');
   pending.querySelector('.msg-meta').textContent='没有任何内容被保存；可以重试，或断开后使用本地规则';
   pending.classList.add('is-error');setXiaoya('idle');
  }finally{
   clearTimeout(timer);session.busy=false;session.controller=null;
   session.envelope.clear();renderEnvelope();
  }
 }
 function connectSheet(){
  const current=session.model;
  const options=Object.entries(PROVIDERS).map(([k,v])=>'<option value="'+k+'"'+(current?.providerKey===k?' selected':'')+'>'+esc(v.name)+'</option>').join('');
  openSheet(current?'模型设置':'连接你自己的模型',
   '<p class="sheet-lede">小芽默认完全离线。连接模型后，你可以开放地聊天，也可以在「长线」里让模型从备选路线中挑选。</p>'+
   '<ul class="facts"><li>密钥只存在这个标签页的内存里，刷新或关闭即消失，不写入存储、不进入代码。</li><li>每条消息只发送你输入的文字，以及你在信封里勾选的记录。</li><li>公开网页没有代理服务，部分服务商会被浏览器跨域策略拦截；调用可能产生费用。</li></ul>'+
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
   if(!panel.hidden)line('xy',text('已通过真实连接测试（'+entry.name+' · '+model+'）。之后每条消息只带你在信封里勾选的内容。'));
   return true;
  }catch(e){
   fb.textContent=e.name==='TimeoutError'?'连接超时，请稍后再试。':e instanceof TypeError?'浏览器拦截了跨域请求（CORS）。请换一个支持网页直连的服务商。':'连接失败：'+String(e.message).slice(0,120);
   return false;
  }finally{ok.disabled=false;const k=document.querySelector('#sheet-body input[name=key]');if(k)k.value=''}
 }
 function disconnect(message='已断开，密钥已从内存清除'){
  session.controller?.abort();session.model=null;session.history=[];session.envelope.clear();renderStatus();whisper(message);
 }
 function reset(){if(session.model||session.history.length)disconnect('已切换档案：模型连接与对话已清空');log.innerHTML='';session.envelope.clear();renderEnvelope()}
 envelope.addEventListener('click',e=>{const b=e.target.closest('[data-env]');if(!b)return;const k=b.dataset.env;session.envelope.has(k)?session.envelope.delete(k):session.envelope.add(k);renderEnvelope()});
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-ask]');if(b)ask(b.dataset.ask)});
 document.addEventListener('click',e=>{if(e.target.closest('[data-model-disconnect]')){disconnect();closeSheet()}});
 window.addEventListener('pagehide',()=>{if(session.model){session.model.key=null;session.model=null}});
 renderStatus(true);
 return {open,close,toggle,ask,connectSheet,disconnect,reset,isOpen:()=>!panel.hidden,
  model:()=>session.model?{providerName:session.model.providerName,url:session.model.url,model:session.model.model}:null,
  // A short-lived growth provider sharing the in-memory key; caller must clear() it after use.
  growthCredentials:()=>session.model?{endpoint:session.model.url,model:session.model.model,apiKey:session.model.key}:null,
  refresh:renderEnvelope};
}
