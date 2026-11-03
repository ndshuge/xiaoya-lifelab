const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let u=new URL(req.url,'http://local'),p=decodeURIComponent(u.pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(err,b)=>err?res.writeHead(404).end('missing '+p):res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'}).end(b))
});
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
let good=0,bad=0,ctx;async function check(name,fn){try{await fn();console.log('PASS '+name);good++}catch(e){console.log('FAIL '+name+' '+String(e.message||e).slice(0,720));bad++}}
const url='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1';
try{
ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url,{waitUntil:'networkidle'});
await check('test can emulate a visual viewport keyboard occlusion',async()=>{
 const result=await page.evaluate(()=>{
   const v=window.visualViewport;const height=v.height;
   const own=Object.getOwnPropertyDescriptor(v,'height');
   Object.defineProperty(v,'height',{configurable:true,get:()=>window.__xySimVisualHeight??height});
   window.__xySimVisualHeight=410;
   v.dispatchEvent(new Event('resize'));
   return {actual:v.height,original:height,ownDescriptor:!!own};
 });
 assert.ok(result.original>700);assert.equal(result.actual,410);
});
await check('without editing the floating dock stays available',async()=>{
 await page.evaluate(()=>{window.__xySimVisualHeight=844;window.visualViewport.dispatchEvent(new Event('resize'))});
 const v=await page.locator('#bottom-nav').evaluate(e=>getComputedStyle(e).visibility);
 assert.notEqual(v,'hidden');
});
await check('assistant input remains visible above simulated keyboard and dock gets out of the way',async()=>{
 await page.locator('#xiaoya-avatar').click();
 await page.locator('#assistant-input').focus();
 await page.waitForTimeout(420);
 const idleBottom=await page.locator('.assistant-panel').evaluate(e=>parseFloat(getComputedStyle(e).bottom));
 assert.ok(idleBottom>=60,'assistant was repositioned before the keyboard actually appeared: '+idleBottom);
 const idleDock=await page.locator('#bottom-nav').evaluate(e=>getComputedStyle(e).pointerEvents);
 assert.notEqual(idleDock,'none','Dock hidden before keyboard appears leaves a blank gap below the floating assistant');
 await page.evaluate(()=>{window.__xySimVisualHeight=410;window.visualViewport.dispatchEvent(new Event('resize'))});
 await page.waitForTimeout(50);
 const a=await page.evaluate(()=>{
   const form=document.querySelector('#assistant-form').getBoundingClientRect();
   const panel=document.querySelector('.assistant-panel').getBoundingClientRect();
   const dock=getComputedStyle(document.querySelector('.bottom-nav'));
   return {formBottom:form.bottom,panelBottom:panel.bottom,visualBottom:window.visualViewport.height+window.visualViewport.offsetTop,
     dockVisibility:dock.visibility,dockPointer:dock.pointerEvents,editing:document.body.classList.contains('xy-viewport-editing'),active:document.activeElement?.id,cssBottom:getComputedStyle(document.documentElement).getPropertyValue('--xy-visual-bottom-inset'),vvHeight:window.visualViewport.height,innerHeight:window.innerHeight,offsetTop:window.visualViewport.offsetTop,windowHeight:getComputedStyle(document.documentElement).getPropertyValue('--xy-visual-height'),anim:document.querySelector('.assistant-panel')?.getAnimations().map(a=>a.playState)};
 });
 assert.ok(a.editing,'editing flag missing '+JSON.stringify(a));
 assert.equal(a.dockPointer,'none','dock should not receive taps while keyboard is shown');
 assert.ok(a.panelBottom<=a.visualBottom+8,'assistant panel covered by keyboard '+JSON.stringify(a));
 assert.ok(a.formBottom<=a.visualBottom+8,'chat composer covered by keyboard '+JSON.stringify(a));
});
await check('closing assistant and restoring viewport reveals stable dock',async()=>{
 await page.locator('#assistant-close').click();await page.waitForTimeout(350);
 await page.evaluate(()=>{window.__xySimVisualHeight=844;window.visualViewport.dispatchEvent(new Event('resize'))});
 await page.waitForTimeout(50);
 const info=await page.evaluate(()=>({editing:document.body.classList.contains('xy-viewport-editing'),
   pointer:getComputedStyle(document.querySelector('.bottom-nav')).pointerEvents}));
 assert.equal(info.editing,false);assert.notEqual(info.pointer,'none');
});
await check('modal editor moves within visible viewport on simulated keyboard',async()=>{
 await page.locator('#bottom-nav [data-view=items]').click();
 await page.locator('.v4-item-segments [data-items-tab=inbox]').click();
 await page.locator('#items-undated [data-add=task]').click();
 await page.locator('#fld-title').focus();
 await page.evaluate(()=>{window.__xySimVisualHeight=410;window.visualViewport.dispatchEvent(new Event('resize'))});
 await page.waitForTimeout(70);
 const info=await page.evaluate(()=>{
 const sheet=document.querySelector('#editor').getBoundingClientRect();
 return {bottom:sheet.bottom,visual:window.visualViewport.height+window.visualViewport.offsetTop,editing:document.body.classList.contains('xy-viewport-editing')};
 });
 assert.ok(info.editing);assert.ok(info.bottom<=info.visual+10,JSON.stringify(info));
});
await check('keyboard focus still saves task without UI errors',async()=>{
 await page.locator('#fld-title').fill('键盘空间测试');
 await page.locator('#sheet-save').click();
 await page.evaluate(()=>{window.__xySimVisualHeight=844;window.visualViewport.dispatchEvent(new Event('resize'))});
 await page.waitForTimeout(60);assert.equal(await page.locator('#editor').evaluate(e=>e.open),false);
 assert.deepEqual(errors,[]);
});
await check('desktop editing never hides sidebar navigation',async()=>{
 const desktop=await browser.newContext({viewport:{width:1440,height:900}});
 try{
  const tab=await desktop.newPage();await tab.goto(url,{waitUntil:'networkidle'});
  await tab.locator('.side-bottom [data-view=settings]').click();
  await tab.locator('input[data-semester=name]').focus();
  await tab.waitForTimeout(50);
  const info=await tab.evaluate(()=>({editing:document.body.classList.contains('xy-viewport-editing'),
   keyboard:document.body.classList.contains('xy-keyboard-occluded'),
   side:getComputedStyle(document.querySelector('.sidebar')).display}));
  assert.equal(info.editing,false);assert.equal(info.keyboard,false);assert.notEqual(info.side,'none');
 }finally{await desktop.close()}
});
}finally{if(ctx)await ctx.close();await browser.close();await new Promise(r=>server.close(r))}
console.log('VIEWPORT_KEYBOARD_QA '+good+'/'+(good+bad));if(bad)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
