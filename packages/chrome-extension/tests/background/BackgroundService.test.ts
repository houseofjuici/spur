import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BackgroundService, BackgroundState, type SyncMessage } from '../src/background/index';
import type { MemoryNode, SpurConfig } from '../src/types/spur';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onInstalled: {
      addListener: vi.fn()
    },
    onMessage: {
      addListener: vi.fn()
    },
    sendMessage: vi.fn(),
    id: 'test-extension-id'
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      onChanged: {
        addListener: vi.fn()
      }
    }
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    sendMessage: vi.fn()
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    onClicked: {
      addListener: vi.fn()
    }
  },
  alarms: {
    create: vi.fn(),
    clearAll: vi.fn(),
    onAlarm: {
      addListener: vi.fn()
    }
  },
  commands: {
    onCommand: {
      addListener: vi.fn()
    }
  },
  notifications: {
    create: vi.fn()
  }
};

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: vi.fn()
};

// Mock window APIs
const mockWindow = {
  setInterval: vi.fn(),
  clearInterval: vi.fn(),
  setTimeout: vi.fn(() => {}),
  clearTimeout: vi.fn()
};

Object.defineProperty(global, 'chrome', { value: mockChrome, configurable: true });
Object.defineProperty(global, 'navigator', { value: { mediaDevices: mockMediaDevices }, configurable: true });
Object.defineProperty(global, 'window', { value: mockWindow, configurable: true });

describe('BackgroundService', () => {
  let backgroundService: BackgroundService;
  let mockState: BackgroundState;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockState = {
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
        apiUrl: 'https://api.example.com',
        apiKey: 'test-api-key'
      },
      syncStatus: 'idle'
    };

    // Mock storage get to return empty state
    mockChrome.storage.local.get.mockResolvedValue({});

    backgroundService = new BackgroundService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = backgroundService.getState();
      expect(state.isRecording).toBe(false);
      expect(state.memories).toEqual([]);
      expect(state.syncStatus).toBe('idle');
    });

    it('should set up event listeners during initialization', () => {
      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(mockChrome.storage.onChanged.addListener).toHaveBeenCalled();
      expect(mockChrome.commands.onCommand.addListener).toHaveBeenCalled();
    });

    it('should set up context menus', () => {
      expect(mockChrome.contextMenus.removeAll).toHaveBeenCalled();
      expect(mockChrome.contextMenus.create).toHaveBeenCalledTimes(2);
    });

    it('should set up alarms when auto-sync is enabled', () => {
      expect(mockChrome.alarms.create).toHaveBeenCalledWith('sync', {
        delayInMinutes: 5,
        periodInMinutes: 5
      });
    });
  });

  describe('State Management', () => {
    it('should load state from storage', async () => {
      const savedState = { ...mockState, memories: [{ id: 'test', content: 'Test memory', type: 'note', timestamp: '2024-01-01', metadata: { source: 'test' }, connections: [], tags: [] }] };
      mockChrome.storage.local.get.mockResolvedValue({ spurState: savedState });

      const service = new BackgroundService();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['spurState']);
    });

    it('should save state to storage', async () => {
      await backgroundService['saveState']();
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ spurState: expect.any(Object) });
    });
  });

  describe('Message Handling', () => {
    it('should handle GET_STATE message', async () => {
      const message: SyncMessage = {
        type: 'GET_STATE',
        timestamp: '2024-01-01T00:00:00Z',
        source: 'popup'
      };

      const response = await backgroundService['handleMessage'](message, {} as any);
      expect(response).toEqual(mockState);
    });

    it('should handle UPDATE_CONFIG message', async () => {
      const newConfig: Partial<SpurConfig> = { darkMode: true };
      const message: SyncMessage = {
        type: 'UPDATE_CONFIG',
        payload: newConfig,
        timestamp: '2024-01-01T00:00:00Z',
        source: 'popup'
      };

      const response = await backgroundService['handleMessage'](message, {} as any);
      expect(response).toEqual({ success: true });
      expect(backgroundService.getConfig().darkMode).toBe(true);
    });

    it('should handle unknown message type', async () => {
      const message: SyncMessage = {
        type: 'UNKNOWN_TYPE',
        timestamp: '2024-01-01T00:00:00Z',
        source: 'popup'
      };

      await expect(backgroundService['handleMessage'](message, {} as any)).rejects.toThrow('Unknown message type');
    });
  });

  describe('Voice Recording', () => {
    it('should start recording successfully', async () => {
      const mockStream = {} as MediaStream;
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const response = await backgroundService['startRecording']();
      
      expect(response.success).toBe(true);
      expect(backgroundService.getState().isRecording).toBe(true);
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    it('should not start recording when already recording', async () => {
      backgroundService['state'].isRecording = true;

      const response = await backgroundService['startRecording']();
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Already recording');
    });

    it('should handle recording start failure', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));

      const response = await backgroundService['startRecording']();
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Permission denied');
    });

    it('should stop recording successfully', async () => {
      backgroundService['state'].isRecording = true;
      backgroundService['mediaRecorder'] = {
        stop: vi.fn(),
        stream: { getTracks: vi.fn(() => [{ stop: vi.fn() }]) }
      } as any;

      const response = await backgroundService['stopRecording']();
      
      expect(response.success).toBe(true);
      expect(backgroundService.getState().isRecording).toBe(false);
    });

    it('should not stop recording when not recording', async () => {
      const response = await backgroundService['stopRecording']();
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Not recording');
    });
  });

  describe('Memory Management', () => {
    it('should add memory successfully', async () => {
      const memory: MemoryNode = {
        id: 'test-memory',
        content: 'Test content',
        type: 'note',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: { source: 'test' },
        connections: [],
        tags: ['test']
      };

      await backgroundService['addMemory'](memory);
      
      const state = backgroundService.getState();
      expect(state.memories).toContain(memory);
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });

    it('should enforce history size limit', async () => {
      // Create memories exceeding history size
      const memories: MemoryNode[] = Array.from({ length: 1005 }, (_, i) => ({
        id: `memory-${i}`,
        content: `Memory ${i}`,
        type: 'note' as const,
        timestamp: '2024-01-01T00:00:00Z',
        metadata: { source: 'test' },
        connections: [],
        tags: []
      }));

      for (const memory of memories) {
        await backgroundService['addMemory'](memory);
      }

      const state = backgroundService.getState();
      expect(state.memories.length).toBe(1000);
    });

    it('should delete memory successfully', async () => {
      const memory: MemoryNode = {
        id: 'test-memory',
        content: 'Test content',
        type: 'note',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: { source: 'test' },
        connections: [],
        tags: []
      };

      await backgroundService['addMemory'](memory);
      await backgroundService['deleteMemory']('test-memory');
      
      const state = backgroundService.getState();
      expect(state.memories).not.toContainEqual(expect.objectContaining({ id: 'test-memory' }));
    });

    it('should clear all memories', async () => {
      await backgroundService['addMemory']({
        id: 'memory-1',
        content: 'Test 1',
        type: 'note',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: { source: 'test' },
        connections: [],
        tags: []
      });

      await backgroundService['addMemory']({
        id: 'memory-2',
        content: 'Test 2',
        type: 'note',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: { source: 'test' },
        connections: [],
        tags: []
      });

      await backgroundService['clearMemories']();
      
      const state = backgroundService.getState();
      expect(state.memories).toEqual([]);
    });
  });

  describe('Synchronization', () => {
    it('should perform sync successfully', async () => {
      const result = await backgroundService['performSync']();
      
      expect(result.type).toBe('SYNC_RESPONSE');
      expect(result.payload?.success).toBe(true);
      expect(backgroundService.getState().syncStatus).toBe('idle');
    });

    it('should handle sync errors', async () => {
      // Simulate sync error by mocking the internal state
      backgroundService['saveState'] = vi.fn().mockRejectedValue(new Error('Sync failed'));

      const result = await backgroundService['performSync']();
      
      expect(result.type).toBe('SYNC_RESPONSE');
      expect(result.payload?.success).toBe(false);
      expect(result.payload?.error).toBe('Sync failed');
    });
  });

  describe('Context Menu Actions', () => {
    it('should handle save selection context menu click', async () => {
      const mockInfo = {
        menuItemId: 'spur-save-selection',
        selectionText: 'Selected text'
      };
      const mockTab = { title: 'Test Page', url: 'https://example.com' };

      // Simulate context menu click
      const onClickedCallback = mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      await onClickedCallback(mockInfo, mockTab);

      const state = backgroundService.getState();
      expect(state.memories.length).toBe(1);
      expect(state.memories[0].content).toBe('Selected text');
    });

    it('should handle save page context menu click', async () => {
      const mockInfo = { menuItemId: 'spur-save-page' };
      const mockTab = { title: 'Test Page', url: 'https://example.com' };

      // Simulate context menu click
      const onClickedCallback = mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      await onClickedCallback(mockInfo, mockTab);

      const state = backgroundService.getState();
      expect(state.memories.length).toBe(1);
      expect(state.memories[0].content).toBe('Test Page');
    });
  });

  describe('Configuration Changes', () => {
    it('should update config and restart alarms', async () => {
      const newConfig: Partial<SpurConfig> = { syncInterval: 10 };

      await backgroundService['updateConfig'](newConfig);

      expect(backgroundService.getConfig().syncInterval).toBe(10);
      expect(mockChrome.alarms.clearAll).toHaveBeenCalled();
      expect(mockChrome.alarms.create).toHaveBeenCalledWith('sync', {
        delayInMinutes: 10,
        periodInMinutes: 10
      });
    });

    it('should disable alarms when auto-sync is turned off', async () => {
      await backgroundService['updateConfig']({ autoSync: false });

      expect(mockChrome.alarms.clearAll).toHaveBeenCalled();
      expect(mockChrome.alarms.create).not.toHaveBeenCalledWith('sync', expect.any(Object));
    });
  });

  describe('Export/Import', () => {
    it('should export data successfully', async () => {
      const memory: MemoryNode = {
        id: 'test-memory',
        content: 'Test content',
        type: 'note',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: { source: 'test' },
        connections: [],
        tags: []
      };

      await backgroundService['addMemory'](memory);
      const exportedData = await backgroundService['exportData']();

      const parsedData = JSON.parse(exportedData);
      expect(parsedData.memories).toContain(memory);
      expect(parsedData.config).toEqual(backgroundService.getConfig());
    });

    it('should import data successfully', async () => {
      const importData = {
        memories: [{
          id: 'imported-memory',
          content: 'Imported content',
          type: 'note',
          timestamp: '2024-01-01T00:00:00Z',
          metadata: { source: 'import' },
          connections: [],
          tags: []
        }],
        config: { darkMode: true }
      };

      await backgroundService['importData'](JSON.stringify(importData));

      const state = backgroundService.getState();
      expect(state.memories.some(m => m.id === 'imported-memory')).toBe(true);
      expect(state.config.darkMode).toBe(true);
    });

    it('should handle invalid import data', async () => {
      await expect(backgroundService['importData']('invalid json')).rejects.toThrow('Invalid import data format');
    });
  });

  describe('Message Broadcasting', () => {
    it('should send messages to all tabs', () => {
      const message: SyncMessage = {
        type: 'MEMORY_UPDATE',
        payload: { type: 'test' },
        timestamp: '2024-01-01T00:00:00Z',
        source: 'background'
      };

      mockChrome.tabs.query.mockImplementation((callback) => {
        callback([{ id: 1 }, { id: 2 }] as any);
      });

      backgroundService['sendMessageToAllTabs'](message);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle tab messaging errors gracefully', () => {
      const message: SyncMessage = {
        type: 'MEMORY_UPDATE',
        payload: { type: 'test' },
        timestamp: '2024-01-01T00:00:00Z',
        source: 'background'
      };

      mockChrome.tabs.query.mockImplementation((callback) => {
        callback([{ id: 1 }] as any);
      });
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not ready'));

      expect(() => backgroundService['sendMessageToAllTabs'](message)).not.toThrow();
    });
  });

  describe('Extension Installation', () => {
    it('should handle extension installation', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      await onInstalledCallback({ reason: 'install' });

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: chrome.runtime.getURL('options.html')
      });
      expect(mockChrome.notifications.create).toHaveBeenCalled();
    });
  });

  describe('Keyboard Commands', () => {
    it('should handle start recording command', async () => {
      mockMediaDevices.getUserMedia.mockResolvedValue({} as MediaStream);

      const onCommandCallback = mockChrome.commands.onCommand.addListener.mock.calls[0][0];
      await onCommandCallback('start-recording');

      expect(backgroundService.getState().isRecording).toBe(true);
    });

    it('should handle stop recording command', async () => {
      backgroundService['state'].isRecording = true;
      backgroundService['mediaRecorder'] = {
        stop: vi.fn(),
        stream: { getTracks: vi.fn(() => [{ stop: vi.fn() }]) }
      } as any;

      const onCommandCallback = mockChrome.commands.onCommand.addListener.mock.calls[0][0];
      await onCommandCallback('stop-recording');

      expect(backgroundService.getState().isRecording).toBe(false);
    });
  });
});