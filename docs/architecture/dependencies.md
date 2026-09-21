# 依赖关系

## 包级方向

```text
@g2rain/theme → @g2rain/ui
@g2rain/http  ─┐
@g2rain/platform ─┼→ 应用组合根
@g2rain/theme ─┘
```

`@g2rain/http` 与 `@g2rain/platform` 没有包级硬依赖。业务 App 和 Main Shell 仅从各包的 `package.json#exports` 入口导入，并在自己的组合根装配依赖。

## 宿主依赖

Vue、Element Plus 和 `vue-i18n` 等宿主框架能力不得被不需要它们的入口带入：`@g2rain/platform` 包根、`/main`、`/sub` 与通用 Capability 均不导入 Vue；Vue 绑定仅限明确导出的可选子路径。公共包不引用业务 App 的 Store、路由、领域 API、环境变量或目录别名。

## 跨仓库关系

`g2rain-app-template`、业务 App 与 `g2rain-main-shell` 是 Appkit 的消费者，不是其源码依赖。跨仓库公共约束以中央 [平台共享库登记](https://github.com/g2rain/g2rain/blob/feature/g2rain-architectur-init/docs/architecture/platform-libraries/g2rain-appkit.md) 为准；当前已验证的消费者和未完成项以 [接入就绪清单](../development/integration-readiness.md) 为准。
