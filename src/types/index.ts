// Core types for Spur Super App

export interface BaseEvent {
  id: string;
  timestamp: number;
  type: EventType;
  source: EventSource;
  metadata: Record<string, any>;
  content?: any;
  context?: MemoryContext;
  priority?: number;
}

export enum EventType {
  BROWSER_TAB = 'browser',
  SYSTEM_APP = 'system',
  EMAIL = 'email',
  CODE = 'code',
  GITHUB = 'github',
  YOUTUBE = 'youtube',
  SLACK = 'slack',
  VS_CODE = 'vscode',
  CUSTOM = 'custom',
}

export enum EventSource {
  BROWSER_EXTENSION = 'extension',
  CONTENT_SCRIPT = 'content',
  BACKGROUND_SERVICE = 'background',
  NATIVE_MESSAGING = 'native',
  WEB_DASHBOARD = 'web',
  MOBILE_APP = 'mobile',
}

export interface MemoryContext {
  sessionId: string;
  workflowId?: string;
  projectId?: string;
  tags: string[];
  relatedEvents: string[];
  userIntent?: string;
}

// Memory Graph Types
export interface MemoryNode {
  id: string;
  type: NodeType;
  timestamp: number;
  content: any;
  metadata: Record<string, any>;
  relationships: MemoryEdge[];
  relevanceScore: number;
  decayFactor: number;
  createdAt: number;
  updatedAt: number;
}

export enum NodeType {
  ACTIVITY = 'activity',
  PATTERN = 'pattern',
  RESOURCE = 'resource',
  CONCEPT = 'concept',
  PROJECT = 'project',
  WORKFLOW = 'workflow',
  EMAIL = 'email',
  CODE = 'code',
  GITHUB = 'github',
  LEARNING = 'learning',
}

export interface MemoryEdge {
  targetId: string;
  type: EdgeType;
  strength: number;
  context: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export enum EdgeType {
  TEMPORAL = 'temporal',
  SEMANTIC = 'semantic',
  CAUSAL = 'causal',
  SPATIAL = 'spatial',
  REFERENCE = 'reference',
  DEPENDENCY = 'dependency',
  ASSOCIATION = 'association',
}

// Assistant Types
export interface AssistantMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  context: AssistantContext;
  metadata?: Record<string, any>;
  skill?: string;
}

export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  NOTIFICATION = 'notification',
  ACTION = 'action',
}

export interface AssistantContext {
  conversationId: string;
  userId: string;
  sessionId: string;
  currentActivity?: ActivityContext;
  memoryContext?: MemoryContext;
  previousMessages: AssistantMessage[];
  userPreferences: UserPreferences;
}

export interface ActivityContext {
  currentUrl?: string;
  currentTool?: string;
  currentProject?: string;
  currentWorkflow?: string;
  timeSpent: number;
  recentEvents: BaseEvent[];
}

// User Types
export interface UserPreferences {
  privacy: PrivacySettings;
  notifications: NotificationSettings;
  interface: InterfaceSettings;
  integrations: IntegrationSettings;
  assistant: AssistantSettings;
}

export interface PrivacySettings {
  localOnly: boolean;
  dataRetention: DataRetention;
  anonymizeData: boolean;
  encryptedBackup: boolean;
  permissionLevel: PermissionLevel;
}

export enum DataRetention {
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
  ONE_YEAR = '1y',
  NEVER = 'never',
}

export enum PermissionLevel {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  ENHANCED = 'enhanced',
  FULL = 'full',
}

export interface NotificationSettings {
  enabled: boolean;
  frequency: NotificationFrequency;
  types: NotificationType[];
  quietHours: QuietHours;
  soundEnabled: boolean;
}

export enum NotificationFrequency {
  IMMEDIATE = 'immediate',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

export type NotificationType = 
  | 'insight'
  | 'connection'
  | 'reminder'
  | 'pattern'
  | 'deadline'
  | 'learning'
  | 'collaboration';

export interface QuietHours {
  enabled: boolean;
  start: string; // HH:mm format
  end: string;   // HH:mm format
  timezone: string;
}

export interface InterfaceSettings {
  theme: 'light' | 'dark' | 'auto';
  density: 'compact' | 'normal' | 'spacious';
  animations: boolean;
  language: string;
  fontSize: number;
  shortcuts: KeyboardShortcuts;
}

export interface KeyboardShortcuts {
  openDashboard: string;
  quickCapture: string;
  toggleAssistant: string;
  searchMemory: string;
}

export interface IntegrationSettings {
  enabled: string[];
  connections: IntegrationConnection[];
  permissions: IntegrationPermissions;
}

export interface IntegrationConnection {
  id: string;
  type: IntegrationType;
  status: ConnectionStatus;
  config: Record<string, any>;
  lastSync?: number;
  error?: string;
}

export enum IntegrationType {
  GMAIL = 'gmail',
  GITHUB = 'github',
  SLACK = 'slack',
  VS_CODE = 'vscode',
  YOUTUBE = 'youtube',
  NOTION = 'notion',
  TODOIST = 'todoist',
  JIRA = 'jira',
  CUSTOM = 'custom',
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  PAUSED = 'paused',
}

export interface IntegrationPermissions {
  [key: string]: {
    read: boolean;
    write: boolean;
    delete: boolean;
    sync: boolean;
  };
}

export interface AssistantSettings {
  personality: AssistantPersonality;
  proactivity: ProactivityLevel;
  learningRate: number;
  voiceEnabled: boolean;
  languageModel: string;
  customSkills: string[];
}

export interface AssistantPersonality {
  helpfulness: number; // 0-1
    creativity: number; // 0-1
    formality: number; // 0-1
    verbosity: number; // 0-1
}

export enum ProactivityLevel {
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  ACTIVE = 'active',
  VERY_ACTIVE = 'very_active',
}

// Database Types
export interface DatabaseConfig {
  type: 'sqlite' | 'dexie' | 'indexeddb';
  version: number;
  name: string;
  schemas: DatabaseSchema[];
}

export interface DatabaseSchema {
  version: number;
  stores: StoreDefinition[];
}

export interface StoreDefinition {
  name: string;
  keyPath: string;
  indexes: IndexDefinition[];
}

export interface IndexDefinition {
  name: string;
  keyPath: string;
  unique?: boolean;
  multiEntry?: boolean;
}

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error Types
export interface SpurError {
  code: ErrorCode;
  message: string;
  details?: any;
  stack?: string;
  timestamp: number;
}

export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  ASSISTANT_ERROR = 'ASSISTANT_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
}

// Feature Flags
export interface FeatureFlags {
  [key: string]: boolean;
}

// Analytics (Privacy-respecting)
export interface AnalyticsEvent {
  type: 'click' | 'view' | 'interaction' | 'error';
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Webhook Types
export interface WebhookEvent {
  id: string;
  type: WebhookType;
  data: any;
  timestamp: number;
  signature?: string;
}

export enum WebhookType {
  MEMORY_UPDATED = 'memory_updated',
  INSIGHT_GENERATED = 'insight_generated',
  INTEGRATION_CONNECTED = 'integration_connected',
  USER_ACTION = 'user_action',
}