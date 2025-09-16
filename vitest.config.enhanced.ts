import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { config } from 'dotenv'

// Load environment variables for testing
config({ path: '.env.test' })

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/setup-environment.ts'],
    include: [
      'tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
      'packages/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'spur-browser/**/*.{test,spec}.{js,jsx,ts,tsx}'
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
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
        'packages/**/*.{js,jsx,ts,tsx}',
        'spur-browser/**/*.{js,jsx,ts,tsx}'
      ],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.stories.{js,jsx,ts,tsx}',
        '**/__tests__/**/*',
        '**/__mocks__/**/*',
        'tests/**',
        'docs/**',
        '*.temp'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // Critical modules with 95%+ coverage
        './src/database/**/*': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        './src/integrations/**/*': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        './src/assistant/**/*': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        './src/capture/**/*': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        './src/memory/**/*': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        './src/extension/**/*': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      reportsDirectory: './coverage',
      cleanOnRerun: true,
      autoUpdate: true
    },
    // Mock CSS and other imports
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/database': resolve(__dirname, 'src/database'),
      '@/integrations': resolve(__dirname, 'src/integrations'),
      '@/assistant': resolve(__dirname, 'src/assistant'),
      '@capture': resolve(__dirname, 'src/capture'),
      '@memory': resolve(__dirname, 'src/memory'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@/components': resolve(__dirname, 'src/components'),
      '@web': resolve(__dirname, 'src/web'),
      '@extension': resolve(__dirname, 'src/extension'),
      '@test': resolve(__dirname, 'tests')
    },
    deps: {
      inline: [
        /vitest/,
        /vite/,
        /react/,
        /react-dom/,
        /@testing-library/,
        /@vitejs\/plugin-react/,
        /@playwright\/test/
      ]
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
        maxThreads: 4,
        minThreads: 2
      }
    },
    benchmark: {
      include: [
        'tests/**/*.bench.{js,ts}',
        'src/**/*.bench.{js,ts}',
        'performance/**/*.bench.{js,ts}'
      ],
      reporter: ['default', 'json', 'html'],
      outputFile: './performance/benchmark-results.json'
    },
    // Test hooks and globals
    globalSetup: './tests/global-setup.ts',
    globalTeardown: './tests/global-teardown.ts',
    // Test reporting
    reporters: [
      'verbose',
      'json',
      'html',
      ['junit', { outputFile: './test-results/junit.xml' }],
      ['github-actions', { silent: false }]
    ],
    outputFile: './test-results/vitest-results.json',
    // Performance and stability
    testTimeout: 30000,
    hookTimeout: 10000,
    slowTestThreshold: 3000,
    maxConcurrency: 4,
    minWorkers: 2,
    maxWorkers: 4,
    // Isolate test environments
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Browser testing support
    browser: {
      enabled: true,
      name: 'chrome',
      provider: 'playwright',
      slowHijackESM: true,
      screenshotFailures: true,
      headless: process.env.HEADLESS !== 'false'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@capture': resolve(__dirname, 'src/capture'),
      '@memory': resolve(__dirname, 'src/memory'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@/database': resolve(__dirname, 'src/database'),
      '@/integrations': resolve(__dirname, 'src/integrations'),
      '@/assistant': resolve(__dirname, 'src/assistant'),
      '@/components': resolve(__dirname, 'src/components'),
      '@web': resolve(__dirname, 'src/web'),
      '@extension': resolve(__dirname, 'src/extension'),
      '@test': resolve(__dirname, 'tests')
    }
  },
  define: {
    global: 'globalThis',
    'process.env': process.env,
    'import.meta.env': process.env,
    __DEV__: process.env.NODE_ENV !== 'production',
    __TEST__: true,
    __BROWSER__: true
  },
  esbuild: {
    target: 'es2020',
    sourcemap: true,
    minify: false
  },
  // Environment-specific configurations
  environment: 'jsdom',
  environmentOptions: {
    jsdom: {
      resources: 'usable',
      pretendToBeVisual: true,
      includeNodeLocations: true
    }
  }
})