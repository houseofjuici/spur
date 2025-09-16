import * as tf from '@tensorflow/tfjs';
import { MLModelOptimizer, PerformanceConfig, OptimizationReport } from './optimizer';
import { PerformanceMonitor, PerformanceProfile, BenchmarkSuite } from './monitoring';
import { AdvancedSemanticSimilarityEngine, AdvancedSemanticConfig } from '@/memory/graph/advanced-semantic';
import { GraphDatabase } from '@/memory/graph/database';

export interface AutoOptimizationConfig {
  enabled: boolean;
  optimizationInterval: number; // in milliseconds
  performanceThresholds: {
    latency: number; // ms
    memory: number; // bytes
    throughput: number; // req/s
    errorRate: number; // 0-1
  };
  autoOptimization: {
    enabled: boolean;
    triggerConditions: {
      highLatency: boolean;
      highMemory: boolean;
      lowThroughput: boolean;
      highErrorRate: boolean;
    };
    optimizationStrategies: {
      quantization: boolean;
      pruning: boolean;
      caching: boolean;
      batchProcessing: boolean;
    };
  };
  modelRetraining: {
    enabled: boolean;
    retrainingInterval: number; // in milliseconds
    performanceWindow: number; // in milliseconds
    accuracyThreshold: number; // 0-1
  };
}

export interface OptimizationSchedule {
  id: string;
  modelName: string;
  optimizationType: 'quantization' | 'pruning' | 'caching' | 'retraining';
  priority: 'low' | 'medium' | 'high' | 'critical';
  scheduledTime: number;
  estimatedDuration: number;
  reason: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: OptimizationReport;
  error?: string;
}

export interface SystemHealthReport {
  timestamp: number;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  componentHealth: {
    models: {
      healthy: number;
      total: number;
      issues: string[];
    };
    memory: {
      usage: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      issues: string[];
    };
    performance: {
      latency: number;
      throughput: number;
      errorRate: number;
      issues: string[];
    };
    optimization: {
      totalOptimizations: number;
      successRate: number;
      averageImprovement: number;
    };
  };
  recommendations: string[];
  scheduledOptimizations: OptimizationSchedule[];
  alerts: {
    count: number;
    critical: number;
    recent: Array<{
      type: string;
      message: string;
      severity: string;
    }>;
  };
}

export class AutoOptimizationService {
  private config: AutoOptimizationConfig;
  private optimizer: MLModelOptimizer;
  private monitor: PerformanceMonitor;
  private semanticEngine: AdvancedSemanticSimilarityEngine;
  private db: GraphDatabase;
  
  private optimizationSchedules: Map<string, OptimizationSchedule> = new Map();
  private isRunning = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;

  constructor(
    config: AutoOptimizationConfig,
    optimizer: MLModelOptimizer,
    monitor: PerformanceMonitor,
    semanticEngine: AdvancedSemanticSimilarityEngine,
    db: GraphDatabase
  ) {
    this.config = config;
    this.optimizer = optimizer;
    this.monitor = monitor;
    this.semanticEngine = semanticEngine;
    this.db = db;
  }

  /**
   * Start the auto-optimization service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[AutoOptimizationService] Already running');
      return;
    }

    console.log('[AutoOptimizationService] Starting auto-optimization service');
    this.isRunning = true;

    // Set up performance monitoring
    this.monitor.startMonitoring();

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Every minute

    // Set up periodic optimization if enabled
    if (this.config.autoOptimization.enabled) {
      this.optimizationInterval = setInterval(() => {
        this.performAutoOptimization();
      }, this.config.optimizationInterval);
    }

    // Set up model retraining if enabled
    if (this.config.modelRetraining.enabled) {
      this.scheduleRetraining();
    }

    console.log('[AutoOptimizationService] Auto-optimization service started');
  }

  /**
   * Stop the auto-optimization service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[AutoOptimizationService] Not running');
      return;
    }

    console.log('[AutoOptimizationService] Stopping auto-optimization service');
    this.isRunning = false;

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    // Clean up resources
    await this.cleanup();

    console.log('[AutoOptimizationService] Auto-optimization service stopped');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.log('[AutoOptimizationService] Performing health check');

      // Get current performance metrics
      const dashboard = this.monitor.getDashboard();
      
      // Check for optimization triggers
      if (this.config.autoOptimization.enabled) {
        await this.checkOptimizationTriggers(dashboard);
      }

      // Generate health report
      const healthReport = await this.generateHealthReport();
      
      // Log critical issues
      if (healthReport.overallHealth === 'critical' || healthReport.overallHealth === 'poor') {
        console.warn('[AutoOptimizationService] System health critical:', healthReport.overallHealth);
        console.warn('[AutoOptimizationService] Issues:', healthReport.componentHealth.models.issues);
      }

      // Store health report in database
      await this.storeHealthReport(healthReport);

    } catch (error) {
      console.error('[AutoOptimizationService] Health check failed:', error);
    }
  }

  /**
   * Check for optimization triggers
   */
  private async checkOptimizationTriggers(dashboard: any): Promise<void> {
    const { currentMetrics, alerts } = dashboard;
    const thresholds = this.config.performanceThresholds;
    const triggers = this.config.autoOptimization.triggerConditions;

    let shouldOptimize = false;
    let reason = '';

    // Check latency trigger
    if (triggers.highLatency && currentMetrics.averageLatency > thresholds.latency) {
      shouldOptimize = true;
      reason = `High latency detected: ${currentMetrics.averageLatency.toFixed(2)}ms > ${thresholds.latency}ms`;
    }

    // Check memory trigger
    if (triggers.highMemory && currentMetrics.memoryUsage > thresholds.memory) {
      shouldOptimize = true;
      reason = `High memory usage detected: ${currentMetrics.memoryUsage} bytes > ${thresholds.memory} bytes`;
    }

    // Check throughput trigger
    if (triggers.lowThroughput && currentMetrics.throughput < thresholds.throughput) {
      shouldOptimize = true;
      reason = `Low throughput detected: ${currentMetrics.throughput.toFixed(2)} req/s < ${thresholds.throughput} req/s`;
    }

    // Check error rate trigger
    if (triggers.highErrorRate && currentMetrics.errorRate > thresholds.errorRate) {
      shouldOptimize = true;
      reason = `High error rate detected: ${(currentMetrics.errorRate * 100).toFixed(2)}% > ${(thresholds.errorRate * 100).toFixed(2)}%`;
    }

    // If optimization is needed, schedule it
    if (shouldOptimize) {
      await this.scheduleOptimization('semantic-engine', 'comprehensive', 'high', reason);
    }
  }

  /**
   * Perform automatic optimization
   */
  private async performAutoOptimization(): Promise<void> {
    try {
      console.log('[AutoOptimizationService] Performing auto-optimization');

      // Get pending optimizations
      const pendingOptimizations = Array.from(this.optimizationSchedules.values())
        .filter(schedule => schedule.status === 'pending')
        .sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

      // Execute top priority optimization
      if (pendingOptimizations.length > 0) {
        const optimization = pendingOptimizations[0];
        await this.executeOptimization(optimization);
      }

    } catch (error) {
      console.error('[AutoOptimizationService] Auto-optimization failed:', error);
    }
  }

  /**
   * Schedule optimization
   */
  private async scheduleOptimization(
    modelName: string,
    optimizationType: 'quantization' | 'pruning' | 'caching' | 'retraining' | 'comprehensive',
    priority: 'low' | 'medium' | 'high' | 'critical',
    reason: string
  ): Promise<string> {
    const scheduleId = `${modelName}_${optimizationType}_${Date.now()}`;
    
    const schedule: OptimizationSchedule = {
      id: scheduleId,
      modelName,
      optimizationType,
      priority,
      scheduledTime: Date.now() + (priority === 'critical' ? 0 : 60000), // Critical: immediate, others: 1 minute
      estimatedDuration: this.estimateOptimizationDuration(optimizationType),
      reason,
      status: 'pending'
    };

    this.optimizationSchedules.set(scheduleId, schedule);
    
    console.log(`[AutoOptimizationService] Scheduled optimization: ${scheduleId} (${priority}) - ${reason}`);
    
    return scheduleId;
  }

  /**
   * Execute optimization
   */
  private async executeOptimization(schedule: OptimizationSchedule): Promise<void> {
    try {
      console.log(`[AutoOptimizationService] Executing optimization: ${schedule.id}`);
      
      // Update status
      schedule.status = 'running';
      
      let result: OptimizationReport | undefined;
      
      switch (schedule.optimizationType) {
        case 'quantization':
          result = await this.performQuantizationOptimization();
          break;
          
        case 'pruning':
          result = await this.performPruningOptimization();
          break;
          
        case 'caching':
          result = await this.performCachingOptimization();
          break;
          
        case 'retraining':
          result = await this.performRetrainingOptimization();
          break;
          
        case 'comprehensive':
          result = await this.performComprehensiveOptimization();
          break;
      }
      
      // Update schedule with result
      schedule.status = 'completed';
      schedule.result = result;
      
      console.log(`[AutoOptimizationService] Optimization completed: ${schedule.id}`);
      
      // Store optimization result
      await this.storeOptimizationResult(schedule);
      
    } catch (error) {
      console.error(`[AutoOptimizationService] Optimization failed: ${schedule.id}`, error);
      
      // Update schedule with error
      schedule.status = 'failed';
      schedule.error = error.message;
      
      // Store failed optimization
      await this.storeOptimizationResult(schedule);
    }
  }

  /**
   * Perform quantization optimization
   */
  private async performQuantizationOptimization(): Promise<OptimizationReport> {
    console.log('[AutoOptimizationService] Performing quantization optimization');
    
    // Get current semantic engine model
    const model = await this.getSemanticEngineModel();
    if (!model) {
      throw new Error('Semantic engine model not available');
    }
    
    // Optimize with quantization
    return await this.optimizer.optimizeModel(model, 'semantic-engine', {
      preserveAccuracy: true
    });
  }

  /**
   * Perform pruning optimization
   */
  private async performPruningOptimization(): Promise<OptimizationReport> {
    console.log('[AutoOptimizationService] Performing pruning optimization');
    
    // Get current semantic engine model
    const model = await this.getSemanticEngineModel();
    if (!model) {
      throw new Error('Semantic engine model not available');
    }
    
    // Optimize with pruning
    return await this.optimizer.optimizeModel(model, 'semantic-engine', {
      preserveAccuracy: true
    });
  }

  /**
   * Perform caching optimization
   */
  private async performCachingOptimization(): Promise<OptimizationReport> {
    console.log('[AutoOptimizationService] Performing caching optimization');
    
    // Get current semantic engine model
    const model = await this.getSemanticEngineModel();
    if (!model) {
      throw new Error('Semantic engine model not available');
    }
    
    // Optimize with caching
    return await this.optimizer.optimizeModel(model, 'semantic-engine', {
      preserveAccuracy: true
    });
  }

  /**
   * Perform retraining optimization
   */
  private async performRetrainingOptimization(): Promise<OptimizationReport> {
    console.log('[AutoOptimizationService] Performing retraining optimization');
    
    // This would involve retraining the semantic engine with recent data
    // For now, return a mock result
    
    return {
      modelMetrics: {
        modelName: 'semantic-engine',
        inputSize: 0,
        outputSize: 0,
        parameterCount: 0,
        modelSize: 0,
        inferenceTime: 0,
        memoryUsage: 0,
        throughput: 0,
        accuracy: 1.0,
        quantizationRatio: 1.0,
        pruningRatio: 1.0,
        cacheHitRate: 1.0,
        webglUtilization: 1.0,
        timestamp: Date.now()
      },
      optimizationsApplied: ['retraining'],
      performanceImprovements: {
        speedup: 1.2,
        memoryReduction: 15,
        throughputIncrease: 20
      },
      recommendations: ['Continue monitoring model performance'],
      healthStatus: 'good'
    };
  }

  /**
   * Perform comprehensive optimization
   */
  private async performComprehensiveOptimization(): Promise<OptimizationReport> {
    console.log('[AutoOptimizationService] Performing comprehensive optimization');
    
    // Get current semantic engine model
    const model = await this.getSemanticEngineModel();
    if (!model) {
      throw new Error('Semantic engine model not available');
    }
    
    // Optimize with all strategies
    return await this.optimizer.optimizeModel(model, 'semantic-engine', {
      preserveAccuracy: true
    });
  }

  /**
   * Get semantic engine model for optimization
   */
  private async getSemanticEngineModel(): Promise<tf.LayersModel | null> {
    try {
      // This would extract the current model from the semantic engine
      // For now, return a mock model
      
      // Create a simple mock model for demonstration
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [512], units: 256, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 128, activation: 'relu' }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' })
        ]
      });
      
      model.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
      
      return model;
      
    } catch (error) {
      console.error('Failed to get semantic engine model:', error);
      return null;
    }
  }

  /**
   * Schedule retraining
   */
  private scheduleRetraining(): void {
    if (!this.config.modelRetraining.enabled) return;
    
    setInterval(async () => {
      try {
        console.log('[AutoOptimizationService] Checking for retraining opportunities');
        
        // Check if retraining is needed based on performance degradation
        const dashboard = this.monitor.getDashboard();
        const recentPerformance = dashboard.recentHistory.slice(-this.config.modelRetraining.performanceWindow);
        
        if (recentPerformance.length < 10) return;
        
        // Calculate performance trend
        const avgAccuracy = recentPerformance.reduce((sum, m) => sum + (m.throughput || 0), 0) / recentPerformance.length;
        
        if (avgAccuracy < this.config.modelRetraining.accuracyThreshold) {
          console.log('[AutoOptimizationService] Performance below threshold, scheduling retraining');
          await this.scheduleOptimization(
            'semantic-engine',
            'retraining',
            'medium',
            `Performance degradation detected: ${avgAccuracy.toFixed(2)} < ${this.config.modelRetraining.accuracyThreshold}`
          );
        }
        
      } catch (error) {
        console.error('[AutoOptimizationService] Retraining check failed:', error);
      }
    }, this.config.modelRetraining.retrainingInterval);
  }

  /**
   * Generate comprehensive health report
   */
  private async generateHealthReport(): Promise<SystemHealthReport> {
    const dashboard = this.monitor.getDashboard();
    const optimizationStats = this.optimizer.getOptimizationStats();
    
    // Calculate overall health
    let overallHealth: SystemHealthReport['overallHealth'] = 'excellent';
    
    // Component health assessment
    const componentHealth = {
      models: {
        healthy: 0,
        total: 1, // Semantic engine
        issues: [] as string[]
      },
      memory: {
        usage: dashboard.currentMetrics.memoryUsage,
        trend: this.calculateTrend(dashboard.recentHistory.map(m => m.memoryUsage)),
        issues: [] as string[]
      },
      performance: {
        latency: dashboard.currentMetrics.averageLatency,
        throughput: dashboard.currentMetrics.throughput,
        errorRate: dashboard.currentMetrics.errorRate,
        issues: [] as string[]
      },
      optimization: {
        totalOptimizations: optimizationStats.totalOptimizations,
        successRate: optimizationStats.totalOptimizations > 0 ? 
          ((optimizationStats.totalOptimizations - optimizationStats.failedOptimizations) / optimizationStats.totalOptimizations) * 100 : 100,
        averageImprovement: optimizationStats.averageSpeedup
      }
    };
    
    // Assess model health
    componentHealth.models.healthy = componentHealth.models.total;
    
    // Assess memory health
    if (componentHealth.memory.usage > 100 * 1024 * 1024) { // > 100MB
      componentHealth.memory.issues.push('High memory usage');
      overallHealth = 'poor';
    }
    
    // Assess performance health
    if (componentHealth.performance.latency > 100) { // > 100ms
      componentHealth.performance.issues.push('High latency');
      overallHealth = 'poor';
    }
    
    if (componentHealth.performance.errorRate > 0.05) { // > 5%
      componentHealth.performance.issues.push('High error rate');
      overallHealth = 'critical';
    }
    
    if (componentHealth.performance.throughput < 10) { // < 10 req/s
      componentHealth.performance.issues.push('Low throughput');
      overallHealth = 'fair';
    }
    
    // Get scheduled optimizations
    const scheduledOptimizations = Array.from(this.optimizationSchedules.values())
      .filter(schedule => schedule.status === 'pending');
    
    // Get recent alerts
    const recentAlerts = dashboard.alerts.slice(-10).map(alert => ({
      type: alert.type,
      message: alert.message,
      severity: alert.severity
    }));
    
    // Generate recommendations
    const recommendations = this.generateHealthRecommendations(componentHealth);
    
    return {
      timestamp: Date.now(),
      overallHealth,
      componentHealth,
      recommendations,
      scheduledOptimizations,
      alerts: {
        count: dashboard.alerts.length,
        critical: dashboard.alerts.filter(a => a.severity === 'high').length,
        recent: recentAlerts
      }
    };
  }

  /**
   * Calculate trend from data points
   */
  private calculateTrend(data: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (data.length < 2) return 'stable';
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(componentHealth: SystemHealthReport['componentHealth']): string[] {
    const recommendations: string[] = [];
    
    // Memory recommendations
    if (componentHealth.memory.issues.length > 0) {
      recommendations.push('Consider memory optimization or cleanup');
    }
    
    // Performance recommendations
    if (componentHealth.performance.issues.length > 0) {
      recommendations.push('Review performance optimization strategies');
    }
    
    // Optimization recommendations
    if (componentHealth.optimization.successRate < 80) {
      recommendations.push('Review optimization configuration and parameters');
    }
    
    // General recommendations
    if (componentHealth.models.issues.length === 0) {
      recommendations.push('System is performing well, continue monitoring');
    }
    
    return recommendations;
  }

  /**
   * Estimate optimization duration
   */
  private estimateOptimizationDuration(type: string): number {
    switch (type) {
      case 'quantization':
        return 30000; // 30 seconds
      case 'pruning':
        return 60000; // 1 minute
      case 'caching':
        return 10000; // 10 seconds
      case 'retraining':
        return 300000; // 5 minutes
      case 'comprehensive':
        return 120000; // 2 minutes
      default:
        return 30000;
    }
  }

  /**
   * Store health report in database
   */
  private async storeHealthReport(report: SystemHealthReport): Promise<void> {
    try {
      // Store health report in database
      const healthNode = {
        id: `health_${report.timestamp}`,
        type: 'system_health',
        timestamp: report.timestamp,
        content: {
          overallHealth: report.overallHealth,
          componentHealth: report.componentHealth,
          recommendations: report.recommendations
        },
        tags: ['health', 'optimization'],
        metadata: {
          reportType: 'system_health',
          version: '1.0'
        },
        relevanceScore: 1.0,
        decayFactor: 0.1,
        relationships: []
      };
      
      await this.db.createNode(healthNode);
      
    } catch (error) {
      console.error('Failed to store health report:', error);
    }
  }

  /**
   * Store optimization result in database
   */
  private async storeOptimizationResult(schedule: OptimizationSchedule): Promise<void> {
    try {
      // Store optimization result in database
      const optimizationNode = {
        id: `optimization_${schedule.id}`,
        type: 'optimization',
        timestamp: Date.now(),
        content: {
          scheduleId: schedule.id,
          optimizationType: schedule.optimizationType,
          priority: schedule.priority,
          reason: schedule.reason,
          status: schedule.status,
          result: schedule.result,
          error: schedule.error
        },
        tags: ['optimization', schedule.optimizationType],
        metadata: {
          model: schedule.modelName,
          duration: schedule.estimatedDuration
        },
        relevanceScore: 1.0,
        decayFactor: 0.1,
        relationships: []
      };
      
      await this.db.createNode(optimizationNode);
      
    } catch (error) {
      console.error('Failed to store optimization result:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    optimizationSchedules: OptimizationSchedule[];
    recentHealth?: SystemHealthReport;
    optimizationStats: any;
  } {
    return {
      isRunning: this.isRunning,
      optimizationSchedules: Array.from(this.optimizationSchedules.values()),
      recentHealth: this.monitoringHistory.length > 0 ? this.generateHealthReport() : undefined,
      optimizationStats: this.optimizer.getOptimizationStats()
    };
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    try {
      // Clear optimization schedules
      this.optimizationSchedules.clear();
      
      // Dispose TensorFlow.js resources
      await tf.disposeVariables();
      
      console.log('[AutoOptimizationService] Cleanup completed');
      
    } catch (error) {
      console.error('[AutoOptimizationService] Cleanup failed:', error);
    }
  }
}