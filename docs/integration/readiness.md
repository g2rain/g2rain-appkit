# 接入就绪清单

本文区分库侧能力、试点接入与规模化发布三档门槛，避免把“阶段一构建通过”误判为“可正式推广”。

## 1. 当前状态（2026-10-01）

Theme/UI、HTTP 与 Platform Sub 已在 `g2rain-member-app` 完成真实 App 接入。HTTP 原 `src/components/http` 兼容目录已删除；应用专属单例、Mock、IAM Key、Loading 组合和刷新协调保留在 `src/runtime/http`。Member 通过 `@g2rain/platform/sub` 的标准 Preset 统一独立模式与 qiankun 子应用生命周期，Vue、Pinia、Router、认证、资源加载和业务行为仍由应用组合根负责。

2026-10-01 用户确认 `g2rain-admin-shell` 与 `g2rain-member-app` 已使用 `kits/*.tgz` Appkit 制品完成联调；本次复核也确认两端均可生产构建。Shell 已接入 `@g2rain/platform/main` 与 `@g2rain/http`，Member 已接入 `@g2rain/platform/sub` 与 `@g2rain/http`。用户确认联调覆盖独立模式、主子应用协作、qiankun 生命周期及主题协作，B 档和 Main/Sub 联合验证记为已通过。Registry 发布和规模化推广仍受发布权限、候选制品固化与 CI 首次运行等治理条件约束。

| 档位 | 状态 | 说明 |
| --- | --- | --- |
| A. 库内阶段一 | 已通过 | 四包实现、Playground、typecheck / test / build / pack:check |
| B. Member 真实 App 试点 | 已通过 | Member 使用本地制品完成独立与 qiankun 验证；与 Admin Shell 完成联调 |
| C. 正式 Registry 发布 | 未就绪 | Main/Sub 联合验证已通过；npm 权限、候选制品固化、CI 首次运行和发布审批仍待完成 |
| D. 平台闭环 | 未完成 | 模板 / CLI 未默认依赖；业务仓仍保留本地副本 |

权威状态以 [`docs/project.yaml`](../project.yaml) 的 `validation` 为准。

## 2. A 档：库内阶段一（已完成）

- [x] `@g2rain/theme`、`@g2rain/ui`、`@g2rain/http`、`@g2rain/platform` 首版实现
- [x] `package.json#exports` 与 `dist` 制品一致
- [x] 单元测试覆盖关键路径
- [x] Playground 覆盖 Theme、基础 UI、平台数据组件与 ThemeController
- [x] `npm run pack:check` 通过

## 3. B 档：Member 真实 App 试点条件

当前只允许使用本地 `npm pack` 制品开展 Member 整体验证，不发布到 Registry：

- [x] 迁移指南与平台组件 Provider 文档可用
- [x] 可用 `npm pack` 生成与发布结构一致的 tarball
- [x] 试点应用（推荐 `g2rain-member-app`）完成 theme + ui 安装与兼容转发
- [x] 试点应用 typecheck / build 通过
- [x] `g2rain-member-app` 完成 `@g2rain/http` 接入、运行验证和本地 `components/http` 清理
- [x] `g2rain-member-app` 使用 `@g2rain/platform/sub` 的 `createStandardSubPlatform`，独立与 qiankun 入口共用一份 Definition
- [x] Member 不把 Vue、Pinia、Router、Token Store、HTTP Client 和 qiankun 适配器下沉到公共包
- [x] `g2rain-member-app` 在独立模式完成登录后列表页冒烟验证
- [x] 与 `g2rain-admin-shell` 完成 qiankun 挂载、更新、卸载、重新挂载及多实例隔离联调
- [x] 与 `g2rain-admin-shell` 完成亮暗主题切换及主壳主题协作验证

Member 可以保留明确属于应用层的 Adapter、Provider、Store、Mock 和组合根代码；不得把这些应用职责误判为公共包源码副本。已迁移能力的同名公共实现应在验证后删除或登记为有意偏差。

## 4. C 档：正式 Registry 发布条件

- [x] B 档独立模式、qiankun 生命周期、多实例隔离和主题协作已在 Member + Admin Shell 联调中验证
- [x] Main Shell 已接入 `@g2rain/platform/main` 与 `@g2rain/http`，并完成 Platform Main/Sub 联合验证
- [ ] `npm whoami` 确认具备 `@g2rain` scope 发布权限
- [ ] 根目录 `LICENSE`、各包版本与 `CHANGELOG.md` 一致
- [ ] 按依赖顺序发布：`theme` → `ui` / `http` / `platform`
- [ ] Member 的 `npm pack` 制品验证结论与发布候选版本、锁定依赖和变更说明一致
- [ ] 发布说明包含已知行为差异（例如 StatusSwitch 成功后更新、不再自动 ElMessage）
- [ ] GitHub Actions 已配置 typecheck、test、build、pack:check；首次受保护分支或 PR 的成功运行记录待补充

## 5. D 档：平台闭环条件

- [ ] 试点应用删除已迁移能力的本地源码副本，或把保留项登记为应用职责/有意偏差
- [ ] 其他业务 App 按计划迁移或明确排期
- [ ] `g2rain-app-template` 默认依赖公共包
- [ ] `g2rain-app-cli` 生成逻辑与文档同步
- [ ] 中央架构登记 `ref` 切换为固定 Tag，状态可从 `registered` 推进
- [ ] `docs/project.yaml` 的 `validation.status` 更新为反映真实联调结果

## 6. 不在本仓库闭环内、但接入时必须保留的应用层职责

以下能力刻意不进入公共包，试点与推广时仍由各 App 维护：

- 环境变量与 API Base URL 计算
- AccessToken / DPoP Client 的具体 Store
- HTTP Client 单例表与 Mock 数据
- 微应用 Message Processor、Token 交换编排
- qiankun Props 读取与生命周期组合根
- 业务页面、领域 API、路由与权限数据来源

## 7. 文档与实现同步检查

变更公开 API 或接入流程后，至少核对：

1. [`docs/packages/README.md`](../packages/README.md) 组件清单与依赖方向
2. [`docs/packages/component-migration-baseline.md`](../packages/component-migration-baseline.md) / [`platform-data-components.md`](../packages/platform-data-components.md)
3. [`docs/packages/http-runtime-contract.md`](../packages/http-runtime-contract.md)
4. [`docs/migration/application-migration.md`](../migration/application-migration.md)
5. 根 [`CHANGELOG.md`](../../CHANGELOG.md) 与各包版本号
6. [`docs/project.yaml`](../project.yaml) 的 `validation` 与 `documentation` 索引
