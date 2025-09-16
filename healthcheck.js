#!/usr/bin/env node
/**
 * Health check endpoint for Spur Super App
 * Validates application health and dependencies
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds
const REQUIRED_SERVICES = ['database', 'redis', 'memory-graph'];

class HealthChecker {
    constructor() {
        this.startTime = Date.now();
        this.checks = new Map();
        this.status = {
            overall: 'healthy',
            uptime: 0,
            version: this.getVersion(),
            checks: {},
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        };
    }

    getVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
            return packageJson.version || 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    async checkDatabase() {
        const startTime = Date.now();
        try {
            // Check if database file exists and is accessible
            const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'spur.db');
            const dbDir = path.dirname(dbPath);
            
            // Create data directory if it doesn't exist
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Basic file system check
            const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
            
            this.checks.set('database', {
                status: 'healthy',
                responseTime: Date.now() - startTime,
                details: {
                    path: dbPath,
                    exists: !!stats,
                    size: stats ? stats.size : 0,
                    lastModified: stats ? stats.mtime.toISOString() : null
                }
            });
        } catch (error) {
            this.checks.set('database', {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                error: error.message,
                details: {
                    path: process.env.DB_PATH || 'data/spur.db'
                }
            });
        }
    }

    async checkMemory() {
        const startTime = Date.now();
        try {
            const memUsage = process.memoryUsage();
            const totalMemory = require('os').totalmem();
            const freeMemory = require('os').freemem();
            
            const memoryUtilization = (memUsage.heapUsed / totalMemory) * 100;
            
            let status = 'healthy';
            if (memoryUtilization > 90) {
                status = 'critical';
            } else if (memoryUtilization > 75) {
                status = 'warning';
            }

            this.checks.set('memory', {
                status,
                responseTime: Date.now() - startTime,
                details: {
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
                    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
                    external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
                    utilization: Math.round(memoryUtilization) + '%',
                    totalMemory: Math.round(totalMemory / 1024 / 1024) + 'MB',
                    freeMemory: Math.round(freeMemory / 1024 / 1024) + 'MB'
                }
            });
        } catch (error) {
            this.checks.set('memory', {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                error: error.message
            });
        }
    }

    async checkFileSystem() {
        const startTime = Date.now();
        try {
            const requiredPaths = [
                path.join(__dirname, 'dist-web'),
                path.join(__dirname, 'dist-extension'),
                path.join(__dirname, 'node_modules')
            ];

            const results = {};
            let allExist = true;

            for (const checkPath of requiredPaths) {
                const exists = fs.existsSync(checkPath);
                results[checkPath] = exists;
                if (!exists) allExist = false;
            }

            this.checks.set('filesystem', {
                status: allExist ? 'healthy' : 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {
                    paths: results,
                    workingDirectory: process.cwd()
                }
            });
        } catch (error) {
            this.checks.set('filesystem', {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                error: error.message
            });
        }
    }

    async checkDependencies() {
        const startTime = Date.now();
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            const criticalDeps = ['react', 'react-dom', 'typescript', 'vitest', 'playwright'];
            const missingDeps = [];
            
            for (const dep of criticalDeps) {
                if (!dependencies[dep]) {
                    missingDeps.push(dep);
                }
            }

            this.checks.set('dependencies', {
                status: missingDeps.length === 0 ? 'healthy' : 'warning',
                responseTime: Date.now() - startTime,
                details: {
                    totalDependencies: Object.keys(dependencies).length,
                    criticalDependencies: criticalDeps.length,
                    missingCriticalDependencies: missingDeps,
                    nodeVersion: process.version
                }
            });
        } catch (error) {
            this.checks.set('dependencies', {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                error: error.message
            });
        }
    }

    async checkEnvironment() {
        const startTime = Date.now();
        try {
            const requiredEnvVars = ['NODE_ENV', 'PORT'];
            const optionalEnvVars = ['DB_PATH', 'LOG_LEVEL', 'VITE_API_BASE_URL'];
            
            const present = {};
            const missing = [];
            
            for (const envVar of requiredEnvVars) {
                if (process.env[envVar]) {
                    present[envVar] = process.env[envVar];
                } else {
                    missing.push(envVar);
                }
            }

            for (const envVar of optionalEnvVars) {
                if (process.env[envVar]) {
                    present[envVar] = process.env[envVar];
                }
            }

            this.checks.set('environment', {
                status: missing.length === 0 ? 'healthy' : 'warning',
                responseTime: Date.now() - startTime,
                details: {
                    present,
                    missing,
                    platform: process.platform,
                    arch: process.arch
                }
            });
        } catch (error) {
            this.checks.set('environment', {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                error: error.message
            });
        }
    }

    async checkPerformance() {
        const startTime = Date.now();
        try {
            const cpuUsage = process.cpuUsage();
            const memUsage = process.memoryUsage();
            const uptime = process.uptime();
            
            // Calculate CPU usage percentage
            const totalCpuUsage = (cpuUsage.user + cpuUsage.system) / 1000; // Convert to microseconds
            const cpuPercentage = (totalCpuUsage / (uptime * 1000000)) * 100;

            let status = 'healthy';
            if (cpuPercentage > 80) {
                status = 'critical';
            } else if (cpuPercentage > 60) {
                status = 'warning';
            }

            this.checks.set('performance', {
                status,
                responseTime: Date.now() - startTime,
                details: {
                    cpuUsage: Math.round(cpuPercentage * 100) / 100 + '%',
                    uptime: Math.round(uptime) + 's',
                    eventLoopDelay: await this.measureEventLoopDelay(),
                    memoryUsage: {
                        heap: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
                        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
                    }
                }
            });
        } catch (error) {
            this.checks.set('performance', {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                error: error.message
            });
        }
    }

    async measureEventLoopDelay() {
        return new Promise((resolve) => {
            const start = process.hrtime.bigint();
            setImmediate(() => {
                const end = process.hrtime.bigint();
                const delayMs = Number(end - start) / 1000000;
                resolve(Math.round(delayMs * 100) / 100);
            });
        });
    }

    async runChecks() {
        const checkPromises = [
            this.checkDatabase(),
            this.checkMemory(),
            this.checkFileSystem(),
            this.checkDependencies(),
            this.checkEnvironment(),
            this.checkPerformance()
        ];

        await Promise.allSettled(checkPromises);

        // Convert checks Map to object
        const checksObject = {};
        for (const [key, value] of this.checks) {
            checksObject[key] = value;
        }

        // Determine overall status
        const statuses = Object.values(checksObject).map(check => check.status);
        if (statuses.includes('critical')) {
            this.status.overall = 'critical';
        } else if (statuses.includes('unhealthy')) {
            this.status.overall = 'unhealthy';
        } else if (statuses.includes('warning')) {
            this.status.overall = 'warning';
        } else {
            this.status.overall = 'healthy';
        }

        this.status.checks = checksObject;
        this.status.uptime = Math.round(process.uptime());

        return this.status;
    }

    createServer() {
        const server = http.createServer(async (req, res) => {
            if (req.url === '/health' || req.url === '/healthz') {
                try {
                    const healthStatus = await this.runChecks();
                    
                    res.writeHead(
                        healthStatus.overall === 'healthy' ? 200 : 
                        healthStatus.overall === 'warning' ? 200 : 503,
                        { 'Content-Type': 'application/json' }
                    );
                    
                    res.end(JSON.stringify(healthStatus, null, 2));
                } catch (error) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'critical',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }, null, 2));
                }
            } else if (req.url === '/ready') {
                // Readiness check - more strict than health check
                try {
                    await this.runChecks();
                    const isReady = this.status.overall === 'healthy';
                    
                    res.writeHead(
                        isReady ? 200 : 503,
                        { 'Content-Type': 'application/json' }
                    );
                    
                    res.end(JSON.stringify({
                        ready: isReady,
                        status: this.status.overall,
                        timestamp: new Date().toISOString()
                    }, null, 2));
                } catch (error) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        ready: false,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }, null, 2));
                }
            } else if (req.url === '/metrics') {
                // Prometheus-style metrics
                const metrics = await this.generateMetrics();
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(metrics);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        });

        return server;
    }

    async generateMetrics() {
        await this.runChecks();
        
        const metrics = [];
        const timestamp = Math.floor(Date.now() / 1000);
        
        // Application info
        metrics.push(`# HELP spur_app_info Information about the Spur application`);
        metrics.push(`# TYPE spur_app_info gauge`);
        metrics.push(`spur_app_info{version="${this.status.version}",environment="${this.status.environment}"} 1 ${timestamp}`);
        
        // Health status
        metrics.push(`# HELP spur_health_status Overall health status`);
        metrics.push(`# TYPE spur_health_status gauge`);
        const healthStatus = this.status.overall === 'healthy' ? 1 : this.status.overall === 'warning' ? 0.5 : 0;
        metrics.push(`spur_health_status ${healthStatus} ${timestamp}`);
        
        // Uptime
        metrics.push(`# HELP spur_app_uptime_seconds Application uptime in seconds`);
        metrics.push(`# TYPE spur_app_uptime_seconds counter`);
        metrics.push(`spur_app_uptime_seconds ${this.status.uptime} ${timestamp}`);
        
        // Memory usage
        if (this.status.checks.memory?.details) {
            const memDetails = this.status.checks.memory.details;
            metrics.push(`# HELP spur_memory_bytes Memory usage in bytes`);
            metrics.push(`# TYPE spur_memory_bytes gauge`);
            metrics.push(`spur_memory_bytes{type="heap_used"} ${parseFloat(memDetails.heapUsed) * 1024 * 1024} ${timestamp}`);
            metrics.push(`spur_memory_bytes{type="heap_total"} ${parseFloat(memDetails.heapTotal) * 1024 * 1024} ${timestamp}`);
            metrics.push(`spur_memory_bytes{type="rss"} ${parseFloat(memDetails.rss) * 1024 * 1024} ${timestamp}`);
        }
        
        // Check response times
        for (const [checkName, checkData] of Object.entries(this.status.checks)) {
            if (checkData.responseTime) {
                metrics.push(`# HELP spur_check_response_time_seconds Response time for health checks`);
                metrics.push(`# TYPE spur_check_response_time_seconds gauge`);
                metrics.push(`spur_check_response_time_seconds{check="${checkName}"} ${checkData.responseTime / 1000} ${timestamp}`);
            }
        }
        
        return metrics.join('\n') + '\n';
    }

    async start() {
        const server = this.createServer();
        
        server.listen(PORT, () => {
            console.log(`Health check server running on port ${PORT}`);
        });

        return server;
    }
}

// Start health checker if this file is run directly
if (require.main === module) {
    const healthChecker = new HealthChecker();
    healthChecker.start().catch(console.error);
}

module.exports = HealthChecker;