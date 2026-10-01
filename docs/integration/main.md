# Main Shell 接入

- 日期：2026-09-21（2026-09-23 基线依赖补充 `@g2rain/http`）
- 适用：`g2rain-main-shell`，以及新建主应用
- 入口：`@g2rain/platform/main` 的 `createMainPlatform`；HTTP 使用 `@g2rain/http`
- 规范（AI / 生成器）：中央 [Main Shell 契约](https://github.com/g2rain/g2rain/blob/main/docs/architecture/profiles/frontend-shell/main-shell-contract.md)
- 可复制提示词：[Main Shell AI Coding 提示词](main-shell-generation-prompt.md)

本文是**人工执行**的接入手册（安装、接线示例）。实现不变式、禁止模式、**docs 最小树**与完成检查以中央 Main Shell 契约为准，此处不重复。新建 Shell 时必须按中央 `frontend-shell` 规范产出完整 `docs/`，不能只接包不写文档。交给 AI Coding 助手时优先使用生成提示词，并以中央契约裁决冲突。

CLI 默认 / `app` 生成业务 App（包内 `template/`，源仓 `g2rain-app-template`）。`create-g2rain-app shell` 生成 Main Shell 基线（包内 `template-shell/`，源仓 `g2rain-shell-template`）。不得用业务 App 模板冒充 Shell。

`g2rain-main-shell` 当前还没有安装 `@g2rain/platform` / `@g2rain/http`。下面是现在可以照着接的用法。

## 1. 安装

Registry 安装尚未提供，待发版后补充。

Main Shell 基线需要 **platform + http**（壳管 Token 会话，请求栈走公共 HTTP）。`@g2rain/theme`、`@g2rain/ui` 本阶段不强制。

现在使用本地制品。在 `g2rain-appkit` 目录：

```bash
npm ci
npm run build --workspace @g2rain/http
npm run build --workspace @g2rain/platform
npm pack --workspace @g2rain/http
npm pack --workspace @g2rain/platform
```

得到 `g2rain-http-0.1.0.tgz`、`g2rain-platform-0.1.0.tgz`。拷到主应用 `kits/` 后安装：

```bash
npm install ./kits/g2rain-http-0.1.0.tgz ./kits/g2rain-platform-0.1.0.tgz
```

`package.json` 写成：

```json
{
  "dependencies": {
    "@g2rain/http": "file:kits/g2rain-http-0.1.0.tgz",
    "@g2rain/platform": "file:kits/g2rain-platform-0.1.0.tgz"
  }
}
```

版本号以打出来的文件名为准。HTTP 装配放在壳的 `runtime/http`：用 `@g2rain/http` 的工厂，注入壳的 Token Store / `ensureAccessToken` / SSO 失败处理；收敛或删除本地 `components/http`。细节见 [HTTP 与 Runtime 契约](../packages/http-runtime-contract.md)，可对照 `g2rain-member-app` 的 `src/runtime/http`。

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
