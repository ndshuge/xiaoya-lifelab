import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMoodSeries,buildGoalSeries} from '../journal-series.mjs';
const entries=[['2026-11-11',2],['2026-11-12',4],['2026-11-14',3],['2026-11-15',null],['2026-11-16',5]].map(([date,mood])=>({date,mood,note:'正文'}));
test('seven days, two-day segment, missing gaps, text-only entry',()=>{
 const copy=structuredClone(entries);
 const x=buildMoodSeries(entries,{endDate:'2026-11-17',days:7});
 assert.deepEqual(x.points.map(p=>p.date),['2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15','2026-11-16','2026-11-17']);
 assert.equal(x.moodCount,4);assert.equal(x.entryCount,5);
 assert.deepEqual(x.segments.map(s=>s.map(p=>p.date)),[['2026-11-11','2026-11-12'],['2026-11-14'],['2026-11-16']]);
 assert.equal(x.points[4].mood,null);assert.deepEqual(entries,copy);
});
test('zero, singleton, 30 and 90 days, leap day and duplicate rejection',()=>{
 const none=buildMoodSeries([],{endDate:'2026-11-17',days:30});assert.equal(none.points.length,30);assert.equal(none.segments.length,0);
 const one=buildMoodSeries([{date:'2026-11-17',mood:3}],{endDate:'2026-11-17',days:7});
 assert.equal(one.segments.length,1);assert.equal(one.segments[0].length,1);
 const long=buildMoodSeries([],{endDate:'2024-03-01',days:90});assert.ok(long.points.some(p=>p.date==='2024-02-29'));
 assert.equal(long.points.length,90);assert.equal(buildMoodSeries([],{endDate:'2026-11-17',days:30}).points.length,30);
 assert.throws(()=>buildMoodSeries([...entries,entries[0]],{endDate:'2026-11-17',days:7}));
 assert.throws(()=>buildMoodSeries([{date:'2026-02-30',mood:1}],{endDate:'2026-11-17',days:7}));
});
test('goal chart counts actual checkins, not planned events',()=>{
 const list=[{goalId:'g1',at:'2026-11-16T10:00:00+08:00',minutes:20},{goalId:'g1',at:'2026-11-17T09:00:00+08:00',minutes:30},{goalId:'g2',at:'2026-11-17T09:00:00+08:00',minutes:80},{goalId:'g1',at:'2026-12-01T09:00:00+08:00',minutes:90}];
 const r=buildGoalSeries(list,{goalId:'g1',endDate:'2026-11-17',weeks:8});
 assert.equal(r.length,8);assert.equal(r.at(-1).weekStart,'2026-11-16');assert.equal(r.at(-1).count,2);assert.equal(r.at(-1).minutes,50);
 assert.equal(r.reduce((n,w)=>n+w.count,0),2);
});
