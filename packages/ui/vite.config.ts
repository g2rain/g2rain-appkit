import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    cssCodeSplit: false,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        'platform/index': resolve(import.meta.dirname, 'src/platform/index.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: 'style',
    },
    rollupOptions: {
      external: [
        'vue',
        'element-plus',
        '@element-plus/icons-vue',
        '@g2rain/theme',
      ],
    },
  },
})

