// 信封 · The visible context envelope for a single model message.
// The user sees and toggles every scope. Journal *text* is never an available scope.
import {dateKey,plusDays,monday,occurrences} from '../domain.js';

export const SCOPES=Object.freeze([
 {key:'today',label:'今天的日程',sensitive:false},
 {key:'deadlines',label:'7 天内截止',sensitive:false},
 {key:'goals',label:'目标进度',sensitive:false},
 {key:'mood',label:'今天的心情分值',sensitive:true}
]);
const clip=(s,n=60)=>String(s??'').replace(/[\r\n]+/g,' ').slice(0,n);

/** Returns {items:[{key,label,count,lines}], text, bytes}. Only selected scopes are serialized. */
export function buildEnvelope(data,selected,{now=new Date(),moodToday=null}={}){
 const pick=new Set(selected||[]);const items=[];
 const today=dateKey(now);
 if(pick.has('today')){
  const occ=occurrences(data,new Date(today+'T00:00'),plusDays(new Date(today+'T00:00'),1));
  items.push({key:'today',label:'今天的日程',count:occ.length,lines:occ.map(o=>o.startsAt.slice(11,16)+'–'+o.endsAt.slice(11,16)+' '+clip(o.name)+(o.kind==='course'?'（课程）':'（活动）'))});
 }
 if(pick.has('deadlines')){
  const until=plusDays(now,7);
  const due=data.tasks.filter(t=>!t.done&&t.due&&new Date(t.due)<=until).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,12);
  items.push({key:'deadlines',label:'7 天内截止',count:due.length,lines:due.map(t=>clip(t.title)+' · 截止 '+t.due.replace('T',' ')+(t.minutes?' · 预计 '+t.minutes+' 分钟':'')+(new Date(t.due)<now?' · 已逾期':''))});
 }
 if(pick.has('goals')){
  const s=monday(now),e=plusDays(s,7);
  const goals=data.goals.filter(g=>!g.done).slice(0,8);
  items.push({key:'goals',label:'目标进度',count:goals.length,lines:goals.map(g=>clip(g.title)+' · 本周 '+data.checkins.filter(c=>c.goalId===g.id&&new Date(c.at)>=s&&new Date(c.at)<e).length+'/'+(g.weeklyTarget||1)+' 次')});
 }
 if(pick.has('mood')&&Number.isInteger(moodToday)){
  items.push({key:'mood',label:'今天的心情分值',count:1,lines:['用户自评心情 '+moodToday+'/5（仅分值，不含日记）']});
 }
 const text=items.length?'【用户本条消息主动附带的记录，仅供参考】\n'+items.map(i=>'# '+i.label+'（'+i.count+'）\n'+(i.lines.length?i.lines.join('\n'):'（无）')).join('\n'):'';
 return {items,text,bytes:new TextEncoder().encode(text).length};
}
export const SYSTEM_PROMPT='你是「小芽」，一位务实、温和、简洁的大学生生活与成长伙伴。'+
 '只依据用户本条消息中明确附带的记录作答；没有附带的信息就说不知道，不要编造课程、成绩或安排。'+
 '你不能直接修改用户的数据；若建议调整，请说明用户可以在页面上自行操作或批准铅笔建议。'+
 '不做心理或医学诊断。回答用中文，尽量在 160 字内，必要时分点。';
