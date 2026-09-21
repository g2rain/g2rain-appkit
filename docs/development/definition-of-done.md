# 完成定义

一次 Appkit 变更完成前，应满足与影响范围相称的以下条件：

- 公开 API、依赖方向、配置、运行时协议或制品变化已同步到相关文档和 `CHANGELOG.md`。
- 受影响包通过类型检查、测试、构建和 `npm run pack:check`；只报告实际执行的结果。
- 新增或变更的公共能力有最小使用示例或 Playground 覆盖，且仅从公开入口消费。
- 变更 Theme、UI、HTTP 或 Platform 时，按[接入就绪清单](integration-readiness.md)评估真实 App、独立模式和 qiankun 模式验证。
- 不兼容变更已说明迁移与回滚；长期架构决策已记录在 [decisions](../decisions/README.md)。
- 未验证的场景、外部依赖和平台闭环阻断项已如实记录，不以库内构建替代真实 App 验收。
