import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TemporalClusteringEngine } from '@/memory/graph/temporal'
import { GraphDatabase } from '@/memory/graph/database'
import { MemoryNode, NodeType, TemporalClusterConfig } from '@/memory/graph/types'
import { BaseEvent, EventType } from '@/types/events'

// Mock GraphDatabase
const createMockDatabase = () => ({
  queryNodes: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  createEdge: vi.fn(),
  getEdgesForNode: vi.fn(),
  getStats: vi.fn()
})

describe('TemporalClusteringEngine', () => {
  let engine: TemporalClusteringEngine
  let mockDb: any
  let config: TemporalClusterConfig

  beforeEach(() => {
    mockDb = createMockDatabase()
    
    config = {
      enabled: true,
      windowSizeMs: 3600000, // 1 hour
      overlapMs: 300000, // 5 minutes
      minClusterSize: 2,
      maxClusterSize: 50,
      similarityThreshold: 0.6,
      decayRate: 0.1
    }

    engine = new TemporalClusteringEngine(config, mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new TemporalClusteringEngine({}, mockDb)
      expect(defaultEngine).toBeDefined()
    })

    it('should initialize with custom configuration', () => {
      expect(engine).toBeDefined()
      expect(engine['config'].enabled).toBe(true)
      expect(engine['config'].windowSizeMs).toBe(3600000)
    })

    it('should disable clustering when disabled in config', () => {
      const disabledConfig = { enabled: false }
      const disabledEngine = new TemporalClusteringEngine(disabledConfig, mockDb)
      expect(disabledEngine['config'].enabled).toBe(false)
    })
  })

  describe('Time Window Generation', () => {
    it('should generate sliding time windows correctly', () => {
      const startTime = 1640995200000 // 2022-01-01 00:00:00 UTC
      const endTime = 1641081600000 // 2022-01-02 00:00:00 UTC

      const windows = engine['generateTimeWindows'](startTime, endTime)

      expect(windows).toHaveLength(24) // 24 one-hour windows
      expect(windows[0].start).toBe(startTime)
      expect(windows[0].end).toBe(startTime + 3600000)
      expect(windows[1].start).toBe(startTime + 3300000) // 55 minutes overlap
    })

    it('should generate windows with custom overlap', () => {
      const customConfig = { ...config, windowSizeMs: 1800000, overlapMs: 600000 } // 30 min windows, 10 min overlap
      const customEngine = new TemporalClusteringEngine(customConfig, mockDb)

      const startTime = 1640995200000
      const endTime = 1640997000000 // 30 minutes later

      const windows = customEngine['generateTimeWindows'](startTime, endTime)

      expect(windows).toHaveLength(2)
      expect(windows[0].end - windows[0].start).toBe(1800000)
      expect(windows[1].start - windows[0].start).toBe(1200000) // 20 min apart (30 - 10 overlap)
    })

    it('should handle single window case', () => {
      const startTime = 1640995200000
      const endTime = startTime + 1800000 // 30 minutes

      const windows = engine['generateTimeWindows'](startTime, endTime)

      expect(windows).toHaveLength(1)
      expect(windows[0].start).toBe(startTime)
      expect(windows[0].end).toBe(endTime)
    })
  })

  describe('Node Clustering', () => {
    const testNodes: MemoryNode[] = [
      {
        id: 'node1',
        type: NodeType.ACTIVITY,
        timestamp: 1640995200000,
        content: 'Working on project',
        metadata: { app: 'VS Code' },
        relevanceScore: 0.8,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: ['work', 'coding'],
        accessCount: 0,
        lastAccessed: 1640995200000,
        confidence: 0.9,
        sourceType: 'event',
        isPruned: false,
        createdAt: 1640995200000,
        updatedAt: 1640995200000
      },
      {
        id: 'node2',
        type: NodeType.ACTIVITY,
        timestamp: 1640995300000, // 10 minutes later
        content: 'Debugging issue',
        metadata: { app: 'VS Code' },
        relevanceScore: 0.7,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: ['work', 'debugging'],
        accessCount: 0,
        lastAccessed: 1640995300000,
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: 1640995300000,
        updatedAt: 1640995300000
      },
      {
        id: 'node3',
        type: NodeType.ACTIVITY,
        timestamp: 1640996000000, // 80 minutes later (different window)
        content: 'Meeting with team',
        metadata: { app: 'Zoom' },
        relevanceScore: 0.9,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: ['meeting', 'team'],
        accessCount: 0,
        lastAccessed: 1640996000000,
        confidence: 0.9,
        sourceType: 'event',
        isPruned: false,
        createdAt: 1640996000000,
        updatedAt: 1640996000000
      }
    ]

    it('should cluster nodes within time windows', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: testNodes,
        total: 3
      })

      const clusterIds = await engine.clusterNodes()

      expect(clusterIds).toHaveLength(2) // Two clusters
      expect(mockDb.queryNodes).toHaveBeenCalled()
      expect(mockDb.createNode).toHaveBeenCalled()
      expect(mockDb.createEdge).toHaveBeenCalled()
    })

    it('should handle empty node sets', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      const clusterIds = await engine.clusterNodes()

      expect(clusterIds).toHaveLength(0)
      expect(mockDb.createNode).not.toHaveBeenCalled()
      expect(mockDb.createEdge).not.toHaveBeenCalled()
    })

    it('should respect minClusterSize configuration', async () => {
      const singleNode = [testNodes[0]]
      mockDb.queryNodes.mockResolvedValue({
        results: singleNode,
        total: 1
      })

      const clusterIds = await engine.clusterNodes()

      expect(clusterIds).toHaveLength(0) // No cluster created
      expect(mockDb.createNode).not.toHaveBeenCalled()
    })

    it('should handle maxClusterSize configuration', async () => {
      const manyNodes = Array.from({ length: 60 }, (_, i) => ({
        ...testNodes[0],
        id: `node${i}`,
        timestamp: 1640995200000 + i * 60000 // 1 minute intervals
      }))

      mockDb.queryNodes.mockResolvedValue({
        results: manyNodes,
        total: 60
      })

      const clusterIds = await engine.clusterNodes()

      expect(clusterIds.length).toBeGreaterThan(0)
      // Should create multiple clusters due to max size limit
    })

    it('should use custom time range when provided', async () => {
      const startTime = 1640995200000
      const endTime = 1640997000000

      mockDb.queryNodes.mockResolvedValue({
        results: testNodes,
        total: 3
      })

      await engine.clusterNodes(startTime, endTime)

      expect(mockDb.queryNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({
              field: 'timestamp',
              operator: 'gte',
              value: startTime
            }),
            expect.objectContaining({
              field: 'timestamp',
              operator: 'lte',
              value: endTime
            })
          ])
        })
      )
    })
  })

  describe('Similarity Calculation', () => {
    it('should calculate temporal similarity', () => {
      const node1 = { ...testNodes[0] }
      const node2 = { ...testNodes[1] } // 10 minutes apart

      const similarity = engine['calculateTemporalSimilarity'](node1, node2)

      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should calculate content similarity', () => {
      const node1 = { ...testNodes[0] }
      const node2 = { ...testNodes[1] }

      const similarity = engine['calculateContentSimilarity'](node1, node2)

      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should calculate metadata similarity', () => {
      const node1 = { ...testNodes[0] }
      const node2 = { ...testNodes[1] }

      const similarity = engine['calculateMetadataSimilarity'](node1, node2)

      expect(similarity).toBeGreaterThan(0) // Both have VS Code
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should calculate combined similarity', () => {
      const node1 = { ...testNodes[0] }
      const node2 = { ...testNodes[1] }

      const similarity = engine['calculateSimilarity'](node1, node2)

      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should return 0 similarity for completely different nodes', () => {
      const node1 = { ...testNodes[0] }
      const node2 = {
        ...testNodes[2],
        timestamp: testNodes[0].timestamp + 86400000, // 1 day apart
        content: 'Completely different activity',
        metadata: { app: 'Different App' },
        tags: ['different']
      }

      const similarity = engine['calculateSimilarity'](node1, node2)

      expect(similarity).toBeCloseTo(0, 1)
    })
  })

  describe('Cluster Creation', () => {
    it('should create cluster nodes with correct properties', async () => {
      const clusterNodes = [testNodes[0], testNodes[1]]
      const window = { start: 1640995200000, end: 1640998800000 }

      await engine['createCluster'](clusterNodes, window)

      expect(mockDb.createNode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cluster',
          content: expect.stringContaining('cluster'),
          metadata: expect.objectContaining({
            nodeCount: 2,
            timeWindow: window
          }),
          tags: expect.arrayContaining(['temporal-cluster'])
        })
      )
    })

    it('should create edges between cluster and member nodes', async () => {
      const clusterNodes = [testNodes[0], testNodes[1]]
      const window = { start: 1640995200000, end: 1640998800000 }

      mockDb.createNode.mockResolvedValue({
        id: 'cluster-id',
        ...testNodes[0]
      })

      await engine['createCluster'](clusterNodes, window)

      expect(mockDb.createEdge).toHaveBeenCalledTimes(2) // Two edges for two nodes
      expect(mockDb.createEdge).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: 'cluster-id',
          targetId: expect.any(String),
          type: 'contains'
        })
      )
    })

    it('should handle cluster creation errors gracefully', async () => {
      const clusterNodes = [testNodes[0], testNodes[1]]
      const window = { start: 1640995200000, end: 1640998800000 }

      mockDb.createNode.mockRejectedValue(new Error('Cluster creation failed'))

      await expect(engine['createCluster'](clusterNodes, window))
        .resolves.not.toThrow() // Should not throw, just log error
    })
  })

  describe('Pattern Detection', () => {
    it('should detect burst patterns', async () => {
      const burstNodes = Array.from({ length: 20 }, (_, i) => ({
        ...testNodes[0],
        id: `burst-node-${i}`,
        timestamp: 1640995200000 + i * 60000 // High frequency
      }))

      mockDb.queryNodes.mockResolvedValue({
        results: burstNodes,
        total: 20
      })

      const patterns = await engine.detectPatterns()

      expect(patterns).toHaveLength(1)
      expect(patterns[0]).toEqual(
        expect.objectContaining({
          type: 'burst',
          intensity: expect.any(Number),
          nodeCount: 20
        })
      )
    })

    it('should detect periodic patterns', async () => {
      const periodicNodes = [
        { ...testNodes[0], timestamp: 1640995200000 }, // Day 1
        { ...testNodes[1], timestamp: 1641081600000 }, // Day 2
        { ...testNodes[2], timestamp: 1641168000000 }  // Day 3
      ]

      mockDb.queryNodes.mockResolvedValue({
        results: periodicNodes,
        total: 3
      })

      const patterns = await engine.detectPatterns()

      expect(patterns).toHaveLength(1)
      expect(patterns[0]).toEqual(
        expect.objectContaining({
          type: 'periodic',
          period: expect.any(Number)
        })
      )
    })

    it('should detect gap patterns', async () => {
      const gapNodes = [
        { ...testNodes[0], timestamp: 1640995200000 },
        { ...testNodes[1], timestamp: 1641168000000 } // Large gap
      ]

      mockDb.queryNodes.mockResolvedValue({
        results: gapNodes,
        total: 2
      })

      const patterns = await engine.detectPatterns()

      expect(patterns).toHaveLength(1)
      expect(patterns[0]).toEqual(
        expect.objectContaining({
          type: 'gap',
          duration: expect.any(Number)
        })
      )
    })

    it('should return empty patterns when none detected', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      const patterns = await engine.detectPatterns()

      expect(patterns).toHaveLength(0)
    })
  })

  describe('Configuration Validation', () => {
    it('should validate configuration on initialization', () => {
      const invalidConfig = {
        enabled: true,
        windowSizeMs: -1000 // Invalid negative value
      }

      expect(() => new TemporalClusteringEngine(invalidConfig, mockDb))
        .toThrow('windowSizeMs must be positive')
    })

    it('should validate overlapMs is less than windowSizeMs', () => {
      const invalidConfig = {
        enabled: true,
        windowSizeMs: 3600000,
        overlapMs: 4000000 // Larger than window
      }

      expect(() => new TemporalClusteringEngine(invalidConfig, mockDb))
        .toThrow('overlapMs must be less than windowSizeMs')
    })

    it('should validate minClusterSize is positive', () => {
      const invalidConfig = {
        enabled: true,
        minClusterSize: 0
      }

      expect(() => new TemporalClusteringEngine(invalidConfig, mockDb))
        .toThrow('minClusterSize must be positive')
    })

    it('should validate similarity threshold range', () => {
      const invalidConfig = {
        enabled: true,
        similarityThreshold: 1.5 // > 1
      }

      expect(() => new TemporalClusteringEngine(invalidConfig, mockDb))
        .toThrow('similarityThreshold must be between 0 and 1')
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large number of nodes efficiently', async () => {
      const manyNodes = Array.from({ length: 1000 }, (_, i) => ({
        ...testNodes[0],
        id: `node-${i}`,
        timestamp: 1640995200000 + i * 60000
      }))

      mockDb.queryNodes.mockResolvedValue({
        results: manyNodes,
        total: 1000
      })

      const startTime = Date.now()
      await engine.clusterNodes()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle nodes with missing metadata', () => {
      const nodeWithoutMetadata = {
        ...testNodes[0],
        metadata: undefined
      }

      const similarity = engine['calculateMetadataSimilarity'](nodeWithoutMetadata, testNodes[1])

      expect(similarity).toBe(0) // Should handle gracefully
    })

    it('should handle nodes with empty content', () => {
      const nodeWithoutContent = {
        ...testNodes[0],
        content: ''
      }

      const similarity = engine['calculateContentSimilarity'](nodeWithoutContent, testNodes[1])

      expect(similarity).toBe(0) // Should handle gracefully
    })

    it('should handle concurrent clustering operations', async () => {
      // Mock first call to be in progress
      let clusteringInProgress = true
      
      mockDb.queryNodes.mockImplementation(async () => {
        if (clusteringInProgress) {
          // Simulate long-running operation
          await new Promise(resolve => setTimeout(resolve, 100))
          clusteringInProgress = false
        }
        return {
          results: testNodes,
          total: 3
        }
      })

      // Start two concurrent clustering operations
      const promise1 = engine.clusterNodes()
      const promise2 = engine.clusterNodes()

      const results = await Promise.all([promise1, promise2])

      expect(results).toHaveLength(2)
      // Both should complete without errors
    })
  })
})