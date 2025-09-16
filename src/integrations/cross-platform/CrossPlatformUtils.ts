/**
 * Cross-Platform Integration Utilities
 * Helper functions and utilities for browser compatibility and integration management
 */

import { BrowserIntegration, BrowserPlatform, Permission, BrowserNativeImplementation } from './CrossPlatformIntegrationManager';

export interface PlatformFeature {
  name: string;
  description: string;
  chromeSupport: boolean;
  firefoxSupport: boolean;
  edgeSupport: boolean;
  safariSupport: boolean;
  fallback?: string;
}

export interface CompatibilityReport {
  integrationId: string;
  platform: string;
  compatible: boolean;
  supportedFeatures: string[];
  missingFeatures: string[];
  warnings: string[];
  recommendations: string[];
}

export interface BuildTarget {
  platform: string;
  manifestPath: string;
  outputPath: string;
  entryPoints: string[];
  optimizationFlags: string[];
}

/**
 * Platform Feature Compatibility Matrix
 */
export const PLATFORM_FEATURES: PlatformFeature[] = [
  // Storage APIs
  {
    name: 'storage.local',
    description: 'Local storage for extension data',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  {
    name: 'storage.sync',
    description: 'Sync storage across devices',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  {
    name: 'storage.managed',
    description: 'Managed storage for enterprise policies',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Use local storage with enterprise configuration'
  },
  
  // Tab Management
  {
    name: 'tabs',
    description: 'Tab management and manipulation',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  {
    name: 'activeTab',
    description: 'Access to currently active tab',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // Script Injection
  {
    name: 'scripting',
    description: 'Programmatic script injection',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // Background Processing
  {
    name: 'serviceWorker',
    description: 'Service worker for background tasks',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Use background pages (Manifest V2)'
  },
  
  // Native Communication
  {
    name: 'nativeMessaging',
    description: 'Communication with native applications',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // Authentication
  {
    name: 'identity',
    description: 'OAuth2 authentication support',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Use OAuth2 redirect flow'
  },
  
  // Web Request
  {
    name: 'webRequest',
    description: 'HTTP request monitoring and modification',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Use declarativeNetRequest'
  },
  
  // Notifications
  {
    name: 'notifications',
    description: 'Desktop notifications',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // Alarms
  {
    name: 'alarms',
    description: 'Scheduled tasks and alarms',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // Bookmarks
  {
    name: 'bookmarks',
    description: 'Bookmark management',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Use localStorage for bookmark-like functionality'
  },
  
  // History
  {
    name: 'history',
    description: 'Browsing history access',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Implement custom history tracking'
  },
  
  // Downloads
  {
    name: 'downloads',
    description: 'Download management',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Use browser download API via user interaction'
  },
  
  // Contextual Identities (Firefox only)
  {
    name: 'contextualIdentities',
    description: 'Container tabs support',
    chromeSupport: false,
    firefoxSupport: true,
    edgeSupport: false,
    safariSupport: false,
    fallback: 'Use regular tabs with context tracking'
  },
  
  // Proxy Settings
  {
    name: 'proxy',
    description: 'Proxy configuration',
    chromeSupport: false,
    firefoxSupport: true,
    edgeSupport: false,
    safariSupport: false,
    fallback: 'Use system proxy settings'
  },
  
  // Search Engine
  {
    name: 'search',
    description: 'Search engine management',
    chromeSupport: false,
    firefoxSupport: true,
    edgeSupport: false,
    safariSupport: false,
    fallback: 'Use default search engine'
  },
  
  // Context Menus
  {
    name: 'contextMenus',
    description: 'Custom context menu items',
    chromeSupport: true,
    firefoxSupport: false,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Use custom UI overlays'
  },
  
  // Cookies
  {
    name: 'cookies',
    description: 'Cookie management',
    chromeSupport: true,
    firefoxSupport: false,
    edgeSupport: true,
    safariSupport: true,
    fallback: 'Use document.cookie API'
  },
  
  // Top Sites
  {
    name: 'topSites',
    description: 'Most visited sites access',
    chromeSupport: true,
    firefoxSupport: false,
    edgeSupport: true,
    safariSupport: false,
    fallback: 'Implement custom tracking'
  },
  
  // WebCrypto API
  {
    name: 'webcrypto',
    description: 'Cryptographic operations',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // WebAssembly
  {
    name: 'webassembly',
    description: 'WebAssembly support',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // Web Workers
  {
    name: 'webworkers',
    description: 'Web Workers for background processing',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // WebSockets
  {
    name: 'websockets',
    description: 'WebSocket communication',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  },
  
  // IndexedDB
  {
    name: 'indexeddb',
    description: 'IndexedDB database',
    chromeSupport: true,
    firefoxSupport: true,
    edgeSupport: true,
    safariSupport: true
  }
];

/**
 * Utility class for cross-platform integration operations
 */
export class CrossPlatformUtils {
  /**
   * Generate comprehensive compatibility report
   */
  static generateCompatibilityReport(
    integration: BrowserIntegration,
    platform: string
  ): CompatibilityReport {
    const supportedFeatures: string[] = [];
    const missingFeatures: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Get platform configuration
    const platformConfig = integration.platforms.find(p => p.name === platform);
    if (!platformConfig) {
      return {
        integrationId: integration.id,
        platform,
        compatible: false,
        supportedFeatures: [],
        missingFeatures: ['Platform not supported'],
        warnings: ['Integration does not support this platform'],
        recommendations: ['Choose a different platform or update integration']
      };
    }

    // Check feature compatibility
    platformConfig.features.forEach(featureName => {
      const feature = PLATFORM_FEATURES.find(f => f.name === featureName);
      if (feature) {
        const isSupported = this.isFeatureSupported(feature, platform);
        if (isSupported) {
          supportedFeatures.push(featureName);
        } else {
          missingFeatures.push(featureName);
          if (feature.fallback) {
            warnings.push(`${featureName} not supported, consider fallback: ${feature.fallback}`);
            recommendations.push(`Implement fallback for ${featureName}: ${feature.fallback}`);
          } else {
            recommendations.push(`Consider alternative approach for ${featureName}`);
          }
        }
      } else {
        // Custom feature not in matrix
        supportedFeatures.push(featureName);
        warnings.push(`Unknown feature: ${featureName}`);
      }
    });

    // Check required permissions
    const unsupportedPermissions = integration.permissions.filter(permission => {
      if (!permission.required) return false;
      return !this.isPermissionSupported(permission.name, platform);
    });

    if (unsupportedPermissions.length > 0) {
      missingFeatures.push(...unsupportedPermissions.map(p => p.name));
      recommendations.push('Review required permissions for platform compatibility');
    }

    // Generate overall compatibility assessment
    const compatible = missingFeatures.length === 0 && unsupportedPermissions.length === 0;

    // Additional recommendations
    if (compatible) {
      recommendations.push('Integration is fully compatible with this platform');
    } else {
      recommendations.push('Consider implementing fallback mechanisms for missing features');
      recommendations.push('Test thoroughly on target platform');
    }

    // Version-specific warnings
    if (platform === 'safari' && platformConfig.version < '15.0') {
      warnings.push('Older Safari versions have limited extension support');
      recommendations.push('Consider dropping support for Safari < 15.0');
    }

    return {
      integrationId: integration.id,
      platform,
      compatible,
      supportedFeatures,
      missingFeatures,
      warnings,
      recommendations
    };
  }

  /**
   * Check if a feature is supported on a platform
   */
  private static isFeatureSupported(feature: PlatformFeature, platform: string): boolean {
    switch (platform) {
      case 'chrome':
        return feature.chromeSupport;
      case 'firefox':
        return feature.firefoxSupport;
      case 'edge':
        return feature.edgeSupport;
      case 'safari':
        return feature.safariSupport;
      default:
        return false;
    }
  }

  /**
   * Check if a permission is supported on a platform
   */
  private static isPermissionSupported(permissionName: string, platform: string): boolean {
    // Map permissions to features
    const permissionFeatureMap: Record<string, string> = {
      'storage': 'storage.local',
      'tabs': 'tabs',
      'activeTab': 'activeTab',
      'scripting': 'scripting',
      'nativeMessaging': 'nativeMessaging',
      'identity': 'identity',
      'webRequest': 'webRequest',
      'notifications': 'notifications',
      'alarms': 'alarms',
      'bookmarks': 'bookmarks',
      'history': 'history',
      'downloads': 'downloads',
      'cookies': 'cookies',
      'contextMenus': 'contextMenus'
    };

    const featureName = permissionFeatureMap[permissionName];
    if (!featureName) {
      // Unknown permission, assume supported
      return true;
    }

    const feature = PLATFORM_FEATURES.find(f => f.name === featureName);
    if (!feature) {
      return false;
    }

    return this.isFeatureSupported(feature, platform);
  }

  /**
   * Generate build targets for multiple platforms
   */
  static generateBuildTargets(
    integration: BrowserIntegration,
    platforms: string[]
  ): BuildTarget[] {
    return platforms.map(platform => {
      const compatibility = this.generateCompatibilityReport(integration, platform);
      
      return {
        platform,
        manifestPath: `manifests/${platform}/manifest.json`,
        outputPath: `dist/${platform}/`,
        entryPoints: this.generateEntryPoints(integration, platform),
        optimizationFlags: this.generateOptimizationFlags(compatibility)
      };
    }).filter(target => {
      // Filter out incompatible platforms
      const compatibility = this.generateCompatibilityReport(integration, target.platform);
      return compatibility.compatible;
    });
  }

  /**
   * Generate entry points for a platform
   */
  private static generateEntryPoints(
    integration: BrowserIntegration,
    platform: string
  ): string[] {
    const entryPoints: string[] = [];
    
    // Background scripts
    integration.nativeImplementation.backgroundScripts.forEach(script => {
      entryPoints.push(`src/platforms/${platform}/${script}`);
    });
    
    // Content scripts
    integration.nativeImplementation.contentScripts.forEach(script => {
      script.js.forEach(jsFile => {
        entryPoints.push(`src/platforms/${platform}/${jsFile}`);
      });
    });
    
    return entryPoints;
  }

  /**
   * Generate optimization flags based on compatibility report
   */
  private static generateOptimizationFlags(compatibility: CompatibilityReport): string[] {
    const flags: string[] = [
      '--optimize-for-minimum-size',
      '--tree-shaking',
      '--dead-code-elimination'
    ];

    // Add platform-specific optimizations
    if (compatibility.platform === 'safari') {
      flags.push('--safari-optimization');
    } else if (compatibility.platform === 'firefox') {
      flags.push('--firefox-optimization');
    }

    // Add performance optimizations if there are missing features
    if (compatibility.missingFeatures.length > 0) {
      flags.push('--performance-critical');
    }

    return flags;
  }

  /**
   * Generate feature matrix documentation
   */
  static generateFeatureMatrixDocumentation(): string {
    const header = '| Feature | Description | Chrome | Firefox | Edge | Safari | Fallback |\\n';
    const separator = '|---------|-------------|--------|---------|------|--------|----------|\\n';
    
    const rows = PLATFORM_FEATURES.map(feature => {
      const chrome = feature.chromeSupport ? '✅' : '❌';
      const firefox = feature.firefoxSupport ? '✅' : '❌';
      const edge = feature.edgeSupport ? '✅' : '❌';
      const safari = feature.safariSupport ? '✅' : '❌';
      const fallback = feature.fallback || 'None';
      
      return `| ${feature.name} | ${feature.description} | ${chrome} | ${firefox} | ${edge} | ${safari} | ${fallback} |`;
    }).join('\\n');

    return header + separator + rows;
  }

  /**
   * Get recommended platforms for an integration
   */
  static getRecommendedPlatforms(integration: BrowserIntegration): string[] {
    const recommendations: string[] = [];
    
    integration.platforms.forEach(platform => {
      const report = this.generateCompatibilityReport(integration, platform.name);
      if (report.compatible) {
        recommendations.push(platform.name);
      } else if (report.missingFeatures.length <= 2) {
        // Recommend if only minor features are missing
        recommendations.push(platform.name);
      }
    });

    // Sort by compatibility score (fewer missing features = better)
    return recommendations.sort((a, b) => {
      const reportA = this.generateCompatibilityReport(integration, a);
      const reportB = this.generateCompatibilityReport(integration, b);
      return reportA.missingFeatures.length - reportB.missingFeatures.length;
    });
  }

  /**
   * Generate platform-specific optimization suggestions
   */
  static generateOptimizationSuggestions(
    integration: BrowserIntegration,
    platform: string
  ): string[] {
    const suggestions: string[] = [];
    const report = this.generateCompatibilityReport(integration, platform);
    
    // Memory optimizations
    if (report.missingFeatures.includes('storage.sync')) {
      suggestions.push('Implement local storage with sync fallback for cross-device compatibility');
    }
    
    // Performance optimizations
    if (report.missingFeatures.includes('serviceWorker')) {
      suggestions.push('Optimize background page lifecycle for Manifest V2 compatibility');
    }
    
    // Security optimizations
    if (platform === 'safari') {
      suggestions.push('Implement additional security checks for Safari sandboxing');
    }
    
    // Feature-specific optimizations
    if (report.missingFeatures.includes('webRequest')) {
      suggestions.push('Use declarativeNetRequest for content blocking where available');
    }
    
    // General optimizations
    suggestions.push('Implement lazy loading for heavy components');
    suggestions.push('Use Web Workers for CPU-intensive operations');
    suggestions.push('Optimize bundle size with tree shaking');
    
    return suggestions;
  }

  /**
   * Validate integration configuration
   */
  static validateIntegration(integration: BrowserIntegration): string[] {
    const errors: string[] = [];
    
    // Required fields
    if (!integration.id) errors.push('Integration ID is required');
    if (!integration.name) errors.push('Integration name is required');
    if (!integration.description) errors.push('Integration description is required');
    if (!integration.platforms || integration.platforms.length === 0) {
      errors.push('At least one platform configuration is required');
    }
    if (!integration.permissions || integration.permissions.length === 0) {
      errors.push('At least one permission configuration is required');
    }
    
    // Platform validation
    integration.platforms.forEach((platform, index) => {
      if (!platform.name) errors.push(`Platform ${index + 1} name is required`);
      if (!platform.version) errors.push(`Platform ${index + 1} version is required`);
      if (!platform.features || platform.features.length === 0) {
        errors.push(`Platform ${index + 1} must have at least one feature`);
      }
      
      // Validate platform name
      const validPlatforms = ['chrome', 'firefox', 'edge', 'safari'];
      if (!validPlatforms.includes(platform.name)) {
        errors.push(`Invalid platform name: ${platform.name}`);
      }
    });
    
    // Permission validation
    integration.permissions.forEach((permission, index) => {
      if (!permission.name) errors.push(`Permission ${index + 1} name is required`);
      if (!permission.description) errors.push(`Permission ${index + 1} description is required`);
      if (typeof permission.required !== 'boolean') {
        errors.push(`Permission ${index + 1} required flag must be boolean`);
      }
    });
    
    // Native implementation validation
    const impl = integration.nativeImplementation;
    if (!impl.backgroundScripts || impl.backgroundScripts.length === 0) {
      errors.push('At least one background script is required');
    }
    if (!impl.contentScripts || impl.contentScripts.length === 0) {
      errors.push('At least one content script configuration is required');
    }
    if (!impl.apiBindings || impl.apiBindings.length === 0) {
      errors.push('At least one API binding is required');
    }
    if (!impl.storageStrategy) errors.push('Storage strategy is required');
    
    return errors;
  }

  /**
   * Generate platform-specific TypeScript types
   */
  static generatePlatformTypes(platform: string): string {
    const baseTypes = `
// Auto-generated types for ${platform} platform

declare namespace chrome {
  // Core types available across all platforms
  namespace runtime {
    interface Port {
      name: string;
      disconnect(): void;
      postMessage(message: any): void;
    }
    
    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      tlsChannelId?: string;
    }
  }
  
  namespace tabs {
    interface Tab {
      id: number;
      index: number;
      windowId: number;
      openerTabId?: number;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      audible?: boolean;
      discarded?: boolean;
      autoDiscardable?: boolean;
      mutedInfo?: MutedInfo;
      url?: string;
      title?: string;
      favIconUrl?: string;
      status?: string;
      incognito?: boolean;
      width?: number;
      height?: number;
    }
    
    interface MutedInfo {
      muted: boolean;
      extensionId?: string;
      reason?: string;
    }
  }
}`;

    // Add platform-specific types
    let platformSpecificTypes = '';
    
    switch (platform) {
      case 'chrome':
        platformSpecificTypes = `
  // Chrome-specific types
  namespace scripting {
    interface InjectionTarget {
      tabId?: number;
      frameIds?: number[];
      allFrames: boolean;
    }
    
    interface ScriptInjection {
      files?: string[];
      func?: Function;
      target: InjectionTarget;
    }
  }`;
        break;
        
      case 'firefox':
        platformSpecificTypes = `
  // Firefox-specific types
  namespace contextualIdentities {
    interface ContextualIdentity {
      cookieStoreId: string;
      name: string;
      icon: string;
      color: string;
    }
  }`;
        break;
        
      case 'edge':
        platformSpecificTypes = `
  // Edge-specific types
  namespace topSites {
    interface MostVisitedURL {
      url: string;
      title: string;
    }
  }`;
        break;
        
      case 'safari':
        platformSpecificTypes = `
  // Safari-specific types
  namespace extension {
    interface popover {
      height: number;
      width: number;
    }
  }`;
        break;
    }

    return baseTypes + platformSpecificTypes;
  }
}