import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OptimizedGraphDatabase } from '../memory/graph/optimized-database';
import { AdvancedRelevanceScoringEngine } from '../memory/graph/advanced-relevance';
import { PerformanceBenchmarkEngine, SpurBenchmarks } from '../performance/benchmark-engine';
import { NodeType, EdgeType } from '../types';
import fs from 'fs/promises';
import path from 'path';

// Mock external dependencies
vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => ({
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    }),
    close: vi.fn(),
    backup: vi.fn()
  }))
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockImplementation(() => `test-uuid-${Math.random()}`)
}));

describe('Optimized Algorithms Test Suite', () => {
  let mockDb: any;
  let optimizedDb: OptimizedGraphDatabase;
  let relevanceEngine: AdvancedRelevanceScoringEngine;
  let benchmarkEngine: PerformanceBenchmarkEngine;
  let testDbPath: string;

  beforeEach(async () => {
    // Setup test database path
    testDbPath = path.join(__dirname, 'test-optimized.db');
    
    // Mock database instance
    mockDb = {
      pragma: vi.fn(),
      exec: vi.fn(),
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn().mockReturnValue({
          id: 'test-node',
          type: 'activity',
          timestamp: Date.now(),
          content: '{"title":"Test Node","description":"Test description"}',
          metadata: '{"source":"test"}',
          relevance_score: 0.5,
          decay_factor: 0.1,
          degree: 5,
          clustering: 0.3,
          centrality: 0.4,
          community: 1,
          tags: '["test","node"]',
          embeddings: null,
          access_count: 10,
          last_accessed: Date.now() - 1000,
          confidence: 0.8,
          source_type: 'test',
          is_pruned: 0,
          spatial_data: null,
          search_vector: null,
          created_at: Date.now() - 5000,
          updated_at: Date.now()
        }),
        all: vi.fn().mockReturnValue([
          {
            id: 'test-node-1',
            type: 'activity',
            timestamp: Date.now(),
            content: '{"title":"Test Node 1"}',
            metadata: '{}',
            relevance_score: 0.7,
            decay_factor: 0.1,
            degree: 3,
            clustering: 0.2,
            centrality: 0.3,
            community: 1,
            tags: '["test"]',
            embeddings: null,
            access_count: 5,
            last_accessed: Date.now(),
            confidence: 0.8,
            source_type: 'test',
            is_pruned: 0,
            created_at: Date.now(),
            updated_at: Date.now()
          }
        ])
      }),
      close: vi.fn()
    };

    // Mock file system operations
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'readFile').mockResolvedValue('-- Test SQL schema');

    // Create optimized database instance
    optimizedDb = new OptimizedGraphDatabase({
      path: testDbPath,
      spatialExtension: true,
      enableFTS: true,
      cacheSize: 10000,
      pageCacheSize: 4096,
      memoryMappingSize: 268435456,
      maxConcurrency: 10,
      enableCompression: true
    });

    // Create relevance engine
    relevanceEngine = new AdvancedRelevanceScoringEngine({
      recencyWeight: 0.3,
      frequencyWeight: 0.2,
      interactionWeight: 0.2,
      semanticWeight: 0.15,
      centralityWeight: 0.1,
      spatialWeight: 0.05,
      temporalWeight: 0.05,
      timeDecayRate: 0.1,
      interactionBoost: 1.2,
      spatialDecayRate: 0.05,
      semanticThreshold: 0.5,
      spatialThreshold: 0.3,
      minRelevanceScore: 0.1,
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
      enableMLScoring: true,
      learningRate: 0.01,
      regularizationFactor: 0.001,
      batchSize: 50,
      cacheSize: 1000,
      parallelProcessing: true
    }, optimizedDb);

    // Create benchmark engine
    benchmarkEngine = new PerformanceBenchmarkEngine({
      iterations: 50,
      warmupIterations: 5,
      batchSize: 10,
      memoryThreshold: 512,
      cpuThreshold: 80,
      timeout: 10000,
      enableProfiling: true,
      trackMemory: true,
      detailedMetrics: true
    });
  });

  afterEach(async () => {
    // Cleanup
    vi.clearAllMocks();
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('OptimizedGraphDatabase', () => {
    describe('Database Configuration', () => {
      it('should configure database with performance optimizations', () => {
        // Verify pragma calls for optimization
        expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
        expect(mockDb.pragma).toHaveBeenCalledWith('synchronous = NORMAL');
        expect(mockDb.pragma).toHaveBeenCalledWith('cache_size = 10000');
        expect(mockDb.pragma).toHaveBeenCalledWith('mmap_size = 268435456');
        expect(mockDb.pragma).toHaveBeenCalledWith('temp_store = MEMORY');
      });

      it('should enable spatial and FTS extensions when configured', async () => {
        await optimizedDb.initialize();
        
        // Verify spatial and FTS initialization calls
        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(mockDb.exec).toHaveBeenCalledWith('COMMIT');
      });

      it('should handle spatial extension loading gracefully', async () => {
        // Mock spatial extension error
        const consoleSpy = vi.spyOn(console, 'warn');
        mockDb.exec.mockImplementationOnce(() => {
          throw new Error('Spatial extension not available');
        });

        await optimizedDb.initialize();
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load spatial extensions:', expect.any(Error));
      });
    });

    describe('Performance Optimized Operations', () => {
      it('should create prepared statements for performance', async () => {
        await optimizedDb.initialize();
        
        // Verify prepared statements were created
        const prepareCalls = mockDb.prepare.mock.calls;
        expect(prepareCalls.length).toBeGreaterThan(0);
        
        const statementNames = prepareCalls.map(call => call[0]);
        expect(statementNames).toContain('CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)');
        expect(statementNames).toContain('CREATE INDEX IF NOT EXISTS idx_nodes_timestamp ON nodes(timestamp)');
      });

      it('should use prepared statements for node operations', async () => {
        const testNode = {
          type: NodeType.ACTIVITY,
          timestamp: Date.now(),
          content: { title: 'Test Node', description: 'Test description' },
          metadata: { source: 'test' },
          relevanceScore: 0.5,
          decayFactor: 0.1,
          degree: 0,
          clustering: 0,
          centrality: 0,
          community: 0,
          tags: ['test'],
          embeddings: null,
          accessCount: 0,
          lastAccessed: Date.now(),
          confidence: 0.8,
          sourceType: 'test',
          isPruned: false
        };

        await optimizedDb.createNode(testNode);
        
        // Verify prepared statement was used
        const prepareCalls = mockDb.prepare.mock.calls;
        const createStatement = prepareCalls.find(call => call[0].includes('INSERT INTO nodes'));
        expect(createStatement).toBeDefined();
      });

      it('should implement query result caching', async () => {
        const query = {
          id: 'test-query',
          type: 'node' as const,
          filters: [{ field: 'type', operator: 'eq', value: 'activity' }],
          constraints: [],
          limit: 10
        };

        // First call should cache result
        const result1 = await optimizedDb.queryNodes(query);
        const result2 = await optimizedDb.queryNodes(query);
        
        // Results should be the same (from cache)
        expect(result1).toEqual(result2);
      });

      it('should support full text search', async () => {
        const searchResults = await optimizedDb.searchNodes('test query', 10);
        
        // Verify FTS query was constructed
        const prepareCalls = mockDb.prepare.mock.calls;
        const ftsQuery = prepareCalls.find(call => call[0].includes('node_fts MATCH'));
        expect(ftsQuery).toBeDefined();
      });
    });

    describe('Indexing Strategy', () => {
      it('should create comprehensive indexes for performance', async () => {
        await optimizedDb.initialize();
        
        const execCalls = mockDb.exec.mock.calls.map(call => call[0]);
        const indexStatements = execCalls.filter(call => call.includes('CREATE INDEX'));
        
        // Verify key indexes exist
        expect(indexStatements.some(stmt => stmt.includes('idx_nodes_type'))).toBe(true);
        expect(indexStatements.some(stmt => stmt.includes('idx_nodes_timestamp'))).toBe(true);
        expect(indexStatements.some(stmt => stmt.includes('idx_nodes_relevance'))).toBe(true);
        expect(indexStatements.some(stmt => stmt.includes('idx_edges_source'))).toBe(true);
        expect(indexStatements.some(stmt => stmt.includes('idx_tags_node'))).toBe(true);
      });

      it('should create composite indexes for complex queries', async () => {
        await optimizedDb.initialize();
        
        const execCalls = mockDb.exec.mock.calls.map(call => call[0]);
        const compositeIndex = execCalls.find(call => call.includes('idx_edges_composite'));
        
        expect(compositeIndex).toBeDefined();
        expect(compositeIndex).toContain('source_id, target_id, type');
      });
    });

    describe('Batch Operations', () => {
      it('should process batch operations efficiently', async () => {
        const operations = [
          {
            type: 'create' as const,
            target: 'node' as const,
            data: {
              type: NodeType.ACTIVITY,
              timestamp: Date.now(),
              content: { title: 'Batch Node 1' },
              metadata: {},
              relevanceScore: 0.5,
              decayFactor: 0.1,
              degree: 0,
              clustering: 0,
              centrality: 0,
              community: 0,
              tags: ['batch'],
              embeddings: null,
              accessCount: 0,
              lastAccessed: Date.now(),
              confidence: 0.8,
              sourceType: 'test',
              isPruned: false
            }
          },
          {
            type: 'create' as const,
            target: 'node' as const,
            data: {
              type: NodeType.RESOURCE,
              timestamp: Date.now(),
              content: { title: 'Batch Node 2' },
              metadata: {},
              relevanceScore: 0.6,
              decayFactor: 0.1,
              degree: 0,
              clustering: 0,
              centrality: 0,
              community: 0,
              tags: ['batch'],
              embeddings: null,
              accessCount: 0,
              lastAccessed: Date.now(),
              confidence: 0.8,
              sourceType: 'test',
              isPruned: false
            }
          }
        ];

        const result = await optimizedDb.batchOperations(operations);
        
        expect(result.success).toBe(true);
        expect(result.affectedNodes).toBe(2);
        expect(result.affectedEdges).toBe(0);
      });

      it('should handle batch operation errors gracefully', async () => {
        // Mock batch operation failure
        mockDb.exec.mockImplementationOnce(() => {
          throw new Error('Batch operation failed');
        });

        const operations = [
          {
            type: 'create' as const,
            target: 'node' as const,
            data: {
              type: NodeType.ACTIVITY,
              timestamp: Date.now(),
              content: { title: 'Error Node' },
              metadata: {},
              relevanceScore: 0.5,
              decayFactor: 0.1,
              degree: 0,
              clustering: 0,
              centrality: 0,
              community: 0,
              tags: ['error'],
              embeddings: null,
              accessCount: 0,
              lastAccessed: Date.now(),
              confidence: 0.8,
              sourceType: 'test',
              isPruned: false
            }
          }
        ];

        const result = await optimizedDb.batchOperations(operations);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Batch operation failed');
      });
    });

    describe('Performance Monitoring', () => {
      it('should track query performance metrics', async () => {
        const query = {
          id: 'performance-test',
          type: 'node' as const,
          filters: [{ field: 'type', operator: 'eq', value: 'activity' }],
          constraints: [],
          limit: 5
        };

        await optimizedDb.queryNodes(query);
        
        const metrics = optimizedDb.getPerformanceMetrics();
        
        expect(metrics.queryTimes.has('queryNodes')).toBe(true);
        expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
        expect(metrics.cacheHitRate).toBeLessThanOrEqual(1);
      });

      it('should update performance metrics on each operation', async () => {
        const testNode = {
          type: NodeType.ACTIVITY,
          timestamp: Date.now(),
          content: { title: 'Performance Test' },
          metadata: {},
          relevanceScore: 0.5,
          decayFactor: 0.1,
          degree: 0,
          clustering: 0,
          centrality: 0,
          community: 0,
          tags: ['performance'],
          embeddings: null,
          accessCount: 0,
          lastAccessed: Date.now(),
          confidence: 0.8,
          sourceType: 'test',
          isPruned: false
        };

        await optimizedDb.createNode(testNode);
        
        const metrics = optimizedDb.getPerformanceMetrics();
        
        expect(metrics.queryTimes.has('createNode')).toBe(true);
        expect(Array.isArray(metrics.queryTimes.get('createNode'))).toBe(true);
      });
    });
  });

  describe('AdvancedRelevanceScoringEngine', () => {
    describe('Advanced Relevance Calculation', () => {
      it('should calculate comprehensive relevance factors', async () => {
        const testNode = {
          id: 'test-node-advanced',
          type: NodeType.ACTIVITY,
          timestamp: Date.now() - 3600000, // 1 hour ago
          content: { title: 'Advanced Relevance Test', description: 'Testing advanced relevance scoring' },
          metadata: { source: 'test', category: 'performance' },
          relevanceScore: 0.5,
          decayFactor: 0.1,
          degree: 8,
          clustering: 0.4,
          centrality: 0.6,
          community: 2,
          tags: ['test', 'relevance', 'advanced'],
          embeddings: new Float32Array(128).fill(0.5),
          accessCount: 15,
          lastAccessed: Date.now() - 1800000, // 30 minutes ago
          confidence: 0.9,
          sourceType: 'test',
          isPruned: false,
          createdAt: Date.now() - 7200000, // 2 hours ago
          updatedAt: Date.now()
        };

        const context = {
          queryTerms: ['test', 'relevance', 'performance'],
          timeRange: { start: Date.now() - 86400000, end: Date.now() }, // Last 24 hours
          userPreferences: { priority: 'high' },
          sessionContext: 'test-session',
          currentActivity: 'performance testing',
          recentInteractions: ['test-node-1', 'test-node-2']
        };

        const score = await relevanceEngine.calculateNodeRelevance(testNode, context);
        
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
        expect(score).toBeGreaterThan(0.3); // Should have reasonable relevance
      });

      it('should handle different time scales in recency calculation', async () => {
        const recentNode = {
          id: 'recent-node',
          type: NodeType.ACTIVITY,
          timestamp: Date.now() - 60000, // 1 minute ago
          content: { title: 'Recent Node' },
          metadata: {},
          relevanceScore: 0.5,
          decayFactor: 0.1,
          degree: 5,
          clustering: 0.3,
          centrality: 0.4,
          community: 1,
          tags: ['recent'],
          embeddings: null,
          accessCount: 3,
          lastAccessed: Date.now() - 30000,
          confidence: 0.8,
          sourceType: 'test',
          isPruned: false,
          createdAt: Date.now() - 60000,
          updatedAt: Date.now()
        };

        const oldNode = {
          id: 'old-node',
          type: NodeType.ACTIVITY,
          timestamp: Date.now() - 604800000, // 1 week ago
          content: { title: 'Old Node' },
          metadata: {},
          relevanceScore: 0.5,
          decayFactor: 0.1,
          degree: 5,
          clustering: 0.3,
          centrality: 0.4,
          community: 1,
          tags: ['old'],
          embeddings: null,
          accessCount: 3,
          lastAccessed: Date.now() - 604800000,
          confidence: 0.8,
          sourceType: 'test',
          isPruned: false,
          createdAt: Date.now() - 604800000,
          updatedAt: Date.now()
        };

        const recentScore = await relevanceEngine.calculateNodeRelevance(recentNode);
        const oldScore = await relevanceEngine.calculateNodeRelevance(oldNode);
        
        expect(recentScore).toBeGreaterThan(oldScore);
      });

      it('should calculate spatial relevance when location context is provided', async () => {
        const nodeWithLocation = {
          id: 'spatial-node',
          type: NodeType.RESOURCE,
          timestamp: Date.now(),
          content: { title: 'Spatial Test Node' },
          metadata: { location: { lat: 37.7749, lng: -122.4194 } }, // San Francisco
          relevanceScore: 0.5,
          decayFactor: 0.1,
          degree: 3,
          clustering: 0.2,
          centrality: 0.3,
          community: 1,
          tags: ['spatial', 'location'],
          embeddings: null,
          accessCount: 5,
          lastAccessed: Date.now(),
          confidence: 0.8,
          sourceType: 'test',
          isPruned: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const context = {
          spatialContext: { lat: 37.7849, lng: -122.4094, radius: 10 }, // Near San Francisco
          queryTerms: ['spatial', 'test']
        };

        const score = await relevanceEngine.calculateNodeRelevance(nodeWithLocation, context);
        
        expect(score).toBeGreaterThan(0);
      });

      it('should apply machine learning correction when enabled', async () => {
        const testNode = {
          id: 'ml-test-node',
          type: NodeType.ACTIVITY,
          timestamp: Date.now(),
          content: { title: 'ML Test Node' },
          metadata: {},
          relevanceScore: 0.5,
          decayFactor: 0.1,
          degree: 5,
          clustering: 0.3,
          centrality: 0.4,
          community: 1,
          tags: ['ml', 'test'],
          embeddings: new Float32Array(128).fill(0.7),
          accessCount: 8,
          lastAccessed: Date.now(),
          confidence: 0.9,
          sourceType: 'test',
          isPruned: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        // ML scoring should modify the base score
        const score = await relevanceEngine.calculateNodeRelevance(testNode);
        
        expect(score).toBeGreaterThanOrEqual(0.1); // minRelevanceScore
        expect(score).toBeLessThanOrEqual(1.0);
      });
    });

    describe('Batch Processing', () => {
      it('should process relevance updates in batches', async () => {
        const nodeIds = Array.from({ length: 100 }, (_, i) => `batch-node-${i}`);
        const context = {
          queryTerms: ['batch', 'test'],
          timeRange: { start: Date.now() - 86400000, end: Date.now() }
        };

        await relevanceEngine.batchUpdateNodeRelevance(nodeIds, context);
        
        // Verify the method completed without error
        expect(true).toBe(true); // If no error thrown, test passes
      });

      it('should support parallel processing for batch operations', async () => {
        // Test with parallel processing enabled
        const nodeIds = Array.from({ length: 50 }, (_, i) => `parallel-node-${i}`);
        
        const startTime = Date.now();
        await relevanceEngine.batchUpdateNodeRelevance(nodeIds);
        const endTime = Date.now();
        
        // Parallel processing should be reasonably fast
        expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
      });
    });

    describe('Interaction Tracking', () => {
      it('should record user interactions and update relevance', async () => {
        const nodeId = 'interaction-test-node';
        
        await relevanceEngine.recordUserInteraction(nodeId, 'click', 1.5, {
          sessionId: 'test-session',
          timestamp: Date.now()
        });

        // Verify interaction was recorded
        const history = relevanceEngine['userInteractionHistory'].get(nodeId);
        expect(history).toBeDefined();
        expect(history!.length).toBe(1);
      });

      it('should boost relevance score on interaction', async () => {
        const nodeId = 'boost-test-node';
        
        // Record multiple interactions
        await relevanceEngine.recordUserInteraction(nodeId, 'view', 1.0);
        await relevanceEngine.recordUserInteraction(nodeId, 'click', 1.5);
        await relevanceEngine.recordUserInteraction(nodeId, 'favorite', 2.0);

        // Verify interaction patterns were tracked
        const patterns = relevanceEngine['globalInteractionPatterns'];
        expect(patterns.has(`${nodeId}:view`)).toBe(true);
        expect(patterns.has(`${nodeId}:click`)).toBe(true);
        expect(patterns.has(`${nodeId}:favorite`)).toBe(true);
      });
    });

    describe('Advanced Statistics', () => {
      it('should generate comprehensive relevance statistics', async () => {
        const stats = await relevanceEngine.getAdvancedRelevanceStats();
        
        expect(stats.totalNodes).toBeGreaterThanOrEqual(0);
        expect(stats.averageScore).toBeGreaterThanOrEqual(0);
        expect(stats.averageScore).toBeLessThanOrEqual(1);
        expect(stats.distribution.high).toBeGreaterThanOrEqual(0);
        expect(stats.distribution.medium).toBeGreaterThanOrEqual(0);
        expect(stats.distribution.low).toBeGreaterThanOrEqual(0);
        expect(stats.performanceMetrics.avgQueryTime).toBeGreaterThanOrEqual(0);
        expect(stats.performanceMetrics.cacheHitRate).toBeGreaterThanOrEqual(0);
        expect(stats.performanceMetrics.cacheHitRate).toBeLessThanOrEqual(1);
      });

      it('should track performance metrics for each operation', async () => {
        const testNode = {
          id: 'metrics-test-node',
          type: NodeType.ACTIVITY,
          timestamp: Date.now(),
          content: { title: 'Metrics Test' },
          metadata: {},
          relevanceScore: 0.5,
          decayFactor: 0.1,
          degree: 5,
          clustering: 0.3,
          centrality: 0.4,
          community: 1,
          tags: ['metrics'],
          embeddings: null,
          accessCount: 3,
          lastAccessed: Date.now(),
          confidence: 0.8,
          sourceType: 'test',
          isPruned: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        // Perform operations
        await relevanceEngine.calculateNodeRelevance(testNode);
        await relevanceEngine.calculateNodeRelevance(testNode);

        const metrics = relevanceEngine['performanceMetrics'];
        expect(metrics.has('calculateNodeRelevance')).toBe(true);
        
        const measurements = metrics.get('calculateNodeRelevance')!;
        expect(measurements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PerformanceBenchmarkEngine', () => {
    describe('Benchmark Execution', () => {
      it('should run benchmark scenarios successfully', async () => {
        const profile = {
          name: 'Test Benchmark Suite',
          description: 'Test benchmark execution',
          scenarios: [
            {
              name: 'simple-operation',
              description: 'Simple operation benchmark',
              run: async (iteration: number) => {
                // Simulate some work
                await new Promise(resolve => setTimeout(resolve, 1));
                return { iteration, result: 'success' };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 100,
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        const results = await benchmarkEngine.runBenchmarkSuite(profile);
        
        expect(results.summary.totalTests).toBe(1);
        expect(results.summary.passedTests).toBe(1);
        expect(results.summary.failedTests).toBe(0);
        expect(results.results.length).toBe(1);
        expect(results.results[0].success).toBe(true);
      });

      it('should handle benchmark failures gracefully', async () => {
        const profile = {
          name: 'Failure Test Suite',
          description: 'Test failure handling',
          scenarios: [
            {
              name: 'failing-operation',
              description: 'Operation that always fails',
              run: async (iteration: number) => {
                throw new Error('Simulated benchmark failure');
              }
            }
          ],
          thresholds: {
            maxResponseTime: 100,
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        const results = await benchmarkEngine.runBenchmarkSuite(profile);
        
        expect(results.summary.totalTests).toBe(1);
        expect(results.summary.passedTests).toBe(0);
        expect(results.summary.failedTests).toBe(1);
        expect(results.results.length).toBe(1);
        expect(results.results[0].success).toBe(false);
        expect(results.results[0].error).toBeDefined();
      });

      it('should execute warmup iterations before main benchmark', async () => {
        const warmupCalls: number[] = [];
        
        const profile = {
          name: 'Warmup Test Suite',
          description: 'Test warmup functionality',
          scenarios: [
            {
              name: 'warmup-operation',
              description: 'Operation with warmup',
              run: async (iteration: number) => {
                warmupCalls.push(iteration);
                await new Promise(resolve => setTimeout(resolve, 1));
                return { iteration };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 100,
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        const benchmarkEngineWithWarmup = new PerformanceBenchmarkEngine({
          iterations: 5,
          warmupIterations: 3,
          batchSize: 1,
          memoryThreshold: 512,
          cpuThreshold: 80,
          timeout: 10000,
          enableProfiling: true,
          trackMemory: true,
          detailedMetrics: true
        });

        await benchmarkEngineWithWarmup.runBenchmarkSuite(profile);
        
        // Should have 3 warmup + 5 main iterations
        expect(warmupCalls.length).toBe(8);
        expect(warmupCalls.slice(0, 3)).toEqual([0, 1, 2]); // Warmup iterations
        expect(warmupCalls.slice(3)).toEqual([0, 1, 2, 3, 4]); // Main iterations
      });
    });

    describe('Performance Metrics', () => {
      it('should collect detailed performance metrics', async () => {
        const profile = {
          name: 'Metrics Test Suite',
          description: 'Test metrics collection',
          scenarios: [
            {
              name: 'metrics-operation',
              description: 'Operation for metrics testing',
              run: async (iteration: number) => {
                // Simulate variable performance
                const delay = 1 + Math.random() * 5; // 1-6ms
                await new Promise(resolve => setTimeout(resolve, delay));
                return { iteration, delay };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 100,
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        const results = await benchmarkEngine.runBenchmarkSuite(profile);
        const result = results.results[0];
        
        expect(result.iterations).toBeGreaterThan(0);
        expect(result.averageTime).toBeGreaterThan(0);
        expect(result.minTime).toBeGreaterThan(0);
        expect(result.maxTime).toBeGreaterThanOrEqual(result.minTime);
        expect(result.medianTime).toBeGreaterThan(0);
        expect(result.percentile95).toBeGreaterThan(0);
        expect(result.percentile99).toBeGreaterThan(0);
        expect(result.standardDeviation).toBeGreaterThan(0);
        expect(result.throughput).toBeGreaterThan(0);
        expect(result.memoryUsage.before).toBeGreaterThanOrEqual(0);
        expect(result.memoryUsage.after).toBeGreaterThanOrEqual(0);
      });

      it('should calculate statistical measures correctly', async () => {
        // Mock consistent performance
        const profile = {
          name: 'Statistics Test Suite',
          description: 'Test statistical calculations',
          scenarios: [
            {
              name: 'consistent-operation',
              description: 'Operation with consistent timing',
              run: async (iteration: number) => {
                await new Promise(resolve => setTimeout(resolve, 10)); // Consistent 10ms
                return { iteration };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 100,
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        const results = await benchmarkEngine.runBenchmarkSuite(profile);
        const result = results.results[0];
        
        // With consistent 10ms timing, measures should be close to 10ms
        expect(result.averageTime).toBeCloseTo(10, 1);
        expect(result.medianTime).toBeCloseTo(10, 1);
        expect(result.standardDeviation).toBeLessThan(2); // Low variance
        expect(result.percentile95).toBeCloseTo(10, 2);
        expect(result.percentile99).toBeCloseTo(10, 2);
      });
    });

    describe('Threshold Validation', () => {
      it('should validate performance against thresholds', async () => {
        // Mock slow operation that exceeds thresholds
        const profile = {
          name: 'Threshold Test Suite',
          description: 'Test threshold validation',
          scenarios: [
            {
              name: 'slow-operation',
              description: 'Operation that exceeds thresholds',
              run: async (iteration: number) => {
                await new Promise(resolve => setTimeout(resolve, 200)); // 200ms - exceeds threshold
                return { iteration };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 50, // 50ms threshold
            minThroughput: 20,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        const results = await benchmarkEngine.runBenchmarkSuite(profile);
        const result = results.results[0];
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Response time too high');
      });

      it('should pass when all thresholds are met', async () => {
        const profile = {
          name: 'Threshold Pass Suite',
          description: 'Test threshold passing',
          scenarios: [
            {
              name: 'fast-operation',
              description: 'Operation that meets thresholds',
              run: async (iteration: number) => {
                await new Promise(resolve => setTimeout(resolve, 5)); // 5ms - well under threshold
                return { iteration };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 50, // 50ms threshold
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        const results = await benchmarkEngine.runBenchmarkSuite(profile);
        const result = results.results[0];
        
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('Report Generation', () => {
      it('should generate comprehensive performance reports', async () => {
        const profile = {
          name: 'Report Test Suite',
          description: 'Test report generation',
          scenarios: [
            {
              name: 'report-operation',
              description: 'Operation for report testing',
              run: async (iteration: number) => {
                await new Promise(resolve => setTimeout(resolve, 2));
                return { iteration };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 100,
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        await benchmarkEngine.runBenchmarkSuite(profile);
        const report = benchmarkEngine.generateReport();
        
        expect(report).toContain('# Spur Performance Benchmark Report');
        expect(report).toContain('## Summary');
        expect(report).toContain('## Detailed Results');
        expect(report).toContain('Total Tests:');
        expect(report).toContain('Passed Tests:');
        expect(report).toContain('Failed Tests:');
        expect(report).toContain('Overall Score:');
      });

      it('should export results in JSON format', async () => {
        const profile = {
          name: 'Export Test Suite',
          description: 'Test result export',
          scenarios: [
            {
              name: 'export-operation',
              description: 'Operation for export testing',
              run: async (iteration: number) => {
                await new Promise(resolve => setTimeout(resolve, 1));
                return { iteration };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 100,
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        await benchmarkEngine.runBenchmarkSuite(profile);
        const exported = benchmarkEngine.exportResults();
        
        expect(exported.timestamp).toBeDefined();
        expect(exported.config).toBeDefined();
        expect(exported.results).toBeDefined();
        expect(exported.systemMetrics).toBeDefined();
        expect(exported.summary).toBeDefined();
        expect(Array.isArray(exported.results)).toBe(true);
      });
    });
  });

  describe('SpurBenchmarks', () => {
    describe('Database Benchmarks', () => {
      it('should provide database-specific benchmark scenarios', () => {
        const dbBenchmarks = SpurBenchmarks.getDatabaseBenchmarks(optimizedDb);
        
        expect(dbBenchmarks).toHaveLength(3);
        expect(dbBenchmarks[0].name).toBe('node_creation');
        expect(dbBenchmarks[1].name).toBe('node_query');
        expect(dbBenchmarks[2].name).toBe('batch_operations');
        
        // Verify scenarios have required properties
        dbBenchmarks.forEach(scenario => {
          expect(scenario.name).toBeDefined();
          expect(scenario.description).toBeDefined();
          expect(scenario.run).toBeInstanceOf(Function);
        });
      });

      it('should include setup and teardown phases where appropriate', () => {
        const dbBenchmarks = SpurBenchmarks.getDatabaseBenchmarks(optimizedDb);
        
        // Node query benchmark should have setup phase
        const queryBenchmark = dbBenchmarks.find(b => b.name === 'node_query');
        expect(queryBenchmark?.setup).toBeDefined();
        expect(queryBenchmark?.run).toBeDefined();
        
        // Node creation should not need setup
        const creationBenchmark = dbBenchmarks.find(b => b.name === 'node_creation');
        expect(creationBenchmark?.setup).toBeUndefined();
        expect(creationBenchmark?.run).toBeDefined();
      });
    });

    describe('Relevance Benchmarks', () => {
      it('should provide relevance-specific benchmark scenarios', () => {
        const relevanceBenchmarks = SpurBenchmarks.getRelevanceBenchmarks(relevanceEngine);
        
        expect(relevanceBenchmarks).toHaveLength(2);
        expect(relevanceBenchmarks[0].name).toBe('relevance_calculation');
        expect(relevanceBenchmarks[1].name).toBe('batch_relevance_update');
        
        // Verify scenarios have required properties
        relevanceBenchmarks.forEach(scenario => {
          expect(scenario.name).toBeDefined();
          expect(scenario.description).toBeDefined();
          expect(scenario.run).toBeInstanceOf(Function);
        });
      });

      it('should test different relevance calculation scenarios', async () => {
        const relevanceBenchmarks = SpurBenchmarks.getRelevanceBenchmarks(relevanceEngine);
        const calculationBenchmark = relevanceBenchmarks[0];
        
        // Test the relevance calculation scenario
        const result = await calculationBenchmark.run(1);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should integrate optimized database with relevance engine', async () => {
      const testNode = {
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: { title: 'Integration Test Node' },
        metadata: { source: 'integration-test' },
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 0,
        clustering: 0,
        centrality: 0,
        community: 0,
        tags: ['integration', 'test'],
        embeddings: null,
        accessCount: 0,
        lastAccessed: Date.now(),
        confidence: 0.8,
        sourceType: 'test',
        isPruned: false
      };

      // Create node in optimized database
      const createdNode = await optimizedDb.createNode(testNode);
      
      // Calculate relevance using advanced engine
      const context = {
        queryTerms: ['integration', 'test'],
        timeRange: { start: Date.now() - 86400000, end: Date.now() },
        userPreferences: { priority: 'medium' }
      };
      
      const relevanceScore = await relevanceEngine.calculateNodeRelevance(createdNode, context);
      
      expect(relevanceScore).toBeGreaterThanOrEqual(0);
      expect(relevanceScore).toBeLessThanOrEqual(1);
    });

    it('should handle large dataset performance testing', async () => {
      // Create large dataset benchmark
      const profile = {
        name: 'Large Dataset Performance',
        description: 'Test performance with large datasets',
        scenarios: [
          {
            name: 'large-dataset-query',
            description: 'Query performance with 1000+ nodes',
            setup: async () => {
              // Simulate large dataset creation
              for (let i = 0; i < 1000; i++) {
                await optimizedDb.createNode({
                  type: NodeType.ACTIVITY,
                  timestamp: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
                  content: { title: `Large Dataset Node ${i}` },
                  metadata: { index: i },
                  relevanceScore: Math.random(),
                  decayFactor: 0.1,
                  degree: Math.floor(Math.random() * 20),
                  clustering: Math.random(),
                  centrality: Math.random(),
                  community: Math.floor(Math.random() * 10),
                  tags: ['large', 'dataset', `tag${i % 20}`],
                  embeddings: null,
                  accessCount: Math.floor(Math.random() * 50),
                  lastAccessed: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
                  confidence: Math.random(),
                  sourceType: 'test',
                  isPruned: false
                });
              }
            },
            run: async (iteration: number) => {
              const query = {
                id: `large-query-${iteration}`,
                type: 'node' as const,
                filters: [
                  { field: 'type', operator: 'eq', value: 'activity' },
                  { field: 'is_pruned', operator: 'eq', value: false }
                ],
                constraints: [],
                limit: 100,
                sortBy: [{ field: 'relevance_score', direction: 'desc' as const }]
              };
              return await optimizedDb.queryNodes(query);
            }
          }
        ],
        thresholds: {
          maxResponseTime: 500, // Higher threshold for large dataset
          minThroughput: 2,
          maxMemoryUsage: 200,
          maxCpuUsage: 90
        }
      };

      const results = await benchmarkEngine.runBenchmarkSuite(profile);
      
      expect(results.summary.totalTests).toBe(1);
      expect(results.results.length).toBe(1);
      
      const result = results.results[0];
      expect(result.success).toBe(true);
      expect(result.iterations).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database initialization failure
      mockDb.exec.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      await expect(optimizedDb.initialize()).rejects.toThrow('Database connection failed');
    });

    it('should handle relevance calculation with missing context', async () => {
      const testNode = {
        id: 'no-context-node',
        type: NodeType.ACTIVITY,
        timestamp: Date.now(),
        content: { title: 'No Context Test' },
        metadata: {},
        relevanceScore: 0.5,
        decayFactor: 0.1,
        degree: 3,
        clustering: 0.2,
        centrality: 0.3,
        community: 1,
        tags: ['test'],
        embeddings: null,
        accessCount: 5,
        lastAccessed: Date.now(),
        confidence: 0.7,
        sourceType: 'test',
        isPruned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Should work without context
      const score = await relevanceEngine.calculateNodeRelevance(testNode);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle benchmark timeout scenarios', async () => {
      const profile = {
        name: 'Timeout Test Suite',
        description: 'Test timeout handling',
        scenarios: [
            {
              name: 'timeout-operation',
              description: 'Operation that times out',
              run: async (iteration: number) => {
                // Simulate long-running operation
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
                return { iteration };
              }
            }
          ],
          thresholds: {
            maxResponseTime: 100,
            minThroughput: 10,
            maxMemoryUsage: 100,
            maxCpuUsage: 80
          }
        };

        const benchmarkEngineWithShortTimeout = new PerformanceBenchmarkEngine({
          iterations: 5,
          warmupIterations: 0,
          batchSize: 1,
          memoryThreshold: 512,
          cpuThreshold: 80,
          timeout: 100, // 100ms timeout
          enableProfiling: true,
          trackMemory: true,
          detailedMetrics: true
        });

        const results = await benchmarkEngineWithShortTimeout.runBenchmarkSuite(profile);
        const result = results.results[0];
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      });

    it('should handle memory pressure scenarios', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      vi.stubGlobal('process', {
        ...process,
        memoryUsage: () => ({
          heapUsed: 800 * 1024 * 1024, // 800MB - over threshold
          heapTotal: 1000 * 1024 * 1024,
          external: 50 * 1024 * 1024,
          rss: 900 * 1024 * 1024
        })
      });

      const systemHealth = await benchmarkEngine['checkSystemHealth']();
      
      expect(systemHealth.healthy).toBe(false);
      expect(systemHealth.issues.some(issue => issue.includes('High memory usage'))).toBe(true);

      // Restore original function
      vi.unstubAllGlobals();
    });
  });
});