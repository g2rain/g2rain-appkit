# `@g2rain/runtime`

> 未发布工作包：后续直接重命名为 `@g2rain/platform`，请勿发布或作为正式依赖接入。

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

## 未发布的过渡状态

当前包从未发布，只是 Platform 实施前的代码基线，不应作为正式依赖接入或发布。后续将直接把目录和包名重命名为 `@g2rain/platform`，Runtime 仅保留为内部 Kernel 概念；不会发布 `@g2rain/runtime`，也不会提供兼容入口。Platform 将通过可选 Capability/Adapter 提供 I18n、Error、Theme、Loading、Permission、Message 等能力。详见 [Platform 统一应用平台方案](../../docs/architecture/platform-framework.md)。

## Docs

- [HTTP 与 Runtime 契约](../../docs/packages/http-runtime-contract.md)
- [Platform 统一应用平台方案](../../docs/architecture/platform-framework.md)
- [主题与微应用协作](../../docs/architecture/theme-and-micro-app.md)
- [Changelog](../../CHANGELOG.md)
