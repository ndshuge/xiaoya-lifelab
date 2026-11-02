/* Progressive disclosure without replacing existing application handlers or stored state. */
(function(){
  function organize(){
    const root=document.querySelector('#view-settings');
    if(!root || root.dataset.organized==='true')return;
    root.dataset.organized='true';
    const panels=[...root.children].filter(el=>el.matches('.panel'));
    const semester=panels.find(el=>el.querySelector('#semester-save'));
    const ai=document.getElementById('byok-settings');
    const toggles=panels.find(el=>el.classList.contains('settings-list'));
    const reminder=panels.find(el=>el.querySelector('#reminder-settings-save'));
    const transactions=panels.find(el=>el.querySelector('#transactions'));
    const data=panels.find(el=>el.querySelector('#export-btn'));
    const about=panels.find(el=>el.textContent.includes('关于小芽'));
    function detailsFor(panel,title,expanded){
      if(!panel)return;
      const details=document.createElement('details');
      details.className='xy-organized-details';
      details.open=!!expanded;
      const summary=document.createElement('summary');
      summary.textContent=title;
      panel.before(details);
      details.append(summary,panel);
      panel.classList.add('xy-in-details');
      return details;
    }
    if(semester){
      semester.classList.add('xy-semester');
      const p=semester.querySelector('p.muted');if(p)p.hidden=true;
    }
    if(ai){
      const paragraph=ai.querySelector('p:not(.muted)');
      if(paragraph)paragraph.hidden=true;
      detailsFor(ai,'AI 模型连接',false);
    }
    if(toggles)toggles.classList.add('xy-system-settings');
    detailsFor(reminder,'提醒与时间安排',false);
    detailsFor(transactions,'操作记录与撤销',false);
    if(data)data.classList.add('xy-data-settings');
    detailsFor(about,'关于小芽',false);
    const heading=root.querySelector('.page-head h1');
    if(heading)heading.textContent='设置';
    const desc=root.querySelector('.page-head p');if(desc)desc.hidden=true;
    // Show the selected section when an existing navigation action focuses one of its controls.
    root.addEventListener('focusin',event=>{
      const wrapped=event.target.closest('.xy-organized-details');
      if(wrapped)wrapped.open=true;
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',organize);
  else organize();
})();/* iOS-style settings drill-down: one active category, no long stacked forms. */
(function(){
 function init(){
  const root=document.querySelector('#view-settings');
  if(!root||root.dataset.drilldown)return;
  root.dataset.drilldown='1';
  const groups=[
   ['学期','semester',root.querySelector('.xy-semester'),'学期名称与日期'],
   ['AI 模型','ai',document.querySelector('#byok-settings')?.closest('.xy-organized-details'),'模型连接与授权'],
   ['偏好','preferences',root.querySelector('.xy-system-settings'),'安静模式、动效和桌宠'],
   ['提醒','reminders',root.querySelector('#reminder-settings-save')?.closest('.xy-organized-details'),'时间、通知与日历'],
   ['数据与隐私','data',root.querySelector('.xy-data-settings'),'备份和数据管理'],
   ['操作记录','history',root.querySelector('#transactions')?.closest('.xy-organized-details'),'查看或撤销操作'],
   ['版本与外观','edition',root.querySelector('.xy-edition-settings'),'打开保留的 Original Edition'],
   ['关于小芽','about',[...root.querySelectorAll('.xy-organized-details')].find(e=>e.textContent.includes('关于小芽')),'应用说明']
  ].filter(x=>x[2]);
  const menu=document.createElement('div');menu.className='xy-settings-menu';
  const top=document.createElement('div');top.className='xy-settings-subnav';top.hidden=true;
  const back=document.createElement('button');back.type='button';back.className='xy-settings-back';back.textContent='‹ 设置';
  const heading=document.createElement('h2');heading.className='xy-settings-current';
  top.append(back,heading);
  const sections=document.createElement('div');sections.className='xy-settings-sections';
  const head=root.querySelector('.page-head');head.after(top,menu,sections);
  const captions=['基础','智能','外观与行为','时间','隐私','其他',''];
  const item=(g,i)=>{const button=document.createElement('button');button.type='button';button.className='xy-settings-item';button.innerHTML='<span class="xy-settings-item-main"><strong></strong><small></small></span><span class="xy-settings-chevron" aria-hidden="true">›</span>';button.querySelector('strong').textContent=g[0];button.querySelector('small').textContent=g[3];button.addEventListener('click',()=>openGroup(g[1]));return button};
  groups.forEach((g,i)=>{if(i===0||i===2||i===4||i===5){const label=document.createElement('p');label.className='xy-settings-group-label';label.textContent=captions[i];menu.append(label)}menu.append(item(g,i))});
  for(const g of groups){const panel=g[2];panel.dataset.xyGroup=g[1];sections.append(panel);if(panel.matches('details'))panel.open=true}
  let active=null;
  function openGroup(id){active=id;root.classList.add('xy-settings-detail');root.dataset.xyActive=id;menu.hidden=true;top.hidden=false;heading.textContent=groups.find(g=>g[1]===id)?.[0]||'';head.hidden=true;for(const g of groups)g[2].hidden=g[1]!==id;window.scrollTo({top:0,behavior:'instant'})}
  function showMenu(){active=null;root.classList.remove('xy-settings-detail');delete root.dataset.xyActive;top.hidden=true;menu.hidden=false;head.hidden=false;for(const g of groups)g[2].hidden=true;window.scrollTo({top:0,behavior:'instant'})}
  back.addEventListener('click',showMenu);showMenu();
  root.addEventListener('focusin',e=>{const group=e.target.closest('[data-xy-group]');if(group&&group.dataset.xyGroup!==active)openGroup(group.dataset.xyGroup)});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
