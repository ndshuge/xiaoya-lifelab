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
 await check(label+' persistent dock press, held elastic scale and return overshoot',async()=>{
  const el=page.locator('.bottom-nav [data-view=develop]'),icon=el.locator('svg');const box=await el.boundingBox();
  const before=await el.boundingBox();await el.hover();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(170);
  const hold=scaleOf(await icon.evaluate(e=>getComputedStyle(e).transform));
  assert.equal(await el.evaluate(e=>e.classList.contains('xy-is-pressed')),true,'pointerdown must retain held state even in WebKit');
  const holdState=await el.evaluate(e=>({active:e.matches(':active'),hit:document.elementFromPoint(e.getBoundingClientRect().x+e.offsetWidth/2,e.getBoundingClientRect().y+e.offsetHeight/2)?.closest('button')?.getAttribute('data-view')}));
  assert.ok(hold<.95&&hold>.84,'hold scale '+hold+' '+JSON.stringify(holdState));
  await page.mouse.up();
  assert.equal(await el.evaluate(e=>e.classList.contains('xy-is-pressed')),false,'pointer release must settle');
  // Flush computed style before sampling: some headless engines start the
  // 520ms transition at the next rendered frame, not at pointerup wall time.
  await icon.evaluate(e=>getComputedStyle(e).transform);
  await page.waitForFunction(()=>{
    const e=document.querySelector('.bottom-nav [data-view=develop] svg');
    const tr=getComputedStyle(e).transform;
    const s=tr.startsWith('matrix(')?Number(tr.slice(7).split(',')[0]):1;
    return s>1.012&&s<1.09;
  },null,{timeout:1600,polling:'raf'});
  const bounce=scaleOf(await icon.evaluate(e=>getComputedStyle(e).transform));
  assert.ok(bounce>1.008&&bounce<1.09,'release overshoot '+bounce);
  const during=await el.boundingBox();
  assert.ok(Math.abs(before.x-during.x)<.5&&Math.abs(before.width-during.width)<.5,'hitbox moved');
  await page.waitForTimeout(370);
  const end=scaleOf(await icon.evaluate(e=>getComputedStyle(e).transform));
  assert.ok(Math.abs(end-1)<.007,'settle '+end);
 });
 await check(label+' pressing date control keeps 44px hitbox and elastic visible content',async()=>{
  await page.locator('.bottom-nav [data-view=items]').click();
  const el=page.locator('.v4-week-tools .calendar-arrow button').first();
  await el.scrollIntoViewIfNeeded();await el.hover();const box=await el.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(150);
  const icon=el.locator('svg');
  const s=scaleOf(await icon.evaluate(e=>getComputedStyle(e).transform));
  assert.ok(s<.96,'date hold scale '+s);
  await page.mouse.up();
  const newBox=await el.boundingBox();
  assert.ok(Math.abs(box.width-newBox.width)<.6,'button changed hit width');
 });
 await check(label+' re-rendered segmented button inherits release spring',async()=>{
  await page.locator('#workspace [data-items-tab=inbox]').evaluate(e=>e.click());
  await page.waitForTimeout(50);
  await page.waitForFunction(()=>[...document.querySelector('#workspace [data-items-tab=inbox] .xy-elastic-face')?.getAnimations()||[]].some(a=>a.effect?.getTiming()?.duration>=420),null,{timeout:950});
  const count=await page.locator('#workspace [data-items-tab=inbox] .xy-elastic-face').evaluate(e=>e.getAnimations().filter(a=>a.effect?.getTiming()?.duration>=420).length);
  assert.ok(count>=1,'new segmented button lost spring after DOM replacement');
});
await check(label+' re-rendered date retains press release animation',async()=>{
  await page.locator('#workspace [data-items-tab=schedule]').click();
  const button=page.locator('.v4-week-rail .day-pill').first();
  const day=await button.getAttribute('data-day');
  await button.evaluate(e=>e.click());
  await page.waitForTimeout(50);
  await page.waitForFunction(d=>[...document.querySelector('.v4-week-rail .day-pill[data-day="'+d+'"] strong')?.getAnimations()||[]].some(a=>a.effect?.getTiming()?.duration>=420),day,{timeout:950});
  const count=await page.locator('.v4-week-rail .day-pill[data-day="'+day+'"] strong').evaluate(e=>e.getAnimations().filter(a=>a.effect?.getTiming()?.duration>=420).length);
  assert.ok(count>=1,'date button lost spring after rerender');
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
