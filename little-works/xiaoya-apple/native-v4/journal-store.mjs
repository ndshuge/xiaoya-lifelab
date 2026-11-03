// V4-only, separately versioned private journal; the stable V3 record schema is untouched.
// Journal entries are never sent to an AI provider without a future explicit consent flow.
const PREFIX='xiaoya-dayflow:journal:v1:';
const dateValid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(+new Date(s+'T00:00:00'))&&new Date(s+'T00:00:00').toLocaleDateString('sv-SE')===s;
function validateEntry(raw){
 if(!raw||!dateValid(raw.date))throw Error('日记日期无效');
 const mood=raw.mood===null||raw.mood===undefined||raw.mood===''?null:Number(raw.mood);
 if(mood!==null&&(!Number.isInteger(mood)||mood<1||mood>5))throw Error('心情需在 1–5 之间');
 if(typeof raw.note!=='string'||raw.note.length>1800)throw Error('日记内容长度超出限制');
 if(mood===null&&!raw.note.trim())throw Error('请填写心情或日记内容');
 const tags=raw.tags||[];
 if(!Array.isArray(tags)||tags.length>5||tags.some(t=>typeof t!=='string'||t.length>24))throw Error('标签无效');
 return {date:raw.date,mood,note:raw.note.trim(),tags:[...new Set(tags)],updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:new Date().toISOString()};
}
export function validateJournalArchive(raw){
 if(!Array.isArray(raw)||raw.length>3000)throw Error('日记记录数量或结构无效');
 const result=raw.map(validateEntry),seen=new Set();
 for(const r of result){if(seen.has(r.date))throw Error('日期重复的日记');seen.add(r.date)}
 return result.sort((a,b)=>b.date.localeCompare(a.date));
}
export function createJournalStore({local=globalThis.localStorage,getMode=()=>'personal'}={}){
 function key(){const m=getMode();if(!['personal','demo'].includes(m))throw Error('档案模式无效');return PREFIX+m}
 function all(){const raw=local.getItem(key());return raw?validateJournalArchive(JSON.parse(raw)):[]}
 function replace(entries){const next=validateJournalArchive(entries);const k=key();local.setItem(k,JSON.stringify(next));return next}
 function save(entry){const prior=all();const e=validateEntry(entry);return replace([e,...prior.filter(x=>x.date!==e.date)])}
 function remove(date){if(!dateValid(date))throw Error('日期无效');return replace(all().filter(e=>e.date!==date))}
 function clear(){local.removeItem(key())}
 return {all,replace,save,remove,clear,key};
}
export function analyzeJournal(entries,now=new Date()){
 const list=validateJournalArchive(entries);
 const day=new Date(now);day.setHours(0,0,0,0);
 const start=(n)=>{const v=new Date(day);v.setDate(v.getDate()-(n-1));return v.toLocaleDateString('sv-SE')};
 const within=(n)=>list.filter(x=>x.date>=start(n)&&x.date<=day.toLocaleDateString('sv-SE'));
 const week=within(7),month=within(30),moods=week.map(e=>e.mood).filter(x=>x!==null);
 const avg=moods.length?Math.round(moods.reduce((a,b)=>a+b,0)/moods.length*10)/10:null;
 return {count7:week.length,count30:month.length,average7:avg,moodCount7:moods.length,
   explanation:week.length<3?'最近记录样本较少，先积累几天日记，再查看变化。':
    '近 7 天有 '+week.length+' 天记录，其中 '+moods.length+' 天标记了心情。这里显示你的记录趋势，不代表因果关系或医学判断。'};
}
