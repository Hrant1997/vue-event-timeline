import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/** Конфиг сборки playground как статичной демо-версии (GitHub Pages). npm run build:playground */
export default defineConfig({
  root: fileURLToPath(new URL('./playground', import.meta.url)),
  // относительный base — обязательно для GitHub Pages в подпапке /<repo>/
  base: './',
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
  build: {
    outDir: fileURLToPath(new URL('./docs', import.meta.url)),
    emptyOutDir: true,
  },
})
