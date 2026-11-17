// Regression probe for Pocket -> Week/Longline first visible frame.
const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const DIR=path.join(ROOT,'docs/qa/evidence/2026-11-17-switch-render');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.png':'image/png'};
async function serve(){return new Promise(resolve=>{const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');let file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(ROOT)){res.writeHead(403);return res.end()}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes)})});server.listen(0,'127.0.0.1',()=>resolve(server))})}
function sample(){const page=document.querySelector('#page'),slot=document.querySelector('#island-slot'),host=document.querySelector('.island-host'),canvas=document.querySelector('.island-canvas');const pr=page?.getBoundingClientRect(),sr=slot?.getBoundingClientRect(),cr=canvas?.getBoundingClientRect(),style=page?getComputedStyle(page):null;return {t:Math.round(performance.now()),view:window.__XY_OPUS?.ui?.view,zoom:page?.dataset.zoom,entering:page?.classList.contains('is-entering'),opacity:style?.opacity,pageHeight:Math.round(pr?.height||0),slot:[Math.round(sr?.width||0),Math.round(sr?.height||0)],canvas:[Math.round(cr?.width||0),Math.round(cr?.height||0),canvas?.width||0,canvas?.height||0],fold:host?.dataset.fold,islandKind:window.__XY_OPUS?.island()?.diagnostics()?.buildings||0,visibleText:(page?.innerText||'').slice(0,32)}}
async function main(){const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core'),isWebKit=process.argv.includes('--webkit'),browser=isWebKit?await webkit.launch({headless:true}):await chromium.launch({channel:'msedge',headless:true});const server=await serve(),kind=isWebKit?'webkit':'edge';fs.mkdirSync(DIR,{recursive:true});try{const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'no-preference'});await ctx.route(/fonts\\.(googleapis|gstatic)\\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/little-works/xiaoya-apple/opus-original/?judge=1&intro=0&tips=0&history=0');await page.waitForSelector('#scale [data-view=pocket]');for(const [name,sequence] of [['cold-pocket-to-week',['pocket','week']],['warm-pocket-to-line',['pocket','line']],['warm-pocket-to-week',['pocket','week']],['rapid-pocket-week-line',['pocket','week','line']]]){let clickDuration=0;for(const v of sequence.slice(0,-1)){await page.locator('#scale [data-view='+v+']').click();await page.waitForTimeout(220)}const dest=sequence.at(-1),start=Date.now();await page.locator('#scale [data-view='+dest+']').click();clickDuration=Date.now()-start;let values=[];for(const wait of [0,40,100,220,400,600,1000,1600]){if(wait)await page.waitForTimeout(Math.max(0,wait-(values.at(-1)?.elapsed||0)));const state=await page.evaluate(sample);state.elapsed=Math.round(Date.now()-start);values.push(state);if(wait===0){
 if(name!=='rapid-pocket-week-line'){
  assert.equal(state.opacity,'1',name+' content is fading from transparent');
  assert.equal(state.entering,false,name+' still animates entire page');
 }
 const png=await page.screenshot({path:path.join(DIR,kind+'-'+name+'-first.png')});
 const rgb=await page.evaluate(async b64=>{
  const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
  const cx=canvas.getContext('2d');cx.drawImage(img,0,0);
  return [...cx.getImageData(115,520,1,1).data].slice(0,3);
 },png.toString('base64'));
 if(name!=='cold-pocket-to-week'&&name!=='rapid-pocket-week-line')assert.ok(rgb[2]<210,name+' WebGL canvas blank: '+JSON.stringify({rgb,state}));
 console.log('CHECK',kind,name,'rgb',JSON.stringify(rgb),'clickMs',clickDuration);
}}console.log('PASS',kind,name,'click',clickDuration+'ms')}
// Returning to the 3D page must not steal focus or replace a live check-in draft.
await page.locator('button.lgrid-label').first().click();
await page.locator('#sheet-body textarea[name=note]').fill('练了 30 分钟基础节奏');
await page.locator('#sheet-body input[name=minutes]').fill('30');
assert.equal(await page.locator('#sheet-body textarea[name=note]').inputValue(),'练了 30 分钟基础节奏','Draft was overwritten after switching views');
await page.locator('.sheet-cancel').click();
assert.deepEqual(errors,[],'No JavaScript page errors');await ctx.close()}finally{await browser.close();await new Promise(done=>server.close(done))}}main().catch(e=>{console.error(e);process.exitCode=1});
