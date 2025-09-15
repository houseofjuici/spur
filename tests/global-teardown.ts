import { afterAll } from 'vitest'

// Global teardown for test environment
afterAll(async () => {
  // Clean up any global resources
  if (global.gc) {
    global.gc()
  }
  
  // Close any open database connections
  if (global.testDatabase) {
    await global.testDatabase.close()
  }
  
  // Clear any remaining timeouts
  const highestTimeoutId = setTimeout(() => {}, 0)
  for (let i = 0; i < highestTimeoutId; i++) {
    clearTimeout(i)
  }
  
  console.log('✅ All global cleanup completed')
})