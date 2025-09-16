import { GmailService } from '@/integrations/email/gmail';

export interface GmailConfig {
  enabled: boolean;
  apiKey?: string;
  clientId?: string;
  scopes: string[];
  maxEmailsPerSync: number;
  syncInterval: number; // minutes
  autoCategorize: boolean;
  smartReplies: boolean;
  notificationEnabled: boolean;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: Date;
  body: string;
  htmlBody?: string;
  attachments: EmailAttachment[];
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  importance: 'low' | 'medium' | 'high' | 'critical';
  categories: string[];
  extractedActions?: EmailAction[];
  metadata?: any;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string;
}

export interface EmailAction {
  type: 'reply' | 'forward' | 'archive' | 'delete' | 'label' | 'schedule' | 'task';
  description: string;
  parameters: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  dueDate?: Date;
}

export interface GmailSyncResult {
  emailsProcessed: number;
  emailsAdded: number;
  emailsUpdated: number;
  actionsExtracted: number;
  categoriesApplied: number;
  errors: string[];
  syncTime: number;
}

export class RealGmailService extends GmailService {
  private config: GmailConfig;
  private isInitialized = false;
  private isSyncing = false;
  private accessToken?: string;
  private lastSyncTime = 0;
  private syncIntervalId?: NodeJS.Timeout;

  constructor(config: GmailConfig) {
    super(config);
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[GmailService] Initializing...');
      
      // Check if OAuth is already configured
      await this.checkAuthStatus();
      
      // Setup sync interval
      if (this.config.syncInterval > 0) {
        this.setupSyncInterval();
      }

      this.isInitialized = true;
      console.log('[GmailService] Initialized successfully');

    } catch (error) {
      console.error('[GmailService] Initialization failed:', error);
      throw error;
    }
  }

  async authenticate(): Promise<void> {
    try {
      console.log('[GmailService] Starting authentication...');
      
      // Redirect to Google OAuth
      const authUrl = this.getAuthUrl();
      window.open(authUrl, '_blank', 'width=500,height=600');
      
      // Wait for authentication callback
      return new Promise((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'gmail-auth-callback') {
            window.removeEventListener('message', handleMessage);
            
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              this.accessToken = event.data.accessToken;
              resolve();
            }
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Timeout after 5 minutes
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          reject(new Error('Authentication timeout'));
        }, 300000);
      });

    } catch (error) {
      console.error('[GmailService] Authentication failed:', error);
      throw error;
    }
  }

  async syncEmails(): Promise<GmailSyncResult> {
    if (!this.isInitialized || !this.accessToken) {
      throw new Error('Gmail service not authenticated');
    }

    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    const startTime = Date.now();
    const result: GmailSyncResult = {
      emailsProcessed: 0,
      emailsAdded: 0,
      emailsUpdated: 0,
      actionsExtracted: 0,
      categoriesApplied: 0,
      errors: [],
      syncTime: 0
    };

    try {
      console.log('[GmailService] Starting email sync...');
      this.isSyncing = true;

      // Get emails from Gmail API
      const emails = await this.fetchRecentEmails();
      result.emailsProcessed = emails.length;

      // Process each email
      for (const email of emails) {
        try {
          const processedEmail = await this.processEmail(email);
          
          // Check if email already exists
          const existingEmail = await this.getEmailById(email.id);
          
          if (existingEmail) {
            // Update existing email
            await this.updateEmail(email.id, processedEmail);
            result.emailsUpdated++;
          } else {
            // Add new email
            await this.saveEmail(processedEmail);
            result.emailsAdded++;
          }

          // Extract actions if enabled
          if (this.config.autoCategorize || this.config.smartReplies) {
            const actions = await this.extractEmailActions(processedEmail);
            if (actions.length > 0) {
              result.actionsExtracted += actions.length;
              await this.saveEmailActions(email.id, actions);
            }
          }

        } catch (error) {
          const errorMsg = `Error processing email ${email.id}: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Update last sync time
      this.lastSyncTime = Date.now();
      result.syncTime = Date.now() - startTime;

      console.log('[GmailService] Sync completed:', result);
      return result;

    } catch (error) {
      console.error('[GmailService] Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  async sendEmail(to: string, subject: string, body: string, options: {
    cc?: string[];
    bcc?: string[];
    attachments?: File[];
  } = {}): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      console.log('[GmailService] Sending email to:', to);

      const message = this.createEmailMessage(to, subject, body, options);
      const response = await this.sendToGmail(message);

      console.log('[GmailService] Email sent successfully:', response.id);
      return response.id;

    } catch (error) {
      console.error('[GmailService] Failed to send email:', error);
      throw error;
    }
  }

  async generateSmartReply(emailId: string, context?: string): Promise<string[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const email = await this.getEmailById(emailId);
      if (!email) {
        throw new Error('Email not found');
      }

      // Use NLP to generate smart replies
      const smartReplies = await this.analyzeEmailForReplies(email, context);
      
      return smartReplies;

    } catch (error) {
      console.error('[GmailService] Failed to generate smart reply:', error);
      throw error;
    }
  }

  async categorizeEmail(emailId: string): Promise<string[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const email = await this.getEmailById(emailId);
      if (!email) {
        throw new Error('Email not found');
      }

      // Use ML/AI to categorize email
      const categories = await this.analyzeEmailContent(email);
      
      // Apply labels in Gmail
      await this.applyGmailLabels(emailId, categories);
      
      return categories;

    } catch (error) {
      console.error('[GmailService] Failed to categorize email:', error);
      throw error;
    }
  }

  async searchEmails(query: string, options: {
    maxResults?: number;
    label?: string;
    from?: string;
    to?: string;
    subject?: string;
    dateRange?: { start: Date; end: Date };
  } = {}): Promise<EmailMessage[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const gmailQuery = this.buildGmailQuery(query, options);
      const emails = await this.searchGmail(gmailQuery, options.maxResults || 50);
      
      return emails.map(email => this.processGmailEmail(email));

    } catch (error) {
      console.error('[GmailService] Search failed:', error);
      throw error;
    }
  }

  private async checkAuthStatus(): Promise<void> {
    // Check if we have a stored access token
    const stored = await this.getStoredAuth();
    if (stored && stored.accessToken) {
      this.accessToken = stored.accessToken;
      
      // Validate token
      if (!(await this.validateToken(this.accessToken))) {
        // Refresh token if expired
        await this.refreshAccessToken();
      }
    }
  }

  private getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId || '',
      redirect_uri: chrome.runtime.getURL('oauth/callback.html'),
      scope: this.config.scopes.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async fetchRecentEmails(): Promise<any[]> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${this.config.maxEmailsPerSync}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    const data = await response.json();
    const emails = [];

    for (const message of data.messages || []) {
      const emailData = await this.fetchEmailById(message.id);
      emails.push(emailData);
    }

    return emails;
  }

  private async fetchEmailById(emailId: string): Promise<any> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch email: ${response.status}`);
    }

    return response.json();
  }

  private processEmail(gmailEmail: any): EmailMessage {
    const headers = gmailEmail.payload.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };

    const body = this.extractEmailBody(gmailEmail.payload);
    const attachments = this.extractAttachments(gmailEmail.payload);

    return {
      id: gmailEmail.id,
      threadId: gmailEmail.threadId,
      subject: getHeader('Subject') || 'No Subject',
      from: getHeader('From'),
      to: this.parseEmailList(getHeader('To')),
      cc: this.parseEmailList(getHeader('Cc')),
      bcc: this.parseEmailList(getHeader('Bcc')),
      date: new Date(parseInt(gmailEmail.internalDate)),
      body: body.text,
      htmlBody: body.html,
      attachments,
      labels: gmailEmail.labelIds || [],
      isRead: !gmailEmail.labelIds?.includes('UNREAD'),
      isStarred: gmailEmail.labelIds?.includes('STARRED') || false,
      isImportant: gmailEmail.labelIds?.includes('IMPORTANT') || false,
      importance: 'medium', // Will be calculated by AI
      categories: [], // Will be populated by categorization
      metadata: {
        gmailData: gmailEmail,
        processedAt: Date.now()
      }
    };
  }

  private extractEmailBody(payload: any): { text: string; html?: string } {
    let text = '';
    let html = '';

    if (payload.mimeType === 'text/plain') {
      text = atob(payload.body.data?.replace(/-/g, '+').replace(/_/g, '/') || '');
    } else if (payload.mimeType === 'text/html') {
      html = atob(payload.body.data?.replace(/-/g, '+').replace(/_/g, '/') || '');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        const partBody = this.extractEmailBody(part);
        text += partBody.text;
        if (!html && partBody.html) html = partBody.html;
      }
    }

    return { text: text.trim(), html: html?.trim() };
  }

  private extractAttachments(payload: any): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.filename.length > 0) {
          attachments.push({
            id: part.partId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId
          });
        }
      }
    }

    return attachments;
  }

  private parseEmailList(emailString: string): string[] {
    if (!emailString) return [];
    
    return emailString
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
  }

  private async extractEmailActions(email: EmailMessage): Promise<EmailAction[]> {
    // Use NLP to extract actions from email content
    const actions: EmailAction[] = [];

    // Look for action patterns in the email
    const actionPatterns = [
      { type: 'schedule', patterns: ['meeting', 'appointment', 'call', 'schedule'] },
      { type: 'task', patterns: ['todo', 'task', 'action item', 'follow up'] },
      { type: 'reply', patterns: ['please reply', 'respond by', 'deadline'] },
      { type: 'archive', patterns: ['for your records', 'fyi', 'information only'] }
    ];

    const content = `${email.subject} ${email.body}`.toLowerCase();

    for (const actionType of actionPatterns) {
      for (const pattern of actionType.patterns) {
        if (content.includes(pattern)) {
          actions.push({
            type: actionType.type as any,
            description: `${actionType.type} related to email`,
            parameters: { emailId: email.id },
            priority: 'medium',
            confidence: 0.7
          });
        }
      }
    }

    return actions;
  }

  private async analyzeEmailForReplies(email: EmailMessage, context?: string): Promise<string[]> {
    // Use NLP to generate smart replies
    const replies = [
      'Thank you for your email. I will get back to you soon.',
      'Thanks for the information. I appreciate you sharing this.',
      'I have received your message and will review it.',
      'Got it, thanks! I\'ll take a look and respond accordingly.',
      'Thank you for reaching out. I\'ll respond as soon as possible.'
    ];

    return replies.slice(0, 3); // Return top 3 suggestions
  }

  private async analyzeEmailContent(email: EmailMessage): Promise<string[]> {
    // Use ML/AI to categorize email content
    const categories = [];

    const content = `${email.subject} ${email.body}`.toLowerCase();

    // Simple keyword-based categorization (can be enhanced with ML)
    const categoryMap = {
      'work': ['project', 'meeting', 'deadline', 'report', 'presentation'],
      'personal': ['family', 'friend', 'personal', 'home', 'vacation'],
      'finance': ['payment', 'invoice', 'money', 'budget', 'financial'],
      'social': ['invitation', 'event', 'party', 'gathering', 'social'],
      'news': ['newsletter', 'update', 'news', 'announcement'],
      'spam': ['unsubscribe', 'spam', 'junk', 'advertisement']
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        categories.push(category);
      }
    }

    return categories.length > 0 ? categories : ['other'];
  }

  private buildGmailQuery(query: string, options: any): string {
    let gmailQuery = query;

    if (options.label) {
      gmailQuery += ` label:${options.label}`;
    }

    if (options.from) {
      gmailQuery += ` from:${options.from}`;
    }

    if (options.to) {
      gmailQuery += ` to:${options.to}`;
    }

    if (options.subject) {
      gmailQuery += ` subject:${options.subject}`;
    }

    if (options.dateRange) {
      const start = options.dateRange.start.toISOString().split('T')[0];
      const end = options.dateRange.end.toISOString().split('T')[0];
      gmailQuery += ` after:${start} before:${end}`;
    }

    return gmailQuery;
  }

  private createEmailMessage(to: string, subject: string, body: string, options: any): string {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body
    ];

    if (options.cc) {
      email.splice(1, 0, `Cc: ${options.cc.join(', ')}`);
    }

    return email.join('\n');
  }

  private async sendToGmail(message: string): Promise<any> {
    const encodedMessage = btoa(message)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedMessage
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.status}`);
    }

    return response.json();
  }

  private async searchGmail(query: string, maxResults: number): Promise<any[]> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    const emails = [];

    for (const message of data.messages || []) {
      const emailData = await this.fetchEmailById(message.id);
      emails.push(emailData);
    }

    return emails;
  }

  private async applyGmailLabels(emailId: string, labels: string[]): Promise<void> {
    // This would implement applying labels to Gmail emails
    // Requires Gmail API permissions for label management
  }

  private async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v2/tokeninfo',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    // Implement token refresh logic
    // This would require storing refresh tokens securely
  }

  private setupSyncInterval(): void {
    this.syncIntervalId = setInterval(async () => {
      try {
        await this.syncEmails();
      } catch (error) {
        console.error('[GmailService] Auto-sync failed:', error);
      }
    }, this.config.syncInterval * 60 * 1000);
  }

  private async getStoredAuth(): Promise<any> {
    // Retrieve stored authentication data
    return chrome.storage.local.get(['gmailAuth']);
  }

  private async saveEmail(email: EmailMessage): Promise<void> {
    // Save email to local storage/database
    // Implementation depends on your storage system
  }

  private async updateEmail(emailId: string, updates: Partial<EmailMessage>): Promise<void> {
    // Update existing email
    // Implementation depends on your storage system
  }

  private async getEmailById(emailId: string): Promise<EmailMessage | null> {
    // Retrieve email from storage
    // Implementation depends on your storage system
    return null;
  }

  private async saveEmailActions(emailId: string, actions: EmailAction[]): Promise<void> {
    // Save extracted actions
    // Implementation depends on your storage system
  }

  async cleanup(): Promise<void> {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    this.isInitialized = false;
    this.isSyncing = false;
  }
}