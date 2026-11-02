// Native rendering layer for the mature version's tested, deterministic growth-planner.
import {buildGrowthRoutes,growthStageTasks,commitGrowthRoute,growthRouteProgress,summarizeGrowthWorkload} from '../growth-simulator.js';
export function createGrowthPanel({getData,getMode,replace,refresh,openSheet,closeSheet,notify,esc}){
 let form={goal:'',baseline:'',hours:4,weeks:8},preview=null;
 const fingerprint=()=>JSON.stringify({mode:getMode(),courses:getData().courses,events:getData().events,tasks:getData().tasks,goals:getData().goals});
 const activePlan=()=>preview&&preview.mode===getMode()&&preview.basis===fingerprint()?preview.plan:null;
 function render(){
  const d=getData(),plan=activePlan(),tracked=d.goals.filter(g=>g.growthPlan).map(g=>growthRouteProgress(d,g.id)).filter(Boolean);
  return '<section class="section growth-planner"><div class="section-head"><h2>制定成长路线</h2><small>原版成熟规划器 · 本地规则</small></div>'+
   '<div class="growth-planner-card"><p>给小芽一个目标和每周可投入的时间，生成两条可以执行的路线。只用当前档案估算已登记的负载；选择路线后仍需你确认，才会创建事项。</p>'+
   '<div class="growth-fields"><label>我想实现的目标<input id="growth-goal" maxlength="100" placeholder="例如：从零学 Python" value="'+esc(form.goal)+'"></label>'+
   '<label>我目前的基础<input id="growth-baseline" maxlength="180" placeholder="例如：有一些语法基础" value="'+esc(form.baseline)+'"></label>'+
   '<label>每周投入（小时）<input id="growth-hours" type="number" min="1" max="40" step="1" value="'+esc(form.hours)+'"></label>'+
   '<label>规划周期（周）<input id="growth-weeks" type="number" min="4" max="52" step="1" value="'+esc(form.weeks)+'"></label></div>'+
   '<button id="growth-generate" data-growth-generate type="button" class="primary">生成两条成长路线</button>'+
   '<div id="growth-preview">'+(plan?'<p class="growth-explain">'+esc(plan.explain)+'</p><div class="growth-route-grid">'+plan.routes.map(route=>
    '<article class="growth-route"><div class="growth-route-head"><strong>'+esc(route.name)+'</strong><small>'+esc(plan.domainName)+'</small></div>'+
    '<p>'+esc(route.reason)+'</p><ol>'+route.stages.map(s=>'<li><strong>'+esc(s.title)+' · 第 '+s.startWeek+'–'+s.endWeek+' 周</strong><p>'+esc(s.action)+'</p><small>阶段成果：'+esc(s.deliverable)+'</small></li>').join('')+'</ol><p class="growth-risk">提醒：'+esc(route.risk)+'</p>'+
    '<button class="secondary" type="button" data-growth-route="'+esc(route.id)+'">预览并选择这条路线</button></article>').join('')+'</div>':'')+'</div></div></section>'+
   '<section class="section"><div class="section-head"><h2>正在执行的成长路线</h2></div><div id="growth-active">'+
   (tracked.length?'<div class="group">'+tracked.map(p=>
    '<div class="growth-active-row"><strong>'+esc(p.goal.title)+'</strong><span>'+esc(p.goal.growthPlan.routeName)+' · '+p.done+'/'+p.all+' 项阶段任务已完成</span><small>真实打卡 '+p.recordedMinutes+' 分钟，进度以已完成的事项计算。</small></div>').join('')+'</div>':'')+'</div></section>';
 }
 function generate(){
  form={goal:document.querySelector('#growth-goal')?.value.trim()||'',baseline:document.querySelector('#growth-baseline')?.value.trim()||'',hours:document.querySelector('#growth-hours')?.value||'',weeks:document.querySelector('#growth-weeks')?.value||''};
  try{
   const d=getData(),plan=buildGrowthRoutes({...form,pendingCount:d.tasks.filter(x=>!x.done).length,workload:summarizeGrowthWorkload(d,new Date())});
   preview={plan,mode:getMode(),basis:fingerprint()};refresh();
  }catch(error){notify(error.message)}
 }
 function choose(routeId){
  const plan=activePlan();if(!plan){preview=null;refresh();notify('档案已经变化，请重新生成成长路线');return}
  let tasks;try{tasks=growthStageTasks(plan,routeId,new Date())}catch(error){notify(error.message);return}
  const route=plan.routes.find(r=>r.id===routeId);
  openSheet('确认成长路线','<p class="sheet-note">以下方案由本地规则生成，尚未写入档案。确认后会增加 1 项成长目标和 3 项阶段任务。</p>'+
    '<div class="group">'+tasks.map((t,i)=>'<div class="row"><span class="row-icon">'+(i+1)+'</span><div class="row-main"><strong class="row-title">'+esc(t.title)+'</strong><p class="row-sub">'+esc(route.stages[i].action)+'</p></div><small>'+esc(t.due.slice(0,10))+'</small></div>').join('')+'</div>'+
    '<p class="sheet-note">路线：'+esc(route.name)+'。只有按下“批准并创建”才会保存，你仍可在事项中逐个修改。</p>',
    {type:'growth',routeId,mode:getMode(),basis:preview.basis},{saveLabel:'批准并创建'});
 }
 function approve(context){
  const plan=activePlan();
  if(!plan||context.mode!==getMode()||context.basis!==fingerprint()){notify('档案已经变化，请重新生成后再批准');closeSheet();return}
  try{
   const result=commitGrowthRoute(getData(),plan,context.routeId,new Date(),()=>crypto.randomUUID());
   replace(result.next);preview=null;closeSheet();refresh();notify('已创建 1 项目标与 3 项阶段任务');
  }catch(error){notify(error.message)}
 }
 function handle(t){if(t.matches('[data-growth-generate]')){generate();return true}
  if(t.dataset.growthRoute){choose(t.dataset.growthRoute);return true}
  return false;
 }
 return {render,approve,handle};
}
