const {webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const srv=http.createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://local').pathname),prefix='/xiaoya-lifelab';
 if(p.startsWith(prefix+'/'))p=p.slice(prefix.length);
 else if(p===prefix)p='/';
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b));
});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await webkit.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  assert.match(page.url(),/native-v4/);
  assert.deepEqual((await page.locator('.bottom-nav .tab').allTextContents()).map(s=>s.trim()),['今天','事项','发展']);
  await page.locator('#xiaoya-avatar').click();
  assert.equal(await page.locator('#xiaoya-assistant').isVisible(),true);
  await page.locator('#assistant-close').click();
  await page.waitForTimeout(430);
  await page.locator('.bottom-nav [data-view=items]').click();
  assert.equal(await page.locator('#items-schedule').isVisible(),true);
  await page.locator('.bottom-nav [data-view=develop]').click();
  assert.equal(await page.locator('#development-mood').isVisible(),true);
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  console.log('WEBKIT_V4_PASS 7/7 — WebKit simulation; not physical iPhone Safari');
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(r=>srv.close(r))}
})().catch(e=>{console.error('WEBKIT_UNAVAILABLE_OR_FAILED '+String(e.stack||e));process.exitCode=1});
