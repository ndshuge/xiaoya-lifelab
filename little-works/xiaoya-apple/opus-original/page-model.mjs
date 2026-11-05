// Pure view-models for the Pencil & Ink page. No DOM, storage or network.
// Ink   = records the user saved (courses, events, deadlines, check-ins, journal).
// Pencil = proposals produced by the existing rule engines; never written until approved.
import {dateKey,plusDays,monday,weekday,occurrences,calendarConflicts,freeSlots,growth,teachingWeek} from '../domain.js';

const pad=n=>String(n).padStart(2,'0');
const toMin=s=>{const [h,m]=String(s).split(':').map(Number);return h*60+m};
const hhmm=d=>pad(d.getHours())+':'+pad(d.getMinutes());
export const DAYNAMES=['周一','周二','周三','周四','周五','周六','周日'];
export const shortDay=key=>{const d=new Date(key+'T12:00');return (d.getMonth()+1)+'/'+d.getDate()+' '+DAYNAMES[weekday(d)]};

/** Minutes since local midnight of `date`, clamped into the day. */
function minutesInDay(stamp,date){
 const d=new Date(stamp),start=new Date(date+'T00:00');
 return Math.max(0,Math.min(1440,Math.round((+d-+start)/60000)));
}
/** Greedy lane assignment so overlapping blocks sit side by side instead of hiding each other. */
export function assignLanes(blocks){
 const sorted=[...blocks].sort((a,b)=>a.top-b.top||b.bottom-a.bottom);
 const groups=[];let current=null;
 for(const b of sorted){
  if(!current||b.top>=current.end){current={items:[],end:b.bottom};groups.push(current)}
  current.items.push(b);current.end=Math.max(current.end,b.bottom);
 }
 for(const g of groups){
  const lanes=[];
  for(const b of g.items){
   let lane=lanes.findIndex(end=>end<=b.top);
   if(lane<0){lane=lanes.length;lanes.push(b.bottom)}else lanes[lane]=b.bottom;
   b.lane=lane;
  }
  for(const b of g.items)b.lanes=lanes.length;
 }
 return sorted;
}
/**
 * Recurring courses/events that would normally happen on `date` but carry a cancel/replace exception there.
 * Shown as struck-through ghosts so a 停课 or 调课 stays visible and reversible.
 */
export function cancelledOn(data,date){
 const from=new Date(date+'T00:00'),until=plusDays(from,1),out=[];
 for(const [kind,key] of [['course','courses'],['event','events']])for(const x of data[key]){
  if(x.date)continue;
  const ex=(x.exceptions||[]).find(e=>e.date===date&&(e.type==='cancel'||e.type==='replace'));if(!ex)continue;
  const plain={...data,courses:kind==='course'?[{...x,exceptions:[]}]:[],events:kind==='event'?[{...x,exceptions:[]}]:[]};
  const normal=occurrences(plain,from,until).find(o=>o.date===date);if(!normal)continue;
  out.push({kind,id:x.id,title:x.name,place:x.place||'',start:normal.start,end:normal.end,exception:ex.type,
   target:ex.type==='replace'?{date:ex.targetDate||ex.date,start:ex.start,end:ex.end,place:ex.place??x.place??''}:null});
 }
 return out;
}
/** Write (or clear) the exception for one occurrence of a recurring course/event; returns a new item. */
export function withException(item,date,change){
 const rest=(item.exceptions||[]).filter(e=>e.date!==date);
 if(!change)return {...item,exceptions:rest};
 if(change.type==='cancel')return {...item,exceptions:[...rest,{date,type:'cancel'}]};
 if(change.type==='replace')return {...item,exceptions:[...rest,{date,type:'replace',targetDate:change.targetDate,start:change.start,end:change.end,...(change.place!==undefined?{place:change.place}:{})}]};
 throw Error('不支持的例外类型');
}
/** Flatten engine proposals into time-placed pencil strokes. */
export function pencilStrokes(candidates){
 const out=[];
 for(const c of candidates||[]){
  const a=c.action;if(!a||!a.start||!a.end)continue;
  const steps=a.steps?.length?a.steps:[{start:a.start,end:a.end,title:a.title}];
  steps.forEach((s,i)=>out.push({id:c.id,step:i,steps:steps.length,title:s.title||a.title,start:s.start,end:s.end,
   date:s.start.slice(0,10),kind:a.type,candidate:c}));
 }
 return out;
}
/**
 * Day ribbon: ink blocks, pencil strokes, deadline lines, and a sensible visible hour range.
 * Deadlines are moments (lines), never areas — a due time is not a work session.
 */
export function buildDay(data,date,{now=new Date(),pencils=[]}={}){
 const from=new Date(date+'T00:00'),until=plusDays(from,1);
 const occ=occurrences(data,from,until);
 const conflicts=calendarConflicts(data,from,until).filter(c=>c.date===date);
 const conflictIds=new Set(conflicts.flatMap(c=>[c.a.occurrenceId,c.b.occurrenceId]));
 const blocks=occ.map(o=>({type:'ink',kind:o.kind,id:o.id,occurrenceId:o.occurrenceId,title:o.name,place:o.place||'',
  recurring:!(data[o.kind==='course'?'courses':'events'].find(x=>x.id===o.id)?.date),
  movedFrom:o.originalDate||'',occurrenceDate:o.originalDate||date,
  start:o.startsAt.slice(11,16),end:o.endsAt.slice(11,16),top:minutesInDay(o.startsAt,date),bottom:minutesInDay(o.endsAt,date),
  conflict:conflictIds.has(o.occurrenceId),fromAgent:!!o.source&&/Agent/.test(o.source),goalId:o.goalId||'',taskId:o.taskId||'',
  step:o.stepId?(t=>t?{id:t.id,done:!!t.done}:null)(data.tasks.find(t=>t.id===o.stepId)):null}));
 // A step task created with an approved work block is checked off on the block itself, not drawn as a deadline.
 const stepIds=new Set(blocks.filter(b=>b.step).map(b=>b.step.id));
 const raw=pencils.filter(p=>p.date===date).map(p=>({type:'pencil',id:p.id,step:p.step,steps:p.steps,title:p.title,
  start:p.start.slice(11,16),end:p.end.slice(11,16),top:minutesInDay(p.start,date),bottom:minutesInDay(p.end,date),candidate:p.candidate,others:[]}));
 // Proposals that want the same free time are alternatives, not parallel work: stack them under the
 // highest-priority one (input order is the engine's severity order). Approving one re-plans the rest.
 // Stacking is decided per proposal: a split task is either fully shown or fully stacked.
 const strokes=[],stackedIds=new Set();
 for(const id of [...new Set(raw.map(s=>s.id))]){
  const mine=raw.filter(s=>s.id===id);
  const host=strokes.find(h=>mine.some(s=>s.top<h.bottom&&s.bottom>h.top));
  if(host){stackedIds.add(id);if(!host.others.some(o=>o.id===id))host.others.push({id,title:mine[0].title});}
  else strokes.push(...mine);
 }
 const deadlines=data.tasks.filter(t=>t.due&&t.due.slice(0,10)===date&&!stepIds.has(t.id)).map(t=>({id:t.id,title:t.title,time:t.due.slice(11,16),
  at:minutesInDay(t.due,date),done:!!t.done,type:t.type||'task',overdue:!t.done&&+new Date(t.due)<+now,minutes:t.minutes||null,parentId:t.parentId||''}))
  .sort((a,b)=>a.at-b.at);
 const ghosts=cancelledOn(data,date).map(g=>({...g,type:'ghost',top:minutesInDay(date+'T'+g.start,date),bottom:minutesInDay(date+'T'+g.end,date)}));
 for(const g of ghosts)if(g.bottom<=g.top)g.bottom=1440;
 const marks=[...blocks,...strokes,...ghosts].flatMap(b=>[b.top,b.bottom]).concat(deadlines.map(d=>d.at));
 const isToday=date===dateKey(now),nowMin=isToday?now.getHours()*60+now.getMinutes():null;
 if(nowMin!==null)marks.push(nowMin);
 // Today starts one hour before the earlier of "now" and the first record, so the page opens on what is
 // still ahead without hiding anything that happened today. Other days use a calm 08–22 frame.
 const firstHour=marks.length?Math.floor(Math.min(...marks)/60):8;
 let startHour=isToday?Math.min(firstHour,Math.floor(nowMin/60)-1):Math.min(8,firstHour);
 let endHour=Math.max(22,...marks.map(m=>Math.ceil(m/60)));
 startHour=Math.max(0,startHour);endHour=Math.min(24,endHour);
 if(endHour-startHour<4)startHour=Math.max(0,endHour-4);
 // Ghosts share lanes with real blocks so a cancelled class is never hidden under what replaced its time.
 const laid=assignLanes([...blocks,...strokes,...ghosts]);
 return {date,isToday,nowMin,startHour,endHour,blocks:laid.filter(b=>b.type!=='ghost'),ghosts,deadlines,conflicts,
  counts:{courses:blocks.filter(b=>b.kind==='course').length,events:blocks.filter(b=>b.kind==='event').length,pencils:new Set(strokes.map(s=>s.id)).size}};
}
/**
 * Piecewise time scale for the day ribbon. Long stretches with nothing in them are squeezed into a
 * fixed band, so free time reads as a quantity ("空着 3 小时") instead of a wall of empty rows.
 * Returns segments [{y0,y1,m0,m1,band,free}] plus y(minute) and minuteAt(y).
 */
export function timeMap(day,{hour=56,minGap=150,edge=30,band=54}={}){
 const start=day.startHour*60,end=day.endHour*60,busy=[];
 for(const b of day.blocks)busy.push([b.top,b.bottom]);
 for(const g of day.ghosts||[])busy.push([g.top,g.bottom]);
 for(const d of day.deadlines)busy.push([d.at-25,d.at+25]);
 if(day.nowMin!=null)busy.push([day.nowMin-25,day.nowMin+25]);
 busy.sort((a,b)=>a[0]-b[0]);
 const merged=[];
 for(const [a,b] of busy){const s=Math.max(start,a),e=Math.min(end,b);if(e<=s)continue;const last=merged[merged.length-1];if(last&&s<=last[1])last[1]=Math.max(last[1],e);else merged.push([s,e])}
 const gaps=[];let cur=start;
 for(const [a,b] of merged){if(a-cur>=minGap)gaps.push([cur,a]);cur=Math.max(cur,b)}
 if(end-cur>=minGap)gaps.push([cur,end]);
 const segments=[];let y=0,m=start;
 const push=(m1,isBand,free)=>{if(m1<=m)return;const h=isBand?band:(m1-m)/60*hour;segments.push({y0:y,y1:y+h,m0:m,m1,band:isBand,free:free||null});y+=h;m=m1};
 for(const [a,b] of gaps){
  const from=a===start?a:a+edge,to=b===end?b:b-edge;
  if(to-from<60)continue;
  push(from,false);push(to,true,{from:a,to:b,minutes:b-a});
 }
 push(end,false);
 const yAt=min=>{const s=segments.find(x=>min>=x.m0&&min<=x.m1)||(min<start?segments[0]:segments[segments.length-1]);if(!s)return 0;if(s.band)return s.y0+(s.y1-s.y0)*((min-s.m0)/Math.max(1,s.m1-s.m0));return s.y0+(Math.max(s.m0,Math.min(s.m1,min))-s.m0)/60*hour};
 const minuteAt=py=>{const s=segments.find(x=>py>=x.y0&&py<=x.y1)||segments[segments.length-1];if(!s)return start;if(s.band)return s.free.from;return s.m0+(py-s.y0)/hour*60};
 return {segments,height:y,y:yAt,minuteAt,hour};
}
/** Week overview — one row/column per day with ink, deadline flags and pencil counts. */
export function buildWeek(data,weekStart,{now=new Date(),pencils=[]}={}){
 const start=monday(weekStart),end=plusDays(start,7);
 const occ=occurrences(data,start,end),conflicts=calendarConflicts(data,start,end);
 const conflictIds=new Set(conflicts.flatMap(c=>[c.a.occurrenceId,c.b.occurrenceId]));
 const stepIds=new Set(data.events.filter(e=>e.stepId).map(e=>e.stepId));
 const days=Array.from({length:7},(_,i)=>{
  const d=plusDays(start,i),key=dateKey(d);
  const items=occ.filter(o=>o.date===key).map(o=>({kind:o.kind,id:o.id,title:o.name,start:o.startsAt.slice(11,16),end:o.endsAt.slice(11,16),place:o.place||'',conflict:conflictIds.has(o.occurrenceId),minutes:(new Date(o.endsAt)-new Date(o.startsAt))/60000,
   recurring:!(data[o.kind==='course'?'courses':'events'].find(x=>x.id===o.id)?.date),occurrenceDate:o.originalDate||key,moved:!!o.originalDate}));
  const ghosts=cancelledOn(data,key);
  const due=data.tasks.filter(t=>t.due&&t.due.slice(0,10)===key&&!stepIds.has(t.id)).map(t=>({id:t.id,title:t.title,time:t.due.slice(11,16),done:!!t.done,type:t.type||'task'}));
  const busy=items.reduce((n,x)=>n+x.minutes,0);
  return {key,date:d,label:DAYNAMES[i],dom:d.getDate(),isToday:key===dateKey(now),isPast:key<dateKey(now),items,ghosts,due,
   pencils:pencils.filter(p=>p.date===key).length,busyMinutes:busy};
 });
 const tasksDue=data.tasks.filter(t=>t.due&&!stepIds.has(t.id)&&new Date(t.due)>=start&&new Date(t.due)<end);
 return {start:dateKey(start),end:dateKey(plusDays(start,6)),days,conflicts:conflicts.length,teachingWeek:teachingWeek(data,start),
  dueCount:tasksDue.length,dueDone:tasksDue.filter(t=>t.done).length};
}
/** Long line: past weeks of ink knots, current week, and pencil intentions from an adaptive plan. */
export function buildLongLine(data,journal,{now=new Date(),past=5,future=3,plan=null}={}){
 const anchor=monday(now);
 const weeks=Array.from({length:past+1+future},(_,i)=>{const s=plusDays(anchor,(i-past)*7);return {index:i-past,start:dateKey(s),label:(s.getMonth()+1)+'/'+s.getDate(),
  isCurrent:i===past,isFuture:i>past,from:s,to:plusDays(s,7)}});
 const g=growth(data,now);
 const moodByDate=new Map((journal||[]).filter(e=>e.mood!=null).map(e=>[e.date,e.mood]));
 const noteDates=new Set((journal||[]).filter(e=>e.note).map(e=>e.date));
 const moodRow=weeks.map(w=>Array.from({length:7},(_,d)=>{const k=dateKey(plusDays(w.from,d));return {date:k,mood:moodByDate.get(k)??null,note:noteDates.has(k),future:k>dateKey(now)}}));
 const goals=data.goals.map(goal=>{
  const target=Math.max(1,Math.min(7,Number(goal.weeklyTarget)||1));
  const planned=plan?.goals?.find(x=>x.id===goal.id);
  const cells=weeks.map(w=>{
   const knots=data.checkins.filter(c=>c.goalId===goal.id&&new Date(c.at)>=w.from&&new Date(c.at)<w.to).map(c=>({minutes:c.minutes,note:c.note||'',at:c.at}));
   const futureIdx=w.index;const intention=planned&&futureIdx>=0?planned.weeks?.[futureIdx]?.plannedActions??null:null;
   return {week:w.start,knots,target,intention,isFuture:w.isFuture,isCurrent:w.isCurrent};
  });
  const total=data.checkins.filter(c=>c.goalId===goal.id);
  const stageTasks=data.tasks.filter(t=>t.goalId===goal.id&&t.stageId);
  return {id:goal.id,title:goal.title,done:!!goal.done,target,category:goal.category||'',targetText:goal.target||'',kind:goal.kind||'goal',
   cells,totalCount:total.length,totalMinutes:total.reduce((n,c)=>n+c.minutes,0),route:goal.growthPlan||null,
   stages:stageTasks.map(t=>({id:t.id,title:t.title,done:!!t.done,due:t.due})),plannedRoute:planned?.choices?.find(c=>c.id===planned.selectedRouteId)?.name||null,
   reason:planned?(planned.modelReason||planned.reason):null};
 });
 const doneRow=weeks.map(w=>{const found=g.weeks.find(x=>x.start===w.start);return found?{done:found.done,checkins:found.checkins,minutes:found.minutes}:null});
 return {weeks,moodRow,goals,doneRow,current:g.current,previous:g.previous,hasEvidence:g.hasEvidence};
}
/** Xiaoya's one-line page header. Every clause is derived from saved data; nothing is guessed. */
export function headline(data,day,{now=new Date(),pencils=[],context=null}={}){
 const empty=!data.tasks.length&&!data.courses.length&&!data.events.length&&!data.goals.length;
 if(empty)return {text:'这一页还是空的。在下面写一行，比如「周五前交实验报告」，我会帮你找时间。',tone:'idle'};
 const parts=[];let tone='idle';
 const nowMin=day.nowMin;
 const inks=day.blocks.filter(b=>b.type==='ink');
 if(day.isToday){
  const next=inks.filter(b=>b.top>nowMin).sort((a,b)=>a.top-b.top)[0];
  const current=inks.find(b=>b.top<=nowMin&&b.bottom>nowMin);
  if(current)parts.push('现在是「'+current.title+'」，到 '+current.end);
  else if(next)parts.push('下一件是 '+next.start+' 的「'+next.title+'」');
  else if(inks.length)parts.push('今天的课和活动都已结束');
  else parts.push('今天没有课程或活动');
 }else{
  parts.push(inks.length?'这天有 '+inks.length+' 项课程或活动':'这天没有课程或活动');
 }
 if(day.conflicts.length){parts.push(day.conflicts[0].start+' 有两件事重叠');tone='care'}
 const openDue=day.deadlines.filter(d=>!d.done);
 if(openDue.length)parts.push('「'+openDue[0].title+'」'+openDue[0].time+' 截止'+(openDue.length>1?'，另有 '+(openDue.length-1)+' 项':''));
 else if(day.isToday){
  const tomorrow=dateKey(plusDays(now,1));const t=data.tasks.find(x=>!x.done&&x.due?.slice(0,10)===tomorrow);
  if(t)parts.push('「'+t.title+'」明天 '+t.due.slice(11,16)+' 截止');
 }
 const mine=pencils.filter(p=>p.date===day.date);
 if(mine.length){parts.push('我在 '+mine[0].start.slice(11,16)+' 画了一笔，等你决定');tone='remind'}
 if(context?.weather&&day.isToday){const w=context.weather.days.find(x=>x.date===context.tomorrow);if(w&&w.precipitationProbabilityMax>=60)parts.push(context.weather.cityLabel+'明天降水概率 '+w.precipitationProbabilityMax+'%')}
 return {text:parts.slice(0,3).join('，')+'。',tone};
}
/** What was actually inked on a given local date. Derived only from saved timestamps. */
export function dayRecap(data,date){
 const on=s=>{if(!s)return false;const d=new Date(s);return Number.isFinite(+d)&&dateKey(d)===date};
 const completed=data.tasks.filter(t=>t.done&&on(t.completedAt)).map(t=>t.title);
 const goalsDone=data.goals.filter(g=>g.done&&on(g.completedAt)).map(g=>g.title);
 const checkins=data.checkins.filter(c=>on(c.at));
 // An approved suggestion that was later erased keeps its decision record; it must not count as ink.
 const undone=new Set(data.transactions.filter(t=>t.status==='undone').map(t=>t.id));
 const approved=data.decisions.filter(d=>d.status==='executed'&&on(d.at)&&!undone.has(d.transactionId)).length;
 const strokes=data.transactions.filter(t=>t.status==='executed'&&on(t.at)).length;
 return {completed,goalsDone,checkinCount:checkins.length,checkinMinutes:checkins.reduce((n,c)=>n+c.minutes,0),approved,strokes,
  empty:!completed.length&&!goalsDone.length&&!checkins.length&&!approved&&!strokes};
}
/** Where Xiaoya's attention is on a day: the first pencil, else the first conflict. */
export function attentionOf(day){
 const pencil=day.blocks.find(b=>b.type==='pencil');
 if(pencil)return {kind:'pencil',id:pencil.id,minute:pencil.top,label:'我在这里画了一笔：'+pencil.title};
 const clash=day.blocks.find(b=>b.type==='ink'&&b.conflict);
 if(clash)return {kind:'conflict',minute:clash.top,label:clash.start+' 有两件事重叠'};
 return null;
}
/** Free time today/tomorrow, for questions like 「我什么时候有空」. */
export function freeWindows(data,date,{now=new Date(),minimum=45}={}){
 const from=date===dateKey(now)?now:new Date(date+'T08:00');
 const until=new Date(date+'T22:00');if(+from>=+until)return [];
 const out=[];let cursor=new Date(from);
 const busy=occurrences(data,new Date(date+'T00:00'),plusDays(new Date(date+'T00:00'),1)).map(o=>[new Date(o.startsAt),new Date(o.endsAt)]).sort((a,b)=>a[0]-b[0]);
 for(const [s,e] of [...busy,[until,until]]){
  const end=new Date(Math.min(+s,+until));
  if((end-cursor)/60000>=minimum)out.push({start:hhmm(cursor),end:hhmm(end),minutes:Math.round((end-cursor)/60000)});
  cursor=new Date(Math.max(+cursor,+e));if(cursor>=until)break;
 }
 return out;
}
/**
 * Offline, rule-based answers grounded in saved data. Returns null when the question is out of scope,
 * so the caller can say honestly that a model is needed.
 */
/** Local search across saved records (never journal text). */
export function searchRecords(data,term){
 const q=String(term||'').trim().toLowerCase();if(!q)return [];
 const rows=[...data.tasks.map(x=>({kind:'task',id:x.id,title:x.title,sub:(x.due?'截止 '+x.due.replace('T',' '):'口袋')+(x.done?' · 已完成':'')})),
  ...data.events.map(x=>({kind:'event',id:x.id,title:x.name,sub:(x.date||DAYNAMES[x.day])+' '+x.start+(x.place?' · '+x.place:'')})),
  ...data.courses.map(x=>({kind:'course',id:x.id,title:x.name,sub:DAYNAMES[x.day]+' '+x.start+(x.place?' · '+x.place:'')})),
  ...data.goals.map(x=>({kind:'goal',id:x.id,title:x.title,sub:'每周 '+(x.weeklyTarget||1)+' 次'+(x.done?' · 已完成':'')}))];
 return rows.filter(r=>(r.title+' '+r.sub).toLowerCase().includes(q)).slice(0,12);
}
export function localAnswer(question,data,{now=new Date(),candidates=[],context=null,journal=[]}={}){
 const q=String(question||'');const today=dateKey(now),tomorrow=dateKey(plusDays(now,1));
 const find=q.match(/^(?:找|搜索|查找|搜)\s*(.+?)[？?]?$/);
 if(find){const hits=searchRecords(data,find[1]);return hits.length?{text:'找到 '+hits.length+' 条和「'+find[1]+'」有关的记录：',results:hits}:'没有找到和「'+find[1]+'」有关的事项、日程、课程或目标。（不搜索日记正文）'}
 const target=/明天/.test(q)?tomorrow:/后天/.test(q)?dateKey(plusDays(now,2)):today;
 const label=target===today?'今天':target===tomorrow?'明天':'后天';
 if(/空|有时间|空闲|free/.test(q)){
  const w=freeWindows(data,target,{now});
  return w.length?label+'在 08:00–22:00 之间较完整的空档：'+w.slice(0,3).map(x=>x.start+'–'+x.end+'（'+x.minutes+' 分钟）').join('、')+'。只计算了已记录的课程和活动。':label+'在 08:00–22:00 之间没有 45 分钟以上的空档（按已记录的日程）。';
 }
 if(/天气|下雨|雨|户外/.test(q)){
  if(context?.sources?.weather?.status!=='available')return '我没有已授权的天气数据。可以在封底「情境」里选城市并主动获取预报；不读取定位。';
  const w=context.weather.days.find(d=>d.date===target)||context.weather.days[0];
  return context.weather.cityLabel+' '+w.date+'：最大降水概率 '+w.precipitationProbabilityMax+'%，'+w.temperatureMinC+'–'+w.temperatureMaxC+'°C（Open-Meteo，城市级每日预报，不代表具体时段）。';
 }
 if(/心情|情绪|压力|累|焦虑/.test(q)){
  const recent=journal.filter(e=>e.mood!=null).slice(0,7);
  if(!context?.permissions?.mood)return '心情记录只存在这台设备上，我默认不读取。你可以在封底「情境」里允许我在本地结合今天的心情；日记正文不会被用于建议。';
  return recent.length?'你最近 '+recent.length+' 次记录的心情是 '+recent.map(e=>e.mood).join('、')+'（1–5）。这只是你自己的记录，不能说明原因，也不是健康判断。累的时候，先挑一件 15 分钟能完成的小事就好。':'你还没有记录心情。可以在今天这页的页脚写下。';
 }
 if(/目标|成长|坚持|进度|习惯/.test(q)){
  const goals=data.goals.filter(g=>!g.done);if(!goals.length)return '还没有进行中的目标。可以写一行「每周练两次架子鼓」，我会把它放到长线里。';
  const start=monday(now),end=plusDays(start,7);
  return goals.slice(0,3).map(g=>{const n=data.checkins.filter(c=>c.goalId===g.id&&new Date(c.at)>=start&&new Date(c.at)<end).length;return '「'+g.title+'」本周 '+n+'/'+(g.weeklyTarget||1)+' 次'}).join('；')+'。进度只来自你记录的真实行动。';
 }
 if(/冲突|重叠|撞/.test(q)){
  const c=calendarConflicts(data,monday(now),plusDays(monday(now),7));
  return c.length?'本周有 '+c.length+' 处时间重叠，最近的是 '+c[0].date.slice(5)+' '+c[0].start+'：「'+c[0].a.name+'」与「'+c[0].b.name+'」。':'本周已记录的课程和活动没有重叠。';
 }
 if(/截止|DDL|ddl|作业|考试|交/.test(q)){
  const due=data.tasks.filter(t=>!t.done&&t.due).sort((a,b)=>new Date(a.due)-new Date(b.due));
  return due.length?'最近的截止：'+due.slice(0,3).map(t=>'「'+t.title+'」'+t.due.slice(5,16).replace('T',' ')).join('；')+'。':'没有带截止时间的未完成事项。';
 }
 if(/先做|做什么|安排|今天|明天|下一步|计划/.test(q)){
  const top=candidates[0];
  const day=occurrences(data,new Date(target+'T00:00'),plusDays(new Date(target+'T00:00'),1));
  const head=label+'有 '+day.length+' 项课程或活动'+(day.length?'：'+day.slice(0,3).map(o=>o.startsAt.slice(11,16)+' '+o.name).join('、'):'')+'。';
  if(top)return head+'我最在意的是「'+top.title+'」——'+top.description+'。'+(top.action?'我已在页面上用铅笔画出建议时段，落墨前不会写入。':'');
  const due=data.tasks.filter(t=>!t.done&&t.due).sort((a,b)=>new Date(a.due)-new Date(b.due))[0];
  return head+(due?'最近要交的是「'+due.title+'」。':'目前没有需要调整的安排。');
 }
 return null;
}
export {toMin,hhmm};
