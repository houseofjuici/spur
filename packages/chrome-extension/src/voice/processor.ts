interface VoiceProcessorResult {
  transcript: string;
  confidence: number;
  duration: number;
  language?: string;
}

interface VoiceProcessorOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

class VoiceProcessor {
  private recognition: SpeechRecognition | null = null;
  private isInitialized = false;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  async initialize(): Promise<void> {
    try {
      // Check if Web Speech API is available
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        throw new Error('Web Speech API not supported');
      }

      // Initialize SpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // Configure recognition
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      // Initialize AudioContext for audio processing
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      this.isInitialized = true;
      console.log('Voice processor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize voice processor:', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return this.isInitialized && !!this.recognition;
    } catch (error) {
      return false;
    }
  }

  async startRecording(options: VoiceProcessorOptions = {}): Promise<void> {
    if (!this.isInitialized || !this.recognition) {
      throw new Error('Voice processor not initialized');
    }

    try {
      // Configure recognition options
      this.recognition.continuous = options.continuous || false;
      this.recognition.interimResults = options.interimResults || false;
      this.recognition.lang = options.language || 'en-US';
      this.recognition.maxAlternatives = options.maxAlternatives || 1;

      // Start recognition
      this.recognition.start();
      console.log('Voice recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Voice processor not initialized');
    }

    try {
      this.recognition.stop();
      console.log('Voice recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  async processAudio(audioBlob: Blob, language: string = 'en-US'): Promise<VoiceProcessorResult> {
    try {
      // Try Web Speech API first
      if (this.recognition) {
        return await this.processWithWebSpeechAPI(audioBlob, language);
      }

      // Fallback to offline processing or API
      return await this.processWithFallback(audioBlob, language);
    } catch (error) {
      console.error('Voice processing failed:', error);
      throw error;
    }
  }

  private async processWithWebSpeechAPI(audioBlob: Blob, language: string): Promise<VoiceProcessorResult> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not available'));
        return;
      }

      const startTime = Date.now();
      let transcript = '';
      let confidence = 0;

      const handleResult = (event: SpeechRecognitionEvent) => {
        const result = event.results[0];
        if (result && result[0]) {
          transcript = result[0].transcript;
          confidence = result[0].confidence;
        }
      };

      const handleEnd = () => {
        const duration = (Date.now() - startTime) / 1000;
        
        // Clean up event listeners
        if (this.recognition) {
          this.recognition.removeEventListener('result', handleResult);
          this.recognition.removeEventListener('end', handleEnd);
          this.recognition.removeEventListener('error', handleError);
        }

        resolve({
          transcript: transcript || 'No speech detected',
          confidence: confidence || 0.5,
          duration,
          language
        });
      };

      const handleError = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        
        // Clean up event listeners
        if (this.recognition) {
          this.recognition.removeEventListener('result', handleResult);
          this.recognition.removeEventListener('end', handleEnd);
          this.recognition.removeEventListener('error', handleError);
        }

        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      // Set up event listeners
      this.recognition.addEventListener('result', handleResult);
      this.recognition.addEventListener('end', handleEnd);
      this.recognition.addEventListener('error', handleError);

      // Configure and start recognition
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = language;

      // For existing audio blob, we need to play it and capture
      this.playAudioAndCapture(audioBlob);
    });
  }

  private async playAudioAndCapture(audioBlob: Blob): Promise<void> {
    try {
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }

      // Create audio element
      const audio = new Audio();
      audio.src = URL.createObjectURL(audioBlob);

      // Create media stream source
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(stream);

      // Connect to destination (for playback)
      source.connect(this.audioContext.destination);

      // Play audio
      await audio.play();

      // Start speech recognition
      if (this.recognition) {
        this.recognition.start();
      }

      // Clean up after playback
      audio.onended = () => {
        if (this.recognition) {
          this.recognition.stop();
        }
        stream.getTracks().forEach(track => track.stop());
        URL.revokeObjectURL(audio.src);
      };
    } catch (error) {
      console.error('Failed to play audio for capture:', error);
      throw error;
    }
  }

  private async processWithFallback(audioBlob: Blob, language: string): Promise<VoiceProcessorResult> {
    try {
      // Fallback implementation using audio analysis
      // This is a simplified version - in production, you'd use:
      // - Local speech recognition models (TensorFlow.js)
      // - Cloud speech APIs (Google Cloud Speech-to-Text, AWS Transcribe)
      // - WebAssembly-based speech recognition

      const duration = await this.getAudioDuration(audioBlob);
      
      // For now, return a placeholder with basic audio analysis
      return {
        transcript: 'Audio processed (offline transcription would be implemented here)',
        confidence: 0.7,
        duration,
        language
      };
    } catch (error) {
      console.error('Fallback voice processing failed:', error);
      throw error;
    }
  }

  private async getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.onerror = () => {
        reject(new Error('Failed to get audio duration'));
      };
      audio.src = URL.createObjectURL(audioBlob);
    });
  }

  async startAudioCapture(): Promise<MediaRecorder> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      console.log('Audio capture started');
      
      return this.mediaRecorder;
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  async stopAudioCapture(): Promise<Blob> {
    try {
      if (!this.mediaRecorder) {
        throw new Error('No active audio capture');
      }

      return new Promise((resolve, reject) => {
        this.mediaRecorder!.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.audioChunks = [];
          
          // Stop all tracks
          if (this.mediaRecorder!.stream) {
            this.mediaRecorder!.stream.getTracks().forEach(track => track.stop());
          }
          
          this.mediaRecorder = null;
          resolve(audioBlob);
        };

        this.mediaRecorder.stop();
      });
    } catch (error) {
      console.error('Failed to stop audio capture:', error);
      throw error;
    }
  }

  async transcribeFromMicrophone(options: VoiceProcessorOptions = {}): Promise<VoiceProcessorResult> {
    try {
      const mediaRecorder = await this.startAudioCapture();
      
      // Record for a reasonable duration (e.g., 5 seconds) or until stopped
      const maxDuration = options.continuous ? 0 : 5000; // 5 seconds for non-continuous
      
      if (maxDuration > 0) {
        setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
          }
        }, maxDuration);
      }

      const audioBlob = await this.stopAudioCapture();
      return await this.processAudio(audioBlob, options.language || 'en-US');
    } catch (error) {
      console.error('Failed to transcribe from microphone:', error);
      throw error;
    }
  }

  async isMicrophoneAvailable(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      return audioInputDevices.length > 0;
    } catch (error) {
      console.error('Failed to check microphone availability:', error);
      return false;
    }
  }

  async getMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  async getSupportedLanguages(): Promise<string[]> {
    try {
      // Return common supported languages
      return [
        'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ru-RU',
        'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'ar-SA', 'hi-IN'
      ];
    } catch (error) {
      console.error('Failed to get supported languages:', error);
      return ['en-US']; // Fallback to English
    }
  }

  async setLanguage(language: string): Promise<void> {
    if (this.recognition) {
      this.recognition.lang = language;
      console.log(`Language set to: ${language}`);
    }
  }

  async getAudioLevel(): Promise<number> {
    try {
      if (!this.audioContext) {
        return 0;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Normalize to 0-1 range
      const level = average / 255;
      
      // Clean up
      stream.getTracks().forEach(track => track.stop());
      
      return level;
    } catch (error) {
      console.error('Failed to get audio level:', error);
      return 0;
    }
  }

  async destroy(): Promise<void> {
    try {
      if (this.recognition) {
        this.recognition.stop();
        this.recognition = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.audioChunks = [];
      this.isInitialized = false;
      console.log('Voice processor destroyed');
    } catch (error) {
      console.error('Failed to destroy voice processor:', error);
      throw error;
    }
  }
}

export const voiceProcessor = new VoiceProcessor();
export { VoiceProcessor, type VoiceProcessorResult, type VoiceProcessorOptions };