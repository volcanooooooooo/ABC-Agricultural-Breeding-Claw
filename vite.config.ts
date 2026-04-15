import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8003',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // 确保 SSE 连接不会超时
            proxyReq.setTimeout(0)
          })
        }
      }
    }
  }
})
