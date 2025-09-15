import { BaseEvent, EventType, EventSource, MemoryContext } from '@/types';
import { storageService } from '@/services/storage';
import { memoryManager } from '@/memory/manager';
import { performanceMonitor } from './monitor';

export interface CaptureEngineConfig {
  enableTabCapture: boolean;
  enableContentCapture: boolean;
  enableSystemCapture: boolean;
  debounceTime: number;
  maxEventsPerMinute: number;
  excludedUrls: string[];
}

export class CaptureEngine {
  private config: CaptureEngineConfig;
  private isInitialized = false;
  private eventQueue: BaseEvent[] = [];
  private isProcessing = false;
  private eventCounter = 0;
  private lastEventTime = 0;
  private debounceTimers: Map<string, number> = new Map();
  
  constructor(config: Partial<CaptureEngineConfig> = {}) {
    this.config = {
      enableTabCapture: true,
      enableContentCapture: true,
      enableSystemCapture: false,
      debounceTime: 1000,
      maxEventsPerMinute: 100,
      excludedUrls: [
        'chrome://*',
        'chrome-extension://*',
        'moz-extension://*',
        'edge://*',
        'about:*',
        'data:*',
        'file://*'
      ],
      ...config
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('[CaptureEngine] Initializing...');
      
      // Load configuration from storage
      await this.loadConfiguration();
      
      // Setup performance monitoring
      performanceMonitor.initialize();
      
      this.isInitialized = true;
      console.log('[CaptureEngine] Initialized successfully');
      
    } catch (error) {
      console.error('[CaptureEngine] Failed to initialize:', error);
      throw error;
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['captureConfig']);
      if (result.captureConfig) {
        this.config = { ...this.config, ...result.captureConfig };
      }
    } catch (error) {
      console.warn('[CaptureEngine] Failed to load configuration, using defaults');
    }
  }

  async handleTabNavigation(tabId: number, url: string, title?: string): Promise<void> {
    if (!this.config.enableTabCapture || this.isExcludedUrl(url)) return;
    
    try {
      const event: BaseEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.CONTENT_SCRIPT,
        metadata: {
          action: 'navigation',
          tabId,
          url,
          title,
          referrer: document?.referrer
        },
        context: await this.getCurrentContext()
      };
      
      await this.captureEvent(event);
      
    } catch (error) {
      console.error('[CaptureEngine] Error handling tab navigation:', error);
    }
  }

  async handleTabFocus(tabId: number, url: string, title?: string): Promise<void> {
    if (!this.config.enableTabCapture || this.isExcludedUrl(url)) return;
    
    try {
      const event: BaseEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.CONTENT_SCRIPT,
        metadata: {
          action: 'focus',
          tabId,
          url,
          title
        },
        context: await this.getCurrentContext()
      };
      
      await this.captureEvent(event);
      
    } catch (error) {
      console.error('[CaptureEngine] Error handling tab focus:', error);
    }
  }

  async handleTabClose(tabId: number): Promise<void> {
    try {
      const event: BaseEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.CONTENT_SCRIPT,
        metadata: {
          action: 'close',
          tabId
        },
        context: await this.getCurrentContext()
      };
      
      await this.captureEvent(event);
      
    } catch (error) {
      console.error('[CaptureEngine] Error handling tab close:', error);
    }
  }

  async handleWindowFocus(windowId: number, url: string): Promise<void> {
    if (!this.config.enableTabCapture || this.isExcludedUrl(url)) return;
    
    try {
      const event: BaseEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.BACKGROUND_SERVICE,
        metadata: {
          action: 'window_focus',
          windowId,
          url
        },
        context: await this.getCurrentContext()
      };
      
      await this.captureEvent(event);
      
    } catch (error) {
      console.error('[CaptureEngine] Error handling window focus:', error);
    }
  }

  async captureSelection(text: string, url?: string, title?: string): Promise<void> {
    if (!this.config.enableContentCapture || !text.trim()) return;
    
    try {
      const event: BaseEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.CONTENT_SCRIPT,
        metadata: {
          action: 'selection',
          url,
          title,
          selectionLength: text.length,
          selectionPreview: text.substring(0, 100)
        },
        content: {
          text,
          type: 'selection'
        },
        context: await this.getCurrentContext()
      };
      
      await this.captureEvent(event);
      
    } catch (error) {
      console.error('[CaptureEngine] Error capturing selection:', error);
    }
  }

  async analyzePage(url: string, title?: string): Promise<void> {
    if (!this.config.enableContentCapture || this.isExcludedUrl(url)) return;
    
    try {
      // Get page content from content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        const results = await chrome.tabs.sendMessage(tabs[0].id!, {
          type: 'ANALYZE_PAGE',
          url,
          title
        });
        
        if (results?.content) {
          const event: BaseEvent = {
            id: this.generateEventId(),
            timestamp: Date.now(),
            type: EventType.BROWSER_TAB,
            source: EventSource.CONTENT_SCRIPT,
            metadata: {
              action: 'analyze',
              url,
              title,
              contentLength: results.content.length,
              wordCount: results.wordCount,
              readingTime: results.readingTime
            },
            content: {
              ...results.content,
              type: 'page_analysis'
            },
            context: await this.getCurrentContext()
          };
          
          await this.captureEvent(event);
        }
      }
      
    } catch (error) {
      console.error('[CaptureEngine] Error analyzing page:', error);
    }
  }

  async connectToWorkflow(url: string, title?: string): Promise<void> {
    try {
      const event: BaseEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.CONTENT_SCRIPT,
        metadata: {
          action: 'connect_workflow',
          url,
          title
        },
        context: await this.getCurrentContext()
      };
      
      await this.captureEvent(event);
      
    } catch (error) {
      console.error('[CaptureEngine] Error connecting to workflow:', error);
    }
  }

  async quickCapture(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url || this.isExcludedUrl(tab.url)) return;
    
    try {
      const event: BaseEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.BACKGROUND_SERVICE,
        metadata: {
          action: 'quick_capture',
          url: tab.url,
          title: tab.title,
          windowId: tab.windowId
        },
        context: await this.getCurrentContext()
      };
      
      await this.captureEvent(event);
      
      // Show notification
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon-48.png',
        title: 'Spur Quick Capture',
        message: `Captured: ${tab.title || 'Current tab'}`
      });
      
    } catch (error) {
      console.error('[CaptureEngine] Error in quick capture:', error);
    }
  }

  async captureEvent(event: BaseEvent): Promise<void> {
    if (!this.isInitialized) return;
    
    try {
      // Rate limiting
      if (!this.checkRateLimit()) {
        console.warn('[CaptureEngine] Rate limit exceeded, dropping event');
        return;
      }
      
      // Debounce similar events
      const debounceKey = this.getDebounceKey(event);
      if (this.shouldDebounce(debounceKey)) {
        return;
      }
      
      // Add to queue
      this.eventQueue.push(event);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
      
    } catch (error) {
      console.error('[CaptureEngine] Error capturing event:', error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
        
        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error('[CaptureEngine] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: BaseEvent): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Normalize event
      const normalizedEvent = await this.normalizeEvent(event);
      
      // Store in memory graph
      await memoryManager.storeEvent(normalizedEvent);
      
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      performanceMonitor.recordEventProcessing(processingTime);
      
      // Update rate limit counter
      this.updateRateLimit();
      
    } catch (error) {
      console.error('[CaptureEngine] Error processing event:', error);
    }
  }

  private async normalizeEvent(event: BaseEvent): Promise<BaseEvent> {
    // Add processing metadata
    const normalized = {
      ...event,
      metadata: {
        ...event.metadata,
        processedAt: Date.now(),
        processedBy: 'capture-engine'
      }
    };
    
    // Extract additional context
    if (event.metadata.url) {
      try {
        const url = new URL(event.metadata.url);
        normalized.metadata.domain = url.hostname;
        normalized.metadata.path = url.pathname;
        normalized.metadata.query = url.search;
      } catch (error) {
        // Invalid URL, continue without domain info
      }
    }
    
    return normalized;
  }

  private async getCurrentContext(): Promise<MemoryContext> {
    try {
      const result = await chrome.storage.local.get(['currentContext']);
      return result.currentContext || {
        sessionId: this.generateSessionId(),
        tags: [],
        relatedEvents: []
      };
    } catch (error) {
      return {
        sessionId: this.generateSessionId(),
        tags: [],
        relatedEvents: []
      };
    }
  }

  private isExcludedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return this.config.excludedUrls.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(url);
        }
        return url.startsWith(pattern);
      });
    } catch (error) {
      return true; // Exclude invalid URLs
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    if (now - this.lastEventTime > timeWindow) {
      this.eventCounter = 1;
      this.lastEventTime = now;
      return true;
    }
    
    if (this.eventCounter >= this.config.maxEventsPerMinute) {
      return false;
    }
    
    this.eventCounter++;
    return true;
  }

  private updateRateLimit(): void {
    // Rate limit updated in checkRateLimit
  }

  private shouldDebounce(key: string): boolean {
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.debounceTimers.delete(key);
      return true;
    }
    
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
    }, this.config.debounceTime) as unknown as number;
    
    this.debounceTimers.set(key, timer);
    return false;
  }

  private getDebounceKey(event: BaseEvent): string {
    const parts = [
      event.type,
      event.metadata.action,
      event.metadata.url,
      event.metadata.tabId
    ];
    return parts.filter(Boolean).join(':');
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}`;
  }

  async cleanupContext(): Promise<void> {
    try {
      // Clean up old contexts
      const contexts = await chrome.storage.local.get(['contexts']) as any;
      if (contexts.contexts) {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const activeContexts = contexts.contexts.filter(
          (ctx: any) => ctx.lastAccessed > oneHourAgo
        );
        await chrome.storage.local.set({ contexts: activeContexts });
      }
      
      // Clear debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();
      
    } catch (error) {
      console.error('[CaptureEngine] Error cleaning up context:', error);
    }
  }

  cleanup(): void {
    try {
      // Clear timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();
      
      // Clear queue
      this.eventQueue = [];
      
      // Cleanup performance monitor
      performanceMonitor.cleanup();
      
      this.isInitialized = false;
      
    } catch (error) {
      console.error('[CaptureEngine] Error during cleanup:', error);
    }
  }

  // Configuration methods
  async updateConfig(newConfig: Partial<CaptureEngineConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await chrome.storage.local.set({ captureConfig: this.config });
  }

  getConfig(): CaptureEngineConfig {
    return { ...this.config };
  }

  async getStatus(): Promise<{
    isInitialized: boolean;
    eventQueueLength: number;
    isProcessing: boolean;
    config: CaptureEngineConfig;
  }> {
    return {
      isInitialized: this.isInitialized,
      eventQueueLength: this.eventQueue.length,
      isProcessing: this.isProcessing,
      config: this.getConfig()
    };
  }
}

// Export singleton instance
export const captureEngine = new CaptureEngine();