# 故障排查

## 包入口或类型无法解析

确认消费方只使用 `package.json#exports` 声明的入口，并先在 Appkit 执行 `npm run build` 与 `npm run pack:check`。不要用 `npm link`、`src` 路径或手工修改 `dist` 代替制品验证。

## 主题或 Element Plus 样式不一致

确认应用显式引入 `@g2rain/theme` 的 CSS 入口，并由应用决定 DOM 主题状态。Theme 为 CSS-only；浏览器主题控制器属于 `@g2rain/platform/theme`，不应由 UI 组件自行读取或持久化主题状态。

## 子应用挂载或更新异常

确认应用入口负责容器校验、宿主 Props 解析、认证桥接和 Vue/Router 创建；`@g2rain/platform/sub` 只管理共享生命周期与 Scope。检查 `instanceId` 与迁移期 `appKey` 的对应关系，不在单实例卸载时调用跨实例的清理操作。Main Shell `/main` 接线尚未完成，不能把未完成的联合能力当作已发布契约。

## HTTP 认证或刷新异常

确认应用提供 Token Store、Client 单例、IAM Key、Mock 和登录跳转等应用职责。`@g2rain/http` 不读取环境变量，不持有具体 Store，也不决定 UI 提示或跳转。详细行为见 [HTTP 与 Runtime 契约](../packages/http-runtime-contract.md)。
