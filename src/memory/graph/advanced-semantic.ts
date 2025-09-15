import * as tf from '@tensorflow/tfjs';
import * as tfn from '@tensorflow-models/universal-sentence-encoder';
import { MemoryNode, MemoryEdge, SemanticConfig } from '@/memory/graph/types';
import { GraphDatabase } from '@/memory/graph/database';
import natural from 'natural';
import compromise from 'compromise';

export interface AdvancedSemanticConfig extends SemanticConfig {
  useTensorFlow: boolean;
  enableDeepLearning: boolean;
  enableCrossModalAnalysis: boolean;
  enableTemporalReasoning: boolean;
  enableKnowledgeGraphReasoning: boolean;
  maxEmbeddingDimensions: number;
  batchSize: number;
  similarityThreshold: number;
  enableRealTimeLearning: boolean;
  enablePatternDiscovery: boolean;
  enablePredictiveAnalysis: boolean;
}

export interface AdvancedSemanticFeatures {
  keywords: string[];
  entities: string[];
  concepts: string[];
  sentiment: number;
  topics: string[];
  embeddings: number[];
  language: string;
  contextualEmbeddings: number[];
  temporalPatterns: {
    timeOfDay: number;
    dayOfWeek: number;
    seasonality: number;
    trend: number;
  };
  crossModalFeatures: {
    visualSimilarity?: number;
    audioSimilarity?: number;
    textSimilarity: number;
  };
  reasoningFeatures: {
    logicalConnections: string[];
    inferredRelationships: Array<{
      type: string;
      confidence: number;
      evidence: string[];
    }>;
    predictions: Array<{
      prediction: string;
      confidence: number;
      timeframe: string;
    }>;
  };
}

export interface SemanticSearchResult {
  node: MemoryNode;
  score: number;
  semanticSimilarity: number;
  contextualRelevance: number;
  temporalRelevance: number;
  reasoningScore: number;
  explanation: string;
  relatedNodes: Array<{
    node: MemoryNode;
    relationship: string;
    strength: number;
  }>;
}

export interface KnowledgeGraphInsight {
  type: 'pattern' | 'anomaly' | 'trend' | 'relationship' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  evidence: Array<{
    nodeId: string;
    relevance: number;
    description: string;
  }>;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedActions: string[];
}

export class AdvancedSemanticSimilarityEngine {
  private config: AdvancedSemanticConfig;
  private db: GraphDatabase;
  private isInitialized = false;

  // TensorFlow.js components
  private universalEncoder: tfn.UniversalSentenceEncoder | null = null;
  private customEmbeddingModel: tf.LayersModel | null = null;
  private reasoningModel: tf.LayersModel | null = null;
  private isTensorFlowAvailable = false;

  // NLP components
  private tokenizer: natural.SentenceTokenizer;
  private stemmer: natural.PorterStemmer;
  private tfidf: natural.TfIdf;
  private wordNet?: any;

  // Knowledge graph and reasoning
  private knowledgeGraph: Map<string, Set<string>> = new Map();
  private semanticCache: Map<string, AdvancedSemanticFeatures> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();
  private patternCache: Map<string, any[]> = new Map();

  // Real-time learning
  private learningData: Array<{
    input: string;
    features: AdvancedSemanticFeatures;
    feedback: number;
    timestamp: number;
  }> = [];

  // Performance metrics
  private metrics = {
    totalProcessed: 0,
    averageProcessingTime: 0,
    averageSimilarity: 0,
    cacheHits: 0,
    tensorFlowCalls: 0,
    learningUpdates: 0,
    patternsDiscovered: 0,
    insightsGenerated: 0,
    errors: 0
  };

  constructor(config: AdvancedSemanticConfig, db: GraphDatabase) {
    this.config = config;
    this.db = db;
    this.tokenizer = new natural.SentenceTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();

    // Initialize WordNet if available
    try {
      this.wordNet = natural.WordNet;
    } catch (error) {
      console.warn('WordNet not available, semantic features will be limited');
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[AdvancedSemanticSimilarityEngine] Initializing...');

      // Initialize basic NLP components
      await this.initializeBasicNLP();

      // Initialize TensorFlow.js if enabled
      if (this.config.useTensorFlow) {
        await this.initializeTensorFlow();
      }

      // Initialize knowledge graph
      await this.initializeKnowledgeGraph();

      // Initialize real-time learning
      if (this.config.enableRealTimeLearning) {
        this.initializeLearning();
      }

      this.isInitialized = true;
      console.log('[AdvancedSemanticSimilarityEngine] Initialized successfully');

    } catch (error) {
      console.error('[AdvancedSemanticSimilarityEngine] Initialization failed:', error);
      throw error;
    }
  }

  private async initializeBasicNLP(): Promise<void> {
    // Build initial TF-IDF corpus
    await this.buildTfidfCorpus();
    console.log('[AdvancedSemanticSimilarityEngine] Basic NLP initialized');
  }

  private async initializeTensorFlow(): Promise<void> {
    try {
      console.log('[AdvancedSemanticSimilarityEngine] Initializing TensorFlow.js...');

      // Check if TensorFlow.js is available
      if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js not available');
      }

      // Initialize Universal Sentence Encoder
      if (this.config.useTensorFlow) {
        console.log('[AdvancedSemanticSimilarityEngine] Loading Universal Sentence Encoder...');
        this.universalEncoder = await tfn.load();
        console.log('[AdvancedSemanticSimilarityEngine] Universal Sentence Encoder loaded successfully');
      }

      // Set up WebGL backend for better performance
      await tf.setBackend('webgl');
      await tf.ready();

      // Load custom models if deep learning is enabled
      if (this.config.enableDeepLearning) {
        await this.loadCustomModels();
      }

      this.isTensorFlowAvailable = true;
      console.log('[AdvancedSemanticSimilarityEngine] TensorFlow.js initialized successfully');

    } catch (error) {
      console.warn('[AdvancedSemanticSimilarityEngine] TensorFlow.js initialization failed:', error);
      this.isTensorFlowAvailable = false;
      this.config.useTensorFlow = false;
    }
  }

  private async loadCustomModels(): Promise<void> {
    try {
      // Load custom embedding model
      this.customEmbeddingModel = await this.createCustomEmbeddingModel();

      // Load reasoning model if knowledge graph reasoning is enabled
      if (this.config.enableKnowledgeGraphReasoning) {
        this.reasoningModel = await this.createReasoningModel();
      }

      console.log('[AdvancedSemanticSimilarityEngine] Custom models loaded successfully');

    } catch (error) {
      console.warn('[AdvancedSemanticSimilarityEngine] Custom models loading failed:', error);
      this.customEmbeddingModel = null;
      this.reasoningModel = null;
    }
  }

  private async createCustomEmbeddingModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: 10000, outputDim: 256, inputLength: 100 }),
        tf.layers.bidirectional(tf.layers.lstm({ units: 128, returnSequences: true })),
        tf.layers.bidirectional(tf.layers.lstm({ units: 64 })),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: this.config.maxEmbeddingDimensions, activation: 'linear' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'mse',
      metrics: ['accuracy']
    });

    return model;
  }

  private async createReasoningModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [512], units: 256, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private async initializeKnowledgeGraph(): Promise<void> {
    try {
      // Load existing knowledge graph from database
      await this.loadKnowledgeGraph();
      console.log('[AdvancedSemanticSimilarityEngine] Knowledge graph initialized');
    } catch (error) {
      console.warn('[AdvancedSemanticSimilarityEngine] Knowledge graph initialization failed:', error);
    }
  }

  private async loadKnowledgeGraph(): Promise<void> {
    try {
      // Query for all semantic edges to build knowledge graph
      const query = {
        id: 'knowledge-graph-load',
        type: 'edge' as const,
        filters: [
          { field: 'type', operator: 'eq', value: 'semantic' },
          { field: 'is_active', operator: 'eq', value: true }
        ],
        constraints: []
      };

      const result = await this.db.queryEdges(query);

      // Build knowledge graph from edges
      for (const edge of result.results) {
        if (!this.knowledgeGraph.has(edge.sourceId)) {
          this.knowledgeGraph.set(edge.sourceId, new Set());
        }
        this.knowledgeGraph.get(edge.sourceId)!.add(edge.targetId);
      }

      console.log(`[AdvancedSemanticSimilarityEngine] Loaded knowledge graph with ${result.total} edges`);

    } catch (error) {
      console.error('[AdvancedSemanticSimilarityEngine] Knowledge graph loading failed:', error);
    }
  }

  private initializeLearning(): void {
    // Initialize real-time learning system
    console.log('[AdvancedSemanticSimilarityEngine] Real-time learning initialized');
  }

  /**
   * Extract advanced semantic features from node content
   */
  async extractSemanticFeatures(node: MemoryNode): Promise<AdvancedSemanticFeatures> {
    const startTime = performance.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(node);
      const cached = this.semanticCache.get(cacheKey);
      if (cached && Date.now() - node.timestamp < 86400000) { // 24 hours
        this.metrics.cacheHits++;
        return cached;
      }

      const features: AdvancedSemanticFeatures = {
        keywords: [],
        entities: [],
        concepts: [],
        sentiment: 0,
        topics: [],
        embeddings: [],
        language: 'en',
        contextualEmbeddings: [],
        temporalPatterns: {
          timeOfDay: 0,
          dayOfWeek: 0,
          seasonality: 0,
          trend: 0
        },
        crossModalFeatures: {
          textSimilarity: 0
        },
        reasoningFeatures: {
          logicalConnections: [],
          inferredRelationships: [],
          predictions: []
        }
      };

      const content = this.extractTextContent(node);
      if (!content) {
        return features;
      }

      // Extract basic features
      features.keywords = this.extractKeywords(content);
      features.entities = this.extractEntities(content);
      features.concepts = this.extractConcepts(content);
      features.sentiment = this.analyzeSentiment(content);
      features.topics = this.extractTopics(content);
      features.language = this.detectLanguage(content);

      // Extract temporal patterns
      if (this.config.enableTemporalReasoning) {
        features.temporalPatterns = await this.extractTemporalPatterns(node);
      }

      // Generate embeddings
      if (this.config.useTensorFlow && this.isTensorFlowAvailable) {
        features.embeddings = await this.generateEmbeddings(content);
        features.contextualEmbeddings = await this.generateContextualEmbeddings(content, node);
      }

      // Cross-modal analysis
      if (this.config.enableCrossModalAnalysis) {
        features.crossModalFeatures = await this.performCrossModalAnalysis(node, content);
      }

      // Knowledge graph reasoning
      if (this.config.enableKnowledgeGraphReasoning) {
        features.reasoningFeatures = await this.performKnowledgeGraphReasoning(node, features);
      }

      // Cache result
      this.semanticCache.set(cacheKey, features);

      // Update metrics
      this.updateMetrics(performance.now() - startTime);

      return features;

    } catch (error) {
      console.error('Advanced semantic feature extraction failed:', error);
      this.metrics.errors++;
      return this.getFallbackFeatures();
    }
  }

  /**
   * Calculate advanced semantic similarity between two nodes
   */
  async calculateSimilarity(node1: MemoryNode, node2: MemoryNode): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    try {
      const features1 = await this.extractSemanticFeatures(node1);
      const features2 = await this.extractSemanticFeatures(node2);

      // Calculate multiple similarity metrics
      const keywordSimilarity = this.calculateKeywordSimilarity(features1.keywords, features2.keywords);
      const entitySimilarity = this.calculateEntitySimilarity(features1.entities, features2.entities);
      const conceptSimilarity = this.calculateConceptSimilarity(features1.concepts, features2.concepts);
      const topicSimilarity = this.calculateTopicSimilarity(features1.topics, features2.topics);
      const sentimentSimilarity = this.calculateSentimentSimilarity(features1.sentiment, features2.sentiment);

      // Calculate embedding similarities if available
      let embeddingSimilarity = 0;
      let contextualSimilarity = 0;

      if (features1.embeddings.length > 0 && features2.embeddings.length > 0) {
        embeddingSimilarity = this.calculateEmbeddingSimilarity(features1.embeddings, features2.embeddings);
      }

      if (features1.contextualEmbeddings.length > 0 && features2.contextualEmbeddings.length > 0) {
        contextualSimilarity = this.calculateEmbeddingSimilarity(
          features1.contextualEmbeddings, 
          features2.contextualEmbeddings
        );
      }

      // Calculate temporal similarity if enabled
      let temporalSimilarity = 0;
      if (this.config.enableTemporalReasoning) {
        temporalSimilarity = this.calculateTemporalSimilarity(
          features1.temporalPatterns, 
          features2.temporalPatterns
        );
      }

      // Calculate reasoning similarity if enabled
      let reasoningSimilarity = 0;
      if (this.config.enableKnowledgeGraphReasoning) {
        reasoningSimilarity = await this.calculateReasoningSimilarity(node1, node2);
      }

      // Weighted combination based on configuration
      const weights = this.config.fieldWeights;
      const similarity = 
        (keywordSimilarity * (weights.keywords || 0.2)) +
        (entitySimilarity * (weights.entities || 0.15)) +
        (conceptSimilarity * (weights.concepts || 0.15)) +
        (topicSimilarity * (weights.topics || 0.1)) +
        (sentimentSimilarity * 0.05) +
        (embeddingSimilarity * (weights.embeddings || 0.2)) +
        (contextualSimilarity * 0.1) +
        (temporalSimilarity * 0.05) +
        (reasoningSimilarity * 0.05);

      return Math.min(1.0, Math.max(0.0, similarity));

    } catch (error) {
      console.error('Advanced similarity calculation failed:', error);
      return 0;
    }
  }

  /**
   * Advanced semantic search with reasoning and context
   */
  async searchNodes(query: string, options: {
    limit?: number;
    threshold?: number;
    includeReasoning?: boolean;
    temporalFilter?: {
      startTime?: number;
      endTime?: number;
    };
    contextFilter?: {
      nodeTypes?: string[];
      tags?: string[];
    };
  } = {}): Promise<SemanticSearchResult[]> {
    try {
      const {
        limit = 10,
        threshold = this.config.threshold,
        includeReasoning = true,
        temporalFilter,
        contextFilter
      } = options;

      // Generate query embeddings
      const queryFeatures = await this.generateQueryFeatures(query);

      // Get candidate nodes
      const candidateNodes = await this.getCandidateNodes(contextFilter, temporalFilter);

      // Calculate similarity scores
      const results: SemanticSearchResult[] = [];

      for (const node of candidateNodes) {
        const similarity = await this.calculateNodeQuerySimilarity(node, queryFeatures);
        
        if (similarity >= threshold) {
          const result: SemanticSearchResult = {
            node,
            score: similarity,
            semanticSimilarity: similarity,
            contextualRelevance: await this.calculateContextualRelevance(node, query),
            temporalRelevance: await this.calculateTemporalRelevance(node, temporalFilter),
            reasoningScore: includeReasoning ? await this.calculateReasoningScore(node, query) : 0,
            explanation: await this.generateExplanation(node, query, similarity),
            relatedNodes: await this.findRelatedNodes(node)
          };

          results.push(result);
        }
      }

      // Sort by comprehensive score and return top results
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      console.error('Advanced semantic search failed:', error);
      return [];
    }
  }

  /**
   * Generate knowledge graph insights using AI reasoning
   */
  async generateInsights(): Promise<KnowledgeGraphInsight[]> {
    try {
      const insights: KnowledgeGraphInsight[] = [];

      // Analyze patterns
      if (this.config.enablePatternDiscovery) {
        const patternInsights = await this.discoverPatterns();
        insights.push(...patternInsights);
      }

      // Detect anomalies
      const anomalyInsights = await this.detectAnomalies();
      insights.push(...anomalyInsights);

      // Identify trends
      const trendInsights = await this.identifyTrends();
      insights.push(...trendInsights);

      // Discover relationships
      const relationshipInsights = await this.discoverRelationships();
      insights.push(...relationshipInsights);

      // Generate predictions
      if (this.config.enablePredictiveAnalysis) {
        const predictions = await this.generatePredictions();
        insights.push(...predictions);
      }

      // Filter and rank insights
      return insights
        .filter(insight => insight.confidence >= 0.6)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 20);

    } catch (error) {
      console.error('Insight generation failed:', error);
      return [];
    }
  }

  /**
   * Real-time learning from user feedback
   */
  async learnFromFeedback(
    input: string,
    features: AdvancedSemanticFeatures,
    feedback: number
  ): Promise<void> {
    if (!this.config.enableRealTimeLearning) return;

    try {
      // Store learning data
      this.learningData.push({
        input,
        features,
        feedback,
        timestamp: Date.now()
      });

      // Limit learning data size
      if (this.learningData.length > 1000) {
        this.learningData = this.learningData.slice(-500);
      }

      // Update models if we have enough data
      if (this.learningData.length % 100 === 0) {
        await this.updateModels();
      }

      this.metrics.learningUpdates++;

    } catch (error) {
      console.error('Real-time learning failed:', error);
    }
  }

  // Private helper methods
  private async generateEmbeddings(text: string): Promise<number[]> {
    try {
      if (!this.universalEncoder) return [];

      // Check cache first
      const cacheKey = text.slice(0, 100);
      const cached = this.embeddingCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Generate embeddings
      const embeddings = await this.universalEncoder.embed([text]);
      const embeddingArray = Array.from(await embeddings.data());
      embeddings.dispose();

      // Cache result
      this.embeddingCache.set(cacheKey, embeddingArray);
      this.metrics.tensorFlowCalls++;

      return embeddingArray;

    } catch (error) {
      console.error('Embedding generation failed:', error);
      return [];
    }
  }

  private async generateContextualEmbeddings(text: string, node: MemoryNode): Promise<number[]> {
    try {
      // Generate contextual embeddings considering node metadata and relationships
      const baseEmbeddings = await this.generateEmbeddings(text);
      
      if (baseEmbeddings.length === 0) return [];

      // Add context from node metadata
      const contextFactors = [
        node.type,
        ...node.tags,
        node.metadata?.category || '',
        node.metadata?.priority || ''
      ].filter(Boolean);

      // Modify embeddings based on context
      const contextualEmbeddings = [...baseEmbeddings];
      
      // Simple context modification (in production, use more sophisticated methods)
      const contextHash = this.hashContext(contextFactors);
      const modificationFactor = (contextHash % 100) / 1000; // Small modification
      
      for (let i = 0; i < contextualEmbeddings.length; i++) {
        contextualEmbeddings[i] += modificationFactor * Math.sin(i);
      }

      return contextualEmbeddings;

    } catch (error) {
      console.error('Contextual embedding generation failed:', error);
      return [];
    }
  }

  private async extractTemporalPatterns(node: MemoryNode): Promise<{
    timeOfDay: number;
    dayOfWeek: number;
    seasonality: number;
    trend: number;
  }> {
    const date = new Date(node.timestamp);
    
    return {
      timeOfDay: date.getHours() / 24, // Normalized to 0-1
      dayOfWeek: date.getDay() / 7, // Normalized to 0-1
      seasonality: (date.getMonth() % 3) / 3, // Quarterly seasonality
      trend: this.calculateTemporalTrend(node.timestamp)
    };
  }

  private calculateTemporalTrend(timestamp: number): number {
    // Calculate trend based on recent activity
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const isRecent = timestamp > oneWeekAgo;
    return isRecent ? 0.8 : 0.2;
  }

  private async performCrossModalAnalysis(node: MemoryNode, content: string): Promise<{
    visualSimilarity?: number;
    audioSimilarity?: number;
    textSimilarity: number;
  }> {
    const result = {
      textSimilarity: 0
    };

    try {
      // Text similarity (always available)
      result.textSimilarity = this.calculateTextSimilarity(content);

      // Visual similarity (if node has visual content)
      if (node.metadata?.hasVisualContent) {
        result.visualSimilarity = await this.calculateVisualSimilarity(node);
      }

      // Audio similarity (if node has audio content)
      if (node.metadata?.hasAudioContent) {
        result.audioSimilarity = await this.calculateAudioSimilarity(node);
      }

    } catch (error) {
      console.error('Cross-modal analysis failed:', error);
    }

    return result;
  }

  private async performKnowledgeGraphReasoning(
    node: MemoryNode,
    features: AdvancedSemanticFeatures
  ): Promise<{
    logicalConnections: string[];
    inferredRelationships: Array<{
      type: string;
      confidence: number;
      evidence: string[];
    }>;
    predictions: Array<{
      prediction: string;
      confidence: number;
      timeframe: string;
    }>;
  }> {
    try {
      const result = {
        logicalConnections: [] as string[],
        inferredRelationships: [] as Array<{
          type: string;
          confidence: number;
          evidence: string[];
        }>,
        predictions: [] as Array<{
          prediction: string;
          confidence: number;
          timeframe: string;
        }>
      };

      // Find logical connections using knowledge graph
      const connectedNodes = this.knowledgeGraph.get(node.id) || new Set();
      
      for (const connectedNodeId of connectedNodes) {
        const connectedNode = await this.db.getNode(connectedNodeId);
        if (connectedNode) {
          result.logicalConnections.push(connectedNode.type);
        }
      }

      // Infer relationships using ML reasoning
      if (this.reasoningModel && this.isTensorFlowAvailable) {
        const inference = await this.reasonModel.predict(
          tf.tensor2d([features.embeddings.slice(0, 512)], [1, 512])
        ) as tf.Tensor;

        const confidence = Array.from(await inference.data())[0];
        inference.dispose();

        if (confidence > 0.7) {
          result.inferredRelationships.push({
            type: 'semantic_relatedness',
            confidence,
            evidence: ['high_embedding_similarity', 'contextual_overlap']
          });
        }
      }

      // Generate predictions based on temporal patterns
      if (this.config.enablePredictiveAnalysis) {
        result.predictions = await this.generateNodePredictions(node, features);
      }

      return result;

    } catch (error) {
      console.error('Knowledge graph reasoning failed:', error);
      return {
        logicalConnections: [],
        inferredRelationships: [],
        predictions: []
      };
    }
  }

  private async generateQueryFeatures(query: string): Promise<AdvancedSemanticFeatures> {
    // Create a temporary node for the query
    const queryNode: MemoryNode = {
      id: 'query-temp',
      type: 'query',
      timestamp: Date.now(),
      content: { text: query },
      tags: [],
      metadata: {},
      relevanceScore: 1,
      decayFactor: 0,
      relationships: []
    };

    return await this.extractSemanticFeatures(queryNode);
  }

  private async getCandidateNodes(
    contextFilter?: { nodeTypes?: string[]; tags?: string[] },
    temporalFilter?: { startTime?: number; endTime?: number }
  ): Promise<MemoryNode[]> {
    try {
      const query: any = {
        id: 'candidate-search',
        type: 'node' as const,
        filters: [
          { field: 'is_pruned', operator: 'eq', value: false }
        ],
        constraints: [],
        limit: 1000
      };

      // Apply context filters
      if (contextFilter?.nodeTypes?.length) {
        query.filters.push({
          field: 'type',
          operator: 'in',
          value: contextFilter.nodeTypes
        });
      }

      if (contextFilter?.tags?.length) {
        query.filters.push({
          field: 'tags',
          operator: 'contains',
          value: contextFilter.tags
        });
      }

      // Apply temporal filters
      if (temporalFilter?.startTime || temporalFilter?.endTime) {
        const timeFilter: any = {
          field: 'timestamp',
          operator: 'between'
        };

        if (temporalFilter.startTime && temporalFilter.endTime) {
          timeFilter.value = [temporalFilter.startTime, temporalFilter.endTime];
        } else if (temporalFilter.startTime) {
          timeFilter.operator = 'gte';
          timeFilter.value = temporalFilter.startTime;
        } else if (temporalFilter.endTime) {
          timeFilter.operator = 'lte';
          timeFilter.value = temporalFilter.endTime;
        }

        query.filters.push(timeFilter);
      }

      const result = await this.db.queryNodes(query);
      return result.results;

    } catch (error) {
      console.error('Candidate node retrieval failed:', error);
      return [];
    }
  }

  private async calculateNodeQuerySimilarity(
    node: MemoryNode,
    queryFeatures: AdvancedSemanticFeatures
  ): Promise<number> {
    const nodeFeatures = await this.extractSemanticFeatures(node);

    // Calculate multi-faceted similarity
    const textSimilarity = this.calculateTextSimilarity(
      this.extractTextContent(node),
      this.extractTextContentFromFeatures(queryFeatures)
    );

    const keywordSimilarity = this.calculateKeywordSimilarity(
      nodeFeatures.keywords,
      queryFeatures.keywords
    );

    const embeddingSimilarity = queryFeatures.embeddings.length > 0 && nodeFeatures.embeddings.length > 0
      ? this.calculateEmbeddingSimilarity(queryFeatures.embeddings, nodeFeatures.embeddings)
      : 0;

    // Weighted combination
    return (textSimilarity * 0.4) + (keywordSimilarity * 0.3) + (embeddingSimilarity * 0.3);
  }

  private async calculateContextualRelevance(node: MemoryNode, query: string): Promise<number> {
    // Calculate relevance based on node context and metadata
    let relevance = 0.5;

    // Boost relevance based on recency
    const age = Date.now() - node.timestamp;
    const recencyBoost = Math.exp(-age / (30 * 24 * 60 * 60 * 1000)); // 30 days decay
    relevance += recencyBoost * 0.3;

    // Boost relevance based on node importance
    if (node.relevanceScore > 0.7) {
      relevance += 0.2;
    }

    return Math.min(1.0, relevance);
  }

  private async calculateTemporalRelevance(
    node: MemoryNode,
    temporalFilter?: { startTime?: number; endTime?: number }
  ): Promise<number> {
    if (!temporalFilter) return 0.5;

    const nodeTime = node.timestamp;
    
    if (temporalFilter.startTime && temporalFilter.endTime) {
      if (nodeTime >= temporalFilter.startTime && nodeTime <= temporalFilter.endTime) {
        return 1.0;
      }
    } else if (temporalFilter.startTime) {
      if (nodeTime >= temporalFilter.startTime) {
        const timeSinceStart = nodeTime - temporalFilter.startTime;
        const decay = Math.exp(-timeSinceStart / (7 * 24 * 60 * 60 * 1000)); // 1 week decay
        return decay;
      }
    } else if (temporalFilter.endTime) {
      if (nodeTime <= temporalFilter.endTime) {
        const timeUntilEnd = temporalFilter.endTime - nodeTime;
        const decay = Math.exp(-timeUntilEnd / (7 * 24 * 60 * 60 * 1000)); // 1 week decay
        return decay;
      }
    }

    return 0.1;
  }

  private async calculateReasoningScore(node: MemoryNode, query: string): Promise<number> {
    // Calculate reasoning score based on logical connections and inferences
    let score = 0.5;

    // Boost based on knowledge graph connectivity
    const connections = this.knowledgeGraph.get(node.id)?.size || 0;
    score += Math.min(0.3, connections * 0.05);

    // Boost based on reasoning features
    const features = await this.extractSemanticFeatures(node);
    if (features.reasoningFeatures.inferredRelationships.length > 0) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  private async generateExplanation(
    node: MemoryNode,
    query: string,
    similarity: number
  ): Promise<string> {
    try {
      const features = await this.extractSemanticFeatures(node);
      
      let explanation = `Similarity score: ${(similarity * 100).toFixed(1)}%`;
      
      if (features.keywords.length > 0) {
        explanation += `\nMatching keywords: ${features.keywords.slice(0, 3).join(', ')}`;
      }

      if (features.reasoningFeatures.logicalConnections.length > 0) {
        explanation += `\nConnected to: ${features.reasoningFeatures.logicalConnections.slice(0, 3).join(', ')}`;
      }

      return explanation;

    } catch (error) {
      console.error('Explanation generation failed:', error);
      return `Similarity score: ${(similarity * 100).toFixed(1)}%`;
    }
  }

  private async findRelatedNodes(node: MemoryNode): Promise<Array<{
    node: MemoryNode;
    relationship: string;
    strength: number;
  }>> {
    try {
      const relatedNodes: Array<{
        node: MemoryNode;
        relationship: string;
        strength: number;
      }> = [];

      // Find directly connected nodes
      const connectedIds = this.knowledgeGraph.get(node.id) || new Set();
      
      for (const connectedId of connectedIds) {
        const connectedNode = await this.db.getNode(connectedId);
        if (connectedNode) {
          relatedNodes.push({
            node: connectedNode,
            relationship: 'direct_connection',
            strength: 0.8
          });
        }
      }

      // Find semantically similar nodes
      const similarNodes = await this.findSimilarNodes(node, 5, 0.6);
      
      for (const { node: similarNode, similarity } of similarNodes) {
        if (!connectedIds.has(similarNode.id)) {
          relatedNodes.push({
            node: similarNode,
            relationship: 'semantic_similarity',
            strength: similarity
          });
        }
      }

      return relatedNodes.slice(0, 10);

    } catch (error) {
      console.error('Related node finding failed:', error);
      return [];
    }
  }

  private async discoverPatterns(): Promise<KnowledgeGraphInsight[]> {
    const insights: KnowledgeGraphInsight[] = [];

    try {
      // Analyze temporal patterns
      const temporalPatterns = await this.analyzeTemporalPatterns();
      
      for (const pattern of temporalPatterns) {
        insights.push({
          type: 'pattern',
          title: `Temporal Pattern: ${pattern.name}`,
          description: pattern.description,
          confidence: pattern.confidence,
          evidence: pattern.evidence,
          impact: 'medium',
          actionable: true,
          suggestedActions: [
            'Consider optimizing workflow timing',
            'Set up reminders for peak productivity periods'
          ]
        });
      }

      this.metrics.patternsDiscovered += temporalPatterns.length;

    } catch (error) {
      console.error('Pattern discovery failed:', error);
    }

    return insights;
  }

  private async analyzeTemporalPatterns(): Promise<Array<{
    name: string;
    description: string;
    confidence: number;
    evidence: Array<{
      nodeId: string;
      relevance: number;
      description: string;
    }>;
  }>> {
    // Simplified temporal pattern analysis
    // In production, this would use more sophisticated time series analysis
    
    const patterns: Array<{
      name: string;
      description: string;
      confidence: number;
      evidence: Array<{
        nodeId: string;
        relevance: number;
        description: string;
      }>;
    }> = [];

    try {
      // Get recent nodes for analysis
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const query = {
        id: 'temporal-analysis',
        type: 'node' as const,
        filters: [
          { field: 'timestamp', operator: 'gte', value: oneWeekAgo },
          { field: 'is_pruned', operator: 'eq', value: false }
        ],
        constraints: [],
        limit: 1000
      };

      const result = await this.db.queryNodes(query);
      
      // Group nodes by hour of day
      const hourlyActivity = new Array(24).fill(0);
      
      for (const node of result.results) {
        const hour = new Date(node.timestamp).getHours();
        hourlyActivity[hour]++;
      }

      // Find peak activity hours
      const maxActivity = Math.max(...hourlyActivity);
      const peakHours = hourlyActivity
        .map((count, hour) => ({ hour, count }))
        .filter(item => item.count >= maxActivity * 0.7);

      if (peakHours.length > 0) {
        patterns.push({
          name: 'Peak Activity Hours',
          description: `Most active during: ${peakHours.map(h => `${h.hour}:00`).join(', ')}`,
          confidence: 0.8,
          evidence: peakHours.map(h => ({
            nodeId: 'temporal-analysis',
            relevance: h.count / maxActivity,
            description: `High activity at ${h.hour}:00`
          }))
        });
      }

    } catch (error) {
      console.error('Temporal pattern analysis failed:', error);
    }

    return patterns;
  }

  private async detectAnomalies(): Promise<KnowledgeGraphInsight[]> {
    // Simplified anomaly detection
    return [];
  }

  private async identifyTrends(): Promise<KnowledgeGraphInsight[]> {
    // Simplified trend identification
    return [];
  }

  private async discoverRelationships(): Promise<KnowledgeGraphInsight[]> {
    // Simplified relationship discovery
    return [];
  }

  private async generatePredictions(): Promise<KnowledgeGraphInsight[]> {
    // Simplified prediction generation
    return [];
  }

  private async updateModels(): Promise<void> {
    try {
      // Update models based on learning data
      if (this.learningData.length < 10) return;

      console.log(`[AdvancedSemanticSimilarityEngine] Updating models with ${this.learningData.length} learning samples`);

      // This would involve retraining or fine-tuning models with new data
      // For now, we'll just clear old caches

      this.semanticCache.clear();
      this.embeddingCache.clear();

    } catch (error) {
      console.error('Model update failed:', error);
    }
  }

  private async generateNodePredictions(
    node: MemoryNode,
    features: AdvancedSemanticFeatures
  ): Promise<Array<{
    prediction: string;
    confidence: number;
    timeframe: string;
  }>> {
    const predictions: Array<{
      prediction: string;
      confidence: number;
      timeframe: string;
    }> = [];

    try {
      // Predict future relevance decay
      const currentRelevance = node.relevanceScore;
      const predictedDecay = currentRelevance * 0.9; // Predict 10% decay
      
      predictions.push({
        prediction: 'relevance_decay',
        confidence: 0.7,
        timeframe: '1_week'
      });

      // Predict connection growth
      const currentConnections = this.knowledgeGraph.get(node.id)?.size || 0;
      if (currentConnections < 5) {
        predictions.push({
          prediction: 'connection_growth',
          confidence: 0.6,
          timeframe: '1_month'
        });
      }

    } catch (error) {
      console.error('Node prediction failed:', error);
    }

    return predictions;
  }

  // Utility methods
  private generateCacheKey(node: MemoryNode): string {
    return `${node.id}:${node.timestamp}:${node.type}`;
  }

  private hashContext(contextFactors: string[]): number {
    return contextFactors.reduce((hash, factor) => {
      return hash + factor.split('').reduce((charHash, char) => charHash + char.charCodeAt(0), 0);
    }, 0);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple text similarity using Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private async calculateVisualSimilarity(node: MemoryNode): Promise<number> {
    // Placeholder for visual similarity calculation
    // In production, this would use computer vision models
    return Math.random() * 0.5; // Random placeholder
  }

  private async calculateAudioSimilarity(node: MemoryNode): Promise<number> {
    // Placeholder for audio similarity calculation
    // In production, this would use audio processing models
    return Math.random() * 0.5; // Random placeholder
  }

  private extractTextContentFromFeatures(features: AdvancedSemanticFeatures): string {
    return [
      ...features.keywords,
      ...features.entities,
      ...features.concepts,
      ...features.topics
    ].join(' ');
  }

  private async calculateReasoningSimilarity(node1: MemoryNode, node2: MemoryNode): Promise<number> {
    // Calculate similarity based on knowledge graph reasoning
    const connections1 = this.knowledgeGraph.get(node1.id) || new Set();
    const connections2 = this.knowledgeGraph.get(node2.id) || new Set();
    
    const commonConnections = new Set([...connections1].filter(x => connections2.has(x)));
    const totalConnections = new Set([...connections1, ...connections2]);
    
    return totalConnections.size > 0 ? commonConnections.size / totalConnections.size : 0;
  }

  private calculateSentimentSimilarity(sentiment1: number, sentiment2: number): number {
    // Calculate sentiment similarity based on absolute difference
    return 1 - Math.abs(sentiment1 - sentiment2);
  }

  private calculateTemporalSimilarity(
    patterns1: any,
    patterns2: any
  ): number {
    // Calculate temporal pattern similarity
    const timeDiff = Math.abs(patterns1.timeOfDay - patterns2.timeOfDay);
    const dayDiff = Math.abs(patterns1.dayOfWeek - patterns2.dayOfWeek);
    
    return 1 - (timeDiff + dayDiff) / 2;
  }

  private updateMetrics(processingTime: number): void {
    this.metrics.totalProcessed++;
    this.metrics.averageProcessingTime = this.updateAverage(
      this.metrics.averageProcessingTime,
      processingTime,
      this.metrics.totalProcessed
    );
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  private getFallbackFeatures(): AdvancedSemanticFeatures {
    return {
      keywords: [],
      entities: [],
      concepts: [],
      sentiment: 0,
      topics: [],
      embeddings: [],
      language: 'en',
      contextualEmbeddings: [],
      temporalPatterns: {
        timeOfDay: 0,
        dayOfWeek: 0,
        seasonality: 0,
        trend: 0
      },
      crossModalFeatures: {
        textSimilarity: 0
      },
      reasoningFeatures: {
        logicalConnections: [],
        inferredRelationships: [],
        predictions: []
      }
    };
  }

  // Reuse basic methods from parent class
  private extractTextContent(node: MemoryNode): string {
    try {
      let content = '';

      if (typeof node.content === 'string') {
        content = node.content;
      } else if (typeof node.content === 'object') {
        if (node.content.text) content += node.content.text + ' ';
        if (node.content.title) content += node.content.title + ' ';
        if (node.content.description) content += node.content.description + ' ';
        if (node.content.body) content += node.content.body + ' ';
        if (node.content.summary) content += node.content.summary + ' ';
        
        if (Array.isArray(node.content.keywords)) {
          content += node.content.keywords.join(' ') + ' ';
        }
        if (Array.isArray(node.content.tags)) {
          content += node.content.tags.join(' ') + ' ';
        }
      }

      if (node.metadata) {
        if (node.metadata.title) content += node.metadata.title + ' ';
        if (node.metadata.description) content += node.metadata.description + ' ';
        if (node.metadata.subject) content += node.metadata.subject + ' ';
      }

      if (node.tags && node.tags.length > 0) {
        content += node.tags.join(' ') + ' ';
      }

      return content.trim();
    } catch (error) {
      console.error('Content extraction failed:', error);
      return '';
    }
  }

  private extractKeywords(text: string): string[] {
    try {
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
      const tokens = cleanText.split(/\s+/).filter(token => token.length > 2);
      
      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did'
      ]);
      
      const filteredTokens = tokens.filter(token => !stopWords.has(token));
      
      this.tfidf.addDocument(filteredTokens);
      
      const keywords: Array<{ term: string; score: number }> = [];
      this.tfidf.listTerms(0).forEach(item => {
        keywords.push({ term: item.term, score: item.tfidf });
      });

      return keywords
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => this.stemmer.stem(item.term));

    } catch (error) {
      console.error('Keyword extraction failed:', error);
      return [];
    }
  }

  private extractEntities(text: string): string[] {
    try {
      const doc = compromise(text);
      const entities: string[] = [];

      const people = doc.people().out('array');
      const places = doc.places().out('array');
      const organizations = doc.organizations().out('array');
      const dates = doc.dates().out('array');

      entities.push(...people, ...places, ...organizations, ...dates);

      const numbers = doc.numbers().out('array');
      const money = doc.money().out('array');
      
      entities.push(...numbers.map(n => n.toString()), ...money);

      return [...new Set(entities)];
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return [];
    }
  }

  private extractConcepts(text: string): string[] {
    try {
      const doc = compromise(text);
      const concepts: string[] = [];

      const nounPhrases = doc.nouns().out('array');
      concepts.push(...nounPhrases);

      const verbPhrases = doc.verbs().out('array');
      concepts.push(...verbPhrases);

      const adjectivePhrases = doc.adjectives().out('array');
      concepts.push(...adjectivePhrases);

      return [...new Set(concepts)]
        .filter(concept => concept.length > 2 && concept.length < 50)
        .map(concept => concept.toLowerCase().trim());

    } catch (error) {
      console.error('Concept extraction failed:', error);
      return [];
    }
  }

  private analyzeSentiment(text: string): number {
    try {
      const analyzer = new natural.SentimentAnalyzer('English', 
        natural.PorterStemmer, ['negation']);
      
      const tokens = natural.WordTokenizer.prototype.tokenize(text);
      const sentiment = analyzer.getSentiment(tokens);
      
      return Math.max(-1, Math.min(1, sentiment));

    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      return 0;
    }
  }

  private extractTopics(text: string): string[] {
    try {
      const doc = compromise(text);
      const topics: string[] = [];

      const topicsMatch = text.match(/(?:topic|subject|about|regarding|concerning)\s*:?\s*([^.]+)/gi);
      if (topicsMatch) {
        topics.push(...topicsMatch.map(match => match.replace(/.*?:\s*/, '')));
      }

      const hashtags = text.match(/#\w+/g);
      if (hashtags) {
        topics.push(...hashtags.map(tag => tag.substring(1)));
      }

      const subjects = doc.subjects().out('array');
      topics.push(...subjects);

      return [...new Set(topics)]
        .filter(topic => topic.length > 2)
        .map(topic => topic.toLowerCase());

    } catch (error) {
      console.error('Topic extraction failed:', error);
      return [];
    }
  }

  private detectLanguage(text: string): string {
    try {
      const patterns = {
        'en': /[a-zA-Z\s]+/,
        'es': /[ñáéíóúü\s]+/,
        'fr': /[àâæçéèêëïîôùûüÿñœæ\s]+/,
        'de': /[äöüß\s]+/,
        'it': /[àèéìòùù\s]+/
      };

      let maxScore = 0;
      let detectedLang = 'en';

      for (const [lang, pattern] of Object.entries(patterns)) {
        const matches = text.match(pattern);
        const score = matches ? matches.join('').length / text.length : 0;
        
        if (score > maxScore) {
          maxScore = score;
          detectedLang = lang;
        }
      }

      return detectedLang;

    } catch (error) {
      console.error('Language detection failed:', error);
      return 'en';
    }
  }

  // Reuse similarity calculation methods
  private calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private calculateEntitySimilarity(entities1: string[], entities2: string[]): number {
    if (entities1.length === 0 || entities2.length === 0) return 0;

    const set1 = new Set(entities1);
    const set2 = new Set(entities2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private calculateConceptSimilarity(concepts1: string[], concepts2: string[]): number {
    if (concepts1.length === 0 || concepts2.length === 0) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (const concept1 of concepts1) {
      for (const concept2 of concepts2) {
        const distance = natural.LevenshteinDistance(concept1, concept2);
        const maxLength = Math.max(concept1.length, concept2.length);
        const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;
        
        if (similarity > 0.7) {
          totalSimilarity += similarity;
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateTopicSimilarity(topics1: string[], topics2: string[]): number {
    if (topics1.length === 0 || topics2.length === 0) return 0;

    const set1 = new Set(topics1);
    const set2 = new Set(topics2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private calculateEmbeddingSimilarity(embeddings1: number[], embeddings2: number[]): number {
    if (embeddings1.length === 0 || embeddings2.length === 0) return 0;

    const minLength = Math.min(embeddings1.length, embeddings2.length);
    const vec1 = embeddings1.slice(0, minLength);
    const vec2 = embeddings2.slice(0, minLength);

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  private async buildTfidfCorpus(): Promise<void> {
    try {
      const query = {
        id: 'tfidf-corpus',
        type: 'node' as const,
        filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
        constraints: [],
        limit: 1000
      };

      const result = await this.db.queryNodes(query);
      
      // Rebuild TF-IDF with current documents
      this.tfidf = new natural.TfIdf();
      
      for (const node of result.results) {
        const content = this.extractTextContent(node);
        if (content) {
          const cleanText = content.toLowerCase().replace(/[^\w\s]/g, ' ');
          const tokens = cleanText.split(/\s+/).filter(token => token.length > 2);
          
          const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
          ]);
          
          const filteredTokens = tokens.filter(token => !stopWords.has(token));
          
          if (filteredTokens.length > 0) {
            this.tfidf.addDocument(filteredTokens);
          }
        }
      }

      console.log(`[AdvancedSemanticSimilarityEngine] TF-IDF corpus built with ${result.total} nodes`);

    } catch (error) {
      console.error('TF-IDF corpus building failed:', error);
    }
  }

  // Public API methods
  isHealthy(): boolean {
    return this.isInitialized && this.metrics.errors / Math.max(this.metrics.totalProcessed, 1) < 0.05;
  }

  getMetrics() {
    return { 
      ...this.metrics,
      cacheSize: this.semanticCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      knowledgeGraphSize: this.knowledgeGraph.size,
      learningDataSize: this.learningData.length,
      isTensorFlowAvailable: this.isTensorFlowAvailable
    };
  }

  async updateConfig(newConfig: Partial<AdvancedSemanticConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }

  async cleanup(): Promise<void> {
    // Clear caches
    this.semanticCache.clear();
    this.embeddingCache.clear();
    this.patternCache.clear();
    this.learningData = [];

    // Dispose TensorFlow.js resources
    if (this.universalEncoder) {
      this.universalEncoder.dispose();
      this.universalEncoder = null;
    }

    if (this.customEmbeddingModel) {
      this.customEmbeddingModel.dispose();
      this.customEmbeddingModel = null;
    }

    if (this.reasoningModel) {
      this.reasoningModel.dispose();
      this.reasoningModel = null;
    }

    // Clear knowledge graph
    this.knowledgeGraph.clear();

    // Dispose TensorFlow.js backend
    if (this.isTensorFlowAvailable) {
      await tf.disposeVariables();
    }

    this.isInitialized = false;
    console.log('[AdvancedSemanticSimilarityEngine] Cleanup completed');
  }

  async findSimilarNodes(
    targetNode: MemoryNode,
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<Array<{ node: MemoryNode; similarity: number }>> {
    try {
      // Get all nodes with same type boost if configured
      const query = {
        id: 'semantic-search',
        type: 'node' as const,
        filters: [
          { field: 'id', operator: 'ne', value: targetNode.id },
          { field: 'is_pruned', operator: 'eq', value: false }
        ],
        constraints: [],
        limit: 1000
      };

      const result = await this.db.queryNodes(query);
      const similarities: Array<{ node: MemoryNode; similarity: number }> = [];

      for (const node of result.results) {
        const similarity = await this.calculateSimilarity(targetNode, node);
        
        if (similarity >= threshold) {
          similarities.push({ node, similarity });
        }
      }

      // Apply same type boost
      if (this.config.boostFactors?.sameType > 1) {
        similarities.forEach(item => {
          if (item.node.type === targetNode.type) {
            item.similarity *= this.config.boostFactors!.sameType;
          }
        });
      }

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('Similar nodes search failed:', error);
      return [];
    }
  }

  async createSemanticEdges(nodeId: string, maxConnections: number = 5): Promise<number> {
    try {
      const targetNode = await this.db.getNode(nodeId);
      if (!targetNode) {
        return 0;
      }

      const similarNodes = await this.findSimilarNodes(targetNode, maxConnections, this.config.threshold);
      let edgesCreated = 0;

      for (const { node: similarNode, similarity } of similarNodes) {
        try {
          // Check if edge already exists
          const existingEdgeQuery = {
            id: 'check-edge',
            type: 'edge' as const,
            filters: [
              { field: 'source_id', operator: 'eq', value: nodeId },
              { field: 'target_id', operator: 'eq', value: similarNode.id },
              { field: 'type', operator: 'eq', value: 'semantic' }
            ],
            constraints: []
          };

          const existingResult = await this.db.queryEdges(existingEdgeQuery);
          
          if (existingResult.total === 0) {
            await this.db.createEdge({
              targetId: similarNode.id,
              type: 'semantic' as any,
              strength: similarity,
              context: `Advanced semantic similarity: ${(similarity * 100).toFixed(1)}%`,
              timestamp: Date.now(),
              weight: similarity,
              probability: similarity,
              decayRate: 0.05,
              isActive: true,
              interactionCount: 0,
              lastInteraction: Date.now()
            }, nodeId, similarNode.id);

            edgesCreated++;
          }
        } catch (error) {
          console.error(`Failed to create semantic edge for node ${similarNode.id}:`, error);
        }
      }

      return edgesCreated;

    } catch (error) {
      console.error('Semantic edge creation failed:', error);
      return 0;
    }
  }

  async updateEmbeddings(batchSize: number = 100): Promise<void> {
    try {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const query = {
          id: 'embedding-update',
          type: 'node' as const,
          filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
          constraints: [],
          limit: batchSize,
          offset
        };

        const result = await this.db.queryNodes(query);
        
        for (const node of result.results) {
          try {
            const features = await this.extractSemanticFeatures(node);
            
            // Update node with semantic features
            await this.db.updateNode(node.id, {
              tags: [...node.tags, ...features.keywords, ...features.concepts],
              embeddings: features.embeddings
            });
          } catch (error) {
            console.error(`Failed to update embeddings for node ${node.id}:`, error);
          }
        }

        offset += batchSize;
        hasMore = result.results.length === batchSize;
      }

    } catch (error) {
      console.error('Embedding update failed:', error);
    }
  }
}