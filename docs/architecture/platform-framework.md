# G2rain Platform 统一应用平台方案

- 状态：草案
- 日期：2026-09-18
- 目标包：`@g2rain/platform`（尚未创建）
- 内部核心：Runtime Kernel
- 当前基线：尚未发布的 `@g2rain/runtime` 工作包已实现 Theme、Loading、Permission、Micro App Event Adapter 原语；发布前将直接重命名为 `@g2rain/platform`，不提供 Runtime 兼容包。

## 1. 背景

G2rain 业务 App 同时支持独立运行和微前端集成运行。当前各 App 分别编排 Vue、Store、主题、权限、HTTP、路由、主子应用消息和卸载清理，容易出现以下问题：

- 同一生命周期流程在多个仓库复制并逐渐分叉；
- qiankun API、浏览器全局变量和应用启动逻辑相互耦合；
- 监听器、Watcher、Client 和 Controller 的清理分散，重新挂载容易泄漏；
- 更换微前端框架或主题实现时影响应用主体；
- 公共原语虽然可以复用，但各 App 的装配方式仍不一致。

因此，统一入口不再命名为 Runtime，而命名为 Platform：

> `@g2rain/platform` 是 G2rain 前端应用的统一平台入口，负责运行上下文、生命周期、国际化、错误处理、主题、权限、Loading、消息和资源释放；具体宿主、UI 框架、HTTP Client 和业务行为通过 Adapter、Capability 或 Provider 注入。

`Runtime` 继续作为 Platform 内部 Kernel 的技术概念，不再承担业务应用入口的产品命名。Platform 不等于单体框架：Kernel 保持轻量，标准 App 使用官方 Preset，特殊 App 可以按需组合独立 Capability。

### 1.1 命名边界

| 名称 | 定位 | 是否面向业务应用 |
| --- | --- | --- |
| `@g2rain/platform` | 统一入口、Preset、标准能力及 Adapter 契约 | 是 |
| Runtime Kernel | Context、状态机、生命周期、依赖顺序和释放 | 否，属于 Platform 内核 |
| `@g2rain/runtime` | 当前仓库内的未发布工作名称 | 否；发布前删除该包名 |

由于 `@g2rain/runtime` 从未发布，也没有外部版本兼容承诺，实施时直接将 `packages/runtime`、包名、exports、文档和内部引用重命名为 Platform。最终制品只发布 `@g2rain/platform`，不建立别名包、转发入口或弃用周期。

## 2. 目标与非目标

### 2.1 目标

- 统一 `create → bootstrap → mount → update → unmount → dispose` 生命周期。
- 为独立模式、qiankun 及未来宿主提供相同的应用运行接口。
- 统一管理监听器、Watcher、Controller 和其他释放函数。
- Theme、Loading、Permission、I18n、Error Handling、Micro App 等能力可插拔。
- 支持替换 qiankun，而不重写业务页面和公共能力。
- 支持替换品牌主题或 UI 框架，而不改变 Runtime Kernel。
- 统一语言状态、语言包装载、翻译接口和 UI 框架 Locale 同步。
- 统一错误标准化、错误码翻译、用户提示、标准动作和监控上报。
- 提供标准 Preset，避免每个 App 重复书写装配代码。
- 保持按需导入和独立子路径，避免所有能力进入同一个 Bundle。

### 2.2 非目标

- Platform 不拥有业务页面、领域 API、业务 DTO 或 Mock 数据。
- Platform 不内置具体 Token Store、IAM Endpoint 或 SSO 跳转规则。
- Platform 不生成 Vue Router 路由表，也不加载业务资源。
- Runtime Kernel 不直接依赖 qiankun、Element Plus、Axios 或 Pinia。
- Platform 不承诺更换 UI 框架完全零修改；它保证替换被限制在 Adapter、主题映射和 `@g2rain/ui` 内部。
- Platform 不取代 `@g2rain/http`；通过 Adapter 组合 HTTP，不让 Platform Kernel 依赖具体 Client。
- Error Handling 不吞掉所有异常，也不替代业务页面自己的校验和领域恢复流程。
- I18n 不持有业务文案事实来源，业务语言包仍由各应用维护和注册。

## 3. 总体结构

```mermaid
flowchart TB
  App[业务 App]
  Platform[@g2rain/platform]
  Preset[G2rain App Preset]
  Kernel[Runtime Kernel]

  Host[Host Adapter]
  Theme[Theme Capability]
  Loading[Loading Capability]
  Permission[Permission Capability]
  I18n[I18n Capability]
  Error[Error Capability]
  Message[Message Capability]
  Http[HTTP Adapter]

  Qiankun[Qiankun Adapter]
  Standalone[Standalone Adapter]
  Future[未来宿主 Adapter]

  Css[CSS Variable Theme Adapter]
  UiTheme[UI Framework Theme Adapter]

  App --> Platform
  Platform --> Preset
  App -.按需组合.-> Kernel
  Preset --> Kernel
  Kernel --> Host
  Kernel --> Theme
  Kernel --> Loading
  Kernel --> Permission
  Kernel --> I18n
  Kernel --> Error
  Kernel --> Message
  Kernel -.可选.-> Http

  Host --> Qiankun
  Host --> Standalone
  Host --> Future
  Theme --> Css
  Theme --> UiTheme
```

架构分为五层：

1. **Platform Facade**：业务应用唯一入口，提供 Preset、标准配置和稳定类型。
2. **Runtime Kernel**：上下文、状态机、Capability 注册、执行顺序和释放。
3. **Capability**：Theme、Loading、Permission、I18n、Error、Message 等可选能力。
4. **Adapter / Provider**：连接 qiankun、DOM、UI 框架、HTTP Client、监控服务或应用 Store。
5. **Preset**：官方 App 的推荐组合，降低接入成本，但不改变各模块边界。

## 4. Platform Facade 与 Runtime Kernel

### 4.1 Platform Facade

业务应用默认只需要创建 Platform：

```ts
import { createPlatform } from '@g2rain/platform'

const platform = createPlatform({
  context,
  host,
  theme,
  i18n,
  error,
  loading,
  permission,
  message,
  http,
})

await platform.mount(app)
```

Facade 负责默认值、能力组合和类型收口，但不重新实现各 Capability。高级场景可以从明确的子路径使用 Kernel 或单个能力。

### 4.2 Runtime Context

Kernel 使用显式上下文，不直接读取 `import.meta.env`、`window.__POWERED_BY_QIANKUN__` 或 qiankun Props：

```ts
export type RuntimeMode = 'standalone' | 'integrated'

export interface RuntimeContext {
  appKey: string
  mode: RuntimeMode
  applicationCode: string
  contextPath: string
  locale?: string
  initialRoute?: string
  metadata?: Readonly<Record<string, unknown>>
}
```

约束：

- `appKey` 标识当前运行实例，不等同于应用编码。
- Kernel 只读上下文；`update` 使用新的只读快照。
- Token、私钥和完整用户资料不能放入通用 `metadata`。
- 环境变量和宿主 Props 由应用组合根或 Host Adapter 转换为 Context。

### 4.3 生命周期

```text
create
  ↓
bootstrap（同一 Runtime 实例最多一次）
  ↓
mount
  ↓
update（零到多次）
  ↓
unmount
  ├─ 可再次 mount
  └─ dispose（终态）
```

语义：

- `bootstrap`：初始化与 DOM 容器无关的能力。
- `mount`：绑定当前实例、容器和运行上下文。
- `update`：处理 Locale、Theme、Token 通知和初始路由等宿主变化。
- `unmount`：释放本次挂载产生的资源，但保留可复用的 Runtime 定义。
- `dispose`：永久释放 Runtime 实例；调用后不得再次挂载。

生命周期调用必须幂等或明确拒绝非法状态，不能静默重复注册监听器。

### 4.4 Capability 契约

目标接口示例：

```ts
export interface RuntimeCapability {
  readonly id: string
  readonly dependsOn?: readonly string[]

  bootstrap?(context: RuntimeContext): void | Promise<void>
  mount?(context: RuntimeContext): void | Promise<void>
  update?(
    context: RuntimeContext,
    previous: RuntimeContext,
  ): void | Promise<void>
  unmount?(context: RuntimeContext): void | Promise<void>
  dispose?(): void | Promise<void>
}
```

Kernel 负责：

- Capability ID 去重；
- 根据 `dependsOn` 校验依赖并确定执行顺序；
- 挂载时按依赖顺序执行，卸载时按相反顺序执行；
- 生命周期失败时执行已完成步骤的逆序回滚；
- 聚合错误但继续尝试必要清理；
- 阻止已 `dispose` 的 Runtime 继续工作。

Capability 之间不通过全局单例互相查找。需要协作时使用构造参数、受控服务注册表或显式 Provider。

### 4.5 Lifecycle Scope

每次 `mount` 创建独立 Scope，统一接管释放函数：

```ts
export interface RuntimeScope {
  add(dispose: () => void | Promise<void>): () => void
  dispose(): Promise<void>
  readonly disposed: boolean
}
```

典型用法：

```ts
scope.add(theme.subscribe(handleTheme))
scope.add(router.afterEach(handleRoute))
scope.add(stopWatcher)
scope.add(eventAdapter.dispose)
```

Scope 按注册的相反顺序释放；单个清理失败不能阻止其余清理执行。

## 5. Host Adapter：隔离 qiankun

Runtime Kernel 不直接引用 qiankun。宿主差异由 Host Adapter 隔离：

```ts
export interface AppHostAdapter {
  readonly id: string
  getInitialContext(): RuntimeContext | Promise<RuntimeContext>
  register(lifecycle: RuntimeLifecycle): () => void
  emit?(message: RuntimeMessage): void
  subscribe?(
    handler: (message: RuntimeMessage) => void | Promise<void>,
  ): () => void
  dispose(): void | Promise<void>
}
```

首批 Adapter：

- `createStandaloneHostAdapter()`：用于独立模式和测试。
- `createQiankunHostAdapter()`：把 qiankun lifecycle/props 映射为 Runtime lifecycle/context。

未来替换 qiankun 时新增 Adapter，例如 single-spa、Module Federation 或自研宿主；Kernel、Capability 和业务 App 不应导入新宿主 SDK。

qiankun Adapter 负责：

- 生命周期注册；
- Props 到 `RuntimeContext` 的转换；
- 容器和 `appKey` 校验；
- 主子应用消息通道接入；
- Adapter 自身监听器释放。

它不负责业务路由生成、Token 验证或资源接口调用。

## 6. Theme Adapter：隔离主题和 UI 框架

主题拆分为三个层次：

```text
主题状态和生命周期     → @g2rain/platform/theme
语义 Token 和品牌样式  → @g2rain/theme
具体 UI 框架变量映射   → Theme Adapter / @g2rain/theme 映射文件
```

目标接口：

```ts
export type ThemeName = string

export interface ThemeAdapter {
  apply(theme: ThemeName): void | Promise<void>
  dispose(): void | Promise<void>
}
```

当前实现使用 CSS Variable Adapter，将主题写入 `data-g2-theme`。替换分为两类：

1. **品牌或配色替换**：替换 `@g2rain/theme` Token/主题文件，Runtime 不变。
2. **UI 框架替换**：替换 UI 变量映射和 `@g2rain/ui` 内部实现，Runtime Kernel、Host Adapter、HTTP 和业务页面契约保持稳定。

Runtime Kernel 不导入 Element Plus。Element Plus Loading、Message、MessageBox 或 Locale 适配由应用或独立 Adapter 注入。

## 7. 标准 Capability

### 7.1 Theme

- 保存和广播主题状态；
- 调用 Theme Adapter 应用主题；
- 集成模式服从宿主主题；
- 独立模式允许应用提供初始值和持久化回调；
- 卸载不删除宿主拥有的全局主题状态。

### 7.2 Loading

- 提供引用计数和幂等结束函数；
- UI 的 `open/close` 由 Adapter 注入；
- Scope 释放时归零并关闭当前实例；
- 不直接拦截 Axios。

### 7.3 Permission

- 提供页面元素和 API 权限 Provider 契约；
- 可选提供 Vue 插件、指令和组合式函数；
- 权限数据加载、更新和业务授权决策由应用负责；
- Provider 缺失时默认拒绝访问。

### 7.4 I18n

I18n 是第一阶段标准能力，不只是保存 Locale：

- 保存当前语言状态并响应 Host update；
- 注册 Platform、公共组件和业务应用语言包；
- 支持语言包按需加载、合并和缺失键回退；
- 提供稳定的 `translate`、`setLocale`、`subscribe` 契约；
- 同步 Element Plus 等 UI 框架的 Locale；
- 在主应用和微应用之间同步语言变化；
- 允许应用注入语言持久化和默认语言选择策略。

目标契约示例：

```ts
export interface I18nAdapter {
  getLocale(): string
  setLocale(locale: string): void | Promise<void>
  translate(key: string, params?: Readonly<Record<string, unknown>>): string
  loadMessages?(locale: string): void | Promise<void>
  subscribe?(handler: (locale: string) => void): () => void
  dispose?(): void | Promise<void>
}
```

Platform 不直接导入 `vue-i18n` 或 Element Plus Locale；官方 Adapter 可以连接它们。业务语言包仍在业务 App 内维护，避免领域文案进入公共包。

### 7.5 Error Handling

Error Handling 是第一阶段标准能力，并与具体 UI 提示解耦：

```text
业务错误 / HTTP 错误 / Kernel 错误 / 未捕获异常
                        ↓
                  错误标准化
                        ↓
       错误码映射 → 国际化文案 → 用户提示
                        ├→ 标准动作
                        └→ 日志与监控上报
```

它负责：

- 把未知异常、HTTP 错误和生命周期错误转换为统一 `PlatformError`；
- 保存 `code`、`source`、`severity`、`cause`、`context` 和是否可重试等信息；
- 将后端错误码或平台错误码映射到 I18n key；
- 通过 Error Presenter 展示 Toast、Dialog、Inline 或 Error Page；
- 为登录失效、无权限、网络异常和服务不可用提供可替换的标准动作；
- 通过 Reporter Adapter 接入日志或监控系统；
- 支持应用覆盖映射、提示和恢复动作；
- 去重同一错误风暴，避免并发请求重复提示。

目标契约示例：

```ts
export interface PlatformError {
  code: string
  source: 'business' | 'http' | 'runtime' | 'unknown'
  severity: 'info' | 'warning' | 'error' | 'fatal'
  messageKey?: string
  cause?: unknown
  context?: Readonly<Record<string, unknown>>
  retryable?: boolean
}

export interface ErrorPresenter {
  present(error: PlatformError, message: string): void | Promise<void>
}

export interface ErrorReporter {
  report(error: PlatformError): void | Promise<void>
}
```

边界要求：Presenter 由 UI Adapter 注入，Kernel 不直接依赖 Element Plus；Reporter 失败不能覆盖原始错误；错误上下文不得包含 Token、私钥或完整用户资料。表单字段校验和领域补偿仍由业务处理。

### 7.6 Micro App Message

- 统一消息信封、类型守卫、发送、订阅和清理；
- Host Adapter 负责具体传输；
- Token、路由和业务消息由应用注册处理器；
- 未知消息被忽略，一个处理器失败不阻塞其他处理器。

### 7.7 HTTP Adapter

HTTP 是可选装配点，不成为 Runtime Kernel 对 `@g2rain/http` 的硬依赖：

```ts
export interface PlatformHttpAdapter {
  updateContext?(context: RuntimeContext): void | Promise<void>
  dispose(): void | Promise<void>
}
```

应用可以把 `@g2rain/http` Client 注册表适配进 Platform 生命周期，用于更新 Locale、baseURL 或卸载释放。HTTP 标准错误可以送入 Error Capability，但 Token Store、SSO 和 Mock 继续属于应用。

## 8. 官方 Preset 与体积控制

标准应用使用便捷 Preset：

```ts
const platform = createPlatform({
  context,
  host,
  theme,
  i18n,
  error,
  loading,
  permission,
  message,
  http,
})
```

Preset 只是组合器，不重新实现 Capability。为避免笨重：

- Kernel 和 Capability 使用独立 `exports` 子路径；
- qiankun、Vue 和具体 UI Adapter 是可选入口；
- 未使用的 Adapter 不进入依赖图；
- Kernel 不设置框架级全局单例；
- 标准 Preset 不导入业务 Store、路由、环境配置和 Mock；
- 每个入口设置明确的 peer dependency，避免重复打包 Vue 或 UI 框架。

建议的目标入口：

```text
@g2rain/platform
@g2rain/platform/core
@g2rain/platform/host
@g2rain/platform/host/standalone
@g2rain/platform/host/qiankun
@g2rain/platform/theme
@g2rain/platform/loading
@g2rain/platform/permission
@g2rain/platform/i18n
@g2rain/platform/error
@g2rain/platform/micro-app
@g2rain/platform/vue
@g2rain/platform/preset
```

入口仅表示目标模块边界；实现前必须核对构建产物、peer dependency 和包体积，不一次性创建空入口。

## 9. Kernel 错误、日志与安全边界

- Kernel 生命周期错误标准化为 `PlatformError(source='runtime')`，保留阶段、Capability ID 和原始原因。
- 默认不吞掉 `bootstrap/mount/update` 错误；是否降级由应用或 Preset 决定。
- `unmount/dispose` 尽最大努力清理全部资源，最后返回聚合错误。
- Platform 不记录 Token、私钥、完整用户资料或消息敏感载荷。
- Host Context 不被视为后端可信身份，Gateway/服务端仍必须验证 Token 和权限。
- Adapter 不得把生产 Secret 放入浏览器配置或 Bundle。

## 10. 迁移计划

### 阶段 0：现有原语基线

- 以现有 Theme、Loading、Permission、Micro App 实现作为代码迁移基线。
- `g2rain-member-app` 当前继续由应用代码编排生命周期。
- 在任何 Registry 发布前，将 `packages/runtime` 直接重命名为 `packages/platform`，并把包名及所有内部导入改为 `@g2rain/platform`。
- 不发布 `@g2rain/runtime`，不提供兼容别名或转发入口。

### 阶段 1：Kernel 与 Scope

- 实现 Runtime Context、状态机、Capability 契约和 Lifecycle Scope。
- 使用纯 TypeScript 测试非法状态、顺序、回滚和释放。
- 不接入 qiankun，不修改现有 App。

### 阶段 2：Host Adapter

- 实现 Standalone Adapter 和 Qiankun Adapter。
- 将 qiankun SDK 限制在 Adapter 入口。
- 验证 mount/update/unmount/重新挂载和多个 `appKey`。

### 阶段 3：Platform 标准能力

- 把现有 Theme、Loading、Permission、Micro App 包装为 Capability。
- 新增 I18n Capability 和官方 `vue-i18n`/UI Locale Adapter。
- 新增 Error Capability、Presenter 和 Reporter Adapter 契约。
- 提供可选 HTTP 生命周期 Adapter，但不引入 `@g2rain/http` 硬依赖。

### 阶段 4：`@g2rain/platform`、官方 Preset 与 Member 试点

- 在已重命名的 `@g2rain/platform` 包中，以 Facade 公开标准配置和能力入口。
- 建立标准 Vue App Preset。
- 在 `g2rain-member-app` 替换分散的启动与释放编排。
- 验证语言切换、错误码翻译、提示覆盖和错误上报降级。
- 同时验证独立模式、qiankun 模式和生产构建。

### 阶段 5：模板与 CLI

- `g2rain-app-template` 默认使用 Platform Preset。
- `g2rain-app-cli` 生成新的组合根，不再复制运行时编排代码。
- 其他 App 按版本独立迁移。

## 11. 验收标准

- Kernel 不依赖 Vue、qiankun、Element Plus、Axios 或 Pinia。
- 单元测试覆盖生命周期顺序、重复调用、错误回滚和逆序释放。
- Standalone 与 Qiankun Adapter 使用同一 Runtime lifecycle。
- 替换 Host Adapter 不修改业务页面、Theme/Permission/Loading Capability。
- 替换主题 Token 不修改 Runtime；替换 UI 框架不修改 Kernel 和 Host Adapter。
- 替换 `vue-i18n` 或 UI 框架 Locale 实现不修改业务页面的 Platform 契约。
- Error Presenter、Reporter 和错误映射可单独替换，Reporter 故障不影响原始业务异常。
- 主应用与微应用切换语言后状态一致，公共组件和 UI 框架文案同步更新。
- 未启用的 Adapter 不进入应用生产依赖图。
- 同一应用 mount → unmount → mount 后监听器数量不增加。
- `dispose` 后所有 Capability、Adapter 和 Scope 均停止产生副作用。
- `g2rain-member-app` 类型检查和生产构建通过，并完成双模式冒烟。
- npm pack 制品只暴露存在且经过验证的入口。

## 12. 变更和回滚

- `@g2rain/runtime` 未发布，因此直接改名，不承担 npm 版本兼容成本。
- 重命名必须一次性更新 workspace、源码导入、Playground、Member 试点、文档、构建检查和 pack 检查，仓库内不得残留 `@g2rain/runtime` 消费入口。
- 最终只允许 `@g2rain/platform` 出现在待发布制品清单中；Runtime 仅可作为内部类型和 Kernel 术语出现。
- Member 试点期间保留一次版本回退能力；回滚只需恢复组合根和包版本。
- Platform 生命周期或消息协议发生不兼容变化时使用新的主版本，并提供迁移说明。
- 未完成真实 App 验证前，不把目标架构标记为正式平台闭环。

## 13. 待确认事项

实现前还需要形成明确决策：

1. Runtime Kernel 是否允许维护受控服务注册表，还是只通过构造参数协作。
2. Vue 集成放在 `@g2rain/platform/vue` 子路径，还是拆成独立包。
3. qiankun Adapter 作为 Platform 子路径还是独立包，以 peer dependency 和包体积实测决定。
4. `unmount` 后是否允许同一 Runtime 实例再次 `mount`；本方案暂定允许。
5. 标准 Preset 默认启用 I18n 和 Error；Theme、Loading、Permission、Message 是否全部默认启用，以及 HTTP Adapter 是否默认启用。
这些事项不影响先实现无框架依赖的 Kernel 和 Lifecycle Scope。
