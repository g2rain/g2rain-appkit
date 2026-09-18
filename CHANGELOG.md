# Changelog

本仓库各可发布包共享此变更记录。版本号以各包 `package.json` 为准；首版四个包均为 `0.1.0`。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本策略遵循语义化版本。

## [Unreleased]

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

### Documentation

- 对齐包设计、架构依赖图与当前实现（`http` / `runtime` 互不依赖；平台三组件已进 `@g2rain/ui`）。
- 补充接入就绪清单、迁移试点示例、根 LICENSE 与各包 README。
- B 档试点：`g2rain-member-app` 已接入 Theme/UI/HTTP；HTTP 公共内核验证通过并删除本地 `components/http`，应用专属装配迁至 `runtime/http`。Runtime 与平台推广仍进行中。
- 将统一框架草案调整为 Platform 方案：发布前直接把未发布的 `@g2rain/runtime` 工作包重命名为 `@g2rain/platform`，不保留 Runtime npm 包或兼容入口；Runtime Kernel 降为内部核心，I18n 与 Error Handling 纳入第一阶段标准能力，通过 Host/Theme/UI/I18n/Error Adapter 保持 qiankun、主题、UI 框架和监控实现可替换。

## [0.1.0] - 2026-09-13

首版尚未正式发布到 npm Registry；以下描述本地实现与 pack dry-run 已通过的能力。

### `@g2rain/theme`

- 语义化 CSS 变量、亮色 / 暗色主题、Element Plus 映射与基础样式。
- 仅通过 CSS 子路径导出，不提供 JavaScript DOM API。

### `@g2rain/ui`

- 基础组件：`QueryForm`、`TableSort` 系列、`RemoteSelect`、`ApiSelect`、`DictSelect`。
- 平台数据组件：`OrganSelect`、`DictText`、`StatusSwitch`（经 `G2rainUi` Provider / 回调注入）。
- `G2rainUi` 支持 `translate`、`locale`、`dataProviders`、`onMissingProvider`。
- StatusSwitch 行为：成功后更新 model；不再自动弹出 ElMessage。

### `@g2rain/http`

- Axios Client 工厂、语义化参数序列化、标准错误、Token 刷新单航班、DPoP 纯签名与 `dispose`。
- Token、登录失败处理、环境地址由应用注入。

### `@g2rain/runtime`

- Loading Controller、Theme Controller、微应用浏览器 Event Adapter、权限 Provider 插件。
- 公开子路径：`.`、`./theme`、`./micro-app`、`./permission`、`./loading`。
- 不依赖 `@g2rain/http`；与 HTTP 由应用组合根装配。

### Known gaps

- 真实业务 App 与 qiankun 联调尚未执行。
- `UserSelect` 尚未实现。
- CI 工作流尚未配置。
- npm Registry 尚无可见公开版本。
