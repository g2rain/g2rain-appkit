# 业务 App 接入

- 日期：2026-09-21
- 适用：新建业务 App，以及 `g2rain-member-app`、`g2rain-manager-app`、`g2rain-department-app`
- 工具：`create-g2rain-app`（源码仓库 `g2rain-app-cli`）
- 模板：`g2rain-app-template`，由 CLI 复制，不单独当业务项目安装
- 运行时入口：`@g2rain/platform/sub`

## 1. 安装

Registry 安装尚未提供。`@g2rain/*`、`create-g2rain-app` 和 `g2rain-app-template` 发版后的安装命令待补充。

下面是现在能用的装法。Node.js 需要 `>=22`。

### 1.1 公共包

在 `g2rain-appkit` 目录打包当前制品：

```bash
npm ci
npm run build --workspace @g2rain/theme
npm run build --workspace @g2rain/ui
npm run build --workspace @g2rain/http
npm run build --workspace @g2rain/platform
npm pack --workspace @g2rain/theme
npm pack --workspace @g2rain/ui
npm pack --workspace @g2rain/http
npm pack --workspace @g2rain/platform
```

当前文件名：

| 文件 | 包 |
| --- | --- |
| `g2rain-theme-0.1.0.tgz` | `@g2rain/theme` |
| `g2rain-ui-0.1.1.tgz` | `@g2rain/ui` |
| `g2rain-http-0.1.0.tgz` | `@g2rain/http` |
| `g2rain-platform-0.1.0.tgz` | `@g2rain/platform` |

把这四个文件放到业务 App 的 `kits/`，然后：

```bash
npm install ./kits/g2rain-theme-0.1.0.tgz ./kits/g2rain-ui-0.1.1.tgz ./kits/g2rain-http-0.1.0.tgz ./kits/g2rain-platform-0.1.0.tgz
```

`package.json` 使用 `file:kits/...`，不要写成仓外的 `file:../g2rain-appkit/...`。Docker 构建上下文里没有那个目录。

样式在应用入口引入：

```ts
import '@g2rain/theme/styles.css'
import '@g2rain/ui/style.css'
```

### 1.2 CLI

在 `g2rain-app-cli` 目录：

```bash
npm ci
npm run build
```

到目标父目录执行。两个命令相同：

```bash
node <g2rain-app-cli>/dist/index.js g2rain-order-app --context-path order
node <g2rain-app-cli>/dist/index.js create g2rain-order-app --context-path order
```

交互式省略参数即可。项目名和 Context Path 都给出时不再提问。Context Path 不要带前导斜杠；`g2rain-order-app` 省略该参数时默认为 `order`。

目标目录已存在会直接失败，不会覆盖。CLI 不执行 `npm install`，也不初始化 Git。

使用模板源仓而不是 CLI 包内快照时：

```powershell
$env:G2RAIN_TEMPLATE_PATH = 'D:\github\g2rain-app-template'
node <g2rain-app-cli>/dist/index.js g2rain-order-app --context-path order
```

已有 App 把 CLI 装成开发依赖，供 `generate` 和 `build-config` 使用：

```json
{
  "devDependencies": {
    "create-g2rain-app": "file:../g2rain-app-cli"
  }
}
```

`g2rain-member-app` 的资源配置脚本是：

```json
{
  "scripts": {
    "build:config": "node ./node_modules/create-g2rain-app/dist/index.js build-config"
  }
}
```

### 1.3 模板

不要把 `g2rain-app-template` 克隆下来当作业务 App。新建项目用上一节的 CLI。模板里的 `{{PROJECT_NAME}}` 和 `{{CONTEXT_PATH}}` 由 CLI 替换。

当前模板 `package.json` 仍引用 `file:../g2rain-appkit/` 下的压缩包，并且包含已经不存在的 `@g2rain/runtime`。生成后的项目不要沿用这些依赖，改成第 1.1 节的 `kits/` 安装，再执行 `npm install`。模板不复制 lockfile，第一次安装不要用 `npm ci`。

## 2. 新建后的命令

在生成出的项目根目录：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite |
| `npm run build` | `vue-tsc` 后构建 `dist` |
| `npm run preview` | 预览构建结果 |
| `npm run build:generate -- --tables=<表名>` | 按 `scripts/database.sql` 生成页面骨架 |
| `npm run build:config` | 写出页面和页面元素资源 JSON |

页面生成会覆盖 `src/views/<表名>/` 下的 `index.vue`、`api.ts`、`type.ts`、`mock.ts`，并更新 `src/views/route-map.ts`。执行前先看 Git 状态。

```bash
npm run build:generate -- --tables=dict
npm run build:generate -- --tables=dict,medicine_users
npm run build:generate -- --tables=dict --no-mock --no-route
```

也可以直接调用 CLI。在 App 根目录：

```bash
g2rain-app generate --tables=dict,medicine_users
g2rain-app build-config
```

`build-config` 写出：

- `src/shared/config-util/config/resources.json`
- `src/shared/config-util/config/pages.json`
- `src/shared/config-util/config/page-elements.json`

它不生成 `api-endpoints.json`，`resources.json` 里的 API 端点为空。改了路由或静态 `v-permission` 之后要重新执行。

## 3. 本地运行

独立运行。PowerShell：

```powershell
$env:VITE_RUN_MODE = 'alone'
$env:VITE_SERVER_PORT = '3001'
$env:VITE_BACKEND_ORIGIN = 'http://localhost:8080'
npm run dev
```

Bash：

```bash
VITE_RUN_MODE=alone VITE_SERVER_PORT=3001 VITE_BACKEND_ORIGIN=http://localhost:8080 npm run dev
```

也可以打开 `http://localhost:3001/?mode=alone`。未设置 `mode=alone` 时，直接访问开发地址会跳到 `VITE_MAIN_SHELL_ORIGIN` + `VITE_MAIN_SHELL_REDIRECT_PREFIX`。

和主应用联调时由主应用加载，子应用只启动开发服务器：

```powershell
$env:VITE_MAIN_SHELL_ORIGIN = 'http://localhost:3000'
$env:VITE_MAIN_SHELL_REDIRECT_PREFIX = '/main/redirect'
npm run dev
```

`VITE_APPLICATION_CODE` 填平台里的应用编码。`VITE_CONTEXT_PATH` 与部署时的 `CONTEXT_PATH` 使用同一个路径，例如 `/order`。

## 4. 入口

qiankun 的 `mount`、`update`、`unmount` 仍由应用导出。`createStandardSubPlatform` 在模块里调用一次。Pinia 和 HTTP Client 也在模块里创建一次，不要放进 `createApplication`。

```ts
import { createStandardSubPlatform, resolveSubHostProps } from '@g2rain/platform/sub'

const definition = createStandardSubPlatform({
  applicationCode,
  createApplication(context) {
    const app = createApp(App)
    const router = createRouter(context)
    app.use(pinia)
    app.use(router)
    return {
      mount: container => app.mount(container),
      update: next => router.replace(next.initialRoute ?? '/'),
      unmount: () => app.unmount(),
    }
  },
  i18n: { engine, uiLocale },
  error: { presenter, actions, unknownMessage: '未知错误' },
})

export async function mount(props) {
  const resolved = resolveSubHostProps(props, {
    applicationCode,
    contextPath,
  })
  await definition.mount({
    instanceId: resolved.instanceId,
    context: resolved.context,
    container: props.container,
  })
}

export async function update(props) {
  const resolved = resolveSubHostProps(props, { applicationCode, contextPath })
  await definition.update(resolved.instanceId, resolved.patch)
}

export async function unmount(props) {
  const resolved = resolveSubHostProps(props, { applicationCode, contextPath })
  await definition.unmount(resolved.instanceId)
}
```

`resolveSubHostProps` 接受当前主应用的 `instanceId`，也接受只有 `appKey` 的旧 props。`token`、`tokenKid`、`client` 从返回值的 `auth` 读取并写入应用自己的 Token Store，不要拷进 `definition.mount` 的 `context`。

独立模式在 `main.ts` 里调用同一个 definition。容器用 `#app`，`mode` 为 `standalone`：

```ts
await definition.mount({
  instanceId: 'standalone',
  context: {
    applicationCode,
    viewId: 'standalone',
    instanceId: 'standalone',
    mode: 'standalone',
    contextPath,
    theme: 'light',
  },
  container,
})
```

应用卸载时调用 `definition.unmount('standalone')`。不要再写一套独立启动流程。
