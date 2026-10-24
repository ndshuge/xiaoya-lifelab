<div align="center">

<img src="assets/brand/xiaoya_hero_v1.webp" width="170" alt="小芽形象"/>

# 小芽 LifeLab
### 大学生活，不只有一张课表。

**大学生时间管理 · 兴趣成长 · 可审核的 AI 建议**

[![Live](https://img.shields.io/badge/GitHub_Pages-在线体验-2B8951?logo=githubpages&logoColor=white)](https://ndshuge.github.io/xiaoya-lifelab/?judge=1)
[![Demo](https://img.shields.io/badge/匿名演示-无需密钥-77B26A)](https://ndshuge.github.io/xiaoya-lifelab/?judge=1)
[![Source](https://img.shields.io/badge/JavaScript-Source-295E45?logo=javascript&logoColor=white)](app.js)

**[立即体验小芽 →](https://ndshuge.github.io/xiaoya-lifelab/?judge=1)** · [日常首页](https://ndshuge.github.io/xiaoya-lifelab/) · [模型实验室](model-lab.html) · [设计说明](DESIGN.md)

</div>

## 竞赛公开材料

**[观看或下载最新完整演示视频（V5 · 233 秒 · 1080p60）](https://github.com/ndshuge/xiaoya-lifelab/releases/tag/showcase-20261024)** · [下载最新作品介绍 PDF](https://github.com/ndshuge/xiaoya-lifelab/releases/tag/showcase-20261024)

以下为此前同步到源码仓库的参赛材料存档：

- [仓库存档版作品介绍 PDF（18 页）](competition-materials/Xiaoya_LifeLab_18P_QR.pdf)
- [材料清单、SHA-256 与验证结果](competition-materials/README.md)
- [公开证据摘要](competition-materials/evidence/PUBLIC_EVIDENCE.md)

---

## 今天的安排，与未来的想法

面对课表、作业、考试、社团和想坚持的兴趣，小芽希望帮你把分散事项组织起来，又不替你做决定。

| 今天要做什么 | 想成长为什么 | 智能建议怎么用 |
|---|---|---|
| 课程、任务、截止提醒 | 长期兴趣目标与阶段路线 | 解释冲突、提供下一步建议 |
| 清楚地看到时间和状态 | 留下成长复盘记录 | 先预览，后由本人批准 |

## 在线体验

**[打开匿名演示版](https://ndshuge.github.io/xiaoya-lifelab/?judge=1)** — 手机或电脑均可访问。无需注册、无需 API Key，即可体验课程、任务、成长与桌宠交互。

可选 AI 功能需要用户主动配置模型和密钥；GitHub Pages 受服务商 CORS 和浏览器限制，本机 Node 代理、Qwen 服务和后台推送**并未部署在公开网页**。

## 交互逻辑

**真实事项 → 时间/约束判断 → 规则或可选模型建议 → 用户审核 → 写入行动 → 复盘**

- **今天与课表**：按实际课程、活动和任务安排组织视图。
- **兴趣与成长**：把“我想学会”拆成阶段、里程碑与可执行行动。
- **小芽桌宠**：统一入口、表情状态、轻量提醒。
- **人类最终决定**：建议不自动成为必须执行的任务。

## 仓库结构

| 入口 | 内容 |
|---|---|
| [index.html](index.html) / [styles.css](styles.css) | 产品网页 |
| [app.js](app.js) / [domain.js](domain.js) | 应用及时间管理规则 |
| [agent-engine.js](agent-engine.js) | 建议逻辑 |
| [byok-ui.js](byok-ui.js) | 模型连接配置 |
| [model-lab.html](model-lab.html) | 可操作的合成测试场景 |
| [assets/brand/](assets/brand/) | 小芽原创角色 |

## 数据与 API Key 安全说明

**默认不需要密钥。** 使用者主动勾选“记住此浏览器”并测试成功后，服务商、模型及 Key 可能保存到站点 localStorage，**没有额外加密**。请勿在公用设备保存，并在需要时使用清除已保存密钥功能。

真实 DeepSeek 基础聊天已实测；完整长期云端规划、人工批准到任务读回的闭环仍需要最后的实机验收。合成演示不是实际用户成长效果。

---

<div align="center"><sub>小芽 LifeLab · 帮想做的事，在时间里留一个位置。</sub></div>
