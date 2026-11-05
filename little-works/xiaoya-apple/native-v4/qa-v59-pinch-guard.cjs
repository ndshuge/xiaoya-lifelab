const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(rel.startsWith('/xiaoya-lifelab/'))rel=rel.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+rel+(rel.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let pass=0,fail=0;
 async function check(label,fn){try{await fn();console.log('PASS',label);pass++}catch(e){console.log('FAIL',label,String(e.message||e).slice(0,780));fail++}}
 try{for(const [name,type] of [['Edge',chromium],['WebKit',webkit]]){
  const b=await type.launch(name==='Edge'?{headless:true,channel:'msedge'}:{headless:true});
  for(const width of [320,390]){
   const ctx=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
   await check(name+' '+width+' viewport explicitly requests fixed scaling',async()=>{
    const m=await page.locator('meta[name=viewport]').getAttribute('content');
    assert.match(m,/user-scalable\s*=\s*no/);assert.match(m,/maximum-scale\s*=\s*1(?:,|$)/);
   });
   await check(name+' '+width+' browser touch-action cannot pinch on page',async()=>{
    const c=await page.evaluate(()=>['html','body','#workspace'].map(s=>({s,touch:getComputedStyle(document.querySelector(s)).touchAction})));
    assert.ok(c.every(x=>x.touch.includes('pan-y')&&!x.touch.includes('pinch-zoom')),JSON.stringify(c));
   });
   await check(name+' '+width+' cancel Safari gesturestart/change',async()=>{
    const state=await page.evaluate(()=>{
     const g1=new Event('gesturestart',{bubbles:true,cancelable:true}),g2=new Event('gesturechange',{bubbles:true,cancelable:true});
     document.querySelector('#workspace').dispatchEvent(g1);document.querySelector('#workspace').dispatchEvent(g2);
     return [g1.defaultPrevented,g2.defaultPrevented]});
    assert.deepEqual(state,[true,true]);
   });
   await check(name+' '+width+' prevent only 2+ touch fingers; preserve single drag',async()=>{
    const out=await page.evaluate(()=>{
     const make=(count,kind)=>{const e=new Event(kind,{bubbles:true,cancelable:true});
      Object.defineProperty(e,'touches',{value:Array.from({length:count},(_,i)=>({identifier:i}))});
      document.querySelector('#workspace').dispatchEvent(e);return e.defaultPrevented};
     return{oneStart:make(1,'touchstart'),oneMove:make(1,'touchmove'),twoStart:make(2,'touchstart'),twoMove:make(2,'touchmove')}
    });
    assert.deepEqual(out,{oneStart:false,oneMove:false,twoStart:true,twoMove:true});
   });
   await check(name+' '+width+' navigation, assistant toggle, Dock, and JS healthy',async()=>{
    assert.equal(await page.locator('.bottom-nav [data-view]').count(),3);
    await page.locator('.bottom-nav [data-view=items]').evaluate(e=>e.click());
    await page.waitForFunction(()=>!document.querySelector('.xy-route-outgoing'));
    assert.equal(await page.locator('#workspace > .page').getAttribute('id'),'page-items');
    await page.locator('#xiaoya-avatar').evaluate(e=>e.click());
    await page.locator('#xiaoya-avatar').evaluate(e=>e.click());
    await page.waitForFunction(()=>document.querySelector('#xiaoya-assistant').hidden);
    assert.deepEqual(errors,[]);
   });
   await ctx.close();
  }
  await b.close();
 }}finally{await new Promise(r=>server.close(r))}
 console.log('V59_PINCH_ZOOM_GUARD '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
