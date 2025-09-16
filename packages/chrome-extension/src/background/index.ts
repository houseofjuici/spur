import { MemoryNode, SpurConfig } from '../types/spur';
import { gmailIntegration } from './gmail-integration';
import { voiceProcessor } from '../voice/processor';
import { memoryGraph } from '../memory/graph';
import { storageManager } from '../utils/storage';
import { gitHubIntegration } from '../integrations/github';

// Global types for Chrome extension
declare global {
  interface Window {
    chrome: typeof chrome;
  }
}

interface SyncMessage {
  type: 'SYNC_REQUEST' | 'SYNC_RESPONSE' | 'MEMORY_UPDATE' | 'ERROR' | 'GMAIL_ACTION' | 'VOICE_PROCESSED' | 'GITHUB_ACTION';
  payload?: any;
  timestamp: string;
  source: 'background' | 'popup' | 'content' | 'options';
}

interface VoiceRecording {
  id: string;
  audioBlob: Blob;
  transcript: string;
  confidence: number;
  timestamp: string;
  duration: number;
}

interface BackgroundState {
  isRecording: boolean;
  currentRecording?: VoiceRecording;
  memories: MemoryNode[];
  config: SpurConfig;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime?: string;
  gmailConnected: boolean;
  voiceEnabled: boolean;
  githubConnected: boolean;
  processingQueue: any[];
}

class BackgroundService {
  private state: BackgroundState;
  private audioContext?: AudioContext;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private syncInterval?: number;
  private alarmListeners: Map<string, () => void> = new Map();

  constructor() {
    this.state = {
      isRecording: false,
      memories: [],
      config: {
        darkMode: false,
        historySize: 1000,
        dataRetentionDays: 90,
        autoSync: true,
        syncInterval: 5,
        voiceCommands: true,
        notifications: true,
        gmailIntegration: true,
        githubIntegration: true,
        apiUrl: '',
        apiKey: ''
      },
      syncStatus: 'idle',
      gmailConnected: false,
      voiceEnabled: false,
      githubConnected: false,
      processingQueue: []
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadState();
      this.setupEventListeners();
      this.setupAlarms();
      this.setupContextMenus();
      
      // Initialize integrations
      await this.initializeIntegrations();
      
      if (this.state.config.autoSync) {
        this.startPeriodicSync();
      }

      console.log('Spur background service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize background service:', error);
      this.sendMessageToAllTabs({
        type: 'ERROR',
        payload: { message: 'Failed to initialize background service' },
        timestamp: new Date().toISOString(),
        source: 'background'
      });
    }
  }

  private async initializeIntegrations(): Promise<void> {
    try {
      // Initialize Gmail integration
      if (this.state.config.gmailIntegration) {
        await gmailIntegration.initialize();
        this.state.gmailConnected = await gmailIntegration.isConnected();
      }

      // Initialize voice processor
      if (this.state.config.voiceCommands) {
        await voiceProcessor.initialize();
        this.state.voiceEnabled = await voiceProcessor.isAvailable();
      }

      // Initialize GitHub integration
      if (this.state.config.githubIntegration) {
        await gitHubIntegration.initialize();
        this.state.githubConnected = await gitHubIntegration.isAvailable();
      }

      // Initialize memory graph
      await memoryGraph.initialize();
      
      // Initialize storage manager
      await storageManager.initialize();

      console.log('Integrations initialized successfully');
    } catch (error) {
      console.error('Failed to initialize integrations:', error);
    }
  }

  private async loadState(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['spurState']);
      if (result.spurState) {
        this.state = { ...this.state, ...result.spurState };
      }
    } catch (error) {
      console.error('Failed to load state from storage:', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      await chrome.storage.local.set({ spurState: this.state });
    } catch (error) {
      console.error('Failed to save state to storage:', error);
    }
  }

  private setupEventListeners(): void {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.handleInstall();
      }
    });

    // Handle messages from other parts of the extension
    chrome.runtime.onMessage.addListener((message: SyncMessage, sender, sendResponse) => {
      this.handleMessage(message, sender).then(sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.spurConfig) {
        this.handleConfigChange(changes.spurConfig.newValue);
      }
    });

    // Handle keyboard commands
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'start-recording') {
        this.startRecording();
      } else if (command === 'stop-recording') {
        this.stopRecording();
      }
    });
  }

  private setupAlarms(): void {
    // Clear any existing alarms
    chrome.alarms.clearAll();

    // Set up sync alarm if auto-sync is enabled
    if (this.state.config.autoSync) {
      chrome.alarms.create('sync', {
        delayInMinutes: this.state.config.syncInterval,
        periodInMinutes: this.state.config.syncInterval
      });
    }

    // Listen for alarm events
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'sync') {
        this.performSync();
      }
    });
  }

  private setupContextMenus(): void {
    // Remove existing context menus
    chrome.contextMenus.removeAll();

    // Create context menu for text selection
    chrome.contextMenus.create({
      id: 'spur-save-selection',
      title: 'Save selection to Spur',
      contexts: ['selection']
    });

    // Create context menu for pages
    chrome.contextMenus.create({
      id: 'spur-save-page',
      title: 'Save page to Spur',
      contexts: ['page']
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'spur-save-selection' && info.selectionText) {
        this.saveSelection(info.selectionText, tab.title || '', tab.url || '');
      } else if (info.menuItemId === 'spur-save-page') {
        this.savePage(tab.title || '', tab.url || '');
      }
    });
  }

  private async handleMessage(message: SyncMessage, sender: chrome.runtime.MessageSender): Promise<any> {
    const { type, payload } = message;

    try {
      switch (type) {
        case 'SYNC_REQUEST':
          return await this.performSync();

        case 'START_RECORDING':
          return await this.startRecording();

        case 'STOP_RECORDING':
          return await this.stopRecording();

        case 'GET_STATE':
          return this.state;

        case 'UPDATE_CONFIG':
          await this.updateConfig(payload);
          return { success: true };

        case 'ADD_MEMORY':
          await this.addMemory(payload);
          return { success: true };

        case 'DELETE_MEMORY':
          await this.deleteMemory(payload.id);
          return { success: true };

        case 'CLEAR_MEMORIES':
          await this.clearMemories();
          return { success: true };

        case 'EXPORT_DATA':
          return await this.exportData();

        case 'IMPORT_DATA':
          await this.importData(payload);
          return { success: true };

        case 'GMAIL_ACTION':
          return await this.handleGmailAction(payload, sender);

        case 'GITHUB_ACTION':
          return await this.handleGitHubAction(payload, sender);

        case 'SEARCH_MEMORIES':
          return await this.searchMemories(payload);

        case 'GET_MEMORY_GRAPH':
          return await this.getMemoryGraph();

        case 'PROCESS_VOICE':
          return await this.processVoiceData(payload);

        case 'GET_INTEGRATION_STATUS':
          return await this.getIntegrationStatus();

        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { error: (error as Error).message };
    }
  }

  private async handleInstall(): void {
    // Open onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });

    // Show notification
    if (this.state.config.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon-128.png',
        title: 'Spur Installed',
        message: 'Welcome to Spur! Click to get started.'
      });
    }
  }

  private async handleConfigChange(newConfig: Partial<SpurConfig>): Promise<void> {
    this.state.config = { ...this.state.config, ...newConfig };
    await this.saveState();

    // Update alarms if sync settings changed
    if (newConfig.autoSync !== undefined || newConfig.syncInterval !== undefined) {
      this.setupAlarms();
    }

    // Notify all tabs of config change
    this.sendMessageToAllTabs({
      type: 'MEMORY_UPDATE',
      payload: { type: 'config_change', config: this.state.config },
      timestamp: new Date().toISOString(),
      source: 'background'
    });
  }

  private async startRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.state.isRecording) {
        return { success: false, error: 'Already recording' };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.mediaRecorder.start();
      this.state.isRecording = true;
      await this.saveState();

      // Update recording state in all tabs
      this.sendMessageToAllTabs({
        type: 'MEMORY_UPDATE',
        payload: { type: 'recording_started' },
        timestamp: new Date().toISOString(),
        source: 'background'
      });

      if (this.state.config.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/assets/icon-128.png',
          title: 'Recording Started',
          message: 'Spur is now listening...'
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to start recording:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async stopRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.isRecording || !this.mediaRecorder) {
        return { success: false, error: 'Not recording' };
      }

      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.state.isRecording = false;
      await this.saveState();

      // Update recording state in all tabs
      this.sendMessageToAllTabs({
        type: 'MEMORY_UPDATE',
        payload: { type: 'recording_stopped' },
        timestamp: new Date().toISOString(),
        source: 'background'
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async processRecording(): Promise<void> {
    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const transcription = await this.transcribeAudio(audioBlob);
      
      const recording: VoiceRecording = {
        id: `recording_${Date.now()}`,
        audioBlob,
        transcript: transcription.transcript,
        confidence: transcription.confidence,
        timestamp: new Date().toISOString(),
        duration: transcription.duration
      };

      // Create memory from recording
      const memory: MemoryNode = {
        id: `memory_${Date.now()}`,
        content: transcription.transcript,
        type: 'voice',
        timestamp: recording.timestamp,
        metadata: {
          audioDuration: recording.duration,
          confidence: recording.confidence,
          source: 'voice_recording',
          language: 'en-US'
        },
        connections: [],
        tags: this.extractTags(transcription.transcript)
      };

      await this.addMemory(memory);

      // Show notification
      if (this.state.config.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/assets/icon-128.png',
          title: 'Voice Recording Saved',
          message: transcription.transcript.substring(0, 100) + (transcription.transcript.length > 100 ? '...' : '')
        });
      }

      // Notify all tabs of new memory
      this.sendMessageToAllTabs({
        type: 'MEMORY_UPDATE',
        payload: { type: 'memory_added', memory },
        timestamp: new Date().toISOString(),
        source: 'background'
      });
    } catch (error) {
      console.error('Failed to process recording:', error);
    }
  }

  private async transcribeAudio(audioBlob: Blob): Promise<{ transcript: string; confidence: number; duration: number }> {
    try {
      const result = await voiceProcessor.processAudio(audioBlob, 'en-US');
      return {
        transcript: result.transcript,
        confidence: result.confidence,
        duration: result.duration
      };
    } catch (error) {
      console.error('Audio transcription failed:', error);
      return {
        transcript: 'Transcription failed',
        confidence: 0,
        duration: 0
      };
    }
  }

  private extractTags(text: string): string[] {
    // Simple tag extraction - can be enhanced with NLP
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 5); // Limit to 5 tags
  }

  private async addMemory(memory: MemoryNode): Promise<void> {
    this.state.memories.unshift(memory);
    
    // Maintain history size limit
    if (this.state.memories.length > this.state.config.historySize) {
      this.state.memories = this.state.memories.slice(0, this.state.config.historySize);
    }

    await this.saveState();
  }

  private async deleteMemory(memoryId: string): Promise<void> {
    this.state.memories = this.state.memories.filter(memory => memory.id !== memoryId);
    await this.saveState();
  }

  private async clearMemories(): Promise<void> {
    this.state.memories = [];
    await this.saveState();
  }

  private async saveSelection(text: string, title: string, url: string): Promise<void> {
    const memory: MemoryNode = {
      id: `memory_${Date.now()}`,
      content: text,
      type: 'text',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'selection',
        pageTitle: title,
        pageUrl: url
      },
      connections: [],
      tags: this.extractTags(text)
    };

    await this.addMemory(memory);

    if (this.state.config.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon-128.png',
        title: 'Selection Saved',
        message: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      });
    }
  }

  private async savePage(title: string, url: string): Promise<void> {
    const memory: MemoryNode = {
      id: `memory_${Date.now()}`,
      content: title,
      type: 'bookmark',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'bookmark',
        pageUrl: url
      },
      connections: [],
      tags: this.extractTags(title)
    };

    await this.addMemory(memory);

    if (this.state.config.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon-128.png',
        title: 'Page Saved',
        message: title
      });
    }
  }

  private async performSync(): Promise<SyncMessage> {
    try {
      this.state.syncStatus = 'syncing';
      await this.saveState();

      // Notify all tabs of sync start
      this.sendMessageToAllTabs({
        type: 'MEMORY_UPDATE',
        payload: { type: 'sync_started' },
        timestamp: new Date().toISOString(),
        source: 'background'
      });

      // Process any pending operations in the queue
      await this.processQueue();

      // Sync with memory graph
      await memoryGraph.sync();

      // Sync Gmail if connected
      if (this.state.gmailConnected) {
        const gmailSync = await gmailIntegration.sync();
        console.log('Gmail sync completed:', gmailSync);
      }

      // Sync GitHub if connected
      if (this.state.githubConnected) {
        await gitHubIntegration.syncActivity();
        console.log('GitHub sync completed');
      }

      const syncedMemories = this.state.memories.length;

      this.state.syncStatus = 'idle';
      this.state.lastSyncTime = new Date().toISOString();
      await this.saveState();

      // Notify all tabs of sync completion
      this.sendMessageToAllTabs({
        type: 'MEMORY_UPDATE',
        payload: { 
          type: 'sync_completed',
          syncedCount: syncedMemories,
          lastSync: this.state.lastSyncTime
        },
        timestamp: new Date().toISOString(),
        source: 'background'
      });

      return {
        type: 'SYNC_RESPONSE',
        payload: { success: true, syncedCount: syncedMemories },
        timestamp: new Date().toISOString(),
        source: 'background'
      };
    } catch (error) {
      this.state.syncStatus = 'error';
      await this.saveState();

      const errorMessage = (error as Error).message;
      
      // Notify all tabs of sync error
      this.sendMessageToAllTabs({
        type: 'ERROR',
        payload: { message: 'Sync failed: ' + errorMessage },
        timestamp: new Date().toISOString(),
        source: 'background'
      });

      return {
        type: 'SYNC_RESPONSE',
        payload: { success: false, error: errorMessage },
        timestamp: new Date().toISOString(),
        source: 'background'
      };
    }
  }

  private async processQueue(): Promise<void> {
    while (this.state.processingQueue.length > 0) {
      const item = this.state.processingQueue.shift();
      try {
        await this.processQueueItem(item);
      } catch (error) {
        console.error('Failed to process queue item:', item, error);
      }
    }
  }

  private async processQueueItem(item: any): Promise<void> {
    switch (item.type) {
      case 'memory':
        await this.addMemory(item.data);
        break;
      case 'gmail':
        await this.handleGmailAction(item.data, item.sender);
        break;
      case 'github':
        await this.handleGitHubAction(item.data, item.sender);
        break;
      case 'voice':
        await this.processVoiceData(item.data);
        break;
    }
  }

  private async handleGmailAction(payload: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const { action, data } = payload;

      switch (action) {
        case 'SAVE_EMAIL':
          const emailData = await gmailIntegration.saveEmail(data.emailId);
          if (emailData) {
            await this.addMemory(emailData);
          }
          return { success: true, data: emailData };

        case 'SEARCH_EMAILS':
          const searchResults = await gmailIntegration.searchEmails(data.query);
          return { success: true, data: searchResults };

        case 'GET_THREADS':
          const threads = await gmailIntegration.getThreads(data.folder);
          return { success: true, data: threads };

        default:
          throw new Error(`Unknown Gmail action: ${action}`);
      }
    } catch (error) {
      console.error('Gmail action failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGitHubAction(payload: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const { action, data } = payload;

      switch (action) {
        case 'GET_USER':
          const user = await gitHubIntegration.getUserProfile(data.username);
          return { success: true, data: user };

        case 'GET_REPOS':
          const repos = await gitHubIntegration.getUserRepositories(data.username, data.options);
          return { success: true, data: repos };

        case 'GET_ACTIVITY':
          const activity = await gitHubIntegration.getActivity(data.since);
          return { success: true, data: activity };

        case 'GET_STATS':
          const stats = await gitHubIntegration.getStats();
          return { success: true, data: stats };

        case 'CONFIGURE':
          await gitHubIntegration.configure(data.options);
          this.state.githubConnected = await gitHubIntegration.isAvailable();
          return { success: true };

        case 'SEARCH_REPOS':
          const searchResults = await gitHubIntegration.searchRepositories(data.query, data.options);
          return { success: true, data: searchResults };

        case 'CREATE_ISSUE':
          const issue = await gitHubIntegration.createIssue(data.owner, data.repo, data.title, data.body, data.options);
          return { success: true, data: issue };

        default:
          throw new Error(`Unknown GitHub action: ${action}`);
      }
    } catch (error) {
      console.error('GitHub action failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async searchMemories(payload: { query: string; filters?: any }): Promise<MemoryNode[]> {
    try {
      const { query, filters } = payload;
      const results = await memoryGraph.search(query, filters);
      return results;
    } catch (error) {
      console.error('Memory search failed:', error);
      throw error;
    }
  }

  private async getMemoryGraph(): Promise<any> {
    try {
      const graphData = await memoryGraph.getGraphData();
      return graphData;
    } catch (error) {
      console.error('Failed to get memory graph:', error);
      throw error;
    }
  }

  private async processVoiceData(payload: { audioData: Blob; language?: string }): Promise<any> {
    try {
      const { audioData, language = 'en-US' } = payload;
      
      const result = await voiceProcessor.processAudio(audioData, language);
      
      // Create memory from voice transcription
      if (result.transcript) {
        const memory: MemoryNode = {
          id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: result.transcript,
          type: 'voice',
          timestamp: new Date().toISOString(),
          metadata: {
            source: 'voice',
            language,
            confidence: result.confidence,
            duration: result.duration
          },
          connections: [],
          tags: this.extractTags(result.transcript)
        };

        await this.addMemory(memory);

        return { 
          success: true, 
          data: { 
            transcript: result.transcript, 
            memoryId: memory.id,
            confidence: result.confidence 
          } 
        };
      }

      return { success: false, error: 'No transcript generated' };
    } catch (error) {
      console.error('Voice processing failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async getIntegrationStatus(): Promise<any> {
    return {
      gmail: {
        connected: this.state.gmailConnected,
        available: this.state.config.gmailIntegration
      },
      github: {
        connected: this.state.githubConnected,
        available: this.state.config.githubIntegration
      },
      voice: {
        enabled: this.state.voiceEnabled,
        available: this.state.config.voiceCommands
      },
      memory: {
        initialized: await memoryGraph.isInitialized(),
        memoryCount: this.state.memories.length
      },
      storage: {
        initialized: await storageManager.isInitialized()
      }
    };
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = window.setInterval(() => {
      if (this.state.config.autoSync) {
        this.performSync();
      }
    }, this.state.config.syncInterval * 60 * 1000);
  }

  private async updateConfig(newConfig: Partial<SpurConfig>): Promise<void> {
    this.state.config = { ...this.state.config, ...newConfig };
    await this.saveState();
    this.setupAlarms();
  }

  private async exportData(): Promise<string> {
    const exportData = {
      memories: this.state.memories,
      config: this.state.config,
      exportTime: new Date().toISOString(),
      version: '1.0.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  private async importData(jsonData: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (importData.memories) {
        this.state.memories = [...importData.memories, ...this.state.memories];
      }
      
      if (importData.config) {
        this.state.config = { ...this.state.config, ...importData.config };
      }

      await this.saveState();
      this.setupAlarms();

      // Notify all tabs of data import
      this.sendMessageToAllTabs({
        type: 'MEMORY_UPDATE',
        payload: { type: 'data_imported', importCount: importData.memories?.length || 0 },
        timestamp: new Date().toISOString(),
        source: 'background'
      });
    } catch (error) {
      throw new Error('Invalid import data format');
    }
  }

  private sendMessageToAllTabs(message: SyncMessage): void {
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors when no listeners
    });

    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors for tabs that don't have the content script
          });
        }
      });
    });
  }

  // Public methods for external access
  public getState(): BackgroundState {
    return this.state;
  }

  public getMemories(): MemoryNode[] {
    return this.state.memories;
  }

  public getConfig(): SpurConfig {
    return this.state.config;
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Export for testing
export { backgroundService, BackgroundService, type BackgroundState, type SyncMessage };

// Keep the service alive
console.log('Spur background script loaded');