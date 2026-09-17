# 本地开发与验证

## 1. 基本流程

```bash
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
```

开发单个包时使用 npm workspace 参数运行该包脚本；跨包联调使用 `examples/playground`。

## 2. Playground

Playground 用于验证：

- 公共包入口和 CSS 子路径能够解析。
- 组件交互和主题切换正常。
- 多包组合不会产生重复依赖或全局副作用。
- 生产构建能够完成。

Playground 不是业务示例应用，不应引入真实业务 Store 或领域 API。

## 3. 真实应用联调

发布前使用 `npm pack` 生成与正式发布结构一致的压缩包，并在试点应用中安装。不要用 `npm link` 的成功代替发布验证，它可能掩盖 `exports`、`files` 和依赖声明问题。迁移步骤见[应用迁移指南](../migration/application-migration.md)；分档门槛见[接入就绪清单](integration-readiness.md)。

至少验证：

1. 试点应用类型检查。
2. 试点应用生产构建。
3. 独立模式启动。
4. qiankun 模式挂载、卸载和重新挂载。
5. 亮色、暗色主题切换。

Playground 当前重点覆盖 Theme、UI 与 ThemeController；HTTP Client、权限与 Loading 的组合验证以单元测试和试点应用为准。

## 4. 提交前检查

- 没有业务应用目录别名或内部源码路径导入。
- 新公开 API 已从稳定入口导出。
- 发布文件清单不含缓存、测试输出或本地配置。
- 文档示例与实际 API 一致；公开契约变更已写入 `CHANGELOG.md`。
- 未提交 Registry Token、环境密钥或临时压缩包。

具体制品路径、External 规则和测试环境见[构建、制品与测试契约](build-and-test-contract.md)。
