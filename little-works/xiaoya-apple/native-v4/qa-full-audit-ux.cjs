/* Accessibility and overlay regressions, derived from full V4 screen inventory (2026-11-03).
   No external models/keys, no persistent modifications outside isolated browser context. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://h').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});let passed=0,failed=0;let context;
async function check(name,fn){try{await fn();console.log('PASS '+name);passed++}catch(e){console.log('FAIL '+name+' '+String(e.message||e).slice(0,410));failed++}}
try{
context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(4000);
const base='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1';
await page.goto(base,{waitUntil:'networkidle'});
await page.locator('.bottom-nav [data-view=items]').click();
await page.locator('.v4-item-segments [data-items-tab=inbox]').click();
const trigger=page.locator('[data-action=add-task]');
await trigger.click();
await check('sheet action targets meet 44px touch size',async()=>{
 for(const sel of ['.sheet-cancel','#sheet-save']){const box=await page.locator(sel).boundingBox();assert.ok(box.height>=44&&box.width>=44,sel+' '+JSON.stringify(box))}
});
await check('sheet opens with first real input focused',async()=>{
 await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.activeElement?.id),'fld-title');
});
await check('Escape closes editor and restores trigger focus',async()=>{
 await page.keyboard.press('Escape');await page.locator('#editor').evaluate(e=>{if(e.open)throw Error('modal remained open')});
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-action')),'add-task');
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'','closing with Escape must unlock document scroll');
});
await trigger.click();await page.locator('#fld-title').fill('检查临时提示的位置');
await page.locator('#sheet-save').click();
await check('success Toast floats above dock without covering tab icons',async()=>{
 const box=await page.locator('#toast').boundingBox(),dock=await page.locator('#bottom-nav').boundingBox();
 assert.ok(box.y+box.height<dock.y-6,'toast bottom '+(box.y+box.height)+' dock top '+dock.y);
});
await check('Toast dismisses itself and leaves app interactive',async()=>{
 await page.waitForTimeout(3100);assert.equal(await page.locator('#toast').evaluate(e=>e.classList.contains('show')),false);
 await page.locator('.bottom-nav [data-view=develop]').click();
 assert.equal(await page.locator('#workspace h1').innerText(),'发展');
});
await check('settings toggles do not repeat a decorative settings icon',async()=>{
 await page.locator('.topbar [data-view=settings]').click();
 assert.equal(await page.locator('.settings-row:has(lg-switch) .setting-icon').count(),0);
});
await check('settings switches have 44px physical hit area and keyboard operation',async()=>{
 assert.equal(await page.locator('#workspace h1').innerText(),'设置');
 const target=page.locator('lg-switch[data-setting=quiet] input');
 const box=await target.boundingBox();assert.ok(box.height>=44,'switch actual hit '+box.height);
 const initial=await target.isChecked();await target.focus();await page.keyboard.press('Space');
 assert.notEqual(await target.isChecked(),initial,'keyboard Space failed');
});
await check('assistant Escape restores focus to single Xiaoya avatar',async()=>{
 await page.locator('#xiaoya-avatar').click();await page.locator('#assistant-input').waitFor({state:'visible'});
 await page.keyboard.press('Escape');await page.locator('#xiaoya-assistant').waitFor({state:'hidden',timeout:2200});
 assert.equal(await page.locator('#xiaoya-assistant').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'xiaoya-avatar');
});
await check('text fields keep real associated accessible names',async()=>{
 await page.locator('.topbar .toolbar-actions button[aria-label^="完成设置"]').click();
 await page.locator('.bottom-nav [data-view=items]').click();await page.locator('.v4-item-segments [data-items-tab=inbox]').click();await page.locator('[data-action=add-task]').click();
 for(const name of ['title','due']){const linked=await page.locator('#fld-'+name).evaluate(e=>e.labels?.length||0);assert.ok(linked>0,'no label for '+name)}
});
await check('no page JS errors and no horizontal clipping',async()=>{assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)});
}finally{if(context)await context.close();await browser.close();await new Promise(r=>server.close(r))}
console.log('FULL_AUDIT_UX',passed+'/'+(passed+failed));if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
