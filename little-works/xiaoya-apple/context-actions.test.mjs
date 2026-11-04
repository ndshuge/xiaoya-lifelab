import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore} from './core.js';
import {undoTransaction} from './domain.js';
import {buildContextSnapshot,buildContextualSuggestions} from './context-agent.js';
import {previewWeatherPreparation,approveWeatherPreparation,createContextActionController} from './context-actions.js';
import {createStore} from './native-v4/store.mjs';
import {createJournalStore} from './native-v4/journal-store.mjs';
import {fetchCityForecast} from './weather-forecast.js';

const now=new Date('2026-11-04T10:00:00');
const fc={source:'open-meteo',cityId:'xian',cityLabel:'西安',fetchedAt:now.toISOString(),
 days:[{date:'2026-11-05',precipitationProbabilityMax:85,temperatureMinC:6,temperatureMaxC:15}]};
const consent={weather:true,weatherCityId:'xian'};
const fx=()=>{
 const d=emptyStore();d.events.push({id:'out1',name:'跑步社团训练',date:'2026-11-05',day:3,start:'16:00',end:'17:00',outdoor:true});return d;
};
const makeContext=(d,weatherSnapshot=fc,consents=consent)=>buildContextSnapshot(d,{now,weatherSnapshot,consents});
test('rain preparation suggestion previews but never writes to tasks without approval',()=>{
 const d=fx(),before=structuredClone(d);
 const ctx=makeContext(d),card=buildContextualSuggestions(ctx)[0];
 assert.equal(card.kind,'outdoor-weather');
 const preview=previewWeatherPreparation(d,ctx,card.id,{now});
 assert.match(preview.task.title,/天气|备选/);
 assert.equal(preview.requiresApproval,true);
 assert.equal(new Date(preview.task.due)<new Date('2026-11-05T16:00:00'),true);
 assert.deepEqual(d,before);
});
test('approved weather prep creates one user-owned internal task and undo restores state',()=>{
 const d=fx(),ctx=makeContext(d),card=buildContextualSuggestions(ctx)[0];
 const preview=previewWeatherPreparation(d,ctx,card.id,{now});
 const result=approveWeatherPreparation(d,ctx,preview,{now:new Date('2026-11-04T10:01:00')});
 assert.equal(d.tasks.length,0);
 assert.equal(result.next.tasks.length,1);
 assert.equal(result.next.transactions.length,1);
 assert.equal(result.next.transactions[0].status,'executed');
 assert.equal(result.next.tasks[0].contextSuggestionId,card.id);
 const restored=undoTransaction(result.next,result.transaction.id,now);
 assert.equal(restored.tasks.length,0);
 assert.throws(()=>approveWeatherPreparation(d,ctx,preview,{now}),/使用|过期|重复/);
});
test('stale forecast, withdrawn consent, and changed event prevent approval',()=>{
 const d=fx(),ctx=makeContext(d),id=buildContextualSuggestions(ctx)[0].id;
 const p=previewWeatherPreparation(d,ctx,id,{now});
 assert.throws(()=>approveWeatherPreparation(d,makeContext(d,null),p,{now}),/变化|来源|过期|重新/);
 assert.throws(()=>approveWeatherPreparation(d,makeContext(d,fc,{}),p,{now}),/变化|来源|过期|重新/);
 const different=structuredClone(d);different.events[0].start='17:00';
 assert.throws(()=>approveWeatherPreparation(different,makeContext(different),p,{now}),/变化|来源|过期|重新/);
 assert.equal(d.tasks.length,0);
});
test('forged preview, wrong suggestion kind or duplicate task are blocked',()=>{
 const d=fx(),ctx=makeContext(d),id=buildContextualSuggestions(ctx)[0].id;
 const p=previewWeatherPreparation(d,ctx,id,{now});
 assert.throws(()=>approveWeatherPreparation(d,ctx,{...p,task:{...p.task,title:'代替用户汇款'}},{now}),/修改|篡改|变化/);
 assert.throws(()=>previewWeatherPreparation(d,ctx,'nonexistent',{now}),/不存在/);
 const withTask=structuredClone(d);
 withTask.tasks.push({id:'already',title:'已添加',done:false,contextSuggestionId:id});
 assert.throws(()=>previewWeatherPreparation(withTask,makeContext(withTask),id,{now}),/已经|重复/);
});
test('full weather + journal + existing V4 store action flow retains mode isolation and undo',async()=>{
 const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
 const local=memory(),session=memory();
 const store=createStore({local,session}),journal=createJournalStore({local,getMode:store.mode});
 const data=fx();data.tasks.push({id:'study',title:'真实作业',done:false,due:'2026-11-05T08:00'});
 store.replace(data);
 journal.save({date:'2026-11-04',mood:2,note:'这段内容不能跟着天气出去'});
 let calls=0;
 const city={id:'xian',name:'西安',latitude:34.34,longitude:108.93};
 const daily={time:['2026-11-04','2026-11-05'],precipitation_probability_max:[40,85],
  temperature_2m_min:[6,5],temperature_2m_max:[18,14]};
 const weather=await fetchCityForecast({city,now,authorized:true,fetchImpl:async()=>{
  calls++;return new Response(JSON.stringify({daily}),{status:200});
 }});
 assert.equal(calls,1);
 const getContext=()=>buildContextSnapshot(store.current(),{
  now,consents:{mood:true,weather:true,weatherCityId:'xian'},
  journalEntries:journal.all(),weatherSnapshot:weather
 });
 const controller=createContextActionController({getData:store.current,getContext,persist:x=>store.replace(x),clock:()=>now});
 const cards=buildContextualSuggestions(getContext());
 assert.deepEqual(new Set(cards.map(x=>x.kind)),new Set(['gentle-day','outdoor-weather']));
 const preview=controller.preview(cards.find(c=>c.kind==='outdoor-weather').id);
 assert.equal(store.current().tasks.length,1);
 const applied=controller.approve(preview);
 assert.equal(store.current().tasks.length,2);
 assert.equal(store.current().tasks.find(x=>x.id===applied.task.id)?.id,applied.task.id);
 controller.undo(applied.transaction.id);
 assert.equal(store.current().tasks.length,1);
 assert.equal(journal.all()[0].note,'这段内容不能跟着天气出去');
 store.setMode('demo');
 assert.equal(store.current().tasks.length,3);
 assert.deepEqual(journal.all(),[]);
});
test('gentle mood suggestion is never silently converted into a task',()=>{
 const d=fx();d.tasks.push({id:'t1',title:'作业',done:false,due:'2026-11-05T08:00'});
 const ctx=buildContextSnapshot(d,{now,consents:{mood:true},
  journalEntries:[{date:'2026-11-04',mood:1,note:'private'}]});
 const card=buildContextualSuggestions(ctx)[0];
 assert.equal(card.kind,'gentle-day');
 assert.throws(()=>previewWeatherPreparation(d,ctx,card.id,{now}),/天气|不存在/);
 assert.equal(d.tasks.length,1);
});
