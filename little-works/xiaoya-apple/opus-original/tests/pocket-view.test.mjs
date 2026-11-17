import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPocketTasks,renderPocketView} from '../pocket-view.mjs';
const t=(id,extra={})=>({id,title:'任务'+id,done:false,due:null,...extra});
test('undated, due, overdue and completed stay distinct without mutation',()=>{
 const data={tasks:[t('old'),t('late',{due:'2026-11-16T12:00'}),t('future',{due:'2026-12-10T20:00'}),t('new',{createdAt:'2026-11-17T09:00:00'}),t('done',{done:true,completedAt:'2026-11-17T10:00:00'})]};
 const before=structuredClone(data);
 const now=new Date('2026-11-17T12:00:00');
 assert.deepEqual(selectPocketTasks(data,{now})[0].tasks.map(x=>x.id),['old','new']); // no createdAt on old: relative position remains
 const due=selectPocketTasks(data,{filter:'deadline',now});
 assert.deepEqual(due.map(g=>g.tasks.map(x=>x.id)),[['late'],['future']]);
 assert.deepEqual(selectPocketTasks(data,{filter:'completed',now})[0].tasks.map(x=>x.id),['done']);
 assert.deepEqual(data,before);
 const html=renderPocketView(data,{filter:'deadline',now});
 assert.match(html,/已逾期/);assert.match(html,/data-pocket-detail="late"/);
 assert.doesNotMatch(html,/data-pocket-detail="old"/);
});
