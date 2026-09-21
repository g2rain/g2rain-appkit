# 公开契约

Appkit 的公开 API 以各包 `package.json#exports`、生成的类型声明和发布制品为准。消费者不得从 `src`、`dist` 的未导出路径或其他包内部实现导入。

| 包 | 契约范围 | 详细说明 |
| --- | --- | --- |
| `@g2rain/theme` | `--g2-*` 语义变量、CSS 子路径和亮暗主题 | [包设计](../packages/README.md) |
| `@g2rain/ui` | 组件 Props、事件、Slots、组合式函数及 `G2rainUi` Provider | [组件基准](../packages/component-migration-baseline.md) |
| `@g2rain/http` | Client 工厂、错误模型、认证刷新和序列化 | [HTTP 与 Runtime 契约](../packages/http-runtime-contract.md) |
| `@g2rain/platform` | Runtime Context、消息协议、Main/Sub 生命周期和 Capability 子路径 | [Platform 方案](../architecture/platform-framework.md) |

任何导出、CSS 变量、消息载荷、依赖范围或兼容性变化，都必须同步更新相关包文档、[架构决策](../decisions/README.md)、[迁移指南](../migration/application-migration.md)和根 `CHANGELOG.md`。发布前按[发布流程](../operations/publishing.md)验证制品入口。
