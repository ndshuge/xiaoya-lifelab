import test from 'node:test';
import assert from 'node:assert/strict';
import {demoData} from '../../core.js';
import {checkSchedule} from '../../domain.js';
import {createMemory,NO_CONSENT,COMPANION_CONSENT} from '../memory.mjs';
import {toolSpecs,runTool,runAgent,systemPrompt,memoryCommand,isPlanRequest,planDayLocal,planDay,planPrompt,extractFromText,makeDraft} from '../agent.mjs';

const NOW=new Date('2026-11-05T10:00:00'); // Thursday
function fakeStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>m}}
function ctxWith(consent){
 const memory=createMemory({local:fakeStorage(),getMode:()=>'demo',clock:()=>NOW});
 return {data:demoData(NOW),journal:[{date:'2026-11-04',mood:2,note:'实验报告写不完，有点焦虑'},{date:'2026-11-05',mood:4,note:'今天还行'}],consent,memory,facts:memory.facts.all(),profile:{name:'阿芽'},now:NOW};
}
/** A scripted OpenAI-compatible endpoint. Each reply is either {tool_calls:[...]} or {content}. Records requests. */
function scripted(replies){
 const requests=[];let i=0;
 const fetchImpl=async(url,init)=>{const body=JSON.parse(init.body);requests.push({url,body,headers:init.headers});const r=replies[Math.min(i++,replies.length-1)];
  if(r.status)return {ok:false,status:r.status,json:async()=>r.error||{}};
  return {ok:true,status:200,json:async()=>({choices:[{message:{role:'assistant',content:r.content??null,tool_calls:r.tool_calls}}]})}};
 return {fetchImpl,requests};
}
const call=(name,args,id='c'+Math.random())=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const MODEL={url:'https://api.example.test/v1/chat/completions',model:'mock-1',key:'sk-test'};

test('tool specs expose only consented read tools, always the draft tools',()=>{
 const none=toolSpecs(NO_CONSENT).map(t=>t.function.name);
 assert.deepEqual(none.sort(),['ask_user','draft_event','draft_goal','draft_task','remember']);
 const all=toolSpecs(COMPANION_CONSENT).map(t=>t.function.name);
 for(const n of ['get_schedule','get_free_time','get_tasks','get_goals','get_mood','get_journal','search_records'])assert.ok(all.includes(n),n);
});
test('read tools are blocked without consent and never leak content',()=>{
 const ctx=ctxWith({...NO_CONSENT});
 const r=runTool('get_journal',{days:7},ctx);
 assert.equal(r.trace.blocked,true);
 assert.ok(!r.content.includes('焦虑'),'journal text not returned');
 assert.match(r.content,/没有授权/);
 const s=runTool('get_schedule',{from:'2026-11-04'},ctx);assert.equal(s.trace.blocked,true);
});
test('read tools return grounded data with consent',()=>{
 const ctx=ctxWith({...NO_CONSENT,schedule:true,tasks:true,mood:true});
 const s=JSON.parse(runTool('get_schedule',{from:'2026-11-04',days:1},ctx).content);
 assert.ok(s.items.length>=2,'Wednesday has the lab and the club');
 const f=JSON.parse(runTool('get_free_time',{date:'2026-11-05'},ctx).content);
 assert.ok(f.windows.length>=1&&/^\d\d:\d\d$/.test(f.windows[0].from));
 const t=JSON.parse(runTool('get_tasks',{},ctx).content);assert.ok(t.tasks.some(x=>x.title==='工数习题第六章'));
 const m=JSON.parse(runTool('get_mood',{days:7},ctx).content);
 assert.deepEqual(m.days.map(x=>x.mood),[2,4]);assert.ok(!JSON.stringify(m).includes('焦虑'),'mood tool has scores only');
});
test('draft tools validate and never write; remember refuses credentials',()=>{
 const ctx=ctxWith({...NO_CONSENT});const before=JSON.stringify(ctx.data);
 const ok=runTool('draft_event',{title:'复习电路',date:'2026-11-05',start:'14:00',end:'15:30',reason:'截止前'},ctx);
 assert.equal(ok.draft.intent,'event');assert.equal(ok.draft.fields.day,3,'Monday-based weekday, same as the parser');
 assert.doesNotThrow(()=>checkSchedule({id:'x',...ok.draft.fields}),'draft passes the real schedule validator');
 const bad=runTool('draft_event',{title:'x',date:'2026-11-05',start:'15:00',end:'14:00'},ctx);assert.equal(bad.trace.blocked,true);
 assert.equal(JSON.stringify(ctx.data),before,'data untouched by drafts');
 const pw=runTool('remember',{fact:'我的校园网密码是 abc123'},ctx);assert.equal(pw.trace.blocked,true);assert.equal(ctx.memory.facts.all().length,0);
 const fact=runTool('remember',{fact:'早八前不想安排任何事'},ctx);assert.equal(ctx.memory.facts.all()[0].source,'xiaoya');assert.ok(fact.remembered);
});
test('system prompt states allowed and denied categories; facts only with memory consent',()=>{
 const off=systemPrompt({consent:{...NO_CONSENT,schedule:true},facts:[{text:'喜欢晚上学习'}],profile:{name:'阿芽'},now:NOW});
 assert.match(off,/允许你读取：课程与日程/);assert.match(off,/日记正文/);assert.ok(!off.includes('喜欢晚上学习'));assert.ok(!off.includes('阿芽'));
 const on=systemPrompt({consent:COMPANION_CONSENT,facts:[{text:'喜欢晚上学习'}],profile:{name:'阿芽'},now:NOW});
 assert.ok(on.includes('喜欢晚上学习')&&on.includes('阿芽'));
});
test('agent loop: model calls tools, gets results, drafts a plan, answers',async()=>{
 const ctx=ctxWith({...NO_CONSENT,schedule:true,tasks:true});
 const {fetchImpl,requests}=scripted([
  {tool_calls:[call('get_free_time',{date:'2026-11-05'},'a'),call('get_tasks',{},'b')]},
  {tool_calls:[call('draft_event',{title:'专注：工数习题第六章',date:'2026-11-05',start:'14:00',end:'14:45',reason:'明晚截止'},'c')]},
  {content:'我画了 1 笔铅笔：下午两点做工数习题，你看看合不合适。'}]);
 const r=await runAgent({question:'帮我排一下今天',model:MODEL,ctx,fetchImpl});
 assert.equal(r.mode,'tools');assert.equal(r.drafts.length,1);assert.match(r.text,/铅笔/);
 assert.deepEqual(r.trace.map(t=>t.name),['get_free_time','get_tasks','draft_event']);
 assert.equal(requests.length,3);
 const second=requests[1].body.messages;
 assert.ok(second.some(m=>m.role==='tool'&&m.tool_call_id==='a'&&m.content.includes('windows')),'tool result fed back');
 assert.ok(requests[0].body.tools.every(t=>!['get_mood','get_journal'].includes(t.function.name)),'unconsented tools not offered');
 assert.equal(requests[0].headers.Authorization,'Bearer sk-test');
});
test('agent: a model that tries an unconsented tool is told no, and the trace shows it',async()=>{
 const ctx=ctxWith({...NO_CONSENT});
 const {fetchImpl,requests}=scripted([{tool_calls:[call('get_journal',{days:3},'j')]},{content:'我看不到你的日记，可以在封底授权。'}]);
 const r=await runAgent({question:'我最近日记写了什么',model:MODEL,ctx,fetchImpl});
 assert.equal(r.trace[0].blocked,true);
 assert.ok(!JSON.stringify(requests).includes('焦虑'),'journal never sent');
});
test('agent: provider without tool support falls back to a consented snapshot',async()=>{
 const ctx=ctxWith({...NO_CONSENT,tasks:true});
 const {fetchImpl,requests}=scripted([{status:400,error:{error:{message:'tools is not supported'}}},{content:'你明晚要交工数习题。'}]);
 const r=await runAgent({question:'我最近要交什么',model:MODEL,ctx,fetchImpl});
 assert.equal(r.mode,'plain');assert.match(r.text,/工数/);
 const sys=requests[1].body.messages[0].content;assert.ok(sys.includes('工数习题第六章'));assert.ok(!('tools' in requests[1].body));
 assert.ok(!sys.includes('焦虑'));
});
test('agent: 401 surfaces as auth error',async()=>{
 const ctx=ctxWith({...NO_CONSENT});const {fetchImpl}=scripted([{status:401}]);
 await assert.rejects(runAgent({question:'hi',model:MODEL,ctx,fetchImpl}),e=>e.code==='auth');
});
test('local memory commands and plan intent',()=>{
 assert.deepEqual(memoryCommand('记住：我周三晚上有家教'),{op:'add',text:'我周三晚上有家教'});
 assert.deepEqual(memoryCommand('忘掉家教'),{op:'forget',text:'家教'});
 assert.deepEqual(memoryCommand('你记得我什么'),{op:'list'});
 assert.equal(memoryCommand('明天几点上课'),null);
 assert.ok(isPlanRequest('帮我排一下今天'));assert.ok(isPlanRequest('AI 排今天'));assert.ok(!isPlanRequest('今天有什么课'));
});
test('local day planner fits urgent work into real free windows without overlaps',()=>{
 const d=demoData(NOW);
 const drafts=planDayLocal(d,'2026-11-05',{now:NOW});
 assert.ok(drafts.length>=1&&drafts.length<=4);
 assert.match(drafts[0].fields.name,/工数习题第六章/,'most urgent first');
 const spans=drafts.map(x=>[x.fields.start,x.fields.end]).sort();
 for(let i=1;i<spans.length;i++)assert.ok(spans[i][0]>=spans[i-1][1],'no overlap');
 assert.ok(spans[0][0]>='10:00','never in the past');
 for(const x of drafts)assert.doesNotThrow(()=>checkSchedule({id:'x',...x.fields}));
});
test('day plan: intensities differ in load, reasons are given, other options are summarised',()=>{
 const d=demoData(NOW);
 const light=planDay(d,'2026-11-05',{now:NOW,intensity:'light'}),bal=planDay(d,'2026-11-05',{now:NOW}),sprint=planDay(d,'2026-11-05',{now:NOW,intensity:'sprint'});
 assert.ok(light.drafts.length<=2&&light.drafts.length>=1);
 assert.ok(bal.drafts.length>=light.drafts.length&&sprint.drafts.length>=bal.drafts.length);
 const mins=p=>p.drafts.reduce((n,x)=>n+x.minutes,0);
 assert.ok(mins(light)<=110&&mins(sprint)>=mins(bal));
 assert.deepEqual(bal.drafts.map(x=>x.n),bal.drafts.map((_,i)=>i+1),'numbered in time order');
 assert.ok(bal.drafts.every(x=>x.reason&&x.fields.name.startsWith('专注：')));
 assert.equal(bal.options.light.count,light.drafts.length);assert.equal(bal.options.sprint.count,sprint.drafts.length);
 assert.ok(bal.looked.length>=4&&/课表/.test(bal.looked[0]));
 assert.deepEqual(planDay(d,'2026-11-05',{now:NOW}).drafts.map(x=>x.id),bal.drafts.map(x=>x.id),'ids are stable across runs');
 for(const x of sprint.drafts)assert.doesNotThrow(()=>checkSchedule({id:'x',...x.fields}));
 const spans=sprint.drafts.map(x=>[x.fields.start,x.fields.end]);
 for(let i=1;i<spans.length;i++)assert.ok(spans[i][0]>=spans[i-1][1],'no overlap');
});
test('day plan: big work is split; a goal behind schedule gets one block; inked work is not planned twice',()=>{
 const d=demoData(NOW);
 d.tasks.push({id:'big',title:'课程设计报告',due:'2026-11-10T23:00',minutes:180,type:'assignment',done:false});
 const p=planDay(d,'2026-11-05',{now:NOW,intensity:'sprint'});
 const big=p.drafts.find(x=>x.task==='课程设计报告');
 assert.ok(big&&/第 1\/\d 步/.test(big.fields.name),'split into steps');
 assert.ok(p.drafts.some(x=>x.kind==='goal'),'goal block present');
 const first=p.drafts[0];
 d.events.push({id:'e1',...first.fields});
 const again=planDay(d,'2026-11-05',{now:NOW,intensity:'sprint'});
 assert.ok(!again.drafts.some(x=>x.task===first.task),'already inked work is skipped');
});
test('day plan: yesterday slipped → lighter day and the reason says so',()=>{
 const d=demoData(NOW);
 d.events.push({id:'y1',name:'专注：电路实验报告',date:'2026-11-04',day:2,start:'19:00',end:'20:00',weekStart:1,weekEnd:54,parity:'all',exceptions:[]});
 const p=planDay(d,'2026-11-05',{now:NOW,journal:[{date:'2026-11-04',mood:2}]});
 assert.equal(p.review.planned,1);assert.equal(p.review.done,0);assert.ok(p.review.slipped);
 assert.match(p.summary,/量减一点/);assert.match(p.looked[3],/计划 1 件，完成 0 件，心情 2\/5/);
});
test('ask_user tool yields a question card, not a guess',async()=>{
 const ctx=ctxWith({...NO_CONSENT,schedule:true});
 const {fetchImpl,requests}=scripted([{tool_calls:[call('ask_user',{question:'报告是纸质还是线上提交？',options:['纸质','线上','不知道']},'q')]},{content:'先按线上提交来排。'}]);
 const r=await runAgent({question:planPrompt('light'),model:MODEL,ctx,fetchImpl});
 assert.deepEqual(r.questions,[{question:'报告是纸质还是线上提交？',options:['纸质','线上','不知道']}]);
 assert.match(requests[0].body.messages.at(-1).content,/轻松/);
});
test('paste-to-extract finds deadlines and events in a notice, skips chatter',()=>{
 const notice='各位同学好！\n1. 周六下午三点前交电路实验报告\n2. 下周一上午9点到11点在东3-204 期中答疑\n3. 大家辛苦了\n记得带学生证';
 const out=extractFromText(notice,NOW);
 const kinds=out.map(x=>x.intent);
 assert.ok(kinds.includes('task')&&kinds.includes('event'),JSON.stringify(out.map(x=>x.fields)));
 assert.ok(!out.some(x=>/辛苦/.test(x.fields.title||x.fields.name||'')),'chatter dropped');
 assert.ok(out.find(x=>x.intent==='task'&&x.fields.due?.startsWith('2026-11-07T15:00')));
});
test('makeDraft rejects malformed input',()=>{
 assert.throws(()=>makeDraft('task',{title:''}));
 assert.throws(()=>makeDraft('task',{title:'x',due:'tomorrow'}));
 assert.equal(makeDraft('goal',{title:'跑步',weekly_target:9}).fields.weeklyTarget,7);
});
