# Aimo Music

**当前版本：0.1.2** · [更新日志](CHANGELOG.md) · [音乐项目设计映射](MUSIC_SCOPE.md)

AimoChat 视觉规范下的纯前端网页音乐播放器。无账号、无独立数据库，支持网易云兼容 API 搜索与播放，也能导入自己拥有的本地音频文件。用户收藏、历史与队列保存在当前浏览器，本地文件存放在 IndexedDB。

## 已实现

0.1.2 稳定性修复：大歌单分批补齐曲目、修复手动切歌与随机播放历史、播放成功后才计入最近记录，补齐异常处理与弹层键盘交互。

0.1.1 优化交互：固定顶栏与滚动条隐藏、统一紧凑型可拖动 Segmented Control、无重建音乐库切换、弹窗进入和退出动画、固定弹窗底部操作区，并修正右上角设置图标。

- 歌曲 / 歌单搜索、发现歌单、歌单详情；按需查询 `/song/url/v1` 并在接口失败或未返回播放地址时尝试 `/song/url`。
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
npm run check
npm run build
```

`npm run check` 使用 Node.js 内置测试器并检查脚本语法，无需外部测试依赖；`npm run build` 需要 Vite。提交后 GitHub Actions 会安装依赖、执行测试并检查生产构建。静态部署上传 `client/dist` 内容，支持网站根路径与子路径（相对资源 URL）。站点使用 HTTPS。

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
  src/core/queue.js       播放顺序、洗牌历史与最近播放
  src/core/storage.js     localStorage + IndexedDB
  src/ui/controls.js      单一 N 段式滑块、连续几何反色
  src/ui/render.js        页面模板与安全文本渲染
  src/ui/dialog.js        桌面 Modal / 手机 Bottom Sheet
  src/styles/             设计 Token、视图、导航、播放器、响应式
  vite.config.js          开发期代理、相对路径打包
AGENTS.md                 项目规则
DESIGN_SYSTEM.md          AimoChat 原始现行设计真源
MUSIC_SCOPE.md            音乐业务适用条款映射
docs/reference/           用户原始参考文档，不进入页面资源
docs/qa/                  修复验收记录与待验证事项
.github/workflows/        GitHub Actions 质量检查
```

无需 Vue、React 或第三方状态管理；这是有意沿用 AimoChat 当前的 Vite + 原生 JS 模块化方案，避免在只做纯前端的首版引入没有直接收益的技术复杂度。

## 播放行为说明（0.1.2）

- **手动下一首**无论是否开启单曲循环，都尝试前进；**自然播放结束**时单曲循环才重播本曲。
- 随机模式采用一轮不重复的播放顺序，上一首返回实际播放历史。列表循环开启时，随机顺序用完会重新洗牌。
- 歌单按服务端 `trackIds` 补齐歌曲明细；服务端无法提供的信息会造成展示数量低于原始歌单总数，此时页面显示已加载数与标称总数。
- 最近播放只在音频实际开始播放后写入，不把没有地址或播放被阻止的歌曲当作播放成功。
- 原本的本地文件通过 IndexedDB v2 自动迁移：文件 Blob 仍保留在文件表，歌曲元数据在独立表查询。

## 验证限制

目前仓库没有锁文件；开发环境无 npm Registry 缓存时不能离线完成 Vite 构建。GitHub Actions 使用在线安装构建，后续应由可连接 npm Registry 的环境生成、提交 `client/package-lock.json` 并将 CI 切换为 `npm ci`。在线音乐 API、移动端触控和浏览器焦点仍需要在实际运行环境验证，详见 [质量记录](docs/qa/0.1.2.md)。
