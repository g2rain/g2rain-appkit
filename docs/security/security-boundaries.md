# 安全边界

- 公共包不得记录、持久化或输出 AccessToken、私钥、完整用户资料或宿主认证载荷。
- `@g2rain/http` 接收认证和错误处理 Adapter，但不读取应用环境变量、不持有具体 Token Store，也不决定登录跳转。
- `@g2rain/platform` 的 Context、错误对象、日志和消息不得包含敏感认证载荷；宿主认证桥接仅在应用入口处理。
- 公共 UI 通过 Provider、Props 和回调获取数据，不猜测业务 Endpoint、权限范围或 Token。
- 浏览器侧上下文不能替代 Gateway 或服务端的 Token、权限和数据范围验证。
- 发布制品和示例不得包含密钥、Token、生产凭据或私有 Registry 配置；发布前按[发布流程](../operations/publishing.md)检查 `npm pack` 内容。
