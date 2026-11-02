# 小芽 · 正式主仓库与版本切换说明

更新：2026-11-02

## 唯一比赛入口

- 正式 URL：`https://ndshuge.github.io/xiaoya-lifelab/?judge=1`（**保持不变**）。
- URL 属于原独立仓库 `https://github.com/ndshuge/xiaoya-lifelab`。
- 仓库根 `index.html` 现在**只在仓库内部跳转**到 `little-works/xiaoya-apple/native-v3/`。以前会跳到另一个仓库 `ndshuge-galaxy`；现在不再需要另一仓库参与网站运行。
- `judge=1` 会透传到 Native V3，按已有规则进入标明的合成演示数据；用户选择私人模式后仍按既有存储逻辑隔离。
- 2026-10-22–24 的参赛 ZIP 文件是提交时的**不可变历史源码快照**，与后来在线网站更新并不是同一个东西。在线升级不会悄悄修改已上传 ZIP。

## 同一 GitHub 仓库内的四个版本

| 版本 | 在线路径 | 说明 |
| --- | --- | --- |
| Apple Native V3（正式） | `/little-works/xiaoya-apple/native-v3/` | 当前评委可见版，使用 2026-11-02 的已验证 Apple 源码，包含已恢复的桌宠对话、可选真实模型连接、本地规则建议与成长规划 |
| 经典 LifeLab | `/original.html` | 旧版成熟功能及源码文件仍留在仓库根目录 |
| Apple 早期版 | `/little-works/xiaoya-apple/` | Apple 视觉迭代存档 |
| Pro · DAYLINE | `/pro/` | 独立试验预览，不代替评委正式版 |

访问 `/versions/` 可浏览全部版本；四个页面自身也提供左下角的「版本」切换控件。版本导航不读取、上传或修改个人记录。旧版与新版的数据结构相近，但切换版本前仍建议先导出备份。

## 源码来源与更新

- 正式仓库唯一发布来源：`ndshuge/xiaoya-lifelab`，GitHub Pages `main`。
- Apple 研发原仓库：`ndshuge/ndshuge-galaxy`。
- 当前同步源提交：`4091273a87e0a9d3039a24833604169085946d16`，已复制 76 个 **Git 已跟踪**源文件，未复制 screenshots、工作缓存或其他开发者的未提交文件。
- 详细元数据：`APPLE_SOURCE_PROVENANCE.json`。
- 同步脚本：`scripts/sync_apple_from_galaxy.py`。默认仅预览；`--apply` 会在正式仓库内部的 `little-works/xiaoya-apple/` 更新镜像，并自动重新注入版本切换脚本。若目标已有未提交的已跟踪源码改动，则拒绝覆盖。

更新范例（在独立工作树中）：

```powershell
python scripts/sync_apple_from_galaxy.py --source-repo E:/CHATGPT/projects/_xiaoya_v3_ios_zoom_20261029 --ref <已验证的完整Git提交哈希>
python scripts/sync_apple_from_galaxy.py --source-repo E:/CHATGPT/projects/_xiaoya_v3_ios_zoom_20261029 --ref <已验证的完整Git提交哈希> --apply
node tests/qa-version-bundle.test.cjs
node tests/qa-version-pages.cjs
node little-works/xiaoya-apple/native-v3/qa-judge-mode.cjs
node little-works/xiaoya-apple/native-v3/qa-assistant-restore.cjs
node little-works/xiaoya-apple/native-v3/qa-growth-restore.cjs
```

完成验收并审核改动后再合并发布 `main`。**不能通过更新 Galaxy 仓库自动改变正式主仓库：之后新的成熟功能需要主动同步、核验并发布。**

## AI 与数据边界

无自备 API Key 时，正式版的小芽对话属于基于本地数据与规则的解释性引导，页面明确标注其性质。真实 AI 连接仅在用户主动填写并测试自有凭据时生效，浏览器直连可能遭到服务商的 CORS 限制。评委演示数据与私人档案使用独立模式；升级不能自动上传任何私人档案或假称生成了真实学习成效。
