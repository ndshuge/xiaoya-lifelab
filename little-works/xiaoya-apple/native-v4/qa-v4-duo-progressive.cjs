const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(err,b)=>err?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{let pass=0,fail=0;await new Promise(r=>server.listen(0,'127.0.0.1',r));const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS',name)}catch(e){fail++;console.log('FAIL',name,String(e.message||e).slice(0,460))}};
try{for(const [label,engine] of [['Edge',chromium],['WebKit',webkit]]){
const b=await engine.launch(label==='Edge'?{channel:'msedge',headless:true}:{headless:true});
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
await check(label+' a single continuous dock-underlay starts above dock and ends at viewport bottom',async()=>{
 const data=await p.evaluate(()=>{const el=document.querySelector('.xy-progressive-underlay');if(!el)return null;const r=el.getBoundingClientRect();return {r:{top:r.top,bottom:r.bottom},dockTop:document.querySelector('#bottom-nav').getBoundingClientRect().top,height:innerHeight,old:getComputedStyle(document.querySelector('.app-frame'),'::after').content,extra:getComputedStyle(document.querySelector('.bottom-nav'),'::after').content,layers:[...el.querySelectorAll('.xy-blur-layer')].map(n=>({blur:getComputedStyle(n).backdropFilter,mask:getComputedStyle(n).maskImage}))}});
 assert.ok(data,'missing unified blur region');assert.ok(data.r.top<data.dockTop-35,JSON.stringify(data));assert.ok(Math.abs(data.r.bottom-data.height)<1,JSON.stringify(data));assert.equal(data.old,'none');assert.equal(data.extra,'none');
 assert.ok(data.layers.length>=4);
 for(const [i,x] of data.layers.entries()){assert.match(x.blur,/blur\(/,'no blur on '+i);assert.match(x.mask,/gradient/,'no gradient mask '+i)}
});
await check(label+' dock underlay removed in secondary screens',async()=>{
 await p.locator('.topbar .toolbar-actions button').click();assert.equal(await p.locator('.xy-progressive-underlay').isVisible(),false);
 await p.locator('.topbar .toolbar-actions button').click();
});
await check(label+' sliding mood group and segmented controls remain flat',async()=>{
 await p.locator('.bottom-nav [data-view=develop]').click();
 const mood=p.locator('.v4-mood-option').nth(2);
 const shadow=await mood.evaluate(e=>getComputedStyle(e).boxShadow);assert.equal(shadow,'none','mood is a selection group, not solo 3D key: '+shadow);
 const segments=p.locator('#workspace .v4-develop-segments button').first();
 assert.equal(await segments.evaluate(e=>getComputedStyle(e).boxShadow),'none');
});
await check(label+' single journal action settles promptly and preserves hitbox',async()=>{
 const button=p.locator('#journal-save');const box=await button.boundingBox();await button.scrollIntoViewIfNeeded();
 const initial=await button.evaluate(e=>getComputedStyle(e).boxShadow);
 assert.match(initial,/3.5px|4px/);
 const down=await button.boundingBox();await p.mouse.move(down.x+down.width/2,down.y+down.height/2);await p.mouse.down();await p.waitForTimeout(85);
 const pressed=await button.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,pressed:e.matches(':active')||e.classList.contains('xy-is-pressed')}));
 assert.equal(pressed.pressed,true);assert.notEqual(pressed.shadow,initial);
 await p.mouse.up();await p.waitForTimeout(260);
 const settle=await button.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,trans:getComputedStyle(e).transitionDuration}));assert.equal(settle.shadow,initial);
 const final=await button.boundingBox();assert.ok(Math.abs(final.width-box.width)<.5);
});
await check(label+' reduced motion and no JS errors',async()=>{await p.emulateMedia({reducedMotion:'reduce'});assert.deepEqual(errors,[])});
await ctx.close();await b.close();
}}finally{await new Promise(r=>server.close(r))}
console.log('DUO_BLUR '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});