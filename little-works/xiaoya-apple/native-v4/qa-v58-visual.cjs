const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const output=path.join(root,'docs','qa','evidence','2026-11-05-xiaoya-live-drag-agent-disclosure');
fs.mkdirSync(output,{recursive:true});
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const file=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'}).end(data));
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let total=0;
 try{for(const [name,engine] of [['edge',chromium],['webkit',webkit]]){
 const b=await engine.launch(name==='edge'?{headless:true,channel:'msedge'}:{headless:true});
 for(const [width,dark] of [[390,false],[320,true]]){
  const ctx=await b.newContext({viewport:{width,height:844},hasTouch:true,colorScheme:dark?'dark':'light'});
  const page=await ctx.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
  const snap=async tag=>{await page.screenshot({path:path.join(output,[name,width,dark?'dark':'light',tag].join('-')+'.png')});total++};
  await snap('agent-folded');
  await page.locator('#xy-student-agent > .xy-agent-disclosure > summary').first().evaluate(e=>e.click());
  await page.waitForTimeout(380);await snap('agent-first-open');
  await page.locator('#xy-student-agent > .xy-agent-disclosure > summary').last().evaluate(e=>e.click());
  await page.waitForTimeout(380);await snap('agent-both-open');
  await page.evaluate(async()=>{
   const t=document.querySelector('#xy-student-agent .xy-agent-head h2'),id=664;
   const fire=(type,x)=>t.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,isPrimary:true,pointerType:'touch',pointerId:id,clientX:x,clientY:305,button:0}));
   fire('pointerdown',245);
   for(let i=1;i<=9;i++){fire('pointermove',245-180*i/9);await new Promise(r=>setTimeout(r,18))}
  });
  await snap('halfway-drag');
  const state=await page.evaluate(()=>({old:document.querySelector('#workspace > .page')?.getBoundingClientRect().left,next:document.querySelector('.xy-swipe-preview')?.getBoundingClientRect().left,workspace:document.querySelector('#workspace')?.getBoundingClientRect().left}));
  assert.ok(state.next!=null,'no halfway destination');
  await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerType:'touch',pointerId:664})));
  await page.waitForFunction(()=>!document.querySelector('.xy-swipe-preview'));
  assert.deepEqual(errors,[]);
  console.log('VISUAL_PASS',name,width,JSON.stringify(state));
  await ctx.close();
 }
 await b.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('V58_VISUAL_CAPTURES',total);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
