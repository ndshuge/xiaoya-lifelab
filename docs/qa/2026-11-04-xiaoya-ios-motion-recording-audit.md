# 小芽 Native V4｜iPhone Safari 录屏驱动的动效修正

2026-11-04 · 基线 `origin/main@93e902b` · 单独工作树 `E:/CHATGPT/projects/_xiaoya_v4_apple_motion_video_20261104`

## 用户现场证据与范围

2026-11-04 聊天上传的 iPhone Safari 录屏，9.0s，512×1112、30fps。核对了 0–2.5s「事项、发展、今天」跳转、3–6.5s「日程／待办」及日期变化、6.5–7.5s「设置」过渡，问题是页面的空间来路不清晰、分段按钮选中状态跳跃、按下状态不够直接，设置页看起来被整层淡化。Safari 自带底部地址栏并非网页能更改的材质。

## 真实依据、Skill 应用及边界

- **READ & APPLIED**：`apple-web-design/shuge-apple-product-audit` 与审计矩阵（录屏→真实代码→缺陷→测试）；`shuge-apple-design` 的 `INTERACTION_SPEC.md`（运动方向、物理连续性、真实点击区不变）；`apple-liquid-glass/motion.md`（按下即时反馈、同路进退、短而克制、可中断、Reduced Motion）；`apple-web-design/motion` `best-practices/css-or-motion.md` 与 `index.md`（轻交互使用 CSS，方向过渡沿用本项目的原生 WAAPI）；`shuge-ui-fidelity/shuge-apple-gesture-audit`（实际录屏证据、前中后帧、反向点击）。
- **官方参考**：Apple Human Interface Guidelines 的 [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) 与 [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)，关注状态反馈、简短精确、空间一致和可取消；网站需要 JS 才能完整阅读，不声称已经观看 Apple 官方交互视频。
- **未导入第三方 Motion JS 运行时**：当前产品是 vanilla JS，现有 WAAPI + CSS 足以完成范围内的修正；不是通过“读取 Motion Skill”便拥有官方原生物理引擎，也没有使用付费 Motion+。
- **不宣称**：原生 SwiftUI 转场、真实 L2 背景光学折射、120Hz 真机性能或用户视觉认可。

## 实现

- `native-v4/app.mjs`：主页面及设置二级页面依然同步提交目标 DOM（不延迟点击）；原来退出页仅移动 7px／90ms、新页延迟 70ms 后 170ms 淡入，改为**退出 20px／180ms、新页面 240ms 协调显现、非交互标题 7px／250ms 轻位移**。整个 `#workspace` 不做 transform，防止点击框随动画漂移。任何新导航先取消旧动画；退出快照只做 inert/aria-hidden 的视觉层、限时清理。
- `native-v4/apple-motion-feedback.css`：为「日程／待办」新增独立移动底板；注册数值型 CSS 属性 `--xy-items-index`，切换完整重新渲染的 DOM 时由 WAAPI 把底板从前一页位置移动到目标位置（310ms）。按钮按下增加绘制层反馈（指针按住即保持，松开或取消即复位），完全不缩放交互元素本身；深色/强制颜色/减少动效具备降级。
- `native-v4/index.html`：追加新版样式在深色主题文件之后，`app.mjs` 资源版本从 `4.5.5` 改为 `4.5.6` 避免缓存沿用旧动画。
- `qa-v4-video-apple-motion.cjs`：Edge + WebKit 分别验证 press 按住、分段底板移动、退出方向/时长、点击几何不移动、连点逆向与 Reduced Motion；录屏前后的阶段截图采样在 `E:/CHATGPT/work/xiaoya-v4-motion-video-review-20261104/`。截图所需运行时间会改变精确帧时刻，**不能据此宣称 iPhone 逐帧一致**。

## 验收

- **RED→GREEN**：原基线可复现退出偏移不足（7px）及缺失「日程／待办」移动底板；修复后 `qa-v4-video-apple-motion.cjs` **10/10 PASS**（Edge + WebKit），`qa-v4-motion-dock.cjs` **10/10 PASS**。
- 完整 V4/V3/AI/评委入口回归：见 `E:/CHATGPT/work/xiaoya-v4-apple-motion-qa-20261104.{json,log}`，以最终完整进程退出结果为准。
- **仍待**：用户 iPhone Safari 同视口复录与主观手感评审；0/25/50/75/100% 实际真机对照；Safari 地址栏和底部悬浮 Dock 遮挡细节；真实 L2 局部实验和横向浏览器性能。所有项不可凭 Windows 浏览器测试写成 PASS。
