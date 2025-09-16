import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenSourceExtractor } from '@/integrations/extraction/OpenSourceExtractor'
import { ComponentAdapter } from '@/integrations/extraction/ComponentAdapter'
import { LicenseValidator } from '@/integrations/extraction/LicenseValidator'

// Mock dependencies
vi.mock('@/integrations/extraction/LicenseValidator')
vi.mock('@/integrations/extraction/ComponentAdapter')

describe('OpenSourceExtractor', () => {
  let extractor: OpenSourceExtractor
  let mockLicenseValidator: any
  let mockComponentAdapter: any
  let mockConfig: any

  beforeEach(() => {
    mockLicenseValidator = {
      validateLicense: vi.fn().mockReturnValue({
        isValid: true,
        licenseType: 'MIT',
        restrictions: [],
        attributionRequired: true
      }),
      checkCompatibility: vi.fn().mockReturnValue(true)
    }

    mockComponentAdapter = {
      createAdapter: vi.fn().mockReturnValue({
        initialize: vi.fn().mockResolvedValue(true),
        execute: vi.fn().mockResolvedValue({ success: true }),
        cleanup: vi.fn()
      }),
      validateInterface: vi.fn().mockReturnValue(true)
    }

    mockConfig = {
      extractionPath: './temp/extract',
      targetComponents: [
        {
          name: 'leon-ai',
          repository: 'https://github.com/leon-ai/leon',
          version: 'latest',
          license: 'MIT',
          requiredFiles: ['src/core/', 'src/skills/', 'package.json']
        },
        {
          name: 'inbox-zero',
          repository: 'https://github.com/elie222/inbox-zero',
          version: 'main',
          license: 'MIT',
          requiredFiles: ['src/', 'package.json', 'README.md']
        },
        {
          name: 'mailvelope',
          repository: 'https://github.com/mailvelope/mailvelope',
          version: 'main',
          license: 'GPL-3.0',
          requiredFiles: ['src/', 'package.json']
        }
      ],
      extractionRules: {
        removeBranding: true,
        removeUI: true,
        extractCoreLogic: true,
        preserveDocumentation: true,
        generateWrappers: true
      }
    }

    vi.mocked(LicenseValidator).mockImplementation(() => mockLicenseValidator)
    vi.mocked(ComponentAdapter).mockImplementation(() => mockComponentAdapter)

    extractor = new OpenSourceExtractor(mockConfig)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(extractor).toBeDefined()
      expect(LicenseValidator).toHaveBeenCalledWith()
      expect(ComponentAdapter).toHaveBeenCalledWith()
    })

    it('should validate all target components on initialization', () => {
      const configWithInvalid = {
        ...mockConfig,
        targetComponents: [
          ...mockConfig.targetComponents,
          { name: 'invalid', repository: '', license: 'INVALID' }
        ]
      }

      mockLicenseValidator.validateLicense.mockReturnValueOnce({
        isValid: false,
        licenseType: 'INVALID',
        restrictions: ['no-modification'],
        attributionRequired: false
      })

      expect(() => new OpenSourceExtractor(configWithInvalid)).toThrow()
    })
  })

  describe('Repository Cloning', () => {
    it('should clone repositories successfully', async () => {
      const mockExec = vi.spyOn(require('child_process'), 'exec')
        .mockImplementation((command, callback) => {
          callback(null, { stdout: 'Cloned successfully', stderr: '' })
        })

      await extractor.cloneRepository('https://github.com/test/repo', './temp/repo')

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('git clone'),
        expect.any(Function)
      )

      mockExec.mockRestore()
    })

    it('should handle repository cloning failures', async () => {
      const mockExec = vi.spyOn(require('child_process'), 'exec')
        .mockImplementation((command, callback) => {
          callback(new Error('Clone failed'), { stdout: '', stderr: 'Clone failed' })
        })

      await expect(
        extractor.cloneRepository('https://github.com/test/repo', './temp/repo')
      ).rejects.toThrow('Clone failed')

      mockExec.mockRestore()
    })

    it('should handle specific branch/checkout', async () => {
      const mockExec = vi.spyOn(require('child_process'), 'exec')
        .mockImplementation((command, callback) => {
          callback(null, { stdout: 'Checked out successfully', stderr: '' })
        })

      await extractor.cloneRepository('https://github.com/test/repo', './temp/repo', 'v2.0.0')

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('git clone -b v2.0.0'),
        expect.any(Function)
      )

      mockExec.mockRestore()
    })
  })

  describe('Component Analysis', () => {
    it('should analyze repository structure', async () => {
      const mockFs = {
        readdirSync: vi.fn().mockReturnValue(['src', 'package.json', 'README.md']),
        statSync: vi.fn().mockReturnValue({ isDirectory: () => true })
      }

      vi.doMock('fs', () => mockFs)

      const structure = await extractor.analyzeRepository('./test/repo')

      expect(structure).toEqual({
        root: './test/repo',
        directories: ['src'],
        files: ['package.json', 'README.md'],
        packageJson: expect.any(Object)
      })
    })

    it('should identify core logic files', async () => {
      const mockFiles = [
        'src/core/brain.js',
        'src/skills/chat.js',
        'src/ui/components.jsx',
        'package.json',
        'README.md',
        'LICENSE'
      ]

      const coreFiles = await extractor.identifyCoreFiles(mockFiles, {
        extractCoreLogic: true,
        removeUI: true
      })

      expect(coreFiles).toEqual([
        'src/core/brain.js',
        'src/skills/chat.js'
      ])
    })

    it('should extract dependencies from package.json', () => {
      const packageJson = {
        name: 'test-component',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'express': '^4.0.0'
        },
        devDependencies: {
          'typescript': '^5.0.0'
        }
      }

      const dependencies = extractor.extractDependencies(packageJson)

      expect(dependencies).toEqual({
        production: ['react', 'express'],
        development: ['typescript']
      })
    })
  })

  describe('License Validation', () => {
    it('should validate MIT license compatibility', async () => {
      const result = await extractor.validateLicense('MIT', 'spur-super-app')

      expect(result.isValid).toBe(true)
      expect(result.licenseType).toBe('MIT')
      expect(mockLicenseValidator.validateLicense).toHaveBeenCalledWith('MIT', 'spur-super-app')
    })

    it('should validate GPL-3.0 license with restrictions', async () => {
      mockLicenseValidator.validateLicense.mockReturnValueOnce({
        isValid: true,
        licenseType: 'GPL-3.0',
        restrictions: ['share-alike', 'source-available'],
        attributionRequired: true
      })

      const result = await extractor.validateLicense('GPL-3.0', 'spur-super-app')

      expect(result.isValid).toBe(true)
      expect(result.restrictions).toContain('share-alike')
    })

    it('should reject incompatible licenses', async () => {
      mockLicenseValidator.validateLicense.mockReturnValueOnce({
        isValid: false,
        licenseType: 'PROPRIETARY',
        restrictions: ['no-modification', 'no-distribution'],
        attributionRequired: false
      })

      const result = await extractor.validateLicense('PROPRIETARY', 'spur-super-app')

      expect(result.isValid).toBe(false)
    })
  })

  describe('Component Extraction', () => {
    it('should extract core functionality from Leon AI', async () => {
      const mockRepoContent = {
        'src/core/brain.js': 'brain logic',
        'src/skills/chat.js': 'chat skill',
        'src/ui/chat.jsx': 'UI component',
        'package.json': JSON.stringify({ name: 'leon', version: '1.0.0' })
      }

      vi.spyOn(require('fs'), 'readdirSync').mockReturnValue(Object.keys(mockRepoContent))
      vi.spyOn(require('fs'), 'readFileSync').mockImplementation((path) => {
        const filename = path.split('/').pop()
        return mockRepoContent[filename] || ''
      })

      const extracted = await extractor.extractComponent('leon-ai', './temp/leon')

      expect(extracted).toEqual({
        name: 'leon-ai',
        version: '1.0.0',
        extractedFiles: ['src/core/brain.js', 'src/skills/chat.js'],
        removedFiles: ['src/ui/chat.jsx'],
        dependencies: expect.any(Object),
        adapter: expect.any(Object)
      })
    })

    it('should extract email processing from Inbox Zero', async () => {
      const mockRepoContent = {
        'src/email/processor.js': 'email processing',
        'src/ui/dashboard.jsx': 'dashboard UI',
        'src/utils/parser.js': 'email parser',
        'package.json': JSON.stringify({ name: 'inbox-zero', version: '2.0.0' })
      }

      vi.spyOn(require('fs'), 'readdirSync').mockReturnValue(Object.keys(mockRepoContent))
      vi.spyOn(require('fs'), 'readFileSync').mockImplementation((path) => {
        const filename = path.split('/').pop()
        return mockRepoContent[filename] || ''
      })

      const extracted = await extractor.extractComponent('inbox-zero', './temp/inbox-zero')

      expect(extracted.extractedFiles).toContain('src/email/processor.js')
      expect(extracted.extractedFiles).toContain('src/utils/parser.js')
      expect(extracted.removedFiles).toContain('src/ui/dashboard.jsx')
    })

    it('should extract encryption from Mailvelope', async () => {
      const mockRepoContent = {
        'src/crypto/encryption.js': 'PGP encryption',
        'src/crypto/keys.js': 'key management',
        'src/ui/key-manager.jsx': 'key UI',
        'package.json': JSON.stringify({ name: 'mailvelope', version: '4.0.0' })
      }

      vi.spyOn(require('fs'), 'readdirSync').mockReturnValue(Object.keys(mockRepoContent))
      vi.spyOn(require('fs'), 'readFileSync').mockImplementation((path) => {
        const filename = path.split('/').pop()
        return mockRepoContent[filename] || ''
      })

      const extracted = await extractor.extractComponent('mailvelope', './temp/mailvelope')

      expect(extracted.extractedFiles).toContain('src/crypto/encryption.js')
      expect(extracted.extractedFiles).toContain('src/crypto/keys.js')
      expect(extracted.removedFiles).toContain('src/ui/key-manager.jsx')
    })
  })

  describe('Branding Removal', () => {
    it('should remove branding from extracted files', async () => {
      const fileContent = `
        /**
         * Leon AI - The open source voice assistant
         * https://leon-ai.github.io/
         */
        
        const LeonBrain = {
          // Core brain logic
          process: function(input) {
            return leonAI.process(input);
          }
        };
        
        export default LeonBrain;
      `

      const cleaned = await extractor.removeBranding(fileContent, 'leon-ai')

      expect(cleaned).not.toContain('Leon AI')
      expect(cleaned).not.toContain('https://leon-ai.github.io/')
      expect(cleaned).not.toContain('leonAI.process')
      expect(cleaned).toContain('SpurBrain')
    })

    it('should preserve technical functionality while removing branding', async () => {
      const fileContent = `
        // Inbox Zero - Email processing library
        // MIT License
        
        const InboxZero = {
          parseEmail: function(email) {
            // Parse email content
            return parsedEmail;
          },
          
          categorize: function(email) {
            // Categorize email
            return category;
          }
        };
      `

      const cleaned = await extractor.removeBranding(fileContent, 'inbox-zero')

      expect(cleaned).toContain('parseEmail')
      expect(cleaned).toContain('categorize')
      expect(cleaned).not.toContain('Inbox Zero')
      expect(cleaned).toContain('SpurEmailProcessor')
    })
  })

  describe('Wrapper Generation', () => {
    it('should generate Spur-compatible wrapper interfaces', async () => {
      const component = {
        name: 'leon-ai',
        extractedFiles: ['src/core/brain.js'],
        entryPoint: 'src/core/brain.js',
        dependencies: { production: [], development: [] }
      }

      const wrapper = await extractor.generateWrapper(component)

      expect(wrapper).toContain('export class SpurLeonSkill')
      expect(wrapper).toContain('implements SpurSkillInterface')
      expect(wrapper).toContain('initialize()')
      expect(wrapper).toContain('execute()')
      expect(wrapper).toContain('cleanup()')
    })

    it('should generate type definitions for TypeScript integration', async () => {
      const component = {
        name: 'mailvelope',
        extractedFiles: ['src/crypto/encryption.js'],
        entryPoint: 'src/crypto/encryption.js',
        dependencies: { production: ['openpgp'], development: [] }
      }

      const types = await extractor.generateTypeDefinitions(component)

      expect(types).toContain('export interface SpurEncryptionService')
      expect(types).toContain('encrypt(message: string, publicKey: string)')
      expect(types).toContain('decrypt(encryptedMessage: string, privateKey: string)')
    })
  })

  describe('Integration Testing', () => {
    it('should test extracted component functionality', async () => {
      const component = {
        name: 'test-component',
        adapter: {
          initialize: vi.fn().mockResolvedValue(true),
          execute: vi.fn().mockResolvedValue({ success: true, data: 'test result' }),
          cleanup: vi.fn()
        }
      }

      const testResult = await extractor.testComponentIntegration(component)

      expect(testResult.success).toBe(true)
      expect(component.adapter.initialize).toHaveBeenCalled()
      expect(component.adapter.execute).toHaveBeenCalled()
      expect(component.adapter.cleanup).toHaveBeenCalled()
    })

    it('should handle component integration failures', async () => {
      const component = {
        name: 'failing-component',
        adapter: {
          initialize: vi.fn().mockRejectedValue(new Error('Initialization failed'))
        }
      }

      const testResult = await extractor.testComponentIntegration(component)

      expect(testResult.success).toBe(false)
      expect(testResult.error).toBe('Initialization failed')
    })
  })

  describe('Documentation Generation', () => {
    it('should generate integration documentation', async () => {
      const extractedComponents = [
        {
          name: 'leon-ai',
          version: '1.0.0',
          license: 'MIT',
          description: 'Voice assistant core logic',
          extractedFiles: ['src/core/brain.js']
        },
        {
          name: 'inbox-zero',
          version: '2.0.0',
          license: 'MIT',
          description: 'Email processing utilities',
          extractedFiles: ['src/email/processor.js']
        }
      ]

      const documentation = await extractor.generateDocumentation(extractedComponents)

      expect(documentation).toContain('# Spur Open Source Integration')
      expect(documentation).toContain('## Leon AI Integration')
      expect(documentation).toContain('## Inbox Zero Integration')
      expect(documentation).toContain('### License Information')
      expect(documentation).toContain('### Usage Examples')
    })

    it('should generate API documentation for extracted components', async () => {
      const component = {
        name: 'mailvelope',
        version: '4.0.0',
        entryPoint: 'src/crypto/encryption.js',
        methods: ['encrypt', 'decrypt', 'generateKey', 'importKey']
      }

      const apiDocs = await extractor.generateAPIDocumentation(component)

      expect(apiDocs).toContain('# SpurEncryptionService')
      expect(apiDocs).toContain('## Methods')
      expect(apiDocs).toContain('### encrypt(message, publicKey)')
      expect(apiDocs).toContain('### decrypt(encryptedMessage, privateKey)')
    })
  })

  describe('Error Handling', () => {
    it('should handle network failures during repository cloning', async () => {
      const mockExec = vi.spyOn(require('child_process'), 'exec')
        .mockImplementation((command, callback) => {
          callback(new Error('Network unreachable'), { stdout: '', stderr: 'Network unreachable' })
        })

      await expect(
        extractor.cloneRepository('https://github.com/test/repo', './temp/repo')
      ).rejects.toThrow('Network unreachable')

      mockExec.mockRestore()
    })

    it('should handle file system errors during extraction', async () => {
      vi.spyOn(require('fs'), 'readdirSync').mockImplementation(() => {
        throw new Error('Permission denied')
      })

      await expect(
        extractor.analyzeRepository('./nonexistent/path')
      ).rejects.toThrow('Permission denied')
    })

    it('should handle invalid package.json files', () => {
      const invalidPackageJson = 'invalid json content'

      expect(() => {
        extractor.extractDependencies(invalidPackageJson)
      }).toThrow()
    })
  })

  describe('Performance Optimization', () => {
    it('should parallelize repository operations', async () => {
      const repos = [
        { url: 'https://github.com/test/repo1', path: './temp/repo1' },
        { url: 'https://github.com/test/repo2', path: './temp/repo2' }
      ]

      const mockExec = vi.spyOn(require('child_process'), 'exec')
        .mockImplementation((command, callback) => {
          setTimeout(() => callback(null, { stdout: 'Success', stderr: '' }), 100)
        })

      const startTime = Date.now()
      await extractor.cloneRepositories(repos)
      const endTime = Date.now()

      // Should complete in roughly the time of a single operation due to parallelization
      expect(endTime - startTime).toBeLessThan(200)

      mockExec.mockRestore()
    })

    it('should cache extraction results for efficiency', async () => {
      const component = {
        name: 'test-component',
        path: './temp/test-component'
      }

      // First extraction
      const result1 = await extractor.extractWithCache(component)
      
      // Second extraction (should use cache)
      const result2 = await extractor.extractWithCache(component)

      expect(result1).toEqual(result2)
      // Verify caching by checking if expensive operations were skipped
    })
  })

  describe('Security Validation', ()    {
    it('should scan extracted code for security vulnerabilities', async () => {
      const maliciousCode = `
        const dangerousCode = {
          eval: function(userInput) {
            eval(userInput); // Security vulnerability
          },
          exec: function(command) {
            require('child_process').exec(command); // Command injection
          }
        };
      `

      const securityReport = await extractor.scanForVulnerabilities(maliciousCode)

      expect(securityReport.vulnerabilities.length).toBeGreaterThan(0)
      expect(securityReport.vulnerabilities).toContainEqual(
        expect.objectContaining({ type: 'code_injection', severity: 'high' })
      )
    })

    it('should validate safe import patterns', async () => {
      const safeCode = `
        import { secureFunction } from './utils/security.js';
        import * as crypto from 'crypto';
        
        const safeModule = {
          process: safeFunction,
          hash: crypto.createHash
        };
      `

      const validation = await extractor.validateImports(safeCode)

      expect(validation.isValid).toBe(true)
      expect(validation.safeImports).toContain('crypto')
      expect(validation.restrictedImports).toHaveLength(0)
    })

    it('should detect and block unsafe dependencies', async () => {
      const packageJson = {
        dependencies: {
          'safe-package': '^1.0.0',
          'eval-in-package': '^2.0.0',
          'child-process': '^3.0.0'
        }
      }

      const validation = await extractor.validateDependencies(packageJson)

      expect(validation.unsafeDependencies).toContain('eval-in-package')
      expect(validation.warnings.length).toBeGreaterThan(0)
    })
  })
})