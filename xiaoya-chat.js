// GitHub Pages public companion: temporary browser-only provider credentials.
const q=s=>document.querySelector(s);
let api=null,chat=[];
const STORED_KEY='xiaoya.byok.credential.v1';
const panel=document.createElement('section');panel.id='xiaoya-layer';
panel.innerHTML='<button id="xy-fab" type="button">🌱 和小芽聊天 <small id="xy-state">AI 未接入</small></button><div id="xy-onboard" class="xy-shade" hidden><div class="xy-dialog" role="dialog" aria-modal="true" aria-label="连接小芽"><div class="xy-hero"><span>🌱</span><h2>你好，我是小芽</h2><p>选择体验方式，先把生活整理好。</p><b id="xy-connection">AI 未接入</b></div><div class="xy-content"><button id="xy-local" class="xy-local" type="button"><strong>先用基础功能</strong><span>课表、任务、成长路线与复盘，无需 API →</span></button><h3>连接真实 AI · 开启聊天</h3><p>公开 GitHub Pages 没有模型代理。只能尝试浏览器直连，可能被提供商的 CORS 规则阻止。</p><label>服务商<select id="xy-provider"><option value="zhipu">智谱 GLM（课堂笔记同款）</option><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="siliconflow">硅基流动</option><option value="dashscope">阿里百炼</option><option value="moonshot">Moonshot</option><option value="openrouter">OpenRouter</option><option value="commandcode">CommandCode（需服务商允许网页请求）</option></select></label><label>模型 ID<input id="xy-model" type="text" maxlength="120" placeholder="可按你的实际账户修改"></label><label>API Key（可按下面选项保存到此浏览器）<input id="xy-key" type="password" autocomplete="off" placeholder="仅在你信任的设备上输入"></label><label class="xy-consent"><input id="xy-remember" type="checkbox">记住此浏览器中的 API Key（长期保存，关闭 Edge 后仍可恢复；仅限个人设备）</label><p class="xy-storage-warning">安全提示：密钥将存入此网站在浏览器的本地存储（未额外加密）；本机其他用户、浏览器扩展或同源脚本可能读取。不要在公用设备勾选。</p><button id="xy-forget" type="button">清除已保存的 API Key</button><label class="xy-consent"><input id="xy-consent" type="checkbox">我理解直接请求可能产生费用、遇到跨域限制；不在公共设备上使用 Key。</label><button id="xy-connect" type="button">测试连接 AI</button><p id="xy-feedback" role="status"></p><button id="xy-skip" type="button">暂不接入，进入应用</button></div></div></div><div id="xy-window" hidden><header><span>🌱 小芽</span><strong id="xy-chat-state">AI 未接入</strong><button id="xy-config" type="button" aria-label="配置 AI">⚙</button><button id="xy-close" type="button" aria-label="关闭聊天">×</button></header><div id="xy-messages" role="log" aria-live="polite"></div><div class="xy-chips"><button data-ask="今天先做什么？">今天先做什么</button><button data-ask="如何制定学习计划？">学习计划</button><button data-ask="课表怎么导入？">导入课表</button></div><form id="xy-form"><input id="xy-input" placeholder="和小芽说点什么…" maxlength="700" aria-label="聊天消息"><button type="submit">发送</button></form><footer>未接入时仅本机导航引导；不自动读取私人数据或修改任务。</footer></div>';
document.body.append(panel);
const modal=q('#xy-onboard'),win=q('#xy-window');

// Shared verified provider in this module closure; credentials never enter storage or global objects.
window.addEventListener('xiaoya-ai-plan-request',async e=>{
 const {requestId,input}=e.detail||{};
 try {
  if(!api)throw Error('AI 未接入，请先完成真实模型验证');
  const system='你是大学生学习规划助手。只根据明确授权的目标、基础、周期和时数输出JSON对象。JSON格式：{"summary":"说明","name":"路线名","reason":"理由","risk":"风险","stages":[{"title":"阶段一","action":"行动","deliverable":"证据"},{"title":"阶段二","action":"行动","deliverable":"证据"},{"title":"阶段三","action":"行动","deliverable":"证据"}]}。必须正好3阶段。绝不声称已读取本机课表或执行任务。不得包含Markdown。';
  const r=await fetch(api.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+api.key},body:JSON.stringify({model:api.model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}],max_tokens:1250}),signal:AbortSignal.timeout(68000)});
  if(!r.ok)throw Error('模型HTTP '+r.status);
  const j=await r.json();
  const raw=j.choices?.[0]?.message?.content;
  if(typeof raw!=='string'||!raw.trim())throw Error('模型返回空内容');
  window.dispatchEvent(new CustomEvent('xiaoya-ai-plan-result',{detail:{requestId,ok:true,raw,model:api.model}}));
 }catch(err){window.dispatchEvent(new CustomEvent('xiaoya-ai-plan-result',{detail:{requestId,ok:false,error:err.message}}))}
});

// Optional explicit-consent AI ranking of already validated local rule suggestions.
window.addEventListener('xiaoya-ai-analysis-request',async e=>{
 const {requestId,candidates}=e.detail||{};
 try{
  if(!api)throw Error('先连接真实 AI');
  if(!Array.isArray(candidates)||candidates.length>12)throw Error('建议数量无效');
  const system='你只可以给已经存在的建议排序并提供解释，不可创建新建议、改变动作或执行写入。返回严格JSON：{"rankedIds":["已有ID"],"notes":{"已有ID":{"reason":"理由","uncertainty":"不确定性"}}}。只引用用户提供的ID；不输出Markdown。';
  const r=await fetch(api.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+api.key},body:JSON.stringify({model:api.model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(candidates)}],max_tokens:1100}),signal:AbortSignal.timeout(68000)});
  if(!r.ok)throw Error('模型HTTP '+r.status);
  const j=await r.json(),raw=j.choices?.[0]?.message?.content;
  if(typeof raw!=='string'||!raw.trim())throw Error('模型返回空内容');
  window.dispatchEvent(new CustomEvent('xiaoya-ai-analysis-result',{detail:{requestId,ok:true,raw,model:api.model}}));
 }catch(err){window.dispatchEvent(new CustomEvent('xiaoya-ai-analysis-result',{detail:{requestId,ok:false,error:err.message}}))}
});
// The model lab may send ONE built-in synthetic scenario after the user authorizes it.
window.addEventListener('xiaoya-ai-synthetic-request',async event=>{
 const {requestId,input}=event.detail||{};
 try{
  if(!api)throw Error('请先通过小芽聊天配置并验证真实模型');
  const {getSyntheticCase}=await import('./synthetic-model-cases.js');
  const approvedCase=getSyntheticCase(input?.id);
  if(!approvedCase)throw Error('只允许三个内置合成案例');
  const system='你是大学生合成情境规划实验助手。所有输入为虚构数据。仅返回严格JSON对象，无Markdown。格式：{"summary":"文字","milestones":[{"week":1,"title":"阶段名称","hours":1,"reason":"理由","deliverable":"证据"}],"risks":[],"assumptions":[]}。阶段2至4个，week严格递增且不超过周期，hours大于零且不超过每周预算。考试周对应阶段每周额外时数最多2小时。不能假称已经执行、已读取个人数据或保证成绩。';
  const payload={goal:approvedCase.goal,baseline:approvedCase.baseline,weeks:approvedCase.weeks,weeklyHours:approvedCase.weeklyHours,examWeek:approvedCase.examWeek,constraints:approvedCase.constraints};
  const response=await fetch(api.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+api.key},
    body:JSON.stringify({model:api.model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(payload)}],max_tokens:1150}),
    signal:AbortSignal.timeout(80000)});
  if(!response.ok)throw Error('模型请求 HTTP '+response.status);
  const v=await response.json(),raw=v.choices?.[0]?.message?.content;
  if(typeof raw!=='string'||!raw.trim()||raw.length>18000)throw Error('模型回答为空或过长');
  window.dispatchEvent(new CustomEvent('xiaoya-ai-synthetic-result',{detail:{requestId,ok:true,raw,model:api.model}}));
 }catch(error){window.dispatchEvent(new CustomEvent('xiaoya-ai-synthetic-result',{detail:{requestId,ok:false,error:error.message}}))}
});
const providers={
 zhipu:['https://open.bigmodel.cn/api/paas/v4/chat/completions','glm-4-flash'],
 deepseek:['https://api.deepseek.com/chat/completions','deepseek-chat'],
 openai:['https://api.openai.com/v1/chat/completions','gpt-4o-mini'],
 siliconflow:['https://api.siliconflow.cn/v1/chat/completions',''],
 dashscope:['https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions','qwen-plus'],
 moonshot:['https://api.moonshot.cn/v1/chat/completions','moonshot-v1-8k'],
 openrouter:['https://openrouter.ai/api/v1/chat/completions',''],
 commandcode:['https://api.commandcode.ai/provider/v1/chat/completions','deepseek/deepseek-v4.1-flash']
};
function updateModelPreset(){const id=q('#xy-provider').value,p=providers[id];if(p)q('#xy-model').value=p[1];if(q('#xy-feedback'))q('#xy-feedback').textContent=id==='zhipu'?'提示：本次 Pages 预检中 GLM 未返回跨域许可头；如果连接失败，请换用其他服务商。':''}
q('#xy-provider').addEventListener('change',updateModelPreset);
q('#xy-provider').value='deepseek';updateModelPreset();
function savedCredential(){
 try{
  const item=JSON.parse(localStorage.getItem(STORED_KEY)||'null');
  if(!item||typeof item!=='object'||typeof item.key!=='string'||!item.key||
     item.key.length>500||!Object.hasOwn(providers,item.provider)||
     typeof item.model!=='string'||!item.model.trim()||item.model.length>120)return null;
  return item;
 }catch{return null}
}
function fillStored(){
 const saved=savedCredential();
 if(!saved)return false;
 q('#xy-provider').value=saved.provider;
 q('#xy-model').value=saved.model;
 q('#xy-key').value=saved.key;
 q('#xy-remember').checked=true;
 q('#xy-feedback').textContent='已恢复当前浏览器保存的模型配置；请点击“测试连接 AI”，验证后即可使用。';
 return true;
}
q('#xy-forget').onclick=()=>{
 try{localStorage.removeItem(STORED_KEY)}catch{}
 q('#xy-remember').checked=false;q('#xy-key').value='';
 api=null;chat=[];status();
 window.dispatchEvent(new CustomEvent('xiaoya-ai-capability',{detail:{connected:false}}));
 q('#xy-feedback').textContent='已清除本浏览器保存的 Key，并断开当前模型会话。';
};
function status(){document.body.dataset.aiMode=api?'verified':'offline';const t=api?'AI 已接入':'AI 未接入';for(const id of ['#xy-state','#xy-connection','#xy-chat-state','#ai-global-title'])if(q(id))q(id).textContent=t;if(q('#ai-global-subtitle'))q('#ai-global-subtitle').textContent=api?api.model:'点击配置';for(const x of document.querySelectorAll('[data-ai-capability-state]')){x.textContent=t;x.dataset.mode=api?'verified':'offline'}}
function open(){modal.hidden=false;q('#xy-key').value=api?.key||'';q('#xy-feedback').textContent='';if(!api)fillStored()}
function close(){modal.hidden=true;sessionStorage.setItem('xiaoya-onboard-v2','seen')}
q('#xy-local').onclick=close;q('#xy-skip').onclick=close;q('#xy-config').onclick=open;
q('#xy-fab').onclick=()=>{win.hidden=false;if(!q('#xy-messages').children.length)reply(api?'AI 已接入。你想聊什么？':'你好！当前 AI 未接入，我可以帮助你找到课表、待办和规则规划；开放式 AI 聊天需要先连接模型。');q('#xy-input').focus()};
q('#xy-close').onclick=()=>win.hidden=true;
function reply(t,who='bot'){const e=document.createElement('div');e.className='xy-message '+who;e.textContent=t;q('#xy-messages').append(e);e.scrollIntoView({block:'end'});return e}
function localAnswer(s){if(/课程|课表|上课/.test(s))return '你可以点击“课表”，添加课程或导入 CSV/ICS。当前属于本机引导，不是 AI 推理。';if(/安排|今天|任务|DDL/.test(s))return '打开“今天”查看待办概况，也能在“事项”中新建任务。我不会假称读取了你的记录。';if(/学习|成长|目标/.test(s))return '进入“成长”填写目标、周期及每周预算，再选择免费的规则路线。需要开放式讨论可以配置 AI。';return '目前 AI 未接入。小芽可以引导你使用基础功能，真实 AI 对话需连接模型。'}
q('#xy-connect').onclick=async()=>{
const key=q('#xy-key').value.trim();if(!key||!q('#xy-consent').checked){q('#xy-feedback').textContent='请填写 Key 并确认风险说明。';return}
const [url,defaultModel]=providers[q('#xy-provider').value];const model=q('#xy-model').value.trim()||defaultModel;if(!model||model.length>120){q('#xy-feedback').textContent='请输入有效模型 ID';return}q('#xy-connect').disabled=true;q('#xy-feedback').textContent='正在验证模型…';
try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,messages:[{role:'user',content:'Say OK'}],max_tokens:20}),signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!data.choices?.[0]?.message?.content)throw Error('模型返回无效');api={url,model,key};chat=[];status();
 let persisted=false;
 try{
  if(q('#xy-remember').checked){
   localStorage.setItem(STORED_KEY,JSON.stringify({provider:q('#xy-provider').value,model,key,savedAt:new Date().toISOString()}));
   persisted=true;
  }else{localStorage.removeItem(STORED_KEY)}
 }catch{q('#xy-remember').checked=false}
 window.dispatchEvent(new CustomEvent('xiaoya-ai-capability',{detail:{connected:true,model}}));
 close();win.hidden=false;
 reply('AI 已接入。'+(persisted?'已保存到当前浏览器；下次打开可一键验证恢复。':'密钥未持久保存；关闭标签页后需要重新输入。')+' 仅发送此次明确授权的请求。')}catch(e){api=null;status();window.dispatchEvent(new CustomEvent('xiaoya-ai-capability',{detail:{connected:false}}));q('#xy-feedback').textContent=e instanceof TypeError?'跨域请求被限制（CORS）。GitHub Pages 没有安全模型代理，不能在此完成连接。':'未接入：'+e.message}finally{q('#xy-key').value='';q('#xy-connect').disabled=false}
};
q('#xy-form').onsubmit=async e=>{e.preventDefault();const input=q('#xy-input').value.trim();if(!input)return;q('#xy-input').value='';reply(input,'user');if(!api){reply(localAnswer(input));return}const pending=reply('思考中…');try{const messages=[{role:'system',content:'你是小芽，一个简洁、亲切、务实的大学生生活和学习助手。不要声称读取了用户的本地档案或执行了任何操作。'},...chat.slice(-10),{role:'user',content:input}];const r=await fetch(api.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+api.key},body:JSON.stringify({model:api.model,messages,max_tokens:700}),signal:AbortSignal.timeout(35000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();const answer=j.choices?.[0]?.message?.content;if(!answer)throw Error('无回复');pending.textContent=answer;chat.push({role:'user',content:input},{role:'assistant',content:answer})}catch(e){pending.textContent='AI 请求失败：'+e.message+'。你仍可使用本机功能。'}};
document.querySelectorAll('[data-ask]').forEach(e=>e.onclick=()=>{q('#xy-input').value=e.dataset.ask;q('#xy-form').requestSubmit()});
for(const sel of ['#ai-global-entry','#ai-goals-banner-action','#ai-mode-connect','#ai-today-connect','#growth-ai-config-link']){const el=q(sel);if(!el)continue;el.disabled=false;el.removeAttribute('aria-disabled');el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open()},true)}
status();setTimeout(open,350);window.addEventListener('pagehide',()=>{api=null;chat=[]});
