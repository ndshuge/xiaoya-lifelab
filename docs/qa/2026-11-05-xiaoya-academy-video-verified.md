# 小芽 LifeLab｜鼠哥学院原始视频逐段核查与施工

阶段：2026-11-05；原始录屏来自用户先前上传的 `ScreenRecording_11-04-2026 23-15-00_1(1).mp4`（**32.5333 秒、512×1112、30 fps**）。

## 证据范围
- **真实读取了原始视频字节并抽帧**，先按 1 秒采样整段，再对 3.2–5.2、7.4–9.5、12.7–14.2、18.7–20.1、22.0–24.8、26.0–29.1 秒按约 0.18 秒采样。视频内容包括鼠哥学院主页、学员页、学习路线、账户管理、课堂页与底部抽屉。
- 将视频行为与 `ndshuge-academy/design/apple-ui-动效实验室.html` 以及 `python.html` 的页面动画源码作对应研究。没有把截图当成持续互动的验证证据。
- 视频原件属于用户素材，**不上传原视频、账户画面或抽帧到公开 GitHub**。本仓库仅保存文字证据与小芽自己生成的视觉截图。

## 逐段视觉发现
| 视频区间 | 原始视频可观察结果 | 小芽现状与改造 |
| --- | --- | --- |
| 3.56–3.92 秒 | 章节详情退回路线列表，页面已处于可读最终位置；不出现两个并行可操作页面 | 延用单页面路由、切换即更新语义与交互命中区 |
| **4.64–5.10 秒** | 从路线列表返回学院首页。新首页先呈现结构，教员/课程卡片依次渐显，最后恢复完整对比度 | `app.mjs` 添加 `xy-video-stagger`：页面标题/内容块按 38ms 小间隔分层淡入，持续 238ms；**只动透明度和饱和度**，不平移真实命中框 |
| 8.0–9.2 秒 | 个人页进入打卡日历与返回，导航体系保持一致 | 保留原设置、搜索和主栏同步导航的 clip-path/opacity，返回可立即打断 |
| 12.70–13.24 秒 | 账户管理模态弹窗，背景软化；弹窗清晰，底层数据仍可辨，层级明确 | 小芽已有 `dialog::backdrop`；本轮为编辑抽屉增加 245ms 渐暗+渐模糊，而不重做 Dock |
| 18.88–19.24 秒 | 练习厅返回首页后，教员卡片和课程列表有分层加载反馈 | 统一 `xy-video-stagger`，但绝不伪造网络加载状态或自动增加假卡片 |
| **26.54–27.26 秒** | 底部面板在背景变暗后从下方进入，顶部圆角、把手先出现，内容由下向上完整展示 | `shared-motion.mjs` 无来源 Sheet 从下向上 clip-path 揭示 310ms，真实 Sheet 框架一开始保持最终位置；`academy-video-depth.css` backdrop 先从透明变暗；关闭 230ms 反向退出 |
| 28.16–28.52 秒 | 底部面板进入课程详情，底层卡片的操作关系清晰，内容不突兀闪现 | 保留现有 Magic Move（有来源卡片时）和原页面的方向揭示。无来源与有来源的 Sheet 动效区分 |
| 31.0–32.5 秒 | 回到首页；iOS 控制中心从系统层滑出 | 系统控制中心行为不能仅凭网页模拟，也不能被宣传为小芽能复刻 |

## 实际截图发现并修复的二级问题

- **真实 Sheet 底部空洞**：首次 Edge/WebKit 390px 截图中，`dialog#editor` 虽然底边为视口 844px，但外框从 59px 就开始、内部可见 `.sheet-frame` 只到约 501px，底部留下 343px 透明区。其原因是原生对话框在 `top:0;bottom:0;height:auto` 组合下被拉伸，而内部 `sheet-frame` 的内容只有约 442px。
- **固定后可见面板定位**：新样式 `#editor.sheet{top:auto;bottom:0;height:fit-content;max-height:min(92dvh,850px);margin:0 auto}` 使可见 Sheet 与外框高度一致；Edge/WebKit 重新实测 `dialog top=401.625,bottom=844,height=442.375`，真实 `.sheet-frame` 贴底。新增回归断言检查 **frame 的 bottom**，而不仅是透明 Dialog 的 bottom。该用例先在旧实现上 **8/10**，修正后 **10/10**。
- 视频对照以用户原始视频约 **26.54–27.26 秒** 的底部课程 Sheet 为参照。截图证据来自小芽自己的 `docs/qa/evidence/2026-11-05-xiaoya-video-refinement/`：Edge/WebKit、390/320px，各记录事项渐显、中间 Sheet、完整 Sheet 及关闭后界面，共 20 张。
- **WebKit UI 测试时序**：`qa-v4-dock-near-blur-press.cjs` 原本在 toolbar 仍可能被浏览器滚动稳定性算法处理期间使用 `locator.click/hover`，偶发超时并只通过 13/14。修正测试为同步导航 + 实际 `page.mouse.move/down/up` 来测试按压，无任何 Dock runtime 修改；单独连续三轮 **14/14**。不将该 Playwright actionability 超时冒充真实 Dock 失效。

## 实施约束
1. **Dock 完全不修改**：底部玻璃、渐变模糊、图标、位置、按压及导航行为保持原样。
2. 五张高清小芽心情资源、已有天气/日程/成长 Agent 和私人日记数据结构不变。
3. 无来源 Sheet 只裁切渲染外观，不能 `transform:scale()` 实际输入控件；保证 44px 命中区。
4. Reduced Motion 直接显示最终页面和 Sheet，不执行额外 clip-path/背景模糊过渡。
5. 仅沿用已有原生 ES Modules + CSS；不引入大型图形/动画依赖。

## 测试与发布闸
- 新脚本：`qa-video-reference-motion.cjs`，**先红 6/10、后绿 10/10**（Edge/WebKit）：分层内容、由下往上展开、背景渐暗、快速取消、Reduced Motion、Dock + Agent 保留。
- 其他 V4 / Agent / WebKit / 旧页面回归运行结果以发布候选的命令输出为准，不能沿用旧版分数断言最终版本。
- 之前部署 `5980b45` 时 GitHub Pages Actions 一度长期排队，随后观察到新版本页面资源开始 HTTP 200 且对应构建进入 `in_progress`，说明**旧版排队不是小芽运行时代码错误**。再次更新 main 后必须独立核验新的 Pages SHA 和真实 HTTP 内容。
- 真实 iPhone Safari 触控、系统手势抢占、真机键盘、真实帧率以及是否完全达到原视频审美仍未取得设备级证据，不能声称已通过。

## 恢复
隔离工作树：`E:\CHATGPT\projects\_xiaoya_video_refine_20261105`。
基础 SHA：`5980b4576d0bdd78e2204d17a34486073049d51c`。
本轮设计与回归文件：`native-v4/app.mjs`、`shared-motion.mjs`、`academy-video-depth.css`、`index.html`、`qa-video-reference-motion.cjs`。
从上一次用户明确冻结的 Dock 和现有核心功能继续，任何正式推送先拉取远端 main 并进行祖先、差异与工作树清洁检查。