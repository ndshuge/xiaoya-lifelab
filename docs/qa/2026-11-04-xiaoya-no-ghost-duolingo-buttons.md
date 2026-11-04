# 小芽 V4｜2026-11-04 11:31 用户 Safari 视频：无残影 + 多邻国式实体按钮

## 现场反馈与根因

- 用户上传 `ScreenRecording_11-04-2026 11-31-12_1.mp4`，指出页切换有**残影**，部分按钮缺少可触摸的反馈，希望参考多邻国。
- 真实导航根因：`app.mjs` 每次导航复制 `#workspace` 到 `.xy-route-ghost`，再以半透明叠放的方式退出 180ms。虽然 ghost 禁用交互，仍可以在新页面上看到旧标题、表格和卡片重影。
- 真实按钮问题：原 `spring-flash-fix.css` 更偏图标缩放，许多实体按钮没有可见底边厚度，部分文字动作需要保持轻量而非“一排绿色下划线”。原生浏览器不存在多邻国视觉资产或触感引擎，不能宣称复刻官方代码。

## 原则与已实现

本次按已读取的 `SHUGE Apple Product Audit`、`Apple Liquid Glass Motion`、`Motion CSS or Motion`、`SHUGE Apple Gesture Audit` 及已有项目 `AGENTS.md` 执行：反馈从按下开始，完整按住/松开/取消，可访问点击区不变；指针/键盘状态有明确降级；不引入第三方 Motion 运行库。

- `app.mjs`：**彻底删除旧页面 clone/ghost 机制**，真实页面同步更新，全程仅一份页面 DOM，没有双层叠影。保留无透明度变化的标题 4px/220ms 轻过渡；设置与搜索仍作为次级页面，原标签状态、滚动与草稿保留。
- `duo-press.css`：基于小芽原本绿色和中性色，为真正有背景的按钮增加 4px/2px 厚度；按住时底部阴影收起、图标/表面轻微下沉，保持原按钮 hitbox 几何。拓展 `press-feedback.mjs` 的 pointer 状态覆盖目标、日记、弹窗等原来无反馈的按钮。
- `duo-press-final.css`：截图复查发现文字链接被 4px 底边误装饰，于是加最后的视觉细化：纯文字动作保留轻量反馈，无 3D 下划线；心情区域仅**选中项 4px 厚度**，其余 2px 弱层次。深色/高对比度和减少动效按项目旧规则保留。
- `index.html`：正确追加两层按钮样式与新的模块资源缓存版本，确保浏览器不会沿用旧页重影脚本。
- 既有 `qa-v4-motion-dock.cjs`、`qa-v4-video-apple-motion.cjs` 更新为明确禁止旧页面快照；增补 `qa-v4-no-ghost-duo.cjs` 在 Edge/WebKit 强制切换多页、按住心情与日记按钮、验证 3D 厚度及文字动效不冒充实体按钮。

## 已知验证与边界

- 无残影 + 多邻国式反馈专项最新 **14/14 通过**（Edge/WebKit）。
- 其他 Dock／页动效／弹性专项此前在施工树内分别 **10/10、10/10、16/16 通过**；最新全套综合结果以 `E:/CHATGPT/work/xiaoya-v4-no-ghost-duo-qa-20261104.json` 的最终全部 28 个测试组为准，不在全部结束前宣称总体通过。
- 视觉证据：`E:/CHATGPT/work/xiaoya-v4-no-ghost-duo-review-20261104` 中 5/50/115/260ms 中间帧；`E:/CHATGPT/work/xiaoya-v4-no-ghost-duo-visual-20261104` 中浅/深色今天、事项、发展、设置、编辑弹窗、桌面画面。
- 未完成项：**真实 iPhone Safari** 手感、120Hz、视觉审美确认、真正 Duolingo 原生触觉、L2 光学折射。浏览器模拟不等于 Apple / Duolingo 官方引擎。

## 发布约束

- 只修改 `little-works/xiaoya-apple/native-v4` 和本 QA 记录，不碰原 V3、评委 URL、个人数据存储。以安全快进推送、真实公网版本检查作为独立验收门槛。
