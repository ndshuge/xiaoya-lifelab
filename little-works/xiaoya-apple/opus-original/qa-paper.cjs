// Runs the real local app in isolated demo browser contexts; no personal archive or model calls.
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const OUT=process.env.XIAOYA_QA_OUTPUT||path.resolve(__dirname,'../../../docs/qa/evidence/2026-11-06-paper-fold');
const BASE=process.env.XIAOYA_QA_URL||'http://127.0.0.1:4428/little-works/xiaoya-apple/opus-original/';
fs.mkdirSync(OUT,{recursive:true});
const results=[],metrics={};
async function check(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message.split('\n')[0]);}}
const diag=p=>p.evaluate(()=>window.__XY_OPUS.island().diagnostics());
const settle=async p=>{await p.waitForFunction(()=>window.__XY_OPUS?.island()?.diagnostics().fold===1);await p.waitForTimeout(180);};
async function make(browser,mobile=false,reduced=false,video=false){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:860},deviceScaleFactor:mobile?2:1,hasTouch:mobile,isMobile:mobile,reducedMotion:reduced?'reduce':'no-preference',...(video?{recordVideo:{dir:path.join(OUT,'motion'),size:{width:1280,height:860}}}:{})});
 await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.setFixedTime(new Date('2026-11-06T10:30:00+08:00'));
 await p.goto(BASE+'?judge=1&intro=0');await p.getByRole('tab',{name:'周',exact:true}).click();await settle(p);return {context,p,errors};
}
async function pick(p,kind){const b=await p.locator('.island-host').boundingBox();const pt=await p.evaluate(kind=>{const api=window.__XY_OPUS.island(),at=api.locate(kind);if(!at)return null;for(let d=0;d<50;d+=5)for(const [x,y] of [[at.x+d,at.y],[at.x-d,at.y],[at.x,at.y+d],[at.x,at.y-d]])if(api.pickAt(x,y)===kind)return {x,y};return null;},kind);assert.ok(pt,'visible hit target for '+kind);await p.mouse.click(b.x+pt.x,b.y+pt.y);}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const {context,p,errors}=await make(browser,false,false,true);
  await check('desktop renders authored puppet and paper models',async()=>{assert.equal((await diag(p)).puppet,'xiaoya-paper-puppet');assert.ok(await p.locator('.island-canvas').isVisible());metrics.desktop=await diag(p);await p.screenshot({path:path.join(OUT,'desktop.png')});});
  await check('close view and overview retain the live scene and accessible zoom state',async()=>{await p.getByRole('button',{name:'近看',exact:true}).click();await p.waitForTimeout(500);await p.screenshot({path:path.join(OUT,'close-view.png')});assert.equal(await p.getByRole('button',{name:'全景',exact:true}).getAttribute('aria-pressed'),'true');await p.getByRole('button',{name:'全景',exact:true}).click();await p.waitForTimeout(500);assert.equal(await p.getByRole('button',{name:'近看',exact:true}).getAttribute('aria-pressed'),'false');});
  await check('fold, reverse midway, replay and range endpoints remain usable',async()=>{
   const data=await p.evaluate(()=>{const d=window.__XY_OPUS.getData();return JSON.stringify({tasks:d.tasks,schedule:d.schedule,goals:d.goals,checkins:d.checkins})});
   await p.getByRole('button',{name:'收起',exact:true}).click();await p.waitForTimeout(500);await p.getByRole('button',{name:'展开',exact:true}).click();await settle(p);
   const slider=p.getByRole('slider',{name:'纸岛展开程度'});await slider.focus();await slider.press('Home');assert.equal((await diag(p)).fold,0);await p.screenshot({path:path.join(OUT,'folded.png')});
   for(let i=0;i<45;i++)await slider.press('ArrowRight');assert.ok(Math.abs((await diag(p)).fold-.45)<.02);await p.screenshot({path:path.join(OUT,'fold-45.png')});await slider.press('End');await settle(p);
   await p.getByRole('button',{name:'重播纸岛展开'}).click();await settle(p);
   const after=await p.evaluate(()=>{const d=window.__XY_OPUS.getData();return JSON.stringify({tasks:d.tasks,schedule:d.schedule,goals:d.goals,checkins:d.checkins})});assert.equal(after,data);
  });
  await check('drag rotates the island and a real day target still opens its day',async()=>{const b=await p.locator('.island-host').boundingBox(),before=(await diag(p)).yaw;await p.mouse.move(b.x+b.width*.3,b.y+b.height*.8);await p.mouse.down();await p.mouse.move(b.x+b.width*.3+90,b.y+b.height*.8,{steps:12});await p.mouse.up();await p.waitForTimeout(350);assert.ok(Math.abs((await diag(p)).yaw-before)>.05);await pick(p,'day');await p.locator('.day').waitFor();await p.getByRole('tab',{name:'周',exact:true}).click();await settle(p);});
  await check('puppet has real hit targets and its speech opens the existing conversation',async()=>{await pick(p,'xiaoya');await p.locator('.island-say:not([hidden])').waitFor();await p.screenshot({path:path.join(OUT,'puppet-speech.png')});await p.getByRole('button',{name:'和小芽聊聊'}).click();await p.locator('#talk:not([hidden])').waitFor();await p.locator('.icon-x').click();});
  await check('unchanged renders reuse the scene without growing resources',async()=>{const before=await diag(p);for(let i=0;i<5;i++){await p.evaluate(()=>window.__XY_OPUS.render());await p.waitForTimeout(100);}const after=await diag(p);assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);await p.getByRole('button',{name:'收起',exact:true}).click();await p.waitForFunction(()=>window.__XY_OPUS.island().diagnostics().fold===0);await p.getByRole('button',{name:'展开',exact:true}).click();await settle(p);});
  await check('season view opens real week records',async()=>{await p.getByRole('tab',{name:'长线',exact:true}).click();await settle(p);await p.screenshot({path:path.join(OUT,'season.png')});await pick(p,'week');await p.locator('.week').waitFor();await settle(p);});
  // Unpaused motion: complete unfold, locomotion and the greeting response.
  await p.getByRole('button',{name:'重播纸岛展开'}).click();await p.waitForTimeout(4200);await pick(p,'xiaoya');await p.waitForTimeout(2500);
  const video=p.video();await context.close();metrics.motionFile=await video.path();assert.equal(errors.length,0,errors.join('\n'));
  const mobile=await make(browser,true);await check('phone 390px stays inside viewport and renders touch controls',async()=>{const {p}=mobile;assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=390));metrics.mobile=await diag(p);await p.screenshot({path:path.join(OUT,'mobile.png')});const b=await p.getByRole('button',{name:'重播纸岛展开'}).boundingBox();assert.ok(b.height>=40);await p.getByRole('button',{name:'收起',exact:true}).tap();await p.waitForFunction(()=>window.__XY_OPUS.island().diagnostics().fold===0);await p.getByRole('button',{name:'展开',exact:true}).tap();await settle(p);assert.equal(mobile.errors.length,0);});await mobile.context.close();
  const reduced=await make(browser,false,true);await check('reduced motion changes directly to the requested endpoint',async()=>{const {p}=reduced;await p.getByRole('button',{name:'收起',exact:true}).click();assert.equal((await diag(p)).fold,0);await p.getByRole('button',{name:'展开',exact:true}).click();assert.equal((await diag(p)).fold,1);assert.equal(reduced.errors.length,0);});await reduced.context.close();
  const introCtx=await browser.newContext({viewport:{width:1280,height:860}}),intro=await introCtx.newPage();await intro.goto(BASE+'?judge=1&intro=1');await check('opening can be skipped midfold without leaving controls or canvas behind',async()=>{await intro.locator('.intro .island-canvas').waitFor();await intro.getByRole('button',{name:'跳过',exact:true}).click();await intro.locator('.intro').waitFor({state:'detached'});assert.equal(await intro.locator('.intro-stage').count(),0);await intro.getByRole('tab',{name:'周',exact:true}).click();await settle(intro);});await introCtx.close();
 }finally{await browser.close();}
 if(process.argv.includes('--webkit')){const w=await webkit.launch({headless:true});try{const a=await make(w);await check('WebKit paper scene unfolds and closes without page errors',async()=>{await a.p.getByRole('button',{name:'收起',exact:true}).click();await a.p.waitForFunction(()=>window.__XY_OPUS.island().diagnostics().fold===0);assert.equal(a.errors.length,0);metrics.webkit=await diag(a.p);});await a.context.close();}finally{await w.close();}}
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({results,metrics},null,2));console.log(`${results.filter(r=>r.pass).length}/${results.length} passed`);if(results.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(OUT,'failure.json'),JSON.stringify({results,metrics,error:e.message},null,2));process.exitCode=1;});
