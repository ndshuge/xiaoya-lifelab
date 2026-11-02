// Regression for Native V3's lost assistant, isolated synthetic data and mocked API.
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname);
 const file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end('missing');res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data)});
});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+srv.address().port+'/little-works/xiaoya-apple/native-v3/';
 const browser=await chromium.launch({channel:'msedge',headless:true});
 let pass=0,fail=0;
 const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS',name)}catch(e){fail++;console.error('FAIL',name,e.message)}};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{if(req.url().includes('/chat/completions'))requests.push(req.url())});
  await page.goto(base+'?judge=1',{waitUntil:'networkidle'});
  await check('judge can open assistant from visible header trigger',async()=>{
   await page.locator('#toolbar-chat-trigger').click();
   assert.equal(await page.locator('#xiaoya-assistant').isVisible(),true);
   assert.match(await page.locator('#assistant-status').innerText(),/本地规则|未连接/);
  });
  await check('offline chat uses real isolated tasks without cloud call',async()=>{
   await page.locator('#assistant-input').fill('今天先做什么');
   await page.locator('#assistant-send').click();
   await page.locator('.assistant-message.bot').last().waitFor();
   const answer=await page.locator('.assistant-message.bot').last().innerText();
   assert.match(answer,/工数习题|线性代数|事项|待办/);
   assert.equal(requests.length,0);
   assert.equal(await page.evaluate(()=>localStorage.getItem('xiaoya-comparison:xiaoya-apple:personal:v1')),null);
  });
  await check('assistant quick navigation leads to real goals view',async()=>{
   await page.locator('[data-assistant-nav=goals]').click();
   assert.match(await page.locator('#workspace h1').first().innerText(),/成长目标/);
  });
  await check('user must explicitly authorize AI testing; no request on open',async()=>{
   await page.locator('#toolbar-chat-trigger').click();
   await page.locator('#assistant-config-toggle').click();
   assert.equal(requests.length,0);
   await page.locator('#assistant-api-key').fill('test-key-never-store');
   await page.locator('#assistant-verify').click();
   assert.match(await page.locator('#assistant-api-feedback').innerText(),/确认|勾选|授权/);
   assert.equal(requests.length,0);
  });
  await check('verified provider can chat without leaking key to storage or automatically sharing records',async()=>{
   const bodies=[];
   await page.route('https://api.deepseek.com/**',async route=>{
    const request=route.request(),body=JSON.parse(request.postData()||'{}');bodies.push(body);
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({choices:[{message:{content:bodies.length===1?'连接成功':'来自真实接口格式的测试回答'}}]})});
   });
   await page.locator('#assistant-api-consent').check();
   await page.locator('#assistant-verify').click();
   await page.getByText('AI 已连接',{exact:false}).first().waitFor({timeout:7000});
   await page.locator('#assistant-input').fill('帮我安排学习');
   await page.locator('#assistant-send').click();
   await page.getByText('来自真实接口格式的测试回答',{exact:true}).waitFor({timeout:7000});
   assert.equal(bodies.length,2);
   assert.equal(JSON.stringify(bodies[1]).includes('工数习题'),false);
   assert.equal(JSON.stringify(bodies[1]).includes('test-key-never-store'),false);
   assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('test-key-never-store')),false);
  });
  await check('closing and reloading never silently recovers key',async()=>{
   await page.reload({waitUntil:'networkidle'});
   await page.locator('#toolbar-chat-trigger').click();
   assert.match(await page.locator('#assistant-status').innerText(),/本地规则|未连接/);
   assert.equal(requests.length,2);
  });
  await check('chat can close by Escape, keyboard trigger reachable, no mobile overflow',async()=>{
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#xiaoya-assistant').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.equal(errors.length,0,errors.join('; '));
  });
  await context.close();
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
 console.log('ASSISTANT_RESULT',pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
