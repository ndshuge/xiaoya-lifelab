# 小芽 LifeLab｜鼠哥学院式连续交互与按钮质感改造

日期：2026-11-04（本次接管阶段）
工作树：`E:\CHATGPT\projects\_xiaoya_academy_swipe_20261104`
分支：`feature/xiaoya-academy-swipe-tactile-20261104`
**起点**：`360e7d64a898b9a43cff6258bef483c78c971089`（已上线的 Agent V3 UI；不是旧版实验性页面）。
目标：忠于小芽独立产品、保留最新 Dock / 高清心情资产 / 已发布的 Agent 功能，学习鼠哥学院自然页面交互。

## 用户历次消息合并检查

| 用户要求 | 实施情况 | 文件及证据 |
|---|---|---|
| 继续上一轮左右滑页和单独按钮 | **已施工** | `spatial-swipe.mjs`、`academy-swipe-tactile.css` |
| 今天、事项、发展可以左右连续切换 | **已施工** | 手势指示层跟手，位移/速度判定提交，按原来的 `navigate()` 同步换页 |
| 事项日程 ↔ 待办、发展记录 ↔ 目标 | **已施工** | 直接复用 `data-items-tab` 和 `data-develop-tab`，保持实际数据和状态管理 |
| 有速度与阻尼的自然回弹 | **已施工** | 参考学院实验室的 `springTo()`；阻尼比 0.8、响应 0.3 s；阈值 30%/最大 130px 或速度 >0.5 px/ms |
| 鼠哥学院其他页面不是突然闪现 | **已施工** | `app.mjs` 单活页面导航；新页 clip-path/opacity 方向揭示，不复制 outgoing DOM；设置、搜索、主栏、子栏均沿用 |
| 对话、设置、返回连贯 | **已施工** | `assistant.mjs` 头像→面板 420ms、面板→头像 310ms；可取消；配置面板 300ms，关闭有超时清理；设置返回恢复原滚动和草稿 |
| 普通无来源弹窗也要自然 | **已施工** | `shared-motion.mjs` 无来源时 270ms 淡入和 220ms 淡出；原来源卡片继续 Magic Move |
| 单独按钮细致、有弹性但不电击 | **已施工** | 只针对 `data-press-role=solo/quiet/icon`、`.xy-create-option`、可操作卡片；2px 内下压、颜色/阴影反馈与柔和回弹，禁止统一 scale |
| UI 细节可以学但绝不改 Dock | **遵守** | `motion-dock.css`、`unified-dock-and-press.css`、`dock-near-blur-press.css` 等原封不动；不碰 `bottom-nav` 结构 |
| 保留五张小芽高清表情、AI Agent、日记与提醒 | **通过回归** | 高分辨率 CSS / 图像和 `agent-bridge` 业务文件未修改，原功能和心情选择仍正常 |
| 参考鼠哥学院视频、对应代码 | **源码已参考；原视频未在本工作树提供直接可检查的录屏** | `ndshuge-academy/design/apple-ui-动效实验室.html` 的 `springTo`、`Interactive Pop`；`python.html` 中 `pushIn / pushBackIn` 和按钮动效语义。未假称完成无法获取的原始视频逐帧比对。 |

### 核心设计取舍

- 单活页：仍只有一个真正可点击的 `#workspace`；路线变更同步，返回/滚动/焦点位置由原 store 管理。杜绝旧 Safari 录屏出现的双页残影和按钮 hitbox 错位。
- 跟手反馈是 **paint-only** 的非交互提示层（箭头、方向、轻微透明度），内容页面不随指针整体平移。浏览器环境内验证了手势逻辑和状态，**尚无原生 iPhone Safari 实体触屏证据**。
- 不拦截表单、按钮、选择器、日记、长按操作区、时间轴；垂直拖动优先滚动。若低于阈值自然回弹；减少动效时直接切换且隐藏提示。
- **未引入 React、GSAP、Skia 或大型运行时依赖**。所有变更为独立的 ES Module + CSS、已有 Assistant/Sheet 的局部微调。
- 原来编辑器与详情来源卡片的共享几何不重建。普通 Sheet 原先突然闪现，现增加独立的透明度进出。
- 状态源没有迁移、不变更档案存储协议、不新增网络/AI 权限、不改正式评委 URL。

## 自动化验证记录（实际通过）

| 脚本 | 本轮结果 |
| --- | ---: |
| `qa-academy-swipe-tactile.cjs` | **18/18**；Edge/WebKit，主栏、子栏、手势取消、竖向滚动、弹簧、按钮、Reduced Motion、高清素材 |
| `qa-academy-continuity.cjs` | **32/32**；Edge/WebKit × 390/320px，设置/搜索/对话/配置/弹窗、快速开关和返回 |
| `qa-vnext-phase2.cjs` | **18/18**；原 Magic Move、焦点恢复、边缘返回、日记、50 次连续切换 |
| `qa-agent-bridge.cjs` | **20/20**；真实本地 Agent 审批、执行、撤销、天气模拟、云模型模拟失败安全回退 |
| `qa-v4-three-tab.cjs` | **13/13**；主导航和 Dock |
| `qa-v4-five-mood-sprites.cjs` | **10/10** |
| `qa-v4-dock-near-blur-press.cjs` | **14/14** |
| `qa-vnext-timeline.cjs` | **12/12** |
| `qa-vnext-longpress.cjs` | **10/10** |
| `qa-v4-theme-a11y.cjs` | **41/41** |
| `qa-v4-ios-input-zoom.cjs` | **16/16** |
| `qa-v4-duo-full-flow.cjs` | **18/18**；旧测试改为等待动画关闭完成（原“点击后必立即 closed”不符合新视觉收口） |
| `qa-v4-secondary-navigation.cjs` | **14/14** |
| `qa-v4-motion-dock.cjs` | **10/10** |
| `qa-v4-first-paint.cjs` | **9/9** |
| `qa-v4-keyboard-viewport.cjs` | **7/7** |
| `qa-v4-no-ghost-duo.cjs` | **14/14** |
| 数据/主界面合同测试 | **19/19** |
| Agent 业务模块单测 | **53/53** |

这些不同脚本有重合路径，不将总数表述为独立的用户场景数。此处记录的结果来自不同轮的同一隔离分支回归，最终发布候选还须再次执行关键测试。

## 视觉证据与局限

- `qa-academy-visual.cjs` 已生成 **30 张实际浏览器截图**：
  `docs/qa/evidence/2026-11-04-xiaoya-academy-motion/`，包括 Edge / WebKit × 390px、320px 深色 Reduced Motion、1440px；每档各 5 张（今天、设置中间帧、对话中间帧、事项、发展）。
- 人工观察 `edge-390-assistant-transition.png`、`webkit-320-dark-settings-transition.png`、`edge-1440-develop.png`：内容可读、无复制页、五图完整。
- **未完成、不可宣称 PASS**：真实 iPhone Safari 触摸和系统侧滑冲突、iPad Safari、实际软键盘视频和系统缩放、GPU 帧率采样、真实用户“是否达到鼠哥学院质感”的主观确认、用户提到的原始录屏与本项目动作逐帧对应验证。需要在真实设备或可访问的原始视频上进行；与当前 WebKit 自动化结果严格区分。

## 发布和接管纪律

- 现有 main/评委 URL 保持不变，只有通过回归、执行远程 main fetch/祖先检查、确认用户原本的其他 worktree 不被覆盖后，才可使用**非强制**推送。
- 本次施工不得修改 Dock CSS、五心情高清资源、`student-agent.js` / `context-agent.js` / `weather-forecast.js` 等业务模块。
- 下次新对话从 `git fetch` → `git status` → `git worktree list` → `docs/qa/2026-11-04-xiaoya-academy-continuous-motion.md` 恢复；优先合并已验证的最新提交，切勿从旧版覆盖。
- **最终发布 SHA**：发布后按实际远程返回填写，不能提前假定。