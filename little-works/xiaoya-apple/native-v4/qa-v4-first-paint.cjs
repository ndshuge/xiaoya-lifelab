const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const baseDir='E:/CHATGPT/work/xiaoya-v4-continued-20261103/first-paint';fs.mkdirSync(baseDir,{recursive:true});
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://test').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end('missing'):res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'}).end(b))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});let pass=0,fail=0;
const check=async(n,fn)=>{try{await fn();console.log('PASS '+n);pass++}catch(e){console.log('FAIL '+n+' '+String(e.message||e).slice(0,600));fail++}};
const url='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1';
try{
 for(const reduced of [false,true]){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await ctx.newPage();let release;
  const gate=new Promise(resolve=>release=resolve);
  let observed=false;
  await page.route('**/native-v4/app.mjs*',async route=>{observed=true;await gate;await route.continue()});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'commit'});
   await page.locator('#workspace').waitFor({state:'attached'});
   await page.waitForTimeout(280);
   const before=await page.evaluate(()=>{
    const main=document.querySelector('#workspace'),shell=main?.firstElementChild;
    return {htmlLen:main?.innerHTML.length||0,busy:main?.getAttribute('aria-busy'),title:main?.querySelector('h1')?.innerText?.trim(),skeleton:shell?.classList.contains('xy-boot'),text:main?.innerText?.trim(),height:main?.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth,flashAnimation:shell?getComputedStyle(shell).animationName:'none'};
   });
   await page.screenshot({path:path.join(baseDir,reduced?'first-before-reduced.png':'first-before.png'),fullPage:false});
   await check('slow module first frame shows a purposeful placeholder, motion-reduce='+reduced,()=>{
    assert.equal(observed,true,'app.mjs was not held');
    assert.equal(before.busy,'true');
    assert.equal(before.title,'今天');
    assert.equal(before.skeleton,true);
    assert.ok(before.height>220,'tiny loading region '+before.height);
    assert.equal(before.overflow,0);
    assert.ok(!/电子技术实验|虚构|高等数学/.test(before.text),'fake task data in loading state');
   });
   await check('reduced motion has no skeleton entrance animation, motion-reduce='+reduced,()=>{
    if(reduced)assert.equal(before.flashAnimation,'none');
   });
   release();
   await page.locator('#page-today').waitFor({state:'visible',timeout:8000});
   await page.waitForTimeout(120);
   const after=await page.evaluate(()=>({
    loading:!!document.querySelector('.xy-boot'),
    busy:document.querySelector('#workspace')?.getAttribute('aria-busy'),
    head:document.querySelector('#workspace h1')?.innerText,
    overflow:document.documentElement.scrollWidth-innerWidth,
    nav:document.querySelector('#bottom-nav [data-view=today]')?.classList.contains('is-active')
   }));
   await page.screenshot({path:path.join(baseDir,reduced?'first-after-reduced.png':'first-after.png'),fullPage:false});
   await check('boot replacement is atomic and leaves usable page, motion-reduce='+reduced,()=>{
    assert.equal(after.loading,false);assert.notEqual(after.busy,'true');
    assert.equal(after.head,'今天');assert.equal(after.overflow,0);assert.equal(after.nav,true);
    assert.deepEqual(errors,[]);
   });
  }finally{release();await ctx.close();}
 }
 const failedCtx=await browser.newContext({viewport:{width:390,height:844}});
 try{
  const failedPage=await failedCtx.newPage();
  await failedPage.route('**/native-v4/app.mjs*',route=>route.abort('failed'));
  await failedPage.goto(url,{waitUntil:'domcontentloaded'});
  await failedPage.locator('.xy-boot-error').waitFor({state:'visible',timeout:3000});
  await failedPage.screenshot({path:path.join(baseDir,'first-error.png'),fullPage:false});
  await check('unavailable module gives an honest recoverable error',async()=>{
   await failedPage.locator('.xy-boot-error').waitFor({state:'visible',timeout:3000});
   const state=await failedPage.evaluate(()=>({
    busy:document.querySelector('#workspace')?.getAttribute('aria-busy'),
    message:document.querySelector('.xy-boot-error')?.innerText,
    href:document.querySelector('.xy-boot-error a')?.href,
    blank:document.querySelector('.xy-boot')?.getBoundingClientRect().height
   }));
   assert.equal(state.busy,'false');
   assert.match(state.message,/加载失败|无法载入/);
   assert.ok(state.href.includes('judge=1'),'retry lost judge query '+state.href);
   assert.ok(state.blank>220);
  });
 }finally{await failedCtx.close();}
 const webkitBrowser=await webkit.launch({headless:true});
 try{
  const wkCtx=await webkitBrowser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try{
   const wk=await wkCtx.newPage();let unlock;
   const delayed=new Promise(r=>unlock=r);
   await wk.route('**/native-v4/app.mjs*',async r=>{await delayed;await r.continue()});
   try{
    await wk.goto(url,{waitUntil:'commit'});
    await wk.locator('#workspace').waitFor({state:'attached'});
    await wk.waitForTimeout(180);
    await check('WebKit delayed module shows stable initial content',async()=>{
     assert.equal(await wk.locator('.xy-boot h1').innerText(),'今天');
     assert.equal(await wk.locator('#workspace').getAttribute('aria-busy'),'true');
    });
    unlock();
    await wk.locator('#page-today').waitFor({state:'visible',timeout:8000});
    await check('WebKit restores interactive app and clears loading state',async()=>{
     assert.equal(await wk.locator('#workspace').getAttribute('aria-busy'),'false');
     assert.equal(await wk.locator('.xy-boot').count(),0);
     assert.equal(await wk.locator('.bottom-nav [data-view=today]').isVisible(),true);
    });
   }finally{unlock();}
  }finally{await wkCtx.close();}
 }finally{await webkitBrowser.close();}
}finally{await browser.close();await new Promise(r=>server.close(r))}
console.log('FIRST_PAINT_QA '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});