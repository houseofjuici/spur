import { BaseCollector, CollectorConfig } from './base';
import { SystemAppEvent, SystemAppMetadata, SystemAppContent } from '@/types/events';
import { EventType, EventSource } from '@/types';

export interface SystemCollectorConfig extends CollectorConfig {
  captureWindowEvents: boolean;
  captureProcessEvents: boolean;
  captureFileEvents: boolean;
  captureKeyboardEvents: boolean;
  captureMouseEvents: boolean;
  excludedApps: string[];
  maxContentLength: number;
  enableNativeMessaging: boolean;
  nativeHost: string;
  sampleRate: number;
}

interface SystemActivity {
  appName: string;
  windowTitle?: string;
  processId?: number;
  windowId?: number;
  action: 'focus' | 'blur' | 'open' | 'close' | 'minimize' | 'maximize';
  timestamp: number;
  duration?: number;
  documentPath?: string;
  interactionType?: 'keyboard' | 'mouse' | 'system';
}

export class SystemCollector extends BaseCollector {
  private config: SystemCollectorConfig;
  private activeWindows: Map<number, SystemActivity> = new Map();
  private lastWindowFocus = 0;
  private nativePort?: chrome.runtime.Port;
  private sampleCounter = 0;

  constructor(config: Partial<SystemCollectorConfig> = {}) {
    super({
      enabled: false, // Disabled by default due to platform restrictions
      captureFrequency: 2000,
      batchSize: 5,
      maxRetries: 3,
      timeout: 5000,
      ...config
    });

    this.config = {
      captureWindowEvents: true,
      captureProcessEvents: false,
      captureFileEvents: true,
      captureKeyboardEvents: false,
      captureMouseEvents: false,
      excludedApps: [
        'chrome.exe',
        'firefox.exe',
        'safari.exe',
        'edge.exe',
        'explorer.exe',
        'finder.app',
        'dock.app'
      ],
      maxContentLength: 5000,
      enableNativeMessaging: true,
      nativeHost: 'com.spur.native',
      sampleRate: 0.1, // 10% sampling rate for performance
      ...config
    } as SystemCollectorConfig;
  }

  async initialize(): Promise<void> {
    try {
      console.log('[SystemCollector] Initializing...');

      // Set up system monitoring based on platform capabilities
      await this.setupSystemMonitoring();

      // Initialize native messaging if enabled
      if (this.config.enableNativeMessaging && this.config.enabled) {
        await this.initializeNativeMessaging();
      }

      console.log('[SystemCollector] Initialized successfully');
    } catch (error) {
      console.error('[SystemCollector] Failed to initialize:', error);
      // Don't throw error - system collector can fail gracefully
      this.config.enabled = false;
    }
  }

  private async setupSystemMonitoring(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.windows) {
      return;
    }

    // Window focus/blur events
    if (this.config.captureWindowEvents) {
      chrome.windows.onFocusChanged.addListener(async (windowId) => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) return;
        
        try {
          const window = await chrome.windows.get(windowId);
          const tabs = await chrome.tabs.query({ windowId, active: true });
          
          if (tabs[0]) {
            this.handleWindowFocus(windowId, tabs[0].url, tabs[0].title);
          }
        } catch (error) {
          console.warn('[SystemCollector] Error handling window focus:', error);
        }
      });
    }

    // Monitor window state changes
    chrome.windows.onBoundsChanged.addListener(async (windowId) => {
      try {
        const window = await chrome.windows.get(windowId);
        this.handleWindowStateChange(windowId, window.state);
      } catch (error) {
        // Window might have been closed
      }
    });
  }

  private async initializeNativeMessaging(): Promise<void> {
    try {
      if (!chrome.runtime.connectNative) {
        console.warn('[SystemCollector] Native messaging not available');
        return;
      }

      this.nativePort = chrome.runtime.connectNative(this.config.nativeHost);
      
      this.nativePort.onMessage.addListener((message) => {
        this.handleNativeMessage(message);
      });

      this.nativePort.onDisconnect.addListener(() => {
        console.log('[SystemCollector] Native host disconnected');
        this.nativePort = undefined;
        
        // Attempt to reconnect after delay
        setTimeout(() => {
          if (this.config.enabled) {
            this.initializeNativeMessaging();
          }
        }, 5000);
      });

      console.log('[SystemCollector] Native messaging initialized');
    } catch (error) {
      console.warn('[SystemCollector] Failed to initialize native messaging:', error);
    }
  }

  private handleNativeMessage(message: any): void {
    try {
      switch (message.type) {
        case 'window_activity':
          this.handleWindowActivity(message.data);
          break;
        case 'process_activity':
          this.handleProcessActivity(message.data);
          break;
        case 'file_activity':
          this.handleFileActivity(message.data);
          break;
        case 'keyboard_activity':
          this.handleKeyboardActivity(message.data);
          break;
        case 'mouse_activity':
          this.handleMouseActivity(message.data);
          break;
        default:
          console.warn('[SystemCollector] Unknown native message type:', message.type);
      }
    } catch (error) {
      console.error('[SystemCollector] Error handling native message:', error);
    }
  }

  private handleWindowActivity(activity: SystemActivity): void {
    if (this.shouldExcludeApp(activity.appName)) return;

    const event: SystemAppEvent = {
      id: this.generateEventId(),
      timestamp: activity.timestamp,
      type: EventType.SYSTEM_APP,
      source: EventSource.NATIVE_MESSAGING,
      metadata: {
        action: activity.action,
        appName: activity.appName,
        windowTitle: activity.windowTitle,
        processId: activity.processId,
        windowId: activity.windowId,
        duration: activity.duration,
        interactionType: activity.interactionType
      } as SystemAppMetadata
    };

    this.emitEvent(event);
  }

  private handleProcessActivity(activity: any): void {
    if (!this.config.captureProcessEvents) return;
    if (this.shouldExcludeApp(activity.appName)) return;

    const event: SystemAppEvent = {
      id: this.generateEventId(),
      timestamp: activity.timestamp,
      type: EventType.SYSTEM_APP,
      source: EventSource.NATIVE_MESSAGING,
      metadata: {
        action: 'switch',
        appName: activity.appName,
        processId: activity.processId,
        duration: activity.duration
      } as SystemAppMetadata
    };

    this.emitEvent(event);
  }

  private handleFileActivity(activity: any): void {
    if (!this.config.captureFileEvents) return;
    if (this.shouldExcludeApp(activity.appName)) return;

    const event: SystemAppEvent = {
      id: this.generateEventId(),
      timestamp: activity.timestamp,
      type: EventType.SYSTEM_APP,
      source: EventSource.NATIVE_MESSAGING,
      metadata: {
        action: 'interaction',
        appName: activity.appName,
        processId: activity.processId,
        documentPath: activity.filePath,
        documentName: activity.fileName,
        interactionType: 'system'
      } as SystemAppMetadata,
      content: {
        type: 'document_content',
        filePath: activity.filePath,
        fileSize: activity.fileSize,
        fileType: activity.fileType
      } as SystemAppContent
    };

    this.emitEvent(event);
  }

  private handleKeyboardActivity(activity: any): void {
    if (!this.config.captureKeyboardEvents) return;
    if (this.shouldExcludeApp(activity.appName)) return;

    // Apply sampling
    this.sampleCounter++;
    if (Math.random() > this.config.sampleRate) return;

    const event: SystemAppEvent = {
      id: this.generateEventId(),
      timestamp: activity.timestamp,
      type: EventType.SYSTEM_APP,
      source: EventSource.NATIVE_MESSAGING,
      metadata: {
        action: 'interaction',
        appName: activity.appName,
        processId: activity.processId,
        windowId: activity.windowId,
        interactionType: 'keyboard'
      } as SystemAppMetadata,
      content: {
        type: 'interaction_log',
        interactionData: [{
          type: 'keyboard',
          target: activity.target,
          timestamp: activity.timestamp
        }]
      } as SystemAppContent
    };

    this.emitEvent(event);
  }

  private handleMouseActivity(activity: any): void {
    if (!this.config.captureMouseEvents) return;
    if (this.shouldExcludeApp(activity.appName)) return;

    // Apply sampling
    this.sampleCounter++;
    if (Math.random() > this.config.sampleRate) return;

    const event: SystemAppEvent = {
      id: this.generateEventId(),
      timestamp: activity.timestamp,
      type: EventType.SYSTEM_APP,
      source: EventSource.NATIVE_MESSAGING,
      metadata: {
        action: 'interaction',
        appName: activity.appName,
        processId: activity.processId,
        windowId: activity.windowId,
        interactionType: 'mouse'
      } as SystemAppMetadata,
      content: {
        type: 'interaction_log',
        interactionData: [{
          type: 'mouse',
          target: activity.target,
          value: activity.action,
          timestamp: activity.timestamp
        }]
      } as SystemAppContent
    };

    this.emitEvent(event);
  }

  private handleWindowFocus(windowId: number, url?: string, title?: string): void {
    const now = Date.now();
    
    // Debounce rapid focus changes
    if (now - this.lastWindowFocus < 1000) return;
    this.lastWindowFocus = now;

    // Determine app name from URL or title
    let appName = 'unknown';
    if (url) {
      try {
        const urlObj = new URL(url);
        appName = urlObj.hostname;
      } catch {
        appName = 'browser';
      }
    } else if (title) {
      appName = title.split(' - ')[0] || 'application';
    }

    if (this.shouldExcludeApp(appName)) return;

    // Record window focus duration
    const previousActivity = this.activeWindows.get(windowId);
    if (previousActivity) {
      previousActivity.duration = now - previousActivity.timestamp;
      previousActivity.action = 'blur';
      
      // Emit blur event for previous window
      this.handleWindowActivity(previousActivity);
    }

    // Create new activity record
    const newActivity: SystemActivity = {
      appName,
      windowTitle: title,
      windowId,
      action: 'focus',
      timestamp: now
    };

    this.activeWindows.set(windowId, newActivity);
  }

  private handleWindowStateChange(windowId: number, state: string): void {
    const activity = this.activeWindows.get(windowId);
    if (!activity) return;

    let action: 'minimize' | 'maximize' | 'normal' = 'normal';
    switch (state) {
      case 'minimized':
        action = 'minimize';
        break;
      case 'maximized':
        action = 'maximize';
        break;
      case 'fullscreen':
        action = 'maximize';
        break;
    }

    const event: SystemAppEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: EventType.SYSTEM_APP,
      source: EventSource.BACKGROUND_SERVICE,
      metadata: {
        action,
        appName: activity.appName,
        windowTitle: activity.windowTitle,
        windowId: activity.windowId
      } as SystemAppMetadata
    };

    this.emitEvent(event);
  }

  async collect(): Promise<SystemAppEvent[]> {
    const events: SystemAppEvent[] = [];
    const now = Date.now();

    // Check for timed-out activities
    for (const [windowId, activity] of this.activeWindows) {
      if (now - activity.timestamp > 300000) { // 5 minutes timeout
        activity.duration = now - activity.timestamp;
        activity.action = 'blur';
        
        const event: SystemAppEvent = {
          id: this.generateEventId(),
          timestamp: now,
          type: EventType.SYSTEM_APP,
          source: EventSource.BACKGROUND_SERVICE,
          metadata: {
            action: activity.action,
            appName: activity.appName,
            windowTitle: activity.windowTitle,
            processId: activity.processId,
            windowId: activity.windowId,
            duration: activity.duration
          } as SystemAppMetadata
        };

        events.push(event);
        this.activeWindows.delete(windowId);
      }
    }

    return events;
  }

  private shouldExcludeApp(appName: string): boolean {
    if (!appName) return true;
    
    const normalizedName = appName.toLowerCase();
    return this.config.excludedApps.some(excluded => 
      normalizedName.includes(excluded.toLowerCase())
    );
  }

  private generateEventId(): string {
    return `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitEvent(event: SystemAppEvent): void {
    // Add to metrics
    this.metrics.eventsCollected++;
    
    // This will be handled by the base class's emitEvents method
    console.log(`[SystemCollector] Event: ${event.metadata.action} - ${event.metadata.appName}`);
  }

  async cleanup(): Promise<void> {
    try {
      // Disconnect native messaging
      if (this.nativePort) {
        this.nativePort.disconnect();
        this.nativePort = undefined;
      }

      // Clear active windows
      this.activeWindows.clear();

      console.log('[SystemCollector] Cleaned up successfully');
    } catch (error) {
      console.error('[SystemCollector] Error during cleanup:', error);
    }
  }

  // Native messaging methods
  sendNativeMessage(message: any): void {
    if (this.nativePort && this.config.enabled) {
      try {
        this.nativePort.postMessage(message);
      } catch (error) {
        console.error('[SystemCollector] Error sending native message:', error);
      }
    }
  }

  isNativeConnected(): boolean {
    return this.nativePort !== undefined;
  }

  // Configuration methods
  updateSystemConfig(newConfig: Partial<SystemCollectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    super.updateConfig(newConfig);
    
    // Reinitialize native messaging if configuration changed
    if (newConfig.enableNativeMessaging !== undefined || newConfig.nativeHost !== undefined) {
      if (this.nativePort) {
        this.nativePort.disconnect();
        this.nativePort = undefined;
      }
      
      if (this.config.enabled && this.config.enableNativeMessaging) {
        this.initializeNativeMessaging();
      }
    }
  }

  getSystemConfig(): SystemCollectorConfig {
    return { ...this.config };
  }

  getActiveApps(): string[] {
    return Array.from(this.activeWindows.values()).map(activity => activity.appName);
  }

  // Platform detection
  getPlatform(): string {
    if (typeof navigator !== 'undefined') {
      if (navigator.platform.includes('Win')) return 'windows';
      if (navigator.platform.includes('Mac')) return 'macos';
      if (navigator.platform.includes('Linux')) return 'linux';
    }
    return 'unknown';
  }

  // Fallback methods for when native messaging is not available
  async detectActiveApplication(): Promise<string | null> {
    try {
      // This is a fallback method that may not work in all browsers
      if (typeof document !== 'undefined' && document.title) {
        return document.title.split(' - ').pop() || null;
      }
    } catch (error) {
      console.warn('[SystemCollector] Error detecting active application:', error);
    }
    return null;
  }
}