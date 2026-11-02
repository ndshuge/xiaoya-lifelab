// A genuinely different composition for each design route. The existing business app stays authoritative.
(() => {
  const isApple = document.body.classList.contains('design-apple');
  const today = document.querySelector('#view-today');
  const hero = today?.querySelector('.hero');
  const overview = today?.querySelector('.overview-grid');
  if (!today || !hero || !overview) return;
  document.body.classList.add('redesign-v2');
  const shell = document.createElement('div');
  shell.className = isApple ? 'xy-cinema' : 'xy-editorial';
  const intro = document.createElement('div');
  intro.className='xy-redesign-intro';
  if (isApple) {
    intro.innerHTML = '<div class="xy-topline"><span class="xy-live-dot"></span>你的每一天，都有自己的节奏<span class="xy-intro-number">LIFELAB</span></div><p class="xy-intro-line">今天，<em>由你定义。</em></p>';
    const focus = document.createElement('section');
    focus.className='xy-focus-stage';
    const marker=document.createElement('div');
    marker.className='xy-focus-marker';
    marker.innerHTML='<span>下一步</span><span class="xy-chevron">↗</span>';
    const heading = today.querySelector('.section-heading');
    shell.append(intro, hero,marker,overview);
    hero.classList.add('xy-feature');
    hero.querySelector('h1')?.setAttribute('data-reimagined','true');
    overview.classList.add('xy-floating-panels');
    heading?.classList.add('xy-visually-secondary');
    today.prepend(shell);
  } else {
    intro.innerHTML = '<div class="xy-editorial-kicker"><span>小芽 · 日常工作台</span><span class="xy-date-caption">今日安排 / 本周进度</span></div><h2>把今天安排好，<br><i>把时间留给自己。</i></h2><p>从真实任务开始，而不是从一张欢迎卡片开始。</p>';
    const focus = document.createElement('div');focus.className='xy-workspace-board';
    const stripe = document.createElement('div');stripe.className='xy-day-strip';
    stripe.innerHTML='<span>MY WEEK / 学习与生活</span><button type="button" data-view="schedule">打开完整课表 <span aria-hidden="true">↗</span></button>';
    const heading = today.querySelector('.section-heading');
    shell.append(intro,stripe,overview);
    overview.classList.add('xy-kanban');
    hero.classList.add('xy-mini-context');
    today.prepend(shell);
    shell.append(hero);
    heading?.classList.add('xy-visually-secondary');
    const rail=document.querySelector('.right-rail');
    if(rail)rail.classList.add('xy-editorial-rail');
  }
  const style = document.createElement('style');
  style.textContent = '.xy-visually-secondary{display:none!important}';
  document.head.append(style);
})();