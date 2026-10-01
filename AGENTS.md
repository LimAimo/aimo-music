# Aimo Music 工程规则

本项目沿用 `docs/reference/AimoChat_AGENTS.md` 中适用于前端项目的编码、版本、设计、交互、文案、安全与源码交付规则。现行视觉真源为根目录 `DESIGN_SYSTEM.md`；`DESIGN_REFRESH.md` 仅用于了解改版历史。AimoChat 独有的 AI、角色、账号、后台及 Android 条款不适用于本项目。

- 开始 UI 工作之前读 `DESIGN_SYSTEM.md`；新增视觉语义优先修改 `client/src/styles/base.css`；页面 CSS 按职责分文件。
- 任何用户输入和第三方 API 文本安全转义；外部图片只加载 HTTP(S) URL；绝不把第三方 API 密钥放到前端。
- 移动端 ≤860px 重新编排而非缩放桌面布局；触摸目标约 44px；菜单、播放器、歌词与队列需具备 loading/empty/error 等状态。
- 输入框聚焦只改变描边；操作色仅用于可交互元素；所有动效支持 `prefers-reduced-motion`。
- 桌面居中模态框、移动端底部抽屉；禁用浏览器原生 `alert`、`confirm`。导航等 N 段式组件统一通过 `client/src/ui/controls.js` 创建。
- 变更通过测试后本地提交（若存在 Git 仓库），未授权不得推送；提交格式 `类型(范围): 中文概要`。
- 每次版本变化同步根与 `client/package.json`、`README.md` 和 `CHANGELOG.md`；使用 SemVer，应用界面不显示版本号。
- 默认源码包只包含源码、配置示例、测试和必要文档，不包含 dist / node_modules / 缓存 / 预览图片。
