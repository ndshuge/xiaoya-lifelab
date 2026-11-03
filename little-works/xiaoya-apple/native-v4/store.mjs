import {emptyStore,validateStore,demoData,uid} from '../core.js';

export const KEYS=Object.freeze({
 personal:'xiaoya-comparison:xiaoya-apple:personal:v1',
 demo:'xiaoya-comparison:xiaoya-apple:synthetic-demo:v1'
});
const MODE_KEY='xiaoya-comparison:xiaoya-apple:mode';
const TRACKED=['courses','events','tasks','goals','checkins'];

export function createStore({local=globalThis.localStorage,session=globalThis.sessionStorage,preferDemoOnFreshSession=false}={}){
 const remembered=session.getItem(MODE_KEY);
 let mode=remembered==='demo'||(!remembered&&preferDemoOnFreshSession)?'demo':'personal';
 // Contest visitors start in an isolated synthetic archive, without writing personal data.
 // Respect explicit mode changes when the judge refreshes the page.
 if(mode==='demo'&&!local.getItem(KEYS.demo))local.setItem(KEYS.demo,JSON.stringify(demoData()));
 if(!remembered&&preferDemoOnFreshSession)session.setItem(MODE_KEY,'demo');
 let snapshot=null,record=null,error='';
 function read(){
   const raw=local.getItem(KEYS[mode]);
   try {
     const next=raw?validateStore(JSON.parse(raw)):emptyStore();
     record=next;snapshot=raw;error='';return structuredClone(record);
   }catch(e){error='档案读取失败：'+e.message;throw Error(error+'。为了保护原始数据，已禁止保存。请到原版页面导出原始档案。');}
 }
 function current(){return structuredClone(record||read())}
 function commit(change,{track=true}={}){
   if(error)throw Error(error);
   if(local.getItem(KEYS[mode])!==snapshot){read();throw Error('另一标签页已更新档案，已载入新数据。请确认后重试。')}
   const before=current(),next=structuredClone(before);
   const changed=change(next);
   const checked=validateStore(next);
   const changes=[];
   if(track){
     for(const key of TRACKED){
       const ids=new Set([...before[key],...checked[key]].map(x=>x.id));
       for(const id of ids){
         const a=before[key].find(x=>x.id===id)||null,b=checked[key].find(x=>x.id===id)||null;
         if(JSON.stringify(a)!==JSON.stringify(b))changes.push({key,id,before:a,after:b});
       }
     }
     if(changes.length&&checked.transactions.length===before.transactions.length){
       checked.transactions.push({id:uid(),title:'手动更新记录',at:new Date().toISOString(),status:'executed',changes});
     }
   }
   checked.revision=(before.revision||0)+1;
   const serialized=JSON.stringify(checked);
   local.setItem(KEYS[mode],serialized);
   if(local.getItem(KEYS[mode])!==serialized)throw Error('本地写入校验失败，请不要关闭页面');
   record=validateStore(JSON.parse(serialized));snapshot=serialized;
   return {data:current(),changed};
 }
 function replace(next,{track=false}={}){
   const checked=validateStore(next);
   return commit(d=>{for(const k of Object.keys(d))delete d[k];Object.assign(d,checked)},{track});
 }
 function setMode(next){
   if(!['personal','demo'].includes(next))throw Error('无效档案模式');
   if(next==='demo'&&!local.getItem(KEYS.demo))local.setItem(KEYS.demo,JSON.stringify(demoData()));
   mode=next;session.setItem(MODE_KEY,mode);read();return current();
 }
 read();
 return {current,commit,replace,setMode,refresh:read,mode:()=>mode,error:()=>error,key:()=>KEYS[mode]};
}
