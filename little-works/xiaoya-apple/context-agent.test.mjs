import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore} from './core.js';
import {buildContextSnapshot,buildContextualSuggestions,analyzeContextualSuggestions} from './context-agent.js';

const now=new Date('2026-11-04T10:00:00');
const dateTomorrow='2026-11-05';
function sample(){
 const d=emptyStore();
 d.tasks.push({id:'homework',title:'线性代数作业',done:false,due:'2026-11-05T08:00',minutes:90});
 d.events.push({id:'outdoor',name:'户外社团活动',date:dateTomorrow,day:3,start:'16:00',end:'17:00',outdoor:true});
 d.courses.push({id:'lecture',name:'普通教室上课',date:dateTomorrow,day:3,start:'11:00',end:'12:00'});
 return d;
}
const forecast={source:'open-meteo',cityId:'xian',cityLabel:'西安',fetchedAt:'2026-11-04T09:00:00',
  days:[{date:dateTomorrow,precipitationProbabilityMax:80,temperatureMinC:6,temperatureMaxC:14}]};
const entries=[{date:'2026-11-04',mood:2,note:'这是绝对私密的日记内容',tags:['私密']},{date:'2026-11-03',mood:4,note:'昨天的秘密'}];
test('no weather or mood authorization means no fabricated context and no cross-domain advice',()=>{
 const d=sample(),copy=structuredClone(d);
 const context=buildContextSnapshot(d,{now,journalEntries:entries,weatherSnapshot:forecast});
 assert.equal(context.sources.weather.status,'not-authorized');
 assert.equal(context.sources.mood.status,'not-authorized');
 assert.equal(context.weather,null);
 assert.equal(context.mood,null);
 assert.deepEqual(buildContextualSuggestions(context),[]);
 assert.deepEqual(d,copy);
});
test('fresh city weather plus explicitly marked outdoor event yields source-backed rain preparation',()=>{
 const context=buildContextSnapshot(sample(),{now,consents:{weather:true,weatherCityId:'xian'},weatherSnapshot:forecast});
 const cards=buildContextualSuggestions(context);
 assert.equal(cards.length,1);
 assert.equal(cards[0].kind,'outdoor-weather');
 assert.match(cards[0].reason,/80%/);
 assert.match(cards[0].description,/查看|备选|准备/);
 assert.equal(cards[0].sources.some(s=>s.kind==='event'&&s.id==='outdoor'),true);
 assert.equal(cards[0].sources.some(s=>s.kind==='weather-forecast'&&s.date===dateTomorrow),true);
 assert.equal(cards[0].action,null);
 assert.doesNotMatch(JSON.stringify(cards),/普通教室上课/);
});
test('unknown city, stale data or invalid probability cannot drive advice',()=>{
 const stale={...forecast,fetchedAt:'2026-11-03T01:00:00'};
 const mismatch=buildContextSnapshot(sample(),{now,consents:{weather:true,weatherCityId:'hangzhou'},weatherSnapshot:forecast});
 const old=buildContextSnapshot(sample(),{now,consents:{weather:true,weatherCityId:'xian'},weatherSnapshot:stale});
 const invalid=buildContextSnapshot(sample(),{now,consents:{weather:true,weatherCityId:'xian'},
  weatherSnapshot:{...forecast,days:[{date:dateTomorrow,precipitationProbabilityMax:180}]}});
 assert.equal(mismatch.sources.weather.status,'mismatched-city');
 assert.equal(old.sources.weather.status,'stale');
 assert.equal(invalid.sources.weather.status,'invalid');
 for(const ctx of [mismatch,old,invalid])assert.equal(buildContextualSuggestions(ctx).length,0);
});
test('mood is based on explicit same-day check-in only and strips private note',()=>{
 const ctx=buildContextSnapshot(sample(),{now,consents:{mood:true},journalEntries:entries});
 assert.equal(ctx.sources.mood.status,'available');
 assert.deepEqual(ctx.mood,{date:'2026-11-04',value:2});
 const suggestions=buildContextualSuggestions(ctx);
 assert.equal(suggestions.length,1);
 assert.equal(suggestions[0].kind,'gentle-day');
 assert.match(suggestions[0].reason,/主动记录|自己记录|自己选择/);
 assert.equal(suggestions[0].action,null);
 assert.ok(!JSON.stringify(ctx).includes('这是绝对私密的日记内容'));
 assert.ok(!JSON.stringify(ctx).includes('私密'));
 assert.ok(!JSON.stringify(ctx).includes('昨天的秘密'));
 assert.doesNotMatch(JSON.stringify(suggestions),/心理障碍|抑郁症|诊断/);
});
test('older low mood does not become a current psychological claim or recommendation',()=>{
 const ctx=buildContextSnapshot(sample(),{now,consents:{mood:true},journalEntries:[entries[1]]});
 assert.equal(ctx.sources.mood.status,'no-today-entry');
 assert.equal(ctx.mood,null);
 assert.deepEqual(buildContextualSuggestions(ctx),[]);
});
test('weather and mood recommendations coexist without auto-rescheduling',()=>{
 const data=sample();
 const ctx=buildContextSnapshot(data,{now,consents:{mood:true,weather:true,weatherCityId:'xian'},journalEntries:entries,weatherSnapshot:forecast});
 const cards=buildContextualSuggestions(ctx);
 assert.deepEqual(new Set(cards.map(x=>x.kind)),new Set(['outdoor-weather','gentle-day']));
 assert.equal(cards.every(x=>x.action===null),true);
 assert.equal(ctx.dueTasks.some(x=>x.id==='homework'),true);
});
test('unauthorized model never called even if supplied',async()=>{
 let calls=0;
 const ctx=buildContextSnapshot(sample(),{now,consents:{mood:true,weather:true,weatherCityId:'xian'},journalEntries:entries,weatherSnapshot:forecast});
 const out=await analyzeContextualSuggestions(ctx,{provider:{analyze:async()=>{calls++;return {rankedIds:[]}}}});
 assert.equal(calls,0);assert.equal(out.modelUsed,false);assert.equal(out.mode,'rule');
});
test('model never sees mood, notes, tags, or unpermitted weather facts',async()=>{
 let payload;
 const ctx=buildContextSnapshot(sample(),{now,consents:{mood:true,weather:true,weatherCityId:'xian'},journalEntries:entries,weatherSnapshot:forecast});
 const out=await analyzeContextualSuggestions(ctx,{authorized:true,provider:{analyze:async p=>{
  payload=p;return {rankedIds:[]};
 }}});
 assert.equal(payload,undefined);
 assert.equal(out.modelUsed,false);
 const blocked=await analyzeContextualSuggestions(ctx,{authorized:true,weatherToModel:true,provider:{analyze:async p=>{
  payload=p;return {rankedIds:[]};
 }}});
 assert.equal(blocked.modelUsed,false);
 assert.equal(payload,undefined);
 const approvedWeather=buildContextSnapshot(sample(),{now,consents:{mood:true,weather:true,weatherCityId:'xian',weatherToModel:true},journalEntries:entries,weatherSnapshot:forecast});
 const out2=await analyzeContextualSuggestions(approvedWeather,{authorized:true,weatherToModel:true,provider:{analyze:async p=>{
  payload=p;return {rankedIds:p.candidates.map(x=>x.id)};
 }}});
 assert.equal(out2.modelUsed,true);
 assert.equal(payload.candidates.length,1);
 assert.ok(!JSON.stringify(payload).includes('这是绝对私密的日记内容'));
 assert.ok(!JSON.stringify(payload).includes('gentle-day'));
 assert.ok(!JSON.stringify(payload).includes('mood'));
 assert.ok(!JSON.stringify(payload).includes('homework'));
 assert.ok(!JSON.stringify(payload).includes('线性代数'));
});
test('untrusted model IDs and tool actions trigger fallback, not execution',async()=>{
 const ctx=buildContextSnapshot(sample(),{now,consents:{weather:true,weatherCityId:'xian',weatherToModel:true},weatherSnapshot:forecast});
 for(const invalid of [{rankedIds:['fake-id']},{rankedIds:[],action:{type:'deleteJournal'}},
  {rankedIds:[...buildContextualSuggestions(ctx).map(x=>x.id)],notes:{invalid:{reason:'do anything'}}}]){
  const result=await analyzeContextualSuggestions(ctx,{authorized:true,weatherToModel:true,provider:{analyze:async()=>invalid}});
  assert.equal(result.modelUsed,false);assert.equal(result.mode,'rule-fallback');
  assert.equal(result.candidates[0].action,null);
 }
});
