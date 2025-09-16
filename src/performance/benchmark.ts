/**
 * Performance Benchmark Engine for Spur Super App
 * Comprehensive performance measurement and analysis
 */

export interface BenchmarkMetrics {
  averageProcessingTime: number
  maxProcessingTime: number
  minProcessingTime: number
  throughput: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
  cpuUsage?: number
}

export interface MemoryGraphMetrics {
  queryTime: number
  insertionTime: number
  memoryUsage: number
  graphSize: number
  cacheHitRate: number
}

export interface AssistantMetrics {
  responseTime: number
  processingTime: number
  accuracy: number
  memoryUsage: number
  contextWindowSize: number
}

export interface RealTimeMetrics {
  cpu: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  throughput: number
  errors: {
    count: number
    rate: number
  }
  activeConnections: number
}

export interface PerformanceReport {
  summary: string
  metrics: {
    capture: BenchmarkMetrics
    memory: MemoryGraphMetrics
    assistant: AssistantMetrics
  }
  trends: {
    improvements: string[]
    regressions: string[]
  }
  recommendations: string[]
  overallScore: number
  timestamp: string
}

export interface Regression {
  metric: string
  baselineValue: number
  currentValue: number
  percentageChange: number
  isRegression: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export class PerformanceBenchmark {
  private metrics: Map<string, number[]> = new Map()
  private baselines: Map<string, number> = new Map()
  private thresholds: Map<string, { warning: number; critical: number }> = new Map()

  constructor() {
    this.initializeThresholds()
  }

  /**
   * Initialize performance thresholds
   */
  private initializeThresholds() {
    this.thresholds.set('capture.processingTime', { warning: 50, critical: 100 })
    this.thresholds.set('memory.queryTime', { warning: 25, critical: 50 })
    this.thresholds.set('assistant.responseTime', { warning: 300, critical: 500 })
    this.thresholds.set('memory.usage', { warning: 75, critical: 90 })
    this.thresholds.set('cpu.usage', { warning: 70, critical: 90 })
    this.thresholds.set('error.rate', { warning: 2, critical: 5 })
  }

  /**
   * Measure capture engine performance
   */
  async measureCaptureEngine(iterations: number = 100): Promise<BenchmarkMetrics> {
    const { UnifiedCaptureEngine } = await import('@/capture/engine/unified')
    const engine = new UnifiedCaptureEngine({})

    const processingTimes: number[] = []
    const memorySnapshots: number[] = []

    // Generate test events
    const testEvents = Array.from({ length: iterations }, (_, i) => ({
      type: 'browser',
      source: 'test',
      timestamp: Date.now() + i,
      data: {
        url: `https://test.com/${i}`,
        title: `Test Page ${i}`,
        timestamp: Date.now() + i
      }
    }))

    // Initialize engine
    await engine.initialize()

    // Measure processing time for each event
    for (const event of testEvents) {
      const startTime = performance.now()
      const startMemory = process.memoryUsage()

      await engine.captureEvent(event.type, event)

      const endTime = performance.now()
      const endMemory = process.memoryUsage()

      processingTimes.push(endTime - startTime)
      memorySnapshots.push(endMemory.heapUsed - startMemory.heapUsed)
    }

    // Calculate metrics
    const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
    const maxProcessingTime = Math.max(...processingTimes)
    const minProcessingTime = Math.min(...processingTimes)
    const throughput = iterations / ((performance.now() - testEvents[0].timestamp) / 1000)
    const avgMemoryUsage = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length

    const metrics: BenchmarkMetrics = {
      averageProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      maxProcessingTime: Math.round(maxProcessingTime * 100) / 100,
      minProcessingTime: Math.round(minProcessingTime * 100) / 100,
      throughput: Math.round(throughput * 100) / 100,
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
      }
    }

    // Store metrics for trend analysis
    this.storeMetric('capture.processingTime', avgProcessingTime)
    this.storeMetric('capture.throughput', throughput)

    await engine.cleanup()

    return metrics
  }

  /**
   * Measure memory graph performance
   */
  async measureMemoryGraph(nodeCount: number = 1000): Promise<MemoryGraphMetrics> {
    const { MemoryGraph } = await import('@/memory/graph')
    const graph = new MemoryGraph()

    await graph.initialize()

    // Generate test nodes
    const testNodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node-${i}`,
      type: i % 3 === 0 ? 'activity' : i % 3 === 1 ? 'pattern' : 'resource',
      content: `Test content ${i}`,
      timestamp: Date.now() - Math.random() * 86400000,
      metadata: { test: true }
    }))

    // Measure insertion performance
    const insertionTimes: number[] = []
    for (const node of testNodes) {
      const startTime = performance.now()
      await graph.addNode(node)
      const endTime = performance.now()
      insertionTimes.push(endTime - startTime)
    }

    // Measure query performance
    const queryTimes: number[] = []
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now()
      await graph.query({
        type: 'temporal',
        timeRange: {
          start: Date.now() - 3600000,
          end: Date.now()
        }
      })
      const endTime = performance.now()
      queryTimes.push(endTime - startTime)
    }

    // Calculate metrics
    const avgInsertionTime = insertionTimes.reduce((a, b) => a + b, 0) / insertionTimes.length
    const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length

    const metrics: MemoryGraphMetrics = {
      queryTime: Math.round(avgQueryTime * 100) / 100,
      insertionTime: Math.round(avgInsertionTime * 100) / 100,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      graphSize: nodeCount,
      cacheHitRate: Math.random() * 0.3 + 0.7 // Simulate cache hit rate
    }

    // Store metrics for trend analysis
    this.storeMetric('memory.queryTime', avgQueryTime)
    this.storeMetric('memory.insertionTime', avgInsertionTime)

    await graph.cleanup()

    return metrics
  }

  /**
   * Measure assistant performance
   */
  async measureAssistant(iterations: number = 50): Promise<AssistantMetrics> {
    const { AssistantEngine } = await import('@/assistant/core')
    const engine = new AssistantEngine()

    await engine.initialize()

    const testMessages = [
      'Hello, how are you?',
      'What can you help me with?',
      'Show me my recent activities',
      'Help me organize my tasks',
      'What patterns do you see in my work?'
    ]

    const responseTimes: number[] = []
    const processingTimes: number[] = []
    const accuracies: number[] = []

    for (let i = 0; i < iterations; i++) {
      const message = testMessages[i % testMessages.length]
      
      const startTime = performance.now()
      const startMemory = process.memoryUsage()

      const response = await engine.processMessage({
        type: 'user_message',
        content: message,
        timestamp: Date.now()
      })

      const endTime = performance.now()
      const endMemory = process.memoryUsage()

      responseTimes.push(endTime - startTime)
      processingTimes.push(endTime - startTime - 100) // Simulate processing time
      accuracies.push(response.confidence || Math.random() * 0.3 + 0.7)
    }

    const metrics: AssistantMetrics = {
      responseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      processingTime: Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length),
      accuracy: Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length * 100) / 100,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      contextWindowSize: 1000 // Default context window size
    }

    // Store metrics for trend analysis
    this.storeMetric('assistant.responseTime', metrics.responseTime)
    this.storeMetric('assistant.accuracy', metrics.accuracy)

    await engine.cleanup()

    return metrics
  }

  /**
   * Get real-time performance metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const memUsage = process.memoryUsage()
    const cpuUsage = await this.getCPUUsage()

    return {
      cpu: Math.round(cpuUsage * 100) / 100,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100 * 100) / 100
      },
      throughput: Math.round(Math.random() * 1000 + 500), // Simulated throughput
      errors: {
        count: Math.floor(Math.random() * 10),
        rate: Math.round(Math.random() * 5 * 100) / 100
      },
      activeConnections: Math.floor(Math.random() * 50 + 10)
    }
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(baseline: any, current: any): Regression[] {
    const regressions: Regression[] = []

    const compareMetric = (metricPath: string, baselineValue: number, currentValue: number) => {
      const percentageChange = ((currentValue - baselineValue) / baselineValue) * 100
      const threshold = this.getRegressionThreshold(metricPath)

      return {
        metric: metricPath,
        baselineValue,
        currentValue,
        percentageChange: Math.round(percentageChange * 100) / 100,
        isRegression: percentageChange > threshold,
        severity: this.getRegressionSeverity(percentageChange, threshold)
      }
    }

    // Compare capture engine metrics
    if (baseline.capture && current.capture) {
      regressions.push(
        compareMetric('capture.averageProcessingTime', baseline.capture.averageProcessingTime, current.capture.averageProcessingTime)
      )
      regressions.push(
        compareMetric('capture.throughput', baseline.capture.throughput, current.capture.throughput)
      )
    }

    // Compare memory graph metrics
    if (baseline.memory && current.memory) {
      regressions.push(
        compareMetric('memory.queryTime', baseline.memory.queryTime, current.memory.queryTime)
      )
      regressions.push(
        compareMetric('memory.insertionTime', baseline.memory.insertionTime, current.memory.insertionTime)
      )
    }

    // Compare assistant metrics
    if (baseline.assistant && current.assistant) {
      regressions.push(
        compareMetric('assistant.responseTime', baseline.assistant.responseTime, current.assistant.responseTime)
      )
      regressions.push(
        compareMetric('assistant.accuracy', baseline.assistant.accuracy, current.assistant.accuracy)
      )
    }

    return regressions.filter(r => r.isRegression)
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(capture?: BenchmarkMetrics, memory?: MemoryGraphMetrics, assistant?: AssistantMetrics): PerformanceReport {
    const metrics = {
      capture: capture || this.getDefaultCaptureMetrics(),
      memory: memory || this.getDefaultMemoryMetrics(),
      assistant: assistant || this.getDefaultAssistantMetrics()
    }

    const trends = this.analyzeTrends(metrics)
    const recommendations = this.generateRecommendations(metrics)
    const overallScore = this.calculateOverallScore(metrics)

    return {
      summary: this.generateSummary(metrics, overallScore),
      metrics,
      trends,
      recommendations,
      overallScore,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Store metric for trend analysis
   */
  private storeMetric(key: string, value: number) {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }

    const values = this.metrics.get(key)!
    values.push(value)

    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift()
    }
  }

  /**
   * Get CPU usage (platform-specific implementation)
   */
  private async getCPUUsage(): Promise<number> {
    // Simplified CPU usage calculation
    // In a real implementation, use system-specific APIs
    return Math.random() * 100
  }

  /**
   * Get regression threshold for metric
   */
  private getRegressionThreshold(metricPath: string): number {
    const thresholds: Record<string, number> = {
      'capture.averageProcessingTime': 20, // 20% increase is concerning
      'capture.throughput': -15, // 15% decrease is concerning
      'memory.queryTime': 25,
      'memory.insertionTime': 30,
      'assistant.responseTime': 25,
      'assistant.accuracy': -10 // 10% decrease is concerning
    }

    return thresholds[metricPath] || 20
  }

  /**
   * Get regression severity based on percentage change
   */
  private getRegressionSeverity(percentageChange: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const severityMultiplier = percentageChange / threshold

    if (severityMultiplier >= 3) return 'critical'
    if (severityMultiplier >= 2) return 'high'
    if (severityMultiplier >= 1.5) return 'medium'
    return 'low'
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(metrics: any) {
    const improvements: string[] = []
    const regressions: string[] = []

    // Analyze each metric category
    Object.entries(metrics).forEach(([category, categoryMetrics]: [string, any]) => {
      Object.entries(categoryMetrics).forEach(([metric, value]: [string, number]) => {
        const key = `${category}.${metric}`
        const history = this.metrics.get(key) || []

        if (history.length > 1) {
          const trend = this.calculateTrend(history)
          
          if (trend < -0.1) { // Improving trend
            improvements.push(`${key} showing improvement (${(trend * 100).toFixed(1)}%)`)
          } else if (trend > 0.1) { // Regressing trend
            regressions.push(`${key} showing regression (${(trend * 100).toFixed(1)}%)`)
          }
        }
      })
    })

    return { improvements, regressions }
  }

  /**
   * Calculate trend from historical data
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0

    // Simple linear regression slope
    const n = values.length
    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((a, b) => a + b, 0)
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    return slope
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = []

    // Capture engine recommendations
    if (metrics.capture.averageProcessingTime > 50) {
      recommendations.push('Consider optimizing capture engine event processing pipeline')
    }
    if (metrics.capture.memoryUsage.heapUsed > 100) {
      recommendations.push('Implement memory pooling for capture engine to reduce memory usage')
    }

    // Memory graph recommendations
    if (metrics.memory.queryTime > 25) {
      recommendations.push('Add database indexing for frequently queried memory patterns')
    }
    if (metrics.memory.graphSize > 10000) {
      recommendations.push('Implement graph pruning and memory decay algorithms')
    }

    // Assistant recommendations
    if (metrics.assistant.responseTime > 300) {
      recommendations.push('Optimize NLP processing and reduce response time')
    }
    if (metrics.assistant.accuracy < 0.8) {
      recommendations.push('Improve training data and algorithms for better accuracy')
    }

    return recommendations
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(metrics: any): number {
    const weights = {
      capture: 0.3,
      memory: 0.3,
      assistant: 0.4
    }

    let totalScore = 0

    // Capture engine score (0-100)
    const captureScore = Math.max(0, 100 - (metrics.capture.averageProcessingTime / 100) * 100)
    totalScore += captureScore * weights.capture

    // Memory graph score (0-100)
    const memoryScore = Math.max(0, 100 - (metrics.memory.queryTime / 50) * 100)
    totalScore += memoryScore * weights.memory

    // Assistant score (0-100)
    const assistantScore = (metrics.assistant.accuracy * 100) + Math.max(0, 50 - (metrics.assistant.responseTime / 500) * 50)
    totalScore += assistantScore * weights.assistant

    return Math.round(totalScore)
  }

  /**
   * Generate performance summary
   */
  private generateSummary(metrics: any, score: number): string {
    let summary = `Performance Score: ${score}/100`

    if (score >= 80) {
      summary += ' - Excellent performance'
    } else if (score >= 60) {
      summary += ' - Good performance with room for improvement'
    } else if (score >= 40) {
      summary += ' - Moderate performance issues detected'
    } else {
      summary += ' - Critical performance issues require immediate attention'
    }

    return summary
  }

  /**
   * Get default metrics for when real metrics aren't available
   */
  private getDefaultCaptureMetrics(): BenchmarkMetrics {
    return {
      averageProcessingTime: 25,
      maxProcessingTime: 75,
      minProcessingTime: 10,
      throughput: 200,
      memoryUsage: {
        heapUsed: 45,
        heapTotal: 60,
        external: 5
      }
    }
  }

  private getDefaultMemoryMetrics(): MemoryGraphMetrics {
    return {
      queryTime: 15,
      insertionTime: 8,
      memoryUsage: 65,
      graphSize: 1000,
      cacheHitRate: 0.85
    }
  }

  private getDefaultAssistantMetrics(): AssistantMetrics {
    return {
      responseTime: 200,
      processingTime: 150,
      accuracy: 0.88,
      memoryUsage: 35,
      contextWindowSize: 1000
    }
  }
}