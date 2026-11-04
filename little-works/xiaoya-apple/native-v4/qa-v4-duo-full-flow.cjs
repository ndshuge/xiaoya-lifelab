const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'};
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));let pass=0,failed=0;async function check(n,fn){try{await fn();pass++;console.log('PASS',n)}catch(e){failed++;console.log('FAIL',n,String(e.message||e).slice(0,550))}}
try{for(const [engine,driver] of [['Edge',chromium],['WebKit',webkit]]){
const b=await driver.launch(engine==='Edge'?{channel:'msedge',headless:true}:{headless:true});
const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true});const p=await c.newPage(),err=[];p.on('pageerror',e=>err.push(e.message));
await p.goto('http://127.0.0.1:'+srv.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
await check(engine+' every interactive button gets an intentional press role on main destinations',async()=>{
 for(const view of ['today','items','develop','settings']){
  if(view==='settings')await p.locator('.topbar .toolbar-actions .glass-btn').click();else await p.locator('.bottom-nav [data-view='+view+']').click();
  const missing=await p.evaluate(()=>[...document.querySelectorAll('button')].filter(el=>el.getClientRects().length&&!el.disabled&&!el.getAttribute('data-press-role')).map(el=>({txt:el.innerText.slice(0,40),cls:el.className,action:el.dataset.action||''})));
  assert.deepEqual(missing,[],view+' roles: '+JSON.stringify(missing).slice(0,800));
 }
});
await check(engine+' items schedule one primary add opens a type chooser with three options',async()=>{
 await p.locator('.topbar .toolbar-actions .glass-btn').click();
 await p.locator('.bottom-nav [data-view=items]').click();
 const add=p.locator('[data-action=open-add-menu]');
 assert.equal(await add.count(),1,'schedule primary add missing');
 await add.click();
 assert.equal(await p.locator('#editor').evaluate(e=>e.open),true);
 assert.equal(await p.locator('#editor [data-quick-create]').count(),3);
 await p.locator('#editor [data-quick-create=event]').click();
 assert.equal(await p.locator('#sheet-title').innerText(),'新增活动');
});
await check(engine+' new single event and recurring course inherit selected calendar date',async()=>{
 await p.locator('#editor .sheet-cancel').click();
 await p.locator('.v4-week-rail .day-pill').nth(5).click();
 const selected=await p.locator('.v4-week-rail .day-pill.is-selected').getAttribute('data-day');
 await p.locator('[data-action=open-add-menu]').click();
 await p.locator('#editor [data-quick-create=event]').click();
 assert.equal(await p.locator('#fld-date').inputValue(),selected,'event should use selected date');
 await p.locator('#editor .sheet-cancel').click();
 await p.locator('[data-action=open-add-menu]').click();
 await p.locator('#editor [data-quick-create=course]').click();
 const w=(new Date(selected+'T12:00').getDay()+6)%7;
 assert.equal(await p.locator('#fld-day').inputValue(),String(w),'course weekday should follow selected date');
 await p.locator('#editor .sheet-cancel').click();
});
await check(engine+' inbox creates task with a single top action, no duplicated header add',async()=>{
 await p.locator('.v4-item-segments [data-items-tab=inbox]').click();
 assert.equal(await p.locator('[data-action=open-add-menu]').count(),0);
 assert.equal(await p.locator('[data-action=add-task]').count(),1);
 await p.locator('[data-action=add-task]').click();
 assert.equal(await p.locator('#sheet-title').innerText(),'新增提醒');
 await p.locator('#sheet-body input[name=title]').fill('整理第一章笔记');
 await p.locator('#sheet-save').click();
 assert.equal(await p.locator('#editor').evaluate(e=>e.open),false);
 assert.ok(await p.getByText('整理第一章笔记').count()>0);
});
await check(engine+' task completion is immediate and gives specific confirmation',async()=>{
 const row=p.locator('.v4-task-row', {hasText:'整理第一章笔记'});
 assert.equal(await row.count(),1);
 await row.locator('[data-toggle=task]').click();
 assert.equal(await p.locator('.v4-task-row', {hasText:'整理第一章笔记'}).count(),0);
 assert.match(await p.locator('#toast').innerText(),/已完成/);
});
await check(engine+' grouped controls avoid a 3D press and standalone actions remain tactile',async()=>{
 await p.locator('.bottom-nav [data-view=develop]').click();
 await p.locator('[data-develop-tab=goals]').click();
 const group=await p.locator('[data-develop-tab=goals]').getAttribute('data-press-role');
 assert.equal(group,'group');
 const primary=p.locator('[data-add=goal]');
 assert.equal(await primary.getAttribute('data-press-role'),'quiet');
 await primary.click();
 assert.equal(await p.locator('#sheet-save').getAttribute('data-press-role'),'solo');
 await p.locator('#editor .sheet-cancel').click();
});
await check(engine+' journal stays draft until saved with explicit status',async()=>{
 await p.locator('[data-develop-tab=record]').click();
 await p.locator('[data-mood="4"]').click();
 assert.equal(await p.locator('#journal-status').innerText(),'未保存');
 assert.equal(await p.locator('[data-mood="4"]').getAttribute('aria-pressed'),'true');
});
await check(engine+' assistant controls have consistent tactile roles and close safely',async()=>{
 await p.locator('#xiaoya-avatar').click();
 await p.locator('#assistant-input').waitFor({state:'visible'});
 const missing=await p.locator('#xiaoya-assistant button:visible').evaluateAll(els=>els.filter(e=>!e.dataset.pressRole).map(e=>e.id||e.textContent.trim()));
 assert.deepEqual(missing,[]);
 assert.equal(await p.locator('#assistant-send').getAttribute('data-press-role'),'solo');
 await p.locator('#assistant-close').click();
});
await check(engine+' no JS errors',async()=>assert.deepEqual(err,[]));
await c.close();await b.close();
}}finally{await new Promise(r=>srv.close(r))}
console.log('DUO_ALL_FLOW '+pass+'/'+(pass+failed));if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});