import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpurDatabase, MemoryNode, UserSession, Interaction } from '@/database/SpurDatabase';
import { promises as fs } from 'fs';
import path from 'path';

describe('SpurDatabase', () => {
  let db: SpurDatabase;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database file for testing
    testDbPath = path.join(__dirname, '../../test-data/test.sqlite');
    
    // Ensure test directory exists
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });
    
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // File doesn't exist, which is fine
    }

    db = new SpurDatabase({
      path: testDbPath,
      enableWAL: true,
      busyTimeout: 5000
    });

    await db.initialize();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
    
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // File might already be deleted
    }
  });

  describe('Memory Node Operations', () => {
    it('should create and retrieve a memory node', async () => {
      const memoryNode: Omit<MemoryNode, 'created_at' | 'updated_at'> = {
        id: 'test-memory-1',
        type: 'capture',
        title: 'Test Memory',
        content: 'This is a test memory node',
        timestamp: new Date(),
        tags: ['test', 'memory'],
        importance: 'medium',
        confidence: 0.85,
        connections: [],
        metadata: { source: 'test' }
      };

      const created = await db.createMemoryNode(memoryNode);
      
      expect(created.id).toBe(memoryNode.id);
      expect(created.type).toBe(memoryNode.type);
      expect(created.title).toBe(memoryNode.title);
      expect(created.content).toBe(memoryNode.content);
      expect(created.tags).toEqual(memoryNode.tags);
      expect(created.importance).toBe(memoryNode.importance);
      expect(created.confidence).toBe(memoryNode.confidence);
      expect(created.connections).toEqual(memoryNode.connections);
      expect(created.metadata).toEqual(memoryNode.metadata);
      expect(created.created_at).toBeInstanceOf(Date);
      expect(created.updated_at).toBeInstanceOf(Date);

      // Retrieve the memory node
      const retrieved = await db.getMemoryNode(memoryNode.id);
      
      expect(retrieved).toEqual(created);
    });

    it('should update a memory node', async () => {
      const originalNode: Omit<MemoryNode, 'created_at' | 'updated_at'> = {
        id: 'test-memory-2',
        type: 'interaction',
        title: 'Original Title',
        content: 'Original content',
        timestamp: new Date(),
        tags: ['original'],
        importance: 'low',
        confidence: 0.7,
        connections: [],
        metadata: {}
      };

      await db.createMemoryNode(originalNode);

      const updates: Partial<MemoryNode> = {
        title: 'Updated Title',
        content: 'Updated content',
        importance: 'high',
        confidence: 0.9,
        tags: ['updated', 'important'],
        metadata: { updated: true }
      };

      const updated = await db.updateMemoryNode(originalNode.id, updates);
      
      expect(updated).toBeTruthy();
      expect(updated!.title).toBe(updates.title);
      expect(updated!.content).toBe(updates.content);
      expect(updated!.importance).toBe(updates.importance);
      expect(updated!.confidence).toBe(updates.confidence);
      expect(updated!.tags).toEqual(updates.tags);
      expect(updated!.metadata).toEqual(updates.metadata);
      expect(updated!.updated_at.getTime()).toBeGreaterThan(updated!.created_at.getTime());
    });

    it('should delete a memory node', async () => {
      const memoryNode: Omit<MemoryNode, 'created_at' | 'updated_at'> = {
        id: 'test-memory-3',
        type: 'document',
        title: 'To Delete',
        content: 'This should be deleted',
        timestamp: new Date(),
        tags: ['delete'],
        importance: 'low',
        confidence: 0.5,
        connections: [],
        metadata: {}
      };

      await db.createMemoryNode(memoryNode);

      // Verify it exists
      let retrieved = await db.getMemoryNode(memoryNode.id);
      expect(retrieved).toBeTruthy();

      // Delete it
      const deleted = await db.deleteMemoryNode(memoryNode.id);
      expect(deleted).toBe(true);

      // Verify it's gone
      retrieved = await db.getMemoryNode(memoryNode.id);
      expect(retrieved).toBeNull();
    });

    it('should query memory nodes with filters', async () => {
      // Create test data
      const nodes: Omit<MemoryNode, 'created_at' | 'updated_at'>[] = [
        {
          id: 'memory-1',
          type: 'capture',
          title: 'Important Task',
          content: 'This is important',
          timestamp: new Date(),
          tags: ['important', 'work'],
          importance: 'high',
          confidence: 0.9,
          connections: [],
          metadata: {}
        },
        {
          id: 'memory-2',
          type: 'interaction',
          title: 'Regular Note',
          content: 'This is regular',
          timestamp: new Date(),
          tags: ['personal'],
          importance: 'medium',
          confidence: 0.7,
          connections: [],
          metadata: {}
        },
        {
          id: 'memory-3',
          type: 'capture',
          title: 'Another Task',
          content: 'Work related',
          timestamp: new Date(),
          tags: ['work', 'urgent'],
          importance: 'critical',
          confidence: 0.95,
          connections: [],
          metadata: {}
        }
      ];

      for (const node of nodes) {
        await db.createMemoryNode(node);
      }

      // Test type filter
      const captureNodes = await db.queryMemoryNodes({ type: 'capture' });
      expect(captureNodes).toHaveLength(2);
      expect(captureNodes.every(n => n.type === 'capture')).toBe(true);

      // Test importance filter
      const importantNodes = await db.queryMemoryNodes({ 
        importance: ['high', 'critical'] 
      });
      expect(importantNodes).toHaveLength(2);

      // Test tags filter
      const workNodes = await db.queryMemoryNodes({ tags: ['work'] });
      expect(workNodes).toHaveLength(2);

      // Test search query
      const taskNodes = await db.queryMemoryNodes({ searchQuery: 'task' });
      expect(taskNodes).toHaveLength(2);

      // Test combined filters
      const filtered = await db.queryMemoryNodes({
        type: 'capture',
        importance: ['high', 'critical'],
        tags: ['work']
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('memory-3');
    });
  });

  describe('Session Operations', () => {
    it('should create and manage sessions', async () => {
      const userId = 'test-user-1';
      const context = { theme: 'dark', language: 'en' };

      const session = await db.createSession(userId, context);
      
      expect(session.id).toBeTruthy();
      expect(session.user_id).toBe(userId);
      expect(session.context).toEqual(context);
      expect(session.started_at).toBeInstanceOf(Date);
      expect(session.interactions).toEqual([]);

      // Add interactions
      const interaction1: Omit<Interaction, 'id' | 'session_id' | 'created_at' | 'updated_at'> = {
        type: 'text',
        input: 'Hello',
        response: 'Hi there!',
        confidence: 0.9,
        timestamp: new Date(),
        metadata: {}
      };

      const interaction2: Omit<Interaction, 'id' | 'session_id' | 'created_at' | 'updated_at'> = {
        type: 'voice',
        input: 'How are you?',
        response: 'I\'m doing well, thank you!',
        confidence: 0.85,
        timestamp: new Date(),
        metadata: {}
      };

      await db.addInteraction(session.id, interaction1);
      await db.addInteraction(session.id, interaction2);

      // Retrieve session history
      const history = await db.getSessionHistory(session.id);
      expect(history).toHaveLength(2);
      expect(history[0].input).toBe(interaction1.input);
      expect(history[0].response).toBe(interaction1.response);
      expect(history[1].input).toBe(interaction2.input);
      expect(history[1].response).toBe(interaction2.response);
    });
  });

  describe('Settings Operations', () => {
    it('should store and retrieve settings of different types', async () => {
      // String setting
      await db.setSetting('theme', 'dark', 'string');
      const theme = await db.getSetting<string>('theme');
      expect(theme).toBe('dark');

      // Number setting
      await db.setSetting('volume', 75, 'number');
      const volume = await db.getSetting<number>('volume');
      expect(volume).toBe(75);

      // Boolean setting
      await db.setSetting('notifications.enabled', true, 'boolean');
      const notifications = await db.getSetting<boolean>('notifications.enabled');
      expect(notifications).toBe(true);

      // JSON setting
      const complexSetting = {
        preferences: {
          language: 'en',
          timezone: 'UTC'
        },
        features: ['voice', 'sync']
      };
      await db.setSetting('user.preferences', complexSetting, 'json');
      const preferences = await db.getSetting<typeof complexSetting>('user.preferences');
      expect(preferences).toEqual(complexSetting);

      // Non-existent setting
      const nonExistent = await db.getSetting('non.existent');
      expect(nonExistent).toBeNull();
    });

    it('should update existing settings', async () => {
      await db.setSetting('test.setting', 'initial', 'string');
      
      const initial = await db.getSetting<string>('test.setting');
      expect(initial).toBe('initial');

      await db.setSetting('test.setting', 'updated', 'string');
      
      const updated = await db.getSetting<string>('test.setting');
      expect(updated).toBe('updated');
    });
  });

  describe('Sync Operations', () => {
    it('should log and retrieve sync operations', async () => {
      // Create a memory node to trigger sync logging
      const memoryNode: Omit<MemoryNode, 'created_at' | 'updated_at'> = {
        id: 'sync-test-1',
        type: 'capture',
        title: 'Sync Test',
        content: 'Testing sync operations',
        timestamp: new Date(),
        tags: ['sync'],
        importance: 'medium',
        confidence: 0.8,
        connections: [],
        metadata: {}
      };

      await db.createMemoryNode(memoryNode);

      // Check pending syncs
      const pendingSyncs = await db.getPendingSyncs();
      expect(pendingSyncs.length).toBeGreaterThan(0);
      
      const memorySync = pendingSyncs.find(s => 
        s.entity_type === 'memory_nodes' && s.entity_id === memoryNode.id
      );
      expect(memorySync).toBeTruthy();
      expect(memorySync!.action).toBe('create');

      // Mark as synced
      await db.markSynced(memorySync!.id);

      // Verify it's no longer pending
      const remainingSyncs = await db.getPendingSyncs();
      const remainingMemorySync = remainingSyncs.find(s => 
        s.entity_type === 'memory_nodes' && s.entity_id === memoryNode.id
      );
      expect(remainingMemorySync).toBeFalsy();
    });
  });

  describe('Database Statistics', () => {
    it('should provide accurate database statistics', async () => {
      // Get initial stats
      const initialStats = await db.getStats();
      expect(initialStats.memoryNodes).toBe(0);
      expect(initialStats.sessions).toBe(0);
      expect(initialStats.interactions).toBe(0);

      // Create test data
      await db.createMemoryNode({
        id: 'stats-test-1',
        type: 'capture',
        title: 'Stats Test',
        content: 'Testing statistics',
        timestamp: new Date(),
        tags: ['stats'],
        importance: 'medium',
        confidence: 0.8,
        connections: [],
        metadata: {}
      });

      const session = await db.createSession('stats-user');
      await db.addInteraction(session.id, {
        type: 'text',
        input: 'Test',
        response: 'Response',
        confidence: 0.9,
        timestamp: new Date(),
        metadata: {}
      });

      // Get updated stats
      const updatedStats = await db.getStats();
      expect(updatedStats.memoryNodes).toBe(1);
      expect(updatedStats.sessions).toBe(1);
      expect(updatedStats.interactions).toBe(1);
      expect(updatedStats.databaseSize).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Try to create database with invalid path
      const invalidDb = new SpurDatabase({
        path: '/invalid/path/that/does/not/exist/database.sqlite'
      });

      await expect(invalidDb.initialize()).rejects.toThrow();
    });

    it('should handle duplicate key constraints', async () => {
      const memoryNode: Omit<MemoryNode, 'created_at' | 'updated_at'> = {
        id: 'duplicate-test',
        type: 'capture',
        title: 'Duplicate Test',
        content: 'This should fail the second time',
        timestamp: new Date(),
        tags: ['test'],
        importance: 'medium',
        confidence: 0.8,
        connections: [],
        metadata: {}
      };

      // First creation should succeed
      await db.createMemoryNode(memoryNode);

      // Second creation with same ID should fail
      await expect(db.createMemoryNode(memoryNode)).rejects.toThrow();
    });

    it('should handle operations on non-existent records', async () => {
      const nonExistent = await db.getMemoryNode('non-existent-id');
      expect(nonExistent).toBeNull();

      const updateResult = await db.updateMemoryNode('non-existent-id', { title: 'Updated' });
      expect(updateResult).toBeNull();

      const deleteResult = await db.deleteMemoryNode('non-existent-id');
      expect(deleteResult).toBe(false);
    });
  });

  describe('Database Maintenance', () => {
    it('should create and restore backups', async () => {
      // Add some test data
      await db.createMemoryNode({
        id: 'backup-test',
        type: 'capture',
        title: 'Backup Test',
        content: 'Testing backup functionality',
        timestamp: new Date(),
        tags: ['backup'],
        importance: 'medium',
        confidence: 0.8,
        connections: [],
        metadata: {}
      });

      const backupPath = path.join(__dirname, '../../test-data/backup.sqlite');
      
      // Create backup
      await db.backup(backupPath);

      // Verify backup file exists
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);

      // Clean up backup
      await fs.unlink(backupPath);
    });

    it('should vacuum the database', async () => {
      // This should not throw an error
      await expect(db.vacuum()).resolves.not.toThrow();
    });
  });
});