import { 
  MemoryNode, 
  MemoryEdge, 
  MemoryGraphConfig,
  GraphQuery,
  GraphQueryResult,
  GraphStats
} from './types';
import { GraphDatabase } from './database';
import { TemporalClusteringEngine } from './temporal';
import { SemanticSimilarityEngine } from './semantic';
import { RelevanceScoringEngine, RelevanceConfig } from './relevance';
import { MemoryDecayEngine, DecayConfig } from './decay';
import { GraphPruningEngine, PruningConfig } from './pruning';
import { QueryTranslationEngine } from './query';
import { ContextWindowManager, ContextWindowConfig } from './context';
import { BaseEvent, NodeType, EdgeType } from '@/types';

export interface ProcessingResult {
  nodesCreated: number;
  edgesCreated: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface AnalysisResult {
  totalNodes: number;
  totalEdges: number;
  activeNodes: number;
  activeEdges: number;
  averageRelevance: number;
  clustering: {
    clusters: number;
    averageDensity: number;
    patterns: any[];
  };
  temporal: {
    patterns: any[];
    trends: string[];
  };
  semantic: {
    similarNodes: number;
    conceptClusters: number;
  };
  relevance: {
    distribution: {
      high: number;
      medium: number;
      low: number;
    };
    averageScore: number;
  };
}

export class MemoryGraph {
  private db: GraphDatabase;
  private config: MemoryGraphConfig;
  
  // Subsystems
  private temporalEngine: TemporalClusteringEngine;
  private semanticEngine: SemanticSimilarityEngine;
  private relevanceEngine: RelevanceScoringEngine;
  private decayEngine: MemoryDecayEngine;
  private pruningEngine: GraphPruningEngine;
  private queryEngine: QueryTranslationEngine;
  private contextManager: ContextWindowManager;

  // Event mappings
  private eventToNodeMappings: Map<string, any> = new Map();
  private isInitialized = false;

  constructor(config: MemoryGraphConfig) {
    this.config = config;
    this.db = new GraphDatabase(config.database);
    
    // Initialize subsystems
    this.temporalEngine = new TemporalClusteringEngine(config.temporal, this.db);
    this.semanticEngine = new SemanticSimilarityEngine(config.semantic, this.db);
    this.relevanceEngine = new RelevanceScoringEngine(this.getRelevanceConfig(), this.db);
    this.decayEngine = new MemoryDecayEngine(config.decay, this.db);
    this.pruningEngine = new GraphPruningEngine(config.pruning, this.db);
    this.queryEngine = new QueryTranslationEngine(this.db);
    this.contextManager = new ContextWindowManager(this.getContextConfig(), this.db, this.queryEngine);
    
    this.initializeEventMappings();
  }

  /**
   * Initialize the memory graph system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize database
      await this.db.initialize();
      
      // Build semantic search index
      await this.semanticEngine.buildSearchIndex();
      
      this.isInitialized = true;
      console.log('Memory graph system initialized successfully');
    } catch (error) {
      console.error('Memory graph initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process events and add to memory graph
   */
  async processEvents(events: BaseEvent[]): Promise<ProcessingResult> {
    if (!this.isInitialized) {
      throw new Error('Memory graph not initialized');
    }

    const startTime = Date.now();
    const result: ProcessingResult = {
      nodesCreated: 0,
      edgesCreated: 0,
      processingTime: 0,
      success: false
    };

    try {
      // Batch process events
      const batchOperations = [];
      
      for (const event of events) {
        try {
          const nodeOperation = await this.createNodeFromEvent(event);
          if (nodeOperation) {
            batchOperations.push(nodeOperation);
          }
        } catch (error) {
          console.error(`Failed to process event ${event.id}:`, error);
        }
      }

      // Execute batch operations
      const batchResult = await this.db.batchOperations(batchOperations);
      result.nodesCreated = batchResult.affectedNodes;
      
      // Create semantic relationships
      if (result.nodesCreated > 0) {
        const semanticEdges = await this.createSemanticRelationships(events);
        result.edgesCreated = semanticEdges;
      }

      // Update relevance scores
      await this.relevanceEngine.batchUpdateNodeRelevance(
        batchOperations.filter(op => op.target === 'node').map(op => op.data.id)
      );

      // Update temporal clusters
      await this.temporalEngine.clusterNodes();

      result.success = true;
      result.processingTime = Date.now() - startTime;
      
      console.log(`Processed ${events.length} events: ${result.nodesCreated} nodes, ${result.edgesCreated} edges created`);
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.processingTime = Date.now() - startTime;
      console.error('Event processing failed:', error);
      return result;
    }
  }

  /**
   * Query the memory graph
   */
  async query(query: string | GraphQuery, sessionId?: string, context?: any): Promise<GraphQueryResult<any>> {
    if (!this.isInitialized) {
      throw new Error('Memory graph not initialized');
    }

    try {
      let graphQuery: GraphQuery;
      
      if (typeof query === 'string') {
        // Natural language query
        graphQuery = await this.queryEngine.translateQuery(query, context);
        
        // Execute query
        const executionResult = await this.queryEngine.executeQuery(query, context);
        
        // Update context if session provided
        if (sessionId) {
          await this.contextManager.updateContextWithInteraction(sessionId, 'query', {
            query,
            results: executionResult.result,
            executionTime: executionResult.executionTime
          });
        }
        
        return executionResult.result;
      } else {
        // Direct graph query
        graphQuery = query;
        
        if (graphQuery.type === 'node') {
          return await this.db.queryNodes(graphQuery);
        } else {
          return await this.db.queryEdges(graphQuery);
        }
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Get context-aware recommendations
   */
  async getContextualRecommendations(sessionId: string, query: string, limit: number = 10): Promise<any[]> {
    try {
      const context = await this.contextManager.getRelevantContext(sessionId, query, limit);
      
      const recommendations = context.relevantNodes
        .slice(0, limit)
        .map(item => ({
          id: item.node.id,
          type: item.node.type,
          title: this.getNodeTitle(item.node),
          relevance: item.score,
          snippet: this.getNodeSnippet(item.node),
          timestamp: item.node.timestamp,
          metadata: item.node.metadata
        }));

      return recommendations;
    } catch (error) {
      console.error('Failed to get contextual recommendations:', error);
      return [];
    }
  }

  /**
   * Analyze memory graph and generate insights
   */
  async analyze(): Promise<AnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('Memory graph not initialized');
    }

    try {
      // Get basic statistics
      const stats = await this.db.getStats();
      
      // Get temporal patterns
      const temporalPatterns = await this.temporalEngine.detectPatterns();
      
      // Get relevance statistics
      const relevanceStats = await this.relevanceEngine.getRelevanceStats();
      
      // Get semantic clusters
      const semanticAnalysis = await this.analyzeSemanticStructure();
      
      const result: AnalysisResult = {
        totalNodes: stats.totalNodes,
        totalEdges: stats.totalEdges,
        activeNodes: stats.activeNodes,
        activeEdges: stats.activeEdges,
        averageRelevance: relevanceStats.averageScore,
        clustering: {
          clusters: 0, // TODO: Implement cluster counting
          averageDensity: 0,
          patterns: temporalPatterns
        },
        temporal: {
          patterns: temporalPatterns,
          trends: this.extractTrends(temporalPatterns)
        },
        semantic: {
          similarNodes: semanticAnalysis.similarNodes,
          conceptClusters: semanticAnalysis.conceptClusters
        },
        relevance: {
          distribution: relevanceStats.distribution,
          averageScore: relevanceStats.averageScore
        }
      };

      return result;
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Perform maintenance operations
   */
  async performMaintenance(): Promise<MaintenanceResult> {
    if (!this.isInitialized) {
      throw new Error('Memory graph not initialized');
    }

    const startTime = Date.now();
    const result: MaintenanceResult = {
      decayResult: null,
      pruningResult: null,
      semanticUpdateResult: null,
      statsUpdateResult: null,
      totalTime: 0,
      success: false
    };

    try {
      // Apply memory decay
      result.decayResult = await this.decayEngine.applyDecay();
      
      // Perform graph pruning
      result.pruningResult = await this.pruningEngine.pruneGraph();
      
      // Update semantic embeddings
      result.semanticUpdateResult = await this.semanticEngine.updateEmbeddings();
      
      // Update statistics
      await this.db.updateStats();
      result.statsUpdateResult = await this.db.getStats();
      
      // Clean up context windows
      await this.contextManager.cleanup();
      
      result.totalTime = Date.now() - startTime;
      result.success = true;
      
      console.log('Maintenance completed successfully');
      return result;
    } catch (error) {
      result.totalTime = Date.now() - startTime;
      console.error('Maintenance failed:', error);
      return result;
    }
  }

  /**
   * Record user interaction with memory
   */
  async recordInteraction(nodeId: string, interactionType: string, sessionId?: string, strength: number = 1.0): Promise<void> {
    try {
      // Update relevance scoring
      await this.relevanceEngine.recordUserInteraction(nodeId, interactionType, strength);
      
      // Apply decay boost
      await this.decayEngine.boostNodeOnAccess(nodeId);
      
      // Update context if session provided
      if (sessionId) {
        await this.contextManager.updateContextWithInteraction(sessionId, 'node_access', { nodeId, accessType: interactionType });
      }
    } catch (error) {
      console.error(`Failed to record interaction for node ${nodeId}:`, error);
    }
  }

  /**
   * Get memory graph statistics
   */
  async getStats(): Promise<GraphStats> {
    if (!this.isInitialized) {
      throw new Error('Memory graph not initialized');
    }

    return await this.db.getStats();
  }

  /**
   * Export memory graph data
   */
  async export(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Memory graph not initialized');
    }

    try {
      const nodesQuery = { id: 'export', type: 'node' as const, filters: [], constraints: [] };
      const edgesQuery = { id: 'export', type: 'edge' as const, filters: [], constraints: [] };
      
      const nodes = await this.db.queryNodes(nodesQuery);
      const edges = await this.db.queryEdges(edgesQuery);
      
      const exportData = {
        nodes: nodes.results,
        edges: edges.results,
        metadata: {
          exportedAt: Date.now(),
          totalNodes: nodes.total,
          totalEdges: edges.total,
          version: '1.0'
        }
      };

      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      } else {
        // CSV format would need more complex implementation
        throw new Error('CSV export not implemented yet');
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Import memory graph data
   */
  async import(data: string, format: 'json' = 'json'): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Memory graph not initialized');
    }

    try {
      if (format === 'json') {
        const importData = JSON.parse(data);
        
        // Import nodes
        for (const node of importData.nodes) {
          await this.db.createNode(node);
        }
        
        // Import edges
        for (const edge of importData.edges) {
          await this.db.createEdge(edge, edge.sourceId, edge.targetId);
        }
        
        console.log(`Imported ${importData.nodes.length} nodes and ${importData.edges.length} edges`);
      } else {
        throw new Error('Only JSON import is supported');
      }
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  /**
   * Close memory graph system
   */
  async close(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.db.close();
        this.isInitialized = false;
        console.log('Memory graph system closed successfully');
      }
    } catch (error) {
      console.error('Failed to close memory graph:', error);
      throw error;
    }
  }

  // Private helper methods
  private async createNodeFromEvent(event: BaseEvent): Promise<any> {
    const mapping = this.eventToNodeMappings.get(event.type);
    if (!mapping) {
      return null;
    }

    const content = mapping.extractContent(event);
    const metadata = mapping.extractMetadata(event);
    const tags = mapping.extractTags(event);
    const relevanceScore = mapping.relevanceScorer(event);

    const node: Omit<MemoryNode, 'id' | 'createdAt' | 'updatedAt'> = {
      type: mapping.nodeType,
      timestamp: event.timestamp,
      content,
      metadata: {
        ...metadata,
        eventId: event.id,
        source: event.source
      },
      relevanceScore,
      decayFactor: 0.1,
      degree: 0,
      clustering: 0,
      centrality: 0,
      tags,
      accessCount: 0,
      lastAccessed: Date.now(),
      confidence: 0.8,
      sourceType: 'event',
      isPruned: false
    };

    return {
      type: 'create',
      target: 'node',
      data: node
    };
  }

  private async createSemanticRelationships(events: BaseEvent[]): Promise<number> {
    let edgesCreated = 0;
    
    try {
      // Process events in batches
      for (let i = 0; i < events.length; i += 10) {
        const batch = events.slice(i, i + 10);
        
        for (const event of batch) {
          const nodeId = this.getEventNodeId(event);
          if (nodeId) {
            const createdEdges = await this.semanticEngine.createSemanticEdges(nodeId, 3);
            edgesCreated += createdEdges;
          }
        }
      }
    } catch (error) {
      console.error('Semantic relationship creation failed:', error);
    }

    return edgesCreated;
  }

  private getEventNodeId(event: BaseEvent): string | null {
    // This would typically involve looking up the node created from the event
    // For now, return null as a placeholder
    return null;
  }

  private getNodeTitle(node: MemoryNode): string {
    if (typeof node.content === 'string') {
      return node.content.substring(0, 100);
    }
    if (typeof node.content === 'object' && node.content.title) {
      return node.content.title;
    }
    return `${node.type} ${node.id.slice(0, 8)}`;
  }

  private getNodeSnippet(node: MemoryNode): string {
    const text = typeof node.content === 'string' ? node.content : 
                 typeof node.content === 'object' && node.content.text ? node.content.text :
                 JSON.stringify(node.content);
    
    return text.substring(0, 200) + (text.length > 200 ? '...' : '');
  }

  private async analyzeSemanticStructure(): Promise<{ similarNodes: number; conceptClusters: number }> {
    try {
      // This is a simplified implementation
      // In a real system, this would use more sophisticated analysis
      
      const query = {
        id: 'semantic-analysis',
        type: 'node' as const,
        filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
        constraints: [],
        limit: 1000
      };

      const result = await this.db.queryNodes(query);
      const nodes = result.results;
      
      // Count nodes with embeddings (simplified semantic analysis)
      const nodesWithEmbeddings = nodes.filter(node => node.embeddings && node.embeddings.length > 0);
      
      // Estimate concept clusters based on tags
      const allTags = nodes.flatMap(node => node.tags);
      const uniqueTags = new Set(allTags);
      
      return {
        similarNodes: nodesWithEmbeddings.length,
        conceptClusters: Math.min(uniqueTags.size, nodes.length / 10)
      };
    } catch (error) {
      console.error('Semantic analysis failed:', error);
      return { similarNodes: 0, conceptClusters: 0 };
    }
  }

  private extractTrends(patterns: any[]): string[] {
    const trends: string[] = [];
    
    patterns.forEach(pattern => {
      if (pattern.type === 'trend') {
        trends.push(pattern.description);
      } else if (pattern.type === 'burst') {
        trends.push('Activity burst detected');
      } else if (pattern.type === 'cycle') {
        trends.push('Cyclical pattern detected');
      }
    });
    
    return trends;
  }

  private initializeEventMappings(): void {
    // Initialize event to node mappings
    this.eventToNodeMappings.set('browser', {
      nodeType: NodeType.ACTIVITY,
      extractContent: (event: any) => ({
        type: 'browser_activity',
        url: event.metadata.url,
        title: event.metadata.title,
        action: event.metadata.action
      }),
      extractMetadata: (event: any) => event.metadata,
      extractTags: (event: any) => [event.metadata.action, event.metadata.domain].filter(Boolean),
      relevanceScorer: (event: any) => 0.7
    });

    this.eventToNodeMappings.set('system', {
      nodeType: NodeType.ACTIVITY,
      extractContent: (event: any) => ({
        type: 'system_activity',
        app: event.metadata.appName,
        action: event.metadata.action
      }),
      extractMetadata: (event: any) => event.metadata,
      extractTags: (event: any) => [event.metadata.appName, event.metadata.action].filter(Boolean),
      relevanceScorer: (event: any) => 0.6
    });

    // Add more mappings as needed...
  }

  private getRelevanceConfig(): RelevanceConfig {
    return {
      recencyWeight: 0.3,
      frequencyWeight: 0.2,
      interactionWeight: 0.3,
      semanticWeight: 0.1,
      centralityWeight: 0.1,
      timeDecayRate: 0.1,
      interactionBoost: 1.2,
      semanticThreshold: 0.5,
      typeWeights: {
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
      },
      edgeRecencyWeight: 0.4,
      edgeStrengthWeight: 0.4,
      edgeInteractionWeight: 0.2
    };
  }

  private getContextConfig(): ContextWindowConfig {
    return {
      maxRecentNodes: 50,
      maxRelevantNodes: 100,
      maxRecentEdges: 25,
      maxRelevantEdges: 50,
      maxQueryHistory: 20,
      timeRangeMs: 24 * 60 * 60 * 1000, // 24 hours
      relevanceThreshold: 0.3,
      semanticSimilarityThreshold: 0.6,
      maxContextSize: 300,
      decayRate: 0.05,
      boostRecentInteractions: 1.1
    };
  }
}

interface MaintenanceResult {
  decayResult: any;
  pruningResult: any;
  semanticUpdateResult: any;
  statsUpdateResult: any;
  totalTime: number;
  success: boolean;
}