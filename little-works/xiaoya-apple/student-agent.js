// Student-facing OPC Agent function layer. No DOM, network, storage or auto-execution.
import {plans,freeSlots,occurrences,monday,plusDays,dateKey,fingerprint,executePlan,undoTransaction,newId} from './domain.js';

const minute=60_000;
// Short-lived, in-memory approvals; no secrets, disk writes, background process or cloud use.
const pendingPreviews=new Map();
function prunePreviews(now){
 for(const [token,entry] of pendingPreviews)if(entry.expiresAt<=+now)pendingPreviews.delete(token);
 while(pendingPreviews.size>64)pendingPreviews.delete(pendingPreviews.keys().next().value);
}
function assertData(data){
 if(!data||!['tasks','events','courses','goals','checkins','decisions','history'].every(k=>Array.isArray(data[k])))
  throw Error('小芽档案结构无效，不能规划');
}
function getNow(input){const value=new Date(input);if(!Number.isFinite(+value))throw Error('当前时间无效');return value}
const copy=value=>structuredClone(value);
function authenticSources(data,sources){
 return Array.isArray(sources)&&sources.every(source=>{
  const col={task:data.tasks,event:data.events,course:data.courses,goal:data.goals}[source.kind];
  return !!col?.some(item=>item.id===source.id);
 });
}
function isSnoozed(data,id,now){
 return data.history.some(e=>e.action==='agent-snoozed'&&e.proposalId===id&&
   Number.isFinite(+new Date(e.until))&&new Date(e.until)>now&&new Date(e.at)<=now);
}
function isClosed(data,id){return data.decisions.some(d=>d.id===id&&['executed','rejected'].includes(d.status))}
function decorate(item,now){
 return {...item,needsApproval:!!item.action,modelUsed:false,mode:'rule',observedAt:now.toISOString(),
  priority:item.severity??4,evidence:item.sources.map(s=>({kind:s.kind,id:s.id})),
  action:item.action?copy(item.action):null};
}
function weeklyGoalOpportunities(data,now){
 const start=monday(now),end=plusDays(start,7);
 const scheduled=new Set(occurrences(data,now,end).filter(x=>x.goalId).map(x=>x.goalId));
 const completed=new Map();
 for(const checkin of data.checkins)if(checkin.goalId&&new Date(checkin.at)>=start&&new Date(checkin.at)<end)
  completed.set(checkin.goalId,(completed.get(checkin.goalId)||0)+1);
 const earliest=new Date(+now+5*minute),slots=earliest<end?freeSlots(data,earliest,end,30):[];
 const results=[];
 for(const g of data.goals.filter(g=>!g.done).slice(0,12)){
  const target=Math.max(1,Math.min(7,Number(g.weeklyTarget)||1));
  const done=completed.get(g.id)||0;
  if(done>=target||scheduled.has(g.id))continue;
  const slot=slots[0],id='weekly-goal:'+g.id+':'+dateKey(start);
  results.push({
   id,kind:'weekly-goal',severity:4,title:'给「'+g.title+'」留一次行动时间',
   description:'本周已记录 '+done+'/'+target+' 次目标行动；如安排时间，仍需你确认。',
   reason:'依据：已保存的成长目标、本周实际打卡和未来空闲日程。已安排的目标时段不会重复建议。',
   sources:[{kind:'goal',id:g.id}],basis:fingerprint(data),createdAt:now.toISOString(),pet:'idle',
   action:slot?{type:'planGoal',goalId:g.id,title:g.title,minutes:30,start:slot.start,end:slot.end,
    alternatives:slots.slice(0,3)}:null
  });
 }
 return results;
}
/** Pure sorted suggestions; all saved records and generated source references are verifiable. */
export function buildStudentAgentFeed(data,{now=new Date(),limit=10}={}){
 assertData(data);now=getNow(now);
 if(!Number.isInteger(limit)||limit<1||limit>30)throw Error('建议数量应为1–30');
 const raw=[...plans(data,now).filter(p=>p.kind!=='goal'),...weeklyGoalOpportunities(data,now)];
 const seen=new Set(),candidates=[];
 for(const p of raw.sort((a,b)=>(a.severity??5)-(b.severity??5))){
  if(seen.has(p.id)||!authenticSources(data,p.sources)||isClosed(data,p.id)||isSnoozed(data,p.id,now))continue;
  seen.add(p.id);candidates.push(decorate(p,now));
  if(candidates.length>=limit)break;
 }
 return {mode:'rule',modelUsed:false,observedAt:now.toISOString(),sourceBasis:fingerprint(data),
  candidates,summary:candidates.length?'依据当前课程、截止时间及成长目标生成的本地建议':'目前没有需要主动调整的安排',
  notice:'本地规则辅助；未经用户明确审批不会执行事务或调用云模型'};
}
/** An immutable view of what the next explicit approval would do. */
export function previewStudentAgentAction(data,id,{now=new Date()}={}){
 now=getNow(now);
 const candidate=buildStudentAgentFeed(data,{now,limit:30}).candidates.find(p=>p.id===id);
 if(!candidate)throw Error('建议不存在或已过期，请重新分析');
 if(!candidate.action)throw Error('当前建议没有可执行的安全动作');
 prunePreviews(now);
 const token=newId();
 pendingPreviews.set(token,{candidate:copy(candidate),basis:fingerprint(data),issuedAt:+now,expiresAt:+now+10*minute});
 return {id:candidate.id,title:candidate.title,reason:candidate.reason,description:candidate.description,
  sources:copy(candidate.sources),action:copy(candidate.action),basis:fingerprint(data),requiresApproval:true,
  observedAt:now.toISOString(),token};
}
/** Caller alone persists result.next; an unmodified recent preview is compulsory. */
export function approveStudentAgentAction(data,preview,{now=new Date()}={}){
 assertData(data);now=getNow(now);
 if(!preview||typeof preview.id!=='string'||preview.requiresApproval!==true)throw Error('必须先预览并明确批准建议');
 const saved=pendingPreviews.get(preview.token);
 if(!saved||now<saved.issuedAt||+now>saved.expiresAt)throw Error('预览已过期或已经使用，请重新预览批准');
 if(preview.basis!==fingerprint(data)||saved.basis!==preview.basis)throw Error('档案发生变化，请重新预览并批准');
 if(preview.id!==saved.candidate.id||JSON.stringify(saved.candidate.action)!==JSON.stringify(preview.action)||
    JSON.stringify(saved.candidate.sources)!==JSON.stringify(preview.sources))
  throw Error('预览内容已变化或被篡改，请重新预览');
 const current=buildStudentAgentFeed(data,{now,limit:30}).candidates.find(p=>p.id===preview.id);
 if(!current||!current.action)throw Error('建议已处理或过期，请重新分析');
 const result=executePlan(data,saved.candidate,now);
 pendingPreviews.delete(preview.token);
 return result;
}
/** Thin optional adapter for any current/future UI. Persistence is injected and never automatic. */
export function createStudentAgentController({getData,persist,clock=()=>new Date()}={}){
 if(typeof getData!=='function'||typeof persist!=='function'||typeof clock!=='function')
  throw Error('Agent 控制器必须提供档案读取、写入与时钟接口');
 const time=()=>getNow(clock());
 return Object.freeze({
  feed:()=>buildStudentAgentFeed(getData(),{now:time()}),
  preview:id=>previewStudentAgentAction(getData(),id,{now:time()}),
  approve:preview=>{
   const result=approveStudentAgentAction(getData(),preview,{now:time()});
   persist(result.next);return result;
  },
  respond:(id,decision,{hours=24}={})=>{
   const result=respondStudentAgentSuggestion(getData(),id,decision,{now:time(),hours});
   persist(result.next);return result;
  },
  undo:transactionId=>{
   const next=undoTransaction(getData(),transactionId,time());
   persist(next);return next;
  }
 });
}
/** Reject or postpone only. Neither path invokes the execution engine. */
export function respondStudentAgentSuggestion(data,id,decision,{now=new Date(),hours=24}={}){
 assertData(data);now=getNow(now);
 if(!['snooze','reject'].includes(decision))throw Error('操作类型不支持：仅可稍后提醒或拒绝');
 if(decision==='snooze'&&(!Number.isInteger(hours)||hours<1||hours>168))throw Error('稍后提醒必须为1–168小时');
 const candidate=buildStudentAgentFeed(data,{now,limit:30}).candidates.find(p=>p.id===id);
 if(!candidate)throw Error('建议不存在、已处理或已暂缓，请重新分析');
 const next=copy(data);
 if(decision==='reject')next.decisions.push({id,status:'rejected',at:now.toISOString(),reason:'用户明确拒绝此方案',sourceIds:copy(candidate.sources)});
 else next.history.unshift({id:newId(),at:now.toISOString(),action:'agent-snoozed',proposalId:id,
   until:new Date(+now+hours*3_600_000).toISOString(),sourceIds:copy(candidate.sources),
   description:'按用户选择暂缓提醒'});
 return {next,status:decision,id};
}
