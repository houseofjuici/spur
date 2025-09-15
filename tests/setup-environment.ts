import { config } from 'dotenv'

// Load test-specific environment variables
config({ path: '.env.test' })

// Set default test environment variables
process.env.NODE_ENV = 'test'
process.env.VITE_APP_VERSION = '1.0.0-test'
process.env.VITE_API_BASE_URL = 'http://localhost:3000/api'
process.env.VITE_ENABLE_ANALYTICS = 'false'
process.env.VITE_ENABLE_SENTRY = 'false'
process.env.VITE_ENABLE_PERFORMANCE_MONITORING = 'true'
process.env.VITE_ENABLE_DEBUG_MODE = 'true'
process.env.DB_PATH = ':memory:'
process.env.LOG_LEVEL = 'error'

// Export environment for tests
export const testEnvironment = {
  API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  WS_URL: process.env.VITE_WS_URL || 'ws://localhost:3000/ws',
  APP_VERSION: process.env.VITE_APP_VERSION || '1.0.0-test',
  ENABLE_ANALYTICS: process.env.VITE_ENABLE_ANALYTICS === 'true',
  ENABLE_SENTRY: process.env.VITE_ENABLE_SENTRY === 'true',
  ENABLE_PERFORMANCE_MONITORING: process.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
  ENABLE_DEBUG_MODE: process.env.VITE_ENABLE_DEBUG_MODE === 'true',
  DB_PATH: process.env.DB_PATH || ':memory:',
  LOG_LEVEL: process.env.LOG_LEVEL || 'error'
}

// Mock environment for browser tests
if (typeof window !== 'undefined') {
  window.process = window.process || {}
  window.process.env = { ...process.env }
}