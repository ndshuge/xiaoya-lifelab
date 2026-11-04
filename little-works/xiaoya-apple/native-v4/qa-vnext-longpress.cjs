const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const raw=decodeURIComponent(new URL(req.url,'http://local').pathname);
 const p=raw.startsWith('/xiaoya-lifelab/')?raw.slice('/xiaoya-lifelab'.length):raw;
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b));
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let pass=0,fail=0;const check=async(label,fn)=>{try{await fn();pass++;console.log('PASS',label)}catch(e){fail++;console.log('FAIL',label,String(e.message||e).slice(0,600))}};
 const pointer=(el,type,id,x,y)=>el.dispatchEvent(type,{pointerId:id,isPrimary:true,button:0,clientX:x,clientY:y,pointerType:'touch',bubbles:true});
 try{
 for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
  const b=await engine.launch(name==='Edge'?{channel:'msedge',headless:true}:{headless:true});
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  await p.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
  await p.locator('[data-items-tab=inbox]').evaluate(e=>e.click());
  const task=p.locator('[data-edit=task]').first();
  await check(name+' scrolling move cancels long press',async()=>{
   await pointer(task,'pointerdown',17,120,420);
   await pointer(task,'pointermove',17,120,446);
   await p.waitForTimeout(570);
   assert.equal(await p.locator('#editor').evaluate(e=>e.open),false);
  });
  await check(name+' task long press opens native accessible action sheet',async()=>{
   await pointer(task,'pointerdown',18,120,420);
   await p.waitForTimeout(570);
   assert.equal(await p.locator('#editor').evaluate(e=>e.open),true);
   assert.equal(await p.locator('[data-context-action]').count(),3);
   assert.match(await p.locator('#sheet-title').innerText(),/./);
   const r=await p.locator('.xy-context-action').first().boundingBox();
   assert.ok(r&&r.height>=44);
   await pointer(task,'pointerup',18,120,420);
  });
  await check(name+' action sheet cancel does not edit task',async()=>{
   await p.keyboard.press('Escape');
   assert.equal(await p.locator('#editor').evaluate(e=>e.open),false);
   const title=await task.innerText();assert.ok(title.length>0);
  });
  await check(name+' journal entry long press opens record actions',async()=>{
   await p.locator('.bottom-nav [data-view=develop]').evaluate(e=>e.click());
   await p.locator('.v4-mood-option[data-mood="3"]').evaluate(e=>e.click());
   await p.locator('#journal-note').fill('QA 长按手势回归测试');
   await p.locator('#journal-save').evaluate(e=>e.click());
   const row=p.locator('[data-journal-date]').first();
   assert.ok(await row.count());
   await pointer(row,'pointerdown',19,120,420);
   await p.waitForTimeout(570);
   assert.equal(await p.locator('#editor').evaluate(e=>e.open),true);
   assert.equal(await p.locator('[data-context-action=open-journal]').count(),1);
   assert.equal(await p.locator('[data-context-action=remove-journal]').count(),1);
   await p.locator('[data-context-action=open-journal]').evaluate(e=>e.click());
   assert.equal(await p.locator('#editor').evaluate(e=>e.open),false);
   assert.equal(await p.locator('#journal-note').inputValue(),'QA 长按手势回归测试');
  });
  await check(name+' no runtime errors',async()=>assert.deepEqual(errors,[]));
  await ctx.close();await b.close();
 }
 }finally{await new Promise(ok=>server.close(ok))}
 console.log('VNEXT_LONGPRESS '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
