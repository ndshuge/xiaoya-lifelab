const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);
 const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(err,data)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}).end(data))
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 const rect=await page.locator('#xy-student-agent .xy-agent-head h2').boundingBox();assert.ok(rect);
 const y=Math.round(rect.y+rect.height/2),x=250,cdp=await ctx.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-175*i/10,y}]});await page.waitForTimeout(23)}
 const stage=await page.evaluate(()=>{
  const a=document.querySelector('#workspace > .page'),b=document.querySelector('.xy-swipe-preview');
  return{old:a?new DOMMatrixReadOnly(getComputedStyle(a).transform).m41:null,new:b?new DOMMatrixReadOnly(getComputedStyle(b).transform).m41:null,
   page:a?.id};
 });
 assert.ok(stage.old < -145 && stage.new!=null && stage.page==='page-today',JSON.stringify(stage));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>!document.querySelector('.xy-swipe-preview'),{timeout:5000});
 assert.equal(await page.locator('#workspace > .page').getAttribute('id'),'page-items');
 assert.deepEqual(errors,[]);
 console.log('NATIVE_TOUCH_CDP_PASS',JSON.stringify(stage));
 await ctx.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error('NATIVE_TOUCH_CDP_FAIL',e.stack||e);process.exitCode=1});
