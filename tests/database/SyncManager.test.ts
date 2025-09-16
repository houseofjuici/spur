import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager, RealTimeSync, SyncConfig } from '@/database/SyncManager';
import { SpurDatabase } from '@/database/SpurDatabase';

// Mock the SpurDatabase class
vi.mock('@/database/SpurDatabase', () => {
  return {
    SpurDatabase: vi.fn().mockImplementation(() => ({
      initialize: vi.fn(),
      getPendingSyncs: vi.fn(),
      markSynced: vi.fn(),
      getSetting: vi.fn(),
      close: vi.fn()
    }))
  };
});

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockDatabase: SpurDatabase;
  let config: SyncConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock database
    mockDatabase = new (SpurDatabase as any)();

    // Create sync config
    config = {
      enabled: true,
      interval: 60000, // 1 minute
      retryAttempts: 3,
      batchSize: 10,
      syncUrl: 'https://api.spur.com/sync',
      apiKey: 'test-api-key'
    };

    // Create sync manager
    syncManager = new SyncManager(mockDatabase, config);
  });

  describe('Initialization', () => {
    it('should initialize successfully when enabled', async () => {
      await syncManager.initialize();
      expect(syncManager).toBeDefined();
    });

    it('should not start periodic sync when disabled', async () => {
      config.enabled = false;
      syncManager = new SyncManager(mockDatabase, config);
      
      const spy = vi.spyOn(syncManager as any, 'startPeriodicSync');
      
      await syncManager.initialize();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should start periodic sync when enabled', async () => {
      const spy = vi.spyOn(syncManager as any, 'startPeriodicSync');
      
      await syncManager.initialize();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Sync Operations', () => {
    it('should perform sync with no pending items', async () => {
      mockDatabase.getPendingSyncs = vi.fn().mockResolvedValue([]);

      const result = await syncManager.performSync();

      expect(result.success).toBe(true);
      expect(result.syncedItems).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle sync with pending items', async () => {
      const pendingSyncs = [
        { id: 1, entity_type: 'memory_nodes', entity_id: 'test-1', action: 'create', timestamp: new Date() },
        { id: 2, entity_type: 'memory_nodes', entity_id: 'test-2', action: 'update', timestamp: new Date() }
      ];

      mockDatabase.getPendingSyncs = vi.fn().mockResolvedValue(pendingSyncs);
      mockDatabase.markSynced = vi.fn().mockResolvedValue(undefined);
      mockDatabase.getMemoryNode = vi.fn().mockResolvedValue({
        id: 'test-1',
        type: 'capture',
        title: 'Test Memory',
        content: 'Test content',
        timestamp: new Date(),
        tags: [],
        importance: 'medium',
        confidence: 0.8,
        connections: [],
        created_at: new Date(),
        updated_at: new Date()
      });

      // Mock fetch API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      const result = await syncManager.performSync();

      expect(result.success).toBe(true);
      expect(result.syncedItems).toBeGreaterThan(0);
      expect(mockDatabase.markSynced).toHaveBeenCalledTimes(2);

      // Restore fetch
      vi.restoreAllMocks();
    });

    it('should handle sync errors gracefully', async () => {
      const pendingSyncs = [
        { id: 1, entity_type: 'memory_nodes', entity_id: 'test-1', action: 'create', timestamp: new Date() }
      ];

      mockDatabase.getPendingSyncs = vi.fn().mockResolvedValue(pendingSyncs);
      mockDatabase.getMemoryNode = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await syncManager.performSync();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database error');
    });

    it('should handle batch processing', async () => {
      const pendingSyncs = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        entity_type: 'memory_nodes',
        entity_id: `test-${i + 1}`,
        action: 'create',
        timestamp: new Date()
      }));

      mockDatabase.getPendingSyncs = vi.fn().mockResolvedValue(pendingSyncs);
      mockDatabase.markSynced = vi.fn().mockResolvedValue(undefined);
      mockDatabase.getMemoryNode = vi.fn().mockResolvedValue({
        id: 'test',
        type: 'capture',
        title: 'Test',
        content: 'Content',
        timestamp: new Date(),
        tags: [],
        importance: 'medium',
        confidence: 0.8,
        connections: [],
        created_at: new Date(),
        updated_at: new Date()
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      const result = await syncManager.performSync();

      expect(result.success).toBe(true);
      // Should process in batches of 10
      expect(fetch).toHaveBeenCalledTimes(3); // 25 items in batches of 10 = 3 calls

      vi.restoreAllMocks();
    });

    it('should prevent concurrent sync operations', async () => {
      const pendingSyncs = [
        { id: 1, entity_type: 'memory_nodes', entity_id: 'test-1', action: 'create', timestamp: new Date() }
      ];

      mockDatabase.getPendingSyncs = vi.fn().mockResolvedValue(pendingSyncs);

      // Start first sync
      const firstSync = syncManager.performSync();

      // Try to start second sync immediately
      const secondSync = syncManager.performSync();

      const [firstResult, secondResult] = await Promise.all([firstSync, secondSync]);

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(false);
      expect(secondResult.errors[0]).toBe('Sync already in progress');
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration and restart periodic sync', async () => {
      const stopSpy = vi.spyOn(syncManager as any, 'stopPeriodicSync');
      const startSpy = vi.spyOn(syncManager as any, 'startPeriodicSync');

      await syncManager.updateConfig({
        interval: 30000,
        batchSize: 5
      });

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
      expect((syncManager as any).config.interval).toBe(30000);
      expect((syncManager as any).config.batchSize).toBe(5);
    });

    it('should disable sync when config.enabled is false', async () => {
      const stopSpy = vi.spyOn(syncManager as any, 'stopPeriodicSync');

      await syncManager.updateConfig({
        enabled: false
      });

      expect(stopSpy).toHaveBeenCalled();
      expect((syncManager as any).config.enabled).toBe(false);
    });
  });

  describe('Status Reporting', () => {
    it('should report correct sync status when enabled', async () => {
      mockDatabase.getPendingSyncs = vi.fn().mockResolvedValue([
        { id: 1, entity_type: 'memory_nodes', entity_id: 'test-1', action: 'create', timestamp: new Date() }
      ]);

      mockDatabase.getSetting = vi.fn().mockResolvedValue({
        timestamp: new Date().toISOString()
      });

      const status = await syncManager.getSyncStatus();

      expect(status.enabled).toBe(true);
      expect(status.isSyncing).toBe(false);
      expect(status.pendingItems).toBe(1);
      expect(status.lastSync).toBeInstanceOf(Date);
      expect(status.nextSync).toBeInstanceOf(Date);
    });

    it('should report status when disabled', async () => {
      config.enabled = false;
      syncManager = new SyncManager(mockDatabase, config);

      const status = await syncManager.getSyncStatus();

      expect(status.enabled).toBe(false);
      expect(status.pendingItems).toBe(0);
      expect(status.lastSync).toBeUndefined();
      expect(status.nextSync).toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources properly', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      await syncManager.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});

describe('RealTimeSync', () => {
  let realTimeSync: RealTimeSync;
  let mockDatabase: SpurDatabase;
  let mockSyncManager: SyncManager;
  let mockWebSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDatabase = new (SpurDatabase as any)();
    mockSyncManager = new (SyncManager as any)(mockDatabase, {});

    realTimeSync = new RealTimeSync(mockDatabase, mockSyncManager);

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: WebSocket.CONNECTING
    };
    
    global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket server', async () => {
      const url = 'wss://api.spur.com/sync';
      
      await realTimeSync.connect(url);

      expect(WebSocket).toHaveBeenCalledWith(url);
    });

    it('should handle connection events', async () => {
      const url = 'wss://api.spur.com/sync';
      const connectedCallback = vi.fn();
      
      realTimeSync.on('connected', connectedCallback);
      
      await realTimeSync.connect(url);

      // Simulate connection established
      mockWebSocket.readyState = WebSocket.OPEN;
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'open'
      );
      if (openHandler) {
        openHandler[1]();
      }

      expect(connectedCallback).toHaveBeenCalled();
    });

    it('should handle disconnection and reconnection', async () => {
      const url = 'wss://api.spur.com/sync';
      const disconnectedCallback = vi.fn();
      
      realTimeSync.on('disconnected', disconnectedCallback);
      
      await realTimeSync.connect(url);

      // Simulate disconnection
      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'close'
      );
      if (closeHandler) {
        closeHandler[1]();
      }

      expect(disconnectedCallback).toHaveBeenCalled();

      // Check that reconnection was attempted
      setTimeout.mock.calls.forEach((call: any) => {
        if (call[1] > 0) { // Only check setTimeout calls with delay
          call[0]();
        }
      });

      expect(WebSocket).toHaveBeenCalledTimes(2); // Initial + reconnect
    });

    it('should stop reconnection after max attempts', async () => {
      const url = 'wss://api.spur.com/sync';
      const reconnectFailedCallback = vi.fn();
      
      realTimeSync.on('reconnect_failed', reconnectFailedCallback);
      
      await realTimeSync.connect(url);

      // Simulate multiple disconnections
      for (let i = 0; i < 6; i++) {
        const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
          (call: any) => call[0] === 'close'
        );
        if (closeHandler) {
          closeHandler[1]();
        }
        
        // Execute setTimeout for reconnection
        setTimeout.mock.calls.forEach((call: any) => {
          if (call[1] > 0) {
            call[0]();
          }
        });
      }

      expect(reconnectFailedCallback).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should handle sync messages', async () => {
      const url = 'wss://api.spur.com/sync';
      
      mockSyncManager.forceSync = vi.fn().mockResolvedValue({
        success: true,
        syncedItems: 1,
        errors: [],
        timestamp: new Date()
      });

      await realTimeSync.connect(url);

      // Simulate sync message
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      );
      if (messageHandler) {
        messageHandler[1]({
          data: JSON.stringify({
            type: 'sync',
            timestamp: new Date().toISOString()
          })
        });
      }

      expect(mockSyncManager.forceSync).toHaveBeenCalled();
    });

    it('should handle ping messages', async () => {
      const url = 'wss://api.spur.com/sync';
      
      await realTimeSync.connect(url);

      // Simulate ping message
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      );
      if (messageHandler) {
        messageHandler[1]({
          data: JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString()
          })
        });
      }

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    it('should handle entity update messages', async () => {
      const url = 'wss://api.spur.com/sync';
      
      mockDatabase.createMemoryNode = vi.fn().mockResolvedValue({});
      const entityUpdatedCallback = vi.fn();
      
      realTimeSync.on('entity_updated', entityUpdatedCallback);
      
      await realTimeSync.connect(url);

      // Simulate entity update message
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      );
      if (messageHandler) {
        messageHandler[1]({
          data: JSON.stringify({
            type: 'entity_update',
            entity_type: 'memory_nodes',
            entity_id: 'test-1',
            action: 'create',
            entity: {
              id: 'test-1',
              type: 'capture',
              title: 'Test',
              content: 'Content',
              timestamp: new Date().toISOString(),
              tags: [],
              importance: 'medium',
              confidence: 0.8,
              connections: []
            },
            timestamp: new Date().toISOString()
          })
        });
      }

      expect(mockDatabase.createMemoryNode).toHaveBeenCalled();
      expect(entityUpdatedCallback).toHaveBeenCalled();
    });
  });

  describe('Connection State', () => {
    it('should report connection status correctly', () => {
      expect(realTimeSync.isConnected()).toBe(false);

      mockWebSocket.readyState = WebSocket.OPEN;
      expect(realTimeSync.isConnected()).toBe(true);

      mockWebSocket.readyState = WebSocket.CLOSED;
      expect(realTimeSync.isConnected()).toBe(false);
    });

    it('should disconnect properly', () => {
      mockWebSocket.readyState = WebSocket.OPEN;
      
      realTimeSync.disconnect();
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should register and emit events correctly', () => {
      const callback = vi.fn();
      
      realTimeSync.on('test-event', callback);
      realTimeSync.emit('test-event', 'arg1', 'arg2');

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should unregister event callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      realTimeSync.on('test-event', callback1);
      realTimeSync.on('test-event', callback2);
      realTimeSync.off('test-event', callback1);
      realTimeSync.emit('test-event');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});