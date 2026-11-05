const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let p=decodeURIComponent(url.pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(err,bytes)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(bytes));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let passed=0,failed=0;
 const verify=async(label,fn)=>{try{await fn();passed++;console.log('PASS',label)}catch(e){failed++;console.log('FAIL',label,String(e.stack||e).slice(0,1000))}};
 try{for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
  const browser=await engine.launch(name==='Edge'?{channel:'msedge',headless:true}:{headless:true});
  for(const width of [390,320]){
   const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:true});const page=await ctx.newPage(),errors=[];
   page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
   await verify(name+' '+width+' setting enters with directional continuity and returns',async()=>{
    await page.locator('.topbar [data-view=settings]').evaluate(e=>e.click());
    assert.equal(await page.locator('#workspace > .page:not(.xy-route-outgoing)').getAttribute('id'),'page-settings');
    assert.ok(await page.locator('#workspace > .page:not(.xy-route-outgoing)').evaluate(el=>el.getAnimations().some(a=>a.id==='xy-incoming-page')),'route animation missing');
    assert.equal(await page.locator('.xy-route-ghost').count(),0);
    await page.locator('.topbar [data-view=today]').evaluate(e=>e.click());
    assert.equal(await page.locator('#workspace > .page:not(.xy-route-outgoing)').getAttribute('id'),'page-today');
    assert.equal(await page.locator('.bottom-nav [data-view]').count(),3);
   });
   await verify(name+' '+width+' search opens without duplicate pages and escapes to last primary page',async()=>{
    await page.evaluate(()=>window.__XY_NATIVE_V4.navigate('search'));
    assert.equal(await page.locator('#workspace > .page:not(.xy-route-outgoing)').getAttribute('id'),'page-search');
    assert.ok(await page.locator('#workspace > .page:not(.xy-route-outgoing)').evaluate(el=>el.getAnimations().some(a=>a.id==='xy-incoming-page')));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#workspace > .page:not(.xy-route-outgoing)').getAttribute('id'),'page-today');
    assert.equal(await page.locator('#workspace > .page:not(.xy-route-outgoing)').count(),1);
   });
   await verify(name+' '+width+' assistant expands from avatar and returns focus',async()=>{
    const avatar=page.locator('#xiaoya-avatar');
    await avatar.evaluate(e=>e.click());
    assert.equal(await page.locator('#xiaoya-assistant').evaluate(e=>e.hidden),false);
    assert.ok(await page.locator('#xiaoya-assistant').evaluate(e=>e.getAnimations().length)>0);
    await page.locator('#assistant-close').evaluate(e=>e.click());
    await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden);
    assert.equal(await page.locator('#xiaoya-assistant').evaluate(e=>e.hidden),true);
    assert.equal(await page.locator('.xy-route-ghost').count(),0);
   });
   await verify(name+' '+width+' assistant config expands continuously and closes',async()=>{
    await page.locator('#xiaoya-avatar').evaluate(e=>e.click());
    await page.locator('#assistant-config-toggle').evaluate(e=>e.click());
    assert.equal(await page.locator('#assistant-config').evaluate(e=>e.hidden),false);
    assert.ok(await page.locator('#assistant-config').evaluate(e=>e.getAnimations().length)>0);
    await page.waitForTimeout(370);
    await page.locator('#assistant-config-toggle').evaluate(e=>e.click());
    await page.waitForTimeout(390);
    assert.equal(await page.locator('#assistant-config').evaluate(e=>e.hidden),true);
    await page.locator('#assistant-close').evaluate(e=>e.click());
    await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden);
   });
   await verify(name+' '+width+' rapid assistant open-close leaves no stale transform',async()=>{
    for(let i=0;i<5;i++){
     await page.locator('#xiaoya-avatar').evaluate(e=>e.click());
     await page.locator('#assistant-close').evaluate(e=>e.click());
    }
    await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden);
    assert.equal(await page.locator('#xiaoya-assistant').evaluate(e=>e.hidden),true);
    assert.equal(await page.locator('#xiaoya-assistant').evaluate(e=>e.getAnimations().length),0);
    assert.equal(await page.locator('#workspace').evaluate(e=>getComputedStyle(e).transform),'none');
   });
   await verify(name+' '+width+' reduced-motion uses immediate navigation and no transition',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('.topbar [data-view=settings]').evaluate(e=>e.click());
    assert.equal(await page.locator('#workspace > .page:not(.xy-route-outgoing)').getAttribute('id'),'page-settings');
    assert.equal(await page.locator('#workspace > .page:not(.xy-route-outgoing)').evaluate(e=>e.getAnimations().length),0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#workspace > .page:not(.xy-route-outgoing)').getAttribute('id'),'page-today');
    await page.emulateMedia({reducedMotion:'no-preference'});
   });
   await verify(name+' '+width+' ordinary add-action sheet opens and closes continuously',async()=>{
    await page.evaluate(()=>window.__XY_NATIVE_V4.navigate('items'));
    await page.waitForFunction(()=>!document.querySelector('.xy-route-outgoing'));
    await page.locator('#page-items .xy-action-main').evaluate(e=>e.click());
    const sheet=page.locator('#editor');
    assert.equal(await sheet.evaluate(e=>e.open),true);
    assert.ok(await sheet.locator('.sheet-frame').evaluate(e=>e.getAnimations().length)>0,'non-card sheet still flashes into view');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#editor').open);
    assert.equal(await sheet.evaluate(e=>e.open),false);
    assert.equal(await page.locator('.xy-route-ghost').count(),0);
   });
   await verify(name+' '+width+' no runtime errors and existing Dock is unchanged',async()=>{
    assert.equal(await page.locator('.bottom-nav [data-view]').count(),3);
    assert.deepEqual(errors,[]);
   });
   await ctx.close();
  }
  await browser.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('ACADEMY_CONTINUITY '+passed+'/'+(passed+failed));
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
