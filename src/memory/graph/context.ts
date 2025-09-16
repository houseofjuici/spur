import { MemoryNode, MemoryEdge, GraphQuery, GraphQueryResult, QueryContext } from './types';
import { GraphDatabase } from './database';
import { QueryTranslationEngine } from './query';
import { NodeType, EdgeType } from '@/types';

export interface ContextWindow {
  id: string;
  sessionId: string;
  userId?: string;
  recentNodes: MemoryNode[];
  relevantNodes: MemoryNode[];
  recentEdges: MemoryEdge[];
  relevantEdges: MemoryEdge[];
  queryHistory: QueryHistoryEntry[];
  contextSize: number;
  maxContextSize: number;
  relevanceThreshold: number;
  timeRange: { start: number; end: number };
  lastUpdated: number;
  metadata: Record<string, any>;
}

export interface QueryHistoryEntry {
  query: string;
  timestamp: number;
  results: number;
  executionTime: number;
  success: boolean;
  contextSnapshot: {
    recentNodes: number;
    relevantNodes: number;
        relevanceScores: number[];
  };
}

export interface ContextWindowConfig {
  maxRecentNodes: number;
  maxRelevantNodes: number;
  maxRecentEdges: number;
  maxRelevantEdges: number;
  maxQueryHistory: number;
  timeRangeMs: number; // Time range for recent items
  relevanceThreshold: number;
  semanticSimilarityThreshold: number;
  maxContextSize: number; // Maximum total items in context
  decayRate: number; // Context decay rate
  boostRecentInteractions: number;
}

export class ContextWindowManager {
  private config: ContextWindowConfig;
  private db: GraphDatabase;
  private queryEngine: QueryTranslationEngine;
  private activeWindows: Map<string, ContextWindow> = new Map();
  private contextStats: ContextStats = {
    totalWindows: 0,
    averageSize: 0,
    averageRelevance: 0,
    hitRate: 0,
    lastUpdate: Date.now()
  };

  constructor(config: ContextWindowConfig, db: GraphDatabase, queryEngine: QueryTranslationEngine) {
    this.config = config;
    this.db = db;
    this.queryEngine = queryEngine;
  }

  /**
   * Get or create context window for session
   */
  async getContextWindow(sessionId: string, userId?: string): Promise<ContextWindow> {
    let window = this.activeWindows.get(sessionId);
    
    if (!window) {
      window = await this.createContextWindow(sessionId, userId);
      this.activeWindows.set(sessionId, window);
      this.updateStats();
    }

    // Update window if it's stale
    const now = Date.now();
    if (now - window.lastUpdated > this.config.timeRangeMs / 2) {
      await this.updateContextWindow(window);
    }

    return window;
  }

  /**
   * Update context window with new interaction
   */
  async updateContextWithInteraction(
    sessionId: string, 
    interactionType: 'query' | 'node_access' | 'edge_interaction',
    data: any
  ): Promise<void> {
    try {
      const window = await this.getContextWindow(sessionId);
      
      switch (interactionType) {
        case 'query':
          await this.handleQueryInteraction(window, data);
          break;
        case 'node_access':
          await this.handleNodeAccess(window, data);
          break;
        case 'edge_interaction':
          await this.handleEdgeInteraction(window, data);
          break;
      }

      window.lastUpdated = Date.now();
      this.trimContextWindow(window);
    } catch (error) {
      console.error(`Failed to update context for session ${sessionId}:`, error);
    }
  }

  /**
   * Get contextually relevant nodes for query
   */
  async getRelevantContext(
    sessionId: string, 
    query: string, 
    limit: number = 10
  ): Promise<ContextResult> {
    try {
      const window = await this.getContextWindow(sessionId);
      const now = Date.now();
      
      // Extract keywords from query
      const normalizedQuery = query.toLowerCase();
      const keywords = this.extractKeywords(normalizedQuery);
      
      // Score existing context items
      const scoredNodes = this.scoreContextNodes(window, keywords, normalizedQuery);
      const scoredEdges = this.scoreContextEdges(window, keywords, normalizedQuery);
      
      // Get additional relevant items from database if needed
      const additionalNodes = await this.findAdditionalRelevantNodes(keywords, limit);
      const additionalEdges = await this.findAdditionalRelevantEdges(keywords, limit);
      
      // Combine and rank all items
      const allNodes = [...scoredNodes, ...additionalNodes]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
        
      const allEdges = [...scoredEdges, ...additionalEdges]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Update context window with new findings
      this.updateWindowWithFindings(window, allNodes, allEdges);

      return {
        recentNodes: window.recentNodes.slice(0, Math.min(5, window.recentNodes.length)),
        relevantNodes: allNodes,
        recentEdges: window.recentEdges.slice(0, Math.min(3, window.recentEdges.length)),
        relevantEdges: allEdges,
        queryHistory: window.queryHistory.slice(-3), // Last 3 queries
        contextScore: this.calculateContextScore(allNodes, allEdges),
        relevanceScores: allNodes.map(n => n.score),
        timestamp: now
      };
    } catch (error) {
      console.error('Failed to get relevant context:', error);
      return this.getFallbackContext();
    }
  }

  /**
   * Get temporal context for time range
   */
  async getTemporalContext(
    sessionId: string, 
    timeRange: { start: number; end: number }
  ): Promise<TemporalContext> {
    try {
      const window = await this.getContextWindow(sessionId);
      
      // Get nodes and edges in time range
      const timeNodes = await this.getNodesInTimeRange(timeRange);
      const timeEdges = await this.getEdgesInTimeRange(timeRange);
      
      // Identify temporal patterns
      const patterns = this.identifyTemporalPatterns(timeNodes, timeEdges);
      
      // Get related context from current window
      const relatedNodes = this.findRelatedToTimeRange(window, timeRange);
      
      return {
        timeRange,
        nodes: timeNodes,
        edges: timeEdges,
        patterns,
        relatedNodes,
        density: this.calculateTemporalDensity(timeNodes, timeEdges, timeRange),
        confidence: this.calculateTemporalConfidence(timeNodes, timeEdges)
      };
    } catch (error) {
      console.error('Failed to get temporal context:', error);
      return this.getFallbackTemporalContext(timeRange);
    }
  }

  /**
   * Create new context window
   */
  private async createContextWindow(sessionId: string, userId?: string): Promise<ContextWindow> {
    const now = Date.now();
    const timeRange = {
      start: now - this.config.timeRangeMs,
      end: now
    };

    // Get initial data
    const recentNodes = await this.getRecentNodes(timeRange, this.config.maxRecentNodes);
    const relevantNodes = await this.getRelevantNodes(sessionId, this.config.maxRelevantNodes);
    const recentEdges = await this.getRecentEdges(timeRange, this.config.maxRecentEdges);
    const relevantEdges = await this.getRelevantEdges(sessionId, this.config.maxRelevantEdges);

    const window: ContextWindow = {
      id: `ctx_${sessionId}_${now}`,
      sessionId,
      userId,
      recentNodes,
      relevantNodes,
      recentEdges,
      relevantEdges,
      queryHistory: [],
      contextSize: recentNodes.length + relevantNodes.length + recentEdges.length + relevantEdges.length,
      maxContextSize: this.config.maxContextSize,
      relevanceThreshold: this.config.relevanceThreshold,
      timeRange,
      lastUpdated: now,
      metadata: {
        created: now,
        version: '1.0',
        decayRate: this.config.decayRate
      }
    };

    return window;
  }

  /**
   * Update existing context window
   */
  private async updateContextWindow(window: ContextWindow): Promise<void> {
    const now = Date.now();
    const newTimeRange = {
      start: now - this.config.timeRangeMs,
      end: now
    };

    // Apply decay to existing items
    this.applyContextDecay(window);

    // Get fresh data
    const freshNodes = await this.getRecentNodes(newTimeRange, this.config.maxRecentNodes);
    const freshEdges = await this.getRecentEdges(newTimeRange, this.config.maxRecentEdges);

    // Merge with existing context
    window.recentNodes = this.mergeAndDeduplicate(window.recentNodes, freshNodes, 'timestamp');
    window.recentEdges = this.mergeAndDeduplicate(window.recentEdges, freshEdges, 'timestamp');
    
    // Update time range
    window.timeRange = newTimeRange;
    window.lastUpdated = now;

    // Recalculate size
    this.recalculateContextSize(window);
  }

  /**
   * Handle query interaction
   */
  private async handleQueryInteraction(window: ContextWindow, data: { query: string; results: GraphQueryResult<any>; executionTime: number }): Promise<void> {
    const entry: QueryHistoryEntry = {
      query: data.query,
      timestamp: Date.now(),
      results: data.results.results.length,
      executionTime: data.executionTime,
      success: data.results.results.length > 0,
      contextSnapshot: {
        recentNodes: window.recentNodes.length,
        relevantNodes: window.relevantNodes.length,
        relevanceScores: window.relevantNodes.map(n => n.relevanceScore)
      }
    };

    window.queryHistory.push(entry);

    // Trim query history
    if (window.queryHistory.length > this.config.maxQueryHistory) {
      window.queryHistory = window.queryHistory.slice(-this.config.maxQueryHistory);
    }

    // Boost relevance of nodes that appeared in results
    this.boostResultNodes(window, data.results.results);
  }

  /**
   * Handle node access interaction
   */
  private async handleNodeAccess(window: ContextWindow, data: { nodeId: string; accessType: string }): Promise<void> {
    try {
      const node = await this.db.getNode(data.nodeId);
      if (!node) return;

      // Boost node relevance
      const boostedNode = { ...node, relevanceScore: Math.min(1.0, node.relevanceScore * this.config.boostRecentInteractions) };
      
      // Move to recent nodes if not already there
      const existingIndex = window.recentNodes.findIndex(n => n.id === node.id);
      if (existingIndex === -1) {
        window.recentNodes.unshift(boostedNode);
      } else {
        window.recentNodes[existingIndex] = boostedNode;
        // Move to front
        window.recentNodes.splice(existingIndex, 1);
        window.recentNodes.unshift(boostedNode);
      }

      // Trim recent nodes
      if (window.recentNodes.length > this.config.maxRecentNodes) {
        window.recentNodes = window.recentNodes.slice(0, this.config.maxRecentNodes);
      }
    } catch (error) {
      console.error('Failed to handle node access:', error);
    }
  }

  /**
   * Handle edge interaction
   */
  private async handleEdgeInteraction(window: ContextWindow, data: { edgeId: string; interactionType: string }): Promise<void> {
    try {
      const edge = await this.db.getEdge(data.edgeId);
      if (!edge) return;

      // Boost edge strength
      const boostedEdge = { ...edge, strength: Math.min(1.0, edge.strength * this.config.boostRecentInteractions) };
      
      // Move to recent edges if not already there
      const existingIndex = window.recentEdges.findIndex(e => e.id === edge.id);
      if (existingIndex === -1) {
        window.recentEdges.unshift(boostedEdge);
      } else {
        window.recentEdges[existingIndex] = boostedEdge;
        window.recentEdges.splice(existingIndex, 1);
        window.recentEdges.unshift(boostedEdge);
      }

      // Trim recent edges
      if (window.recentEdges.length > this.config.maxRecentEdges) {
        window.recentEdges = window.recentEdges.slice(0, this.config.maxRecentEdges);
      }
    } catch (error) {
      console.error('Failed to handle edge interaction:', error);
    }
  }

  /**
   * Score context nodes based on query relevance
   */
  private scoreContextNodes(window: ContextWindow, keywords: string[], query: string): Array<{ node: MemoryNode; score: number }> {
    const allNodes = [...window.recentNodes, ...window.relevantNodes];
    const scored: Array<{ node: MemoryNode; score: number }> = [];

    for (const node of allNodes) {
      let score = 0;

      // Keyword matching
      const nodeText = this.extractNodeText(node).toLowerCase();
      const keywordMatches = keywords.filter(keyword => nodeText.includes(keyword)).length;
      score += (keywordMatches / keywords.length) * 0.4;

      // Query matching
      if (nodeText.includes(query)) {
        score += 0.3;
      }

      // Recency boost
      const recencyScore = this.calculateRecencyScore(node);
      score += recencyScore * 0.2;

      // Relevance score
      score += node.relevanceScore * 0.1;

      scored.push({ node, score });
    }

    return scored;
  }

  /**
   * Score context edges based on query relevance
   */
  private scoreContextEdges(window: ContextWindow, keywords: string[], query: string): Array<{ edge: MemoryEdge; score: number }> {
    const allEdges = [...window.recentEdges, ...window.relevantEdges];
    const scored: Array<{ edge: MemoryEdge; score: number }> = [];

    for (const edge of allEdges) {
      let score = 0;

      // Strength score
      score += edge.strength * 0.4;

      // Recency score
      const recencyScore = this.calculateRecencyScore(edge);
      score += recencyScore * 0.3;

      // Interaction count
      score += Math.min(edge.interactionCount / 10, 1) * 0.2;

      // Context matching
      if (edge.context.toLowerCase().includes(query.toLowerCase())) {
        score += 0.1;
      }

      scored.push({ edge, score });
    }

    return scored;
  }

  /**
   * Find additional relevant nodes from database
   */
  private async findAdditionalRelevantNodes(keywords: string[], limit: number): Promise<Array<{ node: MemoryNode; score: number }>> {
    try {
      if (keywords.length === 0) {
        return [];
      }

      // Build query for database search
      const filters: any[] = [
        { field: 'is_pruned', operator: 'eq', value: false },
        { field: 'relevance_score', operator: 'gte', value: this.config.relevanceThreshold }
      ];

      // Add keyword filters
      for (const keyword of keywords) {
        filters.push({
          field: 'tags',
          operator: 'contains',
          value: keyword
        });
      }

      const query = {
        id: `context_search_${Date.now()}`,
        type: 'node' as const,
        filters,
        constraints: [],
        limit: limit * 2, // Get more to filter and score
        sortBy: [{ field: 'relevance_score', direction: 'desc' as const }]
      };

      const result = await this.db.queryNodes(query);
      
      return result.results.map(node => ({
        node,
        score: node.relevanceScore
      }));
    } catch (error) {
      console.error('Failed to find additional relevant nodes:', error);
      return [];
    }
  }

  /**
   * Find additional relevant edges from database
   */
  private async findAdditionalRelevantEdges(keywords: string[], limit: number): Promise<Array<{ edge: MemoryEdge; score: number }>> {
    try {
      const query = {
        id: `context_edge_search_${Date.now()}`,
        type: 'edge' as const,
        filters: [
          { field: 'is_active', operator: 'eq', value: true },
          { field: 'strength', operator: 'gte', value: this.config.relevanceThreshold }
        ],
        constraints: [],
        limit: limit * 2,
        sortBy: [{ field: 'strength', direction: 'desc' as const }]
      };

      const result = await this.db.queryEdges(query);
      
      return result.results.map(edge => ({
        edge,
        score: edge.strength
      }));
    } catch (error) {
      console.error('Failed to find additional relevant edges:', error);
      return [];
    }
  }

  /**
   * Helper methods for data retrieval
   */
  private async getRecentNodes(timeRange: { start: number; end: number }, limit: number): Promise<MemoryNode[]> {
    const query = {
      id: 'recent_nodes',
      type: 'node' as const,
      filters: [
        { field: 'timestamp', operator: 'gte', value: timeRange.start },
        { field: 'timestamp', operator: 'lte', value: timeRange.end },
        { field: 'is_pruned', operator: 'eq', value: false }
      ],
      constraints: [],
      limit,
      sortBy: [{ field: 'timestamp', direction: 'desc' as const }]
    };

    const result = await this.db.queryNodes(query);
    return result.results;
  }

  private async getRelevantNodes(sessionId: string, limit: number): Promise<MemoryNode[]> {
    // For now, get high-relevance nodes
    const query = {
      id: 'relevant_nodes',
      type: 'node' as const,
      filters: [
        { field: 'relevance_score', operator: 'gte', value: 0.7 },
        { field: 'is_pruned', operator: 'eq', value: false }
      ],
      constraints: [],
      limit,
      sortBy: [{ field: 'relevance_score', direction: 'desc' as const }]
    };

    const result = await this.db.queryNodes(query);
    return result.results;
  }

  private async getRecentEdges(timeRange: { start: number; end: number }, limit: number): Promise<MemoryEdge[]> {
    const query = {
      id: 'recent_edges',
      type: 'edge' as const,
      filters: [
        { field: 'timestamp', operator: 'gte', value: timeRange.start },
        { field: 'timestamp', operator: 'lte', value: timeRange.end },
        { field: 'is_active', operator: 'eq', value: true }
      ],
      constraints: [],
      limit,
      sortBy: [{ field: 'timestamp', direction: 'desc' as const }]
    };

    const result = await this.db.queryEdges(query);
    return result.results;
  }

  private async getRelevantEdges(sessionId: string, limit: number): Promise<MemoryEdge[]> {
    const query = {
      id: 'relevant_edges',
      type: 'edge' as const,
      filters: [
        { field: 'strength', operator: 'gte', value: 0.7 },
        { field: 'is_active', operator: 'eq', value: true }
      ],
      constraints: [],
      limit,
      sortBy: [{ field: 'strength', direction: 'desc' as const }]
    };

    const result = await this.db.queryEdges(query);
    return result.results;
  }

  private async getNodesInTimeRange(timeRange: { start: number; end: number }): Promise<MemoryNode[]> {
    const query = {
      id: 'temporal_nodes',
      type: 'node' as const,
      filters: [
        { field: 'timestamp', operator: 'gte', value: timeRange.start },
        { field: 'timestamp', operator: 'lte', value: timeRange.end },
        { field: 'is_pruned', operator: 'eq', value: false }
      ],
      constraints: [],
      limit: 1000
    };

    const result = await this.db.queryNodes(query);
    return result.results;
  }

  private async getEdgesInTimeRange(timeRange: { start: number; end: number }): Promise<MemoryEdge[]> {
    const query = {
      id: 'temporal_edges',
      type: 'edge' as const,
      filters: [
        { field: 'timestamp', operator: 'gte', value: timeRange.start },
        { field: 'timestamp', operator: 'lte', value: timeRange.end },
        { field: 'is_active', operator: 'eq', value: true }
      ],
      constraints: [],
      limit: 1000
    };

    const result = await this.db.queryEdges(query);
    return result.results;
  }

  // Utility methods
  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return query.split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word));
  }

  private extractNodeText(node: MemoryNode): string {
    let text = '';
    if (typeof node.content === 'string') text = node.content;
    if (typeof node.content === 'object') {
      Object.values(node.content).forEach(val => {
        if (typeof val === 'string') text += val + ' ';
      });
    }
    text += node.tags.join(' ');
    return text.toLowerCase();
  }

  private calculateRecencyScore(item: MemoryNode | MemoryEdge): number {
    const age = Date.now() - item.timestamp;
    const maxAge = this.config.timeRangeMs;
    return Math.exp(-age / maxAge);
  }

  private mergeAndDeduplicate<T extends { id: string; timestamp: number }>(existing: T[], fresh: T[], sortField: keyof T): T[] {
    const merged = [...existing, ...fresh];
    const seen = new Set<string>();
    
    return merged
      .filter(item => {
        if (seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => b[sortField] - a[sortField]);
  }

  private applyContextDecay(window: ContextWindow): void {
    const decayFactor = 1 - this.config.decayRate;
    
    window.recentNodes.forEach(node => {
      node.relevanceScore *= decayFactor;
    });
    
    window.relevantNodes.forEach(node => {
      node.relevanceScore *= decayFactor;
    });
    
    window.recentEdges.forEach(edge => {
      edge.strength *= decayFactor;
    });
    
    window.relevantEdges.forEach(edge => {
      edge.strength *= decayFactor;
    });
  }

  private trimContextWindow(window: ContextWindow): void {
    // Remove items below relevance threshold
    window.recentNodes = window.recentNodes.filter(node => node.relevanceScore >= this.config.relevanceThreshold);
    window.relevantNodes = window.relevantNodes.filter(node => node.relevanceScore >= this.config.relevanceThreshold);
    window.recentEdges = window.recentEdges.filter(edge => edge.strength >= this.config.relevanceThreshold);
    window.relevantEdges = window.relevantEdges.filter(edge => edge.strength >= this.config.relevanceThreshold);

    // Limit to max size
    window.recentNodes = window.recentNodes.slice(0, this.config.maxRecentNodes);
    window.relevantNodes = window.relevantNodes.slice(0, this.config.maxRelevantNodes);
    window.recentEdges = window.recentEdges.slice(0, this.config.maxRecentEdges);
    window.relevantEdges = window.relevantEdges.slice(0, this.config.maxRelevantEdges);

    this.recalculateContextSize(window);
  }

  private recalculateContextSize(window: ContextWindow): void {
    window.contextSize = window.recentNodes.length + window.relevantNodes.length + 
                         window.recentEdges.length + window.relevantEdges.length;
  }

  private updateWindowWithFindings(window: ContextWindow, nodes: Array<{ node: MemoryNode; score: number }>, edges: Array<{ edge: MemoryEdge; score: number }>): void {
    // Update relevant nodes with new findings
    const existingNodeIds = new Set(window.relevantNodes.map(n => n.id));
    
    nodes.forEach(({ node, score }) => {
      if (!existingNodeIds.has(node.id) && score >= this.config.semanticSimilarityThreshold) {
        window.relevantNodes.push(node);
      }
    });

    // Update relevant edges with new findings
    const existingEdgeIds = new Set(window.relevantEdges.map(e => e.id));
    
    edges.forEach(({ edge, score }) => {
      if (!existingEdgeIds.has(edge.id) && score >= this.config.semanticSimilarityThreshold) {
        window.relevantEdges.push(edge);
      }
    });

    // Trim to maintain size limits
    this.trimContextWindow(window);
  }

  private boostResultNodes(window: ContextWindow, results: any[]): void {
    results.forEach(result => {
      if (result.id) {
        const nodeIndex = window.relevantNodes.findIndex(n => n.id === result.id);
        if (nodeIndex !== -1) {
          window.relevantNodes[nodeIndex].relevanceScore = 
            Math.min(1.0, window.relevantNodes[nodeIndex].relevanceScore * 1.1);
        }
      }
    });
  }

  private calculateContextScore(nodes: Array<{ node: MemoryNode; score: number }>, edges: Array<{ edge: MemoryEdge; score: number }>): number {
    if (nodes.length === 0 && edges.length === 0) return 0;
    
    const nodeScores = nodes.map(n => n.score);
    const edgeScores = edges.map(e => e.score);
    
    const allScores = [...nodeScores, ...edgeScores];
    return allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  }

  private identifyTemporalPatterns(nodes: MemoryNode[], edges: MemoryEdge[]): any[] {
    // Simplified pattern detection
    const patterns = [];
    
    // Detect bursts
    const timestamps = nodes.map(n => n.timestamp).sort();
    const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    const burstIntervals = intervals.filter(interval => interval < avgInterval * 0.5);
    if (burstIntervals.length > intervals.length * 0.3) {
      patterns.push({ type: 'burst', confidence: burstIntervals.length / intervals.length });
    }
    
    return patterns;
  }

  private findRelatedToTimeRange(window: ContextWindow, timeRange: { start: number; end: number }): MemoryNode[] {
    return window.relevantNodes.filter(node => {
      const nodeTime = node.timestamp;
      const buffer = this.config.timeRangeMs * 0.1; // 10% buffer
      return nodeTime >= (timeRange.start - buffer) && nodeTime <= (timeRange.end + buffer);
    });
  }

  private calculateTemporalDensity(nodes: MemoryNode[], edges: MemoryEdge[], timeRange: { start: number; end: number }): number {
    const duration = timeRange.end - timeRange.start;
    const totalItems = nodes.length + edges.length;
    return totalItems / (duration / (60 * 60 * 1000)); // Items per hour
  }

  private calculateTemporalConfidence(nodes: MemoryNode[], edges: MemoryEdge[]): number {
    const totalRelevance = nodes.reduce((sum, node) => sum + node.relevanceScore, 0) +
                          edges.reduce((sum, edge) => sum + edge.strength, 0);
    const totalItems = nodes.length + edges.length;
    return totalItems > 0 ? totalRelevance / totalItems : 0;
  }

  private updateStats(): void {
    this.contextStats.totalWindows = this.activeWindows.size;
    
    const sizes = Array.from(this.activeWindows.values()).map(w => w.contextSize);
    this.contextStats.averageSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    const relevances = Array.from(this.activeWindows.values())
      .flatMap(w => [...w.recentNodes, ...w.relevantNodes].map(n => n.relevanceScore));
    this.contextStats.averageRelevance = relevances.reduce((sum, rel) => sum + rel, 0) / relevances.length;
    
    this.contextStats.lastUpdate = Date.now();
  }

  private getFallbackContext(): ContextResult {
    return {
      recentNodes: [],
      relevantNodes: [],
      recentEdges: [],
      relevantEdges: [],
      queryHistory: [],
      contextScore: 0,
      relevanceScores: [],
      timestamp: Date.now()
    };
  }

  private getFallbackTemporalContext(timeRange: { start: number; end: number }): TemporalContext {
    return {
      timeRange,
      nodes: [],
      edges: [],
      patterns: [],
      relatedNodes: [],
      density: 0,
      confidence: 0
    };
  }

  // Public API methods
  getContextStats(): ContextStats {
    return { ...this.contextStats };
  }

  async cleanup(): Promise<void> {
    // Clean up old context windows
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    
    for (const [sessionId, window] of this.activeWindows.entries()) {
      if (now - window.lastUpdated > maxAge) {
        this.activeWindows.delete(sessionId);
      }
    }
    
    this.updateStats();
  }

  async clearContext(sessionId: string): Promise<void> {
    this.activeWindows.delete(sessionId);
    this.updateStats();
  }
}

// Result interfaces
interface ContextResult {
  recentNodes: MemoryNode[];
  relevantNodes: Array<{ node: MemoryNode; score: number }>;
  recentEdges: MemoryEdge[];
  relevantEdges: Array<{ edge: MemoryEdge; score: number }>;
  queryHistory: QueryHistoryEntry[];
  contextScore: number;
  relevanceScores: number[];
  timestamp: number;
}

interface TemporalContext {
  timeRange: { start: number; end: number };
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  patterns: any[];
  relatedNodes: MemoryNode[];
  density: number;
  confidence: number;
}

interface ContextStats {
  totalWindows: number;
  averageSize: number;
  averageRelevance: number;
  hitRate: number;
  lastUpdate: number;
}