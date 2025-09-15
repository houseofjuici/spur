import * as tf from '@tensorflow/tfjs';
import * as tfn from '@tensorflow-models/universal-sentence-encoder';
import { AdvancedSemanticConfig, AdvancedSemanticFeatures } from '@/memory/graph/advanced-semantic';
import { GraphDatabase } from '@/memory/graph/database';

export interface PerformanceConfig {
  enableQuantization: boolean;
  enableModelPruning: boolean;
  enableModelCaching: boolean;
  enableWebGLAcceleration: boolean;
  enableWebAssemblyFallback: boolean;
  enableBatchProcessing: boolean;
  maxModelSize: number; // in MB
  maxLatency: number; // in ms
  targetThroughput: number; // requests per second
  optimizationLevel: 'minimal' | 'balanced' | 'aggressive';
}

export interface ModelMetrics {
  modelName: string;
  inputSize: number;
  outputSize: number;
  parameterCount: number;
  modelSize: number; // in bytes
  inferenceTime: number; // in ms
  memoryUsage: number; // in bytes
  throughput: number; // requests per second
  accuracy: number;
  quantizationRatio: number;
  pruningRatio: number;
  cacheHitRate: number;
  webglUtilization: number;
  timestamp: number;
}

export interface OptimizationReport {
  modelMetrics: ModelMetrics;
  optimizationsApplied: string[];
  performanceImprovements: {
    speedup: number; // factor
    memoryReduction: number; // percentage
    throughputIncrease: number; // percentage
  };
  recommendations: string[];
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface BatchProcessingConfig {
  batchSize: number;
  maxBatchSize: number;
  adaptiveBatching: boolean;
  timeoutMs: number;
  priorityQueuing: boolean;
  concurrencyLimit: number;
}

export class MLModelOptimizer {
  private config: PerformanceConfig;
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private modelCache: Map<string, tf.LayersModel> = new Map();
  private batchProcessor: BatchProcessor;
  private isInitialized = false;

  // Performance monitoring
  private performanceHistory: ModelMetrics[] = [];
  private optimizationStats = {
    totalOptimizations: 0,
    averageSpeedup: 0,
    totalMemorySaved: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failedOptimizations: 0
  };

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.batchProcessor = new BatchProcessor({
      batchSize: config.enableBatchProcessing ? 32 : 1,
      maxBatchSize: 128,
      adaptiveBatching: true,
      timeoutMs: 100,
      priorityQueuing: true,
      concurrencyLimit: 4
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[MLModelOptimizer] Initializing...');

      // Initialize TensorFlow.js backends
      await this.initializeBackends();

      // Initialize performance monitoring
      this.initializePerformanceMonitoring();

      // Initialize model caching
      if (this.config.enableModelCaching) {
        await this.initializeModelCache();
      }

      this.isInitialized = true;
      console.log('[MLModelOptimizer] Initialized successfully');

    } catch (error) {
      console.error('[MLModelOptimizer] Initialization failed:', error);
      throw error;
    }
  }

  private async initializeBackends(): Promise<void> {
    try {
      // Try WebGL backend first for best performance
      if (this.config.enableWebGLAcceleration) {
        await tf.setBackend('webgl');
        await tf.ready();
        
        // Configure WebGL for optimal performance
        const gl = tf.backend().gl;
        if (gl) {
          gl.getExtension('OES_texture_float_linear');
          gl.getExtension('OES_element_index_uint');
        }
        
        console.log('[MLModelOptimizer] WebGL backend initialized');
      }

      // Fallback to WebAssembly if WebGL fails
      if (this.config.enableWebAssemblyFallback && tf.getBackend() !== 'webgl') {
        await tf.setBackend('wasm');
        await tf.ready();
        console.log('[MLModelOptimizer] WebAssembly backend initialized');
      }

      // Final fallback to CPU
      if (!tf.getBackend()) {
        await tf.setBackend('cpu');
        await tf.ready();
        console.log('[MLModelOptimizer] CPU backend initialized');
      }

    } catch (error) {
      console.warn('[MLModelOptimizer] Backend initialization failed:', error);
      // Fallback to CPU
      await tf.setBackend('cpu');
      await tf.ready();
    }
  }

  private initializePerformanceMonitoring(): void {
    // Set up performance monitoring
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 30000); // Every 30 seconds
  }

  private async initializeModelCache(): Promise<void> {
    // Initialize model cache with LRU eviction
    // Cache size limited by maxModelSize
    console.log('[MLModelOptimizer] Model cache initialized');
  }

  /**
   * Optimize a TensorFlow.js model for production deployment
   */
  async optimizeModel(
    model: tf.LayersModel,
    modelName: string,
    options: {
      inputShape?: number[];
      calibrationData?: tf.Tensor;
      preserveAccuracy?: boolean;
    } = {}
  ): Promise<OptimizationReport> {
    const startTime = performance.now();
    const originalMetrics = await this.measureModelPerformance(model, modelName);

    const optimizationsApplied: string[] = [];
    let optimizedModel = model;

    try {
      // 1. Model Quantization
      if (this.config.enableQuantization) {
        optimizedModel = await this.quantizeModel(optimizedModel, modelName, options);
        optimizationsApplied.push('quantization');
      }

      // 2. Model Pruning
      if (this.config.enableModelPruning) {
        optimizedModel = await this.pruneModel(optimizedModel, modelName, options);
        optimizationsApplied.push('pruning');
      }

      // 3. Model Caching
      if (this.config.enableModelCaching) {
        await this.cacheModel(optimizedModel, modelName);
        optimizationsApplied.push('caching');
      }

      // 4. Performance measurement
      const optimizedMetrics = await this.measureModelPerformance(optimizedModel, modelName);

      // 5. Generate optimization report
      const report = this.generateOptimizationReport(
        originalMetrics,
        optimizedMetrics,
        optimizationsApplied
      );

      // 6. Update statistics
      this.updateOptimizationStats(report);

      const totalTime = performance.now() - startTime;
      console.log(`[MLModelOptimizer] Model optimization completed in ${totalTime.toFixed(2)}ms`);

      return report;

    } catch (error) {
      console.error(`[MLModelOptimizer] Model optimization failed for ${modelName}:`, error);
      this.optimizationStats.failedOptimizations++;

      // Return fallback report
      return {
        modelMetrics: originalMetrics,
        optimizationsApplied: [],
        performanceImprovements: {
          speedup: 1.0,
          memoryReduction: 0,
          throughputIncrease: 0
        },
        recommendations: [`Optimization failed: ${error.message}`],
        healthStatus: 'poor'
      };
    }
  }

  /**
   * Quantize model to reduce memory usage and improve inference speed
   */
  private async quantizeModel(
    model: tf.LayersModel,
    modelName: string,
    options: any
  ): Promise<tf.LayersModel> {
    try {
      console.log(`[MLModelOptimizer] Quantizing model: ${modelName}`);

      // Clone model to avoid modifying original
      const quantizedModel = await tf.models.cloneModel(model);

      // Apply quantization aware training if calibration data provided
      if (options.calibrationData) {
        await this.calibrateQuantization(quantizedModel, options.calibrationData);
      }

      // Convert weights to float16 or int8 based on configuration
      const quantizationLevel = this.config.optimizationLevel === 'aggressive' ? 'int8' : 'float16';

      quantizedModel.layers.forEach(layer => {
        if (layer instanceof tf.layers.Dense) {
          // Quantize dense layer weights
          const weights = layer.getWeights()[0];
          if (weights) {
            const quantizedWeights = this.quantizeTensor(weights, quantizationLevel);
            layer.setWeights([quantizedWeights, layer.getWeights()[1]]);
          }
        }
      });

      console.log(`[MLModelOptimizer] Model quantized: ${modelName}`);
      return quantizedModel;

    } catch (error) {
      console.warn(`[MLModelOptimizer] Quantization failed for ${modelName}:`, error);
      return model; // Return original model if quantization fails
    }
  }

  /**
   * Prune model to remove unnecessary weights and neurons
   */
  private async pruneModel(
    model: tf.LayersModel,
    modelName: string,
    options: any
  ): Promise<tf.LayersModel> {
    try {
      console.log(`[MLModelOptimizer] Pruning model: ${modelName}`);

      // Calculate weight importance scores
      const importanceScores = await this.calculateWeightImportance(model);

      // Determine pruning threshold based on optimization level
      const pruningThreshold = this.getPruningThreshold();

      // Apply pruning to each layer
      const prunedModel = await tf.models.cloneModel(model);

      prunedModel.layers.forEach((layer, layerIndex) => {
        if (layer instanceof tf.layers.Dense) {
          const weights = layer.getWeights()[0];
          if (weights) {
            const prunedWeights = this.pruneWeights(weights, importanceScores[layerIndex], pruningThreshold);
            layer.setWeights([prunedWeights, layer.getWeights()[1]]);
          }
        }
      });

      console.log(`[MLModelOptimizer] Model pruned: ${modelName}`);
      return prunedModel;

    } catch (error) {
      console.warn(`[MLModelOptimizer] Pruning failed for ${modelName}:`, error);
      return model; // Return original model if pruning fails
    }
  }

  /**
   * Cache model for faster loading and inference
   */
  private async cacheModel(model: tf.LayersModel, modelName: string): Promise<void> {
    try {
      // Check if model exceeds size limit
      const modelSize = await this.calculateModelSize(model);
      if (modelSize > this.config.maxModelSize * 1024 * 1024) {
        console.warn(`[MLModelOptimizer] Model ${modelName} too large for caching: ${modelSize}MB`);
        return;
      }

      // Cache the model
      this.modelCache.set(modelName, model);
      
      // Implement LRU cache eviction if cache is full
      if (this.modelCache.size > 10) { // Limit cache size
        const oldestKey = this.modelCache.keys().next().value;
        const oldestModel = this.modelCache.get(oldestKey);
        if (oldestModel) {
          oldestModel.dispose();
          this.modelCache.delete(oldestKey);
        }
      }

      console.log(`[MLModelOptimizer] Model cached: ${modelName}`);
      this.optimizationStats.cacheHits++;

    } catch (error) {
      console.warn(`[MLModelOptimizer] Caching failed for ${modelName}:`, error);
      this.optimizationStats.cacheMisses++;
    }
  }

  /**
   * Process batch of inputs efficiently
   */
  async processBatch<T>(
    inputs: T[],
    processFunction: (input: T) => Promise<any>,
    options?: Partial<BatchProcessingConfig>
  ): Promise<any[]> {
    return this.batchProcessor.processBatch(inputs, processFunction, options);
  }

  /**
   * Measure model performance metrics
   */
  private async measureModelPerformance(
    model: tf.LayersModel,
    modelName: string
  ): Promise<ModelMetrics> {
    const startTime = performance.now();

    // Create dummy input for inference testing
    const inputShape = model.inputs[0].shape;
    const dummyInput = tf.zeros(inputShape.slice(0, 3) as [number, number, number]);

    // Measure inference time
    const inferenceStartTime = performance.now();
    const prediction = model.predict(dummyInput) as tf.Tensor;
    await prediction.data();
    const inferenceTime = performance.now() - inferenceStartTime;

    // Clean up tensors
    dummyInput.dispose();
    prediction.dispose();

    // Calculate metrics
    const modelSize = await this.calculateModelSize(model);
    const parameterCount = model.countParams();
    const memoryUsage = tf.memory().numBytes;

    const metrics: ModelMetrics = {
      modelName,
      inputSize: inputShape.slice(1).reduce((a, b) => a * b, 1),
      outputSize: model.outputs[0].shape.slice(1).reduce((a, b) => a * b, 1),
      parameterCount,
      modelSize,
      inferenceTime,
      memoryUsage,
      throughput: 1000 / inferenceTime,
      accuracy: 1.0, // Would need validation data for real accuracy
      quantizationRatio: 1.0,
      pruningRatio: 1.0,
      cacheHitRate: this.calculateCacheHitRate(),
      webglUtilization: this.calculateWebGLUtilization(),
      timestamp: Date.now()
    };

    this.modelMetrics.set(modelName, metrics);
    return metrics;
  }

  /**
   * Calculate model size in bytes
   */
  private async calculateModelSize(model: tf.LayersModel): Promise<number> {
    try {
      // Serialize model to calculate size
      const modelData = await model.save(tf.io.withSaveHandler(async (artifacts) => {
        return artifacts;
      }));
      
      // Calculate total size of all artifacts
      let totalSize = 0;
      if (modelData.modelTopology) {
        totalSize += JSON.stringify(modelData.modelTopology).length;
      }
      if (modelData.weightSpecs) {
        totalSize += JSON.stringify(modelData.weightSpecs).length;
      }
      if (modelData.weightData) {
        totalSize += modelData.weightData.byteLength;
      }

      return totalSize;
    } catch (error) {
      console.warn('Model size calculation failed:', error);
      return 0;
    }
  }

  /**
   * Calculate weight importance for pruning
   */
  private async calculateWeightImportance(model: tf.LayersModel): Promise<number[][]> {
    const importanceScores: number[][] = [];

    for (let i = 0; i < model.layers.length; i++) {
      const layer = model.layers[i];
      const layerScores: number[] = [];

      if (layer instanceof tf.layers.Dense) {
        const weights = layer.getWeights()[0];
        if (weights) {
          const weightsArray = await weights.array();
          
          // Calculate L1 norm for weight importance
          for (let j = 0; j < weightsArray.length; j++) {
            let sum = 0;
            for (let k = 0; k < weightsArray[j].length; k++) {
              sum += Math.abs(weightsArray[j][k]);
            }
            layerScores.push(sum);
          }
        }
      }

      importanceScores.push(layerScores);
    }

    return importanceScores;
  }

  /**
   * Get pruning threshold based on optimization level
   */
  private getPruningThreshold(): number {
    switch (this.config.optimizationLevel) {
      case 'minimal':
        return 0.1; // 10% pruning
      case 'balanced':
        return 0.3; // 30% pruning
      case 'aggressive':
        return 0.5; // 50% pruning
      default:
        return 0.3;
    }
  }

  /**
   * Quantize tensor to specified precision
   */
  private quantizeTensor(tensor: tf.Tensor, level: string): tf.Tensor {
    if (level === 'int8') {
      // Convert to int8 quantization
      return tf.cast(tf.clipByValue(tensor, -127, 127), 'int8');
    } else {
      // Convert to float16
      return tf.cast(tensor, 'float16');
    }
  }

  /**
   * Prune weights based on importance scores
   */
  private pruneWeights(
    weights: tf.Tensor,
    importanceScores: number[],
    threshold: number
  ): tf.Tensor {
    const weightsArray = weights.arraySync();
    const prunedWeights = [];

    // Sort neurons by importance and keep top (1-threshold)%
    const thresholdIndex = Math.floor(weightsArray.length * (1 - threshold));

    for (let i = 0; i < weightsArray.length; i++) {
      if (i < thresholdIndex || importanceScores[i] > threshold) {
        prunedWeights.push(weightsArray[i]);
      } else {
        // Zero out pruned weights
        prunedWeights.push(new Array(weightsArray[0].length).fill(0));
      }
    }

    return tf.tensor2d(prunedWeights);
  }

  /**
   * Calibrate quantization with provided data
   */
  private async calibrateQuantization(model: tf.LayersModel, calibrationData: tf.Tensor): Promise<void> {
    // This would implement quantization aware training
    // For now, it's a placeholder
    console.log('[MLModelOptimizer] Calibrating quantization with provided data');
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const total = this.optimizationStats.cacheHits + this.optimizationStats.cacheMisses;
    return total > 0 ? this.optimizationStats.cacheHits / total : 0;
  }

  /**
   * Calculate WebGL utilization
   */
  private calculateWebGLUtilization(): number {
    try {
      const memory = tf.memory();
      const gl = tf.backend().gl;
      if (!gl) return 0;

      // Estimate WebGL memory usage
      const textureMemory = memory.numTensors * 1024; // Rough estimate
      const maxTextureMemory = gl.getParameter(gl.MAX_TEXTURE_SIZE) ** 2 * 4; // RGBA

      return Math.min(textureMemory / maxTextureMemory, 1.0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate optimization report
   */
  private generateOptimizationReport(
    originalMetrics: ModelMetrics,
    optimizedMetrics: ModelMetrics,
    optimizationsApplied: string[]
  ): OptimizationReport {
    const speedup = originalMetrics.inferenceTime / optimizedMetrics.inferenceTime;
    const memoryReduction = ((originalMetrics.modelSize - optimizedMetrics.modelSize) / originalMetrics.modelSize) * 100;
    const throughputIncrease = ((optimizedMetrics.throughput - originalMetrics.throughput) / originalMetrics.throughput) * 100;

    const healthStatus = this.determineHealthStatus(speedup, memoryReduction, optimizedMetrics.inferenceTime);
    const recommendations = this.generateRecommendations(optimizedMetrics, optimizationsApplied);

    return {
      modelMetrics: optimizedMetrics,
      optimizationsApplied,
      performanceImprovements: {
        speedup,
        memoryReduction,
        throughputIncrease
      },
      recommendations,
      healthStatus
    };
  }

  /**
   * Determine health status based on performance metrics
   */
  private determineHealthStatus(speedup: number, memoryReduction: number, inferenceTime: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (speedup >= 2.0 && memoryReduction >= 50 && inferenceTime < this.config.maxLatency) {
      return 'excellent';
    } else if (speedup >= 1.5 && memoryReduction >= 30 && inferenceTime < this.config.maxLatency * 1.5) {
      return 'good';
    } else if (speedup >= 1.2 && memoryReduction >= 15 && inferenceTime < this.config.maxLatency * 2) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * Generate recommendations for further optimization
   */
  private generateRecommendations(metrics: ModelMetrics, optimizationsApplied: string[]): string[] {
    const recommendations: string[] = [];

    if (metrics.inferenceTime > this.config.maxLatency) {
      recommendations.push('Consider further model pruning or quantization');
    }

    if (metrics.modelSize > this.config.maxModelSize * 1024 * 1024) {
      recommendations.push('Model size exceeds configured limit, apply aggressive optimization');
    }

    if (metrics.throughput < this.config.targetThroughput) {
      recommendations.push('Enable batch processing for better throughput');
    }

    if (metrics.webglUtilization < 0.5) {
      recommendations.push('WebGL utilization is low, check GPU settings');
    }

    if (!optimizationsApplied.includes('quantization')) {
      recommendations.push('Consider enabling quantization for better performance');
    }

    if (!optimizationsApplied.includes('pruning')) {
      recommendations.push('Consider enabling pruning for smaller model size');
    }

    return recommendations;
  }

  /**
   * Update optimization statistics
   */
  private updateOptimizationStats(report: OptimizationReport): void {
    this.optimizationStats.totalOptimizations++;
    
    const improvements = report.performanceImprovements;
    this.optimizationStats.averageSpeedup = 
      (this.optimizationStats.averageSpeedup * (this.optimizationStats.totalOptimizations - 1) + improvements.speedup) / 
      this.optimizationStats.totalOptimizations;
    
    this.optimizationStats.totalMemorySaved += improvements.memoryReduction;
  }

  /**
   * Collect performance metrics
   */
  private collectPerformanceMetrics(): void {
    const currentMetrics: ModelMetrics = {
      modelName: 'system',
      inputSize: 0,
      outputSize: 0,
      parameterCount: 0,
      modelSize: tf.memory().numBytes,
      inferenceTime: 0,
      memoryUsage: tf.memory().numBytes,
      throughput: 0,
      accuracy: 1.0,
      quantizationRatio: 1.0,
      pruningRatio: 1.0,
      cacheHitRate: this.calculateCacheHitRate(),
      webglUtilization: this.calculateWebGLUtilization(),
      timestamp: Date.now()
    };

    this.performanceHistory.push(currentMetrics);

    // Keep only last 1000 entries
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }
  }

  /**
   * Get performance dashboard data
   */
  getPerformanceDashboard(): {
    currentMetrics: ModelMetrics;
    history: ModelMetrics[];
    optimizationStats: typeof this.optimizationStats;
    health: string;
    recommendations: string[];
  } {
    const latestMetrics = this.performanceHistory[this.performanceHistory.length - 1];
    
    return {
      currentMetrics: latestMetrics,
      history: this.performanceHistory,
      optimizationStats: this.optimizationStats,
      health: this.assessOverallHealth(),
      recommendations: this.generateSystemRecommendations()
    };
  }

  /**
   * Assess overall system health
   */
  private assessOverallHealth(): string {
    if (this.performanceHistory.length < 2) return 'unknown';

    const latest = this.performanceHistory[this.performanceHistory.length - 1];
    const previous = this.performanceHistory[this.performanceHistory.length - 2];

    const memoryTrend = latest.memoryUsage - previous.memoryUsage;
    const throughput = this.optimizationStats.totalOptimizations > 0 ? 
      this.optimizationStats.averageSpeedup : 1.0;

    if (throughput >= 1.5 && memoryTrend < 1000000) { // < 1MB memory growth
      return 'excellent';
    } else if (throughput >= 1.2 && memoryTrend < 5000000) { // < 5MB memory growth
      return 'good';
    } else if (throughput >= 1.0 && memoryTrend < 10000000) { // < 10MB memory growth
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * Generate system-wide recommendations
   */
  private generateSystemRecommendations(): string[] {
    const recommendations: string[] = [];
    const dashboard = this.getPerformanceDashboard();

    if (dashboard.health === 'poor') {
      recommendations.push('System performance is poor, consider comprehensive optimization');
    }

    if (dashboard.optimizationStats.failedOptimizations > dashboard.optimizationStats.totalOptimizations * 0.3) {
      recommendations.push('High optimization failure rate, review optimization settings');
    }

    if (dashboard.currentMetrics.memoryUsage > 100 * 1024 * 1024) { // > 100MB
      recommendations.push('High memory usage, consider memory cleanup');
    }

    if (dashboard.currentMetrics.webglUtilization < 0.3) {
      recommendations.push('Low WebGL utilization, check GPU acceleration');
    }

    return recommendations;
  }

  /**
   * Get cached model
   */
  getCachedModel(modelName: string): tf.LayersModel | null {
    return this.modelCache.get(modelName) || null;
  }

  /**
   * Clear all cached models
   */
  clearCache(): void {
    this.modelCache.forEach(model => model.dispose());
    this.modelCache.clear();
    console.log('[MLModelOptimizer] Model cache cleared');
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    return { ...this.optimizationStats };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clear cached models
      this.clearCache();

      // Clear performance history
      this.performanceHistory = [];

      // Clear metrics
      this.modelMetrics.clear();

      // Dispose TensorFlow.js resources
      await tf.disposeVariables();

      this.isInitialized = false;
      console.log('[MLModelOptimizer] Cleanup completed');

    } catch (error) {
      console.error('[MLModelOptimizer] Cleanup failed:', error);
    }
  }
}

/**
 * Batch processor for efficient handling of multiple inputs
 */
class BatchProcessor {
  private config: BatchProcessingConfig;
  private queue: Array<{
    input: any;
    resolve: Function;
    reject: Function;
    priority: number;
    timestamp: number;
  }> = [];
  private isProcessing = false;

  constructor(config: BatchProcessingConfig) {
    this.config = config;
  }

  async processBatch<T, R>(
    inputs: T[],
    processFunction: (batch: T[]) => Promise<R[]>,
    options?: Partial<BatchProcessingConfig>
  ): Promise<R[]> {
    const config = { ...this.config, ...options };

    if (inputs.length === 1) {
      // Single input, process directly
      return processFunction([inputs[0]]);
    }

    // Add to processing queue
    const promises = inputs.map(input => {
      return new Promise<R>((resolve, reject) => {
        this.queue.push({
          input,
          resolve,
          reject,
          priority: 1, // Default priority
          timestamp: Date.now()
        });
      });
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue(processFunction, config);
    }

    return Promise.all(promises);
  }

  private async processQueue<T, R>(
    processFunction: (batch: T[]) => Promise<R[]>,
    config: BatchProcessingConfig
  ): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Get batch of inputs
        const batchSize = Math.min(config.batchSize, this.queue.length);
        const batch = this.queue.splice(0, batchSize);
        const inputs = batch.map(item => item.input);

        try {
          // Process batch
          const results = await Promise.race([
            processFunction(inputs),
            new Promise<R[]>((_, reject) => 
              setTimeout(() => reject(new Error('Batch processing timeout')), config.timeoutMs)
            )
          ]);

          // Resolve promises
          batch.forEach((item, index) => {
            item.resolve(results[index]);
          });

        } catch (error) {
          // Reject all promises in batch
          batch.forEach(item => {
            item.reject(error);
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}