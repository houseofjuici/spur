/**
 * Type definitions for Navigation system
 * Optimized for intelligent browsing pattern recognition
 */

export interface NavigationEvent {
  id: string;
  url: string;
  referrer?: string;
  timestamp: number;
  duration?: number;
  type: 'navigation' | 'search' | 'interaction' | 'tab_management';
  metadata?: {
    tabId?: string;
    title?: string;
    category?: string;
    searchTerms?: string[];
  };
}

export interface BrowsingPattern {
  id: string;
  type: 'sequential' | 'temporal' | 'category' | 'search';
  sequence: string;
  frequency: number;
  confidence: number;
  lastSeen: number;
  contexts: PatternContext[];
}

export interface PatternContext {
  timeOfDay: number;
  sessionDuration: number;
  deviceType?: string;
  networkCondition?: string;
}

export interface PatternPrediction {
  targetUrl: string;
  confidence: number;
  type: 'markov' | 'temporal' | 'session' | 'search';
  factors: {
    historical_frequency: number;
    temporal_relevance: number;
    context_similarity: number;
  };
  metadata?: {
    expectedDuration?: number;
    patternFrequency?: number;
    relatedSearches?: string[];
  };
}

export interface NavigationConfig {
  maxHistorySize: number;
  learningRate: number;
  minConfidence: number;
  enablePrediction: boolean;
  adaptiveSampling: boolean;
}