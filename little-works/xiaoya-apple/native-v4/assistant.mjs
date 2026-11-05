import {springTranslations} from './physical-spring.mjs';
// Native V3 companion. Reintroduces the mature edition's BYOK chat and assistant actions
// without its floating overlay, forced onboarding, or persistent API credentials.
const providers=Object.freeze({
 deepseek:{name:'DeepSeek',url:'https://api.deepseek.com/chat/completions',model:'deepseek-chat'},
 zhipu:{name:'智谱 GLM',url:'https://open.bigmodel.cn/api/paas/v4/chat/completions',model:'glm-4-flash'},
 openai:{name:'OpenAI',url:'https://api.openai.com/v1/chat/completions',model:'gpt-4o-mini'},
 dashscope:{name:'阿里百炼',url:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',model:'qwen-plus'},
 siliconflow:{name:'硅基流动',url:'https://api.siliconflow.cn/v1/chat/completions',model:''},
 moonshot:{name:'Moonshot',url:'https://api.moonshot.cn/v1/chat/completions',model:'moonshot-v1-8k'},
 openrouter:{name:'OpenRouter',url:'https://openrouter.ai/api/v1/chat/completions',model:''}
});
const $=s=>document.querySelector(s);
function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e}
function safeDate(d){const x=new Date(d);return Number.isFinite(+x)?x.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}):'待定'}
function earliest(list){return [...list].sort((a,b)=>(a.due?Date.parse(a.due):Infinity)-(b.due?Date.parse(b.due):Infinity))}
export function offlineAnswer(question,d){
 const s=String(question||''),tasks=earliest((d?.tasks||[]).filter(t=>!t.done)),goals=(d?.goals||[]).filter(g=>!g.done);
 if(/日记|心情|情绪|难过|压力|焦虑/.test(s))return '想记下今天的感受，可以先用“手记与复盘”回顾行动。日记和心情追踪还在升级中；你也可以在这里聊聊，但当前只是本地规则回复。';
 if(/目标|成长|规划|学习计划|习惯/.test(s)){
  if(goals.length)return '你有 '+goals.length+' 个进行中的目标，例如「'+String(goals[0].title).slice(0,45)+'」。可以打开“成长目标”，记录真实行动并查看复盘；完整路线规划也可以从经典版进入。';
  return '先在“成长目标”里设定一个具体目标和每周行动次数。你也可以使用经典版的成长路线规划。当前是本地规则引导，没有调用 AI。';
 }
 if(/课表|课程|上课|日历/.test(s))return '可以去“日历”查看课程和活动，并导入 CSV/ICS 课表。这里只根据你明确的问题提供导航，没有推测未记录的课程。';
 if(/任务|今天|安排|DDL|截止|待办|先做/.test(s)){
  if(tasks.length)return '按当前'+(d?._synthetic?'演示':'浏览器')+'档案，还有 '+tasks.length+' 项待办。可以先处理「'+String(tasks[0].title).slice(0,55)+'」'+(tasks[0].due?'（'+safeDate(tasks[0].due)+' 截止）':'')+'，再看看其他事项。这里只是本地规则建议。';
  return '目前没有未完成的待办。可以在“事项”里新建一件今天要做的事。当前是本地规则回复。';
 }
 return '我在这里。你可以问我“今天先做什么”“查看成长目标”或“导入课表”。现在用的是本地规则助手；如需开放式 AI 对话，可以点击右上角“连接 AI”自行验证模型。';
}
export function createAssistant({getData,getMode,navigate,getAgentReply=null}){
 let api=null,history=[],busy=false;
 const panel=node('section','assistant-panel');panel.id='xiaoya-assistant';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-label','与小芽对话');panel.setAttribute('aria-modal','false');
 panel.innerHTML=`
  <header class="assistant-top">
   <button type="button" id="assistant-identity-toggle" class="assistant-identity" aria-label="收起小芽对话"><img src="../assets/brand/xiaoya_hero_v1.webp" width="38" height="38" alt=""><div><strong>小芽</strong><span id="assistant-status" role="status">本地规则 · 未连接 AI</span></div></button>
   <div class="assistant-top-actions"><button id="assistant-config-toggle" class="assistant-icon" type="button" aria-label="连接 AI">连接 AI</button><button id="assistant-close" class="assistant-icon" type="button" aria-label="关闭对话">×</button></div>
  </header>
  <div id="assistant-config" class="assistant-config" hidden>
    <p>真实 AI 需要自备模型 API Key。公开的 GitHub Pages 无安全代理，浏览器直连可能被跨域策略阻止，也可能产生费用。</p>
    <label>服务商<select id="assistant-provider">${Object.entries(providers).map(([k,v])=>'<option value="'+k+'">'+v.name+'</option>').join('')}</select></label>
    <label>模型 ID<input id="assistant-model" maxlength="120" autocomplete="off"></label>
    <label>API Key<input id="assistant-api-key" type="password" autocomplete="off" spellcheck="false"></label>
    <label class="assistant-consent"><input id="assistant-api-consent" type="checkbox"> 我同意本次连接测试会向选择的服务商发送测试消息，并理解可能产生费用。</label>
    <p class="assistant-private">Key 只保留在本标签页内存中，不写入本地存储；对话不会自动携带课表、任务或日记。请勿在公用设备输入 Key。</p>
    <div class="assistant-config-actions"><button type="button" id="assistant-verify">测试并连接</button><button type="button" id="assistant-disconnect">断开连接</button></div>
    <p id="assistant-api-feedback" role="status"></p>
  </div>
  <div class="assistant-messages" id="assistant-messages" role="log" aria-live="polite"></div>
  <div class="assistant-shortcuts">
    <button type="button" data-assistant-ask="今天先做什么">今天先做什么</button>
    <button type="button" data-assistant-nav="goals">成长目标</button>
    <button type="button" data-assistant-nav="tasks">我的事项</button>
    <button type="button" data-assistant-nav="review">手记与复盘</button>
  </div>
  <form class="assistant-compose" id="assistant-form"><input id="assistant-input" maxlength="700" autocomplete="off" placeholder="和小芽说点什么…" aria-label="输入聊天消息"><button type="submit" id="assistant-send">发送</button></form>
  <footer id="assistant-footnote">离线时为本地规则引导 · 不自动上传私人档案</footer>`;
 document.body.append(panel);
 const log=$('#assistant-messages'),input=$('#assistant-input'),send=$('#assistant-send');
 const provider=$('#assistant-provider'),model=$('#assistant-model'),key=$('#assistant-api-key'),feedback=$('#assistant-api-feedback');
 provider.value='deepseek';model.value=providers.deepseek.model;
 provider.addEventListener('change',()=>{model.value=providers[provider.value]?.model||'';feedback.textContent=''});
 function addMessage(message,kind='bot'){const n=node('div','assistant-message '+kind,String(message));log.append(n);log.scrollTop=log.scrollHeight;return n}
 function status(){const label=api?'AI 已连接 · '+api.model:'本地规则 · 未连接 AI';$('#assistant-status').textContent=label;$('#assistant-footnote').textContent=api?'仅发送你在对话框中输入的内容 · 不自动读取私人档案':'离线时为本地规则引导 · 不自动上传私人档案'}
 let panelMotion=null,panelCloseTimer=null,panelEnterTimer=null,lastTrigger=null,lastOffset=-720,closing=false;
 const motionDisabled=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!!getData()?.settings?.reducedMotion;
 const cancelMotion=()=>{clearTimeout(panelEnterTimer);panelEnterTimer=null;if(panelMotion){panelMotion.onfinish=null;panelMotion.cancel();panelMotion=null}};
 function finishClose(){
   clearTimeout(panelCloseTimer);panelCloseTimer=null;
   closing=false;panel.hidden=true;panel.style.pointerEvents='';
   document.body.classList.remove('assistant-is-open');
   if(lastTrigger?.isConnected)lastTrigger.focus({preventScroll:true});
 }
 function open(source){
   clearTimeout(panelCloseTimer);panelCloseTimer=null;
   const wasHidden=panel.hidden;
   if(wasHidden)lastTrigger=source instanceof HTMLElement?source:(document.activeElement instanceof HTMLElement?document.activeElement:null);
   const prior=wasHidden?null:new DOMMatrixReadOnly(getComputedStyle(panel).transform);
   const offset=prior?prior.m42:0;
   cancelMotion();closing=false;panel.hidden=false;panel.style.pointerEvents='';
   document.body.classList.add('assistant-is-open');
   // Offscreen origin is computed from settled geometry, even mid-reversal.
   lastOffset=-Math.ceil(panel.getBoundingClientRect().bottom-offset+12);
   if(!motionDisabled()&&typeof panel.animate==='function'){
     const duration=780;
     panelMotion=panel.animate(springTranslations(wasHidden?lastOffset:offset,0,{
       duration,response:.58,damping:.76,axis:'y'
     }),{duration,easing:'linear',fill:'both'});
     const current=panelMotion;
     const finish=()=>{if(panelMotion===current)cancelMotion()};
     current.onfinish=finish;panelEnterTimer=setTimeout(finish,duration+110);
   }
   if(!log.children.length)addMessage('你好，我是小芽。可以和我聊聊今天的安排，也可以从下面进入目标、任务和复盘。');
   // iPhone keyboard interrupts the top entrance; user taps the composer when ready.
   if(matchMedia('(pointer:fine)').matches)input.focus({preventScroll:true});
 }
 function close(){
   if(panel.hidden||closing)return;
   const current=new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42;
   cancelMotion();
   if(motionDisabled()||typeof panel.animate!=='function'){finishClose();return}
   closing=true;panel.style.pointerEvents='none';
   const duration=610;
   panelMotion=panel.animate(springTranslations(current,lastOffset,{
     duration,response:.48,damping:.93,axis:'y'
   }),{duration,easing:'linear',fill:'both'});
   const currentMotion=panelMotion;
   const finish=()=>{if(panelMotion===currentMotion){cancelMotion();finishClose()}};
   currentMotion.onfinish=finish;
   panelCloseTimer=setTimeout(finish,duration+100);
 }
 function toggle(source){
   if(closing){open(source);return}
   if(panel.hidden)open(source);
   else close();
 }
 let configMotion=null,configToken=0,configTimer=null;
 function toggleConfig(){
   if(panel.hidden)open();
   const cfg=$('#assistant-config');const closing=!cfg.hidden;
   ++configToken;const token=configToken;
   clearTimeout(configTimer);configTimer=null;
   if(configMotion){configMotion.onfinish=null;configMotion.cancel();configMotion=null}
   if(!closing)cfg.hidden=false;
   if(motionDisabled()||typeof cfg.animate!=='function'){cfg.hidden=closing;cfg.style.removeProperty('overflow');return}
   const h=Math.max(0,cfg.scrollHeight);
   cfg.style.overflow='hidden';
   configMotion=cfg.animate(closing?
      [{height:h+'px',opacity:1,transform:'translateY(0)'},{height:'0px',opacity:0,transform:'translateY(-9px)'}]:
      [{height:'0px',opacity:0,transform:'translateY(-9px)'},{height:h+'px',opacity:1,transform:'translateY(0)'}],
     {duration:300,easing:'cubic-bezier(.22,.8,.25,1)',fill:'both'});
   const animation=configMotion;
   const settle=()=>{if(configToken!==token)return;
      clearTimeout(configTimer);configTimer=null;
      configMotion=null;animation.onfinish=null;animation.cancel();
      cfg.hidden=closing;cfg.style.removeProperty('overflow')};
   animation.onfinish=settle;
   configTimer=setTimeout(settle,365);
 }
 $('#assistant-close').addEventListener('click',close);
 $('#assistant-identity-toggle').addEventListener('click',close);
 $('#assistant-config-toggle').addEventListener('click',toggleConfig);
 panel.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.assistantNav){navigate(b.dataset.assistantNav);close()}
  else if(b.dataset.assistantAsk){input.value=b.dataset.assistantAsk;$('#assistant-form').requestSubmit()}
 });
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){if(!$('#assistant-config').hidden)$('#assistant-config').hidden=true;else close()}});
 $('#assistant-disconnect').addEventListener('click',()=>{api=null;history=[];key.value='';status();feedback.textContent='已断开当前模型，Key 已从会话中清除。'});
 $('#assistant-verify').addEventListener('click',async()=>{
  const token=key.value.trim(),entry=providers[provider.value],id=model.value.trim();
  if(!entry||!token||!id||id.length>120){feedback.textContent='请输入有效的服务商、模型 ID 和 API Key。';return}
  if(!$('#assistant-api-consent').checked){feedback.textContent='请勾选授权说明后再测试连接。';return}
  const verify=$('#assistant-verify');verify.disabled=true;feedback.textContent='正在测试模型连接…';
  try{
   const r=await fetch(entry.url,{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({model:id,messages:[{role:'user',content:'Say OK'}],max_tokens:20}),signal:AbortSignal.timeout(18000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const result=await r.json();if(typeof result.choices?.[0]?.message?.content!=='string')throw Error('模型没有返回有效内容');
   api={url:entry.url,model:id,key:token};history=[];status();feedback.textContent='AI 已连接。关闭或刷新页面后需要重新连接。';$('#assistant-config').hidden=true;
   addMessage('已通过真实模型连接测试。现在可以直接输入问题；不会自动上传你的任务或日记。');
  }catch(e){api=null;status();feedback.textContent=e instanceof TypeError?'浏览器跨域请求失败（CORS），请更换支持网页直连的服务商。':'连接失败：'+String(e.message).slice(0,120)}
  finally{key.value='';verify.disabled=false}
 });
 $('#assistant-form').addEventListener('submit',async e=>{
  e.preventDefault();const question=input.value.trim();if(!question||busy)return;
  input.value='';addMessage(question,'user');
  if(!api){
   const d=getData(),snapshot={tasks:d.tasks,goals:d.goals,_synthetic:getMode()==='demo'};
   const contextual=typeof getAgentReply==='function'?getAgentReply(question):null;
   addMessage(contextual||offlineAnswer(question,snapshot));return;
  }
  const pending=addMessage('正在思考…');busy=true;send.disabled=true;
  const messages=[{role:'system',content:'你是小芽，一位务实、简洁的大学生生活与学习助手。不声称自动读取用户档案或执行任何操作。不要诊断心理或健康问题。'},...history.slice(-10),{role:'user',content:question}];
  try{
   const r=await fetch(api.url,{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+api.key},body:JSON.stringify({model:api.model,messages,max_tokens:700}),signal:AbortSignal.timeout(35000)});
   if(!r.ok){if(r.status===401||r.status===403){api=null;history=[];status()}throw Error('HTTP '+r.status)}
   const result=await r.json(),answer=result.choices?.[0]?.message?.content;
   if(typeof answer!=='string'||!answer.trim())throw Error('模型没有返回内容');
   pending.textContent=answer.slice(0,12000);
   history.push({role:'user',content:question},{role:'assistant',content:answer.slice(0,12000)});
  }catch(err){pending.textContent='AI 对话失败：'+String(err.message).slice(0,120)+'。可以切换回本地规则引导。'}
  finally{busy=false;send.disabled=false;log.scrollTop=log.scrollHeight}
 });
 window.addEventListener('pagehide',()=>{api=null;history=[];key.value=''});
 return {open,close,toggle,disconnect:()=>{api=null;history=[];status()},isOpen:()=>!panel.hidden};
}
