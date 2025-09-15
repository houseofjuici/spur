// ML Performance Optimization Components for Spur Super App
// This module provides comprehensive model optimization, monitoring, and auto-optimization capabilities

export * from './optimizer';
export * from './monitoring';
export * from './auto-optimization';

// Re-export TensorFlow.js types for convenience
export * from '@tensorflow/tfjs';

/**
 * ML Performance Optimization System Overview
 * 
 * This system provides comprehensive ML model optimization capabilities for the Spur super app:
 * 
 * 1. **MLModelOptimizer** - Core optimization engine that handles:
 *    - Model quantization and pruning
 *    - WebGL/WebAssembly acceleration
 *    - Model caching and batch processing
 *    - Performance measurement and reporting
 * 
 * 2. **PerformanceMonitor** - Comprehensive monitoring and benchmarking:
 *    - Real-time performance metrics collection
 *    - Automated benchmark suites
 *    - Performance profile compliance checking
 *    - Alert generation and dashboard
 * 
 * 3. **AutoOptimizationService** - Automated optimization management:
 *    - Health monitoring and issue detection
 *    - Scheduled optimization execution
 *    - Performance-based triggering
 *    - Comprehensive reporting
 * 
 * Key Features:
 * - Real-time performance monitoring
 * - Automated model optimization
 * - Comprehensive benchmarking
 * - Health reporting and recommendations
 * - Configurable optimization strategies
 * - Memory-efficient processing
 * - WebGL acceleration support
 * - Batch processing capabilities
 * 
 * Usage:
 * ```typescript
 * // Initialize optimizer
 * const optimizer = new MLModelOptimizer(performanceConfig);
 * await optimizer.initialize();
 * 
 * // Optimize a model
 * const report = await optimizer.optimizeModel(model, 'my-model');
 * 
 * // Set up monitoring
 * const monitor = new PerformanceMonitor(optimizer);
 * monitor.startMonitoring();
 * 
 * // Run benchmarks
 * const results = await monitor.runBenchmarkSuite(benchmarkSuite);
 * 
 * // Auto-optimization
 * const autoService = new AutoOptimizationService(
 *   autoConfig, optimizer, monitor, semanticEngine, db
 * );
 * await autoService.start();
 * ```
 */

// Default configurations for common use cases
export const DEFAULT_PERFORMANCE_CONFIG = {
  enableQuantization: true,
  enableModelPruning: true,
  enableModelCaching: true,
  enableWebGLAcceleration: true,
  enableWebAssemblyFallback: true,
  enableBatchProcessing: true,
  maxModelSize: 50, // 50MB
  maxLatency: 100, // 100ms
  targetThroughput: 10, // 10 req/s
  optimizationLevel: 'balanced' as const
};

export const DEFAULT_AUTO_OPTIMIZATION_CONFIG = {
  enabled: true,
  optimizationInterval: 300000, // 5 minutes
  performanceThresholds: {
    latency: 100, // ms
    memory: 50 * 1024 * 1024, // 50MB
    throughput: 10, // req/s
    errorRate: 0.05 // 5%
  },
  autoOptimization: {
    enabled: true,
    triggerConditions: {
      highLatency: true,
      highMemory: true,
      lowThroughput: true,
      highErrorRate: true
    },
    optimizationStrategies: {
      quantization: true,
      pruning: true,
      caching: true,
      batchProcessing: true
    }
  },
  modelRetraining: {
    enabled: true,
    retrainingInterval: 3600000, // 1 hour
    performanceWindow: 1800000, // 30 minutes
    accuracyThreshold: 0.8
  }
};

// Performance profiles for different deployment scenarios
export const PERFORMANCE_PROFILES = {
  development: {
    profileName: 'development',
    targetDevice: 'cpu' as const,
    optimizationLevel: 'minimal' as const,
    maxLatencyMs: 500,
    targetThroughput: 5,
    maxMemoryUsage: 200 * 1024 * 1024, // 200MB
    qualityThreshold: 0.7
  },
  production: {
    profileName: 'production',
    targetDevice: 'gpu' as const,
    optimizationLevel: 'aggressive' as const,
    maxLatencyMs: 50,
    targetThroughput: 50,
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    qualityThreshold: 0.95
  },
  edge: {
    profileName: 'edge',
    targetDevice: 'wasm' as const,
    optimizationLevel: 'aggressive' as const,
    maxLatencyMs: 100,
    targetThroughput: 20,
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    qualityThreshold: 0.9
  }
};

// Utility functions for common optimization tasks
export const MLPerformanceUtils = {
  /**
   * Create a standard benchmark suite for a given model
   */
  createStandardBenchmarkSuite(model: any) {
    // This would be implemented in the PerformanceMonitor class
    console.log('Creating standard benchmark suite for model');
  },

  /**
   * Get recommended optimization strategy based on model characteristics
   */
  getRecommendedOptimization(model: any) {
    const modelSize = this.estimateModelSize(model);
    const complexity = this.estimateModelComplexity(model);
    
    if (modelSize > 100 * 1024 * 1024) { // > 100MB
      return { strategy: 'aggressive', reason: 'Large model size' };
    } else if (complexity > 0.8) {
      return { strategy: 'balanced', reason: 'High complexity' };
    } else {
      return { strategy: 'minimal', reason: 'Standard model' };
    }
  },

  /**
   * Estimate model size in bytes
   */
  estimateModelSize(model: any): number {
    // Simplified estimation
    return model.countParams * 4; // 4 bytes per parameter (float32)
  },

  /**
   * Estimate model complexity (0-1)
   */
  estimateModelComplexity(model: any): number {
    // Simplified complexity estimation
    const layers = model.layers?.length || 0;
    const params = model.countParams || 0;
    
    return Math.min(1.0, (layers * 0.1) + (params / 1000000));
  },

  /**
   * Format performance metrics for display
   */
  formatMetrics(metrics: any): string {
    return [
      `Latency: ${metrics.averageLatency?.toFixed(2) || 0}ms`,
      `Throughput: ${metrics.throughput?.toFixed(2) || 0} req/s`,
      `Memory: ${this.formatBytes(metrics.memoryUsage || 0)}`,
      `Error Rate: ${((metrics.errorRate || 0) * 100).toFixed(2)}%`
    ].join(' | ');
  },

  /**
   * Format bytes for display
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

// Export commonly used types and interfaces for convenience
export type {
  PerformanceConfig,
  ModelMetrics,
  OptimizationReport,
  BatchProcessingConfig,
  BenchmarkSuite,
  Benchmark,
  BenchmarkResult,
  PerformanceProfile,
  MonitoringMetrics,
  AutoOptimizationConfig,
  OptimizationSchedule,
  SystemHealthReport
};

// Performance event types for monitoring and analytics
export const PERFORMANCE_EVENTS = {
  OPTIMIZATION_STARTED: 'optimization_started',
  OPTIMIZATION_COMPLETED: 'optimization_completed',
  OPTIMIZATION_FAILED: 'optimization_failed',
  BENCHMARK_STARTED: 'benchmark_started',
  BENCHMARK_COMPLETED: 'benchmark_completed',
  HEALTH_CHECK_COMPLETED: 'health_check_completed',
  PERFORMANCE_ALERT: 'performance_alert',
  MODEL_LOADED: 'model_loaded',
  MODEL_UNLOADED: 'model_unloaded'
} as const;

// Export the main classes for easy import
export {
  MLModelOptimizer,
  PerformanceMonitor,
  AutoOptimizationService
};

// Version information
export const ML_OPTIMIZATION_VERSION = '1.0.0';
export const COMPATIBILITY_VERSION = '1.0.0';

// System requirements
export const SYSTEM_REQUIREMENTS = {
  minNodeVersion: '16.0.0',
  minTensorFlowVersion: '4.0.0',
  recommendedMemory: '4GB',
  requiredFeatures: ['WebGL', 'WebAssembly', 'SharedArrayBuffer']
};