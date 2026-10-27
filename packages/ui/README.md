# @g2rain/ui

Vue 3 公共组件与组合式函数。组件通过 Props、事件和 Provider 获得应用能力，不读取应用 Store、路由或环境配置。

## 安装与初始化

```bash
npm install @g2rain/ui @g2rain/theme vue element-plus @element-plus/icons-vue
```

peer 范围：`vue ^3.5.0`、`element-plus ^2.13.0`、`@element-plus/icons-vue ^2.3.2`、`@g2rain/theme ^1.0.1`。应用注册 Element Plus，并显式引入样式：

```ts
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@g2rain/theme/styles.css'
import '@g2rain/ui/style.css'
import { G2rainUi } from '@g2rain/ui'
import { G2rainPlatformUi } from '@g2rain/ui/platform'

// app、t、localeStore 和各 API 由应用提供
app.use(ElementPlus)
app.use(G2rainUi, {
  translate: (key, fallback) => t(key, fallback),
  locale: () => localeStore.locale,
})
app.use(G2rainPlatformUi, {
  dataProviders: {
    organ: { loadOptions: params => organApi.select(params) },
    dict: { loadOptions: params => dictApi.select(params) },
  },
  permission: { isEnabled: code => permissionService.isEnabled(code) },
})
```

插件只注入上下文，不全局注册组件。`translate` 接收 `(key, fallback)`，缺省返回 fallback。`locale` 应读取响应式状态，以便组件监听语言变化。

## 入口与导出

| 入口 | 导出 |
| --- | --- |
| `@g2rain/ui` | `QueryForm`、`RemoteSelect`、`ApiSelect`、`SortableTable`、`TableColumn`、`SortDialog`、`TableSortColumn`、`SortManagerButton`、`useTableSort`、`TABLE_SORT_CONTEXT`、`G2rainUi`、`useG2rainUi`、`G2RAIN_UI_CONTEXT` 及相关类型 |
| `@g2rain/ui/platform` | `OrganSelect`、`DictSelect`、`DictText`、`StatusSwitch`、`G2rainPlatformUi`、`useG2rainPlatformUi`、`G2RAIN_PLATFORM_UI` 及 Provider 类型 |
| `@g2rain/ui/style.css` | 组件样式 |

`TableSortColumn` 与 `SortDialog` 是同一组件的两个导出名称。

## RemoteSelect 与 ApiSelect

`RemoteSelect` 必须传入 `fetchData(params)`，返回选项数组。`params` 包含可选的 `key`、`value`、`signal`；默认选项字段为 `value/label`，可用 `valueKey/labelKey` 修改。

- `v-model` 支持字符串、数字、null 和 undefined；事件为 `update:modelValue`、`change`、`clear`。
- 默认宽度 `200px`、防抖 `300ms`、可清空；`prefetchOnOpen` 和 `autoSelectFirstWhenEmpty` 默认 false。
- 开启预取后，在挂载和打开下拉时按需加载默认列表。清空搜索恢复默认列表；未开启预取时清空列表。
- 预取、回显、搜索分别取消各自的过期请求。搜索先查本地已知选项；有本地命中时不发远程请求。
- 纯数字搜索转成数值 `value`，其余为 `key`；初始数值按 value 回显，初始字符串按 key 回显。
- 语言变化时取消旧请求、清空缓存并重新预取和回显；加载期间保留已选项的当前标签。
- 暴露 `focus()`、`openDropdown()`；卸载时清理防抖和请求。

`ApiSelect` 使用 `apiMethod`，默认选项字段 `id/name`。只有 `allowEmptyKeyword` 与 `prefetchOnOpen` 同时为 true 才执行空条件 API 查询。

## 组织与字典 Provider

`G2rainPlatformUi` 的 `dataProviders.organ` 提供 `loadOptions` 和可选 `getPolicy`。组织策略可返回 `defaultValue`、`clearable`、`autoSelectFirstWhenEmpty`。

`OrganSelect` 默认字段 `organId/organName`，默认开启预取。显式 `apiMethod` 优先于 Provider；显式 `defaultValue=null` 关闭默认机构回填。组织值规范化为数字；组件 Props 优先于策略。

`dataProviders.dict.loadOptions` 参数包括 `key`、`code`、`usageCode`、`dictCode`、`locale`、`signal`、可选 `query`。**DictSelect 的搜索关键字在顶层 `key`**，应用装配须读取该字段。

`DictSelect` 默认字段 `code/name`，值规范化为字符串。显式 `apiMethod` 优先于 Provider；有 `usageCode` 时开启预取；没有 usageCode 且没有关键字时不查询。数字搜索也转换为字符串关键字；usageCode 变化时重新创建内部选择器。

`DictText` 按 `value` 显示字典名称，默认空值显示 `-`。支持 `options`、`apiMethod` 或字典 Provider；布尔值按 true/1/yes/y 或 false/0/no/n 匹配字典编码。无匹配项时显示原始值。默认插槽提供 `text/loading`。

缺少组织或字典 Provider 时，对应组件通知可选 `onMissingProvider`，返回空数据。

## StatusSwitch 与权限

默认开关值为 `ACTIVE/INACTIVE`；`activeValue/inactiveValue` 可配置字符串、数字或布尔值。标签可由 `options`、`fetchOptions` 或字典 Provider 提供。

- `submit(next, previous)` 优先于 `apiMethod({ nextValue, prevValue })`；都未提供时直接执行本地值更新。
- 提交期间禁用开关；成功后回写 `v-model` 并发出 `change/success`。外部值已变化时不覆盖，但仍发 success；卸载后不回写或发业务事件。
- 提交失败发出 `error`，字典加载失败发出 `load-error`；组件不自动弹出错误提示。
- 设置 `permission` 时读取 UI Provider 的 `permission.isEnabled`；未注入则禁用。未设置 permission 时不做此判断。

Platform 的权限插件与 UI Provider 分别安装。应用可将 `isPageElementEnabled(provider, code)` 接到 UI 的 `isEnabled`，共用同一权限源。`v-permission` 控制其他页面元素；状态开关使用自己的 permission 属性。

## 查询与排序

`QueryForm` 必须绑定 `v-model`，提供 ID、创建时间、更新时间条件及默认查询/重置按钮。ID 转为数字，时间区间为两个时间字符串。默认插槽放扩展条件，`actions` 插槽替换操作区。

查询与默认重置发出 `search`。重置清理内置三个条件，保留 `sorts` 和扩展字段；支持响应式对象和通过 v-model 整体替换的普通对象。暴露方法及事件类型见 [QueryForm 类型](src/query-form/types.ts)。

`SortableTable` 包装 Element Plus Table，默认开启多列排序，接受 `initialSort`。列通过 `TableColumn` 注册；排序变化发出 `sort-change`，载荷为字段到排序方向的对象。`SortDialog` 提供排序配置，`SortManagerButton` 打开配置，`useTableSort` 提供排序状态和序列化。具体 Props 与方法见 [排序类型](src/table-sort/types.ts)和[组件源码](src/table-sort/SortableTable.vue)。

## 参考

- [根使用手册](../../README.md)
- [平台数据组件](../../docs/packages/platform-data-components.md)
- [组件接口说明](../../docs/packages/component-migration-baseline.md)
