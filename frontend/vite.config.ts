import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
      '/openclaw-api': {
        target: 'http://127.0.0.1:10099',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openclaw-api/, ''),
      },
      '/openclaw-ws': {
        target: 'ws://127.0.0.1:10099',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openclaw-ws/, ''),
      },
    },
  },
})
