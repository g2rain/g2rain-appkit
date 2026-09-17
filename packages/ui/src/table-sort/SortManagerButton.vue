<template>
  <el-button
    type="primary"
    link
    size="small"
    :title="translate('G2_SORT_MANAGE', '管理排序')"
    @click="context?.openSortConfig()"
  >
    <el-icon><Sort /></el-icon>
    <span v-if="showLabel">{{ translate('G2_LBL_SORT', '排序') }}</span>
  </el-button>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { Sort } from '@element-plus/icons-vue'
import { useG2rainUi } from '../context'
import { TABLE_SORT_CONTEXT } from './types'

defineOptions({ name: 'G2SortManagerButton' })

withDefaults(defineProps<{ showLabel?: boolean }>(), { showLabel: false })
const context = inject(TABLE_SORT_CONTEXT, undefined)
const { translate } = useG2rainUi()
</script>

