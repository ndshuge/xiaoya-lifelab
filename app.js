import {teachingWeek,monday,plusDays,dateKey,occurrences,freeSlots,parseSchedule,applyImport,undoTransaction,parseExceptions,checkSemester,checkSchedule,deliverReminders,isQuiet,growth,exportCalendar,fingerprint} from './domain.js';
import {buildGrowthRoutes,growthStageTasks,commitGrowthRoute,growthRouteProgress,summarizeGrowthWorkload} from './growth-simulator.js';
import {analyzeAgent} from './agent-engine.js';
import {initByokUI} from './byok-ui.js';
import {DAYS,dayIndex,localStamp,uid,esc,emptyStore,validateStore,detectConflicts,dueState,dueLabel,fmtDate,suggestions,approve,summary,demoData} from './core.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const keys={personal:'xiaoya:personal:v1',demo:'xiaoya:synthetic-demo:v1'};
let mode=sessionStorage.getItem('xiaoya:mode')==='demo'?'demo':'personal',data=load();
let view='today',filter='all',selectedDay=dayIndex(new Date()),transient='',transientTimer=null,modalContext=null,toastTimer=null;
let currentSuggestions=[],weekStart=monday(new Date()),importPreview=null,focusedBefore=null,storedSnapshot=localStorage.getItem(keys[mode]),committed=structuredClone(data);
let growthPreview=null,agentInspection=null;
let startupError='';
const ico=(name)=>'<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const list=[['course','课程'],['event','活动'],['task','事项'],['goal','目标']];
function load(){try{
 let raw=localStorage.getItem(keys[mode]);
 // One-off migration: erase only the user-requested action-log array.
 // Never touch tasks, goals, schedules, approvals, credentials or other records.
 const flag='xiaoya:action-history-cleared:20261022:'+mode;
 if(raw&&localStorage.getItem(flag)!=='1'){
  const source=JSON.parse(raw);
  if(!source||!Array.isArray(source.history))throw Error('行动记录格式异常，停止清理');
  if(source.history.length){
   const cleaned={...source,history:[]};
   const next=JSON.stringify(cleaned);
   localStorage.setItem(keys[mode],next);
   if(localStorage.getItem(keys[mode])!==next)throw Error('行动记录清理验证失败');
   raw=next;
  }
  localStorage.setItem(flag,'1');
 }
 const result=raw?validateStore(JSON.parse(raw)):emptyStore();
 window.OPC_LOAD_ERROR='';return result
 }catch(e){window.OPC_LOAD_ERROR=e.message;return emptyStore()}}
function save(next){
 if(window.OPC_LOAD_ERROR)throw Error('原档案无法读取，已禁止覆盖。请先导出原始文件，或明确恢复有效备份');
 const current=localStorage.getItem(keys[mode]);if(current!==storedSnapshot){data=load();committed=structuredClone(data);storedSnapshot=current;throw Error('另一个标签页已更新档案。已读取最新记录，请重新预览后再保存')}
 const before=structuredClone(committed);try{
  next=validateStore(next);const changes=[];for(const key of ['courses','events','tasks','goals','checkins'])for(const id of new Set([...before[key],...next[key]].map(x=>x.id))){const a=before[key].find(x=>x.id===id)||null,b=next[key].find(x=>x.id===id)||null;if(JSON.stringify(a)!==JSON.stringify(b))changes.push({key,id,before:a,after:b})}
  if(changes.length&&next.transactions.length===before.transactions.length&&!next.transactions.some((t,i)=>t.status!==before.transactions[i]?.status))next.transactions.push({id:uid(),title:'手动更新记录',at:new Date().toISOString(),status:'executed',changes});
  next.revision=before.revision+1;const serialized=JSON.stringify(next);localStorage.setItem(keys[mode],serialized);
  if(localStorage.getItem(keys[mode])!==serialized)throw Error('写入后读回不一致');
  data=validateStore(JSON.parse(serialized));committed=structuredClone(data);storedSnapshot=serialized;return true;
 }catch(e){data=before;try{if(localStorage.getItem(keys[mode])!==current)localStorage.setItem(keys[mode],current||JSON.stringify(before))}catch{}storedSnapshot=localStorage.getItem(keys[mode]);throw e}
}
function record(action,description){data.history.unshift({id:uid(),at:new Date().toISOString(),action,description});data.history=data.history.slice(0,10000)}
function notify(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800)}
function setMode(next){growthPreview=null;agentInspection=null;mode=next;sessionStorage.setItem('xiaoya:mode',mode);data=load();committed=structuredClone(data);storedSnapshot=localStorage.getItem(keys[mode]);transient='';render();navigate('today');notify(mode==='demo'?'已进入合成演示档案（不影响私人档案）':'已切换到私人档案')}
function isDemo(){return mode==='demo'}
function toggleDemo(){if(isDemo())setMode('personal');else {if(!localStorage.getItem(keys.demo))localStorage.setItem(keys.demo,JSON.stringify(demoData()));setMode('demo')}}
function navigate(next,ref=''){view=next;$$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+next));$$('[data-view]').forEach(n=>{const active=n.dataset.view===next;n.classList.toggle('is-active',active);n.classList.toggle('active',active)});$('#crumb').textContent={today:'今天',schedule:'我的课表',tasks:'作业与考试',goals:'兴趣与成长',review:'成长复盘',settings:'设置与隐私'}[next]||'今天';$('#pet-popover').hidden=true;window.scrollTo({top:0,behavior:data.settings.reducedMotion?'instant':'smooth'});if(ref)setTimeout(()=>{const el=$$('[data-item]').find(e=>e.dataset.item===ref);if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('focused-item');setTimeout(()=>el.classList.remove('focused-item'),2400)}},120)}
function empty(label,detail){return '<div class="empty-state"><div class="empty-art">✳</div><strong>'+esc(label)+'</strong><p>'+esc(detail)+'</p></div>'}
function typeName(t){return {assignment:'作业',exam:'考试',task:'事项'}[t]||'事项'}
function findItem(id){for(const [kind,key] of [['task','tasks'],['course','courses'],['event','events'],['goal','goals']]){const x=data[key].find(t=>t.id===id);if(x)return {kind,item:x}}return null}
function dateText(){const d=new Date();return d.toLocaleDateString('zh-CN',{month:'long',day:'numeric'})}
function renderToday(){
 const now=new Date(),date=now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
 $('#today-date').textContent=date;
 const today=dayIndex(now); const tw=teachingWeek(data,now);$('#today-date').textContent=date+(tw===null?' · 尚未设置学期':tw===0?' · 学期外':' · 第 '+tw+' 教学周');
 const upcoming=[...data.tasks].filter(t=>!t.done).sort((a,b)=>(a.due?new Date(a.due).getTime():Infinity)-(b.due?new Date(b.due).getTime():Infinity));
 $('#today-count').textContent=upcoming.length?'有 '+upcoming.length+' 项待完成':'今天也可以从容一点';
 $('#hero-description').textContent=upcoming.length?'有 '+upcoming.length+' 件事正在等你安排。按自己的节奏，一件件完成就好。':'把重要的事情放在心上，也给喜欢的事情留一点时间。';
 $('#today-tasks').innerHTML=upcoming.length?upcoming.slice(0,3).map(t=>'<div class="task-mini" data-item="'+esc(t.id)+'"><button class="mini-check" data-toggle="task" data-id="'+esc(t.id)+'" aria-label="完成 '+esc(t.title)+'">'+ico('check')+'</button><div class="item-main"><button data-open-kind="task" data-open-id="'+esc(t.id)+'" class="task-title">'+esc(t.title)+'</button><div class="subline">'+esc(t.course||typeName(t.type))+' · '+esc(fmtDate(t.due))+'</div></div><span class="time-pill '+dueState(t,now)+'">'+esc(dueLabel(t,now))+'</span></div>').join(''):empty('目前没有待完成的任务','点击上方“记录新事项”，先写下一件重要的事');
 const dayStart=new Date(dateKey(now)+'T00:00');const schedule=occurrences(data,dayStart,plusDays(dayStart,1));
 $('#today-schedule').innerHTML=schedule.length?schedule.slice(0,4).map(s=>'<div class="agenda-item" data-item="'+esc(s.id)+'"><span class="agenda-time">'+esc(s.start)+'</span><span class="agenda-bar '+(s.kind==='event'?'peach':'')+'"></span><div class="item-main"><button data-open-kind="'+s.kind+'" data-open-id="'+esc(s.id)+'"><strong>'+esc(s.name)+'</strong></button><small>'+esc(s.place||'未设置地点')+' · '+esc(s.end)+'</small></div></div>').join(''):empty('今天还没有课程或活动','这里会显示你实际保存的今日日程');
 let conflicts=detectConflicts(data);
 $('#today-alerts').innerHTML=conflicts.length?'<div class="alert-card">'+ico('alert')+'<div class="grow"><strong>发现 '+conflicts.length+' 处日程冲突</strong><p>'+esc(conflicts[0].a.name)+' 与 '+esc(conflicts[0].b.name)+' 在 '+DAYS[conflicts[0].day]+' 时间重叠</p></div><button data-view="schedule">查看来源</button></div>':'';
 renderAdvice();renderAgentInspection();renderRC();
 const st=summary(data,now);
 $('#today-stats').innerHTML='<div class="stat-tile"><span class="stat-icon">◷</span><div><strong>'+upcoming.length+'</strong><small>待完成事项</small></div></div><div class="stat-tile"><span class="stat-icon">✓</span><div><strong>'+st.done+'</strong><small>本周完成</small></div></div><div class="stat-tile"><span class="stat-icon">✿</span><div><strong>'+data.goals.filter(g=>!g.done).length+'</strong><small>进行中目标</small></div></div>';
}
function sourceButtons(s){return(s.sources||[]).map(x=>{let found=findItem(x.id);return found?'<button class="secondary" data-source="'+esc(x.id)+'">'+ico('arrow')+' 查看 '+esc(found.item.title||found.item.name)+'</button>':''}).join('')}
function renderAdvice(){
 currentSuggestions=suggestions(data,new Date());
 $('#today-advice').innerHTML=currentSuggestions.length?currentSuggestions.slice(0,2).map((s,i)=>'<div class="advice-card" style="'+(i?'margin-top:10px':'')+'" data-suggestion="'+esc(s.id)+'"><div class="advice-icon">✧</div><div class="advice-body"><span class="overline">'+(s.kind==='conflict'?'SCHEDULE CHECK':s.kind==='deadline'?'DEADLINE CHECK':'SMALL STEP')+'</span><h3>'+esc(s.title)+'</h3><p>'+esc(s.description)+'</p><p class="reason">'+esc(s.reason)+'</p><div class="advice-actions">'+sourceButtons(s)+(s.action?'<button data-propose="'+esc(s.id)+'">查看可执行建议 '+ico('arrow')+'</button><button class="secondary" data-reject="'+esc(s.id)+'">暂时不需要</button>':'<button data-add="task">新增一项任务</button>')+'</div></div></div>').join(''):'<div class="advice-card"><div class="advice-icon">✿</div><div class="advice-body"><h3>现在没有需要催促你的建议</h3><p>已处理的建议不会被机械重复。你可以自由安排今天。</p></div></div>';
}
function renderAgentInspection(){
 const el=$('#agent-inspection');if(!el)return;
 if(!agentInspection){el.innerHTML='<p class="muted">主动分析只读取当前档案。点击后可查看建议依据、对应的原始事项和授权动作，不会自动执行或上传数据。</p>';return}
 if(agentInspection.mode!==mode||agentInspection.basis!==fingerprint(data)){
  el.innerHTML='<p role="status">档案已变化，旧分析不再适用。请点击“重新检查”。</p>';return;
 }
 const result=agentInspection.result;
 el.innerHTML='<div class="agent-inspection-status"><strong>'+esc(result.mode==='rule'?'本机规则分析':result.mode==='rule-fallback'?'规则安全降级':'已授权模型分析')+'</strong><span>找到 '+result.candidates.length+' 条可追溯建议 · '+esc(result.observedAt.replace('T',' ').slice(0,19))+'</span></div>'
 +'<p class="muted">'+esc(result.warning)+'</p>'
 +(result.candidates.length?'<div class="agent-inspection-list">'+result.candidates.map(c=>{
  const sources=c.sourceIds.map(id=>findItem(id)).filter(Boolean);
  return '<article class="agent-inspection-item"><div><strong>'+esc(c.title)+'</strong><span class="agent-kind">'+esc(c.kind)+' · 优先级 '+c.severity+'</span></div>'
   +'<p>'+esc(c.modelNote||c.reason)+'</p>'
   +(c.uncertainty?'<p class="muted">不确定性：'+esc(c.uncertainty)+'</p>':'')
   +'<div class="agent-source-list">'+sources.map(s=>'<button type="button" class="btn btn-plain" data-source="'+esc(s.item.id)+'">查看来源：'+esc(s.item.title||s.item.name)+'</button>').join('')
   +(c.requiresApproval?'<button type="button" class="btn btn-soft" data-propose="'+esc(c.id)+'">预览授权动作</button>':'<span class="muted">只提醒，不自动执行</span>')+'</div></article>'
 }).join('')+'</div>':'<p>当前没有需要主动处理的建议，可继续正常安排。</p>');
}
async function inspectAgent(useAi=false){
 const buttons=['#agent-inspect','#agent-ai-inspect'].map($).filter(Boolean);
 if(useAi){
  if(document.body.dataset.aiMode!=='verified'){notify('请先通过小芽聊天入口连接并验证真实 AI');return}
  if(!window.confirm('将当前最多12条规则建议的标题、理由和简短说明发送到你已连接的模型用于排序解释，不会发送完整课表或自动修改档案。是否授权？'))return;
 }
 for(const btn of buttons)btn.disabled=true;
 try{
  const provider=useAi?{name:'用户授权的 BYOK 模型',analyze:({candidates})=>new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID();
    let timer;
    const handler=e=>{
      if(e.detail?.requestId!==requestId)return;
      clearTimeout(timer);window.removeEventListener('xiaoya-ai-analysis-result',handler);
      if(!e.detail.ok){reject(Error(e.detail.error||'模型分析失败'));return}
      try{resolve(JSON.parse(e.detail.raw))}catch{reject(Error('模型未返回合法 JSON'))}
    };
    window.addEventListener('xiaoya-ai-analysis-result',handler);
    timer=setTimeout(()=>{window.removeEventListener('xiaoya-ai-analysis-result',handler);reject(Error('分析超时'))},18000);
    window.dispatchEvent(new CustomEvent('xiaoya-ai-analysis-request',{detail:{requestId,candidates:candidates.map(x=>({
      id:x.id,title:x.title,reason:x.reason,description:x.description
    }))}}));
  })}:null;
  const result=await analyzeAgent(data,{authorized:useAi,provider,timeoutMs:19500});
  agentInspection={result,mode,basis:fingerprint(data)};
  renderAgentInspection();
 }catch(e){notify('分析失败：'+e.message)}
 finally{for(const btn of buttons)btn.disabled=false}
}

function scheduleEntry(x,conflicts){
const overlapping=conflicts.some(c=>c.a.id===x.id||c.b.id===x.id);
return '<button class="schedule-entry '+(x.kind==='event'?'activity ':'')+(overlapping?'has-conflict':'')+'" data-open-kind="'+esc(x.kind)+'" data-open-id="'+esc(x.id)+'" data-item="'+esc(x.id)+'"><strong>'+esc(x.name)+'</strong><small>'+esc(x.start)+'–'+esc(x.end)+'</small></button>';
}
function renderSchedule(){
const now=new Date(),conflicts=detectConflicts(data,weekStart,plusDays(weekStart,7)),all=occurrences(data,weekStart,plusDays(weekStart,7));
const tw=teachingWeek(data,weekStart);$('#week-label').textContent=dateKey(weekStart)+' 至 '+dateKey(plusDays(weekStart,6))+' · '+(tw===null?'未设置学期':tw===0?'学期外':'第 '+tw+' 教学周');
$('#week-grid').innerHTML=DAYS.map((d,i)=>'<div class="day-column '+(dayIndex(now)===i?'today':'')+'"><div class="day-name">'+d+'<small>'+dateKey(plusDays(weekStart,i)).slice(5)+'</small></div>'+(all.filter(x=>x.date===dateKey(plusDays(weekStart,i))).map(x=>scheduleEntry(x,conflicts)).join('')||'<div class="day-blank">自由时间</div>')+'</div>').join('');
$('#day-tabs').innerHTML=DAYS.map((d,i)=>'<button data-day="'+i+'" class="'+(selectedDay===i?'active':'')+'">'+d+'</button>').join('');
const entries=all.filter(x=>x.date===dateKey(plusDays(weekStart,selectedDay)));
$('#day-detail').innerHTML='<p class="muted">'+dateKey(plusDays(weekStart,selectedDay))+' · '+entries.length+' 个日程</p>'+(entries.length?entries.map(x=>scheduleEntry(x,conflicts)).join(''):empty('这一天还没有安排','可以增加课程或活动'));
$('#schedule-conflicts').innerHTML=conflicts.length?'<div class="panel conflict-list"><h3>本周时间冲突 · '+conflicts.length+'处</h3>'+conflicts.map(c=>'<div class="conflict-row"><strong>'+esc(c.date)+' '+esc(c.start)+'–'+esc(c.end)+'</strong><p>'+esc(c.a.name)+' ↔ '+esc(c.b.name)+'</p><button data-source="'+esc(c.a.id)+'">查看 '+esc(c.a.name)+'</button><button data-source="'+esc(c.b.id)+'">查看 '+esc(c.b.name)+'</button></div>').join('')+'</div>':'';
}
function renderTasks(){
let items=data.tasks.filter(t=>filter==='all'||filter==='done'&&t.done||filter==='open'&&!t.done).sort((a,b)=>Number(a.done)-Number(b.done)||(a.due?new Date(a.due).getTime():Infinity)-(b.due?new Date(b.due).getTime():Infinity));
$('#all-tasks').innerHTML=items.length?items.map(t=>'<div class="list-item '+(t.done?'done':'')+'" data-item="'+esc(t.id)+'"><button class="mini-check '+(t.done?'done':'')+'" data-toggle="task" data-id="'+esc(t.id)+'" aria-label="'+(t.done?'标记未完成':'标记完成')+'：'+esc(t.title)+'">'+ico('check')+'</button><div class="details"><strong>'+esc(t.title)+'</strong><small>'+typeName(t.type)+' · '+esc(t.course||'未关联课程')+' · '+esc(fmtDate(t.due))+'</small></div><span class="time-pill '+dueState(t)+'">'+esc(dueLabel(t))+'</span><div class="row-buttons"><button aria-label="编辑 '+esc(t.title)+'" data-open-kind="task" data-open-id="'+esc(t.id)+'">'+ico('edit')+'</button><button aria-label="删除 '+esc(t.title)+'" data-delete-kind="task" data-delete-id="'+esc(t.id)+'">'+ico('trash')+'</button></div></div>').join(''):empty('没有匹配的事项','新增作业或考试后就能追踪截止时间');
$$('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter===filter));
}
function renderGrowthSimulator(){
 const button=$('#growth-generate');if(!button)return;
 button.onclick=()=>{
  try{
   const plan=buildGrowthRoutes({goal:$('#growth-goal').value,baseline:$('#growth-baseline').value,
    hours:$('#growth-hours').value,weeks:$('#growth-weeks').value,pendingCount:data.tasks.filter(t=>!t.done).length,
    workload:summarizeGrowthWorkload(data,new Date())});
   growthPreview={plan,mode,basis:fingerprint(data)};
   paintGrowthPreview();
  }catch(e){notify(e.message)}
 };
 paintGrowthPreview();
 paintActiveGrowth();
}
function paintGrowthPreview(){
 const el=$('#growth-result');if(!el)return;
 if(!growthPreview||growthPreview.mode!==mode){el.innerHTML='';return}
 const {plan}=growthPreview;
 el.innerHTML='<div class="growth-preview-intro"><strong>'+esc(plan.goal)+'</strong><p class="muted">'+esc(plan.explain)+'</p></div>'
 +'<div class="growth-route-grid">'+plan.routes.map(r=>'<article class="growth-route-card"><div class="growth-route-head"><span>成长路线</span><h4>'+esc(r.name)+'</h4></div>'
 +'<p>'+esc(r.reason)+'</p><div class="growth-route-stages">'+r.stages.map(s=>'<div class="growth-route-stage"><span>第 '+s.startWeek+'–'+s.endWeek+' 周 · 预计 '+s.hours+' 小时</span><strong>'+esc(s.title)+'</strong><small>'+esc(s.action)+'</small><small class="growth-deliverable">阶段成果：'+esc(s.deliverable||'行动记录')+'</small></div>').join('')+'</div>'
 +'<p class="growth-risk">需注意：'+esc(r.risk)+'</p><button class="btn btn-dark" type="button" data-growth-route="'+r.id+'">选择这条路线并预览任务</button></article>').join('')+'</div>';
}
function paintActiveGrowth(){
 const el=$('#growth-active');if(!el)return;
 const tracked=data.goals.filter(g=>g.growthPlan).map(g=>growthRouteProgress(data,g.id)).filter(Boolean);
 el.innerHTML=tracked.length?'<div class="section-heading secondary-section"><div><span class="kicker">YOUR REAL STEPS</span><h2>正在实践的成长路线</h2></div></div>'
 +tracked.map(p=>'<article class="growth-tracked"><div class="growth-tracked-header"><strong>'+esc(p.goal.title)+'</strong><span>'+esc(p.goal.growthPlan.routeName)+' · 已完成 '+p.done+' / '+p.all+' 个阶段任务</span></div>'
 +'<div class="progress-rail"><span style="width:'+(p.all?Math.round(100*p.done/p.all):0)+'%"></span></div>'
 +'<p class="muted">实际行动记录：'+p.recordedMinutes+'分钟。阶段计划时长不等于实际学习时长。</p>'
 +'<div class="growth-tracked-actions"><button class="btn btn-soft" data-checkin="'+esc(p.goal.id)+'">记录实际行动</button><button class="btn btn-plain" data-growth-tasks="'+esc(p.goal.id)+'">查看阶段任务</button></div></article>').join(''):'';
}
function openGrowthApproval(routeId){
 if(!growthPreview||growthPreview.mode!==mode||growthPreview.basis!==fingerprint(data)){
  notify('当前档案已变化，请重新生成成长路线');return;
 }
 const {plan}=growthPreview,route=plan.routes.find(r=>r.id===routeId);
 if(!route)return;
 const tasks=growthStageTasks(plan,routeId);
 showModal('确认启动成长路线','由你批准 · 仅在本机执行',
  '<p>目标：<strong>'+esc(plan.goal)+'</strong> · '+esc(route.name)+'</p>'
  +'<p class="muted">批准后新增 1 个成长目标和 '+tasks.length+' 个阶段任务；确认前可修改每个任务的名称与截止时间。不会自动安排日程或调用模型，保存后可在设置撤销。</p>'
  +tasks.map((t,i)=>'<div class="growth-approval-stage"><span>阶段 '+(i+1)+' · '+esc(route.stages[i].action)+'</span>'
   +'<label for="growth-task-title-'+i+'">任务名称<input id="growth-task-title-'+i+'" type="text" maxlength="160" value="'+esc(t.title)+'" required></label>'
   +'<label for="growth-task-due-'+i+'">截止时间<input id="growth-task-due-'+i+'" type="datetime-local" value="'+esc(t.due)+'" required></label></div>').join('')
  +'<div id="growth-approval-error" role="alert"></div><div class="form-footer"><button class="btn btn-soft" data-close>取消</button><button class="btn btn-dark" id="approve-growth">确认生成任务</button></div>');
 modalContext={growth:{plan:structuredClone(plan),routeId,mode,basis:growthPreview.basis}};
}
function approveGrowth(){
 const request=modalContext?.growth;if(!request)return;
 const error=$('#growth-approval-error');
 try{
  if(request.mode!==mode||request.basis!==fingerprint(data))throw Error('数据已变化，请重新生成方案');
  const now=new Date();
  const edits=[0,1,2].map(i=>{
   const title=$('#growth-task-title-'+i)?.value.trim(),due=$('#growth-task-due-'+i)?.value;
   if(!title||title.length>160)throw Error('任务名称必须为1–160字');
   if(typeof due!=='string'||due.length!==16||due[4]!=='-'||due[7]!=='-'||due[10]!=='T'||due[13]!==':'||!Number.isFinite(+new Date(due))||localStamp(new Date(due))!==due||new Date(due)<=now)
    throw Error('阶段任务的截止时间必须有效且晚于现在');
   return {title,due};
  });
  if(edits.some((e,i)=>i>0&&new Date(e.due)<=new Date(edits[i-1].due)))
   throw Error('阶段任务的截止时间必须严格递增');
  const result=commitGrowthRoute(data,request.plan,request.routeId,now,uid);
  edits.forEach((v,i)=>{
   Object.assign(result.tasks[i],v);
   result.goal.growthPlan.stages[i].approvedTaskTitle=v.title;
   result.goal.growthPlan.stages[i].approvedDue=v.due;
  });
  save(result.next);
  const actual=load();
  if(!actual.goals.some(g=>g.id===result.goal.id)||result.tasks.some(t=>!actual.tasks.some(x=>x.id===t.id)))
   throw Error('保存后数据校验失败，请检查当前档案');
  growthPreview=null;closeModal();render();navigate('goals',result.goal.id);
  notify('成长路线已批准 · 3项阶段任务已保存 · 可在设置撤销');
 }catch(e){if(error)error.textContent=e.message;notify('未能完成路线保存：'+e.message)}
}
function renderGoals(){
renderGrowthSimulator();
$('#all-goals').innerHTML=data.goals.length?data.goals.map(g=>'<article class="panel goal-card" data-item="'+esc(g.id)+'"><div class="goal-top"><span class="goal-icon">✿</span><span class="status-pill">'+(g.done?'已完成':'进行中')+'</span></div><h3>'+esc(g.title)+'</h3><p>'+esc(g.target||g.category||'为自己留一个小目标')+'</p><p class="muted">'+(g.kind==='habit'?'习惯':'长期目标/兴趣')+' · 已记录 '+data.checkins.filter(c=>c.goalId===g.id).length+' 次行动 · '+data.checkins.filter(c=>c.goalId===g.id).reduce((n,c)=>n+c.minutes,0)+' 分钟</p><div class="goal-footer"><button data-checkin="'+esc(g.id)+'">记录行动</button><button data-toggle="goal" data-id="'+esc(g.id)+'">'+(g.done?'设为进行中':'✓ 完成目标')+'</button><button data-open-kind="goal" data-open-id="'+esc(g.id)+'">编辑</button><button data-delete-kind="goal" data-delete-id="'+esc(g.id)+'">删除</button></div></article>').join(''):empty('还没有设定成长目标','选择一个你想坚持的小兴趣，先从一周一次开始');
}
function renderReview(){
const g=growth(data),s=g.current,p=g.previous;
$('#review-overview').innerHTML='<div class="review-numbers"><div class="review-number"><strong>'+s.dueCompleted+' / '+s.due+'</strong><span>本周截止事项已完成 / 总数</span></div><div class="review-number"><strong>'+s.checkins+'</strong><span>本周有证据的目标行动</span></div><div class="review-number"><strong>'+s.overdue+'</strong><span>本周延误截止事项</span></div></div><div class="panel"><h3>'+(g.hasEvidence?'跨周的真实记录':'记录不足，还不能判断成长')+'</h3><p>上周完成 '+p.done+' 项；本周 '+s.done+' 项。目标行动 '+p.checkins+' → '+s.checkins+' 次；记录时长 '+s.minutes+' 分钟。</p><p class="muted">仅按完成时间、截止时间与用户行动记录统计。数量变化不代表能力或节时成效；空周仅表示没有记录。</p><div class="table-scroll"><table class="rc-table"><thead><tr><th>周一日期</th><th>完成</th><th>延误</th><th>行动次数</th><th>分钟</th><th>批准/拒绝</th></tr></thead><tbody>'+g.weeks.map(w=>'<tr><td>'+w.start+'</td><td>'+w.done+'</td><td>'+w.overdue+'</td><td>'+w.checkins+'</td><td>'+w.minutes+'</td><td>'+w.accepted+' / '+w.rejected+'</td></tr>').join('')+'</tbody></table></div></div>';
$('#history-list').innerHTML=data.history.length?data.history.slice(0,40).map(h=>'<div class="log-item"><div>'+esc(h.description||h.action)+'</div><span>'+esc(fmtDate(h.at))+'</span></div>').join(''):empty('还没有行动记录','真正保存操作后，这里才会出现可追溯记录');
$('#growth-review').innerHTML=data.goals.filter(g=>g.growthPlan).map(g=>growthRouteProgress(data,g.id)).filter(Boolean).map(p=>'<div class="log-item"><strong>'+esc(p.goal.title)+' · '+esc(p.goal.growthPlan.routeName)+'</strong><span>已完成 '+p.done+'/'+p.all+' 项阶段任务；实际行动记录 '+p.recordedMinutes+' 分钟</span></div>').join('')||'<p class="muted">尚未批准成长路线；不会凭空生成成长记录。</p>';
$('#checkin-history').innerHTML=data.checkins.slice().reverse().slice(0,20).map(c=>'<div class="log-item"><span>'+esc(data.goals.find(g=>g.id===c.goalId)?.title||'已删除目标')+' · '+c.minutes+'分钟 · '+esc(c.note)+' · '+esc(fmtDate(c.at))+'</span><button data-remove-checkin="'+esc(c.id)+'">删除这次记录</button></div>').join('')||'<p class="muted">没有目标行动记录。</p>';
}
function petState(){
if(isQuiet(data))return 'silent';
if(transient)return transient;
const s=currentSuggestions.length?currentSuggestions:suggestions(data);
if(s.some(x=>x.kind==='deadline'&&(x.severity===0||x.severity===1)))return 'remind';
if(s.some(x=>x.kind==='conflict'))return 'care';
return 'idle';
}
// Brand V1: original illustration sprites, backed by the original SVG if loading fails.
const MASCOT_V1_SRC='./assets/brand/xiaoya_sprite_v1.webp';
const mascotPreloader=new Image();
mascotPreloader.onload=()=>document.body.classList.add('xiaoya-v1-ready');
mascotPreloader.onerror=()=>document.body.classList.remove('xiaoya-v1-ready');
mascotPreloader.src=MASCOT_V1_SRC;
function mountMascotV1(button){
 if(!button)return;
 let art=button.querySelector('.xiaoya-sprite-v1');
 if(!art){
  art=document.createElement('span');
  art.className='xiaoya-sprite-v1';
  art.setAttribute('aria-hidden','true');
  button.appendChild(art);
 }
}
function renderPet(){
let now=new Date(),s=summary(data,now),state=petState(),chosen=currentSuggestions[0];
const words={idle:['正在陪伴你','你好呀，我是小芽','慢慢来，今天也是新的一天。'],remind:['有一件事要注意','记得留意截止时间','我发现一项待完成的近期任务。'],thinking:['正在整理建议','我看一下你的安排','只分析你主动保存的课程和任务。'],celebrate:['小小地庆祝一下','这一件，真的完成了！','刚才的完成记录已经保存。'],care:['发现时间有点挤','记得给自己留空档','我发现两件真实日程重叠。'],silent:['已经安静下来','我会静静陪着你','勿扰已开启，仍可主动查看建议。']};
const w=words[state];$('#pet-figure')?.setAttribute('data-state',state);
$('#pet-button').dataset.state=state;$('#pet-state-label').textContent=w[0];$('#pet-title').textContent=w[1];$('#pet-message').textContent=w[2];
$('#popover-title').textContent=w[1];$('#popover-text').textContent=(chosen?chosen.description+'。'+chosen.reason:w[2]);
$('#popover-links').innerHTML=chosen?sourceButtons(chosen)+(chosen.action?'<button data-propose="'+esc(chosen.id)+'">查看行动建议</button>':''):'<button data-view="today">返回今天</button>';
$('#pet-panel').style.display=data.settings.hidePet?'none':'';
$('#mobile-pet').style.display=data.settings.hidePet?'none':'';
$('#mobile-pet-dot').style.display=state==='idle'||state==='silent'?'none':'';
$('#mobile-pet').setAttribute('aria-label','小芽：'+w[0]+'，点击查看'); if(!$('#mobile-pet .sprout-svg')){const small=$('#pet-button .sprout-svg').cloneNode(true);small.setAttribute('aria-hidden','true');$('#mobile-pet span').replaceWith(small)}$('#mobile-pet').dataset.state=state;
mountMascotV1($('#pet-button'));mountMascotV1($('#mobile-pet'));
$('#rail-progress').innerHTML='<div class="progress-rail"><span style="width:'+(s.all?100*s.done/s.all:0)+'%"></span></div><div class="progress-copy">本周已完成 '+s.done+' / '+s.all+' 项到期事项</div>';
}
function render(){
let now=new Date();$('#rail-weekday').textContent=now.toLocaleDateString('zh-CN',{weekday:'long'});$('#rail-date').textContent=dateText();$('#mode-badge').textContent=isDemo()?'DEMO DATA · 合成示例':'私人空白档案';$('#mode-badge').classList.toggle('demo',isDemo());$('#mode-switch').textContent=isDemo()?'返回私人档案':'载入合成演示';document.body.classList.toggle('reduce-motion',data.settings.reducedMotion);$('#setting-quiet').checked=!!data.settings.quiet;$('#setting-motion').checked=!!data.settings.reducedMotion;$('#setting-pet').checked=!!data.settings.hidePet;
renderToday();renderSchedule();renderTasks();renderGoals();renderReview();renderPet();
}
function closeModal(){$('#modal-root').hidden=true;$('#modal-content').innerHTML='';modalContext=null;focusedBefore?.focus?.()}
function showModal(title,eyebrow,html){focusedBefore=document.activeElement;$('#modal-title').textContent=title;$('#modal-eyebrow').textContent=eyebrow;$('#modal-content').innerHTML=html;$('#modal-root').hidden=false;setTimeout(()=>$('#modal-content input:not([type=hidden]),#modal-content button')?.focus(),20)}
const field=(label,name,value='',type='text',required=true,wide=false)=>'<div class="field '+(wide?'wide':'')+'"><label for="f-'+name+'">'+label+'</label><input id="f-'+name+'" name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+'></div>';
function openForm(kind,id=''){
 const key={course:'courses',event:'events',task:'tasks',goal:'goals'}[kind];if(!key)return;
 const item=data[key].find(t=>t.id===id)||{};modalContext={kind,id,basis:fingerprint(data)};let fields='';
 if(kind==='course'||kind==='event'){
 fields=field(kind==='course'?'课程名称':'活动名称','name',item.name||'','text',true,true)
 +'<div class="field"><label for="f-day">每周星期</label><select id="f-day" name="day">'+DAYS.map((d,i)=>'<option value="'+i+'" '+(Number(item.day??selectedDay)===i?'selected':'')+'>'+d+'</option>').join('')+'</select></div>'
 +field('地点（选填）','place',item.place||'','text',false)
 +field('开始时间','start',item.start||'09:00','time')
 +field('结束时间（更早表示次日）','end',item.end||'10:30','time')
 +field('单次日期（留空为每周）','date',item.date||'','date',false,true)
 +field('起始教学周','weekStart',item.weekStart||1,'number')+field('结束教学周','weekEnd',item.weekEnd||18,'number')
 +'<div class="field wide"><label for="f-parity">周次规律</label><select id="f-parity" name="parity"><option value="all">每周</option><option value="odd" '+(item.parity==='odd'?'selected':'')+'>单周</option><option value="even" '+(item.parity==='even'?'selected':'')+'>双周</option></select></div>'
 +'<div class="field wide"><label for="f-exceptions">例外（JSON，取消/调课/加课）</label><textarea id="f-exceptions" name="exceptions" rows="3">'+esc(JSON.stringify(item.exceptions||[]))+'</textarea><small>例如 [{"date":"2026-10-01","type":"cancel"}]；调课用 type:"replace", targetDate, start, end。仅改变该次。</small></div>';

 }else if(kind==='task'){
 fields=field('事项名称','title',item.title||'','text',true,true)
 +'<div class="field"><label for="f-type">类型</label><select id="f-type" name="type">'+[['assignment','作业'],['exam','考试'],['task','其他事项']].map(x=>'<option value="'+x[0]+'" '+((item.type||'assignment')===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>'
 +field('关联课程（选填）','course',item.course||'','text',false)
 +field('截止时间','due',item.due||localStamp(new Date(Date.now()+86400000)),'datetime-local',true,true)
 +field('预计用时（分钟）','minutes',item.minutes??30,'number')+'<div class="field"><label for="f-remind">网页提醒</label><select id="f-remind" name="remind"><option value="true">开启</option><option value="false" '+(item.remind===false?'selected':'')+'>关闭</option></select></div>';
 }else{
 fields=field('目标名称','title',item.title||'','text',true,true)+field('类型（如音乐、运动）','category',item.category||'兴趣','text',false,true)+field('可验证的行动/里程碑','target',item.target||'','text',false,true)+field('目标日期（选填）','targetDate',item.targetDate||'','date',false)+field('每周期望次数','weeklyTarget',item.weeklyTarget||1,'number')+'<div class="field wide"><label for="f-kind">跟踪方式</label><select id="f-kind" name="kind"><option value="goal">长期目标/兴趣</option><option value="habit" '+(item.kind==='habit'?'selected':'')+'>习惯</option></select></div>';
 }
 showModal((id?'编辑':'新增')+({course:'课程',event:'活动',task:'事项',goal:'目标'}[kind]),id?'EDIT':'NEW MOMENT',
 '<form id="edit-form" class="form-fields">'+fields+'<div class="form-footer field wide">'+(id?'<button type="button" class="btn btn-danger" data-delete-kind="'+kind+'" data-delete-id="'+esc(id)+'">删除记录</button>':'')+'<button type="button" class="btn btn-soft" data-close>取消</button><button type="submit" class="btn btn-dark">保存到当前档案</button></div></form>');
}
function saveForm(form){
let {kind,id,basis}=modalContext||{};if(basis!==fingerprint(data)){notify('记录已变化，请关闭表单后重新编辑');return}const key={course:'courses',event:'events',task:'tasks',goal:'goals'}[kind];if(!key)return;
let f=Object.fromEntries(new FormData(form).entries());
if(kind==='course'||kind==='event'){try{f.day=Number(f.day);f.weekStart=Number(f.weekStart);f.weekEnd=Number(f.weekEnd);f.exceptions=parseExceptions(f.exceptions);checkSchedule(f)}catch(e){notify(e.message);return}}
if(kind==='task'&&!(new Date(f.due).getTime())){notify('请填写有效的截止时间');return}
if(kind==='task')f.remind=f.remind!=='false';if(kind==='goal')f.weeklyTarget=Math.max(1,Math.min(7,+f.weeklyTarget||1));
if(kind==='task')f.minutes=Math.max(1,Math.min(1200,Number(f.minutes)||30));
if(kind==='course'||kind==='event')f.day=Number(f.day);
const existing=data[key].find(x=>x.id===id);
const next={...existing,...f,id:id||uid(),createdAt:existing?.createdAt||new Date().toISOString()};
if(kind==='goal')next.done=existing?.done||false;
if(kind==='task')next.done=existing?.done||false;
data[key]=id?data[key].map(x=>x.id===id?next:x):[...data[key],next];
record(id?'edited':'added',(id?'更新':'新增')+'：'+(next.title||next.name));
try{save(data);closeModal();render();notify('保存成功 · 已写入本机浏览器')}catch(e){notify('保存失败：'+e.message)}
}
function deleteItem(kind,id){
const key={course:'courses',event:'events',task:'tasks',goal:'goals'}[kind],item=data[key]?.find(t=>t.id===id);
if(!item||!confirm('确定删除「'+(item.title||item.name)+'」吗？保存后可在设置的事务记录中撤销。'))return;
data[key]=data[key].filter(t=>t.id!==id);if(kind==='goal')data.checkins=data.checkins.filter(c=>c.goalId!==id);record('deleted','删除：'+(item.title||item.name));try{save(data);if(modalContext?.id===id&&modalContext?.kind===kind)closeModal();render();notify('已删除记录')}catch(e){notify(e.message)}
}
function toggleItem(kind,id){
let key=kind==='goal'?'goals':'tasks';const item=data[key].find(x=>x.id===id);if(!item)return;
let toDone=!item.done;item.done=toDone;item.completedAt=toDone?new Date().toISOString():null;
record('completed', (toDone?'完成':'撤销完成')+'：'+item.title);
try{save(data);if(toDone&&!data.settings.quiet){transient='celebrate';clearTimeout(transientTimer);transientTimer=setTimeout(()=>{transient='';renderPet()},3700)}render();notify(toDone?'已保存完成 · 小芽为你开心':'已恢复未完成状态')}catch(e){notify(e.message)}
}
function rejectSuggestion(id){const s=currentSuggestions.find(x=>x.id===id);if(!s)return;data.decisions.push({id,status:'rejected',at:new Date().toISOString(),reason:'用户选择暂不采纳',sourceIds:s.sources});record('rejected','拒绝建议：'+s.title);try{save(data);render();notify('已记录拒绝；不会重复催促相同建议')}catch(e){notify(e.message)}}
function propose(id){
const s=currentSuggestions.find(x=>x.id===id);if(!s?.action)return;modalContext={proposal:structuredClone(s)};const a=s.action;
const inputs=(step,i)=>'<div class="plan-step"><strong>'+esc(step.title||a.title)+'</strong>'+field('开始时间','plan-start-'+i,step.start,'datetime-local')+field('结束时间','plan-end-'+i,step.end,'datetime-local')+'</div>';
showModal('把建议变成你的安排','', '<p class="modal-explanation">'+esc(s.description)+'<br>'+esc(s.reason)+'</p><p class="plan-kind">'+({moveEvent:'移动活动的本次发生；固定课程不动',planTask:'创建真实专注时段及可完成步骤',splitTask:'拆分为两个实际时间块及子步骤',planGoal:'为目标创建实际练习时段'}[a.type])+'</p>'+(a.steps||[{start:a.start,end:a.end}]).map(inputs).join('')+'<p class="muted">时间可编辑；批准时重新检查冲突、时长、截止与来源。仅写入当前本机档案。保存后可撤销。</p><div id="action-error" role="alert"></div><div class="form-footer"><button class="btn btn-soft" data-reject="'+esc(s.id)+'">拒绝建议</button><button class="btn btn-dark" id="approve-action">批准并执行安排</button></div>');
}
function approveNow(){
const s=modalContext?.proposal;if(!s)return;const a=structuredClone(s.action);const steps=a.steps||[{start:a.start,end:a.end}];for(let i=0;i<steps.length;i++){steps[i].start=$('#f-plan-start-'+i).value;steps[i].end=$('#f-plan-end-'+i).value}if(a.steps)a.steps=steps;else {a.start=steps[0].start;a.end=steps[0].end}
try{const result=approve(data,{...s,action:a});save(result.next);const loaded=load();if(!loaded.transactions.some(t=>t.id===result.transaction.id)||result.transaction.changes.some(c=>JSON.stringify(loaded[c.key].find(x=>x.id===c.id))!==JSON.stringify(c.after)))throw Error('写入后核验失败');data=loaded;closeModal();transient=isQuiet(data)?'':'celebrate';clearTimeout(transientTimer);transientTimer=setTimeout(()=>{transient='';renderPet()},3700);render();notify('已执行安排 · 重新读取核验成功 · 可在设置撤销');navigate('schedule');
}catch(e){$('#action-error').textContent='执行失败：'+e.message+'。没有保存部分变更。';notify('执行失败：'+e.message)}
}
function showPet(){if(data.settings.hidePet){navigate('settings');return}$('#pet-popover').hidden=!$('#pet-popover').hidden}
function updateSetting(name,v){data.settings[name]=v;record('settings','调整偏好：'+name+' → '+v);try{save(data);if(name==='quiet'&&v){transient='';$('#pet-popover').hidden=true}render();notify('设置已保存')}catch(e){notify(e.message)}}
function exportData(){const json=window.OPC_LOAD_ERROR?localStorage.getItem(keys[mode]):JSON.stringify({...data,exportedAt:new Date().toISOString(),archiveMode:mode},null,2);const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='xiaoya-'+mode+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);notify('已导出当前档案 JSON（读取失败时导出原始文件）')}
async function importData(file){if(!file)return;try{const raw=JSON.parse(await file.text());const next=validateStore(raw);if(!confirm('导入将覆盖当前'+(isDemo()?'合成演示':'私人')+'档案。确定继续？'))return;window.OPC_LOAD_ERROR='';save(next);render();notify('已成功导入并恢复当前档案')}catch(e){notify('导入失败：'+e.message)}finally{$('#import-file').value=''}}
function clearData(){if(!confirm('确定清空当前'+(isDemo()?'合成演示':'私人')+'档案吗？其他模式不受影响。'))return;if(!confirm('再次确认：本次删除不可撤销，建议先导出备份。'))return;window.OPC_LOAD_ERROR='';save(emptyStore());render();notify('已清空当前档案')}
function reanalyze(){if(transient==='thinking')return;transient='thinking';renderPet();setTimeout(()=>{currentSuggestions=suggestions(data);transient='';renderToday();renderPet();notify('已根据当前保存的事项重新分析')},450)}
document.addEventListener('click',e=>{
 const t=e.target.closest('button');if(!t)return;
 if(t.matches('[data-close]'))return closeModal();
 if(t.id==='week-prev'||t.id==='week-next'){weekStart=plusDays(weekStart,t.id==='week-prev'?-7:7);renderSchedule();return}
 if(t.id==='week-now'){weekStart=monday(new Date());renderSchedule();return}
 if(t.id==='schedule-import')return $('#schedule-file').click();
 if(t.id==='approve-import')return confirmScheduleImport();
 if(t.id==='calendar-export')return downloadCalendar();
 if(t.id==='reset-demo'){if(confirm('重置合成演示？私人档案不受影响。')){if(mode!=='demo')setMode('demo');save(demoData());render();notify('已重置合成演示')}return}
 if(t.dataset.growthRoute)return openGrowthApproval(t.dataset.growthRoute);
 if(t.id==='approve-growth')return approveGrowth();
 if(t.dataset.growthTasks){navigate('tasks');return}
 if(t.dataset.undo)return undoSaved(t.dataset.undo);
 if(t.dataset.checkin)return openCheckin(t.dataset.checkin);
 if(t.dataset.removeCheckin){data.checkins=data.checkins.filter(c=>c.id!==t.dataset.removeCheckin);persistSafely();return}
 if(t.id==='reminder-settings-save')return saveReminderSettings();
 if(t.id==='semester-save')return saveSemester();
 if(t.id==='onboard-dismiss'){updateSetting('onboarded',true);return}
 if(t.dataset.view){navigate(t.dataset.view);return}
 if(t.dataset.add)return openForm(t.dataset.add);
 if(t.dataset.openKind)return openForm(t.dataset.openKind,t.dataset.openId);
 if(t.dataset.deleteKind)return deleteItem(t.dataset.deleteKind,t.dataset.deleteId);
 if(t.dataset.toggle)return toggleItem(t.dataset.toggle,t.dataset.id);
 if(t.dataset.day!==undefined){selectedDay=Number(t.dataset.day);renderSchedule();return}
 if(t.dataset.filter){filter=t.dataset.filter;renderTasks();return}
 if(t.dataset.source){const found=findItem(t.dataset.source);if(!found){notify('来源事项已删除');return}closeModal();navigate(found.kind==='task'?'tasks':found.kind==='goal'?'goals':'schedule',found.item.id);return}
 if(t.dataset.propose)return propose(t.dataset.propose);
 if(t.dataset.reject){rejectSuggestion(t.dataset.reject);closeModal();return}
 if(t.id==='approve-action')return approveNow();
 if(t.id==='mode-switch')return toggleDemo();
 if(t.id==='pet-button'||t.id==='pet-open'||t.id==='mobile-pet')return showPet();
 if(t.id==='pet-popover-close'){ $('#pet-popover').hidden=true;return}
 if(t.id==='pet-quiet'){updateSetting('quiet',!data.settings.quiet);return}
 if(t.id==='export-btn')return exportData();
 if(t.id==='export-raw')return exportData();
 if(t.id==='import-btn')return $('#import-file').click();
 if(t.id==='clear-btn')return clearData();
 if(t.id==='recheck-btn')return reanalyze();
 if(t.id==='agent-inspect')return inspectAgent();
 if(t.id==='agent-ai-inspect')return inspectAgent(true);
});
document.addEventListener('submit',e=>{if(e.target.id==='checkin-form'){e.preventDefault();return saveCheckin(e.target)}if(e.target.id==='quick-task-form'){e.preventDefault();return quickTask(e.target)}if(e.target.id==='edit-form'){e.preventDefault();saveForm(e.target)}});
document.addEventListener('change',e=>{
 if(e.target.id==='setting-quiet')updateSetting('quiet',e.target.checked);
 if(e.target.id==='setting-motion')updateSetting('reducedMotion',e.target.checked);
 if(e.target.id==='setting-pet')updateSetting('hidePet',e.target.checked);
 if(e.target.id==='import-file')importData(e.target.files[0]);
 if(e.target.id==='schedule-file')previewSchedule(e.target.files[0]);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#pet-popover').hidden=true}});
$('#modal-root').addEventListener('click',e=>{if(e.target.matches('[data-close]'))closeModal()});
setInterval(()=>{if(!$('#modal-root').hidden)return;checkReminders();render()},30000);
window.addEventListener('storage',e=>{if(e.key===keys[mode]){data=load();committed=structuredClone(data);storedSnapshot=localStorage.getItem(keys[mode]);render();notify('另一个标签页已更新，已读取最新档案')}});
document.addEventListener('keydown',e=>{if(e.key!=='Tab'||$('#modal-root').hidden)return;const nodes=$('#modal-root button,#modal-root input,#modal-root select,#modal-root textarea').filter(x=>!x.disabled);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
window.OPC_TEST={getMode:()=>mode,getData:()=>structuredClone(data),suggestions:()=>suggestions(data),petState:()=>petState(),navigate,reanalyze,load,checkReminders,growthPreview:()=>structuredClone(growthPreview)};
renderGrowthSimulator();
render();checkReminders();
initByokUI({onGrowthPlan:plan=>{
 growthPreview={plan,mode,basis:fingerprint(data)};
 paintGrowthPreview();
 notify('AI 规划已通过规则审核，批准前不会新增任何任务');
}});
const entryQuery=new URLSearchParams(location.search);
if(entryQuery.get('judge')==='1'&&mode!=='demo')toggleDemo();
if(['today','schedule','tasks','goals','review','settings'].includes(entryQuery.get('view')))navigate(entryQuery.get('view'));

function persistSafely(){try{save(data);render();return true}catch(e){notify('保存失败：'+e.message);render();return false}}
function renderRC(){
 $('#storage-error').hidden=!window.OPC_LOAD_ERROR;$('#storage-error-text').textContent=window.OPC_LOAD_ERROR?'档案读取失败：'+window.OPC_LOAD_ERROR+'。原始存储保留，已禁止保存覆盖。请导出原始文件后修正，或在设置恢复有效备份。':'';
 const s=data.semester;$('#semester-name').value=s.name;$('#semester-start').value=s.start;$('#semester-end').value=s.end;
 $('#reminder-leads').value=data.settings.leadMinutes.join(',');$('#quiet-start').value=data.settings.quietStart;$('#quiet-end').value=data.settings.quietEnd;$('#reminder-gap').value=data.settings.reminderGap;$('#reminder-enabled').checked=!!data.settings.reminderEnabled;
 $('#onboarding').hidden=!!data.settings.onboarded||mode==='demo';
 $('#onboard-progress').textContent=(s.start?'✓ 已设置学期':'① 设置学期')+' · '+(data.courses.length?'✓ 已录入课程':'② 导入/录入课表')+' · '+(data.tasks.length?'✓ 已记录事项':'③ 记录作业或考试');
 const slots=freeSlots(data,new Date(),plusDays(new Date(),1),30);$('#free-time').textContent=slots.length?'接下来24小时可用空档：'+slots.slice(0,3).map(x=>x.start.replace('T',' ')+'（可用 '+x.availableMinutes+' 分钟）').join('；'):'接下来24小时没有30分钟空档（仅计算08:00–22:00）';
 $('#reminder-list').innerHTML=data.reminders.slice().reverse().slice(0,8).map(r=>'<div class="log-item"><button data-source="'+esc(r.sourceId)+'">'+esc(r.title)+' · '+esc(r.label)+'</button><small>'+esc(fmtDate(r.deliveredAt))+'</small></div>').join('')||'<p class="muted">没有已送达的网页提醒。网页关闭后不会继续运行。</p>';
 $('#transactions').innerHTML=data.transactions.slice().reverse().slice(0,12).map(t=>'<div class="log-item"><span>'+esc(t.title)+' · '+esc(fmtDate(t.at))+' · '+(t.status==='undone'?'已撤销':'已保存/核验')+'</span>'+(t.status==='executed'?'<button data-undo="'+esc(t.id)+'">撤销这次变更</button>':'')+'</div>').join('')||'<p class="muted">事务写入后可在此撤销。记录之后被编辑则拒绝覆盖。</p>';
}
function saveSemester(){try{data.semester=checkSemester({name:$('#semester-name').value.trim()||'我的学期',start:$('#semester-start').value,end:$('#semester-end').value});if(persistSafely())notify('学期已保存；周次按周一切换')}catch(e){data=structuredClone(committed);notify(e.message)}}
function saveReminderSettings(){const leads=$('#reminder-leads').value.split(',').map(x=>Number(x.trim()));data.settings={...data.settings,leadMinutes:[...new Set(leads)],quietStart:$('#quiet-start').value,quietEnd:$('#quiet-end').value,reminderGap:Number($('#reminder-gap').value),reminderEnabled:$('#reminder-enabled').checked};if(persistSafely())notify('提醒偏好已保存（网页内）')}
function checkReminders(){const result=deliverReminders(data);if(result.delivered.length){try{save(result.next);notify('小芽提醒：'+result.delivered[0].title+' · '+result.delivered[0].label)}catch(e){notify('提醒状态保存失败：'+e.message)}}return result.delivered}
async function previewSchedule(file){if(!file)return;try{importPreview=parseSchedule(await file.text(),file.name,data);const p=importPreview;showModal('先预览课表，再导入','', '<p>来源：'+esc(p.filename)+' · 新增 '+p.items.length+' 条 · 跳过重复 '+p.duplicates.length+' 条 · 当前周冲突 '+p.conflicts.length+' 处</p><p class="muted">CSV 周课表使用学期周次；ICS 重复事件展开为带日期记录。仅确认后保存。可在设置撤销整次导入。</p><div class="import-preview">'+p.items.slice(0,30).map(x=>'<div class="log-item"><strong>'+esc(x.name)+'</strong><span>'+esc(x.date||DAYS[x.day])+' '+esc(x.start)+'–'+esc(x.end)+' '+esc(x.place||'')+'</span></div>').join('')+'</div>'+(p.items.length>30?'<p>仅显示前30条；将导入全部 '+p.items.length+' 条。</p>':'')+'<div id="action-error" role="alert"></div><div class="form-footer"><button class="btn btn-soft" data-close>取消</button><button class="btn btn-dark" id="approve-import" '+(!p.items.length?'disabled':'')+'>确认导入 '+p.items.length+' 条</button></div>')}catch(e){showModal('课表未导入','', '<p role="alert">'+esc(e.message)+'</p><p>请修正文件后重试。当前档案没有变化。</p><button class="btn btn-soft" data-close>返回</button>')}finally{$('#schedule-file').value=''}}
function confirmScheduleImport(){try{const result=applyImport(data,importPreview);save(result.next);closeModal();render();notify('课表已导入并读回核验');navigate('schedule')}catch(e){$('#action-error').textContent=e.message}}
function undoSaved(id){try{save(undoTransaction(data,id));render();notify('已撤销并重新读取核验')}catch(e){notify('撤销失败：'+e.message)}}
function downloadCalendar(){const ics=exportCalendar(data),url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='xiaoya-'+mode+'-calendar.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);notify('已导出未来120天日历；请自行选择日历应用导入和通知权限')}
function openCheckin(id){const g=data.goals.find(x=>x.id===id);if(!g)return;modalContext={goalId:id};showModal('记录一次实际行动','', '<p>'+esc(g.title)+' · 请记录实际发生的行动，不自动打卡。</p><form id="checkin-form" class="form-fields">'+field('行动时间','at',localStamp(new Date()),'datetime-local',true,true)+field('实际分钟（0表示不计时）','minutes',20,'number')+field('行动证据/简述','note','','text',true,true)+'<div class="form-footer wide"><button class="btn btn-dark" type="submit">保存行动记录</button></div></form>')}
function saveCheckin(form){const f=Object.fromEntries(new FormData(form)),at=new Date(f.at),minutes=Number(f.minutes);if(!Number.isFinite(+at)||at>new Date()||!Number.isInteger(minutes)||minutes<0||minutes>1440){notify('请填写已发生的有效时间和0–1440分钟');return}data.checkins.push({id:uid(),goalId:modalContext.goalId,at:at.toISOString(),minutes,note:f.note.trim().slice(0,500)});record('checkin','记录目标行动：'+f.note);if(persistSafely()){closeModal();notify('行动证据已保存；周报重新计算')}}
function quickTask(form){const f=Object.fromEntries(new FormData(form));if(!f.title.trim()||!Number.isFinite(+new Date(f.due)))return;data.tasks.push({id:uid(),title:f.title.trim().slice(0,160),due:f.due,type:'assignment',minutes:30,done:false,createdAt:new Date().toISOString()});record('added','快捷记录：'+f.title);if(persistSafely()){form.reset();notify('事项已保存')}}

