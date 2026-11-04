# 小芽 Living Motion VNext｜持久交接（2026-11-04）
状态：**独立分支施工；P0 时间轴/普通按钮、P1 长按已实施并通过指定测试。其余 P0/P1 仍待施工，不得报告全站完工。**

## 1. 最新版及基线
- 产品：小芽（大学生生活管理 AI Agent），独立仓库 `https://github.com/ndshuge/xiaoya-lifelab`；评委正式入口 `https://ndshuge.github.io/xiaoya-lifelab/?judge=1`。
- 最新版发现：2026-11-04 19:00:39 +08:00，`git-safe-https.ps1 -Action Fetch` 返回远程 `origin/main=d7e733e854fd5c6644098cc7373122002b9a0b14`。此前用户提供的 `b31c961` 是较早提交；`d7e733e` 已包含五种原定心情立绘。
- **并行施工追踪（20:00 左右）**：远程 main 另新增 `05d48f6a380014bd796aa26b0d2fd9799c54c5ed`，替换为五张原始高清角色图；本 VNext 已将这笔提交以非快进合并方式纳入独立工作树，冲突仅发生在 `index.html` 的两个独立 CSS link，已同时保留 `five-mood-hi-assets.css` 和 `living-motion.css`。最终 HEAD 应包含 `05d48f6` 与本轮交互提交 `f93d07c`。
- 独立 worktree：`E:\CHATGPT\projects\_xiaoya_living_motion_vnext_20261104`；分支 `feature/xiaoya-living-motion-vnext-20261104`，起点 `d7e733e`。**交付的实际 HEAD 请在该工作树执行 `git rev-parse HEAD`，不可用原起点代替。**
- 实际入口：`little-works/xiaoya-apple/native-v4/index.html`（静态 Pages + ES Modules）。老项目 `projects/opc-agent` 不是 Git 仓库，不可当作最终网页工作树。原所有施工 worktree、dirty 文件与 V3 档案均保持原样。
- 未发布：当前 `main` 和正式 Pages 入口未修改，未变更评委链接。后续切换线上版本必须单独明确授权。

## 2. 施工约束
**永久禁止意外修改：**
- Dock 本体、dock 渐变模糊、Dock 上方清晰区、大小/位置/动画、底栏显示隐藏机制；尤其 `motion-dock.css`、`dock-near-blur-press.css`、`unified-dock-and-press.css`。
- 五种小芽情绪角色：原合成图 `assets/xiaoya-moods-v1.webp` 保留；最新版另外使用 `assets/xiaoya-mood-{1..5}-hi*.webp` 与 `five-mood-hi-assets.css` 覆盖显示，高清素材优先且不可回退为旧精度；不得换 Emoji、改脸或丢失排列。
- 今天 / 事项 / 发展三大入口、唯一头像进入 AI、心情日记、成长记录/目标/习惯、提醒、日程、搜索设置、模式隔离/隐私/导入导出、V3 参赛档案。
- 不将日记自动发给 AI，不把 deadline 变成课程时间块。
- 不重引旧整页截图 ghost、全屏 View Transition 或给 `#workspace` 的实时命中目标整体平移；之前 iPhone Safari 实测出现过严重残影。

## 3. 文件改动
- `little-works/xiaoya-apple/native-v4/timeline.mjs`：为非空日程的24小时内容增加 frame、scroll ID、真实 scrollbar 语义和抓取 thumb；事件渲染、课程布局继续使用旧逻辑。
- `.../timeline-scrubber.mjs`（新增）：指针捕获、拖动比例定位、scroll 反向同步、ResizeObserver、键盘操作、ARIA 时间文本；模块清理旧 listeners，不改全局手势。
- `.../items-view.mjs`：只修改非空日期的时间轴操作说明；**无活动仍显示原设计的空提示、不画无意义全天网格**（既有回归有明确要求）。
- `.../context-longpress.mjs`（新增）：500ms 长按，移动超过10px/放手/取消/失焦清理；覆盖任务标题、日程事件、日记历史，正常滚动不锁住。
- `.../app.mjs`：在原渲染生命周期挂载滑条和长按，复用原 `openSheet` / `complete` / `confirmDelete` / `journal` 保存流程，仅增加上下文菜单分支。
- `.../living-motion.css`（新增）：作用域只覆盖时间轴和非 Dock quiet 按钮；去掉后者 `scale(.972)` 的过度回弹，保留 .75px 位移 + 颜色/阴影，支持暗色与 Reduced Motion；长按菜单触控高 >=44px。
- `.../index.html`：只追加这一份 CSS，不改变原样式/素材/路由优先级。
- 额外测试：`qa-vnext-timeline.cjs`、`qa-vnext-longpress.cjs`、`qa-vnext-visual.cjs`。
- 研究与页面问题账本：`docs/qa/2026-11-04-xiaoya-living-motion-research-audit.md`。
- 截图证据：`docs/qa/evidence/2026-11-04-xiaoya-living-motion/` 包含 `original-{today,timeline}-390.png` 和 `vnext-{today,timeline}-390.png`、`vnext-timeline-1440.png`、`vnext-timeline-dark-reduced-390.png`。

## 4. 回归和证据（测试实跑，2026-11-04）
从独立 worktree 根目录执行：
```powershell
node --test little-works/xiaoya-apple/native-v4/qa-timeline.mjs
node --test tests/qa-native-v4-apple-ia.test.cjs tests/qa-dayflow-v4.test.cjs
node little-works/xiaoya-apple/native-v4/qa-vnext-timeline.cjs
node little-works/xiaoya-apple/native-v4/qa-vnext-longpress.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-three-tab.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-five-mood-sprites.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-dock-near-blur-press.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-journal-items.mjs
node little-works/xiaoya-apple/native-v4/qa-vnext-visual.cjs
```
已取得最近一次通过结果：
- 时间轴核心 4/4；基础信息架构 10/10。
- 时间轴实际 Playwright Edge+WebKit **12/12**（轨道可见、真实滚动、日期、键盘、按压）。
- 三栏功能 **13/13**（包括无日程日为空状态、模式隔离、导入/保存/成长）。
- 五种角色 **10/10**；Dock 与按钮基线 **14/14**。
- 日记数据模型 **5/5**。
- 新增长按 **10/10**（Edge + WebKit 手势超过阈值取消、弹窗、Escape、日记）。
- 截图脚本通过（6 张，原版与改版同环境、390px，另有 1440px、深色/Reduced Motion）。
- 所有这些是 **模拟 Edge/WebKit/Playwright**，并没有 iPhone Safari 真机测试。不能称 iPhone 验收通过。

## 5. 分阶段完成度
- **G0** 发现远程真实最新版与多 worktree：完成，`d7e733e` 已核实。
- **G1** 从最新版建立独立分支/worktree：完成。
- **G2** 研究 Apple HIG、Photos/Journal/Reminders、Things3、Structured、DayOne、Duolingo、鼠哥学院两份实验页：已读官方/项目文本，记录借鉴；原生 App 手势录像未实测。
- **G3** 页面和状态清单：继承 `docs/qa/2026-11-03-xiaoya-full-apple-product-audit.md` 并补本轮账本；实际已测试主路由和核心交互，未覆盖每一设备状态。
- **G4** 第一层逻辑：保持且验证既有 IA 和任务/日记流程；没有对已达标结构二次重构。
- **G5** 第二层动效：可抓取时间条、quiet 按钮抑制异常缩放、任务/日记/日程长按实现。**真正 Magic Move/Interactive Pop 未完成**。
- **G6** 视觉：截图审核过 390px 明暗和 1440px；Dock 本体冻结；P2 全站逐像素抛光未完成。
- **G7** 当前核心回归通过；真机 Safari、200% 缩放、动画逐帧性能及完整功能/数据回归不作已验收声明。

## 6. 下一轮应从这里继续
1. **先核实这个 worktree 的 HEAD 和 `git status`，不得用别的旧分支覆盖。** 确认它包含当期远端 main 已集成的五种心情图与 Dock 最终状态。
2. P0/P1：在隔离实验页对任务卡片→编辑 Sheet、日记历史卡片→详情、返回路径开发 **真正共享几何的 Magic Move**，禁止整屏 ghost、不得移动实时命中框；重点做用户点击中断、返回、WebKit 无残影与 Reduced Motion 复验。成熟后才合入本分支。
3. 对同一输入触发 50 次连击、200% zoom、真实 iPhone Safari 软键盘 / 滚动边界 / 长按拖动进行补测；若无真机设备，持续保留 UNVERIFIED。
4. 审计上下文菜单 focus-return、长按对浏览器原生菜单的兼容，完善删除与交互式返回测试。
5. P1：任务完成与心情状态的分级反馈、角色转换姿态；保持五张真实资产，不重新绘制。
6. 未经授权不修改正式 Pages 或 main。不要引入 Skia/CanvasKit/React/Motion 等大型依赖；首先证明实际收益和 WebKit 兼容。

## 7. 施工原则及项目定位
小芽原始竞赛目的：大学生自主生活管理 Agent，三栏围绕行动、事项与发展，保留隐私与用户授权。动画服务真实状态变化，不能为了动效更改产品用途。完整继承旧后端/数据兼容；不从零重建。所有下一次代码修改须与此文件和局部 `AGENTS.md` 核对，并更新这份交接。

## 8. 本次追加回归证据（独立分支，不涉及线上发布）
本轮额外直接运行并读取完整通过输出：
- qa-v4-secondary-navigation.cjs：14/14，含返回与草稿滚动恢复。
- qa-v4-motion-dock.cjs：10/10，含无 ghost 与 Dock 原几何。
- qa-v4-duo-full-flow.cjs：18/18，含待办、课表、心情、AI 控件。
- qa-v4-theme-a11y.cjs：41/41，含暗色、降低透明度、对比度及 200% 桌面近似。
- 此前 qa-vnext-timeline 12、qa-vnext-longpress 10、qa-v4-three-tab 13、qa-v4-five-mood-sprites 10、qa-timeline 和 qa-v4-journal-items 共 9、qa-v4-dock-near-blur-press 14 全部通过。

合计 **151/151 条断言通过**，部分属于重叠回归场景；WebKit 测试仍不等同 iPhone Safari 真机。实测脚本已输出六张视觉证据，最终人工逐帧审查仍未完成。
