import {DAYS,localStamp,uid,esc,emptyStore,validateStore,dueState,dueLabel,fmtDate,suggestions,demoData,summary} from '../core.js';
import {dateKey,weekday,monday,plusDays,teachingWeek,occurrences,growth,checkSchedule,checkSemester,parseSchedule,applyImport,exportCalendar,undoTransaction,executePlan,parseExceptions} from '../domain.js';
import {createSpring} from '../glass/liquid-glass.js';
import '../glass/components.js'; // Original liquidglass.dev optical controls, self-hosted (MIT).
import {createStore} from './store.mjs?v=3.1.1';
import {createAssistant} from './assistant.mjs?v=20261102';
import {createGrowthPanel} from './growth-panel.mjs?v=20261102';
import {buildDayTimeline} from './timeline.mjs';
import {renderDayflowToday} from './dayflow-view.mjs?v=4.0.0';
import {renderItemsView} from './items-view.mjs?v=4.2.0';
import {renderDevelopment} from './development-view.mjs?v=4.2.0';
import {createJournalStore,validateJournalArchive} from './journal-store.mjs?v=4.2.0';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const icon=n=>'<svg aria-hidden="true"><use href="#ic-'+n+'"/></svg>';
const routeLabels={today:'今天',items:'事项',develop:'发展',schedule:'日程',tasks:'待办',goals:'目标',review:'复盘',settings:'设置'};
const now=()=>new Date();
const dateFor=(d)=>new Date(d+'T00:00');
const shortDate=(d)=>new Date(d).toLocaleDateString('zh-CN',{month:'short',day:'numeric'});
const humanDate=(d)=>d.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
const timePart=s=>s?.includes('T')?s.slice(11,16):s||'';
let store,view='today',itemsTab='schedule',developTab='record',filter='all',query='',selectedDate=dateKey(now()),weekStart=monday(now()),journalDate=dateKey(now()),moodDraft=null,modal=null,preview=null,toastTimeout=null;
try{store=createStore({preferDemoOnFreshSession:new URLSearchParams(location.search).get('judge')==='1'})}catch(e){$('#workspace').innerHTML='<div class="page-heading"><h1>档案需要处理</h1></div><div class="group"><div class="empty-group"><strong>为了保护你的记录，小芽不会覆盖无法读取的数据</strong><p>'+esc(e.message)+'</p><a href="../index.html">打开原有完整界面以导出备份</a></div></div>';throw e}
const state=()=>store.current();
const journal=createJournalStore({getMode:()=>store.mode()});
// Preserve unsaved text in memory, scoped to mode/date; never persist it without explicit Save.
const journalDrafts=new Map();
const journalDraftKey=()=>store.mode()+':'+journalDate;
function clearModeDrafts(){for(const key of journalDrafts.keys())if(key.startsWith(store.mode()+':'))journalDrafts.delete(key)}
const assistant=createAssistant({getData:state,getMode:()=>store.mode(),navigate});
const growthPanel=createGrowthPanel({getData:state,getMode:()=>store.mode(),replace:next=>store.replace(next),refresh:render,openSheet,closeSheet,notify,esc});

function notify(s){const el=$('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),2900)}
function save(fn){try{store.commit(fn);render();notify('已保存到当前浏览器');return true}catch(e){render();notify(e.message);return false}}
function head(title,sub='',action=''){return '<div class="page-heading"><div><span class="eyebrow">'+esc(sub)+'</span><h1>'+esc(title)+'</h1></div><div class="page-heading-right">'+action+'</div></div>'}
function section(title,content,link='',extra=''){return '<section class="section"><div class="section-head"><h2>'+esc(title)+'</h2>'+(link?'<button class="mini-link" data-view="'+link+'">查看全部</button>':extra?'<small>'+esc(extra)+'</small>':'')+'</div><div class="group">'+content+'</div></section>'}
function empty(text,help='',actionLabel='',action=''){return '<div class="empty-group"><div class="empty-icon">'+icon('growth')+'</div><strong>'+esc(text)+'</strong><p>'+esc(help)+'</p>'+(action?'<button class="text-action" data-action="'+action+'">'+esc(actionLabel)+' '+icon('right')+'</button>':'')+'</div>'}
function taskRow(t){const due=t.due?dueLabel(t):'未设置日期',cls=dueState(t);return '<div class="row" data-item="'+esc(t.id)+'"><button class="circle-check '+(t.done?'checked':'')+'" data-toggle="task" data-id="'+esc(t.id)+'" aria-label="'+(t.done?'取消完成':'标记完成')+esc(t.title)+'">'+(t.done?icon('check'):'')+'</button><div class="row-main"><button class="row-title '+(t.done?'is-done':'')+'" data-edit="task" data-id="'+esc(t.id)+'" style="border:0;background:none;padding:0;text-align:left">'+esc(t.title)+'</button><div class="row-sub">'+esc(t.course||({exam:'考试',assignment:'作业',task:'事项'}[t.type]||'事项'))+(t.due?' · '+esc(shortDate(t.due)):'')+'</div></div><div class="row-tail"><span class="row-time '+cls+'">'+esc(due)+'</span><button class="icon-button" data-edit="task" data-id="'+esc(t.id)+'" aria-label="编辑 '+esc(t.title)+'">'+icon('right')+'</button></div></div>'}
function agendaRow(item){return '<div class="row agenda-row" data-item="'+esc(item.id)+'"><span class="day-agenda-time">'+esc(item.start)+'</span><span class="agenda-mark '+esc(item.kind)+'"></span><div class="row-main"><button class="row-title" data-edit="'+esc(item.kind)+'" data-id="'+esc(item.id)+'" style="padding:0;border:0;text-align:left;background:none">'+esc(item.name)+'</button><div class="row-sub">'+esc(item.place||'未设置地点')+' · '+esc(item.end)+'</div></div><button class="icon-button" data-edit="'+esc(item.kind)+'" data-id="'+esc(item.id)+'" aria-label="编辑日程">'+icon('right')+'</button></div>'}
function visibleOn(d){return occurrences(d,dateFor(selectedDate),plusDays(dateFor(selectedDate),1)).sort((a,b)=>a.start.localeCompare(b.start))}
function sortedTasks(d,includeDone=false){return d.tasks.filter(t=>includeDone||!t.done).sort((a,b)=>(a.due?+new Date(a.due):Infinity)-(b.due?+new Date(b.due):Infinity))}
function renderSuggestion(d){
 const s=suggestions(d).find(v=>v.kind!=='welcome');
 if(!s)return '';
 return '<section class="section"><div class="section-head"><h2>小芽的建议</h2><small>基于你的实际记录</small></div><div class="suggestion"><span class="sprout">'+icon('growth')+'</span><div class="grow"><strong>'+esc(s.title)+'</strong><p>'+esc(s.description)+'</p><div class="actions">'+(s.action?'<button data-suggest="'+esc(s.id)+'">预览安排</button>':'')+'<button class="secondary-action" data-reject="'+esc(s.id)+'">暂时不需要</button></div></div></div></section>'
}
function todayView(d){return renderDayflowToday(d,now(),{isDemo:store.mode()==='demo'});}
function itemsView(d){return renderItemsView(d,{selectedDate,weekStart,active:itemsTab,at:now()})}
function developView(d){
 try{return renderDevelopment(d,journal.all(),{selectedDate:journalDate,at:now(),growthPlanner:growthPanel.render(),active:developTab})}
 catch(e){return head('发展','本地记录读取失败')+'<div class="group"><p class="sheet-note">'+esc(e.message)+'</p><p>为了保护日记，请勿清空浏览器数据。可先前往设置导出主档案。</p></div>'}
}
function tasksView(d){
 let list=sortedTasks(d,true),today=dateKey(now());
 if(filter==='open')list=list.filter(t=>!t.done);if(filter==='today')list=list.filter(t=>!t.done&&t.due&&t.due.slice(0,10)<=today);
 if(filter==='upcoming')list=list.filter(t=>!t.done&&t.due&&t.due.slice(0,10)>today);
 if(filter==='completed')list=list.filter(t=>t.done);
 const chips=[['all','全部'],['today','今天'],['upcoming','即将到期'],['open','未完成'],['completed','已完成']];
 return head('计划',d.tasks.filter(t=>!t.done).length+' 项待完成','<button class="primary" data-add="task">'+icon('plus')+'新建提醒</button>')+
 '<div class="dayflow-plan-tabs" aria-label="计划视图"><button data-view="schedule">日程</button><button class="is-active" data-view="tasks">任务箱</button></div>'+
 '<div class="filterbar">'+chips.map(([id,label])=>'<button class="seg '+(filter===id?'active':'')+'" data-filter="'+id+'">'+label+'</button>').join('')+'</div>'+
 '<section class="section"><div class="group">'+(list.length?list.map(taskRow).join(''):empty('这里还没有事项','新建提醒，或选择其他分类查看','添加事项','add-task'))+'</div></section>';
}
function weekDays(){return Array.from({length:7},(_,i)=>plusDays(weekStart,i))}
// Independently tested 24-hour timeline rendering lives in timeline.mjs.
function scheduleView(d){
 const days=weekDays(),selected=dateFor(selectedDate),day=visibleOn(d);
 const first=shortDate(days[0]),last=shortDate(days[6]),conflictCount=0;
 return head('计划',d.semester?.start?'第 '+(teachingWeek(d,selected)||'—')+' 教学周':'课程与活动', '<button class="primary" data-add="course">'+icon('plus')+'添加日程</button>')+
 '<div class="dayflow-plan-tabs" aria-label="计划视图"><button class="is-active" data-view="schedule">日程</button><button data-view="tasks">任务箱</button></div>'+
 '<div class="calendar-toolbar"><div class="calendar-arrow"><button data-action="prev-week" aria-label="上一周">'+icon('left')+'</button><button data-action="next-week" aria-label="下一周">'+icon('right')+'</button><button data-action="now-week" aria-label="回到本周" style="width:auto;padding:0 13px;font-size:12px">今天</button></div><b>'+esc(first)+' — '+esc(last)+'</b></div>'+
 '<div class="week-rail">'+days.map(x=>{const dayKey=dateKey(x);return '<button class="day-pill '+(dayKey===selectedDate?'is-selected ':'')+(dayKey===dateKey(now())?'is-today':'')+'" data-day="'+dayKey+'"><small>'+DAYS[weekday(x)]+'</small><strong>'+x.getDate()+'</strong></button>'}).join('')+'</div>'+
 '<section class="section"><div class="section-head"><h2>'+esc(selected.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}))+'</h2><div class="calendar-add-actions"><button class="mini-link" data-add="course">添加课程</button><button class="mini-link" data-add="event">添加活动</button></div></div><div class="calendar-day calendar-day-timeline">'+buildDayTimeline(day,{date:selectedDate,nowDate:now()})+(day.length?'<div class="calendar-caption">'+day.length+' 个课程或活动 · 点击时间块可编辑</div>':'<div class="calendar-caption">当前没有安排 · 点击「添加活动」创建日程</div>')+'</div></section>'+
 '<div class="filterbar"><button class="secondary" data-action="calendar-import">'+icon('archive')+'导入课表</button><button class="quiet-button" data-action="export-ics">'+icon('export')+'导出日历</button></div>';
}
function goalsView(d){
 const open=d.goals.filter(g=>!g.done),completed=d.goals.filter(g=>g.done);
 const goalsSection=(arr)=>arr.map(g=>{
  const count=d.checkins.filter(c=>c.goalId===g.id).length,target=Math.max(1,+g.weeklyTarget||1),pct=g.done?100:Math.min(100,Math.round(count/target*100));
  return '<div class="row" data-item="'+esc(g.id)+'"><button class="circle-check '+(g.done?'checked':'')+'" data-toggle="goal" data-id="'+esc(g.id)+'" aria-label="'+(g.done?'重新进行':'完成')+esc(g.title)+'">'+(g.done?icon('check'):'')+'</button><div class="row-main"><button class="row-title '+(g.done?'is-done':'')+'" data-edit="goal" data-id="'+esc(g.id)+'" style="padding:0;border:0;background:none;text-align:left">'+esc(g.title)+'</button><div class="row-sub">'+esc(g.target||g.category||'成长')+' · '+count+' 次行动记录</div><div class="goal-progress"><span style="width:'+pct+'%"></span></div></div><div class="row-tail"><button class="small-action" data-checkin="'+esc(g.id)+'">记录行动</button><button class="icon-button" data-edit="goal" data-id="'+esc(g.id)+'" aria-label="编辑目标">'+icon('right')+'</button></div></div>'
 }).join('');
 const pct=d.goals.length?Math.round(completed.length/d.goals.length*100):0;
 return head('成长目标','为喜欢的事情留一点时间','<button class="primary" data-add="goal">'+icon('plus')+'新建目标</button>')+
 '<div class="goal-summary"><div><strong>'+open.length+' 项正在坚持</strong><p>进度来自你记录的真实行动，不自动打卡。</p></div><div class="goal-ring" style="--pct:'+pct+'"><span>'+pct+'%</span></div></div>'+
 section('进行中的目标',open.length?goalsSection(open):empty('还没有进行中的目标','音乐、运动、研究，都可以是一件值得长期做的事','新建目标','add-goal'))+
 growthPanel.render()+
 (completed.length?section('已完成',goalsSection(completed)):'');
}
function reviewView(d){
 const result=growth(d),week=result.current;const weeks=result.weeks;
 const max=Math.max(2,...weeks.map(w=>w.done+w.checkins));
 const recent=d.checkins.slice().sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,7);
 return head('手记与复盘','回顾确实发生过的事情')+
 '<div class="review-intro"><h2>这周，你留下了 '+(week.done+week.checkins)+' 次行动</h2><p>已完成 '+week.done+' 项提醒 · '+week.checkins+' 次目标行动 · '+week.minutes+' 分钟。数字仅来自保存的记录。</p><div class="review-bars">'+weeks.map((w,i)=>'<div class="review-bar"><span class="fill" style="height:'+Math.max(6,(w.done+w.checkins)/max*94)+'px"></span><small>'+esc(shortDate(w.start))+'</small></div>').join('')+'</div></div>'+
 '<div class="progress-metrics section"><div class="progress-tile"><strong>'+week.done+'</strong><small>本周完成</small></div><div class="progress-tile"><strong>'+week.checkins+'</strong><small>行动记录</small></div><div class="progress-tile"><strong>'+week.minutes+'</strong><small>累计分钟</small></div></div>'+
 section('最近的成长记录',recent.length?recent.map(c=>{const g=d.goals.find(g=>g.id===c.goalId);return '<div class="row"><span class="row-icon">'+icon('review')+'</span><div class="row-main"><p class="row-title">'+esc(c.note||g?.title||'成长行动')+'</p><div class="row-sub">'+esc(g?.title||'已删除的目标')+' · '+c.minutes+' 分钟</div></div><span class="row-time">'+esc(shortDate(c.at))+'</span></div>'}).join(''):empty('还没有记录','在成长目标中记录一次真实行动，这里就会出现你的足迹'))+
 (d.transactions.some(x=>x.status==='executed')?'<section class="section"><div class="section-head"><h2>可撤销的最近操作</h2></div><div class="group">'+d.transactions.filter(t=>t.status==='executed').slice(-3).reverse().map(t=>'<div class="settings-row"><span class="setting-icon">'+icon('archive')+'</span><span class="label">'+esc(t.title)+'</span><button class="small-action" data-undo="'+esc(t.id)+'">撤销</button></div>').join('')+'</div></section>':'');
}
function settingsRow(iconName,label,after){return '<div class="settings-row"><span class="setting-icon">'+icon(iconName)+'</span><span class="label">'+esc(label)+'</span>'+after+'</div>'}
function switchRow(name,label,checked){return '<div class="settings-row settings-toggle-row"><span class="label">'+esc(label)+'</span><lg-switch aria-label="'+esc(label)+'" data-setting="'+name+'" '+(checked?'checked':'')+'></lg-switch></div>'}
function settingsView(d){
 const s=d.settings,mode=store.mode();
 return head('设置','')+
 '<section class="section"><div class="section-head"><h2>使用体验</h2></div><div class="settings-group">'+
 switchRow('quiet','安静模式',s.quiet)+switchRow('reducedMotion','减少动效',s.reducedMotion)+switchRow('reminderEnabled','网页内提醒',s.reminderEnabled)+'</div></section>'+
 '<section class="section"><div class="section-head"><h2>学期与提醒</h2></div><div class="settings-group">'+
 settingsRow('calendar','学期名称','<input data-semester="name" type="text" aria-label="学期名称" value="'+esc(d.semester.name||'我的学期')+'">')+
 settingsRow('calendar','开始日期','<input data-semester="start" type="date" aria-label="学期开始日期" value="'+esc(d.semester.start||'')+'">')+
 settingsRow('calendar','结束日期','<input data-semester="end" type="date" aria-label="学期结束日期" value="'+esc(d.semester.end||'')+'">')+
 settingsRow('clock','免打扰开始','<input type="time" data-reminder="quietStart" aria-label="免打扰开始" value="'+esc(s.quietStart)+'">')+
 settingsRow('clock','免打扰结束','<input type="time" data-reminder="quietEnd" aria-label="免打扰结束" value="'+esc(s.quietEnd)+'">')+
 settingsRow('clock','提醒间隔（分）','<input type="number" min="1" max="1440" data-reminder="reminderGap" aria-label="提醒间隔分钟" value="'+esc(s.reminderGap)+'">')+
 '</div><p class="setting-warning">更改日期后自动保存；只有设置了有效的开始、结束日期，教学周才会生效。</p></section>'+
 '<section class="section"><div class="section-head"><h2>本地档案</h2></div><div class="settings-group">'+
 settingsRow('archive','当前模式','<button class="small-action" data-action="mode">'+(mode==='demo'?'演示档案':'私人档案')+' · 切换</button>')+
 settingsRow('export','导出 JSON 备份','<button class="small-action" data-action="export-json">导出</button>')+
 settingsRow('archive','导入 JSON 备份','<button class="small-action" data-action="import-json">选择文件</button>')+
 settingsRow('archive','清空当前档案','<button class="small-action" data-action="clear">清空</button>')+
 '</div><p class="setting-warning">所有内容保存在当前网站的浏览器存储中，不会自动同步到其他设备。导入覆盖前请先备份。</p></section>'+
 '<section class="section"><div class="section-head"><h2>高级功能</h2></div><div class="settings-group">'+
 settingsRow('growth','Agent 规划、AI 模型与完整实验室','<a class="small-action" href="../index.html" style="text-decoration:none">完整功能版</a>')+
 '</div><p class="setting-warning">新界面沿用同一份本地数据。部分高级 AI / 模型实验仍在原有完整功能页面中提供。</p></section>';
}
function searchView(d){
 const q=query.trim().toLowerCase(),all=[...d.tasks.map(x=>({kind:'task',name:x.title,id:x.id,subtitle:x.course||''})),...d.goals.map(x=>({kind:'goal',name:x.title,id:x.id,subtitle:x.category||''})),...d.courses.map(x=>({kind:'course',name:x.name,id:x.id,subtitle:x.place||''})),...d.events.map(x=>({kind:'event',name:x.name,id:x.id,subtitle:x.place||''}))];
 const matches=q?all.filter(x=>(x.name+' '+x.subtitle).toLowerCase().includes(q)):all.slice(0,10);
 return head('搜索','在你的任务、日程和目标中查找')+
 '<div class="searchbar">'+icon('search')+'<input id="search-input" type="search" placeholder="搜索任务、日程或目标" value="'+esc(query)+'" autocomplete="off"></div>'+
 '<section class="section"><div class="group">'+(matches.length?matches.map(x=>'<div class="row"><span class="row-icon">'+icon({task:'list',goal:'growth',course:'calendar',event:'calendar'}[x.kind])+'</span><div class="row-main"><button class="row-title" data-edit="'+esc(x.kind)+'" data-id="'+esc(x.id)+'" style="background:none;border:0;padding:0;text-align:left">'+esc(x.name)+'</button><div class="row-sub">'+esc(x.subtitle)+'</div></div>'+icon('right')+'</div>').join(''):empty('找不到符合的记录','尝试使用不同的关键词'))+'</div></section>';
}
function render(){
 const preserveGrowthOpen=view==='develop'&&!!$('#v4-growth-planner')?.open;
 const d=state();
 $$('.nav-item,.tab').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('is-active',active);b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 $('#date-compact').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
 $('#nav-count').textContent=d.tasks.filter(t=>!t.done).length||'';
 $('#workspace').innerHTML='<div class="page" id="page-'+view+'">'+({today:todayView,items:itemsView,develop:developView,schedule:scheduleView,tasks:tasksView,goals:goalsView,review:reviewView,settings:d=>settingsView(d)+'<div class="v4-settings-extra"><a id="v4-version-library" href="../../../versions/">浏览历史版本 '+icon('right')+'</a></div>',search:searchView}[view]||todayView)(d)+'</div>';
 if(view==='develop'&&preserveGrowthOpen)$('#v4-growth-planner').open=true;
 if(view==='develop'){
   const input=$('#journal-note'),draft=journalDrafts.get(journalDraftKey());
   if(input&&draft!==undefined)input.value=draft;
   if(moodDraft!==null){
     $$('.v4-mood-option').forEach(b=>{const active=Number(b.dataset.mood)===moodDraft;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active))});
   }
   if(moodDraft!==null||draft!==undefined){const status=$('#journal-status');if(status)status.textContent='未保存'}
 }
 if(view==='items'&&itemsTab==='schedule'){
   const scroller=$('.native-timeline-scroll'),earliest=scroller?.querySelector('.native-event');
   if(earliest){const top=Number.parseFloat(earliest.style.getPropertyValue('--top'));if(Number.isFinite(top))scroller.scrollTop=Math.max(0,Math.round(top*14.4)-60)}
 }
 if(view==='schedule'){const scroller=$('.hourly-scroll');if(scroller){const entries=visibleOn(d);const starts=entries.map(e=>Number((e.start||'08').slice(0,2))).filter(Number.isFinite);const hour=Math.max(0,Math.min(7,...starts.map(h=>Math.max(0,h-1))));scroller.scrollTop=hour*60}}
 const pending=d.tasks.filter(t=>!t.done).length;
 // V4 has a single avatar trigger; no duplicate pet panel.


 if(view==='schedule')requestAnimationFrame(()=>{
   const pane=$('.native-timeline-scroll');
   if(pane){const entry=visibleOn(state())[0];const begin=entry?.start?Number(entry.start.split(':')[0]):8;pane.scrollTop=Math.max(0,(Math.min(8,begin)-1)*60);}
 });
 document.body.classList.toggle('reduce-motion',!!d.settings.reducedMotion);
 document.body.dataset.view=view;
 const mobileNav=$('#bottom-nav');if(mobileNav){const tabs=$$('.bottom-nav .tab');mobileNav.style.setProperty('--dayflow-tab-index',String(Math.max(0,tabs.findIndex(b=>b.classList.contains('is-active')))))}
 const segment=$('.v4-develop-segments');if(segment)segment.style.setProperty('--xy-develop-index',developTab==='goals'?'1':'0');


 const addTop=document.querySelector('.glass-btn.add-top');if(addTop)addTop.hidden=view==='settings';
 if(view==='search'){$('#search-input')?.focus()}
}
// Each logical destination owns its scroll position, including inner segments.
const scrollMemory=new Map();
const scrollKey=(v=view,it=itemsTab,dt=developTab)=>
 v==='items'?'items:'+it:v==='develop'?'develop:'+dt:v;
const rememberScroll=()=>scrollMemory.set(scrollKey(),window.scrollY);
function restoreScroll(){
 const top=scrollMemory.get(scrollKey())??0;
 window.scrollTo({left:0,top,behavior:'instant'});
}
let routeMotion=null;
function stopRouteMotion(){
 if(!routeMotion)return;
 for(const anim of routeMotion.animations){try{anim.cancel()}catch{}}
 routeMotion.ghost?.remove();
 routeMotion=null;
 document.body.classList.remove('xy-motion-active');
}
// ViewTransition's DOM update runs on the next rendering frame; rapid taps used
// to race. Commit routes synchronously, then animate TWO separate visual layers.
function transitionContent(update,{animate=true,direction='neutral'}={}){
 stopRouteMotion();
 const host=$('#workspace');
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches||!!state().settings.reducedMotion;
 const useMotion=animate&&!reduced&&host&&typeof host.animate==='function';
 let ghost=null;
 if(useMotion){
   const rect=host.getBoundingClientRect();
   const top=Math.max(0,rect.top),bottom=Math.min(innerHeight,rect.bottom);
   // Long feeds must never clone hundreds of live controls just for motion.
   if(host.querySelectorAll('*').length<600&&rect.width>0&&bottom>top+20){
     ghost=document.createElement('div');
     ghost.className='xy-route-ghost';
     ghost.setAttribute('aria-hidden','true');ghost.inert=true;
     Object.assign(ghost.style,{
       left:rect.left+'px',top:top+'px',width:rect.width+'px',
       height:(bottom-top)+'px'
     });
     const snapshot=host.cloneNode(true);
     snapshot.removeAttribute('id');
     // A ghost is paint-only. Remove IDs and delegated action attributes so
     // selectors, screen readers and test locators see only the live page.
     snapshot.querySelectorAll('*').forEach(el=>{
       for(const name of el.getAttributeNames())if(name==='id'||name.startsWith('data-'))el.removeAttribute(name);
       if(el.matches('button,a,input,select,textarea,summary,[tabindex]'))el.setAttribute('tabindex','-1');
     });
     snapshot.style.transform='translateY('+(rect.top-top)+'px)';
     ghost.append(snapshot);document.body.append(ghost);
   }
 }
 update(); // ALWAYS synchronous, even if the browser drops animation frames.
 document.documentElement.dataset.xyNavDirection=direction;
 if(!ghost)return;
 const current=$('#workspace');
 document.body.classList.add('xy-motion-active');
 const sign=direction==='backward'?-1:1;
 const incoming=current.animate([
   {opacity:0,transform:'translate3d('+(sign*10)+'px,0,0)'},
   {opacity:1,transform:'translate3d(0,0,0)'}
 ],{duration:170,delay:70,easing:'cubic-bezier(.32,.72,0,1)',fill:'both'});
 const outgoing=ghost.animate([
   {opacity:1,transform:'translate3d(0,0,0)'},
   {opacity:0,transform:'translate3d('+(-sign*7)+'px,0,0)'}
 ],{duration:90,easing:'cubic-bezier(.4,0,.8,.5)',fill:'both'});
 const currentMotion={ghost,animations:[incoming,outgoing]};
 routeMotion=currentMotion;
 // The ghost is needed only for the 90ms outgoing fade, not for the full incoming transition.
 // Bounded cleanup even if a backgrounded browser throttles WAAPI finish events.
 setTimeout(()=>{ghost.remove();if(routeMotion===currentMotion)currentMotion.ghost=null},125);
 outgoing.finished.catch(()=>{}).finally(()=>{
   ghost.remove();
   if(routeMotion===currentMotion)currentMotion.ghost=null;
 });
 incoming.finished.catch(()=>{}).finally(()=>{
   if(routeMotion===currentMotion)stopRouteMotion();
 });
}
function navigate(target){
 const from=target;let next=target;
 if(target==='schedule'||target==='tasks'){itemsTab=target==='tasks'?'inbox':'schedule';next='items'}
 if(target==='goals'||target==='review'){developTab=target==='goals'?'goals':'record';next='develop'}
 if(target==='develop'&&view!=='develop')developTab='record';
 if(next===view&&from===view)return;
 const order=['today','items','develop'];
 const fromIndex=order.indexOf(view),toIndex=order.indexOf(next);
 const dir=fromIndex>=0&&toIndex>=0?(toIndex>=fromIndex?'forward':'backward'):'neutral';
 const primary=fromIndex>=0&&toIndex>=0&&fromIndex!==toIndex;
 transitionContent(()=>{
   rememberScroll();view=next;if(next!=='search')query='';render();
   if(next!=='search')restoreScroll();
 },{animate:primary,direction:dir});
}
function input(label,name,value='',type='text',extra=''){return '<div class="field"><label for="fld-'+name+'">'+esc(label)+'</label><input id="fld-'+name+'" name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></div>'}
function select(label,name,value,items){return '<div class="field"><label for="fld-'+name+'">'+esc(label)+'</label><select name="'+name+'" id="fld-'+name+'">'+items.map(([v,l])=>'<option value="'+esc(v)+'" '+(String(v)===String(value)?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></div>'}
function openSheet(title,html,context,{saveLabel='保存',hideSave=false}={}){
 modal=context;$('#sheet-title').textContent=title;$('#sheet-fields').innerHTML='<div class="sheet-panel">'+html+'</div>';$('#sheet-save').textContent=saveLabel;$('#sheet-save').hidden=hideSave;
 const sheet=$('#editor');sheet.showModal();document.body.style.overflow='hidden';setTimeout(()=>sheet.querySelector('input:not([type=hidden]),textarea,select')?.focus(),80);
}
function closeSheet(){const sheet=$('#editor');if(sheet.open)sheet.close();document.body.style.overflow='';modal=null;preview=null}
function editForm(kind,id='',preset={}){
 const key={task:'tasks',goal:'goals',course:'courses',event:'events'}[kind],obj=state()[key].find(x=>x.id===id)||{};
 let fields='';
 if(kind==='task'){
  fields=input('要做什么','title',obj.title||'','text','required maxlength="160"')+
   input('截止日期（可选）','due',obj.due||preset.due||'','datetime-local')+
   '<details id="task-advanced"'+(id?' open':'')+'><summary>更多选项</summary><div class="task-advanced-fields">'+
   select('类别','type',obj.type||'assignment',[['assignment','作业'],['exam','考试'],['task','其他事项']])+
   input('关联课程（可选）','course',obj.course||'')+
   input('预计用时（分钟）','minutes',obj.minutes||30,'number','min="1" max="1200"')+
   select('网页提醒','remind',obj.remind===false?'false':'true',[['true','开启'],['false','关闭']])+
   '</div></details>';
 }else if(kind==='goal'){
  fields=input('目标名称','title',obj.title||'','text','required maxlength="160"')+input('类别','category',obj.category||'兴趣')+
    input('具体行动或里程碑','target',obj.target||'')+input('目标日期（可选）','targetDate',obj.targetDate||'','date')+
    input('每周期望次数','weeklyTarget',obj.weeklyTarget||1,'number','min="1" max="7"')+select('跟踪类型','kind',obj.kind||'goal',[['goal','长期目标'],['habit','日常习惯']]);
 }else {
  fields=input('名称','name',obj.name||'','text','required maxlength="160"')+
    select('星期','day',obj.day??weekday(new Date()),DAYS.map((name,i)=>[String(i),name]))+
    '<div class="fieldrow">'+input('开始时间','start',obj.start||'09:00','time','required')+input('结束时间','end',obj.end||'10:30','time','required')+'</div>'+
    input('地点（可选）','place',obj.place||'')+input('单次日期（可选）','date',obj.date||'','date')+
    '<div class="fieldrow">'+input('教学起始周','weekStart',obj.weekStart||1,'number','min="1" max="54"')+input('教学结束周','weekEnd',obj.weekEnd||18,'number','min="1" max="54"')+'</div>'+
    select('周次','parity',obj.parity||'all',[['all','每周'],['odd','单周'],['even','双周']]);
 }
 if(id)fields+='<div class="sheet-footer"><button type="button" class="danger" data-delete="'+kind+'" data-id="'+esc(id)+'">删除记录</button></div>';
 openSheet((id?'编辑':'新增')+({task:'提醒',goal:'目标',course:'课程',event:'活动'}[kind]),fields,{type:'edit',kind,id});
}
function saveEdit(){
 const {kind,id}=modal,key={task:'tasks',goal:'goals',course:'courses',event:'events'}[kind];
 if(!key)return;
 const f=Object.fromEntries(new FormData($('#sheet-body')));
 if(kind==='task'){
   if(!f.title.trim()||(f.due&&!Number.isFinite(+new Date(f.due))))return notify('请输入标题和有效的截止日期');
   f.title=f.title.trim();f.minutes=Math.max(1,Math.min(1200,Number(f.minutes)||30));f.remind=f.remind!=='false';
 }else if(kind==='goal'){
   if(!f.title.trim())return notify('请输入目标名称');
   f.title=f.title.trim();f.weeklyTarget=Math.max(1,Math.min(7,Number(f.weeklyTarget)||1));
 }else{
   f.day=Number(f.day);f.weekStart=Number(f.weekStart);f.weekEnd=Number(f.weekEnd);f.exceptions=state()[key].find(x=>x.id===id)?.exceptions||[];
   try{checkSchedule(f)}catch(e){return notify(e.message)}
 }
 const previous=state()[key].find(x=>x.id===id);
 const next={...previous,...f,id:id||uid(),createdAt:previous?.createdAt||new Date().toISOString()};
 if(kind==='task'||kind==='goal'){next.done=previous?.done||false;if(!previous)next.completedAt=null}
 const ok=save(d=>{if(id)d[key]=d[key].map(x=>x.id===id?next:x);else d[key].push(next);
   d.history.unshift({id:uid(),at:new Date().toISOString(),action:id?'edited':'added',description:(id?'更新':'新增')+'：'+(next.title||next.name)});
 });
 if(ok)closeSheet();
}
function complete(kind,id){
 const key=kind==='task'?'tasks':'goals';save(d=>{const x=d[key].find(v=>v.id===id);if(!x)return;x.done=!x.done;x.completedAt=x.done?new Date().toISOString():null;d.history.unshift({id:uid(),at:new Date().toISOString(),action:'completed',description:(x.done?'完成：':'恢复：')+x.title})});
}
function openCheckin(goalId){
 const goal=state().goals.find(x=>x.id===goalId);if(!goal)return;
 openSheet('记录一次真实行动','<p class="sheet-note">为「'+esc(goal.title)+'」留下确实发生的行动，而不是自动打卡。</p>'+input('时间','at',localStamp(now()),'datetime-local','required')+input('分钟（0–1440）','minutes',20,'number','min="0" max="1440" required')+
 '<div class="field"><label for="fld-note">记录内容</label><textarea id="fld-note" name="note" maxlength="500" placeholder="这次做了什么？" required></textarea></div>',{type:'checkin',goalId});
}
function saveCheckin(){
 const f=Object.fromEntries(new FormData($('#sheet-body'))),t=new Date(f.at),minutes=Number(f.minutes);
 if(!Number.isFinite(+t)||t>now()||!Number.isInteger(minutes)||minutes<0||minutes>1440||!f.note?.trim())return notify('请填写有效的时间、分钟和行动内容');
 const ok=save(d=>{d.checkins.push({id:uid(),goalId:modal.goalId,at:t.toISOString(),minutes,note:f.note.trim().slice(0,500)});d.history.unshift({id:uid(),at:now().toISOString(),action:'checkin',description:'记录行动：'+f.note.trim().slice(0,90)})});if(ok)closeSheet();
}
function confirmDelete(kind,id){
 const key={task:'tasks',goal:'goals',course:'courses',event:'events'}[kind],x=state()[key]?.find(v=>v.id===id);if(!x)return;
 if(!confirm('确定删除「'+(x.title||x.name)+'」？可在复盘中撤销最近操作。'))return;
 const ok=save(d=>{d[key]=d[key].filter(v=>v.id!==id);if(kind==='goal')d.checkins=d.checkins.filter(c=>c.goalId!==id);d.history.unshift({id:uid(),at:now().toISOString(),action:'deleted',description:'删除：'+(x.title||x.name)})});if(ok)closeSheet();
}
function openSuggestion(id){
 const s=suggestions(state()).find(x=>x.id===id);if(!s?.action)return notify('建议已过期，请重新分析');
 const a=s.action;
 openSheet('预览小芽的安排','<p class="sheet-note">'+esc(s.description)+'</p><p class="sheet-note">'+esc(s.reason)+'</p><div class="group"><div class="row"><span class="row-icon">'+icon('clock')+'</span><div class="row-main"><strong class="row-title">'+esc(a.title||s.title)+'</strong><p class="row-sub">'+esc(a.start?fmtDate(a.start):'自动规划')+' – '+esc(a.end?fmtDate(a.end):'')+'</p></div></div></div><p class="sheet-note">只有点击“批准并执行”才会写入你的本地日程。</p>',{type:'approval',suggestion:s},{saveLabel:'批准并执行'});
}
function submitSheet(e){
 e.preventDefault();if(!modal)return;
 if(modal.type==='edit')saveEdit();
 else if(modal.type==='checkin')saveCheckin();
 else if(modal.type==='approval'){
   try{const result=executePlan(state(),modal.suggestion);store.replace(result.next);closeSheet();render();notify('已批准并保存日程')}catch(e){notify('安排未执行：'+e.message)}
 }else if(modal.type==='growth')growthPanel.approve(modal);
 else if(modal.type==='pet')closeSheet();
}
function rejectSuggestion(id){const s=suggestions(state()).find(x=>x.id===id);if(!s)return;save(d=>{d.decisions.push({id,status:'rejected',at:now().toISOString(),reason:'用户暂不采纳',sourceIds:s.sources})})}
function blobDownload(text,mime,name){const a=document.createElement('a'),href=URL.createObjectURL(new Blob([text],{type:mime}));a.href=href;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000)}
function runAction(action,source){
 switch(action){
 case 'add':editForm(view==='develop'?'goal':view==='items'&&itemsTab==='schedule'?'event':'task');break;
 case 'add-task':editForm('task');break;
 case 'go-schedule':navigate('schedule');break;
 case 'add-event':editForm('event');break;
 case 'prev-week':weekStart=plusDays(weekStart,-7);selectedDate=dateKey(weekStart);render();break;
 case 'next-week':weekStart=plusDays(weekStart,7);selectedDate=dateKey(weekStart);render();break;
 case 'now-week':weekStart=monday(now());selectedDate=dateKey(now());render();break;
 case 'search':navigate('search');break;
 case 'open-goals-archive':notify('已完成的目标保留在原版成长记录中。');break;
 case 'close':closeSheet();break;
 case 'pet':assistant.open(source);break;
 case 'mode':store.setMode(store.mode()==='demo'?'personal':'demo');navigate('today');notify(store.mode()==='demo'?'已切换到合成演示档案':'已返回私人档案');break;
 case 'export-json':blobDownload(JSON.stringify({...state(),journalV1:journal.all(),exportedAt:now().toISOString(),archiveMode:store.mode()},null,2),'application/json','xiaoya-'+store.mode()+'-'+dateKey(now())+'.json');notify('已导出当前档案');break;
 case 'import-json':$('#import-file').click();break;
 case 'export-ics':blobDownload(exportCalendar(state()),'text/calendar','xiaoya-calendar.ics');notify('已导出日历');break;
 case 'calendar-import':$('#calendar-file').click();break;
 case 'clear':if(confirm('确定清空当前档案和日记？建议先导出备份。')&&confirm('再次确认：清空后不能撤销。')){store.replace(emptyStore());journal.clear();clearModeDrafts();navigate('today');notify('已清空当前档案和日记')}break;
 }
}
document.addEventListener('click',e=>{
 const t=e.target.closest('button');if(!t)return;
 if(growthPanel.handle(t))return;
 if(t.dataset.itemsTab){
   const target=t.dataset.itemsTab;if(target===itemsTab)return;
   const dir=target==='inbox'?'forward':'backward';
   transitionContent(()=>{
     rememberScroll();itemsTab=target;view='items';render();restoreScroll();
   },{direction:dir});return;
 }
 if(t.dataset.developTab){
   const target=t.dataset.developTab;if(target===developTab)return;
   transitionContent(()=>{
     rememberScroll();developTab=target;
     $$('.v4-develop-segments [data-develop-tab]').forEach(b=>{
       const active=b.dataset.developTab===developTab;
       b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));
     });
     const segment=$('.v4-develop-segments');
     if(segment)segment.style.setProperty('--xy-develop-index',developTab==='goals'?'1':'0');
     $$('[data-develop-panel]').forEach(panel=>{panel.hidden=panel.dataset.developPanel!==developTab});
     restoreScroll();
   },{direction:target==='goals'?'forward':'backward'});
   return;
 }
 if(t.dataset.mood){
   moodDraft=Number(t.dataset.mood);
   $$('.v4-mood-option').forEach(b=>{const active=Number(b.dataset.mood)===moodDraft;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active))});
   const status=$('#journal-status');if(status)status.textContent='未保存';
   return;
 }
 if(t.dataset.journalDate){journalDate=t.dataset.journalDate;moodDraft=null;render();document.getElementById('development-mood')?.scrollIntoView({block:'start'});return}
 if(t.id==='journal-save'){
   try{
    const current=journal.all().find(e=>e.date===journalDate);
    journal.save({date:journalDate,mood:moodDraft??current?.mood??null,note:$('#journal-note').value,tags:current?.tags||[]});
    journalDrafts.delete(journalDraftKey());moodDraft=null;render();$('#journal-status').textContent='已保存到当前浏览器';notify('日记已保存');
   }catch(e){notify(e.message)}
   return;
 }
 if(t.id==='journal-delete'){
   if(!confirm('删除这一天的心情与日记记录？'))return;
   try{journal.remove(journalDate);journalDrafts.delete(journalDraftKey());moodDraft=null;render();notify('记录已删除')}catch(e){notify(e.message)}
   return;
 }
 if(t.dataset.view)return navigate(t.dataset.view);
 if(t.dataset.add)return editForm(t.dataset.add,'',t.dataset.dueDate?{due:t.dataset.dueDate+'T23:59'}:{});
 if(t.dataset.edit)return editForm(t.dataset.edit,t.dataset.id);
 if(t.dataset.toggle)return complete(t.dataset.toggle,t.dataset.id);
 if(t.dataset.action)return runAction(t.dataset.action,t);
 if(t.dataset.filter){filter=t.dataset.filter;render();return}
 if(t.dataset.day){selectedDate=t.dataset.day;render();return}
 if(t.dataset.checkin)return openCheckin(t.dataset.checkin);
 if(t.dataset.delete)return confirmDelete(t.dataset.delete,t.dataset.id);
 if(t.dataset.suggest)return openSuggestion(t.dataset.suggest);
 if(t.dataset.reject)return rejectSuggestion(t.dataset.reject);
 if(t.dataset.undo){try{store.replace(undoTransaction(state(),t.dataset.undo));render();notify('操作已撤销')}catch(e){notify(e.message)}}
});
$('#sheet-body').addEventListener('submit',submitSheet);
// Native cancel can hide the dialog before close dispatches; release scroll synchronously.
$('#editor').addEventListener('cancel',e=>{e.preventDefault();closeSheet()});
$('#editor').addEventListener('close',()=>{document.body.style.overflow='';modal=null});
$('#editor').addEventListener('click',e=>{if(e.target===$('#editor'))closeSheet()});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!$('#editor').open&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();navigate('search')}});
document.addEventListener('input',e=>{if(e.target.id==='journal-note'){journalDrafts.set(journalDraftKey(),e.target.value);const status=$('#journal-status');if(status)status.textContent='未保存';return}if(e.target.id==='search-input'){query=e.target.value;const start=e.target.selectionStart;render();$('#search-input')?.setSelectionRange(start,start)}});
document.addEventListener('change',e=>{
 const t=e.target;
 const setting=t.dataset.setting||t.closest('lg-switch')?.dataset.setting;
 if(setting){save(d=>{d.settings[setting]=t.checked});return}
 if(t.dataset.semester){const vals={...state().semester,[t.dataset.semester]:t.value};if(vals.start&&vals.end){try{checkSemester(vals)}catch(e){notify(e.message);render();return}}save(d=>{d.semester=vals});return}
 if(t.dataset.reminder){save(d=>{d.settings[t.dataset.reminder]=t.type==='number'?Number(t.value):t.value});return}
});
$('#import-file').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{const incoming=JSON.parse(await file.text()),next=validateStore(incoming),journals=incoming.journalV1===undefined?null:validateJournalArchive(incoming.journalV1);if(!confirm('导入将覆盖当前'+(store.mode()==='demo'?'演示':'私人')+'档案。已备份当前数据吗？'))return;store.replace(next);if(journals)journal.replace(journals);clearModeDrafts();navigate('today');notify('已恢复档案'+(journals?'和日记':'；原文件不含日记'))}catch(err){notify('导入失败：'+err.message)}
});
$('#calendar-file').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{const candidate=parseSchedule(await file.text(),file.name,state());if(!candidate.items?.length)return notify('没有新的课表记录');if(!confirm('确认导入 '+candidate.items.length+' 条课表记录？'))return;store.replace(applyImport(state(),candidate).next);navigate('schedule');notify('导入成功')}catch(err){notify('导入失败：'+err.message)}
});
window.addEventListener('storage',e=>{if(e.key===store.key()){try{store.refresh();render();notify('已读取另一标签页更新的记录')}catch(err){notify(err.message)}}});
window.__XY_NATIVE_V3={version:'4.2',getMode:()=>store.mode(),getData:()=>state(),navigate,render,store};
window.__XY_NATIVE_V4=window.__XY_NATIVE_V3;
// Preserve the original spring engine only for the avatar; navigation hitboxes must never move on press.
for(const btn of $$('#xiaoya-avatar')){
 const spring=createSpring(0,v=>{btn.style.setProperty('--avatar-scale',String(1-.045*v))},{stiffness:460,damping:36});
 const release=()=>spring.set(0);
 btn.addEventListener('pointerdown',e=>{if(e.button===0&&!matchMedia('(prefers-reduced-motion:reduce)').matches&&!state().settings.reducedMotion)spring.set(1)});
 for(const n of ['pointerup','pointercancel','lostpointercapture','blur'])btn.addEventListener(n,release);
}
render();
