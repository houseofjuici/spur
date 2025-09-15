import Dexie, { Table } from 'dexie';
import { BaseEvent, MemoryNode, MemoryEdge, UserPreferences, DatabaseConfig } from '@/types';

export interface StorageSchema extends Dexie.Schema {
  // Events table
  events: Table<BaseEvent, string>;
  
  // Memory graph tables
  nodes: Table<MemoryNode, string>;
  edges: Table<MemoryEdge, string>;
  
  // User data tables
  preferences: Table<UserPreferences, string>;
  sessions: Table<any, string>;
  
  // Integration data
  integrations: Table<any, string>;
  
  // Analytics (privacy-respecting)
  analytics: Table<any, string>;
}

export class SpurDatabase extends Dexie {
  events!: Table<BaseEvent, string>;
  nodes!: Table<MemoryNode, string>;
  edges!: Table<MemoryEdge, string>;
  preferences!: Table<UserPreferences, string>;
  sessions!: Table<any, string>;
  integrations!: Table<any, string>;
  analytics!: Table<any, string>;

  constructor() {
    super('SpurDatabase');
    
    this.version(1).stores({
      events: 'id, timestamp, type, source, [timestamp+type]',
      nodes: 'id, type, timestamp, relevanceScore, [type+timestamp]',
      edges: 'id, type, targetId, strength, [targetId+type]',
      preferences: 'id',
      sessions: 'id, userId, startTime',
      integrations: 'id, type, status',
      analytics: 'id, type, timestamp'
    });
    
    this.version(2).stores({
      events: 'id, timestamp, type, source, [timestamp+type], sessionId, workflowId',
      nodes: 'id, type, timestamp, relevanceScore, [type+timestamp], projectId',
      edges: 'id, type, targetId, strength, [targetId+type], sourceId',
      preferences: 'id, userId',
      sessions: 'id, userId, startTime, endTime',
      integrations: 'id, type, status, lastSync',
      analytics: 'id, type, timestamp, sessionId'
    });
    
    this.version(3).upgrade(tx => {
      // Add indexes for better query performance
      return tx.table('events').addIndex('metadata_url', ['metadata.url']);
    });
  }
}

export class StorageService {
  private db: SpurDatabase;
  private isInitialized = false;
  private encryptionKey?: CryptoKey;
  
  constructor() {
    this.db = new SpurDatabase();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('[StorageService] Initializing database...');
      
      // Open database connection
      await this.db.open();
      
      // Initialize encryption key if available
      await this.initializeEncryption();
      
      // Perform any migrations if needed
      await this.performMigrations();
      
      // Setup indexes
      await this.setupIndexes();
      
      this.isInitialized = true;
      console.log('[StorageService] Database initialized successfully');
      
    } catch (error) {
      console.error('[StorageService] Failed to initialize:', error);
      throw error;
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      // Check if encryption is enabled in preferences
      const preferences = await this.getPreferences();
      if (preferences.privacy.encryptedBackup) {
        // Generate or load encryption key
        const keyData = await this.getEncryptionKeyFromStorage();
        if (keyData) {
          this.encryptionKey = await this.importEncryptionKey(keyData);
        }
      }
    } catch (error) {
      console.warn('[StorageService] Failed to initialize encryption:', error);
    }
  }

  private async performMigrations(): Promise<void> {
    try {
      const version = await this.db.getVersion();
      console.log(`[StorageService] Database version: ${version}`);
      
      // Add migration logic here if needed
      if (version < 3) {
        console.log('[StorageService] Running migration to version 3...');
      }
      
    } catch (error) {
      console.error('[StorageService] Migration failed:', error);
    }
  }

  private async setupIndexes(): Promise<void> {
    try {
      // Create additional indexes for performance
      // This would be done in the database version upgrade
      
    } catch (error) {
      console.error('[StorageService] Failed to setup indexes:', error);
    }
  }

  // Event storage methods
  async storeEvent(event: BaseEvent): Promise<void> {
    try {
      await this.db.events.add(event);
    } catch (error) {
      console.error('[StorageService] Failed to store event:', error);
      throw error;
    }
  }

  async getEvents(options?: {
    limit?: number;
    offset?: number;
    type?: string;
    source?: string;
    startTime?: number;
    endTime?: number;
    sessionId?: string;
    workflowId?: string;
  }): Promise<BaseEvent[]> {
    try {
      let query = this.db.events.orderBy('timestamp').reverse();
      
      if (options) {
        if (options.type) {
          query = query.filter(event => event.type === options.type);
        }
        if (options.source) {
          query = query.filter(event => event.source === options.source);
        }
        if (options.startTime) {
          query = query.filter(event => event.timestamp >= options.startTime);
        }
        if (options.endTime) {
          query = query.filter(event => event.timestamp <= options.endTime);
        }
        if (options.sessionId) {
          query = query.filter(event => event.context?.sessionId === options.sessionId);
        }
        if (options.workflowId) {
          query = query.filter(event => event.context?.workflowId === options.workflowId);
        }
      }
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.offset) {
        query = query.offset(options.offset);
      }
      
      return await query.toArray();
    } catch (error) {
      console.error('[StorageService] Failed to get events:', error);
      throw error;
    }
  }

  async deleteEvents(ids: string[]): Promise<void> {
    try {
      await this.db.events.bulkDelete(ids);
    } catch (error) {
      console.error('[StorageService] Failed to delete events:', error);
      throw error;
    }
  }

  async deleteEventsByTimeRange(startTime: number, endTime: number): Promise<number> {
    try {
      const eventsToDelete = await this.db.events
        .where('timestamp')
        .between(startTime, endTime)
        .primaryKeys();
      
      await this.db.events.bulkDelete(eventsToDelete);
      return eventsToDelete.length;
    } catch (error) {
      console.error('[StorageService] Failed to delete events by time range:', error);
      throw error;
    }
  }

  // Memory graph methods
  async storeNode(node: MemoryNode): Promise<void> {
    try {
      await this.db.nodes.add(node);
    } catch (error) {
      if (error.name === 'ConstraintError') {
        // Node already exists, update it
        await this.db.nodes.put(node);
      } else {
        throw error;
      }
    }
  }

  async getNode(id: string): Promise<MemoryNode | undefined> {
    try {
      return await this.db.nodes.get(id);
    } catch (error) {
      console.error('[StorageService] Failed to get node:', error);
      throw error;
    }
  }

  async getNodes(options?: {
    type?: string;
    limit?: number;
    offset?: number;
    minRelevance?: number;
    projectId?: string;
  }): Promise<MemoryNode[]> {
    try {
      let query = this.db.nodes.orderBy('relevanceScore').reverse();
      
      if (options) {
        if (options.type) {
          query = query.filter(node => node.type === options.type);
        }
        if (options.minRelevance) {
          query = query.filter(node => node.relevanceScore >= options.minRelevance);
        }
        if (options.projectId) {
          query = query.filter(node => node.metadata?.projectId === options.projectId);
        }
      }
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.offset) {
        query = query.offset(options.offset);
      }
      
      return await query.toArray();
    } catch (error) {
      console.error('[StorageService] Failed to get nodes:', error);
      throw error;
    }
  }

  async storeEdge(edge: MemoryEdge): Promise<void> {
    try {
      await this.db.edges.add(edge);
    } catch (error) {
      if (error.name === 'ConstraintError') {
        // Edge already exists, update it
        await this.db.edges.put(edge);
      } else {
        throw error;
      }
    }
  }

  async getEdges(sourceId?: string, targetId?: string, type?: string): Promise<MemoryEdge[]> {
    try {
      let query = this.db.edges;
      
      if (sourceId) {
        query = query.filter(edge => edge.metadata?.sourceId === sourceId);
      }
      if (targetId) {
        query = query.filter(edge => edge.targetId === targetId);
      }
      if (type) {
        query = query.filter(edge => edge.type === type);
      }
      
      return await query.toArray();
    } catch (error) {
      console.error('[StorageService] Failed to get edges:', error);
      throw error;
    }
  }

  // User preferences methods
  async storePreferences(preferences: UserPreferences): Promise<void> {
    try {
      await this.db.preferences.put({ ...preferences, id: 'default' });
    } catch (error) {
      console.error('[StorageService] Failed to store preferences:', error);
      throw error;
    }
  }

  async getPreferences(): Promise<UserPreferences> {
    try {
      const preferences = await this.db.preferences.get('default');
      return preferences || this.getDefaultPreferences();
    } catch (error) {
      console.error('[StorageService] Failed to get preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      privacy: {
        localOnly: true,
        dataRetention: '90d' as any,
        anonymizeData: true,
        encryptedBackup: false,
        permissionLevel: 'standard' as any
      },
      notifications: {
        enabled: true,
        frequency: 'immediate' as any,
        types: ['insight', 'connection', 'reminder'],
        quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' },
        soundEnabled: false
      },
      interface: {
        theme: 'auto',
        density: 'normal',
        animations: true,
        language: 'en',
        fontSize: 16,
        shortcuts: {
          openDashboard: 'Cmd+Shift+S',
          quickCapture: 'Cmd+Shift+C',
          toggleAssistant: 'Cmd+Shift+A',
          searchMemory: 'Cmd+Shift+M'
        }
      },
      integrations: {
        enabled: [],
        connections: [],
        permissions: {}
      },
      assistant: {
        personality: {
          helpfulness: 0.8,
          creativity: 0.6,
          formality: 0.5,
          verbosity: 0.7
        },
        proactivity: 'moderate' as any,
        learningRate: 0.1,
        voiceEnabled: false,
        languageModel: 'default',
        customSkills: []
      }
    };
  }

  // Integration methods
  async storeIntegration(integration: any): Promise<void> {
    try {
      await this.db.integrations.put(integration);
    } catch (error) {
      console.error('[StorageService] Failed to store integration:', error);
      throw error;
    }
  }

  async getIntegrations(): Promise<any[]> {
    try {
      return await this.db.integrations.toArray();
    } catch (error) {
      console.error('[StorageService] Failed to get integrations:', error);
      throw error;
    }
  }

  async deleteIntegration(id: string): Promise<void> {
    try {
      await this.db.integrations.delete(id);
    } catch (error) {
      console.error('[StorageService] Failed to delete integration:', error);
      throw error;
    }
  }

  // Analytics methods (privacy-respecting)
  async storeAnalyticsEvent(event: any): Promise<void> {
    try {
      await this.db.analytics.add({
        ...event,
        id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[StorageService] Failed to store analytics event:', error);
      // Don't throw error for analytics failures
    }
  }

  async getAnalyticsEvents(type?: string, limit: number = 100): Promise<any[]> {
    try {
      let query = this.db.analytics.orderBy('timestamp').reverse();
      
      if (type) {
        query = query.filter(event => event.type === type);
      }
      
      return await query.limit(limit).toArray();
    } catch (error) {
      console.error('[StorageService] Failed to get analytics events:', error);
      return [];
    }
  }

  // Maintenance methods
  async performMaintenance(): Promise<void> {
    try {
      console.log('[StorageService] Performing maintenance...');
      
      const preferences = await this.getPreferences();
      
      // Clean up old events based on retention policy
      const retentionDays = this.getRetentionDays(preferences.privacy.dataRetention);
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      
      const deletedCount = await this.deleteEventsByTimeRange(0, cutoffTime);
      console.log(`[StorageService] Cleaned up ${deletedCount} old events`);
      
      // Clean up old analytics events
      const analyticsCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
      const oldAnalyticsEvents = await this.db.analytics
        .where('timestamp')
        .below(analyticsCutoff)
        .primaryKeys();
      
      await this.db.analytics.bulkDelete(oldAnalyticsEvents);
      console.log(`[StorageService] Cleaned up ${oldAnalyticsEvents.length} old analytics events`);
      
      // Compact database if needed
      await this.compactDatabase();
      
    } catch (error) {
      console.error('[StorageService] Maintenance failed:', error);
    }
  }

  private getRetentionDays(dataRetention: string): number {
    switch (dataRetention) {
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      case 'never': return 0; // Don't auto-delete
      default: return 90;
    }
  }

  private async compactDatabase(): Promise<void> {
    try {
      // This would trigger database compaction
      // In Dexie, this happens automatically to some extent
      
    } catch (error) {
      console.error('[StorageService] Failed to compact database:', error);
    }
  }

  // Export/Import methods
  async exportData(): Promise<{
    events: BaseEvent[];
    nodes: MemoryNode[];
    edges: MemoryEdge[];
    preferences: UserPreferences;
    integrations: any[];
    timestamp: number;
  }> {
    try {
      const [events, nodes, edges, preferences, integrations] = await Promise.all([
        this.db.events.toArray(),
        this.db.nodes.toArray(),
        this.db.edges.toArray(),
        this.getPreferences(),
        this.getIntegrations()
      ]);
      
      return {
        events,
        nodes,
        edges,
        preferences,
        integrations,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[StorageService] Failed to export data:', error);
      throw error;
    }
  }

  async importData(data: any): Promise<void> {
    try {
      // Import in transaction to ensure consistency
      await this.db.transaction('rw', [
        this.db.events,
        this.db.nodes,
        this.db.edges,
        this.db.preferences,
        this.db.integrations
      ], async () => {
        if (data.events) {
          await this.db.events.bulkAdd(data.events);
        }
        if (data.nodes) {
          await this.db.nodes.bulkAdd(data.nodes);
        }
        if (data.edges) {
          await this.db.edges.bulkAdd(data.edges);
        }
        if (data.preferences) {
          await this.db.preferences.put({ ...data.preferences, id: 'default' });
        }
        if (data.integrations) {
          await this.db.integrations.bulkAdd(data.integrations);
        }
      });
      
    } catch (error) {
      console.error('[StorageService] Failed to import data:', error);
      throw error;
    }
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    try {
      await this.db.delete();
      await this.initialize();
    } catch (error) {
      console.error('[StorageService] Failed to clear data:', error);
      throw error;
    }
  }

  async getDatabaseStats(): Promise<{
    eventCount: number;
    nodeCount: number;
    edgeCount: number;
    integrationCount: number;
    analyticsCount: number;
    estimatedSize: number;
  }> {
    try {
      const [eventCount, nodeCount, edgeCount, integrationCount, analyticsCount] = await Promise.all([
        this.db.events.count(),
        this.db.nodes.count(),
        this.db.edges.count(),
        this.db.integrations.count(),
        this.db.analytics.count()
      ]);
      
      // Estimate size (rough approximation)
      const estimatedSize = (eventCount * 1000) + (nodeCount * 2000) + (edgeCount * 500);
      
      return {
        eventCount,
        nodeCount,
        edgeCount,
        integrationCount,
        analyticsCount,
        estimatedSize
      };
    } catch (error) {
      console.error('[StorageService] Failed to get database stats:', error);
      throw error;
    }
  }

  // Encryption methods (placeholder implementation)
  private async getEncryptionKeyFromStorage(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(['encryptionKey']);
      return result.encryptionKey || null;
    } catch (error) {
      return null;
    }
  }

  private async importEncryptionKey(keyData: string): Promise<CryptoKey> {
    try {
      // This is a simplified implementation
      // In production, use proper key derivation and management
      const keyBuffer = new TextEncoder().encode(keyData);
      return await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('[StorageService] Failed to import encryption key:', error);
      throw error;
    }
  }

  cleanup(): void {
    try {
      this.db.close();
      this.isInitialized = false;
    } catch (error) {
      console.error('[StorageService] Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();