# 小芽 LifeLab｜鼠哥学院视频精修交接

## 工程基线
- 开发隔离目录：`E:\CHATGPT\projects\_xiaoya_video_refine_20261105`
- 开发分支：`feature/xiaoya-video-refinement-20261105`
- 基线：`5980b4576d0bdd78e2204d17a34486073049d51c`，已有学院式滑页/Agent V3/Dock 冻结。
- 原始视频：用户上传的 `ScreenRecording_11-04-2026 23-15-00_1(1).mp4`，**32.533 秒 30fps 512×1112**；视频文件仅供内部研究，未提交公开仓库。
- 视频分镜与证据报告：`docs/qa/2026-11-05-xiaoya-academy-video-verified.md`。
- 原创小芽截图 20 张：`docs/qa/evidence/2026-11-05-xiaoya-video-refinement/`。

## 本轮源码变更
- `native-v4/app.mjs`：参考视频 4.64–5.10s，给真实「今天／事项／发展」根容器第一层内容增加 38ms 间隔、238ms 时长的透明度/饱和度分层揭示；不移动真实控件的 DOM 或命中框，兼容 Reduced Motion。
- `native-v4/shared-motion.mjs`：无来源卡片的弹窗从底部逐步揭示，关闭反向收口，保留来源卡片 Magic Move。
- `native-v4/academy-video-depth.css`：Backdrop 背景渐暗/轻微模糊；**修复原生 dialog 被拉伸却只有短内容时，面板下方透明空洞**。视觉 frame 的底边和视口一致，390px 时 `top=401.625, bottom=844, height=442.375`。
- `native-v4/index.html`：缓存版本 5.4.0，加载上述精修样式。
- 测试：新增 `qa-video-reference-motion.cjs`（Edge/WebKit **12/12**）；新增 `qa-video-reference-visual.cjs`（20 张小芽截图，非鼠哥学院视频截图）；原 `qa-v4-dock-near-blur-press.cjs` 改进 WebKit 测试定位时序，3×14/14；`qa-vnext-timeline.cjs` 改为选择合成档案真实有课星期三，恢复 12/12；`qa-academy-swipe-tactile.cjs` 诊断信息更精确，3×18/18。
- **禁止修改区始终保持不变**：Dock CSS/JS、五张高清小芽资产、Agent 业务与用户私有数据结构、原 V3/Pages 评委入口。

## 重点验收
1. 视频定向：12/12 Edge+WebKit，包括多页分层、底部贴底、背景层级、Reduced Motion、快速关闭、无鬼影。
2. 导航连续性：32/32；左右滑动：18/18（曾连续 3 次通过）；旧 Duolingo 流程 18/18，Agent 桥 20/20。
3. Dock：14/14（3 次重复），心情 10/10，深浅色/无障碍 41/41，移动输入缩放 16/16，长按 10/10，旧 Phase2 18/18。
4. 时间轴 12/12；首次加载 9/9；键盘视口 7/7；6 个 Agent 业务单测 53/53。
5. Edge/WebKit 是桌面浏览器及模拟屏幕/触控，**没有真实 iPhone Safari 实机**。GIF/静态截图不可代表触摸性能；真实帧率测量未完成。

## 发布纪律
- 在推送本分支前，先清理测试重生成的旧 Agent 截图；仅提交本轮 20 张截图及文字证据。
- 从最新 `origin/main` 新建独立 release worktree，先合并、再运行关键 QA，普通非强制推送，核验新的 SHA。
- 上次 `5980b45` Pages GH Actions run `41863330975` 曾排队，最终 `completed/success`，其三项新文件实际 HTTP 200。新提交必须重新检查独立部署，不得把上次成功算作本次成功。

## 仍未完成的外部边界
- 实机 iPhone/iPad Safari 触摸阻尼、侧滑冲突、系统动画合成及实际帧率，缺少授权设备。
- 用户视觉审美最终确认依赖其实际体验。
- 真实云模型/BYOK 与真实天气不在本次动效施工范围且未经授权，不自动进行付费调用。

## 下次恢复
先读 `native-v4/AGENTS.md` + 本文 + `docs/qa/2026-11-05-xiaoya-academy-video-verified.md`。检查各 worktree / Git status / remote main、最近部署 run 和真机测试证据，再决定下一轮精修。