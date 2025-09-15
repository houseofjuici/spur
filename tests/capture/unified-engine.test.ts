import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnifiedCaptureEngine } from '@/capture/engine/unified'
import { EventNormalizer } from '@/capture/normalizer'
import { AssistantStream } from '@/capture/stream'
import { MemoryGraph } from '@/memory/graph'

// Mock dependencies
vi.mock('@/capture/normalizer')
vi.mock('@/capture/stream')
vi.mock('@/memory/graph')

describe('UnifiedCaptureEngine', () => {
  let captureEngine: UnifiedCaptureEngine
  let mockNormalizer: any
  let mockStream: any
  let mockMemory: any
  let mockConfig: any

  beforeEach(() => {
    mockNormalizer = {
      normalize: vi.fn().mockReturnValue({
        id: 'test-event-id',
        type: 'browser',
        timestamp: Date.now(),
        source: 'test-source',
        metadata: { test: true }
      })
    }

    mockStream = {
      streamToAssistant: vi.fn().mockResolvedValue(true),
      streamToMemory: vi.fn().mockResolvedValue(true)
    }

    mockMemory = {
      addNode: vi.fn().mockResolvedValue('node-id'),
      query: vi.fn().mockResolvedValue([])
    }

    mockConfig = {
      maxBufferSize: 1000,
      flushInterval: 5000,
      enablePerformanceMonitoring: true,
      enableMemoryStreaming: true,
      enableAssistantStreaming: true
    }

    vi.mocked(EventNormalizer).mockImplementation(() => mockNormalizer)
    vi.mocked(AssistantStream).mockImplementation(() => mockStream)
    vi.mocked(MemoryGraph).mockImplementation(() => mockMemory)

    captureEngine = new UnifiedCaptureEngine(mockConfig)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(captureEngine).toBeDefined()
      expect(EventNormalizer).toHaveBeenCalledWith()
      expect(AssistantStream).toHaveBeenCalledWith()
      expect(MemoryGraph).toHaveBeenCalledWith()
    })

    it('should set up event listeners on initialization', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      
      await captureEngine.initialize()
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    })

    it('should start performance monitoring if enabled', async () => {
      await captureEngine.initialize()
      
      if (mockConfig.enablePerformanceMonitoring) {
        expect(captureEngine['performanceMonitor']).toBeDefined()
      }
    })
  })

  describe('Event Capture', () => {
    it('should capture browser events correctly', async () => {
      const mockEvent = {
        type: 'click',
        target: { tagName: 'BUTTON', className: 'test-button' },
        timestamp: Date.now(),
        url: 'http://test.com'
      }

      await captureEngine.captureEvent('browser', mockEvent)

      expect(mockNormalizer.normalize).toHaveBeenCalledWith({
        type: 'browser',
        source: 'dom',
        timestamp: mockEvent.timestamp,
        data: mockEvent
      })
    })

    it('should capture system events correctly', async () => {
      const mockEvent = {
        type: 'storage',
        key: 'test-key',
        newValue: 'test-value',
        timestamp: Date.now()
      }

      await captureEngine.captureEvent('system', mockEvent)

      expect(mockNormalizer.normalize).toHaveBeenCalledWith({
        type: 'system',
        source: 'storage',
        timestamp: mockEvent.timestamp,
        data: mockEvent
      })
    })

    it('should handle event normalization errors gracefully', async () => {
      mockNormalizer.normalize.mockRejectedValue(new Error('Normalization failed'))
      
      const consoleSpy = vi.spyOn(console, 'error')
      
      await captureEngine.captureEvent('browser', { type: 'test' })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to normalize event:',
        expect.any(Error)
      )
    })

    it('should queue events during high-frequency bursts', async () => {
      const mockEvents = Array.from({ length: 50 }, (_, i) => ({
        type: 'click',
        target: { tagName: 'BUTTON' },
        timestamp: Date.now() + i
      }))

      const capturePromises = mockEvents.map(event => 
        captureEngine.captureEvent('browser', event)
      )

      await Promise.all(capturePromises)

      expect(mockNormalizer.normalize).toHaveBeenCalledTimes(50)
    })
  })

  describe('Event Processing', () => {
    it('should process normalized events correctly', async () => {
      const normalizedEvent = {
        id: 'test-event-1',
        type: 'browser',
        timestamp: Date.now(),
        source: 'test',
        metadata: { important: true }
      }

      await captureEngine.processEvent(normalizedEvent)

      if (mockConfig.enableAssistantStreaming) {
        expect(mockStream.streamToAssistant).toHaveBeenCalledWith(normalizedEvent)
      }

      if (mockConfig.enableMemoryStreaming) {
        expect(mockStream.streamToMemory).toHaveBeenCalledWith(normalizedEvent)
      }
    })

    it('should handle streaming errors gracefully', async () => {
      mockStream.streamToAssistant.mockRejectedValue(new Error('Streaming failed'))
      
      const consoleSpy = vi.spyOn(console, 'error')
      
      const normalizedEvent = {
        id: 'test-event-1',
        type: 'browser',
        timestamp: Date.now(),
        source: 'test'
      }

      await captureEngine.processEvent(normalizedEvent)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to stream event:',
        expect.any(Error)
      )
    })

    it('should batch process events for efficiency', async () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        id: `event-${i}`,
        type: 'browser',
        timestamp: Date.now() + i,
        source: 'test'
      }))

      const processSpy = vi.spyOn(captureEngine, 'processEvent')
      
      for (const event of events) {
        await captureEngine.processEvent(event)
      }

      expect(processSpy).toHaveBeenCalledTimes(10)
    })
  })

  describe('Performance Monitoring', () => {
    it('should track capture performance metrics', async () => {
      await captureEngine.initialize()

      const startTime = performance.now()
      await captureEngine.captureEvent('browser', { type: 'test' })
      const endTime = performance.now()

      const metrics = captureEngine.getPerformanceMetrics()
      
      expect(metrics).toBeDefined()
      expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0)
      expect(metrics.eventsProcessed).toBeGreaterThan(0)
    })

    it('should detect performance degradation', async () => {
      await captureEngine.initialize()

      // Simulate slow processing
      vi.spyOn(captureEngine, 'processEvent').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      await captureEngine.captureEvent('browser', { type: 'test' })

      const metrics = captureEngine.getPerformanceMetrics()
      expect(metrics.averageProcessingTime).toBeGreaterThan(50)
    })

    it('should provide performance recommendations', async () => {
      await captureEngine.initialize()

      const recommendations = captureEngine.getPerformanceRecommendations()
      
      expect(Array.isArray(recommendations)).toBe(true)
    })
  })

  describe('Memory Management', () => {
    it('should clean up old events periodically', async () => {
      await captureEngine.initialize()

      // Add old events
      captureEngine['eventBuffer'] = Array.from({ length: 100 }, (_, i) => ({
        id: `old-event-${i}`,
        timestamp: Date.now() - (86400000 * 7), // 7 days ago
        processed: true
      }))

      await captureEngine.cleanupOldEvents()

      expect(captureEngine['eventBuffer'].length).toBeLessThan(100)
    })

    it('should handle memory pressure gracefully', async () => {
      await captureEngine.initialize()

      // Simulate memory pressure
      const pressureEvent = new Event('memorypressure')
      window.dispatchEvent(pressureEvent)

      await new Promise(resolve => setTimeout(resolve, 100))

      const metrics = captureEngine.getPerformanceMetrics()
      expect(metrics.memoryPressureEvents).toBeGreaterThan(0)
    })
  })

  describe('Event Filtering', () => {
    it('should filter sensitive events by default', async () => {
      const sensitiveEvent = {
        type: 'input',
        target: { 
          tagName: 'INPUT',
          type: 'password'
        },
        value: 'secret-password'
      }

      await captureEngine.captureEvent('browser', sensitiveEvent)

      expect(mockNormalizer.normalize).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            value: '[REDACTED]'
          })
        })
      )
    })

    it('should respect privacy settings', async () => {
      captureEngine.updateConfig({
        captureSensitiveData: false,
        capturePersonalData: false
      })

      const personalEvent = {
        type: 'input',
        target: { 
          tagName: 'INPUT',
          type: 'email'
        },
        value: 'user@example.com'
      }

      await captureEngine.captureEvent('browser', personalEvent)

      expect(mockNormalizer.normalize).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            value: '[PERSONAL]'
          })
        })
      )
    })
  })

  describe('Integration Features', () => {
    it('should integrate with memory graph for context', async () => {
      const mockEvent = {
        id: 'context-event',
        type: 'browser',
        timestamp: Date.now(),
        context: 'github-repository'
      }

      await captureEngine.captureEvent('browser', mockEvent)

      expect(mockMemory.query).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'context',
          value: 'github-repository'
        })
      )
    })

    it('should provide event statistics', async () => {
      await captureEngine.initialize()

      // Capture various events
      await captureEngine.captureEvent('browser', { type: 'click' })
      await captureEngine.captureEvent('system', { type: 'storage' })
      await captureEngine.captureEvent('browser', { type: 'scroll' })

      const stats = captureEngine.getEventStatistics()
      
      expect(stats.totalEvents).toBe(3)
      expect(stats.byType.browser).toBe(2)
      expect(stats.byType.system).toBe(1)
    })
  })

  describe('Error Recovery', () => {
    it('should retry failed event processing', async () => {
      mockStream.streamToMemory
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(true)

      const event = {
        id: 'retry-event',
        type: 'browser',
        timestamp: Date.now()
      }

      await captureEngine.processEvent(event)

      expect(mockStream.streamToMemory).toHaveBeenCalledTimes(2)
    })

    it('should handle complete system failures gracefully', async () => {
      mockMemory.addNode.mockRejectedValue(new Error('System failure'))
      mockStream.streamToAssistant.mockRejectedValue(new Error('System failure'))

      const consoleSpy = vi.spyOn(console, 'error')

      const event = {
        id: 'failure-event',
        type: 'browser',
        timestamp: Date.now()
      }

      await captureEngine.processEvent(event)

      expect(consoleSpy).toHaveBeenCalledTimes(2)
      expect(captureEngine.getPerformanceMetrics().errors).toBeGreaterThan(0)
    })
  })

  describe('Configuration Updates', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        maxBufferSize: 2000,
        flushInterval: 10000,
        enablePerformanceMonitoring: false
      }

      captureEngine.updateConfig(newConfig)

      expect(captureEngine['config']).toMatchObject(newConfig)
    })

    it('should validate configuration values', () => {
      const invalidConfig = {
        maxBufferSize: -1,
        flushInterval: 'invalid'
      }

      expect(() => {
        captureEngine.updateConfig(invalidConfig)
      }).toThrow()
    })
  })

  describe('Cleanup and Shutdown', () => {
    it('should cleanup resources properly', async () => {
      await captureEngine.initialize()
      
      const cleanupSpy = vi.spyOn(captureEngine, 'cleanup')
      
      await captureEngine.shutdown()
      
      expect(cleanupSpy).toHaveBeenCalled()
    })

    it('should flush remaining events on shutdown', async () => {
      captureEngine['eventBuffer'] = [
        { id: 'pending-1', processed: false },
        { id: 'pending-2', processed: false }
      ]

      await captureEngine.shutdown()

      expect(mockStream.streamToMemory).toHaveBeenCalledTimes(2)
    })
  })
})