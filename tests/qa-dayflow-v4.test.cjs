const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=s=>fs.readFileSync(path.join(root,s),'utf8');
test('immutable Native V3 baseline remains and a separate V4 working copy exists',()=>{
 const old='little-works/xiaoya-apple/native-v3',next='little-works/xiaoya-apple/native-v4';
 for(const f of ['index.html','app.mjs','store.mjs','style.css','assistant.mjs','growth-panel.mjs','timeline.mjs']){
  assert.ok(fs.existsSync(path.join(root,old,f)),'missing baseline: '+f);
  assert.ok(fs.existsSync(path.join(root,next,f)),'missing working V4: '+f);
 }
 const diff=cp.execFileSync('git',['-C',root,'diff','--name-only','origin/main','--',old],{encoding:'utf8'});
 assert.equal(diff.trim(),'','V3 changed compared to original judge baseline');
});
test('submitted fixed URL redirects to in-repository Native V4, not archived V3 or Galaxy',()=>{
 const html=read('index.html');
 assert.match(html,/little-works\/xiaoya-apple\/native-v4/);
 assert.doesNotMatch(html,/ndshuge-galaxy/);
 assert.match(html,/location\.search/);
});
test('version library and floating switcher expose V4 latest and V3 archived explicitly',()=>{
 const list=read('versions/index.html'),script=read('version-switcher.js');
 assert.match(list,/native-v4/);assert.match(list,/native-v3/);
 assert.match(list,/Apple Native V4/);
 assert.match(script,/native-v4/);assert.match(script,/native-v3/);
});
test('original and other previews retained',()=>{
 ['original.html','pro/index.html','little-works/xiaoya-apple/index.html'].forEach(x=>assert.ok(fs.existsSync(path.join(root,x)),x));
});
