// 小芽的记忆 · Local, per-archive memory for the companion agent.
// Everything here stays in this browser. What may be *sent to a model* is governed by `consent`,
// which the user sets explicitly and can revoke at any time. API keys are never stored here.
const PREFIX='xiaoya-opus-original:';
const CHAT_MAX=300,FACT_MAX=200;

/** Categories a connected model may read. Local use on this device is always allowed. */
export const CATEGORIES=Object.freeze([
 {key:'schedule',label:'课程与日程',hint:'课表、活动、空档、冲突'},
 {key:'tasks',label:'事项与截止',hint:'作业、考试、待办'},
 {key:'goals',label:'目标与打卡',hint:'长期目标、行动记录'},
 {key:'mood',label:'心情分值',hint:'每天 1–5 的心情'},
 {key:'journal',label:'日记正文',hint:'你写下的话，最私密',sensitive:true},
 {key:'chat',label:'聊天记忆',hint:'之前和小芽说过的话'},
 {key:'memory',label:'小芽记得的事',hint:'你让她记住、或她从聊天里记下的事实'}
]);
export const NO_CONSENT=Object.freeze(Object.fromEntries(CATEGORIES.map(c=>[c.key,false])));
export const COMPANION_CONSENT=Object.freeze(Object.fromEntries(CATEGORIES.map(c=>[c.key,true])));

const clip=(s,n)=>String(s??'').slice(0,n);
function safeArray(raw){try{const v=JSON.parse(raw||'[]');return Array.isArray(v)?v:[]}catch{return null}}

export function createMemory({local=globalThis.localStorage,getMode=()=>'personal',uid=()=>crypto.randomUUID(),clock=()=>new Date()}={}){
 const key=kind=>{const m=getMode();if(!['personal','demo'].includes(m))throw Error('档案模式无效');return PREFIX+kind+':v1:'+m};
 function read(kind){const v=safeArray(local.getItem(key(kind)));if(v===null)throw Error('小芽的'+(kind==='chat'?'聊天':'记忆')+'记录无法读取，已停止写入以免覆盖');return v}
 function write(kind,list){local.setItem(key(kind),JSON.stringify(list))}
 const chat={
  all:()=>read('chat').filter(m=>m&&['user','xiaoya'].includes(m.role)&&typeof m.text==='string'),
  add(msg){const list=chat.all();const item={id:uid(),role:msg.role,text:clip(msg.text,6000),at:clock().toISOString(),meta:clip(msg.meta,300),...(msg.trace?{trace:msg.trace.slice(0,12)}:{})};
   list.push(item);write('chat',list.slice(-CHAT_MAX));return item},
  clear(){local.removeItem(key('chat'))}
 };
 const facts={
  all:()=>read('memory').filter(f=>f&&typeof f.text==='string'&&f.text.trim()),
  add(text,source='user'){const t=clip(String(text).trim().replace(/\s+/g,' '),200);if(!t)throw Error('要记住的内容是空的');
   const list=facts.all();if(list.some(f=>f.text===t))return list.find(f=>f.text===t);
   const item={id:uid(),text:t,source:source==='xiaoya'?'xiaoya':'user',at:clock().toISOString()};list.push(item);write('memory',list.slice(-FACT_MAX));return item},
  update(id,text){const t=clip(String(text).trim(),200);if(!t)throw Error('内容不能为空');const list=facts.all().map(f=>f.id===id?{...f,text:t,edited:clock().toISOString()}:f);write('memory',list)},
  remove(id){write('memory',facts.all().filter(f=>f.id!==id))},
  clear(){local.removeItem(key('memory'))}
 };
 const consent={
  get(){try{const v=JSON.parse(local.getItem(key('consent'))||'null');if(!v||typeof v!=='object')return {...NO_CONSENT};
   return Object.fromEntries(CATEGORIES.map(c=>[c.key,v[c.key]===true]))}catch{return {...NO_CONSENT}}},
  set(next){const clean=Object.fromEntries(CATEGORIES.map(c=>[c.key,next?.[c.key]===true]));local.setItem(key('consent'),JSON.stringify({...clean,updatedAt:clock().toISOString()}));return clean},
  revoke(){local.removeItem(key('consent'))}
 };
 // Who the user told Xiaoya they are. Optional; every field may be empty.
 const profile={
  get(){try{const v=JSON.parse(local.getItem(key('profile'))||'{}');return {name:clip(v.name,24),school:clip(v.school,40),major:clip(v.major,40)}}catch{return {name:'',school:'',major:''}}},
  set(p){const v={name:clip(String(p?.name||'').trim(),24),school:clip(String(p?.school||'').trim(),40),major:clip(String(p?.major||'').trim(),40)};local.setItem(key('profile'),JSON.stringify(v));return v},
  clear(){local.removeItem(key('profile'))}
 };
 return {chat,facts,consent,profile,
  export:()=>({chat:chat.all(),memory:facts.all(),consent:consent.get()}),
  restore(data){if(Array.isArray(data?.chat))write('chat',data.chat.filter(m=>m&&typeof m.text==='string').slice(-CHAT_MAX));
   if(Array.isArray(data?.memory))write('memory',data.memory.filter(f=>f&&typeof f.text==='string').slice(-FACT_MAX))},
  clearAll(){chat.clear();facts.clear();consent.revoke();profile.clear()}};
}
