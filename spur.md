Spur

# Claude Code Implementation Prompt: Spur Super App

## Project Overview

You are tasked with implementing **Spur**, a revolutionary **super app** that serves as an always-on, context-aware personal productivity companion. Spur combines sophisticated digital footprint analysis with proactive assistance across your tools and workflows, creating a unified system that captures your past patterns while guiding your future actions.

### Core Philosophy
Spur is your **active digital partner** that:

1. **Captures & Analyzes** (Memory Layer): Records and synthesizes your digital life into a rich contextual memory graph
2. **Assists & Guides** (Assistant Layer): Provides always-on, intelligent assistance across email, GitHub, VS Code, YouTube, and more
3. **Connects & Integrates** (Integration Layer): Bridges your tools with intelligent automation and cross-context insights

**The Vision**: A seamless experience where your email patterns inform your coding suggestions, your GitHub activity feeds your learning recommendations, and your captured insights become proactive guidance—all powered by a unified assistant interface with deep memory access for power users.

### Target Users
- **Knowledge Workers**: Researchers, writers, analysts who need pattern recognition across their digital tools
- **Developers**: Coders who want contextual assistance across IDEs, GitHub, and learning resources
- **Productivity Enthusiasts**: Users seeking an always-on companion that understands their workflows
- **Privacy-Conscious Professionals**: Those who want local-first processing with optional encrypted sync

---

## System Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   CAPTURE       │    │   MEMORY GRAPH   │    │   ASSISTANT      │
│   ENGINE        │───▶│   (Timelines)    │───▶│   CORE           │
│                 │    │                  │    │                  │
│ • Browser tabs  │    │ • Activity nodes │    │ • Natural lang.  │
│ • System apps   │    │ • Pattern edges  │    │ • Skill system   │
│ • Email activity│    │ • Semantic links │    │ • Context aware  │
│ • Code editing  │    │ • Relevance      │    │ • Proactive      │
│ • GitHub flows  │    │   scoring        │    │   suggestions    │
└─────────────────┘    └──────────────────┘    └──────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   INTEGRATIONS  │    │   ML ENGINE      │    │   UNIFIED UI     │
│                 │    │                  │    │                  │
│ • Email (Gmail) │◀──▶│ • Pattern recog. │◀──▶│ • Assistant chat │
│ • VS Code       │    │ • Insight gen.   │    │ • Timeline view  │
│ • GitHub API    │    │ • Recommendation │    │ • Pattern maps   │
│ • YouTube       │    │ • NLP processing │    │ • Integration    │
│ • File system   │    │                  │    │   management     │
└─────────────────┘    └──────────────────┘    └──────────────────┘
```

### Key Architecture Principles

1. **Unified Data Pipeline**: All captured activity flows through one system, serving both memory storage and real-time assistant context
2. **Modular Skill System**: Assistant capabilities built as interchangeable "skills" that leverage the memory graph
3. **Local-First Privacy**: All processing happens locally with optional encrypted cloud backup
4. **Progressive Enhancement**: Core functionality available immediately, advanced integrations unlock additional power
5. **Contextual Intelligence**: Assistant responses always informed by your historical patterns and current activity

---

## Project Structure & Repositories

### Core Repositories (7 Total)

1. **spur-core** - Main browser extension, unified capture engine, and system integration
2. **spur-engine** - ML analysis, pattern recognition, and recommendation systems
3. **spur-dashboard** - React-based unified interface (assistant-first with deep views)
4. **spur-api** - Internal APIs for memory, assistant, and integration communication
5. **spur-integrations** - External app integrations and open-source component adapters
6. **spur-docs** - Comprehensive documentation, architecture guides, and user manuals
7. **spur-infra** - Docker, CI/CD, deployment, and monitoring infrastructure

### Repository Structure Example (spur-core)

```
spur-core/
├── src/
│   ├── capture/              # Unified data capture engine
│   │   ├── unified-engine.ts
│   │   ├── event-normalizer.ts
│   │   └── assistant-stream.ts
│   ├── memory/               # Contextual memory graph (evolved timelines)
│   │   ├── graph-builder.ts
│   │   ├── context-query.ts
│   │   └── relevance-scorer.ts
│   ├── assistant/            # Always-on assistant core
│   │   ├── core/
│   │   ├── skills/
│   │   ├── nlp/
│   │   └── context/
│   ├── integrations/         # Integration hooks and native messaging
│   ├── ui/                   # Shared UI components
│   └── types/                # TypeScript definitions
├── extension/                # Browser extension files
│   ├── manifest.json
│   ├── background.ts
│   └── content-scripts/
├── tests/                    # Comprehensive test suite
└── package.json
```

---

## Technology Stack

### Core Technologies
- **Frontend**: React 18+, TypeScript 5+, Tailwind CSS 3+, D3.js 7+ for visualizations
- **Backend**: Node.js 20+, Express.js 4+, SQLite 3+ (local storage), PostgreSQL 15+ (enterprise)
- **Browser Extension**: WebExtensions API (Manifest V3), compatible with Chrome/Edge/Firefox
- **Build Tools**: Vite 5+, esbuild 0.19+, Rollup 4+
- **State Management**: Zustand 4+, React Query 5+, React Context
- **Testing**: Vitest 1+, Playwright 1.4+, Cypress 13+

### ML & AI Stack
- **Client-Side ML**: TensorFlow.js 4+, ONNX Runtime Web
- **NLP Processing**: compromise.js 14+, natural 6+
- **Pattern Recognition**: Custom algorithms + scikit-learn.js wrappers
- **Recommendation Engine**: Collaborative filtering + content-based systems

### Integration Technologies (NEW)
- **Assistant Framework**: Leon AI skill architecture (modular, offline-capable)
- **Email Processing**: IMAP/OAuth2 clients + Inbox Zero methodology
- **Code Integration**: VS Code Extension API + Language Server Protocol (LSP)
- **External APIs**: GitHub GraphQL API, YouTube Data API v3, OAuth2 flows
- **Security**: OpenPGP.js (Mailvelope-inspired), Web Crypto API
- **Event System**: RxJS 7+ for reactive streams, EventEmitter3

### Infrastructure
- **Containerization**: Docker 25+, Docker Compose 2.24+
- **CI/CD**: GitHub Actions, semantic-release for versioning
- **Monitoring**: Sentry 8+, custom performance metrics
- **Deployment**: Chrome Web Store, Firefox Add-ons, self-hosted options

---

## Open Source Component Integration

### Required Integrations

Spur will integrate core components from these open-source projects, extracting functionality while removing original branding:

1. **Leon AI** (`https://github.com/leon-ai/leon`)
   - **Extract**: Modular skill system, offline execution framework, message parsing
   - **Purpose**: Build extensible assistant capabilities
   - **License**: MIT

2. **Inbox Zero** (`https://github.com/elie222/inbox-zero`)
   - **Extract**: Email parsing, AI summarization, follow-up tracking, prioritization algorithms
   - **Purpose**: Smart email processing and action item extraction
   - **License**: MIT

3. **Mailvelope** (`https://github.com/mailvelope/mailvelope`)
   - **Extract**: OpenPGP encryption, local key management, secure message handling
   - **Purpose**: End-to-end encrypted communication support
   - **License**: GPL-3.0

4. **Gemma / VS Code Assistant** (Google's Gemma model integration + VS Code APIs)
   - **Extract**: Context-aware code suggestions, VS Code extension architecture
   - **Purpose**: Developer workflow assistance and code pattern recognition
   - **License**: Apache 2.0

### Integration Strategy

```
Phase 1: Extraction Planning
├── License compatibility audit for all components
├── Dependency mapping and minimal extraction requirements
├── Interface design for Spur architecture compatibility
└── Risk assessment for each component

Phase 2: Technical Extraction
├── Clone repositories to secure extraction workspace
├── Isolate core algorithms and data structures (no UI)
├── Remove all original branding, logos, and attribution
├── Create Spur-specific wrapper interfaces
├── Implement comprehensive unit tests for extracted code
└── Optimize for browser environment constraints

Phase 3: Architecture Integration
├── Map components to appropriate Spur modules
├── Implement memory graph integration points
├── Create unified skill interfaces for assistant consumption
├── Ensure local-first execution compatibility
├── Performance optimization and memory footprint reduction
└── End-to-end integration testing

Phase 4: Documentation & Attribution
├── Create internal documentation for each integration
├── Maintain `CREDITS.md` with proper attribution
├── Document modification history and integration approach
├── Ensure all user-facing elements show only "Spur" branding
└── Legal compliance verification
```

**Important**: All extractions must remove original branding from user-facing components. Credits appear only in documentation (`spur-docs/CREDITS.md`), never in the application UI.

---

## Development Phases

### Phase 1: Foundation & Unified Architecture (Weeks 1-2)

**Primary Goals**: Establish super app foundation with unified data flow

**Issue #1: Enhanced Project Initialization**
```
Title: Initialize Spur Super App with unified multi-repo architecture
Description:
- Create all 7 GitHub repositories with consistent structure
- Implement shared TypeScript configuration across repositories
- Set up conventional commits, semantic versioning, and changelog automation
- Configure ESLint 9+, Prettier 3+, Husky 9+ with shared configs
- Create comprehensive GitHub Actions CI/CD pipeline
- Design and document super app architecture diagrams

Shared Configuration:
- TypeScript 5.4+ with strict mode enabled
- ESLint with React and TypeScript rules
- Prettier 3.1+ for consistent formatting
- Husky pre-commit hooks for linting/formatting
- Commitlint 19+ for conventional commits

CI Pipeline Requirements:
- Linting and formatting checks on all pushes
- Type checking across all TypeScript files
- Basic unit test execution
- Dependency vulnerability scanning
- Build verification for all packages

Files to Create:
- /.github/workflows/ci.yml (shared across repos)
- /tsconfig.json (shared base configuration)
- /.eslintrc.js (shared ESLint config)
- /prettier.config.js (shared formatting)
- /commitlint.config.js
- /architecture/
│   ├── super-app-overview.md
│   ├── data-flow-diagram.md
│   └── component-relationships.md
- /package.json with core dependencies for each repo
- /.gitignore with Node.js/browser extension patterns
- /README.md with project overview and setup instructions

Acceptance Criteria:
- All 7 repositories created and properly structured
- Shared configurations work across all repos
- CI pipeline passes on initial commits
- Architecture documentation clearly explains data flow
- Type safety established across the entire codebase
- Development environment ready for parallel work
```

**Issue #2: Unified Capture Engine Foundation**
```
Title: Implement unified data capture pipeline serving memory and assistant
Description:
- Design event-driven capture system for all activity types
- Create real-time streaming to both memory storage and assistant context
- Implement event normalization and schema validation
- Add integration hooks for external applications
- Build performance monitoring and overhead control

Unified Event Schema:
interface UnifiedEvent {
  id: string;
  timestamp: number;
  type: 'browser' | 'system' | 'email' | 'code' | 'github' | 'youtube';
  source: string;
  metadata: Record<string, any>;
  content?: any;
  context?: MemoryContext;
  priority?: number; // For assistant relevance
}

Data Flow Architecture:
1. Capture Sources → Event Collector → Normalization
2. Normalized Events → Memory Graph Storage (async)
3. Normalized Events → Assistant Context Stream (real-time)
4. Assistant Actions → Capture Feedback Loop

Performance Requirements:
- Event processing latency < 50ms
- Memory usage < 100MB for 24hr activity
- CPU overhead < 3% during normal operation
- Debounced processing for high-frequency events

Files:
/src/capture/
├── unified-engine.ts          # Main capture orchestrator
├── event-collector.ts         # Source-specific event gathering
├── event-normalizer.ts        # Schema validation and normalization
├── assistant-stream.ts        # Real-time context delivery
├── performance-monitor.ts     # Overhead tracking and alerts
└── types/unified-events.ts    # Type definitions

/src/types/
└── memory-context.ts          # Context structures for assistant

Acceptance Criteria:
- Multiple event types captured and normalized correctly
- Events stream to both memory and assistant systems
- Performance stays within specified limits
- TypeScript types cover all event structures
- Error handling prevents capture system crashes
- Integration hooks ready for external sources
```

**Issue #3: Contextual Memory Graph Implementation**
```
Title: Build knowledge graph evolving from timeline architecture
Description:
- Design graph database schema for activities, patterns, and relationships
- Implement efficient storage using SQLite with spatial extensions
- Create graph query language for assistant context retrieval
- Add semantic relationship extraction from captured events
- Implement relevance scoring and memory decay algorithms

Memory Graph Schema:
interface MemoryNode {
  id: string;
  type: 'activity' | 'pattern' | 'resource' | 'concept';
  timestamp: number;
  content: any;
  metadata: Record<string, any>;
  relationships: MemoryEdge[];
  relevanceScore: number;
  decayFactor: number;
}

interface MemoryEdge {
  targetId: string;
  type: 'temporal' | 'semantic' | 'causal' | 'spatial';
  strength: number;
  context: string;
  timestamp: number;
}

Core Algorithms:
- Temporal Clustering: Group related activities by time windows
- Semantic Similarity: Extract concepts and link related content
- Relevance Scoring: Combine recency, frequency, and user interaction
- Memory Decay: Exponential decay based on access patterns
- Graph Pruning: Remove low-relevance connections periodically

Query Interface for Assistant:
- Natural language to graph query translation
- Context window management (recent + relevant)
- Relevance-ranked result sets
- Real-time updates from capture stream

Files:
/src/memory/
├── graph/
│   ├── database.ts            # SQLite graph storage
│   ├── schema.ts              # Graph schema definitions
│   └── migrations/            # Database migrations
├── nodes/
│   ├── activity-node.ts       # Activity representation
│   ├── pattern-node.ts        # Detected pattern nodes
│   └── resource-node.ts       # External resource tracking
├── edges/
│   ├── relationship-builder.ts # Edge creation logic
│   └── semantic-extractor.ts   # Concept relationship detection
├── queries/
│   ├── context-query.ts       # Assistant context retrieval
│   ├── relevance-scorer.ts    # Scoring algorithms
│   └── natural-language.ts    # NL to graph query translation
└── maintenance/
    ├── decay-processor.ts     # Memory decay implementation
    ├── pruning-service.ts     # Graph cleanup
    └── backup-manager.ts      # Encrypted backup/restore

/src/types/
└── memory-graph.ts            # Complete type definitions

Acceptance Criteria:
- Graph database stores and retrieves complex relationships
- Semantic queries return relevant context efficiently
- Relevance scoring prioritizes important memories correctly
- Memory decay maintains performance without losing key context
- Backup/restore preserves graph integrity
- Query performance scales to 100K+ nodes
```

### Phase 1 Sprint Goals
- Complete super app foundation with unified architecture
- Working capture pipeline feeding both memory and assistant systems
- Contextual memory graph with basic query capabilities
- Shared infrastructure and type safety across all repositories
- Open source integration planning completed

---

### Phase 2: Always-On Assistant Core (Weeks 3-5)

**Primary Goals**: Build flagship assistant experience with memory integration

**Issue #4: Always-On Assistant Core Architecture**
```
Title: Implement flagship always-on assistant foundation
Description:
- Create persistent assistant interface with multiple interaction modes
- Build modular skill system architecture (Leon-inspired)
- Implement natural language processing pipeline for browser
- Design context-aware response generation system
- Create unified event bus connecting all Spur components

Assistant Architecture Components:
1. Core Engine: Message processing, context orchestration, skill execution
2. Skill System: Modular capabilities (memory, email, patterns, integrations)
3. Context Manager: Memory graph + real-time activity + conversation state
4. UI Layer: Chat interface, voice commands, system notifications
5. Event Bus: Reactive communication between all system components

Interaction Modes:
- Proactive Mode: Context-triggered suggestions and notifications
- Reactive Mode: User-initiated queries via chat/voice/hotkeys
- Ambient Mode: Background processing with gentle nudges
- Deep Mode: Full dashboard access for complex analysis

Technical Requirements:
- Offline-capable NLP processing using compromise.js + custom models
- Skill architecture supporting hot-swapping and extension
- Context window management with 10K token capacity
- Response generation combining templates + ML insights
- Privacy-focused local execution with optional cloud enhancement

Files:
/src/assistant/
├── core/
│   ├── assistant-engine.ts    # Main orchestrator
│   ├── message-processor.ts   # Input handling and routing
│   └── response-generator.ts  # Output creation and formatting
├── skills/
│   ├── skill-manager.ts       # Skill lifecycle and execution
│   ├── skill-interface.ts     # Standard skill contract
│   └── base-skill.ts          # Base class for all skills
├── nlp/
│   ├── natural-language.ts    # Core NLP processing
│   ├── intent-recognizer.ts   # User intent detection
│   └── entity-extractor.ts    # Named entity recognition
├── context/
│   ├── context-manager.ts     # Unified context handling
│   ├── conversation-state.ts  # Chat history management
│   └── real-time-context.ts   # Live activity integration
└── ui/
    ├── assistant-interface.tsx # Main chat UI
    ├── voice-handler.ts        # Speech recognition/synthesis
    └── notification-system.tsx # System notifications

/src/events/
└── unified-bus.ts             # Global event communication

/src/types/
└── assistant.ts               # Assistant type definitions

Acceptance Criteria:
- Assistant responds to basic natural language queries
- Skill system loads and executes modular capabilities
- Context manager provides relevant historical information
- Multiple UI modes work seamlessly (chat, voice, notifications)
- Performance maintains <100ms response latency
- Local execution works without network connectivity
- Privacy controls prevent unauthorized data access
```

**Issue #5: Assistant Memory Integration**
```
Title: Connect assistant to contextual memory backbone with NL querying
Description:
- Implement memory graph querying optimized for conversational use
- Create natural language interface to captured patterns and activities
- Build context-aware response generation using historical data
- Add persistent conversation memory across browser sessions
- Enable assistant to reference and explain specific past activities

Query Processing Pipeline:
1. User Query → Intent Recognition → Graph Query Translation
2. Memory Graph Query → Relevance Scoring → Context Assembly
3. Context + Current Activity → Response Generation
4. Response Delivery → Conversation State Update

Advanced Features:
- Temporal queries: "What was I doing last Tuesday at 2pm?"
- Pattern queries: "Show me my recent coding patterns"
- Resource queries: "Find that GitHub repo I looked at yesterday"
- Relationship queries: "How does this email connect to my project?"
- Explanatory queries: "Why do you think this is important?"

Technical Implementation:
- GraphQL-like query builder for memory retrieval
- Template-based response generation with dynamic memory insertion
- Relevance scoring combining recency, importance, and user preferences
- Conversation state management with automatic context window pruning
- Fallback mechanisms for incomplete or ambiguous memory

Files:
/src/assistant/
├── memory/
│   ├── memory-query.ts        # Graph query builder
│   ├── nl-to-graph.ts         # Natural language query translation
│   ├── historical-context.ts  # Past activity integration
│   └── memory-augmentation.ts # Response enhancement with memory
├── conversation/
│   ├── conversation-manager.ts # Chat state management
│   ├── context-window.ts      # Conversation context handling
│   └── feedback-processor.ts  # User interaction learning
└── responses/
    ├── template-system.ts     # Response templating
    ├── dynamic-insertion.ts   # Memory content integration
    └── explanation-generator.ts # Pattern and insight explanation

/src/memory/
└── assistant-queries/         # Assistant-specific query optimizations

Acceptance Criteria:
- Assistant successfully queries and explains memory content
- Natural language queries retrieve relevant historical context
- Conversation maintains coherent context across multiple turns
- Response generation combines current context with historical insights
- Performance maintains conversational responsiveness (<2s)
- Memory references include timestamps and confidence scores
- User can drill down from assistant responses to original sources
```

**Issue #6: Proactive Assistant Intelligence**
```
Title: Implement intelligent proactive assistance behaviors
Description:
- Create pattern-triggered suggestions based on real-time activity analysis
- Build cross-context insight delivery connecting disparate information sources
- Implement gentle workflow nudges and intelligent completions
- Add machine learning from user feedback and interaction patterns
- Design non-intrusive notification system with smart timing

Proactive Trigger System:
- Activity Pattern Detection: Recognizes workflow signatures
- Context Analysis: Identifies cross-app relationships and opportunities
- Timing Optimization: Delivers suggestions at optimal moments
- Personalization Engine: Adapts to user preferences and feedback
- Escalation Logic: Moves from subtle hints to direct assistance

Trigger Examples:
- Email + GitHub Pattern: "I see you're discussing this feature—want me to create a GitHub issue?"
- Learning Gaps: "Based on your recent coding, you might benefit from learning React patterns"
- Forgotten Context: "You were researching X yesterday—want me to refresh that context?"
- Workflow Completion: "You've finished the research phase—ready to start implementation?"
- Resource Connection: "This article connects to your project Y—should I add it to your notes?"

Feedback Learning System:
- Explicit feedback: Thumbs up/down on suggestions
- Implicit feedback: Interaction patterns and response times
- Adaptive algorithms: Adjust suggestion frequency and style
- Personalization: Learn user preferences for interaction modes
- Performance tracking: Measure suggestion effectiveness

Files:
/src/assistant/
├── proactive/
│   ├── trigger-system.ts      # Pattern and context detection
│   ├── suggestion-engine.ts   # Intelligent recommendation generation
│   ├── timing-optimizer.ts    # Smart delivery scheduling
│   └── escalation-manager.ts  # Assistance level progression
├── feedback/
│   ├── feedback-collector.ts  # User interaction capture
│   ├── learning-algorithms.ts # Adaptive improvement system
│   └── personalization.ts     # User preference modeling
└── notifications/
    ├── notification-manager.tsx # UI notification system
    ├── smart-timing.ts         # Delivery optimization
    └── priority-queue.ts       # Notification prioritization

/src/patterns/
└── proactive-patterns.ts      # Assistant-specific pattern recognition

Acceptance Criteria:
- Assistant delivers contextually relevant proactive suggestions
- Suggestions respect user preferences and timing
- Feedback system learns from user interactions
- Notification system remains non-intrusive
- Cross-context insights connect disparate information sources
- Performance impact remains minimal during proactive processing
- User can configure and fine-tune proactive behaviors
```

### Phase 2 Sprint Goals
- Fully functional always-on assistant with natural language capabilities
- Deep integration with contextual memory graph
- Intelligent proactive behaviors based on user patterns
- Modular skill system ready for integrations
- Responsive assistant UI with multiple interaction modes

---

### Phase 3: Integration Layer Implementation (Weeks 6-9)

**Primary Goals**: Connect external tools and extract open-source components

**Issue #7: Open Source Component Extraction & Integration**
```
Title: Extract and integrate open-source components under Spur architecture
Description:
- Systematically extract core functionality from target repositories
- Remove all original branding and create Spur-compatible interfaces
- Implement memory integration for extracted components
- Create unified skill interfaces for assistant consumption
- Ensure local-first execution and privacy compliance

Extraction Targets and Requirements:

1. LEON AI (https://github.com/leon-ai/leon)
   - Extract: Modular skill architecture, offline execution framework
   - Remove: All UI components, original branding, server dependencies
   - Adapt: Create TypeScript interfaces, integrate with Spur event bus
   - Memory Integration: Skills access unified memory graph
   - Performance: Optimize for browser execution constraints

2. INBOX ZERO (https://github.com/elie222/inbox-zero)
   - Extract: Email parsing algorithms, prioritization logic, action extraction
   - Remove: React components, original UI, external dependencies
   - Adapt: Create email processing skill, integrate with capture system
   - Memory Integration: Email activities become memory nodes
   - Security: Ensure local processing of email content

3. MAILVELOPE (https://github.com/mailvelope/mailvelope)
   - Extract: OpenPGP encryption/decryption, key management
   - Remove: Browser extension UI, original branding
   - Adapt: Create secure communication skill, integrate with email skill
   - Memory Integration: Encrypted content metadata (not content)
   - Security: Browser-native crypto implementation

4. GEMMA / VS CODE ASSISTANT
   - Extract: Context-aware code suggestion patterns, VS Code API integration
   - Remove: Original model dependencies, UI components
   - Adapt: Create code companion skill, integrate with file monitoring
   - Memory Integration: Code patterns become specialized memory nodes
   - Performance: Lightweight implementation for real-time suggestions

Technical Implementation:
- Create extraction workspace with all source repositories
- Implement component isolation with minimal dependencies
- Build adapter layers for Spur architecture compatibility
- Create comprehensive integration tests for each component
- Document extraction process and modification rationale
- Ensure 100% type coverage for integrated components

Files:
/src/integrations/
├── extraction/
│   ├── leon-adapter.ts        # Leon skill system integration
│   ├── inbox-zero.ts          # Email processing algorithms
│   ├── mailvelope.ts          # PGP encryption implementation
│   └── vscode-gemma.ts        # Code assistance patterns
├── skills/
│   ├── email-skill.ts         # Integrated email capabilities
│   ├── security-skill.ts      # Encryption and secure comms
│   ├── code-skill.ts          # Developer assistance
│   └── base-integration-skill.ts # Template for future integrations
└── memory/
    ├── integration-nodes.ts   # Specialized node types for integrations
    └── relationship-mappers.ts # Cross-integration connections

/src/docs/
└── CREDITS.md                 # Proper attribution documentation

Acceptance Criteria:
- All extracted components function within Spur architecture
- Original branding completely removed from user-facing elements
- Components integrate seamlessly with memory and assistant systems
- Local execution works without external dependencies
- Integration tests cover 90%+ of extracted functionality
- Performance impact of integrations stays within limits
- Documentation clearly explains integration approach and credits
```

**Issue #8: Email & Communication Integration**
```
Title: Implement comprehensive email assistant with Inbox Zero methodology
Description:
- Build full email client integration supporting Gmail, Outlook, and IMAP
- Implement Inbox Zero processing with AI-powered prioritization
- Create smart reply generation and intelligent follow-up tracking
- Extract action items and commitments from email content
- Integrate encrypted email support using extracted Mailvelope components

Email Integration Architecture:
- OAuth2 authentication for major providers (Gmail, Outlook, etc.)
- IMAP/SMTP support for custom email servers
- Local caching with encrypted storage of email metadata
- Real-time monitoring of inbox changes
- Background processing to minimize UI blocking

Inbox Zero Implementation:
- Zero Inbox: Process emails into actions, references, or archive
- One Touch: Single-action processing for most emails
- Context Clarity: Extract key information and relationships
- Batch Processing: Group similar emails for efficient handling
- Weekly Review: Automated preparation for email review sessions

Smart Features:
- Action Item Extraction: Convert commitments to tasks in memory
- Relationship Mapping: Track communication patterns and priorities
- Meeting Preparation: Extract calendar events and context
- Follow-up Reminders: Intelligent timing based on communication patterns
- Smart Categorization: AI-powered labeling and prioritization

Memory Integration:
- Email threads become conversation nodes in memory graph
- Recipients and relationships enhance social graph
- Action items link to relevant projects and timelines
- Communication patterns inform assistant behavior
- Email content (with permission) enriches semantic understanding

Security Implementation:
- End-to-end encryption for sensitive email content
- Local-only processing with no cloud transmission
- Granular permissions for email access and processing
- Secure key management for encrypted communications
- Audit logging for email processing activities

Files:
/src/integrations/
├── email/
│   ├── email-client.ts        # OAuth2 and IMAP implementation
│   ├── inbox-processor.ts     # Inbox Zero methodology
│   ├── action-extractor.ts    # Commitment and task extraction
│   ├── relationship-mapper.ts # Communication pattern analysis
│   └── smart-replies.ts       # Intelligent response generation
├── security/
│   ├── pgp-encryption.ts      # Mailvelope-based encryption
│   ├── key-manager.ts         # Local key storage and management
│   └── secure-comms.ts        # End-to-end encrypted messaging
└── memory/
    ├── email-nodes.ts         # Email-specific memory structures
    └── conversation-graph.ts  # Communication relationship mapping

/src/assistant/
└── skills/
    ├── email-skill.ts         # Email assistant capabilities
    └── calendar-skill.ts      # Meeting and scheduling integration

/src/types/
└── email-integration.ts       # Email-specific type definitions

Acceptance Criteria:
- Email client connects and processes messages from major providers
- Inbox Zero methodology implemented with smart categorization
- Action items automatically extracted and integrated with memory
- Encrypted email support working with local key management
- Assistant provides intelligent email-related suggestions
- Performance maintains responsiveness during email processing
- Privacy controls allow granular email access management
- Communication patterns enhance overall context understanding
```

**Issue #9: Developer Workflow Integration**
```
Title: Create comprehensive developer companion across IDE and GitHub
Description:
- Implement VS Code extension for real-time contextual assistance
- Build GitHub integration for workflow automation and PR assistance
- Create code pattern recognition across multiple projects
- Develop learning path recommendations from coding activity
- Enable cross-project context awareness and architecture insights

Developer Integration Architecture:
- VS Code Extension: Real-time code analysis and suggestions
- GitHub API Integration: Repository monitoring and automation
- File System Integration: Project structure understanding
- Language Server Integration: Enhanced code intelligence
- Learning Resource Integration: YouTube and documentation recommendations

VS Code Companion Features:
- Context-aware code suggestions based on project memory
- Real-time pattern recognition in current codebase
- Automated documentation and comment generation
- Refactoring suggestions based on historical patterns
- Integration with Spur memory for cross-project insights

GitHub Integration Features:
- Automatic PR summarization and review assistance
- Issue triage and labeling recommendations
- Pull request workflow automation
- Repository health monitoring and suggestions
- Collaboration pattern analysis across teams

Code Pattern Recognition:
- Architecture pattern detection across projects
- Code smell identification and refactoring suggestions
- Learning gap analysis from coding patterns
- Cross-project dependency understanding
- Evolution tracking of codebase patterns

Memory Integration:
- Code commits and changes become detailed activity nodes
- Project structures enhance resource understanding
- Issue discussions contribute to problem-solving patterns
- Learning resources link to skill development tracking
- Cross-project patterns create architectural insights

Files:
/src/integrations/
├── vscode/
│   ├── vscode-extension.ts    # VS Code integration
│   ├── code-analyzer.ts       # Real-time code pattern recognition
│   ├── suggestion-engine.ts   # Context-aware code suggestions
│   └── lsp-integration.ts     # Language server protocol support
├── github/
│   ├── github-client.ts       # GitHub API integration
│   ├── pr-assistant.ts        # Pull request automation
│   ├── issue-triage.ts        # Issue management assistance
│   └── collaboration.ts       # Team workflow analysis
└── learning/
    ├── code-learning.ts       # Developer skill development
    ├── resource-recommender.ts # Learning path suggestions
    └── pattern-evolution.ts   # Codebase evolution tracking

/src/assistant/
└── skills/
    ├── code-skill.ts          # Developer assistance capabilities
    └── github-skill.ts        # GitHub workflow integration

/src/memory/
└── code-nodes.ts              # Code-specific memory structures

Acceptance Criteria:
- VS Code extension provides real-time contextual assistance
- GitHub integration automates common developer workflows
- Code pattern recognition identifies meaningful insights
- Learning recommendations based on actual coding patterns
- Cross-project context awareness enhances development experience
- Memory integration captures detailed developer activity
- Performance maintains coding responsiveness
- Privacy controls for code and repository access
```

### Phase 3 Sprint Goals
- Complete open-source component extraction and integration
- Full email integration with smart processing capabilities
- Comprehensive developer tools spanning IDE and GitHub
- Assistant skills leveraging all integrated capabilities
- Cross-context insights connecting email, code, and learning

---

### Phase 4: Unified Interface & Experience (Weeks 10-12)

**Primary Goals**: Create seamless user experience with assistant as primary interface

**Issue #10: Assistant-First Interface Architecture**
```
Title: Design unified assistant-centric user experience
Description:
- Create always-on assistant as primary interaction point across all features
- Implement seamless transitions between interaction modes
- Build contextual UI that adapts to current user activity and context
- Design consistent interaction patterns across all integrated capabilities
- Create comprehensive onboarding for super app feature discovery

Interface Architecture Layers:
1. Ambient Layer: System tray icon, global hotkeys, background notifications
2. Assistant Layer: Persistent chat interface, voice commands, quick actions
3. Contextual Layer: Activity-specific UI enhancements and overlays
4. Dashboard Layer: Deep analysis views, timeline exploration, pattern maps
5. Integration Layer: Native-feeling interfaces within external applications

Progressive User Experience:
- New Users: Simple assistant interface with guided onboarding
- Regular Users: Contextual suggestions, quick actions, workflow automation
- Power Users: Full dashboard access, timeline exploration, custom configurations
- Expert Users: Advanced pattern analysis, memory editing, integration management

UI/UX Design Principles:
- Minimal intrusion with maximum context awareness
- Consistent interaction patterns across all features
- Progressive disclosure of complexity based on user sophistication
- Accessibility compliance (WCAG 2.2 AA)
- Performance-first rendering with smooth animations

Files:
/src/ui/
├── assistant/
│   ├── AssistantInterface.tsx  # Main chat and interaction hub
│   ├── voice/
│   │   ├── VoiceInput.tsx      # Speech recognition interface
│   │   └── VoiceOutput.tsx     # Text-to-speech responses
│   └── quick-actions/
│       ├── QuickActionBar.tsx  # Fast access to common tasks
│       └── ContextMenu.tsx     # Right-click integration
├── contextual/
│   ├── ActivityOverlay.tsx     # Context-specific UI enhancements
│   ├── SmartSuggestions.tsx    # Proactive inline recommendations
│   └── WorkflowGuides.tsx      # Step-by-step assistance overlays
├── navigation/
│   ├── GlobalNavigation.tsx    # Consistent app navigation
│   ├── AssistantRouter.tsx     # Skill and feature routing
│   └── DeepLinkHandler.tsx     # Cross-feature navigation
└── onboarding/
    ├── SuperAppOnboarding.tsx   # Initial user experience
    ├── FeatureDiscovery.tsx     # Progressive feature introduction
    └── PermissionFlow.tsx       # Granular permissions setup

/src/styles/
├── theme.ts                    # Unified design system
├── assistant-theme.ts          # Assistant-specific styling
└── accessibility.ts            # WCAG compliance utilities

/src/types/
└── ui-interfaces.ts            # UI component type definitions

Acceptance Criteria:
- Assistant interface provides seamless primary interaction experience
- Multiple interaction modes work consistently across features
- Contextual UI adapts appropriately to different activities
- Onboarding successfully introduces super app capabilities
- Accessibility standards met across all UI components
- Performance maintains 60fps interactions and <100ms responses
- User can easily discover and access all integrated features
- Consistent design language spans entire application
```

**Issue #11: Enhanced Memory Exploration Interface**
```
Title: Create power-user memory exploration with semantic timeline
Description:
- Transform timeline into interactive memory graph explorer interface
- Implement natural language search across all captured activities
- Build pattern drill-down capabilities with assistant explanations
- Add memory editing, annotation, and organization features
- Design timeline as deep context layer supporting assistant queries

Enhanced Memory Interface Features:
- Graph Visualization: Interactive node-link diagrams of memory relationships
- Semantic Timeline: Natural language queries reshape timeline views
- Pattern Explorer: Drill-down into detected patterns with explanations
- Memory Lanes: Curated collections and thematic organization
- Relationship Mapping: Visual exploration of cross-context connections
- Timeline Annotations: User-added notes and organization

Advanced Interaction Patterns:
- Natural Language Timeline Queries: "Show me my learning pattern from last month"
- Pattern Expansion: "Tell me more about this coding workflow I keep repeating"
- Memory Lane Creation: Curated collections of related activities
- Cross-Context Exploration: "How does this email connect to my recent GitHub work?"
- Historical Scenario Analysis: "What if I had followed up on that lead last week?"

Assistant Integration Points:
- Timeline segments become rich context for assistant conversations
- Pattern exploration feeds assistant learning and recommendations
- Memory editing updates assistant understanding and suggestions
- Natural language queries bridge UI and assistant capabilities
- Shared context between timeline exploration and assistant interactions

Technical Implementation:
- D3.js-based interactive graph visualizations
- React Flow for complex relationship mapping
- Full-text search with semantic ranking across memory content
- Real-time updates from capture system reflected in UI
- Export capabilities for memory segments and patterns
- Performance optimization for large memory graphs (100K+ nodes)

Files:
/src/components/
├── memory/
│   ├── MemoryExplorer.tsx      # Main memory interface
│   ├── GraphVisualizer.tsx     # Interactive relationship maps
│   ├── SemanticTimeline.tsx    # Natural language timeline
│   └── MemoryLane.tsx          # Curated collections interface
├── patterns/
│   ├── PatternExplorer.tsx     # Deep pattern analysis
│   ├── PatternTimeline.tsx     # Pattern-focused timeline views
│   └── ExplanationPanel.tsx    # Assistant-powered explanations
└── search/
    ├── MemorySearch.tsx        # Natural language search interface
    ├── SemanticSearch.tsx      # Advanced search capabilities
    └── SearchResults.tsx       # Rich result presentation

/src/ui/
└── memory/
    ├── MemoryEditor.tsx        # Memory annotation and editing
    ├── TimelineControls.tsx    # Timeline manipulation tools
    └── ExportManager.tsx       # Memory export functionality

/src/hooks/
└── useMemoryGraph.ts           # Memory graph interaction hooks

Acceptance Criteria:
- Users can explore complex memory relationships intuitively
- Natural language queries reshape timeline and reveal insights
- Pattern exploration provides deep understanding of behaviors
- Memory editing updates assistant understanding appropriately
- Performance handles large memory datasets smoothly
- Timeline serves as rich context for assistant interactions
- Export functionality preserves memory structure and content
- Interface feels like natural extension of assistant experience
```

### Phase 4 Sprint Goals
- Unified assistant-first interface across all features
- Power-user memory exploration with semantic capabilities
- Seamless integration between assistant and deep views
- Consistent interaction patterns spanning entire super app
- Comprehensive onboarding and feature discovery experience

---

### Phase 5: Advanced Features & Production Polish (Weeks 13-16)

**Primary Goals**: Production hardening, performance optimization, comprehensive testing

**Issue #12: Advanced Cross-Context Intelligence**
```
Title: Implement sophisticated cross-context pattern recognition and insight generation
Description:
- Create knowledge graph of relationships across all integrated data sources
- Implement advanced pattern recognition spanning multiple application contexts
- Build fragment reassembly system for broken or incomplete context
- Develop topic evolution tracking across different activity types
- Generate cross-context insights combining email, code, learning, and communication

Advanced Intelligence Features:
- Cross-App Relationship Mapping: Connect email discussions to GitHub issues to learning resources
- Fragment Reassembly: Reconstruct incomplete workflows from disparate sources
- Topic Evolution Tracking: Monitor how ideas develop across different tools and time
- Significance Detection: Identify truly important patterns across noise
- Predictive Insights: Anticipate user needs based on multi-context patterns

Knowledge Graph Enhancement:
- Multi-type nodes: Activity, Email, Code Commit, Learning Resource, Communication
- Complex edge types: Causal, Correlational, Sequential, Hierarchical
- Temporal properties: Evolution tracking, frequency analysis, seasonality
- Confidence scoring: Multi-factor relevance and reliability assessment
- Query optimization: Complex cross-context pattern discovery

Insight Generation Pipeline:
1. Multi-source Data Integration → Unified Feature Extraction
2. Cross-context Pattern Recognition → Significance Scoring
3. Insight Synthesis → Natural Language Explanation Generation
4. Assistant Delivery → User Feedback Integration → Model Improvement

Files:
/src/engine/
├── cross-context/
│   ├── knowledge-graph.ts      # Multi-source relationship mapping
│   ├── fragment-reassembly.ts  # Incomplete context reconstruction
│   ├── topic-evolution.ts      # Idea development tracking
│   └── significance-scorer.ts  # Importance detection algorithms
├── insights/
│   ├── cross-context-insights.ts # Multi-app insight generation
│   ├── predictive-analytics.ts # Future behavior anticipation
│   └── explanation-engine.ts   # Natural language insight explanation
└── patterns/
    ├── multi-context-patterns.ts # Cross-app pattern recognition
    └── evolution-analyzer.ts   # Pattern development tracking

/src/assistant/
└── insights/
    ├── insight-delivery.ts     # Context-aware insight presentation
    └── feedback-integration.ts # Learning from user responses

Acceptance Criteria:
- System recognizes meaningful cross-context relationships
- Fragment reassembly reconstructs incomplete workflows
- Topic evolution tracking monitors idea development across tools
- Generated insights provide genuine value to users
- Assistant delivers cross-context insights appropriately
- Performance maintains real-time insight generation capabilities
- Privacy controls handle multi-source data appropriately
```

**Issue #13: Comprehensive User Personalization System**
```
Title: Implement deep user profiling and adaptive personalization
Description:
- Create comprehensive onboarding flow collecting user preferences and work style
- Build persistent user profile system tracking preferences and behaviors
- Implement personalized insight ranking and recommendation systems
- Develop adaptive interface responding to usage patterns and feedback
- Create continuous improvement loops learning from all user interactions

User Profile Components:
- Work Style Assessment: Analytical vs creative, individual vs collaborative
- Goal Tracking: Short-term tasks, long-term projects, learning objectives
- Interest Profiling: Domain expertise, preferred learning styles, tool preferences
- Interaction Preferences: Visual vs textual, proactive vs reactive assistance
- Capability Assessment: Technical sophistication, feature adoption rate
- Behavioral Patterns: Peak productivity times, workflow preferences, response patterns

Personalization Engine:
- Collaborative Filtering: Similar user pattern recommendations
- Content-based Filtering: Match insights to user interests and goals
- Context-aware Adaptation: Interface changes based on current activity
- A/B Testing Framework: Experiment with interface and suggestion variations
- Feedback Integration: Learn from explicit and implicit user signals

Adaptive Features:
- Interface Personalization: Layout, colors, interaction patterns
- Suggestion Prioritization: Rank insights by personal relevance
- Timing Optimization: Deliver assistance at optimal moments
- Feature Discovery: Progressive introduction of advanced capabilities
- Performance Tuning: Balance between helpfulness and minimal intrusion

Files:
/src/user-profile/
├── onboarding/
│   ├── OnboardingFlow.tsx     # Initial setup and assessment
│   ├── WorkStyleQuiz.tsx      # User work preference assessment
│   └── GoalSetting.tsx        # Objective and priority definition
├── profile/
│   ├── ProfileManager.ts      # Persistent user profile storage
│   ├── BehavioralTracker.ts   # Usage pattern monitoring
│   └── PreferenceEngine.ts    # Personalization algorithms
└── adaptation/
    ├── InterfaceAdapter.tsx   # Dynamic UI customization
    ├── SuggestionRanker.ts    # Personalized insight prioritization
    └── ABTesting.ts           # Experimentation framework

/src/assistant/
└── personalization/
    ├── PersonalContext.ts     # User-specific context management
    └── AdaptiveBehavior.ts    # Behavior modification based on profile

/src/recommendation/
├── collaborative.ts           # Similar user recommendations
├── content-based.ts           # Interest-based filtering
└── hybrid-engine.ts           # Combined recommendation system

Acceptance Criteria:
- Onboarding successfully captures meaningful user preferences
- Profile system persists and updates user information appropriately
- Interface adapts to user work style and preferences
- Insights ranked by personal relevance and context
- System learns from user interactions and improves over time
- A/B testing framework enables continuous UI optimization
- Privacy controls for profile data collection and usage
- Personalization enhances rather than distracts from core functionality
```

**Issue #14: Production-Grade Testing Infrastructure**
```
Title: Implement comprehensive testing strategy for super app reliability
Description:
- Build complete testing pyramid covering unit, integration, and E2E tests
- Implement test-driven development for all new features and integrations
- Create performance testing suite monitoring system overhead
- Develop privacy and security testing frameworks
- Set up continuous testing in CI/CD pipeline with coverage reporting

Testing Strategy:
- Unit Tests: 90%+ coverage of all business logic and algorithms
- Integration Tests: Verify cross-component interactions and data flows
- E2E Tests: Simulate complete user workflows across all features
- Performance Tests: Monitor CPU, memory, and latency under load
- Security Tests: Validate privacy controls and data protection
- Accessibility Tests: Ensure WCAG compliance across UI components

Test Categories and Coverage:

1. Core Functionality (90%+ coverage)
   - Capture engine and event processing
   - Memory graph operations and queries
   - Assistant core and skill execution
   - Integration adapters and APIs

2. Integration Testing (85%+ coverage)
   - Cross-component data flow validation
   - Open-source component integration points
   - External API interactions and error handling
   - Memory-assistant bidirectional communication

3. End-to-End Workflows (100% critical path coverage)
   - Complete user onboarding and setup
   - Email processing and action extraction
   - Developer workflow from code to GitHub
   - Assistant interaction with memory recall
   - Cross-context insight generation and delivery

4. Performance Benchmarks
   - Capture overhead < 3% CPU during normal operation
   - Assistant response latency < 100ms for simple queries
   - Memory query performance scales to 100K+ nodes
   - UI rendering maintains 60fps across all interactions
   - Integration processing doesn't block main thread

5. Security and Privacy Testing
   - End-to-end encryption validation for all sensitive data
   - Permission system boundary testing
   - Data isolation between different integration sources
   - Local storage security and automatic cleanup
   - Audit logging completeness and integrity

Tools and Implementation:
- Vitest 1.5+ for unit and integration testing
- Playwright 1.41+ for E2E testing across browsers
- Artillery 2.0+ for performance and load testing
- Testing Library for React component testing
- Custom privacy audit scripts and security scanners
- Coverage reporting with Istanbul and SonarQube integration

Files:
/tests/
├── unit/                      # Individual component tests
│   ├── capture/
│   ├── memory/
│   ├── assistant/
│   └── integrations/
├── integration/               # Cross-component tests
│   ├── data-flow/
│   ├── memory-assistant/
│   └── skill-execution/
├── e2e/                       # Complete workflow tests
│   ├── onboarding.spec.ts
│   ├── email-workflow.spec.ts
│   ├── developer-flow.spec.ts
│   └── assistant-interaction.spec.ts
├── performance/               # Benchmark tests
│   ├── capture-overhead.test.ts
│   ├── memory-scaling.test.ts
│   └── assistant-latency.test.ts
└── security/                  # Privacy and security tests
    ├── encryption.test.ts
    ├── permissions.test.ts
    └── data-isolation.test.ts

/test-utils/                   # Shared testing utilities
├── test-data/                 # Mock data and fixtures
├── setup.ts                   # Test environment configuration
└── coverage/                  # Coverage reporting configuration

/playwright.config.ts          # E2E testing configuration
/cypress.config.ts             # Alternative E2E testing (optional)
/vitest.config.ts              # Unit testing configuration

Acceptance Criteria:
- 90%+ code coverage across all critical components
- All tests pass consistently in CI pipeline
- E2E tests cover complete user workflows successfully
- Performance benchmarks established and monitored
- Security vulnerabilities identified and remediated
- Accessibility compliance verified across UI components
- Test suite runs complete in under 10 minutes
- Mock data enables reliable integration testing
```

**Issue #15: Production Deployment Infrastructure**
```
Title: Implement enterprise-grade CI/CD and deployment pipeline
Description:
- Create Docker containers for all services with multi-stage builds
- Set up automated deployment pipeline to extension stores
- Implement comprehensive monitoring and error tracking
- Build update mechanism with zero-downtime rolling updates
- Create enterprise deployment options and self-hosting capabilities

Deployment Architecture:
- Browser Extension: Automated deployment to Chrome Web Store and Firefox Add-ons
- Dashboard Application: Optional desktop app and progressive web app
- Background Services: Local Node.js services for heavy processing
- Integration Services: OAuth2 token management and API rate limiting
- Data Sync Service: Optional encrypted cloud backup (user-controlled)

CI/CD Pipeline Stages:
1. Code Quality: Linting, formatting, type checking, security scanning
2. Testing: Unit, integration, E2E, performance, accessibility
3. Build: Multi-target builds (extension, dashboard, services)
4. Publishing: Automated store submissions and version tagging
5. Deployment: Rolling updates with feature flags and rollback capability
6. Monitoring: Health checks, error reporting, performance metrics

Infrastructure Components:
- GitHub Actions for complete CI/CD orchestration
- Docker Hub for container registry and image distribution
- Sentry 8+ for error monitoring and performance tracking
- Vercel/Netlify for optional dashboard hosting (PWA)
- Self-hosted options using Docker Compose
- Feature flag system for controlled rollouts

Monitoring and Observability:
- Application performance monitoring (APM)
- Error tracking with full context and stack traces
- User journey analytics (privacy-respecting)
- Integration health monitoring (API status, rate limits)
- Resource usage tracking (CPU, memory, storage)
- Automatic alerting for critical issues

Update and Rollback:
- Extension auto-update through browser stores
- Background service zero-downtime updates
- Feature flag controlled deployments
- Database migration safety with rollback capability
- User notification system for significant updates
- Graceful degradation for partial update failures

Files:
/Dockerfile                    # Multi-stage Docker build
/docker-compose.yml            # Local development and self-hosting
/.github/
├── workflows/
│   ├── ci.yml                 # Continuous integration
│   ├── cd-extension.yml       # Extension store deployment
│   ├── cd-dashboard.yml       # Dashboard deployment
│   └── security-scan.yml      # Vulnerability scanning
└── deploy/
    ├── chrome-store.json      # Chrome Web Store configuration
    └── firefox-addons.json    # Firefox Add-ons configuration
/infrastructure/
├── monitoring/
│   ├── sentry.config.js       # Error tracking setup
│   └── metrics.js             # Performance monitoring
├── update/
│   ├── update-manager.ts      # Extension update handling
│   └── migration-service.ts   # Database migrations
└── deployment/
    ├── feature-flags.ts       # Controlled rollouts
    └── rollback-procedures.md # Emergency procedures
/package.json                  # Production dependencies and scripts
/.release/                     # Semantic-release configuration

Acceptance Criteria:
- Automated builds and tests complete successfully for all targets
- Extension deploys automatically to Chrome and Firefox stores
- Production monitoring captures errors and performance metrics
- Zero-downtime update mechanism works seamlessly
- Self-hosting option available for privacy-conscious users
- Rollback procedures documented and tested
- Infrastructure scales to enterprise deployment requirements
- Security scanning identifies and prevents vulnerabilities
```

---

## Development Methodology

### Autonomous Agent-Based Development

Implement this project using specialized development personas working in coordinated fashion:

**Agent Roles:**
- **Architect Agent**: System design, technical specifications, architecture diagrams
- **Assistant Agent**: Always-on assistant core, skill development, NLP integration
- **Integration Agent**: Open-source extraction, external API integration, component adaptation
- **Memory Agent**: Knowledge graph implementation, timeline evolution, context management
- **Experience Agent**: UI/UX design, user onboarding, interaction patterns
- **Core Agent**: Capture engine, foundational systems, performance optimization
- **Quality Agent**: Testing strategy, security implementation, documentation
- **Infrastructure Agent**: CI/CD, deployment, monitoring, DevOps practices

### Issue-Driven Workflow

1. **Issue Creation**: Generate specific, actionable issues with clear acceptance criteria
2. **Agent Assignment**: Route issues to appropriate specialized agents
3. **Branching Strategy**: Create feature branches following `feat/issue-#-description`
4. **Implementation**: Complete solutions with comprehensive tests and documentation
5. **PR Process**: 
   - Write detailed PR descriptions explaining implementation choices
   - Include test results, performance impact, and security considerations
   - Self-review following established quality checklist
   - Merge with conventional commit messages
6. **Continuous Integration**: Automated testing and deployment on every merge

### PR Template Requirements

Every pull request must include:

```markdown
## Description
[Clear explanation of what this PR accomplishes and why it's needed]

## Related Issue
Closes #X

## Implementation Overview
[High-level explanation of technical approach and key decisions]

## Changes
- [ ] Specific implementation 1
- [ ] Specific implementation 2
- [ ] Integration with existing systems
- [ ] Test coverage added (unit/integration/E2E)
- [ ] Documentation updated
- [ ] Performance optimizations applied
- [ ] Security and privacy considerations addressed

## Testing
- [ ] Unit tests: [coverage percentage]
- [ ] Integration tests: [key scenarios covered]
- [ ] E2E tests: [critical workflows validated]
- [ ] Performance tests: [benchmarks met]
- [ ] Manual testing: [exploratory testing completed]
- [ ] Security review: [vulnerabilities assessed]

## Performance Impact
[Description of performance considerations and measurements]

## Privacy & Security
[Explanation of data handling, permissions, and security measures]

## Screenshots / Demos (if applicable)
[Visual documentation of UI changes or key features]

## Deployment Considerations
[Impact on production deployment, migration requirements, rollback plan]

## Checklist
- [ ] Code follows project standards and architecture
- [ ] TypeScript types are complete and comprehensive
- [ ] Privacy considerations properly addressed
- [ ] Performance optimized for production use
- [ ] Security implications reviewed and mitigated
- [ ] Documentation updated for users and developers
- [ ] Tests cover all major code paths and edge cases
- [ ] Integration with existing features verified
- [ ] Open source component credits updated (if applicable)
```

---

## Success Metrics & Quality Gates

### Technical Excellence
1. **Architecture**: Modular, extensible design supporting future integrations
2. **Performance**: <3% CPU overhead, <100ms assistant responses, 60fps UI
3. **Reliability**: 99.9% uptime, comprehensive error handling, graceful degradation
4. **Scalability**: Handles 1M+ memory nodes, 100+ concurrent integrations
5. **Test Coverage**: 90%+ unit/integration, 100% critical path E2E
6. **Security**: End-to-end encryption, zero trust architecture, regular audits

### User Experience
1. **Intuitiveness**: New users productive within 5 minutes of onboarding
2. **Contextual Relevance**: 80%+ of assistant suggestions rated helpful by users
3. **Performance Perception**: Feels native and responsive across all interactions
4. **Privacy Confidence**: Clear controls and transparency build user trust
5. **Feature Discovery**: Progressive disclosure reveals power without overwhelm
6. **Cross-Platform**: Consistent experience across browsers and deployment targets

### Business Readiness
1. **Deployment**: Automated CI/CD to all major extension stores
2. **Monitoring**: Comprehensive observability with actionable alerting
3. **Updates**: Seamless zero-downtime updates with rollback capability
4. **Enterprise**: Self-hosting options, admin controls, compliance documentation
5. **Extensibility**: Modular architecture for future features and integrations
6. **Documentation**: Complete guides for users, developers, and administrators

---

## Privacy & Security Framework

### Core Privacy Principles
1. **Local-First**: All processing happens on user's device by default
2. **User Control**: Granular permissions with clear explanation and easy revocation
3. **Data Minimization**: Capture only what's necessary for declared functionality
4. **Transparency**: Clear indicators of what's being captured and why
5. **No Lock-in**: Easy data export and complete system removal

### Security Architecture
```
Data Protection Layers:
┌─────────────────────┐
│  Application Layer  │ ← Permissions, input validation, secure APIs
├─────────────────────┤
│   Crypto Layer      │ ← End-to-end encryption, secure key management
├─────────────────────┤
│  Storage Layer      │ ← Encrypted databases, secure local storage
├─────────────────────┤
│   Network Layer     │ ← OAuth2, HTTPS only, no unnecessary data transmission
├─────────────────────┤
│  Integration Layer  │ ← Sandboxed external API calls, token isolation
└─────────────────────┘
```

### Privacy Controls Implementation
- **Granular Permissions**: Per-feature, per-integration, per-data-type controls
- **Activity Indicators**: Clear visual feedback when capture is active
- **Data Retention Policies**: Configurable automatic cleanup (30 days, 1 year, never)
- **Audit Logging**: User-accessible logs of all capture and processing activities
- **Emergency Controls**: One-click pause/resume and complete data wipe
- **Export/Import**: Full data portability with standard formats (JSON, SQL)

---

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- Repository setup and unified architecture
- Core capture engine and memory graph foundation
- Shared infrastructure and tooling

### Phase 2: Assistant Core (Weeks 3-5)  
- Always-on assistant with natural language capabilities
- Memory integration and proactive behaviors
- Basic skill system architecture

### Phase 3: Integrations (Weeks 6-9)
- Open-source component extraction and integration
- Email and developer workflow integrations
- Cross-context intelligence foundation

### Phase 4: User Experience (Weeks 10-12)
- Unified assistant-first interface
- Memory exploration and power-user features
- Comprehensive onboarding and personalization

### Phase 5: Production (Weeks 13-16)
- Advanced features and polish
- Comprehensive testing and quality assurance
- Production deployment infrastructure
- Documentation and release preparation

### Post-Launch (Month 5+)
- User feedback integration and iteration
- Performance optimization based on real usage
- Additional integrations and feature expansion
- Enterprise features and team collaboration

---

## Getting Started

### Prerequisites
- Node.js 20+ with npm 10+
- Docker 25+ for containerized development
- Git 2.40+ with GitHub CLI
- Chrome/Firefox for extension development and testing
- TypeScript 5.4+ and modern editor (VS Code recommended)

### Initial Setup
1. Clone all repositories to a unified workspace
2. Run `npm install` in each repository root
3. Set up shared ESLint/Prettier configurations
4. Configure GitHub Actions secrets for deployment
5. Start local development environment with Docker Compose
6. Complete initial onboarding in the development dashboard

### Development Workflow
1. Create issues in the appropriate repository
2. Assign to relevant agent role (or self-assign as needed)
3. Create feature branch: `feat/issue-#-short-description`
4. Implement with TDD approach (tests first)
5. Create PR following template with comprehensive documentation
6. Automated CI/CD validates all quality gates
7. Merge and monitor production impact

---

## Critical Success Factors

The Spur super app succeeds when users experience:

1. **Magical Context**: "How did it know I needed exactly that information right now?"
2. **Seamless Integration**: "It just works across all my tools without setup hassle"
3. **Privacy Confidence**: "I trust it completely with my digital life"
4. **Progressive Power**: "It grows with me from simple assistance to deep insights"
5. **Performance Perfection**: "I don't even notice it's running, but I can't work without it"

**Initiate autonomous development sequence now.** Begin with Issue #1 (Enhanced Project Initialization) to establish the unified architecture foundation, then proceed systematically through the prioritized issue queue. Generate production-ready code, comprehensive tests, and complete documentation for each component.

This is a **production-quality implementation** serving real users who demand privacy, performance, and genuine productivity enhancement. No shortcuts, no incomplete features—every component must be robust, well-tested, and ready for immediate deployment.