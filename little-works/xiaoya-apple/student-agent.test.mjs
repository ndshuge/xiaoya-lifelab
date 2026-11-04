import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore} from './core.js';
import {undoTransaction} from './domain.js';
import {
 buildStudentAgentFeed,
 previewStudentAgentAction,
 approveStudentAgentAction,
 respondStudentAgentSuggestion,
 createStudentAgentController
} from './student-agent.js';

const now=new Date('2026-11-04T10:00:00');
function fixture(){
 const d=emptyStore();
 d.tasks.push({id:'ddl-homework',title:'线性代数作业',type:'assignment',course:'线性代数',due:'2026-11-05T22:00',minutes:45,done:false});
 d.goals.push({id:'goal-guitar',title:'练习吉他',category:'兴趣',weeklyTarget:3,done:false});
 return d;
}
const list=(d,at=now)=>buildStudentAgentFeed(d,{now:at}).candidates;
const goal=(d,at=now)=>list(d,at).find(x=>x.kind==='weekly-goal');
const deadline=(d,at=now)=>list(d,at).find(x=>x.kind==='deadline');

test('empty private archive yields no invented progress or automatic actions',()=>{
 const d=emptyStore(),copy=structuredClone(d),feed=buildStudentAgentFeed(d,{now});
 assert.equal(feed.mode,'rule'); assert.equal(feed.modelUsed,false);
 assert.equal(feed.candidates.filter(x=>x.action).length,0);
 assert.deepEqual(d,copy);
});
test('deadlines and weekly growth opportunities coexist with evidence from source data',()=>{
 const d=fixture(),snapshot=structuredClone(d);
 const feed=buildStudentAgentFeed(d,{now});
 assert.ok(feed.candidates.some(x=>x.kind==='deadline'));
 const g=feed.candidates.find(x=>x.kind==='weekly-goal');
 assert.ok(g); assert.match(g.reason,/本周|记录|目标/);
 assert.deepEqual(g.sources,[{kind:'goal',id:'goal-guitar'}]);
 assert.equal(g.needsApproval,true);assert.equal(g.action.type,'planGoal');
 assert.equal(g.action.goalId,'goal-guitar');
 assert.equal(feed.modelUsed,false);
 assert.deepEqual(d,snapshot);
});
test('weekly goal suggestions stop after target checkins or a scheduled session',()=>{
 const d=fixture();
 d.checkins.push(...[1,2,3].map(x=>({id:'c'+x,goalId:'goal-guitar',at:'2026-11-04T09:00:00',minutes:20})));
 assert.equal(goal(d),undefined);
 d.checkins=[];
 d.events.push({id:'e1',name:'练习吉他',date:'2026-11-05',day:3,start:'17:00',end:'17:30',goalId:'goal-guitar'});
 assert.equal(goal(d),undefined);
});
test('preview does not save, explicit approval creates one inspectable and undoable event',()=>{
 const d=fixture(),before=structuredClone(d),candidate=goal(d);
 assert.ok(candidate);
 const preview=previewStudentAgentAction(d,candidate.id,{now});
 assert.equal(preview.id,candidate.id);
 assert.equal(preview.requiresApproval,true);
 assert.deepEqual(d,before);
 const out=approveStudentAgentAction(d,preview,{now});
 assert.deepEqual(d,before);
 assert.equal(out.next.events.length,d.events.length+1);
 assert.equal(out.next.decisions.at(-1).status,'executed');
 assert.equal(out.next.events.at(-1).goalId,'goal-guitar');
 assert.ok(out.transaction.id);
 const back=undoTransaction(out.next,out.transaction.id,now);
 assert.deepEqual(back.events,d.events);
 assert.throws(()=>approveStudentAgentAction(out.next,preview,{now}),/已处理|过期|重新/);
});
test('tampered or stale preview never executes actions or changes archives',()=>{
 const d=fixture(),preview=previewStudentAgentAction(d,goal(d).id,{now});
 const changed=structuredClone(d);changed.goals[0].weeklyTarget=7;
 const changedCopy=structuredClone(changed);
 assert.throws(()=>approveStudentAgentAction(changed,preview,{now}),/变化|重新|过期/);
 assert.deepEqual(changed,changedCopy);
 assert.throws(()=>approveStudentAgentAction(d,{...preview,action:{...preview.action,start:'2026-11-04T00:00'}},{now}),/变化|篡改|重新/);
 assert.throws(()=>previewStudentAgentAction(d,'fake-id',{now}),/不存在|过期/);
});
test('snooze temporarily hides a suggestion, then expires without writing tasks',()=>{
 const d=fixture(),candidate=goal(d),before=structuredClone(d);
 const s=respondStudentAgentSuggestion(d,candidate.id,'snooze',{now,hours:24});
 assert.deepEqual(d,before);
 assert.equal(s.next.tasks.length,d.tasks.length);
 assert.equal(goal(s.next,now),undefined);
 assert.ok(goal(s.next,new Date('2026-11-05T11:00:00')));
 assert.throws(()=>respondStudentAgentSuggestion(d,candidate.id,'snooze',{now,hours:0}),/1.*168/);
});
test('rejection suppresses only the chosen proposal and leaves other risks visible',()=>{
 const d=fixture(),id=goal(d).id;
 const r=respondStudentAgentSuggestion(d,id,'reject',{now});
 assert.equal(r.next.decisions.at(-1).status,'rejected');
 assert.equal(goal(r.next),undefined);
 assert.ok(deadline(r.next));
 assert.deepEqual(d.decisions,[]);
});
test('preview remains valid through a short human review interval and cannot be replayed',()=>{
 const d=fixture(),preview=previewStudentAgentAction(d,goal(d).id,{now});
 const later=new Date('2026-11-04T10:02:00');
 const result=approveStudentAgentAction(d,preview,{now:later});
 assert.equal(result.next.events.length,1);
 assert.throws(()=>approveStudentAgentAction(d,preview,{now:later}),/预览|批准|过期|重复/);
});
test('student agent can persist approval through existing V4 archive and undo it',async()=>{
 const {createStore}=await import('./native-v4/store.mjs');
 const make=()=>{const state=new Map();return {getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,v)}};
 const store=createStore({local:make(),session:make()});
 store.replace(fixture());
 const before=store.current(),preview=previewStudentAgentAction(before,goal(before).id,{now});
 const result=approveStudentAgentAction(before,preview,{now});store.replace(result.next);
 assert.equal(store.current().events.filter(e=>e.goalId==='goal-guitar').length,1);
 store.replace(undoTransaction(store.current(),result.transaction.id,now));
 assert.equal(store.current().events.filter(e=>e.goalId==='goal-guitar').length,0);
});
test('a snoozed weekly goal becomes executable again after the selected interval',()=>{
 const d=fixture();const old=goal(d);
 const r=respondStudentAgentSuggestion(d,old.id,'snooze',{now,hours:1});
 assert.equal(r.next.history[0].action,'agent-snoozed');
 const later=new Date('2026-11-04T11:01:00');
 const available=goal(r.next,later);assert.ok(available);
 const preview=previewStudentAgentAction(r.next,available.id,{now:later});
 const approved=approveStudentAgentAction(r.next,preview,{now:later});
 assert.equal(approved.next.events.some(e=>e.goalId==='goal-guitar'),true);
});
test('two real overlapping schedule sources remain traceable alongside growth goals',()=>{
 const d=fixture();
 d.courses.push({id:'fixed-class',name:'英语课',day:3,start:'15:00',end:'16:30',weekStart:1,weekEnd:54,parity:'all',exceptions:[]});
 d.events.push({id:'club-event',name:'社团例会',day:3,start:'16:00',end:'17:00',weekStart:1,weekEnd:54,parity:'all',exceptions:[]});
 const feed=list(d),conflict=feed.find(x=>x.kind==='conflict');
 assert.ok(conflict);assert.equal(conflict.sources.length,2);
 assert.deepEqual(new Set(conflict.sources.map(s=>s.id)),new Set(['fixed-class','club-event']));
 assert.ok(feed.some(x=>x.kind==='weekly-goal'));
});
test('UI controller keeps all saves explicit and has one invocation path for undo',()=>{
 let data=fixture(),writes=0;
 const controller=createStudentAgentController({
  getData:()=>structuredClone(data),
  persist:next=>{writes++;data=structuredClone(next)},
  clock:()=>new Date(now)
 });
 const c=controller.feed().candidates.find(x=>x.kind==='weekly-goal');
 assert.ok(c);assert.equal(writes,0);
 const preview=controller.preview(c.id);assert.equal(writes,0);
 const result=controller.approve(preview);assert.equal(writes,1);
 assert.equal(data.events.some(x=>x.goalId==='goal-guitar'),true);
 assert.equal(result.transaction.id,data.transactions.at(-1).id);
 controller.undo(result.transaction.id);assert.equal(writes,2);
 assert.equal(data.events.some(x=>x.goalId==='goal-guitar'),false);
});
test('feedback cannot duplicate or misrepresent approved operations',()=>{
 const d=fixture(),c=deadline(d);assert.ok(c);
 assert.throws(()=>respondStudentAgentSuggestion(d,'missing','reject',{now}),/不存在|过期/);
 assert.throws(()=>respondStudentAgentSuggestion(d,c.id,'execute',{now}),/操作|支持|类型/);
 const r=respondStudentAgentSuggestion(d,c.id,'snooze',{now,hours:1});
 assert.throws(()=>previewStudentAgentAction(r.next,c.id,{now}),/稍后|不存在|过期/);
});
