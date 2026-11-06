# 小芽 · 铅笔与墨水（Opus Original 实验版）

独立实验，分支 `experiment/xiaoya-opus-original-20261105`。不修改 native-v4、共享业务模块、评委入口或 GitHub Pages。

## 打开预览
- **Windows 双击** `Open-Preview.cmd`（需要 Node.js）。会在 `127.0.0.1` 启动本地服务并打开浏览器；关闭窗口即停止。
- 或命令行：`node preview-server.mjs`（`--personal` 打开私人档案，`--no-open` 不自动开浏览器，`--port 4417`）。
- 入口：演示档案 `/little-works/xiaoya-apple/opus-original/?judge=1`；私人档案去掉 `?judge=1`；正式版对照 `/little-works/xiaoya-apple/native-v4/?judge=1`。
- 本地预览是 `127.0.0.1` 源，与线上 GitHub Pages 的浏览器存储完全隔离，不会读写线上小芽里的真实数据。

## 设计
- **墨水 = 你保存的记录；铅笔 = 小芽的建议。** 建议画在它要占用的时段上，页边写依据；「落墨」走 `student.approve → executePlan`，「擦掉」走 `undoTransaction`。
- **日 / 周 / 长线** 是同一页时间的三个尺度。截止是「线」（时刻），执行是「面」（时段）；长空档压缩为「空着 N 小时」带。
- **小芽的注意力**：她坐在时间带旁、正在关注的那一笔旁边（先是铅笔，其次是冲突），点她打开那条批注。
- **写一行**：一个输入框同时负责记录（本地中文解析成铅笔草稿，回车才保存）、提问和「找 …」搜索。
- **这一次**：重复的课程/活动可以只停这一次或只调这一次；原位置留下划掉的痕迹，可随时恢复。
- **信封**：连接自备模型后，每条消息只附带你勾选的记录类别；日记正文永远不可附带；发送后清空。
- **页脚**：当天真实落下的墨（完成、采纳、目标行动）+ 心情与一句话，保存前显示「未保存」。
- 所有删除、覆盖、清空都使用页面内的确认卡；不可逆的操作需要勾选确认。

## 数据
与正式版共用 localStorage 键与 schema 1（`xiaoya-comparison:xiaoya-apple:*`、`xiaoya-dayflow:journal:v1:*`），不迁移、不改结构。课程例外使用原有 `exceptions`（cancel / replace）。

## 测试
- `node --test tests/line-parser.test.mjs tests/page-model.test.mjs` — 纯函数单元测试
- `node qa-opus.cjs --webkit --shots` — 主要交互流程（Edge + Playwright WebKit，桌面/移动/暗色）
- `node qa-audit.cjs --webkit` — 能力审计：任务、课程、学期、CSV/ICS、天气、心情、成长、模型、备份恢复、与 native-v4 互读
- 模型与天气接口均为 mock，不联网、不产生费用。

## 已知限制
- 未在真机 iPhone Safari 验证；Playwright WebKit 不等于真机。
- 本机 WebKit 偶发整轮点击超时（同时期系统 WMI/netstat 也卡顿），重跑通过，判断为环境问题，但未彻底排除。
- Edge 中曾两次出现「打卡表单内容被替换」的偶发失败，3 次以上重跑未复现；测试已加诊断输出，原因未查明。
- 单次「加课」（exception type `add`）仍未提供界面，可用单次活动代替。
