import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E setup...')
  
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  // Set up test environment
  await page.goto('http://localhost:5173')
  
  // Wait for app to load
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 30000 })
  
  // Clear any existing test data
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  
  // Set up test user
  await page.evaluate(() => {
    localStorage.setItem('test-user', JSON.stringify({
      id: 'test-user-id',
      email: 'test@example.com',
      preferences: {
        theme: 'light',
        language: 'en'
      }
    }))
  })
  
  await browser.close()
  console.log('✅ Global E2E setup completed')
  
  return async () => {
    // Global teardown can be added here if needed
    console.log('🧹 Global E2E teardown completed')
  }
}

export default globalSetup