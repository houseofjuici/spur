import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CollectorManager } from '@capture/collectors/manager'
import { BrowserCollector } from '@capture/collectors/browser'
import { SystemCollector } from '@capture/collectors/system'
import { EventType, createEventId, type BaseEvent } from '@types/events'

describe('CollectorManager', () => {
  let manager: CollectorManager
  let mockBrowserCollector: any
  let mockSystemCollector: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock collectors
    mockBrowserCollector = {
      getName: vi.fn(() => 'browser-collector'),
      isEnabled: vi.fn(() => true),
      isRunning: vi.fn(() => false),
      start: vi.fn(),
      stop: vi.fn(),
      processEvents: vi.fn(),
      updateConfig: vi.fn(),
      getMetrics: vi.fn(() => ({
        eventsProcessed: 10,
        errors: 0,
        lastProcessed: Date.now()
      }))
    }

    mockSystemCollector = {
      getName: vi.fn(() => 'system-collector'),
      isEnabled: vi.fn(() => true),
      isRunning: vi.fn(() => false),
      start: vi.fn(),
      stop: vi.fn(),
      processEvents: vi.fn(),
      updateConfig: vi.fn(),
      getMetrics: vi.fn(() => ({
        eventsProcessed: 5,
        errors: 1,
        lastProcessed: Date.now() - 1000
      }))
    }

    manager = new CollectorManager({
      enabled: true,
      maxEventsPerSecond: 100,
      globalFilters: {
        enabled: true,
        timeRange: {
          enabled: true,
          startTime: Date.now() - 86400000, // 24 hours ago
          endTime: Date.now()
        },
        eventTypes: [EventType.BROWSER_TAB, EventType.SYSTEM_APP]
      },
      collectors: [
        {
          type: 'browser',
          config: {
            name: 'browser-collector',
            enabled: true
          }
        },
        {
          type: 'system',
          config: {
            name: 'system-collector',
            enabled: true
          }
        }
      ]
    })

    // Mock the createCollector method to return our mock collectors
    vi.spyOn(manager, 'createCollector' as any).mockImplementation((type: string) => {
      if (type === 'browser') return mockBrowserCollector
      if (type === 'system') return mockSystemCollector
      throw new Error(`Unknown collector type: ${type}`)
    })
  })

  afterEach(async () => {
    if (manager.isRunning()) {
      await manager.stop()
    }
  })

  describe('Initialization', () => {
    it('should initialize manager with collectors', async () => {
      await manager.start()

      expect(manager.isRunning()).toBe(true)
      expect(mockBrowserCollector.start).toHaveBeenCalled()
      expect(mockSystemCollector.start).toHaveBeenCalled()
    })

    it('should handle collector initialization failures gracefully', async () => {
      mockBrowserCollector.start.mockRejectedValue(new Error('Browser collector failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await manager.start()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to start collector browser-collector:',
        expect.any(Error)
      )
      // System collector should still start
      expect(mockSystemCollector.start).toHaveBeenCalled()
      expect(manager.isRunning()).toBe(true)
    })

    it('should not start when disabled in configuration', async () => {
      const disabledManager = new CollectorManager({
        enabled: false,
        collectors: [
          {
            type: 'browser',
            config: { name: 'browser-collector', enabled: true }
          }
        ]
      })

      await disabledManager.start()

      expect(disabledManager.isRunning()).toBe(false)
      expect(mockBrowserCollector.start).not.toHaveBeenCalled()
    })
  })

  describe('Collector Management', () => {
    it('should create collectors of different types', () => {
      // Restore the original implementation temporarily
      vi.restoreAllMocks()
      
      const realManager = new CollectorManager({
        enabled: true,
        collectors: [
          {
            type: 'browser',
            config: { name: 'browser-collector', enabled: true }
          },
          {
            type: 'system',
            config: { name: 'system-collector', enabled: true }
          }
        ]
      })

      const browserCollector = (realManager as any).createCollector('browser')
      const systemCollector = (realManager as any).createCollector('system')

      expect(browserCollector).toBeInstanceOf(BrowserCollector)
      expect(systemCollector).toBeInstanceOf(SystemCollector)
    })

    it('should handle unknown collector types', () => {
      vi.restoreAllMocks()
      
      const realManager = new CollectorManager({
        enabled: true,
        collectors: [
          {
            type: 'unknown',
            config: { name: 'unknown-collector', enabled: true }
          }
        ]
      })

      expect(() => {
        (realManager as any).createCollector('unknown')
      }).toThrow('Unknown collector type: unknown')
    })

    it('should get collector by name', () => {
      manager['collectors'] = [mockBrowserCollector, mockSystemCollector]

      const browser = manager.getCollector('browser-collector')
      const system = manager.getCollector('system-collector')
      const unknown = manager.getCollector('unknown-collector')

      expect(browser).toBe(mockBrowserCollector)
      expect(system).toBe(mockSystemCollector)
      expect(unknown).toBeUndefined()
    })

    it('should list all collectors', () => {
      manager['collectors'] = [mockBrowserCollector, mockSystemCollector]

      const collectors = manager.listCollectors()

      expect(collectors).toHaveLength(2)
      expect(collectors).toContain(mockBrowserCollector)
      expect(collectors).toContain(mockSystemCollector)
    })
  })

  describe('Event Processing', () => {
    it('should process events from collectors', async () => {
      const mockEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser-collector',
        sessionId: 'test-session'
      }

      // Mock the event processing
      vi.spyOn(manager, 'processEvents' as any).mockResolvedValue()

      await manager.start()

      // Simulate collector processing events
      await manager.handleCollectorEvents('browser-collector', [mockEvent])

      expect(manager['processEvents']).toHaveBeenCalledWith([mockEvent])
    })

    it('should apply global rate limiting', async () => {
      const rateLimitedManager = new CollectorManager({
        enabled: true,
        maxEventsPerSecond: 2,
        collectors: [
          {
            type: 'browser',
            config: { name: 'browser-collector', enabled: true }
          }
        ]
      })

      const events = Array.from({ length: 5 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 10,
        source: 'browser-collector',
        sessionId: 'test-session'
      }))

      const processSpy = vi.spyOn(rateLimitedManager, 'processEvents' as any)

      await rateLimitedManager.start()

      // Process events that exceed rate limit
      for (let i = 0; i < events.length; i++) {
        await rateLimitedManager.handleCollectorEvents('browser-collector', [events[i]])
        vi.advanceTimersByTime(100) // Small delay between events
      }

      // Should only process up to rate limit
      expect(processSpy).toHaveBeenCalledTimes(2)
    })

    it('should apply global filters', async () => {
      const filteredManager = new CollectorManager({
        enabled: true,
        globalFilters: {
          enabled: true,
          eventTypes: [EventType.BROWSER_TAB] // Only allow browser events
        },
        collectors: [
          {
            type: 'browser',
            config: { name: 'browser-collector', enabled: true }
          },
          {
            type: 'system',
            config: { name: 'system-collector', enabled: true }
          }
        ]
      })

      const browserEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser-collector',
        sessionId: 'test-session'
      }

      const systemEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.SYSTEM_APP,
        timestamp: Date.now(),
        source: 'system-collector',
        sessionId: 'test-session'
      }

      const processSpy = vi.spyOn(filteredManager, 'processEvents' as any)

      await filteredManager.start()

      await filteredManager.handleCollectorEvents('browser-collector', [browserEvent])
      await filteredManager.handleCollectorEvents('system-collector', [systemEvent])

      expect(processSpy).toHaveBeenCalledTimes(1)
      expect(processSpy).toHaveBeenCalledWith([browserEvent])
    })

    it('should apply time range filters', async () => {
      const now = Date.now()
      const timeFilteredManager = new CollectorManager({
        enabled: true,
        globalFilters: {
          enabled: true,
          timeRange: {
            enabled: true,
            startTime: now - 3600000, // 1 hour ago
            endTime: now
          }
        },
        collectors: [
          {
            type: 'browser',
            config: { name: 'browser-collector', enabled: true }
          }
        ]
      })

      const recentEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: now - 1800000, // 30 minutes ago
        source: 'browser-collector',
        sessionId: 'test-session'
      }

      const oldEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: now - 7200000, // 2 hours ago
        source: 'browser-collector',
        sessionId: 'test-session'
      }

      const processSpy = vi.spyOn(timeFilteredManager, 'processEvents' as any)

      await timeFilteredManager.start()

      await timeFilteredManager.handleCollectorEvents('browser-collector', [recentEvent, oldEvent])

      expect(processSpy).toHaveBeenCalledTimes(1)
      const processedEvents = processSpy.mock.calls[0][0]
      expect(processedEvents).toHaveLength(1)
      expect(processedEvents[0]).toBe(recentEvent)
    })
  })

  describe('Configuration Management', () => {
    it('should update collector configurations', async () => {
      await manager.start()

      await manager.updateCollectorConfig('browser-collector', {
        enabled: false,
        maxEventsPerBatch: 20
      })

      expect(mockBrowserCollector.updateConfig).toHaveBeenCalledWith({
        enabled: false,
        maxEventsPerBatch: 20
      })
    })

    it('should handle configuration updates for unknown collectors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await manager.updateCollectorConfig('unknown-collector', { enabled: false })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Collector unknown-collector not found'
      )
      expect(mockBrowserCollector.updateConfig).not.toHaveBeenCalled()
    })

    it('should update global configuration', async () => {
      await manager.updateGlobalConfig({
        enabled: false,
        maxEventsPerSecond: 50
      })

      expect(manager['config'].enabled).toBe(false)
      expect(manager['config'].maxEventsPerSecond).toBe(50)
    })
  })

  describe('Error Handling', () => {
    it('should handle event processing errors gracefully', async () => {
      const mockEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser-collector',
        sessionId: 'test-session'
      }

      vi.spyOn(manager, 'processEvents' as any).mockRejectedValue(new Error('Processing failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await manager.start()

      await manager.handleCollectorEvents('browser-collector', [mockEvent])

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error processing events from collector browser-collector:',
        expect.any(Error)
      )
    })

    it('should handle collector event handler errors', async () => {
      mockBrowserCollector.processEvents.mockRejectedValue(new Error('Collector processing failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await manager.start()

      // This should not throw, but should log the error
      expect(manager.isRunning()).toBe(true)
    })

    it('should recover from individual collector failures', async () => {
      mockBrowserCollector.start.mockRejectedValueOnce(new Error('Temporary failure'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await manager.start()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to start collector browser-collector:',
        expect.any(Error)
      )
      expect(manager.isRunning()).toBe(true)
      expect(mockSystemCollector.start).toHaveBeenCalled()
    })
  })

  describe('Lifecycle Management', () => {
    it('should stop all collectors gracefully', async () => {
      await manager.start()
      expect(manager.isRunning()).toBe(true)

      await manager.stop()
      expect(manager.isRunning()).toBe(false)
      expect(mockBrowserCollector.stop).toHaveBeenCalled()
      expect(mockSystemCollector.stop).toHaveBeenCalled()
    })

    it('should handle stop errors gracefully', async () => {
      mockBrowserCollector.stop.mockRejectedValue(new Error('Stop failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await manager.start()
      await manager.stop()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error stopping collector browser-collector:',
        expect.any(Error)
      )
      expect(manager.isRunning()).toBe(false)
    })

    it('should handle multiple start/stop cycles', async () => {
      // First cycle
      await manager.start()
      expect(manager.isRunning()).toBe(true)
      await manager.stop()
      expect(manager.isRunning()).toBe(false)

      // Reset mock calls
      mockBrowserCollector.start.mockClear()
      mockSystemCollector.start.mockClear()

      // Second cycle
      await manager.start()
      expect(manager.isRunning()).toBe(true)
      expect(mockBrowserCollector.start).toHaveBeenCalled()
      expect(mockSystemCollector.start).toHaveBeenCalled()
    })
  })

  describe('Metrics and Monitoring', () => {
    it('should collect metrics from all collectors', async () => {
      manager['collectors'] = [mockBrowserCollector, mockSystemCollector]

      const metrics = manager.getMetrics()

      expect(metrics).toHaveProperty('totalEvents')
      expect(metrics).toHaveProperty('totalErrors')
      expect(metrics).toHaveProperty('collectors')
      expect(metrics.totalEvents).toBe(15) // 10 + 5
      expect(metrics.totalErrors).toBe(1)
      expect(metrics.collectors).toHaveLength(2)
      expect(metrics.collectors[0].name).toBe('browser-collector')
      expect(metrics.collectors[1].name).toBe('system-collector')
    })

    it('should track manager-specific metrics', async () => {
      await manager.start()

      // Simulate some events
      const event: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser-collector',
        sessionId: 'test-session'
      }

      await manager.handleCollectorEvents('browser-collector', [event])

      const metrics = manager.getMetrics()

      expect(metrics).toHaveProperty('eventsProcessed')
      expect(metrics).toHaveProperty('eventsFiltered')
      expect(metrics).toHaveProperty('rateLimitDrops')
      expect(metrics.eventsProcessed).toBeGreaterThan(0)
    })

    it('should reset all metrics', async () => {
      manager['collectors'] = [mockBrowserCollector, mockSystemCollector]

      // Get initial metrics
      const beforeReset = manager.getMetrics()
      expect(beforeReset.totalEvents).toBe(15)

      // Reset metrics
      manager.resetMetrics()

      // Check that collector metrics were reset
      expect(mockBrowserCollector.getMetrics).toHaveBeenCalled()
      expect(mockSystemCollector.getMetrics).toHaveBeenCalled()

      const afterReset = manager.getMetrics()
      expect(afterReset.totalEvents).toBe(0)
      expect(afterReset.totalErrors).toBe(0)
    })
  })

  describe('Dynamic Collector Management', () => {
    it('should add new collectors dynamically', async () => {
      const newCollector = {
        getName: vi.fn(() => 'new-collector'),
        isEnabled: vi.fn(() => true),
        isRunning: vi.fn(() => false),
        start: vi.fn(),
        stop: vi.fn()
      }

      await manager.addCollector('new', newCollector)

      expect(manager.getCollector('new-collector')).toBe(newCollector)
    })

    it('should remove collectors dynamically', async () => {
      manager['collectors'] = [mockBrowserCollector]

      await manager.removeCollector('browser-collector')

      expect(manager.getCollector('browser-collector')).toBeUndefined()
      expect(mockBrowserCollector.stop).toHaveBeenCalled()
    })

    it('should handle removal of unknown collectors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await manager.removeCollector('unknown-collector')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Collector unknown-collector not found for removal'
      )
    })
  })

  describe('Health Checks', () => {
    it('should perform health checks on all collectors', async () => {
      manager['collectors'] = [mockBrowserCollector, mockSystemCollector]
      
      mockBrowserCollector.isRunning.mockReturnValue(true)
      mockSystemCollector.isRunning.mockReturnValue(true)

      const health = await manager.checkHealth()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('collectors')
      expect(health.healthy).toBe(true)
      expect(health.collectors).toHaveLength(2)
      expect(health.collectors[0].name).toBe('browser-collector')
      expect(health.collectors[0].healthy).toBe(true)
    })

    it('should detect unhealthy collectors', async () => {
      manager['collectors'] = [mockBrowserCollector, mockSystemCollector]
      
      mockBrowserCollector.isRunning.mockReturnValue(true)
      mockSystemCollector.isRunning.mockReturnValue(false)

      const health = await manager.checkHealth()

      expect(health.healthy).toBe(false)
      expect(health.collectors[1].name).toBe('system-collector')
      expect(health.collectors[1].healthy).toBe(false)
    })
  })
})