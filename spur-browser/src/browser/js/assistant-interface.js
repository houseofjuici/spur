// Spur Browser - Assistant Interface Component
// Handles AI assistant interactions, conversation management, and intelligent responses

class AssistantInterface {
  constructor(options = {}) {
    this.options = {
      contextWindow: 10000,
      maxConversationLength: 50,
      enableMemory: true,
      enableWebSearch: true,
      enableVoiceInput: true,
      responseTimeout: 30000,
      ...options
    };

    this.isInitialized = false;
    this.conversation = [];
    this.currentResponse = null;
    this.isProcessing = false;
    this.memoryCache = new Map();
    
    this.eventHandlers = {
      onResponse: options.onResponse || (() => {}),
      onThinking: options.onThinking || (() => {}),
      onError: options.onError || (() => {}),
      onActionRequired: options.onActionRequired || (() => {})
    };

    console.log('🤖 Assistant Interface initialized');
  }

  async initialize() {
    try {
      console.log('🚀 Initializing assistant system...');

      // Initialize conversation storage
      await this.initializeConversationStorage();
      
      // Load previous conversation
      await this.loadConversation();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Initialize memory integration
      if (this.options.enableMemory && window.spurIntegration) {
        await this.initializeMemoryIntegration();
      }
      
      // Initialize web search capabilities
      if (this.options.enableWebSearch) {
        await this.initializeWebSearch();
      }
      
      this.isInitialized = true;
      console.log('✅ Assistant interface initialized successfully');
      
    } catch (error) {
      console.error('❌ Assistant interface initialization failed:', error);
      this.eventHandlers.onError('Failed to initialize assistant interface');
    }
  }

  async initializeConversationStorage() {
    try {
      // Set up conversation storage in localStorage
      this.storageKey = 'spur_assistant_conversation';
      
      // Check existing conversation
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.conversation = JSON.parse(stored);
        console.log(`💬 Loaded ${this.conversation.length} conversation messages`);
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize conversation storage:', error);
      this.conversation = [];
    }
  }

  async loadConversation() {
    try {
      // Load recent conversation history
      if (this.conversation.length > this.options.maxConversationLength) {
        this.conversation = this.conversation.slice(-this.options.maxConversationLength);
        await this.saveConversation();
      }
      
    } catch (error) {
      console.error('❌ Failed to load conversation:', error);
    }
  }

  setupEventHandlers() {
    // Handle input events
    const assistantInput = document.getElementById('assistant-input');
    const sendButton = document.getElementById('send-message');
    
    if (assistantInput) {
      assistantInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      
      // Auto-resize textarea
      assistantInput.addEventListener('input', () => {
        assistantInput.style.height = 'auto';
        assistantInput.style.height = Math.min(assistantInput.scrollHeight, 120) + 'px';
      });
    }
    
    if (sendButton) {
      sendButton.addEventListener('click', () => this.sendMessage());
    }
    
    // Handle voice input
    if (this.options.enableVoiceInput) {
      this.setupVoiceInput();
    }
  }

  setupVoiceInput() {
    const voiceButton = document.querySelector('#voice-panel .voice-control-btn.primary');
    if (voiceButton) {
      voiceButton.addEventListener('click', () => {
        this.handleVoiceInput();
      });
    }
  }

  async initializeMemoryIntegration() {
    try {
      // Set up memory access for context
      this.memoryInterface = await window.spurIntegration.getComponent('memory');
      if (this.memoryInterface) {
        console.log('🧠 Memory integration enabled for assistant');
      }
    } catch (error) {
      console.warn('⚠️ Memory integration failed:', error);
    }
  }

  async initializeWebSearch() {
    try {
      // Initialize web search capabilities
      this.webSearchEnabled = true;
      console.log('🌐 Web search capabilities enabled');
    } catch (error) {
      console.warn('⚠️ Web search initialization failed:', error);
    }
  }

  // Main Processing Method
  async processQuery(query, context = {}) {
    if (this.isProcessing) {
      throw new Error('Assistant is already processing a query');
    }

    try {
      console.log('🤖 Processing query:', query);
      
      this.isProcessing = true;
      
      // Notify thinking state
      this.eventHandlers.onThinking(true);
      
      // Add user message to conversation
      const userMessage = {
        id: this.generateMessageId(),
        type: 'user',
        content: query,
        timestamp: new Date().toISOString(),
        context
      };
      
      this.conversation.push(userMessage);
      
      // Build enhanced context
      const enhancedContext = await this.buildEnhancedContext(query, context);
      
      // Process the query
      const response = await this.generateResponse(query, enhancedContext);
      
      // Add assistant response to conversation
      const assistantMessage = {
        id: response.id || this.generateMessageId(),
        type: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        query: query,
        context: enhancedContext,
        actions: response.actions || []
      };
      
      this.conversation.push(assistantMessage);
      
      // Save conversation
      await this.saveConversation();
      
      // Create memory from interaction if meaningful
      if (this.options.enableMemory && this.memoryInterface) {
        await this.createMemoryFromInteraction(userMessage, assistantMessage);
      }
      
      // Notify response
      this.eventHandlers.onThinking(false);
      this.eventHandlers.onResponse(assistantMessage);
      
      // Handle any required actions
      if (response.actions && response.actions.length > 0) {
        for (const action of response.actions) {
          await this.handleAssistantAction(action);
        }
      }
      
      console.log('✅ Query processing complete');
      return assistantMessage;
      
    } catch (error) {
      console.error('❌ Query processing failed:', error);
      this.eventHandlers.onThinking(false);
      this.eventHandlers.onError(error.message);
      
      // Add error message to conversation
      const errorMessage = {
        id: this.generateMessageId(),
        type: 'assistant',
        content: `I apologize, but I encountered an error: ${error.message}`,
        timestamp: new Date().toISOString(),
        error: true
      };
      
      this.conversation.push(errorMessage);
      await this.saveConversation();
      
      return errorMessage;
    } finally {
      this.isProcessing = false;
    }
  }

  async buildEnhancedContext(query, context) {
    const enhancedContext = {
      ...context,
      query,
      timestamp: new Date().toISOString(),
      conversation: this.getRecentConversation(),
      browserContext: await this.getBrowserContext(),
      memories: await this.getRelevantMemories(query),
      userPreferences: await this.getUserPreferences()
    };
    
    return enhancedContext;
  }

  async generateResponse(query, context) {
    try {
      // This is a simplified response generation
      // In a real implementation, this would use a proper AI service
      
      const response = await this.generateIntelligentResponse(query, context);
      
      return {
        id: this.generateMessageId(),
        content: response.content,
        confidence: response.confidence,
        actions: response.actions || [],
        requiresAction: response.requiresAction || false
      };
      
    } catch (error) {
      console.error('❌ Response generation failed:', error);
      throw error;
    }
  }

  async generateIntelligentResponse(query, context) {
    // Simplified intelligent response generation
    const lowerQuery = query.toLowerCase();
    
    // Handle different types of queries
    if (lowerQuery.includes('search') || lowerQuery.includes('find')) {
      return await this.handleSearchQuery(query, context);
    }
    
    if (lowerQuery.includes('remember') || lowerQuery.includes('memory')) {
      return await this.handleMemoryQuery(query, context);
    }
    
    if (lowerQuery.includes('navigate') || lowerQuery.includes('go to')) {
      return await this.handleNavigationQuery(query, context);
    }
    
    if (lowerQuery.includes('help') || lowerQuery.includes('how do')) {
      return await this.handleHelpQuery(query, context);
    }
    
    // Default conversation response
    return await this.handleConversationQuery(query, context);
  }

  async handleSearchQuery(query, context) {
    const searchResults = await this.performSearch(query);
    
    return {
      content: `I found ${searchResults.length} results related to your search:\n\n${searchResults.slice(0, 3).map((result, index) => `${index + 1}. ${result.title}`).join('\n')}`,
      confidence: 0.8,
      actions: [
        {
          type: 'show_search_results',
          query: query,
          results: searchResults
        }
      ]
    };
  }

  async handleMemoryQuery(query, context) {
    if (!this.memoryInterface) {
      return {
        content: 'I don\'t have access to memory functions at the moment.',
        confidence: 0.5
      };
    }
    
    const memoryQuery = query.replace(/remember|memory|find/gi, '').trim();
    const memories = await this.memoryInterface.search(memoryQuery, { limit: 5 });
    
    if (memories.length === 0) {
      return {
        content: 'I don\'t have any memories related to that.',
        confidence: 0.7
      };
    }
    
    return {
      content: `I found ${memories.length} memories related to your query:\n\n${memories.slice(0, 3).map((memory, index) => `${index + 1}. ${memory.memory.title}: ${memory.memory.content.substring(0, 100)}...`).join('\n')}`,
      confidence: 0.9,
      actions: [
        {
          type: 'show_memory_results',
          query: memoryQuery,
          results: memories
        }
      ]
    };
  }

  async handleNavigationQuery(query, context) {
    // Extract URL from query
    const urlMatch = query.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const url = urlMatch[0];
      
      return {
        content: `I'll navigate to ${url} for you.`,
        confidence: 0.9,
        actions: [
          {
            type: 'navigate',
            url: url
          }
        ]
      };
    }
    
    // Handle general navigation
    const navigationKeywords = ['google', 'youtube', 'github', 'stackoverflow', 'reddit'];
    for (const keyword of navigationKeywords) {
      if (query.toLowerCase().includes(keyword)) {
        const url = `https://www.${keyword}.com`;
        
        return {
          content: `I'll take you to ${keyword}.`,
          confidence: 0.8,
          actions: [
            {
              type: 'navigate',
              url: url
            }
          ]
        };
      }
    }
    
    return {
      content: 'I could help you navigate to a specific website. Please provide the URL or tell me which site you\'d like to visit.',
      confidence: 0.6
    };
  }

  async handleHelpQuery(query, context) {
    const helpResponses = [
      'I can help you with:\n• Searching for information\n• Remembering important content\n• Navigating to websites\n• Analyzing web pages\n• Managing your browsing experience\n\nJust ask me anything!',
      'Here\'s what I can do:\n🔍 Search the web and your memories\n🧠 Save and recall important information\n🌐 Navigate to websites\n📝 Analyze page content\n🎤 Use voice commands\n\nHow can I assist you today?'
    ];
    
    return {
      content: helpResponses[Math.floor(Math.random() * helpResponses.length)],
      confidence: 0.9
    };
  }

  async handleConversationQuery(query, context) {
    // Generate contextual conversation responses
    const conversationContext = context.conversation.slice(-5);
    
    const responses = [
      'That\'s an interesting point. I\'m here to help you with your browsing experience and information needs.',
      'I understand. How can I assist you with that further?',
      'Thank you for sharing that with me. Is there anything specific you\'d like me to help you with?',
      'I appreciate you telling me that. What would you like to do next?',
      'That\'s great! I\'m here to make your browsing experience more intelligent and productive.'
    ];
    
    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      confidence: 0.7
    };
  }

  // Action Handling
  async handleAssistantAction(action) {
    try {
      console.log('⚡ Handling assistant action:', action);
      
      switch (action.type) {
        case 'navigate':
          if (window.spurBrowser) {
            await window.spurBrowser.navigateTo(action.url);
          }
          break;
          
        case 'show_search_results':
          this.displaySearchResults(action.results);
          break;
          
        case 'show_memory_results':
          this.displayMemoryResults(action.results);
          break;
          
        case 'create_memory':
          if (this.memoryInterface) {
            await this.memoryInterface.create(action.memory);
          }
          break;
          
        case 'voice_control':
          if (window.spurIntegration) {
            await window.spurIntegration.handleAssistantAction(action);
          }
          break;
          
        default:
          console.warn('⚠️ Unknown action type:', action.type);
      }
      
      this.eventHandlers.onActionRequired(action);
      
    } catch (error) {
      console.error('❌ Failed to handle assistant action:', error);
    }
  }

  // Search Methods
  async performSearch(query) {
    // Simulate web search
    const mockResults = [
      { title: 'Search Result 1', url: 'https://example.com/1', snippet: 'Relevant information about your query...' },
      { title: 'Search Result 2', url: 'https://example.com/2', snippet: 'More information related to your search...' },
      { title: 'Search Result 3', url: 'https://example.com/3', snippet: 'Additional search results for your query...' }
    ];
    
    return mockResults;
  }

  // Context Building Methods
  async getBrowserContext() {
    if (!window.spurBrowser) return null;
    
    return {
      currentUrl: window.spurBrowser.currentUrl,
      currentTitle: document.title,
      timestamp: new Date().toISOString()
    };
  }

  async getRelevantMemories(query) {
    if (!this.memoryInterface) return [];
    
    try {
      const memories = await this.memoryInterface.search(query, { limit: 5 });
      return memories.map(result => result.memory);
    } catch (error) {
      console.warn('⚠️ Failed to get relevant memories:', error);
      return [];
    }
  }

  async getUserPreferences() {
    try {
      const preferences = localStorage.getItem('spur_assistant_preferences');
      return preferences ? JSON.parse(preferences) : {
        responseStyle: 'helpful',
        detailLevel: 'balanced',
        enableMemory: true,
        enableWebSearch: true
      };
    } catch (error) {
      return {};
    }
  }

  getRecentConversation() {
    return this.conversation.slice(-10);
  }

  // UI Methods
  async sendMessage() {
    const input = document.getElementById('assistant-input');
    if (!input || !input.value.trim()) return;
    
    const query = input.value.trim();
    input.value = '';
    input.style.height = 'auto';
    
    // Add user message to UI
    this.addMessageToUI('user', query);
    
    // Process query
    await this.processQuery(query);
  }

  addMessageToUI(type, content, metadata = {}) {
    const conversation = document.getElementById('assistant-conversation');
    if (!conversation) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    if (type === 'user') {
      messageElement.innerHTML = `
        <div class="message-avatar">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <div class="message-content">
          <p>${this.escapeHtml(content)}</p>
        </div>
      `;
    } else {
      messageElement.innerHTML = `
        <div class="message-avatar">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <div class="message-content">
          <p>${this.formatResponse(content)}</p>
        </div>
      `;
    }
    
    conversation.appendChild(messageElement);
    conversation.scrollTop = conversation.scrollHeight;
  }

  formatResponse(content) {
    return content
      .replace(/\n\n/g, '</p><p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^/gm, '<p>')
      .replace(/$/gm, '</p>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  displaySearchResults(results) {
    // Update search results display in memory panel
    const memoryResults = document.getElementById('memory-results');
    if (!memoryResults) return;
    
    memoryResults.innerHTML = results.map((result, index) => `
      <div class="search-result">
        <div class="result-title">${result.title}</div>
        <div class="result-url">${result.url}</div>
        <div class="result-snippet">${result.snippet}</div>
      </div>
    `).join('');
  }

  displayMemoryResults(results) {
    const memoryResults = document.getElementById('memory-results');
    if (!memoryResults) return;
    
    memoryResults.innerHTML = results.map((result, index) => `
      <div class="memory-item" data-memory-id="${result.memory.id}">
        <div class="memory-title">${result.memory.title}</div>
        <div class="memory-content">${result.memory.content.substring(0, 200)}...</div>
        <div class="memory-meta">
          <span class="memory-type">${result.memory.type}</span>
          <span class="memory-time">${new Date(result.memory.timestamp).toLocaleString()}</span>
        </div>
      </div>
    `).join('');
  }

  async handleVoiceInput() {
    if (!window.spurIntegration) return;
    
    try {
      // Start voice recording
      await window.spurIntegration.handleVoiceToggle({ active: true });
      
      // Voice processing will be handled by the integration layer
      
    } catch (error) {
      console.error('❌ Voice input failed:', error);
      this.eventHandlers.onError(`Voice input failed: ${error.message}`);
    }
  }

  // Memory Integration
  async createMemoryFromInteraction(userMessage, assistantMessage) {
    if (!this.memoryInterface) return;
    
    try {
      // Create memory from meaningful interactions
      const memory = {
        type: 'assistant_interaction',
        title: `Assistant: ${userMessage.content.substring(0, 50)}...`,
        content: `Q: ${userMessage.content}\n\nA: ${assistantMessage.content}`,
        timestamp: new Date().toISOString(),
        tags: ['assistant', 'conversation', 'ai'],
        importance: this.calculateImportance(userMessage, assistantMessage),
        metadata: {
          messageId: assistantMessage.id,
          query: userMessage.content,
          responseLength: assistantMessage.content.length,
          confidence: assistantMessage.confidence || 0.5
        }
      };
      
      await this.memoryInterface.create(memory);
      
    } catch (error) {
      console.error('❌ Failed to create memory from interaction:', error);
    }
  }

  calculateImportance(userMessage, assistantMessage) {
    let importance = 2; // Base importance
    
    // Boost based on content length
    if (userMessage.content.length > 50) importance++;
    if (assistantMessage.content.length > 200) importance++;
    
    // Boost based on question complexity
    const questionWords = ['how', 'what', 'why', 'when', 'where', 'who', 'which'];
    if (questionWords.some(word => userMessage.content.toLowerCase().includes(word))) {
      importance++;
    }
    
    // Boost based on assistant confidence
    if (assistantMessage.confidence > 0.8) importance++;
    
    return Math.min(importance, 5);
  }

  // Utility Methods
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveConversation() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.conversation));
    } catch (error) {
      console.error('❌ Failed to save conversation:', error);
    }
  }

  async clearConversation() {
    this.conversation = [];
    await this.saveConversation();
    
    // Clear UI
    const conversation = document.getElementById('assistant-conversation');
    if (conversation) {
      conversation.innerHTML = `
        <div class="message assistant">
          <div class="message-avatar">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div class="message-content">
            <p>Hello! I'm your Spur Assistant. Our conversation has been cleared. How can I help you today?</p>
          </div>
        </div>
      `;
    }
    
    console.log('💬 Conversation cleared');
  }

  async exportConversation() {
    const exportData = {
      conversation: this.conversation,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  async getStats() {
    return {
      totalMessages: this.conversation.length,
      userMessages: this.conversation.filter(msg => msg.type === 'user').length,
      assistantMessages: this.conversation.filter(msg => msg.type === 'assistant').length,
      averageResponseLength: this.conversation
        .filter(msg => msg.type === 'assistant')
        .reduce((sum, msg) => sum + msg.content.length, 0) / this.conversation.filter(msg => msg.type === 'assistant').length,
      conversationStarted: this.conversation.length > 0 ? this.conversation[0].timestamp : null,
      lastActivity: this.conversation.length > 0 ? this.conversation[this.conversation.length - 1].timestamp : null
    };
  }

  // Cleanup Methods
  async destroy() {
    try {
      console.log('🧹 Destroying assistant interface...');
      
      // Save final state
      await this.saveConversation();
      
      // Clear processing state
      this.isProcessing = false;
      this.currentResponse = null;
      
      // Clear memory cache
      this.memoryCache.clear();
      
      this.isInitialized = false;
      
      console.log('✅ Assistant interface destroyed');
      
    } catch (error) {
      console.error('❌ Assistant interface destruction failed:', error);
    }
  }
}

// Initialize assistant interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.AssistantInterface = AssistantInterface;
});

// Export for use in other modules
window.AssistantInterface = AssistantInterface;