// Core types for Chrome extension
export interface MemoryNode {
  id: string;
  content: string;
  type: 'voice' | 'text' | 'email' | 'bookmark' | 'note';
  timestamp: string;
  metadata: {
    source: string;
    [key: string]: any;
  };
  connections: string[]; // IDs of connected memories
  tags: string[];
  embeddings?: number[]; // For semantic search
}

export interface SpurConfig {
  darkMode: boolean;
  historySize: number;
  dataRetentionDays: number;
  autoSync: boolean;
  syncInterval: number;
  voiceCommands: boolean;
  notifications: boolean;
  gmailIntegration: boolean;
  apiUrl: string;
  apiKey: string;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors?: string[];
  timestamp: string;
}

// Chrome extension specific types
export interface ChromeMessage {
  type: string;
  payload?: any;
  timestamp: string;
  source: 'background' | 'popup' | 'content' | 'options';
}

export interface VoiceRecording {
  id: string;
  audioBlob: Blob;
  transcript: string;
  timestamp: string;
  duration: number;
  confidence?: number;
}

export interface EmailData {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  threadId: string;
  labels: string[];
}

// Background service state
export interface BackgroundState {
  isRecording: boolean;
  currentRecording?: VoiceRecording;
  memories: MemoryNode[];
  config: SpurConfig;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime?: string;
}

// Context menu items
export interface ContextMenuItem {
  id: string;
  title: string;
  contexts: chrome.contextMenus.ContextType[];
  parentId?: string;
}

// Command types
export interface Command {
  name: string;
  description: string;
  shortcut?: string;
}

// Notification options
export interface NotificationOptions {
  type: chrome.notifications.TemplateType;
  iconUrl: string;
  title: string;
  message: string;
  priority?: number;
  silent?: boolean;
}

// Storage keys
export const STORAGE_KEYS = {
  SPUR_CONFIG: 'spurConfig',
  SPUR_STATE: 'spurState',
  MEMORIES: 'memories',
  SYNC_STATUS: 'syncStatus'
} as const;

// Message types
export const MESSAGE_TYPES = {
  SYNC_REQUEST: 'SYNC_REQUEST',
  SYNC_RESPONSE: 'SYNC_RESPONSE',
  MEMORY_UPDATE: 'MEMORY_UPDATE',
  ERROR: 'ERROR',
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  GET_STATE: 'GET_STATE',
  UPDATE_CONFIG: 'UPDATE_CONFIG',
  ADD_MEMORY: 'ADD_MEMORY',
  DELETE_MEMORY: 'DELETE_MEMORY',
  CLEAR_MEMORIES: 'CLEAR_MEMORIES',
  EXPORT_DATA: 'EXPORT_DATA',
  IMPORT_DATA: 'IMPORT_DATA',
  SPUR_GMAIL_ACTION: 'SPUR_GMAIL_ACTION'
} as const;

// Event types
export interface MemoryUpdateEvent {
  type: 'memory_added' | 'memory_deleted' | 'memory_updated' | 'config_change' | 'sync_started' | 'sync_completed' | 'data_imported' | 'recording_started' | 'recording_stopped';
  memory?: MemoryNode;
  config?: SpurConfig;
  syncedCount?: number;
  lastSync?: string;
  importCount?: number;
}

// Error types
export interface SpurError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: SpurError;
  timestamp: string;
}

// Search and filter types
export interface MemorySearchOptions {
  query?: string;
  type?: MemoryNode['type'];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  limit?: number;
  offset?: number;
}

export interface MemorySearchResult {
  memories: MemoryNode[];
  totalCount: number;
  hasMore: boolean;
}

// Import/Export types
export interface ExportData {
  memories: MemoryNode[];
  config: SpurConfig;
  exportTime: string;
  version: string;
}

// Performance monitoring types
export interface PerformanceMetrics {
  memoryUsage: number;
  syncTime: number;
  recordingDuration: number;
  errorCount: number;
  timestamp: string;
}

// Audio processing types
export interface AudioProcessingOptions {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  maxDuration: number;
}

export interface AudioAnalysisResult {
  duration: number;
  sampleRate: number;
  channels: number;
  fileSize: number;
  format: string;
  confidence?: number;
}

// Gmail integration types
export interface GmailIntegrationConfig {
  enabled: boolean;
  autoCapture: boolean;
  highlightMode: boolean;
  saveAttachments: boolean;
  extractTasks: boolean;
}

export interface GmailSearchQuery {
  query: string;
  labels?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  sender?: string;
  hasAttachments?: boolean;
}

export interface GmailSearchResult {
  emails: EmailData[];
  totalCount: number;
  hasMore: boolean;
  nextPageToken?: string;
}

// Voice command types
export interface VoiceCommand {
  phrase: string;
  action: string;
  parameters?: Record<string, any>;
  confidence: number;
}

export interface VoiceCommandResult {
  command: VoiceCommand;
  success: boolean;
  result?: any;
  error?: string;
}

// UI component types
export interface PopupState {
  activeTab: 'capture' | 'memories' | 'settings';
  isRecording: boolean;
  memories: MemoryNode[];
  searchQuery: string;
  selectedMemory?: MemoryNode;
}

export interface OptionsPageState {
  activeSection: string;
  config: SpurConfig;
  hasChanges: boolean;
  testResults: {
    api: boolean;
    storage: boolean;
    gmail: boolean;
  };
}

// Theme types
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
    };
  };
}

// Analytics types
export interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: string;
  userId?: string;
}

export interface UsageStats {
  totalMemories: number;
  recordingsCount: number;
  syncCount: number;
  lastActive: string;
  version: string;
}

// Webhook types
export interface WebhookConfig {
  url: string;
  events: string[];
  headers?: Record<string, string>;
  enabled: boolean;
}

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
  userId?: string;
}

// Extension metadata
export interface ExtensionMetadata {
  version: string;
  name: string;
  description: string;
  author: string;
  homepage: string;
  permissions: string[];
  host_permissions: string[];
  icons: Record<string, string>;
}