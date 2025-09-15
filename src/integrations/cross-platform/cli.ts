/**
 * Cross-Platform Integration CLI
 * Command-line interface for building and managing cross-platform browser integrations
 */

import { Command } from 'commander';
import { CrossPlatformIntegrationManager } from './CrossPlatformIntegrationManager';
import { CrossPlatformBuilder, BuildConfiguration } from './CrossPlatformBuilder';
import { CrossPlatformUtils } from './CrossPlatformUtils';
import { Logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();
const logger = new Logger('CrossPlatformCLI');

program
  .name('spur-cross-platform')
  .description('Cross-Platform Integration CLI for Spur Browser Extensions')
  .version('1.0.0');

/**
 * List available integrations
 */
program
  .command('list')
  .description('List all available cross-platform integrations')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    try {
      const manager = new CrossPlatformIntegrationManager();
      const integrations = manager.getIntegrations();

      console.log('\\nAvailable Cross-Platform Integrations:\\n');

      integrations.forEach(integration => {
        console.log(`📦 ${integration.name}`);
        console.log(`   ID: ${integration.id}`);
        console.log(`   Description: ${integration.description}`);
        
        if (options.verbose) {
          const supportedBrowsers = manager.getSupportedBrowsers(integration.id);
          console.log(`   Supported Browsers: ${supportedBrowsers.join(', ')}`);
          console.log(`   Platforms: ${integration.platforms.map(p => `${p.name} (${p.version})`).join(', ')}`);
          console.log(`   Required Permissions: ${integration.permissions.filter(p => p.required).map(p => p.name).join(', ')}`);
          console.log(`   Manifest Version: ${integration.nativeImplementation.manifestV3 ? 'V3' : 'V2'}`);
        }
        
        console.log('');
      });

      console.log(`Total: ${integrations.length} integrations available\\n`);
    } catch (error) {
      logger.error('Failed to list integrations:', error);
      process.exit(1);
    }
  });

/**
 * Check compatibility for integration
 */
program
  .command('check-compatibility')
  .description('Check platform compatibility for an integration')
  .argument('<integration-id>', 'Integration ID to check')
  .option('-p, --platforms <platforms>', 'Comma-separated list of platforms to check (default: all)')
  .option('-r, --report', 'Generate detailed compatibility report')
  .option('-o, --output <file>', 'Output report to file')
  .action(async (integrationId, options) => {
    try {
      const manager = new CrossPlatformIntegrationManager();
      const integration = manager.getIntegration(integrationId);
      
      if (!integration) {
        console.error(`❌ Integration not found: ${integrationId}`);
        process.exit(1);
      }

      const platforms = options.platforms 
        ? options.platforms.split(',').map((p: string) => p.trim())
        : ['chrome', 'firefox', 'edge', 'safari'];

      console.log(`\\n🔍 Compatibility Check for: ${integration.name}`);
      console.log(`Integration ID: ${integrationId}\\n`);

      const reports: any[] = [];

      platforms.forEach(platform => {
        const report = CrossPlatformUtils.generateCompatibilityReport(integration, platform);
        reports.push({ platform, report });

        const status = report.compatible ? '✅ Compatible' : '❌ Incompatible';
        console.log(`${platform.toUpperCase()}: ${status}`);
        
        if (options.report) {
          console.log(`  Supported Features: ${report.supportedFeatures.join(', ')}`);
          if (report.missingFeatures.length > 0) {
            console.log(`  Missing Features: ${report.missingFeatures.join(', ')}`);
          }
          if (report.warnings.length > 0) {
            console.log(`  Warnings: ${report.warnings.join('; ')}`);
          }
          if (report.recommendations.length > 0) {
            console.log(`  Recommendations: ${report.recommendations.join('; ')}`);
          }
        }
        console.log('');
      });

      // Generate comprehensive report
      if (options.output) {
        const comprehensiveReport = {
          integration: {
            id: integration.id,
            name: integration.name,
            description: integration.description
          },
          timestamp: new Date().toISOString(),
          platforms: platforms.map(p => ({ name: p, report: reports.find(r => r.platform === p)?.report })),
          summary: {
            totalPlatforms: platforms.length,
            compatiblePlatforms: reports.filter(r => r.report.compatible).length,
            incompatiblePlatforms: reports.filter(r => !r.report.compatible).length
          }
        };

        await fs.promises.writeFile(options.output, JSON.stringify(comprehensiveReport, null, 2));
        console.log(`📄 Compatibility report saved to: ${options.output}`);
      }

      // Summary
      const compatibleCount = reports.filter(r => r.report.compatible).length;
      const incompatibleCount = reports.filter(r => !r.report.compatible).length;
      
      console.log(`\\n📊 Summary:`);
      console.log(`   Compatible Platforms: ${compatibleCount}/${platforms.length}`);
      console.log(`   Incompatible Platforms: ${incompatibleCount}/${platforms.length}`);

      if (incompatibleCount > 0) {
        console.log('\\n⚠️  Some platforms are not compatible. Use --report flag for details.');
      }

    } catch (error) {
      logger.error('Compatibility check failed:', error);
      process.exit(1);
    }
  });

/**
 * Generate manifests for platforms
 */
program
  .command('generate-manifests')
  .description('Generate manifest files for specified platforms')
  .argument('<integration-id>', 'Integration ID')
  .argument('<platforms>', 'Comma-separated list of platforms')
  .option('-o, --output <directory>', 'Output directory (default: ./manifests)')
  .option('-f, --format <format>', 'Output format (json|yaml)', 'json')
  .action(async (integrationId, platformsStr, options) => {
    try {
      const manager = new CrossPlatformIntegrationManager();
      const integration = manager.getIntegration(integrationId);
      
      if (!integration) {
        console.error(`❌ Integration not found: ${integrationId}`);
        process.exit(1);
      }

      const platforms = platformsStr.split(',').map((p: string) => p.trim());
      const outputDir = options.output || './manifests';

      console.log(`\\n📄 Generating manifests for: ${integration.name}`);
      console.log(`Platforms: ${platforms.join(', ')}`);
      console.log(`Output Directory: ${outputDir}\\n`);

      // Ensure output directory exists
      await fs.promises.mkdir(outputDir, { recursive: true });

      const generatedManifests: string[] = [];

      for (const platform of platforms) {
        try {
          const manifest = manager.generateManifest(integrationId, platform);
          const platformDir = path.join(outputDir, platform);
          
          await fs.promises.mkdir(platformDir, { recursive: true });
          
          const fileName = options.format === 'yaml' ? 'manifest.yaml' : 'manifest.json';
          const filePath = path.join(platformDir, fileName);
          
          let content: string;
          if (options.format === 'yaml') {
            // For simplicity, we'll just output JSON for now
            // In a real implementation, you'd use a YAML library
            content = JSON.stringify(manifest, null, 2);
          } else {
            content = JSON.stringify(manifest, null, 2);
          }
          
          await fs.promises.writeFile(filePath, content);
          generatedManifests.push(filePath);
          
          console.log(`✅ Generated: ${filePath}`);
          
        } catch (error) {
          console.error(`❌ Failed to generate manifest for ${platform}: ${error}`);
        }
      }

      console.log(`\\n🎉 Generated ${generatedManifests.length} manifest files`);

    } catch (error) {
      logger.error('Manifest generation failed:', error);
      process.exit(1);
    }
  });

/**
 * Build integration for platforms
 */
program
  .command('build')
  .description('Build integration for specified platforms')
  .argument('<integration-id>', 'Integration ID')
  .argument('<platforms>', 'Comma-separated list of platforms')
  .option('-o, --output <directory>', 'Output directory (default: ./dist)')
  .option('-s, --source <directory>', 'Source directory (default: ./src)')
  .option('--env <environment>', 'Build environment (development|production)', 'production')
  .option('--no-source-maps', 'Disable source maps')
  .option('--no-minify', 'Disable minification')
  .option('--report', 'Generate build report')
  .option('--report-file <file>', 'Build report output file')
  .action(async (integrationId, platformsStr, options) => {
    try {
      const manager = new CrossPlatformIntegrationManager();
      const integration = manager.getIntegration(integrationId);
      
      if (!integration) {
        console.error(`❌ Integration not found: ${integrationId}`);
        process.exit(1);
      }

      const platforms = platformsStr.split(',').map((p: string) => p.trim());
      const config: BuildConfiguration = {
        integrationId,
        platforms,
        outputDirectory: options.output || './dist',
        sourceDirectory: options.source || './src',
        optimizationLevel: options.env as 'development' | 'production',
        includeSourceMaps: options.sourceMaps !== false,
        minify: options.minify !== false,
        environment: {
          NODE_ENV: options.env || 'production',
          INTEGRATION_ID: integrationId
        }
      };

      console.log(`\\n🔨 Building: ${integration.name}`);
      console.log(`Platforms: ${platforms.join(', ')}`);
      console.log(`Environment: ${options.env}`);
      console.log(`Output Directory: ${config.outputDirectory}\\n`);

      const builder = new CrossPlatformBuilder();
      const report = await builder.build(config);

      // Display results
      console.log('\\n📊 Build Results:\\n');
      
      report.results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const size = result.bundleSize > 0 ? `(${(result.bundleSize / 1024).toFixed(1)} KB)` : '';
        console.log(`${status} ${result.platform.toUpperCase()}: ${result.buildTime}ms ${size}`);
        
        if (result.warnings.length > 0) {
          result.warnings.forEach(warning => console.log(`   ⚠️  ${warning}`));
        }
        
        if (result.errors.length > 0) {
          result.errors.forEach(error => console.log(`   ❌ ${error}`));
        }
      });

      // Summary
      console.log(`\\n📈 Build Summary:`);
      console.log(`   Total Time: ${report.summary.totalBuildTime}ms`);
      console.log(`   Successful: ${report.summary.successCount}/${report.results.length}`);
      console.log(`   Failed: ${report.summary.failureCount}/${report.results.length}`);
      console.log(`   Total Size: ${(report.summary.totalSize / 1024).toFixed(1)} KB`);
      console.log(`   Average Size: ${(report.summary.averageSize / 1024).toFixed(1)} KB`);

      // Compatibility information
      if (report.compatibility.warnings.length > 0) {
        console.log('\\n⚠️  Compatibility Warnings:');
        report.compatibility.warnings.forEach(warning => {
          console.log(`   ${warning}`);
        });
      }

      if (report.compatibility.unsupportedPlatforms.length > 0) {
        console.log('\\n❌ Unsupported Platforms:');
        report.compatibility.unsupportedPlatforms.forEach(platform => {
          console.log(`   ${platform}`);
        });
      }

      // Save build report
      if (options.report) {
        const reportFile = options.reportFile || `build-report-${Date.now()}.json`;
        await fs.promises.writeFile(reportFile, JSON.stringify(report, null, 2));
        console.log(`\\n📄 Build report saved to: ${reportFile}`);
      }

      // Exit with error code if any builds failed
      if (report.summary.failureCount > 0) {
        process.exit(1);
      }

    } catch (error) {
      logger.error('Build failed:', error);
      process.exit(1);
    }
  });

/**
 * Export integration package
 */
program
  .command('export')
  .description('Export integration package for distribution')
  .argument('<integration-id>', 'Integration ID')
  .argument('<platforms>', 'Comma-separated list of platforms')
  .option('-o, --output <file>', 'Output file (default: ./package.json)')
  .option('-f, --format <format>', 'Export format (json|yaml)', 'json')
  .action(async (integrationId, platformsStr, options) => {
    try {
      const manager = new CrossPlatformIntegrationManager();
      const integration = manager.getIntegration(integrationId);
      
      if (!integration) {
        console.error(`❌ Integration not found: ${integrationId}`);
        process.exit(1);
      }

      const platforms = platformsStr.split(',').map((p: string) => p.trim());
      const outputFile = options.output || './package.json';

      console.log(`\\n📦 Exporting: ${integration.name}`);
      console.log(`Platforms: ${platforms.join(', ')}`);
      console.log(`Output File: ${outputFile}\\n`);

      const packageData = manager.exportIntegrationPackage(integrationId, platforms);
      
      let content: string;
      if (options.format === 'yaml') {
        content = JSON.stringify(packageData, null, 2); // Simplified - use YAML library in production
      } else {
        content = JSON.stringify(packageData, null, 2);
      }
      
      await fs.promises.writeFile(outputFile, content);

      console.log('✅ Export complete!');
      console.log(`\\n📋 Package Contents:`);
      console.log(`   Integration: ${packageData.integration.name} (${packageData.integration.id})`);
      console.log(`   Version: ${packageData.integration.version}`);
      console.log(`   Platforms: ${packageData.platforms.length}`);
      console.log(`   Build Config: ${Object.keys(packageData.build).length} configurations`);

    } catch (error) {
      logger.error('Export failed:', error);
      process.exit(1);
    }
  });

/**
 * Generate feature matrix documentation
 */
program
  .command('feature-matrix')
  .description('Generate feature compatibility matrix documentation')
  .option('-o, --output <file>', 'Output file (default: ./FEATURE_MATRIX.md)')
  .option('-f, --format <format>', 'Output format (markdown|json|yaml)', 'markdown')
  .action(async (options) => {
    try {
      const outputFile = options.output || './FEATURE_MATRIX.md';
      
      console.log(`\\n📊 Generating Feature Matrix...`);
      console.log(`Output: ${outputFile}\\n`);

      let content: string;
      
      if (options.format === 'json') {
        const { PLATFORM_FEATURES } = await import('./CrossPlatformUtils');
        content = JSON.stringify(PLATFORM_FEATURES, null, 2);
      } else if (options.format === 'yaml') {
        const { PLATFORM_FEATURES } = await import('./CrossPlatformUtils');
        content = JSON.stringify(PLATFORM_FEATURES, null, 2); // Simplified - use YAML library
      } else {
        content = '# Spur Cross-Platform Feature Compatibility Matrix\\n\\n';
        content += CrossPlatformUtils.generateFeatureMatrixDocumentation();
        content += '\\n\\n## Legend\\n';
        content += '- ✅ - Supported\\n';
        content += '- ❌ - Not supported\\n';
        content += '- None - No fallback available\\n\\n';
        content += 'Generated on: ' + new Date().toISOString() + '\\n';
      }
      
      await fs.promises.writeFile(outputFile, content);

      console.log('✅ Feature matrix generated successfully!');
      
    } catch (error) {
      logger.error('Feature matrix generation failed:', error);
      process.exit(1);
    }
  });

/**
 * Validate integration configuration
 */
program
  .command('validate')
  .description('Validate integration configuration')
  .argument('<integration-id>', 'Integration ID')
  .option('-f, --file <file>', 'Configuration file to validate')
  .option('--strict', 'Treat warnings as errors')
  .action(async (integrationId, options) => {
    try {
      let integration: any;
      
      if (options.file) {
        // Load integration from file
        const fileContent = await fs.promises.readFile(options.file, 'utf-8');
        integration = JSON.parse(fileContent);
      } else {
        // Use built-in integration
        const manager = new CrossPlatformIntegrationManager();
        integration = manager.getIntegration(integrationId);
        
        if (!integration) {
          console.error(`❌ Integration not found: ${integrationId}`);
          process.exit(1);
        }
      }

      console.log(`\\n🔍 Validating: ${integration.name || integrationId}\\n`);

      const errors = CrossPlatformUtils.validateIntegration(integration);
      
      if (errors.length === 0) {
        console.log('✅ Integration configuration is valid!');
      } else {
        console.log('❌ Integration configuration has issues:\\n');
        errors.forEach((error, index) => {
          console.log(`${index + 1}. ${error}`);
        });
        
        if (options.strict) {
          process.exit(1);
        }
      }

      // Additional validation checks
      const platforms = ['chrome', 'firefox', 'edge', 'safari'];
      const compatibilityWarnings: string[] = [];
      
      platforms.forEach(platform => {
        try {
          const report = CrossPlatformUtils.generateCompatibilityReport(integration, platform);
          if (!report.compatible) {
            compatibilityWarnings.push(`${platform}: ${report.missingFeatures.join(', ')}`);
          }
        } catch (error) {
          compatibilityWarnings.push(`${platform}: Validation failed`);
        }
      });

      if (compatibilityWarnings.length > 0) {
        console.log('\\n⚠️  Compatibility Warnings:\\n');
        compatibilityWarnings.forEach(warning => {
          console.log(`- ${warning}`);
        });
        
        if (options.strict) {
          process.exit(1);
        }
      }

    } catch (error) {
      logger.error('Validation failed:', error);
      process.exit(1);
    }
  });

/**
 * Generate platform types
 */
program
  .command('generate-types')
  .description('Generate TypeScript types for platform')
  .argument('<platform>', 'Platform (chrome|firefox|edge|safari)')
  .option('-o, --output <file>', 'Output file (default: ./types/<platform>.d.ts)')
  .action(async (platform, options) => {
    try {
      const validPlatforms = ['chrome', 'firefox', 'edge', 'safari'];
      if (!validPlatforms.includes(platform)) {
        console.error(`❌ Invalid platform: ${platform}. Valid options: ${validPlatforms.join(', ')}`);
        process.exit(1);
      }

      const outputFile = options.output || `./types/${platform}.d.ts`;
      
      console.log(`\\n📝 Generating TypeScript types for: ${platform.toUpperCase()}`);
      console.log(`Output: ${outputFile}\\n`);

      const types = CrossPlatformUtils.generatePlatformTypes(platform);
      
      // Ensure output directory exists
      await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
      await fs.promises.writeFile(outputFile, types);

      console.log('✅ TypeScript types generated successfully!');

    } catch (error) {
      logger.error('Type generation failed:', error);
      process.exit(1);
    }
  });

/**
 * Interactive setup wizard
 */
program
  .command('setup')
  .description('Interactive setup wizard for new integration')
  .action(async () => {
    try {
      console.log('\\n🚀 Spur Cross-Platform Integration Setup Wizard\\n');
      console.log('This wizard will help you create a new cross-platform integration.\\n');

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const askQuestion = (question: string): Promise<string> => {
        return new Promise(resolve => {
          rl.question(question, resolve);
        });
      };

      // Collect integration information
      const name = await askQuestion('Integration name: ');
      const id = await askQuestion('Integration ID (alphanumeric, hyphens): ');
      const description = await askQuestion('Description: ');
      
      console.log('\\nSelect target platforms (comma-separated):');
      console.log('1. Chrome');
      console.log('2. Firefox');
      console.log('3. Edge');
      console.log('4. Safari');
      const platformsInput = await askQuestion('Platforms (e.g., 1,2,4): ');
      
      const platformMap: Record<string, string> = {
        '1': 'chrome',
        '2': 'firefox', 
        '3': 'edge',
        '4': 'safari'
      };
      
      const platforms = platformsInput
        .split(',')
        .map(p => platformMap[p.trim()])
        .filter(Boolean);

      console.log('\\n✅ Setup Complete!');
      console.log(`\\nIntegration Summary:`);
      console.log(`   Name: ${name}`);
      console.log(`   ID: ${id}`);
      console.log(`   Description: ${description}`);
      console.log(`   Platforms: ${platforms.join(', ')}`);
      
      console.log('\\nNext steps:');
      console.log('1. Create the integration configuration file');
      console.log('2. Implement the integration logic');
      console.log('3. Test with the CLI commands');
      console.log('4. Build for target platforms');

      rl.close();

    } catch (error) {
      logger.error('Setup wizard failed:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();