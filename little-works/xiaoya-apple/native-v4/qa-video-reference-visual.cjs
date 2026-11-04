const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),output=path.join(root,'docs/qa/evidence/2026-11-05-xiaoya-video-refinement');
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(err,data)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(data))});
(async()=>{fs.mkdirSync(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let files=[];
 try{for(const [name,engine] of [['edge',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='edge'?{headless:true,channel:'msedge'}:{headless:true});
 for(const width of [390,320]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,colorScheme:width===320?'dark':'light'});
  const page=await context.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  async function shot(suffix){const f=name+'-'+width+'-'+suffix+'.png';await page.screenshot({path:path.join(output,f)});files.push(f)}
  await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
  await page.waitForTimeout(110);await shot('items-reveal');await page.waitForTimeout(340);await shot('items-settled');
  await page.locator('#page-items .xy-action-main').evaluate(e=>e.click());
  await page.waitForTimeout(120);await shot('sheet-opening');
  await page.waitForTimeout(330);await shot('sheet-open');
  await page.keyboard.press('Escape');await page.waitForTimeout(320);await shot('sheet-closed');
  assert.deepEqual(errs,[]);assert.equal(await page.locator('#editor').evaluate(e=>e.open),false);
  await context.close();
 }
 await browser.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('VIDEO_VISUAL_EVIDENCE_PASS '+files.length+' screenshots in '+output);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
