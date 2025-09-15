import { test, expect } from '@playwright/test'

test.describe('Application Loading', () => {
  test('should load the main application', async ({ page }) => {
    await page.goto('/')
    
    // Wait for main content to load
    await expect(page.locator('[data-testid="app-root"]')).toBeVisible()
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible({ timeout: 10000 })
  })

  test('should display assistant interface', async ({ page }) => {
    await page.goto('/')
    
    // Check for assistant chat interface
    await expect(page.locator('[data-testid="assistant-chat"]')).toBeVisible()
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
  })

  test('should display memory timeline', async ({ page }) => {
    await page.goto('/')
    
    // Check for memory timeline component
    await expect(page.locator('[data-testid="memory-timeline"]')).toBeVisible()
  })

  test('should handle responsive design', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
    
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload()
    
    await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible()
  })
})

test.describe('Assistant Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="message-input"]')
  })

  test('should send and receive messages', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]')
    const sendButton = page.locator('[data-testid="send-button"]')
    
    await messageInput.fill('Hello, assistant!')
    await sendButton.click()
    
    // Wait for response
    await expect(page.locator('[data-testid="assistant-response"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="assistant-response"]')).toContainText('Hello')
  })

  test('should support voice input', async ({ page }) => {
    const voiceButton = page.locator('[data-testid="voice-input-button"]')
    
    // Mock voice recognition
    await page.evaluate(() => {
      (window as any).SpeechRecognition = class {
        start = () => {
          setTimeout(() => {
            this.onresult({
              results: [[{
                transcript: 'Test voice message'
              }]]
            })
          }, 100)
        }
        onresult: () => {}
        onerror: () => {}
      }
    })
    
    await voiceButton.click()
    await expect(page.locator('[data-testid="message-input"]')).toHaveValue('Test voice message')
  })

  test('should display typing indicator', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]')
    const sendButton = page.locator('[data-testid="send-button"]')
    
    await messageInput.fill('Trigger typing indicator')
    await sendButton.click()
    
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible()
  })
})

test.describe('Memory Timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="memory-timeline"]')
  })

  test('should display activity entries', async ({ page }) => {
    // Add mock activities via page evaluation
    await page.evaluate(() => {
      const mockActivities = [
        {
          id: '1',
          type: 'browser',
          title: 'Visited GitHub',
          timestamp: Date.now() - 3600000,
          description: 'Explored Spur repository'
        },
        {
          id: '2',
          type: 'code',
          title: 'Code Editing',
          timestamp: Date.now() - 1800000,
          description: 'Modified assistant interface'
        }
      ]
      
      // Store mock activities in localStorage for testing
      localStorage.setItem('spur-activities', JSON.stringify(mockActivities))
    })
    
    await page.reload()
    
    // Wait for timeline to load
    await expect(page.locator('[data-testid="activity-entry"]')).toHaveCount(2)
  })

  test('should filter activities by type', async ({ page }) => {
    const filterButton = page.locator('[data-testid="filter-button"]')
    const browserFilter = page.locator('[data-testid="filter-browser"]')
    
    await filterButton.click()
    await browserFilter.click()
    
    await expect(page.locator('[data-testid="activity-entry"]')).toBeVisible()
  })

  test('should search activities', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    await searchInput.fill('GitHub')
    await searchInput.press('Enter')
    
    await expect(page.locator('[data-testid="activity-entry"]')).toContainText('GitHub')
  })
})

test.describe('Extension Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Mock extension APIs
    await page.addInitScript(() => {
      Object.assign(window, {
        chrome: {
          runtime: {
            id: 'test-extension-id',
            getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
            sendMessage: () => Promise.resolve({ success: true })
          },
          storage: {
            local: {
              get: () => Promise.resolve({}),
              set: () => Promise.resolve()
            }
          }
        }
      })
    })
  })

  test('should detect extension presence', async ({ page }) => {
    await expect(page.locator('[data-testid="extension-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="extension-status"]')).toContainText('Connected')
  })

  test('should sync data with extension', async ({ page }) => {
    const syncButton = page.locator('[data-testid="sync-button"]')
    
    await syncButton.click()
    
    await expect(page.locator('[data-testid="sync-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Synced')
  })
})

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForSelector('[data-testid="app-root"]')
    const loadTime = Date.now() - startTime
    
    expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds
  })

  test('should handle large datasets efficiently', async ({ page }) => {
    // Add large amount of mock data
    await page.evaluate(() => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        title: `Activity ${i}`,
        timestamp: Date.now() - (i * 60000),
        type: ['browser', 'code', 'email'][i % 3]
      }))
      
      localStorage.setItem('spur-large-dataset', JSON.stringify(largeDataset))
    })
    
    await page.goto('/')
    
    // Performance should not degrade significantly
    const startTime = Date.now()
    await page.waitForSelector('[data-testid="activity-entry"]', { timeout: 10000 })
    const renderTime = Date.now() - startTime
    
    expect(renderTime).toBeLessThan(2000) // Should render within 2 seconds
  })
})

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/**', route => route.abort('failed'))
    
    await page.goto('/')
    
    await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible()
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  })

  test('should handle storage errors', async ({ page }) => {
    // Simulate storage quota exceeded
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
        getItem: () => null,
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null
      })
    })
    
    await page.goto('/')
    
    await expect(page.locator('[data-testid="storage-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="storage-error"]')).toContainText('storage')
  })
})

test.describe('Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/')
    
    const mainHeading = page.locator('h1')
    await expect(mainHeading).toHaveAttribute('role', 'heading')
    await expect(mainHeading).toHaveAttribute('aria-level', '1')
    
    const messageInput = page.locator('[data-testid="message-input"]')
    await expect(messageInput).toHaveAttribute('aria-label')
    await expect(messageInput).toHaveAttribute('aria-describedby')
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/')
    
    // Test tab navigation
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="message-input"]')).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="send-button"]')).toBeFocused()
    
    // Test enter key submission
    await page.keyboard.press('Enter')
    // Should trigger message submission
  })

  test('should have proper color contrast', async ({ page }) => {
    await page.goto('/')
    
    // Check for proper color contrast (simplified test)
    const elements = await page.locator('[data-testid]').all()
    
    for (const element of elements) {
      const computedStyle = await element.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return {
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize
        }
      })
      
      // Basic contrast validation (colors shouldn't be too similar)
      expect(computedStyle.color).not.toBe(computedStyle.backgroundColor)
    }
  })
})