// End-to-end QA for the Opus Original experiment.
// Real browser (Edge headless + optional WebKit), fixed clock, mocked model/weather endpoints (no paid calls).
// Usage: node qa-opus.cjs [--webkit] [--shots]
const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const ROOT=path.resolve(__dirname,'../../..');
const SHOTS=path.join(ROOT,'docs/qa/evidence/2026-11-05-opus-original');
const args=new Set(process.argv.slice(2));
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.png':'image/png'};
const NOW=new Date('2026-11-05T09:30:00+08:00');
function serve(){return new Promise(res=>{const s=http.createServer((req,rsp)=>{const u=decodeURIComponent(new URL(req.url,'http://x').pathname);let f=path.join(ROOT,u);if(!f.startsWith(ROOT)){rsp.writeHead(403);return rsp.end()}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,b)=>{if(e){rsp.writeHead(404);return rsp.end()}rsp.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});rsp.end(b)})});s.listen(0,'127.0.0.1',()=>res(s))})}
const results=[];let currentPage=null;
async function settle(page){if(!page)return;await page.evaluate(()=>{const s=document.querySelector('#sheet');if(s?.open)s.close();if(!document.querySelector('#talk').hidden)document.querySelector('.icon-x').click()}).catch(()=>{});await page.waitForTimeout(120)}
async function step(name,fn){await settle(currentPage);try{await fn();results.push(['PASS',name]);console.log('PASS',name)}catch(e){results.push(['FAIL',name,e.message]);console.log('FAIL',name,'\n   ',e.message.split('\n').slice(0,args.has('--verbose')?14:1).join('\n    '))}}
async function shot(page,name){if(!args.has('--shots'))return;fs.mkdirSync(SHOTS,{recursive:true});await page.waitForTimeout(450);await page.screenshot({path:path.join(SHOTS,name+'.png'),fullPage:false})}
async function newPage(browser,base,{mobile=false,judge=true}={}){
 const context=await browser.newContext(mobile?{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:browser.browserType().name()!=='firefox',hasTouch:true}:{viewport:{width:1280,height:860}});
 const page=await context.newPage();currentPage=page;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/fonts\.(googleapis|gstatic)/.test(m.text()))errors.push(m.text())});
 // Fonts are a progressive enhancement; keep QA offline and deterministic.
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await page.clock.setFixedTime(NOW);
 await page.goto(base+'/little-works/xiaoya-apple/opus-original/'+(judge?'?judge=1&intro=0&history=0&tips=0':'?intro=0&history=0&tips=0'));
 await page.waitForSelector('.day,.week,.line-scale');
 return {page,context,errors};
}
async function run(browserType,label){
 const server=await serve();const base='http://127.0.0.1:'+server.address().port;
 const browser=browserType===chromium?await chromium.launch({channel:'msedge',headless:true}):await webkit.launch({headless:true});
 try{
  const {page,errors,context}=await newPage(browser,base);
  const data=()=>page.evaluate(()=>window.__XY_OPUS.getData());
  await step(label+' day page renders demo ink, deadline lines and pencils',async()=>{
   await page.evaluate(()=>window.__XY_OPUS.setScale('day'));
   assert.equal(await page.locator('#day-title').innerText().then(t=>t.startsWith('今天')),true);
   assert.ok(await page.locator('.blk.pencil').count()>=1,'pencil block');
   assert.match(await page.locator('.voice').first().innerText(),/工数习题第六章/);
   await shot(page,label+'-desktop-day');
  });
  await step(label+' pencil → evidence → 落墨 writes through executePlan; 擦掉 restores',async()=>{
   const before=await data();
   await page.locator('[data-expand]').first().click();
   await page.locator('.note.is-open [data-approve]').waitFor();
   const proof=await page.locator('.note.is-open .note-proof').innerText();
   assert.match(proof,/依据/);assert.match(proof,/落墨后/);
   await shot(page,label+'-desktop-pencil-open');
   await page.locator('.note.is-open [data-approve]').click();
   await page.waitForFunction(n=>window.__XY_OPUS.getData().events.length>n,before.events.length);
   const after=await data();
   const added=after.events.find(e=>!before.events.some(b=>b.id===e.id));
   assert.equal(added.source,'Agent 已批准方案');
   assert.equal(after.decisions.length,before.decisions.length+1);
   const tx=after.transactions.at(-1);assert.equal(tx.status,'executed');
   assert.ok(await page.locator('.blk.ink .sprout-dot').count()>=1);
   await shot(page,label+'-desktop-inked');
   await page.evaluate(()=>window.__XY_OPUS.setScale('line'));
   await page.locator('[data-erase="'+tx.id+'"]').click();
   await page.waitForFunction(n=>window.__XY_OPUS.getData().events.length===n,before.events.length);
   assert.equal((await data()).transactions.at(-1).status,'undone');
   await page.evaluate(()=>window.__XY_OPUS.setScale('day'));
  });
  await step(label+' reject and snooze go through the agent respond() contract',async()=>{
   const first=await page.locator('[data-expand]').first().getAttribute('data-expand');
   await page.locator('[data-expand]').first().click();
   await page.locator('.note.is-open [data-reject]').click();
   const d=await data();assert.ok(d.decisions.some(x=>x.id===first&&x.status==='rejected'));
   const next=await page.locator('[data-expand]').first().getAttribute('data-expand');
   await page.locator('[data-expand="'+next+'"]').first().click();
   await page.locator('.note.is-open [data-snooze]').click();
   assert.ok((await data()).history.some(h=>h.action==='agent-snoozed'&&h.proposalId===next));
  });
  await step(label+' write a line: deadline task, event, goal, pocket item and question',async()=>{
   const line=page.locator('#line-input');
   await line.fill('周六下午三点前交电路实验报告 60分钟');
   assert.match(await page.locator('#draft').innerText(),/截止 11\/07 15:00/);
   await shot(page,label+'-desktop-draft');
   await line.press('Enter');
   await page.waitForFunction(()=>window.__XY_OPUS.getData().tasks.some(t=>t.title==='电路实验报告'&&t.due==='2026-11-07T15:00'&&t.minutes===60));
   await line.fill('明天下午3点到5点 机器人社团排练 @创新中心');await line.press('Enter');
   await page.waitForFunction(()=>window.__XY_OPUS.getData().events.some(e=>e.name.includes('机器人社团排练')&&e.date==='2026-11-06'&&e.start==='15:00'&&e.place==='创新中心'));
   assert.equal(await page.evaluate(()=>window.__XY_OPUS.ui.date),'2026-11-06','day page jumps to the new event');
   await page.locator('[data-day-today]').click();
   await line.fill('每周练两次吉他');await line.press('Enter');
   await page.waitForFunction(()=>window.__XY_OPUS.getData().goals.some(g=>g.title.includes('吉他')&&g.weeklyTarget===2));
   await line.fill('买洗衣液');await line.press('Enter');
   await page.locator('.slip-title',{hasText:'买洗衣液'}).waitFor();
   await line.fill('明天什么时候有空？');await line.press('Enter');
   await page.locator('#talk:not([hidden])').waitFor();
   await page.locator('.msg-xy .msg-text',{hasText:'较完整的空档'}).waitFor();
   await shot(page,label+'-desktop-talk-local');
   await line.fill('找 实验');await line.press('Enter');
   await page.locator('.msg-results button',{hasText:'电子技术实验'}).click();
   await page.locator('#sheet[open] #sheet-title',{hasText:'修改每周课程'}).waitFor();
   await page.evaluate(()=>document.querySelector('#sheet').close());
   await page.locator('.icon-x').click();
  });
  await step(label+' companion offline: 记住, 排今天 as pencil cards, paste a notice, chat persists across reload',async()=>{
   const line=page.locator('#line-input');
   await page.locator('#xiaoya').click();await page.locator('#talk:not([hidden])').waitFor();
   await line.fill('记住：我周三晚上有家教');await line.press('Enter');
   await page.locator('.msg-xy .msg-text',{hasText:'记住了'}).waitFor();
   assert.ok(await page.evaluate(()=>window.__XY_OPUS.memory.facts.all().some(f=>f.text==='我周三晚上有家教')));
   const before=await data();
   await page.locator('#talk-quick [data-ask^="帮我排"]').click();
   await page.locator('.draft-card').first().waitFor();
   const cards=await page.locator('.draft-card:not(.is-inked)').count();assert.ok(cards>=1);
   assert.equal((await data()).events.length,before.events.length,'cards write nothing');
   await shot(page,label+'-desktop-plan-today');
   if(cards>1){await page.locator('[data-draft-ink-all]').last().click()}else{await page.locator('[data-draft-ink]').last().click()}
   await page.locator('.draft-card.is-inked').first().waitFor();
   const after=await data();
   assert.equal(after.events.length,before.events.length+cards);
   assert.equal(after.transactions.length,before.transactions.length+1,'all cards are one erasable step');
   await page.locator('#whisper [data-whisper-action]').click();
   await page.waitForFunction(n=>window.__XY_OPUS.getData().events.length===n,before.events.length);
   await page.locator('.draft-card [data-draft-ink]',{hasText:'重新落墨'}).first().waitFor();
   assert.equal(await page.locator('.draft-card.is-inked').count(),0,'erased cards no longer claim to be written');
   // Paste a class notice into the line.
   await line.focus();
   await page.evaluate(()=>{const dt=new DataTransfer();dt.setData('text/plain','各位同学：\n1. 周六下午三点前交电路实验报告\n2. 下周一上午9点到11点在东3-204 期中答疑\n辛苦了');
    document.querySelector('#line-input').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});
   await page.locator('.msg-xy .msg-text',{hasText:'从你粘贴的文字里'}).waitFor();
   assert.equal(await line.inputValue(),'','the notice is not crammed into the line');
   assert.ok(await page.locator('.draft-card',{hasText:'期中答疑'}).count()>=1);
   await shot(page,label+'-desktop-paste-extract');
   // Reload: the conversation is still there, marked as earlier.
   await page.reload();await page.waitForSelector('.day');
   await page.locator('#xiaoya').click();
   await page.locator('.msg.is-past',{hasText:'我周三晚上有家教'}).first().waitFor();
   await page.locator('.talk-divider').waitFor();
   await page.locator('.icon-x').click();
  });
  await step(label+' today\'s plan: intensity, reasons, numbered blocks, drop a step, ink all as one erasable step',async()=>{
   await page.locator('[data-day-today]').click().catch(()=>{});
   const card=page.locator('#plan-card');await card.waitFor();
   const props=()=>page.locator('.plan-prop').count(),blocks=()=>page.locator('.blk.plan').count();
   assert.ok(await props()>=1);assert.equal(await blocks(),await props(),'every plan step is drawn on the timeline');
   assert.ok(await page.locator('.plan-prop .plan-why').first().innerText(),'each step says why');
   await page.locator('[data-plan-int="light"]').click();
   assert.equal(await page.locator('[data-plan-int="light"]').getAttribute('aria-checked'),'true');
   const nLight=await props();assert.ok(nLight>=1&&nLight<=2,'light plan is short');assert.equal(await blocks(),nLight);
   await page.locator('[data-plan-int="sprint"]').click();const nSprint=await props();assert.ok(nSprint>=nLight);
   await shot(page,label+'-desktop-plan-sprint');
   await page.locator('.plan-prop [data-plan-drop]').last().click();assert.equal(await props(),nSprint-1,'× removes a step');
   const before=await data(),n=await props();
   await page.locator('[data-plan-ink]').click();
   await page.waitForFunction(k=>window.__XY_OPUS.getData().events.length===k,before.events.length+n);
   const after=await data();assert.equal(after.transactions.length,before.transactions.length+1,'one erasable step');
   assert.ok(after.events.filter(e=>e.name.startsWith('专注：')).length>=n);
   // Inked work is not planned again; erasing brings the plan back.
   const inkedTasks=after.events.filter(e=>e.date==='2026-11-05'&&e.name.startsWith('专注：')).map(e=>e.name.slice(3).replace(/\s*·.*$/,''));
   const shown=await page.locator('.plan-prop .plan-what b').allInnerTexts();
   assert.ok(!shown.some(t=>inkedTasks.includes(t)),'already inked steps are not proposed again');
   await page.locator('#whisper [data-whisper-action]').click();
   await page.waitForFunction(k=>window.__XY_OPUS.getData().events.length===k,before.events.length);
   await page.locator('[data-plan-int="balanced"]').click();
  });
  await step(label+' gentle reminder: a deadline 30 minutes away is whispered once and recorded',async()=>{
   // Earlier steps can legitimately consume the 60-minute reminder gap; start from an empty reminder log.
   await page.evaluate(()=>window.__XY_OPUS.store.commit(x=>{x.reminders=[]},{track:false}));
   await page.locator('#line-input').fill('今天10点交报名表');await page.locator('#line-input').press('Enter');
   await page.waitForFunction(()=>window.__XY_OPUS.getData().tasks.some(t=>t.title.includes('报名表')&&t.due==='2026-11-05T10:00'));
   // The page's own 60 s timer may deliver first; either way exactly one record must exist for this deadline.
   const delivered=await page.evaluate(()=>window.__XY_OPUS.remind());
   if(delivered.length)await page.locator('#whisper.show',{hasText:'小芽轻声提醒'}).waitFor({timeout:3000});
   const task=(await data()).tasks.find(t=>t.title.includes('报名表'));
   const mine=(await data()).reminders.filter(r=>r.sourceId===task.id);
   assert.equal(mine.length,1,'deadline reminded exactly once');
   const n=(await data()).reminders.length;
   assert.deepEqual(await page.evaluate(()=>window.__XY_OPUS.remind()),[],'gap blocks an immediate repeat');
   assert.equal((await data()).reminders.length,n);
  });
  await step(label+' tapping empty time places an event (user-confirmed)',async()=>{
   const box=await page.locator('[data-ribbon]').boundingBox();
   await page.locator('[data-ribbon]').scrollIntoViewIfNeeded();
   const b2=await page.locator('[data-ribbon]').boundingBox();
   await page.mouse.click(b2.x+b2.width*.85,b2.y+14);
   await page.locator('#sheet[open]').waitFor();
   await page.locator('#sheet-body input[name=name]').fill('图书馆复习');
   await page.locator('#sheet-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().events.some(e=>e.name==='图书馆复习'&&e.date==='2026-11-05'));
  });
  await step(label+' course exceptions: cancel one Wednesday, restore it, reschedule it to Friday',async()=>{
   page.once('dialog',()=>{throw Error('native dialog must not appear')});
   await page.evaluate(()=>{window.__XY_OPUS.ui.date='2026-11-04';window.__XY_OPUS.render()});
   await page.locator('.blk.ink.course',{hasText:'电子技术实验'}).click();
   await page.locator('#sheet[open] .occ-choices').waitFor();
   assert.ok(await page.locator('#occ-replace').isHidden());
   await page.locator('.occ-choice',{hasText:'这一次停课'}).click();
   await shot(page,label+'-desktop-occurrence');
   await page.locator('#sheet-ok').click();
   await page.locator('.blk.ghost',{hasText:'本次停课'}).waitFor();
   assert.equal(await page.locator('.blk.ink',{hasText:'电子技术实验'}).count(),0);
   assert.equal(await page.locator('.blk.is-conflict').count(),0,'cancelling removes the club conflict');
   await shot(page,label+'-desktop-cancelled');
   await page.locator('.blk.ghost').click();
   await page.locator('.occ-choice',{hasText:'恢复原安排'}).click();
   await page.locator('#sheet-ok').click();
   await page.locator('.blk.ink.course',{hasText:'电子技术实验'}).waitFor();
   await page.locator('.blk.ink.course',{hasText:'电子技术实验'}).click();
   await page.locator('.occ-choice',{hasText:'这一次调课'}).click();
   assert.ok(await page.locator('#occ-replace').isVisible());
   await page.locator('#occ-replace input[name=targetDate]').fill('2026-11-06');
   await page.locator('#occ-replace input[name=start]').fill('14:00');
   await page.locator('#occ-replace input[name=end]').fill('15:40');
   await page.locator('#sheet-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.ui.date==='2026-11-06');
   await page.locator('.blk.ink.is-moved',{hasText:'调课自'}).waitFor();
   const lab=(await data()).courses.find(c=>c.id==='demo-c1');
   assert.deepEqual(lab.exceptions.map(e=>[e.date,e.type,e.targetDate,e.start]),[['2026-11-04','replace','2026-11-06','14:00']]);
   await shot(page,label+'-desktop-moved');
   await page.locator('[data-day-today]').click();
  });
  await step(label+' designed confirm: cancel keeps, confirm deletes, 擦掉 restores',async()=>{
   page.once('dialog',()=>{throw Error('native dialog must not appear')});
   await page.locator('.slip-title',{hasText:'买洗衣液'}).click();
   await page.locator('[data-delete="task"]').click();
   await page.locator('#confirm[open]').waitFor();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'confirm-cancel','destructive confirm focuses the safe choice');
   await shot(page,label+'-desktop-confirm');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#confirm').open);
   assert.ok((await data()).tasks.some(t=>t.title==='买洗衣液'),'Escape cancels');
   await page.locator('[data-delete="task"]').click();
   await page.locator('#confirm-ok').click();
   await page.waitForFunction(()=>!window.__XY_OPUS.getData().tasks.some(t=>t.title==='买洗衣液'));
   await page.locator('#whisper [data-whisper-action]').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().tasks.some(t=>t.title==='买洗衣液'));
  });
  await step(label+' journal footer: mood draft stays unsaved until 合上, persists across reload, private key',async()=>{
   await page.locator('.mood[data-mood="4"]').click();
   assert.equal(await page.locator('#journal-status').innerText(),'未保存');
   assert.equal(await page.evaluate(()=>localStorage.getItem('xiaoya-dayflow:journal:v1:demo')),null,'mood is not autosaved');
   await page.locator('#journal-note').fill('实验课的电路终于调通了。');
   await shot(page,label+'-desktop-footer');
   await page.locator('[data-journal-save]').click();
   const stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('xiaoya-dayflow:journal:v1:demo')));
   assert.equal(stored[0].mood,4);assert.equal(stored[0].date,'2026-11-05');
   await page.reload();await page.waitForSelector('.day,.week,.line-scale');
   await page.evaluate(()=>window.__XY_OPUS.setScale('day'));
   assert.equal(await page.locator('#journal-note').inputValue(),'实验课的电路终于调通了。');
   assert.equal(await page.locator('.mood[data-mood="4"]').getAttribute('aria-checked'),'true');
  });
  await step(label+' week and long line render real records',async()=>{
   await page.locator('#scale [data-scale="week"]').click();
   await page.locator('.week-grid').waitFor();
   assert.ok(await page.locator('.witem.is-conflict').count()>=2,'demo Wed conflict');
   await shot(page,label+'-desktop-week');
   await page.locator('#scale [data-scale="line"]').click();
   await page.locator('.lgrid').waitFor();
   await page.locator('button.lgrid-label',{hasText:'练习架子鼓一次'}).click();
   await page.locator('#sheet[open] #sheet-title',{hasText:'练习架子鼓一次'}).waitFor();
   await page.locator('#sheet-body textarea[name=note]').fill('练了 30 分钟基础节奏');
   await page.locator('#sheet-body input[name=minutes]').fill('30');
   const kept=await page.locator('#sheet-body textarea[name=note]').inputValue();
   assert.equal(kept,'练了 30 分钟基础节奏','sheet content must not be replaced while typing; value='+JSON.stringify(kept)+' textareas='+await page.locator('#sheet-body textarea').count()+' title='+await page.locator('#sheet-title').innerText()+' open='+await page.evaluate(()=>document.querySelector('#sheet').open)+' focus='+await page.evaluate(()=>document.activeElement?.name||document.activeElement?.id));
   await page.locator('#sheet-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().checkins.length===1,null,{timeout:5000}).catch(async e=>{throw Error('check-in not saved; whisper="'+await page.locator('#whisper').innerText()+'"')});
   assert.ok(await page.locator('.lgrid-cell.is-current .knot:not(.is-hollow):not(.is-pencil)').count()>=1,'knot drawn in current week');
   await page.locator('[data-analyze]').click();
   await page.locator('.plan-note').waitFor();
   await shot(page,label+'-desktop-line');
  });
  await step(label+' growth route: two pencil routes, ink one creates goal + 3 stage tasks',async()=>{
   page.once('dialog',()=>{throw Error('native dialog must not appear')});
   await page.locator('[data-routes]').click();
   await page.locator('#sheet-body input[name=goal]').fill('从零学 Python');
   await page.locator('#sheet-body input[name=baseline]').fill('零基础');
   await page.locator('[data-routes-generate]').click();
   await page.locator('.route').nth(1).waitFor();
   await shot(page,label+'-desktop-routes');
   const before=(await data()).tasks.length;
   await page.locator('[data-route-ink="project"]').click();
   await page.locator('#confirm[open]').waitFor();
   assert.match(await page.locator('#confirm-body').innerText(),/阶段 3/);
   await page.locator('#confirm-ok').click();
   await page.waitForFunction(n=>window.__XY_OPUS.getData().tasks.length===n+3,before);
   assert.ok((await data()).goals.some(g=>g.growthPlan?.routeId==='project'));
   const tx=(await data()).transactions.at(-1);assert.match(tx.title,/种下长线/);assert.equal(tx.changes.length,4,'route is one erasable transaction');
  });
  await step(label+' model connection + companion agent: consent per category, tool calls, trace, pencil drafts',async()=>{
   const bodies=[];
   // A scripted OpenAI-compatible model: it asks for the schedule when that tool is offered, then answers from the
   // tool result; it drafts a focus block when asked to plan. No network, no fees.
   await page.route('https://api.deepseek.com/chat/completions',async r=>{
    const body=JSON.parse(r.request().postData());bodies.push(body);
    const auth=r.request().headers()['authorization'];
    if(auth!=='Bearer test-key-ok')return r.fulfill({status:401,contentType:'application/json',body:'{}'});
    const msgs=body.messages,last=msgs.at(-1),tools=(body.tools||[]).map(t=>t.function.name);
    const reply=m=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:m}]})});
    if(last.content==='Say OK')return reply({content:'OK'});
    const planning=msgs.some(m=>m.role==='user'&&/今天剩下的时间排一下/.test(m.content));
    if(last.role==='tool'&&!(planning&&!msgs.some(m=>m.role==='tool'&&String(m.content).includes('draft_id')))){const prev=msgs.filter(m=>m.role==='tool').map(m=>m.content).join('');
     return reply({content:prev.includes('draft_id')?'我画了 1 笔铅笔，你看看合不合适。':prev.includes('items')?'收到。我看到了你的日程。':'看不到。'})}
    if(planning&&last.role==='user')return reply({content:null,tool_calls:[{id:'f1',type:'function',function:{name:'get_free_time',arguments:'{"date":"2026-11-05"}'}}]});
    if(planning&&last.role==='tool'&&!msgs.some(m=>m.role==='tool'&&String(m.content).includes('draft_id')))return reply({content:null,tool_calls:[
     {id:'k1',type:'function',function:{name:'ask_user',arguments:JSON.stringify({question:'电路报告是纸质还是线上提交？',options:['纸质','线上'] })}},
     {id:'k2',type:'function',function:{name:'draft_event',arguments:JSON.stringify({title:'专注：工数习题第六章',date:'2026-11-05',start:'10:00',end:'10:45',reason:'明晚截止，先清掉'})}},
     {id:'k3',type:'function',function:{name:'draft_event',arguments:JSON.stringify({title:'专注：电路实验报告 · 第 1/3 步',date:'2026-11-05',start:'15:00',end:'15:50',reason:'拆小更容易开始'})}}]});
    if(/帮我排/.test(last.content))return reply({content:null,tool_calls:[{id:'p1',type:'function',function:{name:'draft_event',arguments:JSON.stringify({title:'专注：工数习题第六章',date:'2026-11-05',start:'19:00',end:'19:45',reason:'明晚截止'})}}]});
    if(tools.includes('get_schedule'))return reply({content:null,tool_calls:[{id:'s1',type:'function',function:{name:'get_schedule',arguments:'{"from":"2026-11-05","days":1}'}}]});
    return reply({content:'我看不到你的日程，可以在「小芽能看到」里打开。'});
   });
   await page.locator('#xiaoya').click();
   await page.locator('.talk-connect').click();
   await page.locator('#sheet[open] #model-id').waitFor();
   await page.locator('#sheet-body input[name=key]').fill('wrong');
   await page.locator('#sheet-ok').click();
   assert.match(await page.locator('#model-feedback').innerText(),/勾选/);
   await page.locator('#sheet-body input[name=consent]').check();
   await page.locator('#sheet-body input[name=key]').fill('wrong');
   await page.locator('#sheet-ok').click();
   await page.locator('#model-feedback',{hasText:'401'}).waitFor();
   await page.locator('#sheet-body input[name=key]').fill('test-key-ok');
   await page.locator('#sheet-ok').click();
   await page.locator('#talk-status',{hasText:'已连接 DeepSeek'}).waitFor();
   assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/key|deepseek/i.test(localStorage.getItem(k)||'')&&(localStorage.getItem(k)||'').includes('test-key-ok'))),false,'key never stored');
   // Default: nothing readable. The model is offered only the harmless draft/remember tools.
   assert.equal(await page.locator('[data-consent="schedule"]').getAttribute('aria-pressed'),'false');
   await page.locator('#line-input').fill('今天有课吗？');await page.locator('#line-input').press('Enter');
   await page.locator('.msg-xy .msg-text',{hasText:'我看不到你的日程'}).waitFor();
   assert.ok(!bodies.at(-1).tools.some(t=>t.function.name==='get_schedule'),'schedule tool not offered without consent');
   // Allow 课程与日程 → the model calls get_schedule; the answer shows what she looked at.
   await page.locator('[data-consent="schedule"]').click();
   assert.equal(await page.locator('[data-consent="schedule"]').getAttribute('aria-pressed'),'true');
   await page.locator('#line-input').fill('那现在呢？');await page.locator('#line-input').press('Enter');
   await page.locator('.msg-xy .msg-text',{hasText:'我看到了你的日程'}).waitFor();
   await page.locator('.msg-xy .trace summary',{hasText:'这次查看了：日程'}).last().waitFor();
   await shot(page,label+'-desktop-agent-trace');
   // Planning → a pencil draft card; 落墨 writes it as one erasable step.
   const before=(await data()).events.length;
   await page.locator('#line-input').fill('帮我排一下今晚');await page.locator('#line-input').press('Enter');
   await page.locator('.draft-card',{hasText:'专注：工数习题第六章'}).waitFor();
   assert.equal((await data()).events.length,before,'a draft writes nothing');
   await shot(page,label+'-desktop-agent-draft');
   await page.locator('.draft-card [data-draft-ink]').last().click();
   await page.locator('.draft-card.is-inked').waitFor();
   assert.equal((await data()).events.length,before+1);
   await page.locator('#whisper [data-whisper-action]').click();
   await page.waitForFunction(n=>window.__XY_OPUS.getData().events.length===n,before);
   // Journal is a separate, confirmed consent; cancelling leaves it off.
   await page.locator('[data-consent="journal"]').click();
   await page.locator('#confirm[open]',{hasText:'日记正文'}).waitFor();await page.locator('#confirm-cancel').click();
   assert.equal(await page.locator('[data-consent="journal"]').getAttribute('aria-pressed'),'false');
   const sent=JSON.stringify(bodies);
   assert.doesNotMatch(sent,/实验课的电路终于调通了/,'journal text never leaves');
   assert.doesNotMatch(sent,/test-key-ok/,'key only in the Authorization header');
   // The conversation persists on this device.
   assert.ok(await page.evaluate(()=>window.__XY_OPUS.memory.chat.all().some(m=>m.text.includes('我看到了你的日程'))));
   // The plan card can ask the connected model for a version; questions arrive as chips, answers are remembered.
   await page.locator('.icon-x').click();
   await page.evaluate(()=>{const x=window.__XY_OPUS;x.ui.date=new Date().toISOString().slice(0,10);x.setScale('day')});
   await page.locator('[data-plan-model]').click();
   await page.locator('#plan-card .plan-head small',{hasText:'DeepSeek 想的一版'}).waitFor();
   assert.equal(await page.locator('.plan-prop').count(),2);assert.equal(await page.locator('.blk.plan').count(),2);
   assert.ok(await page.locator('#plan-card .plan-looked li').count()>=1,'what the model looked at is listed');
   await shot(page,label+'-desktop-plan-model');
   await page.locator('[data-plan-answer="线上"]').click();
   assert.ok(await page.evaluate(()=>window.__XY_OPUS.memory.facts.all().some(f=>f.text.includes('线上'))),'answer remembered');
   assert.equal(await page.locator('.plan-ask').count(),0,'answered question disappears');
   await page.locator('[data-plan-local]').click();await page.locator('#plan-card .plan-head small',{hasText:'铅笔稿'}).waitFor();
   await page.locator('#xiaoya').click();
   await page.evaluate(()=>window.__XY_OPUS.memory.consent.revoke());
   await page.route('https://api.deepseek.com/chat/completions',r=>r.abort('failed'));
   await page.locator('#line-input').fill('再说一次？');await page.locator('#line-input').press('Enter');
   await page.locator('.msg.is-error').waitFor();
   await page.locator('.icon-x').click();
  });
  await step(label+' weather consent: no request before consent, Open-Meteo mocked after',async()=>{
   let calls=0;
   await page.route(/api\.open-meteo\.com/,r=>{calls++;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({daily:{time:['2026-11-05','2026-11-06','2026-11-07','2026-11-08'],precipitation_probability_max:[10,80,30,0],temperature_2m_min:[6,7,5,4],temperature_2m_max:[15,13,14,16]}})})});
   await page.locator('.cover-btn').click();
   await page.locator('[data-cover="weather"]').click();
   assert.equal(calls,0,'no network without consent');
   await page.locator('#sheet-body select[name=city]').selectOption('xian');
   await page.locator('#sheet-body input[name=weather]').check();
   await page.locator('[data-cover="weather"]').click();
   await page.waitForFunction(()=>document.querySelector('#sheet-body')?.innerText.includes('已获取'));
   assert.equal(calls,1);
   await page.locator('#sheet-ok').click();
   await page.evaluate(()=>window.__XY_OPUS.setScale('day'));
   await page.locator('.weather',{hasText:'西安'}).waitFor();
  });
  await step(label+' demo/personal archives stay isolated; export carries journal',async()=>{
   await page.locator('.cover-btn').click();
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-cover="export"]').click()]);
   const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
   assert.equal(exported.archiveMode,'demo');assert.ok(exported.journalV1.length>=1);assert.equal(exported.schema,1);
   await page.locator('[data-cover="mode"]').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getMode()==='personal');
   const p=await data();assert.equal(p.tasks.length,0);assert.equal(p.courses.length,0);
   assert.match(await page.locator('.voice').first().innerText(),/空的/);
   await page.locator('[data-try="每周跑步两次"]').click();
   assert.match(await page.locator('#draft').innerText(),/目标/);
   await shot(page,label+'-desktop-personal-empty');
   await page.locator('#line-input').press('Escape');
  });
  await step(label+' no page errors on desktop (except deliberately mocked network failures)',async()=>{assert.deepEqual(errors.filter(e=>!/Failed to load resource|ERR_FAILED|401/.test(e)),[])});
  await context.close();

  // ---------- mobile ----------
  const m=await newPage(browser,base,{mobile:true});
  await step(label+' mobile: layout fits 390px, no horizontal page scroll, 44px targets',async()=>{
   await m.page.evaluate(()=>window.__XY_OPUS.setScale('day'));
   const w=await m.page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(w<=390,'scrollWidth '+w);
   const small=await m.page.evaluate(()=>[...document.querySelectorAll('.scale button,.cover-btn,.line-send,.xiaoya,.ink-btn,.nav-arrow')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<40).map(b=>b.className));
   assert.deepEqual(small,[]);
   await shot(m.page,label+'-mobile-day');
   await m.page.locator('[data-expand]').first().tap();
   await m.page.locator('.note.is-open [data-approve]').waitFor();
   await shot(m.page,label+'-mobile-pencil-open');
  });
  await step(label+' mobile: week, long line, talk sheet and edit sheet',async()=>{
   await m.page.locator('#scale [data-scale="week"]').tap();await m.page.locator('.week-grid').waitFor();
   assert.ok(await m.page.evaluate(()=>document.documentElement.scrollWidth<=390));
   await shot(m.page,label+'-mobile-week');
   await m.page.locator('#scale [data-scale="line"]').tap();await m.page.locator('.lgrid').waitFor();
   assert.ok(await m.page.evaluate(()=>document.documentElement.scrollWidth<=390),'long line scrolls inside its own container');
   await shot(m.page,label+'-mobile-line');
   await m.page.locator('#xiaoya').tap();await m.page.locator('#talk:not([hidden])').waitFor();
   await m.page.locator('[data-ask="今天先做什么"]').tap();await m.page.locator('.msg-xy').nth(1).waitFor();
   await shot(m.page,label+'-mobile-talk');
   await m.page.locator('.icon-x').tap();
   await m.page.locator('#scale [data-scale="day"]').tap();
   await m.page.locator('.cover-btn').tap();await m.page.locator('#sheet[open]').waitFor();
   await shot(m.page,label+'-mobile-cover');
  });
  await step(label+' no page errors on mobile',async()=>{assert.deepEqual(m.errors,[])});
  await m.context.close();
  // ---------- dark mode + reduced motion ----------
  const dk=await newPage(browser,base,{mobile:true});
  await step(label+' dark mode and reduced motion render without animation',async()=>{
   await dk.page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
   await dk.page.evaluate(()=>window.__XY_OPUS.setScale('day'));
   const bg=await dk.page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
   assert.equal(bg,'rgb(21, 23, 27)');
   await dk.page.locator('[data-expand]').first().tap();
   const anim=await dk.page.evaluate(()=>getComputedStyle(document.querySelector('.note-proof')).animationName);
   assert.equal(anim,'none');
   await shot(dk.page,label+'-mobile-dark-pencil');
  });
  await dk.context.close();
 }finally{await browser.close();server.close()}
}
(async()=>{
 if(!args.has('--only-webkit'))await run(chromium,'edge');
 if(args.has('--webkit')||args.has('--only-webkit'))await run(webkit,'webkit');
 const fail=results.filter(r=>r[0]==='FAIL');
 console.log('\n'+(results.length-fail.length)+'/'+results.length+' PASS');
 process.exitCode=fail.length?1:0;
})();
