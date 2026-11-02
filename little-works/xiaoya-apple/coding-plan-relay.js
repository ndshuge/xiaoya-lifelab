// HanaAgent/Coding Plan manual relay: only three hard-coded synthetic cases.
// No programmatic access to HanaAgent's auth, session or private configuration.
import {getSyntheticCase} from './synthetic-model-cases.js';
import {createSyntheticPrompt,validateSyntheticPlan} from './local-model-lab.js';
const check=(condition,message)=>{if(!condition)throw Error(message)};
export function makeCodingPlanPrompt(caseId){
 const scenario=getSyntheticCase(caseId);
 check(!!scenario,'只支持内置的合成案例');
 const messages=createSyntheticPrompt(scenario);
 return [
  '小芽 LifeLab · Coding Plan / HanaAgent 合成规划实验',
  '这是纯粹虚构的大学生案例；不要读取本地文件、私人数据、浏览器档案、工具或凭据，不要执行任何操作。',
  '请只返回一个 JSON 对象，不要 Markdown、代码围栏或额外解释。',
  messages[0].content,
  '合成测试数据：'+messages[1].content,
  '请依据以上输入制定可实际检查的学习阶段，遵守考试周和每周投入上限。',
  '返回的内容将由小芽本地校验后仅用于预览，不会直接变成任务。'
 ].join('\n\n');
}
export function parseCodingPlanText(text,caseId){
 const scenario=getSyntheticCase(caseId);
 check(!!scenario,'无效的合成案例');
 check(typeof text==='string'&&text.trim().length>0&&text.length<=20000,'粘贴内容不能为空或超过20000字符');
 const plain=text.trim();
 let json=plain;
 if(plain.startsWith('```')){
  const match=/^```(?:json|JSON)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(plain);
  check(!!match,'只支持完整的JSON代码块，不允许附带其他文字');
  json=match[1].trim();
 }
 let payload;
 try{payload=JSON.parse(json)}catch{throw Error('请粘贴合法JSON；不要包含解释文字或工具执行指令')}
 check(payload&&typeof payload==='object'&&!Array.isArray(payload),'输出不是JSON对象');
 const allowed=['summary','milestones','risks','assumptions'];
 check(Object.keys(payload).every(k=>allowed.includes(k)),'存在未获许可的模型输出字段');
 check(Array.isArray(payload.milestones),'缺少阶段数组');
 for(const [i,m] of payload.milestones.entries()){
  check(m&&typeof m==='object'&&!Array.isArray(m),'阶段格式无效');
  check(Object.keys(m).every(k=>['week','title','hours','reason','deliverable'].includes(k)),'第'+(i+1)+'阶段含有未经许可的操作字段');
 }
 const plan=validateSyntheticPlan(payload,scenario);
 return {
  mode:'coding-plan-relay',provider:'Coding Plan / HanaAgent · 用户手动提供',
  syntheticOnly:true,privateDataUsed:false,automaticCalls:0,
  verifiedBy:'xiaoya-local-schema',caseId,plan,
  warning:'本机已验证输出结构与时间预算；来源依赖粘贴者提供，无法自动核验模型身份。仅供审阅，不会自动执行。'
 };
}
