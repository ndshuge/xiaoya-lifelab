import {emptyStore,validateStore,uid} from './core.js';
import {demoData} from './core.js';
export const ARCHIVE_KEYS=Object.freeze({personal:'xiaoya:personal:v1',demo:'xiaoya:synthetic-demo:v1'});
export function createArchive(storage,session,clock=()=>new Date()){
 let mode=session.getItem('xiaoya:mode')==='demo'?'demo':'personal';
 let snapshot=undefined,base=null,loadError=null;
 const key=()=>ARCHIVE_KEYS[mode];
 function read(){
  const raw=storage.getItem(key());
  try{const value=raw===null?emptyStore():validateStore(JSON.parse(raw));snapshot=raw;base=structuredClone(value);loadError=null;return value}
  catch(e){loadError=e;throw Error('档案读取失败，已禁止覆盖：'+e.message)}
 }
 function write(value){
  if(loadError)throw Error('档案损坏，不能写入；先导出原始文件');
  if(snapshot===undefined)throw Error('请先读取当前档案再编辑');
  const current=storage.getItem(key());
  if(current!==snapshot)throw Error('另一标签页更新了档案，请先刷新并核对');
  const next=validateStore(structuredClone(value));
  const old=base||emptyStore();
  const changes=[];
  for(const collection of ['courses','events','tasks','goals','checkins']){
   const before=old[collection]||[],after=next[collection]||[];
   for(const id of new Set([...before,...after].map(v=>v.id))){
    const a=before.find(x=>x.id===id)||null,b=after.find(x=>x.id===id)||null;
    if(JSON.stringify(a)!==JSON.stringify(b))changes.push({key:collection,id,before:a,after:b});
   }
  }
  if(changes.length&&next.transactions.length===old.transactions.length&&!next.transactions.some((x,i)=>x.status!==old.transactions[i]?.status)){
   next.transactions.push({id:uid(),at:clock().toISOString(),title:'Pro 手动更新',status:'executed',changes});
  }
  next.revision=(Number(old.revision)||0)+1;
  const serialized=JSON.stringify(next);
  storage.setItem(key(),serialized);
  if(storage.getItem(key())!==serialized)throw Error('存储读回失败，操作未获确认');
  snapshot=serialized;base=structuredClone(next);return next;
 }
 function switchMode(next){
  if(!['personal','demo'].includes(next))throw Error('模式无效');
  if(next==='demo'&&storage.getItem(ARCHIVE_KEYS.demo)===null){
   storage.setItem(ARCHIVE_KEYS.demo,JSON.stringify(demoData(clock())));
  }
  mode=next;session.setItem('xiaoya:mode',next);snapshot=undefined;base=null;loadError=null;return read();
 }
 function restoreValidated(value,authorized=false){
  if(authorized!==true)throw Error('恢复损坏档案需要明确授权');
  const checked=validateStore(structuredClone(value));
  const original=storage.getItem(key());
  let backupKey=null;
  if(original!==null){
   backupKey='xiaoya:recovery:'+mode+':'+clock().toISOString()+':'+uid();
   storage.setItem(backupKey,original);
   if(storage.getItem(backupKey)!==original)throw Error('恢复前保存原始备份失败，已停止覆盖');
  }
  const next=JSON.stringify({...checked,revision:(checked.revision||0)+1});
  storage.setItem(key(),next);
  if(storage.getItem(key())!==next)throw Error('恢复写入读回失败');
  loadError=null;snapshot=next;base=validateStore(JSON.parse(next));
  return {backupKey,next:base};
 }
 function exportRaw(){return storage.getItem(key())}
 return {get mode(){return mode},read,write,switchMode,exportRaw,restoreValidated,get error(){return loadError}};
}
export function toggleTask(data,id,now=new Date()){
 const next=structuredClone(data),t=next.tasks.find(x=>x.id===id);
 if(!t)throw Error('任务不存在或已删除');
 t.done=!t.done;t.completedAt=t.done?now.toISOString():null;
 next.history.unshift({id:uid(),at:now.toISOString(),action:'completed',description:(t.done?'完成：':'恢复：')+t.title});
 return next;
}
export function rejectPlan(data,plan,now=new Date()){
 if(data.decisions.some(x=>x.id===plan.id))throw Error('这条建议已经处理过');
 const next=structuredClone(data);
 next.decisions.push({id:plan.id,status:'rejected',at:now.toISOString(),reason:'用户拒绝',sourceIds:plan.sources});
 next.history.unshift({id:uid(),at:now.toISOString(),action:'rejected',description:'拒绝建议：'+plan.title});
 return next;
}
