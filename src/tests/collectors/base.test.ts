import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BaseCollector } from '@capture/collectors/base'
import { EventType, createEventId, type BaseEvent } from '@types/events'

// Mock implementation for testing
class TestCollector extends BaseCollector {
  private events: BaseEvent[] = []
  private isCollecting = false

  protected async initializeCollector(): Promise<void> {
    // Mock initialization
  }

  protected async startCollection(): Promise<void> {
    this.isCollecting = true
  }

  protected async stopCollection(): Promise<void> {
    this.isCollecting = false
  }

  protected async cleanupCollector(): Promise<void> {
    this.events = []
  }

  // Helper method to simulate event collection
  async simulateEvent(event: BaseEvent): Promise<void> {
    if (this.isCollecting) {
      this.events.push(event)
      await this.processEvents([event])
    }
  }

  getCollectedEvents(): BaseEvent[] {
    return [...this.events]
  }

  clearEvents(): void {
    this.events = []
  }
}

describe('BaseCollector', () => {
  let collector: TestCollector
  let mockProcessEvents: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockProcessEvents = vi.fn()
    
    collector = new TestCollector({
      name: 'test-collector',
      enabled: true,
      maxEventsPerBatch: 10,
      collectionInterval: 1000,
      debounceTime: 100,
      rateLimit: {
        enabled: true,
        maxEvents: 100,
        timeWindow: 60000
      },
      filters: {
        enabled: true,
        domains: ['example.com'],
        applications: ['VS Code']
      }
    })
  })

  afterEach(async () => {
    if (collector.isRunning()) {
      await collector.stop()
    }
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultCollector = new TestCollector({
        name: 'default-collector'
      })

      expect(defaultCollector.getName()).toBe('default-collector')
      expect(defaultCollector.isEnabled()).toBe(false)
      expect(defaultCollector.isRunning()).toBe(false)
    })

    it('should initialize with custom configuration', () => {
      expect(collector.getName()).toBe('test-collector')
      expect(collector.isEnabled()).toBe(true)
      expect(collector.isRunning()).toBe(false)
    })
  })

  describe('Lifecycle Management', () => {
    it('should start and stop correctly', async () => {
      await collector.start()
      expect(collector.isRunning()).toBe(true)

      await collector.stop()
      expect(collector.isRunning()).toBe(false)
    })

    it('should throw error if starting when already running', async () => {
      await collector.start()
      
      await expect(collector.start()).rejects.toThrow('Collector test-collector is already running')
    })

    it('should throw error if stopping when not running', async () => {
      await expect(collector.stop()).rejects.toThrow('Collector test-collector is not running')
    })

    it('should handle initialization failures', async () => {
      const failingCollector = new TestCollector({
        name: 'failing-collector'
      })

      // Mock initializeCollector to throw
      vi.spyOn(failingCollector, 'initializeCollector' as any).mockRejectedValue(new Error('Init failed'))

      await expect(failingCollector.start()).rejects.toThrow('Init failed')
    })
  })

  describe('Event Processing', () => {
    it('should process events with rate limiting', async () => {
      const event: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session'
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await collector.start()
      await collector.simulateEvent(event)

      expect(processSpy).toHaveBeenCalledWith([event])
    })

    it('should apply event filters', async () => {
      const filteredCollector = new TestCollector({
        name: 'filtered-collector',
        enabled: true,
        filters: {
          enabled: true,
          domains: ['allowed.com'],
          applications: ['Allowed App']
        }
      })

      const allowedEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session',
        metadata: { domain: 'allowed.com' }
      }

      const blockedEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session',
        metadata: { domain: 'blocked.com' }
      }

      const processSpy = vi.spyOn(filteredCollector, 'processEvents' as any)

      await filteredCollector.start()
      await filteredCollector.simulateEvent(allowedEvent)
      await filteredCollector.simulateEvent(blockedEvent)

      expect(processSpy).toHaveBeenCalledTimes(1)
      expect(processSpy).toHaveBeenCalledWith([allowedEvent])
    })

    it('should debounce high-frequency events', async () => {
      const debounceCollector = new TestCollector({
        name: 'debounce-collector',
        enabled: true,
        debounceTime: 100
      })

      const event1: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session'
      }

      const event2: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + 10,
        source: 'test',
        sessionId: 'test-session'
      }

      const processSpy = vi.spyOn(debounceCollector, 'processEvents' as any)

      await debounceCollector.start()
      
      // Simulate rapid events
      await debounceCollector.simulateEvent(event1)
      await debounceCollector.simulateEvent(event2)

      // Fast-forward time to trigger debounce
      vi.advanceTimersByTime(150)

      expect(processSpy).toHaveBeenCalledTimes(1)
    })

    it('should enforce rate limits', async () => {
      const rateLimitedCollector = new TestCollector({
        name: 'rate-limited-collector',
        enabled: true,
        rateLimit: {
          enabled: true,
          maxEvents: 2,
          timeWindow: 1000
        }
      })

      const events: BaseEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 10,
        source: 'test',
        sessionId: 'test-session'
      }))

      const processSpy = vi.spyOn(rateLimitedCollector, 'processEvents' as any)

      await rateLimitedCollector.start()

      // Process events that exceed rate limit
      for (const event of events) {
        await rateLimitedCollector.simulateEvent(event)
      }

      // Should only process up to rate limit
      expect(processSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle event processing errors gracefully', async () => {
      const errorCollector = new TestCollector({
        name: 'error-collector',
        enabled: true
      })

      const event: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session'
      }

      // Mock processEvents to throw
      vi.spyOn(errorCollector, 'processEvents' as any).mockRejectedValue(new Error('Processing failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await errorCollector.start()
      await errorCollector.simulateEvent(event)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error processing events in collector error-collector:',
        expect.any(Error)
      )
    })

    it('should continue operation after individual event failures', async () => {
      const event1: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session'
      }

      const event2: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + 10,
        source: 'test',
        sessionId: 'test-session'
      }

      // Mock to fail first event but succeed second
      let callCount = 0
      vi.spyOn(collector, 'processEvents' as any).mockImplementation(async (events) => {
        callCount++
        if (callCount === 1) {
          throw new Error('First event failed')
        }
        return Promise.resolve()
      })

      await collector.start()
      
      // First event should fail but collector should continue
      await expect(collector.simulateEvent(event1)).resolves.not.toThrow()
      
      // Second event should succeed
      await expect(collector.simulateEvent(event2)).resolves.not.toThrow()
    })
  })

  describe('Configuration Updates', () => {
    it('should update configuration dynamically', async () => {
      expect(collector.isEnabled()).toBe(true)

      await collector.updateConfig({
        enabled: false
      })

      expect(collector.isEnabled()).toBe(false)
    })

    it('should validate configuration updates', async () => {
      await expect(collector.updateConfig({
        maxEventsPerBatch: -1
      })).rejects.toThrow('maxEventsPerBatch must be positive')

      await expect(collector.updateConfig({
        collectionInterval: -100
      })).rejects.toThrow('collectionInterval must be positive')
    })
  })

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      const event: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session'
      }

      await collector.start()
      await collector.simulateEvent(event)

      const metrics = collector.getMetrics()
      
      expect(metrics).toHaveProperty('eventsProcessed')
      expect(metrics).toHaveProperty('errors')
      expect(metrics).toHaveProperty('lastProcessed')
      expect(metrics.eventsProcessed).toBeGreaterThan(0)
    })

    it('should reset metrics correctly', async () => {
      const event: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session'
      }

      await collector.start()
      await collector.simulateEvent(event)

      const beforeReset = collector.getMetrics()
      expect(beforeReset.eventsProcessed).toBeGreaterThan(0)

      collector.resetMetrics()
      
      const afterReset = collector.getMetrics()
      expect(afterReset.eventsProcessed).toBe(0)
      expect(afterReset.errors).toBe(0)
    })
  })
})