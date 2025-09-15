import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
      'packages/**/*.{test,spec}.{js,jsx,ts,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'dist-extension',
      'dist-web',
      '.idea',
      '.git',
      '.cache',
      '*.temp',
      '**/node_modules/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
        'packages/**/*.{js,jsx,ts,tsx}'
      ],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.stories.{js,jsx,ts,tsx}',
        '**/__tests__/**/*',
        '**/__mocks__/**/*',
        'tests/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // More stringent thresholds for critical modules
        './src/database/**/*': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        './src/integrations/**/*': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        './src/assistant/**/*': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    // Mock CSS and other imports
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/database': resolve(__dirname, 'src/database'),
      '@/integrations': resolve(__dirname, 'src/integrations'),
      '@/assistant': resolve(__dirname, 'src/assistant'),
      '@capture': resolve(__dirname, 'src/capture'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@/components': resolve(__dirname, 'src/components')
    },
    deps: {
      inline: [
        /vitest/,
        /vite/,
        /react/,
        /react-dom/,
        /@testing-library/,
        /@vitejs\/plugin-react/
      ]
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
        maxThreads: 4
      }
    },
    benchmark: {
      include: [
        'tests/**/*.bench.{js,ts}',
        'src/**/*.bench.{js,ts}'
      ],
      reporter: ['default', 'json']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@capture': resolve(__dirname, 'src/capture'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@/database': resolve(__dirname, 'src/database'),
      '@/integrations': resolve(__dirname, 'src/integrations'),
      '@/assistant': resolve(__dirname, 'src/assistant'),
      '@/components': resolve(__dirname, 'src/components')
    }
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  }
})