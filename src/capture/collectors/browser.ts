import { BaseCollector, CollectorConfig } from './base';
import { BrowserTabEvent, BrowserTabMetadata, BrowserTabContent } from '@/types/events';
import { EventType, EventSource } from '@/types';

export interface BrowserCollectorConfig extends CollectorConfig {
  captureNavigation: boolean;
  captureFocus: boolean;
  captureSelections: boolean;
  captureClicks: boolean;
  captureScrolls: boolean;
  captureFormSubmissions: boolean;
  excludedUrls: string[];
  excludedDomains: string[];
  maxContentLength: number;
  enablePageAnalysis: boolean;
  analyzeInterval: number;
}

export class BrowserCollector extends BaseCollector {
  private config: BrowserCollectorConfig;
  private activeTabs: Map<number, chrome.tabs.Tab> = new Map();
  private lastAnalysisTime = new Map<number, number>();

  constructor(config: Partial<BrowserCollectorConfig> = {}) {
    super({
      enabled: true,
      captureFrequency: 1000,
      batchSize: 10,
      maxRetries: 3,
      timeout: 5000,
      ...config
    });

    this.config = {
      captureNavigation: true,
      captureFocus: true,
      captureSelections: true,
      captureClicks: true,
      captureScrolls: true,
      captureFormSubmissions: true,
      excludedUrls: [
        'chrome://*',
        'chrome-extension://*',
        'moz-extension://*',
        'edge://*',
        'about:*',
        'data:*',
        'file://*'
      ],
      excludedDomains: [
        'google.com',
        'facebook.com',
        'twitter.com',
        'instagram.com'
      ],
      maxContentLength: 10000,
      enablePageAnalysis: true,
      analyzeInterval: 30000,
      ...config
    } as BrowserCollectorConfig;
  }

  async initialize(): Promise<void> {
    try {
      console.log('[BrowserCollector] Initializing...');

      // Set up Chrome event listeners
      this.setupChromeListeners();

      // Get current active tabs
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        if (tab.id && tab.url && !this.isExcludedUrl(tab.url)) {
          this.activeTabs.set(tab.id, tab);
        }
      });

      console.log('[BrowserCollector] Initialized successfully');
    } catch (error) {
      console.error('[BrowserCollector] Failed to initialize:', error);
      throw error;
    }
  }

  private setupChromeListeners(): void {
    // Tab navigation events
    if (this.config.captureNavigation) {
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url) {
          this.handleTabNavigation(tabId, tab.url, tab.title);
        }
      });
    }

    // Tab focus events
    if (this.config.captureFocus) {
      chrome.tabs.onActivated.addListener(async (activeInfo) => {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
          this.handleTabFocus(activeInfo.tabId, tab.url, tab.title);
        }
      });

      chrome.windows.onFocusChanged.addListener(async (windowId) => {
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
          const tabs = await chrome.tabs.query({ active: true, windowId });
          if (tabs[0]?.url) {
            this.handleWindowFocus(windowId, tabs[0].url, tabs[0].title);
          }
        }
      });
    }

    // Tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabClose(tabId);
      this.activeTabs.delete(tabId);
      this.lastAnalysisTime.delete(tabId);
    });

    // Content script messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleContentScriptMessage(message, sender);
    });
  }

  async collect(): Promise<BrowserTabEvent[]> {
    const events: BrowserTabEvent[] = [];
    const now = Date.now();

    // Analyze active tabs periodically
    if (this.config.enablePageAnalysis) {
      for (const [tabId, tab] of this.activeTabs) {
        if (tab.url && !this.isExcludedUrl(tab.url)) {
          const lastAnalysis = this.lastAnalysisTime.get(tabId) || 0;
          if (now - lastAnalysis > this.config.analyzeInterval) {
            const analysisEvent = await this.analyzeTab(tabId, tab);
            if (analysisEvent) {
              events.push(analysisEvent);
              this.lastAnalysisTime.set(tabId, now);
            }
          }
        }
      }
    }

    return events;
  }

  private handleTabNavigation(tabId: number, url: string, title?: string): void {
    if (!this.config.captureNavigation || this.isExcludedUrl(url)) return;

    const event: BrowserTabEvent = {
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
      } as BrowserTabMetadata
    };

    // Update active tabs
    chrome.tabs.get(tabId).then(tab => {
      if (tab.url && !this.isExcludedUrl(tab.url)) {
        this.activeTabs.set(tabId, tab);
      }
    }).catch(() => {
      this.activeTabs.delete(tabId);
    });

    this.emitEvent(event);
  }

  private handleTabFocus(tabId: number, url: string, title?: string): void {
    if (!this.config.captureFocus || this.isExcludedUrl(url)) return;

    const event: BrowserTabEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.BROWSER_TAB,
      source: EventSource.CONTENT_SCRIPT,
      metadata: {
        action: 'focus',
        tabId,
        url,
        title
      } as BrowserTabMetadata
    };

    this.emitEvent(event);
  }

  private handleWindowFocus(windowId: number, url: string, title?: string): void {
    if (!this.config.captureFocus || this.isExcludedUrl(url)) return;

    const event: BrowserTabEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.BROWSER_TAB,
      source: EventSource.BACKGROUND_SERVICE,
      metadata: {
        action: 'window_focus',
        windowId,
        url,
        title
      } as BrowserTabMetadata
    };

    this.emitEvent(event);
  }

  private handleTabClose(tabId: number): void {
    const event: BrowserTabEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.BROWSER_TAB,
      source: EventSource.CONTENT_SCRIPT,
      metadata: {
        action: 'close',
        tabId
      } as BrowserTabMetadata
    };

    this.emitEvent(event);
  }

  private handleContentScriptMessage(message: any, sender: chrome.runtime.MessageSender): void {
    if (!sender.tab || !sender.tab.url || this.isExcludedUrl(sender.tab.url)) return;

    switch (message.type) {
      case 'SELECTION':
        if (this.config.captureSelections && message.text) {
          this.handleSelection(sender.tab.id!, sender.tab.url, sender.tab.title, message.text);
        }
        break;
      case 'CLICK':
        if (this.config.captureClicks) {
          this.handleClick(sender.tab.id!, sender.tab.url, message.element);
        }
        break;
      case 'SCROLL':
        if (this.config.captureScrolls) {
          this.handleScroll(sender.tab.id!, sender.tab.url, message.position);
        }
        break;
      case 'FORM_SUBMIT':
        if (this.config.captureFormSubmissions) {
          this.handleFormSubmit(sender.tab.id!, sender.tab.url, message.formData);
        }
        break;
    }
  }

  private handleSelection(tabId: number, url: string, title?: string, text?: string): void {
    if (!text || !text.trim()) return;

    const event: BrowserTabEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.BROWSER_TAB,
      source: EventSource.CONTENT_SCRIPT,
      metadata: {
        action: 'selection',
        tabId,
        url,
        title,
        selectionLength: text.length,
        selectionPreview: text.substring(0, 100)
      } as BrowserTabMetadata,
      content: {
        type: 'selection',
        text: text.substring(0, this.config.maxContentLength)
      } as BrowserTabContent
    };

    this.emitEvent(event);
  }

  private handleClick(tabId: number, url: string, element?: any): void {
    if (!element) return;

    const event: BrowserTabEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.BROWSER_TAB,
      source: EventSource.CONTENT_SCRIPT,
      metadata: {
        action: 'click',
        tabId,
        url,
        elementClicked: `${element.tagName}${element.className ? `.${element.className}` : ''}${element.id ? `#${element.id}` : ''}`
      } as BrowserTabMetadata,
      content: {
        type: 'click_context',
        elementInfo: {
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          text: element.textContent?.substring(0, 100)
        }
      } as BrowserTabContent
    };

    this.emitEvent(event);
  }

  private handleScroll(tabId: number, url: string, position: { scrollY: number; scrollPercentage: number }): void {
    const event: BrowserTabEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.BROWSER_TAB,
      source: EventSource.CONTENT_SCRIPT,
      metadata: {
        action: 'scroll',
        tabId,
        url,
        scrollPosition: position.scrollY,
        scrollPercentage: position.scrollPercentage
      } as BrowserTabMetadata
    };

    this.emitEvent(event);
  }

  private handleFormSubmit(tabId: number, url: string, formData: Record<string, any>): void {
    const event: BrowserTabEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.BROWSER_TAB,
      source: EventSource.CONTENT_SCRIPT,
      metadata: {
        action: 'form_submit',
        tabId,
        url,
        formFields: Object.keys(formData)
      } as BrowserTabMetadata,
      content: {
        type: 'form_data',
        formValues: this.sanitizeFormData(formData)
      } as BrowserTabContent
    };

    this.emitEvent(event);
  }

  private async analyzeTab(tabId: number, tab: chrome.tabs.Tab): Promise<BrowserTabEvent | null> {
    try {
      if (!tab.url || this.isExcludedUrl(tab.url)) return null;

      // Send analysis request to content script
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'ANALYZE_PAGE',
        url: tab.url,
        title: tab.title
      });

      if (!result) return null;

      const event: BrowserTabEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.CONTENT_SCRIPT,
        metadata: {
          action: 'analyze',
          tabId,
          url: tab.url,
          title: tab.title,
          contentLength: result.contentLength || 0,
          wordCount: result.wordCount || 0,
          readingTime: result.readingTime || 0
        } as BrowserTabMetadata,
        content: {
          type: 'page_analysis',
          structuredData: result.structuredData,
          summary: result.summary?.substring(0, this.config.maxContentLength)
        } as BrowserTabContent
      };

      return event;
    } catch (error) {
      console.warn(`[BrowserCollector] Failed to analyze tab ${tabId}:`, error);
      return null;
    }
  }

  private isExcludedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Check excluded URLs
      for (const pattern of this.config.excludedUrls) {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          if (regex.test(url)) return true;
        } else if (url.startsWith(pattern)) {
          return true;
        }
      }

      // Check excluded domains
      return this.config.excludedDomains.some(domain => 
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return true; // Exclude invalid URLs
    }
  }

  private sanitizeFormData(formData: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    Object.keys(formData).forEach(key => {
      const value = formData[key];
      
      // Sanitize sensitive fields
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('credit') || 
          key.toLowerCase().includes('ssn')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...';
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }

  private generateEventId(): string {
    return `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitEvent(event: BrowserTabEvent): void {
    // Add to metrics
    this.metrics.eventsCollected++;
    
    // This will be handled by the base class's emitEvents method
    // For now, we'll log the event
    console.log(`[BrowserCollector] Event: ${event.metadata.action} on ${event.metadata.url?.substring(0, 50)}...`);
  }

  async cleanup(): Promise<void> {
    try {
      // Remove Chrome event listeners
      chrome.tabs.onUpdated.removeListener(() => {});
      chrome.tabs.onActivated.removeListener(() => {});
      chrome.windows.onFocusChanged.removeListener(() => {});
      chrome.tabs.onRemoved.removeListener(() => {});
      chrome.runtime.onMessage.removeListener(() => {});

      // Clear active tabs
      this.activeTabs.clear();
      this.lastAnalysisTime.clear();

      console.log('[BrowserCollector] Cleaned up successfully');
    } catch (error) {
      console.error('[BrowserCollector] Error during cleanup:', error);
    }
  }

  // Additional browser-specific methods
  async quickCapture(tabId?: number): Promise<void> {
    try {
      const tab = tabId 
        ? await chrome.tabs.get(tabId)
        : await chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0]);

      if (!tab || !tab.url || this.isExcludedUrl(tab.url)) return;

      const event: BrowserTabEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: EventType.BROWSER_TAB,
        source: EventSource.BACKGROUND_SERVICE,
        metadata: {
          action: 'quick_capture',
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
          windowId: tab.windowId
        } as BrowserTabMetadata
      };

      this.emitEvent(event);

      // Show notification
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon-48.png',
        title: 'Spur Quick Capture',
        message: `Captured: ${tab.title || 'Current tab'}`
      });

    } catch (error) {
      console.error('[BrowserCollector] Error in quick capture:', error);
    }
  }

  async connectToWorkflow(url: string, title?: string): Promise<void> {
    const event: BrowserTabEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.BROWSER_TAB,
      source: EventSource.CONTENT_SCRIPT,
      metadata: {
        action: 'connect_workflow',
        url,
        title
      } as BrowserTabMetadata
    };

    this.emitEvent(event);
  }

  // Configuration methods
  updateBrowserConfig(newConfig: Partial<BrowserCollectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    super.updateConfig(newConfig);
  }

  getBrowserConfig(): BrowserCollectorConfig {
    return { ...this.config };
  }

  getActiveTabsCount(): number {
    return this.activeTabs.size;
  }
}