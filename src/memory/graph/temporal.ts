import { MemoryNode, MemoryEdge, TemporalConfig, TemporalPattern } from './types';
import { GraphDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

export class TemporalClusteringEngine {
  private config: TemporalConfig;
  private db: GraphDatabase;

  constructor(config: TemporalConfig, db: GraphDatabase) {
    this.config = config;
    this.db = db;
  }

  /**
   * Cluster nodes by temporal proximity using sliding window approach
   */
  async clusterNodes(startTime?: number, endTime?: number): Promise<string[]> {
    if (!this.config.enabled) {
      return [];
    }

    const now = Date.now();
    const timeRange = {
      start: startTime || (now - (24 * 60 * 60 * 1000)), // Default: last 24 hours
      end: endTime || now
    };

    try {
      // Get nodes in time range
      const nodes = await this.getNodesInTimeRange(timeRange);
      if (nodes.length < this.config.minClusterSize) {
        return [];
      }

      // Sort nodes by timestamp
      nodes.sort((a, b) => a.timestamp - b.timestamp);

      // Apply sliding window clustering
      const clusters = this.slidingWindowClustering(nodes);
      
      // Merge overlapping clusters
      const mergedClusters = this.mergeOverlappingClusters(clusters);
      
      // Filter clusters by size constraints
      const validClusters = mergedClusters.filter(cluster => 
        cluster.nodes.length >= this.config.minClusterSize && 
        cluster.nodes.length <= this.config.maxClusterSize
      );

      // Save clusters to database
      const clusterIds = await this.saveClusters(validClusters);

      return clusterIds;
    } catch (error) {
      console.error('Temporal clustering failed:', error);
      return [];
    }
  }

  /**
   * Get nodes within specified time range
   */
  private async getNodesInTimeRange(timeRange: { start: number; end: number }): Promise<MemoryNode[]> {
    const query = {
      id: uuidv4(),
      type: 'node' as const,
      filters: [
        {
          field: 'timestamp',
          operator: 'gte',
          value: timeRange.start
        },
        {
          field: 'timestamp',
          operator: 'lte',
          value: timeRange.end
        },
        {
          field: 'is_pruned',
          operator: 'eq',
          value: false
        }
      ],
      constraints: [],
      sortBy: [{ field: 'timestamp', direction: 'asc' as const }]
    };

    const result = await this.db.queryNodes(query);
    return result.results;
  }

  /**
   * Apply sliding window clustering algorithm
   */
  private slidingWindowClustering(nodes: MemoryNode[]): TemporalCluster[] {
    const clusters: TemporalCluster[] = [];
    const windowSize = this.config.windowSize;

    for (let i = 0; i < nodes.length; i++) {
      const currentNode = nodes[i];
      const windowEnd = currentNode.timestamp + windowSize;
      
      // Find all nodes within the window
      const windowNodes = [currentNode];
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j].timestamp <= windowEnd) {
          windowNodes.push(nodes[j]);
        } else {
          break;
        }
      }

      // Create cluster if minimum size is met
      if (windowNodes.length >= this.config.minClusterSize) {
        const cluster: TemporalCluster = {
          id: uuidv4(),
          nodes: windowNodes,
          startTime: Math.min(...windowNodes.map(n => n.timestamp)),
          endTime: Math.max(...windowNodes.map(n => n.timestamp)),
          density: this.calculateClusterDensity(windowNodes),
          confidence: this.calculateClusterConfidence(windowNodes),
          centroidNodeId: this.findCentroidNode(windowNodes)
        };
        
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Merge overlapping clusters based on overlap threshold
   */
  private mergeOverlappingClusters(clusters: TemporalCluster[]): TemporalCluster[] {
    if (clusters.length <= 1) {
      return clusters;
    }

    clusters.sort((a, b) => a.startTime - b.startTime);
    const merged: TemporalCluster[] = [];
    let current = clusters[0];

    for (let i = 1; i < clusters.length; i++) {
      const next = clusters[i];
      
      if (this.calculateOverlap(current, next) >= this.config.overlapThreshold) {
        // Merge clusters
        current = this.mergeTwoClusters(current, next);
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  /**
   * Calculate overlap between two clusters
   */
  private calculateOverlap(cluster1: TemporalCluster, cluster2: TemporalCluster): number {
    const overlapStart = Math.max(cluster1.startTime, cluster2.startTime);
    const overlapEnd = Math.min(cluster1.endTime, cluster2.endTime);
    
    if (overlapStart >= overlapEnd) {
      return 0;
    }
    
    const overlapDuration = overlapEnd - overlapStart;
    const totalDuration = Math.min(
      cluster1.endTime - cluster1.startTime,
      cluster2.endTime - cluster2.startTime
    );
    
    return totalDuration > 0 ? overlapDuration / totalDuration : 0;
  }

  /**
   * Merge two clusters into one
   */
  private mergeTwoClusters(cluster1: TemporalCluster, cluster2: TemporalCluster): TemporalCluster {
    const allNodes = [...cluster1.nodes, ...cluster2.nodes];
    const uniqueNodes = this.deduplicateNodes(allNodes);
    
    return {
      id: uuidv4(),
      nodes: uniqueNodes,
      startTime: Math.min(cluster1.startTime, cluster2.startTime),
      endTime: Math.max(cluster1.endTime, cluster2.endTime),
      density: this.calculateClusterDensity(uniqueNodes),
      confidence: Math.min(cluster1.confidence, cluster2.confidence),
      centroidNodeId: this.findCentroidNode(uniqueNodes)
    };
  }

  /**
   * Remove duplicate nodes from cluster
   */
  private deduplicateNodes(nodes: MemoryNode[]): MemoryNode[] {
    const seen = new Set<string>();
    return nodes.filter(node => {
      if (seen.has(node.id)) {
        return false;
      }
      seen.add(node.id);
      return true;
    });
  }

  /**
   * Calculate cluster density based on temporal distribution
   */
  private calculateClusterDensity(nodes: MemoryNode[]): number {
    if (nodes.length <= 1) {
      return 1.0;
    }

    const duration = Math.max(...nodes.map(n => n.timestamp)) - Math.min(...nodes.map(n => n.timestamp));
    if (duration === 0) {
      return 1.0;
    }

    // Density based on node concentration over time
    const expectedSpacing = duration / (nodes.length - 1);
    const actualSpacings: number[] = [];
    
    for (let i = 1; i < nodes.length; i++) {
      actualSpacings.push(nodes[i].timestamp - nodes[i - 1].timestamp);
    }

    const avgSpacing = actualSpacings.reduce((sum, spacing) => sum + spacing, 0) / actualSpacings.length;
    const spacingVariance = actualSpacings.reduce((sum, spacing) => 
      sum + Math.pow(spacing - avgSpacing, 2), 0) / actualSpacings.length;

    // Higher density when variance is low (evenly distributed)
    const density = 1 / (1 + (spacingVariance / (expectedSpacing * expectedSpacing)));
    return Math.min(1.0, Math.max(0.0, density));
  }

  /**
   * Calculate cluster confidence based on various factors
   */
  private calculateClusterConfidence(nodes: MemoryNode[]): number {
    if (nodes.length === 0) {
      return 0.0;
    }

    let confidence = 0.0;

    // Size factor (optimal size around middle of min/max range)
    const optimalSize = (this.config.minClusterSize + this.config.maxClusterSize) / 2;
    const sizeFactor = 1 - Math.abs(nodes.length - optimalSize) / optimalSize;
    confidence += sizeFactor * 0.3;

    // Relevance factor
    const avgRelevance = nodes.reduce((sum, node) => sum + node.relevanceScore, 0) / nodes.length;
    confidence += avgRelevance * 0.3;

    // Temporal coherence factor
    const timestamps = nodes.map(n => n.timestamp);
    const duration = Math.max(...timestamps) - Math.min(...timestamps);
    const expectedDuration = (nodes.length - 1) * (this.config.windowSize / nodes.length);
    const coherenceFactor = expectedDuration > 0 ? Math.min(duration / expectedDuration, 1) : 1;
    confidence += coherenceFactor * 0.2;

    // Type consistency factor
    const types = new Set(nodes.map(n => n.type));
    const typeConsistency = 1 / types.size;
    confidence += typeConsistency * 0.2;

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Find centroid node (most central node in cluster)
   */
  private findCentroidNode(nodes: MemoryNode[]): string {
    if (nodes.length === 0) {
      return '';
    }

    if (nodes.length === 1) {
      return nodes[0].id;
    }

    // Calculate centroid based on timestamp and relevance
    const avgTimestamp = nodes.reduce((sum, node) => sum + node.timestamp, 0) / nodes.length;
    
    let centroidNode = nodes[0];
    let minDistance = Infinity;

    for (const node of nodes) {
      const timeDistance = Math.abs(node.timestamp - avgTimestamp);
      const relevanceWeight = node.relevanceScore;
      const distance = timeDistance / (relevanceWeight + 0.1); // Avoid division by zero
      
      if (distance < minDistance) {
        minDistance = distance;
        centroidNode = node;
      }
    }

    return centroidNode.id;
  }

  /**
   * Save clusters to database
   */
  private async saveClusters(clusters: TemporalCluster[]): Promise<string[]> {
    const clusterIds: string[] = [];
    
    for (const cluster of clusters) {
      try {
        // Insert cluster
        const stmt = this.db['db'].prepare(`
          INSERT INTO temporal_clusters (
            id, name, start_time, end_time, duration, node_ids, 
            centroid_node_id, density, confidence, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          cluster.id,
          `Temporal Cluster ${cluster.id.slice(0, 8)}`,
          cluster.startTime,
          cluster.endTime,
          cluster.endTime - cluster.startTime,
          JSON.stringify(cluster.nodes.map(n => n.id)),
          cluster.centroidNodeId,
          cluster.density,
          cluster.confidence,
          Date.now(),
          Date.now()
        );

        clusterIds.push(cluster.id);
      } catch (error) {
        console.error(`Failed to save cluster ${cluster.id}:`, error);
      }
    }

    return clusterIds;
  }

  /**
   * Detect temporal patterns in existing data
   */
  async detectPatterns(startTime?: number, endTime?: number): Promise<TemporalPattern[]> {
    const now = Date.now();
    const timeRange = {
      start: startTime || (now - (7 * 24 * 60 * 60 * 1000)), // Default: last 7 days
      end: endTime || now
    };

    const patterns: TemporalPattern[] = [];

    try {
      // Detect burst patterns
      const bursts = await this.detectBursts(timeRange);
      patterns.push(...bursts);

      // Detect cyclic patterns
      const cycles = await this.detectCycles(timeRange);
      patterns.push(...cycles);

      // Detect trends
      const trends = await this.detectTrends(timeRange);
      patterns.push(...trends);

      // Detect anomalies
      const anomalies = await this.detectAnomalies(timeRange);
      patterns.push(...anomalies);

      return patterns.filter(pattern => pattern.confidence > 0.5);
    } catch (error) {
      console.error('Pattern detection failed:', error);
      return [];
    }
  }

  /**
   * Detect burst patterns (sudden increases in activity)
   */
  private async detectBursts(timeRange: { start: number; end: number }): Promise<TemporalPattern[]> {
    const bursts: TemporalPattern[] = [];
    
    // Get activity counts in time windows
    const windowSize = 60 * 60 * 1000; // 1 hour windows
    const windows = this.getTimeWindows(timeRange, windowSize);
    
    for (const window of windows) {
      const activityCount = await this.getActivityCount(window.start, window.end);
      const baseline = await this.getBaselineActivity(window.start, window.end);
      
      if (activityCount > baseline * 2) { // Burst threshold: 2x baseline
        const affectedNodes = await this.getNodesInTimeRange(window);
        
        bursts.push({
          type: 'burst',
          timeframe: windowSize,
          confidence: Math.min(1.0, activityCount / baseline),
          affectedNodes: affectedNodes.map(n => n.id),
          description: `Activity burst detected: ${activityCount} activities in 1 hour (${(activityCount / baseline).toFixed(1)}x baseline)`
        });
      }
    }

    return bursts;
  }

  /**
   * Detect cyclic patterns (recurring activities)
   */
  private async detectCycles(timeRange: { start: number; end: number }): Promise<TemporalPattern[]> {
    const cycles: TemporalPattern[] = [];
    
    // Look for daily patterns
    const dailyPattern = await this.detectDailyPatterns(timeRange);
    if (dailyPattern.confidence > 0.5) {
      cycles.push(dailyPattern);
    }

    // Look for weekly patterns
    const weeklyPattern = await this.detectWeeklyPatterns(timeRange);
    if (weeklyPattern.confidence > 0.5) {
      cycles.push(weeklyPattern);
    }

    return cycles;
  }

  /**
   * Detect trend patterns (increasing/decreasing activity)
   */
  private async detectTrends(timeRange: { start: number; end: number }): Promise<TemporalPattern[]> {
    const trends: TemporalPattern[] = [];
    
    // Get activity over time
    const windows = this.getTimeWindows(timeRange, 24 * 60 * 60 * 1000); // Daily windows
    const activities: number[] = [];
    
    for (const window of windows) {
      const count = await this.getActivityCount(window.start, window.end);
      activities.push(count);
    }

    if (activities.length < 3) {
      return trends;
    }

    // Simple linear regression to detect trend
    const trend = this.calculateLinearTrend(activities);
    
    if (Math.abs(trend.slope) > 0.1) { // Significant trend
      const direction = trend.slope > 0 ? 'increasing' : 'decreasing';
      const affectedNodes = await this.getNodesInTimeRange(timeRange);
      
      trends.push({
        type: 'trend',
        timeframe: timeRange.end - timeRange.start,
        confidence: Math.abs(trend.correlation),
        affectedNodes: affectedNodes.map(n => n.id),
        description: `${direction} activity trend detected (${trend.slope.toFixed(2)} activities/day)`
      });
    }

    return trends;
  }

  /**
   * Detect anomaly patterns (unusual activity)
   */
  private async detectAnomalies(timeRange: { start: number; end: number }): Promise<TemporalPattern[]> {
    const anomalies: TemporalPattern[] = [];
    
    const windows = this.getTimeWindows(timeRange, 60 * 60 * 1000); // 1 hour windows
    const activities: number[] = [];
    
    for (const window of windows) {
      const count = await this.getActivityCount(window.start, window.end);
      activities.push(count);
    }

    if (activities.length < 10) {
      return anomalies;
    }

    // Calculate statistics
    const mean = activities.reduce((sum, val) => sum + val, 0) / activities.length;
    const variance = activities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / activities.length;
    const stdDev = Math.sqrt(variance);

    // Find anomalies (more than 2 standard deviations from mean)
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const zScore = Math.abs((activity - mean) / stdDev);
      
      if (zScore > 2) {
        const window = windows[i];
        const affectedNodes = await this.getNodesInTimeRange(window);
        
        anomalies.push({
          type: 'anomaly',
          timeframe: window.end - window.start,
          confidence: Math.min(1.0, zScore / 3),
          affectedNodes: affectedNodes.map(n => n.id),
          description: `Anomalous activity detected: ${activity} activities (${zScore.toFixed(1)}σ from mean)`
        });
      }
    }

    return anomalies;
  }

  // Helper methods for pattern detection
  private getTimeWindows(range: { start: number; end: number }, windowSize: number): Array<{ start: number; end: number }> {
    const windows: Array<{ start: number; end: number }> = [];
    let currentStart = range.start;
    
    while (currentStart < range.end) {
      const currentEnd = Math.min(currentStart + windowSize, range.end);
      windows.push({ start: currentStart, end: currentEnd });
      currentStart = currentEnd;
    }
    
    return windows;
  }

  private async getActivityCount(startTime: number, endTime: number): Promise<number> {
    const query = {
      id: uuidv4(),
      type: 'node' as const,
      filters: [
        { field: 'timestamp', operator: 'gte', value: startTime },
        { field: 'timestamp', operator: 'lte', value: endTime }
      ],
      constraints: []
    };

    const result = await this.db.queryNodes(query);
    return result.total;
  }

  private async getBaselineActivity(startTime: number, endTime: number): Promise<number> {
    // Calculate baseline from previous period
    const periodLength = endTime - startTime;
    const baselineStart = startTime - periodLength;
    const baselineEnd = startTime;
    
    return await this.getActivityCount(baselineStart, baselineEnd);
  }

  private async detectDailyPatterns(timeRange: { start: number; end: number }): Promise<TemporalPattern> {
    // Simplified daily pattern detection
    const dailyActivities: number[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (let day = timeRange.start; day < timeRange.end; day += dayMs) {
      const count = await this.getActivityCount(day, day + dayMs);
      dailyActivities.push(count);
    }

    if (dailyActivities.length < 3) {
      return { type: 'cycle', timeframe: dayMs, confidence: 0, affectedNodes: [], description: '' };
    }

    // Calculate consistency (lower variance = more consistent pattern)
    const mean = dailyActivities.reduce((sum, val) => sum + val, 0) / dailyActivities.length;
    const variance = dailyActivities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyActivities.length;
    const consistency = 1 / (1 + variance / (mean * mean));

    const affectedNodes = await this.getNodesInTimeRange(timeRange);

    return {
      type: 'cycle',
      timeframe: dayMs,
      confidence: consistency,
      affectedNodes: affectedNodes.map(n => n.id),
      description: `Daily activity pattern detected (${consistency.toFixed(2)} consistency)`
    };
  }

  private async detectWeeklyPatterns(timeRange: { start: number; end: number }): Promise<TemporalPattern> {
    // Similar to daily patterns but for weekly cycles
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weeklyActivities: number[] = [];
    
    for (let week = timeRange.start; week < timeRange.end; week += weekMs) {
      const count = await this.getActivityCount(week, week + weekMs);
      weeklyActivities.push(count);
    }

    if (weeklyActivities.length < 2) {
      return { type: 'cycle', timeframe: weekMs, confidence: 0, affectedNodes: [], description: '' };
    }

    const mean = weeklyActivities.reduce((sum, val) => sum + val, 0) / weeklyActivities.length;
    const variance = weeklyActivities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / weeklyActivities.length;
    const consistency = 1 / (1 + variance / (mean * mean));

    const affectedNodes = await this.getNodesInTimeRange(timeRange);

    return {
      type: 'cycle',
      timeframe: weekMs,
      confidence: consistency,
      affectedNodes: affectedNodes.map(n => n.id),
      description: `Weekly activity pattern detected (${consistency.toFixed(2)} consistency)`
    };
  }

  private calculateLinearTrend(values: number[]): { slope: number; correlation: number } {
    if (values.length < 2) {
      return { slope: 0, correlation: 0 };
    }

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices
    const sumYY = values.reduce((sum, val) => sum + (val * val), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator !== 0 ? numerator / denominator : 0;

    return { slope, correlation };
  }

  /**
   * Apply memory decay to clusters based on age
   */
  async applyDecay(): Promise<void> {
    try {
      const stmt = this.db['db'].prepare(`
        UPDATE temporal_clusters 
        SET density = density * ?, 
            confidence = confidence * ?,
            updated_at = ?
        WHERE updated_at < ?
      `);

      const decayFactor = 1 - this.config.decayRate;
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

      stmt.run(decayFactor, decayFactor, Date.now(), cutoffTime);
    } catch (error) {
      console.error('Failed to apply cluster decay:', error);
    }
  }

  /**
   * Clean up old clusters
   */
  async cleanup(): Promise<void> {
    try {
      const stmt = this.db['db'].prepare(`
        DELETE FROM temporal_clusters 
        WHERE confidence < ? OR updated_at < ?
      `);

      const minConfidence = 0.1;
      const maxAge = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago

      stmt.run(minConfidence, maxAge);
    } catch (error) {
      console.error('Failed to cleanup clusters:', error);
    }
  }
}

// Internal interface for temporal clusters
interface TemporalCluster {
  id: string;
  nodes: MemoryNode[];
  startTime: number;
  endTime: number;
  density: number;
  confidence: number;
  centroidNodeId: string;
}