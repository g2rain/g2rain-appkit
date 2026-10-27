# @g2rain/http

基于 Axios 的 ESM HTTP Client，提供统一响应处理、错误模型、Token 刷新、DPoP、参数序列化和 SSE。应用注入会话、刷新、语言与错误处理，本包不持有应用 Store。

## 安装和使用

```bash
npm install @g2rain/http
```

以下会话和错误处理函数由应用提供：

```ts
import { createHttpClient } from '@g2rain/http'

const { client, axios, dispose } = createHttpClient({
  baseURL: '/api',
  authSessionProvider: () => getSession(),
  ensureAccessToken: options => refreshSession(options),
  authErrorHandler: (reason, error) => handleAuthError(reason, error),
  getLocale: () => getLocale(),
  onError: error => showError(error),
})

const result = await client.get<{ id: number }>('/items/1')
console.log(result.data)
dispose()
```

工厂返回底层 `axios`、封装的 `client` 和 `dispose`。Client 提供 `request/get/post/put/patch/delete/sse`。`get/delete` 第二参数为查询条件；`post/put/patch` 第二参数为正文；其余请求选项使用 AxiosRequestConfig。普通请求默认超时 10 秒。

## 工厂配置

| 参数 | 默认值与行为 |
| --- | --- |
| `baseURL` | Axios 基础地址 |
| `withAuth` | true；false 时不装配认证、刷新或 DPoP |
| `isDirectResponse` | false；true 时返回原始响应体，跳过成功 HTTP 响应的 Result 业务判定 |
| `authSessionProvider` | 应用会话快照读取函数 |
| `ensureAccessToken` | 刷新回调，接收可选 `{ force }`，完成后须更新 Provider |
| `maxAuthRetries` | 1；支持 0 或 1 |
| `authErrorHandler` | 接收 NO_LOGIN 或 TOKEN_REFRESH_FAILED 及错误 |
| `getLocale` | 请求没有 Accept-Language 时，使用返回的语言 |
| `onError` | 请求失败后的统一处理回调；取消错误不通知 |
| `dpop` | 默认关闭；提供 `{ applicationCode }` 时开启签名 |

会话包含 `isLogin`、`isAccessTokenValid`、`tokenExpired`、`tokenString`、`client` 和 `setTokenExpired`。启用认证且提供 Provider 时装配 Bearer。JWT 有效性由 Provider 判断；本包不自行解析 JWT 到期时间。

## 响应和错误

默认 `HttpResponse<T>` 为完整 `Result<T>`，包含 requestId、requestTime、status、errorCode、errorMessage、data。成功值为 status 0 或 200。

运行时 Result 判定要求非空对象、数值 status，以及 errorCode/errorMessage 字段存在。匹配 Result 且 status 非成功时抛业务错误；其他响应体按原样返回，不做结构补全。`isDirectResponse: true` 应配合调用方自己的响应类型使用。

`G2rainHttpError` 字段为 `errorCode`、`source`、`status`、`requestId`、`retryable`、`detail`，原始异常通过 Error.cause 保留。source 为 network/backend/auth/client；网络失败默认 retryable，但该标记不触发网络自动重试。后端 Result 错误在 detail 中保留响应。错误通知回调失败不替换原始请求错误。

## 认证与刷新

未登录时通知 NO_LOGIN 并拒绝请求。请求前本地 Token 无效时普通刷新，tokenExpired 为 true 时强制刷新。刷新成功后验证会话有效性并清理失效标记。

HTTP 401 与 gateway.40002 进入认证重试；发出时 Token 仍等于当前 Token 才强制刷新，否则用已更新 Token 重放。每个请求最多重试一次。gateway.40001 通知 NO_LOGIN 且不刷新。刷新按 Client 合并，强制刷新不会被在途普通刷新吞掉。取消请求立即停止等待共享刷新，不取消供其他请求使用的刷新回调。

`dispose()` 禁止后续封装请求、卸载拦截器并主动取消在途 SSE；普通在途请求在后续检查点检测释放状态，不保证被主动中止。已进入应用刷新回调的操作由应用自身管理。

## 序列化和 DPoP

默认查询序列化跳过 null/undefined；数组使用重复键。键和值编码后按键和值排序；百分号编码保留冒号。对象、字符串查询和 URLSearchParams 可作为参数源。

正文转换在签名前执行；字符串正文默认 application/json，FormData 用原生 Response 编码一次以固定 boundary 和字节。启用 DPoP 时需提供会话 client 的 clientId、公私 JWK 及认证状态；运行环境须支持 Web Crypto、Response 等所用 Web API。

DPoP 的 htu 原样取 config.url，不拼接 baseURL；查询串用于 pha，签名与重放复用同一序列化结果。不要在 Adapter 内再次变换已签名正文。独立导出包括 `createDpopProof`、`defaultParamsSerializer`、正文工具、错误类及类型，详见 [公开导出](src/index.ts)。

## SSE

```ts
const controller = new AbortController()
await client.sse<{ text: string }, { prompt: string }>(
  '/chat',
  { prompt: 'hello' },
  event => console.log(event.text),
  { signal: controller.signal },
)
```

SSE 默认 POST、Accept 为 text/event-stream、fetch Adapter、responseType 为 stream、timeout 为 0。认证、语言和 DPoP 与普通请求共用拦截器。JSON Content-Type 的流式响应先按 JSON 读出，再进行 Result 判定；失败 HTTP 响应中的流也先读取后标准化。

事件按空行切分，合并 data 行并按 JSON 解析后交给同步 onEvent。非 JSON 事件跳过并打印警告；回调抛错终止读取并释放流。流正常结束时 resolve。

调用方 signal 取消时以 CanceledError 结束。Client dispose 主动取消等待响应头或等待新数据的所有 SSE，以 HTTP_CLIENT_DISPOSED 结束；不等待下一段数据。请求结束时清理取消监听、释放 reader 和登记的请求资源。

## 参考

- [根使用手册](../../README.md)
- [类型定义](src/types.ts)与[实现](src/client.ts)
- [HTTP 与 Runtime 契约](../../docs/packages/http-runtime-contract.md)
