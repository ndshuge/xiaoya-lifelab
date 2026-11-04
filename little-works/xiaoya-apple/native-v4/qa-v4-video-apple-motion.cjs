const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let pass=0,fail=0;
async function check(n,fn){try{await fn();pass++;console.log('PASS '+n)}catch(e){fail++;console.log('FAIL '+n+' '+String(e.message||e).slice(0,550))}}
try{for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(name==='Edge'?{channel:'msedge',headless:true}:{headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await check(name+' press feedback on date/week buttons before click',async()=>{
   await page.locator('.bottom-nav [data-view=items]').click();
   const el=page.locator('.v4-week-tools .calendar-arrow button').first();
   await el.scrollIntoViewIfNeeded();
   await el.hover();const box=await el.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
   await page.mouse.down();
   await page.waitForTimeout(90);
   const press=await el.evaluate(e=>getComputedStyle(e,'::after').opacity);
   const wasActive=await el.evaluate(e=>e.matches(':active'));
   await page.mouse.up();
   const status=await el.evaluate(e=>({active:e.matches(':active'),content:getComputedStyle(e,'::after').content,loaded:[...document.styleSheets].some(s=>s.href?.includes('apple-motion-feedback'))}));
   assert.equal(press,'1','no pointer-down feedback '+press+' '+JSON.stringify({wasActive,status}));
 });
 await check(name+' segmented selection has one moving underlay',async()=>{
   const seg=page.locator('.bottom-nav [data-view=items]');await seg.click();
   const group=page.locator('#workspace .v4-item-segments');
   assert.ok((await group.evaluate(e=>getComputedStyle(e,'::before').content))!=='none');
   const first=await group.evaluate(e=>getComputedStyle(e,'::before').transform);
   await page.locator('[data-items-tab=inbox]').click();
   const second=await group.evaluate(e=>getComputedStyle(e,'::before').transform);
   await page.waitForTimeout(360);
   const end=await group.evaluate(e=>getComputedStyle(e,'::before').transform);
   assert.notEqual(first,end,'selector did not travel');
   assert.notEqual(second,end,'indicator jumped instantly to end');
 });
 await check(name+' page motion is directional and uninterrupted',async()=>{
   await page.locator('.bottom-nav [data-view=today]').click();
   await page.waitForTimeout(260);
   const oldRect=await page.locator('#workspace').evaluate(e=>e.getBoundingClientRect().x);
   await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
   const early=await page.evaluate(()=>{const g=document.querySelector('.xy-route-ghost');
     return {route:document.body.dataset.view,direction:document.documentElement.dataset.xyNavDirection,ghost:!!g,dist:g?g.getAnimations().map(a=>a.effect?.getKeyframes().at(-1)?.transform):[],dur:g?g.getAnimations().map(a=>a.effect?.getTiming().duration):[]};});
   assert.equal(early.route,'items');assert.equal(early.direction,'forward');
   assert.equal(early.ghost,true);
   assert.ok(early.dist.some(v=>/1[4-9]px|2[0-9]px/.test(v||'')),JSON.stringify(early.dist));
   assert.ok(early.dur.some(v=>v>=150),JSON.stringify(early.dur));
   assert.ok(Math.abs((await page.locator('#workspace').evaluate(e=>e.getBoundingClientRect().x))-oldRect)<1);
   await page.locator('.bottom-nav [data-view=develop]').evaluate(e=>e.click());
   await page.locator('.bottom-nav [data-view=today]').evaluate(e=>e.click());
   await page.waitForTimeout(320);
   assert.equal(await page.locator('body').getAttribute('data-view'),'today');
   assert.equal(await page.locator('.xy-route-ghost').count(),0);
 });
 await check(name+' reduced-motion keeps navigation and skips travel',async()=>{
   await page.waitForTimeout(330);
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.locator('.bottom-nav [data-view=items]').click();
   assert.equal(await page.locator('body').getAttribute('data-view'),'items');
   assert.equal(await page.locator('.xy-route-ghost').count(),0);
 });
 await check(name+' no JavaScript error',async()=>assert.deepEqual(errors,[]));
 await ctx.close();await browser.close();
}}finally{await new Promise(r=>server.close(r))}
console.log('VIDEO_MOTION '+pass+'/'+(pass+fail));if(fail)process.exitCode=1
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
