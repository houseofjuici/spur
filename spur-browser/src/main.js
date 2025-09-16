const { app, BrowserWindow, ipcMain, Menu, globalShortcut, Tray } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const store = require('electron-store');
const { machineIdSync } = require('node-machine-id');
const si = require('systeminformation');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Global references
let mainWindow = null;
let tray = null;
let isQuitting = false;

// Spur integration modules
const SpurIntegration = require('./src/spur-integration');
const SpurVoice = require('./src/native/voice');
const SpurMemory = require('./src/native/memory');
const SpurAssistant = require('./src/native/assistant');

// Configuration store
const config = new store({
  defaults: {
    window: {
      width: 1400,
      height: 900,
      x: undefined,
      y: undefined
    },
    features: {
      voiceEnabled: true,
      assistantEnabled: true,
      memoryEnabled: true,
      nativeNotifications: true,
      systemTray: true
    },
    privacy: {
      dataCollection: false,
      crashReporting: false,
      localProcessing: true
    },
    developer: {
      devMode: false,
      showDevTools: false
    }
  }
});

class SpurBrowser {
  constructor() {
    this.spurIntegration = null;
    this.spurVoice = null;
    this.spurMemory = null;
    this.spurAssistant = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      log.info('Initializing Spur Browser...');
      
      // Initialize native Spur components
      await this.initializeSpurComponents();
      
      // Set up app event handlers
      this.setupAppHandlers();
      
      // Create main window
      await this.createMainWindow();
      
      // Set up system integration
      this.setupSystemIntegration();
      
      this.isInitialized = true;
      log.info('Spur Browser initialized successfully');
      
    } catch (error) {
      log.error('Failed to initialize Spur Browser:', error);
      throw error;
    }
  }

  async initializeSpurComponents() {
    log.info('Initializing Spur native components...');
    
    // Initialize voice processing with privacy guarantees
    this.spurVoice = new SpurVoice({
      localProcessing: true,
      zeroAudioRetention: true,
      maxRecordingTime: 30000, // 30 seconds max
      wakeWord: 'hey spur'
    });

    // Initialize memory graph with browser integration
    this.spurMemory = new SpurMemory({
      storagePath: path.join(app.getPath('userData'), 'memory'),
      browserHistoryIntegration: true,
      sandboxEnabled: true,
      maxMemoryNodes: 1000000
    });

    // Initialize assistant system
    this.spurAssistant = new SpurAssistant({
      memoryGraph: this.spurMemory,
      voiceProcessor: this.spurVoice,
      localProcessing: config.get('privacy.localProcessing'),
      contextWindow: 10000
    });

    // Initialize main integration layer
    this.spurIntegration = new SpurIntegration({
      voice: this.spurVoice,
      memory: this.spurMemory,
      assistant: this.spurAssistant,
      browserWindow: mainWindow
    });

    log.info('Spur components initialized');
  }

  setupAppHandlers() {
    // App ready event
    app.whenReady().then(() => {
      this.onReady();
    });

    // Window all closed event
    app.on('window-all-closed', () => {
      this.onWindowAllClosed();
    });

    // Activate event (macOS)
    app.on('activate', () => {
      this.onActivate();
    });

    // Before quit event
    app.on('before-quit', () => {
      isQuitting = true;
    });

    // Will quit event
    app.on('will-quit', () => {
      this.cleanup();
    });
  }

  async onReady() {
    try {
      log.info('Application ready, creating main window...');
      
      // Set up auto-updater
      this.setupAutoUpdater();
      
      // Create main window
      await this.createMainWindow();
      
      // Set up system tray
      if (config.get('features.systemTray')) {
        this.setupSystemTray();
      }
      
      // Set up global shortcuts
      this.setupGlobalShortcuts();
      
      // Initialize Spur components if window is ready
      if (mainWindow) {
        await this.spurIntegration.initialize();
      }
      
      log.info('Spur Browser ready');
      
    } catch (error) {
      log.error('Error in onReady:', error);
    }
  }

  async createMainWindow() {
    try {
      const windowOptions = config.get('window');
      
      mainWindow = new BrowserWindow({
        width: windowOptions.width,
        height: windowOptions.height,
        x: windowOptions.x,
        y: windowOptions.y,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: false,
          additionalArguments: ['--enable-precise-memory-info', '--enable-gpu-rasterization']
        },
        title: 'Spur Browser',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false,
        backgroundColor: '#1a1a1a'
      });

      // Load the browser UI
      mainWindow.loadFile(path.join(__dirname, 'src', 'browser', 'index.html'));

      // Show window when ready
      mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Show dev tools in development mode
        if (config.get('developer.showDevTools')) {
          mainWindow.webContents.openDevTools();
        }
      });

      // Handle window close
      mainWindow.on('close', (e) => {
        if (!isQuitting && config.get('features.systemTray')) {
          e.preventDefault();
          mainWindow.hide();
          log.info('Window hidden to system tray');
        }
      });

      // Handle window closed
      mainWindow.on('closed', () => {
        mainWindow = null;
        log.info('Main window closed');
      });

      // Handle window move/resize
      mainWindow.on('move', () => {
        const [x, y] = mainWindow.getPosition();
        config.set('window.x', x);
        config.set('window.y', y);
      });

      mainWindow.on('resize', () => {
        const [width, height] = mainWindow.getSize();
        config.set('window.width', width);
        config.set('window.height', height);
      });

      // Set up IPC handlers for Spur integration
      this.setupIPCHandlers();

      log.info('Main window created successfully');

    } catch (error) {
      log.error('Failed to create main window:', error);
      throw error;
    }
  }

  setupSystemTray() {
    try {
      const trayIcon = path.join(__dirname, 'assets', 'icon-tray.png');
      
      tray = new Tray(trayIcon);
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Spur Browser',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            } else {
              this.createMainWindow();
            }
          }
        },
        {
          label: 'New Window',
          click: () => {
            this.createMainWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Voice Assistant',
          type: 'checkbox',
          checked: config.get('features.voiceEnabled'),
          click: (menuItem) => {
            config.set('features.voiceEnabled', menuItem.checked);
            if (this.spurVoice) {
              this.spurVoice.setEnabled(menuItem.checked);
            }
          }
        },
        {
          label: 'Memory System',
          type: 'checkbox',
          checked: config.get('features.memoryEnabled'),
          click: (menuItem) => {
            config.set('features.memoryEnabled', menuItem.checked);
            if (this.spurMemory) {
              this.spurMemory.setEnabled(menuItem.checked);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-settings');
            }
          }
        },
        {
          label: 'Check for Updates',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]);

      tray.setContextMenu(contextMenu);
      tray.setToolTip('Spur Browser - Intelligent Browsing Companion');
      
      // Handle tray double-click
      tray.on('double-click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          this.createMainWindow();
        }
      });

      log.info('System tray setup complete');

    } catch (error) {
      log.error('Failed to setup system tray:', error);
    }
  }

  setupGlobalShortcuts() {
    try {
      // Global voice activation shortcut
      if (config.get('features.voiceEnabled')) {
        globalShortcut.register('CommandOrControl+Shift+V', () => {
          if (this.spurVoice) {
            this.spurVoice.toggleRecording();
          }
        });
      }

      // Global assistant activation shortcut
      if (config.get('features.assistantEnabled')) {
        globalShortcut.register('CommandOrControl+Shift+A', () => {
          if (mainWindow) {
            mainWindow.webContents.send('toggle-assistant');
          }
        });
      }

      // Global memory search shortcut
      globalShortcut.register('CommandOrControl+Shift+M', () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-memory-search');
        }
      });

      log.info('Global shortcuts registered');

    } catch (error) {
      log.error('Failed to setup global shortcuts:', error);
    }
  }

  setupSystemIntegration() {
    // Set up native notifications
    if (config.get('features.nativeNotifications')) {
      this.setupNotifications();
    }

    // Set up deep linking (protocol handling)
    this.setupDeepLinking();

    // Set up system theme integration
    this.setupThemeIntegration();
  }

  setupNotifications() {
    // Native notification system integration
    ipcMain.handle('show-notification', async (event, options) => {
      try {
        const notification = new Notification({
          title: options.title,
          body: options.body,
          icon: options.icon || path.join(__dirname, 'assets', 'icon.png'),
          silent: options.silent || false,
          requireInteraction: options.requireInteraction || false
        });

        notification.onclick = () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            event.sender.send('notification-clicked', notification);
          }
        };

        notification.show();
        return { success: true };

      } catch (error) {
        log.error('Failed to show notification:', error);
        return { success: false, error: error.message };
      }
    });
  }

  setupDeepLinking() {
    // Handle custom protocol (spur://)
    app.setAsDefaultProtocolClient('spur');

    app.on('open-url', (event, url) => {
      event.preventDefault();
      log.info('Deep link opened:', url);
      
      if (mainWindow) {
        mainWindow.webContents.send('deep-link', { url });
      } else {
        // Store deep link for when window opens
        global.deepLinkUrl = url;
      }
    });
  }

  setupThemeIntegration() {
    // Sync with system theme
    const nativeTheme = require('electron').nativeTheme;
    
    nativeTheme.on('updated', () => {
      if (mainWindow) {
        mainWindow.webContents.send('theme-updated', {
          dark: nativeTheme.shouldUseDarkColors
        });
      }
    });
  }

  setupIPCHandlers() {
    // Spur integration handlers
    ipcMain.handle('spur-voice-start', async () => {
      if (this.spurVoice) {
        return await this.spurVoice.startRecording();
      }
      return { success: false, error: 'Voice component not available' };
    });

    ipcMain.handle('spur-voice-stop', async () => {
      if (this.spurVoice) {
        return await this.spurVoice.stopRecording();
      }
      return { success: false, error: 'Voice component not available' };
    });

    ipcMain.handle('spur-memory-search', async (event, query) => {
      if (this.spurMemory) {
        return await this.spurMemory.search(query);
      }
      return { success: false, error: 'Memory component not available' };
    });

    ipcMain.handle('spur-assistant-query', async (event, query, context) => {
      if (this.spurAssistant) {
        return await this.spurAssistant.processQuery(query, context);
      }
      return { success: false, error: 'Assistant component not available' };
    });

    ipcMain.handle('spur-config-get', async (event, key) => {
      return config.get(key);
    });

    ipcMain.handle('spur-config-set', async (event, key, value) => {
      config.set(key, value);
      return { success: true };
    });

    ipcMain.handle('get-system-info', async () => {
      try {
        const [cpu, mem, osInfo] = await Promise.all([
          si.cpu(),
          si.mem(),
          si.osInfo()
        ]);

        return {
          cpu: {
            manufacturer: cpu.manufacturer,
            brand: cpu.brand,
            speed: cpu.speed,
            cores: cpu.cores
          },
          memory: {
            total: mem.total,
            free: mem.free,
            used: mem.used
          },
          os: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            arch: osInfo.arch
          },
          machineId: machineIdSync()
        };
      } catch (error) {
        log.error('Failed to get system info:', error);
        return { success: false, error: error.message };
      }
    });

    // Browser control handlers
    ipcMain.handle('browser-create-window', async (event, options) => {
      return await this.createSecondaryWindow(options);
    });

    ipcMain.handle('browser-navigate', async (event, url) => {
      if (mainWindow) {
        return mainWindow.loadURL(url);
      }
      return { success: false, error: 'Main window not available' };
    });
  }

  setupAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
    });

    autoUpdater.on('error', (err) => {
      log.error('Auto updater error:', err);
      if (mainWindow) {
        mainWindow.webContents.send('update-error', err);
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
      log.info(log_message);
      
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', progressObj);
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
      }
    });

    // Check for updates on startup
    autoUpdater.checkForUpdatesAndNotify();
  }

  async createSecondaryWindow(options = {}) {
    try {
      const secondaryWindow = new BrowserWindow({
        width: options.width || 1000,
        height: options.height || 700,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: true
        },
        parent: mainWindow,
        modal: options.modal || false,
        show: false
      });

      if (options.url) {
        await secondaryWindow.loadURL(options.url);
      } else {
        await secondaryWindow.loadFile(path.join(__dirname, 'src', 'browser', 'secondary.html'));
      }

      secondaryWindow.once('ready-to-show', () => {
        secondaryWindow.show();
      });

      return { success: true, windowId: secondaryWindow.id };

    } catch (error) {
      log.error('Failed to create secondary window:', error);
      return { success: false, error: error.message };
    }
  }

  onWindowAllClosed() {
    if (process.platform !== 'darwin' || isQuitting) {
      app.quit();
    }
  }

  onActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  async cleanup() {
    try {
      log.info('Cleaning up Spur Browser...');
      
      // Clean up global shortcuts
      globalShortcut.unregisterAll();
      
      // Clean up Spur components
      if (this.spurVoice) {
        await this.spurVoice.destroy();
      }
      
      if (this.spurMemory) {
        await this.spurMemory.cleanup();
      }
      
      if (this.spurAssistant) {
        await this.spurAssistant.cleanup();
      }
      
      if (this.spurIntegration) {
        await this.spurIntegration.cleanup();
      }
      
      // Clean up tray
      if (tray) {
        tray.destroy();
      }
      
      log.info('Cleanup complete');
      
    } catch (error) {
      log.error('Error during cleanup:', error);
    }
  }
}

// Create and start the Spur Browser
const spurBrowser = new SpurBrowser();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  // Attempt graceful shutdown
  if (spurBrowser) {
    spurBrowser.cleanup().then(() => {
      process.exit(1);
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the browser
spurBrowser.initialize().catch((error) => {
  log.error('Failed to start Spur Browser:', error);
  process.exit(1);
});

module.exports = SpurBrowser;