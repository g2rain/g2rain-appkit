<template>
  <el-dialog
    :model-value="dialogVisible"
    :title="translate('G2_SORT_TITLE', '排序配置')"
    width="500px"
    destroy-on-close
    @update:model-value="handleVisibleChange"
  >
    <div class="g2-sort-dialog">
      <div v-if="draft.length > 0" class="g2-sort-dialog__list">
        <div v-for="(item, index) in draft" :key="item.prop" class="g2-sort-dialog__item">
          <el-row :gutter="10" align="middle">
            <el-col :span="8">{{ getColumnLabel(item.prop) }}</el-col>
            <el-col :span="8">
              <el-select v-model="item.order" size="small">
                <el-option :label="translate('G2_SORT_ASC', '升序')" value="ascending" />
                <el-option :label="translate('G2_SORT_DESC', '降序')" value="descending" />
              </el-select>
            </el-col>
            <el-col :span="8" class="g2-sort-dialog__actions">
              <el-button type="danger" link size="small" @click="removeSort(index)">
                {{ translate('G2_BTN_DELETE', '删除') }}
              </el-button>
            </el-col>
          </el-row>
        </div>
      </div>

      <div class="g2-sort-dialog__add">
        <el-row :gutter="10" align="middle">
          <el-col :span="12">
            <el-select
              v-model="newSort.prop"
              :placeholder="translate('G2_SORT_SELECT_COL', '选择列')"
              size="small"
              filterable
            >
              <el-option
                v-for="column in availableColumns"
                :key="column.prop"
                :label="column.label"
                :value="column.prop"
              />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-select v-model="newSort.order" size="small">
              <el-option :label="translate('G2_SORT_ASC', '升序')" value="ascending" />
              <el-option :label="translate('G2_SORT_DESC', '降序')" value="descending" />
            </el-select>
          </el-col>
          <el-col :span="4">
            <el-button type="primary" size="small" @click="addSort">
              {{ translate('G2_BTN_ADD', '添加') }}
            </el-button>
          </el-col>
        </el-row>
      </div>
    </div>

    <template #footer>
      <el-button @click="cancel">{{ translate('G2_BTN_CANCEL', '取消') }}</el-button>
      <el-button type="primary" @click="apply">
        {{ translate('G2_BTN_APPLY', '应用') }}
      </el-button>
    </template>
  </el-dialog>

  <el-button v-if="showInActionColumn" type="primary" link size="small" @click="openSortConfig">
    {{ translate('G2_SORT_CONFIG', '排序配置') }}
  </el-button>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useG2rainUi } from '../context'
import type { SortColumn, SortItem } from './types'

defineOptions({ name: 'G2SortDialog' })

const props = withDefaults(
  defineProps<{
    columns: SortColumn[]
    modelValue?: SortItem[]
    showInActionColumn?: boolean
    visible?: boolean
  }>(),
  {
    modelValue: () => [],
    showInActionColumn: true,
    visible: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: SortItem[]]
  'sort-change': [value: SortItem[]]
  'update:visible': [value: boolean]
}>()

const { translate } = useG2rainUi()
const dialogVisible = ref(props.visible)
const draft = ref<SortItem[]>([])
const newSort = reactive<SortItem>({ prop: '', order: 'ascending' })
const availableColumns = computed(() =>
  props.columns.filter(
    (column) => column.sortable !== false && !draft.value.some((item) => item.prop === column.prop),
  ),
)

const cloneModel = (): SortItem[] => props.modelValue.map((item) => ({ ...item }))
const getColumnLabel = (prop: string): string =>
  props.columns.find((column) => column.prop === prop)?.label ?? prop

function openSortConfig(): void {
  draft.value = cloneModel()
  dialogVisible.value = true
  emit('update:visible', true)
}

function handleVisibleChange(visible: boolean): void {
  dialogVisible.value = visible
  if (visible) draft.value = cloneModel()
  emit('update:visible', visible)
}

function addSort(): void {
  if (!newSort.prop || draft.value.some((item) => item.prop === newSort.prop)) return
  draft.value.push({ ...newSort })
  newSort.prop = ''
  newSort.order = 'ascending'
}

function removeSort(index: number): void {
  draft.value.splice(index, 1)
}

function cancel(): void {
  draft.value = cloneModel()
  dialogVisible.value = false
  emit('update:visible', false)
}

function apply(): void {
  const value = draft.value.map((item) => ({ ...item }))
  emit('update:modelValue', value)
  emit('sort-change', value)
  dialogVisible.value = false
  emit('update:visible', false)
}

watch(
  () => props.visible,
  (visible) => {
    dialogVisible.value = visible
    if (visible) draft.value = cloneModel()
  },
)

watch(
  () => props.modelValue,
  () => {
    if (!dialogVisible.value) draft.value = cloneModel()
  },
  { deep: true },
)

defineExpose({ openSortConfig })
</script>

<style scoped>
.g2-sort-dialog {
  padding: var(--g2-space-sm) 0;
}

.g2-sort-dialog__list {
  margin-bottom: var(--g2-space-md);
}

.g2-sort-dialog__item {
  padding: var(--g2-space-sm);
  margin-bottom: var(--g2-space-sm);
  color: var(--g2-text-regular);
  background: var(--g2-bg-muted);
  border: 1px solid var(--g2-border-color-light);
  border-radius: var(--g2-border-radius-base);
}

.g2-sort-dialog__actions {
  text-align: right;
}

.g2-sort-dialog__add {
  padding-top: var(--g2-space-sm);
  border-top: 1px solid var(--g2-border-color-light);
}
</style>

