const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..'),mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const file=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,body)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(body))
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let ok=0,fail=0;
 const check=async(label,fn)=>{try{await fn();console.log('PASS',label);ok++}catch(e){console.error('FAIL',label,String(e.stack||e).slice(0,1300));fail++}};
 try{for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
  const b=await engine.launch(name==='Edge'?{headless:true,channel:'msedge'}:{headless:true});
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await ctx.newPage(),errors=[];
  page.setDefaultTimeout(8500);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  const drag=async(dx,dy=0,finish=false)=>page.evaluate(async({dx,dy,finish})=>{
   const t=document.querySelector('#xy-student-agent .xy-agent-head h2'),id=887;
   const fire=(type,x,y)=>t.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,isPrimary:true,pointerType:'touch',pointerId:id,button:0,clientX:x,clientY:y}));
   fire('pointerdown',240,320);
   for(let i=1;i<=8;i++){fire('pointermove',240+dx*i/8,320+dy*i/8);await new Promise(r=>setTimeout(r,23))}
   const old=document.querySelector('#workspace > .page'),next=document.querySelector('.xy-swipe-preview');
   const getX=el=>el?new DOMMatrixReadOnly(getComputedStyle(el).transform).m41:null;
   const before={old:getX(old),next:getX(next),route:old?.id,preview:!!next,width:document.querySelector('#workspace').clientWidth};
   if(finish)fire('pointerup',240+dx,320+dy);
   return before;
  },{dx,dy,finish});
  await check(name+' iPhone touch gesture belongs to app, not browser horizontal panning',async()=>{
   const t=await page.locator('#xy-student-agent .xy-agent-head h2').evaluate(e=>{let a=e,chain=[];while(a&&chain.length<14){chain.push({tag:a.tagName,touch:getComputedStyle(a).touchAction});a=a.parentElement}return chain});
   assert.ok(t.some(x=>x.touch.includes('pan-y')),'no pan-y policy in touch ancestors: '+JSON.stringify(t));
  });
  await check(name+' drag remains fully interactive halfway without committing',async()=>{
   const v=await drag(-160,0,false);
   assert.ok(v.preview,'missing incoming page while finger held: '+JSON.stringify(v));
   assert.ok(Math.abs(v.old+160)<4,JSON.stringify(v));
   assert.ok(Math.abs((v.next-v.old)-v.width)<4,JSON.stringify(v));
   assert.equal(v.route,'page-today');
   await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:887,pointerType:'touch'})));
   await page.waitForFunction(()=>!document.querySelector('.xy-swipe-preview'));
   assert.equal(await page.locator('#workspace > .page').getAttribute('id'),'page-today');
  });
  await check(name+' releasing below threshold springs back, releasing over half commits',async()=>{
   await drag(-72,0,true);await page.waitForFunction(()=>!document.querySelector('.xy-swipe-preview'));
   assert.equal(await page.locator('#workspace > .page').getAttribute('id'),'page-today');
   await drag(-217,0,true);await page.waitForFunction(()=>!document.querySelector('.xy-swipe-preview'));
   assert.equal(await page.locator('#workspace > .page').getAttribute('id'),'page-items');
  });
  await check(name+' gesture can begin on tappable content without firing its click',async()=>{
   await page.evaluate(()=>window.__XY_NATIVE_V4.navigate('today'));
   await page.waitForTimeout(850);
   const halfway=await page.evaluate(async()=>{
    const t=document.querySelector('#xy-student-agent .xy-agent-action')||document.querySelector('#xy-student-agent .dayflow-advice-actions button');
    if(!t)throw Error('no suggested action');
    const id=995;
    const fire=(type,x)=>t.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,isPrimary:true,clientX:x,clientY:440,button:0}));
    fire('pointerdown',250);
    for(let i=1;i<=7;i++){fire('pointermove',250-130*i/7);await new Promise(r=>setTimeout(r,16))}
    const old=document.querySelector('#workspace > .page'),preview=document.querySelector('.xy-swipe-preview');
    const state={preview:!!preview,oldX:old?new DOMMatrixReadOnly(getComputedStyle(old).transform).m41:0};
    fire('pointercancel',120);return state;
   });
   assert.ok(halfway.preview&&halfway.oldX < -110,JSON.stringify(halfway));
   await page.waitForFunction(()=>!document.querySelector('.xy-swipe-preview'));
   assert.equal(await page.locator('#workspace > .page').getAttribute('id'),'page-today');
   assert.equal(await page.locator('#editor').evaluate(e=>e.open),false);
  });
  await check(name+' vertical scrolling is not mistaken for a swipe',async()=>{
   await page.locator('.bottom-nav [data-view=today]').evaluate(e=>e.click());
   await page.waitForTimeout(760);
   const v=await drag(-60,170,true);
   assert.equal(v.preview,false);
  });
  await check(name+' agent disclosure rows have bespoke chevrons and adequate tap targets',async()=>{
   const x=await page.locator('#xy-student-agent > .xy-agent-disclosure > summary').evaluateAll(els=>els.map(e=>({h:e.getBoundingClientRect().height,marker:getComputedStyle(e,'::marker').content,before:getComputedStyle(e,'::before').content,after:getComputedStyle(e,'::after').content,display:getComputedStyle(e).display})));
   assert.equal(x.length,2,JSON.stringify(x));
   assert.ok(x.every(v=>v.h>=43),JSON.stringify(x));
   assert.ok(x.every(v=>v.display==='flex'&&v.after!=='none'),JSON.stringify(x));
   await page.locator('#xy-student-agent > .xy-agent-disclosure > summary').first().evaluate(e=>e.click());
   assert.equal(await page.locator('#xy-student-agent > .xy-agent-disclosure').first().evaluate(e=>e.open),true);
   const body=page.locator('#xy-student-agent > .xy-agent-disclosure').first().locator('.xy-agent-disclosure-body');
   assert.equal(await body.count(),1,'missing continuous disclosure body');
   assert.ok(await body.evaluate(e=>e.getAnimations().length)>0,'disclosure content jumps instead of animating');
   await page.waitForTimeout(450);
   await page.locator('#xy-student-agent > .xy-agent-disclosure > summary').first().evaluate(e=>e.click());
   assert.ok(await body.evaluate(e=>e.getAnimations().length)>0,'closing disclosure is abrupt');
   await page.waitForFunction(()=>!document.querySelector('#xy-student-agent > .xy-agent-disclosure').open);
  });
  await check(name+' preserved main Dock and no errors',async()=>{
   assert.equal(await page.locator('.bottom-nav [data-view]').count(),3);
   assert.deepEqual(errors,[]);
  });
  await ctx.close();await b.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('LIVE_DRAG_AGENT_DISCLOSURE '+ok+'/'+(ok+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
