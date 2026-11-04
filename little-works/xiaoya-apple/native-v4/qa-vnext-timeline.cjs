// VNext P0 interaction regression: run against real DOM in Chromium and WebKit.
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let pass=0,fail=0;
 const check=async(label,fn)=>{try{await fn();pass++;console.log('PASS',label)}catch(e){fail++;console.error('FAIL',label,String(e.message||e).slice(0,700))}};
 try{
  for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
   const browser=await engine.launch(name==='Edge'?{channel:'msedge',headless:true}:{headless:true});
   const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
   const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
   await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());await page.waitForTimeout(120);
   // The demo timetable has fixed weekdays; 'today' can legitimately be empty.
   const scheduledDate=await page.locator('[data-day]').evaluateAll(xs=>xs.find(x=>new Date(x.dataset.day+'T12:00:00').getDay()===3)?.dataset.day);
   assert.ok(scheduledDate,'the current demo week should include Wednesday');
   await page.locator('[data-day="'+scheduledDate+'"]').evaluate(e=>e.click());
   const rail=page.locator('.xy-timeline-scrub');
   const scroller=page.locator('.native-timeline-scroll');
   await check(name+' visible functional timeline thumb',async()=>{
    assert.equal(await rail.count(),1);
    assert.equal(await rail.getAttribute('role'),'scrollbar');
    const handle=page.locator('.xy-timeline-thumb');assert.equal(await handle.count(),1);
    const rr=await rail.boundingBox(),hr=await handle.boundingBox();
    assert.ok(rr&&hr&&rr.width>=16&&rr.height>200&&hr.height>=36,JSON.stringify({rr,hr}));
    assert.ok(await scroller.evaluate(e=>e.scrollHeight>e.clientHeight+200));
    assert.equal(await rail.getAttribute('aria-controls'),await scroller.getAttribute('id'));
   });
   await check(name+' rail follows drag and content position',async()=>{
    const r=await rail.boundingBox();
    await page.mouse.move(r.x+r.width/2,r.y+40);await page.mouse.down();
    await page.mouse.move(r.x+r.width/2,r.y+r.height*.82,{steps:8});await page.mouse.up();
    const x=await scroller.evaluate(e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight}));
    assert.ok(x.top>x.max*.60,JSON.stringify(x));
    const now=Number(await rail.getAttribute('aria-valuenow'));assert.ok(Math.abs(now-x.top)<=2,JSON.stringify({now,x}));
    assert.match(await rail.getAttribute('aria-valuetext'),/\d{4}-\d\d-\d\d.*\d\d:\d\d/);
   });
   await check(name+' keyboard boundaries and incremental movement',async()=>{
    await rail.focus();await page.keyboard.press('End');
    let a=await scroller.evaluate(e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight}));
    assert.ok(Math.abs(a.top-a.max)<=2,JSON.stringify(a));
    await page.keyboard.press('Home');a=await scroller.evaluate(e=>e.scrollTop);assert.ok(a<=2,a);
    await page.keyboard.press('ArrowDown');a=await scroller.evaluate(e=>e.scrollTop);assert.ok(a>=45&&a<=75,a);
   });
   await check(name+' native wheel scroll updates thumb and selected day label',async()=>{
    await scroller.evaluate(e=>{e.scrollTop=320;e.dispatchEvent(new Event('scroll'))});
    await page.waitForTimeout(70);
    assert.ok(Math.abs(Number(await rail.getAttribute('aria-valuenow'))-320)<=2);
    const originalDate=await page.locator('[data-day].is-selected').getAttribute('data-day');
    await page.locator('[data-day]').last().evaluate(e=>e.click());
    const date=await page.locator('[data-day].is-selected').getAttribute('data-day');
    assert.notEqual(date,originalDate);
    assert.equal(await rail.count(),0,'empty days should retain the established clear empty state');
    assert.equal(await page.locator('.v4-no-schedule').count(),1);
    await page.locator('[data-day="'+originalDate+'"]').evaluate(e=>e.click());
    assert.equal(await rail.count(),1,'timeline must return on a scheduled day');
    assert.ok((await rail.getAttribute('aria-valuetext')).includes(originalDate),originalDate);
   });
   await check(name+' quiet control has no abrupt scaling while pressed',async()=>{
    const button=page.locator('.v4-section-title [data-add=task]').first();
    assert.equal(await button.getAttribute('data-press-role'),'quiet');
    await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(110);
    const m=await button.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform));
    assert.ok(Math.abs(m.a-1)<.006&&Math.abs(m.d-1)<.006,JSON.stringify({a:m.a,d:m.d}));
    await page.mouse.up();
   });
   await check(name+' no runtime errors',async()=>assert.deepEqual(errors,[]));
   await ctx.close();await browser.close();
  }
 }finally{await new Promise(r=>server.close(r))}
 console.log('VNEXT_TIMELINE '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
