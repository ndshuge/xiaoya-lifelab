import {SYNTHETIC_CASES} from './synthetic-model-cases.js';
import {buildGrowthRoutes} from './growth-simulator.js';
import {makeCodingPlanPrompt,parseCodingPlanText} from './coding-plan-relay.js';
import {buildSyntheticApprovalPreview,approveSyntheticPreview,undoSyntheticApproval} from './synthetic-execution.js';
const $=s=>document.querySelector(s);
const choiceBox=$('#case-choices');
let selected=SYNTHETIC_CASES[0]?.id||null,busy=false,modelReady=false,codingBusy=false,cloudProviders=[];
let codingPlan=null,codingPreview=null,codingSandbox=null;
const node=(tag,content,className='')=>{const el=document.createElement(tag);el.textContent=content;el.className=className;return el};
const add=(root,tag,text,cls)=>root.appendChild(node(tag,text,cls));
function cards(){
 choiceBox.replaceChildren();
 for(const c of SYNTHETIC_CASES){
  const btn=node('button','','case'+(c.id===selected?' active':''));btn.type='button';btn.dataset.caseId=c.id;
  add(btn,'span','合成案例 · '+c.weeks+'周 / 每周'+c.weeklyHours+'小时');
  add(btn,'strong',c.name);add(btn,'small',c.goal);btn.addEventListener('click',()=>{if(busy||codingBusy)return;selected=c.id;cards();showRule();clearModel();resetRelay();resetCoding()});
  choiceBox.appendChild(btn);
 }
}
function showRule(){
 const c=SYNTHETIC_CASES.find(x=>x.id===selected),target=$('#rule-result');target.replaceChildren();
 if(!c)return;
 const p=buildGrowthRoutes({goal:c.goal,baseline:c.baseline,hours:c.weeklyHours,weeks:c.weeks,pendingCount:0});
 add(target,'p','本机规则：'+p.explain,'muted');
 const route=p.routes[0];add(target,'h3',route.name);
 for(const s of route.stages){
  const el=node('section','','milestone');add(el,'span','第'+s.startWeek+'–'+s.endWeek+'周 · 预计'+s.hours+'小时');
  add(el,'strong',s.title);add(el,'p',s.action);target.appendChild(el);
 }
}
function clearModel(){$('#model-result').replaceChildren(node('p','等待Qwen生成真实建议；未调用时不展示虚假结果。','empty'));$('#experiment-evidence').textContent=''}
async function status(){
 modelReady=false;
 $('#model-state').textContent='网页静态版 · 本机 Qwen 不可用';
 $('#run-status').textContent='Pages 已保留合成案例和规则基线；运行 Qwen3 需在本机 Node 环境打开。';
 $('#run-model').disabled=true;
}

async function run(){
 if(busy||!modelReady||!selected)return;
 busy=true;$('#run-model').disabled=true;
 $('#run-status').textContent='本地 Qwen 正在分析虚构情境；可能耗时几十秒，请勿重复提交…';
 $('#model-result').replaceChildren(node('p','推理进行中…正在等待本机模型返回并通过安全校验。','empty'));
 const current=selected;
 try{
  const r=await fetch('/api/local-model/plan',{method:'POST',headers:{'Content-Type':'application/json','X-Xiaoya-Synthetic-Only':'1'},
   body:JSON.stringify({caseId:current})});
  const x=await r.json();
  if(!r.ok||x.mode!=='local-qwen-real'||!x.syntheticOnly||x.cloudUsed!==false||x.privateDataUsed!==false)throw Error(x.error||'模型返回不满足合成实验约束');
  const box=$('#model-result');box.replaceChildren();
  add(box,'p',x.plan.summary,'muted');
  for(const m of x.plan.milestones){
   const e=node('section','','milestone');add(e,'span','第'+m.week+'周 · 建议投入'+m.hours+'小时');
   add(e,'strong',m.title);add(e,'p',m.reason);add(e,'p','阶段成果：'+m.deliverable,'note');box.appendChild(e);
  }
  if(x.plan.risks?.length)add(box,'p','风险：'+x.plan.risks.join('；'),'muted');
  if(x.plan.assumptions?.length)add(box,'p','前提：'+x.plan.assumptions.join('；'),'muted');
  $('#run-status').textContent='本机推理已完成 · '+(x.elapsedMs/1000).toFixed(1)+'秒';
  $('#experiment-evidence').textContent='真实本机模型调用 '+x.modelCalls+' 次 · 云调用0 · 私人数据0 · 自动写入0。结果未添加到实际任务。';
 }catch(e){
  $('#model-result').replaceChildren(node('p','本次推理未通过：'+e.message+'。未写入任务，规则版仍然可用。','empty'));
  $('#run-status').textContent='模型实验未成功，可稍后重试';
  $('#experiment-evidence').textContent='安全降级：未使用未经验证的模型结果，也未写入用户档案。';
 }finally{busy=false;$('#run-model').disabled=!modelReady}
}
$('#refresh-status').addEventListener('click',status);
$('#run-model').addEventListener('click',run);
function resetRelay(){
 $('#relay-json').value='';
 $('#relay-result').replaceChildren(node('p','请先在 HanaAgent 中使用当前虚构案例生成 JSON，再粘贴到这里校验。','empty'));
 $('#relay-status').textContent='等待合成案例输出；尚未调用 Coding Plan。';
 $('#relay-copy-status').textContent='仅复制合成内容，不会自动调用模型。';
}
async function copyRelayPrompt(){
 const value=makeCodingPlanPrompt(selected);
 try{await navigator.clipboard.writeText(value);$('#relay-copy-status').textContent='已复制纯合成提示词；请到 HanaAgent 新对话粘贴并生成 JSON。'}
 catch{
  // Secure clipboard permissions vary across browsers; never use external clipboard helpers.
  $('#relay-json').value=value;
  $('#relay-json').focus();
  $('#relay-json').select();
  $('#relay-copy-status').textContent='浏览器禁止直接复制；已选中合成提示词，请手动复制后清空此框再粘贴模型结果。';
 }
}
function validateRelay(){
 const target=$('#relay-result');target.replaceChildren();
 try{
  const result=parseCodingPlanText($('#relay-json').value,selected);
  add(target,'p',result.plan.summary,'muted');
  for(const m of result.plan.milestones){
   const item=node('section','','milestone');
   add(item,'span','第'+m.week+'周 · 每周建议投入'+m.hours+'小时');
   add(item,'strong',m.title);add(item,'p',m.reason);
   add(item,'p','阶段成果：'+m.deliverable,'note');
   target.appendChild(item);
  }
  if(result.plan.risks.length)add(target,'p','风险：'+result.plan.risks.join('；'),'muted');
  if(result.plan.assumptions.length)add(target,'p','前提：'+result.plan.assumptions.join('；'),'muted');
  $('#relay-status').textContent='格式及预算验证通过 · 仅供审阅 · 尚未执行任何操作';
  $('#relay-copy-status').textContent='输出来源由粘贴者确认；小芽无法自动核验是否为 Coding Plan 生成。';
 }catch(e){
  add(target,'p','未通过校验：'+e.message,'empty');
  $('#relay-status').textContent='校验未通过 · 未保存、未执行';
 }
}
$('#relay-copy').addEventListener('click',copyRelayPrompt);
$('#relay-validate').addEventListener('click',validateRelay);
$('#relay-clear').addEventListener('click',resetRelay);
function resetSandbox(){
 codingPlan=null;codingPreview=null;codingSandbox=null;
 $('#sandbox-preview').disabled=true;$('#sandbox-approve').disabled=true;$('#sandbox-undo').disabled=true;
 $('#sandbox-result').replaceChildren(node('p','尚无可执行的合成计划；不会触碰个人档案。','empty'));
 $('#sandbox-status').textContent='未批准 · 临时任务0 · 私人档案写入0';
}
function sandboxPreview(){
 if(!codingPlan||codingPlan.caseId!==selected)return;
 try{
  codingPreview=buildSyntheticApprovalPreview(selected,codingPlan.plan,{source:codingPlan.provider});
  codingSandbox=null;
  const box=$('#sandbox-result');box.replaceChildren();
  add(box,'p','待批准：仅对以下 '+codingPreview.tasks.length+' 个合成阶段生成临时任务。','muted');
  for(const task of codingPreview.tasks){
   const el=node('section','','milestone');
   add(el,'span','第'+task.week+'周 · '+task.estimatedHours+'小时（非真实日期）');
   add(el,'strong',task.title);add(el,'p','验收成果：'+task.deliverable,'note');
   box.appendChild(el);
  }
  $('#sandbox-approve').disabled=false;$('#sandbox-undo').disabled=true;
  $('#sandbox-status').textContent='待你二次批准 · 计划已复核 · 私人档案写入0';
 }catch(e){
  codingPreview=null;$('#sandbox-approve').disabled=true;
  $('#sandbox-result').replaceChildren(node('p','合成执行预览未通过：'+e.message,'empty'));
  $('#sandbox-status').textContent='沙盒执行门槛未通过 · 零写入';
 }
}
function sandboxApprove(){
 if(!codingPreview||codingPreview.caseId!==selected)return;
 try{
  codingSandbox=approveSyntheticPreview(codingPreview,true);
  const box=$('#sandbox-result');box.replaceChildren();
  add(box,'p','已由你批准，以下 '+codingSandbox.tasks.length+' 个任务存在于此页面临时内存中：','muted');
  for(const task of codingSandbox.tasks){
   const el=node('section','','milestone');
   add(el,'span','第'+task.week+'周 · 合成临时任务');
   add(el,'strong',task.title);add(el,'p',task.deliverable,'note');
   box.appendChild(el);
  }
  $('#sandbox-approve').disabled=true;$('#sandbox-undo').disabled=false;
  $('#sandbox-status').textContent='批准完成 · 临时任务'+codingSandbox.tasks.length+' · 私人档案写入0 · 可撤销';
 }catch(e){$('#sandbox-status').textContent='批准未通过：'+e.message+' · 零写入'}
}
function sandboxUndo(){
 if(!codingSandbox)return;
 try{
  codingSandbox=undoSyntheticApproval(codingSandbox);
  codingPreview=null;
  $('#sandbox-approve').disabled=true;$('#sandbox-undo').disabled=true;
  $('#sandbox-result').replaceChildren(node('p','合成临时任务已全部撤销。你可以重新预览刚才的合法模型计划。','empty'));
  $('#sandbox-status').textContent='撤销完成 · 临时任务0 · 私人档案写入0';
 }catch(e){$('#sandbox-status').textContent='撤销失败：'+e.message}
}
$('#sandbox-preview').addEventListener('click',sandboxPreview);
$('#sandbox-approve').addEventListener('click',sandboxApprove);
$('#sandbox-undo').addEventListener('click',sandboxUndo);
function resetCoding(){
 resetSandbox();
 $('#coding-consent').checked=false;
 $('#coding-result').replaceChildren(node('p','未调用云端模型。当前案例仅为内置虚构大学生示例。','empty'));
 $('#coding-evidence').textContent='';
 $('#coding-status').textContent='仅选择一个虚构案例并显式确认后，才发送一次外部请求。';
 updateCodingButton();
}
function updateCodingButton(){
 const selectedProvider=$('#coding-provider').value;
 const configured=selectedProvider==='browser-byok'&&sharedCloudConnected;
 $('#coding-run').disabled=codingBusy||!configured||!$('#coding-consent').checked||
  (selectedProvider==='opencode-go'&&selected!=='coding-project');
}
let sharedCloudConnected=document.body.dataset.aiMode==='verified',sharedCloudModel=sharedCloudConnected?(document.querySelector('#ai-global-subtitle')?.textContent||'已保存模型'):'';
const selector=$('#coding-provider');
for(const option of selector.options)option.disabled=true;
const webOption=new Option('浏览器自带 Key · 当前模型','browser-byok',true,true);
selector.add(webOption);if(sharedCloudConnected){cloudProviders=[{id:'browser-byok',configured:true}];webOption.text='浏览器 AI · '+sharedCloudModel}
window.addEventListener('xiaoya-ai-capability',event=>{
 sharedCloudConnected=event.detail?.connected===true;
 sharedCloudModel=sharedCloudConnected?String(event.detail.model||'当前模型'):'';
 cloudProviders=sharedCloudConnected?[{id:'browser-byok',configured:true}]:[];
 webOption.text=sharedCloudConnected?'浏览器 AI · '+sharedCloudModel:'浏览器 AI · 请先连接';
 updateCodingButton();
 $('#coding-status').textContent=sharedCloudConnected?
 '已验证模型 '+sharedCloudModel+'；勾选授权后可提交选中的虚构案例。':
 '尚未连接 AI，请点击页面右下角小芽聊天 → 设置，输入模型 Key 并测试';
});
async function codingStatus(){
 cloudProviders=sharedCloudConnected?[{id:'browser-byok',configured:true}]:[];
 $('#coding-status').textContent=sharedCloudConnected?
 '已连接：'+sharedCloudModel+'。不会自动读取私人档案。':
 'GitHub Pages 使用用户自己配置的浏览器模型连接；CommandCode/OpenCode 本机专用接口在公开版不自动启用。';
 updateCodingButton();
}

async function runCoding(){
 if(codingBusy||!sharedCloudConnected||!$('#coding-consent').checked)return;
 codingBusy=true;resetSandbox();updateCodingButton();
 const current=selected;
 $('#coding-status').textContent='用户已授权，正在请求真实模型规划合成案例…';
 $('#coding-result').replaceChildren(node('p','等待模型返回，结果需要先经过本机校验。','empty'));
 $('#coding-evidence').textContent='';
 const scenario=SYNTHETIC_CASES.find(x=>x.id===current);
 try{
  const requestId=crypto.randomUUID();
  const response=await new Promise((resolve,reject)=>{
   let timer;
   const listener=e=>{
    if(e.detail?.requestId!==requestId)return;
    clearTimeout(timer);window.removeEventListener('xiaoya-ai-synthetic-result',listener);
    if(!e.detail.ok){reject(Error(e.detail.error||'模型调用失败'));return}
    resolve(e.detail);
   };
   window.addEventListener('xiaoya-ai-synthetic-result',listener);
   timer=setTimeout(()=>{window.removeEventListener('xiaoya-ai-synthetic-result',listener);reject(Error('模型请求超时'))},85000);
   window.dispatchEvent(new CustomEvent('xiaoya-ai-synthetic-request',{detail:{requestId,input:scenario}}));
  });
  const raw=JSON.parse(response.raw);
  const {validateSyntheticPlan}=await import('./local-model-lab.js');
  const plan=validateSyntheticPlan(raw,scenario);
  const box=$('#coding-result');box.replaceChildren();
  add(box,'p',plan.summary,'muted');
  for(const m of plan.milestones){
   const card=node('section','','milestone');
   add(card,'span','第'+m.week+'周 · 建议投入'+m.hours+'小时');
   add(card,'strong',m.title);add(card,'p',m.reason);
   add(card,'p','可核验成果：'+m.deliverable,'note');box.appendChild(card);
  }
  if(plan.risks.length)add(box,'p','风险：'+plan.risks.join('；'),'muted');
  if(plan.assumptions.length)add(box,'p','前提：'+plan.assumptions.join('；'),'muted');
  codingPlan={caseId:current,provider:'browser-byok',plan};
  $('#sandbox-preview').disabled=false;
  $('#coding-status').textContent='真实模型返回通过结构及学习时间预算校验，请人工预览。';
  $('#coding-evidence').textContent='浏览器临时 BYOK 模型：'+response.model+' · 本次合成案例请求1次 · 私人档案读取0 · 自动写入0。';
 }catch(error){
  $('#coding-result').replaceChildren(node('p','真实模型规划未通过：'+error.message,'empty'));
  $('#coding-status').textContent='模型请求或结果未通过验证；未生成任何任务。';
  $('#coding-evidence').textContent='即使未通过验证，请求仍可能产生模型费用。';
 }finally{codingBusy=false;$('#coding-consent').checked=false;updateCodingButton()}
}
$('#lab-web-connect')?.addEventListener('click',()=>document.querySelector('#xy-config')?.click());
$('#coding-consent').addEventListener('change',updateCodingButton);
$('#coding-provider').addEventListener('change',()=>{resetCoding()});
$('#coding-refresh').addEventListener('click',codingStatus);
$('#coding-run').addEventListener('click',runCoding);
cards();showRule();clearModel();resetRelay();resetCoding();status();codingStatus();
