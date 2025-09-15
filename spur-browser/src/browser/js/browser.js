// Spur Browser - Core Browser Functionality
// Handles navigation, tab management, and browser controls

class SpurBrowser {
  constructor() {
    this.webview = null;
    this.currentUrl = '';
    this.canGoBack = false;
    this.canGoForward = false;
    this.isLoading = false;
    this.tabs = new Map();
    this.activeTabId = '1';
    this.sidebarState = {
      assistant: false,
      memory: false,
      voice: false
    };
    
    this.initialize();
  }

  async initialize() {
    console.log('🚀 Initializing Spur Browser...');
    
    // Initialize DOM elements
    this.initializeElements();
    
    // Initialize webview
    this.initializeWebview();
    
    // Initialize navigation controls
    this.initializeNavigation();
    
    // Initialize address bar
    this.initializeAddressBar();
    
    // Initialize tab management
    this.initializeTabs();
    
    // Initialize window controls
    this.initializeWindowControls();
    
    // Initialize Spur controls
    this.initializeSpurControls();
    
    // Initialize status bar
    this.updateStatusBar();
    
    console.log('✅ Spur Browser initialized successfully');
  }

  initializeElements() {
    this.webview = document.getElementById('main-webview');
    this.addressBar = document.getElementById('address-bar');
    this.backBtn = document.getElementById('back-btn');
    this.forwardBtn = document.getElementById('forward-btn');
    this.refreshBtn = document.getElementById('refresh-btn');
    this.homeBtn = document.getElementById('home-btn');
    this.extensionMenu = document.getElementById('extension-menu');
    this.sidebar = document.getElementById('sidebar');
    this.statusUrl = document.getElementById('status-url');
    this.newTabBtn = document.getElementById('new-tab-btn');
  }

  initializeWebview() {
    if (!this.webview) return;

    // Navigation events
    this.webview.addEventListener('did-navigate', (event) => {
      this.onNavigation(event.url);
    });

    this.webview.addEventListener('did-navigate-in-page', (event) => {
      this.onNavigation(event.url);
    });

    // Loading events
    this.webview.addEventListener('did-start-loading', () => {
      this.onLoadingStart();
    });

    this.webview.addEventListener('did-stop-loading', () => {
      this.onLoadingStop();
    });

    // Error handling
    this.webview.addEventListener('did-fail-load', (event) => {
      console.error('❌ Page failed to load:', event.errorDescription);
      this.updateSecurityIndicator('error');
    });

    // Title update
    this.webview.addEventListener('page-title-updated', (event) => {
      this.updateTabTitle(this.activeTabId, event.title);
    });

    // Favicon update
    this.webview.addEventListener('page-favicon-updated', (event) => {
      if (event.favicons && event.favicons.length > 0) {
        this.updateTabFavicon(this.activeTabId, event.favicons[0]);
      }
    });
  }

  initializeNavigation() {
    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => this.goBack());
    }

    if (this.forwardBtn) {
      this.forwardBtn.addEventListener('click', () => this.goForward());
    }

    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.refresh());
    }

    if (this.homeBtn) {
      this.homeBtn.addEventListener('click', () => this.goHome());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'ArrowLeft') this.goBack();
      if (e.altKey && e.key === 'ArrowRight') this.goForward();
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) this.refresh();
      if (e.key === 'Home' || (e.altKey && e.key === 'd')) this.goHome();
    });
  }

  initializeAddressBar() {
    if (!this.addressBar) return;

    this.addressBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigateTo(this.addressBar.value.trim());
      }
    });

    this.addressBar.addEventListener('focus', () => {
      this.addressBar.select();
    });

    // Handle paste
    this.addressBar.addEventListener('paste', () => {
      setTimeout(() => {
        const url = this.addressBar.value.trim();
        if (url && !this.isValidUrl(url)) {
          this.addressBar.value = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
      }, 0);
    });
  }

  initializeTabs() {
    if (this.newTabBtn) {
      this.newTabBtn.addEventListener('click', () => this.createNewTab());
    }

    // Initialize existing tabs
    this.initializeTab('1', 'https://www.google.com', 'Google', '../assets/google-favicon.png');
  }

  initializeTab(tabId, url, title, favicon) {
    this.tabs.set(tabId, {
      id: tabId,
      url,
      title,
      favicon,
      webview: null
    });

    const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabElement) {
      tabElement.addEventListener('click', () => this.switchToTab(tabId));

      const closeBtn = tabElement.querySelector('.tab-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeTab(tabId);
        });
      }
    }
  }

  initializeWindowControls() {
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        window.api.minimize();
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        window.api.maximize();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.api.close();
      });
    }
  }

  initializeSpurControls() {
    const voiceBtn = document.getElementById('voice-btn');
    const assistantBtn = document.getElementById('assistant-btn');
    const memoryBtn = document.getElementById('memory-btn');

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        this.toggleSidebar('voice');
        this.toggleButtonState(voiceBtn);
      });
    }

    if (assistantBtn) {
      assistantBtn.addEventListener('click', () => {
        this.toggleSidebar('assistant');
        this.toggleButtonState(assistantBtn);
      });
    }

    if (memoryBtn) {
      memoryBtn.addEventListener('click', () => {
        this.toggleSidebar('memory');
        this.toggleButtonState(memoryBtn);
      });
    }

    // Initialize panel close buttons
    this.initializePanelCloseButtons();
  }

  initializePanelCloseButtons() {
    const closeButtons = [
      { id: 'close-assistant', panel: 'assistant' },
      { id: 'close-memory', panel: 'memory' },
      { id: 'close-voice', panel: 'voice' }
    ];

    closeButtons.forEach(({ id, panel }) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener('click', () => {
          this.toggleSidebar(panel);
          const controlBtn = document.getElementById(`${panel}-btn`);
          if (controlBtn) {
            this.toggleButtonState(controlBtn, false);
          }
        });
      }
    });
  }

  // Navigation methods
  navigateTo(url) {
    if (!url) return;

    // Handle search queries
    if (!this.isValidUrl(url)) {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }

    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    if (this.webview) {
      this.webview.src = url;
      this.updateAddressBar(url);
    }
  }

  goBack() {
    if (this.webview && this.webview.canGoBack()) {
      this.webview.goBack();
    }
  }

  goForward() {
    if (this.webview && this.webview.canGoForward()) {
      this.webview.goForward();
    }
  }

  refresh() {
    if (this.webview) {
      this.webview.reload();
    }
  }

  goHome() {
    this.navigateTo('https://www.google.com');
  }

  // Event handlers
  onNavigation(url) {
    this.currentUrl = url;
    this.updateNavigationState();
    this.updateAddressBar(url);
    this.updateStatusBar();
    this.updateSecurityIndicator(this.getSecurityState(url));
    this.updateTabUrl(this.activeTabId, url);
  }

  onLoadingStart() {
    this.isLoading = true;
    this.updateNavigationState();
    this.updateLoadingIndicator(true);
  }

  onLoadingStop() {
    this.isLoading = false;
    this.updateNavigationState();
    this.updateLoadingIndicator(false);
  }

  // UI update methods
  updateNavigationState() {
    if (this.backBtn) {
      this.backBtn.disabled = !this.webview || !this.webview.canGoBack();
    }

    if (this.forwardBtn) {
      this.forwardBtn.disabled = !this.webview || !this.webview.canGoForward();
    }

    if (this.refreshBtn) {
      this.refreshBtn.classList.toggle('active', this.isLoading);
    }
  }

  updateAddressBar(url) {
    if (this.addressBar) {
      this.addressBar.value = url;
    }
  }

  updateStatusBar() {
    if (this.statusUrl) {
      this.statusUrl.textContent = this.currentUrl || 'about:blank';
    }
  }

  updateSecurityIndicator(state) {
    const indicator = document.getElementById('security-indicator');
    if (!indicator) return;

    const states = {
      secure: { color: '#10B981', icon: 'shield' },
      warning: { color: '#F59E0B', icon: 'shield-alert' },
      error: { color: '#EF4444', icon: 'shield-x' },
      local: { color: '#6B7280', icon: 'globe' }
    };

    const config = states[state] || states.local;
    indicator.style.color = config.color;
    
    // Update icon (simplified - in real implementation would use SVG)
    console.log(`🔒 Security state: ${state}`);
  }

  updateLoadingIndicator(loading) {
    if (this.refreshBtn) {
      const icon = this.refreshBtn.querySelector('svg');
      if (icon) {
        icon.style.animation = loading ? 'spin 1s linear infinite' : '';
      }
    }
  }

  // Tab management methods
  createNewTab() {
    const tabId = Date.now().toString();
    const url = 'https://www.google.com';
    
    this.addTabToUI(tabId, url, 'New Tab', '../assets/google-favicon.png');
    this.initializeTab(tabId, url, 'New Tab', '../assets/google-favicon.png');
    this.switchToTab(tabId);
  }

  addTabToUI(tabId, url, title, favicon) {
    const tabContainer = document.querySelector('.tab-container');
    if (!tabContainer) return;

    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tabId;
    
    tabElement.innerHTML = `
      <div class="tab-favicon">
        <img src="${favicon}" alt="${title}">
      </div>
      <div class="tab-title">${title}</div>
      <button class="tab-close">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    tabContainer.insertBefore(tabElement, this.newTabBtn);
  }

  switchToTab(tabId) {
    // Update active tab styling
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tabId === tabId);
    });

    // Switch webview content
    const tab = this.tabs.get(tabId);
    if (tab && this.webview) {
      this.activeTabId = tabId;
      this.webview.src = tab.url;
      this.updateAddressBar(tab.url);
      this.updateStatusBar();
    }
  }

  closeTab(tabId) {
    if (this.tabs.size <= 1) return; // Don't close the last tab

    // Remove from data
    this.tabs.delete(tabId);

    // Remove from UI
    const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabElement) {
      tabElement.remove();
    }

    // Switch to another tab if closing active tab
    if (tabId === this.activeTabId) {
      const remainingTabId = this.tabs.keys().next().value;
      if (remainingTabId) {
        this.switchToTab(remainingTabId);
      }
    }
  }

  updateTabTitle(tabId, title) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.title = title;
      
      const tabElement = document.querySelector(`[data-tab-id="${tabId}"] .tab-title`);
      if (tabElement) {
        tabElement.textContent = title;
      }
    }
  }

  updateTabFavicon(tabId, favicon) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.favicon = favicon;
      
      const tabElement = document.querySelector(`[data-tab-id="${tabId}"] .tab-favicon img`);
      if (tabElement) {
        tabElement.src = favicon;
      }
    }
  }

  updateTabUrl(tabId, url) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.url = url;
    }
  }

  // Sidebar management
  toggleSidebar(panel) {
    this.sidebarState[panel] = !this.sidebarState[panel];
    
    const panelElement = document.getElementById(`${panel}-panel`);
    if (panelElement) {
      panelElement.style.display = this.sidebarState[panel] ? 'block' : 'none';
    }

    // Show/hide sidebar if any panel is active
    const anyPanelActive = Object.values(this.sidebarState).some(state => state);
    this.sidebar.classList.toggle('collapsed', !anyPanelActive);
  }

  toggleButtonState(button, active = null) {
    if (active === null) {
      active = !button.classList.contains('active');
    }
    button.classList.toggle('active', active);
  }

  // Utility methods
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  getSecurityState(url) {
    if (url.startsWith('https://')) return 'secure';
    if (url.startsWith('http://')) return 'warning';
    if (url.startsWith('file://') || url.startsWith('about:')) return 'local';
    return 'local';
  }

  // Global keyboard shortcuts
  setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + T: New tab
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        this.createNewTab();
      }

      // Ctrl/Cmd + W: Close tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        this.closeTab(this.activeTabId);
      }

      // Ctrl/Cmd + L: Focus address bar
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        this.addressBar?.focus();
      }

      // F11: Toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        window.api.toggleFullscreen();
      }
    });
  }
}

// Add CSS animation for loading spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Initialize browser when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.spurBrowser = new SpurBrowser();
  
  // Set up global shortcuts after initialization
  setTimeout(() => {
    window.spurBrowser.setupGlobalShortcuts();
  }, 100);
});

// Export for use in other modules
window.SpurBrowser = SpurBrowser;