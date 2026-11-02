const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const {webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const p=decodeURI(new URL(req.url,'http://local').pathname);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));fs.readFile(f,(e,b)=>{if(e)res.writeHead(404).end('missing');else res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}).end(b)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
let pass=0,fail=0;const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS '+name)}catch(e){fail++;console.log('FAIL '+name+' '+e.message)}};
let browser;
try{browser=await webkit.launch({headless:true});
for(const w of [320,390,768,1440]){
const context=await browser.newContext({viewport:{width:w,height:844},hasTouch:w<=390,reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port+'/little-works/xiaoya-apple/native-v3/',{waitUntil:'networkidle'});
await check('webkit '+w+' correct page and no horizontal overflow',async()=>{
 assert.equal(await page.locator('#workspace h1').innerText(),'今天');
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(size.scroll<=size.viewport+1,JSON.stringify(size));
});
await check('webkit '+w+' no runtime errors',async()=>assert.deepEqual(errors,[]));
await page.locator('[data-view=schedule]:visible').first().click();
await check('webkit '+w+' 24h timeline renders without blank graphics',async()=>{
 assert.equal(await page.locator('.hour-tick').count(),24);
 const style=await page.locator('.day-pill.is-selected strong').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.notEqual(style,'rgba(0, 0, 0, 0)');
 assert.ok(await page.locator('.native-timeline-scroll').evaluate(el=>el.scrollTop)>=350);
});
if(w===390){
 await page.locator('.calendar-add-actions [data-add=course]:visible').click();
 await check('webkit 390 opens touch-friendly course sheet',async()=>assert.equal(await page.locator('#sheet-title').innerText(),'新增课程'));
 await page.keyboard.press('Escape');
 await check('webkit 390 Escape closes sheet',async()=>assert.equal(await page.locator('#editor').evaluate(e=>e.open),false));
 await page.locator('[data-view=goals]:visible').first().click();
 await page.locator('.glass-btn.add-top:visible').tap();
 await check('webkit touch floating action opens goal editor',async()=>assert.equal(await page.locator('#sheet-title').innerText(),'新增目标'));
 await page.keyboard.press('Escape');await page.locator('[data-view=settings]:visible').first().click();
 await check('webkit optical settings switches attach without blanking controls',async()=>{
  assert.equal(await page.locator('lg-switch').count(),4);
  await page.waitForFunction(()=>[...document.querySelectorAll('lg-switch')].every(x=>x.glass),{timeout:5500});
  const switches=await page.locator('lg-switch .lg-refract').evaluateAll(els=>els.map(e=>getComputedStyle(e).filter));
  assert.equal(switches.length,4);
 });
 await check('webkit native checkbox changes persisted setting',async()=>{
  await page.locator('lg-switch[data-setting=quiet] input[type=checkbox]').check();
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().settings.quiet),true);
 });
 }
await context.close();
}
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
console.log('WEBKIT_RESULT '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
