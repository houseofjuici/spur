import { beforeAll, afterAll } from 'vitest'

// Global setup for test environment
beforeAll(async () => {
  // Initialize test database
  process.env.DB_PATH = ':memory:'
  process.env.NODE_ENV = 'test'
  
  // Mock global APIs that need async setup
  if (typeof window !== 'undefined') {
    // Initialize any async mocks here
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('🚀 Test environment initialized')
})

afterAll(async () => {
  // Cleanup global test state
  if (typeof window !== 'undefined') {
    // Clean up any global state
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('🧹 Test environment cleaned up')
})