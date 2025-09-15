import * as tf from '@tensorflow/tfjs';
import { MemoryGraph } from '@/memory/graph';
import { AdvancedNaturalLanguageProcessor, ContextualNLPResult, ConversationContext } from '../nlp/advanced-nlp';
import { AdvancedSemanticSimilarityEngine, AdvancedSemanticFeatures } from '@/memory/graph/advanced-semantic';

export interface ResponseGenerationConfig {
  enableContextAwareness: boolean;
  enableMemoryIntegration: boolean;
  enablePersonalization: boolean;
  enableEmotionalIntelligence: boolean;
  enableProactiveAssistance: boolean;
  maxResponseLength: number;
  creativityLevel: number; // 0-1, where 0 is factual, 1 is creative
  formalityLevel: number; // 0-1, where 0 is casual, 1 is formal
  confidenceThreshold: number;
  responseStyle: 'concise' | 'detailed' | 'friendly' | 'professional' | 'adaptive';
}

export interface ContextualResponse {
  content: string;
  confidence: number;
  relevance: number;
  personalization: number;
  emotionalTone: string;
  reasoning: string;
  sources: Array<{
    type: 'memory' | 'knowledge' | 'pattern' | 'prediction';
    id: string;
    relevance: number;
    description: string;
  }>;
  suggestions: Array<{
    type: 'action' | 'information' | 'follow_up';
    content: string;
    priority: number;
  }>;
  metadata: {
    processingTime: number;
    contextUsed: boolean;
    memoryUsed: boolean;
    personalized: boolean;
    adaptiveStyle: boolean;
  };
}

export interface ResponseContext {
  userQuery: string;
  nlpResult: ContextualNLPResult;
  conversationContext: ConversationContext;
  memoryContext: {
    relevantMemories: Array<{
      id: string;
      content: any;
      similarity: number;
      timestamp: number;
    }>;
    patterns: Array<{
      pattern: string;
      confidence: number;
      frequency: number;
    }>;
  };
  situationalContext: {
    timeOfDay: string;
    dayOfWeek: string;
    userActivity: string;
    deviceContext: string;
  };
  emotionalContext: {
    detectedEmotion: string;
    confidence: number;
    userMood: string;
  };
}

export class ContextAwareResponseGenerator {
  private config: ResponseGenerationConfig;
  private nlpProcessor: AdvancedNaturalLanguageProcessor;
  private semanticEngine: AdvancedSemanticSimilarityEngine;
  private memoryGraph: MemoryGraph;
  private isInitialized = false;

  // Response generation models
  private responseModel: tf.LayersModel | null = null;
  private personalizationModel: tf.LayersModel | null = null;
  private emotionModel: tf.LayersModel | null = null;

  // Response templates and patterns
  private responseTemplates: Map<string, Array<{
    template: string;
    conditions: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
    weight: number;
  }>> = new Map();

  // Personalization data
  private userProfiles: Map<string, {
    preferences: {
      communicationStyle: string;
      topicsOfInterest: string[];
      interactionHistory: Array<{
        timestamp: number;
        type: string;
        satisfaction: number;
      }>;
    };
    behaviorPatterns: {
      responseTime: number;
      queryComplexity: number;
      preferredInteractionTimes: number[];
    };
  }> = new Map();

  // Performance metrics
  private metrics = {
    totalResponses: 0,
    averageConfidence: 0,
    averageRelevance: 0,
    averageProcessingTime: 0,
    personalizationHits: 0,
    contextUsage: 0,
    memoryUsage: 0,
    adaptiveResponses: 0,
    templateUsage: 0,
    mlGenerated: 0,
    errors: 0
  };

  constructor(
    config: ResponseGenerationConfig,
    nlpProcessor: AdvancedNaturalLanguageProcessor,
    semanticEngine: AdvancedSemanticSimilarityEngine,
    memoryGraph: MemoryGraph
  ) {
    this.config = config;
    this.nlpProcessor = nlpProcessor;
    this.semanticEngine = semanticEngine;
    this.memoryGraph = memoryGraph;
    
    this.initializeResponseTemplates();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[ContextAwareResponseGenerator] Initializing...');

      // Initialize ML models if needed
      if (this.config.enablePersonalization || this.config.enableEmotionalIntelligence) {
        await this.initializeModels();
      }

      // Load user profiles
      await this.loadUserProfiles();

      this.isInitialized = true;
      console.log('[ContextAwareResponseGenerator] Initialized successfully');

    } catch (error) {
      console.error('[ContextAwareResponseGenerator] Initialization failed:', error);
      throw error;
    }
  }

  private async initializeModels(): Promise<void> {
    try {
      // Initialize response generation model
      this.responseModel = await this.createResponseModel();

      // Initialize personalization model
      if (this.config.enablePersonalization) {
        this.personalizationModel = await this.createPersonalizationModel();
      }

      // Initialize emotion model
      if (this.config.enableEmotionalIntelligence) {
        this.emotionModel = await this.createEmotionModel();
      }

      console.log('[ContextAwareResponseGenerator] ML models initialized successfully');

    } catch (error) {
      console.warn('[ContextAwareResponseGenerator] ML model initialization failed:', error);
    }
  }

  private async createResponseModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: 10000, outputDim: 256, inputLength: 100 }),
        tf.layers.bidirectional(tf.layers.lstm({ units: 128, returnSequences: true })),
        tf.layers.bidirectional(tf.layers.lstm({ units: 64 })),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
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

  private async createPersonalizationModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [50], units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
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

  private async createEmotionModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [30], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'softmax' }) // 8 emotions
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private async loadUserProfiles(): Promise<void> {
    // Load user profiles from storage
    // This is a placeholder - in production, load from encrypted storage
    console.log('[ContextAwareResponseGenerator] User profiles loaded');
  }

  async generateResponse(
    userQuery: string,
    sessionId: string,
    options: {
      forceStyle?: string;
      overridePersonalization?: boolean;
      includeReasoning?: boolean;
      maxSuggestions?: number;
    } = {}
  ): Promise<ContextualResponse> {
    if (!this.isInitialized) {
      throw new Error('Response generator not initialized');
    }

    const startTime = performance.now();

    try {
      // Process user query with advanced NLP
      const nlpResult = await this.nlpProcessor.process(userQuery, sessionId);
      
      // Get conversation context
      const conversationContext = this.nlpProcessor.getConversationContext(sessionId) ||
        this.createDefaultConversationContext(sessionId);

      // Build comprehensive response context
      const responseContext = await this.buildResponseContext(
        userQuery,
        nlpResult,
        conversationContext
      );

      // Generate response content
      const responseContent = await this.generateResponseContent(responseContext, options);

      // Enhance response with additional features
      const enhancedResponse = await this.enhanceResponse(responseContent, responseContext);

      // Generate suggestions if enabled
      const suggestions = this.config.enableProactiveAssistance
        ? await this.generateSuggestions(enhancedResponse, responseContext)
        : [];

      // Create final response
      const response: ContextualResponse = {
        content: enhancedResponse.content,
        confidence: enhancedResponse.confidence,
        relevance: enhancedResponse.relevance,
        personalization: enhancedResponse.personalization,
        emotionalTone: enhancedResponse.emotionalTone,
        reasoning: enhancedResponse.reasoning,
        sources: enhancedResponse.sources,
        suggestions: suggestions.slice(0, options.maxSuggestions || 3),
        metadata: {
          processingTime: performance.now() - startTime,
          contextUsed: responseContext.memoryContext.relevantMemories.length > 0,
          memoryUsed: enhancedResponse.sources.some(s => s.type === 'memory'),
          personalized: enhancedResponse.personalization > 0.5,
          adaptiveStyle: options.forceStyle !== undefined
        }
      };

      // Update metrics
      this.updateMetrics(response);

      // Learn from interaction
      await this.learnFromInteraction(response, responseContext);

      return response;

    } catch (error) {
      console.error('[ContextAwareResponseGenerator] Response generation failed:', error);
      this.metrics.errors++;
      return this.getFallbackResponse(userQuery);
    }
  }

  private async buildResponseContext(
    userQuery: string,
    nlpResult: ContextualNLPResult,
    conversationContext: ConversationContext
  ): Promise<ResponseContext> {
    const context: ResponseContext = {
      userQuery,
      nlpResult,
      conversationContext,
      memoryContext: {
        relevantMemories: [],
        patterns: []
      },
      situationalContext: {
        timeOfDay: this.getTimeOfDay(),
        dayOfWeek: this.getDayOfWeek(),
        userActivity: 'unknown',
        deviceContext: 'browser'
      },
      emotionalContext: {
        detectedEmotion: 'neutral',
        confidence: 0.5,
        userMood: 'neutral'
      }
    };

    // Enhance with memory context if enabled
    if (this.config.enableMemoryIntegration) {
      context.memoryContext = await this.enhanceWithMemoryContext(userQuery, nlpResult);
    }

    // Enhance with situational context
    context.situationalContext = await this.enhanceSituationalContext(context);

    // Enhance with emotional context
    if (this.config.enableEmotionalIntelligence) {
      context.emotionalContext = await this.enhanceEmotionalContext(userQuery, nlpResult);
    }

    return context;
  }

  private async enhanceWithMemoryContext(
    userQuery: string,
    nlpResult: ContextualNLPResult
  ): Promise<{
    relevantMemories: Array<{
      id: string;
      content: any;
      similarity: number;
      timestamp: number;
    }>;
    patterns: Array<{
      pattern: string;
      confidence: number;
      frequency: number;
    }>;
  }> {
    try {
      // Search for relevant memories
      const searchResults = await this.semanticEngine.searchNodes(userQuery, {
        limit: 10,
        threshold: 0.6,
        includeReasoning: true
      });

      const relevantMemories = searchResults.map(result => ({
        id: result.node.id,
        content: result.node.content,
        similarity: result.score,
        timestamp: result.node.timestamp
      }));

      // Extract patterns from search results
      const patterns = await this.extractPatternsFromMemories(relevantMemories);

      return {
        relevantMemories,
        patterns
      };

    } catch (error) {
      console.error('Memory context enhancement failed:', error);
      return {
        relevantMemories: [],
        patterns: []
      };
    }
  }

  private async extractPatternsFromMemories(
    memories: Array<{
      id: string;
      content: any;
      similarity: number;
      timestamp: number;
    }>
  ): Promise<Array<{
    pattern: string;
    confidence: number;
    frequency: number;
  }>> {
    try {
      const patterns: Array<{
        pattern: string;
        confidence: number;
        frequency: number;
      }> = [];

      // Analyze temporal patterns
      const temporalPatterns = this.analyzeTemporalPatterns(memories);
      patterns.push(...temporalPatterns);

      // Analyze content patterns
      const contentPatterns = this.analyzeContentPatterns(memories);
      patterns.push(...contentPatterns);

      return patterns.slice(0, 5); // Top 5 patterns

    } catch (error) {
      console.error('Pattern extraction failed:', error);
      return [];
    }
  }

  private analyzeTemporalPatterns(
    memories: Array<{
      id: string;
      content: any;
      similarity: number;
      timestamp: number;
    }>
  ): Array<{
    pattern: string;
    confidence: number;
    frequency: number;
  }> {
    const patterns: Array<{
      pattern: string;
      confidence: number;
      frequency: number;
    }> = [];

    try {
      // Group by time of day
      const hourlyActivity = new Array(24).fill(0);
      
      for (const memory of memories) {
        const hour = new Date(memory.timestamp).getHours();
        hourlyActivity[hour]++;
      }

      // Find peak hours
      const maxActivity = Math.max(...hourlyActivity);
      const peakHours = hourlyActivity
        .map((count, hour) => ({ hour, count }))
        .filter(item => item.count >= maxActivity * 0.7);

      if (peakHours.length > 0) {
        patterns.push({
          pattern: `peak_activity_${peakHours.map(h => h.hour).join('_')}`,
          confidence: 0.8,
          frequency: peakHours.reduce((sum, h) => sum + h.count, 0)
        });
      }

    } catch (error) {
      console.error('Temporal pattern analysis failed:', error);
    }

    return patterns;
  }

  private analyzeContentPatterns(
    memories: Array<{
      id: string;
      content: any;
      similarity: number;
      timestamp: number;
    }>
  ): Array<{
    pattern: string;
    confidence: number;
    frequency: number;
  }> {
    const patterns: Array<{
      pattern: string;
      confidence: number;
      frequency: number;
    }> = [];

    try {
      // Analyze content types
      const contentTypes: Record<string, number> = {};
      
      for (const memory of memories) {
        const contentType = this.determineContentType(memory.content);
        contentTypes[contentType] = (contentTypes[contentType] || 0) + 1;
      }

      // Find dominant content types
      const totalCount = Object.values(contentTypes).reduce((sum, count) => sum + count, 0);
      
      for (const [type, count] of Object.entries(contentTypes)) {
        if (count >= totalCount * 0.3) {
          patterns.push({
            pattern: `content_type_${type}`,
            confidence: count / totalCount,
            frequency: count
          });
        }
      }

    } catch (error) {
      console.error('Content pattern analysis failed:', error);
    }

    return patterns;
  }

  private determineContentType(content: any): string {
    if (typeof content === 'string') {
      return 'text';
    }
    
    if (typeof content === 'object') {
      if (content.url) return 'url';
      if (content.title && content.body) return 'document';
      if (content.transcript) return 'transcript';
      if (content.code) return 'code';
    }

    return 'unknown';
  }

  private async enhanceSituationalContext(context: ResponseContext): Promise<{
    timeOfDay: string;
    dayOfWeek: string;
    userActivity: string;
    deviceContext: string;
  }> {
    return {
      timeOfDay: this.getTimeOfDay(),
      dayOfWeek: this.getDayOfWeek(),
      userActivity: this.detectUserActivity(context.conversationContext),
      deviceContext: this.detectDeviceContext()
    };
  }

  private async enhanceEmotionalContext(
    userQuery: string,
    nlpResult: ContextualNLPResult
  ): Promise<{
    detectedEmotion: string;
    confidence: number;
    userMood: string;
  }> {
    try {
      // Use sentiment from NLP result
      const sentiment = nlpResult.sentiment;
      
      let emotion = 'neutral';
      let confidence = 0.5;
      let mood = 'neutral';

      // Map sentiment to emotion
      if (sentiment.score > 0.3) {
        emotion = 'positive';
        mood = 'happy';
        confidence = Math.abs(sentiment.score);
      } else if (sentiment.score < -0.3) {
        emotion = 'negative';
        mood = 'sad';
        confidence = Math.abs(sentiment.score);
      }

      // Use ML model if available
      if (this.emotionModel) {
        const mlEmotion = await this.predictEmotion(userQuery, nlpResult);
        if (mlEmotion.confidence > confidence) {
          emotion = mlEmotion.emotion;
          confidence = mlEmotion.confidence;
        }
      }

      return {
        detectedEmotion: emotion,
        confidence,
        userMood: mood
      };

    } catch (error) {
      console.error('Emotional context enhancement failed:', error);
      return {
        detectedEmotion: 'neutral',
        confidence: 0.5,
        userMood: 'neutral'
      };
    }
  }

  private async predictEmotion(
    userQuery: string,
    nlpResult: ContextualNLPResult
  ): Promise<{ emotion: string; confidence: number }> {
    if (!this.emotionModel) {
      return { emotion: 'neutral', confidence: 0.5 };
    }

    try {
      // Prepare input features
      const features = this.prepareEmotionFeatures(userQuery, nlpResult);
      
      // Predict emotion
      const prediction = this.emotionModel.predict(
        tf.tensor2d([features], [1, features.length])
      ) as tf.Tensor;

      const probabilities = Array.from(await prediction.data());
      prediction.dispose();

      const emotions = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm'];
      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      const confidence = probabilities[maxIndex];

      return {
        emotion: emotions[maxIndex],
        confidence
      };

    } catch (error) {
      console.error('Emotion prediction failed:', error);
      return { emotion: 'neutral', confidence: 0.5 };
    }
  }

  private prepareEmotionFeatures(
    userQuery: string,
    nlpResult: ContextualNLPResult
  ): number[] {
    const features: number[] = [];

    // Text length
    features.push(userQuery.length / 100); // Normalized

    // Sentiment score
    features.push(nlpResult.sentiment.score);

    // Sentiment magnitude
    features.push(nlpResult.sentiment.magnitude);

    // Question marks (indicates confusion or inquiry)
    const questionMarks = (userQuery.match(/\?/g) || []).length;
    features.push(questionMarks / 5); // Normalized

    // Exclamation marks (indicates excitement or frustration)
    const exclamationMarks = (userQuery.match(/!/g) || []).length;
    features.push(exclamationMarks / 5); // Normalized

    // Capital letters (indicates emphasis)
    const capitalRatio = (userQuery.match(/[A-Z]/g) || []).length / userQuery.length;
    features.push(capitalRatio);

    // Word count
    const wordCount = userQuery.split(/\s+/).length;
    features.push(wordCount / 20); // Normalized

    // Entity count
    const entityCount = Object.keys(nlpResult.entities).length;
    features.push(entityCount / 10); // Normalized

    // Keyword count
    features.push(nlpResult.keywords.length / 10); // Normalized

    // Pad to 30 features
    while (features.length < 30) {
      features.push(0);
    }

    return features.slice(0, 30);
  }

  private async generateResponseContent(
    context: ResponseContext,
    options: {
      forceStyle?: string;
      overridePersonalization?: boolean;
      includeReasoning?: boolean;
    }
  ): Promise<{
    content: string;
    confidence: number;
    relevance: number;
    personalization: number;
    emotionalTone: string;
    reasoning: string;
    sources: Array<{
      type: 'memory' | 'knowledge' | 'pattern' | 'prediction';
      id: string;
      relevance: number;
      description: string;
    }>;
  }> {
    try {
      // Determine response style
      const responseStyle = options.forceStyle || this.determineResponseStyle(context);

      // Select response template
      const template = await this.selectResponseTemplate(context, responseStyle);

      // Generate base response
      let content = template.template;

      // Personalize response if enabled
      let personalization = 0;
      if (this.config.enablePersonalization && !options.overridePersonalization) {
        const personalizationResult = await this.personalizeResponse(content, context);
        content = personalizationResult.content;
        personalization = personalizationResult.score;
      }

      // Add context and memory information
      if (this.config.enableContextAwareness && context.memoryContext.relevantMemories.length > 0) {
        content = await this.enrichWithMemoryContext(content, context);
      }

      // Add emotional intelligence
      let emotionalTone = 'neutral';
      if (this.config.enableEmotionalIntelligence) {
        const emotionalResult = await this.addEmotionalIntelligence(content, context);
        content = emotionalResult.content;
        emotionalTone = emotionalResult.tone;
      }

      // Add reasoning if requested
      let reasoning = '';
      if (options.includeReasoning) {
        reasoning = await this.generateReasoning(context);
      }

      // Generate sources
      const sources = await this.generateSources(context);

      // Calculate confidence and relevance
      const confidence = this.calculateResponseConfidence(context, content);
      const relevance = this.calculateResponseRelevance(context, content);

      return {
        content,
        confidence,
        relevance,
        personalization,
        emotionalTone,
        reasoning,
        sources
      };

    } catch (error) {
      console.error('Response content generation failed:', error);
      return this.getFallbackResponseContent(context);
    }
  }

  private determineResponseStyle(context: ResponseContext): string {
    // Use adaptive style if configured
    if (this.config.responseStyle === 'adaptive') {
      return this.adaptResponseStyle(context);
    }

    return this.config.responseStyle;
  }

  private adaptResponseStyle(context: ResponseContext): string {
    // Adapt based on user query and context
    const query = context.userQuery.toLowerCase();
    const conversationHistory = context.conversationContext.history;

    // Check for formal indicators
    if (query.includes('please') || query.includes('thank you') || query.includes('could you')) {
      return 'professional';
    }

    // Check for casual indicators
    if (query.includes('hey') || query.includes('what\'s up') || query.includes('cool')) {
      return 'friendly';
    }

    // Check for quick information requests
    if (query.includes('quick') || query.includes('brief') || query.includes('short')) {
      return 'concise';
    }

    // Check for detailed requests
    if (query.includes('explain') || query.includes('detailed') || query.includes('thorough')) {
      return 'detailed';
    }

    // Default to user preference
    return context.conversationContext.userPreferences.responseStyle || 'friendly';
  }

  private async selectResponseTemplate(
    context: ResponseContext,
    responseStyle: string
  ): Promise<{ template: string; conditions: any[]; weight: number }> {
    const intent = context.nlpResult.intent;
    const templates = this.responseTemplates.get(intent) || [];

    // Filter templates by response style
    const styleTemplates = templates.filter(t => {
      // This is a simplified filtering - in production, use more sophisticated matching
      return t.template.toLowerCase().includes(responseStyle) || t.weight > 0.5;
    });

    if (styleTemplates.length === 0) {
      // Fallback to default template
      return {
        template: this.getDefaultResponseTemplate(intent, responseStyle),
        conditions: [],
        weight: 0.5
      };
    }

    // Select template with highest weight that matches conditions
    const validTemplates = styleTemplates.filter(template => {
      return template.conditions.every(condition => {
        const fieldValue = this.getFieldValue(context, condition.field);
        return this.evaluateCondition(fieldValue, condition.operator, condition.value);
      });
    });

    if (validTemplates.length === 0) {
      return styleTemplates[0]; // Fallback to first template
    }

    // Select template with highest weight
    return validTemplates.reduce((best, current) => 
      current.weight > best.weight ? current : best
    );
  }

  private getFieldValue(context: ResponseContext, field: string): any {
    const fieldPath = field.split('.');
    let value: any = context;

    for (const path of fieldPath) {
      if (value && typeof value === 'object') {
        value = value[path];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateCondition(fieldValue: any, operator: string, value: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'contains':
        return Array.isArray(fieldValue) ? fieldValue.includes(value) : String(fieldValue).includes(value);
      case 'greater_than':
        return fieldValue > value;
      case 'less_than':
        return fieldValue < value;
      default:
        return false;
    }
  }

  private getDefaultResponseTemplate(intent: string, style: string): string {
    const templates: Record<string, Record<string, string>> = {
      help: {
        concise: "I can help with that. What do you need assistance with?",
        detailed: "I'd be happy to help you with that. I can assist with various tasks including information management, workflow optimization, and pattern analysis. What specific area would you like help with?",
        friendly: "Hey! I'd love to help you out! What can I assist you with today?",
        professional: "I'd be pleased to provide assistance. Please let me know what you require help with."
      },
      search: {
        concise: "I'll search for that information.",
        detailed: "I'll conduct a comprehensive search through your stored information and memories to find what you're looking for. Let me retrieve the most relevant results for you.",
        friendly: "Sure! Let me find that for you. Searching through your stuff now!",
        professional: "I will search through your knowledge base to locate the requested information."
      },
      capture: {
        concise: "Got it! I've captured that information.",
        detailed: "I've successfully captured that information for you. I've stored it in your personal knowledge base with appropriate tags and organization for easy retrieval later.",
        friendly: "Awesome! I've saved that for you. It's now part of your digital memory!",
        professional: "The information has been captured and stored in your knowledge management system."
      }
    };

    return templates[intent]?.[style] || templates.help[style];
  }

  private async personalizeResponse(
    content: string,
    context: ResponseContext
  ): Promise<{ content: string; score: number }> {
    try {
      let personalizedContent = content;
      let personalizationScore = 0;

      // Get user profile
      const userProfile = this.userProfiles.get(context.conversationContext.sessionId);
      
      if (userProfile) {
        // Adapt to communication style
        const preferredStyle = userProfile.preferences.communicationStyle;
        if (preferredStyle && preferredStyle !== 'neutral') {
          personalizedContent = this.adaptToCommunicationStyle(personalizedContent, preferredStyle);
          personalizationScore += 0.3;
        }

        // Include topics of interest
        const relevantTopics = userProfile.preferences.topicsOfInterest.filter(topic =>
          context.userQuery.toLowerCase().includes(topic.toLowerCase())
        );

        if (relevantTopics.length > 0) {
          personalizedContent += `\n\nI notice you're interested in ${relevantTopics.join(', ')}. I can provide more specific information about these topics if you'd like.`;
          personalizationScore += 0.4;
        }

        // Adapt to interaction patterns
        const interactionHistory = userProfile.preferences.interactionHistory;
        if (interactionHistory.length > 0) {
          const recentSatisfaction = interactionHistory
            .slice(-5)
            .reduce((sum, interaction) => sum + interaction.satisfaction, 0) / Math.min(5, interactionHistory.length);

          if (recentSatisfaction > 0.7) {
            personalizedContent = this.enhancePositiveExperience(personalizedContent);
            personalizationScore += 0.3;
          }
        }
      }

      return {
        content: personalizedContent,
        score: Math.min(1.0, personalizationScore)
      };

    } catch (error) {
      console.error('Response personalization failed:', error);
      return { content, score: 0 };
    }
  }

  private adaptToCommunicationStyle(content: string, style: string): string {
    switch (style) {
      case 'formal':
        return content
          .replace(/I'm/g, 'I am')
          .replace(/don't/g, 'do not')
          .replace(/won't/g, 'will not')
          .replace(/!/g, '.')
          .replace(/Hey/g, 'Hello')
          .replace(/cool/g, 'excellent');

      case 'casual':
        return content
          .replace(/I am/g, "I'm")
          .replace(/do not/g, "don't")
          .replace(/will not/g, "won't")
          .replace(/Hello/g, 'Hey')
          .replace(/excellent/g, 'cool');

      case 'technical':
        return content + '\n\nWould you like me to provide more technical details about this?';

      case 'simple':
        return content
          .replace(/comprehensive/g, 'simple')
          .replace(/detailed/g, 'clear')
          .replace(/sophisticated/g, 'helpful');

      default:
        return content;
    }
  }

  private enhancePositiveExperience(content: string): string {
    const enhancements = [
      "I'm glad I could help with that!",
      "It's great to assist you with your productivity needs.",
      "I enjoy helping you organize your digital life.",
      "Your feedback helps me improve my assistance."
    ];

    const enhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    return content + `\n\n${enhancement}`;
  }

  private async enrichWithMemoryContext(content: string, context: ResponseContext): Promise<string> {
    try {
      const relevantMemories = context.memoryContext.relevantMemories.slice(0, 3); // Top 3 memories
      
      if (relevantMemories.length === 0) {
        return content;
      }

      let enrichedContent = content;

      // Add memory references
      if (relevantMemories.length > 0) {
        enrichedContent += '\n\nBased on your previous activities:';
        
        for (const memory of relevantMemories) {
          const memoryPreview = this.generateMemoryPreview(memory);
          enrichedContent += `\n• ${memoryPreview}`;
        }
      }

      // Add pattern insights
      const patterns = context.memoryContext.patterns.slice(0, 2);
      if (patterns.length > 0) {
        enrichedContent += '\n\nI noticed some patterns in your activity:';
        
        for (const pattern of patterns) {
          const patternDescription = this.describePattern(pattern);
          enrichedContent += `\n• ${patternDescription}`;
        }
      }

      return enrichedContent;

    } catch (error) {
      console.error('Memory context enrichment failed:', error);
      return content;
    }
  }

  private generateMemoryPreview(memory: {
    id: string;
    content: any;
    similarity: number;
    timestamp: number;
  }): string {
    try {
      const timeAgo = this.getTimeAgo(memory.timestamp);
      const contentPreview = this.extractContentPreview(memory.content);
      
      return `${contentPreview} (${timeAgo}, ${Math.round(memory.similarity * 100)}% relevant)`;

    } catch (error) {
      console.error('Memory preview generation failed:', error);
      return 'Related information';
    }
  }

  private extractContentPreview(content: any): string {
    if (typeof content === 'string') {
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    
    if (typeof content === 'object') {
      if (content.title) return content.title;
      if (content.text) return content.text.length > 50 ? content.text.substring(0, 50) + '...' : content.text;
      if (content.summary) return content.summary.length > 50 ? content.summary.substring(0, 50) + '...' : content.summary;
    }

    return 'Information';
  }

  private describePattern(pattern: {
    pattern: string;
    confidence: number;
    frequency: number;
  }): string {
    try {
      if (pattern.pattern.startsWith('peak_activity_')) {
        const hours = pattern.pattern.replace('peak_activity_', '').split('_').map(h => parseInt(h));
        const timeStr = hours.map(h => `${h}:00`).join(' and ');
        return `You're most active around ${timeStr} (${Math.round(pattern.confidence * 100)}% confidence)`;
      }

      if (pattern.pattern.startsWith('content_type_')) {
        const type = pattern.pattern.replace('content_type_', '');
        return `You frequently work with ${type} content (${Math.round(pattern.confidence * 100)}% confidence)`;
      }

      return `Pattern detected: ${pattern.pattern} (${Math.round(pattern.confidence * 100)}% confidence)`;

    } catch (error) {
      console.error('Pattern description failed:', error);
      return 'Activity pattern detected';
    }
  }

  private async addEmotionalIntelligence(
    content: string,
    context: ResponseContext
  ): Promise<{ content: string; tone: string }> {
    try {
      let enhancedContent = content;
      let tone = 'neutral';

      const emotion = context.emotionalContext.detectedEmotion;
      const confidence = context.emotionalContext.confidence;

      if (confidence > 0.6) {
        switch (emotion) {
          case 'positive':
          case 'happy':
            enhancedContent = this.addPositiveTone(content);
            tone = 'positive';
            break;
          case 'negative':
          case 'sad':
          case 'angry':
            enhancedContent = this.addSupportiveTone(content);
            tone = 'supportive';
            break;
          case 'fearful':
            enhancedContent = this.addReassuringTone(content);
            tone = 'reassuring';
            break;
          case 'surprised':
            enhancedContent = this.addInformativeTone(content);
            tone = 'informative';
            break;
        }
      }

      return {
        content: enhancedContent,
        tone
      };

    } catch (error) {
      console.error('Emotional intelligence addition failed:', error);
      return { content, tone: 'neutral' };
    }
  }

  private addPositiveTone(content: string): string {
    const positivePhrases = [
      "Great question!",
      "I'm happy to help with that!",
      "That's an interesting topic!",
      "I appreciate you asking about this!"
    ];

    const phrase = positivePhrases[Math.floor(Math.random() * positivePhrases.length)];
    return `${phrase} ${content}`;
  }

  private addSupportiveTone(content: string): string {
    const supportivePhrases = [
      "I understand this might be challenging.",
      "Let me help you work through this.",
      "I'm here to support you with this.",
      "We can figure this out together."
    ];

    const phrase = supportivePhrases[Math.floor(Math.random() * supportivePhrases.length)];
    return `${phrase} ${content}`;
  }

  private addReassuringTone(content: string): string {
    const reassuringPhrases = [
      "Don't worry, I can help with this.",
      "Let me make this easier for you.",
      "I'm here to help clarify things.",
      "We can handle this step by step."
    ];

    const phrase = reassuringPhrases[Math.floor(Math.random() * reassuringPhrases.length)];
    return `${phrase} ${content}`;
  }

  private addInformativeTone(content: string): string {
    const informativePhrases = [
      "Here's what you need to know:",
      "Let me provide you with the information:",
      "I can help clarify this for you:",
      "Here's the explanation:"
    ];

    const phrase = informativePhrases[Math.floor(Math.random() * informativePhrases.length)];
    return `${phrase} ${content}`;
  }

  private async generateReasoning(context: ResponseContext): Promise<string> {
    try {
      let reasoning = "I arrived at this response by considering:\n";

      // Add intent reasoning
      reasoning += `• Your query intent was identified as "${context.nlpResult.intent}" with ${Math.round(context.nlpResult.confidence * 100)}% confidence\n`;

      // Add context reasoning
      if (context.memoryContext.relevantMemories.length > 0) {
        reasoning += `• Found ${context.memoryContext.relevantMemories.length} relevant memories from your past activities\n`;
      }

      // Add pattern reasoning
      if (context.memoryContext.patterns.length > 0) {
        reasoning += `• Identified ${context.memoryContext.patterns.length} activity patterns that inform this response\n`;
      }

      // Add emotional reasoning
      if (context.emotionalContext.confidence > 0.6) {
        reasoning += `• Detected ${context.emotionalContext.detectedEmotion} emotional state and adjusted response tone accordingly\n`;
      }

      // Add situational reasoning
      reasoning += `• Considered current context: ${context.situationalContext.timeOfDay} on ${context.situationalContext.dayOfWeek}\n`;

      return reasoning;

    } catch (error) {
      console.error('Reasoning generation failed:', error);
      return "Response generated based on your query and available context.";
    }
  }

  private async generateSources(context: ResponseContext): Promise<Array<{
    type: 'memory' | 'knowledge' | 'pattern' | 'prediction';
    id: string;
    relevance: number;
    description: string;
  }>> {
    const sources: Array<{
      type: 'memory' | 'knowledge' | 'pattern' | 'prediction';
      id: string;
      relevance: number;
      description: string;
    }> = [];

    try {
      // Add memory sources
      for (const memory of context.memoryContext.relevantMemories.slice(0, 3)) {
        sources.push({
          type: 'memory',
          id: memory.id,
          relevance: memory.similarity,
          description: this.generateMemoryPreview(memory)
        });
      }

      // Add pattern sources
      for (const pattern of context.memoryContext.patterns.slice(0, 2)) {
        sources.push({
          type: 'pattern',
          id: `pattern_${pattern.pattern}`,
          relevance: pattern.confidence,
          description: this.describePattern(pattern)
        });
      }

      // Add knowledge sources if available
      if (context.nlpResult.topics.length > 0) {
        sources.push({
          type: 'knowledge',
          id: 'topic_analysis',
          relevance: 0.8,
          description: `Topic analysis: ${context.nlpResult.topics.join(', ')}`
        });
      }

      return sources;

    } catch (error) {
      console.error('Source generation failed:', error);
      return [];
    }
  }

  private calculateResponseConfidence(context: ResponseContext, content: string): number {
    let confidence = 0.5;

    // Base confidence from NLP
    confidence += context.nlpResult.confidence * 0.3;

    // Boost from memory relevance
    if (context.memoryContext.relevantMemories.length > 0) {
      const avgMemoryRelevance = context.memoryContext.relevantMemories
        .reduce((sum, memory) => sum + memory.similarity, 0) / context.memoryContext.relevantMemories.length;
      confidence += avgMemoryRelevance * 0.2;
    }

    // Boost from pattern confidence
    if (context.memoryContext.patterns.length > 0) {
      const avgPatternConfidence = context.memoryContext.patterns
        .reduce((sum, pattern) => sum + pattern.confidence, 0) / context.memoryContext.patterns.length;
      confidence += avgPatternConfidence * 0.2;
    }

    // Boost from emotional context
    if (context.emotionalContext.confidence > 0.6) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  private calculateResponseRelevance(context: ResponseContext, content: string): number {
    let relevance = 0.5;

    // Content relevance based on query matching
    const queryWords = context.userQuery.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    const commonWords = queryWords.filter(word => contentWords.includes(word));
    const wordRelevance = commonWords.length / Math.max(queryWords.length, contentWords.length);
    
    relevance += wordRelevance * 0.4;

    // Intent relevance
    const intentRelevance = context.nlpResult.confidence;
    relevance += intentRelevance * 0.3;

    // Contextual relevance
    if (context.memoryContext.relevantMemories.length > 0) {
      relevance += 0.2;
    }

    return Math.min(1.0, relevance);
  }

  private async generateSuggestions(
    response: ContextualResponse,
    context: ResponseContext
  ): Promise<Array<{
    type: 'action' | 'information' | 'follow_up';
    content: string;
    priority: number;
  }>> {
    const suggestions: Array<{
      type: 'action' | 'information' | 'follow_up';
      content: string;
      priority: number;
    }> = [];

    try {
      // Generate action suggestions based on intent
      const actionSuggestions = this.generateActionSuggestions(context);
      suggestions.push(...actionSuggestions);

      // Generate information suggestions
      const infoSuggestions = this.generateInformationSuggestions(context);
      suggestions.push(...infoSuggestions);

      // Generate follow-up suggestions
      const followUpSuggestions = this.generateFollowUpSuggestions(context);
      suggestions.push(...followUpSuggestions);

      // Sort by priority and return top suggestions
      return suggestions
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5);

    } catch (error) {
      console.error('Suggestion generation failed:', error);
      return [];
    }
  }

  private generateActionSuggestions(context: ResponseContext): Array<{
    type: 'action';
    content: string;
    priority: number;
  }> {
    const suggestions: Array<{
      type: 'action';
      content: string;
      priority: number;
    }> = [];

    const intent = context.nlpResult.intent;

    switch (intent) {
      case 'search':
        suggestions.push({
          type: 'action',
          content: 'Refine your search with specific keywords',
          priority: 0.8
        });
        suggestions.push({
          type: 'action',
          content: 'Search within a specific time range',
          priority: 0.6
        });
        break;

      case 'capture':
        suggestions.push({
          type: 'action',
          content: 'Add tags to organize this information',
          priority: 0.9
        });
        suggestions.push({
          type: 'action',
          content: 'Set a reminder to review this later',
          priority: 0.7
        });
        break;

      case 'organize':
        suggestions.push({
          type: 'action',
          content: 'Create a new category or project',
          priority: 0.8
        });
        suggestions.push({
          type: 'action',
          content: 'Bulk organize similar items',
          priority: 0.6
        });
        break;
    }

    return suggestions;
  }

  private generateInformationSuggestions(context: ResponseContext): Array<{
    type: 'information';
    content: string;
    priority: number;
  }> {
    const suggestions: Array<{
      type: 'information';
      content: string;
      priority: number;
    }> = [];

    // Suggest related topics
    if (context.nlpResult.topics.length > 0) {
      suggestions.push({
        type: 'information',
        content: `Learn more about ${context.nlpResult.topics[0]}`,
        priority: 0.7
      });
    }

    // Suggest pattern exploration
    if (context.memoryContext.patterns.length > 0) {
      suggestions.push({
        type: 'information',
        content: 'Explore your activity patterns in more detail',
        priority: 0.6
      });
    }

    return suggestions;
  }

  private generateFollowUpSuggestions(context: ResponseContext): Array<{
    type: 'follow_up';
    content: string;
    priority: number;
  }> {
    const suggestions: Array<{
      type: 'follow_up';
      content: string;
      priority: number;
    }> = [];

    // Time-based follow-up suggestions
    const hour = new Date().getHours();
    
    if (hour >= 17) {
      suggestions.push({
        type: 'follow_up',
        content: 'Plan your activities for tomorrow',
        priority: 0.8
      });
    }

    if (hour >= 9 && hour <= 17) {
      suggestions.push({
        type: 'follow_up',
        content: 'Review your productivity this morning',
        priority: 0.6
      });
    }

    // Activity-based follow-up
    if (context.conversationContext.history.length > 5) {
      suggestions.push({
        type: 'follow_up',
        content: 'Review our recent conversation history',
        priority: 0.5
      });
    }

    return suggestions;
  }

  private async enhanceResponse(
    response: {
      content: string;
      confidence: number;
      relevance: number;
      personalization: number;
      emotionalTone: string;
      reasoning: string;
      sources: Array<{
        type: 'memory' | 'knowledge' | 'pattern' | 'prediction';
        id: string;
        relevance: number;
        description: string;
      }>;
    },
    context: ResponseContext
  ): Promise<{
    content: string;
    confidence: number;
    relevance: number;
    personalization: number;
    emotionalTone: string;
    reasoning: string;
    sources: Array<{
      type: 'memory' | 'knowledge' | 'pattern' | 'prediction';
      id: string;
      relevance: number;
      description: string;
    }>;
  }> {
    // Apply length limits
    let content = response.content;
    if (content.length > this.config.maxResponseLength) {
      content = content.substring(0, this.config.maxResponseLength - 3) + '...';
    }

    // Apply creativity level
    if (this.config.creativityLevel > 0.5) {
      content = this.addCreativeElements(content, context);
    }

    // Apply formality level
    if (this.config.formalityLevel > 0.5) {
      content = this.addFormalElements(content);
    }

    return {
      ...response,
      content
    };
  }

  private addCreativeElements(content: string, context: ResponseContext): string {
    // Add creative metaphors, analogies, or examples
    const creativeElements = [
      "\n\nThink of this like organizing a digital garden - each piece of information is a seed that can grow into something useful.",
      "\n\nImagine your digital life as a library where I'm helping you catalog and find exactly what you need.",
      "\n\nConsider this as building your personal knowledge ecosystem - everything connected and working together."
    ];

    if (Math.random() < this.config.creativityLevel && content.length < this.config.maxResponseLength * 0.8) {
      const element = creativeElements[Math.floor(Math.random() * creativeElements.length)];
      return content + element;
    }

    return content;
  }

  private addFormalElements(content: string): string {
    // Add formal structure and references
    if (!content.includes('\n\n')) {
      content += '\n\n';
    }
    
    content += "This response is generated based on your current context and available information.";

    return content;
  }

  private async learnFromInteraction(
    response: ContextualResponse,
    context: ResponseContext
  ): Promise<void> {
    try {
      // Update user profile based on interaction
      const sessionId = context.conversationContext.sessionId;
      let userProfile = this.userProfiles.get(sessionId);

      if (!userProfile) {
        userProfile = {
          preferences: {
            communicationStyle: 'neutral',
            topicsOfInterest: [],
            interactionHistory: []
          },
          behaviorPatterns: {
            responseTime: 0,
            queryComplexity: 0,
            preferredInteractionTimes: []
          }
        };
        this.userProfiles.set(sessionId, userProfile);
      }

      // Update interaction history
      userProfile.preferences.interactionHistory.push({
        timestamp: Date.now(),
        type: 'query',
        satisfaction: response.confidence * response.relevance // Simple satisfaction metric
      });

      // Keep only recent history
      if (userProfile.preferences.interactionHistory.length > 100) {
        userProfile.preferences.interactionHistory = userProfile.preferences.interactionHistory.slice(-50);
      }

      // Update topics of interest
      const topics = context.nlpResult.topics;
      for (const topic of topics) {
        if (!userProfile.preferences.topicsOfInterest.includes(topic)) {
          userProfile.preferences.topicsOfInterest.push(topic);
        }
      }

      // Keep only relevant topics
      if (userProfile.preferences.topicsOfInterest.length > 20) {
        userProfile.preferences.topicsOfInterest = userProfile.preferences.topicsOfInterest.slice(-10);
      }

      // Update behavior patterns
      userProfile.behaviorPatterns.responseTime = response.metadata.processingTime;
      userProfile.behaviorPatterns.queryComplexity = context.userQuery.length / 100; // Normalized

      const currentHour = new Date().getHours();
      userProfile.behaviorPatterns.preferredInteractionTimes.push(currentHour);

      // Keep only recent times
      if (userProfile.behaviorPatterns.preferredInteractionTimes.length > 100) {
        userProfile.behaviorPatterns.preferredInteractionTimes = 
          userProfile.behaviorPatterns.preferredInteractionTimes.slice(-50);
      }

    } catch (error) {
      console.error('Interaction learning failed:', error);
    }
  }

  private updateMetrics(response: ContextualResponse): void {
    this.metrics.totalResponses++;
    this.metrics.averageConfidence = this.updateAverage(
      this.metrics.averageConfidence,
      response.confidence,
      this.metrics.totalResponses
    );
    this.metrics.averageRelevance = this.updateAverage(
      this.metrics.averageRelevance,
      response.relevance,
      this.metrics.totalResponses
    );
    this.metrics.averageProcessingTime = this.updateAverage(
      this.metrics.averageProcessingTime,
      response.metadata.processingTime,
      this.metrics.totalResponses
    );

    if (response.metadata.personalized) {
      this.metrics.personalizationHits++;
    }

    if (response.metadata.contextUsed) {
      this.metrics.contextUsage++;
    }

    if (response.metadata.memoryUsed) {
      this.metrics.memoryUsage++;
    }

    if (response.metadata.adaptiveStyle) {
      this.metrics.adaptiveResponses++;
    }
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  private createDefaultConversationContext(sessionId: string): ConversationContext {
    return {
      sessionId,
      history: [],
      currentTopic: '',
      userPreferences: {
        responseStyle: 'friendly',
        language: 'en',
        topicsOfInterest: []
      },
      contextWindow: {
        maxTokens: 10000,
        currentTokens: 0,
        pruneThreshold: 0.8
      }
    };
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private getDayOfWeek(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  }

  private detectUserActivity(context: ConversationContext): string {
    // Simple activity detection based on conversation history
    if (context.history.length === 0) return 'starting_conversation';
    
    const recentIntents = context.history
      .slice(-3)
      .map(h => h.intent)
      .filter(Boolean);

    if (recentIntents.includes('search')) return 'researching';
    if (recentIntents.includes('capture')) return 'collecting';
    if (recentIntents.includes('organize')) return 'organizing';
    if (recentIntents.includes('analyze')) return 'analyzing';
    
    return 'general_interaction';
  }

  private detectDeviceContext(): string {
    // Simple device detection
    if (typeof navigator !== 'undefined') {
      if (navigator.userAgent.includes('Mobile')) return 'mobile';
      if (navigator.userAgent.includes('Tablet')) return 'tablet';
    }
    return 'desktop';
  }

  private getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  private getFallbackResponse(userQuery: string): ContextualResponse {
    return {
      content: "I apologize, but I'm having trouble generating a response right now. Could you please rephrase your question or try again later?",
      confidence: 0.3,
      relevance: 0.3,
      personalization: 0,
      emotionalTone: 'neutral',
      reasoning: 'Fallback response due to processing error',
      sources: [],
      suggestions: [
        {
          type: 'follow_up',
          content: 'Try rephrasing your question',
          priority: 0.8
        }
      ],
      metadata: {
        processingTime: 0,
        contextUsed: false,
        memoryUsed: false,
        personalized: false,
        adaptiveStyle: false
      }
    };
  }

  private getFallbackResponseContent(context: ResponseContext): {
    content: string;
    confidence: number;
    relevance: number;
    personalization: number;
    emotionalTone: string;
    reasoning: string;
    sources: Array<{
      type: 'memory' | 'knowledge' | 'pattern' | 'prediction';
      id: string;
      relevance: number;
      description: string;
    }>;
  } {
    return {
      content: "I'm sorry, but I'm having trouble generating a response right now. Could you please try again?",
      confidence: 0.3,
      relevance: 0.3,
      personalization: 0,
      emotionalTone: 'neutral',
      reasoning: 'Error in response generation',
      sources: []
    };
  }

  private initializeResponseTemplates(): void {
    // Initialize response templates for different intents
    this.responseTemplates.set('help', [
      {
        template: "I can help you with that! What specific area would you like assistance with?",
        conditions: [],
        weight: 0.9
      },
      {
        template: "I'd be happy to help. Let me know what you need assistance with.",
        conditions: [],
        weight: 0.8
      }
    ]);

    this.responseTemplates.set('search', [
      {
        template: "I'll search through your information to find what you're looking for.",
        conditions: [],
        weight: 0.9
      }
    ]);

    this.responseTemplates.set('capture', [
      {
        template: "Got it! I've captured that information for you.",
        conditions: [],
        weight: 0.9
      }
    ]);

    // Add more templates as needed
  }

  // Public API methods
  isHealthy(): boolean {
    return this.isInitialized && this.metrics.errors / Math.max(this.metrics.totalResponses, 1) < 0.05;
  }

  getMetrics() {
    return { 
      ...this.metrics,
      templateCount: this.responseTemplates.size,
      userProfileCount: this.userProfiles.size,
      averagePersonalization: this.metrics.personalizationHits / Math.max(this.metrics.totalResponses, 1),
      contextUsageRate: this.metrics.contextUsage / Math.max(this.metrics.totalResponses, 1),
      memoryUsageRate: this.metrics.memoryUsage / Math.max(this.metrics.totalResponses, 1)
    };
  }

  async updateConfig(newConfig: Partial<ResponseGenerationConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }

  async cleanup(): Promise<void> {
    // Clear user profiles
    this.userProfiles.clear();

    // Clear response templates
    this.responseTemplates.clear();

    // Dispose ML models
    if (this.responseModel) {
      this.responseModel.dispose();
      this.responseModel = null;
    }

    if (this.personalizationModel) {
      this.personalizationModel.dispose();
      this.personalizationModel = null;
    }

    if (this.emotionModel) {
      this.emotionModel.dispose();
      this.emotionModel = null;
    }

    this.isInitialized = false;
    console.log('[ContextAwareResponseGenerator] Cleanup completed');
  }
}