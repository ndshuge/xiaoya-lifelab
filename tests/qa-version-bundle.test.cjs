const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('the submitted URL resolves to Apple Native V4 within the submitted repository',()=>{
 const html=read('index.html');
 assert.match(html,/little-works\/xiaoya-apple\/native-v4/);
 assert.match(html,/location\.replace/);
 assert.doesNotMatch(html,/ndshuge-galaxy/);
 assert.match(html,/location\.search/);
 assert.match(html,/edition/);
});
test('the latest Apple Native V3 and its dependency chain are included in the original repository',()=>{
 for(const p of ['little-works/xiaoya-apple/native-v4/index.html','little-works/xiaoya-apple/native-v4/app.mjs','little-works/xiaoya-apple/native-v4/style.css','little-works/xiaoya-apple/native-v4/store.mjs','little-works/xiaoya-apple/native-v4/timeline.mjs','little-works/xiaoya-apple/core.js','little-works/xiaoya-apple/domain.js','little-works/xiaoya-apple/glass/components.js','little-works/xiaoya-apple/assets/brand/xiaoya_hero_v1.webp']){
  assert.ok(fs.statSync(path.join(root,p)).size>0,p+' missing');
 }
});
test('classic, earlier Apple and Pro builds stay available independently',()=>{
 for(const p of ['original.html','app.js','core.js','little-works/xiaoya-apple/index.html','little-works/xiaoya-apple/xiaoya-chat.js','pro/index.html'])assert.ok(fs.existsSync(path.join(root,p)),p);
});
test('versions hub and accessible switcher are present across product editions',()=>{
 assert.match(read('versions/index.html'),/Apple Native V3/);
 assert.match(read('version-switcher.js'),/xiaoya-version-menu/);
 for(const p of ['original.html','little-works/xiaoya-apple/index.html','little-works/xiaoya-apple/native-v4/index.html','pro/index.html'])
  assert.match(read(p),/version-switcher\.js/,p+' missing switcher');
});
test('original code and prior competition artifacts are never replaced',()=>{
 for(const p of ['competition-materials/README.md','judge.html','original.html','growth-simulator.js'])assert.ok(fs.existsSync(path.join(root,p)),p);
});
