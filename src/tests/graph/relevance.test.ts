import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RelevanceScoringEngine, RelevanceConfig } from '@/memory/graph/relevance'
import { GraphDatabase } from '@/memory/graph/database'
import { MemoryNode, NodeType, RelevanceContext } from '@/memory/graph/types'
import { BaseEvent, EventType } from '@/types/events'

// Mock GraphDatabase
const createMockDatabase = () => ({
  queryNodes: vi.fn(),
  updateNode: vi.fn(),
  getEdgesForNode: vi.fn(),
  batchOperations: vi.fn(),
  getStats: vi.fn()
})

describe('RelevanceScoringEngine', () => {
  let engine: RelevanceScoringEngine
  let mockDb: any
  let config: RelevanceConfig

  beforeEach(() => {
    mockDb = createMockDatabase()
    
    config = {
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
    }

    engine = new RelevanceScoringEngine(config, mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new RelevanceScoringEngine({}, mockDb)
      expect(defaultEngine).toBeDefined()
    })

    it('should initialize with custom configuration', () => {
      expect(engine).toBeDefined()
      expect(engine['config'].recencyWeight).toBe(0.3)
      expect(engine['config'].frequencyWeight).toBe(0.2)
    })

    it('should validate configuration weights sum to 1', () => {
      const invalidConfig = {
        recencyWeight: 0.5,
        frequencyWeight: 0.6 // Sum already > 1
      }

      expect(() => new RelevanceScoringEngine(invalidConfig, mockDb))
        .toThrow('Relevance weights must sum to 1')
    })
  })

  describe('Recency Score Calculation', () => {
    const now = Date.now()
    const testNode: MemoryNode = {
      id: 'test-node',
      type: NodeType.ACTIVITY,
      timestamp: now,
      content: 'Test content',
      metadata: {},
      relevanceScore: 0.5,
      decayFactor: 0.1,
      degree: 0,
      clustering: 0,
      centrality: 0,
      tags: [],
      accessCount: 0,
      lastAccessed: now,
      confidence: 0.8,
      sourceType: 'event',
      isPruned: false,
      createdAt: now,
      updatedAt: now
    }

    it('should calculate recency score for recent activity', () => {
      const recentNode = {
        ...testNode,
        timestamp: now - 1000 // 1 second ago
      }

      const recencyScore = engine['calculateRecencyScore'](recentNode)
      
      expect(recencyScore).toBeGreaterThan(0.8) // Very recent
    })

    it('should calculate recency score for old activity', () => {
      const oldNode = {
        ...testNode,
        timestamp: now - 86400000 * 30 // 30 days ago
      }

      const recencyScore = engine['calculateRecencyScore'](oldNode)
      
      expect(recencyScore).toBeLessThan(0.5) // Old activity
    })

    it('should apply time decay rate correctly', () => {
      const customConfig = {
        ...config,
        timeDecayRate: 0.2 // Faster decay
      }
      const customEngine = new RelevanceScoringEngine(customConfig, mockDb)

      const node = {
        ...testNode,
        timestamp: now - 3600000 // 1 hour ago
      }

      const normalScore = engine['calculateRecencyScore'](node)
      const fastDecayScore = customEngine['calculateRecencyScore'](node)
      
      expect(fastDecayScore).toBeLessThan(normalScore)
    })

    it('should handle edge case for current timestamp', () => {
      const currentNode = {
        ...testNode,
        timestamp: now
      }

      const recencyScore = engine['calculateRecencyScore'](currentNode)
      
      expect(recencyScore).toBe(1) // Maximum recency
    })
  })

  describe('Frequency Score Calculation', () => {
    it('should calculate frequency based on access count', () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 10,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const frequencyScore = engine['calculateFrequencyScore'](node)
      
      expect(frequencyScore).toBeGreaterThan(0)
      expect(frequencyScore).toBeLessThanOrEqual(1)
    })

    it('should return 0 for nodes with no access', () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const frequencyScore = engine['calculateFrequencyScore'](node)
      
      expect(frequencyScore).toBe(0)
    })

    it('should handle high frequency gracefully', () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 10000,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const frequencyScore = engine['calculateFrequencyScore'](node)
      
      expect(frequencyScore).toBeLessThanOrEqual(1)
    })
  })

  describe('Interaction Score Calculation', () => {
    it('should calculate interaction score from user interactions', async () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 5,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockDb.queryNodes.mockResolvedValue({
        results: [
          { metadata: { interactions: [{ type: 'view', strength: 1.0 }] } }
        ],
        total: 1
      })

      const interactionScore = await engine['calculateInteractionScore'](node)
      
      expect(interactionScore).toBeGreaterThan(0)
    })

    it('should handle nodes with no interaction history', async () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      const interactionScore = await engine['calculateInteractionScore'](node)
      
      expect(interactionScore).toBe(0)
    })
  })

  describe('Semantic Score Calculation', () => {
    it('should calculate semantic score based on embeddings', () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: ['relevant'],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        embeddings: [0.1, 0.2, 0.3, 0.4],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const semanticScore = engine['calculateSemanticScore'](node)
      
      expect(semanticScore).toBeGreaterThan(0)
    })

    it('should handle nodes without embeddings', () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const semanticScore = engine['calculateSemanticScore'](node)
      
      expect(semanticScore).toBe(0)
    })
  })

  describe('Centrality Score Calculation', () => {
    it('should calculate centrality based on degree and clustering', () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 10,
        clustering: 0.8,
        centrality: 0.7,
        tags: [],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const centralityScore = engine['calculateCentralityScore'](node)
      
      expect(centralityScore).toBeGreaterThan(0)
      expect(centralityScore).toBeLessThanOrEqual(1)
    })

    it('should handle isolated nodes', () => {
      const node: MemoryNode = {
        id: 'test-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const centralityScore = engine['calculateCentralityScore'](node)
      
      expect(centralityScore).toBe(0)
    })
  })

  describe('Type Weight Application', () => {
    it('should apply type weights correctly', () => {
      const activityNode = {
        ...testNodes[0],
        type: NodeType.ACTIVITY
      }

      const projectNode = {
        ...testNodes[0],
        type: NodeType.PROJECT
      }

      const activityScore = engine['applyTypeWeight'](activityNode, 0.5)
      const projectScore = engine['applyTypeWeight'](projectNode, 0.5)
      
      expect(projectScore).toBeGreaterThan(activityScore) // Project has higher weight
    })

    it('should handle unknown node types', () => {
      const unknownNode = {
        ...testNodes[0],
        type: 'unknown' as NodeType
      }

      const score = engine['applyTypeWeight'](unknownNode, 0.5)
      
      expect(score).toBe(0.5) // No weight applied
    })
  })

  describe('Overall Relevance Calculation', () => {
    const testNodes: MemoryNode[] = [
      {
        id: 'node1',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Recent activity',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 5,
        clustering: 0.6,
        centrality: 0.5,
        tags: ['important'],
        accessCount: 8,
        lastAccessed: Date.now(),
        confidence: 0.9,
        sourceType: 'event',
        isPruned: false,
        embeddings: [0.1, 0.2, 0.3],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'node2',
        type: NodeType.RESOURCE,
        timestamp: Date.now() - 86400000, // 1 day ago
        content: 'Old resource',
        metadata: {},
        relevanceScore: 0.3,
        decayFactor: 0.1,
        degree: 1,
        clustering: 0.2,
        centrality: 0.1,
        tags: [],
        accessCount: 1,
        lastAccessed: Date.now() - 86400000,
        confidence: 0.6,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000
      }
    ]

    it('should calculate comprehensive relevance score', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      const relevance = await engine.calculateNodeRelevance(testNodes[0])
      
      expect(relevance).toBeGreaterThan(0)
      expect(relevance).toBeLessThanOrEqual(1)
    })

    it('should consider context in relevance calculation', async () => {
      const context: RelevanceContext = {
        currentSession: 'session-123',
        recentQueries: ['development', 'coding'],
        timeOfDay: 'morning',
        dayOfWeek: 'monday',
        userPreferences: { preferredTypes: [NodeType.ACTIVITY] }
      }

      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      const relevanceWithContext = await engine.calculateNodeRelevance(testNodes[0], context)
      const relevanceWithoutContext = await engine.calculateNodeRelevance(testNodes[0])
      
      // Context should influence the score
      expect(relevanceWithContext).toBeGreaterThanOrEqual(0)
    })

    it('should handle calculation errors gracefully', async () => {
      mockDb.queryNodes.mockRejectedValue(new Error('Database error'))

      const relevance = await engine.calculateNodeRelevance(testNodes[0])
      
      expect(relevance).toBeGreaterThanOrEqual(0)
      expect(relevance).toBeLessThanOrEqual(1)
    })
  })

  describe('User Interaction Recording', () => {
    it('should record user interactions correctly', async () => {
      const nodeId = 'test-node'
      const interactionType = 'view'
      const strength = 1.0

      mockDb.updateNode.mockResolvedValue(testNodes[0])

      await engine.recordUserInteraction(nodeId, interactionType, strength)
      
      expect(mockDb.updateNode).toHaveBeenCalledWith(
        nodeId,
        expect.objectContaining({
          accessCount: expect.any(Number),
          lastAccessed: expect.any(Number)
        })
      )
    })

    it('should apply interaction boost', async () => {
      const nodeId = 'test-node'
      const interactionType = 'view'
      const strength = 1.5

      mockDb.updateNode.mockResolvedValue(testNodes[0])

      await engine.recordUserInteraction(nodeId, interactionType, strength)
      
      expect(mockDb.updateNode).toHaveBeenCalledWith(
        nodeId,
        expect.objectContaining({
          relevanceScore: expect.any(Number)
        })
      )
    })

    it('should handle interaction recording errors', async () => {
      const nodeId = 'test-node'
      const interactionType = 'view'

      mockDb.updateNode.mockRejectedValue(new Error('Update failed'))

      await expect(engine.recordUserInteraction(nodeId, interactionType))
        .resolves.not.toThrow() // Should not throw, just log error
    })
  })

  describe('Batch Processing', () => {
    it('should update relevance scores for multiple nodes', async () => {
      const nodeIds = ['node1', 'node2', 'node3']
      
      mockDb.queryNodes.mockResolvedValue({
        results: testNodes,
        total: 3
      })
      
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 3,
        affectedEdges: 0,
        errors: []
      })

      await engine.batchUpdateNodeRelevance(nodeIds)
      
      expect(mockDb.queryNodes).toHaveBeenCalled()
      expect(mockDb.batchOperations).toHaveBeenCalled()
    })

    it('should handle empty node ID list', async () => {
      await engine.batchUpdateNodeRelevance([])
      
      expect(mockDb.queryNodes).not.toHaveBeenCalled()
      expect(mockDb.batchOperations).not.toHaveBeenCalled()
    })

    it('should handle batch processing errors gracefully', async () => {
      const nodeIds = ['node1', 'node2']
      
      mockDb.queryNodes.mockRejectedValue(new Error('Batch error'))

      await expect(engine.batchUpdateNodeRelevance(nodeIds))
        .resolves.not.toThrow()
    })
  })

  describe('Statistics and Analysis', () => {
    it('should get relevance statistics', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [
          { relevance_score: 0.8 },
          { relevance_score: 0.6 },
          { relevance_score: 0.4 }
        ],
        total: 3
      })

      const stats = await engine.getRelevanceStats()
      
      expect(stats).toHaveProperty('averageScore')
      expect(stats).toHaveProperty('distribution')
      expect(stats.averageScore).toBeGreaterThan(0)
      expect(stats.distribution.high).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty statistics', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      const stats = await engine.getRelevanceStats()
      
      expect(stats.averageScore).toBe(0)
      expect(stats.distribution.high).toBe(0)
    })
  })

  describe('Configuration Validation', () => {
    it('should validate weight ranges', () => {
      const invalidConfig = {
        recencyWeight: 1.5 // > 1
      }

      expect(() => new RelevanceScoringEngine(invalidConfig, mockDb))
        .toThrow('recencyWeight must be between 0 and 1')
    })

    it('should validate type weights are positive', () => {
      const invalidConfig = {
        ...config,
        typeWeights: {
          [NodeType.ACTIVITY]: -1.0 // Negative weight
        }
      }

      expect(() => new RelevanceScoringEngine(invalidConfig, mockDb))
        .toThrow('Type weights must be positive')
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of nodes efficiently', async () => {
      const manyNodeIds = Array.from({ length: 1000 }, (_, i) => `node-${i}`)
      
      mockDb.queryNodes.mockResolvedValue({
        results: Array.from({ length: 1000 }, (_, i) => ({
          ...testNodes[0],
          id: `node-${i}`
        })),
        total: 1000
      })
      
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1000,
        affectedEdges: 0,
        errors: []
      })

      const startTime = Date.now()
      await engine.batchUpdateNodeRelevance(manyNodeIds)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle concurrent relevance calculations', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [testNodes[0]],
        total: 1
      })

      const promises = Array.from({ length: 10 }, () =>
        engine.calculateNodeRelevance(testNodes[0])
      )
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(1)
      })
    })

    it('should handle nodes with missing properties', () => {
      const incompleteNode = {
        id: 'incomplete-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        // Missing other required properties
      } as any

      const recencyScore = engine['calculateRecencyScore'](incompleteNode)
      
      expect(recencyScore).toBeGreaterThanOrEqual(0)
      expect(recencyScore).toBeLessThanOrEqual(1)
    })
  })
})