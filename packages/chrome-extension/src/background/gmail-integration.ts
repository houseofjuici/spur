import { MemoryNode } from '../types/spur';

interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  body: string;
  labels: string[];
  attachments: any[];
  hasAttachments: boolean;
}

interface GmailThread {
  id: string;
  messages: GmailEmail[];
  subject: string;
  participants: string[];
  lastMessageDate: string;
}

interface GmailSearchResult {
  emails: GmailEmail[];
  threads: GmailThread[];
  totalResults: number;
}

class GmailIntegration {
  private isConnected = false;
  private accessToken?: string;
  private readonly GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  private readonly GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me';

  async initialize(): Promise<void> {
    try {
      // Check if user is signed in to Google
      await this.checkAuthStatus();
      console.log('Gmail integration initialized');
    } catch (error) {
      console.error('Failed to initialize Gmail integration:', error);
    }
  }

  private async checkAuthStatus(): Promise<void> {
    try {
      // Get OAuth token from Chrome identity API
      const token = await chrome.identity.getAuthToken({
        interactive: false,
        scopes: [this.GMAIL_SCOPE]
      });

      if (token) {
        this.accessToken = token;
        this.isConnected = true;
        
        // Test the token
        await this.testConnection();
      } else {
        this.isConnected = false;
      }
    } catch (error) {
      console.log('User not authenticated with Google');
      this.isConnected = false;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.GMAIL_API_BASE}/profile`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const profile = await response.json();
      console.log('Gmail connection test successful:', profile.emailAddress);
    } catch (error) {
      console.error('Gmail connection test failed:', error);
      this.isConnected = false;
      this.accessToken = undefined;
      throw error;
    }
  }

  async isConnectedToGmail(): Promise<boolean> {
    return this.isConnected;
  }

  async connect(): Promise<boolean> {
    try {
      // Request OAuth token with user interaction
      const token = await chrome.identity.getAuthToken({
        interactive: true,
        scopes: [this.GMAIL_SCOPE]
      });

      if (token) {
        this.accessToken = token;
        await this.testConnection();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to connect to Gmail:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.accessToken) {
        await chrome.identity.removeCachedAuthToken({ token: this.accessToken });
      }
      this.accessToken = undefined;
      this.isConnected = false;
      console.log('Disconnected from Gmail');
    } catch (error) {
      console.error('Failed to disconnect from Gmail:', error);
    }
  }

  async saveEmail(emailId: string): Promise<MemoryNode | null> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Gmail');
      }

      const email = await this.getEmail(emailId);
      if (!email) {
        return null;
      }

      // Create memory from email
      const memory: MemoryNode = {
        id: `gmail_${email.id}`,
        content: this.formatEmailContent(email),
        type: 'email',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'gmail',
          emailId: email.id,
          threadId: email.threadId,
          subject: email.subject,
          from: email.from,
          date: email.date,
          labels: email.labels,
          hasAttachments: email.hasAttachments
        },
        connections: [],
        tags: this.extractTagsFromEmail(email)
      };

      return memory;
    } catch (error) {
      console.error('Failed to save email:', error);
      throw error;
    }
  }

  private formatEmailContent(email: GmailEmail): string {
    return `Email: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to.join(', ')}\nDate: ${new Date(email.date).toLocaleString()}\n\n${email.body}`;
  }

  private extractTagsFromEmail(email: GmailEmail): string[] {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    const words = content.split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'this', 'that', 'these', 'those', 'your', 'you', 'i', 'me', 'my', 'we', 'our', 'us']);
    
    // Add labels as tags
    const labelTags = email.labels.filter(label => !label.startsWith('CATEGORY_'));
    
    // Extract meaningful words from content
    const contentTags = words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10);

    return [...labelTags, ...contentTags].slice(0, 15);
  }

  async searchEmails(query: string, maxResults: number = 10): Promise<GmailSearchResult> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Gmail');
      }

      const response = await fetch(`${this.GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const emails: GmailEmail[] = [];

      // Fetch full email data for each message
      for (const message of data.messages || []) {
        const email = await this.getEmail(message.id);
        if (email) {
          emails.push(email);
        }
      }

      return {
        emails,
        threads: this.groupEmailsByThread(emails),
        totalResults: data.resultSizeEstimate || emails.length
      };
    } catch (error) {
      console.error('Failed to search emails:', error);
      throw error;
    }
  }

  async getThreads(folder: string = 'inbox', maxResults: number = 20): Promise<GmailThread[]> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Gmail');
      }

      const query = this.getFolderQuery(folder);
      const response = await fetch(`${this.GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const emails: GmailEmail[] = [];

      // Fetch full email data for each message
      for (const message of data.messages || []) {
        const email = await this.getEmail(message.id);
        if (email) {
          emails.push(email);
        }
      }

      return this.groupEmailsByThread(emails);
    } catch (error) {
      console.error('Failed to get threads:', error);
      throw error;
    }
  }

  private getFolderQuery(folder: string): string {
    const folderQueries = {
      'inbox': 'in:inbox',
      'sent': 'in:sent',
      'drafts': 'in:drafts',
      'spam': 'in:spam',
      'trash': 'in:trash',
      'starred': 'is:starred',
      'important': 'is:important',
      'unread': 'is:unread'
    };

    return folderQueries[folder as keyof typeof folderQueries] || 'in:inbox';
  }

  private async getEmail(emailId: string): Promise<GmailEmail | null> {
    try {
      const response = await fetch(`${this.GMAIL_API_BASE}/messages/${emailId}?format=full`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return null;
      }

      const message = await response.json();
      return this.parseGmailMessage(message);
    } catch (error) {
      console.error(`Failed to get email ${emailId}:`, error);
      return null;
    }
  }

  private parseGmailMessage(message: any): GmailEmail {
    const headers = message.payload.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const to = getHeader('To').split(',').map((email: string) => email.trim());
    const date = getHeader('Date');
    const messageId = getHeader('Message-ID');

    let body = '';
    let hasAttachments = false;
    const attachments: any[] = [];

    // Parse email body
    if (message.payload.body && message.payload.body.size > 0) {
      if (message.payload.mimeType === 'text/plain') {
        body = this.decodeBase64(message.payload.body.data);
      }
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.size > 0) {
          body = this.decodeBase64(part.body.data);
        } else if (part.filename && part.filename.length > 0) {
          hasAttachments = true;
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            attachmentId: part.body.attachmentId
          });
        }
      }
    }

    const labels = message.labelIds || [];

    return {
      id: message.id,
      threadId: message.threadId,
      subject: subject || '(No Subject)',
      from,
      to,
      date,
      body,
      labels,
      attachments,
      hasAttachments
    };
  }

  private decodeBase64(base64: string): string {
    // Gmail uses URL-safe base64 encoding
    const base64Url = base64.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(atob(base64Url).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }

  private groupEmailsByThread(emails: GmailEmail[]): GmailThread[] {
    const threadMap = new Map<string, GmailEmail[]>();

    for (const email of emails) {
      if (!threadMap.has(email.threadId)) {
        threadMap.set(email.threadId, []);
      }
      threadMap.get(email.threadId)!.push(email);
    }

    return Array.from(threadMap.entries()).map(([threadId, messages]) => {
      const participants = new Set<string>();
      let lastMessageDate = '';
      let subject = '';

      for (const message of messages) {
        participants.add(message.from);
        message.to.forEach(to => participants.add(to));
        
        if (!lastMessageDate || new Date(message.date) > new Date(lastMessageDate)) {
          lastMessageDate = message.date;
          subject = message.subject;
        }
      }

      return {
        id: threadId,
        messages,
        subject,
        participants: Array.from(participants),
        lastMessageDate
      };
    }).sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
  }

  async sync(): Promise<{ synced: number; errors: number }> {
    try {
      if (!this.isConnected) {
        return { synced: 0, errors: 0 };
      }

      // Get recent emails from inbox
      const recentEmails = await this.searchEmails('in:inbox newer_than:1d', 50);
      
      let synced = 0;
      let errors = 0;

      for (const email of recentEmails.emails) {
        try {
          // Check if email already exists in memories
          // This would be implemented with the memory graph
          console.log(`Syncing email: ${email.subject}`);
          synced++;
        } catch (error) {
          console.error(`Failed to sync email ${email.id}:`, error);
          errors++;
        }
      }

      return { synced, errors };
    } catch (error) {
      console.error('Gmail sync failed:', error);
      return { synced: 0, errors: 1 };
    }
  }

  async getUnreadCount(): Promise<number> {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const response = await fetch(`${this.GMAIL_API_BASE}/profile`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return 0;
      }

      const profile = await response.json();
      return profile.messagesUnread || 0;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  async watchForNewEmails(): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Gmail');
      }

      const response = await fetch(`${this.GMAIL_API_BASE}/watch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topicName: 'projects/spur/topics/gmail-notifications',
          labelIds: ['INBOX']
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('Gmail watch setup successful');
    } catch (error) {
      console.error('Failed to watch for new emails:', error);
      throw error;
    }
  }
}

export const gmailIntegration = new GmailIntegration();
export { GmailIntegration, type GmailEmail, type GmailThread, type GmailSearchResult };