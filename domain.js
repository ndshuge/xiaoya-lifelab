// Local-only calendar, planning and evidence engine. No network or account access.
const pad=n=>String(n).padStart(2,'0');
export const stamp=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const dateKey=d=>stamp(d).slice(0,10);
export const weekday=d=>(d.getDay()+6)%7;
export const plusDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
export const monday=d=>{const x=plusDays(d,-weekday(d));x.setHours(0,0,0,0);return x};
export const newId=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
export const defaults=()=>({semester:{start:'',end:'',name:'我的学期'},reminders:[],checkins:[],transactions:[],revision:0});
export const reminderDefaults=()=>({leadMinutes:[1440,60],quietStart:'22:00',quietEnd:'08:00',reminderGap:60,reminderEnabled:true});
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&dateKey(new Date(s+'T12:00'))===s;
const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function teachingWeek(data,date=new Date()){
 const s=data.semester;if(!s?.start||!s?.end)return null;
 const key=dateKey(date);if(key<s.start||key>s.end)return 0;
 // UTC date arithmetic avoids DST changing teaching-week boundaries.
 const a=monday(new Date(s.start+'T12:00')),b=monday(date);
 return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/604800000)+1;
}
export function checkSemester(s){if(!validDate(s.start)||!validDate(s.end)||s.end<s.start||new Date(s.end)-new Date(s.start)>370*86400000)throw Error('学期日期需有效、结束不早于开始，且跨度不超过一年');return s}
export function checkSchedule(x){
 if(!String(x.name||'').trim()||x.name.length>160)throw Error('课程/活动名称需为1–160字');
 if(!validTime(x.start)||!validTime(x.end)||x.start===x.end)throw Error('起止时间需有效且不同；结束更早表示跨午夜');
 if(!Number.isInteger(+x.day)||+x.day<0||+x.day>6)throw Error('星期需为周一至周日');
 if(x.date&&!validDate(x.date))throw Error('单次日期无效');
 if(!['all','odd','even'].includes(x.parity||'all'))throw Error('单双周设置无效');
 if(+x.weekStart<1||+x.weekEnd>54||+x.weekStart>+x.weekEnd)throw Error('教学周范围需在1–54内');
 const exceptions=x.exceptions||[];const seen=new Set();
 for(const e of exceptions){if(!validDate(e.date)||seen.has(e.date)||!['cancel','replace','add'].includes(e.type))throw Error('例外日期无效、重复或类型不支持');seen.add(e.date);if(e.type!=='cancel'&&(!validDate(e.targetDate||e.date)||!validTime(e.start)||!validTime(e.end)||e.start===e.end))throw Error('例外的目标日期和时间无效')}
 return x;
}
function occurrence(x,kind,day,start=x.start,end=x.end,place=x.place){
 const a=new Date(day+'T'+start),b=new Date(day+'T'+end);if(b<=a)b.setDate(b.getDate()+1);
 return {...x,kind,date:day,start,end,place,startsAt:stamp(a),endsAt:stamp(b),occurrenceId:x.id+'@'+day};
}
export function occurrences(data,from=monday(new Date()),until=plusDays(from,7)){
 const out=[];const low=dateKey(plusDays(from,-1)),high=dateKey(until);
 for(const [kind,items] of [['course',data.courses],['event',data.events]])for(const x of items){
  for(let d=new Date(low+'T00:00');dateKey(d)<=high;d=plusDays(d,1)){
   const key=dateKey(d),week=teachingWeek(data,d);let active=x.date?key===x.date:weekday(d)===+x.day;
   if(!x.date&&week!==null)active=active&&week>0&&week>=+(x.weekStart||1)&&week<=+(x.weekEnd||54)&&((x.parity||'all')==='all'||x.parity==='odd'&&week%2===1||x.parity==='even'&&week%2===0);
   const ex=(x.exceptions||[]).find(e=>e.date===key);
   if(active&&!(ex&&['cancel','replace'].includes(ex.type)))out.push(occurrence(x,kind,key));
  }
  for(const e of x.exceptions||[])if(e.type!=='cancel'){
   const key=e.targetDate||e.date;if(key>=low&&key<=high)out.push({...occurrence(x,kind,key,e.start,e.end,e.place??x.place),originalDate:e.date,occurrenceId:x.id+'@'+e.date+'-exception'});
  }
 }
 return out.filter(x=>new Date(x.startsAt)<until&&new Date(x.endsAt)>from).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
export function calendarConflicts(data,from=monday(new Date()),until=plusDays(from,7)){
 const items=occurrences(data,from,until),out=[];
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const a=items[i],b=items[j],start=a.startsAt>b.startsAt?a.startsAt:b.startsAt,end=a.endsAt<b.endsAt?a.endsAt:b.endsAt;
  if(start<end)out.push({id:[a.occurrenceId,b.occurrenceId].sort().join('~')+':'+start,a,b,day:weekday(new Date(start)),date:start.slice(0,10),start:start.slice(11),end:end.slice(11),startsAt:start,endsAt:end});
 }return out;
}
export function freeSlots(data,from=new Date(),until=plusDays(from,7),minutes=30,ignore=[]){
 const busy=occurrences(data,from,until).filter(x=>!ignore.includes(x.id)),out=[];
 for(let day=new Date(dateKey(from)+'T00:00');day<until;day=plusDays(day,1)){
  let a=new Date(dateKey(day)+'T08:00'),end=new Date(dateKey(day)+'T22:00');a=new Date(Math.max(+a,+from));end=new Date(Math.min(+end,+until));
  a.setSeconds(0,0);if(a<from)a.setMinutes(a.getMinutes()+1);
  const intervals=busy.filter(x=>new Date(x.startsAt)<end&&new Date(x.endsAt)>a).map(x=>[new Date(x.startsAt),new Date(x.endsAt)]).sort((x,y)=>x[0]-y[0]);
  for(const [b,e] of [...intervals,[end,end]]){if(b-a>=minutes*60000)out.push({start:stamp(a),end:stamp(new Date(+a+minutes*60000)),availableMinutes:Math.floor((Math.min(+b,+end)-a)/60000)});a=new Date(Math.max(+a,+e));if(a>=end)break}
 }return out;
}
export const fingerprint=d=>JSON.stringify([d.semester,d.courses,d.events,d.tasks,d.goals]);
function hash(s){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0).toString(16)}
export const APPROVAL_PREVIEW_LEAD_MINUTES=5;
export function plans(data,now=new Date()){
 // Proposal review and user confirmation take time. Avoid suggesting an almost-expired slot.
 const earliest=new Date(+now+APPROVAL_PREVIEW_LEAD_MINUTES*60000);
 const result=[],version=fingerprint(data);const add=p=>{p.id=p.kind+':'+hash(JSON.stringify([p.sources,p.identity]));p.basis=version;p.createdAt=now.toISOString();delete p.identity;if(!data.decisions.some(d=>d.id===p.id&&['executed','rejected'].includes(d.status)))result.push(p)};
 for(const c of calendarConflicts(data,monday(now),plusDays(monday(now),7))){
  // Do not present a conflict from earlier this week as an upcoming active reminder.
  if(new Date(c.date+'T'+c.end)<=now)continue;
  const moving=[c.a,c.b].find(x=>x.kind==='event'&&!x.locked&&new Date(x.startsAt)>now);
  const duration=moving?(new Date(moving.endsAt)-new Date(moving.startsAt))/60000:0;
  const slots=moving?freeSlots(data,new Date(Math.max(+earliest,+new Date(c.date+'T08:00'))),new Date(c.date+'T22:00'),duration,[moving.id]):[];
  add({kind:'conflict',severity:0,title:slots.length?'给活动换一个空档':'发现时间重叠',description:`${c.a.name} 与 ${c.b.name} 在 ${c.date} ${c.start}–${c.end} 重叠`,reason:'依据：本周实际发生的课程/活动时间交集；课程保持固定。',sources:[{kind:c.a.kind,id:c.a.id},{kind:c.b.kind,id:c.b.id}],identity:[c.id,c.a.start,c.b.start],pet:'care',action:slots.length?{type:'moveEvent',eventId:moving.id,originalDate:moving.originalDate||moving.date,title:moving.name,minutes:duration,start:slots[0].start,end:slots[0].end,alternatives:slots.slice(0,3)}:null});
 }
 for(const t of data.tasks.filter(t=>!t.done&&t.due&&!t.parentId).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,5)){
  const deadline=new Date(t.due),ms=deadline-now;if(ms>7*86400000)continue;
  if(data.events.some(e=>e.taskId===t.id))continue;
  const duration=Math.max(15,Math.min(240,Number(t.minutes)||30)),split=duration>60,step=split?Math.ceil(duration/2):duration;
  const until=ms>0?deadline:plusDays(now,1),slots=freeSlots(data,earliest,until,step);
  const selected=slots[0],second=selected?freeSlots(data,new Date(selected.end),until,duration-step)[0]:null;
  const action=selected&&(!split||second)?{type:split?'splitTask':'planTask',taskId:t.id,title:t.title,minutes:duration,start:selected.start,end:selected.end,steps:split?[{start:selected.start,end:selected.end,title:'第一步 · '+t.title},{start:second.start,end:second.end,title:'第二步 · '+t.title}]:null,alternatives:slots.slice(0,3)}:null;
  add({kind:'deadline',severity:ms<0?0:ms<=86400000?1:2,title:action?(split?'把作业拆成两个可执行步骤':'为重要事项留出专注时间'):'截止前没有足够空档',description:`${t.title} · 截止 ${t.due.replace('T',' ')} · 预计 ${duration} 分钟`,reason:ms<0?'依据：事项已逾期；以下是补救时段，不代表已按时完成。':'依据：截止时间与实际课表/活动交集，候选位于 08:00–22:00 空档。',sources:[{kind:'task',id:t.id}],identity:[t.due,t.minutes],pet:'remind',action});
 }
 for(const g of data.goals.filter(g=>!g.done).slice(0,1))if(!result.length){const slots=freeSlots(data,earliest,plusDays(now,3),30);add({kind:'goal',severity:4,title:'给兴趣留一点时间',description:g.title,reason:'依据：你保存的进行中目标与未来三天的实际空档。',sources:[{kind:'goal',id:g.id}],identity:[g.title,g.target],pet:'idle',action:slots.length?{type:'planGoal',goalId:g.id,title:g.title,start:slots[0].start,end:slots[0].end,minutes:30,alternatives:slots.slice(0,3)}:null})}
 if(!data.tasks.length&&!data.courses.length&&!data.events.length&&!data.goals.length)result.push({id:'welcome',kind:'welcome',title:'从一件小事开始',description:'设置学期、导入课表，再记录一项作业。',reason:'依据：当前档案没有记录。',sources:[],action:null,pet:'idle'});
 return result.sort((a,b)=>a.severity-b.severity);
}
export function executePlan(data,p,now=new Date()){
 if(data.decisions.some(d=>d.id===p.id))throw Error('该建议已处理，不能重复执行');
 if(p.basis!==fingerprint(data))throw Error('来源已变化，建议已过期；请重新分析');
 if(!p.action)throw Error('没有可执行的空档，请手动调整');
 const a=p.action,steps=a.steps||[{start:a.start,end:a.end,title:a.title}];
 for(const s of steps){if(!Number.isFinite(+new Date(s.start))||!Number.isFinite(+new Date(s.end))||new Date(s.start)<now||new Date(s.end)<=new Date(s.start))throw Error('安排时间无效或已过去');
  if((new Date(s.end)-new Date(s.start))/60000!==(a.type==='splitTask'?(s===steps[0]?Math.ceil(a.minutes/2):a.minutes-Math.ceil(a.minutes/2)):a.minutes))throw Error('请保留方案的预计时长');
  if(occurrences(data,new Date(s.start),new Date(s.end)).some(x=>!(a.type==='moveEvent'&&x.id===a.eventId&&x.date===a.originalDate)))throw Error('所选时间已有冲突，请重新选择空档');
  const t=data.tasks.find(t=>t.id===a.taskId);if(t&&new Date(t.due)>now&&new Date(s.end)>new Date(t.due))throw Error('安排超过截止时间');
 }
 if(steps.length>1&&new Date(steps[0].end)>new Date(steps[1].start))throw Error('两个步骤不能重叠');
 const next=structuredClone(data),changes=[];
 const apply=(key,item)=>{const i=next[key].findIndex(x=>x.id===item.id),before=i>=0?structuredClone(next[key][i]):null;if(i>=0)next[key][i]=item;else next[key].push(item);changes.push({key,id:item.id,before,after:structuredClone(item)})};
 let task=null;
 if(a.type==='moveEvent'){
  const e=next.events.find(x=>x.id===a.eventId);if(!e||e.locked)throw Error('活动已不存在或不可移动');
  if(e.date)apply('events',{...e,date:a.start.slice(0,10),day:weekday(new Date(a.start)),start:a.start.slice(11),end:a.end.slice(11)});
  else apply('events',{...e,exceptions:[...(e.exceptions||[]).filter(x=>x.date!==a.originalDate),{date:a.originalDate,type:'replace',targetDate:a.start.slice(0,10),start:a.start.slice(11),end:a.end.slice(11)}]});
 }else if(['planTask','splitTask','planGoal'].includes(a.type)){
  for(const s of steps){
   if(a.type!=='planGoal'){task={id:newId(),title:s.title,type:'task',parentId:a.taskId,course:'',due:s.end,minutes:(new Date(s.end)-new Date(s.start))/60000,done:false,createdAt:now.toISOString()};apply('tasks',task)}
   apply('events',{id:newId(),name:s.title,date:s.start.slice(0,10),day:weekday(new Date(s.start)),start:s.start.slice(11),end:s.end.slice(11),weekStart:1,weekEnd:54,parity:'all',exceptions:[],taskId:a.taskId||'',stepId:task?.id||'',goalId:a.goalId||'',source:'Agent 已批准方案'});
  }
 }else throw Error('工具类型不支持');
 const tx={id:newId(),at:now.toISOString(),title:a.title,status:'executed',changes,plan:p};next.transactions.push(tx);
 next.decisions.push({id:p.id,status:'executed',at:now.toISOString(),action:a.type,resultId:task?.id||a.eventId,transactionId:tx.id,sourceIds:p.sources});
 next.history.unshift({id:newId(),at:now.toISOString(),action:'approved',description:'批准并执行：'+a.title,transactionId:tx.id});
 return{next,task,transaction:tx};
}
export function undoTransaction(data,id,now=new Date()){
 const tx=data.transactions.find(t=>t.id===id);if(!tx||tx.status!=='executed')throw Error('事务已撤销或不存在');
 for(const c of tx.changes)if(JSON.stringify(data[c.key].find(x=>x.id===c.id)||null)!==JSON.stringify(c.after))throw Error('相关记录已被修改；为避免覆盖，请手动恢复');
 const next=structuredClone(data);for(const c of tx.changes){next[c.key]=next[c.key].filter(x=>x.id!==c.id);if(c.before)next[c.key].push(c.before)}
 next.transactions.find(t=>t.id===id).status='undone';next.history.unshift({id:newId(),at:now.toISOString(),action:'undone',description:'撤销：'+tx.title});return next;
}
export function isQuiet(data,now=new Date()){
 if(data.settings.quiet)return true;const {quietStart:a,quietEnd:b}=data.settings,t=stamp(now).slice(11);if(!a||!b||a===b)return false;return a>b?t>=a||t<b:t>=a&&t<b;
}
export function reminderCandidates(data,now=new Date()){
 const leads=data.settings.leadMinutes||[1440,60],items=[...data.tasks.filter(t=>!t.done&&t.due&&t.remind!==false).map(t=>({id:t.id,title:t.title,at:t.due,kind:'task'})),...occurrences(data,now,plusDays(now,2)).filter(e=>e.remind!==false&&new Date(e.startsAt)>=now).map(e=>({id:e.occurrenceId,sourceId:e.id,title:e.name,at:e.startsAt,kind:e.kind}))];
 const out=[];for(const x of items){const diff=(new Date(x.at)-now)/60000;const lead=diff<0?0:[...leads].sort((a,b)=>a-b).find(n=>diff<=n);if(lead===undefined)continue;const id=`${x.id}:${x.at}:${lead}`;if(!data.reminders.some(r=>r.id===id))out.push({...x,id,lead,sourceId:x.sourceId||x.id,label:diff<0?'已逾期':`将在 ${Math.max(0,Math.ceil(diff))} 分钟后到来`})}return out;
}
export function deliverReminders(data,now=new Date()){
 const next=structuredClone(data);if(!data.settings.reminderEnabled||isQuiet(data,now))return{next,delivered:[]};
 const last=data.reminders.filter(r=>r.status==='delivered').map(r=>+new Date(r.deliveredAt)).sort((a,b)=>b-a)[0];
 if(last&&now-last<(data.settings.reminderGap||60)*60000)return{next,delivered:[]};
 const r=reminderCandidates(data,now)[0];if(!r)return{next,delivered:[]};next.reminders.push({...r,status:'delivered',deliveredAt:now.toISOString()});return{next,delivered:[r]};
}
export function growth(data,now=new Date()){
 const week=(offset)=>{const start=plusDays(monday(now),offset*7),end=plusDays(start,7),inside=s=>s&&new Date(s)>=start&&new Date(s)<end;
  const completed=data.tasks.filter(t=>t.done&&inside(t.completedAt)),due=data.tasks.filter(t=>inside(t.due));
  return{start:dateKey(start),done:completed.length,due:due.length,dueCompleted:due.filter(t=>t.done&&t.completedAt).length,overdue:due.filter(t=>new Date(t.due)<now&&(!t.done||new Date(t.completedAt)>new Date(t.due))).length,goals:data.goals.filter(g=>g.done&&inside(g.completedAt)).length,checkins:data.checkins.filter(c=>inside(c.at)).length,minutes:data.checkins.filter(c=>inside(c.at)).reduce((n,c)=>n+c.minutes,0),accepted:data.decisions.filter(d=>d.status==='executed'&&inside(d.at)).length,rejected:data.decisions.filter(d=>d.status==='rejected'&&inside(d.at)).length,taskIds:completed.map(t=>t.id)};
 };return{current:week(0),previous:week(-1),weeks:[-5,-4,-3,-2,-1,0].map(week),hasEvidence:!!(data.tasks.some(t=>t.completedAt)||data.checkins.length||data.goals.some(g=>g.completedAt))};
}
export function parseExceptions(text){if(!text.trim())return[];try{const a=JSON.parse(text);if(!Array.isArray(a))throw Error();return a}catch{throw Error('例外需为 JSON 数组；例如 [{"date":"2026-10-01","type":"cancel"}]')}}
function csvRows(text){const out=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))out.push(row);row=[];cell=''}else cell+=c}if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(x=>x.trim()))out.push(row);return out}
function icsDate(value,param=''){
 if(!/^\d{8}T\d{6}Z?$/.test(value))throw Error('ICS 仅支持带时间的事件；全天日期请手动录入');
 const sourceDate=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
 if(!validDate(sourceDate)||!validTime(value.slice(9,11)+':'+value.slice(11,13))||+value.slice(13,15)>59)throw Error('ICS 日期或时间无效');
 if(param.includes('TZID=')&&!/TZID=(Asia\/Shanghai|Asia\/Chongqing|Etc\/UTC|UTC)(;|$)/.test(param))throw Error('ICS 时区暂仅支持 Asia/Shanghai 或 UTC；请导出为 UTC');
 const s=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}`;
 let d;if(value.endsWith('Z')||/TZID=(Etc\/UTC|UTC)/.test(param))d=new Date(s+'Z');else if(/TZID=Asia\//.test(param))d=new Date(s+'+08:00');else d=new Date(s);
 if(!Number.isFinite(+d)||+value.slice(4,6)<1||+value.slice(4,6)>12||+value.slice(6,8)<1||+value.slice(6,8)>31)throw Error('ICS 日期无效');return d;
}
const unescapeICS=s=>s.replace(/\\n/gi,' ').replace(/\\([,;\\])/g,'$1');
export const scheduleIdentity=x=>JSON.stringify([x.kind||'course',x.name,x.date||'',+x.day,x.start,x.end,x.weekStart||1,x.weekEnd||54,x.parity||'all',x.exceptions||[]]);
export function parseSchedule(text,filename,data){
 if(text.length>2_000_000)throw Error('课表文件超过2MB');let rows=[];text=text.replace(/^\uFEFF/,'');
 if(/\.csv$/i.test(filename)){
  const all=csvRows(text),headers=all.shift()?.map(h=>h.trim());const required=['name','day','start','end'];if(!headers||required.some(k=>!headers.includes(k)))throw Error('CSV 表头需包含 name,day,start,end；day=1–7');
  rows=all.map((r,i)=>{if(r.length!==headers.length)throw Error(`CSV 第${i+2}行列数不匹配`);const x=Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));return{...x,kind:x.kind||'course',day:Number(x.day)-1,weekStart:Number(x.weekStart||1),weekEnd:Number(x.weekEnd||54),parity:x.parity||'all',exceptions:parseExceptions(x.exceptions||'')}});
 }else if(/\.ics$/i.test(filename)){
  if(!text.includes('BEGIN:VCALENDAR')||!text.includes('END:VCALENDAR'))throw Error('不是完整 ICS 日历');
  text=text.replace(/\r?\n[ \t]/g,'');const blocks=[...text.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)];
  for(const [index,b]of blocks.entries()){
   const props={};for(const line of b[1].split(/\r?\n/)){const p=line.indexOf(':');if(p<0)continue;const key=line.slice(0,p).split(';')[0];(props[key]||=[]).push({param:line.slice(0,p),value:line.slice(p+1)})}
   if(props['RECURRENCE-ID']||props.RDATE)throw Error('ICS 含替换实例或 RDATE；请先导出展开的单次事件或使用 CSV 例外');
   if(!props.DTSTART||!props.DTEND||!props.SUMMARY)throw Error(`ICS 第${index+1}个事件缺少开始/结束/名称`);
   const start=icsDate(props.DTSTART[0].value,props.DTSTART[0].param),end=icsDate(props.DTEND[0].value,props.DTEND[0].param);if(end<=start||end-start>86400000)throw Error('ICS 时段需正向且不超过24小时');
   const base={name:unescapeICS(props.SUMMARY[0].value),place:unescapeICS(props.LOCATION?.[0]?.value||''),kind:'course',start:stamp(start).slice(11),end:stamp(end).slice(11),day:weekday(start),weekStart:1,weekEnd:54,parity:'all',exceptions:[]};
   const excluded=new Set((props.EXDATE||[]).flatMap(p=>p.value.split(',').map(v=>stamp(icsDate(v,p.param)))));
   if(!props.RRULE){if(!excluded.has(stamp(start)))rows.push({...base,date:dateKey(start)})}else{
    const rule=Object.fromEntries(props.RRULE[0].value.split(';').map(x=>x.split('=')));if(rule.FREQ!=='WEEKLY'||Object.keys(rule).some(k=>!['FREQ','INTERVAL','COUNT','UNTIL','BYDAY','WKST'].includes(k)))throw Error('ICS RRULE 仅支持有结束范围的 WEEKLY / INTERVAL / BYDAY / COUNT / UNTIL');
    if(!rule.COUNT&&!rule.UNTIL)throw Error('ICS 无限重复没有结束范围；请导出带 UNTIL/COUNT 的学期课表');
    const interval=Number(rule.INTERVAL||1),count=Number(rule.COUNT||1000),until=rule.UNTIL?icsDate(rule.UNTIL):plusDays(start,370);if(!Number.isInteger(interval)||interval<1||interval>52||!Number.isInteger(count)||count<1||count>1000||until-start>370*86400000)throw Error('ICS 重复范围超过支持上限');
    const names=['MO','TU','WE','TH','FR','SA','SU'];const days=rule.BYDAY?rule.BYDAY.split(','): [names[weekday(start)]];if(days.some(d=>!names.includes(d)))throw Error('ICS BYDAY 无效');if(rule.WKST&&rule.WKST!=='MO')throw Error('ICS WKST 暂仅支持 MO');let seen=0;
    for(let day=new Date(start);day<=until&&seen<count;day=plusDays(day,1))if(Math.round((monday(day)-monday(start))/604800000)%interval===0&&days.includes(names[weekday(day)])){seen++;if(!excluded.has(stamp(day)))rows.push({...base,date:dateKey(day),day:weekday(day)})}
   }
  }
 }else throw Error('请选择 .csv 或 .ics 文件');
 if(!rows.length)throw Error('文件没有可导入的日程');if(rows.length>1000)throw Error('单次最多导入1000条，请缩小学期范围');
 const seen=new Set([...data.courses.map(x=>scheduleIdentity({...x,kind:'course'})),...data.events.map(x=>scheduleIdentity({...x,kind:'event'}))]),duplicates=[],items=[];
 for(const x of rows){checkSchedule(x);if(!['course','event'].includes(x.kind))throw Error('kind 仅可为 course/event');const key=scheduleIdentity(x);if(seen.has(key)){duplicates.push(x);continue}seen.add(key);items.push({...x,id:newId(),source:filename,importedAt:new Date().toISOString()})}
 const next=structuredClone(data);next.courses.push(...items.filter(x=>x.kind==='course'));next.events.push(...items.filter(x=>x.kind==='event'));const conflicts=calendarConflicts(next);
 return{items,duplicates,conflicts,filename,basis:fingerprint(data)};
}
export function applyImport(data,preview){if(preview.basis!==fingerprint(data))throw Error('档案已变化，请重新预览导入');if(!preview.items.length)throw Error('全部为重复记录，没有新增');const next=structuredClone(data),changes=[];for(const x of preview.items){const key=x.kind==='course'?'courses':'events';next[key].push(x);changes.push({key,id:x.id,before:null,after:x})}const tx={id:newId(),title:'导入 '+preview.filename,status:'executed',at:new Date().toISOString(),changes};next.transactions.push(tx);next.history.unshift({id:newId(),at:tx.at,action:'imported',description:tx.title});return{next,transaction:tx}}
function escapeICS(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
const utcICS=s=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function exportCalendar(data,from=new Date(),until=plusDays(from,120)){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Xiaoya//Local RC//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 const events=occurrences(data,from,until).map(e=>({id:e.occurrenceId,title:e.name,start:e.startsAt,end:e.endsAt,place:e.place}));
 events.push(...data.tasks.filter(t=>!t.done&&t.due&&new Date(t.due)>=from&&new Date(t.due)<until).map(t=>({id:t.id,title:'截止：'+t.title,start:t.due,end:stamp(new Date(+new Date(t.due)+60000))})));
 for(const e of events){lines.push('BEGIN:VEVENT','UID:'+escapeICS(e.id)+'@xiaoya.local','DTSTAMP:'+utcICS(new Date()),'DTSTART:'+utcICS(e.start),'DTEND:'+utcICS(e.end),'SUMMARY:'+escapeICS(e.title),'LOCATION:'+escapeICS(e.place));for(const lead of data.settings.leadMinutes||[60])lines.push('BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-PT'+lead+'M','DESCRIPTION:'+escapeICS(e.title),'END:VALARM');lines.push('END:VEVENT')}
 lines.push('END:VCALENDAR');return lines.map(l=>{let chunks=[],s='';for(const ch of l){if(new TextEncoder().encode(s+ch).length>72){chunks.push(s);s=' '+ch}else s+=ch}chunks.push(s);return chunks.join('\r\n')}).join('\r\n')+'\r\n';
}
