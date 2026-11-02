// Xiaoya: deterministic and explainable local growth planner. No AI or outcome forecasts.
import {occurrences,calendarConflicts,monday,plusDays,dateKey} from './domain.js';
// Curated, deterministic domain patterns. They are planning examples, not expert accreditation.
const profileTable=[
 {id:'chip',name:'芯片与微电子',match:/芯片|微电子|集成电路|半导体|FPGA|Verilog|数字电路/i,
  steady:[['数字逻辑基础','整理数字逻辑与电路基础概念，完成可核查练习','带答案和错误记录的知识清单'],['HDL与仿真练习','循序练习 Verilog 基础模块及仿真，记录调试原因','三个可复现的简单仿真'],['实验整理','整理测试波形、实现步骤与下一阶段薄弱项','附运行步骤的实验报告']],
  project:[['确定FPGA最小作品','选择计数器、流水灯等范围可控的项目并列验收条件','简洁需求与测试清单'],['迭代实现与验证','实现、仿真、记录失败和修复；没有硬件则采用可复现仿真','可复现工程文件与测试记录'],['工程演示与总结','用波形或实机录像解释设计，记录局限','一段演示及复盘文档']]},
 {id:'coding',name:'软件与编程',match:/编程|Python|C语言|软件|算法|开发|网页|网站|程序|前端/i,
  steady:[['语言与调试基础','补齐核心语法、数据结构与调试知识','20道练习及错误记录'],['分层编程练习','按单元测试与小功能持续练习','可运行的练习仓库'],['整理开源作品','添加使用说明、测试与复盘','可运行项目与README']],
  project:[['确定可用原型','定义一个真实痛点与最小可用范围','功能列表和简易原型'],['实现并测试','按周实现功能，加入测试并修复缺陷','有版本记录和测试的应用'],['部署和复盘','写清运行方式、收集反馈与下一步','可演示软件及使用说明']]},
 {id:'language',name:'语言学习',match:/英语|雅思|托福|四六级|口语|语言学习|日语|法语/i,
  steady:[['摸清基础与重点','进行听说读写的自我检查并建立错题词汇表','一份基础记录和学习计划'],['持续输入输出','按周完成听力、阅读、复述或写作练习','每周带日期的练习存档'],['模拟与复盘','对比不同日期的同类练习，找出未掌握点','同类练习结果与改进清单']],
  project:[['设定真实语言任务','选择录制演讲、读书报告或情境交流成果','主题、提纲与可检查标准'],['反复创作反馈','录制、修订、复述与自评，不凭空预测分数','数版可对比的语言作品'],['公开成果与复盘','展示作品，并记录听众或老师的真实反馈','最终作品与来源可追溯反馈']]},
 {id:'sport',name:'体育运动',match:/运动|跑步|乒乓|体能|健身|羽毛球|篮球|游泳/i,
  steady:[['记录当前能力','自愿记录适当的练习频率与动作基础','练习表和可选起点记录'],['循序练习','设置可调整练习频率和休息，避免追求极限','按日期的训练记录'],['技能复盘','回顾动作稳定度、主观反馈和实际练习次数','动作视频或个人复盘']],
  project:[['选定可展示技能','选一个安全、可量化的动作或比赛目标','目标动作与检查标准'],['短周期训练反馈','每周练习并根据疲劳和反馈调整','过程记录与练习片段'],['技能展示','展示经过练习的技能和仍需改进处','真实展示与复盘']]},
 {id:'music',name:'音乐与乐器',match:/音乐|架子鼓|鼓谱|吉他|乐器|乐队|钢琴|声乐/i,
  steady:[['节奏与基础','分解节拍与基础技巧，选可完成的小节','有日期的基础练习录音'],['分段练习','分段练曲，记录稳定度与错拍','三段逐步改善的录音'],['完整演奏与复盘','录一遍完整作品，记录节奏和衔接问题','完整演奏录音和复盘']],
  project:[['确定一首作品','选择可在周期内完成的曲目并拆段','曲目进度表'],['排练与合奏','按周录音、修正并与伙伴协调','排练录音与改进清单'],['演出或录制','完成可回放的作品并总结','演奏视频或音频作品']]}
];
export function resolveGrowthDomain(goal,baseline=''){
 const found=profileTable.find(x=>x.match.test(String(goal)));
 const low=String(baseline).toLowerCase();
 const level=/零基础|0基础|完全不会|刚开始|从零|初学/.test(low)?'beginner':/有基础|学过|掌握|熟悉|做过|练习过|已经/.test(low)?'some':'unknown';
 return {id:found?.id||'general',name:found?.name||'通用成长',level,
  assumption:level==='beginner'?'按自述零基础安排入门练习':level==='some'?'按自述有一定基础安排，具体水平仍需自行核验':'未提供可验证的基础能力，按通用方案起步'};
}
const layouts=[
 {id:'steady',name:'稳步积累',share:[.3,.5],titles:['基础梳理','持续练习','成果复盘'],
  actions:['梳理必需知识并列出学习清单','按周练习并记录错误与反馈','完成一件可展示成果并复盘'],
  reason:'先建立基础，再通过持续练习巩固，适合稳定投入。',
  risk:'准备阶段可能过长；每两周检查一次可展示成果。'},
 {id:'project',name:'项目驱动',share:[.15,.6],titles:['确定最小项目','迭代实践','展示与复盘'],
  actions:['确定范围可控的作品与最小交付标准','每周迭代、测试并补齐知识缺口','整理作品证据、演示和下一轮改进'],
  reason:'尽早用作品获得反馈，适合偏好边做边学。',
  risk:'知识缺口可能导致返工；预留复习和调试时间。'}
];
const pad=n=>String(n).padStart(2,'0');
const round1=n=>Math.round(n*10)/10;
/** Summarize *recorded* weekly commitments; this is not a measured free-time forecast. */
export function summarizeGrowthWorkload(data,now=new Date()){
 if(!data||!Array.isArray(data.courses)||!Array.isArray(data.events)||!Array.isArray(data.tasks))
  throw Error('当前档案无效，无法估算本周已登记负载');
 const from=monday(now),until=plusDays(from,7);
 const booked=occurrences(data,from,until);
 const hours=booked.reduce((sum,e)=>sum+Math.max(0,(Math.min(+new Date(e.endsAt),+until)-Math.max(+new Date(e.startsAt),+from))/3600000),0);
 const due=data.tasks.filter(t=>!t.done&&t.due&&new Date(t.due)>=from&&new Date(t.due)<until);
 const dueMinutes=due.reduce((sum,t)=>{const n=Number(t.minutes);return sum+(Number.isFinite(n)?Math.min(1440,Math.max(0,n)):0)},0);
 return {weekStart:dateKey(from),recordedEvents:booked.length,
  bookedHours:round1(hours),dueTasks:due.length,dueTaskHours:round1(dueMinutes/60),
  conflicts:calendarConflicts(data,from,until).length,
  note:'仅统计当前档案里已登记的课程/活动与本周待办；重叠时段可能重复计时，未录入事项不在统计内'};
}

export function buildGrowthRoutes(input){
 const goal=String(input?.goal??'').trim(),baseline=String(input?.baseline??'').trim();
 const hours=Number(input?.hours),weeks=Number(input?.weeks);
 const profile=resolveGrowthDomain(goal,baseline),domainDetails=profileTable.find(x=>x.id===profile.id);
 const pendingCount=Number(input?.pendingCount??0);
 const workload=input?.workload??null;
 if(workload!==null&&(!Number.isFinite(workload.bookedHours)||workload.bookedHours<0||!Number.isFinite(workload.dueTaskHours)||workload.dueTaskHours<0||!Number.isInteger(workload.conflicts)||workload.conflicts<0||workload.conflicts>10000))throw Error('课表负载摘要无效');
 if(!goal||goal.length>100)throw Error('成长目标须为1–100字');
 if(baseline.length>180)throw Error('当前基础不得超过180字');
 if(!Number.isFinite(hours)||hours<1||hours>40)throw Error('每周投入时间必须为1–40小时');
 if(!Number.isInteger(weeks)||weeks<4||weeks>52)throw Error('规划周期必须为4–52个整周');
 if(!Number.isInteger(pendingCount)||pendingCount<0||pendingCount>10000)throw Error('现有待办数量无效');
 return {goal,baseline,hours,weeks,pendingCount,workload,domain:profile.id,domainName:profile.name,baselineLevel:profile.level,totalHours:Math.round(hours*weeks*10)/10,
  explain:'本机规则模板：'+profile.name+'；'+profile.assumption+'。预计投入 '+(Math.round(hours*weeks*10)/10)+' 小时'+(pendingCount?'；当前已有 '+pendingCount+' 项未完成事项（未自动扣除其耗时）':'') +(workload?'；本周已登记课程/活动时长约 '+workload.bookedHours+' 小时，到期待办预计 '+workload.dueTaskHours+' 小时，已知冲突 '+workload.conflicts+' 处（重叠可能重复计时，未登记事项未计入）':'')+'。这些时数未自动从用户设定的成长预算中扣除；计划是建议，非能力评估或成功概率预测。',
  routes:layouts.map(x=>{
   const a=Math.max(1,Math.min(weeks-2,Math.round(weeks*x.share[0])));
   const b=Math.max(1,Math.min(weeks-a-1,Math.round(weeks*x.share[1])));
   const lengths=[a,b,weeks-a-b];let start=1;
   const matching=domainDetails?.[x.id];
   return {id:x.id,name:x.name,reason:x.reason+(matching?' 依据目标关键词选用了'+profile.name+'的任务模板。':''),risk:x.risk+(hours<=2?' 每周预算较少，建议缩小阶段成果。':'')+(workload?.conflicts>0?' 当前课表存在 '+workload.conflicts+' 处已知重叠，先协调日程。':'')+(workload?.dueTaskHours>hours?' 本周到期待办预计用时已超过成长预算，请避免过度安排。':''),stages:lengths.map((n,i)=>{
    const exemplar=matching?.[i],baseAction=exemplar?.[1]||x.actions[i];
    const item={id:x.id+'-'+i,title:exemplar?.[0]||x.titles[i],action:(i===0&&profile.level==='beginner'?'从可检查的入门练习起步；':i===0&&profile.level==='some'?'先核对已有能力，减少重复学习；':'')+baseAction,
     deliverable:exemplar?.[2]||(i===2?'一份可回看、可验证的成果':'本阶段带日期的行动记录'),startWeek:start,endWeek:start+n-1,hours:Math.round(n*hours*10)/10};
    start+=n;return item;
   })};
  })};
}
export function growthStageTasks(plan,routeId,now=new Date()){
 const route=plan?.routes?.find(r=>r.id===routeId);
 if(!route||route.stages?.length!==3)throw Error('请选择有效成长路线');
 if(!Number.isFinite(+new Date(now)))throw Error('无效开始日期');
 return route.stages.map(stage=>{
  const date=new Date(now);date.setDate(date.getDate()+stage.endWeek*7);date.setHours(20,0,0,0);
  const due=date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T20:00';
  return {title:(plan.goal+' · '+stage.title).slice(0,160),due,type:'task',
   minutes:Math.max(15,Math.min(240,Math.round(plan.hours*60/3))),
   done:false,stageId:stage.id,stageAction:stage.action,stageDeliverable:stage.deliverable||''};
 });
}
export function commitGrowthRoute(data,plan,routeId,now=new Date(),makeId=()=>crypto.randomUUID()){
 if(!data||!Array.isArray(data.goals)||!Array.isArray(data.tasks)||!Array.isArray(data.history))throw Error('档案结构无效');
 const route=plan?.routes?.find(r=>r.id===routeId);
 if(!route)throw Error('成长路线不存在');
 const signature=JSON.stringify([plan.goal.trim().toLowerCase(),routeId]);
 if(data.goals.some(g=>!g.done&&g.growthPlan?.signature===signature))
  throw Error('同一目标与路线已有进行中的计划，请先完成或调整现有计划');
 const next=structuredClone(data),at=new Date(now).toISOString(),goalId=makeId();
 const goal={id:goalId,title:plan.goal,category:'成长路线',target:route.name+'：'+route.stages.map(s=>s.title).join(' → '),
  kind:'goal',weeklyTarget:1,done:false,createdAt:at,
  growthPlan:{signature,routeId,routeName:route.name,domain:plan.domain||'general',domainName:plan.domainName||'通用成长',baseline:plan.baseline,hours:plan.hours,weeks:plan.weeks,createdAt:at,stages:structuredClone(route.stages)}};
 const tasks=growthStageTasks(plan,routeId,now).map(t=>({...t,id:makeId(),goalId,createdAt:at}));
 next.goals.push(goal);next.tasks.push(...tasks);
 next.history.unshift({id:makeId(),at,action:'growth-route',description:'批准成长路线：'+plan.goal+' · '+route.name+'，生成'+tasks.length+'项任务'});
 return {next,goal,tasks,route};
}
export function growthRouteProgress(data,goalId){
 const goal=data.goals.find(g=>g.id===goalId&&g.growthPlan);
 if(!goal)return null;
 const tasks=data.tasks.filter(t=>t.goalId===goalId&&t.stageId);
 return {goal,all:tasks.length,done:tasks.filter(t=>t.done).length,
  recordedMinutes:(data.checkins||[]).filter(c=>c.goalId===goalId).reduce((n,c)=>n+c.minutes,0),tasks};
}
