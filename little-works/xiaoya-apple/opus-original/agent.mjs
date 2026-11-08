// 小芽 · 陪伴智能体 (companion agent).
// With a user-supplied OpenAI-compatible model, Xiaoya answers by *calling tools*: read tools look things up
// on this device and are gated per category by the user's consent; write tools only produce pencil drafts
// that the user must 落墨 themselves; `remember` writes to local memory. Every call lands in a visible trace.
// Without a model, the same drafts / memory / planning work through local rules. Nothing here stores keys.
import {dateKey,plusDays,monday,occurrences,weekday} from '../domain.js';
import {freeWindows,searchRecords} from './page-model.mjs';
import {parseLine} from './line-parser.mjs';
import {CATEGORIES} from './memory.mjs';

const clip=(s,n=80)=>String(s??'').replace(/[\r\n]+/g,' ').slice(0,n);
const HM=/^([01]\d|2[0-3]):[0-5]\d$/,DAY=/^\d{4}-\d{2}-\d{2}$/;
const toHM=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const toMin=s=>{const [h,m]=s.split(':').map(Number);return h*60+m};
const catLabel=k=>CATEGORIES.find(c=>c.key===k)?.label||k;
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});

/** The tool catalogue. `category` = consent needed to *read*; null = always allowed (drafts are harmless pencil). */
export const TOOLS=Object.freeze([
 {name:'get_schedule',category:'schedule',label:'日程',description:'读取某几天的课程与活动（含停课/调课后的实际安排）。',
  parameters:obj({from:{type:'string',description:'开始日期 YYYY-MM-DD'},days:{type:'integer',description:'天数 1–14'}},['from'])},
 {name:'get_free_time',category:'schedule',label:'空闲时间',description:'读取某一天 08:00–22:00 之间真正空着的时间段。',
  parameters:obj({date:{type:'string',description:'YYYY-MM-DD'}},['date'])},
 {name:'get_tasks',category:'tasks',label:'事项与截止',description:'读取未完成的事项：有截止的作业/考试，以及没有截止的口袋小事。',
  parameters:obj({include_done:{type:'boolean'}})},
 {name:'get_goals',category:'goals',label:'目标',description:'读取进行中的长期目标与本周打卡次数。',parameters:obj({})},
 {name:'get_mood',category:'mood',label:'心情分值',description:'读取最近若干天的心情分值（1–5，不含日记正文）。',
  parameters:obj({days:{type:'integer',description:'1–30'}})},
 {name:'get_journal',category:'journal',label:'日记正文',description:'读取最近若干天用户写下的日记正文。非常私密，只在确有必要时调用。',
  parameters:obj({days:{type:'integer',description:'1–14'}})},
 {name:'search_records',category:'schedule',label:'搜索记录',description:'按关键词搜索事项、活动、课程和目标（不搜索日记）。',
  parameters:obj({query:{type:'string'}},['query'])},
 {name:'draft_task',category:null,label:'铅笔：事项',description:'画一条事项草稿（铅笔）。不会写入，需用户落墨。',
  parameters:obj({title:{type:'string'},due:{type:'string',description:'截止 YYYY-MM-DDTHH:MM，可省略'},minutes:{type:'integer'},type:{type:'string',enum:['task','assignment','exam']},reason:{type:'string'}},['title'])},
 {name:'draft_event',category:null,label:'铅笔：活动',description:'在某天某时段画一个活动草稿（铅笔）。不会写入，需用户落墨。',
  parameters:obj({title:{type:'string'},date:{type:'string',description:'YYYY-MM-DD'},start:{type:'string',description:'HH:MM'},end:{type:'string',description:'HH:MM'},place:{type:'string'},reason:{type:'string'}},['title','date','start','end'])},
 {name:'draft_goal',category:null,label:'铅笔：目标',description:'画一个长期目标草稿（铅笔）。不会写入，需用户落墨。',
  parameters:obj({title:{type:'string'},weekly_target:{type:'integer',description:'每周几次 1–7'},reason:{type:'string'}},['title'])},
 {name:'ask_user',category:null,label:'问你',description:'信息不确定、会影响安排时（例如提交方式、预计时长、是否必须今天做），向用户提一个简短问题，可带 2–3 个选项。不要猜测。',
  parameters:obj({question:{type:'string'},options:{type:'array',items:{type:'string'}}},['question'])},
 {name:'remember',category:null,label:'记住',description:'把关于用户的一条稳定事实记在本机（例如偏好、作息、重要的人和事）。不要记录密码、证件号等敏感信息。',
  parameters:obj({fact:{type:'string'}},['fact'])}
]);
const byName=Object.fromEntries(TOOLS.map(t=>[t.name,t]));

/** OpenAI-compatible tool specs: only the read tools the user has allowed, plus the harmless draft/remember tools. */
export function toolSpecs(consent){
 return TOOLS.filter(t=>!t.category||consent[t.category]||(t.name==='search_records'&&(consent.tasks||consent.goals)))
  .map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters}}));
}

const SENSITIVE=/(密码|口令|验证码|身份证|银行卡|卡号|password|passcode|\b\d{15,19}\b)/i;
function draftId(){return 'd'+Math.random().toString(36).slice(2,9)}
/** Normalize a draft to the same {intent,fields} shape the one-line parser produces, or throw a readable reason. */
export function makeDraft(kind,a,now=new Date()){
 const title=clip(a.title,160).trim();if(!title)throw Error('缺少标题');
 if(kind==='task'){
  let due=a.due?String(a.due).slice(0,16):null;
  if(due&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(due))throw Error('截止时间格式应为 YYYY-MM-DDTHH:MM');
  const minutes=Math.min(600,Math.max(5,Math.round(Number(a.minutes)||30)));
  return {id:draftId(),intent:'task',fields:{title,due,minutes,type:['assignment','exam'].includes(a.type)?a.type:'task',course:''},reason:clip(a.reason,120)};
 }
 if(kind==='event'){
  const date=String(a.date||''),start=String(a.start||''),end=String(a.end||'');
  if(!DAY.test(date)||isNaN(new Date(date+'T12:00')))throw Error('日期格式应为 YYYY-MM-DD');
  if(!HM.test(start)||!HM.test(end))throw Error('时间格式应为 HH:MM');
  if(toMin(end)<=toMin(start))throw Error('结束时间要晚于开始时间');
  return {id:draftId(),intent:'event',fields:{name:title,date,day:weekday(new Date(date+'T12:00')),start,end,place:clip(a.place,60),weekStart:1,weekEnd:54,parity:'all',exceptions:[]},reason:clip(a.reason,120)};
 }
 if(kind==='goal'){
  const weeklyTarget=Math.min(7,Math.max(1,Math.round(Number(a.weekly_target)||2)));
  return {id:draftId(),intent:'goal',fields:{title,category:'兴趣',target:'',weeklyTarget,kind:'goal'},reason:clip(a.reason,120)};
 }
 throw Error('未知的草稿类型');
}

/**
 * Run one tool locally. ctx = {data, journal, consent, memory, now}.
 * Returns {content (JSON string for the model), trace:{name,label,blocked?,note}, draft?, remembered?}.
 */
export function runTool(name,args,ctx){
 const t=byName[name];const now=ctx.now||new Date();
 if(!t)return {content:JSON.stringify({error:'没有这个工具'}),trace:{name,label:name,blocked:true,note:'未知工具'}};
 const a=args&&typeof args==='object'?args:{};
 const need=t.name==='search_records'?(ctx.consent.schedule||ctx.consent.tasks||ctx.consent.goals):(!t.category||ctx.consent[t.category]);
 if(!need)return {content:JSON.stringify({error:'用户没有授权读取「'+catLabel(t.category)+'」。请如实告诉用户：可以在封底「小芽能看到什么」里打开，不要猜测内容。'}),
  trace:{name,label:t.label,blocked:true,note:'未授权，已拦下'}};
 const d=ctx.data;const ok=(payload,note)=>({content:JSON.stringify(payload).slice(0,6000),trace:{name,label:t.label,note}});
 try{
  switch(name){
   case 'get_schedule':{
    const from=DAY.test(a.from)?a.from:dateKey(now);const days=Math.min(14,Math.max(1,Number(a.days)||1));
    const occ=occurrences(d,new Date(from+'T00:00'),plusDays(new Date(from+'T00:00'),days));
    return ok({from,days,items:occ.slice(0,60).map(o=>({date:o.startsAt.slice(0,10),start:o.startsAt.slice(11,16),end:o.endsAt.slice(11,16),title:clip(o.name),kind:o.kind,place:clip(o.place,40)}))},from+' 起 '+days+' 天 · '+occ.length+' 项');
   }
   case 'get_free_time':{
    const date=DAY.test(a.date)?a.date:dateKey(now);
    const w=freeWindows(d,date,{now,minimum:30});
    return ok({date,windows:w.map(x=>({from:x.start,to:x.end,minutes:x.minutes}))},date+' · '+w.length+' 段空闲');
   }
   case 'get_tasks':{
    const list=d.tasks.filter(x=>a.include_done||!x.done).sort((x,y)=>(x.due||'9')<(y.due||'9')?-1:1).slice(0,40);
    return ok({tasks:list.map(x=>({title:clip(x.title),due:x.due||null,minutes:x.minutes||null,type:x.type||'task',done:!!x.done,overdue:!!(x.due&&!x.done&&new Date(x.due)<now)}))},list.length+' 件');
   }
   case 'get_goals':{
    const s=monday(now),e=plusDays(s,7);const goals=d.goals.filter(g=>!g.done).slice(0,12);
    return ok({goals:goals.map(g=>({title:clip(g.title),weekly_target:g.weeklyTarget||1,this_week:d.checkins.filter(c=>c.goalId===g.id&&new Date(c.at)>=s&&new Date(c.at)<e).length}))},goals.length+' 个目标');
   }
   case 'get_mood':{
    const days=Math.min(30,Math.max(1,Number(a.days)||7));const since=dateKey(plusDays(now,-days+1));
    const rows=(ctx.journal||[]).filter(j=>j.date>=since&&Number.isInteger(j.mood)).map(j=>({date:j.date,mood:j.mood})).sort((x,y)=>x.date<y.date?-1:1);
    return ok({scale:'1 很低 · 5 很好',days:rows},'最近 '+days+' 天 · '+rows.length+' 条');
   }
   case 'get_journal':{
    const days=Math.min(14,Math.max(1,Number(a.days)||3));const since=dateKey(plusDays(now,-days+1));
    const rows=(ctx.journal||[]).filter(j=>j.date>=since&&j.note).map(j=>({date:j.date,mood:j.mood??null,note:clip(j.note,400)}));
    return ok({entries:rows},'最近 '+days+' 天 · '+rows.length+' 篇');
   }
   case 'search_records':{
    const hits=searchRecords(d,clip(a.query,40));
    return ok({results:hits.map(h=>({kind:h.kind,title:h.title,detail:h.sub}))},'「'+clip(a.query,12)+'」· '+hits.length+' 条');
   }
   case 'draft_task':case 'draft_event':case 'draft_goal':{
    const draft=makeDraft(name.slice(6),a,now);
    return {content:JSON.stringify({ok:true,draft_id:draft.id,note:'已画成铅笔草稿，等待用户落墨。不要声称已经写入。'}),trace:{name,label:t.label,note:draft.fields.title||draft.fields.name},draft};
   }
   case 'ask_user':{
    const question=clip(a.question,120).trim();if(!question)throw Error('问题是空的');
    const options=(Array.isArray(a.options)?a.options:[]).map(o=>clip(o,24).trim()).filter(Boolean).slice(0,3);
    return {content:JSON.stringify({ok:true,note:'问题已展示给用户；先按最稳妥的假设给出方案，并说明这一点。'}),trace:{name,label:t.label,note:question},question:{question,options}};
   }
   case 'remember':{
    const fact=clip(a.fact,200).trim();
    if(!fact)throw Error('内容是空的');
    if(SENSITIVE.test(fact))return {content:JSON.stringify({error:'这类信息属于敏感凭据或证件，不记录。'}),trace:{name,label:t.label,blocked:true,note:'敏感信息，未记录'}};
    const item=ctx.memory.facts.add(fact,'xiaoya');
    return {content:JSON.stringify({ok:true}),trace:{name,label:t.label,note:fact},remembered:item};
   }
  }
 }catch(e){return {content:JSON.stringify({error:String(e.message).slice(0,160)}),trace:{name,label:t.label,blocked:true,note:String(e.message).slice(0,60)}}}
}

/** The system prompt reflects exactly what the user allowed; memory facts are included only with consent. */
export function systemPrompt({consent,facts=[],profile=null,now=new Date()}){
 const allowed=CATEGORIES.filter(c=>consent[c.key]).map(c=>c.label),denied=CATEGORIES.filter(c=>!consent[c.key]).map(c=>c.label);
 const wd='日一二三四五六'[now.getDay()];
 return ['你是「小芽」，陪伴一位大学生生活与成长的伙伴：温和、务实、简洁，像一个靠谱的学姐。',
  '现在是 '+dateKey(now)+' 周'+wd+' '+toHM(now.getHours()*60+now.getMinutes())+'（用户本地时间）。',
  '需要了解用户情况时，调用工具查询，不要凭空猜测；工具返回什么就说什么。',
  '用户允许你读取：'+(allowed.length?allowed.join('、'):'（无）')+'。'+(denied.length?'不允许：'+denied.join('、')+'——相关问题请如实说明看不到，并提示可在封底授权。':''),
  '你不能直接修改用户的数据。想帮用户安排时，用 draft_task / draft_event / draft_goal 画铅笔草稿，用户落墨后才生效；回复里要说「我画了 N 笔铅笔，你看看合不合适」，不要说已经安排好。',
  '排时间前先用 get_free_time 查空闲，避开已有的课程和活动；不要排在过去的时间。',
  '用户明确说「记住」或透露了稳定的偏好/作息时，可以用 remember 记下；不要记录密码、证件号、银行卡等。',
  '不做心理或医学诊断；如果用户情绪很低落，先共情，再温和地建议和信任的人或学校心理中心聊聊。',
  '回答用中文，一般不超过 180 字，必要时分点。',
  ...(consent.memory&&profile?.name?['用户希望被称呼为：'+clip(profile.name,24)+(profile.school||profile.major?'；'+clip([profile.school,profile.major].filter(Boolean).join(' '),60):'')]:[]),
  ...(consent.memory&&facts.length?['你记得关于用户的这些事：\n'+facts.slice(-40).map(f=>'- '+clip(f.text,120)).join('\n')]:[])
 ].join('\n');
}

class AgentError extends Error{constructor(message,code){super(message);this.code=code}}

/**
 * One conversational turn with tool calling.
 * model = {url, model, key}; history = [{role:'user'|'assistant', content}]; ctx as in runTool + {facts, profile}.
 * Returns {text, trace:[...], drafts:[...], remembered:[...], mode:'tools'|'plain'}.
 */
export async function runAgent({question,model,history=[],ctx,fetchImpl=globalThis.fetch,maxRounds=4,signal}){
 const consent=ctx.consent;const trace=[],drafts=[],remembered=[],questions=[];
 const sys=systemPrompt({consent,facts:consent.memory?(ctx.facts||[]):[],profile:ctx.profile,now:ctx.now});
 const messages=[{role:'system',content:sys},...history.slice(-12).map(m=>({role:m.role,content:clip(m.content,1500)})),{role:'user',content:clip(question,2000)}];
 const tools=toolSpecs(consent);
 const call=async(body)=>{
  const r=await fetchImpl(model.url,{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+model.key},body:JSON.stringify({model:model.model,max_tokens:700,temperature:.4,...body}),signal});
  if(r.status===401||r.status===403)throw new AgentError('密钥被服务商拒绝（HTTP '+r.status+'）','auth');
  if(!r.ok){let detail='';try{detail=JSON.stringify(await r.json()).slice(0,300)}catch{}throw new AgentError('HTTP '+r.status,r.status===400&&/tool|function/i.test(detail)?'no-tools':'http')}
  const j=await r.json();const msg=j?.choices?.[0]?.message;if(!msg)throw new AgentError('模型没有返回内容','empty');return msg;
 };
 let mode='tools';
 for(let round=0;round<maxRounds;round++){
  let msg;
  try{msg=await call({messages,tools,tool_choice:round===maxRounds-1?'none':'auto'})}
  catch(e){
   if(e.code==='no-tools'&&round===0){mode='plain';break}
   throw e;
  }
  const calls=Array.isArray(msg.tool_calls)?msg.tool_calls.slice(0,8):[];
  if(!calls.length){
   const text=typeof msg.content==='string'?msg.content.trim():'';
   if(!text)throw new AgentError('模型没有返回内容','empty');
   return {text:text.slice(0,6000),trace,drafts,remembered,questions,mode};
  }
  messages.push({role:'assistant',content:msg.content||'',tool_calls:calls});
  for(const c of calls){
   let args={};try{args=JSON.parse(c.function?.arguments||'{}')}catch{}
   const r=runTool(c.function?.name,args,ctx);
   trace.push(r.trace);if(r.draft)drafts.push(r.draft);if(r.remembered)remembered.push(r.remembered);if(r.question)questions.push(r.question);
   messages.push({role:'tool',tool_call_id:c.id,content:r.content});
  }
 }
 if(mode==='plain'){
  // The provider/model does not support tool calling: answer from a compact snapshot of what the user allowed.
  const snap=snapshot(ctx);
  trace.push({name:'snapshot',label:'摘要',note:'这个模型不支持工具调用，改为附带已授权内容的摘要'+(snap.cats.length?'（'+snap.cats.join('、')+'）':'')});
  const msg=await call({messages:[{role:'system',content:sys+'\n（本模型无法调用工具；以下是用户已授权的记录摘要，无法画铅笔草稿，请建议用户在页面上操作。）\n'+snap.text},...messages.slice(1)]});
  const text=typeof msg.content==='string'?msg.content.trim():'';if(!text)throw new AgentError('模型没有返回内容','empty');
  return {text:text.slice(0,6000),trace,drafts,remembered,questions,mode};
 }
 return {text:drafts.length?'我画了 '+drafts.length+' 笔铅笔，你看看合不合适。':'我查了一圈，但没整理出结论。换个问法试试？',trace,drafts,remembered,questions,mode};
}
function snapshot(ctx){
 const parts=[],cats=[];const run=(name,args)=>JSON.parse(runTool(name,args,ctx).content);
 const today=dateKey(ctx.now||new Date());
 if(ctx.consent.schedule){cats.push('日程');parts.push('今天起 3 天日程：'+JSON.stringify(run('get_schedule',{from:today,days:3}).items||[]));parts.push('今天空闲：'+JSON.stringify(run('get_free_time',{date:today}).windows||[]))}
 if(ctx.consent.tasks){cats.push('事项');parts.push('事项：'+JSON.stringify((run('get_tasks',{}).tasks||[]).slice(0,15)))}
 if(ctx.consent.goals){cats.push('目标');parts.push('目标：'+JSON.stringify(run('get_goals',{}).goals||[]))}
 if(ctx.consent.mood){cats.push('心情');parts.push('心情：'+JSON.stringify(run('get_mood',{days:7}).days||[]))}
 return {text:parts.join('\n').slice(0,5000),cats};
}

// ---------- local (no model) companions ----------
/** "记住…" / "忘掉…" / "你记得什么" handled on-device. Returns null when the text is not a memory command. */
export function memoryCommand(text){
 const s=String(text||'').trim();
 let m=s.match(/^(?:请|帮我)?(?:记住|记一下|记得)[：:，,\s]*(.+)$/);if(m)return {op:'add',text:m[1].replace(/[。.!！]+$/,'')};
 m=s.match(/^(?:请|帮我)?(?:忘掉|忘记|别记)[：:，,\s]*(.+)$/);if(m)return {op:'forget',text:m[1].replace(/[。.!！]+$/,'')};
 if(/^(?:你)?(?:都)?记得(?:我)?(?:些)?什么|你知道我(?:什么|哪些)|你记住了什么/.test(s))return {op:'list'};
 return null;
}
export const isPlanRequest=s=>/(?:帮我)?(?:排|安排|规划|计划)(?:一下)?(?:今天|今日|今晚|下午|剩下)|AI\s*排今天/.test(String(s||''));

/** How much a plan asks of the day. Budget = total focus minutes; block = longest single sitting. */
export const INTENSITIES=Object.freeze({
 light:{key:'light',label:'轻松',max:2,budget:100,block:50,goals:false},
 balanced:{key:'balanced',label:'平衡',max:4,budget:200,block:60,goals:true},
 sprint:{key:'sprint',label:'冲刺',max:6,budget:320,block:90,goals:true}
});
const FOCUS='专注：';
const hm=m=>toHM(Math.round(m));
/**
 * 小芽的今日方案 (local engine). Understand → analyse → plan with reasons. Never writes.
 * Returns {date, intensity, drafts:[{n,…draft}], looked:[…], reasons:[…], summary, review, minutes:{course,act,work,goal}, options}.
 * - Splits work longer than one sitting ("第 1/3 步"), clears near deadlines first, adds one goal block when
 *   the week is behind, leaves 10 minutes between blocks, and trims the day when yesterday's plan slipped.
 * - Skips work that already has a 专注 block today (so a plan that was inked is not planned twice).
 */
export function planDay(data,date,{now=new Date(),intensity='balanced',journal=[],facts=[],variant=0,_quick=false}={}){
 const I=INTENSITIES[intensity]||INTENSITIES.balanced;
 const isToday=date===dateKey(now);
 const occ=occurrences(data,new Date(date+'T00:00'),plusDays(new Date(date+'T00:00'),1));
 const courseMin=occ.filter(o=>o.kind==='course').reduce((n,o)=>n+(new Date(o.endsAt)-new Date(o.startsAt))/60000,0);
 const actMin=occ.filter(o=>o.kind!=='course'&&!String(o.name).startsWith(FOCUS)).reduce((n,o)=>n+(new Date(o.endsAt)-new Date(o.startsAt))/60000,0);
 const already=new Set(occ.map(o=>String(o.name)).filter(n=>n.startsWith(FOCUS)).map(n=>n.slice(FOCUS.length).replace(/\s*·.*$/,'')));
 // Yesterday: what Xiaoya's plan put on the page, and what of it actually got done.
 const y=dateKey(plusDays(new Date(date+'T12:00'),-1));
 const yPlanned=data.events.filter(e=>e.date===y&&String(e.name).startsWith(FOCUS)).map(e=>String(e.name).slice(FOCUS.length).replace(/\s*·.*$/,''));
 const yDone=yPlanned.filter(t=>data.tasks.some(k=>k.title===t&&k.done&&k.completedAt&&dateKey(new Date(k.completedAt))<=y)).length;
 const yMood=journal.find(j=>j.date===y)?.mood??null;
 const slipped=yPlanned.length>0&&yDone<yPlanned.length;
 const tired=(yMood!=null&&yMood<=2)||facts.some(f=>/累|疲|别排太满/.test(f.text||''));
 let budget=I.budget*(slipped||tired?0.8:1);
 // Free time, today counted from now (+5 min to get going). Variant 1 prefers later windows.
 const lead=isToday?5:0;
 let windows=freeWindows(data,date,{now,minimum:25}).map(w=>({from:Math.ceil((toMin(w.start)+lead)/5)*5,to:toMin(w.end)})).filter(w=>w.to-w.from>=25);
 if(variant%2===1)windows=[...windows].reverse();
 const freeTotal=windows.reduce((n,w)=>n+w.to-w.from,0);
 const horizon=plusDays(new Date(date+'T23:59'),7);
 const urgency=t=>t.due?(new Date(t.due)-new Date(date+'T12:00'))/3600000:1e4; // hours until due
 const work=data.tasks.filter(t=>!t.done&&!already.has(t.title)&&(!t.due||new Date(t.due)<=horizon)).sort((a,b)=>urgency(a)-urgency(b));
 const s=monday(new Date(date+'T12:00')),e=plusDays(s,7);
 const behind=data.goals.filter(g=>!g.done).map(g=>({g,n:data.checkins.filter(c=>c.goalId===g.id&&new Date(c.at)>=s&&new Date(c.at)<e).length,target:g.weeklyTarget||1})).filter(x=>x.n<x.target&&!already.has(x.g.title));
 const items=[];
 for(const t of work){
  const total=Math.max(15,t.minutes||30),steps=Math.max(1,Math.ceil(total/I.block)),len=Math.min(I.block,Math.ceil(total/steps/5)*5);
  const h=urgency(t);
  const why=h<0?'已经逾期，尽快补上':h<=36?(total<=60?'截止很近、量不大，先清掉':'截止很近，先做最关键的一段'):steps>1?(slipped&&yPlanned.includes(t.title)?'昨天没动，拆成 '+steps+' 小步更容易开始':'量比较大，拆成 '+steps+' 步，今天先做第 1 步'):t.due?'离截止还有 '+Math.round(h/24)+' 天，提前推进一点':'口袋里的小事，顺手做掉';
  items.push({kind:'work',title:t.title,len,step:steps>1?1:0,steps,why,due:t.due,tag:h<0?'逾期':h<=36?'最急':t.due?shortDue(t.due,date):'口袋'});
 }
 if(I.goals&&behind.length){const b=behind[0];items.splice(Math.min(2,items.length),0,{kind:'goal',title:b.g.title,len:30,why:'本周 '+b.n+'/'+b.target+' 次，留 30 分钟',tag:'目标'})}
 const drafts=[];let used=0;
 for(const it of items){
  if(drafts.length>=I.max||used+it.len>budget+10)continue;
  // Goals like a later slot (after classes); work takes the earliest window that fits.
  const pool=it.kind==='goal'?[...windows].sort((a,b)=>(b.from>=15*60)-(a.from>=15*60)):windows;
  const w=pool.find(x=>x.to-x.from>=it.len);if(!w)continue;
  const start=w.from,end=start+it.len;w.from=end+10;used+=it.len;
  const name=FOCUS+it.title+(it.steps>1?' · 第 '+it.step+'/'+it.steps+' 步':'');
  const d=makeDraft('event',{title:name,date,start:hm(start),end:hm(end),reason:it.why},now);
  // Stable id (task + slot), so removing a step or pointing at it survives re-rendering.
  drafts.push({...d,id:'p'+stableHash(it.kind+'|'+it.title+'|'+date+'|'+hm(start)),n:drafts.length+1,kind:it.kind,task:it.title,tag:it.tag,minutes:it.len});
 }
 drafts.sort((a,b)=>a.fields.start<b.fields.start?-1:1).forEach((d,i)=>d.n=i+1);
 const dueSoon=data.tasks.filter(t=>!t.done&&t.due&&new Date(t.due)<=plusDays(new Date(date+'T12:00'),7));
 const looked=[
  '今天的课表与活动：'+(occ.length?occ.map(o=>o.startsAt.slice(11,16)+' '+String(o.name).slice(0,12)).join('、'):'没有'),
  '7 天内截止：'+(dueSoon.length?dueSoon.slice(0,4).map(t=>String(t.title).slice(0,10)).join('、')+(dueSoon.length>4?' 等 '+dueSoon.length+' 项':''):'没有'),
  '还空着：'+(windows.length?[...windows].sort((a,b)=>a.from-b.from).map(w=>hm(w.from)+'–'+hm(w.to)).join('、'):'今天没有成段的空闲'),
  '昨天：'+(yPlanned.length?'计划 '+yPlanned.length+' 件，完成 '+yDone+' 件':'没有用小芽的方案')+(yMood!=null?'，心情 '+yMood+'/5':''),
  ...(facts.length?['记得的事：'+facts.slice(-2).map(f=>'「'+String(f.text).slice(0,14)+'」').join('')]:[])];
 const summary=!drafts.length?(freeTotal<25?'今天几乎没有成段的空闲，就不再往里塞了。':'今天没有需要排的事，空着的时间留给你自己。'):
  (slipped||tired?'昨天'+(slipped?'计划没做完':'有点累')+'，今天量减一点：':'按「'+I.label+'」来：')+'排了 '+drafts.length+' 笔，共 '+Math.round(used/6)/10+' 小时，'+(freeTotal-used>=90?'其余时间留给你。':'剩下的空当不多了。');
 // What the other two intensities would give (count + minutes), so the choice is informed.
 const options=_quick?{}:Object.fromEntries(Object.keys(INTENSITIES).map(k=>{if(k===I.key)return [k,{count:drafts.length,minutes:used}];
  const o=planDay(data,date,{now,intensity:k,journal,facts,variant,_quick:true});return [k,{count:o.drafts.length,minutes:o.drafts.reduce((n,d)=>n+d.minutes,0)}]}));
 return {date,intensity:I.key,drafts,looked,summary,review:{planned:yPlanned.length,done:yDone,mood:yMood,slipped,tired},
  minutes:{course:Math.round(courseMin),act:Math.round(actMin),work:drafts.filter(d=>d.kind==='work').reduce((n,d)=>n+d.minutes,0),goal:drafts.filter(d=>d.kind==='goal').reduce((n,d)=>n+d.minutes,0),free:freeTotal},options};
}
/** The instruction a connected model gets for 「用模型想一版」: same contract as the local engine. */
export function planPrompt(intensity='balanced'){
 const I=INTENSITIES[intensity]||INTENSITIES.balanced;
 return '请帮我把今天剩下的时间排一下，强度「'+I.label+'」：最多 '+I.max+' 块，合计不超过 '+I.budget+' 分钟，单块不超过 '+I.block+' 分钟，块与块之间留 10 分钟。'+
  '先查空闲时间、7 天内截止和目标；大任务拆小，只排今天该做的那一步。每一块都用 draft_event 画出，名称以「专注：」开头，reason 用 20 字内说明为什么这样排。'+
  '信息不确定、会影响安排（例如提交方式、预计时长）就用 ask_user 问我，不要猜。最后用一两句话说明整体思路。';
}
function stableHash(s){let h=2166136261;for(const ch of String(s)){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0}return h.toString(36)}
function shortDue(due,date){const d=Math.round((new Date(due.slice(0,10)+'T12:00')-new Date(date+'T12:00'))/86400000);return d<=0?'今天截止':d===1?'明天截止':'周'+'日一二三四五六'[new Date(due).getDay()]+'截止'}

/**
 * Local day planner: fit pending work into today's real free windows, most urgent first.
 * Produces event drafts (focus blocks) — never writes. Max 4 blocks, 10-minute breathing room between.
 */
export function planDayLocal(data,date,{now=new Date(),intensity='balanced',journal=[],facts=[]}={}){
 return planDay(data,date,{now,intensity,journal,facts}).drafts;
}

/**
 * Paste-to-extract: split a pasted notice / chat message into lines and parse each with the one-line parser.
 * Keeps tasks with a deadline, timed events and explicit todos; returns drafts (nothing is written).
 */
export function extractFromText(text,now=new Date()){
 const lines=String(text||'').replace(/\r/g,'').split(/\n+|[；;]|(?<=[。！!])\s*/).map(s=>s.replace(/^[\s\-•·*\d.、)）]+/,'').trim()).filter(s=>s.length>=4&&s.length<=200);
 const out=[],seen=new Set();
 for(const line of lines.slice(0,40)){
  let p;try{p=parseLine(line,now)}catch{continue}
  if(!p||p.intent==='question'||p.intent==='goal')continue;
  if(p.intent==='task'&&!p.fields.due&&!/(要|需|记得|别忘|提交|交|带|准备|报名|买)/.test(line))continue;
  const key=p.intent+'|'+(p.fields.title||p.fields.name)+'|'+(p.fields.due||p.fields.date||'');
  if(seen.has(key))continue;seen.add(key);
  out.push({id:draftId(),intent:p.intent,fields:p.fields,reason:'来自：'+clip(line,60)});
 }
 return out.slice(0,12);
}
/** Human-readable one-liner for a draft card. */
export function draftSummary(d){
 const f=d.fields;
 if(d.intent==='event')return {kind:'活动',title:f.name,when:f.date.slice(5).replace('-','/')+' '+f.start+'–'+f.end+(f.place?' · '+f.place:'')};
 if(d.intent==='task')return {kind:'事项',title:f.title,when:f.due?f.due.slice(5).replace('T',' ').replace('-','/')+' 截止 · 约 '+f.minutes+' 分钟':'口袋 · 约 '+f.minutes+' 分钟'};
 return {kind:'目标',title:f.title,when:'每周 '+f.weeklyTarget+' 次'};
}
