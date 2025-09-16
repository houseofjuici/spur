import { 
  BaseEvent, 
  EventType, 
  EventSource, 
  MemoryContext 
} from '@/types';
import { EnhancedEvent } from '@/types/events';
import { CollectorManager, CollectorManagerConfig } from './collectors/manager';
import { EventNormalizer, NormalizationConfig } from './normalizer';
import { AssistantContextStream, StreamConfig } from './stream';
import { PerformanceMonitor, PerformanceConfig } from './monitor/enhanced';

export interface UnifiedCaptureEngineConfig {
  enabled: boolean;
  collectors: CollectorManagerConfig;
  normalizer: NormalizationConfig;
  stream: StreamConfig;
  performance: PerformanceConfig;
  global: {
    maxMemoryUsage: number; // MB
    dataRetention: number; // hours
    autoCleanup: boolean;
    cleanupInterval: number; // minutes
    debugMode: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
}

export interface EngineMetrics {
  uptime: number;
  eventsProcessed: number;
  eventsStored: number;
  eventsFiltered: number;
  eventsDropped: number;
  averageProcessingTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  healthScore: number;
  lastActivity: number;
}

export interface EngineStatus {
  isRunning: boolean;
  isHealthy: boolean;
  components: {
    collectors: 'running' | 'stopped' | 'error';
    normalizer: 'running' | 'stopped' | 'error';
    stream: 'running' | 'stopped' | 'error';
    performance: 'running' | 'stopped' | 'error';
  };
  metrics: EngineMetrics;
  alerts: any[];
  recommendations: string[];
}

export class UnifiedCaptureEngine {
  private config: UnifiedCaptureEngineConfig;
  private isInitialized = false;
  private isRunning = false;
  private startTime: number;
  
  // Core components
  private collectorManager: CollectorManager;
  private normalizer: EventNormalizer;
  private stream: AssistantContextStream;
  private performanceMonitor: PerformanceMonitor;
  
  // Event processing pipeline
  private eventQueue: EnhancedEvent[] = [];
  private isProcessing = false;
  private processingPromises: Set<Promise<void>> = new Set();
  
  // Metrics and monitoring
  private metrics: EngineMetrics;
  private cleanupInterval?: number;
  
  // Event handlers
  private eventHandlers: Set<(events: EnhancedEvent[]) => void> = new Set();
  private errorHandler?: (error: Error) => void;

  constructor(config: Partial<UnifiedCaptureEngineConfig> = {}) {
    this.config = {
      enabled: true,
      collectors: {
        globalEnabled: true,
        rateLimiting: {
          maxEventsPerSecond: 10,
          maxEventsPerMinute: 300,
          maxEventsPerHour: 10000,
          burstSize: 50,
          cooldownPeriod: 5000,
          adaptiveLimiting: true,
          priorityThresholds: { high: 8, medium: 5, low: 2 }
        },
        debouncing: {
          enabled: true,
          defaultDelay: 1000,
          actionDelays: {
            'navigation': 2000,
            'focus': 500,
            'scroll': 100,
            'click': 200
          },
          maxDelay: 5000,
          mergeSimilar: true,
          mergeWindow: 3000,
          keyGeneration: 'advanced'
        },
        errorHandling: {
          maxRetries: 3,
          retryDelay: 1000,
          fallbackMode: true
        },
        performance: {
          maxMemoryUsage: 100,
          maxCpuUsage: 80,
          processingTimeout: 5000
        },
        collectors: {
          browser: { enabled: true, captureFrequency: 1000, batchSize: 10 },
          system: { enabled: false, captureFrequency: 2000, batchSize: 5 }
        }
      },
      normalizer: {
        enabled: true,
        validationLevel: 'strict',
        enrichmentEnabled: true,
        privacyProtection: true,
        maxContentLength: 10000,
        piiDetection: true,
        entityExtraction: true,
        sentimentAnalysis: true,
        keywordExtraction: true,
        topicModeling: true,
        qualityScoring: true
      },
      stream: {
        enabled: true,
        bufferSize: 100,
        flushInterval: 1000,
        maxContextAge: 3600000,
        enableRealtime: true,
        enableContextualization: true,
        enablePersonalization: true,
        privacyFilter: true,
        compressionEnabled: true,
        maxEventsPerContext: 50,
        relevanceThreshold: 0.3
      },
      performance: {
        enabled: true,
        monitoringInterval: 5000,
        alertThresholds: {
          cpu: { warning: 70, critical: 90 },
          memory: { warning: 80, critical: 95 },
          eventProcessing: { warning: 100, critical: 500 },
          errorRate: { warning: 5, critical: 10 },
          latency: { warning: 100, critical: 500 },
          throughput: { warning: 50, critical: 20 },
          bufferSize: { warning: 80, critical: 95 }
        },
        metricsRetention: 3600000,
        enableProfiling: true,
        enableMemoryTracking: true,
        enableCpuTracking: true,
        enableNetworkTracking: true,
        enableResourceTracking: true,
        samplingRate: 0.1,
        maxMetricsHistory: 720
      },
      global: {
        maxMemoryUsage: 200,
        dataRetention: 24,
        autoCleanup: true,
        cleanupInterval: 60,
        debugMode: false,
        logLevel: 'info'
      },
      ...config
    };

    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();

    // Initialize core components
    this.collectorManager = new CollectorManager(this.config.collectors);
    this.normalizer = new EventNormalizer(this.config.normalizer);
    this.stream = new AssistantContextStream(this.config.stream);
    this.performanceMonitor = new PerformanceMonitor(this.config.performance);

    this.setupComponentIntegration();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[UnifiedCaptureEngine] Initializing...');

      // Initialize performance monitoring first
      if (this.config.performance.enabled) {
        await this.performanceMonitor.start();
        this.log('info', 'Performance monitor initialized');
      }

      // Initialize event normalizer
      if (this.config.normalizer.enabled) {
        this.log('info', 'Event normalizer initialized');
      }

      // Initialize context stream
      if (this.config.stream.enabled) {
        await this.stream.start();
        this.log('info', 'Context stream initialized');
      }

      // Initialize collector manager
      if (this.config.collectors.globalEnabled) {
        await this.collectorManager.start();
        this.log('info', 'Collector manager initialized');
      }

      // Set up event processing pipeline
      this.setupEventPipeline();

      // Set up cleanup tasks
      if (this.config.global.autoCleanup) {
        this.setupCleanupTasks();
      }

      this.isInitialized = true;
      this.metrics.lastActivity = Date.now();
      
      this.log('info', 'Unified capture engine initialized successfully');
      this.logEngineStatus();

    } catch (error) {
      console.error('[UnifiedCaptureEngine] Failed to initialize:', error);
      this.log('error', `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) return;

    try {
      console.log('[UnifiedCaptureEngine] Starting...');

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Start all components
      const startPromises = [
        this.config.collectors.globalEnabled ? this.collectorManager.start() : Promise.resolve(),
        this.config.stream.enabled ? this.stream.start() : Promise.resolve(),
        this.config.performance.enabled ? this.performanceMonitor.start() : Promise.resolve()
      ];

      await Promise.all(startPromises);

      this.isRunning = true;
      this.metrics.lastActivity = Date.now();
      
      this.log('info', 'Unified capture engine started successfully');
      this.logEngineStatus();

    } catch (error) {
      console.error('[UnifiedCaptureEngine] Failed to start:', error);
      this.log('error', `Start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[UnifiedCaptureEngine] Stopping...');

      // Stop all components
      const stopPromises = [
        this.collectorManager.stop(),
        this.stream.stop(),
        this.performanceMonitor.stop()
      ];

      await Promise.all(stopPromises);

      // Process remaining events
      await this.processEventQueue();

      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      this.isRunning = false;
      this.metrics.lastActivity = Date.now();
      
      this.log('info', 'Unified capture engine stopped successfully');

    } catch (error) {
      console.error('[UnifiedCaptureEngine] Error stopping:', error);
      this.log('error', `Stop error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private setupComponentIntegration(): void {
    // Set up event flow from collectors to normalizer to stream
    this.collectorManager.onEvents(async (events) => {
      try {
        await this.processRawEvents(events);
      } catch (error) {
        this.log('error', `Error processing collector events: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.handleError(error as Error);
      }
    });

    // Handle collector errors
    this.collectorManager.onError((error) => {
      this.log('error', `Collector manager error: ${error.message}`);
      this.handleError(error);
    });

    // Subscribe to stream messages for external processing
    this.stream.subscribe((message) => {
      this.handleStreamMessage(message);
    });

    // Subscribe to performance alerts
    this.performanceMonitor.onAlert((alert) => {
      this.log('warn', `Performance alert: ${alert.message}`);
      this.handlePerformanceAlert(alert);
    });

    // Subscribe to performance metrics
    this.performanceMonitor.subscribe((metrics) => {
      this.updatePerformanceMetrics(metrics);
    });
  }

  private setupEventPipeline(): void {
    // Event pipeline is set up through component integration
    // Additional pipeline setup can be added here
  }

  private setupCleanupTasks(): void {
    // Set up periodic cleanup
    this.cleanupInterval = window.setInterval(() => {
      this.performCleanup();
    }, this.config.global.cleanupInterval * 60000); // Convert minutes to milliseconds
  }

  private async processRawEvents(events: BaseEvent[]): Promise<void> {
    if (!this.isRunning || events.length === 0) return;

    const startTime = performance.now();
    
    try {
      // Add to processing queue
      this.eventQueue.push(...events.map(event => ({ ...event, timestamp: event.timestamp || Date.now() } as EnhancedEvent)));
      
      // Limit queue size to prevent memory issues
      if (this.eventQueue.length > 1000) {
        this.log('warn', 'Event queue size exceeded limit, dropping oldest events');
        this.eventQueue = this.eventQueue.slice(-500);
        this.metrics.eventsDropped += this.eventQueue.length - 500;
      }

      // Process queue if not already processing
      if (!this.isProcessing) {
        await this.processEventQueue();
      }

      // Update metrics
      this.metrics.eventsProcessed += events.length;
      this.metrics.lastActivity = Date.now();

    } catch (error) {
      this.log('error', `Error processing raw events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.handleError(error as Error);
    }
  }

  private async processEventQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, 50); // Process in batches
        const processingPromise = this.processEventBatch(batch);
        
        this.processingPromises.add(processingPromise);
        
        try {
          await processingPromise;
        } finally {
          this.processingPromises.delete(processingPromise);
        }

        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    } catch (error) {
      this.log('error', `Error processing event queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.handleError(error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEventBatch(events: EnhancedEvent[]): Promise<void> {
    if (events.length === 0) return;

    const batchStartTime = performance.now();

    try {
      // Normalize events
      let normalizedEvents = events;
      if (this.config.normalizer.enabled) {
        normalizedEvents = await this.normalizer.normalizeEvents(events);
        
        // Update metrics for normalization
        const normalizerMetrics = this.normalizer.getMetrics();
        this.metrics.eventsFiltered += normalizerMetrics.eventsProcessed - normalizedEvents.length;
      }

      // Send to context stream
      if (this.config.stream.enabled && normalizedEvents.length > 0) {
        await this.stream.processEvents(normalizedEvents);
      }

      // Update metrics
      const batchProcessingTime = performance.now() - batchStartTime;
      this.metrics.averageProcessingTime = this.updateAverage(
        this.metrics.averageProcessingTime,
        batchProcessingTime,
        this.metrics.eventsProcessed
      );

      // Notify external event handlers
      if (this.eventHandlers.size > 0) {
        const handlerPromises = Array.from(this.eventHandlers).map(handler => {
          try {
            handler(normalizedEvents);
          } catch (error) {
            this.log('error', `Error in event handler: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });
        await Promise.all(handlerPromises);
      }

      this.metrics.eventsStored += normalizedEvents.length;

    } catch (error) {
      this.log('error', `Error processing event batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.handleError(error as Error);
    }
  }

  private handleStreamMessage(message: any): void {
    // Handle incoming stream messages (e.g., from assistant)
    this.log('debug', `Received stream message: ${message.type}`);
    
    // External handlers can subscribe to stream events
    // through the getStream() method
  }

  private handlePerformanceAlert(alert: any): void {
    // Handle performance alerts
    this.log('warn', `Performance alert: ${alert.message}`);
    
    // Could trigger automatic mitigation strategies here
    if (alert.severity === 'critical' && alert.type === 'memory') {
      this.performEmergencyCleanup();
    }
  }

  private updatePerformanceMetrics(metrics: any): void {
    // Update engine metrics with performance monitor data
    this.metrics.memoryUsage = metrics.memory.used;
    this.metrics.cpuUsage = metrics.cpu.usage;
    this.metrics.healthScore = metrics.health.score;
  }

  private async performCleanup(): void {
    try {
      this.log('info', 'Performing cleanup tasks...');

      // Clear old events from queue
      const now = Date.now();
      const retentionPeriod = this.config.global.dataRetention * 3600000; // Convert hours to milliseconds
      const cutoffTime = now - retentionPeriod;

      this.eventQueue = this.eventQueue.filter(event => event.timestamp > cutoffTime);

      // Clean up normalizer cache
      if (this.config.normalizer.enabled) {
        this.normalizer.clearCache();
      }

      // Clean up performance monitor data
      if (this.config.performance.enabled) {
        // Performance monitor handles its own cleanup
      }

      // Check memory usage
      if (this.metrics.memoryUsage > this.config.global.maxMemoryUsage) {
        this.log('warn', `Memory usage high (${this.metrics.memoryUsage}MB), performing additional cleanup`);
        this.performEmergencyCleanup();
      }

      this.log('info', 'Cleanup completed');

    } catch (error) {
      this.log('error', `Error during cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private performEmergencyCleanup(): void {
    this.log('warn', 'Performing emergency cleanup...');

    // Aggressively clear queue
    this.eventQueue = this.eventQueue.slice(-100);

    // Clear caches
    if (this.config.normalizer.enabled) {
      this.normalizer.clearCache();
    }

    // Stop non-essential components
    if (this.config.stream.enabled) {
      this.stream.stop().catch(() => {});
    }

    this.log('warn', 'Emergency cleanup completed');
  }

  private handleError(error: Error): void {
    // Update error metrics
    this.metrics.errorRate = this.updateAverage(
      this.metrics.errorRate,
      1,
      this.metrics.eventsProcessed || 1
    );

    // Log error
    this.log('error', error.message);

    // Call external error handler if provided
    if (this.errorHandler) {
      try {
        this.errorHandler(error);
      } catch (handlerError) {
        console.error('[UnifiedCaptureEngine] Error in error handler:', handlerError);
      }
    }

    // Record error in performance monitor
    if (this.config.performance.enabled) {
      this.performanceMonitor.recordError('engine', error, 'unified-capture-engine');
    }
  }

  private initializeMetrics(): EngineMetrics {
    return {
      uptime: 0,
      eventsProcessed: 0,
      eventsStored: 0,
      eventsFiltered: 0,
      eventsDropped: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      healthScore: 100,
      lastActivity: Date.now()
    };
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string): void {
    if (this.config.global.debugMode || level === 'error' || 
        (this.config.global.logLevel === 'warn' && ['error', 'warn'].includes(level)) ||
        (this.config.global.logLevel === 'info' && ['error', 'warn', 'info'].includes(level)) ||
        this.config.global.logLevel === 'debug') {
      
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [UnifiedCaptureEngine] [${level.toUpperCase()}] ${message}`;
      
      switch (level) {
        case 'error':
          console.error(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        case 'info':
          console.log(logMessage);
          break;
        case 'debug':
          if (this.config.global.debugMode) {
            console.debug(logMessage);
          }
          break;
      }
    }
  }

  private logEngineStatus(): void {
    const status = this.getStatus();
    this.log('info', `Engine status: ${status.isRunning ? 'running' : 'stopped'}, healthy: ${status.isHealthy}, events processed: ${status.metrics.eventsProcessed}`);
  }

  // Public API methods
  onEvents(callback: (events: EnhancedEvent[]) => void): () => void {
    this.eventHandlers.add(callback);
    
    return () => {
      this.eventHandlers.delete(callback);
    };
  }

  onError(callback: (error: Error) => void): void {
    this.errorHandler = callback;
  }

  getStatus(): EngineStatus {
    const isHealthy = this.metrics.healthScore > 70 && 
                      this.metrics.errorRate < 5 && 
                      this.metrics.memoryUsage < this.config.global.maxMemoryUsage;

    return {
      isRunning: this.isRunning,
      isHealthy,
      components: {
        collectors: this.collectorManager.isCollectorRunning() ? 'running' : 'stopped',
        normalizer: 'running', // Normalizer is always "running" when enabled
        stream: this.isRunning && this.config.stream.enabled ? 'running' : 'stopped',
        performance: this.config.performance.enabled ? 'running' : 'stopped'
      },
      metrics: { ...this.metrics },
      alerts: this.config.performance.enabled ? this.performanceMonitor.getActiveAlerts() : [],
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.memoryUsage > this.config.global.maxMemoryUsage * 0.8) {
      recommendations.push('Memory usage is high, consider reducing data retention period');
    }

    if (this.metrics.errorRate > 5) {
      recommendations.push('High error rate detected, review error logs');
    }

    if (this.metrics.averageProcessingTime > 100) {
      recommendations.push('Event processing is slow, consider optimizing pipeline');
    }

    if (this.metrics.eventsDropped > this.metrics.eventsProcessed * 0.1) {
      recommendations.push('High event drop rate, consider increasing queue size or processing capacity');
    }

    return recommendations;
  }

  getMetrics(): EngineMetrics {
    // Update dynamic metrics
    this.metrics.uptime = Date.now() - this.startTime;
    
    return { ...this.metrics };
  }

  async getDetailedReport(): Promise<{
    engine: EngineStatus;
    collectors: any;
    normalizer: any;
    stream: any;
    performance: any;
    recommendations: string[];
  }> {
    return {
      engine: this.getStatus(),
      collectors: this.config.collectors.globalEnabled ? this.collectorManager.getMetrics() : null,
      normalizer: this.config.normalizer.enabled ? this.normalizer.getMetrics() : null,
      stream: this.config.stream.enabled ? this.stream.getMetrics() : null,
      performance: this.config.performance.enabled ? await this.performanceMonitor.generateReport() : null,
      recommendations: this.generateRecommendations()
    };
  }

  // Configuration methods
  async updateConfig(newConfig: Partial<UnifiedCaptureEngineConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Update component configurations
    if (newConfig.collectors) {
      this.collectorManager.updateConfig(newConfig.collectors);
    }
    
    if (newConfig.normalizer) {
      this.normalizer.updateConfig(newConfig.normalizer);
    }
    
    if (newConfig.stream) {
      this.stream.updateConfig(newConfig.stream);
    }
    
    if (newConfig.performance) {
      this.performanceMonitor.updateConfig(newConfig.performance);
    }

    // Restart cleanup tasks if interval changed
    if (newConfig.global?.cleanupInterval !== undefined && this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      if (this.config.global.autoCleanup) {
        this.setupCleanupTasks();
      }
    }

    this.log('info', 'Configuration updated');
  }

  getConfig(): UnifiedCaptureEngineConfig {
    return { ...this.config };
  }

  // Component access methods
  getCollectorManager(): CollectorManager {
    return this.collectorManager;
  }

  getNormalizer(): EventNormalizer {
    return this.normalizer;
  }

  getStream(): AssistantContextStream {
    return this.stream;
  }

  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  // Quick actions
  async quickCapture(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Trigger quick capture on browser collector
      const browserCollector = this.collectorManager.getCollector('browser');
      if (browserCollector) {
        await (browserCollector as any).quickCapture();
      }
    } catch (error) {
      this.log('error', `Quick capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async connectToWorkflow(url: string, title?: string): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Trigger workflow connection
      const browserCollector = this.collectorManager.getCollector('browser');
      if (browserCollector) {
        await (browserCollector as any).connectToWorkflow(url, title);
      }
    } catch (error) {
      this.log('error', `Workflow connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async emergencyStop(): Promise<void> {
    this.log('warn', 'Emergency stop initiated...');
    
    try {
      // Stop all components aggressively
      await Promise.all([
        this.collectorManager.emergencyStop(),
        this.stream.stop(),
        this.performanceMonitor.stop()
      ]);

      // Clear all queues and caches
      this.eventQueue = [];
      this.processingPromises.clear();
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      this.isRunning = false;
      this.log('warn', 'Emergency stop completed');

    } catch (error) {
      this.log('error', `Emergency stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(): Promise<void> {
    await this.emergencyStop();
    
    try {
      // Cleanup all components
      await Promise.all([
        this.collectorManager.cleanup(),
        this.normalizer.clearCache(),
        this.stream.cleanup(),
        this.performanceMonitor.cleanup()
      ]);

      // Clear all data
      this.eventHandlers.clear();
      this.eventQueue = [];
      this.processingPromises.clear();
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      this.isInitialized = false;
      this.log('info', 'Unified capture engine cleanup completed');

    } catch (error) {
      this.log('error', `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance for easy use
export const unifiedCaptureEngine = new UnifiedCaptureEngine();