const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://l').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let pass=0,fail=0;
const check=async(n,fn)=>{try{await fn();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,String(e.message||e).slice(0,630))}};
try{for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
 const b=await engine.launch(name==='Edge'?{headless:true,channel:'msedge'}:{headless:true});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});
 const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(2300);p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await check(name+' dock upper blur starts only next to dock',async()=>{
  const x=await p.evaluate(()=>{let u=document.querySelector('.xy-progressive-underlay'),d=document.querySelector('#bottom-nav');let r=u.getBoundingClientRect(),b=d.getBoundingClientRect();return{u:r.top,b:b.top,bottom:r.bottom,win:innerHeight,blur:Array.from(u.querySelectorAll('.xy-blur-layer'),e=>getComputedStyle(e).maskImage)}});
  console.log('DOCK_GEOMETRY',name,JSON.stringify(x));
  assert.ok(x.b-x.u>=10&&x.b-x.u<=55,'blur extends too far above dock: '+(x.b-x.u)+'px');
  assert.ok(Math.abs(x.bottom-x.win)<=1);
  assert.ok(x.blur[0].includes('gradient'));
 });
 await check(name+' action text buttons have physical gentle press, no 3D shadow',async()=>{
  const selector=await p.locator('.dayflow-focus-title').count()?'.dayflow-focus-title':'[data-add=task]';
  if(selector==='[data-add=task]'){await p.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());await p.locator('[data-items-tab=schedule]').evaluate(e=>e.click())}
  const el=p.locator(selector).first();
  assert.equal(await el.getAttribute('data-press-role'),'quiet');
  const original=await el.evaluate(e=>getComputedStyle(e).transform);
  const box=await el.boundingBox();
  await el.evaluate(e=>e.classList.add('xy-is-pressed'));

  await p.waitForTimeout(125);
  const held=await el.evaluate(e=>({transform:getComputedStyle(e).transform,filter:getComputedStyle(e).filter,pressed:e.classList.contains('xy-is-pressed')}));
  assert.ok(held.pressed);assert.ok(held.transform!==original||held.filter!=='none','quiet press has no visual feedback '+JSON.stringify(held)+' initial='+original);
  await p.mouse.up();
  await el.evaluate(e=>e.classList.remove('xy-is-pressed'));
  await p.waitForTimeout(440);const settled=await el.evaluate(e=>getComputedStyle(e).transform);assert.ok(settled==='none'||settled===original||settled.includes('matrix(1, 0, 0, 1,'),'unsettled '+settled);
  if(await p.locator('#editor').evaluate(e=>e.open))await p.keyboard.press('Escape');
 });
 await check(name+' items quick action also gently depresses',async()=>{
  await p.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());await p.locator('[data-items-tab=schedule]').evaluate(e=>e.click());
  const el=p.locator('[data-add=task]').first();
  assert.equal(await el.getAttribute('data-press-role'),'quiet');
  const box=await el.boundingBox();await el.evaluate(e=>e.classList.add('xy-is-pressed'));await p.waitForTimeout(95);
  assert.notEqual(await el.evaluate(e=>getComputedStyle(e).transform),'none');await el.evaluate(e=>e.classList.remove('xy-is-pressed'));
  await p.mouse.up();
 });
 await check(name+' group selectors never get solo 3D depress',async()=>{
  await p.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
  const group=p.locator('.v4-item-segments [data-items-tab=inbox]');
  assert.equal(await group.getAttribute('data-press-role'),'group');
  const s=await group.evaluate(e=>getComputedStyle(e).boxShadow);
  assert.equal(s,'none');
 });
 await check(name+' reduced motion disables standalone depress',async()=>{
  await p.emulateMedia({reducedMotion:'reduce'});
  const el=p.locator('[data-add=task]').first();const dur=await el.evaluate(e=>getComputedStyle(e).transitionDuration);
  assert.ok(dur.split(',').every(x=>Number.parseFloat(x)<.05),'reduced-motion transition '+dur);
 });
 await check(name+' label-only settings dismissal still has an elastic press',async()=>{
  if(await p.locator('#editor').evaluate(e=>e.open))await p.keyboard.press('Escape');
  await p.emulateMedia({reducedMotion:'no-preference'});
  await p.locator('.topbar .toolbar-actions button').click();
  const el=p.locator('.topbar .glass-btn.is-detail-done');
  assert.equal(await el.getAttribute('data-press-role'),'icon');
  const initial=await el.evaluate(e=>getComputedStyle(e).transform);
  await el.hover();const rect=await el.boundingBox();
  await p.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await p.mouse.down();await p.waitForTimeout(110);
  assert.notEqual(await el.evaluate(e=>getComputedStyle(e).transform),initial,'label-only icon did not move');
  await p.mouse.up();
 });
 await check(name+' no uncaught errors',async()=>assert.deepEqual(errors,[]));
 await ctx.close();await b.close();
}}finally{await new Promise(r=>server.close(r))}
console.log('DOCK_PRESS_ZONE '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
