# 小芽 Living Motion VNext｜三层研究与页面/交互审计
日期：2026-11-04。研究和验证针对独立分支 `feature/xiaoya-living-motion-vnext-20261104`，起点基线 `d7e733e`；后续远程 main 新增高清五种形象提交 `05d48f6`，已在本分支合并，两者同时继承。与较完整的上一轮 [全站审计](./2026-11-03-xiaoya-full-apple-product-audit.md) 配套，不重复改造合格组件。

## 第一层：产品逻辑——证据与取舍
| 来源（实际核查文档/工程） | 可转移的具体机制 | 小芽决策 |
| --- | --- | --- |
| [Apple HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | 动作应符合用户的手势、反馈状态而不妨碍操作 | 按钮轻反馈；滚动拖动连续跟手；尊重 Reduced Motion |
| [Apple Reminders 官方指南](https://support.apple.com/guide/iphone/get-started-with-reminders-iphc7880ecd6/27/ios/27) | 快速添加；时间/细节按需填写 | 保留现有一键新增、二级表单和任务编辑；不重做已合格流程 |
| [Apple Journal 编辑/删除](https://support.apple.com/en-asia/guide/iphone/iph1607b2f45/27/ios/27) | 记录的编辑、删除、恢复应有清晰操作 | 保留本地保存和删除确认；新增长按历史菜单，不私自上传 |
| [Apple Photos 日期浏览](https://support.apple.com/en-mide/guide/iphone/iph0ea0234e0/27/ios/27) | 按日期定位、维持导航上下文 | 事项中的日期仍独立于任务截止；时间轴拖动绑定真实滚动位置 |
| [Things 3 日程语义](https://culturedcode.com/things/support/articles/2803579/) | Today 和 Upcoming 表示待办起始/处理时机，日历时段独立 | 现有 DDL 不自动占据课程或活动的时间段 |
| [Structured 入门指南](https://help.structured.app/en/articles/380546) | 时间轴与收集箱两种用途 | 保留日程与无期限待办两个视图；日程才出现可拖时间轴 |
| [Day One timeline](https://dayoneapp.com/guides/tips-and-tutorials/timeline-view-customization/) | 历史条目可回到具体内容和上下文操作 | 日记历史长按可查看或明确删除；编辑器草稿仍需要保存 |
| [Duolingo 设计实践](https://blog.duolingo.com/core-tabs-redesign/) | 视觉反馈应服务真正的任务进度 | 沿用目前已落地的页面结构，不用庆祝动画覆盖每个按钮 |
| 本仓库 `docs/qa/2026-11-03-xiaoya-full-apple-product-audit.md` | 已有全面页面和动作矩阵、经过验证的设计决策 | 不重做 Dock、头像、导航、五种情绪图片，不覆盖 V3 |

**研究边界：** 阅读了公开文档和原仓库代码，并不等于实际操作过 Apple 原生 App 或取得其动效的逐帧参数；未复制 Apple 私有资源。

## 第二层：自然动效——真实代码取舍
- 真实读取 `ndshuge/ndshuge-academy/design/apple-ui-动效实验室.html` 与 `design/apple-ui-效果演示.html`。其中 `springTo()` 演示了有阻尼的数值迭代；`bindLongPress()` 采用约 500ms 长按、10px 取消阈值；还存在 `stageBack()` 与 `startViewTransition()`。
- **采用：** 500ms/10px 阈值的识别语义、指针移动及时取消、独立手势模块、状态可清除；时间轴使用几何比例映射而非为拖动滑块添加弹簧惯性。
- **暂不采用：** 将旧实验室整屏 `stageBack()` / View Transitions 截图复制到 `#workspace`。小芽本机 `AGENTS.md` 和此前 iPhone 闪影回归禁止整页 ghost / 真实命中框平移；Magic Move 必须单独实验、逐帧通过后才能落地。
- **按钮异常缩放的根因：** 旧版 `dock-near-blur-press.css` 中 quiet 角色的 `scale(.972)` 与 310ms overshoot 退场叠加其他按钮表层动效。VNext 使用特定范围的新 CSS 覆盖 quiet 角色的缩放，保留 `translateY(.75px)`、背景、明暗反馈。Dock、分段控件、心情角色未被统一改成单一按压模型。
- **时间轴：** 以 `scrollTop / (scrollHeight-clientHeight)` 真实同步滑块；拖动比率映射可滚动距离，`pointercapture` 保证离开轨道仍跟手，`pointercancel` / `lostpointercapture` 清理状态；`ResizeObserver` 适应列表和视口；上下滚动仍为原生；Home/End/上下键和 ARIA 用于无障碍。
- **长按：** 作用于任务标题、日程事件、日记历史条目；不锁住页面滚动、不修改 `touch-action`；移动超过 10px 会取消；打开的是现有编辑 Dialog 的新操作菜单，不另造全局弹窗系统，正常点击逻辑保持原状。

## 第三层：视觉、材质与生命感
- Dock 及其 `motion-dock.css`、`dock-near-blur-press.css`、`unified-dock-and-press.css` 没有直接修改；Dock 上方清晰区域、原有 blur/scrim、导航位置仍保持。
- 时间条在内容的右侧，宽 23px，最小 thumb 高度 36px；通过浅绿底和单一对比明显的绿色滑块提供可抓取性。没有塑料 3D 质感、无意义星芒或通用弹跳。
- 390px 亮色、390px 深色且 Reduced Motion、1440px 桌面均已运行截图；新旧 390px 在相同演示档案和滚动定位下对照。图证见 `docs/qa/evidence/2026-11-04-xiaoya-living-motion/`。
- 五种角色保留原始 `assets/xiaoya-moods-v1.webp` 作基础兼容，同时继承 2026-11-04 `05d48f6` 新加入的五张高清原始角色资源以及 `five-mood-hi-assets.css`，不自动更改心情选择数据。

## 当前逐页面审计状态
| 页面/组件 | 已核查能力与证据 | 结论/剩余风险 |
| --- | --- | --- |
| 今天 | 今日建议、任务完成、唯一小芽头像、顶部/底部导航；原有三栏测试 | 原功能保持；尚未做新的任务完成庆祝动效 |
| 事项·日程 | 时间轴轨道实际拖动，边界/日期、空日期保留明确空状态，课程/活动编辑 | **P0 修复并在 Edge/WebKit 验证**；iPhone Safari 真机未测 |
| 事项·待办 | 任务标题长按编辑/完成/删除菜单，普通点击编辑、DDL 独立收集箱 | 长按取消/操作经浏览器测试；没有改变用户数据结构 |
| 发展·记录 | 五种 sprites、日记编辑、保存、删除、历史长按和查看 | QA 通过；历史卡片→详情的真正共享几何过渡未施工 |
| 发展·目标 | 目标、习惯、打卡、成长规划、已完成归档 | 原有自动测试通过；不为求动效而重构 |
| 小芽对话 | 唯一头像入口和现有会话/授权边界 | 本轮未改；真实 iPhone 软键盘仍未实测 |
| 设置 / 搜索 | 原有次级导航、关闭、数据模式和导入导出 | 原导航与数据回归通过；未改 Dock |
| Editor Dialog | 新的上下文菜单复用现有 dialog、Escape、confirm | 无额外 UI 框架；任务卡片到 sheet 的真正 Magic Move 仍在待办 |
| 旧版 V3 / 比赛 | 根入口、V3 档案、Demo/Personal 隔离 | 通过既有基础单测；正式 Pages 未更新 |

## Skill/Skia 决策
- 已找到并阅读 ChatGPT 插件中的 `shuge-apple-product-audit`、`AUDIT_MATRIX`、`apple-web-design`、`motion`，并按原生 ES Module 与浏览器测试执行；这些 Skill 并不代表本机安装了动画运行时。
- 已查验现有 `createSpring` 和旧动效实验室，无需第二套大型 spring engine。
- **Skio** 未识别为当前环境的独立工具名；若原意为 **Skia/CanvasKit**，当前不引入。需要的是真实 DOM 滚动与无障碍菜单，添加 WASM 图形栈会增加包体和 WebKit 验证风险，收益不充分。

## 当前 P0 / P1 / P2 账本
- **完成：** P0 时间轴可抓取拖动、触控跟手/键盘、普通按钮突兀缩放抑制、长按不抢滚动、保存和五种素材回归。
- **未完成：** P0/P1 共享元素 Magic Move 的卡片→编辑 sheet 与反向动画；P1 日记卡片→详情/返回空间连续性、交互式后退、角色姿态插值、任务完成分级反馈；P2 细节视觉系统微调。
- **为什么不视为完成：** 旧全屏过渡会造成 Safari 闪影；本轮没有足以证明新的 Magic Move 在 iPhone 真实触控无残影的证据。
- **未验收环境：** 实际 iPhone Safari、iPad、系统键盘遮挡、200% 缩放下的实时触控/动画性能；模拟器/桌面 WebKit ≠ 真机。

## 第二阶段更新｜11 月 4 日 21:00 之后（以此覆盖上方第一阶段待办）
**新证据：** 真实研发浏览器 Edge 与 Playwright WebKit、同一演示档案的 22 张视觉证据，路径 `docs/qa/evidence/2026-11-04-xiaoya-living-motion-phase2/`。原版与上一轮时间轴的 6 张对照仍保留。

### 原理研究与工程取舍
- [Apple HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion)：动效需帮助用户理解空间来源，避免突然缩放、不应阻止操作。
- [MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)：原生 View Transition 会捕获旧/新渲染快照；项目旧 `.xy-route-ghost` 在 Safari 曾产生内容残影，故不启用全页 View Transition，保留用户确认过的单 live workspace。
- [MDN Web Animations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API)：通过 Animation.cancel()、独立 keyframe 生命周期和 Reduced Motion 精确掌控。原工程本身 ES Modules，不引入 Motion / React / Skia。
- **采纳的安全 Magic Move：** 原卡片 `getBoundingClientRect()` → 新 Sheet/日记几何位置，绘制单个 `aria-hidden` 且 `pointer-events:none` 的纯色圆角视觉层，沿几何轨迹形变；真正的 `#workspace`、表单控件与日记 textarea 不做缩放；反向同理。关闭时清理中间层并恢复焦点。采用几何示意层是为了可用性，不是复制页面截图。
- 上一版曾试验直接缩放 Sheet 整体，Edge 下复现长按 500ms 打开菜单后 `button.getBoundingClientRect().height<44`，即视觉命中区不稳定；已撤回该方案，并验证最终按钮 `63×44 CSS px`。
- 历史日记返回按钮置于“写几句话”标题层，来源/目标滚动与日期恢复；向右边缘滑动超过 88px 返回，缩回取消；常规上下滚动不触发。
- 心情素材无换图：已采用五张 512px 高清角色，避免独立形态插值导致位移/错脸，只保留既有单组顺滑状态指示器；50 次快速切换验证单一选中状态。此为有意识的视觉取舍。
- 保存日记、完成任务和成长行动沿用唯一 Toast 的轻量 `✓` 成功标识；不额外给导航/开关/心情按钮播放庆祝动画。

### 回归矩阵与剩余限制
| 范围 | 新结果 / 说明 |
| --- | --- |
| 时间轴 | 12/12；旧 24h 和空状态不改 |
| Magic Move / 返回 / 心情 50 次 / 成功反馈 | 18/18 |
| 长按与操作表单触控 | 10/10；中间帧真控件 44px 高 |
| 原导航、日记、设置、AI、Dock、高清五情绪 | 其余 139/139（含通用数据单测） |
| 汇总 | **179/179**；测试运行日志来自隔离工作树的 `qa-vnext-phase2.cjs` 等，不包括原生 iPhone Safari |
| 截图 | Edge/WebKit × (390 明亮、320 暗色 Reduced Motion、1440 桌面) 的卡片/打开中间帧/稳定 Sheet，另有 390px 日记中间和稳定画面，共 22 张 |
| UI 设计最终批准 | 未取得用户真机确认；本报告不声明 Apple 原生复刻，也不声明全部动效取得用户主观批准 |

### 版本边界
- 原设计 `Dock` 全冻结，相关三个 CSS 无本轮变更；最新 main 高清心情资源保留。
- 历史编辑/任务操作已复用现有数据和授权规则。未给用户日记上传网络的任何新行为。
- 实机 iPhone Safari、软键盘真机、主屏安装后触控、Safari 真正 200% 浏览器缩放和 GPU 性能未测试，只保留明确阻塞项；真实设备结果优先于模拟截图。
