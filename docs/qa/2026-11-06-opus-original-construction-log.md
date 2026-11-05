# 小芽 Opus Original 施工记录

实验分支 `experiment/xiaoya-opus-original-20261105`（基于 `origin/main` 3a4a508）。仅新增 `little-works/xiaoya-apple/opus-original/`、本文件与 `docs/qa/evidence/2026-11-05-opus-original/`；未修改 main、native-v4、共享业务模块或 Pages。

| 提交 | 内容 | 验证 |
| --- | --- | --- |
| 61469d4 | 铅笔与墨水首版：日/周/长线、写一行、页边对话、信封、页脚日记、封底设置 | 单元 22；E2E 33/34 |
| — | 推送实验分支到 GitHub（普通推送，新分支；main 仍为 3a4a508） | `ls-remote` 核对 |
| 5fb2fdd | 提醒用例确定化：原失败系前序步骤消耗了 60 分钟提醒间隔（产品行为正确，测试假设错误）；`remind()` 返回投递结果 | Edge 3×17/17 |
| a7e3d93 | 课程/每周活动「这一次」停课、调课、恢复，原位留划痕；页面内确认卡替换全部 7 处 `window.confirm`；成长路线记为可擦掉的事务 | 单元 24；Edge 19/19；WebKit 19/19 |
| ea237a9 | 能力审计脚本 `qa-audit.cjs`（含 native-v4 读取实验写入的数据）；划痕与真实块共用分栏 | Edge 12/12；WebKit 12/12 |
| c0ea247 | 小芽注意力标记（坐在正在关注的铅笔/冲突旁）；页脚「今天落下的墨」回顾（排除已擦掉的采纳） | 单元 26；Edge 19/19 + 12/12 |
| 本次 | 独立预览入口 `Open-Preview.cmd` / `preview-server.mjs`；README 与本记录 | 见下 |

## 尚未验证 / 未完成
- 真机 iPhone Safari。
- 本机 WebKit 偶发整轮超时与 Edge 偶发表单替换：重跑通过，原因未查实。
- 单次「加课」界面。

## 下一步（一项）
在真机 iPhone 上打开预览，重点检查「写一行」软键盘、时间带点按与「这一次」调课表单。
