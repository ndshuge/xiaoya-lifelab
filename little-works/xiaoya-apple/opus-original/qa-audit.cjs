// Capability audit: every business feature driven through the real UI, verified in saved data.
// Fixed clock; model + weather endpoints are mocked (no network, no fees). Usage: node qa-audit.cjs [--webkit] [--shots]
const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const ROOT=path.resolve(__dirname,'../../..');
const SHOTS=path.join(ROOT,'docs/qa/evidence/2026-11-05-opus-original');
const args=new Set(process.argv.slice(2));
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.png':'image/png'};
const NOW=new Date('2026-11-05T09:30:00+08:00');
function serve(){return new Promise(res=>{const s=http.createServer((req,rsp)=>{const u=decodeURIComponent(new URL(req.url,'http://x').pathname);let f=path.join(ROOT,u);if(!f.startsWith(ROOT)){rsp.writeHead(403);return rsp.end()}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,b)=>{if(e){rsp.writeHead(404);return rsp.end()}rsp.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});rsp.end(b)})});s.listen(0,'127.0.0.1',()=>res(s))})}
const results=[];
async function step(name,fn){try{await fn();results.push(['PASS',name]);console.log('PASS',name)}catch(e){results.push(['FAIL',name]);console.log('FAIL',name,'\n   ',e.message.split('\n').slice(0,4).join('\n    '))}}
async function shot(page,name){if(!args.has('--shots'))return;fs.mkdirSync(SHOTS,{recursive:true});await page.waitForTimeout(400);await page.screenshot({path:path.join(SHOTS,name+'.png')})}
async function closeLayers(page){await page.evaluate(()=>{for(const id of ['#confirm','#sheet']){const d=document.querySelector(id);if(d?.open)d.close()}if(!document.querySelector('#talk').hidden)document.querySelector('.icon-x').click()});await page.waitForTimeout(150)}
async function run(type,label){
 const server=await serve();const base='http://127.0.0.1:'+server.address().port;
 const browser=type===chromium?await chromium.launch({channel:'msedge',headless:true}):await webkit.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:860},acceptDownloads:true});
 await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await context.route(/api\.open-meteo\.com/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({daily:{time:['2026-11-05','2026-11-06','2026-11-07','2026-11-08'],precipitation_probability_max:[10,85,30,0],temperature_2m_min:[6,7,5,4],temperature_2m_max:[15,12,14,16]}})}));
 let growthRequest=null;
 await context.route('https://api.deepseek.com/chat/completions',async r=>{
  const body=JSON.parse(r.request().postData()),sys=body.messages[0].content,user=body.messages.at(-1).content;
  if(/成长计划的审阅者/.test(sys)){growthRequest=body;const opts=JSON.parse(user).options;
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({choices:opts.map(o=>({goalId:o.goalId,routeId:'steady',reason:'本周负担适中，按记录保持每周两次的稳定推进。'}))})}}]})});}
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:user.includes('Say OK')?'OK':'好的。'}}]})});
 });
 const page=await context.newPage();await page.clock.setFixedTime(NOW);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>{errors.push('native dialog: '+d.message());d.dismiss()});
 await page.goto(base+'/little-works/xiaoya-apple/opus-original/?judge=1&intro=0&history=0');await page.waitForSelector('.day');
 const data=()=>page.evaluate(()=>window.__XY_OPUS.getData());
 const S=async(name,fn)=>{await closeLayers(page);await page.evaluate(()=>{window.__XY_OPUS.ui.date=new Date().toLocaleDateString('sv-SE');window.__XY_OPUS.render()});await step(label+' '+name,fn)};
 try{
  await S('task: edit title/minutes from its deadline line, complete, restore',async()=>{
   await page.evaluate(()=>{window.__XY_OPUS.ui.date='2026-11-06';window.__XY_OPUS.render()});
   await page.locator('.due-label',{hasText:'工数习题第六章'}).click();
   await page.locator('#sheet-body input[name=title]').fill('工数习题第六章（含附加题）');
   await page.locator('#sheet-body input[name=minutes]').fill('60');
   await page.locator('#sheet-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().tasks.some(t=>t.id==='demo-t1'&&t.title.includes('附加题')&&t.minutes===60));
   await page.locator('.due-line .due-check').first().click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().tasks.find(t=>t.id==='demo-t1').done===true);
   assert.ok(await page.locator('.due-line.is-done').count()>=1);
   await page.locator('.due-line.is-done .due-check').first().click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().tasks.find(t=>t.id==='demo-t1').done===false);
  });
  await S('course: add a weekly course from the week page; it repeats next week',async()=>{
   await page.evaluate(()=>window.__XY_OPUS.setScale('week'));
   await page.locator('[data-new="course"]').click();
   await page.locator('#sheet-body input[name=name]').fill('大学物理');
   await page.locator('#sheet-body input[name=start]').fill('14:00');await page.locator('#sheet-body input[name=end]').fill('15:40');
   await page.locator('#sheet-body select[name=day]').selectOption('0');
   await page.locator('#sheet-body input[name=place]').fill('主楼 B201');
   await page.locator('#sheet-ok').click();
   await page.locator('.witem.course',{hasText:'大学物理'}).waitFor();
   await page.locator('[data-week-shift="1"]').click();
   await page.locator('.witem.course',{hasText:'大学物理'}).waitFor();
   await page.locator('[data-week-today]').click();
  });
  await S('semester: dates enable teaching weeks in the masthead',async()=>{
   await page.locator('.cover-btn').click();
   await page.locator('#sheet-body input[name=semStart]').fill('2026-09-07');
   await page.locator('#sheet-body input[name=semEnd]').fill('2027-01-17');
   await page.locator('#sheet-ok').click();
   await page.locator('.mast-sub',{hasText:'第 9 教学周'}).waitFor();
  });
  await S('calendar: CSV import shows a preview, then ink adds courses (erasable)',async()=>{
   const csv=path.join(os.tmpdir(),'xiaoya-audit-schedule.csv');
   fs.writeFileSync(csv,'name,day,start,end,place\n数据结构,3,10:10,11:50,教学楼 101\n');
   await page.locator('#import-cal').setInputFiles(csv);
   await page.locator('#sheet[open] .sheet-lede',{hasText:'新增 1 条'}).waitFor();
   await shot(page,label+'-audit-import-preview');
   await page.locator('#sheet-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().courses.some(c=>c.name==='数据结构'&&c.day===2));
   assert.match((await data()).transactions.at(-1).title,/导入/);
  });
  await S('calendar: ICS export contains courses, events and deadlines',async()=>{
   const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export-ics]').first().click()]);
   const ics=fs.readFileSync(await dl.path(),'utf8');
   assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/SUMMARY:数据结构/);assert.match(ics,/SUMMARY:截止：线性代数阶段测验/);
  });
  await S('weather: outdoor event + authorised rainy forecast → pencil prep task → ink',async()=>{
   await page.evaluate(()=>window.__XY_OPUS.setScale('week'));
   await page.locator('[data-new="event"]').click();
   await page.locator('#sheet-body input[name=name]').fill('户外定向越野');
   await page.locator('#sheet-body input[name=start]').fill('14:00');await page.locator('#sheet-body input[name=end]').fill('16:00');
   await page.locator('#sheet-body input[name=date]').fill('2026-11-06');
   await page.locator('#sheet-body select[name=outdoor]').selectOption('true');
   await page.locator('#sheet-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().events.some(e=>e.name==='户外定向越野'&&e.outdoor===true));
   await page.evaluate(()=>window.__XY_OPUS.setScale('day'));
   await page.locator('.cover-btn').click();
   await page.locator('#sheet-body select[name=city]').selectOption('xian');
   await page.locator('#sheet-body input[name=weather]').check();
   await page.locator('[data-cover="weather"]').click();
   await page.waitForFunction(()=>document.querySelector('#sheet-body')?.innerText.includes('已获取'));
   await page.locator('#sheet-ok').click();
   await page.locator('.note.is-context',{hasText:'户外活动'}).locator('.note-head').click();
   await page.locator('[data-approve-context]').waitFor();
   await shot(page,label+'-audit-weather-note');
   await page.locator('[data-approve-context]').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().tasks.some(t=>t.contextSuggestionId&&t.title.includes('户外定向越野')));
  });
  await S('mood: saved low mood + explicit consent → gentle-day note; without consent nothing',async()=>{
   await page.locator('#line-input').fill('今天18点前交班级表格');await page.locator('#line-input').press('Enter');
   await page.locator('.mood[data-mood="2"]').click();await page.locator('[data-journal-save]').click();
   assert.equal(await page.locator('.note.is-context',{hasText:'轻一点'}).count(),0,'no consent → no mood-based advice');
   await page.locator('.cover-btn').click();
   await page.locator('#sheet-body input[name=mood]').check();
   await page.locator('#sheet-ok').click();
   await page.locator('.note.is-context',{hasText:'轻一点'}).waitFor();
  });
  await S('growth: rule plan → pencil this week\'s action → ink creates a goal session',async()=>{
   await page.evaluate(()=>window.__XY_OPUS.setScale('line'));
   await page.locator('[data-analyze]').click();
   await page.locator('[data-growth-preview]').first().click();
   await page.locator('#sheet[open] .pencil-card').waitFor();
   await shot(page,label+'-audit-growth-pencil');
   await page.locator('#sheet-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().events.some(e=>e.goalId&&e.source==='Agent 已批准方案'));
  });
  await S('growth with model: explicit choice; only goal summary sent; model picks among given routes',async()=>{
   await page.locator('#xiaoya').click();await page.locator('.talk-connect').click();
   await page.locator('#sheet-body input[name=key]').fill('audit-test-key');await page.locator('#sheet-body input[name=consent]').check();
   await page.locator('#sheet-ok').click();await page.locator('#talk-status',{hasText:'已连接'}).waitFor();
   await page.locator('.icon-x').click();
   await page.locator('[data-analyze]').click();
   await page.locator('#sheet[open] .facts').waitFor();
   await page.locator('#sheet-ok').click();
   await page.locator('.plan-note',{hasText:'模型从备选路线中挑选'}).waitFor();
   const sent=JSON.stringify(growthRequest);
   assert.doesNotMatch(sent,/班级表格|户外定向越野|数据结构|工数/,'no task/event/course names leave');
   assert.match(sent,/练习架子鼓一次/,'goal titles only');
  });
  await S('backup: export demo → restore into empty personal archive (ack required) incl. journal',async()=>{
   await page.locator('.cover-btn').click();
   const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('[data-cover="export"]').click()]);
   const file=path.join(os.tmpdir(),'xiaoya-audit-backup.json');fs.copyFileSync(await dl.path(),file);
   await page.locator('[data-cover="mode"]').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getMode()==='personal'&&window.__XY_OPUS.getData().tasks.length===0);
   await page.locator('#import-json').setInputFiles(file);
   await page.locator('#confirm[open]').waitFor();
   assert.equal(await page.locator('#confirm-ok').isDisabled(),true,'ack checkbox gates overwrite');
   await shot(page,label+'-audit-restore-confirm');
   await page.locator('#confirm-ack').check();await page.locator('#confirm-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().courses.some(c=>c.name==='数据结构'));
   assert.ok(await page.evaluate(()=>window.__XY_OPUS.journal.all().length>=1),'journal restored');
   // Clean the personal archive again so the audit leaves no residue.
   await page.locator('.cover-btn').click();await page.locator('[data-cover="clear"]').click();
   await page.locator('#confirm-ack').check();await page.locator('#confirm-ok').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getData().tasks.length===0&&window.__XY_OPUS.journal.all().length===0);
   await page.locator('.cover-btn').click();await page.locator('[data-cover="mode"]').click();
   await page.waitForFunction(()=>window.__XY_OPUS.getMode()==='demo');
  });
  await S('compatibility: the official native-v4 page reads what this experiment wrote',async()=>{
   const v4=await context.newPage();await v4.clock.setFixedTime(NOW);
   await v4.goto(base+'/little-works/xiaoya-apple/native-v4/?judge=1');
   await v4.waitForFunction(()=>!!window.__XY_NATIVE_V4,null,{timeout:15000});
   const d=await v4.evaluate(()=>({mode:window.__XY_NATIVE_V4.getMode(),tasks:window.__XY_NATIVE_V4.getData().tasks.map(t=>t.title),courses:window.__XY_NATIVE_V4.getData().courses.map(c=>c.name),lab:window.__XY_NATIVE_V4.getData().courses.find(c=>c.id==='demo-c1')}));
   assert.equal(d.mode,'demo');assert.ok(d.tasks.some(t=>t.includes('附加题')));assert.ok(d.courses.includes('大学物理')&&d.courses.includes('数据结构'));
   await v4.close();
  });
  await step(label+' no page errors and no native dialogs',async()=>{assert.deepEqual(errors,[])});
 }finally{await browser.close();server.close()}
}
(async()=>{
 if(!args.has('--only-webkit'))await run(chromium,'edge');
 if(args.has('--webkit')||args.has('--only-webkit'))await run(webkit,'webkit');
 const fail=results.filter(r=>r[0]==='FAIL');console.log('\n'+(results.length-fail.length)+'/'+results.length+' PASS');process.exitCode=fail.length?1:0;
})();
