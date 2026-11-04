import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore} from './core.js';
import {analyzeAdaptiveGrowth} from './adaptive-growth-agent.js';
import {createGrowthChatProvider} from './adaptive-growth-provider.js';

const now=new Date('2026-11-04T10:00:00');
function record(){
 const d=emptyStore();d.goals.push({id:'g',title:'练吉他',done:false,weeklyTarget:3});
 d.tasks.push({id:'t',title:'英文秘密作业名称',due:'2026-11-05T21:00',minutes:240,done:false});
 d.journal=[{text:'非常私密的日记'}];d.settings.privateToken='veryprivate';
 return d;
}
const success={choices:[{goalId:'g',routeId:'steady',reason:'维持可持续的短时练习'}]};
test('provider construction refuses unsafe custom or downgraded endpoint',()=>{
 for(const url of ['http://api.deepseek.com/chat/completions','https://evil.example/chat/completions',
  'https://api.deepseek.com/chat/completions?key=x','https://username@api.deepseek.com/chat/completions']){
  assert.throws(()=>createGrowthChatProvider({endpoint:url,model:'deepseek-chat',apiKey:'secret',fetchImpl:()=>{}}),/地址|端点|HTTPS|未授权/);
 }
});
test('without explicit separate authorization no request is sent even with configured key',async()=>{
 let called=0;const provider=createGrowthChatProvider({endpoint:'https://api.deepseek.com/chat/completions',
  model:'deepseek-chat',apiKey:'safe-key',fetchImpl:async()=>{called++;throw Error('must not call')}});
 const out=await analyzeAdaptiveGrowth(record(),{now,provider,authorized:false});
 assert.equal(called,0);assert.equal(out.modelUsed,false);
});
test('authorized provider sends only bounded structured context, not journal or raw task text',async()=>{
 let req;
 const provider=createGrowthChatProvider({endpoint:'https://api.deepseek.com/chat/completions',
  model:'deepseek-chat',apiKey:'only-memory-key',fetchImpl:async(url,args)=>{
   req={url,args};return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(success)}}]}),
    {status:200,headers:{'content-type':'application/json'}});
  }});
 const out=await analyzeAdaptiveGrowth(record(),{now,provider,authorized:true});
 assert.equal(out.modelUsed,true);assert.equal(out.goals[0].selectedRouteId,'steady');
 assert.equal(req.url,'https://api.deepseek.com/chat/completions');
 assert.equal(req.args.headers.Authorization,'Bearer only-memory-key');
 assert.ok(!req.args.body.includes('非常私密的日记'));
 assert.ok(!req.args.body.includes('英文秘密作业名称'));
 assert.ok(!req.args.body.includes('veryprivate'));
 assert.match(req.args.body,/routeId/);
 assert.match(req.args.body,/g/);
});
test('cleared credential fails closed and HTTP errors do not reveal API Key',async()=>{
 let calls=0;
 const provider=createGrowthChatProvider({endpoint:'https://api.deepseek.com/chat/completions',
  model:'deepseek-chat',apiKey:'key-value-123',fetchImpl:async()=>{calls++;throw Error('failed '+ 'key-value-123')}});
 provider.clear();
 const out=await analyzeAdaptiveGrowth(record(),{now,provider,authorized:true});
 assert.equal(calls,0);assert.equal(out.mode,'rule-fallback');
 assert.ok(!out.notice.includes('key-value-123'));
});
test('provider malformed or untrusted model response safely falls back',async()=>{
 const provider=createGrowthChatProvider({endpoint:'https://api.deepseek.com/chat/completions',
  model:'deepseek-chat',apiKey:'sample',fetchImpl:async()=>new Response(JSON.stringify({
   choices:[{message:{content:JSON.stringify({choices:[{goalId:'g',routeId:'focused',reason:'好的',toolCall:'writeFile'}]})}}]
  }),{status:200})});
 const out=await analyzeAdaptiveGrowth(record(),{now,provider,authorized:true});
 assert.equal(out.modelUsed,false);assert.equal(out.mode,'rule-fallback');
 assert.equal(out.goals[0].selectedRouteId,'gentle');
});
