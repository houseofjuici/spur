import { 
  BaseEvent, 
  EventType, 
  EventSource, 
  MemoryContext,
  AssistantContext,
  ActivityContext 
} from '@/types';
import { EnhancedEvent } from '@/types/events';

export interface StreamConfig {
  enabled: boolean;
  bufferSize: number;
  flushInterval: number;
  maxContextAge: number;
  enableRealtime: boolean;
  enableContextualization: boolean;
  enablePersonalization: boolean;
  privacyFilter: boolean;
  compressionEnabled: boolean;
  maxEventsPerContext: number;
  relevanceThreshold: number;
}

export interface AssistantStreamMessage {
  id: string;
  type: 'context_update' | 'insight' | 'suggestion' | 'alert' | 'system';
  timestamp: number;
  context: AssistantContext;
  payload: any;
  priority: number;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

export interface ContextWindow {
  id: string;
  sessionId: string;
  events: EnhancedEvent[];
  context: AssistantContext;
  lastUpdated: number;
  relevanceScore: number;
  activitySummary: ActivitySummary;
  insights: Insight[];
  patterns: Pattern[];
}

export interface ActivitySummary {
  dominantActivity: string;
  activityDistribution: Record<string, number>;
  timeSpent: number;
  focusScore: number;
  productivityScore: number;
  energyLevel: 'low' | 'medium' | 'high';
  currentProjects: string[];
  recentTopics: string[];
}

export interface Insight {
  id: string;
  type: 'pattern' | 'opportunity' | 'warning' | 'achievement' | 'suggestion';
  title: string;
  description: string;
  confidence: number;
  relevance: number;
  urgency: number;
  category: string;
  timestamp: number;
  evidence: EnhancedEvent[];
  actionSuggested?: string;
  metadata?: Record<string, any>;
}

export interface Pattern {
  id: string;
  type: 'temporal' | 'semantic' | 'behavioral' | 'workflow';
  description: string;
  frequency: number;
  confidence: number;
  lastObserved: number;
  events: EnhancedEvent[];
  metadata?: Record<string, any>;
}

export interface StreamMetrics {
  messagesSent: number;
  eventsProcessed: number;
  insightsGenerated: number;
  patternsDetected: number;
  averageLatency: number;
  contextUpdates: number;
  activeConnections: number;
  bufferSize: number;
  errorRate: number;
}

export class AssistantContextStream {
  private config: StreamConfig;
  private eventBuffer: EnhancedEvent[] = [];
  private contextWindows: Map<string, ContextWindow> = new Map();
  private subscribers: Set<(message: AssistantStreamMessage) => void> = new Set();
  private metrics: StreamMetrics;
  private isRunning = false;
  private flushInterval?: number;
  private insightEngine: InsightEngine;
  private patternDetector: PatternDetector;
  private contextBuilder: ContextBuilder;

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = {
      enabled: true,
      bufferSize: 100,
      flushInterval: 1000,
      maxContextAge: 3600000, // 1 hour
      enableRealtime: true,
      enableContextualization: true,
      enablePersonalization: true,
      privacyFilter: true,
      compressionEnabled: true,
      maxEventsPerContext: 50,
      relevanceThreshold: 0.3,
      ...config
    };

    this.metrics = {
      messagesSent: 0,
      eventsProcessed: 0,
      insightsGenerated: 0,
      patternsDetected: 0,
      averageLatency: 0,
      contextUpdates: 0,
      activeConnections: 0,
      bufferSize: 0,
      errorRate: 0
    };

    this.insightEngine = new InsightEngine();
    this.patternDetector = new PatternDetector();
    this.contextBuilder = new ContextBuilder();
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) return;

    try {
      console.log('[AssistantContextStream] Starting context stream...');

      // Start periodic context flushing
      this.flushInterval = window.setInterval(() => {
        this.flushEventBuffer();
      }, this.config.flushInterval);

      // Start background processing
      this.startBackgroundProcessing();

      this.isRunning = true;
      console.log('[AssistantContextStream] Started successfully');

    } catch (error) {
      console.error('[AssistantContextStream] Failed to start:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[AssistantContextStream] Stopping context stream...');

      // Clear intervals
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
        this.flushInterval = undefined;
      }

      // Process remaining events
      await this.flushEventBuffer();

      // Clean up old context windows
      this.cleanupContextWindows();

      this.isRunning = false;
      console.log('[AssistantContextStream] Stopped successfully');

    } catch (error) {
      console.error('[AssistantContextStream] Error stopping:', error);
    }
  }

  async processEvents(events: EnhancedEvent[]): Promise<void> {
    if (!this.config.enabled || !this.isRunning) return;

    const startTime = performance.now();

    try {
      // Add events to buffer
      this.eventBuffer.push(...events);
      
      // Limit buffer size
      if (this.eventBuffer.length > this.config.bufferSize) {
        this.eventBuffer = this.eventBuffer.slice(-this.config.bufferSize);
      }

      // Update metrics
      this.metrics.eventsProcessed += events.length;
      this.metrics.bufferSize = this.eventBuffer.length;

      // Process immediately if real-time mode is enabled
      if (this.config.enableRealtime && events.length > 0) {
        await this.processEventBatch(events);
      }

      // Update average latency
      const processingTime = performance.now() - startTime;
      this.metrics.averageLatency = this.updateAverage(
        this.metrics.averageLatency,
        processingTime,
        this.metrics.eventsProcessed
      );

    } catch (error) {
      console.error('[AssistantContextStream] Error processing events:', error);
      this.metrics.errorRate++;
    }
  }

  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToProcess = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.processEventBatch(eventsToProcess);
    } catch (error) {
      console.error('[AssistantContextStream] Error flushing event buffer:', error);
      // Return failed events to buffer for retry
      this.eventBuffer.unshift(...eventsToProcess);
      this.metrics.errorRate++;
    }
  }

  private async processEventBatch(events: EnhancedEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      // Group events by session
      const eventsBySession = this.groupEventsBySession(events);

      // Process each session context
      for (const [sessionId, sessionEvents] of eventsBySession.entries()) {
        await this.processSessionEvents(sessionId, sessionEvents);
      }

    } catch (error) {
      console.error('[AssistantContextStream] Error processing event batch:', error);
      throw error;
    }
  }

  private groupEventsBySession(events: EnhancedEvent[]): Map<string, EnhancedEvent[]> {
    const sessionMap = new Map<string, EnhancedEvent[]>();

    events.forEach(event => {
      const sessionId = event.context?.sessionId || this.generateSessionId();
      
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, []);
      }
      
      sessionMap.get(sessionId)!.push(event);
    });

    return sessionMap;
  }

  private async processSessionEvents(sessionId: string, events: EnhancedEvent[]): Promise<void> {
    try {
      // Get or create context window
      let contextWindow = this.contextWindows.get(sessionId);
      if (!contextWindow) {
        contextWindow = await this.createContextWindow(sessionId, events);
        this.contextWindows.set(sessionId, contextWindow);
      } else {
        // Update existing context window
        await this.updateContextWindow(contextWindow, events);
      }

      // Generate insights for new events
      if (this.config.enableContextualization) {
        const newInsights = await this.insightEngine.generateInsights(
          events, 
          contextWindow.events
        );
        
        contextWindow.insights.push(...newInsights);
        this.metrics.insightsGenerated += newInsights.length;
      }

      // Detect patterns
      const newPatterns = await this.patternDetector.detectPatterns(
        contextWindow.events,
        contextWindow.insights
      );
      
      contextWindow.patterns.push(...newPatterns);
      this.metrics.patternsDetected += newPatterns.length;

      // Update activity summary
      contextWindow.activitySummary = await this.contextBuilder.buildActivitySummary(
        contextWindow.events
      );

      // Calculate relevance score
      contextWindow.relevanceScore = this.calculateRelevanceScore(contextWindow);

      // Limit events and insights to prevent memory bloat
      if (contextWindow.events.length > this.config.maxEventsPerContext) {
        contextWindow.events = contextWindow.events.slice(-this.config.maxEventsPerContext);
      }
      
      if (contextWindow.insights.length > 20) {
        contextWindow.insights = contextWindow.insights.slice(-20);
      }

      contextWindow.lastUpdated = Date.now();

      // Send context update to subscribers
      if (this.config.enableRealtime) {
        await this.sendContextUpdate(contextWindow);
      }

    } catch (error) {
      console.error(`[AssistantContextStream] Error processing session ${sessionId}:`, error);
      throw error;
    }
  }

  private async createContextWindow(sessionId: string, initialEvents: EnhancedEvent[]): Promise<ContextWindow> {
    const context = await this.contextBuilder.buildAssistantContext(initialEvents);
    const activitySummary = await this.contextBuilder.buildActivitySummary(initialEvents);

    return {
      id: this.generateWindowId(),
      sessionId,
      events: [...initialEvents],
      context,
      lastUpdated: Date.now(),
      relevanceScore: 1.0,
      activitySummary,
      insights: [],
      patterns: []
    };
  }

  private async updateContextWindow(contextWindow: ContextWindow, newEvents: EnhancedEvent[]): Promise<void> {
    // Add new events
    contextWindow.events.push(...newEvents);
    
    // Update assistant context
    contextWindow.context = await this.contextBuilder.updateAssistantContext(
      contextWindow.context,
      newEvents
    );

    contextWindow.lastUpdated = Date.now();
  }

  private calculateRelevanceScore(contextWindow: ContextWindow): number {
    let score = 1.0;

    // Decay based on age
    const age = Date.now() - contextWindow.lastUpdated;
    const ageDecay = Math.exp(-age / this.config.maxContextAge);
    score *= ageDecay;

    // Boost based on event recency and activity
    const recentEvents = contextWindow.events.filter(e => 
      Date.now() - e.timestamp < 300000 // 5 minutes
    ).length;
    
    const activityBoost = Math.min(2.0, 1.0 + (recentEvents / 10));
    score *= activityBoost;

    // Boost based on insights and patterns
    const insightBoost = Math.min(1.5, 1.0 + (contextWindow.insights.length / 10));
    score *= insightBoost;

    return Math.max(this.config.relevanceThreshold, Math.min(1.0, score));
  }

  private async sendContextUpdate(contextWindow: ContextWindow): Promise<void> {
    const message: AssistantStreamMessage = {
      id: this.generateMessageId(),
      type: 'context_update',
      timestamp: Date.now(),
      context: contextWindow.context,
      payload: {
        windowId: contextWindow.id,
        activitySummary: contextWindow.activitySummary,
        insights: contextWindow.insights.slice(-5), // Send recent insights
        patterns: contextWindow.patterns.slice(-3), // Send recent patterns
        relevanceScore: contextWindow.relevanceScore,
        eventCount: contextWindow.events.length
      },
      priority: this.calculateMessagePriority(contextWindow),
      metadata: {
        compression: this.config.compressionEnabled,
        privacyFiltered: this.config.privacyFilter
      }
    };

    await this.broadcastMessage(message);
  }

  private calculateMessagePriority(contextWindow: ContextWindow): number {
    let priority = 3; // Default priority

    // High priority for urgent insights
    const urgentInsights = contextWindow.insights.filter(i => i.urgency > 0.7);
    if (urgentInsights.length > 0) {
      priority = Math.max(priority, 8);
    }

    // High priority for high-relevance contexts
    if (contextWindow.relevanceScore > 0.8) {
      priority = Math.max(priority, 7);
    }

    // Medium priority for recent activity
    const recentActivity = contextWindow.events.filter(e => 
      Date.now() - e.timestamp < 60000 // 1 minute
    ).length;
    
    if (recentActivity > 5) {
      priority = Math.max(priority, 5);
    }

    return Math.min(10, priority);
  }

  private async broadcastMessage(message: AssistantStreamMessage): Promise<void> {
    if (this.subscribers.size === 0) return;

    const messagePromises = Array.from(this.subscribers).map(subscriber => {
      try {
        subscriber(message);
      } catch (error) {
        console.error('[AssistantContextStream] Error in subscriber callback:', error);
      }
    });

    await Promise.all(messagePromises);
    this.metrics.messagesSent++;
    this.metrics.contextUpdates++;
  }

  private startBackgroundProcessing(): void {
    // Clean up old context windows periodically
    setInterval(() => {
      this.cleanupContextWindows();
    }, 300000); // Every 5 minutes

    // Generate periodic insights
    setInterval(() => {
      this.generatePeriodicInsights();
    }, 60000); // Every minute
  }

  private cleanupContextWindows(): void {
    const now = Date.now();
    const maxAge = this.config.maxContextAge;

    for (const [sessionId, window] of this.contextWindows.entries()) {
      if (now - window.lastUpdated > maxAge) {
        this.contextWindows.delete(sessionId);
      }
    }
  }

  private async generatePeriodicInsights(): Promise<void> {
    if (!this.config.enableContextualization) return;

    try {
      for (const contextWindow of this.contextWindows.values()) {
        if (contextWindow.relevanceScore > this.config.relevanceThreshold) {
          const periodicInsights = await this.insightEngine.generatePeriodicInsights(
            contextWindow.events,
            contextWindow.insights
          );
          
          if (periodicInsights.length > 0) {
            contextWindow.insights.push(...periodicInsights);
            this.metrics.insightsGenerated += periodicInsights.length;
            
            // Send insight notification
            for (const insight of periodicInsights) {
              await this.sendInsightNotification(contextWindow, insight);
            }
          }
        }
      }
    } catch (error) {
      console.error('[AssistantContextStream] Error generating periodic insights:', error);
    }
  }

  private async sendInsightNotification(contextWindow: ContextWindow, insight: Insight): Promise<void> {
    const message: AssistantStreamMessage = {
      id: this.generateMessageId(),
      type: 'insight',
      timestamp: Date.now(),
      context: contextWindow.context,
      payload: insight,
      priority: Math.ceil(insight.urgency * 10),
      expiresAt: Date.now() + 3600000, // Expire after 1 hour
      metadata: {
        insightType: insight.type,
        confidence: insight.confidence,
        relevance: insight.relevance
      }
    };

    await this.broadcastMessage(message);
  }

  // Public API methods
  subscribe(callback: (message: AssistantStreamMessage) => void): () => void {
    this.subscribers.add(callback);
    this.metrics.activeConnections = this.subscribers.size;
    
    return () => {
      this.subscribers.delete(callback);
      this.metrics.activeConnections = this.subscribers.size;
    };
  }

  async getContext(sessionId: string): Promise<ContextWindow | null> {
    return this.contextWindows.get(sessionId) || null;
  }

  async getAllContexts(): Promise<ContextWindow[]> {
    return Array.from(this.contextWindows.values());
  }

  async getRecentInsights(sessionId?: string, limit: number = 10): Promise<Insight[]> {
    let insights: Insight[] = [];
    
    if (sessionId) {
      const contextWindow = this.contextWindows.get(sessionId);
      insights = contextWindow?.insights || [];
    } else {
      // Get insights from all contexts
      for (const contextWindow of this.contextWindows.values()) {
        insights.push(...contextWindow.insights);
      }
    }
    
    return insights
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getActiveSessions(): Promise<string[]> {
    const now = Date.now();
    const recentThreshold = now - 300000; // 5 minutes
    
    return Array.from(this.contextWindows.entries())
      .filter(([_, window]) => window.lastUpdated > recentThreshold)
      .map(([sessionId, _]) => sessionId);
  }

  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  updateConfig(newConfig: Partial<StreamConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): StreamConfig {
    return { ...this.config };
  }

  // Utility methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWindowId(): string {
    return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    this.contextWindows.clear();
    this.subscribers.clear();
    this.eventBuffer = [];
    
    console.log('[AssistantContextStream] Cleanup completed');
  }
}

// Helper classes for context building and analysis
class ContextBuilder {
  async buildAssistantContext(events: EnhancedEvent[]): Promise<AssistantContext> {
    // Build comprehensive assistant context from events
    const recentEvents = events.slice(-20); // Last 20 events
    
    return {
      conversationId: this.generateId(),
      userId: 'user', // Would be extracted from authentication
      sessionId: events[0]?.context?.sessionId || this.generateSessionId(),
      currentActivity: this.buildActivityContext(recentEvents),
      memoryContext: this.buildMemoryContext(events),
      previousMessages: [], // Would be populated from conversation history
      userPreferences: this.getDefaultUserPreferences()
    };
  }

  async updateAssistantContext(context: AssistantContext, newEvents: EnhancedEvent[]): Promise<AssistantContext> {
    // Update existing context with new events
    return {
      ...context,
      currentActivity: this.buildActivityContext([
        ...(context.currentActivity?.recentEvents || []),
        ...newEvents
      ].slice(-20)),
      memoryContext: this.buildMemoryContext([
        ...(context.memoryContext?.relatedEvents ? 
          events.filter(e => context.memoryContext!.relatedEvents.includes(e.id)) : []
        ),
        ...newEvents
      ])
    };
  }

  async buildActivitySummary(events: EnhancedEvent[]): Promise<ActivitySummary> {
    if (events.length === 0) {
      return {
        dominantActivity: 'unknown',
        activityDistribution: {},
        timeSpent: 0,
        focusScore: 0,
        productivityScore: 0,
        energyLevel: 'medium',
        currentProjects: [],
        recentTopics: []
      };
    }

    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recentEvents = events.filter(e => e.timestamp > oneHourAgo);

    // Calculate activity distribution
    const activityTypes = recentEvents.map(e => e.type);
    const distribution = activityTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantActivity = Object.entries(distribution)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

    // Calculate time spent (rough estimate)
    const timeSpent = Math.min(3600000, now - Math.min(...recentEvents.map(e => e.timestamp)));

    // Calculate focus score based on event consistency
    const focusScore = this.calculateFocusScore(recentEvents);

    // Calculate productivity score (simplified)
    const productivityScore = this.calculateProductivityScore(recentEvents);

    // Extract current projects and topics
    const currentProjects = this.extractProjects(recentEvents);
    const recentTopics = this.extractTopics(recentEvents);

    return {
      dominantActivity,
      activityDistribution: distribution,
      timeSpent,
      focusScore,
      productivityScore,
      energyLevel: this.assessEnergyLevel(recentEvents),
      currentProjects,
      recentTopics
    };
  }

  private buildActivityContext(events: EnhancedEvent[]): ActivityContext | undefined {
    if (events.length === 0) return undefined;

    const mostRecent = events[events.length - 1];
    
    return {
      currentUrl: mostRecent.metadata?.url,
      currentTool: this.extractToolFromEvent(mostRecent),
      currentProject: this.extractProjectFromEvent(mostRecent),
      currentWorkflow: this.extractWorkflowFromEvent(mostRecent),
      timeSpent: this.calculateTimeSpent(events),
      recentEvents: events.slice(-10)
    };
  }

  private buildMemoryContext(events: EnhancedEvent[]): MemoryContext | undefined {
    if (events.length === 0) return undefined;

    return {
      sessionId: events[0]?.context?.sessionId || this.generateSessionId(),
      tags: this.extractTags(events),
      relatedEvents: events.map(e => e.id),
      userIntent: this.inferUserIntent(events)
    };
  }

  private calculateFocusScore(events: EnhancedEvent[]): number {
    if (events.length === 0) return 0;

    // Focus score based on consistency of activity type and domain
    const types = events.map(e => e.type);
    const urls = events.map(e => e.metadata?.url).filter(Boolean);
    
    const typeConsistency = this.calculateConsistency(types);
    const domainConsistency = urls.length > 0 ? this.calculateConsistency(urls.map(u => new URL(u).hostname)) : 0;
    
    return (typeConsistency + domainConsistency) / 2;
  }

  private calculateProductivityScore(events: EnhancedEvent[]): number {
    // Simplified productivity scoring
    const productiveTypes = [EventType.CODE, EventType.GITHUB, EventType.EMAIL, EventType.SLACK];
    const productiveEvents = events.filter(e => productiveTypes.includes(e.type));
    
    return events.length > 0 ? productiveEvents.length / events.length : 0;
  }

  private calculateConsistency(items: any[]): number {
    if (items.length === 0) return 0;
    
    const frequency = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const maxFrequency = Math.max(...Object.values(frequency));
    return maxFrequency / items.length;
  }

  private extractProjects(events: EnhancedEvent[]): string[] {
    const projects = new Set<string>();
    
    events.forEach(event => {
      if (event.metadata?.repository) {
        projects.add(event.metadata.repository);
      }
      if (event.metadata?.projectName) {
        projects.add(event.metadata.projectName);
      }
    });
    
    return Array.from(projects);
  }

  private extractTopics(events: EnhancedEvent[]): string[] {
    const topics = new Set<string>();
    
    events.forEach(event => {
      if (event.enrichment?.topics) {
        event.enrichment.topics.forEach(topic => topics.add(topic));
      }
    });
    
    return Array.from(topics);
  }

  private extractToolFromEvent(event: EnhancedEvent): string | undefined {
    switch (event.type) {
      case EventType.BROWSER_TAB: return 'browser';
      case EventType.CODE: return 'code-editor';
      case EventType.EMAIL: return 'email-client';
      case EventType.GITHUB: return 'github';
      case EventType.SLACK: return 'slack';
      case EventType.VS_CODE: return 'vscode';
      case EventType.SYSTEM_APP: return event.metadata.appName;
      default: return undefined;
    }
  }

  private extractProjectFromEvent(event: EnhancedEvent): string | undefined {
    return event.metadata?.repository || event.metadata?.projectName;
  }

  private extractWorkflowFromEvent(event: EnhancedEvent): string | undefined {
    return event.metadata?.workflowId || event.context?.workflowId;
  }

  private calculateTimeSpent(events: EnhancedEvent[]): number {
    if (events.length === 0) return 0;
    
    const oldest = Math.min(...events.map(e => e.timestamp));
    const newest = Math.max(...events.map(e => e.timestamp));
    
    return newest - oldest;
  }

  private extractTags(events: EnhancedEvent[]): string[] {
    const tags = new Set<string>();
    
    events.forEach(event => {
      if (event.context?.tags) {
        event.context.tags.forEach(tag => tags.add(tag));
      }
      // Add type-based tags
      tags.add(event.type.toLowerCase());
    });
    
    return Array.from(tags);
  }

  private inferUserIntent(events: EnhancedEvent[]): string | undefined {
    const recentEvents = events.slice(-5);
    const actions = recentEvents.map(e => e.metadata.action);
    
    if (actions.includes('compose') || actions.includes('write')) {
      return 'create';
    }
    if (actions.includes('search') || actions.includes('find')) {
      return 'research';
    }
    if (actions.includes('read') || actions.includes('view')) {
      return 'consume';
    }
    
    return 'general';
  }

  private assessEnergyLevel(events: EnhancedEvent[]): 'low' | 'medium' | 'high' {
    const now = Date.now();
    const recentEvents = events.filter(e => now - e.timestamp < 1800000); // 30 minutes
    
    if (recentEvents.length < 2) return 'low';
    if (recentEvents.length > 10) return 'high';
    return 'medium';
  }

  private getDefaultUserPreferences() {
    return {
      privacy: {
        localOnly: true,
        dataRetention: '90d' as any,
        anonymizeData: false,
        encryptedBackup: false,
        permissionLevel: 'standard' as any
      },
      notifications: {
        enabled: true,
        frequency: 'immediate' as any,
        types: ['insight', 'connection', 'reminder'],
        quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' },
        soundEnabled: true
      },
      interface: {
        theme: 'auto',
        density: 'normal',
        animations: true,
        language: 'en',
        fontSize: 14,
        shortcuts: {
          openDashboard: 'Ctrl+Shift+S',
          quickCapture: 'Ctrl+Shift+C',
          toggleAssistant: 'Ctrl+Shift+A',
          searchMemory: 'Ctrl+Shift+F'
        }
      },
      integrations: {
        enabled: [],
        connections: [],
        permissions: {}
      },
      assistant: {
        personality: { helpfulness: 0.8, creativity: 0.6, formality: 0.5, verbosity: 0.7 },
        proactivity: 'moderate' as any,
        learningRate: 0.7,
        voiceEnabled: false,
        languageModel: 'default',
        customSkills: []
      }
    };
  }

  private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

class InsightEngine {
  async generateInsights(newEvents: EnhancedEvent[], existingEvents: EnhancedEvent[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Generate different types of insights
    insights.push(...await this.generatePatternInsights(newEvents, existingEvents));
    insights.push(...await this.generateOpportunityInsights(newEvents, existingEvents));
    insights.push(...await this.generateWarningInsights(newEvents, existingEvents));
    insights.push(...await this.generateAchievementInsights(newEvents, existingEvents));
    
    return insights.filter(insight => insight.confidence > 0.5);
  }

  async generatePeriodicInsights(events: EnhancedEvent[], existingInsights: Insight[]): Promise<Insight[]> {
    // Generate insights that don't require new event triggers
    const insights: Insight[] = [];
    
    insights.push(...await this.generateProductivityInsights(events));
    insights.push(...await this.generateFocusInsights(events));
    insights.push(...await this.generateWorkLifeBalanceInsights(events));
    
    return insights;
  }

  private async generatePatternInsights(newEvents: EnhancedEvent[], existingEvents: EnhancedEvent[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    const allEvents = [...existingEvents, ...newEvents];
    
    // Detect time-based patterns
    const timePatterns = this.detectTimePatterns(allEvents);
    timePatterns.forEach(pattern => {
      insights.push({
        id: this.generateInsightId(),
        type: 'pattern',
        title: 'Recurring Activity Pattern',
        description: `You often ${pattern.activity} around ${pattern.time}`,
        confidence: pattern.confidence,
        relevance: 0.7,
        urgency: 0.3,
        category: 'productivity',
        timestamp: Date.now(),
        evidence: pattern.events,
        metadata: { patternType: 'temporal', frequency: pattern.frequency }
      });
    });
    
    return insights;
  }

  private async generateOpportunityInsights(newEvents: EnhancedEvent[], existingEvents: EnhancedEvent[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Look for automation opportunities
    const repetitiveActions = this.findRepetitiveActions(newEvents);
    repetitiveActions.forEach(action => {
      insights.push({
        id: this.generateInsightId(),
        type: 'opportunity',
        title: 'Automation Opportunity',
        description: `You frequently ${action.description}. Consider automating this task.`,
        confidence: action.confidence,
        relevance: 0.8,
        urgency: 0.4,
        category: 'productivity',
        timestamp: Date.now(),
        evidence: action.events,
        actionSuggested: 'Create automation workflow',
        metadata: { actionType: action.type, frequency: action.frequency }
      });
    });
    
    return insights;
  }

  private async generateWarningInsights(newEvents: EnhancedEvent[], existingEvents: EnhancedEvent[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Detect potential burnout signs
    const burnoutSignals = this.detectBurnoutSignals([...existingEvents, ...newEvents]);
    burnoutSignals.forEach(signal => {
      insights.push({
        id: this.generateInsightId(),
        type: 'warning',
        title: 'Potential Burnout Signal',
        description: signal.message,
        confidence: signal.confidence,
        relevance: 0.9,
        urgency: 0.8,
        category: 'wellness',
        timestamp: Date.now(),
        evidence: signal.events,
        actionSuggested: 'Take a break or reduce workload'
      });
    });
    
    return insights;
  }

  private async generateAchievementInsights(newEvents: EnhancedEvent[], existingEvents: EnhancedEvent[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Detect achievements or milestones
    const achievements = this.detectAchievements(newEvents);
    achievements.forEach(achievement => {
      insights.push({
        id: this.generateInsightId(),
        type: 'achievement',
        title: 'Achievement Unlocked',
        description: achievement.description,
        confidence: 0.9,
        relevance: 0.7,
        urgency: 0.2,
        category: 'productivity',
        timestamp: Date.now(),
        evidence: achievement.events
      });
    });
    
    return insights;
  }

  private async generateProductivityInsights(events: EnhancedEvent[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Analyze productivity trends
    const productivityTrend = this.analyzeProductivityTrend(events);
    if (productivityTrend.trend === 'declining') {
      insights.push({
        id: this.generateInsightId(),
        type: 'warning',
        title: 'Productivity Trend',
        description: 'Your productivity has been declining over the past few days.',
        confidence: 0.7,
        relevance: 0.8,
        urgency: 0.6,
        category: 'productivity',
        timestamp: Date.now(),
        evidence: productivityTrend.evidence,
        actionSuggested: 'Review your workflow and consider taking breaks'
      });
    }
    
    return insights;
  }

  private async generateFocusInsights(events: EnhancedEvent[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Analyze focus patterns
    const focusAnalysis = this.analyzeFocusPatterns(events);
    if (focusAnalysis.distractionLevel > 0.7) {
      insights.push({
        id: this.generateInsightId(),
        type: 'warning',
        title: 'High Distraction Level',
        description: 'You\'ve been frequently switching between different activities.',
        confidence: 0.8,
        relevance: 0.9,
        urgency: 0.7,
        category: 'focus',
        timestamp: Date.now(),
        evidence: focusAnalysis.evidence,
        actionSuggested: 'Try time-blocking techniques to improve focus'
      });
    }
    
    return insights;
  }

  private async generateWorkLifeBalanceInsights(events: EnhancedEvent[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Analyze work-life balance
    const balanceAnalysis = this.analyzeWorkLifeBalance(events);
    if (balanceAnalysis.workRatio > 0.8) {
      insights.push({
        id: this.generateInsightId(),
        type: 'warning',
        title: 'Work-Life Balance Concern',
        description: 'You\'ve been spending a lot of time on work-related activities.',
        confidence: 0.7,
        relevance: 0.8,
        urgency: 0.6,
        category: 'wellness',
        timestamp: Date.now(),
        evidence: balanceAnalysis.evidence,
        actionSuggested: 'Schedule personal time and activities'
      });
    }
    
    return insights;
  }

  // Pattern detection methods
  private detectTimePatterns(events: EnhancedEvent[]): Array<{activity: string; time: string; confidence: number; frequency: number; events: EnhancedEvent[]}> {
    // Simplified time pattern detection
    const patterns: Array<{activity: string; time: string; confidence: number; frequency: number; events: EnhancedEvent[]}> = [];
    
    // Group events by hour of day
    const eventsByHour = events.reduce((acc, event) => {
      const hour = new Date(event.timestamp).getHours();
      if (!acc[hour]) acc[hour] = [];
      acc[hour].push(event);
      return acc;
    }, {} as Record<number, EnhancedEvent[]>);
    
    // Look for consistent activities at specific times
    Object.entries(eventsByHour).forEach(([hour, hourEvents]) => {
      if (hourEvents.length >= 3) { // Minimum threshold
        const activityTypes = hourEvents.map(e => e.type);
        const typeFrequency = activityTypes.reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const dominantType = Object.entries(typeFrequency)
          .sort(([,a], [,b]) => b - a)[0];
        
        if (dominantType && dominantType[1] >= 3) {
          patterns.push({
            activity: dominantType[0],
            time: `${hour}:00`,
            confidence: dominantType[1] / hourEvents.length,
            frequency: dominantType[1],
            events: hourEvents
          });
        }
      }
    });
    
    return patterns;
  }

  private findRepetitiveActions(events: EnhancedEvent[]): Array<{description: string; confidence: number; frequency: number; events: EnhancedEvent[]; type: string}> {
    // Look for repetitive metadata actions
    const actionCounts = events.reduce((acc, event) => {
      const action = event.metadata.action;
      if (action) {
        const key = `${event.type}:${action}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(event);
      }
      return acc;
    }, {} as Record<string, EnhancedEvent[]>);
    
    return Object.entries(actionCounts)
      .filter(([, events]) => events.length >= 3)
      .map(([key, events]) => ({
        description: `perform ${key.split(':')[1]} actions in ${key.split(':')[0]}`,
        confidence: Math.min(1, events.length / 5),
        frequency: events.length,
        events,
        type: key.split(':')[0]
      }));
  }

  private detectBurnoutSignals(events: EnhancedEvent[]): Array<{message: string; confidence: number; events: EnhancedEvent[]}> {
    const signals: Array<{message: string; confidence: number; events: EnhancedEvent[]}> = [];
    
    // Check for extended work periods
    const now = Date.now();
    const longWorkSessions = this.findLongWorkSessions(events, now);
    
    if (longWorkSessions.length > 0) {
      signals.push({
        message: 'Extended work sessions detected without breaks',
        confidence: 0.7,
        events: longWorkSessions[0].events
      });
    }
    
    // Check for declining productivity
    const productivityTrend = this.analyzeProductivityTrend(events);
    if (productivityTrend.trend === 'declining') {
      signals.push({
        message: 'Productivity has been declining over time',
        confidence: 0.6,
        events: productivityTrend.evidence
      });
    }
    
    return signals;
  }

  private detectAchievements(events: EnhancedEvent[]): Array<{description: string; events: EnhancedEvent[]}> {
    const achievements: Array<{description: string; events: EnhancedEvent[]}> = [];
    
    // Look for milestone events
    const githubEvents = events.filter(e => e.type === EventType.GITHUB);
    const recentCommits = githubEvents.filter(e => e.metadata.action === 'push');
    
    if (recentCommits.length >= 10) {
      achievements.push({
        description: 'Made 10+ GitHub commits recently',
        events: recentCommits.slice(-10)
      });
    }
    
    const codeEvents = events.filter(e => e.type === EventType.CODE);
    const recentCodeActivity = codeEvents.filter(e => Date.now() - e.timestamp < 86400000); // Last 24 hours
    
    if (recentCodeActivity.length >= 20) {
      achievements.push({
        description: 'High coding activity in the last 24 hours',
        events: recentCodeActivity
      });
    }
    
    return achievements;
  }

  private analyzeProductivityTrend(events: EnhancedEvent[]): {trend: 'improving' | 'declining' | 'stable'; evidence: EnhancedEvent[]} {
    // Simplified productivity trend analysis
    const now = Date.now();
    const dayAgo = now - 86400000;
    const recentEvents = events.filter(e => e.timestamp > dayAgo);
    
    const productiveEvents = recentEvents.filter(e => 
      [EventType.CODE, EventType.GITHUB, EventType.EMAIL].includes(e.type)
    );
    
    const productivityRatio = recentEvents.length > 0 ? productiveEvents.length / recentEvents.length : 0;
    
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (productivityRatio < 0.3) {
      trend = 'declining';
    } else if (productivityRatio > 0.7) {
      trend = 'improving';
    }
    
    return {
      trend,
      evidence: recentEvents
    };
  }

  private analyzeFocusPatterns(events: EnhancedEvent[]): {distractionLevel: number; evidence: EnhancedEvent[]} {
    // Analyze context switching as distraction indicator
    const now = Date.now();
    const hourAgo = now - 3600000;
    const recentEvents = events.filter(e => e.timestamp > hourAgo);
    
    const contextSwitches = this.countContextSwitches(recentEvents);
    const maxSwitches = 20; // Threshold for high distraction
    const distractionLevel = Math.min(1, contextSwitches / maxSwitches);
    
    return {
      distractionLevel,
      evidence: recentEvents
    };
  }

  private analyzeWorkLifeBalance(events: EnhancedEvent[]): {workRatio: number; evidence: EnhancedEvent[]} {
    const now = Date.now();
    const weekAgo = now - 604800000;
    const recentEvents = events.filter(e => e.timestamp > weekAgo);
    
    const workEvents = recentEvents.filter(e => 
      [EventType.CODE, EventType.GITHUB, EventType.EMAIL, EventType.SLACK].includes(e.type)
    );
    
    const workRatio = recentEvents.length > 0 ? workEvents.length / recentEvents.length : 0;
    
    return {
      workRatio,
      evidence: recentEvents
    };
  }

  private findLongWorkSessions(events: EnhancedEvent[], now: number): Array<{start: number; end: number; duration: number; events: EnhancedEvent[]}> {
    // Look for continuous work periods longer than 4 hours
    const workEvents = events.filter(e => 
      [EventType.CODE, EventType.GITHUB, EventType.EMAIL, EventType.SLACK].includes(e.type)
    ).sort((a, b) => a.timestamp - b.timestamp);
    
    const sessions: Array<{start: number; end: number; duration: number; events: EnhancedEvent[]}> = [];
    let currentSession: EnhancedEvent[] = [];
    
    workEvents.forEach((event, index) => {
      if (currentSession.length === 0) {
        currentSession.push(event);
      } else {
        const lastEvent = currentSession[currentSession.length - 1];
        const timeGap = event.timestamp - lastEvent.timestamp;
        
        if (timeGap < 1800000) { // 30 minutes gap threshold
          currentSession.push(event);
        } else {
          // End current session
          if (currentSession.length >= 10) {
            const sessionStart = currentSession[0].timestamp;
            const sessionEnd = currentSession[currentSession.length - 1].timestamp;
            const duration = sessionEnd - sessionStart;
            
            if (duration > 14400000) { // 4 hours
              sessions.push({
                start: sessionStart,
                end: sessionEnd,
                duration,
                events: [...currentSession]
              });
            }
          }
          
          currentSession = [event];
        }
      }
    });
    
    return sessions;
  }

  private countContextSwitches(events: EnhancedEvent[]): number {
    let switches = 0;
    let lastContext = '';
    
    events.forEach(event => {
      const context = `${event.type}:${event.metadata.url || event.metadata.appName || 'unknown'}`;
      if (context !== lastContext && lastContext !== '') {
        switches++;
      }
      lastContext = context;
    });
    
    return switches;
  }

  private generateInsightId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

class PatternDetector {
  async detectPatterns(events: EnhancedEvent[], insights: Insight[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    
    patterns.push(...await this.detectTemporalPatterns(events));
    patterns.push(...await this.detectSemanticPatterns(events));
    patterns.push(...await this.detectBehavioralPatterns(events, insights));
    
    return patterns;
  }

  private async detectTemporalPatterns(events: EnhancedEvent[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    
    // Group events by time patterns
    const hourlyPatterns = this.analyzeHourlyPatterns(events);
    const dailyPatterns = this.analyzeDailyPatterns(events);
    
    patterns.push(...hourlyPatterns, ...dailyPatterns);
    
    return patterns;
  }

  private async detectSemanticPatterns(events: EnhancedEvent[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    
    // Group events by semantic similarity
    const topicPatterns = this.analyzeTopicPatterns(events);
    const workflowPatterns = this.analyzeWorkflowPatterns(events);
    
    patterns.push(...topicPatterns, ...workflowPatterns);
    
    return patterns;
  }

  private async detectBehavioralPatterns(events: EnhancedEvent[], insights: Insight[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    
    // Analyze user behavior patterns
    const interactionPatterns = this.analyzeInteractionPatterns(events);
    const responsePatterns = this.analyzeResponsePatterns(events, insights);
    
    patterns.push(...interactionPatterns, ...responsePatterns);
    
    return patterns;
  }

  private analyzeHourlyPatterns(events: EnhancedEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Group events by hour
    const hourlyData = events.reduce((acc, event) => {
      const hour = new Date(event.timestamp).getHours();
      if (!acc[hour]) acc[hour] = [];
      acc[hour].push(event);
      return acc;
    }, {} as Record<number, EnhancedEvent[]>);
    
    // Look for consistent hourly patterns
    Object.entries(hourlyData).forEach(([hour, hourEvents]) => {
      if (hourEvents.length >= 5) { // Minimum threshold
        const types = hourEvents.map(e => e.type);
        const typeFrequency = types.reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const dominantType = Object.entries(typeFrequency)
          .sort(([,a], [,b]) => b - a)[0];
        
        if (dominantType && dominantType[1] >= 3) {
          patterns.push({
            id: this.generatePatternId(),
            type: 'temporal',
            description: `Consistent ${dominantType[0]} activity around ${hour}:00`,
            frequency: dominantType[1],
            confidence: dominantType[1] / hourEvents.length,
            lastObserved: Math.max(...hourEvents.map(e => e.timestamp)),
            events: hourEvents,
            metadata: { hour: parseInt(hour), type: dominantType[0] }
          });
        }
      }
    });
    
    return patterns;
  }

  private analyzeDailyPatterns(events: EnhancedEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Group events by day of week
    const dailyData = events.reduce((acc, event) => {
      const day = new Date(event.timestamp).getDay();
      if (!acc[day]) acc[day] = [];
      acc[day].push(event);
      return acc;
    }, {} as Record<number, EnhancedEvent[]>);
    
    // Look for consistent daily patterns
    Object.entries(dailyData).forEach(([day, dayEvents]) => {
      if (dayEvents.length >= 10) { // Minimum threshold
        const totalActiveTime = this.calculateActiveTime(dayEvents);
        
        if (totalActiveTime > 14400000) { // More than 4 hours
          patterns.push({
            id: this.generatePatternId(),
            type: 'temporal',
            description: `High activity on ${this.getDayName(parseInt(day))}`,
            frequency: dayEvents.length,
            confidence: 0.7,
            lastObserved: Math.max(...dayEvents.map(e => e.timestamp)),
            events: dayEvents,
            metadata: { day: parseInt(day), activeTime: totalActiveTime }
          });
        }
      }
    });
    
    return patterns;
  }

  private analyzeTopicPatterns(events: EnhancedEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Group events by topics from enrichment
    const topicGroups = events.reduce((acc, event) => {
      if (event.enrichment?.topics) {
        event.enrichment.topics.forEach(topic => {
          if (!acc[topic]) acc[topic] = [];
          acc[topic].push(event);
        });
      }
      return acc;
    }, {} as Record<string, EnhancedEvent[]>);
    
    Object.entries(topicGroups).forEach(([topic, topicEvents]) => {
      if (topicEvents.length >= 5) {
        patterns.push({
          id: this.generatePatternId(),
          type: 'semantic',
          description: `Frequent engagement with ${topic} topic`,
          frequency: topicEvents.length,
          confidence: Math.min(1, topicEvents.length / 10),
          lastObserved: Math.max(...topicEvents.map(e => e.timestamp)),
          events: topicEvents,
          metadata: { topic, eventCount: topicEvents.length }
        });
      }
    });
    
    return patterns;
  }

  private analyzeWorkflowPatterns(events: EnhancedEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Look for common sequences of actions
    const sequences = this.findCommonSequences(events);
    
    sequences.forEach(sequence => {
      if (sequence.frequency >= 3) {
        patterns.push({
          id: this.generatePatternId(),
          type: 'semantic',
          description: `Common workflow: ${sequence.actions.join(' → ')}`,
          frequency: sequence.frequency,
          confidence: sequence.confidence,
          lastObserved: sequence.lastObserved,
          events: sequence.events,
          metadata: { actions: sequence.actions, sequenceLength: sequence.actions.length }
        });
      }
    });
    
    return patterns;
  }

  private analyzeInteractionPatterns(events: EnhancedEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Analyze interaction frequency and timing
    const interactionGaps = this.calculateInteractionGaps(events);
    const avgGap = interactionGaps.reduce((sum, gap) => sum + gap, 0) / interactionGaps.length;
    
    if (avgGap < 60000) { // Less than 1 minute between interactions
      patterns.push({
        id: this.generatePatternId(),
        type: 'behavioral',
        description: 'Rapid interaction pattern detected',
        frequency: events.length,
        confidence: 0.8,
        lastObserved: Math.max(...events.map(e => e.timestamp)),
        events: events,
        metadata: { averageGap: avgGap, interactionCount: events.length }
      });
    }
    
    return patterns;
  }

  private analyzeResponsePatterns(events: EnhancedEvent[], insights: Insight[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Analyze response to insights and suggestions
    const actionableInsights = insights.filter(i => i.actionSuggested);
    
    actionableInsights.forEach(insight => {
      const followUpEvents = events.filter(e => 
        e.timestamp > insight.timestamp && 
        e.timestamp < insight.timestamp + 3600000 // Within 1 hour
      );
      
      if (followUpEvents.length > 0) {
        patterns.push({
          id: this.generatePatternId(),
          type: 'behavioral',
          description: `Responsive to insights: ${insight.title}`,
          frequency: followUpEvents.length,
          confidence: 0.7,
          lastObserved: Math.max(...followUpEvents.map(e => e.timestamp)),
          events: [insight as any, ...followUpEvents], // Type casting needed
          metadata: { insightId: insight.id, responseTime: followUpEvents[0].timestamp - insight.timestamp }
        });
      }
    });
    
    return patterns;
  }

  private calculateActiveTime(events: EnhancedEvent[]): number {
    if (events.length === 0) return 0;
    
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
    const start = sortedEvents[0].timestamp;
    const end = sortedEvents[sortedEvents.length - 1].timestamp;
    
    return end - start;
  }

  private findCommonSequences(events: EnhancedEvent[]): Array<{actions: string[]; frequency: number; confidence: number; lastObserved: number; events: EnhancedEvent[]}> {
    const sequences: Array<{actions: string[]; frequency: number; confidence: number; lastObserved: number; events: EnhancedEvent[]}> = [];
    
    // Look for common 3-event sequences
    for (let i = 0; i < events.length - 2; i++) {
      const sequence = [
        events[i].metadata.action,
        events[i + 1].metadata.action,
        events[i + 2].metadata.action
      ].filter(Boolean);
      
      if (sequence.length === 3) {
        const sequenceKey = sequence.join('→');
        let sequenceData = sequences.find(s => s.actions.join('→') === sequenceKey);
        
        if (!sequenceData) {
          sequenceData = {
            actions: sequence,
            frequency: 0,
            confidence: 0,
            lastObserved: 0,
            events: []
          };
          sequences.push(sequenceData);
        }
        
        sequenceData.frequency++;
        sequenceData.events.push(events[i], events[i + 1], events[i + 2]);
        sequenceData.lastObserved = Math.max(sequenceData.lastObserved, events[i + 2].timestamp);
      }
    }
    
    // Calculate confidence for each sequence
    sequences.forEach(seq => {
      seq.confidence = Math.min(1, seq.frequency / 5);
    });
    
    return sequences.filter(seq => seq.frequency >= 3);
  }

  private calculateInteractionGaps(events: EnhancedEvent[]): number[] {
    const gaps: number[] = [];
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
    
    for (let i = 1; i < sortedEvents.length; i++) {
      gaps.push(sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp);
    }
    
    return gaps;
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }

  private generatePatternId(): string {
    return `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}