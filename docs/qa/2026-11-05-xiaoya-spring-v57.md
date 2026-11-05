# 小芽 LifeLab V5.7｜弹簧动效、对话双击收起与快速反向

日期：2026-11-05；基线 main `9d0bc398e02312f4479e6e89393267f0b9238b26`
工作树：`E:\CHATGPT\projects\_xiaoya_spring_refinement_20261105`；
分支：`feature/xiaoya-spring-motion-toggle-20261105`。

## 本次用户反馈和根因

1. 主页面从左到右移动太快而且“硬”：旧双页点击导航只有 `305ms` 固定 cubic Bézier，手势释放在 `315ms` 被硬截止，残留位置被瞬间归零；即使两页布局相对静止，停止的方式也不自然。
2. 打开小芽对话后，再次点击头像不能退出：旧 `runAction('pet')` 无条件调用 `assistant.open(source)`，没有 toggle 分支。
3. 对话顶部滑出/收回、添加事项底部弹窗缺乏弹簧：旧动画只有起止两关键帧，分别约 420/310ms 与 310/230ms。普通 sheet 还主要靠 clip-path 揭示，没有真实的弹性位移。

## 参考研究

- 鼠哥学院 `ndshuge-academy/design/apple-ui-动效实验室.html` 的 `springTo`、Interactive Pop（原先用户视频记录过相应关键动作）；它的工程理念为阻尼、响应、手势连续速度与完整页面关系。本次根据产品场景调参，而非照搬短 0.3 秒。
- Apple `Animate with springs`，WWDC23：`https://developer.apple.com/videos/play/wwdc2023/10158/`，解释位置和速度需要连续、弹簧以小幅回弹和较长尾部收口，适当保留手势初速度。没有理由为了“弹性”把所有控件大幅缩放。
- Apple Human Interface Guidelines Motion：`https://developer.apple.com/design/human-interface-guidelines/motion`。

## 实际代码

- `physical-spring.mjs`：解析阻尼二阶振子，平均每 16ms 采样一次，形成 WAAPI transform keyframes。业务不安装新库，WebKit/Edge 均支持。
- `two-page-route.mjs`：保持两个完整页面静止布局，以同一位移轨迹一起滑入/滑出；改变到 duration 690ms / response 0.53 / damping 0.84；基于实际当前 transform 接续快速反向，清掉孤立 WebKit 动画和旧页残影。缓存不回退、Dock 不移动。
- `spatial-swipe-v56.mjs`：释放后的真实动力学从 k500/c37/315ms 截断调整为 k180/c23/最长 760ms；跟手阶段仍直接反映触摸，松开才使用弹簧积分；限制初速度避免跳动。
- `assistant.mjs`：新增 `toggle(source)`；头像第二次点击关闭，第三次可打开；顶部身份名称亦可点击收起。`open` 780ms、response 0.58/damping 0.76；`close` 610ms、response 0.48/damping 0.93。快速重复点击从当前真实 vertical transform 接续，不使用 scale。
- `shared-motion.mjs`：无源头卡片的底部 sheet 从下方升起 750ms 的实体 transform 弹簧，关闭往下返回 530ms；来源卡片已有 Magic Move 路径保留。
- `spring-refinement.css`：身份收起按钮与键盘焦点样式，未涉及 Dock。入口 `index.html/app.mjs` 缓存版本提升至 5.7.0。

## 测试（结果需要保留对应运行记录）

- 新 TDD 红/绿 `qa-v57-spring-toggle.cjs`：首轮 **0/10**（复现四大旧问题），后扩展快速反向和对话身份按钮；最终 **14/14** Edge+WebKit。
- `qa-academy-continuity.cjs`：**32/32**，Edge/WebKit、320/390px、设置搜索、助手开关、配置、底部 Sheet、Reduced Motion；等待条件改为动效真正关闭，而不是固定 350-470ms 的旧假设。
- `qa-two-screen-top-assistant.cjs`：**8/8**，原两整页双动和对话顶部进出测试，等待时间按新弹簧收口更新。
- `qa-vnext-phase2.cjs`：**18/18**，原任务/日记 Magic Move、focus、edge-pop。
- `qa-v4-duo-full-flow.cjs`：**18/18**，任务/完成/手记/助手主路径。
- `qa-agent-bridge.cjs`：**20/20**，Agent 授权、预览、执行撤销、天气/模型模拟、隐私回退。
- `qa-v4-dock-near-blur-press.cjs`：**14/14**。
- `qa-v4-five-mood-sprites.cjs`：**10/10**。
- `qa-v4-three-tab.cjs`：**13/13**。
- `qa-v4-theme-a11y.cjs`：**41/41**。
- `qa-v4-ios-input-zoom.cjs`：**16/16**。
- 新视觉证据预定存放 `docs/qa/evidence/2026-11-05-xiaoya-physical-spring/`，Edge/WebKit × 320/390/1440px，滑动中帧与顶部、底部弹簧中帧。截图不是视频连续帧率实测，需配合原始设备观察。

### 明确保留与边界

无变更：Dock/渐变模糊实现、底部三大导航、五张高清小芽心情资源、Agent 模块、个人/演示档案协议、评委地址；不自动上传用户私人日记，也不触发付费 BYOK 调用。

尚未经过真正 iPhone Safari 的软键盘、帧率、系统侧滑手势实机验证。WebKit 自动化不能替代真机。上线成功必须以**远程 main SHA、GitHub Pages 实际新版资源与在线浏览器主流程**同时核验。
