import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore} from '../core.js';
import {splitTasksByDeadline,deadlineTasksForDate} from './items-model.mjs';
import {createJournalStore,validateJournalArchive,analyzeJournal} from './journal-store.mjs';

test('tasks without DDL stay in independent inbox; due tasks belong to deadline dates',()=>{
 const d=emptyStore();
 d.tasks=[
  {id:'a',title:'无期限',done:false},
  {id:'b',title:'今天截止',done:false,due:'2026-11-03T21:00'},
  {id:'c',title:'明天截止',done:false,due:'2026-11-04T22:00'},
  {id:'d',title:'已完成',done:true,due:'2026-11-03T09:00'}
 ];
 const groups=splitTasksByDeadline(d);
 assert.deepEqual(groups.undated.map(t=>t.id),['a']);
 assert.deepEqual(deadlineTasksForDate(d,'2026-11-03').map(t=>t.id),['b']);
 assert.deepEqual(deadlineTasksForDate(d,'2026-11-04').map(t=>t.id),['c']);
 assert.equal(groups.dated.length,2);
});
test('deadline time never becomes a fake scheduled class or focus session',()=>{
 const d=emptyStore();d.tasks.push({id:'x',title:'截止 != 开始',done:false,due:'2026-11-03T22:00'});
 const rows=deadlineTasksForDate(d,'2026-11-03');
 assert.equal(rows[0].due,'2026-11-03T22:00');
 assert.equal(rows[0].scheduledStart,undefined);
});
test('journal mood and entry stay isolated between demo and personal modes',()=>{
 const map=new Map();
 const local={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 let mode='demo';
 const store=createJournalStore({local,getMode:()=>mode});
 store.save({date:'2026-11-03',mood:4,note:'今天读了书'});
 assert.equal(store.all().length,1);
 assert.equal(store.all()[0].mood,4);
 mode='personal';
 assert.deepEqual(store.all(),[]);
 store.save({date:'2026-11-03',mood:2,note:'另一个模式'});
 mode='demo';
 assert.equal(store.all()[0].note,'今天读了书');
 store.remove('2026-11-03');
 assert.deepEqual(store.all(),[]);
 mode='personal';
 assert.equal(store.all()[0].note,'另一个模式');
});
test('journal schema rejects invalid mood, malformed dates, and oversized note',()=>{
 assert.throws(()=>validateJournalArchive([{date:'2026-11-03',mood:6,note:'bad'}]),/心情/);
 assert.throws(()=>validateJournalArchive([{date:'2026-02-30',mood:3,note:''}]),/日期/);
 assert.throws(()=>validateJournalArchive([{date:'2026-11-03',mood:3,note:'a'.repeat(2200)}]),/长度/);
 assert.throws(()=>validateJournalArchive([{date:'2026-11-03',mood:3,note:'x'},{date:'2026-11-03',mood:2,note:'y'}]),/重复/);
});
test('journal export and import provide transparent backups; trend avoids causal claims',()=>{
 const map=new Map();
 const local={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 const s=createJournalStore({local,getMode:()=> 'personal'});
 s.save({date:'2026-11-02',mood:2,note:'复习',tags:['学习']});
 s.save({date:'2026-11-03',mood:4,note:'社团',tags:['活动']});
 const archived=s.all();s.clear();assert.deepEqual(s.all(),[]);
 s.replace(archived);assert.deepEqual(s.all(),archived);
 const stats=analyzeJournal(s.all(),new Date('2026-11-03T12:00:00'));
 assert.equal(stats.count7,2);assert.equal(stats.average7,3);
 assert.match(stats.explanation,/记录|样本/);
 assert.doesNotMatch(stats.explanation,/导致|因为.*所以/);
});
