/**
 * Type definitions for Memory Graph system
 * Optimized for high-performance knowledge graph operations
 */

export interface MemoryNode {
  id: string;
  type: 'activity' | 'pattern' | 'resource' | 'concept';
  timestamp: number;
  content: any;
  metadata: Record<string, any>;
  relationships: MemoryEdge[];
  relevanceScore: number;
  decayFactor: number;
  spatial?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface MemoryEdge {
  targetId: string;
  type: 'temporal' | 'semantic' | 'causal' | 'spatial';
  strength: number;
  context: string;
  timestamp: number;
}

export interface SpatialQuery {
  center?: {
    x: number;
    y: number;
    z?: number;
  };
  radius: number;
  timeRange?: {
    start: number;
    end: number;
  };
  types?: string[];
  minRelevance?: number;
  limit?: number;
}

export interface GraphQueryResult {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  queryTime: number;
  totalResults: number;
  relevanceScore: number;
}

export interface MemoryGraphConfig {
  maxNodes: number;
  spatialIndexing: boolean;
  cacheSize: number;
  decayRate: number;
  enableParallel: boolean;
}