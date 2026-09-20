# 包设计

| 包 | 核心职责 | 禁止包含 |
| --- | --- | --- |
| `@g2rain/theme` | 设计变量、亮暗主题、基础样式、Element Plus 变量映射 | Vue、Pinia、业务 API、qiankun |
| `@g2rain/ui` | 通用 Vue 组件和组合式函数 | 应用 Store、路由、领域接口 |
| `@g2rain/http` | HTTP Client、序列化、签名、错误模型和通用拦截器 | 环境变量、具体 Token Store、登录跳转 |
| `@g2rain/platform` | 共享契约、Sub 生命周期、权限、Loading、主题切换、微应用通信协议 | 业务页面、具体领域 API、Main Shell Store |

## 1. `@g2rain/theme`

主题包是纯样式基础设施。变量分为基础尺度、用途语义、UI 框架映射和必要的组件级变量。变量名表达用途，不表达某个主题下的具体颜色。

建议结构：

```text
packages/theme/src/
├─ styles.css
├─ tokens.css
├─ base.css
├─ element-plus.css
└─ themes/
   ├─ light.css
   └─ dark.css
```

`styles.css` 是默认入口并同时包含亮色和暗色选择器。CSS 通过明确的子路径导出，并声明 `sideEffects: ["**/*.css"]`。主题包不提供修改 DOM 的 JavaScript 入口。

## 2. `@g2rain/ui`

当前已公共化的组件：

| 类别 | 组件 |
| --- | --- |
| 基础交互 | `QueryForm`、`SortableTable`、`TableColumn`、`SortDialog`、`SortManagerButton` |
| 远程选择 | `RemoteSelect`、`ApiSelect` |
| 平台数据（`@g2rain/ui/platform`） | `OrganSelect`、`DictSelect`、`DictText`、`StatusSwitch` |

`UserSelect` 尚未实现，后续沿用 `EntityDataProvider` 契约；详见[平台数据组件](platform-data-components.md)。

公共组件不得导入应用 Store、路由、国际化实例、领域 API 或目录别名。外部能力通过 Props、事件、Slots、Provider 或函数参数传入。通用入口通过 `G2rainUi` 注入 Translator 和 Locale。组织与字典 Provider 只由 `@g2rain/ui/platform` 的 `G2rainPlatformUi` 注入。

首批组件采用逐文件规范基准，不直接复制某一个应用的整个目录；公开 API、基准来源和分叉处理见[首批组件基准与公开契约](component-migration-baseline.md)。

```vue
<RemoteSelect :fetch-data="userApi.search" />
```

```vue
<script setup lang="ts">
import { OrganSelect, DictText } from '@g2rain/ui/platform'
</script>

<template>
  <OrganSelect v-model="form.organId" />
  <DictText :value="row.status" usage-code="member_status" />
</template>
```

设计要求：

- 样式只使用 G2rain 语义变量。
- 支持按需导入，不在模块加载时注册全局监听。
- 事件和异步行为具有明确类型。
- 可取消的异步请求在卸载时释放。

## 3. `@g2rain/http`

HTTP 包提供 Client 工厂、参数序列化、通用签名、可组合拦截器和错误标准化。它不读取 `import.meta.env`，也不决定登录跳转和 UI 提示。

```ts
const { client, dispose } = createHttpClient({
  baseURL: runtimeConfig.apiBaseUrl,
  authSessionProvider: () => accessTokenStore.session,
  ensureAccessToken: options => accessTokenStore.ensure(options),
  authErrorHandler: (reason, error) => authService.handleFailure(reason, error),
  getLocale: () => localeStore.locale,
})
```

刷新令牌应合并并发请求，重试必须有明确上限并防止认证失败循环。包负责标准化错误，提示、跳转和上报由应用决定。应用侧的 Client 单例表、Mock 数据和环境 URL 计算留在装配层。

工厂参数、错误模型和认证行为的生成契约见 [HTTP 与 Runtime 契约](http-runtime-contract.md)。

## 4. `@g2rain/platform`

Platform 是前端应用运行与主子协作 SDK。包根只导出 `RuntimeContext`、`RuntimeMessage` 和 `PlatformError`，顶层不导入 Vue。`/sub` 提供 `createSubPlatform` 和 `createStandardSubPlatform`。Theme、Loading、Permission、Micro App、I18n、Error 和 HTTP 都是可单独导入的 Capability；HTTP 入口**不**依赖 `@g2rain/http`。

```text
packages/platform/src/
├─ contract/
├─ kernel/          # 不进入 exports
├─ sub/
├─ main/
├─ permission/
├─ loading/
├─ theme/
├─ micro-app/
├─ i18n/
├─ error/
├─ http/
└─ index.ts
```

公开子路径：`.`、`./sub`、`./main`、`./theme`、`./micro-app`、`./permission`、`./permission/vue`、`./loading`、`./i18n`、`./i18n/vue-i18n`、`./error`、`./http`。不提供 `/core` 或 `/vue`。

`createSubPlatform` 仍只接受 `capabilities` 数组。`createStandardSubPlatform` 强制组合 I18n 和 Error，其他能力由调用方追加。壳与 Member 尚未接入。`./permission` 不导入 Vue；插件在 `./permission/vue`。`vue` 与 `vue-i18n` 都是可选 peer。包根、`/main`、`/sub`、`/permission`、`/i18n`、`/error` 和 `/http` 不导入 Vue。

每项能力应可独立使用；所有全局监听 API 都应返回释放函数。具体 Store、消息 Processor 与 qiankun Props 读取仍由应用维护。详见 [Platform 前端应用运行与主子协作方案](../architecture/platform-framework.md)。

## 5. 公开 API 原则

- 消费方只从 `package.json#exports` 声明的入口导入。
- 每个公开符号都有稳定类型定义。
- 包的 JavaScript 入口不产生非预期全局副作用。
- 新能力优先以小型、可组合的函数或接口提供。
- 包之间不得从对方的 `src` 或 `dist` 内部路径导入。
- 应用在组合根装配各包；`http` 与 `platform` 为并行能力，不形成包级硬依赖。
