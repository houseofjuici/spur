import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AssistantInterface } from '@/web/components/AssistantInterface'
import { AssistantEngine } from '@/assistant/core'

// Mock the AssistantEngine
vi.mock('@/assistant/core', () => ({
  AssistantEngine: vi.fn().mockImplementation(() => ({
    processMessage: vi.fn().mockResolvedValue({
      response: 'Hello! I am your assistant.',
      confidence: 0.95,
      timestamp: Date.now()
    }),
    initialize: vi.fn().mockResolvedValue(true),
    isInitialized: true,
    getSkills: vi.fn().mockReturnValue(['memory', 'patterns', 'integrations'])
  }))
}))

// Mock memory store
vi.mock('@/memory/graph', () => ({
  MemoryGraph: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue([
      {
        id: 'memory-1',
        type: 'activity',
        content: 'Test activity',
        timestamp: Date.now() - 3600000,
        relevanceScore: 0.8
      }
    ]),
    addNode: vi.fn(),
    addEdge: vi.fn()
  }))
}))

describe('AssistantInterface', () => {
  let mockProps: any

  beforeEach(() => {
    mockProps = {
      onMessage: vi.fn(),
      onError: vi.fn(),
      className: 'test-assistant'
    }

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', { value: localStorageMock })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render assistant interface correctly', () => {
      render(<AssistantInterface {...mockProps} />)
      
      expect(screen.getByTestId('assistant-chat')).toBeInTheDocument()
      expect(screen.getByTestId('message-input')).toBeInTheDocument()
      expect(screen.getByTestId('send-button')).toBeInTheDocument()
      expect(screen.getByTestId('voice-input-button')).toBeInTheDocument()
    })

    it('should display initial greeting', () => {
      render(<AssistantInterface {...mockProps} />)
      
      expect(screen.getByText(/Hello! I'm your Spur assistant/)).toBeInTheDocument()
    })

    it('should display loading state when initializing', () => {
      vi.mocked(AssistantEngine).mockImplementationOnce(() => ({
        ...vi.mocked(AssistantEngine)(),
        isInitialized: false,
        initialize: vi.fn().mockResolvedValue(true)
      }))

      render(<AssistantInterface {...mockProps} />)
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })
  })

  describe('Message Handling', () => {
    it('should send message when user types and clicks send', async () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      fireEvent.change(input, { target: { value: 'Hello assistant' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(input).toHaveValue('')
      })
      
      expect(mockProps.onMessage).toHaveBeenCalledWith({
        type: 'user_message',
        content: 'Hello assistant',
        timestamp: expect.any(Number)
      })
    })

    it('should send message when user presses Enter', async () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.keyPress(input, { key: 'Enter', keyCode: 13 })
      
      await waitFor(() => {
        expect(input).toHaveValue('')
      })
      
      expect(mockProps.onMessage).toHaveBeenCalledWith({
        type: 'user_message',
        content: 'Test message',
        timestamp: expect.any(Number)
      })
    })

    it('should not send empty messages', () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      fireEvent.change(input, { target: { value: '   ' } }) // Only whitespace
      fireEvent.click(sendButton)
      
      expect(mockProps.onMessage).not.toHaveBeenCalled()
    })

    it('should display assistant response', async () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      fireEvent.change(input, { target: { value: 'Hello' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('Hello! I am your assistant.')).toBeInTheDocument()
      })
    })
  })

  describe('Voice Input', () => {
    it('should enable voice input when voice button is clicked', () => {
      render(<AssistantInterface {...mockProps} />)
      
      const voiceButton = screen.getByTestId('voice-input-button')
      
      // Mock SpeechRecognition API
      Object.defineProperty(window, 'SpeechRecognition', {
        value: vi.fn().mockImplementation(() => ({
          continuous: false,
          interimResults: false,
          lang: 'en-US',
          start: vi.fn(),
          stop: vi.fn(),
          abort: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        })),
        writable: true
      })
      
      fireEvent.click(voiceButton)
      
      expect(screen.getByTestId('voice-indicator')).toBeInTheDocument()
    })

    it('should handle voice recognition results', async () => {
      render(<AssistantInterface {...mockProps} />)
      
      const voiceButton = screen.getByTestId('voice-input-button')
      let recognitionCallback: any
      
      // Mock SpeechRecognition with callback
      Object.defineProperty(window, 'SpeechRecognition', {
        value: vi.fn().mockImplementation(() => ({
          continuous: false,
          interimResults: false,
          lang: 'en-US',
          start: vi.fn(),
          stop: vi.fn(),
          abort: vi.fn(),
          addEventListener: (event: string, callback: any) => {
            if (event === 'result') {
              recognitionCallback = callback
            }
          },
          removeEventListener: vi.fn()
        })),
        writable: true
      })
      
      fireEvent.click(voiceButton)
      
      // Simulate voice recognition result
      if (recognitionCallback) {
        recognitionCallback({
          results: [[{
            transcript: 'Voice test message',
            confidence: 0.9
          }]]
        })
      }
      
      await waitFor(() => {
        const input = screen.getByTestId('message-input')
        expect(input).toHaveValue('Voice test message')
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error when message processing fails', async () => {
      vi.mocked(AssistantEngine).mockImplementationOnce(() => ({
        ...vi.mocked(AssistantEngine)(),
        processMessage: vi.fn().mockRejectedValue(new Error('Processing failed'))
      }))

      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText(/Failed to process message/)).toBeInTheDocument()
      })
      
      expect(mockProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'processing_error',
          message: 'Processing failed'
        })
      )
    })

    it('should handle initialization failure', () => {
      vi.mocked(AssistantEngine).mockImplementationOnce(() => ({
        ...vi.mocked(AssistantEngine)(),
        initialize: vi.fn().mockRejectedValue(new Error('Initialization failed'))
      }))

      render(<AssistantInterface {...mockProps} />)
      
      expect(screen.getByTestId('error-message')).toBeInTheDocument()
      expect(screen.getByText(/Failed to initialize assistant/)).toBeInTheDocument()
    })
  })

  describe('Memory Integration', () => {
    it('should display memory context in responses', async () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      fireEvent.change(input, { target: { value: 'Show me recent activities' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('memory-context')).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('should focus input when interface loads', () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      expect(input).toHaveFocus()
    })

    it('should support Tab navigation between elements', () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const voiceButton = screen.getByTestId('voice-input-button')
      const sendButton = screen.getByTestId('send-button')
      
      fireEvent.keyDown(input, { key: 'Tab' })
      expect(voiceButton).toHaveFocus()
      
      fireEvent.keyDown(voiceButton, { key: 'Tab' })
      expect(sendButton).toHaveFocus()
    })

    it('should support Escape to clear input', () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      
      expect(input).toHaveValue('')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      expect(input).toHaveAttribute('aria-label', 'Type your message to the assistant')
      
      const voiceButton = screen.getByTestId('voice-input-button')
      expect(voiceButton).toHaveAttribute('aria-label', 'Start voice input')
      
      const sendButton = screen.getByTestId('send-button')
      expect(sendButton).toHaveAttribute('aria-label', 'Send message')
    })

    it('should announce responses to screen readers', async () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      fireEvent.change(input, { target: { value: 'Hello' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        const response = screen.getByText('Hello! I am your assistant.')
        expect(response).toHaveAttribute('aria-live', 'polite')
      })
    })

    it('should have proper heading hierarchy', () => {
      render(<AssistantInterface {...mockProps} />)
      
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
      
      headings.forEach((heading, index) => {
        expect(heading).toHaveAttribute('aria-level', (index + 1).toString())
      })
    })
  })

  describe('Performance', () => {
    it('should render within performance budget', () => {
      const startTime = performance.now()
      
      render(<AssistantInterface {...mockProps} />)
      
      const renderTime = performance.now() - startTime
      expect(renderTime).toBeLessThan(100) // Should render within 100ms
    })

    it('should handle rapid message input', async () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      // Send multiple messages rapidly
      fireEvent.change(input, { target: { value: 'Message 1' } })
      fireEvent.click(sendButton)
      
      fireEvent.change(input, { target: { value: 'Message 2' } })
      fireEvent.click(sendButton)
      
      fireEvent.change(input, { target: { value: 'Message 3' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(mockProps.onMessage).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('Theming', () => {
    it('should apply custom className', () => {
      render(<AssistantInterface {...mockProps} />)
      
      const container = screen.getByTestId('assistant-chat')
      expect(container).toHaveClass('test-assistant')
    })

    it('should support dark theme', () => {
      document.documentElement.setAttribute('data-theme', 'dark')
      
      render(<AssistantInterface {...mockProps} />)
      
      const container = screen.getByTestId('assistant-chat')
      expect(container).toHaveClass('dark-theme')
    })
  })

  describe('Persistence', () => {
    it('should save conversation history to localStorage', async () => {
      render(<AssistantInterface {...mockProps} />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith(
          'spur-conversation-history',
          expect.any(String)
        )
      })
    })

    it('should load conversation history from localStorage', () => {
      const mockHistory = [
        {
          id: '1',
          type: 'user',
          content: 'Previous message',
          timestamp: Date.now() - 3600000
        },
        {
          id: '2',
          type: 'assistant',
          content: 'Previous response',
          timestamp: Date.now() - 3500000
        }
      ]
      
      vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify(mockHistory))
      
      render(<AssistantInterface {...mockProps} />)
      
      expect(screen.getByText('Previous message')).toBeInTheDocument()
      expect(screen.getByText('Previous response')).toBeInTheDocument()
    })
  })
})