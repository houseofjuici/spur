import * as tf from '@tensorflow/tfjs';
import * as speechCommands from '@tensorflow-models/speech-commands';
import { VoiceConfig, VoiceRecognitionResult, VoiceSynthesisOptions } from './index';

export interface PrivacyVoiceConfig extends VoiceConfig {
  enableLocalProcessing: boolean;
  enableNoiseCancellation: boolean;
  enableVoiceBiometrics: boolean;
  enableEmotionDetection: boolean;
  maxAudioBuffer: number; // seconds
  encryptionEnabled: boolean;
  voiceProfileId?: string;
  privacyMode: 'strict' | 'balanced' | 'convenient';
}

export interface PrivacyVoiceRecognitionResult extends VoiceRecognitionResult {
  processedLocally: boolean;
  encryptionStatus: 'encrypted' | 'decrypted' | 'not_applicable';
  emotionDetected?: {
    emotion: string;
    confidence: number;
  };
  voiceBiometrics?: {
    matchConfidence: number;
    voiceId?: string;
  };
  noiseLevel: number;
  privacyMetrics: {
    dataRetentionTime: number;
    processingLocation: 'local' | 'remote';
    encryptionUsed: boolean;
  };
}

export interface SecureAudioBuffer {
  data: Float32Array;
  sampleRate: number;
  timestamp: number;
  encrypted: boolean;
  checksum: string;
}

export class PrivacyVoiceIntegration {
  private config: PrivacyVoiceConfig;
  private isInitialized = false;
  private isRunning = false;

  // TensorFlow.js speech recognition
  private speechRecognizer: speechCommands.SpeechCommandRecognizer | null = null;
  private emotionModel: tf.LayersModel | null = null;
  private voiceBiometricModel: tf.LayersModel | null = null;

  // Privacy-focused audio processing
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private noiseCancellationNode: AudioWorkletNode | null = null;
  
  // Encryption and security
  private encryptionKey: CryptoKey | null = null;
  private voiceProfiles: Map<string, Float32Array> = new Map();
  private audioBuffers: SecureAudioBuffer[] = [];
  
  // State management
  private isListening = false;
  private isProcessing = false;
  private currentSessionId: string | null = null;
  private voiceBiometricSession: string | null = null;
  
  // Event handlers
  private speechRecognizedHandlers: Set<(result: PrivacyVoiceRecognitionResult, sessionId: string) => void> = new Set();
  private errorHandler?: (error: Error) => void;
  
  // Privacy metrics
  private privacyMetrics = {
    totalAudioProcessed: 0,
    locallyProcessed: 0,
    remotelyProcessed: 0,
    encryptionOperations: 0,
    voiceBiometricMatches: 0,
    averageNoiseLevel: 0,
    dataRetentionViolations: 0,
    privacyModeSwitches: 0
  };

  // Performance metrics
  private performanceMetrics = {
    totalRecognitions: 0,
    successfulRecognitions: 0,
    averageConfidence: 0,
    averageProcessingTime: 0,
    averageLatency: 0,
    errors: 0
  };

  constructor(config: PrivacyVoiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const startTime = performance.now();

    try {
      console.log('[PrivacyVoiceIntegration] Initializing with privacy focus...');

      // Initialize basic voice components
      await this.initializeBasicVoice();

      // Initialize TensorFlow.js models if local processing is enabled
      if (this.config.enableLocalProcessing) {
        await this.initializeTensorFlowModels();
      }

      // Initialize privacy features
      await this.initializePrivacyFeatures();

      // Initialize audio processing chain
      await this.initializeAudioProcessing();

      this.isInitialized = true;
      
      const initializationTime = performance.now() - startTime;
      console.log(`[PrivacyVoiceIntegration] Initialized successfully in ${initializationTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Initialization failed:', error);
      throw error;
    }
  }

  private async initializeBasicVoice(): Promise<void> {
    // Check for Web Speech API support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    console.log('[PrivacyVoiceIntegration] Basic voice components initialized');
  }

  private async initializeTensorFlowModels(): Promise<void> {
    try {
      console.log('[PrivacyVoiceIntegration] Initializing TensorFlow.js models...');

      // Check if TensorFlow.js is available
      if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js not available');
      }

      // Initialize speech commands model
      this.speechRecognizer = speechCommands.create('BROWSER_FFT');
      await this.speechRecognizer.ensureModelLoaded();

      // Set up WebGL backend for better performance
      await tf.setBackend('webgl');
      await tf.ready();

      // Load emotion detection model if enabled
      if (this.config.enableEmotionDetection) {
        await this.loadEmotionDetectionModel();
      }

      // Load voice biometric model if enabled
      if (this.config.enableVoiceBiometrics) {
        await this.loadVoiceBiometricModel();
      }

      console.log('[PrivacyVoiceIntegration] TensorFlow.js models initialized successfully');

    } catch (error) {
      console.warn('[PrivacyVoiceIntegration] TensorFlow.js initialization failed:', error);
      this.config.enableLocalProcessing = false;
    }
  }

  private async loadEmotionDetectionModel(): Promise<void> {
    try {
      // This would load a pre-trained emotion detection model
      // For now, we'll create a placeholder model structure
      
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [40], units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 7, activation: 'softmax' }) // 7 emotions
        ]
      });

      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.emotionModel = model;
      console.log('[PrivacyVoiceIntegration] Emotion detection model loaded');

    } catch (error) {
      console.warn('[PrivacyVoiceIntegration] Emotion detection model loading failed:', error);
      this.emotionModel = null;
    }
  }

  private async loadVoiceBiometricModel(): Promise<void> {
    try {
      // This would load a pre-trained voice biometric model
      // For now, we'll create a placeholder model structure
      
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [80], units: 256, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' })
        ]
      });

      model.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      this.voiceBiometricModel = model;
      console.log('[PrivacyVoiceIntegration] Voice biometric model loaded');

    } catch (error) {
      console.warn('[PrivacyVoiceIntegration] Voice biometric model loading failed:', error);
      this.voiceBiometricModel = null;
    }
  }

  private async initializePrivacyFeatures(): Promise<void> {
    try {
      // Initialize encryption key if encryption is enabled
      if (this.config.encryptionEnabled) {
        await this.initializeEncryption();
      }

      // Initialize voice profile if provided
      if (this.config.voiceProfileId) {
        await this.loadVoiceProfile(this.config.voiceProfileId);
      }

      console.log('[PrivacyVoiceIntegration] Privacy features initialized');

    } catch (error) {
      console.warn('[PrivacyVoiceIntegration] Privacy features initialization failed:', error);
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      // Generate or load encryption key
      const key = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );

      this.encryptionKey = key;
      console.log('[PrivacyVoiceIntegration] Encryption initialized');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Encryption initialization failed:', error);
      this.config.encryptionEnabled = false;
    }
  }

  private async initializeAudioProcessing(): Promise<void> {
    try {
      // Initialize AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create audio worklet for secure audio processing
      if (this.config.enableLocalProcessing) {
        await this.createAudioWorklet();
      }

      console.log('[PrivacyVoiceIntegration] Audio processing initialized');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Audio processing initialization failed:', error);
    }
  }

  private async createAudioWorklet(): Promise<void> {
    try {
      // Create the audio worklet code
      const workletCode = `
        class SecureAudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 4096;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            const output = outputs[0];
            
            if (input && input[0]) {
              const inputChannel = input[0];
              
              // Secure audio processing with noise reduction
              for (let i = 0; i < inputChannel.length; i++) {
                const sample = inputChannel[i];
                
                // Apply basic noise reduction
                const processedSample = this.applyNoiseReduction(sample);
                
                // Store in buffer for analysis
                if (this.bufferIndex < this.bufferSize) {
                  this.buffer[this.bufferIndex++] = processedSample;
                }
                
                // Output the processed sample
                if (output && output[0]) {
                  output[0][i] = processedSample;
                }
              }
            }
            
            return true;
          }
          
          applyNoiseReduction(sample) {
            // Simple noise reduction - in production, use more sophisticated algorithms
            const threshold = 0.01;
            const reductionFactor = 0.8;
            
            if (Math.abs(sample) < threshold) {
              return sample * reductionFactor;
            }
            
            return sample;
          }
        }

        registerProcessor('secure-audio-processor', SecureAudioProcessor);
      `;

      // Create blob URL for worklet
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      // Load worklet
      await this.audioContext!.audioWorklet.addModule(workletUrl);

      // Create worklet node
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext!, 'secure-audio-processor');

      console.log('[PrivacyVoiceIntegration] Audio worklet created successfully');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Audio worklet creation failed:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[PrivacyVoiceIntegration] Starting...');
      this.isRunning = true;
      console.log('[PrivacyVoiceIntegration] Started successfully');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[PrivacyVoiceIntegration] Stopping...');

      // Stop any ongoing recognition
      if (this.isListening) {
        await this.stopListening();
      }

      // Clean up audio resources
      await this.cleanupAudioResources();

      this.isRunning = false;
      console.log('[PrivacyVoiceIntegration] Stopped successfully');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Stop failed:', error);
    }
  }

  async startListening(sessionId: string): Promise<void> {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('Privacy voice integration not initialized or running');
    }

    if (this.isListening) {
      console.warn('[PrivacyVoiceIntegration] Already listening');
      return;
    }

    try {
      console.log('[PrivacyVoiceIntegration] Starting secure listening...');
      this.isListening = true;
      this.currentSessionId = sessionId;

      // Start audio processing
      if (this.config.enableLocalProcessing && this.speechRecognizer) {
        await this.startLocalRecognition();
      } else {
        await this.startWebSpeechRecognition();
      }

    } catch (error) {
      this.isListening = false;
      this.currentSessionId = null;
      console.error('[PrivacyVoiceIntegration] Error starting recognition:', error);
      this.handleError(error as Error);
    }
  }

  private async startLocalRecognition(): Promise<void> {
    if (!this.speechRecognizer) return;

    try {
      // Start TensorFlow.js speech recognition
      this.speechRecognizer.listen(result => {
        this.handleLocalRecognitionResult(result);
      }, {
        probabilityThreshold: 0.7,
        includeSpectrogram: true,
        invokeCallbackOnNoiseAndUnknown: true
      });

      console.log('[PrivacyVoiceIntegration] Local TensorFlow.js recognition started');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Local recognition start failed:', error);
      await this.startWebSpeechRecognition();
    }
  }

  private async startWebSpeechRecognition(): Promise<void> {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = this.config.continuous;
      recognition.interimResults = true;
      recognition.lang = this.config.language;
      recognition.maxAlternatives = 3;

      recognition.onresult = (event) => {
        this.handleWebSpeechResult(event);
      };

      recognition.onerror = (event) => {
        this.handleRecognitionError(event);
      };

      recognition.onend = () => {
        this.handleRecognitionEnd();
      };

      recognition.start();
      console.log('[PrivacyVoiceIntegration] Web Speech recognition started');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Web Speech recognition start failed:', error);
      throw error;
    }
  }

  private async handleLocalRecognitionResult(result: any): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      const startTime = performance.now();

      // Process TensorFlow.js recognition result
      const scores = result.scores;
      const spectrogram = result.spectrogram;

      // Extract speech if detected
      if (scores && scores.length > 0) {
        const topScore = Math.max(...scores);
        const recognizedWordIndex = scores.indexOf(topScore);

        if (topScore > 0.7 && recognizedWordIndex >= 0) {
          // Convert index to word (this would need proper word mapping)
          const words = ['yes', 'no', 'up', 'down', 'left', 'right', 'stop', 'go'];
          const transcript = words[recognizedWordIndex] || 'unknown';

          // Process audio for privacy features
          const processedAudio = await this.processAudioForPrivacy(spectrogram);

          // Create privacy-aware result
          const privacyResult: PrivacyVoiceRecognitionResult = {
            transcript,
            confidence: topScore,
            isFinal: true,
            processedLocally: true,
            encryptionStatus: processedAudio.encrypted ? 'encrypted' : 'not_applicable',
            noiseLevel: processedAudio.noiseLevel,
            privacyMetrics: {
              dataRetentionTime: this.config.privacyMode === 'strict' ? 0 : 300, // 5 minutes
              processingLocation: 'local',
              encryptionUsed: processedAudio.encrypted
            }
          };

          // Add emotion detection if enabled
          if (this.config.enableEmotionDetection && this.emotionModel) {
            const emotion = await this.detectEmotion(spectrogram);
            if (emotion) {
              privacyResult.emotionDetected = emotion;
            }
          }

          // Add voice biometrics if enabled
          if (this.config.enableVoiceBiometrics && this.voiceBiometricModel) {
            const biometrics = await this.performVoiceBiometrics(spectrogram);
            if (biometrics) {
              privacyResult.voiceBiometrics = biometrics;
            }
          }

          this.handleSpeechRecognized(privacyResult);
        }
      }

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Local recognition processing failed:', error);
    }
  }

  private handleWebSpeechResult(event: SpeechRecognitionEvent): void {
    if (!this.currentSessionId) return;

    const startTime = performance.now();

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
      const privacyResult: PrivacyVoiceRecognitionResult = {
        transcript: finalTranscript.trim(),
        confidence: event.results[0]?.[0]?.confidence || 0,
        isFinal: true,
        processedLocally: false,
        encryptionStatus: 'not_applicable',
        noiseLevel: 0, // Would need to calculate from audio
        privacyMetrics: {
          dataRetentionTime: this.config.privacyMode === 'strict' ? 0 : 300,
          processingLocation: 'remote',
          encryptionUsed: false
        }
      };

      this.handleSpeechRecognized(privacyResult);
    }

    // Auto-stop if not continuous
    if (this.config.autoStop && finalTranscript.trim() && !this.config.continuous) {
      setTimeout(() => this.stopListening(), 1000);
    }
  }

  private async processAudioForPrivacy(audioData: any): Promise<{
    encrypted: boolean;
    noiseLevel: number;
  }> {
    let encrypted = false;
    let noiseLevel = 0;

    try {
      // Apply noise cancellation if enabled
      if (this.config.enableNoiseCancellation) {
        noiseLevel = await this.calculateNoiseLevel(audioData);
      }

      // Encrypt audio if enabled
      if (this.config.encryptionEnabled && this.encryptionKey) {
        // Convert audio data to encryptable format
        const audioBuffer = this.audioDataToBuffer(audioData);
        const encryptedBuffer = await this.encryptAudio(audioBuffer);
        
        // Store encrypted buffer
        this.storeSecureAudioBuffer({
          data: encryptedBuffer,
          sampleRate: this.audioContext?.sampleRate || 44100,
          timestamp: Date.now(),
          encrypted: true,
          checksum: await this.generateChecksum(encryptedBuffer)
        });

        encrypted = true;
        this.privacyMetrics.encryptionOperations++;
      }

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Privacy processing failed:', error);
    }

    return { encrypted, noiseLevel };
  }

  private async calculateNoiseLevel(audioData: any): Promise<number> {
    try {
      // Calculate RMS (Root Mean Square) of audio signal
      let sumSquares = 0;
      let count = 0;

      if (audioData instanceof Float32Array) {
        for (let i = 0; i < audioData.length; i++) {
          sumSquares += audioData[i] * audioData[i];
          count++;
        }
      } else if (Array.isArray(audioData)) {
        for (const sample of audioData) {
          if (typeof sample === 'number') {
            sumSquares += sample * sample;
            count++;
          }
        }
      }

      if (count === 0) return 0;

      const rms = Math.sqrt(sumSquares / count);
      const noiseLevelDb = 20 * Math.log10(rms);

      return Math.max(0, Math.min(100, noiseLevelDb + 60)); // Normalize to 0-100

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Noise level calculation failed:', error);
      return 0;
    }
  }

  private async detectEmotion(audioData: any): Promise<{ emotion: string; confidence: number } | null> {
    if (!this.emotionModel) return null;

    try {
      // Preprocess audio data for emotion detection
      const features = this.extractAudioFeatures(audioData);
      
      if (!features) return null;

      // Predict emotion
      const prediction = this.emotionModel.predict(tf.tensor2d([features])) as tf.Tensor;
      const probabilities = Array.from(await prediction.data());
      
      prediction.dispose();

      const emotions = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      const confidence = probabilities[maxIndex];

      if (confidence > 0.6) {
        return {
          emotion: emotions[maxIndex],
          confidence
        };
      }

      return null;

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Emotion detection failed:', error);
      return null;
    }
  }

  private async performVoiceBiometrics(audioData: any): Promise<{
    matchConfidence: number;
    voiceId?: string;
  } | null> {
    if (!this.voiceBiometricModel || this.voiceProfiles.size === 0) return null;

    try {
      // Extract voice features
      const features = this.extractVoiceFeatures(audioData);
      
      if (!features) return null;

      let bestMatch: { voiceId: string; confidence: number } | null = null;

      // Compare with stored voice profiles
      for (const [voiceId, profile] of this.voiceProfiles.entries()) {
        const similarity = this.calculateVoiceSimilarity(features, profile);
        
        if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.confidence)) {
          bestMatch = { voiceId, confidence: similarity };
        }
      }

      if (bestMatch) {
        this.privacyMetrics.voiceBiometricMatches++;
        return {
          matchConfidence: bestMatch.confidence,
          voiceId: bestMatch.voiceId
        };
      }

      return null;

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Voice biometrics failed:', error);
      return null;
    }
  }

  private extractAudioFeatures(audioData: any): number[] | null {
    try {
      // Extract MFCC (Mel-frequency cepstral coefficients) or other features
      // This is a simplified version - in production, use proper audio feature extraction
      
      if (!audioData) return null;

      // Convert to frequency domain (simplified)
      const features: number[] = [];
      const sampleSize = Math.min(40, Array.isArray(audioData) ? audioData.length : 40);

      for (let i = 0; i < sampleSize; i++) {
        const value = Array.isArray(audioData) ? audioData[i] : audioData;
        features.push(typeof value === 'number' ? value : 0);
      }

      // Pad or truncate to 40 features
      while (features.length < 40) {
        features.push(0);
      }

      return features.slice(0, 40);

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Audio feature extraction failed:', error);
      return null;
    }
  }

  private extractVoiceFeatures(audioData: any): number[] | null {
    try {
      // Extract voice-specific features for biometrics
      // This would include spectral features, formants, pitch, etc.
      
      const basicFeatures = this.extractAudioFeatures(audioData);
      if (!basicFeatures) return null;

      // Add voice-specific features
      const voiceFeatures = [...basicFeatures];
      
      // Add pitch-related features (simplified)
      if (Array.isArray(audioData)) {
        const pitch = this.calculatePitch(audioData);
        voiceFeatures.push(pitch);
      }

      // Add spectral features (simplified)
      const spectralCentroid = this.calculateSpectralCentroid(audioData);
      voiceFeatures.push(spectralCentroid);

      // Pad to 80 features
      while (voiceFeatures.length < 80) {
        voiceFeatures.push(0);
      }

      return voiceFeatures.slice(0, 80);

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Voice feature extraction failed:', error);
      return null;
    }
  }

  private calculatePitch(audioData: number[]): number {
    // Simplified pitch calculation using zero-crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if (audioData[i] * audioData[i-1] < 0) {
        zeroCrossings++;
      }
    }
    return zeroCrossings / audioData.length;
  }

  private calculateSpectralCentroid(audioData: number[]): number {
    // Simplified spectral centroid calculation
    let sum = 0;
    let weightedSum = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const magnitude = Math.abs(audioData[i]);
      sum += magnitude;
      weightedSum += magnitude * i;
    }
    
    return sum > 0 ? weightedSum / sum : 0;
  }

  private calculateVoiceSimilarity(features1: number[], features2: number[]): number {
    // Calculate cosine similarity between voice feature vectors
    if (features1.length !== features2.length) return 0;

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < features1.length; i++) {
      dotProduct += features1[i] * features2[i];
      magnitude1 += features1[i] * features1[i];
      magnitude2 += features2[i] * features2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  private audioDataToBuffer(audioData: any): ArrayBuffer {
    // Convert audio data to ArrayBuffer for encryption
    if (audioData instanceof Float32Array) {
      return audioData.buffer;
    }
    
    if (Array.isArray(audioData)) {
      const floatArray = new Float32Array(audioData);
      return floatArray.buffer;
    }

    return new ArrayBuffer(0);
  }

  private async encryptAudio(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.encryptionKey) return buffer;

    try {
      // Generate IV (Initialization Vector)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the audio data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.encryptionKey,
        buffer
      );

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encryptedBuffer), iv.length);

      return result.buffer;

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Audio encryption failed:', error);
      return buffer;
    }
  }

  private async generateChecksum(buffer: ArrayBuffer): Promise<string> {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Checksum generation failed:', error);
      return '';
    }
  }

  private storeSecureAudioBuffer(buffer: SecureAudioBuffer): void {
    this.audioBuffers.push(buffer);
    
    // Enforce maximum buffer size
    const maxBuffers = Math.ceil(this.config.maxAudioBuffer * 10); // 10 buffers per second
    if (this.audioBuffers.length > maxBuffers) {
      this.audioBuffers.shift();
    }

    // Enforce privacy mode retention
    if (this.config.privacyMode === 'strict') {
      // In strict mode, clear buffers immediately after processing
      setTimeout(() => {
        const index = this.audioBuffers.indexOf(buffer);
        if (index > -1) {
          this.audioBuffers.splice(index, 1);
        }
      }, 1000);
    }
  }

  private async loadVoiceProfile(voiceProfileId: string): Promise<void> {
    try {
      // This would load a voice profile from secure storage
      // For now, we'll create a placeholder
      
      console.log(`[PrivacyVoiceIntegration] Loading voice profile: ${voiceProfileId}`);
      
      // In a real implementation, this would load from encrypted storage
      // this.voiceProfiles.set(voiceProfileId, profileData);

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Voice profile loading failed:', error);
    }
  }

  private handleSpeechRecognized(result: PrivacyVoiceRecognitionResult): void {
    if (!this.currentSessionId) return;

    const processingTime = performance.now() - (result as any).startTime;

    // Update performance metrics
    this.performanceMetrics.totalRecognitions++;
    this.performanceMetrics.successfulRecognitions++;
    this.performanceMetrics.averageConfidence = this.updateAverage(
      this.performanceMetrics.averageConfidence,
      result.confidence,
      this.performanceMetrics.totalRecognitions
    );
    this.performanceMetrics.averageProcessingTime = this.updateAverage(
      this.performanceMetrics.averageProcessingTime,
      processingTime,
      this.performanceMetrics.totalRecognitions
    );

    // Update privacy metrics
    this.privacyMetrics.totalAudioProcessed++;
    if (result.processedLocally) {
      this.privacyMetrics.locallyProcessed++;
    } else {
      this.privacyMetrics.remotelyProcessed++;
    }

    // Notify handlers
    this.speechRecognizedHandlers.forEach(handler => {
      try {
        handler(result, this.currentSessionId!);
      } catch (error) {
        console.error('[PrivacyVoiceIntegration] Error in speech recognized handler:', error);
      }
    });
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    try {
      console.log('[PrivacyVoiceIntegration] Stopping secure listening...');
      this.isListening = false;

      // Stop TensorFlow.js recognition if active
      if (this.speechRecognizer && this.config.enableLocalProcessing) {
        this.speechRecognizer.stopListening();
      }

      // Clear sensitive data based on privacy mode
      if (this.config.privacyMode === 'strict') {
        await this.clearSensitiveData();
      }

      this.currentSessionId = null;
      console.log('[PrivacyVoiceIntegration] Listening stopped');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Error stopping recognition:', error);
      this.handleError(error as Error);
    } finally {
      this.currentSessionId = null;
    }
  }

  private async clearSensitiveData(): Promise<void> {
    try {
      // Clear audio buffers
      this.audioBuffers = [];

      // Clear TensorFlow.js tensors
      if (tf.memory) {
        tf.disposeVariables();
      }

      // Clear voice profiles if not explicitly stored
      if (!this.config.voiceProfileId) {
        this.voiceProfiles.clear();
      }

      console.log('[PrivacyVoiceIntegration] Sensitive data cleared');

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Sensitive data clearing failed:', error);
    }
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEvent): void {
    console.error('[PrivacyVoiceIntegration] Recognition error:', event.error);
    this.performanceMetrics.errors++;

    const error = new Error(`Speech recognition error: ${event.error}`);
    this.handleError(error);

    // Stop listening on error
    if (this.isListening) {
      this.stopListening().catch(console.error);
    }
  }

  private handleRecognitionEnd(): void {
    console.log('[PrivacyVoiceIntegration] Recognition ended');
    
    // If we're still supposed to be listening and continuous mode is on, restart
    if (this.isListening && this.config.continuous && this.config.enableLocalProcessing) {
      try {
        this.startLocalRecognition();
      } catch (error) {
        console.error('[PrivacyVoiceIntegration] Error restarting recognition:', error);
        this.isListening = false;
        this.currentSessionId = null;
      }
    } else if (!this.config.continuous) {
      this.isListening = false;
      this.currentSessionId = null;
    }
  }

  private async cleanupAudioResources(): Promise<void> {
    try {
      // Close audio context
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // Dispose audio worklet nodes
      if (this.audioWorkletNode) {
        this.audioWorkletNode.disconnect();
        this.audioWorkletNode = null;
      }

      // Clear audio buffers
      this.audioBuffers = [];

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Audio resource cleanup failed:', error);
    }
  }

  async speak(text: string, options: Partial<VoiceSynthesisOptions> = {}): Promise<void> {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('Privacy voice integration not initialized or running');
    }

    try {
      console.log('[PrivacyVoiceIntegration] Speaking with privacy protection:', text);

      // Use Web Speech API with privacy considerations
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure utterance
        utterance.lang = options.language || this.config.language;
        utterance.pitch = options.pitch ?? this.config.pitch;
        utterance.rate = options.rate ?? this.config.rate;
        utterance.volume = options.volume ?? this.config.volume;

        // Privacy: Use local voices only
        const voices = speechSynthesis.getVoices();
        const localVoice = voices.find(voice => 
          voice.localService && 
          voice.lang.startsWith(this.config.language.split('-')[0])
        );
        
        if (localVoice) {
          utterance.voice = localVoice;
        }

        // Set up event handlers
        utterance.onstart = () => options.onStart?.();
        utterance.onend = () => options.onEnd?.();
        utterance.onerror = (event) => {
          const error = new Error(`Speech synthesis error: ${event.error}`);
          options.onError?.(error);
          this.handleError(error);
        };

        // Speak
        speechSynthesis.speak(utterance);

      } else {
        throw new Error('Speech synthesis not available');
      }

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Privacy-aware speech failed:', error);
      this.handleError(error as Error);
    }
  }

  // Privacy-specific methods
  async createVoiceProfile(profileId: string, audioSamples: Float32Array[]): Promise<void> {
    if (!this.config.enableVoiceBiometrics) {
      throw new Error('Voice biometrics not enabled');
    }

    try {
      console.log(`[PrivacyVoiceIntegration] Creating voice profile: ${profileId}`);

      // Extract features from multiple samples
      const allFeatures: number[][] = [];
      
      for (const sample of audioSamples) {
        const features = this.extractVoiceFeatures(sample);
        if (features) {
          allFeatures.push(features);
        }
      }

      if (allFeatures.length === 0) {
        throw new Error('No valid audio samples provided');
      }

      // Average the features to create a profile
      const profileFeatures = new Float32Array(80);
      
      for (let i = 0; i < 80; i++) {
        let sum = 0;
        for (const features of allFeatures) {
          sum += features[i];
        }
        profileFeatures[i] = sum / allFeatures.length;
      }

      // Store the profile
      this.voiceProfiles.set(profileId, profileFeatures);

      console.log(`[PrivacyVoiceIntegration] Voice profile created successfully`);

    } catch (error) {
      console.error('[PrivacyVoiceIntegration] Voice profile creation failed:', error);
      throw error;
    }
  }

  async deleteVoiceProfile(profileId: string): Promise<void> {
    this.voiceProfiles.delete(profileId);
    console.log(`[PrivacyVoiceIntegration] Voice profile deleted: ${profileId}`);
  }

  async switchPrivacyMode(mode: 'strict' | 'balanced' | 'convenient'): Promise<void> {
    this.config.privacyMode = mode;
    this.privacyMetrics.privacyModeSwitches++;

    console.log(`[PrivacyVoiceIntegration] Privacy mode switched to: ${mode}`);

    // Clear sensitive data if switching to strict mode
    if (mode === 'strict') {
      await this.clearSensitiveData();
    }
  }

  // Public API methods
  onSpeechRecognized(callback: (result: PrivacyVoiceRecognitionResult, sessionId: string) => void): () => void {
    this.speechRecognizedHandlers.add(callback);
    return () => this.speechRecognizedHandlers.delete(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorHandler = callback;
  }

  isHealthy(): boolean {
    return this.isRunning && this.performanceMetrics.errors / Math.max(this.performanceMetrics.totalRecognitions, 1) < 0.1;
  }

  getMetrics() {
    return {
      performance: { ...this.performanceMetrics },
      privacy: { ...this.privacyMetrics },
      security: {
        encryptionEnabled: this.config.encryptionEnabled,
        voiceBiometricsEnabled: this.config.enableVoiceBiometrics,
        localProcessingEnabled: this.config.enableLocalProcessing,
        currentPrivacyMode: this.config.privacyMode,
        activeVoiceProfiles: this.voiceProfiles.size,
        audioBufferCount: this.audioBuffers.length
      }
    };
  }

  async updateConfig(newConfig: Partial<PrivacyVoiceConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    // Clear all data
    await this.clearSensitiveData();
    
    // Dispose TensorFlow.js models
    if (this.speechRecognizer) {
      this.speechRecognizer.dispose();
      this.speechRecognizer = null;
    }

    if (this.emotionModel) {
      this.emotionModel.dispose();
      this.emotionModel = null;
    }

    if (this.voiceBiometricModel) {
      this.voiceBiometricModel.dispose();
      this.voiceBiometricModel = null;
    }

    // Clear handlers
    this.speechRecognizedHandlers.clear();

    this.isInitialized = false;
    console.log('[PrivacyVoiceIntegration] Privacy-focused cleanup completed');
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  private handleError(error: Error): void {
    this.performanceMetrics.errors++;
    
    if (this.errorHandler) {
      try {
        this.errorHandler(error);
      } catch (handlerError) {
        console.error('[PrivacyVoiceIntegration] Error in error handler:', handlerError);
      }
    }
  }
}