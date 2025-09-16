interface StorageOptions {
  compression?: boolean;
  encryption?: boolean;
  ttl?: number; // Time to live in milliseconds
}

interface StorageItem<T = any> {
  data: T;
  timestamp: number;
  ttl?: number;
  version: string;
}

class StorageManager {
  private readonly PREFIX = 'spur_';
  private readonly VERSION = '1.0.0';
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      // Perform any initialization tasks
      await this.cleanupExpiredItems();
      this.isInitialized = true;
      console.log('Storage manager initialized');
    } catch (error) {
      console.error('Failed to initialize storage manager:', error);
      throw error;
    }
  }

  async isInitialized(): Promise<boolean> {
    return this.isInitialized;
  }

  async set<T>(key: string, data: T, options: StorageOptions = {}): Promise<void> {
    try {
      const storageKey = this.PREFIX + key;
      const { compression = false, encryption = false, ttl } = options;

      let processedData = data;

      // Apply compression if enabled
      if (compression) {
        processedData = await this.compress(processedData);
      }

      // Apply encryption if enabled
      if (encryption) {
        processedData = await this.encrypt(processedData);
      }

      const storageItem: StorageItem<T> = {
        data: processedData,
        timestamp: Date.now(),
        ttl,
        version: this.VERSION
      };

      await chrome.storage.local.set({ [storageKey]: storageItem });
      console.log(`Data stored with key: ${key}`);
    } catch (error) {
      console.error(`Failed to store data for key ${key}:`, error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const storageKey = this.PREFIX + key;
      const result = await chrome.storage.local.get(storageKey);

      if (!result[storageKey]) {
        return null;
      }

      const storageItem = result[storageKey] as StorageItem<T>;

      // Check if item is expired
      if (storageItem.ttl && Date.now() - storageItem.timestamp > storageItem.ttl) {
        await this.delete(key);
        return null;
      }

      let data = storageItem.data;

      // Apply decryption if needed
      if (this.isEncrypted(data)) {
        data = await this.decrypt(data);
      }

      // Apply decompression if needed
      if (this.isCompressed(data)) {
        data = await this.decompress(data);
      }

      return data;
    } catch (error) {
      console.error(`Failed to retrieve data for key ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const storageKey = this.PREFIX + key;
      await chrome.storage.local.remove(storageKey);
      console.log(`Data deleted for key: ${key}`);
    } catch (error) {
      console.error(`Failed to delete data for key ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      // Get all keys with our prefix
      const allItems = await chrome.storage.local.get();
      const keysToDelete = Object.keys(allItems).filter(key => key.startsWith(this.PREFIX));

      if (keysToDelete.length > 0) {
        await chrome.storage.local.remove(keysToDelete);
        console.log(`Cleared ${keysToDelete.length} storage items`);
      }
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const data = await this.get(key);
      return data !== null;
    } catch (error) {
      return false;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const allItems = await chrome.storage.local.get();
      return Object.keys(allItems)
        .filter(key => key.startsWith(this.PREFIX))
        .map(key => key.substring(this.PREFIX.length));
    } catch (error) {
      console.error('Failed to get storage keys:', error);
      return [];
    }
  }

  async size(): Promise<number> {
    try {
      const allItems = await chrome.storage.local.get();
      const spurItems = Object.keys(allItems).filter(key => key.startsWith(this.PREFIX));
      
      // Calculate approximate size
      let totalSize = 0;
      for (const key of spurItems) {
        const item = allItems[key];
        totalSize += JSON.stringify(item).length;
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to get storage size:', error);
      return 0;
    }
  }

  async cleanupExpiredItems(): Promise<void> {
    try {
      const allItems = await chrome.storage.local.get();
      const keysToDelete: string[] = [];

      for (const [key, value] of Object.entries(allItems)) {
        if (key.startsWith(this.PREFIX)) {
          const item = value as StorageItem;
          if (item.ttl && Date.now() - item.timestamp > item.ttl) {
            keysToDelete.push(key);
          }
        }
      }

      if (keysToDelete.length > 0) {
        await chrome.storage.local.remove(keysToDelete);
        console.log(`Cleaned up ${keysToDelete.length} expired items`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired items:', error);
    }
  }

  async export(): Promise<string> {
    try {
      const allItems = await chrome.storage.local.get();
      const spurItems: Record<string, any> = {};

      for (const [key, value] of Object.entries(allItems)) {
        if (key.startsWith(this.PREFIX)) {
          spurItems[key] = value;
        }
      }

      return JSON.stringify({
        data: spurItems,
        exportedAt: new Date().toISOString(),
        version: this.VERSION
      }, null, 2);
    } catch (error) {
      console.error('Failed to export storage:', error);
      throw error;
    }
  }

  async import(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.data && typeof data.data === 'object') {
        // Clear existing data first
        await this.clear();
        
        // Import new data
        await chrome.storage.local.set(data.data);
        console.log('Storage data imported successfully');
      } else {
        throw new Error('Invalid import data format');
      }
    } catch (error) {
      console.error('Failed to import storage data:', error);
      throw error;
    }
  }

  async getUsageStats(): Promise<any> {
    try {
      const allItems = await chrome.storage.local.get();
      const spurItems = Object.entries(allItems)
        .filter(([key]) => key.startsWith(this.PREFIX));

      const totalSize = spurItems.reduce((size, [key, value]) => {
        return size + JSON.stringify(value).length;
      }, 0);

      const itemCounts = spurItems.reduce((acc, [key, value]) => {
        const type = this.getItemType(key, value);
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const ages = spurItems.map(([key, value]) => {
        const item = value as StorageItem;
        return Date.now() - item.timestamp;
      });

      return {
        totalItems: spurItems.length,
        totalSize,
        averageSize: totalSize / spurItems.length,
        itemTypes: itemCounts,
        oldestItem: Math.max(...ages),
        newestItem: Math.min(...ages),
        averageAge: ages.reduce((sum, age) => sum + age, 0) / ages.length,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return {};
    }
  }

  private getItemType(key: string, value: any): string {
    const keyWithoutPrefix = key.substring(this.PREFIX.length);
    
    if (keyWithoutPrefix.includes('config')) return 'config';
    if (keyWithoutPrefix.includes('memory')) return 'memory';
    if (keyWithoutPrefix.includes('cache')) return 'cache';
    if (keyWithoutPrefix.includes('sync')) return 'sync';
    if (keyWithoutPrefix.includes('log')) return 'log';
    
    return 'other';
  }

  private async compress(data: any): Promise<any> {
    // Simple compression - in production, use a proper compression library
    if (typeof data === 'string') {
      // Simple run-length encoding for demonstration
      let compressed = '';
      let count = 1;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i] === data[i - 1]) {
          count++;
        } else {
          compressed += data[i - 1] + (count > 1 ? count : '');
          count = 1;
        }
      }
      compressed += data[data.length - 1] + (count > 1 ? count : '');
      
      return { compressed: true, data: compressed };
    }
    
    return data;
  }

  private async decompress(data: any): Promise<any> {
    if (data && data.compressed) {
      // Simple run-length decoding
      const compressed = data.data as string;
      let decompressed = '';
      
      for (let i = 0; i < compressed.length; i++) {
        let numStr = '';
        
        while (i + 1 < compressed.length && /\d/.test(compressed[i + 1])) {
          numStr += compressed[i + 1];
          i++;
        }
        
        const count = numStr ? parseInt(numStr, 10) : 1;
        decompressed += compressed[i].repeat(count);
      }
      
      return decompressed;
    }
    
    return data;
  }

  private isCompressed(data: any): boolean {
    return data && typeof data === 'object' && data.compressed;
  }

  private async encrypt(data: any): Promise<any> {
    // Simple XOR encryption for demonstration
    // In production, use proper encryption like Web Crypto API
    if (typeof data === 'string') {
      const key = 'spur-encryption-key-2024';
      let encrypted = '';
      
      for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        encrypted += String.fromCharCode(charCode);
      }
      
      return { encrypted: true, data: btoa(encrypted) };
    }
    
    return data;
  }

  private async decrypt(data: any): Promise<any> {
    if (data && data.encrypted) {
      const key = 'spur-encryption-key-2024';
      const encrypted = atob(data.data);
      let decrypted = '';
      
      for (let i = 0; i < encrypted.length; i++) {
        const charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        decrypted += String.fromCharCode(charCode);
      }
      
      return decrypted;
    }
    
    return data;
  }

  private isEncrypted(data: any): boolean {
    return data && typeof data === 'object' && data.encrypted;
  }

  async getPendingSync(): Promise<any[]> {
    try {
      const pendingItems = await this.get('sync_pending');
      return Array.isArray(pendingItems) ? pendingItems : [];
    } catch (error) {
      return [];
    }
  }

  async addPendingSync(item: any): Promise<void> {
    try {
      const pending = await this.getPendingSync();
      pending.push({
        ...item,
        timestamp: Date.now()
      });
      
      await this.set('sync_pending', pending);
    } catch (error) {
      console.error('Failed to add pending sync item:', error);
    }
  }

  async removePendingSync(itemId: string): Promise<void> {
    try {
      const pending = await this.getPendingSync();
      const filtered = pending.filter((item: any) => item.id !== itemId);
      await this.set('sync_pending', filtered);
    } catch (error) {
      console.error('Failed to remove pending sync item:', error);
    }
  }

  async logError(context: string, error: any): Promise<void> {
    try {
      const logs = await this.get('error_logs') || [];
      logs.push({
        context,
        error: error.message || error.toString(),
        timestamp: Date.now(),
        stack: error.stack
      });
      
      // Keep only last 1000 errors
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }
      
      await this.set('error_logs', logs, { ttl: 7 * 24 * 60 * 60 * 1000 }); // 7 days TTL
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  }

  async getErrorLogs(): Promise<any[]> {
    try {
      return await this.get('error_logs') || [];
    } catch (error) {
      return [];
    }
  }

  async clearErrorLogs(): Promise<void> {
    try {
      await this.delete('error_logs');
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  }

  async sync(): Promise<void> {
    try {
      // Process pending sync items
      const pending = await this.getPendingSync();
      const processed: string[] = [];
      const failed: any[] = [];

      for (const item of pending) {
        try {
          // Process sync item
          await this.processSyncItem(item);
          processed.push(item.id);
        } catch (error) {
          failed.push({ ...item, error: error.message });
        }
      }

      // Remove processed items
      for (const itemId of processed) {
        await this.removePendingSync(itemId);
      }

      // Keep failed items for retry
      if (failed.length > 0) {
        await this.set('sync_pending', failed);
      }

      console.log(`Sync completed: ${processed.length} processed, ${failed.length} failed`);
    } catch (error) {
      console.error('Failed to perform sync:', error);
    }
  }

  private async processSyncItem(item: any): Promise<void> {
    // Simulate sync processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In production, this would:
    // - Send data to backend server
    // - Handle conflicts and retries
    // - Update local state based on server response
  }
}

export const storageManager = new StorageManager();
export { StorageManager, type StorageOptions };