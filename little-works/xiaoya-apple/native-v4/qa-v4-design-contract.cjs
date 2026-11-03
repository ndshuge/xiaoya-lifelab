const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),types={'.html':'text/html;charset=utf8','.css':'text/css;charset=utf8','.mjs':'text/javascript;charset=utf8','.js':'text/javascript;charset=utf8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://test').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}),ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 let good=0,fail=0;const page=await ctx.newPage();
 async function check(name,fn){try{await fn();good++;console.log('PASS '+name)}catch(e){fail++;console.log('FAIL '+name+' '+e.message)}}
 try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await page.locator('#bottom-nav [data-view=items]').click();await page.locator('#page-items').waitFor();
 await check('schedule renders each course once, with accessible editable timeline',async()=>{
  const duplicates=await page.locator('#items-schedule .v4-schedule-summary-row').count();
  assert.equal(duplicates,0,'duplicated course summary list still present');
  const classes=await page.locator('#items-schedule .native-event').count();
  assert.ok(classes>=1,'missing real timetable entries');
  assert.ok(await page.locator('#items-schedule .native-event').first().isVisible());
 });
 await check('schedule has no dead opening space before first actual class',async()=>{
   const first=await page.locator('#items-schedule .native-event').first().boundingBox(),bar=await page.locator('#bottom-nav').boundingBox();
   assert.ok(first?.y<bar.y-75,'first class y '+first?.y+' dock y '+bar.y);
 });
 await check('items tab name matches combined view of dated and undated tasks',async()=>{
  await page.locator('[data-items-tab=inbox]').click();await page.locator('[data-items-tab=inbox].is-active').waitFor();
  const label=await page.locator('.v4-item-segments [data-items-tab=inbox]').innerText();
  assert.match(label,/^待办(?:\s|\d)/,'unexpected tab name '+label);
  assert.equal(await page.locator('#items-undated').count(),1);
  assert.equal(await page.locator('.v4-inbox-group').count()>=2,true);
 });
 await check('tab navigation preserves scroll position for schedule and development independently',async()=>{
  await page.locator('[data-items-tab=schedule]').click();await page.locator('[data-items-tab=schedule].is-active').waitFor();
  await page.evaluate(()=>scrollTo(0,370));const before=await page.evaluate(()=>scrollY);
  assert.ok(before>=200,'fixture not scrolled '+before);
  await page.locator('#bottom-nav [data-view=develop]').click();await page.locator('#page-develop').waitFor();
  await page.locator('#bottom-nav [data-view=items]').click();await page.locator('#page-items').waitFor();await page.waitForTimeout(220);
  const after=await page.evaluate(()=>scrollY);
  assert.ok(Math.abs(after-before)<=16,'scroll was lost: before '+before+' after '+after);
 });
 await check('inbox segment and its scroll are restored after leaving via fixed Dock',async()=>{
  await page.locator('[data-items-tab=inbox]').click();await page.locator('[data-items-tab=inbox].is-active').waitFor();
  await page.evaluate(()=>scrollTo(0,240));const inboxY=await page.evaluate(()=>scrollY);
  assert.ok(inboxY>0,'inbox cannot scroll; invalid fixture');
  await page.locator('#bottom-nav [data-view=develop]').click();await page.locator('#page-develop').waitFor();
  await page.locator('#bottom-nav [data-view=items]').click();await page.locator('#page-items').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-items-tab=inbox].is-active').count(),1);
  const again=await page.evaluate(()=>scrollY);
  assert.ok(Math.abs(again-inboxY)<=30,'inbox Y lost '+inboxY+' -> '+again);
 });
 await check('assistant and settings reachable without duplicate navigation widgets',async()=>{
  assert.equal(await page.locator('.topbar [data-action=add]').count(),0);
  assert.equal(await page.locator('#bottom-nav [data-view]').count(),3);
  await page.locator('#xiaoya-avatar').click();assert.ok(await page.locator('#xiaoya-assistant').isVisible());
  await page.locator('#assistant-close').click();await page.waitForTimeout(340);
 });
 }finally{await ctx.close();await browser.close();await new Promise(r=>server.close(r))}
 console.log('DESIGN_CONTRACT '+good+'/'+(good+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
