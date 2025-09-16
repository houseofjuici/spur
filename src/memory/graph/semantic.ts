import { MemoryNode, MemoryEdge, SemanticConfig } from './types';
import { GraphDatabase } from './database';
import { NodeType, EdgeType } from '@/types';
import natural from 'natural';
import compromise from 'compromise';

export class SemanticSimilarityEngine {
  private config: SemanticConfig;
  private db: GraphDatabase;
  private tokenizer: natural.SentenceTokenizer;
  private stemmer: natural.PorterStemmer;
  private tfidf: natural.TfIdf;
  private wordNet?: any;

  constructor(config: SemanticConfig, db: GraphDatabase) {
    this.config = config;
    this.db = db;
    this.tokenizer = new natural.SentenceTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();
    
    // Initialize WordNet if available
    try {
      this.wordNet = natural.WordNet;
    } catch (error) {
      console.warn('WordNet not available, semantic features will be limited');
    }
  }

  /**
   * Extract semantic features from node content
   */
  async extractSemanticFeatures(node: MemoryNode): Promise<SemanticFeatures> {
    const features: SemanticFeatures = {
      keywords: [],
      entities: [],
      concepts: [],
      sentiment: 0,
      topics: [],
      embeddings: [],
      language: 'en'
    };

    try {
      const content = this.extractTextContent(node);
      if (!content) {
        return features;
      }

      // Extract keywords using TF-IDF
      features.keywords = this.extractKeywords(content);

      // Extract entities using compromise
      features.entities = this.extractEntities(content);

      // Extract concepts using NLP
      features.concepts = this.extractConcepts(content);

      // Analyze sentiment
      features.sentiment = this.analyzeSentiment(content);

      // Extract topics
      features.topics = this.extractTopics(content);

      // Generate embeddings (simplified version)
      features.embeddings = this.generateEmbeddings(content);

      // Detect language
      features.language = this.detectLanguage(content);

      return features;
    } catch (error) {
      console.error('Semantic feature extraction failed:', error);
      return features;
    }
  }

  /**
   * Calculate semantic similarity between two nodes
   */
  async calculateSimilarity(node1: MemoryNode, node2: MemoryNode): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    try {
      const features1 = await this.extractSemanticFeatures(node1);
      const features2 = await this.extractSemanticFeatures(node2);

      // Calculate multiple similarity metrics
      const keywordSimilarity = this.calculateKeywordSimilarity(features1.keywords, features2.keywords);
      const entitySimilarity = this.calculateEntitySimilarity(features1.entities, features2.entities);
      const conceptSimilarity = this.calculateConceptSimilarity(features1.concepts, features2.concepts);
      const topicSimilarity = this.calculateTopicSimilarity(features1.topics, features2.topics);
      const embeddingSimilarity = this.calculateEmbeddingSimilarity(features1.embeddings, features2.embeddings);

      // Weighted combination based on configuration
      const weights = this.config.fieldWeights;
      const similarity = 
        (keywordSimilarity * (weights.keywords || 0.3)) +
        (entitySimilarity * (weights.entities || 0.2)) +
        (conceptSimilarity * (weights.concepts || 0.2)) +
        (topicSimilarity * (weights.topics || 0.15)) +
        (embeddingSimilarity * (weights.embeddings || 0.15));

      return Math.min(1.0, Math.max(0.0, similarity));
    } catch (error) {
      console.error('Similarity calculation failed:', error);
      return 0;
    }
  }

  /**
   * Find semantically similar nodes
   */
  async findSimilarNodes(targetNode: MemoryNode, limit: number = 10, threshold: number = 0.5): Promise<Array<{ node: MemoryNode; similarity: number }>> {
    try {
      // Get all nodes (with same type boost if configured)
      const query = {
        id: 'semantic-search',
        type: 'node' as const,
        filters: [
          { field: 'id', operator: 'ne', value: targetNode.id },
          { field: 'is_pruned', operator: 'eq', value: false }
        ],
        constraints: [],
        limit: 1000 // Large limit for filtering
      };

      const result = await this.db.queryNodes(query);
      const similarities: Array<{ node: MemoryNode; similarity: number }> = [];

      for (const node of result.results) {
        const similarity = await this.calculateSimilarity(targetNode, node);
        
        if (similarity >= threshold) {
          similarities.push({ node, similarity });
        }
      }

      // Apply same type boost
      if (this.config.boostFactors.sameType > 1) {
        similarities.forEach(item => {
          if (item.node.type === targetNode.type) {
            item.similarity *= this.config.boostFactors.sameType;
          }
        });
      }

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('Similar nodes search failed:', error);
      return [];
    }
  }

  /**
   * Create semantic edges between similar nodes
   */
  async createSemanticEdges(nodeId: string, maxConnections: number = 5): Promise<number> {
    try {
      const targetNode = await this.db.getNode(nodeId);
      if (!targetNode) {
        return 0;
      }

      const similarNodes = await this.findSimilarNodes(targetNode, maxConnections, this.config.threshold);
      let edgesCreated = 0;

      for (const { node: similarNode, similarity } of similarNodes) {
        try {
          // Check if edge already exists
          const existingEdgeQuery = {
            id: 'check-edge',
            type: 'edge' as const,
            filters: [
              { field: 'source_id', operator: 'eq', value: nodeId },
              { field: 'target_id', operator: 'eq', value: similarNode.id },
              { field: 'type', operator: 'eq', value: 'semantic' }
            ],
            constraints: []
          };

          const existingResult = await this.db.queryEdges(existingEdgeQuery);
          
          if (existingResult.total === 0) {
            await this.db.createEdge({
              targetId: similarNode.id,
              type: EdgeType.SEMANTIC,
              strength: similarity,
              context: `Semantic similarity: ${(similarity * 100).toFixed(1)}%`,
              timestamp: Date.now(),
              weight: similarity,
              probability: similarity,
              decayRate: 0.05,
              isActive: true,
              interactionCount: 0,
              lastInteraction: Date.now()
            }, nodeId, similarNode.id);

            edgesCreated++;
          }
        } catch (error) {
          console.error(`Failed to create semantic edge for node ${similarNode.id}:`, error);
        }
      }

      return edgesCreated;
    } catch (error) {
      console.error('Semantic edge creation failed:', error);
      return 0;
    }
  }

  /**
   * Update semantic embeddings for all nodes
   */
  async updateEmbeddings(batchSize: number = 100): Promise<void> {
    try {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const query = {
          id: 'embedding-update',
          type: 'node' as const,
          filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
          constraints: [],
          limit: batchSize,
          offset
        };

        const result = await this.db.queryNodes(query);
        
        for (const node of result.results) {
          try {
            const features = await this.extractSemanticFeatures(node);
            
            // Update node with semantic features
            await this.db.updateNode(node.id, {
              tags: [...node.tags, ...features.keywords, ...features.concepts],
              embeddings: features.embeddings
            });
          } catch (error) {
            console.error(`Failed to update embeddings for node ${node.id}:`, error);
          }
        }

        offset += batchSize;
        hasMore = result.results.length === batchSize;
      }
    } catch (error) {
      console.error('Embedding update failed:', error);
    }
  }

  /**
   * Extract keywords from text using TF-IDF
   */
  private extractKeywords(text: string): string[] {
    try {
      // Clean and tokenize text
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
      const tokens = cleanText.split(/\s+/).filter(token => token.length > 2);
      
      // Remove stop words
      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did'
      ]);
      
      const filteredTokens = tokens.filter(token => !stopWords.has(token));
      
      // Calculate TF-IDF scores
      this.tfidf.addDocument(filteredTokens);
      
      const keywords: Array<{ term: string; score: number }> = [];
      this.tidf.listTerms(0).forEach(item => {
        keywords.push({ term: item.term, score: item.tfidf });
      });

      // Sort by score and return top keywords
      return keywords
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => this.stemmer.stem(item.term));
    } catch (error) {
      console.error('Keyword extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract entities using compromise
   */
  private extractEntities(text: string): string[] {
    try {
      const doc = compromise(text);
      const entities: string[] = [];

      // Extract different types of entities
      const people = doc.people().out('array');
      const places = doc.places().out('array');
      const organizations = doc.organizations().out('array');
      const dates = doc.dates().out('array');

      entities.push(...people, ...places, ...organizations, ...dates);

      // Extract numbers and money
      const numbers = doc.numbers().out('array');
      const money = doc.money().out('array');
      
      entities.push(...numbers.map(n => n.toString()), ...money);

      return [...new Set(entities)]; // Remove duplicates
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract concepts using NLP analysis
   */
  private extractConcepts(text: string): string[] {
    try {
      const doc = compromise(text);
      const concepts: string[] = [];

      // Extract noun phrases as concepts
      const nounPhrases = doc.nouns().out('array');
      concepts.push(...nounPhrases);

      // Extract verb phrases
      const verbPhrases = doc.verbs().out('array');
      concepts.push(...verbPhrases);

      // Extract adjective phrases
      const adjectivePhrases = doc.adjectives().out('array');
      concepts.push(...adjectivePhrases);

      // Clean and deduplicate concepts
      return [...new Set(concepts)]
        .filter(concept => concept.length > 2 && concept.length < 50)
        .map(concept => concept.toLowerCase().trim());
    } catch (error) {
      console.error('Concept extraction failed:', error);
      return [];
    }
  }

  /**
   * Analyze sentiment of text
   */
  private analyzeSentiment(text: string): number {
    try {
      const analyzer = new natural.SentimentAnalyzer('English', 
        natural.PorterStemmer, ['negation']);
      
      const tokens = natural.WordTokenizer.prototype.tokenize(text);
      const sentiment = analyzer.getSentiment(tokens);
      
      // Normalize to [-1, 1] range
      return Math.max(-1, Math.min(1, sentiment));
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      return 0;
    }
  }

  /**
   * Extract topics from text
   */
  private extractTopics(text: string): string[] {
    try {
      const doc = compromise(text);
      const topics: string[] = [];

      // Look for topic indicators
      const topicsMatch = text.match(/(?:topic|subject|about|regarding|concerning)\s*:?\s*([^.]+)/gi);
      if (topicsMatch) {
        topics.push(...topicsMatch.map(match => match.replace(/.*?:\s*/, '')));
      }

      // Extract from hashtags if present
      const hashtags = text.match(/#\w+/g);
      if (hashtags) {
        topics.push(...hashtags.map(tag => tag.substring(1)));
      }

      // Use compromise to find main subjects
      const subjects = doc.subjects().out('array');
      topics.push(...subjects);

      return [...new Set(topics)]
        .filter(topic => topic.length > 2)
        .map(topic => topic.toLowerCase());
    } catch (error) {
      console.error('Topic extraction failed:', error);
      return [];
    }
  }

  /**
   * Generate simplified embeddings (placeholder for actual ML model)
   */
  private generateEmbeddings(text: string): number[] {
    try {
      // Simplified embedding generation using word frequency and position
      const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      const wordFreq: Record<string, number> = {};
      
      // Calculate word frequencies
      words.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });

      // Create a simple 128-dimensional embedding
      const embedding = new Array(128).fill(0);
      const topWords = Object.entries(wordFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 50);

      topWords.forEach(([word, freq], index) => {
        const baseIndex = (index * 2) % 128;
        embedding[baseIndex] = freq / words.length;
        embedding[baseIndex + 1] = word.length / 20; // Normalize word length
      });

      return embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return new Array(128).fill(0);
    }
  }

  /**
   * Detect language of text
   */
  private detectLanguage(text: string): string {
    try {
      // Simple language detection based on character patterns
      const patterns = {
        'en': /[a-zA-Z\s]+/,
        'es': /[ñáéíóúü\s]+/,
        'fr': /[àâæçéèêëïîôùûüÿñœæ\s]+/,
        'de': /[äöüß\s]+/,
        'it': /[àèéìòùù\s]+/
      };

      let maxScore = 0;
      let detectedLang = 'en';

      for (const [lang, pattern] of Object.entries(patterns)) {
        const matches = text.match(pattern);
        const score = matches ? matches.join('').length / text.length : 0;
        
        if (score > maxScore) {
          maxScore = score;
          detectedLang = lang;
        }
      }

      return detectedLang;
    } catch (error) {
      console.error('Language detection failed:', error);
      return 'en';
    }
  }

  /**
   * Extract text content from node
   */
  private extractTextContent(node: MemoryNode): string {
    try {
      let content = '';

      // Extract from various content types
      if (typeof node.content === 'string') {
        content = node.content;
      } else if (typeof node.content === 'object') {
        // Extract text from structured content
        if (node.content.text) content += node.content.text + ' ';
        if (node.content.title) content += node.content.title + ' ';
        if (node.content.description) content += node.content.description + ' ';
        if (node.content.body) content += node.content.body + ' ';
        if (node.content.summary) content += node.content.summary + ' ';
        
        // Extract from arrays
        if (Array.isArray(node.content.keywords)) {
          content += node.content.keywords.join(' ') + ' ';
        }
        if (Array.isArray(node.content.tags)) {
          content += node.content.tags.join(' ') + ' ';
        }
      }

      // Add metadata text
      if (node.metadata) {
        if (node.metadata.title) content += node.metadata.title + ' ';
        if (node.metadata.description) content += node.metadata.description + ' ';
        if (node.metadata.subject) content += node.metadata.subject + ' ';
      }

      // Add tags
      if (node.tags && node.tags.length > 0) {
        content += node.tags.join(' ') + ' ';
      }

      return content.trim();
    } catch (error) {
      console.error('Content extraction failed:', error);
      return '';
    }
  }

  // Similarity calculation methods
  private calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  private calculateEntitySimilarity(entities1: string[], entities2: string[]): number {
    if (entities1.length === 0 || entities2.length === 0) {
      return 0;
    }

    const set1 = new Set(entities1);
    const set2 = new Set(entities2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private calculateConceptSimilarity(concepts1: string[], concepts2: string[]): number {
    if (concepts1.length === 0 || concepts2.length === 0) {
      return 0;
    }

    // Use Levenshtein distance for concept similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (const concept1 of concepts1) {
      for (const concept2 of concepts2) {
        const distance = natural.LevenshteinDistance(concept1, concept2);
        const maxLength = Math.max(concept1.length, concept2.length);
        const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;
        
        if (similarity > 0.7) { // Only consider significant matches
          totalSimilarity += similarity;
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateTopicSimilarity(topics1: string[], topics2: string[]): number {
    if (topics1.length === 0 || topics2.length === 0) {
      return 0;
    }

    const set1 = new Set(topics1);
    const set2 = new Set(topics2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private calculateEmbeddingSimilarity(embeddings1: number[], embeddings2: number[]): number {
    if (embeddings1.length === 0 || embeddings2.length === 0) {
      return 0;
    }

    // Ensure same length
    const minLength = Math.min(embeddings1.length, embeddings2.length);
    const vec1 = embeddings1.slice(0, minLength);
    const vec2 = embeddings2.slice(0, minLength);

    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Build semantic search index
   */
  async buildSearchIndex(): Promise<void> {
    try {
      // Get all nodes
      const query = {
        id: 'search-index',
        type: 'node' as const,
        filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
        constraints: []
      };

      const result = await this.db.queryNodes(query);
      
      // Build TF-IDF index
      this.tfidf = new natural.TfIdf();
      
      for (const node of result.results) {
        const content = this.extractTextContent(node);
        if (content) {
          this.tfidf.addDocument(content);
        }
      }

      console.log(`Built semantic search index with ${result.total} nodes`);
    } catch (error) {
      console.error('Search index building failed:', error);
    }
  }

  /**
   * Search nodes semantically
   */
  async searchNodes(query: string, limit: number = 10): Promise<Array<{ node: MemoryNode; score: number }>> {
    try {
      if (!this.tfidf.documents.length) {
        await this.buildSearchIndex();
      }

      // Calculate TF-IDF scores for query
      const scores: Array<{ index: number; score: number }> = [];
      this.tfidf.tfidfs(query, (i, measure) => {
        scores.push({ index: i, score: measure });
      });

      // Get top scoring documents
      const topScores = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Get corresponding nodes
      const allNodesQuery = {
        id: 'search-nodes',
        type: 'node' as const,
        filters: [{ field: 'is_pruned', operator: 'eq', value: false }],
        constraints: [],
        limit: 1000
      };

      const allNodesResult = await this.db.queryNodes(allNodesQuery);
      const results: Array<{ node: MemoryNode; score: number }> = [];

      for (const { index, score } of topScores) {
        if (index < allNodesResult.results.length) {
          results.push({
            node: allNodesResult.results[index],
            score
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }
}

// Semantic features interface
interface SemanticFeatures {
  keywords: string[];
  entities: string[];
  concepts: string[];
  sentiment: number;
  topics: string[];
  embeddings: number[];
  language: string;
}