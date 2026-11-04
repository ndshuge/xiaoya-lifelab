// Xiaoya UI adapter: behavior follows the already-published VNext design.
// All context is local unless user explicitly requests coarse city weather or BYOK model planning.
import {createStudentAgentController} from '../student-agent.js';
import {createAdaptiveGrowthController} from '../adaptive-growth-agent.js';
import {createGrowthChatProvider} from '../adaptive-growth-provider.js';
import {buildContextSnapshot,buildContextualSuggestions} from '../context-agent.js';
import {createContextActionController} from '../context-actions.js';
import {fetchCityForecast} from '../weather-forecast.js';
import {occurrences,plusDays,dateKey} from '../domain.js';

const CITIES=Object.freeze([
 {id:'xian',name:'西安',latitude:34.3,longitude:108.9},
 {id:'fuzhou',name:'福州',latitude:26.1,longitude:119.3},
 {id:'ningde',name:'宁德',latitude:26.7,longitude:119.5},
 {id:'beijing',name:'北京',latitude:39.9,longitude:116.4},
 {id:'shanghai',name:'上海',latitude:31.2,longitude:121.5},
 {id:'tokyo',name:'东京',latitude:35.7,longitude:139.7}
]);
const PROVIDERS=Object.freeze([
 ['https://api.deepseek.com/chat/completions','DeepSeek'],
 ['https://api.openai.com/v1/chat/completions','OpenAI'],
 ['https://open.bigmodel.cn/api/paas/v4/chat/completions','智谱 GLM'],
 ['https://api.siliconflow.cn/v1/chat/completions','硅基流动'],
 ['https://openrouter.ai/api/v1/chat/completions','OpenRouter']
]);
const short=v=>String(v??'').slice(0,280);
const action=(label,name,attrs='',kind='')=>'<button type="button" class="xy-agent-action '+kind+'" data-agent-action="'+name+'" '+attrs+'>'+label+'</button>';
export function createAgentBridge({getData,persist,getJournalEntries,getMode,openSheet,closeSheet,notify,refresh,esc}){
 // Intentionally session-only: no durable private consent, coarse location or model key.
 const flags={weather:false,mood:false,weatherToModel:false,weatherCityId:''};
 let weather=null,city=null,plan=null,planRevision=null,modelProvider=null,modelAuthorized=false,preview=null,lastTransaction=null,busy=false,generation=0;
 const student=createStudentAgentController({getData,persist,clock:()=>new Date()});
 const growth=()=>createAdaptiveGrowthController({getData,persist,clock:()=>new Date(),
  provider:modelProvider,authorized:modelAuthorized&&!!modelProvider});
 const context=()=>buildContextSnapshot(getData(),{now:new Date(),consents:flags,
  journalEntries:flags.mood?getJournalEntries():[],weatherSnapshot:flags.weather?weather:null});
 const contextActions=createContextActionController({getData,getContext:context,persist,clock:()=>new Date()});
 const e=v=>esc(short(v));
 const note=s=>'<p class="xy-agent-note">'+e(s)+'</p>';
 const header=(title,label)=>'<div class="xy-agent-head"><h2>'+e(title)+'</h2><small>'+e(label)+'</small></div>';
 const row=(s,controls='')=>'<div class="xy-agent-row"><div class="xy-agent-text"><strong>'+e(s.title)+'</strong><p>'+e(s.description)+'</p>'+
  '<details><summary>依据和说明</summary>'+note(s.reason||'基于已授权的结构化记录')+'</details></div>'+
  (controls?'<div class="xy-agent-controls">'+controls+'</div>':'')+'</div>';
 const hint=(title,text)=>'<div class="xy-agent-empty"><strong>'+e(title)+'</strong>'+note(text)+'</div>';
 const undo=()=>lastTransaction?action('撤销刚才的执行','undo','','quiet'):'';
 function today(){
  let feed,extras=[];
  try{feed=student.feed();extras=buildContextualSuggestions(context())}
  catch(error){feed={candidates:[],summary:error.message}}
  const shortlist=[...extras.map(s=>({...s,from:'context'})),
   ...feed.candidates.map(s=>({...s,from:'student'}))].slice(0,5);
  const primary=shortlist[0];
  const controls=s=>s.from==='context'
    ?(s.kind==='outdoor-weather'?action('准备事项','preview-weather','data-agent-id="'+esc(s.id)+'"'):'')
    :(s.action?action('预览安排','preview-student','data-agent-id="'+esc(s.id)+'"'):'');
  const later=shortlist.slice(1);
  const content=primary?row(primary,controls(primary)):
   hint('目前没有需要主动调整的安排','补充课程、待办与目标后，小芽才能给出有依据的建议。');
  const more=later.length?'<details class="xy-agent-more"><summary>其他提醒 · '+later.length+' 条</summary>'+
   later.map(s=>row(s,controls(s))).join('')+'</details>':'';
  const choices=primary?.from==='student'?
   '<details class="xy-agent-more"><summary>这条建议的其他操作</summary><div class="xy-agent-footer">'+
    action('稍后再看','snooze','data-agent-id="'+esc(primary.id)+'"','quiet')+
    action('不再提醒','reject','data-agent-id="'+esc(primary.id)+'"','quiet')+'</div></details>':'';
  return '<section class="dayflow-advice xy-agent-section" id="dayflow-suggestion">'+
    '<div id="xy-student-agent">'+header('小芽的建议','本地规则 · 需要批准')+
    content+more+choices+(undo()?'<div class="xy-agent-footer">'+undo()+'</div>':'')+
    '<div class="dayflow-advice-actions"><button data-action="pet" type="button">和小芽聊聊</button></div></div></section>';
 }
 function items(){
  let suggestions=[];try{suggestions=student.feed().candidates.filter(c=>c.action).slice(0,2)}catch{}
  return '<section class="xy-agent-section xy-agent-secondary" id="xy-items-agent">'+
   header('可安排的建议','执行前会预览')+
   (suggestions.length?suggestions.map(s=>row(s,action('预览安排','preview-student','data-agent-id="'+esc(s.id)+'"'))).join(''):
    note('当前没有需要额外安排的待办。'))+
   (undo()?'<div class="xy-agent-footer">'+undo()+'</div>':'')+'</section>';
 }
 function develop(){
  if(plan&&planRevision!==getData().revision){plan=null;planRevision=null}
  const goals=getData().goals.filter(g=>!g.done);
  let details=goals.length?'<div class="xy-agent-footer">'+action('分析未来四周','growth-analyze')+
   action('使用模型选择路线','model-config','','quiet')+'</div>':
   note('先建立一个具体目标并设置每周行动次数。');
  if(plan){
   details+='<p class="xy-agent-note">'+(plan.modelUsed?'已授权模型选择路线':'本地规则路线')+' · '+e(plan.notice)+'</p>';
   details+=plan.goals.map(g=>{
    const choice=g.choices.find(x=>x.id===g.selectedRouteId);
    const weeks=g.weeks.map((w,i)=>'<span>第'+(i+1)+'周 '+w.plannedActions+'次</span>').join(' · ');
    return row({title:g.title+' · '+(choice?.name||''),description:weeks,reason:g.modelReason||g.reason},
     action('预览本周行动','growth-preview','data-agent-id="'+esc(g.id)+'"'));
   }).join('');
  }
  if(modelProvider)details+='<div class="xy-agent-footer">'+action('断开本次模型','model-disconnect','','quiet')+'</div>';
  if(undo())details+='<div class="xy-agent-footer">'+undo()+'</div>';
  return '<section class="xy-agent-section" id="xy-growth-agent">'+header('每周节奏','根据真实行动调整')+details+'</section>';
 }
 function settings(){
  return '<section class="xy-agent-section" id="xy-agent-settings">'+header('情境与授权','默认关闭 · 仅本次页面')+
   note('城市由你手动选择，不读取 GPS。天气仅在授权后点击“获取预报”时访问 Open-Meteo；心情只用于本地建议，日记正文永不自动发送。')+
   '<label class="xy-agent-field">城市<select id="xy-agent-city"><option value="">不使用天气</option>'+
   CITIES.map(c=>'<option value="'+c.id+'" '+(city?.id===c.id?'selected':'')+'>'+e(c.name)+'</option>').join('')+'</select></label>'+
   '<label class="xy-agent-check"><input type="checkbox" id="xy-agent-weather-consent" '+(flags.weather?'checked':'')+'>我允许本次获取所选城市的短期天气</label>'+
   '<label class="xy-agent-check"><input type="checkbox" id="xy-agent-mood-consent" '+(flags.mood?'checked':'')+'>我允许小芽在本地结合今天主动保存的心情</label>'+
   '<div class="xy-agent-footer">'+action('保存本次授权','settings-apply')+
   action('获取预报','weather-fetch')+action('全部撤销','settings-revoke','','quiet')+'</div>'+
   note(weather&&flags.weather?'Open-Meteo · '+weather.cityLabel+' · 更新于 '+new Date(weather.fetchedAt).toLocaleString('zh-CN'):
    '未获取天气；未授权时不发网络请求。')+
   '<p class="xy-agent-note">天气数据来源 <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>，免费 API 仅适用于非商业用途。每日最大降水概率不代表活动时段必然降雨。</p>'+
   '</section>';
 }
 function render(view,root){
  root.querySelectorAll('.xy-agent-section').forEach(el=>el.remove());
  let section=null,html='';
  if(view==='today'){section=root.querySelector('#dayflow-suggestion');html=today()}
  if(view==='items'){section=root.querySelector('.v4-item-segments')||root.querySelector('.page-heading');html=items()}
  if(view==='develop'){section=root.querySelector('[data-develop-panel="goals"] .v4-goals-section');html=develop()}
  if(view==='settings'){section=root.querySelector('.v4-settings-extra')||root.lastElementChild;html=settings()}
  if(!section||!html)return;
  const box=document.createElement('div');box.innerHTML=html;
  const node=box.firstElementChild;
  if(view==='today')section.replaceWith(node);
  else if(view==='develop')section.append(node);
  else section.insertAdjacentElement('afterend',node);
 }
 const previewHtml=(title,description,reason,actionDetails)=>
  '<div class="xy-agent-approval"><strong>'+e(title)+'</strong>'+note(description)+
   '<details open><summary>依据与影响</summary>'+note(reason)+'</details>'+note(actionDetails)+
   '<p class="xy-agent-note">不会修改课程或截止日期；只有点击批准才会写入本地档案。</p>'+
   '<div class="xy-agent-footer">'+action('批准并执行','approve','', 'strong')+action('取消','preview-cancel','','quiet')+'</div></div>';
 function showPreview(type,value,title,description,reason,impact){
  preview={type,value};openSheet('确认小芽的建议',previewHtml(title,description,reason,impact),
   {type:'agent-preview'},{hideSave:true});
 }
 function forgetWeather(){weather=null;city=null;flags.weather=false;flags.weatherCityId='';flags.weatherToModel=false}
 function resetForMode(){generation++;forgetWeather();flags.mood=false;modelProvider?.clear();modelProvider=null;modelAuthorized=false;plan=null;planRevision=null;preview=null;lastTransaction=null;busy=false}
 function requestRender(message){refresh();if(message)notify(message)}
 async function analyzeGrowth(){
  if(busy)return;busy=true;const ticket=generation,mode=getMode();
  try{const result=await growth().analyze({weeks:4});if(ticket!==generation||mode!==getMode())return;
   plan=result;planRevision=getData().revision;requestRender(plan.modelUsed?'模型已选择四周路线':'已生成本地四周路线')}
  catch(error){notify(error.message)}finally{busy=false}
 }
 async function fetchWeather(){
  if(busy)return;
  if(!flags.weather||!city){notify('请先选择城市并保存天气授权');return}
  busy=true;const ticket=generation,mode=getMode(),cityId=city.id;
  try{const result=await fetchCityForecast({city,authorized:true});if(ticket!==generation||mode!==getMode()||!flags.weather||city?.id!==cityId)return;
   weather=result;requestRender('天气已更新 · Open-Meteo')}
  catch(error){weather=null;requestRender(error.message)}finally{busy=false}
 }
 function modelConfig(){
  openSheet('授权成长路线分析',
   note('仅在你点击“生成四周成长路线”时发送有限的目标名称、行动次数和任务负担摘要；不发送日记、心情或原始课表，不自动收费调用。Key 仅存于本标签页内存。')+
   '<label class="xy-agent-field">服务商<select id="xy-model-provider">'+PROVIDERS.map(([value,name])=>'<option value="'+value+'">'+e(name)+'</option>').join('')+'</select></label>'+
   '<label class="xy-agent-field">模型 ID<input id="xy-model-id" maxlength="120" placeholder="例如 deepseek-chat" autocomplete="off"></label>'+
   '<label class="xy-agent-field">API Key<input id="xy-model-key" type="password" autocomplete="off"></label>'+
   '<label class="xy-agent-check"><input id="xy-model-consent" type="checkbox">我本次明确同意向该服务商发送成长目标摘要，理解可能产生费用</label>'+
   '<div class="xy-agent-footer">'+action('本次连接','model-connect')+action('取消','preview-cancel','','quiet')+'</div>',
   {type:'agent-model-config'},{hideSave:true});
 }
 function act(name,t){
  try{
   if(name==='settings-apply'){
    const selected=document.querySelector('#xy-agent-city')?.value||'';
    const selectedCity=CITIES.find(c=>c.id===selected)||null;
    const allow=!!document.querySelector('#xy-agent-weather-consent')?.checked;
    flags.mood=!!document.querySelector('#xy-agent-mood-consent')?.checked;
    if(!allow||!selectedCity){generation++;forgetWeather()}
    else{if(city?.id!==selectedCity.id){generation++;weather=null}city=selectedCity;flags.weather=true;flags.weatherCityId=city.id}
    requestRender('本次授权已更新');return;
   }
   if(name==='settings-revoke'){generation++;forgetWeather();flags.mood=false;modelProvider?.clear();modelProvider=null;modelAuthorized=false;plan=null;requestRender('授权已撤销');return}
   if(name==='weather-fetch'){void fetchWeather();return}
   if(name==='growth-analyze'){void analyzeGrowth();return}
   if(name==='model-config'){modelConfig();return}
   if(name==='model-disconnect'){generation++;modelProvider?.clear();modelProvider=null;modelAuthorized=false;plan=null;requestRender('模型已断开，密钥已从内存清除');return}
   if(name==='model-connect'){
    if(!document.querySelector('#xy-model-consent')?.checked)throw Error('请先明确同意本次目标摘要发送');
    const endpoint=document.querySelector('#xy-model-provider')?.value;
    const model=document.querySelector('#xy-model-id')?.value.trim();
    const apiKey=document.querySelector('#xy-model-key')?.value.trim();
    const created=createGrowthChatProvider({endpoint,model,apiKey});
    modelProvider?.clear();modelProvider=created;modelAuthorized=true;plan=null;
    document.querySelector('#xy-model-key').value='';closeSheet();requestRender('模型已就绪；尚未发送成长资料');return;
   }
   if(name==='preview-student'){
    const item=student.preview(t.dataset.agentId);
    showPreview('student',item,item.title,item.description,item.reason,
      '将在现有事项系统中安排一个可撤销的行动。');return;
   }
   if(name==='preview-weather'){
    const item=contextActions.preview(t.dataset.agentId);
    showPreview('weather',item,item.task.title,'根据有效天气预报创建一件准备待办',item.reason,
      '新增任务：'+item.task.title+'；截止 '+item.task.due);return;
   }
   if(name==='growth-preview'){
    if(!plan)throw Error('请先生成最新成长规划');
    const item=growth().preview(plan,t.dataset.agentId);
    showPreview('growth',item,'为成长目标安排一个行动','仅安排当前周一次真实行动，不预写未来周。',item.reason,
      '将添加 '+item.action.minutes+' 分钟目标行动，可在事项里查看。');return;
   }
   if(name==='approve'){
    if(!preview)throw Error('请重新预览');
    const saved=preview;preview=null;
    const result=saved.type==='student'?student.approve(saved.value):
      saved.type==='weather'?contextActions.approve(saved.value):growth().approve(saved.value);
    lastTransaction=result.transaction?.id||null;
    closeSheet();plan=null;requestRender('已执行 · 可撤销');return;
   }
   if(name==='undo'){
    if(!lastTransaction)throw Error('本次没有可撤销的执行');
    student.undo(lastTransaction);lastTransaction=null;plan=null;requestRender('刚才的操作已撤销');return;
   }
   if(name==='snooze'||name==='reject'){
    student.respond(t.dataset.agentId,name==='snooze'?'snooze':'reject',{hours:24});
    requestRender(name==='snooze'?'已暂缓 24 小时':'已记录不再提醒');return;
   }
   if(name==='preview-cancel'){preview=null;closeSheet();return}
  }catch(error){preview=null;notify(error.message)}
 }
 function handle(button){const kind=button?.dataset?.agentAction;if(!kind)return false;act(kind,button);return true}
 function answer(question){
  const q=String(question||'').trim(),data=getData(),c=context();
  const feed=student.feed().candidates;const due=data.tasks.filter(t=>!t.done&&t.due).sort((a,b)=>+new Date(a.due)-+new Date(b.due));
  const top=feed[0];
  if(/天气|雨|户外/.test(q)){
    if(c.sources.weather.status!=='available')return '目前没有已授权且有效的城市天气数据。请在设置里选城市、开启天气授权，再主动获取预报。';
    const w=c.weather.days[0];return c.weather.cityLabel+' 的 Open-Meteo 预报：'+w.date+' 日最大降水概率 '+w.precipitationProbabilityMax+'%，气温 '+w.temperatureMinC+'–'+w.temperatureMaxC+'°C。它不代表你活动的具体时段一定下雨。';
  }
  if(/心情|情绪|压力/.test(q))return flags.mood&&c.mood?'今天你主动记录的心情是 '+c.mood.value+'/5。建议按自己的节奏安排下一步，心情不能作为健康诊断。':'心情数据目前未授权用于建议；你可以在发展里记录，并在设置中主动开启本地结合。';
  if(/成长|进度|这周|学习计划|调整/.test(q)){
    const goals=data.goals.filter(g=>!g.done);return goals.length?'当前有 '+goals.length+' 个成长目标。你可以在“发展 → 目标”生成四周路线，记录行动后再次分析。所有行动都需要单独批准。':'还没有进行中的成长目标，先到“发展 → 目标”建立一个可执行的小目标。';
  }
  if(/明天/.test(q)){
    const day=plusDays(new Date(),1),date=dateKey(day);
    const entries=occurrences(data,new Date(date+'T00:00:00'),plusDays(new Date(date+'T00:00:00'),1));
    const dueTomorrow=due.filter(t=>String(t.due).slice(0,10)===date);
    return entries.length||dueTomorrow.length?'明天已记录 '+entries.length+' 项课程或活动、'+dueTomorrow.length+' 项到期任务。'+entries.slice(0,2).map(x=>x.start+' '+x.name).join('；')+(dueTomorrow.length?'；截止：'+dueTomorrow.slice(0,2).map(t=>t.title).join('、'):'')+'。可在“事项”查看详情；小芽不会擅自修改安排。':'当前没有记录到明天的日程或到期任务。建议先核对课表，再决定是否安排新的事项。';
  }
  if(/安排|待办|DDL|截止|风险|注意|今天/.test(q)){
    if(top)return '依据当前课程、截止时间与成长目标，小芽留意到：'+top.title+'。'+top.description+'。可以在“今天”查看证据并预览行动，未经批准不会执行。';
    return due.length?'最近一项截止任务是「'+due[0].title+'」，截止 '+String(due[0].due).replace('T',' ')+'。':'目前没有发现需要主动调整的事项。你可以先补充真实课表或任务，小芽不会编造安排。';
  }
  return null;
 }
 return {render,handle,answer,context,flags,resetForMode};
}
