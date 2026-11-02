/* Separate browser context. Built-in synthetic DEMO data only; no real provider call. */
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path');
const out=path.join(__dirname,'../../docs/xiaoya-apple-next-qa/native-approval.json');
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true,timeout:14000}),ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage();
const errors=[];p.on('pageerror',e=>errors.push(e.message));
let result={};
try {
 await p.goto('http://127.0.0.1:5394/little-works/xiaoya-apple/',{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(900);
 if(await p.locator('#xy-onboard').isVisible())await p.locator('#xy-local').evaluate(b=>b.click());
 await p.locator('#mode-switch').evaluate(b=>b.click());await p.waitForTimeout(350);
 result.initial=await p.evaluate(()=>{const d=OPC_TEST.getData();return{mode:OPC_TEST.getMode(),transactions:d.transactions.length,suggestions:OPC_TEST.suggestions(d).map(s=>({id:s.id,title:s.title,action:!!s.action})).slice(0,8)}});
 const proposal=p.locator('[data-propose]').first();
 if(!await proposal.count()){result.status='NO_DEMO_PROPOSAL';console.log('APPROVAL_SKIPPED',JSON.stringify(result.initial))}
 else {
  await proposal.evaluate(b=>b.click());await p.waitForTimeout(150);
  result.modal=await p.locator('#modal-root').evaluate(el=>!el.hidden);
  result.before=await p.evaluate(()=>OPC_TEST.getData().transactions.length);
  await p.locator('#approve-action').evaluate(b=>b.click());
  await p.waitForTimeout(300);
  result.after=await p.evaluate(()=>OPC_TEST.getData().transactions.length);
  result.error=await p.locator('#action-error').count()?await p.locator('#action-error').textContent():null;
  if(result.after>result.before){
   const id=await p.evaluate(()=>OPC_TEST.getData().transactions.at(-1).id);
   result.saved=await p.evaluate(id=>OPC_TEST.getData().transactions.some(t=>t.id===id),id);
   await p.locator('[data-view="settings"]').first().evaluate(b=>b.click());
   await p.locator('[data-undo="'+id+'"]').evaluate(b=>b.click());
   result.undone=await p.evaluate(id=>OPC_TEST.getData().transactions.some(t=>t.id===id&&t.status==='undone'),id);
   result.status=result.undone?'PASS':'UNDO_FAILED';
  }else result.status='APPROVAL_NOT_EXECUTED';
 }
 result.errors=errors;fs.writeFileSync(out,JSON.stringify(result,null,2));
 console.log('APPROVAL_RESULT',JSON.stringify(result).slice(0,1700));
 if(result.status==='UNDO_FAILED'||errors.length)process.exitCode=1;
}finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error('APPROVAL_FATAL',e);process.exitCode=2});