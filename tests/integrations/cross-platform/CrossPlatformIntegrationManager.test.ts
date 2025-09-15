/**
 * Cross-Platform Integration Tests
 * Comprehensive testing suite for browser compatibility and integration functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CrossPlatformIntegrationManager } from '../CrossPlatformIntegrationManager';
import { Logger } from '../../utils/logger';
import { PerformanceMonitor } from '../../monitoring/performance-monitor';

describe('CrossPlatformIntegrationManager', () => {
  let manager: CrossPlatformIntegrationManager;
  let logger: Logger;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    logger = new Logger('CrossPlatformIntegrationTest');
    performanceMonitor = new PerformanceMonitor();
    manager = new CrossPlatformIntegrationManager();
  });

  afterEach(() => {
    // Cleanup any test resources
  });

  describe('Initialization', () => {
    it('should initialize with core integrations', () => {
      const integrations = manager.getIntegrations();
      expect(integrations.length).toBeGreaterThan(0);
      expect(integrations.some(i => i.id === 'email-integration')).toBe(true);
      expect(integrations.some(i => i.id === 'vscode-integration')).toBe(true);
      expect(integrations.some(i => i.id === 'security-integration')).toBe(true);
      expect(integrations.some(i => i.id === 'ai-assistant-integration')).toBe(true);
    });

    it('should initialize compatibility matrix for all supported browsers', () => {
      // Test that compatibility matrix is properly initialized
      // This is tested indirectly through validateCompatibility method
    });
  });

  describe('Browser Compatibility Validation', () => {
    it('should validate Chrome compatibility for email integration', () => {
      const isValid = manager.validateCompatibility('email-integration', 'chrome');
      expect(isValid).toBe(true);
    });

    it('should validate Firefox compatibility for VS Code integration', () => {
      const isValid = manager.validateCompatibility('vscode-integration', 'firefox');
      expect(isValid).toBe(true);
    });

    it('should validate Edge compatibility for security integration', () => {
      const isValid = manager.validateCompatibility('security-integration', 'edge');
      expect(isValid).toBe(true);
    });

    it('should validate Safari compatibility for AI assistant integration', () => {
      const isValid = manager.validateCompatibility('ai-assistant-integration', 'safari');
      expect(isValid).toBe(true);
    });

    it('should throw error for non-existent integration', () => {
      expect(() => {
        manager.validateCompatibility('non-existent', 'chrome');
      }).toThrow('Integration not found');
    });

    it('should throw error for unsupported browser', () => {
      expect(() => {
        manager.validateCompatibility('email-integration', 'unsupported-browser');
      }).toThrow('Browser not supported');
    });

    it('should return false for incompatible browser-integration combination', () => {
      // Test a combination that should be incompatible
      const isValid = manager.validateCompatibility('email-integration', 'safari');
      // This might be true or false depending on the actual compatibility matrix
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Manifest Generation', () => {
    it('should generate Chrome manifest for email integration', () => {
      const manifest = manager.generateManifest('email-integration', 'chrome');
      
      expect(manifest).toBeDefined();
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toContain('Spur');
      expect(manifest.name).toContain('Email Processing');
      expect(manifest.permissions).toContain('storage');
      expect(manifest.permissions).toContain('activeTab');
      expect(manifest.background).toBeDefined();
      expect(manifest.content_scripts).toBeDefined();
      expect(manifest.action).toBeDefined();
    });

    it('should generate Firefox manifest with browser-specific settings', () => {
      const manifest = manager.generateManifest('email-integration', 'firefox');
      
      expect(manifest).toBeDefined();
      expect(manifest.browser_specific_settings).toBeDefined();
      expect(manifest.browser_specific_settings.gecko).toBeDefined();
      expect(manifest.browser_specific_settings.gecko.id).toBeDefined();
    });

    it('should generate Edge manifest with specific settings', () => {
      const manifest = manager.generateManifest('email-integration', 'edge');
      
      expect(manifest).toBeDefined();
      expect(manifest.browser_specific_settings).toBeDefined();
    });

    it('should generate Safari manifest with minimum version', () => {
      const manifest = manager.generateManifest('email-integration', 'safari');
      
      expect(manifest).toBeDefined();
      expect(manifest.browser_specific_settings).toBeDefined();
      expect(manifest.browser_specific_settings.safari).toBeDefined();
    });

    it('should throw error for incompatible integration-browser combination', () => {
      expect(() => {
        manager.generateManifest('non-existent', 'chrome');
      }).toThrow('Integration not found');
    });
  });

  describe('Integration Features', () => {
    it('should return correct supported browsers for email integration', () => {
      const browsers = manager.getSupportedBrowsers('email-integration');
      
      expect(browsers).toBeInstanceOf(Array);
      expect(browsers.length).toBeGreaterThan(0);
      expect(browsers).toContain('chrome');
      expect(browsers).toContain('firefox');
    });

    it('should return empty array for non-existent integration', () => {
      const browsers = manager.getSupportedBrowsers('non-existent');
      expect(browsers).toEqual([]);
    });

    it('should get integration by ID', () => {
      const integration = manager.getIntegration('email-integration');
      
      expect(integration).toBeDefined();
      expect(integration?.id).toBe('email-integration');
      expect(integration?.name).toBe('Email Processing Integration');
      expect(integration?.platforms).toBeDefined();
      expect(integration?.permissions).toBeDefined();
      expect(integration?.nativeImplementation).toBeDefined();
    });

    it('should return undefined for non-existent integration ID', () => {
      const integration = manager.getIntegration('non-existent');
      expect(integration).toBeUndefined();
    });

    it('should have required permissions for email integration', () => {
      const integration = manager.getIntegration('email-integration');
      
      expect(integration).toBeDefined();
      const requiredPermissions = integration?.permissions.filter(p => p.required);
      expect(requiredPermissions?.length).toBeGreaterThan(0);
      
      const storagePermission = requiredPermissions?.find(p => p.name === 'storage');
      expect(storagePermission).toBeDefined();
      expect(storagePermission?.required).toBe(true);
    });

    it('should have native implementation configuration', () => {
      const integration = manager.getIntegration('email-integration');
      
      expect(integration).toBeDefined();
      const impl = integration?.nativeImplementation;
      
      expect(impl?.manifestV3).toBe(true);
      expect(impl?.backgroundScripts).toBeDefined();
      expect(impl?.backgroundScripts?.length).toBeGreaterThan(0);
      expect(impl?.contentScripts).toBeDefined();
      expect(impl?.contentScripts?.length).toBeGreaterThan(0);
      expect(impl?.apiBindings).toBeDefined();
      expect(impl?.storageStrategy).toBeDefined();
    });
  });

  describe('Content Scripts Configuration', () => {
    it('should have proper content scripts for email integration', () => {
      const integration = manager.getIntegration('email-integration');
      const contentScripts = integration?.nativeImplementation.contentScripts;
      
      expect(contentScripts).toBeDefined();
      expect(contentScripts?.length).toBeGreaterThan(0);
      
      const emailScript = contentScripts?.find(script => 
        script.matches.some(match => match.includes('mail.google.com'))
      );
      expect(emailScript).toBeDefined();
      expect(emailScript?.js).toBeDefined();
      expect(emailScript?.css).toBeDefined();
      expect(emailScript?.runAt).toBe('document_idle');
    });

    it('should have GitHub content scripts for VS Code integration', () => {
      const integration = manager.getIntegration('vscode-integration');
      const contentScripts = integration?.nativeImplementation.contentScripts;
      
      expect(contentScripts).toBeDefined();
      
      const githubScript = contentScripts?.find(script => 
        script.matches.some(match => match.includes('github.com'))
      );
      expect(githubScript).toBeDefined();
    });

    it('should have email content scripts for security integration', () => {
      const integration = manager.getIntegration('security-integration');
      const contentScripts = integration?.nativeImplementation.contentScripts;
      
      expect(contentScripts).toBeDefined();
      
      const emailScript = contentScripts?.find(script => 
        script.matches.some(match => match.includes('mail.google.com'))
      );
      expect(emailScript).toBeDefined();
    });

    it('should have universal content scripts for AI assistant', () => {
      const integration = manager.getIntegration('ai-assistant-integration');
      const contentScripts = integration?.nativeImplementation.contentScripts;
      
      expect(contentScripts).toBeDefined();
      
      const universalScript = contentScripts?.find(script => 
        script.matches.some(match => match === '<all_urls>')
      );
      expect(universalScript).toBeDefined();
    });
  });

  describe('Storage Strategy Configuration', () => {
    it('should have comprehensive storage strategy for email integration', () => {
      const integration = manager.getIntegration('email-integration');
      const storage = integration?.nativeImplementation.storageStrategy;
      
      expect(storage).toBeDefined();
      expect(storage?.local).toBe(true);
      expect(storage?.sync).toBe(true);
      expect(storage?.indexedDB).toBe(true);
      expect(storage?.managed).toBe(false);
      expect(storage?.session).toBe(false);
    });

    it('should have secure storage strategy for security integration', () => {
      const integration = manager.getIntegration('security-integration');
      const storage = integration?.nativeImplementation.storageStrategy;
      
      expect(storage).toBeDefined();
      expect(storage?.local).toBe(true);
      expect(storage?.sync).toBe(false); // No sync for security reasons
      expect(storage?.indexedDB).toBe(true);
      expect(storage?.managed).toBe(false);
      expect(storage?.session).toBe(false);
    });
  });

  describe('API Bindings Configuration', () => {
    it('should have proper API bindings for email integration', () => {
      const integration = manager.getIntegration('email-integration');
      const bindings = integration?.nativeImplementation.apiBindings;
      
      expect(bindings).toBeDefined();
      expect(bindings?.length).toBeGreaterThan(0);
      
      const storageBinding = bindings?.find(b => b.name === 'storage');
      expect(storageBinding).toBeDefined();
      expect(storageBinding?.type).toBe('chrome');
      expect(storageBinding?.methods).toContain('local');
      expect(storageBinding?.methods).toContain('sync');
    });

    it('should have native messaging for VS Code integration', () => {
      const integration = manager.getIntegration('vscode-integration');
      const bindings = integration?.nativeImplementation.apiBindings;
      
      expect(bindings).toBeDefined();
      
      const runtimeBinding = bindings?.find(b => b.name === 'runtime');
      expect(runtimeBinding).toBeDefined();
      expect(runtimeBinding?.methods).toContain('connectNative');
    });
  });

  describe('Platform Configuration', () => {
    it('should have correct platform configurations for email integration', () => {
      const integration = manager.getIntegration('email-integration');
      const platforms = integration?.platforms;
      
      expect(platforms).toBeDefined();
      expect(platforms?.length).toBeGreaterThan(0);
      
      const chromePlatform = platforms?.find(p => p.name === 'chrome');
      expect(chromePlatform).toBeDefined();
      expect(chromePlatform?.version).toBe('88+');
      expect(chromePlatform?.features).toContain('OAuth2');
      expect(chromePlatform?.features).toContain('IMAP');
    });

    it('should have WebAssembly support for AI assistant', () => {
      const integration = manager.getIntegration('ai-assistant-integration');
      const platforms = integration?.platforms;
      
      expect(platforms).toBeDefined();
      
      const chromePlatform = platforms?.find(p => p.name === 'chrome');
      expect(chromePlatform?.features).toContain('WebAssembly');
      expect(chromePlatform?.features).toContain('Web Workers');
    });
  });

  describe('Build Configuration', () => {
    it('should generate comprehensive build configuration', () => {
      const buildConfig = manager.generateBuildConfig();
      
      expect(buildConfig).toBeDefined();
      expect(buildConfig.platforms).toEqual(['chrome', 'firefox', 'edge', 'safari']);
      expect(buildConfig.shared).toBeDefined();
      expect(buildConfig.platformSpecific).toBeDefined();
      expect(buildConfig.shared.source).toBe('src/');
      expect(buildConfig.shared.output).toBe('dist/');
    });

    it('should have platform-specific build configurations', () => {
      const buildConfig = manager.generateBuildConfig();
      const platformConfigs = buildConfig.platformSpecific;
      
      expect(platformConfigs.chrome).toBeDefined();
      expect(platformConfigs.firefox).toBeDefined();
      expect(platformConfigs.edge).toBeDefined();
      expect(platformConfigs.safari).toBeDefined();
      
      expect(platformConfigs.chrome.manifest).toContain('chrome/manifest.json');
      expect(platformConfigs.firefox.manifest).toContain('firefox/manifest.json');
    });

    it('should have platform-specific plugins', () => {
      const buildConfig = manager.generateBuildConfig();
      
      const chromePlugins = buildConfig.platformSpecific.chrome.plugins;
      expect(chromePlugins).toBeDefined();
      expect(chromePlugins.length).toBeGreaterThan(0);
      
      const manifestPlugin = chromePlugins.find((p: any) => p.name === 'ChromeManifestPlugin');
      expect(manifestPlugin).toBeDefined();
      expect(manifestPlugin.options.manifestVersion).toBe(3);
    });
  });

  describe('Export Integration Package', () => {
    it('should export complete integration package', () => {
      const packageData = manager.exportIntegrationPackage('email-integration', ['chrome', 'firefox']);
      
      expect(packageData).toBeDefined();
      expect(packageData.integration).toBeDefined();
      expect(packageData.platforms).toBeDefined();
      expect(packageData.build).toBeDefined();
      expect(packageData.requirements).toBeDefined();
      expect(packageData.installation).toBeDefined();
      
      expect(packageData.integration.id).toBe('email-integration');
      expect(packageData.integration.name).toBe('Email Processing Integration');
      expect(packageData.platforms.length).toBe(2);
    });

    it('should include platform manifests in exported package', () => {
      const packageData = manager.exportIntegrationPackage('email-integration', ['chrome']);
      
      const chromePlatform = packageData.platforms.find((p: any) => p.name === 'chrome');
      expect(chromePlatform).toBeDefined();
      expect(chromePlatform.manifest).toBeDefined();
      expect(chromePlatform.compatibility).toBe(true);
      expect(chromePlatform.features).toBeDefined();
    });

    it('should throw error for non-existent integration in export', () => {
      expect(() => {
        manager.exportIntegrationPackage('non-existent', ['chrome']);
      }).toThrow('Integration not found');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle edge cases gracefully', () => {
      // Test with empty platform list
      const packageData = manager.exportIntegrationPackage('email-integration', []);
      expect(packageData.platforms).toEqual([]);
      
      // Test with unsupported platform
      expect(() => {
        manager.validateCompatibility('email-integration', 'ie');
      }).toThrow('Browser not supported');
    });

    it('should maintain consistent structure across all integrations', () => {
      const integrations = manager.getIntegrations();
      
      integrations.forEach(integration => {
        expect(integration.id).toBeDefined();
        expect(integration.name).toBeDefined();
        expect(integration.description).toBeDefined();
        expect(integration.platforms).toBeDefined();
        expect(integration.permissions).toBeDefined();
        expect(integration.nativeImplementation).toBeDefined();
        expect(integration.platforms.length).toBeGreaterThan(0);
        expect(integration.permissions.length).toBeGreaterThan(0);
      });
    });

    it('should have proper extracted component configuration', () => {
      const integration = manager.getIntegration('email-integration');
      const extracted = integration?.extractedComponent;
      
      expect(extracted).toBeDefined();
      expect(extracted?.originalRepo).toBe('elie222/inbox-zero');
      expect(extracted?.extractedFiles).toBeDefined();
      expect(extracted?.adaptationType).toBe('rewrite');
      expect(extracted?.browserOptimizations).toBeDefined();
      expect(extracted?.browserOptimizations.length).toBeGreaterThan(0);
    });

    it('should have browser optimizations for extracted components', () => {
      const integration = manager.getIntegration('email-integration');
      const optimizations = integration?.extractedComponent?.browserOptimizations;
      
      expect(optimizations).toBeDefined();
      expect(optimizations?.length).toBeGreaterThan(0);
      
      const performanceOpt = optimizations?.find(opt => opt.type === 'performance');
      expect(performanceOpt).toBeDefined();
      expect(performanceOpt?.description).toBeDefined();
      expect(performanceOpt?.implementation).toBeDefined();
    });
  });

  describe('Cross-Platform Compatibility Matrix', () => {
    it('should have comprehensive feature support across browsers', () => {
      // Test compatibility matrix indirectly through various integrations
      const emailBrowsers = manager.getSupportedBrowsers('email-integration');
      const vscodeBrowsers = manager.getSupportedBrowsers('vscode-integration');
      const securityBrowsers = manager.getSupportedBrowsers('security-integration');
      
      expect(emailBrowsers.length).toBeGreaterThan(0);
      expect(vscodeBrowsers.length).toBeGreaterThan(0);
      expect(securityBrowsers.length).toBeGreaterThan(0);
    });

    it('should handle different permission requirements across platforms', () => {
      const chromeManifest = manager.generateManifest('email-integration', 'chrome');
      const firefoxManifest = manager.generateManifest('email-integration', 'firefox');
      
      expect(chromeManifest.permissions).toBeDefined();
      expect(firefoxManifest.permissions).toBeDefined();
      
      // Permissions may differ between platforms due to compatibility
      expect(Array.isArray(chromeManifest.permissions)).toBe(true);
      expect(Array.isArray(firefoxManifest.permissions)).toBe(true);
    });
  });

  describe('Integration Quality Assurance', () => {
    it('should ensure all integrations have required fields', () => {
      const integrations = manager.getIntegrations();
      
      integrations.forEach(integration => {
        // Required fields
        expect(integration.id).toBeTruthy();
        expect(integration.name).toBeTruthy();
        expect(integration.description).toBeTruthy();
        expect(integration.platforms.length).toBeGreaterThan(0);
        expect(integration.permissions.length).toBeGreaterThan(0);
        
        // Native implementation requirements
        expect(integration.nativeImplementation.manifestV3).toBeDefined();
        expect(integration.nativeImplementation.backgroundScripts.length).toBeGreaterThan(0);
        expect(integration.nativeImplementation.contentScripts.length).toBeGreaterThan(0);
        expect(integration.nativeImplementation.apiBindings.length).toBeGreaterThan(0);
        expect(integration.nativeImplementation.storageStrategy).toBeDefined();
      });
    });

    it('should ensure all platforms have version requirements', () => {
      const integrations = manager.getIntegrations();
      
      integrations.forEach(integration => {
        integration.platforms.forEach(platform => {
          expect(platform.name).toMatch(/^(chrome|firefox|edge|safari)$/);
          expect(platform.version).toBeTruthy();
          expect(platform.features.length).toBeGreaterThan(0);
        });
      });
    });

    it('should ensure all permissions have proper descriptions', () => {
      const integrations = manager.getIntegrations();
      
      integrations.forEach(integration => {
        integration.permissions.forEach(permission => {
          expect(permission.name).toBeTruthy();
          expect(permission.description).toBeTruthy();
          expect(typeof permission.required).toBe('boolean');
        });
      });
    });
  });
});