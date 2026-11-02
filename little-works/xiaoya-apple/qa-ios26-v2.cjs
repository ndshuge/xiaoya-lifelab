// Product-level browser verification. Isolated contexts: no real keys/user storage.
const {chromium,webkit}=require('playwright-core');
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../../docs/xiaoya-apple-next-qa/ios26-v2-test');
fs.mkdirSync(dir,{recursive:true});
const url='http://127.0.0.1:5397/little-works/xiaoya-apple/';
const results=[],checks=[];
function check(ok,name,extra){checks.push({ok:!!ok,name,extra});if(!ok)console.error('FAIL',name,JSON.stringify(extra));}
async function run(kind,launch,width){
 const browser=await launch.launch(kind==='edge'?(process.env.XIAOYA_BROWSER_CHANNEL==='chromium'?{headless:true}:{channel:'msedge',headless:true}):{headless:true});
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:kind==='webkit',reducedMotion:'no-preference'});
 const p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text().slice(0,140))});
 try{
   await p.goto(url,{waitUntil:'domcontentloaded',timeout:19000});
   await p.waitForTimeout(1000);
   if(await p.locator('#xy-onboard').isVisible())await p.locator('#xy-local').evaluate(x=>x.click());
   await p.waitForTimeout(350);
   const initial=await p.evaluate(()=>{
     const d=document.querySelector('.mobile-tabs'),r=d.getBoundingClientRect(),focus=document.querySelector('.topbar .icon-button[data-view="settings"]');
     return {runtime:window.__XIAOYA_IOS26_V2?.state,glass:d.dataset.glass,
       navX:r.x,navY:r.y,navBottom:innerHeight-r.bottom,navW:r.width,navH:r.height,
       settingsTopVisible:getComputedStyle(focus).display!=='none',
       visibleTabs:[...d.querySelectorAll('button[data-view]')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.dataset.view),
       overflow:document.documentElement.scrollWidth-innerWidth};
   });
   check(!!initial.runtime,kind+width+' new shell initialized');
   check(initial.overflow<=1,kind+width+' no horizontal overflow',initial.overflow);
   if(width<=790){
     check(initial.navBottom>=0&&initial.navBottom<65,kind+width+' dock aligned to viewport bottom',initial.navBottom);
     check(initial.navH>=58&&initial.navH<86,kind+width+' compact dock height',initial.navH);
     check(initial.visibleTabs.length===5,kind+width+' five-tab navigation',initial.visibleTabs);
     check(initial.settingsTopVisible,kind+width+' settings stays accessible');
   }
   await p.screenshot({path:path.join(dir,kind+'-today-'+width+'.png')});
   const navSel=width<=790?'.mobile-tabs>button[data-view]':'.sidebar button[data-view]';
   for(const view of ['schedule','tasks','goals','review','today']){
     const b=p.locator(navSel+'[data-view="'+view+'"]').first();
     await b.evaluate(x=>x.click());await p.waitForFunction(v=>document.querySelector('#view-'+v)?.classList.contains('active'),view,{timeout:2200});
     check(await p.locator('#view-'+view+'.active').count()===1,kind+width+' nav '+view);
   }
   await p.locator('.topbar .top-actions>.icon-button[data-view="settings"]').evaluate(x=>x.click());
   await p.waitForFunction(()=>document.querySelector('#view-settings')?.classList.contains('active'),null,{timeout:2200});
   check(await p.locator('#view-settings.active').count()===1,kind+width+' settings via top');
   await p.screenshot({path:path.join(dir,kind+'-settings-'+width+'.png')});
   await p.locator(navSel+'[data-view="tasks"]').first().evaluate(x=>x.click());
   await p.waitForTimeout(500);
   const source=p.locator('#view-tasks [data-add="task"]').first();
   await source.evaluate(x=>x.click());await p.waitForTimeout(350);
   check(await p.locator('#modal-root').evaluate(x=>!x.hidden),kind+width+' sheet opens');
   if(kind==='edge'&&width===390){
     await p.screenshot({path:path.join(dir,'edge-sheet-390.png')});
     const header=p.locator('#modal-root .modal-header'),r=await header.boundingBox();
     const cdp=await context.newCDPSession(p);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+33,id:11}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width/2,y:r.y+88,id:11}]});
     const dragged=await p.locator('#modal-root .modal-card').evaluate(el=>el.style.transform);
     check(dragged.includes('translate3d'),kind+width+' sheet follows touch',dragged);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await p.waitForTimeout(500);
     check(await p.locator('#modal-root').evaluate(x=>!x.hidden),kind+width+' short swipe cancels and stays open');
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+33,id:12}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width/2,y:r.y+210,id:12}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await p.waitForTimeout(600);
     check(await p.locator('#modal-root').evaluate(x=>x.hidden),kind+width+' long swipe dismisses sheet');
     // Touch drag across the actual native refractive dock (not a simulated click).
     const firstRect=await p.locator('.mobile-tabs>button[data-view="tasks"]').boundingBox();
     const goalRect=await p.locator('.mobile-tabs>button[data-view="goals"]').boundingBox();
     const sy=firstRect.y+firstRect.height/2;
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:firstRect.x+firstRect.width/2,y:sy,id:21}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:goalRect.x+goalRect.width/2-18,y:sy,id:21}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:goalRect.x+goalRect.width/2,y:sy,id:21}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await p.waitForTimeout(420);
     const gesture=await p.evaluate(()=>window.__XIAOYA_IOS26_V2.state);
     check(gesture.swipes>0,kind+width+' dock scrub accepted as touch gesture',gesture);
     check(await p.locator('#view-goals.active').count()===1,kind+width+' dock scrub navigates');
     await p.locator('.mobile-tabs>button[data-view="tasks"]').evaluate(b=>b.click());await p.waitForTimeout(220);
   }else{
     await p.locator('#modal-root [data-close]').last().evaluate(x=>x.click());
     await p.waitForTimeout(400);
   }
   // Genuine business path in a disposable browser context.
   await p.waitForFunction(()=>document.querySelector('#modal-root')?.hidden,null,{timeout:4500});
   await p.locator(navSel+'[data-view="tasks"]').first().evaluate(x=>x.click());
   await p.waitForFunction(()=>document.querySelector('#view-tasks')?.classList.contains('active'),null,{timeout:3500});
   await source.evaluate(x=>x.click());
   try { await p.locator('#f-title').waitFor({state:'visible',timeout:3500}); }
   catch(err){
     const state=await p.evaluate(()=>({active:document.querySelector('.view.active')?.id,modalHidden:document.querySelector('#modal-root')?.hidden,modalTitle:document.querySelector('#modal-title')?.textContent,form:document.querySelector('#edit-form')?.id,closing:!!document.querySelector('#modal-root .modal-card')?.getAnimations().length}));
     console.log('REOPEN_DIAGNOSTIC',kind,width,JSON.stringify(state));
     if(state.modalHidden){await source.evaluate(x=>x.click());await p.locator('#f-title').waitFor({state:'visible',timeout:3500})}
     else throw err;
   }
   await p.locator('#f-title').fill('ios26回归校验任务');
   await p.locator('#f-due').fill('2026-11-15T18:00');
   await p.locator('#edit-form button[type=submit]').evaluate(x=>x.click());
   await p.waitForTimeout(250);
   check(await p.evaluate(()=>OPC_TEST.getData().tasks.some(x=>x.title==='ios26回归校验任务')),kind+width+' creates real task');
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(700);
   check(await p.evaluate(()=>OPC_TEST.getData().tasks.some(x=>x.title==='ios26回归校验任务')),kind+width+' persists task across reload');
   await p.locator(navSel+'[data-view="today"]').first().evaluate(x=>x.click());
   await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await p.waitForTimeout(500);
   // Last meaningful content can scroll above dock, including Safari scroll chrome.
   const bottom=await p.evaluate(()=>{
     const d=document.querySelector('.mobile-tabs').getBoundingClientRect(),e=document.querySelector('#view-today');
     const last=[...e.querySelectorAll('button,a,input,summary,p,strong')].filter(n=>n.getClientRects().length).at(-1);
     return {scrollY,scrollHeight:document.documentElement.scrollHeight,viewBottom:e.getBoundingClientRect().bottom,dockTop:d.top,dockBottom:d.bottom,
       last: last?.getBoundingClientRect().toJSON(),condensed:document.body.classList.contains('xy-dock-condensed'),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   if(width<=790)check(bottom.viewBottom<=bottom.dockTop-15||bottom.scrollHeight>844&&bottom.viewBottom>844,kind+width+' content has safe scroll clearance',bottom);
   check(bottom.overflow<=1,kind+width+' scrolled page no horizontal overflow',bottom.overflow);
   await p.screenshot({path:path.join(dir,kind+'-scrolled-'+width+'.png')});
   check(!errors.length,kind+width+' zero script/console errors',errors);
   results.push({kind,width,initial,bottom,errors});
   console.log('WIDTH_PASS',kind,width);
 }catch(e){console.log('WIDTH_ERROR',kind,width,e.message);results.push({kind,width,error:e.message});}
 await context.close();await browser.close();
}
(async()=>{
 for(const width of [320,390,768,1440])await run('edge',chromium,width);
 for(const width of [390,768])await run('webkit',webkit,width);
 const failed=checks.filter(x=>!x.ok);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({results,checks,failed:failed.length,passed:checks.length-failed.length},null,2));
 console.log('SUMMARY',checks.length-failed.length,failed.length,'widthErrors',results.filter(x=>x.error).length);
 if(failed.length||results.some(x=>x.error))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});
