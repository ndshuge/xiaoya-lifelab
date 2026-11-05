const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let u=decodeURIComponent(url.pathname);
 if(u.startsWith('/xiaoya-lifelab/'))u=u.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+u+(u.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(err,body)=>err?res.writeHead(404).end('404'):res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(body));
});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));let total=0,fail=0;
 const check=async(name,fn)=>{try{await fn();console.log('PASS',name);total++}catch(e){console.error('FAIL',name,String(e.stack||e).slice(0,1300));total++;fail++}};
 try{for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
  const browser=await engine.launch(name==='Edge'?{headless:true,channel:'msedge'}:{headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(4000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  const swipe=async(dx,dy=4,selector='#workspace .page-heading h1')=>page.evaluate(async({dx,dy,selector})=>{
   const target=document.querySelector(selector);if(!target)throw Error('missing gesture surface '+selector);
   const x=190,y=320,id=200+Math.round(Math.random()*50);
   const send=(type,nx,ny)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,isPrimary:true,pointerType:'touch',button:0,pointerId:id,clientX:nx,clientY:ny}));
   send('pointerdown',x,y);await new Promise(r=>setTimeout(r,20));
   for(let i=1;i<=7;i++){send('pointermove',x+dx*i/7,y+dy*i/7);await new Promise(r=>setTimeout(r,18))}
   send('pointerup',x+dx,y+dy);await new Promise(r=>setTimeout(r,580));return {route:document.querySelector('#workspace > .page')?.id,previews:document.querySelectorAll('.xy-swipe-preview').length};
  },{dx,dy,selector});
  const route=()=>page.locator('#workspace > .page:not(.xy-route-outgoing)').getAttribute('id');
  await check(name+' navigation uses an interactive spring gesture',async()=>{
   assert.ok(await page.locator('#workspace').count(),'workspace missing');
   console.log('LEFT_DIAG',name,await swipe(-180));assert.equal(await route(),'page-items');
   assert.equal(await page.locator('.bottom-nav [data-view=items]').getAttribute('aria-current'),'page');
   console.log('RIGHT_DIAG',name,await swipe(180));assert.equal(await route(),'page-today');
  });
  await check(name+' swipe cancellation and vertical scroll do not change route',async()=>{
   await swipe(-31);assert.equal(await route(),'page-today');
   await swipe(-130,190);assert.equal(await route(),'page-today');
   const d=await page.evaluate(()=>({workspace:getComputedStyle(document.querySelector('#workspace')).transform,ghosts:document.querySelectorAll('.xy-route-ghost').length}));
   assert.equal(d.workspace,'none');assert.equal(d.ghosts,0);
  });
  await check(name+' swipe traverses ordered pages and stops at boundaries',async()=>{
   await swipe(-220);assert.equal(await route(),'page-items');
   await swipe(-220);assert.equal(await route(),'page-develop');
   await swipe(-220);assert.equal(await route(),'page-develop');
   await swipe(220);assert.equal(await route(),'page-items');
  });
  await check(name+' item segmented swipes follow local tab intent',async()=>{
   await swipe(-130,4,'.v4-item-segments');
   assert.equal(await page.locator('.v4-item-segments [data-items-tab=inbox]').getAttribute('aria-pressed'),'true');
   await swipe(130,4,'.v4-item-segments');
   assert.equal(await page.locator('.v4-item-segments [data-items-tab=schedule]').getAttribute('aria-pressed'),'true');
  });
  await check(name+' editing and assistant overlays block page gestures',async()=>{
   await page.locator('#page-items .xy-action-main').evaluate(e=>e.click());
   await page.locator('[data-quick-create=task]').evaluate(e=>e.click());
   assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
   await swipe(-200,0,'#sheet-title');assert.equal(await route(),'page-items');
   await page.keyboard.press('Escape');await page.waitForTimeout(320);
  });
  await check(name+' release of single button feels elastic without layout jump',async()=>{
   const b=page.locator('#page-items .xy-action-main').first();
   const before=await b.evaluate(e=>({rect:e.getBoundingClientRect().width,scale:getComputedStyle(e).transform,shadow:getComputedStyle(e).boxShadow}));
   await b.evaluate(e=>e.classList.add('xy-is-pressed'));await page.waitForTimeout(120);
   const down=await b.evaluate(e=>({rect:e.getBoundingClientRect().width,scale:getComputedStyle(e).transform,shadow:getComputedStyle(e).boxShadow}));
   assert.ok(down.shadow!==before.shadow||down.scale!==before.scale,'solo missing tactile feedback before='+JSON.stringify(before)+' down='+JSON.stringify(down)+' role='+await b.getAttribute('data-press-role'));
   assert.ok(Math.abs(down.rect-before.rect)<1,'button hitbox width jumped');
   await b.evaluate(e=>e.classList.remove('xy-is-pressed'));await page.waitForTimeout(420);
   const after=await b.evaluate(e=>getComputedStyle(e).transform);
   assert.ok(after==='none'||after.includes('matrix(1, 0, 0, 1,')||after===before.scale,'button failed to settle '+after);
  });
  await check(name+' reduced-motion keeps immediate navigation and no movement',async()=>{
   await page.emulateMedia({reducedMotion:'reduce'});
   await swipe(-220);assert.equal(await route(),'page-develop');
   assert.equal(await page.locator('.xy-swipe-preview').count(),0);
   await page.emulateMedia({reducedMotion:'no-preference'});
  });
  await check(name+' development segments glide between record and goals',async()=>{
   await swipe(-150,5,'.v4-develop-segments');
   assert.equal(await page.locator('.v4-develop-segments [data-develop-tab=goals]').getAttribute('aria-pressed'),'true');
   await swipe(150,5,'.v4-develop-segments');
   assert.equal(await page.locator('.v4-develop-segments [data-develop-tab=record]').getAttribute('aria-pressed'),'true');
  });
  await check(name+' old dock and HD mood images remain intact',async()=>{
   assert.equal(await page.locator('.bottom-nav [data-view]').count(),3);
   await page.locator('[data-develop-tab=record]').evaluate(e=>e.click());
   const moods=await page.locator('.v4-mood-option .v4-mood-art').evaluateAll(xs=>xs.map(e=>getComputedStyle(e).backgroundImage));
   assert.equal(moods.length,5);assert.ok(moods.every(src=>src.includes('-hi')));
   assert.deepEqual(errors,[]);
  });
  await context.close();await browser.close();
 }}finally{await new Promise(r=>srv.close(r))}
 console.log('ACADEMY_SWIPE_TACTILE '+(total-fail)+'/'+total);
 if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
