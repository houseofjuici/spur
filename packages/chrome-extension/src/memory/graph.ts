import { MemoryNode } from '../types/spur';

interface GraphNode extends MemoryNode {
  id: string;
  embeddings?: number[];
  importance: number;
  frequency: number;
  lastAccessed: string;
}

interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  type: 'semantic' | 'temporal' | 'categorical' | 'user-defined';
  metadata?: any;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  statistics: {
    totalNodes: number;
    totalEdges: number;
    averageDegree: number;
    clusteringCoefficient: number;
  };
}

interface SearchOptions {
  query: string;
  type?: string[];
  dateRange?: { start: string; end: string };
  tags?: string[];
  limit?: number;
  includeConnections?: boolean;
}

interface GraphOptions {
  maxNodes?: number;
  maxConnections?: number;
  timeDecay?: number;
  importanceThreshold?: number;
}

class MemoryGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private isInitialized = false;
  private readonly STORAGE_KEY = 'spur_memory_graph';

  async initialize(): Promise<void> {
    try {
      // Load existing graph from storage
      await this.loadFromStorage();
      
      // Initialize with empty graph if none exists
      if (this.nodes.size === 0) {
        await this.createInitialGraph();
      }

      this.isInitialized = true;
      console.log('Memory graph initialized successfully');
    } catch (error) {
      console.error('Failed to initialize memory graph:', error);
      throw error;
    }
  }

  private async createInitialGraph(): Promise<void> {
    // Create initial graph structure
    console.log('Creating initial memory graph');
    await this.saveToStorage();
  }

  async isInitialized(): Promise<boolean> {
    return this.isInitialized;
  }

  async addMemory(memory: MemoryNode): Promise<string> {
    try {
      const nodeId = memory.id || this.generateNodeId();
      
      // Create graph node
      const graphNode: GraphNode = {
        ...memory,
        id: nodeId,
        importance: this.calculateImportance(memory),
        frequency: 1,
        lastAccessed: new Date().toISOString(),
        embeddings: await this.generateEmbeddings(memory.content)
      };

      // Add node to graph
      this.nodes.set(nodeId, graphNode);

      // Find and create connections
      await this.createConnections(graphNode);

      // Update statistics
      this.updateNodeStatistics(graphNode);

      // Save to storage
      await this.saveToStorage();

      console.log(`Memory added to graph: ${nodeId}`);
      return nodeId;
    } catch (error) {
      console.error('Failed to add memory to graph:', error);
      throw error;
    }
  }

  async updateMemory(nodeId: string, updates: Partial<MemoryNode>): Promise<void> {
    try {
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new Error(`Memory node not found: ${nodeId}`);
      }

      // Update node
      Object.assign(node, updates);
      node.lastAccessed = new Date().toISOString();
      node.importance = this.calculateImportance(node);

      // Recalculate connections if content changed
      if (updates.content) {
        await this.updateConnections(nodeId);
      }

      await this.saveToStorage();
      console.log(`Memory updated: ${nodeId}`);
    } catch (error) {
      console.error('Failed to update memory:', error);
      throw error;
    }
  }

  async deleteMemory(nodeId: string): Promise<void> {
    try {
      const node = this.nodes.get(nodeId);
      if (!node) {
        return;
      }

      // Remove node
      this.nodes.delete(nodeId);

      // Remove all edges connected to this node
      const edgesToRemove: string[] = [];
      for (const [edgeId, edge] of this.edges) {
        if (edge.from === nodeId || edge.to === nodeId) {
          edgesToRemove.push(edgeId);
        }
      }

      for (const edgeId of edgesToRemove) {
        this.edges.delete(edgeId);
      }

      await this.saveToStorage();
      console.log(`Memory deleted: ${nodeId}`);
    } catch (error) {
      console.error('Failed to delete memory:', error);
      throw error;
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<MemoryNode[]> {
    try {
      const {
        type,
        dateRange,
        tags,
        limit = 20,
        includeConnections = true
      } = options;

      let results: GraphNode[] = Array.from(this.nodes.values());

      // Filter by type
      if (type && type.length > 0) {
        results = results.filter(node => type.includes(node.type));
      }

      // Filter by date range
      if (dateRange) {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        results = results.filter(node => {
          const nodeDate = new Date(node.timestamp);
          return nodeDate >= startDate && nodeDate <= endDate;
        });
      }

      // Filter by tags
      if (tags && tags.length > 0) {
        results = results.filter(node => 
          node.tags.some(tag => tags.includes(tag))
        );
      }

      // Perform semantic search on content
      if (query.trim()) {
        results = this.semanticSearch(results, query);
      }

      // Sort by relevance score
      results = this.sortByRelevance(results, query);

      // Apply limit
      results = results.slice(0, limit);

      // Include connected memories if requested
      if (includeConnections && results.length > 0) {
        results = this.includeConnectedMemories(results, limit);
      }

      // Update access statistics
      for (const node of results) {
        node.frequency++;
        node.lastAccessed = new Date().toISOString();
      }

      await this.saveToStorage();

      return results.map(node => this.convertToMemoryNode(node));
    } catch (error) {
      console.error('Failed to search memories:', error);
      throw error;
    }
  }

  private semanticSearch(nodes: GraphNode[], query: string): GraphNode[] {
    // Simple keyword matching for now
    // In production, this would use vector embeddings and semantic similarity
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return nodes.filter(node => {
      const content = node.content.toLowerCase();
      return queryTerms.some(term => content.includes(term));
    });
  }

  private sortByRelevance(nodes: GraphNode[], query: string): GraphNode[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return nodes.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, queryTerms);
      const scoreB = this.calculateRelevanceScore(b, queryTerms);
      return scoreB - scoreA;
    });
  }

  private calculateRelevanceScore(node: GraphNode, queryTerms: string[]): number {
    let score = 0;
    const content = node.content.toLowerCase();

    // Match score
    for (const term of queryTerms) {
      if (content.includes(term)) {
        score += 10;
      }
    }

    // Tag matches
    for (const tag of node.tags) {
      if (queryTerms.includes(tag.toLowerCase())) {
        score += 5;
      }
    }

    // Boost by importance and frequency
    score += node.importance * 2;
    score += node.frequency;

    // Recency boost
    const daysSinceAccess = (Date.now() - new Date(node.lastAccessed).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceAccess);

    return score;
  }

  private includeConnectedMemories(results: GraphNode[], limit: number): GraphNode[] {
    const connectedNodes = new Set<string>(results.map(n => n.id));
    const additionalNodes: GraphNode[] = [];

    // Add directly connected nodes
    for (const node of results) {
      const connections = this.getConnectedNodes(node.id);
      for (const connected of connections) {
        if (!connectedNodes.has(connected.id)) {
          connectedNodes.add(connected.id);
          additionalNodes.push(connected);
        }
      }
    }

    return [...results, ...additionalNodes].slice(0, limit);
  }

  async getGraphData(options: GraphOptions = {}): Promise<GraphData> {
    try {
      const {
        maxNodes = 100,
        maxConnections = 200,
        timeDecay = 0.95,
        importanceThreshold = 0.1
      } = options;

      // Filter nodes by importance
      let nodes = Array.from(this.nodes.values())
        .filter(node => node.importance >= importanceThreshold)
        .sort((a, b) => b.importance - a.importance)
        .slice(0, maxNodes);

      // Apply time decay
      const now = Date.now();
      nodes = nodes.map(node => ({
        ...node,
        importance: node.importance * Math.pow(timeDecay, 
          (now - new Date(node.timestamp).getTime()) / (1000 * 60 * 60 * 24))
      }));

      // Get edges for these nodes
      const nodeIds = new Set(nodes.map(n => n.id));
      const edges = Array.from(this.edges.values())
        .filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, maxConnections);

      // Calculate statistics
      const statistics = this.calculateGraphStatistics(nodes, edges);

      return {
        nodes,
        edges,
        statistics
      };
    } catch (error) {
      console.error('Failed to get graph data:', error);
      throw error;
    }
  }

  private calculateGraphStatistics(nodes: GraphNode[], edges: GraphEdge[]) {
    const totalNodes = nodes.length;
    const totalEdges = edges.length;
    const averageDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;
    
    // Simple clustering coefficient calculation
    let clusteringSum = 0;
    let clusteringCount = 0;

    for (const node of nodes) {
      const neighbors = this.getConnectedNodes(node.id);
      if (neighbors.length > 1) {
        const possibleConnections = neighbors.length * (neighbors.length - 1) / 2;
        const actualConnections = neighbors.reduce((sum, neighbor) => {
          return sum + this.getConnectedNodes(neighbor.id)
            .filter(n => neighbors.some(n2 => n2.id === n.id))
            .length;
        }, 0) / 2; // Divide by 2 because connections are bidirectional

        clusteringSum += actualConnections / possibleConnections;
        clusteringCount++;
      }
    }

    const clusteringCoefficient = clusteringCount > 0 ? clusteringSum / clusteringCount : 0;

    return {
      totalNodes,
      totalEdges,
      averageDegree,
      clusteringCoefficient
    };
  }

  private async createConnections(node: GraphNode): Promise<void> {
    // Find semantically similar nodes
    const similarNodes = this.findSimilarNodes(node);
    
    // Create semantic connections
    for (const similar of similarNodes) {
      const edgeId = this.generateEdgeId(node.id, similar.id);
      const weight = this.calculateSemanticSimilarity(node, similar);
      
      if (weight > 0.3) { // Threshold for creating connection
        this.edges.set(edgeId, {
          from: node.id,
          to: similar.id,
          weight,
          type: 'semantic'
        });
      }
    }

    // Create temporal connections (nodes created close in time)
    const temporalNodes = this.findTemporalNodes(node);
    for (const temporal of temporalNodes) {
      const edgeId = this.generateEdgeId(node.id, temporal.id);
      const weight = this.calculateTemporalSimilarity(node, temporal);
      
      if (weight > 0.5) {
        this.edges.set(edgeId, {
          from: node.id,
          to: temporal.id,
          weight,
          type: 'temporal'
        });
      }
    }

    // Create categorical connections (same tags)
    const categoricalNodes = this.findCategoricalNodes(node);
    for (const categorical of categoricalNodes) {
      const edgeId = this.generateEdgeId(node.id, categorical.id);
      const weight = this.calculateCategoricalSimilarity(node, categorical);
      
      if (weight > 0.4) {
        this.edges.set(edgeId, {
          from: node.id,
          to: categorical.id,
          weight,
          type: 'categorical'
        });
      }
    }
  }

  private async updateConnections(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Remove existing connections
    const edgesToRemove: string[] = [];
    for (const [edgeId, edge] of this.edges) {
      if (edge.from === nodeId || edge.to === nodeId) {
        edgesToRemove.push(edgeId);
      }
    }

    for (const edgeId of edgesToRemove) {
      this.edges.delete(edgeId);
    }

    // Recreate connections
    await this.createConnections(node);
  }

  private findSimilarNodes(node: GraphNode): GraphNode[] {
    const similar: GraphNode[] = [];
    const nodeTerms = this.extractTerms(node.content);

    for (const [id, otherNode] of this.nodes) {
      if (id === node.id) continue;

      const otherTerms = this.extractTerms(otherNode.content);
      const similarity = this.calculateTermSimilarity(nodeTerms, otherTerms);

      if (similarity > 0.3) {
        similar.push(otherNode);
      }
    }

    return similar.sort((a, b) => {
      const similarityA = this.calculateTermSimilarity(nodeTerms, this.extractTerms(a.content));
      const similarityB = this.calculateTermSimilarity(nodeTerms, this.extractTerms(b.content));
      return similarityB - similarityA;
    }).slice(0, 5); // Top 5 similar nodes
  }

  private findTemporalNodes(node: GraphNode): GraphNode[] {
    const nodeTime = new Date(node.timestamp).getTime();
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours

    return Array.from(this.nodes.values())
      .filter(other => {
        if (other.id === node.id) return false;
        const otherTime = new Date(other.timestamp).getTime();
        return Math.abs(nodeTime - otherTime) < timeWindow;
      })
      .slice(0, 3); // Top 3 temporal nodes
  }

  private findCategoricalNodes(node: GraphNode): GraphNode[] {
    return Array.from(this.nodes.values())
      .filter(other => {
        if (other.id === node.id) return false;
        const commonTags = node.tags.filter(tag => other.tags.includes(tag));
        return commonTags.length > 0;
      })
      .sort((a, b) => {
        const commonA = a.tags.filter(tag => node.tags.includes(tag)).length;
        const commonB = b.tags.filter(tag => node.tags.includes(tag)).length;
        return commonB - commonA;
      })
      .slice(0, 5); // Top 5 categorical nodes
  }

  private extractTerms(content: string): string[] {
    return content.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .filter((term, index, arr) => arr.indexOf(term) === index); // Unique terms
  }

  private calculateTermSimilarity(terms1: string[], terms2: string[]): number {
    const intersection = terms1.filter(term => terms2.includes(term));
    const union = [...new Set([...terms1, ...terms2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private calculateSemanticSimilarity(node1: GraphNode, node2: GraphNode): number {
    const terms1 = this.extractTerms(node1.content);
    const terms2 = this.extractTerms(node2.content);
    return this.calculateTermSimilarity(terms1, terms2);
  }

  private calculateTemporalSimilarity(node1: GraphNode, node2: GraphNode): number {
    const time1 = new Date(node1.timestamp).getTime();
    const time2 = new Date(node2.timestamp).getTime();
    const timeDiff = Math.abs(time1 - time2);
    const maxDiff = 24 * 60 * 60 * 1000; // 24 hours
    
    return Math.max(0, 1 - (timeDiff / maxDiff));
  }

  private calculateCategoricalSimilarity(node1: GraphNode, node2: GraphNode): number {
    const commonTags = node1.tags.filter(tag => node2.tags.includes(tag));
    const totalTags = new Set([...node1.tags, ...node2.tags]).size;
    
    return totalTags > 0 ? commonTags.length / totalTags : 0;
  }

  private getConnectedNodes(nodeId: string): GraphNode[] {
    const connected: GraphNode[] = [];
    
    for (const edge of this.edges.values()) {
      if (edge.from === nodeId) {
        const node = this.nodes.get(edge.to);
        if (node) connected.push(node);
      } else if (edge.to === nodeId) {
        const node = this.nodes.get(edge.from);
        if (node) connected.push(node);
      }
    }
    
    return connected;
  }

  private calculateImportance(memory: MemoryNode): number {
    let importance = 0.5; // Base importance

    // Boost by content length
    importance += Math.min(0.3, memory.content.length / 1000);

    // Boost by number of tags
    importance += Math.min(0.2, memory.tags.length / 10);

    // Boost by type
    const typeWeights = {
      'voice': 0.2,
      'email': 0.15,
      'text': 0.1,
      'bookmark': 0.05,
      'note': 0.1
    };
    importance += typeWeights[memory.type as keyof typeof typeWeights] || 0;

    // Boost by recency
    const daysSinceCreation = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    importance += Math.max(0, 0.2 - (daysSinceCreation / 365));

    return Math.min(1, importance);
  }

  private updateNodeStatistics(node: GraphNode): void {
    // Update frequency and last accessed time
    node.frequency++;
    node.lastAccessed = new Date().toISOString();
  }

  private async generateEmbeddings(content: string): Promise<number[]> {
    // Simple embeddings based on word frequencies
    // In production, this would use a proper embedding model
    const terms = this.extractTerms(content);
    const embedding = new Array(50).fill(0); // 50-dimensional embedding

    // Simple hash-based embedding
    for (let i = 0; i < terms.length && i < 50; i++) {
      const term = terms[i];
      const hash = this.simpleHash(term);
      embedding[i % 50] = (hash % 100) / 100;
    }

    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEdgeId(from: string, to: string): string {
    return `edge_${from}_${to}`;
  }

  private convertToMemoryNode(graphNode: GraphNode): MemoryNode {
    const { embeddings, importance, frequency, lastAccessed, ...memoryNode } = graphNode;
    return memoryNode;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      if (result[this.STORAGE_KEY]) {
        const data = result[this.STORAGE_KEY];
        this.nodes = new Map(data.nodes || []);
        this.edges = new Map(data.edges || []);
        console.log(`Loaded ${this.nodes.size} nodes and ${this.edges.size} edges from storage`);
      }
    } catch (error) {
      console.error('Failed to load graph from storage:', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const data = {
        nodes: Array.from(this.nodes.entries()),
        edges: Array.from(this.edges.entries()),
        savedAt: new Date().toISOString()
      };

      await chrome.storage.local.set({ [this.STORAGE_KEY]: data });
    } catch (error) {
      console.error('Failed to save graph to storage:', error);
    }
  }

  async sync(): Promise<void> {
    try {
      // Clean up old data
      await this.cleanupOldData();

      // Recalculate connections for all nodes
      await this.recalculateAllConnections();

      // Save to storage
      await this.saveToStorage();

      console.log('Memory graph sync completed');
    } catch (error) {
      console.error('Failed to sync memory graph:', error);
      throw error;
    }
  }

  private async cleanupOldData(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365); // Keep 1 year of data

    const nodesToRemove: string[] = [];
    for (const [nodeId, node] of this.nodes) {
      if (new Date(node.timestamp) < cutoffDate) {
        nodesToRemove.push(nodeId);
      }
    }

    for (const nodeId of nodesToRemove) {
      await this.deleteMemory(nodeId);
    }
  }

  private async recalculateAllConnections(): Promise<void> {
    // Clear all edges
    this.edges.clear();

    // Recreate connections for all nodes
    for (const node of this.nodes.values()) {
      await this.createConnections(node);
    }
  }

  async exportData(format: string = 'json', filters?: any): Promise<string> {
    try {
      let data: any;

      switch (format) {
        case 'json':
          data = {
            nodes: Array.from(this.nodes.entries()),
            edges: Array.from(this.edges.entries()),
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
          };
          break;

        case 'csv':
          // Simple CSV export
          const nodes = Array.from(this.nodes.values());
          const headers = ['id', 'type', 'content', 'timestamp', 'tags', 'importance'];
          const rows = nodes.map(node => [
            node.id,
            node.type,
            `"${node.content.replace(/"/g, '""')}"`,
            node.timestamp,
            node.tags.join(';'),
            node.importance.toString()
          ]);
          
          data = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
          break;

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Failed to export graph data:', error);
      throw error;
    }
  }

  async importData(data: string, format: string = 'json'): Promise<void> {
    try {
      switch (format) {
        case 'json':
          const parsed = JSON.parse(data);
          
          if (parsed.nodes) {
            this.nodes = new Map(parsed.nodes);
          }
          
          if (parsed.edges) {
            this.edges = new Map(parsed.edges);
          }
          
          break;

        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      await this.saveToStorage();
      console.log('Graph data imported successfully');
    } catch (error) {
      console.error('Failed to import graph data:', error);
      throw error;
    }
  }

  async getStatistics(): Promise<any> {
    const nodes = Array.from(this.nodes.values());
    const edges = Array.from(this.edges.values());

    const typeDistribution = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tagDistribution = nodes.reduce((acc, node) => {
      for (const tag of node.tags) {
        acc[tag] = (acc[tag] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      typeDistribution,
      tagDistribution: Object.entries(tagDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .reduce((acc, [tag, count]) => {
          acc[tag] = count;
          return acc;
        }, {} as Record<string, number>),
      averageImportance: nodes.reduce((sum, node) => sum + node.importance, 0) / nodes.length,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const memoryGraph = new MemoryGraph();
export { MemoryGraph, type GraphData, type SearchOptions, type GraphOptions };