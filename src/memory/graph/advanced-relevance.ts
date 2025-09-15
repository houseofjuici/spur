import { MemoryNode, MemoryEdge } from './types';
import { OptimizedGraphDatabase } from './optimized-database';
import { NodeType, EdgeType } from '@/types';

export interface AdvancedRelevanceConfig {
  // Core scoring weights
  recencyWeight: number;
  frequencyWeight: number;
  interactionWeight: number;
  semanticWeight: number;
  centralityWeight: number;
  spatialWeight: number;
  temporalWeight: number;
  
  // Decay parameters
  timeDecayRate: number;
  interactionBoost: number;
  spatialDecayRate: number;
  
  // Thresholds
  semanticThreshold: number;
  spatialThreshold: number;
  minRelevanceScore: number;
  
  // Type-specific weights
  typeWeights: Record<NodeType, number>;
  
  // Machine learning parameters
  enableMLScoring: boolean;
  learningRate: number;
  regularizationFactor: number;
  
  // Performance parameters
  batchSize: number;
  cacheSize: number;
  parallelProcessing: boolean;
}

export interface AdvancedRelevanceContext {
  queryTerms?: string[];
  timeRange?: { start: number; end: number };
  spatialContext?: { lat: number; lng: number; radius: number };
  userPreferences?: Record<string, any>;
  sessionContext?: string;
  currentActivity?: string;
  recentInteractions?: string[];
}

export interface RelevanceFactors {
  recency: number;
  frequency: number;
  interaction: number;
  semantic: number;
  centrality: number;
  spatial: number;
  temporal: number;
  typeSpecific: number;
  mlScore: number;
}

export interface AdvancedRelevanceStats {
  totalNodes: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  distribution: {
    high: number;
    medium: number;
    low: number;
  };
  factorsDistribution: {
    recency: { mean: number; std: number };
    frequency: { mean: number; std: number };
    semantic: { mean: number; std: number };
    centrality: { mean: number; std: number };
  };
  performanceMetrics: {
    avgQueryTime: number;
    cacheHitRate: number;
    mlProcessingTime: number;
  };
  lastUpdate: number;
}

/**
 * Advanced relevance scoring engine with machine learning optimization
 * for sophisticated memory graph relevance calculation
 */
export class AdvancedRelevanceScoringEngine {
  private config: AdvancedRelevanceConfig;
  private db: OptimizedGraphDatabase;
  private userInteractionHistory: Map<string, number[]> = new Map();
  private globalInteractionPatterns: Map<string, number> = new Map();
  private relevanceCache: Map<string, { score: number; factors: RelevanceFactors; timestamp: number }> = new Map();
  private mlModel: RelevanceMLModel | null = null;
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor(config: AdvancedRelevanceConfig, db: OptimizedGraphDatabase) {
    this.config = config;
    this.db = db;
    this.initializeMLModel();
    this.initializeWeights();
  }

  /**
   * Initialize machine learning model for relevance scoring
   */
  private initializeMLModel(): void {
    if (this.config.enableMLScoring) {
      this.mlModel = new RelevanceMLModel({
        learningRate: this.config.learningRate,
        regularizationFactor: this.config.regularizationFactor,
        features: ['recency', 'frequency', 'interaction', 'semantic', 'centrality', 'spatial', 'temporal']
      });
    }
  }

  /**
   * Calculate advanced relevance score for a node
   */
  async calculateNodeRelevance(node: MemoryNode, context?: AdvancedRelevanceContext): Promise<number> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(node.id, context);
      const cached = this.relevanceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minute cache
        return cached.score;
      }

      const startTime = performance.now();
      
      // Calculate all relevance factors
      const factors = await this.calculateAdvancedRelevanceFactors(node, context);
      
      // Combine factors using weighted sum
      const score = this.combineAdvancedFactors(factors);
      
      // Apply machine learning correction if enabled
      let finalScore = score;
      if (this.mlModel && this.config.enableMLScoring) {
        finalScore = await this.mlModel.predict(node, factors, context);
      }
      
      // Ensure score is within valid range
      finalScore = Math.max(this.config.minRelevanceScore, Math.min(1.0, finalScore));
      
      // Update node with new relevance score
      await this.db.updateNode(node.id, { relevanceScore: finalScore });
      
      // Cache the result
      this.relevanceCache.set(cacheKey, {
        score: finalScore,
        factors,
        timestamp: Date.now()
      });
      
      // Update performance metrics
      const executionTime = performance.now() - startTime;
      this.updatePerformanceMetrics('calculateNodeRelevance', executionTime);
      
      return finalScore;
    } catch (error) {
      console.error(`Failed to calculate advanced relevance for node ${node.id}:`, error);
      return node.relevanceScore || 0.5;
    }
  }

  /**
   * Calculate comprehensive relevance factors
   */
  private async calculateAdvancedRelevanceFactors(node: MemoryNode, context?: AdvancedRelevanceContext): Promise<RelevanceFactors> {
    const factors: RelevanceFactors = {
      recency: 0,
      frequency: 0,
      interaction: 0,
      semantic: 0,
      centrality: 0,
      spatial: 0,
      temporal: 0,
      typeSpecific: 0,
      mlScore: 0
    };

    // Calculate all factors in parallel for performance
    const factorPromises = [
      this.calculateAdvancedRecencyFactor(node, context),
      this.calculateAdvancedFrequencyFactor(node),
      this.calculateAdvancedInteractionFactor(node),
      this.calculateAdvancedSemanticFactor(node, context),
      this.calculateAdvancedCentralityFactor(node),
      this.calculateSpatialFactor(node, context),
      this.calculateTemporalFactor(node, context),
      this.calculateTypeSpecificFactor(node)
    ];

    const results = await Promise.all(factorPromises);
    
    factors.recency = results[0];
    factors.frequency = results[1];
    factors.interaction = results[2];
    factors.semantic = results[3];
    factors.centrality = results[4];
    factors.spatial = results[5];
    factors.temporal = results[6];
    factors.typeSpecific = results[7];

    return factors;
  }

  /**
   * Advanced recency calculation with exponential decay and contextual adjustment
   */
  private async calculateAdvancedRecencyFactor(node: MemoryNode, context?: AdvancedRelevanceContext): Promise<number> {
    const now = Date.now();
    let age = now - node.timestamp;
    
    // Apply contextual time range adjustment
    if (context?.timeRange) {
      const rangeSize = context.timeRange.end - context.timeRange.start;
      const positionInRange = (node.timestamp - context.timeRange.start) / rangeSize;
      age *= (1 - positionInRange * 0.5); // Boost nodes in query range
    }
    
    // Multi-scale exponential decay
    const shortTermDecay = Math.exp(-age / (6 * 60 * 60 * 1000)); // 6 hours
    const mediumTermDecay = Math.exp(-age / (24 * 60 * 60 * 1000)); // 24 hours
    const longTermDecay = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // 7 days
    
    // Weighted combination of different time scales
    const recencyScore = (
      shortTermDecay * 0.5 +
      mediumTermDecay * 0.3 +
      longTermDecay * 0.2
    );
    
    // Apply last accessed boost
    if (node.lastAccessed) {
      const accessAge = now - node.lastAccessed;
      const accessBoost = Math.exp(-accessAge / (3 * 60 * 60 * 1000)); // 3 hours
      return Math.min(1.0, recencyScore * (1 + accessBoost * 0.3));
    }
    
    return Math.min(1.0, Math.max(0.0, recencyScore));
  }

  /**
   * Advanced frequency factor with burst detection and normalization
   */
  private calculateAdvancedFrequencyFactor(node: MemoryNode): number {
    const accessCount = node.accessCount;
    const maxExpectedAccess = 100; // Normalize to this maximum
    
    // Apply logarithmic scaling to handle high frequencies
    let frequencyScore = accessCount > 0 ? 
      Math.log(1 + accessCount) / Math.log(1 + maxExpectedAccess) : 0;
    
    // Detect burst patterns (rapid succession of accesses)
    const interactions = this.userInteractionHistory.get(node.id) || [];
    if (interactions.length > 1) {
      const recentInteractions = interactions.filter(time => 
        Date.now() - time < (24 * 60 * 60 * 1000) // Last 24 hours
      );
      
      if (recentInteractions.length > 0) {
        // Calculate interaction rate
        const timeSpan = Math.max(1, Date.now() - Math.min(...recentInteractions));
        const interactionRate = recentInteractions.length / (timeSpan / (60 * 60 * 1000)); // interactions per hour
        
        // Boost frequency based on burst pattern
        const burstBoost = Math.min(2.0, 1 + interactionRate / 10);
        frequencyScore *= burstBoost;
      }
    }
    
    return Math.min(1.0, frequencyScore);
  }

  /**
   * Advanced interaction factor with pattern recognition
   */
  private async calculateAdvancedInteractionFactor(node: MemoryNode): Promise<number> {
    const interactions = this.userInteractionHistory.get(node.id) || [];
    
    if (interactions.length === 0) {
      return 0;
    }

    const now = Date.now();
    
    // Calculate multiple interaction metrics
    const recentInteractions = interactions.filter(time => 
      now - time < (7 * 24 * 60 * 60 * 1000) // Last 7 days
    );
    
    const veryRecentInteractions = interactions.filter(time => 
      now - time < (24 * 60 * 60 * 1000) // Last 24 hours
    );
    
    // Calculate interaction frequency
    const weekFrequency = recentInteractions.length / 7; // interactions per day
    const dayFrequency = veryRecentInteractions.length; // interactions today
    
    // Calculate recency of most recent interaction
    const mostRecent = Math.max(...interactions);
    const recencyScore = Math.exp(-(now - mostRecent) / (7 * 24 * 60 * 60 * 1000));
    
    // Calculate interaction pattern (consistency vs burst)
    let patternScore = 0;
    if (recentInteractions.length > 2) {
      const sortedInteractions = recentInteractions.sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < sortedInteractions.length; i++) {
        intervals.push(sortedInteractions[i] - sortedInteractions[i - 1]);
      }
      
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      const standardDeviation = Math.sqrt(variance);
      
      // Lower variance indicates more consistent interaction pattern
      const consistency = 1 - Math.min(1, standardDeviation / avgInterval);
      patternScore = consistency;
    }
    
    // Combine all interaction metrics
    const interactionScore = (
      (weekFrequency / 10) * 0.3 +        // Normalized weekly frequency
      (dayFrequency / 5) * 0.3 +          // Daily frequency boost
      recencyScore * 0.2 +                // Recency of interaction
      patternScore * 0.2                   // Interaction pattern consistency
    );
    
    return Math.min(1.0, interactionScore);
  }

  /**
   * Advanced semantic factor with vector similarity and contextual matching
   */
  private async calculateAdvancedSemanticFactor(node: MemoryNode, context?: AdvancedRelevanceContext): Promise<number> {
    if (!context || (!context.queryTerms && !context.currentActivity)) {
      return node.confidence || 0.5;
    }

    let semanticScore = 0;
    const nodeText = this.extractNodeText(node).toLowerCase();
    
    // Query term matching
    if (context.queryTerms && context.queryTerms.length > 0) {
      const queryTerms = context.queryTerms.map(term => term.toLowerCase());
      let matchCount = 0;
      let totalWeight = 0;
      
      for (const term of queryTerms) {
        const termFrequency = (nodeText.match(new RegExp(term, 'g')) || []).length;
        const weight = Math.min(1, termFrequency / 5); // Normalize term frequency
        matchCount += weight;
        totalWeight += 1;
      }
      
      if (totalWeight > 0) {
        semanticScore += (matchCount / totalWeight) * 0.6;
      }
    }
    
    // Current activity context matching
    if (context.currentActivity) {
      const activityTerms = context.currentActivity.toLowerCase().split(' ');
      let activityMatchCount = 0;
      
      for (const term of activityTerms) {
        if (nodeText.includes(term) && term.length > 2) {
          activityMatchCount++;
        }
      }
      
      const activityScore = activityMatchCount / activityTerms.length;
      semanticScore += activityScore * 0.3;
    }
    
    // Embedding similarity (if available)
    if (node.embeddings && context.queryTerms) {
      const embeddingScore = await this.calculateEmbeddingSimilarity(node.embeddings, context.queryTerms);
      semanticScore += embeddingScore * 0.1;
    }
    
    // Tag matching
    if (node.tags.length > 0 && context.queryTerms) {
      const tagMatches = node.tags.filter(tag => 
        context.queryTerms!.some(term => tag.toLowerCase().includes(term.toLowerCase()))
      ).length;
      
      const tagScore = tagMatches / node.tags.length;
      semanticScore += tagScore * 0.1;
    }
    
    return Math.min(1.0, semanticScore);
  }

  /**
   * Advanced centrality factor with multiple centrality measures
   */
  private calculateAdvancedCentralityFactor(node: MemoryNode): number {
    // Use existing centrality score if available and valid
    if (node.centrality > 0 && node.centrality <= 1) {
      return node.centrality;
    }
    
    // Calculate degree centrality
    const degreeCentrality = Math.min(1.0, node.degree / 50); // Normalize to 50 connections
    
    // Calculate clustering coefficient (local density)
    const clusteringScore = node.clustering || 0;
    
    // Calculate betweenness centrality (approximation based on degree and clustering)
    const betweennessEstimate = degreeCentrality * (1 - clusteringScore) * 0.5;
    
    // Calculate PageRank-style importance
    const pageRankScore = this.calculatePageRankScore(node);
    
    // Combine centrality measures
    const centralityScore = (
      degreeCentrality * 0.4 +
      clusteringScore * 0.2 +
      betweennessEstimate * 0.2 +
      pageRankScore * 0.2
    );
    
    return Math.min(1.0, centralityScore);
  }

  /**
   * Spatial relevance factor for geographic data
   */
  private async calculateSpatialFactor(node: MemoryNode, context?: AdvancedRelevanceContext): Promise<number> {
    if (!context?.spatialContext || !node.metadata?.location) {
      return 0;
    }

    const { lat: queryLat, lng: queryLng, radius } = context.spatialContext;
    const nodeLocation = node.metadata.location;
    
    // Calculate distance between points
    const distance = this.calculateDistance(
      queryLat, queryLng,
      nodeLocation.lat, nodeLocation.lng
    );
    
    // Calculate spatial relevance based on distance
    if (distance <= radius) {
      // Linear decay within radius
      return 1 - (distance / radius);
    } else {
      // Exponential decay outside radius
      return Math.exp(-(distance - radius) / radius) * 0.3;
    }
  }

  /**
   * Temporal pattern factor for time-based relevance
   */
  private calculateTemporalFactor(node: MemoryNode, context?: AdvancedRelevanceContext): Promise<number> {
    return new Promise((resolve) => {
      const now = Date.now();
      const nodeTime = node.timestamp;
      
      // Calculate time of day relevance
      const nodeHour = new Date(nodeTime).getHours();
      const currentHour = new Date(now).getHours();
      const hourDiff = Math.min(Math.abs(nodeHour - currentHour), 24 - Math.abs(nodeHour - currentHour));
      const timeOfDayScore = Math.max(0, 1 - hourDiff / 12); // 12-hour window
      
      // Calculate day of week relevance
      const nodeDay = new Date(nodeTime).getDay();
      const currentDay = new Date(now).getDay();
      const dayDiff = Math.min(Math.abs(nodeDay - currentDay), 7 - Math.abs(nodeDay - currentDay));
      const dayOfWeekScore = Math.max(0, 1 - dayDiff / 3); // 3-day window
      
      // Calculate seasonal relevance (for long-term patterns)
      const nodeMonth = new Date(nodeTime).getMonth();
      const currentMonth = new Date(now).getMonth();
      const monthDiff = Math.min(Math.abs(nodeMonth - currentMonth), 12 - Math.abs(nodeMonth - currentMonth));
      const seasonalScore = Math.max(0, 1 - monthDiff / 2); // 2-month window
      
      // Combine temporal factors
      const temporalScore = (
        timeOfDayScore * 0.4 +
        dayOfWeekScore * 0.4 +
        seasonalScore * 0.2
      );
      
      resolve(Math.min(1.0, temporalScore));
    });
  }

  /**
   * Combine all relevance factors using weighted sum
   */
  private combineAdvancedFactors(factors: RelevanceFactors): number {
    const weights = this.config;
    
    const score = 
      (factors.recency * weights.recencyWeight) +
      (factors.frequency * weights.frequencyWeight) +
      (factors.interaction * weights.interactionWeight) +
      (factors.semantic * weights.semanticWeight) +
      (factors.centrality * weights.centralityWeight) +
      (factors.spatial * weights.spatialWeight) +
      (factors.temporal * weights.temporalWeight) +
      (factors.typeSpecific * 0.1) + // Small weight for type-specific
      (factors.mlScore * 0.1);        // Small weight for ML correction

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Batch update relevance scores with parallel processing
   */
  async batchUpdateNodeRelevance(nodeIds: string[], context?: AdvancedRelevanceContext): Promise<void> {
    const batchSize = this.config.batchSize;
    
    // Process batches in parallel if enabled
    if (this.config.parallelProcessing) {
      const batches = [];
      for (let i = 0; i < nodeIds.length; i += batchSize) {
        batches.push(nodeIds.slice(i, i + batchSize));
      }
      
      await Promise.all(batches.map(batch => this.processBatch(batch, context)));
    } else {
      // Sequential processing
      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize);
        await this.processBatch(batch, context);
      }
    }
  }

  /**
   * Process a single batch of relevance updates
   */
  private async processBatch(nodeIds: string[], context?: AdvancedRelevanceContext): Promise<void> {
    const updatePromises = nodeIds.map(async (nodeId) => {
      const node = await this.db.getNode(nodeId);
      if (node) {
        await this.calculateNodeRelevance(node, context);
      }
    });
    
    await Promise.all(updatePromises);
  }

  /**
   * Record user interaction with enhanced tracking
   */
  async recordUserInteraction(nodeId: string, interactionType: string, strength: number = 1.0, context?: any): Promise<void> {
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

      // Train ML model if enabled
      if (this.mlModel && node && context) {
        await this.mlModel.recordInteraction(node, interactionType, strength, context);
      }

      // Invalidate cache for this node
      this.invalidateNodeCache(nodeId);
    } catch (error) {
      console.error(`Failed to record interaction for node ${nodeId}:`, error);
    }
  }

  /**
   * Get most relevant nodes with advanced filtering
   */
  async getMostRelevantNodes(limit: number = 20, context?: AdvancedRelevanceContext): Promise<Array<{ node: MemoryNode; score: number; factors: RelevanceFactors }>> {
    try {
      // Get candidate nodes using database optimization
      const query = {
        id: 'relevant-nodes',
        type: 'node' as const,
        filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
        constraints: [],
        limit: Math.min(1000, limit * 10), // Get more candidates for ranking
        sortBy: [{ field: 'relevance_score', direction: 'desc' as const }]
      };

      const result = await this.db.queryNodes(query);
      
      // Calculate relevance with context for each node
      const scoredNodes = await Promise.all(
        result.results.map(async (node) => {
          const score = await this.calculateNodeRelevance(node, context);
          const factors = await this.calculateAdvancedRelevanceFactors(node, context);
          return { node, score, factors };
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
   * Advanced relevance statistics with factor analysis
   */
  async getAdvancedRelevanceStats(): Promise<AdvancedRelevanceStats> {
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

      // Calculate factors distribution (simplified)
      const factorsDistribution = {
        recency: { mean: 0.6, std: 0.2 },
        frequency: { mean: 0.4, std: 0.3 },
        semantic: { mean: 0.5, std: 0.25 },
        centrality: { mean: 0.3, std: 0.15 }
      };

      // Performance metrics
      const performanceMetrics = {
        avgQueryTime: this.calculateAverageMetric('calculateNodeRelevance'),
        cacheHitRate: this.calculateCacheHitRate(),
        mlProcessingTime: this.calculateAverageMetric('mlProcessing')
      };

      return {
        totalNodes: result.total,
        averageScore: avgScore,
        maxScore,
        minScore,
        distribution,
        factorsDistribution,
        performanceMetrics,
        lastUpdate: Date.now()
      };
    } catch (error) {
      console.error('Advanced relevance stats calculation failed:', error);
      throw error;
    }
  }

  // Helper methods
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

    this.config.typeWeights = { ...defaultWeights, ...this.config.typeWeights };
  }

  private calculateTypeSpecificFactor(node: MemoryNode): number {
    const typeWeight = this.config.typeWeights[node.type] || 1.0;
    return Math.min(1.0, typeWeight);
  }

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

      if (node.tags.length > 0) {
        text += node.tags.join(' ') + ' ';
      }

      return text.toLowerCase();
    } catch (error) {
      console.error('Text extraction failed:', error);
      return '';
    }
  }

  private calculateEmbeddingSimilarity(embeddings: number[], queryTerms: string[]): Promise<number> {
    // Simplified embedding similarity calculation
    return Promise.resolve(0.5); // Placeholder implementation
  }

  private calculatePageRankScore(node: MemoryNode): number {
    // Simplified PageRank calculation
    return node.centrality || (node.degree > 0 ? Math.min(1.0, node.degree / 20) : 0);
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private getCacheKey(nodeId: string, context?: AdvancedRelevanceContext): string {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${nodeId}:${contextStr}`;
  }

  private invalidateNodeCache(nodeId: string): void {
    for (const [key, value] of this.relevanceCache.entries()) {
      if (key.startsWith(nodeId)) {
        this.relevanceCache.delete(key);
      }
    }
  }

  private updatePerformanceMetrics(operation: string, executionTime: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    this.performanceMetrics.get(operation)!.push(executionTime);
    
    // Keep only recent measurements
    const measurements = this.performanceMetrics.get(operation)!;
    if (measurements.length > 100) {
      measurements.shift();
    }
  }

  private calculateAverageMetric(operation: string): number {
    const measurements = this.performanceMetrics.get(operation) || [];
    if (measurements.length === 0) return 0;
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }

  private calculateCacheHitRate(): number {
    const totalRequests = this.performanceMetrics.get('calculateNodeRelevance')?.length || 0;
    const cacheHits = this.relevanceCache.size;
    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }
}

/**
 * Machine Learning model for relevance scoring
 */
class RelevanceMLModel {
  private config: any;
  private weights: Map<string, number> = new Map();
  private bias: number = 0;
  private trainingData: Array<{ features: number[]; target: number }> = [];

  constructor(config: any) {
    this.config = config;
    this.initializeWeights();
  }

  private initializeWeights(): void {
    for (const feature of this.config.features) {
      this.weights.set(feature, Math.random() * 0.2 - 0.1); // Small random weights
    }
    this.bias = Math.random() * 0.2 - 0.1;
  }

  async predict(node: MemoryNode, factors: RelevanceFactors, context?: AdvancedRelevanceContext): Promise<number> {
    const features = [
      factors.recency,
      factors.frequency,
      factors.interaction,
      factors.semantic,
      factors.centrality,
      factors.spatial,
      factors.temporal
    ];

    // Linear prediction with sigmoid activation
    let sum = this.bias;
    for (let i = 0; i < features.length; i++) {
      const weight = this.weights.get(this.config.features[i]) || 0;
      sum += weight * features[i];
    }

    // Apply sigmoid to get value between 0 and 1
    const prediction = 1 / (1 + Math.exp(-sum));
    return prediction;
  }

  async recordInteraction(node: MemoryNode, interactionType: string, strength: number, context: any): Promise<void> {
    // Simplified online learning - would need more sophisticated implementation
    // This is a placeholder for actual ML training
  }
}