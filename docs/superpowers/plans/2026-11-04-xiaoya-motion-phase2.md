# 小芽 Living Motion 第二阶段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** 在保持 Dock、五张高清心情图、数据模型和正式评委网址完全不变的前提下，补齐任务/日记卡片空间连续性、返回/手势、状态反馈和交接测试。

**Architecture:** 保留原 ES modules + native dialog；制作仅作用于编辑 Sheet/日记纸张的共享几何引导器（FLIP/WAAPI，绝不克隆、平移 #workspace 或 Dock），并让旧 data-edit/data-journal-date 路径透传原始触点。用独立模块管理可中断动画及 Reduced Motion。对焦点/滚动/草稿采用现有状态，新增测试验证无 ghost 和用户可重复点击。

**Tech Stack:** HTML/CSS/ES Modules, Web Animations API, Playwright Edge/WebKit, Node.js tests.

**Spec:** `docs/handoffs/xiaoya-living-motion-vnext.md` 与 `little-works/xiaoya-apple/native-v4/AGENTS.md`。

## Global Constraints
- Dock 代码、样式、材质、模糊、位置、图标、隐藏机制一律冻结；正式 main / Pages 不修改。
- 不 clone 全页，不用 startViewTransition 整页快照；保留唯一 live workspace。
- 用户数据不自动上传；本地日记、五张高清立绘和数据存储必须不变。
- Fallback 可立即显示，Reduced Motion 下不移动，快速点击可中断。
- 历史日记切换必须保留草稿且能返回原日期、恢复滚动。
- 单独分支可推送，不更新正式 main。

## Review Focus
- 手势快速反向、动画取消与 dialog 重开不能留下 transform。
- 日记保存/删除触发 rerender 时回退无需失焦或丢草稿。
- 长按任务再编辑与普通点击编辑均必须有相同动画生命周期。
- 390px、1440px、320px、200% zoom 与 Dark/Reduced Motion。
- 卡片源头可能已从页面消失，回退必须有稳态 fallback。

### Task 1: Dialog/日记 Magic Move
**Files:** 新建 `native-v4/shared-motion.mjs`; 改 `app.mjs`; 改 `living-motion.css`; 添加 `qa-vnext-phase2.cjs`。
- [ ] 撰写失败的 dialog 共享几何 + 无 ghost/中断/Reduced Motion 测试。
- [ ] 首次运行确认因缺功能失败。
- [ ] 实现只动画 dialog/sheet 内容的可中断 WAAPI 几何变化，返回时从当前几何逆转并即时释放锁。
- [ ] 历史日记使用记录卡→内容纸张动效与返回按钮，保留草稿/原页面滚动。
- [ ] 浏览器完成红绿与既有功能回归。

### Task 2: Interactive Pop
**Files:** `shared-motion.mjs`, `app.mjs`, `qa-vnext-phase2.cjs`。
- [ ] 失败测试：iOS 风格从屏幕左缘右滑（仅次级记录/Sheet）、位移阈值、取消归位。
- [ ] 实现 Pointer Events 手势：手指跟随只作用 dialog/详情纸张，非 #workspace。滚动和文本选区不抢，动作取消归位。
- [ ] Edge/WebKit 验证成功、取消、反复/快速操作。

### Task 3: 心情/任务反馈
**Files:** `living-motion.css`, `app.mjs`, `qa-vnext-phase2.cjs`。
- [ ] 失败测试：5 种高清形象选择切换时尺寸/位置固定，50 次连击不留下长动效/错选。
- [ ] 实现低运动量心情状态轮换，无缩放电击与重复运行时。
- [ ] 任务完成/习惯行动/日记保存采用已有 Toast 的轻量分级反馈。
- [ ] 回归保存、隐私、导航和降低动画设置。

### Task 4: 全量 QA 和交接
**Files:** `docs/qa/2026-11-04-xiaoya-living-motion-research-audit.md`、`docs/handoffs/xiaoya-living-motion-vnext.md` 与 QA screenshots。
- [ ] 320/390/1440、Dark、Reduced Motion、200% zoom 和连续操作复测。
- [ ] 原旧测试 + 新浏览器测试，列未测真机 Safari 等实际阻塞。
- [ ] 记录截图和 commit/分支；检查 Dock diff 空。
- [ ] 独立分支提交/推送，无 main/Pages 发布。
