import {buildGrowthRoutes} from './growth-simulator.js';
// Static Pages: only this browser tab's verified chat session may request AI planning.
// The API key stays private in xiaoya-chat.js closure, never in app data.
const $=s=>document.querySelector(s), put=(id,t)=>{const e=$(id);if(e)e.textContent=t};
const browserSavedModel=()=>{try{const value=JSON.parse(localStorage.getItem('xiaoya.byok.credential.v1')||'null');return value&&typeof value.provider==='string'&&typeof value.model==='string'&&typeof value.key==='string'&&value.key?value.model:null}catch{return null}};
let connected=document.body.dataset.aiMode==='verified'||Boolean(browserSavedModel()),model=connected?(browserSavedModel()||document.querySelector('#ai-global-subtitle')?.textContent||'已保存模型'):'',busy=false;
function refresh(){
 document.body.dataset.aiMode=connected?'verified':'offline';
 const b=$('#growth-ai-generate');
 if(b){b.disabled=busy||(connected&&!$('#growth-ai-consent')?.checked);b.textContent=busy?'正在生成…':connected?'使用 AI 规划':'连接 AI 后规划'}
 const growthStatus=$('#growth-ai-status'),configButton=$('#growth-ai-config-link');
 if(growthStatus&&!busy&&!growthStatus.textContent.startsWith('AI 规划失败'))growthStatus.textContent=connected?($('#growth-ai-consent')?.checked?'本次已授权；生成后仍需你确认。':'模型已连接；勾选授权后即可规划。'):'规则路线无需 API；AI 路线需要连接模型。';
 if(configButton){configButton.hidden=true;configButton.style.display='none';}
 put('#ai-global-title',connected?'AI 已接入':'规则模式');
 put('#ai-global-subtitle',connected?model:'AI 未接入');
 put('#ai-goals-banner-title','让计划从你开始');
 put('#ai-goals-banner-summary','填写目标、基础和时间，再选择规则路线或 AI 建议；只有批准后才保存。');
 put('#ai-ability-cloud-status',connected?'可使用':'需连接');
 put('#ai-mode-headline','规划你的下一步');
 put('#ai-mode-summary','规则规划随时可用；AI 规划需明确授权。');
 put('#ai-mode-cloud-state',connected?'已验证模型':'AI 未接入');
 put('#ai-mode-truth','模型仅接收明确授权的成长目标输入，生成后仍须审核才能写入本地。');
 document.querySelectorAll('[data-ai-capability-state]').forEach(e=>{e.textContent=connected?'AI 已接入':'规则模式';e.dataset.mode=connected?'verified':'offline'});
}
const field=(x,n)=>{if(typeof x!=='string'||!x.trim()||x.length>n)throw Error('AI 输出不符合字段约束');return x.trim()};
function validate(raw,input,usedModel){
 let v;try{v=JSON.parse(raw)}catch{throw Error('模型未返回有效 JSON')}
 if(!v||!Array.isArray(v.stages)||v.stages.length!==3)throw Error('模型必须给出3阶段计划');
 const base=buildGrowthRoutes(input),template=base.routes[0].stages;
 const stages=v.stages.map((s,i)=>({id:'ai-'+i,title:field(s.title,72),action:field(s.action,400),deliverable:field(s.deliverable,180),
  startWeek:template[i].startWeek,endWeek:template[i].endWeek,hours:template[i].hours}));
 return {...base,explain:'真实模型 '+usedModel+' 的建议；时间预算与周段由本机规则控制。'+field(v.summary,500),
  routes:[{id:'ai-generated',name:field(v.name,80),reason:field(v.reason,450),risk:field(v.risk,450),stages}]};
}
export function initByokUI({onGrowthPlan}={}){
 connected=document.body.dataset.aiMode==='verified'||Boolean(browserSavedModel());
 model=connected?(browserSavedModel()||document.querySelector('#ai-global-subtitle')?.textContent||'已保存模型'):'';
 for(const id of ['#byok-key','#byok-base','#byok-model','#byok-provider','#byok-save','#byok-test']){
  const el=$(id);if(el){el.disabled=true;el.title='公开版统一在小芽聊天入口连接 AI'}
 }
 const oldForm=$('#byok-form');
 if(oldForm){
  const connect=document.createElement('button');connect.type='button';connect.id='pages-unified-ai-connect';
  connect.className='btn btn-dark';connect.textContent='连接或更换 AI 模型（与小芽聊天共用）';
  connect.addEventListener('click',()=>document.querySelector('#xy-config')?.click());
  oldForm.before(connect);oldForm.hidden=true;
 }
 $('#byok-form')?.addEventListener('submit',e=>e.preventDefault());
 put('#byok-status','请从右下角的小芽聊天窗口连接真实 AI');
 put('#byok-form-result','公开版浏览器直连模型，可能受 CORS 规则限制；密钥默认仅留在页面内存；个人设备可主动勾选浏览器保存并随时清除。');
 window.addEventListener('xiaoya-ai-capability',e=>{connected=e.detail?.connected===true;model=connected?String(e.detail?.model||'模型'):'';refresh()});
 $('#growth-ai-consent')?.addEventListener('change',refresh);
 $('#growth-ai-generate')?.addEventListener('click',async()=>{
  if(busy)return;
  if(!connected){window.dispatchEvent(new CustomEvent('xiaoya-open-ai-settings'));return;}
  if(!$('#growth-ai-consent')?.checked)return;
  const input={goal:$('#growth-goal').value,baseline:$('#growth-baseline').value,
   hours:Number($('#growth-hours').value),weeks:Number($('#growth-weeks').value),examWeek:$('#growth-exam-week').value};
  try{buildGrowthRoutes(input)}catch(e){put('#growth-ai-status','输入无效：'+e.message);return}
  busy=true;refresh();put('#growth-ai-status','模型正在生成建议，不会自动更改数据。');
  const requestId=crypto.randomUUID();
  try{
   const r=await new Promise((resolve,reject)=>{
    let timer;const handler=e=>{if(e.detail?.requestId!==requestId)return;clearTimeout(timer);window.removeEventListener('xiaoya-ai-plan-result',handler);resolve(e.detail)};
    window.addEventListener('xiaoya-ai-plan-result',handler);
    timer=setTimeout(()=>{window.removeEventListener('xiaoya-ai-plan-result',handler);reject(Error('模型超时'))},80000);
    window.dispatchEvent(new CustomEvent('xiaoya-ai-plan-request',{detail:{requestId,input}}));
   });
   if(!r.ok)throw Error(r.error||'模型请求失败');
   onGrowthPlan(validate(r.raw,input,r.model));
   put('#growth-ai-status','真实模型建议已通过结构校验，请预览并人工批准。');
  }catch(e){put('#growth-ai-status','AI 规划失败：'+e.message+'，规则路线仍可使用。')}
  finally{busy=false;$('#growth-ai-consent').checked=false;refresh()}
 });
 refresh();
}
