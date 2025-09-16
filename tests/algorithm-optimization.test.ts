/**
 * Comprehensive test suite for algorithm optimization
 * Validates performance, correctness, and reliability of optimized components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import SpatialIndexManager from '../src/memory/graph/spatial-index';
import PatternRecognizer from '../src/navigation/pattern-recognizer';
import PerformanceMonitor from '../src/performance/monitoring-core';
import { MemoryNode, NavigationEvent } from '../types';

describe('Algorithm Optimization Suite', () => {
  describe('Spatial Index Performance', () => {
    let spatialIndex: SpatialIndexManager;

    beforeEach(async () => {
      spatialIndex = new SpatialIndexManager(':memory:');
      await spatialIndex.initialize();
    });

    afterEach(async () => {
      await spatialIndex.close();
    });

    it('should maintain sub-50ms query performance', async () => {
      // Insert test nodes
      const testNodes: MemoryNode[] = [];
      for (let i = 0; i < 1000; i++) {
        testNodes.push({
          id: `node_${i}`,
          type: 'activity',
          timestamp: Date.now() + (i * 1000),
          content: { test: `content_${i}` },
          metadata: {},
          relationships: [],
          relevanceScore: Math.random(),
          decayFactor: 0.95
        });
      }

      // Bulk insert with timing
      const insertStart = performance.now();
      for (const node of testNodes) {
        await spatialIndex.insertNode(node);
      }
      const insertTime = performance.now() - insertStart;
      console.log(`Bulk insert time: ${insertTime.toFixed(2)}ms`);

      // Test query performance
      const queryTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const queryStart = performance.now();
        const results = await spatialIndex.spatialQuery({
          center: { x: i * 10, y: i * 10 },
          radius: 50,
          limit: 10
        });
        const queryTime = performance.now() - queryStart;
        queryTimes.push(queryTime);
        
        expect(Array.isArray(results)).toBe(true);
      }

      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const p95QueryTime = queryTimes.sort((a, b) => a - b)[Math.floor(queryTimes.length * 0.95)];
      
      console.log(`Average query time: ${avgQueryTime.toFixed(2)}ms`);
      console.log(`P95 query time: ${p95QueryTime.toFixed(2)}ms`);
      
      expect(avgQueryTime).toBeLessThan(50);
      expect(p95QueryTime).toBeLessThan(50);
    });

    it('should handle 100K+ nodes efficiently', async () => {
      // Test scalability
      const largeNodeSet: MemoryNode[] = [];
      for (let i = 0; i < 100000; i++) {
        largeNodeSet.push({
          id: `large_node_${i}`,
          type: i % 2 === 0 ? 'activity' : 'pattern',
          timestamp: Date.now() + (i * 100),
          content: { data: `large_content_${i}` },
          metadata: { category: i % 10 },
          relationships: [],
          relevanceScore: Math.random(),
          decayFactor: 0.95
        });
      }

      // Insert in batches to avoid memory issues
      const batchSize = 1000;
      const insertTimes: number[] = [];
      
      for (let i = 0; i < largeNodeSet.length; i += batchSize) {
        const batch = largeNodeSet.slice(i, i + batchSize);
        const batchStart = performance.now();
        
        for (const node of batch) {
          await spatialIndex.insertNode(node);
        }
        
        const batchTime = performance.now() - batchStart;
        insertTimes.push(batchTime);
      }

      const avgBatchTime = insertTimes.reduce((a, b) => a + b, 0) / insertTimes.length;
      console.log(`Average batch insert time: ${avgBatchTime.toFixed(2)}ms`);

      // Test query performance on large dataset
      const queryStart = performance.now();
      const results = await spatialIndex.spatialQuery({
        center: { x: 50000, y: 50000 },
        radius: 1000,
        limit: 50
      });
      const queryTime = performance.now() - queryStart;
      
      console.log(`Large dataset query time: ${queryTime.toFixed(2)}ms`);
      console.log(`Results returned: ${results.length}`);
      
      expect(queryTime).toBeLessThan(100); // Slightly relaxed for large dataset
    });
  });

  describe('Pattern Recognition Performance', () => {
    let patternRecognizer: PatternRecognizer;

    beforeEach(() => {
      patternRecognizer = new PatternRecognizer();
    });

    it('should maintain <3ms average processing time', async () => {
      const processingTimes: number[] = [];
      const testEvents: NavigationEvent[] = [];

      // Generate test navigation events
      for (let i = 0; i < 1000; i++) {
        testEvents.push({
          id: `nav_${i}`,
          url: `https://example${i % 10}.com/page${i}`,
          referrer: i > 0 ? `https://example${(i-1) % 10}.com/page${i-1}` : undefined,
          timestamp: Date.now() + (i * 1000),
          duration: Math.random() * 30000 + 5000,
          type: 'navigation'
        });
      }

      // Process events with timing
      for (const event of testEvents) {
        const processStart = performance.now();
        await patternRecognizer.processNavigation(event);
        const processTime = performance.now() - processStart;
        processingTimes.push(processTime);
      }

      const avgProcessTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const p95ProcessTime = processingTimes.sort((a, b) => a - b)[Math.floor(processingTimes.length * 0.95)];
      
      console.log(`Average processing time: ${avgProcessTime.toFixed(2)}ms`);
      console.log(`P95 processing time: ${p95ProcessTime.toFixed(2)}ms`);
      
      expect(avgProcessTime).toBeLessThan(3);
      expect(p95ProcessTime).toBeLessThan(5);
    });

    it('should achieve >80% prediction accuracy', async () => {
      // Create training data with patterns
      const trainingEvents: NavigationEvent[] = [];
      
      // Create sequential patterns
      for (let i = 0; i < 50; i++) {
        trainingEvents.push({
          id: `seq_${i}_1`,
          url: 'https://example.com/search',
          referrer: undefined,
          timestamp: Date.now() + (i * 60000),
          type: 'search'
        });
        
        trainingEvents.push({
          id: `seq_${i}_2`,
          url: 'https://example.com/results',
          referrer: 'https://example.com/search',
          timestamp: Date.now() + (i * 60000) + 5000,
          type: 'navigation'
        });
        
        trainingEvents.push({
          id: `seq_${i}_3`,
          url: 'https://example.com/detail',
          referrer: 'https://example.com/results',
          timestamp: Date.now() + (i * 60000) + 10000,
          type: 'navigation'
        });
      }

      // Train the recognizer
      for (const event of trainingEvents) {
        await patternRecognizer.processNavigation(event);
      }

      // Test prediction accuracy
      let correctPredictions = 0;
      let totalPredictions = 0;

      for (let i = 0; i < 20; i++) {
        const predictions = patternRecognizer.predictNextNavigation(
          'https://example.com/search',
          { timeOfDay: 14, sessionDuration: 30000 }
        );
        
        if (predictions.length > 0) {
          totalPredictions++;
          const topPrediction = predictions[0];
          
          // Check if prediction matches expected pattern
          if (topPrediction.targetUrl.includes('results') || 
              topPrediction.targetUrl.includes('detail')) {
            correctPredictions++;
          }
        }
      }

      const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
      console.log(`Prediction accuracy: ${accuracy.toFixed(2)}%`);
      
      expect(accuracy).toBeGreaterThan(80);
    });
  });

  describe('Performance Monitoring Overhead', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor({
        sampleRate: 1.0,
        alertThresholds: {
          cpu: 5.0,
          memory: 600,
          latency: 75
        },
        enableRealTimeAlerts: false
      });
    });

    afterEach(() => {
      monitor.dispose();
    });

    it('should maintain <1% CPU overhead', async () => {
      // Monitor monitoring overhead
      const monitoringOverhead: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const beforeCpu = monitor.getCurrentMetrics().cpu.usage;
        
        // Simulate some system load
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const afterCpu = monitor.getCurrentMetrics().cpu.usage;
        const overhead = afterCpu - beforeCpu;
        monitoringOverhead.push(overhead);
      }

      const avgOverhead = monitoringOverhead.reduce((a, b) => a + b, 0) / monitoringOverhead.length;
      console.log(`Average monitoring overhead: ${avgOverhead.toFixed(3)}%`);
      
      expect(avgOverhead).toBeLessThan(1.0);
    });

    it('should detect performance anomalies accurately', async () => {
      // Inject some anomalous data points
      const normalMetrics = monitor.getCurrentMetrics();
      
      // Simulate CPU spike
      normalMetrics.cpu.usage = 15.0; // Well above normal
      normalMetrics.memory.used = 800; // Above threshold
      
      // Wait for monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const alerts = monitor.getActiveAlerts();
      const cpuAlerts = alerts.filter(a => a.type === 'cpu');
      const memoryAlerts = alerts.filter(a => a.type === 'memory');
      
      console.log(`CPU alerts generated: ${cpuAlerts.length}`);
      console.log(`Memory alerts generated: ${memoryAlerts.length}`);
      
      expect(cpuAlerts.length).toBeGreaterThan(0);
      expect(memoryAlerts.length).toBeGreaterThan(0);
      
      // Check alert severity
      expect(cpuAlerts.some(a => a.severity === 'warning' || a.severity === 'error')).toBe(true);
      expect(memoryAlerts.some(a => a.severity === 'error')).toBe(true);
    });

    it('should maintain accurate health scoring', async () => {
      // Test various health scenarios
      const scenarios = [
        { cpu: 1.0, memory: 200, latency: 25, expectedHealth: 100 },
        { cpu: 4.0, memory: 500, latency: 45, expectedHealth: 85 },
        { cpu: 6.0, memory: 700, latency: 60, expectedHealth: 50 },
        { cpu: 10.0, memory: 900, latency: 100, expectedHealth: 20 }
      ];

      for (const scenario of scenarios) {
        // Set up scenario conditions
        const currentMetrics = monitor.getCurrentMetrics();
        currentMetrics.cpu.usage = scenario.cpu;
        currentMetrics.memory.used = scenario.memory;
        currentMetrics.latency.average = scenario.latency;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const summary = monitor.getPerformanceSummary();
        console.log(`Scenario CPU:${scenario.cpu}% Memory:${scenario.memory}MB -> Health: ${summary.healthScore}`);
        
        expect(summary.healthScore).toBeGreaterThanOrEqual(scenario.expectedHealth - 10);
        expect(summary.healthScore).toBeLessThanOrEqual(scenario.expectedHealth + 10);
      }
    });
  });

  describe('Memory Efficiency Tests', () => {
    it('should maintain memory usage under 512MB', async () => {
      // Test memory usage with multiple components
      const components = [
        new SpatialIndexManager(':memory:'),
        new PatternRecognizer(),
        new PerformanceMonitor()
      ];

      // Initialize all components
      await (components[0] as SpatialIndexManager).initialize();

      // Simulate load
      for (let i = 0; i < 10000; i++) {
        const event: NavigationEvent = {
          id: `mem_test_${i}`,
          url: `https://test${i}.com/page`,
          timestamp: Date.now() + (i * 100),
          type: 'navigation'
        };
        
        (components[1] as PatternRecognizer).processNavigation(event);
        
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // Check memory usage
      const monitor = components[2] as PerformanceMonitor;
      const metrics = monitor.getCurrentMetrics();
      
      console.log(`Memory usage: ${metrics.memory.used}MB`);
      console.log(`Memory percentage: ${metrics.memory.percentage}%`);
      
      expect(metrics.memory.used).toBeLessThan(512);
      expect(metrics.memory.percentage).toBeLessThan(80);

      // Cleanup
      await (components[0] as SpatialIndexManager).close();
      components.forEach(comp => {
        if ('dispose' in comp) {
          (comp as any).dispose();
        }
      });
    });
  });

  describe('Integration Performance Tests', () => {
    it('should handle concurrent operations efficiently', async () => {
      const spatialIndex = new SpatialIndexManager(':memory:');
      await spatialIndex.initialize();
      const patternRecognizer = new PatternRecognizer();
      const monitor = new PerformanceMonitor();

      // Simulate concurrent workload
      const concurrentOperations = Array(50).fill(0).map(async (_, i) => {
        // Spatial operations
        await spatialIndex.insertNode({
          id: `concurrent_node_${i}`,
          type: 'activity',
          timestamp: Date.now() + i,
          content: { data: `concurrent_${i}` },
          metadata: {},
          relationships: [],
          relevanceScore: Math.random(),
          decayFactor: 0.95
        });

        // Pattern recognition operations
        await patternRecognizer.processNavigation({
          id: `concurrent_nav_${i}`,
          url: `https://concurrent${i}.com/page`,
          timestamp: Date.now() + i,
          type: 'navigation'
        });

        // Query operations
        return spatialIndex.spatialQuery({
          center: { x: i, y: i },
          radius: 10,
          limit: 5
        });
      });

      const startTime = performance.now();
      await Promise.all(concurrentOperations);
      const totalTime = performance.now() - startTime;
      
      console.log(`Concurrent operations time: ${totalTime.toFixed(2)}ms`);
      console.log(`Average per operation: ${(totalTime / 50).toFixed(2)}ms`);

      // Check that performance remained acceptable
      const finalMetrics = monitor.getCurrentMetrics();
      console.log(`Final CPU: ${finalMetrics.cpu.usage}%`);
      console.log(`Final Memory: ${finalMetrics.memory.used}MB`);
      
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 50 operations
      expect(finalMetrics.cpu.usage).toBeLessThan(10);
      expect(finalMetrics.memory.used).toBeLessThan(600);

      // Cleanup
      await spatialIndex.close();
      patternRecognizer.dispose();
      monitor.dispose();
    });
  });
});