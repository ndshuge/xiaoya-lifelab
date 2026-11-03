// The judge-facing V4 home. Pure rendering from the existing, validated local data model.
import {esc,dueLabel,dueState} from '../core.js';
import {buildTodayViewModel} from './dayflow.mjs';

const icon=name=>'<svg aria-hidden="true"><use href="#ic-'+name+'"/></svg>';
const labelDate=value=>new Date(value).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',weekday:'long'});
const isToday=(date,time)=>date===time.toLocaleDateString('sv-SE');

function focusCard(model,at){
 const current=model.nextEvent;
 if(current){
  const isActive=current.isOngoing;
  return '<section class="dayflow-focus" id="dayflow-next" aria-labelledby="dayflow-next-label">'+
    '<div class="dayflow-rail"><span class="dayflow-rail-mark"></span><span id="dayflow-next-label">'+(isActive?'正在进行':'接下来')+'</span><span class="dayflow-rail-time">'+esc(current.start)+' — '+esc(current.end)+'</span></div>'+
    '<div class="dayflow-focus-main"><div class="dayflow-focus-icon">'+icon(current.kind==='course'?'calendar':'clock')+'</div>'+
    '<div class="dayflow-focus-body"><button class="dayflow-focus-title" data-edit="'+esc(current.kind)+'" data-id="'+esc(current.id)+'">'+esc(current.name)+'</button>'+
    '<p>'+esc(current.place||'未设置地点')+' · '+(current.kind==='course'?'课程':'活动')+'</p></div></div>'+
    '<div class="dayflow-focus-bottom"><span>'+model.schedule.length+' 项今日日程</span><button data-view="schedule">查看完整计划 '+icon('right')+'</button></div></section>';
 }
 const next=model.nextUpcoming;
 const upcoming=next?'<span class="dayflow-future-label">下一项安排</span><p class="dayflow-future">'+
   esc(labelDate(next.startsAt))+' · '+esc(next.start)+' '+esc(next.name)+'</p>':'<p class="dayflow-future">还没有登记接下来的课程或活动。</p>';
 const past=model.schedule.length>0;
 return '<section class="dayflow-focus dayflow-focus-open" id="dayflow-next" aria-labelledby="dayflow-next-label">'+
  '<div class="dayflow-rail"><span class="dayflow-rail-mark"></span><span id="dayflow-next-label">今天的日程</span><span class="dayflow-rail-time">'+(past?'全部已结束':'暂无待开始的安排')+'</span></div>'+
  '<div class="dayflow-focus-main"><div class="dayflow-focus-icon">'+icon('calendar')+'</div><div class="dayflow-focus-body">'+
  '<strong class="dayflow-focus-title">'+(past?'今天安排已结束':'今天还没有已安排的课程或活动')+'</strong>'+
  upcoming+'</div></div>'+
  '<div class="dayflow-focus-bottom"><span></span><button data-view="schedule">打开计划 '+icon('right')+'</button></div></section>';
}

function adviceCard(suggestion){
 let content='',controls='';
 if(suggestion){
  content='<strong>'+esc(suggestion.title)+'</strong><p>'+esc(suggestion.description)+'</p>';
  if(suggestion.action)controls='<button class="dayflow-approve" data-suggest="'+esc(suggestion.id)+'">预览安排 '+icon('right')+'</button>'+
    '<button class="dayflow-reject" data-reject="'+esc(suggestion.id)+'">暂时不需要</button>';
  else if(suggestion.kind==='welcome')controls='<button class="dayflow-approve" data-view="schedule">从课表开始 '+icon('right')+'</button>';
  else controls='<button class="dayflow-approve" data-action="pet">和小芽聊聊 '+icon('right')+'</button>';
 }else{
  content='<strong>暂时没有需要调整的安排</strong><p>目前未发现值得提醒的日程冲突。你可以继续安排今天。</p>';
  controls='<button class="dayflow-approve" data-action="pet">和小芽聊聊 '+icon('right')+'</button>';
 }
 return '<section class="dayflow-advice" id="dayflow-suggestion" aria-labelledby="dayflow-advice-title">'+
   '<div class="dayflow-advice-head"><span class="dayflow-sprout">'+icon('growth')+'</span><div><small>本地建议 · 需要你确认</small><h2 id="dayflow-advice-title">小芽的建议</h2></div></div>'+
   '<div class="dayflow-advice-content">'+content+'</div>'+
   '<div class="dayflow-advice-actions">'+controls+'</div></section>';
}

function timeline(model){
 const rows=model.schedule.map(item=>'<li class="dayflow-time-row'+(item.isFinished?' is-finished':'')+(item.isOngoing?' is-current':'')+'">'+
   '<div class="dayflow-hour">'+esc(item.start)+'</div><span class="dayflow-dot"></span>'+
   '<button class="dayflow-time-content" data-edit="'+esc(item.kind)+'" data-id="'+esc(item.id)+'">'+
   '<span class="dayflow-time-name">'+esc(item.name)+'</span>'+
   '<small>'+esc(item.end)+' 结束 · '+esc(item.place||'未设置地点')+'</small></button></li>').join('');
 return '<section class="dayflow-timeline" id="dayflow-today-schedule"><div class="dayflow-section-head"><div>'+
   '<h2>今日日程</h2></div><button data-view="schedule">查看计划 '+icon('right')+'</button></div>'+
   (model.schedule.length?'<ol class="dayflow-timeline-list">'+rows+'</ol>':
     '<div class="dayflow-timeline-empty"><span>'+icon('clock')+'</span><div><strong>今天还没有排入课程或活动</strong>'+
     '<p>有新安排时，再添加到日程。</p></div></div>')+'</section>';
}

function tasks(model){
 const rows=model.tasks.slice(0,4).map(item=>
  '<div class="dayflow-task-row"><button class="circle-check" data-toggle="task" data-id="'+esc(item.id)+'" aria-label="标记完成'+esc(item.title)+'"></button>'+
  '<div class="dayflow-task-main"><button data-edit="task" data-id="'+esc(item.id)+'">'+esc(item.title)+'</button>'+
  '<small>'+esc(item.course||'事项')+(item.due?' · '+esc(labelDate(item.due)):' · 未设置截止')+'</small></div>'+
  '<span class="dayflow-task-due '+dueState(item)+'">'+esc(dueLabel(item))+'</span></div>').join('');
 return '<section class="dayflow-tasks" id="dayflow-pending-tasks"><div class="dayflow-section-head"><div><h2>待办 <span class="dayflow-task-count">'+model.pendingCount+'</span></h2></div>'+
   '<button data-view="tasks">查看全部 '+icon('right')+'</button></div>'+
   (rows?'<div class="dayflow-task-list">'+rows+'</div>':'<div class="dayflow-tasks-empty">目前没有未完成事项。<button data-add="task">新增一项</button></div>')+'</section>';
}

export function renderDayflowToday(data,at=new Date(),{isDemo=false}={}){
 const model=buildTodayViewModel(data,at);
 const date=at.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
 return '<div class="dayflow-home">'+
   '<header class="page-heading dayflow-heading"><div><span class="eyebrow">'+esc(date)+
   (isDemo?' <span class="dayflow-demo-tag">合成演示档案</span>':'')+'</span>'+
   '<h1>今天</h1></div>'+
   '<div class="page-heading-right"><button class="primary" data-action="add-task">'+icon('plus')+' 新增事项</button></div></header>'+
   '<div class="dayflow-overview">'+focusCard(model,at)+adviceCard(model.suggestion)+'</div>'+
   timeline(model)+tasks(model)+'</div>';
}
