const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const repo=path.resolve(__dirname,'../../..');
const original=path.resolve('E:/CHATGPT/projects/_xiaoya_v4_five_moods_20261104');
const evidence=path.join(repo,'docs','qa','evidence','2026-11-04-xiaoya-living-motion');
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),u=decodeURIComponent(url.pathname);
 const originalMode=u.startsWith('/original/'),base=originalMode?original:repo;
 const relative=u.slice(originalMode?'/original/'.length:'/vnext/'.length);
 if(!originalMode&&!u.startsWith('/vnext/'))return res.writeHead(404).end();
 const f=path.resolve(base,relative);
 if(!(f===base||f.startsWith(base+path.sep)))return res.writeHead(403).end();
 fs.readFile(f,(error,bytes)=>error?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(bytes));
});
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const captures=[];
 try{
  for(const kind of ['original','vnext']){
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/'+kind+'/little-works/xiaoya-apple/native-v4/index.html?judge=1',{waitUntil:'networkidle'});
   await page.screenshot({path:path.join(evidence,kind+'-today-390.png')});
   await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
   await page.waitForTimeout(200);
   const scroller=page.locator('.native-timeline-scroll');
   if(await scroller.count()){await scroller.evaluate(e=>e.scrollTop=210);await page.waitForTimeout(60)}
   await page.screenshot({path:path.join(evidence,kind+'-timeline-390.png')});
   if(kind==='vnext'){
    const b=await page.locator('.xy-timeline-scrub').boundingBox();assert.ok(b&&b.height>200);
    await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
    await page.screenshot({path:path.join(evidence,'vnext-timeline-dark-reduced-390.png')});
   }
   captures.push({kind,errors,hasThumb:await page.locator('.xy-timeline-thumb').count()});
   assert.deepEqual(errors,[]);
   await context.close();
  }
  const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const p=await ctx.newPage();
  await p.goto(base+'/vnext/little-works/xiaoya-apple/native-v4/index.html?judge=1',{waitUntil:'networkidle'});
  await p.locator('.side-nav [data-view=items]').evaluate(e=>e.click());
  await p.waitForTimeout(150);
  await p.screenshot({path:path.join(evidence,'vnext-timeline-1440.png')});
  await ctx.close();
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
 console.log('VISUAL_EVIDENCE',JSON.stringify({captures,evidence,files:fs.readdirSync(evidence)}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
