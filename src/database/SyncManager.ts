import { SpurDatabase, MemoryNode, UserSession, Interaction } from './SpurDatabase';
import { Logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SyncConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  retryAttempts: number;
  batchSize: number;
  syncUrl?: string;
  apiKey?: string;
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  errors: string[];
  timestamp: Date;
}

export class SyncManager {
  private database: SpurDatabase;
  private config: SyncConfig;
  private logger: Logger;
  private syncInterval?: NodeJS.Timeout;
  private isSyncing = false;

  constructor(database: SpurDatabase, config: SyncConfig) {
    this.database = database;
    this.config = config;
    this.logger = new Logger('SyncManager');
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Sync is disabled');
      return;
    }

    this.logger.info('Initializing sync manager...');

    // Start periodic sync
    this.startPeriodicSync();

    this.logger.info('Sync manager initialized');
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        this.logger.error('Periodic sync failed:', error);
      }
    }, this.config.interval);

    this.logger.info('Started periodic sync with interval:', this.config.interval, 'ms');
  }

  async performSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress');
      return {
        success: false,
        syncedItems: 0,
        errors: ['Sync already in progress'],
        timestamp: new Date()
      };
    }

    this.isSyncing = true;

    try {
      this.logger.info('Starting sync...');

      // Get pending sync items
      const pendingSyncs = await this.database.getPendingSyncs();
      
      if (pendingSyncs.length === 0) {
        this.logger.info('No pending sync items');
        this.isSyncing = false;
        return {
          success: true,
          syncedItems: 0,
          errors: [],
          timestamp: new Date()
        };
      }

      // Process in batches
      const syncedItems: number[] = [];
      const errors: string[] = [];

      for (let i = 0; i < pendingSyncs.length; i += this.config.batchSize) {
        const batch = pendingSyncs.slice(i, i + this.config.batchSize);
        
        try {
          const batchResult = await this.syncBatch(batch);
          syncedItems.push(...batchResult.syncedItems);
          errors.push(...batchResult.errors);
        } catch (error) {
          this.logger.error('Batch sync failed:', error);
          errors.push(`Batch ${i / this.config.batchSize + 1} failed: ${error.message}`);
        }
      }

      this.logger.info('Sync completed:', {
        totalItems: pendingSyncs.length,
        syncedItems: syncedItems.length,
        errors: errors.length
      });

      return {
        success: errors.length === 0,
        syncedItems: syncedItems.length,
        errors,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error('Sync failed:', error);
      return {
        success: false,
        syncedItems: 0,
        errors: [error.message],
        timestamp: new Date()
      };
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncBatch(syncItems: Array<{
    id: number;
    entity_type: string;
    entity_id: string;
    action: string;
    timestamp: Date;
  }>): Promise<{ syncedItems: number[]; errors: string[] }> {
    const syncedItems: number[] = [];
    const errors: string[] = [];

    for (const syncItem of syncItems) {
      try {
        let entity: any;

        // Get entity data based on type
        switch (syncItem.entity_type) {
          case 'memory_nodes':
            entity = await this.database.getMemoryNode(syncItem.entity_id);
            break;
          case 'user_sessions':
            // Implement session retrieval if needed
            break;
          default:
            this.logger.warn('Unknown entity type:', syncItem.entity_type);
            continue;
        }

        if (!entity) {
          this.logger.warn('Entity not found:', syncItem.entity_id);
          continue;
        }

        // Send to sync server
        if (this.config.syncUrl && this.config.apiKey) {
          await this.sendToSyncServer(syncItem.action, syncItem.entity_type, entity);
        }

        // Mark as synced
        await this.database.markSynced(syncItem.id);
        syncedItems.push(syncItem.id);

        this.logger.debug('Synced item:', {
          type: syncItem.entity_type,
          id: syncItem.entity_id,
          action: syncItem.action
        });

      } catch (error) {
        this.logger.error('Failed to sync item:', syncItem.id, error);
        errors.push(`Failed to sync ${syncItem.entity_type}:${syncItem.entity_id}: ${error.message}`);
      }
    }

    return { syncedItems, errors };
  }

  private async sendToSyncServer(action: string, entityType: string, entity: any): Promise<void> {
    if (!this.config.syncUrl || !this.config.apiKey) {
      return;
    }

    const payload = {
      action,
      entity_type: entityType,
      entity,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(this.config.syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'User-Agent': 'Spur-Sync/1.0'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Sync server returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Sync server rejected the request');
    }
  }

  async forceSync(): Promise<SyncResult> {
    return await this.performSync();
  }

  async getSyncStatus(): Promise<{
    enabled: boolean;
    isSyncing: boolean;
    pendingItems: number;
    lastSync?: Date;
    nextSync?: Date;
  }> {
    const pendingSyncs = await this.database.getPendingSyncs();
    
    let lastSync: Date | undefined;
    let nextSync: Date | undefined;

    if (this.config.enabled) {
      try {
        // Get last successful sync time
        const lastSyncResult = await this.database.getSetting<{ timestamp: string }>('last_successful_sync');
        if (lastSyncResult) {
          lastSync = new Date(lastSyncResult.timestamp);
        }

        // Calculate next sync time
        nextSync = new Date(Date.now() + this.config.interval);
      } catch (error) {
        this.logger.error('Failed to get sync status:', error);
      }
    }

    return {
      enabled: this.config.enabled,
      isSyncing: this.isSyncing,
      pendingItems: pendingSyncs.length,
      lastSync,
      nextSync
    };
  }

  async updateConfig(config: Partial<SyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Restart periodic sync if needed
    if (config.enabled !== undefined || config.interval !== undefined) {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }
      
      if (this.config.enabled) {
        this.startPeriodicSync();
      }
    }

    this.logger.info('Sync config updated');
  }

  async cleanup(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    this.logger.info('Sync manager cleaned up');
  }
}

export class RealTimeSync {
  private database: SpurDatabase;
  private syncManager: SyncManager;
  private logger: Logger;
  private eventCallbacks: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private ws?: WebSocket;

  constructor(database: SpurDatabase, syncManager: SyncManager) {
    this.database = database;
    this.syncManager = syncManager;
    this.logger = new Logger('RealTimeSync');
  }

  async connect(wsUrl: string): Promise<void> {
    try {
      this.logger.info('Connecting to real-time sync server...');

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.logger.info('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.handleServerMessage(data);
        } catch (error) {
          this.logger.error('Failed to handle server message:', error);
        }
      };

      this.ws.onclose = () => {
        this.logger.warn('WebSocket disconnected');
        this.emit('disconnected');
        this.attemptReconnect(wsUrl);
      };

      this.ws.onerror = (error) => {
        this.logger.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      this.logger.error('Failed to connect to WebSocket:', error);
      throw error;
    }
  }

  private async handleServerMessage(data: any): Promise<void> {
    this.logger.debug('Received server message:', data);

    switch (data.type) {
      case 'sync':
        await this.handleSyncMessage(data);
        break;
      case 'ping':
        this.sendPong();
        break;
      case 'entity_update':
        await this.handleEntityUpdate(data);
        break;
      default:
        this.logger.warn('Unknown message type:', data.type);
    }
  }

  private async handleSyncMessage(data: any): Promise<void> {
    try {
      const result = await this.syncManager.forceSync();
      
      // Send sync result back to server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'sync_result',
          result,
          timestamp: new Date().toISOString()
        }));
      }

    } catch (error) {
      this.logger.error('Failed to handle sync message:', error);
    }
  }

  private async handleEntityUpdate(data: any): Promise<void> {
    const { entity_type, entity_id, action, entity } = data;

    try {
      switch (entity_type) {
        case 'memory_nodes':
          if (action === 'create' || action === 'update') {
            await this.database.createMemoryNode(entity);
          } else if (action === 'delete') {
            await this.database.deleteMemoryNode(entity_id);
          }
          break;
        default:
          this.logger.warn('Unhandled entity update type:', entity_type);
      }

      this.emit('entity_updated', { entity_type, entity_id, action, entity });

    } catch (error) {
      this.logger.error('Failed to handle entity update:', error);
    }
  }

  private sendPong(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }));
    }
  }

  private attemptReconnect(wsUrl: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect(wsUrl).catch(error => {
        this.logger.error('Reconnection failed:', error);
      });
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)); // Exponential backoff
  }

  // Event handling
  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }
}