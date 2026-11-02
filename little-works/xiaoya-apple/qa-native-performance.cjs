/* Desktop/phone viewport lab perf. NOT a physical phone/GPU benchmark. */
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path');
const output=path.join(__dirname,'../../docs/xiaoya-apple-next-qa/native-perf.json');
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true,timeout:15000});
const reports=[];
try{
for(const width of [390,1440])for(const reducedMotion of [false,true]){
 const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:reducedMotion?'reduce':'no-preference'});
 const page=await ctx.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5394/little-works/xiaoya-apple/',{waitUntil:'domcontentloaded',timeout:16000});
 if(await page.locator('#xy-onboard').isVisible())await page.locator('#xy-local').evaluate(x=>x.click());
 await page.waitForTimeout(450);
 const nav=width<=790?'.mobile-tabs button[data-view]':'.sidebar button[data-view]';
 const samples=await page.evaluate(async(selector)=>{
  let longTasks=0,totalLongTask=0;
  try{const observer=new PerformanceObserver(l=>{for(const e of l.getEntries()){longTasks++;totalLongTask+=e.duration}});observer.observe({entryTypes:['longtask']});window.__xyLongObserver=observer;}catch{}
  const tabs=['today','tasks','schedule','goals','review','settings','today','tasks','today'];
  const intervals=[],starts=[];
  const start=performance.now();
  let last=0,frames=0;
  await new Promise(resolve=>{
   const step=now=>{
    if(last)intervals.push(now-last);last=now;frames++;
    if(frames<126)requestAnimationFrame(step);else resolve();
   };requestAnimationFrame(step);
   (async()=>{
    for(const v of tabs){document.querySelector(selector+'[data-view="'+v+'"]')?.click();starts.push(performance.now()-start);await new Promise(r=>setTimeout(r,95));}
   })();
  });
  const sorted=intervals.slice().sort((a,b)=>a-b),pct=x=>sorted[Math.min(sorted.length-1,Math.floor(x*sorted.length))];
  const lens=document.querySelector('.mobile-tabs');
  const filter=document.querySelector('lg-segmented#task-filters');
  window.__xyLongObserver?.disconnect();
  return {frames:frames,durationMs:performance.now()-start,p50FrameMs:+pct(.5).toFixed(2),
    p95FrameMs:+pct(.95).toFixed(2),maxFrameMs:+Math.max(...sorted).toFixed(2),
    over32Ms:intervals.filter(x=>x>32).length,observedLongTasks:longTasks,totalLongTaskMs:+totalLongTask.toFixed(1),
    glass:lens?.dataset.glass,engine:lens?.dataset.glassEngine,filter:filter?.querySelector('.lg-refract')?getComputedStyle(filter.querySelector('.lg-refract')).filter:null,
    localStorageKeyPresent:Object.keys(localStorage).some(k=>k==='xiaoya-comparison:xiaoya-apple:personal:v1')};
 },nav);
 reports.push({width,reducedMotion,...samples,errors});await ctx.close();
 console.log('PERF_LAB',JSON.stringify(reports.at(-1)).slice(0,440));
}
}finally{await browser.close()}
fs.writeFileSync(output,JSON.stringify({context:'Edge headless Windows, viewport emulation only; not physical GPU or Safari',reports},null,2));
})().catch(e=>{console.error('PERF_FATAL',e);process.exitCode=2});