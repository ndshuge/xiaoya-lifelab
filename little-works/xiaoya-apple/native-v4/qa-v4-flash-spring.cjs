const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404,{'content-type':'text/plain'}).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
const scaleOf=s=>{const x=(s||'').match(/matrix\(([^)]+)\)/);return x?Number(x[1].split(',')[0]):s==='none'?1:NaN};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let passed=0,failed=0;
async function check(name,fn){try{await fn();passed++;console.log('PASS',name)}catch(e){failed++;console.log('FAIL',name,String(e.message||e).slice(0,650))}}
try{
for(const [label,engine] of [['Edge',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(label==='Edge'?{channel:'msedge',headless:true}:{headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await check(label+' navigation has no whole workspace opacity flash',async()=>{
  const old=await page.locator('#workspace').evaluate(e=>e.getBoundingClientRect().x);
  await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
  const data=await page.evaluate(()=>{const el=document.querySelector('#workspace');return {effects:el.getAnimations().map(a=>a.effect.getKeyframes()),opacity:getComputedStyle(el).opacity}});
  assert.ok(data.effects.every(frames=>frames.every(f=>f.opacity==null||Number(f.opacity)>=.99)),JSON.stringify(data.effects));
  assert.ok(Number(data.opacity)>=.99,data.opacity);
  assert.ok(Math.abs((await page.locator('#workspace').evaluate(e=>e.getBoundingClientRect().x))-old)<1);
  await page.waitForTimeout(350);
 });
 await check(label+' dock navigation gives brief feedback but no long overshoot',async()=>{
   const el=page.locator('.bottom-nav [data-view=develop]'),icon=el.locator('svg');
   const box=await el.boundingBox();await el.hover();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(90);
   assert.equal(await el.evaluate(e=>e.classList.contains('xy-is-pressed')),true);
   const hold=scaleOf(await icon.evaluate(e=>getComputedStyle(e).transform));
   assert.ok(hold>=.96&&hold<1,'subtle grouped/navigation tap scale '+hold);
   await page.mouse.up();await page.waitForTimeout(270);
   const end=scaleOf(await icon.evaluate(e=>getComputedStyle(e).transform));
   assert.ok(Math.abs(end-1)<.007,'lateral nav should settle without bounce '+end);
   const actual=await el.boundingBox();
   assert.ok(Math.abs(actual.x-box.x)<.5&&Math.abs(actual.width-box.width)<.5,'hitbox changed');
 });
 await check(label+' pressing date control keeps 44px hitbox and elastic visible content',async()=>{
  await page.locator('.bottom-nav [data-view=items]').click();
  const el=page.locator('.v4-week-tools .calendar-arrow button').first();
  await el.scrollIntoViewIfNeeded();await el.hover();const box=await el.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(150);
  const icon=el.locator('svg');
  const s=scaleOf(await icon.evaluate(e=>getComputedStyle(e).transform));
  assert.ok(s>=.98,'calendar navigation must not get a 3D squash '+s);
  await page.mouse.up();
  const newBox=await el.boundingBox();
  assert.ok(Math.abs(box.width-newBox.width)<.6,'button changed hit width');
 });
 await check(label+' re-rendered grouped selectors have no 520ms solo spring',async()=>{
   await page.locator('#workspace [data-items-tab=inbox]').click();
   const segment=page.locator('#workspace [data-items-tab=inbox] .xy-elastic-face');
   assert.equal(await segment.count(),1);
   const durations=await segment.evaluate(e=>e.getAnimations().map(a=>a.effect?.getTiming()?.duration));
   assert.ok(durations.every(d=>d<400),'grouped tab inherited long bounce: '+durations);
   await page.locator('#workspace [data-items-tab=schedule]').click();
   const button=page.locator('.v4-week-rail .day-pill').first();
   await button.click();
   const dayDuration=await page.locator('.v4-week-rail .day-pill').first().evaluate(e=>e.getAnimations({subtree:true}).map(a=>a.effect?.getTiming()?.duration));
   assert.ok(dayDuration.every(d=>d<400),'calendar date inherited long bounce: '+dayDuration);
 });
await check(label+' in-app Reduced Motion switch also disables spring',async()=>{
  await page.evaluate(()=>document.body.classList.add('reduce-motion'));
  const el=page.locator('.bottom-nav [data-view=develop] svg');
  const duration=await el.evaluate(e=>getComputedStyle(e).transitionDuration);
  assert.ok(duration.split(',').every(s=>parseFloat(s)<=.05),'app Reduced Motion still animates '+duration);
  await page.evaluate(()=>document.body.classList.remove('reduce-motion'));
});
await check(label+' reduced motion disables press bounce and route flash',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(550);
  const el=page.locator('.bottom-nav [data-view=develop]');const box=await el.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(100);await page.mouse.up();
  const svg=el.locator('svg');
  const style=await svg.evaluate(e=>({transform:getComputedStyle(e).transform,duration:getComputedStyle(e).transitionDuration}));
  assert.ok(style.duration.split(',').every(v=>parseFloat(v)<=.05),'reduced motion duration '+style.duration);
  await el.click();assert.equal(await page.locator('body').getAttribute('data-view'),'develop');
  assert.equal(await page.locator('.xy-route-ghost').count(),0);
 });
 await check(label+' no JS errors',async()=>assert.deepEqual(errors,[]));
 await ctx.close();await browser.close();
}
}finally{await new Promise(r=>server.close(r))}
console.log('FLASH_SPRING '+passed+'/'+(passed+failed));if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
