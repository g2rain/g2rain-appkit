# G2rain Appkit 文档

本目录记录 `g2rain-appkit` 公共前端能力仓库的架构、开发约定、发布流程和业务应用迁移方法。

## 项目架构身份

本项目的组织级架构登记与中央引用见 [project.yaml](project.yaml)。本仓库属于 `platform-shared-library`，平台角色与 `g2rain-common`、`g2rain-spring-boot-starter` 相同；实现类型为 `frontend-shared-packages`，不采用浏览器 App Profile。

## 当前状态

阶段一库内构建已通过；可用 `npm pack` 启动试点接入；正式 npm 发布与真实 App / qiankun 联调尚未完成。分档门槛见[接入就绪清单](development/integration-readiness.md)。

## 阅读路径

1. [总体架构](architecture/overview.md)：仓库定位、分层、依赖方向和运行模式。
2. [主题与微应用协作](architecture/theme-and-micro-app.md)：独立运行与 qiankun 集成模式。
3. [包设计](packages/README.md)：`theme`、`ui`、`http`、`runtime` 的职责和边界。
4. [首批组件基准与公开契约](packages/component-migration-baseline.md)：规范来源、兼容 API 和去耦要求。
5. [平台数据组件与 Provider](packages/platform-data-components.md)：OrganSelect、DictText、StatusSwitch。
6. [HTTP 与 Runtime 契约](packages/http-runtime-contract.md)：工厂、错误、刷新、消息和生命周期约束。
7. [仓库与开发约定](development/repository-conventions.md)：workspace、依赖和代码规范。
8. [构建、制品与测试契约](development/build-and-test-contract.md)：生成代码必须满足的工程配置和输出。
9. [本地开发与验证](development/local-development.md)：构建、联调和发布前检查。
10. [接入就绪清单](development/integration-readiness.md)：试点 / 正式发布 / 平台闭环门槛。
11. [发布流程](release/publishing.md)：版本、制品、发布和回滚策略。
12. [应用迁移指南](migration/application-migration.md)：现有应用逐步迁移到公共包。

## 包快速入口

- [`@g2rain/theme`](../packages/theme/README.md)
- [`@g2rain/ui`](../packages/ui/README.md)
- [`@g2rain/http`](../packages/http/README.md)
- [`@g2rain/runtime`](../packages/runtime/README.md)

## 架构决策

- [ADR-0001：独立应用仓库与公共包 Monorepo](adr/0001-public-packages-monorepo.md)
- [ADR-0002：语义化主题变量](adr/0002-semantic-theme-tokens.md)
- [ADR-0003：通过能力注入隔离业务应用](adr/0003-capability-injection.md)

## 文档维护规则

- 根 README 用于项目简介和快速入口，详细设计以 `docs` 为准。
- 修改公开 API、依赖方向、运行时协议或发布方式时，同步更新相关文档与 `CHANGELOG.md`。
- 不兼容变更必须包含迁移说明，并新增或更新 ADR。
- 示例代码只依赖公开入口，不引用包内部文件。
- 完成试点或发布里程碑后，更新 `project.yaml` 的 `validation` 字段。
