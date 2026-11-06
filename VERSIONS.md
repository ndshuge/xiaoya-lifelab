# 小芽 · 正式仓库与版本档案

更新：2026-11-03

## 固定比赛入口

- 固定地址：`https://ndshuge.github.io/xiaoya-lifelab/?judge=1`。
- 对应 GitHub 仓库：`ndshuge/xiaoya-lifelab`，**并非星系仓库**。
- 根目录 `index.html` 当前在仓库内部转到 `little-works/xiaoya-apple/native-v4/`，原查询参数 `judge=1` 被完整保留。
- GitHub Pages 的网页内容可以持续发布；当时提交的比赛 ZIP/视频/PDF 属于不可自动更新的历史材料。
- 原独立仓库的根源码与 V3 目录完整保留，供回滚和功能审计。

## 所有版本

| 版本 | 仓库内路径 | 状态 |
| --- | --- | --- |
| **Apple Native V4 / DAYFLOW** | `little-works/xiaoya-apple/native-v4/` | 正式最新入口：今天／事项／发展 |
| **Opus Original · 铅笔与墨水** | `little-works/xiaoya-apple/opus-original/` | 独立原创实验版；版本档案默认进入 `?judge=1` 演示模式，不覆盖正式版 |
| **Apple Native V3** | `little-works/xiaoya-apple/native-v3/` | 2026-11-02 完整存档：原始 Apple 新版与 AI、成长规划 |
| **Apple 早期版** | `little-works/xiaoya-apple/` | 保留历史设计 |
| **经典 LifeLab** | `original.html` | 保留经典成熟功能 |
| **Pro · DAYLINE** | `pro/` | 独立设计预览 |

`/versions/` 是版本档案页。V4 在「设置 → 浏览历史版本」进入；其他版本保留独立版本菜单。

## V4 数据与功能边界

「今天」展示实际保存的课程活动时间线与本地规则建议；没保存的内容不会凭空生成。
「事项」在每个日期单独列出到期提醒，实际课程/活动占用时间格。**DDL 只代表最后期限，不代表开始做作业的时间**。
没有日期的任务进入独立待办；任务创建时可以不填截止日期。
「发展」提供心情、日记、7/30 日统计、历史日志、长期目标、真实行动打卡和成熟的成长路线生成。

旧主档案的数据 schema v1 保持不变。新日记使用独立版本号的浏览器存储键，
`xiaoya-dayflow:journal:v1:demo` / `xiaoya-dayflow:journal:v1:personal`，
与合成演示档案和私人档案分别隔离，导入／导出 JSON 的 `journalV1` 字段携带本模式的日记。
切换版本前建议备份。V3 不读取这一新增的日记字段，但不会删除 V4 的独立日记本地存储。

本地规则建议与真实 AI 对话明确区分，用户必须自行提供 API Key、授权连接并验证服务商；
AI 对话不自动上传任务、课程或日记。心情趋势只是自愿记录的描述，不做诊断或因果推断。

## 源码溯源与更新规则

- 最新正式发行在 `ndshuge/xiaoya-lifelab` 的 GitHub Pages `main` 分支。
- V3 的 Apple 源码来自历史研发仓库 `ndshuge/ndshuge-galaxy` 提交 `4091273a87e0a9d3039a24833604169085946d16`；此溯源见 `APPLE_SOURCE_PROVENANCE.json`。
- V4 从**原仓库 V3 的完整拷贝**创建于独立 worktree `feature/xiaoya-native-v4-dayflow-20261102`；V3 历史原件保留不修改。
- 不得仅在 Galaxy 修改源码后假设正式网页会更新；正式发布需从 `xiaoya-lifelab` 更新并运行回归测试。
- 重新同步历史 Galaxy 源码可能会覆盖新的 V4 功能。历史同步脚本 `scripts/sync_apple_from_galaxy.py` 是**V3 历史研究工具**，不适用于主动覆盖 V4。

## QA 与验收

```powershell
node tests/competition-apple-link.test.cjs
node tests/qa-version-bundle.test.cjs
node tests/qa-version-pages.cjs
node tests/qa-dayflow-v4.test.cjs
node little-works/xiaoya-apple/native-v4/qa-dayflow-data.mjs
node little-works/xiaoya-apple/native-v4/qa-v4-journal-items.mjs
node little-works/xiaoya-apple/native-v4/qa-v4-three-tab.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-webkit.cjs
node little-works/xiaoya-apple/native-v3/qa-judge-mode.cjs
node little-works/xiaoya-apple/native-v3/qa-assistant-restore.cjs
node little-works/xiaoya-apple/native-v3/qa-growth-restore.cjs
```

WebKit 自动化测试属于桌面模拟；真实 iPhone Safari 触控、键盘、视觉 L2 仍需真机确认。
