// V4 unified tasks and calendar: DDL notices are never rendered as time-block sessions.
import {DAYS,esc,dueLabel,dueState} from '../core.js';
import {dateKey,weekday,plusDays,occurrences} from '../domain.js';
import {buildDayTimeline} from './timeline.mjs';
import {splitTasksByDeadline,deadlineTasksForDate,overdueTasks} from './items-model.mjs';
const ic=n=>'<svg aria-hidden="true"><use href="#ic-'+n+'"/></svg>';
function taskRow(item){
 return '<div class="v4-task-row" data-item="'+esc(item.id)+'"><button class="circle-check" data-toggle="task" data-id="'+esc(item.id)+'" aria-label="完成 '+esc(item.title)+'"></button>'+
 '<div class="v4-task-copy"><button class="v4-task-name" data-edit="task" data-id="'+esc(item.id)+'">'+esc(item.title)+'</button>'+
 '<small>'+esc(item.course||'待办')+(item.due?' · '+esc(new Date(item.due).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})):' · 无截止日期')+'</small></div>'+
 (item.due?'<span class="v4-task-status '+dueState(item)+'">'+esc(dueLabel(item))+'</span>':'')+'</div>';
}
export function renderItemsView(d,{selectedDate,weekStart,active='schedule',at=new Date()}){
 const {dated,undated}=splitTasksByDeadline(d),date=new Date(selectedDate+'T00:00:00');
 const days=Array.from({length:7},(_,i)=>plusDays(weekStart,i));
 const slots=occurrences(d,date,plusDays(date,1)).sort((a,b)=>a.start.localeCompare(b.start));
 const expires=deadlineTasksForDate(d,selectedDate),overdue=overdueTasks(d,selectedDate);
 const total=dated.length+undated.length;
 let content='';
 if(active==='schedule'){
  content='<div class="v4-week-tools"><div class="calendar-arrow"><button data-action="prev-week" aria-label="上一周">'+ic('left')+'</button>'+
  '<button data-action="now-week" class="v4-week-today">本周</button><button data-action="next-week" aria-label="下一周">'+ic('right')+'</button></div>'+
  '<span>'+esc(days[0].toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}))+' — '+esc(days[6].toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}))+'</span></div>'+
  '<div class="week-rail v4-week-rail">'+days.map(x=>{const stamp=dateKey(x);return '<button class="day-pill '+(stamp===selectedDate?'is-selected ':'')+(stamp===dateKey(at)?'is-today':'')+
   '" data-day="'+stamp+'"><small>'+DAYS[weekday(x)]+'</small><strong>'+x.getDate()+'</strong></button>'}).join('')+'</div>'+
  '<section id="items-date-deadlines" class="v4-items-deadlines"><div class="v4-section-title"><div><h2>'+esc(date.toLocaleDateString('zh-CN',{month:'long',day:'numeric'}))+' · 截止提醒</h2></div><button data-add="task" data-due-date="'+esc(selectedDate)+'">添加截止</button></div>'+
  (expires.length?'<div class="v4-unified-list">'+expires.map(taskRow).join('')+'</div>':'')+
  (overdue.length?'<p class="v4-overdue-note">'+overdue.length+' 件此前逾期的事项仍未完成。<button data-items-tab="inbox">查看待办</button></p>':'')+
  '</section>'+
  '<section class="v4-items-calendar"><div class="v4-section-title"><div><h2>课程与活动</h2></div>'+
  '<div class="v4-calendar-actions"><button data-add="event">添加活动</button><button data-add="course">添加课程</button></div></div>'+
  '<div id="items-schedule" class="calendar-day calendar-day-timeline">'+
  (slots.length?'<div class="v4-schedule-summary" aria-label="当天课程与活动">'+slots.map(session=>
    '<button class="v4-schedule-summary-row" data-edit="'+esc(session.kind)+'" data-id="'+esc(session.id)+'">'+
    '<span class="v4-schedule-summary-time">'+esc(session.start)+'–'+esc(session.end)+'</span>'+
    '<span class="v4-schedule-summary-body"><strong>'+esc(session.name)+'</strong><small>'+esc(session.place||'未设置地点')+'</small></span>'+ic('right')+'</button>').join('')+'</div>'+
  buildDayTimeline(slots,{date:selectedDate,nowDate:at})+
  '<div class="calendar-caption">时间轴可滚动查看全天</div>':
  '<div class="v4-no-schedule"><span aria-hidden="true">'+ic('clock')+'</span><div><strong>这一天暂时没有课程或活动</strong><p>添加课程或活动后，这里会按时间显示。</p></div></div>')+'</div>'+
  '<details class="v4-semantic-note"><summary>截止日期与日程的区别</summary><p>截止日期表示最后期限，不会自动安排学习时段。</p></details>'+
  '<div class="v4-calendar-import"><button data-action="calendar-import">'+ic('archive')+' 导入课表</button><button data-action="export-ics">'+ic('export')+' 导出日历</button></div></section>';
 }else{
  const done=(d.tasks||[]).filter(t=>t.done).slice(-8).reverse();
  content='<section id="items-undated" class="v4-inbox-group"><div class="v4-section-title"><div><h2>独立待办 <span class="v4-inline-count">'+undated.length+'</span></h2></div><button data-add="task">添加待办</button></div>'+
   '<div class="v4-unified-list">'+(undated.length?undated.map(taskRow).join(''):'<p class="v4-list-empty">暂无无期限待办。</p>')+'</div></section>'+
   '<section class="v4-inbox-group"><div class="v4-section-title"><div><h2>有截止日期 <span class="v4-inline-count">'+dated.length+'</span></h2></div></div>'+
   '<div class="v4-unified-list">'+(dated.length?dated.map(taskRow).join(''):'<p class="v4-list-empty">没有待截止的事项。</p>')+'</div></section>'+
   (done.length?'<details class="v4-archive-list"><summary>已完成的事项 · '+done.length+'</summary><div class="v4-unified-list">'+
    done.map(t=>'<div class="v4-done-row" data-item="'+esc(t.id)+'"><button data-toggle="task" data-id="'+esc(t.id)+'" aria-label="恢复任务">'+ic('check')+'</button><span>'+esc(t.title)+'</span></div>').join('')+
    '</div></details>':'');
 }
 return '<div class="v4-items"><header class="page-heading v4-page-heading"><div><h1>事项</h1><p class="v4-subtitle">'+
  total+' 件待办</p></div></header>'+
  '<div class="v4-item-segments" aria-label="事项视图"><button class="'+(active==='schedule'?'is-active':'')+'" data-items-tab="schedule" aria-pressed="'+(active==='schedule')+'">日程</button>'+
  '<button class="'+(active==='inbox'?'is-active':'')+'" data-items-tab="inbox" aria-pressed="'+(active==='inbox')+'">独立待办 <span>'+undated.length+'</span></button></div>'+
  content+'</div>';
}
