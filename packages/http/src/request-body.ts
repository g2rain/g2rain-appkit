import axios, { type InternalAxiosRequestConfig } from 'axios'

/** Encode once: both transport and signature consume the returned bytes and boundary. */
export async function buildMultipartFormDataBytes(form: FormData): Promise<{ body: ArrayBuffer; contentType: string }> {
  const response = new Response(form)
  const contentType = response.headers.get('Content-Type')
  if (!contentType) throw new Error('Multipart encoder did not produce a Content-Type')
  return { body: await response.arrayBuffer(), contentType }
}

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
  // No later Axios transformation may alter signed bytes, including on replay.
  config.transformRequest = [(value: unknown) => value]
}

/** Reject unencoded forms instead of hashing an empty JSON object. */
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
