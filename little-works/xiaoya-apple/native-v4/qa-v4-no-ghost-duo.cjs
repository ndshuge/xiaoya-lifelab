const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const MIME={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let pass=0,fail=0;const check=async(n,fn)=>{try{await fn();pass++;console.log('PASS '+n)}catch(e){fail++;console.log('FAIL '+n+' '+String(e.message||e).slice(0,600))}};
try{for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
const b=await engine.launch(name==='Edge'?{channel:'msedge',headless:true}:{headless:true});
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});
const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
await check(name+' no old-screen clone at any navigation frame',async()=>{
 for(const view of ['items','develop','today','items','develop','today']){
   await p.locator('#bottom-nav [data-view='+view+']').evaluate(e=>e.click());
   const state=await p.evaluate(()=>({ghost:document.querySelectorAll('.xy-route-ghost').length,
     stale:document.querySelectorAll('[aria-hidden=true].xy-route-ghost').length,
     count:document.querySelectorAll('#workspace .page').length,active:document.body.dataset.view,
     opacity:getComputedStyle(document.querySelector('#workspace')).opacity}));
   assert.equal(state.ghost,0,JSON.stringify(state));assert.equal(state.stale,0);
   assert.equal(state.active,view);assert.equal(state.opacity,'1');
 }
 await p.waitForTimeout(230);assert.equal(await p.locator('.xy-route-ghost').count(),0);
});
await check(name+' mood button is raised, goes down and returns',async()=>{
 await p.locator('#bottom-nav [data-view=develop]').click();
 await p.locator('#bottom-nav [data-view=develop]').click();
 const mood=p.locator('.v4-mood-option').nth(3);
 const rest=await mood.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,pad:e.getBoundingClientRect().height}));
 assert.match(rest.shadow,/2px|3px|4px/,'mood has no tactile depth '+rest.shadow);
 const box=await mood.boundingBox();
 await mood.hover();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.waitForTimeout(75);
 const held=await mood.evaluate(e=>({pressed:e.classList.contains('xy-is-pressed'),shadow:getComputedStyle(e).boxShadow}));
 assert.equal(held.pressed,true);assert.notEqual(held.shadow,rest.shadow,'depth stays raised on press');
 await p.mouse.up();await p.waitForTimeout(90);
 assert.equal(await p.locator('.v4-mood-option').nth(3).getAttribute('aria-pressed'),'true');
 const active=await p.locator('.v4-mood-option').nth(3).evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().duration>=230).length);
 assert.ok(active>0,'mood feedback lost on re-render');
});
await check(name+' mood selection is the one emphasized 3D key',async()=>{
 const chosen=p.locator('.v4-mood-option.is-active');
 const other=p.locator('.v4-mood-option:not(.is-active)').first();
 assert.equal(await chosen.count(),1);
 const chosenLip=await chosen.evaluate(e=>getComputedStyle(e).boxShadow);
 const otherLip=await other.evaluate(e=>getComputedStyle(e).boxShadow);
 assert.match(chosenLip,/4px/,chosenLip);
 assert.ok(otherLip==='none'||/2px/.test(otherLip),'all mood keys look equally heavy: '+otherLip);
});
await check(name+' primary journal action has tangible shadow and held press',async()=>{
 const c=p.locator('#journal-save');await c.scrollIntoViewIfNeeded();
 const initial=await c.evaluate(e=>getComputedStyle(e).boxShadow);assert.match(initial,/3px|4px/,'no depth '+initial);
 await c.hover();const bb=await c.boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);
 await p.mouse.down();await p.waitForTimeout(100);
 assert.notEqual(await c.evaluate(e=>getComputedStyle(e).boxShadow),initial,'journal action shadow unchanged');
 await p.mouse.up();
});
await check(name+' reduced motion disables depth travel without losing focus',async()=>{
 await p.emulateMedia({reducedMotion:'reduce'});
 const mood=p.locator('.v4-mood-option').nth(2);await mood.focus();
 const state=await mood.evaluate(e=>({duration:getComputedStyle(e).transitionDuration,focused:document.activeElement===e}));
 assert.equal(state.focused,true);assert.ok(state.duration.split(',').every(t=>parseFloat(t)<.05),JSON.stringify(state));
});
await check(name+' textual actions stay flat without faux underline',async()=>{
 await p.locator('#bottom-nav [data-view=items]').click();
 const link=p.locator('#workspace .v4-section-title button[data-add]').first();
 assert.ok(await link.count()>0,'missing text action');
 const shadow=await link.evaluate(e=>getComputedStyle(e).boxShadow);
 assert.equal(shadow,'none','link acquires a thick edge: '+shadow);
});
await check(name+' no runtime errors',async()=>assert.deepEqual(errors,[]));
await ctx.close();await b.close();
}}finally{await new Promise(r=>server.close(r))}
console.log('NO_GHOST_DUO '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
