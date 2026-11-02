/* XiaoYa Apple redesign gate — runs on isolated demo storage; never calls AI or writes real user data. */
const fs=require('fs'),path=require('path'),http=require('http');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../..');
const out=path.join(root,'docs','xiaoya-native-rebuild-qa');
const cases=[];
function check(ok,name,details=''){cases.push({ok:!!ok,name,details});console.log((ok?'PASS ':'FAIL ')+name+' '+details);if(!ok)process.exitCode=1;}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
function serve(){return new Promise(resolve=>{const srv=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b)})});srv.listen(0,'127.0.0.1',()=>resolve(srv))})}
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 check(html.includes('native-rebuild.css'),'new native redesign stylesheet linked');
 check(html.includes('native-rebuild.js'),'new native redesign behavior linked');
 const srv=await serve();const port=srv.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 fs.mkdirSync(out,{recursive:true});
 for(const width of [320,390,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:width>=1200?900:844},deviceScaleFactor:1,hasTouch:width<800});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/little-works/xiaoya-apple/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1450);
  const local=page.locator('#xy-local');if(await local.isVisible().catch(()=>false)){await local.evaluate(e=>e.click());await page.waitForTimeout(380)}
  const snap=await page.evaluate(()=>{
   const e=document.querySelector('.xy-native-focus');const r=e?.getBoundingClientRect();
   return {active:document.querySelector('#view-today')?.classList.contains('active'),native:!!window.__XY_NATIVE_REBUILD,top:r?.top||9999,height:r?.height||0,overflow:document.documentElement.scrollWidth-innerWidth,navCount:[...document.querySelectorAll('.mobile-tabs button[data-view]')].filter(b=>getComputedStyle(b).display!=='none').length,
    focusText:e?.innerText||'',contentIds:['today-tasks','today-schedule','all-tasks','all-goals','review-overview','byok-form'].every(id=>!!document.getElementById(id))};
  });
  check(snap.native,'redesign active at '+width);
  check(snap.active,'today active at '+width);
  check(snap.contentIds,'original functionality DOM retained at '+width);
  check(snap.overflow<=1,'no x overflow at '+width,String(snap.overflow));
  check(snap.top<650&&snap.height>0,'priority actions in first viewport at '+width,JSON.stringify({top:snap.top,height:snap.height}));
  if(width<=390) check(snap.navCount===5,'mobile dock has five primary tabs at '+width,String(snap.navCount));
  if(width===320){const pet=await page.locator('#xy-fab').boundingBox();check(!pet||pet.y+pet.height<185,'default pet does not cover the mobile description',JSON.stringify(pet));}
  await page.screenshot({path:path.join(out,'native-'+width+'.png'),fullPage:false});
  if(width===390||width===1440){
   const nav=width===390?'.mobile-tabs button[data-view]':'.sidebar button[data-view]';
   for(const v of ['schedule','tasks','goals','review']){
    await page.locator(nav+'[data-view="'+v+'"]').first().evaluate(e=>e.click());await page.waitForTimeout(180);
    check(await page.locator('#view-'+v+'.active').count()===1,width+' navigation '+v);
    await page.screenshot({path:path.join(out,'view-'+v+'-'+width+'.png')});
   }
   await page.locator(width===390?'.topbar .top-actions>.icon-button[data-view="settings"]':'.sidebar [data-view="settings"]').first().evaluate(e=>e.click());
   await page.waitForTimeout(300);const settingState=await page.evaluate(()=>({active:[...document.querySelectorAll('#main>.view.active')].map(x=>x.id),buttons:[...document.querySelectorAll('.topbar .top-actions [data-view="settings"]')].map(x=>({html:x.outerHTML.slice(0,250),visible:getComputedStyle(x).display}))}));check(await page.locator('#view-settings.active').count()===1,width+' settings reachable',JSON.stringify(settingState));
   await page.screenshot({path:path.join(out,'settings-'+width+'.png')});
   await page.locator(nav+'[data-view="tasks"]').first().evaluate(e=>e.click());await page.waitForTimeout(140);
   await page.locator('#view-tasks [data-add="task"]').first().evaluate(e=>e.click());await page.waitForTimeout(220);
   check(await page.locator('#modal-root').evaluate(e=>!e.hidden),width+' existing add task dialog opens');
   await page.screenshot({path:path.join(out,'task-sheet-'+width+'.png')});
  }
  check(errors.length===0,'no uncaught page errors at '+width,errors.join(' | ').slice(0,180));
  await context.close();
 }
 await browser.close();await new Promise(r=>srv.close(r));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({cases,date:new Date().toISOString()},null,2));
 console.log('TOTAL',cases.filter(x=>x.ok).length+'/'+cases.length);if(cases.some(c=>!c.ok))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
