// Optional user-approved conversion of context advice into one internal preparation task.
// No silent mutation; no remote action; transaction follows canonical domain undo contract.
import {fingerprint,newId,undoTransaction} from './domain.js';
import {buildContextualSuggestions} from './context-agent.js';

const outstanding=new Map();
const clone=x=>structuredClone(x);
const asTime=x=>{const d=new Date(x);if(!Number.isFinite(+d))throw Error('时间无效');return d};
function check(data,ctx,id,now){
 if(!data||!Array.isArray(data.tasks)||!Array.isArray(data.events)||!Array.isArray(data.transactions)||
  !Array.isArray(data.history))throw Error('用户档案结构无效');
 if(ctx?.sources?.weather?.status!=='available'||ctx?.permissions?.weather!==true||
    +now-+new Date(ctx.weather?.fetchedAt)>6*3_600_000||
    +new Date(ctx.weather?.fetchedAt)>+now+5*60_000)
  throw Error('天气来源已变化或过期，请重新获取天气');
 const suggestion=buildContextualSuggestions(ctx).find(x=>x.id===id&&x.kind==='outdoor-weather');
 if(!suggestion)throw Error('天气建议不存在，请刷新情境');
 const source=suggestion.sources.find(x=>x.kind==='event');
 const event=ctx.upcomingOutdoors.find(x=>x.id===source?.id);
 if(!event||!data.events.some(e=>e.id===source.id&&e.outdoor===true))
  throw Error('原始户外活动已变化，请刷新情境');
 if(data.tasks.some(x=>x.contextSuggestionId===id))
  throw Error('已经为此次活动添加准备任务，避免重复');
 return {suggestion,event};
}
function weatherEvidence(ctx,id){
 const candidate=buildContextualSuggestions(ctx).find(c=>c.id===id);
 return JSON.stringify({
  cityId:ctx.weather?.cityId,updatedAt:ctx.weather?.fetchedAt,
  tomorrow:ctx.tomorrow,weather:ctx.weather?.days?.find(d=>d.date===ctx.tomorrow),
  id,reason:candidate?.reason,source:candidate?.sources
 });
}
export function previewWeatherPreparation(data,ctx,id,{now=new Date()}={}){
 now=asTime(now);
 const {suggestion,event}=check(data,ctx,id,now);
 const start=new Date(event.startsAt),deadline=new Date(+start-2*3_600_000);
 if(+deadline<=+now+5*60_000)throw Error('活动临近，无法安全创建提前准备的任务');
 for(const [token,r] of outstanding)if(r.expires<=+now)outstanding.delete(token);
 while(outstanding.size>=64)outstanding.delete(outstanding.keys().next().value);
 const task={id:newId(),title:'检查「'+event.title+'」天气与室内备选方案',
  due:deadline.getFullYear()+'-'+String(deadline.getMonth()+1).padStart(2,'0')+'-'+
   String(deadline.getDate()).padStart(2,'0')+'T'+String(deadline.getHours()).padStart(2,'0')+':'+
   String(deadline.getMinutes()).padStart(2,'0'),
  type:'task',done:false,minutes:5,createdAt:now.toISOString(),
  contextSuggestionId:id};
 const token=newId();
 const record={task:clone(task),id,basis:fingerprint(data),evidence:weatherEvidence(ctx,id),issued:+now,expires:+now+10*60_000};
 outstanding.set(token,record);
 return {token,id,requiresApproval:true,task:clone(task),basis:record.basis,
  evidence:record.evidence,reason:suggestion.reason,expiresAt:new Date(record.expires).toISOString()};
}
export function approveWeatherPreparation(data,ctx,preview,{now=new Date()}={}){
 now=asTime(now);
 if(!preview?.requiresApproval||typeof preview.token!=='string')
  throw Error('必须先预览并明确批准');
 const record=outstanding.get(preview.token);
 if(!record||+now<record.issued||+now>record.expires)
  throw Error('预览已过期或已使用，请重新预览');
 if(record.basis!==fingerprint(data)||preview.basis!==record.basis)
  throw Error('原始任务或活动发生变化，请重新预览');
 check(data,ctx,record.id,now);
 if(preview.id!==record.id||preview.evidence!==record.evidence||
  weatherEvidence(ctx,record.id)!==record.evidence||
  JSON.stringify(preview.task)!==JSON.stringify(record.task))
  throw Error('预览或天气来源已修改，请重新生成');
 if(+new Date(record.task.due)<=+now)
  throw Error('准备任务时间已经过去，请重新评估');
 const next=clone(data),task=clone(record.task);
 next.tasks.push(task);
 const transaction={id:newId(),at:now.toISOString(),title:'用户确认：'+task.title,
  status:'executed',changes:[{key:'tasks',id:task.id,before:null,after:clone(task)}]};
 next.transactions.push(transaction);
 next.history.unshift({id:newId(),at:now.toISOString(),action:'approved',
  description:'用户批准天气准备事项',transactionId:transaction.id});
 outstanding.delete(preview.token);
 return {next,task,transaction};
}
export function createContextActionController({getData,getContext,persist,clock=()=>new Date()}={}){
 if([getData,getContext,persist,clock].some(x=>typeof x!=='function'))throw Error('请提供用户档案、情境快照和提交方法');
 return Object.freeze({
  preview:id=>previewWeatherPreparation(getData(),getContext(),id,{now:clock()}),
  approve:preview=>{const out=approveWeatherPreparation(getData(),getContext(),preview,{now:clock()});persist(out.next);return out},
  undo:id=>{const next=undoTransaction(getData(),id,clock());persist(next);return next}
 });
}
