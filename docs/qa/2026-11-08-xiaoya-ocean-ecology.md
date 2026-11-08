# 2026-11-08 · 小芽小岛海洋生态增量验证

项目：ndshuge/xiaoya-lifelab，工作树 `E:/CHATGPT/projects/_xiaoya_ocean_ecology_20261108`
基础：2026-11-07 远程 main `5b12831`。施工分支 `feature/xiaoya-ocean-ecology-20261108`。
参考：xiaowuzicode/xiaodao-island（MIT），保留现有 Three.js / 纸岛系统，未复制其 Astro 网站。

## 证据
- Node `node --test tests/*.test.mjs`（Opus 目录）共 9 个文件：**58/58 PASS**；含鱼群确定性、沿海界限、受惊衰减、减少动态守卫、shader 插槽/移动轻量及括号平衡。
- `node qa-ocean-ecology.cjs --webkit`：6 个浏览器场景（Edge 桌面、Edge 手机、夜景、低动态、夜景灯塔截止触发、WebKit 手机），均 PASS。手机鱼数 6，桌面 12；真实空水面单击触发，拖动无误触，减少动态 0 涟漪。无 WebGL Shader console errors。
- `node qa-seaside.cjs --webkit`：**11/11 PASS**，现有旗杆/小芽角色/镜头/30 课程/浪和船/手机/低动态/夜景/WebKit 仍工作。
- `node qa-opus.cjs --webkit`：首轮 **39/40 PASS**，Edge「编辑表单内容偶发被替换」失败一次；同仓库旧 README 已将此列为难以复现的既有问题。本次未修改表单代码。随后 `node qa-opus.cjs` Edge 单独复跑 **20/20 PASS**，WebKit 首轮 **20/20 PASS**。保留该偶发风险，不宣称根因已修复。
- `node qa-audit.cjs --webkit`：**24/24 PASS**，验证旧业务、同 Native V4 的数据互读、导入导出、用户批准、天气与日记等。
- 根入口/历史版本门禁：`competition-apple-link.test.cjs` **7/7 PASS**，`qa-version-bundle.test.cjs` **6/6 PASS**，`qa-version-pages.cjs` **10/10 PASS**。
- 已实际目视检查 QA 图片：`E:/CHATGPT/_temp/xiaoya-ocean-qa-20261108/desktop.png`、`phone.png`、`desktop-night.png`、`desktop-night-lighthouse.png`。截图及 JSON 在本机临时证据目录，未加入源码提交。
- 新增水下视觉通过单张既有 ocean ShaderMaterial 完成，未增加新的 GPU render pass；GPU 真机耗时仍未测量。

## 代码复核
完整集成 diff 与新模块由当前施工者自审（当前环境没有独立审查子代理），检查了输入边界、内存释放、后处理 pass、lite 分支、夜景、交互与数据隔离；不等于第三方独立评审。未观察到新的阻断性缺陷。

## 产品边界
根评委入口、native-v4、localStorage schema、课表、目标、对话与纸岛布局均未修改；未修改 main，未部署 GitHub Pages。已将可选程序化海浪声作为独立模块并入整合分支：需用户手动开启，默认静音，离岛即停、返回不自启。iPhone Safari 真机音频、视觉和性能未验收。

## 同日整合分支复验（2026-11-08）

- 整合分支：`feature/xiaoya-ocean-integrated-20261108`，本机独立工作树 `E:/CHATGPT/projects/_xiaoya_ocean_integrated_20261108`。生态两次功能提交、海浪声三次提交及生态设计/QA文档通过 cherry-pick 组合，未改线上 `main`。
- 整合后 Node 海岛单元测试 **61/61 PASS**（比生态版多 3 项音频测试）。根入口与六版本检查 **7/7 + 6/6 + 10/10 PASS**。
- 同一整合工作树重新执行 `qa-ocean-ecology.cjs --webkit`：**6/6 PASS**。桌面鱼 12、手机鱼 6，海面点击及拖动守卫/夜灯塔均正确。
- 同一整合工作树执行 `qa-seaside.cjs --webkit`：**11/11 PASS**。小芽人物、航路、七日期旗杆、移动、弱动态及 WebKit Shader 均通过。
- `qa-ocean-audio.cjs --webkit`：Chromium 桌面及模拟手机音频开关流程通过；WebKit 无 AudioContext 的无声降级路径通过（该 WebKit 环境不能验证真实 Safari 音频播放）。新单元测试验证暂停期间异步恢复不会自动重开。
- 整合后 `qa-audit.cjs --webkit`：**24/24 PASS**；课程、任务、日记、天气、成长路线、导入导出、与旧 Native V4 数据互读均通过。
- 测试截图移到 `E:/CHATGPT/_temp/xiaoya-ocean-integrated-seaside-20261108`，避免误作为源码提交。浏览器模拟不等于 iPhone 真机验收。

## 后续建议
在 iPhone Safari 真机复核画质、热量、帧率和触控；合并发布前刷新 origin/main 并在干净发布树重新验收；评委入口保持不变。
