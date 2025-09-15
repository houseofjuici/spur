import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnifiedCaptureEngine } from '@capture/engine/unified'
import { BrowserCollector } from '@capture/collectors/browser'
import { SystemCollector } from '@capture/collectors/system'
import { CollectorManager } from '@capture/collectors/manager'
import { EventNormalizer } from '@capture/normalizer/index'
import { RealTimeStream } from '@capture/stream/index'
import { PerformanceMonitor } from '@capture/monitor/enhanced'
import { EventType, createEventId, type BrowserTabEvent, type SystemAppEvent } from '@types/events'

describe('Unified Capture Engine Integration Tests', () => {
  let engine: UnifiedCaptureEngine
  let mockChrome: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup Chrome APIs for browser collector
    mockChrome = {
      runtime: {
        id: 'test-extension-id',
        getURL: vi.fn((path) => `chrome-extension://${path}`),
        sendMessage: vi.fn(),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        onConnect: { addListener: vi.fn(), removeListener: vi.fn() }
      },
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, url: 'https://example.com', title: 'Example', active: true }
        ]),
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        captureVisibleTab: vi.fn()
      },
      storage: {
        local: { get: vi.fn(), set: vi.fn() },
        sync: { get: vi.fn(), set: vi.fn() }
      },
      webNavigation: {
        onCommitted: { addListener: vi.fn(), removeListener: vi.fn() },
        onCompleted: { addListener: vi.fn(), removeListener: vi.fn() }
      }
    }

    global.chrome = mockChrome

    // Setup performance API
    global.performance = {
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 500 * 1024 * 1024
      }
    } as any

    // Create engine with real components for integration testing
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
        validation: { enabled: true, strictMode: false },
        enrichment: { enabled: true },
        privacy: { enabled: true },
        quality: { enabled: true, qualityThreshold: 0.5 }
      },
      stream: {
        enabled: true,
        bufferSize: 50,
        flushInterval: 30000,
        enableInsights: true,
        enablePatternDetection: true
      },
      monitor: {
        enabled: true,
        collectionInterval: 2000,
        thresholds: {
          cpu: { warning: 70, critical: 90 },
          memory: { warning: 80 * 1024 * 1024, critical: 95 * 1024 * 1024 }
        }
      }
    })
  })

  afterEach(async () => {
    if (engine.isRunning()) {
      await engine.stop()
    }
  })

  describe('End-to-End Event Processing', () => {
    it('should process browser events through complete pipeline', async () => {
      await engine.start()

      // Create a realistic browser event
      const browserEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://github.com/spur/super-app',
        title: 'spur/super-app: Unified capture engine',
        action: 'navigation',
        timestampCaptured: Date.now(),
        metadata: {
          referrer: 'https://google.com',
          transitionType: 'link',
          favIconUrl: 'https://github.com/fluidicon.png'
        }
      }

      // Process event through engine
      const result = await engine.processEvent(browserEvent)

      expect(result).not.toBeNull()
      expect(result!.type).toBe(EventType.BROWSER_TAB)
      expect(result!.normalized).toBe(true)
      expect(result!.quality).toBeDefined()

      // Check that event was processed by all components
      const metrics = engine.getMetrics()
      expect(metrics.engine.eventsProcessed).toBe(1)
    })

    it('should process system events through complete pipeline', async () => {
      await engine.start()

      // Create a realistic system event
      const systemEvent: SystemAppEvent = {
        id: createEventId(),
        type: EventType.SYSTEM_APP,
        timestamp: Date.now(),
        source: 'system-monitor',
        sessionId: 'test-session',
        appName: 'Visual Studio Code',
        appPath: '/Applications/Visual Studio Code.app',
        action: 'focus',
        windowTitle: 'spur/src/capture/engine/unified.ts - Visual Studio Code',
        timestampCaptured: Date.now(),
        metadata: {
          processId: 12345,
          memoryUsage: 256 * 1024 * 1024,
          cpuUsage: 15.5,
          windowGeometry: {
            x: 100,
            y: 100,
            width: 1200,
            height: 800
          }
        }
      }

      // Process event through engine
      const result = await engine.processEvent(systemEvent)

      expect(result).not.toBeNull()
      expect(result!.type).toBe(EventType.SYSTEM_APP)
      expect(result!.normalized).toBe(true)
      expect(result!.quality).toBeDefined()

      // Check that event was processed by all components
      const metrics = engine.getMetrics()
      expect(metrics.engine.eventsProcessed).toBe(1)
    })

    it('should handle multiple event types simultaneously', async () => {
      await engine.start()

      const events = [
        {
          id: createEventId(),
          type: EventType.BROWSER_TAB as const,
          timestamp: Date.now(),
          source: 'chrome-extension',
          sessionId: 'test-session',
          tabId: 1,
          url: 'https://example.com',
          title: 'Example Page',
          action: 'navigation',
          timestampCaptured: Date.now()
        },
        {
          id: createEventId(),
          type: EventType.SYSTEM_APP as const,
          timestamp: Date.now() + 100,
          source: 'system-monitor',
          sessionId: 'test-session',
          appName: 'VS Code',
          action: 'focus',
          windowTitle: 'test.ts - VS Code',
          timestampCaptured: Date.now() + 100
        }
      ]

      // Process events
      const results = await engine.processEvents(events)

      expect(results).toHaveLength(2)
      expect(results.every(r => r !== null)).toBe(true)
      expect(results[0]!.type).toBe(EventType.BROWSER_TAB)
      expect(results[1]!.type).toBe(EventType.SYSTEM_APP)

      const metrics = engine.getMetrics()
      expect(metrics.engine.eventsProcessed).toBe(2)
    })
  })

  describe('Real-world Event Scenarios', () => {
    it('should handle typical user workflow scenario', async () => {
      await engine.start()

      // Simulate a typical user workflow
      const workflowEvents = [
        // User starts with email
        {
          id: createEventId(),
          type: EventType.BROWSER_TAB as const,
          timestamp: Date.now(),
          source: 'chrome-extension',
          sessionId: 'work-session',
          tabId: 1,
          url: 'https://mail.google.com',
          title: 'Inbox - user@gmail.com - Gmail',
          action: 'navigation',
          timestampCaptured: Date.now()
        },
        // User switches to code editor
        {
          id: createEventId(),
          type: EventType.SYSTEM_APP as const,
          timestamp: Date.now() + 5000,
          source: 'system-monitor',
          sessionId: 'work-session',
          appName: 'Visual Studio Code',
          action: 'focus',
          windowTitle: 'spur/src/capture - VS Code',
          timestampCaptured: Date.now() + 5000
        },
        // User navigates to documentation
        {
          id: createEventId(),
          type: EventType.BROWSER_TAB as const,
          timestamp: Date.now() + 10000,
          source: 'chrome-extension',
          sessionId: 'work-session',
          tabId: 2,
          url: 'https://developer.mozilla.org/en-US/docs/Web/API',
          title: 'Web APIs | MDN',
          action: 'navigation',
          timestampCaptured: Date.now() + 10000
        },
        // User returns to code editor
        {
          id: createEventId(),
          type: EventType.SYSTEM_APP as const,
          timestamp: Date.now() + 15000,
          source: 'system-monitor',
          sessionId: 'work-session',
          appName: 'Visual Studio Code',
          action: 'focus',
          windowTitle: 'spur/src/capture - VS Code',
          timestampCaptured: Date.now() + 15000
        }
      ]

      // Process workflow events
      const results = await engine.processEvents(workflowEvents)

      expect(results).toHaveLength(4)
      expect(results.every(r => r !== null)).toBe(true)

      // Check that patterns were detected
      const stream = engine['stream'] as RealTimeStream
      const patterns = stream['detectedPatterns']
      expect(patterns.length).toBeGreaterThan(0)

      // Should detect development workflow pattern
      const devPattern = patterns.find(p => p.type === 'development_workflow')
      expect(devPattern).toBeDefined()
    })

    it('should handle research workflow scenario', async () => {
      await engine.start()

      const researchEvents = [
        {
          id: createEventId(),
          type: EventType.BROWSER_TAB as const,
          timestamp: Date.now(),
          source: 'chrome-extension',
          sessionId: 'research-session',
          tabId: 1,
          url: 'https://scholar.google.com',
          title: 'Google Scholar',
          action: 'navigation',
          timestampCaptured: Date.now()
        },
        {
          id: createEventId(),
          type: EventType.BROWSER_TAB as const,
          timestamp: Date.now() + 3000,
          source: 'chrome-extension',
          sessionId: 'research-session',
          tabId: 2,
          url: 'https://arxiv.org',
          title: 'arXiv.org',
          action: 'navigation',
          timestampCaptured: Date.now() + 3000
        },
        {
          id: createEventId(),
          type: EventType.BROWSER_TAB as const,
          timestamp: Date.now() + 6000,
          source: 'chrome-extension',
          sessionId: 'research-session',
          tabId: 3,
          url: 'https://stackoverflow.com',
          title: 'Stack Overflow',
          action: 'navigation',
          timestampCaptured: Date.now() + 6000
        }
      ]

      const results = await engine.processEvents(researchEvents)

      expect(results).toHaveLength(3)
      expect(results.every(r => r !== null)).toBe(true)

      // Check that research pattern was detected
      const stream = engine['stream'] as RealTimeStream
      const patterns = stream['detectedPatterns']
      const researchPattern = patterns.find(p => p.type === 'research_pattern')
      expect(researchPattern).toBeDefined()
      expect(researchPattern.frequency).toBe(3)
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle malformed events gracefully', async () => {
      await engine.start()

      const malformedEvent = {
        id: 'invalid-id',
        type: 'invalid-type',
        timestamp: 'not-a-timestamp'
      } as any

      const result = await engine.processEvent(malformedEvent)

      expect(result).toBeNull()

      // Should not crash the engine
      expect(engine.isRunning()).toBe(true)

      const metrics = engine.getMetrics()
      expect(metrics.engine.processingErrors).toBe(1)
    })

    it('should continue operating after component failures', async () => {
      await engine.start()

      // Simulate normalizer failure
      const normalizer = engine['normalizer'] as EventNormalizer
      vi.spyOn(normalizer, 'normalizeEvent').mockRejectedValueOnce(new Error('Normalization failed'))

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

      const result = await engine.processEvent(event)

      expect(result).toBeNull()
      expect(engine.isRunning()).toBe(true) // Engine should continue running

      // Should still be able to process subsequent events
      vi.spyOn(normalizer, 'normalizeEvent').mockRestore()
      const secondResult = await engine.processEvent({
        ...event,
        id: createEventId()
      })

      expect(secondResult).not.toBeNull()
    })

    it('should handle high event load gracefully', async () => {
      await engine.start()

      // Generate high event load
      const events: BrowserTabEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 10,
        source: 'chrome-extension',
        sessionId: 'stress-test',
        tabId: (i % 10) + 1,
        url: `https://example.com/page${i}`,
        title: `Page ${i}`,
        action: 'navigation',
        timestampCaptured: Date.now() + i * 10
      }))

      const results = await engine.processEvents(events)

      expect(results.length).toBe(100)
      expect(results.filter(r => r !== null).length).toBeGreaterThan(90) // Most should succeed

      // Check performance metrics
      const metrics = engine.getMetrics()
      expect(metrics.engine.eventsProcessed).toBeGreaterThan(90)
      expect(metrics.performance).toBeDefined()
    })
  })

  describe('Performance and Scalability', () => {
    it('should maintain performance under sustained load', async () => {
      await engine.start()

      const startTime = Date.now()
      const eventCount = 50

      // Process sustained load
      for (let i = 0; i < eventCount; i++) {
        const event: BrowserTabEvent = {
          id: createEventId(),
          type: EventType.BROWSER_TAB,
          timestamp: Date.now() + i * 20,
          source: 'chrome-extension',
          sessionId: 'perf-test',
          tabId: (i % 5) + 1,
          url: `https://example.com/page${i}`,
          title: `Page ${i}`,
          action: 'navigation',
          timestampCaptured: Date.now() + i * 20
        }

        await engine.processEvent(event)
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime
      const eventsPerSecond = (eventCount / totalTime) * 1000

      expect(eventsPerSecond).toBeGreaterThan(10) // Should handle at least 10 events/second

      // Check memory usage
      const metrics = engine.getMetrics()
      expect(metrics.performance.memoryUsage).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
    })

    it('should scale with increasing event complexity', async () => {
      await engine.start()

      // Simple events
      const simpleEvents: BrowserTabEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 10,
        source: 'chrome-extension',
        sessionId: 'scale-test',
        tabId: i + 1,
        url: `https://example.com/page${i}`,
        title: `Page ${i}`,
        action: 'navigation',
        timestampCaptured: Date.now() + i * 10
      }))

      // Complex events with rich metadata
      const complexEvents: BrowserTabEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 10,
        source: 'chrome-extension',
        sessionId: 'scale-test',
        tabId: i + 1,
        url: `https://example.com/complex/page${i}`,
        title: `Complex Page ${i} with Long Title and Additional Information`,
        action: 'navigation',
        timestampCaptured: Date.now() + i * 10,
        metadata: {
          referrer: 'https://google.com',
          transitionType: 'link',
          favIconUrl: 'https://example.com/favicon.ico',
          content: 'This is a long content string with lots of information that needs to be processed and analyzed for entities, sentiment, and other enrichment features.'.repeat(10),
          screenshots: ['data:image/png;base64,large-image-data'],
          domInfo: {
            elements: 1500,
            images: 25,
            scripts: 15,
            stylesheets: 8
          }
        }
      }))

      const simpleStart = Date.now()
      await engine.processEvents(simpleEvents)
      const simpleTime = Date.now() - simpleStart

      const complexStart = Date.now()
      await engine.processEvents(complexEvents)
      const complexTime = Date.now() - complexStart

      // Complex events should take longer but not excessively so
      expect(complexTime).toBeGreaterThan(simpleTime)
      expect(complexTime).toBeLessThan(simpleTime * 5) // Should not be 5x slower
    })
  })

  describe('Integration with External Services', () => {
    it('should integrate with assistant services when enabled', async () => {
      const engineWithAssistant = new UnifiedCaptureEngine({
        enabled: true,
        stream: {
          enabled: true,
          enableInsights: true,
          bufferSize: 10,
          flushInterval: 5000
        }
      })

      await engineWithAssistant.start()

      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'assistant-test',
        tabId: 1,
        url: 'https://github.com/user/repo/issues/123',
        title: 'Bug: Feature not working - Issue #123',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      await engineWithAssistant.processEvent(event)

      // Check that insights were generated
      const stream = engineWithAssistant['stream'] as RealTimeStream
      const insights = stream['recentInsights']
      expect(insights.length).toBeGreaterThan(0)
    })

    it('should handle assistant service unavailability gracefully', async () => {
      // Mock assistant service to be unavailable
      global.fetch = vi.fn().mockRejectedValue(new Error('Assistant service unavailable'))

      await engine.start()

      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'assistant-test',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      // Should still process events despite assistant being unavailable
      const result = await engine.processEvent(event)

      expect(result).not.toBeNull()
      expect(engine.isRunning()).toBe(true)
    })
  })

  describe('Configuration and Runtime Behavior', () => {
    it('should respect configuration changes at runtime', async () => {
      await engine.start()

      // Check initial configuration
      const initialMetrics = engine.getMetrics()
      expect(initialMetrics.engine.eventsProcessed).toBe(0)

      // Update configuration to change processing behavior
      await engine.updateConfig({
        normalizer: {
          quality: {
            qualityThreshold: 0.9 // Higher threshold
          }
        }
      })

      // Process an event that would have passed old threshold but fails new one
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'config-test',
        tabId: 1,
        url: 'https://example.com',
        title: 'Low Quality', // Lower quality content
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const result = await engine.processEvent(event)

      // Event should be filtered out due to higher quality threshold
      expect(result).toBeNull()

      const metrics = engine.getMetrics()
      expect(metrics.engine.eventsFiltered).toBeGreaterThan(0)
    })

    it('should persist configuration across restarts', async () => {
      await engine.start()

      // Update configuration
      await engine.updateConfig({
        collectors: {
          manager: {
            maxEventsPerSecond: 200
          }
        }
      })

      await engine.stop()

      // Restart engine
      await engine.start()

      // Configuration should be preserved
      expect(engine['config'].collectors.manager.maxEventsPerSecond).toBe(200)
    })
  })

  describe('Health Monitoring and Diagnostics', () => {
    it('should provide comprehensive health information', async () => {
      await engine.start()

      const health = await engine.checkHealth()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('components')
      expect(health).toHaveProperty('overallScore')
      expect(health).toHaveProperty('issues')
      expect(health.components).toHaveLength(4)
    })

    it('should detect and report performance degradation', async () => {
      await engine.start()

      // Simulate performance degradation by processing many events
      const events: BrowserTabEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 5,
        source: 'chrome-extension',
        sessionId: 'health-test',
        tabId: i + 1,
        url: `https://example.com/page${i}`,
        title: `Page ${i}`,
        action: 'navigation',
        timestampCaptured: Date.now() + i * 5
      }))

      await engine.processEvents(events)

      const health = await engine.checkHealth()
      const diagnostics = engine.getErrorDiagnostics()

      expect(diagnostics).toHaveProperty('errorRate')
      expect(diagnostics).toHaveProperty('lastError')
      expect(health.overallScore).toBeGreaterThan(0)
    })

    it('should generate useful diagnostic reports', async () => {
      await engine.start()

      // Process some events to generate diagnostic data
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'diagnostic-test',
        tabId: 1,
        url: 'https://example.com',
        title: 'Diagnostic Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      await engine.processEvent(event)

      const report = engine.generateReport()

      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('performance')
      expect(report).toHaveProperty('components')
      expect(report).toHaveProperty('recommendations')
      expect(report.summary.totalEvents).toBe(1)
      expect(report.summary.uptime).toBeGreaterThan(0)
    })
  })
})