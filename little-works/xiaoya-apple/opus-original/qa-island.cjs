// Visual + behaviour check for the 3D paper island, the opening and the guided tour.
// Usage: node qa-island.cjs [--webkit] [--shots]
const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const ROOT=path.resolve(__dirname,'../../..');
const SHOTS=path.join(ROOT,'docs/qa/evidence/2026-11-05-opus-original');
const args=new Set(process.argv.slice(2));
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.png':'image/png'};
const NOW=new Date('2026-11-05T09:30:00+08:00');
function serve(){return new Promise(res=>{const s=http.createServer((req,rsp)=>{const u=decodeURIComponent(new URL(req.url,'http://x').pathname);let f=path.join(ROOT,u);if(!f.startsWith(ROOT)){rsp.writeHead(403);return rsp.end()}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,b)=>{if(e){rsp.writeHead(404);return rsp.end()}rsp.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});rsp.end(b)})});s.listen(0,'127.0.0.1',()=>res(s))})}
const results=[];
async function step(name,fn){try{await fn();results.push('PASS');console.log('PASS',name)}catch(e){results.push('FAIL');console.log('FAIL',name,'\n   ',e.message.split('\n').slice(0,3).join('\n    '))}}
async function shot(page,name){if(!args.has('--shots'))return;fs.mkdirSync(SHOTS,{recursive:true});await page.screenshot({path:path.join(SHOTS,name+'.png')})}
async function open(browser,base,{mobile=false,query='?judge=1'}={}){
 const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:1280,height:860}});
 await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.clock.setFixedTime(NOW);await page.goto(base+'/little-works/xiaoya-apple/opus-original/'+query);
 return {ctx,page,errors};
}
async function run(type,label){
 const server=await serve();const base='http://127.0.0.1:'+server.address().port;
 const browser=type===chromium?await chromium.launch({channel:'msedge',headless:true}):await webkit.launch({headless:true});
 try{
  // First visit: the opening plays automatically.
  const a=await open(browser,base,{query:'?judge=1'});
  await step(label+' first visit plays the opening: book opens, Xiaoya speaks, profile becomes memory',async()=>{
   await a.page.locator('.intro').waitFor();
   await a.page.waitForTimeout(500);await shot(a.page,label+'-intro-1-book');
   await a.page.waitForTimeout(1300);await shot(a.page,label+'-intro-2-popup');
   await a.page.locator('.intro-dialog:not([hidden])').waitFor({timeout:20000});
   await a.page.waitForTimeout(900);await shot(a.page,label+'-intro-3-hello');
   await a.page.locator('[data-intro-choice]').last().click();
   await a.page.locator('.intro-text').click();await a.page.locator('[data-intro-choice]').last().click();
   await a.page.locator('.intro-form input[name=name]').waitFor();
   await a.page.locator('.intro-form input[name=name]').fill('阿芽');
   await a.page.locator('.intro-form input[name=school]').fill('西安交通大学');
   await a.page.locator('.intro-form input[name=major]').fill('电气工程');
   await shot(a.page,label+'-intro-4-profile');
   await a.page.locator('[data-intro-choice]').last().click();
   await a.page.locator('.intro-text').click();await a.page.locator('[data-intro-choice]').last().click();
   await a.page.locator('.intro-text').click();
   await shot(a.page,label+'-intro-5-choice');
   await a.page.locator('[data-intro-choice]',{hasText:'带我走一圈'}).click();
   await a.page.locator('.intro').waitFor({state:'detached'});
   const mem=await a.page.evaluate(()=>({profile:window.__XY_OPUS.memory.profile.get(),facts:window.__XY_OPUS.memory.facts.all().map(f=>f.text)}));
   assert.equal(mem.profile.name,'阿芽');assert.ok(mem.facts.some(f=>f.includes('西安交通大学')));
   assert.match(await a.page.locator('.voice').first().innerText(),/早上好，阿芽/);
  });
  await step(label+' guided tour: three chapters, every step driven by the real control',async()=>{
   const p=a.page,bubble=t=>p.locator('.tour-bubble',{hasText:t}).waitFor({timeout:10000});
   // 第一章 · 记下来
   await bubble('第一章 · 记下来');await p.waitForTimeout(400);await shot(p,label+'-tour-1-line');
   assert.equal(await p.locator('.tour-dots i').count(),3,'three chapter dots');
   await p.locator('[data-tour="action"]').click();await p.locator('#line-input').press('Enter');
   await bubble('口袋');await p.locator('[data-tour="action"]').click();await p.locator('#line-input').press('Enter');
   await bubble('有起止时间');await p.locator('[data-tour="action"]').click();await p.locator('#line-input').press('Enter');
   const d=await p.evaluate(()=>window.__XY_OPUS.getData());
   assert.ok(d.tasks.some(t=>t.title.includes('洗衣液')&&!t.due),'pocket task has no due');
   assert.ok(d.events.some(e=>e.title?.includes('社团例会')||e.name?.includes('社团例会')),'event written');
   // 第二章 · 排进去
   await bubble('第二章 · 排进去');await p.waitForTimeout(300);await shot(p,label+'-tour-2-pencil');
   await p.locator('.blk.pencil').first().click();
   await bubble('满意就「落墨」');
   await p.locator('.note.is-open [data-approve]').click();
   await bubble('擦掉');await p.waitForTimeout(7000);
   assert.ok(await p.locator('#whisper.show [data-whisper-action]').isVisible(),'whisper stays while the tour waits');
   await shot(p,label+'-tour-3-erase');
   await p.locator('#whisper [data-whisper-action]').click();
   await bubble('空白带');await p.locator('[data-tour="next"]').click();
   await bubble('把纸立起来');
   await p.locator('#scale [data-scale="week"]').click();
   await p.locator('.island-canvas').waitFor({timeout:15000});
   await bubble('只改「这一次」');await shot(p,label+'-tour-4-occurrence');
   await p.locator('.week-grid .witem.course button').first().click();
   await p.locator('#sheet[open] .occ-choices').waitFor();await p.locator('#sheet [data-close="sheet"]').first().click();
   // 第三章 · 看见自己
   await bubble('房子是课');await p.waitForTimeout(2600);await shot(p,label+'-tour-5-island');
   await p.locator('[data-tour="next"]').click();
   await bubble('季节岛');await p.locator('#scale [data-scale="line"]').click();
   await bubble('真实做了几次');await p.waitForTimeout(1200);await shot(p,label+'-tour-6-season');
   await p.locator('[data-tour="next"]').click();
   await bubble('选一个心情');await p.locator('.mood').nth(3).click();
   await bubble('点我');await p.locator('#xiaoya').click();
   await bubble('试着问一句');await p.locator('[data-tour="action"]').click();await p.locator('#line-input').press('Enter');
   await bubble('封底');await shot(p,label+'-tour-7-cover');
   await p.locator('[data-tour="next"]').click();
   await p.locator('#confirm[open]',{hasText:'新手任务完成'}).waitFor();
   await shot(p,label+'-tour-8-graduate');
   await p.locator('#confirm-cancel').click();
  });
  await step(label+' tour: 跳过本章 jumps to the next chapter; 跳过教学 ends it',async()=>{
   const p=a.page;
   await p.evaluate(()=>window.__XY_OPUS.startTour());
   await p.locator('.tour-bubble',{hasText:'第一章'}).waitFor();
   await p.locator('[data-tour="chapter"]').click();
   await p.locator('.tour-bubble',{hasText:'第二章'}).waitFor();
   await p.locator('[data-tour="chapter"]').click();
   await p.locator('.tour-bubble',{hasText:'第三章'}).waitFor();
   assert.equal(await p.locator('[data-tour="chapter"]').count(),0,'last chapter has no chapter skip');
   await p.locator('[data-tour="skip"]').click();
   await p.locator('.tour').waitFor({state:'detached'});
   await p.evaluate(()=>window.__XY_OPUS.setScale('week'));
  });
  await step(label+' island renders real objects and picking a day flips back to paper',async()=>{
   const p=a.page;
   const px=await p.evaluate(()=>{const c=document.querySelector('.island-canvas');const g=c.getContext('webgl2')||c.getContext('webgl');return !!g&&c.width>0});
   assert.ok(px,'webgl canvas');
   await p.waitForTimeout(800);await shot(p,label+'-desktop-island');
   const box=await p.locator('.island-canvas').boundingBox();
   // Sample the centre band: tap until a pick navigates to a day page (stops are along the path).
   let navigated=false;
   for(const fx of [.5,.42,.58,.34,.66,.26,.74]){for(const fy of [.5,.44,.56,.38]){await p.mouse.click(box.x+box.width*fx,box.y+box.height*fy);await p.waitForTimeout(120);
    if(await p.evaluate(()=>window.__XY_OPUS.ui.scale!=='week'||document.querySelector('#sheet').open)){navigated=true;break}}if(navigated)break}
   assert.ok(navigated,'some object on the island is pickable');
   await p.evaluate(()=>{for(const id of ['#sheet','#confirm']){const d=document.querySelector(id);if(d?.open)d.close()}});
  });
  // Find a screen point where the island really picks `kind` (other pieces, e.g. banners, may be in front).
  const at=async(p,kind)=>{const box=await p.locator('.island-host').boundingBox();
   const s=await p.evaluate(k=>{const i=window.__XY_OPUS.island();const l=i?.locate(k);if(!l)return null;
    for(let r=0;r<=60;r+=6)for(let a=0;a<16;a++){const x=l.x+Math.cos(a/16*Math.PI*2)*r,y=l.y+Math.sin(a/16*Math.PI*2)*r;if(i.pickAt(x,y)===k)return {x,y}}return null},kind);
   if(!s)return null;return {x:box.x+s.x,y:box.y+s.y}};
  await step(label+' hover shows a paper tooltip and lifts the piece; tapping Xiaoya makes her speak',async()=>{
   const p=a.page;await p.evaluate(()=>window.__XY_OPUS.setScale('week'));await p.locator('.island-canvas').waitFor();await p.waitForTimeout(2600);
   const h=await at(p,'course');assert.ok(h,'a course house exists');
   await p.mouse.move(h.x,h.y);await p.waitForTimeout(500);
   assert.ok(await p.locator('.island-pop').isVisible(),'tooltip visible');
   assert.match(await p.locator('.island-pop').innerText(),/\d\d:\d\d|周.|项/);
   await shot(p,label+'-island-hover');
   const x=await at(p,'xiaoya');await p.mouse.click(x.x,x.y);
   await p.locator('.island-say').waitFor();assert.match(await p.locator('.island-say p').innerText(),/阿芽|今天|截止|下一件/);
   await p.waitForTimeout(300);await shot(p,label+'-island-xiaoya-say');
   await p.locator('[data-island-talk]').click();await p.locator('#talk:not([hidden])').waitFor();await p.locator('.icon-x').click();
  });
  await step(label+' long line becomes a season island; picking a week opens that week',async()=>{
   const p=a.page;await p.evaluate(()=>window.__XY_OPUS.setScale('line'));await p.locator('.island-slot.is-season .island-canvas').waitFor({timeout:15000});await p.waitForTimeout(2800);
   await shot(p,label+'-season-island');
   const w=await at(p,'week');assert.ok(w,'week plots exist');await p.mouse.click(w.x,w.y);
   await p.waitForFunction(()=>window.__XY_OPUS.ui.scale==='week');
  });
  await step(label+' no page errors (desktop)',async()=>{assert.deepEqual(a.errors.filter(e=>!/GPU stall|WebGL|swiftshader/i.test(e)),[])});
  await a.ctx.close();
  // Night: lighting follows the real hour (windows lit, stars out).
  {const n=await browser.newContext({viewport:{width:1280,height:860}});await n.route(/fonts\./,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
   const p=await n.newPage();await p.clock.setFixedTime(new Date('2026-11-05T21:40:00+08:00'));await p.goto(base+'/little-works/xiaoya-apple/opus-original/?judge=1&intro=0');
   await step(label+' night lighting: host marked night, island renders',async()=>{
    await p.waitForSelector('.day');await p.evaluate(()=>window.__XY_OPUS.setScale('week'));await p.locator('.island-canvas').waitFor({timeout:15000});await p.waitForTimeout(2800);
    assert.equal(await p.locator('.island-host').getAttribute('data-night'),'true');
    await shot(p,label+'-island-night');
   });await n.close()}
  // Mobile: returning visitor skips the opening; island fits the phone.
  const m=await open(browser,base,{mobile:true,query:'?judge=1&intro=0'});
  await step(label+' mobile island fits 390px and keeps the list below',async()=>{
   await m.page.waitForSelector('.day');
   await m.page.evaluate(()=>window.__XY_OPUS.setScale('week'));
   await m.page.locator('.island-canvas').waitFor({timeout:15000});await m.page.waitForTimeout(2600);
   assert.ok(await m.page.evaluate(()=>document.documentElement.scrollWidth<=390));
   assert.ok(await m.page.locator('.week-grid').isVisible());
   await shot(m.page,label+'-mobile-island');
  });
  const mErrors=[...m.errors];await m.ctx.close();
  const mi=await open(browser,base,{mobile:true,query:'?judge=1&intro=1'});
  await step(label+' mobile opening dialogue is readable',async()=>{
   await mi.page.locator('.intro-dialog:not([hidden])').waitFor({timeout:20000});await mi.page.waitForTimeout(900);
   await shot(mi.page,label+'-mobile-intro');
   await mi.page.locator('[data-intro-skip]').click();await mi.page.locator('.intro').waitFor({state:'detached'});
  });
  await step(label+' no page errors (mobile)',async()=>{assert.deepEqual([...mErrors,...mi.errors].filter(e=>!/GPU stall|WebGL|swiftshader/i.test(e)),[])});
  await mi.ctx.close();
 }finally{await browser.close();server.close()}
}
(async()=>{
 if(!args.has('--only-webkit'))await run(chromium,'edge');
 if(args.has('--webkit')||args.has('--only-webkit'))await run(webkit,'webkit');
 const fail=results.filter(r=>r==='FAIL').length;console.log('\n'+(results.length-fail)+'/'+results.length+' PASS');process.exitCode=fail?1:0;
})();
