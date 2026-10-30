import {createArchive,toggleTask,rejectPlan} from './archive.js';
import {DAYS,esc,uid,emptyStore,suggestions,approve,fmtDate,dueLabel,dueState,detectConflicts} from './core.js';
import {stamp,dateKey,monday,plusDays,occurrences,growth,undoTransaction,exportCalendar,parseSchedule,applyImport,checkSchedule,checkSemester} from './domain.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const archive=createArchive(localStorage,sessionStorage);
let data,scale='day',cursor=new Date(),showFullDay=false,proposal=null,editing=null,openedGarden=false,toastTimer=0,celebrateTimer=0,readBlocked=false;
const pad=n=>String(n).padStart(2,'0'),todayKey=()=>dateKey(new Date()),dstr=d=>d.toLocaleDateString('zh-CN',{month:'long',day:'numeric'}),hms=d=>pad(d.getHours())+':'+pad(d.getMinutes());
const startDay=d=>new Date(dateKey(d)+'T00:00'),hours=d=>d.getHours()*60+d.getMinutes();
function announce(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3200)}
function safeRead(){try{data=archive.read();readBlocked=false;return true}catch(e){readBlocked=true;data=emptyStore();$('#today-summary').textContent=e.message;$('#next-content').textContent='原始数据未修改。请在备份与设置导出原始文件。';return false}}
function commit(next,msg){try{data=archive.write(next);render();if(msg)announce(msg);return true}catch(e){announce('未保存：'+e.message);return false}}
function viewRange(){const d=startDay(cursor);if(scale==='day')return[d,plusDays(d,1)];if(scale==='week')return[monday(d),plusDays(monday(d),7)];if(scale==='month')return[new Date(d.getFullYear(),d.getMonth(),1),new Date(d.getFullYear(),d.getMonth()+1,1)];if(data?.semester?.start&&data?.semester?.end)return[new Date(data.semester.start+'T00:00'),plusDays(new Date(data.semester.end+'T00:00'),1)];return[new Date(d.getFullYear(),d.getMonth(),1),new Date(d.getFullYear(),d.getMonth()+4,1)]}
function inRange(d,a,b){return d>=a&&d<b}
function tasksInRange(a,b){return data.tasks.filter(t=>t.due&&inRange(new Date(t.due),a,b))}
function timeItems(a,b){return occurrences(data,a,b)}
function render(){
 if(!data)return;
 document.documentElement.classList.toggle('no-motion',!!data.settings.reducedMotion);
 $('#mode-banner').hidden=archive.mode!=='demo';
 $('#mode-toggle').textContent=archive.mode==='demo'?'返回私人档案':'载入合成演示';
 $('#weekday').textContent=(scale==='day'?'星期'+['日','一','二','三','四','五','六'][cursor.getDay()]:{week:'这一周',month:'这一月',semester:'本学期'}[scale])+' · '+(archive.mode==='demo'?'合成示例':'私人档案');
 $('#date-stamp').textContent=dstr(cursor);
 $('#current-clock').textContent=hms(new Date());
 const [a,b]=viewRange(),times=timeItems(a,b),dues=tasksInRange(a,b),undone=data.tasks.filter(t=>!t.done);
 const titles={day:dstr(cursor)+'的时间',week:'第 '+(Math.round((+monday(cursor)-+monday(new Date(cursor.getFullYear(),0,1)))/604800000)+1)+' 周',month:cursor.toLocaleDateString('zh-CN',{year:'numeric',month:'long'}),semester:data.semester.name||'学期视野'};
 $('#flow-title').textContent=titles[scale];
 $('#flow-subtitle').textContent=scale==='day'?'课程和活动占用真实时段；作业只标记截止点。':scale==='week'?'按日期把真实安排与截止时间分开。':scale==='month'?'看清课程密度、考试与截止日期。':'只呈现已有记录与真实学期范围。';
 $('#date-title').innerHTML=scale==='day'?'今天，<em>顺着时间生活。</em>':scale==='week'?'这一周，<em>留出呼吸。</em>':scale==='month'?'把一个月，<em>看得清楚。</em>':'时间很长，<em>成长有据。</em>';
 $('#today-summary').textContent=undone.length?'当前档案还有 '+undone.length+' 件未完成事项。没有批准的规划不会自动占用日程。':'没有待完成事项；你可以开始记录一件真实的事。';
 $$('.scale-button').forEach(x=>{const active=x.dataset.scale===scale;x.classList.toggle('selected',active);x.setAttribute('aria-pressed',String(active))});
 renderSurface(a,b,times,dues);renderNext();renderDeadlines();renderInsights();renderPet();if(openedGarden)renderGrowth();
 $('#hide-pet').checked=!!data.settings.hidePet;
 $('#reduced-motion').checked=!!data.settings.reducedMotion;
 $('#quiet-check').checked=!!data.settings.quiet;
 $('#mascot-area').hidden=!!data.settings.hidePet;
}
function renderSurface(a,b,times,dues){
 const node=$('#time-surface');if(scale==='day'){drawDay(node,a,times,dues)}else if(scale==='week'){drawWeek(node,a,times,dues)}else if(scale==='month'){drawMonth(node,a,times,dues)}else drawSemester(node,a,b,times,dues)
}
function drawDay(node,day,events,dues){
 const rowH=matchMedia('(max-width:760px)').matches?52:59,firstHour=(dateKey(day)===todayKey()&&!showFullDay?Math.max(6,Math.min(20,new Date().getHours()-2)):6),lastHour=24;
 const rows=Array.from({length:lastHour-firstHour},(_,i)=>'<div class="time-row"><span class="hour">'+pad(i+firstHour)+':00</span></div>').join('');
 const eventMarkup=events.map(e=>{
  const starts=new Date(e.startsAt),ends=new Date(e.endsAt);
  const start=Math.max(firstHour*60,hours(starts)),finish=Math.min(lastHour*60,hours(ends)+(ends.getDate()!==starts.getDate()?1440:0));
  if(finish<=firstHour*60||start>=lastHour*60)return '';
  const y=(start-firstHour*60)/60*rowH,h=Math.max(44,(finish-start)/60*rowH-3),planned=!!e.taskId||!!e.goalId;
  return '<button class="event-block" data-edit="'+esc(e.kind)+'" data-id="'+esc(e.id)+'" style="top:'+y+'px;height:'+h+'px" data-kind="'+esc(e.kind)+'" data-planned="'+planned+'"><strong>'+esc(e.name)+'</strong><small>'+esc(e.place||'')+(planned?' · 已批准的安排':e.kind==='course'?' · 课程':' · 活动')+'</small><span class="event-time">'+esc(e.start)+'–'+esc(e.end)+'</span></button>'
 }).join('');
 const now=new Date(),live=dateKey(now)===dateKey(day),position=(hours(now)-firstHour*60)/60*rowH;
 const markers=dues.filter(t=>!t.done).map(t=>{const at=new Date(t.due);if(hours(at)<firstHour*60||hours(at)>=lastHour*60)return '';return '<span class="deadline-notch" aria-label="'+esc(t.title)+' 截止 '+esc(t.due)+'" data-time="'+hms(at)+'" style="top:'+((hours(at)-firstHour*60)/60*rowH)+'px"></span>'}).join('');
 const nowMarker=live&&position>=0&&position<(lastHour-firstHour)*rowH?'<div class="now-line" style="top:'+position+'px"></div>':'';
 const past=live&&!showFullDay?events.filter(e=>new Date(e.endsAt)<=new Date(dateKey(day)+'T'+pad(firstHour)+':00')).slice(-3):[];
 const pastRibbon=past.length?'<div class="past-ribbon"><span>今日已过</span>'+past.map(e=>'<button data-edit="'+esc(e.kind)+'" data-id="'+esc(e.id)+'">'+esc(e.start)+'–'+esc(e.end)+' · '+esc(e.name)+'</button>').join('')+'</div>':'';
 node.innerHTML=(dateKey(day)===todayKey()?'<div class="time-context"><span>'+(showFullDay?'全天时间线':'从当前时刻附近开始')+'</span><button id="full-day-toggle" type="button">'+(showFullDay?'回到现在附近':'查看完整一天')+'</button></div>':'')+pastRibbon+'<div class="day-board" style="height:'+((lastHour-firstHour)*rowH)+'px"><div class="river-branch"></div>'+rows+eventMarkup+markers+nowMarker+(events.length===0?'<div class="empty-flow"><strong>这一日，还没有安排。</strong><p>真实课程和活动会沿着时间自然出现。截止事项另列，不会自动变成学习时段。</p><button data-new="course">记录第一节课程</button></div>':'')+'</div>';
}
function drawWeek(node,a,events,dues){
 const now=todayKey();let html='<div class="week-board">';
 for(let i=0;i<7;i++){const day=plusDays(a,i),key=dateKey(day),list=events.filter(e=>e.date===key),deadlines=dues.filter(t=>t.due.slice(0,10)===key);
  html+='<div class="week-column '+(key===now?'today':'')+'"><button class="week-date" data-date="'+key+'">'+DAYS[i]+'<strong>'+day.getDate()+'</strong></button>';
  html+=list.slice(0,6).map(e=>'<button class="week-occurrence '+(e.kind==='event'?'event':'')+'" data-edit="'+esc(e.kind)+'" data-id="'+esc(e.id)+'">'+esc(e.name)+'<small>'+esc(e.start)+'–'+esc(e.end)+'</small></button>').join('');
  if(list.length>6)html+='<small>另有 '+(list.length-6)+' 个时段</small>';
  html+=deadlines.map(t=>'<button class="week-deadline" data-edit="task" data-id="'+esc(t.id)+'">截止：'+esc(t.title)+'</button>').join('')+'</div>';
 }node.innerHTML=html+'</div>'
}
function drawMonth(node,a,events,dues){
 const days=new Date(a.getFullYear(),a.getMonth()+1,0).getDate(),start=(a.getDay()+6)%7;
 let html='<div class="month-board">'+DAYS.map(w=>'<div class="month-weekday">'+w+'</div>').join('');
 const n=Math.ceil((start+days)/7)*7;
 for(let i=0;i<n;i++){const d=i-start+1,key=dateKey(new Date(a.getFullYear(),a.getMonth(),d)),valid=d>=1&&d<=days;
  const list=events.filter(e=>e.date===key),dead=dues.filter(t=>t.due.slice(0,10)===key);
  html+='<button class="month-cell '+(!valid?'outside ':'')+(key===todayKey()?'today':'')+'" data-date="'+key+'"><b>'+d+'</b>'+(list.length?'<small class="dot-activity">'+list.length+' 项安排</small>':'')+(dead.length?'<small class="dot-ddl">'+dead.length+' 项截止</small>':'')+'</button>';
 }node.innerHTML=html+'</div>'
}
function drawSemester(node,a,b,events,dues){
 const dates=[],total=Math.max(1,Math.ceil((b-a)/86400000)),chunks=12;
 for(let i=0;i<chunks;i++){const x=new Date(+a+i*(b-a)/chunks),y=new Date(+a+(i+1)*(b-a)/chunks);dates.push({x,y,count:events.filter(e=>new Date(e.startsAt)>=x&&new Date(e.startsAt)<y).length,ddl:dues.filter(t=>new Date(t.due)>=x&&new Date(t.due)<y).length})}
 const heading=data.semester.start&&data.semester.end?'已记录学期：'+esc(data.semester.start)+' 至 '+esc(data.semester.end):'未设置学期起止日期，暂显示未来约四个月';
 node.innerHTML='<div class="semester-board"><p>'+heading+'</p><div class="semester-stat">'+dues.length+' <small>项截止记录</small></div><div class="semester-track">'+dates.map((x,i)=>'<button class="semester-unit '+(x.count||x.ddl?'has-data':'')+'" data-date="'+dateKey(x.x)+'"><strong>'+pad(i+1)+'</strong><span>'+x.count+' 安排<br>'+x.ddl+' 截止</span></button>').join('')+'</div><div class="semester-notes">'+dues.slice(0,20).map(t=>'<div class="semester-note"><button data-edit="task" data-id="'+esc(t.id)+'">'+esc(t.title)+'<br><small>截止 '+esc(fmtDate(t.due))+'</small></button></div>').join('')+'</div></div>'
}
function renderNext(){
 const now=new Date(),upcoming=timeItems(now,plusDays(now,7)).filter(e=>new Date(e.endsAt)>now);
 const tasks=data.tasks.filter(t=>!t.done&&t.due&&new Date(t.due)>now).map(t=>({kind:'deadline',name:t.title,at:t.due,id:t.id})),events=upcoming.map(e=>({kind:e.kind,name:e.name,at:e.startsAt,id:e.id,end:e.endsAt}));
 const all=[...tasks,...events].sort((a,b)=>new Date(a.at)-new Date(b.at)),next=all[0];const root=$('#next-content');
 root.innerHTML=next?'<span class="next-time">'+esc(fmtDate(next.at))+'</span><div><strong>'+esc(next.name)+'</strong><p>'+(next.kind==='deadline'?'这是截止时间，不是已安排的学习时段。':'真实课程或活动'+(next.end?' · 至 '+esc(hms(new Date(next.end))):''))+'</p></div>':'<div><strong>眼前的时间，属于你。</strong><p>近七天暂无可辨认的下一个事件或截止事项。</p></div>';
}
function renderDeadlines(){
 const tasks=data.tasks.filter(t=>!t.done).sort((a,b)=>((a.due?new Date(a.due).getTime():Infinity)-(b.due?new Date(b.due).getTime():Infinity))),list=$('#deadline-list');
 list.innerHTML=tasks.length?tasks.slice(0,9).map(t=>'<div class="deadline-row"><button class="task-check" data-toggle="'+esc(t.id)+'" aria-label="完成 '+esc(t.title)+'"></button><div class="deadline-detail"><button data-edit="task" data-id="'+esc(t.id)+'">'+esc(t.title)+'</button><p class="'+(dueState(t)==='urgent'||dueState(t)==='overdue'?'due-soon':'')+'">'+esc(t.course||({assignment:'作业',exam:'考试'}[t.type]||'事项'))+' · '+esc(t.due?('截止 '+fmtDate(t.due)+' · '+dueLabel(t)):'无截止时间')+'</p></div></div>').join(''):'<p class="hint-empty">当前没有待完成事项。这里不会凭空生成任务。</p>';
}
function renderInsights(){
 const s=suggestions(data,new Date()),conflicts=detectConflicts(data),ins=$('#insight-content');
 if(conflicts.length&&!s.some(x=>x.kind==='conflict')){} // conflict evidence stays in proposal list
 ins.innerHTML=s.length?s.slice(0,2).map(p=>'<article class="insight-card"><strong>'+esc(p.title)+'</strong><p>'+esc(p.description)+'</p><p class="source-note">'+esc(p.reason)+'</p><div class="insight-actions"><button data-proposal="'+esc(p.id)+'">查看依据与操作</button><button data-reject="'+esc(p.id)+'">拒绝建议</button></div></article>').join(''):'<p class="hint-empty">目前没有需要处理的规则建议。不会自动调整你的课表。</p>';
}
function renderPet(){
 const tip=suggestions(data,new Date())[0],quiet=data.settings.quiet;
 const text=quiet?'正在勿扰':tip?.kind==='deadline'?'留意一件临近截止的事':tip?.kind==='conflict'?'发现真实时段重叠':'安静地陪伴着你';
 $('#mascot-area').dataset.state=quiet?'silent':tip?.kind==='deadline'?'remind':tip?.kind==='conflict'?'care':'idle';
 $('#mascot-state').textContent=text;
 $('#mascot-explanation').textContent=tip?tip.description+' '+tip.reason:'我只读取当前本机档案。建议需要你明确批准，才会改变安排。';
 $('#quiet-toggle').textContent=quiet?'关闭勿扰':'开启勿扰';
}
function renderGrowth(){
 const g=growth(data),active=data.goals;
 $('#garden-markers').innerHTML=active.map(goal=>'<button class="garden-marker" data-goal="'+esc(goal.id)+'"><strong>'+esc(goal.title)+'</strong><small>'+data.checkins.filter(c=>c.goalId===goal.id).length+' 次真实行动记录</small></button>').join('')||( '<p class="garden-marker">还没有目标记录。小庭院不会生成虚假的进度与照片。</p>');
 $('#growth-records').innerHTML='<div class="growth-entry"><strong>'+g.current.done+' 项</strong><p>本周实际完成事项</p></div><div class="growth-entry"><strong>'+g.current.minutes+' 分钟</strong><p>本周真实记录的目标行动时间</p></div>'+active.map(goal=>'<div class="growth-entry"><strong>'+esc(goal.title)+'</strong><p>'+esc(goal.target||'还没有填写行动里程碑')+'</p><button class="text-control" data-checkin="'+esc(goal.id)+'">记录真实行动</button> · <button class="text-control" data-edit="goal" data-id="'+esc(goal.id)+'">编辑目标</button></div>').join('');
}
function setScale(next){if(!['day','week','month','semester'].includes(next))return;scale=next;const surface=$('#time-surface');surface.classList.add('is-changing');render();setTimeout(()=>surface.classList.remove('is-changing'),190)}
function shift(n){let d=new Date(cursor);if(scale==='day')d.setDate(d.getDate()+n);else if(scale==='week')d.setDate(d.getDate()+7*n);else if(scale==='month')d.setMonth(d.getMonth()+n);else d.setMonth(d.getMonth()+n*4);cursor=d;render()}
function showDialog(node){if(!node.open)node.showModal()}
function hideDialog(node){if(node.open)node.close()}
function fields(kind,item={}){
 const date=(item.due||stamp(plusDays(new Date(),1))),time=(label,name,val)=>'<div class="field"><label for="'+name+'">'+label+'</label><input type="time" name="'+name+'" id="'+name+'" value="'+esc(val)+'" required></div>';
 if(kind==='task')return '<div class="field"><label for="entry-due">实际截止时间（并非学习安排）</label><input id="entry-due" name="due" type="datetime-local" value="'+esc(date)+'" required></div><div class="two-fields"><div class="field"><label for="entry-type">类型</label><select name="type" id="entry-type"><option value="assignment">作业</option><option value="exam">考试</option><option value="task">其他</option></select></div><div class="field"><label for="entry-minutes">预计用时（分钟）</label><input type="number" id="entry-minutes" name="minutes" min="1" max="1200" value="'+(Number(item.minutes)||30)+'"></div></div><div class="field"><label for="entry-course">关联课程（选填）</label><input id="entry-course" name="course" value="'+esc(item.course||'')+'"></div>';
 if(kind==='goal')return '<div class="field"><label for="entry-target">可验证目标（可留空）</label><input name="target" id="entry-target" value="'+esc(item.target||'')+'"></div><div class="field"><label for="entry-category">分类</label><input name="category" id="entry-category" value="'+esc(item.category||'个人成长')+'"></div>';
 return '<div class="two-fields"><div class="field"><label for="entry-day">每周星期</label><select id="entry-day" name="day">'+DAYS.map((name,i)=>'<option value="'+i+'" '+(Number(item.day??(new Date().getDay()+6)%7)===i?'selected':'')+'>'+name+'</option>').join('')+'</select></div><div class="field"><label for="entry-date">单次日期（选填）</label><input type="date" id="entry-date" name="date" value="'+esc(item.date||'')+'"></div></div><div class="two-fields">'+time('开始','start',item.start||'09:00')+time('结束','end',item.end||'10:00')+'</div><div class="field"><label for="entry-place">地点</label><input name="place" id="entry-place" value="'+esc(item.place||'')+'"></div><p>高级周次、单双周、调课和例外设置可在原版完整管理中调整。</p>';
}
function openEditor(kind='task',id=''){
 const k={task:'tasks',course:'courses',event:'events',goal:'goals'}[kind];if(!k)return;
 const item=data[k].find(x=>x.id===id)||{};
 editing={kind,id,original:JSON.stringify(item)};
 $('#kind').value=kind;$('#kind').disabled=!!id;$('#entry-title').value=item.title||item.name||'';$('#editor-fields').innerHTML=fields(kind,item);
 if(kind==='task')$('#entry-type').value=item.type||'assignment';
 $('#editor-heading').textContent=(id?'编辑':'记录')+({task:'事项',course:'课程',event:'活动',goal:'目标'}[kind]);
 $('#editor-error').textContent='';showDialog($('#editor-dialog'));$('#entry-title').focus();
}
function saveEditor(e){
 e.preventDefault();const kind=editing?.kind||$('#kind').value,id=editing?.id||'',key={task:'tasks',course:'courses',event:'events',goal:'goals'}[kind];if(!key)return;
 const values=Object.fromEntries(new FormData($('#editor-form')).entries()),title=String(values.title||'').trim();if(!title)return $('#editor-error').textContent='请输入名称。';
 const next=structuredClone(data),prior=next[key].find(x=>x.id===id)||{},now=new Date().toISOString();
 let value={...prior,id:id||uid(),createdAt:prior.createdAt||now};
 try{
 if(kind==='task'){const date=String(values.due||'');if(!Number.isFinite(+new Date(date)))throw Error('截止时间无效');Object.assign(value,{title,type:values.type||'assignment',due:date,course:values.course||'',minutes:Math.max(1,Math.min(1200,Number(values.minutes)||30)),done:prior.done||false})}
 else if(kind==='goal'){Object.assign(value,{title,category:values.category||'',target:values.target||'',done:prior.done||false})}
 else{Object.assign(value,{name:title,day:Number(values.day),date:values.date||'',start:values.start,end:values.end,place:values.place||'',weekStart:Number(prior.weekStart)||1,weekEnd:Number(prior.weekEnd)||54,parity:prior.parity||'all',exceptions:prior.exceptions||[]});checkSchedule(value)}
 const ix=next[key].findIndex(x=>x.id===value.id);if(ix<0)next[key].push(value);else next[key][ix]=value;
 next.history.unshift({id:uid(),at:now,action:id?'edited':'created',description:(id?'编辑：':'新增：')+title});
 if(commit(next,'已保存到当前'+(archive.mode==='demo'?'演示':'私人')+'档案'))hideDialog($('#editor-dialog'));
 }catch(error){$('#editor-error').textContent=error.message}
}
function showProposal(id){
 const p=suggestions(data).find(x=>x.id===id);if(!p)return announce('建议已变化，请刷新');
 proposal=p;$('#review-heading').textContent=p.title;$('#review-error').textContent='';
 const source=p.sources.map(s=>{const obj=[...data.tasks,...data.courses,...data.events,...data.goals].find(x=>x.id===s.id);return '<li>'+esc(obj?.title||obj?.name||'原始记录可能已变化')+'</li>'}).join('');
 const actions=p.action?(p.action.steps||[{start:p.action.start,end:p.action.end}]).map((x,i)=>'<div class="two-fields"><div class="field"><label>预定开始</label><input type="datetime-local" data-plan-start="'+i+'" value="'+esc(x.start)+'"></div><div class="field"><label>预定结束</label><input type="datetime-local" data-plan-end="'+i+'" value="'+esc(x.end)+'"></div></div>').join(''):'<p>暂无可批准的行动，只能查看来源。</p>';
 $('#review-content').innerHTML='<p>'+esc(p.description)+'</p><p>'+esc(p.reason)+'</p><p class="mini-label">可追溯来源</p><ul>'+source+'</ul>'+actions+'<p>只有明确按下批准，才创建计划并检查冲突；拒绝不会修改已有课程。</p><div class="sheet-actions"><button class="subtle-btn" id="reject-now">拒绝建议</button>'+(p.action?'<button class="dark-button" id="approve-now">批准并执行</button>':'')+'</div>';
 showDialog($('#review-dialog'))
}
function rejectCurrent(id){const p=proposal?.id===id?proposal:suggestions(data).find(x=>x.id===id);if(!p)return;try{if(commit(rejectPlan(data,p),'已记录拒绝，不会再重复该建议'))hideDialog($('#review-dialog'))}catch(e){$('#review-error').textContent=e.message}}
function approveCurrent(){
 if(!proposal||!proposal.action)return;
 const action=structuredClone(proposal.action),steps=action.steps||[{start:action.start,end:action.end}];
 steps.forEach((step,i)=>{step.start=$('[data-plan-start="'+i+'"]').value;step.end=$('[data-plan-end="'+i+'"]').value});
 if(action.steps)action.steps=steps;else{action.start=steps[0].start;action.end=steps[0].end}
 try{
  const r=approve(data,{...proposal,action});if(commit(r.next,'已批准并存入真实日程，可在事务中撤销')){
   const verified=data.transactions.some(x=>x.id===r.transaction.id);
   if(!verified)throw Error('写入后事务验证失败');
   hideDialog($('#review-dialog'));scale='day';cursor=new Date(steps[0].start);render();
   pulsePet();
  }
 }catch(e){$('#review-error').textContent='未执行：'+e.message}
}
function undoLast(){
 const tx=[...data.transactions].reverse().find(x=>x.status==='executed');if(!tx)return announce('当前没有可撤销的事务');
 try{if(confirm('撤销最近一次操作：'+tx.title+'？'))commit(undoTransaction(data,tx.id),'已撤销最近一次事务')}catch(e){announce(e.message)}
}
function toggleGarden(force){
 openedGarden=typeof force==='boolean'?force:!openedGarden;$('#growth-area').hidden=!openedGarden;
 $('#growth-toggle').textContent=openedGarden?'收起庭院':'成长庭院';
 if(openedGarden){renderGrowth();$('#growth-area').scrollIntoView({behavior:motionOK()?'smooth':'instant'})}
}
function pulsePet(){if(data.settings.quiet||data.settings.hidePet)return;let p=$('#mascot-area');p.classList.add('is-celebrating');p.dataset.state='celebrate';clearTimeout(celebrateTimer);celebrateTimer=setTimeout(()=>{p.classList.remove('is-celebrating');renderPet()},650)}
function motionOK(){return !data.settings.reducedMotion&&!matchMedia('(prefers-reduced-motion:reduce)').matches}
function openTools(){if(readBlocked)$('#tools-dialog').showModal();else showDialog($('#tools-dialog'))}
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function exportJSON(){const raw=archive.exportRaw();const text=raw===null?JSON.stringify(data,null,2):raw;download(new Blob([text],{type:'application/json;charset=utf-8'}),'xiaoya-'+archive.mode+'-'+todayKey()+'.json');announce('已导出当前档案；私人数据不会自动上传')}
async function importJSON(file){if(!file)return;try{const {validateStore}=await import('./core.js');const d=validateStore(JSON.parse(await file.text()));if(!confirm('确认用导入文件覆盖当前'+(archive.mode==='demo'?'演示':'私人')+'档案吗？建议先导出备份。'))return;if(readBlocked){if(!confirm('当前档案读取损坏。继续将先在当前浏览器保留一份隔离原始备份，再导入已验证的档案。确定恢复？'))return;const result=archive.restoreValidated(d,true);readBlocked=false;data=archive.read();render();announce('档案已恢复；原始损坏内容保存在本机隔离备份 '+result.backupKey)}else commit(d,'档案导入成功')}catch(e){announce('导入失败：'+e.message)}finally{$('#json-file').value=''}}
async function importSchedule(file){if(!file)return;try{const preview=parseSchedule(await file.text(),file.name,data);if(!confirm('课表导入预览：'+preview.items.length+' 个时段、'+preview.duplicates.length+' 个重复、'+preview.conflicts.length+' 个潜在冲突。确认写入？'))return;commit(applyImport(data,preview).next,'课表已导入')}catch(e){announce('课表导入失败：'+e.message)}finally{$('#schedule-file').value=''}}
function setPreference(key,value){let next=structuredClone(data);next.settings[key]=value;commit(next,'设置已保存在本机')}
function checkin(id){
 const goal=data.goals.find(x=>x.id===id);if(!goal)return;
 const mins=prompt('记录「'+goal.title+'」的实际行动分钟数（1–1440）：','20');if(mins===null)return;
 const n=Number(mins);if(!Number.isInteger(n)||n<1||n>1440)return announce('行动分钟数必须是 1–1440 的整数');
 const note=prompt('可选：这次具体做了什么？','')||'';
 const next=structuredClone(data);next.checkins.push({id:uid(),goalId:id,at:new Date().toISOString(),minutes:n,note:note.slice(0,300)});next.history.unshift({id:uid(),at:new Date().toISOString(),action:'checkin',description:'目标行动：'+goal.title+'，'+n+'分钟'});
 commit(next,'已保存真实行动记录');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.scale)return setScale(b.dataset.scale);
 if(b.id==='full-day-toggle'){showFullDay=!showFullDay;render();return}if(b.id==='prev')return shift(-1);if(b.id==='next')return shift(1);if(b.id==='today'){cursor=new Date();render();return}
 if(b.dataset.date){cursor=new Date(b.dataset.date+'T12:00');return setScale('day')}
 if(b.id==='mode-toggle'){try{data=archive.switchMode(archive.mode==='demo'?'personal':'demo');cursor=new Date();render();announce(archive.mode==='demo'?'合成演示，与私人档案隔离':'已回到私人档案')}catch(err){announce(err.message)}return}
 if(b.id==='create-top'||b.id==='mobile-add'||b.dataset.new){openEditor(b.dataset.new||'task');return}
 if(b.dataset.edit){openEditor(b.dataset.edit,b.dataset.id);return}
 if(b.dataset.toggle){try{if(commit(toggleTask(data,b.dataset.toggle),'完成状态已保存'))pulsePet()}catch(err){announce(err.message)}return}
 if(b.dataset.proposal){showProposal(b.dataset.proposal);return}
 if(b.dataset.reject){rejectCurrent(b.dataset.reject);return}
 if(b.id==='reject-now'){rejectCurrent(proposal?.id);return}
 if(b.id==='approve-now'){approveCurrent();return}
 if(b.dataset.checkin){checkin(b.dataset.checkin);return}
 if(b.dataset.goal){toggleGarden(true);return}
 if(b.dataset.close!==undefined){hideDialog(b.closest('dialog'));return}
 if(b.id==='growth-toggle'||b.id==='mobile-growth'){toggleGarden();return}
 if(b.id==='mobile-time'){openedGarden=false;$('#growth-area').hidden=true;window.scrollTo({top:0,behavior:motionOK()?'smooth':'instant'});return}
 if(b.id==='mobile-advice'){$('#insight').scrollIntoView({behavior:motionOK()?'smooth':'instant'});return}
 if(b.id==='archive-tools'||b.id==='mobile-tools'){openTools();return}
 if(b.id==='mascot-button'){const el=$('#mascot-detail');el.hidden=!el.hidden;b.setAttribute('aria-expanded',String(!el.hidden));return}
 if(b.id==='quiet-toggle'){setPreference('quiet',!data.settings.quiet);return}
 if(b.id==='pet-hide'){setPreference('hidePet',true);return}
 if(b.id==='export-json'){exportJSON();return}
 if(b.id==='export-ics'){download(new Blob([exportCalendar(data)],{type:'text/calendar;charset=utf-8'}),'xiaoya-calendar.ics');return}
 if(b.id==='import-json'){$('#json-file').click();return}
 if(b.id==='import-schedule'){$('#schedule-file').click();return}
 if(b.id==='undo-last'){undoLast();return}
});
$('#editor-form').addEventListener('submit',saveEditor);
$('#kind').addEventListener('change',e=>{if(!editing?.id){editing={kind:e.target.value,id:''};$('#editor-fields').innerHTML=fields(e.target.value)}});
$('#json-file').addEventListener('change',e=>importJSON(e.target.files[0]));
$('#schedule-file').addEventListener('change',e=>importSchedule(e.target.files[0]));
$('#quiet-check').addEventListener('change',e=>setPreference('quiet',e.target.checked));
$('#hide-pet').addEventListener('change',e=>setPreference('hidePet',e.target.checked));
$('#reduced-motion').addEventListener('change',e=>setPreference('reducedMotion',e.target.checked));
window.addEventListener('storage',e=>{if(e.key==='xiaoya:personal:v1'||e.key==='xiaoya:synthetic-demo:v1'){if(safeRead()){render();announce('已读取另一标签页的最新档案')}else announce('存储读取失败，停止写入')}});
window.addEventListener('resize',()=>{if(scale==='day'&&data)renderSurface(...viewRange(),timeItems(...viewRange()),tasksInRange(...viewRange()))});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){for(const x of $$('dialog[open]'))x.close()}if(e.key==='n'&&(e.ctrlKey||e.metaKey)&&!e.target.closest('input,textarea')){e.preventDefault();openEditor('task')}});
function start(){safeRead();if(!readBlocked){render()}else {$('#flow-title').textContent='档案保护中';$('#time-surface').innerHTML='<div class="empty-flow"><strong>存储暂时无法读取</strong><p>我们不会覆盖原始记录。打开“备份与设置”可导出原始数据后恢复。</p><button id="archive-tools">备份与设置</button></div>'}
 $('#current-clock').textContent=hms(new Date());setInterval(()=>{$('#current-clock').textContent=hms(new Date())},60000)}
start();
