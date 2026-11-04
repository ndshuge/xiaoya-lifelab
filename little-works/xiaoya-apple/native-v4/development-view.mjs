// Native V4 development: private diary + goals + explicit, non-diagnostic trends.
import {esc} from '../core.js';
import {analyzeJournal} from './journal-store.mjs';
const ic=n=>'<svg aria-hidden="true"><use href="#ic-'+n+'"/></svg>';
const moods=[['1','很低落'],['2','有点累'],['3','平稳'],['4','不错'],['5','很好']];
const dateZh=s=>new Date(s+'T12:00:00').toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
export function renderDevelopment(d,entries,{selectedDate,at=new Date(),growthPlanner='',active='record',historyReturn=false}={}){
 const saved=entries.find(e=>e.date===selectedDate)||null;
 const stats=analyzeJournal(entries,at),recent=entries.slice(0,8);
 const today=dateZh(selectedDate),isToday=selectedDate===at.toLocaleDateString('sv-SE');
 const current=new Date(at);current.setHours(0,0,0,0);
 const pastWeek=new Date(current);pastWeek.setDate(current.getDate()-6);
 const goals=(d.goals||[]).filter(g=>!g.done);
 const done=(d.goals||[]).filter(g=>g.done);
 const goalsHtml=goals.map(g=>{
  const actions=(d.checkins||[]).filter(c=>c.goalId===g.id&&new Date(c.at)>=pastWeek);
  const count=actions.length,target=Math.max(1,Number(g.weeklyTarget)||1);
  return '<div class="v4-goal-row" data-item="'+esc(g.id)+'"><div class="v4-goal-content">'+
   '<button class="v4-goal-name" data-edit="goal" data-id="'+esc(g.id)+'">'+esc(g.title)+'</button>'+
   '<small>'+esc(g.target||g.category||'成长行动')+'</small>'+
   '<div class="v4-goal-progress"><span style="width:'+Math.min(100,Math.round(count/target*100))+'%"></span></div>'+
   '<span class="v4-goal-caption">近 7 天 '+count+' / '+target+' 次实际记录</span></div>'+
   '<button class="v4-goal-checkin" data-checkin="'+esc(g.id)+'">记录行动</button></div>';
 }).join('');
 const recentHtml=recent.map(e=>'<button class="v4-journal-row'+(e.date===selectedDate?' is-selected':'')+'" data-journal-date="'+esc(e.date)+'">'+
  '<span class="v4-journal-row-date">'+esc(dateZh(e.date))+'</span><span class="v4-journal-row-preview">'+esc(e.note||moods.find(m=>Number(m[0])===e.mood)?.[1]||'仅记录心情')+'</span>'+
  '<span aria-hidden="true">'+ic('right')+'</span></button>').join('');
 const moodButtons=moods.map(([n,label])=>'<button type="button" class="v4-mood-option'+(saved?.mood===Number(n)?' is-active':'')+'" data-mood="'+n+'" aria-pressed="'+(saved?.mood===Number(n))+'">'+
   '<span class="v4-mood-art v4-mood-art-'+n+'" aria-hidden="true"></span><span>'+label+'</span></button>').join('');
 return '<div class="v4-development">'+
  '<header class="page-heading v4-page-heading"><div><h1>发展</h1></div></header>'+
  '<div class="v4-develop-segments" aria-label="发展分类">'+
  '<button type="button" data-develop-tab="record" aria-pressed="'+(active==='record')+'" class="'+(active==='record'?'is-active':'')+'"><b class=\"xy-elastic-face\">记录</b></button>'+
  '<button type="button" data-develop-tab="goals" aria-pressed="'+(active==='goals')+'" class="'+(active==='goals'?'is-active':'')+'"><b class=\"xy-elastic-face\">目标</b></button></div>'+
  '<div data-develop-panel="record"'+(active==='record'?'':' hidden')+'>'+
  '<div class="v4-development-intro"><h2>'+(isToday?'今天，感觉怎么样？':'那天感觉怎么样？')+'</h2>'+(historyReturn?'':isToday?'':'<button class="xy-journal-return" data-action="journal-today">回到今天</button>')+
  '</div>'+
  '<section id="development-mood" class="v4-mood-section" aria-labelledby="v4-mood-label">'+
  '<h3 id="v4-mood-label" class="v4-visually-hidden">记录心情</h3><div class="v4-mood-picker" role="group" aria-labelledby="v4-mood-label">'+moodButtons+'</div></section>'+
  '<section id="development-journal" class="v4-journal-section"><div class="v4-section-title"><div><h2>写几句话</h2></div><span id="v4-journal-date">'+esc(today)+'</span>'+(historyReturn?'<button class="xy-journal-back" data-action="journal-back">返回最近记录</button>':'')+'</div>'+
  '<div class="v4-journal-paper"><label class="v4-visually-hidden" for="journal-note">日记</label>'+
  '<textarea id="journal-note" placeholder="有什么值得记住的小事？" maxlength="1800" spellcheck="false">'+esc(saved?.note||'')+'</textarea>'+
  '<div class="v4-journal-toolbar"><span id="journal-status" role="status">'+(saved?'这一天已有记录':'仅存储在当前浏览器')+'</span>'+
  (saved?'<button id="journal-delete" class="v4-journal-delete" type="button">删除记录</button>':'')+
  '<button id="journal-save" class="v4-journal-save" type="button">保存记录 '+ic('right')+'</button></div></div></section>'+
  '<section class="v4-history-section"><div class="v4-section-title"><div><h2>最近的日子</h2></div>'+(stats.count30?'<span>'+stats.count30+' 天 / 30 天</span>':'')+'</div>'+
  (recentHtml?'<div class="v4-journal-history">'+recentHtml+'</div>':'<div class="v4-record-empty">保存后会出现在这里。</div>')+'</section>'+
  ''+(stats.count30?'<section class="v4-stats-section"><div class="v4-section-title"><div><h2>近 7 天</h2></div><span>只统计已保存的记录</span></div>'+
  '<div class="v4-stats-line"><div><strong>'+stats.count7+'</strong><small>天有记录</small></div><div><strong>'+(stats.average7??'—')+'</strong><small>心情平均值 / 5</small></div>'+
  '<div><strong>'+stats.moodCount7+'</strong><small>天标注心情</small></div></div>'+
  '<p class="v4-stats-note">'+esc(stats.explanation)+'</p>'+
  '<button class="v4-ask-companion" data-action="pet">和小芽聊聊 '+ic('right')+'</button>'+
  '<small class="v4-ai-disclaimer">心情统计不构成医学判断；日记不会自动发给 AI。</small></section>':'')+
  '</div>'+
  '<div data-develop-panel="goals"'+(active==='goals'?'':' hidden')+'>'+
  '<section id="development-goals" class="v4-goals-section"><div class="v4-section-title"><div><h2>正在坚持的事</h2></div><button data-add="goal">新建目标</button></div>'+
  '<div class="v4-unified-list">'+(goalsHtml||'<p class="v4-list-empty">还没有目标。可以先从一件想坚持的小事开始。</p>')+'</div>'+
  (done.length?'<details class="v4-completed-goals" id="development-completed-goals"><summary>已完成 '+done.length+' 个目标</summary><div class="v4-unified-list">'+done.map(g=>'<div class="v4-completed-goal-row"><button data-edit="goal" data-id="'+esc(g.id)+'">'+esc(g.title)+'</button><button data-toggle="goal" data-id="'+esc(g.id)+'" aria-label="重新进行 '+esc(g.title)+'">重新进行</button></div>').join('')+'</div></details>':'')+
  '<details class="v4-growth-disclosure" id="v4-growth-planner"><summary>制定新的成长路线 '+ic('right')+'</summary><div class="v4-growth-planner-content">'+growthPlanner+'</div></details>'+
  '</section></div></div>';
}
