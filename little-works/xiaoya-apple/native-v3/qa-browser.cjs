const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
function server(){return http.createServer((req,res)=>{let name=decodeURI(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));if(!file.startsWith(root)){res.writeHead(403).end('no');return}fs.readFile(file,(err,b)=>{if(err){res.writeHead(404).end('missing '+file);return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(b)})})}
(async()=>{
 const srv=server();await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+srv.address().port+'/little-works/xiaoya-apple/native-v3/';
 const browser=await chromium.launch({channel:'msedge',headless:true});
 let passed=0,failed=0;
 async function check(name,fn){try{await fn();console.log('PASS',name);passed++}catch(e){console.log('FAIL',name,e.message);failed++}}
 try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await check(width+' loads genuine new DOM',async()=>{assert.equal(await page.locator('#workspace h1').textContent(),'今天');assert.equal(await page.locator('.sidebar .nav-item').count(),6);assert.equal(await page.locator('#workspace .page-heading').count(),1)});
  await check(width+' no horizontal overflow',async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1));
  await check(width+' no uncaught JS errors',async()=>assert.deepEqual(errors,[]));
  await check(width+' safe original data namespace',async()=>{assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.store.key()),'xiaoya-comparison:xiaoya-apple:personal:v1')});
  if(width===1440)await check('desktop add button has visible glyph and solid action surface',async()=>{const info=await page.locator('.glass-btn.add-top').evaluate(el=>({display:getComputedStyle(el).display,background:getComputedStyle(el).backgroundColor,stroke:getComputedStyle(el).color,svg:!!el.querySelector('use[href="#ic-plus"]'),accent:getComputedStyle(document.documentElement).getPropertyValue('--accent'),bgDecl:[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules].filter(r=>r.cssText.includes('.glass-btn.add-top')).map(r=>r.cssText.slice(0,260))}catch{return []}}).slice(0,2)}));console.log('DESKTOP_ADD',JSON.stringify(info));assert.notEqual(info.display,'none');assert.equal(info.svg,true);assert.notEqual(info.background,'rgba(0, 0, 0, 0)');});
  if(width===390)await check('mobile quick add lives in top toolbar, not above content',async()=>{const s=await page.evaluate(()=>({top:getComputedStyle(document.querySelector('.glass-btn.add-top')).display,floating:getComputedStyle(document.querySelector('.floating-add')).display,target:document.querySelector('.glass-btn.add-top').getBoundingClientRect().width}));assert.notEqual(s.top,'none');assert.equal(s.floating,'none');assert.ok(s.target>=40);});
  if(width===390)await check('mobile last content remains reachable above fixed dock',async()=>{const result=await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.documentElement.scrollHeight);const button=document.querySelector('#workspace .section:last-child');const dock=document.querySelector('.bottom-nav');return {buttonBottom:button?.getBoundingClientRect().bottom,dockTop:dock?.getBoundingClientRect().top,scrollY,scrollHeight:document.documentElement.scrollHeight}});console.log('MOBILE_LAST_ROW',JSON.stringify(result));assert.ok(result.buttonBottom<=result.dockTop-8);await page.evaluate(()=>window.scrollTo(0,0));});
  if(width===390||width===1440){
   await page.evaluate(()=>document.querySelector('#toast').classList.remove('show'));await page.screenshot({path:path.join(__dirname,'shot-empty-'+width+'.png'),fullPage:true,animations:'disabled'});
   await page.locator('[data-view="settings"]:visible').first().click();
   await page.locator('[data-action="mode"]').click();
   await check(width+' synthetic demo safely isolated',async()=>assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'demo'));
   await page.locator('[data-view="settings"]:visible').first().click();
   await check(width+' native optics rendered in settings',async()=>assert.equal(await page.locator('lg-switch[data-setting]').count(),4));
   await page.evaluate(()=>document.querySelector('#toast').classList.remove('show'));await page.screenshot({path:path.join(__dirname,'shot-settings-'+width+'.png'),fullPage:true,animations:'disabled'});
   await page.locator('[data-view="today"]:visible').first().click();
   await page.evaluate(()=>document.querySelector('#toast').classList.remove('show'));await page.screenshot({path:path.join(__dirname,'shot-today-'+width+'.png'),fullPage:true,animations:'disabled'});
   await page.locator('[data-view="schedule"]:visible').first().click();
   await check(width+' calendar has native-style hourly timeline',async()=>{assert.equal(await page.locator('.hour-tick').count(),24);assert.ok(await page.locator('.native-timeline-scroll').evaluate(el=>el.scrollTop)>=360)});
   await check(width+' selected day is legible',async()=>{const a=await page.locator('.day-pill.is-selected strong').evaluate(el=>({text:el.textContent,color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor,rect:el.getBoundingClientRect().toJSON()}));console.log('SELECTED_DAY',width,JSON.stringify(a));assert.ok(Number(a.text)>0);assert.notEqual(a.color,a.bg);});
   await page.evaluate(()=>document.querySelector('#toast').classList.remove('show'));await page.screenshot({path:path.join(__dirname,'shot-calendar-'+width+'.png'),fullPage:true,animations:'disabled'});
  }
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 await check('task add in native dialog',async()=>{
  await page.locator('.glass-btn.add-top:visible').click();await page.locator('input[name=title]').fill('测试任务 · 微电子');await page.locator('#sheet-body .sheet-save').click();
  assert.equal((await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks)).length,1);
  assert.match(await page.locator('#workspace').innerText(),/测试任务/);
 });
 await check('task mark complete and reverse',async()=>{await page.locator('[data-toggle=task]').first().click();assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks[0].done),true);await page.locator('[data-view=tasks]:visible').first().click();await page.locator('[data-toggle=task]').first().click();assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks[0].done),false)});
 await check('task edit',async()=>{await page.locator('[data-edit=task]').first().click();await page.locator('input[name=title]').fill('测试任务 · 改名');await page.locator('.sheet-save').click();assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks[0].title),'测试任务 · 改名')});
 await check('task delete with explicit user confirmation',async()=>{page.once('dialog',d=>d.accept());await page.locator('[data-edit=task]').first().click();await page.locator('[data-delete=task]').click();assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks.length),0)});
 await check('goal create then checkin',async()=>{
  await page.locator('[data-view=goals]:visible').first().click();await page.locator('.glass-btn.add-top:visible').click();
  await page.locator('input[name=title]').fill('练琴');await page.locator('.sheet-save').click();
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().goals.length),1);
  await page.locator('[data-checkin]').first().click();await page.locator('textarea[name=note]').fill('完整练习 20 分钟');await page.locator('.sheet-save').click();
  assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().checkins.length),1)
 });
 await check('review displays actual checkin',async()=>{await page.locator('[data-view=review]:visible').first().click();assert.match(await page.locator('#workspace').innerText(),/完整练习 20 分钟/)});
 await check('settings and mode isolation',async()=>{await page.locator('[data-view=settings]:visible').first().click();await page.locator('[data-action=mode]').click();assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'demo');assert.ok((await page.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks)).length>0);await page.locator('[data-view=settings]:visible').first().click();await page.locator('[data-action=mode]').click();assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getData().goals.length),1)});
 await check('interactive flows do not throw',async()=>assert.deepEqual(errors,[]));
 await context.close();
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
 console.log('RESULT',passed+'/'+(passed+failed),'passed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
