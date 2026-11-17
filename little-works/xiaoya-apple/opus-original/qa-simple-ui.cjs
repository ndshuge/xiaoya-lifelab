// Local, isolated synthetic UI QA. Does not contact accounts or paid services.
const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const OUT=path.join(ROOT,'docs/qa/evidence/2026-11-17-xiaoya-simple-ui');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.png':'image/png'};
const args=new Set(process.argv.slice(2)),NAV=['day','week','line','pocket','journal'];
function serve(port=0){return new Promise(res=>{const s=http.createServer((req,rsp)=>{
 const u=decodeURIComponent(new URL(req.url,'http://x').pathname);let f=path.join(ROOT,u);
 if(!f.startsWith(ROOT)){rsp.writeHead(403);return rsp.end()}
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
 fs.readFile(f,(err,b)=>{if(err){rsp.writeHead(404);return rsp.end()}
 rsp.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});rsp.end(b)});
 });s.listen(port,'127.0.0.1',()=>res(s))})}
async function main(){
 const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
 const server=await serve(),type=args.has('--webkit')?webkit:chromium;
 const browser=type===chromium?await chromium.launch({channel:'msedge',headless:true}):await webkit.launch({headless:true});
 try{
  fs.mkdirSync(OUT,{recursive:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-17T09:30:00+08:00'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/little-works/xiaoya-apple/opus-original/?judge=1&intro=0&tips=0&history=0');
  await page.waitForSelector('.day');
  assert.equal(await page.locator('#scale [role=tab]').count(),5);
  for(const view of NAV){
   await page.locator('#scale [data-view='+view+']').click();
   // Each view must remain selectable, without loading unrelated pages.
   assert.equal(await page.evaluate(()=>window.__XY_OPUS.ui.view),view);
   assert.equal(await page.locator('#scale [aria-selected=true]').getAttribute('data-view'),view);
   assert.ok(await page.locator('#page').innerText());
  }
  await page.locator('#scale [data-view=day]').click();
  await page.locator('#scale [data-view=day]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#scale [aria-selected=true]').getAttribute('data-view'),'week');
  await page.keyboard.press('End');
  assert.equal(await page.locator('#scale [aria-selected=true]').getAttribute('data-view'),'journal');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#scale [aria-selected=true]').getAttribute('data-view'),'day');
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(OUT,'stage1-navigation-390-'+(type===webkit?'webkit':'edge')+'.png')});
  await page.setViewportSize({width:320,height:720});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'320px horizontal overflow');
  const bounds=await page.locator('#scale [role=tab]').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,right:n.getBoundingClientRect().right,h:n.getBoundingClientRect().height})));
  assert.ok(bounds.every(b=>b.x>=0&&b.right<=321&&b.h>=44),JSON.stringify(bounds));
  await page.screenshot({path:path.join(OUT,'stage1-navigation-320-'+(type===webkit?'webkit':'edge')+'.png')});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.cover-btn').click();
  assert.equal(await page.locator('[data-settings-section]').count(),6);
  assert.equal(await page.locator('#sheet-body input').count(),0);
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(OUT,'stage2-settings-home-390-'+(type===webkit?'webkit':'edge')+'.png')});
  const before=await page.evaluate(()=>({semester:structuredClone(window.__XY_OPUS.getData().semester),settings:structuredClone(window.__XY_OPUS.getData().settings)}));
  await page.locator('[data-settings-section=reminders]').click();
  await page.locator('#sheet-body input[name=reminderEnabled]').uncheck();
  await page.locator('#sheet-ok').click();
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.getData().settings.reminderEnabled),false);
  assert.deepEqual(await page.evaluate(()=>window.__XY_OPUS.getData().semester),before.semester);
  await page.locator('.sheet-cancel').click();
  assert.equal(await page.locator('[data-settings-section]').count(),6);
  await page.locator('[data-settings-section=semester]').click();
  await page.locator('[data-settings-detail=edit]').click();
  await page.locator('[name=semName]').fill('未保存的学期');
  await page.locator('.sheet-cancel').click();
  await page.locator('#confirm[open]').waitFor();
  await page.locator('#confirm-ok').click();
  assert.deepEqual(await page.evaluate(()=>window.__XY_OPUS.getData().semester),before.semester);
  await page.locator('.sheet-cancel').click();
  await page.locator('.sheet-cancel').click();
  await page.locator('#scale [data-view=pocket]').click();
  await page.locator('[data-pocket-add]').click();
  await page.locator('#sheet-body input[name=title]').fill('买洗衣液');
  await page.locator('#sheet-ok').click();
  let item=await page.evaluate(()=>window.__XY_OPUS.getData().tasks.find(t=>t.title==='买洗衣液'));
  assert.ok(item&&!item.due&&!item.done,'new undated pocket task');
  await page.locator('#scale [data-view=pocket]').click();
  await page.locator('[data-pocket-detail="'+item.id+'"]').click();
  await page.locator('[data-pocket-arrange]').click();
  assert.equal(await page.locator('#sheet-body input[name=task]:checked').inputValue(),item.id);
  await page.locator('#sheet-ok').click();
  if(await page.locator('#confirm[open]').count())await page.locator('#confirm-ok').click();
  assert.equal(await page.evaluate(id=>window.__XY_OPUS.getData().events.filter(e=>e.taskId===id).length,item.id),1);
  assert.equal(await page.evaluate(id=>window.__XY_OPUS.getData().tasks.find(t=>t.id===id).due,item.id),item.due);
  await page.locator('#scale [data-view=pocket]').click();
  await page.locator('[data-toggle-task="'+item.id+'"]').first().click();
  await page.locator('[data-pocket-filter=completed]').click();
  assert.ok(await page.locator('[data-pocket-detail="'+item.id+'"]').count());
  await page.locator('[data-toggle-task="'+item.id+'"]').first().click();
  await page.locator('[data-pocket-filter=unscheduled]').click();
  assert.ok(await page.locator('[data-pocket-detail="'+item.id+'"]').count());
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,'stage4-pocket-390-'+(type===webkit?'webkit':'edge')+'.png')});
  // Task 6: live journal write/read/delete/undo and true-data trend views.
  await page.locator('#scale [data-view=journal]').click();
  assert.ok(await page.locator('.journal-page').count());
  await page.locator('[data-journal-edit="2026-11-17"]').click();
  await page.locator('#sheet-body input[name=mood][value="4"]').check();
  await page.locator('#sheet-ok').click();
  await page.locator('#sheet').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>window.__XY_OPUS.journal.all().filter(e=>e.date==='2026-11-17').map(e=>[e.mood,e.note])),[[4,'']]);
  await page.locator('[data-journal-edit="2026-11-17"]').click();
  await page.locator('#sheet-body textarea[name=note]').fill('今天有进步。');
  await page.locator('#sheet-ok').click();
  await page.locator('#sheet').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>window.__XY_OPUS.journal.all().filter(e=>e.date==='2026-11-17').map(e=>[e.mood,e.note])),[[4,'今天有进步。']],await page.evaluate(()=>({message:document.querySelector('#whisper')?.textContent,open:document.querySelector('#sheet')?.open,body:document.querySelector('#sheet-body')?.textContent?.slice(0,100)})));
  await page.locator('[data-journal-new]').click();
  await page.locator('#sheet-body input[name=journalDate]').fill('2026-11-12');
  await page.locator('#sheet-body input[name=mood][value=""]').check();
  await page.locator('#sheet-body textarea[name=note]').fill('只写文字，不选心情。');
  await page.locator('#sheet-ok').click();
  await page.locator('#sheet').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>window.__XY_OPUS.journal.all().find(e=>e.date==='2026-11-12')?.mood),null);
  await page.locator('[data-journal-show=history]').click();
  assert.equal(await page.locator('.journal-entries li').count(),2);
  await page.locator('[data-journal-read="2026-11-12"]').click();
  assert.ok((await page.locator('.journal-read-note').innerText()).includes('只写文字'));
  await page.locator('[data-journal-edit="2026-11-12"]').click();
  await page.locator('#sheet-body textarea[name=note]').fill('先不保存');
  await page.locator('.sheet-cancel').click();
  await page.locator('#confirm[open]').waitFor();
  await page.locator('#confirm-cancel').click();
  assert.equal(await page.locator('#sheet-body textarea[name=note]').inputValue(),'先不保存');
  await page.locator('.sheet-cancel').click();
  await page.locator('#confirm-ok').click();
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.journal.all().find(e=>e.date==='2026-11-12')?.note),'只写文字，不选心情。');
  await page.locator('[data-journal-show=home]').click();
  await page.locator('[data-journal-show=trend]').click();
  for(const n of [7,30,90]){
   await page.locator('[data-journal-range="'+n+'"]').click();
   assert.ok((await page.locator('.mood-plot').getAttribute('aria-label')).includes(n+'天'));
   await page.locator('.journal-data summary').click();
   assert.equal(await page.locator('.journal-data tbody tr').count(),n);
   await page.locator('.journal-data summary').click();
  }
  await page.screenshot({path:path.join(OUT,'stage6-journal-trend-390-'+(type===webkit?'webkit':'edge')+'.png')});
  await page.locator('[data-journal-range="7"]').click();
  await page.locator('.mood-plot').click({position:{x:30,y:45}});
  assert.ok(await page.locator('.journal-chart-selected').count());
  await page.locator('[data-journal-show=home]').click();
  await page.locator('[data-journal-edit="2026-11-17"]').click();
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(OUT,'stage6-journal-editor-390-'+(type===webkit?'webkit':'edge')+'.png')});
  await page.locator('.sheet-cancel').click();
  await page.locator('[data-journal-show=history]').click();
  await page.locator('[data-journal-read="2026-11-12"]').click();
  await page.locator('[data-journal-remove="2026-11-12"]').click();
  await page.locator('#confirm-ok').click();
  await page.waitForFunction(()=>!window.__XY_OPUS.journal.all().some(e=>e.date==='2026-11-12'));
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.journal.all().some(e=>e.date==='2026-11-12')),false);
  await page.locator('#whisper [data-whisper-action]').click();
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.journal.all().some(e=>e.date==='2026-11-12')),true);
  await page.locator('#scale [data-view=line]').click();
  await page.locator('[data-new=goal]').click();
  await page.locator('input[name=title]').fill('每周练琴');
  await page.locator('#sheet-ok').click();
  const goal=await page.evaluate(()=>window.__XY_OPUS.getData().goals.find(g=>g.title==='每周练琴'));
  assert.ok(goal?.id);
  await page.locator('[data-goal="'+goal.id+'"]').first().click();
  assert.equal(await page.locator('.goal-bar').count(),8);
  assert.equal(await page.locator('.goal-bar b').allTextContents().then(x=>x.reduce((s,n)=>s+Number(n),0)),0);
  await page.locator('[data-goal-chart-mode=minutes]').click();
  assert.equal(await page.locator('[data-goal-chart-mode=minutes]').getAttribute('aria-pressed'),'true');
  await page.locator('textarea[name=note]').fill('练习节奏');
  await page.locator('#sheet-ok').click();
  await page.locator('[data-goal="'+goal.id+'"]').first().click();
  assert.equal(await page.locator('.goal-bar b').allTextContents().then(x=>x.reduce((s,n)=>s+Number(n),0)),20);
  await page.locator('.sheet-cancel').click();
  await page.locator('#scale [data-view=journal]').click();
  if(await page.locator('[data-journal-show=home]').count())await page.locator('[data-journal-show=home]').click();
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(OUT,'stage6-journal-home-390-'+(type===webkit?'webkit':'edge')+'.png')});
  await page.setViewportSize({width:320,height:720});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'journal 320px overflow');
  await page.screenshot({path:path.join(OUT,'stage6-journal-home-320-'+(type===webkit?'webkit':'edge')+'.png')});
  await page.setViewportSize({width:390,height:844});
  console.log('PASS stage4 pocket create/arrange/complete/restore and evidence');
  console.log('PASS stage6 journal mood-only/note-only/edit/dirty/delete+undo, 7/30/90 trend, goal chart real checkins');
  // Task 7 intentionally touches settings only: category state, privacy and profile isolation.
  await page.locator('.cover-btn').click();
  await page.locator('[data-settings-section=appearance]').click();
  await page.locator('input[name=reducedMotion]').check();
  await page.locator('#sheet-ok').click();
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.getData().settings.reducedMotion),true);
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.getData().settings.reminderEnabled),false);
  await page.locator('.sheet-cancel').click();
  await page.locator('[data-settings-section=ai]').click();
  await page.locator('[data-settings-detail=permissions]').click();
  const grant=page.locator('#sheet-body input[data-settings-consent=journal]');
  await grant.check();
  await page.locator('#confirm[open]').waitFor();
  await page.locator('#confirm-ok').click();
  await page.waitForFunction(()=>window.__XY_OPUS.memory.consent.get().journal===true);
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.memory.consent.get().journal),true);
  await grant.uncheck();
  await page.waitForFunction(()=>window.__XY_OPUS.memory.consent.get().journal===false);
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.memory.consent.get().journal),false);
  await page.locator('.sheet-cancel').click();
  await page.locator('.sheet-cancel').click();
  await page.locator('.sheet-cancel').click();
  await page.locator('.cover-btn').click();
  await page.locator('[data-settings-section=archive]').click();
  await page.locator('[data-cover=mode]').click();
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.getMode()),'personal');
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.journal.all().length),0);
  await page.locator('.cover-btn').click();
  await page.locator('[data-settings-section=archive]').click();
  await page.locator('[data-cover=mode]').click();
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.getMode()),'demo');
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.journal.all().length),2);
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:844});
   for(const view of NAV){
    await page.locator('#scale [data-view='+view+']').click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),view+' overflow at '+width);
   }
   await page.locator('#scale [data-view=journal]').click();
   if(await page.locator('[data-journal-show=home]').count())await page.locator('[data-journal-show=home]').click();
   if(width!==390)await page.screenshot({path:path.join(OUT,'stage8-journal-'+width+'-'+(type===webkit?'webkit':'edge')+'.png')});
  }
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  await page.locator('.cover-btn').click();
  await page.waitForTimeout(180);
  await page.screenshot({path:path.join(OUT,'stage8-settings-dark-reduced-390-'+(type===webkit?'webkit':'edge')+'.png')});
  await page.locator('.sheet-cancel').click();
  console.log('PASS stage7 scoped settings appearance/privacy, per-profile journal isolation');
  console.log('PASS stage8 320/390/768/1440 layouts and dark/reduced settings screenshot');
  // A long list must remain reachable above the fixed quick-entry dock.
  await page.evaluate(()=>{
   const app=window.__XY_OPUS;
   app.store.commit(d=>{
    const seed=d.tasks.find(t=>t.title==='买洗衣液');
    for(let i=0;i<200;i++)d.tasks.push({...seed,id:'qa-tail-'+i,title:'验收一条比较长的待安排任务名称 '+String(i).padStart(3,'0'),done:false,due:null});
   },{track:false});
  });
  await page.locator('#scale [data-view=pocket]').click();
  await page.locator('[data-pocket-filter=unscheduled]').click();
  const last=page.locator('[data-pocket-detail="qa-tail-199"]');
  await last.scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  const geometry=await page.evaluate(()=>{
   const item=document.querySelector('[data-pocket-detail="qa-tail-199"]').getBoundingClientRect();
   const dock=document.querySelector('#dock').getBoundingClientRect();
   return {itemTop:item.top,itemBottom:item.bottom,dockTop:dock.top,viewport:innerHeight};
  });
  assert.ok(geometry.itemTop>=0&&geometry.itemBottom<=geometry.dockTop+1,'tail overlapped by dock '+JSON.stringify(geometry));
  await page.screenshot({path:path.join(OUT,'stage4-pocket-200-last-390-'+(type===webkit?'webkit':'edge')+'.png')});
  console.log('PASS stage4 200-task tail reachable above dock');
  assert.deepEqual(errors,[]);
  console.log('PASS stage1 five navigation destinations; 320/390 visibility');
  console.log('PASS stage2 settings six categories, scoped reminder save and dirty cancellation; no JS errors');
  await ctx.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
if(args.has('--serve')){
 serve(8765).then(()=>console.log('Local preview: http://127.0.0.1:8765/little-works/xiaoya-apple/opus-original/?judge=1&intro=0&tips=0&history=0')).catch(err=>{console.error(err);process.exitCode=1});
}else main().catch(err=>{console.error(err);process.exitCode=1});
