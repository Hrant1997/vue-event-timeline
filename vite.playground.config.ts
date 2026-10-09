import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/** T-16: конфиг для playground (dev-песочница библиотеки). npm run dev / npm run playground */
export default defineConfig({
  root: fileURLToPath(new URL('./playground', import.meta.url)),
  plugins: [vue()],
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
