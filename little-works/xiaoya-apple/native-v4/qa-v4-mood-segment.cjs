const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const repo=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://host').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';const file=path.resolve(repo,'.'+p+(p.endsWith('/')?'index.html':''));if(!file.startsWith(repo+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,d)=>e?res.writeHead(404).end('missing '+p):res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(d))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});let passed=0,failed=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);passed++}catch(e){console.log('FAIL '+name+' '+String(e.message||e).slice(0,500));failed++}}
try{
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:true});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  await page.locator('#bottom-nav [data-view=develop]').click();await page.locator('#page-develop').waitFor();
  await check(width+' mood choices live in a single flat grouped control',async()=>{
   assert.equal(await page.locator('.v4-mood-picker[role=group]').count(),1);
   assert.equal(await page.locator('.v4-mood-option').count(),5);
   const css=await page.locator('.v4-mood-picker').evaluate(el=>{
    const first=getComputedStyle(el.querySelector('button'));
    return {container:getComputedStyle(el).backgroundColor,first:first.backgroundColor,border:first.borderTopWidth,radius:first.borderRadius,indicator:getComputedStyle(el,'::before').content};
   });
   assert.match(css.container,/rgb/);assert.equal(css.first,'rgba(0, 0, 0, 0)');assert.equal(css.border,'0px');assert.notEqual(css.indicator,'none');
  });
  await check(width+' accessible mood button targets and labels',async()=>{
   const controls=await page.locator('.v4-mood-option').evaluateAll(nodes=>nodes.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,label:el.innerText,pressed:el.getAttribute('aria-pressed')})));
   assert.equal(controls.length,5);assert.ok(controls.every(x=>x.w>=44&&x.h>=44&&x.label));
  });
  await check(width+' mood indicator moves without moving hitboxes',async()=>{
   const before=await page.locator('.v4-mood-option').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width})));
   await page.locator('[data-mood="1"]').click();await page.locator('[data-mood="5"]').click();await page.waitForTimeout(500);
   const after=await page.locator('.v4-mood-option').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width})));
   assert.deepEqual(after,before,'mood control hitboxes shifted');
   assert.equal(await page.locator('.v4-mood-option.is-active').getAttribute('data-mood'),'5');
   const m=await page.locator('.v4-mood-picker').evaluate(e=>getComputedStyle(e,'::before').transform);
   assert.notEqual(m,'none');
  });
  await check(width+' unsaved mood is clearly signalled and remains selected on tab return',async()=>{
   await page.locator('[data-mood="4"]').click();
   assert.match(await page.locator('#journal-status').innerText(),/未保存/);
   await page.locator('#bottom-nav [data-view=today]').click();
   await page.locator('#bottom-nav [data-view=develop]').click();await page.locator('#page-develop').waitFor();
   assert.equal(await page.locator('.v4-mood-option.is-active').getAttribute('data-mood'),'4');
   assert.match(await page.locator('#journal-status').innerText(),/未保存/);
   await page.locator('[data-mood="5"]').click();
  });
  await check(width+' journal saves and restores mood and note across navigation',async()=>{
   const note='苹果设计审计记录 - 记录与目标不能丢失';
   await page.locator('#journal-note').fill(note);await page.locator('#journal-save').click();
   await page.locator('#bottom-nav [data-view=today]').click();
   await page.locator('#bottom-nav [data-view=develop]').click();await page.locator('#page-develop').waitFor();
   assert.equal(await page.locator('#journal-note').inputValue(),note);
   assert.equal(await page.locator('.v4-mood-option.is-active').getAttribute('data-mood'),'5');
   assert.equal(await page.locator('[data-mood="5"]').getAttribute('aria-pressed'),'true');
  });
  await check(width+' no overflow or runtime errors',async()=>{
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  });
  await ctx.close();
 }
 const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const pg=await reduced.newPage();await pg.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await pg.locator('#bottom-nav [data-view=develop]').click();await pg.locator('#page-develop').waitFor();
 await check('reduced motion removes mood indicator travel',async()=>{
  const duration=await pg.locator('.v4-mood-picker').evaluate(e=>getComputedStyle(e,'::before').transitionDuration);
  assert.ok(duration==='0s'||duration==='1e-06s',duration);
 });
 await reduced.close();
}finally{await browser.close();await new Promise(r=>server.close(r))}
console.log('MOOD_APPLE_QA '+passed+'/'+(passed+failed));if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
