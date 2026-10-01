# 接入手册

本目录面向 **Main Shell / 业务 App 等消费方**：如何安装 appkit 制品、接线、验收。  
本仓自身的工程约定（脚本、构建、本地开发、DoD）仍在 [`docs/development/`](../development/repository-conventions.md)。

用法分篇，不在这里重复：

- [Main Shell 接入](main.md)：人工执行的 `@g2rain/platform/main` 与 `@g2rain/http` 安装与接线步骤
- 中央 [Main Shell 契约](https://github.com/g2rain/g2rain/blob/main/docs/architecture/profiles/frontend-shell/main-shell-contract.md)：AI / 生成器实现或改造主应用时的必须 / 禁止与完成检查；不重复手册中的 `npm pack` 步骤
- [Main Shell AI Coding 提示词](main-shell-generation-prompt.md)：可复制给助手的生成/改造提示词；冲突以生成契约为准
- [业务 App 接入](app.md)：`create-g2rain-app` 与其项目内的 `template/`、`@g2rain/platform/sub`。创建、生成页面和生成资源配置以 [CLI 使用手册](https://github.com/g2rain/g2rain-app-cli/blob/main/docs/development/usage.md) 为准。
- [接入就绪清单](readiness.md)：验证分档与发布门槛

`@g2rain/*` 和 `create-g2rain-app` 目前都没有 Registry 版本。接入手册里的安装按现在能用的本地制品和本地命令写。发到 Registry 之后的安装命令待补充。业务 App 模板随 CLI 的 `template/` 提供；Main Shell 模板随 `template-shell/`（源仓 `g2rain-shell-template`）提供。使用 `create-g2rain-app shell` 创建 Shell 基线，禁止用 App 模板冒充。
