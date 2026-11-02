/* XiaoYa Apple opt-in QA. Isolated Playwright browser contexts only.
 * Does not use real credentials, modify production storage or call a paid AI service. */
const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path');
const url=process.env.XIAOYA_QA_URL||'http://127.0.0.1:5394/little-works/xiaoya-apple/';
const out=process.env.XIAOYA_QA_OUT||path.join(__dirname,'../../docs/xiaoya-apple-next-qa/native-qa');
fs.mkdirSync(out,{recursive:true});
const report={url,createdAt:new Date().toISOString(),widths:[],checks:[],errors:[],limitations:['WebKit on Windows and real iPhone Safari not run','Live paid model calls require user-owned API credentials']};
function assert(ok,message,extra){report.checks.push({ok:!!ok,name:message,...(extra?{extra}:{})});if(!ok)console.error('QA_FAIL',message,JSON.stringify(extra||{}));}
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true,timeout:14000});
 try{
  for(const width of [320,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',msg=>{if(msg.type()==='error')errors.push('console:'+msg.text().slice(0,150))});
   try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(800);
    const intro=page.locator('#xy-onboard');
    if(await intro.count()&&await intro.isVisible())await page.locator('#xy-local').click({timeout:6000});
    await page.waitForTimeout(600);
    const baseline=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      component:customElements.get('lg-segmented')?.name,
      filterReady:!!document.querySelector('#task-filters.lg-ready'),
      engine:window.__XIAOYA_NATIVE_EXPERIENCE,
      glass:document.querySelector('.mobile-tabs')?.dataset.glass,
      hasStore:!!window.OPC_TEST,
      key:document.querySelector('#byok-key')?.type,
      main:!!document.querySelector('#view-today.active')
    }));
    assert(baseline.hasStore,'APP business API exists '+width);
    assert(!!baseline.component,'Native Skill custom element registered '+width,baseline.component);
    assert(baseline.overflow<=1,'No initial horizontal overflow '+width,baseline.overflow);
    const navSel=width<=790?'.mobile-tabs button[data-view]':'.sidebar button[data-view]';
    const navTarget=target=>width<=790&&target==='settings'?'.topbar .top-actions>.icon-button[data-view="settings"]':navSel+'[data-view="'+target+'"]';
    const pages=['today','schedule','tasks','goals','review','settings'];
    for(const target of pages){
     await page.locator(navTarget(target)).first().click({timeout:7000});
     assert(await page.locator('#view-'+target+'.active').count()===1,'Navigation '+target+' '+width);
    }
    await page.screenshot({path:path.join(out,'settings-'+width+'.png'),fullPage:false});
    await page.locator(navSel+'[data-view="tasks"]').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({path:path.join(out,'tasks-'+width+'.png'),fullPage:false});
    const opts=page.locator('#task-filters >button');
    assert(await opts.count()===3,'Task filter controls '+width);
    const seg=await page.evaluate(()=>({
      value:document.querySelector('lg-segmented#task-filters')?.value,
      filter:document.querySelector('#task-filters')?.getAttribute('role'),
      runtime:document.querySelector('lg-segmented#task-filters .lg-refract')!==null
    }));
    assert(seg.runtime&&seg.filter==='radiogroup','Refractive segmented renderer mounted '+width,seg);
    await opts.nth(1).click();
    assert(await opts.nth(1).getAttribute('aria-checked')==='true','Task filter selection responds '+width);
    // A held pointer must stay visually held, then cancel on pointer release.
    const add=page.locator('#view-tasks [data-add="task"]').first();
    const box=await add.boundingBox();
    if(box){
     await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
     await page.mouse.down();await page.waitForTimeout(400);
     assert(await add.evaluate(el=>el.classList.contains('xy-long-held')),'Long press holds state '+width);
     await page.mouse.up();
     assert(await add.evaluate(el=>!el.classList.contains('xy-long-held')),'Long press release clears '+width);
     if(await page.locator('#modal-root').evaluate(e=>!e.hidden)) await page.locator('#modal-root [data-close]').last().click();
    }
    if(width===390){
      await add.click();
      await page.locator('#f-title').fill('QA测试任务，勿用于真实数据');
      await page.locator('#f-due').fill('2026-11-15T18:00');
      await page.locator('#edit-form button[type="submit"]').click();
      const state=await page.evaluate(()=>{
       const d=window.OPC_TEST.getData(),k='xiaoya-comparison:xiaoya-apple:personal:v1';
       return{task:d.tasks.some(t=>t.title.includes('QA测试任务')),key:!!localStorage.getItem(k),keys:Object.keys(localStorage).filter(k=>k.startsWith('xiaoya-comparison:xiaoya-apple:')).length};
      });
      assert(state.task&&state.key,'Real business task saved to isolated browser localStorage',state);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForTimeout(500);
      const persists=await page.evaluate(()=>window.OPC_TEST.getData().tasks.some(x=>x.title.includes('QA测试任务')));
      assert(persists,'Task persists after full reload');
      await page.locator(navSel+'[data-view="tasks"]').first().click();
      await page.locator('#view-tasks [data-toggle="task"]').first().click();
      assert(await page.evaluate(()=>window.OPC_TEST.getData().tasks.some(t=>t.done)),'Task completion persists in domain store');
      await page.locator(navTarget('settings')).first().click();
      await page.locator('#view-settings .xy-settings-item').filter({hasText:'AI 模型'}).first().click();
      assert(await page.locator('#byok-key').getAttribute('type')==='password','API credential field remains password');
      assert(await page.locator('#byok-provider').count()===1,'Original BYOK provider selector remains');
      await page.screenshot({path:path.join(out,'ai-settings-390.png')});
      await page.locator(navSel+'[data-view="today"]').first().click();
    }
    await page.locator(navSel+'[data-view="today"]').first().click();
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out,'today-'+width+'.png')});
    const final=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      viewport:window.innerWidth,
      top:document.querySelector('#view-today').getBoundingClientRect().top,
      glass:document.querySelector('.mobile-tabs')?.dataset.glass,
      glassEngine:document.querySelector('.mobile-tabs')?.dataset.glassEngine,
      native:window.__XIAOYA_NATIVE_EXPERIENCE
    }));
    assert(final.overflow<=1,'No final horizontal overflow '+width,final.overflow);
    assert(!errors.length,'No JS/page console errors '+width,errors);
    report.widths.push({width,baseline,final,errors});
   }catch(e){report.errors.push({width,message:e.message,stack:e.stack?.slice(0,800)});console.error('WIDTH_FAILED',width,e.message);}
   await context.close();
   console.log('QA_WIDTH_COMPLETE',width);
  }
 }finally{await browser.close()}
 const n=report.checks.filter(x=>!x.ok).length;
 report.failed=n+report.errors.length;report.passed=report.checks.filter(x=>x.ok).length;
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('QA_RESULT',JSON.stringify({passed:report.passed,failed:report.failed,errors:report.errors}).slice(0,1700));
 if(report.failed)process.exitCode=1;
}
main().catch(e=>{console.error('QA_FATAL',e);process.exitCode=2});