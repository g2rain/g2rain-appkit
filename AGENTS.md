# G2rain Appkit Agent 约定

本仓库是 G2rain Supporting Library，平台角色与 `g2rain-common`、`g2rain-spring-boot-starter` 相同；它以 npm 公共包提供前端契约和基础能力，不是业务 App 或 qiankun 主应用。

## 开始前

依次阅读 `README.md`、`docs/project.yaml`、`docs/index.md`、`docs/architecture/deviations.md`、任务相关专题文档，以及中央仓库 `g2rain/g2rain` 的 `docs/architecture/platform-libraries/g2rain-appkit.md`。涉及接入或发布时再读 `docs/development/integration-readiness.md` 和 `docs/operations/publishing.md`。

## 架构边界

- 包依赖保持单向：`theme` 位于底层；`ui` peer 依赖 `theme`；`http` 与 `platform` 并行，互不依赖，由应用组合根装配。
- 公共包不得导入具体应用的 Store、路由、领域 API、环境配置或目录别名。
- 外部能力通过 Props、Slots、事件、Provider、Adapter 或工厂参数注入。
- 消费方只从 `package.json#exports` 声明的入口导入。
- 修改公开 API、CSS 变量、运行时消息或依赖范围时，同步文档、`CHANGELOG.md` 并说明兼容性。

## 完成前

根据变更范围执行类型检查、测试、构建和 `npm pack`。涉及主题、UI 或 Platform 的发布候选还应通过 Playground、真实 App 以及独立/qiankun 运行模式验证。只报告实际执行并通过的检查。文档变更需核对 `docs/project.yaml` 索引与接入就绪清单是否仍准确。
