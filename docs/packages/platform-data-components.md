# 平台数据组件与 Provider

OrganSelect、DictText、StatusSwitch 现统一进入 `@g2rain/ui`。组织、字典、用户属于可共享的平台概念；具体 API、Token、权限范围与缓存通过应用装配。当前交付前三个组件，UserSelect 后续沿用 EntityDataProvider，尚未实现。

## 应用入口

```ts
import { G2rainUi } from '@g2rain/ui'

app.use(G2rainUi, {
  locale: () => localeStore.locale,
  translate: (key, fallback) => t(key, fallback),
  // 应用可仅在开发环境提供诊断回调。
  onMissingProvider: name => console.warn(`Missing ${name} provider`),
  dataProviders: {
    organ: {
      loadOptions: ({ key, value, signal, query }) =>
        organApi.select({ ...query, key, value }, { signal }),
      getPolicy: () => ({
        defaultValue: tokenStore.isAdminCompany ? null : tokenStore.organId,
        clearable: tokenStore.isAdminCompany,
        autoSelectFirstWhenEmpty: !tokenStore.isAdminCompany && tokenStore.organId == null,
      }),
    },
    dict: {
      loadOptions: ({ code, usageCode, dictCode, locale, signal }) =>
        dictService.select({ code, usageCode, dictCode, locale }, { signal }),
    },
  },
})
```

上例 API 是应用适配示意，按实际方法签名实现。语言回调应读取响应式状态。缓存按语言、查询范围隔离，由应用管理；会话切换时应用负责失效缓存。Provider 可忽略可选 signal，但组件会阻止过期结果回写。

## 使用方式

```vue
<OrganSelect v-model="form.organId" />
<DictText :value="row.status" usage-code="member_status" />
<StatusSwitch v-model="row.status" :disabled="!canEdit"
  :api-method="({ nextValue }) => memberApi.updateStatus(row.id, nextValue)"
  @error="showUpdateError" />
```

OrganSelect 保留数值 ID、organId/organName 默认字段、200px 宽度、300ms 防抖、prefetchOnOpen=true，以及 update:modelValue/change/clear。支持 apiMethod、query、defaultValue、clearable、autoSelectFirstWhenEmpty，显式 Props 优先于 Provider；默认无策略时允许清空、不自动选择。搜索和数值 ID 回显复用 RemoteSelect，语言或 query 变化清除本组件选项缓存。提供 focus/openDropdown。组织加载错误通过 error 发出。

DictText 保留 value、usageCode、apiMethod、valueKey=code、labelKey=name、placeholder='-'；新增 dictCode 和 options。优先级 options（包括空数组）> apiMethod > Provider。数字按字符串匹配，布尔值兼容 true/1/yes/y、false/0/no/n，未匹配值显示原值。响应值、语言与字典范围变化，取消旧请求；错误通过 error 发出。默认 Slot 提供 text/loading。

StatusSwitch 默认 ACTIVE/INACTIVE、inlinePrompt=true，保留 apiMethod({nextValue,prevValue})、success/error 载荷。新增 submit(next,previous)，优先于 apiMethod；均不提供时仅本地切换。显式 options 优先于 fetchOptions 和字典 Provider，usageCode/dictCode 指定字典；字典加载错误触发 load-error。提交时禁用重复操作，失败保持原值；父组件在等待期间更改 modelValue 时不覆盖新的状态，卸载后不再发事件。

## 有意调整与迁移

- StatusSwitch 从旧版“先更新、失败回滚”改成“成功后更新”。成功事件顺序为 update:modelValue、change、success；失败仅 error。
- 不再自动 ElMessage 弹出提示；旧 successMessage/errorMessage 改由 success/error 事件处理，避免重复提示。
- OrganSelect 不读 Token Store；旧默认组织策略需要按上述 getPolicy 注入。
- 缺失加载器不发网络请求，调用可选 onMissingProvider；不会猜测业务 Endpoint。
- 保留原 apiMethod 作为单组件覆盖入口，现有业务 App 尚未自动替换本地副本。

## 扩展与来源

`EntityDataProvider<T>` 统一 key/value 搜索与回显、signal、locale、query。`dataProviders.entities` 预留 User 等实体加载器，后续新增专门的交互组件，不自动推断实体字段。

基准为本地 g2rain-member-app 的三个组件，并核对 CMS/Manager 组织版本差异；当前 member 工作目录没有 Git 元数据，来源记录为 working-tree，不虚构 commit。保留布尔字典匹配和组织策略，状态提交变化如上。

单元测试覆盖注入与 Prop 优先级、字典旧请求竞态、组织默认值、状态重复提交及失败语义；Playground 演示 Provider 组织、字典与状态成功/失败。真实 App 与 qiankun 联调尚未执行。
