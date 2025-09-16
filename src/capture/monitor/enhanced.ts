import { EnhancedEvent } from '@/types/events';

export interface PerformanceConfig {
  enabled: boolean;
  monitoringInterval: number;
  alertThresholds: AlertThresholds;
  metricsRetention: number;
  enableProfiling: boolean;
  enableMemoryTracking: boolean;
  enableCpuTracking: boolean;
  enableNetworkTracking: boolean;
  enableResourceTracking: boolean;
  samplingRate: number;
  maxMetricsHistory: number;
}

export interface AlertThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  eventProcessing: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
  latency: { warning: number; critical: number };
  throughput: { warning: number; critical: number };
  bufferSize: { warning: number; critical: number };
}

export interface PerformanceMetrics {
  timestamp: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  eventProcessing: EventProcessingMetrics;
  errors: ErrorMetrics;
  latency: LatencyMetrics;
  throughput: ThroughputMetrics;
  resources: ResourceMetrics;
  network: NetworkMetrics;
  health: HealthStatus;
}

export interface CpuMetrics {
  usage: number; // percentage
  cores: number;
  frequency: number; // MHz
  loadAverage: number[];
  processCpu: number; // current process CPU usage
}

export interface MemoryMetrics {
  total: number; // bytes
  used: number; // bytes
  free: number; // bytes
  processUsed: number; // current process memory usage
  processPeak: number; // current process peak memory usage
  heapUsed: number; // if available
  heapTotal: number; // if available
  heapLimit: number; // if available
  external: number; // if available
}

export interface EventProcessingMetrics {
  eventsProcessed: number;
  eventsPerSecond: number;
  eventsPerMinute: number;
  eventsPerHour: number;
  averageProcessingTime: number;
  maxProcessingTime: number;
  minProcessingTime: number;
  processingTimeDistribution: number[]; // histogram data
  queueSize: number;
  bufferUtilization: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number; // errors per event
  errorByType: Record<string, number>;
  errorBySource: Record<string, number>;
  recentErrors: ErrorEvent[];
  criticalErrors: number;
  warningErrors: number;
}

export interface ErrorEvent {
  timestamp: number;
  type: string;
  source: string;
  message: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

export interface LatencyMetrics {
  average: number;
  median: number;
  p95: number; // 95th percentile
  p99: number; // 99th percentile
  min: number;
  max: number;
  distribution: number[]; // histogram data
}

export interface ThroughputMetrics {
  eventsIn: number;
  eventsOut: number;
  eventsFiltered: number;
  eventsDropped: number;
  throughput: number; // events per second
  efficiency: number; // output / input ratio
  burstCapacity: number;
}

export interface ResourceMetrics {
  fileDescriptors: number;
  activeConnections: number;
  databaseConnections: number;
  cacheSize: number;
  cacheHitRate: number;
  diskUsage: number;
  diskIO: {
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
  };
}

export interface NetworkMetrics {
  requestsIn: number;
  requestsOut: number;
  bytesIn: number;
  bytesOut: number;
  averageResponseTime: number;
  connectionCount: number;
  errorRate: number;
  bandwidth: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  components: Record<string, 'healthy' | 'warning' | 'critical' | 'unknown'>;
  score: number; // 0-100
  issues: HealthIssue[];
  uptime: number;
  lastCheck: number;
}

export interface HealthIssue {
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  resolved: boolean;
}

export interface PerformanceAlert {
  id: string;
  type: 'cpu' | 'memory' | 'event_processing' | 'error_rate' | 'latency' | 'throughput' | 'buffer' | 'custom';
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface PerformanceProfile {
  id: string;
  name: string;
  timestamp: number;
  duration: number;
  metrics: PerformanceMetrics;
  events: EnhancedEvent[];
  annotations: ProfileAnnotation[];
}

export interface ProfileAnnotation {
  timestamp: number;
  type: 'marker' | 'event' | 'metric' | 'custom';
  label: string;
  value?: any;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;
  private metricsHistory: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private activeProfiles: Map<string, PerformanceProfile> = new Map();
  private subscribers: Set<(metrics: PerformanceMetrics) => void> = new Set();
  private alertSubscribers: Set<(alert: PerformanceAlert) => void> = new Set();
  private monitoringInterval?: number;
  private eventTimings: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private startTime: number;
  private isRunning = false;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enabled: true,
      monitoringInterval: 5000,
      metricsRetention: 3600000, // 1 hour
      enableProfiling: true,
      enableMemoryTracking: true,
      enableCpuTracking: true,
      enableNetworkTracking: true,
      enableResourceTracking: true,
      samplingRate: 0.1, // 10% sampling
      maxMetricsHistory: 720, // 1 hour at 5-second intervals
      alertThresholds: {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 80, critical: 95 },
        eventProcessing: { warning: 100, critical: 500 },
        errorRate: { warning: 5, critical: 10 },
        latency: { warning: 100, critical: 500 },
        throughput: { warning: 50, critical: 20 },
        bufferSize: { warning: 80, critical: 95 }
      },
      ...config
    };

    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) return;

    try {
      console.log('[PerformanceMonitor] Starting performance monitoring...');

      // Start periodic metrics collection
      this.monitoringInterval = window.setInterval(() => {
        this.collectMetrics();
        this.checkAlerts();
        this.cleanupOldData();
      }, this.config.monitoringInterval);

      this.isRunning = true;
      console.log('[PerformanceMonitor] Started successfully');

    } catch (error) {
      console.error('[PerformanceMonitor] Failed to start:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[PerformanceMonitor] Stopping performance monitoring...');

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      this.isRunning = false;
      console.log('[PerformanceMonitor] Stopped successfully');

    } catch (error) {
      console.error('[PerformanceMonitor] Error stopping:', error);
    }
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      cpu: {
        usage: 0,
        cores: navigator.hardwareConcurrency || 4,
        frequency: 0,
        loadAverage: [],
        processCpu: 0
      },
      memory: {
        total: 0,
        used: 0,
        free: 0,
        processUsed: 0,
        processPeak: 0,
        heapUsed: 0,
        heapTotal: 0,
        heapLimit: 0,
        external: 0
      },
      eventProcessing: {
        eventsProcessed: 0,
        eventsPerSecond: 0,
        eventsPerMinute: 0,
        eventsPerHour: 0,
        averageProcessingTime: 0,
        maxProcessingTime: 0,
        minProcessingTime: Infinity,
        processingTimeDistribution: [],
        queueSize: 0,
        bufferUtilization: 0
      },
      errors: {
        totalErrors: 0,
        errorRate: 0,
        errorByType: {},
        errorBySource: {},
        recentErrors: [],
        criticalErrors: 0,
        warningErrors: 0
      },
      latency: {
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        distribution: []
      },
      throughput: {
        eventsIn: 0,
        eventsOut: 0,
        eventsFiltered: 0,
        eventsDropped: 0,
        throughput: 0,
        efficiency: 1,
        burstCapacity: 100
      },
      resources: {
        fileDescriptors: 0,
        activeConnections: 0,
        databaseConnections: 0,
        cacheSize: 0,
        cacheHitRate: 0,
        diskUsage: 0,
        diskIO: {
          readBytes: 0,
          writeBytes: 0,
          readOps: 0,
          writeOps: 0
        }
      },
      network: {
        requestsIn: 0,
        requestsOut: 0,
        bytesIn: 0,
        bytesOut: 0,
        averageResponseTime: 0,
        connectionCount: 0,
        errorRate: 0,
        bandwidth: 0
      },
      health: {
        overall: 'unknown',
        components: {},
        score: 100,
        issues: [],
        uptime: 0,
        lastCheck: Date.now()
      }
    };
  }

  private collectMetrics(): void {
    const startTime = performance.now();

    try {
      const now = Date.now();

      // Collect CPU metrics
      if (this.config.enableCpuTracking) {
        this.collectCpuMetrics();
      }

      // Collect memory metrics
      if (this.config.enableMemoryTracking) {
        this.collectMemoryMetrics();
      }

      // Collect resource metrics
      if (this.config.enableResourceTracking) {
        this.collectResourceMetrics();
      }

      // Collect network metrics
      if (this.config.enableNetworkTracking) {
        this.collectNetworkMetrics();
      }

      // Update event processing metrics
      this.updateEventProcessingMetrics();

      // Calculate health status
      this.calculateHealthStatus();

      // Update timestamp
      this.metrics.timestamp = now;

      // Add to history
      this.metricsHistory.push({ ...this.metrics });
      if (this.metricsHistory.length > this.config.maxMetricsHistory) {
        this.metricsHistory.shift();
      }

      // Notify subscribers
      this.notifySubscribers();

      // Update performance
      const collectionTime = performance.now() - startTime;
      if (collectionTime > 10) {
        console.warn(`[PerformanceMonitor] Metrics collection took ${collectionTime}ms`);
      }

    } catch (error) {
      console.error('[PerformanceMonitor] Error collecting metrics:', error);
      this.recordError('metrics_collection', error as Error);
    }
  }

  private collectCpuMetrics(): void {
    try {
      // Estimate CPU usage
      if ('performance' in window && 'measure' in performance) {
        const measures = performance.getEntriesByType('measure');
        if (measures.length > 0) {
          const recentMeasures = measures.slice(-10);
          const avgDuration = recentMeasures.reduce((sum, m) => sum + m.duration, 0) / recentMeasures.length;
          this.metrics.cpu.processCpu = Math.min(100, (avgDuration / 50) * 100); // Rough estimate
        }
      }

      // Use Performance API if available
      if ('memory' in (performance as any)) {
        const memory = (performance as any).memory;
        // Memory pressure can indicate CPU usage indirectly
        if (memory.usedJSHeapSize && memory.jsHeapSizeLimit) {
          const memoryPressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
          this.metrics.cpu.usage = Math.min(100, memoryPressure * 150); // Rough correlation
        }
      }

    } catch (error) {
      console.warn('[PerformanceMonitor] Error collecting CPU metrics:', error);
    }
  }

  private collectMemoryMetrics(): void {
    try {
      if ('memory' in (performance as any)) {
        const memory = (performance as any).memory;
        
        this.metrics.memory.heapUsed = memory.usedJSHeapSize || 0;
        this.metrics.memory.heapTotal = memory.totalJSHeapSize || 0;
        this.metrics.memory.heapLimit = memory.jsHeapSizeLimit || 0;
        this.metrics.memory.external = memory.external || 0;
        
        // Update peak memory
        if (memory.usedJSHeapSize > this.metrics.memory.processPeak) {
          this.metrics.memory.processPeak = memory.usedJSHeapSize;
        }
        
        this.metrics.memory.processUsed = memory.usedJSHeapSize || 0;
        
        // Calculate usage percentages
        if (memory.jsHeapSizeLimit) {
          const heapUsage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
          this.metrics.memory.used = heapUsage;
          this.metrics.memory.total = 100;
        }
      }

      // Estimate total system memory (rough approximation)
      if (navigator.deviceMemory) {
        this.metrics.memory.total = navigator.deviceMemory * 1024 * 1024 * 1024; // Convert to bytes
      }

    } catch (error) {
      console.warn('[PerformanceMonitor] Error collecting memory metrics:', error);
    }
  }

  private collectResourceMetrics(): void {
    try {
      // Estimate file descriptors (not directly available in browsers)
      this.metrics.resources.activeConnections = this.subscribers.size;
      
      // Cache metrics (approximation)
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          this.metrics.resources.cacheSize = cacheNames.length;
        }).catch(() => {
          // Cache API not available
        });
      }

    } catch (error) {
      console.warn('[PerformanceMonitor] Error collecting resource metrics:', error);
    }
  }

  private collectNetworkMetrics(): void {
    try {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          this.metrics.network.bandwidth = connection.downlink || 0;
          this.metrics.network.connectionCount = 1; // Rough estimate
        }
      }

      // Estimate from performance timing
      if ('performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.metrics.network.averageResponseTime = navigation.responseEnd - navigation.requestStart;
        }
      }

    } catch (error) {
      console.warn('[PerformanceMonitor] Error collecting network metrics:', error);
    }
  }

  private updateEventProcessingMetrics(): void {
    // Calculate events per time period
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    
    // Use the metrics history to calculate rates
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp > oneMinuteAgo);
    const hourlyMetrics = this.metricsHistory.filter(m => m.timestamp > oneHourAgo);
    
    if (recentMetrics.length > 1) {
      const timeSpan = recentMetrics[recentMetrics.length - 1].timestamp - recentMetrics[0].timestamp;
      const eventsProcessed = recentMetrics[recentMetrics.length - 1].eventProcessing.eventsProcessed - recentMetrics[0].eventProcessing.eventsProcessed;
      this.metrics.eventProcessing.eventsPerSecond = eventsProcessed / (timeSpan / 1000);
      this.metrics.eventProcessing.eventsPerMinute = eventsProcessed * 60;
    }
    
    if (hourlyMetrics.length > 1) {
      const timeSpan = hourlyMetrics[hourlyMetrics.length - 1].timestamp - hourlyMetrics[0].timestamp;
      const eventsProcessed = hourlyMetrics[hourlyMetrics.length - 1].eventProcessing.eventsProcessed - hourlyMetrics[0].eventProcessing.eventsProcessed;
      this.metrics.eventProcessing.eventsPerHour = eventsProcessed / (timeSpan / 3600000);
    }
    
    // Update throughput metrics
    this.metrics.throughput.throughput = this.metrics.eventProcessing.eventsPerSecond;
    if (this.metrics.throughput.eventsIn > 0) {
      this.metrics.throughput.efficiency = this.metrics.throughput.eventsOut / this.metrics.throughput.eventsIn;
    }
    
    // Update error rate
    if (this.metrics.eventProcessing.eventsProcessed > 0) {
      this.metrics.errors.errorRate = (this.metrics.errors.totalErrors / this.metrics.eventProcessing.eventsProcessed) * 100;
    }
  }

  private calculateHealthStatus(): void {
    const components: Record<string, 'healthy' | 'warning' | 'critical' | 'unknown'> = {};
    const issues: HealthIssue[] = [];
    let score = 100;

    // CPU health
    if (this.metrics.cpu.usage > this.config.alertThresholds.cpu.critical) {
      components.cpu = 'critical';
      issues.push({
        component: 'cpu',
        severity: 'critical',
        message: `CPU usage critical: ${this.metrics.cpu.usage.toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false
      });
      score -= 40;
    } else if (this.metrics.cpu.usage > this.config.alertThresholds.cpu.warning) {
      components.cpu = 'warning';
      issues.push({
        component: 'cpu',
        severity: 'medium',
        message: `CPU usage high: ${this.metrics.cpu.usage.toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false
      });
      score -= 20;
    } else {
      components.cpu = 'healthy';
    }

    // Memory health
    if (this.metrics.memory.used > this.config.alertThresholds.memory.critical) {
      components.memory = 'critical';
      issues.push({
        component: 'memory',
        severity: 'critical',
        message: `Memory usage critical: ${this.metrics.memory.used.toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false
      });
      score -= 40;
    } else if (this.metrics.memory.used > this.config.alertThresholds.memory.warning) {
      components.memory = 'warning';
      issues.push({
        component: 'memory',
        severity: 'medium',
        message: `Memory usage high: ${this.metrics.memory.used.toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false
      });
      score -= 20;
    } else {
      components.memory = 'healthy';
    }

    // Event processing health
    if (this.metrics.eventProcessing.averageProcessingTime > this.config.alertThresholds.eventProcessing.critical) {
      components.eventProcessing = 'critical';
      issues.push({
        component: 'eventProcessing',
        severity: 'critical',
        message: `Event processing time critical: ${this.metrics.eventProcessing.averageProcessingTime.toFixed(1)}ms`,
        timestamp: Date.now(),
        resolved: false
      });
      score -= 30;
    } else if (this.metrics.eventProcessing.averageProcessingTime > this.config.alertThresholds.eventProcessing.warning) {
      components.eventProcessing = 'warning';
      issues.push({
        component: 'eventProcessing',
        severity: 'medium',
        message: `Event processing time high: ${this.metrics.eventProcessing.averageProcessingTime.toFixed(1)}ms`,
        timestamp: Date.now(),
        resolved: false
      });
      score -= 15;
    } else {
      components.eventProcessing = 'healthy';
    }

    // Error rate health
    if (this.metrics.errors.errorRate > this.config.alertThresholds.errorRate.critical) {
      components.errors = 'critical';
      issues.push({
        component: 'errors',
        severity: 'critical',
        message: `Error rate critical: ${this.metrics.errors.errorRate.toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false
      });
      score -= 35;
    } else if (this.metrics.errors.errorRate > this.config.alertThresholds.errorRate.warning) {
      components.errors = 'warning';
      issues.push({
        component: 'errors',
        severity: 'medium',
        message: `Error rate high: ${this.metrics.errors.errorRate.toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false
      });
      score -= 20;
    } else {
      components.errors = 'healthy';
    }

    // Determine overall health
    let overall: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
    if (Object.values(components).some(status => status === 'critical')) {
      overall = 'critical';
    } else if (Object.values(components).some(status => status === 'warning')) {
      overall = 'warning';
    }

    this.metrics.health = {
      overall,
      components,
      score: Math.max(0, score),
      issues,
      uptime: Date.now() - this.startTime,
      lastCheck: Date.now()
    };
  }

  private checkAlerts(): void {
    if (!this.config.enabled) return;

    const now = Date.now();

    // Check CPU alerts
    if (this.metrics.cpu.usage > this.config.alertThresholds.cpu.critical) {
      this.createAlert('cpu', 'critical', `CPU usage critical: ${this.metrics.cpu.usage.toFixed(1)}%`, {
        current: this.metrics.cpu.usage,
        threshold: this.config.alertThresholds.cpu.critical
      });
    } else if (this.metrics.cpu.usage > this.config.alertThresholds.cpu.warning) {
      this.createAlert('cpu', 'warning', `CPU usage high: ${this.metrics.cpu.usage.toFixed(1)}%`, {
        current: this.metrics.cpu.usage,
        threshold: this.config.alertThresholds.cpu.warning
      });
    }

    // Check memory alerts
    if (this.metrics.memory.used > this.config.alertThresholds.memory.critical) {
      this.createAlert('memory', 'critical', `Memory usage critical: ${this.metrics.memory.used.toFixed(1)}%`, {
        current: this.metrics.memory.used,
        threshold: this.config.alertThresholds.memory.critical
      });
    } else if (this.metrics.memory.used > this.config.alertThresholds.memory.warning) {
      this.createAlert('memory', 'warning', `Memory usage high: ${this.metrics.memory.used.toFixed(1)}%`, {
        current: this.metrics.memory.used,
        threshold: this.config.alertThresholds.memory.warning
      });
    }

    // Check event processing alerts
    if (this.metrics.eventProcessing.averageProcessingTime > this.config.alertThresholds.eventProcessing.critical) {
      this.createAlert('event_processing', 'critical', `Event processing time critical: ${this.metrics.eventProcessing.averageProcessingTime.toFixed(1)}ms`, {
        current: this.metrics.eventProcessing.averageProcessingTime,
        threshold: this.config.alertThresholds.eventProcessing.critical
      });
    }

    // Check error rate alerts
    if (this.metrics.errors.errorRate > this.config.alertThresholds.errorRate.critical) {
      this.createAlert('error_rate', 'critical', `Error rate critical: ${this.metrics.errors.errorRate.toFixed(1)}%`, {
        current: this.metrics.errors.errorRate,
        threshold: this.config.alertThresholds.errorRate.critical
      });
    }

    // Clean up resolved alerts
    this.cleanupAlerts();
  }

  private createAlert(type: PerformanceAlert['type'], severity: PerformanceAlert['severity'], message: string, details: Record<string, any>): void {
    const alert: PerformanceAlert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      details,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false
    };

    this.alerts.push(alert);
    this.notifyAlertSubscribers(alert);

    console.warn(`[PerformanceMonitor] Alert [${type}]: ${message}`);
  }

  private cleanupAlerts(): void {
    const now = Date.now();
    
    // Remove old alerts (older than 1 hour)
    this.alerts = this.alerts.filter(alert => now - alert.timestamp < 3600000);
    
    // Mark alerts as resolved if conditions have improved
    this.alerts.forEach(alert => {
      if (!alert.resolved) {
        const shouldResolve = this.shouldResolveAlert(alert);
        if (shouldResolve) {
          alert.resolved = true;
          alert.resolved = true;
        }
      }
    });
  }

  private shouldResolveAlert(alert: PerformanceAlert): boolean {
    switch (alert.type) {
      case 'cpu':
        return this.metrics.cpu.usage < this.config.alertThresholds.cpu.warning;
      case 'memory':
        return this.metrics.memory.used < this.config.alertThresholds.memory.warning;
      case 'event_processing':
        return this.metrics.eventProcessing.averageProcessingTime < this.config.alertThresholds.eventProcessing.warning;
      case 'error_rate':
        return this.metrics.errors.errorRate < this.config.alertThresholds.errorRate.warning;
      default:
        return false;
    }
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.metricsRetention;

    // Clean up metrics history
    this.metricsHistory = this.metricsHistory.filter(metrics => metrics.timestamp > cutoffTime);

    // Clean up event timings
    for (const [key, timestamp] of this.eventTimings.entries()) {
      if (now - timestamp > this.config.metricsRetention) {
        this.eventTimings.delete(key);
      }
    }

    // Clean up error counts
    for (const [key, count] of this.errorCounts.entries()) {
      if (count === 0) {
        this.errorCounts.delete(key);
      }
    }
  }

  private notifySubscribers(): void {
    const metricsCopy = { ...this.metrics };
    
    this.subscribers.forEach(subscriber => {
      try {
        subscriber(metricsCopy);
      } catch (error) {
        console.error('[PerformanceMonitor] Error in subscriber callback:', error);
      }
    });
  }

  private notifyAlertSubscribers(alert: PerformanceAlert): void {
    this.alertSubscribers.forEach(subscriber => {
      try {
        subscriber(alert);
      } catch (error) {
        console.error('[PerformanceMonitor] Error in alert subscriber callback:', error);
      }
    });
  }

  // Public API methods
  recordEventStart(eventId: string): void {
    if (Math.random() > this.config.samplingRate) return;
    
    this.eventTimings.set(eventId, performance.now());
  }

  recordEventEnd(eventId: string, success: boolean = true): void {
    if (!this.eventTimings.has(eventId)) return;
    
    const startTime = this.eventTimings.get(eventId)!;
    const processingTime = performance.now() - startTime;
    
    this.eventTimings.delete(eventId);
    
    // Update event processing metrics
    this.metrics.eventProcessing.eventsProcessed++;
    
    if (success) {
      this.metrics.eventProcessing.eventsPerSecond++;
    }
    
    // Update processing time statistics
    this.metrics.eventProcessing.averageProcessingTime = this.updateAverage(
      this.metrics.eventProcessing.averageProcessingTime,
      processingTime,
      this.metrics.eventProcessing.eventsProcessed
    );
    
    if (processingTime > this.metrics.eventProcessing.maxProcessingTime) {
      this.metrics.eventProcessing.maxProcessingTime = processingTime;
    }
    
    if (processingTime < this.metrics.eventProcessing.minProcessingTime) {
      this.metrics.eventProcessing.minProcessingTime = processingTime;
    }
    
    // Update distribution
    this.metrics.eventProcessing.processingTimeDistribution.push(processingTime);
    if (this.metrics.eventProcessing.processingTimeDistribution.length > 100) {
      this.metrics.eventProcessing.processingTimeDistribution.shift();
    }
    
    // Update latency metrics
    this.updateLatencyMetrics(processingTime);
  }

  recordError(type: string, error: Error, source?: string, severity: ErrorEvent['severity'] = 'medium'): void {
    const errorEvent: ErrorEvent = {
      timestamp: Date.now(),
      type,
      source: source || 'unknown',
      message: error.message,
      stack: error.stack,
      severity,
      context: {
        metrics: this.getMetricsSnapshot(),
        uptime: Date.now() - this.startTime
      }
    };

    // Update error metrics
    this.metrics.errors.totalErrors++;
    this.metrics.errors.errorByType[type] = (this.metrics.errors.errorByType[type] || 0) + 1;
    
    if (source) {
      this.metrics.errors.errorBySource[source] = (this.metrics.errors.errorBySource[source] || 0) + 1;
    }
    
    // Add to recent errors
    this.metrics.errors.recentErrors.push(errorEvent);
    if (this.metrics.errors.recentErrors.length > 50) {
      this.metrics.errors.recentErrors.shift();
    }
    
    // Update severity counts
    if (severity === 'critical') {
      this.metrics.errors.criticalErrors++;
    } else if (severity === 'high' || severity === 'medium') {
      this.metrics.errors.warningErrors++;
    }
    
    // Track error counts for cleanup
    this.errorCounts.set(`${type}:${source}`, (this.errorCounts.get(`${type}:${source}`) || 0) + 1);
  }

  recordNetworkRequest(method: string, url: string, startTime: number, endTime: number, success: boolean): void {
    const duration = endTime - startTime;
    
    this.metrics.network.requestsOut++;
    this.metrics.network.bytesOut += estimateRequestSize(method, url);
    
    if (success) {
      this.metrics.network.bytesIn += 1024; // Rough estimate
    } else {
      this.metrics.network.errorRate++;
    }
    
    // Update response time
    this.metrics.network.averageResponseTime = this.updateAverage(
      this.metrics.network.averageResponseTime,
      duration,
      this.metrics.network.requestsOut
    );
  }

  subscribe(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertSubscribers.add(callback);
    
    return () => {
      this.alertSubscribers.delete(callback);
    };
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getMetricsHistory(hours: number = 1): PerformanceMetrics[] {
    const cutoffTime = Date.now() - (hours * 3600000);
    return this.metricsHistory.filter(metrics => metrics.timestamp > cutoffTime);
  }

  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  async startProfile(name: string): Promise<string> {
    if (!this.config.enableProfiling) {
      throw new Error('Profiling is disabled');
    }

    const profileId = this.generateProfileId();
    const profile: PerformanceProfile = {
      id: profileId,
      name,
      timestamp: Date.now(),
      duration: 0,
      metrics: this.getMetricsSnapshot(),
      events: [],
      annotations: []
    };

    this.activeProfiles.set(profileId, profile);
    return profileId;
  }

  async addProfileAnnotation(profileId: string, annotation: Omit<ProfileAnnotation, 'timestamp'>): Promise<void> {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    profile.annotations.push({
      ...annotation,
      timestamp: Date.now()
    });
  }

  async endProfile(profileId: string): Promise<PerformanceProfile> {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    profile.duration = Date.now() - profile.timestamp;
    profile.metrics = this.getMetricsSnapshot();

    this.activeProfiles.delete(profileId);
    return profile;
  }

  getActiveProfiles(): PerformanceProfile[] {
    return Array.from(this.activeProfiles.values());
  }

  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  async generateReport(): Promise<{
    summary: {
      uptime: number;
      eventsProcessed: number;
      averageLatency: number;
      errorRate: number;
      healthScore: number;
    };
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    recommendations: string[];
  }> {
    const metrics = this.getMetrics();
    const activeAlerts = this.getActiveAlerts();
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on metrics
    if (metrics.cpu.usage > 80) {
      recommendations.push('Consider reducing event capture frequency to lower CPU usage');
    }
    
    if (metrics.memory.used > 85) {
      recommendations.push('Clear cached data and reduce memory retention period');
    }
    
    if (metrics.eventProcessing.averageProcessingTime > 200) {
      recommendations.push('Optimize event processing algorithms and consider batching');
    }
    
    if (metrics.errors.errorRate > 5) {
      recommendations.push('Review error logs and fix underlying issues');
    }
    
    if (metrics.throughput.efficiency < 0.8) {
      recommendations.push('Review filtering logic and improve event processing efficiency');
    }

    return {
      summary: {
        uptime: metrics.health.uptime,
        eventsProcessed: metrics.eventProcessing.eventsProcessed,
        averageLatency: metrics.latency.average,
        errorRate: metrics.errors.errorRate,
        healthScore: metrics.health.score
      },
      metrics,
      alerts: activeAlerts,
      recommendations
    };
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    this.metricsHistory = [];
    this.alerts = [];
    this.activeProfiles.clear();
    this.eventTimings.clear();
    this.errorCounts.clear();
    this.subscribers.clear();
    this.alertSubscribers.clear();
    
    console.log('[PerformanceMonitor] Cleanup completed');
  }

  // Private helper methods
  private getMetricsSnapshot(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  private updateLatencyMetrics(processingTime: number): void {
    // Update average latency
    this.metrics.latency.average = this.updateAverage(
      this.metrics.latency.average,
      processingTime,
      this.metrics.eventProcessing.eventsProcessed
    );

    // Update min/max
    if (processingTime < this.metrics.latency.min || this.metrics.latency.min === 0) {
      this.metrics.latency.min = processingTime;
    }
    
    if (processingTime > this.metrics.latency.max) {
      this.metrics.latency.max = processingTime;
    }

    // Update distribution
    this.metrics.latency.distribution.push(processingTime);
    if (this.metrics.latency.distribution.length > 100) {
      this.metrics.latency.distribution.shift();
    }

    // Calculate percentiles
    const sorted = [...this.metrics.latency.distribution].sort((a, b) => a - b);
    if (sorted.length > 0) {
      this.metrics.latency.median = sorted[Math.floor(sorted.length / 2)];
      this.metrics.latency.p95 = sorted[Math.floor(sorted.length * 0.95)];
      this.metrics.latency.p99 = sorted[Math.floor(sorted.length * 0.99)];
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Utility functions
function estimateRequestSize(method: string, url: string): number {
  // Rough estimate of request size
  const methodSize = method.length * 2; // UTF-8 encoding
  const urlSize = new TextEncoder().encode(url).length;
  const headersSize = 200; // Rough estimate for headers
  return methodSize + urlSize + headersSize;
}

export const performanceMonitor = new PerformanceMonitor();