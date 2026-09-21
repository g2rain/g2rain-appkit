# `@g2rain/platform`

G2rain 前端应用运行与主子协作 SDK。包根只导出共享契约；`/sub` 提供框架无关的 Definition、Scope 与生命周期。Vue、Pinia、Router 和 qiankun 继续由应用拥有。

尚未发布，也不提供旧包名兼容入口。

## Install

```bash
npm install @g2rain/platform
```

## Usage

```ts
import type { RuntimeContext } from '@g2rain/platform'
import { createMainPlatform } from '@g2rain/platform/main'
import { createSubPlatform, resolveSubHostProps } from '@g2rain/platform/sub'
import { createThemeController } from '@g2rain/platform/theme'
import { createBrowserEventAdapter } from '@g2rain/platform/micro-app'
import { createPermissionPlugin } from '@g2rain/platform/permission/vue'
import { createLoadingController } from '@g2rain/platform/loading'

const platform = createSubPlatform({
  applicationCode: 'member',
  createApplication(_context: RuntimeContext) {
    return {
      mount() {},
      unmount() {},
    }
  },
})

const resolved = resolveSubHostProps(props, {
  applicationCode: 'member',
  contextPath: '/member',
})

await platform.mount({
  instanceId: resolved.instanceId,
  context: resolved.context,
  container,
})
```

公开子路径：`.`、`./sub`、`./main`、`./theme`、`./micro-app`、`./permission`、`./permission/vue`、`./loading`、`./i18n`、`./i18n/vue-i18n`、`./error`、`./http`。

包根不导入 Vue。`./main`、`./sub`、`./permission`、`./i18n`、`./error` 和 `./http` 也不导入 Vue，且不导入 `@g2rain/http`。Vue 插件在 `./permission/vue`，`vue` 与 `vue-i18n` 都是可选 peer。`createSubPlatform` 只接受 `capabilities` 数组。`createStandardSubPlatform` 强制组合 I18n 和 Error。`resolveSubHostProps` 把现行壳和新壳 props 解析成同一份 Context；Token 只出现在现行壳的 `auth` 里，由应用 Auth Bridge 瞬时消费。`createMainPlatform` 提供公开 props、语言通知、认证失效通知和 `releaseInstance`。HTTP Binding 在一份 Definition 内共享 locale。壳与 Member 都尚未接入。

qiankun 生命周期、消息发送和 Token 交换仍由应用维护。

## Docs

- [Platform 前端应用运行与主子协作方案](../../docs/architecture/platform-framework.md)
- [Main Shell 接入](../../docs/development/main-integration.md)
- [业务 App 接入](../../docs/development/app-integration.md)
- [HTTP 与 Runtime 契约](../../docs/packages/http-runtime-contract.md)
- [Changelog](../../CHANGELOG.md)
