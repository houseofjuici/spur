// Enhanced memory graph types for the Spur Super App
// This file extends the base types from @/types/index.ts with additional functionality

import { 
  MemoryNode as BaseMemoryNode, 
  MemoryEdge as BaseMemoryEdge, 
  NodeType, 
  EdgeType 
} from '@/types';

// Enhanced node with additional graph-specific properties
export interface MemoryNode extends BaseMemoryNode {
  // Graph-specific properties
  degree: number; // Number of connections
  clustering: number; // Local clustering coefficient
  centrality: number; // Node centrality score
  community?: string; // Community/cluster ID
  tags: string[]; // Semantic tags
  embeddings?: number[]; // Vector embeddings for semantic search
  accessCount: number; // Number of times accessed
  lastAccessed: number; // Last access timestamp
  confidence: number; // Confidence score (0-1)
  sourceType: 'event' | 'pattern' | 'user' | 'system';
  isPruned: boolean; // Whether node has been pruned
}

// Enhanced edge with additional relationship properties
export interface MemoryEdge extends BaseMemoryEdge {
  // Graph-specific properties
  bidirectional: boolean;
  weight: number; // Relationship weight
  probability: number; // Relationship probability
  decayRate: number; // Decay rate for relationship strength
  isActive: boolean; // Whether edge is active
  sourceId: string; // Source node ID (for bidirectional edges)
  interactionCount: number; // Number of interactions
  lastInteraction: number; // Last interaction timestamp
}

// Graph query interface
export interface GraphQuery {
  id: string;
  type: 'node' | 'edge' | 'path' | 'pattern';
  filters: QueryFilter[];
  constraints: QueryConstraint[];
  limit?: number;
  offset?: number;
  sortBy?: SortOption[];
  includeInactive?: boolean;
  context?: QueryContext;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
  negate?: boolean;
}

export interface QueryConstraint {
  type: 'temporal' | 'semantic' | 'structural';
  params: Record<string, any>;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryContext {
  sessionId?: string;
  userId?: string;
  timeRange?: {
    start: number;
    end: number;
  };
  relevanceThreshold?: number;
  semanticSimilarity?: number;
}

// Query result interface
export interface GraphQueryResult<T = any> {
  query: GraphQuery;
  results: T[];
  total: number;
  executionTime: number;
  metadata: {
    nodesScanned: number;
    edgesScanned: number;
    relevanceScores: number[];
    semanticMatches: number;
  };
}

// Graph analytics interface
export interface GraphAnalytics {
  nodeCount: number;
  edgeCount: number;
  averageDegree: number;
  density: number;
  clusteringCoefficient: number;
  diameter?: number;
  communities: CommunityInfo[];
  centralityScores: CentralityScores;
  temporalPatterns: TemporalPattern[];
}

export interface CommunityInfo {
  id: string;
  size: number;
  density: number;
  centralNodes: string[];
  averageRelevance: number;
  dominantType: NodeType;
  timeRange: {
    start: number;
    end: number;
  };
}

export interface CentralityScores {
  degree: Map<string, number>;
  betweenness: Map<string, number>;
  closeness: Map<string, number>;
  eigenvector: Map<string, number>;
  pagerank: Map<string, number>;
}

export interface TemporalPattern {
  type: 'burst' | 'cycle' | 'trend' | 'anomaly';
  timeframe: number;
  confidence: number;
  affectedNodes: string[];
  description: string;
}

// Memory decay configuration
export interface DecayConfig {
  enabled: boolean;
  baseRate: number; // Base decay rate (e.g., 0.1 for 10% decay per period)
  timeUnit: 'hour' | 'day' | 'week' | 'month';
  minimumRelevance: number; // Minimum relevance before pruning
  accessBoost: number; // Boost factor when accessed
  decayFunction: 'exponential' | 'linear' | 'logarithmic';
}

// Graph pruning configuration
export interface PruningConfig {
  enabled: boolean;
  threshold: number; // Relevance threshold for pruning
  maxEdgesPerNode: number; // Maximum edges per node
  maxNodeAge: number; // Maximum age in milliseconds
  preserveImportant: boolean; // Preserve high-centrality nodes
  batchSize: number; // Number of nodes to prune per batch
  frequency: number; // Pruning frequency in milliseconds
}

// Semantic similarity configuration
export interface SemanticConfig {
  enabled: boolean;
  model: 'tfidf' | 'word2vec' | 'sentence-transformers' | 'custom';
  threshold: number; // Similarity threshold for linking
  fieldWeights: Record<string, number>; // Weights for different content fields
  boostFactors: {
    sameType: number;
    sameTimeframe: number;
    sameTags: number;
  };
}

// Temporal clustering configuration
export interface TemporalConfig {
  enabled: boolean;
  windowSize: number; // Time window for clustering in milliseconds
  maxClusterSize: number; // Maximum nodes per cluster
  minClusterSize: number; // Minimum nodes per cluster
  overlapThreshold: number; // Overlap threshold for merging clusters
  decayRate: number; // Cluster decay rate
}

// Graph database configuration
export interface GraphDatabaseConfig {
  path: string;
  maxMemory: number; // Maximum memory usage in MB
  batchSize: number; // Batch size for bulk operations
  indexPaths: string[]; // Index paths
  cacheSize: number; // Cache size in MB
  vacuumThreshold: number; // Vacuum threshold
  walMode: boolean; // Write-ahead logging
  synchronous: 'off' | 'normal' | 'full' | 'extra';
  tempStore: 'default' | 'file' | 'memory';
  mmapSize: number; // Memory-mapped file size in MB
}

// Complete graph configuration
export interface MemoryGraphConfig {
  database: GraphDatabaseConfig;
  decay: DecayConfig;
  pruning: PruningConfig;
  semantic: SemanticConfig;
  temporal: TemporalConfig;
  analytics: {
    enabled: boolean;
    updateInterval: number; // Update interval in milliseconds
    saveHistory: boolean;
    historyRetention: number; // History retention in milliseconds
  };
}

// Event to node transformation interface
export interface EventToNodeMapping {
  eventType: string;
  nodeType: NodeType;
  extractContent: (event: any) => any;
  extractMetadata: (event: any) => Record<string, any>;
  extractTags: (event: any) => string[];
  relevanceScorer: (event: any) => number;
}

// Pattern detection interface
export interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  nodeTypes: NodeType[];
  edgeTypes: EdgeType[];
  temporalConstraints: {
    maxDuration: number;
    minDuration: number;
    order: 'sequential' | 'concurrent' | 'any';
  };
  semanticConstraints: {
    similarityThreshold: number;
    requiredKeywords: string[];
    excludedKeywords: string[];
  };
  structuralConstraints: {
    minNodes: number;
    maxNodes: number;
    connectivity: 'connected' | 'disconnected' | 'any';
  };
  confidence: number;
  action: PatternAction;
}

export interface PatternAction {
  type: 'alert' | 'tag' | 'link' | 'create_node' | 'create_edge';
  params: Record<string, any>;
}

// Export utility types
export type NodeId = string;
export type EdgeId = string;
export type GraphId = string;

export type GraphOperationResult = {
  success: boolean;
  affectedNodes: number;
  affectedEdges: number;
  executionTime: number;
  error?: string;
};

export type BatchOperation = {
  type: 'create' | 'update' | 'delete';
  target: 'node' | 'edge';
  data: any;
};

export type GraphStats = {
  totalNodes: number;
  totalEdges: number;
  activeNodes: number;
  activeEdges: number;
  averageDegree: number;
  memoryUsage: number;
  lastUpdate: number;
};