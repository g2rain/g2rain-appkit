import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import { G2rainUi } from '@g2rain/ui'
import { G2rainPlatformUi } from '@g2rain/ui/platform'
import 'element-plus/dist/index.css'
import '@g2rain/theme/styles.css'
import '@g2rain/ui/style.css'
import App from './App.vue'
import './playground.css'

createApp(App)
  .use(ElementPlus)
  .use(G2rainUi, {
    translate: (_key, fallback) => fallback,
  })
  .use(G2rainPlatformUi, {
    dataProviders: {
      organ: {
        loadOptions: async ({ key, value }) => [
          { organId: 1, organName: '总部' },
          { organId: 2, organName: '研发中心' },
        ].filter(item => value != null ? item.organId === value : !key || item.organName.includes(key)),
      },
      dict: {
        loadOptions: async () => [{ code: 'ACTIVE', name: '有效' }, { code: 'INACTIVE', name: '无效' }],
      },
    },
  })
  .mount('#app')
