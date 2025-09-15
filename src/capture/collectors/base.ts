import { 
  BaseEvent, 
  EventType, 
  EventSource, 
  MemoryContext 
} from '@/types';
import { 
  BrowserTabEvent, 
  SystemAppEvent, 
  EmailEvent, 
  CodeEvent, 
  GitHubEvent, 
  YouTubeEvent, 
  SlackEvent, 
  VSCodeEvent, 
  CustomEvent 
} from '@/types/events';

export interface CollectorConfig {
  enabled: boolean;
  captureFrequency: number;
  batchSize: number;
  maxRetries: number;
  timeout: number;
  filters?: EventFilter[];
  priority?: number;
}

export interface EventFilter {
  types?: EventType[];
  sources?: EventSource[];
  domains?: string[];
  keywords?: string[];
  excludeKeywords?: string[];
  minConfidence?: number;
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface CollectorMetrics {
  eventsCollected: number;
  eventsProcessed: number;
  errors: number;
  averageLatency: number;
  lastCollectionTime: number;
  isHealthy: boolean;
}

export abstract class BaseCollector {
  protected config: CollectorConfig;
  protected metrics: CollectorMetrics;
  protected isRunning = false;
  protected collectionInterval?: number;
  protected errorCallback?: (error: Error) => void;

  constructor(config: CollectorConfig) {
    this.config = {
      enabled: true,
      captureFrequency: 1000,
      batchSize: 10,
      maxRetries: 3,
      timeout: 5000,
      ...config
    };
    
    this.metrics = {
      eventsCollected: 0,
      eventsProcessed: 0,
      errors: 0,
      averageLatency: 0,
      lastCollectionTime: 0,
      isHealthy: true
    };
  }

  abstract initialize(): Promise<void>;
  abstract collect(): Promise<BaseEvent[]>;
  abstract cleanup(): Promise<void>;

  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) return;

    try {
      await this.initialize();
      this.isRunning = true;
      
      // Start periodic collection
      this.collectionInterval = window.setInterval(async () => {
        try {
          await this.collectAndProcess();
        } catch (error) {
          this.handleError(error as Error);
        }
      }, this.config.captureFrequency);
      
      console.log(`[${this.constructor.name}] Started collection`);
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      this.isRunning = false;
      
      if (this.collectionInterval) {
        clearInterval(this.collectionInterval);
        this.collectionInterval = undefined;
      }
      
      await this.cleanup();
      console.log(`[${this.constructor.name}] Stopped collection`);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private async collectAndProcess(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const events = await this.collect();
      const filteredEvents = this.filterEvents(events);
      const processedEvents = await this.processEvents(filteredEvents);
      
      // Update metrics
      this.metrics.eventsCollected += events.length;
      this.metrics.eventsProcessed += processedEvents.length;
      this.metrics.lastCollectionTime = Date.now();
      this.metrics.averageLatency = performance.now() - startTime;
      
      // Emit processed events
      if (processedEvents.length > 0) {
        await this.emitEvents(processedEvents);
      }
      
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private filterEvents(events: BaseEvent[]): BaseEvent[] {
    if (!this.config.filters || this.config.filters.length === 0) {
      return events;
    }

    return events.filter(event => {
      return this.config.filters!.every(filter => this.passesFilter(event, filter));
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

    // Domain filter (if applicable)
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

    // Confidence filter
    if (filter.minConfidence && event.priority && event.priority < filter.minConfidence) {
      return false;
    }

    // Time range filter
    if (filter.timeRange) {
      if (event.timestamp < filter.timeRange.start || event.timestamp > filter.timeRange.end) {
        return false;
      }
    }

    return true;
  }

  private async processEvents(events: BaseEvent[]): Promise<BaseEvent[]> {
    // Add processing metadata and quality scoring
    const processedEvents = events.map(event => ({
      ...event,
      priority: event.priority || this.calculatePriority(event),
      context: event.context || await this.generateContext(event)
    }));

    // Batch processing if needed
    if (processedEvents.length > this.config.batchSize) {
      return processedEvents.slice(0, this.config.batchSize);
    }

    return processedEvents;
  }

  private calculatePriority(event: BaseEvent): number {
    // Base priority calculation
    let priority = 5; // Default priority

    // Adjust based on event type
    switch (event.type) {
      case EventType.EMAIL:
        priority = 8;
        break;
      case EventType.CODE:
      case EventType.GITHUB:
        priority = 7;
        break;
      case EventType.SLACK:
        priority = 6;
        break;
      case EventType.SYSTEM_APP:
        priority = 5;
        break;
      case EventType.BROWSER_TAB:
        priority = 4;
        break;
      case EventType.YOUTUBE:
        priority = 3;
        break;
    }

    // Adjust based on content
    if (event.content?.text) {
      const contentLength = event.content.text.length;
      if (contentLength > 1000) priority += 1;
      if (contentLength > 5000) priority += 1;
    }

    // Adjust based on recency
    const age = Date.now() - event.timestamp;
    if (age < 60000) priority += 1; // Less than 1 minute old

    return Math.min(10, Math.max(1, priority));
  }

  private async generateContext(event: BaseEvent): Promise<MemoryContext> {
    return {
      sessionId: this.generateSessionId(),
      tags: this.generateTags(event),
      relatedEvents: [],
      userIntent: this.inferUserIntent(event)
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTags(event: BaseEvent): string[] {
    const tags: string[] = [];
    
    // Add type-based tags
    tags.push(event.type.toLowerCase());
    
    // Add source-based tags
    tags.push(event.source.toLowerCase());
    
    // Add content-based tags
    if (event.metadata.url) {
      try {
        const url = new URL(event.metadata.url);
        tags.push(`domain:${url.hostname}`);
      } catch {
        // Invalid URL, skip domain tagging
      }
    }
    
    // Add action-based tags
    if (event.metadata.action) {
      tags.push(`action:${event.metadata.action}`);
    }
    
    return tags;
  }

  private inferUserIntent(event: BaseEvent): string {
    // Simple intent inference based on event type and metadata
    switch (event.type) {
      case EventType.EMAIL:
        return event.metadata.action === 'compose' ? 'communicate' : 'monitor';
      case EventType.CODE:
        return 'develop';
      case EventType.GITHUB:
        return 'collaborate';
      case EventType.BROWSER_TAB:
        if (event.metadata.action === 'search') return 'research';
        if (event.metadata.action === 'selection') return 'capture';
        return 'browse';
      default:
        return 'general';
    }
  }

  protected async emitEvents(events: BaseEvent[]): Promise<void> {
    // This will be overridden by specific implementations
    // Default implementation just logs the events
    console.log(`[${this.constructor.name}] Emitting ${events.length} events`);
  }

  protected handleError(error: Error): void {
    this.metrics.errors++;
    this.metrics.isHealthy = false;
    
    console.error(`[${this.constructor.name}] Error:`, error);
    
    if (this.errorCallback) {
      this.errorCallback(error);
    }
    
    // Attempt to recover
    this.recover();
  }

  private recover(): void {
    // Reset health status after error
    setTimeout(() => {
      this.metrics.isHealthy = true;
    }, 5000);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  getMetrics(): CollectorMetrics {
    return { ...this.metrics };
  }

  updateConfig(newConfig: Partial<CollectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  isCollectorRunning(): boolean {
    return this.isRunning;
  }
}