const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(rel.startsWith('/xiaoya-lifelab/'))rel=rel.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+rel+(rel.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(err,data)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}).end(data));
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let ok=0,no=0;
 const check=async(name,fn)=>{try{await fn();ok++;console.log('PASS',name)}catch(e){no++;console.error('FAIL',name,e.message)}};
 try{for(const [browserName,engine] of [['Edge',chromium],['WebKit',webkit]]){
  const b=await engine.launch(browserName==='Edge'?{headless:true,channel:'msedge'}:{headless:true});
  const context=await b.newContext({viewport:{width:390,height:844},hasTouch:true});
  const p=await context.newPage();p.setDefaultTimeout(6500);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  const slide=async (distance,start=200)=>p.evaluate(async({distance,start})=>{
   const t=document.querySelector('#workspace .page-heading h1'),id=841;
   const fire=(type,x,y=250)=>t.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,isPrimary:true,clientX:x,clientY:y,button:0}));
   fire('pointerdown',start);
   for(let step=1;step<=5;step++){fire('pointermove',start+distance*step/5);await new Promise(r=>setTimeout(r,18))}
   const old=document.querySelector('#workspace > .page'),next=document.querySelector('.xy-swipe-preview');
   const before={from:old?getComputedStyle(old).transform:null,to:next?getComputedStyle(next).transform:null,oldChildTransform:old?.querySelector('.page-heading h1')?.style.transform||'',previewInert:next?.inert,
     w:document.querySelector('#workspace').clientWidth};
   fire('pointerup',start+distance);
   return before;
  },{distance,start});
  await check(browserName+' two static screen canvases move together',async()=>{
   const state=await slide(-92);
   assert.ok(state.to&&state.from,'two surfaces missing');
   assert.equal(state.previewInert,true);
   const tr=x=>Number(x.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([^,]+)/)?.[1]||NaN);
   assert.ok(Math.abs(tr(state.to)-tr(state.from)-state.w)<3,JSON.stringify(state));
   assert.equal(state.oldChildTransform,'');
   await p.waitForFunction(()=>!document.querySelector('.xy-swipe-preview'));
   assert.equal(await p.locator('#workspace > .page').count(),1);
   assert.equal(await p.locator('.xy-swipe-preview').count(),0);
  });
  await check(browserName+' primary nav click slides a rigid old page out and new page in',async()=>{
   await p.evaluate(()=>window.__XY_NATIVE_V4.navigate('today'));
   await p.waitForTimeout(420);
   await p.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
   const v=await p.evaluate(()=>({out:document.querySelector('.xy-route-outgoing')?.getAnimations().length,
      incoming:document.querySelector('#workspace > .page:not(.xy-route-outgoing)')?.getAnimations().length,route:document.querySelector('#workspace > .page:not(.xy-route-outgoing)')?.id}));
   assert.equal(v.route,'page-items');assert.ok(v.out>0&&v.incoming>0,JSON.stringify(v));
   await p.waitForTimeout(830);
   assert.equal(await p.locator('.xy-route-outgoing').count(),0);
  });
  await check(browserName+' assistant enters from above entire panel without scaling',async()=>{
   await p.locator('#xiaoya-avatar').evaluate(e=>e.click());
   const k=await p.locator('#xiaoya-assistant').evaluate(e=>e.getAnimations().flatMap(a=>a.effect?.getKeyframes?.()||[]));
   assert.ok(k.length>0);
   const t=k.map(x=>x.transform||'').join(';');
   assert.ok(/translate/i.test(t)&&!/scale/i.test(t),t);
   assert.ok(/-\d{3,}/.test(t),'not full panel top entrance: '+t);
   await p.waitForTimeout(470);
   await p.locator('#assistant-close').evaluate(e=>e.click());
   const closing=await p.locator('#xiaoya-assistant').evaluate(e=>e.getAnimations().flatMap(a=>a.effect?.getKeyframes?.()||[]).map(x=>x.transform||'').join(';'));
   assert.ok(/-\d{3,}/.test(closing)&&!/scale/i.test(closing),closing);
   await p.waitForTimeout(780);
   assert.equal(await p.locator('#xiaoya-assistant').evaluate(e=>e.hidden),true);
  });
  await check(browserName+' no ghosts, no Dock changes, no JS crashes',async()=>{
   assert.equal(await p.locator('.bottom-nav [data-view]').count(),3);
   assert.equal(await p.locator('.xy-route-ghost').count(),0);
   assert.deepEqual(errors,[]);
  });
  await context.close();await b.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('TWO_SCREEN_TOP_ASSISTANT '+ok+'/'+(ok+no));if(no)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
