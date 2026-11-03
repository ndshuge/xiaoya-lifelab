// Browser-level RED/GREEN checks for DAYFLOW homepage, source isolation and touch navigation.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let url=new URL(req.url,'http://local'),p=decodeURIComponent(url.pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 else if(p==='/xiaoya-lifelab')p='/';
 const file=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end('denied');
 fs.readFile(file,(err,data)=>err?res.writeHead(404).end('missing '+p):res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/';
 const browser=await chromium.launch({channel:'msedge',headless:true});
 let ok=0,no=0;
 async function check(name,fn){try{await fn();ok++;console.log('PASS',name)}catch(e){no++;console.error('FAIL',name,e.message.slice(0,320))}}
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const page=await ctx.newPage(),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()===404)missing.push(r.url())});
  await page.goto(url+'?judge=1',{waitUntil:'networkidle'});
  await check('the original submitted judge URL lands on V4 demo mode',async()=>{
   assert.match(page.url(),/native-v4\/\?judge=1/);
   assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'demo');
  });
  await check('first viewport prioritizes real schedule and assistant suggestion',async()=>{
   assert.equal(await page.locator('#dayflow-next').isVisible(),true);
   assert.equal(await page.locator('#dayflow-suggestion').isVisible(),true);
   const p=await page.locator('#dayflow-suggestion').boundingBox();
   assert.ok(p.y<844,'suggestion should appear without leaving first viewport, y='+p.y);
   assert.match(await page.locator('#dayflow-next').innerText(),/日程|安排|课程/);
   assert.equal(await page.locator('#dayflow-next [data-view=schedule]').count(),1);
  });
  await check('only saved course or activity occurrences appear on the actual current day',async()=>{
   const expected=await page.evaluate(async()=>{const {occurrences,dateKey,plusDays}=await import('../domain.js');const day=new Date(dateKey(new Date())+'T00:00:00');return occurrences(window.__XY_NATIVE_V3.getData(),day,plusDays(day,1)).length});
   const compact=await page.locator('#dayflow-next.dayflow-focus-complete').count();
   const visible=await page.locator('#dayflow-today-schedule .dayflow-time-content').count();
   if(compact)assert.equal(visible,0,'completed/empty day should not duplicate timeline');
   else assert.equal(visible,expected,'no synthetic calendar event may appear');
   if(!expected)assert.ok((await page.locator('#dayflow-next').innerText()).trim().length>0);
   assert.match(await page.locator('#dayflow-next').innerText(),/下一项|今天|接下来|正在进行/);
   assert.ok(await page.locator('#dayflow-suggestion [data-suggest]').count()===1 || await page.locator('#dayflow-suggestion [data-action]').count()>=1);
  });
  await check('mobile navigation has three clear main areas',async()=>{
   const nav=page.locator('.bottom-nav .tab');
   assert.equal(await nav.count(),3);
   assert.deepEqual((await nav.allTextContents()).map(x=>x.trim()),['今天','事项','发展']);
  });
  await check('items page contains dated schedule and independent inbox',async()=>{
   await page.locator('.bottom-nav [data-view=items]').click();
   assert.match(await page.locator('#workspace h1').innerText(),/事项/);
   await page.locator('[data-items-tab=inbox]').click();
   assert.equal(await page.locator('#items-undated').count(),1);
   await page.locator('[data-items-tab=schedule]').click();
   assert.equal(await page.locator('#items-schedule').count(),1);
  });
  await check('development goals precede the optional roadmap generator',async()=>{
   await page.locator('.bottom-nav [data-view=develop]').click();
   await page.locator('[data-develop-tab=goals]').click();
   const a=await page.locator('#development-goals .v4-section-title').first().boundingBox();
   const b=await page.locator('#v4-growth-planner').boundingBox();
   assert.ok(a&&b&&a.y<b.y);
  });
  await check('assistant opens and local reply uses genuine demo data, no key',async()=>{
   await page.locator('#xiaoya-avatar').click();
   assert.equal(await page.locator('#xiaoya-assistant').isVisible(),true);
   await page.locator('#assistant-input').fill('今天先做什么');
   await page.locator('#assistant-send').click();
   await page.locator('.assistant-message.bot').last().waitFor();
   assert.match(await page.locator('.assistant-message.bot').last().innerText(),/工数习题|未完成|待办/);
   await page.locator('#assistant-close').click();
  });
  await check('assistant closes with visible exit motion, restores focus, and supports rapid reopen',async()=>{
   const trigger=page.locator('#xiaoya-avatar'),assistant=page.locator('#xiaoya-assistant');
   await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden,null,{timeout:1800});
   await trigger.click();
   await page.locator('#assistant-close').click();
   assert.equal(await assistant.isVisible(),true,'exit motion should keep panel visible briefly');
   await page.waitForTimeout(500);
   await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden,null,{timeout:1800});
   assert.equal(await assistant.isVisible(),false);
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'xiaoya-avatar');
   await trigger.click();await page.locator('#assistant-close').click();await trigger.click();
   await page.waitForTimeout(510);
   assert.equal(await assistant.isVisible(),true,'rapid reversal must not hide a reopened assistant');
   await page.locator('#assistant-close').click();
   await page.waitForTimeout(500);
  });
  await check('mobile no page errors, missing assets, or horizontal overflow',async()=>{
   assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
  if(process.env.XIAOYA_V4_SHOTS){fs.mkdirSync(process.env.XIAOYA_V4_SHOTS,{recursive:true});
   await page.locator('.bottom-nav [data-view=today]').click();
   await page.waitForTimeout(480);await page.screenshot({path:path.join(process.env.XIAOYA_V4_SHOTS,'v4-today-390.png'),fullPage:true,animations:'disabled'});
   await page.locator('.bottom-nav [data-view=develop]').click();
   await page.waitForTimeout(480);await page.screenshot({path:path.join(process.env.XIAOYA_V4_SHOTS,'v4-growth-390.png'),fullPage:true,animations:'disabled'});
  }
  await ctx.close();
  const wide=await browser.newContext({viewport:{width:1440,height:900}}),desktop=await wide.newPage();
  await desktop.goto(url+'?judge=1',{waitUntil:'networkidle'});
  await check('desktop groups schedule and suggestion within an easy-to-scan layout',async()=>{
   const n=await desktop.locator('#dayflow-next').boundingBox(),s=await desktop.locator('#dayflow-suggestion').boundingBox();
   assert.ok(n&&s&&Math.abs(n.y-s.y)<180,'schedule/advice desktop not near same row');
   assert.equal(await desktop.locator('.companion').count(),0);
  });
  if(process.env.XIAOYA_V4_SHOTS)await desktop.screenshot({path:path.join(process.env.XIAOYA_V4_SHOTS,'v4-today-1440.png'),fullPage:true,animations:'disabled'});
  await wide.close();
  const reduced=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}}),rp=await reduced.newPage();
  await rp.goto(url+'?judge=1',{waitUntil:'networkidle'});
  await check('motion-reduced mode never requires animated navigation',async()=>{
   assert.equal(await rp.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
   await rp.locator('.bottom-nav [data-view=develop]').click();
   assert.match(await rp.locator('#workspace h1').innerText(),/发展/);
  });
  await reduced.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('DAYFLOW_V4_BROWSER',ok+'/'+(ok+no));if(no)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
