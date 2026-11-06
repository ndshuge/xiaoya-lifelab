import test from 'node:test';
import assert from 'node:assert/strict';
import {demoData,validateStore,emptyStore} from '../../core.js';
import {validateJournalArchive} from '../../native-v4/journal-store.mjs';
import {needsDemoHistory,buildDemoHistory} from '../demo-history.mjs';
import {buildLongLine} from '../page-model.mjs';

const NOW=new Date('2026-11-05T09:30:00+08:00');

test('fresh demo needs history; an archive with any history does not',()=>{
 const d=demoData(NOW);assert.equal(needsDemoHistory(d,[]),true);
 assert.equal(needsDemoHistory(d,[{date:'2026-11-01',mood:3,note:'',tags:[]}]),false);
 const e=emptyStore();e.checkins.push({id:'x',goalId:'g',at:NOW.toISOString(),minutes:5});assert.equal(needsDemoHistory(e,[]),false);
});
test('synthetic history is valid, deterministic, past-only and fills the long line',()=>{
 const a=buildDemoHistory(demoData(NOW),NOW),b=buildDemoHistory(demoData(NOW),NOW);
 assert.deepEqual(a.data.checkins,b.data.checkins,'deterministic');
 validateStore(a.data);validateJournalArchive(a.journal);
 assert.ok(a.data.checkins.every(c=>new Date(c.at)<NOW));assert.ok(a.journal.every(e=>e.date<'2026-11-02'));
 assert.ok(a.journal.every(e=>e.tags.includes('演示')),'journal entries are labelled demo');
 const L=buildLongLine(a.data,a.journal,{now:NOW});
 assert.ok(L.doneRow.slice(0,5).some(x=>x&&x.done>0));
 assert.ok(L.moodRow.slice(0,5).flat().some(x=>x.mood!=null));
 assert.ok(L.goals.find(g=>g.id==='demo-g2').cells.slice(0,5).some(c=>c.knots.length));
});
