// End-to-end verification of the original contest Pages URL and all four editions.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'..');
const contentTypes={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://local').pathname);
 const prefix='/xiaoya-lifelab';
 if(name===prefix)name='/';
 else if(name.startsWith(prefix+'/'))name=name.slice(prefix.length);
 const file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end('forbidden');
 fs.readFile(file,(err,data)=>err?res.writeHead(404).end('missing '+name):res.writeHead(200,{'content-type':contentTypes[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/';
 const browser=await chromium.launch({channel:'msedge',headless:true});
 let pass=0,fail=0;
 const check=async(label,fn)=>{try{await fn();pass++;console.log('PASS',label)}catch(e){fail++;console.error('FAIL',label,e.message)}};
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const page=await ctx.newPage(),bad=[],failedResources=[];
  page.on('pageerror',e=>bad.push(e.message));
  page.on('response',r=>{if(r.status()===404)failedResources.push(r.url())});
  await check('contest URL opens the bundled native V3, not the galaxy repository',async()=>{
   await page.goto(base+'?judge=1',{waitUntil:'networkidle'});
   assert.match(page.url(),/\/xiaoya-lifelab\/little-works\/xiaoya-apple\/native-v3\/\?judge=1/);
   assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'demo');
   assert.ok(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks.length)>=2);
  });
  await check('small version menu opens on iPhone-sized viewport',async()=>{
   const trigger=page.locator('#xiaoya-version-trigger');
   await trigger.click();
   assert.equal(await trigger.getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('#xiaoya-version-list').isVisible(),true);
   assert.equal(await page.locator('#xiaoya-version-list nav a').count(),4);
   assert.ok(await page.locator('#xiaoya-version-list [aria-current=page]').count()===1);
   if(process.env.XIAOYA_SCREENSHOT_DIR){fs.mkdirSync(process.env.XIAOYA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.XIAOYA_SCREENSHOT_DIR,'native-menu-mobile.png')})}
  });
  await check('switch to classic edition keeps original source accessible',async()=>{
   await page.locator('#xiaoya-version-list nav a').filter({hasText:'经典原版'}).click();
   await page.waitForLoadState('networkidle');
   assert.match(page.url(),/\/xiaoya-lifelab\/original\.html\?judge=1/);
   assert.equal(await page.locator('#xiaoya-version-trigger').isVisible(),true);
   assert.ok((await page.locator('body').innerText()).includes('小芽'));
  });
  await check('earlier Apple edition also runs under the canonical repo',async()=>{
   await page.goto(base+'little-works/xiaoya-apple/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('#xiaoya-version-trigger').isVisible(),true);
   assert.ok(await page.locator('body').innerText().then(t=>t.length>100));
  });
  await check('Pro edition is retained and offers the version menu',async()=>{
   await page.goto(base+'pro/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('#xiaoya-version-trigger').isVisible(),true);
   assert.match(page.url(),/\/xiaoya-lifelab\/pro\//);
  });
  await check('version library has four working entry points',async()=>{
   await page.goto(base+'versions/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('.version-card').count(),4);
   await page.locator('#version-native').click();
   assert.match(page.url(),/\/xiaoya-lifelab\/little-works\/xiaoya-apple\/native-v3\//);
  });
  await check('original direct entry still supported with edition=original',async()=>{
   await page.goto(base+'?edition=original&judge=1',{waitUntil:'networkidle'});
   assert.match(page.url(),/original\.html\?judge=1/);
   assert.equal(await page.locator('#xiaoya-version-trigger').isVisible(),true);
  });
  await check('no missing resources, no runtime errors, no mobile horizontal scrolling',async()=>{
   assert.deepEqual(failedResources,[]);
   assert.deepEqual(bad,[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
  await ctx.close();
  if(process.env.XIAOYA_SCREENSHOT_DIR){
   const wide=await browser.newContext({viewport:{width:1440,height:900}}),wp=await wide.newPage();
   await wp.goto(base+'versions/',{waitUntil:'networkidle'});
   await wp.screenshot({path:path.join(process.env.XIAOYA_SCREENSHOT_DIR,'versions-desktop.png'),fullPage:true});
   await wp.goto(base+'?judge=1',{waitUntil:'networkidle'});
   await wp.locator('#xiaoya-version-trigger').click();
   await wp.screenshot({path:path.join(process.env.XIAOYA_SCREENSHOT_DIR,'native-menu-desktop.png')});
   await wide.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('VERSIONS_E2E',pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
