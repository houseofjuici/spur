import { MemoryGraph } from '@/memory/graph';
import { NaturalLanguageProcessor, NLPResult } from '../nlp';

export interface ProactiveConfig {
  enabled: boolean;
  predictionInterval: number; // minutes
  confidenceThreshold: number;
  maxSuggestions: number;
  contextWindow: number;
  learningEnabled: boolean;
  personalizationEnabled: boolean;
}

export interface ProactiveSuggestion {
  id: string;
  type: 'action' | 'reminder' | 'information' | 'optimization';
  title: string;
  description: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  triggers: string[];
  parameters?: any;
  estimatedValue: number; // 0-1 scale
  expiresAt?: number;
  context: any;
}

export interface UserPattern {
  id: string;
  type: 'temporal' | 'behavioral' | 'contextual' | 'workflow';
  description: string;
  confidence: number;
  frequency: number;
  lastObserved: number;
  data: any;
}

export interface ContextualInsight {
  id: string;
  type: 'correlation' | 'trend' | 'anomaly' | 'opportunity' | 'risk';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  data: any;
  timestamp: number;
}

export class ProactiveIntelligenceEngine {
  private config: ProactiveConfig;
  private isInitialized = false;
  private isRunning = false;

  // Core components
  private memoryGraph: MemoryGraph;
  private nlpProcessor: NaturalLanguageProcessor;

  // Internal state
  private userPatterns: Map<string, UserPattern> = new Map();
  private activeSuggestions: Map<string, ProactiveSuggestion> = new Map();
  private contextualInsights: Map<string, ContextualInsight> = new Map();
  private suggestionHistory: Array<{ suggestion: ProactiveSuggestion; accepted: boolean; timestamp: number }> = [];

  // Analysis engines
  private temporalAnalyzer: TemporalPatternAnalyzer;
  private behavioralAnalyzer: BehavioralPatternAnalyzer;
  private contextualAnalyzer: ContextualPatternAnalyzer;
  private opportunityAnalyzer: OpportunityAnalyzer;

  // Event handlers
  private suggestionHandlers: Set<(suggestions: ProactiveSuggestion[]) => void> = new Set();
  private insightHandlers: Set<(insight: ContextualInsight) => void> = new Set();
  private errorHandler?: (error: Error) => void;

  // Metrics
  private metrics = {
    totalSuggestions: 0,
    acceptedSuggestions: 0,
    averageConfidence: 0,
    patternDetections: 0,
    insightGenerations: 0,
    predictionAccuracy: 0
  };

  constructor(
    config: ProactiveConfig,
    memoryGraph: MemoryGraph,
    nlpProcessor: NaturalLanguageProcessor
  ) {
    this.config = config;
    this.memoryGraph = memoryGraph;
    this.nlpProcessor = nlpProcessor;

    // Initialize analyzers
    this.temporalAnalyzer = new TemporalPatternAnalyzer();
    this.behavioralAnalyzer = new BehavioralPatternAnalyzer();
    this.contextualAnalyzer = new ContextualPatternAnalyzer();
    this.opportunityAnalyzer = new OpportunityAnalyzer();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[ProactiveIntelligenceEngine] Initializing...');

      // Initialize analyzers
      await Promise.all([
        this.temporalAnalyzer.initialize(),
        this.behavioralAnalyzer.initialize(),
        this.contextualAnalyzer.initialize(),
        this.opportunityAnalyzer.initialize()
      ]);

      // Load existing patterns from memory
      await this.loadUserPatterns();

      this.isInitialized = true;
      console.log('[ProactiveIntelligenceEngine] Initialized successfully');

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[ProactiveIntelligenceEngine] Starting...');
      this.isRunning = true;

      // Start continuous analysis
      this.startContinuousAnalysis();

      console.log('[ProactiveIntelligenceEngine] Started successfully');

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[ProactiveIntelligenceEngine] Stopping...');
      this.isRunning = false;
      console.log('[ProactiveIntelligenceEngine] Stopped successfully');

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Stop failed:', error);
    }
  }

  async generateSuggestions(sessionId: string): Promise<ProactiveSuggestion[]> {
    if (!this.isInitialized || !this.isRunning) {
      return [];
    }

    try {
      // Get session context
      const sessionContext = await this.getSessionContext(sessionId);
      
      // Generate suggestions based on multiple factors
      const suggestions: ProactiveSuggestion[] = [];

      // Analyze temporal patterns
      const temporalSuggestions = await this.temporalAnalyzer.generateSuggestions(sessionContext, this.userPatterns);
      suggestions.push(...temporalSuggestions);

      // Analyze behavioral patterns
      const behavioralSuggestions = await this.behavioralAnalyzer.generateSuggestions(sessionContext, this.userPatterns);
      suggestions.push(...behavioralSuggestions);

      // Analyze contextual patterns
      const contextualSuggestions = await this.contextualAnalyzer.generateSuggestions(sessionContext, this.userPatterns);
      suggestions.push(...contextualSuggestions);

      // Analyze opportunities
      const opportunitySuggestions = await this.opportunityAnalyzer.generateSuggestions(sessionContext, this.userPatterns);
      suggestions.push(...opportunitySuggestions);

      // Filter and prioritize suggestions
      const filteredSuggestions = this.filterAndPrioritizeSuggestions(suggestions);

      // Update active suggestions
      this.updateActiveSuggestions(filteredSuggestions);

      // Update metrics
      this.metrics.totalSuggestions += filteredSuggestions.length;

      return filteredSuggestions.slice(0, this.config.maxSuggestions);

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error generating suggestions:', error);
      return [];
    }
  }

  async generateContextualSuggestions(input: string, sessionContext: any): Promise<string[]> {
    if (!this.isInitialized || !this.isRunning) {
      return [];
    }

    try {
      // Process input to understand context
      const nlpResult = await this.nlpProcessor.process(input, sessionContext);
      
      // Generate contextual suggestions based on input
      const contextualSuggestions = await this.analyzeContextualInput(input, nlpResult, sessionContext);

      return contextualSuggestions;

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error generating contextual suggestions:', error);
      return [];
    }
  }

  async recordSuggestionResponse(suggestionId: string, accepted: boolean): Promise<void> {
    try {
      const suggestion = this.activeSuggestions.get(suggestionId);
      if (!suggestion) return;

      // Record in history
      this.suggestionHistory.push({
        suggestion,
        accepted,
        timestamp: Date.now()
      });

      // Remove from active suggestions
      this.activeSuggestions.delete(suggestionId);

      // Update metrics
      if (accepted) {
        this.metrics.acceptedSuggestions++;
      }

      // Update user patterns based on response
      await this.updateUserPatternsFromResponse(suggestion, accepted);

      // Clean up expired suggestions
      this.cleanupExpiredSuggestions();

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error recording suggestion response:', error);
    }
  }

  async generateInsights(): Promise<ContextualInsight[]> {
    if (!this.isInitialized || !this.isRunning) {
      return [];
    }

    try {
      const insights: ContextualInsight[] = [];

      // Generate insights from memory analysis
      const memoryInsights = await this.analyzeMemoryPatterns();
      insights.push(...memoryInsights);

      // Generate insights from behavior patterns
      const behaviorInsights = await this.behavioralAnalyzer.generateInsights(this.userPatterns);
      insights.push(...behaviorInsights);

      // Generate contextual insights
      const contextualInsights = await this.contextualAnalyzer.generateInsights(this.userPatterns);
      insights.push(...contextualInsights);

      // Store and filter insights
      const filteredInsights = this.filterAndStoreInsights(insights);

      // Update metrics
      this.metrics.insightGenerations += filteredInsights.length;

      return filteredInsights;

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error generating insights:', error);
      return [];
    }
  }

  private async getSessionContext(sessionId: string): Promise<any> {
    try {
      // Get recent interactions from memory
      const recentInteractions = await this.memoryGraph.getContextualRecommendations(
        sessionId,
        '',
        20
      );

      return {
        sessionId,
        recentInteractions,
        currentActivity: await this.getCurrentActivity(sessionId),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error getting session context:', error);
      return { sessionId, timestamp: Date.now() };
    }
  }

  private async getCurrentActivity(sessionId: string): Promise<any> {
    // Analyze current user activity based on recent interactions
    try {
      const recentActivity = await this.memoryGraph.getContextualRecommendations(
        sessionId,
        '',
        5
      );

      if (recentActivity.length === 0) {
        return { activity: 'unknown', confidence: 0 };
      }

      // Simple activity detection based on content analysis
      const activities = recentActivity.map(item => {
        const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
        if (content.includes('work') || content.includes('project')) return 'work';
        if (content.includes('email') || content.includes('message')) return 'communication';
        if (content.includes('search') || content.includes('find')) return 'research';
        return 'general';
      });

      const activityCounts = activities.reduce((acc, activity) => {
        acc[activity] = (acc[activity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostCommonActivity = Object.entries(activityCounts)
        .sort(([,a], [,b]) => b - a)[0];

      return {
        activity: mostCommonActivity[0],
        confidence: mostCommonActivity[1] / activities.length,
        activities: activityCounts
      };
    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error getting current activity:', error);
      return { activity: 'unknown', confidence: 0 };
    }
  }

  private async analyzeContextualInput(input: string, nlpResult: NLPResult, sessionContext: any): Promise<string[]> {
    const suggestions: string[] = [];

    // Analyze input for proactive suggestions
    if (nlpResult.intent === 'search') {
      suggestions.push('Would you like me to save this search for future reference?');
    }

    if (nlpResult.intent === 'capture') {
      suggestions.push('I can help you organize this with related information I\'ve found.');
    }

    if (nlpResult.sentiment.label === 'negative') {
      suggestions.push('I notice you might be frustrated. Would you like me to help simplify this?');
    }

    // Time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 11) {
      suggestions.push('Good morning! Would you like me to help you plan your day?');
    } else if (hour >= 14 && hour <= 16) {
      suggestions.push('Afternoon productivity check: Would you like me to suggest some task optimizations?');
    } else if (hour >= 17 && hour <= 19) {
      suggestions.push('End of day approaching: Would you like me to help you review and plan for tomorrow?');
    }

    return suggestions.slice(0, 3);
  }

  private filterAndPrioritizeSuggestions(suggestions: ProactiveSuggestion[]): ProactiveSuggestion[] {
    return suggestions
      .filter(suggestion => suggestion.confidence >= this.config.confidenceThreshold)
      .sort((a, b) => {
        // Sort by confidence, then priority, then estimated value
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence;
        }
        if (a.priority !== b.priority) {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return b.estimatedValue - a.estimatedValue;
      });
  }

  private updateActiveSuggestions(suggestions: ProactiveSuggestion[]): void {
    // Remove expired suggestions
    this.cleanupExpiredSuggestions();

    // Add new suggestions
    suggestions.forEach(suggestion => {
      this.activeSuggestions.set(suggestion.id, suggestion);
    });

    // Notify handlers
    if (suggestions.length > 0) {
      this.notifySuggestionHandlers(suggestions);
    }
  }

  private cleanupExpiredSuggestions(): void {
    const now = Date.now();
    for (const [id, suggestion] of this.activeSuggestions) {
      if (suggestion.expiresAt && suggestion.expiresAt < now) {
        this.activeSuggestions.delete(id);
      }
    }
  }

  private async updateUserPatternsFromResponse(suggestion: ProactiveSuggestion, accepted: boolean): Promise<void> {
    if (!this.config.learningEnabled) return;

    try {
      // Update pattern confidence based on acceptance
      for (const trigger of suggestion.triggers) {
        const pattern = this.userPatterns.get(trigger);
        if (pattern) {
          // Adjust confidence based on whether suggestion was accepted
          const adjustment = accepted ? 0.1 : -0.05;
          pattern.confidence = Math.max(0, Math.min(1, pattern.confidence + adjustment));
          pattern.lastObserved = Date.now();
        }
      }

      // Save updated patterns
      await this.saveUserPatterns();

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error updating user patterns:', error);
    }
  }

  private async analyzeMemoryPatterns(): Promise<ContextualInsight[]> {
    const insights: ContextualInsight[] = [];

    try {
      // Analyze memory graph for patterns
      const analysis = await this.memoryGraph.analyze();

      // Generate insights from analysis
      if (analysis.temporal.trends.length > 0) {
        insights.push({
          id: `temporal_trend_${Date.now()}`,
          type: 'trend',
          title: 'Activity Pattern Detected',
          description: `I've noticed a trend in your activity: ${analysis.temporal.trends[0]}`,
          confidence: 0.8,
          impact: 'medium',
          data: { trends: analysis.temporal.trends },
          timestamp: Date.now()
        });
      }

      if (analysis.relevance.distribution.low > 0.5) {
        insights.push({
          id: 'relevance_optimization',
          type: 'opportunity',
          title: 'Memory Optimization Opportunity',
          description: 'Many of your stored memories have low relevance scores. Consider organizing or removing old items.',
          confidence: 0.7,
          impact: 'medium',
          data: { distribution: analysis.relevance.distribution },
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error analyzing memory patterns:', error);
    }

    return insights;
  }

  private filterAndStoreInsights(insights: ContextualInsight[]): ContextualInsight[] {
    const filteredInsights = insights.filter(insight => insight.confidence >= this.config.confidenceThreshold);

    // Store insights
    filteredInsights.forEach(insight => {
      this.contextualInsights.set(insight.id, insight);
      this.notifyInsightHandlers(insight);
    });

    // Remove old insights (keep only last 100)
    if (this.contextualInsights.size > 100) {
      const keysToDelete = Array.from(this.contextualInsights.keys()).slice(0, this.contextualInsights.size - 100);
      keysToDelete.forEach(key => this.contextualInsights.delete(key));
    }

    return filteredInsights;
  }

  private async loadUserPatterns(): Promise<void> {
    try {
      // In a real implementation, this would load patterns from persistent storage
      // For now, initialize with empty patterns
      console.log('[ProactiveIntelligenceEngine] Loading user patterns...');
    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error loading user patterns:', error);
    }
  }

  private async saveUserPatterns(): Promise<void> {
    try {
      // In a real implementation, this would save patterns to persistent storage
      console.log('[ProactiveIntelligenceEngine] Saving user patterns...');
    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error saving user patterns:', error);
    }
  }

  private startContinuousAnalysis(): void {
    // Run pattern analysis every 5 minutes
    setInterval(async () => {
      if (this.isRunning) {
        try {
          await this.updatePatterns();
          await this.generateInsights();
        } catch (error) {
          console.error('[ProactiveIntelligenceEngine] Error in continuous analysis:', error);
        }
      }
    }, 300000); // 5 minutes
  }

  private async updatePatterns(): Promise<void> {
    if (!this.config.learningEnabled) return;

    try {
      // Update temporal patterns
      const temporalPatterns = await this.temporalAnalyzer.updatePatterns(this.memoryGraph);
      temporalPatterns.forEach(pattern => {
        this.userPatterns.set(pattern.id, pattern);
      });

      // Update behavioral patterns
      const behavioralPatterns = await this.behavioralAnalyzer.updatePatterns(this.memoryGraph);
      behavioralPatterns.forEach(pattern => {
        this.userPatterns.set(pattern.id, pattern);
      });

      // Update contextual patterns
      const contextualPatterns = await this.contextualAnalyzer.updatePatterns(this.memoryGraph);
      contextualPatterns.forEach(pattern => {
        this.userPatterns.set(pattern.id, pattern);
      });

      this.metrics.patternDetections++;

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Error updating patterns:', error);
    }
  }

  private notifySuggestionHandlers(suggestions: ProactiveSuggestion[]): void {
    this.suggestionHandlers.forEach(handler => {
      try {
        handler(suggestions);
      } catch (error) {
        console.error('[ProactiveIntelligenceEngine] Error in suggestion handler:', error);
      }
    });
  }

  private notifyInsightHandlers(insight: ContextualInsight): void {
    this.insightHandlers.forEach(handler => {
      try {
        handler(insight);
      } catch (error) {
        console.error('[ProactiveIntelligenceEngine] Error in insight handler:', error);
      }
    });
  }

  // Public API methods
  onSuggestionGenerated(callback: (suggestions: ProactiveSuggestion[]) => void): () => void {
    this.suggestionHandlers.add(callback);
    return () => this.suggestionHandlers.delete(callback);
  }

  onInsightGenerated(callback: (insight: ContextualInsight) => void): () => void {
    this.insightHandlers.add(callback);
    return () => this.insightHandlers.delete(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorHandler = callback;
  }

  isHealthy(): boolean {
    return this.isRunning;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getActiveSuggestions(): ProactiveSuggestion[] {
    return Array.from(this.activeSuggestions.values());
  }

  getInsights(): ContextualInsight[] {
    return Array.from(this.contextualInsights.values());
  }

  getUserPatterns(): UserPattern[] {
    return Array.from(this.userPatterns.values());
  }

  async updateConfig(newConfig: Partial<ProactiveConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    try {
      // Cleanup all components
      await Promise.all([
        this.temporalAnalyzer.cleanup(),
        this.behavioralAnalyzer.cleanup(),
        this.contextualAnalyzer.cleanup(),
        this.opportunityAnalyzer.cleanup()
      ]);

      // Clear all data
      this.userPatterns.clear();
      this.activeSuggestions.clear();
      this.contextualInsights.clear();
      this.suggestionHistory = [];
      this.suggestionHandlers.clear();
      this.insightHandlers.clear();

      this.isInitialized = false;
      console.log('[ProactiveIntelligenceEngine] Cleanup completed');

    } catch (error) {
      console.error('[ProactiveIntelligenceEngine] Cleanup failed:', error);
    }
  }
}

// Pattern Analyzers (Simplified Implementations)

class TemporalPatternAnalyzer {
  async initialize(): Promise<void> {}
  async cleanup(): Promise<void> {}
  
  async generateSuggestions(sessionContext: any, patterns: Map<string, UserPattern>): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    // Time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 10) {
      suggestions.push({
        id: 'morning_planning',
        type: 'reminder',
        title: 'Plan Your Day',
        description: 'Good morning! Would you like me to help you plan your day based on your current tasks?',
        confidence: 0.8,
        priority: 'medium',
        triggers: ['morning_routine'],
        estimatedValue: 0.7,
        context: sessionContext
      });
    }

    return suggestions;
  }

  async updatePatterns(memoryGraph: MemoryGraph): Promise<UserPattern[]> {
    return []; // Simplified implementation
  }

  async generateInsights(patterns: Map<string, UserPattern>): Promise<ContextualInsight[]> {
    return [];
  }
}

class BehavioralPatternAnalyzer {
  async initialize(): Promise<void> {}
  async cleanup(): Promise<void> {}
  
  async generateSuggestions(sessionContext: any, patterns: Map<string, UserPattern>): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    // Behavioral-based suggestions
    suggestions.push({
      id: 'workflow_optimization',
      type: 'optimization',
      title: 'Workflow Optimization',
      description: 'I\'ve noticed opportunities to optimize your workflow. Would you like me to suggest improvements?',
      confidence: 0.75,
      priority: 'medium',
      triggers: ['behavioral_pattern'],
      estimatedValue: 0.8,
      context: sessionContext
    });

    return suggestions;
  }

  async updatePatterns(memoryGraph: MemoryGraph): Promise<UserPattern[]> {
    return [];
  }

  async generateInsights(patterns: Map<string, UserPattern>): Promise<ContextualInsight[]> {
    return [];
  }
}

class ContextualPatternAnalyzer {
  async initialize(): Promise<void> {}
  async cleanup(): Promise<void> {}
  
  async generateSuggestions(sessionContext: any, patterns: Map<string, UserPattern>): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    // Contextual suggestions based on session context
    if (sessionContext.currentActivity?.activity === 'work') {
      suggestions.push({
        id: 'work_context_optimization',
        type: 'action',
        title: 'Work Context Optimization',
        description: 'Based on your current work activity, I can help you optimize your focus and productivity.',
        confidence: 0.7,
        priority: 'medium',
        triggers: ['work_context'],
        estimatedValue: 0.6,
        context: sessionContext
      });
    }

    return suggestions;
  }

  async updatePatterns(memoryGraph: MemoryGraph): Promise<UserPattern[]> {
    return [];
  }

  async generateInsights(patterns: Map<string, UserPattern>): Promise<ContextualInsight[]> {
    return [];
  }
}

class OpportunityAnalyzer {
  async initialize(): Promise<void> {}
  async cleanup(): Promise<void> {}
  
  async generateSuggestions(sessionContext: any, patterns: Map<string, UserPattern>): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    // Opportunity-based suggestions
    suggestions.push({
      id: 'automation_opportunity',
      type: 'action',
      title: 'Automation Opportunity',
      description: 'I\'ve identified tasks that could be automated to save you time.',
      confidence: 0.8,
      priority: 'high',
      triggers: ['efficiency_pattern'],
      estimatedValue: 0.9,
      context: sessionContext
    });

    return suggestions;
  }

  async updatePatterns(memoryGraph: MemoryGraph): Promise<UserPattern[]> {
    return [];
  }
}