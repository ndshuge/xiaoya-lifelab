import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore} from './core.js';
import {undoTransaction} from './domain.js';
import {
  buildAdaptiveGrowthPlan,analyzeAdaptiveGrowth,
  previewAdaptiveGrowthSession,approveAdaptiveGrowthSession,createAdaptiveGrowthController
} from './adaptive-growth-agent.js';

const t=new Date('2026-11-04T10:00:00');
function fixture(){
 const d=emptyStore();
 d.goals.push({id:'g1',title:'练习吉他',weeklyTarget:3,category:'兴趣',done:false});
 d.tasks.push({id:'t1',title:'作业',type:'assignment',course:'线代',due:'2026-11-05T22:00',minutes:240,done:false});
 d.checkins.push({id:'c1',goalId:'g1',at:'2026-10-28T15:00:00',minutes:20,note:'弹了一次'});
 return d;
}
test('four-week adaptive route responds to actual deadline pressure without fabricating outcomes',()=>{
 const d=fixture(),before=structuredClone(d),plan=buildAdaptiveGrowthPlan(d,{now:t,weeks:4});
 assert.equal(plan.mode,'rule');
 assert.equal(plan.modelUsed,false);
 assert.equal(plan.horizonWeeks,4);
 assert.equal(plan.goals.length,1);
 assert.equal(plan.goals[0].weeks.length,4);
 assert.equal(plan.goals[0].evidence.previousActions,1);
 assert.equal(plan.workload.dueMinutes,240);
 assert.equal(plan.goals[0].selectedRouteId,'gentle');
 assert.ok(plan.goals[0].reason.includes('截止')||plan.goals[0].reason.includes('负担'));
 assert.ok(plan.goals[0].sources.some(s=>s.kind==='goal'&&s.id==='g1'));
 assert.deepEqual(d,before);
 assert.equal(plan.goals[0].weeks.every(w=>!('completed' in w)),true);
});
test('replanning changes strategy on observed performance and workload changes',()=>{
 const d=fixture();
 const heavy=buildAdaptiveGrowthPlan(d,{now:t});
 d.tasks=[];
 d.checkins.push(...[1,2,3].map(i=>({id:'new'+i,goalId:'g1',at:'2026-11-02T10:00:00',minutes:30})));
 const light=buildAdaptiveGrowthPlan(d,{now:t});
 assert.notEqual(heavy.goals[0].selectedRouteId,light.goals[0].selectedRouteId);
 assert.ok(light.goals[0].evidence.currentActions===3);
 assert.equal(light.goals[0].weeks[0].plannedActions,0);
 assert.notEqual(heavy.evidenceBasis,light.evidenceBasis);
});
test('no stored goals generates no invented future plans',()=>{
 const plan=buildAdaptiveGrowthPlan(emptyStore(),{now:t});
 assert.equal(plan.goals.length,0);
 assert.equal(plan.modelUsed,false);
 assert.ok(plan.notice);
});
test('no authorization implies zero provider calls even when provider exists',async()=>{
 let calls=0;
 const provider={plan:async()=>{calls++;throw Error('should not be called')}};
 const p=await analyzeAdaptiveGrowth(fixture(),{now:t,provider});
 assert.equal(calls,0);assert.equal(p.modelUsed,false);assert.equal(p.mode,'rule');
});
test('authorized model chooses a bounded schedule strategy, not arbitrary execution code',async()=>{
 let seen;
 const provider={name:'synthetic provider',plan:async ({context,options,signal})=>{
  seen={context,options,aborted:signal.aborted};
  return {choices:[{goalId:'g1',routeId:'steady',reason:'这周有考试，选择适度练习。'}]};
 }};
 const d=fixture();d.journal=[{private:'do not share'}];d.settings.privateSecret='never-send';
 const p=await analyzeAdaptiveGrowth(d,{now:t,provider,authorized:true});
 assert.equal(p.modelUsed,true);assert.equal(p.mode,'authorized-model');
 assert.equal(p.goals[0].selectedRouteId,'steady');
 assert.equal(p.goals[0].modelReason,'这周有考试，选择适度练习。');
 assert.ok(!JSON.stringify(seen).includes('do not share'));
 assert.ok(!JSON.stringify(seen).includes('never-send'));
 assert.equal(seen.aborted,false);
});
test('authorized model choice changes the approved real action duration, not just the text',async()=>{
 const d=fixture();
 const base=buildAdaptiveGrowthPlan(d,{now:t});
 const ai=await analyzeAdaptiveGrowth(d,{now:t,authorized:true,provider:{name:'test-only model',
  plan:async()=>({choices:[{goalId:'g1',routeId:'steady',reason:'根据近期学习负担先稳定行动'}]})
 }});
 assert.equal(base.goals[0].selectedRouteId,'gentle');
 assert.equal(ai.goals[0].selectedRouteId,'steady');
 const preview=previewAdaptiveGrowthSession(d,ai,'g1',{now:t});
 assert.equal(preview.action.minutes,30);
 const out=approveAdaptiveGrowthSession(d,preview,{now:t});
 assert.equal(out.next.events.length,1);
 assert.equal(out.next.events[0].goalId,'g1');
 assert.equal((new Date(preview.action.end)-new Date(preview.action.start))/60000,30);
});
test('model tool commands and unknown goal IDs fail closed to grounded rule',async()=>{
 const payloads=[
  {choices:[{goalId:'unknown',routeId:'steady',reason:'sure'}]},
  {choices:[{goalId:'g1',routeId:'steady',reason:'sure',action:{type:'deleteAll'}}]},
  {choices:[{goalId:'g1',routeId:'overnight',reason:'sure'}]}
 ];
 for(const response of payloads){
  const p=await analyzeAdaptiveGrowth(fixture(),{now:t,authorized:true,provider:{plan:async()=>response}});
  assert.equal(p.modelUsed,false);assert.equal(p.mode,'rule-fallback');
  assert.equal(p.goals[0].selectedRouteId,'gentle');
 }
});
test('provider timeout aborts and falls back, no unauthorized writes',async()=>{
 let signal;
 const provider={plan:({signal:s})=>{signal=s;return new Promise(()=>{})}};
 const p=await analyzeAdaptiveGrowth(fixture(),{now:t,authorized:true,timeoutMs:60,provider});
 assert.equal(signal.aborted,true);
 assert.equal(p.mode,'rule-fallback');
 assert.equal(p.modelUsed,false);
});
test('provider exceptions containing private data never appear in user-facing fallback',async()=>{
 const secret='DO_NOT_ECHO_SECRET_256';
 const plan=await analyzeAdaptiveGrowth(fixture(),{now:t,authorized:true,provider:{
  plan:async()=>{throw Error('upstream failure: '+secret)}
 }});
 assert.equal(plan.mode,'rule-fallback');
 assert.ok(!plan.notice.includes(secret));
});
test('only a current-week preview and explicit approval creates safe time block; undo works',()=>{
 const d=fixture(),plan=buildAdaptiveGrowthPlan(d,{now:t});
 const original=structuredClone(d);
 const preview=previewAdaptiveGrowthSession(d,plan,'g1',{now:t});
 assert.equal(preview.requiresApproval,true);assert.equal(preview.action.type,'planGoal');
 assert.deepEqual(d,original);
 const executed=approveAdaptiveGrowthSession(d,preview,{now:new Date('2026-11-04T10:01:00')});
 assert.equal(executed.next.events.length,1);
 assert.equal(executed.next.events[0].goalId,'g1');
 assert.equal(executed.next.transactions.at(-1).status,'executed');
 const undone=undoTransaction(executed.next,executed.transaction.id,t);
 assert.equal(undone.events.length,0);
 assert.throws(()=>approveAdaptiveGrowthSession(d,preview,{now:t}),/过期|使用|再次/);
});
test('stale checkin, expired preview and forged action all block approval',()=>{
 const d=fixture(),p=buildAdaptiveGrowthPlan(d,{now:t});
 const preview=previewAdaptiveGrowthSession(d,p,'g1',{now:t});
 const changed=structuredClone(d);
 changed.checkins.push({id:'late',goalId:'g1',at:'2026-11-04T10:00:00',minutes:20});
 assert.throws(()=>approveAdaptiveGrowthSession(changed,preview,{now:t}),/变化|重新/);
 assert.throws(()=>approveAdaptiveGrowthSession(d,{...preview,action:{...preview.action,minutes:180}},{now:t}),/变化|篡改|重新/);
 assert.throws(()=>approveAdaptiveGrowthSession(d,preview,{now:new Date('2026-11-04T10:12:00')}),/过期|重新/);
});
test('a finished weekly goal does not receive an extra executable session',()=>{
 const d=fixture();
 for(let i=0;i<3;i++)d.checkins.push({id:'current-'+i,goalId:'g1',at:'2026-11-03T15:00:00',minutes:20});
 const plan=buildAdaptiveGrowthPlan(d,{now:t});
 assert.equal(plan.goals[0].weeks[0].plannedActions,0);
 assert.throws(()=>previewAdaptiveGrowthSession(d,plan,'g1',{now:t}),/本周|目标|达成|已完成/);
});
test('controller cannot override authorization or provider via per-call options',async()=>{
 let calls=0;
 const provider={plan:async()=>{calls++;return {choices:[{goalId:'g1',routeId:'focused',reason:'test'}]}}};
 const controller=createAdaptiveGrowthController({
  getData:fixture,persist:()=>{throw Error('write')},provider,authorized:false,clock:()=>t
 });
 const result=await controller.analyze({authorized:true,provider,weeks:4});
 assert.equal(calls,0);
 assert.equal(result.modelUsed,false);
});
test('late Sunday with no free time does not fabricate a session',()=>{
 const d=fixture(),sunday=new Date('2026-11-08T22:30:00');
 const plan=buildAdaptiveGrowthPlan(d,{now:sunday});
 assert.throws(()=>previewAdaptiveGrowthSession(d,plan,'g1',{now:sunday}),/空档|时间/);
});
test('controller has explicit persistence and model analysis never persists by itself',async()=>{
 let stored=fixture(),writes=0;
 const controller=createAdaptiveGrowthController({
  getData:()=>structuredClone(stored),persist:x=>{writes++;stored=structuredClone(x)},clock:()=>t
 });
 const plan=await controller.analyze();assert.equal(writes,0);
 const preview=controller.preview(plan,'g1');assert.equal(writes,0);
 const out=controller.approve(preview);assert.equal(writes,1);
 controller.undo(out.transaction.id);assert.equal(writes,2);assert.equal(stored.events.length,0);
});
