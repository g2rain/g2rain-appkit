# Changelog

本仓库各可发布包共享此变更记录。版本号以各包 `package.json` 为准；当前四个包均为 `1.0.0`。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本策略遵循语义化版本。

## [Unreleased]

## [1.0.0] - 2026-10-01

首个正式 Registry 发布候选。四个包统一为 `1.0.0`（此前本地试点：`theme`/`http`/`platform` 为 `0.1.0`，`ui` 为 `0.1.1`）。

### `@g2rain/platform`

- **Breaking（`/sub`）**：`resolveSubHostProps` 删除旧壳兼容。不再接受仅有 `appKey`、缺少 `instanceId` 的 props；不再从 props 解析 `token`/`tokenKid`/`client`，并移除 `ResolvedSubHost.shell`、`ResolvedSubHost.auth` 与 `SubLegacyAuth`。宿主必须提供 `applicationCode`、`viewId`、`instanceId` 且 `appKey === instanceId`；认证改由应用 Auth Bridge。
- 将未发布工作包直接改名为 `@g2rain/platform`，删除旧包名和兼容入口。
- 包根只导出 `RuntimeContext`、`RuntimeMessage` 与 `PlatformError`，不再转出 Theme、Loading、Permission 或 Micro App，因此包根不导入 Vue。
- 新增 `@g2rain/platform/sub` 的 `createSubPlatform`：按 `instanceId` 管理 Scope 和 Capability 生命周期。同一实例重复 mount 会失败，不同实例可以并存；失败按依赖逆序回滚。
- 既有 `./theme`、`./loading`、`./permission`、`./micro-app` 控制器签名保持不变，并增加对应 Capability。
- 新增 `@g2rain/platform/main` 的 `createMainPlatform`：公开 props 白名单、`notifyLocale`、`notifyAuthInvalid`，以及带 `appKey` 的定向消息。不发送主题变更消息。
- 新增 `@g2rain/platform/sub` 的 `resolveSubHostProps` 与 `createSubDirectedMessage`：现行壳和新壳在进 Kernel 前变成同一份 Context。Token 不进入 Context。
- 新增独立的 `/i18n`、`/i18n/vue-i18n`、`/error`、`/http`。`createStandardSubPlatform` 只强制组合 I18n 和 Error。这些入口不导入 Vue 或 `@g2rain/http`。
- 挂载失败时卸载已创建的应用。实例消息按 `instanceId` 或迁移期 `appKey` 过滤。文档示例改为 `createStandardSubPlatform`。
- Vue 权限插件改由 `@g2rain/platform/permission/vue` 导出，`/permission` 不再导入 Vue。`createMainPlatform` 增加 `releaseInstance`。HTTP Capability 在首次 `mount` 同步共享 locale。
- `dispose` 先等待进行中的生命周期。`mount` 在 `await` 之后发现 Definition 正在销毁就停止，不再留下未追踪实例。

### Repository

- 仓库与项目名由 `g2rain-frontend` 重命名为 `g2rain-appkit`；npm 包名 `@g2rain/*` 不变。

### `@g2rain/http`

- 工厂新增 dpop 显式选项：以现网 main-shell 为准，htu=config.url，不追加 baseURL/域名；paramsSerializer 查询字符串与请求体分别参与签名，重放重新生成 proof。移除尚未发布的 origin/htuMode 扩展。
- FormData 编码一次复用 boundary 与字节；JSON/URL 编码使用实际 Axios transform 输出。纯签名拒绝未编码的 FormData。
- 兼容网关 path htu、Result status=0/200、gateway.40002 刷新和 gateway.40001 登录失败。
- 请求前刷新与响应失败刷新合并；同批失败共享错误和一次通知，通知异常不改变请求结果。
- Theme/UI 按用户确认记为试点闭环；HTTP 已在 Member 完成制品接入、验证及本地兼容组件清理。

### `@g2rain/ui`

- RemoteSelect：清空搜索或命中本地缓存时作废进行中的远程请求，避免旧结果覆盖选项。
- TableColumn：保留 `sortable="custom"`，不再被折成布尔 `true`，以支持服务端排序。
- 组织、字典和状态组件改由 `@g2rain/ui/platform` 导出。根入口不再导出 `OrganSelect`、`DictSelect`、`DictText`、`StatusSwitch`。数据 Provider 改由 `G2rainPlatformUi` 注入。
- peer `@g2rain/theme` 范围调整为 `^1.0.0`。

### Documentation

- 文档目录拆分：`docs/development/` 仅保留本仓工程约定；消费方接入、就绪清单与 Main Shell AI 提示词迁至 `docs/integration/`。
- 新增 [Main Shell AI Coding 提示词](docs/integration/main-shell-generation-prompt.md)，供助手按生成契约落地 `@g2rain/platform/main` + `@g2rain/http`；已索引到 `docs/index.md`、`docs/project.yaml`、生成契约与接入手册。
- 对齐包设计、架构依赖图与当前实现（`http` 与 `platform` 互不依赖；平台三组件已进 `@g2rain/ui`）。
- 补充接入就绪清单、迁移试点示例、根 LICENSE 与各包 README。
- B 档试点：`g2rain-member-app` 已接入 Theme/UI/HTTP；HTTP 公共内核验证通过并删除本地 `components/http`，应用专属装配迁至 `runtime/http`。
- 将统一框架草案调整为最小 Platform 方案：包根只导出 Main/Sub 共享协议，`/main` 提供协调端口，`/sub` 提供框架无关的实例生命周期与 Scope；目标身份模型采用 `MicroAppDefinition → WorkspaceView → RuntimeInstance → RuntimeAdapter 私有 handle`，废止 `appKey` 同时承担应用、页面和实例身份的设计。Platform 不提供公开 `/core`、统一 `/vue` 或宿主专用入口，Vue、Pinia、Router、qiankun lifecycle 与独立启动逻辑继续由应用拥有。
- 增加 [Main Shell 与子应用开发手册](docs/integration/README.md)，用于新建项目和改造现有主应用、业务子应用。子应用按一份 JavaScript 多次 `mount` 编写，不复制 RuntimeStore。

## [0.1.0] - 2026-09-13

首版尚未正式发布到 npm Registry；以下描述本地实现与 pack dry-run 已通过的能力。

### `@g2rain/theme`

- 语义化 CSS 变量、亮色 / 暗色主题、Element Plus 映射与基础样式。
- 仅通过 CSS 子路径导出，不提供 JavaScript DOM API。

### `@g2rain/ui`

- 基础组件：`QueryForm`、`TableSort` 系列、`RemoteSelect`、`ApiSelect`、`DictSelect`。
- 平台数据组件：`OrganSelect`、`DictText`、`StatusSwitch`（经 `G2rainUi` Provider / 回调注入）。
- `G2rainUi` 支持 `translate`、`locale`。组织与字典数据由 `@g2rain/ui/platform` 的 `G2rainPlatformUi` 注入。
- StatusSwitch 行为：成功后更新 model；不再自动弹出 ElMessage。

### `@g2rain/http`

- Axios Client 工厂、语义化参数序列化、标准错误、Token 刷新单航班、DPoP 纯签名与 `dispose`。
- Token、登录失败处理、环境地址由应用注入。

### 工作包（后改名为 `@g2rain/platform`）

- Loading Controller、Theme Controller、微应用浏览器 Event Adapter、权限 Provider 插件。
- 当时公开子路径：`.`、`./theme`、`./micro-app`、`./permission`、`./loading`。
- 不依赖 `@g2rain/http`；与 HTTP 由应用组合根装配。

### Known gaps

- 真实业务 App 与 qiankun 联调尚未执行。
- `UserSelect` 尚未实现。
- CI 工作流尚未配置。
- npm Registry 尚无可见公开版本。
