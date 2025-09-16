import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserCollector } from '@capture/collectors/browser'
import { EventType, createEventId, type BrowserTabEvent } from '@types/events'

describe('BrowserCollector', () => {
  let collector: BrowserCollector
  let mockChrome: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup Chrome mocks
    mockChrome = {
      tabs: {
        query: vi.fn(),
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        captureVisibleTab: vi.fn()
      },
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn()
      },
      storage: {
        local: { get: vi.fn(), set: vi.fn() }
      },
      webNavigation: {
        onCommitted: { addListener: vi.fn(), removeListener: vi.fn() },
        onCompleted: { addListener: vi.fn(), removeListener: vi.fn() }
      }
    }

    // Mock global chrome
    global.chrome = mockChrome

    collector = new BrowserCollector({
      name: 'browser-collector',
      enabled: true,
      maxEventsPerBatch: 10,
      collectionInterval: 1000,
      captureVisibleContent: true,
      enableContentScripts: true,
      filters: {
        enabled: true,
        privateMode: false,
        domains: ['example.com'],
        protocols: ['https:', 'http:']
      }
    })
  })

  afterEach(async () => {
    if (collector.isRunning()) {
      await collector.stop()
    }
  })

  describe('Initialization', () => {
    it('should initialize browser collector with Chrome APIs', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com', title: 'Example', active: true }
      ])

      await collector.start()

      expect(collector.isRunning()).toBe(true)
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled()
      expect(mockChrome.tabs.onActivated.addListener).toHaveBeenCalled()
      expect(mockChrome.webNavigation.onCommitted.addListener).toHaveBeenCalled()
    })

    it('should handle Chrome API unavailability', async () => {
      // Remove chrome mock to simulate unavailability
      delete (global as any).chrome

      const collectorWithoutChrome = new BrowserCollector({
        name: 'no-chrome-collector',
        enabled: true
      })

      await expect(collectorWithoutChrome.start()).rejects.toThrow('Chrome APIs not available')
    })
  })

  describe('Tab Event Handling', () => {
    it('should handle tab navigation events', async () => {
      mockChrome.tabs.query.mockResolvedValue([])
      
      await collector.start()

      // Simulate tab update event
      const updateListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0]
      const changeInfo = { status: 'complete', url: 'https://example.com' }
      const tab = { id: 1, url: 'https://example.com', title: 'Example' }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await updateListener(tab.id, changeInfo, tab)

      expect(processSpy).toHaveBeenCalled()
      const processedEvents = processSpy.mock.calls[0][0]
      expect(processedEvents).toHaveLength(1)
      
      const event = processedEvents[0] as BrowserTabEvent
      expect(event.type).toBe(EventType.BROWSER_TAB)
      expect(event.action).toBe('navigation')
      expect(event.url).toBe('https://example.com')
      expect(event.tabId).toBe(1)
    })

    it('should handle tab activation events', async () => {
      mockChrome.tabs.query.mockResolvedValue([])
      
      await collector.start()

      // Simulate tab activation event
      const activateListener = mockChrome.tabs.onActivated.addListener.mock.calls[0][0]
      const activeInfo = { tabId: 2, windowId: 1 }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await activateListener(activeInfo)

      expect(processSpy).toHaveBeenCalled()
    })

    it('should handle web navigation events', async () => {
      mockChrome.tabs.query.mockResolvedValue([])
      
      await collector.start()

      // Simulate navigation committed event
      const navListener = mockChrome.webNavigation.onCommitted.addListener.mock.calls[0][0]
      const details = {
        tabId: 1,
        url: 'https://example.com/page',
        frameId: 0,
        processId: 1,
        timeStamp: Date.now(),
        transitionType: 'link',
        transitionQualifiers: []
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await navListener(details)

      expect(processSpy).toHaveBeenCalled()
      const processedEvents = processSpy.mock.calls[0][0]
      expect(processedEvents).toHaveLength(1)
    })

    it('should filter private browsing tabs', async () => {
      const privateCollector = new BrowserCollector({
        name: 'private-collector',
        enabled: true,
        filters: {
          enabled: true,
          privateMode: false
        }
      })

      mockChrome.tabs.query.mockResolvedValue([])
      
      await privateCollector.start()

      const updateListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0]
      const changeInfo = { status: 'complete', url: 'https://private.com' }
      const tab = { id: 1, url: 'https://private.com', title: 'Private', incognito: true }

      const processSpy = vi.spyOn(privateCollector, 'processEvents' as any)
      
      await updateListener(tab.id, changeInfo, tab)

      expect(processSpy).not.toHaveBeenCalled()
    })
  })

  describe('Content Script Communication', () => {
    it('should handle content script messages', async () => {
      mockChrome.tabs.query.mockResolvedValue([])
      
      await collector.start()

      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'spur-event',
        event: {
          type: 'selection',
          text: 'selected text',
          url: 'https://example.com'
        }
      }
      const sender = { tab: { id: 1 } }
      const sendResponse = vi.fn()

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message, sender, sendResponse)

      expect(processSpy).toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith({ success: true })
    })

    it('should handle invalid content script messages', async () => {
      mockChrome.tabs.query.mockResolvedValue([])
      
      await collector.start()

      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]
      const invalidMessage = { type: 'invalid-type' }
      const sender = { tab: { id: 1 } }
      const sendResponse = vi.fn()

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(invalidMessage, sender, sendResponse)

      expect(processSpy).not.toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: expect.any(String) })
    })

    it('should inject content scripts into tabs', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com', title: 'Example', active: true }
      ])

      await collector.start()

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'spur-inject-scripts', tabId: 1 },
        expect.any(Function)
      )
    })
  })

  describe('Visible Content Capture', () => {
    it('should capture visible tab content when enabled', async () => {
      const contentCollector = new BrowserCollector({
        name: 'content-collector',
        enabled: true,
        captureVisibleContent: true,
        contentCaptureInterval: 5000
      })

      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com', title: 'Example', active: true }
      ])
      
      mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,test')

      await contentCollector.start()

      // Fast-forward to trigger content capture
      vi.advanceTimersByTime(6000)

      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ format: 'png' })
      )
    })

    it('should handle content capture errors gracefully', async () => {
      const contentCollector = new BrowserCollector({
        name: 'content-collector',
        enabled: true,
        captureVisibleContent: true
      })

      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com', title: 'Example', active: true }
      ])
      
      mockChrome.tabs.captureVisibleTab.mockRejectedValue(new Error('Capture failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await contentCollector.start()

      // Fast-forward to trigger content capture
      vi.advanceTimersByTime(6000)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error capturing visible content:',
        expect.any(Error)
      )
    })
  })

  describe('Domain Filtering', () => {
    it('should filter events by allowed domains', async () => {
      const filteredCollector = new BrowserCollector({
        name: 'domain-filtered-collector',
        enabled: true,
        filters: {
          enabled: true,
          domains: ['allowed.com', 'trusted.org']
        }
      })

      mockChrome.tabs.query.mockResolvedValue([])
      
      await filteredCollector.start()

      const updateListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0]
      
      // Test allowed domain
      const allowedChange = { status: 'complete', url: 'https://allowed.com/page' }
      const allowedTab = { id: 1, url: 'https://allowed.com/page', title: 'Allowed' }
      
      const processSpy = vi.spyOn(filteredCollector, 'processEvents' as any)
      
      await updateListener(allowedTab.id, allowedChange, allowedTab)
      expect(processSpy).toHaveBeenCalledTimes(1)

      // Test blocked domain
      processSpy.mockClear()
      const blockedChange = { status: 'complete', url: 'https://blocked.com/page' }
      const blockedTab = { id: 2, url: 'https://blocked.com/page', title: 'Blocked' }
      
      await updateListener(blockedTab.id, blockedChange, blockedTab)
      expect(processSpy).not.toHaveBeenCalled()
    })

    it('should allow all domains when no filter is set', async () => {
      const unfilteredCollector = new BrowserCollector({
        name: 'unfiltered-collector',
        enabled: true,
        filters: {
          enabled: true
          // No domains specified
        }
      })

      mockChrome.tabs.query.mockResolvedValue([])
      
      await unfilteredCollector.start()

      const updateListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0]
      const changeInfo = { status: 'complete', url: 'https://any-domain.com' }
      const tab = { id: 1, url: 'https://any-domain.com', title: 'Any Domain' }

      const processSpy = vi.spyOn(unfilteredCollector, 'processEvents' as any)
      
      await updateListener(tab.id, changeInfo, tab)

      expect(processSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Event Enrichment', () => {
    it('should enrich browser events with additional metadata', async () => {
      mockChrome.tabs.query.mockResolvedValue([])
      
      await collector.start()

      const updateListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0]
      const changeInfo = { 
        status: 'complete', 
        url: 'https://example.com/page',
        title: 'Example Page'
      }
      const tab = { 
        id: 1, 
        url: 'https://example.com/page', 
        title: 'Example Page',
        favIconUrl: 'https://example.com/favicon.ico'
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await updateListener(tab.id, changeInfo, tab)

      const processedEvents = processSpy.mock.calls[0][0]
      const event = processedEvents[0] as BrowserTabEvent

      expect(event.metadata).toEqual(expect.objectContaining({
        title: 'Example Page',
        favIconUrl: 'https://example.com/favicon.ico',
        domain: 'example.com',
        path: '/page'
      }))
    })

    it('should extract page metadata from content scripts', async () => {
      mockChrome.tabs.query.mockResolvedValue([])
      
      await collector.start()

      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'spur-event',
        event: {
          type: 'page-metadata',
          metadata: {
            description: 'Page description',
            keywords: ['test', 'example'],
            author: 'Test Author'
          }
        }
      }
      const sender = { tab: { id: 1 } }
      const sendResponse = vi.fn()

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message, sender, sendResponse)

      const processedEvents = processSpy.mock.calls[0][0]
      const event = processedEvents[0] as BrowserTabEvent

      expect(event.enrichment).toEqual(expect.objectContaining({
        pageMetadata: expect.objectContaining({
          description: 'Page description',
          keywords: ['test', 'example'],
          author: 'Test Author'
        })
      }))
    })
  })

  describe('Performance and Rate Limiting', () => {
    it('should debounce rapid tab changes', async () => {
      const debounceCollector = new BrowserCollector({
        name: 'debounce-browser-collector',
        enabled: true,
        debounceTime: 200
      })

      mockChrome.tabs.query.mockResolvedValue([])
      
      await debounceCollector.start()

      const updateListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0]
      const processSpy = vi.spyOn(debounceCollector, 'processEvents' as any)

      // Simulate rapid tab changes
      for (let i = 0; i < 5; i++) {
        const changeInfo = { status: 'complete', url: `https://example.com/page${i}` }
        const tab = { id: 1, url: `https://example.com/page${i}`, title: `Page ${i}` }
        
        await updateListener(tab.id, changeInfo, tab)
      }

      // Should be debounced
      expect(processSpy).toHaveBeenCalledTimes(0)

      // Fast-forward to trigger debounce
      vi.advanceTimersByTime(250)

      expect(processSpy).toHaveBeenCalledTimes(1)
    })

    it('should track browser-specific metrics', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com', title: 'Example', active: true }
      ])

      await collector.start()

      const metrics = collector.getMetrics()
      
      expect(metrics).toHaveProperty('tabsMonitored')
      expect(metrics).toHaveProperty('navigationEvents')
      expect(metrics).toHaveProperty('contentScriptEvents')
      expect(metrics.tabsMonitored).toBe(1)
    })
  })

  describe('Error Recovery', () => {
    it('should handle Chrome API errors gracefully', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Chrome API error'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(collector.start()).rejects.toThrow('Chrome API error')
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error initializing browser collector:',
        expect.any(Error)
      )
    })

    it('should continue operation after individual tab processing errors', async () => {
      mockChrome.tabs.query.mockResolvedValue([])
      
      await collector.start()

      // Mock processEvents to fail for certain events
      const originalProcess = (collector as any).processEvents
      let callCount = 0
      vi.spyOn(collector, 'processEvents' as any).mockImplementation(async (events) => {
        callCount++
        if (callCount === 1) {
          throw new Error('First batch failed')
        }
        return originalProcess.call(collector, events)
      })

      const updateListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0]
      
      // First event should fail but collector should continue
      const changeInfo1 = { status: 'complete', url: 'https://example.com/page1' }
      const tab1 = { id: 1, url: 'https://example.com/page1', title: 'Page 1' }
      
      await updateListener(tab1.id, changeInfo1, tab1)

      // Second event should succeed
      const changeInfo2 = { status: 'complete', url: 'https://example.com/page2' }
      const tab2 = { id: 2, url: 'https://example.com/page2', title: 'Page 2' }
      
      await updateListener(tab2.id, changeInfo2, tab2)

      // Collector should still be running
      expect(collector.isRunning()).toBe(true)
    })
  })
})