/**
 * Type definitions for Performance Monitoring system
 * Optimized for real-time performance tracking and alerting
 */

export interface PerformanceMetrics {
  cpu: {
    usage: number;           // Current CPU usage percentage
    average: number;         // Moving average CPU usage
    peak: number;            // Peak CPU usage recorded
  };
  memory: {
    used: number;            // Memory usage in MB
    available: number;       // Available memory in MB
    percentage: number;      // Memory usage percentage
  };
  latency: {
    average: number;         // Average response latency in ms
    p95: number;             // 95th percentile latency
    p99: number;             // 99th percentile latency
  };
  cache: {
    hitRate: number;         // Cache hit rate percentage
    size: number;            // Current cache size
    evictionRate: number;    // Cache eviction rate
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'cpu' | 'memory' | 'latency' | 'cache';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  value: number;
  threshold: number;
  anomaly?: boolean;
  recommendations: string[];
}

export interface MonitoringConfig {
  sampleRate?: number;                    // Sampling rate for data collection
  alertThresholds?: {
    cpu?: number;                         // CPU threshold percentage
    memory?: number;                      // Memory threshold in MB
    latency?: number;                     // Latency threshold in ms
  };
  historyRetentionHours?: number;         // How long to keep historical data
  enableRealTimeAlerts?: boolean;         // Enable real-time alert notifications
  adaptiveSampling?: boolean;             // Enable adaptive sampling based on load
}