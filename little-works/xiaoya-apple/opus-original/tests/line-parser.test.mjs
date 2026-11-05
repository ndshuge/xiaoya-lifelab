import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLine,cnNumber} from '../line-parser.mjs';

const NOW=new Date('2026-11-05T10:00:00'); // Thursday

test('chinese numerals',()=>{
 assert.equal(cnNumber('十'),10);assert.equal(cnNumber('十二'),12);assert.equal(cnNumber('二十'),20);assert.equal(cnNumber('两'),2);assert.equal(cnNumber('7'),7);
});
test('deadline task with relative evening and duration',()=>{
 const r=parseLine('明晚十点前交工数习题 45分钟',NOW);
 assert.equal(r.intent,'task');
 assert.equal(r.fields.due,'2026-11-06T22:00');
 assert.equal(r.fields.minutes,45);
 assert.equal(r.fields.type,'assignment');
 assert.match(r.fields.title,/工数习题/);
 assert.doesNotMatch(r.fields.title,/明晚|十点|45/);
});
test('weekday deadline defaults to 23:59 with a note',()=>{
 const r=parseLine('周五前交实验报告 90分钟',NOW);
 assert.equal(r.fields.due,'2026-11-06T23:59');
 assert.equal(r.fields.minutes,90);
 assert.ok(r.notes.some(n=>n.includes('23:59')));
});
test('past weekday rolls to next week; 下周 adds seven days',()=>{
 assert.equal(parseLine('周一交读书笔记',NOW).fields.due.slice(0,10),'2026-11-09');
 assert.equal(parseLine('下周三考线代',NOW).fields.due.slice(0,10),'2026-11-11');
 assert.equal(parseLine('下周三考线代',NOW).fields.type,'exam');
});
test('time range becomes a single-date event with place',()=>{
 const r=parseLine('明天下午3点到5点 机器人社团例会 @创新中心',NOW);
 assert.equal(r.intent,'event');
 assert.equal(r.fields.date,'2026-11-06');
 assert.equal(r.fields.start,'15:00');assert.equal(r.fields.end,'17:00');
 assert.equal(r.fields.place,'创新中心');
 assert.match(r.fields.name,/机器人社团例会/);
});
test('clock format and half hour',()=>{
 const r=parseLine('11月8日 14:30 小组讨论会',NOW);
 assert.equal(r.intent,'event');assert.equal(r.fields.date,'2026-11-08');assert.equal(r.fields.start,'14:30');assert.equal(r.fields.end,'15:30');
 assert.equal(parseLine('今晚七点半 跑步训练',NOW).fields.start,'19:30');
});
test('undated todo goes to pocket',()=>{
 const r=parseLine('买洗衣液',NOW);
 assert.equal(r.intent,'task');assert.equal(r.fields.due,'');assert.equal(r.fields.title,'买洗衣液');
});
test('weekly goal',()=>{
 const r=parseLine('每周练两次架子鼓 30分钟',NOW);
 assert.equal(r.intent,'goal');assert.equal(r.fields.weeklyTarget,2);assert.match(r.fields.title,/架子鼓/);
});
test('questions are routed to conversation',()=>{
 for(const q of ['今天先做什么','我明天有空吗','什么时候有空？','帮我看看这周','找 实验'])assert.equal(parseLine(q,NOW).intent,'question',q);
});
test('invalid calendar date is reported, not invented',()=>{
 const r=parseLine('2月30日交论文',NOW);
 assert.ok(r.notes.some(n=>n.includes('日期不存在')));
});
test('forced intent overrides guess',()=>{
 assert.equal(parseLine('今天先做什么',NOW,{forceIntent:'task'}).intent,'task');
});
