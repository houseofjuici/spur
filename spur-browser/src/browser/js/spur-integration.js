// Spur Browser - Main Integration Layer
// Coordinates all Spur components and provides unified API

class SpurIntegration {
  constructor() {
    this.isInitialized = false;
    this.components = {
      voice: null,
      memory: null,
      assistant: null
    };
    this.eventListeners = new Map();
    this.pendingActions = new Map();
    this.userId = null;
    this.sessionId = this.generateSessionId();
    
    console.log('🔗 Spur Integration layer initialized');
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Spur integration components...');
      
      // Initialize core components
      await this.initializeVoice();
      await this.initializeMemory();
      await this.initializeAssistant();
      
      // Set up event handling
      this.setupEventHandlers();
      
      // Set up IPC communication with main process
      this.setupIPCCommunication();
      
      // Initialize user session
      await this.initializeUserSession();
      
      this.isInitialized = true;
      console.log('✅ Spur integration initialized successfully');
      
      // Notify UI of initialization complete
      this.emit('integration-ready', {
        sessionId: this.sessionId,
        components: Object.keys(this.components).filter(key => this.components[key])
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Spur integration:', error);
      this.emit('integration-error', { error: error.message });
    }
  }

  // Voice Component Integration
  async initializeVoice() {
    try {
      console.log('🎤 Initializing privacy-first voice component...');
      
      // Check if voice interface exists
      if (window.VoiceInterface) {
        this.components.voice = new window.VoiceInterface({
          localProcessing: true,
          zeroAudioRetention: true,
          noiseCancellation: true,
          voiceEnhancement: true,
          realTimeVisualization: true,
          privacyFilters: true,
          audioQuality: 'medium',
          language: 'en-US',
          confidenceThreshold: 0.8,
          onRecordingStart: this.onVoiceRecordingStart.bind(this),
          onRecordingStop: this.onVoiceRecordingStop.bind(this),
          onTranscription: this.onVoiceTranscription.bind(this),
          onError: this.onVoiceError.bind(this),
          onAudioLevel: this.onVoiceAudioLevel.bind(this),
          onPrivacyUpdate: this.onVoicePrivacyUpdate.bind(this),
          onSpeechActivity: this.onVoiceSpeechActivity.bind(this)
        });
        
        await this.components.voice.initialize();
        this.setupPrivacyControls();
        console.log('✅ Privacy-first voice component initialized');
      } else {
        console.warn('⚠️ Voice interface not available');
      }
      
    } catch (error) {
      console.error('❌ Voice initialization failed:', error);
      this.emit('voice-error', { error: error.message });
    }
  }

  // Memory Component Integration
  async initializeMemory() {
    try {
      console.log('🧠 Initializing memory component...');
      
      // Check if memory interface exists
      if (window.MemoryInterface) {
        this.components.memory = new window.MemoryInterface({
          onMemoryCreated: this.onMemoryCreated.bind(this),
          onMemoryUpdated: this.onMemoryUpdated.bind(this),
          onMemoryDeleted: this.onMemoryDeleted.bind(this),
          onSearchComplete: this.onMemorySearchComplete.bind(this),
          onError: this.onMemoryError.bind(this)
        });
        
        await this.components.memory.initialize();
        console.log('✅ Memory component initialized');
      } else {
        console.warn('⚠️ Memory interface not available');
      }
      
    } catch (error) {
      console.error('❌ Memory initialization failed:', error);
      this.emit('memory-error', { error: error.message });
    }
  }

  // Assistant Component Integration
  async initializeAssistant() {
    try {
      console.log('🤖 Initializing assistant component...');
      
      // Check if assistant interface exists
      if (window.AssistantInterface) {
        this.components.assistant = new window.AssistantInterface({
          onResponse: this.onAssistantResponse.bind(this),
          onThinking: this.onAssistantThinking.bind(this),
          onError: this.onAssistantError.bind(this),
          onActionRequired: this.onAssistantActionRequired.bind(this)
        });
        
        await this.components.assistant.initialize();
        console.log('✅ Assistant component initialized');
      } else {
        console.warn('⚠️ Assistant interface not available');
      }
      
    } catch (error) {
      console.error('❌ Assistant initialization failed:', error);
      this.emit('assistant-error', { error: error.message });
    }
  }

  // Event Handler Setup
  setupEventHandlers() {
    // Handle voice-related events from UI
    document.addEventListener('voice-toggle', (event) => {
      this.handleVoiceToggle(event.detail);
    });

    // Handle memory search requests
    document.addEventListener('memory-search', (event) => {
      this.handleMemorySearch(event.detail);
    });

    // Handle assistant queries
    document.addEventListener('assistant-query', (event) => {
      this.handleAssistantQuery(event.detail);
    });

    // Handle browser navigation events
    document.addEventListener('browser-navigate', (event) => {
      this.handleBrowserNavigation(event.detail);
    });

    // Handle page content analysis
    document.addEventListener('analyze-page', (event) => {
      this.handlePageAnalysis(event.detail);
    });
  }

  setupPrivacyControls() {
    // Set up privacy control event listeners
    this.setupPrivacyCheckboxListeners();
    this.setupPrivacySelectListeners();
    this.initializePrivacyDisplay();
  }

  setupPrivacyCheckboxListeners() {
    const privacyControls = [
      'zero-retention',
      'local-processing',
      'privacy-filters',
      'noise-cancellation'
    ];

    privacyControls.forEach(controlId => {
      const checkbox = document.getElementById(controlId);
      if (checkbox) {
        checkbox.addEventListener('change', (event) => {
          this.handlePrivacyControlChange(controlId, event.target.checked);
        });
      }
    });
  }

  setupPrivacySelectListeners() {
    const audioQualitySelect = document.getElementById('audio-quality');
    if (audioQualitySelect) {
      audioQualitySelect.addEventListener('change', (event) => {
        this.handleAudioQualityChange(event.target.value);
      });
    }
  }

  // IPC Communication Setup
  setupIPCCommunication() {
    // Set up listeners for main process messages
    if (window.api) {
      window.api.on('spur-voice-toggle', (data) => {
        this.handleVoiceToggle(data);
      });

      window.api.on('spur-memory-search', (data) => {
        this.handleMemorySearch(data);
      });

      window.api.on('spur-assistant-query', (data) => {
        this.handleAssistantQuery(data);
      });

      window.api.on('theme-updated', (data) => {
        this.emit('theme-changed', data);
      });

      window.api.on('deep-link', (data) => {
        this.handleDeepLink(data);
      });
    }
  }

  // User Session Initialization
  async initializeUserSession() {
    try {
      // Get or create user ID
      this.userId = await this.getUserId();
      
      // Initialize session tracking
      await this.trackSessionStart();
      
      console.log('👤 User session initialized:', this.userId);
      
    } catch (error) {
      console.error('❌ User session initialization failed:', error);
    }
  }

  // Voice Event Handlers
  onVoiceRecordingStart() {
    console.log('🎤 Voice recording started');
    this.emit('voice-recording-started');
    this.updateVoiceUI(true);
  }

  onVoiceRecordingStop() {
    console.log('🎤 Voice recording stopped');
    this.emit('voice-recording-stopped');
    this.updateVoiceUI(false);
  }

  onVoiceTranscription(transcription) {
    console.log('📝 Voice transcription:', transcription);
    this.emit('voice-transcription', { transcription });
    
    // Process transcription through assistant if available
    if (this.components.assistant && transcription.trim()) {
      this.handleAssistantQuery({ query: transcription, source: 'voice' });
    }
  }

  onVoiceError(error) {
    console.error('❌ Voice error:', error);
    this.emit('voice-error', { error });
    this.updateVoiceUI(false, error);
  }

  onVoiceAudioLevel(level) {
    // Update audio level visualization
    this.updateAudioLevelDisplay(level);
  }

  onVoicePrivacyUpdate(metrics) {
    console.log('🔒 Privacy metrics updated:', metrics);
    this.updatePrivacyDisplay(metrics);
  }

  onVoiceSpeechActivity(isActive) {
    console.log('🗣️ Speech activity detected:', isActive);
    this.updateSpeechActivityDisplay(isActive);
  }

  // Memory Event Handlers
  onMemoryCreated(memory) {
    console.log('💾 Memory created:', memory.id);
    this.emit('memory-created', memory);
    this.updateMemoryUI(memory);
  }

  onMemoryUpdated(memory) {
    console.log('💾 Memory updated:', memory.id);
    this.emit('memory-updated', memory);
    this.updateMemoryUI(memory);
  }

  onMemoryDeleted(memoryId) {
    console.log('💾 Memory deleted:', memoryId);
    this.emit('memory-deleted', { memoryId });
    this.updateMemoryUI({ id: memoryId, deleted: true });
  }

  onMemorySearchComplete(results) {
    console.log('🔍 Memory search complete:', results.length, 'results');
    this.emit('memory-search-complete', { results });
    this.updateMemorySearchUI(results);
  }

  onMemoryError(error) {
    console.error('❌ Memory error:', error);
    this.emit('memory-error', { error });
  }

  // Assistant Event Handlers
  onAssistantResponse(response) {
    console.log('🤖 Assistant response:', response.id);
    this.emit('assistant-response', response);
    this.updateAssistantUI(response);
    
    // Create memory from assistant response if meaningful
    if (response.content && response.content.length > 50) {
      this.createMemoryFromAssistant(response);
    }
  }

  onAssistantThinking(thinking) {
    console.log('🧠 Assistant thinking...');
    this.emit('assistant-thinking', { thinking });
    this.updateAssistantUI({ thinking });
  }

  onAssistantError(error) {
    console.error('❌ Assistant error:', error);
    this.emit('assistant-error', { error });
    this.updateAssistantUI({ error });
  }

  onAssistantActionRequired(action) {
    console.log('⚡ Assistant action required:', action);
    this.emit('assistant-action-required', action);
    this.handleAssistantAction(action);
  }

  // Action Handlers
  async handleVoiceToggle(data) {
    try {
      if (this.components.voice) {
        if (data.active) {
          await this.components.voice.startRecording();
        } else {
          await this.components.voice.stopRecording();
        }
      }
    } catch (error) {
      console.error('❌ Voice toggle failed:', error);
    }
  }

  async handleMemorySearch(data) {
    try {
      if (this.components.memory) {
        const results = await this.components.memory.search(data.query);
        this.onMemorySearchComplete(results);
      }
    } catch (error) {
      console.error('❌ Memory search failed:', error);
    }
  }

  async handleAssistantQuery(data) {
    try {
      const queryId = this.generateQueryId();
      this.pendingActions.set(queryId, { type: 'assistant-query', data });
      
      if (this.components.assistant) {
        const context = await this.buildAssistantContext(data);
        const response = await this.components.assistant.processQuery(data.query, context);
        this.pendingActions.delete(queryId);
      }
    } catch (error) {
      console.error('❌ Assistant query failed:', error);
    }
  }

  async handleBrowserNavigation(data) {
    try {
      // Analyze page content if needed
      if (this.components.memory && data.url && data.title) {
        await this.createMemoryFromNavigation(data);
      }
    } catch (error) {
      console.error('❌ Browser navigation handling failed:', error);
    }
  }

  async handlePageAnalysis(data) {
    try {
      // Analyze page content and create memories
      if (this.components.memory && data.content) {
        await this.analyzeAndCreateMemories(data);
      }
    } catch (error) {
      console.error('❌ Page analysis failed:', error);
    }
  }

  async handleAssistantAction(action) {
    try {
      switch (action.type) {
        case 'navigate':
          if (window.spurBrowser) {
            window.spurBrowser.navigateTo(action.url);
          }
          break;
        case 'search':
          if (this.components.memory) {
            const results = await this.components.memory.search(action.query);
            this.onMemorySearchComplete(results);
          }
          break;
        case 'create_memory':
          if (this.components.memory) {
            await this.components.memory.create(action.memory);
          }
          break;
        case 'voice_control':
          if (this.components.voice) {
            if (action.action === 'start') {
              await this.components.voice.startRecording();
            } else {
              await this.components.voice.stopRecording();
            }
          }
          break;
        default:
          console.warn('⚠️ Unknown assistant action:', action.type);
      }
    } catch (error) {
      console.error('❌ Assistant action handling failed:', error);
    }
  }

  async handleDeepLink(data) {
    try {
      console.log('🔗 Handling deep link:', data.url);
      
      // Parse deep link URL
      const url = new URL(data.url);
      const path = url.pathname;
      const params = new URLSearchParams(url.search);
      
      switch (path) {
        case '/voice':
          this.handleVoiceToggle({ active: true });
          break;
        case '/search':
          this.handleMemorySearch({ query: params.get('q') || '' });
          break;
        case '/chat':
          this.handleAssistantQuery({ query: params.get('q') || '' });
          break;
        default:
          console.warn('⚠️ Unknown deep link path:', path);
      }
    } catch (error) {
      console.error('❌ Deep link handling failed:', error);
    }
  }

  // Context Building
  async buildAssistantContext(data) {
    const context = {
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      source: data.source || 'manual',
      currentUrl: window.spurBrowser?.currentUrl || null,
      currentTitle: document.title || 'Spur Browser',
      recentMemories: [],
      userPreferences: await this.getUserPreferences()
    };

    // Get recent memories if memory component is available
    if (this.components.memory) {
      try {
        const recentMemories = await this.components.memory.getRecent(5);
        context.recentMemories = recentMemories;
      } catch (error) {
        console.warn('⚠️ Failed to get recent memories:', error);
      }
    }

    return context;
  }

  // Memory Creation Helpers
  async createMemoryFromNavigation(data) {
    if (!this.components.memory) return;

    try {
      const memory = {
        type: 'navigation',
        title: data.title,
        url: data.url,
        timestamp: new Date().toISOString(),
        content: `Visited: ${data.title}`,
        tags: ['navigation', 'browsing'],
        importance: 2
      };

      await this.components.memory.create(memory);
    } catch (error) {
      console.error('❌ Failed to create navigation memory:', error);
    }
  }

  async createMemoryFromAssistant(response) {
    if (!this.components.memory) return;

    try {
      const memory = {
        type: 'assistant_interaction',
        title: `Assistant: ${response.content.substring(0, 50)}...`,
        content: response.content,
        timestamp: new Date().toISOString(),
        tags: ['assistant', 'conversation'],
        importance: 3,
        metadata: {
          responseId: response.id,
          query: response.query,
          context: response.context
        }
      };

      await this.components.memory.create(memory);
    } catch (error) {
      console.error('❌ Failed to create assistant memory:', error);
    }
  }

  async analyzeAndCreateMemories(data) {
    if (!this.components.memory) return;

    try {
      // Extract important information from page content
      const analysis = await this.analyzePageContent(data.content);
      
      if (analysis.importantSections.length > 0) {
        for (const section of analysis.importantSections) {
          const memory = {
            type: 'page_analysis',
            title: section.title,
            content: section.content,
            url: data.url,
            timestamp: new Date().toISOString(),
            tags: ['analysis', 'content', ...section.tags],
            importance: section.importance,
            metadata: {
              analysisType: 'content_extraction',
              confidence: section.confidence
            }
          };

          await this.components.memory.create(memory);
        }
      }
    } catch (error) {
      console.error('❌ Failed to analyze and create memories:', error);
    }
  }

  async analyzePageContent(content) {
    // Simple content analysis (in real implementation, this would use more sophisticated NLP)
    const sections = [];
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract meaningful sections based on length and keywords
    if (text.length > 200) {
      sections.push({
        title: 'Main Content',
        content: text.substring(0, 500),
        importance: 4,
        tags: ['main_content'],
        confidence: 0.8
      });
    }

    return { importantSections: sections };
  }

  // UI Update Methods
  updateVoiceUI(recording, error = null) {
    const voiceBtn = document.getElementById('voice-btn');
    const voiceIndicator = document.querySelector('.voice-indicator');
    
    if (voiceBtn) {
      voiceBtn.classList.toggle('recording', recording);
      voiceBtn.classList.toggle('error', !!error);
    }
    
    if (voiceIndicator) {
      voiceIndicator.style.opacity = recording ? '1' : '0';
    }

    // Update voice panel
    const voiceStatus = document.getElementById('voice-status');
    if (voiceStatus) {
      if (error) {
        voiceStatus.innerHTML = `<p style="color: var(--ui-error);">Error: ${error}</p>`;
      } else if (recording) {
        voiceStatus.innerHTML = '<p>Recording... Speak now</p>';
      } else {
        voiceStatus.innerHTML = '<p>Ready to listen...</p>';
      }
    }
  }

  updateMemoryUI(memory) {
    if (memory.deleted) {
      // Remove from UI if present
      const memoryElement = document.querySelector(`[data-memory-id="${memory.id}"]`);
      if (memoryElement) {
        memoryElement.remove();
      }
      return;
    }

    // Add or update memory in UI
    const memoryResults = document.getElementById('memory-results');
    if (!memoryResults) return;

    let memoryElement = document.querySelector(`[data-memory-id="${memory.id}"]`);
    
    if (!memoryElement) {
      memoryElement = document.createElement('div');
      memoryElement.className = 'memory-item';
      memoryElement.dataset.memoryId = memory.id;
      memoryResults.insertBefore(memoryElement, memoryResults.firstChild);
    }

    memoryElement.innerHTML = `
      <div class="memory-title">${memory.title}</div>
      <div class="memory-content">${memory.content}</div>
      <div class="memory-meta">
        <span class="memory-type">${memory.type}</span>
        <span class="memory-time">${new Date(memory.timestamp).toLocaleString()}</span>
      </div>
    `;
  }

  updateMemorySearchUI(results) {
    const memoryResults = document.getElementById('memory-results');
    if (!memoryResults) return;

    if (results.length === 0) {
      memoryResults.innerHTML = `
        <div class="empty-state">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <p>No memories found for your search</p>
        </div>
      `;
      return;
    }

    memoryResults.innerHTML = results.map(memory => `
      <div class="memory-item" data-memory-id="${memory.id}">
        <div class="memory-title">${memory.title}</div>
        <div class="memory-content">${memory.content}</div>
        <div class="memory-meta">
          <span class="memory-type">${memory.type}</span>
          <span class="memory-time">${new Date(memory.timestamp).toLocaleString()}</span>
          <span class="memory-importance">Importance: ${memory.importance}/5</span>
        </div>
      </div>
    `).join('');
  }

  // Privacy Control Handler Methods
  handlePrivacyControlChange(controlId, isChecked) {
    if (!this.components.voice) return;

    const optionMap = {
      'zero-retention': 'zeroAudioRetention',
      'local-processing': 'localProcessing',
      'privacy-filters': 'privacyFilters',
      'noise-cancellation': 'noiseCancellation'
    };

    const option = optionMap[controlId];
    if (option) {
      this.components.voice.updateOptions({ [option]: isChecked });
      console.log(`🔒 Updated privacy option ${option}: ${isChecked}`);
      
      // Update privacy display
      this.updatePrivacyDisplay(this.components.voice.privacyMetrics);
    }
  }

  handleAudioQualityChange(quality) {
    if (!this.components.voice) return;

    this.components.voice.setAudioQuality(quality);
    console.log(`🎵 Updated audio quality: ${quality}`);
    
    // Update privacy display
    this.updatePrivacyDisplay(this.components.voice.privacyMetrics);
  }

  // Privacy Display Update Methods
  updateAudioLevelDisplay(level) {
    const audioLevelElement = document.querySelector('.audio-level');
    if (audioLevelElement) {
      const percentage = Math.round(level * 100);
      audioLevelElement.textContent = `Level: ${percentage}%`;
    }
  }

  updateSpeechActivityDisplay(isActive) {
    const speechActivityElement = document.querySelector('.speech-activity');
    if (speechActivityElement) {
      speechActivityElement.textContent = `Speech: ${isActive ? 'Yes' : 'No'}`;
      speechActivityElement.classList.toggle('active', isActive);
    }
  }

  updatePrivacyDisplay(metrics) {
    if (!metrics) return;

    // Update privacy score
    const privacyScoreElement = document.getElementById('privacy-score');
    if (privacyScoreElement) {
      privacyScoreElement.textContent = `${metrics.privacyScore}%`;
    }

    // Update audio processed
    const audioProcessedElement = document.getElementById('audio-processed');
    if (audioProcessedElement) {
      audioProcessedElement.textContent = metrics.totalAudioProcessed;
    }

    // Update audio retained
    const audioRetainedElement = document.getElementById('audio-retained');
    if (audioRetainedElement) {
      audioRetainedElement.textContent = metrics.audioRetained;
    }

    // Update safety status
    const safetyStatusElement = document.getElementById('safety-status');
    if (safetyStatusElement) {
      const safetyCheck = this.components.voice.checkAudioSafety();
      safetyStatusElement.textContent = safetyCheck.isSafe ? 'Safe' : 'Warning';
      safetyStatusElement.style.color = safetyCheck.isSafe ? 'var(--ui-success)' : 'var(--ui-warning)';
    }

    // Update privacy status indicator
    const privacyStatus = document.getElementById('privacy-status');
    if (privacyStatus) {
      const indicator = privacyStatus.querySelector('.privacy-indicator');
      const text = privacyStatus.querySelector('span');
      
      if (indicator && text) {
        let status, color;
        if (metrics.privacyScore >= 90) {
          status = 'Excellent';
          color = 'excellent';
        } else if (metrics.privacyScore >= 70) {
          status = 'Good';
          color = 'good';
        } else if (metrics.privacyScore >= 50) {
          status = 'Fair';
          color = 'fair';
        } else {
          status = 'Poor';
          color = 'poor';
        }
        
        indicator.className = `privacy-indicator ${color}`;
        text.textContent = `Privacy: ${status} (${metrics.privacyScore}%)`;
      }
    }
  }

  initializePrivacyDisplay() {
    if (this.components.voice) {
      this.updatePrivacyDisplay(this.components.voice.privacyMetrics);
    }
  }

  updateAssistantUI(data) {
    const conversation = document.getElementById('assistant-conversation');
    if (!conversation) return;

    if (data.thinking) {
      // Add thinking indicator
      const thinkingElement = document.createElement('div');
      thinkingElement.className = 'message assistant thinking';
      thinkingElement.innerHTML = `
        <div class="message-avatar">
          <div class="thinking-spinner">🧠</div>
        </div>
        <div class="message-content">
          <p>Thinking...</p>
        </div>
      `;
      conversation.appendChild(thinkingElement);
      conversation.scrollTop = conversation.scrollHeight;
      return;
    }

    if (data.error) {
      // Add error message
      const errorElement = document.createElement('div');
      errorElement.className = 'message assistant error';
      errorElement.innerHTML = `
        <div class="message-avatar">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <div class="message-content">
          <p style="color: var(--ui-error);">Error: ${data.error}</p>
        </div>
      `;
      conversation.appendChild(errorElement);
      conversation.scrollTop = conversation.scrollHeight;
      return;
    }

    if (data.response) {
      // Remove any thinking indicators
      const thinkingElements = conversation.querySelectorAll('.thinking');
      thinkingElements.forEach(el => el.remove());

      // Add response message
      const responseElement = document.createElement('div');
      responseElement.className = 'message assistant';
      responseElement.innerHTML = `
        <div class="message-avatar">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <div class="message-content">
          <p>${this.formatAssistantResponse(data.response.content)}</p>
        </div>
      `;
      conversation.appendChild(responseElement);
      conversation.scrollTop = conversation.scrollHeight;
    }
  }

  formatAssistantResponse(content) {
    // Simple formatting for assistant responses
    return content
      .replace(/\n\n/g, '</p><p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  // Utility Methods
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getUserId() {
    try {
      // Try to get user ID from local storage
      let userId = localStorage.getItem('spur_user_id');
      
      if (!userId) {
        // Generate new user ID
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('spur_user_id', userId);
      }
      
      return userId;
    } catch (error) {
      console.error('❌ Failed to get user ID:', error);
      return `anonymous_${Date.now()}`;
    }
  }

  async getUserPreferences() {
    try {
      const preferences = localStorage.getItem('spur_preferences');
      return preferences ? JSON.parse(preferences) : {
        theme: 'dark',
        voiceEnabled: true,
        assistantEnabled: true,
        memoryEnabled: true
      };
    } catch (error) {
      console.error('❌ Failed to get user preferences:', error);
      return {};
    }
  }

  async trackSessionStart() {
    try {
      if (this.components.memory) {
        await this.components.memory.create({
          type: 'session',
          title: 'Browser Session Started',
          content: `Session ${this.sessionId} started`,
          timestamp: new Date().toISOString(),
          tags: ['session', 'browser'],
          importance: 1
        });
      }
    } catch (error) {
      console.error('❌ Failed to track session start:', error);
    }
  }

  // Event System
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Event handler error for ${event}:`, error);
        }
      });
    }

    // Dispatch DOM event for UI components
    document.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  // Public API
  async getComponent(name) {
    return this.components[name];
  }

  async isReady() {
    return this.isInitialized && Object.values(this.components).every(component => component);
  }

  async getStatus() {
    return {
      initialized: this.isInitialized,
      components: Object.keys(this.components).reduce((status, name) => {
        status[name] = !!this.components[name];
        return status;
      }, {}),
      session: {
        id: this.sessionId,
        userId: this.userId
      },
      pendingActions: this.pendingActions.size
    };
  }

  async shutdown() {
    console.log('🔄 Shutting down Spur integration...');
    
    // Shutdown all components
    for (const [name, component] of Object.entries(this.components)) {
      if (component && typeof component.destroy === 'function') {
        try {
          await component.destroy();
          console.log(`✅ ${name} component shutdown`);
        } catch (error) {
          console.error(`❌ ${name} component shutdown failed:`, error);
        }
      }
    }

    // Clear pending actions
    this.pendingActions.clear();
    
    // Clear event listeners
    this.eventListeners.clear();
    
    this.isInitialized = false;
    console.log('✅ Spur integration shutdown complete');
  }
}

// Initialize integration when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  window.spurIntegration = new SpurIntegration();
  await window.spurIntegration.initialize();
});

// Export for use in other modules
window.SpurIntegration = SpurIntegration;