// Read-only Dayflow model for the judge-facing Native V4 home.
// Uses the canonical recurrence and suggestion engines: no fabricated schedule, no writes.
import {dateKey,plusDays,occurrences} from '../domain.js';
import {suggestions} from '../core.js';

const pendingTasks=data=>[...(data.tasks||[])]
 .filter(task=>!task.done)
 .sort((a,b)=>{const x=a.due?+new Date(a.due):Infinity,y=b.due?+new Date(b.due):Infinity;return x-y});

function decorateSession(session,time){
 const start=new Date(session.startsAt),end=new Date(session.endsAt);
 return {...session,place:session.place||'',isOngoing:start<=time&&end>time,
   isFinished:end<=time};
}

export function buildTodayViewModel(data,instant=new Date()){
 const at=new Date(instant);
 if(!Number.isFinite(+at))throw Error('无效的当前时间');
 const today=dateKey(at),midnight=new Date(today+'T00:00:00');
 const nextMidnight=plusDays(midnight,1);
 const calendar=occurrences(data,midnight,nextMidnight);
 const schedule=calendar.map(x=>decorateSession(x,at))
   .sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id));
 const nextEvent=schedule.find(x=>!x.isFinished)||null;
 // A future real class can be mentioned as "upcoming", never misrepresented as today's class.
 const lookahead=occurrences(data,nextMidnight,plusDays(midnight,8));
 const nextUpcoming=lookahead.length?decorateSession(lookahead[0],at):null;
 const tasks=pendingTasks(data);
 const items=suggestions(data,at);
 const suggestion=items.find(s=>s.kind!=='welcome')||items[0]||null;
 return {date:today,schedule,nextEvent,nextUpcoming,tasks,suggestion,
   totalCourses:schedule.filter(x=>x.kind==='course').length,
   totalEvents:schedule.filter(x=>x.kind==='event').length,
   pendingCount:tasks.length};
}
