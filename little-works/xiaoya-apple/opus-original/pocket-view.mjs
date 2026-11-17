// Projections only: rows refer to existing task IDs; no independent persistence.
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>String(t.due||'').slice(0,16).replace('T',' ');
const stamp=t=>String(t||'');
const byNewest=(field)=>(a,b)=>a.task[field]&&b.task[field]?stamp(b.task[field]).localeCompare(stamp(a.task[field])):a.index-b.index;
export function selectPocketTasks(data,{filter='unscheduled',now=new Date()}={}){
 const items=(data?.tasks||[]).map((task,index)=>({task,index}));
 const today=now instanceof Date?new Date(now.getTime()):new Date(now);
 const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 if(filter==='completed')return [{id:'completed',label:'已完成',tasks:items.filter(x=>x.task.done).sort(byNewest('completedAt')).map(x=>x.task)}];
 if(filter==='deadline'){
  const sorted=items.filter(x=>!x.task.done&&x.task.due).sort((a,b)=>String(a.task.due).localeCompare(String(b.task.due))||a.index-b.index);
  const late=sorted.filter(x=>String(x.task.due).slice(0,10)<todayKey).map(x=>x.task);
  const upcoming=sorted.filter(x=>String(x.task.due).slice(0,10)>=todayKey).map(x=>x.task);
  return [{id:'overdue',label:'已逾期',tasks:late},{id:'upcoming',label:'接下来',tasks:upcoming}];
 }
 return [{id:'unscheduled',label:'待安排',tasks:items.filter(x=>!x.task.done&&!x.task.due).sort(byNewest('createdAt')).map(x=>x.task)}];
}
export function renderPocketView(data,{filter='unscheduled',now=new Date()}={}){
 const groups=selectPocketTasks(data,{filter,now});
 const tasks=data?.tasks||[];
 const count={unscheduled:tasks.filter(t=>!t.done&&!t.due).length,deadline:tasks.filter(t=>!t.done&&t.due).length,completed:tasks.filter(t=>t.done).length};
 const tabs=[['unscheduled','待安排'],['deadline','有截止'],['completed','已完成']].map(([key,title])=>
  '<button type="button" data-pocket-filter="'+key+'" aria-pressed="'+(filter===key)+'">'+title+' <small>'+count[key]+'</small></button>').join('');
 const body=groups.map(g=>g.tasks.length?'<section class="pocket-group"><h2>'+g.label+'</h2><ul>'+g.tasks.map(t=>
  '<li class="pocket-task'+(g.id==='overdue'?' is-overdue':'')+'"><button type="button" class="slip-check" data-toggle-task="'+safe(t.id)+'" aria-label="'+(t.done?'恢复':'完成')+'「'+safe(t.title)+'」"></button>'+
  '<button type="button" class="pocket-task-main" data-pocket-detail="'+safe(t.id)+'"><b>'+safe(t.title)+'</b>'+(t.due?'<small>'+safe(when(t))+(g.id==='overdue'?' · 已逾期':'')+'</small>':'')+'</button><span aria-hidden="true">›</span></li>').join('')+'</ul></section>':'').join('');
 return '<section class="pocket-page" aria-labelledby="pocket-page-title"><header class="pocket-head"><h1 id="pocket-page-title">口袋</h1><button type="button" class="ink-btn" data-pocket-add>+ 记一件事</button></header>'+
  '<div class="pocket-filters" role="group" aria-label="筛选事项">'+tabs+'</div>'+
  (body||'<p class="pocket-empty">先记下一件小事，之后再安排。</p>')+'</section>';
}
