/** RFC 3986 百分号编码，但保留冒号，与现有验签实现一致。 */
export function rfc3986Encode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%3A/gi, ':')
}

/**
 * 展平查询参数。null 和 undefined 跳过，数组按同名键重复出现。
 * 对象键的原始顺序不保留，最终顺序由 defaultParamsSerializer 决定。
 */
export function appendParamsFromSource(target: URLSearchParams, source: unknown): void {
  if (source == null || source === '') return

  if (typeof source === 'string') {
    const entries = new URLSearchParams(source.startsWith('?') ? source.slice(1) : source)
    entries.forEach((value, key) => target.append(key, value))
    return
  }

  if (source instanceof URLSearchParams) {
    source.forEach((value, key) => target.append(key, value))
    return
  }

  if (typeof source === 'object') {
    for (const [key, value] of Object.entries(source)) {
      if (value == null) continue
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item != null) target.append(key, String(item))
      }
    }
  }
}

/**
 * 稳定序列化查询串：键和值分别编码后按键、值排序。
 * 同一组参数必须得到同一字符串，DPoP 才能让传输和 proof 使用同一份查询串。
 */
export function defaultParamsSerializer(params: unknown): string {
  const searchParams = new URLSearchParams()
  appendParamsFromSource(searchParams, params)
  return [...searchParams.entries()]
    .map(([key, value]) => [rfc3986Encode(key), rfc3986Encode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}
