import * as tf from '@tensorflow/tfjs';
import * as tfn from '@tensorflow-models/universal-sentence-encoder';
import nlp from 'compromise';
import natural from 'natural';
import { NLPResult, IntentDefinition, NLPConfig } from './index';
import { MemoryGraph } from '@/memory/graph';

export interface AdvancedNLPConfig extends NLPConfig {
  useTensorFlow: boolean;
  useUniversalEncoder: boolean;
  maxContextTokens: number;
  embeddingModel: 'universal' | 'custom' | 'hybrid';
  confidenceThreshold: number;
  enableContextualAnalysis: boolean;
  enableTemporalAnalysis: boolean;
  enableCrossContextAnalysis: boolean;
  mlModelPath?: string;
}

export interface ContextualNLPResult extends NLPResult {
  contextualEmbeddings: number[];
  temporalContext: {
    recentActivities: string[];
    timeBasedRelevance: number;
    seasonalPatterns: string[];
  };
  crossContextInsights: {
    relatedTopics: string[];
    predictedIntent: string;
    confidence: number;
  };
  mlEnhanced: {
    embeddingSimilarity: number[];
    classificationConfidence: number;
    contextualRelevance: number;
  };
}

export interface ConversationContext {
  sessionId: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    intent?: string;
    entities?: Record<string, any>;
  }>;
  currentTopic: string;
  userPreferences: {
    responseStyle: 'concise' | 'detailed' | 'friendly' | 'professional';
    language: string;
    topicsOfInterest: string[];
  };
  contextWindow: {
    maxTokens: number;
    currentTokens: number;
    pruneThreshold: number;
  };
}

export class AdvancedNaturalLanguageProcessor {
  private config: AdvancedNLPConfig;
  private isInitialized = false;
  private isRunning = false;

  // TensorFlow.js components
  private tfModel: tfn.UniversalSentenceEncoder | null = null;
  private customModel: tf.LayersModel | null = null;
  private isTensorFlowAvailable = false;

  // Enhanced NLP components
  private intents: Map<string, IntentDefinition> = new Map();
  private entityPatterns: Map<string, RegExp> = new Map();
  private responseTemplates: Map<string, string[]> = new Map();

  // Context management
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private contextCache: Map<string, ContextualNLPResult> = new Map();

  // Performance metrics
  private metrics = {
    totalProcessed: 0,
    averageConfidence: 0,
    averageProcessingTime: 0,
    mlModelCalls: 0,
    cacheHits: 0,
    contextHits: 0,
    errors: 0,
    tensorFlowInitializationTime: 0,
    averageEmbeddingTime: 0,
    averageClassificationTime: 0
  };

  // ML model cache
  private embeddingCache: Map<string, number[]> = new Map();
  private classificationCache: Map<string, { intent: string; confidence: number }> = new Map();

  constructor(config: AdvancedNLPConfig) {
    this.config = config;
    this.initializeIntents();
    this.initializeEntityPatterns();
    this.initializeResponseTemplates();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const startTime = performance.now();

    try {
      console.log('[AdvancedNaturalLanguageProcessor] Initializing...');

      // Initialize basic NLP components
      await this.initializeBasicNLP();

      // Initialize TensorFlow.js if enabled
      if (this.config.useTensorFlow) {
        await this.initializeTensorFlow();
      }

      // Load ML models
      if (this.config.mlModelPath) {
        await this.loadCustomModel();
      }

      // Initialize conversation context management
      this.initializeContextManagement();

      this.isInitialized = true;
      
      const initializationTime = performance.now() - startTime;
      this.metrics.tensorFlowInitializationTime = initializationTime;
      
      console.log(`[AdvancedNaturalLanguageProcessor] Initialized successfully in ${initializationTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Initialization failed:', error);
      throw error;
    }
  }

  private async initializeBasicNLP(): Promise<void> {
    // Initialize compromise with plugins
    const compromise = nlp;
    
    // Setup custom extensions for domain-specific processing
    this.setupCustomExtensions(compromise);

    // Initialize natural language processing utilities
    this.tokenizer = new natural.SentenceTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();

    console.log('[AdvancedNaturalLanguageProcessor] Basic NLP initialized');
  }

  private async initializeTensorFlow(): Promise<void> {
    try {
      console.log('[AdvancedNaturalLanguageProcessor] Initializing TensorFlow.js...');

      // Check if TensorFlow.js is available
      if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js not available');
      }

      // Initialize Universal Sentence Encoder if enabled
      if (this.config.useUniversalEncoder) {
        console.log('[AdvancedNaturalLanguageProcessor] Loading Universal Sentence Encoder...');
        this.tfModel = await tfn.load();
        console.log('[AdvancedNaturalLanguageProcessor] Universal Sentence Encoder loaded successfully');
      }

      // Set up WebGL backend for better performance
      await tf.setBackend('webgl');
      await tf.ready();

      this.isTensorFlowAvailable = true;
      console.log('[AdvancedNaturalLanguageProcessor] TensorFlow.js initialized successfully');

    } catch (error) {
      console.warn('[AdvancedNaturalLanguageProcessor] TensorFlow.js initialization failed, falling back to basic NLP:', error);
      this.isTensorFlowAvailable = false;
      this.config.useTensorFlow = false;
    }
  }

  private async loadCustomModel(): Promise<void> {
    try {
      if (!this.config.mlModelPath || !this.isTensorFlowAvailable) {
        return;
      }

      console.log(`[AdvancedNaturalLanguageProcessor] Loading custom model from ${this.config.mlModelPath}...`);
      
      // Load custom model (this would be a pre-trained model for intent classification)
      this.customModel = await tf.loadLayersModel(this.config.mlModelPath);
      
      console.log('[AdvancedNaturalLanguageProcessor] Custom model loaded successfully');

    } catch (error) {
      console.warn('[AdvancedNaturalLanguageProcessor] Custom model loading failed:', error);
      this.customModel = null;
    }
  }

  private initializeContextManagement(): void {
    // Set up context window management
    this.config.maxContextTokens = this.config.maxContextTokens || 10000;
    
    console.log('[AdvancedNaturalLanguageProcessor] Context management initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[AdvancedNaturalLanguageProcessor] Starting...');
      this.isRunning = true;
      console.log('[AdvancedNaturalLanguageProcessor] Started successfully');

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[AdvancedNaturalLanguageProcessor] Stopping...');
      this.isRunning = false;
      console.log('[AdvancedNaturalLanguageProcessor] Stopped successfully');

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Stop failed:', error);
    }
  }

  async process(
    text: string,
    sessionId?: string,
    context?: any
  ): Promise<ContextualNLPResult> {
    if (!this.isInitialized) {
      throw new Error('Advanced NLP processor not initialized');
    }

    const startTime = performance.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(text, sessionId, context);
      const cached = this.contextCache.get(cacheKey);
      if (cached && Date.now() - cached.processedAt < 300000) {
        this.metrics.cacheHits++;
        return cached;
      }

      // Get or create conversation context
      const conversationContext = this.getOrCreateConversationContext(sessionId);

      // Preprocess text
      const processedText = this.preprocessText(text);

      // Basic NLP processing
      const basicResult = await this.processBasicNLP(processedText, context);

      // ML-enhanced processing if available
      const mlEnhanced = this.isTensorFlowAvailable 
        ? await this.processMLEnhanced(processedText, conversationContext)
        : this.getFallbackMLEnhanced();

      // Contextual analysis
      const contextualAnalysis = this.config.enableContextualAnalysis
        ? await this.analyzeContextual(processedText, conversationContext, basicResult)
        : this.getFallbackContextualAnalysis();

      // Temporal analysis if enabled
      const temporalContext = this.config.enableTemporalAnalysis
        ? await this.analyzeTemporal(processedText, conversationContext)
        : this.getFallbackTemporalAnalysis();

      // Cross-context analysis if enabled
      const crossContextInsights = this.config.enableCrossContextAnalysis
        ? await this.analyzeCrossContext(processedText, conversationContext, basicResult)
        : this.getFallbackCrossContextAnalysis();

      // Combine all results
      const result: ContextualNLPResult = {
        ...basicResult,
        contextualEmbeddings: mlEnhanced.contextualEmbeddings,
        temporalContext,
        crossContextInsights,
        mlEnhanced: {
          embeddingSimilarity: mlEnhanced.embeddingSimilarity,
          classificationConfidence: mlEnhanced.classificationConfidence,
          contextualRelevance: contextualAnalysis.relevance
        }
      };

      // Update conversation context
      this.updateConversationContext(sessionId, text, result);

      // Cache result
      this.contextCache.set(cacheKey, result);

      // Update metrics
      this.updateMetrics(result, performance.now() - startTime);

      return result;

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Error processing text:', error);
      this.metrics.errors++;

      return this.getFallbackResult(text, sessionId);
    }
  }

  private async processBasicNLP(text: string, context?: any): Promise<NLPResult> {
    const startTime = performance.now();

    // Process with compromise
    const doc = nlp(text);

    // Extract basic information
    const entities = this.extractEntities(doc, text);
    const sentiment = this.analyzeSentiment(doc, text);
    const keywords = this.extractKeywords(doc, text);
    const topics = this.extractTopics(doc, text);
    const language = this.detectLanguage(doc, text);

    // Determine intent
    const intent = this.determineIntent(text, entities, context);
    const confidence = this.calculateConfidence(intent, entities, text);

    return {
      text,
      intent: intent.name,
      entities,
      confidence,
      sentiment,
      keywords,
      topics,
      language,
      processedAt: Date.now()
    };
  }

  private async processMLEnhanced(
    text: string,
    context: ConversationContext
  ): Promise<{
    contextualEmbeddings: number[];
    embeddingSimilarity: number[];
    classificationConfidence: number;
  }> {
    const embeddingStart = performance.now();

    try {
      let contextualEmbeddings: number[] = [];
      let embeddingSimilarity: number[] = [];
      let classificationConfidence = 0;

      // Generate embeddings using Universal Sentence Encoder
      if (this.tfModel) {
        const embeddings = await this.tfModel.embed([text]);
        contextualEmbeddings = Array.from(await embeddings.data());
        embeddings.dispose();

        // Calculate similarity with conversation history
        if (context.history.length > 0) {
          embeddingSimilarity = await this.calculateEmbeddingSimilarities(
            contextualEmbeddings,
            context
          );
        }

        this.metrics.averageEmbeddingTime = this.updateAverage(
          this.metrics.averageEmbeddingTime,
          performance.now() - embeddingStart,
          ++this.metrics.mlModelCalls
        );
      }

      // Use custom model for classification if available
      if (this.customModel) {
        const classificationStart = performance.now();
        
        // Prepare input for custom model (this would need to be adapted based on model input format)
        const input = this.prepareModelInput(text, context);
        const prediction = this.customModel.predict(input) as tf.Tensor;
        const probabilities = Array.from(await prediction.data());
        
        classificationConfidence = Math.max(...probabilities);
        
        prediction.dispose();
        input.dispose();

        this.metrics.averageClassificationTime = this.updateAverage(
          this.metrics.averageClassificationTime,
          performance.now() - classificationStart,
          ++this.metrics.mlModelCalls
        );
      }

      return {
        contextualEmbeddings,
        embeddingSimilarity,
        classificationConfidence
      };

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] ML enhanced processing failed:', error);
      return this.getFallbackMLEnhanced();
    }
  }

  private async analyzeContextual(
    text: string,
    context: ConversationContext,
    basicResult: NLPResult
  ): Promise<{ relevance: number; contextualFactors: string[] }> {
    try {
      let relevance = 0.5; // Base relevance
      const contextualFactors: string[] = [];

      // Analyze relevance based on conversation history
      if (context.history.length > 0) {
        const historyText = context.history
          .map(h => h.content)
          .join(' ')
          .toLowerCase();

        // Check for topic continuity
        const commonKeywords = basicResult.keywords.filter(keyword => 
          historyText.includes(keyword.toLowerCase())
        );

        if (commonKeywords.length > 0) {
          relevance += 0.2;
          contextualFactors.push('topic_continuity');
        }

        // Check for intent consistency
        const recentIntents = context.history
          .slice(-3)
          .map(h => h.intent)
          .filter(Boolean);

        if (recentIntents.includes(basicResult.intent)) {
          relevance += 0.15;
          contextualFactors.push('intent_consistency');
        }
      }

      // Analyze user preferences
      if (context.userPreferences.topicsOfInterest.length > 0) {
        const matchingTopics = basicResult.topics.filter(topic =>
          context.userPreferences.topicsOfInterest.some(interest =>
            topic.toLowerCase().includes(interest.toLowerCase())
          )
        );

        if (matchingTopics.length > 0) {
          relevance += 0.1;
          contextualFactors.push('user_preference_match');
        }
      }

      // Analyze temporal patterns
      const timeOfDay = new Date().getHours();
      if (timeOfDay >= 9 && timeOfDay <= 17) {
        relevance += 0.05; // Slight boost during business hours
        contextualFactors.push('business_hours');
      }

      return {
        relevance: Math.min(1.0, relevance),
        contextualFactors
      };

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Contextual analysis failed:', error);
      return { relevance: 0.5, contextualFactors: [] };
    }
  }

  private async analyzeTemporal(
    text: string,
    context: ConversationContext
  ): Promise<{
    recentActivities: string[];
    timeBasedRelevance: number;
    seasonalPatterns: string[];
  }> {
    try {
      const recentActivities: string[] = [];
      let timeBasedRelevance = 0.5;
      const seasonalPatterns: string[] = [];

      // Analyze recent conversation activities
      if (context.history.length > 0) {
        const recentHistory = context.history.slice(-5);
        recentActivities.push(...recentHistory.map(h => h.intent || 'unknown'));

        // Calculate time-based relevance based on conversation frequency
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const recentConversations = context.history.filter(
          h => h.timestamp > oneHourAgo
        );

        if (recentConversations.length > 0) {
          timeBasedRelevance += 0.2;
        }
      }

      // Detect seasonal patterns
      const currentMonth = new Date().getMonth();
      const currentDay = new Date().getDay();

      // Add seasonal patterns based on time
      if (currentDay === 0 || currentDay === 6) {
        seasonalPatterns.push('weekend');
      } else {
        seasonalPatterns.push('weekday');
      }

      // Add monthly patterns
      if (currentMonth >= 11 || currentMonth <= 1) {
        seasonalPatterns.push('holiday_season');
      } else if (currentMonth >= 5 && currentMonth <= 7) {
        seasonalPatterns.push('summer');
      }

      return {
        recentActivities,
        timeBasedRelevance: Math.min(1.0, timeBasedRelevance),
        seasonalPatterns
      };

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Temporal analysis failed:', error);
      return {
        recentActivities: [],
        timeBasedRelevance: 0.5,
        seasonalPatterns: []
      };
    }
  }

  private async analyzeCrossContext(
    text: string,
    context: ConversationContext,
    basicResult: NLPResult
  ): Promise<{
    relatedTopics: string[];
    predictedIntent: string;
    confidence: number;
  }> {
    try {
      const relatedTopics: string[] = [];
      let predictedIntent = basicResult.intent;
      let confidence = basicResult.confidence;

      // Analyze cross-topic relationships
      if (context.history.length > 0) {
        const allTopics = [
          ...context.history.flatMap(h => h.entities?.topics || []),
          ...basicResult.topics
        ];

        // Find related topics using simple co-occurrence
        const topicCounts: Record<string, number> = {};
        allTopics.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });

        // Get topics that appear multiple times
        Object.entries(topicCounts).forEach(([topic, count]) => {
          if (count > 1 && !basicResult.topics.includes(topic)) {
            relatedTopics.push(topic);
          }
        });
      }

      // Predict next intent based on conversation flow
      if (context.history.length > 2) {
        const intentSequence = context.history
          .slice(-3)
          .map(h => h.intent)
          .filter(Boolean);

        if (intentSequence.length >= 2) {
          // Simple pattern-based intent prediction
          const lastTwoIntents = intentSequence.slice(-2);
          
          // Common conversation patterns
          if (lastTwoIntents[0] === 'search' && lastTwoIntents[1] === 'analyze') {
            predictedIntent = 'organize';
            confidence = Math.min(1.0, confidence + 0.1);
          } else if (lastTwoIntents[0] === 'capture' && lastTwoIntents[1] === 'organize') {
            predictedIntent = 'automate';
            confidence = Math.min(1.0, confidence + 0.1);
          }
        }
      }

      return {
        relatedTopics,
        predictedIntent,
        confidence
      };

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Cross-context analysis failed:', error);
      return {
        relatedTopics: [],
        predictedIntent: basicResult.intent,
        confidence: basicResult.confidence
      };
    }
  }

  private async calculateEmbeddingSimilarities(
    embeddings: number[],
    context: ConversationContext
  ): Promise<number[]> {
    try {
      const similarities: number[] = [];

      for (const historyItem of context.history) {
        // Generate embeddings for historical text
        const historyEmbeddings = await this.generateEmbeddings(historyItem.content);
        
        if (historyEmbeddings && historyEmbeddings.length === embeddings.length) {
          const similarity = this.calculateCosineSimilarity(embeddings, historyEmbeddings);
          similarities.push(similarity);
        }
      }

      return similarities;

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Embedding similarity calculation failed:', error);
      return [];
    }
  }

  private async generateEmbeddings(text: string): Promise<number[] | null> {
    try {
      if (!this.tfModel) return null;

      // Check cache first
      const cacheKey = text.slice(0, 100); // Use first 100 chars as cache key
      const cached = this.embeddingCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Generate embeddings
      const embeddings = await this.tfModel.embed([text]);
      const embeddingArray = Array.from(await embeddings.data());
      embeddings.dispose();

      // Cache result
      this.embeddingCache.set(cacheKey, embeddingArray);

      return embeddingArray;

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Embedding generation failed:', error);
      return null;
    }
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

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

  private prepareModelInput(text: string, context: ConversationContext): tf.Tensor {
    // This is a simplified version - actual implementation would depend on model requirements
    const textLength = Math.min(text.length, 512);
    const paddedText = text.padEnd(512, ' ').slice(0, 512);
    
    // Convert text to numerical representation (simplified)
    const input = new Float32Array(512);
    for (let i = 0; i < textLength; i++) {
      input[i] = paddedText.charCodeAt(i) / 255;
    }

    return tf.tensor2d([input], [1, 512]);
  }

  private getOrCreateConversationContext(sessionId?: string): ConversationContext {
    if (!sessionId) {
      // Create temporary context for sessionless requests
      return {
        sessionId: 'temp',
        history: [],
        currentTopic: '',
        userPreferences: {
          responseStyle: 'friendly',
          language: 'en',
          topicsOfInterest: []
        },
        contextWindow: {
          maxTokens: this.config.maxContextTokens,
          currentTokens: 0,
          pruneThreshold: 0.8
        }
      };
    }

    let context = this.conversationContexts.get(sessionId);
    if (!context) {
      context = {
        sessionId,
        history: [],
        currentTopic: '',
        userPreferences: {
          responseStyle: 'friendly',
          language: 'en',
          topicsOfInterest: []
        },
        contextWindow: {
          maxTokens: this.config.maxContextTokens,
          currentTokens: 0,
          pruneThreshold: 0.8
        }
      };
      this.conversationContexts.set(sessionId, context);
    }

    return context;
  }

  private updateConversationContext(
    sessionId: string,
    text: string,
    result: ContextualNLPResult
  ): void {
    const context = this.conversationContexts.get(sessionId);
    if (!context) return;

    // Add to history
    context.history.push({
      role: 'user',
      content: text,
      timestamp: Date.now(),
      intent: result.intent,
      entities: result.entities
    });

    // Update current topic
    if (result.topics.length > 0) {
      context.currentTopic = result.topics[0];
    }

    // Update user preferences based on interaction
    if (result.entities.topic) {
      const topics = Array.isArray(result.entities.topic) 
        ? result.entities.topic 
        : [result.entities.topic];
      
      topics.forEach(topic => {
        if (!context.userPreferences.topicsOfInterest.includes(topic)) {
          context.userPreferences.topicsOfInterest.push(topic);
        }
      });
    }

    // Manage context window size
    this.manageContextWindow(context);

    // Clean up old contexts periodically
    this.cleanupOldContexts();
  }

  private manageContextWindow(context: ConversationContext): void {
    const maxHistoryLength = 50;
    const maxTokens = context.contextWindow.maxTokens;

    // Calculate current token count
    let currentTokens = 0;
    context.history.forEach(item => {
      currentTokens += this.estimateTokenCount(item.content);
    });

    context.contextWindow.currentTokens = currentTokens;

    // Prune if exceeding limits
    if (context.history.length > maxHistoryLength || 
        currentTokens > maxTokens * context.contextWindow.pruneThreshold) {
      
      // Remove oldest entries until within limits
      while (context.history.length > maxHistoryLength || 
             currentTokens > maxTokens * 0.7) {
        
        const removed = context.history.shift();
        if (removed) {
          currentTokens -= this.estimateTokenCount(removed.content);
        }
      }

      context.contextWindow.currentTokens = currentTokens;
    }
  }

  private estimateTokenCount(text: string): number {
    // Simple token estimation (rough approximation)
    return Math.ceil(text.length / 4);
  }

  private cleanupOldContexts(): void {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const [sessionId, context] of this.conversationContexts.entries()) {
      const lastActivity = context.history.length > 0 
        ? context.history[context.history.length - 1].timestamp 
        : 0;

      if (lastActivity < oneWeekAgo) {
        this.conversationContexts.delete(sessionId);
      }
    }
  }

  // Override basic methods to use enhanced versions
  private initializeIntents(): void {
    // Enhanced intents with ML support
    this.intents.set('help', {
      name: 'help',
      patterns: [
        'help', 'what can you do', 'how do I', 'show me', 'assist me',
        'I need help', 'can you help', 'support', 'guide', 'explain',
        'teach me', 'learn about', 'understand', 'clarify'
      ],
      responses: [
        "I'm here to help! I can assist with productivity, information management, and workflow optimization.",
        "As your advanced AI assistant, I can help you capture information, search your memories, and automate tasks.",
        "I'm equipped with natural language understanding and contextual awareness. What would you like help with?",
        "I can analyze your patterns, provide insights, and help you organize your digital life. How can I assist?"
      ],
      entities: ['topic', 'action', 'difficulty'],
      priority: 1,
      confidence: 0.95
    });

    // Add more enhanced intents...
    this.intents.set('analyze_patterns', {
      name: 'analyze_patterns',
      patterns: [
        'analyze my patterns', 'show me patterns', 'what are my habits',
        'pattern analysis', 'behavior insights', 'workflow analysis',
        'productivity patterns', 'usage patterns', 'activity patterns'
      ],
      responses: [
        "I'll analyze your activity patterns to identify trends and insights about your productivity.",
        "Pattern analysis complete! I've identified several interesting trends in your workflow and habits.",
        "Based on your activity history, here are the key patterns I've discovered in your behavior."
      ],
      entities: ['timeframe', 'category', 'focus_area'],
      priority: 8,
      confidence: 0.9
    });

    // Initialize basic intents from parent class
    super.initializeIntents();
  }

  private getFallbackMLEnhanced(): {
    contextualEmbeddings: number[];
    embeddingSimilarity: number[];
    classificationConfidence: number;
  } {
    return {
      contextualEmbeddings: new Array(512).fill(0),
      embeddingSimilarity: [],
      classificationConfidence: 0.5
    };
  }

  private getFallbackContextualAnalysis(): { relevance: number; contextualFactors: string[] } {
    return { relevance: 0.5, contextualFactors: [] };
  }

  private getFallbackTemporalAnalysis(): {
    recentActivities: string[];
    timeBasedRelevance: number;
    seasonalPatterns: string[];
  } {
    return {
      recentActivities: [],
      timeBasedRelevance: 0.5,
      seasonalPatterns: []
    };
  }

  private getFallbackCrossContextAnalysis(): {
    relatedTopics: string[];
    predictedIntent: string;
    confidence: number;
  } {
    return {
      relatedTopics: [],
      predictedIntent: 'unknown',
      confidence: 0.5
    };
  }

  private getFallbackResult(text: string, sessionId?: string): ContextualNLPResult {
    return {
      text,
      intent: 'unknown',
      entities: {},
      confidence: 0,
      sentiment: { score: 0, magnitude: 0, label: 'neutral' },
      keywords: [],
      topics: [],
      language: 'en',
      processedAt: Date.now(),
      contextualEmbeddings: [],
      temporalContext: {
        recentActivities: [],
        timeBasedRelevance: 0.5,
        seasonalPatterns: []
      },
      crossContextInsights: {
        relatedTopics: [],
        predictedIntent: 'unknown',
        confidence: 0.5
      },
      mlEnhanced: {
        embeddingSimilarity: [],
        classificationConfidence: 0,
        contextualRelevance: 0.5
      }
    };
  }

  private generateCacheKey(text: string, sessionId?: string, context?: any): string {
    const contextStr = context ? JSON.stringify(context) : '';
    const sessionIdStr = sessionId || '';
    return `${text}:${sessionIdStr}:${contextStr}`.slice(0, 200);
  }

  private updateMetrics(result: ContextualNLPResult, processingTime: number): void {
    this.metrics.totalProcessed++;
    this.metrics.averageConfidence = this.updateAverage(
      this.metrics.averageConfidence,
      result.confidence,
      this.metrics.totalProcessed
    );
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

  // Public API methods
  isHealthy(): boolean {
    return this.isRunning && this.metrics.errors / Math.max(this.metrics.totalProcessed, 1) < 0.05;
  }

  getMetrics() {
    return { 
      ...this.metrics, 
      contextCacheSize: this.contextCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      activeContexts: this.conversationContexts.size,
      isTensorFlowAvailable: this.isTensorFlowAvailable
    };
  }

  async updateConfig(newConfig: Partial<AdvancedNLPConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    // Clean up TensorFlow.js resources
    if (this.tfModel) {
      this.tfModel.dispose();
      this.tfModel = null;
    }
    
    if (this.customModel) {
      this.customModel.dispose();
      this.customModel = null;
    }

    // Clear caches
    this.contextCache.clear();
    this.embeddingCache.clear();
    this.classificationCache.clear();
    this.conversationContexts.clear();

    // Dispose TensorFlow.js backend
    if (this.isTensorFlowAvailable) {
      await tf.disposeVariables();
    }

    this.isInitialized = false;
    console.log('[AdvancedNaturalLanguageProcessor] Cleanup completed');
  }

  // Additional utility methods
  getConversationContext(sessionId: string): ConversationContext | undefined {
    return this.conversationContexts.get(sessionId);
  }

  clearConversationContext(sessionId: string): void {
    this.conversationContexts.delete(sessionId);
  }

  async exportConversationHistory(sessionId: string): Promise<any[]> {
    const context = this.conversationContexts.get(sessionId);
    return context ? context.history : [];
  }

  async generateContextualResponse(
    intent: string,
    entities: Record<string, any>,
    context: ConversationContext,
    contextualInfo: any[],
    responseStyle: string = this.config.responseStyle
  ): Promise<string> {
    try {
      // Get base response from parent class
      const baseResponse = await super.generateResponse(
        intent,
        entities,
        context,
        contextualInfo,
        responseStyle
      );

      // Enhance with contextual information
      let enhancedResponse = baseResponse;

      // Add contextual references if available
      if (context.history.length > 0) {
        const recentTopics = context.history
          .slice(-3)
          .map(h => h.entities?.topics || [])
          .flat();

        if (recentTopics.length > 0) {
          enhancedResponse += `\n\nI notice you've been exploring ${recentTopics.join(', ')} recently.`;
        }
      }

      // Add temporal context if relevant
      const hour = new Date().getHours();
      if (hour >= 6 && hour <= 12) {
        enhancedResponse += '\nGood morning! ';
      } else if (hour >= 12 && hour <= 18) {
        enhancedResponse += '\nGood afternoon! ';
      } else {
        enhancedResponse += '\nGood evening! ';
      }

      return enhancedResponse;

    } catch (error) {
      console.error('[AdvancedNaturalLanguageProcessor] Contextual response generation failed:', error);
      return await super.generateResponse(intent, entities, context, contextualInfo, responseStyle);
    }
  }
}