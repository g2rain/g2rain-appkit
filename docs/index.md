# G2rain Appkit 文档

本目录记录 `g2rain-appkit` 作为 G2rain Supporting Library 的公共 API、架构边界、开发和发布规则。它不采用业务 App Profile；组织级角色和跨仓库契约以中央 [平台共享库登记](https://github.com/g2rain/g2rain/blob/feature/g2rain-architectur-init/docs/architecture/platform-libraries/g2rain-appkit.md) 为准，本仓库维护实现、验证和接入细节。

## 当前状态

Theme/UI、HTTP 与 Platform Sub 已在 `g2rain-member-app` 完成真实 App 接入。2026-09-20 用户确认该试点已基本验证成功；Main Shell `/main` 接线、主子联合验收、Registry 发布及模板/CLI 推广仍未完成。权威状态见 [project.yaml](project.yaml) 与[接入就绪清单](development/integration-readiness.md)。

## 阅读路径

1. [项目事实](project.yaml)：仓库身份、公共包、中央登记和验证状态。
2. [总体架构](architecture/overview.md)、[依赖关系](architecture/dependencies.md)与[架构偏差](architecture/deviations.md)。
3. [公开契约](api/public-contracts.md)与[包设计](packages/README.md)。
4. [开发规范](development/repository-conventions.md)、[完成定义](development/definition-of-done.md)与[接入就绪清单](development/integration-readiness.md)。
5. [运维与发布](operations/publishing.md)、[故障排查](operations/troubleshooting.md)及[安全边界](security/security-boundaries.md)。
6. [架构决策](decisions/README.md)、[需求状态](requirements/README.md)和[应用迁移](migration/application-migration.md)。

## 专题入口

- [Platform Main/Sub 方案](architecture/platform-framework.md)
- [主题与微应用协作](architecture/theme-and-micro-app.md)
- [接入手册](development/platform-handbook.md)：[Main Shell](development/main-integration.md)、[业务 App](development/app-integration.md)
- [构建、制品与测试契约](development/build-and-test-contract.md)
- [HTTP 与 Runtime 契约](packages/http-runtime-contract.md)
- [平台数据组件与 Provider](packages/platform-data-components.md)

## 包快速入口

- [`@g2rain/theme`](../packages/theme/README.md)
- [`@g2rain/ui`](../packages/ui/README.md)
- [`@g2rain/http`](../packages/http/README.md)
- [`@g2rain/platform`](../packages/platform/README.md)
