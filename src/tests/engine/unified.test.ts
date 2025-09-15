import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnifiedCaptureEngine } from '@capture/engine/unified'
import { CollectorManager } from '@capture/collectors/manager'
import { EventNormalizer } from '@capture/normalizer/index'
import { RealTimeStream } from '@capture/stream/index'
import { PerformanceMonitor } from '@capture/monitor/enhanced'
import { EventType, createEventId, type BaseEvent, type BrowserTabEvent } from '@types/events'

describe('UnifiedCaptureEngine', () => {
  let engine: UnifiedCaptureEngine
  let mockCollectorManager: any
  let mockNormalizer: any
  let mockStream: any
  let mockMonitor: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock dependencies
    mockCollectorManager = {
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: vi.fn(() => false),
      addEvent: vi.fn(),
      processEvents: vi.fn(),
      getCollector: vi.fn(),
      updateCollectorConfig: vi.fn(),
      getMetrics: vi.fn(() => ({
        totalEvents: 100,
        totalErrors: 2,
        collectors: [
          { name: 'browser-collector', healthy: true },
          { name: 'system-collector', healthy: true }
        ]
      })),
      checkHealth: vi.fn(() => ({
        healthy: true,
        collectors: [
          { name: 'browser-collector', healthy: true },
          { name: 'system-collector', healthy: true }
        ]
      }))
    }

    mockNormalizer = {
      normalizeEvent: vi.fn(),
      normalizeEvents: vi.fn(),
      updateConfig: vi.fn(),
      getMetrics: vi.fn(() => ({
        eventsProcessed: 95,
        eventsFiltered: 5,
        averageProcessingTime: 15.5
      }))
    }

    mockStream = {
      start: vi.fn(),
      stop: vi.fn(),
      isActive: vi.fn(() => false),
      addEvent: vi.fn(),
      getMetrics: vi.fn(() => ({
        eventsProcessed: 90,
        insightsGenerated: 15,
        patternsDetected: 8
      }))
    }

    mockMonitor = {
      start: vi.fn(),
      stop: vi.fn(),
      isActive: vi.fn(() => false),
      recordEventStart: vi.fn(),
      recordEventEnd: vi.fn(),
      recordError: vi.fn(),
      getMetrics: vi.fn(() => ({
        health: { score: 85, status: 'good' },
        events: { processed: 100, successRate: 0.95 },
        cpu: { usage: 25.5 },
        memory: { used: 50 * 1024 * 1024 }
      })),
      checkHealth: vi.fn(() => ({ healthy: true, score: 85 }))
    }

    // Mock the component factory methods
    engine = new UnifiedCaptureEngine({
      enabled: true,
      collectors: {
        enabled: true,
        manager: {
          enabled: true,
          maxEventsPerSecond: 100,
          globalFilters: {
            enabled: true,
            eventTypes: [EventType.BROWSER_TAB, EventType.SYSTEM_APP]
          }
        }
      },
      normalizer: {
        enabled: true,
        validation: { enabled: true },
        enrichment: { enabled: true },
        privacy: { enabled: true },
        quality: { enabled: true }
      },
      stream: {
        enabled: true,
        bufferSize: 100,
        flushInterval: 5000,
        enableInsights: true
      },
      monitor: {
        enabled: true,
        collectionInterval: 1000,
        thresholds: {
          cpu: { warning: 70, critical: 90 },
          memory: { warning: 80 * 1024 * 1024, critical: 95 * 1024 * 1024 }
        }
      }
    })

    // Replace the components with mocks
    engine['collectorManager'] = mockCollectorManager
    engine['normalizer'] = mockNormalizer
    engine['stream'] = mockStream
    engine['monitor'] = mockMonitor
  })

  afterEach(async () => {
    if (engine.isRunning()) {
      await engine.stop()
    }
  })

  describe('Initialization', () => {
    it('should initialize engine with all components', async () => {
      await engine.start()

      expect(engine.isRunning()).toBe(true)
      expect(mockCollectorManager.start).toHaveBeenCalled()
      expect(mockNormalizer.updateConfig).toHaveBeenCalled()
      expect(mockStream.start).toHaveBeenCalled()
      expect(mockMonitor.start).toHaveBeenCalled()
    })

    it('should handle component initialization failures gracefully', async () => {
      mockCollectorManager.start.mockRejectedValue(new Error('Collector manager failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(engine.start()).rejects.toThrow('Collector manager failed')
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to start unified capture engine:',
        expect.any(Error)
      )
    })

    it('should not start when disabled in configuration', async () => {
      const disabledEngine = new UnifiedCaptureEngine({
        enabled: false
      })

      await disabledEngine.start()

      expect(disabledEngine.isRunning()).toBe(false)
    })

    it('should initialize components in correct order', async () => {
      const callOrder: string[] = []

      mockCollectorManager.start.mockImplementation(async () => {
        callOrder.push('collector')
      })
      mockNormalizer.updateConfig.mockImplementation(async () => {
        callOrder.push('normalizer')
      })
      mockStream.start.mockImplementation(async () => {
        callOrder.push('stream')
      })
      mockMonitor.start.mockImplementation(async () => {
        callOrder.push('monitor')
      })

      await engine.start()

      expect(callOrder).toEqual(['collector', 'normalizer', 'stream', 'monitor'])
    })
  })

  describe('Event Processing Pipeline', () => {
    it('should process events through complete pipeline', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const normalizedEvent = {
        ...event,
        normalized: true,
        quality: { completeness: 0.9, accuracy: 0.95, relevance: 0.8, overall: 0.88 }
      }

      mockNormalizer.normalizeEvent.mockResolvedValue(normalizedEvent)

      await engine.start()
      const result = await engine.processEvent(event)

      expect(result).toBe(normalizedEvent)
      expect(mockMonitor.recordEventStart).toHaveBeenCalledWith(event.id, EventType.BROWSER_TAB)
      expect(mockNormalizer.normalizeEvent).toHaveBeenCalledWith(event)
      expect(mockCollectorManager.addEvent).toHaveBeenCalledWith(normalizedEvent)
      expect(mockStream.addEvent).toHaveBeenCalledWith(normalizedEvent)
      expect(mockMonitor.recordEventEnd).toHaveBeenCalledWith(event.id, true)
    })

    it('should handle event processing errors gracefully', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      mockNormalizer.normalizeEvent.mockRejectedValue(new Error('Normalization failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await engine.start()
      const result = await engine.processEvent(event)

      expect(result).toBeNull()
      expect(mockMonitor.recordError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'processing',
          message: 'Normalization failed'
        })
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error processing event:',
        expect.any(Error)
      )
    })

    it('should filter out events that fail normalization', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      mockNormalizer.normalizeEvent.mockResolvedValue(null) // Filtered out

      await engine.start()
      const result = await engine.processEvent(event)

      expect(result).toBeNull()
      expect(mockCollectorManager.addEvent).not.toHaveBeenCalled()
      expect(mockStream.addEvent).not.toHaveBeenCalled()
    })

    it('should process multiple events efficiently', async () => {
      const events: BrowserTabEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 100,
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: i + 1,
        url: `https://example.com/page${i}`,
        title: `Page ${i}`,
        action: 'navigation',
        timestampCaptured: Date.now() + i * 100
      }))

      const normalizedEvents = events.map(event => ({
        ...event,
        normalized: true,
        quality: { completeness: 0.9, accuracy: 0.95, relevance: 0.8, overall: 0.88 }
      }))

      mockNormalizer.normalizeEvents.mockResolvedValue(normalizedEvents)

      await engine.start()
      const results = await engine.processEvents(events)

      expect(results).toEqual(normalizedEvents)
      expect(mockNormalizer.normalizeEvents).toHaveBeenCalledWith(events)
      expect(mockCollectorManager.addEvent).toHaveBeenCalledTimes(10)
      expect(mockStream.addEvent).toHaveBeenCalledTimes(10)
    })
  })

  describe('Component Coordination', () => {
    it('should coordinate collector events with normalization', async () => {
      await engine.start()

      // Simulate collector event
      const collectorEvent: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser-collector',
        sessionId: 'test-session'
      }

      const normalizedEvent = {
        ...collectorEvent,
        normalized: true,
        quality: { completeness: 0.9, accuracy: 0.95, relevance: 0.8, overall: 0.88 }
      }

      mockNormalizer.normalizeEvent.mockResolvedValue(normalizedEvent)

      // Trigger collector event processing
      await engine.handleCollectorEvent('browser-collector', collectorEvent)

      expect(mockNormalizer.normalizeEvent).toHaveBeenCalledWith(collectorEvent)
      expect(mockStream.addEvent).toHaveBeenCalledWith(normalizedEvent)
    })

    it('should handle component communication errors', async () => {
      mockStream.addEvent.mockRejectedValue(new Error('Stream unavailable'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await engine.start()

      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const normalizedEvent = {
        ...event,
        normalized: true,
        quality: { completeness: 0.9, accuracy: 0.95, relevance: 0.8, overall: 0.88 }
      }

      mockNormalizer.normalizeEvent.mockResolvedValue(normalizedEvent)

      await engine.processEvent(event)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error sending event to stream:',
        expect.any(Error)
      )
      // Should still process event despite stream error
      expect(mockCollectorManager.addEvent).toHaveBeenCalledWith(normalizedEvent)
    })
  })

  describe('Configuration Management', () => {
    it('should update component configurations', async () => {
      await engine.start()

      const newConfig = {
        collectors: {
          enabled: true,
          manager: {
            maxEventsPerSecond: 200
          }
        },
        normalizer: {
          quality: {
            qualityThreshold: 0.8
          }
        },
        stream: {
          bufferSize: 200
        }
      }

      await engine.updateConfig(newConfig)

      expect(mockCollectorManager.updateCollectorConfig).toHaveBeenCalled()
      expect(mockNormalizer.updateConfig).toHaveBeenCalled()
      // Stream and monitor should also be updated
    })

    it('should handle partial configuration updates', async () => {
      await engine.start()

      await engine.updateConfig({
        collectors: {
          manager: {
            maxEventsPerSecond: 150
          }
        }
      })

      expect(mockCollectorManager.updateCollectorConfig).toHaveBeenCalled()
      // Other components should not be affected
    })

    it('should validate configuration updates', async () => {
      await expect(engine.updateConfig({
        collectors: {
          manager: {
            maxEventsPerSecond: -1 // Invalid value
          }
        }
      })).rejects.toThrow('maxEventsPerSecond must be positive')
    })

    it('should reload configuration on component restart', async () => {
      await engine.start()
      await engine.stop()

      // Configuration should be preserved
      expect(engine['config']).toBeDefined()
      expect(engine['config'].collectors.enabled).toBe(true)
    })
  })

  describe('Health Monitoring', () => {
    it('should check health of all components', async () => {
      await engine.start()

      const health = await engine.checkHealth()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('components')
      expect(health).toHaveProperty('overallScore')
      expect(health.components).toHaveLength(4)
      expect(mockCollectorManager.checkHealth).toHaveBeenCalled()
      expect(mockMonitor.checkHealth).toHaveBeenCalled()
    })

    it('should detect unhealthy components', async () => {
      mockCollectorManager.checkHealth.mockResolvedValue({
        healthy: false,
        collectors: [
          { name: 'browser-collector', healthy: false }
        ]
      })

      await engine.start()

      const health = await engine.checkHealth()

      expect(health.healthy).toBe(false)
      expect(health.components[0].healthy).toBe(false)
    })

    it('should calculate overall health score', async () => {
      // Mock component health scores
      mockCollectorManager.checkHealth.mockResolvedValue({ healthy: true, score: 90 })
      mockMonitor.checkHealth.mockResolvedValue({ healthy: true, score: 85 })

      await engine.start()

      const health = await engine.checkHealth()

      expect(health.overallScore).toBeGreaterThan(80)
      expect(health.overallScore).toBeLessThanOrEqual(100)
    })

    it('should provide detailed component status', async () => {
      await engine.start()

      const status = engine.getComponentStatus()

      expect(status).toHaveProperty('collectors')
      expect(status).toHaveProperty('normalizer')
      expect(status).toHaveProperty('stream')
      expect(status).toHaveProperty('monitor')
      expect(status.collectors.running).toBe(false) // Mock returns false
    })
  })

  describe('Performance Metrics', () => {
    it('should aggregate metrics from all components', async () => {
      await engine.start()

      const metrics = engine.getMetrics()

      expect(metrics).toHaveProperty('summary')
      expect(metrics).toHaveProperty('components')
      expect(metrics).toHaveProperty('performance')
      expect(metrics.summary).toHaveProperty('totalEvents')
      expect(metrics.summary).toHaveProperty('healthScore')
      expect(metrics.components).toHaveProperty('collectors')
      expect(metrics.components).toHaveProperty('normalizer')
      expect(metrics.components).toHaveProperty('stream')
      expect(metrics.components).toHaveProperty('monitor')
    })

    it('should calculate summary statistics', async () => {
      await engine.start()

      const metrics = engine.getMetrics()

      expect(metrics.summary.totalEvents).toBe(100) // From collector manager
      expect(metrics.summary.healthScore).toBe(85) // From monitor
      expect(metrics.performance.cpuUsage).toBe(25.5) // From monitor
      expect(metrics.performance.memoryUsage).toBe(50 * 1024 * 1024) // From monitor
    })

    it('should track engine-specific metrics', async () => {
      await engine.start()

      // Process some events to generate engine metrics
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const normalizedEvent = {
        ...event,
        normalized: true,
        quality: { completeness: 0.9, accuracy: 0.95, relevance: 0.8, overall: 0.88 }
      }

      mockNormalizer.normalizeEvent.mockResolvedValue(normalizedEvent)

      await engine.processEvent(event)

      const metrics = engine.getMetrics()
      
      expect(metrics.engine).toHaveProperty('eventsProcessed')
      expect(metrics.engine).toHaveProperty('eventsFiltered')
      expect(metrics.engine).toHaveProperty('processingErrors')
      expect(metrics.engine.eventsProcessed).toBe(1)
    })
  })

  describe('Lifecycle Management', () => {
    it('should start and stop gracefully', async () => {
      await engine.start()
      expect(engine.isRunning()).toBe(true)

      await engine.stop()
      expect(engine.isRunning()).toBe(false)
      expect(mockCollectorManager.stop).toHaveBeenCalled()
      expect(mockStream.stop).toHaveBeenCalled()
      expect(mockMonitor.stop).toHaveBeenCalled()
    })

    it('should handle component stop failures gracefully', async () => {
      mockCollectorManager.stop.mockRejectedValue(new Error('Collector stop failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await engine.start()
      await engine.stop()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error stopping collector manager:',
        expect.any(Error)
      )
      expect(engine.isRunning()).toBe(false) // Should still stop
    })

    it('should cleanup resources properly', async () => {
      await engine.start()

      // Add some state
      engine['eventQueue'].push({ id: 'test-event' } as any)
      engine['processingStats'] = { processed: 10, errors: 1 }

      await engine.stop()

      // Should be cleaned up
      expect(engine['eventQueue']).toHaveLength(0)
      expect(engine['processingStats']).toEqual({ processed: 0, errors: 0 })
    })

    it('should handle multiple start/stop cycles', async () => {
      // First cycle
      await engine.start()
      expect(engine.isRunning()).toBe(true)
      await engine.stop()
      expect(engine.isRunning()).toBe(false)

      // Reset mock calls
      mockCollectorManager.start.mockClear()
      mockStream.start.mockClear()

      // Second cycle
      await engine.start()
      expect(engine.isRunning()).toBe(true)
      expect(mockCollectorManager.start).toHaveBeenCalled()
      expect(mockStream.start).toHaveBeenCalled()
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle component restarts', async () => {
      await engine.start()

      // Simulate collector failure
      mockCollectorManager.checkHealth.mockResolvedValue({
        healthy: false,
        collectors: [{ name: 'browser-collector', healthy: false }]
      })

      // Engine should attempt recovery
      await engine.recoverComponent('collectors')

      expect(mockCollectorManager.stop).toHaveBeenCalled()
      expect(mockCollectorManager.start).toHaveBeenCalled()
    })

    it('should handle engine-level errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Simulate internal error
      await engine.handleEngineError(new Error('Internal engine error'))

      expect(consoleSpy).toHaveBeenCalledWith(
        'Engine error:',
        expect.any(Error)
      )
      expect(engine.isRunning()).toBe(false) // Should stop on critical errors
    })

    it('should provide error diagnostics', async () => {
      await engine.start()

      // Record some errors
      engine.recordError({
        component: 'normalizer',
        type: 'validation',
        message: 'Invalid event format',
        timestamp: Date.now()
      })

      const diagnostics = engine.getErrorDiagnostics()

      expect(diagnostics).toHaveProperty('errors')
      expect(diagnostics).toHaveProperty('errorRate')
      expect(diagnostics).toHaveProperty('lastError')
      expect(diagnostics.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Export and Reporting', () => {
    it('should export engine state as JSON', async () => {
      await engine.start()

      const exported = engine.exportState()

      expect(exported).toHaveProperty('config')
      expect(exported).toHaveProperty('status')
      expect(exported).toHaveProperty('metrics')
      expect(exported).toHaveProperty('components')
      expect(exported.status.running).toBe(true)
    })

    it('should generate comprehensive performance report', async () => {
      await engine.start()

      // Add some test data
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const normalizedEvent = {
        ...event,
        normalized: true,
        quality: { completeness: 0.9, accuracy: 0.95, relevance: 0.8, overall: 0.88 }
      }

      mockNormalizer.normalizeEvent.mockResolvedValue(normalizedEvent)

      await engine.processEvent(event)

      const report = engine.generateReport()

      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('performance')
      expect(report).toHaveProperty('components')
      expect(report).toHaveProperty('recommendations')
      expect(report.summary.totalEvents).toBe(1)
      expect(report.summary.uptime).toBeGreaterThan(0)
    })

    it('should provide real-time statistics', async () => {
      await engine.start()

      const stats = engine.getRealTimeStats()

      expect(stats).toHaveProperty('eventsPerSecond')
      expect(stats).toHaveProperty('averageLatency')
      expect(stats).toHaveProperty('successRate')
      expect(stats).toHaveProperty('activeComponents')
      expect(typeof stats.eventsPerSecond).toBe('number')
    })
  })

  describe('Advanced Features', () => {
    it('should handle event prioritization', async () => {
      const priorityEngine = new UnifiedCaptureEngine({
        enabled: true,
        processing: {
          enablePrioritization: true,
          priorityThresholds: {
            high: 0.9,
            medium: 0.7,
            low: 0.5
          }
        }
      })

      await priorityEngine.start()

      const highPriorityEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://github.com/user/repo/pull/123',
        title: 'Critical Fix PR',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const lowPriorityEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 2,
        url: 'https://example.com/news',
        title: 'News Article',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      // Should prioritize high priority events
      const highPriorityNormalized = {
        ...highPriorityEvent,
        normalized: true,
        quality: { completeness: 0.95, accuracy: 0.98, relevance: 0.9, overall: 0.94 }
      }

      const lowPriorityNormalized = {
        ...lowPriorityEvent,
        normalized: true,
        quality: { completeness: 0.7, accuracy: 0.8, relevance: 0.6, overall: 0.7 }
      }

      mockNormalizer.normalizeEvent
        .mockResolvedValueOnce(highPriorityNormalized)
        .mockResolvedValueOnce(lowPriorityNormalized)

      await priorityEngine.processEvent(highPriorityEvent)
      await priorityEngine.processEvent(lowPriorityEvent)

      // High priority events should be processed first
      expect(priorityEngine['processingStats'].highPriority).toBe(1)
    })

    it('should support event batching for performance', async () => {
      const batchEngine = new UnifiedCaptureEngine({
        enabled: true,
        processing: {
          enableBatching: true,
          batchSize: 5,
          batchTimeout: 1000
        }
      })

      await batchEngine.start()

      const events: BrowserTabEvent[] = Array.from({ length: 3 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 10,
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: i + 1,
        url: `https://example.com/page${i}`,
        title: `Page ${i}`,
        action: 'navigation',
        timestampCaptured: Date.now() + i * 10
      }))

      const normalizedEvents = events.map(event => ({
        ...event,
        normalized: true,
        quality: { completeness: 0.9, accuracy: 0.95, relevance: 0.8, overall: 0.88 }
      }))

      mockNormalizer.normalizeEvents.mockResolvedValue(normalizedEvents)

      await batchEngine.processEvents(events)

      // Should process as batch
      expect(mockNormalizer.normalizeEvents).toHaveBeenCalledWith(events)
    })
  })
})