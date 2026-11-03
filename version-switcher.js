/* One small version control across the canonical xiaoya-lifelab Pages repository. */
(() => {
  const script=document.currentScript;
  if(!script||document.getElementById('xiaoya-version-menu'))return;
  const base=new URL('./',script.src);
  const css=document.createElement('link');
  css.rel='stylesheet';css.href=new URL('version-switcher.css?v=20261102',base);
  document.head.append(css);

  const versions=[
    {id:'native',name:'Apple 最新版',label:'正式 · Native V4 DAYFLOW',path:'little-works/xiaoya-apple/native-v4/'},
    {id:'v3',name:'Apple V3 · 已存档',label:'2026-11-02 · 稳定原版',path:'little-works/xiaoya-apple/native-v3/'},
    {id:'apple',name:'Apple 早期版',label:'UI · 经典 Apple 迭代',path:'little-works/xiaoya-apple/'},
    {id:'classic',name:'经典原版',label:'完整功能 · LifeLab',path:'original.html'},
    {id:'pro',name:'小芽 Pro',label:'独立预览 · DAYLINE',path:'pro/'}
  ];
  const current=versions.find(v=>location.pathname===new URL(v.path,base).pathname||
    (location.pathname.endsWith('index.html')&&location.pathname===new URL(v.path+'index.html',base).pathname));
  const judge=new URLSearchParams(location.search).get('judge')==='1';
  function link(v){
    const target=new URL(v.path,base);
    if(judge)target.searchParams.set('judge','1');
    return target.href;
  }

  const container=document.createElement('div');
  container.id='xiaoya-version-menu';
  container.innerHTML=`
    <button type="button" id="xiaoya-version-trigger" aria-expanded="false" aria-controls="xiaoya-version-list" aria-haspopup="true">
      <span class="xiaoya-version-dot" aria-hidden="true"></span>版本<span aria-hidden="true" class="xiaoya-version-chevron">⌃</span>
    </button>
    <section id="xiaoya-version-list" hidden aria-label="切换小芽版本">
      <div class="xiaoya-version-head"><strong>小芽 · 版本库</strong><p>不同版本，保留不同的设计与功能。</p></div>
      <nav aria-label="选择版本">${versions.map(v=>`<a class="xiaoya-version-option${current?.id===v.id?' is-current':''}" href="${link(v)}" ${current?.id===v.id?'aria-current="page"':''}><span><strong>${v.name}</strong><small>${v.label}</small></span><span class="xiaoya-version-selection">${current?.id===v.id?'当前':'↗'}</span></a>`).join('')}</nav>
      <a class="xiaoya-version-library" href="${new URL('versions/',base).href}">查看版本说明与源码来源 <span aria-hidden="true">→</span></a>
    </section>`;
  document.body.append(container);
  const btn=container.querySelector('#xiaoya-version-trigger');
  const list=container.querySelector('#xiaoya-version-list');
  function close(){list.hidden=true;btn.setAttribute('aria-expanded','false')}
  function toggle(){list.hidden=!list.hidden;btn.setAttribute('aria-expanded',String(!list.hidden))}
  btn.addEventListener('click',toggle);
  document.addEventListener('pointerdown',e=>{if(!container.contains(e.target))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!list.hidden){close();btn.focus()}});
})();
