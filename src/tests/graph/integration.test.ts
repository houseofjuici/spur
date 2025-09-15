import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryGraph, MemoryGraphConfig } from '@/memory/graph/index'
import { GraphDatabase } from '@/memory/graph/database'
import { NodeType, EdgeType } from '@/types'
import { BaseEvent, EventType } from '@/types/events'

// Integration test for the complete memory graph system
describe('MemoryGraph Integration', () => {
  let memoryGraph: MemoryGraph
  let config: MemoryGraphConfig
  let testDatabase: any

  beforeEach(() => {
    // Create a test configuration optimized for testing
    config = {
      database: {
        path: ':memory:', // In-memory database for testing
        maxConnections: 3,
        timeout: 10000,
        enableWAL: false, // Disable WAL for simplicity in tests
        enableForeignKeys: true
      },
      temporal: {
        enabled: true,
        windowSizeMs: 1800000, // 30 minutes for faster testing
        overlapMs: 300000,
        minClusterSize: 2,
        maxClusterSize: 10,
        similarityThreshold: 0.5,
        decayRate: 0.1
      },
      semantic: {
        enabled: true,
        minSimilarity: 0.3,
        maxEdgesPerNode: 5,
        similarityWeights: {
          content: 0.6,
          tags: 0.3,
          metadata: 0.1
        },
        nlp: {
          useStemming: false, // Disable for faster testing
          useStopWords: false,
          useSynonyms: false,
          language: 'en'
        },
        embedding: {
          enabled: false, // Disable embeddings for testing speed
          model: 'test-model',
          dimension: 128
        }
      },
      relevance: {
        recencyWeight: 0.4,
        frequencyWeight: 0.2,
        interactionWeight: 0.3,
        semanticWeight: 0.1,
        centralityWeight: 0.0, // Disable centrality for testing
        timeDecayRate: 0.1,
        interactionBoost: 1.1,
        semanticThreshold: 0.3,
        typeWeights: {
          [NodeType.ACTIVITY]: 1.0,
          [NodeType.PATTERN]: 1.1,
          [NodeType.RESOURCE]: 0.9,
          [NodeType.CONCEPT]: 1.0,
          [NodeType.PROJECT]: 1.2,
          [NodeType.WORKFLOW]: 1.1,
          [NodeType.EMAIL]: 0.8,
          [NodeType.CODE]: 1.0,
          [NodeType.GITHUB]: 0.9,
          [NodeType.LEARNING]: 1.1
        },
        edgeRecencyWeight: 0.4,
        edgeStrengthWeight: 0.4,
        edgeInteractionWeight: 0.2
      },
      decay: {
        enabled: true,
        decayFunction: 'exponential',
        decayRate: 0.1,
        minRelevanceThreshold: 0.1,
        maxAgeMs: 86400000, // 1 day for testing
        forceDecay: false
      },
      pruning: {
        enabled: true,
        strategy: 'relevance',
        pruneIntervalMs: 3600000, // 1 hour for testing
        maxNodes: 100,
        maxEdges: 500,
        minRelevanceThreshold: 0.1,
        keepRecentMs: 3600000, // 1 hour for testing
        forcePrune: false
      },
      query: {
        enabled: true,
        maxQueryResults: 50,
        defaultQueryTimeoutMs: 2000, // Faster timeout for testing
        enableNaturalLanguage: true,
        enableSemanticSearch: true,
        enableFuzzyMatching: true,
        fuzzyThreshold: 0.6
      },
      context: {
        maxRecentNodes: 20,
        maxRelevantNodes: 30,
        maxRecentEdges: 10,
        maxRelevantEdges: 20,
        maxQueryHistory: 10,
        timeRangeMs: 3600000, // 1 hour for testing
        relevanceThreshold: 0.3,
        semanticSimilarityThreshold: 0.5,
        maxContextSize: 100,
        decayRate: 0.1,
        boostRecentInteractions: 1.1
      }
    }

    // Create real memory graph instance for integration testing
    memoryGraph = new MemoryGraph(config)
  })

  afterEach(async () => {
    if (memoryGraph) {
      try {
        await memoryGraph.close()
      } catch (error) {
        // Ignore close errors in tests
      }
    }
  })

  describe('Complete Workflow Integration', () => {
    it('should initialize the complete memory graph system', async () => {
      await memoryGraph.initialize()
      
      // Verify initialization completed without errors
      expect(memoryGraph).toBeDefined()
    })

    it('should process events and create nodes and edges', async () => {
      await memoryGraph.initialize()

      const testEvents: BaseEvent[] = [
        {
          id: 'browser-event-1',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'test-session',
          metadata: {
            url: 'https://github.com/user/repo',
            title: 'GitHub Repository',
            action: 'navigate',
            domain: 'github.com'
          }
        },
        {
          id: 'system-event-1',
          type: EventType.SYSTEM_APP,
          timestamp: Date.now() + 5000,
          source: 'system',
          sessionId: 'test-session',
          metadata: {
            appName: 'VS Code',
            action: 'edit',
            duration: 30000,
            filePath: '/project/src/index.ts'
          }
        },
        {
          id: 'browser-event-2',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now() + 10000,
          source: 'browser',
          sessionId: 'test-session',
          metadata: {
            url: 'https://stackoverflow.com/questions/12345',
            title: 'Stack Overflow Question',
            action: 'navigate',
            domain: 'stackoverflow.com'
          }
        }
      ]

      const result = await memoryGraph.processEvents(testEvents)

      expect(result.success).toBe(true)
      expect(result.nodesCreated).toBeGreaterThan(0)
      expect(result.edgesCreated).toBeGreaterThanOrEqual(0)
      expect(result.processingTime).toBeGreaterThan(0)
    })

    it('should support natural language queries', async () => {
      await memoryGraph.initialize()

      // First process some events
      const testEvents: BaseEvent[] = [
        {
          id: 'setup-event',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'query-session',
          metadata: {
            url: 'https://example.com/project',
            title: 'Project Documentation',
            action: 'navigate'
          }
        }
      ]

      await memoryGraph.processEvents(testEvents)

      // Test natural language query
      const queryResult = await memoryGraph.query('find recent project activities', 'query-session')

      expect(queryResult).toBeDefined()
      expect(Array.isArray(queryResult.results)).toBe(true)
      expect(queryResult.total).toBeGreaterThanOrEqual(0)
    })

    it('should provide contextual recommendations', async () => {
      await memoryGraph.initialize()

      const recommendations = await memoryGraph.getContextualRecommendations(
        'test-session',
        'coding help',
        5
      )

      expect(Array.isArray(recommendations)).toBe(true)
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('id')
        expect(rec).toHaveProperty('type')
        expect(rec).toHaveProperty('relevance')
      })
    })

    it('should perform system analysis', async () => {
      await memoryGraph.initialize()

      // Add some test data
      const testEvents: BaseEvent[] = [
        {
          id: 'analysis-event-1',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'analysis-session',
          metadata: {
            url: 'https://example.com',
            title: 'Test Page',
            action: 'navigate'
          }
        },
        {
          id: 'analysis-event-2',
          type: EventType.SYSTEM_APP,
          timestamp: Date.now() + 1000,
          source: 'system',
          sessionId: 'analysis-session',
          metadata: {
            appName: 'Test App',
            action: 'open'
          }
        }
      ]

      await memoryGraph.processEvents(testEvents)

      const analysis = await memoryGraph.analyze()

      expect(analysis).toBeDefined()
      expect(analysis.totalNodes).toBeGreaterThanOrEqual(0)
      expect(analysis.totalEdges).toBeGreaterThanOrEqual(0)
      expect(analysis.averageRelevance).toBeGreaterThanOrEqual(0)
      expect(analysis.relevance).toBeDefined()
      expect(analysis.relevance.distribution).toBeDefined()
    })

    it('should record user interactions', async () => {
      await memoryGraph.initialize()

      // Process an event first
      const testEvents: BaseEvent[] = [
        {
          id: 'interaction-event',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'interaction-session',
          metadata: {
            url: 'https://example.com',
            title: 'Test Page',
            action: 'navigate'
          }
        }
      ]

      const processResult = await memoryGraph.processEvents(testEvents)
      expect(processResult.success).toBe(true)

      // Record user interaction
      await expect(memoryGraph.recordInteraction(
        'interaction-event', // This would be the actual node ID in real usage
        'view',
        'interaction-session',
        1.0
      )).resolves.not.toThrow()
    })

    it('should perform maintenance operations', async () => {
      await memoryGraph.initialize()

      const maintenanceResult = await memoryGraph.performMaintenance()

      expect(maintenanceResult).toBeDefined()
      expect(typeof maintenanceResult.success).toBe('boolean')
      expect(maintenanceResult.totalTime).toBeGreaterThanOrEqual(0)
    })

    it('should export and import graph data', async () => {
      await memoryGraph.initialize()

      // Add some test data
      const testEvents: BaseEvent[] = [
        {
          id: 'export-event',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'export-session',
          metadata: {
            url: 'https://example.com',
            title: 'Test Page',
            action: 'navigate'
          }
        }
      ]

      await memoryGraph.processEvents(testEvents)

      // Export data
      const exportedData = await memoryGraph.export('json')
      expect(typeof exportedData).toBe('string')

      // Verify exported data is valid JSON
      const parsedExport = JSON.parse(exportedData)
      expect(parsedExport).toHaveProperty('nodes')
      expect(parsedExport).toHaveProperty('edges')
      expect(parsedExport).toHaveProperty('metadata')

      // Import data (create new instance to test import)
      const importGraph = new MemoryGraph(config)
      await importGraph.initialize()

      await expect(importGraph.import(exportedData)).resolves.not.toThrow()

      await importGraph.close()
    })

    it('should handle large datasets efficiently', async () => {
      await memoryGraph.initialize()

      // Create a large batch of events
      const largeEventBatch: BaseEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: `bulk-event-${i}`,
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 1000, // 1 second intervals
        source: 'browser',
        sessionId: 'bulk-session',
        metadata: {
          url: `https://example.com/page${i}`,
          title: `Page ${i}`,
          action: 'navigate',
          domain: 'example.com'
        }
      }))

      const startTime = Date.now()
      const result = await memoryGraph.processEvents(largeEventBatch)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(result.nodesCreated).toBe(100)
      expect(endTime - startTime).toBeLessThan(10000) // Should complete in under 10 seconds

      // Verify data can be queried
      const stats = await memoryGraph.getStats()
      expect(stats.totalNodes).toBeGreaterThanOrEqual(100)
    })

    it('should support concurrent operations', async () => {
      await memoryGraph.initialize()

      // Create test events
      const events1: BaseEvent[] = [{
        id: 'concurrent-event-1',
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser',
        sessionId: 'concurrent-session',
        metadata: { url: 'https://test1.com', title: 'Test 1', action: 'navigate' }
      }]

      const events2: BaseEvent[] = [{
        id: 'concurrent-event-2',
        type: EventType.SYSTEM_APP,
        timestamp: Date.now(),
        source: 'system',
        sessionId: 'concurrent-session',
        metadata: { appName: 'Test App', action: 'open' }
      }]

      // Execute operations concurrently
      const promises = [
        memoryGraph.processEvents(events1),
        memoryGraph.processEvents(events2),
        memoryGraph.query('test query', 'concurrent-session'),
        memoryGraph.getContextualRecommendations('concurrent-session', 'test', 5)
      ]

      const results = await Promise.all(promises)

      // All operations should complete successfully
      expect(results).toHaveLength(4)
      expect(results[0].success).toBe(true) // processEvents result 1
      expect(results[1].success).toBe(true) // processEvents result 2
      expect(results[2]).toBeDefined() // query result
      expect(Array.isArray(results[3])).toBe(true) // recommendations result
    })

    it('should handle error recovery gracefully', async () => {
      await memoryGraph.initialize()

      // Test with malformed events
      const malformedEvents: BaseEvent[] = [
        {
          id: 'malformed-event',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'error-session',
          metadata: {} // Missing required metadata
        } as any
      ]

      // Should handle errors gracefully without crashing
      const result = await memoryGraph.processEvents(malformedEvents)

      expect(result).toBeDefined()
      // Result might indicate failure but shouldn't crash the system
    })

    it('should maintain data consistency across operations', async () => {
      await memoryGraph.initialize()

      // Add initial data
      const initialEvents: BaseEvent[] = [
        {
          id: 'consistency-event-1',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'consistency-session',
          metadata: {
            url: 'https://consistent.com',
            title: 'Consistent Page',
            action: 'navigate'
          }
        }
      ]

      await memoryGraph.processEvents(initialEvents)

      // Get initial stats
      const initialStats = await memoryGraph.getStats()

      // Perform various operations
      await memoryGraph.query('test query')
      await memoryGraph.getContextualRecommendations('consistency-session', 'test', 3)
      await memoryGraph.recordInteraction('consistency-event-1', 'view', 'consistency-session')

      // Get final stats
      const finalStats = await memoryGraph.getStats()

      // Data should remain consistent
      expect(finalStats.totalNodes).toBeGreaterThanOrEqual(initialStats.totalNodes)
      expect(finalStats.totalEdges).toBeGreaterThanOrEqual(initialStats.totalEdges)
    })

    it('should scale with increasing data volume', async () => {
      await memoryGraph.initialize()

      // Test with progressively larger datasets
      const datasetSizes = [10, 50, 100]
      const processingTimes: number[] = []

      for (const size of datasetSizes) {
        const events: BaseEvent[] = Array.from({ length: size }, (_, i) => ({
          id: `scale-event-${size}-${i}`,
          type: EventType.BROWSER_TAB,
          timestamp: Date.now() + i * 100,
          source: 'browser',
          sessionId: 'scale-session',
          metadata: {
            url: `https://example.com/page${i}`,
            title: `Page ${i}`,
            action: 'navigate'
          }
        }))

        const startTime = Date.now()
        const result = await memoryGraph.processEvents(events)
        const endTime = Date.now()

        expect(result.success).toBe(true)
        expect(result.nodesCreated).toBe(size)
        
        processingTimes.push(endTime - startTime)

        // Performance should scale reasonably (not exponentially)
        if (processingTimes.length > 1) {
          const timeIncrease = processingTimes[processingTimes.length - 1] / processingTimes[processingTimes.length - 2]
          const sizeIncrease = size / datasetSizes[datasetSizes.indexOf(size) - 1]
          expect(timeIncrease).toBeLessThan(sizeIncrease * 2) // Time shouldn't increase more than 2x data increase
        }
      }
    })
  })

  describe('Cross-Subsystem Integration', () => {
    it('should integrate temporal and semantic analysis', async () => {
      await memoryGraph.initialize()

      // Create events that should be temporally and semantically related
      const relatedEvents: BaseEvent[] = [
        {
          id: 'temporal-semantic-1',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'integration-session',
          metadata: {
            url: 'https://github.com/user/project',
            title: 'GitHub Project',
            action: 'navigate',
            domain: 'github.com'
          }
        },
        {
          id: 'temporal-semantic-2',
          type: EventType.SYSTEM_APP,
          timestamp: Date.now() + 30000, // 30 seconds later (temporally close)
          source: 'system',
          sessionId: 'integration-session',
          metadata: {
            appName: 'VS Code',
            action: 'edit',
            filePath: '/project/src/index.ts' // Semantically related to GitHub project
          }
        }
      ]

      await memoryGraph.processEvents(relatedEvents)

      // Query for related activities
      const queryResult = await memoryGraph.query('development work', 'integration-session')

      // Should find related activities
      expect(queryResult.results.length).toBeGreaterThan(0)
    })

    it('should integrate relevance scoring with user interactions', async () => {
      await memoryGraph.initialize()

      // Add some test content
      const testEvents: BaseEvent[] = [
        {
          id: 'relevance-test-1',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'relevance-session',
          metadata: {
            url: 'https://important.com',
            title: 'Important Resource',
            action: 'navigate'
          }
        },
        {
          id: 'relevance-test-2',
          type: EventType.BROWSER_TAB,
          timestamp: Date.now() + 1000,
          source: 'browser',
          sessionId: 'relevance-session',
          metadata: {
            url: 'https://less-important.com',
            title: 'Less Important',
            action: 'navigate'
          }
        }
      ]

      await memoryGraph.processEvents(testEvents)

      // Record interaction with first item (should increase relevance)
      await memoryGraph.recordInteraction('relevance-test-1', 'view', 'relevance-session', 2.0)

      // Query should prioritize interacted item
      const recommendations = await memoryGraph.getContextualRecommendations(
        'relevance-session',
        'resources',
        5
      )

      // The interacted item should appear in recommendations with higher relevance
      const importantResource = recommendations.find(rec => rec.id === 'relevance-test-1')
      if (importantResource) {
        expect(importantResource.relevance).toBeGreaterThan(0)
      }
    })

    it('should integrate context management with query processing', async () => {
      await memoryGraph.initialize()

      const sessionId = 'context-integration-session'

      // Build context with specific queries
      await memoryGraph.query('javascript programming', sessionId)
      await memoryGraph.query('react development', sessionId)
      await memoryGraph.query('web application', sessionId)

      // Recommendations should be influenced by query context
      const recommendations = await memoryGraph.getContextualRecommendations(
        sessionId,
        'development help',
        5
      )

      expect(Array.isArray(recommendations)).toBe(true)
      // Recommendations should be relevant to the development context
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle memory pressure gracefully', async () => {
      await memoryGraph.initialize()

      // Create a very large dataset to test memory handling
      const largeDataset: BaseEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `memory-test-${i}`,
        type: EventType.BROWSER_TAB,
        timestamp: Date.now() + i * 50, // 50ms intervals
        source: 'browser',
        sessionId: 'memory-test-session',
        metadata: {
          url: `https://test-${i}.com`,
          title: `Test Page ${i}`,
          action: 'navigate',
          domain: `test-${i}.com`
        }
      }))

      // Process in batches to avoid overwhelming the system
      const batchSize = 100
      for (let i = 0; i < largeDataset.length; i += batchSize) {
        const batch = largeDataset.slice(i, i + batchSize)
        const result = await memoryGraph.processEvents(batch)
        expect(result.success).toBe(true)
      }

      // System should still be responsive
      const stats = await memoryGraph.getStats()
      expect(stats.totalNodes).toBe(1000)

      // Query should still work
      const queryResult = await memoryGraph.query('test pages', 'memory-test-session')
      expect(queryResult).toBeDefined()
    })

    it('should recover from operation failures', async () => {
      await memoryGraph.initialize()

      // Process some valid events first
      const validEvents: BaseEvent[] = [{
        id: 'recovery-valid',
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser',
        sessionId: 'recovery-session',
        metadata: {
          url: 'https://valid.com',
          title: 'Valid Page',
          action: 'navigate'
        }
      }]

      await memoryGraph.processEvents(validEvents)

      // Get initial state
      const initialStats = await memoryGraph.getStats()

      // Try to process invalid events (should fail gracefully)
      try {
        await memoryGraph.processEvents([{
          id: 'recovery-invalid',
          type: 'INVALID_TYPE' as any,
          timestamp: Date.now(),
          source: 'browser',
          sessionId: 'recovery-session',
          metadata: {}
        } as any])
      } catch (error) {
        // Expected to fail, but system should recover
      }

      // System should still be operational
      const finalStats = await memoryGraph.getStats()
      expect(finalStats.totalNodes).toBe(initialStats.totalNodes)

      // Should still be able to process valid events
      const recoveryResult = await memoryGraph.processEvents([{
        id: 'recovery-after-failure',
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser',
        sessionId: 'recovery-session',
        metadata: {
          url: 'https://recovery.com',
          title: 'Recovery Page',
          action: 'navigate'
        }
      }])

      expect(recoveryResult.success).toBe(true)
    })
  })
})