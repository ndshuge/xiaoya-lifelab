# 小芽 V4｜2026-11-04 12:35 录屏驱动：单独按键行程 & Dock 连续模糊

## 输入与原因

- 用户录屏 `ScreenRecording_11-04-2026 12-35-57_1.mp4`，21.05s，512×1112，约 30fps。重点：不同页面独立按键仍像轻微缩放，底部 Dock 上方非常模糊、下方出现分界后相对清晰；要求“左右滑动不用多邻国效果，单个按钮要”。
- 根因 1：`v4-polish.css` 的固定 `.app-frame::after` 155px/blur18；`motion-dock.css` 将同一伪元素改为 168px/blur18/mask；`dayflow.css` 同时还有 Dock 上方 `.bottom-nav::after` 89px/blur10；`bottom-nav` 本身 blur25~30px。不同遮罩盒各自结束，造成视觉交界。**浏览器 Safari 自己的底部工具栏不是网页 DOM，网页不能修改原生控件材质**。
- 根因 2：先前 `spring-flash-fix.css` 对 nav、日期、心情等几乎所有图标施加相同的长达 520ms / scale(.89) 弹性；`press-feedback.mjs` 又在日程／日期重新渲染后给 group 内的选项注入 520ms 过冲动画，和分段滑动指示器同时工作。孤立实体按键的 box-shadow、内部缩放未形成统一的“下沉→保持→回弹”行程。

## 外部参考及采用

- Duolingo 触感研究：公开的日本开发者实践 `https://zenn.dev/kg_lens/articles/bff9359c61168d` 推荐下缘 box-shadow 绘制“深度”，按住时 shadow 撤去并对应约 3–4px 下沉；强调按下响应立刻发生、不要拖长入场动画。示例属于**第三方复现，并非 Duolingo 官方源代码**。
- Josh W. Comeau 2021/2026 `https://www.joshwcomeau.com/animation/3d-button/` 比较了两层前景面/固定底面与 box-shadow 性能差异；本次在 Vanilla CSS 和现有按钮 DOM 框架中保留固定的真实点击盒，选择 paint-only 阴影和独立图标运动的轻量实现。
- Progressive Blur 研究 `https://smoothui.dev/docs/components/progressive-blur`、`https://ui.zyeon.ai/docs/backgrounds/progressive-blur` 均描述**多层不同半径 backdrop-filter + 交叠遮罩**以避免单一 blur+opacity mask 在边界处急断；后一资料明确单层的模糊半径是均匀的，变的是透明度。
- 采用已安装插件 Skill：Apple Liquid Glass motion（pointerdown、可中断、媒体降级）、Motion css-or-motion（简单投影用 CSS、手势速度非必需引擎）、SHUGE Apple Gesture Audit（group vs solo 边界、WebKit 验证）。仍无付费 Motion+、SwiftUI、真实 L2 折射。

## 修改

- `index.html`：在 Dock 前插入 `.xy-progressive-underlay`，4 个非交互 `.xy-blur-layer` 和 1 个轻 scrim；加载最后的 `unified-dock-and-press.css?v=4.7.0`，同步更新 JS 模块 cache key。
- `unified-dock-and-press.css`：统一接管原 `app-frame::after` 与 `bottom-nav::after` 两处重叠模糊，旧伪元素禁用；统一 underlay 固定到底 0 高度 `196px+safe-area`，z-index 在内容和 Dock 之间，blur 3/7/13/22px，遮罩区间有交叠，光感叠加保持克制，保证**Dock 下方到 CSS viewport 底部继续模糊**。次级设置／搜索与真正键盘遮挡时隐藏，不阻拦交互；深色 / 减少透明度 / 高对比度使用独立降级。
- 按键：仅独立实体 CTA（保存记录、目标打卡、计划确认、弹窗保存、助手快捷）使用约 3.5px 实体厚度，55ms 压下、225ms 平缓复位；原按钮实际 hitbox 不移动。心情五选一、日程／待办、记录／目标、日期/翻周及 Dock 为选择或方向性控件，**取消同类 3D 深度、520ms 大弹簧**，使用轻微按下反馈和自己的指示器。避免把整组控件变成五个凸起的按钮。
- `press-feedback.mjs`：移除旧的 group click 后 520ms re-render 接力；保留 pointerdown/up/cancel、焦点和键盘反馈。其他任务、日记、AI 数据结构不变。

## 验证口径

- 新 `qa-v4-duo-progressive.cjs` 曾 RED：Edge/WebKit 各缺统一模糊 DOM，分组心情误有 3D 厚边；实现后 **10/10 PASS**，测试多层 mask、半径、视口到底、次级页隐藏、组按钮无 3D、独立按键压住/松开与减少动效。
- 原 QA 如 `qa-v4-no-ghost-duo.cjs`、`qa-v4-flash-spring.cjs`、`qa-v4-motion-dock.cjs` 更新过时“必须保留旧厚边或旧伪元素”的断言为新需求；审计记录以最终 Edge/WebKit 回归和 Git SHA 为准。
- 浏览器截图在 `E:/CHATGPT/work/xiaoya-v4-unified-dock-review-20261104/`，可查看底部 underlay 无额外 line 的浏览器视觉效果。**Playwright WebKit ≠ iPhone Safari 真机，不声明 Apple 官方 Liquid Glass L2 或 Duolingo 官方物理**。
- 固定评委 URL `https://ndshuge.github.io/xiaoya-lifelab/?judge=1` 不变；V3 历史版、个人数据和评委示范隔离不动。发布前检查完整结果、提交范围和非强制推送，发布后独立验证公网资源实际加载。

## WebKit visual caveat
Headless Playwright WebKit in this environment produced nearly unchanged pixels in a three-way ackdrop-filter comparison (multi-layer, single masked element, and old app-frame pseudo-element). Its computed CSS/DOM tests are valid but its screenshot is **not** proof of Safari hardware blur rendering. Chromium screenshot showed the continuous underlay. Do not mark real iPhone Safari dock/toolbar blur as human-approved until device video evidence is collected.
