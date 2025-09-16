import { GraphQuery, GraphQueryResult, QueryFilter, QueryConstraint, SortOption, QueryContext } from './types';
import { GraphDatabase } from './database';
import { MemoryNode, MemoryEdge } from './types';
import { NodeType, EdgeType } from '@/types';

export interface QueryIntent {
  type: 'search' | 'find' | 'list' | 'analyze' | 'connect' | 'recent' | 'related';
  target: 'nodes' | 'edges' | 'both';
  criteria: QueryCriteria;
  confidence: number;
}

export interface QueryCriteria {
  timeRange?: { start: number; end: number };
  nodeTypes?: NodeType[];
  edgeTypes?: EdgeType[];
  keywords?: string[];
  tags?: string[];
  relevanceThreshold?: number;
  limit?: number;
  sortBy?: 'time' | 'relevance' | 'frequency' | 'centrality';
  sortOrder?: 'asc' | 'desc';
}

export class QueryTranslationEngine {
  private db: GraphDatabase;
  private intentPatterns: Map<string, IntentPattern>;
  private keywordMappings: Map<string, QueryMapping>;

  constructor(db: GraphDatabase) {
    this.db = db;
    this.initializeIntentPatterns();
    this.initializeKeywordMappings();
  }

  /**
   * Translate natural language query to GraphQuery
   */
  async translateQuery(naturalQuery: string, context?: QueryContext): Promise<GraphQuery> {
    try {
      // Normalize query
      const normalizedQuery = this.normalizeQuery(naturalQuery);
      
      // Extract intent
      const intent = this.extractIntent(normalizedQuery);
      
      // Extract criteria
      const criteria = this.extractCriteria(normalizedQuery, intent);
      
      // Build GraphQuery
      const graphQuery = this.buildGraphQuery(intent, criteria, context);
      
      return graphQuery;
    } catch (error) {
      console.error('Query translation failed:', error);
      // Return a default query as fallback
      return this.getDefaultQuery(naturalQuery);
    }
  }

  /**
   * Execute natural language query
   */
  async executeQuery(naturalQuery: string, context?: QueryContext): Promise<QueryExecutionResult> {
    try {
      const startTime = Date.now();
      
      // Translate query
      const graphQuery = await this.translateQuery(naturalQuery, context);
      
      // Execute query
      let result: GraphQueryResult<any>;
      let queryType: 'nodes' | 'edges';
      
      if (graphQuery.type === 'node' || graphQuery.type === 'path') {
        result = await this.db.queryNodes(graphQuery);
        queryType = 'nodes';
      } else {
        result = await this.db.queryEdges(graphQuery);
        queryType = 'edges';
      }
      
      const executionTime = Date.now() - startTime;

      return {
        naturalQuery,
        translatedQuery: graphQuery,
        result,
        queryType,
        executionTime,
        success: true
      };
    } catch (error) {
      console.error('Query execution failed:', error);
      return {
        naturalQuery,
        translatedQuery: this.getDefaultQuery(naturalQuery),
        result: { query: this.getDefaultQuery(naturalQuery), results: [], total: 0, executionTime: 0, metadata: { nodesScanned: 0, edgesScanned: 0, relevanceScores: [], semanticMatches: 0 } },
        queryType: 'nodes',
        executionTime: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get query suggestions based on partial input
   */
  async getSuggestions(partialQuery: string, limit: number = 5): Promise<QuerySuggestion[]> {
    try {
      const normalized = this.normalizeQuery(partialQuery);
      const suggestions: QuerySuggestion[] = [];

      // Time-based suggestions
      if (this.matchesPattern(normalized, ['recent', 'latest', 'today', 'yesterday'])) {
        suggestions.push({
          text: 'show me recent activities',
          description: 'Display recent activities and events',
          confidence: 0.9
        });
      }

      // Type-based suggestions
      if (this.matchesPattern(normalized, ['find', 'search', 'look'])) {
        suggestions.push({
          text: 'find code-related activities',
          description: 'Search for programming and development activities',
          confidence: 0.8
        });
      }

      // Tag-based suggestions
      if (this.matchesPattern(normalized, ['tag', 'labeled'])) {
        suggestions.push({
          text: 'show activities with productivity tag',
          description: 'Find activities tagged with productivity',
          confidence: 0.7
        });
      }

      // Relationship suggestions
      if (this.matchesPattern(normalized, ['related', 'connected', 'similar'])) {
        suggestions.push({
          text: 'find activities related to web development',
          description: 'Discover connected activities and patterns',
          confidence: 0.8
        });
      }

      // Analytical suggestions
      if (this.matchesPattern(normalized, ['analyze', 'statistics', 'stats'])) {
        suggestions.push({
          text: 'analyze my activity patterns',
          description: 'Get insights about your work patterns',
          confidence: 0.7
        });
      }

      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Normalize query text
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract query intent
   */
  private extractIntent(query: string): QueryIntent {
    let bestMatch: { pattern: IntentPattern; score: number } | null = null;
    
    for (const [patternName, pattern] of this.intentPatterns) {
      const score = this.calculatePatternMatch(query, pattern);
      if (score > (bestMatch?.score || 0) && score > 0.3) {
        bestMatch = { pattern, score };
      }
    }

    if (bestMatch) {
      return {
        type: bestMatch.pattern.intent,
        target: bestMatch.pattern.target,
        criteria: {},
        confidence: bestMatch.score
      };
    }

    // Default intent
    return {
      type: 'search',
      target: 'nodes',
      criteria: {},
      confidence: 0.5
    };
  }

  /**
   * Extract query criteria
   */
  private extractCriteria(query: string, intent: QueryIntent): QueryCriteria {
    const criteria: QueryCriteria = {};

    // Extract time range
    criteria.timeRange = this.extractTimeRange(query);
    
    // Extract node types
    criteria.nodeTypes = this.extractNodeTypes(query);
    
    // Extract edge types
    criteria.edgeTypes = this.extractEdgeTypes(query);
    
    // Extract keywords
    criteria.keywords = this.extractKeywords(query);
    
    // Extract tags
    criteria.tags = this.extractTags(query);
    
    // Extract relevance threshold
    criteria.relevanceThreshold = this.extractRelevanceThreshold(query);
    
    // Extract limit
    criteria.limit = this.extractLimit(query);
    
    // Extract sort preferences
    const sortInfo = this.extractSortInfo(query);
    criteria.sortBy = sortInfo.sortBy;
    criteria.sortOrder = sortInfo.sortOrder;

    return criteria;
  }

  /**
   * Build GraphQuery from intent and criteria
   */
  private buildGraphQuery(intent: QueryIntent, criteria: QueryCriteria, context?: QueryContext): GraphQuery {
    const filters: QueryFilter[] = [];
    const constraints: QueryConstraint[] = [];
    const sortBy: SortOption[] = [];

    // Build filters based on criteria
    if (criteria.timeRange) {
      filters.push({
        field: 'timestamp',
        operator: 'gte',
        value: criteria.timeRange.start
      });
      filters.push({
        field: 'timestamp',
        operator: 'lte',
        value: criteria.timeRange.end
      });
    }

    if (criteria.nodeTypes && criteria.nodeTypes.length > 0) {
      if (criteria.nodeTypes.length === 1) {
        filters.push({
          field: 'type',
          operator: 'eq',
          value: criteria.nodeTypes[0]
        });
      } else {
        filters.push({
          field: 'type',
          operator: 'in',
          value: criteria.nodeTypes
        });
      }
    }

    if (criteria.relevanceThreshold) {
      filters.push({
        field: 'relevance_score',
        operator: 'gte',
        value: criteria.relevanceThreshold
      });
    }

    // Build constraints for advanced filtering
    if (criteria.keywords && criteria.keywords.length > 0) {
      constraints.push({
        type: 'semantic',
        params: { keywords: criteria.keywords }
      });
    }

    if (criteria.tags && criteria.tags.length > 0) {
      // Tag filtering needs special handling in the database layer
      constraints.push({
        type: 'semantic',
        params: { tags: criteria.tags }
      });
    }

    // Build sorting
    if (criteria.sortBy) {
      const fieldMap: Record<string, string> = {
        time: 'timestamp',
        relevance: 'relevance_score',
        frequency: 'access_count',
        centrality: 'centrality'
      };
      
      sortBy.push({
        field: fieldMap[criteria.sortBy] || 'timestamp',
        direction: criteria.sortOrder || 'desc'
      });
    } else {
      sortBy.push({ field: 'timestamp', direction: 'desc' });
    }

    return {
      id: `nlq_${Date.now()}`,
      type: intent.target === 'edges' ? 'edge' : 'node',
      filters,
      constraints,
      limit: criteria.limit || 20,
      sortBy,
      includeInactive: false,
      context: context || {}
    };
  }

  /**
   * Extract time range from query
   */
  private extractTimeRange(query: string): { start: number; end: number } | undefined {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    // Time patterns
    const patterns = [
      { regex: /\b(today)\b/, range: { start: now - oneDay, end: now } },
      { regex: /\b(yesterday)\b/, range: { start: now - (2 * oneDay), end: now - oneDay } },
      { regex: /\b(this week)\b/, range: { start: now - oneWeek, end: now } },
      { regex: /\b(last week)\b/, range: { start: now - (2 * oneWeek), end: now - oneWeek } },
      { regex: /\b(this month)\b/, range: { start: now - oneMonth, end: now } },
      { regex: /\b(last month)\b/, range: { start: now - (2 * oneMonth), end: now - oneMonth } },
      { regex: /\b(recent|latest)\b/, range: { start: now - (7 * oneDay), end: now } }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(query)) {
        return pattern.range;
      }
    }

    return undefined;
  }

  /**
   * Extract node types from query
   */
  private extractNodeTypes(query: string): NodeType[] | undefined {
    const typeMap: Record<string, NodeType> = {
      'activity': NodeType.ACTIVITY,
      'pattern': NodeType.PATTERN,
      'resource': NodeType.RESOURCE,
      'concept': NodeType.CONCEPT,
      'project': NodeType.PROJECT,
      'workflow': NodeType.WORKFLOW,
      'email': NodeType.EMAIL,
      'code': NodeType.CODE,
      'github': NodeType.GITHUB,
      'learning': NodeType.LEARNING,
      'programming': NodeType.CODE,
      'development': NodeType.CODE,
      'communication': NodeType.EMAIL,
      'work': NodeType.PROJECT
    };

    const foundTypes: NodeType[] = [];
    
    for (const [keyword, type] of Object.entries(typeMap)) {
      if (query.includes(keyword)) {
        foundTypes.push(type);
      }
    }

    return foundTypes.length > 0 ? foundTypes : undefined;
  }

  /**
   * Extract edge types from query
   */
  private extractEdgeTypes(query: string): EdgeType[] | undefined {
    const typeMap: Record<string, EdgeType> = {
      'temporal': EdgeType.TEMPORAL,
      'semantic': EdgeType.SEMANTIC,
      'causal': EdgeType.CAUSAL,
      'spatial': EdgeType.SPATIAL,
      'reference': EdgeType.REFERENCE,
      'dependency': EdgeType.DEPENDENCY,
      'association': EdgeType.ASSOCIATION,
      'related': EdgeType.SEMANTIC,
      'connected': EdgeType.ASSOCIATION,
      'similar': EdgeType.SEMANTIC
    };

    const foundTypes: EdgeType[] = [];
    
    for (const [keyword, type] of Object.entries(typeMap)) {
      if (query.includes(keyword)) {
        foundTypes.push(type);
      }
    }

    return foundTypes.length > 0 ? foundTypes : undefined;
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(query: string): string[] | undefined {
    // Simple keyword extraction - remove common words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'show', 'find', 'search', 'list', 'get', 'give', 'me', 'my', 'i', 'want', 'need'
    ]);

    const words = query.split(/\s+/).filter(word => 
      word.length > 2 && !stopWords.has(word)
    );

    return words.length > 0 ? words : undefined;
  }

  /**
   * Extract tags from query
   */
  private extractTags(query: string): string[] | undefined {
    const tagPatterns = [
      /tagged?\s+with\s+([a-zA-Z0-9\s-]+)/i,
      /has\s+tag\s+([a-zA-Z0-9\s-]+)/i,
      /with\s+tags?\s+([a-zA-Z0-9\s-]+)/i,
      /#(\w+)/g // Hashtag pattern
    ];

    const tags: string[] = [];

    for (const pattern of tagPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        if (pattern.global) {
          // Global pattern (like hashtags)
          matches.forEach(match => {
            const tag = match.replace('#', '').toLowerCase();
            if (tag.length > 0) {
              tags.push(tag);
            }
          });
        } else {
          // Non-global pattern
          const tag = matches[1].toLowerCase().trim();
          if (tag.length > 0) {
            tags.push(tag);
          }
        }
      }
    }

    return tags.length > 0 ? [...new Set(tags)] : undefined;
  }

  /**
   * Extract relevance threshold from query
   */
  private extractRelevanceThreshold(query: string): number | undefined {
    const patterns = [
      /relevance\s+(?:above|greater than|>)\s*(\d+(?:\.\d+)?)/i,
      /score\s+(?:above|greater than|>)\s*(\d+(?:\.\d+)?)/i,
      /more\s+relevant\s+than\s*(\d+(?:\.\d+)?)/i,
      /relevance\s+(\d+(?:\.\d+)?)/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        const threshold = parseFloat(match[1]);
        if (threshold >= 0 && threshold <= 1) {
          return threshold;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract limit from query
   */
  private extractLimit(query: string): number | undefined {
    const patterns = [
      /(?:show|list|get|find)\s+(\d+)\s*/,
      /top\s+(\d+)\s*/,
      /first\s+(\d+)\s*/,
      /limit\s+(\d+)\s*/
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        const limit = parseInt(match[1]);
        if (limit > 0 && limit <= 100) {
          return limit;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract sort information from query
   */
  private extractSortInfo(query: string): { sortBy?: string; sortOrder?: 'asc' | 'desc' } {
    let sortBy: string | undefined;
    let sortOrder: 'asc' | 'desc' = 'desc';

    const sortPatterns = [
      { regex: /\b(by\s+)?time\b/i, field: 'time' },
      { regex: /\b(by\s+)?date\b/i, field: 'time' },
      { regex: /\b(by\s+)?relevance\b/i, field: 'relevance' },
      { regex: /\b(by\s+)?score\b/i, field: 'relevance' },
      { regex: /\b(by\s+)?frequency\b/i, field: 'frequency' },
      { regex: /\b(by\s+)?access(ed)?\b/i, field: 'frequency' },
      { regex: /\b(by\s+)?centrality\b/i, field: 'centrality' },
      { regex: /\b(by\s+)?importance\b/i, field: 'centrality' }
    ];

    for (const pattern of sortPatterns) {
      if (pattern.regex.test(query)) {
        sortBy = pattern.field;
        break;
      }
    }

    // Check for order direction
    if (query.includes('ascending') || query.includes('asc') || query.includes('oldest')) {
      sortOrder = 'asc';
    } else if (query.includes('descending') || query.includes('desc') || query.includes('newest')) {
      sortOrder = 'desc';
    }

    return { sortBy, sortOrder };
  }

  /**
   * Calculate pattern match score
   */
  private calculatePatternMatch(query: string, pattern: IntentPattern): number {
    let score = 0;
    let matchedTerms = 0;

    for (const term of pattern.terms) {
      if (query.includes(term)) {
        score += term.length / query.length; // Weight by term length
        matchedTerms++;
      }
    }

    if (matchedTerms === 0) {
      return 0;
    }

    // Boost score based on percentage of terms matched
    const termMatchRatio = matchedTerms / pattern.terms.length;
    score *= (1 + termMatchRatio);

    return Math.min(1.0, score);
  }

  /**
   * Check if query matches pattern
   */
  private matchesPattern(query: string, terms: string[]): boolean {
    return terms.some(term => query.includes(term));
  }

  /**
   * Get default query as fallback
   */
  private getDefaultQuery(originalQuery: string): GraphQuery {
    return {
      id: `fallback_${Date.now()}`,
      type: 'node',
      filters: [
        { field: 'is_pruned', operator: 'eq', value: false }
      ],
      constraints: [],
      limit: 20,
      sortBy: [{ field: 'timestamp', direction: 'desc' }],
      includeInactive: false,
      context: { originalQuery }
    };
  }

  /**
   * Initialize intent patterns
   */
  private initializeIntentPatterns(): void {
    this.intentPatterns = new Map([
      ['recent_search', {
        intent: 'search',
        target: 'nodes',
        terms: ['recent', 'latest', 'new', 'today', 'yesterday'],
        weight: 1.0
      }],
      ['find_activities', {
        intent: 'find',
        target: 'nodes',
        terms: ['find', 'search', 'look', 'activities', 'events'],
        weight: 1.0
      }],
      ['list_projects', {
        intent: 'list',
        target: 'nodes',
        terms: ['list', 'show', 'projects'],
        weight: 0.9
      }],
      ['analyze_patterns', {
        intent: 'analyze',
        target: 'nodes',
        terms: ['analyze', 'patterns', 'behavior', 'habits'],
        weight: 0.8
      }],
      ['find_connections', {
        intent: 'connect',
        target: 'edges',
        terms: ['connections', 'related', 'similar', 'linked'],
        weight: 0.8
      }],
      ['semantic_search', {
        intent: 'search',
        target: 'both',
        terms: ['similar', 'related', 'semantic'],
        weight: 0.7
      }]
    ]);
  }

  /**
   * Initialize keyword mappings
   */
  private initializeKeywordMappings(): void {
    this.keywordMappings = new Map([
      ['activity', { target: 'nodes', field: 'type', value: NodeType.ACTIVITY }],
      ['pattern', { target: 'nodes', field: 'type', value: NodeType.PATTERN }],
      ['project', { target: 'nodes', field: 'type', value: NodeType.PROJECT }],
      ['workflow', { target: 'nodes', field: 'type', value: NodeType.WORKFLOW }],
      ['email', { target: 'nodes', field: 'type', value: NodeType.EMAIL }],
      ['code', { target: 'nodes', field: 'type', value: NodeType.CODE }],
      ['github', { target: 'nodes', field: 'type', value: NodeType.GITHUB }],
      ['learning', { target: 'nodes', field: 'type', value: NodeType.LEARNING }],
      ['recent', { target: 'nodes', field: 'timestamp', operator: 'recent' }],
      ['relevant', { target: 'nodes', field: 'relevance_score', operator: 'gte', value: 0.5 }],
      ['connected', { target: 'edges', field: 'type', value: EdgeType.ASSOCIATION }],
      ['similar', { target: 'edges', field: 'type', value: EdgeType.SEMANTIC }]
    ]);
  }
}

// Supporting interfaces
interface IntentPattern {
  intent: 'search' | 'find' | 'list' | 'analyze' | 'connect' | 'recent' | 'related';
  target: 'nodes' | 'edges' | 'both';
  terms: string[];
  weight: number;
}

interface QueryMapping {
  target: 'nodes' | 'edges';
  field: string;
  operator?: string;
  value: any;
}

interface QueryExecutionResult {
  naturalQuery: string;
  translatedQuery: GraphQuery;
  result: GraphQueryResult<any>;
  queryType: 'nodes' | 'edges';
  executionTime: number;
  success: boolean;
  error?: string;
}

interface QuerySuggestion {
  text: string;
  description: string;
  confidence: number;
}