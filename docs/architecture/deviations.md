# 架构偏差与未完成项

本仓库不采用 `frontend-app` 或 `frontend-shell` 的目录 Profile，因为它是版本化 npm 公共包，而非浏览器 App 或主应用。该项目类型目前由中央 `platform-libraries` 登记治理，尚无独立的 `frontend-library` Profile。

## 已接受的实现边界

- `packages/` 保留为项目特有分区，用于说明各 npm 包的公开能力与迁移基准；它不替代通用的 `api/`、`architecture/` 或 `operations/` 分区。
- `@g2rain/platform/sub` 已在 Member 试点接入；应用继续拥有 Vue、Pinia、Router、qiankun Adapter、认证和业务资源加载。
- 现行 Main Shell 可经 `appKey` 兼容路径驱动 Member；Main Shell 尚未接入 `@g2rain/platform/main`。

## 待关闭项

- 为共享库发布固定中央架构快照，并把 `project.yaml` 的中央引用从试点分支切换到 Tag。
- 完成 Main Shell `/main` 接线和 Main/Sub 联合验收。
- 补齐 Member 独立、qiankun 生命周期、多实例与主题协作的可追溯验证记录。
- 在验证完成后再推进 Registry 发布、App Template / CLI 默认接入和其他 App 推广。

这些事项不是对依赖方向的豁免；变更时仍须遵循 [依赖关系](dependencies.md) 与[公开契约](../api/public-contracts.md)。
