# 小芽 DAYFLOW V4 · Apple 前端审计与整改

更新：2026-11-03。针对固定评委入口所对应的 `little-works/xiaoya-apple/native-v4`，在独立工作树中执行；本文件的结论来自真实代码、Edge/Playwright 浏览器计算值与截图，而非自动打分。

## 目标与原版保护

- 基准：`ndshuge/xiaoya-lifelab` 正式仓库 `main@591e004`。
- 原始评委地址保持 `https://ndshuge.github.io/xiaoya-lifelab/?judge=1`，原版 `native-v3` 维持存档。
- 最终用户操作仍为「今天｜事项｜发展」，唯一小芽头像启动对话。DDL 仅作为截止日期，绝不改写真实课表。
- 设计方向：**Clean + Hybrid navigation**。正文不做大片磨砂、提高文字层级，Dock、头像对话才使用玻璃材料。

## 实际读取的 ChatGPT 插件 Skill

使用 ChatGPT 挂载的 `skills__read` 读取并用于审计：

1. `apple-web-design/skill.md` + `references/visual-language.md`、`references/qa-scenarios.md`、`references/interaction-materials.md`：内容层级、44px 点击区、真实模糊级别、交互生命周期。
2. `apple-liquid-glass/skill.md` + `app.md`、`review.md`、`motion.md`：iOS 式侧重内容与浮动材质，保留触控安全区与连续动画。
3. `shuge-apple-design/skill.md` + `QUALITY_GATES.md`：分开判断功能通过、视觉验收与真机 Apple Safari。
4. `impeccable/skill.md` + `reference/craft-floor.md`：字号、材质、无用途英文标签等冗余信息清除。
5. `finesse-ui/references/apple-design.md`：product/app 模式比品牌站更适合本项目。
6. `design-taste-frontend/skill.md` + `references/app-screens.md`：减少 KPI 假充实感，保留项目真实任务与小芽角色。
7. `frontend-dual-source/skill.md`：截图、真实功能、信息减法分离验证。
8. `motion/skill.md`、`liquid-glass-web/skill.md`：确认原项目无需更换框架。**未引入** WebGL/SVG L2 引擎，Dock 当前仍为透明层的 L1 blur。

上述内容从 ChatGPT 插件 Skill 加载；本机 Mice Hole **仅负责修改工作树和实际运行测试**，本机目录不充当 ChatGPT 插件来源。

另参考官方：
- [Apple HIG / Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple HIG / Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views)
- [Apple HIG / Materials](https://developer.apple.com/design/human-interface-guidelines/materials)

## 改动前后：可量化结果

基准存档在 `E:/CHATGPT/work/xiaoya-ui-apple-audit-20261103/before/`；最新比对在 `.../after-final/`。两组均使用实际渲染的演示数据、相同的 320/390/768/1440px 测量程序。

| 390px 页面 | 原可见尺寸 <44px 的按钮数 | 调整后 | 原 <12px 的可见文字节点数 | 调整后 |
|---|---:|---:|---:|---:|
| 今天 | 13 | 0 | 14 | 0 |
| 事项 | 12 | 0 | 35 | 1（单个时间轴细节） |
| 发展 | 8 | 0 | 22 | 1 |
| 设置 | 5 | 0 | 0 | 0 |
| 320px 事项 | 19 | 0 | 35 | 2 |

**注意：** 计算方法是遍历可见 DOM 按钮的 bounding box 与文字 computed font-size；不是 iOS 原生物理点击区测量。所有相应视图无横向溢出，捕获过程中无 JS 页面异常。

## 完成的设计决策

1. **删掉装饰性英文**：YOUR DAY、TO DO、DEADLINES、TIMELINE、JOURNAL、LOOK BACK、REFLECTION、GROWTH 等及重复口号，保留具体中文内容与必要的隐私说明。
2. **触控命中区到位**：44px 命中区用于小图标、设置动作、勾选按钮、文本行和周切换。任务勾选图形仍为 22px，但实际可点框为 44px；按下只改变内部图形而不移动 hitbox。
3. **字体和栏目层级**：保留大标题及原小芽品牌，正文信息型辅助文字升至 12–13px；重点按钮及日程刻度提高可读性。
4. **事项日程优先定位**：用户打开有实际课程的某一天，时间轴在内层自动滚到第一项真实安排的前约 60 分钟；外层页面不跳动。
5. **发展空状态**：没有日记时不显示 0/—/0 的 KPI 大卡，最近的日子不再显示装饰性 `0 天 / 30 天`；保存日记后统计仍可按真实数据出现。
6. **设置减少失效项**：V4 没有右侧独立宠物面板，所以删除“隐藏小芽”开关；本地存储 schema 保持不变，头像随时可进入对话。
7. **小屏周视图**：320px 上每日期按钮仍≥44px，超出则允许横向滚动；Dock 保留 L1 渐变模糊并遵守 safe area。
8. **动画与被动输入**：原有聊天中断/恢复动画不重写，头像保留视觉形变，但命中区不随动画改变；遵守 `prefers-reduced-motion` 与透明度降级。

## 与 Apple 原生界面仍然不同的地方

- Apple 原生 Liquid Glass 包含系统材质、环境关联与真实光学效果；当前网页 Dock 为 L1 CSS blur。**未实施/未证明** L2 光学折射。
- iOS 原生大标题会跟随滚动收起，这个网页目前采用静态标题；保留是为了减少滚动跳动并兼顾浏览器顶部安全区。
- 手势退回、交互式 sheet detent、Safari 实机触控/键盘仍有差距。WebKit 模拟不算真机 Safari。
- React/Motion 新框架与 SVG L2 需要额外性能和 Safari 视觉证明，**未**仅为视觉特效引入。
- 用户对外观的人工验收独立于代码与截图测试；目前未收集到本人对本轮终稿的确认。

## 回归指令与保留证据

```powershell
node little-works/xiaoya-apple/native-v4/qa-v4-apple-polish.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-three-tab.cjs
node little-works/xiaoya-apple/native-v4/qa-dayflow-browser.cjs
node little-works/xiaoya-apple/native-v4/qa-v4-webkit.cjs
node tests/qa-native-v4-apple-ia.test.cjs
node tests/qa-version-pages.cjs
```

可验证：新专项 **13/13**、三栏交互 **13/13**、日程/聊天 **11/11**、WebKit **7/7**、版本归档 **8/8**、V3 回归保留。
