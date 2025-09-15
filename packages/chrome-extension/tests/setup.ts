import { vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path) => `chrome-extension://test-extension-id/${path}`),
    getManifest: vi.fn(() => ({
      manifest_version: 3,
      name: 'Spur Test Extension',
      version: '1.0.0'
    })),
    onInstalled: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    sendMessage: vi.fn()
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    },
    managed: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    }
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    sendMessage: vi.fn(),
    onCreated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  contextMenus: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  commands: {
    getAll: vi.fn(),
    onCommand: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  alarms: {
    create: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  notifications: {
    create: vi.fn(),
    update: vi.fn(),
    clear: vi.fn(),
    getAll: vi.fn(),
    getPermissionLevel: vi.fn(),
    onClosed: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onButtonClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  action: {
    setTitle: vi.fn(),
    getTitle: vi.fn(),
    setIcon: vi.fn(),
    setPopup: vi.fn(),
    getPopup: vi.fn(),
    setBadgeText: vi.fn(),
    getBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    getBadgeBackgroundColor: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  scripting: {
    executeScript: vi.fn(),
    insertCSS: vi.fn(),
    removeCSS: vi.fn()
  },
  offscreen: {
    createDocument: vi.fn(),
    hasDocument: vi.fn(),
    closeDocument: vi.fn()
  },
  sidePanel: {
    getOptions: vi.fn(),
    setOptions: vi.fn(),
    getPanelBehavior: vi.fn(),
    setPanelBehavior: vi.fn()
  },
  permissions: {
    getAll: vi.fn(),
    contains: vi.fn(),
    request: vi.fn(),
    remove: vi.fn(),
    onAdded: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
} as any;

// Mock navigator APIs
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: vi.fn(),
      enumerateDevices: vi.fn()
    },
    permissions: {
      query: vi.fn()
    }
  },
  configurable: true
});

// Mock window APIs
Object.defineProperty(global, 'window', {
  value: {
    SpeechRecognition: vi.fn(),
    webkitSpeechRecognition: vi.fn(),
    AudioContext: vi.fn(),
    webkitAudioContext: vi.fn(),
    URL: {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn()
    },
    Blob: vi.fn(),
    File: vi.fn(),
    FileReader: vi.fn(),
    setTimeout: global.setTimeout,
    setInterval: global.setInterval,
    clearTimeout: global.clearTimeout,
    clearInterval: global.clearInterval,
    requestAnimationFrame: vi.fn(),
    cancelAnimationFrame: vi.fn()
  },
  configurable: true
});

// Mock document APIs
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(),
    getElementById: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    createTreeWalker: vi.fn(),
    createEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    },
    head: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }
  },
  configurable: true
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Setup global test utilities
global.describe = describe;
global.it = it;
global.test = test;
global.expect = expect;
global.vi = vi;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock MutationObserver
global.MutationObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn()
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Setup global test hooks
beforeEach(() => {
  // Reset all mock functions before each test
  Object.values(chrome).forEach((api: any) => {
    if (api && typeof api === 'object') {
      Object.values(api).forEach((method: any) => {
        if (method && typeof method === 'function' && method.mockClear) {
          method.mockClear();
        }
      });
    }
  });
});

// Test utilities
export const createMockMemory = (overrides = {}) => ({
  id: 'test-memory',
  content: 'Test memory content',
  type: 'note',
  timestamp: new Date().toISOString(),
  metadata: { source: 'test' },
  connections: [],
  tags: ['test'],
  ...overrides
});

export const createMockConfig = (overrides = {}) => ({
  darkMode: false,
  historySize: 1000,
  dataRetentionDays: 90,
  autoSync: true,
  syncInterval: 5,
  voiceCommands: true,
  notifications: true,
  gmailIntegration: true,
  apiUrl: 'https://api.example.com',
  apiKey: 'test-key',
  ...overrides
});

export const mockChromeStorage = (data: any = {}) => {
  chrome.storage.local.get.mockResolvedValue({ spurState: data });
  chrome.storage.local.set.mockResolvedValue(undefined);
};

export const mockMediaStream = () => {
  const stream = {
    getTracks: () => [{
      stop: vi.fn()
    }]
  };
  navigator.mediaDevices.getUserMedia.mockResolvedValue(stream);
  return stream;
};

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const flushPromises = () => new Promise(resolve => setImmediate(resolve));