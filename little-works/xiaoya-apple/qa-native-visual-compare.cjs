/* Pure screenshot A/B: origin pinned to 44eff19 vs local branch.
   Fresh contexts; no user data, credentials, fake AI, or project writes. */
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path');
const out=path.join(__dirname,'../../docs/xiaoya-apple-next-qa/native-compare');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,timeout:12000});
 const pages=[{width:390,height:844,views:['today','tasks','settings','schedule','goals']},{width:1440,height:900,views:['today','review','settings']}];
 const manifest=[];
 try{
 for(const [version,port] of [['before',5396],['after',5394]]){
  for(const spec of pages){
   const ctx=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1});
   const page=await ctx.newPage();
   await page.goto('http://127.0.0.1:'+port+'/little-works/xiaoya-apple/',{waitUntil:'domcontentloaded',timeout:18000});
   await page.waitForTimeout(850);
   if(await page.locator('#xy-onboard').isVisible())await page.locator('#xy-local').evaluate(el=>el.click());
   await page.waitForTimeout(450);
   for(const view of spec.views){
    await page.evaluate(v=>window.OPC_TEST.navigate(v),view);
    await page.waitForTimeout(540);
    const name=version+'-'+view+'-'+spec.width+'.png';
    await page.screenshot({path:path.join(out,name),fullPage:false});
    manifest.push({version,width:spec.width,view,name,overflow:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)});
    console.log('SHOT',name);
   }
   await ctx.close();
  }
 }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({baseline:'44eff19b1d5f9aac97fa25e8b89fd554affa2375',manifest},null,2));
})().catch(e=>{console.error('COMPARE_FATAL',e);process.exitCode=2});