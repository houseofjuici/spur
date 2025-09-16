import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventNormalizer } from '@capture/normalizer/index'
import { EventType, createEventId, type BaseEvent, type BrowserTabEvent } from '@types/events'

describe('EventNormalizer', () => {
  let normalizer: EventNormalizer
  let mockPIIDetector: any
  let mockEntityExtractor: any
  let mockSentimentAnalyzer: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock external services
    mockPIIDetector = {
      detect: vi.fn((text: string) => {
        return text.includes('email') || text.includes('phone') || text.includes('ssn')
      }),
      redact: vi.fn((text: string) => {
        return text.replace(/email@domain\.com/g, '[REDACTED]')
      })
    }

    mockEntityExtractor = {
      extract: vi.fn((text: string) => {
        if (text.includes('Spur')) {
          return [
            { type: 'ORGANIZATION', text: 'Spur', confidence: 0.9 },
            { type: 'PRODUCT', text: 'Super App', confidence: 0.8 }
          ]
        }
        return []
      })
    }

    mockSentimentAnalyzer = {
      analyze: vi.fn((text: string) => {
        if (text.includes('good') || text.includes('excellent')) {
          return { score: 0.8, magnitude: 0.6, label: 'positive' }
        } else if (text.includes('bad') || text.includes('terrible')) {
          return { score: -0.7, magnitude: 0.8, label: 'negative' }
        }
        return { score: 0.1, magnitude: 0.2, label: 'neutral' }
      })
    }

    normalizer = new EventNormalizer({
      enabled: true,
      validation: {
        enabled: true,
        strictMode: true,
        requiredFields: ['id', 'type', 'timestamp', 'source', 'sessionId']
      },
      enrichment: {
        enabled: true,
        extractEntities: true,
        analyzeSentiment: true,
        categorizeContent: true,
        generateTags: true
      },
      privacy: {
        enabled: true,
        detectPII: true,
        redactSensitiveData: true,
        anonymizeFields: ['windowTitle', 'title', 'content']
      },
      quality: {
        enabled: true,
        calculateScores: true,
        qualityThreshold: 0.5
      },
      caching: {
        enabled: true,
        maxSize: 1000,
        ttl: 300000 // 5 minutes
      }
    })

    // Inject mocks
    normalizer['piiDetector'] = mockPIIDetector
    normalizer['entityExtractor'] = mockEntityExtractor
    normalizer['sentimentAnalyzer'] = mockSentimentAnalyzer
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
        timestampCaptured: Date.now()
      }

      const result = normalizer['validateEvent'](validEvent)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject events with missing required fields', () => {
      const invalidEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB
        // Missing required fields
      } as any

      const result = normalizer['validateEvent'](invalidEvent)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors).toContain('Missing required field: timestamp')
    })

    it('should reject events with invalid data types', () => {
      const invalidEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: 'not-a-number', // Invalid type
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const result = normalizer['validateEvent'](invalidEvent)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid timestamp: not a number')
    })

    it('should validate event-specific fields', () => {
      const invalidEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: -1, // Invalid tab ID
        url: 'invalid-url', // Invalid URL
        title: 'Test Page',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const result = normalizer['validateEvent'](invalidEvent)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid tabId: must be positive')
      expect(result.errors).toContain('Invalid URL format: invalid-url')
    })
  })

  describe('Event Enrichment', () => {
    it('should extract entities from event content', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Spur Super App Review',
        action: 'navigation',
        timestampCaptured: Date.now(),
        metadata: {
          content: 'The Spur Super App is excellent for productivity!'
        }
      }

      const enriched = await normalizer['enrichEvent'](event)

      expect(mockEntityExtractor.extract).toHaveBeenCalledWith('The Spur Super App is excellent for productivity!')
      expect(mockSentimentAnalyzer.analyze).toHaveBeenCalledWith('The Spur Super App is excellent for productivity!')
      
      expect(enriched.enrichment.entities).toEqual([
        { type: 'ORGANIZATION', text: 'Spur', confidence: 0.9 },
        { type: 'PRODUCT', text: 'Super App', confidence: 0.8 }
      ])
      expect(enriched.enrichment.sentiment).toEqual({
        score: 0.8,
        magnitude: 0.6,
        label: 'positive'
      })
    })

    it('should categorize content automatically', async () => {
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

      const enriched = await normalizer['enrichEvent'](event)

      expect(enriched.enrichment.category).toBe('development')
      expect(enriched.enrichment.tags).toContain('github')
      expect(enriched.enrichment.tags).toContain('repository')
    })

    it('should generate relevant tags based on content', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com/article',
        title: 'Machine Learning Tutorial',
        action: 'navigation',
        timestampCaptured: Date.now(),
        metadata: {
          content: 'Learn about neural networks and deep learning algorithms'
        }
      }

      const enriched = await normalizer['enrichEvent'](event)

      expect(enriched.enrichment.tags).toContain('tutorial')
      expect(enriched.enrichment.tags).toContain('machine-learning')
      expect(enriched.enrichment.tags).toContain('neural-networks')
    })

    it('should handle enrichment errors gracefully', async () => {
      mockEntityExtractor.extract.mockRejectedValue(new Error('Extraction failed'))

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
          content: 'Test content'
        }
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const enriched = await normalizer['enrichEvent'](event)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error enriching event:',
        expect.any(Error)
      )
      expect(enriched.enrichment).toBeDefined()
      expect(enriched.enrichment.entities).toEqual([])
    })
  })

  describe('Privacy Protection', () => {
    it('should detect PII in event data', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Contact: email@domain.com',
        action: 'navigation',
        timestampCaptured: Date.now(),
        metadata: {
          content: 'Call me at 555-123-4567 for more info'
        }
      }

      const processed = await normalizer['applyPrivacyProtection'](event)

      expect(mockPIIDetector.detect).toHaveBeenCalledWith('Contact: email@domain.com')
      expect(mockPIIDetector.detect).toHaveBeenCalledWith('Call me at 555-123-4567 for more info')
      
      expect(processed.privacy.hasPII).toBe(true)
      expect(processed.privacy.piiDetected).toEqual(['email', 'phone'])
    })

    it('should redact sensitive data', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'User email@domain.com profile',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const processed = await normalizer['applyPrivacyProtection'](event)

      expect(mockPIIDetector.redact).toHaveBeenCalledWith('User email@domain.com profile')
      expect(processed.title).toBe('User [REDACTED] profile')
    })

    it('should anonymize specified fields', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Personal Document',
        windowTitle: 'John Smith - Tax Return 2023',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const processed = await normalizer['applyPrivacyProtection'](event)

      expect(processed.windowTitle).toBe('[USER] - [DOCUMENT] [YEAR]')
    })

    it('should preserve non-sensitive data', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Public Article',
        action: 'navigation',
        timestampCaptured: Date.now(),
        metadata: {
          content: 'This is a public article with no sensitive information'
        }
      }

      const processed = await normalizer['applyPrivacyProtection'](event)

      expect(processed.title).toBe('Public Article')
      expect(processed.metadata.content).toBe('This is a public article with no sensitive information')
      expect(processed.privacy.hasPII).toBe(false)
    })
  })

  describe('Quality Scoring', () => {
    it('should calculate quality scores for events', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Complete Page Title',
        action: 'navigation',
        timestampCaptured: Date.now(),
        metadata: {
          content: 'Detailed content with comprehensive information',
          referrer: 'https://google.com',
          transitionType: 'link'
        }
      }

      const scored = await normalizer['calculateQualityScore'](event)

      expect(scored.quality).toBeDefined()
      expect(scored.quality.completeness).toBeGreaterThan(0.8)
      expect(scored.quality.accuracy).toBeGreaterThan(0.8)
      expect(scored.quality.relevance).toBeGreaterThan(0.5)
      expect(scored.quality.overall).toBeGreaterThan(0.7)
    })

    it('should penalize incomplete events', async () => {
      const incompleteEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: '', // Empty title
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      const scored = await normalizer['calculateQualityScore'](incompleteEvent)

      expect(scored.quality.completeness).toBeLessThan(0.8)
      expect(scored.quality.overall).toBeLessThan(0.7)
    })

    it('should filter events below quality threshold', async () => {
      const lowQualityEvent: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://example.com',
        title: 'Low Quality',
        action: 'navigation',
        timestampCaptured: Date.now()
      }

      // Mock the quality calculation to return a low score
      vi.spyOn(normalizer, 'calculateQualityScore' as any).mockResolvedValue({
        ...lowQualityEvent,
        quality: {
          completeness: 0.2,
          accuracy: 0.3,
          relevance: 0.1,
          overall: 0.2
        }
      })

      const result = await normalizer.normalizeEvent(lowQualityEvent)
      
      expect(result).toBeNull() // Should be filtered out
    })
  })

  describe('Event Normalization Pipeline', () => {
    it('should process events through complete pipeline', async () => {
      const event: BrowserTabEvent = {
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: 1,
        url: 'https://github.com/spur/super-app',
        title: 'Spur Super App Repository',
        action: 'navigation',
        timestampCaptured: Date.now(),
        metadata: {
          content: 'Excellent code quality and good documentation',
          referrer: 'https://google.com'
        }
      }

      const result = await normalizer.normalizeEvent(event)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(event.id)
      expect(result!.type).toBe(event.type)
      expect(result!.normalized).toBe(true)
      expect(result!.enrichment.entities).toHaveLength(2)
      expect(result!.enrichment.sentiment.label).toBe('positive')
      expect(result!.enrichment.category).toBe('development')
      expect(result!.quality.overall).toBeGreaterThan(0.7)
    })

    it('should return null for invalid events', async () => {
      const invalidEvent = {
        id: 'invalid-id',
        type: 'invalid-type'
      } as any

      const result = await normalizer.normalizeEvent(invalidEvent)

      expect(result).toBeNull()
    })

    it('should handle pipeline errors gracefully', async () => {
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

      // Mock validation to throw an error
      vi.spyOn(normalizer, 'validateEvent' as any).mockImplementation(() => {
        throw new Error('Validation failed')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = await normalizer.normalizeEvent(event)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error normalizing event:',
        expect.any(Error)
      )
      expect(result).toBeNull()
    })

    it('should normalize multiple events efficiently', async () => {
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

      const results = await normalizer.normalizeEvents(events)

      expect(results).toHaveLength(10)
      expect(results.every(result => result !== null)).toBe(true)
      expect(results.every(result => result!.normalized)).toBe(true)
    })
  })

  describe('Caching', () => {
    it('should cache normalized events', async () => {
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

      // First normalization
      const result1 = await normalizer.normalizeEvent(event)
      expect(result1).not.toBeNull()

      // Second normalization should use cache
      const cacheSpy = vi.spyOn(normalizer['cache'], 'get')
      const result2 = await normalizer.normalizeEvent(event)

      expect(cacheSpy).toHaveBeenCalledWith(event.id)
      expect(result2).toBe(result1)
    })

    it('should respect cache TTL', async () => {
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

      // First normalization
      await normalizer.normalizeEvent(event)

      // Fast-forward beyond cache TTL
      vi.advanceTimersByTime(301000) // 301 seconds > 300 seconds TTL

      // Should re-normalize (not use cache)
      const normalizeSpy = vi.spyOn(normalizer as any, 'normalizeEventInternal')
      await normalizer.normalizeEvent(event)

      expect(normalizeSpy).toHaveBeenCalled()
    })

    it('should handle cache size limits', async () => {
      const normalizerWithSmallCache = new EventNormalizer({
        enabled: true,
        caching: {
          enabled: true,
          maxSize: 2,
          ttl: 300000
        }
      })

      const events = Array.from({ length: 3 }, (_, i) => ({
        id: createEventId(),
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'chrome-extension',
        sessionId: 'test-session',
        tabId: i + 1,
        url: `https://example.com/page${i}`,
        title: `Page ${i}`,
        action: 'navigation',
        timestampCaptured: Date.now()
      }))

      // Normalize all events
      for (const event of events) {
        await normalizerWithSmallCache.normalizeEvent(event)
      }

      // First event should be evicted from cache
      const firstEvent = events[0]
      const normalizeSpy = vi.spyOn(normalizerWithSmallCache as any, 'normalizeEventInternal')
      
      await normalizerWithSmallCache.normalizeEvent(firstEvent)

      expect(normalizeSpy).toHaveBeenCalled() // Should re-normalize
    })
  })

  describe('Configuration and Performance', () => {
    it('should allow runtime configuration updates', async () => {
      await normalizer.updateConfig({
        privacy: {
          enabled: false
        },
        quality: {
          qualityThreshold: 0.8
        }
      })

      expect(normalizer['config'].privacy.enabled).toBe(false)
      expect(normalizer['config'].quality.qualityThreshold).toBe(0.8)
    })

    it('should track performance metrics', async () => {
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

      await normalizer.normalizeEvent(event)

      const metrics = normalizer.getMetrics()
      
      expect(metrics).toHaveProperty('eventsProcessed')
      expect(metrics).toHaveProperty('eventsFiltered')
      expect(metrics).toHaveProperty('averageProcessingTime')
      expect(metrics).toHaveProperty('cacheHitRate')
      expect(metrics.eventsProcessed).toBe(1)
    })

    it('should reset metrics correctly', async () => {
      // Process some events first
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

      await normalizer.normalizeEvent(event)

      const beforeReset = normalizer.getMetrics()
      expect(beforeReset.eventsProcessed).toBe(1)

      normalizer.resetMetrics()
      
      const afterReset = normalizer.getMetrics()
      expect(afterReset.eventsProcessed).toBe(0)
      expect(afterReset.eventsFiltered).toBe(0)
    })
  })
})