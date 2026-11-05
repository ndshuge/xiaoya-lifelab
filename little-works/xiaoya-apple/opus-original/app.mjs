// 小芽 · 铅笔与墨水 (Opus Original experiment)
// One page of time at three magnifications. Ink = what you saved. Pencil = what Xiaoya proposes.
// All business rules come from the existing, tested modules; this file is presentation + wiring.
import {uid,esc,emptyStore,validateStore,dueLabel,localStamp} from '../core.js';
import {dateKey,plusDays,monday,weekday,checkSchedule,checkSemester,parseSchedule,applyImport,exportCalendar,undoTransaction,deliverReminders,isQuiet,freeSlots,teachingWeek,occurrences} from '../domain.js';
import {createStore} from '../native-v4/store.mjs';
import {createJournalStore,validateJournalArchive,analyzeJournal} from '../native-v4/journal-store.mjs';
import {createStudentAgentController} from '../student-agent.js';
import {createAdaptiveGrowthController} from '../adaptive-growth-agent.js';
import {createGrowthChatProvider} from '../adaptive-growth-provider.js';
import {buildContextSnapshot,buildContextualSuggestions} from '../context-agent.js';
import {createContextActionController} from '../context-actions.js';
import {fetchCityForecast} from '../weather-forecast.js';
import {buildGrowthRoutes,commitGrowthRoute,summarizeGrowthWorkload,growthStageTasks} from '../growth-simulator.js';
import {parseLine} from './line-parser.mjs';
import {buildDay,buildWeek,buildLongLine,headline,pencilStrokes,timeMap,shortDay,DAYNAMES} from './page-model.mjs';
import {createTalk} from './talk.mjs';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const MOODS=[[1,'低落','xiaoya-mood-1-hi-v2.webp'],[2,'疲倦','xiaoya-mood-2-hi.webp'],[3,'平稳','xiaoya-mood-3-hi.webp'],[4,'不错','xiaoya-mood-4-hi.webp'],[5,'很好','xiaoya-mood-5-hi.webp']];
const FACE={idle:3,listen:4,nod:4,happy:5,sleepy:2,care:3};
const CITIES=[{id:'xian',name:'西安',latitude:34.3,longitude:108.9},{id:'beijing',name:'北京',latitude:39.9,longitude:116.4},{id:'shanghai',name:'上海',latitude:31.2,longitude:121.5},{id:'guangzhou',name:'广州',latitude:23.1,longitude:113.3},{id:'chengdu',name:'成都',latitude:30.7,longitude:104.1},{id:'wuhan',name:'武汉',latitude:30.6,longitude:114.3},{id:'fuzhou',name:'福州',latitude:26.1,longitude:119.3},{id:'hangzhou',name:'杭州',latitude:30.3,longitude:120.2}];
const UI_KEY='xiaoya-opus-original:ui:v1'; // non-private view preference only
const assetFace=n=>'../native-v4/assets/'+MOODS[n-1][2];
const timeLabel=s=>s?String(s).slice(11,16):'';
const md=key=>{const d=new Date(key+'T12:00');return (d.getMonth()+1)+'月'+d.getDate()+'日'};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!!safeState()?.settings?.reducedMotion;
const pad=n=>String(n).padStart(2,'0');

// ---------- data ----------
const params=new URLSearchParams(location.search);
let store;
try{store=createStore({preferDemoOnFreshSession:params.get('judge')==='1'||params.get('demo')==='1'})}
catch(e){$('#page').innerHTML='<section class="fatal"><h1>这份档案需要先处理</h1><p>为了保护你的记录，小芽不会覆盖无法读取的数据。</p><p class="fatal-msg">'+esc(e.message)+'</p><a href="../native-v4/">打开正式版导出备份</a></section>';$('#page').setAttribute('aria-busy','false');throw e}
const state=()=>store.current();
function safeState(){try{return store.current()}catch{return null}}
const journal=createJournalStore({getMode:()=>store.mode()});
const persist=next=>store.replace(next);
const clock=()=>new Date();
const consent={weather:false,mood:false,city:null,forecast:null};
const contextSnapshot=()=>buildContextSnapshot(state(),{now:new Date(),consents:{weather:consent.weather,mood:consent.mood,weatherCityId:consent.city?.id||'',weatherToModel:false},journalEntries:consent.mood?journal.all():[],weatherSnapshot:consent.weather?consent.forecast:null});
const student=createStudentAgentController({getData:state,persist,clock});
const contextActions=createContextActionController({getData:state,getContext:contextSnapshot,persist,clock});

let ui={scale:'day',date:dateKey(new Date()),weekStart:dateKey(monday(new Date())),open:null,previews:new Map(),fresh:new Set(),plan:null,planRevision:null,routes:null,forced:null};
try{const saved=JSON.parse(localStorage.getItem(UI_KEY)||'{}');if(['day','week','line'].includes(saved.scale))ui.scale=saved.scale}catch{}
const drafts=new Map(); // `${mode}:${date}` -> {mood,note}; memory only, never auto-saved
const draftKey=date=>store.mode()+':'+date;

// The engine's "welcome" card duplicates the page header's empty-state sentence, so the page omits it.
function feed(){try{return student.feed().candidates.filter(c=>c.kind!=='welcome')}catch{return []}}
function contextNotes(){try{return buildContextualSuggestions(contextSnapshot())}catch{return []}}
function safeContext(){try{return contextSnapshot()}catch{return null}}
function journalAll(){try{return journal.all()}catch{return []}}
function moodToday(){const e=journalAll().find(x=>x.date===dateKey(new Date()));return e&&Number.isInteger(e.mood)?e.mood:null}

// ---------- Xiaoya presence & whisper ----------
let faceTimer=null;
function setXiaoya(stateName,hold=1800){
 const btn=$('#xiaoya');if(!btn)return;
 const base=baseFace();
 const s=stateName||base;
 btn.dataset.state=s;btn.querySelector('img').src=assetFace(FACE[s]||3);
 clearTimeout(faceTimer);
 if(s!==base)faceTimer=setTimeout(()=>{btn.dataset.state=base;btn.querySelector('img').src=assetFace(FACE[base]||3)},hold);
}
function baseFace(){const d=safeState();const h=new Date().getHours();if(d&&(d.settings.quiet||isQuiet(d,new Date()))||h>=23||h<6)return 'sleepy';return 'idle'}
let whisperTimer=null;
function whisper(text,action=null,kind=''){
 const el=$('#whisper');el.innerHTML='<span>'+esc(text)+'</span>'+(action?'<button type="button" data-whisper-action>'+esc(action.label)+'</button>':'');
 el.dataset.kind=kind;el.classList.add('show');
 el.onclick=e=>{if(e.target.closest('[data-whisper-action]')){el.classList.remove('show');action.run()}};
 clearTimeout(whisperTimer);whisperTimer=setTimeout(()=>el.classList.remove('show'),action?6500:3200);
}

// ---------- ink helpers (every manual write goes through the guarded store) ----------
function ink(change,message,{celebrate=false}={}){
 try{
  const before=state().transactions.length;
  store.commit(change);
  const after=state().transactions;const tx=after.length>before?after[after.length-1].id:null;
  render();whisper(message,tx?{label:'擦掉',run:()=>erase(tx)}:null);
  setXiaoya(celebrate?'happy':'nod');return true;
 }catch(e){render();whisper(e.message,null,'error');return false}
}
function erase(txId){
 try{store.replace(undoTransaction(state(),txId));render();whisper('已擦掉，恢复到落墨前');setXiaoya('nod')}
 catch(e){whisper(e.message,null,'error')}
}
function markFresh(tx){
 ui.fresh=new Set((tx?.changes||[]).filter(c=>c.key==='events'&&c.after).map(c=>c.after.id));
 setTimeout(()=>{ui.fresh.clear();$$('.is-fresh').forEach(n=>n.classList.remove('is-fresh'))},1600);
}

// ---------- sheet ----------
let sheetHandler=null,sheetClosing=null;
function openSheet(title,html,{ok='保存',onOk=null,hideOk=false,wide=false}={}){
 const sheet=$('#sheet');clearTimeout(sheetClosing);sheet.classList.remove('is-closing');
 $('#sheet-title').textContent=title;$('#sheet-body').innerHTML=html;
 $('#sheet-ok').textContent=ok;$('#sheet-ok').hidden=hideOk;$('#sheet-ok').disabled=false;
 sheet.classList.toggle('is-wide',wide);sheetHandler=onOk;
 if(!sheet.open)sheet.showModal();
 // On touch screens, only an explicit [autofocus] field may raise the keyboard; otherwise focus the title.
 requestAnimationFrame(()=>{const coarse=matchMedia('(pointer: coarse)').matches;const t=$('#sheet-title');t.tabIndex=-1;
  const target=sheet.querySelector('[autofocus]')||(coarse?null:sheet.querySelector('.sheet-body input:not([type=hidden]):not([type=checkbox]),.sheet-body textarea,.sheet-body select'));
  (target||t).focus({preventScroll:true})});
}
function closeSheet(){
 const sheet=$('#sheet');if(!sheet.open)return;sheetHandler=null;
 if(reduced()){sheet.close();return}
 sheet.classList.add('is-closing');
 sheetClosing=setTimeout(()=>{sheet.classList.remove('is-closing');sheet.close()},170);
}
$('#sheet-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!sheetHandler)return closeSheet();
 const result=await sheetHandler(new FormData($('#sheet-form')),e.submitter);
 if(result!==false)closeSheet();
});
$('#sheet').addEventListener('cancel',e=>{e.preventDefault();closeSheet()});
$('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet'))closeSheet()});

const talk=createTalk({esc,getData:state,getJournal:()=>consent.mood?journalAll():[],getContext:safeContext,getCandidates:feed,getMoodToday:()=>consent.mood?moodToday():moodToday(),openSheet,closeSheet,whisper,setXiaoya,onChange:()=>syncLineMode()});

// ---------- rendering ----------
function render(){
 let data;try{data=state()}catch(e){$('#page').innerHTML='<section class="fatal"><h1>无法读取档案</h1><p class="fatal-msg">'+esc(e.message)+'</p></section>';return}
 document.body.classList.toggle('reduce',reduced());
 document.body.dataset.scale=ui.scale;document.body.dataset.mode=store.mode();
 renderMast(data);
 const page=$('#page');
 const html=ui.scale==='week'?renderWeek(data):ui.scale==='line'?renderLine(data):renderDay(data);
 page.innerHTML=html;page.setAttribute('aria-busy','false');
 $$('#scale [data-scale]').forEach(b=>{const on=b.dataset.scale===ui.scale;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});
 $('#scale').style.setProperty('--i',String(['day','week','line'].indexOf(ui.scale)));
 if(ui.scale==='day')layoutMargin();
 if(ui.scale==='line'){const sc=$('.lgrid-scroll'),cur=$('.lgrid-head .is-current');if(sc&&cur&&sc.scrollWidth>sc.clientWidth)sc.scrollLeft=Math.max(0,cur.offsetLeft-sc.clientWidth*.55)}
 talk.refresh();
 if(!$('#xiaoya').dataset.state||['idle','sleepy'].includes($('#xiaoya').dataset.state))setXiaoya(null);
}
function renderMast(data){
 const now=new Date(),tw=teachingWeek(data,now);
 $('#mast-date').innerHTML='<span class="mast-day">'+(now.getMonth()+1)+'月'+now.getDate()+'日</span><span class="mast-sub">'+DAYNAMES[weekday(now)]+(tw?' · 第 '+tw+' 教学周':'')+' · '+(store.mode()==='demo'?'<b class="mode-demo">演示档案</b>':'私人档案')+'</span>';
}
function noteFor(c,{dated=false,rival=null}={}){
 const open=ui.open===c.id,pv=ui.previews.get(c.id),a=c.action;
 const last=a?.steps?.length>1?a.steps[a.steps.length-1].end:a?.end;
 const when=a?.start?(dated?shortDay(a.start.slice(0,10))+' ':'')+timeLabel(a.start)+'–'+(last&&last.slice(0,10)!==a.start.slice(0,10)?shortDay(last.slice(0,10))+' ':'')+timeLabel(last):'';
 const kicker=rival?'同一段时间的另一种用法 · '+when:a?(c.kind==='conflict'?'小芽想挪一下':'小芽画了一笔')+(when?' · '+when:''):c.kind==='conflict'?'小芽发现':'小芽留意到';
 let proof='';
 if(open){
  if(pv?.error)proof='<p class="note-error">'+esc(pv.error)+'</p>';
  proof+='<div class="note-proof"><p><b>依据</b>'+esc(String(c.reason||'基于你保存的记录').replace(/^依据[:：]\s*/,''))+'</p>'+
   (a?'<p><b>落墨后</b>'+esc(impact(a))+'</p>':'<p><b>说明</b>这条没有可以自动落墨的安全空档，需要你自己调整。</p>')+
   '<div class="note-actions">'+(a&&pv&&!pv.error?'<button type="button" class="ink-btn" data-approve="'+esc(c.id)+'">落墨</button>':'')+
   '<button type="button" class="ghost-btn" data-snooze="'+esc(c.id)+'">明天再说</button><button type="button" class="ghost-btn" data-reject="'+esc(c.id)+'">不需要</button></div></div>';
 }
 return '<article class="note is-pencil'+(open?' is-open':'')+'" data-note="'+esc(c.id)+'"><button type="button" class="note-head" data-expand="'+esc(c.id)+'" aria-expanded="'+open+'"><span class="note-kicker">'+esc(kicker)+'</span><strong>'+esc(c.title)+'</strong><span class="note-desc">'+esc(c.description)+'</span></button>'+proof+'</article>';
}
function contextNote(s){
 const open=ui.open===s.id,pv=ui.previews.get(s.id);
 return '<article class="note is-context'+(open?' is-open':'')+'" data-note="'+esc(s.id)+'"><button type="button" class="note-head" data-expand-context="'+esc(s.id)+'" aria-expanded="'+open+'"><span class="note-kicker">'+(s.kind==='outdoor-weather'?'天气 · 已授权':'今天的心情 · 已授权')+'</span><strong>'+esc(s.title)+'</strong><span class="note-desc">'+esc(s.description)+'</span></button>'+
  (open?'<div class="note-proof"><p><b>依据</b>'+esc(s.reason)+'</p><p><b>不确定性</b>'+esc(s.uncertainty||'')+'</p>'+
   (s.kind==='outdoor-weather'?(pv?.error?'<p class="note-error">'+esc(pv.error)+'</p>':pv?'<p><b>落墨后</b>新增待办「'+esc(pv.task.title)+'」，'+esc(pv.task.due.replace('T',' '))+' 截止。</p><div class="note-actions"><button type="button" class="ink-btn" data-approve-context="'+esc(s.id)+'">落墨</button></div>':''):'')+'</div>':'')+'</article>';
}
function impact(a){
 if(a.type==='moveEvent')return '把这一次的「'+a.title+'」挪到 '+a.start.replace('T',' ')+'–'+timeLabel(a.end)+'，课程和其他周次不变。';
 if(a.type==='splitTask')return '新增两段日程：'+a.steps.map(s=>timeLabel(s.start)+'–'+timeLabel(s.end)).join('、')+'（'+shortDay(a.start.slice(0,10))+'），各带一个子事项；原截止时间不变。';
 if(a.type==='planGoal')return '在 '+shortDay(a.start.slice(0,10))+' '+timeLabel(a.start)+'–'+timeLabel(a.end)+' 留一段目标行动时间；完成后仍需你记录真实行动。';
 return '在 '+shortDay(a.start.slice(0,10))+' '+timeLabel(a.start)+'–'+timeLabel(a.end)+' 新增一段专注日程并建一个子事项；原截止时间和课程不变。';
}
function renderDay(data){
 const now=new Date(),today=dateKey(now),cands=feed(),pencils=pencilStrokes(cands);
 const day=buildDay(data,ui.date,{now,pencils});
 const ctx=safeContext(),h=headline(data,day,{now,pencils,context:ctx});
 const H=matchMedia('(max-width: 819px)').matches?46:56;
 const map=timeMap(day,{hour:H});
 const top=m=>map.y(m);
 const inBand=m=>map.segments.some(s=>s.band&&m>s.m0&&m<s.m1);
 const hours=[];for(let i=day.startHour;i<=day.endHour;i++)if(!inBand(i*60))hours.push(i);
 const bands=map.segments.filter(s=>s.band).map(s=>{const f=s.free,hrs=Math.floor(f.minutes/60),mins=f.minutes%60;
  const past=day.isToday&&f.to<=day.nowMin||ui.date<today;
  return '<button type="button" class="free-band'+(past?' is-past':'')+'" data-minute="'+(day.isToday?Math.max(f.from,Math.ceil((day.nowMin+5)/15)*15):f.from)+'" style="top:'+s.y0+'px;height:'+(s.y1-s.y0)+'px" aria-label="'+toHM(f.from)+' 到 '+toHM(f.to)+' 空着，点一下安排"><span><b>'+toHM(f.from)+'–'+toHM(f.to)+'</b> 空着 '+(hrs?hrs+' 小时':'')+(mins?' '+mins+' 分':'')+'</span>'+(past?'':'<small>点一下放点什么</small>')+'</button>';}).join('');
 const blocks=day.blocks.map(b=>{
  const y=top(b.top),hgt=Math.max(b.type==='pencil'?30:26,top(b.bottom)-y-2);
  const lane='--lane:'+(b.lane||0)+';--lanes:'+(b.lanes||1)+';';
  const compact=hgt<44?' is-compact':'';
  if(b.type==='pencil'){
   const open=ui.open===b.id;
   return '<button type="button" class="blk pencil'+compact+(open?' is-open':'')+'" data-expand="'+esc(b.id)+'" style="top:'+y+'px;height:'+hgt+'px;'+lane+'" aria-label="铅笔建议：'+esc(b.title)+' '+b.start+'–'+b.end+'，点开看依据"><span class="blk-title">'+esc(b.title)+'</span><span class="blk-meta">'+b.start+'–'+b.end+(b.steps>1?' · 第 '+(b.step+1)+'/'+b.steps+' 段':'')+' · 铅笔</span>'+(b.others.length?'<span class="blk-stack">另有 '+b.others.length+' 笔也想用这段时间</span>':'')+'</button>';
  }
  return '<button type="button" class="blk ink '+b.kind+compact+(b.conflict?' is-conflict':'')+(ui.fresh.has(b.id)?' is-fresh':'')+'" data-edit="'+b.kind+'" data-id="'+esc(b.id)+'" style="top:'+y+'px;height:'+hgt+'px;'+lane+'"><span class="blk-title">'+(b.fromAgent?'<i class="sprout-dot" title="小芽建议、你已批准"></i>':'')+esc(b.title)+'</span><span class="blk-meta">'+b.start+'–'+b.end+(b.place?' · '+esc(b.place):'')+(b.conflict?' · 重叠':'')+(b.step?.done?' · 做完了':'')+'</span></button>'+
   (b.step?'<button type="button" class="blk-step'+(b.step.done?' is-done':'')+'" style="top:'+(y+Math.min(hgt/2,22)-14)+'px" data-toggle-task="'+esc(b.step.id)+'" aria-pressed="'+b.step.done+'" aria-label="'+(b.step.done?'恢复':'完成')+'这一段：'+esc(b.title)+'"></button>':'');
 }).join('');
 const lines=day.deadlines.map(d=>'<div class="due-line'+(d.done?' is-done':'')+(d.overdue?' is-overdue':'')+'" style="top:'+top(d.at)+'px"><button type="button" class="due-check" data-toggle-task="'+esc(d.id)+'" aria-label="'+(d.done?'恢复':'完成')+'「'+esc(d.title)+'」" aria-pressed="'+d.done+'"></button><button type="button" class="due-label" data-edit="task" data-id="'+esc(d.id)+'"><b>'+d.time+(d.done?' 已交':' 截止')+'</b>'+esc(d.title)+'</button></div>').join('');
 const nowLine=day.nowMin!==null&&day.nowMin>=day.startHour*60&&day.nowMin<=day.endHour*60?'<div class="past" style="height:'+top(day.nowMin)+'px"></div><div class="now-line" style="top:'+top(day.nowMin)+'px"><span>'+pad(now.getHours())+':'+pad(now.getMinutes())+'</span></div>':(ui.date<today?'<div class="past" style="height:100%"></div>':'');
 // Margin: pencil notes on this date, plus actionless notes and context notes on today.
 const noteEntries=[];
 const stacked=new Map();for(const b of day.blocks)if(b.type==='pencil')for(const o of b.others)stacked.set(o.id,b.title);
 for(const c of cands){const d=c.action?.start?.slice(0,10);if(d===ui.date||(!c.action&&ui.date===today))noteEntries.push({id:c.id,y:c.action?.start?top(minutesOf(c.action.start)):0,html:noteFor(c,{rival:stacked.get(c.id)})})}
 if(ui.date===today)for(const s of contextNotes())noteEntries.push({id:s.id,y:0,html:contextNote(s)});
 noteEntries.sort((a,b)=>a.y-b.y);
 const margin=noteEntries.length?noteEntries.map(n=>'<div class="note-slot" data-y="'+Math.max(0,n.y)+'">'+n.html+'</div>').join(''):'<p class="margin-empty">'+(ui.date<today?'这一天已经翻过去了。':'页边空着：小芽暂时没有要提的。')+'</p>';
 const weatherLine=ctx?.weather&&ui.date===today?'<p class="weather">'+esc(ctx.weather.cityLabel)+' · '+ctx.weather.days.slice(0,3).map(w=>(w.date===today?'今天':w.date===ctx.tomorrow?'明天':w.date.slice(5))+' '+w.temperatureMinC+'–'+w.temperatureMaxC+'° 降水 '+w.precipitationProbabilityMax+'%').join(' · ')+' <small>Open-Meteo</small></p>':'';
 const ahead=ui.date===today?renderAhead(data,cands,now):'';
 return '<section class="day" aria-labelledby="day-title">'+
  '<div class="day-nav"><button type="button" class="nav-arrow" data-day-shift="-1" aria-label="前一天">‹</button><h1 id="day-title">'+(ui.date===today?'今天':md(ui.date))+'<small>'+(ui.date===today?md(ui.date)+' ':'')+DAYNAMES[weekday(new Date(ui.date+'T12:00'))]+'</small></h1><button type="button" class="nav-arrow" data-day-shift="1" aria-label="后一天">›</button>'+(ui.date!==today?'<button type="button" class="nav-today" data-day-today>回到今天</button>':'')+'</div>'+
  '<p class="voice" data-tone="'+h.tone+'"><img src="'+assetFace(h.tone==='remind'?4:3)+'" alt="" width="30" height="30">'+esc(h.text)+'</p>'+weatherLine+
  (isEmptyArchive(data)?'<div class="starter" aria-label="试着写一行"><span>试着写一行：</span>'+['周五前交实验报告 90分钟','明天下午3点到5点 社团例会 @创新中心','每周跑步两次','买洗衣液'].map(s=>'<button type="button" data-try="'+esc(s)+'">'+esc(s)+'</button>').join('')+'<button type="button" class="starter-alt" data-import-cal>或导入课表</button></div>':'')+
  '<div class="paper"><div class="ribbon-wrap" style="--hour:'+H+'px;height:'+Math.ceil(map.height)+'px">'+
   '<ol class="hours" aria-hidden="true">'+hours.map(i=>'<li style="top:'+top(i*60)+'px">'+pad(i)+'</li>').join('')+'</ol>'+
   '<div class="ribbon" data-ribbon data-map="'+esc(JSON.stringify(map.segments.map(s=>[Math.round(s.y0),Math.round(s.y1),s.m0,s.m1,s.band?1:0])))+'" aria-label="'+esc(md(ui.date))+'时间带。点击空白处安排一件事。">'+hours.map(i=>'<span class="rule" style="top:'+top(i*60)+'px"></span>').join('')+bands+nowLine+blocks+lines+
   '</div>'+
  '</div><aside class="margin" id="margin" aria-label="页边批注">'+margin+'</aside></div>'+
  renderPocket(data,now)+ahead+renderFooter(ui.date,now)+'</section>';
}
const isEmptyArchive=d=>!d.tasks.length&&!d.courses.length&&!d.events.length&&!d.goals.length;
const minutesOf=stamp=>{const t=String(stamp).slice(11,16).split(':');return +t[0]*60+ +t[1]};
const toHM=m=>pad(Math.floor(m/60)%24)+':'+pad(Math.round(m%60));
function renderPocket(data,now){
 const today=dateKey(now);
 const pocket=data.tasks.filter(t=>!t.done&&!t.due);
 const overdue=data.tasks.filter(t=>!t.done&&t.due&&t.due.slice(0,10)<today);
 if(!pocket.length&&!overdue.length)return '<section class="pocket is-empty"><h2>口袋</h2><p>没有截止时间的小事会放在这里。写一行「买洗衣液」试试。</p></section>';
 const slip=(t,od)=>'<li class="slip'+(od?' is-overdue':'')+'"><button type="button" class="slip-check" data-toggle-task="'+esc(t.id)+'" aria-label="完成「'+esc(t.title)+'」"></button><button type="button" class="slip-title" data-edit="task" data-id="'+esc(t.id)+'">'+esc(t.title)+(od?'<small>'+esc(dueLabel(t,now))+'</small>':'')+'</button>'+(od?'':'<button type="button" class="slip-place" data-place="'+esc(t.id)+'">放进今天</button>')+'</li>';
 return '<section class="pocket"><h2>口袋 <small>'+pocket.length+' 件没有截止的小事'+(overdue.length?' · '+overdue.length+' 件逾期':'')+'</small></h2><ul>'+overdue.map(t=>slip(t,true)).join('')+pocket.map(t=>slip(t,false)).join('')+'</ul></section>';
}
function renderAhead(data,cands,now){
 const today=dateKey(now),until=dateKey(plusDays(now,7));
 const due=data.tasks.filter(t=>!t.done&&t.due&&t.due.slice(0,10)>today&&t.due.slice(0,10)<=until).sort((a,b)=>a.due.localeCompare(b.due));
 const later=cands.filter(c=>c.action?.start&&c.action.start.slice(0,10)>today);
 if(!due.length&&!later.length)return '';
 return '<section class="ahead"><h2>前方七天</h2>'+
  (due.length?'<ul class="ahead-due">'+due.map(t=>'<li><button type="button" data-goto-day="'+t.due.slice(0,10)+'"><span class="flag">'+esc(shortDay(t.due.slice(0,10)))+' '+t.due.slice(11,16)+'</span>'+esc(t.title)+'<small>'+esc(dueLabel(t,now))+(t.minutes?' · 约 '+t.minutes+' 分钟':'')+'</small></button></li>').join('')+'</ul>':'')+
  (later.length?'<div class="ahead-notes">'+later.map(c=>noteFor(c,{dated:true})).join('')+'</div>':'')+'</section>';
}
function renderFooter(date,now){
 const today=dateKey(now);
 if(date>today)return '<section class="footer-page is-future"><h2>页脚</h2><p>这一天还没到。到了那天再写。</p></section>';
 const entry=journalAll().find(e=>e.date===date),draft=drafts.get(draftKey(date));
 const mood=draft?.mood??entry?.mood??null,dirty=!!draft;
 return '<section class="footer-page" aria-labelledby="footer-title"><h2 id="footer-title">页脚 <small>'+(date===today?'今天':md(date))+'过得怎么样</small></h2>'+
  '<div class="moods" role="radiogroup" aria-label="心情">'+MOODS.map(([n,label,file])=>'<button type="button" role="radio" class="mood" data-mood="'+n+'" aria-checked="'+(mood===n)+'"><img src="../native-v4/assets/'+file+'" alt="" width="56" height="56" loading="lazy"><span>'+label+'</span></button>').join('')+'</div>'+
  '<label class="sr-only" for="journal-note">今天的一句话</label><textarea id="journal-note" maxlength="1800" rows="3" placeholder="写一句给自己的话。只存在这台设备上。">'+esc(draft?.note??entry?.note??'')+'</textarea>'+
  '<div class="footer-actions"><span class="journal-status" id="journal-status">'+(dirty?'未保存':entry?'已保存在这台设备':'')+'</span>'+(entry?'<button type="button" class="ghost-btn" data-journal-delete>删除这页</button>':'')+'<button type="button" class="ink-btn" data-journal-save>合上这一页</button></div>'+
  '<p class="privacy">私密：心情和日记不会自动发给任何模型；建议默认也不读取，除非你在封底授权本地结合心情分值。</p></section>';
}
function layoutMargin(){
 const margin=$('#margin');if(!margin)return;
 if(matchMedia('(max-width: 819px)').matches){margin.style.minHeight='';$$('.note-slot').forEach(s=>s.style.top='');return}
 let cursor=0;
 for(const slot of $$('.note-slot')){const want=Number(slot.dataset.y)||0;const y=Math.max(want,cursor);slot.style.top=y+'px';cursor=y+slot.offsetHeight+12}
 margin.style.minHeight=cursor+'px';
}
function renderWeek(data){
 const now=new Date(),cands=feed(),pencils=pencilStrokes(cands);
 const w=buildWeek(data,new Date(ui.weekStart+'T12:00'),{now,pencils});
 const isThis=ui.weekStart===dateKey(monday(now));
 return '<section class="week" aria-labelledby="week-title"><div class="day-nav"><button type="button" class="nav-arrow" data-week-shift="-1" aria-label="上一周">‹</button><h1 id="week-title">'+(isThis?'本周':md(w.start)+' 起')+'<small>'+md(w.start)+' – '+md(w.end)+(w.teachingWeek?' · 第 '+w.teachingWeek+' 教学周':'')+'</small></h1><button type="button" class="nav-arrow" data-week-shift="1" aria-label="下一周">›</button>'+(isThis?'':'<button type="button" class="nav-today" data-week-today>回到本周</button>')+'</div>'+
  '<p class="voice"><img src="'+assetFace(3)+'" alt="" width="30" height="30">'+esc(weekSentence(w))+'</p>'+
  '<ol class="week-grid">'+w.days.map(d=>'<li class="wday'+(d.isToday?' is-today':'')+(d.isPast?' is-past':'')+'"><button type="button" class="wday-head" data-goto-day="'+d.key+'"><span>'+d.label+'</span><b>'+d.dom+'</b>'+(d.pencils?'<i class="pencil-count" title="'+d.pencils+' 笔铅笔建议">✎'+d.pencils+'</i>':'')+'</button>'+
   '<span class="busy" style="--busy:'+Math.min(1,d.busyMinutes/600)+'" title="已记录 '+Math.round(d.busyMinutes/6)/10+' 小时"></span>'+
   '<ul>'+d.items.map(x=>'<li class="witem '+x.kind+(x.conflict?' is-conflict':'')+'"><button type="button" data-edit="'+x.kind+'" data-id="'+esc(x.id)+'"><time>'+x.start+'</time>'+esc(x.title)+'</button></li>').join('')+
   d.due.map(t=>'<li class="wdue'+(t.done?' is-done':'')+'"><button type="button" data-edit="task" data-id="'+esc(t.id)+'"><time>'+t.time+'</time>'+esc(t.title)+'</button></li>').join('')+
   (!d.items.length&&!d.due.length?'<li class="wempty">—</li>':'')+'</ul></li>').join('')+'</ol>'+
  '<div class="tools"><button type="button" class="ghost-btn" data-new="course">添加每周课程</button><button type="button" class="ghost-btn" data-new="event">添加活动</button><button type="button" class="ghost-btn" data-import-cal>导入课表 CSV / ICS</button><button type="button" class="ghost-btn" data-export-ics>导出日历 .ics</button></div>'+
  '<p class="legend"><span class="lg course">课程</span><span class="lg event">活动</span><span class="lg due">截止（时刻）</span><span class="lg pencil">✎ 铅笔建议</span><span class="lg conflict">重叠</span></p></section>';
}
function weekSentence(w){
 const busiest=[...w.days].sort((a,b)=>b.busyMinutes-a.busyMinutes)[0];
 const parts=[];
 parts.push(w.dueCount?'这周有 '+w.dueCount+' 项截止，已完成 '+w.dueDone+' 项':'这周没有带截止时间的事项');
 if(w.conflicts)parts.push('有 '+w.conflicts+' 处时间重叠');
 if(busiest.busyMinutes>0)parts.push('最满的是'+busiest.label+'（约 '+Math.round(busiest.busyMinutes/6)/10+' 小时）');
 return parts.join('，')+'。';
}
function renderLine(data){
 const now=new Date(),entries=journalAll();
 if(ui.plan&&ui.planRevision!==data.revision){ui.plan=null;ui.planRevision=null}
 const L=buildLongLine(data,entries,{now,plan:ui.plan});
 let analysis;try{analysis=analyzeJournal(entries,now)}catch{analysis=null}
 const c=L.current,p=L.previous;
 const sentence=L.hasEvidence||c.done||c.checkins?'这周完成 '+c.done+' 项、记录目标行动 '+c.checkins+' 次（'+c.minutes+' 分钟）；上周是 '+p.done+' 项、'+p.checkins+' 次。':'长线上还没有足迹。完成一件事、或为目标记录一次真实行动，这里就会出现第一个结。';
 const head='<div class="lgrid-row lgrid-head"><span class="lgrid-label"></span>'+L.weeks.map(w=>'<span class="lgrid-cell'+(w.isCurrent?' is-current':'')+(w.isFuture?' is-future':'')+'">'+(w.isCurrent?'本周':w.label)+'</span>').join('')+'</div>';
 const hasMood=L.moodRow.flat().some(x=>x.mood!=null);
 const moodRow=hasMood?'<div class="lgrid-row is-mood"><span class="lgrid-label">心情<small>仅本机</small></span>'+L.moodRow.map(week=>'<span class="lgrid-cell"><span class="mood-ticks">'+week.map(d=>'<i style="--m:'+(d.mood??0)+'" class="'+(d.mood==null?'none':'')+'" title="'+d.date+(d.mood?' 心情 '+d.mood:'')+'"></i>').join('')+'</span></span>').join('')+'</div>':'';
 const doneRow='<div class="lgrid-row is-done"><span class="lgrid-label">完成</span>'+L.doneRow.map((x,i)=>'<span class="lgrid-cell'+(L.weeks[i].isFuture?' is-future':'')+'">'+(x&&(x.done||x.checkins)?'<b>'+x.done+'</b><small>项</small>':L.weeks[i].isFuture?'':'<small class="dim">·</small>')+'</span>').join('')+'</div>';
 const goals=L.goals.filter(g=>!g.done);
 const goalRows=goals.map(g=>'<div class="lgrid-row is-goal"><button type="button" class="lgrid-label" data-goal="'+esc(g.id)+'">'+esc(g.title)+'<small>每周 '+g.target+' 次'+(g.plannedRoute?' · '+esc(g.plannedRoute):'')+'</small></button>'+g.cells.map(cell=>{
   const knots=cell.knots.map(k=>'<i class="knot" style="--s:'+Math.min(1,Math.max(.25,k.minutes/60))+'" title="'+esc(k.note||'行动')+' · '+k.minutes+' 分钟"></i>').join('');
   const remaining=cell.isCurrent?Math.max(0,cell.target-cell.knots.length):0;
   const hollow=cell.isCurrent?Array.from({length:remaining},()=>'<i class="knot is-hollow" title="本周还差"></i>').join(''):'';
   const intention=cell.isFuture&&cell.intention?Array.from({length:cell.intention},()=>'<i class="knot is-pencil" title="未来周意向，不是已创建的日程"></i>').join(''):'';
   return '<span class="lgrid-cell'+(cell.isCurrent?' is-current':'')+(cell.isFuture?' is-future':'')+'"><span class="thread"></span>'+knots+hollow+intention+'</span>';
  }).join('')+'</div>').join('');
 const planBlock=ui.plan?'<div class="plan-note"><p><b>'+(ui.plan.modelUsed?'模型从备选路线中挑选':'本地规则推演')+'</b> '+esc(ui.plan.notice)+'</p>'+ui.plan.goals.map(g=>'<div class="plan-goal"><span>'+esc(g.title)+' · '+esc(g.choices.find(x=>x.id===g.selectedRouteId)?.name||'')+'</span><small>'+esc(g.modelReason||g.reason)+'</small>'+(g.weeks[0]?.plannedActions>0?'<button type="button" class="ghost-btn" data-growth-preview="'+esc(g.id)+'">铅笔画出本周这一次</button>':'<small class="dim">本周已达成</small>')+'</div>').join('')+'</div>':'';
 const done=L.goals.filter(g=>g.done);
 return '<section class="line-scale" aria-labelledby="line-title"><div class="day-nav"><h1 id="line-title">长线<small>过去五周 · 本周 · 未来三周</small></h1></div>'+
  '<p class="voice"><img src="'+assetFace(L.hasEvidence?4:3)+'" alt="" width="30" height="30">'+esc(sentence)+(analysis&&entries.length?' '+esc(analysis.explanation):'')+'</p>'+
  '<div class="lgrid-scroll" tabindex="0" aria-label="长线：每周的目标行动和完成记录"><div class="lgrid" style="--cols:'+L.weeks.length+'">'+head+moodRow+doneRow+(goalRows||'<div class="lgrid-row"><span class="lgrid-label dim">还没有目标</span></div>')+'</div></div>'+
  '<p class="legend"><span class="lg lg-knot">真实行动（大小≈时长）</span><span class="lg lg-hollow">本周还差</span><span class="lg lg-pencil">铅笔意向（未建日程）</span></p>'+
  '<div class="tools"><button type="button" class="ink-btn" data-new="goal">新目标</button><button type="button" class="ghost-btn" data-routes>种一条长线（成长路线）</button>'+(goals.length?'<button type="button" class="ghost-btn" data-analyze>推演未来四周</button>':'')+'</div>'+planBlock+
  renderJournalList(entries)+renderStrokes(data)+
  (done.length?'<section class="sub"><h2>已完成的目标</h2><ul class="plain">'+done.map(g=>'<li><button type="button" data-goal="'+esc(g.id)+'">'+esc(g.title)+'<small>'+g.totalCount+' 次行动 · '+g.totalMinutes+' 分钟</small></button></li>').join('')+'</ul></section>':'')+'</section>';
}
function renderJournalList(entries){
 if(!entries.length)return '<section class="sub"><h2>日记</h2><p class="dim">还没有日记。每一天的页脚都可以写一句。</p></section>';
 return '<section class="sub"><h2>日记 <small>'+entries.length+' 页 · 仅本机</small></h2><ul class="journal-list">'+entries.slice(0,30).map(e=>'<li><button type="button" data-goto-day="'+e.date+'">'+(e.mood?'<img src="'+assetFace(e.mood)+'" alt="心情 '+e.mood+'" width="28" height="28">':'<span class="no-mood"></span>')+'<span><b>'+esc(md(e.date))+' '+DAYNAMES[weekday(new Date(e.date+'T12:00'))]+'</b><small>'+esc(e.note?e.note.slice(0,60):'只记了心情')+'</small></span></button></li>').join('')+'</ul></section>';
}
const KIND_LABEL={tasks:'事项',events:'活动',courses:'课程',goals:'目标',checkins:'行动记录'};
function describeTx(t){
 if(t.plan)return '小芽建议 · '+t.title;
 if(t.title&&t.title!=='手动更新记录')return t.title;
 const c=t.changes||[];if(!c.length)return '一次修改';
 const one=x=>{const name=x.after?.title||x.after?.name||x.before?.title||x.before?.name||x.after?.note||x.before?.note||'';const kind=KIND_LABEL[x.key]||'记录';
  if(!x.before)return '新增'+kind+(name?'「'+String(name).slice(0,24)+'」':'');
  if(!x.after)return '删除'+kind+(name?'「'+String(name).slice(0,24)+'」':'');
  if(x.before.done!==x.after.done)return (x.after.done?'完成':'恢复')+kind+'「'+String(name).slice(0,24)+'」';
  return '修改'+kind+'「'+String(name).slice(0,24)+'」'};
 return one(c[0])+(c.length>1?' 等 '+c.length+' 处':'');
}
function renderStrokes(data){
 const tx=data.transactions.filter(t=>t.status==='executed').slice(-8).reverse();
 if(!tx.length)return '';
 return '<section class="sub"><h2>笔迹 <small>最近落下的墨，可以擦掉</small></h2><ul class="strokes">'+tx.map(t=>'<li><span><b>'+esc(describeTx(t))+'</b><small>'+esc(new Date(t.at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}))+' · '+t.changes.length+' 处改动</small></span><button type="button" class="ghost-btn" data-erase="'+esc(t.id)+'">擦掉</button></li>').join('')+'</ul></section>';
}

// ---------- scale switching ----------
function setScale(next,{date=null}={}){
 if(!['day','week','line'].includes(next))return;
 const order=['line','week','day'];const dir=order.indexOf(next)>order.indexOf(ui.scale)?'in':'out';
 try{localStorage.setItem(UI_KEY,JSON.stringify({scale:next}))}catch{}
 if(next===ui.scale&&!date)return;
 ui.scale=next;if(date){ui.date=date;ui.weekStart=dateKey(monday(new Date(date+'T12:00')))}ui.open=null;
 render();window.scrollTo({top:0,behavior:'instant'});
 // A CSS entrance on the new page only: zooming "in" toward the day, "out" toward the long line.
 // (View Transitions were dropped: they crashed WebKit when entering the day page.)
 const page=$('#page');if(!reduced()){page.dataset.zoom=dir;page.classList.remove('is-entering');void page.offsetWidth;page.classList.add('is-entering')}
}

// ---------- write a line ----------
const lineInput=$('#line-input'),draftEl=$('#draft');
let parsed=null;
function syncLineMode(){
 const talking=talk.isOpen();
 lineInput.placeholder=talking?'问小芽：明天什么时候有空？':'写一行：明晚十点前交工数习题 45分钟';
 $('#line-send').textContent=talking||parsed?.intent==='question'?'问':'落笔';
 updateDraft();
}
function updateDraft(){
 const text=lineInput.value.trim();
 const forced=ui.forced||(talk.isOpen()?'question':null);
 if(!text){parsed=null;draftEl.hidden=true;draftEl.innerHTML='';$('#line-send').textContent=talk.isOpen()?'问':'落笔';return}
 parsed=parseLine(text,new Date(),{forceIntent:forced});
 const label={task:'事项',event:'活动',goal:'目标',question:'问小芽'}[parsed.intent]||'事项';
 const title=parsed.fields?.title||parsed.fields?.name||parsed.fields?.question||'';
 const facts=parsed.summary.slice(1).map(s=>'<span>'+esc(s)+'</span>').join('');
 draftEl.hidden=false;
 draftEl.innerHTML='<div class="draft-row"><button type="button" class="draft-kind" data-cycle-intent aria-label="当前理解为'+label+'，点按切换">'+label+' ▾</button>'+(parsed.intent==='question'?'<span class="draft-title">'+esc(title)+'</span>':'<span class="draft-title">'+esc(title)+'</span>'+facts)+'</div>'+
  (parsed.notes.length?'<p class="draft-notes">'+parsed.notes.map(esc).join('；')+'</p>':'')+
  '<p class="draft-hint">'+(parsed.intent==='question'?'回车：在页边问小芽':'回车落墨 · '+'<button type="button" class="link" data-refine>细调</button>')+'</p>';
 $('#line-send').textContent=parsed.intent==='question'?'问':'落笔';
 setXiaoya('listen',1400);
}
lineInput.addEventListener('input',updateDraft);
lineInput.addEventListener('keydown',e=>{if(e.key==='Escape'){lineInput.value='';ui.forced=null;updateDraft();lineInput.blur()}});
draftEl.addEventListener('click',e=>{
 if(e.target.closest('[data-cycle-intent]')){const cycle=['task','event','goal','question'];const cur=parsed?.intent||'task';ui.forced=cycle[(cycle.indexOf(cur)+1)%cycle.length];updateDraft();lineInput.focus();return}
 if(e.target.closest('[data-refine]')&&parsed)refineDraft();
});
$('#line-form').addEventListener('submit',e=>{
 e.preventDefault();const text=lineInput.value.trim();if(!text)return;
 if(!parsed)updateDraft();
 if(parsed.intent==='question'){talk.ask(parsed.fields.question);clearLine();return}
 if(e.submitter?.dataset.refine){refineDraft();return}
 if(commitDraft(parsed))clearLine();
});
function clearLine(){lineInput.value='';ui.forced=null;parsed=null;updateDraft()}
function commitDraft(p){
 const f=p.fields;
 if(p.intent==='task'){
  const t={id:uid(),title:f.title,due:f.due,minutes:f.minutes,type:f.type,course:'',done:false,remind:true,createdAt:new Date().toISOString(),completedAt:null};
  const ok=ink(d=>{d.tasks.push(t);d.history.unshift({id:uid(),at:new Date().toISOString(),action:'added',description:'写一行新增：'+t.title})},t.due?'记下了：'+t.title+'，'+t.due.slice(5).replace('T',' ')+' 截止':'放进口袋：'+t.title);
  if(ok&&t.due&&ui.scale==='day'&&t.due.slice(0,10)!==ui.date&&t.due.slice(0,10)<=dateKey(plusDays(new Date(),7))){/* stays visible in 前方 */}
  return ok;
 }
 if(p.intent==='event'){
  const ev={id:uid(),...f,createdAt:new Date().toISOString()};
  try{checkSchedule(ev)}catch(err){whisper(err.message,null,'error');return false}
  const ok=ink(d=>{d.events.push(ev);d.history.unshift({id:uid(),at:new Date().toISOString(),action:'added',description:'写一行新增活动：'+ev.name})},'记下了：'+md(ev.date)+' '+ev.start+' '+ev.name);
  if(ok&&ui.scale==='day'&&ev.date!==ui.date){ui.date=ev.date;render()}
  return ok;
 }
 if(p.intent==='goal'){
  const g={id:uid(),title:f.title,category:f.category,target:f.target,weeklyTarget:f.weeklyTarget,kind:f.kind,done:false,createdAt:new Date().toISOString(),completedAt:null};
  return ink(d=>{d.goals.push(g);d.history.unshift({id:uid(),at:new Date().toISOString(),action:'added',description:'新目标：'+g.title})},'长线上多了一根线：'+g.title,{celebrate:true});
 }
 return false;
}
function refineDraft(){
 const p=parsed;if(!p||p.intent==='question')return;
 const kind=p.intent==='event'?'event':p.intent;
 editSheet(kind,'',p.fields);clearLine();
}

// ---------- edit sheets ----------
const field=(label,name,value='',type='text',extra='')=>'<label class="field">'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const choose=(label,name,value,items)=>'<label class="field">'+esc(label)+'<select name="'+name+'">'+items.map(([v,l])=>'<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
function editSheet(kind,id='',preset={}){
 const key={task:'tasks',goal:'goals',course:'courses',event:'events'}[kind];if(!key)return;
 const obj=state()[key].find(x=>x.id===id)||preset||{};
 let html='';
 if(kind==='task'){
  html=field('要做什么','title',obj.title||'','text','required maxlength="160" autofocus')+
   field('截止时间（可选；截止不是开工时间）','due',obj.due||'','datetime-local')+
   '<div class="row2">'+choose('类别','type',obj.type||'task',[['task','事项'],['assignment','作业'],['exam','考试']])+field('预计用时（分钟）','minutes',obj.minutes||30,'number','min="1" max="1200"')+'</div>'+
   field('关联课程（可选）','course',obj.course||'')+choose('网页内提醒','remind',obj.remind===false?'false':'true',[['true','开启'],['false','关闭']]);
  if(id)html+='<div class="sheet-row"><button type="button" class="ghost-btn" data-sheet-toggle-task="'+esc(id)+'">'+(obj.done?'恢复为未完成':'标记完成')+'</button></div>';
 }else if(kind==='goal'){
  html=field('目标','title',obj.title||'','text','required maxlength="160" autofocus')+'<div class="row2">'+field('每周几次','weeklyTarget',obj.weeklyTarget||1,'number','min="1" max="7"')+choose('类型','kind',obj.kind||'goal',[['goal','长期目标'],['habit','日常习惯']])+'</div>'+
   field('具体行动或里程碑（可选）','target',obj.target||'')+field('类别','category',obj.category||'兴趣')+field('目标日期（可选）','targetDate',obj.targetDate||'','date');
 }else{
  const isCourse=kind==='course';
  const date=obj.date||(isCourse?'':preset.date||ui.date);
  html=field('名称','name',obj.name||'','text','required maxlength="160" autofocus')+
   '<div class="row2">'+field('开始','start',obj.start||'09:00','time','required')+field('结束','end',obj.end||'10:00','time','required')+'</div>'+
   field('地点（可选）','place',obj.place||'')+
   (isCourse?choose('星期','day',obj.day??weekday(new Date(ui.date+'T12:00')),DAYNAMES.map((n,i)=>[String(i),n]))+'<div class="row2">'+field('起始教学周','weekStart',obj.weekStart||1,'number','min="1" max="54"')+field('结束教学周','weekEnd',obj.weekEnd||18,'number','min="1" max="54"')+'</div>'+choose('周次','parity',obj.parity||'all',[['all','每周'],['odd','单周'],['even','双周']])+'<p class="hint">修改会作用于这门课的每一周。</p>':
    field('日期（留空则按星期每周重复）','date',date,'date')+choose('星期（每周重复时使用）','day',obj.day??weekday(new Date((date||ui.date)+'T12:00')),DAYNAMES.map((n,i)=>[String(i),n]))+choose('环境','outdoor',obj.outdoor===true?'true':'false',[['false','室内或未标记'],['true','户外（可结合已授权天气）']]));
 }
 if(id)html+='<div class="sheet-row"><button type="button" class="text-danger" data-delete="'+kind+'" data-id="'+esc(id)+'">删除这条记录</button></div>';
 openSheet((id?'修改':'新增')+{task:'事项',goal:'目标',course:'每周课程',event:'活动'}[kind],html,{ok:id?'保存':'落墨',onOk:form=>saveEdit(kind,id,form)});
}
function saveEdit(kind,id,form){
 const key={task:'tasks',goal:'goals',course:'courses',event:'events'}[kind];
 const f=Object.fromEntries(form);const prev=state()[key].find(x=>x.id===id);
 let next;
 if(kind==='task'){
  if(!f.title?.trim())return whisper('请写下要做什么',null,'error'),false;
  if(f.due&&!Number.isFinite(+new Date(f.due)))return whisper('截止时间无效',null,'error'),false;
  next={...prev,title:f.title.trim().slice(0,160),due:f.due||'',type:f.type,minutes:Math.max(1,Math.min(1200,Number(f.minutes)||30)),course:f.course||'',remind:f.remind!=='false'};
 }else if(kind==='goal'){
  if(!f.title?.trim())return whisper('请写下目标',null,'error'),false;
  next={...prev,title:f.title.trim().slice(0,160),weeklyTarget:Math.max(1,Math.min(7,Number(f.weeklyTarget)||1)),kind:f.kind,target:f.target||'',category:f.category||'兴趣',targetDate:f.targetDate||''};
 }else{
  next={...prev,name:(f.name||'').trim(),start:f.start,end:f.end,place:f.place||'',day:Number(f.day),exceptions:prev?.exceptions||[]};
  if(kind==='course'){next.weekStart=Number(f.weekStart);next.weekEnd=Number(f.weekEnd);next.parity=f.parity;delete next.date}
  else{next.date=f.date||'';if(next.date)next.day=weekday(new Date(next.date+'T12:00'));next.weekStart=prev?.weekStart||1;next.weekEnd=prev?.weekEnd||54;next.parity=prev?.parity||'all';next.outdoor=f.outdoor==='true';if(!next.date)delete next.date}
  try{checkSchedule(next)}catch(e){whisper(e.message,null,'error');return false}
 }
 next.id=id||uid();next.createdAt=prev?.createdAt||new Date().toISOString();
 if((kind==='task'||kind==='goal')&&!prev){next.done=false;next.completedAt=null}
 const label=next.title||next.name;
 return ink(d=>{if(id)d[key]=d[key].map(x=>x.id===id?next:x);else d[key].push(next);d.history.unshift({id:uid(),at:new Date().toISOString(),action:id?'edited':'added',description:(id?'修改：':'新增：')+label})},(id?'已改好：':'落墨：')+label);
}
function toggleTask(id){
 const t=state().tasks.find(x=>x.id===id);if(!t)return;
 ink(d=>{const x=d.tasks.find(v=>v.id===id);x.done=!x.done;x.completedAt=x.done?new Date().toISOString():null;d.history.unshift({id:uid(),at:new Date().toISOString(),action:'completed',description:(x.done?'完成：':'恢复：')+x.title})},t.done?'恢复为待办：'+t.title:'完成了：'+t.title,{celebrate:!t.done});
}
function toggleGoal(id){
 const g=state().goals.find(x=>x.id===id);if(!g)return;
 ink(d=>{const x=d.goals.find(v=>v.id===id);x.done=!x.done;x.completedAt=x.done?new Date().toISOString():null},g.done?'目标重新开始：'+g.title:'这根长线完成了：'+g.title,{celebrate:!g.done});
}
function deleteRecord(kind,id){
 const key={task:'tasks',goal:'goals',course:'courses',event:'events'}[kind];const x=state()[key]?.find(v=>v.id===id);if(!x)return;
 if(!confirm('删除「'+(x.title||x.name)+'」？之后可以在「笔迹」或提示里擦掉这次删除。'))return;
 closeSheet();
 ink(d=>{d[key]=d[key].filter(v=>v.id!==id);if(kind==='goal')d.checkins=d.checkins.filter(c=>c.goalId!==id);d.history.unshift({id:uid(),at:new Date().toISOString(),action:'deleted',description:'删除：'+(x.title||x.name)})},'已删除：'+(x.title||x.name));
}

// ---------- slot placement (user-initiated, still confirmed) ----------
function slotSheet(minute){
 const start=pad(Math.floor(minute/60))+':'+pad(minute%60);
 const pocket=state().tasks.filter(t=>!t.done&&!t.due);
 openSheet('在 '+md(ui.date)+' '+start+' 放点什么',
  field('名称','name','','text','maxlength="160" autofocus placeholder="例如：去图书馆复习"')+
  '<div class="row2">'+field('开始','start',start,'time','required')+choose('时长','len','60',[['30','30 分钟'],['45','45 分钟'],['60','1 小时'],['90','1.5 小时'],['120','2 小时']])+'</div>'+
  (pocket.length?'<fieldset class="pick"><legend>或者，从口袋里拿一件</legend>'+pocket.map(t=>'<label class="check"><input type="radio" name="task" value="'+esc(t.id)+'"> '+esc(t.title)+' <small>约 '+(t.minutes||30)+' 分钟</small></label>').join('')+'</fieldset>':''),
  {ok:'落墨',onOk:form=>placeEvent(form)});
}
function placeEvent(form){
 const f=Object.fromEntries(form);const task=f.task?state().tasks.find(t=>t.id===f.task):null;
 const name=(task?.title||f.name||'').trim();if(!name)return whisper('写个名称，或从口袋里选一件',null,'error'),false;
 const len=task?Math.max(15,Math.min(240,Number(task.minutes)||30)):Number(f.len)||60;
 const [h,m]=f.start.split(':').map(Number);const total=h*60+m+len;if(total>=1440)return whisper('这段时间超过了午夜，请提前开始',null,'error'),false;
 const ev={id:uid(),name:name.slice(0,160),date:ui.date,day:weekday(new Date(ui.date+'T12:00')),start:f.start,end:pad(Math.floor(total/60))+':'+pad(total%60),place:'',weekStart:1,weekEnd:54,parity:'all',exceptions:[],taskId:task?.id||'',createdAt:new Date().toISOString()};
 try{checkSchedule(ev)}catch(e){whisper(e.message,null,'error');return false}
 const clash=occurrences(state(),new Date(ui.date+'T'+ev.start),new Date(ui.date+'T'+ev.end));
 if(clash.length&&!confirm('这段时间已有「'+clash[0].name+'」。仍然放进去吗？'))return false;
 return ink(d=>{d.events.push(ev);d.history.unshift({id:uid(),at:new Date().toISOString(),action:'added',description:'安排：'+ev.name})},'落墨：'+ev.start+' '+ev.name);
}
function placeToday(taskId){
 const t=state().tasks.find(x=>x.id===taskId);if(!t)return;
 const now=new Date(),today=dateKey(now),minutes=Math.max(15,Math.min(240,Number(t.minutes)||30));
 const from=new Date(Math.max(+now+5*60000,+new Date(today+'T08:00'))),until=new Date(today+'T22:00');
 const slot=from<until?freeSlots(state(),from,until,minutes)[0]:null;
 if(ui.scale!=='day'||ui.date!==today){ui.scale='day';ui.date=today;render()}
 if(!slot){whisper('今天 22:00 前没有 '+minutes+' 分钟的空档。可以点时间带上的任意位置手动放。');return}
 const start=slot.start.slice(11,16);const mm=+start.slice(0,2)*60+ +start.slice(3);
 slotSheet(Math.ceil(mm/5)*5);
 requestAnimationFrame(()=>{const r=document.querySelector('#sheet-body input[name=task][value="'+CSS.escape(taskId)+'"]');if(r)r.checked=true});
}

// ---------- goals, check-ins, growth ----------
function goalSheet(id){
 const d=state(),g=d.goals.find(x=>x.id===id);if(!g)return;
 const checkins=d.checkins.filter(c=>c.goalId===id).sort((a,b)=>b.at.localeCompare(a.at));
 const stages=d.tasks.filter(t=>t.goalId===id&&t.stageId);
 openSheet(g.title,
  '<p class="sheet-lede">每周 '+(g.weeklyTarget||1)+' 次'+(g.target?' · '+esc(g.target):'')+(g.growthPlan?' · 路线：'+esc(g.growthPlan.routeName):'')+'</p>'+
  (stages.length?'<h3>阶段</h3><ol class="stages">'+stages.map(t=>'<li class="'+(t.done?'is-done':'')+'"><button type="button" class="due-check" data-toggle-task="'+esc(t.id)+'" aria-pressed="'+!!t.done+'" aria-label="'+(t.done?'恢复':'完成')+'阶段"></button><span><b>'+esc(t.title)+'</b><small>'+esc(t.stageAction||'')+' · '+esc((t.due||'').slice(0,10))+'</small></span></li>').join('')+'</ol>':'')+
  '<h3>记录一次真实行动</h3><p class="hint">只记录真的发生过的事，不会自动打卡。</p>'+
  '<div class="row2">'+field('时间','at',localStamp(new Date()),'datetime-local')+field('分钟','minutes',20,'number','min="0" max="1440"')+'</div>'+
  '<label class="field">做了什么<textarea name="note" maxlength="500" rows="2" placeholder="例如：练了 20 分钟基础节奏"></textarea></label>'+
  (checkins.length?'<h3>足迹 <small>'+checkins.length+' 次 · '+checkins.reduce((n,c)=>n+c.minutes,0)+' 分钟</small></h3><ul class="plain small">'+checkins.slice(0,12).map(c=>'<li><b>'+esc(new Date(c.at).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}))+'</b> '+esc(c.note||'行动')+' · '+c.minutes+' 分钟</li>').join('')+'</ul>':'')+
  '<div class="sheet-row"><button type="button" class="ghost-btn" data-edit="goal" data-id="'+esc(id)+'">编辑目标</button><button type="button" class="ghost-btn" data-toggle-goal="'+esc(id)+'">'+(g.done?'重新开始':'标记完成')+'</button></div>',
  {ok:'记下这次行动',onOk:form=>saveCheckin(id,form)});
}
function saveCheckin(goalId,form){
 const at=new Date(form.get('at')),minutes=Number(form.get('minutes')),note=String(form.get('note')||'').trim();
 if(!Number.isFinite(+at)||at>new Date())return whisper('时间需要有效，且不能在未来',null,'error'),false;
 if(!Number.isInteger(minutes)||minutes<0||minutes>1440)return whisper('分钟需在 0–1440 之间',null,'error'),false;
 if(!note)return whisper('写一句做了什么',null,'error'),false;
 return ink(d=>{d.checkins.push({id:uid(),goalId,at:at.toISOString(),minutes,note:note.slice(0,500)});d.history.unshift({id:uid(),at:new Date().toISOString(),action:'checkin',description:'记录行动：'+note.slice(0,90)})},'长线上多了一个结',{celebrate:true});
}
async function analyzeGrowth(useModel){
 const creds=useModel?talk.growthCredentials():null;let provider=null;
 try{
  if(creds)provider=createGrowthChatProvider(creds);
  const controller=createAdaptiveGrowthController({getData:state,persist,clock,provider,authorized:!!provider});
  whisper(provider?'正在请模型从备选路线中挑选…':'正在按本地规则推演…');
  const plan=await controller.analyze({weeks:4,timeoutMs:provider?20000:3000});
  ui.plan=plan;ui.planRevision=state().revision;render();
  whisper(plan.modelUsed?'模型已挑选路线；执行仍需逐项落墨':plan.mode==='rule-fallback'?plan.notice:'已推演未来四周（铅笔意向）');
 }catch(e){whisper(e.message,null,'error')}
 finally{provider?.clear()}
}
function analyzeChoice(){
 if(!talk.model())return analyzeGrowth(false);
 openSheet('推演未来四周','<p class="sheet-lede">你已连接 '+esc(talk.model().providerName)+'。可以只用本地规则，也可以让模型在三条备选路线（轻量恢复 / 稳定推进 / 集中突破）里为每个目标挑一条。</p><ul class="facts"><li>若选择模型：只发送目标名称、每周目标次数、上周和本周行动次数、未来七天的负担分钟数。</li><li>不发送日记、心情、课程名称或任务名称。</li><li>模型不能创造新动作；结果无效时自动退回本地规则。</li></ul><div class="sheet-row"><button type="button" class="ghost-btn" data-analyze-local>只用本地规则</button></div>',{ok:'允许模型挑选',onOk:()=>{analyzeGrowth(true)}});
}
function growthPreview(goalId){
 try{
  const controller=createAdaptiveGrowthController({getData:state,persist,clock});
  const pv=controller.preview(ui.plan,goalId);
  const a=pv.action;
  openSheet('铅笔：本周这一次',
   '<div class="pencil-card"><span class="note-kicker">小芽画了一笔 · '+esc(shortDay(a.start.slice(0,10)))+' '+timeLabel(a.start)+'–'+timeLabel(a.end)+'</span><strong>'+esc(a.title)+'</strong><p><b>依据</b>'+esc(pv.reason)+'</p><p><b>落墨后</b>'+esc(impact(a))+'</p><p class="hint">只安排本周一次，不预写未来几周。十分钟内有效。</p></div>',
   {ok:'落墨',onOk:()=>{try{const r=controller.approve(pv);markFresh(r.transaction);ui.plan=null;render();whisper('已落墨。',{label:'擦掉',run:()=>erase(r.transaction.id)});setXiaoya('happy')}catch(e){whisper(e.message,null,'error')}}});
 }catch(e){whisper(e.message,null,'error')}
}
let routeForm={goal:'',baseline:'',hours:4,weeks:8};
function routesSheet(){
 const plan=ui.routes;
 openSheet('种一条长线',
  '<p class="sheet-lede">告诉小芽一个想长期做成的事，生成两条可执行的路线。规则模板只做规划示例，不评估能力、不预测成功。</p>'+
  field('想做成什么','goal',routeForm.goal,'text','maxlength="100" placeholder="例如：从零学 Python" autofocus')+field('现在的基础','baseline',routeForm.baseline,'text','maxlength="180" placeholder="例如：零基础 / 学过一点"')+
  '<div class="row2">'+field('每周投入（小时）','hours',routeForm.hours,'number','min="1" max="40"')+field('周期（周）','weeks',routeForm.weeks,'number','min="4" max="52"')+'</div>'+
  '<div class="sheet-row"><button type="button" class="ghost-btn" data-routes-generate>铅笔画出两条路线</button></div>'+
  (plan?'<p class="hint">'+esc(plan.explain)+'</p><div class="routes">'+plan.routes.map(r=>'<article class="route"><header><strong>'+esc(r.name)+'</strong><small>'+esc(plan.domainName)+'</small></header><p>'+esc(r.reason)+'</p><ol>'+r.stages.map(s=>'<li><b>第 '+s.startWeek+'–'+s.endWeek+' 周 · '+esc(s.title)+'</b><span>'+esc(s.action)+'</span><small>成果：'+esc(s.deliverable)+'</small></li>').join('')+'</ol><p class="risk">留意：'+esc(r.risk)+'</p><button type="button" class="ink-btn" data-route-ink="'+esc(r.id)+'">落墨这条</button></article>').join('')+'</div>':''),
  {hideOk:true,wide:true});
}
function generateRoutes(){
 const form=new FormData($('#sheet-form'));routeForm={goal:String(form.get('goal')||'').trim(),baseline:String(form.get('baseline')||'').trim(),hours:form.get('hours'),weeks:Number(form.get('weeks'))};
 try{const d=state();ui.routes=buildGrowthRoutes({...routeForm,pendingCount:d.tasks.filter(t=>!t.done).length,workload:summarizeGrowthWorkload(d,new Date())});ui.routes._basis=d.revision;routesSheet()}catch(e){whisper(e.message,null,'error')}
}
function inkRoute(routeId){
 const plan=ui.routes;if(!plan||plan._basis!==state().revision){whisper('档案变化了，请重新生成路线',null,'error');return}
 const tasks=growthStageTasks(plan,routeId,new Date());
 if(!confirm('落墨「'+plan.routes.find(r=>r.id===routeId).name+'」：新增 1 个目标和 '+tasks.length+' 个阶段事项（'+tasks.map(t=>t.due.slice(5,10)).join('、')+' 截止）。'))return;
 try{const r=commitGrowthRoute(state(),plan,routeId,new Date(),()=>uid());store.replace(r.next);ui.routes=null;closeSheet();setScale('line');render();whisper('种下了：'+plan.goal+' · '+r.route.name);setXiaoya('happy')}
 catch(e){whisper(e.message,null,'error')}
}

// ---------- engine pencils: preview → approve / reject / snooze ----------
function expand(id){
 if(ui.open===id){ui.open=null;render();return}
 ui.open=id;
 try{ui.previews.set(id,student.preview(id))}catch(e){ui.previews.set(id,{error:e.message})}
 render();
 requestAnimationFrame(()=>{const n=document.querySelector('[data-note="'+CSS.escape(id)+'"]');if(n){const r=n.getBoundingClientRect();if(r.bottom>innerHeight-110||r.top<70)n.scrollIntoView({block:'center',behavior:reduced()?'instant':'smooth'});n.querySelector('[data-approve],.ghost-btn')?.focus({preventScroll:true})}});
}
function expandContext(id){
 if(ui.open===id){ui.open=null;render();return}
 ui.open=id;
 const s=contextNotes().find(x=>x.id===id);
 if(s?.kind==='outdoor-weather'){try{ui.previews.set(id,contextActions.preview(id))}catch(e){ui.previews.set(id,{error:e.message})}}
 render();
}
function approve(id,context=false){
 const pv=ui.previews.get(id);if(!pv||pv.error)return;
 try{
  const r=context?contextActions.approve(pv):student.approve(pv);
  ui.previews.delete(id);ui.open=null;markFresh(r.transaction);render();
  whisper('已落墨。',{label:'擦掉',run:()=>erase(r.transaction.id)});setXiaoya('happy',2200);
 }catch(e){ui.previews.delete(id);ui.open=null;render();whisper('没有落墨：'+e.message,null,'error')}
}
function respond(id,decision){
 try{student.respond(id,decision,{hours:24});ui.open=null;ui.previews.delete(id);render();whisper(decision==='snooze'?'好，明天这个时候再提':'记下了，这条不再提')}
 catch(e){whisper(e.message,null,'error')}
}

// ---------- journal ----------
function saveJournal(){
 const date=ui.date,entry=journalAll().find(e=>e.date===date),draft=drafts.get(draftKey(date));
 const note=$('#journal-note')?.value??'';const mood=draft?.mood??entry?.mood??null;
 try{journal.save({date,mood,note,tags:entry?.tags||[]});drafts.delete(draftKey(date));render();whisper('合上了这一页（只存在这台设备）');setXiaoya(mood&&mood<=2?'care':'nod')}
 catch(e){whisper(e.message,null,'error')}
}
function deleteJournal(){
 if(!confirm('删除 '+md(ui.date)+' 的心情和日记？这不能撤销。'))return;
 try{journal.remove(ui.date);drafts.delete(draftKey(ui.date));render();whisper('已删除这一页')}catch(e){whisper(e.message,null,'error')}
}

// ---------- cover (archive, consent, settings) ----------
function coverSheet(){
 const d=state(),s=d.settings,mode=store.mode(),model=talk.model();
 openSheet('封底',
  '<p class="sheet-lede">小芽 · 铅笔与墨水是一个<b>独立实验版</b>，与正式版共用同一份浏览器档案格式，不改动数据结构。</p>'+
  '<section class="cover-sec"><h3>档案</h3><p class="hint">当前：'+(mode==='demo'?'合成演示档案（不含真实个人信息）':'私人档案')+'。两者完全隔离。</p><div class="sheet-row wrap">'+
   '<button type="button" class="ghost-btn" data-cover="mode">切换到'+(mode==='demo'?'私人档案':'演示档案')+'</button><button type="button" class="ghost-btn" data-cover="export">导出备份 JSON（含日记）</button><button type="button" class="ghost-btn" data-cover="import">从备份恢复</button><button type="button" class="text-danger" data-cover="clear">清空当前档案</button></div></section>'+
  '<section class="cover-sec"><h3>课表</h3><div class="sheet-row wrap"><button type="button" class="ghost-btn" data-import-cal>导入 CSV / ICS</button><button type="button" class="ghost-btn" data-export-ics>导出日历 .ics</button></div><p class="hint">CSV 表头需包含 name,day,start,end（day=1–7）。导入前会先给你看预览。</p></section>'+
  '<section class="cover-sec"><h3>学期</h3><div class="row3">'+field('名称','semName',d.semester.name||'我的学期')+field('开始','semStart',d.semester.start||'','date')+field('结束','semEnd',d.semester.end||'','date')+'</div><p class="hint">设好开始和结束日期，教学周和单双周才会生效。</p></section>'+
  '<section class="cover-sec"><h3>提醒</h3><label class="check"><input type="checkbox" name="reminderEnabled"'+(s.reminderEnabled?' checked':'')+'> 在页面打开时，由小芽轻声提醒临近的截止和日程</label><div class="row3">'+field('免打扰开始','quietStart',s.quietStart,'time')+field('免打扰结束','quietEnd',s.quietEnd,'time')+field('最短间隔（分钟）','reminderGap',s.reminderGap,'number','min="1" max="1440"')+'</div>'+
   '<label class="check"><input type="checkbox" name="quiet"'+(s.quiet?' checked':'')+'> 安静模式（暂停所有提醒，小芽打个盹）</label><label class="check"><input type="checkbox" name="reducedMotion"'+(s.reducedMotion?' checked':'')+'> 减少动效</label></section>'+
  '<section class="cover-sec"><h3>情境授权 <small>仅本次打开有效</small></h3><p class="hint">城市由你手动选择，不读取定位。天气只在你点「获取预报」时请求 Open-Meteo（CC BY 4.0，非商业用途）。</p>'+
   choose('城市','city',consent.city?.id||'',[['','不使用天气'],...CITIES.map(c=>[c.id,c.name])])+
   '<label class="check"><input type="checkbox" name="weather"'+(consent.weather?' checked':'')+'> 允许本次获取所选城市的短期天气</label>'+
   '<label class="check"><input type="checkbox" name="mood"'+(consent.mood?' checked':'')+'> 允许小芽在本地结合今天保存的心情分值（不读日记正文）</label>'+
   '<div class="sheet-row wrap"><button type="button" class="ghost-btn" data-cover="weather">获取预报</button><button type="button" class="text-danger" data-cover="revoke">全部撤销</button></div>'+
   '<p class="hint">'+(consent.forecast&&consent.weather?'已获取：'+esc(consent.forecast.cityLabel)+' · '+esc(new Date(consent.forecast.fetchedAt).toLocaleString('zh-CN')):'尚未获取天气；未授权时不发任何网络请求。')+'</p></section>'+
  '<section class="cover-sec"><h3>模型</h3><p class="hint">'+(model?'已连接 '+esc(model.providerName)+' · '+esc(model.model)+'（密钥仅在内存）':'未连接。小芽的所有基础功能都不需要模型。')+'</p><div class="sheet-row"><button type="button" class="ghost-btn" data-open="model">'+(model?'模型设置':'连接你自己的模型')+'</button></div></section>'+
  '<section class="cover-sec"><h3>关于</h3><p class="hint">实验分支 experiment/xiaoya-opus-original-20261105。正式版不受影响：<a href="../native-v4/">打开正式版 V5.9</a>。</p></section>',
  {ok:'保存设置',onOk:saveCover,wide:true});
}
function saveCover(form){
 const d=state();
 const sem={...d.semester,name:String(form.get('semName')||'我的学期').slice(0,40),start:String(form.get('semStart')||''),end:String(form.get('semEnd')||'')};
 if(sem.start||sem.end){if(!(sem.start&&sem.end))return whisper('学期开始和结束需要一起填写',null,'error'),false;try{checkSemester(sem)}catch(e){whisper(e.message,null,'error');return false}}
 const gap=Number(form.get('reminderGap'));if(!Number.isFinite(gap)||gap<1||gap>1440)return whisper('提醒间隔需在 1–1440 分钟',null,'error'),false;
 applyConsentFromForm(form);
 try{store.commit(x=>{x.semester=sem;Object.assign(x.settings,{reminderEnabled:!!form.get('reminderEnabled'),quiet:!!form.get('quiet'),reducedMotion:!!form.get('reducedMotion'),quietStart:String(form.get('quietStart')||'22:00'),quietEnd:String(form.get('quietEnd')||'08:00'),reminderGap:gap})},{track:false});render();whisper('设置已保存');return true}
 catch(e){whisper(e.message,null,'error');return false}
}
function applyConsentFromForm(form){
 const city=CITIES.find(c=>c.id===form.get('city'))||null,allow=!!form.get('weather');
 if(!allow||!city){consent.weather=false;consent.city=null;consent.forecast=null}
 else{if(consent.city?.id!==city.id)consent.forecast=null;consent.city=city;consent.weather=true}
 consent.mood=!!form.get('mood');
}
async function coverAction(name){
 if(name==='mode'){
  const next=store.mode()==='demo'?'personal':'demo';
  resetSession();store.setMode(next);ui.date=dateKey(new Date());ui.weekStart=dateKey(monday(new Date()));closeSheet();render();whisper(next==='demo'?'已切换到合成演示档案':'已回到私人档案');return;
 }
 if(name==='export'){download(JSON.stringify({...state(),journalV1:journalAll(),exportedAt:new Date().toISOString(),archiveMode:store.mode()},null,2),'application/json','xiaoya-'+store.mode()+'-'+dateKey(new Date())+'.json');whisper('已导出当前档案（含日记）');return}
 if(name==='import'){$('#import-json').click();return}
 if(name==='clear'){
  if(!confirm('清空当前'+(store.mode()==='demo'?'演示':'私人')+'档案和日记？建议先导出备份。'))return;
  if(!confirm('再次确认：清空后不能撤销。'))return;
  store.replace(emptyStore());journal.clear();for(const k of [...drafts.keys()])if(k.startsWith(store.mode()+':'))drafts.delete(k);closeSheet();render();whisper('已清空');return;
 }
 if(name==='weather'){
  applyConsentFromForm(new FormData($('#sheet-form')));
  if(!consent.weather||!consent.city){whisper('请先选择城市并勾选天气授权',null,'error');return}
  const city=consent.city,mode=store.mode();whisper('正在获取 '+city.name+' 的预报…');
  try{const f=await fetchCityForecast({city,authorized:true});if(store.mode()!==mode||consent.city?.id!==city.id)return;consent.forecast=f;coverSheet();render();whisper('天气已更新 · Open-Meteo')}
  catch(e){consent.forecast=null;whisper(e.message,null,'error')}
  return;
 }
 if(name==='revoke'){resetSession(false);coverSheet();render();whisper('情境授权已全部撤销')}
}
function resetSession(includeTalk=true){
 consent.weather=false;consent.mood=false;consent.city=null;consent.forecast=null;
 ui.plan=null;ui.routes=null;ui.previews.clear();ui.open=null;
 if(includeTalk)talk.reset();
}
function download(text,mime,name){const a=document.createElement('a'),href=URL.createObjectURL(new Blob([text],{type:mime}));a.href=href;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000)}
$('#import-json').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  const incoming=JSON.parse(await file.text()),next=validateStore(incoming),entries=incoming.journalV1===undefined?null:validateJournalArchive(incoming.journalV1);
  if(!confirm('用「'+file.name+'」覆盖当前'+(store.mode()==='demo'?'演示':'私人')+'档案？包含 '+next.tasks.length+' 个事项、'+next.courses.length+' 门课'+(entries?'、'+entries.length+' 页日记':'')+'。'))return;
  store.replace(next);if(entries)journal.replace(entries);closeSheet();render();whisper('已从备份恢复'+(entries?'（含日记）':'（文件不含日记）'));
 }catch(err){whisper('恢复失败：'+err.message,null,'error')}
});
$('#import-cal').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  const preview=parseSchedule(await file.text(),file.name,state());
  openSheet('导入课表 · 预览',
   '<p class="sheet-lede">来自 '+esc(file.name)+'：新增 '+preview.items.length+' 条'+(preview.duplicates.length?'，跳过重复 '+preview.duplicates.length+' 条':'')+(preview.conflicts.length?'，导入后将有 '+preview.conflicts.length+' 处重叠':'')+'。</p>'+
   '<ul class="plain small">'+preview.items.slice(0,40).map(x=>'<li><b>'+esc(x.name)+'</b> '+(x.date?esc(x.date):DAYNAMES[x.day])+' '+x.start+'–'+x.end+(x.place?' · '+esc(x.place):'')+'</li>').join('')+(preview.items.length>40?'<li>……</li>':'')+'</ul>',
   {ok:preview.items.length?'落墨导入':'关闭',onOk:()=>{if(!preview.items.length)return true;try{const r=applyImport(state(),preview);store.replace(r.next);render();whisper('已导入 '+preview.items.length+' 条',{label:'擦掉',run:()=>erase(r.transaction.id)});return true}catch(err){whisper(err.message,null,'error');return false}}});
 }catch(err){whisper('导入失败：'+err.message,null,'error')}
});

// ---------- events ----------
document.addEventListener('click',e=>{
 const t=e.target.closest('button,[data-ribbon]');if(!t)return;
 const ds=t.dataset;
 if(ds.scale)return setScale(ds.scale);
 if(ds.open==='cover')return coverSheet();
 if(ds.open==='model'){closeSheet();setTimeout(()=>talk.connectSheet(),reduced()?0:190);return}
 if(ds.close==='talk')return talk.close();
 if(ds.close==='sheet')return closeSheet();
 if(t.id==='xiaoya')return talk.toggle(t);
 if(ds.expand)return expand(ds.expand);
 if(ds.expandContext)return expandContext(ds.expandContext);
 if(ds.approve)return approve(ds.approve);
 if(ds.approveContext)return approve(ds.approveContext,true);
 if(ds.snooze)return respond(ds.snooze,'snooze');
 if(ds.reject)return respond(ds.reject,'reject');
 if(ds.edit){closeSheet();return setTimeout(()=>editSheet(ds.edit,ds.id),$('#sheet').open&&!reduced()?190:0)}
 if(ds.new)return editSheet(ds.new,'',ds.new==='event'?{date:ui.date}:{});
 if(ds.toggleTask){toggleTask(ds.toggleTask);if($('#sheet').open&&t.closest('.stages'))goalSheet(state().tasks.find(x=>x.id===ds.toggleTask)?.goalId);return}
 if(ds.sheetToggleTask){closeSheet();return toggleTask(ds.sheetToggleTask)}
 if(ds.toggleGoal){closeSheet();return toggleGoal(ds.toggleGoal)}
 if(ds.delete)return deleteRecord(ds.delete,ds.id);
 if(ds.place)return placeToday(ds.place);
 if(ds.gotoDay)return setScale('day',{date:ds.gotoDay});
 if(ds.dayShift){ui.date=dateKey(plusDays(new Date(ui.date+'T12:00'),Number(ds.dayShift)));ui.open=null;return render()}
 if(ds.dayToday!==undefined){ui.date=dateKey(new Date());return render()}
 if(ds.weekShift){ui.weekStart=dateKey(plusDays(new Date(ui.weekStart+'T12:00'),7*Number(ds.weekShift)));return render()}
 if(ds.weekToday!==undefined){ui.weekStart=dateKey(monday(new Date()));return render()}
 if(ds.mood){const date=ui.date,cur=drafts.get(draftKey(date))||{};drafts.set(draftKey(date),{...cur,mood:Number(ds.mood),note:$('#journal-note')?.value??cur.note});$$('.mood').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.mood===ds.mood)));$('#journal-status').textContent='未保存';return}
 if(ds.journalSave!==undefined)return saveJournal();
 if(ds.journalDelete!==undefined)return deleteJournal();
 if(ds.goal)return goalSheet(ds.goal);
 if(ds.routes!==undefined)return routesSheet();
 if(ds.routesGenerate!==undefined)return generateRoutes();
 if(ds.routeInk)return inkRoute(ds.routeInk);
 if(ds.analyze!==undefined)return analyzeChoice();
 if(ds.analyzeLocal!==undefined){closeSheet();return analyzeGrowth(false)}
 if(ds.growthPreview)return growthPreview(ds.growthPreview);
 if(ds.erase)return erase(ds.erase);
 if(ds.try){lineInput.value=ds.try;updateDraft();lineInput.focus({preventScroll:true});return}
 if(ds.cover)return coverAction(ds.cover);
 if(ds.importCal!==undefined)return $('#import-cal').click();
 if(ds.exportIcs!==undefined){download(exportCalendar(state()),'text/calendar','xiaoya-calendar.ics');return whisper('已导出 120 天内的日程与截止')}
});
// Tap on empty ribbon space → place something at that time.
document.addEventListener('click',e=>{
 const band=e.target.closest('.free-band');
 if(band){slotSheet(Math.min(23*60+30,Number(band.dataset.minute)));return}
 const ribbon=e.target.closest('[data-ribbon]');if(!ribbon||e.target.closest('button'))return;
 const y=e.clientY-ribbon.getBoundingClientRect().top;
 let segs=[];try{segs=JSON.parse(ribbon.dataset.map||'[]')}catch{}
 const s=segs.find(([y0,y1])=>y>=y0&&y<=y1)||segs[segs.length-1];if(!s)return;
 const raw=s[4]?s[2]:s[2]+(y-s[0])/Math.max(1,s[1]-s[0])*(s[3]-s[2]);
 slotSheet(Math.max(0,Math.min(23*60+30,Math.round(raw/30)*30)));
});
document.addEventListener('input',e=>{
 if(e.target.id==='journal-note'){const cur=drafts.get(draftKey(ui.date))||{};drafts.set(draftKey(ui.date),{...cur,note:e.target.value});const s=$('#journal-status');if(s)s.textContent='未保存'}
});
document.addEventListener('keydown',e=>{
 const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
 if(e.key==='Escape'&&!$('#sheet').open&&talk.isOpen()){talk.close();return}
 if(typing||$('#sheet').open||e.metaKey||e.ctrlKey||e.altKey)return;
 if(e.key==='/'){e.preventDefault();lineInput.focus();return}
 if(['1','2','3'].includes(e.key)){setScale(['day','week','line'][Number(e.key)-1]);return}
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
  if(e.target.closest?.('#scale')){const order=['day','week','line'];const i=order.indexOf(ui.scale)+(e.key==='ArrowRight'?1:-1);if(order[i]){setScale(order[i]);requestAnimationFrame(()=>$('#scale [aria-selected=true]')?.focus())}return}
  const n=e.key==='ArrowRight'?1:-1;
  if(ui.scale==='day'){ui.date=dateKey(plusDays(new Date(ui.date+'T12:00'),n));render()}
  else if(ui.scale==='week'){ui.weekStart=dateKey(plusDays(new Date(ui.weekStart+'T12:00'),7*n));render()}
 }
});
window.addEventListener('resize',()=>{if(ui.scale==='day')layoutMargin()});
window.addEventListener('storage',e=>{if(e.key===store.key()){try{store.refresh();render();whisper('读取了另一个标签页的更新')}catch(err){whisper(err.message,null,'error')}}});

// ---------- gentle in-page reminders (existing domain rules: quiet hours, gap, lead times) ----------
function remind(){
 try{
  const d=state();if(!d.settings.reminderEnabled)return [];
  const {next,delivered}=deliverReminders(d,new Date());if(!delivered.length)return [];
  store.commit(x=>{x.reminders=next.reminders},{track:false});
  const r=delivered[0];whisper('小芽轻声提醒：「'+r.title+'」'+r.label);setXiaoya('nod',2600);
  return delivered;
 }catch{return []/* reminders never block the page */}
}

// ---------- boot ----------
window.__XY_OPUS={version:'opus-original-1',getData:state,getMode:()=>store.mode(),store,journal,setScale,render,remind,ui};
render();setXiaoya(null);syncLineMode();
setTimeout(remind,1500);setInterval(remind,60000);
setInterval(()=>{if(ui.scale==='day'&&!$('#sheet').open&&document.activeElement?.id!=='journal-note')render()},5*60000);
