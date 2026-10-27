# @g2rain/platform

前端应用运行与主子协作 SDK。Kernel 管理实例与 Capability 生命周期；Vue、Pinia、Router、qiankun 和会话由应用持有并通过接口接入。

## 安装和入口

```bash
npm install @g2rain/platform
```

包为 ESM。Vue 与 Vue I18n 为可选 peer，仅使用对应入口时安装 `vue ^3.5.0` 和 `vue-i18n ^11.4.4`。

| 入口后缀 | 主要能力 |
| --- | --- |
| 包根 | `PlatformError`、运行上下文和消息类型 |
| `/sub` | `createSubPlatform`、`createStandardSubPlatform`、`resolveSubHostProps`、`createSubDirectedMessage` |
| `/main` | `createMainPlatform` |
| `/theme` | `createThemeController`、`createThemeCapability` |
| `/micro-app` | `createBrowserEventAdapter`、`createMessageCapability`、消息类型 |
| `/permission` | `createPermissionCapability`、`isPageElementEnabled`、`isPageElementVisible`、`resolveApiPath`、Provider 类型 |
| `/permission/vue` | `createPermissionPlugin`、`createPermissionDirective`、`G2rainPermission`、`usePermission` |
| `/loading` | `createLoadingController`、`createLoadingCapability` |
| `/i18n` | `createI18nCapability`、引擎与 UI locale Adapter 类型 |
| `/i18n/vue-i18n` | Vue I18n Adapter |
| `/error` | 错误标准化和 `createErrorCapability` |
| `/http` | `createHttpCapability`、HTTP Adapter/Binding 类型 |

根入口和 Kernel 不导入 Vue。HTTP Binding 不依赖 `@g2rain/http`，由应用选择并装配 HTTP 实现。

## 子应用生命周期

以下 `createApplication` 由应用提供，返回包含 `mount(container)`、`unmount()` 及可选 `update(context)` 的应用句柄；`container` 为实际 HTMLElement：

```ts
import { createSubPlatform } from '@g2rain/platform/sub'

const platform = createSubPlatform({
  applicationCode: 'example',
  createApplication,
  capabilities: [],
})

await platform.mount({
  instanceId: 'example:page1',
  context: {
    applicationCode: 'example',
    viewId: 'page1',
    instanceId: 'example:page1',
    mode: 'standalone',
    contextPath: '/example',
    locale: 'zh-CN',
  },
  container,
})
await platform.update('example:page1', { locale: 'en-US' })
await platform.unmount('example:page1')
await platform.dispose()
```

首次 mount 自动执行 bootstrap，也可提前调用 `bootstrap()`。同一实例不能重复挂载。更新字段为 locale、theme、initialRoute、metadata；身份字段不随更新改变。Capability 按依赖顺序初始化，卸载和 dispose 逆序执行。失败按已执行阶段清理或回滚；更新进行中时卸载等待更新完成。应用自行实现 Router 导航，Kernel 不自动消费 initialRoute。

`createStandardSubPlatform` 在基础配置上要求 `i18n: { engine, uiLocale? }` 和 `error`，先装配 I18n、Error，再追加其他 Capability，并提供 `handleError(error)`。

实例 Scope 登记实例资源，Definition Scope 登记共享资源。只关闭一个实例时调用 unmount；整个 SDK 不再使用时才 dispose。HTTP Binding 在同一 Definition 内共享，locale 由后一次应用的值决定，单实例卸载不释放 Binding。

## 主壳协作

```ts
import { createMainPlatform } from '@g2rain/platform/main'

// runtimePort 由主壳实现 updateInstanceProps(instanceId, props) 和 emit(message)
const main = createMainPlatform({ runtimePort })
const props = main.buildPublicProps(context, { activeRule: '/example' })
// 将 props 交给主壳实际的实例挂载逻辑
await main.notifyLocale(context.instanceId, 'en-US')
await main.notifyAuthInvalid(context.instanceId, { code: 'SESSION_EXPIRED' })
main.releaseInstance(context.instanceId)
```

必须先用 `buildPublicProps` 建立快照。`initialRoute` 只在首次构建 props 或显式更新导航时下发，不保存在后续快照；更新端口成功后才提交新快照。`notifyAuthInvalid` 发出 `g2rain:main-app:token-error`。`releaseInstance` 只清理协调器快照，实际实例销毁由主壳执行。

子应用用 `resolveSubHostProps(props, { applicationCode, contextPath })` 解析集成 props；要求显式 applicationCode/viewId/instanceId/appKey，应用编码必须匹配且 appKey 等于 instanceId。结果包含 context、patch、host。Token 不进入 props 或上下文，认证由应用 Auth Bridge 完成。

`createSubDirectedMessage(identity, type, data)` 和 Main 的定向方法补齐实例身份及 timestamp。浏览器 Adapter 自己发出的消息不回投自己的订阅者；消息 Capability 的实例订阅只接收目标 instanceId 或 appKey 匹配的消息。默认事件包括请求 Token、Token 响应/错误、Token 失效、路由变化和主题变化；主题事件是可用消息类型，Main 不自动广播主题。

## 权限、语言与错误

权限 Provider 提供页面元素存在性、状态和 API 权限判断。`createPermissionPlugin({ provider })` 注册 `v-permission` 和注入 Provider；缺失 Provider 时全部拒绝。元素无状态时隐藏，VISIBLE 显示但禁用，ENABLED 可操作。UI 的 StatusSwitch 使用 UI Provider 的 `permission.isEnabled`，应用需显式连接同一权限源。

I18n Capability 先加载文案，再切换引擎 locale，最后同步 UI locale。Vue I18n Adapter 位于独立入口。Error Capability 将错误规范化为 PlatformError，并按注入的 policy、presenter、reporter、actions 和 translate 处理；不自动绑定应用弹窗或登录跳转。

## Loading 与主题

Loading Controller 引用计数，`begin()` 返回可重复调用的结束函数；默认延迟显示 `200ms`、最短显示 `300ms`。Loading Capability 内所有实例共用计数，实例 Scope 释放时结束该实例尚未完成的 Loading。

Theme Controller 读写指定 root 的 data-g2-theme；初始主题按根已有值、initialTheme、light 的顺序决定。支持 subscribe 和 persist 回调；相同主题不重复通知，单个监听器或持久化失败不阻断其他监听器。dispose 清理订阅，保留根属性。Theme Capability 只在 standalone 模式应用 context.theme，集成主题由主壳管理。

## 参考

- [根使用手册](../../README.md)
- [Main 接入](../../docs/integration/main.md)与[Sub 接入](../../docs/integration/app.md)
- [生命周期类型](src/sub/types.ts)与[上下文类型](src/contract/context.ts)
