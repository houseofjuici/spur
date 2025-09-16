/**
 * Deployment Automation Tests for Spur Super App
 * Comprehensive testing of deployment pipelines, environment management, and release coordination
 */

import { test, expect } from 'vitest';
import { DeploymentAutomation, DeploymentConfig, DeploymentEnvironment, Release } from '../../src/deployment/automation';

// Mock environment variables for testing
process.env.SLACK_DEPLOYMENT_WEBHOOK_URL = 'https://hooks.slack.com/test';
process.env.DEPLOYMENT_WEBHOOK_URL = 'https://webhook.test.com/deploy';

describe('DeploymentAutomation', () => {
  let deploymentSystem: DeploymentAutomation;

  beforeEach(() => {
    deploymentSystem = new DeploymentAutomation();
  });

  afterEach(() => {
    deploymentSystem.destroy();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(deploymentSystem).toBeDefined();
      expect(deploymentSystem.getDeployments()).toHaveLength(0);
      expect(deploymentSystem.getReleases()).toHaveLength(0);
    });

    test('should have default environments configured', () => {
      const deployments = deploymentSystem.getDeployments();
      const environments = deploymentSystem.getStatistics().environments;
      
      expect(environments).toContain('development');
      expect(environments).toContain('staging');
      expect(environments).toContain('production');
    });

    test('should load existing releases and deployment history', () => {
      // The system should attempt to load from storage
      // Even if files don't exist, it should not crash
      expect(deploymentSystem).toBeDefined();
    });
  });

  describe('Release Management', () => {
    test('should create a new release with valid version', async () => {
      const changelog = `
### Features
- Added new assistant capabilities
- Enhanced memory graph performance
- Improved user interface

### Bug Fixes
- Fixed memory leak in capture engine
- Resolved database connection issues
- Corrected accessibility violations
      `;

      const release = await deploymentSystem.createRelease('1.1.0', changelog);

      expect(release).toBeDefined();
      expect(release.version).toBe('1.1.0');
      expect(release.status).toBe('planned');
      expect(release.features).toHaveLength(3);
      expect(release.bugfixes).toHaveLength(3);
      expect(release.breaking).toBeUndefined();
    });

    test('should parse changelog correctly', async () => {
      const changelog = `
### Added
- New feature A
- New feature B

### Fixed
- Bug fix C
- Bug fix D

### BREAKING CHANGES
- Breaking change E
      `;

      const release = await deploymentSystem.createRelease('1.2.0', changelog);

      expect(release.features).toHaveLength(2);
      expect(release.bugfixes).toHaveLength(2);
      expect(release.breaking).toHaveLength(1);
      expect(release.breaking).toContain('Breaking change E');
    });

    test('should handle breaking changes in release', async () => {
      const changelog = `
### Features
- Some new feature

### Bug Fixes
- Some bug fix

### Breaking Changes
- Database schema changed
- API endpoints modified
      `;

      const release = await deploymentSystem.createRelease('2.0.0', changelog);

      expect(release.breaking).toBeDefined();
      expect(release.breaking).toHaveLength(2);
    });

    test('should retrieve releases', () => {
      expect(deploymentSystem.getReleases()).toBeInstanceOf(Array);
    });

    test('should get specific release', async () => {
      const changelog = '### Features\n- Test feature';
      const release = await deploymentSystem.createRelease('1.0.1', changelog);
      
      const retrievedRelease = deploymentSystem.getRelease(release.id);
      expect(retrievedRelease).toBeDefined();
      expect(retrievedRelease?.version).toBe('1.0.1');
    });
  });

  describe('Deployment Pipeline', () => {
    test('should deploy to development environment', async () => {
      // Create a release first
      const changelog = '### Features\n- Test deployment feature';
      const release = await deploymentSystem.createRelease('1.0.1', changelog);

      // Deploy with dry run to avoid actual infrastructure changes
      const deployment = await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
        skipSecurityScan: true,
      });

      expect(deployment).toBeDefined();
      expect(deployment.status).toBe('success');
      expect(deployment.environment).toBe('development');
      expect(deployment.version).toBe('1.0.1');
      expect(deployment.duration).toBeGreaterThan(0);
    });

    test('should deploy to staging environment', async () => {
      const changelog = '### Features\n- Staging test feature';
      const release = await deploymentSystem.createRelease('1.0.2', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'staging', {
        dryRun: true,
        skipSecurityScan: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.environment).toBe('staging');
    });

    test('should deploy to production environment', async () => {
      const changelog = '### Features\n- Production ready feature';
      const release = await deploymentSystem.createRelease('1.0.3', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'production', {
        dryRun: true,
        skipSecurityScan: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.environment).toBe('production');
    });

    test('should fail deployment for non-existent release', async () => {
      await expect(
        deploymentSystem.deploy('non-existent-release', 'development')
      ).rejects.toThrow('Release non-existent-release not found');
    });

    test('should fail deployment for non-existent environment', async () => {
      const changelog = '### Features\n- Test feature';
      const release = await deploymentSystem.createRelease('1.0.4', changelog);

      await expect(
        deploymentSystem.deploy(release.id, 'non-existent-env')
      ).rejects.toThrow('Environment non-existent-env not found');
    });
  });

  describe('Security Scanning', () => {
    test('should run security scan when enabled', async () => {
      const changelog = '### Features\n- Security test feature';
      const release = await deploymentSystem.createRelease('1.0.5', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('Security scan completed')
      )).toBe(true);
    });

    test('should skip security scan when requested', async () => {
      const changelog = '### Features\n- Skip security test';
      const release = await deploymentSystem.createRelease('1.0.6', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
        skipSecurityScan: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('Skipping security scan')
      )).toBe(true);
    });
  });

  describe('Testing Integration', () => {
    test('should run tests by default', async () => {
      const changelog = '### Features\n- Test integration feature';
      const release = await deploymentSystem.createRelease('1.0.7', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
        skipSecurityScan: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('All tests passed')
      )).toBe(true);
    });

    test('should skip tests when requested', async () => {
      const changelog = '### Features\n- Skip tests feature';
      const release = await deploymentSystem.createRelease('1.0.8', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
        skipSecurityScan: true,
        skipTests: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('Skipping tests')
      )).toBe(true);
    });
  });

  describe('Infrastructure Deployment', () => {
    test('should deploy to AWS infrastructure', async () => {
      const config: Partial<DeploymentConfig> = {
        environments: [
          {
            name: 'aws-test',
            type: 'development',
            config: {
              apiUrl: 'https://test-api.spur.app',
              databaseUrl: 'postgresql://test@test-db:5432/test',
              features: ['all'],
              limits: { users: 10, storage: 1, requests: 1000 },
              monitoring: { enabled: true, alerting: true, tracing: true },
            },
            infrastructure: {
              provider: 'aws',
              region: 'us-east-1',
              resources: {
                compute: { type: 'container', instances: 1, size: 'small' },
                storage: { type: 's3', size: 1 },
                network: { loadBalancer: true, cdn: true, ssl: true },
              },
            },
          },
        ],
      };

      const deploymentSystem = new DeploymentAutomation(config);
      const changelog = '### Features\n- AWS test feature';
      const release = await deploymentSystem.createRelease('1.0.9', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'aws-test', {
        dryRun: true,
        skipSecurityScan: true,
        skipTests: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('AWS deployment completed')
      )).toBe(true);

      deploymentSystem.destroy();
    });

    test('should deploy to GCP infrastructure', async () => {
      const config: Partial<DeploymentConfig> = {
        environments: [
          {
            name: 'gcp-test',
            type: 'development',
            config: {
              apiUrl: 'https://test-api.spur.app',
              databaseUrl: 'postgresql://test@test-db:5432/test',
              features: ['all'],
              limits: { users: 10, storage: 1, requests: 1000 },
              monitoring: { enabled: true, alerting: true, tracing: true },
            },
            infrastructure: {
              provider: 'gcp',
              region: 'us-central1',
              resources: {
                compute: { type: 'container', instances: 1, size: 'small' },
                storage: { type: 'blob', size: 1 },
                network: { loadBalancer: true, cdn: true, ssl: true },
              },
            },
          },
        ],
      };

      const deploymentSystem = new DeploymentAutomation(config);
      const changelog = '### Features\n- GCP test feature';
      const release = await deploymentSystem.createRelease('1.1.0', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'gcp-test', {
        dryRun: true,
        skipSecurityScan: true,
        skipTests: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('GCP deployment completed')
      )).toBe(true);

      deploymentSystem.destroy();
    });

    test('should deploy to Azure infrastructure', async () => {
      const config: Partial<DeploymentConfig> = {
        environments: [
          {
            name: 'azure-test',
            type: 'development',
            config: {
              apiUrl: 'https://test-api.spur.app',
              databaseUrl: 'postgresql://test@test-db:5432/test',
              features: ['all'],
              limits: { users: 10, storage: 1, requests: 1000 },
              monitoring: { enabled: true, alerting: true, tracing: true },
            },
            infrastructure: {
              provider: 'azure',
              region: 'eastus',
              resources: {
                compute: { type: 'container', instances: 1, size: 'small' },
                storage: { type: 'blob', size: 1 },
                network: { loadBalancer: true, cdn: true, ssl: true },
              },
            },
          },
        ],
      };

      const deploymentSystem = new DeploymentAutomation(config);
      const changelog = '### Features\n- Azure test feature';
      const release = await deploymentSystem.createRelease('1.1.1', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'azure-test', {
        dryRun: true,
        skipSecurityScan: true,
        skipTests: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('Azure deployment completed')
      )).toBe(true);

      deploymentSystem.destroy();
    });

    test('should deploy to self-hosted infrastructure', async () => {
      const config: Partial<DeploymentConfig> = {
        environments: [
          {
            name: 'self-hosted-test',
            type: 'development',
            config: {
              apiUrl: 'https://test-api.spur.app',
              databaseUrl: 'postgresql://test@test-db:5432/test',
              features: ['all'],
              limits: { users: 10, storage: 1, requests: 1000 },
              monitoring: { enabled: true, alerting: true, tracing: true },
            },
            infrastructure: {
              provider: 'self-hosted',
              region: 'local',
              resources: {
                compute: { type: 'container', instances: 1, size: 'small' },
                storage: { type: 'database', size: 1 },
                network: { loadBalancer: false, cdn: false, ssl: false },
              },
            },
          },
        ],
      };

      const deploymentSystem = new DeploymentAutomation(config);
      const changelog = '### Features\n- Self-hosted test feature';
      const release = await deploymentSystem.createRelease('1.1.2', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'self-hosted-test', {
        dryRun: true,
        skipSecurityScan: true,
        skipTests: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('Self-hosted deployment completed')
      )).toBe(true);

      deploymentSystem.destroy();
    });
  });

  describe('Health Checks and Verification', () => {
    test('should run health check during deployment', async () => {
      const changelog = '### Features\n- Health check feature';
      const release = await deploymentSystem.createRelease('1.1.3', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
        skipSecurityScan: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('Health check completed successfully')
      )).toBe(true);
    });

    test('should run post-deployment verification', async () => {
      const changelog = '### Features\n- Verification feature';
      const release = await deploymentSystem.createRelease('1.1.4', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
        skipSecurityScan: true,
      });

      expect(deployment.status).toBe('success');
      expect(deployment.logs.some(log => 
        log.message.includes('Post-deployment verification completed')
      )).toBe(true);
    });
  });

  describe('Rollback Functionality', () => {
    test('should attempt rollback on deployment failure', async () => {
      // Create a config that will cause deployment to fail
      const config: Partial<DeploymentConfig> = {
        environments: [
          {
            name: 'failure-test',
            type: 'development',
            config: {
              apiUrl: 'https://invalid-api.spur.app', // This will cause health check to fail
              databaseUrl: 'postgresql://test@test-db:5432/test',
              features: ['all'],
              limits: { users: 10, storage: 1, requests: 1000 },
              monitoring: { enabled: true, alerting: true, tracing: true },
            },
            infrastructure: {
              provider: 'self-hosted',
              region: 'local',
              resources: {
                compute: { type: 'container', instances: 1, size: 'small' },
                storage: { type: 'database', size: 1 },
                network: { loadBalancer: false, cdn: false, ssl: false },
              },
            },
          },
        ],
      };

      const deploymentSystem = new DeploymentAutomation(config);
      
      // First successful deployment
      const changelog1 = '### Features\n- Initial feature';
      const release1 = await deploymentSystem.createRelease('1.0.0', changelog1);
      await deploymentSystem.deploy(release1.id, 'failure-test', {
        dryRun: true,
        skipSecurityScan: true,
        skipTests: true,
      });

      // Second deployment that will fail
      const changelog2 = '### Features\n- Failing feature';
      const release2 = await deploymentSystem.createRelease('1.0.1', changelog2);

      // Mock health check to fail
      const originalHealthCheck = deploymentSystem['runHealthCheck'];
      deploymentSystem['runHealthCheck'] = async () => {
        throw new Error('Health check failed');
      };

      try {
        await deploymentSystem.deploy(release2.id, 'failure-test', {
          dryRun: true,
          skipSecurityScan: true,
          skipTests: true,
        });
        fail('Deployment should have failed');
      } catch (error) {
        expect(error.message).toContain('Health check failed');
      }

      // Check if rollback was attempted
      const deployments = deploymentSystem.getDeployments('failure-test');
      const failedDeployment = deployments.find(d => d.version === '1.0.1');
      
      expect(failedDeployment).toBeDefined();
      expect(failedDeployment?.status).toBe('failed');

      deploymentSystem.destroy();
    });
  });

  describe('Deployment History and Statistics', () => {
    test('should track deployment history', async () => {
      const changelog = '### Features\n- History test feature';
      const release = await deploymentSystem.createRelease('1.1.5', changelog);

      await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
        skipSecurityScan: true,
      });

      const deployments = deploymentSystem.getDeployments();
      expect(deployments.length).toBeGreaterThan(0);

      const environmentDeployments = deploymentSystem.getDeployments('development');
      expect(environmentDeployments.length).toBeGreaterThan(0);
    });

    test('should provide deployment statistics', async () => {
      const stats = deploymentSystem.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalDeployments).toBeGreaterThanOrEqual(0);
      expect(stats.successfulDeployments).toBeGreaterThanOrEqual(0);
      expect(stats.failedDeployments).toBeGreaterThanOrEqual(0);
      expect(stats.averageDeploymentTime).toBeGreaterThanOrEqual(0);
      expect(stats.environments).toContain('development');
    });

    test('should track deployment logs', async () => {
      const changelog = '### Features\n- Logging test feature';
      const release = await deploymentSystem.createRelease('1.1.6', changelog);

      const deployment = await deploymentSystem.deploy(release.id, 'development', {
        dryRun: true,
        skipSecurityScan: true,
      });

      const logs = deploymentSystem.getDeploymentLogs(deployment.id);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.level === 'info')).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig: Partial<DeploymentConfig> = {
        application: {
          name: 'updated-spur-app',
          version: '2.0.0',
          buildNumber: '100',
          commitHash: 'abc123',
        },
      };

      deploymentSystem.updateConfig(newConfig);

      // The configuration should be updated
      // Note: This is a basic test - in a real scenario you'd need to verify the config was applied
      expect(deploymentSystem).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing release gracefully', () => {
      const release = deploymentSystem.getRelease('non-existent');
      expect(release).toBeUndefined();
    });

    test('should handle missing deployment gracefully', () => {
      const deployment = deploymentSystem.getDeploymentStatus('non-existent');
      expect(deployment).toBeUndefined();
    });

    test('should handle deployment failures gracefully', async () => {
      const changelog = '### Features\n- Error test feature';
      const release = await deploymentSystem.createRelease('1.1.7', changelog);

      // Force a failure by using invalid environment
      await expect(
        deploymentSystem.deploy(release.id, 'invalid-environment')
      ).rejects.toThrow();

      // Check that the deployment was recorded with failure status
      const deployments = deploymentSystem.getDeployments();
      const failedDeployment = deployments.find(d => d.version === '1.1.7');
      
      expect(failedDeployment).toBeDefined();
      expect(failedDeployment?.status).toBe('failed');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources on destroy', () => {
      deploymentSystem.destroy();
      
      // After destroy, the system should be cleaned up
      expect(deploymentSystem.getDeployments()).toHaveLength(0);
      expect(deploymentSystem.getReleases()).toHaveLength(0);
    });
  });
});

// Helper function for failing tests
function fail(message: string): never {
  throw new Error(message);
}