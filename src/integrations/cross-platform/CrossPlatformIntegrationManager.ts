/**
 * Cross-Platform Integration Manager
 * Migrates various integrations to native browser implementations
 * ensuring compatibility across Chrome, Firefox, Edge, and Safari
 */

import { OpenSourceExtractor } from '../integrations/extraction/OpenSourceExtractor';
import { LicenseValidator } from '../integrations/extraction/LicenseValidator';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { Logger } from '../utils/logger';

export interface BrowserIntegration {
  id: string;
  name: string;
  description: string;
  platforms: BrowserPlatform[];
  permissions: Permission[];
  nativeImplementation: BrowserNativeImplementation;
  extractedComponent?: ExtractedComponent;
}

export interface BrowserPlatform {
  name: 'chrome' | 'firefox' | 'edge' | 'safari';
  version: string;
  features: string[];
}

export interface Permission {
  name: string;
  description: string;
  required: boolean;
  alternatives?: string[];
}

export interface BrowserNativeImplementation {
  manifestV3: boolean;
  backgroundScripts: string[];
  contentScripts: ContentScriptConfig[];
  apiBindings: ApiBinding[];
  storageStrategy: StorageStrategy;
}

export interface ContentScriptConfig {
  matches: string[];
  js: string[];
  css?: string[];
  runAt: 'document_start' | 'document_end' | 'document_idle';
}

export interface ApiBinding {
  name: string;
  type: 'chrome' | 'webextension' | 'custom';
  methods: string[];
  fallback?: string;
}

export interface StorageStrategy {
  local: boolean;
  sync: boolean;
  managed: boolean;
  session: boolean;
  indexedDB: boolean;
}

export interface ExtractedComponent {
  originalRepo: string;
  extractedFiles: string[];
  adaptationType: 'wrapper' | 'rewrite' | 'hybrid';
  browserOptimizations: BrowserOptimization[];
}

export interface BrowserOptimization {
  type: 'memory' | 'performance' | 'compatibility' | 'security';
  description: string;
  implementation: string;
}

/**
 * Cross-Platform Integration Manager
 */
export class CrossPlatformIntegrationManager {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private extractor: OpenSourceExtractor;
  private licenseValidator: LicenseValidator;
  private integrations: Map<string, BrowserIntegration> = new Map();
  private compatibilityMatrix: Map<string, Set<string>> = new Map();

  constructor() {
    this.logger = new Logger('CrossPlatformIntegration');
    this.performanceMonitor = new PerformanceMonitor();
    this.extractor = new OpenSourceExtractor();
    this.licenseValidator = new LicenseValidator();
    
    this.initializeCompatibilityMatrix();
    this.initializeCoreIntegrations();
  }

  /**
   * Initialize browser compatibility matrix
   */
  private initializeCompatibilityMatrix() {
    // Chrome compatibility
    this.compatibilityMatrix.set('chrome', new Set([
      'storage', 'tabs', 'activeTab', 'scripting', 'alarms',
      'bookmarks', 'history', 'downloads', 'notifications',
      'nativeMessaging', 'identity', 'webRequest', 'webNavigation'
    ]));

    // Firefox compatibility
    this.compatibilityMatrix.set('firefox', new Set([
      'storage', 'tabs', 'activeTab', 'scripting', 'alarms',
      'bookmarks', 'history', 'downloads', 'notifications',
      'nativeMessaging', 'identity', 'webRequest', 'webNavigation',
      'contextualIdentities', 'dns', 'proxy', 'search'
    ]));

    // Edge compatibility
    this.compatibilityMatrix.set('edge', new Set([
      'storage', 'tabs', 'activeTab', 'scripting', 'alarms',
      'bookmarks', 'history', 'downloads', 'notifications',
      'nativeMessaging', 'identity', 'webRequest', 'webNavigation',
      'contextMenus', 'cookies', 'topSites'
    ]));

    // Safari compatibility
    this.compatibilityMatrix.set('safari', new Set([
      'storage', 'tabs', 'activeTab', 'scripting', 'alarms',
      'bookmarks', 'notifications', 'nativeMessaging',
      'contextualIdentities', 'cookies'
    ]));
  }

  /**
   * Initialize core cross-platform integrations
   */
  private initializeCoreIntegrations() {
    const coreIntegrations: BrowserIntegration[] = [
      // Email Integration (Gmail/Outlook)
      {
        id: 'email-integration',
        name: 'Email Processing Integration',
        description: 'Native browser email processing with Inbox Zero methodology',
        platforms: [
          { name: 'chrome', version: '88+', features: ['OAuth2', 'IMAP', 'WebSockets'] },
          { name: 'firefox', version: '90+', features: ['OAuth2', 'IMAP', 'WebSockets'] },
          { name: 'edge', version: '88+', features: ['OAuth2', 'IMAP', 'WebSockets'] },
          { name: 'safari', version: '15+', features: ['OAuth2', 'IMAP'] }
        ],
        permissions: [
          { name: 'storage', description: 'Store email metadata and preferences', required: true },
          { name: 'activeTab', description: 'Access current tab for email processing', required: true },
          { name: 'scripting', description: 'Inject email processing scripts', required: true },
          { name: 'identity', description: 'OAuth2 authentication for email providers', required: true },
          { name: 'notifications', description: 'Email notifications and reminders', required: false },
          { name: 'alarms', description: 'Scheduled email checking', required: false }
        ],
        nativeImplementation: {
          manifestV3: true,
          backgroundScripts: [
            'background/email-processor.js',
            'background/oauth-handler.js',
            'background/storage-manager.js'
          ],
          contentScripts: [
            {
              matches: ['https://mail.google.com/*', 'https://outlook.live.com/*'],
              js: ['content/email-processor.js', 'content/ui-overlay.js'],
              css: ['content/email-styles.css'],
              runAt: 'document_idle'
            }
          ],
          apiBindings: [
            { name: 'storage', type: 'chrome', methods: ['local', 'sync', 'managed'] },
            { name: 'identity', type: 'chrome', methods: ['getAuthToken', 'getProfileUserInfo'] },
            { name: 'runtime', type: 'chrome', methods: ['sendMessage', 'connect'] }
          ],
          storageStrategy: {
            local: true,
            sync: true,
            managed: false,
            session: false,
            indexedDB: true
          }
        },
        extractedComponent: {
          originalRepo: 'elie222/inbox-zero',
          extractedFiles: [
            'src/email-processing.js',
            'src/prioritization.js',
            'src/action-extractor.js'
          ],
          adaptationType: 'rewrite',
          browserOptimizations: [
            {
              type: 'performance',
              description: 'Optimize email parsing for browser context',
              implementation: 'Use Web Workers for heavy processing'
            },
            {
              type: 'memory',
              description: 'Memory-efficient email caching',
              implementation: 'Implement LRU cache with IndexedDB'
            }
          ]
        }
      },

      // VS Code Integration
      {
        id: 'vscode-integration',
        name: 'VS Code Companion Integration',
        description: 'Native browser integration for VS Code assistance and code analysis',
        platforms: [
          { name: 'chrome', version: '88+', features: ['WebSockets', 'Service Workers'] },
          { name: 'firefox', version: '90+', features: ['WebSockets', 'Service Workers'] },
          { name: 'edge', version: '88+', features: ['WebSockets', 'Service Workers'] },
          { name: 'safari', version: '15+', features: ['WebSockets', 'Service Workers'] }
        ],
        permissions: [
          { name: 'storage', description: 'Store code patterns and preferences', required: true },
          { name: 'nativeMessaging', description: 'Communicate with VS Code native host', required: true },
          { name: 'notifications', description: 'Code analysis notifications', required: false },
          { name: 'alarms', description: 'Scheduled code analysis', required: false }
        ],
        nativeImplementation: {
          manifestV3: true,
          backgroundScripts: [
            'background/vscode-connector.js',
            'background/code-analyzer.js',
            'background/native-host.js'
          ],
          contentScripts: [
            {
              matches: ['https://github.com/*', 'https://vscode.dev/*'],
              js: ['content/code-insights.js', 'content/github-integration.js'],
              runAt: 'document_idle'
            }
          ],
          apiBindings: [
            { name: 'runtime', type: 'chrome', methods: ['connectNative', 'sendMessage'] },
            { name: 'storage', type: 'chrome', methods: ['local', 'sync'] },
            { name: 'tabs', type: 'chrome', methods: ['query', 'create'] }
          ],
          storageStrategy: {
            local: true,
            sync: true,
            managed: false,
            session: false,
            indexedDB: true
          }
        },
        extractedComponent: {
          originalRepo: 'microsoft/vscode',
          extractedFiles: [
            'src/vs/workbench/api/common/extHostExtensionService.js',
            'src/vs/workbench/api/common/extHostLanguageFeatures.js'
          ],
          adaptationType: 'wrapper',
          browserOptimizations: [
            {
              type: 'compatibility',
              description: 'Bridge VS Code APIs to browser context',
              implementation: 'Native messaging host for API translation'
            }
          ]
        }
      },

      // Security/Encryption Integration
      {
        id: 'security-integration',
        name: 'OpenPGP Security Integration',
        description: 'Native browser PGP encryption using Mailvelope components',
        platforms: [
          { name: 'chrome', version: '88+', features: ['WebCrypto', 'WebAssembly'] },
          { name: 'firefox', version: '90+', features: ['WebCrypto', 'WebAssembly'] },
          { name: 'edge', version: '88+', features: ['WebCrypto', 'WebAssembly'] },
          { name: 'safari', version: '15+', features: ['WebCrypto', 'WebAssembly'] }
        ],
        permissions: [
          { name: 'storage', description: 'Store encryption keys securely', required: true },
          { name: 'activeTab', description: 'Encrypt/decrypt content in current tab', required: true },
          { name: 'scripting', description: 'Inject encryption UI', required: true },
          { name: 'notifications', description: 'Encryption status notifications', required: false }
        ],
        nativeImplementation: {
          manifestV3: true,
          backgroundScripts: [
            'background/crypto-manager.js',
            'background/key-storage.js',
            'background/pgp-engine.js'
          ],
          contentScripts: [
            {
              matches: ['https://mail.google.com/*', 'https://outlook.live.com/*'],
              js: ['content/pgp-handler.js', 'content/encryption-ui.js'],
              css: ['content/encryption-styles.css'],
              runAt: 'document_idle'
            }
          ],
          apiBindings: [
            { name: 'storage', type: 'chrome', methods: ['local', 'managed'] },
            { name: 'runtime', type: 'chrome', methods: ['sendMessage'] },
            { name: 'tabs', type: 'chrome', methods: ['sendMessage'] }
          ],
          storageStrategy: {
            local: true,
            sync: false,
            managed: false,
            session: false,
            indexedDB: true
          }
        },
        extractedComponent: {
          originalRepo: 'mailvelope/mailvelope',
          extractedFiles: [
            'src/crypto/pgp.js',
            'src/keyring/localstorage.js',
            'src/ui/decryptPopup.js'
          ],
          adaptationType: 'hybrid',
          browserOptimizations: [
            {
              type: 'security',
              description: 'Use native WebCrypto API',
              implementation: 'Replace custom crypto with WebCrypto where possible'
            },
            {
              type: 'performance',
              description: 'Optimize PGP operations with WebAssembly',
              implementation: 'Compile OpenPGP.js to WASM for better performance'
            }
          ]
        }
      },

      // AI Assistant Integration
      {
        id: 'ai-assistant-integration',
        name: 'AI Assistant Core Integration',
        description: 'Native browser AI assistant using Leon AI components',
        platforms: [
          { name: 'chrome', version: '88+', features: ['WebAssembly', 'Web Workers'] },
          { name: 'firefox', version: '90+', features: ['WebAssembly', 'Web Workers'] },
          { name: 'edge', version: '88+', features: ['WebAssembly', 'Web Workers'] },
          { name: 'safari', version: '15+', features: ['WebAssembly', 'Web Workers'] }
        ],
        permissions: [
          { name: 'storage', description: 'Store AI models and conversation history', required: true },
          { name: 'activeTab', description: 'Access page content for context', required: true },
          { name: 'scripting', description: 'Inject assistant UI', required: true },
          { name: 'notifications', description: 'Assistant notifications', required: false },
          { name: 'alarms', description: 'Scheduled AI processing', required: false }
        ],
        nativeImplementation: {
          manifestV3: true,
          backgroundScripts: [
            'background/ai-engine.js',
            'background/skill-manager.js',
            'background/nlp-processor.js'
          ],
          contentScripts: [
            {
              matches: ['<all_urls>'],
              js: ['content/assistant-ui.js', 'content/context-extractor.js'],
              css: ['content/assistant-styles.css'],
              runAt: 'document_idle'
            }
          ],
          apiBindings: [
            { name: 'storage', type: 'chrome', methods: ['local', 'sync'] },
            { name: 'runtime', type: 'chrome', methods: ['sendMessage'] },
            { name: 'tabs', type: 'chrome', methods: ['query', 'sendMessage'] }
          ],
          storageStrategy: {
            local: true,
            sync: true,
            managed: false,
            session: false,
            indexedDB: true
          }
        },
        extractedComponent: {
          originalRepo: 'leon-ai/leon',
          extractedFiles: [
            'src/core/brain.js',
            'src/skills/skill-manager.js',
            'src/nlp/nlp.js'
          ],
          adaptationType: 'rewrite',
          browserOptimizations: [
            {
              type: 'memory',
              description: 'Optimize AI model memory usage',
              implementation: 'Use IndexedDB for large model storage'
            },
            {
              type: 'performance',
              description: 'Offline AI processing',
              implementation: 'Implement WebAssembly NLP processing'
            }
          ]
        }
      }
    ];

    // Register all integrations
    coreIntegrations.forEach(integration => {
      this.integrations.set(integration.id, integration);
    });

    this.logger.info(`Initialized ${coreIntegrations.length} cross-platform integrations`);
  }

  /**
   * Validate browser compatibility for integration
   */
  public validateCompatibility(integrationId: string, browser: string): boolean {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    const supportedFeatures = this.compatibilityMatrix.get(browser);
    if (!supportedFeatures) {
      throw new Error(`Browser not supported: ${browser}`);
    }

    const platform = integration.platforms.find(p => p.name === browser);
    if (!platform) {
      return false;
    }

    // Check if required features are supported
    return platform.features.every(feature => supportedFeatures.has(feature));
  }

  /**
   * Generate browser-specific manifest
   */
  public generateManifest(integrationId: string, browser: string): any {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    if (!this.validateCompatibility(integrationId, browser)) {
      throw new Error(`Integration ${integrationId} is not compatible with ${browser}`);
    }

    const platform = integration.platforms.find(p => p.name === browser);
    const manifest = {
      manifest_version: integration.nativeImplementation.manifestV3 ? 3 : 2,
      name: `Spur - ${integration.name}`,
      version: '1.0.0',
      description: integration.description,
      permissions: this.generatePermissions(integration, browser),
      background: this.generateBackgroundConfig(integration, browser),
      content_scripts: integration.nativeImplementation.contentScripts,
      action: {
        default_popup: 'popup/popup.html',
        default_title: `Spur ${integration.name}`,
        default_icon: {
          '16': 'icons/icon16.png',
          '48': 'icons/icon48.png',
          '128': 'icons/icon128.png'
        }
      },
      icons: {
        '16': 'icons/icon16.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png'
      },
      browser_specific_settings: this.generateBrowserSpecificSettings(browser)
    };

    // Add browser-specific configurations
    if (browser === 'firefox') {
      manifest.browser_specific_settings.gecko = {
        id: 'spur-extension@example.com',
        strict_min_version: platform?.version || '90.0'
      };
    }

    return manifest;
  }

  /**
   * Generate browser-specific permissions
   */
  private generatePermissions(integration: BrowserIntegration, browser: string): string[] {
    const supportedFeatures = this.compatibilityMatrix.get(browser);
    if (!supportedFeatures) {
      return [];
    }

    return integration.permissions
      .filter(permission => {
        if (!permission.required) return false;
        return supportedFeatures.has(permission.name);
      })
      .map(permission => permission.name);
  }

  /**
   * Generate background script configuration
   */
  private generateBackgroundConfig(integration: BrowserIntegration, browser: string): any {
    const scripts = integration.nativeImplementation.backgroundScripts;

    if (integration.nativeImplementation.manifestV3) {
      return {
        service_worker: scripts[0], // V3 uses service worker
        type: 'module'
      };
    } else {
      return {
        scripts: scripts,
        persistent: false
      };
    }
  }

  /**
   * Generate browser-specific settings
   */
  private generateBrowserSpecificSettings(browser: string): any {
    switch (browser) {
      case 'firefox':
        return {
          gecko: {
            id: 'spur-extension@example.com',
            strict_min_version: '90.0'
          }
        };
      case 'edge':
        return {
          edge: {
            browser_action_next_to_addressbar: true
          }
        };
      case 'safari':
        return {
          safari: {
            strict_min_version: '15.0'
          }
        };
      default:
        return {};
    }
  }

  /**
   * Extract and adapt open source component
   */
  public async extractAndAdaptComponent(integrationId: string): Promise<ExtractedComponent> {
    const integration = this.integrations.get(integrationId);
    if (!integration || !integration.extractedComponent) {
      throw new Error(`Integration or component not found: ${integrationId}`);
    }

    const component = integration.extractedComponent;
    
    // Validate license compatibility
    const licenseResult = await this.licenseValidator.validateRepository(component.originalRepo);
    if (!licenseResult.compatible) {
      throw new Error(`License not compatible: ${licenseResult.license}`);
    }

    // Extract component files
    const extractedFiles = await this.extractor.extractComponent(
      component.originalRepo,
      component.extractedFiles
    );

    // Apply browser optimizations
    const optimizedFiles = await this.applyBrowserOptimizations(
      extractedFiles,
      component.browserOptimizations
    );

    return {
      ...component,
      extractedFiles: optimizedFiles
    };
  }

  /**
   * Apply browser optimizations to extracted files
   */
  private async applyBrowserOptimizations(
    files: string[],
    optimizations: BrowserOptimization[]
  ): Promise<string[]> {
    let optimizedFiles = [...files];

    for (const optimization of optimizations) {
      this.logger.info(`Applying ${optimization.type} optimization: ${optimization.description}`);
      
      switch (optimization.type) {
        case 'performance':
          optimizedFiles = await this.optimizeForPerformance(optimizedFiles);
          break;
        case 'memory':
          optimizedFiles = await this.optimizeForMemory(optimizedFiles);
          break;
        case 'compatibility':
          optimizedFiles = await this.optimizeForCompatibility(optimizedFiles);
          break;
        case 'security':
          optimizedFiles = await this.optimizeForSecurity(optimizedFiles);
          break;
      }
    }

    return optimizedFiles;
  }

  /**
   * Optimize files for performance
   */
  private async optimizeForPerformance(files: string[]): Promise<string[]> {
    // Implement performance optimizations
    return files.map(file => {
      // Add Web Worker usage for heavy processing
      if (file.includes('processor') || file.includes('analyzer')) {
        return file.replace(
          /function (\w+)\s*\(/g,
          'self.onmessage = function(e) { const result = (function $1('
        );
      }
      return file;
    });
  }

  /**
   * Optimize files for memory usage
   */
  private async optimizeForMemory(files: string[]): Promise<string[]> {
    // Implement memory optimizations
    return files.map(file => {
      // Add memory management patterns
      if (file.includes('cache') || file.includes('storage')) {
        return file.replace(
          /new Map\(\)/g,
          'new LRUMap(1000)' // Replace with LRU cache
        );
      }
      return file;
    });
  }

  /**
   * Optimize files for browser compatibility
   */
  private async optimizeForCompatibility(files: string[]): Promise<string[]> {
    // Implement compatibility optimizations
    return files.map(file => {
      // Add browser API compatibility layers
      if (file.includes('chrome.') || file.includes('browser.')) {
        return `
          // Browser API compatibility layer
          const browserAPI = typeof chrome !== 'undefined' ? chrome : browser;
          ${file.replace(/chrome\./g, 'browserAPI.')}
        `;
      }
      return file;
    });
  }

  /**
   * Optimize files for security
   */
  private async optimizeForSecurity(files: string[]): Promise<string[]> {
    // Implement security optimizations
    return files.map(file => {
      // Add security best practices
      if (file.includes('crypto') || file.includes('encryption')) {
        return `
          // Security enhancement: Use WebCrypto API
          ${file.replace(
            /require\(['"]crypto['"]\)/g,
            'window.crypto.subtle'
          )}
        `;
      }
      return file;
    });
  }

  /**
   * Generate cross-platform build configuration
   */
  public generateBuildConfig(): any {
    const buildConfig = {
      platforms: ['chrome', 'firefox', 'edge', 'safari'],
      shared: {
        source: 'src/',
        output: 'dist/',
        assets: ['assets/', 'icons/'],
        scripts: {
          build: 'webpack --config webpack.config.js',
          test: 'jest',
          lint: 'eslint src/'
        }
      },
      platformSpecific: {}
    };

    // Generate platform-specific configurations
    buildConfig.platforms.forEach(platform => {
      buildConfig.platformSpecific[platform] = {
        manifest: `manifests/${platform}/manifest.json`,
        entry: {
          background: `src/platforms/${platform}/background.js`,
          content: `src/platforms/${platform}/content.js`
        },
        output: {
          path: `dist/${platform}/`,
          filename: '[name].js'
        },
        plugins: this.getPlatformSpecificPlugins(platform)
      };
    });

    return buildConfig;
  }

  /**
   * Get platform-specific build plugins
   */
  private getPlatformSpecificPlugins(platform: string): any[] {
    const plugins = [];

    switch (platform) {
      case 'chrome':
        plugins.push({
          name: 'ChromeManifestPlugin',
          options: {
            manifestVersion: 3,
            background: 'service_worker'
          }
        });
        break;
      case 'firefox':
        plugins.push({
          name: 'FirefoxManifestPlugin',
          options: {
            browserSpecificSettings: {
              gecko: {
                id: 'spur-extension@example.com'
              }
            }
          }
        });
        break;
      case 'edge':
        plugins.push({
          name: 'EdgeManifestPlugin',
          options: {
            browserActionNextToAddressbar: true
          }
        });
        break;
      case 'safari':
        plugins.push({
          name: 'SafariManifestPlugin',
          options: {
            strictMinVersion: '15.0'
          }
        });
        break;
    }

    return plugins;
  }

  /**
   * Get all integrations
   */
  public getIntegrations(): BrowserIntegration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get integration by ID
   */
  public getIntegration(id: string): BrowserIntegration | undefined {
    return this.integrations.get(id);
  }

  /**
   * Get supported browsers for integration
   */
  public getSupportedBrowsers(integrationId: string): string[] {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      return [];
    }

    return integration.platforms.map(p => p.name).filter(browser => 
      this.validateCompatibility(integrationId, browser)
    );
  }

  /**
   * Export integration package
   */
  public exportIntegrationPackage(integrationId: string, platforms: string[]): any {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    const packageData = {
      integration: {
        id: integration.id,
        name: integration.name,
        description: integration.description,
        version: '1.0.0'
      },
      platforms: platforms.map(browser => ({
        name: browser,
        manifest: this.generateManifest(integrationId, browser),
        compatibility: this.validateCompatibility(integrationId, browser),
        features: integration.platforms.find(p => p.name === browser)?.features || []
      })),
      build: this.generateBuildConfig(),
      extractedComponent: integration.extractedComponent,
      requirements: {
        node: '>=16.0.0',
        npm: '>=8.0.0'
      },
      installation: {
        development: 'npm install',
        build: 'npm run build',
        test: 'npm run test'
      }
    };

    return packageData;
  }
}