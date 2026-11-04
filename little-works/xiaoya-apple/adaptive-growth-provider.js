// Opt-in chat-completion adapter for bounded adaptive growth decisions.
// The key exists only inside this instance until clear(); never persisted or logged.
const ENDPOINTS=Object.freeze({
 'https://api.deepseek.com/chat/completions':'DeepSeek',
 'https://open.bigmodel.cn/api/paas/v4/chat/completions':'智谱 GLM',
 'https://api.openai.com/v1/chat/completions':'OpenAI',
 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions':'阿里百炼',
 'https://api.siliconflow.cn/v1/chat/completions':'硅基流动',
 'https://api.moonshot.cn/v1/chat/completions':'Moonshot',
 'https://openrouter.ai/api/v1/chat/completions':'OpenRouter'
});
const SYSTEM='你是大学生长期成长计划的审阅者。只根据收到的结构化记录和给定备选路线，考虑课业负担与持续行动。不能假定用户成绩、心理状态、课外安排或未来成功。绝对禁止自造动作、调用工具、发出网络请求、要求上传隐私。只输出 JSON 对象：{"choices":[{"goalId":"从options选择的ID","routeId":"该目标允许的route ID","reason":"不超过260字、明确指出证据和权衡的简短理由"}]}。不输出Markdown。';
export function createGrowthChatProvider({endpoint,model,apiKey,fetchImpl=globalThis.fetch}={}){
 if(typeof endpoint!=='string'||!Object.hasOwn(ENDPOINTS,endpoint))throw Error('模型端点地址未授权：仅支持固定 HTTPS 服务商');
 if(typeof model!=='string'||!model.trim()||model.length>120||/[\r\n]/.test(model))throw Error('模型 ID 无效');
 if(typeof apiKey!=='string'||!apiKey.trim()||apiKey.length>2048)throw Error('模型 Key 不能为空或过长');
 if(typeof fetchImpl!=='function')throw Error('没有可用的模型 HTTP 接口');
 let key=apiKey.trim();
 return Object.freeze({
  name:ENDPOINTS[endpoint],
  clear:()=>{key=null},
  plan:async({context,options,signal}={})=>{
   if(!key)throw Error('模型已断开，请重新授权');
   if(!context||!Array.isArray(context.goals)||!Array.isArray(options))throw Error('模型规划输入格式无效');
   // No journal, chat history, raw task labels or arbitrary caller properties enter the HTTP payload.
   const safeContext={
    observedAt:String(context.observedAt||'').slice(0,30),
    horizonWeeks:context.horizonWeeks,
    workload:{
     dueCount:context.workload?.dueCount??0,
     dueMinutes:context.workload?.dueMinutes??0,
     bookedMinutes:context.workload?.bookedMinutes??0
    },
    goals:context.goals.map(g=>({id:g.id,title:g.title,weeklyTarget:g.weeklyTarget,
     previousActions:g.previousActions,currentActions:g.currentActions}))
   };
   const safeOptions=options.map(o=>({goalId:o.goalId,routes:(o.routes||[]).map(x=>({
    id:x.id,name:x.name,minutes:x.minutes,weeklyActions:x.weeklyActions
   }))}));
   const body=JSON.stringify({model:model.trim(),messages:[
    {role:'system',content:SYSTEM},
    {role:'user',content:JSON.stringify({context:safeContext,options:safeOptions})}
   ],temperature:0.2,max_tokens:600});
   if(body.length>18_000)throw Error('请求摘要过长');
   let response;
   try{
    response=await fetchImpl(endpoint,{method:'POST',headers:{
     'content-type':'application/json',Authorization:'Bearer '+key
    },body,signal});
   }catch{throw Error('模型网络请求失败，请检查服务商或跨域支持')}
   if(!response?.ok)throw Error('模型服务暂不可用（HTTP '+Number(response?.status||0)+'）');
   let raw;
   try{
    const text=await response.text();
    if(text.length>24_000)throw Error('response too long');
    const parsed=JSON.parse(text);
    const output=parsed?.choices?.[0]?.message?.content;
    if(typeof output!=='string'||output.length>12_000)throw Error('bad content');
    raw=JSON.parse(output);
   }catch{throw Error('模型没有返回符合要求的 JSON 结果')}
   return raw;
  }
 });
}
