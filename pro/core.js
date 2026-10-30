import {defaults,reminderDefaults,checkSemester,checkSchedule,calendarConflicts,plans,executePlan,growth} from './domain.js';
export const DAYS=['周一','周二','周三','周四','周五','周六','周日'];
const pad=n=>String(n).padStart(2,'0');
export const dayIndex=d=>(d.getDay()+6)%7;
export const localStamp=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
export const addDays=(d,n)=>{let x=new Date(d);x.setDate(x.getDate()+n);return x};
export const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
export const emptyStore=()=>({schema:1,courses:[],events:[],tasks:[],goals:[],decisions:[],history:[],...defaults(),settings:{quiet:false,reducedMotion:false,hidePet:false,...reminderDefaults()}});
export function validateStore(raw){
 if(!raw||raw.schema!==1||!['courses','events','tasks','goals','decisions'].every(k=>Array.isArray(raw[k])))throw Error('不是有效的“小芽”数据文件');
 const d=emptyStore();for(const k of ['courses','events','tasks','goals','decisions','history','reminders','checkins','transactions']){const a=raw[k]||[];if(!Array.isArray(a)||a.length>10000||a.some(x=>!x||typeof x!=='object'))throw Error('记录结构或数量无效：'+k);d[k]=structuredClone(a)}
 d.semester={...d.semester,...raw.semester};if(d.semester.start||d.semester.end)checkSemester(d.semester);
 d.revision=Number(raw.revision)||0;d.settings={...d.settings,...raw.settings};
 for(const k of ['quiet','reducedMotion','hidePet','reminderEnabled'])if(typeof d.settings[k]!=='boolean')throw Error('偏好开关类型无效：'+k);
 if(!Array.isArray(d.settings.leadMinutes)||!d.settings.leadMinutes.length||d.settings.leadMinutes.length>8||d.settings.leadMinutes.some(x=>!Number.isInteger(x)||x<0||x>10080))throw Error('提醒提前量需为0–10080分钟的整数');
 if(!Number.isFinite(+d.settings.reminderGap)||+d.settings.reminderGap<1||+d.settings.reminderGap>1440)throw Error('提醒间隔需为1–1440分钟');
 for(const k of ['quietStart','quietEnd'])if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.settings[k]))throw Error('免打扰时间无效');
 const ids=new Set();for(const k of ['courses','events','tasks','goals'])for(const x of d[k]){
  if(typeof x.id!=='string'||ids.has(x.id))throw Error('记录ID缺失或重复');ids.add(x.id);
  if(k==='courses'||k==='events'){x.weekStart=Number(x.weekStart||1);x.weekEnd=Number(x.weekEnd||54);x.parity=x.parity||'all';x.exceptions=x.exceptions||[];checkSchedule(x)}
  else{if(typeof x.title!=='string'||!x.title.trim()||x.title.length>160)throw Error('事项/目标名称无效');if(k==='tasks'&&x.due&&!Number.isFinite(+new Date(x.due)))throw Error('截止日期无效')}
 }
 if(d.checkins.some(c=>typeof c.goalId!=='string'||!Number.isFinite(+new Date(c.at))||!Number.isInteger(c.minutes)||c.minutes<0||c.minutes>1440))throw Error('目标行动记录无效');
 return d;
}
export function detectConflicts(data,from,until){return calendarConflicts(data,from,until)}
export function dueState(t,now=new Date()){
 if(t.done)return 'done';if(!t.due)return 'undated';
 const v=new Date(t.due).getTime()-now.getTime();if(!Number.isFinite(v))return 'undated';
 return v<0?'overdue':v<=86400000?'urgent':v<=259200000?'soon':'later';
}
export function dueLabel(t,now=new Date()){
 if(t.done)return '已完成';if(!t.due)return '未设截止';
 let ms=new Date(t.due).getTime()-now.getTime();if(!Number.isFinite(ms))return '日期无效';
 if(ms<0)return '已逾期 '+Math.max(1,Math.ceil(-ms/3600000))+' 小时';
 if(ms<3600000)return '剩余 '+Math.max(1,Math.ceil(ms/60000))+' 分钟';
 if(ms<86400000)return '剩余 '+Math.ceil(ms/3600000)+' 小时';
 return '还有 '+Math.ceil(ms/86400000)+' 天';
}
export const fmtDate=s=>s?new Date(s).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'未设置';
export function suggestions(data,now=new Date()){return plans(data,now)}
export function approve(data,s,now=new Date()){return executePlan(data,s,now)}
export function summary(data,now=new Date()){
 const g=growth({...defaults(),...data},now),c=g.current;
 return {all:c.due,done:c.done,goals:c.goals,conflicts:detectConflicts(data).length,hasData:!!(data.tasks.length||data.goals.length||data.courses.length||data.events.length),growth:g};
}
export function demoData(now=new Date()){
 let d=emptyStore();const deadline=(n,h,m)=>{let t=addDays(now,n);t.setHours(h,m,0,0);return localStamp(t)};
 d.courses=[{id:'demo-c1',name:'电子技术实验',day:2,start:'15:00',end:'16:40',place:'实验中心 A302'},
 {id:'demo-c2',name:'高等数学',day:1,start:'08:00',end:'09:40',place:'教学楼 204'},
 {id:'demo-c3',name:'线性代数',day:4,start:'10:10',end:'11:50',place:'教学楼 308'}];
 d.events=[{id:'demo-e1',name:'机器人社团例会',day:2,start:'16:00',end:'18:00',place:'创新中心'}];
 d.tasks=[{id:'demo-t1',title:'工数习题第六章',type:'assignment',course:'高等数学',due:deadline(1,22,0),minutes:45,done:false},
 {id:'demo-t2',title:'线性代数阶段测验',type:'exam',course:'线性代数',due:deadline(4,9,0),minutes:90,done:false},
 {id:'demo-t3',title:'阅读实验指导书',type:'assignment',course:'电子技术实验',due:deadline(3,18,0),minutes:30,done:false}];
 d.goals=[{id:'demo-g1',title:'练习架子鼓一次',category:'兴趣',target:'本周完成一次20分钟练习',done:false}];
 return d;
}
