// XiaoYa G3-2: short-lived synthetic-only approval sandbox.
// No imports from app store and no persistent/network/storage operations.
import {getSyntheticCase} from './synthetic-model-cases.js';
import {validateSyntheticPlan} from './local-model-lab.js';
const requireTrue=(b,s)=>{if(!b)throw Error(s)};
export function buildSyntheticApprovalPreview(caseId,payload,{source='synthetic-provider'}={}){
 const scenario=getSyntheticCase(caseId);
 requireTrue(!!scenario,'只允许预设合成案例，不处理真实用户档案');
 requireTrue(typeof source==='string'&&source.length>=2&&source.length<=64,'计划来源无效');
 const plan=validateSyntheticPlan(payload,scenario);
 const tasks=plan.milestones.map((m,i)=>({
  id:'demo-'+scenario.id+'-milestone-'+(i+1),
  title:m.title,week:m.week,estimatedHours:m.hours,reason:m.reason,deliverable:m.deliverable,
  completed:false,syntheticOnly:true
 }));
 requireTrue(tasks.length>=2&&tasks.length<=6,'演示阶段数量不合法');
 return Object.freeze({
  caseId:scenario.id,goal:scenario.goal,source,
  syntheticOnly:true,storage:'none',requiresApproval:true,
  tasks:tasks.map(x=>Object.freeze({...x})),
  warning:'这是短暂的合成任务预览。周次不是实际日历日期；批准后不会写入真实课表或浏览器存储。'
 });
}
export function approveSyntheticPreview(preview,approved,{now=new Date()}={}){
 requireTrue(approved===true,'缺少用户的二次明确批准，禁止执行');
 requireTrue(preview&&getSyntheticCase(preview.caseId),'未经许可的案例');
 requireTrue(preview.syntheticOnly===true&&preview.storage==='none'&&preview.requiresApproval===true,
  '不是经过安全验证的临时合成预览');
 const stageWeeks=preview.tasks?.map(x=>x.week);
 requireTrue(Array.isArray(stageWeeks)&&stageWeeks.length>=2&&stageWeeks.length<=6,'待批准任务不存在');
 requireTrue(stageWeeks.every((v,i)=>Number.isInteger(v)&&v>=1&&(i===0||v>stageWeeks[i-1])),
  '阶段周次无效');
 const scenario=getSyntheticCase(preview.caseId);
 requireTrue(stageWeeks.every(w=>w<=scenario.weeks),'演示周次超出范围');
 requireTrue(preview.tasks.every(t=>t.syntheticOnly===true&&Number.isFinite(t.estimatedHours)&&
  t.estimatedHours>0&&t.estimatedHours<=scenario.weeklyHours &&
  (t.week!==scenario.examWeek||t.estimatedHours<=2)),'沙盒任务违反学习投入约束');
 return Object.freeze({
  caseId:preview.caseId,source:preview.source,approvedAt:new Date(now).toISOString(),
  syntheticOnly:true,storage:'none',undoAvailable:true,approvalCount:1,
  tasks:preview.tasks.map(x=>Object.freeze({...x}))
 });
}
export function undoSyntheticApproval(session){
 requireTrue(session?.syntheticOnly===true&&session.storage==='none'&&session.undoAvailable===true,
  '没有可撤销的合成任务会话');
 return Object.freeze({
  caseId:session.caseId,syntheticOnly:true,storage:'none',
  undoAvailable:false,approvalCount:0,tasks:[],
  lastAction:'approved synthetic tasks undone'
 });
}
