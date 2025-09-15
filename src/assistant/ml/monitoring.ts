import * as tf from '@tensorflow/tfjs';
import { MLModelOptimizer, PerformanceConfig, ModelMetrics } from './optimizer';

export interface BenchmarkSuite {
  name: string;
  description: string;
  benchmarks: Benchmark[];
}

export interface Benchmark {
  name: string;
  type: 'inference' | 'training' | 'memory' | 'throughput';
  model: tf.LayersModel;
  inputGenerator: () => tf.Tensor;
  iterations: number;
  warmupIterations: number;
  timeoutMs: number;
}

export interface BenchmarkResult {
  benchmarkName: string;
  suiteName: string;
  type: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  standardDeviation: number;
  throughput: number;
  memoryUsage: number;
  success: boolean;
  error?: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface PerformanceProfile {
  profileName: string;
  targetDevice: 'cpu' | 'gpu' | 'wasm';
  optimizationLevel: 'minimal' | 'balanced' | 'aggressive';
  maxLatencyMs: number;
  targetThroughput: number;
  maxMemoryUsage: number;
  qualityThreshold: number;
}

export interface MonitoringMetrics {
  timestamp: number;
  memoryUsage: number;
  tensorCount: number;
  activeRequests: number;
  queueLength: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
  gpuUtilization?: number;
  cpuUtilization?: number;
}

export class PerformanceMonitor {
  private optimizer: MLModelOptimizer;
  private benchmarkResults: BenchmarkResult[] = [];
  private monitoringHistory: MonitoringMetrics[] = [];
  private activeProfiles: Map<string, PerformanceProfile> = new Map();
  private alerts: PerformanceAlert[] = [];

  constructor(optimizer: MLModelOptimizer) {
    this.optimizer = optimizer;
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarkSuite(suite: BenchmarkSuite): Promise<{
    results: BenchmarkResult[];
    summary: {
      totalTime: number;
      averageLatency: number;
      totalMemoryUsage: number;
      successRate: number;
      recommendations: string[];
    };
  }> {
    console.log(`[PerformanceMonitor] Running benchmark suite: ${suite.name}`);

    const results: BenchmarkResult[] = [];
    let totalTime = 0;
    let totalMemoryUsage = 0;
    let successCount = 0;

    // Run each benchmark
    for (const benchmark of suite.benchmarks) {
      try {
        const result = await this.runSingleBenchmark(benchmark, suite.name);
        results.push(result);
        totalTime += result.totalTime;
        totalMemoryUsage += result.memoryUsage;
        if (result.success) successCount++;
      } catch (error) {
        console.error(`[PerformanceMonitor] Benchmark failed: ${benchmark.name}`, error);
        results.push({
          benchmarkName: benchmark.name,
          suiteName: suite.name,
          type: benchmark.type,
          iterations: benchmark.iterations,
          totalTime: 0,
          averageTime: 0,
          minTime: 0,
          maxTime: 0,
          medianTime: 0,
          standardDeviation: 0,
          throughput: 0,
          memoryUsage: 0,
          success: false,
          error: error.message,
          timestamp: Date.now(),
          metadata: {}
        });
      }
    }

    const successRate = (successCount / suite.benchmarks.length) * 100;
    const averageLatency = results.reduce((sum, r) => sum + r.averageTime, 0) / results.length;

    // Generate recommendations
    const recommendations = this.generateBenchmarkRecommendations(results);

    // Store results
    this.benchmarkResults.push(...results);

    return {
      results,
      summary: {
        totalTime,
        averageLatency,
        totalMemoryUsage,
        successRate,
        recommendations
      }
    };
  }

  /**
   * Run single benchmark
   */
  private async runSingleBenchmark(benchmark: Benchmark, suiteName: string): Promise<BenchmarkResult> {
    console.log(`[PerformanceMonitor] Running benchmark: ${benchmark.name}`);

    // Warm up
    for (let i = 0; i < benchmark.warmupIterations; i++) {
      const input = benchmark.inputGenerator();
      try {
        const prediction = benchmark.model.predict(input);
        await prediction.data();
        input.dispose();
        prediction.dispose();
      } catch (error) {
        input.dispose();
        throw error;
      }
    }

    // Run benchmark iterations
    const times: number[] = [];
    let memoryUsage = 0;

    for (let i = 0; i < benchmark.iterations; i++) {
      const startTime = performance.now();
      const input = benchmark.inputGenerator();

      try {
        // Measure memory before
        const memoryBefore = tf.memory().numBytes;

        // Run inference
        const prediction = benchmark.model.predict(input);
        await prediction.data();

        // Measure memory after
        const memoryAfter = tf.memory().numBytes;
        memoryUsage += (memoryAfter - memoryBefore);

        const endTime = performance.now();
        times.push(endTime - startTime);

        // Cleanup
        input.dispose();
        prediction.dispose();

      } catch (error) {
        input.dispose();
        throw error;
      }
    }

    // Calculate statistics
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const medianTime = this.calculateMedian(times);
    const standardDeviation = this.calculateStandardDeviation(times, averageTime);
    const throughput = 1000 / averageTime;

    return {
      benchmarkName: benchmark.name,
      suiteName,
      type: benchmark.type,
      iterations: benchmark.iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      medianTime,
      standardDeviation,
      throughput,
      memoryUsage: memoryUsage / benchmark.iterations,
      success: true,
      timestamp: Date.now(),
      metadata: {
        modelSize: benchmark.model.countParams(),
        inputShape: benchmark.model.inputs[0].shape,
        outputShape: benchmark.model.outputs[0].shape
      }
    };
  }

  /**
   * Create standard benchmark suites
   */
  createStandardBenchmarkSuites(model: tf.LayersModel): BenchmarkSuite[] {
    const inputShape = model.inputs[0].shape;

    return [
      {
        name: 'Inference Performance',
        description: 'Measure inference latency and throughput',
        benchmarks: [
          {
            name: 'Single Inference',
            type: 'inference',
            model,
            inputGenerator: () => tf.zeros(inputShape.slice(0, 3) as [number, number, number]),
            iterations: 100,
            warmupIterations: 10,
            timeoutMs: 5000
          },
          {
            name: 'Batch Inference',
            type: 'inference',
            model,
            inputGenerator: () => tf.zeros([32, ...inputShape.slice(1)] as any),
            iterations: 50,
            warmupIterations: 5,
            timeoutMs: 10000
          }
        ]
      },
      {
        name: 'Memory Usage',
        description: 'Measure memory consumption and tensor lifecycle',
        benchmarks: [
          {
            name: 'Memory Peak',
            type: 'memory',
            model,
            inputGenerator: () => tf.zeros(inputShape.slice(0, 3) as [number, number, number]),
            iterations: 20,
            warmupIterations: 3,
            timeoutMs: 3000
          }
        ]
      },
      {
        name: 'Throughput',
        description: 'Measure sustained throughput under load',
        benchmarks: [
          {
            name: 'Sustained Load',
            type: 'throughput',
            model,
            inputGenerator: () => tf.zeros(inputShape.slice(0, 3) as [number, number, number]),
            iterations: 200,
            warmupIterations: 20,
            timeoutMs: 20000
          }
        ]
      }
    ];
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 1000): void {
    console.log('[PerformanceMonitor] Starting continuous monitoring');

    const monitor = async () => {
      try {
        const metrics = this.collectMetrics();
        this.monitoringHistory.push(metrics);
        
        // Check for alerts
        this.checkForAlerts(metrics);
        
        // Keep only recent history
        if (this.monitoringHistory.length > 1000) {
          this.monitoringHistory = this.monitoringHistory.slice(-1000);
        }
      } catch (error) {
        console.error('[PerformanceMonitor] Monitoring error:', error);
      }
    };

    // Initial collection
    monitor();

    // Set up interval
    setInterval(monitor, intervalMs);
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): MonitoringMetrics {
    const memory = tf.memory();
    
    return {
      timestamp: Date.now(),
      memoryUsage: memory.numBytes,
      tensorCount: memory.numTensors,
      activeRequests: this.calculateActiveRequests(),
      queueLength: this.calculateQueueLength(),
      averageLatency: this.calculateAverageLatency(),
      errorRate: this.calculateErrorRate(),
      throughput: this.calculateThroughput(),
      gpuUtilization: this.calculateGPUUtilization(),
      cpuUtilization: this.calculateCPUUtilization()
    };
  }

  /**
   * Register performance profile
   */
  registerProfile(profileName: string, profile: PerformanceProfile): void {
    this.activeProfiles.set(profileName, profile);
    console.log(`[PerformanceMonitor] Registered performance profile: ${profileName}`);
  }

  /**
   * Check if system meets performance profile requirements
   */
  checkProfileCompliance(profileName: string): {
    compliant: boolean;
    violations: Array<{
      metric: string;
      expected: any;
      actual: any;
      severity: 'low' | 'medium' | 'high';
    }>;
  } {
    const profile = this.activeProfiles.get(profileName);
    if (!profile) {
      throw new Error(`Profile not found: ${profileName}`);
    }

    const latestMetrics = this.monitoringHistory[this.monitoringHistory.length - 1];
    const violations: Array<{
      metric: string;
      expected: any;
      actual: any;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Check latency
    if (latestMetrics.averageLatency > profile.maxLatencyMs) {
      violations.push({
        metric: 'latency',
        expected: `<= ${profile.maxLatencyMs}ms`,
        actual: `${latestMetrics.averageLatency.toFixed(2)}ms`,
        severity: 'high'
      });
    }

    // Check throughput
    if (latestMetrics.throughput < profile.targetThroughput) {
      violations.push({
        metric: 'throughput',
        expected: `>= ${profile.targetThroughput} req/s`,
        actual: `${latestMetrics.throughput.toFixed(2)} req/s`,
        severity: 'high'
      });
    }

    // Check memory usage
    if (latestMetrics.memoryUsage > profile.maxMemoryUsage) {
      violations.push({
        metric: 'memory',
        expected: `<= ${profile.maxMemoryUsage} bytes`,
        actual: `${latestMetrics.memoryUsage} bytes`,
        severity: 'medium'
      });
    }

    // Check error rate
    if (latestMetrics.errorRate > 0.05) { // 5% error rate threshold
      violations.push({
        metric: 'error_rate',
        expected: '<= 5%',
        actual: `${(latestMetrics.errorRate * 100).toFixed(2)}%`,
        severity: 'high'
      });
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  /**
   * Get performance dashboard data
   */
  getDashboard(): {
    currentMetrics: MonitoringMetrics;
    recentHistory: MonitoringMetrics[];
    alerts: PerformanceAlert[];
    benchmarkSummary: {
      totalBenchmarks: number;
      averageLatency: number;
      successRate: number;
    };
    profiles: Array<{
      name: string;
      compliant: boolean;
      violations: number;
    }>;
  } {
    const currentMetrics = this.monitoringHistory[this.monitoringHistory.length - 1];
    const recentHistory = this.monitoringHistory.slice(-100);

    // Calculate benchmark summary
    const recentBenchmarks = this.benchmarkResults.slice(-50);
    const benchmarkSummary = {
      totalBenchmarks: recentBenchmarks.length,
      averageLatency: recentBenchmarks.length > 0 ? 
        recentBenchmarks.reduce((sum, b) => sum + b.averageTime, 0) / recentBenchmarks.length : 0,
      successRate: recentBenchmarks.length > 0 ?
        (recentBenchmarks.filter(b => b.success).length / recentBenchmarks.length) * 100 : 100
    };

    // Check profile compliance
    const profiles = Array.from(this.activeProfiles.entries()).map(([name, profile]) => {
      const compliance = this.checkProfileCompliance(name);
      return {
        name,
        compliant: compliance.compliant,
        violations: compliance.violations.length
      };
    });

    return {
      currentMetrics,
      recentHistory,
      alerts: this.alerts,
      benchmarkSummary,
      profiles
    };
  }

  /**
   * Export performance report
   */
  exportReport(): {
    timestamp: number;
    summary: {
      monitoringPeriod: string;
      totalMetrics: number;
      totalAlerts: number;
      averageLatency: number;
      peakMemory: number;
    };
    benchmarks: BenchmarkResult[];
    monitoring: MonitoringMetrics[];
    alerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const monitoringPeriod = this.monitoringHistory.length > 1 ? 
      `${((this.monitoringHistory[this.monitoringHistory.length - 1].timestamp - this.monitoringHistory[0].timestamp) / 1000 / 60).toFixed(1)} minutes` : 
      '0 minutes';

    const peakMemory = Math.max(...this.monitoringHistory.map(m => m.memoryUsage));
    const averageLatency = this.monitoringHistory.length > 0 ?
      this.monitoringHistory.reduce((sum, m) => sum + m.averageLatency, 0) / this.monitoringHistory.length : 0;

    return {
      timestamp: Date.now(),
      summary: {
        monitoringPeriod,
        totalMetrics: this.monitoringHistory.length,
        totalAlerts: this.alerts.length,
        averageLatency,
        peakMemory
      },
      benchmarks: this.benchmarkResults,
      monitoring: this.monitoringHistory,
      alerts: this.alerts,
      recommendations: this.generateSystemRecommendations()
    };
  }

  // Private helper methods

  private calculateMedian(numbers: number[]): number {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid];
  }

  private calculateStandardDeviation(numbers: number[], mean: number): number {
    const squaredDifferences = numbers.map(num => Math.pow(num - mean, 2));
    const avgSquaredDiff = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / numbers.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private calculateActiveRequests(): number {
    // This would track active inference requests
    // For now, return a mock value
    return 0;
  }

  private calculateQueueLength(): number {
    // This would track request queue length
    // For now, return a mock value
    return 0;
  }

  private calculateAverageLatency(): number {
    if (this.monitoringHistory.length < 2) return 0;
    
    const recent = this.monitoringHistory.slice(-10);
    return recent.reduce((sum, m) => sum + m.averageLatency, 0) / recent.length;
  }

  private calculateErrorRate(): number {
    // Calculate error rate from recent history
    if (this.monitoringHistory.length < 10) return 0;
    
    const recent = this.monitoringHistory.slice(-50);
    const errors = recent.filter(m => m.errorRate > 0).length;
    return errors / recent.length;
  }

  private calculateThroughput(): number {
    // Calculate throughput from recent history
    if (this.monitoringHistory.length < 2) return 0;
    
    const recent = this.monitoringHistory.slice(-10);
    return recent.reduce((sum, m) => sum + m.throughput, 0) / recent.length;
  }

  private calculateGPUUtilization(): number {
    try {
      const gl = tf.backend().gl;
      if (!gl) return 0;
      
      // This is a simplified GPU utilization calculation
      // In practice, you'd use more sophisticated metrics
      return Math.random() * 0.8 + 0.2; // Mock value 0.2-1.0
    } catch {
      return 0;
    }
  }

  private calculateCPUUtilization(): number {
    // This would require browser performance API or Node.js metrics
    // For now, return a mock value
    return Math.random() * 0.6 + 0.2; // Mock value 0.2-0.8
  }

  private checkForAlerts(metrics: MonitoringMetrics): void {
    // Check for performance alerts
    if (metrics.memoryUsage > 100 * 1024 * 1024) { // > 100MB
      this.createAlert('high_memory', 'High memory usage detected', 'medium', metrics);
    }

    if (metrics.averageLatency > 1000) { // > 1s
      this.createAlert('high_latency', 'High latency detected', 'high', metrics);
    }

    if (metrics.errorRate > 0.1) { // > 10%
      this.createAlert('high_error_rate', 'High error rate detected', 'high', metrics);
    }

    if (metrics.throughput < 1) { // < 1 req/s
      this.createAlert('low_throughput', 'Low throughput detected', 'medium', metrics);
    }
  }

  private createAlert(
    type: string,
    message: string,
    severity: 'low' | 'medium' | 'high',
    metrics: MonitoringMetrics
  ): void {
    const alert: PerformanceAlert = {
      id: `${type}_${Date.now()}`,
      type,
      message,
      severity,
      timestamp: metrics.timestamp,
      metrics,
      acknowledged: false,
      resolved: false
    };

    this.alerts.push(alert);
    console.warn(`[PerformanceMonitor] Alert: ${message} (${severity})`);

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  private generateBenchmarkRecommendations(results: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];

    const avgLatency = results.reduce((sum, r) => sum + r.averageTime, 0) / results.length;
    const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    const avgMemory = results.reduce((sum, r) => sum + r.memoryUsage, 0) / results.length;

    if (avgLatency > 100) {
      recommendations.push('Consider model optimization to reduce latency');
    }

    if (avgThroughput < 10) {
      recommendations.push('Enable batch processing for better throughput');
    }

    if (avgMemory > 50 * 1024 * 1024) { // > 50MB
      recommendations.push('Consider model quantization to reduce memory usage');
    }

    const failedBenchmarks = results.filter(r => !r.success);
    if (failedBenchmarks.length > 0) {
      recommendations.push(`${failedBenchmarks.length} benchmarks failed, check model compatibility`);
    }

    return recommendations;
  }

  private generateSystemRecommendations(): string[] {
    const recommendations: string[] = [];
    const dashboard = this.getDashboard();

    if (dashboard.currentMetrics.memoryUsage > 200 * 1024 * 1024) { // > 200MB
      recommendations.push('System memory usage is high, consider cleanup');
    }

    if (dashboard.benchmarkSummary.successRate < 90) {
      recommendations.push('Benchmark success rate is low, review system configuration');
    }

    if (dashboard.alerts.length > 10) {
      recommendations.push('High number of alerts, investigate performance issues');
    }

    return recommendations;
  }
}

export interface PerformanceAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  metrics: MonitoringMetrics;
  acknowledged: boolean;
  resolved: boolean;
}