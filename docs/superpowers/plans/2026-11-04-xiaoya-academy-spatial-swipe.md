# 小芽学院式左右滑页与独立按键质感 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 在最新 Agent V3 上为小芽的「今天／事项／发展」增加鼠哥学院式可取消的左右滑页与弹簧反馈，升级非 Dock 独立按钮的按压与释放质感。

**Architecture:** 保持现有 V4 的单个真实 workspace 和同步路由实现，新增 pointer 驱动的手势控制器、只展示质感的非交互 paint-only 滑页指示层。采用鼠哥学院 springTo 的 dampingRatio .8、response .3 秒、位移约 30% 或速度约 .5px/ms 的完成判断；不得平移 live workspace 或复制旧页面，因为此前 Safari 用户视频明确观察到残影和命中区域偏移。新独立按键 CSS 按 solo/quiet/icon 语义处理，保留现有 Dock、心情形象、AI Agent 逻辑与个人档案。

**Tech Stack:** JS ES modules / CSS / native PointerEvent / Playwright Edge + WebKit.

**Spec:** 当前产品 `little-works/xiaoya-apple/native-v4/AGENTS.md`；鼠哥学院 `design/apple-ui-动效实验室.html` 中 springTo 和 Interactive Pop。

## Global Constraints
- 原有「今天／事项／发展」三个主栏、事项双分段、发展双分段不变。
- 不复制页面、不整体平移 workspace、不缩放活按钮命中区域；不修改 Dock CSS、角色高清图片和 Agent 业务。
- 手势不得截断表单、时间轴、水平滚动、对话框或正常上下滚动。
- 弹簧轨迹可中断；阻尼 .8、响应 .3；约 30% 宽度或 0.5 px/ms 的挥动后翻页。
- Respect reduced motion、focus-visible、键盘、真机 Safari 未验证标记。
- 修复必须通过红→绿浏览器自动化；在隔离 worktree 验证，普通非强制推送、线上真实访问。

## Review Focus
- 左右滑与竖直滚动混淆时保留滚动。
- 手指未达到阈值应弹回，禁止误点、复读切换。
- 页面头部、返回、编辑模态、私密日记编辑手势隔离。
- 按下按钮与释放期间必须有明确但克制的反馈，不能突然全体缩放。
- 初次加载与 320/390、深色、reduced-motion、WebKit 稳定。

## Tasks
### Task 1: 接入左右滑手势和局部语义
- [ ] 写 Playwright `qa-academy-swipe-tactile.cjs` 的失败用例，包括主栏左右相邻切换、回弹、竖滑、分段导航、模态隔离、reduced-motion。
- [ ] 运行用例并确认因缺功能失败。
- [ ] 新建 `spatial-swipe.mjs`：`installSpatialSwipe({getRoute,onNavigate,onSegment,canSwipe})`。
- [ ] 新建 `spatial-swipe.css`，使用无指针交互层做跟手的位移/方向视觉反馈。
- [ ] 精确最小接线到 `app.mjs`；CSS/JS 加缓存版本号。
- [ ] 运行用例确保全绿，检查主路由按钮仍同步。

### Task 2: 优化单独按钮质感
- [ ] 通过同一个测试先验证失败的 solo/quiet 状态与稳定命中。
- [ ] 新建 `tactile-refinement.css`，限定为非 Dock 的 solo/quiet/icon 控件，微弱金属高光和弹性回位，不采用整按钮缩放。
- [ ] 深色、keyboard focus/reduced-motion 全部合理；测试通过。

### Task 3: 回归和安全发布
- [ ] V4 主流程、Agent 20、Dock 14、五高清心情图 10、WebKit、暗色/a11y、轻量键盘与不透明度验证。
- [ ] 完整 diff 对照：Dock/图片、Agent 文件未改动。
- [ ] Git 提交隔离分支；从最新 remote main 安全 fast-forward 或合并，拒绝并发冲突强推。
- [ ] 在线双入口和 Edge/WebKit 真正浏览器验证；写入 QA 报告及真实未验证项目。
