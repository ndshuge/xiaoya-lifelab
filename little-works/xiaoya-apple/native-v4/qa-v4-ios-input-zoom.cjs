// Native V4 mobile-input audit; computed CSS only, not a physical iPhone Safari claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b));
});
const editable='input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]),textarea,select';
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await webkit.launch({headless:true});let pass=0,fail=0;
 async function check(title,fn){try{await fn();pass++;console.log('PASS',title)}catch(e){fail++;console.log('FAIL',title,String(e.message).slice(0,560))}}
 async function audit(page,label){
   await check(label+' visible fields >=16px',async()=>{
     const fields=await page.locator(editable).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>({id:n.id||n.name||n.type,fontSize:getComputedStyle(n).fontSize})));
     assert.ok(fields.length>0,'no visible fields');
     assert.deepEqual(fields.filter(f=>parseFloat(f.fontSize)<16),[],'zoom-prone fields: '+JSON.stringify(fields));
   });
 }
 try{
 for(const width of [320,390]){
   const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
   const page=await ctx.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
   await check(width+' fixed-scale mobile app mode',async()=>{
     const meta=await page.locator('meta[name=viewport]').getAttribute('content');
     assert.match(meta,/maximum-scale\s*=\s*1/);
     assert.match(meta,/user-scalable\s*=\s*no/);
   });
   await page.locator('.topbar .toolbar-actions button').click();
   await audit(page,width+' settings');
   await page.locator('.topbar .toolbar-actions button').click();
   await page.locator('.bottom-nav [data-view=items]').click();
   await page.locator('[data-items-tab=inbox]').click();
   await page.locator('[data-action=add-task]').click();
   await audit(page,width+' task sheet');
   await page.keyboard.press('Escape');
   await page.keyboard.press('/');
   await audit(page,width+' search');
   await page.locator('#xiaoya-avatar').click();
   await audit(page,width+' assistant');
   await page.locator('#assistant-config-toggle').click();
   await audit(page,width+' assistant API settings');
   await check(width+' assistant buttons meet 44px hit height',async()=>{
     const ids=['assistant-config-toggle','assistant-close','assistant-verify','assistant-disconnect','assistant-send'];
     const info=await page.locator(ids.map(x=>'#'+x).join(',')).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({id:n.id,height:n.getBoundingClientRect().height})));
     assert.deepEqual(info.filter(x=>x.height<44),[],'small controls: '+JSON.stringify(info));
   });
   await check(width+' mobile content fits width',async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)));
   await ctx.close();
 }
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('V4_IOS_FOCUS '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
