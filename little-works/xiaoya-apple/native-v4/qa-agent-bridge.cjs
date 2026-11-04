const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),dest=path.resolve(root,'docs/qa/evidence/2026-11-04-xiaoya-agent-v3');
fs.mkdirSync(dest,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(err,data)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}).end(data))});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let total=0,failed=0;const check=async(name,fn)=>{try{await fn();total++;console.log('PASS',name)}catch(e){failed++;total++;console.error('FAIL',name,String(e?.message||e).slice(0,900))}};
 try{for(const [engineName,engine] of [['Edge',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(engineName==='Edge'?{channel:'msedge',headless:true}:{headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const page=await context.newPage(),errors=[],weatherRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6500);
 await page.route(/api.open-meteo.com\/v1\/forecast/,async route=>{
   weatherRequests.push(route.request().url());
   const today=await page.evaluate(()=>{const d=new Date();const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return Array.from({length:4},(_,i)=>{const x=new Date(d);x.setDate(x.getDate()+i);return fmt(x)})});
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({daily:{time:today,
    precipitation_probability_max:[15,88,45,22],temperature_2m_min:[9,8,7,6],temperature_2m_max:[19,17,16,15]}})});
 });
 const click=async sel=>page.locator(sel).first().evaluate(e=>e.click());
 const tab=async v=>click('.bottom-nav [data-view='+v+']');
 await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await check(engineName+' published UI remains intact + default permissions off',async()=>{
    assert.equal(await page.locator('.bottom-nav .tab').count(),3);
    assert.equal(await page.locator('#xy-student-agent').count(),1);
    assert.equal(await page.locator('.xiaoya-avatar').count(),1);
    assert.equal(weatherRequests.length,0);
    assert.equal(await page.locator('.v4-mood-art').count(),0);
 });
 await page.screenshot({path:path.join(dest,engineName.toLowerCase()+'-today.png')});
 await check(engineName+' student agent preview, approval and undo',async()=>{
    const list=page.locator('[data-agent-action=preview-student]');
    assert.ok(await list.count()>0,'expected actionable demo suggestion');
    await click('[data-agent-action=preview-student]');
    assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
    assert.equal(await page.locator('[data-agent-action=approve]').count(),1);
    await click('[data-agent-action=approve]');
    await page.waitForTimeout(300);
    assert.match(await page.locator('#toast').innerText(),/已执行/);
    assert.ok(await page.locator('[data-agent-action=undo]').count());
    await click('[data-agent-action=undo]');
    assert.match(await page.locator('#toast').innerText(),/撤销/);
 });
 await check(engineName+' growth plan reacts to real goal and requires approval',async()=>{
    await tab('develop');await page.waitForTimeout(150);
    await click('[data-develop-tab=goals]');
    assert.ok(await page.locator('#xy-growth-agent').count());
    await click('[data-agent-action=growth-analyze]');
    await page.waitForTimeout(140);
    assert.ok(await page.locator('#xy-growth-agent').innerText().then(s=>s.includes('四周路线')||s.includes('第1周')));
    assert.ok(await page.locator('#xy-growth-agent').innerText().then(s=>s.includes('本地规则')));
    const preview=page.locator('[data-agent-action=growth-preview]');
    assert.ok(await preview.count()>0);
    await preview.first().evaluate(e=>e.click());
    assert.equal(await page.locator('[data-agent-action=approve]').count(),1);
    await click('[data-agent-action=approve]');
    assert.match(await page.locator('#toast').innerText(),/已执行/);
    await click('[data-agent-action=undo]');
    assert.match(await page.locator('#toast').innerText(),/撤销/);
 });
 await check(engineName+' weather request requires selected city and explicit consent',async()=>{
    await tab('today');await click('.topbar .glass-btn[data-view=settings]');
    assert.ok(await page.locator('#xy-agent-settings').count());
    assert.equal(weatherRequests.length,0);
    await click('[data-agent-action=weather-fetch]');
    assert.equal(weatherRequests.length,0);
    await page.locator('#xy-agent-city').selectOption('xian');
    await page.locator('#xy-agent-weather-consent').check();
    await click('[data-agent-action=settings-apply]');
    assert.equal(weatherRequests.length,0);
    await click('[data-agent-action=weather-fetch]');
    await page.waitForTimeout(250);
    assert.equal(weatherRequests.length,1);
    assert.ok(weatherRequests[0].includes('latitude=34.3'));
    assert.match(await page.locator('#xy-agent-settings').innerText(),/Open-Meteo/);
 });
 await check(engineName+' outdoor event triggers optional, reversible weather-preparation task',async()=>{
    await click('.topbar .glass-btn');
    await tab('items');await page.waitForTimeout(100);
    await click('[data-items-tab=schedule]');
    await click('[data-action=open-add-menu]');
    await click('[data-quick-create=event]');
    const tomorrow=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')});
    await page.locator('#fld-name').fill('户外社团活动');
    await page.locator('#fld-date').fill(tomorrow);
    await page.locator('#fld-start').fill('16:00');
    await page.locator('#fld-end').fill('18:00');
    await page.locator('#fld-outdoor').selectOption('true');
    await click('#sheet-save');await page.waitForTimeout(270);
    await tab('today');
    assert.ok(await page.locator('[data-agent-action=preview-weather]').count(),await page.locator('#xy-student-agent').innerText());
    await click('[data-agent-action=preview-weather]');
    assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
    await click('[data-agent-action=approve]');
    await page.waitForTimeout(270);
    await tab('items');await click('[data-items-tab=inbox]');
    assert.ok((await page.locator('#page-items').innerText()).includes('天气与室内备选方案'));
    await click('[data-agent-action=undo]');
    assert.ok(!(await page.locator('#page-items').innerText()).includes('天气与室内备选方案'));
 });
 await check(engineName+' consent revoke isolates private mood and disables weather data',async()=>{
    await tab('today');await click('.topbar .glass-btn[data-view=settings]');
    await click('[data-agent-action=settings-revoke]');
    assert.match(await page.locator('#xy-agent-settings').innerText(),/未获取天气/);
    assert.equal(await page.locator('#xy-agent-weather-consent').isChecked(),false);
    assert.equal(await page.locator('#xy-agent-mood-consent').isChecked(),false);
 });
 await check(engineName+' model connection requires explicit consent and no paid calls',async()=>{
    await click('.topbar .glass-btn');await tab('develop');await click('[data-develop-tab=goals]');await click('[data-agent-action=model-config]');
    await page.locator('#xy-model-id').fill('fake-model');
    await page.locator('#xy-model-key').fill('not-a-key');
    await click('[data-agent-action=model-connect]');
    assert.match(await page.locator('#toast').innerText(),/同意/);
    assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
    await click('[data-agent-action=preview-cancel]');
 });
 await check(engineName+' authorized model failure falls back without sending diary or raw tasks',async()=>{
    const modelRequests=[];
    await page.route('https://api.deepseek.com/chat/completions',async route=>{
      modelRequests.push(JSON.parse(route.request().postData()||'{}'));
      await route.fulfill({status:503,body:'unavailable'});
    });
    await click('[data-develop-tab=record]');
    await page.locator('#journal-note').fill('PRIVATE_DIARY_MARKER_NEVER_SEND');
    await click('#journal-save');
    await click('[data-develop-tab=goals]');
    await click('[data-agent-action=model-config]');
    await page.locator('#xy-model-id').fill('deepseek-chat');
    await page.locator('#xy-model-key').fill('throwaway-test-not-real');
    await page.locator('#xy-model-consent').check();
    await click('[data-agent-action=model-connect]');
    assert.equal(modelRequests.length,0,'connecting provider must not send data');
    await click('[data-agent-action=growth-analyze]');
    await page.waitForTimeout(400);
    assert.equal(modelRequests.length,1);
    const body=JSON.stringify(modelRequests[0]);
    assert.ok(!body.includes('PRIVATE_DIARY_MARKER_NEVER_SEND')&&!body.includes('工数习题第六章'),'sensitive data leaked');
    assert.match(await page.locator('#xy-growth-agent').innerText(),/本地规则路线/);
    await click('[data-agent-action=model-disconnect]');
  });
  await check(engineName+' switching demo to personal revokes consent and model state',async()=>{
    await click('.topbar .glass-btn[data-view=settings]');
    await click('[data-action=mode]');
    await page.waitForTimeout(80);
    await click('.topbar .glass-btn[data-view=settings]');
    assert.equal(await page.locator('#xy-agent-weather-consent').isChecked(),false);
    assert.equal(await page.locator('#xy-agent-mood-consent').isChecked(),false);
    await click('.topbar .glass-btn');
  });
 await check(engineName+' no runtime errors / no overlay ghost / HD assets preserved',async()=>{
    assert.deepEqual(errors,[]);
    assert.equal(await page.locator('.xy-route-ghost').count(),0);
    await click('.bottom-nav [data-view=develop]');
    const imgs=await page.locator('.v4-mood-option .v4-mood-art').evaluateAll(xs=>xs.map(e=>getComputedStyle(e).backgroundImage));
    assert.ok(imgs.length===5&&imgs.every(src=>src.includes('-hi')));
 });
 await page.screenshot({path:path.join(dest,engineName.toLowerCase()+'-development.png')});
 await context.close();await browser.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('AGENT_BRIDGE '+(total-failed)+'/'+total+' failed='+failed);
 if(failed)process.exitCode=1;
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
