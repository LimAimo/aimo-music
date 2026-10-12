# 音乐 API 管理与自定义适配规则（0.2.0）

## 基本使用

打开播放器右上角设置 → **管理音乐 API**。每个接口可独立修改名称、基础地址、适配类型、资源命名空间、启用状态，支持搜索测试、优先级排序、删除与配置导入/导出。配置写入当前浏览器的 `localStorage`，不会同步给其他设备。最多保存 20 个接口；至少保留 1 个已启用接口。

有三种切换策略：

- **智能**：搜索从首选 API 开始，发生网络连接问题、HTTP 404/408/410/425/429/5xx 或响应格式故障时，尝试下一个可用的兼容接口。
- **手动**：只使用所选首选 API；播放收藏过的其他来源歌曲时，会尽量按记录的来源处理，不跨平台猜测 ID。
- **优先级**：按列表顺序处理新搜索，主服务不可用时继续按顺序尝试。可在列表中上移、下移调整顺序。

请注意：空搜索结果、HTTP 401/403、付费或无可用播放地址不应触发绕过权限的请求。**自动切换只有在存在其他真实可用服务时才有帮助。** 同一域名的两套路径并不能消除域名或网络整体不可用的风险。

## CurrentStation 与新版文档

用户提供的 CurrentStation 接口目录：

- `GET https://music.20110208.xyz/cm/health` — 公共健康检查。
- `GET https://music.20110208.xyz/cm/bootstrap` — 首屏聚合数据，可选登录。
- `GET https://music.20110208.xyz/cm/ncm/search` — 网易云搜索代理。
- `GET https://music.20110208.xyz/cm/ncm/{path}` — 网易云侧代理路径，具体路径须经上游登记。
- `/cm/auth/*`、`/cm/passport/*` 为账户和授权功能，**不属于无登录音乐浏览的必要功能**；不会在网页端模拟管理员权限或读取用户凭据。

设置 → API 管理 → **添加 CurrentStation 代理预设** 将填入 `https://music.20110208.xyz/cm/ncm`，使用网易云兼容协议，命名空间 `netease`。这是依据用户提供的目录推出的前缀路径，**不是已验证兼容所有旧版接口的承诺**。

2026-10-12 在当前执行环境中，站点无法访问，尚未拿到 `/cm/ncm/search` 和 `/cm/ncm/song/url/v1` 等端点的真实请求参数、响应 JSON、HTTP 状态、CORS 头；因此没有擅自替换老的默认 URL，也没有开启未经验证的预设。建议实际测试这两个接口及目标歌曲的播放地址。

## 自定义接口（无代码 JSON 规则）

选择“自定义 JSON 映射规则”，配置完整 HTTPS 基址，填写请求路径和响应 JSON 字段路径。自定义配置是**声明式适配**，不会解析或执行 JS。公开端点支持：`GET` / `POST`（JSON 请求体）、固定请求头、查询参数，以及 `{{keywords}}`、`{{id}}`、`{{quality}}`、`{{limit}}` 模板变量。请求路径相对于基础 URL，不能是跨域 URL 或 `../` 跳转。

`maps.track` 的 `id` 和 `title` 必填。路径例如 `result.songs`、`songs.0.name` 或 `artists[].name`。`durationUnit` 只接受 `ms`（毫秒）和 `s`（秒）。例如以下最简公开服务可能使用不同的实际字段，你需要按真实 API 响应调整：

```json
{
  "response": {"codePath":"code", "okCodes":[200]},
  "maps": {
    "track": {"id":"id", "title":"name", "artist":"artists[].name", "album":"album.name", "cover":"album.picUrl", "duration":"duration", "durationUnit":"ms"},
    "playlist": {"id":"id", "title":"name", "cover":"coverImgUrl", "count":"trackCount"}
  },
  "endpoints": {
    "searchSongs": {"path":"search", "query":{"keywords":"{{keywords}}", "limit":"{{limit}}"}, "items":"result.songs"},
    "audioUrl": {"path":"song/url", "query":{"id":"{{id}}"}, "url":"data.0.url"},
    "lyrics": {"path":"lyric", "query":{"id":"{{id}}"}, "original":"lrc.lyric", "translation":"tlyric.lyric"}
  }
}
```

支持的操作名称为 `searchSongs`、`searchPlaylists`、`discoverPlaylists`、`playlistDetail`、`lyrics`、`audioUrl`，至少配置前者中的 `searchSongs` 和 `audioUrl`。未配置的可选功能可能无法工作，如果同命名空间有其他兼容接口可尝试降级。**搜索测试只能验证请求通路与结构，不能证明每一首歌曲可播放。**

## 资源命名空间与安全

不同音乐平台常用相同的数字歌曲 ID。为了避免错播，播放、歌词和歌单会记录来源 `providerId`、`providerNamespace`。只有命名空间一致，才允许同一资源 ID 跨 API 解析；此设置表示你确认不同服务使用相同歌曲 ID 体系（如同一平台的两个镜像）。如果不确定，就使用不同的命名空间。旧版网易云收藏默认使用 `netease` 命名空间兼容迁移。

不允许在浏览器设置中填写 Bearer/Cookie/Authorization 等秘密凭据，也不支持需要保密密钥的服务直连。若要支持这类接口，应由自建可信后端保管密钥，前端只访问鉴权后授权的代理；不要把服务端 API Key 放在仓库、静态 JS 或导出的 JSON 配置里。浏览器直连仍受目标服务的 CORS、授权与音源可用性约束。仅仅更换接口地址不能突破这些限制。

### 导入和备份

在管理页展开“导入或导出 API 配置”，导出 JSON。导入文件需要 `format: "aimomusic-api-profiles"`、`version: 1` 和 `profiles` 数组，会先做格式、安全性和 ID 唯一性检查，通过确认对话框后替换原列表。原收藏、播放历史、设备本地音频不受影响；导入和删除 API 仍可能让部分旧歌曲因失去对应服务而不能播放。

## 开发者注意

- `client/src/api/music.js`：旧版网易云兼容客户端，单个基址与搜索/歌词/播放 URL 逻辑不变。
- `client/src/api/providers.js`：新配置验证、字段路径映射、CurrentStation 预设、故障转移、来源归属。
- `client/src/core/storage.js`：无损迁移旧版 `apiBase`，保存服务列表、主服务及切换策略。
- `client/src/ui/render.js` 和 `client/src/main.js`：设置、API 管理、编辑及事件处理。
- `tests/providers.test.mjs`：网络故障、协议映射、同 ID 隔离、导入校验等回归测试。

健康测试原则：功能检测尽量调用只读公开接口，**不主动登录、调用管理员接口、提交个人身份信息或绕开上游访问限制**。后续若获得完整的路径参数、响应 JSON 和错误码文档，可以为 CurrentStation 做专用适配器与独立健康检查。
