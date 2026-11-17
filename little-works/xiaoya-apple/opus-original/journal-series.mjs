// Pure local-calendar projections: never infer mood and never count a scheduled block as a check-in.
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00').getTime())&&dayKey(new Date(s+'T12:00'))===s;
export const dayKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const day=s=>{if(!validDate(s))throw Error('日期无效：'+s);const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const monday=d=>{const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
export function buildMoodSeries(entries,{endDate,days}={}){
 if(![7,30,90].includes(days))throw Error('days 仅支持 7/30/90');
 const end=day(endDate),first=dayKey(add(end,1-days)),lookup=new Map();
 for(const e of entries||[]){
  if(!e||!validDate(e.date)||!([null,1,2,3,4,5].includes(e.mood)))throw Error('心情记录格式不正确');
  if(lookup.has(e.date))throw Error('同一天重复心情记录：'+e.date);
  lookup.set(e.date,e);
 }
 const points=[];
 for(let i=0;i<days;i++){
  const date=dayKey(add(day(first),i)),entry=lookup.get(date);
  points.push({date,mood:entry?.mood??null,hasEntry:!!entry});
 }
 const segments=[];let current=[];
 for(const point of points){
  if(point.mood===null){if(current.length)segments.push(current);current=[]}
  else current.push(point);
 }
 if(current.length)segments.push(current);
 return {points,segments,moodCount:points.filter(p=>p.mood!==null).length,entryCount:points.filter(p=>p.hasEntry).length};
}
export function buildGoalSeries(checkins,{goalId,endDate,weeks=8}={}){
 if(weeks!==8)throw Error('仅支持连续8周');
 const end=day(endDate),first=monday(add(end,-49)),result=[];
 for(let i=0;i<8;i++)result.push({weekStart:dayKey(add(first,7*i)),count:0,minutes:0,entries:[]});
 for(const c of checkins||[]){
  if(c.goalId!==goalId)continue;
  const at=new Date(c.at);
  if(!Number.isFinite(+at)||!Number.isFinite(c.minutes)||c.minutes<0)throw Error('行动记录格式不正确');
  const date=dayKey(at);if(date>dayKey(end))continue;
  const start=dayKey(monday(at));
  const row=result.find(r=>r.weekStart===start);
  if(row){row.count++;row.minutes+=c.minutes;row.entries.push(c)}
 }
 return result;
}
