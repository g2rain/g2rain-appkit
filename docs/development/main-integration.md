# Main Shell 接入

- 日期：2026-09-21
- 适用：`g2rain-main-shell`，以及新建主应用
- 入口：`@g2rain/platform/main` 的 `createMainPlatform`

CLI 和 `g2rain-app-template` 只生成业务 App，不生成主应用。主应用继续使用自己的仓库。

`g2rain-main-shell` 当前还没有安装 `@g2rain/platform`。下面是现在可以照着接的用法。

## 1. 安装

Registry 安装尚未提供，待发版后补充。

现在使用本地制品。在 `g2rain-appkit` 目录：

```bash
npm ci
npm run build --workspace @g2rain/platform
npm pack --workspace @g2rain/platform
```

得到 `g2rain-platform-0.1.0.tgz`。拷到主应用后安装：

```bash
npm install ./kits/g2rain-platform-0.1.0.tgz
```

`package.json` 写成：

```json
{
  "dependencies": {
    "@g2rain/platform": "file:kits/g2rain-platform-0.1.0.tgz"
  }
}
```

版本号以打出来的文件名为准。只接主应用端口时，不需要安装 `@g2rain/theme`、`@g2rain/ui`、`@g2rain/http`。

## 2. 创建协调器

在主应用组合根创建一次。`runtimePort` 交给现有的 qiankun 更新和窗口消息，不要在这里再包一层 `loadMicroApp`。

```ts
import { createMainPlatform } from '@g2rain/platform/main'

const platform = createMainPlatform({
  runtimePort: {
    async updateInstanceProps(instanceId, props) {
      await qiankunAdapter.updateInstanceProps(instanceId, props)
    },
    emit(message) {
      eventAdapter.emit(message)
    },
  },
})
```

`updateInstanceProps` 必须等待 qiankun 的 `microApp.update()` 完成。

## 3. 打开实例

组装上下文后取出要传给子应用的公开 props，再交给现有的 `loadMicroApp`。Token、Token Kid、私钥不要放进 `buildPublicProps` 的参数或返回值。

```ts
const props = platform.buildPublicProps(
  {
    applicationCode,
    viewId,
    instanceId,
    mode: 'integrated',
    contextPath,
    locale,
    initialRoute,
  },
  { activeRule, entryOrigin },
)

await loadMicroApp({ name, entry, container, props })
```

返回的 props 含有 `applicationCode`、`viewId`、`instanceId`、`appKey`，以及这次传入的 `locale`、`initialRoute`、`activeRule`、`entryOrigin`。`appKey` 固定等于 `instanceId`。

同一个 `instanceId` 再次调用 `buildPublicProps` 会覆盖这份快照。

## 4. 更新、通知和关闭

语言或初始路由变化：

```ts
await platform.notifyLocale(instanceId, locale)
await platform.updatePublicContext(instanceId, { locale, initialRoute })
```

`patch` 里写成 `undefined` 的字段会从已下发 props 里删掉。端口调用成功后才会更新本地快照。还没调用过 `buildPublicProps` 就更新，会抛出 `runtime.main.missing-snapshot`。

登录失效：

```ts
await platform.notifyAuthInvalid(instanceId)
```

这会向该实例发送 `g2rain:sub-app:token-invalid`。其他消息：

```ts
await platform.emitToInstance(instanceId, type, data)
```

关闭该实例、登出或清空全部实例时，在 qiankun `unmount` 完成并删掉 handle 之后调用：

```ts
platform.releaseInstance(instanceId)
```

未 `releaseInstance` 的实例会一直留着上一份 props 快照。
