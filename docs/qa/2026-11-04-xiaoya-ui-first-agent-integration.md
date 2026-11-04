# 小芽 LifeLab｜UI 优先发布 + Student Agent V3 功能集成报告
日期：2026-11-04

## 第一阶段：最新版 UI 已发布，并在线核验
- **UI 来源**：`feature/xiaoya-living-motion-vnext-20261104@9299bc8`，由原生最新主线 `05d48f6` 在独立干净 worktree `E:/CHATGPT/projects/_xiaoya_ui_publish_20261104` 合并。
- **实际发布 SHA**：`451fc1256034c132122e5f9aa146d3a07af827b7`（先发布，才开始功能集成）。
- **GitHub main**：普通非强制推送 `05d48f6..451fc12`，未更改存在大量未提交内容的原 `xiaoya-pages` 工作树。
- **线上核验**：`https://ndshuge.github.io/xiaoya-lifelab/?judge=1`、V4 静态入口和 `app.mjs` 实际 HTTP 200；线上内容含 `living-motion.css?v=5.1.0` 和 `shared-motion.mjs?v=5.1.0`，高清 mood 图片 HTTP 200。
- UI 自动化测试发布候选 **179/179**；原 UI Dock、渐变模糊、五张高清心情形象、时间轴、长按、Magic Move、中文三栏导航原封不动，Dock 相关代码无改动。
- **边界**：实际 iPhone Safari 真机未验证；HTTP 200 和浏览器模拟不等于真机人工验收。

## 第二阶段：功能来源与移植清单
- 只从 `feature/xiaoya-competition-core-realign-20261104@d566bcc` 单独 restore 以下独立业务与测试文件：
  - `student-agent.js` + `student-agent.test.mjs`
  - `adaptive-growth-agent.js` + `adaptive-growth-agent.test.mjs`
  - `adaptive-growth-provider.js` + `adaptive-growth-provider.test.mjs`
  - `context-agent.js` + `context-agent.test.mjs`
  - `weather-forecast.js` + `weather-forecast.test.mjs`
  - `context-actions.js` + `context-actions.test.mjs`
- **故意不 cherry-pick 旧 UI / CSS / JS 页面**，旧分支的 `app.mjs`、`index.html`、高清立绘删除记录全部不使用。
- 以刚发布的 `origin/main@451fc12` 为基础建立新 worktree：
  `E:/CHATGPT/projects/_xiaoya_agent_integration_20261104`、分支 `feature/xiaoya-agent-v3-ui-integration-20261104`。
- 新 `native-v4/agent-bridge.mjs`、`agent-bridge.css`：适配 VNext 页面与已有 Sheet、Toast、store，保持三栏/单头像导航；少量 patch `app.mjs`、`assistant.mjs`、`index.html`。
- `今天`：复用原先 `#dayflow-suggestion` 的卡片位置，显示最多一条重要的本地依据建议，其他可折叠，避免抢掉今日日程与任务首屏；预览、批准、稍后或拒绝。新增后可撤销。
- `事项`：任务、课程、单次活动仍在原系统；建议附带真实来源。活动编辑中增加明确的“户外活动”标记，天气风险必须同时具备这个标记才会出现；预览批准后只在当前档案建立一件准备任务。
- `发展`：在原“目标”页面追加“每周节奏”区，与原“制定新的成长路线”功能并存；四周规则/可选模型路线、目标证据、当周单次行动预览、批准及撤销；数据变化后旧计划自动失效。
- `设置`：本次会话城市选择、独立天气/本地心情授权、请求天气/随时撤销；六个城市均为粗略经纬度，不启用 GPS。没有同意不发网络请求。天气获取须独立点击“获取预报”。
- `对话`：唯一小芽头像仍是入口，新增结构化数据驱动的本地问答（今天/明天、计划、成长、天气、心情），未授权时不读取心情。既有 BYOK 自由对话只发送用户手动键入内容。
- 成长模型 BYOK：用户必须在成长界面主动填写服务商、模型 ID、Key，勾选“发送成长目标摘要”授权并明确点击；连接时不发送摘要，只有再按“分析未来四周”才发请求。Key 仅内存、切换档案/撤销/断开即清除，模型失败安全回退为本地规则。
- 每次审批使用原业务模块的短时 token 和档案指纹、事务撤销；新意见不自动改课表、截止日期或日记。不凭空生成成绩、健康或精神状态诊断。
- **隐私策略**：天气/心情 consent 为当前页会话，不持久化，每个档案切换后全部撤销；正在进行中的天气或模型异步结果在撤销、切换城市或切换档案后以 generation token 丢弃；心情只在本地读取用户主动保存的当天数值，日记正文不送任何第三方模型或天气服务。私人/合成演示模式存储仍隔离。

## 天气服务条款确认
- 官方 `https://open-meteo.com/en/terms` 当前免费 API 要求非商业用途且 CC BY 4.0 署名；未为产品开启商业使用资格。
- UI 已显示 Open-Meteo + CC BY 4.0 署名、城市、更新时间、降水概率不代表活动时段必然降雨。作为教学/比赛展示时仍应遵守服务条款；若日后广告、订阅、商业用途，必须改用商用许可。
- 自动化 E2E 使用代理模拟 JSON 响应，**不代表真实网络预报已在用户手机测试**。

## 第三阶段验收与质量闸
- 业务单测：`node --test little-works/xiaoya-apple/{student-agent,adaptive-growth-agent,adaptive-growth-provider,context-agent,context-actions,weather-forecast}.test.mjs`，**53/53**（包括注入、未授权、过期、伪造、重复审批、撤销、无网络、密钥校验）。
- 原生浏览器闭环：`node little-works/xiaoya-apple/native-v4/qa-agent-bridge.cjs`，最新 **20/20**（Edge + WebKit）：实际建议预览→批准→执行→撤销、四周规划、户外活动→天气模拟→准备待办、撤销授权、没有未授权模型调用、高清图与 Dock 保留。
- 首页旧版结构测试：`qa-dayflow-browser.cjs` **11/11**，验证今天真正的日程和助手建议同屏、主导航仅三栏、桌面版布局。
- V4 UI 回归：`qa-dayflow-browser.cjs` 11/11、`qa-vnext-phase2.cjs` 18/18、`qa-vnext-longpress.cjs` 10/10、`qa-vnext-timeline.cjs` 12/12、`qa-v4-three-tab.cjs` 13/13、`qa-v4-five-mood-sprites.cjs` 10/10；深夜旧 Dock 测试原先隐含要求“今天当前有课程”，和现实时间相关，已重写测试选择逻辑和状态式按钮反馈断言而**不修改 Dock runtime**，独立再测 14/14。后续补充测试状态以实际命令输出为准。截图证据在 `docs/qa/evidence/2026-11-04-xiaoya-agent-v3/`。
- **永久未取得验证**：实际 iPhone Safari、真人隐私授权使用测试、付费真实云模型返回和真实天气网络端到端服务；用户未给出真实 BYOK Key，本轮没有调用付费 API。
- 版本最终线上 SHA 与最新测试结果应在发布后再补。**不得把本地通过当成正式已上线**。
