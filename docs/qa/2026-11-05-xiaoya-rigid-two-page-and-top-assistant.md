# 小芽 V5.6｜双整页滑动与对话顶部进出

日期：2026-11-05；来源：用户 iPhone 录屏 `ScreenRecording_11-05-2026 09-05-54_1.mp4` 与先前鼠哥学院操作录像。
基线：`3574fdba38f4b97b3fe5aa48505999a86837310e`
隔离工作树：`E:/CHATGPT/projects/_xiaoya_native_two_screen_20261105`
独立分支：`feature/xiaoya-true-two-screen-top-assistant-20261105`

## 用户确定的行为

- 主栏「今天／事项／发展」和页内双标签：滑动时每张页面内部组件、字号和布局均相对静止；**整个旧页向左/右滑出，整个目标页保持完整布局滑入**，二者水平相距恰好一个页面宽度。
- 松手达到位移或速度阈值，触发短弹簧（上限约 315ms）完成；低于阈值两页一起弹回。快速左右反向、新页面点击和垂直滚动均不得留下一份旧页面或错误可点击层。
- 小芽对话：从屏幕顶部外以整张面板滑入，关闭时向上沿原路径返回。禁用 `scale()`；避免 iPhone 自动弹键盘干扰动画。
- 不动底部 Dock、其渐变模糊、五张高清小芽素材，不改学生 Agent 业务、日记隐私与真实授权。

## 根因与工程设计

旧 `spatial-swipe.mjs` 只在手指移动期间挪动一个提示箭头，并在松手时重新渲染目标页面，所以用户看到卡顿、闪跳与没有两页相对运动。旧 `transitionContent()` 的圆角 `clip-path` 会露出深色边缘。对话原来从头像附近做 `scale(.965)`，空间来源不符合用户要求。

- 新 `spatial-swipe-v56.mjs`：两个真实横向固定画布；可操作的是旧页，目标预览 `inert + aria-hidden`。整个页面容器使用 compositor-friendly `translate3d`，子控件不额外移动，不修改 Dock。
- 在页面空闲时利用 `requestIdleCallback` 预构建邻页完整 DOM，并在路由/数据变更后失效缓存；首次滑动避免同步生成目标业务 HTML。释放后只调用现有业务导航，保留路由与存储单一权威。
- 新 `two-page-route.mjs`：点击主导航和设置/搜索时把真实旧页暂时移至不可操作的绝对定位层，新页渲染同步；两页水平相距一屏、以相同速度移动并在约 305ms 后清理。没有克隆旧 DOM，更没有两套可操作页面。
- 新 `true-two-screen.css`：统一背景、裁切容器、不显示旧提示箭头、禁用对话原 CSS 的额外入场动画，消除旧裁切黑边。
- `assistant.mjs`：顶部完整移入/上滑回收，无缩放、保留快速重入和 fallback 定时清理，触屏不自动聚焦键盘。
- 更新 `AGENTS.md` 说明以上最新设计决策优先级，明确旧禁止克隆是为了避免双活 DOM；现在保留的是惰性旧页或只读预览，不复刻可操作元素。

## 实际验证

- `qa-two-screen-top-assistant.cjs`：**8/8**；Edge/WebKit，真实双页各自布局静止、整页同步平移、导航整页过渡、顶部对话往返无缩放、无 Dock/旧影层变更。
- `qa-academy-continuity.cjs`：**32/32**；Edge/WebKit × 320/390px，设置/搜索/对话/模态/快速开关/reduced motion。
- `qa-agent-bridge.cjs`：**20/20**；学业/天气/成长 Agent 预览/授权/撤销与隐私测试。首次单独运行曾 19/20，随后捕获详细日志复跑 20/20，建议上线候选再次跑。
- `qa-vnext-phase2.cjs`：**18/18**；任务/日记 Magic Move、长按/回退等旧流程。
- `qa-v4-three-tab.cjs`：**13/13**。
- `qa-v4-five-mood-sprites.cjs`：**10/10**。
- `qa-v4-dock-near-blur-press.cjs`：**14/14**。
- 原 `qa-academy-swipe-tactile.cjs` 修改为真实双页结构，取代旧的箭头与纯单页假设；Edge/WebKit 多次主要路径通过，有一次 30s 运行被 shell 上限中断。不能把中断计为绿色测试。
- 视觉证据：`docs/qa/evidence/2026-11-05-xiaoya-rigid-two-page/`，Edge/WebKit，390/320/1440px，包括手指停在两页中线时、对话半入屏、从顶部退出，以及暗色模式。人工查看 390px 和深色 320px 截图无旧圆角裁切产生的黑缝。

**验收边界**：WebKit 自动化不等于真实 iPhone Safari；用户录屏帧率/触摸硬件和真实键盘软键盘应继续现场验收。未配置或调用用户的付费 BYOK 模型，不擅自发送日记或心情数据。

## 发布安全规则

从独立工作树提交；拒绝把 QA 自动重绘的历史 Agent 证据图带入提交。合并之前 `git fetch origin main`，若并发 main 先进则安全合并或停止，不允许 force push；真实 Pages HTTP/在线浏览器尚需独立验证，不可把代码提交等同于上线。
