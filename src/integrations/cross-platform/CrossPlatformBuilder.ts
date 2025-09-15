/**
 * Cross-Platform Integration Builder
 * Build system for generating browser extension packages for multiple platforms
 */

import { CrossPlatformIntegrationManager } from './CrossPlatformIntegrationManager';
import { CrossPlatformUtils, BuildTarget } from './CrossPlatformUtils';
import { Logger } from '../../utils/logger';
import { PerformanceMonitor } from '../../monitoring/performance-monitor';
import * as fs from 'fs';
import * as path from 'path';

export interface BuildConfiguration {
  integrationId: string;
  platforms: string[];
  outputDirectory: string;
  sourceDirectory: string;
  optimizationLevel: 'development' | 'production';
  includeSourceMaps: boolean;
  minify: boolean;
  environment: Record<string, string>;
}

export interface BuildResult {
  success: boolean;
  platform: string;
  outputPath: string;
  manifestPath: string;
  bundleSize: number;
  warnings: string[];
  errors: string[];
  buildTime: number;
}

export interface BuildReport {
  configuration: BuildConfiguration;
  results: BuildResult[];
  summary: {
    totalBuildTime: number;
    successCount: number;
    failureCount: number;
    totalSize: number;
    averageSize: number;
  };
  compatibility: {
    supportedPlatforms: string[];
    unsupportedPlatforms: string[];
    warnings: string[];
  };
}

/**
 * Cross-Platform Build System
 */
export class CrossPlatformBuilder {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private integrationManager: CrossPlatformIntegrationManager;

  constructor() {
    this.logger = new Logger('CrossPlatformBuilder');
    this.performanceMonitor = new PerformanceMonitor();
    this.integrationManager = new CrossPlatformIntegrationManager();
  }

  /**
   * Build integration for multiple platforms
   */
  async build(config: BuildConfiguration): Promise<BuildReport> {
    const startTime = Date.now();
    this.logger.info(`Starting build for integration ${config.integrationId} across platforms: ${config.platforms.join(', ')}`);

    // Validate configuration
    const validationErrors = this.validateBuildConfiguration(config);
    if (validationErrors.length > 0) {
      throw new Error(`Build configuration validation failed: ${validationErrors.join(', ')}`);
    }

    // Get integration
    const integration = this.integrationManager.getIntegration(config.integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${config.integrationId}`);
    }

    // Generate compatibility report
    const supportedPlatforms: string[] = [];
    const unsupportedPlatforms: string[] = [];
    const compatibilityWarnings: string[] = [];

    config.platforms.forEach(platform => {
      const report = CrossPlatformUtils.generateCompatibilityReport(integration, platform);
      if (report.compatible) {
        supportedPlatforms.push(platform);
      } else {
        unsupportedPlatforms.push(platform);
        compatibilityWarnings.push(
          `Platform ${platform} not compatible: ${report.missingFeatures.join(', ')}`
        );
      }
    });

    // Filter to supported platforms
    const buildPlatforms = config.platforms.filter(p => supportedPlatforms.includes(p));
    
    if (buildPlatforms.length === 0) {
      throw new Error('No compatible platforms found for build');
    }

    // Build for each platform
    const results: BuildResult[] = [];
    const buildPromises = buildPlatforms.map(platform => 
      this.buildForPlatform(integration, platform, config)
    );

    try {
      const platformResults = await Promise.allSettled(buildPromises);
      
      platformResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const platform = buildPlatforms[index];
          results.push({
            success: false,
            platform,
            outputPath: '',
            manifestPath: '',
            bundleSize: 0,
            warnings: [],
            errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
            buildTime: 0
          });
        }
      });
    } catch (error) {
      this.logger.error('Build process failed:', error);
      throw error;
    }

    // Generate build report
    const totalTime = Date.now() - startTime;
    const summary = this.generateBuildSummary(results, totalTime);
    
    const buildReport: BuildReport = {
      configuration: config,
      results,
      summary,
      compatibility: {
        supportedPlatforms,
        unsupportedPlatforms,
        warnings: compatibilityWarnings
      }
    };

    // Log build summary
    this.logBuildSummary(buildReport);

    return buildReport;
  }

  /**
   * Build integration for a specific platform
   */
  private async buildForPlatform(
    integration: any,
    platform: string,
    config: BuildConfiguration
  ): Promise<BuildResult> {
    const startTime = Date.now();
    const outputPath = path.join(config.outputDirectory, platform);
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      this.logger.info(`Building for platform: ${platform}`);

      // Create output directory
      await this.ensureDirectory(outputPath);

      // Generate manifest
      const manifest = this.integrationManager.generateManifest(integration.id, platform);
      const manifestPath = path.join(outputPath, 'manifest.json');
      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // Copy assets
      await this.copyAssets(config.sourceDirectory, outputPath);

      // Build platform-specific files
      await this.buildPlatformFiles(integration, platform, config, outputPath);

      // Optimize build
      if (config.optimizationLevel === 'production') {
        await this.optimizeBuild(outputPath, platform, warnings);
      }

      // Generate source maps if requested
      if (config.includeSourceMaps) {
        await this.generateSourceMaps(outputPath, platform);
      }

      // Calculate bundle size
      const bundleSize = await this.calculateBundleSize(outputPath);

      const buildTime = Date.now() - startTime;

      this.logger.info(`Successfully built for ${platform} in ${buildTime}ms, size: ${bundleSize} bytes`);

      return {
        success: true,
        platform,
        outputPath,
        manifestPath,
        bundleSize,
        warnings,
        errors,
        buildTime
      };

    } catch (error) {
      const buildTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error(`Failed to build for ${platform}: ${errorMessage}`);
      errors.push(errorMessage);

      return {
        success: false,
        platform,
        outputPath,
        manifestPath: '',
        bundleSize: 0,
        warnings,
        errors,
        buildTime
      };
    }
  }

  /**
   * Validate build configuration
   */
  private validateBuildConfiguration(config: BuildConfiguration): string[] {
    const errors: string[] = [];

    if (!config.integrationId) {
      errors.push('Integration ID is required');
    }

    if (!config.platforms || config.platforms.length === 0) {
      errors.push('At least one platform is required');
    }

    if (!config.outputDirectory) {
      errors.push('Output directory is required');
    }

    if (!config.sourceDirectory) {
      errors.push('Source directory is required');
    }

    const validPlatforms = ['chrome', 'firefox', 'edge', 'safari'];
    config.platforms.forEach(platform => {
      if (!validPlatforms.includes(platform)) {
        errors.push(`Invalid platform: ${platform}`);
      }
    });

    const validOptimizationLevels = ['development', 'production'];
    if (!validOptimizationLevels.includes(config.optimizationLevel)) {
      errors.push(`Invalid optimization level: ${config.optimizationLevel}`);
    }

    return errors;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Copy assets to output directory
   */
  private async copyAssets(sourceDir: string, outputDir: string): Promise<void> {
    const assetsDir = path.join(sourceDir, 'assets');
    
    if (await this.pathExists(assetsDir)) {
      const outputAssetsDir = path.join(outputDir, 'assets');
      await this.ensureDirectory(outputAssetsDir);
      
      // Copy all assets
      await this.copyDirectory(assetsDir, outputAssetsDir);
    }

    // Copy icons
    const iconsDir = path.join(sourceDir, 'icons');
    if (await this.pathExists(iconsDir)) {
      await this.copyDirectory(iconsDir, path.join(outputDir, 'icons'));
    }
  }

  /**
   * Build platform-specific files
   */
  private async buildPlatformFiles(
    integration: any,
    platform: string,
    config: BuildConfiguration,
    outputPath: string
  ): Promise<void> {
    const platformDir = path.join(config.sourceDirectory, 'platforms', platform);
    
    if (!(await this.pathExists(platformDir))) {
      // Create default platform files
      await this.createDefaultPlatformFiles(integration, platform, outputPath);
      return;
    }

    // Copy platform-specific files
    await this.copyDirectory(platformDir, outputPath);

    // Process and adapt files for platform
    await this.adaptFilesForPlatform(outputPath, platform);
  }

  /**
   * Create default platform files
   */
  private async createDefaultPlatformFiles(
    integration: any,
    platform: string,
    outputPath: string
  ): Promise<void> {
    const impl = integration.nativeImplementation;

    // Create background script
    const backgroundScript = this.generateBackgroundScript(impl, platform);
    const backgroundPath = path.join(outputPath, 'background.js');
    await fs.promises.writeFile(backgroundPath, backgroundScript);

    // Create content scripts
    for (const contentScript of impl.contentScripts) {
      const contentScriptPath = path.join(outputPath, 'content-script.js');
      const contentScriptCode = this.generateContentScript(contentScript, platform);
      await fs.promises.writeFile(contentScriptPath, contentScriptCode);
    }

    // Create popup
    await this.createPopup(outputPath, platform);
  }

  /**
   * Generate background script
   */
  private generateBackgroundScript(impl: any, platform: string): string {
    return `
// Generated background script for ${platform}

// Import required modules
const browserAPI = typeof chrome !== 'undefined' ? chrome : browser;

// Background script initialization
class BackgroundService {
  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      await this.setupEventListeners();
      await this.initializeStorage();
      await this.startBackgroundProcesses();
      console.log('Spur background service initialized for ${platform}');
    } catch (error) {
      console.error('Failed to initialize background service:', error);
    }
  }

  async setupEventListeners() {
    // Extension installation/update
    browserAPI.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details);
    });

    // Message handling
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });

    // Tab updates (if applicable)
    if (browserAPI.tabs) {
      browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        this.handleTabUpdate(tabId, changeInfo, tab);
      });
    }
  }

  async initializeStorage() {
    // Initialize storage areas
    if (browserAPI.storage) {
      try {
        await browserAPI.storage.local.set({ initialized: true });
        console.log('Storage initialized');
      } catch (error) {
        console.error('Storage initialization failed:', error);
      }
    }
  }

  async startBackgroundProcesses() {
    // Start background processes like alarms, etc.
    if (browserAPI.alarms) {
      browserAPI.alarms.create('periodicSync', { periodInMinutes: 5 });
      browserAPI.alarms.onAlarm.addListener((alarm) => {
        this.handleAlarm(alarm);
      });
    }
  }

  handleInstall(details) {
    console.log('Extension installed/updated:', details.reason);
    
    // Handle first-time setup
    if (details.reason === 'install') {
      this.performFirstTimeSetup();
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('Received message:', message);
    
    try {
      const response = await this.processMessage(message, sender);
      sendResponse({ success: true, data: response });
    } catch (error) {
      console.error('Message processing failed:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
  }

  async processMessage(message, sender) {
    // Process different message types
    switch (message.type) {
      case 'getData':
        return await this.getData(message.payload);
      case 'setData':
        return await this.setData(message.payload);
      case 'executeAction':
        return await this.executeAction(message.payload);
      default:
        throw new Error('Unknown message type: ' + message.type);
    }
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    // Handle tab updates for content script injection
    if (changeInfo.status === 'complete' && tab.url) {
      this.injectContentScripts(tabId, tab.url);
    }
  }

  async injectContentScripts(tabId, url) {
    // Logic to inject content scripts based on URL patterns
    // This would be implementation-specific
  }

  handleAlarm(alarm) {
    console.log('Alarm triggered:', alarm.name);
    
    switch (alarm.name) {
      case 'periodicSync':
        this.performPeriodicSync();
        break;
    }
  }

  async performFirstTimeSetup() {
    console.log('Performing first-time setup');
    
    // Initialize default settings
    const defaultSettings = {
      version: '${platform}-1.0.0',
      enabled: true,
      preferences: {}
    };
    
    if (browserAPI.storage) {
      await browserAPI.storage.local.set(defaultSettings);
    }
  }

  async performPeriodicSync() {
    console.log('Performing periodic sync');
    
    // Background synchronization logic
    // This would be implementation-specific
  }

  async getData(payload) {
    // Data retrieval logic
    return { status: 'success', data: payload };
  }

  async setData(payload) {
    // Data storage logic
    return { status: 'success' };
  }

  async executeAction(payload) {
    // Action execution logic
    return { status: 'success' };
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
`;
  }

  /**
   * Generate content script
   */
  private generateContentScript(contentScript: any, platform: string): string {
    return `
// Generated content script for ${platform}

// Content script initialization
class ContentScriptManager {
  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      await this.injectUI();
      await this.setupEventListeners();
      await this.initializeCommunication();
      console.log('Content script initialized for ${platform}');
    } catch (error) {
      console.error('Content script initialization failed:', error);
    }
  }

  async injectUI() {
    // Inject UI elements into the page
    this.createStyles();
    this.createOverlay();
  }

  createStyles() {
    const styles = \`
      .spur-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: none;
      }
      
      .spur-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      
      .spur-button {
        background: #007cba;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .spur-button:hover {
        background: #005a9e;
      }
    \`;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  createOverlay() {
    // Create main overlay
    const overlay = document.createElement('div');
    overlay.className = 'spur-overlay';
    overlay.id = 'spur-overlay';
    
    const panel = document.createElement('div');
    panel.className = 'spur-panel';
    panel.id = 'spur-panel';
    
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'spur-button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => this.hideOverlay());
    
    panel.appendChild(closeButton);
  }

  async setupEventListeners() {
    // Listen for messages from background script
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    // Listen for DOM changes
    this.observeDOMChanges();
  }

  async initializeCommunication() {
    // Initialize communication with background script
    await this.sendMessageToBackground({ type: 'contentScriptReady' });
  }

  observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      this.handleDOMChanges(mutations);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  handleDOMChanges(mutations) {
    // Handle DOM changes for dynamic content detection
    // This would be implementation-specific
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('Content script received message:', message);
    
    try {
      const response = await this.processMessage(message, sender);
      sendResponse({ success: true, data: response });
    } catch (error) {
      console.error('Message processing failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async processMessage(message, sender) {
    switch (message.type) {
      case 'showPanel':
        return this.showPanel(message.data);
      case 'hidePanel':
        return this.hidePanel();
      case 'updateContent':
        return this.updateContent(message.data);
      default:
        throw new Error('Unknown message type: ' + message.type);
    }
  }

  async sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      browserAPI.runtime.sendMessage(message, (response) => {
        if (browserAPI.runtime.lastError) {
          reject(browserAPI.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  showPanel(content) {
    const overlay = document.getElementById('spur-overlay');
    const panel = document.getElementById('spur-panel');
    
    if (content) {
      panel.innerHTML = \`
        <h2>Spur Integration</h2>
        <div class="spur-content">\${content}</div>
        <button class="spur-button" onclick="document.getElementById('spur-overlay').style.display='none'">Close</button>
      \`;
    }
    
    overlay.style.display = 'block';
  }

  hidePanel() {
    const overlay = document.getElementById('spur-overlay');
    overlay.style.display = 'none';
  }

  updateContent(data) {
    const panel = document.getElementById('spur-panel');
    if (panel) {
      const contentDiv = panel.querySelector('.spur-content');
      if (contentDiv) {
        contentDiv.innerHTML = data;
      }
    }
  }
}

// Initialize content script
const contentScriptManager = new ContentScriptManager();
`;
  }

  /**
   * Create popup HTML
   */
  private async createPopup(outputPath: string, platform: string): Promise<void> {
    const popupHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Spur Integration</title>
  <style>
    body {
      width: 400px;
      min-height: 300px;
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    
    .header h1 {
      margin: 0;
      color: #333;
      font-size: 18px;
    }
    
    .content {
      background: white;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    
    .status {
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    
    .status.connected {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    
    .status.disconnected {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    
    .button {
      background: #007cba;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      width: 100%;
      margin-bottom: 10px;
    }
    
    .button:hover {
      background: #005a9e;
    }
    
    .button.secondary {
      background: #6c757d;
    }
    
    .button.secondary:hover {
      background: #545b62;
    }
    
    .settings {
      margin-top: 20px;
    }
    
    .setting-item {
      margin-bottom: 10px;
    }
    
    .setting-item label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }
    
    .setting-item input, .setting-item select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Spur Integration</h1>
    <p>Platform: ${platform}</p>
  </div>
  
  <div class="content">
    <div id="status" class="status disconnected">
      Initializing...
    </div>
    
    <button class="button" onclick="checkConnection()">Check Connection</button>
    <button class="button secondary" onclick="openDashboard()">Open Dashboard</button>
    
    <div class="settings">
      <h3>Settings</h3>
      
      <div class="setting-item">
        <label for="enableIntegration">Enable Integration</label>
        <input type="checkbox" id="enableIntegration" checked>
      </div>
      
      <div class="setting-item">
        <label for="syncFrequency">Sync Frequency</label>
        <select id="syncFrequency">
          <option value="5">5 minutes</option>
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
        </select>
      </div>
    </div>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>`;

    const popupPath = path.join(outputPath, 'popup.html');
    await fs.promises.writeFile(popupPath, popupHTML);

    // Create popup script
    const popupJS = `
// Popup script for ${platform}

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
});

async function initializePopup() {
  await checkConnection();
  await loadSettings();
  setupEventListeners();
}

async function checkConnection() {
  const statusDiv = document.getElementById('status');
  
  try {
    const response = await sendMessageToBackground({ type: 'getStatus' });
    
    if (response.success && response.data.connected) {
      statusDiv.className = 'status connected';
      statusDiv.textContent = 'Connected to Spur services';
    } else {
      statusDiv.className = 'status disconnected';
      statusDiv.textContent = 'Disconnected from Spur services';
    }
  } catch (error) {
    statusDiv.className = 'status disconnected';
    statusDiv.textContent = 'Connection error: ' + error.message;
  }
}

async function loadSettings() {
  try {
    const response = await sendMessageToBackground({ type: 'getSettings' });
    
    if (response.success) {
      const settings = response.data;
      
      document.getElementById('enableIntegration').checked = settings.enabled !== false;
      document.getElementById('syncFrequency').value = settings.syncFrequency || '15';
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function setupEventListeners() {
  document.getElementById('enableIntegration').addEventListener('change', async (e) => {
    await saveSetting('enabled', e.target.checked);
  });
  
  document.getElementById('syncFrequency').addEventListener('change', async (e) => {
    await saveSetting('syncFrequency', e.target.value);
  });
}

async function saveSetting(key, value) {
  try {
    await sendMessageToBackground({ 
      type: 'setSettings', 
      data: { [key]: value } 
    });
  } catch (error) {
    console.error('Failed to save setting:', error);
  }
}

async function openDashboard() {
  try {
    await sendMessageToBackground({ type: 'openDashboard' });
    window.close();
  } catch (error) {
    console.error('Failed to open dashboard:', error);
  }
}

async function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}
`;

    const popupJSPath = path.join(outputPath, 'popup.js');
    await fs.promises.writeFile(popupJSPath, popupJS);
  }

  /**
   * Adapt files for platform
   */
  private async adaptFilesForPlatform(outputPath: string, platform: string): Promise<void> {
    // Platform-specific adaptations
    switch (platform) {
      case 'firefox':
        await this.adaptForFirefox(outputPath);
        break;
      case 'safari':
        await this.adaptForSafari(outputPath);
        break;
      case 'edge':
        await this.adaptForEdge(outputPath);
        break;
    }
  }

  /**
   * Adapt for Firefox
   */
  private async adaptForFirefox(outputPath: string): Promise<void> {
    // Firefox-specific adaptations
    // This would include browser API adaptations and manifest modifications
  }

  /**
   * Adapt for Safari
   */
  private async adaptForSafari(outputPath: string): Promise<void> {
    // Safari-specific adaptations
    // This would include Safari-specific API adaptations
  }

  /**
   * Adapt for Edge
   */
  private async adaptForEdge(outputPath: string): Promise<void> {
    // Edge-specific adaptations
    // This would include Edge-specific API adaptations
  }

  /**
   * Optimize build
   */
  private async optimizeBuild(outputPath: string, platform: string, warnings: string[]): Promise<void> {
    // Implementation of build optimization
    // This would include minification, tree shaking, etc.
  }

  /**
   * Generate source maps
   */
  private async generateSourceMaps(outputPath: string, platform: string): Promise<void> {
    // Implementation of source map generation
  }

  /**
   * Calculate bundle size
   */
  private async calculateBundleSize(outputPath: string): Promise<number> {
    let totalSize = 0;
    
    const files = await this.readdirRecursive(outputPath);
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.html') || file.endsWith('.css')) {
        const stats = await fs.promises.stat(file);
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }

  /**
   * Generate build summary
   */
  private generateBuildSummary(results: BuildResult[], totalTime: number): BuildReport['summary'] {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const totalSize = results.reduce((sum, r) => sum + r.bundleSize, 0);
    const averageSize = successCount > 0 ? totalSize / successCount : 0;

    return {
      totalBuildTime: totalTime,
      successCount,
      failureCount,
      totalSize,
      averageSize
    };
  }

  /**
   * Log build summary
   */
  private logBuildSummary(report: BuildReport): void> {
    this.logger.info('Build Summary:');
    this.logger.info(`- Total time: ${report.summary.totalBuildTime}ms`);
    this.logger.info(`- Successful builds: ${report.summary.successCount}`);
    this.logger.info(`- Failed builds: ${report.summary.failureCount}`);
    this.logger.info(`- Total bundle size: ${report.summary.totalSize} bytes`);
    this.logger.info(`- Average bundle size: ${Math.round(report.summary.averageSize)} bytes`);
    
    if (report.compatibility.warnings.length > 0) {
      this.logger.warn('Compatibility warnings:');
      report.compatibility.warnings.forEach(warning => {
        this.logger.warn(`  - ${warning}`);
      });
    }
  }

  /**
   * Utility functions
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  private async readdirRecursive(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.readdirRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}