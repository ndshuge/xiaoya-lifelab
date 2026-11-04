const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'docs','qa','evidence','2026-11-04-xiaoya-living-motion-phase2');
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1';
 const records=[];
 try{
  for(const [name,engine] of [['edge',chromium],['webkit',webkit]]){
   const b=await engine.launch(name==='edge'?{channel:'msedge',headless:true}:{headless:true});
   for(const [width,height,theme,motion] of [[390,844,'light','no-preference'],[320,740,'dark','reduce'],[1440,900,'light','no-preference']]){
    const context=await b.newContext({viewport:{width,height},hasTouch:width<700,colorScheme:theme,reducedMotion:motion});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator(width>700?'.side-nav [data-view=items]':'.bottom-nav [data-view=items]').evaluate(e=>e.click());
    await page.locator('[data-items-tab=inbox]').evaluate(e=>e.click());
    await page.screenshot({path:path.join(out,name+'-'+width+'-'+theme+'-items.png')});
    await page.locator('[data-edit=task]').first().evaluate(e=>e.click());
    await page.waitForTimeout(90);
    await page.screenshot({path:path.join(out,name+'-'+width+'-'+theme+'-sheet-mid.png')});
    const hit=await page.locator('.sheet .sheet-save').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
    assert.ok(hit.height>=44,JSON.stringify(hit));
    assert.equal(await page.locator('.xy-route-ghost').count(),0);
    await page.waitForTimeout(360);
    await page.screenshot({path:path.join(out,name+'-'+width+'-'+theme+'-sheet-settled.png')});
    await page.keyboard.press('Escape');await page.waitForTimeout(370);
    assert.equal(await page.locator('#editor').evaluate(e=>e.open),false);
    if(width===390){
     await page.locator(width>700?'.side-nav [data-view=develop]':'.bottom-nav [data-view=develop]').evaluate(e=>e.click());
     await page.locator('[data-mood="4"]').first().evaluate(e=>e.click());
     await page.locator('#journal-note').fill('今天心情不错，留下一段小小记录。');
     await page.locator('#journal-save').evaluate(e=>e.click());
     await page.locator('[data-journal-date]').first().evaluate(e=>e.click());
     await page.waitForTimeout(100);
     await page.screenshot({path:path.join(out,name+'-390-journal-mid.png')});
     await page.waitForTimeout(300);
     await page.screenshot({path:path.join(out,name+'-390-journal-settled.png')});
     await page.locator('[data-action=journal-back]').evaluate(e=>e.click());await page.waitForTimeout(370);
    }
    records.push({name,width,height,theme,motion,hit,errors});
    assert.deepEqual(errors,[]);
    await context.close();
   }
   await b.close();
  }
 }finally{await new Promise(r=>server.close(r))}
 console.log('PHASE2_VISUAL',JSON.stringify({out,records,files:fs.readdirSync(out)}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
