import {test} from 'node:test'; import assert from 'node:assert/strict';
const {buildDayTimeline,layoutTimelineEvents}=await import('./timeline.mjs');
test('renders a full 24-hour calendar scale',()=>{
 const html=buildDayTimeline([],{date:'2026-10-29',nowDate:new Date('2026-10-29T09:41:00')});
 assert.equal((html.match(/class="hour-tick"/g)||[]).length,24);
 assert.match(html,/native-now/);
 assert.match(html,/09:41/);
});
test('overlapping events use separate lanes without collisions',()=>{
 const a=layoutTimelineEvents([
 {id:'a',name:'Physics',start:'09:00',end:'11:00',kind:'course'},
 {id:'b',name:'English',start:'09:30',end:'10:30',kind:'course'},
 {id:'c',name:'Gym',start:'13:00',end:'14:00',kind:'event'}
 ]);
 assert.equal(a.length,3);assert.equal(a[0].lanes,2);assert.equal(a[1].lanes,2);
 assert.notEqual(a[0].lane,a[1].lane);assert.equal(a[2].lanes,1);
});
test('calendar is safe for user-controlled text and passes event edit through',()=>{
 const html=buildDayTimeline([{id:'x',name:'<script>bad</script>',start:'15:00',end:'16:00',kind:'event',place:'Lab "A"'}],{date:'2026-10-29',nowDate:new Date('2026-10-27T11:00')});
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 assert.match(html,/data-edit="event"/);assert.match(html,/data-id="x"/);
 assert.doesNotMatch(html,/native-now/);
});
test('overnight events are clamped and never lay out outside 24h',()=>{
 const a=layoutTimelineEvents([{id:'one',name:'Night',start:'23:30',end:'01:00',kind:'event'}]);
 assert.ok(a[0].top>=0 && a[0].top<100);assert.ok(a[0].height>0);
 assert.ok(a[0].top+a[0].height<=100);
});
