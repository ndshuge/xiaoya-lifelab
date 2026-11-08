// Browser acceptance: Web Audio never autoplays and pauses when the island is left.
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const HERE=__dirname, PORT=4478;
async function waitServer(){
 const url='http://127.0.0.1:'+PORT+'/little-works/xiaoya-apple/opus-original/?judge=1&intro=0&scene=week';
 for(let i=0;i<45;i++){
  try{const r=await fetch(url);if(r.ok)return url}catch{}
  await new Promise(ok=>setTimeout(ok,180));
 }
 throw Error('preview server did not start');
}
(async()=>{
 const server=spawn(process.execPath,[path.join(HERE,'preview-server.mjs'),'--no-open','--port',String(PORT)],{cwd:HERE,stdio:'ignore',windowsHide:true});
 let browser,safariBrowser;
 try{
  const url=await waitServer();
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.locator('.island-controls [data-ocean-audio]').waitFor({timeout:10000});
  const btn=page.locator('.island-controls [data-ocean-audio]');
  assert.equal(await btn.getAttribute('aria-pressed'),'false');
  await btn.click();
  await page.waitForFunction(()=>document.querySelector('[data-ocean-audio]')?.getAttribute('aria-pressed')==='true',{timeout:5000});
  assert.equal(await btn.getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.__XY_OPUS.setScale('day'));
  assert.equal(await page.evaluate(()=>window.__XY_OPUS.island().canvas.parentElement.querySelector('[data-ocean-audio]').getAttribute('aria-pressed')),'false');
  await page.evaluate(()=>window.__XY_OPUS.setScale('week'));
  await btn.waitFor({timeout:6000});
  assert.equal(await btn.getAttribute('aria-pressed'),'false','returning to island must not autoplay');
  assert.deepEqual(errors,[]);
  await context.close();
  const mobile=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const phone=await mobile.newPage();
  phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(url);
  const mbtn=phone.locator('.island-controls [data-ocean-audio]');
  await mbtn.waitFor({timeout:10000});
  const bounds=await mbtn.boundingBox();
  assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=375,'mobile sound toggle must stay onscreen');
  assert.equal(await mbtn.getAttribute('aria-pressed'),'false');
  await mbtn.tap();
  await phone.waitForFunction(()=>document.querySelector('[data-ocean-audio]')?.getAttribute('aria-pressed')==='true',{timeout:5000});
  await mbtn.tap();
  assert.equal(await mbtn.getAttribute('aria-pressed'),'false');
  await mobile.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/mobile opt-in ocean audio, no autoplay, pauses on navigation');
  if(process.argv.includes('--webkit')){
   safariBrowser=await webkit.launch({headless:true});
   const safariContext=await safariBrowser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const safari=await safariContext.newPage(),safariErrors=[];
   safari.on('pageerror',e=>safariErrors.push(e.message));
   await safari.goto(url);
   const sbtn=safari.locator('.island-controls [data-ocean-audio]');
   await sbtn.waitFor({timeout:10000});
   assert.equal(await sbtn.getAttribute('aria-pressed'),'false');
   const hasAudio=await safari.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));
   await sbtn.tap();
   if(hasAudio){
    await safari.waitForFunction(()=>document.querySelector('[data-ocean-audio]')?.getAttribute('aria-pressed')==='true',null,{timeout:5000});
    await sbtn.tap();
    assert.equal(await sbtn.getAttribute('aria-pressed'),'false');
   }else{
    assert.equal(await sbtn.getAttribute('aria-pressed'),'false','no phantom playback in a headless browser without Web Audio');
    assert.match(await safari.locator('#whisper').innerText(),/无法播放/);
   }
   assert.deepEqual(safariErrors,[]);
   await safariContext.close();
   console.log('PASS: WebKit opt-in sound toggle');
  }
 }finally{
  if(browser)await browser.close();
  if(safariBrowser)await safariBrowser.close();
  server.kill();
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
