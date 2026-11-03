const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const types={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}).end(b))});
async function size(page,selector){return page.locator(selector).first().evaluate(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
 async function check(n,fn){try{await fn();results.push({n,pass:true});console.log('PASS',n)}catch(e){results.push({n,pass:false});console.log('FAIL',n,String(e.message||e).slice(0,460))}}
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  const labels=['YOUR DAY','TO DO','DEADLINES','TIMELINE','JOURNAL','LOOK BACK','REFLECTION','GROWTH','ANYTIME','UPCOMING','TODAY ·'];
  for(const view of ['today','items','develop']){
   await page.locator('.bottom-nav [data-view='+view+']').click();
   await check('no decorative English labels on '+view,async()=>{const t=await page.locator('#workspace').innerText();for(const x of labels)assert.ok(!t.includes(x),'unexpected '+x)});
  }
  await check('empty journal avoids decorative zero-over-thirty counter',async()=>{
   await page.locator('.bottom-nav [data-view=develop]').click();
   assert.equal((await page.locator('#workspace').innerText()).includes('0 天 / 30 天'),false);
  });
  await page.locator('.bottom-nav [data-view=today]').click();
  await check('today primary and secondary actions have 44px touch height',async()=>{const focus=await page.locator('.dayflow-focus-complete').count()?'.dayflow-complete-row button':'.dayflow-focus-bottom button';for(const sel of ['.topbar .glass-btn[data-view=settings]',focus,'.dayflow-advice-actions button','.dayflow-section-head button','.dayflow-task-main>button','.dayflow-task-row .circle-check']){const [w,h]=await size(page,sel);assert.ok(w>=40&&h>=44,sel+' '+w+'x'+h)}});
  await page.locator('.bottom-nav [data-view=items]').click();
  await check('items has 44px action targets and visible week controls',async()=>{for(const sel of ['.v4-item-segments button','.v4-week-tools button','.v4-section-title button','.v4-calendar-actions button','.v4-calendar-import button']){const [w,h]=await size(page,sel);assert.ok(w>=44&&h>=44,sel+' '+w+'x'+h)}});
  await check('calendar auto scrolls to nearest actual appointment',async()=>{
    const sc=page.locator('.native-timeline-scroll');
    await page.waitForTimeout(200);
    assert.equal(await sc.count(),1);
    const pos=await sc.evaluate(e=>e.scrollTop);
    assert.ok(pos>=350&&pos<=700,'scrollTop='+pos);
    const ev=page.locator('.native-event').first();
    const r=await ev.boundingBox(),p=await sc.boundingBox();
    assert.ok(r&&p&&r.y+r.height>p.y&&r.y<p.y+p.height,'class '+JSON.stringify(r)+' scroller '+JSON.stringify(p)+' pos '+pos);
  });
  await page.locator('.bottom-nav [data-view=develop]').click();
  await check('development journal action stays at 44px',async()=>{const [w,h]=await size(page,'#journal-save');assert.ok(w>=44&&h>=44)});
  await page.locator('[data-develop-tab=goals]').click();
  await check('development goal actions stay at 44px',async()=>{for(const sel of ['.v4-goals-section .v4-section-title button','.v4-goal-checkin','.v4-goal-name']){const [w,h]=await size(page,sel);assert.ok(w>=44&&h>=44,sel+' '+w+'x'+h)}});
  await page.locator('.topbar [data-view=settings]').click();
  await check('settings input controls have 44px hit boxes and no obsolete pet toggle',async()=>{assert.equal(await page.locator('[data-setting=hidePet]').count(),0);
    for(const sel of ['.settings-row .small-action']){const all=page.locator(sel);for(let i=0;i<await all.count();i++){const [w,h]=await all.nth(i).evaluate(e=>{let r=e.getBoundingClientRect();return [r.width,r.height]});assert.ok(w>=44&&h>=44,sel+' #'+i+' '+w+'x'+h)}}
  });
  await check('320px calendar week days retain at least 44px tappable width',async()=>{
    const narrow=await browser.newContext({viewport:{width:320,height:720},hasTouch:true});
    const p=await narrow.newPage();
    try{
     await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
     await p.locator('.bottom-nav [data-view=items]').click();
     for(const button of await p.locator('.v4-week-rail .day-pill').all()){
      const r=await button.boundingBox();assert.ok(r.width>=44,'day pill '+r.width);
     }
     assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    }finally{await narrow.close()}
  });
  await check('bottom Dock never covers the last growth planner action',async()=>{
   await page.locator('.bottom-nav [data-view=develop]').click();
   await page.locator('[data-develop-tab=goals]').click();
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForTimeout(150);
   const a=await page.locator('#v4-growth-planner summary').boundingBox();
   const b=await page.locator('.bottom-nav').boundingBox();
   assert.ok(a&&b&&a.y+a.height < b.y,'action '+JSON.stringify(a)+' dock '+JSON.stringify(b));
  });
  await check('repeated taps on active tab do not shift header or create scroll jumps',async()=>{
   await page.locator('.bottom-nav [data-view=today]').click();
   const start=await page.locator('.topbar').boundingBox();
   await page.locator('.bottom-nav [data-view=today]').click();
   await page.locator('.bottom-nav [data-view=today]').click();
   const end=await page.locator('.topbar').boundingBox();
   assert.equal(Math.round(start.y),Math.round(end.y));
  });
  await check('no uncaught JavaScript exceptions, no layout overflow',async()=>{assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)});
  await context.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 const failed=results.filter(r=>!r.pass);console.log('APPLE_POLISH_AUDIT',results.length-failed.length+'/'+results.length);if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
