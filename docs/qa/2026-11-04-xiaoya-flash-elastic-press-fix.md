# 小芽 V4｜2026-11-04 10:45 iPhone Safari 录屏：消闪与弹性按钮

## 现场证据与复现

用户新录屏 `ScreenRecording_11-04-2026 10-45-32_1.mp4`，14.7667s、512×1112、30fps。0–2.2s 发展页分类跳转，2.4–4.0s 今天／事项快速切换，4.0–10s 发展页心情选中，10–12s 设置开关与返回。用户直接反馈「会闪，另外没有弹性按钮反馈，按钮太快了」。

基线 `origin/main@f0c9bd3`（正式评委线上版）的 `app.mjs` 同步触发新 `#workspace` 的 `opacity:.48 → 1` 240ms，叠加旧页白底快照的 `opacity:1 → 0` 180ms。因此整页会短时间泛白。旧 `apple-motion-feedback.css` 仅对 `:active::after` 使用 50ms 入场和 140ms 退场透明色，图标尚无可见弹性回弹；iOS WebKit 的 `:active` 也不一定保持到按住采样帧。另一个隐藏原因是日程／待办、日期切换立即重绘，原按钮释放时已被替换，回弹被截断。

## Skill 方法与实现

已读取 `SHUGE Apple Product Audit`、`SHUGE Apple Gesture Audit`、`Apple Liquid Glass/motion.md`、`Motion/best-practices/index.md`、`Motion/best-practices/css-or-motion.md` 与 vanilla JS 指南。实际采纳：视觉层与交互目标分离、按下即时反馈、保持与释放连续、温和过冲后阻尼回落、替换 DOM 后视觉接力、中断／取消、减少动态效果。当前项目 Vanilla JS，没有引入 Motion JS 或付费 Motion+，**没有宣称原生 SwiftUI 或真实 L2 玻璃**。

- `native-v4/app.mjs`：移除整个真实 `#workspace` 从 48% 开始的淡入 WAAPI，改为**稳定不透明**、只让旧 inert 快照走 20px/180ms，标题改为不改变透明度的 5px/320ms 轻移位。交互真实容器与点击区保持最终几何；快速反向点击可立即取消旧 motion。
- `native-v4/spring-flash-fix.css`：底部 Dock 图标文字、日期按钮、日程／待办、记录／目标和心情五选项的**视觉内部层**压缩到约 0.89 倍；按住约 140ms 进入压缩态，松手后约 520ms 使用 CSS `linear()` 阻尼过冲回到 1。复用 pseudo 承托压缩与按压高亮，不缩放按钮自身的真正命中盒。
- `native-v4/press-feedback.mjs`：用 `pointerdown/up/cancel` 的持久按压类弥补 WebKit 的 `:active` 时序，窗口模糊和页面隐藏清理，键盘 Space/Enter 提供替代；当日程／待办、日期和翻周造成 DOM 重绘，`requestAnimationFrame` 为新渲染按钮的视觉内容续上 **520ms 的分段过冲→回落动画**。减少系统动态效果及小芽内部「减少动效」均提供零位移降级。保存数据和点击结果同步，不靠定时器延迟提交业务事件。
- `items-view.mjs` 与 `development-view.mjs`：给分段按钮的文案增加无额外语义的视觉 `b.xy-elastic-face` 包层，维持现有文字、ARIA 和选中状态。未改数据字段或任务/日记业务逻辑。
- `index.html`：追加 `spring-flash-fix.css?v=4.6.2`，升级模块 `app.mjs?v=4.5.7` 并让新 `press-feedback.mjs?v=4.6.3` 进入依赖图。

## 自动测试与证据

- 新 `qa-v4-flash-spring.cjs`：**RED**：原始线上版 Edge/WebKit 分别无法通过「真实 workspace 不淡出」与「持续压缩／回弹」；第一轮修改后发现 WebKit 按住态会过早丢失，于是引入 pointer state；再发现重绘后的按钮回弹丢失，增加继承动画。另补了小芽内部 Reduced Motion 开关的 RED→GREEN。
- 当前新专项校验整页 opacity、压住 0.89x、松手过冲、按钮实际 box 恒定、日程分段／日期重绘接力、系统／应用减少动态效果、Edge/WebKit 无 JS 错误。
- 原有 `qa-v4-video-apple-motion.cjs` 的 `:active` 染色断言由浮点绝对 `1` 改为视觉等价的 `>=0.97`，避免 0.999955 这样的渲染中间帧假失败。
- 所有旧功能仍须以同一最终工作树新鲜全量回归为准，输出 `E:/CHATGPT/work/xiaoya-v4-spring-flash-qa-20261104.{json,log}`。
- 帧截图：`E:/CHATGPT/work/xiaoya-v4-spring-flash-review-20261104/`，真实 Edge 390×844 手机模拟；这些和 WebKit 模拟均**不等于用户 iPhone Safari 的实际刷新率／手感合格**。

## 未达成的人工门禁

真实 iPhone Safari 的地址栏、120Hz、快速手指连点、VoiceOver、OS 字体缩放、视觉弹性强度与用户本人手感反馈仍需新录屏复测；尤其弹性是否过强或仍过快属于未通过的人审项。故不能宣称达到 Apple 第一方产品标准。固定评委地址、V3 存档、私人数据全部保留。
