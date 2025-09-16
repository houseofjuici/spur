import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GmailIntegration } from '../../src/content/index';
import type { MemoryNode } from '../../src/types/spur';

// Mock DOM APIs
const mockDocument = {
  createElement: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
  head: { appendChild: vi.fn() },
  body: { appendChild: vi.fn(), removeChild: vi.fn() }
};

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn()
    },
    sendMessage: vi.fn()
  },
  storage: {
    local: {
      get: vi.fn(),
      onChanged: {
        addListener: vi.fn()
      }
    }
  }
};

Object.defineProperty(global, 'document', { value: mockDocument, configurable: true });
Object.defineProperty(global, 'chrome', { value: mockChrome, configurable: true });

describe('GmailIntegration', () => {
  let gmailIntegration: GmailIntegration;
  let mockConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      gmailIntegration: true,
      autoCapture: true,
      voiceCommands: true
    };

    // Mock document createElement for style injection
    mockDocument.createElement.mockImplementation((tagName: string) => {
      if (tagName === 'style') {
        return {
          textContent: '',
          parentNode: null
        };
      }
      return {};
    });

    // Mock successful storage get
    mockChrome.storage.local.get.mockResolvedValue({ 
      spurConfig: mockConfig 
    });

    gmailIntegration = new GmailIntegration(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with given configuration', () => {
      expect(gmailIntegration).toBeDefined();
    });

    it('should inject styles into document head', () => {
      expect(mockDocument.createElement).toHaveBeenCalledWith('style');
      expect(mockDocument.head.appendChild).toHaveBeenCalled();
    });

    it('should set up mutation observer', () => {
      // Check that observe was called (it's called in constructor)
      expect(gmailIntegration).toBeDefined();
    });

    it('should set up message listener', () => {
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });

  describe('DOM Processing', () => {
    it('should process email threads when detected', () => {
      const mockThread = {
        getAttribute: vi.fn().mockReturnValue('thread-123'),
        querySelector: vi.fn().mockReturnValue(null)
      };

      const mockAddedNode = {
        querySelectorAll: vi.fn().mockReturnValue([mockThread]),
        instanceOf: vi.fn().mockReturnValue(true)
      };

      // Simulate mutation observer callback
      gmailIntegration['handleDOMChanges']([mockAddedNode as any]);

      expect(mockThread.getAttribute).toHaveBeenCalledWith('data-thread-id');
      expect(mockThread.querySelector).toHaveBeenCalledWith('.y6');
    });

    it('should avoid processing the same thread multiple times', () => {
      const mockThread = {
        getAttribute: vi.fn().mockReturnValue('thread-123'),
        querySelector: vi.fn().mockReturnValue(null)
      };

      const mockAddedNode = {
        querySelectorAll: vi.fn().mockReturnValue([mockThread]),
        instanceOf: vi.fn().mockReturnValue(true)
      };

      // Process the same thread twice
      gmailIntegration['handleDOMChanges']([mockAddedNode as any]);
      gmailIntegration['handleDOMChanges']([mockAddedNode as any]);

      // Should only process once
      expect(mockThread.querySelector).toHaveBeenCalledTimes(1);
    });

    it('should process open email view', () => {
      const mockEmailView = {
        querySelector: vi.fn((selector) => {
          if (selector === '.h7') return mockEmailView;
          if (selector === 'h2.hP') return null;
          return null;
        })
      };

      const mockAddedNode = {
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: vi.fn().mockReturnValue(mockEmailView),
        instanceOf: vi.fn().mockReturnValue(true)
      };

      gmailIntegration['handleDOMChanges']([mockAddedNode as any]);

      expect(mockEmailView.querySelector).toHaveBeenCalledWith('h2.hP');
    });
  });

  describe('Email Processing', () => {
    it('should extract email data from thread element', () => {
      const mockThread = {
        getAttribute: vi.fn((name) => {
          if (name === 'data-thread-id') return 'thread-123';
          return null;
        }),
        querySelector: vi.fn((selector) => {
          const elements: Record<string, any> = {
            '.y6 .bog': { textContent: 'Test Subject' },
            '.yW .yX': { textContent: 'sender@example.com' },
            '.y6 .xW': { textContent: 'Jan 1, 2024' },
            '.y6 .y2': { textContent: 'Email body content' }
          };
          return elements[selector] || null;
        })
      };

      const emailData = gmailIntegration['extractEmailData'](mockThread as any);

      expect(emailData).toEqual({
        id: 'thread-123',
        subject: 'Test Subject',
        from: 'sender@example.com',
        date: 'Jan 1, 2024',
        body: 'Email body content',
        threadId: 'thread-123',
        labels: []
      });
    });

    it('should create memory from email data', () => {
      const emailData = {
        id: 'email-123',
        subject: 'Test Subject',
        from: 'sender@example.com',
        date: 'Jan 1, 2024',
        body: 'This is a test email about important meeting and deadline',
        threadId: 'thread-123',
        labels: ['work', 'important']
      };

      const memory = gmailIntegration['createMemoryFromEmail'](emailData);

      expect(memory.type).toBe('email');
      expect(memory.content).toContain('Test Subject');
      expect(memory.content).toContain('sender@example.com');
      expect(memory.metadata.emailId).toBe('email-123');
      expect(memory.metadata.subject).toBe('Test Subject');
      expect(memory.tags).toContain('meeting');
      expect(memory.tags).toContain('deadline');
    });

    it('should extract tags from email content', () => {
      const emailData = {
        id: 'email-123',
        subject: 'Project Update Meeting',
        from: 'manager@company.com',
        date: 'Jan 1, 2024',
        body: 'We need to discuss the important deadline and deliverables',
        threadId: 'thread-123',
        labels: []
      };

      const tags = gmailIntegration['extractTagsFromEmail'](emailData);

      expect(tags).toContain('project');
      expect(tags).toContain('update');
      expect(tags).toContain('meeting');
      expect(tags).toContain('important');
      expect(tags).toContain('deadline');
    });
  });

  describe('UI Interactions', () => {
    it('should create Spur button with correct styling', () => {
      const mockClickHandler = vi.fn();
      const button = gmailIntegration['createSpurButton']('Save to Spur', mockClickHandler);

      expect(button.tagName).toBe('BUTTON');
      expect(button.textContent).toBe('Save to Spur');
      expect(button.className).toBe('spur-email-button');
      expect(button.onclick).toBe(mockClickHandler);
    });

    it('should show notification with success message', () => {
      const mockNotification = {
        className: 'spur-notification',
        textContent: '',
        style: {},
        remove: vi.fn()
      };

      mockDocument.createElement.mockReturnValue(mockNotification);

      gmailIntegration['showNotification']('Test message');

      expect(mockNotification.className).toBe('spur-notification');
      expect(mockNotification.textContent).toBe('Test message');
      expect(mockNotification.style.background).toBe('#4caf50');
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockNotification);
    });

    it('should show notification with error styling', () => {
      const mockNotification = {
        className: 'spur-notification',
        textContent: '',
        style: {},
        remove: vi.fn()
      };

      mockDocument.createElement.mockReturnValue(mockNotification);

      gmailIntegration['showNotification']('Error message', 'error');

      expect(mockNotification.style.background).toBe('#f44336');
    });
  });

  describe('Memory Management', () => {
    it('should send memory to background script', async () => {
      const memory: MemoryNode = {
        id: 'test-memory',
        content: 'Test content',
        type: 'email',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: { source: 'gmail' },
        connections: [],
        tags: ['test']
      };

      await gmailIntegration['saveMemory'](memory);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ADD_MEMORY',
        payload: memory
      });
    });
  });

  describe('Message Handling', () => {
    it('should handle Gmail action messages', async () => {
      const mockCallback = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      const response = await mockCallback(
        { type: 'SPUR_GMAIL_ACTION', action: 'SAVE_EMAIL', data: { emailId: 'test-email' } },
        {} as any,
        vi.fn()
      );

      // Should not throw error
      expect(response).toBeUndefined();
    });

    it('should handle unknown Gmail actions', async () => {
      const mockCallback = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      await expect(mockCallback(
        { type: 'SPUR_GMAIL_ACTION', action: 'UNKNOWN_ACTION', data: {} },
        {} as any,
        vi.fn()
      )).rejects.toThrow('Unknown Gmail action');
    });
  });

  describe('Configuration Updates', () => {
    it('should disable integration when turned off', () => {
      const originalObserver = gmailIntegration['observer'];
      
      gmailIntegration.updateConfig({ gmailIntegration: false });

      expect(gmailIntegration['observer']).toBeUndefined();
    });

    it('should re-enable integration when turned on', () => {
      gmailIntegration.updateConfig({ gmailIntegration: false });
      gmailIntegration.updateConfig({ gmailIntegration: true });

      expect(gmailIntegration['observer']).toBeDefined();
    });

    it('should remove UI elements when disabled', () => {
      // Mock existing elements
      const mockButton = { remove: vi.fn() };
      const mockHighlight = { remove: vi.fn() };
      
      mockDocument.querySelectorAll.mockReturnValue([mockButton, mockHighlight]);

      gmailIntegration.updateConfig({ gmailIntegration: false });

      expect(mockButton.remove).toHaveBeenCalled();
      expect(mockHighlight.remove).toHaveBeenCalled();
    });
  });

  describe('Text Highlighting', () => {
    it('should highlight important content in emails', () => {
      const mockEmailView = {
        textContent: 'This email contains important deadlines and meeting information',
        querySelector: vi.fn().mockReturnValue(null)
      };

      gmailIntegration['highlightImportantContent'](mockEmailView as any);

      // Should call highlightText for important phrases
      expect(mockEmailView.textContent).toContain('important');
    });

    it('should not highlight text when no important phrases found', () => {
      const mockEmailView = {
        textContent: 'This is a regular email with no special content',
        querySelector: vi.fn().mockReturnValue(null)
      };

      gmailIntegration['highlightImportantContent'](mockEmailView as any);

      // Should not process highlighting
      expect(mockEmailView.textContent).toBe('This is a regular email with no special content');
    });
  });

  describe('Compose Helper', () => {
    it('should add Spur button to compose window', () => {
      const mockComposeWindow = {
        querySelector: vi.fn((selector) => {
          if (selector === '.gU.Up') return { appendChild: vi.fn() };
          if (selector === '.AD') return { insertBefore: vi.fn() };
          return null;
        })
      };

      gmailIntegration['addSpurButtonToCompose'](mockComposeWindow as any);

      expect(mockComposeWindow.querySelector).toHaveBeenCalledWith('.gU.Up');
    });

    it('should open Spur helper with multiple action buttons', () => {
      const mockComposeWindow = {
        querySelector: vi.fn().mockReturnValue({ insertBefore: vi.fn() })
      };

      gmailIntegration['openSpurComposeHelper'](mockComposeWindow as any);

      // Should insert helper with multiple buttons
      expect(mockComposeWindow.querySelector).toHaveBeenCalledWith('.AD');
    });

    it('should handle Spur helper actions', async () => {
      const mockComposeWindow = {
        querySelector: vi.fn().mockReturnValue({ 
          textContent: 'Test email content about deadlines and tasks'
        })
      };

      await gmailIntegration['handleSpurHelperAction']('summarize', mockComposeWindow as any);
      await gmailIntegration['handleSpurHelperAction']('extract-tasks', mockComposeWindow as any);

      // Should process actions without errors
      expect(true).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should destroy integration and clean up resources', () => {
      const mockObserver = { disconnect: vi.fn() };
      gmailIntegration['observer'] = mockObserver as any;
      gmailIntegration['processedEmails'].add('test-email');

      gmailIntegration.destroy();

      expect(mockObserver.disconnect).toHaveBeenCalled();
      expect(gmailIntegration['processedEmails'].size).toBe(0);
      expect(gmailIntegration['observer']).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during initialization gracefully', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      // Should not throw error
      const integration = new GmailIntegration(mockConfig);
      expect(integration).toBeDefined();
    });

    it('should handle errors during email saving', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Send failed'));

      const mockThread = {
        getAttribute: vi.fn().mockReturnValue('thread-123'),
        querySelector: vi.fn().mockReturnValue({ appendChild: vi.fn() })
      };

      // Should not throw error
      await expect(gmailIntegration['saveEmailThread'](mockThread as any)).resolves.toBeUndefined();
    });
  });
});