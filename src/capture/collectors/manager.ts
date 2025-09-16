import { 
  BaseEvent, 
  EventType, 
  EventSource 
} from '@/types';
import { 
  BaseCollector, 
  CollectorConfig 
} from './base';
import { 
  BrowserCollector, 
  BrowserCollectorConfig 
} from './browser';
import { 
  SystemCollector, 
  SystemCollectorConfig 
} from './system';
import { 
  RateLimitConfig, 
  DebounceConfig 
} from '@/types/events';

export interface CollectorManagerConfig {
  globalEnabled: boolean;
  globalFilters?: EventFilter[];
  rateLimiting: RateLimitConfig;
  debouncing: DebounceConfig;
  errorHandling: {
    maxRetries: number;
    retryDelay: number;
    fallbackMode: boolean;
  };
  performance: {
    maxMemoryUsage: number;
    maxCpuUsage: number;
    processingTimeout: number;
  };
  collectors: {
    browser: Partial<BrowserCollectorConfig>;
    system: Partial<SystemCollectorConfig>;
    // Future collectors will be added here
  };
}

export interface EventFilter {
  types?: EventType[];
  sources?: EventSource[];
  domains?: string[];
  apps?: string[];
  keywords?: string[];
  excludeKeywords?: string[];
  minConfidence?: number;
  maxLatency?: number;
  timeRange?: {
    start: number;
    end: number;
  };
  privacyLevel?: 'minimal' | 'standard' | 'enhanced';
}

export interface ManagerMetrics {
  totalEvents: number;
  eventsByType: Record<EventType, number>;
  eventsBySource: Record<EventSource, number>;
  errors: number;
  averageLatency: number;
  isHealthy: boolean;
  collectorsStatus: Record<string, {
    enabled: boolean;
    running: boolean;
    events: number;
    errors: number;
    lastActivity: number;
  }>;
  rateLimitStatus: {
    limited: boolean;
    reason?: string;
    resetTime?: number;
  };
}

export class CollectorManager {
  private config: CollectorManagerConfig;
  private collectors: Map<string, BaseCollector> = new Map();
  private eventBuffer: BaseEvent[] = [];
  private metrics: ManagerMetrics;
  private isRunning = false;
  private processingInterval?: number;
  private rateLimitData = {
    eventsThisSecond: 0,
    eventsThisMinute: 0,
    eventsThisHour: 0,
    lastSecondReset: Date.now(),
    lastMinuteReset: Date.now(),
    lastHourReset: Date.now(),
    isLimited: false,
    limitReason: '',
    limitResetTime: 0
  };
  private debounceTimers: Map<string, number> = new Map();
  private eventCallbacks: Set<(events: BaseEvent[]) => void> = new Set();
  private errorCallback?: (error: Error) => void;

  constructor(config: Partial<CollectorManagerConfig> = {}) {
    this.config = {
      globalEnabled: true,
      rateLimiting: {
        maxEventsPerSecond: 10,
        maxEventsPerMinute: 300,
        maxEventsPerHour: 10000,
        burstSize: 50,
        cooldownPeriod: 5000,
        adaptiveLimiting: true,
        priorityThresholds: {
          high: 8,
          medium: 5,
          low: 2
        }
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
        maxMemoryUsage: 100, // MB
        maxCpuUsage: 80, // %
        processingTimeout: 5000 // ms
      },
      collectors: {
        browser: {
          enabled: true,
          captureFrequency: 1000,
          batchSize: 10
        },
        system: {
          enabled: false,
          captureFrequency: 2000,
          batchSize: 5
        }
      },
      ...config
    };

    this.metrics = this.initializeMetrics();
    this.initializeCollectors();
  }

  private initializeMetrics(): ManagerMetrics {
    const eventsByType: Record<EventType, number> = {} as any;
    const eventsBySource: Record<EventSource, number> = {} as any;
    
    Object.values(EventType).forEach(type => {
      eventsByType[type] = 0;
    });
    
    Object.values(EventSource).forEach(source => {
      eventsBySource[source] = 0;
    });

    return {
      totalEvents: 0,
      eventsByType,
      eventsBySource,
      errors: 0,
      averageLatency: 0,
      isHealthy: true,
      collectorsStatus: {},
      rateLimitStatus: {
        limited: false
      }
    };
  }

  private initializeCollectors(): void {
    // Initialize browser collector
    if (this.config.collectors.browser.enabled) {
      const browserCollector = new BrowserCollector(this.config.collectors.browser);
      this.collectors.set('browser', browserCollector);
      
      // Set up error handling
      browserCollector.onError((error) => {
        this.handleCollectorError('browser', error);
      });
    }

    // Initialize system collector
    if (this.config.collectors.system.enabled) {
      const systemCollector = new SystemCollector(this.config.collectors.system);
      this.collectors.set('system', systemCollector);
      
      // Set up error handling
      systemCollector.onError((error) => {
        this.handleCollectorError('system', error);
      });
    }

    // Initialize other collectors as they are added
    // this.initializeEmailCollector();
    // this.initializeCodeCollector();
    // etc.
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.config.globalEnabled) return;

    try {
      console.log('[CollectorManager] Starting collection...');

      // Start all collectors
      const startPromises = Array.from(this.collectors.entries()).map(async ([name, collector]) => {
        try {
          await collector.start();
          this.metrics.collectorsStatus[name] = {
            enabled: true,
            running: true,
            events: 0,
            errors: 0,
            lastActivity: Date.now()
          };
          console.log(`[CollectorManager] Started ${name} collector`);
        } catch (error) {
          console.error(`[CollectorManager] Failed to start ${name} collector:`, error);
          this.metrics.collectorsStatus[name] = {
            enabled: true,
            running: false,
            events: 0,
            errors: 1,
            lastActivity: Date.now()
          };
        }
      });

      await Promise.all(startPromises);

      // Start processing interval
      this.processingInterval = window.setInterval(() => {
        this.processEventBuffer();
      }, 1000);

      // Start rate limit cleanup
      this.startRateLimitCleanup();

      this.isRunning = true;
      console.log('[CollectorManager] Started successfully');

    } catch (error) {
      console.error('[CollectorManager] Failed to start:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[CollectorManager] Stopping collection...');

      // Stop all collectors
      const stopPromises = Array.from(this.collectors.entries()).map(async ([name, collector]) => {
        try {
          await collector.stop();
          if (this.metrics.collectorsStatus[name]) {
            this.metrics.collectorsStatus[name].running = false;
          }
        } catch (error) {
          console.error(`[CollectorManager] Failed to stop ${name} collector:`, error);
        }
      });

      await Promise.all(stopPromises);

      // Clear intervals
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = undefined;
      }

      // Process remaining events
      await this.processEventBuffer();

      this.isRunning = false;
      console.log('[CollectorManager] Stopped successfully');

    } catch (error) {
      console.error('[CollectorManager] Error stopping:', error);
    }
  }

  private async processEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToProcess = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // Apply global filters
      const filteredEvents = this.applyGlobalFilters(eventsToProcess);
      
      // Apply rate limiting
      const rateLimitedEvents = this.applyRateLimiting(filteredEvents);
      
      // Apply debouncing
      const debouncedEvents = this.applyDebouncing(rateLimitedEvents);
      
      // Process events
      await this.processEvents(debouncedEvents);

    } catch (error) {
      console.error('[CollectorManager] Error processing event buffer:', error);
      this.handleError(error as Error);
    }
  }

  private applyGlobalFilters(events: BaseEvent[]): BaseEvent[] {
    if (!this.config.globalFilters || this.config.globalFilters.length === 0) {
      return events;
    }

    return events.filter(event => {
      return this.config.globalFilters!.every(filter => this.passesFilter(event, filter));
    });
  }

  private passesFilter(event: BaseEvent, filter: EventFilter): boolean {
    // Type filter
    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }

    // Source filter
    if (filter.sources && !filter.sources.includes(event.source)) {
      return false;
    }

    // Domain filter
    if (filter.domains && event.metadata.url) {
      try {
        const url = new URL(event.metadata.url);
        if (!filter.domains.some(domain => url.hostname.includes(domain))) {
          return false;
        }
      } catch {
        return false;
      }
    }

    // App filter (for system events)
    if (filter.apps && event.metadata.appName) {
      if (!filter.apps.some(app => event.metadata.appName.toLowerCase().includes(app.toLowerCase()))) {
        return false;
      }
    }

    // Keyword filter
    if (filter.keywords && event.content?.text) {
      const text = event.content.text.toLowerCase();
      if (!filter.keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        return false;
      }
    }

    // Exclude keywords
    if (filter.excludeKeywords && event.content?.text) {
      const text = event.content.text.toLowerCase();
      if (filter.excludeKeywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        return false;
      }
    }

    return true;
  }

  private applyRateLimiting(events: BaseEvent[]): BaseEvent[] {
    const now = Date.now();
    this.updateRateLimitCounters(now);

    if (this.rateLimitData.isLimited) {
      // Check if rate limit should be reset
      if (now > this.rateLimitData.limitResetTime) {
        this.resetRateLimit();
      } else {
        // Still rate limited, drop low-priority events
        return events.filter(event => (event.priority || 5) >= this.config.rateLimiting.priorityThresholds.high);
      }
    }

    // Apply per-second limit
    if (this.rateLimitData.eventsThisSecond >= this.config.rateLimiting.maxEventsPerSecond) {
      return events.filter(event => (event.priority || 5) >= this.config.rateLimiting.priorityThresholds.medium);
    }

    // Apply per-minute limit
    if (this.rateLimitData.eventsThisMinute >= this.config.rateLimiting.maxEventsPerMinute) {
      return events.filter(event => (event.priority || 5) >= this.config.rateLimiting.priorityThresholds.high);
    }

    return events;
  }

  private updateRateLimitCounters(now: number): void {
    // Reset counters based on time windows
    if (now - this.rateLimitData.lastSecondReset >= 1000) {
      this.rateLimitData.eventsThisSecond = 0;
      this.rateLimitData.lastSecondReset = now;
    }

    if (now - this.rateLimitData.lastMinuteReset >= 60000) {
      this.rateLimitData.eventsThisMinute = 0;
      this.rateLimitData.lastMinuteReset = now;
    }

    if (now - this.rateLimitData.lastHourReset >= 3600000) {
      this.rateLimitData.eventsThisHour = 0;
      this.rateLimitData.lastHourReset = now;
    }

    // Update rate limit status
    this.metrics.rateLimitStatus = {
      limited: this.rateLimitData.isLimited,
      reason: this.rateLimitData.limitReason,
      resetTime: this.rateLimitData.limitResetTime
    };
  }

  private resetRateLimit(): void {
    this.rateLimitData = {
      eventsThisSecond: 0,
      eventsThisMinute: 0,
      eventsThisHour: 0,
      lastSecondReset: Date.now(),
      lastMinuteReset: Date.now(),
      lastHourReset: Date.now(),
      isLimited: false,
      limitReason: '',
      limitResetTime: 0
    };
  }

  private applyDebouncing(events: BaseEvent[]): BaseEvent[] {
    if (!this.config.debouncing.enabled) {
      return events;
    }

    const debouncedEvents: BaseEvent[] = [];
    const debounceKeys = new Set<string>();

    for (const event of events) {
      const key = this.generateDebounceKey(event);
      
      if (debounceKeys.has(key)) {
        continue; // Skip debounced events
      }

      const delay = this.getDebounceDelay(event);
      
      if (delay > 0) {
        // Set up debounce timer
        const timer = setTimeout(() => {
          debounceKeys.delete(key);
          this.debounceTimers.delete(key);
        }, delay) as unknown as number;
        
        this.debounceTimers.set(key, timer);
        debounceKeys.add(key);
      }

      debouncedEvents.push(event);
    }

    return debouncedEvents;
  }

  private generateDebounceKey(event: BaseEvent): string {
    if (this.config.debouncing.keyGeneration === 'advanced') {
      return `${event.type}:${event.source}:${event.metadata.action}:${event.metadata.url || event.metadata.appName || 'unknown'}`;
    }
    return `${event.type}:${event.metadata.action}`;
  }

  private getDebounceDelay(event: BaseEvent): number {
    const action = event.metadata.action;
    return this.config.debouncing.actionDelays[action as string] || this.config.debouncing.defaultDelay;
  }

  private async processEvents(events: BaseEvent[]): Promise<void> {
    if (events.length === 0) return;

    const startTime = performance.now();

    try {
      // Update metrics
      this.metrics.totalEvents += events.length;
      
      events.forEach(event => {
        this.metrics.eventsByType[event.type]++;
        this.metrics.eventsBySource[event.source]++;
        
        // Update collector metrics
        const collectorName = this.getCollectorNameForEvent(event);
        if (collectorName && this.metrics.collectorsStatus[collectorName]) {
          this.metrics.collectorsStatus[collectorName].events++;
          this.metrics.collectorsStatus[collectorName].lastActivity = Date.now();
        }
      });

      // Update rate limit counters
      events.forEach(() => {
        this.rateLimitData.eventsThisSecond++;
        this.rateLimitData.eventsThisMinute++;
        this.rateLimitData.eventsThisHour++;
      });

      // Emit events to callbacks
      if (this.eventCallbacks.size > 0) {
        const eventCallbackPromises = Array.from(this.eventCallbacks).map(callback => {
          try {
            callback(events);
          } catch (error) {
            console.error('[CollectorManager] Error in event callback:', error);
          }
        });
        await Promise.all(eventCallbackPromises);
      }

      // Update average latency
      const processingTime = performance.now() - startTime;
      this.metrics.averageLatency = this.metrics.averageLatency * 0.9 + processingTime * 0.1;

    } catch (error) {
      console.error('[CollectorManager] Error processing events:', error);
      this.handleError(error as Error);
    }
  }

  private getCollectorNameForEvent(event: BaseEvent): string | null {
    // Simple mapping - could be made more sophisticated
    if (event.source === EventSource.CONTENT_SCRIPT || event.source === EventSource.BACKGROUND_SERVICE) {
      return 'browser';
    }
    if (event.source === EventSource.NATIVE_MESSAGING) {
      return 'system';
    }
    return null;
  }

  private handleCollectorError(collectorName: string, error: Error): void {
    console.error(`[CollectorManager] Error in ${collectorName} collector:`, error);
    
    if (this.metrics.collectorsStatus[collectorName]) {
      this.metrics.collectorsStatus[collectorName].errors++;
    }
    
    this.metrics.errors++;
    this.handleError(error);
  }

  private handleError(error: Error): void {
    this.metrics.isHealthy = false;
    
    console.error('[CollectorManager] Error:', error);
    
    if (this.errorCallback) {
      this.errorCallback(error);
    }
    
    // Attempt to recover
    setTimeout(() => {
      this.metrics.isHealthy = true;
    }, 5000);
  }

  private startRateLimitCleanup(): void {
    // Clean up old debounce timers
    setInterval(() => {
      const now = Date.now();
      for (const [key, timer] of this.debounceTimers) {
        if (now > (timer as any).timeout) {
          clearTimeout(timer);
          this.debounceTimers.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  // Public API methods
  onEvents(callback: (events: BaseEvent[]) => void): () => void {
    this.eventCallbacks.add(callback);
    
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  getMetrics(): ManagerMetrics {
    return { ...this.metrics };
  }

  getConfig(): CollectorManagerConfig {
    return { ...this.config };
  }

  async updateConfig(newConfig: Partial<CollectorManagerConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Update collector configurations
    if (newConfig.collectors) {
      if (newConfig.collectors.browser && this.collectors.has('browser')) {
        const browserCollector = this.collectors.get('browser') as BrowserCollector;
        browserCollector.updateBrowserConfig(newConfig.collectors.browser);
      }
      
      if (newConfig.collectors.system && this.collectors.has('system')) {
        const systemCollector = this.collectors.get('system') as SystemCollector;
        systemCollector.updateSystemConfig(newConfig.collectors.system);
      }
    }
  }

  async enableCollector(collectorName: string): Promise<void> {
    const collector = this.collectors.get(collectorName);
    if (collector && !collector.isCollectorRunning()) {
      await collector.start();
      if (this.metrics.collectorsStatus[collectorName]) {
        this.metrics.collectorsStatus[collectorName].enabled = true;
        this.metrics.collectorsStatus[collectorName].running = true;
      }
    }
  }

  async disableCollector(collectorName: string): Promise<void> {
    const collector = this.collectors.get(collectorName);
    if (collector && collector.isCollectorRunning()) {
      await collector.stop();
      if (this.metrics.collectorsStatus[collectorName]) {
        this.metrics.collectorsStatus[collectorName].enabled = false;
        this.metrics.collectorsStatus[collectorName].running = false;
      }
    }
  }

  getCollector(collectorName: string): BaseCollector | undefined {
    return this.collectors.get(collectorName);
  }

  // Emergency methods
  async emergencyStop(): Promise<void> {
    console.log('[CollectorManager] Emergency stop initiated');
    
    // Stop all collectors immediately
    const stopPromises = Array.from(this.collectors.values()).map(collector => 
      collector.stop().catch(() => {}) // Ignore errors during emergency stop
    );
    
    await Promise.all(stopPromises);
    
    // Clear all intervals and timers
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    // Clear debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clear event buffer
    this.eventBuffer = [];
    
    this.isRunning = false;
    console.log('[CollectorManager] Emergency stop completed');
  }

  async cleanup(): Promise<void> {
    await this.emergencyStop();
    
    // Cleanup all collectors
    const cleanupPromises = Array.from(this.collectors.values()).map(collector => 
      collector.cleanup().catch(() => {})
    );
    
    await Promise.all(cleanupPromises);
    
    this.collectors.clear();
    this.eventCallbacks.clear();
    this.debounceTimers.clear();
    
    console.log('[CollectorManager] Cleanup completed');
  }
}