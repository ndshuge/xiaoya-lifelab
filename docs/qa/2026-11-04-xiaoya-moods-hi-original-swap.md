# 小芽 Native V4｜五张高清心情图原件替换（2026-11-04）

## 用户确认与真实来源

用户明确要求直接使用本对话先前生成的五张高清小芽，不再截取低清预览图。这五张原图已在 ChatGPT 对话文件中定位为同日生成的五份 `image-gen-(1..5)(20261104-1031xx).png`，**每张 1254×1254，约 1.5–1.6 MB**。图像人物与动作检查后，正确映射为：

| 心情数值 | 文案 | 原高清图 | 新网页文件 |
| --- | --- | --- | --- |
| 1 | 很低落 | image-gen-5.png | assets/xiaoya-mood-1-hi-v2.webp |
| 2 | 有点累 | image-gen-4.png | assets/xiaoya-mood-2-hi.webp |
| 3 | 平稳 | image-gen-3.png | assets/xiaoya-mood-3-hi.webp |
| 4 | 不错 | image-gen-2.png | assets/xiaoya-mood-4-hi.webp |
| 5 | 很好 | image-gen-1.png | assets/xiaoya-mood-5-hi.webp |

此前在线 `xiaoya-moods-v1.webp` 是整张 500×80、每格约100×80 的截取预览，不能承载高像素密度 iPhone 展示。此次从**五份原始 1254×1254 PNG** 分别制作原画色彩一致的**透明背景 512×512 WebP**，每张约 19–23KB；其中低落版透明边缘经二次修正。未把旧 500×80 图放大，也未要求重新生成角色。

## 代码变更

- 仅 Native V4：新增 `five-mood-hi-assets.css`，在旧 `five-mood-illustrations.css` 之后载入。原 `.v4-mood-art-1..5` 五个装饰元素分别引用独立图像，不再运行时请求低清 atlas。图片 `background-size:contain`，保留心情标签和唯一选中底板。
- 控件仍是五档 `data-mood=1..5`，保持原日记草稿保存机制、原 ARIA 状态、无多邻国 3D group 缩放；320px 小屏触控区不小于 44px。
- 旧低清 atlas 暂保留作历史兼容与可回退资产，不再在 V4 计算样式中使用。
- 同步更新 `qa-v4-five-mood-sprites.cjs`，测试五张独立 512×512 是否分别加载、五档映射、320px 溢出、选中与“未保存”及 Edge/WebKit 错误。
- 对旧 `qa-v4-duo-progressive.cjs` 的 shadow 还原断言由单帧固定 260ms 采样改为在 1300ms 内等待实际按压释放和恢复；当全站 3 进程并发时旧测试会采到尚未恢复的阴影（孤立重跑 10/10 PASS），此变更不跳过最终状态检查。

## 验收边界与发布

- 专项：Edge/WebKit 五种高清图 **10/10 PASS**，含 320px；独立回归 Dock 恢复阴影 **10/10 PASS**。
- 实际 Edge 390×844 浅/深色发展页截图：`E:/CHATGPT/work/xiaoya-v4-five-moods-visual-20261104/light-develop.png` 和 `dark-develop.png` 已目视检查五种表情与边缘。
- 完整矩阵：`E:/CHATGPT/work/xiaoya-v4-five-moods-parallel-20261104.{json,log}`，以发布前最后一次 exit 0 为准。
- 真实 iPhone Safari 视觉仍需用户重新打开后判断。不可把 Edge 和 Playwright WebKit 说成实际 iPhone 真机验收。
