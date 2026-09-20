# G2rain 前端公共 npm 包与主题架构方案

## 当前实现状态

2026-09-18 补充：Theme/UI 已按确认记录为试点闭环；HTTP 已在 `g2rain-member-app` 完成制品接入、真实验证和本地兼容组件清理，记录为试点通过。应用专属的 Client 注册表、Mock、IAM Key、Loading 组合和刷新协调仍保留在应用 runtime，公共请求内核由 `@g2rain/http` 提供。详细配置见 [HTTP 包说明](packages/http/README.md)。

截至 2026-09-19，npm workspace、四个包目录和 Playground 已建立。`@g2rain/theme`、`@g2rain/ui`、`@g2rain/http` 与 `@g2rain/platform` 均已具备首版实现。Platform 提供共享契约、Sub 生命周期 Kernel、Loading、Theme、微应用消息 Adapter 与权限 Provider；HTTP 包提供 Axios Client 工厂、语义化参数序列化、标准错误、Token 刷新单航班、DPoP 纯签名与资源释放。`http` 与 `platform` 互不依赖，由应用组合根装配。Token、登录行为、环境地址和权限数据均由应用注入。

接入分档：库内阶段一已通过，当前统一处于 `g2rain-member-app` 验证期。Theme/UI/HTTP 的局部试点结论不等同于 Appkit 可发布；必须完成 Member 独立运行、qiankun 集成及 Platform 主子协作的整体验证，才会发布任何 `@g2rain/*` 包。验证期仅使用 `npm pack` 制品，不发布到 npm Registry。详见 [`docs/development/integration-readiness.md`](docs/development/integration-readiness.md) 与 [`CHANGELOG.md`](CHANGELOG.md)。

## 1. 背景

当前 G2rain 的多个前端应用以独立 Git 仓库维护，包括：

- `g2rain-app-template`
- `g2rain-cms-app`
- `g2rain-department-app`
- `g2rain-infra-app`
- `g2rain-manager-app`
- `g2rain-member-app`

这些应用统一采用 Vue 3、Vite、Element Plus、TypeScript 和 qiankun。现有的 `QueryForm`、`TableSort`、`RemoteSelect`、HTTP、权限、错误处理、Loading 和微应用通信等代码，主要通过项目间复制传播。

复制方式会产生以下问题：

- 修复缺陷时需要同步修改多个仓库。
- 相同组件逐渐产生不可控的实现差异。
- 新应用模板持续复制旧版本代码。
- 主题、交互规范和基础能力难以统一升级。
- 无法明确表达公共能力的兼容范围和版本关系。

本方案将公共能力抽取为独立 npm 包，通过语义化版本进行发布和升级，同时保留各应用独立开发、构建和部署的模式。

## 2. 目标与非目标

### 2.1 目标

- 公共组件和基础能力只有一个事实来源。
- 各应用通过 npm 依赖选择升级时间，不强制同步发布。
- 支持应用独立运行和 qiankun 集成运行。
- 支持统一亮色、暗色和客户品牌主题。
- 避免公共包依赖具体应用的 Store、API、路由和目录别名。
- 新建应用默认使用公共包，不再复制公共实现。

### 2.2 非目标

- 不把 `D:\github` 下的所有独立仓库合并为一个 Monorepo。
- 不在第一阶段一次性迁移所有公共代码。
- 不把业务页面或特定领域 API 放入公共组件包。
- 不要求所有应用在同一时间升级公共包版本。

## 3. 总体方案

新建独立仓库 `g2rain-appkit`。仓库内部使用 npm workspaces 管理多个可独立发布的包：

```text
g2rain-appkit/
├─ package.json
├─ package-lock.json
├─ README.md
├─ packages/
│  ├─ theme/
│  ├─ ui/
│  ├─ http/
│  └─ platform/
└─ examples/
   └─ playground/
```

包之间采用单向依赖；`http` 与 `platform` 并行，不形成包级硬依赖：

```text
@g2rain/theme
      ↑
@g2rain/ui
      ↑
业务应用 / g2rain-app-template

@g2rain/http  ←── 业务应用 ──→  @g2rain/platform
                                   （主题 CSS 由应用显式引入 theme）
```

建议的包职责如下：

| 包 | 职责 | 不应包含 |
| --- | --- | --- |
| `@g2rain/theme` | 设计变量、亮暗主题、Element Plus 变量映射、基础样式 | Vue、Pinia、业务 API、qiankun |
| `@g2rain/ui` | 通用 Vue 组件和组合式函数 | 具体应用 Store、路由、业务接口 |
| `@g2rain/http` | HTTP Client、参数序列化、错误模型、签名和可复用拦截器 | 应用环境读取、具体 Token Store、业务 Mock 数据 |
| `@g2rain/platform` | 共享契约、Sub 生命周期、权限插件、Loading 协调、微应用通信、主题切换 | 业务页面、领域 API、Main Shell Store |

`@g2rain/platform` 是前端应用运行与主子协作 SDK：包根导出共享协议，`/sub` 提供框架无关生命周期，`/main` 提供协调端口；两侧尚待在 Main Shell 与 Member 的真实运行链路中联合验证。Vue、Pinia、Router、qiankun 和应用启动继续由 Main Shell 或业务应用拥有。Runtime 只作为内部 Kernel 概念，不另发布包，也不提供兼容入口。详见 [`docs/architecture/platform-framework.md`](docs/architecture/platform-framework.md)。

## 4. 仓库与 npm workspace 配置

根目录 `package.json`：

```json
{
  "name": "g2rain-appkit",
  "private": true,
  "workspaces": [
    "packages/*",
    "examples/*"
  ],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "pack:check": "tsx scripts/check-package-artifacts.ts"
  }
}
```

根包设置为 `private: true`，防止误发布。`packages` 下各子包单独维护名称和版本。

## 5. `@g2rain/theme` 主题方案

### 5.1 包结构

```text
packages/theme/
├─ package.json
└─ src/
   ├─ styles.css
   ├─ tokens.css
   ├─ element-plus.css
   ├─ base.css
   └─ themes/
      ├─ light.css
      └─ dark.css
```

### 5.2 设计变量

主题变量使用 G2rain 自己的语义命名，不让业务组件直接依赖 Element Plus 的变量名称：

```css
:root {
  --g2-color-primary: #409eff;
  --g2-color-success: #67c23a;
  --g2-color-warning: #e6a23c;
  --g2-color-danger: #f56c6c;

  --g2-text-primary: #303133;
  --g2-text-regular: #606266;
  --g2-bg-page: #f5f7fa;
  --g2-bg-container: #ffffff;
  --g2-border-color: #dcdfe6;

  --g2-font-size-base: 14px;
  --g2-border-radius-base: 4px;
  --g2-space-sm: 8px;
  --g2-space-md: 16px;
  --g2-space-lg: 24px;
}
```

变量应优先表达用途，例如“页面背景”和“主要文字”，避免只使用 `blue-500` 之类的具体颜色名称。这样切换暗色或客户品牌主题时，组件代码无需变化。

### 5.3 Element Plus 映射

```css
:root {
  --el-color-primary: var(--g2-color-primary);
  --el-color-success: var(--g2-color-success);
  --el-color-warning: var(--g2-color-warning);
  --el-color-danger: var(--g2-color-danger);
  --el-text-color-primary: var(--g2-text-primary);
  --el-text-color-regular: var(--g2-text-regular);
  --el-border-color: var(--g2-border-color);
  --el-border-radius-base: var(--g2-border-radius-base);
  --el-font-size-base: var(--g2-font-size-base);
}
```

G2rain 变量是平台主题契约，Element Plus 变量只是适配层。后续升级或替换 UI 框架时，不需要修改全部业务样式。

### 5.4 亮色与暗色主题

```css
:root,
:root[data-g2-theme='light'] {
  color-scheme: light;
  --g2-bg-page: #f5f7fa;
  --g2-bg-container: #ffffff;
  --g2-text-primary: #303133;
}

:root[data-g2-theme='dark'] {
  color-scheme: dark;
  --g2-bg-page: #141414;
  --g2-bg-container: #1d1e1f;
  --g2-text-primary: #e5eaf3;
}
```

主题切换通过根节点属性完成，但修改 DOM 的能力属于 `@g2rain/platform/theme`，不放入 CSS-only 的主题包：

```ts
const theme = createThemeController()
theme.setTheme('dark')
const unsubscribe = theme.subscribe(current => console.log(current))
```

### 5.5 主题包发布配置

```json
{
  "name": "@g2rain/theme",
  "version": "0.1.0",
  "type": "module",
  "files": [
    "dist"
  ],
  "exports": {
    "./styles.css": "./dist/styles.css",
    "./base.css": "./dist/base.css",
    "./tokens.css": "./dist/tokens.css",
    "./element-plus.css": "./dist/element-plus.css",
    "./light.css": "./dist/themes/light.css",
    "./dark.css": "./dist/themes/dark.css"
  },
  "sideEffects": [
    "**/*.css"
  ]
}
```

默认入口同时加载 tokens、亮色、暗色、Element Plus 映射和基础样式。应用显式引入主题，公共 UI 包不应隐式修改全局样式：

```ts
import '@g2rain/theme/styles.css'
import '@g2rain/ui/style.css'
```

具体输出路径和构建规则见 [`docs/development/build-and-test-contract.md`](docs/development/build-and-test-contract.md)。

## 6. `@g2rain/ui` 组件方案

### 6.1 第一批组件

第一版建议迁移依赖较少、复用价值较高的组件：

- `QueryForm`
- `TableSort`
- `RemoteSelect` 基础组件
- `ApiSelect`

带组织、字典或状态语义的组件从 `@g2rain/ui/platform` 导入，不进入根入口：

- `DictSelect`
- `OrganSelect`
- `DictText`
- `StatusSwitch`

这三个组件已完成能力注入改造；各应用入口提供组织策略、字典查询和状态提交，User 等实体将沿用相同 Provider 契约逐步组件化。

各组件不能整目录选取单一 App 版本；规范来源、公开 Props、事件、Slots 和 Expose 以 [`docs/packages/component-migration-baseline.md`](docs/packages/component-migration-baseline.md) 为准。

### 6.2 组件约束

公共组件不得导入以下应用内路径：

```text
@/views/**
@platform/**
@runtime/**
@shared/**
```

需要的能力通过 Props、Slots、事件、Provider 或工厂参数传入。例如远程选择组件通过函数获取数据：

```vue
<script setup lang="ts">
import { DictSelect } from '@g2rain/ui/platform'
</script>

<DictSelect
  usage-code="user_status"
  :api-method="dictApi.list"
/>
```

平台级能力可以通过插件注入：

```ts
export interface G2rainUiOptions {
  locale?: () => string
  translate?: (key: string) => string
}
```

```ts
app.use(G2rainUi, {
  locale: () => localeStore.locale,
  translate: key => i18n.global.t(key),
})
```

### 6.3 包配置

```json
{
  "name": "@g2rain/ui",
  "version": "0.1.0",
  "type": "module",
  "files": [
    "dist"
  ],
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./style.css": "./dist/style.css"
  },
  "sideEffects": [
    "*.css"
  ],
  "peerDependencies": {
    "@element-plus/icons-vue": "^2.3.0",
    "@g2rain/theme": "^0.1.0",
    "element-plus": "^2.13.0",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@element-plus/icons-vue": "^2.3.0",
    "@vitejs/plugin-vue": "^6.0.3",
    "element-plus": "^2.13.0",
    "typescript": "5.9.3",
    "vite": "^7.3.0",
    "vue": "^3.5.26",
    "vue-tsc": "3.2.1"
  }
}
```

### 6.4 组件导出

```ts
export * from './query-form'
export * from './table-sort'
export * from './remote-select'
```

对外只允许从稳定入口导入，不保证内部文件路径兼容。通用组件从包根导入，平台数据组件从 `@g2rain/ui/platform` 导入：

```ts
import {
  QueryForm,
  RemoteSelect,
  SortableTable,
  TableColumn,
} from '@g2rain/ui'
import { OrganSelect, DictText, StatusSwitch } from '@g2rain/ui/platform'
```

## 7. `@g2rain/http` 和 `@g2rain/platform`

### 7.1 HTTP 包

`@g2rain/http` 可包含：

- HTTP Client 类型和创建工厂。
- 参数序列化与请求体处理。
- DPoP 等通用签名能力。
- 通用错误类型和错误标准化。
- 可组合的基础拦截器。

应用专属内容不进入该包：

- `import.meta.env` 的直接读取。
- 具体 AccessToken Store。
- 具体登录跳转行为。
- 资源 JSON 和业务 Mock 数据。
- 具体 API Endpoint。

推荐通过工厂参数装配：

```ts
const { client, dispose } = createHttpClient({
  baseURL: runtimeConfig.apiBaseUrl,
  authSessionProvider: () => accessTokenStore.session,
  ensureAccessToken: options => accessTokenStore.ensure(options),
  authErrorHandler: (reason, error) => authService.handleFailure(reason, error),
  getLocale: () => localeStore.locale,
})
```

### 7.2 Platform 包

`@g2rain/platform` 当前包含：

- 包根共享契约：`RuntimeContext`、`RuntimeMessage`、`PlatformError`。
- `/sub` 的 `createSubPlatform`、Scope 与 Capability 生命周期。
- 权限 Provider 和 Vue 插件（仅 `./permission`）。
- 全局 Loading 协调。
- 微应用事件类型和浏览器 Event Adapter。
- 主题 Controller。

包根和 Kernel 不导入 Vue。具体 Store、qiankun lifecycle 和独立启动仍由应用维护。`/main` 协调端口与标准 Preset 已在库内实现，尚待在 Main Shell 与 Member 的真实运行链路中验证。

HTTP 工厂、错误模型、刷新单航班、主题 Controller 和消息 Adapter 的精确签名见 [`docs/packages/http-runtime-contract.md`](docs/packages/http-runtime-contract.md)。

## 8. qiankun 主题协作

主应用 `g2rain-main-shell` 是集成模式下的主题所有者：

1. 主应用读取用户主题偏好。
2. 主应用设置 `document.documentElement.dataset.g2Theme`。
3. 主应用通过微应用消息机制广播主题变更。
4. 子应用被 qiankun 加载时服从主应用主题。
5. 子应用独立运行时自行读取和初始化主题。
6. 子应用卸载时只清理自己的监听器，不删除主应用设置的根主题属性。

同一页面中的 CSS 自定义变量可以被微应用继承，适合当前 qiankun 架构。各子应用不得在集成模式下使用不同值覆盖 `:root` 主题变量。

建议增加统一消息：

```ts
export type ThemeChangedMessage = MicroAppMessage<
  MicroAppEventType.THEME_CHANGED,
  { theme: 'light' | 'dark' }
>
```

消息沿用现有 `MicroAppMessage.data` 信封，不增加 `payload` 字段。

## 9. 发布策略

### 9.1 npm Registry

当前应用仓库使用 Apache-2.0 且 `private: false`，优先考虑发布到公开 npm Registry：

```bash
npm publish --workspace @g2rain/theme --access public
npm publish --workspace @g2rain/ui --access public
```

如果公共包暂时不能公开，可改用 GitHub Packages。私有 Registry 会要求开发者环境和 CI 配置读取 Token，应在确定有保密需求时采用。

### 9.2 版本规则

遵循语义化版本：

- Patch：兼容性缺陷修复，例如 `0.1.1`。
- Minor：兼容性新组件或新参数，例如 `0.2.0`。
- Major：不兼容 API 调整，例如 `1.0.0` 到 `2.0.0`。

在 `1.0.0` 之前，业务应用建议使用 `~` 范围：

```json
{
  "dependencies": {
    "@g2rain/theme": "~0.1.0",
    "@g2rain/ui": "~0.1.0"
  }
}
```

稳定后可以改用 `^1.0.0`。公共包的 Breaking Change 必须包含迁移说明。

### 9.3 发布校验

正式发布前至少执行：

1. TypeScript 类型检查。
2. 单元测试。
3. 生产构建。
4. `npm pack` 检查压缩包文件清单。
5. 在 Playground 安装打包产物并构建。
6. 验证一个真实子应用的独立模式和 qiankun 模式。

## 10. 迁移计划

### 阶段一：建立主题和基础 UI

1. 初始化 `g2rain-appkit` npm workspace。
2. 创建 `@g2rain/theme@0.1.0`。
3. 定义第一版设计变量和 Element Plus 映射。
4. 迁移 `QueryForm` 和 `TableSort`。
5. 迁移 `RemoteSelect` 基础组件，移除应用内别名依赖。
6. 使用 `npm pack` 在一个试点应用中验证。

代码生成必须满足 [`docs/development/build-and-test-contract.md`](docs/development/build-and-test-contract.md) 的制品布局和完成条件。

推荐 `g2rain-member-app` 作为首个迁移试点。

### 阶段二：Member 整体验证

1. 使用 `npm pack` 制品在 `g2rain-member-app` 验证 Theme、UI、HTTP 与 Platform 的组合。
2. 完成 Member 的独立运行、qiankun 挂载、卸载和重新挂载验证，并由 Main Shell 验证主子协作。
3. 验证期间不发布任何 `@g2rain/*` 包，也不要求其他业务 App 提前迁移。
4. 仅在整体验证通过后，发布各包并再逐步迁移其他业务 App、模板和 CLI。

### 阶段三：发布与推广

1. 整体验证通过后，按 `theme → ui / http / platform` 的顺序发布 npm 包。
2. `packages/platform` 已直接改名完成，不建立兼容包。
3. 逐个应用迁移；应用内部可以短期保留组合适配，但不得依赖已删除的旧工作包名。
4. 修改 `g2rain-app-template` 与 `g2rain-app-cli`，让新项目默认使用已发布的公共包。

## 11. 兼容与回滚策略

- 每个应用独立决定公共包升级时间。
- 首次迁移尽量保持组件名称、Props 和事件不变。
- 迁移时可以临时保留原导出路径，由本地 `index.ts` 转发到 npm 包。
- 出现问题时通过回退 `package.json` 和 lockfile 中的版本进行恢复。
- 不使用 `npm link` 作为正式验收方式，优先使用 `npm pack`，使验证行为更接近真实发布包。
- 新旧实现并存期间，应明确唯一调用入口，避免同一应用同时加载两套全局插件。

兼容转发示例：

```ts
export {
  QueryForm,
  SortableTable,
  TableColumn,
} from '@g2rain/ui'
```

## 12. 验收标准

分档门槛见 [`docs/development/integration-readiness.md`](docs/development/integration-readiness.md)。

**库内阶段一（已完成）应满足：**

- 四个包可以独立构建；含 JS 的包生成类型声明。
- npm 压缩包只包含必要的发布文件。
- 公共包源码不存在对具体应用目录别名的依赖。
- Playground 可组合验证 Theme / UI / Platform 主题能力。

**试点与平台闭环（尚未完成）还应满足：**

- 试点应用类型检查和生产构建通过。
- 试点应用独立运行与 qiankun 加载、卸载、重新加载正常。
- 亮色与暗色主题可以切换，Element Plus 与公共组件主题一致。
- 试点应用不再保留已迁移组件的源码副本。
- 新应用模板默认通过 npm 使用公共组件。

## 13. 关键决策

1. 保留各 App 独立仓库，仅将公共包仓库内部组织为 Monorepo。
2. 主题包位于依赖最底层，不依赖 Vue、Pinia 和 qiankun。
3. 公共 UI 使用 G2rain 语义变量，不直接硬编码品牌颜色。
4. 应用 Store、业务 API 和路由不进入公共 UI 包。
5. 主应用管理集成模式主题，子应用兼容独立运行。
6. 优先小范围迁移并发布，再逐步抽取 HTTP 和 Platform，避免一次性重构。
