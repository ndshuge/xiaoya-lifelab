# 小芽易懂 UI：Task 0–8 本地施工与验收（2026-11-17）

状态（发布前 QA 快照）：**代码已在本地独立工作树实现；单元与模拟浏览器回归通过；已查看实际截图；尚未做 iPhone Safari 真机验收。** 后续 GitHub 发布与 Pages 在线状态以对应 PR、主分支提交和线上实测为准。
本报告为施工计划指定的唯一阶段 QA 文档。原始施工包与参考图未删除。

## 工作树与边界

- 源仓库：`E:/CHATGPT/projects/_xiaoya_judge_multiagent_20261108`，远程 `ndshuge/xiaoya-lifelab`。
- 独立工作树：`E:/CHATGPT/work/xiaoya-simple-ui-20261117`，分支 `feature/xiaoya-simple-ui-20261117`，以核对后的 `origin/main` (`e5b88cf37c6ef80ca17fe54a32461948694dfa15`) 起步。没有改写旧 release 分支。
- 用户补充的最高优先级边界：**Task 7 仅改设置**。因此没有执行原计划 Task 7 的「默认折叠今日方案/多个建议精简/日页面大面积重新排版」。日、周、长线原有纸岛与整体视觉语言保留；Task 4/6 为独立口袋与心情所需的日页轻量入口调整照做。
- 没改 `native-v4/store.mjs`、`journal-store.mjs`、`domain.js`、模型协议、3D 模型、数据 schema 或 LocalStorage key；任务与日记共用原存储，不复制第二份业务数据库。原审批、撤销与模型授权路径保留。
- 新模块仅承载导航、设置 HTML/局部 patch、口袋视图、心情视图及日期统计；`app.mjs` 负责对接原业务。

## 顺序实施记录

| Task | 实际改动与验证 | 状态 |
|---|---|---|
| 0 基线 | 读取施工包规格/参考/AGENTS，核对 origin，隔离工作树；原 69/69 Node 测试和原 qa-audit Edge/WebKit 24/24 基线通过，并比照原项目已有视觉证据 | 完成 |
| 1 五个目的地 | 顶栏 日/周/长线/口袋/心情，同级导航；保留旧 `setScale` 与旧偏好归一化；五项键盘左右/Home/End，320px 无横溢 | 完成 |
| 2 分层设置 | 设置首页仅六类导航，内部同一 Sheet；学期/提醒/外观分域局部 patch，不出现「保存全部设置」，未保存退出须确认 | 完成 |
| 3 其余设置 | 备份恢复/操作记录/模型/权限/记忆/教学/关于移入分类；天气请求显式授权、切档案或撤销后失效；模型 Key 仍只在内存，日记授权独立确认 | 完成 |
| 4 口袋 | 独立无截止/有截止/已完成筛选、编辑/完成/恢复/删除/安排，安排仍关联原 task ID 与截止时间；日页面保留逾期提示入口；实测 200 条末项可达 | 完成 |
| 5 真实序列 | 7/30/90 天心情投影，缺失日期断线，不补值；8 周目标行动只统计已记录 check-in 的次数/分钟；闰日、重复、非法输入纯测试 | 完成 |
| 6 心情闭环 | 独立首页/历史/趋势，显式日期的心情或正文单独记录，编辑、补记、dirty 拦截、删除撤销；图表选点/文本表；长线目标8周柱图；迁移教学入口 | 完成 |
| 7 用户限定 | 只对设置的状态反馈、局部持久化、授权可见性和 320px 弹层细节做收口；没有按旧计划大改日页布局/建议系统 | 按用户补充完成 |
| 8 整体验收 | 单元、原业务浏览器回归、新界面专项、4种视口、暗色/减少动效、截图实看、文件范围检查 | 完成，真机/发布另见下文 |

## 实际运行结果

- `node --test little-works/xiaoya-apple/opus-original/tests/*.test.mjs`：**76/76 PASS**（原 69 项 + 新 7 项）；最终重跑退出 0。
- `node little-works/xiaoya-apple/opus-original/qa-audit.cjs --webkit`：Edge **12/12** + WebKit **12/12**；原业务断言未删，只更新已迁移设置入口的测试定位。
- `node little-works/xiaoya-apple/opus-original/qa-opus.cjs`：Edge **21/21**；`--only-webkit`：WebKit **21/21**。覆盖铅笔审批/擦掉、智能录入、提醒、空时段、调课、日计划、模型工具权限、天气显式同意、档案切换导出、移动与暗色。
- `node little-works/xiaoya-apple/opus-original/qa-simple-ui.cjs` 与 `--webkit`：**两引擎均退出 0、全部专项阶段 PASS**。涵盖五导航与键盘、设置局部保存/撤销、口袋创建/安排/完成/恢复、心情单独写/改/删/撤销、7/30/90与目标图、档案隔离、320/390/768/1440、200条长列表末项和暗色/减少动效。
- `node --check` 对 `app.mjs` / QA 脚本通过；`git diff --check` 退出 0（Windows CRLF 换行提醒不视为错误）。

上述网络与模型场景是 Playwright 本地固定时钟、隔离 context 和 mock API；没有调用真实收费模型或用户账户。**测试通过不等于用户体验认可或正式发布。**

## 视觉证据与实看修正

- BEFORE 参照：本地施工包 `E:/CHATGPT/work/xiaoya-simplify-plan-20261117/references/current/` 五张原始问题图，以及仓库原有 `docs/qa/evidence/2026-11-05-opus-original/` 视觉证据。它们不是这轮改版后的图；没有伪称重新拍摄的新 BEFORE。
- AFTER 目录：`docs/qa/evidence/2026-11-17-xiaoya-simple-ui/`（Edge/WebKit 同名成对）。
- 已实际打开检查：`stage2-settings-home-390-edge.png`、`stage4-pocket-390-edge.png`、`stage4-pocket-200-last-390-edge.png`、`stage6-journal-home-320-edge.png`、`stage6-journal-editor-390-edge.png`、`stage6-journal-trend-390-edge.png`、`stage8-journal-1440-edge.png`、`stage8-settings-dark-reduced-390-edge.png`。另保存各引擎 320/390 导航、768/1440 心情、暗色/减少动效证据。
- 实看发现 320px 心情 SVG 坐标字太小：在 ≤390px 下单独放大坐标字号；重新跑 Edge/WebKit 专项并实看 `stage6-journal-home-320-edge.png`，日期与 1–5 轴已可辨。
- 200条列表末项截图确认可滚动到固定输入 Dock 之上，未被遮住。
- 设置保持原本纸质暖色、暗色与小芽吉祥物；无全站通用后台模板、星芒装饰和大面积品牌风格替换。

## 迁移、失败与剩余边界

- 深度回归第一次因旧档案选择器命中两个入口报错，造成后续场景连锁失败；只收紧测试导航路径、保留原断言，随后 Edge/WebKit 全量 21/21 通过。早期一次 qa-audit WebKit 由于保存后读回时序不稳，增加等待持久化条件后 12/12 通过。
- 无未解释 P0 业务回归；真机 Safari（尤其键盘/安全区/手势）、真实个人档案迁移、真实收费模型 API、用户对 UI 的主观认可均**未验收**。外部参考 Designeer/Mobbin 的来源仍为 SOURCE_BLOCKED，未绕过安全验证或付费。
- 本 QA 快照生成时尚未 commit/push/部署；发布动作与在线验证应另行记录，不把测试通过直接等同于上线。

## 本地预览

在 PowerShell 执行：

```powershell
Set-Location E:\CHATGPT\work\xiaoya-simple-ui-20261117
node little-works/xiaoya-apple/opus-original/qa-simple-ui.cjs --serve
```

再在同台电脑浏览器打开：
`http://127.0.0.1:8765/little-works/xiaoya-apple/opus-original/?judge=1&intro=0&tips=0&history=0`

`judge=1` 使用合成演示档案，不是用户个人数据。已实测预览服务返回 `.mjs` 为 `text/javascript`；本机 Python HTTP 服务会给出 `text/plain`，不适合直接启动此 ESM 页面。服务只监听 `127.0.0.1`，按 Ctrl+C 关闭。

交付界限：**本地代码与模拟浏览器功能通过；非真机、非用户确认。线上发布状态另以实际主分支和 Pages 校验结果判定。**
