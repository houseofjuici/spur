import { MemoryNode, MemoryEdge } from './types';
import { GraphDatabase } from './database';
import { NodeType, EdgeType } from '@/types';

export interface RelevanceConfig {
  recencyWeight: number; // Weight for recency factor (0-1)
  frequencyWeight: number; // Weight for frequency factor (0-1)
  interactionWeight: number; // Weight for user interaction factor (0-1)
  semanticWeight: number; // Weight for semantic relevance (0-1)
  centralityWeight: number; // Weight for graph centrality (0-1)
  
  timeDecayRate: number; // Decay rate for time-based relevance (0-1)
  interactionBoost: number; // Boost factor for user interactions (1+)
  semanticThreshold: number; // Minimum semantic similarity for relevance (0-1)
  
  // Type-specific weights
  typeWeights: Record<NodeType, number>;
  
  // Edge relevance factors
  edgeRecencyWeight: number;
  edgeStrengthWeight: number;
  edgeInteractionWeight: number;
}

export class RelevanceScoringEngine {
  private config: RelevanceConfig;
  private db: GraphDatabase;
  private userInteractionHistory: Map<string, number[]> = new Map();
  private globalInteractionPatterns: Map<string, number> = new Map();

  constructor(config: RelevanceConfig, db: GraphDatabase) {
    this.config = config;
    this.db = db;
    this.initializeWeights();
  }

  /**
   * Calculate relevance score for a node
   */
  async calculateNodeRelevance(node: MemoryNode, context?: RelevanceContext): Promise<number> {
    try {
      const factors = await this.calculateRelevanceFactors(node, context);
      const score = this.combineFactors(factors);
      
      // Update node with new relevance score
      await this.db.updateNode(node.id, { relevanceScore: score });
      
      return score;
    } catch (error) {
      console.error(`Failed to calculate relevance for node ${node.id}:`, error);
      return node.relevanceScore || 0.5; // Fallback to existing score
    }
  }

  /**
   * Calculate relevance score for an edge
   */
  async calculateEdgeRelevance(edge: MemoryEdge, context?: RelevanceContext): Promise<number> {
    try {
      const factors = await this.calculateEdgeRelevanceFactors(edge, context);
      const score = this.combineEdgeFactors(factors);
      
      // Update edge with new relevance score
      await this.db.updateEdge(edge.id, { 
        strength: score,
        weight: score 
      });
      
      return score;
    } catch (error) {
      console.error(`Failed to calculate relevance for edge ${edge.id}:`, error);
      return edge.strength || 0.5;
    }
  }

  /**
   * Batch update relevance scores for multiple nodes
   */
  async batchUpdateNodeRelevance(nodeIds: string[], context?: RelevanceContext): Promise<void> {
    try {
      const batchSize = 100;
      
      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize);
        const updatePromises = batch.map(async (nodeId) => {
          const node = await this.db.getNode(nodeId);
          if (node) {
            await this.calculateNodeRelevance(node, context);
          }
        });
        
        await Promise.all(updatePromises);
      }
    } catch (error) {
      console.error('Batch relevance update failed:', error);
    }
  }

  /**
   * Record user interaction with a node
   */
  async recordUserInteraction(nodeId: string, interactionType: string, strength: number = 1.0): Promise<void> {
    try {
      const now = Date.now();
      
      // Update interaction history
      if (!this.userInteractionHistory.has(nodeId)) {
        this.userInteractionHistory.set(nodeId, []);
      }
      
      this.userInteractionHistory.get(nodeId)!.push(now);
      
      // Update global interaction patterns
      const patternKey = `${nodeId}:${interactionType}`;
      this.globalInteractionPatterns.set(patternKey, 
        (this.globalInteractionPatterns.get(patternKey) || 0) + strength
      );

      // Apply immediate boost to node relevance
      const node = await this.db.getNode(nodeId);
      if (node) {
        const boostedScore = Math.min(1.0, node.relevanceScore * this.config.interactionBoost);
        await this.db.updateNode(nodeId, { 
          relevanceScore: boostedScore,
          accessCount: node.accessCount + 1,
          lastAccessed: now
        });
      }

      // Boost connected edges
      await this.boostConnectedEdges(nodeId, strength);
    } catch (error) {
      console.error(`Failed to record interaction for node ${nodeId}:`, error);
    }
  }

  /**
   * Get most relevant nodes based on context
   */
  async getMostRelevantNodes(limit: number = 20, context?: RelevanceContext): Promise<Array<{ node: MemoryNode; score: number }>> {
    try {
      // Get candidate nodes
      const query = {
        id: 'relevant-nodes',
        type: 'node' as const,
        filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
        constraints: [],
        limit: 1000,
        sortBy: [{ field: 'relevance_score', direction: 'desc' as const }]
      };

      const result = await this.db.queryNodes(query);
      
      // Calculate relevance with context for each node
      const scoredNodes = await Promise.all(
        result.results.map(async (node) => {
          const score = await this.calculateNodeRelevance(node, context);
          return { node, score };
        })
      );

      // Sort by relevance score and return top results
      return scoredNodes
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get most relevant nodes:', error);
      return [];
    }
  }

  /**
   * Decay relevance scores over time
   */
  async applyTimeDecay(): Promise<void> {
    try {
      const now = Date.now();
      const cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago
      
      // Get nodes that haven't been accessed recently
      const query = {
        id: 'decay-candidates',
        type: 'node' as const,
        filters: [
          { field: 'last_accessed', operator: 'lt', value: cutoffTime },
          { field: 'is_pruned', operator: 'eq', value: false }
        ],
        constraints: [],
        limit: 1000
      };

      const result = await this.db.queryNodes(query);
      
      for (const node of result.results) {
        const timeSinceAccess = now - node.lastAccessed;
        const decayFactor = Math.exp(-this.config.timeDecayRate * timeSinceAccess / (24 * 60 * 60 * 1000));
        
        const newScore = node.relevanceScore * decayFactor;
        await this.db.updateNode(node.id, { relevanceScore: newScore });
      }
    } catch (error) {
      console.error('Time decay application failed:', error);
    }
  }

  /**
   * Calculate relevance factors for a node
   */
  private async calculateRelevanceFactors(node: MemoryNode, context?: RelevanceContext): Promise<RelevanceFactors> {
    const factors: RelevanceFactors = {
      recency: 0,
      frequency: 0,
      interaction: 0,
      semantic: 0,
      centrality: 0,
      typeSpecific: 0
    };

    // Recency factor
    factors.recency = this.calculateRecencyFactor(node);
    
    // Frequency factor
    factors.frequency = this.calculateFrequencyFactor(node);
    
    // Interaction factor
    factors.interaction = await this.calculateInteractionFactor(node);
    
    // Semantic factor
    factors.semantic = await this.calculateSemanticFactor(node, context);
    
    // Centrality factor
    factors.centrality = this.calculateCentralityFactor(node);
    
    // Type-specific factor
    factors.typeSpecific = this.calculateTypeSpecificFactor(node);

    return factors;
  }

  /**
   * Calculate edge relevance factors
   */
  private async calculateEdgeRelevanceFactors(edge: MemoryEdge, context?: RelevanceContext): Promise<EdgeRelevanceFactors> {
    const factors: EdgeRelevanceFactors = {
      recency: 0,
      strength: 0,
      interaction: 0,
      connectivity: 0
    };

    // Recency factor
    factors.recency = this.calculateEdgeRecencyFactor(edge);
    
    // Strength factor
    factors.strength = this.calculateEdgeStrengthFactor(edge);
    
    // Interaction factor
    factors.interaction = this.calculateEdgeInteractionFactor(edge);
    
    // Connectivity factor
    factors.connectivity = await this.calculateEdgeConnectivityFactor(edge);

    return factors;
  }

  /**
   * Calculate recency factor
   */
  private calculateRecencyFactor(node: MemoryNode): number {
    const now = Date.now();
    const age = now - node.timestamp;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    // Exponential decay based on age
    const recencyScore = Math.exp(-age / maxAge);
    return Math.min(1.0, Math.max(0.0, recencyScore));
  }

  /**
   * Calculate frequency factor
   */
  private calculateFrequencyFactor(node: MemoryNode): number {
    // Use access count as frequency indicator
    const maxAccessCount = 100; // Normalize to this maximum
    const frequencyScore = Math.min(1.0, node.accessCount / maxAccessCount);
    return frequencyScore;
  }

  /**
   * Calculate interaction factor
   */
  private async calculateInteractionFactor(node: MemoryNode): Promise<number> {
    const interactions = this.userInteractionHistory.get(node.id) || [];
    
    if (interactions.length === 0) {
      return 0;
    }

    // Calculate interaction frequency and recency
    const now = Date.now();
    const recentInteractions = interactions.filter(time => 
      now - time < (7 * 24 * 60 * 60 * 1000) // Last 7 days
    );

    const frequencyScore = Math.min(1.0, recentInteractions.length / 10); // Normalize to 10 interactions
    const recencyScore = recentInteractions.length > 0 ? 
      Math.exp(-(now - Math.max(...recentInteractions)) / (7 * 24 * 60 * 60 * 1000)) : 0;

    return (frequencyScore + recencyScore) / 2;
  }

  /**
   * Calculate semantic factor
   */
  private async calculateSemanticFactor(node: MemoryNode, context?: RelevanceContext): Promise<number> {
    if (!context || !context.queryTerms) {
      return node.confidence || 0.5; // Use node's own confidence
    }

    // Simple semantic matching with query terms
    const nodeText = this.extractNodeText(node).toLowerCase();
    const queryTerms = context.queryTerms.map(term => term.toLowerCase());
    
    let matchCount = 0;
    for (const term of queryTerms) {
      if (nodeText.includes(term)) {
        matchCount++;
      }
    }

    const semanticScore = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
    return Math.min(1.0, semanticScore);
  }

  /**
   * Calculate centrality factor
   */
  private calculateCentralityFactor(node: MemoryNode): number {
    // Use existing centrality score or calculate based on degree
    if (node.centrality > 0) {
      return Math.min(1.0, node.centrality);
    }

    // Calculate simple degree-based centrality
    const maxDegree = 50; // Normalize to this maximum
    const centralityScore = Math.min(1.0, node.degree / maxDegree);
    return centralityScore;
  }

  /**
   * Calculate type-specific factor
   */
  private calculateTypeSpecificFactor(node: MemoryNode): number {
    const typeWeight = this.config.typeWeights[node.type] || 1.0;
    return Math.min(1.0, typeWeight);
  }

  /**
   * Calculate edge recency factor
   */
  private calculateEdgeRecencyFactor(edge: MemoryEdge): number {
    const now = Date.now();
    const age = now - edge.timestamp;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    const recencyScore = Math.exp(-age / maxAge);
    return Math.min(1.0, Math.max(0.0, recencyScore));
  }

  /**
   * Calculate edge strength factor
   */
  private calculateEdgeStrengthFactor(edge: MemoryEdge): number {
    return Math.min(1.0, edge.weight);
  }

  /**
   * Calculate edge interaction factor
   */
  private calculateEdgeInteractionFactor(edge: MemoryEdge): number {
    const maxInteractions = 20; // Normalize to this maximum
    return Math.min(1.0, edge.interactionCount / maxInteractions);
  }

  /**
   * Calculate edge connectivity factor
   */
  private async calculateEdgeConnectivityFactor(edge: MemoryEdge): Promise<number> {
    try {
      // Get connected nodes
      const sourceNode = await this.db.getNode(edge.sourceId);
      const targetNode = await this.db.getNode(edge.targetId);
      
      if (!sourceNode || !targetNode) {
        return 0;
      }

      // Higher connectivity if both nodes are highly connected
      const sourceConnectivity = sourceNode.degree / 100; // Normalize
      const targetConnectivity = targetNode.degree / 100;
      
      return Math.min(1.0, (sourceConnectivity + targetConnectivity) / 2);
    } catch (error) {
      console.error('Edge connectivity calculation failed:', error);
      return 0;
    }
  }

  /**
   * Combine factors into final relevance score
   */
  private combineFactors(factors: RelevanceFactors): number {
    const weights = this.config;
    
    const score = 
      (factors.recency * weights.recencyWeight) +
      (factors.frequency * weights.frequencyWeight) +
      (factors.interaction * weights.interactionWeight) +
      (factors.semantic * weights.semanticWeight) +
      (factors.centrality * weights.centralityWeight) +
      (factors.typeSpecific * 0.1); // Small weight for type-specific

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Combine edge factors
   */
  private combineEdgeFactors(factors: EdgeRelevanceFactors): number {
    const weights = this.config;
    
    const score = 
      (factors.recency * weights.edgeRecencyWeight) +
      (factors.strength * weights.edgeStrengthWeight) +
      (factors.interaction * weights.edgeInteractionWeight) +
      (factors.connectivity * 0.1); // Small weight for connectivity

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Boost connected edges when node is interacted with
   */
  private async boostConnectedEdges(nodeId: string, boostAmount: number): Promise<void> {
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
        const boostedStrength = Math.min(1.0, edge.strength + boostAmount * 0.1);
        await this.db.updateEdge(edge.id, { 
          strength: boostedStrength,
          weight: boostedStrength,
          interactionCount: edge.interactionCount + 1,
          lastInteraction: Date.now()
        });
      }
    } catch (error) {
      console.error(`Failed to boost connected edges for node ${nodeId}:`, error);
    }
  }

  /**
   * Extract text content from node for semantic analysis
   */
  private extractNodeText(node: MemoryNode): string {
    try {
      let text = '';
      
      if (typeof node.content === 'string') {
        text = node.content;
      } else if (typeof node.content === 'object') {
        Object.values(node.content).forEach(value => {
          if (typeof value === 'string') {
            text += value + ' ';
          }
        });
      }

      // Add tags
      if (node.tags.length > 0) {
        text += node.tags.join(' ') + ' ';
      }

      return text.toLowerCase();
    } catch (error) {
      console.error('Text extraction failed:', error);
      return '';
    }
  }

  /**
   * Initialize default weights
   */
  private initializeWeights(): void {
    const defaultWeights: Record<NodeType, number> = {
      [NodeType.ACTIVITY]: 1.0,
      [NodeType.PATTERN]: 1.2,
      [NodeType.RESOURCE]: 0.8,
      [NodeType.CONCEPT]: 1.1,
      [NodeType.PROJECT]: 1.3,
      [NodeType.WORKFLOW]: 1.2,
      [NodeType.EMAIL]: 0.9,
      [NodeType.CODE]: 1.1,
      [NodeType.GITHUB]: 1.0,
      [NodeType.LEARNING]: 1.2
    };

    // Merge with config
    this.config.typeWeights = { ...defaultWeights, ...this.config.typeWeights };
  }

  /**
   * Cleanup old interaction history
   */
  cleanupInteractionHistory(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    try {
      const now = Date.now();
      const cutoffTime = now - maxAge;

      for (const [nodeId, interactions] of this.userInteractionHistory.entries()) {
        const recentInteractions = interactions.filter(time => time > cutoffTime);
        
        if (recentInteractions.length === 0) {
          this.userInteractionHistory.delete(nodeId);
        } else {
          this.userInteractionHistory.set(nodeId, recentInteractions);
        }
      }
    } catch (error) {
      console.error('Interaction history cleanup failed:', error);
    }
  }

  /**
   * Get relevance statistics
   */
  async getRelevanceStats(): Promise<RelevanceStats> {
    try {
      const query = {
        id: 'relevance-stats',
        type: 'node' as const,
        filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
        constraints: []
      };

      const result = await this.db.queryNodes(query);
      
      const scores = result.results.map(node => node.relevanceScore);
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);

      // Calculate distribution
      const distribution = {
        high: scores.filter(score => score >= 0.8).length,
        medium: scores.filter(score => score >= 0.5 && score < 0.8).length,
        low: scores.filter(score => score < 0.5).length
      };

      return {
        totalNodes: result.total,
        averageScore: avgScore,
        maxScore,
        minScore,
        distribution,
        lastUpdate: Date.now()
      };
    } catch (error) {
      console.error('Relevance stats calculation failed:', error);
      throw error;
    }
  }
}

// Interfaces for relevance scoring
interface RelevanceFactors {
  recency: number;
  frequency: number;
  interaction: number;
  semantic: number;
  centrality: number;
  typeSpecific: number;
}

interface EdgeRelevanceFactors {
  recency: number;
  strength: number;
  interaction: number;
  connectivity: number;
}

interface RelevanceContext {
  queryTerms?: string[];
  timeRange?: { start: number; end: number };
  userPreferences?: Record<string, any>;
  sessionContext?: string;
}

interface RelevanceStats {
  totalNodes: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  distribution: {
    high: number;
    medium: number;
    low: number;
  };
  lastUpdate: number;
}