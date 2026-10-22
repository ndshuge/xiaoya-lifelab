export function initByokUI(){
 const $=s=>document.querySelector(s);
 const put=(id,s)=>{const e=$(id);if(e)e.textContent=s};
 const ids=['#ai-global-entry','#ai-today-panel','#ai-mode-dashboard','#ai-goals-banner'];
 for(const id of ids){const e=$(id);if(e)e.dataset.aiMode='offline'}
 document.querySelectorAll('[data-ai-capability-state]').forEach(e=>{e.dataset.mode='offline';e.textContent='公开演示 · 本机规则'});
 put('#ai-global-title','规则模式');put('#ai-global-subtitle','公开静态版');
 put('#ai-goals-banner-title','规则规划可用 · 云端 AI 未包含');
 put('#ai-goals-banner-summary','公开版只提供无需账号的本机功能。真实 AI 个性化规划仅在私有 Node 运行版经用户主动配置与授权后可用。');
 put('#ai-today-summary','课表、任务、成长路线和复盘在当前浏览器中运行；静态站不连接任何模型服务。');
 put('#ai-ability-cloud-status','静态版未提供');
 put('#ai-mode-headline','本机规则规划随时可用');
 put('#ai-mode-summary','无需 API。公开静态版禁用云端规划，不会上传档案或申请 API Key。');
 put('#ai-mode-cloud-state','静态公开版不可用');
 put('#ai-mode-truth','网站不提供服务器端的 AI Key 托管或推理代理；配置请使用单独本机版本。');
 for(const id of ['#growth-ai-generate','#byok-save','#byok-test']){const e=$(id);if(e){e.disabled=true;e.title='GitHub Pages 静态版不提供云端 API 服务'}}
 for(const id of ['#byok-key','#byok-base','#byok-model','#byok-provider']){const e=$(id);if(e)e.disabled=true}
 const form=$('#byok-form');if(form)form.addEventListener('submit',e=>e.preventDefault());
 put('#byok-status','GitHub Pages 公开版 · 无服务器 API');
 put('#byok-form-result','安全说明：本版本不接收 API Key，也不会请求付费模型。请勿在任何公开网页输入私人 API Key。');
 put('#growth-ai-status','AI 智能规划在静态版不可用；上方规则成长路线可正常生成。');
 const v=$('#growth-ai-consent');if(v)v.disabled=true;
 for(const id of ['#growth-ai-config-link','#ai-today-connect','#ai-goals-banner-action','#ai-mode-connect']){const e=$(id);if(e){e.disabled=true;e.title='公开静态版本不提供服务端模型连接';e.setAttribute('aria-disabled','true')}}
}
