const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const f=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}).end(b))});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let pass=0,fail=0;async function check(n,fn){try{await fn();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,String(e.message||e).slice(0,550))}}
try{for(const [name,engine] of [['Edge',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(name==='Edge'?{channel:'msedge',headless:true}:{headless:true});
 const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const p=await c.newPage();const errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));
 p.on('response',r=>{if(r.url().includes('xiaoya-moods')&&r.status()!==200)missing.push(r.url()+' '+r.status())});
 await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await p.locator('.bottom-nav [data-view=develop]').click();
 await check(name+' five illustrated moods in unified group',async()=>{
  assert.equal(await p.locator('.v4-mood-picker .v4-mood-option').count(),5);
  assert.equal(await p.locator('.v4-mood-picker .v4-mood-art').count(),5,'line face icons still present');
  const texts=await p.locator('.v4-mood-option').allTextContents();
  assert.deepEqual(texts.map(x=>x.trim()),['很低落','有点累','平稳','不错','很好']);
  assert.equal(await p.locator('.v4-mood-face').count(),0);
 });
 await check(name+' five separate HD assets load and map to correct moods',async()=>{
  const entries=await p.locator('.v4-mood-art').evaluateAll(xs=>xs.map(x=>({bg:getComputedStyle(x).backgroundImage,pos:getComputedStyle(x).backgroundPositionX,width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})));
  for(const [i,entry] of entries.entries()){
    assert.ok(entry.bg.includes(i===0?'xiaoya-mood-1-hi-v2.webp':'xiaoya-mood-'+(i+1)+'-hi.webp'),JSON.stringify(entry));
    assert.ok(entry.width>=49&&entry.height>=60,JSON.stringify(entry));
  }
  const status=await p.evaluate(async()=>Promise.all([1,2,3,4,5].map(async i=>{
    const img=new Image();img.src=new URL(i===1?'./assets/xiaoya-mood-1-hi-v2.webp':'./assets/xiaoya-mood-'+i+'-hi.webp',location.href);
    await img.decode();return [img.naturalWidth,img.naturalHeight]
  })));
  assert.deepEqual(status,Array(5).fill([512,512]));
  assert.deepEqual(missing,[]);
 });
 await check(name+' active selection remains one soft integrated pill and draft not autosaved',async()=>{
  await p.locator('.v4-mood-option[data-mood="5"]').click();
  assert.equal(await p.locator('.v4-mood-option.is-active').count(),1);
  assert.equal(await p.locator('.v4-mood-option.is-active').getAttribute('data-mood'),'5');
  assert.equal(await p.locator('.v4-mood-option[aria-pressed=true]').count(),1);
  assert.equal(await p.locator('#journal-status').innerText(),'未保存');
  const s=await p.locator('.v4-mood-picker').evaluate(e=>({round:getComputedStyle(e).borderRadius,hasPseudo:getComputedStyle(e,'::before').content}));
  assert.ok(s.hasPseudo!=='none',JSON.stringify(s));
 });
 await check(name+' 320px layout fits without cropping or horizontal scrolling',async()=>{
  await p.setViewportSize({width:320,height:740});
  const r=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,buttons:[...document.querySelectorAll('.v4-mood-option')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))}));
  assert.ok(r.scroll<=r.inner+1,JSON.stringify(r));
  assert.ok(r.buttons.every(b=>b.w>=44&&b.h>=44),JSON.stringify(r.buttons));
 });
 await check(name+' no runtime errors',async()=>assert.deepEqual(errors,[]));
 await c.close();await browser.close();
}}finally{await new Promise(r=>server.close(r))}
console.log('MOOD_SPRITES '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});