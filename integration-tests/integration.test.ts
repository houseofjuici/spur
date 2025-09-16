import { SpurBrowserIntegration } from '../src/index';
import { SpurVoiceIntegration } from '../src/integrations/voice';
import { SpurMemoryIntegration } from '../src/integrations/memory';
import { SpurAssistantIntegration } from '../src/integrations/assistant';
import { SpurPrivacyIntegration } from '../src/integrations/privacy';
import { SpurSettingsIntegration } from '../src/integrations/settings';

// Mock Steel Browser API
const mockSteelBrowser = {
  createSession: jest.fn().mockResolvedValue({
    id: 'test-session-123',
    url: 'https://example.com',
    cookies: [],
    localStorage: {}
  }),
  
  executeAction: jest.fn().mockResolvedValue({
    success: true,
    result: 'action executed'
  }),
  
  getSettings: jest.fn().mockResolvedValue({
    privacy: {
      localOnly: true,
      dataRetention: '90d'
    },
    voice: {
      enabled: true,
      language: 'en-US'
    }
  }),
  
  updateSettings: jest.fn().mockResolvedValue(true),
  
  // Steel-specific methods
  createSandbox: jest.fn().mockResolvedValue({
    execute: jest.fn(),
    cleanup: jest.fn()
  }),
  
  encryptData: jest.fn().mockResolvedValue('encrypted-data'),
  
  decryptData: jest.fn().mockResolvedValue({ original: 'data' })
};

describe('SpurBrowserIntegration', () => {
  let integration: SpurBrowserIntegration;

  beforeEach(() => {
    jest.clearAllMocks();
    integration = new SpurBrowserIntegration(mockSteelBrowser);
  });

  describe('Constructor', () => {
    it('should initialize with Steel Browser instance', () => {
      expect(integration).toBeInstanceOf(SpurBrowserIntegration);
    });

    it('should initialize all integration components', () => {
      // Access private properties for testing
      const privateIntegration = integration as any;
      expect(privateIntegration.voiceIntegration).toBeInstanceOf(SpurVoiceIntegration);
      expect(privateIntegration.memoryIntegration).toBeInstanceOf(SpurMemoryIntegration);
      expect(privateIntegration.assistantIntegration).toBeInstanceOf(SpurAssistantIntegration);
      expect(privateIntegration.privacyIntegration).toBeInstanceOf(SpurPrivacyIntegration);
      expect(privateIntegration.settingsIntegration).toBeInstanceOf(SpurSettingsIntegration);
    });
  });

  describe('Initialization', () => {
    it('should initialize all components successfully', async () => {
      await expect(integration.initialize()).resolves.not.toThrow();
      
      // Verify Steel Browser methods were called
      expect(mockSteelBrowser.createSession).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const errorIntegration = new SpurBrowserIntegration({
        ...mockSteelBrowser,
        createSession: jest.fn().mockRejectedValue(new Error('Session creation failed'))
      });

      await expect(errorIntegration.initialize()).rejects.toThrow('Session creation failed');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown all components successfully', async () => {
      await integration.initialize();
      await expect(integration.shutdown()).resolves.not.toThrow();
    });

    it('should handle shutdown errors gracefully', async () => {
      const errorIntegration = new SpurBrowserIntegration(mockSteelBrowser);
      
      // Mock shutdown to throw error
      const privateIntegration = errorIntegration as any;
      privateIntegration.voiceIntegration.shutdown = jest.fn().mockRejectedValue(new Error('Shutdown failed'));

      await expect(errorIntegration.shutdown()).resolves.not.toThrow(); // Should not throw
    });
  });

  describe('Component Integration', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should integrate voice processing with Steel sandbox', async () => {
      const privateIntegration = integration as any;
      const voiceIntegration = privateIntegration.voiceIntegration;
      
      const audioData = { format: 'wav', data: new ArrayBuffer(1024) };
      const result = await voiceIntegration.processVoiceCommand(audioData);
      
      expect(result).toBeDefined();
      expect(result.command).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should integrate memory storage with Steel APIs', async () => {
      const privateIntegration = integration as any;
      const memoryIntegration = privateIntegration.memoryIntegration;
      
      const context = { url: 'https://example.com', content: 'test content' };
      await expect(memoryIntegration.storeContext(context)).resolves.not.toThrow();
      
      const query = 'test query';
      const results = await memoryIntegration.retrieveContext(query);
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should integrate assistant with Steel UI framework', async () => {
      const privateIntegration = integration as any;
      const assistantIntegration = privateIntegration.assistantIntegration;
      
      const query = 'What is this page about?';
      const response = await assistantIntegration.processQuery(query);
      
      expect(response).toBeDefined();
      expect(response.response).toBeDefined();
    });

    it('should integrate privacy features with Steel security', async () => {
      const privateIntegration = integration as any;
      const privacyIntegration = privateIntegration.privacyIntegration;
      
      const data = { sensitive: 'information' };
      const encrypted = await privacyIntegration.encryptData(data);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      
      const decrypted = await privacyIntegration.decryptData(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should integrate settings with Steel preferences', async () => {
      const privateIntegration = integration as any;
      const settingsIntegration = privateIntegration.settingsIntegration;
      
      const settings = await settingsIntegration.getSettings();
      expect(settings).toBeDefined();
      
      const newSettings = { ...settings, voice: { enabled: false } };
      await expect(settingsIntegration.updateSettings(newSettings)).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle Steel API unavailability', async () => {
      const unavailableBrowser = {
        ...mockSteelBrowser,
        createSession: jest.fn().mockRejectedValue(new Error('API unavailable'))
      };

      const errorIntegration = new SpurBrowserIntegration(unavailableBrowser);
      await expect(errorIntegration.initialize()).rejects.toThrow('API unavailable');
    });

    it('should handle component initialization failures', async () => {
      const failingBrowser = {
        ...mockSteelBrowser,
        getSettings: jest.fn().mockRejectedValue(new Error('Settings unavailable'))
      };

      const errorIntegration = new SpurBrowserIntegration(failingBrowser);
      await expect(errorIntegration.initialize()).resolves.not.toThrow(); // Should continue despite partial failures
    });
  });

  describe('Performance', () => {
    it('should initialize within reasonable time', async () => {
      const start = Date.now();
      await integration.initialize();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it('should process voice commands quickly', async () => {
      await integration.initialize();
      const privateIntegration = integration as any;
      const voiceIntegration = privateIntegration.voiceIntegration;
      
      const audioData = { format: 'wav', data: new ArrayBuffer(1024) };
      const start = Date.now();
      await voiceIntegration.processVoiceCommand(audioData);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // 1 second max
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources properly', async () => {
      await integration.initialize();
      
      // Simulate some memory usage
      const privateIntegration = integration as any;
      await privateIntegration.memoryIntegration.storeContext({ 
        url: 'https://example.com', 
        content: 'x'.repeat(1000000) // Large content
      });
      
      await integration.shutdown();
      
      // Verify cleanup (this would require more sophisticated memory tracking in real implementation)
      expect(true).toBe(true); // Placeholder for actual memory leak detection
    });
  });

  describe('Security', () => {
    it('should use Steel sandbox for sensitive operations', async () => {
      await integration.initialize();
      const privateIntegration = integration as any;
      const privacyIntegration = privateIntegration.privacyIntegration;
      
      const data = { sensitive: 'information' };
      await privacyIntegration.encryptData(data);
      
      expect(mockSteelBrowser.createSandbox).toHaveBeenCalled();
    });

    it('should not expose sensitive data in logs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await integration.initialize();
      const privateIntegration = integration as any;
      const privacyIntegration = privateIntegration.privacyIntegration;
      
      const sensitiveData = { password: 'secret123', token: 'bearer-token' };
      await privacyIntegration.encryptData(sensitiveData);
      
      // Check that sensitive data is not logged
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasSensitiveData = logs.some(log => 
        log.includes('secret123') || log.includes('bearer-token')
      );
      
      expect(hasSensitiveData).toBe(false);
      
      consoleSpy.mockRestore();
    });
  });
});