// Functional regression: mature deterministic planner is restored in Native V3.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const p=decodeURIComponent(new URL(req.url,'http://local').pathname),f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(err,b)=>err?res.writeHead(404).end('missing'):res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}).end(b));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});let pass=0,fail=0;
 const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS',name)}catch(e){fail++;console.log('FAIL',name,e.message)}};
 try{
  const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await c.newPage(),errors=[];
  page.setDefaultTimeout(3000);
  page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port+'/little-works/xiaoya-apple/native-v3/';
  await page.goto(url+'?judge=1',{waitUntil:'networkidle'});
  await page.locator('[data-view=goals]:visible').first().click();
  await check('mature planner visible in Native V3 without legacy navigation',async()=>{
   assert.equal(await page.locator('#growth-goal').isVisible(),true);
   assert.equal(await page.locator('#growth-hours').isVisible(),true);
   assert.equal(await page.locator('#growth-weeks').isVisible(),true);
  });
  const before=await page.evaluate(()=>({goals:window.__XY_NATIVE_V3.getData().goals.length,tasks:window.__XY_NATIVE_V3.getData().tasks.length}));
  await check('generate two real domain-specific local routes without modifying data',async()=>{
   await page.locator('#growth-goal').fill('学习 Python');
   await page.locator('#growth-baseline').fill('零基础');
   await page.locator('#growth-hours').fill('4');
   await page.locator('#growth-weeks').fill('8');
   await page.locator('#growth-generate').click();
   assert.equal(await page.locator('[data-growth-route]').count(),2);
   assert.match(await page.locator('#growth-preview').innerText(),/稳步积累|项目驱动/);
   assert.match(await page.locator('#growth-preview').innerText(),/调试|练习|编程/);
   assert.deepEqual(await page.evaluate(()=>({goals:window.__XY_NATIVE_V3.getData().goals.length,tasks:window.__XY_NATIVE_V3.getData().tasks.length})),before);
  });
  await check('approval preview cannot silently write to archive',async()=>{
   await page.locator('[data-growth-route=project]').click();
   assert.match(await page.locator('#sheet-title').innerText(),/成长路线/);
   assert.deepEqual(await page.evaluate(()=>({goals:window.__XY_NATIVE_V3.getData().goals.length,tasks:window.__XY_NATIVE_V3.getData().tasks.length})),before);
   await page.locator('#sheet-save').click();
   const record=await page.evaluate(()=>{
    const d=window.__XY_NATIVE_V3.getData();return {goals:d.goals.length,tasks:d.tasks.length,last:d.goals.at(-1),linked:d.tasks.filter(t=>t.goalId===d.goals.at(-1).id)};
   });
   assert.equal(record.goals,before.goals+1);
   assert.equal(record.tasks,before.tasks+3);
   assert.equal(record.last.growthPlan.routeId,'project');
   assert.equal(record.linked.length,3);
  });
  await check('new growth plan survives reload and can track real progress',async()=>{
   await page.reload({waitUntil:'networkidle'});
   await page.locator('[data-view=goals]:visible').first().click();
   assert.match(await page.locator('#growth-active').innerText(),/学习 Python/);
   assert.match(await page.locator('#growth-active').innerText(),/项目驱动/);
  });
  await check('switching demo to personal never imports synthetic plans',async()=>{
   await page.locator('[data-view=settings]:visible').first().click();
   await page.locator('[data-action=mode]').click();
   await page.locator('[data-view=goals]:visible').first().click();
   const data=await page.evaluate(()=>window.__XY_NATIVE_V3.getData());
   assert.equal(data.goals.some(g=>g.title==='学习 Python'),false);
   assert.equal(await page.locator('#growth-active').innerText(),'');
  });
  await check('no runtime errors or mobile horizontal overflow',async()=>{
   assert.equal(errors.length,0,errors.join('; '));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
  await c.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('GROWTH_RESULT',pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
