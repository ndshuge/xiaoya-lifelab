# 小芽 LifeLab V5.9｜双指缩放屏蔽及全站 QA

日期：2026-11-05。隔离工作树：`E:\CHATGPT\projects\_xiaoya_no_pinch_audit_20261105`
独立分支：`feature/xiaoya-ios-no-pinch-audit-20261105`
源头基线：`b0c8db28eed3c981c8a2b4249bea05062d247016`。

## 用户反馈与故障复现

用户在 iPhone Safari 中看到网页可以双指捏合放大，希望和原生 App 一样页面比例稳定，同时核对其他交互问题。因根工程 `viewport` 只指定 `width=device-width, initial-scale=1, viewport-fit=cover`，没有固定缩放意图；V5.8 的 `#workspace { touch-action:pan-y pinch-zoom }` 明确授权了浏览器接管双指手势；也没有 iOS Safari 的 `gesturestart/gesturechange` 非 passive 阻止处理，双指默认行为得以发生。

原样 TDD `qa-v59-pinch-guard.cjs`：**4/20**（每个浏览器宽度组合共 4 个缩放相关测试缺失，仅原导航功能正常），修复后 **20/20** Edge/WebKit × 320/390px。

## 修复（保留用户既定 UI）

1. `index.html`: viewport 指定 `maximum-scale=1,user-scalable=no`。注意 WebKit iOS 10+ 官方说明 Safari 可以为无障碍而忽略 viewport 的缩放限制；单靠 meta 不足。
2. `no-pinch.css`: `html,body,#workspace { touch-action:pan-y }`；将之前允许 `pinch-zoom` 的 touch-action 从最终覆盖样式里移除。桌面细指针输入不刻意阻止鼠标滚动。
3. `pinch-guard.mjs`: `gesturestart` / `gesturechange` 捕获层监听与 `touchstart` / `touchmove` 双指监听均 `passive:false`，只在可取消时调用 `preventDefault()`；单指触摸事件没有被取消。模块导出 `installPinchGuard` 与 cleanup。
4. `app.mjs` 入口导入守卫；`index.html` 缓存版本升为 5.9.0。无 Dock/角色/Agent 数据模型变化。
5. 旧 `qa-v4-ios-input-zoom.cjs` 原本断言必须保持浏览器缩放启用，与本次用户明确更改的行为冲突，已调整为检查本次 fixed-scale 约束，**保留所有输入框 16px 和 44px hit area 检查**。

## 验证

- 20/20：`qa-v59-pinch-guard.cjs`，Edge/WebKit × 320/390：viewport、touch-action、Safari gesture 取消、双指取消与单指保留、正常导航和助手打开/收起，无 JS 错误。
- 4/4：`qa-v59-native-multitouch.cjs`，Chromium CDP 真触控注入模拟双指向外拉伸，visualViewport.scale 保持 1；随后单指可以拖动两个完整页面，松手后从今天到事项。
- 16/16：`qa-v4-ios-input-zoom.cjs`，WebKit 320/390：设置、事项弹窗、搜索、助手及助手 API 配置所有可见文本输入字号至少 16px；助手按钮触控至少 44px、页面宽度不溢出。
- 额外全站回归：`qa-v4-keyboard-viewport.cjs` **7/7**、`qa-v4-theme-a11y.cjs` **41/41**（包含桌面 200% CSS 缩放近似）、`qa-v4-first-paint.cjs` **9/9**、`qa-live-drag-agent-disclosure.cjs` **14/14**、`qa-v57-spring-toggle.cjs` **14/14**、`qa-vnext-phase2.cjs` **18/18**、`qa-v4-dock-near-blur-press.cjs` **14/14**、`qa-v4-five-mood-sprites.cjs` **10/10**、`qa-agent-bridge.cjs` **20/20**，均已运行。
- **独立登记一项历史测试问题**：`qa-v4-no-ghost-duo.cjs` 在本修改分支为 **9/14**，我又在完全未改动的 V5.8 发布树独立重跑，仍然 **9/14**，故不是本次禁缩放的回归。失败集中在旧测试对心情按钮 press/选中时机和 WebKit 手记保存阴影的断言；不能把该套件记录为通过。相关真实功能由上列高清心情、Dock 等专用测试独立覆盖。
- 最终 Release QA 和线上部署状态必须根据实际远程返回另外复核；不能凭此文档认定已上线。

## 参考与无障碍边界

- Apple WebKit: `https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/` — Safari 忽略作者的部分 viewport 禁缩放设置以尊重用户放大偏好。
- Apple Safari: `https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html` — `gesturestart/gesturechange` 双指事件默认行为可取消。
- MDN: `https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action` — `touch-action:pan-y` 单指纵向滚动由浏览器管理，禁止触控页面捏合的默认行为。
- 此改动是用户明确请求的固定页面比例，**降低通过网页捏合放大文字的无障碍能力**，因此不应宣称 WCAG 1.4.4 或 pinch-zoom 无障碍完全符合。系统级辅助功能放大和 Safari 特定版本的行为可能优先于网页作者设置，**不能承诺屏蔽系统级缩放**。
- WebKit 自动化及 CDP 触摸模拟不是物理 iPhone Safari；仍需 iPhone 17 Pro Max 真实双指捏合、双击、软键盘和横滑手感验证。

## 发布纪律

只使用干净隔离工作树，安全 fetch 远程 main，遇并行更新拒绝冲突覆盖。测试成功后普通非强制 push；以真实 GitHub Pages 内容、Commit、Edge/WebKit 在线浏览器交互共同核验，不以 Git 操作成功冒充线上发布。
