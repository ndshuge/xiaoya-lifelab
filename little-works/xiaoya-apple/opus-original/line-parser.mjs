// 写一行 · Local, deterministic Chinese one-line parser.
// Turns a sentence the user typed into a *pencil draft* (never saved until the user confirms).
// No network, no model. Uncertain parts are reported in `notes` instead of being guessed silently.
import {dateKey,plusDays,weekday} from '../domain.js';

const pad=n=>String(n).padStart(2,'0');
const CN={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
export function cnNumber(s){
 if(s==null)return NaN;s=String(s);
 if(/^\d+(\.\d+)?$/.test(s))return Number(s);
 if(s==='半')return .5;
 if(s.includes('十')){const [a,b]=s.split('十');return (a?CN[a]:1)*10+(b?CN[b]:0)}
 return s.split('').reduce((n,c)=>CN[c]===undefined?NaN:n*10+CN[c],0);
}
const NUM='(\\d{1,2}|[零〇一二两三四五六七八九十]{1,3})';
const WEEK={一:0,二:1,三:2,四:3,五:4,六:5,日:6,天:6,'1':0,'2':1,'3':2,'4':3,'5':4,'6':5,'7':6};
const QUESTION=/[？?]\s*$|^(找|搜|搜索|查找|怎么|怎样|如何|为什么|什么|哪|是不是|要不要|该不该|帮我看|帮我分析|分析|总结|建议|我该|今天先|下一步)|吗[。!！]?\s*$|有空吗|什么时候有空|几点有空/;
const DEADLINE=/(之前|以前|前交|前完成|前提交|截止|截至|ddl|DDL|due|交|提交)/;
const EVENTWORD=/(会|课|讲座|活动|例会|聚餐|约|见面|面试|比赛|训练|社团|排练|值班|答辩)/;
const GOALWORD=/(每周|每星期|每天|每日|坚持|养成|习惯|长期目标|目标)/;

/** Resolve relative/absolute date words. Returns {date, consumed:[matched strings]} */
function findDate(text,now){
 const base=new Date(now);base.setHours(12,0,0,0);
 const hits=[];let date=null;
 const rel=[[/大后天/,3],[/后天/,2],[/明[天日早晚]/,1],[/今[天日晚早]|今儿/,0]];
 for(const [re,n] of rel){const m=text.match(re);if(m){date=dateKey(plusDays(base,n));hits.push(m[0]);break}}
 if(!date){
  const m=text.match(/(下下|下个?|这个?|本)?(周|星期|礼拜)([一二三四五六日天1-7])/);
  if(m){
   const target=WEEK[m[3]],today=weekday(base);
   let offset=target-today;
   if(m[1]&&m[1].startsWith('下下'))offset+=14;
   else if(m[1]&&m[1].startsWith('下'))offset+=7;
   else if(offset<0)offset+=7; // "周一" said on Thursday means the coming Monday
   date=dateKey(plusDays(base,offset));hits.push(m[0]);
  }
 }
 if(!date){
  const m=text.match(/(\d{1,2})\s*[月/\-.]\s*(\d{1,2})\s*[日号]?/)||text.match(/([一二三四五六七八九十]{1,3})月([一二三四五六七八九十]{1,3})[日号]/);
  if(m){
   const mo=cnNumber(m[1]),d=cnNumber(m[2]);
   if(mo>=1&&mo<=12&&d>=1&&d<=31){
    let y=base.getFullYear();let cand=new Date(y,mo-1,d,12);
    if(cand.getMonth()!==mo-1){return {date:null,hits:[m[0]],invalid:true}}
    if(+cand<+plusDays(base,-60)){cand=new Date(y+1,mo-1,d,12)}
    date=dateKey(cand);hits.push(m[0]);
   }
  }
 }
 if(!date){
  const m=text.match(/(?:^|[^\d月])(\d{1,2})\s*号/);
  if(m){const d=Number(m[1]);let cand=new Date(base.getFullYear(),base.getMonth(),d,12);
   if(cand.getDate()===d){if(dateKey(cand)<dateKey(base))cand=new Date(base.getFullYear(),base.getMonth()+1,d,12);
    if(cand.getDate()===d){date=dateKey(cand);hits.push(m[0].replace(/^[^\d]/,''))}}}
 }
 return {date,hits};
}
function hourFrom(period,h){
 if(!Number.isFinite(h))return NaN;
 if(/下午|晚上|今晚|明晚|傍晚|晚/.test(period||'')&&h<12)return h+12;
 if(/中午/.test(period||'')&&h<6)return h+12;
 if(/凌晨/.test(period||'')&&h===12)return 0;
 return h;
}
const PERIOD='(凌晨|早上|上午|中午|下午|傍晚|晚上|今晚|明晚|晚)?';
function findTimes(text){
 const out=[];
 // 15:30 / 15：30
 const clock=new RegExp(PERIOD+'\\s*(\\d{1,2})[:：](\\d{2})','g');
 let m;
 while((m=clock.exec(text))){const h=hourFrom(m[1],Number(m[2])),mi=Number(m[3]);if(h<24&&mi<60)out.push({h,m:mi,raw:m[0],index:m.index})}
 const word=new RegExp(PERIOD+'\\s*'+NUM+'\\s*[点時时](半|一刻|三刻|'+NUM+'分?)?','g');
 while((m=word.exec(text))){
  if(out.some(x=>m.index>=x.index&&m.index<x.index+x.raw.length))continue;
  const h=hourFrom(m[1],cnNumber(m[2]));let mi=0;
  if(m[3]==='半')mi=30;else if(m[3]==='一刻')mi=15;else if(m[3]==='三刻')mi=45;else if(m[4])mi=cnNumber(m[4]);
  if(Number.isFinite(h)&&h<24&&mi>=0&&mi<60)out.push({h,m:mi,raw:m[0],index:m.index});
 }
 // A bare period word implies a default time (今晚 → 20:00) but only when no explicit hour exists.
 return out.sort((a,b)=>a.index-b.index);
}
function findMinutes(text){
 let m=text.match(/(\d+(?:\.\d+)?|[一二两三四五六七八九十半]+)\s*(个)?\s*(小时|钟头|h\b)/i);
 if(m){const n=m[1]==='半'?.5:cnNumber(m[1]);if(Number.isFinite(n)&&n>0&&n<=20)return {minutes:Math.round(n*60),raw:m[0]}}
 m=text.match(/半\s*(个)?\s*小时/);if(m)return {minutes:30,raw:m[0]};
 m=text.match(/(\d+|[一二两三四五六七八九十]+)\s*(分钟|min|mins|分)(?![^\s]*[点时])/i);
 if(m){const n=cnNumber(m[1]);if(Number.isFinite(n)&&n>0&&n<=1200)return {minutes:n,raw:m[0]}}
 return {minutes:null,raw:''};
}
function cleanTitle(text,parts){
 let t=' '+text+' ';
 for(const p of parts.filter(Boolean).sort((a,b)=>b.length-a.length))t=t.split(p).join(' ');
 t=t.replace(/(之前|以前|前交|前完成|前提交|截止到?|截至|ddl|DDL|due|要交|交|提交|之前要|前|到|至|~|－|—|-|，|,|。|、|；|;|：|:|的时候|左右|大概|预计|需要|用时|安排|记得|提醒我|帮我|我要|我得|要)/g,' ');
 t=t.replace(/\s+/g,' ').trim().replace(/^(在|去|把|和|跟)\s*/,'').replace(/\s*(在|去)$/,'').trim();
 return t;
}
function typeOf(title){return /^考|考试|测验|期中|期末|小测|quiz|exam/i.test(title)?'exam':/作业|报告|习题|论文|实验|练习册|PPT|ppt|大作业/.test(title)?'assignment':'task'}

/**
 * parseLine('明晚十点前交工数习题 45分钟', now)
 * → {intent:'task', fields:{title,due,minutes,type,course}, notes:[...], summary:[...]}.
 */
export function parseLine(input,now=new Date(),{forceIntent=null}={}){
 const text=String(input||'').replace(/\s+/g,' ').trim().slice(0,200);
 if(!text)return {intent:'empty',fields:null,notes:[],summary:[]};
 const notes=[];
 const isQuestion=QUESTION.test(text);
 const dateHit=findDate(text,now);
 if(dateHit.invalid)notes.push('日期不存在，请检查月份和日期');
 const times=findTimes(text);
 const dur=findMinutes(text);
 const place=(text.match(/[@＠]\s*([^\s，,。]+)/)||[])[1]||'';
 const weekly=text.match(/(每周|每星期|一周)([^\d一二两三四五六七，,]{0,4}?)([一二两三四五六七1-7])\s*次/);
 const daily=/每天|每日/.test(text);
 let intent=forceIntent;
 if(!intent){
  if(isQuestion)intent='question';
  else if(weekly||daily||GOALWORD.test(text)&&!dateHit.date&&!times.length)intent='goal';
  else if(times.length>=2||(times.length&&EVENTWORD.test(text)&&!DEADLINE.test(text)))intent='event';
  else intent='task';
 }
 const consumed=[...dateHit.hits,...times.map(t=>t.raw),dur.raw,place?(text.match(/[@＠]\s*[^\s，,。]+/)||[''])[0]:''];
 const base=weekly?text.replace(weekly[0],' '+weekly[2]+' '):text;
 const title=cleanTitle(base,consumed)||text;
 const day=dateHit.date;
 const summary=[];
 if(intent==='question')return {intent,fields:{question:text},notes,summary:['问小芽']};
 if(intent==='goal'){
  const weeklyTarget=weekly?Math.max(1,Math.min(7,cnNumber(weekly[3]))):daily?7:1;
  const goalTitle=cleanTitle(title.replace(/每周|每星期|每天|每日|坚持|养成|习惯|长期目标|目标/g,' ').replace(/\s+/g,''),[])||title;
  if(!weekly&&!daily)notes.push('没说每周几次，先按每周 1 次');
  summary.push('目标','每周 '+weeklyTarget+' 次');
  return {intent,fields:{title:goalTitle.slice(0,160),category:'兴趣',target:dur.minutes?'每次 '+dur.minutes+' 分钟':'',weeklyTarget,kind:daily?'habit':'goal'},notes,summary};
 }
 if(intent==='event'){
  let date=day;
  if(!date){date=dateKey(new Date(now));notes.push('没写日期，先放在今天')}
  let start=times[0],end=times[1];
  if(!start){notes.push('活动需要开始时间，先按 09:00');start={h:9,m:0}}
  // "下午3点到5点" — the second time inherits the first period.
  if(end&&end.h<start.h&&end.h<12&&start.h>=12)end={...end,h:end.h+12};
  const startStr=pad(start.h)+':'+pad(start.m);
  let endStr;
  if(end)endStr=pad(end.h)+':'+pad(end.m);
  else{const len=dur.minutes||60;const total=start.h*60+start.m+len;endStr=pad(Math.floor(total/60)%24)+':'+pad(total%60);if(!dur.minutes)notes.push('没写结束时间，先按 1 小时')}
  summary.push('活动',date.slice(5).replace('-','/')+' '+startStr+'–'+endStr);if(place)summary.push('@'+place);
  return {intent,fields:{name:title.slice(0,160),date,day:weekday(new Date(date+'T12:00')),start:startStr,end:endStr,place,weekStart:1,weekEnd:54,parity:'all',exceptions:[]},notes,summary};
 }
 // task
 let due='';
 if(day||times.length){
  const date=day||dateKey(new Date(now));
  let t=times[times.length-1];
  if(!t){const evening=/晚/.test(text);t=evening?{h:22,m:0}:{h:23,m:59};if(!evening)notes.push('没写几点，先按当天 23:59 截止')}
  due=date+'T'+pad(t.h)+':'+pad(t.m);
  if(!day&&+new Date(due)<+new Date(now)){due=dateKey(plusDays(new Date(now),1))+due.slice(10);notes.push('这个时间今天已过，改到明天')}
  if(+new Date(due)<+new Date(now))notes.push('截止时间已经过去');
 }
 const type=typeOf(title);
 summary.push({exam:'考试',assignment:'作业',task:'事项'}[type]);
 summary.push(due?'截止 '+due.slice(5,10).replace('-','/')+' '+due.slice(11):'无截止 · 放进口袋');
 if(dur.minutes)summary.push('约 '+dur.minutes+' 分钟');
 return {intent:'task',fields:{title:title.slice(0,160),due,minutes:dur.minutes||30,type,course:''},notes,summary};
}
