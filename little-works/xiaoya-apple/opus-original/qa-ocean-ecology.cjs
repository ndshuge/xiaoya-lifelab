const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const BASE=process.env.XIAOYA_QA_URL||'http://127.0.0.1:4466/little-works/xiaoya-apple/opus-original/';
const OUT=path.resolve(__dirname,'../../../docs/qa/evidence/2026-11-08-ocean');
fs.mkdirSync(OUT,{recursive:true});
async function sample(browser,label,{mobile=false,night=false,reduced=false}={}){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1,reducedMotion:reduced?'reduce':'no-preference'});
 const p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push('page: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await ctx.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.fulfill({status:200,contentType:'text/css',body:''}));
 await p.clock.setFixedTime(new Date(night?'2026-11-06T21:30:00+08:00':'2026-11-06T10:30:00+08:00'));
 await p.goto(BASE+'?judge=1&intro=0&scene=week',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__XY_OPUS?.island()?.diagnostics().fold===1,{timeout:15000});
 await p.waitForTimeout(380);
 const diag=()=>p.evaluate(()=>window.__XY_OPUS.island().diagnostics());
 const before=await diag();
 assert.ok(before.coast,'coastal module running');
 assert.equal(before.coast.fishCount,mobile?4:8);
 if(night)assert.ok(before.nightBeams>0,'night deadline lighthouse beam');
 else assert.equal(before.nightBeams,0);
 assert.ok(before.calls<400,'unexpected draw call blowup: '+before.calls);
 if(!night){
   const rect=await p.locator('.island-canvas').boundingBox();
   const bounds=mobile?{rx:2.48,rz:4.15}:{rx:4.65,rz:2.7};
   const positions=[1.14,1.28,1.45,1.7].flatMap(r=>Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return [Math.cos(a)*bounds.rx*r,Math.sin(a)*bounds.rz*r]}));
   let touched=false;
   for(const [x,z] of positions){
     const point=await p.evaluate(([x,z])=>window.__XY_OPUS.island().seaAt(x,z),[x,z]);
     const px=point.x,py=point.y;
     if(px<8||py<8||px>rect.width-8||py>rect.height-8)continue;
     const pick=await p.evaluate(([x,y])=>window.__XY_OPUS.island().pickAt(x,y),[px,py]);
     if(pick)continue;
     if(mobile)await p.touchscreen.tap(rect.x+px,rect.y+py);
     else await p.mouse.click(rect.x+px,rect.y+py);
     await p.waitForTimeout(60);
     if((await diag()).coast.waterTaps>before.coast.waterTaps){touched=true;break;}
   }
   if(reduced)assert.equal(touched,false,'reduced motion suppresses tapping ripples');
   else assert.ok(touched,'at least one unclaimed sea click should create a ripple');
   if(!mobile){const b=await diag();const x=rect.x+rect.width*.15,y=rect.y+rect.height*.4;
     await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+140,y+5,{steps:4});await p.mouse.up();await p.waitForTimeout(80);
     assert.equal((await diag()).coast.waterTaps,b.coast.waterTaps,'drag should not be a tap');
   }
 }
 const final=await diag();
 assert.deepEqual(errors,[],'JS/WebGL console errors');
 await p.screenshot({path:path.join(OUT,label+'.png'),animations:'disabled'});
 await ctx.close();
 return {label,fish:final.coast.fishCount,taps:final.coast.waterTaps,nightBeams:final.nightBeams,calls:final.calls,triangles:final.triangles};
}
(async()=>{
 const results=[];
 const edge=await chromium.launch({channel:'msedge',headless:true});
 try{
   results.push(await sample(edge,'desktop-day'));
   results.push(await sample(edge,'mobile-day',{mobile:true}));
   results.push(await sample(edge,'desktop-night',{night:true}));
   results.push(await sample(edge,'mobile-reduced',{mobile:true,reduced:true}));
 }finally{await edge.close();}
 if(process.argv.includes('--webkit')){
   const wk=await webkit.launch({headless:true});
   try{results.push(await sample(wk,'webkit-day'));}finally{await wk.close();}
 }
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
