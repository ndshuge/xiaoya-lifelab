# Native V3 小芽对话功能恢复｜2026-11-02
目标：恢复已在旧成熟版存在的真实对话入口、用户主动选择的 BYOK 模型连接、无 Key 的本地可解释回应，保留所有已有任务/课表/目标/审批及 Demo 隔离。
基线：比赛链接 xiaoya-lifelab/?judge=1 → ndshuge-galaxy/little-works/xiaoya-apple/native-v3/；原版 ../index.html 具有 xiaoya-chat.js 与完整成长模拟器。
实现：在 native-v3 创建独立 assistant.mjs/assistant.css，不复制旧浮宠、自动弹层或旧 DOM 事件；注入到原生宠物及顶栏入口。通过回调读取当前 store，不额外建立数据层或写入 Key；API 只有明确授权、测试成功后连接，默认聊天不发送档案内容。
验收：新增 qa-assistant-restore.cjs 先 RED 后 GREEN；现有 qa-judge-mode.cjs、qa-contract.cjs、qa-deep.cjs、qa-ios-focus.cjs 等回归；保持 original.html 及独立 Pro 无改动；发布前抓取 origin/main 并检查是否有并行更新。
设计取舍：先恢复聊天/模型连接/本地建议与成熟成长规划入口，日记/情绪记录作为单独迭代，避免紧急修复中动数据 schema 和损坏个人档案。
