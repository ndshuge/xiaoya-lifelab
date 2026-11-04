const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'docs','qa','evidence','2026-11-04-xiaoya-academy-motion');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,body)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(body))
});
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const captures=[];
 try{
  for(const [name,engine] of [['edge',chromium],['webkit',webkit]]){
   const browser=await engine.launch(name==='edge'?{channel:'msedge',headless:true}:{headless:true});
   for(const [width,height,dark,motion] of [[390,844,false,'no-preference'],[320,740,true,'reduce'],[1440,900,false,'no-preference']]){
    const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<700,colorScheme:dark?'dark':'light',reducedMotion:motion});
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
    const snap=async(suffix)=>{const n=name+'-'+width+(dark?'-dark':'')+'-'+suffix+'.png';await page.screenshot({path:path.join(out,n)});captures.push(n)};
    await snap('today');
    await page.locator('.topbar [data-view=settings]').evaluate(e=>e.click());
    await page.waitForTimeout(motion==='reduce'?0:160);await snap('settings-transition');
    await page.locator('.topbar button[data-view=today]').evaluate(e=>e.click());
    await page.locator('#xiaoya-avatar').evaluate(e=>e.click());
    await page.waitForTimeout(motion==='reduce'?0:170);await snap('assistant-transition');
    await page.locator('#assistant-close').evaluate(e=>e.click());await page.waitForTimeout(400);
    await page.evaluate(()=>window.__XY_NATIVE_V4.navigate('items'));
    await page.waitForTimeout(430);await snap('items');
    await page.evaluate(()=>window.__XY_NATIVE_V4.navigate('develop'));
    await page.waitForTimeout(420);await snap('develop');
    assert.deepEqual(errors,[],name+' '+width+' runtime errors');
    assert.equal(await page.locator('.bottom-nav [data-view]').count(),3);
    assert.equal(await page.locator('.xy-route-ghost').count(),0);
    await ctx.close();
   }
   await browser.close();
  }
 }finally{await new Promise(r=>server.close(r))}
 console.log('ACADEMY_VISUAL_PASS '+captures.length+' evidence files in '+out);
 console.log(captures.join('\n'));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
