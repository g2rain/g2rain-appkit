# HTTP 与 Runtime 生成契约

本文定义 `@g2rain/http` 和 `@g2rain/platform` 的首版公共边界。现有应用代码是行为参考，不允许把其中的环境读取、具体 Store 或窗口全局变量原样搬入公共包。

两个包**互不依赖**：应用在组合根分别装配 HTTP Client 与 Runtime 能力。消息 Processor、Client 单例表、Mock 与环境 URL 计算留在应用层。

## 1. 来源与迁移原则

- 基准来源：`g2rain-app-template/src/components/http`、`permission`、`loading` 和 `micro-app`。
- 六个应用完全一致的纯函数可以直接迁移并补测试。
- 所有 `@/`、`@platform`、`@runtime`、`@shared` 导入必须通过参数或 Adapter 消除。
- 应用内 `getHttpClient` 单例表、环境 URL 计算和 qiankun Props 读取留在应用装配层。
- 第一版优先兼容现有 Result、DPoP 和消息信封，不同时发明第二套协议。

## 2. HTTP 基础类型

```ts
import type { AxiosInstance, AxiosRequestConfig } from 'axios'

export interface Result<T = unknown> {
  requestId: string
  requestTime: string
  status: number
  errorCode: string
  errorMessage: string
  data: T
}

export type HttpClientType = 'default' | 'auth' | 'docs'

export interface EnsureAccessTokenOptions {
  force?: boolean
}

export interface HttpAuthSession {
  client: DpopClient | null
  isLogin: boolean
  isAccessTokenValid: boolean
  tokenExpired: boolean
  tokenString: string | null
  setTokenExpired(expired: boolean): void
}

export interface HttpClientOptions {
  dpop?: { applicationCode: string }
  baseURL?: string
  withAuth?: boolean
  isDirectResponse?: boolean
  authSessionProvider?: () => HttpAuthSession
  ensureAccessToken?: (options?: EnsureAccessTokenOptions) => Promise<void>
  authErrorHandler?: (
    reason: 'NO_LOGIN' | 'TOKEN_REFRESH_FAILED',
    error: unknown,
  ) => void | Promise<void>
  getLocale?: () => string | undefined
  maxAuthRetries?: 0 | 1
  onError?: (error: G2rainHttpError) => void | Promise<void>
}

export type HttpResponse<T, Direct extends boolean> = Direct extends true
  ? T
  : Result<T>

export interface HttpClient<Direct extends boolean = false> {
  request<T = unknown, Body = unknown>(
    config: AxiosRequestConfig<Body>,
  ): Promise<HttpResponse<T, Direct>>
  get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig,
  ): Promise<HttpResponse<T, Direct>>
  post<T = unknown, Body = unknown>(
    url: string,
    data?: Body,
    config?: AxiosRequestConfig<Body>,
  ): Promise<HttpResponse<T, Direct>>
  put<T = unknown, Body = unknown>(
    url: string,
    data?: Body,
    config?: AxiosRequestConfig<Body>,
  ): Promise<HttpResponse<T, Direct>>
  patch<T = unknown, Body = unknown>(
    url: string,
    data?: Body,
    config?: AxiosRequestConfig<Body>,
  ): Promise<HttpResponse<T, Direct>>
  delete<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig,
  ): Promise<HttpResponse<T, Direct>>
}

export interface HttpClientInstance<Direct extends boolean = false> {
  axios: AxiosInstance
  client: HttpClient<Direct>
  dispose(): void
}

export function createHttpClient<Direct extends boolean = false>(
  options?: HttpClientOptions & { isDirectResponse?: Direct },
): HttpClientInstance<Direct>
```

HTTP 方法继续接受 `AxiosRequestConfig`，降低首轮迁移成本；Axios 因此是 `@g2rain/http` 的普通 dependency，并且 Axios 类型属于第一版公开契约。

## 3. 标准错误模型

```ts
export type HttpErrorSource = 'network' | 'backend' | 'auth' | 'client'

export class G2rainHttpError extends Error {
  readonly code: string
  readonly source: HttpErrorSource
  readonly status?: number
  readonly requestId?: string
  readonly retryable: boolean
  readonly cause?: unknown
}
```

规则：

- 网络失败标准化为 `source=network`。
- 后端 Result 失败保留 `errorCode`、`errorMessage` 和 `requestId`。
- 401 或网关认证错误标准化为 `source=auth`。
- UI 提示、路由跳转、日志上报不由 HTTP 包执行。
- `onError` 只做通知，不改变 Promise 拒绝行为。
- 取消请求保持可识别的取消语义，不包装成普通网络失败。

## 4. 序列化与 DPoP

工厂接入显式提供 `dpop: { applicationCode }`；withAuth=false 禁用签名及认证副作用。按现网 g2rain-main-shell 的 default.ts/sign.ts，htu 原样使用 config.url，不拼接 baseURL 或域名，不转换为最终传输路径。调用方使用业务路径并把查询放在 params；paramsSerializer 输出同时用于传输和 pha。保留 Axios baseURL/url，不擅自改写代理前缀。撤回此前未发布的 origin/htuMode 扩展。

FormData 使用原生 Response 编码为 ArrayBuffer 并读取对应 Content-Type；JSON 与 URL 编码复用 Axios transformRequest，签名完成后不再重复转换。纯函数 createDpopProof 的 data 必须是最终发送内容，未编码 FormData 会明确拒绝。新接口定义见 packages/http/src/types.ts 中的 DpopClient。

- `defaultParamsSerializer` 沿用现有稳定规则：key/value 严格编码，先按 key、再按 value 排序；冒号保持未编码，以兼容现有时间参数签名。
- `null` 和 `undefined` 查询参数忽略；数组生成重复 key；其他值使用 `String(value)`。
- URL 编码和参与签名的查询串必须使用同一个 Serializer，不能各自实现。
- application/x-www-form-urlencoded 在签名前转换为最终字符串。
- multipart/form-data 在签名前转换为与实际发送内容完全一致的字节和 Content-Type boundary；编码器作为纯函数放入 HTTP 包，不再依赖应用 `@shared/http.util`。

DPoP 的首版纯函数接口：

```ts
export interface DpopSignInput {
  url: string
  method: string
  params?: unknown
  data?: unknown
  applicationCode: string
  client: DpopClient
  jti: string
}

export function createDpopProof(input: DpopSignInput): Promise<string>
```

规则：

- Header 继续使用 `typ=dpop+jwt`、`alg=ES256`、`ph_alg=SHA-256`。
- 请求方法转为大写；签名内容使用最终请求 URL、规范化参数和最终请求体字节。
- 签名失败必须拒绝 Promise，不能返回空字符串继续发送请求。
- IAM keyId、公钥 Endpoint 和缓存策略不属于纯签名能力。应用可通过普通 HTTP Client 获取后注入；公共包不得硬编码 Endpoint 或使用跨 Client 的模块级缓存。
- 不在日志中输出 Token、私钥、完整签名内容或请求体。

## 5. Token 刷新与重试

兼容 Result status=0/200。HTTP 401 与业务 gateway.40002 统一进入刷新；gateway.40001 仅通知 NO_LOGIN。配置 session Provider 的客户端在发送前验证登录和本地有效期；未配置 Provider 的普通 Client 保留无会话用法，开启 DPoP 则必须提供 Client 密钥。

通知回调抛错或拒绝不会改变请求的原始拒绝原因；刷新完成后到达的旧 Token 错误复用已更新会话。刷新回调负责写回有效 Token，包检查有效性后清除 tokenExpired。dispose 不能取消已交给应用执行的刷新本身，但会阻止刷新后的重放和通知。

- 同一个 Client 实例同时只能存在一个刷新 Promise，其余失败请求等待该 Promise。
- 默认 `maxAuthRetries=1`；单个请求刷新后最多重放一次。
- 重放请求必须写入包内部标记，防止再次进入刷新循环；内部标记不属于公开 API。
- `ensureAccessToken({ force: true })` 用于服务端已判定 Token 失效、但本地仍认为有效的情况。
- 刷新失败只调用一次 `authErrorHandler('TOKEN_REFRESH_FAILED', error)`，所有等待请求收到同一原因的拒绝。
- `withAuth=false` 的客户端不触发刷新和认证跳转。
- Client `dispose()` 后移除拦截器并拒绝再产生后台刷新副作用。

## 6. 请求取消与 Loading

- HTTP 包遵循 Axios `signal`，不创建应用级 Loading UI。
- `@g2rain/platform/loading` 提供引用计数控制器，而不是直接耦合某个请求单例。

```ts
export interface LoadingController {
  begin(key?: string): () => void
  readonly activeCount: number
  dispose(): void
}

export function createLoadingController(options: {
  open(): { close(): void }
}): LoadingController
```

`begin()` 返回幂等结束函数。计数从 0 到 1 时调用 `open`，从 1 到 0 时关闭；重复调用结束函数不能产生负数。`dispose()` 必须关闭现有实例并归零。

## 7. 主题 Runtime

主题包只包含 CSS。浏览器主题状态由 `@g2rain/platform/theme` 管理：

```ts
export type G2rainTheme = 'light' | 'dark'

export interface ThemeController {
  getTheme(): G2rainTheme
  setTheme(theme: G2rainTheme): void
  subscribe(listener: (theme: G2rainTheme) => void): () => void
  dispose(): void
}

export function createThemeController(options?: {
  root?: HTMLElement
  initialTheme?: G2rainTheme
  persist?: (theme: G2rainTheme) => void | Promise<void>
}): ThemeController
```

- 默认 root 是 `document.documentElement`，SSR 或无 DOM 环境必须要求调用方显式提供 root，不能在模块加载时访问 document。
- `setTheme` 写入 `data-g2-theme`，值未变化时不重复通知。
- `dispose` 只移除本 Controller 的监听，不删除 Main Shell 所有的根属性。
- 集成模式下由 Main Shell 调用 setTheme；子应用只订阅或同步内部状态。

## 8. 微应用消息信封

沿用现有 `MicroAppMessage` 的 `data` 字段：

```ts
export interface MicroAppMessage<T extends string, D = unknown> {
  type: T
  data: D
  requestId?: string
  timestamp: number
  appKey?: string
}

export interface EventAdapter<Message> {
  emit(message: Message): void
  subscribe(handler: (message: Message) => void | Promise<void>): () => void
  dispose(): void
}
```

首版浏览器 Adapter 使用 `window.dispatchEvent(new CustomEvent(message.type, { detail: message }))` 发送，并按消息 type 使用 `window.addEventListener` 订阅。构造函数必须接收 EventTarget，默认值只能在实例化时读取 window，模块加载时不得访问浏览器全局，以支持测试和非浏览器导入。释放订阅时必须使用完全相同的 handler 引用。

首版事件值：

```text
g2rain:sub-app:request-token
g2rain:main-app:token-response
g2rain:sub-app:token-invalid
g2rain:sub-app:route-change
g2rain:main-app:theme-changed
```

相比现有 `initEventListeners/cleanupEventListeners`，公共 Adapter 使用返回释放函数的 `subscribe`。应用兼容层负责映射旧接口。处理器忽略未知消息；错误消息不得阻塞其他已注册处理器。

## 9. 权限契约

```ts
export type PageElementStatus = 'VISIBLE' | 'ENABLED'

export interface PageElementPermissionProvider {
  hasPageElementPermission(elementCode: string): boolean
  getPageElementStatus(elementCode: string): PageElementStatus | undefined
}

export interface ApiPermissionProvider {
  hasApiPermission(apiUrl: string, requestMethod: string): boolean
}
```

Runtime 可以提供 Vue 插件和组合式函数，但权限数据及业务决策由 Provider 提供。未注册 Provider 时采用拒绝访问的安全默认值；可通过 `onMissingProvider` 注入诊断回调（例如仅在开发环境 `console.warn`）。

## 10. 公开子路径

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./theme": {
      "types": "./dist/theme/index.d.ts",
      "import": "./dist/theme/index.js"
    },
    "./micro-app": {
      "types": "./dist/micro-app/index.d.ts",
      "import": "./dist/micro-app/index.js"
    },
    "./permission": {
      "types": "./dist/permission/index.d.ts",
      "import": "./dist/permission/index.js"
    },
    "./loading": {
      "types": "./dist/loading/index.d.ts",
      "import": "./dist/loading/index.js"
    }
  }
}
```

Runtime 构建必须为这些入口实际生成独立文件，不能用不存在的路径完成 manifest。

## 11. 实现验收场景

- 三个并发 401 只执行一次 Token 刷新，三个请求最多各重放一次。
- 刷新失败只触发一次统一认证失败处理。
- Client dispose 后 Axios 拦截器被移除。
- 两个并发请求结束顺序不同，Loading 仍只打开和关闭一次。
- Theme Controller 重复设置同值不重复通知，dispose 后不再通知。
- 子应用挂载、卸载、重新挂载后只有一份消息监听器。
- 未知微应用消息被忽略，已知消息保持类型安全。
- HTTP、Runtime 源码不存在应用目录别名、具体 Store 和 `import.meta.env`。
