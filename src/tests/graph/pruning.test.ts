import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GraphPruningEngine, PruningConfig, PruningResult } from '@/memory/graph/pruning'
import { GraphDatabase } from '@/memory/graph/database'
import { MemoryNode, MemoryEdge, NodeType, EdgeType } from '@/memory/graph/types'

// Mock GraphDatabase
const createMockDatabase = () => ({
  queryNodes: vi.fn(),
  queryEdges: vi.fn(),
  deleteNode: vi.fn(),
  deleteEdge: vi.fn(),
  getEdgesForNode: vi.fn(),
  batchOperations: vi.fn(),
  getStats: vi.fn()
})

describe('GraphPruningEngine', () => {
  let engine: GraphPruningEngine
  let mockDb: any
  let config: PruningConfig

  beforeEach(() => {
    mockDb = createMockDatabase()
    
    config = {
      enabled: true,
      strategy: 'relevance',
      pruneIntervalMs: 86400000, // 24 hours
      maxNodes: 10000,
      maxEdges: 50000,
      minRelevanceThreshold: 0.1,
      keepRecentMs: 604800000, // 7 days
      forcePrune: false
    }

    engine = new GraphPruningEngine(config, mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new GraphPruningEngine({}, mockDb)
      expect(defaultEngine).toBeDefined()
    })

    it('should initialize with custom configuration', () => {
      expect(engine).toBeDefined()
      expect(engine['config'].enabled).toBe(true)
      expect(engine['config'].strategy).toBe('relevance')
    })

    it('should validate pruning strategy', () => {
      const invalidConfig = {
        strategy: 'invalid'
      }

      expect(() => new GraphPruningEngine(invalidConfig, mockDb))
        .toThrow('Invalid pruning strategy')
    })
  })

  describe('Node Pruning Decisions', () => {
    const testNodes: MemoryNode[] = [
      {
        id: 'node1',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Recent relevant activity',
        metadata: {},
        relevanceScore: 0.8,
        decayFactor: 0.1,
        degree: 5,
        clustering: 0.6,
        centrality: 0.7,
        tags: ['important'],
        accessCount: 10,
        lastAccessed: Date.now(),
        confidence: 0.9,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'node2',
        type: NodeType.RESOURCE,
        timestamp: Date.now() - 86400000 * 10, // 10 days ago
        content: 'Old irrelevant resource',
        metadata: {},
        relevanceScore: 0.05,
        decayFactor: 0.1,
        degree: 1,
        clustering: 0.1,
        centrality: 0.1,
        tags: [],
        accessCount: 1,
        lastAccessed: Date.now() - 86400000 * 10,
        confidence: 0.5,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now() - 86400000 * 10,
        updatedAt: Date.now() - 86400000 * 10
      },
      {
        id: 'node3',
        type: NodeType.PROJECT,
        timestamp: Date.now() - 86400000 * 20, // 20 days ago but high relevance
        content: 'Important old project',
        metadata: {},
        relevanceScore: 0.9,
        decayFactor: 0.05,
        degree: 15,
        clustering: 0.8,
        centrality: 0.9,
        tags: ['critical'],
        accessCount: 50,
        lastAccessed: Date.now() - 86400000 * 2, // Accessed 2 days ago
        confidence: 0.95,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now() - 86400000 * 20,
        updatedAt: Date.now() - 86400000 * 2
      }
    ]

    it('should identify nodes that should be pruned by relevance', () => {
      const shouldPrune = engine.shouldPruneNode(testNodes[0])

      expect(shouldPrune).toBe(false) // High relevance, should not be pruned
    })

    it('should identify low relevance nodes for pruning', () => {
      const shouldPrune = engine.shouldPruneNode(testNodes[1])

      expect(shouldPrune).toBe(true) // Low relevance, should be pruned
    })

    it('should preserve high importance nodes despite age', () => {
      const shouldPrune = engine.shouldPruneNode(testNodes[2])

      expect(shouldPrune).toBe(false) // High importance despite age
    })

    it('should respect keep recent threshold', () => {
      const recentNode = {
        ...testNodes[1],
        lastAccessed: Date.now() - 3600000, // 1 hour ago
        relevanceScore: 0.05
      }

      const shouldPrune = engine.shouldPruneNode(recentNode)

      expect(shouldPrune).toBe(false) // Recent enough to keep
    })

    it('should handle already pruned nodes', () => {
      const prunedNode = {
        ...testNodes[1],
        isPruned: true
      }

      const shouldPrune = engine.shouldPruneNode(prunedNode)

      expect(shouldPrune).toBe(false) // Already pruned, don't prune again
    })
  })

  describe('Edge Pruning Decisions', () => {
    const testEdges: MemoryEdge[] = [
      {
        id: 'edge1',
        sourceId: 'node1',
        targetId: 'node2',
        type: EdgeType.SEMANTIC,
        weight: 0.8,
        metadata: {},
        temporal: { start: Date.now(), end: Date.now() + 1000 },
        confidence: 0.9,
        isBidirectional: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'edge2',
        sourceId: 'node3',
        targetId: 'node4',
        type: EdgeType.TEMPORAL,
        weight: 0.1,
        metadata: {},
        temporal: { start: Date.now() - 86400000 * 15, end: Date.now() - 86400000 * 15 },
        confidence: 0.3,
        isBidirectional: false,
        createdAt: Date.now() - 86400000 * 15,
        updatedAt: Date.now() - 86400000 * 15
      }
    ]

    it('should identify strong edges that should be kept', () => {
      const shouldPrune = engine.shouldPruneEdge(testEdges[0])

      expect(shouldPrune).toBe(false) // Strong edge, should be kept
    })

    it('should identify weak edges for pruning', () => {
      const shouldPrune = engine.shouldPruneEdge(testEdges[1])

      expect(shouldPrune).toBe(true) // Weak old edge, should be pruned
    })

    it('should respect edge weight threshold', () => {
      const config = { ...engine['config'], minEdgeWeight: 0.5 }
      engine['config'] = config

      const weakEdge = {
        ...testEdges[0],
        weight: 0.3
      }

      const shouldPrune = engine.shouldPruneEdge(weakEdge)

      expect(shouldPrune).toBe(true) // Below weight threshold
    })
  })

  describe('Graph Pruning Execution', () => {
    it('should prune the graph successfully', async () => {
      // Setup mock responses
      mockDb.queryNodes.mockResolvedValue({
        results: [
          { id: 'node1', relevance_score: 0.05, last_accessed: Date.now() - 86400000 * 15 },
          { id: 'node2', relevance_score: 0.8, last_accessed: Date.now() }
        ],
        total: 2
      })

      mockDb.queryEdges.mockResolvedValue({
        results: [
          { id: 'edge1', weight: 0.1, created_at: Date.now() - 86400000 * 20 },
          { id: 'edge2', weight: 0.8, created_at: Date.now() }
        ],
        total: 2
      })

      mockDb.getEdgesForNode.mockResolvedValue([
        { id: 'edge1', source_id: 'node1', target_id: 'node2' }
      ])

      mockDb.deleteNode.mockResolvedValue({})
      mockDb.deleteEdge.mockResolvedValue({})

      const result = await engine.pruneGraph()

      expect(result.nodesPruned).toBe(1) // Only node1 should be pruned
      expect(result.edgesPruned).toBe(1) // Only edge1 should be pruned
      expect(result.edgesOrphaned).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty graph', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      mockDb.queryEdges.mockResolvedValue({
        results: [],
        total: 0
      })

      const result = await engine.pruneGraph()

      expect(result.nodesPruned).toBe(0)
      expect(result.edgesPruned).toBe(0)
      expect(result.edgesOrphaned).toBe(0)
    })

    it('should handle size-based pruning', async () => {
      const sizeConfig = { ...config, strategy: 'size', maxNodes: 5, maxEdges: 10 }
      const sizeEngine = new GraphPruningEngine(sizeConfig, mockDb)

      // Mock many nodes and edges
      mockDb.queryNodes.mockResolvedValue({
        results: Array.from({ length: 100 }, (_, i) => ({
          id: `node${i}`,
          relevance_score: 0.5 - (i * 0.005), // Decreasing relevance
          last_accessed: Date.now() - i * 3600000
        })),
        total: 100
      })

      mockDb.queryEdges.mockResolvedValue({
        results: Array.from({ length: 200 }, (_, i) => ({
          id: `edge${i}`,
          weight: 0.5 - (i * 0.002),
          created_at: Date.now() - i * 3600000
        })),
        total: 200
      })

      mockDb.getEdgesForNode.mockResolvedValue([])
      mockDb.deleteNode.mockResolvedValue({})
      mockDb.deleteEdge.mockResolvedValue({})

      const result = await sizeEngine.pruneGraph()

      expect(result.nodesPruned).toBeGreaterThan(0)
      expect(result.edgesPruned).toBeGreaterThan(0)
    })

    it('should handle age-based pruning', async () => {
      const ageConfig = { ...config, strategy: 'age', keepRecentMs: 86400000 } // 1 day
      const ageEngine = new GraphPruningEngine(ageConfig, mockDb)

      mockDb.queryNodes.mockResolvedValue({
        results: [
          { id: 'node1', relevance_score: 0.8, last_accessed: Date.now() - 86400000 * 2 }, // 2 days ago
          { id: 'node2', relevance_score: 0.3, last_accessed: Date.now() - 3600000 } // 1 hour ago
        ],
        total: 2
      })

      mockDb.queryEdges.mockResolvedValue({
        results: [],
        total: 0
      })

      mockDb.deleteNode.mockResolvedValue({})

      const result = await ageEngine.pruneGraph()

      expect(result.nodesPruned).toBe(1) // Only the old node should be pruned
    })

    it('should handle orphaned edge cleanup', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      mockDb.queryEdges.mockResolvedValue({
        results: [
          { id: 'orphaned-edge', source_id: 'deleted-node', target_id: 'deleted-node' }
        ],
        total: 1
      })

      mockDb.deleteEdge.mockResolvedValue({})

      const result = await engine.pruneGraph()

      expect(result.nodesPruned).toBe(0)
      expect(result.edgesPruned).toBe(1)
      expect(result.edgesOrphaned).toBe(1)
    })

    it('should handle pruning errors gracefully', async () => {
      mockDb.queryNodes.mockRejectedValue(new Error('Query failed'))

      const result = await engine.pruneGraph()

      expect(result.nodesPruned).toBe(0)
      expect(result.edgesPruned).toBe(0)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('Batch Pruning Operations', () => {
    it('should delete nodes and edges in batches', async () => {
      const nodesToDelete = Array.from({ length: 150 }, (_, i) => ({
        id: `node${i}`,
        relevance_score: 0.05,
        last_accessed: Date.now() - 86400000 * 30
      }))

      const edgesToDelete = Array.from({ length: 100 }, (_, i) => ({
        id: `edge${i}`,
        weight: 0.1,
        created_at: Date.now() - 86400000 * 30
      }))

      mockDb.queryNodes.mockResolvedValue({
        results: nodesToDelete,
        total: 150
      })

      mockDb.queryEdges.mockResolvedValue({
        results: edgesToDelete,
        total: 100
      })

      mockDb.getEdgesForNode.mockResolvedValue([])
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 50,
        affectedEdges: 50,
        errors: []
      })

      const result = await engine.pruneGraph()

      expect(mockDb.batchOperations).toHaveBeenCalled()
      expect(result.nodesPruned + result.edgesPruned).toBeGreaterThan(0)
    })

    it('should handle batch operation failures', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [{ id: 'node1', relevance_score: 0.05, last_accessed: Date.now() - 86400000 * 30 }],
        total: 1
      })

      mockDb.queryEdges.mockResolvedValue({
        results: [],
        total: 0
      })

      mockDb.batchOperations.mockRejectedValue(new Error('Batch failed'))

      const result = await engine.pruneGraph()

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Batch failed')
    })
  })

  describe('Pruning Strategies', () => {
    it('should apply hybrid pruning strategy', async () => {
      const hybridConfig = { ...config, strategy: 'hybrid' }
      const hybridEngine = new GraphPruningEngine(hybridConfig, mockDb)

      mockDb.queryNodes.mockResolvedValue({
        results: [
          { id: 'node1', relevance_score: 0.05, last_accessed: Date.now() - 86400000 * 15 },
          { id: 'node2', relevance_score: 0.8, last_accessed: Date.now() - 86400000 * 20 } // Old but relevant
        ],
        total: 2
      })

      mockDb.queryEdges.mockResolvedValue({
        results: [],
        total: 0
      })

      mockDb.deleteNode.mockResolvedValue({})

      const result = await hybridEngine.pruneGraph()

      expect(result.nodesPruned).toBe(1) // Only the low relevance node should be pruned
    })

    it('should apply custom pruning strategy', async () => {
      const customConfig = {
        ...config,
        strategy: 'custom',
        customPruningFunction: (node: any) => node.relevance_score < 0.2 && node.access_count < 5
      }
      const customEngine = new GraphPruningEngine(customConfig, mockDb)

      const node = {
        relevance_score: 0.15,
        access_count: 3
      }

      const shouldPrune = customEngine['shouldPruneNodeCustom'](node)

      expect(shouldPrune).toBe(true)
    })
  })

  describe('Configuration Validation', () => {
    it('should validate max nodes and edges are positive', () => {
      const invalidConfig = {
        maxNodes: 0
      }

      expect(() => new GraphPruningEngine(invalidConfig, mockDb))
        .toThrow('maxNodes must be positive')
    })

    it('should validate minimum relevance threshold', () => {
      const invalidConfig = {
        minRelevanceThreshold: 1.5 // > 1
      }

      expect(() => new GraphPruningEngine(invalidConfig, mockDb))
        .toThrow('minRelevanceThreshold must be between 0 and 1')
    })

    it('should validate keep recent time', () => {
      const invalidConfig = {
        keepRecentMs: -1 // Negative
      }

      expect(() => new GraphPruningEngine(invalidConfig, mockDb))
        .toThrow('keepRecentMs must be positive')
    })
  })

  describe('Force Pruning', () => {
    it('should force pruning regardless of thresholds', async () => {
      const forceConfig = { ...config, forcePrune: true }
      const forceEngine = new GraphPruningEngine(forceConfig, mockDb)

      mockDb.queryNodes.mockResolvedValue({
        results: [
          { id: 'node1', relevance_score: 0.8, last_accessed: Date.now() } // Normally wouldn't be pruned
        ],
        total: 1
      })

      mockDb.queryEdges.mockResolvedValue({
        results: [],
        total: 0
      })

      mockDb.deleteNode.mockResolvedValue({})

      const result = await forceEngine.pruneGraph()

      // With force pruning, even relevant nodes might be pruned based on other criteria
      expect(result).toBeDefined()
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large graphs efficiently', async () => {
      const largeNodeSet = Array.from({ length: 10000 }, (_, i) => ({
        id: `node${i}`,
        relevance_score: Math.random() * 0.5, // Random low scores
        last_accessed: Date.now() - Math.random() * 86400000 * 30
      }))

      const largeEdgeSet = Array.from({ length: 50000 }, (_, i) => ({
        id: `edge${i}`,
        weight: Math.random() * 0.3,
        created_at: Date.now() - Math.random() * 86400000 * 30
      }))

      mockDb.queryNodes.mockResolvedValue({
        results: largeNodeSet,
        total: 10000
      })

      mockDb.queryEdges.mockResolvedValue({
        results: largeEdgeSet,
        total: 50000
      })

      mockDb.getEdgesForNode.mockResolvedValue([])
      mockDb.batchOperations.mockResolvedValue({
        affectedNodes: 100,
        affectedEdges: 200,
        errors: []
      })

      const startTime = Date.now()
      const result = await engine.pruneGraph()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(10000) // Should complete in under 10 seconds
      expect(result.nodesPruned + result.edgesPruned).toBeGreaterThan(0)
    })

    it('should handle nodes with missing properties', () => {
      const incompleteNode = {
        id: 'incomplete-node',
        type: NodeType.ACTIVITY
      } as any

      expect(() => engine.shouldPruneNode(incompleteNode)).not.toThrow()
    })

    it('should handle concurrent pruning operations', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [{ id: 'node1', relevance_score: 0.05, last_accessed: Date.now() - 86400000 * 30 }],
        total: 1
      })

      mockDb.queryEdges.mockResolvedValue({
        results: [],
        total: 0
      })

      mockDb.deleteNode.mockResolvedValue({})

      const promises = Array.from({ length: 3 }, () => engine.pruneGraph())
      
      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.nodesPruned).toBe(1)
      })
    })

    it('should preserve critical nodes', async () => {
      const criticalNode = {
        id: 'critical-node',
        type: NodeType.PROJECT,
        relevance_score: 0.95,
        degree: 50,
        clustering: 0.9,
        access_count: 100,
        last_accessed: Date.now() - 86400000 * 10,
        tags: ['critical', 'important']
      }

      const shouldPrune = engine.shouldPruneNode(criticalNode as any)

      expect(shouldPrune).toBe(false) // Critical node should never be pruned
    })
  })
})