import { BaseEvent, EventType, EventSource, MemoryContext } from '@/types';

// Enhanced event types for comprehensive activity capture
export interface BrowserTabEvent extends BaseEvent {
  type: EventType.BROWSER_TAB;
  metadata: BrowserTabMetadata;
  content?: BrowserTabContent;
}

export interface BrowserTabMetadata {
  action: 'navigation' | 'focus' | 'close' | 'selection' | 'analyze' | 'connect_workflow' | 'quick_capture' | 'scroll' | 'click' | 'form_submit';
  tabId?: number;
  windowId?: number;
  url?: string;
  title?: string;
  referrer?: string;
  domain?: string;
  path?: string;
  query?: string;
  scrollPosition?: number;
  scrollPercentage?: number;
  elementClicked?: string;
  formFields?: Record<string, any>;
  selectionLength?: number;
  selectionPreview?: string;
  contentLength?: number;
  wordCount?: number;
  readingTime?: number;
  loadTime?: number;
}

export interface BrowserTabContent {
  type: 'selection' | 'page_analysis' | 'form_data' | 'click_context';
  text?: string;
  html?: string;
  structuredData?: any;
  formValues?: Record<string, any>;
  elementInfo?: {
    tagName: string;
    className?: string;
    id?: string;
    text?: string;
  };
}

export interface SystemAppEvent extends BaseEvent {
  type: EventType.SYSTEM_APP;
  metadata: SystemAppMetadata;
  content?: SystemAppContent;
}

export interface SystemAppMetadata {
  action: 'launch' | 'focus' | 'close' | 'minimize' | 'maximize' | 'switch' | 'interaction';
  appName: string;
  appPath?: string;
  windowTitle?: string;
  processId?: number;
  windowId?: number;
  duration?: number;
  interactionType?: 'keyboard' | 'mouse' | 'touch' | 'voice';
  documentPath?: string;
  documentName?: string;
}

export interface SystemAppContent {
  type: 'window_state' | 'document_content' | 'interaction_log';
  text?: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  interactionData?: {
    type: string;
    target: string;
    value?: any;
    timestamp: number;
  }[];
}

export interface EmailEvent extends BaseEvent {
  type: EventType.EMAIL;
  metadata: EmailMetadata;
  content?: EmailContent;
}

export interface EmailMetadata {
  action: 'receive' | 'send' | 'read' | 'reply' | 'forward' | 'delete' | 'archive' | 'star' | 'label';
  provider: 'gmail' | 'outlook' | 'imap' | 'exchange';
  emailId?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  labels?: string[];
  folder?: string;
  priority?: 'normal' | 'high' | 'low';
  hasAttachments?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  responseTime?: number;
}

export interface EmailContent {
  type: 'full' | 'summary' | 'attachments';
  body?: string;
  html?: string;
  plainText?: string;
  summary?: string;
  attachments?: EmailAttachment[];
  extractedLinks?: string[];
  extractedEntities?: {
    emails?: string[];
    phones?: string[];
    urls?: string[];
    dates?: string[];
  };
}

export interface EmailAttachment {
  filename: string;
  size: number;
  mimeType: string;
  attachmentId?: string;
}

export interface CodeEvent extends BaseEvent {
  type: EventType.CODE;
  metadata: CodeMetadata;
  content?: CodeContent;
}

export interface CodeMetadata {
  action: 'edit' | 'save' | 'compile' | 'run' | 'debug' | 'test' | 'commit' | 'review' | 'refactor';
  language: string;
  filePath?: string;
  fileName?: string;
  projectName?: string;
  repository?: string;
  branch?: string;
  lineStart?: number;
  lineEnd?: number;
  changeType?: 'add' | 'remove' | 'modify';
  symbol?: string;
  function?: string;
  class?: string;
  method?: string;
  isTest?: boolean;
  testResult?: 'pass' | 'fail' | 'error' | 'skipped';
  testDuration?: number;
}

export interface CodeContent {
  type: 'diff' | 'full' | 'snippet' | 'error' | 'output';
  code?: string;
  diff?: string;
  snippet?: string;
  error?: string;
  output?: string;
  syntaxTree?: any;
  ast?: any;
  dependencies?: string[];
  imports?: string[];
  exports?: string[];
}

export interface GitHubEvent extends BaseEvent {
  type: EventType.GITHUB;
  metadata: GitHubMetadata;
  content?: GitHubContent;
}

export interface GitHubMetadata {
  action: 'push' | 'pull_request' | 'issue' | 'comment' | 'review' | 'merge' | 'fork' | 'star' | 'watch' | 'release';
  repository: string;
  owner: string;
  branch?: string;
  commitHash?: string;
  pullRequestNumber?: number;
  issueNumber?: number;
  commentId?: string;
  releaseTag?: string;
  userAction?: string;
  state?: 'open' | 'closed' | 'merged' | 'draft';
  isPrivate?: boolean;
  language?: string;
  starCount?: number;
  forkCount?: number;
  contributorCount?: number;
}

export interface GitHubContent {
  type: 'commit' | 'pr_description' | 'issue_body' | 'comment' | 'review_comment' | 'release_notes';
  title?: string;
  body?: string;
  diff?: string;
  filesChanged?: string[];
  additions?: number;
  deletions?: number;
  reviewers?: string[];
  assignees?: string[];
  labels?: string[];
  milestones?: string[];
  relatedIssues?: string[];
}

export interface YouTubeEvent extends BaseEvent {
  type: EventType.YOUTUBE;
  metadata: YouTubeMetadata;
  content?: YouTubeContent;
}

export interface YouTubeMetadata {
  action: 'watch' | 'pause' | 'resume' | 'seek' | 'change_quality' | 'change_speed' | 'comment' | 'like' | 'dislike' | 'share' | 'playlist_add';
  videoId?: string;
  videoTitle?: string;
  channelId?: string;
  channelName?: string;
  duration?: number;
  currentTime?: number;
  quality?: string;
  playbackSpeed?: number;
  isLive?: boolean;
  isPremiere?: boolean;
  category?: string;
  tags?: string[];
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  playlistId?: string;
  playlistPosition?: number;
}

export interface YouTubeContent {
  type: 'transcript' | 'captions' | 'description' | 'comments' | 'metadata';
  transcript?: string;
  captions?: string;
  description?: string;
  comments?: YouTubeComment[];
  thumbnailUrl?: string;
  chapters?: YouTubeChapter[];
}

export interface YouTubeComment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
  likeCount?: number;
  isReply?: boolean;
  parentId?: string;
}

export interface YouTubeChapter {
  title: string;
  startTime: number;
  endTime: number;
}

export interface SlackEvent extends BaseEvent {
  type: EventType.SLACK;
  metadata: SlackMetadata;
  content?: SlackContent;
}

export interface SlackMetadata {
  action: 'message' | 'reaction' | 'channel_join' | 'channel_leave' | 'thread_reply' | 'file_share' | 'mention' | 'status_change';
  workspace: string;
  channelId?: string;
  channelName?: string;
  userId?: string;
  userName?: string;
  messageId?: string;
  threadId?: string;
  reaction?: string;
  fileType?: string;
  mentionType?: 'direct' | 'channel' | 'here';
  status?: string;
  isBot?: boolean;
  isEdited?: boolean;
}

export interface SlackContent {
  type: 'message' | 'file' | 'reaction' | 'status';
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  reactions?: { emoji: string; count: number; users: string[] }[];
  mentions?: string[];
  links?: string[];
  attachments?: SlackAttachment[];
}

export interface SlackAttachment {
  id: string;
  title: string;
  text?: string;
  fallback?: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title_link?: string;
  fields?: { title: string; value: string; short: boolean }[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  ts?: number;
}

export interface VSCodeEvent extends BaseEvent {
  type: EventType.VS_CODE;
  metadata: VSCodeMetadata;
  content?: VSCodeContent;
}

export interface VSCodeMetadata {
  action: 'open_file' | 'save_file' | 'close_file' | 'switch_file' | 'edit' | 'debug_start' | 'debug_stop' | 'debug_breakpoint' | 'run_command' | 'extension_install' | 'extension_uninstall' | 'settings_change';
  filePath?: string;
  fileName?: string;
  workspace?: string;
  projectName?: string;
  lineNumber?: number;
  columnNumber?: number;
  command?: string;
  extensionId?: string;
  extensionName?: string;
  settingKey?: string;
  settingValue?: any;
  debugSessionId?: string;
  breakpointId?: string;
  isDirty?: boolean;
  language?: string;
}

export interface VSCodeContent {
  type: 'file_content' | 'diff' | 'settings' | 'output' | 'error';
  content?: string;
  diff?: string;
  settings?: Record<string, any>;
  output?: string;
  error?: string;
  diagnostics?: VSCodeDiagnostic[];
}

export interface VSCodeDiagnostic {
  severity: 'error' | 'warning' | 'information' | 'hint';
  message: string;
  line: number;
  column: number;
  source?: string;
  code?: string;
}

export interface CustomEvent extends BaseEvent {
  type: EventType.CUSTOM;
  metadata: CustomMetadata;
  content?: any;
}

export interface CustomMetadata {
  action: string;
  category: string;
  provider: string;
  customFields?: Record<string, any>;
  version?: string;
  tags?: string[];
}

// Event processing and quality metrics
export interface EventQuality {
  confidence: number; // 0-1 confidence score
  completeness: number; // 0-1 completeness score
  accuracy: number; // 0-1 accuracy score
  latency: number; // processing time in ms
  validationErrors?: string[];
  enrichmentScore?: number; // 0-1 enrichment score
}

export interface ProcessingMetadata {
  processedAt: number;
  processedBy: string;
  processingVersion: string;
  quality: EventQuality;
  enrichment?: {
    entities?: any[];
    sentiment?: number;
    topics?: string[];
    keywords?: string[];
    summary?: string;
  };
  privacy?: {
    piiDetected: boolean;
    sensitiveData?: string[];
    anonymizedFields?: string[];
  };
}

// Enhanced event with processing metadata
export interface EnhancedEvent extends BaseEvent {
  processing?: ProcessingMetadata;
  quality?: EventQuality;
  enrichment?: {
    entities?: any[];
    sentiment?: number;
    topics?: string[];
    keywords?: string[];
    summary?: string;
    category?: string;
    urgency?: number;
  };
}

// Event batch for efficient processing
export interface EventBatch {
  id: string;
  timestamp: number;
  events: EnhancedEvent[];
  source: EventSource;
  batchSize: number;
  estimatedSize: number;
  priority?: number;
}

// Event filters for selective capture
export interface EventFilter {
  types?: EventType[];
  sources?: EventSource[];
  domains?: string[];
  apps?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
  keywords?: string[];
  excludeKeywords?: string[];
  minConfidence?: number;
  maxLatency?: number;
  privacyLevel?: 'minimal' | 'standard' | 'enhanced';
}

// Rate limiting configuration
export interface RateLimitConfig {
  maxEventsPerSecond: number;
  maxEventsPerMinute: number;
  maxEventsPerHour: number;
  burstSize: number;
  cooldownPeriod: number;
  adaptiveLimiting: boolean;
  priorityThresholds: {
    high: number;
    medium: number;
    low: number;
  };
}

// Debouncing configuration
export interface DebounceConfig {
  enabled: boolean;
  defaultDelay: number;
  actionDelays: Record<string, number>;
  maxDelay: number;
  mergeSimilar: boolean;
  mergeWindow: number;
  keyGeneration: 'simple' | 'advanced';
}

// Type guards for event validation
export function isBrowserTabEvent(event: BaseEvent): event is BrowserTabEvent {
  return event.type === EventType.BROWSER_TAB;
}

export function isSystemAppEvent(event: BaseEvent): event is SystemAppEvent {
  return event.type === EventType.SYSTEM_APP;
}

export function isEmailEvent(event: BaseEvent): event is EmailEvent {
  return event.type === EventType.EMAIL;
}

export function isCodeEvent(event: BaseEvent): event is CodeEvent {
  return event.type === EventType.CODE;
}

export function isGitHubEvent(event: BaseEvent): event is GitHubEvent {
  return event.type === EventType.GITHUB;
}

export function isYouTubeEvent(event: BaseEvent): event is YouTubeEvent {
  return event.type === EventType.YOUTUBE;
}

export function isSlackEvent(event: BaseEvent): event is SlackEvent {
  return event.type === EventType.SLACK;
}

export function isVSCodeEvent(event: BaseEvent): event is VSCodeEvent {
  return event.type === EventType.VS_CODE;
}

export function isCustomEvent(event: BaseEvent): event is CustomEvent {
  return event.type === EventType.CUSTOM;
}

// Event type utility functions
export function getEventPriority(event: BaseEvent): number {
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

export function estimateEventSize(event: BaseEvent): number {
  // Rough estimate of event size in bytes
  const jsonSize = JSON.stringify(event).length;
  return jsonSize * 2; // Account for in-memory overhead
}

export function getEventCategory(event: BaseEvent): string {
  const categoryMap = {
    [EventType.EMAIL]: 'communication',
    [EventType.CODE]: 'development',
    [EventType.GITHUB]: 'development',
    [EventType.SLACK]: 'communication',
    [EventType.SYSTEM_APP]: 'system',
    [EventType.BROWSER_TAB]: 'web',
    [EventType.YOUTUBE]: 'media',
    [EventType.VS_CODE]: 'development',
    [EventType.CUSTOM]: 'custom',
  };
  
  return categoryMap[event.type] || 'unknown';
}