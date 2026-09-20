<template>
  <main class="playground-shell">
    <header class="playground-header">
      <div>
        <p class="eyebrow">G2RAIN APPKIT</p>
        <h1>公共组件 Playground</h1>
        <p>从正式 npm exports 入口组合验证 Theme 与 UI。</p>
      </div>
      <el-switch
        v-model="dark"
        inline-prompt
        active-text="暗"
        inactive-text="亮"
        @change="applyTheme"
      />
    </header>

    <section class="demo-card">
      <h2>平台数据组件</h2>
      <OrganSelect v-model="organId" />
      <p>状态：<DictText :value="status" usage-code="status" /></p>
      <StatusSwitch v-model="status" usage-code="status" :submit="saveStatus" @error="statusMessage = '模拟提交失败，原状态已保留'" @success="statusMessage = '提交成功'" />
      <el-checkbox v-model="failStatus">模拟提交失败</el-checkbox>
      <p class="result">{{ statusMessage }}</p>
    </section>

    <section class="demo-card">
      <h2>QueryForm</h2>
      <QueryForm ref="queryFormRef" v-model="query" @search="searchCount += 1">
        <el-form-item label="名称">
          <el-input v-model="query.name" placeholder="业务扩展字段" />
        </el-form-item>
      </QueryForm>
      <p class="result">触发查询 {{ searchCount }} 次 · {{ JSON.stringify(query) }}</p>
    </section>

    <section class="demo-card">
      <div class="section-heading">
        <h2>RemoteSelect</h2>
        <span>支持防抖、取消旧请求和初始值加载</span>
      </div>
      <RemoteSelect
        v-model="selectedUser"
        :fetch-data="fetchUsers"
        value-key="id"
        label-key="name"
        width="320px"
        prefetch-on-open
      />
    </section>

    <section class="demo-card">
      <div class="section-heading">
        <h2>TableSort</h2>
      </div>
      <SortableTable :data="rows" @sort-change="sorts = $event">
        <TableColumn prop="id" label="ID" width="100" />
        <TableColumn prop="name" label="名称" />
        <TableColumn prop="createdAt" label="创建时间" />
        <TableColumn label="操作" :sortable="false" width="120">
          <SortManagerButton show-label />
        </TableColumn>
      </SortableTable>
      <p class="result">排序参数：{{ JSON.stringify(sorts) }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { createThemeController } from '@g2rain/platform/theme'
import {
  QueryForm,
  RemoteSelect,
  SortableTable,
  SortManagerButton,
  TableColumn,
} from '@g2rain/ui'
import {
  OrganSelect,
  DictText,
  StatusSwitch,
} from '@g2rain/ui/platform'
import type {
  FetchDataFunction,
  QueryFormData,
  QueryFormExpose,
  RemoteSelectOption,
} from '@g2rain/ui'

const dark = ref(false)
const organId = ref<number | null>(null)
const status = ref('INACTIVE')
const failStatus = ref(false)
const statusMessage = ref('点击开关验证异步提交')
async function saveStatus() {
  await new Promise(resolve => setTimeout(resolve, 400))
  if (failStatus.value) throw new Error('Demo update failed')
}
const themeController = createThemeController()
const query = ref<QueryFormData>({ name: '' })
const queryFormRef = ref<QueryFormExpose>()
const searchCount = ref(0)
const selectedUser = ref<number | string | null>()
const sorts = ref<Record<string, string>>({})
const rows = [
  { id: 1, name: 'Alpha', createdAt: '2026-09-10' },
  { id: 2, name: 'Beta', createdAt: '2026-09-09' },
]
const users: RemoteSelectOption[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' },
]

const fetchUsers: FetchDataFunction = async ({ key, value, signal }) => {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 120)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
  if (value !== undefined) return users.filter((item) => item.id === value)
  if (!key) return users
  return users.filter((item) => String(item.name).toLowerCase().includes(key.toLowerCase()))
}

function applyTheme(value: string | number | boolean): void {
  themeController.setTheme(value ? 'dark' : 'light')
}

onBeforeUnmount(() => {
  themeController.dispose()
})
</script>
