// Contextual understanding for Xiaoya. Read-only, optional data sources, no DOM/network/storage.
// Mood remains an explicit local signal; no journal notes, tags or diagnosis leave this module.
import {dateKey,plusDays,occurrences} from './domain.js';

const dayMs=86_400_000;
const asTime=x=>{const d=new Date(x);if(!Number.isFinite(+d))throw Error('时间无效');return d};
const within100=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
const isDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(+new Date(x+'T12:00:00'))&&dateKey(new Date(x+'T12:00:00'))===x;
const status=x=>({status:x});
function evaluateWeather(snapshot,consents,now){
 if(consents.weather!==true)return {weather:null,source:status('not-authorized')};
 if(!consents.weatherCityId||typeof consents.weatherCityId!=='string')
  return {weather:null,source:status('missing-city')};
 if(!snapshot)return {weather:null,source:status('missing')};
 if(snapshot.cityId!==consents.weatherCityId)
  return {weather:null,source:status('mismatched-city')};
 const collected=new Date(snapshot.fetchedAt);
 if(!Number.isFinite(+collected)||+collected>+now+5*60_000||+now-+collected>6*3_600_000)
  return {weather:null,source:status('stale')};
 if(!Array.isArray(snapshot.days)||snapshot.days.length<1||snapshot.days.length>7||
   snapshot.days.some(day=>!isDate(day.date)||!within100(day.precipitationProbabilityMax)))
  return {weather:null,source:status('invalid')};
 const dates=new Set(snapshot.days.map(d=>d.date));
 if(dates.size!==snapshot.days.length)return {weather:null,source:status('invalid')};
 return {weather:{
   source:snapshot.source==='open-meteo'?'Open-Meteo':'用户提供的天气源',
   cityId:snapshot.cityId,cityLabel:String(snapshot.cityLabel||consents.weatherCityId).slice(0,40),
   fetchedAt:snapshot.fetchedAt,days:snapshot.days.map(d=>({date:d.date,
    precipitationProbabilityMax:d.precipitationProbabilityMax,
    temperatureMinC:Number.isFinite(d.temperatureMinC)?d.temperatureMinC:null,
    temperatureMaxC:Number.isFinite(d.temperatureMaxC)?d.temperatureMaxC:null}))
  },source:{status:'available',updatedAt:snapshot.fetchedAt,source:snapshot.source||'unknown'}};
}
function evaluateMood(entries,consents,today){
 if(consents.mood!==true)return {mood:null,source:status('not-authorized')};
 if(!Array.isArray(entries))return {mood:null,source:status('missing')};
 const found=entries.find(e=>e?.date===today);
 if(!found||found.mood==null)return {mood:null,source:status('no-today-entry')};
 if(!Number.isInteger(found.mood)||found.mood<1||found.mood>5)
  return {mood:null,source:status('invalid')};
 return {mood:{date:today,value:found.mood},source:{status:'available',source:'self-reported'}};
}
export function buildContextSnapshot(data,{now=new Date(),consents={},journalEntries=[],weatherSnapshot=null}={}){
 now=asTime(now);
 if(!data||!['tasks','events','courses','goals'].every(k=>Array.isArray(data[k])))
  throw Error('档案结构无效');
 const today=dateKey(now),tomorrow=dateKey(plusDays(now,1));
 const mood=evaluateMood(journalEntries,consents,today);
 const weather=evaluateWeather(weatherSnapshot,consents,now);
 const from=new Date(tomorrow+'T00:00:00'),until=plusDays(from,1);
 const outdoors=occurrences(data,from,until)
  .filter(o=>o.outdoor===true)
  .map(o=>({id:o.id,title:String(o.name||'户外活动').slice(0,120),date:o.date,startsAt:o.startsAt}));
 const dueTasks=data.tasks.filter(t=>!t.done&&t.due&&+new Date(t.due)>+now&&
  +new Date(t.due)<=+now+dayMs).map(t=>({id:t.id,title:String(t.title||'任务').slice(0,120),due:t.due}));
 return {
  observedAt:now.toISOString(),today,tomorrow,
  sources:{calendar:status('available'),mood:mood.source,weather:weather.source},
  mood:mood.mood,weather:weather.weather,upcomingOutdoors:outdoors,dueTasks,
  permissions:{mood:consents.mood===true,weather:consents.weather===true,
   weatherToModel:consents.weatherToModel===true},
  notice:'仅依据明确授权的数据生成建议；天气是概率预测，心情是用户自己记录的信息。'
 };
}
export function buildContextualSuggestions(snapshot){
 if(!snapshot||typeof snapshot!=='object'||!snapshot.sources)throw Error('情境快照无效');
 const result=[];
 const tomorrow=snapshot.weather?.days?.find(d=>d.date===snapshot.tomorrow);
 if(snapshot.sources.weather.status==='available'&&tomorrow&&tomorrow.precipitationProbabilityMax>=70)
  for(const event of snapshot.upcomingOutdoors||[]){
   if(event.date!==snapshot.tomorrow)continue;
   result.push({
    id:'context-rain:'+event.id+':'+snapshot.tomorrow,kind:'outdoor-weather',priority:1,
    title:'明天的户外活动，建议先查看天气',
    description:'当前城市预报显示明天降水概率较高。可以提前准备雨具，或确认室内备选方案；具体活动时段还需查看临近预报。',
    reason:'天气来源：'+snapshot.weather.source+'，'+snapshot.weather.cityLabel+' '+snapshot.tomorrow+
     ' 日最高降水概率 '+tomorrow.precipitationProbabilityMax+'%；活动已被明确标记为户外。',
    sources:[{kind:'event',id:event.id},{kind:'weather-forecast',date:snapshot.tomorrow,
      cityId:snapshot.weather.cityId,updatedAt:snapshot.weather.fetchedAt}],
    action:null,requiresApproval:false,uncertainty:'每日最大降水概率不等于活动时段一定降雨'
   });
  }
 if(snapshot.sources.mood.status==='available'&&snapshot.mood?.value<=2&&(snapshot.dueTasks||[]).length){
  result.push({
   id:'context-gentle:'+snapshot.today,kind:'gentle-day',priority:2,
   title:'今天可以考虑轻一点的执行节奏',
   description:'今天仍有近期截止任务；可以选择先完成一个短步骤，再决定是否继续。原有期限不会自动更改。',
   reason:'你今天主动记录了心情 '+snapshot.mood.value+'/5，同时未来24小时内有 '+
    snapshot.dueTasks.length+' 项未完成且有截止时间的事项；这是可选择的建议，不代表健康判断。',
   sources:[{kind:'mood-checkin',date:snapshot.today},
    ...snapshot.dueTasks.map(t=>({kind:'task',id:t.id}))],
   action:null,requiresApproval:false,uncertainty:'心情记录不能说明原因，也不能预测任务表现'
  });
 }
 return result;
}
/** Model may only rank generic, non-sensitive candidates and explain; never execute. */
export async function analyzeContextualSuggestions(snapshot,{authorized=false,weatherToModel=false,provider=null,timeoutMs=3000}={}){
 const candidates=buildContextualSuggestions(snapshot);
 const baseline={mode:'rule',modelUsed:false,candidates,notice:'本地情境建议；没有调用外部模型'};
 const allowed=authorized===true&&weatherToModel===true&&snapshot.permissions?.weather===true&&snapshot.permissions?.weatherToModel===true&&
  snapshot.sources.weather.status==='available'&&provider&&typeof provider.analyze==='function'
  ?candidates.filter(c=>c.kind==='outdoor-weather'):[];
 if(!allowed.length)return baseline;
 if(!Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>20000)throw Error('模型超时需为50–20000毫秒');
 const lookup=new Map(allowed.map((c,i)=>['c'+(i+1),c]));
 const controller=new AbortController();let timer;
 try{
  const raw=await Promise.race([
   Promise.resolve().then(()=>provider.analyze({candidates:[...lookup.entries()].map(([id,c])=>({
    id,kind:c.kind,priority:c.priority,
    information:'已核验的城市级预报及明确标记为户外的次日活动存在雨天准备提醒'
   })),signal:controller.signal})),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort('timeout');reject(Error('timeout'))},timeoutMs)})
  ]);
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(x=>!['rankedIds','notes'].includes(x))||
    !Array.isArray(raw.rankedIds)||raw.rankedIds.some(id=>!lookup.has(id))||
    new Set(raw.rankedIds).size!==raw.rankedIds.length||
    raw.notes!==undefined&&(!raw.notes||typeof raw.notes!=='object'||Array.isArray(raw.notes)||
      Object.entries(raw.notes).some(([k,v])=>!lookup.has(k)||!v||typeof v.reason!=='string'||v.reason.length>200)))
   throw Error('invalid response');
  const ordered=[...raw.rankedIds,...lookup.keys()].filter((x,i,arr)=>arr.indexOf(x)===i);
  const modelCards=ordered.map(id=>({...lookup.get(id),modelNote:raw.notes?.[id]?.reason||null}));
  return {mode:'authorized-model',modelUsed:true,candidates:[
   ...modelCards,...candidates.filter(c=>c.kind!=='outdoor-weather')
  ],notice:'AI 仅排序已核验的非敏感天气提示，不读取日记与心情，不执行动作'};
 }catch{
  return {...baseline,mode:'rule-fallback',notice:'模型没有返回有效建议，已使用本地情境判断'};
 }finally{clearTimeout(timer);controller.abort('completed')}
}
