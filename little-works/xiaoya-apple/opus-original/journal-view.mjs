// Journal presentation uses the existing journal store; charts contain only dates and mood numbers.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const MOOD_NAMES=['','低落','疲倦','平稳','不错','很好'];
const MOOD_IMAGES=['','xiaoya-mood-1-hi-v2.webp','xiaoya-mood-2-hi.webp','xiaoya-mood-3-hi.webp','xiaoya-mood-4-hi.webp','xiaoya-mood-5-hi.webp'];
const pretty=s=>s?s.slice(5).replace('-','月')+'日':'';
export function renderMoodTrend(series,{selectedDate,compact=false,today}={}){
 const {points,segments,moodCount,entryCount}=series,len=points.length;
 const x=i=>48+(i*604)/Math.max(1,len-1),y=m=>178-(m-1)*34;
 const paths=segments.filter(s=>s.length>1).map(s=>'<polyline points="'+s.map(p=>x(points.indexOf(p))+','+y(p.mood)).join(' ')+'" fill="none" stroke="var(--sprout)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>').join('');
 const dots=points.map((p,i)=>p.mood===null?'':'<circle cx="'+x(i)+'" cy="'+y(p.mood)+'" r="'+(p.date===selectedDate?6:4.5)+'" fill="var(--sprout)" stroke="var(--card)" stroke-width="1.5"/>').join('');
 const ticks=[0,Math.round((len-1)/2),len-1].filter((n,i,arr)=>arr.indexOf(n)===i);
 const axis=ticks.map(i=>'<text x="'+x(i)+'" y="204" text-anchor="middle">'+pretty(points[i].date)+'</text>').join('')+
  [1,2,3,4,5].map(m=>'<text x="24" y="'+(y(m)+4)+'" text-anchor="middle">'+m+'</text>').join('');
 const current=points.find(p=>p.date===selectedDate)||points.at(-1);
 const selected=current?.mood==null?'未记录':MOOD_NAMES[current.mood];
 const svg='<svg class="mood-plot" data-mood-plot viewBox="0 0 700 212" role="img" aria-label="近'+len+'天心情趋势，1到5级；缺失日期断线"><title>近'+len+'天心情记录</title>'+
  '<line x1="48" y1="42" x2="652" y2="42" stroke="var(--rule)"/><line x1="48" y1="178" x2="652" y2="178" stroke="var(--rule)"/>'+
  '<g class="plot-axis">'+axis+'</g>'+paths+dots+'</svg>';
 return '<section class="journal-chart'+(compact?' is-compact':'')+'"><div class="journal-chart-graphic">'+svg+'</div>'+
  '<p class="journal-chart-count">有心情记录 '+moodCount+'/'+len+' 天 <small>· 日记记录 '+entryCount+' 天</small></p>'+
  (compact?'': '<div class="journal-chart-selected"><button type="button" data-journal-step="-1" aria-label="前一天">‹</button><span>'+esc(current?.date||'')+' · '+selected+'</span><button type="button" data-journal-step="1" aria-label="后一天">›</button>'+
   (current?.hasEntry?'<button type="button" class="ghost-btn" data-journal-read="'+current.date+'">查看这天</button>':current?.date<=today?'<button type="button" class="ghost-btn" data-journal-edit="'+current.date+'">补记</button>':'')+'</div>'+
   '<details class="journal-data"><summary>查看数据（日期与心情）</summary><table><thead><tr><th>日期</th><th>心情</th></tr></thead><tbody>'+points.map(p=>'<tr><td>'+p.date+'</td><td>'+MOOD_NAMES[p.mood||0].replace(/^$/,'未记录')+'</td></tr>').join('')+'</tbody></table></details>')+
  '</section>';
}
export function renderJournalHome(entries,{today,series}){
 const saved=entries.find(e=>e.date===today),past=[...entries].filter(e=>e.date<=today).sort((a,b)=>b.date.localeCompare(a.date));
 return '<section class="journal-page"><header class="journal-head"><h1>心情日记</h1><div class="journal-head-actions"><button type="button" class="ghost-btn" data-journal-new>补记往日</button><button type="button" class="ink-btn" data-journal-edit="'+today+'">记录今天</button></div></header>'+
  '<div class="journal-summary"><h2>今天</h2><p>'+(saved?(saved.mood?MOOD_NAMES[saved.mood]+' · ':'')+esc(saved.note?.slice(0,92)||'只记了心情'):'还没有记录心情。')+'</p></div>'+
  '<div class="journal-chart-header"><h2>最近7天</h2><button type="button" class="link" data-journal-show="trend">查看趋势 ›</button></div>'+
  renderMoodTrend(series,{compact:true})+
  '<div class="journal-chart-header"><h2>最近记录</h2><button type="button" class="link" data-journal-show="history">查看全部 ›</button></div>'+
  (past.length?'<ul class="journal-entries">'+past.slice(0,3).map(e=>entryRow(e)).join('')+'</ul>':'<p class="pocket-empty">记录一次心情，日记才会在这里出现。</p>')+'</section>';
}
const entryRow=e=>'<li><button type="button" data-journal-read="'+e.date+'"><b>'+e.date+'</b><span>'+(e.mood?MOOD_NAMES[e.mood]:'只写了日记')+'</span><small>'+esc(e.note?.slice(0,55)||'')+'</small><i aria-hidden="true">›</i></button></li>';
export function renderJournalHistory(entries,{today}){
 const past=[...entries].filter(e=>e.date<=today).sort((a,b)=>b.date.localeCompare(a.date));
 return '<section class="journal-page"><header class="journal-head"><button type="button" class="ghost-btn" data-journal-show="home">‹ 返回</button><h1>全部日记</h1></header>'+
  (past.length?'<ul class="journal-entries">'+past.map(entryRow).join('')+'</ul>':'<p class="pocket-empty">还没有日记。</p>')+'</section>';
}
export function renderJournalTrend(series,{selectedDate,today,days}){
 return '<section class="journal-page"><header class="journal-head"><button type="button" class="ghost-btn" data-journal-show="home">‹ 返回</button><h1>心情趋势</h1></header>'+
  '<div class="journal-ranges" role="group" aria-label="观察天数">'+[7,30,90].map(n=>'<button type="button" data-journal-range="'+n+'" aria-pressed="'+(days===n)+'">'+n+' 天</button>').join('')+'</div>'+
  renderMoodTrend(series,{selectedDate,today})+'</section>';
}
export function renderJournalEditor(entry,{date,today}){
 const mood=entry?.mood??null;
 return '<p class="sheet-lede">只保存在这台设备；正文不会自动发送给模型。</p>'+
  '<label class="field">日期<input type="date" name="journalDate" value="'+esc(date)+'" max="'+esc(today)+'" required></label>'+
  '<fieldset class="journal-moods"><legend>今天的心情（可选）</legend>'+[null,1,2,3,4,5].map(n=>'<label class="journal-mood"><input type="radio" name="mood" value="'+(n??'')+'"'+(n===mood?' checked':'')+'>'+
  (n===null?'<span>不选</span>':'<img src="../native-v4/assets/'+MOOD_IMAGES[n]+'" alt="" width="44" height="44"><span>'+MOOD_NAMES[n]+'</span>')+'</label>').join('')+'</fieldset>'+
  '<label class="field">写一句话（可选）<textarea name="note" rows="5" maxlength="1800" placeholder="今天发生了什么？">'+esc(entry?.note||'')+'</textarea></label>';
}
export function renderGoalChart(series,{goalId,mode='count',selectedWeek=null}={}){
 const max=Math.max(1,...series.map(x=>mode==='minutes'?x.minutes:x.count));
 const bars=series.map(w=>{const amount=mode==='minutes'?w.minutes:w.count;
  return '<button type="button" class="goal-bar'+(selectedWeek===w.weekStart?' is-selected':'')+'" data-goal-week="'+w.weekStart+'" data-goal-id="'+esc(goalId)+'" aria-label="'+w.weekStart+'：'+amount+(mode==='minutes'?' 分钟':' 次')+'">'+
   '<span class="goal-bar-plot"><i style="height:'+Math.round(amount/max*90)+'%"></i></span><b>'+amount+'</b><small>'+pretty(w.weekStart)+'</small></button>'}).join('');
 const current=series.find(w=>w.weekStart===selectedWeek);
 return '<section class="goal-chart" id="goal-chart"><div class="goal-chart-head"><strong>近8周已记录的行动</strong><div>'+
  '<button type="button" data-goal-chart-mode="count" data-goal-id="'+esc(goalId)+'" aria-pressed="'+(mode==='count')+'">次数</button>'+
  '<button type="button" data-goal-chart-mode="minutes" data-goal-id="'+esc(goalId)+'" aria-pressed="'+(mode==='minutes')+'">分钟</button></div></div>'+
  '<div class="goal-bars">'+bars+'</div>'+
  (current?'<p class="hint">'+current.weekStart+'：'+current.entries.length+' 条行动记录'+(current.entries.length?' · '+esc(current.entries.map(c=>c.note||'行动').join('、')):'')+'</p>':'<p class="hint">只统计已记录行动，不包括安排到日历里的计划。</p>')+'</section>';
}
