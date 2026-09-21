import type { RemoteSelectOption, RemoteSelectFetchParams } from './remote-select/types'

export interface DataQueryContext {
  locale?: string
  signal?: AbortSignal
  query?: Readonly<Record<string, unknown>>
}
export interface EntityDataProvider<T extends RemoteSelectOption = RemoteSelectOption> {
  loadOptions(params: RemoteSelectFetchParams & DataQueryContext): Promise<readonly T[]>
}
export interface OrganSelectionPolicy {
  defaultValue?: number | null
  clearable?: boolean
  autoSelectFirstWhenEmpty?: boolean
}
export interface OrganDataProvider extends EntityDataProvider {
  getPolicy?: () => OrganSelectionPolicy
}
export interface DictQuery extends DataQueryContext {
  code?: string
  dictCode?: string
  usageCode?: string
}
export type DictLoader = (params: DictQuery) => Promise<readonly RemoteSelectOption[]>
export interface G2rainDataProviders {
  organ?: OrganDataProvider
  dict?: { loadOptions: DictLoader }
  /** 预留给后续 UserSelect 等实体选择器，当前组件不读取。 */
  entities?: Readonly<Record<string, EntityDataProvider>>
}
