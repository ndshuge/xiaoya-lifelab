// Xiaoya agent planning boundary. Local rules remain usable offline.
// Model providers are injected only after explicit authorization. No default HTTP or secrets.
import {plans,fingerprint,executePlan} from './domain.js';
export const SAFE_ACTION_TYPES=Object.freeze(['moveEvent','planTask','splitTask','planGoal']);
const cap=(s,n=220)=>String(s??'').trim().slice(0,n);
const ensure=(v,msg)=>{if(!v)throw Error(msg)};
export function observeAgent(data,now=new Date()){
 ensure(data&&Array.isArray(data.tasks)&&Array.isArray(data.events)&&Array.isArray(data.goals),'用户档案结构无效');
 const events=[...data.courses.map(x=>({id:x.id,kind:'course',title:cap(x.name,120),day:x.day,start:x.start,end:x.end})),
  ...data.events.map(x=>({id:x.id,kind:'event',title:cap(x.name,120),day:x.day,start:x.start,end:x.end}))].slice(0,40);
 const tasks=data.tasks.filter(x=>!x.done).sort((a,b)=>new Date(a.due||'9999')-new Date(b.due||'9999'))
  .slice(0,30).map(x=>({id:x.id,kind:'task',title:cap(x.title,120),due:x.due||null,minutes:x.minutes||0}));
 const goals=data.goals.filter(x=>!x.done).slice(0,10).map(x=>({id:x.id,kind:'goal',title:cap(x.title,120)}));
 return {observedAt:now.toISOString(),sourceRevision:Number(data.revision||0),basis:fingerprint(data),
  events,tasks,goals,counts:{tasks:data.tasks.length,events:data.events.length,courses:data.courses.length,goals:data.goals.length},
  privacy:'仅本机工作区结构化摘要；无自动云端发送'};
}
function trustworthy(candidate,data){
 return Array.isArray(candidate.sources)&&candidate.sources.every(x=>{
  const collection={task:data.tasks,goal:data.goals,event:data.events,course:data.courses}[x.kind];
  return collection?.some(y=>y.id===x.id);
 });
}
export function buildRuleAnalysis(data,now=new Date()){
 const observation=observeAgent(data,now);
 const candidates=plans(data,now).filter(p=>trustworthy(p,data)).slice(0,12).map(p=>({
  id:p.id,kind:p.kind,severity:Number.isFinite(p.severity)?p.severity:5,title:cap(p.title,160),
  reason:cap(p.reason,400),description:cap(p.description,400),sourceIds:p.sources.map(x=>x.id),
  actionType:SAFE_ACTION_TYPES.includes(p.action?.type)?p.action.type:null,
  requiresApproval:!!p.action,sourceBasis:p.basis,original:p
 }));
 return {mode:'rule',modelUsed:false,observedAt:observation.observedAt,basis:observation.basis,
  summary:candidates.length?'依据当前保存的任务、课程与目标生成可追溯建议':'当前没有需要主动处理的建议',
  candidates,observation,warning:'本机可解释规则分析，不是外部大模型推理'};
}
export function validateModelRanking(payload,rule){
 ensure(payload&&typeof payload==='object'&&!Array.isArray(payload),'模型输出必须为对象');
 let rawLength;try{rawLength=JSON.stringify(payload)?.length}catch{throw Error('模型输出不可序列化')}
 ensure(Number.isInteger(rawLength)&&rawLength<=32768,'模型输出过长，已拒绝采纳');
 ensure(Array.isArray(payload.rankedIds)&&payload.rankedIds.length<=12,'模型排序格式无效');
 const original=new Map(rule.candidates.map(x=>[x.id,x]));
 ensure(payload.rankedIds.every(x=>typeof x==='string'&&original.has(x)),'模型试图引用不存在的建议');
 ensure(new Set(payload.rankedIds).size===payload.rankedIds.length,'模型候选不得重复');
 const notes=payload.notes??{};
 ensure(notes&&typeof notes==='object'&&!Array.isArray(notes),'解释字段无效');
 ensure(Object.keys(notes).every(id=>original.has(id)),'模型解释含不存在的来源');
 for(const val of Object.values(notes)){
  ensure(val&&typeof val==='object'&&typeof val.reason==='string'&&val.reason.length<=500,'解释字段过长或类型无效');
  if(val.uncertainty!==undefined)ensure(typeof val.uncertainty==='string'&&val.uncertainty.length<=260,'不确定性字段无效');
 }
 return [...payload.rankedIds,...rule.candidates.map(x=>x.id).filter(id=>!payload.rankedIds.includes(id))].map(id=>{
  const originalCandidate=original.get(id),note=notes[id];
  return {...originalCandidate,modelNote:note?cap(note.reason,500):null,
   uncertainty:note?.uncertainty?cap(note.uncertainty,260):null};
 });
}
export async function analyzeAgent(data,{now=new Date(),provider=null,authorized=false,timeoutMs=3000}={}){
 const rule=buildRuleAnalysis(data,now);
 if(authorized!==true||!provider)return {...rule,warning:'当前为本机规则辅助。模型调用未启用（需要单独授权）'};
 ensure(typeof provider.analyze==='function','模型 Provider 缺少 analyze 接口');
 ensure(Number.isInteger(timeoutMs)&&timeoutMs>=50&&timeoutMs<=20000,'模型超时须为50–20000毫秒');
 const controller=new AbortController();let timer;
 try{
  const result=await Promise.race([
   Promise.resolve().then(()=>{
    if(controller.signal.aborted)throw Error('请求已取消');
    return provider.analyze({
     observation:structuredClone(rule.observation),
     candidates:rule.candidates.map(({id,title,kind,reason,description,sourceIds,actionType,severity})=>
      ({id,title,kind,reason,description,sourceIds,actionType,severity})),
     signal:controller.signal
    });
   }),
   new Promise((_,reject)=>{timer=setTimeout(()=>{
    controller.abort('timeout');reject(Error('模型分析超时，已发出取消信号'));
   },timeoutMs)})
  ]);
  const candidates=validateModelRanking(result,rule);
  return {...rule,candidates,mode:'authorized-model',modelUsed:true,
   providerName:cap(provider.name||'授权模型',80),warning:'模型只排序/解释现有本机验证的建议；它无权直接写入档案'};
 }catch(error){
  return {...rule,mode:'rule-fallback',modelUsed:false,
   warning:'模型输出失败，已安全退回本机规则：'+cap(error.message,180)};
 }finally{clearTimeout(timer);controller.abort('completed')}
}
export function approveValidatedCandidate(data,id,now=new Date()){
 // Never trust a model-proposed action: reconstruct the rule candidate from current data.
 const current=plans(data,now).find(p=>p.id===id);
 if(!current)throw Error('建议已过期或不存在，请重新分析');
 if(!current.action||!SAFE_ACTION_TYPES.includes(current.action.type))throw Error('候选动作未获白名单允许');
 if(!trustworthy(current,data))throw Error('建议来源不完整');
 return executePlan(data,current,now);
}
