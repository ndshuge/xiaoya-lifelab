// Browser-level functional/security QA: isolated contexts only; never touches real user data.
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const ext={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const srv=http.createServer((req,res)=>{const p=decodeURI(new URL(req.url,'http://local').pathname);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':ext[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}).end(b)})});
(async()=>{
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+srv.address().port+'/little-works/xiaoya-apple/native-v3/';
 let pass=0,fail=0;
 const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS '+name)}catch(e){fail++;console.log('FAIL '+name+' '+e.message)}};
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 await check('create a real course with a valid date and time',async()=>{
  await page.locator('[data-view=schedule]:visible').first().click();
  await page.locator('.glass-btn.add-top:visible').click();assert.equal(await page.locator('#sheet-title').textContent(),'新增活动');
  await page.locator('input[name=name]').fill('电子实验 A');
  await page.locator('input[name=date]').fill(new Date().toLocaleDateString('en-CA'));
  await page.locator('input[name=start]').fill('09:00');
  await page.locator('input[name=end]').fill('10:30');
  await page.locator('#sheet-save').click();
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().events.length),1);
  await page.locator('[data-view=schedule]:visible').first().click();
  assert.equal(await page.locator('.native-event.event').count(),1);
 });
 await check('overlapping courses get two independent lanes',async()=>{
  await page.locator('[data-add=course]:visible').first().click();
  await page.locator('input[name=name]').fill('电路课程');
  await page.locator('input[name=date]').fill(new Date().toLocaleDateString('en-CA'));
  await page.locator('input[name=start]').fill('09:30');
  await page.locator('input[name=end]').fill('11:00');
  await page.locator('#sheet-save').click();
  const arr=await page.locator('.native-event').evaluateAll(els=>els.map(e=>({l:e.style.getPropertyValue('--lane'),n:e.style.getPropertyValue('--lanes'),title:e.textContent})));
  assert.equal(arr.length,2);assert.deepEqual(new Set(arr.map(x=>x.n)),new Set(['2']));assert.deepEqual(new Set(arr.map(x=>x.l)),new Set(['0','1']));
 });
 await check('tap calendar event edits actual saved event',async()=>{
  await page.locator('.native-event.event').click();
  assert.equal(await page.locator('input[name=name]').inputValue(),'电子实验 A');
  await page.locator('input[name=name]').fill('实验室 B');await page.locator('#sheet-save').click();
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().events.find(e=>e.name==='实验室 B')!==undefined),true);
 });
 await check('calendar export generates actual ICS data for a future event',async()=>{
  // Past events earlier today are intentionally excluded by the future-only exporter.
  // This isolated browser test seeds tomorrow to stay independent of the time of day.
  await page.evaluate(()=>{
   const t=new Date();t.setDate(t.getDate()+1);
   const date=[t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-');
   window.__XY_NATIVE_V3.store.commit(d=>d.events.push({id:'qa-ics-future',name:'ICS future test',date,day:(t.getDay()+6)%7,start:'12:00',end:'13:00',place:'QA room',weekStart:1,weekEnd:54,parity:'all',exceptions:[]}));
  });
  const pending=page.waitForEvent('download',{timeout:10000});
  await page.locator('[data-action=export-ics]').click();
  const dl=await pending;assert.match(dl.suggestedFilename(),/\.ics$/);
  const ics=fs.readFileSync(await dl.path(),'utf8');assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/BEGIN:VEVENT/);assert.match(ics,/ICS future test/);
 });
 await check('task JSON export is a full valid backup',async()=>{
  const pending=page.waitForEvent('download',{timeout:10000});await page.locator('[data-view=settings]:visible').first().click();await page.locator('[data-action=export-json]').click();
  const dl=await pending,data=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  assert.equal(data.events.length,2);assert.equal(data.courses.length,1);assert.ok(Array.isArray(data.transactions));
 });
 await check('JSON import correctly refuses invalid schema',async()=>{
  const before=await page.evaluate(()=>localStorage.getItem('xiaoya-comparison:xiaoya-apple:personal:v1'));
  await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schema":-999}')});
  const after=await page.evaluate(()=>localStorage.getItem('xiaoya-comparison:xiaoya-apple:personal:v1'));
  assert.equal(after,before);
 });
 await check('CSV course import uses existing domain parser and saves validated records',async()=>{
  await page.locator('[data-view=schedule]:visible').first().click();
  page.once('dialog',d=>d.accept());
  await page.locator('#calendar-file').setInputFiles({name:'courses.csv',mimeType:'text/csv',buffer:Buffer.from('name,day,start,end,place\n数字逻辑实验,5,15:00,16:40,主楼 201','utf8')});
  await page.waitForFunction(()=>window.__XY_NATIVE_V3.getData().courses.length===2,{timeout:9000});
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().courses.length),2);
 });
 await check('valid JSON round-trip reimports without changing record counts',async()=>{
  const backup=await page.evaluate(()=>JSON.stringify(window.__XY_NATIVE_V3.getData()));
  page.once('dialog',d=>d.accept());
  await page.locator('#import-file').setInputFiles({name:'good.json',mimeType:'application/json',buffer:Buffer.from(backup,'utf8')});
  await page.waitForTimeout(140);
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().courses.length),2);
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().events.length),2);
 });
 await check('settings use original optical switch component, not a CSS-only duplicate',async()=>{
  await page.locator('[data-view=settings]:visible').first().click();
  assert.equal(await page.locator('lg-switch[data-setting]').count(),4);
  assert.equal(await page.locator('lg-switch[data-setting] input[type=checkbox]').count(),4);
  assert.equal(await page.evaluate(()=>Boolean(customElements.get('lg-switch'))),true);
  await page.waitForFunction(()=>[...document.querySelectorAll('lg-switch')].every(x=>x.glass),{timeout:5000});
 });
 await check('settings toggle persists across reload',async()=>{
  const cb=page.locator('lg-switch[data-setting=quiet] input[type=checkbox]');
  await cb.check();assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().settings.quiet),true);
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-view=settings]:visible').first().click();
  assert.equal(await page.locator('lg-switch[data-setting=quiet] input[type=checkbox]').isChecked(),true);
 });
 await check('two tabs synchronize without dropping personal data',async()=>{
  const p2=await context.newPage();await p2.goto(url,{waitUntil:'networkidle'});
  await page.locator('[data-view=tasks]:visible').first().click();await page.locator('.glass-btn.add-top:visible').click();
  await page.locator('input[name=title]').fill('多标签同步任务');await page.locator('#sheet-save').click();
  await p2.waitForFunction(()=>window.__XY_NATIVE_V3.getData().tasks.some(t=>t.title==='多标签同步任务'),{timeout:8000});
  assert.equal((await p2.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks)).length,1);await p2.close();
 });
 await check('search discovers stored task with actual input',async()=>{
  await page.locator('[data-action=search]:visible').first().click();
  await page.locator('#search-input').fill('多标签同步');assert.match(await page.locator('#workspace').innerText(),/多标签同步任务/);
 });
 await check('undo a completed transaction restores previous data',async()=>{
  await page.locator('[data-view=review]:visible').first().click();
  const oldCount=await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks.length);
  await page.locator('[data-undo]').first().click();
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks.length),oldCount-1);
 });
 await check('native dialog can close with Escape and body scroll unlocks',async()=>{
  await page.locator('.glass-btn.add-top:visible').click();assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#editor').evaluate(e=>e.open),false);
  await page.waitForFunction(()=>document.body.style.overflow==='',{timeout:2500});
 });
 await check('clear personal data requires two confirmations and leaves demo isolated',async()=>{
  await page.locator('[data-view=settings]:visible').first().click();
  page.on('dialog',d=>d.accept());await page.locator('[data-action=clear]').click();
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks.length),0);
  await page.locator('[data-view=settings]:visible').first().click();await page.locator('[data-action=mode]').click();
  assert.ok((await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks)).length>0);
 });
 await check('AI suggestion only writes after explicit user authorization',async()=>{
  const trigger=page.locator('[data-suggest]').first();
  assert.equal(await trigger.count(),1,'expected a real suggestion in synthetic demo');
  const before=await page.evaluate(()=>JSON.stringify(window.__XY_NATIVE_V3.getData()));
  await trigger.click();
  assert.equal(await page.locator('#editor').evaluate(el=>el.open),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__XY_NATIVE_V3.getData())),before,'preview must not mutate stored data');
  await page.locator('#sheet-save').click();
  assert.equal(await page.locator('#editor').evaluate(el=>el.open),false);
  assert.ok(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().decisions.some(x=>x.status==='executed')),'approval recorded');
 });
 await check('no uncaught browser JavaScript errors',async()=>assert.deepEqual(errors,[]));
 await context.close();
 const corrupted=await browser.newContext({viewport:{width:390,height:844}});
 await corrupted.addInitScript(()=>localStorage.setItem('xiaoya-comparison:xiaoya-apple:personal:v1','{broken'));
 const errorPage=await corrupted.newPage();await errorPage.goto(url,{waitUntil:'networkidle'});
 await check('malformed original archive is not automatically overwritten',async()=>{
  assert.match(await errorPage.locator('#workspace').innerText(),/保护|读取|档案/);
  assert.equal(await errorPage.evaluate(()=>localStorage.getItem('xiaoya-comparison:xiaoya-apple:personal:v1')),'{broken');
 });
 await corrupted.close();
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve));}
 console.log('DEEP_RESULT '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
