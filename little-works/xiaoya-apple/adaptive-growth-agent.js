// Xiaoya adaptive growth: auditable multi-week intentions + optional bounded model decisions.
// No network, credentials, DOM, journal reading, storage or implicit execution.
import {fingerprint,monday,plusDays,dateKey,occurrences,freeSlots,executePlan,undoTransaction,newId} from './domain.js';

const MINUTE=60_000,HOUR=60*MINUTE;
const copy=x=>structuredClone(x);
const routes=Object.freeze([
  {id:'gentle',name:'轻量恢复',minutes:20,weeklyActions:1},
  {id:'steady',name:'稳定推进',minutes:30,weeklyActions:2},
  {id:'focused',name:'集中突破',minutes:45,weeklyActions:3}
]);
const outstanding=new Map();
const iso=now=>new Date(now).toISOString();
const saneDate=input=>{const x=new Date(input);if(!Number.isFinite(+x))throw Error('规划时间无效');return x};
const isData=data=>data&&['tasks','goals','courses','events','checkins','decisions'].every(k=>Array.isArray(data[k]));
function ensure(data){if(!isData(data))throw Error('需要有效的本地成长档案')}
function digest(str){let x=2166136261;for(const c of str)x=Math.imul(x^c.charCodeAt(0),16777619);return (x>>>0).toString(16)}
function evidenceBasis(data){return digest(JSON.stringify([fingerprint(data),data.checkins,data.decisions]))}
function countCheckins(data,goalId,from,to){
 return data.checkins.filter(c=>c.goalId===goalId&&+new Date(c.at)>=+from&&+new Date(c.at)<+to).length;
}
function listWorkload(data,at){
 const until=plusDays(at,7);
 const due=data.tasks.filter(t=>!t.done&&t.due&&+new Date(t.due)>=+at&&+new Date(t.due)<+until);
 const busy=occurrences(data,at,until);
 const bookedMinutes=busy.reduce((n,b)=>n+Math.max(0,Math.min(12*60,(+new Date(b.endsAt)-+new Date(b.startsAt))/MINUTE)),0);
 return {dueCount:due.length,dueMinutes:due.reduce((n,t)=>n+Math.max(0,Math.min(600,Number(t.minutes)||0)),0),
   bookedMinutes:Math.round(bookedMinutes),taskSourceIds:due.map(t=>t.id)};
}
function chooseRuleRoute({dueMinutes,bookedMinutes,previousActions,target,currentActions}){
 if(dueMinutes>=180||bookedMinutes>1500)return 'gentle';
 if(currentActions>=target)return 'steady';
 if(previousActions<target/2)return 'gentle';
 return 'steady';
}
function makeWeeks(start,now,weeklyTarget,currentActions,route,weeks){
 return Array.from({length:weeks},(_,i)=>{
  const day=plusDays(start,i*7),goal=i===0?
   Math.max(0,Math.min(route.weeklyActions,weeklyTarget-currentActions)):
   Math.min(route.weeklyActions,weeklyTarget);
  return {start:dateKey(day),plannedActions:goal,minutesPerAction:route.minutes,
   status:i===0?'当前周计划':'未来周意向',
   caveat:'目标行动数仅为建议，不能作为已完成记录或未来执行承诺'};
 });
}
/** Pure evidence-backed plan. Future weeks are intentions; never future commitments. */
export function buildAdaptiveGrowthPlan(data,{now=new Date(),weeks=4}={}){
 ensure(data);now=saneDate(now);
 if(!Number.isInteger(weeks)||weeks<2||weeks>8)throw Error('成长路线只支持2–8周');
 const currentWeek=monday(now),previousWeek=plusDays(currentWeek,-7);
 const workload=listWorkload(data,now);
 const goals=data.goals.filter(g=>!g.done).slice(0,8).map(g=>{
  const target=Math.max(1,Math.min(7,Number(g.weeklyTarget)||1));
  const previousActions=countCheckins(data,g.id,previousWeek,currentWeek);
  const currentActions=countCheckins(data,g.id,currentWeek,plusDays(currentWeek,7));
  const selectedRouteId=chooseRuleRoute({...workload,previousActions,currentActions,target});
  const choices=routes.map(x=>({...x,weeklyActions:Math.min(target,x.weeklyActions)}));
  const selected=choices.find(x=>x.id===selectedRouteId);
  const reason=workload.dueMinutes>=180?
   '近期有 '+workload.dueMinutes+' 分钟待完成截止事项，本周优先采取低负担的成长行动。':
   workload.bookedMinutes>1500?'当前七天课程与活动较密集，先安排轻量行动。':
   previousActions<target/2&&currentActions<target?
    '上周记录 '+previousActions+' 次，低于每周目标 '+target+' 次；本周建议先从小步骤恢复。':
    '按照现有记录和日程，为目标保持可持续的推进节奏。';
  return {id:g.id,title:g.title,weeklyTarget:target,selectedRouteId,reason,modelReason:null,
   evidence:{previousActions,currentActions,weeklyTarget:target,sourceGoalId:g.id},
   sources:[{kind:'goal',id:g.id},...workload.taskSourceIds.map(id=>({kind:'task',id}))],
   choices,weeks:makeWeeks(currentWeek,now,target,currentActions,selected,weeks)};
 });
 return {mode:'rule',modelUsed:false,providerName:null,sourceBasis:fingerprint(data),
  evidenceBasis:evidenceBasis(data),observedAt:iso(now),horizonWeeks:weeks,
  workload,goals,notice:goals.length?
  '未来周为行动意向，并非已创建日程；执行任何一个时段都需要用户单独批准。':
  '目前没有进行中的成长目标，不会虚构行动或进步。'};
}
function providerContext(rule){
 return {observedAt:rule.observedAt,horizonWeeks:rule.horizonWeeks,workload:{
  dueCount:rule.workload.dueCount,dueMinutes:rule.workload.dueMinutes,bookedMinutes:rule.workload.bookedMinutes
 },goals:rule.goals.map(g=>({
  id:g.id,title:String(g.title).slice(0,120),weeklyTarget:g.weeklyTarget,
  previousActions:g.evidence.previousActions,currentActions:g.evidence.currentActions
 }))};
}
function validateChoiceResult(raw,rule){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('AI 结果必须为结构化对象');
 let size;try{size=JSON.stringify(raw)?.length}catch{throw Error('AI 输出不可解析')}
 if(!Number.isInteger(size)||size>12_000)throw Error('AI 输出过长');
 if(Object.keys(raw).some(k=>k!=='choices')||!Array.isArray(raw.choices)||raw.choices.length>rule.goals.length)
  throw Error('AI 只能在已提供路线中选择');
 const valid=new Map(rule.goals.map(g=>[g.id,g]));
 const unique=new Set();
 for(const c of raw.choices){
  if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['goalId','routeId','reason'].includes(k)))
   throw Error('AI 输出含未经授权的动作字段');
  if(typeof c.goalId!=='string'||!valid.has(c.goalId)||unique.has(c.goalId))throw Error('AI 使用未知或重复目标');
  unique.add(c.goalId);
  if(!valid.get(c.goalId).choices.some(x=>x.id===c.routeId))throw Error('AI 选择了不存在的路线');
  if(typeof c.reason!=='string'||c.reason.length<1||c.reason.length>260)throw Error('AI 解释不符合长度或类型限制');
 }
 return raw.choices;
}
/** Explicitly authorized external provider may only select an existing route and explain it. */
export async function analyzeAdaptiveGrowth(data,{now=new Date(),weeks=4,provider=null,authorized=false,timeoutMs=3000}={}){
 const rule=buildAdaptiveGrowthPlan(data,{now,weeks});
 if(authorized!==true||!provider)return rule;
 if(typeof provider.plan!=='function')return {...rule,mode:'rule-fallback',notice:'模型接口无效，已使用本地方案'};
 if(!Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>20000)throw Error('模型超时需为50–20000毫秒');
 const controller=new AbortController();let timeout;
 try{
  const output=await Promise.race([
   Promise.resolve().then(()=>provider.plan({
    context:copy(providerContext(rule)),
    options:rule.goals.map(g=>({goalId:g.id,routes:copy(g.choices)})),
    signal:controller.signal
   })),
   new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort('timeout');reject(Error('模型分析已超时'))},timeoutMs)})
  ]);
  const selected=validateChoiceResult(output,rule);
  const selections=new Map(selected.map(x=>[x.goalId,x]));
  const updated=rule.goals.map(g=>{
   const chosen=selections.get(g.id);
   if(!chosen)return g;
   const route=g.choices.find(x=>x.id===chosen.routeId);
   return {...g,selectedRouteId:chosen.routeId,modelReason:chosen.reason,
    weeks:makeWeeks(monday(saneDate(now)),saneDate(now),g.weeklyTarget,g.evidence.currentActions,route,weeks)};
  });
  return {...rule,mode:'authorized-model',modelUsed:true,providerName:String(provider.name||'授权模型').slice(0,80),
   goals:updated,notice:'AI 仅选择经过规则验证的路线与解释；具体执行仍需逐项预览和批准。'};
 }catch(error){
  return {...rule,mode:'rule-fallback',modelUsed:false,
   notice:controller.signal.reason==='timeout'?'模型分析超时，已安全使用本地规则':'模型响应无效或服务不可用，已安全使用本地规则'};
 }finally{clearTimeout(timeout);controller.abort('completed')}
}
function scheduledGoal(data,goalId,now){
 const start=monday(now),end=plusDays(start,7);
 return occurrences(data,start,end).some(x=>x.goalId===goalId);
}
/** Preview is one future, bounded time block; not a batch of future tasks. */
export function previewAdaptiveGrowthSession(data,plan,goalId,{now=new Date()}={}){
 ensure(data);now=saneDate(now);
 if(!plan||!Array.isArray(plan.goals)||plan.evidenceBasis!==evidenceBasis(data)||plan.sourceBasis!==fingerprint(data))
  throw Error('规划依据发生变化，请重新生成');
 const target=plan.goals.find(g=>g.id===goalId),real=data.goals.find(g=>g.id===goalId&&!g.done);
 if(!target||!real||target.evidence.sourceGoalId!==goalId)throw Error('目标不存在或已完成');
 if(target.weeks?.[0]?.plannedActions<=0||
    countCheckins(data,goalId,monday(now),plusDays(monday(now),7))>=target.weeklyTarget)
  throw Error('本周目标已达成或不需要额外行动');
 const route=routes.find(x=>x.id===target.selectedRouteId);
 if(!route||!target.choices.some(x=>x.id===route.id))throw Error('路线来源无效');
 const until=plusDays(monday(now),7);
 if(scheduledGoal(data,goalId,now))throw Error('本周已有对应目标行动，不重复安排');
 const start=new Date(+now+5*MINUTE);
 const slot=start<until?freeSlots(data,start,until,route.minutes)[0]:null;
 if(!slot)throw Error('本周没有符合条件的安全空档，请调整目标时间');
 const action={type:'planGoal',goalId,title:real.title,minutes:route.minutes,
  start:slot.start,end:slot.end};
 const token=newId();
 for(const [k,p] of outstanding)if(p.expiresAt<=+now)outstanding.delete(k);
 while(outstanding.size>=64)outstanding.delete(outstanding.keys().next().value);
 const core={id:'adaptive-goal:'+goalId+':'+dateKey(monday(now))+':'+route.id,
  kind:'goal',sources:[{kind:'goal',id:goalId}],basis:fingerprint(data),action};
 outstanding.set(token,{core:copy(core),evidenceBasis:evidenceBasis(data),issuedAt:+now,expiresAt:+now+10*MINUTE});
 return {id:core.id,goalId,routeId:route.id,action:copy(action),sources:copy(core.sources),
  evidenceBasis:evidenceBasis(data),sourceBasis:core.basis,token,
  reason:target.modelReason||target.reason,requiresApproval:true,expiresAt:iso(new Date(+now+10*MINUTE))};
}
export function approveAdaptiveGrowthSession(data,preview,{now=new Date()}={}){
 ensure(data);now=saneDate(now);
 if(!preview?.requiresApproval||typeof preview.token!=='string')throw Error('必须先预览并明确批准');
 const saved=outstanding.get(preview.token);
 if(!saved||+now<saved.issuedAt||+now>saved.expiresAt)throw Error('预览已过期或使用，请重新预览');
 if(preview.sourceBasis!==fingerprint(data)||preview.evidenceBasis!==evidenceBasis(data)||
  saved.evidenceBasis!==preview.evidenceBasis)throw Error('来源已变化，请重新生成并预览');
 if(preview.id!==saved.core.id||preview.goalId!==saved.core.action.goalId||
  JSON.stringify(preview.action)!==JSON.stringify(saved.core.action)||
  JSON.stringify(preview.sources)!==JSON.stringify(saved.core.sources))throw Error('预览被篡改或内容变化，请重新预览');
 if(scheduledGoal(data,preview.goalId,now))throw Error('本周已有此目标行动，请重新规划');
 const executed=executePlan(data,saved.core,now);
 outstanding.delete(preview.token);
 return executed;
}
/** Adapter for separate latest-UI workstream; caller provides all storage and auth preferences. */
export function createAdaptiveGrowthController({getData,persist,clock=()=>new Date(),provider=null,authorized=false}={}){
 if(typeof getData!=='function'||typeof persist!=='function'||typeof clock!=='function')
  throw Error('请提供档案读取、持久化与时钟方法');
 const now=()=>saneDate(clock());
 return Object.freeze({
  analyze:({weeks=4,timeoutMs=3000}={})=>analyzeAdaptiveGrowth(getData(),{now:now(),provider,authorized,weeks,timeoutMs}),
  preview:(plan,goalId)=>previewAdaptiveGrowthSession(getData(),plan,goalId,{now:now()}),
  approve:preview=>{const out=approveAdaptiveGrowthSession(getData(),preview,{now:now()});persist(out.next);return out},
  undo:id=>{const out=undoTransaction(getData(),id,now());persist(out);return out}
 });
}
