# 包设计

| 包 | 核心职责 | 禁止包含 |
| --- | --- | --- |
| `@g2rain/theme` | 设计变量、亮暗主题、基础样式、Element Plus 变量映射 | Vue、Pinia、业务 API、qiankun |
| `@g2rain/ui` | 通用 Vue 组件和组合式函数 | 应用 Store、路由、领域接口 |
| `@g2rain/http` | HTTP Client、序列化、签名、错误模型和通用拦截器 | 环境变量、具体 Token Store、登录跳转 |
| `@g2rain/runtime` | 权限、Loading、主题切换、微应用通信协议 | 业务页面、具体领域 API |

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
| 远程选择 | `RemoteSelect`、`ApiSelect`、`DictSelect` |
| 平台数据 | `OrganSelect`、`DictText`、`StatusSwitch` |

`UserSelect` 尚未实现，后续沿用 `EntityDataProvider` 契约；详见[平台数据组件](platform-data-components.md)。

公共组件不得导入应用 Store、路由、国际化实例、领域 API 或目录别名。外部能力通过 Props、事件、Slots、Provider 或函数参数传入。应用入口通过 `G2rainUi` 插件注入 Translator、Locale 与数据 Provider。

首批组件采用逐文件规范基准，不直接复制某一个应用的整个目录；公开 API、基准来源和分叉处理见[首批组件基准与公开契约](component-migration-baseline.md)。

```vue
<DictSelect
  dict-code="user_status"
  :fetch-options="dictApi.list"
/>

<OrganSelect v-model="form.organId" />
<DictText :value="row.status" usage-code="member_status" />
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

## 4. `@g2rain/runtime`

Runtime 提供权限 Provider、全局 Loading 协调、主题 Controller、微应用消息类型与浏览器 Event Adapter。各项能力彼此独立，由应用按需组合；**不**依赖 `@g2rain/http` 包。

```text
packages/runtime/src/
├─ permission/
├─ loading/
├─ theme/
├─ micro-app/
└─ index.ts
```

公开子路径：`.`、`./theme`、`./micro-app`、`./permission`、`./loading`。

每项能力应可独立使用；所有全局监听 API 都应返回释放函数。Runtime 只定义协议和通用实现，具体 Store、消息 Processor 与 qiankun Props 读取仍由应用维护。

Runtime 是当前仓库内尚未发布的工作包。实施目标架构时直接将它重命名为 `@g2rain/platform`：由 Platform Facade 对业务应用提供标准 Preset，Runtime Kernel 只作为内部生命周期核心，并将 I18n 与 Error Handling 纳入首版标准能力。最终不发布 `@g2rain/runtime`，也不保留兼容子路径，详见 [Platform 统一应用平台方案](../architecture/platform-framework.md)。

## 5. 公开 API 原则

- 消费方只从 `package.json#exports` 声明的入口导入。
- 每个公开符号都有稳定类型定义。
- 包的 JavaScript 入口不产生非预期全局副作用。
- 新能力优先以小型、可组合的函数或接口提供。
- 包之间不得从对方的 `src` 或 `dist` 内部路径导入。
- 应用在组合根装配各包；`http` 与 `runtime` 为并行能力，不形成包级硬依赖。
