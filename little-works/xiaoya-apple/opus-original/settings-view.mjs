// Settings has one root and focused subpages. It never merges an omitted field into another domain.
const item=(id,title,value='')=>'<button type="button" class="settings-row" data-settings-section="'+id+'"><span>'+title+'</span><small>'+value+'</small><i aria-hidden="true">›</i></button>';
export function renderSettingsHome({modeLabel='',semesterLabel='',reminderLabel='',modelLabel='' }={}){
 return '<div class="settings-home" aria-label="设置分类">'+
  '<section class="settings-group"><h3>我的数据</h3><div class="settings-rows">'+
  item('archive','档案与备份',modeLabel)+item('semester','课表与学期',semesterLabel)+'</div></section>'+
  '<section class="settings-group"><h3>使用偏好</h3><div class="settings-rows">'+
  item('reminders','提醒',reminderLabel)+item('appearance','外观与动效','')+'</div></section>'+
  '<section class="settings-group"><h3>小芽</h3><div class="settings-rows">'+
  item('ai','AI 与隐私',modelLabel)+item('about','帮助与关于','')+'</div></section></div>';
}
const str=(form,key,fallback='')=>{
 const value=typeof form?.get==='function'?form.get(key):form?.[key];
 return value===null||value===undefined?String(fallback??''):String(value);
};
const has=(form,key)=>typeof form?.has==='function'?form.has(key):Object.hasOwn(form||{},key);
export function buildSectionPatch(section,form,currentData={}){
 const s=currentData.settings||{},sem=currentData.semester||{};
 switch(section){
  case 'semester':{
   const name=str(form,'semName',sem.name||'我的学期').trim().slice(0,40);
   const start=str(form,'semStart',sem.start||'');
   const end=str(form,'semEnd',sem.end||'');
   if(!name||((start&&!end)||(!start&&end))||(start&&end&&(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)))
    throw Error('请填写有效的学期名称及完整起止日期');
   return {semester:{name,start,end}};
  }
  case 'reminders':{
   const reminderGap=Number(str(form,'reminderGap',s.reminderGap??30));
   const quietStart=str(form,'quietStart',s.quietStart||'22:00');
   const quietEnd=str(form,'quietEnd',s.quietEnd||'08:00');
   if(!Number.isInteger(reminderGap)||reminderGap<1||reminderGap>1440)throw Error('提醒间隔需在 1–1440 分钟');
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(quietStart)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(quietEnd))throw Error('免打扰时间不正确');
   return {settings:{reminderEnabled:has(form,'reminderEnabled'),quietStart,quietEnd,reminderGap}};
  }
  case 'appearance':
   return {settings:{quiet:has(form,'quiet'),reducedMotion:has(form,'reducedMotion')}};
  default:throw Error('未知设置分类');
 }
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(label,name,value='',type='text',extra='')=>'<label class="field">'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const check=(label,name,yes)=>'<label class="settings-check"><input type="checkbox" name="'+name+'"'+(yes?' checked':'')+'><span>'+label+'</span></label>';
const action=(label,attr,detail='')=>'<button type="button" class="settings-action" '+attr+'><span>'+label+'</span><small>'+esc(detail)+'</small><i aria-hidden="true">›</i></button>';
const rows=html=>'<div class="settings-rows">'+html+'</div>';
export function renderSettingsSection(section,detail,ctx){
 const {data:d,mode,model,consent,cities,memoryCount=0,strokes='',memoryScopes=[]}=ctx;
 const s=d.settings||{},sem=d.semester||{};
 switch(section){
  case 'archive':
   if(detail==='manage')return {title:'数据管理',html:'<p class="sheet-lede">清空当前档案不可撤销，请先备份。</p>'+rows(action('清空当前档案','data-cover="clear"')),save:false};
   if(detail==='history')return {title:'操作记录',html:strokes||'<p class="hint">暂无可撤销的操作。</p>',save:false};
   return {title:'档案与备份',html:'<p class="sheet-lede">当前：'+(mode==='demo'?'演示档案':'私人档案')+'，两者隔离。</p>'+rows(action('切换档案','data-cover="mode"')+action('导出备份 JSON','data-cover="export"','含日记与记忆')+action('从备份恢复','data-cover="import"','先预览再确认')+action('操作记录','data-settings-detail="history"')+action('数据管理','data-settings-detail="manage"')),save:false};
  case 'semester':
   if(detail==='edit')return {title:'编辑学期',html:field('名称','semName',sem.name||'我的学期')+field('开始','semStart',sem.start||'','date')+field('结束','semEnd',sem.end||'','date'),save:'semester'};
   if(detail==='format')return {title:'导入格式',html:'<p class="sheet-lede">CSV 表头为 name,day,start,end（day 为 1–7）；导入前会展示预览。也支持 ICS。</p>',save:false};
   return {title:'课表与学期',html:'<p class="sheet-lede">'+esc(sem.name||'我的学期')+(sem.start?' · '+esc(sem.start)+' — '+esc(sem.end):' · 尚未设置日期')+'</p>'+rows(action('导入 CSV / ICS','data-import-cal')+action('导出日历 .ics','data-export-ics')+action('编辑学期','data-settings-detail="edit"')+action('导入格式说明','data-settings-detail="format"')),save:false};
  case 'reminders':
   if(detail==='advanced')return {title:'提醒高级选项',html:check('页面打开时提醒','reminderEnabled',s.reminderEnabled)+field('免打扰开始','quietStart',s.quietStart||'22:00','time')+field('免打扰结束','quietEnd',s.quietEnd||'08:00','time')+field('最短间隔（分钟）','reminderGap',s.reminderGap??30,'number','min="1" max="1440"'),save:'reminders'};
   return {title:'提醒',html:'<p class="sheet-lede">关闭网页后不会提醒。</p>'+check('页面打开时提醒','reminderEnabled',s.reminderEnabled)+rows(action('免打扰与最短间隔','data-settings-detail="advanced"',(s.quietStart||'22:00')+'—'+(s.quietEnd||'08:00'))),save:'reminders'};
  case 'appearance':
   return {title:'外观与动效',html:check('安静模式','quiet',s.quiet)+check('减少动效','reducedMotion',s.reducedMotion)+'<p class="hint">海洋声音仍需你手动开启。</p>',save:'appearance'};
  case 'ai':
   if(detail==='context')return {title:'本地情境授权',html:'<p class="sheet-lede">仅本次打开有效。心情只读取分值，不读取日记正文；天气仅主动获取。</p><label class="field">城市<select name="city">'+[['','不使用天气'],...cities.map(c=>[c.id,c.name])].map(([id,name])=>'<option value="'+esc(id)+'"'+(consent.city?.id===id?' selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>'+check('允许本次获取天气','weather',consent.weather)+check('允许本地使用心情分值','mood',consent.mood)+rows(action('获取预报','data-cover="weather"')+action('撤销本地授权','data-cover="revoke"'))+'<p class="hint" data-weather-status>'+(consent.weather&&consent.forecast?'已获取：'+esc(consent.forecast.cityLabel)+' · '+esc(new Date(consent.forecast.fetchedAt).toLocaleString('zh-CN')):'尚未获取天气；不授权就不会发送请求。')+'</p>',save:'context'};
   if(detail==='permissions')return {title:'模型读取权限',html:'<p class="sheet-lede">连接模型时按类别查询；日记正文需单独授权。</p>'+rows(memoryScopes.map(k=>'<label class="settings-check"><input type="checkbox" data-settings-consent="'+esc(k.key)+'"'+(k.enabled?' checked':'')+'><span>'+esc(k.label)+'</span></label>').join('')),save:false};
   return {title:'AI 与隐私',html:'<p class="sheet-lede">'+(model?'已连接 '+esc(model.providerName)+' · '+esc(model.model):'未连接模型；基础功能离线可用')+'。密钥仅保存在内存。</p>'+rows(action('模型连接与测试','data-settings-go="model"','测试可能收费')+action('模型读取权限','data-settings-detail="permissions"')+action('天气与心情本地授权','data-settings-detail="context"')+action('小芽记忆管理','data-settings-go="memory"',memoryCount+' 条')),save:false};
  case 'about':
   if(detail==='versions')return {title:'历史版本',html:rows('<a id="opus-previous-version" class="settings-action" href="../native-v4/?judge=1">上一正式版 V4 ›</a><a id="opus-version-library" class="settings-action" href="../../../versions/">全部历史版本 ›</a>'),save:false};
   return {title:'帮助与关于',html:rows(action('重新看开场','data-replay="intro"')+action('重走教学','data-replay="tour"')+action('重新显示提示','data-replay="tips"')+action('历史版本','data-settings-detail="versions"'))+'<p class="hint">小芽 · 铅笔与墨水。所有建议经过确认才写入档案。</p>',save:false};
  default:throw Error('未知设置分类');
 }
}
