<template>
  <el-form :model="model" :inline="true" class="g2-query-form">
    <el-form-item :label="translate('G2_FIELD_ID', 'ID')">
      <el-input
        :model-value="model.id"
        :placeholder="translate('G2_PH_ID', '请输入ID')"
        clearable
        class="g2-query-form__id"
        @update:model-value="onIdChange"
      />
    </el-form-item>

    <el-form-item :label="translate('G2_FIELD_CREATE_TIME', '创建时间')">
      <el-date-picker
        v-model="createTimeRange"
        type="datetimerange"
        :range-separator="translate('G2_LBL_RANGE_TO', '至')"
        :start-placeholder="translate('G2_PH_TIME_START', '开始时间')"
        :end-placeholder="translate('G2_PH_TIME_END', '结束时间')"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        class="g2-query-form__time-range"
        clearable
      />
    </el-form-item>

    <el-form-item :label="translate('G2_FIELD_UPDATE_TIME', '更新时间')">
      <el-date-picker
        v-model="updateTimeRange"
        type="datetimerange"
        :range-separator="translate('G2_LBL_RANGE_TO', '至')"
        :start-placeholder="translate('G2_PH_TIME_START', '开始时间')"
        :end-placeholder="translate('G2_PH_TIME_END', '结束时间')"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        class="g2-query-form__time-range"
        clearable
      />
    </el-form-item>

    <slot />

    <slot name="actions">
      <el-form-item>
        <el-button type="primary" @click="emit('search')">
          {{ translate('G2_BTN_QUERY', '查询') }}
        </el-button>
        <el-button @click="handleReset">
          {{ translate('G2_BTN_RESET', '重置') }}
        </el-button>
      </el-form-item>
    </slot>
  </el-form>
</template>

<script setup lang="ts">
import { computed, isReactive } from 'vue'
import { useG2rainUi } from '../context'
import type { QueryFormData, TableSortChange } from './types'

defineOptions({ name: 'G2QueryForm' })

const model = defineModel<QueryFormData>({ required: true })
const emit = defineEmits<{ search: [] }>()
const { translate } = useG2rainUi()

function updateField<K extends keyof QueryFormData>(
  key: K,
  value: QueryFormData[K],
): void {
  if (isReactive(model.value)) {
    model.value[key] = value
    return
  }

  model.value = { ...model.value, [key]: value }
}

function onIdChange(value: string | number | null | undefined): void {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === '' || normalized === null || normalized === undefined) {
    updateField('id', undefined)
    return
  }

  const numberValue = Number(normalized)
  updateField('id', Number.isNaN(numberValue) ? undefined : numberValue)
}

function useTimeRange(field: 'createTime' | 'updateTime') {
  return computed<[string, string] | null>({
    get: () => {
      const value = model.value[field]
      return value?.length === 2 ? [value[0], value[1]] as [string, string] : null
    },
    set: (value: [string, string] | null) =>
      updateField(field, value ? [value[0], value[1]] : undefined),
  })
}

const createTimeRange = useTimeRange('createTime')
const updateTimeRange = useTimeRange('updateTime')

function updateSorts(sortParams: Record<string, string>): void {
  const sorts = Object.entries(sortParams)
    .filter(([key, value]) => Boolean(key && value))
    .map(([key, value]) => `${key},${value.toLowerCase() === 'desc' ? 'desc' : 'asc'}`)

  updateField('sorts', sorts.length > 0 ? sorts : undefined)
}

function updateSortFromTable(sort: TableSortChange): void {
  if (!sort.prop || !sort.order) {
    updateField('sorts', undefined)
    return
  }

  updateField('sorts', [
    `${sort.prop},${sort.order === 'descending' ? 'desc' : 'asc'}`,
  ])
}

function handleReset(): void {
  updateField('id', undefined)
  updateField('createTime', undefined)
  updateField('updateTime', undefined)
  updateField('sorts', undefined)
  emit('search')
}

defineExpose({
  updateSorts,
  updateSortFromTable,
  reset: handleReset,
})
</script>

<style scoped>
.g2-query-form {
  margin: 0;
}

.g2-query-form__id {
  width: 200px;
}

.g2-query-form__time-range {
  width: 400px;
}
</style>
