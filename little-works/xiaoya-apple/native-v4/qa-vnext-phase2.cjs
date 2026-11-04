const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
const emit=(p,sel,type,id,x,y)=>p.locator(sel).evaluate((el,a)=>el.dispatchEvent(new PointerEvent(a.type,{bubbles:true,isPrimary:true,button:0,pointerId:a.id,clientX:a.x,clientY:a.y,pointerType:'touch'})),{type,id,x,y});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let pass=0,fail=0;
 async function check(n,fn){try{await fn();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,String(e.message||e).slice(0,700))}}
 try{for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
  const b=await engine.launch(name==='Edge'?{channel:'msedge',headless:true}:{headless:true});
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(3800);p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  await p.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
  await p.locator('[data-items-tab=inbox]').evaluate(e=>e.click());
  const task=p.locator('[data-edit=task]').first();
  await check(name+' task card opens with shared geometry animation',async()=>{
    await task.evaluate(e=>e.click());
    const sheet=p.locator('#editor');assert.ok(await sheet.evaluate(e=>e.open));
    const frames=await p.locator('.sheet-frame').evaluate(e=>e.getAnimations().filter(a=>a.playState==='running').length);
    assert.ok(frames>0,'no opening geometry animation running');
    assert.equal(await p.locator('.xy-route-ghost').count(),0);
    assert.equal(await p.locator('#workspace').count(),1);
  });
  await check(name+' sheet close restores source focus and cancels remaining motion',async()=>{
    await p.keyboard.press('Escape');
    await p.waitForTimeout(480);
    assert.equal(await p.locator('#editor').evaluate(e=>e.open),false);
    const focus=await p.evaluate(()=>document.activeElement?.dataset.edit);
    assert.equal(focus,'task');
    assert.equal(await p.locator('.sheet-frame').evaluate(e=>e.getAnimations().length),0);
  });
  await check(name+' repeated task opening is interruptible',async()=>{
    for(let i=0;i<7;i++){await p.locator('[data-edit=task]').first().evaluate(e=>e.click());await p.keyboard.press('Escape');}
    await p.waitForTimeout(480);
    assert.equal(await p.locator('#editor').evaluate(e=>e.open),false);
    assert.equal(await p.locator('.xy-route-ghost').count(),0);
  });
  await check(name+' interactive edge-pop supports cancel then confirm for task sheet',async()=>{
    await p.locator('[data-edit=task]').first().evaluate(e=>e.click());
    const gesture=async(distance,vertical=0)=>p.evaluate(([dx,dy])=>{
      const evt=(type,x,y)=>document.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,pointerId:71,pointerType:'touch',button:0,clientX:x,clientY:y}));
      evt('pointerdown',9,300);evt('pointermove',9+dx,300+dy);evt('pointerup',9+dx,300+dy);
    },[distance,vertical]);
    await gesture(55);
    assert.equal(await p.locator('#editor').evaluate(e=>e.open),true,'gesture cancel should keep sheet open');
    await gesture(135);
    await p.waitForTimeout(380);
    assert.equal(await p.locator('#editor').evaluate(e=>e.open),false,'edge pop should close editor');
    assert.equal(await p.locator('#workspace').count(),1);
    assert.equal(await p.locator('.xy-route-ghost').count(),0);
  });
  await check(name+' completion uses subtle existing Toast without altering Dock',async()=>{
    const count=await p.locator('.v4-task-row .circle-check').count();assert.ok(count>0);
    await p.locator('.v4-task-row .circle-check').first().evaluate(e=>e.click());
    assert.equal(await p.locator('#toast').getAttribute('data-kind'),'complete');
    assert.equal(await p.locator('.bottom-nav').count(),1);
    assert.equal(await p.locator('.xy-route-ghost').count(),0);
  });
  await check(name+' historical journal detail has return and shared space',async()=>{
    await p.locator('.bottom-nav [data-view=develop]').evaluate(e=>e.click());
    await p.locator('.v4-mood-option[data-mood="4"]').evaluate(e=>e.click());
    await p.locator('#journal-note').fill('Phase2 journal geometry');
    await p.locator('#journal-save').evaluate(e=>e.click());
    await p.locator('[data-journal-date]').first().evaluate(e=>e.click());
    assert.ok(await p.locator('[data-action=journal-back]').count(),'missing return to journal origin');
    const journalActual=await p.locator('#journal-note').inputValue();
    assert.equal(journalActual,'Phase2 journal geometry');
    assert.equal(await p.locator('.xy-route-ghost').count(),0);
    assert.ok(await p.locator('.v4-journal-paper').evaluate(e=>e.getAnimations().filter(a=>a.playState==='running').length)>0,'no shared geometry animation');
    await p.locator('[data-action=journal-back]').evaluate(e=>e.click());
    await p.waitForTimeout(500);
    assert.ok(await p.locator('.v4-journal-history').count());
  });
  await check(name+' 50 rapid mood changes keep HD size and one selected',async()=>{
    for(let i=0;i<50;i++)await p.locator('.v4-mood-option').nth(i%5).evaluate(e=>e.click());
    const result=await p.locator('.v4-mood-option').evaluateAll(xs=>xs.map(e=>({active:e.classList.contains('is-active'),art:e.querySelector('.v4-mood-art').getBoundingClientRect().height,transform:getComputedStyle(e.querySelector('.v4-mood-art')).transform})));
    assert.equal(result.filter(e=>e.active).length,1);
    assert.ok(result.every(e=>Math.abs(e.art-result[0].art)<.2&&e.transform==='none'),JSON.stringify(result));
  });
  await check(name+' reduced motion opens dialog without geometric animation',async()=>{
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
    await p.locator('[data-items-tab=inbox]').evaluate(e=>e.click());
    await p.locator('[data-edit=task]').first().evaluate(e=>e.click());
    assert.equal(await p.locator('.sheet-frame').evaluate(e=>e.getAnimations().length),0);
    await p.keyboard.press('Escape');
    await p.emulateMedia({reducedMotion:'no-preference'});
  });
  await check(name+' no runtime errors',async()=>assert.deepEqual(errors,[]));
  await ctx.close();await b.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('VNEXT_PHASE2 '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
