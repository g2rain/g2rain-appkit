# G2rain Appkit

G2rain 前端公共契约与基础能力库，使用 npm workspaces 管理四个 ESM 包：主题、Vue UI、HTTP Client 与应用运行 SDK。根包为私有工作区，不作为 npm 包发布。四个子包当前源码版本均为 `1.0.1`；源码版本号不代表 Registry 发布状态。

## 包与职责

| 包 | 能力 | 使用说明 |
| --- | --- | --- |
| `@g2rain/theme` | CSS 设计变量、亮暗主题、Element Plus 映射与基础样式 | [Theme README](packages/theme/README.md) |
| `@g2rain/ui` | 查询表单、远程选择、多列排序、组织和字典组件、状态开关 | [UI README](packages/ui/README.md) |
| `@g2rain/http` | Axios Client、Result 错误处理、Token 刷新、DPoP、SSE | [HTTP README](packages/http/README.md) |
| `@g2rain/platform` | Main/Sub 协作、实例生命周期、权限、语言、主题、Loading、消息与错误处理 | [Platform README](packages/platform/README.md) |

`theme` 是 CSS-only 包；`ui` peer 依赖 `theme` 和宿主 UI 框架。`http` 与 `platform` 之间没有包依赖，应用通过 Adapter 装配两者。业务 API、环境地址、Token Store、登录跳转、Vue/Pinia/Router 实例和 qiankun 句柄由应用管理。

## 安装与环境

开发本仓库需要 Node.js `>=22` 和 npm。消费方按需安装公共包：

```bash
npm install @g2rain/theme @g2rain/ui @g2rain/http @g2rain/platform
npm install vue element-plus @element-plus/icons-vue
```

UI peer 范围为 `vue ^3.5.0`、`element-plus ^2.13.0`、`@element-plus/icons-vue ^2.3.2`、`@g2rain/theme ^1.0.1`。Platform 的 `vue ^3.5.0` 和 `vue-i18n ^11.4.4` 为可选 peer；使用对应 Vue 入口时安装这些依赖。HTTP 的运行依赖由包自身声明。

未发布的候选版本通过 `npm pack` 产物安装。安装时选择 Registry 已有版本或本地 tarball，不把工作区版本号当成 Registry 可用性证明。

## 主题和 UI 装配

应用入口引入 Element Plus 样式、主题和 UI 样式，注册 Element Plus 与 UI 上下文。`G2rainUi` 和 `G2rainPlatformUi` 提供上下文，不会自动全局注册公共组件；组件在使用处显式导入。

以下 `app`、翻译、语言读取、数据加载和权限判断函数由应用提供：

```ts
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@g2rain/theme/styles.css'
import '@g2rain/ui/style.css'
import { G2rainUi } from '@g2rain/ui'
import { G2rainPlatformUi } from '@g2rain/ui/platform'
import { createThemeController } from '@g2rain/platform/theme'

app.use(ElementPlus)
app.use(G2rainUi, {
  translate: (key, fallback) => translate(key, fallback),
  locale: () => getLocale(),
})
app.use(G2rainPlatformUi, {
  dataProviders: {
    organ: { loadOptions: loadOrganOptions },
    dict: { loadOptions: loadDictOptions },
  },
  permission: { isEnabled: code => canOperate(code) },
  onMissingProvider: name => console.warn(`Missing UI provider: ${name}`),
})

const theme = createThemeController({ initialTheme: 'light' })
theme.setTheme('dark')
```

`translate` 签名为 `(key, fallback) => string`；不提供时返回 fallback。`locale` 是读取当前语言的函数；组件依赖语言变化时，该函数应读取 Vue 响应式状态。字典搜索关键字使用顶层 `params.key`，组织搜索接受 `key` 或 `value`；Provider 应把 `signal` 传给支持取消的请求层。

主题由根元素的 `data-g2-theme="light|dark"` 决定。Controller 优先采用根元素已有的有效主题，其次采用 `initialTheme`，最后使用 `light`。`dispose()` 清理订阅，不删除根属性。Element Plus 变量映射要求根元素具有 `data-g2-theme`。

集成模式下由主壳设置主题，子应用服从主壳；Theme Capability 仅在独立模式应用 `context.theme`。Main 协调器不自动广播主题。启用 qiankun 样式隔离时，应用须确保改写后的主题选择器可以匹配实际容器，按实际 DOM 验证主题效果。

## UI 公开入口

| 入口 | 主要导出 |
| --- | --- |
| `@g2rain/ui` | `G2rainUi`、`useG2rainUi`、`QueryForm`、`RemoteSelect`、`ApiSelect`、`SortableTable`、`TableColumn`、`SortDialog`、`TableSortColumn`、`SortManagerButton`、`useTableSort` |
| `@g2rain/ui/platform` | `G2rainPlatformUi`、`useG2rainPlatformUi`、`OrganSelect`、`DictSelect`、`DictText`、`StatusSwitch`，以及 Provider 类型 |
| `@g2rain/ui/style.css` | 公共组件样式 |

`TableSortColumn` 与 `SortDialog` 导出同一组件。平台数据组件使用显式 API 回调或注入的 Provider。`StatusSwitch` 配置 `permission` 时必须注入可操作性判断；提交成功后才回写值。详细默认值、事件和数据协议见 [UI README](packages/ui/README.md)。

## HTTP Client

以下会话读取、刷新及错误处理函数由应用提供：

```ts
import { createHttpClient } from '@g2rain/http'

const http = createHttpClient({
  baseURL: '/api',
  authSessionProvider: () => getAuthSession(),
  ensureAccessToken: options => ensureAccessToken(options),
  authErrorHandler: (reason, error) => handleAuthError(reason, error),
  getLocale: () => getLocale(),
  onError: error => showRequestError(error),
})

const result = await http.client.get<{ id: number }>('/items/1')
console.log(result.data)

// 应用销毁或不再使用此 Client 时调用
http.dispose()
```

工厂返回 `{ axios, client, dispose }`。Client 提供 `request/get/post/put/patch/delete/sse`；默认返回完整 `Result<T>`，不自动提取 `data`。`isDirectResponse: true` 返回原始响应体，跳过 HTTP 200 中的 Result 业务失败判断。

普通请求默认超时 10 秒。Token 刷新按 Client 合并，每个请求默认最多认证重试一次；`gateway.40001` 通知重新登录且不重试，HTTP 401 和 `gateway.40002` 进入认证失败处理。服务端失效标记 `tokenExpired` 触发强制刷新。刷新回调必须把有效会话写回 Provider。

DPoP 默认关闭，通过 `dpop: { applicationCode }` 开启；`withAuth: false` 关闭认证处理及 DPoP。SSE 默认 POST、使用 fetch adapter、关闭超时，通过调用方 signal 取消；Client dispose 会主动取消在途 SSE，包括静默读取。

完整配置、错误字段、序列化与 SSE 示例见 [HTTP README](packages/http/README.md)。

## Platform 公开入口

| 入口 | 职责 |
| --- | --- |
| `@g2rain/platform` | `RuntimeContext`、`RuntimeContextUpdate`、`RuntimeMessage`、`PlatformError` 等共享类型与错误类 |
| `@g2rain/platform/sub` | `createSubPlatform`、`createStandardSubPlatform`、`resolveSubHostProps`、`createSubDirectedMessage` |
| `@g2rain/platform/main` | `createMainPlatform` 与主壳端口类型 |
| `@g2rain/platform/theme` | `createThemeController`、`createThemeCapability` |
| `@g2rain/platform/micro-app` | 浏览器事件 Adapter、消息 Capability 与消息类型 |
| `@g2rain/platform/permission` | 权限 Provider 类型、Capability、页面元素判断与 API 路径解析 |
| `@g2rain/platform/permission/vue` | 权限插件、`v-permission`、`usePermission` |
| `@g2rain/platform/loading` | 引用计数 Loading Controller 与 Capability |
| `@g2rain/platform/i18n` | 国际化引擎和 UI 语言 Adapter、Capability |
| `@g2rain/platform/i18n/vue-i18n` | Vue I18n 适配器 |
| `@g2rain/platform/error` | 错误标准化、策略、展示、上报和动作编排 |
| `@g2rain/platform/http` | 应用注入的 HTTP Binding 生命周期和 locale 同步 |

主子协作的关键规则：

- 实例上下文包含 `applicationCode`、`viewId`、`instanceId`、`mode` 和 `contextPath`。集成 props 必须显式包含三个身份字段及 `appKey === instanceId`。
- Token 不进入公开 props 或 RuntimeContext，应用通过认证消息和 Auth Bridge 装配会话。
- Main 首先 `buildPublicProps` 建立实例快照，再更新语言或发送定向消息。`initialRoute` 为一次性导航意图，不保存在后续快照中。
- Sub 按实例管理 mount/update/unmount；Capability 按依赖顺序初始化、逆序释放。应用负责路由行为、Vue 创建与销毁，Kernel 不自动执行路由跳转。
- `createStandardSubPlatform` 必须传入 `i18n` 和 `error` 配置，并组合调用方的其他 Capability。
- Definition、会话级 Adapter、共享 Client 按实际所有权释放；单个实例 unmount 不等同于销毁整个 Definition。

示例与生命周期规则见 [Platform README](packages/platform/README.md)，完整接线见 [接入手册](docs/integration/README.md)。

## 本仓库开发

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run pack:check
```

`build` 构建四个包和 Playground。按需运行单个包或 Playground：

```bash
npm run test --workspace @g2rain/http
npm run build --workspace @g2rain/ui
npm run dev --workspace @g2rain/playground
npm run test:coverage
```

检查和生成发布制品：

```bash
npm pack --workspace @g2rain/http --dry-run
npm pack --workspace @g2rain/http
```

四包均通过各自 `package.json#exports` 声明公开入口，只从这些入口消费。打包与入口检查以 [构建契约](docs/development/build-and-test-contract.md) 和 `pack:check` 为准。库内检查不替代真实应用的登录、刷新、微应用生命周期及主题联调。

## 发布

发布由 [.github/workflows/publish-npm.yml](.github/workflows/publish-npm.yml) 执行。推送 `vX.Y.Z` 格式的 Tag 后，工作流校验四个子包版本与 Tag 完全一致，执行安装、类型检查、测试、构建和制品检查，再按 `theme → ui → http → platform` 顺序发布，成功后创建 GitHub Release。

工作流使用 Node.js 24、npm `^11.5.1`、GitHub Environment `npm`、OIDC 和 provenance；审批及 Trusted Publisher 配置由仓库和 npm 维护者确认。创建发布 Tag 前须提交候选源码、版本、锁文件和文档，并完成 [发布前检查](docs/operations/publishing.md) 与 [接入就绪检查](docs/integration/readiness.md)。

## 文档

- [文档索引](docs/index.md)与[项目元数据](docs/project.yaml)
- [公开契约](docs/api/public-contracts.md)与[架构边界](docs/architecture/dependencies.md)
- [HTTP 与 Runtime 契约](docs/packages/http-runtime-contract.md)
- [平台数据组件](docs/packages/platform-data-components.md)
- [主壳接入](docs/integration/main.md)与[子应用接入](docs/integration/app.md)
- [故障排查](docs/operations/troubleshooting.md)与[安全边界](docs/security/security-boundaries.md)
- [变更记录](CHANGELOG.md)与[Apache-2.0 许可证](LICENSE)
