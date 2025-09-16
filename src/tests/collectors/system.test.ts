import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SystemCollector } from '@capture/collectors/system'
import { EventType, createEventId, type SystemAppEvent } from '@types/events'

describe('SystemCollector', () => {
  let collector: SystemCollector
  let mockNativePort: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock native messaging port
    mockNativePort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() }
    }

    // Mock chrome.runtime.connectNative
    global.chrome = {
      runtime: {
        connectNative: vi.fn(() => mockNativePort)
      }
    } as any

    collector = new SystemCollector({
      name: 'system-collector',
      enabled: true,
      maxEventsPerBatch: 10,
      collectionInterval: 1000,
      nativeHostId: 'com.spur.system.monitor',
      enableNativeMonitoring: true,
      applicationFilters: {
        enabled: true,
        includeList: ['VS Code', 'Chrome', 'Safari'],
        excludeList: ['System Preferences', 'Activity Monitor']
      },
      captureWindowEvents: true,
      captureFileOperations: true,
      captureSystemEvents: true
    })
  })

  afterEach(async () => {
    if (collector.isRunning()) {
      await collector.stop()
    }
  })

  describe('Initialization', () => {
    it('should initialize system collector with native host', async () => {
      await collector.start()

      expect(collector.isRunning()).toBe(true)
      expect(global.chrome.runtime.connectNative).toHaveBeenCalledWith('com.spur.system.monitor')
      expect(mockNativePort.onMessage.addListener).toHaveBeenCalled()
      expect(mockNativePort.onDisconnect.addListener).toHaveBeenCalled()
    })

    it('should handle native host unavailability', async () => {
      delete (global as any).chrome

      const fallbackCollector = new SystemCollector({
        name: 'fallback-collector',
        enabled: true,
        enableNativeMonitoring: false
      })

      await fallbackCollector.start()

      expect(fallbackCollector.isRunning()).toBe(true)
      // Should start with polling-based monitoring instead
    })

    it('should handle native connection errors', async () => {
      global.chrome.runtime.connectNative.mockImplementation(() => {
        throw new Error('Native host not found')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(collector.start()).rejects.toThrow('Native host not found')
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to connect to native host:',
        expect.any(Error)
      )
    })
  })

  describe('Native Message Handling', () => {
    it('should handle application focus events', async () => {
      await collector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'application_focus',
        data: {
          appName: 'VS Code',
          appPath: '/Applications/Visual Studio Code.app',
          bundleId: 'com.microsoft.VSCode',
          windowTitle: 'spur/src/capture - Visual Studio Code',
          processId: 12345,
          timestamp: Date.now()
        }
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message)

      expect(processSpy).toHaveBeenCalled()
      const processedEvents = processSpy.mock.calls[0][0]
      expect(processedEvents).toHaveLength(1)
      
      const event = processedEvents[0] as SystemAppEvent
      expect(event.type).toBe(EventType.SYSTEM_APP)
      expect(event.action).toBe('focus')
      expect(event.appName).toBe('VS Code')
      expect(event.windowTitle).toBe('spur/src/capture - Visual Studio Code')
    })

    it('should handle application switch events', async () => {
      await collector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'application_switch',
        data: {
          fromApp: 'Safari',
          toApp: 'VS Code',
          fromWindowId: 1,
          toWindowId: 2,
          timestamp: Date.now()
        }
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message)

      expect(processSpy).toHaveBeenCalled()
      const processedEvents = processSpy.mock.calls[0][0]
      expect(processedEvents).toHaveLength(1)
      
      const event = processedEvents[0] as SystemAppEvent
      expect(event.type).toBe(EventType.SYSTEM_APP)
      expect(event.action).toBe('switch')
      expect(event.metadata.fromApp).toBe('Safari')
      expect(event.metadata.toApp).toBe('VS Code')
    })

    it('should handle window geometry events', async () => {
      await collector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'window_geometry',
        data: {
          appName: 'VS Code',
          windowId: 1,
          x: 100,
          y: 100,
          width: 1200,
          height: 800,
          isFullscreen: false,
          isMinimized: false,
          timestamp: Date.now()
        }
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message)

      expect(processSpy).toHaveBeenCalled()
      const processedEvents = processSpy.mock.calls[0][0]
      const event = processedEvents[0] as SystemAppEvent
      
      expect(event.metadata.windowGeometry).toEqual({
        x: 100,
        y: 100,
        width: 1200,
        height: 800
      })
      expect(event.metadata.isFullscreen).toBe(false)
    })

    it('should handle file operation events', async () => {
      const fileCollector = new SystemCollector({
        name: 'file-collector',
        enabled: true,
        captureFileOperations: true
      })

      await fileCollector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'file_operation',
        data: {
          operation: 'open',
          filePath: '/Users/test/Documents/report.pdf',
          appName: 'Preview',
          fileSize: 1024000,
          fileType: 'application/pdf',
          timestamp: Date.now()
        }
      }

      const processSpy = vi.spyOn(fileCollector, 'processEvents' as any)
      
      await messageListener(message)

      expect(processSpy).toHaveBeenCalled()
      const processedEvents = processSpy.mock.calls[0][0]
      const event = processedEvents[0] as SystemAppEvent
      
      expect(event.metadata.fileOperation).toEqual({
        operation: 'open',
        filePath: '/Users/test/Documents/report.pdf',
        fileSize: 1024000,
        fileType: 'application/pdf'
      })
    })

    it('should handle invalid native messages', async () => {
      await collector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const invalidMessage = { type: 'invalid_type' }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      await messageListener(invalidMessage)

      expect(processSpy).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unknown native message type: invalid_type'
      )
    })
  })

  describe('Application Filtering', () => {
    it('should filter events by include list', async () => {
      const filteredCollector = new SystemCollector({
        name: 'filtered-collector',
        enabled: true,
        applicationFilters: {
          enabled: true,
          includeList: ['VS Code', 'Chrome']
        }
      })

      await filteredCollector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const processSpy = vi.spyOn(filteredCollector, 'processEvents' as any)

      // Test included application
      const includedMessage = {
        type: 'application_focus',
        data: { appName: 'VS Code', timestamp: Date.now() }
      }
      
      await messageListener(includedMessage)
      expect(processSpy).toHaveBeenCalledTimes(1)

      // Test excluded application
      processSpy.mockClear()
      const excludedMessage = {
        type: 'application_focus',
        data: { appName: 'Safari', timestamp: Date.now() }
      }
      
      await messageListener(excludedMessage)
      expect(processSpy).not.toHaveBeenCalled()
    })

    it('should filter events by exclude list', async () => {
      const excludeCollector = new SystemCollector({
        name: 'exclude-collector',
        enabled: true,
        applicationFilters: {
          enabled: true,
          excludeList: ['System Preferences', 'Activity Monitor']
        }
      })

      await excludeCollector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const processSpy = vi.spyOn(excludeCollector, 'processEvents' as any)

      // Test allowed application
      const allowedMessage = {
        type: 'application_focus',
        data: { appName: 'VS Code', timestamp: Date.now() }
      }
      
      await messageListener(allowedMessage)
      expect(processSpy).toHaveBeenCalledTimes(1)

      // Test excluded application
      processSpy.mockClear()
      const excludedMessage = {
        type: 'application_focus',
        data: { appName: 'System Preferences', timestamp: Date.now() }
      }
      
      await messageListener(excludedMessage)
      expect(processSpy).not.toHaveBeenCalled()
    })

    it('should allow all applications when filtering is disabled', async () => {
      const unfilteredCollector = new SystemCollector({
        name: 'unfiltered-collector',
        enabled: true,
        applicationFilters: {
          enabled: false
        }
      })

      await unfilteredCollector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const processSpy = vi.spyOn(unfilteredCollector, 'processEvents' as any)

      const messages = [
        { type: 'application_focus', data: { appName: 'VS Code', timestamp: Date.now() } },
        { type: 'application_focus', data: { appName: 'System Preferences', timestamp: Date.now() } },
        { type: 'application_focus', data: { appName: 'Activity Monitor', timestamp: Date.now() } }
      ]

      for (const message of messages) {
        await messageListener(message)
      }

      expect(processSpy).toHaveBeenCalledTimes(3)
    })
  })

  describe('Native Connection Management', () => {
    it('should handle native disconnection gracefully', async () => {
      await collector.start()

      const disconnectListener = mockNativePort.onDisconnect.addListener.mock.calls[0][0]
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      await disconnectListener()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Native host disconnected, attempting to reconnect...'
      )
      expect(collector.isRunning()).toBe(false)
    })

    it('should attempt reconnection on disconnect', async () => {
      let connectCallCount = 0
      global.chrome.runtime.connectNative.mockImplementation(() => {
        connectCallCount++
        if (connectCallCount === 1) {
          // First connection succeeds
          return mockNativePort
        } else {
          // Subsequent connections fail
          throw new Error('Reconnection failed')
        }
      })

      await collector.start()

      // Simulate disconnection
      const disconnectListener = mockNativePort.onDisconnect.addListener.mock.calls[0][0]
      await disconnectListener()

      expect(connectCallCount).toBe(2) // Initial + reconnection attempt
    })

    it('should limit reconnection attempts', async () => {
      global.chrome.runtime.connectNative.mockImplementation(() => {
        throw new Error('Always fails')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await collector.start()

      // Simulate multiple disconnections
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(60000) // Wait for retry interval
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Max reconnection attempts reached, stopping system collector'
      )
    })
  })

  describe('Event Enrichment', () => {
    it('should enrich system events with performance data', async () => {
      await collector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'application_focus',
        data: {
          appName: 'VS Code',
          processId: 12345,
          memoryUsage: 256 * 1024 * 1024, // 256MB
          cpuUsage: 15.5,
          diskUsage: 1024 * 1024 * 1024, // 1GB
          networkUsage: 1024 * 1024, // 1MB
          timestamp: Date.now()
        }
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message)

      const processedEvents = processSpy.mock.calls[0][0]
      const event = processedEvents[0] as SystemAppEvent

      expect(event.metadata).toEqual(expect.objectContaining({
        processId: 12345,
        memoryUsage: 256 * 1024 * 1024,
        cpuUsage: 15.5,
        diskUsage: 1024 * 1024 * 1024,
        networkUsage: 1024 * 1024
      }))
    })

    it('should extract application categories', async () => {
      await collector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'application_focus',
        data: {
          appName: 'Google Chrome',
          bundleId: 'com.google.Chrome',
          category: 'web-browser',
          timestamp: Date.now()
        }
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message)

      const processedEvents = processSpy.mock.calls[0][0]
      const event = processedEvents[0] as SystemAppEvent

      expect(event.metadata.category).toBe('web-browser')
    })

    it('should handle system state information', async () => {
      await collector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'system_state',
        data: {
          systemUptime: 86400, // 24 hours
          cpuUsage: 25.5,
          memoryUsage: 8 * 1024 * 1024 * 1024, // 8GB
          diskUsage: 256 * 1024 * 1024 * 1024, // 256GB
          batteryLevel: 85,
          isCharging: true,
          timestamp: Date.now()
        }
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message)

      const processedEvents = processSpy.mock.calls[0][0]
      const event = processedEvents[0] as SystemAppEvent

      expect(event.metadata.systemState).toEqual(expect.objectContaining({
        systemUptime: 86400,
        cpuUsage: 25.5,
        memoryUsage: 8 * 1024 * 1024 * 1024,
        batteryLevel: 85,
        isCharging: true
      }))
    })
  })

  describe('Fallback Monitoring', () => {
    it('should use window focus events when native host unavailable', async () => {
      delete (global as any).chrome

      const fallbackCollector = new SystemCollector({
        name: 'fallback-collector',
        enabled: true,
        enableNativeMonitoring: false
      })

      // Mock window focus events
      const mockAddEventListener = vi.fn()
      global.window = { addEventListener: mockAddEventListener } as any

      await fallbackCollector.start()

      expect(fallbackCollector.isRunning()).toBe(true)
      expect(mockAddEventListener).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(mockAddEventListener).toHaveBeenCalledWith('blur', expect.any(Function))
    })

    it('should handle window focus events in fallback mode', async () => {
      delete (global as any).chrome

      const fallbackCollector = new SystemCollector({
        name: 'fallback-collector',
        enabled: true,
        enableNativeMonitoring: false
      })

      let focusHandler: any
      global.window = {
        addEventListener: vi.fn((event, handler) => {
          if (event === 'focus') focusHandler = handler
        })
      } as any

      await fallbackCollector.start()

      const processSpy = vi.spyOn(fallbackCollector, 'processEvents' as any)
      
      // Simulate window focus event
      const focusEvent = new Event('focus')
      if (focusHandler) {
        await focusHandler(focusEvent)
      }

      expect(processSpy).toHaveBeenCalled()
    })
  })

  describe('Performance Metrics', () => {
    it('should track system-specific metrics', async () => {
      await collector.start()

      // Simulate some events
      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const messages = [
        { type: 'application_focus', data: { appName: 'VS Code', timestamp: Date.now() } },
        { type: 'application_switch', data: { fromApp: 'Safari', toApp: 'Chrome', timestamp: Date.now() } }
      ]

      for (const message of messages) {
        await messageListener(message)
      }

      const metrics = collector.getMetrics()
      
      expect(metrics).toHaveProperty('nativeMessageCount')
      expect(metrics).toHaveProperty('applicationEvents')
      expect(metrics).toHaveProperty('systemEvents')
      expect(metrics.nativeMessageCount).toBe(2)
      expect(metrics.applicationEvents).toBeGreaterThan(0)
    })

    it('should track connection health metrics', async () => {
      await collector.start()

      const metrics = collector.getMetrics()
      
      expect(metrics).toHaveProperty('connectionAttempts')
      expect(metrics).toHaveProperty('lastConnectionTime')
      expect(metrics.connectionAttempts).toBe(1)
      expect(metrics.lastConnectionTime).toBeInstanceOf(Number)
    })
  })

  describe('Privacy and Security', () => {
    it('should filter sensitive file paths', async () => {
      const privateCollector = new SystemCollector({
        name: 'private-collector',
        enabled: true,
        captureFileOperations: true,
        filters: {
          enabled: true,
          sensitivePaths: [
            '/Users/~/Library',
            '/private/var',
            '/System'
          ]
        }
      })

      await privateCollector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const processSpy = vi.spyOn(privateCollector, 'processEvents' as any)

      // Test sensitive file path
      const sensitiveMessage = {
        type: 'file_operation',
        data: {
          operation: 'open',
          filePath: '/Users/test/Library/Preferences/com.apple.Safari.plist',
          timestamp: Date.now()
        }
      }
      
      await messageListener(sensitiveMessage)
      expect(processSpy).not.toHaveBeenCalled()

      // Test safe file path
      processSpy.mockClear()
      const safeMessage = {
        type: 'file_operation',
        data: {
          operation: 'open',
          filePath: '/Users/test/Documents/report.pdf',
          timestamp: Date.now()
        }
      }
      
      await messageListener(safeMessage)
      expect(processSpy).toHaveBeenCalledTimes(1)
    })

    it('should anonymize potentially sensitive application data', async () => {
      await collector.start()

      const messageListener = mockNativePort.onMessage.addListener.mock.calls[0][0]
      const message = {
        type: 'application_focus',
        data: {
          appName: 'Password Manager',
          windowTitle: 'My Passwords - Password Manager',
          timestamp: Date.now()
        }
      }

      const processSpy = vi.spyOn(collector, 'processEvents' as any)
      
      await messageListener(message)

      const processedEvents = processSpy.mock.calls[0][0]
      const event = processedEvents[0] as SystemAppEvent

      // Should anonymize sensitive window titles
      expect(event.windowTitle).not.toContain('Passwords')
      expect(event.windowTitle).toBe('[REDACTED] - Password Manager')
    })
  })
})