import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryGraph, MemoryGraphConfig, ProcessingResult, AnalysisResult } from '@/memory/graph/index'
import { GraphDatabase } from '@/memory/graph/database'
import { TemporalClusteringEngine } from '@/memory/graph/temporal'
import { SemanticSimilarityEngine } from '@/memory/graph/semantic'
import { RelevanceScoringEngine } from '@/memory/graph/relevance'
import { MemoryDecayEngine } from '@/memory/graph/decay'
import { GraphPruningEngine } from '@/memory/graph/pruning'
import { QueryTranslationEngine } from '@/memory/graph/query'
import { ContextWindowManager } from '@/memory/graph/context'
import { BaseEvent, EventType, NodeType, EdgeType } from '@/types'

// Mock all subsystems
const createMockDatabase = () => ({
  initialize: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  getNode: vi.fn(),
  createEdge: vi.fn(),
  updateEdge: vi.fn(),
  deleteEdge: vi.fn(),
  getEdgesForNode: vi.fn(),
  queryNodes: vi.fn(),
  queryEdges: vi.fn(),
  batchOperations: vi.fn(),
  getStats: vi.fn(),
  updateStats: vi.fn(),
  vacuum: vi.fn(),
  close: vi.fn(),
  executeInTransaction: vi.fn()
})

const createMockTemporalEngine = () => ({
  clusterNodes: vi.fn(),
  detectPatterns: vi.fn()
})

const createMockSemanticEngine = () => ({
  buildSearchIndex: vi.fn(),
  calculateSimilarity: vi.fn(),
  createSemanticEdges: vi.fn(),
  extractConcepts: vi.fn(),
  updateEmbeddings: vi.fn()
})

const createMockRelevanceEngine = () => ({
  calculateNodeRelevance: vi.fn(),
  recordUserInteraction: vi.fn(),
  batchUpdateNodeRelevance: vi.fn(),
  getRelevanceStats: vi.fn()
})

const createMockDecayEngine = () => ({
  applyDecay: vi.fn(),
  boostNodeOnAccess: vi.fn(),
  decayNode: vi.fn()
})

const createMockPruningEngine = () => ({
  pruneGraph: vi.fn(),
  shouldPruneNode: vi.fn(),
  shouldPruneEdge: vi.fn()
})

const createMockQueryEngine = () => ({
  translateQuery: vi.fn(),
  executeQuery: vi.fn()
})

const createMockContextManager = () => ({
  getRelevantContext: vi.fn(),
  updateContextWithInteraction: vi.fn(),
  cleanup: vi.fn()
})

describe('MemoryGraph', () => {
  let memoryGraph: MemoryGraph
  let mockDb: any
  let mockTemporalEngine: any
  let mockSemanticEngine: any
  let mockRelevanceEngine: any
  let mockDecayEngine: any
  let mockPruningEngine: any
  let mockQueryEngine: any
  let mockContextManager: any
  let config: MemoryGraphConfig

  beforeEach(() => {
    // Create mocks
    mockDb = createMockDatabase()
    mockTemporalEngine = createMockTemporalEngine()
    mockSemanticEngine = createMockSemanticEngine()
    mockRelevanceEngine = createMockRelevanceEngine()
    mockDecayEngine = createMockDecayEngine()
    mockPruningEngine = createMockPruningEngine()
    mockQueryEngine = createMockQueryEngine()
    mockContextManager = createMockContextManager()

    config = {
      database: {
        path: ':memory:',
        maxConnections: 5,
        timeout: 30000,
        enableWAL: true,
        enableForeignKeys: true
      },
      temporal: {
        enabled: true,
        windowSizeMs: 3600000,
        overlapMs: 300000,
        minClusterSize: 2,
        maxClusterSize: 50,
        similarityThreshold: 0.6,
        decayRate: 0.1
      },
      semantic: {
        enabled: true,
        minSimilarity: 0.3,
        maxEdgesPerNode: 10,
        similarityWeights: {
          content: 0.5,
          tags: 0.3,
          metadata: 0.2
        },
        nlp: {
          useStemming: true,
          useStopWords: true,
          useSynonyms: false,
          language: 'en'
        },
        embedding: {
          enabled: false,
          model: 'sentence-transformers/all-MiniLM-L6-v2',
          dimension: 384
        }
      },
      relevance: {
        recencyWeight: 0.3,
        frequencyWeight: 0.2,
        interactionWeight: 0.3,
        semanticWeight: 0.1,
        centralityWeight: 0.1,
        timeDecayRate: 0.1,
        interactionBoost: 1.2,
        semanticThreshold: 0.5,
        typeWeights: {
          [NodeType.ACTIVITY]: 1.0,
          [NodeType.PATTERN]: 1.2,
          [NodeType.RESOURCE]: 0.8,
          [NodeType.CONCEPT]: 1.1,
          [NodeType.PROJECT]: 1.3,
          [NodeType.WORKFLOW]: 1.2,
          [NodeType.EMAIL]: 0.9,
          [NodeType.CODE]: 1.1,
          [NodeType.GITHUB]: 1.0,
          [NodeType.LEARNING]: 1.2
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
        maxAgeMs: 2592000000, // 30 days
        forceDecay: false
      },
      pruning: {
        enabled: true,
        strategy: 'relevance',
        pruneIntervalMs: 86400000, // 24 hours
        maxNodes: 10000,
        maxEdges: 50000,
        minRelevanceThreshold: 0.1,
        keepRecentMs: 604800000, // 7 days
        forcePrune: false
      },
      query: {
        enabled: true,
        maxQueryResults: 100,
        defaultQueryTimeoutMs: 5000,
        enableNaturalLanguage: true,
        enableSemanticSearch: true,
        enableFuzzyMatching: true,
        fuzzyThreshold: 0.7
      },
      context: {
        maxRecentNodes: 50,
        maxRelevantNodes: 100,
        maxRecentEdges: 25,
        maxRelevantEdges: 50,
        maxQueryHistory: 20,
        timeRangeMs: 86400000, // 24 hours
        relevanceThreshold: 0.3,
        semanticSimilarityThreshold: 0.6,
        maxContextSize: 300,
        decayRate: 0.05,
        boostRecentInteractions: 1.1
      }
    }

    // Mock constructor to inject mocks
    vi.spyOn(MemoryGraph.prototype as any, 'db', 'get').mockReturnValue(mockDb)
    vi.spyOn(MemoryGraph.prototype as any, 'temporalEngine', 'get').mockReturnValue(mockTemporalEngine)
    vi.spyOn(MemoryGraph.prototype as any, 'semanticEngine', 'get').mockReturnValue(mockSemanticEngine)
    vi.spyOn(MemoryGraph.prototype as any, 'relevanceEngine', 'get').mockReturnValue(mockRelevanceEngine)
    vi.spyOn(MemoryGraph.prototype as any, 'decayEngine', 'get').mockReturnValue(mockDecayEngine)
    vi.spyOn(MemoryGraph.prototype as any, 'pruningEngine', 'get').mockReturnValue(mockPruningEngine)
    vi.spyOn(MemoryGraph.prototype as any, 'queryEngine', 'get').mockReturnValue(mockQueryEngine)
    vi.spyOn(MemoryGraph.prototype as any, 'contextManager', 'get').mockReturnValue(mockContextManager)

    memoryGraph = new MemoryGraph(config)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with all subsystems', () => {
      expect(memoryGraph).toBeDefined()
      expect(memoryGraph['db']).toBe(mockDb)
      expect(memoryGraph['temporalEngine']).toBe(mockTemporalEngine)
      expect(memoryGraph['semanticEngine']).toBe(mockSemanticEngine)
    })

    it('should initialize database successfully', async () => {
      mockDb.initialize.mockResolvedValue(undefined)
      mockSemanticEngine.buildSearchIndex.mockResolvedValue(undefined)

      await memoryGraph.initialize()

      expect(mockDb.initialize).toHaveBeenCalled()
      expect(mockSemanticEngine.buildSearchIndex).toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      mockDb.initialize.mockRejectedValue(new Error('Database init failed'))

      await expect(memoryGraph.initialize()).rejects.toThrow('Database init failed')
    })

    it('should not initialize twice', async () => {
      mockDb.initialize.mockResolvedValue(undefined)
      mockSemanticEngine.buildSearchIndex.mockResolvedValue(undefined)

      await memoryGraph.initialize()
      await memoryGraph.initialize() // Second call

      expect(mockDb.initialize).toHaveBeenCalledTimes(1)
      expect(mockSemanticEngine.buildSearchIndex).toHaveBeenCalledTimes(1)
    })
  })

  describe('Event Processing', () => {
    const testEvents: BaseEvent[] = [
      {
        id: 'event1',
        type: EventType.BROWSER_TAB,
        timestamp: Date.now(),
        source: 'browser',
        sessionId: 'session1',
        metadata: {
          url: 'https://example.com',
          title: 'Example Page',
          action: 'navigate'
        }
      },
      {
        id: 'event2',
        type: EventType.SYSTEM_APP,
        timestamp: Date.now() + 1000,
        source: 'system',
        sessionId: 'session1',
        metadata: {
          appName: 'VS Code',
          action: 'open',
          duration: 5000
        }
      }
    ]

    it('should process events successfully', async () => {
      // Setup mocks
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 2,
        affectedEdges: 0,
        errors: []
      })
      mockSemanticEngine.createSemanticEdges.mockResolvedValue(1)
      mockRelevanceEngine.batchUpdateNodeRelevance.mockResolvedValue(undefined)
      mockTemporalEngine.clusterNodes.mockResolvedValue(['cluster1'])

      const result = await memoryGraph.processEvents(testEvents)

      expect(result.success).toBe(true)
      expect(result.nodesCreated).toBe(2)
      expect(result.edgesCreated).toBe(1)
      expect(result.processingTime).toBeGreaterThan(0)
      expect(mockDb.batchOperations).toHaveBeenCalled()
      expect(mockSemanticEngine.createSemanticEdges).toHaveBeenCalled()
    })

    it('should handle individual event processing errors', async () => {
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1,
        affectedEdges: 0,
        errors: []
      })
      mockSemanticEngine.createSemanticEdges.mockResolvedValue(0)
      mockRelevanceEngine.batchUpdateNodeRelevance.mockResolvedValue(undefined)
      mockTemporalEngine.clusterNodes.mockResolvedValue([])

      const result = await memoryGraph.processEvents(testEvents)

      expect(result.success).toBe(true)
      expect(result.nodesCreated).toBe(1) // Only one event processed successfully
      expect(result.edgesCreated).toBe(0)
    })

    it('should throw error when not initialized', async () => {
      const uninitializedGraph = new MemoryGraph(config)
      
      await expect(uninitializedGraph.processEvents(testEvents))
        .rejects.toThrow('Memory graph not initialized')
    })

    it('should create nodes from browser events', async () => {
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1,
        affectedEdges: 0,
        errors: []
      })
      mockSemanticEngine.createSemanticEdges.mockResolvedValue(0)
      mockRelevanceEngine.batchUpdateNodeRelevance.mockResolvedValue(undefined)
      mockTemporalEngine.clusterNodes.mockResolvedValue([])

      await memoryGraph.processEvents([testEvents[0]])

      expect(mockDb.batchOperations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'create',
            target: 'node',
            data: expect.objectContaining({
              type: NodeType.ACTIVITY,
              content: expect.objectContaining({
                type: 'browser_activity',
                url: 'https://example.com',
                title: 'Example Page'
              })
            })
          })
        ])
      )
    })

    it('should create nodes from system events', async () => {
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1,
        affectedEdges: 0,
        errors: []
      })
      mockSemanticEngine.createSemanticEdges.mockResolvedValue(0)
      mockRelevanceEngine.batchUpdateNodeRelevance.mockResolvedValue(undefined)
      mockTemporalEngine.clusterNodes.mockResolvedValue([])

      await memoryGraph.processEvents([testEvents[1]])

      expect(mockDb.batchOperations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'create',
            target: 'node',
            data: expect.objectContaining({
              type: NodeType.ACTIVITY,
              content: expect.objectContaining({
                type: 'system_activity',
                app: 'VS Code',
                action: 'open'
              })
            })
          })
        ])
      )
    })
  })

  describe('Query Operations', () => {
    it('should execute natural language queries', async () => {
      mockQueryEngine.translateQuery.mockResolvedValue({
        id: 'test-query',
        type: 'node',
        filters: [],
        constraints: []
      })
      mockQueryEngine.executeQuery.mockResolvedValue({
        result: {
          results: [{ id: 'node1', content: 'Test content' }],
          total: 1,
          executionTime: 100
        }
      })

      const result = await memoryGraph.query('find recent activities', 'session123')

      expect(mockQueryEngine.translateQuery).toHaveBeenCalledWith(
        'find recent activities',
        expect.any(Object)
      )
      expect(mockQueryEngine.executeQuery).toHaveBeenCalled()
      expect(result.results).toHaveLength(1)
    })

    it('should execute direct graph queries', async () => {
      const graphQuery = {
        id: 'test-query',
        type: 'node' as const,
        filters: [{ field: 'type', operator: 'eq', value: NodeType.ACTIVITY }],
        constraints: []
      }

      mockDb.queryNodes.mockResolvedValue({
        results: [{ id: 'node1', content: 'Test content' }],
        total: 1
      })

      const result = await memoryGraph.query(graphQuery)

      expect(mockDb.queryNodes).toHaveBeenCalledWith(graphQuery)
      expect(result.results).toHaveLength(1)
    })

    it('should update context for queries with session', async () => {
      mockQueryEngine.translateQuery.mockResolvedValue({
        id: 'test-query',
        type: 'node',
        filters: [],
        constraints: []
      })
      mockQueryEngine.executeQuery.mockResolvedValue({
        result: {
          results: [{ id: 'node1', content: 'Test content' }],
          total: 1,
          executionTime: 100
        }
      })

      await memoryGraph.query('test query', 'session123')

      expect(mockContextManager.updateContextWithInteraction).toHaveBeenCalledWith(
        'session123',
        'query',
        expect.objectContaining({
          query: 'test query',
          results: expect.any(Array)
        })
      )
    })

    it('should throw error when not initialized', async () => {
      const uninitializedGraph = new MemoryGraph(config)
      
      await expect(uninitializedGraph.query('test'))
        .rejects.toThrow('Memory graph not initialized')
    })
  })

  describe('Contextual Recommendations', () => {
    it('should get contextual recommendations', async () => {
      const mockContext = {
        relevantNodes: [
          {
            node: {
              id: 'node1',
              type: NodeType.ACTIVITY,
              content: 'Test activity',
              timestamp: Date.now(),
              metadata: {},
              relevanceScore: 0.8
            },
            score: 0.9
          }
        ],
        relevantEdges: [],
        recentNodes: [],
        recentEdges: [],
        queryHistory: []
      }

      mockContextManager.getRelevantContext.mockResolvedValue(mockContext)

      const recommendations = await memoryGraph.getContextualRecommendations('session123', 'test query', 5)

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0]).toEqual(
        expect.objectContaining({
          id: 'node1',
          type: NodeType.ACTIVITY,
          relevance: 0.9
        })
      )
    })

    it('should handle recommendation errors gracefully', async () => {
      mockContextManager.getRelevantContext.mockRejectedValue(new Error('Context error'))

      const recommendations = await memoryGraph.getContextualRecommendations('session123', 'test query')

      expect(recommendations).toHaveLength(0)
    })
  })

  describe('Analysis Operations', () => {
    it('should perform comprehensive analysis', async () => {
      // Setup mocks
      mockDb.getStats.mockResolvedValue({
        totalNodes: 100,
        totalEdges: 200,
        activeNodes: 90,
        activeEdges: 180
      })
      mockTemporalEngine.detectPatterns.mockResolvedValue([
        { type: 'burst', intensity: 0.8, nodeCount: 20 }
      ])
      mockRelevanceEngine.getRelevanceStats.mockResolvedValue({
        averageScore: 0.7,
        distribution: { high: 30, medium: 50, low: 20 }
      })

      const analysis = await memoryGraph.analyze()

      expect(analysis.totalNodes).toBe(100)
      expect(analysis.totalEdges).toBe(200)
      expect(analysis.activeNodes).toBe(90)
      expect(analysis.activeEdges).toBe(180)
      expect(analysis.averageRelevance).toBe(0.7)
      expect(analysis.clustering.patterns).toHaveLength(1)
    })

    it('should throw error when not initialized', async () => {
      const uninitializedGraph = new MemoryGraph(config)
      
      await expect(uninitializedGraph.analyze())
        .rejects.toThrow('Memory graph not initialized')
    })
  })

  describe('Maintenance Operations', () => {
    it('should perform maintenance successfully', async () => {
      // Setup mocks
      mockDecayEngine.applyDecay.mockResolvedValue({ nodesDecayed: 10, edgesDecayed: 5 })
      mockPruningEngine.pruneGraph.mockResolvedValue({ nodesPruned: 2, edgesPruned: 3 })
      mockSemanticEngine.updateEmbeddings.mockResolvedValue({ nodesUpdated: 50 })
      mockDb.getStats.mockResolvedValue({
        totalNodes: 88,
        totalEdges: 192,
        activeNodes: 78,
        activeEdges: 172
      })

      const result = await memoryGraph.performMaintenance()

      expect(result.success).toBe(true)
      expect(result.decayResult.nodesDecayed).toBe(10)
      expect(result.pruningResult.nodesPruned).toBe(2)
      expect(result.semanticUpdateResult.nodesUpdated).toBe(50)
      expect(result.totalTime).toBeGreaterThan(0)
    })

    it('should handle maintenance errors gracefully', async () => {
      mockDecayEngine.applyDecay.mockRejectedValue(new Error('Decay failed'))

      const result = await memoryGraph.performMaintenance()

      expect(result.success).toBe(false)
      expect(result.totalTime).toBeGreaterThan(0)
    })
  })

  describe('User Interaction Recording', () => {
    it('should record user interactions', async () => {
      await memoryGraph.recordInteraction('node1', 'view', 'session123', 1.0)

      expect(mockRelevanceEngine.recordUserInteraction).toHaveBeenCalledWith(
        'node1',
        'view',
        1.0
      )
      expect(mockDecayEngine.boostNodeOnAccess).toHaveBeenCalledWith('node1')
      expect(mockContextManager.updateContextWithInteraction).toHaveBeenCalledWith(
        'session123',
        'node_access',
        expect.objectContaining({
          nodeId: 'node1',
          accessType: 'view'
        })
      )
    })

    it('should handle interaction recording errors', async () => {
      mockRelevanceEngine.recordUserInteraction.mockRejectedValue(new Error('Recording failed'))

      await expect(memoryGraph.recordInteraction('node1', 'view'))
        .resolves.not.toThrow() // Should not throw, just log error
    })
  })

  describe('Statistics Operations', () => {
    it('should get graph statistics', async () => {
      const mockStats = {
        totalNodes: 100,
        totalEdges: 200,
        activeNodes: 90,
        activeEdges: 180
      }

      mockDb.getStats.mockResolvedValue(mockStats)

      const stats = await memoryGraph.getStats()

      expect(stats).toEqual(mockStats)
    })

    it('should throw error when not initialized', async () => {
      const uninitializedGraph = new MemoryGraph(config)
      
      await expect(uninitializedGraph.getStats())
        .rejects.toThrow('Memory graph not initialized')
    })
  })

  describe('Import/Export Operations', () => {
    it('should export graph data in JSON format', async () => {
      const mockNodes = {
        results: [
          { id: 'node1', type: NodeType.ACTIVITY, content: 'Test content' }
        ],
        total: 1
      }
      const mockEdges = {
        results: [
          { id: 'edge1', sourceId: 'node1', targetId: 'node2', type: EdgeType.SEMANTIC }
        ],
        total: 1
      }

      mockDb.queryNodes.mockResolvedValue(mockNodes)
      mockDb.queryEdges.mockResolvedValue(mockEdges)

      const exportData = await memoryGraph.export('json')

      expect(typeof exportData).toBe('string')
      const parsed = JSON.parse(exportData)
      expect(parsed.nodes).toHaveLength(1)
      expect(parsed.edges).toHaveLength(1)
      expect(parsed.metadata).toBeDefined()
    })

    it('should import graph data from JSON', async () => {
      const importData = JSON.stringify({
        nodes: [
          { id: 'node1', type: NodeType.ACTIVITY, content: 'Imported content' }
        ],
        edges: [
          { id: 'edge1', sourceId: 'node1', targetId: 'node2', type: EdgeType.SEMANTIC }
        ],
        metadata: { version: '1.0' }
      })

      mockDb.createNode.mockResolvedValue({ id: 'node1' })
      mockDb.createEdge.mockResolvedValue({ id: 'edge1' })

      await memoryGraph.import(importData)

      expect(mockDb.createNode).toHaveBeenCalledTimes(1)
      expect(mockDb.createEdge).toHaveBeenCalledTimes(1)
    })

    it('should handle unsupported export formats', async () => {
      await expect(memoryGraph.export('csv' as any))
        .rejects.toThrow('CSV export not implemented yet')
    })

    it('should handle invalid import data', async () => {
      const invalidData = 'invalid json'

      await expect(memoryGraph.import(invalidData))
        .rejects.toThrow()
    })
  })

  describe('Cleanup Operations', () => {
    it('should close memory graph successfully', async () => {
      mockDb.close.mockResolvedValue(undefined)

      await memoryGraph.close()

      expect(mockDb.close).toHaveBeenCalled()
    })

    it('should handle close errors gracefully', async () => {
      mockDb.close.mockRejectedValue(new Error('Close failed'))

      await expect(memoryGraph.close()).rejects.toThrow('Failed to close memory graph')
    })

    it('should not close when not initialized', async () => {
      const uninitializedGraph = new MemoryGraph(config)

      await uninitializedGraph.close() // Should not throw

      expect(mockDb.close).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle all subsystem initialization failures', async () => {
      mockDb.initialize.mockRejectedValue(new Error('All systems down'))

      const graph = new MemoryGraph(config)
      await expect(graph.initialize()).rejects.toThrow('All systems down')
    })

    it('should handle concurrent operations', async () => {
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1,
        affectedEdges: 0,
        errors: []
      })
      mockSemanticEngine.createSemanticEdges.mockResolvedValue(0)
      mockRelevanceEngine.batchUpdateNodeRelevance.mockResolvedValue(undefined)
      mockTemporalEngine.clusterNodes.mockResolvedValue([])

      // Start multiple concurrent operations
      const promise1 = memoryGraph.processEvents([testEvents[0]])
      const promise2 = memoryGraph.processEvents([testEvents[1]])
      const promise3 = memoryGraph.query('test query')

      const results = await Promise.all([promise1, promise2, promise3])

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(results[2]).toBeDefined()
    })

    it('should handle large event batches efficiently', async () => {
      const largeEventBatch = Array.from({ length: 1000 }, (_, i) => ({
        ...testEvents[0],
        id: `event${i}`,
        timestamp: Date.now() + i
      }))

      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1000,
        affectedEdges: 0,
        errors: []
      })
      mockSemanticEngine.createSemanticEdges.mockResolvedValue(500)
      mockRelevanceEngine.batchUpdateNodeRelevance.mockResolvedValue(undefined)
      mockTemporalEngine.clusterNodes.mockResolvedValue([])

      const startTime = Date.now()
      const result = await memoryGraph.processEvents(largeEventBatch)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(result.nodesCreated).toBe(1000)
      expect(result.edgesCreated).toBe(500)
      expect(endTime - startTime).toBeLessThan(10000) // Should complete in under 10 seconds
    })
  })

  describe('Configuration and Validation', () => {
    it('should validate configuration on initialization', () => {
      const invalidConfig = {
        ...config,
        database: {
          ...config.database,
          maxConnections: -1 // Invalid
        }
      }

      expect(() => new MemoryGraph(invalidConfig))
        .toThrow('maxConnections must be positive')
    })

    it('should use default configuration for missing values', () => {
      const minimalConfig = {
        database: { path: ':memory:' }
      }

      const graph = new MemoryGraph(minimalConfig)

      expect(graph).toBeDefined()
      // Should use default values for all other config options
    })

    it('should handle configuration updates', () => {
      // Configuration is set at initialization and shouldn't be changed
      expect(memoryGraph['config']).toEqual(config)
    })
  })
})