# Aimo Music

**当前版本：0.1.1** · [更新日志](CHANGELOG.md) · [音乐项目设计映射](MUSIC_SCOPE.md)

AimoChat 视觉规范下的纯前端网页音乐播放器。无账号、无独立数据库，支持网易云兼容 API 搜索与播放，也能导入自己拥有的本地音频文件。用户收藏、历史与队列保存在当前浏览器，本地文件存放在 IndexedDB。

## 已实现

0.1.1 优化交互：固定顶栏与滚动条隐藏、统一紧凑型可拖动 Segmented Control、无重建音乐库切换、弹窗进入和退出动画、固定弹窗底部操作区，并修正右上角设置图标。

- 歌曲 / 歌单搜索、发现歌单、歌单详情；按需查询 `/song/url/v1` 并在接口失败时尝试 `/song/url`。
- HTMLAudioElement 播放、进度与音量、上一首 / 下一首、随机 / 列表循环 / 单曲循环、队列管理、Media Session 系统播放控制。
- LRC 时间轴与翻译歌词，点击歌词跳转、手动滚动时暂缓自动跟随。
- 浏览器端收藏、最近播放、本地音频导入与恢复；外部图片 URL 严格限制 HTTP(S)。
- 纸白 / 暖黑双主题、移动端迷你播放器与完整播放页、歌单搜索骨架、错误重试。

## 本地开发

需要 Node.js 20.19+ 或 22.12+。在本目录执行：

```bash
npm install --prefix client
npm run dev
```

打开 `http://localhost:3200`。开发模式默认经 Vite 把 `/music-api/` 转发到 `https://music.20110208.xyz/`；不需要单独开发一个后端。

不装 Vite 时也可以进入 `client/` 用任意静态 HTTP Server 提供目录，例如 `python3 -m http.server 3200`；这时采用浏览器直连 API，必须满足目标服务的 CORS 策略。不要直接双击打开 `file://`，ES modules 可能被浏览器禁止。

## 测试与构建

```bash
npm test
npm run build
```

`npm test` 使用 Node.js 内置测试器，无需依赖；`npm run build` 需要先安装前端 Vite。静态部署上传 `client/dist` 内容。站点使用 HTTPS。

## 仅前端部署的边界

默认线上使用浏览器直连 `https://music.20110208.xyz`。浏览器的 CORS、目标域名可用性、音频 CDN 的播放限制必须由真实部署环境验证。本会话的执行环境无法解析该域名，因此尚未完成在线端到端播放验证。

如果 API 不允许跨域：

1. 最简单的办法是让 API 服务端放行你的前端域名；
2. 或让你的静态托管 / Nginx 将 `/music-api/` 转发到目标 API，再在页面「设置 → 连接方式」选择本站代理。

普通静态文件**不能自行消除 CORS 限制**。任何需要服务端保存的 API Key、Cookie 或用户级鉴权都不能直接加入浏览器代码。`/song/url/v1` 仅对实际可访问的授权资源播放，客户端不会伪造会员身份或绕过版权限制。歌曲封面和音频来自第三方服务器，会向对应服务发送正常网络请求。

## 项目结构

```text
client/
  index.html              纯前端入口
  src/main.js             界面控制器、播放状态及用户交互
  src/api/music.js        API 适配 / 数据规范化 / URL 安全
  src/core/lyrics.js      LRC 解析与时间轴
  src/core/queue.js       播放顺序与最近播放
  src/core/storage.js     localStorage + IndexedDB
  src/ui/controls.js      单一 N 段式滑块、连续几何反色
  src/ui/render.js        页面模板与安全文本渲染
  src/ui/dialog.js        桌面 Modal / 手机 Bottom Sheet
  src/styles/             设计 Token、视图、导航、播放器、响应式
  vite.config.js          开发期代理与打包
AGENTS.md                 项目规则
DESIGN_SYSTEM.md          AimoChat 原始现行设计真源
MUSIC_SCOPE.md            音乐业务适用条款映射
docs/reference/           用户原始参考文档，不进入页面资源
```

无需 Vue、React 或第三方状态管理；这是有意沿用 AimoChat 当前的 Vite + 原生 JS 模块化方案，避免在只做纯前端的首版引入没有直接收益的技术复杂度。
