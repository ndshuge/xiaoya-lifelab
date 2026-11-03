// Browser regression for the final V4 product navigation & data model.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const types={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 else if(p==='/xiaoya-lifelab')p='/';
 const file=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,d)=>err?res.writeHead(404).end('missing'):res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'}).end(d));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/';
 const browser=await chromium.launch({channel:'msedge',headless:true});
 let pass=0,fail=0,exportedArchive=null;
 async function check(label,fn){try{await fn();pass++;console.log('PASS',label)}catch(e){fail++;console.error('FAIL',label,e.message.slice(0,330))}}
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,acceptDownloads:true});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?judge=1',{waitUntil:'networkidle'});
  await check('fixed judge URL opens V4 with exactly 3 main tabs',async()=>{
   assert.match(page.url(),/native-v4\/\?judge=1/);
   assert.deepEqual((await page.locator('.bottom-nav .tab').allTextContents()).map(s=>s.trim()),['今天','事项','发展']);
   assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'demo');
  });
  await check('only avatar opens assistant, no redundant text brand/chat button',async()=>{
   assert.equal(await page.locator('#xiaoya-avatar').isVisible(),true);
   assert.equal(await page.locator('#toolbar-chat-trigger').count(),0);
   await page.locator('#xiaoya-avatar').click();
   assert.equal(await page.locator('#xiaoya-assistant').isVisible(),true);
   await page.locator('#assistant-close').click();
   await page.waitForTimeout(430);
  });
  await check('items shows due reminders in date lane without scheduling them as courses',async()=>{
   await page.evaluate(()=>{
    const d=window.__XY_NATIVE_V3.getData();
    d.tasks.push({id:'new-no-ddl',title:'读一本书',type:'task',done:false,minutes:30});
    window.__XY_NATIVE_V3.store.replace(d);
   });
   await page.locator('.bottom-nav [data-view=items]').click();
   assert.equal(await page.locator('#items-date-deadlines').count(),1);
   assert.equal(await page.locator('#items-schedule').count(),1);
   await page.locator('[data-items-tab=inbox]').click();
   assert.equal(await page.locator('#items-undated [data-item=new-no-ddl]').count(),1);
   await page.locator('[data-items-tab=schedule]').click();
   const d=await page.evaluate(()=>window.__XY_NATIVE_V3.getData());
   assert.ok(d.tasks.some(t=>t.id==='new-no-ddl'&&!t.due));
  });
  await check('task edit allows clearing deadline to move to independent inbox',async()=>{
   await page.locator('#page-items [data-add=task]:visible').first().click({timeout:8000});
   const due=page.locator('#fld-due');
   assert.ok(await due.count());
   assert.equal(await due.getAttribute('required'),null);
   await page.locator('#fld-title').fill('无日期提醒');
   await due.fill('');
   await page.locator('#sheet-save').click();
   await page.locator('[data-items-tab=inbox]').click();
   assert.match(await page.locator('#items-undated').innerText(),/无日期提醒/);
  });
  await check('development shows mood, journal, goals and saves a real private entry',async()=>{
   await page.locator('.bottom-nav [data-view=develop]').click();
   for(const id of ['development-mood','development-journal','development-goals'])assert.equal(await page.locator('#'+id).count(),1);
   await page.locator('[data-mood="4"]').click();
   await page.locator('#journal-note').fill('读书、复习和完成任务。');
   await page.locator('#journal-save').click();
   assert.match(await page.locator('#journal-status').innerText(),/已保存/);
   await page.reload({waitUntil:'networkidle'});
   await page.locator('.bottom-nav [data-view=develop]').click();
   assert.equal(await page.locator('#journal-note').inputValue(),'读书、复习和完成任务。');
   assert.equal(await page.locator('[data-mood="4"]').getAttribute('aria-pressed'),'true');
  });
  await check('journal is not copied to personal mode and backup includes journal',async()=>{
   const journal=await page.evaluate(()=>localStorage.getItem('xiaoya-dayflow:journal:v1:demo'));
   assert.match(journal,/读书、复习/);
   const downloadPromise=page.waitForEvent('download');
   await page.locator('.topbar [data-view=settings]').click();
   await page.locator('[data-action=export-json]').first().click();
   const dl=await downloadPromise;
   const text=fs.readFileSync(await dl.path(),'utf8');exportedArchive=text;
   assert.ok(JSON.parse(text).journalV1.length>0);
   await page.locator('[data-action=mode]').first().click();
   assert.equal(await page.evaluate(()=>window.__XY_NATIVE_V3.getMode()),'personal');
   await page.locator('.bottom-nav [data-view=develop]').click();
   assert.equal(await page.locator('#journal-note').inputValue(),'');
  });
  await check('importing an explicitly selected backup restores its journal, after confirmation',async()=>{
   assert.ok(exportedArchive);
   await page.evaluate(()=>{window.confirm=()=>true});
   await page.locator('#import-file').setInputFiles({name:'xiaoya-backup.json',mimeType:'application/json',buffer:Buffer.from(exportedArchive,'utf8')});
   await page.waitForFunction(()=>!!localStorage.getItem('xiaoya-dayflow:journal:v1:personal'));
   await page.locator('.bottom-nav [data-view=develop]').click();
   assert.equal(await page.locator('#journal-note').inputValue(),'读书、复习和完成任务。');
  });
  await check('completed goals stay accessible and can be restored',async()=>{
   await page.evaluate(()=>{
    const d=window.__XY_NATIVE_V3.getData();
    d.goals.push({id:'v4-done-goal',title:'已完成的跑步目标',category:'运动',done:true,weeklyTarget:1});
    window.__XY_NATIVE_V3.store.replace(d);
   });
   await page.locator('.bottom-nav [data-view=today]').click();
   await page.locator('.bottom-nav [data-view=develop]').click();
   await page.locator('[data-develop-tab=goals]').click();
   const archive=page.locator('#development-completed-goals');
   assert.equal(await archive.count(),1);
   await archive.locator('summary').click();
   assert.match(await archive.innerText(),/已完成的跑步目标/);
   await archive.locator('[data-toggle=goal][data-id=v4-done-goal]').click();
   const updated=await page.evaluate(()=>window.__XY_NATIVE_V3.getData().goals.find(x=>x.id==='v4-done-goal').done);
   assert.equal(updated,false);
  });
  await check('mature growth planner remains open after generating two routes and waits for explicit approval',async()=>{
   await page.locator('.bottom-nav [data-view=develop]').click();
   await page.locator('[data-develop-tab=goals]').click();
   await page.locator('#v4-growth-planner summary').click();
   await page.locator('#growth-goal').fill('学习 Python');
   await page.locator('#growth-baseline').fill('刚入门');
   await page.locator('#growth-hours').fill('4');
   await page.locator('#growth-weeks').fill('8');
   const before=await page.evaluate(()=>({g:window.__XY_NATIVE_V3.getData().goals.length,t:window.__XY_NATIVE_V3.getData().tasks.length}));
   await page.locator('#growth-generate').click();
   assert.equal(await page.locator('#v4-growth-planner').evaluate(e=>e.open),true);
   assert.equal(await page.locator('[data-growth-route]:visible').count(),2);
   assert.deepEqual(await page.evaluate(()=>({g:window.__XY_NATIVE_V3.getData().goals.length,t:window.__XY_NATIVE_V3.getData().tasks.length})),before);
   await page.locator('[data-growth-route=project]').click();
   assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
   await page.locator('#sheet-cancel').count();
   await page.locator('.sheet-cancel').click();
   assert.deepEqual(await page.evaluate(()=>({g:window.__XY_NATIVE_V3.getData().goals.length,t:window.__XY_NATIVE_V3.getData().tasks.length})),before);
  });
  await check('an empty day does not draw a pointless 24-hour time grid',async()=>{
   await page.evaluate(()=>{const d=window.__XY_NATIVE_V3.getData();d.courses=[];d.events=[];window.__XY_NATIVE_V3.store.replace(d)});
   await page.locator('.bottom-nav [data-view=items]').click();
   await page.locator('[data-items-tab=schedule]').click();
   assert.equal(await page.locator('.native-timeline-scroll').count(),0);
   assert.equal(await page.locator('.v4-no-schedule').count(),1);
  });
  await check('clicking active tabs does not move stable header; dock has gradient blur',async()=>{
   await page.locator('.bottom-nav [data-view=today]').click();
   const before=await page.locator('.topbar').boundingBox();
   await page.locator('.bottom-nav [data-view=today]').click();
   const after=await page.locator('.topbar').boundingBox();
   assert.equal(Math.round(before.y),Math.round(after.y));
   const css=await page.evaluate(()=>{const e=document.querySelector('#bottom-nav'),b=getComputedStyle(e,'::before'),a=getComputedStyle(document.querySelector('.app-frame'),'::after');return {blur:getComputedStyle(e).backdropFilter,mask:a.maskImage,background:b.backgroundImage}});
   assert.match(css.blur,/blur/);assert.match(css.mask,/gradient/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
  await check('settings exposes versions without floating chip overlapping dock',async()=>{
   assert.equal(await page.locator('#xiaoya-version-menu').isVisible(),false);
   await page.locator('.topbar [data-view=settings]').click();
   assert.equal(await page.locator('#v4-version-library').isVisible(),true);
  });
  await check('no JavaScript exceptions',async()=>assert.deepEqual(errors,[]));
  if(process.env.XIAOYA_V4_SHOTS){
   fs.mkdirSync(process.env.XIAOYA_V4_SHOTS,{recursive:true});
   for(const tab of ['today','items','develop']){
    await page.locator('.bottom-nav [data-view='+tab+']').click();
    await page.waitForTimeout(400);
    await page.screenshot({path:path.join(process.env.XIAOYA_V4_SHOTS,'v4-final-'+tab+'-390.png'),fullPage:true,animations:'disabled'});
   }
  }
  await ctx.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('V4_THREE_TAB',pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
