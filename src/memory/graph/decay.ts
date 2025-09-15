import { MemoryNode, MemoryEdge, DecayConfig } from './types';
import { GraphDatabase } from './database';
import { NodeType, EdgeType } from '@/types';

export class MemoryDecayEngine {
  private config: DecayConfig;
  private db: GraphDatabase;
  private decayHistory: Map<string, DecayHistory> = new Map();
  private lastDecayTime: number = 0;

  constructor(config: DecayConfig, db: GraphDatabase) {
    this.config = config;
    this.db = db;
    this.lastDecayTime = Date.now();
  }

  /**
   * Apply memory decay to all nodes and edges
   */
  async applyDecay(force: boolean = false): Promise<DecayResult> {
    if (!this.config.enabled) {
      return {
        nodesProcessed: 0,
        edgesProcessed: 0,
        nodesPruned: 0,
        edgesPruned: 0,
        executionTime: 0,
        decayRate: 0
      };
    }

    const startTime = Date.now();
    
    // Check if decay should run (based on time interval)
    const now = Date.now();
    const timeSinceLastDecay = now - this.lastDecayTime;
    const decayInterval = this.getTimeInterval();
    
    if (!force && timeSinceLastDecay < decayInterval) {
      return {
        nodesProcessed: 0,
        edgesProcessed: 0,
        nodesPruned: 0,
        edgesPruned: 0,
        executionTime: 0,
        decayRate: 0
      };
    }

    try {
      const result: DecayResult = {
        nodesProcessed: 0,
        edgesProcessed: 0,
        nodesPruned: 0,
        edgesPruned: 0,
        executionTime: 0,
        decayRate: this.config.baseRate
      };

      // Apply decay to nodes
      const nodeResult = await this.applyNodeDecay();
      result.nodesProcessed = nodeResult.processed;
      result.nodesPruned = nodeResult.pruned;

      // Apply decay to edges
      const edgeResult = await this.applyEdgeDecay();
      result.edgesProcessed = edgeResult.processed;
      result.edgesPruned = edgeResult.pruned;

      // Update decay history
      this.updateDecayHistory(result);

      // Update last decay time
      this.lastDecayTime = now;

      result.executionTime = Date.now() - startTime;

      console.log(`Memory decay completed: ${result.nodesProcessed} nodes, ${result.edgesProcessed} edges processed`);
      return result;
    } catch (error) {
      console.error('Memory decay failed:', error);
      throw error;
    }
  }

  /**
   * Apply decay to individual node
   */
  async applyNodeDecay(nodeId: string): Promise<void> {
    try {
      const node = await this.db.getNode(nodeId);
      if (!node || node.isPruned) {
        return;
      }

      const now = Date.now();
      const timeSinceLastAccess = now - node.lastAccessed;
      const timeSinceCreation = now - node.createdAt;

      // Calculate decay factor based on configured function
      const decayFactor = this.calculateDecayFactor(timeSinceLastAccess, timeSinceCreation);
      
      // Apply access boost if recently accessed
      const accessBoost = this.calculateAccessBoost(node);
      
      // Calculate new relevance score
      const currentScore = node.relevanceScore;
      const newScore = Math.max(0, currentScore * decayFactor * accessBoost);

      // Update decay factor for node
      const newDecayFactor = this.updateNodeDecayFactor(node, decayFactor);

      // Check if node should be pruned
      const shouldPrune = newScore < this.config.minimumRelevance;

      if (shouldPrune) {
        await this.pruneNode(node);
      } else {
        await this.db.updateNode(nodeId, {
          relevanceScore: newScore,
          decayFactor: newDecayFactor,
          lastAccessed: now // Update access time for decay calculation
        });
      }
    } catch (error) {
      console.error(`Failed to apply decay to node ${nodeId}:`, error);
    }
  }

  /**
   * Apply decay to individual edge
   */
  async applyEdgeDecay(edgeId: string): Promise<void> {
    try {
      const edge = await this.db.getEdge(edgeId);
      if (!edge || !edge.isActive) {
        return;
      }

      const now = Date.now();
      const timeSinceLastInteraction = now - edge.lastInteraction;
      const timeSinceCreation = now - edge.createdAt;

      // Calculate decay factor for edge
      const decayFactor = this.calculateEdgeDecayFactor(timeSinceLastInteraction, timeSinceCreation);
      
      // Apply interaction boost
      const interactionBoost = this.calculateEdgeInteractionBoost(edge);
      
      // Calculate new strength
      const currentStrength = edge.strength;
      const newStrength = Math.max(0, currentStrength * decayFactor * interactionBoost);

      // Update decay rate for edge
      const newDecayRate = this.updateEdgeDecayRate(edge, decayFactor);

      // Check if edge should be pruned
      const shouldPrune = newStrength < this.config.minimumRelevance;

      if (shouldPrune) {
        await this.pruneEdge(edge);
      } else {
        await this.db.updateEdge(edgeId, {
          strength: newStrength,
          weight: newStrength,
          decayRate: newDecayRate,
          lastInteraction: now
        });
      }
    } catch (error) {
      console.error(`Failed to apply decay to edge ${edgeId}:`, error);
    }
  }

  /**
   * Boost node relevance when accessed
   */
  async boostNodeOnAccess(nodeId: string, boostAmount: number = this.config.accessBoost): Promise<void> {
    try {
      const node = await this.db.getNode(nodeId);
      if (!node) {
        return;
      }

      const boostedScore = Math.min(1.0, node.relevanceScore * boostAmount);
      const now = Date.now();

      await this.db.updateNode(nodeId, {
        relevanceScore: boostedScore,
        lastAccessed: now,
        accessCount: node.accessCount + 1
      });

      // Record boost in history
      this.recordNodeBoost(nodeId, boostAmount, now);
    } catch (error) {
      console.error(`Failed to boost node ${nodeId}:`, error);
    }
  }

  /**
   * Boost edge strength when interacted with
   */
  async boostEdgeOnInteraction(edgeId: string, boostAmount: number = this.config.accessBoost): Promise<void> {
    try {
      const edge = await this.db.getEdge(edgeId);
      if (!edge) {
        return;
      }

      const boostedStrength = Math.min(1.0, edge.strength * boostAmount);
      const now = Date.now();

      await this.db.updateEdge(edgeId, {
        strength: boostedStrength,
        weight: boostedStrength,
        lastInteraction: now,
        interactionCount: edge.interactionCount + 1
      });

      // Record boost in history
      this.recordEdgeBoost(edgeId, boostAmount, now);
    } catch (error) {
      console.error(`Failed to boost edge ${edgeId}:`, error);
    }
  }

  /**
   * Apply decay to nodes
   */
  private async applyNodeDecay(): Promise<{ processed: number; pruned: number }> {
    let processed = 0;
    let pruned = 0;

    try {
      // Get nodes that need decay processing
      const query = {
        id: 'decay-nodes',
        type: 'node' as const,
        filters: [
          { field: 'is_pruned', operator: 'eq', value: false },
          { field: 'relevance_score', operator: 'gt', value: this.config.minimumRelevance }
        ],
        constraints: [],
        limit: 10000
      };

      const result = await this.db.queryNodes(query);
      processed = result.results.length;

      // Process nodes in batches
      const batchSize = 100;
      for (let i = 0; i < result.results.length; i += batchSize) {
        const batch = result.results.slice(i, i + batchSize);
        
        for (const node of batch) {
          try {
            const now = Date.now();
            const timeSinceLastAccess = now - node.lastAccessed;
            const timeSinceCreation = now - node.createdAt;

            const decayFactor = this.calculateDecayFactor(timeSinceLastAccess, timeSinceCreation);
            const accessBoost = this.calculateAccessBoost(node);
            
            const currentScore = node.relevanceScore;
            const newScore = Math.max(0, currentScore * decayFactor * accessBoost);

            if (newScore < this.config.minimumRelevance) {
              await this.pruneNode(node);
              pruned++;
            } else {
              const newDecayFactor = this.updateNodeDecayFactor(node, decayFactor);
              await this.db.updateNode(node.id, {
                relevanceScore: newScore,
                decayFactor: newDecayFactor,
                lastAccessed: now
              });
            }
          } catch (error) {
            console.error(`Failed to process node ${node.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Node decay processing failed:', error);
    }

    return { processed, pruned };
  }

  /**
   * Apply decay to edges
   */
  private async applyEdgeDecay(): Promise<{ processed: number; pruned: number }> {
    let processed = 0;
    let pruned = 0;

    try {
      // Get edges that need decay processing
      const query = {
        id: 'decay-edges',
        type: 'edge' as const,
        filters: [
          { field: 'is_active', operator: 'eq', value: true },
          { field: 'strength', operator: 'gt', value: this.config.minimumRelevance }
        ],
        constraints: [],
        limit: 10000
      };

      const result = await this.db.queryEdges(query);
      processed = result.results.length;

      // Process edges in batches
      const batchSize = 100;
      for (let i = 0; i < result.results.length; i += batchSize) {
        const batch = result.results.slice(i, i + batchSize);
        
        for (const edge of batch) {
          try {
            const now = Date.now();
            const timeSinceLastInteraction = now - edge.lastInteraction;
            const timeSinceCreation = now - edge.createdAt;

            const decayFactor = this.calculateEdgeDecayFactor(timeSinceLastInteraction, timeSinceCreation);
            const interactionBoost = this.calculateEdgeInteractionBoost(edge);
            
            const currentStrength = edge.strength;
            const newStrength = Math.max(0, currentStrength * decayFactor * interactionBoost);

            if (newStrength < this.config.minimumRelevance) {
              await this.pruneEdge(edge);
              pruned++;
            } else {
              const newDecayRate = this.updateEdgeDecayRate(edge, decayFactor);
              await this.db.updateEdge(edge.id, {
                strength: newStrength,
                weight: newStrength,
                decayRate: newDecayRate,
                lastInteraction: now
              });
            }
          } catch (error) {
            console.error(`Failed to process edge ${edge.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Edge decay processing failed:', error);
    }

    return { processed, pruned };
  }

  /**
   * Calculate decay factor based on configured function
   */
  private calculateDecayFactor(timeSinceLastAccess: number, timeSinceCreation: number): number {
    const timeUnit = this.getTimeUnitInMilliseconds();
    const timeUnitsSinceAccess = timeSinceLastAccess / timeUnit;
    
    switch (this.config.decayFunction) {
      case 'exponential':
        return Math.exp(-this.config.baseRate * timeUnitsSinceAccess);
      
      case 'linear':
        return Math.max(0, 1 - (this.config.baseRate * timeUnitsSinceAccess));
      
      case 'logarithmic':
        return Math.max(0, 1 - Math.log(1 + this.config.baseRate * timeUnitsSinceAccess) / Math.log(10));
      
      default:
        return Math.exp(-this.config.baseRate * timeUnitsSinceAccess);
    }
  }

  /**
   * Calculate edge decay factor
   */
  private calculateEdgeDecayFactor(timeSinceLastInteraction: number, timeSinceCreation: number): number {
    const timeUnit = this.getTimeUnitInMilliseconds();
    const timeUnitsSinceInteraction = timeSinceLastInteraction / timeUnit;
    
    // Edges decay faster than nodes
    const edgeDecayRate = this.config.baseRate * 1.5;
    
    return Math.exp(-edgeDecayRate * timeUnitsSinceInteraction);
  }

  /**
   * Calculate access boost for node
   */
  private calculateAccessBoost(node: MemoryNode): number {
    const now = Date.now();
    const timeSinceLastAccess = now - node.lastAccessed;
    const recentThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    if (timeSinceLastAccess < recentThreshold) {
      return this.config.accessBoost;
    }
    
    // Gradual decrease in boost
    const hoursSinceAccess = timeSinceLastAccess / (60 * 60 * 1000);
    const boostReduction = Math.min(1, hoursSinceAccess / 24); // Reduce over 24 hours
    return 1 + (this.config.accessBoost - 1) * (1 - boostReduction);
  }

  /**
   * Calculate interaction boost for edge
   */
  private calculateEdgeInteractionBoost(edge: MemoryEdge): number {
    const now = Date.now();
    const timeSinceLastInteraction = now - edge.lastInteraction;
    const recentThreshold = 12 * 60 * 60 * 1000; // 12 hours
    
    if (timeSinceLastInteraction < recentThreshold) {
      return this.config.accessBoost * 0.8; // Slightly less boost than nodes
    }
    
    const hoursSinceInteraction = timeSinceLastInteraction / (60 * 60 * 1000);
    const boostReduction = Math.min(1, hoursSinceInteraction / 12);
    return 1 + (this.config.accessBoost - 1) * 0.8 * (1 - boostReduction);
  }

  /**
   * Update node decay factor
   */
  private updateNodeDecayFactor(node: MemoryNode, decayFactor: number): number {
    // Adaptive decay factor based on usage patterns
    const accessFrequency = node.accessCount / Math.max(1, (Date.now() - node.createdAt) / (24 * 60 * 60 * 1000));
    
    // Nodes accessed more frequently decay slower
    const frequencyAdjustment = Math.max(0.5, 1 - accessFrequency * 0.1);
    
    return node.decayFactor * frequencyAdjustment;
  }

  /**
   * Update edge decay rate
   */
  private updateEdgeDecayRate(edge: MemoryEdge, decayFactor: number): number {
    const interactionFrequency = edge.interactionCount / Math.max(1, (Date.now() - edge.createdAt) / (24 * 60 * 60 * 1000));
    
    const frequencyAdjustment = Math.max(0.5, 1 - interactionFrequency * 0.15);
    
    return edge.decayRate * frequencyAdjustment;
  }

  /**
   * Prune a node (mark as pruned but keep in database)
   */
  private async pruneNode(node: MemoryNode): Promise<void> {
    try {
      await this.db.updateNode(node.id, {
        isPruned: true,
        relevanceScore: 0,
        decayFactor: 1.0
      });

      // Also prune connected edges
      await this.pruneConnectedEdges(node.id);

      console.log(`Pruned node ${node.id} due to low relevance`);
    } catch (error) {
      console.error(`Failed to prune node ${node.id}:`, error);
    }
  }

  /**
   * Prune an edge
   */
  private async pruneEdge(edge: MemoryEdge): Promise<void> {
    try {
      await this.db.updateEdge(edge.id, {
        isActive: false,
        strength: 0,
        weight: 0
      });

      console.log(`Pruned edge ${edge.id} due to low strength`);
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
        id: 'connected-edges',
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
   * Get time interval in milliseconds
   */
  private getTimeInterval(): number {
    switch (this.config.timeUnit) {
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000; // Default to day
    }
  }

  /**
   * Get time unit in milliseconds
   */
  private getTimeUnitInMilliseconds(): number {
    return this.getTimeInterval();
  }

  /**
   * Update decay history
   */
  private updateDecayHistory(result: DecayResult): void {
    const history: DecayHistory = {
      timestamp: Date.now(),
      nodesProcessed: result.nodesProcessed,
      edgesProcessed: result.edgesProcessed,
      nodesPruned: result.nodesPruned,
      edgesPruned: result.edgesPruned,
      decayRate: result.decayRate
    };

    this.decayHistory.set(Date.now().toString(), history);

    // Keep only recent history (last 100 entries)
    const historyKeys = Array.from(this.decayHistory.keys()).sort();
    if (historyKeys.length > 100) {
      const keysToRemove = historyKeys.slice(0, historyKeys.length - 100);
      keysToRemove.forEach(key => this.decayHistory.delete(key));
    }
  }

  /**
   * Record node boost in history
   */
  private recordNodeBoost(nodeId: string, boostAmount: number, timestamp: number): void {
    const key = `node_boost_${nodeId}`;
    if (!this.decayHistory.has(key)) {
      this.decayHistory.set(key, { boosts: [] });
    }
    
    const history = this.decayHistory.get(key)!;
    history.boosts.push({ timestamp, amount: boostAmount });
    
    // Keep only recent boosts (last 50)
    if (history.boosts.length > 50) {
      history.boosts = history.boosts.slice(-50);
    }
  }

  /**
   * Record edge boost in history
   */
  private recordEdgeBoost(edgeId: string, boostAmount: number, timestamp: number): void {
    const key = `edge_boost_${edgeId}`;
    if (!this.decayHistory.has(key)) {
      this.decayHistory.set(key, { boosts: [] });
    }
    
    const history = this.decayHistory.get(key)!;
    history.boosts.push({ timestamp, amount: boostAmount });
    
    // Keep only recent boosts (last 50)
    if (history.boosts.length > 50) {
      history.boosts = history.boosts.slice(-50);
    }
  }

  /**
   * Get decay statistics
   */
  getDecayStats(): DecayStats {
    const now = Date.now();
    const recentHistory = Array.from(this.decayHistory.values())
      .filter(history => now - history.timestamp < (7 * 24 * 60 * 60 * 1000)); // Last 7 days

    const totalNodesProcessed = recentHistory.reduce((sum, h) => sum + h.nodesProcessed, 0);
    const totalEdgesProcessed = recentHistory.reduce((sum, h) => sum + h.edgesProcessed, 0);
    const totalNodesPruned = recentHistory.reduce((sum, h) => sum + h.nodesPruned, 0);
    const totalEdgesPruned = recentHistory.reduce((sum, h) => sum + h.edgesPruned, 0);

    return {
      totalDecayOperations: recentHistory.length,
      totalNodesProcessed,
      totalEdgesProcessed,
      totalNodesPruned,
      totalEdgesPruned,
      averageDecayRate: recentHistory.length > 0 
        ? recentHistory.reduce((sum, h) => sum + h.decayRate, 0) / recentHistory.length 
        : 0,
      lastDecayTime: this.lastDecayTime,
      nextDecayTime: this.lastDecayTime + this.getTimeInterval()
    };
  }

  /**
   * Get decay history
   */
  getDecayHistory(limit: number = 50): DecayHistory[] {
    return Array.from(this.decayHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Reset decay for testing or recovery
   */
  async resetDecay(): Promise<void> {
    try {
      // Reset all node relevance scores and decay factors
      const query = {
        id: 'reset-nodes',
        type: 'node' as const,
        filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
        constraints: [],
        limit: 10000
      };

      const result = await this.db.queryNodes(query);
      
      for (const node of result.results) {
        await this.db.updateNode(node.id, {
          relevanceScore: 1.0,
          decayFactor: this.config.baseRate,
          lastAccessed: Date.now()
        });
      }

      // Reset all edge strengths and decay rates
      const edgeQuery = {
        id: 'reset-edges',
        type: 'edge' as const,
        filters: [{ field: 'is_active', operator: 'eq', value: true }],
        constraints: [],
        limit: 10000
      };

      const edgeResult = await this.db.queryEdges(edgeQuery);
      
      for (const edge of edgeResult.results) {
        await this.db.updateEdge(edge.id, {
          strength: 1.0,
          weight: 1.0,
          decayRate: this.config.baseRate,
          lastInteraction: Date.now()
        });
      }

      // Clear history
      this.decayHistory.clear();
      this.lastDecayTime = Date.now();

      console.log('Memory decay reset completed');
    } catch (error) {
      console.error('Memory decay reset failed:', error);
      throw error;
    }
  }
}

// Interfaces for memory decay
interface DecayResult {
  nodesProcessed: number;
  edgesProcessed: number;
  nodesPruned: number;
  edgesPruned: number;
  executionTime: number;
  decayRate: number;
}

interface DecayHistory {
  timestamp: number;
  nodesProcessed: number;
  edgesProcessed: number;
  nodesPruned: number;
  edgesPruned: number;
  decayRate: number;
  boosts?: Array<{ timestamp: number; amount: number }>;
}

interface DecayStats {
  totalDecayOperations: number;
  totalNodesProcessed: number;
  totalEdgesProcessed: number;
  totalNodesPruned: number;
  totalEdgesPruned: number;
  averageDecayRate: number;
  lastDecayTime: number;
  nextDecayTime: number;
}