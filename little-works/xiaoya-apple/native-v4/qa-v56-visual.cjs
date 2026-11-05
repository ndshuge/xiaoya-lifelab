const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'docs/qa/evidence/2026-11-05-xiaoya-rigid-two-page');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,data)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(data));
});
(async()=>{fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let captures=[];
 try{for(const [name,engine] of [['edge',chromium],['webkit',webkit]]){
  const browser=await engine.launch(name==='edge'?{channel:'msedge',headless:true}:{headless:true});
  for(const [width,dark] of [[390,false],[320,true],[1440,false]]){
   const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:width<700,colorScheme:dark?'dark':'light'});
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
   const save=async tag=>{const n=name+'-'+width+(dark?'-dark':'')+'-'+tag+'.png';await page.screenshot({path:path.join(out,n)});captures.push(n)};
   await save('today');
   await page.evaluate(()=>{
    const t=document.querySelector('#workspace .page-heading h1'),id=991;
    const fire=(type,x)=>t.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,isPrimary:true,button:0,clientX:x,clientY:250}));
    window.__QA_release=()=>fire('pointerup',80);
    fire('pointerdown',220);fire('pointermove',140);
   });
   assert.equal(await page.locator('.xy-swipe-preview').count(),1);
   await save('two-pages-mid-drag');
   await page.evaluate(()=>window.__QA_release());
   await page.waitForTimeout(550);
   assert.equal(await page.locator('.xy-swipe-preview').count(),0);
   await page.locator('#xiaoya-avatar').evaluate(e=>e.click());
   await page.waitForTimeout(85);await save('assistant-top-midway');
   await page.waitForTimeout(430);await save('assistant-open');
   await page.locator('#assistant-close').evaluate(e=>e.click());
   await page.waitForTimeout(90);await save('assistant-exiting-top');
   await page.waitForTimeout(390);
   assert.equal(await page.locator('#xiaoya-assistant').evaluate(e=>e.hidden),true);
   assert.deepEqual(errors,[]);
   await ctx.close();
  }await browser.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('RIGID_PAIR_VISUAL_PASS',captures.length);console.log(captures.join('\n'));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
