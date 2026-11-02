// Regression: prevent involuntary Safari focus zoom while retaining user pinch zoom.
// The headless WebKit zoom simulator is not a physical iPhone; computed font and touch-action checks are authoritative.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':"image/webp"};
const server=http.createServer((req,res)=>{
 let p=decodeURI(new URL(req.url,'http://localhost').pathname);
 let f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root)){res.writeHead(403).end('forbidden');return}
 fs.readFile(f,(err,bytes)=>err?res.writeHead(404).end('missing'):res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'}).end(bytes));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await webkit.launch({headless:true});
 let fail=0,pass=0;
 const check=async(label,fn)=>{try{await fn();pass++;console.log('PASS',label)}catch(e){fail++;console.log('FAIL',label,e.message)}};
 const selector='input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]),textarea,select';
 try{
 for(const width of [320,390]){
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/little-works/xiaoya-apple/native-v3/',{waitUntil:'networkidle'});
 await check(width+' viewport permits user zoom',async()=>{
  const meta=await page.locator('meta[name=viewport]').getAttribute('content');
  assert.match(meta,/width=device-width/);assert.doesNotMatch(meta,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\D|$)/i);
 });
 const checkControls=async(label)=>{
  await check(width+' '+label+' input sizes >=16',async()=>{
   const fields=await page.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({name:n.getAttribute('name')||n.id||n.tagName,type:n.type||'',size:getComputedStyle(n).fontSize})));
   const tooSmall=fields.filter(f=>parseFloat(f.size)<16);
   console.log('AUDIT_FIELDS',label,JSON.stringify(fields));
   assert.ok(fields.length,label+' has no visible controls');assert.deepEqual(tooSmall,[],label+' has zoom-triggering text fields');
  });
 };
 await page.locator('[data-view=settings]:visible').first().tap();
 await checkControls('settings');
 await page.locator('[data-action=search]:visible').first().tap();
 await checkControls('search');
 await page.locator('.glass-btn.add-top:visible').tap();
 await checkControls('task sheet');
 await page.keyboard.press('Escape');
 await page.locator('[data-view=goals]:visible').first().tap();
 await page.locator('.glass-btn.add-top:visible').tap();
 await checkControls('goal sheet');
 await page.keyboard.press('Escape');
 await page.locator('[data-view=schedule]:visible').first().tap();
 await page.locator('.calendar-add-actions [data-add=course]:visible').tap();
 await checkControls('course sheet');
 await page.keyboard.press('Escape');
 await check(width+' double-tap guard preserves pinch-zoom compatibility',async()=>{
   const control=await page.locator('.tab:visible').first().evaluate(el=>getComputedStyle(el).touchAction);
   const field=await page.locator('.calendar-add-actions [data-add=event]:visible').evaluate(el=>getComputedStyle(el).touchAction);
   const sheet=await page.locator('html').evaluate(el=>getComputedStyle(el).touchAction);
   console.log('TOUCH_ACTIONS',JSON.stringify({control,field,sheet}));
   assert.equal(control,'manipulation');assert.equal(field,'manipulation');
   assert.notEqual(sheet,'none');
 });
 await check(width+' no runtime JS errors',async()=>assert.deepEqual(errors,[]));
 await context.close();
 }
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('FOCUS_ZOOM_RESULT',pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
