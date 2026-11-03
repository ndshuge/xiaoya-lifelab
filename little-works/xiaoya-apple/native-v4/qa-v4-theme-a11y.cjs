const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('E:/CHATGPT/projects/ai-academy/video-studio/node_modules/playwright-core');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(p.startsWith('/xiaoya-lifelab/'))p=p.slice('/xiaoya-lifelab'.length);const file=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(b))});
function lightness(s){const v=s.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];return v.length===3?(v[0]*.2126+v[1]*.7152+v[2]*.0722):0}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let pass=0,fail=0;
const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS',name)}catch(e){fail++;console.log('FAIL',name,String(e.message||e).slice(0,450))}};
try{for(const [label,engine] of [['Edge',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(label==='Edge'?{channel:'msedge',headless:true}:{headless:true});
 try{for(const scheme of ['light','dark']){
 const ctx=await browser.newContext({colorScheme:scheme,viewport:{width:390,height:844},hasTouch:true,isMobile:label==='WebKit'});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 const threshold=scheme==='dark'?90:170;
 const bg=sel=>p.locator(sel).first().evaluate(e=>getComputedStyle(e).backgroundColor);
 const fg=sel=>p.locator(sel).first().evaluate(e=>getComputedStyle(e).color);
 await check(label+' '+scheme+' page background',async()=>{const c=lightness(await bg('body'));assert.ok(scheme==='dark'?c<threshold:c>threshold,c)});
 await check(label+' '+scheme+' primary heading readable',async()=>{const c=lightness(await fg('#workspace h1'));assert.ok(scheme==='dark'?c>155:c<110,c)});
 await p.locator('.topbar .toolbar-actions button').click();
 await check(label+' '+scheme+' settings surface',async()=>{const c=lightness(await bg('.settings-group'));assert.ok(scheme==='dark'?c<100:c>160,c)});
 await check(label+' '+scheme+' settings labels readable',async()=>{const c=lightness(await fg('.settings-row .label'));assert.ok(scheme==='dark'?c>145:c<130,c)});
 await p.locator('.topbar .toolbar-actions button').click();
 await p.locator('.bottom-nav [data-view=develop]').click();
 await check(label+' '+scheme+' mood group surface',async()=>{const c=lightness(await bg('#workspace .v4-mood-picker'));assert.ok(scheme==='dark'?c<105:c>165,c)});
 await check(label+' '+scheme+' mood labels readable',async()=>{const c=lightness(await fg('#workspace .v4-mood-option'));assert.ok(scheme==='dark'?c>145:c<130,c)});
 await check(label+' '+scheme+' journal history empty surface',async()=>{
  const n=p.locator('.v4-record-empty');if(await n.count()){const c=lightness(await bg('.v4-record-empty'));assert.ok(scheme==='dark'?c<105:c>165,c)}
 });
 await p.locator('.bottom-nav [data-view=items]').click();await p.locator('[data-items-tab=inbox]').click();
 await p.locator('#items-undated [data-add=task]').click();
 await check(label+' '+scheme+' editor surface',async()=>{const c=lightness(await bg('.sheet-frame'));assert.ok(scheme==='dark'?c<100:c>160,c)});
 await p.keyboard.press('Escape');
 await check(label+' '+scheme+' no runtime errors or horizontal overflow',async()=>{assert.deepEqual(errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))});
 await ctx.close();
 }
 }finally{await browser.close()}
}
const a11yBrowser=await chromium.launch({channel:'msedge',headless:true});
try{
 const forced=await a11yBrowser.newContext({viewport:{width:390,height:844},forcedColors:'active',hasTouch:true});
 const p=await forced.newPage();
 await p.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await check('forced-colors preserves visible focus',async()=>{
   const tab=p.locator('.bottom-nav [data-view=items]');await tab.focus();
   const state=await tab.evaluate(e=>({outline:getComputedStyle(e).outlineStyle,focus:document.activeElement===e}));
   assert.equal(state.focus,true);assert.notEqual(state.outline,'none');
 });
 await check('forced-colors navigation is actionable',async()=>{
   await p.locator('.bottom-nav [data-view=items]').click();
   assert.equal(await p.locator('body').getAttribute('data-view'),'items');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 });
 await forced.close();
 const mixed=await a11yBrowser.newContext({viewport:{width:390,height:844},colorScheme:'dark'});
 const mp=await mixed.newPage();const cdp=await mixed.newCDPSession(mp);
 for(const [name,feature] of [['reduced transparency','prefers-reduced-transparency'],['increased contrast','prefers-contrast']]){
   await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:feature,value:name==='reduced transparency'?'reduce':'more'}]});
   await mp.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
   await check('dark '+name+' retains a dark dock and edge',async()=>{
     const d=await mp.evaluate(()=>({nav:getComputedStyle(document.querySelector('.bottom-nav')).backgroundColor,
       pill:getComputedStyle(document.querySelector('.bottom-nav'),'::before').backgroundColor,
       edge:getComputedStyle(document.querySelector('.app-frame'),'::after').backgroundImage}));
     assert.ok(lightness(d.nav)<110&&lightness(d.pill)<110&&!d.edge.includes('245, 245, 247'),JSON.stringify(d));
   });
 }
 await mixed.close();
 const zoom=await a11yBrowser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});
 const q=await zoom.newPage();
 await q.goto('http://127.0.0.1:'+server.address().port+'/xiaoya-lifelab/?judge=1',{waitUntil:'networkidle'});
 await q.evaluate(()=>document.documentElement.style.zoom='2');
 await check('desktop CSS 200% approximation reflows without page overflow',async()=>{
   const v=await q.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(v.scroll<=v.width+1,JSON.stringify(v));
 });
 await zoom.close();
}finally{await a11yBrowser.close()}
}finally{await new Promise(r=>server.close(r))}
console.log('THEME_QA '+pass+'/'+(pass+fail));if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
