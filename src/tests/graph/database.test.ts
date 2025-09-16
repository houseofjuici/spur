import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GraphDatabase } from '@/memory/graph/database'
import { NodeType, EdgeType } from '@/types'
import { MemoryNode, MemoryEdge, GraphDatabaseConfig } from '@/memory/graph/types'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// Mock better-sqlite3 for testing
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation((filename: string) => {
      // In-memory database for testing
      const db = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn(),
          get: vi.fn(),
          all: vi.fn(),
          bind: vi.fn().mockReturnThis()
        }),
        exec: vi.fn(),
        close: vi.fn(),
        pragma: vi.fn().mockReturnValue({ total_changes: 0 })
      }
      return db
    })
  }
})

describe('GraphDatabase', () => {
  let db: GraphDatabase
  let mockConfig: GraphDatabaseConfig
  let testDb: any

  beforeEach(() => {
    mockConfig = {
      path: ':memory:',
      maxConnections: 5,
      timeout: 30000,
      enableWAL: true,
      enableForeignKeys: true
    }

    // Reset all mocks
    vi.clearAllMocks()
    
    // Create test database instance
    db = new GraphDatabase(mockConfig)
  })

  afterEach(async () => {
    if (db) {
      await db.close()
    }
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultDb = new GraphDatabase({ path: ':memory:' })
      expect(defaultDb).toBeDefined()
    })

    it('should initialize with custom configuration', () => {
      expect(db).toBeDefined()
      const DatabaseMock = Database as any
      expect(DatabaseMock).toHaveBeenCalledWith(':memory:')
    })

    it('should create database schema on initialization', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn(),
          get: vi.fn(),
          all: vi.fn()
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()

      expect(mockDbInstance.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS nodes'))
    })

    it('should handle initialization errors', async () => {
      vi.mocked(Database).mockImplementationOnce(() => {
        throw new Error('Database initialization failed')
      })

      expect(() => new GraphDatabase({ path: ':memory:' })).toThrow('Database initialization failed')
    })
  })

  describe('Node Operations', () => {
    const testNode: Omit<MemoryNode, 'id' | 'createdAt' | 'updatedAt'> = {
      type: NodeType.ACTIVITY,
      timestamp: Date.now(),
      content: 'Test activity content',
      metadata: { source: 'test' },
      relevanceScore: 0.8,
      decayFactor: 0.1,
      degree: 0,
      clustering: 0,
      centrality: 0,
      tags: ['test', 'activity'],
      accessCount: 0,
      lastAccessed: Date.now(),
      confidence: 0.9,
      sourceType: 'event',
      isPruned: false
    }

    it('should create a new node successfully', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ lastInsertRowid: 'test-id' }),
          get: vi.fn().mockReturnValue({ id: 'test-id' })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const node = await testDb.createNode(testNode)
      
      expect(node).toBeDefined()
      expect(node.id).toBe('test-id')
      expect(node.type).toBe(NodeType.ACTIVITY)
      expect(node.content).toBe('Test activity content')
    })

    it('should update an existing node', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 }),
          get: vi.fn().mockReturnValue({
            id: 'test-id',
            type: NodeType.ACTIVITY,
            content: 'Updated content',
            timestamp: Date.now(),
            metadata: JSON.stringify({ source: 'test' }),
            relevance_score: 0.9,
            decay_factor: 0.1,
            degree: 1,
            clustering: 0,
            centrality: 0,
            tags: JSON.stringify(['test']),
            access_count: 1,
            last_accessed: Date.now(),
            confidence: 0.9,
            source_type: 'event',
            is_pruned: 0
          })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const updatedNode = await testDb.updateNode('test-id', {
        content: 'Updated content',
        relevanceScore: 0.9,
        accessCount: 1
      })
      
      expect(updatedNode).toBeDefined()
      expect(updatedNode.content).toBe('Updated content')
      expect(updatedNode.relevanceScore).toBe(0.9)
    })

    it('should throw error when updating non-existent node', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 0 }),
          get: vi.fn().mockReturnValue(null)
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      await expect(testDb.updateNode('non-existent-id', { content: 'test' }))
        .rejects.toThrow('Node not found: non-existent-id')
    })

    it('should delete a node successfully', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      await expect(testDb.deleteNode('test-id')).resolves.not.toThrow()
    })

    it('should get a node by ID', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({
            id: 'test-id',
            type: NodeType.ACTIVITY,
            content: 'Test content',
            timestamp: Date.now(),
            metadata: JSON.stringify({ source: 'test' }),
            relevance_score: 0.8,
            decay_factor: 0.1,
            degree: 0,
            clustering: 0,
            centrality: 0,
            tags: JSON.stringify(['test']),
            access_count: 0,
            last_accessed: Date.now(),
            confidence: 0.9,
            source_type: 'event',
            is_pruned: 0
          })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const node = await testDb.getNode('test-id')
      
      expect(node).toBeDefined()
      expect(node.id).toBe('test-id')
      expect(node.content).toBe('Test content')
    })

    it('should return null for non-existent node', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(null)
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const node = await testDb.getNode('non-existent-id')
      expect(node).toBeNull()
    })
  })

  describe('Edge Operations', () => {
    const testEdge: Omit<MemoryEdge, 'id' | 'createdAt' | 'updatedAt'> = {
      sourceId: 'node1',
      targetId: 'node2',
      type: EdgeType.TEMPORAL,
      weight: 0.8,
      metadata: { relationship: 'follows' },
      temporal: { start: Date.now(), end: Date.now() + 1000 },
      confidence: 0.9,
      isBidirectional: false
    }

    it('should create a new edge successfully', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ lastInsertRowid: 'edge-id' }),
          get: vi.fn().mockReturnValue({ id: 'edge-id' })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const edge = await testDb.createEdge(testEdge, 'node1', 'node2')
      
      expect(edge).toBeDefined()
      expect(edge.id).toBe('edge-id')
      expect(edge.type).toBe(EdgeType.TEMPORAL)
      expect(edge.sourceId).toBe('node1')
      expect(edge.targetId).be('node2')
    })

    it('should update an existing edge', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 }),
          get: vi.fn().mockReturnValue({
            id: 'edge-id',
            source_id: 'node1',
            target_id: 'node2',
            type: EdgeType.SEMANTIC,
            weight: 0.9,
            metadata: JSON.stringify({ updated: true }),
            temporal: JSON.stringify({ start: Date.now() }),
            confidence: 0.95,
            is_bidirectional: 1
          })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const updatedEdge = await testDb.updateEdge('edge-id', {
        weight: 0.9,
        metadata: { updated: true }
      })
      
      expect(updatedEdge).toBeDefined()
      expect(updatedEdge.weight).toBe(0.9)
      expect(updatedEdge.metadata.updated).toBe(true)
    })

    it('should delete an edge successfully', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      await expect(testDb.deleteEdge('edge-id')).resolves.not.toThrow()
    })

    it('should get edges for a node', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            {
              id: 'edge1',
              source_id: 'node1',
              target_id: 'node2',
              type: EdgeType.TEMPORAL,
              weight: 0.8,
              metadata: '{}',
              temporal: '{}',
              confidence: 0.9,
              is_bidirectional: 0
            }
          ])
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const edges = await testDb.getEdgesForNode('node1')
      
      expect(edges).toHaveLength(1)
      expect(edges[0].sourceId).toBe('node1')
      expect(edges[0].targetId).toBe('node2')
    })
  })

  describe('Query Operations', () => {
    it('should query nodes with filters', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            {
              id: 'node1',
              type: NodeType.ACTIVITY,
              content: 'Test node',
              timestamp: Date.now(),
              metadata: '{}',
              relevance_score: 0.8,
              decay_factor: 0.1,
              degree: 0,
              clustering: 0,
              centrality: 0,
              tags: '["test"]',
              access_count: 0,
              last_accessed: Date.now(),
              confidence: 0.9,
              source_type: 'event',
              is_pruned: 0
            }
          ])
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const query = {
        id: 'test-query',
        type: 'node' as const,
        filters: [
          { field: 'type', operator: 'eq', value: NodeType.ACTIVITY },
          { field: 'relevance_score', operator: 'gt', value: 0.5 }
        ],
        constraints: [],
        limit: 10
      }
      
      const result = await testDb.queryNodes(query)
      
      expect(result.results).toHaveLength(1)
      expect(result.results[0].type).toBe(NodeType.ACTIVITY)
      expect(result.total).toBe(1)
    })

    it('should query edges with filters', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            {
              id: 'edge1',
              source_id: 'node1',
              target_id: 'node2',
              type: EdgeType.SEMANTIC,
              weight: 0.8,
              metadata: '{}',
              temporal: '{}',
              confidence: 0.9,
              is_bidirectional: 0
            }
          ])
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const query = {
        id: 'test-query',
        type: 'edge' as const,
        filters: [
          { field: 'type', operator: 'eq', value: EdgeType.SEMANTIC },
          { field: 'weight', operator: 'gte', value: 0.7 }
        ],
        constraints: [],
        limit: 10
      }
      
      const result = await testDb.queryEdges(query)
      
      expect(result.results).toHaveLength(1)
      expect(result.results[0].type).toBe(EdgeType.SEMANTIC)
      expect(result.total).toBe(1)
    })

    it('should handle empty query results', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([])
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const query = {
        id: 'test-query',
        type: 'node' as const,
        filters: [{ field: 'type', operator: 'eq', value: 'non-existent' }],
        constraints: [],
        limit: 10
      }
      
      const result = await testDb.queryNodes(query)
      
      expect(result.results).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('Batch Operations', () => {
    it('should execute batch operations successfully', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 })
        }),
        exec: vi.fn().mockReturnValue({}),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const operations = [
        { type: 'create', target: 'node', data: testNode },
        { type: 'update', target: 'node', id: 'test-id', data: { content: 'updated' } }
      ]
      
      const result = await testDb.batchOperations(operations)
      
      expect(result.affectedNodes).toBe(1)
      expect(result.affectedEdges).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle batch operation errors gracefully', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockImplementation(() => {
            throw new Error('Batch operation failed')
          })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const operations = [
        { type: 'create', target: 'node', data: testNode }
      ]
      
      const result = await testDb.batchOperations(operations)
      
      expect(result.affectedNodes).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBe('Batch operation failed')
    })
  })

  describe('Statistics and Maintenance', () => {
    it('should get database statistics', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn()
            .mockReturnValueOnce({ count: 100 })  // nodes count
            .mockReturnValueOnce({ count: 200 })  // edges count
            .mockReturnValueOnce({ count: 90 })   // active nodes count
            .mockReturnValueOnce({ count: 180 })  // active edges count
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const stats = await testDb.getStats()
      
      expect(stats.totalNodes).toBe(100)
      expect(stats.totalEdges).toBe(200)
      expect(stats.activeNodes).toBe(90)
      expect(stats.activeEdges).toBe(180)
    })

    it('should update statistics successfully', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn()
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      await expect(testDb.updateStats()).resolves.not.toThrow()
    })

    it('should vacuum database successfully', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn()
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      await expect(testDb.vacuum()).resolves.not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      vi.mocked(Database).mockImplementationOnce(() => {
        throw new Error('Connection failed')
      })

      expect(() => new GraphDatabase({ path: 'invalid-path' }))
        .toThrow('Connection failed')
    })

    it('should handle query execution errors', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockImplementation(() => {
            throw new Error('Query failed')
          })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const query = {
        id: 'test-query',
        type: 'node' as const,
        filters: [],
        constraints: [],
        limit: 10
      }
      
      await expect(testDb.queryNodes(query)).rejects.toThrow('Query failed')
    })

    it('should handle constraint violations', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockImplementation(() => {
            const error = new Error('Constraint violation')
            error.code = 'SQLITE_CONSTRAINT'
            throw error
          })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      await expect(testDb.createNode(testNode))
        .rejects.toThrow('Constraint violation')
    })
  })

  describe('Transaction Management', () => {
    it('should execute operations in transaction', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn()
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const transaction = async () => {
        await testDb.createNode(testNode)
        await testDb.createEdge(testEdge, 'node1', 'node2')
        return { success: true }
      }
      
      const result = await testDb.executeInTransaction(transaction)
      
      expect(result.success).toBe(true)
      expect(mockDbInstance.exec).toHaveBeenCalledWith('BEGIN TRANSACTION')
      expect(mockDbInstance.exec).toHaveBeenCalledWith('COMMIT')
    })

    it('should rollback transaction on error', async () => {
      const mockDbInstance = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockImplementation(() => {
            throw new Error('Transaction error')
          })
        }),
        exec: vi.fn(),
        close: vi.fn()
      }
      
      vi.mocked(Database).mockReturnValueOnce(mockDbInstance)

      const testDb = new GraphDatabase({ path: ':memory:' })
      await testDb.initialize()
      
      const transaction = async () => {
        await testDb.createNode(testNode)
        throw new Error('Transaction failed')
      }
      
      await expect(testDb.executeInTransaction(transaction))
        .rejects.toThrow('Transaction failed')
      
      expect(mockDbInstance.exec).toHaveBeenCalledWith('ROLLBACK')
    })
  })
})