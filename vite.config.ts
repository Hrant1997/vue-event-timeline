import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
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
      // Явные расширения файлов (.mjs/.umd.js), чтобы потребители корректно
      // резолвили main/module/exports из package.json
      fileName: (format) => (format === 'es' ? 'vue-event-timeline.mjs' : `vue-event-timeline.${format}.js`),
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['vue', 'dayjs', '@vueuse/core'],
      output: {
        // Инлайн всех чанков: бандл должен быть самодостаточным,
        // иначе dist-файл импортирует ./index-XXXX.js и часть потребителей
        // (например, esbuild-депскан Vite в uni-app проектах) падает с ошибкой
        // "Failed to resolve entry for package ... incorrect main/module/exports"
        inlineDynamicImports: true,
        globals: {
          vue: 'Vue',
          dayjs: 'dayjs',
          '@vueuse/core': 'VueUse'
        }
      }
    }
  }
})