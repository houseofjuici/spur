import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock global APIs that don't exist in test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Web Speech API
global.SpeechRecognition = vi.fn().mockImplementation(() => ({
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

global.speechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
  onvoiceschanged: null,
  onvoiceschanged: null,
} as any;

// Mock Chrome extension APIs
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn().mockImplementation((path: string) => `chrome-extension://test-extension-id/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
    },
    onActivated: {
      addListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
    },
  },
  contextMenus: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn(),
    update: vi.fn(),
    clear: vi.fn(),
    getAll: vi.fn(),
    onClosed: {
      addListener: vi.fn(),
    },
    onClicked: {
      addListener: vi.fn(),
    },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
    },
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    setTitle: vi.fn(),
    setIcon: vi.fn(),
  },
  windows: {
    getCurrent: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    onFocusChanged: {
      addListener: vi.fn(),
    },
  },
  offscreen: {
    createDocument: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
    insertCSS: vi.fn(),
  },
  webNavigation: {
    onCommitted: {
      addListener: vi.fn(),
    },
    onCompleted: {
      addListener: vi.fn(),
    },
  },
} as any;

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation((url: string) => ({
  url,
  readyState: WebSocket.CONNECTING,
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock fetch API
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock Notification API
global.Notification = {
  requestPermission: vi.fn().mockResolvedValue('granted'),
  permission: 'granted' as NotificationPermission,
  maxActions: 2,
} as any;

// Mock Service Worker
global.navigator.serviceWorker = {
  register: vi.fn().mockResolvedValue({
    update: vi.fn(),
    unregister: vi.fn(),
  }),
  ready: Promise.resolve({
    showNotification: vi.fn(),
  }),
} as any;

// Mock performance API
global.performance = {
  now: vi.fn().mockReturnValue(Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn().mockReturnValue([]),
  getEntriesByType: vi.fn().mockReturnValue([]),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
  setResourceTimingBufferSize: vi.fn(),
  toJSON: vi.fn(),
  timeOrigin: Date.now(),
  timing: {
    navigationStart: Date.now(),
    unloadEventStart: 0,
    unloadEventEnd: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 0,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    connectEnd: 0,
    secureConnectionStart: 0,
    requestStart: 0,
    responseStart: 0,
    responseEnd: 0,
    domLoading: 0,
    domInteractive: 0,
    domContentLoadedEventStart: 0,
    domContentLoadedEventEnd: 0,
    domComplete: 0,
    loadEventStart: 0,
    loadEventEnd: 0,
  },
  navigation: {
    type: 'navigate',
    redirectCount: 0,
  },
} as any;

// Mock URL API
global.URL = URL as any;
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
global.URL.revokeObjectURL = vi.fn();

// Mock File API
global.File = vi.fn().mockImplementation((parts: any[], filename: string, options: any) => ({
  parts,
  name: filename,
  lastModified: options?.lastModified || Date.now(),
  size: options?.size || 0,
  type: options?.type || '',
  slice: vi.fn(),
  arrayBuffer: vi.fn(),
  text: vi.fn(),
  stream: vi.fn(),
}));

// Mock FileReader
global.FileReader = vi.fn().mockImplementation(() => ({
  readAsArrayBuffer: vi.fn(),
  readAsDataURL: vi.fn(),
  readAsText: vi.fn(),
  abort: vi.fn(),
  readyState: 0,
  result: null,
  error: null,
  onloadstart: null,
  onprogress: null,
  onload: null,
  onabort: null,
  onerror: null,
  onloadend: null,
}));

// Mock crypto API
global.crypto = {
  getRandomValues: vi.fn().mockImplementation((array: any) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    digest: vi.fn().mockResolvedValue(new Uint8Array(32)),
    generateKey: vi.fn().mockResolvedValue({}),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
    verify: vi.fn().mockResolvedValue(true),
  },
} as any;

// Setup global test utilities
global.describe = describe;
global.it = it;
global.test = test;
global.expect = expect;
global.vi = vi;

// Mock console methods to reduce noise in tests (but still show errors)
const originalConsole = { ...console };
console.log = vi.fn();
console.info = vi.fn();
console.warn = vi.fn();
console.debug = vi.fn();
// Keep error logging
console.error = originalConsole.error;

// Setup global cleanup
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  
  // Clear mock implementations
  if (global.fetch) {
    global.fetch = vi.fn();
  }
});

// Setup global timeout
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 10000,
});

// Mock process.env for browser-like environment
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  VITE_APP_VERSION: '1.0.0-test',
  VITE_API_BASE_URL: 'http://localhost:3000/api',
  VITE_WS_URL: 'ws://localhost:3000/ws',
  VITE_ENABLE_ANALYTICS: 'false',
  VITE_ENABLE_SENTRY: 'false',
  VITE_ENABLE_PERFORMANCE_MONITORING: 'true',
};

// Enhanced test utilities
global.createMockEvent = (type: string, data: any = {}) => ({
  type,
  ...data,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  currentTarget: { value: '' },
  target: { value: '' }
});

global.createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  headers: new Map(),
  clone: vi.fn()
});

global.sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

global.createMockDatabase = () => ({
  query: vi.fn(),
  exec: vi.fn(),
  prepare: vi.fn(),
  close: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
  get: vi.fn()
});

// Custom matchers for common assertions
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
  toBeValidUrl(received) {
    try {
      new URL(received);
      return {
        message: () => `expected ${received} not to be a valid URL`,
        pass: true,
      };
    } catch {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false,
      };
    }
  },
  toHaveBeenCalledWithApproximately(received, expected, tolerance = 0.001) {
    const calls = received.mock.calls;
    const hasApproximateCall = calls.some(call => 
      call.some(arg => 
        typeof arg === 'number' && 
        Math.abs(arg - expected) <= tolerance
      )
    );
    
    if (hasApproximateCall) {
      return {
        message: () => `expected mock not to have been called with approximately ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected mock to have been called with approximately ${expected}`,
        pass: false,
      };
    }
  }
});

// Performance monitoring utilities
global.measurePerformance = async (fn: () => Promise<void> | void, iterations = 1000) => {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = performance.now();
  return {
    totalTime: end - start,
    averageTime: (end - start) / iterations,
    iterations
  };
};

// Memory usage utilities
global.getMemoryUsage = () => {
  if (global.performance && (performance as any).memory) {
    return {
      used: (performance as any).memory.usedJSHeapSize,
      total: (performance as any).memory.totalJSHeapSize,
      limit: (performance as any).memory.jsHeapSizeLimit
    };
  }
  return null;
};

// Error simulation utilities
global.createMockError = (message: string, code: string = 'ERROR') => ({
  message,
  code,
  stack: new Error(message).stack,
  toString: () => message
});

// Database test utilities
global.createTestDatabase = async () => {
  const { SpurDatabase } = await import('@/database/SpurDatabase');
  const db = new SpurDatabase(':memory:');
  await db.initialize();
  return db;
};

// Integration test utilities
global.createTestIntegration = (type: string, config: any = {}) => ({
  type,
  config,
  initialize: vi.fn(),
  execute: vi.fn(),
  cleanup: vi.fn(),
  isInitialized: false,
  metrics: {
    calls: 0,
    errors: 0,
    averageResponseTime: 0
  }
});

// Export types for TypeScript
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeWithinRange(floor: number, ceiling: number): T;
      toBeValidEmail(): T;
      toBeValidUrl(): T;
      toHaveBeenCalledWithApproximately(expected: number, tolerance?: number): T;
    }
  }
  
  interface Window {
    createMockEvent: (type: string, data?: any) => any;
    createMockResponse: (data: any, status?: number) => any;
    sleep: (ms: number) => Promise<void>;
    createMockDatabase: () => any;
    measurePerformance: (fn: () => Promise<void> | void, iterations?: number) => Promise<{
      totalTime: number;
      averageTime: number;
      iterations: number;
    }>;
    getMemoryUsage: () => any;
    createMockError: (message: string, code?: string) => Error;
    createTestDatabase: () => Promise<any>;
    createTestIntegration: (type: string, config?: any) => any;
  }
}