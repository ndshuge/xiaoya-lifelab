import { createGlass, createSpring, engine } from './glass/liquid-glass.js';

const body = document.body;
if (body.classList.contains('design-apple')) {
  body.classList.add('apple-next');
  // Replace the onboarding placeholder emoji with XiaoYa's licensed local artwork.
  const introGlyph = document.querySelector('#xy-onboard .xy-hero > span');
  if (introGlyph) {
    const art = document.createElement('img');
    art.className = 'xy-intro-illustration';
    art.src = './assets/brand/xiaoya_hero_v1.webp';
    art.alt = '小芽形象';
    art.width = 56;
    art.height = 56;
    introGlyph.replaceWith(art);
  }
  // The assistant works locally without a Key. Put optional provider setup behind
  // an explicit, keyboard-operable disclosure instead of forcing a long form
  // into every first-launch sheet. All original consent/security nodes stay intact.
  const onboardingContent = document.querySelector('#xy-onboard .xy-content');
  if (onboardingContent && !onboardingContent.querySelector('.xy-onboard-optional')) {
    const local = onboardingContent.querySelector('#xy-local');
    const skip = onboardingContent.querySelector('#xy-skip');
    if (local && skip) {
      const optional = document.createElement('details');
      optional.className = 'xy-onboard-optional';
      const summary = document.createElement('summary');
      summary.textContent = '连接真实 AI（可选）';
      optional.append(summary);
      for (const node of [...onboardingContent.children]) {
        if (node !== local && node !== skip) optional.append(node);
      }
      local.after(optional);
      // An explicit Connect request should open the relevant form directly;
      // first launch remains compact until the user asks for AI.
      document.addEventListener('click',event=>{
        if(event.target.closest('#ai-global-entry,#xy-config,#ai-mode-connect,#ai-today-connect,#ai-goals-banner-action,#growth-ai-config-link'))optional.open=true;
      },true);
      window.addEventListener('xiaoya-open-ai-settings',()=>{optional.open=true;});
    }
  }
  // Apple Settings uses a functional page title, not a promotional hero.
  const settingsHeading = document.querySelector('#view-settings .page-head h1');
  if (settingsHeading) settingsHeading.textContent = '设置';
  const settingsSummary = document.querySelector('#view-settings .page-head p');
  if (settingsSummary) settingsSummary.textContent = '管理学期、提醒、AI 和个人数据。';
  const day = document.getElementById('view-today');
  const shell = day?.querySelector('.xy-cinema');
  const overview = shell?.querySelector('.overview-grid');
  if (shell && overview) {
    shell.querySelector('.xy-redesign-intro')?.remove();
    shell.querySelector('.xy-focus-marker')?.remove();
    shell.after(overview);
    overview.classList.add('xy-floating-panels');
    shell.setAttribute('aria-label','今日概览');
  }

  const h1 = shell?.querySelector('#hero-title');
  if (h1 && h1.textContent.replace(/\s/g,'').startsWith('今天，也在慢慢成长')) {
    const period = h1.querySelector('.hero-period');
    h1.textContent = '今天，';
    const rest = document.createElement('span');
    rest.className = 'xy-hero-continuation';
    rest.textContent = '也在慢慢成长';
    h1.append(rest);
    if (period) rest.append(period);
  }
  // Keep the semester form primary; move its noncritical explanatory text
  // into a native disclosure at the end of the existing panel.
  const semesterPanel = document.querySelector('#view-settings > .panel.rc-settings');
  const semesterRule = semesterPanel?.querySelector(':scope > p.muted');
  if (semesterPanel && semesterRule && !semesterPanel.querySelector('.xy-semester-disclosure')) {
    const details = document.createElement('details');
    details.className = 'xy-semester-disclosure';
    const summary = document.createElement('summary');
    summary.textContent = '学期规则说明';
    details.append(summary, semesterRule);
    semesterPanel.append(details);
  }
  // iOS-style progressive disclosure: preserve all original BYOK safety text
  // while keeping the primary action visible near the top of Settings.
  const aiSettings = document.getElementById('byok-settings');
  if (aiSettings && !aiSettings.querySelector('.xy-ai-disclosure')) {
    const notes = [...aiSettings.children].filter(el =>
      (el.matches('p.muted') || el.matches('small.muted') ||
       (el.tagName === 'P' && el !== aiSettings.querySelector('p:first-of-type') &&
        el.textContent.includes('CORS')))
    );
    if (notes.length) {
      const disclosure = document.createElement('details');
      disclosure.className = 'xy-ai-disclosure';
      const summary = document.createElement('summary');
      summary.textContent = 'API 密钥保存与安全说明';
      disclosure.append(summary);
      for (const note of notes) disclosure.append(note);
      aiSettings.append(disclosure);
    }
  }
  // Information hierarchy: action first, explanations on demand.
  // Keep full business/privacy copy in DOM; don't delete or falsify it.
  const makeDetails = (parent, paragraph, title, shortText) => {
    if (!parent || !paragraph || paragraph.closest('details')) return;
    const detail = document.createElement('details');
    detail.className = 'xy-secondary-info';
    const summary = document.createElement('summary');
    summary.textContent = title;
    const full = paragraph.cloneNode(true);
    paragraph.textContent = shortText;
    detail.append(summary, full);
    paragraph.after(detail);
  };
  const byok = document.getElementById('byok-settings');
  if (byok) {
    const lead = [...byok.children].find(e => e.tagName === 'P' && !e.classList.contains('muted'));
    makeDetails(byok, lead, '关于 AI 接入', '基础功能无需连接 AI。需要智能规划时，再连接模型。');
    const consent = byok.querySelector('label:has(input[type="checkbox"])');
    if (consent) consent.classList.add('xy-consent-row');
  }
  const reminders = document.querySelector('#reminder-leads')?.closest('.panel');
  if (reminders) {
    const lead = [...reminders.children].find(e => e.tagName === 'P');
    makeDetails(reminders, lead, '提醒如何工作', '仅在网页打开时检查提醒；关闭页面后不会通知。');
  }
  const onboarding = document.getElementById('onboarding');
  if (onboarding) {
    onboarding.classList.add('xy-setup-compact');
  }
  const freeTime = document.getElementById('free-time');
  if (freeTime && !freeTime.closest('details')) {
    const detail = document.createElement('details');
    detail.className = 'xy-free-time-details';
    const summary = document.createElement('summary');
    summary.textContent = '查看接下来 24 小时的空闲时间';
    freeTime.before(detail);
    detail.append(summary,freeTime);
  }
  const dock = document.querySelector('.mobile-tabs');
  if (dock) {
    const lens = document.createElement('span');
    lens.className = 'xy-glass-indicator';
    lens.setAttribute('aria-hidden','true');
    dock.prepend(lens);
    const buttons = [...dock.querySelectorAll('button[data-view]')];
    // Pattern B from the installed liquid-glass-web skill: WebKit/Gecko
    // refract a decorative COPY of the dock content, not arbitrary DOM behind it.
    // The six native buttons remain untouched and receive every tap and focus.
    let contentSurface = null;
    let contentOptics = null;
    if (engine !== 'blink') {
      contentSurface = document.createElement('div');
      contentSurface.className = 'xy-refract-copy';
      contentSurface.setAttribute('aria-hidden', 'true');
      for (const button of buttons) {
        const cell = document.createElement('span');
        cell.className = 'xy-refract-cell';
        // Trusted static navigation artwork only; clone the SVG icon as well as its text.
        // Use DOM cloning, not innerHTML, so the optical copy cannot parse user data.
        cell.append(...[...button.childNodes].map(node => node.cloneNode(true)));
        contentSurface.append(cell);
      }
      dock.insertBefore(contentSurface, buttons[0]);
      contentSurface.firstElementChild?.classList.add('is-selected');
    }
    let location = 0;
    let copyOffset = -5;
    let lastOpticalPosition = NaN;
    let lastOpticalUpdate = 0;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
    const positionSpring = createSpring(0, (v, velocity) => {
      location = v;
      lens.style.transform = 'translate3d(' + v.toFixed(2) + 'px,0,0)';
      if (contentOptics && contentSurface) {
        // WebKit reissues a new filter id even when only x changes. Throttle
        // optical updates while the lightweight indicator still tracks 60 Hz.
        // Never force layout by reading DOM rects on every spring frame.
        const x = v + copyOffset;
        const now = performance.now();
        if (velocity === 0) {
          contentOptics.update({x});
          lastOpticalPosition=x;
          lastOpticalUpdate=now;
        }
      }
    });
    function updateIndicator(instant = false) {
      if (window.innerWidth > 790) return;
      const target = buttons.find(b => b.classList.contains('active')) || buttons[0];
      if (!target) return;
      if (contentSurface) [...contentSurface.children].forEach((cell,i)=>cell.classList.toggle('is-selected',buttons[i]===target));
      const r = target.getBoundingClientRect();
      const parent = dock.getBoundingClientRect();
      lens.style.width = r.width + 'px';
      lens.style.height = r.height + 'px';
      lens.style.top = (r.top-parent.top) + 'px';
      const x = r.left-parent.left;
      if (contentOptics && contentSurface) {
        const c = contentSurface.getBoundingClientRect();
        copyOffset=parent.left-c.left;
        contentOptics.update({y:r.top-c.top, width:r.width, height:r.height, radius:Math.min(23,r.height/2)});
      }
      if (instant || reducedMotion.matches) {
        positionSpring.set(x, { immediate: true });
        location = x;
        lens.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      } else {
        positionSpring.set(x);
      }
    }
    const observer = new MutationObserver(() => updateIndicator(false));
    buttons.forEach(b => observer.observe(b,{attributes:true,attributeFilter:['class']}));
    dock.addEventListener('pointerdown',e => {
      const b = e.target.closest('button[data-view]');
      if (b) lens.classList.add('is-pressed');
    });
    const release = () => lens.classList.remove('is-pressed');
    dock.addEventListener('pointerup',release);
    dock.addEventListener('pointercancel',release);
    dock.addEventListener('pointerleave',release);
    buttons.forEach(b=>b.addEventListener('focus',()=>updateIndicator(false)));
    window.addEventListener('resize',()=>updateIndicator(true),{passive:true});
    // One-shot initialization: WebKit sometimes suppresses the first rAF while
    // the initial setup sheet overlays the document. Never leave the copy unfiltered.
    setTimeout(() => {
      updateIndicator(true);
      if (!reducedTransparency.matches) {
        try {
          if (engine === 'blink') {
            const opticalLens = createGlass(lens, {
              mode:'backdrop',fit:true,radius:23,refraction:16,bezel:.62,
              curvature:4,chroma:.08,specular:.64,specularWidth:1.4,
              fallback:'blur(7px) saturate(1.35)'
            });
            dock.dataset.glass = opticalLens ? 'refraction' : 'frosted-fallback';
          } else if (contentSurface) {
            // A real SVG displacement of the copied tab art works in WebKit.
            // This bends dock ICONS and LABELS, not live scrolling-page pixels.
            const c = contentSurface.getBoundingClientRect();
            const selected = buttons.find(b => b.classList.contains('active')) || buttons[0];
            const r = selected.getBoundingClientRect();
            copyOffset = dock.getBoundingClientRect().left-c.left;
            lastOpticalPosition = r.left-c.left;
            lastOpticalUpdate = performance.now();
            contentOptics = createGlass(contentSurface, {
              sync:true, clip:true, x:r.left-c.left, y:r.top-c.top,
              width:r.width, height:r.height, radius:23,
              refraction:18, bezel:.55, curvature:4, chroma:.08,
              specular:.7,specularWidth:1.55
            });
            dock.dataset.glass = contentOptics ? 'content-refraction' : 'frosted-fallback';
            if (contentOptics) {
              let attempts=0;
              const reveal=()=>{
                if (!contentSurface.isConnected) return;
                if (getComputedStyle(contentSurface).filter.includes('url(')) dock.classList.add('has-content-refraction');
                else if (++attempts<180) requestAnimationFrame(reveal);
                else { contentOptics.destroy(); contentOptics=null; contentSurface.remove(); dock.dataset.glass='frosted-fallback'; }
              };
              requestAnimationFrame(reveal);
            }
          }
          dock.dataset.glassEngine = engine;
        } catch (e) {
          dock.dataset.glass='fallback';
          console.warn('Glass renderer fallback:',e.message);
        }
      } else dock.dataset.glass='reduced-transparency';
    });
  }
}
