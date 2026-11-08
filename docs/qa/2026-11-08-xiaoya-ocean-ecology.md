# 小芽 Opus 生活小岛｜2026-11-08 海洋生态 QA

基线 GitHub main：`5b12831`。独立开发树：`feature/xiaoya-ocean-depth-gpt6-20261108`，未部署。

## 本轮改动（只包含现有小岛）
- 现有海水 Shader 上增加水深颜色吸收、沙纹、局部海草床、稀疏礁石/焦散。
- 4（手机）/8（桌面）只鱼影，按 4 只一群绕岛游动，点击水面惊逃后恢复。移动中不制造涟漪。
- 单三角透明扫光依附原 DDL 灯塔；夜间出现且允许减少动画。仅限当前周有截止事项。
- 原有地形、业务、导入导出、时间页脚、旧版链接和数据键未修改。

## 验证证据
- `node --test little-works/xiaoya-apple/opus-original/tests/*.test.mjs`：58/58 通过（含本轮新增 7 项）。
- `qa-ocean-ecology.cjs --webkit`：desktop-day、mobile-day、desktop-night、mobile-reduced、webkit-day 均通过；各有真实 Chromium/WebKit 截图。`docs/qa/evidence/2026-11-08-ocean/results.json`。
- 受影响的原回归 `qa-seaside.cjs --webkit`：11/11 通过（原日程标记、远近镜头、小芽跟随、灯塔折叠、30 项密度、帆船、手机点击、低动态、夜间与 WebKit）。

## 局限
- 自动验收使用桌面 Playwright 的模拟手机和 WebKit；尚未用用户的真实 iPhone Safari 做 60fps/耗电/触感验收。
- 当前仍是程序化海面鱼影，没有水下真实几何鱼模型、音频或物理照明反射；画面是纸艺风格升级，不应宣称具有独立真实水下场景。
- 参考原理与海面分层思路：xiaowuzicode/xiaodao-island（MIT），本轮没有导入其 3D 模型或贴图，也未直接复制着色器片段。
