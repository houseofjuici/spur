import { defineConfig, mergeConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { sharedConfig } from './vite.shared.config'

export default mergeConfig(sharedConfig, defineConfig({
  plugins: [react()],
  root: 'src/extension',
  publicDir: 'public',
  build: {
    outDir: '../../dist-extension',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/extension/popup/index.html'),
        options: resolve(__dirname, 'src/extension/options/index.html'),
        background: resolve(__dirname, 'src/extension/background/background.ts'),
        content: resolve(__dirname, 'src/extension/content/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content') return 'content.js'
          return '[name].js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][ext]',
        manualChunks: {
          vendor: ['react', 'react-dom'],
          extension: ['webextension-polyfill'],
          utils: ['dayjs', 'uuid', 'crypto-js'],
          ui: ['lucide-react', 'framer-motion'],
          ml: ['compromise', 'natural'],
          db: ['dexie']
        }
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    __EXTENSION__: true
  }
}))