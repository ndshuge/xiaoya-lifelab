# 小芽 Native V4｜Apple 产品研究、全站审计与分轮工程改造
**审计日期：2026-11-03 · 研究/截图/实测证据来自本轮**
**正式仓库：** `ndshuge/xiaoya-lifelab` · **本轮基线：** `8b16c031` · **施工工作树：** `feature/xiaoya-v4-full-apple-audit-20261103`。
**评委固定 URL：** https://ndshuge.github.io/xiaoya-lifelab/?judge=1 。根页面将此地址重定向到本仓库 `native-v4`；不能把它误认为 ndshuge-galaxy 的仓库页面。保留 `native-v3` 源码和历史作品。

## A. 产品、用户与原设计约束

小芽面向大学生个人：围绕今天的安排、真实课程、作业 DDL、无期限待办、心情日记和长期成长给出轻量建议。它是生活与成长陪伴工具。**知序 AI 学院**的课程讲解与知识诊断不属于小芽。

主要任务按频率：**今天**（现在要做什么/有无冲突/实际截止）→ **事项**（课表+DDL+不定期待办）→ **发展**（心情、日记、成长目标）→ **小芽 AI**（唯一角色头像入口）→ **设置**（模式、隐私备份、学期、提醒）。要保留小芽原版角色及清淡绿色识别、既有数据和 AI 明确授权。不要默认把 Demo 当真实数据，不要让 DDL 冒充执行时间，不要把统计相关性当因果，不要用卡片和玻璃填满空白。

**当前发布模式：** 纯 HTML/CSS + ES Modules 的 GitHub Pages 静态站点，依赖浏览器 localStorage，组件包含 `../glass/components.js` 的 `lg-switch`。客户端不同模式数据隔离；不存在自动同步服务。可以借用 iOS 26/27 的 *设计原则*，但不能声称是 Apple 原生 UIKit 或 SwiftUI。

## B. Apple 官方资料与真实案例研究

| 已打开的原始资料 | 已确认的原则 | 小芽落实 / 不采用的方案 |
| --- | --- | --- |
| [Apple HIG · Layout](https://developer.apple.com/design/human-interface-guidelines/layout) / [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | 导航和内容是不同层；Liquid Glass 主要属于导航及控制层 | 保留 L0 实心内容面、L1 浮动 Dock 和对话；不让每张白卡变成磨砂 |
| [Apple WWDC25 · Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/) | 一个视图避免叠加多个 scroll-edge 效果；排版、同心曲率、层级与触控空间是整体系统 | 当前旧版 Dock 双重白雾列为 P1；另有独立 motion 分支修复并需单独中间帧验收 |
| [Apple WWDC25 · Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) | 玻璃与背景相互关联，主要承载控制，而非内容装饰 | 原项目只有 CSS blur，可验证 L1；不将其报告为真实光学折射 |
| [Apple WWDC25 · Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/) | 单色图标、控件在内容上层、滚动边缘的渐进可读性 | 保留稳定的单头像、单 Dock 与上下文创建按钮；不用整屏流动玻璃 |
| [Apple Developer · Design Resources](https://developer.apple.com/design/resources/) | 原生控件对齐和系统视觉是比较基准，2026 年官网也已发布 iOS 27 的设计工具包 | 使用官方作为语义和尺寸参考；**未复制** Apple 图标或字体文件 |
| [Apple Reminders · Get started](https://support.apple.com/guide/iphone/get-started-with-reminders-iphc7880ecd6/27/ios/27) / [Add details](https://support.apple.com/guide/iphone/add-details-iphec7a1de82/27/ios/27) | 先快速记录，再按需增加提醒/日期/细节 | 小芽已有标题＋可选 DDL 快捷表单，保留高级选项折叠 |
| [Apple Journal · Get started](https://support.apple.com/en-sg/guide/iphone/iph0e5ca7dd3/27/ios/27) / [Edit/Delete](https://support.apple.com/guide/iphone/edit-or-delete-an-entry-iph1607b2f45/27/ios/27) | 记录可以不填满表单；回顾、修改和删除是明确动作 | 记录/目标独立次级视图、草稿暂存、主动保存、可删除；避免自动上传 AI |
| [Apple WWDC26 · Modernize your UIKit app](https://developer.apple.com/videos/play/wwdc2026/278/) | 最新版本强调适配不同窗口尺寸以及系统导航控制，而非复制固定截图 | 320/390/768/1440 分别测，原生 iOS 27 细节仅作研究参考 |

**案例观察边界：** 上述为实际打开的官方设计页/WWDC 文本与官方 App 使用文档；没有遥控 Apple 自有 App，也未取得可逐帧分析的 Apple 内部弹簧运动实测样本。不能虚构具体阻尼系数或每帧位置。

## C. GitHub 开源方案筛选（2026-11-03 核查）

| 已打开的项目 | 样本活跃度 / 许可 | 适合借鉴 | 决策 |
| --- | --- | --- | --- |
| [Memos](https://github.com/usememos/memos) | 约 64k Star、MIT；持续更新 | 快速日记输入、时间线和个人数据持有 | **采纳交互思路，不搬 React/Go 整套代码** |
| [Super Productivity](https://github.com/super-productivity/super-productivity) | 约 23k Star、MIT；2026-10 仍活跃 | 定时计划、截止任务与收集箱分离 | **采纳日期语义**，不移植大型任务引擎 |
| [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | 约 78k Star、AGPLv3 | 按工作任务切换视图、复杂属性延迟展示 | 借鉴结构；**不复制 AGPL 代码**、不改平台架构 |
| [Loop Habit Tracker](https://github.com/iSoron/uhabits) | 约 10k Star、GPLv3 | 长期目标以实际行动而非花哨 KPI 呈现 | 借鉴反馈规律，**不复制 GPL 原生安卓实现** |
| [Motion](https://github.com/motiondivision/motion) | 约 34k Star、MIT；仍维护 | 可中断目标运动、Spring、动画状态管理 | 可以用于复杂新组件；**此次未安装**，现有 ES Modules 与 CSS 足够 |
| [react-spring](https://github.com/pmndrs/react-spring) | React 专用、MIT | 手势/阻尼、物理过程 | **拒绝**：仅为 V4 动效重写 React 得不偿失 |
| [liquidglass.dev / Liquid Glass for Web Skill](https://liquidglass.dev/) | 已读取其引擎限制说明；浏览器兼容依赖背景模式 | 可解释真实 SVG 位移、缓存和 WebKit 风险 | 固定 Dock 覆盖任意滚动 DOM 无法保证所有内核都 L2；**不虚假集成、不直接叠强滤镜** |

结论：Star 衡量社区体量，不代表适合小芽。当前依赖增加的风险高于收益；先修实测的按钮、布局和状态管理。源码研究用于设计取舍，没有拷贝第三方图像/代码文件。

## D. ChatGPT 原生插件 Skill 调用与应用记录

插件 Skill 通过 **ChatGPT 的** `skills__list` 和 `skills__read` 加载；Mice Hole 只读写用户授权的 Windows 工作区。

| Skill（实读） | 解决的问题 | 实际状态 |
| --- | --- | --- |
| `shuge-apple-product-audit` + `AUDIT_MATRIX.md` | 全部页面/状态/触控/材质/性能的覆盖矩阵 | **READ → APPLIED**：生成 38 个页面状态证据与 P0/P1/P2 问题表 |
| `shuge-apple-design` + REFERENCE_LIBRARY / INTERACTION_SPEC / QUALITY_GATES | Apple 原始证据、材料分层、中断生命周期、分开验收 | **READ → APPLIED**：官方链接、真实/模拟环境分栏 |
| `apple-web-design` / `apple-liquid-glass` + app / motion | iOS 结构、玻璃只用于重叠层、按钮与焦点 | **READ → APPLIED**：开关命中区/弹窗触控修复 |
| `liquid-glass-web` | 真实折射与 WebKit 限制 | **READ / ASSESSED**；没有导入其引擎、没有宣称 L2 |
| `motion` | Spring/可中断运动研究、性能边界 | **READ / ASSESSED**；没有安装 JS Motion 库 |
| `frontend-dual-source`, `design-taste-frontend`, `finesse-ui`, `impeccable` | 真实截图、避免模板卡片、减少无用图标、检验信息密度 | **READ → APPLIED**：删除 3 个重复开关图标并做前后对比 |
| `prism` | React/WebGL 视觉技术对照 | **READ / REJECTED**：当前产品不应引入整套 React/3D 框架 |
| Product Design `get-context`, `audit` | 产品语义与截图/步骤证据 | **READ → APPLIED**：按实际屏幕记载问题，非凭印象计分 |

**没有**把插件名写入 AGENTS 就当作引擎运行；没有调用本机虚假的 Skill 路径，也没有声称获得 Apple 设计授权。

## E. 全站页面、组件和状态审计矩阵

实际使用 Playwright Edge，在**相同演示档案**下收集 **38 个屏幕/运行时状态记录**，截图及 `inventory.json` 分别位于本机 `E:/CHATGPT/work/xiaoya-v4-comprehensive-audit-20261103/{base,after-final}/`。精确的每个控件尺寸与标签均可在该 JSON 中复核。

| 页面/路径 | 核心控件与状态 | 完整性/风险 | 本轮确认 |
| --- | --- | --- | --- |
| **今天** | 顶部小芽头像、日期/演示标识、完成日程摘要、建议预览/拒绝、任务完成/编辑、Dock | P1：过去的长时间轴/建议在移动端可能仍过密；材料层待 motion 分支验收 | 390/320/768/1440 截图、按钮检索、首页功能回归 |
| **事项→日程** | 日程/独立待办分段、上/下周、本周、七日选择、截止提醒、课程/活动、时间轴、课表导入/日历导出 | P1：时间轴 + Dock 在真实 iPhone 地址栏伸缩下有遮挡风险 | 浏览器视口/滚动及数据语义已验证；**Safari 真机未验** |
| **事项→独立待办** | 增加待办、未安排任务、已安排 DDL、完成/恢复、编辑 | P0 风险：长任务、无期限/逾期状态；由原功能测试覆盖 | 快捷新增/完成/数据恢复回归通过 |
| **发展→记录** | 五级心情、日记输入、保存/删除、历史记录、7/30 天数据、AI 提问 | P1：5 个心情仍为独立小白卡，属于后续视觉减法候选 | 数据隔离/草稿/统计回归，未改存储 |
| **发展→目标** | 新建目标、行动打卡、进度、已完成目标、成长路线规划、路线确认 | P2：部分按钮视觉层级仍不统一 | 目标及生成器回归通过，隐藏状态误报排除 |
| **设置** | 安静模式、减少动效、提醒开关、学期日期、夜间免打扰、JSON 导出/导入、清空、版本浏览 | **P1**：三个开关每行都重复相同设置图标；**P0**：原实际命中高度 28px | **修复并复验** |
| **AI 对话** | 头像进入、AI 接入设置、离线规则提示、消息日志、快捷提问、发送、关闭/焦点恢复 | P1：iPhone Safari 软键盘与 Dock 同时出现的真实行为未验证 | 390px Chromium 与既有 AI 恢复测试通过；未经授权不发送档案 |
| **编辑 Sheet** | 新增提醒快/高级、从日期新增 DDL、保存/取消、Escape、遮罩、输入验证 | **P0**：取消/保存只有 48×36px；长表单/输入法需实机核查 | **修复为 48×44，正反状态实测** |
| **Toast / 反馈** | 提交成功提示、自动消失、警告/错误文本 | 交互与 Dock 可能重叠，须测实际图层 | 保存后 Toast 与 Dock 非重叠测试通过；4s 恢复可操作 |
| **历史版本/备用旧视图** | V3 版本切换、历史高阶视图、查找、导入备份 | 旧路由功能存在但非 V4 主导航 | 原 V3 评委/AI/成长与版本回归通过 |

**当前无横向溢出：** 在已覆盖的 320/390/768/1440 四种视口，38 条状态的 `document.documentElement.scrollWidth - innerWidth = 0`。
**无名称计数的解释：** DOM 粗扫描把原生输入框的 `aria-label` 为空视为可疑；逐项验证 `label[for]` 后，任务标题和截止日期输入并不是真正无可访问名称。发展页隐藏 `<details>` 中的节点也不可视为直接缺陷，剩余目标表单读屏语义待真人/屏幕阅读器验证。

### P0 / P1 / P2 问题台账

| ID | 严重性 | 精确证据与原则 | 实施与验收条件 | 状态 |
| --- | --- | --- | --- | --- |
| XY-01 | **P0** | `#editor .sheet-cancel/.sheet-save` 实际 48×36px，低于 44px；触控可用性 | CSS 保持小字体和原布局，将命中框扩至 ≥44px；Playwright 实测 | **FIXED / VERIFIED** |
| XY-02 | **P0** | `lg-switch .lg-switch__input` 原 64×28px；视觉轨道尺寸与真实命中区混淆 | 仅真实 input 增大至 64×44px、原轨道仍 64×28；Space 键可切换 | **FIXED / VERIFIED** |
| XY-03 | **P1** | 设置「使用体验」三个开关前重复绿色设置图标，信息无增益；Apple 节制 | `switchRow` 改为纯标签+原开关；真实截图对比、功能不变 | **FIXED / VERIFIED** |
| XY-11 | **P0** | 编辑 Sheet 使用原生 Escape 取消时，`close` 事件异步触发前页面可能残留 `overflow: hidden`；4 次重复测试在修复前检出一次 | 在 `cancel` 事件中同步调用已有 `closeSheet()`；修后连续 4 轮 × 10 项浏览器断言均通过 | **FIXED / VERIFIED** |
| XY-04 | **P1** | 旧主页面跳换与 Dock 白雾、动效重影。另一个脏工作树正在编辑 `motion-dock.css` + `app.mjs` | 独立 motion 分支需合并前检查中间帧、取消、反向、Reduced Motion 和 Safari WebKit | **OPEN — 刻意未覆盖并行工作树** |
| XY-05 | **P1** | iPhone 原生浏览器 toolbar / 地址栏伸缩 / 软键盘易挡浮动 Dock 和聊天输入 | iPhone Safari 真机视频与输入滚动验收；必要时 visualViewport 安全区降级 | **UNVERIFIED — 需真机** |
| XY-06 | **P1** | 发展页 5 片心情面板及长内容，仍有重复卡片感 | 对照 Apple Journal/Health 做一组连续可选控件，验证方向及失误率 | **FIXED / VERIFIED：连续心情控件，保留 5 级含义和浏览器本地存储** |
| XY-07 | **P1** | 目前仅默认浅色；深色系统外观和增大字号并未全面证实 | 完整暗色语义 token、200% 缩放/高对比度手动测试 | **OPEN / UNVERIFIED** |
| XY-08 | **P2** | AI 配置和目标高级表单的全部名称/错误反馈 | 逐控件键盘/屏幕阅读器矩阵，验证真实 AI 连接失败提示 | **PARTIAL** |
| XY-09 | **P2** | 原 CSS 设计层多文件堆叠，长期增加维护难度 | 风格 token 统一、逐层排查重叠 selector，在无行为变化条件下合并 | **OPEN，避免大规模无收益重构** |
| XY-10 | **P2** | 真实 L2 光学折射尚不可跨所有背景/浏览器复现 | 可选局部引擎 PoC；必须在 Safari/Firefox/Chromium 实测且保有 L1 fallback | **RESEARCH ONLY，不宣称实现** |

## F. 实际改造记录与前后证据

**已修改：**
- `little-works/xiaoya-apple/native-v4/apple-polish.css`：增加明确作用域的 `#editor` 44px 行为和 `lg-switch` 输入扩展命中区，保留轨道尺寸。
- `little-works/xiaoya-apple/native-v4/app.mjs`：设置开关改为文字＋开关，删除三个重复无用图标；编辑 Sheet 的原生 `cancel` 事件统一同步释放页面滚动锁；保留数据和既有事件逻辑。
- `little-works/xiaoya-apple/native-v4/qa-full-audit-ux.cjs`：建立真实 Edge 交互回归：弹窗键盘、焦点返回、Toast 消失/空间、按钮触控、开关键盘、AI 焦点与输入标签。

**真实 390px 前后图（同一演示档案）：**

| 弹窗前 | 弹窗后 |
| --- | --- |
| ![弹窗修复前](evidence/2026-11-03-xiaoya-ui/before-sheet.png) | ![弹窗修复后](evidence/2026-11-03-xiaoya-ui/after-sheet.png) |

| 设置前（重复 3 个设置图标） | 设置后（清晰的标签+开关） |
| --- | --- |
| ![设置修复前](evidence/2026-11-03-xiaoya-ui/before-settings.png) | ![设置修复后](evidence/2026-11-03-xiaoya-ui/after-settings.png) |

[今天](evidence/2026-11-03-xiaoya-ui/today.png) · [事项/日程](evidence/2026-11-03-xiaoya-ui/items-schedule.png) · [发展/记录](evidence/2026-11-03-xiaoya-ui/development.png)

说明：弹窗修复的命中区在静态截图里只表现为更宽松的高度；**真实点击框由 Playwright bounding box 确认**，没有通过图片伪造变化。截图中的角色、课程均为项目原有合成示例内容。

### XY-05 增量改造：移动端键盘与浮动控件（2026-11-03）

- **复现**：基线在模拟 `visualViewport.height=410px`、布局视口 `844px` 的软键盘遮挡时，小芽对话输入区仍落在屏幕可见区域之外，浮动 Dock 同时保留；编辑 Sheet 没有视口遮挡专用逻辑。
- **方案**：新增不依赖框架的 `viewport-guard.mjs`，只在 `visualViewport` 的底部遮挡达到 120px 时隐藏 Dock 并移动小芽聊天面板与编辑 Sheet；普通输入聚焦不提前移动对话框，也不让 Dock 消失后留下空白缺口。键盘到达时取消尚在进行的面板入口变形，避免输入栏被动画拖回不可见区域；焦点本身不会提前移动对话框。
- **样式**：在已有 `motion-dock.css` 尾部配置覆盖规则；保持正常 Dock 的 L1 模糊，键盘编辑时隐藏 Dock，不新增重复毛玻璃背景。
- **实际测试**：`qa-v4-keyboard-viewport.cjs` 最初六项检查，原先 **4/6**，第一次适配后 **5/6**（发现对话框入场动画与键盘相撞），再通过截图发现输入聚焦但键盘未出现时 Dock 过早隐藏；改为真实遮挡状态驱动后，增加桌面回归，最终 **7/7**。之前六项基线曾连续三轮全通过。包括焦点和按钮复原、编辑器保存、输入栏可见以及避免提前重排。
- **回归**：完整原参赛入口、V3 历史版本、V4 数据、心情、动画、WebKit 及交互测试 **20/20 组通过**；浏览器 320/390/768/1440px 全页面截图扫描没有横向溢出。
- **严格边界**：以上使用 Edge/Playwright 自定义 `visualViewport` 事件模拟。此功能对真实 iPhone Safari、系统软键盘/动态工具栏、第三方输入法、VoiceOver 的行为 **仍属 UNVERIFIED**。Apple 原生 Liquid Glass L2 光学效果亦未实施。此分支只有在本地回归和发布核验通过后才可视为部署。

## G. 验收结果与后续边界

| 范围 | 实际结果 |
| --- | --- |
| 全站截图扫描 | 4 个 CSS 视口 × 主要页面/模态组合，**38 个状态记录**，无横向溢出 |
| 新增 UX 实测 | `qa-full-audit-ux.cjs` **10/10 PASS**，发布集成分支连续 4 次重复 **4/4 PASS**；原始版先失败（弹窗 36px、开关 28px、3 个重复图标及 Escape 释放滚动锁偶发延迟），修复后 PASS |
| 既有回归 | 固定比赛链接、版本、IA、日程数据、日记存储、今天/事项/发展、AI、成长规划、WebKit 与 V3 历史回归，总计 **16/16 组 PASS**（详见原项目 QA） |
| 视觉审查 | 手动打开并检查同一 390px 弹窗/设置前后截图；明确了改动效果与剩余卡片、Dock 风险 |
| 性能 | CSS 未添加新的 WebGL/第三方库；**未测真实 iPhone FPS、内存和主线程长帧** |
| 无障碍 | 任务输入 label、开关 Space、Escape 关闭并恢复焦点已验证；**未经过 VoiceOver / 完整 WCAG/200% 审计** |
| P1 Dock/页切换 | 本轮没有篡改另一条尚未合并的动效分支，需完成中间帧视觉验收和安全集成 |
| 实机 | **真实 iPhone Safari 未验证**（软键盘/浏览器工具栏/安全区/120Hz 不做通过声明） |
| 发布状态 | 依照独立 worktree 和新鲜远端主分支原则决定；**代码修改与本地测试成功不能等同于 GitHub Pages 已更新** |

**下一轮的具体顺序：**（1）对独立 Dock 动效分支做 0/25/50/75/100% 帧截取与反向中断测试，确认无重影和白雾；（2）iPhone Safari 真机测试地址栏与输入法；（3）发展心情控件聚合、长文本/大字体/暗色适配；（4）严格控制 CSS 维护层数。只有在真实视觉与功能都过线后，才考虑真正 L2 光学实验。


## H. 同日追加：心情选择连续控件与未保存状态（独立分支验证）

变更来自 UI 审计编号 **XY-06**，与其它未提交的 Dock 动效分支隔离。

- **实测原问题：**「发展／记录」五个同级心情原为五张独立 106px 白卡；操作虽可用，但视觉碎片和留白成本偏高。另外旧版点击心情只改 `moodDraft`，切到「今天」再回来会重新根据持久化数据渲染，导致未保存选择在视觉上消失。
- **设计取舍：** 按 Apple 内容优先与明确分组，将五张卡合并为一块白色连续区域；单个浅绿色选中层在底部平移，静态按钮和触控区保持不动。既没有替换本机原脸型 SVG/CSS，也没有引入新的 Motion/React 运行时。选择只改变局部控件的背景/颜色，不给整个页面增加无意义进场动画。
- **真实交互：** 选择心情或编辑文字时显式标示「未保存」，切到其他主页面再回来保留当前会话中的未保存选择；用户点击「保存记录」后才持久化，原有 demo/personal 隔离、导入导出以及删除记录不变。
- **可访问性：** 五个按钮仍有文字与 `aria-pressed`；外部 `role=group` 绑定原有标题；命中区在 320 和 390 宽度都 ≥44px；`prefers-reduced-motion` 禁止选中层平移动画。
- **RED → GREEN：** `qa-v4-mood-segment.cjs` 初次 7/11，新增未保存回归后 9/13；修复后 **13/13**。测试含 320/390、快速切换、布局坐标不变、跨页面草稿、保存并恢复、无横向溢出及无 JS 错误。
- **真实截图前后：** 原 `evidence/2026-11-03-xiaoya-ui/development.png`；更新的 `after-mood-group.png`（未选择），`after-mood-selected.png`（右侧选择「很好」）。局部移动中的帧在施工机 `E:/CHATGPT/work/xiaoya-v4-mood-review-20261103/after/390-mood-motion-100ms.png`，用于核验中途不会移动命中区。
- **限制：** 以上由 Windows Edge / Playwright 测得，未对真实 iPhone Safari 的 120Hz 逐帧稳定性作声明；用户尚未对视觉稿主观验收。

新的顺序：先与并行 Dock 动效工作树做 Git 差异分析、安全集成、合并后对照 390/320px 页切换中间帧；再做真机 Safari 工具栏/软键盘及 200% 放大验证。避免重复添加不必要的动效依赖。

## I. 2026-11-03 夜间施工收口：次级导航（基于最新主线）

- **来源与保护：** 在新建的独立工作树 `E:/CHATGPT/projects/_xiaoya_v4_closeout_20261103` 中，以已实际 `fetch` 的 `origin/main@96ad937` 为基线，选择性移植 `_xiaoya_v4_quality_20261103_night` 的设置/搜索次级导航功能、浏览器专项、截图和 AGENTS 约束。原脏分支和所有其他施工树保持未改；保留首屏失败恢复 `app.mjs?v=4.5.4`，仅提升 `motion-dock.css` 缓存标识以免旧缓存。
- **交互边界：** 移动端主 Tab 始终只有今天/事项/发展；设置/搜索打开后隐藏移动 Dock 及边缘白雾，右上角提供「完成/返回」，返回原先主视图与滚动位置，并保留日记未保存草稿。桌面保留原侧栏，减少动效可立即退回。无新 AI 上传与用户数据迁移。
- **新增行为 QA：** `qa-v4-secondary-navigation.cjs` 11/11 PASS，含 WebKit、快速中断、滚动还原、草稿保持、桌面导航、Reduced Motion。
- **发现并修复一个历史测试假设：** `qa-v4-apple-polish.cjs` 原把自动滚动写死为 `350..700px`，正式主线及原夜间分支均 13/14（首次课程下午开始时滚动 840px）。新断言根据真实首个课程在时间轴的位置、最大滚动量和几何可见性判定；本地 14/14 PASS。**本次不修改真实课表和应用自动滚动算法。**
- **新鲜全套回归：** 在同一集成工作树顺序执行 18 个 Native V4/旧 AI/浏览器专项 + 5 个仓库级回归，**23/23 组 PASS，进程 exit 0**。运行明细：`E:/CHATGPT/work/xiaoya-v4-closeout-qa-20261103.json` 与同名 `.log`。
- **未通过人工设备门禁：** 真实 iPhone Safari、VoiceOver、200% 缩放、高对比度/深色模式、完整真实数据极端案例、实际 L2 折射和用户艺术验收仍未完成。浏览器自动化通过不等同这些门禁通过。
- **下一步：** 在收口提交后，优先以真实 Edge/WebKit 和可复现的 200% 字号/长中文状态继续修复剩余可授权缺陷，再安排真机人工验收；保留固定评委 URL、V3 历史档案及非强制发布保护。

## J. 后续施工：次级页面键盘退出及 V4 iOS 输入聚焦字号

- **键盘行为（先 RED 后 GREEN）：** 原次级页（设置/搜索）缺少 Escape 返回路径；在 `qa-v4-secondary-navigation.cjs` 加入返回焦点、助手先关闭、搜索快捷键返回三项后首次 **11/14**；`app.mjs` 只在非编辑弹窗、非助手打开状态下把 Escape 用于退回最后主视图，并恢复右上角按钮焦点。助手本身需要约 300ms 收回，测试等待真实 hidden 状态。最新专项 **14/14 PASS**，没有绕过助手/编辑器现有事件。
- **移动端输入字号（先 RED 后 GREEN）：** 新 `qa-v4-ios-input-zoom.cjs` 使用真实 Playwright WebKit、320/390px 触屏模拟，逐页检查设置、任务弹层、搜索、小芽对话和 AI 配置的可见输入。第一次完整检查 **12/16**，发现 `assistant-compose input` 为 14px，AI 服务商/模型/Key 控件为 13px。对 `assistant.css` 增加不超过 700px 的聚焦输入字号 16px、AI 配置控件高度 44px，保留允许用户缩放；复验 **16/16 PASS**。
- **缓存控制：** 修改 `app.mjs` 后将模块引用调整为 `v4.5.5`；`assistant.css` 改为 `v20261103.1`；不更换应用身份、评委地址或浏览器数据存储结构。
- **完整回归：** 新施工分支重新跑 19 个 V4/旧功能专项和 5 个仓库级测试，**24/24 组 PASS**，进程 exit 0。逐项输出 `E:/CHATGPT/work/xiaoya-v4-stage2-qa-20261103.{json,log}`。
- **长中文与缩放近似检查：** 在 320px、390px 移动宽度和 720px 桌面有效 CSS 宽度，用真实 Edge 创建长中文任务并检查完整文本换行、无横向溢出、保存后仍可导航；**9/9 PASS**。720px 只近似对应 1440px 视口的 200% 浏览器重排，**不能宣称完成真实操作系统文字放大、VoiceOver 或 iPhone Safari 真机验收**。
- **剩余人工关口：** 真机 Safari 动态地址栏/键盘和 120Hz 手感、实际 200% 字体/VoiceOver、完整暗色及高对比度、用户审美确认和跨内核任意背景 L2 折射仍待独立验证；不可因上述模拟通过就宣称 Apple 原生或全量完成。

## K. 2026-11-04｜已发布最新版后，系统深色与对比度适配

- **先确认发布**：从 `96ad937` 安全快进推送到 `d93acd3`（无强推），GitHub Actions run `41674474156` 结论 success；公共固定评委地址 `https://ndshuge.github.io/xiaoya-lifelab/?judge=1` 在独立浏览器新会话最终 **5/5 PASS**，真实加载 `app.mjs?v=4.5.5`、`assistant.css?v=20261103.1`，导航/输入框行为生效。初次公网检查曾命中旧缓存，发布状态不以 Git push 代替浏览器加载事实。
- **新独立工作树**：`E:/CHATGPT/projects/_xiaoya_v4_a11y_20261104`，基线 `origin/main@d93acd3`。没有改动评委固定地址、旧版 V3、个人数据存储格式或其他会话的脏工作树。
- **实际 RED**：原 V4 将 `:root color-scheme` 固定 light，Edge/WebKit 系统 dark 下仍是白底；基础主题审计 12/20，通过浅色但深色页面/设置/表单 8 条失败。后续截图还发现设置行文案过暗、心情组白底、历史空态白底、桌面选中项和移动 Dock 选中层白底。
- **实现**：新增最后加载的 `native-v4/theme-accessibility.css`，尊重 `prefers-color-scheme: dark` 的中性墨绿内容层和分层导航，仅在媒体查询下覆盖；设置、任务、日记、统计、情绪、AI 对话、编辑 Sheet、时间轴、主导航按语义适配；不使用照片蒙版或假 L2。浏览器工具栏 `theme-color` 分别指定亮/暗，浅色版保持原有样式。
- **高对比度兼容**：实际用 Chromium CDP 模拟 dark + `prefers-reduced-transparency: reduce` / dark + `prefers-contrast: more`，旧 CSS 会让 Dock pill 和底部 edge 重返浅白（定向测试 39/41）；修正最后优先级规则后专项 **41/41 PASS**，强制颜色键盘焦点也可用。
- **新鲜全量回归**：在合并前的同一独立施工工作树运行 **25/25 组 PASS**，含 24 组 V4/V3/AI/评委入口/版本既有套件及新 `qa-v4-theme-a11y.cjs`，进程 exit 0；日志在 `E:/CHATGPT/work/xiaoya-v4-a11y-qa-20261104.{json,log}`。记录 Edge/WebKit 320/390 暗亮与桌面深色实际截图：`E:/CHATGPT/work/xiaoya-v4-theme-review-20261104/`，曾先目检再修正设置/心情/历史/导航层并重新取图。桌面 CSS `zoom=2` 仅是浏览器重排近似验收，不等同完整操作系统字体放大。
- **验证边界/下一步**：真实 iPhone Safari 地址栏、第三方输入法、VoiceOver、OS 200% 字体、实际帧率及用户视觉认可仍 **UNVERIFIED**；真实跨浏览器 L2 折射不是本次 CSS L1。必须先完成设备人工验收，再评估可退回的局部 L2 试验。



## M. 2026-11-04｜用户确认效果图：五种小芽心情插画替换

- **需求与视觉来源**：用户明确认可当前对话生成的「发展」页面效果图，要求正式线上 HTML 采用同样的五种小芽形象（很低落、 有点累、平稳、不错、很好）。改动只限 Native V4 的心情选择器与随附 WebP 图像；不替换顶部原始小芽头像，也不改日记、Mood 分值 1–5、隐私或评委数据模式。
- **图像制作**：从用户确认的效果图中逐个裁出五个角色、抠除背景并合并为一张 500×80 的透明 WebP 图集 `assets/xiaoya-moods-v1.webp`（10,858 B，SHA-256 `6cdfb121e21c910fb9c8d1abb9d4696b83fb8320f03b8b5f2b15fbd5b91d2471`）。采用图集可保证五个角色同源并减少手机请求；不声称是独立原画 PSD。
- **网页实现**：`development-view.mjs` 将旧 CSS 线条表情替换为 `v4-mood-art-1..5`，无障碍仍通过按钮文字/aria-pressed 表达。新增最后加载的 `five-mood-illustrations.css?v=4.9.0`：五列同一选择区，移动的浅绿选中底板、统一插画尺寸、无重型按钮阴影或按压缩放；暗色与 reduced-motion 降级保留。入口 JS `app.mjs?v=4.9.0`，子模块 `development-view.mjs?v=4.9.0`，防旧版本缓存。
- **RED→GREEN**：先添加 `qa-v4-five-mood-sprites.cjs`，基线 Edge/WebKit **6/10 通过**（缺五张插画），改造后 **10/10 通过**：图集图片实际可解码为 500×80、五张位置独立、文案正确、选中高亮/aria-pressed、点选仍待保存、320px 无横向溢出、无 JS 错误。
- **实际截图**：`E:/CHATGPT/work/xiaoya-v4-five-moods-visual-20261104/light-develop.png`、`dark-develop.png`，均已目视检查；更大屏和页面其他流已用旧套件验证。图像由截图像素抠图，深色背景边缘可能有有限的白色亚像素，属于用户真机审美复核范围。
- **旧回归时间门禁修正**：`qa-v4-dock-near-blur-press.cjs` 以前假设「今天」必有 `.dayflow-focus-title`；傍晚当前日程已结束时此按钮正确消失，旧测试在无元素场景下等 30 秒并导致总套件 31/32 失败；更新为「如今日下一日程不存在，使用事项的实际独立快捷按钮」的相同行程/按压测试，单独 Edge/WebKit **14/14 通过**。
- **完整回归日志**：`E:/CHATGPT/work/xiaoya-v4-five-moods-parallel-20261104.{json,log}`，最新施工树全站 32/32 组 PASS，exit 0（2026-11-04）；包含新 10/10 插画专项。发布后必须进一步检查原评委固定网址是否真正加载新资源，不以 Git push 作为成功证据。
