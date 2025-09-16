/**
 * Performance Monitoring and Alerting System for Spur Super App
 * Real-time performance tracking with intelligent alerting
 */

export interface PerformanceMetric {
  timestamp: number;
  metric: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  metric: string;
  current: number;
  threshold: number;
  message: string;
  timestamp: number;
  resolved: boolean;
  context: Record<string, any>;
}

export interface PerformanceReport {
  timestamp: number;
  duration: number; // Report duration in milliseconds
  metrics: {
    responseTime: {
      avg: number;
      p95: number;
      p99: number;
      max: number;
    };
    throughput: {
      requests: number;
      rate: number; // requests per second
    };
    errorRate: {
      count: number;
      percentage: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    database: {
      queryTime: {
        avg: number;
        max: number;
      };
      connections: {
        active: number;
        idle: number;
      };
    };
  };
  alerts: PerformanceAlert[];
  recommendations: string[];
  health: 'excellent' | 'good' | 'degraded' | 'critical';
}

export interface MonitoringConfig {
  collection: {
    interval: number; // milliseconds
    batchSize: number;
    retentionPeriod: number; // milliseconds
  };
  thresholds: {
    responseTime: {
      warning: number;
      critical: number;
    };
    errorRate: {
      warning: number; // percentage
      critical: number; // percentage
    };
    memory: {
      warning: number; // percentage
      critical: number; // percentage
    };
    cpu: {
      warning: number; // percentage
      critical: number; // percentage
    };
    database: {
      queryTime: {
        warning: number;
        critical: number;
      };
      connections: {
        warning: number;
        critical: number;
      };
    };
  };
  alerting: {
    enabled: boolean;
    channels: ('email' | 'slack' | 'webhook')[];
    cooldownPeriod: number; // milliseconds
    aggregationWindow: number; // milliseconds
  };
}

/**
 * Performance Monitoring System
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private config: MonitoringConfig;
  private collectors: Map<string, () => Promise<PerformanceMetric[]>> = new Map();
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      collection: {
        interval: 5000, // 5 seconds
        batchSize: 100,
        retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      },
      thresholds: {
        responseTime: {
          warning: 500, // 500ms
          critical: 1000, // 1s
        },
        errorRate: {
          warning: 2, // 2%
          critical: 5, // 5%
        },
        memory: {
          warning: 80, // 80%
          critical: 90, // 90%
        },
        cpu: {
          warning: 70, // 70%
          critical: 85, // 85%
        },
        database: {
          queryTime: {
            warning: 100, // 100ms
            critical: 500, // 500ms
          },
          connections: {
            warning: 80, // 80% of max
            critical: 90, // 90% of max
          },
        },
      },
      alerting: {
        enabled: true,
        channels: ['email', 'slack'],
        cooldownPeriod: 5 * 60 * 1000, // 5 minutes
        aggregationWindow: 15 * 60 * 1000, // 15 minutes
      },
      ...config,
    };

    this.initializeCollectors();
    this.startMonitoring();
  }

  /**
   * Initialize metric collectors
   */
  private initializeCollectors() {
    // Application metrics
    this.collectors.set('responseTime', this.collectResponseTime.bind(this));
    this.collectors.set('throughput', this.collectThroughput.bind(this));
    this.collectors.set('errorRate', this.collectErrorRate.bind(this));

    // System metrics
    this.collectors.set('memory', this.collectMemoryMetrics.bind(this));
    this.collectors.set('cpu', this.collectCPUMetrics.bind(this));

    // Database metrics
    this.collectors.set('database', this.collectDatabaseMetrics.bind(this));

    // Assistant-specific metrics
    this.collectors.set('assistant', this.collectAssistantMetrics.bind(this));
    
    // Capture engine metrics
    this.collectors.set('capture', this.collectCaptureMetrics.bind(this));
    
    // Memory graph metrics
    this.collectors.set('memoryGraph', this.collectMemoryGraphMetrics.bind(this));
  }

  /**
   * Start monitoring process
   */
  private startMonitoring() {
    setInterval(async () => {
      await this.collectMetrics();
      await this.evaluateThresholds();
      await this.cleanupOldData();
    }, this.config.collection.interval);
  }

  /**
   * Collect metrics from all collectors
   */
  private async collectMetrics() {
    const timestamp = Date.now();
    const batch: PerformanceMetric[] = [];

    for (const [name, collector] of this.collectors) {
      try {
        const metrics = await collector();
        batch.push(...metrics);
      } catch (error) {
        console.error(`Failed to collect ${name} metrics:`, error);
        // Add error metric
        batch.push({
          timestamp,
          metric: `${name}.error`,
          value: 1,
          unit: 'count',
          tags: { collector: name, error: error.message },
        });
      }
    }

    this.metrics.push(...batch);
  }

  /**
   * Collect response time metrics
   */
  private async collectResponseTime(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Simulated response time collection
    // In real implementation, this would measure actual API/response times
    const responseTimes = [
      120, 85, 200, 45, 320, 150, 95, 180, 75, 110
    ].map(time => ({
      timestamp,
      metric: 'response.time',
      value: time,
      unit: 'ms',
      tags: { endpoint: 'api', method: 'GET' },
    }));

    return responseTimes;
  }

  /**
   * Collect throughput metrics
   */
  private async collectThroughput(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Simulated throughput collection
    const throughput = {
      requests: 1250,
      rate: 250, // requests per second
    };

    return [
      {
        timestamp,
        metric: 'throughput.requests',
        value: throughput.requests,
        unit: 'count',
        tags: { period: '5m' },
      },
      {
        timestamp,
        metric: 'throughput.rate',
        value: throughput.rate,
        unit: 'rps',
        tags: { period: '5m' },
      },
    ];
  }

  /**
   * Collect error rate metrics
   */
  private async collectErrorRate(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Simulated error rate collection
    const errorRate = {
      count: 8,
      percentage: 0.64, // 0.64%
    };

    return [
      {
        timestamp,
        metric: 'errors.count',
        value: errorRate.count,
        unit: 'count',
        tags: { period: '5m' },
      },
      {
        timestamp,
        metric: 'errors.rate',
        value: errorRate.percentage,
        unit: 'percent',
        tags: { period: '5m' },
      },
    ];
  }

  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Simulated memory collection
    // In real implementation, this would use process.memoryUsage()
    const memoryUsage = {
      used: 512 * 1024 * 1024, // 512MB
      total: 1024 * 1024 * 1024, // 1GB
      percentage: 50,
    };

    return [
      {
        timestamp,
        metric: 'memory.used',
        value: memoryUsage.used,
        unit: 'bytes',
        tags: {},
      },
      {
        timestamp,
        metric: 'memory.total',
        value: memoryUsage.total,
        unit: 'bytes',
        tags: {},
      },
      {
        timestamp,
        metric: 'memory.percentage',
        value: memoryUsage.percentage,
        unit: 'percent',
        tags: {},
      },
    ];
  }

  /**
   * Collect CPU metrics
   */
  private async collectCPUMetrics(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Simulated CPU collection
    const cpuUsage = {
      usage: 35.5, // 35.5%
    };

    return [
      {
        timestamp,
        metric: 'cpu.usage',
        value: cpuUsage.usage,
        unit: 'percent',
        tags: {},
      },
    ];
  }

  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Simulated database metrics
    const databaseMetrics = {
      queryTime: {
        avg: 45,
        max: 180,
      },
      connections: {
        active: 15,
        idle: 25,
        max: 100,
      },
    };

    return [
      {
        timestamp,
        metric: 'database.query.avg',
        value: databaseMetrics.queryTime.avg,
        unit: 'ms',
        tags: {},
      },
      {
        timestamp,
        metric: 'database.query.max',
        value: databaseMetrics.queryTime.max,
        unit: 'ms',
        tags: {},
      },
      {
        timestamp,
        metric: 'database.connections.active',
        value: databaseMetrics.connections.active,
        unit: 'count',
        tags: {},
      },
      {
        timestamp,
        metric: 'database.connections.idle',
        value: databaseMetrics.connections.idle,
        unit: 'count',
        tags: {},
      },
      {
        timestamp,
        metric: 'database.connections.percentage',
        value: (databaseMetrics.connections.active / databaseMetrics.connections.max) * 100,
        unit: 'percent',
        tags: {},
      },
    ];
  }

  /**
   * Collect assistant metrics
   */
  private async collectAssistantMetrics(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Assistant-specific metrics
    const assistantMetrics = {
      responseTime: 180,
      accuracy: 0.92,
      contextWindow: 1000,
      activeUsers: 45,
    };

    return [
      {
        timestamp,
        metric: 'assistant.response.time',
        value: assistantMetrics.responseTime,
        unit: 'ms',
        tags: { component: 'assistant' },
      },
      {
        timestamp,
        metric: 'assistant.accuracy',
        value: assistantMetrics.accuracy,
        unit: 'percent',
        tags: { component: 'assistant' },
      },
      {
        timestamp,
        metric: 'assistant.context.window',
        value: assistantMetrics.contextWindow,
        unit: 'tokens',
        tags: { component: 'assistant' },
      },
      {
        timestamp,
        metric: 'assistant.users.active',
        value: assistantMetrics.activeUsers,
        unit: 'count',
        tags: { component: 'assistant' },
      },
    ];
  }

  /**
   * Collect capture engine metrics
   */
  private async collectCaptureMetrics(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Capture engine metrics
    const captureMetrics = {
      eventsProcessed: 1250,
      processingTime: 25,
      memoryUsage: 85,
      errorRate: 0.1,
    };

    return [
      {
        timestamp,
        metric: 'capture.events.processed',
        value: captureMetrics.eventsProcessed,
        unit: 'count',
        tags: { component: 'capture' },
      },
      {
        timestamp,
        metric: 'capture.processing.time',
        value: captureMetrics.processingTime,
        unit: 'ms',
        tags: { component: 'capture' },
      },
      {
        timestamp,
        metric: 'capture.memory.usage',
        value: captureMetrics.memoryUsage,
        unit: 'mb',
        tags: { component: 'capture' },
      },
      {
        timestamp,
        metric: 'capture.error.rate',
        value: captureMetrics.errorRate,
        unit: 'percent',
        tags: { component: 'capture' },
      },
    ];
  }

  /**
   * Collect memory graph metrics
   */
  private async collectMemoryGraphMetrics(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    
    // Memory graph metrics
    const graphMetrics = {
      nodes: 15420,
      edges: 48350,
      queryTime: 35,
      cacheHitRate: 0.88,
      memoryUsage: 125,
    };

    return [
      {
        timestamp,
        metric: 'memoryGraph.nodes',
        value: graphMetrics.nodes,
        unit: 'count',
        tags: { component: 'memoryGraph' },
      },
      {
        timestamp,
        metric: 'memoryGraph.edges',
        value: graphMetrics.edges,
        unit: 'count',
        tags: { component: 'memoryGraph' },
      },
      {
        timestamp,
        metric: 'memoryGraph.query.time',
        value: graphMetrics.queryTime,
        unit: 'ms',
        tags: { component: 'memoryGraph' },
      },
      {
        timestamp,
        metric: 'memoryGraph.cache.hitRate',
        value: graphMetrics.cacheHitRate,
        unit: 'percent',
        tags: { component: 'memoryGraph' },
      },
      {
        timestamp,
        metric: 'memoryGraph.memory.usage',
        value: graphMetrics.memoryUsage,
        unit: 'mb',
        tags: { component: 'memoryGraph' },
      },
    ];
  }

  /**
   * Evaluate metrics against thresholds and generate alerts
   */
  private async evaluateThresholds() {
    if (!this.config.alerting.enabled) return;

    const recentMetrics = this.metrics.filter(
      metric => metric.timestamp > Date.now() - this.config.alerting.aggregationWindow
    );

    // Check response time
    const responseTimeMetrics = recentMetrics.filter(m => m.metric === 'response.time');
    if (responseTimeMetrics.length > 0) {
      const avgResponseTime = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length;
      
      if (avgResponseTime > this.config.thresholds.responseTime.critical) {
        await this.createAlert({
          type: 'critical',
          metric: 'response.time',
          current: avgResponseTime,
          threshold: this.config.thresholds.responseTime.critical,
          message: `Average response time critically high: ${avgResponseTime.toFixed(2)}ms`,
          context: { average: avgResponseTime, sampleSize: responseTimeMetrics.length },
        });
      } else if (avgResponseTime > this.config.thresholds.responseTime.warning) {
        await this.createAlert({
          type: 'warning',
          metric: 'response.time',
          current: avgResponseTime,
          threshold: this.config.thresholds.responseTime.warning,
          message: `Average response time elevated: ${avgResponseTime.toFixed(2)}ms`,
          context: { average: avgResponseTime, sampleSize: responseTimeMetrics.length },
        });
      }
    }

    // Check error rate
    const errorRateMetrics = recentMetrics.filter(m => m.metric === 'errors.rate');
    if (errorRateMetrics.length > 0) {
      const avgErrorRate = errorRateMetrics.reduce((sum, m) => sum + m.value, 0) / errorRateMetrics.length;
      
      if (avgErrorRate > this.config.thresholds.errorRate.critical) {
        await this.createAlert({
          type: 'critical',
          metric: 'errors.rate',
          current: avgErrorRate,
          threshold: this.config.thresholds.errorRate.critical,
          message: `Error rate critically high: ${avgErrorRate.toFixed(2)}%`,
          context: { average: avgErrorRate, sampleSize: errorRateMetrics.length },
        });
      } else if (avgErrorRate > this.config.thresholds.errorRate.warning) {
        await this.createAlert({
          type: 'warning',
          metric: 'errors.rate',
          current: avgErrorRate,
          threshold: this.config.thresholds.errorRate.warning,
          message: `Error rate elevated: ${avgErrorRate.toFixed(2)}%`,
          context: { average: avgErrorRate, sampleSize: errorRateMetrics.length },
        });
      }
    }

    // Check memory usage
    const memoryMetrics = recentMetrics.filter(m => m.metric === 'memory.percentage');
    if (memoryMetrics.length > 0) {
      const avgMemory = memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length;
      
      if (avgMemory > this.config.thresholds.memory.critical) {
        await this.createAlert({
          type: 'critical',
          metric: 'memory.percentage',
          current: avgMemory,
          threshold: this.config.thresholds.memory.critical,
          message: `Memory usage critically high: ${avgMemory.toFixed(1)}%`,
          context: { average: avgMemory, sampleSize: memoryMetrics.length },
        });
      } else if (avgMemory > this.config.thresholds.memory.warning) {
        await this.createAlert({
          type: 'warning',
          metric: 'memory.percentage',
          current: avgMemory,
          threshold: this.config.thresholds.memory.warning,
          message: `Memory usage elevated: ${avgMemory.toFixed(1)}%`,
          context: { average: avgMemory, sampleSize: memoryMetrics.length },
        });
      }
    }

    // Check CPU usage
    const cpuMetrics = recentMetrics.filter(m => m.metric === 'cpu.usage');
    if (cpuMetrics.length > 0) {
      const avgCpu = cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length;
      
      if (avgCpu > this.config.thresholds.cpu.critical) {
        await this.createAlert({
          type: 'critical',
          metric: 'cpu.usage',
          current: avgCpu,
          threshold: this.config.thresholds.cpu.critical,
          message: `CPU usage critically high: ${avgCpu.toFixed(1)}%`,
          context: { average: avgCpu, sampleSize: cpuMetrics.length },
        });
      } else if (avgCpu > this.config.thresholds.cpu.warning) {
        await this.createAlert({
          type: 'warning',
          metric: 'cpu.usage',
          current: avgCpu,
          threshold: this.config.thresholds.cpu.warning,
          message: `CPU usage elevated: ${avgCpu.toFixed(1)}%`,
          context: { average: avgCpu, sampleSize: cpuMetrics.length },
        });
      }
    }
  }

  /**
   * Create and process alert
   */
  private async createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>) {
    // Check cooldown period
    const recentAlerts = this.alerts.filter(alert => 
      alert.metric === alertData.metric && 
      !alert.resolved &&
      alert.timestamp > Date.now() - this.config.alerting.cooldownPeriod
    );

    if (recentAlerts.length > 0) {
      return; // Skip due to cooldown
    }

    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
      ...alertData,
    };

    this.alerts.push(alert);

    // Notify alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });

    // Send to configured channels
    await this.sendAlertToChannels(alert);
  }

  /**
   * Send alert to configured channels
   */
  private async sendAlertToChannels(alert: PerformanceAlert) {
    // Implementation would integrate with email, Slack, webhooks, etc.
    console.log(`[${alert.type.toUpperCase()}] ${alert.message}`);
    
    if (this.config.alerting.channels.includes('slack')) {
      await this.sendToSlack(alert);
    }
    
    if (this.config.alerting.channels.includes('email')) {
      await this.sendEmailAlert(alert);
    }
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: PerformanceAlert) {
    // Simulated Slack integration
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    const message = {
      text: `[${alert.type.toUpperCase()}] Spur Performance Alert`,
      attachments: [{
        color: alert.type === 'critical' ? 'danger' : alert.type === 'warning' ? 'warning' : 'good',
        fields: [
          { title: 'Metric', value: alert.metric, short: true },
          { title: 'Current Value', value: alert.current.toString(), short: true },
          { title: 'Threshold', value: alert.threshold.toString(), short: true },
          { title: 'Message', value: alert.message, short: false },
        ],
        timestamp: Math.floor(alert.timestamp / 1000),
      }],
    };

    // In real implementation, send to Slack webhook
    console.log('Slack alert:', JSON.stringify(message, null, 2));
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: PerformanceAlert) {
    // Simulated email integration
    const emailContent = `
      <h2>Spur Performance Alert</h2>
      <p><strong>Type:</strong> ${alert.type.toUpperCase()}</p>
      <p><strong>Metric:</strong> ${alert.metric}</p>
      <p><strong>Current:</strong> ${alert.current}</p>
      <p><strong>Threshold:</strong> ${alert.threshold}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
    `;

    // In real implementation, send via email service
    console.log('Email alert content:', emailContent);
  }

  /**
   * Cleanup old metrics and resolved alerts
   */
  private async cleanupOldData() {
    const cutoffTime = Date.now() - this.config.collection.retentionPeriod;
    
    // Cleanup old metrics
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);
    
    // Cleanup resolved alerts older than retention period
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || alert.timestamp > cutoffTime
    );
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(duration: number = 5 * 60 * 1000): PerformanceReport {
    const startTime = Date.now() - duration;
    const endTime = Date.now();
    
    const reportMetrics = this.metrics.filter(metric => 
      metric.timestamp >= startTime && metric.timestamp <= endTime
    );

    // Calculate response time metrics
    const responseTimeMetrics = reportMetrics.filter(m => m.metric === 'response.time');
    const responseTimes = responseTimeMetrics.map(m => m.value);
    const responseTimeStats = this.calculateStats(responseTimes);

    // Calculate throughput metrics
    const throughputMetrics = reportMetrics.filter(m => m.metric === 'throughput.rate');
    const throughputRates = throughputMetrics.map(m => m.value);
    const avgThroughput = throughputRates.length > 0 ? 
      throughputRates.reduce((sum, rate) => sum + rate, 0) / throughputRates.length : 0;

    // Calculate error rate metrics
    const errorRateMetrics = reportMetrics.filter(m => m.metric === 'errors.rate');
    const errorRates = errorRateMetrics.map(m => m.value);
    const avgErrorRate = errorRates.length > 0 ? 
      errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length : 0;

    // Calculate memory metrics
    const memoryMetrics = reportMetrics.filter(m => m.metric === 'memory.percentage');
    const memoryUsage = memoryMetrics.length > 0 ? 
      memoryMetrics[memoryMetrics.length - 1].value : 0;

    // Calculate CPU metrics
    const cpuMetrics = reportMetrics.filter(m => m.metric === 'cpu.usage');
    const cpuUsage = cpuMetrics.length > 0 ? 
      cpuMetrics[cpuMetrics.length - 1].value : 0;

    // Calculate database metrics
    const dbQueryMetrics = reportMetrics.filter(m => m.metric === 'database.query.avg');
    const dbQueryTimes = dbQueryMetrics.map(m => m.value);
    const dbQueryStats = this.calculateStats(dbQueryTimes);

    const dbConnectionMetrics = reportMetrics.filter(m => m.metric === 'database.connections.active');
    const activeConnections = dbConnectionMetrics.length > 0 ? 
      dbConnectionMetrics[dbConnectionMetrics.length - 1].value : 0;

    // Get active alerts
    const activeAlerts = this.alerts.filter(alert => 
      !alert.resolved && alert.timestamp >= startTime
    );

    // Determine overall health
    let health: 'excellent' | 'good' | 'degraded' | 'critical';
    if (activeAlerts.some(a => a.type === 'critical')) {
      health = 'critical';
    } else if (activeAlerts.some(a => a.type === 'warning')) {
      health = 'degraded';
    } else if (avgResponseTime > this.config.thresholds.responseTime.warning) {
      health = 'degraded';
    } else {
      health = avgErrorRate < 1 && avgResponseTime < 300 ? 'excellent' : 'good';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      responseTime: responseTimeStats,
      errorRate: avgErrorRate,
      memoryUsage,
      cpuUsage,
      dbQueryTime: dbQueryStats,
      activeConnections,
    });

    return {
      timestamp: endTime,
      duration,
      metrics: {
        responseTime: {
          avg: responseTimeStats.avg,
          p95: responseTimeStats.p95,
          p99: responseTimeStats.p99,
          max: responseTimeStats.max,
        },
        throughput: {
          requests: Math.round(avgThroughput * duration / 1000),
          rate: avgThroughput,
        },
        errorRate: {
          count: Math.round(avgErrorRate * duration / 1000 / 100),
          percentage: avgErrorRate,
        },
        memory: {
          used: 0, // Would calculate from actual memory metrics
          total: 0, // Would get from system
          percentage: memoryUsage,
        },
        cpu: {
          usage: cpuUsage,
        },
        database: {
          queryTime: {
            avg: dbQueryStats.avg,
            max: dbQueryStats.max,
          },
          connections: {
            active: activeConnections,
            idle: 0, // Would calculate from actual metrics
          },
        },
      },
      alerts: activeAlerts,
      recommendations,
      health,
    };
  }

  /**
   * Calculate statistics from array of values
   */
  private calculateStats(values: number[]): {
    avg: number;
    p95: number;
    p99: number;
    max: number;
  } {
    if (values.length === 0) {
      return { avg: 0, p95: 0, p99: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const avg = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    return {
      avg,
      p95: sorted[p95Index] || avg,
      p99: sorted[p99Index] || avg,
      max: sorted[sorted.length - 1] || avg,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (metrics.responseTime.avg > this.config.thresholds.responseTime.warning) {
      recommendations.push('Consider optimizing API response times or implementing caching');
    }

    // Error rate recommendations
    if (metrics.errorRate > this.config.thresholds.errorRate.warning) {
      recommendations.push('Investigate and fix error sources; implement better error handling');
    }

    // Memory usage recommendations
    if (metrics.memoryUsage > this.config.thresholds.memory.warning) {
      recommendations.push('Monitor memory usage and implement memory optimization strategies');
    }

    // CPU usage recommendations
    if (metrics.cpuUsage > this.config.thresholds.cpu.warning) {
      recommendations.push('Analyze CPU-intensive operations and consider optimization');
    }

    // Database recommendations
    if (metrics.dbQueryTime.avg > this.config.thresholds.database.queryTime.warning) {
      recommendations.push('Optimize database queries and consider indexing strategies');
    }

    // Connection recommendations
    if (metrics.activeConnections > this.config.thresholds.database.connections.warning) {
      recommendations.push('Monitor database connection pool and consider connection optimization');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('System performance is within acceptable parameters');
      recommendations.push('Continue monitoring and implement regular performance reviews');
    }

    return recommendations;
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get current alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'excellent' | 'good' | 'degraded' | 'critical';
    activeAlerts: number;
    metrics: Record<string, number>;
  } {
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);
    const criticalAlerts = activeAlerts.filter(alert => alert.type === 'critical');
    const warningAlerts = activeAlerts.filter(alert => alert.type === 'warning');

    let status: 'excellent' | 'good' | 'degraded' | 'critical';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'degraded';
    } else {
      status = 'excellent';
    }

    // Get latest metric values
    const latestMetrics: Record<string, number> = {};
    const recentMetrics = this.metrics.filter(
      metric => metric.timestamp > Date.now() - 60000 // Last minute
    );

    recentMetrics.forEach(metric => {
      if (!latestMetrics[metric.metric] || metric.timestamp > latestMetrics[metric.metric]) {
        latestMetrics[metric.metric] = metric.value;
      }
    });

    return {
      status,
      activeAlerts: activeAlerts.length,
      metrics: latestMetrics,
    };
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}