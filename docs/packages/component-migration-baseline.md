# 首批组件基准与公开契约

本文冻结第一阶段 UI 迁移的规范来源和兼容目标，避免生成器任意选择某个应用目录作为唯一基准。

## 1. 审计范围

2026-09-09 对以下仓库的 `src/components` 进行了逐文件 SHA-256 对比：

- `g2rain-app-template`
- `g2rain-cms-app`
- `g2rain-department-app`
- `g2rain-infra-app`
- `g2rain-manager-app`
- `g2rain-member-app`

结论：公共目录高度重复，但 `QueryForm`、`SortDialog`、`SortManagerButton` 和 `RemoteSelect` 已有分叉。迁移采用逐文件基准，并在公共包中去除应用耦合。

## 2. 逐文件规范来源

| 能力 | 规范来源 | 选择理由 | 生成时处理 |
| --- | --- | --- | --- |
| `QueryForm` | `g2rain-cms-app` | CMS、Department、Infra、Manager 四个仓库一致，包含较新的国际化文案 | 移除全局 `$t` 假设，改用 UI Translator 注入 |
| `TableSort/useTableSort.ts` | 任一六仓库版本 | 六个仓库完全一致 | 保持算法和公开类型 |
| `TableSort/SortableTable.vue` | 任一六仓库版本 | 六个仓库完全一致 | 将硬编码主色替换为 `--g2-color-primary` |
| `TableSort/TableColumn.vue` | 任一六仓库版本 | 六个仓库完全一致 | 将字符串注入键改为导出的 Symbol 键 |
| `SortDialog.vue`、`SortManagerButton.vue` | `g2rain-cms-app` | CMS、Department、Infra、Manager 四个仓库一致，包含国际化文案 | 使用 Translator，不依赖应用 i18n 实例 |
| `RemoteSelect/types.ts` | 任一六仓库版本 | 六个仓库完全一致 | 用 `unknown` 和泛型替换公开 `any` |
| `RemoteSelect/index.vue` | `g2rain-manager-app` | 包含其他版本能力并新增 `focus`、`openDropdown` | 保留 Expose；移除 Locale Store 和平台 i18n 导入 |
| `ApiSelect.vue`、`DictSelect.vue` | `g2rain-cms-app` | CMS、Department、Infra、Manager 四个仓库一致 | 使用 Translator；API 由 Props 注入 |

以下为最初第一阶段的排除记录；后续决定将前三项公共化，当前实现与迁移行为以 [平台数据组件](platform-data-components.md) 为准：

| 组件 | 原因 |
| --- | --- |
| `OrganSelect` | 直接依赖 AccessToken Store 和组织领域语义 |
| `DictText` | 直接依赖 Locale Store 与字典领域 API |
| `StatusSwitch` | 直接依赖 Locale、i18n 和字典更新 API |
| `UserSelect` | 当前仅 Department 存在，属于用户领域适配 |

OrganSelect、DictText、StatusSwitch 已进入 `@g2rain/ui`，通过数据 Provider 和回调隔离应用依赖；UserSelect 尚待后续实现。

## 3. UI 能力注入

公共组件不能依赖全局 `$t`、Pinia 或具体 i18n 实例。`@g2rain/ui` 导出以下插件契约：

```ts
import type { App, InjectionKey } from 'vue'
import type { G2rainDataProviders } from '@g2rain/ui'

export type G2rainTranslator = (key: string, fallback: string) => string

export interface G2rainUiOptions {
  translate?: G2rainTranslator
  locale?: () => string | undefined
  dataProviders?: G2rainDataProviders
  onMissingProvider?: (name: 'organ' | 'dict') => void
}

export interface G2rainUiContext {
  translate: G2rainTranslator
  locale?: () => string | undefined
  dataProviders?: G2rainDataProviders
  onMissingProvider?: (name: 'organ' | 'dict') => void
}

export const G2RAIN_UI_CONTEXT: InjectionKey<G2rainUiContext>
export const G2rainUi: { install(app: App, options?: G2rainUiOptions): void }
```

默认 Translator 返回 `fallback`。应用在组合根注入 i18n、语言与平台数据能力：

```ts
app.use(G2rainUi, {
  translate: (key, fallback) => t(key, fallback),
  locale: () => localeStore.locale,
  dataProviders: {
    organ: {
      loadOptions: params => organApi.select(params),
      getPolicy: () => ({
        defaultValue: tokenStore.isAdminCompany ? null : tokenStore.organId,
        clearable: tokenStore.isAdminCompany,
        autoSelectFirstWhenEmpty: !tokenStore.isAdminCompany && tokenStore.organId == null,
      }),
    },
    dict: {
      loadOptions: params => dictService.select(params),
    },
  },
})
```

`dataProviders` 与平台组件行为见[平台数据组件](platform-data-components.md)。公共组件内部通过 `useG2rainUi()` 读取上下文。`useG2rainUi()` 未安装插件时必须返回默认上下文，按需导入组件不能因此报错。
## 4. QueryForm 契约

第一版保持现有公开行为：

```ts
export interface QueryFormData {
  id?: number
  createTime?: [string, string]
  updateTime?: [string, string]
  sorts?: string[]
  [key: string]: unknown
}

export interface QueryFormExpose {
  updateSorts(sortParams: Record<string, string>): void
  updateSortFromTable(sort: {
    prop?: string
    order?: 'ascending' | 'descending' | null
  }): void
  reset(): void
}
```

公开契约：

- 必填 `v-model: QueryFormData`。
- 事件：`search`。
- Slots：默认 Slot、`actions`。
- Reset 只清理基础字段，保留扩展字段和默认 Slot 管理的业务状态。
- 同时兼容 `reactive` 对象和普通 Ref，不因整对象替换导致父级响应失效。
- 所有内置文案通过 Translator 获取并提供中文 fallback。

## 5. TableSort 契约

```ts
export type SortOrder = 'ascending' | 'descending'

export interface SortItem {
  prop: string
  order: SortOrder
}

export interface SortColumn {
  prop: string
  label: string
  sortable?: boolean
}

export interface SortableTableExpose {
  openSortConfig(): void
  getSortParams(): Record<string, string>
  getSortString(): string
  tableRef: unknown
}
```

`SortableTable`：

- Props：`enableMultiSort?: boolean`，默认 `true`；`initialSort?: SortItem[]`，默认空数组。
- 事件：`sort-change(sortParams: Record<string, string>)`。
- Slot：默认 Slot。
- Expose：`openSortConfig`、`getSortParams`、`getSortString`、`tableRef`。

`TableColumn`：

- 透传 Element Plus TableColumn Attributes 和默认/Header Slots。
- Props：`sortable?: boolean | 'custom'`、`sortBy?: string | ((row: unknown) => unknown)`、`sortOrders?: Array<SortOrder | null>`。
- 默认排序顺序为 ascending、descending、null。

内部 Provide/Inject 必须使用包内导出的 Symbol，不使用 `registerColumn`、`tableSort` 等裸字符串，防止宿主冲突。

## 6. RemoteSelect 契约

```ts
export interface RemoteSelectFetchParams {
  key?: string
  value?: number
  signal?: AbortSignal
}

export type RemoteSelectOption = Record<string, unknown>

export type FetchDataFunction<T extends RemoteSelectOption = RemoteSelectOption> = (
  params: RemoteSelectFetchParams,
) => Promise<readonly T[]>

export interface RemoteSelectExpose {
  focus(): Promise<void>
  openDropdown(): Promise<void>
}
```

`RemoteSelect`：

- Props：`modelValue`、`fetchData`、`valueKey`、`labelKey`、`placeholder`、`clearable`、`disabled`、`width`、`debounceDelay`、`prefetchOnOpen`、`autoSelectFirstWhenEmpty`。
- 默认值保持 Manager 基准：`valueKey=value`、`labelKey=label`、宽度 200px、防抖 300ms，两个布尔增强项默认 false。
- 事件：`update:modelValue`、`change`、`clear`。
- Expose：`focus`、`openDropdown`。
- 新请求开始或组件卸载时中止旧请求；不支持 AbortSignal 的旧 API 可以忽略可选参数。
- 仅最后一次未取消请求可以更新 options 和 loading。
- Placeholder 通过 Translator 获取，显式 Prop 优先。

`ApiSelect`：

- Props 兼容 CMS 基准，并保留 `allowEmptyKeyword` 和 `prefetchOnOpen`。
- 默认 `valueKey=id`、`labelKey=name`、`allowEmptyKeyword=false`。
- API 方法适配为 `FetchDataFunction`，不导入具体 API。

`DictSelect`：

- `modelValue` 规范化为 `string | null | undefined`。
- API 方法由 Prop 注入，并允许附加 `usageCode`。
- 默认 `valueKey=code`、`labelKey=name`。

## 7. 生成与验证规则

1. 生成前记录上述基准文件当时的 Git commit；若工作区未提交，记录 `working-tree` 并在差异报告中说明。
2. 不整目录复制；每个文件按表中来源提取。
3. 先建立 characterization tests，冻结现有行为，再做能力注入和类型收紧。
4. 去耦重构不得改变公开事件时序和默认值。
5. 与基准有意不同的行为必须记录在迁移说明和 Changelog。
6. 试点应用使用兼容转发入口，验证通过后再删除本地副本。
