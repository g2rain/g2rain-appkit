# 接入就绪清单

本文区分库侧能力、试点接入与规模化发布三档门槛，避免把“阶段一构建通过”误判为“可正式推广”。

## 1. 当前状态（2026-09-18）

Theme/UI 按用户确认记为局部试点闭环；HTTP 已在 `g2rain-member-app` 完成制品接入和验证，并删除原 `src/components/http` 兼容目录。应用专属单例、Mock、IAM Key、Loading 组合和刷新协调迁至 `src/runtime/http`，不属于公共包源码副本。当前 Appkit 仍处于 Member 整体验证期：Platform 的 Main/Sub 协作、Member 独立与 qiankun 运行必须与已验证的 Theme/UI/HTTP 共同闭环，之后才可发布任何 npm 包。

| 档位 | 状态 | 说明 |
| --- | --- | --- |
| A. 库内阶段一 | 已通过 | 四包实现、Playground、typecheck / test / build / pack:check |
| B. Member 整体验证 | 进行中 | Member 已接入 Theme/UI/HTTP；HTTP 本地兼容组件已清理，Platform 与 Main Shell 的真实协作仍待验收 |
| C. 正式 Registry 发布 | 未就绪 | 只有 B 档全部通过后才可发布；当前不发布任何 npm 包 |
| D. 平台闭环 | 未完成 | 模板 / CLI 未默认依赖；业务仓仍保留本地副本 |

权威状态以 [`docs/project.yaml`](../project.yaml) 的 `validation` 为准。

## 2. A 档：库内阶段一（已完成）

- [x] `@g2rain/theme`、`@g2rain/ui`、`@g2rain/http`、`@g2rain/platform` 首版实现
- [x] `package.json#exports` 与 `dist` 制品一致
- [x] 单元测试覆盖关键路径
- [x] Playground 覆盖 Theme、基础 UI、平台数据组件与 ThemeController
- [x] `npm run pack:check` 通过

## 3. B 档：Member 整体验证条件

当前只允许使用本地 `npm pack` 制品开展 Member 整体验证，不发布到 Registry：

- [x] 迁移指南与平台组件 Provider 文档可用
- [x] 可用 `npm pack` 生成与发布结构一致的 tarball
- [x] 试点应用（推荐 `g2rain-member-app`）完成 theme + ui 安装与兼容转发
- [x] 试点应用 typecheck / build 通过
- [x] `g2rain-member-app` 完成 `@g2rain/http` 接入、运行验证和本地 `components/http` 清理
- [ ] 独立模式冒烟通过（静态 preview + theme CSS 已验证；登录后列表页待后端）
- [ ] qiankun 挂载、卸载、重新挂载冒烟通过（生命周期已注入 `G2rainUi`；需 main-shell 联调）
- [ ] 亮暗主题切换一致（`--g2-*` 已打入产物；主壳主题协作待验收）

试点期间允许暂时保留本地兼容转发层；未验证通过前不删除全部本地实现。

## 4. C 档：正式 Registry 发布条件

- [ ] B 档的独立模式、qiankun 模式、卸载/重新挂载、主题协作和 Platform Main/Sub 联合验证全部通过
- [ ] `npm whoami` 确认具备 `@g2rain` scope 发布权限
- [ ] 根目录 `LICENSE`、各包版本与 `CHANGELOG.md` 一致
- [ ] 按依赖顺序发布：`theme` → `ui` / `http` / `platform`
- [ ] Member 的 `npm pack` 制品验证结论与发布候选版本、锁定依赖和变更说明一致
- [ ] 发布说明包含已知行为差异（例如 StatusSwitch 成功后更新、不再自动 ElMessage）
- [ ] CI 至少执行 typecheck、test、build、pack:check（当前仓库尚未配置 `.github` 工作流）

## 5. D 档：平台闭环条件

- [ ] 试点应用删除已迁移能力的本地源码副本
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
