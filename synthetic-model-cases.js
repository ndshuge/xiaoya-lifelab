// Hard-coded fictional scenarios only. These IDs are the entire model API input surface.
export const SYNTHETIC_CASES=Object.freeze([
 Object.freeze({id:'chip-midterm',name:'芯片作品与期中考试',goal:'12周内完成可展示的FPGA计数器仿真',baseline:'虚构：大一，学过C语言基础，数字逻辑刚入门',weeklyHours:6,weeks:12,examWeek:2,
  constraints:['第2周期中考试，需要将额外项目学习降低到2小时以内','目前没有FPGA硬件，优先仿真验证','每天课程较满，不承诺真实空闲时段']}),
 Object.freeze({id:'english-speaking',name:'英语口语与社团',goal:'8周完成英语主题演讲和录音复盘',baseline:'虚构：阅读基础一般，口语练习不足',weeklyHours:4,weeks:8,examWeek:null,
  constraints:['每周社团活动占用一个晚上','需要录音成果和自评记录','不预测考试成绩']}),
 Object.freeze({id:'coding-project',name:'编程项目与作业期限',goal:'10周做出可演示的校园任务管理小工具',baseline:'虚构：会基础Python，尚未写过完整项目',weeklyHours:5,weeks:10,examWeek:3,
  constraints:['第3周有数学测验，项目投入应减少','每阶段需要可运行的测试或具体交付物','不自动访问外部代码仓库']})
]);
export function getSyntheticCase(id){
 if(typeof id!=='string')return null;
 return SYNTHETIC_CASES.find(c=>c.id===id)||null;
}
export const PLANNING_OUTPUT_SCHEMA=Object.freeze({summary:'string',milestones:'array {week:integer,title:string,hours:number,reason:string,deliverable:string}',risks:'string[]',assumptions:'string[]'});
