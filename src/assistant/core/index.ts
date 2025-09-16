import { MemoryGraph } from '@/memory/graph';
import { UnifiedCaptureEngine } from '@/capture/engine/unified';
import { AssistantContextManager } from '../context';
import { NaturalLanguageProcessor } from '../nlp';
import { SkillManager } from '../skills';
import { VoiceIntegration } from '../voice';
import { ProactiveIntelligenceEngine } from '../proactive';

export interface AssistantConfig {
  nlp: {
    enabled: boolean;
    confidenceThreshold: number;
    maxContextLength: number;
    language: string;
    responseStyle: 'concise' | 'detailed' | 'friendly' | 'professional';
  };
  skills: {
    enabled: boolean;
    autoUpdate: boolean;
    customSkillsPath?: string;
    maxConcurrentSkills: number;
  };
  voice: {
    enabled: boolean;
    language: string;
    voice: string;
    pitch: number;
    rate: number;
    volume: number;
  };
  proactive: {
    enabled: boolean;
    predictionInterval: number; // minutes
    confidenceThreshold: number;
    maxSuggestions: number;
  };
  context: {
    maxHistoryLength: number;
    contextWindow: number;
    memoryWeight: number;
    temporalWeight: number;
  };
  privacy: {
    localProcessing: boolean;
    encryptSensitive: boolean;
    dataRetention: number; // days
    allowAnalytics: boolean;
  };
  performance: {
    maxResponseTime: number; // ms
    cacheResponses: boolean;
    batchProcessing: boolean;
    maxMemoryUsage: number; // MB
  };
}

export interface AssistantMetrics {
  uptime: number;
  totalInteractions: number;
  successfulInteractions: number;
  averageResponseTime: number;
  confidenceScore: number;
  contextAccuracy: number;
  proactiveSuggestions: number;
  acceptedSuggestions: number;
  voiceInteractions: number;
  skillsExecuted: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface AssistantStatus {
  isRunning: boolean;
  isHealthy: boolean;
  components: {
    nlp: 'running' | 'stopped' | 'error';
    skills: 'running' | 'stopped' | 'error';
    voice: 'running' | 'stopped' | 'error';
    proactive: 'running' | 'stopped' | 'error';
    context: 'running' | 'stopped' | 'error';
  };
  metrics: AssistantMetrics;
  alerts: string[];
  capabilities: string[];
}

export interface InteractionContext {
  sessionId: string;
  userId?: string;
  timestamp: number;
  input: string;
  inputType: 'text' | 'voice' | 'command';
  context: any;
  metadata?: any;
}

export interface AssistantResponse {
  id: string;
  sessionId: string;
  content: string;
  confidence: number;
  type: 'text' | 'action' | 'suggestion' | 'error';
  actions?: AssistantAction[];
  suggestions?: string[];
  context?: any;
  metadata?: any;
  processingTime: number;
}

export interface AssistantAction {
  id: string;
  type: string;
  description: string;
  parameters: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number;
  requiresConfirmation: boolean;
}

export class AlwaysOnAssistant {
  private config: AssistantConfig;
  private isInitialized = false;
  private isRunning = false;
  private startTime: number;

  // Core components
  private memoryGraph: MemoryGraph;
  private captureEngine: UnifiedCaptureEngine;
  private contextManager: AssistantContextManager;
  private nlpProcessor: NaturalLanguageProcessor;
  private skillManager: SkillManager;
  private voiceIntegration: VoiceIntegration;
  private proactiveEngine: ProactiveIntelligenceEngine;

  // State management
  private activeSessions: Map<string, any> = new Map();
  private responseCache: Map<string, { response: AssistantResponse; timestamp: number }> = new Map();
  private interactionHistory: Array<InteractionContext & AssistantResponse> = [];

  // Metrics and monitoring
  private metrics: AssistantMetrics;
  private healthCheckInterval?: number;

  // Event handlers
  private interactionHandlers: Set<(context: InteractionContext, response: AssistantResponse) => void> = new Set();
  private suggestionHandlers: Set<(suggestions: string[]) => void> = new Set();
  private errorHandler?: (error: Error) => void;

  constructor(
    memoryGraph: MemoryGraph,
    captureEngine: UnifiedCaptureEngine,
    config: Partial<AssistantConfig> = {}
  ) {
    this.memoryGraph = memoryGraph;
    this.captureEngine = captureEngine;
    this.startTime = Date.now();

    // Initialize configuration
    this.config = {
      nlp: {
        enabled: true,
        confidenceThreshold: 0.7,
        maxContextLength: 4096,
        language: 'en',
        responseStyle: 'friendly'
      },
      skills: {
        enabled: true,
        autoUpdate: true,
        maxConcurrentSkills: 5
      },
      voice: {
        enabled: true,
        language: 'en-US',
        voice: 'default',
        pitch: 1.0,
        rate: 1.0,
        volume: 1.0
      },
      proactive: {
        enabled: true,
        predictionInterval: 5,
        confidenceThreshold: 0.8,
        maxSuggestions: 3
      },
      context: {
        maxHistoryLength: 100,
        contextWindow: 10,
        memoryWeight: 0.6,
        temporalWeight: 0.4
      },
      privacy: {
        localProcessing: true,
        encryptSensitive: true,
        dataRetention: 30,
        allowAnalytics: false
      },
      performance: {
        maxResponseTime: 1000,
        cacheResponses: true,
        batchProcessing: true,
        maxMemoryUsage: 500
      },
      ...config
    };

    this.metrics = this.initializeMetrics();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[AlwaysOnAssistant] Initializing...');

      // Initialize core components
      this.contextManager = new AssistantContextManager(this.config.context, this.memoryGraph);
      await this.contextManager.initialize();

      this.nlpProcessor = new NaturalLanguageProcessor(this.config.nlp);
      await this.nlpProcessor.initialize();

      this.skillManager = new SkillManager(this.config.skills, this.memoryGraph);
      await this.skillManager.initialize();

      this.voiceIntegration = new VoiceIntegration(this.config.voice);
      await this.voiceIntegration.initialize();

      this.proactiveEngine = new ProactiveIntelligenceEngine(
        this.config.proactive,
        this.memoryGraph,
        this.nlpProcessor
      );
      await this.proactiveEngine.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      this.metrics.uptime = Date.now() - this.startTime;
      
      console.log('[AlwaysOnAssistant] Initialized successfully');

    } catch (error) {
      console.error('[AlwaysOnAssistant] Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[AlwaysOnAssistant] Starting...');

      // Start all components
      await Promise.all([
        this.contextManager.start(),
        this.nlpProcessor.start(),
        this.skillManager.start(),
        this.voiceIntegration.start(),
        this.proactiveEngine.start()
      ]);

      this.isRunning = true;
      console.log('[AlwaysOnAssistant] Started successfully');

      // Start proactive suggestions
      if (this.config.proactive.enabled) {
        this.startProactiveSuggestions();
      }

    } catch (error) {
      console.error('[AlwaysOnAssistant] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[AlwaysOnAssistant] Stopping...');

      // Stop all components
      await Promise.all([
        this.contextManager.stop(),
        this.nlpProcessor.stop(),
        this.skillManager.stop(),
        this.voiceIntegration.stop(),
        this.proactiveEngine.stop()
      ]);

      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      this.isRunning = false;
      console.log('[AlwaysOnAssistant] Stopped successfully');

    } catch (error) {
      console.error('[AlwaysOnAssistant] Stop failed:', error);
    }
  }

  async processInput(
    input: string,
    sessionId: string,
    inputType: 'text' | 'voice' | 'command' = 'text',
    context?: any
  ): Promise<AssistantResponse> {
    if (!this.isInitialized) {
      throw new Error('Assistant not initialized');
    }

    const startTime = performance.now();
    const interactionContext: InteractionContext = {
      sessionId,
      timestamp: Date.now(),
      input,
      inputType,
      context: context || {}
    };

    try {
      // Check cache first
      if (this.config.performance.cacheResponses) {
        const cached = this.getCachedResponse(input, sessionId);
        if (cached) {
          return cached;
        }
      }

      // Get or create session context
      const sessionContext = await this.contextManager.getSessionContext(sessionId);

      // Process natural language
      const nlpResult = await this.nlpProcessor.process(input, sessionContext);

      // Generate response using skills and context
      const response = await this.generateResponse(interactionContext, nlpResult, sessionContext);

      // Update metrics
      this.updateMetrics(response, performance.now() - startTime);

      // Cache response
      if (this.config.performance.cacheResponses) {
        this.cacheResponse(input, sessionId, response);
      }

      // Store interaction in memory
      await this.storeInteraction(interactionContext, response);

      // Notify handlers
      this.notifyInteractionHandlers(interactionContext, response);

      return response;

    } catch (error) {
      console.error('[AlwaysOnAssistant] Error processing input:', error);
      
      const errorResponse: AssistantResponse = {
        id: this.generateId(),
        sessionId,
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        confidence: 0,
        type: 'error',
        processingTime: performance.now() - startTime
      };

      this.handleError(error as Error);
      return errorResponse;
    }
  }

  async generateProactiveSuggestions(sessionId: string): Promise<string[]> {
    if (!this.config.proactive.enabled || !this.isRunning) {
      return [];
    }

    try {
      const sessionContext = await this.contextManager.getSessionContext(sessionId);
      const suggestions = await this.proactiveEngine.generateSuggestions(sessionContext);

      this.metrics.proactiveSuggestions++;

      // Notify suggestion handlers
      if (suggestions.length > 0) {
        this.notifySuggestionHandlers(suggestions);
      }

      return suggestions;

    } catch (error) {
      console.error('[AlwaysOnAssistant] Error generating proactive suggestions:', error);
      return [];
    }
  }

  async executeAction(action: AssistantAction, sessionId: string): Promise<boolean> {
    try {
      // Validate action
      if (!this.validateAction(action)) {
        return false;
      }

      // Get session context
      const sessionContext = await this.contextManager.getSessionContext(sessionId);

      // Execute skill-based action
      if (action.type.startsWith('skill:')) {
        const skillName = action.type.substring(6);
        return await this.skillManager.executeSkill(skillName, action.parameters, sessionContext);
      }

      // Execute system action
      return await this.executeSystemAction(action, sessionContext);

    } catch (error) {
      console.error('[AlwaysOnAssistant] Error executing action:', error);
      this.handleError(error as Error);
      return false;
    }
  }

  private async generateResponse(
    interactionContext: InteractionContext,
    nlpResult: any,
    sessionContext: any
  ): Promise<AssistantResponse> {
    const startTime = performance.now();

    // Determine intent and extract entities
    const intent = nlpResult.intent;
    const entities = nlpResult.entities;
    const confidence = nlpResult.confidence;

    // Get contextual information from memory
    const contextualInfo = await this.memoryGraph.getContextualRecommendations(
      sessionContext.sessionId,
      interactionContext.input,
      10
    );

    // Generate response using available skills
    let responseContent = '';
    let actions: AssistantAction[] = [];
    let suggestions: string[] = [];

    if (this.config.skills.enabled && intent) {
      // Try to execute relevant skill
      const skillResult = await this.skillManager.executeRelevantSkill(
        intent,
        entities,
        sessionContext,
        contextualInfo
      );

      if (skillResult.success) {
        responseContent = skillResult.response;
        actions = skillResult.actions || [];
        suggestions = skillResult.suggestions || [];
        this.metrics.skillsExecuted++;
      }
    }

    // Fallback to NLP-based response if no skill executed
    if (!responseContent) {
      responseContent = await this.nlpProcessor.generateResponse(
        intent,
        entities,
        sessionContext,
        contextualInfo,
        this.config.nlp.responseStyle
      );
    }

    // Add proactive suggestions
    if (this.config.proactive.enabled) {
      const proactiveSuggestions = await this.proactiveEngine.generateContextualSuggestions(
        interactionContext.input,
        sessionContext
      );
      suggestions.push(...proactiveSuggestions);
    }

    const response: AssistantResponse = {
      id: this.generateId(),
      sessionId: interactionContext.sessionId,
      content: responseContent,
      confidence: Math.min(confidence, 1.0),
      type: actions.length > 0 ? 'action' : 'text',
      actions: actions.length > 0 ? actions : undefined,
      suggestions: suggestions.length > 0 ? suggestions.slice(0, 3) : undefined,
      context: {
        intent,
        entities,
        contextualInfo: contextualInfo.slice(0, 3)
      },
      processingTime: performance.now() - startTime
    };

    return response;
  }

  private async storeInteraction(
    interaction: InteractionContext,
    response: AssistantResponse
  ): Promise<void> {
    // Store in interaction history
    this.interactionHistory.push({ ...interaction, ...response });

    // Limit history size
    if (this.interactionHistory.length > this.config.context.maxHistoryLength) {
      this.interactionHistory = this.interactionHistory.slice(-this.config.context.maxHistoryLength);
    }

    // Update memory graph with interaction
    try {
      const interactionEvent = {
        id: `interaction_${response.id}`,
        type: 'assistant_interaction',
        timestamp: interaction.timestamp,
        source: 'assistant',
        metadata: {
          sessionId: interaction.sessionId,
          input: interaction.input,
          inputType: interaction.inputType,
          response: response.content,
          confidence: response.confidence,
          processingTime: response.processingTime
        }
      };

      await this.memoryGraph.processEvents([interactionEvent as any]);
      await this.contextManager.updateSessionContext(interaction.sessionId, {
        lastInteraction: interaction.timestamp,
        inputType: interaction.inputType,
        response: response.content
      });
    } catch (error) {
      console.error('[AlwaysOnAssistant] Error storing interaction:', error);
    }
  }

  private setupEventHandlers(): void {
    // Handle voice input
    this.voiceIntegration.onSpeechRecognized(async (text, sessionId) => {
      try {
        await this.processInput(text, sessionId, 'voice');
      } catch (error) {
        console.error('[AlwaysOnAssistant] Error processing voice input:', error);
      }
    });

    // Handle skill execution results
    this.skillManager.onSkillExecuted((result) => {
      console.log('[AlwaysOnAssistant] Skill executed:', result);
    });

    // Handle proactive engine suggestions
    this.proactiveEngine.onSuggestionGenerated((suggestions) => {
      this.notifySuggestionHandlers(suggestions);
    });
  }

  private startProactiveSuggestions(): void {
    // Schedule proactive suggestions
    setInterval(async () => {
      if (this.isRunning) {
        for (const [sessionId] of this.activeSessions) {
          await this.generateProactiveSuggestions(sessionId);
        }
      }
    }, this.config.proactive.predictionInterval * 60000); // Convert to milliseconds
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check component health
      const components = {
        nlp: this.nlpProcessor.isHealthy() ? 'running' : 'error',
        skills: this.skillManager.isHealthy() ? 'running' : 'error',
        voice: this.voiceIntegration.isHealthy() ? 'running' : 'error',
        proactive: this.proactiveEngine.isHealthy() ? 'running' : 'error',
        context: this.contextManager.isHealthy() ? 'running' : 'error'
      };

      // Update metrics
      this.metrics.memoryUsage = this.estimateMemoryUsage();
      this.metrics.cpuUsage = await this.estimateCpuUsage();

      // Check for issues
      const hasErrors = Object.values(components).some(status => status === 'error');
      if (hasErrors) {
        console.warn('[AlwaysOnAssistant] Health check detected issues:', components);
      }

    } catch (error) {
      console.error('[AlwaysOnAssistant] Health check failed:', error);
    }
  }

  private validateAction(action: AssistantAction): boolean {
    return (
      action.id &&
      action.type &&
      action.parameters &&
      action.priority &&
      action.estimatedTime >= 0
    );
  }

  private async executeSystemAction(action: AssistantAction, sessionContext: any): Promise<boolean> {
    switch (action.type) {
      case 'memory_search':
        // Execute memory search
        return true;
      case 'context_update':
        // Update session context
        return true;
      case 'system_command':
        // Execute system command
        return true;
      default:
        return false;
    }
  }

  private getCachedResponse(input: string, sessionId: string): AssistantResponse | null {
    const cacheKey = `${sessionId}:${input}`;
    const cached = this.responseCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      return cached.response;
    }
    
    return null;
  }

  private cacheResponse(input: string, sessionId: string, response: AssistantResponse): void {
    const cacheKey = `${sessionId}:${input}`;
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.responseCache.size > 1000) {
      const oldestKey = this.responseCache.keys().next().value;
      this.responseCache.delete(oldestKey);
    }
  }

  private updateMetrics(response: AssistantResponse, processingTime: number): Promise<void> {
    this.metrics.totalInteractions++;
    
    if (response.type !== 'error') {
      this.metrics.successfulInteractions++;
    }
    
    this.metrics.averageResponseTime = this.updateAverage(
      this.metrics.averageResponseTime,
      processingTime,
      this.metrics.totalInteractions
    );

    this.metrics.confidenceScore = this.updateAverage(
      this.metrics.confidenceScore,
      response.confidence,
      this.metrics.totalInteractions
    );

    if (response.inputType === 'voice') {
      this.metrics.voiceInteractions++;
    }

    return Promise.resolve();
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  private estimateMemoryUsage(): number {
    // Estimate memory usage based on various factors
    const sessionMemory = this.activeSessions.size * 1024; // 1KB per session
    const cacheMemory = this.responseCache.size * 512; // 512B per cache entry
    const historyMemory = this.interactionHistory.length * 1024; // 1KB per interaction
    
    return sessionMemory + cacheMemory + historyMemory;
  }

  private async estimateCpuUsage(): Promise<number> {
    // Simple CPU usage estimation
    return Math.random() * 10; // Placeholder for real implementation
  }

  private notifyInteractionHandlers(interaction: InteractionContext, response: AssistantResponse): void {
    this.interactionHandlers.forEach(handler => {
      try {
        handler(interaction, response);
      } catch (error) {
        console.error('[AlwaysOnAssistant] Error in interaction handler:', error);
      }
    });
  }

  private notifySuggestionHandlers(suggestions: string[]): void {
    this.suggestionHandlers.forEach(handler => {
      try {
        handler(suggestions);
      } catch (error) {
        console.error('[AlwaysOnAssistant] Error in suggestion handler:', error);
      }
    });
  }

  private handleError(error: Error): void {
    this.metrics.errorRate = this.updateAverage(
      this.metrics.errorRate,
      1,
      this.metrics.totalInteractions || 1
    );

    if (this.errorHandler) {
      try {
        this.errorHandler(error);
      } catch (handlerError) {
        console.error('[AlwaysOnAssistant] Error in error handler:', handlerError);
      }
    }
  }

  private initializeMetrics(): AssistantMetrics {
    return {
      uptime: 0,
      totalInteractions: 0,
      successfulInteractions: 0,
      averageResponseTime: 0,
      confidenceScore: 0.5,
      contextAccuracy: 0.8,
      proactiveSuggestions: 0,
      acceptedSuggestions: 0,
      voiceInteractions: 0,
      skillsExecuted: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  private generateId(): string {
    return `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  onInteraction(callback: (context: InteractionContext, response: AssistantResponse) => void): () => void {
    this.interactionHandlers.add(callback);
    return () => this.interactionHandlers.delete(callback);
  }

  onSuggestion(callback: (suggestions: string[]) => void): () => void {
    this.suggestionHandlers.add(callback);
    return () => this.suggestionHandlers.delete(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorHandler = callback;
  }

  getStatus(): AssistantStatus {
    const isHealthy = this.metrics.errorRate < 5 && 
                      this.metrics.confidenceScore > 0.6 &&
                      this.metrics.memoryUsage < this.config.performance.maxMemoryUsage;

    return {
      isRunning: this.isRunning,
      isHealthy,
      components: {
        nlp: this.config.nlp.enabled && this.nlpProcessor ? (this.nlpProcessor.isHealthy() ? 'running' : 'error') : 'stopped',
        skills: this.config.skills.enabled && this.skillManager ? (this.skillManager.isHealthy() ? 'running' : 'error') : 'stopped',
        voice: this.config.voice.enabled && this.voiceIntegration ? (this.voiceIntegration.isHealthy() ? 'running' : 'error') : 'stopped',
        proactive: this.config.proactive.enabled && this.proactiveEngine ? (this.proactiveEngine.isHealthy() ? 'running' : 'error') : 'stopped',
        context: this.contextManager ? (this.contextManager.isHealthy() ? 'running' : 'error') : 'stopped'
      },
      metrics: { ...this.metrics },
      alerts: [],
      capabilities: [
        'text_processing',
        'voice_interaction',
        'skill_execution',
        'proactive_suggestions',
        'context_awareness',
        'memory_augmentation'
      ]
    };
  }

  getMetrics(): AssistantMetrics {
    this.metrics.uptime = Date.now() - this.startTime;
    return { ...this.metrics };
  }

  async createSession(userId?: string): Promise<string> {
    const sessionId = this.generateId();
    this.activeSessions.set(sessionId, {
      userId,
      created: Date.now(),
      lastActivity: Date.now()
    });

    await this.contextManager.createSession(sessionId, userId);
    return sessionId;
  }

  async endSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    await this.contextManager.endSession(sessionId);
  }

  async updateConfig(newConfig: Partial<AssistantConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Update component configurations
    if (this.nlpProcessor) {
      await this.nlpProcessor.updateConfig(this.config.nlp);
    }
    
    if (this.skillManager) {
      await this.skillManager.updateConfig(this.config.skills);
    }
    
    if (this.voiceIntegration) {
      await this.voiceIntegration.updateConfig(this.config.voice);
    }
    
    if (this.proactiveEngine) {
      await this.proactiveEngine.updateConfig(this.config.proactive);
    }
  }

  getConfig(): AssistantConfig {
    return { ...this.config };
  }

  // Voice interaction methods
  async startVoiceInput(sessionId: string): Promise<void> {
    if (!this.config.voice.enabled || !this.voiceIntegration) {
      throw new Error('Voice input is not enabled');
    }
    
    await this.voiceIntegration.startListening(sessionId);
  }

  async stopVoiceInput(): Promise<void> {
    if (this.voiceIntegration) {
      await this.voiceIntegration.stopListening();
    }
  }

  isVoiceActive(): boolean {
    return this.voiceIntegration ? this.voiceIntegration.isListening() : false;
  }

  // Capability checks
  hasCapability(capability: string): boolean {
    const capabilities = {
      'nlp': this.config.nlp.enabled,
      'voice': this.config.voice.enabled,
      'skills': this.config.skills.enabled,
      'proactive': this.config.proactive.enabled,
      'memory': true, // Always available
      'context': true // Always available
    };

    return capabilities[capability as keyof typeof capabilities] || false;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    try {
      // Cleanup all components
      if (this.contextManager) await this.contextManager.cleanup();
      if (this.nlpProcessor) await this.nlpProcessor.cleanup();
      if (this.skillManager) await this.skillManager.cleanup();
      if (this.voiceIntegration) await this.voiceIntegration.cleanup();
      if (this.proactiveEngine) await this.proactiveEngine.cleanup();

      // Clear all data
      this.activeSessions.clear();
      this.responseCache.clear();
      this.interactionHistory = [];
      this.interactionHandlers.clear();
      this.suggestionHandlers.clear();

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      this.isInitialized = false;
      console.log('[AlwaysOnAssistant] Cleanup completed');

    } catch (error) {
      console.error('[AlwaysOnAssistant] Cleanup failed:', error);
    }
  }
}