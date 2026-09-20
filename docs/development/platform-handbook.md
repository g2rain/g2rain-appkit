# Main Shell 与子应用开发手册

- 状态：草案
- 日期：2026-09-19
- 设计依据：[Platform 前端应用运行与主子协作方案](../architecture/platform-framework.md)
- 适用：新建主应用或业务子应用，以及改造 `g2rain-main-shell`、`g2rain-manager-app`、`g2rain-department-app`、`g2rain-member-app`

`@g2rain/platform` 已在 appkit 落地包根契约、`/sub` 低层工厂和 `/main` 协调端口，但尚未发布。当前以 Member 与 Main Shell 的真实接入完成整体验证；验证期间通过 `npm pack` 使用 `createMainPlatform` / `createSubPlatform`，不在业务仓库里再实现一套 Kernel。只有验证通过后才发布包，页面和 Store 的所有权始终不变。

## 1. 先分清改哪里

| 要做的事 | 改 Main Shell | 改子应用 | 不改 |
| --- | --- | --- | --- |
| 打开、切换、关闭页面 | 是 | 否 | 子应用不决定 Tab 是否存在 |
| qiankun `loadMicroApp`、容器、运行名 | 是 | 否 | 子应用不调用 `loadMicroApp` |
| 同一 `instanceId` 的 mount/update/destroy 排队 | 是 | 否 | |
| 本次挂载的 Vue、Router、`afterEach` | 否 | 是 | 壳不保存这些对象 |
| Pinia、HTTP Client、Token Store | 否 | 是，整份 JS 只建一次 | 不按 Tab 各建一份 |
| `tokenExpired` 监听的引用计数 | 否 | 是，留在应用 `runtime/boot` | 不放进 Platform |
| 业务页面、领域 API、SSO 跳转地址 | 否 | 是 | Platform 不生成 |

壳的 `RuntimeStore.instances` 和子应用内部的 `Map<instanceId, Scope>` 可以用同一个 `instanceId`。前者记录实例在不在、是 `mounted` 还是 `inactive`。后者只记录这次 `mount` 创建的 Vue、Router 和监听。两者不互相回写。

## 2. 标识

三个字段不要再塞进同一个 `appKey`：

| 字段 | 含义 | 当前代码里大概是 |
| --- | --- | --- |
| `applicationCode` | 应用稳定标识 | Main Shell `AppDefinition.name`，子应用 `VITE_APPLICATION_CODE` |
| `viewId` | 工作区里打开的一个页面 | 现有 `tab.key` / `menuItem.key` |
| `instanceId` | 一次运行实例 | 现有 `RuntimeInstance.instanceId`，通常等于 `tab.key` |

第一阶段允许三个值暂时相等，但类型和 props 字段必须分开。旧 props 仍可能只有 `appKey`。子应用解析时使用：

```ts
const instanceId = props.instanceId ?? props.appKey
const viewId = props.viewId ?? props.appKey
```

主应用补齐新字段后，删除把 `appKey` 当作实例键的写法。菜单键只留在 `menuKey` / `viewId`，不再当作应用编码。

Token、Token Kid、私钥和完整用户资料不进入 `RuntimeContext`、日志和错误对象。它们只在应用的 Auth Bridge 里瞬时使用。

## 3. Main Shell

### 3.1 必须保持的行为

这些已经在 `g2rain-main-shell` 里，新建或改造时不要推翻：

- `RuntimeStore.instances` 是「有哪些实例、状态是什么」的唯一事实来源。
- 每个 `instanceId` 一条操作队列，mount、update、unmount、destroy 串行，并等待完成。
- qiankun 运行名使用 `` `${applicationCode}__${instanceId}` ``，`singular: false`，每个实例一个容器。
- qiankun `MicroApp` handle 只放在 RuntimeAdapter 的私有 Map，例如 `microApps`。不要把 handle 放进 Platform 或传给子应用协议。
- 切走 Tab：只把 `RuntimeInstance.status` 改为 `inactive`，不调用子应用 `unmount`。子应用的 Vue 继续挂着。
- 关闭 Tab：先让 Adapter `unmount` 子应用，再删 handle，再从 `RuntimeStore` 删除实例，最后删工作区视图。
- 登出或 `clear()`：先对所有实例走销毁，再清空 `instances` 和操作队列。禁止先 `instances.clear()` 留下 qiankun handle。

当前要修、还没修的两点：

- `QiankunManager.updateInstanceProps` 必须 `await microApp.update()`，并把这次 update 放进该 `instanceId` 的队列。现在语言同步使用 `void updateInstanceProps`，在队列外。
- `RuntimeStore.clear()` 只清了 Map 和队列，没有先 `destroyApp`。

### 3.2 新建主应用时的组合根

主应用继续拥有布局、Workspace、RuntimeStore 和 qiankun Adapter。Platform 只提供端口，不提供 `loadMicroApp` 封装。

```ts
import { createMainPlatform } from '@g2rain/platform/main'

const platform = createMainPlatform({
  runtimePort: {
    async updateInstanceProps(instanceId, props) {
      // 委托现有 RuntimeStore 队列和 QiankunAdapter
    },
    emit(message) {
      // 委托现有窗口消息适配器
    },
  },
})
```

传给子应用的公开 props 只包含 `applicationCode`、`viewId`、`instanceId`、`locale`、`initialRoute`、`activeRule`、`entryOrigin`。Token 走单独的认证载荷，不并进公开 Context。当前壳不传 theme。

### 3.3 改造 `g2rain-main-shell`

按这个顺序改，改完一档再做下一档：

1. 身份字段。`src/platform/types/app.type.ts` 的 `appKey` 不再表示应用编码；`name` 对应 `applicationCode`。`src/platform/types/runtime.type.ts` 增加独立的 `viewId`，不要用嵌入的 `AppDefinition` 快照当定义来源。MicroApp Store 以 `applicationCode` 为键；同一应用多条菜单的 `entry` 或 `contextPath` 冲突时，初始化直接失败。
2. 挂载 props。`src/platform/stores/runtime.store.ts` 里组装 props 时拆开公开字段和 Token 载荷。子应用仍可读旧 `appKey`，但新字段必须同时传。
3. update 队列。`src/platform/apps/qiankun/app.qiankun.ts` 的 `updateInstanceProps` 改为等待 `microApp.update()`，并由 `runtime.store` 的 `enqueueMicroInstanceOp` 调用。
4. 销毁顺序。`TabBar` 关闭 Tab 和 `RuntimeStore.clear` 都走「unmount handle → 删除 RuntimeInstance → 删除视图」。
5. 接入 `createMainPlatform`。只替换端口实现，不把 `src/shell/layout/TabBar.vue` 或 RuntimeStore 搬进 Appkit。

不要在这次改造里新增 `g2rain:main-app:theme-changed`。主应用主题仍写 `documentElement` 的 `data-theme`，取值保持 `light`、`dark`、`g2rain`。

## 4. 子应用

### 4.1 一份 JavaScript，多次 mount

Main Shell 对同一个 `entry` 多次 `loadMicroApp`。qiankun 2.10 的 ProxySandbox 只代理 `window`，Vite 的 `type="module"` 不会因此重新执行。`renderWithQiankun` 注册的 `mount` / `unmount` 只有一组，会被不同 props 反复调用。

因此：

- `createSubPlatform` 在模块里调用一次。
- 不同 `instanceId` 可以同时处于 mounted。
- 同一个 `instanceId` 还挂着时再次 `mount`，必须报错。
- 该 `instanceId` 完成 `unmount` 之后可以再 `mount`，要新建 Vue 和 Router。
- 切 Tab 不会进来。只有壳销毁实例时才会调用 `unmount`。

### 4.2 会话资源和实例资源

| 资源 | 创建 | 释放 |
| --- | --- | --- |
| Pinia、HTTP Client、Token Store | 组合根一次 | 不跟单个 Tab |
| `tokenExpired` 监听 | 应用 `runtime/boot`，引用计数 | 最后一个使用者退出才停 |
| Vue、Router、`router.afterEach` | 每次 `mount(instanceId)` | 只在 `unmount(instanceId)` |
| 写入共享 Token Store 的 `TOKEN_RESPONSE` 处理器 | Definition 上注册一次 | 不随单个 Tab 摘掉 |

不要在 `createApplication` 里 `createPinia()`。不要在某个 Tab 的 `unmount` 里 `disposeAll` HTTP Client，也不要在那里把 Token 监听直接停掉。

`g2rain-manager-app` 的现有计数就是这个边界，改造时保持语义，不要推广成通用注册表：

- 加一：`src/main.ts` 的 `render` 调用 `setupTokenExpiredWatcher()`
- 计数和停监听：`src/runtime/boot/index.ts`
- 减一：`src/platform/apps/adapter.qiankun.ts` 的 `unmount` 调用 `teardownTokenExpiredWatcher()`

### 4.3 入口形状

qiankun 生命周期仍由应用导出。Platform 不提供 `/sub/qiankun`，也不提供独立模式 Bridge。

```ts
import { createPinia } from 'pinia'
import { createStandardSubPlatform } from '@g2rain/platform/sub'

const pinia = createPinia()

const definition = createStandardSubPlatform({
  applicationCode,
  createApplication(context) {
    const app = createApp(App)
    const router = createAppRouter(context)
    app.use(pinia)
    app.use(router)
    return {
      mount: container => app.mount(container),
      unmount: () => app.unmount(),
    }
  },
  i18n: { engine },
  error: {},
})

export async function mount(props: AppQiankunProps) {
  const instanceId = props.instanceId ?? props.appKey
  if (!props.container || !instanceId) {
    throw new Error('qiankun mount: container 或 instanceId 缺失')
  }
  await definition.mount({
    instanceId,
    context: toPublicContext(props, instanceId),
    container: props.container,
  })
}

export async function update(props: AppQiankunProps) {
  await definition.update(props.instanceId ?? props.appKey, toPublicPatch(props))
}

export async function unmount(props: AppQiankunProps) {
  await definition.unmount(props.instanceId ?? props.appKey)
}
```

`toPublicContext` 不得拷贝 `token`、`tokenKid`、`client`。这些交给 Auth Bridge，写入已经存在的 Token Store。

独立模式由应用 `main.ts` 自己读环境、选 `#app`，再调用同一个 `definition.mount` / `unmount`。不要做第二条启动内核。

路由表、资源接口和 SSO 跳转仍写在应用里。Preset 不是第二个 `main.ts`。

### 4.4 改造 manager-app 与 department-app

这两个应用的生命周期目前是同一份结构，一起改：

1. 保留 `src/platform/stores/setup.ts` 的模块级 Pinia，不要改成每次 `render` 新建。
2. 用 Sub 的 `Map<instanceId, Scope>` 替换 `src/runtime/micro-shells.ts`。应用入口不再自己存一份 Vue/Router Map。键从 `props.appKey` 迁到 `instanceId`。
3. `src/platform/apps/adapter.qiankun.ts` 的 `mount` 继续先校验容器和实例键，再初始化 Token、语言和资源路由，最后 `app.mount`。`router.afterEach` 必须登记到该 `instanceId` 的释放函数，`unmount` 时摘掉。
4. 删除 `window.__QIANKUN_PROPS__`。`unmount` 只使用本次 props 里的 `instanceId`，解析不到就失败返回，不要用全局 props 猜实例。
5. `TOKEN_RESPONSE` 处理器继续写共享 Token Store，不要按 Tab 拆。路由类监听按 `instanceId` 拆。
6. `tokenExpired` 计数留在 `src/runtime/boot/index.ts`。

`g2rain-member-app` 按同一清单改。它是 Platform 包的试点应用，不单独发明第三套生命周期。

### 4.5 主题、语言、错误

- 集成模式不写 `documentElement`，不删除主应用的 `data-theme`，也不监听 `g2rain:main-app:theme-changed`。样式靠继承。
- 独立模式若使用 `@g2rain/theme`，只写 `data-g2-theme`，取值 `light` 或 `dark`。这和主应用的 `data-theme` 不是同一套属性，不要在子应用里互相覆盖。
- 语言由主应用 props 的 `locale` 驱动，写入应用已有的 Locale Store。UI 框架的 Locale 由应用自己的 Adapter 同步，Platform 不导入 Element Plus。
- 错误提示、登录跳转和监控上报通过注入的 Presenter、Action Handler、Reporter 完成。Platform 不内置 IAM 地址。Reporter 失败不能吞掉原来的业务异常。

## 5. 不要做的事

- 不要在子应用里复制 `RuntimeStore`、Tab 列表或 `loadMicroApp`。
- 不要假设每个 qiankun handle 有一份独立的子应用模块。按「一份 JS、多次 mount」开发。
- 不要在切 Tab 时卸载子应用。
- 不要把 Token 放进公开 Context，也不要写进 `window` 全局 props。
- 不要为了接 Platform 把业务路由、SSO 和 Mock 搬进公共包。
- 不要新增只给 Agent 用的验证脚本。改造是否完成，用下面的手工检查。

## 6. 建议的改造顺序

1. 先改 Main Shell 的 props 字段、update 队列和 `clear` 销毁顺序。子应用继续接受旧 `appKey`。
2. 再改 manager-app 或 department-app 其中一个，走通两个 Tab 同时打开、切走不卸载、关闭一个不影响另一个。
3. 另一个业务应用按同一 diff 改，避免两套入口再次分叉。
4. `@g2rain/platform` 发布后，把入口换成 `createMainPlatform` / `createSubPlatform`，删除应用内手写的 Scope Map。
5. 最后改模板和 CLI，使新项目直接生成符合第 3、4 节的组合根。

## 7. 做完如何判断

主应用：

- 同一应用开两个页面，qiankun 名不同，容器不同，两个都保持挂载。
- 切走其中一个，子应用 `mount` 次数不增加，`unmount` 不被调用，页面仍在。
- 关闭其中一个，另一个仍能发请求、改路由、收到 Token 消息。
- 切换语言时，`microApp.update()` 在该实例队列内被等待。
- 登出后不残留 qiankun handle。

子应用：

- 两个 `instanceId` 各有自己的 Vue 和 Router，共用一份 Pinia 和 HTTP Client。
- 关闭第一个实例后，Token 监听仍在；两个都关闭后，监听才停。
- 同一 `instanceId` 再次 `mount` 前必须已经 `unmount`。再次挂载后，`afterEach` 只有一条。
- 公开 Context 和日志里没有 Token。
- 独立模式和 qiankun 模式走同一组 `definition.mount` / `unmount`。
