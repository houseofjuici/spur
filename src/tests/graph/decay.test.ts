import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryDecayEngine, DecayConfig, DecayResult } from '@/memory/graph/decay'
import { GraphDatabase } from '@/memory/graph/database'
import { MemoryNode, NodeType } from '@/memory/graph/types'

// Mock GraphDatabase
const createMockDatabase = () => ({
  queryNodes: vi.fn(),
  updateNode: vi.fn(),
  batchOperations: vi.fn(),
  getStats: vi.fn()
})

describe('MemoryDecayEngine', () => {
  let engine: MemoryDecayEngine
  let mockDb: any
  let config: DecayConfig

  beforeEach(() => {
    mockDb = createMockDatabase()
    
    config = {
      enabled: true,
      decayFunction: 'exponential',
      decayRate: 0.1,
      minRelevanceThreshold: 0.1,
      maxAgeMs: 2592000000, // 30 days
      forceDecay: false
    }

    engine = new MemoryDecayEngine(config, mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new MemoryDecayEngine({}, mockDb)
      expect(defaultEngine).toBeDefined()
    })

    it('should initialize with custom configuration', () => {
      expect(engine).toBeDefined()
      expect(engine['config'].enabled).toBe(true)
      expect(engine['config'].decayRate).toBe(0.1)
    })

    it('should validate decay function', () => {
      const invalidConfig = {
        decayFunction: 'invalid'
      }

      expect(() => new MemoryDecayEngine(invalidConfig, mockDb))
        .toThrow('Invalid decay function')
    })
  })

  describe('Exponential Decay', () => {
    it('should calculate exponential decay correctly', () => {
      const node = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 3600000 // 1 hour ago
      }

      const decayedScore = engine['applyExponentialDecay'](node)

      expect(decayedScore).toBeLessThan(1.0)
      expect(decayedScore).toBeGreaterThan(0)
    })

    it('should apply higher decay rate faster', () => {
      const node = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 3600000 // 1 hour ago
      }

      const normalDecay = engine['applyExponentialDecay'](node)

      const fastConfig = { ...config, decayRate: 0.2 }
      const fastEngine = new MemoryDecayEngine(fastConfig, mockDb)
      const fastDecay = fastEngine['applyExponentialDecay'](node)

      expect(fastDecay).toBeLessThan(normalDecay)
    })

    it('should handle very old nodes', () => {
      const node = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 86400000 * 100 // 100 days ago
      }

      const decayedScore = engine['applyExponentialDecay'](node)

      expect(decayedScore).toBeCloseTo(0, 2)
    })

    it('should handle recently accessed nodes', () => {
      const node = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 1000 // 1 second ago
      }

      const decayedScore = engine['applyExponentialDecay'](node)

      expect(decayedScore).toBeCloseTo(1.0, 2)
    })
  })

  describe('Linear Decay', () => {
    it('should calculate linear decay correctly', () => {
      const linearConfig = { ...config, decayFunction: 'linear' }
      const linearEngine = new MemoryDecayEngine(linearConfig, mockDb)

      const node = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 3600000 // 1 hour ago
      }

      const decayedScore = linearEngine['applyLinearDecay'](node)

      expect(decayedScore).toBeLessThan(1.0)
      expect(decayedScore).toBeGreaterThan(0)
    })

    it('should decay linearly over time', () => {
      const linearConfig = { ...config, decayFunction: 'linear' }
      const linearEngine = new MemoryDecayEngine(linearConfig, mockDb)

      const recentNode = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 3600000 // 1 hour ago
      }

      const oldNode = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 7200000 // 2 hours ago
      }

      const recentScore = linearEngine['applyLinearDecay'](recentNode)
      const oldScore = linearEngine['applyLinearDecay'](oldNode)

      expect(oldScore).toBeLessThan(recentScore)
    })
  })

  describe('Logarithmic Decay', () => {
    it('should calculate logarithmic decay correctly', () => {
      const logConfig = { ...config, decayFunction: 'logarithmic' }
      const logEngine = new MemoryDecayEngine(logConfig, mockDb)

      const node = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 3600000 // 1 hour ago
      }

      const decayedScore = logEngine['applyLogarithmicDecay'](node)

      expect(decayedScore).toBeLessThan(1.0)
      expect(decayedScore).toBeGreaterThan(0)
    })

    it('should decay slower than exponential for recent nodes', () => {
      const node = {
        relevanceScore: 1.0,
        lastAccessed: Date.now() - 3600000 // 1 hour ago
      }

      const expScore = engine['applyExponentialDecay'](node)

      const logConfig = { ...config, decayFunction: 'logarithmic' }
      const logEngine = new MemoryDecayEngine(logConfig, mockDb)
      const logScore = logEngine['applyLogarithmicDecay'](node)

      expect(logScore).toBeGreaterThan(expScore)
    })
  })

  describe('Node Decay', () => {
    const testNodes: MemoryNode[] = [
      {
        id: 'node1',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Recent activity',
        metadata: {},
        relevanceScore: 0.8,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 5,
        lastAccessed: Date.now() - 3600000, // 1 hour ago
        confidence: 0.9,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'node2',
        type: NodeType.RESOURCE,
        timestamp: Date.now() - 86400000, // 1 day ago
        content: 'Old resource',
        metadata: {},
        relevanceScore: 0.6,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: [],
        accessCount: 1,
        lastAccessed: Date.now() - 86400000,
        confidence: 0.7,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000
      }
    ]

    it('should decay individual nodes', () => {
      const node = { ...testNodes[0] }
      const originalScore = node.relevanceScore

      engine.decayNode(node)

      expect(node.relevanceScore).toBeLessThan(originalScore)
      expect(node.lastAccessed).toBeDefined()
    })

    it('should not decay below minimum threshold', () => {
      const node = {
        ...testNodes[1],
        relevanceScore: 0.05, // Already below threshold
        lastAccessed: Date.now() - 86400000 * 30 // 30 days ago
      }

      const originalScore = node.relevanceScore
      engine.decayNode(node)

      expect(node.relevanceScore).toBeCloseTo(originalScore, 2)
    })

    it('should handle nodes with decayFactor', () => {
      const node = {
        ...testNodes[0],
        decayFactor: 0.2 // Custom decay factor
      }

      const originalScore = node.relevanceScore
      engine.decayNode(node)

      expect(node.relevanceScore).toBeLessThan(originalScore)
    })
  })

  describe('Batch Decay Application', () => {
    it('should apply decay to all nodes', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [
          { ...testNodes[0], id: 'node1' },
          { ...testNodes[1], id: 'node2' }
        ],
        total: 2
      })

      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 2,
        affectedEdges: 0,
        errors: []
      })

      const result = await engine.applyDecay()

      expect(result.nodesDecayed).toBe(2)
      expect(result.edgesDecayed).toBe(0)
      expect(mockDb.batchOperations).toHaveBeenCalled()
    })

    it('should handle empty node set', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      const result = await engine.applyDecay()

      expect(result.nodesDecayed).toBe(0)
      expect(result.edgesDecayed).toBe(0)
      expect(mockDb.batchOperations).not.toHaveBeenCalled()
    })

    it('should filter nodes by last access time', async () => {
      const veryOldNode = {
        ...testNodes[1],
        lastAccessed: Date.now() - 86400000 * 60 // 60 days ago
      }

      mockDb.queryNodes.mockResolvedValue({
        results: [veryOldNode],
        total: 1
      })

      const result = await engine.applyDecay()

      expect(result.nodesDecayed).toBe(0) // Too old to decay
      expect(mockDb.batchOperations).not.toHaveBeenCalled()
    })

    it('should handle batch operation errors', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [testNodes[0]],
        total: 1
      })

      mockDb.batchOperations.mockRejectedValue(new Error('Batch error'))

      const result = await engine.applyDecay()

      expect(result.nodesDecayed).toBe(0)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('Node Boost on Access', () => {
    it('should boost node relevance on access', async () => {
      mockDb.updateNode.mockResolvedValue({})

      await engine.boostNodeOnAccess('node1')

      expect(mockDb.updateNode).toHaveBeenCalledWith(
        'node1',
        expect.objectContaining({
          lastAccessed: expect.any(Number),
          relevanceScore: expect.any(Number)
        })
      )
    })

    it('should apply boost factor correctly', async () => {
      const node = {
        ...testNodes[0],
        relevanceScore: 0.5
      }

      const boostedScore = engine['calculateBoostedScore'](node, 1.5)

      expect(boostedScore).toBeGreaterThan(node.relevanceScore)
      expect(boostedScore).toBeLessThanOrEqual(1.0)
    })

    it('should not boost beyond maximum score', async () => {
      const node = {
        ...testNodes[0],
        relevanceScore: 0.9
      }

      const boostedScore = engine['calculateBoostedScore'](node, 2.0)

      expect(boostedScore).toBeLessThanOrEqual(1.0)
    })

    it('should handle boost errors gracefully', async () => {
      mockDb.updateNode.mockRejectedValue(new Error('Update failed'))

      await expect(engine.boostNodeOnAccess('node1'))
        .resolves.not.toThrow()
    })
  })

  describe('Configuration Validation', () => {
    it('should validate decay rate range', () => {
      const invalidConfig = {
        decayRate: 1.5 // > 1
      }

      expect(() => new MemoryDecayEngine(invalidConfig, mockDb))
        .toThrow('decayRate must be between 0 and 1')
    })

    it('should validate minimum relevance threshold', () => {
      const invalidConfig = {
        minRelevanceThreshold: -0.1 // Negative
      }

      expect(() => new MemoryDecayEngine(invalidConfig, mockDb))
        .toThrow('minRelevanceThreshold must be between 0 and 1')
    })

    it('should validate max age', () => {
      const invalidConfig = {
        maxAgeMs: -1 // Negative
      }

      expect(() => new MemoryDecayEngine(invalidConfig, mockDb))
        .toThrow('maxAgeMs must be positive')
    })
  })

  describe('Force Decay', () => {
    it('should force decay regardless of age', async () => {
      const forceConfig = { ...config, forceDecay: true }
      const forceEngine = new MemoryDecayEngine(forceConfig, mockDb)

      const veryOldNode = {
        ...testNodes[1],
        lastAccessed: Date.now() - 86400000 * 100 // 100 days ago
      }

      mockDb.queryNodes.mockResolvedValue({
        results: [veryOldNode],
        total: 1
      })

      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1,
        affectedEdges: 0,
        errors: []
      })

      const result = await forceEngine.applyDecay()

      expect(result.nodesDecayed).toBe(1) // Should decay even old nodes when forced
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large number of nodes efficiently', async () => {
      const manyNodes = Array.from({ length: 1000 }, (_, i) => ({
        ...testNodes[0],
        id: `node-${i}`,
        lastAccessed: Date.now() - i * 3600000 // Staggered access times
      }))

      mockDb.queryNodes.mockResolvedValue({
        results: manyNodes,
        total: 1000
      })

      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1000,
        affectedEdges: 0,
        errors: []
      })

      const startTime = Date.now()
      await engine.applyDecay()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle nodes with missing properties', () => {
      const incompleteNode = {
        id: 'incomplete-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Test content',
        metadata: {},
        relevanceScore: 0.5,
        // Missing other properties
      } as any

      expect(() => engine.decayNode(incompleteNode)).not.toThrow()
    })

    it('should handle concurrent decay operations', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [testNodes[0]],
        total: 1
      })

      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 1,
        affectedEdges: 0,
        errors: []
      })

      const promises = Array.from({ length: 5 }, () => engine.applyDecay())
      
      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result.nodesDecayed).toBe(1)
      })
    })
  })
})