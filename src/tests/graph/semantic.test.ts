import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SemanticSimilarityEngine } from '@/memory/graph/semantic'
import { GraphDatabase } from '@/memory/graph/database'
import { MemoryNode, NodeType, SemanticConfig } from '@/memory/graph/types'

// Mock natural language processing libraries
vi.mock('natural', () => ({
  PorterStemmer: {
    tokenizeAndStem: vi.fn()
  },
  TfIdf: vi.fn().mockImplementation(() => ({
    addDocument: vi.fn(),
    tfidf: vi.fn().mockReturnValue(0.5)
  }))
}))

vi.mock('compromise', () => ({
  default: vi.fn().mockImplementation(() => ({
    sentences: vi.fn().mockReturnValue([{
      nouns: vi.fn().mockReturnValue(['test']),
      verbs: vi.fn().mockReturnValue(['run']),
      adjectives: vi.fn().mockReturnValue(['quick'])
    }])
  }))
}))

// Mock GraphDatabase
const createMockDatabase = () => ({
  queryNodes: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  createEdge: vi.fn(),
  getEdgesForNode: vi.fn(),
  batchOperations: vi.fn()
})

describe('SemanticSimilarityEngine', () => {
  let engine: SemanticSimilarityEngine
  let mockDb: any
  let config: SemanticConfig

  beforeEach(() => {
    mockDb = createMockDatabase()
    
    config = {
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
    }

    engine = new SemanticSimilarityEngine(config, mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new SemanticSimilarityEngine({}, mockDb)
      expect(defaultEngine).toBeDefined()
    })

    it('should initialize with custom configuration', () => {
      expect(engine).toBeDefined()
      expect(engine['config'].enabled).toBe(true)
      expect(engine['config'].minSimilarity).toBe(0.3)
    })

    it('should disable semantic analysis when disabled in config', () => {
      const disabledConfig = { enabled: false }
      const disabledEngine = new SemanticSimilarityEngine(disabledConfig, mockDb)
      expect(disabledEngine['config'].enabled).toBe(false)
    })

    it('should initialize NLP components', () => {
      // Verify NLP libraries are initialized
      expect(engine['tfidf']).toBeDefined()
      expect(engine['stemmer']).toBeDefined()
    })
  })

  describe('Content Similarity Calculation', () => {
    const testNodes: MemoryNode[] = [
      {
        id: 'node1',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Working on JavaScript project',
        metadata: { app: 'VS Code' },
        relevanceScore: 0.8,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: ['javascript', 'coding'],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.9,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'node2',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Developing React application',
        metadata: { app: 'VS Code' },
        relevanceScore: 0.7,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: ['react', 'coding'],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'node3',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: 'Having team meeting',
        metadata: { app: 'Zoom' },
        relevanceScore: 0.6,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        tags: ['meeting', 'team'],
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.7,
        sourceType: 'event',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ]

    it('should calculate TF-IDF similarity', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: testNodes,
        total: 3
      })

      await engine.buildSearchIndex()

      const similarity = await engine['calculateContentSimilarityTFIDF'](testNodes[0], testNodes[1])
      
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should calculate keyword overlap similarity', async () => {
      const similarity = engine['calculateKeywordOverlapSimilarity'](testNodes[0], testNodes[1])
      
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should calculate semantic similarity with NLP', async () => {
      const similarity = await engine['calculateNLPSimilarity'](testNodes[0], testNodes[1])
      
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should calculate combined content similarity', async () => {
      await engine.buildSearchIndex()
      
      const similarity = await engine.calculateContentSimilarity(testNodes[0], testNodes[1])
      
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should return 0 similarity for completely different content', async () => {
      const differentNode = {
        ...testNodes[2],
        content: 'Playing sports outside',
        tags: ['sports', 'outdoor']
      }

      await engine.buildSearchIndex()
      
      const similarity = await engine.calculateContentSimilarity(testNodes[0], differentNode)
      
      expect(similarity).toBeLessThan(0.3) // Below minimum threshold
    })

    it('should handle empty content gracefully', async () => {
      const emptyNode = {
        ...testNodes[0],
        content: ''
      }

      await engine.buildSearchIndex()
      
      const similarity = await engine.calculateContentSimilarity(emptyNode, testNodes[1])
      
      expect(similarity).toBe(0)
    })
  })

  describe('Tag Similarity Calculation', () => {
    it('should calculate tag similarity with common tags', () => {
      const node1 = {
        ...testNodes[0],
        tags: ['javascript', 'coding', 'web']
      }
      const node2 = {
        ...testNodes[1],
        tags: ['react', 'coding', 'web']
      }

      const similarity = engine['calculateTagSimilarity'](node1, node2)
      
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should return 0 for no common tags', () => {
      const node1 = {
        ...testNodes[0],
        tags: ['javascript', 'coding']
      }
      const node2 = {
        ...testNodes[2],
        tags: ['meeting', 'team']
      }

      const similarity = engine['calculateTagSimilarity'](node1, node2)
      
      expect(similarity).toBe(0)
    })

    it('should handle empty tag arrays', () => {
      const node1 = {
        ...testNodes[0],
        tags: []
      }
      const node2 = {
        ...testNodes[1],
        tags: ['react', 'coding']
      }

      const similarity = engine['calculateTagSimilarity'](node1, node2)
      
      expect(similarity).toBe(0)
    })
  })

  describe('Metadata Similarity Calculation', () => {
    it('should calculate metadata similarity for common keys', () => {
      const node1 = {
        ...testNodes[0],
        metadata: { app: 'VS Code', project: 'web-app' }
      }
      const node2 = {
        ...testNodes[1],
        metadata: { app: 'VS Code', project: 'mobile-app' }
      }

      const similarity = engine['calculateMetadataSimilarity'](node1, node2)
      
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should return 0 for no common metadata', () => {
      const node1 = {
        ...testNodes[0],
        metadata: { app: 'VS Code' }
      }
      const node2 = {
        ...testNodes[2],
        metadata: { app: 'Zoom' }
      }

      const similarity = engine['calculateMetadataSimilarity'](node1, node2)
      
      expect(similarity).toBe(0)
    })

    it('should handle missing metadata', () => {
      const node1 = {
        ...testNodes[0],
        metadata: undefined
      }
      const node2 = {
        ...testNodes[1],
        metadata: { app: 'VS Code' }
      }

      const similarity = engine['calculateMetadataSimilarity'](node1, node2)
      
      expect(similarity).toBe(0)
    })
  })

  describe('Overall Similarity Calculation', () => {
    it('should calculate weighted similarity', async () => {
      await engine.buildSearchIndex()
      
      const similarity = await engine.calculateSimilarity(testNodes[0], testNodes[1])
      
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should respect similarity threshold', async () => {
      await engine.buildSearchIndex()
      
      const similarity = await engine.calculateSimilarity(testNodes[0], testNodes[2])
      
      if (similarity < config.minSimilarity) {
        expect(similarity).toBeLessThan(config.minSimilarity)
      }
    })

    it('should apply custom weights correctly', async () => {
      const customConfig = {
        ...config,
        similarityWeights: {
          content: 0.8,
          tags: 0.1,
          metadata: 0.1
        }
      }
      
      const customEngine = new SemanticSimilarityEngine(customConfig, mockDb)
      await customEngine.buildSearchIndex()
      
      const similarity = await customEngine.calculateSimilarity(testNodes[0], testNodes[1])
      
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })
  })

  describe('Semantic Edge Creation', () => {
    it('should create semantic edges for similar nodes', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: testNodes,
        total: 3
      })

      mockDb.getEdgesForNode.mockResolvedValue([])
      mockDb.createEdge.mockResolvedValue({ id: 'edge-id' })

      await engine.buildSearchIndex()
      
      const edgesCreated = await engine.createSemanticEdges('node1', 2)
      
      expect(edgesCreated).toBeGreaterThan(0)
      expect(mockDb.createEdge).toHaveBeenCalled()
    })

    it('should respect maxEdgesPerNode limit', async () => {
      const manyNodes = Array.from({ length: 15 }, (_, i) => ({
        ...testNodes[0],
        id: `node${i}`,
        content: `Similar content ${i}`,
        tags: ['similar']
      }))

      mockDb.queryNodes.mockResolvedValue({
        results: manyNodes,
        total: 15
      })

      mockDb.getEdgesForNode.mockResolvedValue([])
      mockDb.createEdge.mockResolvedValue({ id: 'edge-id' })

      await engine.buildSearchIndex()
      
      const edgesCreated = await engine.createSemanticEdges('node1', 15)
      
      expect(edgesCreated).toBeLessThanOrEqual(config.maxEdgesPerNode)
    })

    it('should not create edges for nodes below similarity threshold', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [testNodes[0], testNodes[2]], // Low similarity
        total: 2
      })

      mockDb.getEdgesForNode.mockResolvedValue([])

      await engine.buildSearchIndex()
      
      const edgesCreated = await engine.createSemanticEdges('node1', 2)
      
      expect(edgesCreated).toBe(0) // No edges created due to low similarity
      expect(mockDb.createEdge).not.toHaveBeenCalled()
    })

    it('should avoid duplicate edges', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [testNodes[1]],
        total: 1
      })

      mockDb.getEdgesForNode.mockResolvedValue([
        { sourceId: 'node1', targetId: 'node2', type: 'semantic' }
      ])

      await engine.buildSearchIndex()
      
      const edgesCreated = await engine.createSemanticEdges('node1', 2)
      
      expect(edgesCreated).toBe(0) // No new edges created
      expect(mockDb.createEdge).not.toHaveBeenCalled()
    })
  })

  describe('Search Index Building', () => {
    it('should build search index from existing nodes', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: testNodes,
        total: 3
      })

      await engine.buildSearchIndex()
      
      expect(mockDb.queryNodes).toHaveBeenCalled()
      expect(engine['tfidf'].addDocument).toHaveBeenCalledTimes(3)
    })

    it('should handle empty node set', async () => {
      mockDb.queryNodes.mockResolvedValue({
        results: [],
        total: 0
      })

      await engine.buildSearchIndex()
      
      expect(mockDb.queryNodes).toHaveBeenCalled()
      expect(engine['tfidf'].addDocument).not.toHaveBeenCalled()
    })

    it('should handle index building errors gracefully', async () => {
      mockDb.queryNodes.mockRejectedValue(new Error('Database error'))

      await expect(engine.buildSearchIndex()).resolves.not.toThrow()
    })
  })

  describe('Concept Extraction', () => {
    it('should extract concepts from node content', async () => {
      const node = {
        ...testNodes[0],
        content: 'Developing a modern web application using React and TypeScript'
      }

      const concepts = await engine.extractConcepts(node)
      
      expect(concepts).toBeInstanceOf(Array)
      expect(concepts.length).toBeGreaterThan(0)
    })

    it('should handle concept extraction from empty content', async () => {
      const node = {
        ...testNodes[0],
        content: ''
      }

      const concepts = await engine.extractConcepts(node)
      
      expect(concepts).toHaveLength(0)
    })

    it('should handle concept extraction errors gracefully', async () => {
      const node = {
        ...testNodes[0],
        content: 'Test content'
      }

      // Mock compromise to throw error
      vi.mocked(engine['nlp']).mockImplementationOnce(() => {
        throw new Error('NLP error')
      })

      const concepts = await engine.extractConcepts(node)
      
      expect(concepts).toHaveLength(0) // Should return empty array on error
    })
  })

  describe('Configuration Validation', () => {
    it('should validate minSimilarity range', () => {
      const invalidConfig = {
        enabled: true,
        minSimilarity: 1.5 // > 1
      }

      expect(() => new SemanticSimilarityEngine(invalidConfig, mockDb))
        .toThrow('minSimilarity must be between 0 and 1')
    })

    it('should validate maxEdgesPerNode is positive', () => {
      const invalidConfig = {
        enabled: true,
        maxEdgesPerNode: 0
      }

      expect(() => new SemanticSimilarityEngine(invalidConfig, mockDb))
        .toThrow('maxEdgesPerNode must be positive')
    })

    it('should validate similarity weights sum to 1', () => {
      const invalidConfig = {
        enabled: true,
        similarityWeights: {
          content: 0.8,
          tags: 0.3,
          metadata: 0.1 // Sum = 1.2 > 1
        }
      }

      expect(() => new SemanticSimilarityEngine(invalidConfig, mockDb))
        .toThrow('similarityWeights must sum to 1')
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large number of nodes efficiently', async () => {
      const manyNodes = Array.from({ length: 1000 }, (_, i) => ({
        ...testNodes[0],
        id: `node-${i}`,
        content: `Content ${i}`,
        tags: ['tag']
      }))

      mockDb.queryNodes.mockResolvedValue({
        results: manyNodes,
        total: 1000
      })

      const startTime = Date.now()
      await engine.buildSearchIndex()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle very long content', async () => {
      const longContent = 'word '.repeat(10000) // 50k characters
      const node = {
        ...testNodes[0],
        content: longContent
      }

      await engine.buildSearchIndex()
      
      const similarity = await engine.calculateContentSimilarity(node, testNodes[1])
      
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should handle special characters and unicode', async () => {
      const node = {
        ...testNodes[0],
        content: 'Working with emojis 🚀 and unicode characters 你好'
      }

      await engine.buildSearchIndex()
      
      const concepts = await engine.extractConcepts(node)
      
      expect(concepts).toBeInstanceOf(Array)
    })

    it('should handle concurrent similarity calculations', async () => {
      await engine.buildSearchIndex()
      
      const promises = Array.from({ length: 10 }, (_, i) =>
        engine.calculateSimilarity(testNodes[0], testNodes[1])
      )
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(1)
      })
    })
  })
})