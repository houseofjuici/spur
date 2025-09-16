import { MemoryNode, MemoryEdge, PruningConfig } from './types';
import { GraphDatabase } from './database';
import { NodeType, EdgeType } from '@/types';

export class GraphPruningEngine {
  private config: PruningConfig;
  private db: GraphDatabase;
  private pruningHistory: Map<string, PruningHistory> = new Map();
  private lastPruningTime: number = 0;

  constructor(config: PruningConfig, db: GraphDatabase) {
    this.config = config;
    this.db = db;
    this.lastPruningTime = Date.now();
  }

  /**
   * Execute graph pruning
   */
  async pruneGraph(force: boolean = false): Promise<PruningResult> {
    if (!this.config.enabled) {
      return {
        nodesPruned: 0,
        edgesPruned: 0,
        clustersRemoved: 0,
        patternsRemoved: 0,
        executionTime: 0,
        memorySaved: 0,
        nodesProcessed: 0,
        edgesProcessed: 0
      };
    }

    const now = Date.now();
    
    // Check if pruning should run
    if (!force && (now - this.lastPruningTime) < this.config.frequency) {
      return {
        nodesPruned: 0,
        edgesPruned: 0,
        clustersRemoved: 0,
        patternsRemoved: 0,
        executionTime: 0,
        memorySaved: 0,
        nodesProcessed: 0,
        edgesProcessed: 0
      };
    }

    const startTime = Date.now();
    const result: PruningResult = {
      nodesPruned: 0,
      edgesPruned: 0,
      clustersRemoved: 0,
      patternsRemoved: 0,
      executionTime: 0,
      memorySaved: 0,
      nodesProcessed: 0,
      edgesProcessed: 0
    };

    try {
      // Get graph statistics before pruning
      const beforeStats = await this.getGraphStats();

      // Prune low-relevance nodes
      const nodeResult = await this.pruneNodes();
      result.nodesPruned = nodeResult.pruned;
      result.nodesProcessed = nodeResult.processed;

      // Prune weak edges
      const edgeResult = await this.pruneEdges();
      result.edgesPruned = edgeResult.pruned;
      result.edgesProcessed = edgeResult.processed;

      // Prune clusters with low density
      const clusterResult = await this.pruneClusters();
      result.clustersRemoved = clusterResult.removed;

      // Prune patterns with low confidence
      const patternResult = await this.prunePatterns();
      result.patternsRemoved = patternResult.removed;

      // Clean up orphaned data
      await this.cleanupOrphanedData();

      // Get graph statistics after pruning
      const afterStats = await this.getGraphStats();

      // Calculate memory saved (estimate)
      result.memorySaved = this.estimateMemorySaved(beforeStats, afterStats);

      // Update pruning history
      this.updatePruningHistory(result);
      this.lastPruningTime = now;

      result.executionTime = Date.now() - startTime;

      console.log(`Graph pruning completed: ${result.nodesPruned} nodes, ${result.edgesPruned} edges removed`);
      return result;
    } catch (error) {
      console.error('Graph pruning failed:', error);
      throw error;
    }
  }

  /**
   * Prune nodes based on relevance and age
   */
  private async pruneNodes(): Promise<{ processed: number; pruned: number }> {
    let processed = 0;
    let pruned = 0;

    try {
      // Get candidates for pruning
      const candidates = await this.getNodePruningCandidates();
      processed = candidates.length;

      // Process in batches
      for (let i = 0; i < candidates.length; i += this.config.batchSize) {
        const batch = candidates.slice(i, i + this.config.batchSize);
        
        for (const node of batch) {
          if (this.shouldPruneNode(node)) {
            await this.pruneNode(node);
            pruned++;
          }
        }
      }
    } catch (error) {
      console.error('Node pruning failed:', error);
    }

    return { processed, pruned };
  }

  /**
   * Prune edges based on strength and connectivity
   */
  private async pruneEdges(): Promise<{ processed: number; pruned: number }> {
    let processed = 0;
    let pruned = 0;

    try {
      // Get candidates for pruning
      const candidates = await this.getEdgePruningCandidates();
      processed = candidates.length;

      // Process in batches
      for (let i = 0; i < candidates.length; i += this.config.batchSize) {
        const batch = candidates.slice(i, i + this.config.batchSize);
        
        for (const edge of batch) {
          if (this.shouldPruneEdge(edge)) {
            await this.pruneEdge(edge);
            pruned++;
          }
        }
      }
    } catch (error) {
      console.error('Edge pruning failed:', error);
    }

    return { processed, pruned };
  }

  /**
   * Prune temporal clusters with low density
   */
  private async pruneClusters(): Promise<{ removed: number }> {
    let removed = 0;

    try {
      const stmt = this.db['db'].prepare(`
        SELECT id, density, confidence, updated_at 
        FROM temporal_clusters 
        WHERE density < ? OR confidence < ? OR updated_at < ?
      `);

      const minDensity = 0.3;
      const minConfidence = 0.4;
      const maxAge = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days

      const clusters = stmt.all(minDensity, minConfidence, maxAge) as any[];
      
      for (const cluster of clusters) {
        try {
          const deleteStmt = this.db['db'].prepare('DELETE FROM temporal_clusters WHERE id = ?');
          deleteStmt.run(cluster.id);
          removed++;
        } catch (error) {
          console.error(`Failed to prune cluster ${cluster.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Cluster pruning failed:', error);
    }

    return { removed };
  }

  /**
   * Prune patterns with low confidence or frequency
   */
  private async prunePatterns(): Promise<{ removed: number }> {
    let removed = 0;

    try {
      const stmt = this.db['db'].prepare(`
        SELECT id, confidence, frequency, last_detected 
        FROM patterns 
        WHERE confidence < ? OR frequency < ? OR last_detected < ?
      `);

      const minConfidence = 0.3;
      const minFrequency = 2;
      const maxAge = Date.now() - (60 * 24 * 60 * 60 * 1000); // 60 days

      const patterns = stmt.all(minConfidence, minFrequency, maxAge) as any[];
      
      for (const pattern of patterns) {
        try {
          // Delete pattern instances first
          const deleteInstancesStmt = this.db['db'].prepare('DELETE FROM pattern_instances WHERE pattern_id = ?');
          deleteInstancesStmt.run(pattern.id);

          // Delete pattern
          const deletePatternStmt = this.db['db'].prepare('DELETE FROM patterns WHERE id = ?');
          deletePatternStmt.run(pattern.id);
          removed++;
        } catch (error) {
          console.error(`Failed to prune pattern ${pattern.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Pattern pruning failed:', error);
    }

    return { removed };
  }

  /**
   * Get node candidates for pruning
   */
  private async getNodePruningCandidates(): Promise<MemoryNode[]> {
    try {
      const query = {
        id: 'pruning-candidates',
        type: 'node' as const,
        filters: [
          { field: 'is_pruned', operator: 'eq', value: false },
          { field: 'relevance_score', operator: 'lt', value: this.config.threshold }
        ],
        constraints: [],
        limit: 5000,
        sortBy: [{ field: 'relevance_score', direction: 'asc' as const }]
      };

      const result = await this.db.queryNodes(query);
      return result.results;
    } catch (error) {
      console.error('Failed to get node pruning candidates:', error);
      return [];
    }
  }

  /**
   * Get edge candidates for pruning
   */
  private async getEdgePruningCandidates(): Promise<MemoryEdge[]> {
    try {
      const query = {
        id: 'edge-pruning-candidates',
        type: 'edge' as const,
        filters: [
          { field: 'is_active', operator: 'eq', value: true },
          { field: 'strength', operator: 'lt', value: this.config.threshold }
        ],
        constraints: [],
        limit: 10000,
        sortBy: [{ field: 'strength', direction: 'asc' as const }]
      };

      const result = await this.db.queryEdges(query);
      return result.results;
    } catch (error) {
      console.error('Failed to get edge pruning candidates:', error);
      return [];
    }
  }

  /**
   * Determine if a node should be pruned
   */
  private shouldPruneNode(node: MemoryNode): boolean {
    const now = Date.now();
    
    // Check if node exceeds maximum age
    if (this.config.maxNodeAge > 0 && (now - node.createdAt) > this.config.maxNodeAge) {
      return true;
    }

    // Check relevance threshold
    if (node.relevanceScore >= this.config.threshold) {
      return false;
    }

    // Check if node is important (high centrality or part of important structures)
    if (this.config.preserveImportant && this.isImportantNode(node)) {
      return false;
    }

    // Check if node was recently accessed
    const recentAccessThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    if ((now - node.lastAccessed) < recentAccessThreshold) {
      return false;
    }

    // Check if node has many connections (high degree)
    if (node.degree > this.config.maxEdgesPerNode * 0.8) {
      return false;
    }

    return true;
  }

  /**
   * Determine if an edge should be pruned
   */
  private shouldPruneEdge(edge: MemoryEdge): Promise<boolean> {
    const now = Date.now();
    
    // Check strength threshold
    if (edge.strength >= this.config.threshold) {
      return Promise.resolve(false);
    }

    // Check if edge was recently interacted with
    const recentInteractionThreshold = 14 * 24 * 60 * 60 * 1000; // 14 days
    if ((now - edge.lastInteraction) < recentInteractionThreshold) {
      return Promise.resolve(false);
    }

    // Check if edge is part of important structures
    if (this.config.preserveImportant && this.isImportantEdge(edge)) {
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  /**
   * Check if node is important and should be preserved
   */
  private async isImportantNode(node: MemoryNode): Promise<boolean> {
    try {
      // High centrality nodes
      if (node.centrality > 0.7) {
        return true;
      }

      // High degree nodes (hubs)
      if (node.degree > this.config.maxEdgesPerNode) {
        return true;
      }

      // Nodes in important communities
      if (node.community && await this.isImportantCommunity(node.community)) {
        return true;
      }

      // Recent nodes with high interaction
      const recentThreshold = 24 * 60 * 60 * 1000; // 24 hours
      if ((Date.now() - node.createdAt) < recentThreshold && node.accessCount > 5) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check node importance:', error);
      return false;
    }
  }

  /**
   * Check if edge is important and should be preserved
   */
  private async isImportantEdge(edge: MemoryEdge): Promise<boolean> {
    try {
      // Strong edges
      if (edge.strength > 0.8) {
        return true;
      }

      // Highly interacted edges
      if (edge.interactionCount > 10) {
        return true;
      }

      // Edges between important nodes
      const sourceNode = await this.db.getNode(edge.sourceId);
      const targetNode = await this.db.getNode(edge.targetId);
      
      if (sourceNode && targetNode) {
        const sourceImportant = await this.isImportantNode(sourceNode);
        const targetImportant = await this.isImportantNode(targetNode);
        
        if (sourceImportant && targetImportant) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to check edge importance:', error);
      return false;
    }
  }

  /**
   * Check if community is important
   */
  private async isImportantCommunity(communityId: string): Promise<boolean> {
    try {
      const stmt = this.db['db'].prepare(`
        SELECT size, density, dominant_type FROM communities WHERE id = ?
      `);
      
      const community = stmt.get(communityId) as any;
      
      if (!community) {
        return false;
      }

      // Large communities
      if (community.size > 20) {
        return true;
      }

      // Dense communities
      if (community.density > 0.6) {
        return true;
      }

      // Communities with important node types
      const importantTypes = [NodeType.PROJECT, NodeType.WORKFLOW, NodeType.PATTERN];
      if (importantTypes.includes(community.dominant_type)) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check community importance:', error);
      return false;
    }
  }

  /**
   * Prune a single node
   */
  private async pruneNode(node: MemoryNode): Promise<void> {
    try {
      // Mark node as pruned
      await this.db.updateNode(node.id, {
        isPruned: true,
        relevanceScore: 0
      });

      // Prune connected edges
      await this.pruneConnectedEdges(node.id);
    } catch (error) {
      console.error(`Failed to prune node ${node.id}:`, error);
    }
  }

  /**
   * Prune a single edge
   */
  private async pruneEdge(edge: MemoryEdge): Promise<void> {
    try {
      await this.db.updateEdge(edge.id, {
        isActive: false,
        strength: 0,
        weight: 0
      });
    } catch (error) {
      console.error(`Failed to prune edge ${edge.id}:`, error);
    }
  }

  /**
   * Prune edges connected to a node
   */
  private async pruneConnectedEdges(nodeId: string): Promise<void> {
    try {
      const query = {
        id: 'connected-edges-pruning',
        type: 'edge' as const,
        filters: [
          { field: 'source_id', operator: 'eq', value: nodeId },
          { field: 'is_active', operator: 'eq', value: true }
        ],
        constraints: []
      };

      const result = await this.db.queryEdges(query);
      
      for (const edge of result.results) {
        await this.pruneEdge(edge);
      }
    } catch (error) {
      console.error(`Failed to prune connected edges for node ${nodeId}:`, error);
    }
  }

  /**
   * Clean up orphaned data
   */
  private async cleanupOrphanedData(): Promise<void> {
    try {
      // Clean up orphaned node tags
      const orphanedTagsStmt = this.db['db'].prepare(`
        DELETE FROM node_tags 
        WHERE node_id IN (
          SELECT nt.node_id FROM node_tags nt
          LEFT JOIN nodes n ON nt.node_id = n.id
          WHERE n.id IS NULL OR n.is_pruned = 1
        )
      `);
      orphanedTagsStmt.run();

      // Clean up orphaned embeddings
      const orphanedEmbeddingsStmt = this.db['db'].prepare(`
        DELETE FROM embeddings 
        WHERE node_id IN (
          SELECT e.node_id FROM embeddings e
          LEFT JOIN nodes n ON e.node_id = n.id
          WHERE n.id IS NULL OR n.is_pruned = 1
        )
      `);
      orphanedEmbeddingsStmt.run();

      // Clean up old audit logs
      const oldAuditLogsStmt = this.db['db'].prepare(`
        DELETE FROM audit_log 
        WHERE timestamp < ?
      `);
      const maxAuditAge = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
      oldAuditLogsStmt.run(maxAuditAge);

      // Clean up expired query cache
      const expiredCacheStmt = this.db['db'].prepare(`
        DELETE FROM query_cache 
        WHERE expires_at < ?
      `);
      expiredCacheStmt.run(Date.now());

      console.log('Orphaned data cleanup completed');
    } catch (error) {
      console.error('Orphaned data cleanup failed:', error);
    }
  }

  /**
   * Get graph statistics
   */
  private async getGraphStats(): Promise<GraphStats> {
    try {
      const stats = this.db['db'].prepare(`
        SELECT 
          (SELECT COUNT(*) FROM nodes WHERE is_pruned = 0) as active_nodes,
          (SELECT COUNT(*) FROM nodes) as total_nodes,
          (SELECT COUNT(*) FROM edges WHERE is_active = 1) as active_edges,
          (SELECT COUNT(*) FROM edges) as total_edges,
          (SELECT COUNT(*) FROM temporal_clusters) as clusters,
          (SELECT COUNT(*) FROM patterns WHERE is_active = 1) as active_patterns,
          (SELECT COUNT(*) FROM patterns) as total_patterns
      `).get() as any;

      return {
        activeNodes: stats.active_nodes || 0,
        totalNodes: stats.total_nodes || 0,
        activeEdges: stats.active_edges || 0,
        totalEdges: stats.total_edges || 0,
        clusters: stats.clusters || 0,
        activePatterns: stats.active_patterns || 0,
        totalPatterns: stats.total_patterns || 0
      };
    } catch (error) {
      console.error('Failed to get graph stats:', error);
      return {
        activeNodes: 0,
        totalNodes: 0,
        activeEdges: 0,
        totalEdges: 0,
        clusters: 0,
        activePatterns: 0,
        totalPatterns: 0
      };
    }
  }

  /**
   * Estimate memory saved by pruning
   */
  private estimateMemorySaved(before: GraphStats, after: GraphStats): number {
    // Estimate based on node and edge count reduction
    const nodesRemoved = before.totalNodes - after.totalNodes;
    const edgesRemoved = before.totalEdges - after.totalEdges;
    
    // Estimate sizes (rough approximation)
    const avgNodeSize = 1024; // 1KB per node
    const avgEdgeSize = 256; // 256 bytes per edge
    
    return (nodesRemoved * avgNodeSize) + (edgesRemoved * avgEdgeSize);
  }

  /**
   * Update pruning history
   */
  private updatePruningHistory(result: PruningResult): void {
    const history: PruningHistory = {
      timestamp: Date.now(),
      nodesPruned: result.nodesPruned,
      edgesPruned: result.edgesPruned,
      clustersRemoved: result.clustersRemoved,
      patternsRemoved: result.patternsRemoved,
      memorySaved: result.memorySaved,
      executionTime: result.executionTime
    };

    this.pruningHistory.set(Date.now().toString(), history);

    // Keep only recent history (last 50 entries)
    const historyKeys = Array.from(this.pruningHistory.keys()).sort();
    if (historyKeys.length > 50) {
      const keysToRemove = historyKeys.slice(0, historyKeys.length - 50);
      keysToRemove.forEach(key => this.pruningHistory.delete(key));
    }
  }

  /**
   * Get pruning statistics
   */
  getPruningStats(): PruningStats {
    const now = Date.now();
    const recentHistory = Array.from(this.pruningHistory.values())
      .filter(history => now - history.timestamp < (30 * 24 * 60 * 60 * 1000)); // Last 30 days

    const totalNodesPruned = recentHistory.reduce((sum, h) => sum + h.nodesPruned, 0);
    const totalEdgesPruned = recentHistory.reduce((sum, h) => sum + h.edgesPruned, 0);
    const totalMemorySaved = recentHistory.reduce((sum, h) => sum + h.memorySaved, 0);

    return {
      totalPruningOperations: recentHistory.length,
      totalNodesPruned,
      totalEdgesPruned,
      totalClustersRemoved: recentHistory.reduce((sum, h) => sum + h.clustersRemoved, 0),
      totalPatternsRemoved: recentHistory.reduce((sum, h) => sum + h.patternsRemoved, 0),
      totalMemorySaved,
      averageExecutionTime: recentHistory.length > 0 
        ? recentHistory.reduce((sum, h) => sum + h.executionTime, 0) / recentHistory.length 
        : 0,
      lastPruningTime: this.lastPruningTime,
      nextPruningTime: this.lastPruningTime + this.config.frequency
    };
  }

  /**
   * Get pruning history
   */
  getPruningHistory(limit: number = 20): PruningHistory[] {
    return Array.from(this.pruningHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Force prune specific node
   */
  async forcePruneNode(nodeId: string): Promise<boolean> {
    try {
      const node = await this.db.getNode(nodeId);
      if (!node) {
        return false;
      }

      await this.pruneNode(node);
      return true;
    } catch (error) {
      console.error(`Failed to force prune node ${nodeId}:`, error);
      return false;
    }
  }

  /**
   * Force prune specific edge
   */
  async forcePruneEdge(edgeId: string): Promise<boolean> {
    try {
      const edge = await this.db.getEdge(edgeId);
      if (!edge) {
        return false;
      }

      await this.pruneEdge(edge);
      return true;
    } catch (error) {
      console.error(`Failed to force prune edge ${edgeId}:`, error);
      return false;
    }
  }
}

// Interfaces for graph pruning
interface PruningResult {
  nodesPruned: number;
  edgesPruned: number;
  clustersRemoved: number;
  patternsRemoved: number;
  executionTime: number;
  memorySaved: number;
  nodesProcessed: number;
  edgesProcessed: number;
}

interface PruningHistory {
  timestamp: number;
  nodesPruned: number;
  edgesPruned: number;
  clustersRemoved: number;
  patternsRemoved: number;
  memorySaved: number;
  executionTime: number;
}

interface GraphStats {
  activeNodes: number;
  totalNodes: number;
  activeEdges: number;
  totalEdges: number;
  clusters: number;
  activePatterns: number;
  totalPatterns: number;
}

interface PruningStats {
  totalPruningOperations: number;
  totalNodesPruned: number;
  totalEdgesPruned: number;
  totalClustersRemoved: number;
  totalPatternsRemoved: number;
  totalMemorySaved: number;
  averageExecutionTime: number;
  lastPruningTime: number;
  nextPruningTime: number;
}