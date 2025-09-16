/**
 * Security Scanner for Spur Super App
 * Comprehensive security vulnerability detection and analysis
 */

export interface Vulnerability {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  description: string
  file?: string
  line?: number
  code?: string
  remediation: string
  references?: string[]
  cve?: string
  owasp?: string
}

export interface SecurityReport {
  securityScore: number
  criticalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  vulnerabilities: Vulnerability[]
  recommendations: string[]
  compliance: {
    sast: boolean
    dast: boolean
    sca: boolean
    infrastructure: boolean
  }
  scanMetadata: {
    startTime: string
    endTime: string
    duration: number
    scannerVersion: string
  }
}

export interface Dependency {
  name: string
  version: string
  license: string
  vulnerabilities: Vulnerability[]
  outdated: boolean
  latestVersion?: string
}

export interface InfrastructureIssue {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  component: string
  remediation: string
}

export class SecurityScanner {
  private vulnerabilityDatabase: Map<string, Vulnerability[]> = new Map()
  private dependencyCache: Map<string, Dependency[]> = new Map()

  constructor() {
    this.initializeVulnerabilityDatabase()
  }

  /**
   * Initialize vulnerability database with common patterns
   */
  private initializeVulnerabilityDatabase() {
    // Code injection patterns
    this.vulnerabilityDatabase.set('code_injection', [
      {
        id: 'CODE_INJ_001',
        type: 'code_injection',
        severity: 'critical',
        category: 'Injection',
        description: 'Use of eval() with user input',
        remediation: 'Avoid eval() with user input. Use safe alternatives like JSON.parse()',
        references: ['OWASP A1:2017-Injection', 'CWE-94']
      }
    ])

    // XSS patterns
    this.vulnerabilityDatabase.set('xss', [
      {
        id: 'XSS_001',
        type: 'xss',
        severity: 'high',
        category: 'Cross-Site Scripting',
        description: 'Unsanitized user input in HTML output',
        remediation: 'Sanitize user input before rendering in HTML',
        references: ['OWASP A7:2017-Cross-Site Scripting', 'CWE-79']
      }
    ])

    // SQL injection patterns
    this.vulnerabilityDatabase.set('sql_injection', [
      {
        id: 'SQL_INJ_001',
        type: 'sql_injection',
        severity: 'critical',
        category: 'Injection',
        description: 'SQL query with string concatenation',
        remediation: 'Use parameterized queries or prepared statements',
        references: ['OWASP A1:2017-Injection', 'CWE-89']
      }
    ])

    // Authentication patterns
    this.vulnerabilityDatabase.set('authentication', [
      {
        id: 'AUTH_001',
        type: 'weak_authentication',
        severity: 'high',
        category: 'Authentication',
        description: 'Weak password policy implementation',
        remediation: 'Implement strong password requirements and multi-factor authentication',
        references: ['OWASP A2:2017-Authentication', 'CWE-521']
      }
    ])

    // Cryptographic issues
    this.vulnerabilityDatabase.set('crypto', [
      {
        id: 'CRYPTO_001',
        type: 'weak_crypto',
        severity: 'high',
        category: 'Cryptography',
        description: 'Use of weak cryptographic algorithm',
        remediation: 'Use strong, modern cryptographic algorithms like AES-256 or RSA-2048',
        references: ['OWASP A6:2017-Security Misconfiguration', 'CWE-327']
      }
    ])
  }

  /**
   * Scan dependencies for known vulnerabilities
   */
  async scanDependencies(packageJsonPath: string = './package.json'): Promise<{
    vulnerabilities: Vulnerability[]
    dependencies: Dependency[]
    recommendations: string[]
  }> {
    try {
      const packageJson = JSON.parse(await import('fs').readFileSync(packageJsonPath, 'utf8'))
      const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      const vulnerabilities: Vulnerability[] = []
      const dependencies: Dependency[] = []

      for (const [name, version] of Object.entries(allDependencies)) {
        const dependency = await this.scanDependency(name, version as string)
        dependencies.push(dependency)
        vulnerabilities.push(...dependency.vulnerabilities)
      }

      const recommendations = this.generateDependencyRecommendations(dependencies)

      return { vulnerabilities, dependencies, recommendations }
    } catch (error) {
      throw new Error(`Failed to scan dependencies: ${error.message}`)
    }
  }

  /**
   * Scan individual dependency
   */
  private async scanDependency(name: string, version: string): Promise<Dependency> {
    // Check cache first
    const cacheKey = `${name}@${version}`
    if (this.dependencyCache.has(cacheKey)) {
      return this.dependencyCache.get(cacheKey)!
    }

    const vulnerabilities: Vulnerability[] = []

    // Simulate vulnerability check (in real implementation, query vulnerability databases)
    const knownVulnerablePackages = [
      { name: 'express', version: '<4.17.0', vulnerabilities: ['CVE-2021-23436'] },
      { name: 'lodash', version: '<4.17.20', vulnerabilities: ['CVE-2021-23337'] },
      { name: 'axios', version: '<0.21.0', vulnerabilities: ['CVE-2020-28168'] }
    ]

    const vulnerable = knownVulnerablePackages.find(vp => 
      vp.name === name && this.versionSatisfies(version, vp.version)
    )

    if (vulnerable) {
      for (const cve of vulnerable.vulnerabilities) {
        vulnerabilities.push({
          id: cve,
          type: 'vulnerable_dependency',
          severity: 'high',
          category: 'Supply Chain',
          description: `${name} ${version} has known security vulnerability ${cve}`,
          remediation: `Update ${name} to latest version`,
          cve
        })
      }
    }

    const dependency: Dependency = {
      name,
      version,
      license: 'MIT', // In real implementation, extract from package
      vulnerabilities,
      outdated: false, // In real implementation, check against latest version
      latestVersion: version
    }

    // Cache result
    this.dependencyCache.set(cacheKey, dependency)

    return dependency
  }

  /**
   * Scan source code for security issues
   */
  async scanCode(directory: string = './src'): Promise<{
    vulnerabilities: Vulnerability[]
    recommendations: string[]
  }> {
    const vulnerabilities: Vulnerability[] = []
    const { readdirSync, readFileSync, statSync } = await import('fs')
    const { join } = await import('path')

    const scanFile = (filePath: string) => {
      try {
        const content = readFileSync(filePath, 'utf8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          const fileVulnerabilities = this.analyzeLine(line, filePath, index + 1)
          vulnerabilities.push(...fileVulnerabilities)
        })
      } catch (error) {
        console.warn(`Failed to scan file ${filePath}: ${error.message}`)
      }
    }

    const scanDirectory = (dirPath: string) => {
      const files = readdirSync(dirPath)
      
      for (const file of files) {
        const fullPath = join(dirPath, file)
        const stats = statSync(fullPath)
        
        if (stats.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          scanDirectory(fullPath)
        } else if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.tsx'))) {
          scanFile(fullPath)
        }
      }
    }

    scanDirectory(directory)

    const recommendations = this.generateCodeRecommendations(vulnerabilities)

    return { vulnerabilities, recommendations }
  }

  /**
   * Analyze single line of code for vulnerabilities
   */
  private analyzeLine(line: string, file: string, lineNumber: number): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = []
    const trimmedLine = line.trim()

    // Check for eval() usage
    if (trimmedLine.includes('eval(')) {
      vulnerabilities.push({
        id: `CODE_INJ_${Date.now()}`,
        type: 'code_injection',
        severity: 'critical',
        category: 'Injection',
        description: 'Potential code injection through eval()',
        file,
        line: lineNumber,
        code: trimmedLine,
        remediation: 'Replace eval() with safer alternatives like JSON.parse() or Function constructor'
      })
    }

    // Check for innerHTML usage
    if (trimmedLine.includes('.innerHTML')) {
      vulnerabilities.push({
        id: `XSS_${Date.now()}`,
        type: 'xss',
        severity: 'high',
        category: 'Cross-Site Scripting',
        description: 'Potential XSS through innerHTML assignment',
        file,
        line: lineNumber,
        code: trimmedLine,
        remediation: 'Use textContent or sanitize input before using innerHTML'
      })
    }

    // Check for SQL string concatenation
    if (trimmedLine.includes('SELECT') && trimmedLine.includes('+')) {
      vulnerabilities.push({
        id: `SQL_INJ_${Date.now()}`,
        type: 'sql_injection',
        severity: 'critical',
        category: 'Injection',
        description: 'Potential SQL injection through string concatenation',
        file,
        line: lineNumber,
        code: trimmedLine,
        remediation: 'Use parameterized queries or prepared statements'
      })
    }

    // Check for hardcoded secrets
    const secretPatterns = [
      /password\s*=\s*['"][^'"]{8,}['"]/i,
      /api_key\s*=\s*['"][^'"]{16,}['"]/i,
      /secret\s*=\s*['"][^'"]{16,}['"]/i,
      /token\s*=\s*['"][^'"]{16,}['"]/i
    ]

    for (const pattern of secretPatterns) {
      if (pattern.test(trimmedLine)) {
        vulnerabilities.push({
          id: `SECRET_${Date.now()}`,
          type: 'hardcoded_secret',
          severity: 'high',
          category: 'Secret Management',
          description: 'Hardcoded secret or password detected',
          file,
          line: lineNumber,
          code: trimmedLine,
          remediation: 'Move secrets to environment variables or secret management system'
        })
        break
      }
    }

    // Check for weak crypto algorithms
    const weakCryptoPatterns = [
      /crypto\.createCipher\(['"']md5['"']/i,
      /crypto\.createCipher\(['"']sha1['"']/i,
      /crypto\.createCipher\(['"']rc4['"']/i,
      /\.encrypt\(['"']aes-128['"']/i
    ]

    for (const pattern of weakCryptoPatterns) {
      if (pattern.test(trimmedLine)) {
        vulnerabilities.push({
          id: `WEAK_CRYPTO_${Date.now()}`,
          type: 'weak_crypto',
          severity: 'medium',
          category: 'Cryptography',
          description: 'Usage of weak cryptographic algorithm',
          file,
          line: lineNumber,
          code: trimmedLine,
          remediation: 'Use strong cryptographic algorithms like AES-256, SHA-256, or RSA-2048'
        })
        break
      }
    }

    return vulnerabilities
  }

  /**
   * Scan infrastructure for security issues
   */
  async scanInfrastructure(): Promise<{
    issues: InfrastructureIssue[]
    recommendations: string[]
  }> {
    const issues: InfrastructureIssue[] = []

    // Check for Docker security issues
    try {
      const { readFileSync } = await import('fs')
      const dockerfile = readFileSync('./Dockerfile', 'utf8')

      // Check for running as root
      if (dockerfile.includes('USER root') || !dockerfile.includes('USER')) {
        issues.push({
          type: 'container_security',
          severity: 'high',
          description: 'Container running as root user',
          component: 'Dockerfile',
          remediation: 'Add non-root user to Dockerfile'
        })
      }

      // Check for exposed ports
      const exposedPorts = dockerfile.match(/EXPOSE\s+\d+/g) || []
      if (exposedPorts.length > 2) {
        issues.push({
          type: 'exposed_ports',
          severity: 'medium',
          description: 'Multiple ports exposed in container',
          component: 'Dockerfile',
          remediation: 'Minimize exposed ports and use port mapping only for necessary services'
        })
      }
    } catch (error) {
      // Dockerfile not found, skip Docker checks
    }

    // Check for environment variables with secrets
    try {
      const { readFileSync } = await import('fs')
      const envExample = readFileSync('./.env.example', 'utf8')
      
      const secretKeys = envExample.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.split('=')[0])
        .filter(key => /secret|password|key|token/i.test(key))

      if (secretKeys.length > 0) {
        issues.push({
          type: 'environment_secrets',
          severity: 'medium',
          description: 'Potential secrets in environment configuration',
          component: 'Environment',
          remediation: 'Use proper secret management for sensitive configuration'
        })
      }
    } catch (error) {
      // .env.example not found, skip
    }

    // Check for HTTPS enforcement
    try {
      const { readdirSync, readFileSync } = await import('fs')
      const configFiles = readdirSync('.')
        .filter(file => file.includes('config') || file.includes('nginx') || file.includes('apache'))

      for (const configFile of configFiles) {
        try {
          const config = readFileSync(configFile, 'utf8')
          
          if (!config.includes('https://') && !config.includes('ssl')) {
            issues.push({
              type: 'missing_https',
              severity: 'high',
              description: 'HTTPS not configured',
              component: configFile,
              remediation: 'Configure HTTPS with valid SSL certificate'
            })
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      // Configuration directory not found, skip
    }

    const recommendations = this.generateInfrastructureRecommendations(issues)

    return { issues, recommendations }
  }

  /**
   * Validate security headers
   */
  async validateSecurityHeaders(headers: Record<string, string>): Promise<{
    score: number
    missing: string[]
    recommendations: string[]
  }> {
    const requiredHeaders = [
      { name: 'content-security-policy', weight: 3 },
      { name: 'x-frame-options', weight: 2 },
      { name: 'x-content-type-options', weight: 1 },
      { name: 'strict-transport-security', weight: 3 },
      { name: 'x-xss-protection', weight: 1 },
      { name: 'referrer-policy', weight: 1 }
    ]

    let score = 0
    const missing: string[] = []

    for (const header of requiredHeaders) {
      if (headers[header.name.toLowerCase()]) {
        score += header.weight
      } else {
        missing.push(header.name)
      }
    }

    const recommendations = missing.map(header => 
      `Implement ${header.replace(/-/g, ' ').toUpperCase()} header for enhanced security`
    )

    return {
      score: Math.round((score / 11) * 100), // Max score is 11
      missing,
      recommendations
    }
  }

  /**
   * Test authentication and authorization
   */
  async testAuthentication(): Promise<{
    passwordStrength: number
    sessionManagement: number
    accessControls: number
    rateLimiting: number
    overallScore: number
  }> {
    // Simulate authentication testing
    const scores = {
      passwordStrength: Math.random() * 100,
      sessionManagement: Math.random() * 100,
      accessControls: Math.random() * 100,
      rateLimiting: Math.random() * 100
    }

    const overallScore = (
      scores.passwordStrength * 0.3 +
      scores.sessionManagement * 0.3 +
      scores.accessControls * 0.2 +
      scores.rateLimiting * 0.2
    )

    return {
      ...scores,
      overallScore: Math.round(overallScore)
    }
  }

  /**
   * Generate comprehensive security report
   */
  async generateReport(): Promise<SecurityReport> {
    const startTime = new Date()

    // Run all security scans
    const depScan = await this.scanDependencies()
    const codeScan = await this.scanCode()
    const infraScan = await this.scanInfrastructure()
    const authTest = await this.testAuthentication()

    const allVulnerabilities = [
      ...depScan.vulnerabilities,
      ...codeScan.vulnerabilities
    ]

    // Count issues by severity
    const criticalIssues = allVulnerabilities.filter(v => v.severity === 'critical').length
    const highIssues = allVulnerabilities.filter(v => v.severity === 'high').length
    const mediumIssues = allVulnerabilities.filter(v => v.severity === 'medium').length
    const lowIssues = allVulnerabilities.filter(v => v.severity === 'low').length

    // Calculate security score
    const vulnerabilityScore = Math.max(0, 100 - (
      criticalIssues * 15 + 
      highIssues * 10 + 
      mediumIssues * 5 + 
      lowIssues * 2
    ))

    const infrastructureScore = Math.max(0, 100 - (infraScan.issues.length * 10))
    const authScore = authTest.overallScore

    const securityScore = Math.round((vulnerabilityScore + infrastructureScore + authScore) / 3)

    // Generate recommendations
    const recommendations = [
      ...depScan.recommendations,
      ...codeScan.recommendations,
      ...infraScan.recommendations
    ]

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    return {
      securityScore,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      vulnerabilities: allVulnerabilities,
      recommendations,
      compliance: {
        sast: codeScan.vulnerabilities.length === 0,
        dast: false, // Would need actual DAST scanning
        sca: depScan.vulnerabilities.length === 0,
        infrastructure: infraScan.issues.length === 0
      },
      scanMetadata: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration,
        scannerVersion: '1.0.0'
      }
    }
  }

  /**
   * Helper method to check version satisfaction
   */
  private versionSatisfies(version: string, range: string): boolean {
    // Simplified version checking - in real implementation, use semver
    return version === range || version.startsWith(range.split(' ')[0])
  }

  /**
   * Generate dependency recommendations
   */
  private generateDependencyRecommendations(dependencies: Dependency[]): string[] {
    const recommendations: string[] = []

    const vulnerableDeps = dependencies.filter(d => d.vulnerabilities.length > 0)
    if (vulnerableDeps.length > 0) {
      recommendations.push(`Update ${vulnerableDeps.length} vulnerable dependencies to patch security issues`)
    }

    const outdatedDeps = dependencies.filter(d => d.outdated)
    if (outdatedDeps.length > 0) {
      recommendations.push(`Update ${outdatedDeps.length} outdated dependencies for latest features and fixes`)
    }

    return recommendations
  }

  /**
   * Generate code recommendations
   */
  private generateCodeRecommendations(vulnerabilities: Vulnerability[]): string[] {
    const recommendations: string[] = []

    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical')
    if (criticalVulns.length > 0) {
      recommendations.push(`Address ${criticalVulns.length} critical security vulnerabilities immediately`)
    }

    const injectionVulns = vulnerabilities.filter(v => v.category === 'Injection')
    if (injectionVulns.length > 0) {
      recommendations.push('Implement input validation and parameterized queries to prevent injection attacks')
    }

    const xssVulns = vulnerabilities.filter(v => v.type === 'xss')
    if (xssVulns.length > 0) {
      recommendations.push('Implement proper output encoding and Content Security Policy to prevent XSS')
    }

    return recommendations
  }

  /**
   * Generate infrastructure recommendations
   */
  private generateInfrastructureRecommendations(issues: InfrastructureIssue[]): string[] {
    const recommendations: string[] = []

    const containerIssues = issues.filter(i => i.component === 'Dockerfile')
    if (containerIssues.length > 0) {
      recommendations.push('Implement container security best practices including non-root users and minimal base images')
    }

    const networkIssues = issues.filter(i => i.type === 'missing_https')
    if (networkIssues.length > 0) {
      recommendations.push('Enable HTTPS with valid SSL certificates and implement HTTP to HTTPS redirects')
    }

    return recommendations
  }
}