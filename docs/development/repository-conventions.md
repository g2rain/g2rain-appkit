# 仓库与开发约定

## 1. Workspace

根目录只负责工作区编排，不发布到 Registry：

```json
{
  "name": "g2rain-appkit",
  "private": true,
  "workspaces": ["packages/*", "examples/*"],
  "engines": { "node": ">=22" }
}
```

每个 `packages/*` 子目录是独立版本和独立发布单元，包名统一使用 `@g2rain/` scope。

## 2. 脚本契约

根目录至少提供 `build`、`typecheck` 和 `test`。各包使用一致的脚本名称，使根脚本能够统一调度；发布包另需提供制品清单检查。

脚本的输入、输出、构建顺序和测试工具以[构建、制品与测试契约](build-and-test-contract.md)为准。生成器不得自行更换构建工具或改变 `dist` 布局。

## 3. 依赖规则

- Vue、Element Plus 等宿主应用提供的框架依赖通常声明为 `peerDependencies`。
- 构建和测试需要的同一依赖同时放入 `devDependencies`。
- 包之间只依赖已声明的公开入口，不导入其他包的内部源码。
- 新增运行时依赖前应评估必要性、体积和许可证。
- 不依赖业务应用定义的全局类型或路径别名。

## 4. TypeScript 与导出

- 发布包必须生成 `.d.ts`。
- 公开类型与运行时代码从稳定入口导出。
- `package.json#exports` 是允许消费的完整入口清单。
- CSS 使用明确的子路径导出，避免 JavaScript 入口隐式加载全局样式。

## 5. Vue 实现约束

- Vue 组件和组合式函数统一采用 Vue 3 Composition API。
- Vue 单文件组件必须使用 `<script setup lang="ts">`，禁止新增 Options API（如 `data`、`methods`、`computed` 选项和选项式生命周期钩子）。
- 可复用状态和行为优先提取为具有 `use*` 命名的组合式函数；不为复用业务逻辑新增 mixin。
- 本约束中的 `<script setup>` 仅适用于 Vue 单文件组件；`theme`、`http` 等非 SFC 模块继续使用普通 TypeScript API。

## 6. 变更要求

一个影响公开能力的变更至少包含：

1. 实现与类型。
2. 对应测试。
3. Playground 或最小使用示例。
4. 相关架构或包文档更新。
5. 根目录 `CHANGELOG.md` 与受影响包版本说明；不兼容变更附迁移方法。
6. 若影响接入门槛或验证结论，更新 `docs/project.yaml` 的 `validation` 与[接入就绪清单](integration-readiness.md)。
