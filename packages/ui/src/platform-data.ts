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
  /** Shared contract for later UserSelect and other entity selectors. */
  entities?: Readonly<Record<string, EntityDataProvider>>
}
