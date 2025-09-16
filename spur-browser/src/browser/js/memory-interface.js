// Spur Browser - Memory Interface Component
// Handles memory creation, search, and graph-based knowledge management

class MemoryInterface {
  constructor(options = {}) {
    this.options = {
      storagePath: 'spur-memory',
      browserHistoryIntegration: true,
      sandboxEnabled: true,
      maxMemoryNodes: 1000000,
      autoSave: true,
      autoSaveInterval: 30000, // 30 seconds
      ...options
    };

    this.isInitialized = false;
    this.memories = new Map();
    this.memoryGraph = new Map(); // Adjacency list for memory relationships
    this.tags = new Map();
    this.autoSaveTimer = null;
    
    this.eventHandlers = {
      onMemoryCreated: options.onMemoryCreated || (() => {}),
      onMemoryUpdated: options.onMemoryUpdated || (() => {}),
      onMemoryDeleted: options.onMemoryDeleted || (() => {}),
      onSearchComplete: options.onSearchComplete || (() => {}),
      onError: options.onError || (() => {})
    };

    console.log('🧠 Memory Interface initialized');
  }

  async initialize() {
    try {
      console.log('🚀 Initializing memory system...');

      // Initialize storage
      await this.initializeStorage();
      
      // Load existing memories
      await this.loadMemories();
      
      // Set up auto-save
      this.setupAutoSave();
      
      // Set up browser history integration
      if (this.options.browserHistoryIntegration) {
        this.setupBrowserHistoryIntegration();
      }
      
      this.isInitialized = true;
      console.log('✅ Memory interface initialized successfully');
      
    } catch (error) {
      console.error('❌ Memory interface initialization failed:', error);
      this.eventHandlers.onError('Failed to initialize memory interface');
    }
  }

  async initializeStorage() {
    try {
      // Initialize localStorage for memory storage
      if (!localStorage) {
        throw new Error('localStorage not available');
      }

      // Create storage key prefix
      this.storagePrefix = `${this.options.storagePath}_`;
      
      // Check storage quota
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        console.log(`💾 Storage quota: ${Math.round(estimate.quota / 1024 / 1024)}MB, Used: ${Math.round(estimate.usage / 1024 / 1024)}MB`);
      }
      
      console.log('💾 Storage initialized');
      
    } catch (error) {
      console.error('❌ Storage initialization failed:', error);
      throw new Error('Storage not available');
    }
  }

  async loadMemories() {
    try {
      // Load memories from localStorage
      const memoriesData = localStorage.getItem(`${this.storagePrefix}memories`);
      if (memoriesData) {
        const memoriesArray = JSON.parse(memoriesData);
        this.memories = new Map(memoriesArray.map(memory => [memory.id, memory]));
        console.log(`📚 Loaded ${this.memories.size} memories`);
      }

      // Load memory graph
      const graphData = localStorage.getItem(`${this.storagePrefix}graph`);
      if (graphData) {
        this.memoryGraph = new Map(JSON.parse(graphData));
        console.log(`🕸️ Loaded memory graph with ${this.memoryGraph.size} nodes`);
      }

      // Load tags
      const tagsData = localStorage.getItem(`${this.storagePrefix}tags`);
      if (tagsData) {
        this.tags = new Map(JSON.parse(tagsData));
        console.log(`🏷️ Loaded ${this.tags.size} tags`);
      }
      
    } catch (error) {
      console.error('❌ Failed to load memories:', error);
      // Continue with empty memory store
    }
  }

  setupAutoSave() {
    if (this.options.autoSave) {
      this.autoSaveTimer = setInterval(() => {
        this.saveToStorage();
      }, this.options.autoSaveInterval);
      
      console.log(`⏰ Auto-save configured every ${this.options.autoSaveInterval}ms`);
    }
  }

  setupBrowserHistoryIntegration() {
    // Listen for browser navigation events
    if (window.spurBrowser) {
      window.spurBrowser.on('navigate', (data) => {
        this.createNavigationMemory(data);
      });
    }

    // Set up page content analysis
    this.setupPageAnalysis();
  }

  setupPageAnalysis() {
    // Analyze current page content periodically
    setInterval(() => {
      if (window.spurBrowser && window.spurBrowser.currentUrl) {
        this.analyzeCurrentPage();
      }
    }, 60000); // Analyze every minute
  }

  // Memory CRUD Operations
  async create(memoryData) {
    try {
      // Generate memory ID
      const memoryId = this.generateMemoryId();
      
      // Create memory object
      const memory = {
        id: memoryId,
        type: memoryData.type || 'general',
        title: memoryData.title || 'Untitled Memory',
        content: memoryData.content || '',
        url: memoryData.url || window.spurBrowser?.currentUrl || null,
        timestamp: memoryData.timestamp || new Date().toISOString(),
        tags: memoryData.tags || [],
        importance: memoryData.importance || 3, // 1-5 scale
        metadata: memoryData.metadata || {},
        accessCount: 0,
        lastAccessed: null,
        relatedMemories: []
      };

      // Store memory
      this.memories.set(memoryId, memory);
      
      // Update tags
      this.updateTags(memory.tags, memoryId);
      
      // Add to memory graph
      this.addToMemoryGraph(memoryId, memory);
      
      // Save to storage
      await this.saveToStorage();
      
      // Notify event handlers
      this.eventHandlers.onMemoryCreated(memory);
      
      console.log(`💾 Memory created: ${memory.title} (${memoryId})`);
      return memory;
      
    } catch (error) {
      console.error('❌ Failed to create memory:', error);
      this.eventHandlers.onError(`Failed to create memory: ${error.message}`);
      throw error;
    }
  }

  async update(memoryId, updates) {
    try {
      const memory = this.memories.get(memoryId);
      if (!memory) {
        throw new Error(`Memory not found: ${memoryId}`);
      }

      // Apply updates
      const oldMemory = { ...memory };
      Object.assign(memory, updates);
      memory.lastAccessed = new Date().toISOString();
      memory.accessCount++;

      // Update tags if they changed
      if (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(oldMemory.tags)) {
        this.updateTags(updates.tags, memoryId, oldMemory.tags);
      }

      // Update memory graph if content changed significantly
      if (updates.content && updates.content !== oldMemory.content) {
        this.updateMemoryGraph(memoryId, memory);
      }

      // Save to storage
      await this.saveToStorage();
      
      // Notify event handlers
      this.eventHandlers.onMemoryUpdated(memory);
      
      console.log(`💾 Memory updated: ${memory.title} (${memoryId})`);
      return memory;
      
    } catch (error) {
      console.error('❌ Failed to update memory:', error);
      this.eventHandlers.onError(`Failed to update memory: ${error.message}`);
      throw error;
    }
  }

  async delete(memoryId) {
    try {
      const memory = this.memories.get(memoryId);
      if (!memory) {
        throw new Error(`Memory not found: ${memoryId}`);
      }

      // Remove from memory store
      this.memories.delete(memoryId);
      
      // Remove from tags
      this.removeFromTags(memory.tags, memoryId);
      
      // Remove from memory graph
      this.removeFromMemoryGraph(memoryId);
      
      // Save to storage
      await this.saveToStorage();
      
      // Notify event handlers
      this.eventHandlers.onMemoryDeleted(memoryId);
      
      console.log(`💾 Memory deleted: ${memory.title} (${memoryId})`);
      
    } catch (error) {
      console.error('❌ Failed to delete memory:', error);
      this.eventHandlers.onError(`Failed to delete memory: ${error.message}`);
      throw error;
    }
  }

  async get(memoryId) {
    const memory = this.memories.get(memoryId);
    if (memory) {
      // Update access stats
      memory.accessCount++;
      memory.lastAccessed = new Date().toISOString();
      await this.saveToStorage();
    }
    return memory;
  }

  async getAll() {
    return Array.from(this.memories.values());
  }

  // Search Methods
  async search(query, options = {}) {
    try {
      const searchOptions = {
        type: options.type || 'fulltext', // 'fulltext', 'semantic', 'graph'
        limit: options.limit || 50,
        includeContent: options.includeContent !== false,
        includeMetadata: options.includeMetadata !== false,
        sortBy: options.sortBy || 'relevance', // 'relevance', 'date', 'importance'
        sortOrder: options.sortOrder || 'desc',
        ...options
      };

      let results = [];

      switch (searchOptions.type) {
        case 'fulltext':
          results = await this.fullTextSearch(query, searchOptions);
          break;
        case 'semantic':
          results = await this.semanticSearch(query, searchOptions);
          break;
        case 'graph':
          results = await this.graphSearch(query, searchOptions);
          break;
        default:
          results = await this.fullTextSearch(query, searchOptions);
      }

      // Sort results
      results = this.sortSearchResults(results, searchOptions.sortBy, searchOptions.sortOrder);
      
      // Limit results
      results = results.slice(0, searchOptions.limit);

      console.log(`🔍 Search completed: "${query}" - ${results.length} results found`);
      
      // Notify event handlers
      this.eventHandlers.onSearchComplete(results);
      
      return results;
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      this.eventHandlers.onError(`Search failed: ${error.message}`);
      return [];
    }
  }

  async fullTextSearch(query, options) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const memory of this.memories.values()) {
      let score = 0;
      
      // Search in title (higher weight)
      if (memory.title.toLowerCase().includes(queryLower)) {
        score += 10;
      }
      
      // Search in content
      if (memory.content.toLowerCase().includes(queryLower)) {
        score += 5;
      }
      
      // Search in tags
      const tagMatches = memory.tags.filter(tag => tag.toLowerCase().includes(queryLower));
      score += tagMatches.length * 3;
      
      // Search in URL
      if (memory.url && memory.url.toLowerCase().includes(queryLower)) {
        score += 2;
      }
      
      // Boost based on importance
      score += memory.importance;
      
      // Boost based on recent access
      if (memory.lastAccessed) {
        const daysSinceAccess = (Date.now() - new Date(memory.lastAccessed).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceAccess < 7) score += 2;
        if (daysSinceAccess < 1) score += 3;
      }
      
      if (score > 0) {
        results.push({
          memory: this.sanitizeMemoryForSearch(memory, options),
          score,
          matchType: 'fulltext'
        });
      }
    }
    
    return results;
  }

  async semanticSearch(query, options) {
    // Simplified semantic search using keyword similarity
    const results = [];
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    for (const memory of this.memories.values()) {
      let score = 0;
      
      // Calculate semantic similarity
      const memoryWords = [
        memory.title,
        memory.content,
        ...memory.tags
      ].join(' ').toLowerCase().split(/\s+/);
      
      // Word overlap scoring
      const intersection = queryWords.filter(word => 
        memoryWords.some(memoryWord => memoryWord.includes(word) || word.includes(memoryWord))
      );
      score = intersection.length * 2;
      
      // Add importance boost
      score += memory.importance;
      
      if (score > 0) {
        results.push({
          memory: this.sanitizeMemoryForSearch(memory, options),
          score,
          matchType: 'semantic'
        });
      }
    }
    
    return results;
  }

  async graphSearch(query, options) {
    const results = [];
    
    // Get direct matches first
    const directMatches = await this.fullTextSearch(query, { ...options, limit: 10 });
    
    // Use memory graph to find related memories
    for (const match of directMatches) {
      const relatedMemoryIds = this.memoryGraph.get(match.memory.id) || [];
      
      for (const relatedId of relatedMemoryIds) {
        const relatedMemory = this.memories.get(relatedId);
        if (relatedMemory) {
          results.push({
            memory: this.sanitizeMemoryForSearch(relatedMemory, options),
            score: match.score * 0.7, // Reduce score for related memories
            matchType: 'graph',
            relatedTo: match.memory.id
          });
        }
      }
    }
    
    return results;
  }

  // Memory Graph Operations
  addToMemoryGraph(memoryId, memory) {
    if (!this.memoryGraph.has(memoryId)) {
      this.memoryGraph.set(memoryId, new Set());
    }
    
    // Find related memories based on content similarity
    const relatedMemories = this.findRelatedMemories(memory);
    for (const relatedId of relatedMemories) {
      if (relatedId !== memoryId) {
        this.memoryGraph.get(memoryId).add(relatedId);
        if (!this.memoryGraph.has(relatedId)) {
          this.memoryGraph.set(relatedId, new Set());
        }
        this.memoryGraph.get(relatedId).add(memoryId);
      }
    }
  }

  updateMemoryGraph(memoryId, memory) {
    // Remove old relationships and recalculate
    this.removeFromMemoryGraph(memoryId);
    this.addToMemoryGraph(memoryId, memory);
  }

  removeFromMemoryGraph(memoryId) {
    // Remove from graph
    this.memoryGraph.delete(memoryId);
    
    // Remove references from other nodes
    for (const [id, connections] of this.memoryGraph.entries()) {
      connections.delete(memoryId);
    }
  }

  findRelatedMemories(memory) {
    const related = [];
    const memoryText = (memory.title + ' ' + memory.content).toLowerCase();
    const memoryTags = new Set(memory.tags);
    
    for (const [otherId, otherMemory] of this.memories.entries()) {
      if (otherId === memory.id) continue;
      
      let similarityScore = 0;
      
      // Tag similarity
      const otherTags = new Set(otherMemory.tags);
      const tagIntersection = new Set([...memoryTags].filter(tag => otherTags.has(tag)));
      similarityScore += tagIntersection.size * 3;
      
      // Text similarity
      const otherText = (otherMemory.title + ' ' + otherMemory.content).toLowerCase();
      const commonWords = this.findCommonWords(memoryText, otherText);
      similarityScore += commonWords.length;
      
      // URL similarity
      if (memory.url && otherMemory.url) {
        try {
          const memoryDomain = new URL(memory.url).hostname;
          const otherDomain = new URL(otherMemory.url).hostname;
          if (memoryDomain === otherDomain) {
            similarityScore += 2;
          }
        } catch (error) {
          // Invalid URLs, ignore
        }
      }
      
      if (similarityScore >= 3) {
        related.push(otherId);
      }
    }
    
    return related;
  }

  findCommonWords(text1, text2) {
    const words1 = new Set(text1.split(/\s+/).filter(word => word.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(word => word.length > 3));
    return [...words1].filter(word => words2.has(word));
  }

  // Tag Management
  updateTags(newTags, memoryId, oldTags = []) {
    // Remove from old tags
    this.removeFromTags(oldTags, memoryId);
    
    // Add to new tags
    for (const tag of newTags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag).add(memoryId);
    }
  }

  removeFromTags(tags, memoryId) {
    for (const tag of tags) {
      if (this.tags.has(tag)) {
        this.tags.get(tag).delete(memoryId);
        if (this.tags.get(tag).size === 0) {
          this.tags.delete(tag);
        }
      }
    }
  }

  async getAllTags() {
    return Array.from(this.tags.keys()).map(tag => ({
      name: tag,
      count: this.tags.get(tag).size
    }));
  }

  async getMemoriesByTag(tag) {
    const memoryIds = this.tags.get(tag) || new Set();
    return Array.from(memoryIds).map(id => this.memories.get(id)).filter(Boolean);
  }

  // Browser Integration Methods
  async createNavigationMemory(navigationData) {
    try {
      const memory = {
        type: 'navigation',
        title: navigationData.title || 'Navigation',
        content: `Visited: ${navigationData.title}`,
        url: navigationData.url,
        tags: ['navigation', 'browsing'],
        importance: 2,
        metadata: {
          navigationType: 'manual',
          timestamp: navigationData.timestamp
        }
      };
      
      return await this.create(memory);
      
    } catch (error) {
      console.error('❌ Failed to create navigation memory:', error);
    }
  }

  async analyzeCurrentPage() {
    try {
      if (!window.spurBrowser || !window.spurBrowser.currentUrl) return;
      
      const title = document.title;
      const url = window.spurBrowser.currentUrl;
      
      // Get page content (simplified)
      const content = this.extractPageContent();
      
      if (content && content.length > 100) {
        const memory = {
          type: 'page_content',
          title: title,
          content: content.substring(0, 1000),
          url: url,
          tags: ['content', 'analysis'],
          importance: 3,
          metadata: {
            contentLength: content.length,
            analysisType: 'automatic'
          }
        };
        
        await this.create(memory);
      }
      
    } catch (error) {
      console.error('❌ Failed to analyze current page:', error);
    }
  }

  extractPageContent() {
    // Simplified content extraction
    const body = document.body;
    if (!body) return '';
    
    // Remove script and style elements
    const scripts = body.querySelectorAll('script, style, noscript');
    scripts.forEach(el => el.remove());
    
    // Get text content
    const text = body.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // Utility Methods
  generateMemoryId() {
    return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeMemoryForSearch(memory, options) {
    const sanitized = {
      id: memory.id,
      type: memory.type,
      title: memory.title,
      url: memory.url,
      timestamp: memory.timestamp,
      tags: memory.tags,
      importance: memory.importance
    };

    if (options.includeContent) {
      sanitized.content = memory.content;
    }

    if (options.includeMetadata) {
      sanitized.metadata = memory.metadata;
      sanitized.accessCount = memory.accessCount;
      sanitized.lastAccessed = memory.lastAccessed;
    }

    return sanitized;
  }

  sortSearchResults(results, sortBy, sortOrder) {
    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    
    return results.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'date':
          valueA = new Date(a.memory.timestamp).getTime();
          valueB = new Date(b.memory.timestamp).getTime();
          break;
        case 'importance':
          valueA = a.memory.importance;
          valueB = b.memory.importance;
          break;
        case 'relevance':
        default:
          valueA = a.score;
          valueB = b.score;
          break;
      }
      
      return (valueA - valueB) * sortMultiplier;
    });
  }

  async getRecent(limit = 10) {
    const allMemories = await this.getAll();
    return allMemories
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getImportant(limit = 10) {
    const allMemories = await this.getAll();
    return allMemories
      .filter(memory => memory.importance >= 4)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  async getStats() {
    const allMemories = await this.getAll();
    const allTags = await this.getAllTags();
    
    const stats = {
      totalMemories: allMemories.length,
      totalTags: allTags.length,
      memoriesByType: {},
      memoriesByImportance: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      averageImportance: 0,
      memoriesLastWeek: 0,
      topTags: allTags.sort((a, b) => b.count - a.count).slice(0, 10)
    };

    // Calculate statistics
    allMemories.forEach(memory => {
      // By type
      stats.memoriesByType[memory.type] = (stats.memoriesByType[memory.type] || 0) + 1;
      
      // By importance
      stats.memoriesByImportance[memory.importance]++;
      
      // Average importance
      stats.averageImportance += memory.importance;
      
      // Last week
      const daysSinceCreated = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated < 7) {
        stats.memoriesLastWeek++;
      }
    });

    stats.averageImportance = stats.averageImportance / allMemories.length;

    return stats;
  }

  // Storage Methods
  async saveToStorage() {
    try {
      // Save memories
      const memoriesArray = Array.from(this.memories.entries());
      localStorage.setItem(`${this.storagePrefix}memories`, JSON.stringify(memoriesArray));
      
      // Save memory graph
      const graphArray = Array.from(this.memoryGraph.entries()).map(([key, value]) => [key, Array.from(value)]);
      localStorage.setItem(`${this.storagePrefix}graph`, JSON.stringify(graphArray));
      
      // Save tags
      const tagsArray = Array.from(this.tags.entries()).map(([key, value]) => [key, Array.from(value)]);
      localStorage.setItem(`${this.storagePrefix}tags`, JSON.stringify(tagsArray));
      
    } catch (error) {
      console.error('❌ Failed to save to storage:', error);
      this.eventHandlers.onError(`Storage save failed: ${error.message}`);
    }
  }

  async clearStorage() {
    try {
      localStorage.removeItem(`${this.storagePrefix}memories`);
      localStorage.removeItem(`${this.storagePrefix}graph`);
      localStorage.removeItem(`${this.storagePrefix}tags`);
      
      this.memories.clear();
      this.memoryGraph.clear();
      this.tags.clear();
      
      console.log('🧹 Memory storage cleared');
      
    } catch (error) {
      console.error('❌ Failed to clear storage:', error);
    }
  }

  async exportData() {
    const data = {
      memories: Array.from(this.memories.entries()),
      graph: Array.from(this.memoryGraph.entries()).map(([key, value]) => [key, Array.from(value)]),
      tags: Array.from(this.tags.entries()).map(([key, value]) => [key, Array.from(value)]),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      // Clear existing data
      await this.clearStorage();
      
      // Import data
      this.memories = new Map(data.memories || []);
      this.memoryGraph = new Map((data.graph || []).map(([key, value]) => [key, new Set(value)]));
      this.tags = new Map((data.tags || []).map(([key, value]) => [key, new Set(value)]));
      
      // Save to storage
      await this.saveToStorage();
      
      console.log('📥 Memory data imported successfully');
      
    } catch (error) {
      console.error('❌ Failed to import data:', error);
      throw error;
    }
  }

  // Cleanup Methods
  async destroy() {
    try {
      console.log('🧹 Destroying memory interface...');
      
      // Clear auto-save timer
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
      }
      
      // Save final state
      await this.saveToStorage();
      
      // Clear data
      this.memories.clear();
      this.memoryGraph.clear();
      this.tags.clear();
      
      this.isInitialized = false;
      
      console.log('✅ Memory interface destroyed');
      
    } catch (error) {
      console.error('❌ Memory interface destruction failed:', error);
    }
  }
}

// Initialize memory interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.MemoryInterface = MemoryInterface;
});

// Export for use in other modules
window.MemoryInterface = MemoryInterface;