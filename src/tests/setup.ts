// Test setup for Vitest
import { vi } from 'vitest'
import { chrome } from 'webextension-polyfill'

// Mock Chrome APIs
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path) => `chrome-extension://${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onConnect: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  tabs: {
    query: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    captureVisibleTab: vi.fn()
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  },
  windows: {
    getCurrent: vi.fn(),
    onFocusedChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  webNavigation: {
    onCommitted: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onCompleted: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
} as any

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(),
  getEntriesByType: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
} as any

// Mock console methods to reduce noise during tests
const originalConsole = { ...global.console }
global.console = {
  ...originalConsole,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

// Mock timers
vi.useFakeTimers()

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})