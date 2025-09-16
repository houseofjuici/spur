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

export class GraphDatabase {
  private db: Database.Database;
  private config: GraphDatabaseConfig;
  private isInitialized = false;

  constructor(config: GraphDatabaseConfig) {
    this.config = config;
    this.db = new Database(config.path);
    
    // Configure database settings
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -10000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456');
    
    // Prepare statements for better performance
    this.prepareStatements();
  }

  private prepareStatements(): void {
    // Node statements
    this.db.prepare(`
      INSERT INTO nodes (
        id, type, timestamp, content, metadata, relevance_score, decay_factor,
        degree, clustering, centrality, community, tags, embeddings, access_count,
        last_accessed, confidence, source_type, is_pruned, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run();

    this.db.prepare(`
      UPDATE nodes SET
        type = ?, timestamp = ?, content = ?, metadata = ?, relevance_score = ?,
        decay_factor = ?, degree = ?, clustering = ?, centrality = ?, community = ?,
        tags = ?, embeddings = ?, access_count = ?, last_accessed = ?, confidence = ?,
        source_type = ?, is_pruned = ?, updated_at = ?
      WHERE id = ?
    `).run();

    // Edge statements
    this.db.prepare(`
      INSERT INTO edges (
        id, source_id, target_id, type, strength, context, timestamp, metadata,
        bidirectional, weight, probability, decay_rate, is_active, interaction_count,
        last_interaction, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run();

    this.db.prepare(`
      UPDATE edges SET
        source_id = ?, target_id = ?, type = ?, strength = ?, context = ?,
        timestamp = ?, metadata = ?, bidirectional = ?, weight = ?, probability = ?,
        decay_rate = ?, is_active = ?, interaction_count = ?, last_interaction = ?,
        updated_at = ?
      WHERE id = ?
    `).run();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.path);
      await fs.mkdir(dbDir, { recursive: true });

      // Read and execute schema
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf-8');
      
      // Execute schema in transaction
      this.db.exec('BEGIN TRANSACTION');
      this.db.exec(schema);
      this.db.exec('COMMIT');

      this.isInitialized = true;
      this.logAudit('system', 'initialize', null, 'Database initialized successfully');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  // Node CRUD Operations
  async createNode(node: Omit<MemoryNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryNode> {
    const id = uuidv4();
    const now = Date.now();
    const fullNode: MemoryNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const stmt = this.db.prepare(`
        INSERT INTO nodes (
          id, type, timestamp, content, metadata, relevance_score, decay_factor,
          degree, clustering, centrality, community, tags, embeddings, access_count,
          last_accessed, confidence, source_type, is_pruned, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id, node.type, node.timestamp, JSON.stringify(node.content), 
        JSON.stringify(node.metadata), node.relevanceScore, node.decayFactor,
        node.degree, node.clustering, node.centrality, node.community,
        JSON.stringify(node.tags), node.embeddings, node.accessCount,
        node.lastAccessed, node.confidence, node.sourceType, node.isPruned ? 1 : 0,
        now, now
      );

      // Add tags to node_tags table
      for (const tag of node.tags) {
        this.addTag(id, tag);
      }

      this.logAudit('create', 'node', id, 'Node created successfully');
      return fullNode;
    } catch (error) {
      throw new Error(`Failed to create node: ${error}`);
    }
  }

  async getNode(id: string): Promise<MemoryNode | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
      const row = stmt.get(id) as any;
      
      if (!row) return null;

      return this.rowToNode(row);
    } catch (error) {
      throw new Error(`Failed to get node: ${error}`);
    }
  }

  async updateNode(id: string, updates: Partial<MemoryNode>): Promise<MemoryNode | null> {
    try {
      const existing = await this.getNode(id);
      if (!existing) return null;

      const updated = { ...existing, ...updates, updatedAt: Date.now() };
      
      const stmt = this.db.prepare(`
        UPDATE nodes SET
          type = ?, timestamp = ?, content = ?, metadata = ?, relevance_score = ?,
          decay_factor = ?, degree = ?, clustering = ?, centrality = ?, community = ?,
          tags = ?, embeddings = ?, access_count = ?, last_accessed = ?, confidence = ?,
          source_type = ?, is_pruned = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        updated.type, updated.timestamp, JSON.stringify(updated.content),
        JSON.stringify(updated.metadata), updated.relevanceScore, updated.decayFactor,
        updated.degree, updated.clustering, updated.centrality, updated.community,
        JSON.stringify(updated.tags), updated.embeddings, updated.accessCount,
        updated.lastAccessed, updated.confidence, updated.sourceType, updated.isPruned ? 1 : 0,
        updated.updatedAt, id
      );

      // Update tags
      await this.updateNodeTags(id, updated.tags);

      this.logAudit('update', 'node', id, 'Node updated successfully');
      return updated;
    } catch (error) {
      throw new Error(`Failed to update node: ${error}`);
    }
  }

  async deleteNode(id: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM nodes WHERE id = ?');
      const result = stmt.run(id);
      
      if (result.changes > 0) {
        this.logAudit('delete', 'node', id, 'Node deleted successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      throw new Error(`Failed to delete node: ${error}`);
    }
  }

  // Edge CRUD Operations
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

    try {
      const stmt = this.db.prepare(`
        INSERT INTO edges (
          id, source_id, target_id, type, strength, context, timestamp, metadata,
          bidirectional, weight, probability, decay_rate, is_active, interaction_count,
          last_interaction, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id, sourceId, targetId, edge.type, edge.strength, edge.context,
        edge.timestamp, edge.metadata ? JSON.stringify(edge.metadata) : null,
        edge.bidirectional ? 1 : 0, edge.weight, edge.probability, edge.decayRate,
        edge.isActive ? 1 : 0, edge.interactionCount, edge.lastInteraction,
        now, now
      );

      this.logAudit('create', 'edge', id, 'Edge created successfully');
      return fullEdge;
    } catch (error) {
      throw new Error(`Failed to create edge: ${error}`);
    }
  }

  async getEdge(id: string): Promise<MemoryEdge | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM edges WHERE id = ?');
      const row = stmt.get(id) as any;
      
      if (!row) return null;

      return this.rowToEdge(row);
    } catch (error) {
      throw new Error(`Failed to get edge: ${error}`);
    }
  }

  async updateEdge(id: string, updates: Partial<MemoryEdge>): Promise<MemoryEdge | null> {
    try {
      const existing = await this.getEdge(id);
      if (!existing) return null;

      const updated = { ...existing, ...updates, updatedAt: Date.now() };
      
      const stmt = this.db.prepare(`
        UPDATE edges SET
          source_id = ?, target_id = ?, type = ?, strength = ?, context = ?,
          timestamp = ?, metadata = ?, bidirectional = ?, weight = ?, probability = ?,
          decay_rate = ?, is_active = ?, interaction_count = ?, last_interaction = ?,
          updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        updated.sourceId, updated.targetId, updated.type, updated.strength,
        updated.context, updated.timestamp, 
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        updated.bidirectional ? 1 : 0, updated.weight, updated.probability,
        updated.decayRate, updated.isActive ? 1 : 0, updated.interactionCount,
        updated.lastInteraction, updated.updatedAt, id
      );

      this.logAudit('update', 'edge', id, 'Edge updated successfully');
      return updated;
    } catch (error) {
      throw new Error(`Failed to update edge: ${error}`);
    }
  }

  async deleteEdge(id: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM edges WHERE id = ?');
      const result = stmt.run(id);
      
      if (result.changes > 0) {
        this.logAudit('delete', 'edge', id, 'Edge deleted successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      throw new Error(`Failed to delete edge: ${error}`);
    }
  }

  // Query Operations
  async queryNodes(query: GraphQuery): Promise<GraphQueryResult<MemoryNode>> {
    const startTime = Date.now();
    
    try {
      // Build SQL query from GraphQuery
      const { sql, params } = this.buildNodeQuery(query);
      
      // Execute query
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as any[];
      
      // Convert rows to nodes
      const nodes = rows.map(row => this.rowToNode(row));
      
      // Get total count
      const countStmt = this.db.prepare(this.buildCountQuery(sql));
      const total = countStmt.get(...params).count as number;
      
      const result: GraphQueryResult<MemoryNode> = {
        query,
        results: nodes,
        total,
        executionTime: Date.now() - startTime,
        metadata: {
          nodesScanned: rows.length,
          edgesScanned: 0,
          relevanceScores: nodes.map(n => n.relevanceScore),
          semanticMatches: 0,
        }
      };

      this.logAudit('query', 'node', null, `Query executed successfully, returned ${nodes.length} nodes`);
      return result;
    } catch (error) {
      throw new Error(`Failed to query nodes: ${error}`);
    }
  }

  async queryEdges(query: GraphQuery): Promise<GraphQueryResult<MemoryEdge>> {
    const startTime = Date.now();
    
    try {
      const { sql, params } = this.buildEdgeQuery(query);
      
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as any[];
      
      const edges = rows.map(row => this.rowToEdge(row));
      
      const countStmt = this.db.prepare(this.buildCountQuery(sql));
      const total = countStmt.get(...params).count as number;
      
      const result: GraphQueryResult<MemoryEdge> = {
        query,
        results: edges,
        total,
        executionTime: Date.now() - startTime,
        metadata: {
          nodesScanned: 0,
          edgesScanned: rows.length,
          relevanceScores: [],
          semanticMatches: 0,
        }
      };

      this.logAudit('query', 'edge', null, `Query executed successfully, returned ${edges.length} edges`);
      return result;
    } catch (error) {
      throw new Error(`Failed to query edges: ${error}`);
    }
  }

  // Batch Operations
  async batchOperations(operations: BatchOperation[]): Promise<GraphOperationResult> {
    const startTime = Date.now();
    let affectedNodes = 0;
    let affectedEdges = 0;
    
    try {
      this.db.exec('BEGIN TRANSACTION');
      
      for (const operation of operations) {
        switch (operation.type) {
          case 'create':
            if (operation.target === 'node') {
              await this.createNode(operation.data);
              affectedNodes++;
            } else {
              const { sourceId, targetId, ...edgeData } = operation.data;
              await this.createEdge(edgeData, sourceId, targetId);
              affectedEdges++;
            }
            break;
          case 'update':
            if (operation.target === 'node') {
              await this.updateNode(operation.data.id, operation.data);
              affectedNodes++;
            } else {
              await this.updateEdge(operation.data.id, operation.data);
              affectedEdges++;
            }
            break;
          case 'delete':
            if (operation.target === 'node') {
              await this.deleteNode(operation.data);
              affectedNodes++;
            } else {
              await this.deleteEdge(operation.data);
              affectedEdges++;
            }
            break;
        }
      }
      
      this.db.exec('COMMIT');
      
      return {
        success: true,
        affectedNodes,
        affectedEdges,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.db.exec('ROLLBACK');
      return {
        success: false,
        affectedNodes,
        affectedEdges,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Statistics and Maintenance
  async getStats(): Promise<GraphStats> {
    try {
      const stats = this.db.prepare('SELECT * FROM graph_stats WHERE id = 1').get() as any;
      
      return {
        totalNodes: stats.total_nodes,
        totalEdges: stats.total_edges,
        activeNodes: stats.active_nodes,
        activeEdges: stats.active_edges,
        averageDegree: stats.average_degree,
        memoryUsage: stats.memory_usage,
        lastUpdate: stats.last_update,
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error}`);
    }
  }

  async updateStats(): Promise<void> {
    try {
      const nodeCount = this.db.prepare('SELECT COUNT(*) as count FROM nodes').get() as any;
      const edgeCount = this.db.prepare('SELECT COUNT(*) as count FROM edges').get() as any;
      const activeNodes = this.db.prepare('SELECT COUNT(*) as count FROM nodes WHERE is_pruned = 0').get() as any;
      const activeEdges = this.db.prepare('SELECT COUNT(*) as count FROM edges WHERE is_active = 1').get() as any;
      const avgDegree = this.db.prepare('SELECT AVG(degree) as avg FROM nodes WHERE is_pruned = 0').get() as any;
      
      const memoryUsage = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      
      this.db.prepare(`
        UPDATE graph_stats SET
          total_nodes = ?, total_edges = ?, active_nodes = ?, active_edges = ?,
          average_degree = ?, last_update = ?, memory_usage = ?
        WHERE id = 1
      `).run(
        nodeCount.count, edgeCount.count, activeNodes.count, activeEdges.count,
        avgDegree.avg || 0, Date.now(), memoryUsage
      );
    } catch (error) {
      throw new Error(`Failed to update stats: ${error}`);
    }
  }

  // Helper Methods
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

  private buildNodeQuery(query: GraphQuery): { sql: string; params: any[] } {
    let sql = 'SELECT * FROM nodes WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    for (const filter of query.filters) {
      sql += ` AND ${this.buildFilterCondition('nodes', filter)}`;
      params.push(...this.getFilterParams(filter));
    }

    // Apply constraints
    for (const constraint of query.constraints) {
      sql += ` AND ${this.buildConstraintCondition('nodes', constraint)}`;
      params.push(...this.getConstraintParams(constraint));
    }

    // Apply sorting
    if (query.sortBy && query.sortBy.length > 0) {
      sql += ' ORDER BY ' + query.sortBy.map(sort => 
        `${sort.field} ${sort.direction.toUpperCase()}`
      ).join(', ');
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

  private buildEdgeQuery(query: GraphQuery): { sql: string; params: any[] } {
    let sql = 'SELECT * FROM edges WHERE 1=1';
    const params: any[] = [];

    for (const filter of query.filters) {
      sql += ` AND ${this.buildFilterCondition('edges', filter)}`;
      params.push(...this.getFilterParams(filter));
    }

    for (const constraint of query.constraints) {
      sql += ` AND ${this.buildConstraintCondition('edges', constraint)}`;
      params.push(...this.getConstraintParams(constraint));
    }

    if (query.sortBy && query.sortBy.length > 0) {
      sql += ' ORDER BY ' + query.sortBy.map(sort => 
        `${sort.field} ${sort.direction.toUpperCase()}`
      ).join(', ');
    }

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

  private buildFilterCondition(table: string, filter: QueryFilter): string {
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
      default: return '1=1';
    }
  }

  private buildConstraintCondition(table: string, constraint: QueryConstraint): string {
    // Simplified constraint handling - expand based on needs
    switch (constraint.type) {
      case 'temporal':
        return 'timestamp BETWEEN ? AND ?';
      case 'semantic':
        return 'tags LIKE ?'; // Simplified - implement proper semantic search
      case 'structural':
        return 'degree > ?'; // Simplified structural constraint
      default:
        return '1=1';
    }
  }

  private getFilterParams(filter: QueryFilter): any[] {
    switch (filter.operator) {
      case 'in':
      case 'nin':
        return filter.value;
      case 'contains':
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
        return [`%${constraint.params.keyword}%`];
      case 'structural':
        return [constraint.params.minDegree];
      default:
        return [];
    }
  }

  private buildCountQuery(sql: string): string {
    return `SELECT COUNT(*) as count FROM (${sql.replace(/SELECT.*FROM/, 'SELECT 1 FROM')})`;
  }

  private addTag(nodeId: string, tag: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO node_tags (node_id, tag, weight) VALUES (?, ?, 1.0)
    `);
    stmt.run(nodeId, tag);
  }

  private async updateNodeTags(nodeId: string, tags: string[]): Promise<void> {
    // Delete existing tags
    const deleteStmt = this.db.prepare('DELETE FROM node_tags WHERE node_id = ?');
    deleteStmt.run(nodeId);
    
    // Add new tags
    for (const tag of tags) {
      this.addTag(nodeId, tag);
    }
  }

  private logAudit(action: string, targetType: string, targetId: string | null, details: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_log (id, action, target_type, target_id, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        uuidv4(),
        action,
        targetType,
        targetId,
        details,
        Date.now()
      );
    } catch (error) {
      // Don't throw on audit logging errors
      console.error('Failed to log audit:', error);
    }
  }

  // Cleanup
  async close(): Promise<void> {
    try {
      this.db.close();
    } catch (error) {
      throw new Error(`Failed to close database: ${error}`);
    }
  }

  async vacuum(): Promise<void> {
    try {
      this.db.exec('VACUUM');
      this.logAudit('system', 'vacuum', null, 'Database vacuumed successfully');
    } catch (error) {
      throw new Error(`Failed to vacuum database: ${error}`);
    }
  }

  async backup(backupPath: string): Promise<void> {
    try {
      const backupDb = new Database(backupPath);
      this.db.backup(backupDb);
      backupDb.close();
      this.logAudit('system', 'backup', null, `Database backed up to ${backupPath}`);
    } catch (error) {
      throw new Error(`Failed to backup database: ${error}`);
    }
  }
}