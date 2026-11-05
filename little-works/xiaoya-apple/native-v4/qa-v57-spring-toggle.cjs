const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(rel.startsWith('/xiaoya-lifelab/'))rel=rel.slice('/xiaoya-lifelab'.length);
 const file=path.resolve(root,'.'+rel+(rel.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(data));
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let ok=0,fail=0;
 const test=async(name,fn)=>{try{await fn();console.log('PASS',name);ok++}catch(e){console.log('FAIL',name,String(e.stack||e).slice(0,1500));fail++}};
 try{for(const [name,type] of [['Edge',chromium],['WebKit',webkit]]){
  const browser=await type.launch(name==='Edge'?{channel:'msedge',headless:true}:{headless:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const page=await ctx.newPage(),errs=[];page.setDefaultTimeout(4200);page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  await test(name+' avatar second tap closes and third tap reopens',async()=>{
   const avatar=page.locator('#xiaoya-avatar'),panel=page.locator('#xiaoya-assistant');
   await avatar.click();assert.equal(await panel.evaluate(e=>e.hidden),false);
   await page.waitForTimeout(90);
   await avatar.click();
   await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden,{timeout:2200});
   await avatar.click();assert.equal(await panel.evaluate(e=>e.hidden),false);
   await page.locator('#assistant-close').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden,{timeout:2200});
  });
  await test(name+' assistant top entrance is a sampled physical spring, not cubic tween',async()=>{
   await page.locator('#xiaoya-avatar').evaluate(e=>e.click());
   const data=await page.locator('#xiaoya-assistant').evaluate(e=>{const a=e.getAnimations().find(v=>v.effect?.getKeyframes().some(k=>k.transform));return a?{duration:a.effect.getTiming().duration,frames:a.effect.getKeyframes().filter(k=>k.transform).map(k=>k.transform)}:null});
   assert.ok(data&&data.duration>=570&&data.frames.length>=16,JSON.stringify(data));
   assert.ok(data.frames.some(s=>s.includes('translate3d(')));assert.ok(!data.frames.some(s=>/scale\(/.test(s)));
   await page.waitForTimeout(850);await page.locator('#assistant-close').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden);
  });
  await test(name+' full pages settle with >500ms spring rather than 305ms hard stop',async()=>{
   await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
   const data=await page.locator('#workspace > .page:not(.xy-route-outgoing)').evaluate(e=>{const a=e.getAnimations().find(a=>a.id==='xy-incoming-page');return a?{duration:a.effect.getTiming().duration,n:a.effect.getKeyframes().length}:null});
   assert.ok(data&&data.duration>=500&&data.n>=16,JSON.stringify(data));
   await page.waitForTimeout(920);assert.equal(await page.locator('.xy-route-outgoing').count(),0);
  });
  await test(name+' fast reverse navigation inherits in-flight displacement',async()=>{
   const measured=await page.evaluate(async()=>{
    document.querySelector('.bottom-nav [data-view=develop]').click();
    await new Promise(r=>requestAnimationFrame(r));
    const el=document.querySelector('#workspace > .page:not(.xy-route-outgoing)');
    const x=new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
    const width=document.querySelector('#workspace').clientWidth;
    document.querySelector('.bottom-nav [data-view=items]').click();
    const next=document.querySelector('#workspace > .page:not(.xy-route-outgoing)');
    const a=next.getAnimations().find(a=>a.id==='xy-incoming-page');
    const start=new DOMMatrixReadOnly(a.effect.getKeyframes()[0].transform).m41;
    return {x,width,start};
   });
   assert.ok(Math.abs(measured.x)>12,'first slide did not start');
   assert.ok(Math.abs(measured.start-(measured.x-measured.width))<12,JSON.stringify(measured));   await page.waitForTimeout(820);
  });
  await test(name+' Xiaoya name in chat header also closes the panel',async()=>{
   await page.locator('#xiaoya-avatar').click();
   await page.locator('#assistant-identity-toggle').click();
   await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden);
  });
  await test(name+' default bottom sheet rises on physical spring and closes reversibly',async()=>{
   await page.locator('#page-items .xy-action-main').evaluate(e=>e.click());
   const data=await page.locator('#editor .sheet-frame').evaluate(e=>{const a=e.getAnimations().find(v=>v.effect?.getKeyframes().some(k=>k.transform));return a?{duration:a.effect.getTiming().duration,frames:a.effect.getKeyframes().length}:null});
   assert.ok(data&&data.duration>=500&&data.frames>=16,JSON.stringify(data));
   await page.waitForTimeout(780);await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#editor').open,{timeout:2000});
  });
  await test(name+' no crashes no duplicate interactive pages and preserved Dock',async()=>{
   assert.equal(await page.locator('.bottom-nav [data-view]').count(),3);
   assert.equal(await page.locator('.xy-route-outgoing').count(),0);
   assert.deepEqual(errs,[]);
  });
  await ctx.close();await browser.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('V57_SPRING_TOGGLE '+ok+'/'+(ok+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
