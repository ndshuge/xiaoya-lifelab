// Real browser smoke for 3D ocean ecology (desktop, touch phone, night, reduced motion).
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const OUT=process.env.XIAOYA_OCEAN_OUTPUT||'E:/CHATGPT/_temp/xiaoya-ocean-qa-20261108';
const BASE=process.env.XIAOYA_OCEAN_URL||'http://127.0.0.1:4455/little-works/xiaoya-apple/opus-original/';
fs.mkdirSync(OUT,{recursive:true});
const results=[];
async function run(browser,{mobile=false,night=false,reduced=false}={}){
 const label=(mobile?'phone':'desktop')+(night?'-night':'')+(reduced?'-reduced':'');
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1,reducedMotion:reduced?'reduce':'no-preference'});
 await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push('JS: '+e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text())});
 await page.clock.setFixedTime(new Date(night?'2026-11-08T21:30:00+08:00':'2026-11-08T11:30:00+08:00'));
 await page.goto(BASE+'?judge=1&intro=0&scene=week');
 await page.waitForFunction(()=>window.__XY_OPUS?.island()?.diagnostics()?.fold===1,{timeout:25000});
 await page.waitForTimeout(300);
 const before=await page.evaluate(()=>window.__XY_OPUS.island().diagnostics());
 assert.equal(before.coast.fish,mobile?6:12,label+': fish count');
 assert.equal(before.coast.taps,0);
 assert.equal(errors.length,0,errors.join('\n'));
 const spot=await page.evaluate(()=>{
   const api=window.__XY_OPUS.island(),host=document.querySelector('.island-host');
   const portrait=host.clientWidth<host.clientHeight*.9;
   const b=portrait?{rx:2.48,rz:4.15}:{rx:4.65,rz:2.7};
   for(const f of [1.14,1.2,1.3,1.4])for(const [x,z] of [[b.rx*f,0],[-b.rx*f,0],[0,b.rz*f],[0,-b.rz*f]]){
     const pos=api.waterAt(x,z);
     if(pos.x>24&&pos.x<host.clientWidth-24&&pos.y>24&&pos.y<host.clientHeight-24&&!api.pickAt(pos.x,pos.y))return pos;
   }return null;
 });
 assert.ok(spot,label+': visible unclaimed sea patch');
 const rect=await page.locator('.island-canvas').boundingBox();
 assert.ok(rect,label+': canvas');
 if(mobile)await page.touchscreen.tap(rect.x+spot.x,rect.y+spot.y);
 else await page.mouse.click(rect.x+spot.x,rect.y+spot.y);
 await page.waitForTimeout(250);
 const after=await page.evaluate(()=>window.__XY_OPUS.island().diagnostics());
 assert.equal(after.coast.taps,reduced?0:1,label+': tap action');
 assert.equal(after.coast.fishSchool.scares,reduced?0:1,label+': fish scare');
 if(!mobile&&!reduced){
    await page.mouse.move(rect.x+spot.x,rect.y+spot.y);
    await page.mouse.down();await page.mouse.move(rect.x+spot.x+70,rect.y+spot.y+15,{steps:8});await page.mouse.up();
    assert.equal((await page.evaluate(()=>window.__XY_OPUS.island().diagnostics())).coast.taps,1,label+': drag is ignored');
 }
 await page.screenshot({path:path.join(OUT,label+'.png')});
 assert.equal(errors.length,0,label+': '+errors.join('\n'));
 results.push({label,ok:true,taps:after.coast.taps,fish:after.coast.fish,dpr:after.dpr,calls:after.calls});
 await ctx.close();
}
async function lighthouseCase(browser){
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
 await page.clock.setFixedTime(new Date('2026-11-08T22:00:00+08:00'));
 await page.goto(BASE+'?judge=1&intro=0&scene=week');
 await page.waitForFunction(()=>window.__XY_OPUS?.island()?.diagnostics()?.fold===1);
 await page.evaluate(()=>{
  const app=window.__XY_OPUS;
  app.store.commit(d=>d.tasks.push({id:'qa-lighthouse-20261108',title:'灯塔夜间验收',due:'2026-11-08T23:00',minutes:30,type:'study',course:'',done:false,remind:false,createdAt:'2026-11-08T00:00:00.000Z',completedAt:null}));
  app.render();
 });
 await page.waitForFunction(()=>window.__XY_OPUS?.island()?.diagnostics()?.coast?.beacon===true);
 await page.waitForTimeout(250);
 const d=await page.evaluate(()=>window.__XY_OPUS.island().diagnostics());
 assert.equal(d.coast.beacon,true);
 assert.equal(errors.length,0,errors.join('\n'));
 await page.screenshot({path:path.join(OUT,'desktop-night-lighthouse.png')});
 results.push({label:'desktop-night-lighthouse',ok:true,beacon:true});
 await ctx.close();
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
   await run(browser);
   await run(browser,{mobile:true});
   await run(browser,{night:true});
   await run(browser,{mobile:true,reduced:true});
   await lighthouseCase(browser);
 }finally{await browser.close()}
 if(process.argv.includes('--webkit')){
   const w=await webkit.launch({headless:true});
   try{await run(w,{mobile:true});}
   finally{await w.close()}
 }
 console.log(JSON.stringify(results,null,2));fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
