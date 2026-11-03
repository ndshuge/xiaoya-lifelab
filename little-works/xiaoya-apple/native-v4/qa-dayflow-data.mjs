import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore,demoData} from '../core.js';
import {buildTodayViewModel} from './dayflow.mjs';

const NOW=new Date('2026-11-02T09:00:00');
const once=(name,date,start,end,id)=>({id,name,date,day:0,start,end,weekStart:1,weekEnd:54,parity:'all',exceptions:[]});

test('reads genuine timeline events in chronological order and selects the next ongoing event',()=>{
 const d=emptyStore();
 d.events=[
  once('下午活动','2026-11-02','15:00','16:00','ev-2'),
  once('上午活动','2026-11-02','08:30','09:30','ev-1'),
  once('午间活动','2026-11-02','12:00','13:00','ev-3')
 ];
 const model=buildTodayViewModel(d,NOW);
 assert.deepEqual(model.schedule.map(e=>e.id),['ev-1','ev-3','ev-2']);
 assert.equal(model.nextEvent.id,'ev-1');
 assert.equal(model.nextEvent.isOngoing,true);
 assert.equal(model.schedule[0].place,'');
});

test('does not invent events on an empty day and preserves upcoming real events',()=>{
 const d=demoData(NOW);
 const snapshot=structuredClone(d);
 const model=buildTodayViewModel(d,NOW);
 assert.equal(model.schedule.length,0);
 assert.equal(model.nextEvent,null);
 assert.ok(model.nextUpcoming,'next upcoming actual class should be discoverable');
 assert.equal(model.nextUpcoming.name,'高等数学');
 assert.equal(model.tasks.length,3);
 assert.equal(model.tasks[0].title,'工数习题第六章');
 assert.deepEqual(d,snapshot,'read-only formatting must not mutate user data');
});

test('a truly empty archive is shown honestly, without synthetic plans or recommendations',()=>{
 const model=buildTodayViewModel(emptyStore(),NOW);
 assert.deepEqual(model.schedule,[]);
 assert.equal(model.nextUpcoming,null);
 assert.deepEqual(model.tasks,[]);
 assert.ok(model.suggestion);
 assert.equal(model.suggestion.kind,'welcome');
 assert.equal(model.suggestion.action,null);
});

test('completed tasks stay out of the upcoming to-do queue',()=>{
 const d=emptyStore();
 d.tasks=[
  {id:'1',title:'已完成',due:'2026-11-02T10:00',done:true},
  {id:'2',title:'未完成无截止',done:false},
  {id:'3',title:'未完成有截止',due:'2026-11-03T09:00',done:false}
 ];
 const m=buildTodayViewModel(d,NOW);
 assert.deepEqual(m.tasks.map(x=>x.title),['未完成有截止','未完成无截止']);
});

test('suggestions keep original source evidence and approval actions, never auto-apply',()=>{
 const d=demoData(NOW);
 const prev=structuredClone(d);
 const m=buildTodayViewModel(d,NOW);
 assert.ok(m.suggestion);
 assert.ok(['conflict','deadline','goal'].includes(m.suggestion.kind));
 assert.ok(Array.isArray(m.suggestion.sources));
 assert.deepEqual(d,prev);
});
