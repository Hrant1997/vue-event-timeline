import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      // Важно: указываем и ts, и vue файлы
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist',
      
      // Опционально: если хотите, чтобы все типы склеились в один index.d.ts
      // rollupTypes: true,
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueEventTimeline',
      fileName: 'vue-event-timeline',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['vue', 'dayjs', '@vueuse/core'],
      output: { 
        globals: { 
          vue: 'Vue', 
          dayjs: 'dayjs',
          '@vueuse/core': 'VueUse'
        } 
      }
    }
  }
})