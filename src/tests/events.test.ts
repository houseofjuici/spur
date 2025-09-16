import { describe, it, expect } from 'vitest'
import {
  EventType,
  BaseEvent,
  BrowserTabEvent,
  SystemAppEvent,
  createEventId,
  validateEvent,
  calculateQualityScore,
  isPII
} from '@types/events'

describe('Event Types and Utilities', () => {
  describe('Event Type Validation', () => {
    it('should validate event types correctly', () => {
      expect(EventType.BROWSER_TAB).toBe('browser_tab')
      expect(EventType.SYSTEM_APP).toBe('system_app')
      expect(EventType.EMAIL).toBe('email')
      expect(EventType.CODE).toBe('code')
      expect(EventType.GITHUB).toBe('github')
      expect(EventType.YOUTUBE).toBe('youtube')
      expect(EventType.SLACK).toBe('slack')
      expect(EventType.VSCODE).toBe('vscode')
      expect(EventType.CUSTOM).toBe('custom')
    })

    it('should create unique event IDs', () => {
      const id1 = createEventId()
      const id2 = createEventId()
      
      expect(id1).toMatch(/^evt_[a-f0-9-]{36}$/)
      expect(id2).toMatch(/^evt_[a-f0-9-]{36}$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('Event Validation', () => {
    it('should validate valid events', () => {
      const validEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now(),
        metadata: {
          referrer: 'https://google.com',
          transitionType: 'link'
        },
        quality: {
          completeness: 1.0,
          accuracy: 0.95,
          relevance: 0.9
        }
      }

      expect(validateEvent(validEvent)).toBe(true)
    })

    it('should reject invalid events', () => {
      const invalidEvent = {
        id: 'invalid-id',
        type: 'invalid_type',
        timestamp: 'not-a-number'
      } as any

      expect(validateEvent(invalidEvent)).toBe(false)
    })

    it('should require required fields', () => {
      const incompleteEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB
        // Missing required fields
      } as any

      expect(validateEvent(incompleteEvent)).toBe(false)
    })
  })

  describe('Quality Score Calculation', () => {
    it('should calculate quality scores correctly', () => {
      const event: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session'
      }

      const score = calculateQualityScore(event)
      
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
      expect(typeof score).toBe('number')
    })

    it('should handle events with existing quality scores', () => {
      const event: BaseEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'test',
        sessionId: 'test-session',
        quality: {
          completeness: 0.8,
          accuracy: 0.9,
          relevance: 0.85
        }
      }

      const score = calculateQualityScore(event)
      expect(score).toBeCloseTo(0.85, 2) // Average of quality metrics
    })
  })

  describe('PII Detection', () => {
    it('should detect email addresses', () => {
      expect(isPII('user@example.com')).toBe(true)
      expect(isPII('john.doe+test@company.co.uk')).toBe(true)
    })

    it('should detect phone numbers', () => {
      expect(isPII('+1 (555) 123-4567')).toBe(true)
      expect(isPII('555-123-4567')).toBe(true)
    })

    it('should detect social security numbers', () => {
      expect(isPII('123-45-6789')).toBe(true)
      expect(isPII('123 45 6789')).toBe(true)
    })

    it('should not detect false positives', () => {
      expect(isPII('regular text')).toBe(false)
      expect(isPII('123-456')).toBe(false) // Not a complete SSN
      expect(isPII('example.com')).toBe(false) // Not a full email
    })
  })

  describe('Event Creation', () => {
    it('should create events with proper structure', () => {
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
        timestampCaptured: Date.now(),
        metadata: {
          referrer: 'https://google.com'
        }
      }

      expect(event.id).toMatch(/^evt_[a-f0-9-]{36}$/)
      expect(event.type).toBe(EventType.BROWSER_TAB)
      expect(event.timestamp).toBeInstanceOf(Number)
      expect(event.timestamp).toBeGreaterThan(0)
      expect(event.source).toBe('chrome-extension')
      expect(event.sessionId).toBe('test-session')
    })
  })

  describe('Event Metadata Handling', () => {
    it('should handle complex metadata structures', () => {
      const event: SystemAppEvent = {
        id: createEventId(),
        type: EventType.SYSTEM_APP,
        timestamp: Date.now(),
        source: 'system-monitor',
        sessionId: 'test-session',
        appName: 'VS Code',
        appPath: '/Applications/Visual Studio Code.app',
        action: 'focus',
        windowTitle: 'spur/src/capture - Visual Studio Code',
        timestampCaptured: Date.now(),
        metadata: {
          processId: 12345,
          memoryUsage: 256 * 1024 * 1024, // 256MB
          cpuUsage: 15.5,
          windowGeometry: {
            x: 100,
            y: 100,
            width: 1200,
            height: 800
          },
          isFullscreen: false,
          isMinimized: false
        },
        quality: {
          completeness: 1.0,
          accuracy: 0.95,
          relevance: 0.9
        }
      }

      expect(event.metadata.processId).toBe(12345)
      expect(event.metadata.windowGeometry.width).toBe(1200)
      expect(event.metadata.isFullscreen).toBe(false)
    })
  })
})