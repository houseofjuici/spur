import { EventEmitter } from 'events';
import { AlwaysOnAssistant } from '../core';

/**
 * Inbox Zero Email Processing Engine
 * Implements intelligent email management and inbox zero principles
 */
export interface EmailAccount {
  id: string;
  name: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'imap' | 'exchange';
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    username?: string;
    password?: string;
    server?: string;
    port?: number;
    ssl?: boolean;
  };
  settings: {
    syncFrequency: number; // minutes
    maxEmailsToSync: number;
    enableNotifications: boolean;
    autoArchive: boolean;
    categories: EmailCategory[];
  };
}

export interface EmailCategory {
  id: string;
  name: string;
  color: string;
  rules: CategoryRule[];
  priority: number;
  autoArchive: boolean;
}

export interface CategoryRule {
  type: 'sender' | 'subject' | 'body' | 'attachments' | 'time';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
  value: string;
  action: 'categorize' | 'archive' | 'star' | 'important' | 'delete';
}

export interface Email {
  id: string;
  messageId: string;
  threadId: string;
  accountId: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  body: {
    text: string;
    html: string;
  };
  attachments: EmailAttachment[];
  headers: Record<string, string>;
  date: Date;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isArchived: boolean;
  categories: string[];
  labels: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  size: number;
  folder: string;
}

export interface EmailAddress {
  name: string;
  email: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  inline: boolean;
}

export interface InboxZeroConfig {
  enabled: boolean;
  autoProcess: boolean;
  processingSchedule: {
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    daysOfWeek: number[]; // 0-6 for Sunday-Saturday
  };
  categories: EmailCategory[];
  rules: ProcessingRule[];
  actions: ProcessingAction[];
  privacy: {
    storeLocally: boolean;
    encryptContent: boolean;
    retentionPeriod: number; // days
    allowAssistantAnalysis: boolean;
  };
}

export interface ProcessingRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}

export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'attachments' | 'time' | 'size';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than';
  value: string | number;
  caseSensitive: boolean;
}

export interface RuleAction {
  type: 'categorize' | 'archive' | 'star' | 'mark_read' | 'forward' | 'reply' | 'delete';
  parameters: Record<string, any>;
}

export interface ProcessingAction {
  id: string;
  name: string;
  type: 'auto_reply' | 'categorization' | 'archival' | 'summarization' | 'priority_setting';
  template?: string;
  conditions: ProcessingCondition[];
}

export interface ProcessingCondition {
  field: 'sender_type' | 'email_content' | 'time_received' | 'attachment_count' | 'priority';
  operator: string;
  value: string | number;
}

export interface ProcessingResult {
  emailId: string;
  actionsApplied: string[];
  categoriesApplied: string[];
  prioritySet: string;
  responseGenerated?: string;
  timeProcessed: number;
  success: boolean;
  error?: string;
}

export class InboxZeroEngine extends EventEmitter {
  private config: InboxZeroConfig;
  private isInitialized = false;
  private isRunning = false;

  // Core dependencies
  private assistant: AlwaysOnAssistant | null = null;

  // Email accounts
  private accounts: Map<string, EmailAccount> = new Map();
  private emails: Map<string, Email> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Processing engine
  private processingQueue: Email[] = [];
  private isProcessing = false;
  private processingStats = {
    totalProcessed: 0,
    autoCategorized: 0,
    autoArchived: 0,
    autoReplied: 0,
    averageProcessingTime: 0,
    errors: 0
  };

  // Built-in categories and rules
  private defaultCategories: EmailCategory[] = [
    {
      id: 'primary',
      name: 'Primary',
      color: '#4285f4',
      priority: 1,
      autoArchive: false,
      rules: [
        {
          type: 'sender',
          operator: 'contains',
          value: 'no-reply',
          action: 'archive'
        }
      ]
    },
    {
      id: 'social',
      name: 'Social',
      color: '#34a853',
      priority: 3,
      autoArchive: true,
      rules: [
        {
          type: 'sender',
          operator: 'contains',
          value: 'facebook',
          action: 'categorize'
        },
        {
          type: 'sender',
          operator: 'contains',
          value: 'twitter',
          action: 'categorize'
        },
        {
          type: 'sender',
          operator: 'contains',
          value: 'linkedin',
          action: 'categorize'
        }
      ]
    },
    {
      id: 'promotions',
      name: 'Promotions',
      color: '#fbbc04',
      priority: 4,
      autoArchive: true,
      rules: [
        {
          type: 'subject',
          operator: 'contains',
          value: 'discount',
          action: 'categorize'
        },
        {
          type: 'subject',
          operator: 'contains',
          value: 'sale',
          action: 'categorize'
        }
      ]
    },
    {
      id: 'work',
      name: 'Work',
      color: '#ea4335',
      priority: 1,
      autoArchive: false,
      rules: []
    },
    {
      id: 'important',
      name: 'Important',
      color: '#9c27b0',
      priority: 0,
      autoArchive: false,
      rules: [
        {
          type: 'subject',
          operator: 'contains',
          value: 'urgent',
          action: 'important'
        },
        {
          type: 'subject',
          operator: 'contains',
          value: 'important',
          action: 'important'
        }
      ]
    },
    {
      id: 'newsletters',
      name: 'Newsletters',
      color: '#ff9800',
      priority: 5,
      autoArchive: true,
      rules: [
        {
          type: 'subject',
          operator: 'contains',
          value: 'newsletter',
          action: 'categorize'
        },
        {
          type: 'subject',
          operator: 'contains',
          value: 'digest',
          action: 'categorize'
        }
      ]
    }
  ];

  private defaultRules: ProcessingRule[] = [
    {
      id: 'auto-respond-out-of-office',
      name: 'Auto-respond to out-of-office',
      description: 'Detect and categorize out-of-office responses',
      conditions: [
        {
          field: 'subject',
          operator: 'contains',
          value: 'out of office',
          caseSensitive: false
        },
        {
          field: 'body',
          operator: 'contains',
          value: 'out of office',
          caseSensitive: false
        }
      ],
      actions: [
        {
          type: 'categorize',
          parameters: { category: 'primary' }
        },
        {
          type: 'archive',
          parameters: {}
        }
      ],
      priority: 1,
      enabled: true
    },
    {
      id: 'mark-urgent-as-important',
      name: 'Mark urgent emails as important',
      description: 'Automatically mark emails with urgent keywords as important',
      conditions: [
        {
          field: 'subject',
          operator: 'contains',
          value: 'urgent',
          caseSensitive: false
        }
      ],
      actions: [
        {
          type: 'mark_read',
          parameters: {}
        },
        {
          type: 'star',
          parameters: {}
        }
      ],
      priority: 0,
      enabled: true
    }
  ];

  constructor(config: InboxZeroConfig) {
    super();
    this.config = config;
    
    // Initialize with default categories if none provided
    if (!this.config.categories || this.config.categories.length === 0) {
      this.config.categories = [...this.defaultCategories];
    }
    
    // Initialize with default rules if none provided
    if (!this.config.rules || this.config.rules.length === 0) {
      this.config.rules = [...this.defaultRules];
    }
  }

  async initialize(assistant: AlwaysOnAssistant): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[InboxZeroEngine] Initializing...');

      // Store dependencies
      this.assistant = assistant;

      // Load saved accounts and settings
      await this.loadAccounts();
      await this.loadSettings();

      // Set up event listeners
      this.setupEventListeners();

      // Initialize email processing if auto-process is enabled
      if (this.config.autoProcess) {
        await this.setupAutoProcessing();
      }

      this.isInitialized = true;
      console.log('[InboxZeroEngine] Initialized successfully');

      this.emit('initialized');

    } catch (error) {
      console.error('[InboxZeroEngine] Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[InboxZeroEngine] Starting...');

      // Start syncing for all accounts
      for (const [accountId, account] of this.accounts) {
        await this.startSync(accountId);
      }

      // Start processing queue
      this.startProcessing();

      this.isRunning = true;
      console.log('[InboxZeroEngine] Started successfully');

      this.emit('started');

    } catch (error) {
      console.error('[InboxZeroEngine] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[InboxZeroEngine] Stopping...');

      // Stop all sync intervals
      for (const [accountId, interval] of this.syncIntervals) {
        clearInterval(interval);
        this.syncIntervals.delete(accountId);
      }

      // Stop processing
      this.isProcessing = false;

      // Save settings
      await this.saveSettings();

      this.isRunning = false;
      console.log('[InboxZeroEngine] Stopped successfully');

      this.emit('stopped');

    } catch (error) {
      console.error('[InboxZeroEngine] Stop failed:', error);
      throw error;
    }
  }

  async addAccount(account: Omit<EmailAccount, 'id'>): Promise<string> {
    const accountId = this.generateId('account');
    const newAccount: EmailAccount = {
      ...account,
      id: accountId
    };

    this.accounts.set(accountId, newAccount);
    
    // Save accounts
    await this.saveAccounts();

    // Start sync if engine is running
    if (this.isRunning) {
      await this.startSync(accountId);
    }

    console.log(`[InboxZeroEngine] Added account: ${account.name}`);
    this.emit('accountAdded', newAccount);

    return accountId;
  }

  async removeAccount(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Stop sync if running
    if (this.syncIntervals.has(accountId)) {
      clearInterval(this.syncIntervals.get(accountId));
      this.syncIntervals.delete(accountId);
    }

    // Remove emails for this account
    for (const [emailId, email] of this.emails) {
      if (email.accountId === accountId) {
        this.emails.delete(emailId);
      }
    }

    // Remove account
    this.accounts.delete(accountId);
    
    // Save accounts
    await this.saveAccounts();

    console.log(`[InboxZeroEngine] Removed account: ${account.name}`);
    this.emit('accountRemoved', accountId);
  }

  async processEmail(email: Email): Promise<ProcessingResult> {
    const startTime = performance.now();
    this.processingStats.totalProcessed++;

    try {
      console.log(`[InboxZeroEngine] Processing email: ${email.subject}`);

      const actionsApplied: string[] = [];
      const categoriesApplied: string[] = [];
      let prioritySet: string = email.priority;
      let responseGenerated: string | undefined;

      // Apply processing rules
      for (const rule of this.config.rules.filter(r => r.enabled)) {
        if (this.evaluateRuleConditions(rule.conditions, email)) {
          for (const action of rule.actions) {
            const result = await this.executeRuleAction(action, email);
            if (result.success) {
              actionsApplied.push(action.type);
              if (result.category) {
                categoriesApplied.push(result.category);
              }
              if (result.priority) {
                prioritySet = result.priority;
              }
              if (result.response) {
                responseGenerated = result.response;
              }
            }
          }
        }
      }

      // Apply categorization rules
      for (const category of this.config.categories) {
        for (const rule of category.rules) {
          if (this.evaluateCategoryRule(rule, email)) {
            if (!email.categories.includes(category.id)) {
              email.categories.push(category.id);
              categoriesApplied.push(category.id);
              actionsApplied.push('categorize');
            }
          }
        }
      }

      // Auto-archive if configured
      if (email.categories.some(catId => {
        const category = this.config.categories.find(c => c.id === catId);
        return category?.autoArchive;
      })) {
        email.isArchived = true;
        actionsApplied.push('archive');
        this.processingStats.autoArchived++;
      }

      // Update email
      this.emails.set(email.id, email);

      // Update stats
      if (categoriesApplied.length > 0) {
        this.processingStats.autoCategorized++;
      }
      if (responseGenerated) {
        this.processingStats.autoReplied++;
      }

      this.processingStats.averageProcessingTime = this.updateAverage(
        this.processingStats.averageProcessingTime,
        performance.now() - startTime,
        this.processingStats.totalProcessed
      );

      const result: ProcessingResult = {
        emailId: email.id,
        actionsApplied,
        categoriesApplied,
        prioritySet,
        responseGenerated,
        timeProcessed: performance.now() - startTime,
        success: true
      };

      console.log(`[InboxZeroEngine] Email processed successfully: ${actionsApplied.join(', ')}`);
      this.emit('emailProcessed', result);

      return result;

    } catch (error) {
      this.processingStats.errors++;
      console.error(`[InboxZeroEngine] Error processing email ${email.id}:`, error);

      const result: ProcessingResult = {
        emailId: email.id,
        actionsApplied: [],
        categoriesApplied: [],
        prioritySet: email.priority,
        timeProcessed: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      this.emit('emailProcessingError', result);
      return result;
    }
  }

  async syncEmails(accountId: string): Promise<Email[]> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    try {
      console.log(`[InboxZeroEngine] Syncing emails for account: ${account.name}`);

      // This would implement actual email fetching from the provider
      // For now, we'll simulate sync with mock data
      const newEmails = await this.fetchEmailsFromProvider(account);

      // Add new emails to processing queue
      for (const email of newEmails) {
        this.emails.set(email.id, email);
        this.processingQueue.push(email);
      }

      console.log(`[InboxZeroEngine] Synced ${newEmails.length} new emails for ${account.name}`);
      this.emit('emailsSynced', { accountId, count: newEmails.length });

      return newEmails;

    } catch (error) {
      console.error(`[InboxZeroEngine] Error syncing emails for ${account.name}:`, error);
      throw error;
    }
  }

  private async fetchEmailsFromProvider(account: EmailAccount): Promise<Email[]> {
    // Mock implementation - in reality, this would connect to email providers
    // using their respective APIs (Gmail, Outlook, IMAP, etc.)
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: this.generateId('email'),
            messageId: `<${Date.now()}@${account.email}>`,
            threadId: this.generateId('thread'),
            accountId: account.id,
            subject: 'Welcome to Spur Email Processing',
            from: { name: 'Spur Assistant', email: 'assistant@spur.app' },
            to: [{ name: account.name, email: account.email }],
            cc: [],
            bcc: [],
            body: {
              text: 'Welcome to Spur! Your email account has been successfully integrated with our intelligent processing system.',
              html: '<p>Welcome to Spur! Your email account has been successfully integrated with our intelligent processing system.</p>'
            },
            attachments: [],
            headers: {},
            date: new Date(),
            isRead: false,
            isStarred: false,
            isImportant: false,
            isArchived: false,
            categories: [],
            labels: [],
            priority: 'normal',
            size: 1024,
            folder: 'inbox'
          }
        ]);
      }, 1000);
    });
  }

  private evaluateRuleConditions(conditions: RuleCondition[], email: Email): boolean {
    return conditions.every(condition => {
      return this.evaluateCondition(condition, email);
    });
  }

  private evaluateCondition(condition: RuleCondition, email: Email): boolean {
    const { field, operator, value, caseSensitive } = condition;
    
    let fieldValue: string | number = '';
    let conditionValue = value;

    switch (field) {
      case 'from':
        fieldValue = email.from.email;
        break;
      case 'to':
        fieldValue = email.to.map(addr => addr.email).join(', ');
        break;
      case 'subject':
        fieldValue = email.subject;
        break;
      case 'body':
        fieldValue = email.body.text;
        break;
      case 'attachments':
        fieldValue = email.attachments.length;
        break;
      case 'time':
        fieldValue = email.date.getTime();
        conditionValue = typeof value === 'string' ? Date.parse(value) : value;
        break;
      case 'size':
        fieldValue = email.size;
        break;
    }

    if (!caseSensitive && typeof fieldValue === 'string') {
      fieldValue = fieldValue.toLowerCase();
    }
    if (!caseSensitive && typeof conditionValue === 'string') {
      conditionValue = conditionValue.toLowerCase();
    }

    switch (operator) {
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(conditionValue as string);
      case 'equals':
        return fieldValue === conditionValue;
      case 'starts_with':
        return typeof fieldValue === 'string' && fieldValue.startsWith(conditionValue as string);
      case 'ends_with':
        return typeof fieldValue === 'string' && fieldValue.endsWith(conditionValue as string);
      case 'regex':
        return new RegExp(conditionValue as string).test(fieldValue as string);
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > conditionValue;
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < conditionValue;
      default:
        return false;
    }
  }

  private evaluateCategoryRule(rule: CategoryRule, email: Email): boolean {
    const { type, operator, value } = rule;
    
    let fieldValue: string = '';

    switch (type) {
      case 'sender':
        fieldValue = email.from.email;
        break;
      case 'subject':
        fieldValue = email.subject;
        break;
      case 'body':
        fieldValue = email.body.text;
        break;
      case 'attachments':
        fieldValue = email.attachments.map(att => att.filename).join(', ');
        break;
      case 'time':
        fieldValue = email.date.toISOString();
        break;
    }

    fieldValue = fieldValue.toLowerCase();
    const ruleValue = value.toLowerCase();

    switch (operator) {
      case 'contains':
        return fieldValue.includes(ruleValue);
      case 'equals':
        return fieldValue === ruleValue;
      case 'starts_with':
        return fieldValue.startsWith(ruleValue);
      case 'ends_with':
        return fieldValue.endsWith(ruleValue);
      case 'regex':
        return new RegExp(ruleValue).test(fieldValue);
      default:
        return false;
    }
  }

  private async executeRuleAction(action: RuleAction, email: Email): Promise<{
    success: boolean;
    category?: string;
    priority?: string;
    response?: string;
  }> {
    try {
      switch (action.type) {
        case 'categorize':
          const category = action.parameters.category;
          if (category && !email.categories.includes(category)) {
            email.categories.push(category);
          }
          return { success: true, category };
          
        case 'archive':
          email.isArchived = true;
          return { success: true };
          
        case 'star':
          email.isStarred = true;
          return { success: true };
          
        case 'mark_read':
          email.isRead = true;
          return { success: true };
          
        case 'important':
          email.isImportant = true;
          email.priority = 'high';
          return { success: true, priority: 'high' };
          
        case 'forward':
          // Implement forwarding logic
          return { success: true };
          
        case 'reply':
          const response = await this.generateAutoReply(email, action.parameters);
          return { success: true, response };
          
        case 'delete':
          // Implement deletion logic
          return { success: true };
          
        default:
          return { success: false };
      }
    } catch (error) {
      console.error(`[InboxZeroEngine] Error executing action ${action.type}:`, error);
      return { success: false };
    }
  }

  private async generateAutoReply(email: Email, parameters: Record<string, any>): Promise<string> {
    // Generate auto-reply based on email content and parameters
    const template = parameters.template || 'Thank you for your email. I have received your message and will respond shortly.';
    
    let reply = `Hi ${email.from.name},\n\n${template}\n\nBest regards,\n${this.accounts.get(email.accountId)?.name || 'Assistant'}`;
    
    // This would integrate with the assistant for more intelligent responses
    if (this.assistant) {
      try {
        const context = {
          originalEmail: {
            subject: email.subject,
            from: email.from.name,
            body: email.body.text
          },
          replyTemplate: template
        };
        
        const assistantResponse = await this.assistant.processInput(
          `Generate a professional email reply to: "${email.subject}" from ${email.from.name}`,
          'auto-reply',
          context
        );
        
        reply = assistantResponse.response;
      } catch (error) {
        console.error('[InboxZeroEngine] Error generating assistant reply:', error);
      }
    }
    
    return reply;
  }

  private async startSync(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    const syncInterval = setInterval(async () => {
      try {
        await this.syncEmails(accountId);
      } catch (error) {
        console.error(`[InboxZeroEngine] Error in sync interval for ${account.name}:`, error);
      }
    }, account.settings.syncFrequency * 60 * 1000);

    this.syncIntervals.set(accountId, syncInterval);
    
    // Initial sync
    await this.syncEmails(accountId);
  }

  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.isProcessing && this.processingQueue.length > 0) {
      const email = this.processingQueue.shift();
      if (email) {
        try {
          await this.processEmail(email);
        } catch (error) {
          console.error(`[InboxZeroEngine] Error processing queued email ${email.id}:`, error);
        }
      }
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.isProcessing) {
      // Continue processing queue
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  private async setupAutoProcessing(): Promise<void> {
    // Set up scheduled processing times
    const schedule = this.config.processingSchedule;
    
    // This would implement a proper scheduler for automatic processing
    // For now, we'll use simple interval-based processing
    setInterval(() => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentDay = now.getDay();
      
      if (
        schedule.daysOfWeek.includes(currentDay) &&
        currentTime >= schedule.startTime &&
        currentTime <= schedule.endTime
      ) {
        // Trigger processing for all accounts
        for (const accountId of this.accounts.keys()) {
          this.syncEmails(accountId).catch(console.error);
        }
      }
    }, 60000); // Check every minute
  }

  private setupEventListeners(): void {
    if (!this.assistant) return;

    // Listen for assistant events that might trigger email actions
    this.assistant.on('actionExecuted', async (data) => {
      if (data.action.type === 'send_email') {
        // Handle email sending through assistant
        try {
          await this.sendEmail(data.action.parameters);
        } catch (error) {
          console.error('[InboxZeroEngine] Error sending email from assistant:', error);
        }
      }
    });
  }

  private async sendEmail(parameters: Record<string, any>): Promise<void> {
    // Implement email sending logic
    console.log('[InboxZeroEngine] Sending email:', parameters);
    // This would integrate with email provider APIs to send emails
  }

  private async loadAccounts(): Promise<void> {
    try {
      const stored = localStorage.getItem('inboxzero-accounts');
      if (stored) {
        const accountsData = JSON.parse(stored);
        accountsData.forEach((account: any) => {
          this.accounts.set(account.id, account);
        });
        console.log(`[InboxZeroEngine] Loaded ${this.accounts.size} accounts`);
      }
    } catch (error) {
      console.error('[InboxZeroEngine] Error loading accounts:', error);
    }
  }

  private async saveAccounts(): Promise<void> {
    try {
      const accountsData = Array.from(this.accounts.values());
      localStorage.setItem('inboxzero-accounts', JSON.stringify(accountsData));
    } catch (error) {
      console.error('[InboxZeroEngine] Error saving accounts:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = localStorage.getItem('inboxzero-settings');
      if (stored) {
        const settings = JSON.parse(stored);
        this.config = { ...this.config, ...settings };
      }
    } catch (error) {
      console.error('[InboxZeroEngine] Error loading settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      localStorage.setItem('inboxzero-settings', JSON.stringify(this.config));
    } catch (error) {
      console.error('[InboxZeroEngine] Error saving settings:', error);
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  // Public API methods
  getAccounts(): EmailAccount[] {
    return Array.from(this.accounts.values());
  }

  getEmails(accountId?: string): Email[] {
    const allEmails = Array.from(this.emails.values());
    return accountId ? allEmails.filter(email => email.accountId === accountId) : allEmails;
  }

  getCategories(): EmailCategory[] {
    return [...this.config.categories];
  }

  getStats() {
    return { ...this.processingStats };
  }

  async updateConfig(newConfig: Partial<InboxZeroConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveSettings();
    console.log('[InboxZeroEngine] Configuration updated');
  }

  getConfig(): InboxZeroConfig {
    return { ...this.config };
  }

  isHealthy(): boolean {
    return this.isRunning && this.processingStats.errors / Math.max(this.processingStats.totalProcessed, 1) < 0.05;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    try {
      // Clean up resources
      this.accounts.clear();
      this.emails.clear();
      this.processingQueue = [];
      
      localStorage.removeItem('inboxzero-accounts');
      localStorage.removeItem('inboxzero-settings');

      this.assistant = null;

      console.log('[InboxZeroEngine] Cleanup completed');

    } catch (error) {
      console.error('[InboxZeroEngine] Cleanup failed:', error);
    }
  }
}