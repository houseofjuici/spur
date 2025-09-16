import { Browser } from 'webextension-polyfill';
import { captureEngine } from '@/capture/engine';
import { memoryManager } from '@/memory/manager';
import { assistantService } from '@/assistant/core/service';
import { storageService } from '@/services/storage';
import { notificationManager } from '@/services/notifications';

console.log('[Spur] Background service starting...');

// Global state
let isInitialized = false;
let isActive = true;

// Initialize background service
async function initialize(): Promise<void> {
  try {
    console.log('[Spur] Initializing background service...');
    
    // Initialize storage
    await storageService.initialize();
    
    // Initialize memory manager
    await memoryManager.initialize();
    
    // Initialize capture engine
    await captureEngine.initialize();
    
    // Initialize assistant service
    await assistantService.initialize();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup alarms for periodic tasks
    setupAlarms();
    
    // Setup context menus
    setupContextMenus();
    
    isInitialized = true;
    console.log('[Spur] Background service initialized successfully');
    
  } catch (error) {
    console.error('[Spur] Failed to initialize background service:', error);
  }
}

// Event listeners setup
function setupEventListeners(): void {
  // Tab events
  browser.tabs.onUpdated.addListener(handleTabUpdated);
  browser.tabs.onActivated.addListener(handleTabActivated);
  browser.tabs.onRemoved.addListener(handleTabRemoved);
  
  // Window events
  browser.windows.onFocusChanged.addListener(handleWindowFocusChanged);
  
  // Storage events
  browser.storage.onChanged.addListener(handleStorageChanged);
  
  // Extension lifecycle events
  browser.runtime.onInstalled.addListener(handleInstalled);
  browser.runtime.onStartup.addListener(handleStartup);
  
  // Message handling
  browser.runtime.onMessage.addListener(handleMessage);
  
  // Command handling (keyboard shortcuts)
  browser.commands.onCommand.addListener(handleCommand);
}

// Alarm setup for periodic tasks
function setupAlarms(): void {
  // Memory maintenance (every hour)
  browser.alarms.create('memory-maintenance', { 
    delayInMinutes: 60, 
    periodInMinutes: 60 
  });
  
  // Context cleanup (every 6 hours)
  browser.alarms.create('context-cleanup', { 
    delayInMinutes: 360, 
    periodInMinutes: 360 
  });
  
  // Backup reminder (daily)
  browser.alarms.create('backup-reminder', { 
    delayInMinutes: 1440, 
    periodInMinutes: 1440 
  });
  
  // Alarm listener
  browser.alarms.onAlarm.addListener(handleAlarm);
}

// Context menu setup
function setupContextMenus(): void {
  browser.contextMenus.create({
    id: 'spur-capture-selection',
    title: 'Capture with Spur',
    contexts: ['selection']
  });
  
  browser.contextMenus.create({
    id: 'spur-analyze-page',
    title: 'Analyze page with Spur',
    contexts: ['page']
  });
  
  browser.contextMenus.create({
    id: 'spur-connect-workflow',
    title: 'Connect to current workflow',
    contexts: ['page']
  });
  
  browser.contextMenus.onClicked.addListener(handleContextMenuClick);
}

// Event handlers
async function handleTabUpdated(
  tabId: number,
  changeInfo: Browser.Tabs.OnUpdatedChangeInfoType,
  tab: Browser.Tabs.Tab
): Promise<void> {
  if (!isActive || !isInitialized) return;
  
  try {
    if (changeInfo.status === 'complete' && tab.url) {
      await captureEngine.handleTabNavigation(tabId, tab.url, tab.title);
    }
  } catch (error) {
    console.error('[Spur] Error handling tab update:', error);
  }
}

async function handleTabActivated(activeInfo: Browser.Tabs.OnActivatedActiveInfoType): Promise<void> {
  if (!isActive || !isInitialized) return;
  
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await captureEngine.handleTabFocus(activeInfo.tabId, tab.url, tab.title);
    }
  } catch (error) {
    console.error('[Spur] Error handling tab activation:', error);
  }
}

function handleTabRemoved(tabId: number): void {
  if (!isActive || !isInitialized) return;
  
  try {
    captureEngine.handleTabClose(tabId);
  } catch (error) {
    console.error('[Spur] Error handling tab removal:', error);
  }
}

async function handleWindowFocusChanged(windowId: number): Promise<void> {
  if (!isActive || !isInitialized || windowId === browser.windows.WINDOW_ID_NONE) return;
  
  try {
    const window = await browser.windows.get(windowId);
    const tabs = await browser.tabs.query({ windowId });
    
    if (tabs.length > 0) {
      const activeTab = tabs.find(tab => tab.active);
      if (activeTab && activeTab.url) {
        await captureEngine.handleWindowFocus(windowId, activeTab.url);
      }
    }
  } catch (error) {
    console.error('[Spur] Error handling window focus change:', error);
  }
}

function handleStorageChanged(
  changes: Record<string, Browser.Storage.StorageChange>,
  areaName: string
): void {
  if (!isInitialized) return;
  
  try {
    // Handle settings changes
    if (changes.settings) {
      const newSettings = changes.settings.newValue;
      applySettings(newSettings);
    }
    
    // Handle activity state changes
    if (changes.activityState) {
      isActive = changes.activityState.newValue?.isActive ?? true;
    }
  } catch (error) {
    console.error('[Spur] Error handling storage change:', error);
  }
}

async function handleInstalled(details: Browser.Runtime.InstalledDetails): Promise<void> {
  console.log('[Spur] Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // First-time installation
    await handleFirstInstall();
  } else if (details.reason === 'update') {
    // Extension update
    await handleUpdate(details.previousVersion);
  }
}

function handleStartup(): void {
  console.log('[Spur] Extension startup');
  if (!isInitialized) {
    initialize();
  }
}

// Message handler
async function handleMessage(
  message: any,
  sender: Browser.Runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<boolean> {
  try {
    console.log('[Spur] Received message:', message.type, 'from', sender.tab?.url);
    
    switch (message.type) {
      case 'GET_STATUS':
        sendResponse({ 
          status: 'ok', 
          initialized: isInitialized, 
          active: isActive 
        });
        break;
        
      case 'CAPTURE_EVENT':
        await captureEngine.captureEvent(message.event);
        sendResponse({ success: true });
        break;
        
      case 'QUERY_MEMORY':
        const memoryResults = await memoryManager.query(message.query);
        sendResponse({ success: true, results: memoryResults });
        break;
        
      case 'ASSISTANT_MESSAGE':
        const assistantResponse = await assistantService.processMessage(
          message.message,
          message.context
        );
        sendResponse({ success: true, response: assistantResponse });
        break;
        
      case 'GET_CONTEXT':
        const context = await captureEngine.getCurrentContext();
        sendResponse({ success: true, context });
        break;
        
      case 'TOGGLE_ACTIVITY':
        isActive = !isActive;
        await browser.storage.local.set({ activityState: { isActive } });
        sendResponse({ success: true, active: isActive });
        break;
        
      case 'OPEN_DASHBOARD':
        await browser.tabs.create({ url: browser.runtime.getURL('dashboard/index.html') });
        sendResponse({ success: true });
        break;
        
      default:
        console.warn('[Spur] Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[Spur] Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep message channel open for async responses
}

// Command handler
async function handleCommand(command: string): Promise<void> {
  console.log('[Spur] Command executed:', command);
  
  switch (command) {
    case 'open-dashboard':
      await browser.tabs.create({ url: browser.runtime.getURL('dashboard/index.html') });
      break;
      
    case 'quick-capture':
      await handleQuickCapture();
      break;
      
    default:
      console.warn('[Spur] Unknown command:', command);
  }
}

// Context menu handler
async function handleContextMenuClick(
  info: Browser.ContextMenus.OnClickData,
  tab: Browser.Tabs.Tab
): Promise<void> {
  console.log('[Spur] Context menu clicked:', info.menuItemId);
  
  switch (info.menuItemId) {
    case 'spur-capture-selection':
      if (info.selectionText) {
        await captureEngine.captureSelection(info.selectionText, tab.url, tab.title);
      }
      break;
      
    case 'spur-analyze-page':
      if (tab.url) {
        await captureEngine.analyzePage(tab.url, tab.title);
      }
      break;
      
    case 'spur-connect-workflow':
      if (tab.url) {
        await captureEngine.connectToWorkflow(tab.url, tab.title);
      }
      break;
  }
}

// Alarm handler
async function handleAlarm(alarm: Browser.Alarms.Alarm): Promise<void> {
  console.log('[Spur] Alarm triggered:', alarm.name);
  
  switch (alarm.name) {
    case 'memory-maintenance':
      await memoryManager.performMaintenance();
      break;
      
    case 'context-cleanup':
      await captureEngine.cleanupContext();
      break;
      
    case 'backup-reminder':
      await notificationManager.showBackupReminder();
      break;
  }
}

// Utility functions
async function applySettings(settings: any): Promise<void> {
  try {
    console.log('[Spur] Applying new settings');
    
    // Update notification settings
    if (settings.notifications) {
      notificationManager.updateSettings(settings.notifications);
    }
    
    // Update privacy settings
    if (settings.privacy) {
      await storageService.updatePrivacySettings(settings.privacy);
    }
    
    // Update assistant settings
    if (settings.assistant) {
      await assistantService.updateSettings(settings.assistant);
    }
    
  } catch (error) {
    console.error('[Spur] Error applying settings:', error);
  }
}

async function handleFirstInstall(): Promise<void> {
  console.log('[Spur] First-time installation');
  
  try {
    // Create default settings
    const defaultSettings = {
      version: '0.1.0',
      installedAt: Date.now(),
      privacy: {
        localOnly: true,
        dataRetention: '90d',
        anonymizeData: true,
        encryptedBackup: false,
        permissionLevel: 'standard'
      },
      notifications: {
        enabled: true,
        frequency: 'immediate',
        types: ['insight', 'connection', 'reminder'],
        quietHours: { enabled: false },
        soundEnabled: false
      },
      interface: {
        theme: 'auto',
        density: 'normal',
        animations: true,
        language: 'en',
        fontSize: 16
      }
    };
    
    await browser.storage.local.set({ settings: defaultSettings });
    
    // Open onboarding
    await browser.tabs.create({ 
      url: browser.runtime.getURL('options/onboarding.html') 
    });
    
  } catch (error) {
    console.error('[Spur] Error handling first install:', error);
  }
}

async function handleUpdate(previousVersion?: string): Promise<void> {
  console.log('[Spur] Extension updated from:', previousVersion);
  
  try {
    // Show update notification
    await notificationManager.showUpdateNotification(previousVersion);
    
    // Run migrations if needed
    if (previousVersion) {
      await runMigrations(previousVersion);
    }
    
  } catch (error) {
    console.error('[Spur] Error handling update:', error);
  }
}

async function runMigrations(fromVersion: string): Promise<void> {
  console.log('[Spur] Running migrations from version:', fromVersion);
  
  // Add migration logic here based on version
  // For example, database schema changes, settings updates, etc.
}

async function handleQuickCapture(): Promise<void> {
  try {
    const currentTab = await browser.tabs.query({ active: true, currentWindow: true });
    if (currentTab[0]) {
      await captureEngine.quickCapture(currentTab[0]);
    }
  } catch (error) {
    console.error('[Spur] Error handling quick capture:', error);
  }
}

// Export for testing
export { isInitialized, isActive };

// Initialize on service worker start
initialize().catch(error => {
  console.error('[Spur] Failed to initialize background service:', error);
});

// Cleanup on unload
self.addEventListener('beforeunload', () => {
  console.log('[Spur] Background service shutting down...');
  
  // Cleanup resources
  captureEngine.cleanup();
  memoryManager.cleanup();
  assistantService.cleanup();
  
  isInitialized = false;
});

console.log('[Spur] Background service script loaded');