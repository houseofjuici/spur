/**
 * Performance Dashboard for Spur Super App
 * Real-time monitoring and analytics interface
 */

import { PerformanceMonitor, PerformanceReport, PerformanceAlert } from './performance-monitor';

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'alert' | 'health';
  size: 'small' | 'medium' | 'large';
  position: { row: number; col: number };
  data: any;
  config: any;
}

export interface DashboardConfig {
  title: string;
  description: string;
  refreshInterval: number; // milliseconds
  widgets: DashboardWidget[];
  theme: 'light' | 'dark';
  layout: 'grid' | 'flex';
}

/**
 * Performance Dashboard System
 */
export class PerformanceDashboard {
  private monitor: PerformanceMonitor;
  private config: DashboardConfig;
  private widgets: Map<string, DashboardWidget> = new Map();
  private updateCallbacks: ((widgetId: string, data: any) => void)[] = [];
  private refreshTimer?: NodeJS.Timeout;

  constructor(monitor: PerformanceMonitor, config?: Partial<DashboardConfig>) {
    this.monitor = monitor;
    this.config = {
      title: 'Spur Performance Dashboard',
      description: 'Real-time monitoring and analytics',
      refreshInterval: 5000, // 5 seconds
      widgets: [],
      theme: 'dark',
      layout: 'grid',
      ...config,
    };

    this.initializeDefaultWidgets();
    this.startRefreshCycle();
  }

  /**
   * Initialize default dashboard widgets
   */
  private initializeDefaultWidgets() {
    this.config.widgets = [
      // Health Status Widget
      {
        id: 'health-status',
        title: 'System Health',
        type: 'health',
        size: 'small',
        position: { row: 0, col: 0 },
        data: null,
        config: {
          metrics: ['response.time', 'errors.rate', 'memory.percentage', 'cpu.usage'],
        },
      },

      // Response Time Chart
      {
        id: 'response-time-chart',
        title: 'Response Time Trends',
        type: 'chart',
        size: 'medium',
        position: { row: 0, col: 1 },
        data: null,
        config: {
          metric: 'response.time',
          timeRange: '1h',
          aggregation: 'avg',
          chartType: 'line',
        },
      },

      // Error Rate Widget
      {
        id: 'error-rate-widget',
        title: 'Error Rate',
        type: 'metric',
        size: 'small',
        position: { row: 0, col: 2 },
        data: null,
        config: {
          metric: 'errors.rate',
          unit: '%',
          trend: true,
        },
      },

      // Throughput Chart
      {
        id: 'throughput-chart',
        title: 'Request Throughput',
        type: 'chart',
        size: 'medium',
        position: { row: 1, col: 0 },
        data: null,
        config: {
          metric: 'throughput.rate',
          timeRange: '1h',
          aggregation: 'sum',
          chartType: 'bar',
        },
      },

      // Memory Usage Chart
      {
        id: 'memory-usage-chart',
        title: 'Memory Usage',
        type: 'chart',
        size: 'medium',
        position: { row: 1, col: 1 },
        data: null,
        config: {
          metrics: ['memory.used', 'memory.total'],
          timeRange: '1h',
          chartType: 'area',
          normalization: 'percentage',
        },
      },

      // CPU Usage Chart
      {
        id: 'cpu-usage-chart',
        title: 'CPU Usage',
        type: 'chart',
        size: 'small',
        position: { row: 1, col: 2 },
        data: null,
        config: {
          metric: 'cpu.usage',
          timeRange: '1h',
          chartType: 'gauge',
          max: 100,
        },
      },

      // Active Alerts Widget
      {
        id: 'active-alerts',
        title: 'Active Alerts',
        type: 'alert',
        size: 'medium',
        position: { row: 2, col: 0 },
        data: null,
        config: {
          maxItems: 10,
          severityFilter: ['critical', 'warning'],
        },
      },

      // Component Performance Widget
      {
        id: 'component-performance',
        title: 'Component Performance',
        type: 'chart',
        size: 'medium',
        position: { row: 2, col: 1 },
        data: null,
        config: {
          components: ['assistant', 'capture', 'memoryGraph'],
          metrics: ['response.time', 'memory.usage'],
          chartType: 'radar',
        },
      },

      // Performance Summary Widget
      {
        id: 'performance-summary',
        title: 'Performance Summary',
        type: 'metric',
        size: 'small',
        position: { row: 2, col: 2 },
        data: null,
        config: {
          metrics: [
            { name: 'Uptime', metric: 'system.uptime', unit: 'hours' },
            { name: 'Requests', metric: 'throughput.requests.total', unit: 'count' },
            { name: 'Cache Hit Rate', metric: 'cache.hitRate', unit: '%' },
          ],
        },
      },
    ];

    // Initialize widgets map
    this.config.widgets.forEach(widget => {
      this.widgets.set(widget.id, widget);
    });
  }

  /**
   * Start dashboard refresh cycle
   */
  private startRefreshCycle() {
    this.refreshTimer = setInterval(() => {
      this.refreshWidgets();
    }, this.config.refreshInterval);
  }

  /**
   * Refresh all widgets
   */
  private async refreshWidgets() {
    for (const [widgetId, widget] of this.widgets) {
      try {
        const data = await this.fetchWidgetData(widget);
        widget.data = data;
        this.notifyUpdate(widgetId, data);
      } catch (error) {
        console.error(`Failed to refresh widget ${widgetId}:`, error);
        widget.data = { error: error.message };
        this.notifyUpdate(widgetId, widget.data);
      }
    }
  }

  /**
   * Fetch data for specific widget
   */
  private async fetchWidgetData(widget: DashboardWidget): Promise<any> {
    switch (widget.type) {
      case 'health':
        return this.fetchHealthData(widget);
      case 'metric':
        return this.fetchMetricData(widget);
      case 'chart':
        return this.fetchChartData(widget);
      case 'alert':
        return this.fetchAlertData(widget);
      default:
        throw new Error(`Unknown widget type: ${widget.type}`);
    }
  }

  /**
   * Fetch health status data
   */
  private async fetchHealthData(widget: DashboardWidget): Promise<any> {
    const healthStatus = this.monitor.getHealthStatus();
    const report = this.monitor.generatePerformanceReport(5 * 60 * 1000); // 5 minutes

    return {
      status: healthStatus.status,
      metrics: healthStatus.metrics,
      uptime: this.calculateUptime(),
      report: {
        health: report.health,
        recommendations: report.recommendations.slice(0, 3), // Top 3 recommendations
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Fetch metric data
   */
  private async fetchMetricData(widget: DashboardWidget): Promise<any> {
    const { config } = widget;
    const metrics = this.monitor.getMetrics();
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentMetrics = metrics.filter(m => 
      m.timestamp >= oneHourAgo && m.timestamp <= now
    );

    const data: any = {};

    if (config.metrics) {
      for (const metricConfig of config.metrics) {
        const metricName = typeof metricConfig === 'string' ? metricConfig : metricConfig.metric;
        const metricValues = recentMetrics.filter(m => m.metric === metricName).map(m => m.value);
        
        if (metricValues.length > 0) {
          const current = metricValues[metricValues.length - 1];
          const previous = metricValues.length > 1 ? metricValues[metricValues.length - 2] : current;
          const trend = ((current - previous) / previous) * 100;

          data[metricName] = {
            current,
            previous,
            trend: isFinite(trend) ? trend : 0,
            unit: config.unit || this.getMetricUnit(metricName),
          };
        }
      }
    } else if (config.metric) {
      const metricValues = recentMetrics.filter(m => m.metric === config.metric).map(m => m.value);
      
      if (metricValues.length > 0) {
        const current = metricValues[metricValues.length - 1];
        const previous = metricValues.length > 1 ? metricValues[metricValues.length - 2] : current;
        const trend = ((current - previous) / previous) * 100;

        data = {
          current,
          previous,
          trend: isFinite(trend) ? trend : 0,
          unit: config.unit || this.getMetricUnit(config.metric),
        };
      }
    }

    return {
      ...data,
      timestamp: now,
    };
  }

  /**
   * Fetch chart data
   */
  private async fetchChartData(widget: DashboardWidget): Promise<any> {
    const { config } = widget;
    const metrics = this.monitor.getMetrics();
    const now = Date.now();
    let timeRange: number;

    switch (config.timeRange) {
      case '1h':
        timeRange = 60 * 60 * 1000;
        break;
      case '6h':
        timeRange = 6 * 60 * 60 * 1000;
        break;
      case '24h':
        timeRange = 24 * 60 * 60 * 1000;
        break;
      default:
        timeRange = 60 * 60 * 1000; // Default to 1 hour
    }

    const startTime = now - timeRange;
    const relevantMetrics = metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= now
    );

    switch (config.chartType) {
      case 'line':
      case 'bar':
        return this.generateTimeSeriesData(relevantMetrics, config);
      case 'area':
        return this.generateAreaChartData(relevantMetrics, config);
      case 'gauge':
        return this.generateGaugeData(relevantMetrics, config);
      case 'radar':
        return this.generateRadarData(relevantMetrics, config);
      default:
        return this.generateTimeSeriesData(relevantMetrics, config);
    }
  }

  /**
   * Generate time series chart data
   */
  private generateTimeSeriesData(metrics: any[], config: any): any {
    const dataPoints: any[] = [];
    const interval = 60000; // 1 minute intervals
    const now = Date.now();
    const timeRange = now - (now - metrics[0]?.timestamp || now);

    for (let time = metrics[0]?.timestamp || now - timeRange; time <= now; time += interval) {
      const point: any = { timestamp: time };

      if (config.metric) {
        const metricValues = metrics.filter(m => 
          m.metric === config.metric && 
          m.timestamp >= time && 
          m.timestamp < time + interval
        );

        if (metricValues.length > 0) {
          const values = metricValues.map(m => m.value);
          switch (config.aggregation) {
            case 'avg':
              point.value = values.reduce((sum, v) => sum + v, 0) / values.length;
              break;
            case 'sum':
              point.value = values.reduce((sum, v) => sum + v, 0);
              break;
            case 'max':
              point.value = Math.max(...values);
              break;
            case 'min':
              point.value = Math.min(...values);
              break;
            default:
              point.value = values[values.length - 1];
          }
        } else {
          point.value = null;
        }
      }

      dataPoints.push(point);
    }

    return {
      dataPoints,
      metric: config.metric,
      unit: this.getMetricUnit(config.metric),
    };
  }

  /**
   * Generate area chart data
   */
  private generateAreaChartData(metrics: any[], config: any): any {
    const dataPoints: any[] = [];
    const interval = 60000; // 1 minute intervals
    const now = Date.now();
    const timeRange = now - (now - metrics[0]?.timestamp || now - 60 * 60 * 1000);

    for (let time = metrics[0]?.timestamp || now - timeRange; time <= now; time += interval) {
      const point: any = { timestamp: time };

      if (config.metrics) {
        for (const metricName of config.metrics) {
          const metricValues = metrics.filter(m => 
            m.metric === metricName && 
            m.timestamp >= time && 
            m.timestamp < time + interval
          );

          if (metricValues.length > 0) {
            const values = metricValues.map(m => m.value);
            point[metricName] = values.reduce((sum, v) => sum + v, 0) / values.length;
          } else {
            point[metricName] = null;
          }
        }
      }

      dataPoints.push(point);
    }

    return {
      dataPoints,
      metrics: config.metrics,
      normalization: config.normalization,
    };
  }

  /**
   * Generate gauge chart data
   */
  private generateGaugeData(metrics: any[], config: any): any {
    const recentMetrics = metrics.filter(m => m.metric === config.metric);
    const currentValue = recentMetrics.length > 0 ? 
      recentMetrics[recentMetrics.length - 1].value : 0;

    return {
      current: currentValue,
      max: config.max || 100,
      unit: this.getMetricUnit(config.metric),
      thresholds: {
        warning: config.max * 0.7,
        critical: config.max * 0.9,
      },
    };
  }

  /**
   * Generate radar chart data
   */
  private generateRadarData(metrics: any[], config: any): any {
    const data: any = {};

    if (config.components) {
      for (const component of config.components) {
        data[component] = {};
        
        if (config.metrics) {
          for (const metric of config.metrics) {
            const componentMetric = `${component}.${metric}`;
            const recentMetrics = metrics.filter(m => m.metric === componentMetric);
            const value = recentMetrics.length > 0 ? 
              recentMetrics[recentMetrics.length - 1].value : 0;
            
            data[component][metric] = value;
          }
        }
      }
    }

    return {
      data,
      components: config.components,
      metrics: config.metrics,
    };
  }

  /**
   * Fetch alert data
   */
  private async fetchAlertData(widget: DashboardWidget): Promise<any> {
    const alerts = this.monitor.getAlerts();
    const { config } = widget;

    let filteredAlerts = alerts.filter(alert => !alert.resolved);

    if (config.severityFilter) {
      filteredAlerts = filteredAlerts.filter(alert => 
        config.severityFilter.includes(alert.type)
      );
    }

    const sortedAlerts = filteredAlerts.sort((a, b) => b.timestamp - a.timestamp);

    return {
      alerts: sortedAlerts.slice(0, config.maxItems || 10),
      total: filteredAlerts.length,
      criticalCount: filteredAlerts.filter(a => a.type === 'critical').length,
      warningCount: filteredAlerts.filter(a => a.type === 'warning').length,
      timestamp: Date.now(),
    };
  }

  /**
   * Get unit for metric
   */
  private getMetricUnit(metric: string): string {
    const unitMap: Record<string, string> = {
      'response.time': 'ms',
      'throughput.rate': 'rps',
      'throughput.requests': 'count',
      'errors.rate': '%',
      'errors.count': 'count',
      'memory.used': 'MB',
      'memory.total': 'MB',
      'memory.percentage': '%',
      'cpu.usage': '%',
      'database.query.avg': 'ms',
      'database.query.max': 'ms',
      'database.connections.active': 'count',
      'database.connections.percentage': '%',
      'assistant.response.time': 'ms',
      'assistant.accuracy': '%',
      'assistant.context.window': 'tokens',
      'assistant.users.active': 'count',
      'capture.events.processed': 'count',
      'capture.processing.time': 'ms',
      'capture.memory.usage': 'MB',
      'capture.error.rate': '%',
      'memoryGraph.nodes': 'count',
      'memoryGraph.edges': 'count',
      'memoryGraph.query.time': 'ms',
      'memoryGraph.cache.hitRate': '%',
      'memoryGraph.memory.usage': 'MB',
    };

    return unitMap[metric] || '';
  }

  /**
   * Calculate system uptime
   */
  private calculateUptime(): number {
    // In a real implementation, this would track actual application start time
    const metrics = this.monitor.getMetrics();
    if (metrics.length === 0) return 0;
    
    const oldestMetric = metrics.reduce((oldest, current) => 
      current.timestamp < oldest.timestamp ? current : oldest
    );
    
    return (Date.now() - oldestMetric.timestamp) / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Notify widget update
   */
  private notifyUpdate(widgetId: string, data: any): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(widgetId, data);
      } catch (error) {
        console.error('Error in dashboard update callback:', error);
      }
    });
  }

  /**
   * Add widget update callback
   */
  onUpdate(callback: (widgetId: string, data: any) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Get dashboard configuration
   */
  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  /**
   * Get widget data
   */
  getWidgetData(widgetId: string): any {
    const widget = this.widgets.get(widgetId);
    return widget ? widget.data : null;
  }

  /**
   * Get all widgets
   */
  getWidgets(): DashboardWidget[] {
    return this.config.widgets.map(widget => ({ ...widget }));
  }

  /**
   * Add custom widget
   */
  addWidget(widget: DashboardWidget): void {
    this.widgets.set(widget.id, widget);
    this.config.widgets.push(widget);
  }

  /**
   * Remove widget
   */
  removeWidget(widgetId: string): boolean {
    const removed = this.widgets.delete(widgetId);
    if (removed) {
      this.config.widgets = this.config.widgets.filter(w => w.id !== widgetId);
    }
    return removed;
  }

  /**
   * Update widget configuration
   */
  updateWidget(widgetId: string, updates: Partial<DashboardWidget>): boolean {
    const widget = this.widgets.get(widgetId);
    if (widget) {
      Object.assign(widget, updates);
      return true;
    }
    return false;
  }

  /**
   * Update dashboard configuration
   */
  updateConfig(newConfig: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart refresh cycle if interval changed
    if (newConfig.refreshInterval && this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.startRefreshCycle();
    }
  }

  /**
   * Export dashboard data
   */
  exportData(format: 'json' | 'csv' = 'json'): any {
    if (format === 'json') {
      return {
        config: this.config,
        widgets: Array.from(this.widgets.entries()).map(([id, widget]) => ({
          id,
          ...widget,
        })),
        timestamp: Date.now(),
      };
    } else if (format === 'csv') {
      // Generate CSV export of all metrics
      const metrics = this.monitor.getMetrics();
      const headers = ['timestamp', 'metric', 'value', 'unit', 'tags'];
      const rows = metrics.map(m => [
        new Date(m.timestamp).toISOString(),
        m.metric,
        m.value.toString(),
        m.unit,
        JSON.stringify(m.tags),
      ]);

      return {
        headers,
        rows,
        filename: `spur-metrics-${new Date().toISOString().split('T')[0]}.csv`,
      };
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Generate performance report for dashboard
   */
  generateReport(duration?: number): PerformanceReport {
    return this.monitor.generatePerformanceReport(duration);
  }

  /**
   * Destroy dashboard and cleanup
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.updateCallbacks.length = 0;
    this.widgets.clear();
  }
}