# `@g2rain/http`

可复用的 Axios HTTP Client、错误模型、参数序列化与 DPoP 签名能力。不读取应用环境变量，不持有 Token Store。

## Install

```bash
npm install @g2rain/http
```

## Usage

```ts
import { createHttpClient } from '@g2rain/http'

const { client, dispose } = createHttpClient({
  baseURL: runtimeConfig.apiBaseUrl,
  dpop: {
    applicationCode: runtimeConfig.applicationCode,
  },
  authSessionProvider: () => accessTokenStore.session,
  ensureAccessToken: options => accessTokenStore.ensure(options),
  authErrorHandler: (reason, error) => authService.handleFailure(reason, error),
  getLocale: () => localeStore.locale,
})
```

应用侧保留 Client 单例表、Mock、环境 URL 与 UI 提示。qiankun 卸载时调用 `dispose()`。

DPoP 默认关闭，迁移原有受保护业务 Client 时必须显式配置 `dpop`。Token 创建等公开 Client 使用 `withAuth:false`，此时不签名、不刷新、不调用认证失败处理。库不读取 window 或应用环境变量。

签名协议以 g2rain-main-shell 为基准：htu 原样取 config.url，通常为业务请求路径，不追加域名或 baseURL。例如 baseURL=/proxy、url=/members，签名 htu=/members，发送地址仍由 Axios 组合为 /proxy/members。查询参数通过 params 传入，使用 paramsSerializer 的结果单独计算 pha；不要把查询参数或 hash 拼入业务路径。此前未发布的 origin/htuMode 配置已移除，不引入另一套签名模式。

签名前先应用 Axios 请求体转换；FormData 用浏览器/Node 22 的原生 Response 编码一次，发送同一 ArrayBuffer 与 boundary。JSON、URL 编码、Blob 和二进制内容均在转换完成后计算摘要。不要在自定义 adapter 内再次转换已签名的内容。原生 FormData/Response 为运行环境要求，无新增 npm 依赖。

认证兼容 Result status=0/200 成功；HTTP 401 与 gateway.40002 共用单航班刷新并最多重放一次；gateway.40001 通知登录失效但不重试。刷新函数必须更新 Provider 中的 tokenString 和 isAccessTokenValid。刷新成功后包会清除 tokenExpired。

`onError` / `authErrorHandler` 的异常不替换原始请求错误。刷新失败的并发等待者收到同一个 G2rainHttpError，原始原因保存在 cause。dispose 不会撤销已经进入应用刷新回调的操作，但会阻止后续通知和请求重放。

当前状态：库内 19 项测试、类型检查和构建通过；Member 的 Token/Mock/错误提示适配与真实网关联调尚未验收。不要将纯函数验签测试等同于后端联调通过。

## Docs

- [HTTP 与 Runtime 契约](../../docs/packages/http-runtime-contract.md)
- [迁移指南](../../docs/migration/application-migration.md)
- [Changelog](../../CHANGELOG.md)
