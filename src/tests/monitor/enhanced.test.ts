import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PerformanceMonitor } from '@capture/monitor/enhanced'
import { EventType, createEventId, type BaseEvent } from '@types/events'

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor
  let mockMetricsCollector: any
  let mockAlertManager: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock performance API
    global.performance = {
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 500 * 1024 * 1024 // 500MB
      }
    } as any

    // Mock metrics collector
    mockMetricsCollector = {
      recordMetric: vi.fn(),
      getMetrics: vi.fn(() => ({
        cpu: { usage: 25.5 },
        memory: { used: 50 * 1024 * 1024 },
        events: { processed: 100, errors: 2 }
      }))
    }

    // Mock alert manager
    mockAlertManager = {
      checkThresholds: vi.fn(),
      sendAlert: vi.fn()
    }

    monitor = new PerformanceMonitor({
      enabled: true,
      collectionInterval: 1000,
      profiling: {
        enabled: true,
        sampleRate: 0.1,
        maxProfiles: 100
      },
      thresholds: {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 80 * 1024 * 1024, critical: 95 * 1024 * 1024 },
        eventLatency: { warning: 100, critical: 200 },
        errorRate: { warning: 5, critical: 10 }
      },
      alerts: {
        enabled: true,
        channels: ['console', 'log'],
        cooldown: 300000
      },
      metricsCollector: mockMetricsCollector,
      alertManager: mockAlertManager
    })
  })

  afterEach(() => {
    if (monitor.isActive()) {
      monitor.stop()
    }
  })

  describe('Initialization', () => {
    it('should initialize monitor with configuration', async () => {
      await monitor.start()

      expect(monitor.isActive()).toBe(true)
      expect(monitor['intervalId']).toBeDefined()
      expect(monitor['startTime']).toBeInstanceOf(Number)
    })

    it('should handle initialization errors gracefully', async () => {
      const faultyMonitor = new PerformanceMonitor({
        enabled: true,
        collectionInterval: -1 // Invalid interval
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(faultyMonitor.start()).rejects.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize performance monitor:',
        expect.any(Error)
      )
    })

    it('should not start when disabled', async () => {
      const disabledMonitor = new PerformanceMonitor({
        enabled: false
      })

      await disabledMonitor.start()

      expect(disabledMonitor.isActive()).toBe(false)
    })
  })

  describe('Metrics Collection', () => {
    it('should collect CPU metrics', async () => {
      // Mock CPU usage calculation
      vi.spyOn(monitor as any, 'calculateCPUUsage').mockReturnValue(45.5)

      await monitor.start()

      // Wait for collection cycle
      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      
      expect(metrics).toHaveProperty('cpu')
      expect(metrics.cpu).toHaveProperty('usage')
      expect(metrics.cpu.usage).toBe(45.5)
    })

    it('should collect memory metrics', async () => {
      await monitor.start()

      // Wait for collection cycle
      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      
      expect(metrics).toHaveProperty('memory')
      expect(metrics.memory).toHaveProperty('used')
      expect(metrics.memory).toHaveProperty('total')
      expect(metrics.memory).toHaveProperty('percentage')
      expect(metrics.memory.used).toBe(50 * 1024 * 1024)
    })

    it('should collect event processing metrics', async () => {
      await monitor.start()

      // Simulate event processing
      monitor.recordEventProcessing({
        eventId: createEventId(),
        startTime: performance.now() - 50,
        endTime: performance.now(),
        type: EventType.BROWSER_TAB,
        success: true
      })

      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      
      expect(metrics).toHaveProperty('events')
      expect(metrics.events).toHaveProperty('processed')
      expect(metrics.events).toHaveProperty('averageLatency')
      expect(metrics.events).toHaveProperty('successRate')
      expect(metrics.events.processed).toBe(1)
    })

    it('should collect error metrics', async () => {
      await monitor.start()

      // Simulate errors
      monitor.recordError({
        type: 'processing',
        message: 'Event processing failed',
        source: 'collector',
        timestamp: Date.now()
      })

      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      
      expect(metrics).toHaveProperty('errors')
      expect(metrics.errors).toHaveProperty('total')
      expect(metrics.errors).toHaveProperty('byType')
      expect(metrics.errors.total).toBe(1)
      expect(metrics.errors.byType.processing).toBe(1)
    })

    it('should collect custom metrics', async () => {
      await monitor.start()

      monitor.recordCustomMetric('user_satisfaction', 4.5)
      monitor.recordCustomMetric('response_time', 150)

      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      
      expect(metrics).toHaveProperty('custom')
      expect(metrics.custom.user_satisfaction).toBe(4.5)
      expect(metrics.custom.response_time).toBe(150)
    })
  })

  describe('Performance Profiling', () => {
    it('should start and stop performance profiles', async () => {
      const profilingMonitor = new PerformanceMonitor({
        enabled: true,
        profiling: {
          enabled: true,
          sampleRate: 1.0, // 100% for testing
          maxProfiles: 10
        }
      })

      await profilingMonitor.start()

      const profileId = await profilingMonitor.startProfile('test-operation')
      expect(profileId).toBeDefined()
      expect(typeof profileId).toBe('string')

      // Simulate some work
      vi.advanceTimersByTime(100)

      const profile = await profilingMonitor.endProfile(profileId)
      
      expect(profile).toHaveProperty('id')
      expect(profile).toHaveProperty('name')
      expect(profile).toHaveProperty('startTime')
      expect(profile).toHaveProperty('endTime')
      expect(profile).toHaveProperty('duration')
      expect(profile.duration).toBeGreaterThan(0)
    })

    it('should handle profile errors gracefully', async () => {
      await monitor.start()

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // End non-existent profile
      const result = await monitor.endProfile('non-existent-id')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Profile non-existent-id not found'
      )
    })

    it('should limit number of stored profiles', async () => {
      const limitedMonitor = new PerformanceMonitor({
        enabled: true,
        profiling: {
          enabled: true,
          sampleRate: 1.0,
          maxProfiles: 2
        }
      })

      await limitedMonitor.start()

      // Create more profiles than the limit
      const profileIds = []
      for (let i = 0; i < 3; i++) {
        const id = await limitedMonitor.startProfile(`test-${i}`)
        vi.advanceTimersByTime(10)
        await limitedMonitor.endProfile(id)
        profileIds.push(id)
      }

      const metrics = limitedMonitor.getMetrics()
      
      expect(metrics.profiles.active).toHaveLength(0)
      expect(metrics.profiles.recent).toHaveLength(2) // Limited to maxProfiles
    })

    it('should sample profiles based on sample rate', async () => {
      const samplingMonitor = new PerformanceMonitor({
        enabled: true,
        profiling: {
          enabled: true,
          sampleRate: 0.5, // 50% sampling
          maxProfiles: 10
        }
      })

      await samplingMonitor.start()

      const profileResults = []
      for (let i = 0; i < 10; i++) {
        const id = await samplingMonitor.startProfile(`test-${i}`)
        if (id) {
          vi.advanceTimersByTime(10)
          await samplingMonitor.endProfile(id)
          profileResults.push(id)
        }
      }

      // Should have roughly 50% sampling rate
      expect(profileResults.length).toBeLessThanOrEqual(8)
      expect(profileResults.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Threshold Monitoring', () => {
    it('should check thresholds against current metrics', async () => {
      await monitor.start()

      // Set high CPU usage to trigger threshold
      vi.spyOn(monitor as any, 'calculateCPUUsage').mockReturnValue(85.0)

      vi.advanceTimersByTime(1500)

      expect(mockAlertManager.checkThresholds).toHaveBeenCalledWith(
        expect.objectContaining({
          cpu: { usage: 85.0 }
        })
      )
    })

    it('should detect memory threshold violations', async () => {
      // Override performance memory with high usage
      global.performance.memory = {
        usedJSHeapSize: 90 * 1024 * 1024, // 90MB - exceeds warning threshold
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 500 * 1024 * 1024
      } as any

      await monitor.start()

      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      expect(metrics.memory.percentage).toBeGreaterThan(80)
    })

    it('should track threshold violations', async () => {
      await monitor.start()

      // Simulate threshold violation
      monitor.recordThresholdViolation({
        metric: 'cpu',
        value: 85.0,
        threshold: 70.0,
        level: 'warning',
        timestamp: Date.now()
      })

      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      
      expect(metrics).toHaveProperty('thresholds')
      expect(metrics.thresholds).toHaveProperty('violations')
      expect(metrics.thresholds.violations.length).toBeGreaterThan(0)
      expect(metrics.thresholds.violations[0].metric).toBe('cpu')
    })
  })

  describe('Alert Management', () => {
    it('should send alerts for threshold violations', async () => {
      await monitor.start()

      // Trigger a threshold violation
      monitor.recordThresholdViolation({
        metric: 'memory',
        value: 90 * 1024 * 1024,
        threshold: 80 * 1024 * 1024,
        level: 'warning',
        timestamp: Date.now()
      })

      vi.advanceTimersByTime(1500)

      expect(mockAlertManager.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'threshold',
          level: 'warning',
          metric: 'memory'
        })
      )
    })

    it('should respect alert cooldown period', async () => {
      const cooldownMonitor = new PerformanceMonitor({
        enabled: true,
        alerts: {
          enabled: true,
          cooldown: 60000, // 1 minute cooldown
          channels: ['console']
        }
      })

      await cooldownMonitor.start()

      // Send first alert
      cooldownMonitor.sendAlert({
        type: 'threshold',
        level: 'warning',
        message: 'CPU usage high',
        metric: 'cpu'
      })

      // Try to send second alert immediately
      cooldownMonitor.sendAlert({
        type: 'threshold',
        level: 'warning',
        message: 'CPU usage still high',
        metric: 'cpu'
      })

      expect(mockAlertManager.sendAlert).toHaveBeenCalledTimes(1)

      // Fast-forward beyond cooldown
      vi.advanceTimersByTime(61000)

      // Should send alert now
      cooldownMonitor.sendAlert({
        type: 'threshold',
        level: 'warning',
        message: 'CPU usage critical',
        metric: 'cpu'
      })

      expect(mockAlertManager.sendAlert).toHaveBeenCalledTimes(2)
    })

    it('should handle alert sending errors gracefully', async () => {
      mockAlertManager.sendAlert.mockRejectedValue(new Error('Alert service unavailable'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await monitor.start()

      monitor.sendAlert({
        type: 'threshold',
        level: 'warning',
        message: 'Test alert',
        metric: 'cpu'
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send alert:',
        expect.any(Error)
      )
    })
  })

  describe('Event Processing Tracking', () => {
    it('should record event processing metrics', async () => {
      await monitor.start()

      const eventId = createEventId()
      const startTime = performance.now()
      
      monitor.recordEventStart(eventId, EventType.BROWSER_TAB)
      
      // Simulate processing time
      vi.advanceTimersByTime(50)
      
      monitor.recordEventEnd(eventId, true)

      const metrics = monitor.getMetrics()
      
      expect(metrics.events.processed).toBe(1)
      expect(metrics.events.successRate).toBe(1)
      expect(metrics.events.averageLatency).toBeGreaterThan(40)
    })

    it('should track processing errors', async () => {
      await monitor.start()

      const eventId = createEventId()
      
      monitor.recordEventStart(eventId, EventType.BROWSER_TAB)
      monitor.recordEventEnd(eventId, false, 'Processing failed')

      const metrics = monitor.getMetrics()
      
      expect(metrics.events.processed).toBe(1)
      expect(metrics.events.successRate).toBe(0)
      expect(metrics.errors.byType.processing).toBe(1)
    })

    it('should handle orphaned event tracking', async () => {
      await monitor.start()

      // Start event but never end it
      monitor.recordEventStart(createEventId(), EventType.BROWSER_TAB)

      // Advance time to trigger cleanup
      vi.advanceTimersByTime(310000) // 5+ minutes

      const metrics = monitor.getMetrics()
      
      expect(metrics.events.orphaned).toBe(1)
    })
  })

  describe('System Resource Monitoring', () => {
    it('should monitor CPU usage trends', async () => {
      await monitor.start()

      // Simulate varying CPU usage
      const cpuUsages = [25, 30, 45, 60, 75]
      for (const usage of cpuUsages) {
        vi.spyOn(monitor as any, 'calculateCPUUsage').mockReturnValue(usage)
        vi.advanceTimersByTime(1100)
      }

      const metrics = monitor.getMetrics()
      
      expect(metrics.cpu.trend).toBeDefined()
      expect(metrics.cpu.trend.direction).toBe('increasing')
      expect(metrics.cpu.trend.rate).toBeGreaterThan(0)
    })

    it('should detect memory leaks', async () => {
      await monitor.start()

      // Simulate increasing memory usage
      const memoryUsages = [50, 55, 60, 65, 70]
      for (let i = 0; i < memoryUsages.length; i++) {
        global.performance.memory.usedJSHeapSize = memoryUsages[i] * 1024 * 1024
        vi.advanceTimersByTime(1100)
      }

      const metrics = monitor.getMetrics()
      
      expect(metrics.memory.trend).toBeDefined()
      expect(metrics.memory.trend.direction).toBe('increasing')
      expect(metrics.memory.leakSuspected).toBe(true)
    })

    it('should calculate system health score', async () => {
      await monitor.start()

      // Set good metrics
      vi.spyOn(monitor as any, 'calculateCPUUsage').mockReturnValue(25.0)
      global.performance.memory.usedJSHeapSize = 50 * 1024 * 1024

      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      
      expect(metrics).toHaveProperty('health')
      expect(metrics.health).toHaveProperty('score')
      expect(metrics.health).toHaveProperty('status')
      expect(metrics.health.score).toBeGreaterThan(80)
      expect(metrics.health.status).toBe('good')
    })
  })

  describe('Metrics Aggregation', () => {
    it('should calculate aggregated statistics', async () => {
      await monitor.start()

      // Record multiple metrics
      for (let i = 0; i < 10; i++) {
        monitor.recordEventProcessing({
          eventId: createEventId(),
          startTime: performance.now() - Math.random() * 100,
          endTime: performance.now(),
          type: EventType.BROWSER_TAB,
          success: i < 8 // 80% success rate
        })
      }

      vi.advanceTimersByTime(1500)

      const metrics = monitor.getMetrics()
      
      expect(metrics.events).toHaveProperty('minLatency')
      expect(metrics.events).toHaveProperty('maxLatency')
      expect(metrics.events).toHaveProperty('p95Latency')
      expect(metrics.events).toHaveProperty('p99Latency')
      expect(metrics.events.successRate).toBe(0.8)
    })

    it('should provide time-windowed metrics', async () => {
      await monitor.start()

      // Record metrics at different times
      const now = Date.now()
      monitor.recordCustomMetric('requests', 10, now - 3600000) // 1 hour ago
      monitor.recordCustomMetric('requests', 20, now - 1800000) // 30 minutes ago
      monitor.recordCustomMetric('requests', 30, now) // now

      vi.advanceTimersByTime(1500)

      const recentMetrics = monitor.getTimeWindowMetrics(1800000) // Last 30 minutes
      
      expect(recentMetrics.custom.requests).toBe(50) // 20 + 30
    })
  })

  describe('Lifecycle Management', () => {
    it('should start and stop gracefully', async () => {
      await monitor.start()
      expect(monitor.isActive()).toBe(true)

      await monitor.stop()
      expect(monitor.isActive()).toBe(false)
      expect(monitor['intervalId']).toBeNull()
    })

    it('should clear resources on stop', async () => {
      await monitor.start()

      // Add some data
      monitor.recordCustomMetric('test', 100)
      await monitor.startProfile('test-profile')

      expect(monitor.getMetrics().custom.test).toBe(100)

      await monitor.stop()

      // Should clear most data but preserve configuration
      expect(monitor.isActive()).toBe(false)
    })

    it('should handle stop when not running', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await monitor.stop()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Performance monitor is not running'
      )
    })
  })

  describe('Export and Reporting', () => {
    it('should export metrics as JSON', async () => {
      await monitor.start()

      monitor.recordCustomMetric('test_metric', 42)
      vi.advanceTimersByTime(1500)

      const exported = monitor.exportMetrics()

      expect(exported).toHaveProperty('timestamp')
      expect(exported).toHaveProperty('uptime')
      expect(exported).toHaveProperty('metrics')
      expect(exported.metrics.custom.test_metric).toBe(42)
    })

    it('should generate performance report', async () => {
      await monitor.start()

      // Add some data for report
      for (let i = 0; i < 5; i++) {
        monitor.recordEventProcessing({
          eventId: createEventId(),
          startTime: performance.now() - 50,
          endTime: performance.now(),
          type: EventType.BROWSER_TAB,
          success: true
        })
      }

      monitor.recordError({
        type: 'processing',
        message: 'Test error',
        source: 'test',
        timestamp: Date.now()
      })

      vi.advanceTimersByTime(1500)

      const report = monitor.generateReport()

      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('metrics')
      expect(report).toHaveProperty('recommendations')
      expect(report.summary.totalEvents).toBe(5)
      expect(report.summary.totalErrors).toBe(1)
    })

    it('should provide health check status', async () => {
      await monitor.start()

      const health = await monitor.checkHealth()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('metrics')
      expect(health).toHaveProperty('issues')
      expect(typeof health.healthy).toBe('boolean')
    })
  })
})