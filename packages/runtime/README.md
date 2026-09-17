# `@g2rain/runtime`

浏览器运行时原语：主题 Controller、Loading、权限 Provider、微应用消息 Event Adapter。不依赖 `@g2rain/http`。

## Install

```bash
npm install @g2rain/runtime
```

## Usage

```ts
import { createThemeController } from '@g2rain/runtime/theme'
import { createBrowserEventAdapter } from '@g2rain/runtime/micro-app'
import { createPermissionPlugin } from '@g2rain/runtime/permission'
import { createLoadingController } from '@g2rain/runtime/loading'

const theme = createThemeController()
const events = createBrowserEventAdapter()
app.use(createPermissionPlugin({ provider }))
```

公开子路径：`.`、`./theme`、`./micro-app`、`./permission`、`./loading`。

消息 Processor、Token 交换与 qiankun Props 读取仍由应用维护。

## Docs

- [HTTP 与 Runtime 契约](../../docs/packages/http-runtime-contract.md)
- [主题与微应用协作](../../docs/architecture/theme-and-micro-app.md)
- [Changelog](../../CHANGELOG.md)
