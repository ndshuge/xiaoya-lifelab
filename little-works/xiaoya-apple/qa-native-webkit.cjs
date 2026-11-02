/* Real Playwright WebKit engine QA (Windows WebKit, not physical iPhone Safari). */
const {webkit}=require('playwright-core');const fs=require('fs'),path=require('path');
const url='http://127.0.0.1:5394/little-works/xiaoya-apple/';
const out=path.join(__dirname,'../../docs/xiaoya-apple-next-qa/native-webkit');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await webkit.launch({headless:true,timeout:18000});
 const results=[];
 try{
 for(const width of [320,390,768]){
  const ctx=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,180))});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});await page.waitForTimeout(700);
  if(await page.locator('#xy-onboard').isVisible())await page.locator('#xy-local').evaluate(b=>b.click());
  await page.waitForTimeout(950);
  const first=await page.evaluate(()=>({
   engine:document.querySelector('.mobile-tabs')?.dataset.glassEngine,
   glass:document.querySelector('.mobile-tabs')?.dataset.glass,
   filter:getComputedStyle(document.querySelector('lg-segmented#task-filters .lg-refract')).filter,
   customElement:!!customElements.get('lg-segmented'),
   overflow:document.documentElement.scrollWidth-innerWidth
  }));
  await page.locator('.mobile-tabs button[data-view="tasks"]').evaluate(b=>b.click());
  await page.waitForTimeout(430);
  await page.screenshot({path:path.join(out,'tasks-'+width+'.png')});
  await page.locator('#task-filters>button[value="open"]').evaluate(b=>b.click());
  const selected=await page.locator('#task-filters>button[value="open"]').getAttribute('aria-checked');
  await page.locator('.mobile-tabs button[data-view="settings"]').evaluate(b=>b.click());
  await page.waitForTimeout(420);
  await page.screenshot({path:path.join(out,'settings-'+width+'.png')});
  const last=await page.evaluate(()=>({
   overflow:document.documentElement.scrollWidth-innerWidth,
   copyCount:document.querySelectorAll('.xy-glass-content .xy-glass-cell').length,
   glass:document.querySelector('.mobile-tabs')?.dataset.glass,
   active:document.querySelector('.view.active')?.id
  }));
  results.push({width,first,selected,last,errors,
    pass:first.engine==='webkit'&&first.customElement&&first.overflow<=1&&selected==='true'&&last.overflow<=1&&!errors.length});
  await ctx.close();
  console.log('WEBKIT_WIDTH',width,'engine',first.engine,'optics',first.glass,'selected',selected,'errors',errors.length);
 }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));
 if(results.some(x=>!x.pass))process.exitCode=1;
 console.log('WEBKIT_RESULT',results.filter(x=>x.pass).length+'/'+results.length);
})().catch(e=>{console.error('WEBKIT_FATAL',e);process.exitCode=2});