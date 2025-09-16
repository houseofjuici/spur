import { defineConfig, mergeConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { sharedConfig } from './vite.shared.config'

export default mergeConfig(sharedConfig, defineConfig({
  plugins: [react()],
  root: 'src/web',
  publicDir: 'public',
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/web/index.html'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          state: ['zustand'],
          utils: ['dayjs', 'uuid', 'crypto-js'],
          ui: ['framer-motion', 'lucide-react', 'tailwindcss'],
          charts: ['recharts', 'd3'],
          ml: ['compromise', 'natural', 'onnxruntime-web'],
          db: ['dexie', 'better-sqlite3']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  preview: {
    port: 3000
  }
}))