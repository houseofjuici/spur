import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealGmailService } from '@/integrations/email/RealGmailService';

// Mock OAuth2Client
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    setCredentials: vi.fn(),
    getAccessToken: vi.fn(),
    refreshToken: vi.fn(),
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth')
  }))
}));

// Mock Gmail API
vi.mock('@googleapis/gmail', () => ({
  google: {
    gmail: vi.fn().mockReturnValue({
      users: {
        messages: {
          list: vi.fn(),
          get: vi.fn(),
          send: vi.fn()
        },
        labels: {
          list: vi.fn(),
          create: vi.fn()
        },
        history: {
          list: vi.fn()
        }
      }
    })
  }
}));

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('test-jwt-token'),
  verify: vi.fn().mockReturnValue({ userId: 'test-user', email: 'test@example.com' })
}));

import { OAuth2Client } from 'google-auth-library';
import { google } from '@googleapis/gmail';
import jwt from 'jsonwebtoken';

describe('RealGmailService', () => {
  let gmailService: RealGmailService;
  let mockOAuth2Client: any;
  let mockGmailAPI: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock OAuth2 client
    mockOAuth2Client = new (OAuth2Client as any)();
    
    // Create mock Gmail API
    mockGmailAPI = {
      users: {
        messages: {
          list: vi.fn(),
          get: vi.fn(),
          send: vi.fn()
        },
        labels: {
          list: vi.fn(),
          create: vi.fn()
        },
        history: {
          list: vi.fn()
        }
      }
    };

    (google.gmail as any).mockReturnValue(mockGmailAPI);

    gmailService = new RealGmailService({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/auth/google/callback'
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(gmailService).toBeDefined();
    });

    it('should throw error if required config is missing', () => {
      expect(() => {
        new RealGmailService({
          clientId: '',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000'
        });
      }).toThrow('Gmail client ID is required');
    });
  });

  describe('Authentication', () => {
    it('should generate auth URL with correct scopes', () => {
      const authUrl = gmailService.getAuthUrl();
      
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify'
        ],
        prompt: 'consent'
      });
      
      expect(authUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    });

    it('should handle OAuth callback successfully', async () => {
      mockOAuth2Client.getToken = vi.fn().mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expiry_date: Date.now() + 3600000
        }
      });

      const result = await gmailService.handleOAuthCallback('test-auth-code');

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('test-auth-code');
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
    });

    it('should handle OAuth callback errors', async () => {
      mockOAuth2Client.getToken = vi.fn().mockRejectedValue(new Error('OAuth error'));

      const result = await gmailService.handleOAuthCallback('invalid-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('OAuth error');
    });

    it('should refresh access token when expired', async () => {
      // Set up expired token
      (gmailService as any).accessToken = 'expired-token';
      (gmailService as any).refreshToken = 'valid-refresh-token';
      (gmailService as any).tokenExpiry = new Date(Date.now() - 1000);

      mockOAuth2Client.refreshToken = vi.fn().mockResolvedValue({
        credentials: {
          access_token: 'new-access-token',
          expiry_date: Date.now() + 3600000
        }
      });

      const token = await gmailService.getAccessToken();

      expect(mockOAuth2Client.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(token).toBe('new-access-token');
    });

    it('should return current token if not expired', async () => {
      (gmailService as any).accessToken = 'valid-token';
      (gmailService as any).tokenExpiry = new Date(Date.now() + 3600000);

      const token = await gmailService.getAccessToken();

      expect(token).toBe('valid-token');
      expect(mockOAuth2Client.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe('Email Operations', () => {
    beforeEach(async () => {
      // Set up authenticated state
      (gmailService as any).isInitialized = true;
      (gmailService as any).accessToken = 'test-access-token';
      (gmailService as any).refreshToken = 'test-refresh-token';
      (gmailService as any).tokenExpiry = new Date(Date.now() + 3600000);
      (gmailService as any).oauth2Client = mockOAuth2Client;
    });

    describe('Email Sync', () => {
      it('should sync emails successfully', async () => {
        const mockMessages = {
          data: {
            messages: [
              { id: 'msg1', threadId: 'thread1' },
              { id: 'msg2', threadId: 'thread2' }
            ],
            nextPageToken: 'page2'
          }
        };

        const mockMessageDetails = {
          data: {
            id: 'msg1',
            threadId: 'thread1',
            labelIds: ['INBOX', 'UNREAD'],
            snippet: 'Test email snippet',
            payload: {
              headers: [
                { name: 'From', value: 'sender@example.com' },
                { name: 'Subject', value: 'Test Subject' },
                { name: 'Date', value: 'Wed, 01 Jan 2025 10:00:00 +0000' }
              ],
              body: {
                data: 'VGVzdCBlbWFpbCBjb250ZW50' // Base64 encoded
              }
            },
            internalDate: '1704110800000'
          }
        };

        mockGmailAPI.users.messages.list = vi.fn().mockResolvedValue(mockMessages);
        mockGmailAPI.users.messages.get = vi.fn().mockResolvedValue(mockMessageDetails);

        const result = await gmailService.syncEmails({
          maxResults: 50,
          labelIds: ['INBOX']
        });

        expect(result.success).toBe(true);
        expect(result.emails).toHaveLength(2);
        expect(result.emails[0].id).toBe('msg1');
        expect(result.emails[0].from).toBe('sender@example.com');
        expect(result.emails[0].subject).toBe('Test Subject');
        expect(result.emails[0].content).toBe('Test email content');
        expect(result.hasMore).toBe(true);
        expect(result.nextPageToken).toBe('page2');
      });

      it('should handle sync errors gracefully', async () => {
        mockGmailAPI.users.messages.list = vi.fn().mockRejectedValue(new Error('API error'));

        const result = await gmailService.syncEmails();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API error');
      });

      it('should sync with incremental updates', async () => {
        const mockHistory = {
          data: {
            history: [
              {
                id: 'hist1',
                messagesAdded: [
                  { message: { id: 'new-msg1' } }
                ]
              }
            ]
          }
        };

        mockGmailAPI.users.history.list = vi.fn().mockResolvedValue(mockHistory);
        mockGmailAPI.users.messages.get = vi.fn().mockResolvedValue({
          data: {
            id: 'new-msg1',
            threadId: 'thread1',
            labelIds: ['INBOX'],
            snippet: 'New email',
            payload: {
              headers: [
                { name: 'From', value: 'new@example.com' },
                { name: 'Subject', value: 'New Subject' }
              ]
            },
            internalDate: '1704110800000'
          }
        });

        const result = await gmailService.syncIncremental('test-history-id');

        expect(result.success).toBe(true);
        expect(result.emails).toHaveLength(1);
        expect(result.emails[0].id).toBe('new-msg1');
      });
    });

    describe('Smart Reply', () => {
      it('should generate smart reply suggestions', async () => {
        const mockMessageDetails = {
          data: {
            id: 'msg1',
            threadId: 'thread1',
            snippet: 'Can we schedule a meeting tomorrow?',
            payload: {
              headers: [
                { name: 'From', value: 'colleague@example.com' },
                { name: 'Subject', value: 'Meeting Request' }
              ],
              body: {
                data: 'Q2FuIHdlIHNjaGVkdWxlIGEgbWVldGluZyB0b21vcnJvdz8='
              }
            }
          }
        };

        mockGmailAPI.users.messages.get = vi.fn().mockResolvedValue(mockMessageDetails);

        const suggestions = await gmailService.generateSmartReply('msg1');

        expect(suggestions).toHaveLength(3);
        expect(suggestions).toContain('Yes, I\'m available tomorrow. What time works for you?');
        expect(suggestions).toContain('I\'ll check my schedule and get back to you.');
        expect(suggestions).toContain('Could we schedule it for next week instead?');
      });

      it('should send email reply', async () => {
        const mockResponse = {
          data: {
            id: 'reply-msg1',
            threadId: 'thread1',
            labelIds: ['SENT']
          }
        };

        mockGmailAPI.users.messages.send = vi.fn().mockResolvedValue(mockResponse);

        const result = await gmailService.sendReply({
          threadId: 'thread1',
          to: 'colleague@example.com',
          subject: 'Re: Meeting Request',
          content: 'Yes, I\'m available tomorrow at 2 PM.',
          inReplyTo: 'msg1'
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('reply-msg1');
        expect(mockGmailAPI.users.messages.send).toHaveBeenCalledWith({
          userId: 'me',
          requestBody: {
            threadId: 'thread1',
            raw: expect.any(String)
          }
        });
      });
    });

    describe('Email Categorization', () => {
      it('should categorize emails correctly', async () => {
        const emails = [
          {
            id: 'msg1',
            subject: 'Project Update - Weekly Report',
            from: 'manager@company.com',
            content: 'Here is the weekly project update...',
            labels: ['INBOX']
          },
          {
            id: 'msg2',
            subject: 'Your Amazon Order',
            from: 'auto-confirm@amazon.com',
            content: 'Your order has been shipped...',
            labels: ['INBOX', 'PROMOTIONS']
          },
          {
            id: 'msg3',
            subject: 'Security Alert',
            from: 'security@github.com',
            content: 'New login detected...',
            labels: ['INBOX', 'UNREAD']
          }
        ];

        const categorized = gmailService.categorizeEmails(emails);

        expect(categorized.work).toHaveLength(1);
        expect(categorized.work[0].id).toBe('msg1');
        
        expect(categorized.promotions).toHaveLength(1);
        expect(categorized.promotions[0].id).toBe('msg2');
        
        expect(categorized.security).toHaveLength(1);
        expect(categorized.security[0].id).toBe('msg3');
      });

      it('should extract important information from emails', async () => {
        const emailContent = `
          Meeting scheduled for tomorrow at 2:00 PM in Conference Room B.
          Please bring the quarterly report and project timeline.
          Contact: john.doe@company.com, +1-555-0123
        `;

        const extracted = gmailService.extractImportantInfo(emailContent);

        expect(extracted).toEqual(expect.objectContaining({
          dateTime: expect.any(String),
          location: expect.any(String),
          actionItems: expect.arrayContaining('bring the quarterly report'),
          contacts: expect.arrayContaining('john.doe@company.com', '+1-555-0123')
        }));
      });
    });

    describe('Label Management', () => {
      it('should create Spur labels if they don\'t exist', async () => {
        mockGmailAPI.users.labels.list = vi.fn().mockResolvedValue({
          data: {
            labels: [
              { id: 'INBOX', name: 'INBOX', type: 'system' },
              { id: 'SENT', name: 'SENT', type: 'system' }
            ]
          }
        });

        mockGmailAPI.users.labels.create = vi.fn().mockResolvedValue({
          data: { id: 'label-spur', name: 'Spur', type: 'user' }
        });

        await gmailService.ensureSpurLabels();

        expect(mockGmailAPI.users.labels.create).toHaveBeenCalledTimes(3); // Spur, Important, Action
      });

      it('should not create labels if they already exist', async () => {
        mockGmailAPI.users.labels.list = vi.fn().mockResolvedValue({
          data: {
            labels: [
              { id: 'INBOX', name: 'INBOX', type: 'system' },
              { id: 'SENT', name: 'SENT', type: 'system' },
              { id: 'label-spur', name: 'Spur', type: 'user' }
            ]
          }
        });

        await gmailService.ensureSpurLabels();

        expect(mockGmailAPI.users.labels.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API quota exceeded errors', async () => {
      (gmailService as any).isInitialized = true;
      
      mockGmailAPI.users.messages.list = vi.fn().mockRejectedValue({
        code: 429,
        message: 'Quota exceeded'
      });

      const result = await gmailService.syncEmails();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Quota exceeded');
      expect(result.retryAfter).toBeDefined();
    });

    it('should handle authentication errors', async () => {
      (gmailService as any).isInitialized = true;
      (gmailService as any).accessToken = 'invalid-token';
      
      mockGmailAPI.users.messages.list = vi.fn().mockRejectedValue({
        code: 401,
        message: 'Invalid credentials'
      });

      const result = await gmailService.syncEmails();

      expect(result.success).toBe(false);
      expect(result.error).toContain('authentication');
    });

    it('should handle network errors', async () => {
      (gmailService as any).isInitialized = true;
      
      mockGmailAPI.users.messages.list = vi.fn().mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'Network error'
      });

      const result = await gmailService.syncEmails();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration fields', () => {
      expect(() => {
        new RealGmailService({
          clientId: '',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000'
        });
      }).toThrow('Gmail client ID is required');

      expect(() => {
        new RealGmailService({
          clientId: 'test-id',
          clientSecret: '',
          redirectUri: 'http://localhost:3000'
        });
      }).toThrow('Gmail client secret is required');

      expect(() => {
        new RealGmailService({
          clientId: 'test-id',
          clientSecret: 'test-secret',
          redirectUri: ''
        });
      }).toThrow('Gmail redirect URI is required');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      (gmailService as any).syncInterval = setInterval(() => {}, 60000);
      
      await gmailService.cleanup();

      expect((gmailService as any).syncInterval).toBeUndefined();
      expect((gmailService as any).isInitialized).toBe(false);
    });
  });
});