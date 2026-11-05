import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore,demoData} from '../../core.js';
import {buildStudentAgentFeed} from '../../student-agent.js';
import {buildDay,buildWeek,buildLongLine,headline,pencilStrokes,assignLanes,freeWindows,localAnswer,timeMap,withException} from '../page-model.mjs';
import {checkSchedule} from '../../domain.js';
import {buildEnvelope} from '../envelope.mjs';

const NOW=new Date('2026-11-05T10:00:00'); // Thursday
const demo=()=>demoData(NOW);

test('lanes split overlapping blocks only',()=>{
 const out=assignLanes([{top:0,bottom:60},{top:30,bottom:90},{top:100,bottom:120}]);
 assert.deepEqual(out.map(b=>[b.lane,b.lanes]),[[0,2],[1,2],[0,1]]);
});
test('deadline is a moment line, not a block; demo Wednesday has course+event conflict',()=>{
 const d=demo();
 const wed=buildDay(d,'2026-11-04',{now:NOW});
 assert.equal(wed.blocks.filter(b=>b.type==='ink').length,2);
 assert.ok(wed.conflicts.length>=1,'16:00 overlap between lab and club');
 assert.ok(wed.blocks.every(b=>b.conflict));
 const fri=buildDay(d,'2026-11-06',{now:NOW});
 assert.equal(fri.deadlines.length,1);assert.equal(fri.deadlines[0].time,'22:00');
 assert.ok(!fri.blocks.some(b=>b.title==='工数习题第六章'),'deadline must not render as a work block');
});
test('pencil strokes come from real engine actions and land on their slot date',()=>{
 const d=demo();
 const feed=buildStudentAgentFeed(d,{now:NOW});
 const strokes=pencilStrokes(feed.candidates);
 assert.ok(strokes.length>0);
 for(const s of strokes){assert.ok(s.candidate.action);assert.equal(s.date,s.start.slice(0,10))}
 const day=buildDay(d,strokes[0].date,{now:NOW,pencils:strokes});
 assert.ok(day.blocks.some(b=>b.type==='pencil'));
});
test('headline is honest for an empty archive and grounded otherwise',()=>{
 const e=emptyStore();
 assert.match(headline(e,buildDay(e,'2026-11-05',{now:NOW}),{now:NOW}).text,/空的/);
 const d=demo();
 const h=headline(d,buildDay(d,'2026-11-05',{now:NOW}),{now:NOW}).text;
 assert.match(h,/工数习题第六章/);
});
test('week model counts deadlines and conflicts',()=>{
 const w=buildWeek(demo(),NOW,{now:NOW});
 assert.equal(w.days.length,7);assert.ok(w.conflicts>=1);
 assert.equal(w.days.find(x=>x.isToday).key,'2026-11-05');
});
test('long line aligns check-ins and mood to weeks',()=>{
 const d=demo();d.checkins.push({id:'c1',goalId:'demo-g1',at:'2026-11-03T20:00:00.000Z',minutes:20,note:'练了基础节奏'});
 const L=buildLongLine(d,[{date:'2026-11-04',mood:4,note:'私人内容',tags:[]}],{now:NOW});
 const g=L.goals[0];
 assert.equal(g.cells.find(c=>c.isCurrent).knots.length,1);
 assert.equal(L.moodRow.flat().find(x=>x.date==='2026-11-04').mood,4);
});
test('time map squeezes long empty stretches into bands and stays monotonic',()=>{
 const d=demo();
 const day=buildDay(d,'2026-11-04',{now:NOW}); // 08–22 with 15:00–18:00 busy
 const map=timeMap(day,{hour:56});
 const bands=map.segments.filter(s=>s.band);
 assert.ok(bands.length>=1,'morning gap is squeezed');
 assert.ok(map.height<14*56,'shorter than a linear 08–22 ribbon');
 for(let m=day.startHour*60;m<day.endHour*60;m+=10)assert.ok(map.y(m+10)>=map.y(m),'monotonic at '+m);
 const lab=day.blocks.find(b=>b.title==='电子技术实验');
 assert.equal(Math.round(map.y(lab.bottom)-map.y(lab.top)),Math.round(100/60*56),'busy time keeps true scale');
 assert.equal(map.minuteAt(map.y(lab.top)+1)>=lab.top,true);
});
test('split proposals stack as a whole',()=>{
 const pencils=[{id:'a',step:0,steps:1,title:'A',start:'2026-11-05T10:00',end:'2026-11-05T11:00',date:'2026-11-05'},
  {id:'b',step:0,steps:2,title:'B1',start:'2026-11-05T10:30',end:'2026-11-05T11:15',date:'2026-11-05'},
  {id:'b',step:1,steps:2,title:'B2',start:'2026-11-05T11:15',end:'2026-11-05T12:00',date:'2026-11-05'}];
 const day=buildDay(emptyStore(),'2026-11-05',{now:NOW,pencils});
 const shown=day.blocks.filter(b=>b.type==='pencil');
 assert.deepEqual(shown.map(b=>b.id),['a']);
 assert.deepEqual(shown[0].others.map(o=>o.id),['b']);
});
test('one-off cancel leaves a ghost, removes the conflict and is reversible',()=>{
 const d=demo();const lab=d.courses.find(c=>c.id==='demo-c1');
 d.courses=d.courses.map(c=>c.id==='demo-c1'?withException(lab,'2026-11-04',{type:'cancel'}):c);
 checkSchedule(d.courses.find(c=>c.id==='demo-c1'));
 const wed=buildDay(d,'2026-11-04',{now:NOW});
 assert.ok(!wed.blocks.some(b=>b.title==='电子技术实验'));
 assert.deepEqual(wed.ghosts.map(g=>[g.title,g.exception,g.start]),[['电子技术实验','cancel','15:00']]);
 assert.equal(wed.conflicts.length,0);
 const restored=withException(d.courses.find(c=>c.id==='demo-c1'),'2026-11-04',null);
 assert.deepEqual(restored.exceptions,[]);
});
test('one-off reschedule moves the occurrence to the target date and marks its origin',()=>{
 const d=demo();const lab=d.courses.find(c=>c.id==='demo-c1');
 const moved=withException(lab,'2026-11-04',{type:'replace',targetDate:'2026-11-06',start:'14:00',end:'15:40',place:'实验中心 B101'});
 checkSchedule(moved);d.courses=d.courses.map(c=>c.id==='demo-c1'?moved:c);
 const wed=buildDay(d,'2026-11-04',{now:NOW});assert.equal(wed.ghosts[0].exception,'replace');assert.equal(wed.ghosts[0].target.date,'2026-11-06');
 const fri=buildDay(d,'2026-11-06',{now:NOW});const b=fri.blocks.find(x=>x.title==='电子技术实验');
 assert.equal(b.start,'14:00');assert.equal(b.movedFrom,'2026-11-04');assert.equal(b.occurrenceDate,'2026-11-04');assert.equal(b.place,'实验中心 B101');
 const next=buildDay(d,'2026-11-11',{now:NOW});assert.ok(next.blocks.some(x=>x.title==='电子技术实验'&&x.start==='15:00'),'other weeks unchanged');
 const w=buildWeek(d,NOW,{now:NOW});assert.equal(w.days[2].ghosts.length,1);assert.ok(w.days[4].items.some(i=>i.moved));
});
test('free windows respect recorded events',()=>{
 const w=freeWindows(demo(),'2026-11-04',{now:NOW});
 assert.ok(w.every(x=>!(x.start<'18:00'&&x.end>'15:00')));
});
test('local answers are grounded or null',()=>{
 const d=demo();
 assert.match(localAnswer('明天有空吗',d,{now:NOW}),/空档/);
 assert.match(localAnswer('最近有什么截止',d,{now:NOW}),/工数习题第六章/);
 assert.match(localAnswer('我心情怎么样',d,{now:NOW,context:{permissions:{mood:false}}}),/默认不读取/);
 assert.equal(localAnswer('讲个笑话',d,{now:NOW}),null);
 const found=localAnswer('找 实验',d,{now:NOW});
 assert.ok(found.results.some(r=>r.kind==='course'&&r.title==='电子技术实验'));
 assert.ok(found.results.some(r=>r.kind==='task'&&r.title==='阅读实验指导书'));
 assert.match(localAnswer('找 不存在的东西',d,{now:NOW}),/没有找到/);
});
test('envelope only carries selected scopes and never journal text',()=>{
 const d=demo();
 const none=buildEnvelope(d,[],{now:NOW});assert.equal(none.text,'');assert.equal(none.items.length,0);
 const all=buildEnvelope(d,['today','deadlines','goals','mood'],{now:NOW,moodToday:2});
 assert.match(all.text,/工数习题第六章/);assert.match(all.text,/2\/5/);
 assert.doesNotMatch(all.text,/私人内容/);
 const noMood=buildEnvelope(d,['mood'],{now:NOW,moodToday:null});assert.equal(noMood.items.length,0);
});
