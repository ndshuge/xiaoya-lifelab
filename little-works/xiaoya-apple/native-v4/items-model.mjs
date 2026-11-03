// Deadline is a reminder, not a session start. Separate unfinished scheduled and undated tasks.
const pending=d=>(d?.tasks||[]).filter(t=>!t.done);
const cmp=(a,b)=>(a.due?+new Date(a.due):Infinity)-(b.due?+new Date(b.due):Infinity);
export function splitTasksByDeadline(data){
 const todos=pending(data);
 return {dated:todos.filter(t=>t.due).sort(cmp),undated:todos.filter(t=>!t.due)};
}
export function deadlineTasksForDate(data,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('非法日期');
 return splitTasksByDeadline(data).dated.filter(t=>t.due.slice(0,10)===date);
}
export function overdueTasks(data,date){return splitTasksByDeadline(data).dated.filter(t=>t.due.slice(0,10)<date);}
