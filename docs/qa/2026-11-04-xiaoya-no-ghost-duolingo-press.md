# 小芽 V4｜2026-11-04 11:31 iPhone Safari：彻底移除残影并采用多邻国式按键反馈

## 用户原始证据与根因

录屏：`ScreenRecording_11-04-2026 11-31-12_1.mp4`（19.97 秒、512×1112、30fps）。
- 0–3s、4–10s：发展页「记录／目标」「心情五选一」不断交替；可以看到页面切换时的复制内容遮挡与按钮反馈不均匀。
- 12–19s：「今天／事项」来回导航和翻周；旧内容在新内容上方短暂残留，且「添加截止」等文字型操作没有合适的触感。
- 根因：`app.mjs/transitionContent` 创建 `.xy-route-ghost`，使用 `cloneNode(true)` 克隆整个旧 `#workspace`，透明并移位 180ms。即使实际 DOM 已同步切换，旧页面还会独立绘制到屏幕上。这就是用户看到的「残影」。仅调整透明度/时长不能从根本上移除双层画面。
- 第二个根因：此前的弹性强调 SVG/文字 `scale(.89)`，但实体按钮本身没有清晰的按键厚度；把这种厚边机械应用到文字型链接又会造成绿色下划线。

## 查阅的参考及落实

- **官方 Duolingo 博客**：`https://blog.duolingo.com/shape-language-duolingos-art-style/`（圆润、可识别、轻松活泼）与 `https://blog.duolingo.com/core-tabs-redesign/`（导航始终稳定、要有明确的功能目的和完整 QA）。
- **公开实现参考**：`https://zenn.dev/kg_lens/articles/bff9359c61168d`：模拟真实按键行程时使用下缘 `box-shadow` + 按下收起厚度，避免真实调整 border 改变布局。
- **本机插件 Skill**：SHUGE Apple Product Audit、Apple Liquid Glass/motion、Motion/css-or-motion 与 SHUGE Apple Gesture Audit，重点采用持久的 pointerdown/held/up/cancel 反馈、重渲染接力、无障碍媒体降级、无布局位移。
- 仅借鉴按键交互原理；保留小芽原有墨绿／中性色和文字体系。不复制多邻国的猫头鹰、美术、强色或声音，不安装新动效库。

## 实际改动

- `native-v4/app.mjs`：删除 `#workspace` 的克隆、旧页面副本、退出动画和 ghost 清理定时器。今天／事项／发展及二级设置仍**同步更新唯一真实页面**；可选只给标题执行 4px、220ms 的轻微位置回落，无旧页面层，无整页 opacity 改变。保留前进／后退方向标记及草稿／滚动恢复。
- `native-v4/duo-press.css`：仅对**填充式实体操作**（心情、保存记录、目标打卡、周切换、助手快捷操作等）增加 2–4px 下缘厚度；按住时收起厚度，内部图标／文字下沉 2px。当前选中的心情按键比其他选项更突出。Dock 保持稳定的触摸区域和现有浮动材质；纯文字的添加、删除、取消、保存标题按钮不再出现「绿色下划线」假阴影。
- `native-v4/press-feedback.mjs`：沿用可靠的 pointerdown／up／cancel 和 Space/Enter 按键生命周期，增加目标打卡、助手快捷、弹层按钮等触发对象；日程／待办与日期 re-render 继续保留既有 WAAPI 回弹接力。更新模块缓存标识以避免旧 JS。
- `native-v4/index.html`：接入 `duo-press.css?v=4.6.4`，升级 `app.mjs?v=4.5.8`，`press-feedback.mjs?v=4.6.5`。
- `qa-v4-motion-dock.cjs` 与 `qa-v4-video-apple-motion.cjs`：旧 QA 的「必须存在视觉 ghost」是过时合同。已改为断言导航同步、方向正确、点击框不漂移且 ghost **始终为 0**。原版旧 QA 期待 ghost 是为了动画，用户的新需求优先级更高。
- 新增 `qa-v4-no-ghost-duo.cjs`：Edge/WebKit 的快速六次导航、`#workspace` 透明度恒定、心情按钮 press／held／release 及 aria-pressed、已选中按键突出、保存记录下缘按压、纯文字操作不出现厚阴影、reduced motion 和 console 无错误。

## 质量边界

自动化只证明**当前 Edge 与 Playwright WebKit** 的 DOM、计算样式和操作结果；不代表 iPhone 真机 120Hz/手感或 Apple 原生。用户 iPhone 新录屏继续作为最终视觉验收证据。保留评委固定地址、原 V3 档案、评委与个人数据隔离、AI 同意和本地隐私。
