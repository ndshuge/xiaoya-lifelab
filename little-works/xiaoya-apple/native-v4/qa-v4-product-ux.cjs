// Real-browser RED/GREEN tests driven by user's 2026-11-03 iPhone screen recording.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end('forbidden');
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end('missing'):res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'}).end(b))
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const base='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1';
 let ok=0,fail=0,errors=[];
 async function check(name,fn){try{await fn();ok++;console.log('PASS '+name)}catch(e){fail++;console.error('FAIL '+name+': '+String(e.message).slice(0,310))}}
 try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const page=await ctx.newPage();page.setDefaultTimeout(1800);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 await check('one clear top bar: avatar and settings, no global or Today add',async()=>{
  assert.equal(await page.locator('.topbar [data-action=add]').count(),0);
  assert.equal(await page.locator('.dayflow-heading [data-action=add-task]').count(),0);
  assert.equal(await page.locator('.topbar #xiaoya-avatar').count(),1);
 });
 await check('finished day has one calendar entry point, not a duplicate timeline',async()=>{
  const source=await page.evaluate(async()=>{
   const {renderDayflowToday}=await import('./dayflow-view.mjs');
   const data=window.__XY_NATIVE_V3.getData();
   const p=document.createElement('div');p.innerHTML=renderDayflowToday(data,new Date('2026-11-03T21:30:00'),{isDemo:true});
   return {compact:!!p.querySelector('#dayflow-next.dayflow-focus-complete'),
           oldRail:!!p.querySelector('#dayflow-next .dayflow-rail'),
           collapsed:p.querySelector('details.dayflow-past-details')?.open,
           exists:!!p.querySelector('details.dayflow-past-details'),
           summary:p.querySelector('details.dayflow-past-details summary')?.innerText,
           count:p.querySelectorAll('.dayflow-time-row').length};
  });
  assert.equal(source.exists,false);
  assert.equal(source.count,0);
  assert.equal(source.compact,true);
  assert.equal(source.oldRail,false);
  assert.equal(await page.locator('#dayflow-next [data-view=schedule]').count(),1);
 });
 await page.locator('.bottom-nav [data-view=items]').click();
 await check('empty deadline lane does not obscure real classes below the dock',async()=>{
  assert.equal(await page.locator('#items-date-deadlines .v4-list-empty').count(),0);
  const first=await page.locator('#items-schedule .native-event').first().boundingBox();
  const dock=await page.locator('#bottom-nav').boundingBox();
  assert.ok(first&&dock&&first.y<dock.y-10,'class '+first?.y+' dock '+dock?.y);
 });
 await check('items header has no global add, creation actions are contextual',async()=>{
  assert.equal(await page.locator('.v4-page-heading [data-add=task]').count(),0);
  assert.equal(await page.locator('#items-date-deadlines [data-add=task]').count(),1);
  await page.locator('.v4-item-segments [data-items-tab=inbox]').click();
  assert.equal(await page.locator('#items-undated [data-add=task]').count(),1);
 });
 await check('quick new reminder only exposes title/due, advanced properties are disclosure',async()=>{
  await page.locator('#items-undated [data-add=task]').click();
  assert.equal(await page.locator('#fld-title').isVisible(),true);
  assert.equal(await page.locator('#fld-due').isVisible(),true);
  assert.equal(await page.locator('#fld-type').isVisible(),false);
  assert.equal(await page.locator('#fld-minutes').isVisible(),false);
  const summary=page.locator('#task-advanced summary');
  assert.equal(await summary.isVisible(),true);
  await summary.click();
  assert.equal(await page.locator('#fld-type').isVisible(),true);
  await page.locator('#fld-title').fill('无日期快速待办');
  await page.locator('#sheet-save').click();
  assert.match(await page.locator('#items-undated').innerText(),/无日期快速待办/);
 });
 await check('date lane new reminder presets selected day as deadline; inbox does not',async()=>{
  await page.locator('[data-items-tab=schedule]').click();
  const button=page.locator('.v4-week-rail [data-day]').nth(3),day=await button.getAttribute('data-day');
  await button.click();
  await page.locator('#items-date-deadlines [data-add=task]').click();
  assert.equal((await page.locator('#fld-due').inputValue()).slice(0,10),day);
  assert.ok((await page.locator('#fld-due').inputValue()).endsWith('T23:59'));
  await page.locator('.sheet-cancel').click();
  await page.locator('.v4-item-segments [data-items-tab=inbox]').click();
  await page.locator('#items-undated [data-add=task]').click();
  assert.equal(await page.locator('#fld-due').inputValue(),'');
  await page.locator('.sheet-cancel').click();
 });
 await page.locator('.bottom-nav [data-view=develop]').click();
 await check('development has Records and Goals segments, not a long uninterrupted page',async()=>{
  assert.equal(await page.locator('[data-develop-tab=record]').count(),1);
  assert.equal(await page.locator('[data-develop-tab=goals]').count(),1);
  assert.equal(await page.locator('#development-journal').isVisible(),true);
  assert.equal(await page.locator('#development-goals').isVisible(),false);
  assert.equal(await page.locator('.v4-page-heading [data-add=goal]').count(),0);
 });
 await check('switching development sections does not erase unfinished diary draft',async()=>{
  await page.locator('#journal-note').fill('保存前的真实草稿不会丢');
  await page.locator('[data-develop-tab=goals]').click();
  assert.equal(await page.locator('#development-goals').isVisible(),true);
  assert.equal(await page.locator('#development-journal').isVisible(),false);
  await page.locator('[data-develop-tab=record]').click();
  assert.equal(await page.locator('#journal-note').inputValue(),'保存前的真实草稿不会丢');
 });
 await check('calendar shows actual course summary before long time grid',async()=>{
  await page.locator('.bottom-nav [data-view=items]').click();
  await page.locator('.v4-item-segments [data-items-tab=schedule]').click();
  await page.locator('.v4-week-rail [data-day="2026-11-03"]').click();
  const rows=page.locator('#items-schedule .v4-schedule-summary-row');
  assert.ok(await rows.count()>0,'demo fixture has a real scheduled class');
  assert.match(await rows.first().innerText(),/高等数学|08:00/);
  const summary=await rows.first().boundingBox(),timeline=await page.locator('#items-schedule .native-timeline-scroll').boundingBox();
  assert.ok(summary&&timeline&&summary.y<timeline.y);
  assert.ok(timeline.height<=360,'timeline is overly tall: '+timeline.height);
 });
 await check('an unsaved journal draft survives leaving and returning to Development',async()=>{
  await page.locator('.bottom-nav [data-view=today]').click();
  await page.locator('.bottom-nav [data-view=develop]').click();
  assert.equal(await page.locator('#journal-note').inputValue(),'保存前的真实草稿不会丢');
 });
 await check('no script exceptions or horizontal overflow',async()=>{
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 });
 await ctx.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('UX_PRODUCT_AUDIT '+ok+'/'+(ok+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
