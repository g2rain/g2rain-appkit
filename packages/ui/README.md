# `@g2rain/ui`

G2rain 可复用 Vue 3 组件。依赖宿主提供的 `vue`、`element-plus`、`@element-plus/icons-vue` 与 `@g2rain/theme`。

## Install

```bash
npm install @g2rain/ui @g2rain/theme
```

## Usage

```ts
import '@g2rain/theme/styles.css'
import '@g2rain/ui/style.css'
import { G2rainUi, QueryForm, OrganSelect } from '@g2rain/ui'

app.use(G2rainUi, {
  translate: (key, fallback) => t(key, fallback),
  locale: () => localeStore.locale,
  dataProviders: {
    organ: { loadOptions: params => organApi.select(params) },
    dict: { loadOptions: params => dictService.select(params) },
  },
})
```

主要导出：`QueryForm`、`SortableTable`、`TableColumn`、`RemoteSelect`、`ApiSelect`、`DictSelect`、`OrganSelect`、`DictText`、`StatusSwitch`。

## Docs

- [组件基准](../../docs/packages/component-migration-baseline.md)
- [平台数据组件](../../docs/packages/platform-data-components.md)
- [迁移指南](../../docs/migration/application-migration.md)
- [Changelog](../../CHANGELOG.md)
