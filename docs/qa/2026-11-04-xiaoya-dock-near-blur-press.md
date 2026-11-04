# 小芽 V4｜2026-11-04 16:36 Safari 录屏：靠近 Dock 才开始模糊、补全独立按钮弹性

## 现场证据与诊断

用户上传 `ScreenRecording_11-04-2026 16-36-13_1.mp4`（25.6 秒，512×1112，30fps）。录屏操作涉及今天的「查看日程／暂时不需要」、事项的日历／待办、AI 对话和设置。明确要求：**Dock 上方几乎不模糊，只有紧贴 Dock 的一小段轻微渐变模糊；剩余独立按钮应有弹性反馈**。此前多次迭代导致“所有按钮都有一个分类”不等于“所有按钮都有物理按压”。

- 原 CSS `unified-dock-and-press.css` 的统一 underlay 从视口底部向上 `196px + safe-area`：390×844 浏览器测得 top 648，Dock top 765，相差 **117px**，上方大面积被模糊。四层旧 masks 在上方 117px 内已经生效。
- `press-system.mjs` 将 `dayflow-focus-title`（可点击的下一日程）、`data-add=task`（添加截止）、部分设置按钮归为 `quiet`，而 `duo-flow-system.css` 只设置其透明度／亮度，无可见弹性压下。设置页 `完成` 是 `icon` 角色，但内容是文字没有 SVG，旧 `icon > svg` 动画根本不会触发。
- 真正的单键 `solo` 仍沿用约 70ms 下沉、210ms 回弹的绿色实体键；`group`（Dock、分段选择、日期、心情）仍不应用多邻国式凸起按键。本任务没有变更业务数据、导航流或用户隐私。
- TDD：新 `qa-v4-dock-near-blur-press.cjs` 基线 Edge/WebKit **4/12 PASS**（Dock 超过 55px、独立文字按键无运动、减少动效的旧透传失败），修改后扩展到 **14/14 PASS**，额外覆盖纯文字「完成」。
- 用户的视觉偏好必须与 WebKit/iPhone 手感分开：模拟 WebKit CSS 计算与浏览器截图并不能代表 iOS Safari 真机渲染、120Hz 或原生 haptic。

## 实现

- 追加最后加载的 `native-v4/dock-near-blur-press.css?v=4.8.1`，旧 `unified-dock-and-press.css` 保留作为基线，新的紧凑区域覆盖旧数值，减少对其他路由/深色配置的风险。
- **模糊范围**：underlay 从 **196px** 收缩到 **114px + safe-area**，在 390×844 基准上从 Dock 上方约 **117px→35px**。上缘 mask 先大段透明，靠近 Dock 约十余像素才浮现 2px 轻模糊；Dock 下方与安全区延续 6／12／20px 交叠多层，直到 CSS viewport 底部，没有中途硬边。浅／深色 scrim 同步移动，减少透明度与高对比度有对应降级。
- **遗漏的独立文字键**：`quiet` 按住 75ms 约 1.25px 位移和 0.972 缩放，松手使用 310ms 的轻微过冲曲线衰减，保持轻量文本外观，不加绿色厚阴影。原有 `solo` 实体下沉和 `group` 分段动画均未改变。
- **没有 SVG 的文本型 icon**：如设置次级页 `完成`，补轻量 1px/0.976 的 press/release CSS；避免只有“带 SVG 的 icon”才响应。
- 兼容 `prefers-reduced-motion` 和小芽内部 `body.reduce-motion`，保留 keyboard/pointer up/cancel 的事件路径（本次未改 JS/数据存储）。
- 截图证据：`E:/CHATGPT/work/xiaoya-v4-press-blur-visual-20261104/`（390px 浅色/深色，事项/发展/弹窗等），已目视检查 Dock 上方主体清晰度和下方遮罩连续性。

## 测试与发布门槛

- 新专项 Edge/WebKit **14/14**；旧 `qa-v4-duo-progressive.cjs` 与本次偏好冲突的原断言 `top<dockTop-35` 改为 `10<=dockTop-top<=55`，单独复测 **10/10 PASS**。
- 旧版完整回归首遍 **30/31**，唯一失败是上述要求相反的旧断言；下一轮从最新分支全量 `31/31` 的最终证据在 `E:/CHATGPT/work/xiaoya-v4-press-blur-parallel-20261104.{json,log}`，**须读取进程返回值后才能认定**。
- 发布前按 `E:/CHATGPT/AGENTS.md` 与本项目 AGENTS 检查变更路径，非强制安全推送，确认 GitHub Actions 和固定评委地址 `https://ndshuge.github.io/xiaoya-lifelab/?judge=1` 真正加载 `dock-near-blur-press.css?v=4.8.1`。不能把 Git push 等同于部署成功。

## 44px touch target follow-up
First parallel full run: 30/31 PASS. The sole failure was at 320 CSS px while the assistant's text-only icon pressed-transition scaled `assistant-config-toggle` to 43.42px; it is a genuine transient hitbox regression. Removed button-body transform for `.assistant-panel button[data-press-role=icon]:not(:has(svg))`, preserving paint-only button feedback; text-only `完成` in topbar retains a lightweight motion. Both the 320/390 input target suite (`16/16`) and new Dock/press regression (`14/14`) passed after the fix. Run full 31-group suite fresh and inspect final exit status before publishing.

## Final evidence
Fresh parallel full matrix ran after 44px regression fix: 31/31 groups PASS, exit 0, evidence E:/CHATGPT/work/xiaoya-v4-press-blur-parallel-20261104.json and .log. Screenshots E:/CHATGPT/work/xiaoya-v4-press-blur-visual-20261104. Production deployment has to be independently checked.
