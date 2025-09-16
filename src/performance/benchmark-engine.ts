import { performance } from 'perf_hooks';
import { OptimizedGraphDatabase } from '../memory/graph/optimized-database';
import { AdvancedRelevanceScoringEngine } from '../memory/graph/advanced-relevance';

export interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  batchSize: number;
  memoryThreshold: number; // MB
  cpuThreshold: number; // percentage
  timeout: number; // ms
  enableProfiling: boolean;
  trackMemory: boolean;
  detailedMetrics: boolean;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  percentile95: number;
  percentile99: number;
  standardDeviation: number;
  memoryUsage: {
    before: number;
    after: number;
    delta: number;
    peak: number;
  };
  cpuUsage: {
    average: number;
    peak: number;
  };
  throughput: number; // operations per second
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  timestamp: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
    total: number;
  };
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
}

export interface PerformanceProfile {
  name: string;
  description: string;
  scenarios: BenchmarkScenario[];
  thresholds: {
    maxResponseTime: number;
    minThroughput: number;
    maxMemoryUsage: number;
    maxCpuUsage: number;
  };
}

export interface BenchmarkScenario {
  name: string;
  description: string;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  run: (iteration: number) => Promise<any>;
  cleanup?: (result: any) => Promise<void>;
}

/**
 * Comprehensive performance benchmarking engine for the Spur super app
 * Provides detailed performance analysis, bottleneck detection, and optimization insights
 */
export class PerformanceBenchmarkEngine {
  private config: BenchmarkConfig;
  private systemMetrics: SystemMetrics[] = [];
  private results: BenchmarkResult[] = [];
  private isRunning = false;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      iterations: 100,
      warmupIterations: 10,
      batchSize: 10,
      memoryThreshold: 512, // 512MB
      cpuThreshold: 80, // 80%
      timeout: 30000, // 30 seconds
      enableProfiling: true,
      trackMemory: true,
      detailedMetrics: true,
      ...config
    };
  }

  /**
   * Run a complete performance benchmark suite
   */
  async runBenchmarkSuite(profile: PerformanceProfile): Promise<{
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      totalTime: number;
      overallScore: number;
    };
    results: BenchmarkResult[];
    systemMetrics: SystemMetrics[];
    recommendations: string[];
  }> {
    if (this.isRunning) {
      throw new Error('Benchmark is already running');
    }

    this.isRunning = true;
    this.systemMetrics = [];
    this.results = [];

    try {
      const startTime = performance.now();
      console.log(`🚀 Starting benchmark suite: ${profile.name}`);
      
      // System health check
      const systemHealth = await this.checkSystemHealth();
      if (!systemHealth.healthy) {
        throw new Error(`System not ready for benchmarking: ${systemHealth.issues.join(', ')}`);
      }

      // Run each scenario
      for (const scenario of profile.scenarios) {
        console.log(`🔍 Running scenario: ${scenario.name}`);
        
        try {
          const result = await this.runScenario(scenario, profile.thresholds);
          this.results.push(result);
          
          if (result.success) {
            console.log(`✅ ${scenario.name}: ${result.averageTime.toFixed(2)}ms avg, ${result.throughput.toFixed(0)} ops/sec`);
          } else {
            console.log(`❌ ${scenario.name}: ${result.error}`);
          }
        } catch (error) {
          console.error(`💥 ${scenario.name} failed:`, error);
          this.results.push({
            name: scenario.name,
            iterations: 0,
            totalTime: 0,
            averageTime: 0,
            minTime: 0,
            maxTime: 0,
            medianTime: 0,
            percentile95: 0,
            percentile99: 0,
            standardDeviation: 0,
            memoryUsage: { before: 0, after: 0, delta: 0, peak: 0 },
            cpuUsage: { average: 0, peak: 0 },
            throughput: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const totalTime = performance.now() - startTime;
      
      // Generate summary and recommendations
      const summary = this.generateSummary(profile, totalTime);
      const recommendations = this.generateRecommendations(profile, this.results);

      console.log(`📊 Benchmark suite completed in ${(totalTime / 1000).toFixed(2)}s`);
      
      return {
        summary,
        results: this.results,
        systemMetrics: this.systemMetrics,
        recommendations
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run a single benchmark scenario
   */
  private async runScenario(scenario: BenchmarkScenario, thresholds: any): Promise<BenchmarkResult> {
    const times: number[] = [];
    const memorySnapshots: number[] = [];
    let successCount = 0;
    let error: string | undefined;

    // Warmup phase
    if (this.config.warmupIterations > 0) {
      console.log(`  🔄 Warming up (${this.config.warmupIterations} iterations)`);
      for (let i = 0; i < this.config.warmupIterations; i++) {
        try {
          await scenario.run(i);
        } catch (warmupError) {
          console.warn(`Warmup iteration ${i} failed:`, warmupError);
        }
      }
    }

    // Setup phase
    if (scenario.setup) {
      await scenario.setup();
    }

    const initialMetrics = this.getSystemMetrics();
    const startTime = performance.now();

    try {
      // Main benchmark loop
      console.log(`  📈 Running ${this.config.iterations} iterations`);
      
      for (let i = 0; i < this.config.iterations; i++) {
        const iterationStart = performance.now();
        
        try {
          const result = await scenario.run(i);
          successCount++;
          
          if (scenario.cleanup) {
            await scenario.cleanup(result);
          }
        } catch (iterationError) {
          error = iterationError instanceof Error ? iterationError.message : String(iterationError);
        }

        const iterationEnd = performance.now();
        const iterationTime = iterationEnd - iterationStart;
        times.push(iterationTime);

        // Track memory usage
        if (this.config.trackMemory && i % 10 === 0) {
          const metrics = this.getSystemMetrics();
          memorySnapshots.push(metrics.memoryUsage.heapUsed);
        }

        // Collect system metrics periodically
        if (i % 20 === 0) {
          this.systemMetrics.push(this.getSystemMetrics());
        }

        // Timeout check
        if (iterationEnd - startTime > this.config.timeout) {
          error = `Benchmark timeout after ${this.config.timeout}ms`;
          break;
        }
      }
    } finally {
      // Teardown phase
      if (scenario.teardown) {
        await scenario.teardown();
      }
    }

    const finalMetrics = this.getSystemMetrics();
    const totalTime = performance.now() - startTime;

    // Calculate statistics
    const sortedTimes = [...times].sort((a, b) => a - b);
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const percentile95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const percentile99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);

    const memoryBefore = initialMetrics.memoryUsage.heapUsed;
    const memoryAfter = finalMetrics.memoryUsage.heapUsed;
    const peakMemory = Math.max(...memorySnapshots, memoryBefore, memoryAfter);

    // Calculate CPU usage (simplified)
    const cpuUsage = this.calculateCpuUsage(this.systemMetrics);

    const result: BenchmarkResult = {
      name: scenario.name,
      iterations: times.length,
      totalTime,
      averageTime,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      medianTime,
      percentile95,
      percentile99,
      standardDeviation,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        delta: memoryAfter - memoryBefore,
        peak: peakMemory
      },
      cpuUsage,
      throughput: times.length > 0 ? (times.length / (totalTime / 1000)) : 0,
      success: successCount === this.config.iterations,
      error
    };

    // Check against thresholds
    const thresholdIssues = this.checkThresholds(result, thresholds);
    if (thresholdIssues.length > 0) {
      result.success = false;
      result.error = thresholdIssues.join(', ');
    }

    return result;
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary(profile: PerformanceProfile, totalTime: number): any {
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.filter(r => !r.success).length;
    
    // Calculate overall score (0-100)
    let totalScore = 0;
    let maxScore = 0;
    
    for (const result of this.results) {
      maxScore += 100;
      if (result.success) {
        // Score based on performance relative to theoretical best
        const performanceScore = Math.min(100, (1000 / result.averageTime) * 100);
        const memoryScore = Math.max(0, 100 - (result.memoryUsage.peak / (1024 * 1024)) * 10);
        const score = (performanceScore + memoryScore) / 2;
        totalScore += score;
      }
    }
    
    const overallScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    return {
      totalTests: this.results.length,
      passedTests,
      failedTests,
      totalTime,
      overallScore: Math.round(overallScore),
      averagePerformance: this.calculateAveragePerformance()
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(profile: PerformanceProfile, results: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];

    // Analyze common patterns
    const slowOperations = results.filter(r => !r.success || r.averageTime > 100);
    const memoryIntensive = results.filter(r => r.memoryUsage.peak > 100 * 1024 * 1024); // 100MB
    const highCpuUsage = results.filter(r => r.cpuUsage.average > 50);

    if (slowOperations.length > 0) {
      recommendations.push(`⚡ Optimize slow operations: ${slowOperations.map(o => o.name).join(', ')}`);
      recommendations.push('  - Consider caching, indexing, or algorithm optimization');
    }

    if (memoryIntensive.length > 0) {
      recommendations.push(`🧠 High memory usage detected: ${memoryIntensive.map(o => o.name).join(', ')}`);
      recommendations.push('  - Implement memory pooling, streaming, or batch processing');
    }

    if (highCpuUsage.length > 0) {
      recommendations.push(`🔥 High CPU usage detected: ${highCpuUsage.map(o => o.name).join(', ')}`);
      recommendations.push('  - Consider parallelization, lazy loading, or code optimization');
    }

    // Specific optimization recommendations
    results.forEach(result => {
      if (result.averageTime > 50) {
        recommendations.push(`  - ${result.name}: Consider implementing caching or query optimization`);
      }
      
      if (result.standardDeviation > result.averageTime * 0.5) {
        recommendations.push(`  - ${result.name}: High variance detected - investigate inconsistent performance`);
      }
      
      if (result.memoryUsage.delta > 10 * 1024 * 1024) { // 10MB growth
        recommendations.push(`  - ${result.name}: Memory leak detected - check for proper cleanup`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('✅ Performance is within acceptable thresholds');
    }

    return recommendations;
  }

  /**
   * Check system health before benchmarking
   */
  private async checkSystemHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check memory
    const metrics = this.getSystemMetrics();
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > 80) {
      issues.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
    }

    // Check event loop delay
    const eventLoopDelay = await this.measureEventLoopDelay();
    if (eventLoopDelay > 100) { // 100ms
      issues.push(`High event loop delay: ${eventLoopDelay.toFixed(2)}ms`);
    }

    // Check file descriptors (if available)
    if (process && process.stdin && process.stdin.fd) {
      try {
        const { execSync } = require('child_process');
        const fdCount = parseInt(execSync('lsof -p ' + process.pid + ' | wc -l').toString());
        if (fdCount > 1000) {
          issues.push(`High file descriptor count: ${fdCount}`);
        }
      } catch (error) {
        // Ignore if lsof is not available
      }
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Measure event loop delay
   */
  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = performance.now();
      setImmediate(() => {
        const end = performance.now();
        resolve(end - start);
      });
    });
  }

  /**
   * Get current system metrics
   */
  private getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    // Calculate CPU usage percentage
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const cpuUsagePercent = (totalCpuTime / (uptime * 1000)) * 100 * process.pid ? 1 : 0;

    return {
      timestamp: Date.now(),
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        total: totalCpuTime
      },
      eventLoopDelay: 0, // Will be measured separately
      activeHandles: process.getActiveHandlesInfo ? process.getActiveHandlesInfo().length : 0,
      activeRequests: process.getActiveRequestsInfo ? process.getActiveRequestsInfo().length : 0
    };
  }

  /**
   * Calculate CPU usage from metrics
   */
  private calculateCpuUsage(metrics: SystemMetrics[]): { average: number; peak: number } {
    if (metrics.length < 2) return { average: 0, peak: 0 };

    const cpuUsages = metrics.map(m => {
      const totalCpuTime = m.cpuUsage.user + m.cpuUsage.system;
      const uptime = process.uptime();
      return (totalCpuTime / (uptime * 1000)) * 100;
    });

    return {
      average: cpuUsages.reduce((sum, cpu) => sum + cpu, 0) / cpuUsages.length,
      peak: Math.max(...cpuUsages)
    };
  }

  /**
   * Check if results meet performance thresholds
   */
  private checkThresholds(result: BenchmarkResult, thresholds: any): string[] {
    const issues: string[] = [];

    if (result.averageTime > thresholds.maxResponseTime) {
      issues.push(`Response time too high: ${result.averageTime.toFixed(2)}ms > ${thresholds.maxResponseTime}ms`);
    }

    if (result.throughput < thresholds.minThroughput) {
      issues.push(`Throughput too low: ${result.throughput.toFixed(0)} ops/sec < ${thresholds.minThroughput} ops/sec`);
    }

    if (result.memoryUsage.peak > thresholds.maxMemoryUsage * 1024 * 1024) {
      issues.push(`Memory usage too high: ${(result.memoryUsage.peak / (1024 * 1024)).toFixed(2)}MB > ${thresholds.maxMemoryUsage}MB`);
    }

    if (result.cpuUsage.average > thresholds.maxCpuUsage) {
      issues.push(`CPU usage too high: ${result.cpuUsage.average.toFixed(1)}% > ${thresholds.maxCpuUsage}%`);
    }

    return issues;
  }

  /**
   * Calculate average performance across all results
   */
  private calculateAveragePerformance(): { avgResponseTime: number; avgThroughput: number; avgMemory: number } {
    const successful = this.results.filter(r => r.success);
    if (successful.length === 0) {
      return { avgResponseTime: 0, avgThroughput: 0, avgMemory: 0 };
    }

    const avgResponseTime = successful.reduce((sum, r) => sum + r.averageTime, 0) / successful.length;
    const avgThroughput = successful.reduce((sum, r) => sum + r.throughput, 0) / successful.length;
    const avgMemory = successful.reduce((sum, r) => sum + r.memoryUsage.peak, 0) / successful.length;

    return {
      avgResponseTime,
      avgThroughput,
      avgMemory: avgMemory / (1024 * 1024) // Convert to MB
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const timestamp = new Date().toISOString();
    let report = `# Spur Performance Benchmark Report\n\n`;
    report += `**Generated:** ${timestamp}\n\n`;

    if (this.results.length === 0) {
      report += `No benchmark results available.\n`;
      return report;
    }

    // Summary section
    const summary = this.generateSummary({ name: 'summary', description: '', scenarios: [], thresholds: {} as any }, 0);
    report += `## Summary\n\n`;
    report += `- **Total Tests:** ${summary.totalTests}\n`;
    report += `- **Passed Tests:** ${summary.passedTests}\n`;
    report += `- **Failed Tests:** ${summary.failedTests}\n`;
    report += `- **Overall Score:** ${summary.overallScore}/100\n`;
    report += `- **Average Response Time:** ${summary.averagePerformance.avgResponseTime.toFixed(2)}ms\n`;
    report += `- **Average Throughput:** ${summary.averagePerformance.avgThroughput.toFixed(0)} ops/sec\n`;
    report += `- **Average Memory Usage:** ${summary.averagePerformance.avgMemory.toFixed(2)}MB\n\n`;

    // Detailed results
    report += `## Detailed Results\n\n`;
    for (const result of this.results) {
      report += `### ${result.name}\n\n`;
      report += result.success ? '✅ **PASSED**' : '❌ **FAILED**';
      if (result.error) {
        report += ` - ${result.error}`;
      }
      report += `\n\n`;
      
      report += `- **Iterations:** ${result.iterations}\n`;
      report += `- **Average Time:** ${result.averageTime.toFixed(2)}ms\n`;
      report += `- **Median Time:** ${result.medianTime.toFixed(2)}ms\n`;
      report += `- **95th Percentile:** ${result.percentile95.toFixed(2)}ms\n`;
      report += `- **99th Percentile:** ${result.percentile99.toFixed(2)}ms\n`;
      report += `- **Standard Deviation:** ${result.standardDeviation.toFixed(2)}ms\n`;
      report += `- **Throughput:** ${result.throughput.toFixed(0)} ops/sec\n`;
      report += `- **Memory Peak:** ${(result.memoryUsage.peak / (1024 * 1024)).toFixed(2)}MB\n`;
      report += `- **CPU Usage:** ${result.cpuUsage.average.toFixed(1)}%\n\n`;
    }

    return report;
  }

  /**
   * Export results to JSON
   */
  exportResults(): any {
    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results,
      systemMetrics: this.systemMetrics,
      summary: this.generateSummary({ name: 'export', description: '', scenarios: [], thresholds: {} as any }, 0)
    };
  }
}

/**
 * Pre-defined benchmark scenarios for Spur components
 */
export class SpurBenchmarks {
  /**
   * Database performance benchmarks
   */
  static getDatabaseBenchmarks(db: OptimizedGraphDatabase): BenchmarkScenario[] {
    return [
      {
        name: 'node_creation',
        description: 'Benchmark node creation performance',
        run: async (iteration: number) => {
          const node = {
            type: 'activity' as any,
            timestamp: Date.now(),
            content: { title: `Test Node ${iteration}`, description: 'Benchmark test node' },
            metadata: { source: 'benchmark', iteration },
            relevanceScore: 0.5,
            decayFactor: 0.1,
            degree: 0,
            clustering: 0,
            centrality: 0,
            community: 0,
            tags: ['benchmark', 'test'],
            embeddings: new Float32Array(128).fill(0.5),
            accessCount: 0,
            lastAccessed: Date.now(),
            confidence: 0.8,
            sourceType: 'benchmark',
            isPruned: false
          };
          return await db.createNode(node);
        }
      },
      {
        name: 'node_query',
        description: 'Benchmark node query performance',
        setup: async () => {
          // Create test data
          for (let i = 0; i < 1000; i++) {
            await db.createNode({
              type: 'activity' as any,
              timestamp: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
              content: { title: `Query Test ${i}`, description: 'Query benchmark test' },
              metadata: { source: 'benchmark', index: i },
              relevanceScore: Math.random(),
              decayFactor: 0.1,
              degree: Math.floor(Math.random() * 20),
              clustering: Math.random(),
              centrality: Math.random(),
              community: Math.floor(Math.random() * 10),
              tags: ['benchmark', 'query', `tag${i % 10}`],
              embeddings: new Float32Array(128).fill(Math.random()),
              accessCount: Math.floor(Math.random() * 50),
              lastAccessed: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
              confidence: Math.random(),
              sourceType: 'benchmark',
              isPruned: false
            });
          }
        },
        run: async (iteration: number) => {
          const query = {
            id: `benchmark-query-${iteration}`,
            type: 'node' as const,
            filters: [
              { field: 'type', operator: 'eq', value: 'activity' },
              { field: 'is_pruned', operator: 'eq', value: false }
            ],
            constraints: [],
            limit: 100,
            sortBy: [{ field: 'relevance_score', direction: 'desc' as const }]
          };
          return await db.queryNodes(query);
        }
      },
      {
        name: 'batch_operations',
        description: 'Benchmark batch operation performance',
        run: async (iteration: number) => {
          const operations = [];
          for (let i = 0; i < 50; i++) {
            operations.push({
              type: 'create' as const,
              target: 'node' as const,
              data: {
                type: 'activity' as any,
                timestamp: Date.now(),
                content: { title: `Batch Node ${iteration}-${i}`, description: 'Batch test node' },
                metadata: { source: 'benchmark', batch: iteration, item: i },
                relevanceScore: Math.random(),
                decayFactor: 0.1,
                degree: 0,
                clustering: 0,
                centrality: 0,
                community: 0,
                tags: ['benchmark', 'batch'],
                embeddings: new Float32Array(128).fill(Math.random()),
                accessCount: 0,
                lastAccessed: Date.now(),
                confidence: 0.8,
                sourceType: 'benchmark',
                isPruned: false
              }
            });
          }
          return await db.batchOperations(operations);
        }
      }
    ];
  }

  /**
   * Relevance scoring benchmarks
   */
  static getRelevanceBenchmarks(relevanceEngine: AdvancedRelevanceScoringEngine): BenchmarkScenario[] {
    return [
      {
        name: 'relevance_calculation',
        description: 'Benchmark relevance calculation performance',
        run: async (iteration: number) => {
          const node = {
            id: `benchmark-node-${iteration}`,
            type: 'activity' as any,
            timestamp: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
            content: { title: `Relevance Test ${iteration}`, description: 'Relevance benchmark test node' },
            metadata: { source: 'benchmark', iteration },
            relevanceScore: 0.5,
            decayFactor: 0.1,
            degree: Math.floor(Math.random() * 20),
            clustering: Math.random(),
            centrality: Math.random(),
            community: Math.floor(Math.random() * 10),
            tags: ['benchmark', 'relevance', 'test'],
            embeddings: new Float32Array(128).fill(Math.random()),
            accessCount: Math.floor(Math.random() * 50),
            lastAccessed: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
            confidence: 0.8,
            sourceType: 'benchmark',
            isPruned: false,
            createdAt: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
            updatedAt: Date.now()
          };
          
          const context = {
            queryTerms: ['test', 'benchmark', 'performance'],
            timeRange: { start: Date.now() - 24 * 60 * 60 * 1000, end: Date.now() },
            userPreferences: { priority: 'high' },
            sessionContext: 'benchmark-session'
          };
          
          return await relevanceEngine.calculateNodeRelevance(node, context);
        }
      },
      {
        name: 'batch_relevance_update',
        description: 'Benchmark batch relevance update performance',
        run: async (iteration: number) => {
          const nodeIds = Array.from({ length: 100 }, (_, i) => `batch-node-${iteration}-${i}`);
          const context = {
            queryTerms: ['batch', 'update', 'test'],
            timeRange: { start: Date.now() - 24 * 60 * 60 * 1000, end: Date.now() }
          };
          return await relevanceEngine.batchUpdateNodeRelevance(nodeIds, context);
        }
      }
    ];
  }
}