# Spur Super App

**Always-on personal productivity companion that seamlessly connects your tools and workflows**

[![CI/CD](https://github.com/spur/super-app/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/spur/super-app/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-green.svg)](https://reactjs.org/)

## 🌟 Overview

Spur is a revolutionary super app that serves as an always-on, context-aware personal productivity companion. It combines sophisticated digital footprint analysis with proactive assistance across your tools and workflows, creating a unified system that captures your past patterns while guiding your future actions.

### Key Features

- **🧠 Intelligent Memory**: Builds a contextual knowledge graph from your digital activities
- **🤖 Always-On Assistant**: Natural language assistance powered by your personal context
- **🔗 Seamless Integration**: Connects browser, email, GitHub, VS Code, and more
- **🔒 Privacy-First**: All processing happens locally with optional encrypted backup
- **⚡ Lightning Fast**: <3% CPU overhead, sub-100ms response times
- **📱 Cross-Platform**: Browser extension + Progressive Web App

## 🚀 Quick Start

### Prerequisites

- Node.js 20.0+ with npm 10+
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Git 2.40+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/spur/super-app.git
   cd spur
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the project**
   ```bash
   npm run setup
   ```

4. **Start development**
   ```bash
   npm run dev
   ```

5. **Load the extension**
   - Navigate to `chrome://extensions/` in Chrome
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist-extension` directory

## 📁 Project Structure

```
spur/
├── src/
│   ├── extension/               # Browser extension
│   │   ├── background/         # Service worker and background scripts
│   │   ├── popup/             # Extension popup interface
│   │   ├── options/           # Extension settings page
│   │   ├── content/           # Content scripts for web pages
│   │   ├── assets/            # Extension assets and icons
│   │   └── manifest.json      # Extension manifest
│   ├── web/                   # Progressive Web App
│   │   ├── components/        # React components
│   │   ├── pages/             # Application pages
│   │   ├── lib/               # Utility libraries
│   │   └── public/            # Static assets
│   ├── capture/               # Data capture engine
│   │   ├── engine/            # Core capture logic
│   │   ├── normalizer/        # Event normalization
│   │   ├── stream/            # Real-time event streaming
│   │   └── monitor/           # Performance monitoring
│   ├── memory/                # Contextual memory graph
│   │   ├── graph/             # Graph database operations
│   │   ├── queries/           # Memory query engine
│   │   └── maintenance/       # Memory cleanup and optimization
│   ├── assistant/             # Always-on assistant core
│   │   ├── core/              # Assistant engine
│   │   ├── skills/            # Modular skill system
│   │   ├── nlp/               # Natural language processing
│   │   └── context/           # Context management
│   ├── integrations/          # External tool integrations
│   │   ├── email/             # Email processing (Gmail, etc.)
│   │   ├── github/            # GitHub workflow integration
│   │   ├── vscode/            # VS Code extension
│   │   └── extraction/        # Open-source component extraction
│   ├── ui/                    # Shared UI components
│   │   ├── components/        # Reusable UI components
│   │   ├── styles/            # CSS styles and themes
│   │   └── themes/            # Design system themes
│   ├── services/              # Core services
│   │   ├── storage.ts         # Database and storage management
│   │   ├── notifications.ts   # Notification system
│   │   └── analytics.ts       # Privacy-respecting analytics
│   ├── hooks/                 # Custom React hooks
│   ├── utils/                 # Utility functions
│   ├── stores/                # State management
│   ├── types/                 # TypeScript type definitions
│   └── tests/                 # Test files
├── docs/                      # Documentation
├── .github/                   # GitHub Actions workflows
├── dist-extension/            # Built extension files
├── dist-web/                  # Built web app files
├── package.json              # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── vite.config.ts           # Vite build configuration
└── README.md                # This file
```

## 🛠 Development

### Available Scripts

```bash
# Development
npm run dev              # Start both extension and web app in development mode
npm run dev:extension    # Start extension development only
npm run dev:web          # Start web app development only

# Building
npm run build            # Build both extension and web app
npm run build:extension  # Build extension only
npm run build:web        # Build web app only

# Testing
npm test                 # Run unit tests
npm run test:ui          # Run UI tests
npm run test:e2e         # Run end-to-end tests
npm run test:performance # Run performance tests

# Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format code with Prettier
npm run typecheck        # Run TypeScript type checking

# Utilities
npm run clean            # Clean build artifacts
npm run package          # Package extension for distribution
```

### Configuration

The project uses several configuration files:

- **`tsconfig.json`**: TypeScript configuration
- **`tailwind.config.js`**: Tailwind CSS configuration
- **`vite.web.config.ts`**: Vite configuration for web app
- **`vite.extension.config.ts`**: Vite configuration for extension
- **`.eslintrc.js`**: ESLint configuration
- **`.prettierrc.js`**: Prettier configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Development
NODE_ENV=development
VITE_APP_VERSION=0.1.0

# API Endpoints (if needed)
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000

# Analytics (optional)
VITE_ANALYTICS_ENABLED=false
VITE_ANALYTICS_ID=
```

## 🏗 Architecture

### Core Components

1. **Capture Engine**: Unified data capture from all sources
2. **Memory Graph**: Contextual knowledge graph storage
3. **Assistant Core**: Always-on intelligent assistance
4. **Integration Layer**: External tool connections
5. **UI System**: React-based interfaces

### Data Flow

```
User Activity → Capture Engine → Memory Graph → Assistant Context → User Assistance
     ↓                ↓                ↓                ↓
  Browser/Email    Normalization    Graph Queries    Natural Language
   GitHub/Code      Storage          Context Build    Response Generation
```

### Technology Stack

- **Frontend**: React 18+, TypeScript 5+, Tailwind CSS 3+, Framer Motion
- **Database**: SQLite 3+ (local), Dexie (IndexedDB wrapper)
- **Browser Extension**: Manifest V3, WebExtensions API
- **Build Tools**: Vite 5+, esbuild, Rollup
- **Testing**: Vitest, Playwright, Testing Library
- **State Management**: Zustand, React Query
- **ML/NLP**: TensorFlow.js, compromise.js, natural

## 🔧 Configuration

### Extension Manifest

The extension uses Manifest V3 with the following permissions:

- **Required**: `storage`, `tabs`, `activeTab`, `scripting`, `alarms`
- **Optional**: `bookmarks`, `history`, `cookies`, `downloads`
- **Host**: `<all_urls>` (with context-specific permissions)

### Privacy Settings

Spur is privacy-first by default:

```typescript
{
  privacy: {
    localOnly: true,           // All processing happens locally
    dataRetention: '90d',      // Auto-delete after 90 days
    anonymizeData: true,       // Remove personal identifiers
    encryptedBackup: false,    // Optional cloud backup
    permissionLevel: 'standard' // Granular permission control
  }
}
```

## 🧪 Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run with UI
npx playwright test --ui
```

### Performance Tests

```bash
# Run performance tests
npm run test:performance

# Generate performance report
npm run test:performance -- --reporter=html
```

## 📦 Deployment

### Extension Deployment

1. **Build the extension**
   ```bash
   npm run build:extension
   ```

2. **Package for distribution**
   ```bash
   npm run package
   ```

3. **Upload to extension stores**
   - Chrome Web Store
   - Firefox Add-ons
   - Edge Add-ons

### Web App Deployment

1. **Build the web app**
   ```bash
   npm run build:web
   ```

2. **Deploy to hosting**
   - Vercel (recommended)
   - Netlify
   - GitHub Pages
   - Custom hosting

### CI/CD Pipeline

The project includes a comprehensive CI/CD pipeline that:

- Runs quality checks (linting, formatting, type checking)
- Executes unit and integration tests
- Performs security scans
- Builds and packages artifacts
- Deploys to staging/production
- Runs performance and accessibility tests

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feat/amazing-feature`
3. **Make your changes**
4. **Run tests and linting**: `npm run lint && npm test`
5. **Commit your changes**: `git commit -m "feat: add amazing feature"`
6. **Push to branch**: `git push origin feat/amazing-feature`
7. **Open a Pull Request**

### Commit Convention

We use conventional commits:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `chore`: Build process or auxiliary tool changes

### Pull Request Template

When creating a PR, please include:

- Clear description of changes
- Related issue number
- Testing performed
- Performance impact
- Security considerations
- Screenshots (if applicable)

## 📝 Documentation

### API Documentation

API documentation is available in the `/docs/api` directory.

### Component Documentation

Component documentation is available in Storybook (when running development server).

### Architecture Documentation

Detailed architecture documentation is available in `/docs/architecture`.

## 🔒 Security

### Data Protection

- All processing happens locally by default
- Optional end-to-end encryption for cloud sync
- Regular security audits and vulnerability scanning
- GDPR and privacy regulation compliance

### Threat Model

The project maintains a comprehensive threat model addressing:

- Data injection attacks
- Privilege escalation
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Data exfiltration
- Denial of service

## 📊 Performance

### Benchmarks

- **CPU Usage**: <3% average, <5% peak
- **Memory Usage**: <150MB persistent footprint
- **Response Time**: <100ms for assistant queries
- **Database Performance**: <50ms for memory graph queries
- **UI Performance**: 60fps animations, <16ms frame time

### Optimization

- Lazy loading for components and resources
- Efficient database indexing
- Debounced event processing
- Virtual scrolling for large lists
- Image optimization and caching

## 🌐 Browser Support

- **Chrome**: 120+
- **Firefox**: 115+
- **Edge**: 120+
- **Safari**: 16+

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Spur incorporates and builds upon several open-source projects:

- **Leon AI** - Modular skill system architecture
- **Inbox Zero** - Email processing and prioritization
- **Mailvelope** - OpenPGP encryption implementation
- **Dexie** - IndexedDB wrapper for local storage
- **TensorFlow.js** - Machine learning in the browser
- **Compromise.js** - Natural language processing

## 📞 Support

- **Documentation**: [docs.spur.com](https://docs.spur.com)
- **Issues**: [GitHub Issues](https://github.com/spur/super-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/spur/super-app/discussions)
- **Community**: [Discord Server](https://discord.gg/spur)

## 🚀 Roadmap

### Version 0.1 (Current)
- ✅ Core architecture foundation
- ✅ Browser extension with basic capture
- ✅ Local memory graph storage
- ✅ Assistant with natural language
- 🔄 Email integration (Gmail)
- 🔄 GitHub workflow integration
- 🔄 VS Code extension

### Version 0.2 (Q1 2024)
- Advanced pattern recognition
- Cross-context insights
- Team collaboration features
- Mobile PWA optimization
- Advanced analytics dashboard

### Version 0.3 (Q2 2024)
- Machine learning enhancements
- Enterprise features
- Advanced integrations
- Performance optimizations
- Expanded platform support

---

**Built with ❤️ by the Spur Team**

*"Your digital life, seamlessly connected and intelligently enhanced."*