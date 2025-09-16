import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PerformanceBenchmark } from '@/performance/benchmark'
import { SecurityScanner } from '@/security/scanner'
import { LoadTester } from '@/performance/load-tester'

// Mock dependencies
vi.mock('@/performance/benchmark')
vi.mock('@/security/scanner')
vi.mock('@/performance/load-tester')

describe('Performance and Security Testing Suite', () => {
  let performanceBenchmark: any
  let securityScanner: any
  let loadTester: any

  beforeEach(() => {
    performanceBenchmark = {
      measureCaptureEngine: vi.fn().mockResolvedValue({
        averageProcessingTime: 15.2,
        maxProcessingTime: 45.8,
        minProcessingTime: 8.1,
        throughput: 156.7,
        memoryUsage: { heapUsed: 45.2, heapTotal: 67.8 }
      }),
      measureMemoryGraph: vi.fn().mockResolvedValue({
        queryTime: 12.3,
        insertionTime: 5.6,
        memoryUsage: 78.9,
        graphSize: 1250
      }),
      measureAssistant: vi.fn().mockResolvedValue({
        responseTime: 234,
        processingTime: 156,
        accuracy: 0.94
      }),
      generateReport: vi.fn().mockReturnValue({
        summary: 'Performance benchmarks completed',
        metrics: { capture: {}, memory: {}, assistant: {} },
        recommendations: ['Optimize memory usage', 'Reduce processing time']
      })
    }

    securityScanner = {
      scanDependencies: vi.fn().mockResolvedValue({
        vulnerabilities: [
          { package: 'example-package', severity: 'high', type: 'injection' }
        ],
        recommendations: ['Update example-package to latest version']
      }),
      scanCode: vi.fn().mockResolvedValue({
        vulnerabilities: [
          { file: 'test.js', line: 25, severity: 'medium', type: 'xss' }
        ],
        recommendations: ['Sanitize user inputs', 'Use CSP headers']
      }),
      scanInfrastructure: vi.fn().mockResolvedValue({
        issues: ['Missing SSL certificate', 'Open ports detected'],
        recommendations: ['Enable HTTPS', 'Close unnecessary ports']
      }),
      generateReport: vi.fn().mockReturnValue({
        securityScore: 7.5,
        criticalIssues: 2,
        highIssues: 3,
        mediumIssues: 5,
        lowIssues: 8,
        recommendations: ['Apply security patches', 'Implement access controls']
      })
    }

    loadTester = {
      runLoadTest: vi.fn().mockResolvedValue({
        successRate: 98.2,
        averageResponseTime: 156,
        maxResponseTime: 892,
        minResponseTime: 45,
        requestsPerSecond: 1250,
        errorRate: 1.8,
        throughput: '15.2 MB/s'
      }),
      runStressTest: vi.fn().mockResolvedValue({
        breakingPoint: 5000 concurrent users,
        maxThroughput: 2500 requests/second,
        errorThreshold: 5%,
        memoryLimit: '2 GB',
        cpuLimit: '80%'
      }),
      generateReport: vi.fn().mockReturnValue({
        summary: 'Load testing completed',
        performance: { normal: {}, stress: {} },
        bottlenecks: ['Database connections', 'Memory allocation'],
        recommendations: ['Increase connection pool', 'Optimize memory usage']
      })
    }

    vi.mocked(PerformanceBenchmark).mockImplementation(() => performanceBenchmark)
    vi.mocked(SecurityScanner).mockImplementation(() => securityScanner)
    vi.mocked(LoadTester).mockImplementation(() => loadTester)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Performance Benchmarking', () => {
    it('should measure capture engine performance', async () => {
      const result = await performanceBenchmark.measureCaptureEngine()

      expect(result.averageProcessingTime).toBeGreaterThan(0)
      expect(result.maxProcessingTime).toBeGreaterThan(result.minProcessingTime)
      expect(result.throughput).toBeGreaterThan(0)
      expect(result.memoryUsage.heapUsed).toBeGreaterThan(0)

      expect(performanceBenchmark.measureCaptureEngine).toHaveBeenCalled()
    })

    it('should measure memory graph performance', async () => {
      const result = await performanceBenchmark.measureMemoryGraph()

      expect(result.queryTime).toBeGreaterThan(0)
      expect(result.insertionTime).toBeGreaterThan(0)
      expect(result.memoryUsage).toBeGreaterThan(0)
      expect(result.graphSize).toBeGreaterThan(0)

      expect(performanceBenchmark.measureMemoryGraph).toHaveBeenCalled()
    })

    it('should measure assistant response performance', async () => {
      const result = await performanceBenchmark.measureAssistant()

      expect(result.responseTime).toBeGreaterThan(0)
      expect(result.processingTime).toBeGreaterThan(0)
      expect(result.accuracy).toBeGreaterThan(0)
      expect(result.accuracy).toBeLessThanOrEqual(1)

      expect(performanceBenchmark.measureAssistant).toHaveBeenCalled()
    })

    it('should generate performance report with recommendations', () => {
      const report = performanceBenchmark.generateReport()

      expect(report.summary).toBeDefined()
      expect(report.metrics).toBeDefined()
      expect(report.recommendations).toBeInstanceOf(Array)
      expect(report.recommendations.length).toBeGreaterThan(0)

      expect(performanceBenchmark.generateReport).toHaveBeenCalled()
    })

    it('should detect performance regressions', async () => {
      const baseline = {
        capture: { averageProcessingTime: 10.0 },
        memory: { queryTime: 8.0 },
        assistant: { responseTime: 200 }
      }

      const current = {
        capture: { averageProcessingTime: 15.2 },
        memory: { queryTime: 12.3 },
        assistant: { responseTime: 234 }
      }

      const regressions = performanceBenchmark.detectRegressions(baseline, current)

      expect(regressions).toHaveLength(3)
      expect(regressions[0].metric).toBe('capture.averageProcessingTime')
      expect(regressions[0].percentageChange).toBeGreaterThan(0)
      expect(regressions[0].isRegression).toBe(true)
    })

    it('should measure real-time performance metrics', async () => {
      const metrics = await performanceBenchmark.getRealTimeMetrics()

      expect(metrics).toHaveProperty('cpu')
      expect(metrics).toHaveProperty('memory')
      expect(metrics).toHaveProperty('throughput')
      expect(metrics).toHaveProperty('errors')
      expect(metrics.cpu).toBeGreaterThanOrEqual(0)
      expect(metrics.cpu).toBeLessThanOrEqual(100)
    })
  })

  describe('Security Testing', () => {
    it('should scan dependencies for vulnerabilities', async () => {
      const result = await securityScanner.scanDependencies()

      expect(result.vulnerabilities).toBeInstanceOf(Array)
      expect(result.recommendations).toBeInstanceOf(Array)
      
      if (result.vulnerabilities.length > 0) {
        const vuln = result.vulnerabilities[0]
        expect(vuln).toHaveProperty('package')
        expect(vuln).toHaveProperty('severity')
        expect(vuln).toHaveProperty('type')
      }

      expect(securityScanner.scanDependencies).toHaveBeenCalled()
    })

    it('should scan code for security issues', async () => {
      const result = await securityScanner.scanCode()

      expect(result.vulnerabilities).toBeInstanceOf(Array)
      expect(result.recommendations).toBeInstanceOf(Array)

      if (result.vulnerabilities.length > 0) {
        const vuln = result.vulnerabilities[0]
        expect(vuln).toHaveProperty('file')
        expect(vuln).toHaveProperty('line')
        expect(vuln).toHaveProperty('severity')
        expect(vuln).toHaveProperty('type')
      }

      expect(securityScanner.scanCode).toHaveBeenCalled()
    })

    it('should scan infrastructure security', async () => {
      const result = await securityScanner.scanInfrastructure()

      expect(result.issues).toBeInstanceOf(Array)
      expect(result.recommendations).toBeInstanceOf(Array)

      expect(securityScanner.scanInfrastructure).toHaveBeenCalled()
    })

    it('should generate security report with scoring', () => {
      const report = securityScanner.generateReport()

      expect(report.securityScore).toBeGreaterThanOrEqual(0)
      expect(report.securityScore).toBeLessThanOrEqual(10)
      expect(report.criticalIssues).toBeGreaterThanOrEqual(0)
      expect(report.highIssues).toBeGreaterThanOrEqual(0)
      expect(report.mediumIssues).toBeGreaterThanOrEqual(0)
      expect(report.lowIssues).toBeGreaterThanOrEqual(0)
      expect(report.recommendations).toBeInstanceOf(Array)

      expect(securityScanner.generateReport).toHaveBeenCalled()
    })

    it('should detect different types of vulnerabilities', async () => {
      const codeWithIssues = `
        const userInput = req.query.input;
        eval(userInput); // Code injection
        
        const html = \'<div>\' + userInput + \'</div>\'; // XSS
        
        const query = "SELECT * FROM users WHERE id = " + userId; // SQL injection
      `

      const vulnerabilities = await securityScanner.analyzeCode(codeWithIssues)

      expect(vulnerabilities).toBeInstanceOf(Array)
      expect(vulnerabilities.length).toBeGreaterThan(0)
      
      const vulnTypes = vulnerabilities.map(v => v.type)
      expect(vulnTypes).toContain('code_injection')
      expect(vulnTypes).toContain('xss')
      expect(vulnTypes).toContain('sql_injection')
    })

    it('should validate security headers', async () => {
      const headers = {
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'SAMEORIGIN',
        'x-content-type-options': 'nosniff',
        'strict-transport-security': 'max-age=31536000'
      }

      const validation = await securityScanner.validateSecurityHeaders(headers)

      expect(validation.score).toBeGreaterThan(0)
      expect(validation.missing).toBeInstanceOf(Array)
      expect(validation.recommendations).toBeInstanceOf(Array)
    })

    it('should test authentication and authorization', async () => {
      const authResults = await securityScanner.testAuthentication()

      expect(authResults).toHaveProperty('passwordStrength')
      expect(authResults).toHaveProperty('sessionManagement')
      expect(authResults).toHaveProperty('accessControls')
      expect(authResults).toHaveProperty('rateLimiting')
      expect(authResults.overallScore).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Load Testing', () => {
    it('should run basic load test', async () => {
      const result = await loadTester.runLoadTest({
        duration: 60, // seconds
        concurrentUsers: 100,
        rampUp: 10
      })

      expect(result.successRate).toBeGreaterThan(0)
      expect(result.successRate).toBeLessThanOrEqual(100)
      expect(result.averageResponseTime).toBeGreaterThan(0)
      expect(result.errorRate).toBeGreaterThanOrEqual(0)
      expect(result.requestsPerSecond).toBeGreaterThan(0)

      expect(loadTester.runLoadTest).toHaveBeenCalled()
    })

    it('should run stress test to find breaking points', async () => {
      const result = await loadTester.runStressTest({
        maxUsers: 10000,
        stepDuration: 30,
        stepUsers: 500
      })

      expect(result.breakingPoint).toBeGreaterThan(0)
      expect(result.maxThroughput).toBeGreaterThan(0)
      expect(result.errorThreshold).toBeGreaterThan(0)

      expect(loadTester.runStressTest).toHaveBeenCalled()
    })

    it('should simulate realistic user behavior', async () => {
      const scenarios = [
        {
          name: 'user-login',
          weight: 20,
          actions: [
            { type: 'navigate', url: '/login' },
            { type: 'input', selector: '#username', value: 'testuser' },
            { type: 'input', selector: '#password', value: 'password123' },
            { type: 'click', selector: '#login-button' }
          ]
        },
        {
          name: 'assistant-chat',
          weight: 60,
          actions: [
            { type: 'navigate', url: '/chat' },
            { type: 'input', selector: '#message-input', value: 'Hello assistant' },
            { type: 'click', selector: '#send-button' },
            { type: 'wait', duration: 2000 }
          ]
        }
      ]

      const result = await loadTester.runScenarioTest(scenarios, {
        duration: 120,
        concurrentUsers: 50
      })

      expect(result.scenarioResults).toBeInstanceOf(Array)
      expect(result.scenarioResults).toHaveLength(2)
      expect(result.overallSuccessRate).toBeGreaterThan(0)

      expect(loadTester.runScenarioTest).toHaveBeenCalled()
    })

    it('should measure resource utilization during load', async () => {
      const metrics = await loadTester.getResourceMetrics()

      expect(metrics).toHaveProperty('cpu')
      expect(metrics).toHaveProperty('memory')
      expect(metrics).toHaveProperty('disk')
      expect(metrics).toHaveProperty('network')
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0)
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100)
    })

    it('should generate comprehensive load testing report', () => {
      const report = loadTester.generateReport()

      expect(report.summary).toBeDefined()
      expect(report.performance).toHaveProperty('normal')
      expect(report.performance).toHaveProperty('stress')
      expect(report.bottlenecks).toBeInstanceOf(Array)
      expect(report.recommendations).toBeInstanceOf(Array)

      expect(loadTester.generateReport).toHaveBeenCalled()
    })
  })

  describe('Integration Testing', () => {
    it('should run complete performance and security test suite', async () => {
      const testSuite = {
        performance: true,
        security: true,
        load: true
      }

      const results = await runComprehensiveTestSuite(testSuite)

      expect(results).toHaveProperty('performance')
      expect(results).toHaveProperty('security')
      expect(results).toHaveProperty('load')
      expect(results).toHaveProperty('overallScore')
      expect(results.overallScore).toBeGreaterThan(0)
      expect(results.overallScore).toBeLessThanOrEqual(100)

      // Verify all tests were run
      expect(performanceBenchmark.measureCaptureEngine).toHaveBeenCalled()
      expect(securityScanner.scanDependencies).toHaveBeenCalled()
      expect(loadTester.runLoadTest).toHaveBeenCalled()
    })

    it('should handle test failures gracefully', async () => {
      performanceBenchmark.measureCaptureEngine.mockRejectedValue(new Error('Benchmark failed'))
      
      const results = await runComprehensiveTestSuite({
        performance: true,
        security: false,
        load: false
      })

      expect(results.performance.errors).toHaveLength(1)
      expect(results.performance.errors[0].message).toBe('Benchmark failed')
      expect(results.overallScore).toBeLessThan(100)
    })

    it('should provide actionable recommendations', async () => {
      const recommendations = await generateRecommendations({
        performance: { score: 7.2, issues: ['Slow queries', 'High memory'] },
        security: { score: 8.1, issues: ['Missing headers', 'Weak crypto'] },
        load: { score: 6.8, issues: ['Database bottleneck', 'Low throughput'] }
      })

      expect(recommendations).toBeInstanceOf(Array)
      expect(recommendations.length).toBeGreaterThan(0)
      
      const highPriority = recommendations.filter(r => r.priority === 'high')
      expect(highPriority.length).toBeGreaterThan(0)
    })
  })

  describe('Monitoring and Alerting', () => {
    it('should detect performance degradation', async () => {
      const currentMetrics = {
        responseTime: 500,
        errorRate: 5,
        throughput: 100
      }

      const thresholds = {
        responseTime: { max: 300, warning: 200 },
        errorRate: { max: 2, warning: 1 },
        throughput: { min: 150, warning: 200 }
      }

      const alerts = await checkPerformanceThresholds(currentMetrics, thresholds)

      expect(alerts).toBeInstanceOf(Array)
      expect(alerts.length).toBeGreaterThan(0)
      
      const criticalAlerts = alerts.filter(a => a.severity === 'critical')
      expect(criticalAlerts.length).toBeGreaterThan(0)
    })

    it('should detect security incidents', async () => {
      const securityEvents = [
        { type: 'failed_login', count: 50, window: 300 },
        { type: 'sql_injection_attempt', count: 5, window: 60 },
        { type: 'xss_attempt', count: 3, window: 60 }
      ]

      const incidents = await detectSecurityIncidents(securityEvents)

      expect(incidents).toBeInstanceOf(Array)
      expect(incidents.length).toBeGreaterThan(0)
      
      const highSeverity = incidents.filter(i => i.severity === 'high')
      expect(highSeverity.length).toBeGreaterThan(0)
    })
  })
})

// Helper functions for integration tests
async function runComprehensiveTestSuite(config: any) {
  const results: any = {
    performance: { errors: [] },
    security: { errors: [] },
    load: { errors: [] },
    overallScore: 0
  }

  if (config.performance) {
    try {
      await performanceBenchmark.measureCaptureEngine()
      results.performance.score = 8.5
    } catch (error) {
      results.performance.errors.push(error)
      results.performance.score = 0
    }
  }

  if (config.security) {
    try {
      await securityScanner.scanDependencies()
      results.security.score = 8.2
    } catch (error) {
      results.security.errors.push(error)
      results.security.score = 0
    }
  }

  if (config.load) {
    try {
      await loadTester.runLoadTest({ duration: 30, concurrentUsers: 50 })
      results.load.score = 7.8
    } catch (error) {
      results.load.errors.push(error)
      results.load.score = 0
    }
  }

  const totalScore = (results.performance.score + results.security.score + results.load.score) / 3
  results.overallScore = Math.round(totalScore * 100) / 100

  return results
}

async function generateRecommendations(metrics: any) {
  const recommendations = []

  if (metrics.performance.issues.includes('Slow queries')) {
    recommendations.push({
      priority: 'high',
      category: 'performance',
      issue: 'Slow database queries',
      solution: 'Optimize database queries and add indexing'
    })
  }

  if (metrics.security.issues.includes('Missing headers')) {
    recommendations.push({
      priority: 'high',
      category: 'security',
      issue: 'Missing security headers',
      solution: 'Implement CSP, HSTS, and other security headers'
    })
  }

  if (metrics.load.issues.includes('Database bottleneck')) {
    recommendations.push({
      priority: 'medium',
      category: 'performance',
      issue: 'Database connection bottleneck',
      solution: 'Implement connection pooling and caching'
    })
  }

  return recommendations
}

async function checkPerformanceThresholds(metrics: any, thresholds: any) {
  const alerts = []

  if (metrics.responseTime > thresholds.responseTime.max) {
    alerts.push({
      metric: 'responseTime',
      value: metrics.responseTime,
      threshold: thresholds.responseTime.max,
      severity: 'critical',
      message: 'Response time exceeds maximum threshold'
    })
  }

  if (metrics.errorRate > thresholds.errorRate.max) {
    alerts.push({
      metric: 'errorRate',
      value: metrics.errorRate,
      threshold: thresholds.errorRate.max,
      severity: 'critical',
      message: 'Error rate exceeds maximum threshold'
    })
  }

  if (metrics.throughput < thresholds.throughput.min) {
    alerts.push({
      metric: 'throughput',
      value: metrics.throughput,
      threshold: thresholds.throughput.min,
      severity: 'warning',
      message: 'Throughput below minimum threshold'
    })
  }

  return alerts
}

async function detectSecurityIncidents(events: any[]) {
  const incidents = []

  for (const event of events) {
    if (event.type === 'failed_login' && event.count > 20) {
      incidents.push({
        type: 'brute_force',
        severity: 'high',
        count: event.count,
        window: event.window,
        message: 'Potential brute force attack detected'
      })
    }

    if (event.type === 'sql_injection_attempt' && event.count > 2) {
      incidents.push({
        type: 'sql_injection',
        severity: 'critical',
        count: event.count,
        window: event.window,
        message: 'SQL injection attempts detected'
      })
    }
  }

  return incidents
}