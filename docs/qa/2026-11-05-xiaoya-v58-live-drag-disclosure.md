# 小芽 V5.8｜真正跟手的 Safari 横滑与 Apple 式建议展开行

日期：2026-11-05。基线：`9098f8c5a39930eb7452f8a6feb5de80cd9f2135`。
独立施工工作树：`E:\CHATGPT\projects\_xiaoya_gesture_agent_polish_20261105`；
分支：`feature/xiaoya-live-drag-agent-fold-20261105`。

## 用户反馈与严格设计约束

用户 iPhone Safari 截图指出「其他提醒 · 3 条」和「这条建议的其他操作」为浏览器默认黑色三角和黑色文本，审美割裂。进一步强调不要 AI 式装饰圆角：采用 Apple 原生界面适度分组、文字层次、细分隔和轻触反馈；Duolingo 只用于操作反馈可见性，不增加廉价堆叠卡片。Dock 完全保留。

同时强调 iPhone 式交互：拖到哪，旧页和相邻页就同步移动停在哪，**手指未放开时路由绝不提交**；松手后才判断完成或弹回，不应把拖动转换成只有阈值触发的整页过场。

## 根因

- `spatial-swipe-v56.mjs` 已有两页 `translate3d` 跟手结构，却缺乏覆盖整个 `#workspace` 的 `touch-action: pan-y pinch-zoom`；iOS Safari 可以接管横滑成为浏览器平移、导致 app 的 pointermove 中断。
- 手势 `onDown` 原来排除了所有 button，用户从卡片和操作按钮开始拖动时无法触发横滑。新版本允许普通按钮开始拖动；时间轴、日记、输入框、长按事项、系统控件和链接仍排除。
- 现有两个 `<summary>` 没有自定义样式且仅有 20px 高，浏览器默认黑色箭头、折叠区域突兀；内嵌数据操作不能删除或改意图。

## 修复结构

- `gesture-disclosure-refinement.css`：全页面 `touch-action:pan-y pinch-zoom`，同时保护输入区；小芽建议使用**没有卡片背景、没有外描边圆角**的 Apple 式细分隔列表行、右侧精细 chevron、最小 48px 触控区域。暗色模式和 Reduced Motion 一并支持。保留旧 UI 颜色与大容器布局，不重新设计首页。
- `agent-bridge.mjs`：两个建议详情从原生黑三角文本转换为明确的 `summary + 内容容器` 语义；保留所有其他提醒、稍后再看、不再提醒等业务操作，第二行文案简化为「其他操作」。
- `agent-disclosure-motion.mjs`：展开/关闭分别 325/245ms WAAPI 内容高度+淡入过渡，关闭到 0 再改变原生 details.open。支持中途反向、Reduced Motion、自动清理、Esc/键盘生成 click。不移动 Dock。
- `spatial-swipe-v56.mjs`：接管源头按钮的水平手势，但只有水平移动超过 11px 后才确认意图，垂直优先原生滚动，触发后保护原本按钮的误点击；完成条件由约 28% 调整为约 42% 页面宽或更明确的快速滑动，未松手不会切页。
- 入口 app/index 使用 v5.8.0 缓存版本号，避免旧 Safari 缓存继续显示旧默认 summary。

## 验证路径

1. TDD 首次回归：`qa-live-drag-agent-disclosure.cjs` 为 **8/12**（缺整页 pan-y 策略、默认 summary），修复后 **12/12**。
2. 增加「从按钮区域开始拖动」用例先复现 **12/14** 失败，调整手势保护后 **14/14** Edge+WebKit。
3. 增加「两项详情平滑展开/关闭」的 TDD，原先 **12/14**（缺内容容器及连续高度动画），完成后 **14/14** Edge+WebKit。
4. `qa-v58-native-touch.cjs`：Chromium CDP 下发真正 touchStart→touchMove→touchEnd，采样松手前位移：旧页 **-175px**、新页 **+179px**，仍为 `page-today`；松手后进入事项，PASS。
5. 原版 V5.7/V4 回归：`qa-vnext-timeline.cjs` 12/12、`qa-v4-three-tab.cjs` 13/13、`qa-v4-dock-near-blur-press.cjs` 14/14、`qa-agent-bridge.cjs` 20/20、`qa-v4-theme-a11y.cjs` 41/41、`qa-v4-ios-input-zoom.cjs` 16/16、`qa-vnext-phase2.cjs` 18/18、`qa-v57-spring-toggle.cjs` 14/14。需在最终发布候选上复跑关键套件。
6. `qa-v58-visual.cjs` 收集 Edge/WebKit × 浅色 390px、深色 320px：折叠、一个展开、全部展开、手指停在中线，共16截图，归档 `docs/qa/evidence/2026-11-05-xiaoya-live-drag-agent-disclosure/`。

## 发布与未验证

- 不碰 Dock 布局/毛玻璃/动画，不碰角色素材、Agent 执行/权限、个人/演示隔离，也不新增网络请求或模型调用。
- 不能将 WebKit 自动化及 CDP Chromium 触控模拟称为**真实 iPhone Safari 测试**；仍需真机感受系统边缘后退冲突及实际帧率。
- 只在独立工作树提交，取最新远端 main 安全合并并非强推，Pages 以实际 HTTP 资源及在线交互作为最终发布证据。
