# Main Shell AI Coding 提示词

本文是给 AI Coding 助手的**可复制提示词**：用于新建或改造 G2rain Main Shell，并正确接入 appkit 的 `@g2rain/platform/main` 与 `@g2rain/http`。

| 文档 | 职责 |
| --- | --- |
| 中央 [Main Shell 契约](https://github.com/g2rain/g2rain/blob/main/docs/architecture/profiles/frontend-shell/main-shell-contract.md) | 必须 / 禁止、身份模型、生命周期、docs 最小树（规范事实来源） |
| [Main Shell 接入](main.md) | 人工执行的 `npm pack` 与接线步骤 |
| **本文** | 可直接粘贴给助手的任务提示词；冲突时以生成契约与中央 `frontend-shell` Profile 为准 |

使用方式：

1. 将下方「提示词正文」整段复制到助手对话（或 Cursor Rule / 任务首条消息）。
2. 替换 `{PROJECT_NAME}`、`{CONTEXT_PATH}`、`{PORT}`。
3. 将 appkit、中央 Profile、`g2rain-main-shell`、已接 `/sub` 的 `g2rain-member-app` 加入工作区。
4. 改造现有壳时，在提示词开头追加：「以现有 `g2rain-main-shell` 为基线改造，不要重写布局；优先闭合生成契约第 9 节缺口。」

契约或公开 API 变更后，应同步修订本文提示词，避免助手按过时约定生成。

---

## 提示词正文

````markdown
# 任务：生成 / 改造 G2rain Main Shell（frontend-shell）

你是实现 G2rain 微前端 **Main Shell** 的工程助手。目标仓库名：`{PROJECT_NAME}`（例如 `g2rain-admin-shell`）。
本任务验证并落地 **g2rain-appkit** 的 Main 侧能力：`@g2rain/platform/main` + `@g2rain/http`。
**禁止**用 `create-g2rain-app app` / `g2rain-app-template` 冒充 Shell（那是业务子应用 `frontend-app`）。新建 Shell 基线应使用 `create-g2rain-app shell`（模板源：`g2rain-shell-template`），或按本文与生成契约改造已有壳；不得复制 `g2rain-main-shell` 历史代码作为模板。

## 0. 开始前必读（按顺序，冲突时以上游为准）

1. 中央：`docs/architecture/profiles/frontend-shell/main-shell-contract.md`（本任务的不变式事实来源）
2. 中央：`frontend-shell` Profile + `shell-generation-policy.md`
3. appkit：`docs/integration/main.md`（安装与接线步骤）
4. appkit：`docs/packages/http-runtime-contract.md`
   （`https://github.com/g2rain/g2rain`，基线建议 `architecture-v1.2.0`）
5. 参考实现：`g2rain-main-shell`（权威壳结构；**不要复制其未接入 appkit 的旧行为**）
6. 子应用联调参考：已接 `@g2rain/platform/sub` 的 `g2rain-member-app`

公开 API 以 `@g2rain/platform`、`@g2rain/http`、`@g2rain/theme`、`@g2rain/ui` 的 `package.json#exports`、类型声明与包源码为准。
不得臆造第二套 props / 消息 type；不得深路径导入 `src`/`dist` 内部。

## 1. 项目参数（生成前填齐并写入 docs/project.yaml）

- name / applicationCode: `{PROJECT_NAME}`
- family: `frontend-shell`
- contextPath: `{CONTEXT_PATH}`（例如 `/admin`）
- devServerPort: `{PORT}`（例如 `3000`）
- 技术栈：Vue 3 + Vite + TypeScript + Pinia + Vue Router + qiankun + Element Plus + `@g2rain/theme` + `@g2rain/ui`
- 依赖（Registry 未发版前用本地 pack）：
  - `@g2rain/platform`（必须，入口 `/main`）
  - `@g2rain/http`（必须）
  - `@g2rain/theme`（必须，显式导入 `@g2rain/theme/styles.css`）
  - `@g2rain/ui`（必须，显式导入 `@g2rain/ui/style.css` 并在组合根安装 `G2rainUi`）
- 安装方式（必须写进文档）：
  ```bash
  # 在 g2rain-appkit
  npm ci
  npm run build --workspace @g2rain/http
  npm run build --workspace @g2rain/platform
  npm run build --workspace @g2rain/theme
  npm run build --workspace @g2rain/ui
  npm pack --workspace @g2rain/http
  npm pack --workspace @g2rain/platform
  npm pack --workspace @g2rain/theme
  npm pack --workspace @g2rain/ui
  # 拷到壳仓库 kits/ 后
  npm install ./kits/g2rain-http-*.tgz ./kits/g2rain-platform-*.tgz ./kits/g2rain-theme-*.tgz ./kits/g2rain-ui-*.tgz
  ```
- package.json 使用 `file:kits/...tgz`，**不以 npm link 作为验收依据**

## 2. 所有权边界（必须遵守）

### Shell 拥有
- 全局布局（Header / Sidebar / **可视化 TabBar / Workspace** / 微应用容器 DOM）
- Tab 状态与关闭策略：主/子应用都须通过 Tab 打开；切换只标记 inactive，关闭当前 Tab 优先激活右侧、否则左侧；关闭才执行 destroy
- 菜单与 Workspace 联动：点击任何可访问的 Shell 菜单或受控业务菜单，必须新增或激活对应 Tab（不得只替换 RouterView）；固定首页 Tab 不可关闭，其他主应用 Tab 可关闭并按同一回退策略处理
- 主题状态、`data-g2-theme` 根节点和偏好持久化（以 `@g2rain/platform/theme` 的 `createThemeController` 实现）；主题 CSS 来自 `@g2rain/theme`
- 在组合根安装 `G2rainUi`，提供翻译函数与 locale；平台数据组件只经 `@g2rain/ui/platform` Provider 注入数据能力
- `MicroAppDefinition`、`WorkspaceView`、`RuntimeInstance` 注册表
- 每 `instanceId` 生命周期队列（mount / update / unmount / destroy **串行**）
- RuntimeAdapter：qiankun `loadMicroApp`、handle、唯一运行名与 container
- Shell 路由、菜单、SSO、**Token Store**、登出与会话协调
- 壳侧 Token 落盘须按壳 `applicationCode` 命名空间（如 `g2rain-shell-token:${applicationCode}`），避免同 origin 多独立 Shell 冲突；实现留在壳，勿下沉 appkit
- Header 右侧的当前登录人和当前机构信息：从 Shell Session/SSO 状态读取并展示名称、账号/编码等非敏感摘要；会话未就绪时显示明确的未登录/未选择机构状态
- 初始菜单应首先提供 Shell 自身能力说明（例如概览、工作区/Tab、平台能力接入）；业务子应用菜单只能来自受控的菜单/部署配置，未配置时不得硬编码本机 `localhost` entry 或展示无法打开的占位业务入口
- HTTP Client 单例表、Mock、Base URL、刷新屏障等应用层装配（放在 `src/runtime/http`）
- Nginx / 环境配置 / 静态资源

### `@g2rain/platform/main` 拥有（只能用它，不要重写一份）
- 公开 props 快照：`buildPublicProps` / `updatePublicContext`
- 定向消息：`emitToInstance`、`notifyLocale`、`notifyAuthInvalid`、`releaseInstance`

### `@g2rain/http` 拥有
- Client 工厂、序列化、DPoP 纯函数、标准错误模型、通用拦截器能力
- 通过工厂参数接收壳注入的：`authSessionProvider` / `ensureAccessToken` / `authErrorHandler`

### 明确禁止下沉到 platform / http
- Vue / Pinia / Vue Router / Element Plus / Shell UI / 主题偏好持久化 / 业务数据 Provider
- `loadMicroApp` / qiankun handle / RuntimeStore / 菜单 / Tab / **Token Store**
- 子应用业务规则、领域 API、权限判定权威

## 3. 分层与依赖方向

```text
shared → components → platform → runtime → views / shell
组合根：src/main.ts、src/App.vue 可装配各层
```

强制：
1. 不写子应用业务规则进 Shell
2. 不新增 `components → platform/runtime`、`platform → runtime` 反向依赖；已有偏差登记且不得作范例
3. 跨模块只从稳定 `index.ts` 导入
4. 只从 `@g2rain/platform` / `@g2rain/http` 的 exports 入口导入
5. Token / Token Kid / 私钥 / 生产 Secret **不得**进入源码、Mock、公开 props、URL、持久日志；`theme` 也不得进入 Main Public Props，集成子应用继承 Shell 根节点主题
6. Token Store 与消息换票留在壳，**不得**下沉进 `@g2rain/http` 或 `@g2rain/platform`

## 4. 身份模型（禁止混用语义）

| 字段 | 含义 | 所有者 |
| --- | --- | --- |
| applicationCode | 子应用稳定标识 | MicroAppDefinition |
| viewId | 工作区打开的视图（Tab） | Shell Workspace |
| instanceId | 一次运行实例唯一键 | RuntimeInstance |

规则：
- `appKey === instanceId`（固定）
- 挂载时必须同时显式下发 `applicationCode`、`viewId`、`instanceId`
- 菜单定义至少稳定传递：`appKey`/`name`/`entry`/`activeRule`/`instanceId`
- `entry` 只允许可信来源，禁止未校验 URL 参数直接控制

## 5. Platform Main 接线（必须按此实现）

在组合根 **只创建一次**：

```ts
import { createMainPlatform } from '@g2rain/platform/main'

const platform = createMainPlatform({
  runtimePort: {
    async updateInstanceProps(instanceId, props) {
      // 必须 await qiankun microApp.update()，并纳入该 instanceId 操作队列
      await qiankunAdapter.updateInstanceProps(instanceId, props)
    },
    emit(message) {
      eventAdapter.emit(message)
    },
  },
})
```

禁止在 platform 内再包一层 `loadMicroApp`。

| 时机 | 必须调用 |
| --- | --- |
| 打开 / 首次挂载 | `buildPublicProps` → `loadMicroApp({ props })` |
| 语言或初始路由变化 | `notifyLocale` 和/或 `updatePublicContext` |
| 认证失效通知该实例 | `notifyAuthInvalid(instanceId)` |
| 其他定向消息 | `emitToInstance(instanceId, type, data)` |
| unmount 完成并删 handle 后；登出清实例 | `releaseInstance(instanceId)` |

### buildPublicProps Context（必填）

```ts
{
  applicationCode: string  // 非空
  viewId: string           // 非空
  instanceId: string       // 非空
  mode: 'integrated'
  contextPath: string      // 子应用路由前缀，不随单次 update 改变
  locale?: string
  initialRoute?: string
}
// host 附加（不写入 RuntimeContext）：{ activeRule?, entryOrigin? }
```

公开 props **允许**：`applicationCode`、`viewId`、`instanceId`、`appKey`、可选 `locale`/`initialRoute`/`activeRule`/`entryOrigin`  
公开 props **禁止**：`token`、`tokenKid`、`client`、私钥、Secret、`theme`/`metadata`、未文档化的 window 全局契约

未先 `buildPublicProps` 就 `updatePublicContext` / `notifyLocale` / `emitToInstance` 会失败，不要绕过。

## 6. HTTP 装配（必须）

- 使用 `@g2rain/http` 工厂创建 Client
- 装配代码放在 `src/runtime/http`
- 注入壳的 Token Store / `ensureAccessToken` / SSO 失败处理
- 接入后收敛或删除本地 `components/http` 副本
- 可对照 `g2rain-member-app` 的 `src/runtime/http`，但注意 Shell 还要负责 Main 侧会话与消息换票

## 7. 生命周期与运行时行为

启动顺序（目标）：
创建 Vue App → Store/i18n → **导入 Theme/UI CSS、创建 ThemeController、安装 G2rainUi** → Shell 路由 → **HTTP 认证装配** → Mock（可选）→ SSO → 菜单/Locale → RuntimeAdapter → Tab 与路由同步 → 跨应用消息 → mount

子应用实例：
1. 菜单就绪 → 校验定义 → 注册 MicroAppDefinition
2. 打开 Tab → 分配 instanceId → 独立 container
3. `buildPublicProps` → `loadMicroApp` → 等待 mount
4. 同 instanceId 上 mount/update/unmount/destroy **串行**；`updateInstanceProps` 必须 `await microApp.update()`
5. **切 Tab：标 inactive，不 unmount**；恢复时按实例 `lastActivePath` 同步地址栏
6. **关 Tab / destroy：先 unmount + 删 handle，再 `releaseInstance`，再移除 RuntimeInstance**；不得只移除 Tab UI 而遗留实例

基线：`singular: false`；每实例唯一运行名与 container。

路由协同：
- 子应用上报内部路由；壳更新该实例路径；`history.replaceState` 同步地址栏时避免主 Router 导航循环
- 忽略非当前激活实例的迟到路由消息

认证与消息（壳侧必须真实接线，禁止假实现）：
| 事件 | 方向 | 要求 |
| --- | --- | --- |
| `g2rain:sub-app:route-change` | Sub→Main | 校验实例；更新路径；防循环 |
| `g2rain:sub-app:token-invalid` | Sub→Main | 刷新或全局登出 |
| `g2rain:main-app:token-response` | Main→Sub | 绑定 requestId 与目标；不自监听本窗派发 |
| `g2rain:sub-app:request-token` | Sub→Main | 若文档承诺支持就必须实现 Handler；否则从承诺中删除 |

Token 交换走 Auth Bridge / 消息层，**不经** `buildPublicProps`。
基于 window 事件的消息必须有来源、实例、请求关联校验计划；不得生成「任意同页脚本即可要 Token」的默认实现。

## 8. 禁止生成的模式（硬拒绝）

1. 在 `@g2rain/platform` 内调用或再封装 `loadMicroApp`
2. Token 写入公开 props / URL / query / hash / 可枚举日志
3. 用菜单 key、path、applicationCode 冒充 instanceId 语义却不下发真实 instanceId
4. 切 Tab 时 unmount 子应用（除非产品明确销毁实例）
5. update 忽略 Promise / 不入 per-instance 队列
6. 关闭或登出后不 `releaseInstance`
7. 在 Platform 再复制一份 RuntimeInstance 注册表
8. 把 IAM/Gateway 鉴权或子应用业务校验「图方便」塞进 Shell
9. 生产私钥 / `.pem` / Secret 写入仓库、镜像上下文或前端 Bundle
10. 静默发明第二套消息 type 或 props 字段
11. 只交源码不交必填 docs，或另起平行文档目录
12. 用 frontend-app CLI 模板冒充 Shell
13. 用条件渲染冒充 Tab/Workspace，缺少 TabBar、激活、关闭回退与 RuntimeInstance 关联
14. 手写或复制主题变量替代 `@g2rain/theme`，或令 `@g2rain/ui` 组件自行修改根节点主题
15. 在新建 Shell 的初始菜单中硬编码未验证的业务子应用地址，造成菜单可见但无法打开
16. 将当前登录人、机构、Token 或其他会话信息写入公开 props、URL、Mock 或持久日志；身份展示必须从 Shell Session/SSO 状态读取

## 9. 必须产出的目录与文档（不能空壳凑数）

```text
AGENTS.md
docs/project.yaml
docs/index.md
docs/architecture/overview.md
docs/architecture/layers.md
docs/architecture/dependencies.md
docs/architecture/runtime-flows.md
docs/architecture/deviations.md
docs/development/local-development.md
docs/development/testing.md
docs/development/definition-of-done.md
docs/development/platform-main-adoption.md   # Appkit 采纳专题（追加）
docs/development/ui-theme-adoption.md       # Theme/UI 采纳专题（追加）
docs/operations/configuration.md
docs/operations/deployment.md
docs/operations/troubleshooting.md
docs/security/security-boundaries.md
docs/requirements/README.md
src/{shared,components,platform,runtime,views,shell}/
```

`docs/project.yaml` 至少含：
- `family: frontend-shell`
- 中央 baselineRef + frontend-app / frontend-shell Profile 版本与路径
- `runtime.applicationCode` / `contextPath` / 端口 / 子应用契约字段
- `commands.verify`（通常 `npm run build`）
- `documentation.entry` / `agentEntry` / `platformMainAdoption`
- `aiCoding.activeRequirement`（无活跃需求时为 `null`）

`platform-main-adoption.md`：写本仓采纳状态、改造锚点、联调对象；**不要复制** appkit 公开 API 正文，改为链接到 main-shell-contract 与 `docs/integration/main.md`。

`ui-theme-adoption.md`：记录 `@g2rain/theme/styles.css` 与 `@g2rain/ui/style.css` 的显式引入、ThemeController 的根节点和持久化位置、`G2rainUi` Provider、Tab/主题联调项；不要把主题写入 Public Props。

## 10. 相对 g2rain-main-shell 的缺口（生成时优先闭合，勿复制旧行为）

- 安装并接线 `@g2rain/platform` + `@g2rain/http`
- 组合根 `createMainPlatform` + `runtimePort`
- HTTP 迁出本地 `components/http` → `@g2rain/http` + `runtime/http`
- 去掉手写含 Token 的 props；改 `buildPublicProps`
- 显式 `applicationCode` / `viewId`；`appKey === instanceId`
- `updateInstanceProps` 统一 await + 入队
- destroy / logout 路径调用 `releaseInstance`
- REQUEST_TOKEN：实现 Handler，或从对外承诺中删除（禁止假实现）
- 联合验收优先 `g2rain-member-app`（已接 `/sub`）
- 补齐真实 TabBar（激活、关闭、回退、运行实例关联）及 `@g2rain/theme` / `@g2rain/ui` 组合根装配
- 初始菜单先交付可访问的 Shell 自身功能介绍；业务菜单在可信应用目录/部署配置就绪后再接入，并校验 entry origin
- Header 交付当前登录人和当前机构的非敏感摘要展示；SSO 未接入时使用明确空状态，不伪造身份数据

## 11. 交付与自检（未做项必须在交付说明显式标「未验证」）

完成后逐项勾选并报告：

- [ ] 第 9 节文档树齐全；index 可导航；相对链接有效
- [ ] project.yaml 与 Context Path / 端口 / 契约字段一致
- [ ] AGENTS.md 含中央 Profile、本地偏差、main-shell-contract、platform-main-adoption 阅读顺序
- [ ] 依赖方向符合第 3 节
- [ ] 已用 `@g2rain/platform/main` + `@g2rain/http`；`createMainPlatform` 仅一处
- [ ] HTTP 经公共包装配；Token Store/SSO/刷新仍在壳
- [ ] runtimePort.updateInstanceProps await + 入队
- [ ] 挂载 props 来自 buildPublicProps；无 Token/私钥
- [ ] appKey === instanceId；同时下发 applicationCode 与 viewId
- [ ] 切 Tab 不 unmount；关 Tab/登出调用 releaseInstance
- [ ] Locale/AuthInvalid 走 notifyLocale / notifyAuthInvalid
- [ ] 有真实 TabBar：主/子应用可激活；切换不 unmount；关闭回退、destroy、releaseInstance、RuntimeInstance 移除已串联
- [ ] 已从 appkit 安装并显式引入 `@g2rain/theme/styles.css`、`@g2rain/ui/style.css`；组合根创建 ThemeController 并安装 G2rainUi
- [ ] 根节点用 `data-g2-theme` 管理亮/暗主题，Element Plus 与 G2rain UI 同步；主题不进入 props、URL 或日志
- [ ] 初始菜单的每一项均可访问；未配置业务应用时仅展示 Shell 功能介绍，不展示硬编码的不可用子应用入口
- [ ] Header 右侧展示来自 Shell 会话状态的当前登录人和机构摘要；未登录状态明确，且无 Token/Secret 泄漏
- [ ] 消息处理器与文档承诺一致
- [ ] 无敏感信息泄漏
- [ ] `npm run build` 通过
- [ ] 偏差写入 `docs/architecture/deviations.md`
- [ ] 给出与 member-app 的联调计划（至少：挂载、切 Tab、关 Tab、locale、token-invalid）

## 12. 工作方式

- 先产出可构建的最小可运行 Shell + 完整 docs，再完善 SSO/菜单细节。
- 有意偏离中央 Profile / 本契约时写入 `docs/architecture/deviations.md`，并给退出条件；不得把临时兼容写成范例。
- 修改公开契约时同步说明对 appkit CHANGELOG / 相关 docs 的影响（若本仓无权改 appkit，在交付说明列出需同步项）。
- 用中文写文档与交付说明；代码注释保持克制。
- 不要提交真实凭据；不要 invent Registry 版本号。

现在开始：先列出将创建的文件树与关键模块职责表，再实现代码与文档；最后按第 11 节自检输出结果。
````
