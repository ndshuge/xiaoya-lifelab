# 小芽 V5.3｜鼠哥学院式连续页面与按键交互施工/交接

日期：2026-11-04。基线：`360e7d64a898b9a43cff6258bef483c78c971089`（先前正式 Agent V3）。施工 worktree：`E:\CHATGPT\projects\_xiaoya_academy_swipe_20261104`；分支 `feature/xiaoya-academy-swipe-tactile-20261104`。发布时的最终 SHA 见 Git HEAD 与远程验证记录，不能假定等于原基线。

## 1. 研究证据（真实鼠哥学院代码）
- 阅读 `ndshuge/ndshuge-academy` `python.html` 实际源码。该页 `.view.push`／`.view.pushBack` 使用 `pushIn / pushBackIn`、`380ms` 和左右方向；底栏 Dock 是自有实现，不移植。UI 交互按钮采用明确的主次层级和 `:active` 高亮反馈，避免所有按钮机械等比放大。
- 阅读 `ndshuge/ndshuge-academy/design/apple-ui-动效实验室.html`：`springTo` 弹簧采用阻尼比约 `0.8` 与响应时间约 `0.3s`；`bindLongPress` 指针运动取消；方向/速度/阈值判定驱动 Interactive Pop。小芽只借用物理规律与导航层级，禁止整个 workspace 复制或缩放。
- 来源：`https://github.com/ndshuge/ndshuge-academy/blob/main/python.html` 与同仓库 `design/apple-ui-动效实验室.html`。**没有收到可直接逐帧读取的指定“鼠哥学院演示视频”文件，不能声称逐帧分析了视频**；以真实源码、已有浏览器画面及本次录屏式中间帧截图替代。
- 小芽过去出现过 Safari 双页面残影与按钮命中框位移，明确限制：不引入 `#workspace` ghost、页面 DOM clone 或全屏 transform，不更改 Dock；保留完整 Agent 权限/审批/撤销能力。

## 2. 本轮改造内容
| 位置 | 技术实现 | 操作目的 |
| --- | --- | --- |
| 今天 ↔ 事项 ↔ 发展 | 新增 `spatial-swipe.mjs`，Pointer Events 手指跟随，可中断弹簧（ζ=.8/响应=.3s）；约 30% 宽度或 0.5px/ms 的速度阈值完成，未达标回弹。方向仅相邻；边界不误切。 | 让左右手势与原 Dock 点击到达相同页面，不增加第四栏 |
| 事项「日程／待办」 | 手势以当前分段为上下文，单次改变分段，不误触任务卡片和滚动条；释放时同步提交真实路由，避免 WebKit 延迟跳页。 | 让分段真实跟随操作，不只是可滑的装饰 |
| 发展「记录／目标」 | 同一分段滑动语义与状态恢复。 | 不重新引入早期多余导航 |
| 设置／搜索及其他页面导航 | 在原 `transitionContent()` 的同步更新后，仅对唯一真实 `.page` 增加约 380ms 方向 `clip-path+opacity` 连续揭示；不移动实际按钮命中框，不复制旧页面。 | 对齐鼠哥学院的 pushIn/back 层级，并避免 Safari 的旧重影问题 |
| 小芽对话 | `assistant.mjs`：头像位置触发约 0.965 倍微尺度空间过渡，420ms 进入、310ms 返回；缩小移位上限、进场维持较高不透明度以减少底层文字串扰；快速中断和关闭超时兜底。 | 对话不闪现，也不暴力弹跳 |
| 对话 AI 配置 | `assistant-config` 高度、透明度和 9px 垂直位移约 300ms 动画，连续展开与收起；可取消动画，补关闭兜底。 | AI 配置不突兀整块出现，内存 API Key 与同意逻辑不变 |
| 普通 Sheet | `shared-motion.mjs`：有来源卡片的几何 Magic Move 继续使用原实现；没有来源时淡入，取消时轻淡出；**保存成功立即释放表单**，避免状态与可点击位置错位。 | “添加”、“模型授权”等普通弹窗也顺滑，同时保存不延迟 |
| 独立按钮／交互行 | `academy-swipe-tactile.css`：solo 有 1.5–2px 内压、背景/阴影层次和回弹，quiet 以颜色、阴影和 1px 位移为主，分组和 check 无机械 3D 缩放；卡片只改着色，不移动真实命中。 | 增加质感，但每种控制有其交互角色 |

## 3. 保留与明确冻结
- **Dock 完全冻结**：`motion-dock.css`、`dock-near-blur-press.css`、`unified-dock-and-press.css` 等 Dock 相关文件不触碰，玻璃模糊、尺寸、位置、底部安全区及显示隐藏逻辑不变。
- 五种高清小芽情绪原画、位置、数据键、存储权限不变。已有 Today/Items/Develop、心情、日记、任务、目标、AI 对话及主动 Agent 数据结构不变。
- 手机手势不抢纵向滚动和时间轴拖柄、不抢文本输入、原生编辑器、日记编辑或对话；桌面精确鼠标拖拽保持普通文字选择。屏幕边缘浏览器系统原生返回仍以真机行为为准。
- 手势浮层无交互、`aria-hidden`，Reduced Motion 下完全隐藏；主页面仍是唯一真实可交互实例。
- 旧按压异常：“电击”式统一缩放不重引；不在 Dock 上叠加本轮 CSS。

## 4. 可重复运行的测试
```powershell
node little-works/xiaoya-apple/native-v4/qa-academy-swipe-tactile.cjs
node little-works/xiaoya-apple/native-v4/qa-academy-continuity.cjs
node little-works/xiaoya-apple/native-v4/qa-academy-visual.cjs
node little-works/xiaoya-apple/native-v4/qa-vnext-phase2.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-duo-full-flow.cjs
node little-works/xiaoya-apple/native-v4/qa-agent-bridge.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-dock-near-blur-press.cjs
```
- 滑动、回弹、按钮与分段 `18/18`（Edge/WebKit）。
- 设置/搜索/对话/config/普通 Sheet、320 与390、Reduced Motion 与快按 `32/32`（Edge/WebKit）。
- 原 VNext Magic Move 与日记任务回归 `18/18`。
- 原生 Agent E2E `20/20`、Dock `14/14`、五张高清形象 `10/10`、时间轴 `12/12`、长按 `10/10`、深色与可访问性 `41/41`、iOS 缩放模拟 `16/16`。
- 视觉证据：`docs/qa/evidence/2026-11-04-xiaoya-academy-motion/`，Edge/WebKit × 390 明色、320 暗色 Reduced Motion、1440 桌面 × 今天、设置中间帧、对话中间帧、事项、发展，共30张；中间帧仅反映可视状态，仍需交互测试才能说明行为。
- **未验证**：真实 iPhone Safari、iPad、原生触控采样频率、软键盘及浏览器自带边缘返回冲突；没有用户指定的鼠哥学院原版视频文件，已用真实源代码验证参数和结构。非商业天气规则、模型授权保持原限制。

## 5. 发布纪律
- 从 `origin/main` 干净独立 worktree `_xiaoya_academy_swipe_20261104` 施工，旧 `opc-agent/publish/xiaoya-pages` 未提交改动不触碰。
- 验收后提交独立分支、从最新远端 main 安全合并，拒绝强制推送；GitHub Pages 必须通过在线文件和 Edge/WebKit 实际打开后才可宣布上线。
- **任何断言与最终远程 SHA 均以命令输出为准**；本报告仅作为持续施工交接，不预填未来验证结果。
