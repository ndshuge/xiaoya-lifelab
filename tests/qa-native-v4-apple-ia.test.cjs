const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../little-works/xiaoya-apple/native-v4');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('primary mobile navigation has exactly Today, Matters and Development',()=>{
 const html=read('index.html');
 const nav=html.match(/<nav class="bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
 assert.ok(nav,'bottom navigation exists');
 const destinations=[...nav.matchAll(/data-view="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(destinations,['today','schedule','goals']);
 assert.match(nav,/>今天</);
 assert.match(nav,/>事项</);
 assert.match(nav,/>发展</);
});
test('schedule has timetable and task inbox; development has goals and review',()=>{
 const app=read('app.mjs');
 assert.match(app,/data-view="tasks"/);
 assert.match(app,/data-view="schedule"/);
 assert.match(app,/data-view="review"/);
 assert.match(app,/data-view="goals"/);
 assert.match(app,/view==='review'&&b\.dataset\.view==='goals'/);
 assert.match(app,/view==='tasks'&&b\.dataset\.view==='schedule'/);
});
test('page navigation does not rerender for the active tab or use instant scrolling',()=>{
 const app=read('app.mjs');
 assert.match(app,/if\(next===view\)return/);
 assert.doesNotMatch(app,/window\.scrollTo\(\{top:0,behavior:'instant'\}\)/);
});
test('dock has a non-intercepting gradient blur and subtle button press',()=>{
 const css=read('dayflow.css');
 assert.match(css,/\.bottom-nav::after/);
 assert.match(css,/pointer-events:\s*none/);
 assert.match(css,/linear-gradient/);
 assert.match(css,/backdrop-filter:\s*blur/);
 assert.match(css,/\.bottom-nav \.tab:active\{transform:scale\(\.98/);
 const app=read('app.mjs');
 assert.match(app,/1-\.02\*v/);
});
test('refreshing data or toggling a task never animates the whole page again',()=>{
 const app=read('app.mjs'),css=read('dayflow.css');
 assert.match(app,/function render\(\{enter=false\}=\{\}\)/);
 assert.match(app,/enter\?' page--enter'/);
 assert.match(css,/\.page\.page--enter\{animation:dayflow-page-enter/);
 assert.match(css,/\.page\{animation:none/);
});
test('companion avatar is the primary mobile chat trigger',()=>{
 const html=read('index.html');
 assert.match(html,/id="toolbar-chat-trigger"[^>]*>[\s\S]*?<img[^>]+xiaoya_hero_v1/);
});
