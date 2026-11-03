const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'..'),root=path.join(repo,'little-works/xiaoya-apple/native-v4');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
test('primary tabs Today / Items / Development are exactly three',()=>{
 const html=read('index.html');
 const nav=html.match(/<nav class="bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(nav);
 assert.deepEqual([...nav.matchAll(/data-view="([^"]+)"/g)].map(x=>x[1]),['today','items','develop']);
 for(const s of ['今天','事项','发展'])assert.ok(nav.includes('>'+s+'</'));
});
test('only original Xiaoya avatar opens chat, no duplicate companion',()=>{
 const h=read('index.html');
 assert.ok(h.includes('id="xiaoya-avatar" data-action="pet"'));
 assert.ok(h.includes('xiaoya_hero_v1.webp'));
 assert.equal(h.includes('id="toolbar-chat-trigger"'),false);
 assert.equal(h.includes('<aside class="companion"'),false);
});
test('deadline and undated inbox are different from actual timetable',()=>{
 const view=read('items-view.mjs'),model=read('items-model.mjs'),app=read('app.mjs');
 assert.ok(view.includes('id="items-date-deadlines"')&&view.includes('id="items-undated"'));
 assert.ok(view.includes('buildDayTimeline'));assert.ok(model.includes('deadlineTasksForDate'));
 assert.ok(app.includes('截止日期（可选）'));
 assert.ok(app.includes('id="task-advanced"'));
 assert.ok(view.includes('data-due-date='));
});
test('private journal stores and exports independent per mode',()=>{
 const journal=read('journal-store.mjs'),app=read('app.mjs'),develop=read('development-view.mjs');
 assert.ok(journal.includes('xiaoya-dayflow:journal:v1:')&&journal.includes('getMode'));
 assert.ok(app.includes('journalV1:journal.all()'));
 for(const id of ['development-mood','development-journal','development-goals'])assert.ok(develop.includes(id));
 assert.ok(develop.includes('不构成医学判断'));
});
test('Dock optical L1, reduced motion and non-jitter navigation',()=>{
 const css=read('v4-polish.css'),app=read('app.mjs');
 for(const part of ['.app-frame::after','pointer-events:none','mask-image:linear-gradient','backdrop-filter:blur','prefers-reduced-motion','prefers-reduced-transparency','.page{animation:none!important}'])assert.ok(css.includes(part),part);
 assert.ok(app.includes('if(next===view&&from===view)return'));
 assert.equal(app.includes("window.scrollTo({top:0,behavior:'instant'})"),false);
});
test('V3 remains archived and V4 accessible from versions',()=>{
 const h=fs.readFileSync(path.join(repo,'versions/index.html'),'utf8');
 assert.ok(h.includes('native-v3/')&&h.includes('native-v4/'));
 assert.ok(fs.existsSync(path.join(repo,'little-works/xiaoya-apple/native-v3/app.mjs')));
});
