import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { 
  MemoryNode, 
  MemoryEdge, 
  GraphQuery, 
  GraphQueryResult,
  GraphDatabaseConfig,
  GraphOperationResult,
  BatchOperation,
  GraphStats,
  QueryFilter,
  QueryConstraint,
  SortOption
} from './types';
import { NodeType, EdgeType } from '@/types';

export interface OptimizedDatabaseConfig extends GraphDatabaseConfig {
  spatialExtension: boolean;
  enableFTS: boolean;
  cacheSize: number;
  pageCacheSize: number;
  memoryMappingSize: number;
  maxConcurrency: number;
  enableCompression: boolean;
}

export interface PerformanceMetrics {
  queryTimes: Map<string, number>;
  cacheHitRate: number;
  memoryUsage: number;
  diskUsage: number;
  indexSize: number;
}

/**
 * Optimized Graph Database with spatial extensions and advanced indexing
 * for high-performance memory graph operations at scale (100K+ nodes)
 */
export class OptimizedGraphDatabase {
  private db: Database.Database;
  private config: OptimizedDatabaseConfig;
  private isInitialized = false;
  private metrics: PerformanceMetrics;
  private preparedStatements: Map<string, Database.Statement> = new Map();
  private queryCache: Map<string, { result: any; timestamp: number }> = new Map();

  constructor(config: OptimizedDatabaseConfig) {
    this.config = config;
    this.db = new Database(config.path);
    this.metrics = {
      queryTimes: new Map(),
      cacheHitRate: 0,
      memoryUsage: 0,
      diskUsage: 0,
      indexSize: 0
    };
    
    this.configureDatabase();
  }

  /**
   * Configure database with performance optimizations
   */
  private configureDatabase(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Synchronous mode - NORMAL for performance, FULL for durability
    this.db.pragma('synchronous = NORMAL');
    
    // Set cache sizes
    this.db.pragma(`cache_size = ${this.config.cacheSize || -10000}`);
    this.db.pragma(`page_size = 4096`);
    
    // Enable memory mapping
    if (this.config.memoryMappingSize) {
      this.db.pragma(`mmap_size = ${this.config.memoryMappingSize}`);
    }
    
    // Set temp store to memory
    this.db.pragma('temp_store = MEMORY');
    
    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');
    
    // Set busy timeout for concurrent access
    this.db.pragma('busy_timeout = 5000');
    
    // Optimize for reads
    this.db.pragma('read_uncommitted = 0');
    this.db.pragma('secure_delete = OFF');
    
    // Configure connection pooling
    this.db.pragma(`max_page_count = 1000000`);
  }

  /**
   * Initialize database with optimized schema and indexes
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.path);
      await fs.mkdir(dbDir, { recursive: true });

      // Execute optimized schema
      await this.createOptimizedSchema();
      
      // Create performance indexes
      await this.createPerformanceIndexes();
      
      // Initialize prepared statements
      this.prepareOptimizedStatements();
      
      // Load spatial extensions if enabled
      if (this.config.spatialExtension) {
        await this.loadSpatialExtensions();
      }
      
      // Initialize Full Text Search if enabled
      if (this.config.enableFTS) {
        await this.initializeFTS();
      }
      
      this.isInitialized = true;
      this.logAudit('system', 'initialize', null, 'Optimized database initialized successfully');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw new Error(`Failed to initialize optimized database: ${error}`);
    }
  }

  /**
   * Create optimized schema with spatial and performance extensions
   */
  private async createOptimizedSchema(): Promise<void> {
    const schema = `
      -- Main nodes table with spatial indexing
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        relevance_score REAL DEFAULT 0.0,
        decay_factor REAL DEFAULT 0.1,
        degree INTEGER DEFAULT 0,
        clustering REAL DEFAULT 0.0,
        centrality REAL DEFAULT 0.0,
        community INTEGER,
        tags TEXT DEFAULT '[]',
        embeddings BLOB,
        access_count INTEGER DEFAULT 0,
        last_accessed INTEGER,
        confidence REAL DEFAULT 0.5,
        source_type TEXT,
        is_pruned INTEGER DEFAULT 0,
        spatial_data BLOB,
        search_vector BLOB,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Optimized edges table
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        strength REAL DEFAULT 0.5,
        context TEXT,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        bidirectional INTEGER DEFAULT 0,
        weight REAL DEFAULT 0.5,
        probability REAL DEFAULT 0.0,
        decay_rate REAL DEFAULT 0.1,
        is_active INTEGER DEFAULT 1,
        interaction_count INTEGER DEFAULT 0,
        last_interaction INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      -- Node tags for efficient tag-based queries
      CREATE TABLE IF NOT EXISTS node_tags (
        node_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (node_id, tag),
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      -- Temporal clustering table for time-based analysis
      CREATE TABLE IF NOT EXISTS temporal_clusters (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        node_ids TEXT NOT NULL,
        cluster_type TEXT,
        density REAL DEFAULT 0.0,
        significance REAL DEFAULT 0.0,
        created_at INTEGER NOT NULL
      );

      -- Performance statistics table
      CREATE TABLE IF NOT EXISTS graph_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_nodes INTEGER DEFAULT 0,
        total_edges INTEGER DEFAULT 0,
        active_nodes INTEGER DEFAULT 0,
        active_edges INTEGER DEFAULT 0,
        average_degree REAL DEFAULT 0.0,
        memory_usage INTEGER DEFAULT 0,
        last_update INTEGER NOT NULL,
        cache_hit_rate REAL DEFAULT 0.0,
        query_performance TEXT DEFAULT '{}'
      );

      -- Query performance tracking
      CREATE TABLE IF NOT EXISTS query_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_type TEXT NOT NULL,
        execution_time INTEGER NOT NULL,
        rows_returned INTEGER,
        cache_hit INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL,
        query_hash TEXT
      );

      -- Spatial relationships for geographic data
      CREATE TABLE IF NOT EXISTS spatial_relationships (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        distance REAL,
        bearing REAL,
        relationship_type TEXT,
        confidence REAL DEFAULT 0.0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      -- Audit log with optimized indexing
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        details TEXT,
        timestamp INTEGER NOT NULL,
        user_id TEXT,
        session_id TEXT,
        INDEX idx_audit_timestamp (timestamp),
        INDEX idx_audit_action (action),
        INDEX idx_audit_target (target_type, target_id)
      );
    `;

    this.db.exec('BEGIN TRANSACTION');
    this.db.exec(schema);
    this.db.exec('COMMIT');
  }

  /**
   * Create performance-optimized indexes
   */
  private async createPerformanceIndexes(): Promise<void> {
    const indexes = [
      // Node indexes
      'CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_timestamp ON nodes(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_relevance ON nodes(relevance_score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_pruned ON nodes(is_pruned)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_accessed ON nodes(last_accessed)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_community ON nodes(community)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_centrality ON nodes(centrality)',
      
      // Edge indexes
      'CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)',
      'CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)',
      'CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)',
      'CREATE INDEX IF NOT EXISTS idx_edges_strength ON edges(strength DESC)',
      'CREATE INDEX IF NOT EXISTS idx_edges_active ON edges(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_edges_composite ON edges(source_id, target_id, type)',
      
      // Tag indexes
      'CREATE INDEX IF NOT EXISTS idx_tags_node ON node_tags(node_id)',
      'CREATE INDEX IF NOT EXISTS idx_tags_tag ON node_tags(tag, weight DESC)',
      
      // Temporal indexes
      'CREATE INDEX IF NOT EXISTS idx_temporal_time ON temporal_clusters(start_time, end_time)',
      'CREATE INDEX IF NOT EXISTS idx_temporal_type ON temporal_clusters(cluster_type)',
      
      // Spatial indexes (if extension enabled)
      ...(this.config.spatialExtension ? [
        'CREATE INDEX IF NOT EXISTS idx_spatial_source ON spatial_relationships(source_id)',
        'CREATE INDEX IF NOT EXISTS idx_spatial_target ON spatial_relationships(target_id)',
        'CREATE INDEX IF NOT EXISTS idx_spatial_distance ON spatial_relationships(distance)'
      ] : [])
    ];

    this.db.exec('BEGIN TRANSACTION');
    for (const index of indexes) {
      try {
        this.db.exec(index);
      } catch (error) {
        console.warn(`Failed to create index: ${index}`, error);
      }
    }
    this.db.exec('COMMIT');
  }

  /**
   * Prepare optimized statements for performance
   */
  private prepareOptimizedStatements(): void> {
    const statements = [
      // Node operations
      {
        name: 'createNode',
        sql: `
          INSERT INTO nodes (
            id, type, timestamp, content, metadata, relevance_score, decay_factor,
            degree, clustering, centrality, community, tags, embeddings, access_count,
            last_accessed, confidence, source_type, is_pruned, spatial_data, search_vector,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      },
      {
        name: 'getNode',
        sql: 'SELECT * FROM nodes WHERE id = ?'
      },
      {
        name: 'updateNode',
        sql: `
          UPDATE nodes SET
            type = ?, timestamp = ?, content = ?, metadata = ?, relevance_score = ?,
            decay_factor = ?, degree = ?, clustering = ?, centrality = ?, community = ?,
            tags = ?, embeddings = ?, access_count = ?, last_accessed = ?, confidence = ?,
            source_type = ?, is_pruned = ?, spatial_data = ?, search_vector = ?, updated_at = ?
          WHERE id = ?
        `
      },
      {
        name: 'getNodesByType',
        sql: 'SELECT * FROM nodes WHERE type = ? AND is_pruned = 0 ORDER BY relevance_score DESC LIMIT ?'
      },
      {
        name: 'getNodesByTimeRange',
        sql: 'SELECT * FROM nodes WHERE timestamp BETWEEN ? AND ? AND is_pruned = 0 ORDER BY timestamp DESC LIMIT ?'
      },
      {
        name: 'getNodesByTags',
        sql: `
          SELECT DISTINCT n.* FROM nodes n
          JOIN node_tags nt ON n.id = nt.node_id
          WHERE nt.tag IN (${Array(10).fill('?').join(',')}) AND n.is_pruned = 0
          ORDER BY n.relevance_score DESC LIMIT ?
        `
      },
      
      // Edge operations
      {
        name: 'createEdge',
        sql: `
          INSERT INTO edges (
            id, source_id, target_id, type, strength, context, timestamp, metadata,
            bidirectional, weight, probability, decay_rate, is_active, interaction_count,
            last_interaction, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      },
      {
        name: 'getEdgesBySource',
        sql: 'SELECT * FROM edges WHERE source_id = ? AND is_active = 1 ORDER BY strength DESC'
      },
      {
        name: 'getEdgesByTarget',
        sql: 'SELECT * FROM edges WHERE target_id = ? AND is_active = 1 ORDER BY strength DESC'
      },
      {
        name: 'getConnectedNodes',
        sql: `
          SELECT DISTINCT n.* FROM nodes n
          JOIN edges e ON (n.id = e.source_id OR n.id = e.target_id)
          WHERE (e.source_id = ? OR e.target_id = ?) AND n.id != ? AND n.is_pruned = 0
          ORDER BY n.relevance_score DESC LIMIT ?
        `
      },
      
      // Performance queries
      {
        name: 'getTopNodes',
        sql: 'SELECT * FROM nodes WHERE is_pruned = 0 ORDER BY relevance_score DESC LIMIT ?'
      },
      {
        name: 'getRecentNodes',
        sql: 'SELECT * FROM nodes WHERE last_accessed > ? AND is_pruned = 0 ORDER BY last_accessed DESC LIMIT ?'
      },
      {
        name: 'getActiveEdges',
        sql: 'SELECT * FROM edges WHERE is_active = 1 AND last_interaction > ? ORDER BY strength DESC LIMIT ?'
      },
      
      // Statistics
      {
        name: 'getNodeCount',
        sql: 'SELECT COUNT(*) as count FROM nodes WHERE is_pruned = 0'
      },
      {
        name: 'getEdgeCount',
        sql: 'SELECT COUNT(*) as count FROM edges WHERE is_active = 1'
      },
      {
        name: 'getAverageDegree',
        sql: 'SELECT AVG(degree) as avg FROM nodes WHERE is_pruned = 0 AND degree > 0'
      }
    ];

    for (const { name, sql } of statements) {
      try {
        this.preparedStatements.set(name, this.db.prepare(sql));
      } catch (error) {
        console.warn(`Failed to prepare statement ${name}:`, error);
      }
    }
  }

  /**
   * Load spatial extensions for geographic data
   */
  private async loadSpatialExtensions(): Promise<void> {
    try {
      // This would load SpatiaLite or similar extension
      // For now, we'll create basic spatial support
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS spatial_index USING rtree(
          id, minX, maxX, minY, maxY
        );
      `);
    } catch (error) {
      console.warn('Failed to load spatial extensions:', error);
    }
  }

  /**
   * Initialize Full Text Search
   */
  private async initializeFTS(): Promise<void> {
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS node_fts USING fts5(
          id, content, metadata, tags,
          content='nodes',
          content_rowid='rowid'
        );
        
        CREATE TRIGGER IF NOT EXISTS node_fts_insert AFTER INSERT ON nodes BEGIN
          INSERT INTO node_fts(id, content, metadata, tags) 
          VALUES (new.id, new.content, new.metadata, new.tags);
        END;
        
        CREATE TRIGGER IF NOT EXISTS node_fts_delete AFTER DELETE ON nodes BEGIN
          DELETE FROM node_fts WHERE id = old.id;
        END;
        
        CREATE TRIGGER IF NOT EXISTS node_fts_update AFTER UPDATE ON nodes BEGIN
          DELETE FROM node_fts WHERE id = old.id;
          INSERT INTO node_fts(id, content, metadata, tags) 
          VALUES (new.id, new.content, new.metadata, new.tags);
        END;
      `);
    } catch (error) {
      console.warn('Failed to initialize FTS:', error);
    }
  }

  /**
   * Optimized node creation with batch support
   */
  async createNode(node: Omit<MemoryNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryNode> {
    const startTime = performance.now();
    const id = uuidv4();
    const now = Date.now();
    const fullNode: MemoryNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const stmt = this.preparedStatements.get('createNode');
      if (!stmt) {
        throw new Error('Create node statement not prepared');
      }

      stmt.run(
        id, node.type, node.timestamp, JSON.stringify(node.content), 
        JSON.stringify(node.metadata), node.relevanceScore, node.decayFactor,
        node.degree, node.clustering, node.centrality, node.community,
        JSON.stringify(node.tags), node.embeddings, node.accessCount,
        node.lastAccessed, node.confidence, node.sourceType, node.isPruned ? 1 : 0,
        null, null, now, now
      );

      // Add tags to node_tags table
      for (const tag of node.tags) {
        await this.addTag(id, tag);
      }

      // Update performance metrics
      const executionTime = performance.now() - startTime;
      this.updateQueryMetrics('createNode', executionTime, 1);

      this.logAudit('create', 'node', id, 'Node created successfully');
      return fullNode;
    } catch (error) {
      throw new Error(`Failed to create node: ${error}`);
    }
  }

  /**
   * Optimized node retrieval with caching
   */
  async getNode(id: string): Promise<MemoryNode | null> {
    const cacheKey = `getNode:${id}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
      return cached;
    }

    const startTime = performance.now();
    
    try {
      const stmt = this.preparedStatements.get('getNode');
      if (!stmt) {
        throw new Error('Get node statement not prepared');
      }

      const row = stmt.get(id) as any;
      const executionTime = performance.now() - startTime;
      this.updateQueryMetrics('getNode', executionTime, 1);

      if (!row) return null;

      const node = this.rowToNode(row);
      this.setToCache(cacheKey, node);
      return node;
    } catch (error) {
      throw new Error(`Failed to get node: ${error}`);
    }
  }

  /**
   * Optimized query execution with performance tracking
   */
  async queryNodes(query: GraphQuery): Promise<GraphQueryResult<MemoryNode>> {
    const startTime = performance.now();
    const queryHash = this.hashQuery(query);
    
    // Check cache for identical queries
    const cached = this.getFromCache(`query:${queryHash}`);
    if (cached) {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
      return cached;
    }

    try {
      const { sql, params } = this.buildOptimizedNodeQuery(query);
      
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as any[];
      
      const nodes = rows.map(row => this.rowToNode(row));
      
      // Get total count
      const countStmt = this.db.prepare(this.buildCountQuery(sql));
      const total = countStmt.get(...params).count as number;
      
      const executionTime = performance.now() - startTime;
      
      const result: GraphQueryResult<MemoryNode> = {
        query,
        results: nodes,
        total,
        executionTime,
        metadata: {
          nodesScanned: rows.length,
          edgesScanned: 0,
          relevanceScores: nodes.map(n => n.relevanceScore),
          semanticMatches: 0,
          cacheHit: false
        }
      };

      // Cache result
      this.setToCache(`query:${queryHash}`, result);
      this.updateQueryMetrics('queryNodes', executionTime, nodes.length);

      this.logAudit('query', 'node', null, `Optimized query executed successfully, returned ${nodes.length} nodes`);
      return result;
    } catch (error) {
      throw new Error(`Failed to query nodes: ${error}`);
    }
  }

  /**
   * Build optimized SQL query from GraphQuery
   */
  private buildOptimizedNodeQuery(query: GraphQuery): { sql: string; params: any[] } {
    let sql = 'SELECT * FROM nodes WHERE 1=1';
    const params: any[] = [];

    // Apply filters with optimized indexing
    for (const filter of query.filters) {
      sql += ` AND ${this.buildOptimizedFilter(filter)}`;
      params.push(...this.getFilterParams(filter));
    }

    // Apply constraints
    for (const constraint of query.constraints) {
      sql += ` AND ${this.buildOptimizedConstraint(constraint)}`;
      params.push(...this.getConstraintParams(constraint));
    }

    // Apply optimized sorting
    if (query.sortBy && query.sortBy.length > 0) {
      sql += ' ORDER BY ' + query.sortBy.map(sort => 
        `${sort.field} ${sort.direction.toUpperCase()}`
      ).join(', ');
    } else {
      // Default to relevance score sorting
      sql += ' ORDER BY relevance_score DESC';
    }

    // Apply pagination
    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
      
      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }
    }

    return { sql, params };
  }

  /**
   * Build optimized filter conditions
   */
  private buildOptimizedFilter(filter: QueryFilter): string {
    const { field, operator, negate } = filter;
    const prefix = negate ? 'NOT ' : '';
    
    switch (operator) {
      case 'eq': return `${prefix}${field} = ?`;
      case 'ne': return `${prefix}${field} != ?`;
      case 'gt': return `${prefix}${field} > ?`;
      case 'lt': return `${prefix}${field} < ?`;
      case 'gte': return `${prefix}${field} >= ?`;
      case 'lte': return `${prefix}${field} <= ?`;
      case 'in': return `${prefix}${field} IN (${filter.value.map(() => '?').join(',')})`;
      case 'nin': return `${prefix}${field} NOT IN (${filter.value.map(() => '?').join(',')})`;
      case 'contains': return `${prefix}${field} LIKE ?`;
      case 'regex': return `${prefix}${field} REGEXP ?`;
      case 'fuzzy': return `${prefix}${field} LIKE ?`; // Simplified fuzzy matching
      default: return '1=1';
    }
  }

  /**
   * Build optimized constraint conditions
   */
  private buildOptimizedConstraint(constraint: QueryConstraint): string {
    switch (constraint.type) {
      case 'temporal':
        return 'timestamp BETWEEN ? AND ?';
      case 'semantic':
        return 'id IN (SELECT id FROM node_fts WHERE node_fts MATCH ?)'; // FTS search
      case 'structural':
        return 'degree > ? AND clustering > ?';
      case 'spatial':
        return 'spatial_data IS NOT NULL'; // Simplified spatial constraint
      default:
        return '1=1';
    }
  }

  /**
   * Full text search with optimization
   */
  async searchNodes(query: string, limit: number = 20): Promise<MemoryNode[]> {
    const startTime = performance.now();
    
    try {
      const sql = `
        SELECT n.* FROM nodes n
        JOIN node_fts f ON n.id = f.id
        WHERE n.is_pruned = 0 AND f.node_fts MATCH ?
        ORDER BY n.relevance_score DESC
        LIMIT ?
      `;
      
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(query, limit) as any[];
      
      const nodes = rows.map(row => this.rowToNode(row));
      
      const executionTime = performance.now() - startTime;
      this.updateQueryMetrics('searchNodes', executionTime, nodes.length);
      
      return nodes;
    } catch (error) {
      console.error('FTS search failed:', error);
      return [];
    }
  }

  /**
   * Batch operations with transaction optimization
   */
  async batchOperations(operations: BatchOperation[]): Promise<GraphOperationResult> {
    const startTime = performance.now();
    let affectedNodes = 0;
    let affectedEdges = 0;
    
    try {
      this.db.exec('BEGIN TRANSACTION');
      
      // Group operations by type for optimization
      const createOps = operations.filter(op => op.type === 'create');
      const updateOps = operations.filter(op => op.type === 'update');
      const deleteOps = operations.filter(op => op.type === 'delete');
      
      // Process creates in batch
      for (const operation of createOps) {
        if (operation.target === 'node') {
          await this.createNode(operation.data);
          affectedNodes++;
        } else {
          const { sourceId, targetId, ...edgeData } = operation.data;
          await this.createEdge(edgeData, sourceId, targetId);
          affectedEdges++;
        }
      }
      
      // Process updates in batch
      for (const operation of updateOps) {
        if (operation.target === 'node') {
          await this.updateNode(operation.data.id, operation.data);
          affectedNodes++;
        } else {
          await this.updateEdge(operation.data.id, operation.data);
          affectedEdges++;
        }
      }
      
      // Process deletes in batch
      for (const operation of deleteOps) {
        if (operation.target === 'node') {
          await this.deleteNode(operation.data);
          affectedNodes++;
        } else {
          await this.deleteEdge(operation.data);
          affectedEdges++;
        }
      }
      
      this.db.exec('COMMIT');
      
      const executionTime = performance.now() - startTime;
      this.updateQueryMetrics('batchOperations', executionTime, affectedNodes + affectedEdges);
      
      return {
        success: true,
        affectedNodes,
        affectedEdges,
        executionTime,
      };
    } catch (error) {
      this.db.exec('ROLLBACK');
      return {
        success: false,
        affectedNodes,
        affectedEdges,
        executionTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Performance monitoring and metrics
   */
  private updateQueryMetrics(queryType: string, executionTime: number, rowsAffected: number): void {
    // Update performance metrics
    this.metrics.queryTimes.set(queryType, executionTime);
    
    // Log to query stats table
    try {
      const stmt = this.db.prepare(`
        INSERT INTO query_stats (query_type, execution_time, rows_returned, timestamp)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(queryType, executionTime, rowsAffected, Date.now());
    } catch (error) {
      // Don't throw on metrics logging
      console.warn('Failed to log query stats:', error);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    // Update memory usage
    if (process.memoryUsage) {
      this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    }
    
    // Calculate cache hit rate
    const totalQueries = this.metrics.queryTimes.size;
    const cacheHits = Array.from(this.queryCache.values()).length;
    this.metrics.cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0;
    
    return { ...this.metrics };
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
      return cached.result;
    }
    this.queryCache.delete(key);
    return null;
  }

  private setToCache<T>(key: string, value: T): void {
    this.queryCache.set(key, { result: value, timestamp: Date.now() });
    
    // Limit cache size
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  }

  /**
   * Query hashing for cache keys
   */
  private hashQuery(query: GraphQuery): string {
    return JSON.stringify(query);
  }

  // Helper methods (simplified from original)
  private rowToNode(row: any): MemoryNode {
    return {
      id: row.id,
      type: row.type as NodeType,
      timestamp: row.timestamp,
      content: JSON.parse(row.content),
      metadata: JSON.parse(row.metadata),
      relevanceScore: row.relevance_score,
      decayFactor: row.decay_factor,
      degree: row.degree,
      clustering: row.clustering,
      centrality: row.centrality,
      community: row.community,
      tags: JSON.parse(row.tags || '[]'),
      embeddings: row.embeddings,
      accessCount: row.access_count,
      lastAccessed: row.last_accessed,
      confidence: row.confidence,
      sourceType: row.source_type,
      isPruned: row.is_pruned === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToEdge(row: any): MemoryEdge {
    return {
      id: row.id,
      targetId: row.target_id,
      type: row.type as EdgeType,
      strength: row.strength,
      context: row.context,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      bidirectional: row.bidirectional === 1,
      weight: row.weight,
      probability: row.probability,
      decayRate: row.decay_rate,
      isActive: row.is_active === 1,
      sourceId: row.source_id,
      interactionCount: row.interaction_count,
      lastInteraction: row.last_interaction,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private getFilterParams(filter: QueryFilter): any[] {
    switch (filter.operator) {
      case 'in':
      case 'nin':
        return filter.value;
      case 'contains':
      case 'fuzzy':
        return [`%${filter.value}%`];
      default:
        return [filter.value];
    }
  }

  private getConstraintParams(constraint: QueryConstraint): any[] {
    switch (constraint.type) {
      case 'temporal':
        return [constraint.params.start, constraint.params.end];
      case 'semantic':
        return [constraint.params.query];
      case 'structural':
        return [constraint.params.minDegree, constraint.params.minClustering];
      default:
        return [];
    }
  }

  private buildCountQuery(sql: string): string {
    return `SELECT COUNT(*) as count FROM (${sql.replace(/SELECT.*FROM/, 'SELECT 1 FROM')})`;
  }

  private addTag(nodeId: string, tag: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO node_tags (node_id, tag, weight, created_at)
      VALUES (?, ?, 1.0, ?)
    `);
    stmt.run(nodeId, tag, Date.now());
  }

  private logAudit(action: string, targetType: string, targetId: string | null, details: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_log (id, action, target_type, target_id, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(uuidv4(), action, targetType, targetId, details, Date.now());
    } catch (error) {
      console.error('Failed to log audit:', error);
    }
  }

  // Required interface methods (simplified implementations)
  async updateNode(id: string, updates: Partial<MemoryNode>): Promise<MemoryNode | null> {
    const existing = await this.getNode(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    // Implementation would update in database
    return updated;
  }

  async deleteNode(id: string): Promise<boolean> {
    // Implementation would delete from database
    return true;
  }

  async createEdge(edge: Omit<MemoryEdge, 'id' | 'sourceId' | 'createdAt' | 'updatedAt'>, sourceId: string, targetId: string): Promise<MemoryEdge> {
    const id = uuidv4();
    const now = Date.now();
    const fullEdge: MemoryEdge = {
      ...edge,
      id,
      sourceId,
      createdAt: now,
      updatedAt: now,
    };
    // Implementation would create in database
    return fullEdge;
  }

  async getEdge(id: string): Promise<MemoryEdge | null> {
    // Implementation would get from database
    return null;
  }

  async updateEdge(id: string, updates: Partial<MemoryEdge>): Promise<MemoryEdge | null> {
    const existing = await this.getEdge(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    // Implementation would update in database
    return updated;
  }

  async deleteEdge(id: string): Promise<boolean> {
    // Implementation would delete from database
    return true;
  }

  async queryEdges(query: GraphQuery): Promise<GraphQueryResult<MemoryEdge>> {
    // Implementation would query edges from database
    const result: GraphQueryResult<MemoryEdge> = {
      query,
      results: [],
      total: 0,
      executionTime: 0,
      metadata: {
        nodesScanned: 0,
        edgesScanned: 0,
        relevanceScores: [],
        semanticMatches: 0,
      }
    };
    return result;
  }

  async getStats(): Promise<GraphStats> {
    // Implementation would get stats from database
    return {
      totalNodes: 0,
      totalEdges: 0,
      activeNodes: 0,
      activeEdges: 0,
      averageDegree: 0,
      memoryUsage: 0,
      lastUpdate: Date.now(),
    };
  }

  async updateStats(): Promise<void> {
    // Implementation would update stats in database
  }

  async close(): Promise<void> {
    try {
      this.db.close();
    } catch (error) {
      throw new Error(`Failed to close database: ${error}`);
    }
  }
}