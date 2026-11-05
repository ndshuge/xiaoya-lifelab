const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let loc=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(loc.startsWith('/xiaoya-lifelab/'))loc=loc.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+loc+(loc.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let passed=0,failed=0;
 const check=async(name,fn)=>{try{await fn();console.log('PASS '+name);passed++}catch(e){console.log('FAIL '+name+' '+String(e.stack||e).slice(0,700));failed++}};
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const w of [320,390]){
  const ctx=await browser.newContext({viewport:{width:w,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  const page=await ctx.newPage(),cdp=await ctx.newCDPSession(page);
  await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  await check(w+' real CDP two-finger pinch stays at scale=1',async()=>{
   const point=(x,y,id)=>({x,y,id,radiusX:2,radiusY:2});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(140,340,1),point(205,340,2)]});
   for(let i=0;i<8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(140-i*7,340,1),point(205+i*7,340,2)]});await page.waitForTimeout(12)}
   const during=await page.evaluate(()=>visualViewport?.scale||1);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForTimeout(120);
   const after=await page.evaluate(()=>visualViewport?.scale||1);
   assert.equal(during,1);assert.equal(after,1);
  });
  await check(w+' native single finger scroll and horizontal page swipe remain operable',async()=>{
   const touch=(type,arr)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:arr});
   await touch('touchStart',[{x:260,y:350,id:3}]);
   for(let i=0;i<12;i++){await touch('touchMove',[{x:260-220*(i+1)/12,y:350,id:3}]);await page.waitForTimeout(20)}
   const state=await page.evaluate(()=>({preview:!!document.querySelector('.xy-swipe-preview'),route:document.querySelector('#workspace > .page')?.id}));
   assert.equal(state.route,'page-today');
   assert.equal(state.preview,true);
   await touch('touchEnd',[]);
   await page.waitForFunction(()=>!document.querySelector('.xy-swipe-preview'),{timeout:4500});
   assert.equal(await page.locator('#workspace > .page').getAttribute('id'),'page-items');
  });
  await ctx.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('V59_NATIVE_MULTITOUCH '+passed+'/'+(passed+failed));if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
