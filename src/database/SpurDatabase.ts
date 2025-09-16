import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { promises as fs } from 'fs';
import { Logger } from '@/utils/logger';

export interface DatabaseConfig {
  path: string;
  enableWAL?: boolean;
  busyTimeout?: number;
}

export interface MemoryNode {
  id: string;
  type: 'interaction' | 'capture' | 'email' | 'document' | 'event' | 'task';
  title: string;
  content: string;
  timestamp: Date;
  tags: string[];
  importance: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  connections: string[];
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  started_at: Date;
  ended_at?: Date;
  context: Record<string, any>;
  interactions: Interaction[];
}

export interface Interaction {
  id: string;
  session_id: string;
  type: 'text' | 'voice' | 'action';
  input: string;
  response: string;
  confidence: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class SpurDatabase {
  private db: Database | null = null;
  private config: DatabaseConfig;
  private logger: Logger;
  private isInitialized = false;

  constructor(config: DatabaseConfig) {
    this.config = {
      enableWAL: true,
      busyTimeout: 5000,
      ...config
    };
    this.logger = new Logger('SpurDatabase');
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing database...');

      // Ensure database directory exists
      const dbDir = path.dirname(this.config.path);
      await fs.mkdir(dbDir, { recursive: true });

      // Open database connection
      this.db = await open({
        filename: this.config.path,
        driver: sqlite3.Database
      });

      // Enable WAL mode for better concurrency
      if (this.config.enableWAL) {
        await this.db.exec('PRAGMA journal_mode=WAL;');
      }

      // Set busy timeout
      if (this.config.busyTimeout) {
        await this.db.exec(`PRAGMA busy_timeout=${this.config.busyTimeout};`);
      }

      // Enable foreign keys
      await this.db.exec('PRAGMA foreign_keys=ON;');

      // Create tables
      await this.createTables();

      // Create indexes
      await this.createIndexes();

      this.isInitialized = true;
      this.logger.info('Database initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Memory nodes table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('interaction', 'capture', 'email', 'document', 'event', 'task')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        tags TEXT, -- JSON array
        importance TEXT NOT NULL CHECK(importance IN ('low', 'medium', 'high', 'critical')),
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        connections TEXT, -- JSON array
        metadata TEXT, -- JSON object
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // User sessions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        context TEXT, -- JSON object
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Interactions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'voice', 'action')),
        input TEXT NOT NULL,
        response TEXT NOT NULL,
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        timestamp INTEGER NOT NULL,
        metadata TEXT, -- JSON object
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES user_sessions (id) ON DELETE CASCADE
      );
    `);

    // Settings table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('string', 'number', 'boolean', 'json')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Sync log table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
        timestamp INTEGER NOT NULL,
        synced_at INTEGER,
        error TEXT,
        created_at INTEGER NOT NULL
      );
    `);
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Memory nodes indexes
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_memory_nodes_type ON memory_nodes(type);');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_memory_nodes_timestamp ON memory_nodes(timestamp);');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_memory_nodes_importance ON memory_nodes(importance);');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_memory_nodes_tags ON memory_nodes(tags);');

    // User sessions indexes
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON user_sessions(started_at);');

    // Interactions indexes
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_interactions_session_id ON interactions(session_id);');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);');

    // Sync log indexes
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log(entity_type, entity_id);');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp);');
  }

  // Memory Node Operations
  async createMemoryNode(node: Omit<MemoryNode, 'created_at' | 'updated_at'>): Promise<MemoryNode> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date();
    const memoryNode: MemoryNode = {
      ...node,
      created_at: now,
      updated_at: now
    };

    try {
      await this.db.run(
        `INSERT INTO memory_nodes (
          id, type, title, content, timestamp, tags, importance, 
          confidence, connections, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          memoryNode.id,
          memoryNode.type,
          memoryNode.title,
          memoryNode.content,
          memoryNode.timestamp.getTime(),
          JSON.stringify(memoryNode.tags),
          memoryNode.importance,
          memoryNode.confidence,
          JSON.stringify(memoryNode.connections),
          JSON.stringify(memoryNode.metadata || {}),
          memoryNode.created_at.getTime(),
          memoryNode.updated_at.getTime()
        ]
      );

      // Log for sync
      await this.logSync('memory_nodes', memoryNode.id, 'create');

      this.logger.debug('Created memory node:', memoryNode.id);
      return memoryNode;

    } catch (error) {
      this.logger.error('Failed to create memory node:', error);
      throw error;
    }
  }

  async getMemoryNode(id: string): Promise<MemoryNode | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const row = await this.db.get('SELECT * FROM memory_nodes WHERE id = ?', [id]);
      
      if (!row) return null;

      return this.rowToMemoryNode(row);

    } catch (error) {
      this.logger.error('Failed to get memory node:', error);
      throw error;
    }
  }

  async updateMemoryNode(id: string, updates: Partial<MemoryNode>): Promise<MemoryNode | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const existing = await this.getMemoryNode(id);
      if (!existing) return null;

      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date()
      };

      await this.db.run(
        `UPDATE memory_nodes SET 
          type = ?, title = ?, content = ?, timestamp = ?, tags = ?, 
          importance = ?, confidence = ?, connections = ?, metadata = ?, 
          updated_at = ? 
        WHERE id = ?`,
        [
          updated.type,
          updated.title,
          updated.content,
          updated.timestamp.getTime(),
          JSON.stringify(updated.tags),
          updated.importance,
          updated.confidence,
          JSON.stringify(updated.connections),
          JSON.stringify(updated.metadata || {}),
          updated.updated_at.getTime(),
          id
        ]
      );

      // Log for sync
      await this.logSync('memory_nodes', id, 'update');

      this.logger.debug('Updated memory node:', id);
      return updated;

    } catch (error) {
      this.logger.error('Failed to update memory node:', error);
      throw error;
    }
  }

  async deleteMemoryNode(id: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.run('DELETE FROM memory_nodes WHERE id = ?', [id]);
      
      if (result.changes && result.changes > 0) {
        // Log for sync
        await this.logSync('memory_nodes', id, 'delete');
        
        this.logger.debug('Deleted memory node:', id);
        return true;
      }

      return false;

    } catch (error) {
      this.logger.error('Failed to delete memory node:', error);
      throw error;
    }
  }

  async queryMemoryNodes(options: {
    type?: string;
    importance?: string;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    searchQuery?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<MemoryNode[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      let query = 'SELECT * FROM memory_nodes WHERE 1=1';
      const params: any[] = [];

      if (options.type) {
        query += ' AND type = ?';
        params.push(options.type);
      }

      if (options.importance) {
        query += ' AND importance = ?';
        params.push(options.importance);
      }

      if (options.tags && options.tags.length > 0) {
        query += ' AND (';
        const tagConditions = options.tags.map((tag, index) => {
          params.push(`%"${tag}"%`);
          return `tags LIKE ?`;
        });
        query += tagConditions.join(' OR ');
        query += ')';
      }

      if (options.dateRange) {
        query += ' AND timestamp BETWEEN ? AND ?';
        params.push(options.dateRange.start.getTime(), options.dateRange.end.getTime());
      }

      if (options.searchQuery) {
        query += ' AND (title LIKE ? OR content LIKE ?)';
        const searchTerm = `%${options.searchQuery}%`;
        params.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY timestamp DESC';

      if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      const rows = await this.db.all(query, params);
      return rows.map(row => this.rowToMemoryNode(row));

    } catch (error) {
      this.logger.error('Failed to query memory nodes:', error);
      throw error;
    }
  }

  // Session Operations
  async createSession(userId: string, context: Record<string, any> = {}): Promise<UserSession> {
    if (!this.db) throw new Error('Database not initialized');

    const session: UserSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      started_at: new Date(),
      context,
      interactions: []
    };

    try {
      await this.db.run(
        `INSERT INTO user_sessions (
          id, user_id, started_at, context, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.user_id,
          session.started_at.getTime(),
          JSON.stringify(session.context),
          Date.now(),
          Date.now()
        ]
      );

      this.logger.debug('Created session:', session.id);
      return session;

    } catch (error) {
      this.logger.error('Failed to create session:', error);
      throw error;
    }
  }

  async addInteraction(sessionId: string, interaction: Omit<Interaction, 'id' | 'session_id' | 'created_at' | 'updated_at'>): Promise<Interaction> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date();
    const fullInteraction: Interaction = {
      ...interaction,
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      session_id: sessionId,
      created_at: now,
      updated_at: now
    };

    try {
      await this.db.run(
        `INSERT INTO interactions (
          id, session_id, type, input, response, confidence, 
          timestamp, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullInteraction.id,
          fullInteraction.session_id,
          fullInteraction.type,
          fullInteraction.input,
          fullInteraction.response,
          fullInteraction.confidence,
          fullInteraction.timestamp.getTime(),
          JSON.stringify(fullInteraction.metadata || {}),
          fullInteraction.created_at.getTime(),
          fullInteraction.updated_at.getTime()
        ]
      );

      this.logger.debug('Added interaction:', fullInteraction.id);
      return fullInteraction;

    } catch (error) {
      this.logger.error('Failed to add interaction:', error);
      throw error;
    }
  }

  async getSessionHistory(sessionId: string): Promise<Interaction[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = await this.db.all(
        'SELECT * FROM interactions WHERE session_id = ? ORDER BY timestamp ASC',
        [sessionId]
      );

      return rows.map(row => ({
        id: row.id,
        session_id: row.session_id,
        type: row.type,
        input: row.input,
        response: row.response,
        confidence: row.confidence,
        timestamp: new Date(row.timestamp),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      }));

    } catch (error) {
      this.logger.error('Failed to get session history:', error);
      throw error;
    }
  }

  // Settings Operations
  async getSetting<T>(key: string): Promise<T | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const row = await this.db.get('SELECT value, type FROM settings WHERE key = ?', [key]);
      
      if (!row) return null;

      switch (row.type) {
        case 'string':
          return row.value as T;
        case 'number':
          return Number(row.value) as T;
        case 'boolean':
          return row.value === 'true' as T;
        case 'json':
          return JSON.parse(row.value) as T;
        default:
          return row.value as T;
      }

    } catch (error) {
      this.logger.error('Failed to get setting:', error);
      throw error;
    }
  }

  async setSetting<T>(key: string, value: T, type: 'string' | 'number' | 'boolean' | 'json' = 'string'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stringValue = type === 'json' ? JSON.stringify(value) : String(value);
      const now = Date.now();

      await this.db.run(
        `INSERT OR REPLACE INTO settings (key, value, type, created_at, updated_at) 
         VALUES (?, ?, ?, COALESCE((SELECT created_at FROM settings WHERE key = ?), ?), ?)`,
        [key, stringValue, type, key, now, now]
      );

      this.logger.debug('Set setting:', key);

    } catch (error) {
      this.logger.error('Failed to set setting:', error);
      throw error;
    }
  }

  // Sync Operations
  private async logSync(entityType: string, entityId: string, action: 'create' | 'update' | 'delete'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.run(
        `INSERT INTO sync_log (entity_type, entity_id, action, timestamp, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [entityType, entityId, action, Date.now(), Date.now()]
      );

    } catch (error) {
      this.logger.error('Failed to log sync:', error);
    }
  }

  async getPendingSyncs(): Promise<Array<{
    id: number;
    entity_type: string;
    entity_id: string;
    action: string;
    timestamp: Date;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = await this.db.all(
        'SELECT id, entity_type, entity_id, action, timestamp FROM sync_log WHERE synced_at IS NULL ORDER BY timestamp ASC'
      );

      return rows.map(row => ({
        id: row.id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        action: row.action,
        timestamp: new Date(row.timestamp)
      }));

    } catch (error) {
      this.logger.error('Failed to get pending syncs:', error);
      throw error;
    }
  }

  async markSynced(syncId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.run(
        'UPDATE sync_log SET synced_at = ? WHERE id = ?',
        [Date.now(), syncId]
      );

    } catch (error) {
      this.logger.error('Failed to mark sync as complete:', error);
      throw error;
    }
  }

  // Utility methods
  private rowToMemoryNode(row: any): MemoryNode {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      timestamp: new Date(row.timestamp),
      tags: row.tags ? JSON.parse(row.tags) : [],
      importance: row.importance,
      confidence: row.confidence,
      connections: row.connections ? JSON.parse(row.connections) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      this.logger.info('Database connection closed');
    }
  }

  async backup(backupPath: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.backup(backupPath);
      this.logger.info('Database backup created:', backupPath);

    } catch (error) {
      this.logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  async vacuum(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.exec('VACUUM;');
      this.logger.info('Database vacuumed');

    } catch (error) {
      this.logger.error('Failed to vacuum database:', error);
      throw error;
    }
  }

  async getStats(): Promise<{
    memoryNodes: number;
    sessions: number;
    interactions: number;
    pendingSyncs: number;
    databaseSize: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const [memoryNodes, sessions, interactions, pendingSyncs] = await Promise.all([
        this.db.get('SELECT COUNT(*) as count FROM memory_nodes'),
        this.db.get('SELECT COUNT(*) as count FROM user_sessions'),
        this.db.get('SELECT COUNT(*) as count FROM interactions'),
        this.db.get('SELECT COUNT(*) as count FROM sync_log WHERE synced_at IS NULL')
      ]);

      const stats = await this.db.get('PRAGMA page_count;');
      const pageSize = await this.db.get('PRAGMA page_size;');
      const databaseSize = (stats.page_count * pageSize.page_size) || 0;

      return {
        memoryNodes: memoryNodes.count,
        sessions: sessions.count,
        interactions: interactions.count,
        pendingSyncs: pendingSyncs.count,
        databaseSize
      };

    } catch (error) {
      this.logger.error('Failed to get database stats:', error);
      throw error;
    }
  }
}