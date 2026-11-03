// A contest QR should land on a synthetic functional demo without touching personal data.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const srv=http.createServer((req,res)=>{
 const relative=decodeURI(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+relative+(relative.endsWith('/')?'index.html':''));
 if(!file.startsWith(root))return res.writeHead(403).end();
 fs.readFile(file,(e,b)=>e?res.writeHead(404).end('missing'):res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(b));
});
const key='xiaoya-comparison:xiaoya-apple:personal:v1';
(async()=>{
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+srv.address().port+'/little-works/xiaoya-apple/native-v3/';
 const browser=await chromium.launch({channel:'msedge',headless:true});let pass=0,fail=0;
 const check=async(title,fn)=>{try{await fn();pass++;console.log('PASS',title)}catch(e){fail++;console.log('FAIL',title,e.message)}};
 try{
 const judge=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const pj=await judge.newPage();await pj.goto(base+'?judge=1',{waitUntil:'networkidle'});
 await check('fresh submitted judge link selects synthetic demo',async()=>{
  assert.equal(await pj.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'demo');
  assert.ok((await pj.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks)).length>=2);
  assert.match(await pj.locator('#workspace').innerText(),/待办事项/);
 });
 await check('judge entry does not fabricate or overwrite private archive',async()=>{
  assert.equal(await pj.evaluate(key=>localStorage.getItem(key),key),null);
  assert.ok(await pj.evaluate(()=>localStorage.getItem('xiaoya-comparison:xiaoya-apple:synthetic-demo:v1')));
 });
 await check('judge can navigate tasks/calendar and inspect real synthetic records',async()=>{
  await pj.locator('[data-view=schedule]:visible').first().click();
  assert.equal(await pj.locator('.hour-tick').count(),24);
  await pj.locator('[data-view=tasks]:visible').first().click();
  assert.ok(await pj.locator('[data-toggle=task]').count()>0);
 });
 await check('judge can explicitly switch to personal mode and refresh without forced demo',async()=>{
  await pj.locator('[data-view=settings]:visible').first().click();
  await pj.locator('[data-action=mode]').click();
  assert.equal(await pj.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'personal');
  await pj.reload({waitUntil:'networkidle'});
  assert.equal(await pj.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'personal');
 });
 await judge.close();
 const personal=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const pp=await personal.newPage();await pp.goto(base,{waitUntil:'networkidle'});
 await check('ordinary V3 route defaults to private mode',async()=>{
  assert.equal(await pp.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'personal');
  assert.equal((await pp.evaluate(()=>window.__XY_NATIVE_V3.getData().tasks)).length,0);
 });
 await personal.close();
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
 console.log('JUDGE_RESULT',pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
