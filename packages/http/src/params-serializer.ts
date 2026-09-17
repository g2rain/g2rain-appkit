export function rfc3986Encode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%3A/gi, ':')
}

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

export function defaultParamsSerializer(params: unknown): string {
  const searchParams = new URLSearchParams()
  appendParamsFromSource(searchParams, params)
  return [...searchParams.entries()]
    .map(([key, value]) => [rfc3986Encode(key), rfc3986Encode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}
