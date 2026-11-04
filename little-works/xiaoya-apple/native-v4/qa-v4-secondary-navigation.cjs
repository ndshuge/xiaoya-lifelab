const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const type={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let u=new URL(req.url,'http://localhost'),p=decodeURIComponent(u.pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(err,bytes)=>err?res.writeHead(404).end():res.writeHead(200,{'Content-Type':type[path.extname(f)]||'application/octet-stream'}).end(bytes))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});let pass=0,fail=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);pass++}catch(e){console.log('FAIL '+name+' '+String(e.message||e).slice(0,480));fail++}}
try{const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
await page.locator('.bottom-nav [data-view=items]').click();
await check('precondition: items page shows the three-way dock',async()=>{
 assert.equal(await page.locator('#workspace h1').innerText(),'事项');assert.equal(await page.locator('#bottom-nav').isVisible(),true);
});
await page.locator('.topbar .toolbar-actions button').click();
await check('settings is a detail page, not a fourth conflicting dock state',async()=>{
 assert.equal(await page.locator('#workspace h1').innerText(),'设置');assert.equal(await page.locator('#bottom-nav').isVisible(),false);
 const info=await page.locator('.topbar .toolbar-actions button').evaluate(e=>({label:e.getAttribute('aria-label'),to:e.dataset.view,use:e.querySelector('use')?.getAttribute('href'),text:e.textContent.trim()}));
 assert.equal(info.to,'items');assert.equal(info.use,undefined);assert.equal(info.text,'完成');assert.equal(info.label,'完成设置，返回事项');
 assert.equal(await page.locator('.app-frame').evaluate(e=>getComputedStyle(e,'::after').display),'none','detail screen should not retain a phantom dock veil');
});
await check('topbar back returns to the former items screen',async()=>{
 await page.locator('.topbar .toolbar-actions button').click();
 assert.equal(await page.locator('#workspace h1').innerText(),'事项');assert.equal(await page.locator('#bottom-nav').isVisible(),true);
 assert.equal(await page.locator('.bottom-nav .is-active').getAttribute('data-view'),'items');
});
await check('return from settings restores the prior items scroll position',async()=>{
 await page.evaluate(()=>window.scrollTo({top:200,behavior:'instant'}));
 const before=await page.evaluate(()=>window.scrollY);assert.ok(before>40,'precondition: items view scrolls');
 await page.locator('.topbar .toolbar-actions button').click();
 await page.locator('.topbar .toolbar-actions button').click();
 assert.ok(Math.abs((await page.evaluate(()=>window.scrollY))-before)<4,'settings lost items scroll state');
});
await check('develop journal draft survives a visit to settings',async()=>{
 await page.locator('.bottom-nav [data-view=develop]').click();await page.locator('#journal-note').fill('从设置返回后，这条草稿还在');
 await page.locator('.topbar .toolbar-actions button').click();
 assert.equal(await page.locator('#bottom-nav').isVisible(),false);
 await page.locator('.topbar .toolbar-actions button').click();
 assert.equal(await page.locator('#journal-note').inputValue(),'从设置返回后，这条草稿还在');
});
await check('secondary screen transitions remain synchronous without visual clones',async()=>{
 const forward=await page.evaluate(()=>{
   document.querySelector('.topbar .toolbar-actions button').click();
   return {view:document.querySelector('#workspace h1')?.innerText,
     direction:document.documentElement.dataset.xyNavDirection,
     ghosts:document.querySelectorAll('.xy-route-ghost').length};
 });
 assert.equal(forward.view,'设置','route update must be synchronous');
 assert.equal(forward.direction,'forward');
 assert.equal(forward.ghosts,0,'pushed settings must not overlay a cloned old screen');
 const backward=await page.evaluate(()=>{
   document.querySelector('.topbar .toolbar-actions button').click();
   return {view:document.querySelector('#workspace h1')?.innerText,
     direction:document.documentElement.dataset.xyNavDirection,
     ghostCount:document.querySelectorAll('.xy-route-ghost').length};
 });
 assert.equal(backward.view,'发展');
 assert.equal(backward.direction,'backward');
 assert.equal(backward.ghostCount,0,'return navigation must not clone a page');
 await page.waitForTimeout(350);
 assert.equal(await page.locator('.xy-route-ghost').count(),0);
});
await check('settings opens without jump to incorrect dock selection',async()=>{
 await page.locator('.topbar .toolbar-actions button').click();
 const nav=await page.locator('#bottom-nav').evaluate(e=>getComputedStyle(e).display);assert.equal(nav,'none');
 await page.locator('.topbar .toolbar-actions button').click();
 assert.equal(await page.locator('#bottom-nav').evaluate(e=>getComputedStyle(e).display),'grid');
});
await check('desktop sidebar retains direct settings/primary navigation',async()=>{
 await page.setViewportSize({width:1440,height:900});
 await page.locator('.side-bottom [data-view=settings]').click();assert.equal(await page.locator('#workspace h1').innerText(),'设置');
 assert.equal(await page.locator('.side-nav [data-view=develop]').isVisible(),true);
 await page.locator('.side-nav [data-view=develop]').click();assert.equal(await page.locator('#workspace h1').innerText(),'发展');
});
await check('reduced motion has no ghost and preserves immediate back behavior',async()=>{
 const reduced=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 const rp=await reduced.newPage();
 try{
   await rp.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
   const output=await rp.evaluate(()=>{
     document.querySelector('.topbar .toolbar-actions button').click();
     return {page:document.querySelector('#workspace h1')?.textContent,
       ghosts:document.querySelectorAll('.xy-route-ghost').length,
       dock: getComputedStyle(document.querySelector('#bottom-nav')).display};
   });
   assert.equal(output.page,'设置');assert.equal(output.ghosts,0);assert.equal(output.dock,'none');
   await rp.locator('.topbar .toolbar-actions button').click();
   assert.equal(await rp.locator('#workspace h1').innerText(),'今天');
 }finally{await reduced.close()}
});
await check('WebKit detail navigation remains actionable without blocked bottom controls',async()=>{
 const wb=await webkit.launch({headless:true});
 try{
   const wc=await wb.newContext({viewport:{width:390,height:844},hasTouch:true});
   const wp=await wc.newPage();
   try{
     await wp.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
     await wp.locator('.bottom-nav [data-view=develop]').click();
     await wp.locator('.topbar .toolbar-actions button').click();
     assert.equal(await wp.locator('#workspace h1').innerText(),'设置');
     assert.equal(await wp.locator('#bottom-nav').isVisible(),false);
     assert.equal(await wp.locator('.topbar .toolbar-actions button').getAttribute('aria-label'),'完成设置，返回发展');
     await wp.locator('.topbar .toolbar-actions button').click();
     assert.equal(await wp.locator('#workspace h1').innerText(),'发展');
     assert.equal(await wp.locator('#bottom-nav').isVisible(),true);
     assert.equal(await wp.locator('#bottom-nav .tab.is-active').getAttribute('data-view'),'develop');
   }finally{await wc.close()}
 }finally{await wb.close()}
});
await check('Escape dismisses pushed Settings and returns focus to the toolbar',async()=>{
 await page.setViewportSize({width:390,height:844});
 await page.locator('.bottom-nav [data-view=items]').click();
 await page.locator('.topbar .toolbar-actions button').click();
 assert.equal(await page.locator('#workspace h1').innerText(),'设置');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#workspace h1').innerText(),'事项');
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'更多与设置');
});
await check('Escape closes assistant before leaving a pushed screen',async()=>{
 await page.locator('.topbar .toolbar-actions button').click();
 await page.locator('#xiaoya-avatar').click();
 assert.equal(await page.locator('#xiaoya-assistant').isVisible(),true);
 await page.keyboard.press('Escape');
 // The assistant deliberately plays a 300ms exit spring before becoming hidden.
 await page.locator('#xiaoya-assistant').waitFor({state:'hidden',timeout:2500});
 assert.equal(await page.locator('#xiaoya-assistant').isVisible(),false);
 assert.equal(await page.locator('#workspace h1').innerText(),'设置');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#workspace h1').innerText(),'事项');
});
await check('Search shortcut opens a dismissible secondary view',async()=>{
 await page.keyboard.press('/');
 assert.equal(await page.locator('#workspace h1').innerText(),'搜索');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#workspace h1').innerText(),'事项');
});
await check('no console errors',async()=>assert.deepEqual(errors,[]));await ctx.close();
}finally{await browser.close();await new Promise(r=>server.close(r))}
console.log('SECONDARY_NAV '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});