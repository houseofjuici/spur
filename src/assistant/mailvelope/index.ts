import { EventEmitter } from 'events';

/**
 * Mailvelope PGP Encryption Integration
 * Provides seamless PGP encryption for email communications
 */
export interface PGPKey {
  id: string;
  userId: string;
  email: string;
  keyId: string;
  fingerprint: string;
  publicKeyArmored: string;
  privateKeyArmored?: string;
  created: Date;
  expires?: Date;
  type: 'public' | 'private';
  trust: 'unknown' | 'none' | 'marginal' | 'full' | 'ultimate';
  bits: number;
  algorithm: 'rsa' | 'dsa' | 'elgamal' | 'ecdsa' | 'eddsa';
}

export interface PGPConfig {
  enabled: boolean;
  autoEncrypt: boolean;
  autoSign: boolean;
  keyServer: string;
  keySize: number;
  keyType: 'rsa' | 'ecc';
  passphrase?: string;
  cachePassphrase: boolean;
  cacheTimeout: number; // minutes
  trustPolicy: 'strict' | 'opportunistic' | 'relaxed';
  defaultKey?: string;
}

export interface EncryptionResult {
  success: boolean;
  encryptedData?: string;
  recipients: string[];
  error?: string;
  keyIds: string[];
}

export interface DecryptionResult {
  success: boolean;
  decryptedData?: string;
  signatures?: SignatureResult[];
  error?: string;
  keyId?: string;
}

export interface SignatureResult {
  success: boolean;
  keyId: string;
  userId: string;
  trustLevel: 'unknown' | 'none' | 'marginal' | 'full' | 'ultimate';
  timestamp: Date;
  error?: string;
}

export interface KeyGenerationOptions {
  userId: string;
  email: string;
  passphrase?: string;
  keySize?: number;
  keyType?: 'rsa' | 'ecc';
  expires?: Date;
}

export interface KeyImportResult {
  success: boolean;
  key?: PGPKey;
  count?: number;
  error?: string;
}

export class MailvelopeIntegration extends EventEmitter {
  private config: PGPConfig;
  private isInitialized = false;
  private isRunning = false;

  // Key storage
  private keys: Map<string, PGPKey> = new Map();
  private keyCache: Map<string, PGPKey> = new Map();
  private trustDatabase: Map<string, string> = new Map(); // keyId -> trust level

  // Passphrase cache
  private passphraseCache: Map<string, { passphrase: string; timestamp: Date }> = new Map();

  // Performance metrics
  private metrics = {
    totalEncryptions: 0,
    successfulEncryptions: 0,
    totalDecryptions: 0,
    successfulDecryptions: 0,
    totalVerifications: 0,
    successfulVerifications: 0,
    averageEncryptionTime: 0,
    averageDecryptionTime: 0,
    errors: 0
  };

  constructor(config: PGPConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[MailvelopeIntegration] Initializing...');

      // Initialize Mailvelope API
      await this.initializeMailvelopeAPI();

      // Load existing keys
      await this.loadKeys();

      // Load trust database
      await this.loadTrustDatabase();

      // Set up passphrase cache cleanup
      this.setupPassphraseCacheCleanup();

      this.isInitialized = true;
      console.log('[MailvelopeIntegration] Initialized successfully');

      this.emit('initialized');

    } catch (error) {
      console.error('[MailvelopeIntegration] Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[MailvelopeIntegration] Starting...');
      this.isRunning = true;
      console.log('[MailvelopeIntegration] Started successfully');

      this.emit('started');

    } catch (error) {
      console.error('[MailvelopeIntegration] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[MailvelopeIntegration] Stopping...');

      // Clear passphrase cache
      this.passphraseCache.clear();

      // Save keys and trust database
      await this.saveKeys();
      await this.saveTrustDatabase();

      this.isRunning = false;
      console.log('[MailvelopeIntegration] Stopped successfully');

      this.emit('stopped');

    } catch (error) {
      console.error('[MailvelopeIntegration] Stop failed:', error);
      throw error;
    }
  }

  async generateKey(options: KeyGenerationOptions): Promise<PGPKey> {
    if (!this.isInitialized) {
      throw new Error('Mailvelope integration not initialized');
    }

    try {
      console.log(`[MailvelopeIntegration] Generating key for ${options.email}`);

      // Generate key pair using Mailvelope API
      const keyPair = await this.callMailvelopeAPI('generateKey', {
        userId: options.userId,
        email: options.email,
        passphrase: options.passphrase,
        keySize: options.keySize || this.config.keySize,
        keyType: options.keyType || this.config.keyType,
        expires: options.expires
      });

      const key: PGPKey = {
        id: this.generateId('key'),
        userId: options.userId,
        email: options.email,
        keyId: keyPair.keyId,
        fingerprint: keyPair.fingerprint,
        publicKeyArmored: keyPair.publicKeyArmored,
        privateKeyArmored: keyPair.privateKeyArmored,
        created: new Date(),
        expires: options.expires,
        type: 'private',
        trust: 'ultimate',
        bits: keyPair.bits,
        algorithm: keyPair.algorithm
      };

      // Store key
      this.keys.set(key.id, key);
      this.keyCache.set(key.keyId, key);

      // Set as default key if none exists
      if (!this.config.defaultKey) {
        this.config.defaultKey = key.id;
      }

      // Save keys
      await this.saveKeys();

      console.log(`[MailvelopeIntegration] Key generated successfully: ${key.keyId}`);
      this.emit('keyGenerated', key);

      return key;

    } catch (error) {
      console.error('[MailvelopeIntegration] Error generating key:', error);
      throw error;
    }
  }

  async importKey(keyData: string, isPrivate = false): Promise<KeyImportResult> {
    if (!this.isInitialized) {
      throw new Error('Mailvelope integration not initialized');
    }

    try {
      console.log('[MailvelopeIntegration] Importing key');

      // Import key using Mailvelope API
      const importResult = await this.callMailvelopeAPI('importKey', {
        keyData,
        isPrivate
      });

      if (importResult.success) {
        const keys: PGPKey[] = [];
        
        for (const keyInfo of importResult.keys) {
          const key: PGPKey = {
            id: this.generateId('key'),
            userId: keyInfo.userId,
            email: keyInfo.email,
            keyId: keyInfo.keyId,
            fingerprint: keyInfo.fingerprint,
            publicKeyArmored: keyInfo.publicKeyArmored,
            privateKeyArmored: keyInfo.privateKeyArmored,
            created: keyInfo.created ? new Date(keyInfo.created) : new Date(),
            expires: keyInfo.expires ? new Date(keyInfo.expires) : undefined,
            type: keyInfo.isPrivate ? 'private' : 'public',
            trust: 'unknown',
            bits: keyInfo.bits,
            algorithm: keyInfo.algorithm
          };

          this.keys.set(key.id, key);
          this.keyCache.set(key.keyId, key);
          keys.push(key);
        }

        // Save keys
        await this.saveKeys();

        console.log(`[MailvelopeIntegration] Imported ${keys.length} keys successfully`);
        this.emit('keysImported', keys);

        return {
          success: true,
          count: keys.length
        };
      } else {
        return {
          success: false,
          error: importResult.error
        };
      }

    } catch (error) {
      console.error('[MailvelopeIntegration] Error importing key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async exportKey(keyId: string, includePrivate = false): Promise<string> {
    const key = await this.getKey(keyId);
    
    if (includePrivate && !key.privateKeyArmored) {
      throw new Error('Private key not available for export');
    }

    return includePrivate ? key.privateKeyArmored || key.publicKeyArmored : key.publicKeyArmored;
  }

  async encrypt(data: string, recipientEmails: string[], options: {
    sign?: boolean;
    armor?: boolean;
    compress?: boolean;
  } = {}): Promise<EncryptionResult> {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('Mailvelope integration not initialized or running');
    }

    const startTime = performance.now();
    this.metrics.totalEncryptions++;

    try {
      console.log(`[MailvelopeIntegration] Encrypting data for ${recipientEmails.length} recipients`);

      // Get public keys for recipients
      const recipientKeys: PGPKey[] = [];
      const keyIds: string[] = [];

      for (const email of recipientEmails) {
        const key = await this.findPublicKey(email);
        if (!key) {
          throw new Error(`No public key found for ${email}`);
        }
        recipientKeys.push(key);
        keyIds.push(key.keyId);
      }

      // Sign with default key if requested
      let signingKeyId: string | undefined;
      if (options.sign || this.config.autoSign) {
        const defaultKey = this.config.defaultKey ? await this.getKey(this.config.defaultKey) : null;
        if (defaultKey && defaultKey.privateKeyArmored) {
          signingKeyId = defaultKey.keyId;
        }
      }

      // Encrypt using Mailvelope API
      const result = await this.callMailvelopeAPI('encrypt', {
        data,
        publicKeys: recipientKeys.map(k => k.publicKeyArmored),
        privateKey: signingKeyId ? (await this.getKey(this.config.defaultKey!))?.privateKeyArmored : undefined,
        armor: options.armor !== false,
        compress: options.compress !== false
      });

      // Update metrics
      this.metrics.successfulEncryptions++;
      this.metrics.averageEncryptionTime = this.updateAverage(
        this.metrics.averageEncryptionTime,
        performance.now() - startTime,
        this.metrics.totalEncryptions
      );

      const encryptionResult: EncryptionResult = {
        success: true,
        encryptedData: result.encryptedData,
        recipients: recipientEmails,
        keyIds
      };

      console.log('[MailvelopeIntegration] Encryption completed successfully');
      this.emit('dataEncrypted', encryptionResult);

      return encryptionResult;

    } catch (error) {
      this.metrics.errors++;
      console.error('[MailvelopeIntegration] Error encrypting data:', error);

      const result: EncryptionResult = {
        success: false,
        recipients: recipientEmails,
        keyIds: [],
        error: error instanceof Error ? error.message : String(error)
      };

      this.emit('encryptionError', result);
      return result;
    }
  }

  async decrypt(encryptedData: string, options: {
    passphrase?: string;
    verifySignatures?: boolean;
  } = {}): Promise<DecryptionResult> {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('Mailvelope integration not initialized or running');
    }

    const startTime = performance.now();
    this.metrics.totalDecryptions++;

    try {
      console.log('[MailvelopeIntegration] Decrypting data');

      // Try all available private keys
      const privateKeys = Array.from(this.keys.values()).filter(k => k.privateKeyArmored);
      
      let decryptedResult: any;
      let usedKeyId: string | undefined;

      for (const key of privateKeys) {
        try {
          // Get passphrase
          const passphrase = await this.getPassphrase(key.keyId, options.passphrase);
          
          // Decrypt using Mailvelope API
          decryptedResult = await this.callMailvelopeAPI('decrypt', {
            encryptedData,
            privateKey: key.privateKeyArmored,
            passphrase,
            verifySignatures: options.verifySignatures !== false
          });

          usedKeyId = key.keyId;
          break;
        } catch (error) {
          // Try next key
          continue;
        }
      }

      if (!decryptedResult) {
        throw new Error('No private key could decrypt the data');
      }

      // Process signatures if present
      let signatures: SignatureResult[] | undefined;
      if (decryptedResult.signatures && options.verifySignatures !== false) {
        signatures = [];
        for (const sig of decryptedResult.signatures) {
          const signatureResult: SignatureResult = {
            success: sig.valid,
            keyId: sig.keyId,
            userId: sig.userId,
            trustLevel: await this.getTrustLevel(sig.keyId),
            timestamp: new Date(sig.timestamp),
            error: sig.error
          };
          signatures.push(signatureResult);
        }
      }

      // Update metrics
      this.metrics.successfulDecryptions++;
      this.metrics.averageDecryptionTime = this.updateAverage(
        this.metrics.averageDecryptionTime,
        performance.now() - startTime,
        this.metrics.totalDecryptions
      );

      const result: DecryptionResult = {
        success: true,
        decryptedData: decryptedResult.decryptedData,
        signatures,
        keyId: usedKeyId
      };

      console.log('[MailvelopeIntegration] Decryption completed successfully');
      this.emit('dataDecrypted', result);

      return result;

    } catch (error) {
      this.metrics.errors++;
      console.error('[MailvelopeIntegration] Error decrypting data:', error);

      const result: DecryptionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      this.emit('decryptionError', result);
      return result;
    }
  }

  async verifySignature(data: string, signature: string, signerKeyId: string): Promise<SignatureResult> {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('Mailvelope integration not initialized or running');
    }

    this.metrics.totalVerifications++;

    try {
      console.log(`[MailvelopeIntegration] Verifying signature with key ${signerKeyId}`);

      const signerKey = await this.getKeyByKeyId(signerKeyId);
      if (!signerKey) {
        throw new Error(`Signer key not found: ${signerKeyId}`);
      }

      // Verify signature using Mailvelope API
      const result = await this.callMailvelopeAPI('verifySignature', {
        data,
        signature,
        publicKey: signerKey.publicKeyArmored
      });

      const signatureResult: SignatureResult = {
        success: result.valid,
        keyId: signerKeyId,
        userId: signerKey.userId,
        trustLevel: await this.getTrustLevel(signerKeyId),
        timestamp: new Date(result.timestamp),
        error: result.error
      };

      if (signatureResult.success) {
        this.metrics.successfulVerifications++;
      }

      console.log('[MailvelopeIntegration] Signature verification completed');
      this.emit('signatureVerified', signatureResult);

      return signatureResult;

    } catch (error) {
      this.metrics.errors++;
      console.error('[MailvelopeIntegration] Error verifying signature:', error);

      const result: SignatureResult = {
        success: false,
        keyId: signerKeyId,
        userId: '',
        trustLevel: 'unknown',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };

      this.emit('signatureVerificationError', result);
      return result;
    }
  }

  async searchKeys(query: string, keyServer?: string): Promise<PGPKey[]> {
    if (!this.isInitialized) {
      throw new Error('Mailvelope integration not initialized');
    }

    try {
      console.log(`[MailvelopeIntegration] Searching keys for: ${query}`);

      const server = keyServer || this.config.keyServer;
      
      // Search keys using Mailvelope API
      const searchResult = await this.callMailvelopeAPI('searchKeys', {
        query,
        keyServer: server
      });

      const keys: PGPKey[] = [];
      for (const keyInfo of searchResult.keys) {
        const key: PGPKey = {
          id: this.generateId('key'),
          userId: keyInfo.userId,
          email: keyInfo.email,
          keyId: keyInfo.keyId,
          fingerprint: keyInfo.fingerprint,
          publicKeyArmored: keyInfo.publicKeyArmored,
          created: keyInfo.created ? new Date(keyInfo.created) : new Date(),
          expires: keyInfo.expires ? new Date(keyInfo.expires) : undefined,
          type: 'public',
          trust: 'unknown',
          bits: keyInfo.bits,
          algorithm: keyInfo.algorithm
        };

        keys.push(key);
      }

      console.log(`[MailvelopeIntegration] Found ${keys.length} keys`);
      return keys;

    } catch (error) {
      console.error('[MailvelopeIntegration] Error searching keys:', error);
      return [];
    }
  }

  async setTrust(keyId: string, trustLevel: 'unknown' | 'none' | 'marginal' | 'full' | 'ultimate'): Promise<void> {
    this.trustDatabase.set(keyId, trustLevel);
    await this.saveTrustDatabase();
    
    console.log(`[MailvelopeIntegration] Set trust level for ${keyId} to ${trustLevel}`);
    this.emit('trustUpdated', { keyId, trustLevel });
  }

  // Private helper methods
  private async initializeMailvelopeAPI(): Promise<void> {
    // Initialize Mailvelope API connection
    // This would typically involve connecting to the Mailvelope extension
    console.log('[MailvelopeIntegration] Initializing Mailvelope API...');
  }

  private async callMailvelopeAPI(method: string, params: any): Promise<any> {
    // Call Mailvelope API methods
    // This is a mock implementation
    console.log(`[MailvelopeIntegration] Calling Mailvelope API: ${method}`, params);
    
    // Mock responses for different methods
    switch (method) {
      case 'generateKey':
        return {
          keyId: `KEY-${Date.now()}`,
          fingerprint: `FINGERPRINT-${Date.now()}`,
          publicKeyArmored: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nMOCK_PUBLIC_KEY\n-----END PGP PUBLIC KEY BLOCK-----',
          privateKeyArmored: '-----BEGIN PGP PRIVATE KEY BLOCK-----\nMOCK_PRIVATE_KEY\n-----END PGP PRIVATE KEY BLOCK-----',
          bits: 4096,
          algorithm: 'rsa'
        };
        
      case 'importKey':
        return {
          success: true,
          keys: [{
            userId: 'Mock User',
            email: 'mock@example.com',
            keyId: 'IMPORTED-KEY',
            fingerprint: 'IMPORTED-FINGERPRINT',
            publicKeyArmored: 'IMPORTED-PUBLIC-KEY',
            isPrivate: params.isPrivate,
            bits: 4096,
            algorithm: 'rsa'
          }]
        };
        
      case 'encrypt':
        return {
          encryptedData: '-----BEGIN PGP MESSAGE-----\nENCRYPTED_DATA\n-----END PGP MESSAGE-----'
        };
        
      case 'decrypt':
        return {
          decryptedData: 'DECRYPTED_MESSAGE',
          signatures: params.verifySignatures ? [{
            valid: true,
            keyId: 'SIGNER-KEY',
            userId: 'Signer',
            timestamp: Date.now()
          }] : []
        };
        
      case 'verifySignature':
        return {
          valid: true,
          timestamp: Date.now()
        };
        
      case 'searchKeys':
        return {
          keys: [{
            userId: 'Search Result',
            email: 'search@example.com',
            keyId: 'SEARCHED-KEY',
            fingerprint: 'SEARCHED-FINGERPRINT',
            publicKeyArmored: 'SEARCHED-PUBLIC-KEY',
            created: Date.now() - 86400000, // 1 day ago
            bits: 4096,
            algorithm: 'rsa'
          }]
        };
        
      default:
        throw new Error(`Unknown Mailvelope API method: ${method}`);
    }
  }

  private async getKey(keyId: string): Promise<PGPKey> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }
    return key;
  }

  private async getKeyByKeyId(keyId: string): Promise<PGPKey | null> {
    // Check cache first
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }

    // Search in all keys
    for (const key of this.keys.values()) {
      if (key.keyId === keyId || key.fingerprint === keyId) {
        this.keyCache.set(keyId, key);
        return key;
      }
    }

    return null;
  }

  private async findPublicKey(email: string): Promise<PGPKey | null> {
    // Search in local keys first
    for (const key of this.keys.values()) {
      if (key.email.toLowerCase() === email.toLowerCase() && key.type === 'public') {
        return key;
      }
    }

    // Search on key server if enabled
    if (this.config.trustPolicy !== 'strict') {
      try {
        const keys = await this.searchKeys(email);
        if (keys.length > 0) {
          // Import the first matching key
          await this.importKey(keys[0].publicKeyArmored, false);
          return keys[0];
        }
      } catch (error) {
        console.error('[MailvelopeIntegration] Error finding public key on server:', error);
      }
    }

    return null;
  }

  private async getPassphrase(keyId: string, providedPassphrase?: string): Promise<string> {
    // Check cache first
    if (this.config.cachePassphrase && this.passphraseCache.has(keyId)) {
      const cached = this.passphraseCache.get(keyId)!;
      const now = new Date();
      const cacheAge = (now.getTime() - cached.timestamp.getTime()) / (1000 * 60); // minutes
      
      if (cacheAge < this.config.cacheTimeout) {
        return cached.passphrase;
      } else {
        this.passphraseCache.delete(keyId);
      }
    }

    // Use provided passphrase
    if (providedPassphrase) {
      if (this.config.cachePassphrase) {
        this.passphraseCache.set(keyId, {
          passphrase: providedPassphrase,
          timestamp: new Date()
        });
      }
      return providedPassphrase;
    }

    // For now, use config passphrase if available
    if (this.config.passphrase) {
      if (this.config.cachePassphrase) {
        this.passphraseCache.set(keyId, {
          passphrase: this.config.passphrase,
          timestamp: new Date()
        });
      }
      return this.config.passphrase;
    }

    throw new Error('Passphrase required but not provided');
  }

  private async getTrustLevel(keyId: string): Promise<'unknown' | 'none' | 'marginal' | 'full' | 'ultimate'> {
    return this.trustDatabase.get(keyId) || 'unknown';
  }

  private async loadKeys(): Promise<void> {
    try {
      const stored = localStorage.getItem('mailvelope-keys');
      if (stored) {
        const keysData = JSON.parse(stored);
        keysData.forEach((key: any) => {
          // Convert date strings back to Date objects
          key.created = new Date(key.created);
          if (key.expires) {
            key.expires = new Date(key.expires);
          }
          this.keys.set(key.id, key);
        });
        console.log(`[MailvelopeIntegration] Loaded ${this.keys.size} keys`);
      }
    } catch (error) {
      console.error('[MailvelopeIntegration] Error loading keys:', error);
    }
  }

  private async saveKeys(): Promise<void> {
    try {
      const keysData = Array.from(this.keys.values());
      localStorage.setItem('mailvelope-keys', JSON.stringify(keysData));
    } catch (error) {
      console.error('[MailvelopeIntegration] Error saving keys:', error);
    }
  }

  private async loadTrustDatabase(): Promise<void> {
    try {
      const stored = localStorage.getItem('mailvelope-trust');
      if (stored) {
        const trustData = JSON.parse(stored);
        this.trustDatabase = new Map(Object.entries(trustData));
        console.log(`[MailvelopeIntegration] Loaded trust database with ${this.trustDatabase.size} entries`);
      }
    } catch (error) {
      console.error('[MailvelopeIntegration] Error loading trust database:', error);
    }
  }

  private async saveTrustDatabase(): Promise<void> {
    try {
      const trustData = Object.fromEntries(this.trustDatabase);
      localStorage.setItem('mailvelope-trust', JSON.stringify(trustData));
    } catch (error) {
      console.error('[MailvelopeIntegration] Error saving trust database:', error);
    }
  }

  private setupPassphraseCacheCleanup(): void {
    // Clean up expired cache entries every minute
    setInterval(() => {
      const now = new Date();
      for (const [keyId, entry] of this.passphraseCache.entries()) {
        const cacheAge = (now.getTime() - entry.timestamp.getTime()) / (1000 * 60);
        if (cacheAge >= this.config.cacheTimeout) {
          this.passphraseCache.delete(keyId);
        }
      }
    }, 60000);
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  // Public API methods
  getKeys(): PGPKey[] {
    return Array.from(this.keys.values());
  }

  getStats() {
    return { ...this.metrics };
  }

  async updateConfig(newConfig: Partial<PGPConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    console.log('[MailvelopeIntegration] Configuration updated');
  }

  getConfig(): PGPConfig {
    return { ...this.config };
  }

  isHealthy(): boolean {
    return this.isRunning && this.metrics.errors / Math.max(this.metrics.totalEncryptions + this.metrics.totalDecryptions, 1) < 0.05;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    try {
      // Clean up resources
      this.keys.clear();
      this.keyCache.clear();
      this.trustDatabase.clear();
      this.passphraseCache.clear();
      
      localStorage.removeItem('mailvelope-keys');
      localStorage.removeItem('mailvelope-trust');

      console.log('[MailvelopeIntegration] Cleanup completed');

    } catch (error) {
      console.error('[MailvelopeIntegration] Cleanup failed:', error);
    }
  }
}