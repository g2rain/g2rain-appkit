import axios, { type InternalAxiosRequestConfig } from 'axios'

/** 用 Response 编码一次 FormData。返回的字节和 boundary 同时给传输和签名使用。 */
export async function buildMultipartFormDataBytes(form: FormData): Promise<{ body: ArrayBuffer; contentType: string }> {
  const response = new Response(form)
  const contentType = response.headers.get('Content-Type')
  if (!contentType) throw new Error('Multipart encoder did not produce a Content-Type')
  return { body: await response.arrayBuffer(), contentType }
}

/**
 * 在签名前把 body 定成最终字节。
 * multipart 用 Response 编码一次，传输和 DPoP 共用同一个 boundary。
 * 最后把 transformRequest 固定为恒等函数，避免重试时 Axios 再次改写已签名内容。
 */
export async function prepareRequestBody(config: InternalAxiosRequestConfig): Promise<void> {
  let data: unknown = config.data
  const contentType = String(config.headers.getContentType() ?? '').toLowerCase()
  if (contentType.startsWith('multipart/form-data') && data != null && !(data instanceof FormData) && typeof data === 'object' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data) && !(data instanceof Blob)) {
    data = axios.toFormData(data as Record<string, unknown>, new FormData())
  }
  if (data instanceof FormData) {
    const encoded = await buildMultipartFormDataBytes(data)
    config.data = encoded.body
    config.headers.setContentType(encoded.contentType)
  } else {
    const transforms = config.transformRequest == null ? [] : Array.isArray(config.transformRequest) ? config.transformRequest : [config.transformRequest]
    for (const transform of transforms) data = transform.call(config, data, config.headers)
    config.data = data
  }
  // 之后的 Axios 变换必须保持恒等，包括重放，不能再改已签名的字节。
  config.transformRequest = [(value: unknown) => value]
}

/** 未编码的 FormData 不能拿去签名，否则会把空对象当成正文。 */
export async function toRequestBodyBytes(data: unknown): Promise<Uint8Array> {
  if (data instanceof FormData) throw new TypeError('Encode multipart data before signing')
  if (data == null) return new Uint8Array()
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer())
  const text = typeof data === 'string'
    ? data
    : data instanceof URLSearchParams
      ? data.toString()
      : JSON.stringify(data)
  return new TextEncoder().encode(text)
}
