export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  eventProcessingTime: number;
  eventsPerMinute: number;
  errorRate: number;
  uptime: number;
}

export interface PerformanceThresholds {
  cpuWarning: number;
  cpuCritical: number;
  memoryWarning: number;
  memoryCritical: number;
  processingTimeWarning: number;
  processingTimeCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
}

export class PerformanceMonitor {
  private isInitialized = false;
  private metrics: PerformanceMetrics = {
    cpuUsage: 0,
    memoryUsage: 0,
    eventProcessingTime: 0,
    eventsPerMinute: 0,
    errorRate: 0,
    uptime: 0
  };
  
  private thresholds: PerformanceThresholds = {
    cpuWarning: 50,
    cpuCritical: 80,
    memoryWarning: 70,
    memoryCritical: 90,
    processingTimeWarning: 100,
    processingTimeCritical: 500,
    errorRateWarning: 5,
    errorRateCritical: 10
  };
  
  private startTime = Date.now();
  private eventProcessingTimes: number[] = [];
  private errorCount = 0;
  private totalEventCount = 0;
  private monitoringInterval?: number;
  private alertCallbacks: Map<string, (message: string) => void> = new Map();
  
  constructor() {
    // Auto-initialize when available
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('[PerformanceMonitor] Initializing...');
      
      // Load custom thresholds from storage
      await this.loadThresholds();
      
      // Start monitoring
      this.startMonitoring();
      
      this.isInitialized = true;
      console.log('[PerformanceMonitor] Initialized successfully');
      
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to initialize:', error);
      throw error;
    }
  }

  private async loadThresholds(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['performanceThresholds']);
        if (result.performanceThresholds) {
          this.thresholds = { ...this.thresholds, ...result.performanceThresholds };
        }
      }
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to load thresholds, using defaults');
    }
  }

  private startMonitoring(): void {
    // Update metrics every 30 seconds
    this.monitoringInterval = window.setInterval(() => {
      this.updateMetrics();
      this.checkThresholds();
    }, 30000);
    
    // Initial metrics update
    this.updateMetrics();
  }

  private updateMetrics(): void {
    try {
      // Update uptime
      this.metrics.uptime = Date.now() - this.startTime;
      
      // Update CPU usage (approximation using performance API)
      this.metrics.cpuUsage = this.estimateCPUUsage();
      
      // Update memory usage
      this.metrics.memoryUsage = this.estimateMemoryUsage();
      
      // Update event processing time (average)
      if (this.eventProcessingTimes.length > 0) {
        const avgTime = this.eventProcessingTimes.reduce((a, b) => a + b, 0) / this.eventProcessingTimes.length;
        this.metrics.eventProcessingTime = avgTime;
        
        // Keep only recent measurements (last 100)
        if (this.eventProcessingTimes.length > 100) {
          this.eventProcessingTimes = this.eventProcessingTimes.slice(-100);
        }
      }
      
      // Update events per minute
      this.metrics.eventsPerMinute = this.calculateEventsPerMinute();
      
      // Update error rate
      this.metrics.errorRate = this.calculateErrorRate();
      
    } catch (error) {
      console.error('[PerformanceMonitor] Error updating metrics:', error);
    }
  }

  private estimateCPUUsage(): number {
    try {
      if ('performance' in window && 'measure' in performance) {
        // Use Performance API for CPU estimation
        const entries = performance.getEntriesByType('measure');
        if (entries.length > 0) {
          const recentEntries = entries.slice(-10);
          const avgDuration = recentEntries.reduce((sum, entry) => sum + entry.duration, 0) / recentEntries.length;
          // Convert to percentage (rough approximation)
          return Math.min(100, (avgDuration / 1000) * 100);
        }
      }
      
      // Fallback: use event processing time as proxy
      return Math.min(100, this.metrics.eventProcessingTime / 5);
    } catch (error) {
      return 0;
    }
  }

  private estimateMemoryUsage(): number {
    try {
      if ('performance' in window && 'memory' in (performance as any)) {
        const memory = (performance as any).memory;
        if (memory.usedJSHeapSize && memory.totalJSHeapSize) {
          return (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
        }
      }
      
      // Fallback: estimate based on object counts
      return Math.min(100, (this.eventProcessingTimes.length / 1000) * 100);
    } catch (error) {
      return 0;
    }
  }

  private calculateEventsPerMinute(): number {
    try {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      // Count events in the last minute
      const recentEvents = this.eventProcessingTimes.filter((_, index) => {
        const eventTime = now - (this.eventProcessingTimes.length - index) * 1000;
        return eventTime > oneMinuteAgo;
      });
      
      return recentEvents.length;
    } catch (error) {
      return 0;
    }
  }

  private calculateErrorRate(): number {
    try {
      if (this.totalEventCount === 0) return 0;
      return (this.errorCount / this.totalEventCount) * 100;
    } catch (error) {
      return 0;
    }
  }

  private checkThresholds(): void {
    const issues: string[] = [];
    
    // Check CPU usage
    if (this.metrics.cpuUsage > this.thresholds.cpuCritical) {
      issues.push(`CPU usage critical: ${this.metrics.cpuUsage.toFixed(1)}%`);
    } else if (this.metrics.cpuUsage > this.thresholds.cpuWarning) {
      issues.push(`CPU usage high: ${this.metrics.cpuUsage.toFixed(1)}%`);
    }
    
    // Check memory usage
    if (this.metrics.memoryUsage > this.thresholds.memoryCritical) {
      issues.push(`Memory usage critical: ${this.metrics.memoryUsage.toFixed(1)}%`);
    } else if (this.metrics.memoryUsage > this.thresholds.memoryWarning) {
      issues.push(`Memory usage high: ${this.metrics.memoryUsage.toFixed(1)}%`);
    }
    
    // Check event processing time
    if (this.metrics.eventProcessingTime > this.thresholds.processingTimeCritical) {
      issues.push(`Event processing time critical: ${this.metrics.eventProcessingTime.toFixed(1)}ms`);
    } else if (this.metrics.eventProcessingTime > this.thresholds.processingTimeWarning) {
      issues.push(`Event processing time high: ${this.metrics.eventProcessingTime.toFixed(1)}ms`);
    }
    
    // Check error rate
    if (this.metrics.errorRate > this.thresholds.errorRateCritical) {
      issues.push(`Error rate critical: ${this.metrics.errorRate.toFixed(1)}%`);
    } else if (this.metrics.errorRate > this.thresholds.errorRateWarning) {
      issues.push(`Error rate high: ${this.metrics.errorRate.toFixed(1)}%`);
    }
    
    // Trigger alerts for issues
    issues.forEach(issue => this.triggerAlert('performance', issue));
  }

  recordEventProcessing(processingTime: number): void {
    try {
      this.eventProcessingTimes.push(processingTime);
      this.totalEventCount++;
      
      // Keep processing times array manageable
      if (this.eventProcessingTimes.length > 1000) {
        this.eventProcessingTimes = this.eventProcessingTimes.slice(-500);
      }
    } catch (error) {
      console.error('[PerformanceMonitor] Error recording event processing:', error);
    }
  }

  recordError(): void {
    try {
      this.errorCount++;
    } catch (error) {
      console.error('[PerformanceMonitor] Error recording error:', error);
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  async updateThresholds(newThresholds: Partial<PerformanceThresholds>): Promise<void> {
    try {
      this.thresholds = { ...this.thresholds, ...newThresholds };
      
      // Save to storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ performanceThresholds: this.thresholds });
      }
    } catch (error) {
      console.error('[PerformanceMonitor] Error updating thresholds:', error);
    }
  }

  onAlert(type: string, callback: (message: string) => void): () => void {
    this.alertCallbacks.set(type, callback);
    
    // Return unsubscribe function
    return () => {
      this.alertCallbacks.delete(type);
    };
  }

  private triggerAlert(type: string, message: string): void {
    const callback = this.alertCallbacks.get(type);
    if (callback) {
      try {
        callback(message);
      } catch (error) {
        console.error('[PerformanceMonitor] Error in alert callback:', error);
      }
    }
    
    // Log all alerts
    console.log(`[PerformanceMonitor] Alert [${type}]: ${message}`);
  }

  async getReport(): Promise<{
    metrics: PerformanceMetrics;
    thresholds: PerformanceThresholds;
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check all thresholds
    if (this.metrics.cpuUsage > this.thresholds.cpuCritical) {
      issues.push('CPU usage is critical');
      recommendations.push('Consider reducing event capture frequency');
    } else if (this.metrics.cpuUsage > this.thresholds.cpuWarning) {
      issues.push('CPU usage is elevated');
      recommendations.push('Monitor CPU usage and consider optimizations');
    }
    
    if (this.metrics.memoryUsage > this.thresholds.memoryCritical) {
      issues.push('Memory usage is critical');
      recommendations.push('Clear cached data and restart extension');
    } else if (this.metrics.memoryUsage > this.thresholds.memoryWarning) {
      issues.push('Memory usage is elevated');
      recommendations.push('Consider reducing data retention period');
    }
    
    if (this.metrics.eventProcessingTime > this.thresholds.processingTimeCritical) {
      issues.push('Event processing is too slow');
      recommendations.push('Optimize event processing algorithms');
    }
    
    if (this.metrics.errorRate > this.thresholds.errorRateCritical) {
      issues.push('Error rate is critical');
      recommendations.push('Review error logs and fix underlying issues');
    }
    
    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.some(issue => issue.includes('critical'))) {
      status = 'critical';
    } else if (issues.length > 0) {
      status = 'warning';
    }
    
    return {
      metrics: this.getMetrics(),
      thresholds: this.getThresholds(),
      status,
      issues,
      recommendations
    };
  }

  cleanup(): void {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }
      
      // Clear data
      this.eventProcessingTimes = [];
      this.alertCallbacks.clear();
      
      this.isInitialized = false;
      
    } catch (error) {
      console.error('[PerformanceMonitor] Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();