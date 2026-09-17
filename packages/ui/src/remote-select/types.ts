export interface RemoteSelectFetchParams {
  key?: string
  value?: number
  signal?: AbortSignal
}

export type RemoteSelectOption = Record<string, unknown>

export type FetchDataFunction<
  T extends RemoteSelectOption = RemoteSelectOption,
> = (params: RemoteSelectFetchParams) => Promise<readonly T[]>

export interface RemoteSelectExpose {
  focus(): Promise<void>
  openDropdown(): Promise<void>
}

export type RemoteSelectValue = number | string | null | undefined

