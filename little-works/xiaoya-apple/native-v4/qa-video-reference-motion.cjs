const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,d)=>e?res.writeHead(404).end('missing'):res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(d))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let n=0,fail=0;
 const run=async(name,fn)=>{n++;try{await fn();console.log('PASS',name)}catch(e){fail++;console.error('FAIL',name,String(e.message||e).slice(0,900))}};
 try{for(const [engineName,engine] of [['Edge',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(engineName==='Edge'?{channel:'msedge',headless:true}:{headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(3000);
 await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await run(engineName+' reference video 4.6-5.1s: incoming content reveals in a stagger',async()=>{
   await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
   const r=await page.locator('#workspace .page').evaluate(e=>{
     const host=e.querySelector('.v4-items')||e;const blocks=Array.from(host.children).slice(0,5);
     return {blocks:blocks.length,anims:blocks.flatMap(c=>c.getAnimations().filter(a=>a.id==='xy-video-stagger')).map(a=>({id:a.id,frames:a.effect.getKeyframes()}))};
   });
   assert.ok(r.blocks>=2,'expected real page content');assert.ok(r.anims.length>=2,'content must reveal in separate layers');
   assert.ok(r.anims.some(a=>a.frames.some(k=>k.opacity!==undefined&&Number(k.opacity)<.9)));
 });
 await run(engineName+' reference video layered home and growth routes',async()=>{
   for(const [route,selector] of [['today','.dayflow-home'],['develop','.v4-development']]){
      await page.locator('.bottom-nav [data-view='+route+']').evaluate(e=>e.click());
      const count=await page.locator(selector).evaluate(e=>Array.from(e.children).filter(x=>x.getAnimations().some(a=>a.id==='xy-video-stagger')).length);
      assert.ok(count>=2,'expected layered reveal for '+route+', got '+count);
   }
   await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
 });
 await run(engineName+' reference video 26.5-27.3s: normal sheet rises with safe fixed hitboxes',async()=>{
   await page.waitForTimeout(380);
   await page.locator('#page-items .xy-action-main').evaluate(e=>e.click());
   assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
   const state=await page.locator('#editor').evaluate(d=>{
      const frame=d.querySelector('.sheet-frame');const a=frame.getAnimations().find(x=>x.id==='xy-video-sheet');
      const rect=frame.getBoundingClientRect();
      return {frames:a?.effect?.getKeyframes()||[],rect:{w:rect.width,h:rect.height},backdrop:getComputedStyle(d,'::backdrop').animationName};
   });
   assert.ok(state.frames.some(k=>String(k.clipPath||'').startsWith('inset(100%')),'sheet should reveal upward, not only fade');
   assert.ok(state.frames.some(k=>String(k.clipPath||'').startsWith('inset(0')),'sheet should settle fully visible');
   assert.ok(state.backdrop.includes('xy-video-backdrop'),'background should visibly dim with sheet');
   assert.ok(state.rect.w>200&&state.rect.h>70,'real sheet hit area must remain final size');
   const anchor=await page.locator('#editor').evaluate(d=>{const r=d.getBoundingClientRect(),s=getComputedStyle(d);return {bottom:r.bottom,viewport:innerHeight,top:r.top,height:r.height,position:s.position,cssTop:s.top,cssBottom:s.bottom,marginTop:s.marginTop,marginBottom:s.marginBottom}});
   console.log('VIDEO_SHEET_GEOMETRY',engineName,JSON.stringify(anchor));
   assert.ok(Math.abs(anchor.bottom-anchor.viewport)<=20,'dialog must remain anchored at the viewport bottom');
   const frameBottom=await page.locator('#editor .sheet-frame').evaluate(e=>e.getBoundingClientRect().bottom);
   assert.ok(Math.abs(frameBottom-anchor.viewport)<=20,'visible sheet frame must touch viewport bottom without a transparent gap');
   await page.keyboard.press('Escape');await page.waitForTimeout(360);
   assert.equal(await page.locator('#editor').evaluate(e=>e.open),false);
 });
 await run(engineName+' video sheet quick dismissal never leaves ghost or disabled input',async()=>{
   await page.locator('#page-items .xy-action-main').evaluate(e=>e.click());
   await page.keyboard.press('Escape');await page.waitForTimeout(350);
   assert.equal(await page.locator('#editor').evaluate(e=>e.open),false);
   assert.equal(await page.locator('.xy-route-ghost').count(),0);
   await page.locator('#page-items .xy-action-main').evaluate(e=>e.click());
   assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
   await page.keyboard.press('Escape');await page.waitForTimeout(350);
 });
 await run(engineName+' reduced motion has immediate page and sheet no animation',async()=>{
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.locator('.bottom-nav [data-view=develop]').evaluate(e=>e.click());
   assert.equal(await page.locator('#workspace .page').evaluate(e=>e.getAnimations().length),0);
   await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
   await page.locator('#page-items .xy-action-main').evaluate(e=>e.click());
   assert.equal(await page.locator('#editor .sheet-frame').evaluate(e=>e.getAnimations().length),0);
   await page.keyboard.press('Escape');await page.waitForTimeout(150);
   await page.emulateMedia({reducedMotion:'no-preference'});
 });
 await run(engineName+' preserves Dock and Agent integrity',async()=>{
   assert.equal(await page.locator('.bottom-nav [data-view]').count(),3);
   assert.equal(await page.locator('#xy-student-agent').count(),0);
   await page.locator('.bottom-nav [data-view=today]').evaluate(e=>e.click());
   assert.ok(await page.locator('#xy-student-agent').count());
   assert.deepEqual(errors,[]);
 });
 await ctx.close();await browser.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('VIDEO_REFERENCE '+(n-fail)+'/'+n);if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
