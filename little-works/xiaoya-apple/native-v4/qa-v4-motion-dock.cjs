const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const repo=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);else if(p==='/xiaoya-lifelab')p='/';
 const f=path.resolve(repo,'.'+p+(p.endsWith('/')?'index.html':''));
 if(!f.startsWith(repo+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(e,b)=>e?res.writeHead(404).end('missing '+p):res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}).end(b))
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 let good=0,bad=0;const url='http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1';
 async function check(name,fn){try{await fn();console.log('PASS '+name);good++}catch(e){bad++;console.error('FAIL '+name+' '+String(e.message||e).slice(0,600))}}
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  await context.addInitScript(()=>{
   window.__TRANSITION_CALLS=0;
   const original=document.startViewTransition?.bind(document);
   if(original)document.startViewTransition=function(...args){window.__TRANSITION_CALLS++;return original(...args)};
  });
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(3000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await check('mobile dock uses a translucent lens without opaque white veil',async()=>{
   const info=await page.evaluate(()=>{
    const back=getComputedStyle(document.querySelector('.app-frame'),'::after');
    const nav=getComputedStyle(document.querySelector('.bottom-nav'));
    return {veil:back.backgroundImage,veilMask:back.webkitMaskImage||back.maskImage,veilBlur:back.webkitBackdropFilter||back.backdropFilter,
     navColor:nav.backgroundColor,navBlur:nav.webkitBackdropFilter||nav.backdropFilter,pointerEvents:back.pointerEvents};
   });
   assert.match(info.veilMask,/gradient/);assert.match(info.veilBlur,/blur/);
   assert.match(info.navBlur,/blur/);assert.equal(info.pointerEvents,'none');
   const rgba=info.navColor.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
   assert.ok(rgba&&Number(rgba[1])<0.52,'nav opaque alpha '+info.navColor);
   assert.ok(!info.veil.includes('0.96')&&!info.veil.includes('0.75'),'heavy white veil '+info.veil);
  });
  await check('main tab changes synchronously and uses two spatial surfaces',async()=>{
   const origin=await page.locator('#bottom-nav').evaluate(e=>{window.__NAV_NODE=e;return e.id});
   await page.locator('#bottom-nav [data-view=items]').evaluate(el=>el.click());
   const data=await page.evaluate(()=>({
     route:document.querySelector('#workspace .page')?.id,
     navStable:document.querySelector('#bottom-nav')===window.__NAV_NODE,
     direction:document.documentElement.dataset.xyNavDirection,
     leaving:document.querySelectorAll('.xy-route-ghost').length,
     outgoingMotion:[...document.getAnimations()].some(a=>a.effect?.target?.closest?.('.xy-route-ghost'))
   }));
   assert.equal(data.route,'page-items','click did not synchronously update DOM');
   assert.equal(data.navStable,true);
   assert.equal(data.direction,'forward');
   assert.equal(data.leaving,1,'old page lacks its spatial exit surface');
   assert.equal(data.outgoingMotion,true,'old page not animated as separate surface');
   const ghostSafety=await page.evaluate(()=>{
     const ghost=document.querySelector('.xy-route-ghost');
     return {hidden:ghost?.getAttribute('aria-hidden'),inert:ghost?.inert,
       active:ghost?.querySelectorAll('[id],[data-items-tab],[data-develop-tab],[data-action],[data-add],[data-view]').length||0};
   });
   assert.deepEqual(ghostSafety,{hidden:'true',inert:true,active:0},'exiting snapshot contains live controls');
   await page.waitForTimeout(270);
   assert.equal(await page.locator('.xy-route-ghost').count(),0,'outgoing visual layer leaked');
  });
  await check('forward and backward spatial transitions follow primary tab order',async()=>{
   await page.locator('#bottom-nav [data-view=develop]').evaluate(el=>el.click());
   assert.equal(await page.locator('#page-develop').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.xyNavDirection),'forward');
   await page.waitForTimeout(270);
   await page.locator('#bottom-nav [data-view=today]').evaluate(el=>el.click());
   assert.equal(await page.locator('#page-today').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.xyNavDirection),'backward');
   await page.waitForTimeout(270);
   await page.locator('#bottom-nav [data-view=items]').evaluate(el=>el.click());
   assert.equal(await page.locator('#page-items').count(),1);
  });
  await check('rapid tab reversals are interruptible, final page and active tab agree',async()=>{
   for(const target of ['develop','items','today','develop','today','items']){
    await page.locator('#bottom-nav [data-view='+target+']').click({force:true});
   }
   const synchronously=await page.locator('#workspace h1').innerText();
   assert.equal(synchronously,'事项','last click should commit without awaiting animation');
   await page.waitForTimeout(400);
   assert.equal(await page.locator('#workspace h1').innerText(),'事项');
   assert.equal(await page.locator('#bottom-nav .tab.is-active').getAttribute('data-view'),'items');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
  await check('development record/goals segments visibly animate but preserve unfinished diary draft',async()=>{
   await page.locator('#bottom-nav [data-view=develop]').click();await page.locator('#page-develop').waitFor({state:'visible'});
   await page.locator('#journal-note').fill('这条草稿不能因为动效消失');
   await page.locator('[data-develop-tab=goals]').click();await page.locator('[data-develop-panel=goals]').waitFor({state:'visible'});
   assert.equal(await page.locator('#development-goals').isVisible(),true);
   const animation=await page.locator('[data-develop-panel=goals]').evaluate(el=>getComputedStyle(el).transitionDuration);
   assert.notEqual(animation,'0s');
   await page.locator('[data-develop-tab=record]').click();await page.locator('[data-develop-panel=record]').waitFor({state:'visible'});
   assert.equal(await page.locator('#journal-note').inputValue(),'这条草稿不能因为动效消失');
  });
  await check('no visible bottom item is hidden permanently behind the floating dock',async()=>{
   await page.locator('#bottom-nav [data-view=items]').click();await page.locator('#page-items').waitFor({state:'visible'});
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   const d=await page.evaluate(()=>{
     const page=document.querySelector('#workspace'),last=page?.querySelector('.v4-semantic-note')||page?.lastElementChild,nav=document.querySelector('.bottom-nav');
     return {last:last?.getBoundingClientRect().bottom,dock:nav?.getBoundingClientRect().top};
   });
   assert.ok(d.last<d.dock,'last item='+d.last+' dock top='+d.dock);
  });
  await check('long task feed skips expensive snapshot cloning without delaying navigation',async()=>{
    await page.locator('#bottom-nav [data-view=today]').evaluate(el=>el.click());
    await page.waitForTimeout(250);
    await page.evaluate(()=>{
      const host=document.querySelector('#workspace');
      const fragment=document.createDocumentFragment();
      for(let n=0;n<610;n++){const e=document.createElement('span');e.hidden=true;fragment.append(e)}
      host.append(fragment);
    });
    await page.locator('#bottom-nav [data-view=items]').evaluate(el=>el.click());
    assert.equal(await page.locator('#page-items').count(),1);
    assert.equal(await page.locator('.xy-route-ghost').count(),0,'large live DOM should use no-clone fallback');
  });
  await check('reduced-motion respects no travel and reduced-transparency uses solid legible dock',async()=>{
   const alt=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});
   const reduced=await alt.newPage();
   try{await reduced.goto(url,{waitUntil:'networkidle'});
    await reduced.locator('#bottom-nav [data-view=develop]').click();await reduced.locator('#page-develop').waitFor({state:'visible'});
    assert.equal(await reduced.locator('#workspace h1').innerText(),'发展');
    assert.equal(await reduced.locator('.xy-route-ghost').count(),0,'reduced motion must not clone outgoing page');
    const motion=await reduced.evaluate(()=>document.querySelector('#workspace').getAnimations().filter(a=>a.playState==='running').length);
    assert.equal(motion,0,'reduced motion must not start compositor animations');
   }finally{await alt.close()}
  });
  await check('no console errors',async()=>assert.deepEqual(errors,[]));
  await context.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('DOCK_MOTION_QA '+good+'/'+(good+bad));if(bad)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
