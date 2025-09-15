import { 
  BaseEvent, 
  EventType, 
  EventSource 
} from '@/types';
import { 
  EnhancedEvent, 
  EventQuality, 
  ProcessingMetadata,
  BrowserTabEvent,
  SystemAppEvent,
  EmailEvent,
  CodeEvent,
  GitHubEvent,
  YouTubeEvent,
  SlackEvent,
  VSCodeEvent,
  CustomEvent,
  isBrowserTabEvent,
  isSystemAppEvent,
  isEmailEvent,
  isCodeEvent,
  isGitHubEvent,
  isYouTubeEvent,
  isSlackEvent,
  isVSCodeEvent,
  isCustomEvent
} from '@/types/events';

export interface NormalizationConfig {
  enabled: boolean;
  validationLevel: 'strict' | 'lenient' | 'disabled';
  enrichmentEnabled: boolean;
  privacyProtection: boolean;
  maxContentLength: number;
  piiDetection: boolean;
  entityExtraction: boolean;
  sentimentAnalysis: boolean;
  keywordExtraction: boolean;
  topicModeling: boolean;
  qualityScoring: boolean;
}

export interface NormalizationMetrics {
  eventsProcessed: number;
  eventsValidated: number;
  eventsEnriched: number;
  validationErrors: number;
  averageProcessingTime: number;
  averageQualityScore: number;
  piiDetected: number;
  entitiesExtracted: number;
  sentimentProcessed: number;
}

export interface ValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  errorMessage: string;
}

export interface EnrichmentData {
  entities: Entity[];
  sentiment: SentimentResult;
  topics: Topic[];
  keywords: Keyword[];
  summary: string;
  category: string;
  urgency: number;
  language?: string;
}

export interface Entity {
  text: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'DATE' | 'MONEY' | 'EMAIL' | 'PHONE' | 'URL' | 'CUSTOM';
  confidence: number;
  start: number;
  end: number;
  metadata?: Record<string, any>;
}

export interface SentimentResult {
  score: number; // -1 to 1
  magnitude: number; // 0 to 1
  classification: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface Topic {
  label: string;
  score: number;
  keywords: string[];
  confidence: number;
}

export interface Keyword {
  text: string;
  score: number;
  relevance: number;
  frequency: number;
}

export class EventNormalizer {
  private config: NormalizationConfig;
  private metrics: NormalizationMetrics;
  private validationRules: Map<EventType, ValidationRule[]> = new Map();
  private enrichmentCache: Map<string, EnrichmentData> = new Map();

  constructor(config: Partial<NormalizationConfig> = {}) {
    this.config = {
      enabled: true,
      validationLevel: 'strict',
      enrichmentEnabled: true,
      privacyProtection: true,
      maxContentLength: 10000,
      piiDetection: true,
      entityExtraction: true,
      sentimentAnalysis: true,
      keywordExtraction: true,
      topicModeling: true,
      qualityScoring: true,
      ...config
    };

    this.metrics = {
      eventsProcessed: 0,
      eventsValidated: 0,
      eventsEnriched: 0,
      validationErrors: 0,
      averageProcessingTime: 0,
      averageQualityScore: 0,
      piiDetected: 0,
      entitiesExtracted: 0,
      sentimentProcessed: 0
    };

    this.initializeValidationRules();
  }

  private initializeValidationRules(): void {
    // Common validation rules for all events
    const commonRules: ValidationRule[] = [
      {
        field: 'id',
        required: true,
        type: 'string',
        pattern: /^[a-zA-Z0-9_-]+$/,
        errorMessage: 'Event ID must be a valid string'
      },
      {
        field: 'timestamp',
        required: true,
        type: 'number',
        custom: (value) => value > 0 && value <= Date.now() + 60000,
        errorMessage: 'Timestamp must be valid and not too far in the future'
      },
      {
        field: 'type',
        required: true,
        type: 'string',
        custom: (value) => Object.values(EventType).includes(value),
        errorMessage: 'Invalid event type'
      },
      {
        field: 'source',
        required: true,
        type: 'string',
        custom: (value) => Object.values(EventSource).includes(value),
        errorMessage: 'Invalid event source'
      }
    ];

    // Add common rules to all event types
    Object.values(EventType).forEach(type => {
      this.validationRules.set(type, [...commonRules]);
    });

    // Add type-specific rules
    this.validationRules.set(EventType.BROWSER_TAB, [
      ...this.validationRules.get(EventType.BROWSER_TAB)!,
      {
        field: 'metadata.url',
        required: false,
        type: 'string',
        custom: (value) => !value || this.isValidUrl(value),
        errorMessage: 'Invalid URL format'
      },
      {
        field: 'metadata.action',
        required: true,
        type: 'string',
        custom: (value) => ['navigation', 'focus', 'close', 'selection', 'analyze', 'connect_workflow', 'quick_capture', 'scroll', 'click', 'form_submit'].includes(value),
        errorMessage: 'Invalid browser action'
      }
    ]);

    // Add more type-specific rules as needed
    this.validationRules.set(EventType.EMAIL, [
      ...this.validationRules.get(EventType.EMAIL)!,
      {
        field: 'metadata.provider',
        required: true,
        type: 'string',
        custom: (value) => ['gmail', 'outlook', 'imap', 'exchange'].includes(value),
        errorMessage: 'Invalid email provider'
      }
    ]);

    this.validationRules.set(EventType.CODE, [
      ...this.validationRules.get(EventType.CODE)!,
      {
        field: 'metadata.language',
        required: true,
        type: 'string',
        errorMessage: 'Language is required for code events'
      }
    ]);
  }

  async normalizeEvent(event: BaseEvent): Promise<EnhancedEvent> {
    if (!this.config.enabled) {
      return event as EnhancedEvent;
    }

    const startTime = performance.now();
    
    try {
      this.metrics.eventsProcessed++;

      // Create enhanced event copy
      const enhancedEvent: EnhancedEvent = {
        ...event,
        priority: event.priority || this.calculatePriority(event),
        processing: {
          processedAt: Date.now(),
          processedBy: 'event-normalizer',
          processingVersion: '1.0.0',
          quality: { confidence: 0, completeness: 0, accuracy: 0, latency: 0 }
        }
      };

      // Validate event
      if (this.config.validationLevel !== 'disabled') {
        await this.validateEvent(enhancedEvent);
        this.metrics.eventsValidated++;
      }

      // Extract and normalize URLs
      this.normalizeUrls(enhancedEvent);

      // Truncate content if needed
      this.truncateContent(enhancedEvent);

      // Add privacy protection
      if (this.config.privacyProtection) {
        this.applyPrivacyProtection(enhancedEvent);
      }

      // Enrich event
      if (this.config.enrichmentEnabled) {
        await this.enrichEvent(enhancedEvent);
        this.metrics.eventsEnriched++;
      }

      // Calculate quality score
      if (this.config.qualityScoring) {
        enhancedEvent.processing!.quality = this.calculateQuality(enhancedEvent);
      }

      // Update metrics
      const processingTime = performance.now() - startTime;
      this.metrics.averageProcessingTime = this.updateAverage(
        this.metrics.averageProcessingTime, 
        processingTime, 
        this.metrics.eventsProcessed
      );

      if (this.config.qualityScoring) {
        this.metrics.averageQualityScore = this.updateAverage(
          this.metrics.averageQualityScore,
          enhancedEvent.processing!.quality.confidence,
          this.metrics.eventsProcessed
        );
      }

      return enhancedEvent;

    } catch (error) {
      console.error('[EventNormalizer] Error normalizing event:', error);
      this.metrics.validationErrors++;
      
      // Return original event with error metadata
      return {
        ...event,
        processing: {
          processedAt: Date.now(),
          processedBy: 'event-normalizer',
          processingVersion: '1.0.0',
          quality: { confidence: 0, completeness: 0, accuracy: 0, latency: performance.now() - startTime },
          validationErrors: [error instanceof Error ? error.message : 'Unknown error']
        }
      } as EnhancedEvent;
    }
  }

  async normalizeEvents(events: BaseEvent[]): Promise<EnhancedEvent[]> {
    if (!this.config.enabled) {
      return events as EnhancedEvent[];
    }

    const normalizedEvents: EnhancedEvent[] = [];

    for (const event of events) {
      try {
        const normalized = await this.normalizeEvent(event);
        normalizedEvents.push(normalized);
      } catch (error) {
        console.error('[EventNormalizer] Error normalizing event batch:', error);
        // Add error event to maintain batch integrity
        normalizedEvents.push({
          ...event,
          processing: {
            processedAt: Date.now(),
            processedBy: 'event-normalizer',
            processingVersion: '1.0.0',
            quality: { confidence: 0, completeness: 0, accuracy: 0, latency: 0 },
            validationErrors: [error instanceof Error ? error.message : 'Unknown error']
          }
        } as EnhancedEvent);
      }
    }

    return normalizedEvents;
  }

  private async validateEvent(event: EnhancedEvent): Promise<void> {
    const rules = this.validationRules.get(event.type) || [];
    const errors: string[] = [];

    for (const rule of rules) {
      const value = this.getNestedValue(event, rule.field);
      
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        // Type validation
        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(`${rule.field} must be a string`);
        } else if (rule.type === 'number' && typeof value !== 'number') {
          errors.push(`${rule.field} must be a number`);
        } else if (rule.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${rule.field} must be a boolean`);
        } else if (rule.type === 'array' && !Array.isArray(value)) {
          errors.push(`${rule.field} must be an array`);
        } else if (rule.type === 'object' && typeof value !== 'object') {
          errors.push(`${rule.field} must be an object`);
        }

        // Length validation
        if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
          errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
          errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
        }

        // Pattern validation
        if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
          errors.push(`${rule.field} format is invalid`);
        }

        // Custom validation
        if (rule.custom && !rule.custom(value)) {
          errors.push(rule.errorMessage);
        }
      }
    }

    if (errors.length > 0) {
      if (this.config.validationLevel === 'strict') {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      } else {
        // Add validation errors to processing metadata
        if (!event.processing) {
          event.processing = {
            processedAt: Date.now(),
            processedBy: 'event-normalizer',
            processingVersion: '1.0.0',
            quality: { confidence: 0, completeness: 0, accuracy: 0, latency: 0 }
          };
        }
        event.processing.validationErrors = errors;
      }
    }
  }

  private normalizeUrls(event: EnhancedEvent): void {
    if (event.metadata.url) {
      try {
        const url = new URL(event.metadata.url);
        event.metadata.domain = url.hostname;
        event.metadata.path = url.pathname;
        event.metadata.query = url.search;
        event.metadata.protocol = url.protocol;
      } catch (error) {
        // Invalid URL, remove it
        delete event.metadata.url;
      }
    }

    // Normalize other URL fields in metadata
    if (event.metadata.referrer) {
      try {
        const referrerUrl = new URL(event.metadata.referrer);
        event.metadata.referrerDomain = referrerUrl.hostname;
      } catch (error) {
        delete event.metadata.referrer;
      }
    }
  }

  private truncateContent(event: EnhancedEvent): void {
    if (event.content?.text && typeof event.content.text === 'string') {
      if (event.content.text.length > this.config.maxContentLength) {
        event.content.text = event.content.text.substring(0, this.config.maxContentLength) + '...';
      }
    }

    // Truncate other content fields as needed
    if (event.content?.html && typeof event.content.html === 'string') {
      if (event.content.html.length > this.config.maxContentLength * 2) {
        event.content.html = event.content.html.substring(0, this.config.maxContentLength * 2) + '...';
      }
    }
  }

  private applyPrivacyProtection(event: EnhancedEvent): void {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credit', 'ssn'];
    const piiPatterns = [
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
      { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CREDIT_CARD]' },
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
      { pattern: /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/g, replacement: '[PHONE]' }
    ];

    // Scan and redact PII in content
    if (event.content?.text) {
      let text = event.content.text;
      let piiDetected = false;

      piiPatterns.forEach(({ pattern, replacement }) => {
        if (pattern.test(text)) {
          text = text.replace(pattern, replacement);
          piiDetected = true;
        }
      });

      if (piiDetected) {
        event.content.text = text;
        this.metrics.piiDetected++;
        
        if (!event.processing) {
          event.processing = {
            processedAt: Date.now(),
            processedBy: 'event-normalizer',
            processingVersion: '1.0.0',
            quality: { confidence: 0, completeness: 0, accuracy: 0, latency: 0 }
          };
        }
        
        if (!event.processing.privacy) {
          event.processing.privacy = {
            piiDetected: true,
            sensitiveData: [],
            anonymizedFields: []
          };
        }
        
        event.processing.privacy.piiDetected = true;
      }
    }

    // Redact sensitive metadata fields
    sensitiveFields.forEach(field => {
      if (event.metadata[field.toLowerCase()]) {
        if (!event.processing?.privacy) {
          if (!event.processing) {
            event.processing = {
              processedAt: Date.now(),
              processedBy: 'event-normalizer',
              processingVersion: '1.0.0',
              quality: { confidence: 0, completeness: 0, accuracy: 0, latency: 0 }
            };
          }
          event.processing.privacy = {
            piiDetected: false,
            sensitiveData: [],
            anonymizedFields: []
          };
        }
        event.processing.privacy.anonymizedFields?.push(field);
        event.metadata[field.toLowerCase()] = '[REDACTED]';
      }
    });
  }

  private async enrichEvent(event: EnhancedEvent): Promise<void> {
    if (!event.content?.text && !event.metadata.title) {
      return;
    }

    const text = (event.content?.text || event.metadata.title || '').substring(0, 5000);
    const cacheKey = this.generateCacheKey(text);

    // Check cache first
    let enrichmentData = this.enrichmentCache.get(cacheKey);
    if (!enrichmentData) {
      enrichmentData = await this.performEnrichment(text);
      this.enrichmentCache.set(cacheKey, enrichmentData);
      
      // Limit cache size
      if (this.enrichmentCache.size > 1000) {
        const firstKey = this.enrichmentCache.keys().next().value;
        this.enrichmentCache.delete(firstKey);
      }
    }

    // Apply enrichment to event
    if (enrichmentData) {
      event.enrichment = {
        entities: enrichmentData.entities,
        sentiment: enrichmentData.sentiment.score,
        topics: enrichmentData.topics.map(t => t.label),
        keywords: enrichmentData.keywords.map(k => k.text),
        summary: enrichmentData.summary,
        category: enrichmentData.category,
        urgency: enrichmentData.urgency
      };

      // Update metrics
      if (enrichmentData.entities.length > 0) {
        this.metrics.entitiesExtracted += enrichmentData.entities.length;
      }
      if (enrichmentData.sentiment) {
        this.metrics.sentimentProcessed++;
      }
    }
  }

  private async performEnrichment(text: string): Promise<EnrichmentData> {
    const enrichment: EnrichmentData = {
      entities: [],
      sentiment: { score: 0, magnitude: 0, classification: 'neutral', confidence: 0 },
      topics: [],
      keywords: [],
      summary: '',
      category: 'general',
      urgency: 0
    };

    try {
      // Entity extraction
      if (this.config.entityExtraction) {
        enrichment.entities = this.extractEntities(text);
      }

      // Sentiment analysis
      if (this.config.sentimentAnalysis) {
        enrichment.sentiment = this.analyzeSentiment(text);
      }

      // Keyword extraction
      if (this.config.keywordExtraction) {
        enrichment.keywords = this.extractKeywords(text);
      }

      // Topic modeling
      if (this.config.topicModeling) {
        enrichment.topics = this.extractTopics(text, enrichment.keywords);
      }

      // Summary generation
      if (text.length > 200) {
        enrichment.summary = this.generateSummary(text);
      }

      // Category classification
      enrichment.category = this.classifyCategory(text, enrichment.topics, enrichment.keywords);

      // Urgency assessment
      enrichment.urgency = this.assessUrgency(text, enrichment.sentiment, enrichment.entities);

    } catch (error) {
      console.warn('[EventNormalizer] Error during enrichment:', error);
    }

    return enrichment;
  }

  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];
    
    // Simple regex-based entity extraction (in production, use NLP libraries)
    const patterns = [
      { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
      { type: 'URL', regex: /https?:\/\/[^\s]+/g },
      { type: 'PHONE', regex: /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/g },
      { type: 'DATE', regex: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g },
      { type: 'MONEY', regex: /\$\d+(?:,\d{3})*(?:\.\d{2})?/g }
    ];

    patterns.forEach(({ type, regex }) => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: type as any,
          confidence: 0.8,
          start: match.index!,
          end: match.index! + match[0].length
        });
      }
    });

    return entities;
  }

  private analyzeSentiment(text: string): SentimentResult {
    // Simple sentiment analysis (in production, use ML models)
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'pleased'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'angry', 'sad', 'disappointed', 'frustrated'];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });

    const total = positiveCount + negativeCount;
    let score = 0;
    
    if (total > 0) {
      score = (positiveCount - negativeCount) / total;
    }

    let classification: 'positive' | 'negative' | 'neutral';
    if (score > 0.1) classification = 'positive';
    else if (score < -0.1) classification = 'negative';
    else classification = 'neutral';

    return {
      score,
      magnitude: Math.abs(score),
      classification,
      confidence: Math.min(0.9, total / 10)
    };
  }

  private extractKeywords(text: string): Keyword[] {
    // Simple keyword extraction using frequency and importance
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([text, frequency]) => ({
        text,
        score: frequency / words.length,
        relevance: frequency,
        frequency
      }));
  }

  private extractTopics(text: string, keywords: Keyword[]): Topic[] {
    // Simple topic extraction based on keywords
    const topicKeywords: Record<string, string[]> = {
      'work': ['work', 'project', 'task', 'meeting', 'deadline'],
      'personal': ['personal', 'family', 'home', 'life', 'health'],
      'technology': ['code', 'software', 'computer', 'programming', 'tech'],
      'communication': ['email', 'message', 'chat', 'call', 'conversation'],
      'learning': ['learn', 'study', 'course', 'tutorial', 'education']
    };

    const topics: Topic[] = [];
    
    Object.entries(topicKeywords).forEach(([topic, topicWords]) => {
      const score = topicWords.reduce((sum, word) => {
        const keyword = keywords.find(k => k.text.includes(word));
        return sum + (keyword ? keyword.score : 0);
      }, 0);

      if (score > 0) {
        topics.push({
          label: topic,
          score: score * 10,
          keywords: topicWords.filter(word => keywords.some(k => k.text.includes(word))),
          confidence: Math.min(0.9, score * 5)
        });
      }
    });

    return topics.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private generateSummary(text: string): string {
    // Simple extractive summarization
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 2) return text;

    // Score sentences based on position, length, and keyword density
    const scoredSentences = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().split(/\s+/);
      const length = words.length;
      const position = index / sentences.length;
      
      // Prefer sentences in middle range, not too short or too long
      const lengthScore = Math.min(1, length / 20) * (length < 100 ? 1 : 0.5);
      const positionScore = 1 - Math.abs(position - 0.5) * 2;
      
      return {
        sentence: sentence.trim(),
        score: lengthScore * positionScore
      };
    });

    // Return top 2-3 sentences
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(3, Math.ceil(sentences.length / 3)))
      .map(s => s.sentence);

    return topSentences.join('. ') + '.';
  }

  private classifyCategory(text: string, topics: Topic[], keywords: Keyword[]): string {
    // Simple classification based on content analysis
    if (topics.length > 0) {
      return topics[0].label;
    }

    const techKeywords = ['code', 'programming', 'software', 'development', 'bug', 'feature'];
    const workKeywords = ['meeting', 'project', 'task', 'deadline', 'team', 'colleague'];
    const personalKeywords = ['personal', 'family', 'home', 'health', 'friend'];

    const keywordCounts = {
      technology: techKeywords.filter(kw => keywords.some(k => k.text.includes(kw))).length,
      work: workKeywords.filter(kw => keywords.some(k => k.text.includes(kw))).length,
      personal: personalKeywords.filter(kw => keywords.some(k => k.text.includes(kw))).length
    };

    const maxCategory = Object.entries(keywordCounts).reduce((max, [category, count]) => 
      count > max.count ? { category, count } : max, { category: 'general', count: 0 });

    return maxCategory.count > 0 ? maxCategory.category : 'general';
  }

  private assessUrgency(text: string, sentiment: SentimentResult, entities: Entity[]): number {
    let urgency = 0.3; // Base urgency

    // Increase urgency for negative sentiment
    if (sentiment.classification === 'negative') {
      urgency += 0.3;
    }

    // Increase urgency for certain keywords
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'deadline', 'emergency', 'critical'];
    if (urgentKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      urgency += 0.3;
    }

    // Increase urgency for dates in entities (could be deadlines)
    if (entities.some(e => e.type === 'DATE')) {
      urgency += 0.1;
    }

    return Math.min(1, urgency);
  }

  private calculateQuality(event: EnhancedEvent): EventQuality {
    let confidence = 1.0;
    let completeness = 1.0;
    let accuracy = 1.0;

    // Reduce confidence for missing required fields
    if (!event.metadata.action) confidence *= 0.8;
    if (!event.content && !event.metadata.url) completeness *= 0.7;

    // Reduce accuracy for validation errors
    if (event.processing?.validationErrors && event.processing.validationErrors.length > 0) {
      accuracy *= Math.max(0.1, 1 - (event.processing.validationErrors.length * 0.2));
    }

    // Reduce scores for low-quality content
    if (event.content?.text && event.content.text.length < 10) {
      completeness *= 0.5;
    }

    // Adjust for privacy concerns
    if (event.processing?.privacy?.piiDetected) {
      accuracy *= 0.8;
    }

    return {
      confidence: Math.round(confidence * 100) / 100,
      completeness: Math.round(completeness * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
      latency: event.processing?.processedAt ? Date.now() - event.processing.processedAt : 0,
      validationErrors: event.processing?.validationErrors
    };
  }

  private calculatePriority(event: BaseEvent): number {
    const priorityMap = {
      [EventType.EMAIL]: 8,
      [EventType.CODE]: 7,
      [EventType.GITHUB]: 7,
      [EventType.SLACK]: 6,
      [EventType.SYSTEM_APP]: 5,
      [EventType.BROWSER_TAB]: 4,
      [EventType.YOUTUBE]: 3,
      [EventType.VS_CODE]: 6,
      [EventType.CUSTOM]: 5,
    };
    
    return priorityMap[event.type] || 5;
  }

  private generateCacheKey(text: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'];
    return stopWords.includes(word.toLowerCase());
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  // Public API methods
  getMetrics(): NormalizationMetrics {
    return { ...this.metrics };
  }

  updateConfig(newConfig: Partial<NormalizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Clear cache if configuration changes significantly
    if (newConfig.enrichmentEnabled !== undefined || 
        newConfig.entityExtraction !== undefined ||
        newConfig.sentimentAnalysis !== undefined) {
      this.enrichmentCache.clear();
    }
  }

  getConfig(): NormalizationConfig {
    return { ...this.config };
  }

  clearCache(): void {
    this.enrichmentCache.clear();
  }

  async validateEventSchema(event: BaseEvent): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const enhancedEvent = event as EnhancedEvent;
      await this.validateEvent(enhancedEvent);
      return { 
        valid: !enhancedEvent.processing?.validationErrors || enhancedEvent.processing.validationErrors.length === 0,
        errors: enhancedEvent.processing?.validationErrors || []
      };
    } catch (error) {
      return { 
        valid: false, 
        errors: [error instanceof Error ? error.message : 'Unknown validation error'] 
      };
    }
  }
}