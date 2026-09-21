<template>
  <el-select
    ref="selectRef"
    v-model="selectedValue"
    :placeholder="resolvedPlaceholder"
    :clearable="clearable"
    :disabled="disabled"
    :loading="loading"
    :suffix-icon="ArrowDown"
    filterable
    remote
    remote-show-suffix
    reserve-keyword
    :default-first-option="false"
    :remote-method="handleRemoteSearch"
    :style="{ width }"
    @visible-change="handleVisibleChange"
    @change="handleChange"
    @clear="handleClear"
  >
    <el-option
      v-for="item in options"
      :key="getValue(item)"
      :label="getLabel(item)"
      :value="getValue(item)"
    />
  </el-select>
</template>

<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import type { SelectInstance } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useG2rainUi } from '../context'
import type {
  FetchDataFunction,
  RemoteSelectFetchParams,
  RemoteSelectOption,
  RemoteSelectValue,
} from './types'

defineOptions({ name: 'G2RemoteSelect' })

const props = withDefaults(
  defineProps<{
    modelValue?: RemoteSelectValue
    fetchData: FetchDataFunction
    valueKey?: string
    labelKey?: string
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    width?: string
    debounceDelay?: number
    prefetchOnOpen?: boolean
    autoSelectFirstWhenEmpty?: boolean
  }>(),
  {
    modelValue: undefined,
    valueKey: 'value',
    labelKey: 'label',
    placeholder: undefined,
    clearable: true,
    disabled: false,
    width: '200px',
    debounceDelay: 300,
    prefetchOnOpen: false,
    autoSelectFirstWhenEmpty: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: RemoteSelectValue]
  change: [value: RemoteSelectValue]
  clear: []
}>()

const { translate } = useG2rainUi()
const selectRef = ref<SelectInstance>()
const selectedValue = ref<RemoteSelectValue>(props.modelValue)
const options = ref<RemoteSelectOption[]>([])
const defaultOptions = ref<RemoteSelectOption[]>([])
const sourceOptions = ref<RemoteSelectOption[]>([])
const loading = ref(false)
const resolvedPlaceholder = computed(
  () => props.placeholder ?? translate('G2_PH_SELECT', '请选择'),
)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
let activeController: AbortController | undefined
let requestSequence = 0
let lastRemoteQuery: string | undefined

function getScalar(item: RemoteSelectOption, key: string): unknown {
  return item[key]
}

function getValue(item: RemoteSelectOption): string | number {
  const value = getScalar(item, props.valueKey)
  return typeof value === 'number' || typeof value === 'string' ? value : String(value ?? '')
}

function getLabel(item: RemoteSelectOption): string {
  const label = getScalar(item, props.labelKey)
  return label === null || label === undefined
    ? String(getValue(item))
    : String(label)
}

/** 按 value 合并选项。后出现的同值项覆盖先前项，用于保留已选中项的标签。 */
function mergeOptions(
  base: readonly RemoteSelectOption[],
  incoming: readonly RemoteSelectOption[],
): RemoteSelectOption[] {
  const merged = new Map<string, RemoteSelectOption>()
  for (const item of [...base, ...incoming]) {
    merged.set(String(getValue(item)), item)
  }
  return [...merged.values()]
}

function rememberOptions(incoming: readonly RemoteSelectOption[]): void {
  sourceOptions.value = mergeOptions(sourceOptions.value, incoming)
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    typeof error === 'object' && error !== null &&
    ('code' in error && error.code === 'ERR_CANCELED')
  )
}

async function runFetch(
  params: Omit<RemoteSelectFetchParams, 'signal'>,
): Promise<RemoteSelectOption[] | undefined> {
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller
  const sequence = ++requestSequence
  loading.value = true

  try {
    const result = await props.fetchData({ ...params, signal: controller.signal })
    if (sequence !== requestSequence || controller.signal.aborted) return undefined
    return Array.from(result)
  } catch (error) {
    if (!isAbortError(error)) console.error('RemoteSelect fetchData error:', error)
    return undefined
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function restoreDefaultOptions(): void {
  options.value = [...defaultOptions.value]
  lastRemoteQuery = ''
}

/** 作废进行中的远程请求，避免清空/本地命中后被旧响应覆盖 */
function invalidateInFlightRequests(): void {
  activeController?.abort()
  activeController = undefined
  requestSequence += 1
  loading.value = false
}

function matches(value: RemoteSelectValue, item: RemoteSelectOption): boolean {
  return value !== null && value !== undefined && String(getValue(item)) === String(value)
}

async function tryAutoSelectFirst(list: readonly RemoteSelectOption[]): Promise<void> {
  if (
    !props.autoSelectFirstWhenEmpty ||
    props.modelValue !== null && props.modelValue !== undefined ||
    list.length === 0
  ) return

  const value = getValue(list[0])
  await nextTick()
  selectedValue.value = value
  emit('update:modelValue', value)
  emit('change', value)
}

async function prefetchDefaultOptions(): Promise<void> {
  if (!props.prefetchOnOpen || defaultOptions.value.length > 0) return
  const result = await runFetch({})
  if (!result) return
  defaultOptions.value = [...result]
  rememberOptions(result)
  options.value = [...result]
  lastRemoteQuery = ''
  await tryAutoSelectFirst(result)
}

async function loadInitialOption(value: Exclude<RemoteSelectValue, null | undefined>): Promise<void> {
  if (options.value.some((item) => matches(value, item))) return
  const result = await runFetch(
    typeof value === 'number' ? { value } : { key: value },
  )
  if (!result) return
  rememberOptions(result)
  options.value = mergeOptions(options.value, result)
}

function filterLocally(query: string): RemoteSelectOption[] {
  const lowered = query.toLocaleLowerCase()
  return sourceOptions.value.filter((item) =>
    String(getLabel(item)).toLocaleLowerCase().includes(lowered) ||
    String(getValue(item)) === query,
  )
}

/**
 * 空关键字恢复预取结果或清空列表。与上次远程关键字相同则跳过。
 * 已缓存选项能本地命中时不再发请求，并作废进行中的远程请求。
 * 纯数字按 value 查，其余按 key 查。过期响应由序号丢弃，不写回 options。
 */
async function search(query: string): Promise<void> {
  const normalized = query.trim()
  if (!normalized) {
    invalidateInFlightRequests()
    if (props.prefetchOnOpen) restoreDefaultOptions()
    else options.value = []
    return
  }
  if (normalized === lastRemoteQuery) return

  const local = filterLocally(normalized)
  if (local.length > 0) {
    invalidateInFlightRequests()
    options.value = local
    lastRemoteQuery = normalized
    return
  }

  const params = /^\d+$/.test(normalized)
    ? { value: Number(normalized) }
    : { key: normalized }
  const result = await runFetch(params)
  if (!result) return
  rememberOptions(result)
  options.value = [...result]
  lastRemoteQuery = normalized
}

function handleRemoteSearch(query: string): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void search(query), props.debounceDelay)
}

/** 打开下拉时清掉上次关键字。已有预取结果就恢复，否则按 prefetchOnOpen 拉一次默认列表。 */
function handleVisibleChange(visible: boolean): void {
  if (!visible) return
  lastRemoteQuery = undefined
  if (defaultOptions.value.length > 0) restoreDefaultOptions()
  else void prefetchDefaultOptions()
}

function handleChange(value: RemoteSelectValue): void {
  emit('update:modelValue', value)
  emit('change', value)
}

function handleClear(): void {
  invalidateInFlightRequests()
  restoreDefaultOptions()
  emit('clear')
}

async function focus(): Promise<void> {
  await nextTick()
  selectRef.value?.focus?.()
}

async function openDropdown(): Promise<void> {
  await focus()
  const instance = selectRef.value as SelectInstance & { toggleMenu?: () => void }
  instance?.toggleMenu?.()
}

watch(
  () => props.modelValue,
  (value) => {
    selectedValue.value = value
    if (value !== null && value !== undefined) void loadInitialOption(value)
    else restoreDefaultOptions()
  },
)

watch(
  () => props.autoSelectFirstWhenEmpty,
  (enabled) => {
    if (enabled) void tryAutoSelectFirst(defaultOptions.value)
  },
)

onMounted(() => {
  if (props.prefetchOnOpen) void prefetchDefaultOptions()
  if (props.modelValue !== null && props.modelValue !== undefined) {
    void loadInitialOption(props.modelValue)
  }
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  activeController?.abort()
  requestSequence += 1
})

defineExpose({ focus, openDropdown })
</script>
