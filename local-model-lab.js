// Qwen3-8B local-only synthetic experiment, no secrets or general-purpose proxy.
import {getSyntheticCase} from './synthetic-model-cases.js';
const ENDPOINT='http://127.0.0.1:18081';
const REQUEST_TIMEOUT_MS=110000; // CPU-only Qwen3-8B may exceed this; never silently report success.
const ensure=(ok,msg)=>{if(!ok)throw Error(msg)};
const brief=(x,n)=>typeof x==='string'?x.trim().slice(0,n):'';
export function validateSyntheticPlan(payload,scenario){
 ensure(scenario&&getSyntheticCase(scenario.id),'未知合成案例');
 ensure(payload&&typeof payload==='object'&&!Array.isArray(payload),'模型未返回JSON对象');
 let size;try{size=JSON.stringify(payload)?.length}catch{throw Error('模型输出不可序列化')}
 ensure(Number.isInteger(size)&&size<=18000,'模型输出超过18000字符上限');
 ensure(typeof payload.summary==='string'&&payload.summary.trim().length>=3&&payload.summary.length<=260,'方案概要格式错误');
 ensure(Array.isArray(payload.milestones)&&payload.milestones.length>=2&&payload.milestones.length<=6,'阶段数量必须是2–6');
 ensure(Array.isArray(payload.risks)&&payload.risks.length<=5&&payload.risks.every(x=>typeof x==='string'&&x.length<=180),'风险字段无效');
 ensure(Array.isArray(payload.assumptions)&&payload.assumptions.length<=5&&payload.assumptions.every(x=>typeof x==='string'&&x.length<=180),'假设字段无效');
 let prior=0;
 const milestones=payload.milestones.map(s=>{
  ensure(s&&typeof s==='object'&&!Array.isArray(s),'阶段必须为对象');
  ensure(Number.isInteger(s.week)&&s.week>prior&&s.week>=1&&s.week<=scenario.weeks,'阶段周数必须递增且在规划周期内');
  prior=s.week;
  ensure(typeof s.title==='string'&&s.title.trim().length>=2&&s.title.length<=90,'阶段名称无效');
  ensure(Number.isFinite(s.hours)&&s.hours>0&&s.hours<=scenario.weeklyHours,'单阶段周投入超过预算');
  if(scenario.examWeek===s.week)ensure(s.hours<=2,'考试周项目投入超出2小时');
  ensure(typeof s.reason==='string'&&s.reason.trim().length>=3&&s.reason.length<=260,'阶段理由不完整');
  ensure(typeof s.deliverable==='string'&&s.deliverable.trim().length>=2&&s.deliverable.length<=160,'未提供可检查交付物');
  return {week:s.week,title:brief(s.title,90),hours:s.hours,reason:brief(s.reason,260),deliverable:brief(s.deliverable,160)};
 });
 return {summary:brief(payload.summary,260),milestones,risks:payload.risks.map(x=>brief(x,180)),assumptions:payload.assumptions.map(x=>brief(x,180))};
}
export function createSyntheticPrompt(scenario){
 ensure(scenario&&getSyntheticCase(scenario.id)===scenario,'仅允许内置合成案例');
 return [
  {role:'system',content:'你是大学生个人成长Agent的本地规划实验。/no_think 所有输入均为虚构合成案例，不使用任何外部文件/私人档案。仅输出严格JSON对象，无markdown、无思维链。字段：summary字符串；milestones数组(2至4条，每条week整数,title字符串,hours正数,reason字符串,deliverable字符串)；risks字符串数组；assumptions字符串数组。请尽量简短。milestones按week严格递增，阶段时间小于或等于每周预算。不能承诺成绩、职业成功或声称已自动执行任务。考试周若出现在里程碑中，投入不得超过2小时。请生成具体且有差异的可检查计划，而非空泛套话。'},
  {role:'user',content:JSON.stringify({goal:scenario.goal,baseline:scenario.baseline,weeks:scenario.weeks,weeklyHours:scenario.weeklyHours,examWeek:scenario.examWeek,constraints:scenario.constraints})}
 ];
}
function localURL(path){return ENDPOINT+path}
export async function checkLocalQwen({fetchImpl=fetch,signal}={}){
 try{
  const res=await fetchImpl(localURL('/health'),{signal:signal||AbortSignal.timeout(3500)});
  if(!res.ok)return {ready:false,model:'Qwen3-8B',syntheticOnly:true};
  const body=await res.json();
  return {ready:body.status==='ok',model:'Qwen3-8B',syntheticOnly:true};
 }catch{return {ready:false,model:'Qwen3-8B',syntheticOnly:true}}
}
export async function generateSyntheticPlan(caseId,{fetchImpl=fetch,signal,timeoutMs=REQUEST_TIMEOUT_MS}={}){
 const scenario=getSyntheticCase(caseId);
 ensure(scenario,'只允许预设的合成案例');
 ensure(Number.isInteger(timeoutMs)&&timeoutMs>=300&&timeoutMs<=120000,'超时参数无效');
 // Models are discovered locally to avoid embedding a machine path, never logged.
 const abort=new AbortController(),cancel=()=>abort.abort('cancelled by user');
 signal?.addEventListener('abort',cancel,{once:true});
 const timeout=setTimeout(()=>abort.abort('local inference timeout'),timeoutMs);
 const started=Date.now();
 try{
  if(signal?.aborted)throw Error('用户已取消本机推理');
  const found=await fetchImpl(localURL('/v1/models'),{signal:abort.signal});
  if(!found.ok)throw Error('本机模型列表不可用');
  const models=await found.json(),model=models.data?.find(x=>typeof x.id==='string'&&x.id.includes('Qwen3-8B'))?.id;
  if(!model)throw Error('本机没有运行 Qwen3-8B；不会切换到其他模型');
  const res=await fetchImpl(localURL('/v1/chat/completions'),{method:'POST',headers:{'Content-Type':'application/json'},
   signal:abort.signal,body:JSON.stringify({model,messages:createSyntheticPrompt(scenario),stream:false,temperature:0.15,max_tokens:400,chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_object'}})});
  if(!res.ok)throw Error('本机推理失败（HTTP '+res.status+'）');
  const result=await res.json(),raw=result?.choices?.[0]?.message?.content;
  ensure(typeof raw==='string'&&raw.trim().length>0&&raw.length<=18000,'模型回答为空或超过限制');
  let parsed;
  try{parsed=JSON.parse(raw)}catch{throw Error('模型没有返回严格JSON；结果未被接受')}
  const plan=validateSyntheticPlan(parsed,scenario);
  return {mode:'local-qwen-real',provider:'Qwen3-8B',syntheticOnly:true,cloudUsed:false,privateDataUsed:false,
   caseId:scenario.id,elapsedMs:Date.now()-started,plan,modelCalls:1,writeOperations:0,
   warning:'这是本机Qwen对预设合成数据的规划建议。未调用云API、未读取私人档案、未自动建立任务。'};
 }catch(e){
  if(abort.signal.aborted&&!signal?.aborted){
   const timeoutError=new Error('本机Qwen在110秒内未完成推理；规则规划仍可使用，请检查GPU权限或缩短输出');
   timeoutError.name='AbortError';throw timeoutError;
  }
  throw e;
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel)}
}
export const CLOUD_MODEL_STATUS=Object.freeze({enabled:false,reason:'云端Provider只保留设计位；需要用户单独授权后才可实现，不加载密钥'});
