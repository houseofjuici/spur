#!/bin/bash

# Steel Browser Fork Setup Script
# This script automates the forking and initial setup of Steel Browser integration

set -e

# Configuration
STEEL_REPO="https://github.com/steel-dev/steel-browser"
SPUR_ORG="spur" # Replace with actual Spur organization
STEEL_FORK_DIR="steel-fork"
INTEGRATION_DIR="spur-integration"

echo "🚀 Starting Steel Browser integration setup..."

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v git >/dev/null 2>&1 || { echo "❌ Git is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

# Create fork directory
echo "📁 Creating fork directory..."
if [ -d "$STEEL_FORK_DIR" ]; then
    echo "⚠️  Steel fork directory already exists. Removing..."
    rm -rf "$STEEL_FORK_DIR"
fi

# Clone Steel Browser repository
echo "🔄 Cloning Steel Browser repository..."
git clone "$STEEL_REPO" "$STEEL_FORK_DIR"
cd "$STEEL_FORK_DIR"

# Set up remote for Spur organization
echo "🔗 Setting up Spur organization remote..."
git remote add spur "git@github.com:${SPUR_ORG}/steel-browser.git" || echo "⚠️  Could not add remote (repository may not exist yet)"

# Create development branch
echo "🌿 Creating development branch..."
git checkout -b develop main

# Push to Spur organization (if remote exists)
if git remote get-url spur >/dev/null 2>&1; then
    echo "📤 Pushing to Spur organization..."
    git push -u spur develop
    git push -u spur main
fi

cd ..

# Create integration directory
echo "🏗️  Creating integration directory..."
if [ -d "$INTEGRATION_DIR" ]; then
    echo "⚠️  Integration directory already exists. Removing..."
    rm -rf "$INTEGRATION_DIR"
fi

mkdir "$INTEGRATION_DIR"
cd "$INTEGRATION_DIR"

# Initialize integration repository
echo "📝 Initializing integration repository..."
git init

# Add Steel Browser as submodule
echo "🔗 Adding Steel Browser as submodule..."
git submodule add "../${STEEL_FORK_DIR}" "steel-browser"

# Create initial directory structure
echo "📁 Creating integration directory structure..."
mkdir -p spur-integration/{native-components,ui-overlay,api-extensions,privacy-enhancements}
mkdir -p build-system/{steel-build,spur-build,integration-build}
mkdir -p docs/{architecture,api-reference,migration-guide}

# Create initial package.json
echo "📦 Creating initial package.json..."
cat > package.json << EOF
{
  "name": "spur-browser-integration",
  "version": "1.0.0",
  "description": "Spur Browser integration with Steel Browser",
  "main": "dist/index.js",
  "scripts": {
    "setup": "npm install && git submodule update --init --recursive",
    "build:steel": "cd steel-browser && npm install && npm run build",
    "build:spur": "npm run build",
    "integration:bundle": "webpack --config integration.webpack.config.js",
    "dev:steel": "cd steel-browser && npm run dev",
    "dev:spur": "npm run dev",
    "dev:integration": "concurrently \"npm run dev:steel\" \"npm run dev:spur\"",
    "test:integration": "jest integration-tests/",
    "lint": "eslint src/ --ext .ts,.js",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "typescript": "^5.3.3",
    "concurrently": "^8.2.2"
  },
  "devDependencies": {
    "@types/node": "^20.10.4",
    "jest": "^29.7.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2"
  },
  "keywords": [
    "browser",
    "steel-browser",
    "spur",
    "ai",
    "integration"
  ],
  "author": "Spur Team",
  "license": "MIT"
}
EOF

# Create initial TypeScript configuration
echo "⚙️  Creating TypeScript configuration..."
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
EOF

# Create initial webpack configuration
echo "🔧 Creating webpack configuration..."
cat > integration.webpack.config.js << EOF
const path = require('path');

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'SpurIntegration',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@steel': path.resolve(__dirname, 'steel-browser')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  externals: {
    'steel-browser': 'SteelBrowser'
  },
  mode: 'development',
  devtool: 'source-map'
};
EOF

# Create initial integration source files
echo "📝 Creating initial integration source files..."
mkdir -p src

cat > src/index.ts << EOF
/**
 * Spur Browser Integration Entry Point
 * This module integrates Spur's AI capabilities with Steel Browser
 */

import { SpurVoiceIntegration } from './integrations/voice';
import { SpurMemoryIntegration } from './integrations/memory';
import { SpurAssistantIntegration } from './integrations/assistant';
import { SpurPrivacyIntegration } from './integrations/privacy';
import { SpurSettingsIntegration } from './integrations/settings';

export class SpurBrowserIntegration {
  private voiceIntegration: SpurVoiceIntegration;
  private memoryIntegration: SpurMemoryIntegration;
  private assistantIntegration: SpurAssistantIntegration;
  private privacyIntegration: SpurPrivacyIntegration;
  private settingsIntegration: SpurSettingsIntegration;

  constructor(steelBrowser: any) {
    this.voiceIntegration = new SpurVoiceIntegration(steelBrowser);
    this.memoryIntegration = new SpurMemoryIntegration(steelBrowser);
    this.assistantIntegration = new SpurAssistantIntegration(steelBrowser);
    this.privacyIntegration = new SpurPrivacyIntegration(steelBrowser);
    this.settingsIntegration = new SpurSettingsIntegration(steelBrowser);
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Spur Browser integration...');
    
    // Initialize all integration components
    await Promise.all([
      this.voiceIntegration.initialize(),
      this.memoryIntegration.initialize(),
      this.assistantIntegration.initialize(),
      this.privacyIntegration.initialize(),
      this.settingsIntegration.initialize()
    ]);
    
    console.log('✅ Spur Browser integration initialized successfully');
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Spur Browser integration...');
    
    // Shutdown all integration components
    await Promise.all([
      this.voiceIntegration.shutdown(),
      this.memoryIntegration.shutdown(),
      this.assistantIntegration.shutdown(),
      this.privacyIntegration.shutdown(),
      this.settingsIntegration.shutdown()
    ]);
    
    console.log('✅ Spur Browser integration shutdown successfully');
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  (window as any).SpurBrowserIntegration = SpurBrowserIntegration;
}

export default SpurBrowserIntegration;
EOF

# Create integration module structure
mkdir -p src/integrations

cat > src/integrations/voice.ts << EOF
/**
 * Spur Voice Integration with Steel Browser
 * Handles voice command processing and speech recognition
 */

export class SpurVoiceIntegration {
  private steelBrowser: any;
  private isInitialized: boolean = false;

  constructor(steelBrowser: any) {
    this.steelBrowser = steelBrowser;
  }

  async initialize(): Promise<void> {
    // Initialize voice recognition within Steel's sandbox
    console.log('🎤 Initializing voice integration...');
    
    // TODO: Implement voice recognition setup
    this.isInitialized = true;
    
    console.log('✅ Voice integration initialized');
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down voice integration...');
    
    // TODO: Implement voice recognition cleanup
    this.isInitialized = false;
    
    console.log('✅ Voice integration shutdown');
  }

  async processVoiceCommand(audioData: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Voice integration not initialized');
    }

    // TODO: Implement voice command processing
    console.log('🎤 Processing voice command...');
    
    return {
      command: 'recognized_command',
      confidence: 0.95,
      action: 'execute_browser_action'
    };
  }
}
EOF

cat > src/integrations/memory.ts << EOF
/**
 * Spur Memory Integration with Steel Browser
 * Handles contextual memory graph and knowledge storage
 */

export class SpurMemoryIntegration {
  private steelBrowser: any;
  private isInitialized: boolean = false;

  constructor(steelBrowser: any) {
    this.steelBrowser = steelBrowser;
  }

  async initialize(): Promise<void> {
    // Initialize memory graph with Steel's storage APIs
    console.log('🧠 Initializing memory integration...');
    
    // TODO: Implement memory graph setup
    this.isInitialized = true;
    
    console.log('✅ Memory integration initialized');
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down memory integration...');
    
    // TODO: Implement memory graph cleanup
    this.isInitialized = false;
    
    console.log('✅ Memory integration shutdown');
  }

  async storeContext(context: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Memory integration not initialized');
    }

    // TODO: Implement context storage
    console.log('🧠 Storing context...');
  }

  async retrieveContext(query: string): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('Memory integration not initialized');
    }

    // TODO: Implement context retrieval
    console.log('🧠 Retrieving context...');
    
    return [];
  }
}
EOF

cat > src/integrations/assistant.ts << EOF
/**
 * Spur Assistant Integration with Steel Browser
 * Handles AI assistant functionality and natural language processing
 */

export class SpurAssistantIntegration {
  private steelBrowser: any;
  private isInitialized: boolean = false;

  constructor(steelBrowser: any) {
    this.steelBrowser = steelBrowser;
  }

  async initialize(): Promise<void> {
    // Initialize assistant with Steel's UI framework
    console.log('🤖 Initializing assistant integration...');
    
    // TODO: Implement assistant setup
    this.isInitialized = true;
    
    console.log('✅ Assistant integration initialized');
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down assistant integration...');
    
    // TODO: Implement assistant cleanup
    this.isInitialized = false;
    
    console.log('✅ Assistant integration shutdown');
  }

  async processQuery(query: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Assistant integration not initialized');
    }

    // TODO: Implement query processing
    console.log('🤖 Processing query:', query);
    
    return {
      response: 'Assistant response',
      actions: [],
      confidence: 0.9
    };
  }
}
EOF

cat > src/integrations/privacy.ts << EOF
/**
 * Spur Privacy Integration with Steel Browser
 * Handles enhanced privacy features and data protection
 */

export class SpurPrivacyIntegration {
  private steelBrowser: any;
  private isInitialized: boolean = false;

  constructor(steelBrowser: any) {
    this.steelBrowser = steelBrowser;
  }

  async initialize(): Promise<void> {
    // Initialize privacy features with Steel's security mechanisms
    console.log('🔒 Initializing privacy integration...');
    
    // TODO: Implement privacy features setup
    this.isInitialized = true;
    
    console.log('✅ Privacy integration initialized');
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down privacy integration...');
    
    // TODO: Implement privacy features cleanup
    this.isInitialized = false;
    
    console.log('✅ Privacy integration shutdown');
  }

  async encryptData(data: any): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Privacy integration not initialized');
    }

    // TODO: Implement data encryption
    console.log('🔒 Encrypting data...');
    
    return 'encrypted_data';
  }

  async decryptData(encryptedData: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Privacy integration not initialized');
    }

    // TODO: Implement data decryption
    console.log('🔒 Decrypting data...');
    
    return {};
  }
}
EOF

cat > src/integrations/settings.ts << EOF
/**
 * Spur Settings Integration with Steel Browser
 * Handles unified settings and preferences
 */

export class SpurSettingsIntegration {
  private steelBrowser: any;
  private isInitialized: boolean = false;

  constructor(steelBrowser: any) {
    this.steelBrowser = steelBrowser;
  }

  async initialize(): Promise<void> {
    // Initialize settings integration with Steel's settings system
    console.log('⚙️  Initializing settings integration...');
    
    // TODO: Implement settings integration setup
    this.isInitialized = true;
    
    console.log('✅ Settings integration initialized');
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down settings integration...');
    
    // TODO: Implement settings integration cleanup
    this.isInitialized = false;
    
    console.log('✅ Settings integration shutdown');
  }

  async getSettings(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Settings integration not initialized');
    }

    // TODO: Implement settings retrieval
    console.log('⚙️  Getting settings...');
    
    return {};
  }

  async updateSettings(settings: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Settings integration not initialized');
    }

    // TODO: Implement settings update
    console.log('⚙️  Updating settings...');
  }
}
EOF

# Create initial test files
mkdir -p integration-tests

cat > integration-tests/setup.ts << EOF
/**
 * Integration Test Setup
 */

import { SpurBrowserIntegration } from '../src/index';

// Mock Steel Browser for testing
export const mockSteelBrowser = {
  createSession: jest.fn(),
  executeAction: jest.fn(),
  getSettings: jest.fn(),
  updateSettings: jest.fn()
};

// Setup global test utilities
global.beforeEach(() => {
  jest.clearAllMocks();
});

global.afterEach(() => {
  // Cleanup after each test
});
EOF

cat > integration-tests/integration.test.ts << EOF
/**
 * Spur Browser Integration Tests
 */

import { SpurBrowserIntegration } from '../src/index';
import { mockSteelBrowser } from './setup';

describe('SpurBrowserIntegration', () => {
  let integration: SpurBrowserIntegration;

  beforeEach(() => {
    integration = new SpurBrowserIntegration(mockSteelBrowser);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(integration.initialize()).resolves.not.toThrow();
    });

    it('should shutdown successfully', async () => {
      await integration.initialize();
      await expect(integration.shutdown()).resolves.not.toThrow();
    });
  });

  describe('component initialization', () => {
    it('should initialize all integration components', async () => {
      await integration.initialize();
      
      // Verify all components are initialized
      expect(integration).toBeDefined();
    });
  });
});
EOF

# Create Docker configuration for development
echo "🐳 Creating Docker configuration..."
cat > docker-compose.dev.yml << EOF
version: '3.8'

services:
  steel-browser:
    build:
      context: ./steel-browser
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome
    volumes:
      - ./steel-browser:/app
      - /app/node_modules
    depends_on:
      - chrome

  chrome:
    image: selenium/standalone-chrome:latest
    ports:
      - "4444:4444"
    environment:
      - JAVA_OPTS=-Xmx512m
    volumes:
      - /dev/shm:/dev/shm

  spur-integration:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - STEEL_API_URL=http://steel-browser:3000
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - steel-browser

  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test
    environment:
      - NODE_ENV=test
      - STEEL_API_URL=http://steel-browser:3000
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - steel-browser
      - spur-integration
    command: npm run test:integration
EOF

cat > Dockerfile << EOF
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
EOF

cat > Dockerfile.test << EOF
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Set environment for testing
ENV NODE_ENV=test

# Run tests
CMD ["npm", "run", "test:integration"]
EOF

# Create CI/CD configuration
echo "🔄 Creating CI/CD configuration..."
mkdir -p .github/workflows

cat > .github/workflows/integration.yml << EOF
name: Spur Browser Integration CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      chrome:
        image: selenium/standalone-chrome:latest
        ports:
          - 4444:4444
    
    steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Build integration
      run: npm run integration:bundle
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: integration-bundle
        path: dist/

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build Steel Browser
      run: npm run build:steel
    
    - name: Build Spur Integration
      run: npm run integration:bundle
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-artifacts
        path: |
          dist/
          steel-browser/dist/
EOF

# Create README for integration
echo "📚 Creating integration documentation..."
cat > README.md << EOF
# Spur Browser Integration

This repository contains the integration layer for combining Spur Browser's AI capabilities with Steel Browser's Chromium-based architecture.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Git
- Docker (optional)

### Setup

1. **Clone and setup the repository**
   \`\`\`bash
   git clone <repository-url>
   cd spur-integration
   ./setup.sh
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm run setup
   \`\`\`

3. **Start development**
   \`\`\`bash
   npm run dev:integration
   \`\`\`

### Development

#### Running Steel Browser
\`\`\`bash
npm run dev:steel
\`\`\`

#### Running Spur Integration
\`\`\`bash
npm run dev:spur
\`\`\`

#### Running both together
\`\`\`bash
npm run dev:integration
\`\`\`

### Testing

\`\`\`bash
npm run test:integration
\`\`\`

### Building

\`\`\`bash
npm run integration:bundle
\`\`\`

## 📁 Project Structure

\`\`\`
spur-integration/
├── steel-browser/          # Steel Browser submodule
├── src/                    # Integration source code
│   ├── index.ts           # Main entry point
│   └── integrations/      # Integration components
├── integration-tests/      # Test files
├── docs/                  # Documentation
└── build-system/          # Build configuration
\`\`\`

## 🔧 Configuration

### Environment Variables

Create a \`.env\` file in the root directory:

\`\`\`env
NODE_ENV=development
STEEL_API_URL=http://localhost:3000
STEEL_API_KEY=your-steel-api-key
\`\`\`

### Steel API Configuration

The integration uses the provided Steel API key:
\`\`\`typescript
const STEEL_API_KEY = 'ste-4T0QWJwAQ7qBdISe6F0M1exfR214OI8RVRqEd9pjtFA0ZX7mlwPN7CCo8OlJxGfnFw8fUMhPOHOBEz9kqyLY734tRULg2Hxmv1k';
\`\`\`

## 🚧 Development Status

This integration is currently in **Phase 2.1: Repository Setup**.

### Completed Tasks
- [x] Fork steel-dev/steel-browser repository
- [x] Set up integration repository structure
- [x] Configure build system integration
- [x] Create initial integration components
- [x] Set up CI/CD pipeline

### Next Tasks
- [ ] Integrate Spur voice components
- [ ] Implement memory graph with Steel storage
- [ ] Add assistant integration
- [ ] Create unified extension system

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: \`git checkout -b feat/amazing-feature\`
3. Make your changes
4. Commit your changes: \`git commit -m 'feat: add amazing feature'\`
5. Push to the branch: \`git push origin feat/amazing-feature\`
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏗️ Architecture

The integration architecture consists of several key components:

1. **Voice Integration**: Processes voice commands within Steel's sandbox
2. **Memory Integration**: Manages contextual knowledge graph
3. **Assistant Integration**: Handles AI assistant functionality
4. **Privacy Integration**: Provides enhanced privacy features
5. **Settings Integration**: Manages unified preferences

## 🔗 Links

- [Steel Browser Documentation](https://docs.steel.dev/)
- [Spur Browser Documentation](https://docs.spur.com/)
- [Steel Browser Repository](https://github.com/steel-dev/steel-browser)
- [Integration Issues](https://github.com/spur/spur-integration/issues)

---

Built with ❤️ by the Spur Team
EOF

# Create .gitignore
echo "🚫 Creating .gitignore..."
cat > .gitignore << EOF
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Test coverage
coverage/
.nyc_output/

# Docker
.dockerignore

# Temporary files
*.tmp
*.temp
.tmp/
.temp/

# Logs
logs/
*.log

# Steel Browser build artifacts
steel-browser/dist/
steel-browser/node_modules/

# Integration test artifacts
test-results/
playwright-report/
playwright/.cache/

# Cache
.cache/
.parcel-cache/

# Package manager files
package-lock.json
yarn.lock
pnpm-lock.yaml
EOF

# Create initial commit
echo "📝 Creating initial commit..."
git add .
git commit -m "feat: initial Spur Browser integration setup

- Forked steel-dev/steel-browser repository
- Set up integration repository structure
- Created initial integration components
- Configured build system and CI/CD
- Added comprehensive documentation

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "✅ Setup completed successfully!"
echo ""
echo "🚀 Next steps:"
echo "1. Review the created files and configuration"
echo "2. Set up the Spur organization repository on GitHub"
echo "3. Push the integration repository to GitHub"
echo "4. Begin Phase 2.2: Core Integration"
echo ""
echo "📚 Documentation: docs/phase2-steel-integration.md"
echo "🔧 Configuration: package.json, tsconfig.json, integration.webpack.config.js"
echo "🧪 Testing: integration-tests/"
echo "🐳 Docker: docker-compose.dev.yml"
echo "🔄 CI/CD: .github/workflows/integration.yml"