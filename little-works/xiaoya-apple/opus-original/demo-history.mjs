// Synthetic history for the DEMO archive only, so the long line and the season island have something to show.
// Deterministic (seeded), clearly synthetic, never applied to the personal archive.
import {dateKey,plusDays,monday} from '../domain.js';

const pad=n=>String(n).padStart(2,'0');
const stamp=(d,h,m)=>{const x=new Date(d);x.setHours(h,m,0,0);return x.toISOString()};
const local=(d,h,m)=>{const x=new Date(d);return dateKey(x)+'T'+pad(h)+':'+pad(m)};
const NOTES=['实验课的电路终于调通了。','线代作业比想象中难，问了室友才搞懂。','社团排练很开心。','有点累，早点睡。','背了 40 个单词。','和朋友去吃了肉夹馍。','今天效率不错。','下雨了，在图书馆待了一下午。','跑完步感觉轻松多了。','考试周前有点焦虑。'];
const TASKS=['工数习题第五章','大物实验预习','线代作业 3','英语听力打卡','实验报告：示波器','C 语言上机作业','思政课读书笔记','数电作业 2'];

/** True when the archive has no completed work, no check-ins and no journal — i.e. a fresh demo. */
export function needsDemoHistory(data,journalEntries){
 return !data.checkins.length&&!data.tasks.some(t=>t.done)&&!(journalEntries||[]).length;
}
/** Returns {data, journal} with five past weeks of plausible, labelled-demo activity. */
export function buildDemoHistory(data,now=new Date()){
 let s=20261105;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
 const next=structuredClone(data),journal=[];
 const thisMonday=monday(now);
 if(!next.goals.some(g=>g.id==='demo-g2'))next.goals.push({id:'demo-g2',title:'每周跑步两次',category:'运动',target:'每次 3 公里',weeklyTarget:2,kind:'habit',done:false,createdAt:plusDays(thisMonday,-35).toISOString(),completedAt:null,demo:true});
 let taskIndex=0;
 for(let w=5;w>=1;w--){
  const start=plusDays(thisMonday,-7*w);
  // Completed assignments (finished before their deadline most weeks).
  const count=2+Math.floor(rnd()*3);
  for(let i=0;i<count;i++){
   const due=plusDays(start,1+Math.floor(rnd()*5)),late=rnd()<.12;
   const doneAt=plusDays(due,late?1:-Math.floor(rnd()*2));
   next.tasks.push({id:'demo-h-t'+w+'-'+i,title:TASKS[taskIndex++%TASKS.length],type:'assignment',course:'',due:local(due,22,0),minutes:30+Math.floor(rnd()*4)*15,
    done:true,completedAt:stamp(doneAt,20+Math.floor(rnd()*3),Math.floor(rnd()*60)),remind:true,createdAt:stamp(plusDays(due,-5),9,0),demo:true});
  }
  // Goal actions: drums once most weeks, running about twice (fewer in the busy weeks).
  const drums=rnd()<.8?1:0,runs=w===2?1:1+Math.round(rnd());
  for(let i=0;i<drums;i++)next.checkins.push({id:'demo-h-c'+w+'d'+i,goalId:'demo-g1',at:stamp(plusDays(start,5),19,30),minutes:20+Math.floor(rnd()*3)*10,note:['练了基础节奏','练了两段过门','跟着曲子打了一遍'][Math.floor(rnd()*3)],demo:true});
  for(let i=0;i<runs;i++)next.checkins.push({id:'demo-h-c'+w+'r'+i,goalId:'demo-g2',at:stamp(plusDays(start,1+i*3),7,10),minutes:20+Math.floor(rnd()*3)*5,note:'晨跑 3 公里',demo:true});
  // Journal: about six in ten days, moods drifting a little lower in the exam-heavy week.
  for(let d=0;d<7;d++){
   if(rnd()>.62)continue;
   const day=plusDays(start,d),dip=w===2?-1:0;
   const mood=Math.max(1,Math.min(5,3+dip+Math.round((rnd()-.4)*2)));
   journal.push({date:dateKey(day),mood,note:rnd()<.7?NOTES[Math.floor(rnd()*NOTES.length)]:'',tags:['演示'],updatedAt:stamp(day,22,10)});
  }
 }
 next.history.unshift({id:'demo-h-note',at:new Date(now).toISOString(),action:'added',description:'演示档案：补充了五周合成历史（仅演示）'});
 return {data:next,journal};
}
