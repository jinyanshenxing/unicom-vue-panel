import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api/unicom': {
        target: 'https://m.client.10010.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/unicom/, ''),
        secure: false
      },
      '/api/login': {
        target: 'https://loginxhm.10010.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/login/, ''),
        secure: false
      }
    }
  }
})
