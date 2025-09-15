import nlp from 'compromise';
import { MemoryGraph } from '@/memory/graph';

export interface NLPConfig {
  enabled: boolean;
  confidenceThreshold: number;
  maxContextLength: number;
  language: string;
  responseStyle: 'concise' | 'detailed' | 'friendly' | 'professional';
}

export interface NLPResult {
  text: string;
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  sentiment: {
    score: number;
    magnitude: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  keywords: string[];
  topics: string[];
  language: string;
  processedAt: number;
}

export interface IntentDefinition {
  name: string;
  patterns: string[];
  responses: string[];
  entities: string[];
  priority: number;
  confidence: number;
}

export class NaturalLanguageProcessor {
  private config: NLPConfig;
  private isInitialized = false;
  private isRunning = false;

  // Intent definitions
  private intents: Map<string, IntentDefinition> = new Map();
  private entityPatterns: Map<string, RegExp> = new Map();
  private responseTemplates: Map<string, string[]> = new Map();

  // Performance metrics
  private metrics = {
    totalProcessed: 0,
    averageConfidence: 0,
    averageProcessingTime: 0,
    cacheHits: 0,
    errors: 0
  };

  // Cache for frequent queries
  private queryCache: Map<string, NLPResult> = new Map();

  constructor(config: NLPConfig) {
    this.config = config;
    this.initializeIntents();
    this.initializeEntityPatterns();
    this.initializeResponseTemplates();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[NaturalLanguageProcessor] Initializing...');

      // Initialize compromise with plugins
      const compromise = nlp;
      
      // Add custom extensions if needed
      this.setupCustomExtensions(compromise);

      this.isInitialized = true;
      console.log('[NaturalLanguageProcessor] Initialized successfully');

    } catch (error) {
      console.error('[NaturalLanguageProcessor] Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[NaturalLanguageProcessor] Starting...');
      this.isRunning = true;
      console.log('[NaturalLanguageProcessor] Started successfully');

    } catch (error) {
      console.error('[NaturalLanguageProcessor] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[NaturalLanguageProcessor] Stopping...');
      this.isRunning = false;
      console.log('[NaturalLanguageProcessor] Stopped successfully');

    } catch (error) {
      console.error('[NaturalLanguageProcessor] Stop failed:', error);
    }
  }

  async process(text: string, context?: any): Promise<NLPResult> {
    if (!this.isInitialized) {
      throw new Error('NLP processor not initialized');
    }

    const startTime = performance.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(text, context);
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.processedAt < 300000) {
        this.metrics.cacheHits++;
        return cached;
      }

      // Preprocess text
      const processedText = this.preprocessText(text);

      // Process with compromise
      const doc = nlp(processedText);

      // Extract basic information
      const entities = this.extractEntities(doc, processedText);
      const sentiment = this.analyzeSentiment(doc, processedText);
      const keywords = this.extractKeywords(doc, processedText);
      const topics = this.extractTopics(doc, processedText);
      const language = this.detectLanguage(doc, processedText);

      // Determine intent
      const intent = this.determineIntent(processedText, entities, context);
      const confidence = this.calculateConfidence(intent, entities, processedText);

      const result: NLPResult = {
        text: processedText,
        intent: intent.name,
        entities,
        confidence,
        sentiment,
        keywords,
        topics,
        language,
        processedAt: Date.now()
      };

      // Cache result
      this.queryCache.set(cacheKey, result);

      // Update metrics
      this.updateMetrics(result, performance.now() - startTime);

      return result;

    } catch (error) {
      console.error('[NaturalLanguageProcessor] Error processing text:', error);
      this.metrics.errors++;

      return {
        text,
        intent: 'unknown',
        entities: {},
        confidence: 0,
        sentiment: { score: 0, magnitude: 0, label: 'neutral' },
        keywords: [],
        topics: [],
        language: this.config.language,
        processedAt: Date.now()
      };
    }
  }

  async generateResponse(
    intent: string,
    entities: Record<string, any>,
    context: any,
    contextualInfo: any[],
    responseStyle: string = this.config.responseStyle
  ): Promise<string> {
    try {
      // Get intent definition
      const intentDef = this.intents.get(intent);
      if (!intentDef) {
        return this.generateFallbackResponse(intent, entities);
      }

      // Select response template
      const templates = this.responseTemplates.get(intent) || intentDef.responses;
      if (!templates || templates.length === 0) {
        return this.generateFallbackResponse(intent, entities);
      }

      // Select template based on response style
      let template = templates[Math.floor(Math.random() * templates.length)];
      
      // Customize template with entities and context
      template = this.customizeResponse(template, entities, context, contextualInfo);

      // Adjust based on response style
      template = this.adjustResponseStyle(template, responseStyle);

      return template;

    } catch (error) {
      console.error('[NaturalLanguageProcessor] Error generating response:', error);
      return this.generateFallbackResponse(intent, entities);
    }
  }

  private initializeIntents(): void {
    // Common productivity intents
    this.intents.set('help', {
      name: 'help',
      patterns: [
        'help', 'what can you do', 'how do I', 'show me', 'assist me',
        'I need help', 'can you help', 'support', 'guide'
      ],
      responses: [
        "I'm here to help! I can assist with productivity, information management, and workflow optimization.",
        "I'm your personal assistant. I can help you organize information, capture thoughts, and optimize your workflow.",
        "I'm here to support your productivity journey. What would you like help with today?"
      ],
      entities: ['topic', 'action'],
      priority: 1,
      confidence: 0.9
    });

    this.intents.set('capture', {
      name: 'capture',
      patterns: [
        'capture this', 'remember this', 'save this', 'note this',
        'take note', 'bookmark', 'quick capture', 'store this'
      ],
      responses: [
        "I've captured that for you! Would you like me to organize it with tags or add it to a project?",
        "Got it! I've saved that to your memory. I can help you find it later or connect it to related items.",
        "Captured! I've stored that information and will make it searchable and accessible."
      ],
      entities: ['content', 'category', 'importance'],
      priority: 10,
      confidence: 0.95
    });

    this.intents.set('search', {
      name: 'search',
      patterns: [
        'search for', 'find', 'look for', 'show me', 'where is',
        'locate', 'retrieve', 'get me', 'I need'
      ],
      responses: [
        "I'll search through your captured information and memories to find what you're looking for.",
        "Searching your knowledge base... I'll find the most relevant information for you.",
        "Let me find that for you. I'm searching through your organized memories and captures."
      ],
      entities: ['query', 'timeframe', 'category'],
      priority: 8,
      confidence: 0.85
    });

    this.intents.set('organize', {
      name: 'organize',
      patterns: [
        'organize', 'categorize', 'sort', 'group', 'tag', 'classify',
        'arrange', 'structure', 'systematize'
      ],
      responses: [
        "I'll help you organize that information. Would you like me to suggest categories or create a new system?",
        "Organization is key! I can help you create tags, categories, and workflows to keep everything tidy.",
        "Let me help you create order. I can suggest organization patterns and automated systems."
      ],
      entities: ['items', 'method', 'criteria'],
      priority: 7,
      confidence: 0.8
    });

    this.intents.set('schedule', {
      name: 'schedule',
      patterns: [
        'schedule', 'remind me', 'set reminder', 'add to calendar',
        'appointment', 'meeting', 'deadline', 'when should I'
      ],
      responses: [
        "I can help you schedule that! Let me find the best time and set up reminders.",
        "Scheduling made easy! I'll find optimal timing and set up automated reminders.",
        "Let me help you manage your time. I'll suggest the best schedule and set reminders."
      ],
      entities: ['event', 'time', 'date', 'duration'],
      priority: 9,
      confidence: 0.9
    });

    this.intents.set('analyze', {
      name: 'analyze',
      patterns: [
        'analyze', 'summarize', 'review', 'report', 'insights',
        'statistics', 'trends', 'patterns', 'performance'
      ],
      responses: [
        "I'll analyze that information and provide you with valuable insights and patterns.",
        "Analysis complete! Here are the key insights and trends I've discovered.",
        "Let me break this down for you. Here's what the data reveals and what actions you might take."
      ],
      entities: ['data', 'type', 'timeframe'],
      priority: 6,
      confidence: 0.85
    });

    this.intents.set('automate', {
      name: 'automate',
      patterns: [
        'automate', 'workflow', 'automation', 'routine', 'system',
        'trigger', 'action', 'process', 'streamline'
      ],
      responses: [
        "I can help you automate that! Let me design a workflow that saves you time and effort.",
        "Automation is powerful! I'll create a system that handles this automatically for you.",
        "Let me streamline this process. I can set up triggers and actions to make it effortless."
      ],
      entities: ['process', 'trigger', 'action'],
      priority: 8,
      confidence: 0.9
    });

    this.intents.set('learn', {
      name: 'learn',
      patterns: [
        'learn', 'teach me', 'how to', 'explain', 'educate',
        'understand', 'tutorial', 'guide', 'help me understand'
      ],
      responses: [
        "I'd be happy to help you learn! Let me break this down into clear, understandable steps.",
        "Learning is exciting! I'll explain this concept in a way that makes sense to you.",
        "Great question! Let me help you understand this topic with clear explanations and examples."
      ],
      entities: ['topic', 'level', 'format'],
      priority: 7,
      confidence: 0.85
    });

    // Add more intents as needed
  }

  private initializeEntityPatterns(): void {
    // Common entity patterns
    this.entityPatterns.set('email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi);
    this.entityPatterns.set('url', /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi);
    this.entityPatterns.set('phone', /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
    this.entityPatterns.set('date', /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi);
    this.entityPatterns.set('time', /\b\d{1,2}:\d{2}(?:\s*[AP]M)?\b/gi);
    this.entityPatterns.set('number', /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g);
    this.entityPatterns.set('money', /\$\d+(?:,\d{3})*(?:\.\d{2})?/g);
  }

  private initializeResponseTemplates(): void {
    // Initialize response templates for each intent
    this.intents.forEach((intentDef, intentName) => {
      this.responseTemplates.set(intentName, intentDef.responses);
    });

    // Add additional response variations
    this.responseTemplates.set('help', [
      "I'm here to assist you with productivity, organization, and workflow optimization. What would you like help with?",
      "As your personal assistant, I can help you capture information, search your memories, and automate tasks.",
      "I'm designed to help you be more productive and organized. How can I assist you today?",
      "I can help with information management, workflow automation, and personal productivity. What's on your mind?"
    ]);

    this.responseTemplates.set('capture', [
      "Perfect! I've captured that information for you. Would you like me to organize it or connect it to related items?",
      "Got it! I've saved that to your personal knowledge base. It's now searchable and accessible.",
      "Excellent! I've captured that and will make sure it's properly organized and easy to find later.",
      "Captured successfully! I've stored that information and can help you connect it to your other notes and tasks."
    ]);
  }

  private setupCustomExtensions(compromise: any): void {
    // Add custom compromise extensions for domain-specific processing
    // This is a placeholder for custom NLP extensions
  }

  private preprocessText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\.\,\!\?\;\:\-\'\"\(\)]/g, '')
      .toLowerCase();
  }

  private extractEntities(doc: any, text: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract entities using compromise
    const people = doc.people().out('array');
    const places = doc.places().out('array');
    const organizations = doc.organizations().out('array');
    const dates = doc.dates().out('array');
    const money = doc.money().out('array');
    const numbers = doc.numbers().out('array');

    if (people.length > 0) entities.people = people;
    if (places.length > 0) entities.places = places;
    if (organizations.length > 0) entities.organizations = organizations;
    if (dates.length > 0) entities.dates = dates;
    if (money.length > 0) entities.money = money;
    if (numbers.length > 0) entities.numbers = numbers;

    // Extract custom entities using regex patterns
    this.entityPatterns.forEach((pattern, type) => {
      const matches = text.match(pattern);
      if (matches) {
        entities[type] = matches;
      }
    });

    return entities;
  }

  private analyzeSentiment(doc: any, text: string): NLPResult['sentiment'] {
    // Simple sentiment analysis using compromise
    const positive = doc.has('#Positive');
    const negative = doc.has('#Negative');
    
    let score = 0;
    let magnitude = 0;
    let label: 'positive' | 'negative' | 'neutral' = 'neutral';

    // Basic sentiment scoring
    if (positive && !negative) {
      score = 0.7;
      magnitude = 0.8;
      label = 'positive';
    } else if (negative && !positive) {
      score = -0.7;
      magnitude = 0.8;
      label = 'negative';
    } else if (positive && negative) {
      score = 0;
      magnitude = 1.0;
      label = 'neutral';
    }

    return { score, magnitude, label };
  }

  private extractKeywords(doc: any, text: string): string[] {
    // Extract keywords using compromise's term frequency
    const terms = doc.terms().out('frequency');
    return terms
      .filter((term: any) => term.count > 1 && term.normal.length > 2)
      .map((term: any) => term.normal)
      .slice(0, 10);
  }

  private extractTopics(doc: any, text: string): string[] {
    // Extract topics using compromise's topics
    const topics = doc.topics().out('array');
    return topics.slice(0, 5);
  }

  private detectLanguage(doc: any, text: string): string {
    // Simple language detection - in production, use a proper language detection library
    return this.config.language;
  }

  private determineIntent(text: string, entities: Record<string, any>, context?: any): IntentDefinition {
    let bestMatch: IntentDefinition | null = null;
    let highestScore = 0;

    // Score each intent based on pattern matching
    this.intents.forEach((intentDef) => {
      let score = 0;
      
      // Check pattern matches
      intentDef.patterns.forEach(pattern => {
        if (text.toLowerCase().includes(pattern.toLowerCase())) {
          score += intentDef.confidence;
        }
      });

      // Check entity matches
      intentDef.entities.forEach(entity => {
        if (entities[entity]) {
          score += 0.3;
        }
      });

      // Apply priority weighting
      score *= (1 + intentDef.priority * 0.1);

      if (score > highestScore) {
        highestScore = score;
        bestMatch = intentDef;
      }
    });

    // Return best match or unknown intent
    return bestMatch || {
      name: 'unknown',
      patterns: [],
      responses: [],
      entities: [],
      priority: 0,
      confidence: 0.1
    };
  }

  private calculateConfidence(intent: IntentDefinition, entities: Record<string, any>, text: string): number {
    let confidence = intent.confidence;

    // Boost confidence based on entity matches
    const entityMatches = intent.entities.filter(entity => entities[entity]).length;
    confidence += entityMatches * 0.1;

    // Boost confidence based on text length (longer texts are more specific)
    if (text.length > 10) confidence += 0.1;
    if (text.length > 20) confidence += 0.1;

    // Cap confidence at 1.0
    return Math.min(confidence, 1.0);
  }

  private customizeResponse(
    template: string,
    entities: Record<string, any>,
    context: any,
    contextualInfo: any[]
  ): string {
    let customized = template;

    // Replace entity placeholders
    Object.entries(entities).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        customized = customized.replace(new RegExp(`\\{${key}\\}`, 'gi'), value[0]);
      }
    });

    // Add contextual information if available
    if (contextualInfo && contextualInfo.length > 0) {
      customized += `\n\nHere's some relevant information I found: ${contextualInfo[0].title}`;
    }

    return customized;
  }

  private adjustResponseStyle(response: string, style: string): string {
    switch (style) {
      case 'concise':
        return response
          .replace(/I'll /g, '')
          .replace(/I am /g, '')
          .replace(/that for you/g, '')
          .replace(/for you/g, '')
          .trim();

      case 'detailed':
        return response + '\n\nLet me know if you'd like more details or have any other questions!';

      case 'friendly':
        return response.replace(/\./g, '! 😊');

      case 'professional':
        return response.replace(/!/g, '.').replace(/😊/g, '');

      default:
        return response;
    }
  }

  private generateFallbackResponse(intent: string, entities: Record<string, any>): string {
    const fallbacks = [
      "I'm still learning how to help with that. Could you rephrase your request?",
      "I'm not sure I understand. Could you provide more details or try asking differently?",
      "I want to help, but I need more information. Could you clarify what you're looking for?",
      "I'm still developing my capabilities in that area. Is there another way I can assist you?",
      "I apologize, but I'm not equipped to handle that request yet. Let me help you with something else."
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  private generateCacheKey(text: string, context?: any): string {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${text}:${contextStr}`.slice(0, 100);
  }

  private updateMetrics(result: NLPResult, processingTime: number): void {
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
    return this.isRunning && this.metrics.errors / this.metrics.totalProcessed < 0.05;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  async updateConfig(newConfig: Partial<NLPConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.queryCache.clear();
    this.isInitialized = false;
  }
}