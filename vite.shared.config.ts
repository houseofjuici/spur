import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Shared configuration for both extension and web
export const sharedConfig = defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/stores': resolve(__dirname, 'src/stores'),
      '@/services': resolve(__dirname, 'src/services'),
      '@/capture': resolve(__dirname, 'src/capture'),
      '@/memory': resolve(__dirname, 'src/memory'),
      '@/assistant': resolve(__dirname, 'src/assistant'),
      '@/integrations': resolve(__dirname, 'src/integrations'),
      '@/ui': resolve(__dirname, 'src/ui'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables.scss" as *;`
      }
    }
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'dexie',
      'crypto-js',
      'dayjs',
      'uuid',
      'lucide-react',
      'framer-motion'
    ]
  }
})