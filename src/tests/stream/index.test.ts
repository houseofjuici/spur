import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RealTimeStream } from '@capture/stream/index'
import { EventType, createEventId, type BaseEvent, type BrowserTabEvent } from '@types/events'

describe('RealTimeStream', () => {
  let stream: RealTimeStream
  let mockAssistantService: any
  let mockContextManager: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock assistant service
    mockAssistantService = {
      sendContext: vi.fn(),
      requestInsights: vi.fn(),
      updateContext: vi.fn()
    }

    // Mock context manager
    mockContextManager = {
      addEvent: vi.fn(),
      getContext: vi.fn(),
      searchRelevant: vi.fn(),
      clearContext: vi.fn()
    }

    stream = new RealTimeStream({
      enabled: true,
      bufferSize: 100,
      flushInterval: 5000,
      maxAge: 3600000, // 1 hour
      enableInsights: true,
      enablePatternDetection: true,
      enableWorkflowUnderstanding: true,
      assistantService: mockAssistantService,
      contextManager: mockContextManager
    })
  })

  afterEach(() => {
    if (stream.isActive()) {
      stream.stop()
    }
  })

  describe('Initialization', () => {
    it('should initialize stream with configuration', async () => {
      await stream.start()

      expect(stream.isActive()).toBe(true)
      expect(stream['intervalId']).toBeDefined()
    })

    it('should handle initialization errors gracefully', async () => {
      const faultyStream = new RealTimeStream({
        enabled: true,
        assistantService: null // Invalid service
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(faultyStream.start()).rejects.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize real-time stream:',
        expect.any(Error)
      )
    })

    it('should not start when disabled', async () => {
      const disabledStream = new RealTimeStream({
        enabled: false,
        assistantService: mockAssistantService,
        contextManager: mockContextManager
      })

      await disabledStream.start()

      expect(disabledStream.isActive()).toBe(false)
    })
  })

  describe('Event Processing', () => {
    it('should add events to buffer and trigger processing', async () => {
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

      const processSpy = vi.spyOn(stream, 'processEvents' as any)

      await stream.start()
      await stream.addEvent(event)

      expect(processSpy).toHaveBeenCalled()
      expect(stream['buffer'].size).toBeGreaterThan(0)
    })

    it('should process multiple events in batch', async () => {
      const events: BrowserTabEvent[] = Array.from({ length: 5 }, (_, i) => ({
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

      const processSpy = vi.spyOn(stream, 'processEvents' as any)

      await stream.start()

      // Add all events
      for (const event of events) {
        await stream.addEvent(event)
      }

      expect(processSpy).toHaveBeenCalled()
      expect(stream['buffer'].size).toBe(5)
    })

    it('should respect buffer size limits', async () => {
      const limitedStream = new RealTimeStream({
        enabled: true,
        bufferSize: 3,
        assistantService: mockAssistantService,
        contextManager: mockContextManager
      })

      const events: BrowserTabEvent[] = Array.from({ length: 5 }, (_, i) => ({
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

      await limitedStream.start()

      // Add events that exceed buffer size
      for (const event of events) {
        await limitedStream.addEvent(event)
      }

      expect(limitedStream['buffer'].size).toBe(3) // Should be limited
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

      vi.spyOn(stream, 'processEvents' as any).mockRejectedValue(new Error('Processing failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await stream.start()
      await stream.addEvent(event)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error processing events in real-time stream:',
        expect.any(Error)
      )
      expect(stream.isActive()).toBe(true) // Should continue running
    })
  })

  describe('Context Management', () => {
    it('should update context manager with events', async () => {
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

      await stream.start()
      await stream.addEvent(event)

      expect(mockContextManager.addEvent).toHaveBeenCalledWith(event)
    })

    it('should search for relevant context', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://github.com/user/repo',
        title: 'spur/super-app',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      mockContextManager.searchRelevant.mockResolvedValue([
        {
          id: createEventId(),
          type: EventType.CODE,
          timestamp: Date.now() - 3600000,
          content: 'Working on spur super app development',
          relevance: 0.9
        }
      ])

      await stream.start()
      await stream.addEvent(event)

      expect(mockContextManager.searchRelevant).toHaveBeenCalledWith(
        event,
        expect.objectContaining({ maxResults: 10, timeWindow: 3600000 })
      )
    })

    it('should handle context manager errors', async () => {
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

      mockContextManager.addEvent.mockRejectedValue(new Error('Context manager failed'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await stream.start()
      await stream.addEvent(event)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error updating context:',
        expect.any(Error)
      )
    })
  })

  describe('Assistant Integration', () => {
    it('should send context to assistant service', async () => {
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

      mockContextManager.getContext.mockResolvedValue({
        currentContext: 'User is browsing example.com',
        relevantEvents: [event],
        sessionInfo: { sessionId: 'test-session', startTime: Date.now() }
      })

      await stream.start()
      await stream.addEvent(event)

      expect(mockContextManager.getContext).toHaveBeenCalled()
      expect(mockAssistantService.sendContext).toHaveBeenCalledWith(
        expect.objectContaining({
          currentContext: 'User is browsing example.com',
          relevantEvents: [event]
        })
      )
    })

    it('should request insights from assistant', async () => {
      const insightsStream = new RealTimeStream({
        enabled: true,
        enableInsights: true,
        assistantService: mockAssistantService,
        contextManager: mockContextManager
      })

      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://github.com/user/repo',
        title: 'bug-fix/issue-123',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      mockAssistantService.requestInsights.mockResolvedValue({
        insights: [
          {
            type: 'pattern',
            description: 'User is working on bug fixes',
            confidence: 0.85
          }
        ]
      })

      await insightsStream.start()
      await insightsStream.addEvent(event)

      expect(mockAssistantService.requestInsights).toHaveBeenCalledWith(
        expect.objectContaining({
          currentEvent: event,
          context: expect.any(Object)
        })
      )
    })

    it('should handle assistant service errors gracefully', async () => {
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

      mockAssistantService.sendContext.mockRejectedValue(new Error('Assistant unavailable'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await stream.start()
      await stream.addEvent(event)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error sending context to assistant:',
        expect.any(Error)
      )
    })
  })

  describe('Pattern Detection', () => {
    it('should detect patterns in event sequences', async () => {
      const patternStream = new RealTimeStream({
        enabled: true,
        enablePatternDetection: true,
        assistantService: mockAssistantService,
        contextManager: mockContextManager
      })

      const events = [
        {
          id: createEventId(),
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'chrome-extension',
          sessionId: 'test-session',
          tabId: 1,
          url: 'https://github.com/user/repo/issues',
          title: 'Issues',
          action: 'navigation',
          timestampCaptured: Date.now()
        },
        {
          id: createEventId(),
          type: EventType.GITHUB,
          timestamp: Date.now() + 5000,
          source: 'chrome-extension',
          sessionId: 'test-session',
          action: 'issue_commented',
          repository: 'user/repo',
          issueNumber: 123,
          timestampCaptured: Date.now() + 5000
        }
      ]

      await patternStream.start()

      // Add events to create a pattern
      for (const event of events) {
        await patternStream.addEvent(event)
      }

      const patterns = patternStream['detectedPatterns']
      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns[0].type).toBe('github_issue_workflow')
    })

    it('should detect workflow transitions', async () => {
      const workflowStream = new RealTimeStream({
        enabled: true,
        enableWorkflowUnderstanding: true,
        assistantService: mockAssistantService,
        contextManager: mockContextManager
      })

      const events = [
        {
          id: createEventId(),
          type: EventType.SYSTEM_APP,
          timestamp: Date.now(),
          source: 'system-monitor',
          sessionId: 'test-session',
          appName: 'VS Code',
          action: 'focus',
          windowTitle: 'spur/src/capture - Visual Studio Code',
          timestampCaptured: Date.now()
        },
        {
          id: createEventId(),
          type: EventType.CODE,
          timestamp: Date.now() + 30000,
          source: 'vscode-extension',
          sessionId: 'test-session',
          action: 'file_saved',
          filePath: '/Users/test/spur/src/capture/engine/unified.ts',
          timestampCaptured: Date.now() + 30000
        }
      ]

      await workflowStream.start()

      // Add events to create workflow
      for (const event of events) {
        await workflowStream.addEvent(event)
      }

      const workflows = workflowStream['activeWorkflows']
      expect(workflows.length).toBeGreaterThan(0)
      expect(workflows[0].type).toBe('development')
    })

    it('should update existing patterns', async () => {
      await stream.start()

      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://stackoverflow.com/questions',
        title: 'Stack Overflow',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      // Add same type of event multiple times
      for (let i = 0; i < 3; i++) {
        await stream.addEvent({
          ...event,
          id: createEventId(),
          timestamp: Date.now() + i * 60000
        })
      }

      const patterns = stream['detectedPatterns']
      const researchPattern = patterns.find(p => p.type === 'research_pattern')
      
      expect(researchPattern).toBeDefined()
      expect(researchPattern.frequency).toBe(3)
      expect(researchPattern.confidence).toBeGreaterThan(0.7)
    })
  })

  describe('Insight Generation', () => {
    it('should generate contextual insights', async () => {
      const insightStream = new RealTimeStream({
        enabled: true,
        enableInsights: true,
        assistantService: mockAssistantService,
        contextManager: mockContextManager
      })

      mockAssistantService.requestInsights.mockResolvedValue({
        insights: [
          {
            type: 'contextual',
            description: 'User is researching for a project',
            confidence: 0.8,
            suggestions: ['Consider saving these resources', 'Related documentation available']
          }
        ]
      })

      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com/documentation',
        title: 'Documentation',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      await insightStream.start()
      await insightStream.addEvent(event)

      const insights = insightStream['recentInsights']
      expect(insights.length).toBeGreaterThan(0)
      expect(insights[0].type).toBe('contextual')
      expect(insights[0].description).toBe('User is researching for a project')
    })

    it('should generate workflow insights', async () => {
      const workflowInsightStream = new RealTimeStream({
        enabled: true,
        enableInsights: true,
        enableWorkflowUnderstanding: true,
        assistantService: mockAssistantService,
        contextManager: mockContextManager
      })

      mockAssistantService.requestInsights.mockResolvedValue({
        insights: [
          {
            type: 'workflow',
            description: 'User is in a development workflow',
            confidence: 0.9,
            workflowStep: 'implementation',
            nextSteps: ['Test the changes', 'Commit to repository']
          }
        ]
      })

      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://github.com/user/repo/pull/123',
        title: 'PR: Feature Implementation',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      await workflowInsightStream.start()
      await workflowInsightStream.addEvent(event)

      const insights = workflowInsightStream['recentInsights']
      const workflowInsight = insights.find(i => i.type === 'workflow')
      
      expect(workflowInsight).toBeDefined()
      expect(workflowInsight.nextSteps).toContain('Test the changes')
    })
  })

  describe('Buffer Management', () => {
    it('should flush buffer on interval', async () => {
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

      await stream.start()
      await stream.addEvent(event)

      expect(stream['buffer'].size).toBe(1)

      // Fast-forward to trigger flush interval
      vi.advanceTimersByTime(6000)

      expect(stream['buffer'].size).toBe(0) // Should be flushed
    })

    it('should handle buffer flush errors gracefully', async () => {
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

      vi.spyOn(stream, 'flushBuffer' as any).mockRejectedValue(new Error('Flush failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await stream.start()
      await stream.addEvent(event)

      // Fast-forward to trigger flush
      vi.advanceTimersByTime(6000)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error flushing buffer:',
        expect.any(Error)
      )
    })

    it('should clear old events from buffer', async () => {
      const oldEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() - 3700000, // Older than maxAge
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com/old',
        title: 'Old Page',
        action: 'navigation',
        timestampCaptured: Date.now() - 3700000
      }

      const newEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 2,
        url: 'https://example.com/new',
        title: 'New Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      await stream.start()
      await stream.addEvent(oldEvent)
      await stream.addEvent(newEvent)

      // Trigger cleanup
      await stream['cleanupOldEvents']()

      expect(stream['buffer'].size).toBe(1) // Only new event should remain
    })
  })

  describe('Lifecycle Management', () => {
    it('should start and stop gracefully', async () => {
      await stream.start()
      expect(stream.isActive()).toBe(true)

      await stream.stop()
      expect(stream.isActive()).toBe(false)
      expect(stream['intervalId']).toBeNull()
    })

    it('should clear resources on stop', async () => {
      await stream.start()
      await stream.addEvent({
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
      })

      expect(stream['buffer'].size).toBe(1)

      await stream.stop()

      expect(stream['buffer'].size).toBe(0) // Buffer should be cleared
    })

    it('should handle stop when not running', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await stream.stop()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Real-time stream is not running'
      )
    })
  })

  describe('Metrics and Monitoring', () => {
    it('should track stream metrics', async () => {
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

      await stream.start()
      await stream.addEvent(event)

      const metrics = stream.getMetrics()
      
      expect(metrics).toHaveProperty('eventsProcessed')
      expect(metrics).toHaveProperty('bufferSize')
      expect(metrics).toHaveProperty('patternsDetected')
      expect(metrics).toHaveProperty('insightsGenerated')
      expect(metrics.eventsProcessed).toBe(1)
      expect(metrics.bufferSize).toBe(1)
    })

    it('should track assistant integration metrics', async () => {
      mockAssistantService.requestInsights.mockResolvedValue({
        insights: [{ type: 'test', description: 'Test insight' }]
      })

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

      await stream.start()
      await stream.addEvent(event)

      const metrics = stream.getMetrics()
      
      expect(metrics).toHaveProperty('assistantCalls')
      expect(metrics).toHaveProperty('insightSuccessRate')
      expect(metrics.assistantCalls).toBeGreaterThan(0)
    })

    it('should reset metrics correctly', async () => {
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

      await stream.start()
      await stream.addEvent(event)

      const beforeReset = stream.getMetrics()
      expect(beforeReset.eventsProcessed).toBe(1)

      stream.resetMetrics()
      
      const afterReset = stream.getMetrics()
      expect(afterReset.eventsProcessed).toBe(0)
      expect(afterReset.bufferSize).toBe(0)
    })
  })
})