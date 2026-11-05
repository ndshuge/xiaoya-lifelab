# 小芽 · 铅笔与墨水（Opus Original 实验版）

独立实验，分支 `experiment/xiaoya-opus-original-20261105`。不修改 native-v4、业务模块、评委入口或 Pages。

## 设计
- **墨水 = 你保存的记录；铅笔 = 小芽的建议。** 建议直接画在时间带上它要占用的位置，页边写依据；「落墨」走真实 `student.approve → executePlan`，「擦掉」走 `undoTransaction`。
- **日 / 周 / 长线** 是同一页时间的三个尺度，替代三个 Tab。截止是「线」（时刻），执行是「面」（时段）；长时间空档压缩成「空着 N 小时」带。
- **写一行**：一个输入框同时负责记录（本地中文解析成铅笔草稿，回车才保存）和提问/搜索（页边对话）。
- **信封**：连接自备模型后，每条消息只附带你勾选的记录类别；日记正文永远不可附带；发送后清空。

## 运行
从仓库根目录起任意静态服务器（需 `.mjs` → `text/javascript`），打开
`/little-works/xiaoya-apple/opus-original/?judge=1`（合成演示档案）或不带参数（私人档案）。
与正式版共用同一 localStorage 键与 schema 1，无数据迁移。

## 测试
- `node --test tests/line-parser.test.mjs tests/page-model.test.mjs`（22 项）
- `node qa-opus.cjs --webkit --shots`（Edge + Playwright WebKit，桌面/移动/暗色，模型与天气接口均为 mock，不产生费用）

## 已知未完成
- Edge 下「提醒」E2E 用例偶发失败（WebKit 通过），疑为启动时自动提醒占用了提醒间隔，未查实。
- 未在真机 iPhone Safari 验证；Playwright WebKit 不等于真机。
- 课程单次例外（停课/调课）编辑未提供（正式 V4 同样未提供 UI）。
- 删除/清空使用浏览器原生 confirm。
