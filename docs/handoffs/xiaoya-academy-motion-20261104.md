# 小芽 LifeLab｜学院式动效接管卡

日期：2026-11-04
主仓库：`https://github.com/ndshuge/xiaoya-lifelab`
正式访问：`https://ndshuge.github.io/xiaoya-lifelab/`
评委访问：`https://ndshuge.github.io/xiaoya-lifelab/?judge=1`

## 本阶段基线与产物
- 开始时基线 `360e7d64a898b9a43cff6258bef483c78c971089`（Agent V3 正式上线）。
- 隔离工作树 `E:\CHATGPT\projects\_xiaoya_academy_swipe_20261104`。
- 分支 `feature/xiaoya-academy-swipe-tactile-20261104`。
- 预定发布标签 `xiaoya-academy-motion-20261104`（只有实际推送验证后才算存在）。
- 研究与详细审计：`docs/qa/2026-11-04-xiaoya-academy-continuous-motion.md`。
- 计划：`docs/superpowers/plans/2026-11-04-xiaoya-academy-spatial-swipe.md`。
- 最新效果 30 张截图：`docs/qa/evidence/2026-11-04-xiaoya-academy-motion/`。

## 代码清单
- `native-v4/spatial-swipe.mjs`：主导航和内部双标签的水平触摸/指针手势，弹簧跟手反馈、取消回弹，保留单一真实页面。
- `native-v4/academy-swipe-tactile.css`：非 Dock 主要/次要/图标按钮和卡片质感，以及触摸提示。
- `native-v4/app.mjs`：导入并接线手势，设置/搜索方向揭示，采用新版本号防止旧缓存。
- `native-v4/assistant.mjs`：连续展开收回、配置面板动画、快速切换收口定时保护。
- `native-v4/shared-motion.mjs`：普通 Sheet 无来源时的进出，来源卡片 Magic Move 保留。
- `native-v4/index.html`：加载新增样式及当前 app 版本。
- `native-v4/AGENTS.md`：记录本轮用户明确更新的动效规范。
- 新测试：`qa-academy-swipe-tactile.cjs`、`qa-academy-continuity.cjs`、`qa-academy-visual.cjs`；旧 `qa-v4-duo-full-flow.cjs` 修订等待视觉退出的断言。

## 不得修改
- Dock 全部玻璃/布局/模糊/按压代码、底栏 icon 与 geometry。
- 五张现有高清心情形象及图片数据。
- 数据模型、个人/演示隔离、Agent 权限和 BYOK 协议。
- 已发布的评委 URL 和原 V3 归档。

## 残余真实验收
- 真实 iPhone Safari 与 iPad Safari 手势跟随、系统返回侧滑冲突；实机软键盘与动态视口。
- 用户提供的鼠哥学院原视频在本阶段无法直接访问，已根据实验室和可查看页面源码研究；不得把代码研究写成原视频逐帧验收。
- 用户对“性感/生命感”动效节奏的最终主观审美批准，未拿到。
- 这些项目没有软阻塞桌面/模拟浏览器内已证实功能，但发布报告务必如实标注。

## 下一次恢复步骤
1. 切换到上方隔离工作树，先读 AGENTS.md、该 handoff、详细 QA。
2. `git status --short --branch`、`git fetch origin main`，核验 main、tag 与远程 Pages。
3. 运行 `node native-v4/qa-academy-swipe-tactile.cjs` 和 `node native-v4/qa-academy-continuity.cjs`（从仓库根目录完整相对路径执行）。
4. 对有变更的模块复跑 Agent、Dock、无障碍和一等真实浏览器检查，不覆盖并行未提交工作树。
