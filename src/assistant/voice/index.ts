export interface VoiceConfig {
  enabled: boolean;
  language: string;
  voice: string;
  pitch: number;
  rate: number;
  volume: number;
  continuous: boolean;
  autoStop: boolean;
  maxRecordingTime: number; // seconds
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: string[];
}

export interface VoiceSynthesisOptions {
  text: string;
  language?: string;
  voice?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export class VoiceIntegration {
  private config: VoiceConfig;
  private isInitialized = false;
  private isRunning = false;

  // Web Speech API components
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  // State management
  private isListening = false;
  private isSpeaking = false;
  private currentSessionId: string | null = null;

  // Event handlers
  private speechRecognizedHandlers: Set<(result: VoiceRecognitionResult, sessionId: string) => void> = new Set();
  private speechStartHandlers: Set<() => void> = new Set();
  private speechEndHandlers: Set<() => void> = new Set();
  private errorHandler?: (error: Error) => void;

  // Metrics
  private metrics = {
    totalRecognitions: 0,
    successfulRecognitions: 0,
    averageConfidence: 0,
    totalSyntheses: 0,
    averageResponseTime: 0,
    errors: 0
  };

  constructor(config: VoiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[VoiceIntegration] Initializing...');

      // Check for Web Speech API support
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        throw new Error('Speech recognition not supported in this browser');
      }

      if (!('speechSynthesis' in window)) {
        throw new Error('Speech synthesis not supported in this browser');
      }

      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();

      // Configure recognition
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.language;
      this.recognition.maxAlternatives = 3;

      // Set up recognition event handlers
      this.setupRecognitionHandlers();

      // Initialize speech synthesis
      this.synthesis = window.speechSynthesis;
      await this.loadVoices();

      this.isInitialized = true;
      console.log('[VoiceIntegration] Initialized successfully');

    } catch (error) {
      console.error('[VoiceIntegration] Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[VoiceIntegration] Starting...');
      this.isRunning = true;
      console.log('[VoiceIntegration] Started successfully');

    } catch (error) {
      console.error('[VoiceIntegration] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[VoiceIntegration] Stopping...');

      // Stop any ongoing recognition
      if (this.isListening) {
        await this.stopListening();
      }

      // Stop any ongoing speech
      if (this.isSpeaking) {
        this.synthesis?.cancel();
        this.isSpeaking = false;
      }

      this.isRunning = false;
      console.log('[VoiceIntegration] Stopped successfully');

    } catch (error) {
      console.error('[VoiceIntegration] Stop failed:', error);
    }
  }

  async startListening(sessionId: string): Promise<void> {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('Voice integration not initialized or running');
    }

    if (this.isListening) {
      console.warn('[VoiceIntegration] Already listening');
      return;
    }

    try {
      console.log('[VoiceIntegration] Starting listening...');
      this.isListening = true;
      this.currentSessionId = sessionId;

      if (this.recognition) {
        this.recognition.start();
        this.notifySpeechStart();
      }

    } catch (error) {
      this.isListening = false;
      this.currentSessionId = null;
      console.error('[VoiceIntegration] Error starting recognition:', error);
      this.handleError(error as Error);
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    try {
      console.log('[VoiceIntegration] Stopping listening...');
      this.isListening = false;

      if (this.recognition) {
        this.recognition.stop();
        this.notifySpeechEnd();
      }

    } catch (error) {
      console.error('[VoiceIntegration] Error stopping recognition:', error);
      this.handleError(error as Error);
    } finally {
      this.currentSessionId = null;
    }
  }

  async speak(text: string, options: Partial<VoiceSynthesisOptions> = {}): Promise<void> {
    if (!this.isInitialized || !this.isRunning || !this.synthesis) {
      throw new Error('Voice integration not initialized or running');
    }

    if (this.isSpeaking) {
      this.synthesis.cancel();
    }

    const startTime = performance.now();

    try {
      console.log('[VoiceIntegration] Speaking:', text);

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure utterance
      utterance.lang = options.language || this.config.language;
      utterance.voice = this.getVoice(options.voice || this.config.voice);
      utterance.pitch = options.pitch ?? this.config.pitch;
      utterance.rate = options.rate ?? this.config.rate;
      utterance.volume = options.volume ?? this.config.volume;

      // Set up event handlers
      utterance.onstart = () => {
        this.isSpeaking = true;
        options.onStart?.();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        options.onEnd?.();
        this.updateSynthesisMetrics(performance.now() - startTime);
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        const error = new Error(`Speech synthesis error: ${event.error}`);
        options.onError?.(error);
        this.handleError(error);
      };

      // Speak
      this.synthesis.speak(utterance);

    } catch (error) {
      this.isSpeaking = false;
      console.error('[VoiceIntegration] Error speaking:', error);
      this.handleError(error as Error);
    }
  }

  async stopSpeaking(): Promise<void> {
    if (this.isSpeaking && this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  isListeningActive(): boolean {
    return this.isListening;
  }

  isSpeakingActive(): boolean {
    return this.isSpeaking;
  }

  getCurrentSession(): string | null {
    return this.currentSessionId;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return [...this.voices];
  }

  getVoiceByLanguage(language: string): SpeechSynthesisVoice[] {
    return this.voices.filter(voice => voice.lang.startsWith(language));
  }

  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event) => {
      this.handleRecognitionResult(event);
    };

    this.recognition.onerror = (event) => {
      this.handleRecognitionError(event);
    };

    this.recognition.onend = () => {
      this.handleRecognitionEnd();
    };

    this.recognition.onstart = () => {
      console.log('[VoiceIntegration] Recognition started');
    };

    this.recognition.onspeechstart = () => {
      console.log('[VoiceIntegration] Speech detected');
    };

    this.recognition.onspeechend = () => {
      console.log('[VoiceIntegration] Speech ended');
    };
  }

  private handleRecognitionResult(event: SpeechRecognitionEvent): void {
    if (!this.currentSessionId) return;

    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;

      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Handle final results
    if (finalTranscript.trim()) {
      const recognitionResult: VoiceRecognitionResult = {
        transcript: finalTranscript.trim(),
        confidence: event.results[0]?.[0]?.confidence || 0,
        isFinal: true,
        alternatives: Array.from(event.results)
          .map(result => result[0]?.transcript)
          .filter((transcript, index, array) => transcript && array.indexOf(transcript) === index)
      };

      this.handleSpeechRecognized(recognitionResult);
    }

    // If auto-stop is enabled and we have a final result, stop listening
    if (this.config.autoStop && finalTranscript.trim() && !this.config.continuous) {
      setTimeout(() => this.stopListening(), 1000);
    }
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEvent): void {
    console.error('[VoiceIntegration] Recognition error:', event.error);
    this.metrics.errors++;

    const error = new Error(`Speech recognition error: ${event.error}`);
    this.handleError(error);

    // Stop listening on error
    if (this.isListening) {
      this.stopListening().catch(console.error);
    }
  }

  private handleRecognitionEnd(): void {
    console.log('[VoiceIntegration] Recognition ended');
    
    // If we're still supposed to be listening and continuous mode is on, restart
    if (this.isListening && this.config.continuous) {
      try {
        this.recognition?.start();
      } catch (error) {
        console.error('[VoiceIntegration] Error restarting recognition:', error);
        this.isListening = false;
        this.currentSessionId = null;
      }
    } else if (!this.config.continuous) {
      this.isListening = false;
      this.currentSessionId = null;
      this.notifySpeechEnd();
    }
  }

  private handleSpeechRecognized(result: VoiceRecognitionResult): void {
    if (!this.currentSessionId) return;

    console.log('[VoiceIntegration] Speech recognized:', result.transcript);
    
    // Update metrics
    this.metrics.totalRecognitions++;
    this.metrics.successfulRecognitions++;
    this.metrics.averageConfidence = this.updateAverage(
      this.metrics.averageConfidence,
      result.confidence,
      this.metrics.totalRecognitions
    );

    // Notify handlers
    this.speechRecognizedHandlers.forEach(handler => {
      try {
        handler(result, this.currentSessionId!);
      } catch (error) {
        console.error('[VoiceIntegration] Error in speech recognized handler:', error);
      }
    });
  }

  private async loadVoices(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not available'));
        return;
      }

      const loadVoices = () => {
        this.voices = this.synthesis!.getVoices();
        if (this.voices.length > 0) {
          console.log(`[VoiceIntegration] Loaded ${this.voices.length} voices`);
          resolve();
        } else {
          setTimeout(loadVoices, 100);
        }
      };

      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = loadVoices;
      } else {
        loadVoices();
      }
    });
  }

  private getVoice(voiceName: string): SpeechSynthesisVoice | null {
    if (!this.voices.length) return null;

    // Try to find exact match
    let voice = this.voices.find(v => v.name === voiceName);
    
    // If not found, try to find voice for current language
    if (!voice) {
      voice = this.voices.find(v => 
        v.lang.startsWith(this.config.language.split('-')[0]) && v.default
      );
    }

    // If still not found, use any available voice
    if (!voice) {
      voice = this.voices.find(v => v.lang.startsWith(this.config.language.split('-')[0]));
    }

    // Final fallback
    if (!voice) {
      voice = this.voices[0];
    }

    return voice || null;
  }

  private updateSynthesisMetrics(processingTime: number): void {
    this.metrics.totalSyntheses++;
    this.metrics.averageResponseTime = this.updateAverage(
      this.metrics.averageResponseTime,
      processingTime,
      this.metrics.totalSyntheses
    );
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  private notifySpeechStart(): void {
    this.speechStartHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('[VoiceIntegration] Error in speech start handler:', error);
      }
    });
  }

  private notifySpeechEnd(): void {
    this.speechEndHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('[VoiceIntegration] Error in speech end handler:', error);
      }
    });
  }

  private handleError(error: Error): void {
    this.metrics.errors++;
    
    if (this.errorHandler) {
      try {
        this.errorHandler(error);
      } catch (handlerError) {
        console.error('[VoiceIntegration] Error in error handler:', handlerError);
      }
    }
  }

  // Public API methods
  onSpeechRecognized(callback: (result: VoiceRecognitionResult, sessionId: string) => void): () => void {
    this.speechRecognizedHandlers.add(callback);
    return () => this.speechRecognizedHandlers.delete(callback);
  }

  onSpeechStart(callback: () => void): () => void {
    this.speechStartHandlers.add(callback);
    return () => this.speechStartHandlers.delete(callback);
  }

  onSpeechEnd(callback: () => void): () => void {
    this.speechEndHandlers.add(callback);
    return () => this.speechEndHandlers.delete(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorHandler = callback;
  }

  isHealthy(): boolean {
    return this.isRunning && this.metrics.errors / Math.max(this.metrics.totalRecognitions, 1) < 0.1;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  async updateConfig(newConfig: Partial<VoiceConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Update recognition if running
    if (this.recognition && this.isRunning) {
      this.recognition.continuous = this.config.continuous;
      this.recognition.lang = this.config.language;
    }
  }

  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    try {
      // Clean up recognition
      if (this.recognition) {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.onstart = null;
        this.recognition.onspeechstart = null;
        this.recognition.onspeechend = null;
      }

      // Clean up synthesis
      if (this.synthesis) {
        this.synthesis.cancel();
        this.synthesis.onvoiceschanged = null;
      }

      // Clear handlers
      this.speechRecognizedHandlers.clear();
      this.speechStartHandlers.clear();
      this.speechEndHandlers.clear();

      this.voices = [];
      this.isInitialized = false;
      console.log('[VoiceIntegration] Cleanup completed');

    } catch (error) {
      console.error('[VoiceIntegration] Cleanup failed:', error);
    }
  }

  // Utility methods
  async testMicrophone(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('[VoiceIntegration] Microphone test failed:', error);
      return false;
    }
  }

  async testSpeaker(): Promise<boolean> {
    if (!this.synthesis) return false;

    try {
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance('Test');
        utterance.volume = 0.1; // Very quiet test
        
        utterance.onend = () => resolve(true);
        utterance.onerror = () => resolve(false);
        
        setTimeout(() => resolve(false), 3000); // 3 second timeout
        
        this.synthesis!.speak(utterance);
      });
    } catch (error) {
      console.error('[VoiceIntegration] Speaker test failed:', error);
      return false;
    }
  }

  getAudioPermissionStatus(): PermissionState {
    if ('permissions' in navigator) {
      return 'prompt'; // Simplified - in real implementation, check actual permission
    }
    return 'prompt';
  }

  async requestAudioPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('[VoiceIntegration] Audio permission denied:', error);
      return false;
    }
  }
}