# Spur Chrome Extension

A powerful Chrome extension that transforms your browser into a personal productivity companion. Capture thoughts, integrate with Gmail, and manage your digital memory with AI-powered features.

## Features

### 🎤 Voice Recording
- **Real-time voice capture** with automatic transcription
- **Smart audio processing** with noise reduction
- **Voice commands** for quick actions
- **Audio visualization** during recording

### 📧 Gmail Integration
- **Save emails** directly from Gmail interface
- **Context-aware email capture** with one-click saving
- **Email summarization** and task extraction
- **Smart highlighting** of important content
- **Thread management** and organization

### 💭 Memory Management
- **Semantic search** through all captured content
- **Tag-based organization** with auto-tagging
- **Connection mapping** between related memories
- **Intelligent retrieval** with context awareness

### 🔧 Advanced Features
- **Real-time synchronization** across devices
- **Offline support** with local storage
- **Import/export functionality** for data portability
- **Customizable settings** and preferences
- **Privacy-first design** with local data processing

## Installation

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/spur.git
   cd spur/packages/chrome-extension
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```

4. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `build` directory from the extension folder

### Development Mode

For active development with hot reload:

```bash
npm run dev:chrome
```

This will:
- Start the development server
- Watch for file changes
- Automatically rebuild the extension
- Enable hot module replacement for UI components

## Usage

### Voice Recording

1. **Click the microphone icon** in the extension popup
2. **Speak naturally** - the extension will capture your voice
3. **Stop recording** when finished
4. **Review and edit** the automatic transcription
5. **Save to your memory bank** with optional tags

### Gmail Integration

1. **Open Gmail** in your browser
2. **Look for the "Save to Spur"** button next to emails
3. **Click to save** important emails and conversations
4. **Use keyboard shortcuts** (Ctrl+Shift+S) for quick saving

### Memory Management

1. **Browse memories** in the extension popup
2. **Search using natural language** queries
3. **Filter by type, date, or tags**
4. **Connect related memories** to build knowledge graphs
5. **Export memories** for backup or sharing

## Configuration

### Settings Panel

Access the options page by:
- Clicking the gear icon in the extension popup
- Right-clicking the extension icon and selecting "Options"
- Navigating to `chrome://extensions/` and clicking "Options"

### Key Settings

- **Dark Mode**: Toggle dark/light theme
- **Auto Sync**: Enable automatic synchronization
- **Gmail Integration**: Control email capture features
- **Voice Commands**: Enable voice-activated shortcuts
- **Notifications**: Configure alert preferences
- **Data Retention**: Set automatic cleanup policies

## API Reference

### Background Service

The background service handles core functionality:

```typescript
// Start voice recording
chrome.runtime.sendMessage({
  type: 'START_RECORDING',
  timestamp: new Date().toISOString(),
  source: 'popup'
});

// Add a memory
chrome.runtime.sendMessage({
  type: 'ADD_MEMORY',
  payload: memoryData,
  timestamp: new Date().toISOString(),
  source: 'popup'
});
```

### Content Script

The Gmail integration runs as a content script:

```typescript
// Access Gmail integration
window.spurGmailIntegration.saveEmail(emailId);
window.spurGmailIntegration.searchEmails(query);
```

### Storage API

Data is stored using Chrome's storage API:

```typescript
// Get stored data
chrome.storage.local.get(['spurState'], (result) => {
  console.log(result.spurState);
});

// Update configuration
chrome.storage.local.set({
  spurConfig: { darkMode: true }
});
```

## Development

### Project Structure

```
packages/chrome-extension/
├── src/
│   ├── background/      # Service worker and background logic
│   ├── content/         # Gmail integration and page scripts
│   ├── popup/           # Extension popup interface
│   ├── components/      # Reusable UI components
│   ├── context/         # React state management
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── assets/              # Icons and static assets
├── tests/               # Test files and utilities
├── scripts/             # Build and development scripts
├── manifest.json        # Extension manifest
└── vite.config.ts       # Vite configuration
```

### Building

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Package extension for distribution
npm run package

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

### Testing

The extension includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in UI mode
npm run test:ui

# Run specific test file
npm test -- BackgroundService.test.ts
```

## Privacy & Security

### Data Storage

- **Local-first**: All data is stored locally in Chrome's storage
- **No tracking**: No analytics or user tracking
- **Encryption**: Sensitive data is encrypted at rest
- **Minimal permissions**: Only requests necessary permissions

### Permissions

The extension requests the following permissions:

- **storage**: Save user data and preferences
- **tabs**: Access current tab for context-aware features
- **activeTab**: Interact with the currently active tab
- **contextMenus**: Add right-click menu items
- **notifications**: Show user notifications
- **alarms**: Schedule periodic tasks
- **commands**: Define keyboard shortcuts
- **offscreen**: Process audio in background

### Gmail Integration

Gmail integration requires these host permissions:
- `https://accounts.google.com/*`
- `https://www.googleapis.com/*`
- `https://mail.google.com/*`

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests for new functionality**
5. **Ensure all tests pass**
6. **Submit a pull request**

### Development Guidelines

- Follow TypeScript best practices
- Use functional React components with hooks
- Write comprehensive tests for all features
- Maintain documentation for new features
- Follow the established code style

## Troubleshooting

### Common Issues

**Extension won't load:**
- Check that "Developer mode" is enabled
- Ensure the build directory exists
- Look for errors in the Chrome extensions page

**Voice recording not working:**
- Check microphone permissions
- Ensure HTTPS is enabled (required for microphone access)
- Verify that the extension has the necessary permissions

**Gmail integration not working:**
- Refresh the Gmail tab after installing/updating
- Check that Gmail integration is enabled in settings
- Ensure you're logged into Gmail

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
DEBUG=spur:* npm run dev
```

### Performance Issues

If the extension is running slowly:

1. Clear extension data and reconfigure
2. Check memory usage in Chrome's task manager
3. Reduce history size in settings
4. Disable unused features

## Roadmap

### Upcoming Features

- [ ] **Advanced NLP processing** for better transcription
- [ ] **Cross-platform sync** with mobile app
- [ ] **AI-powered insights** and suggestions
- [ ] **Team collaboration** features
- [ ] **Advanced search** with semantic understanding
- [ ] **Integration with more services** (Calendar, Drive, etc.)

### Technical Improvements

- [ ] **Service worker optimizations** for better performance
- [ ] **Reduced bundle size** through code splitting
- [ ] **Improved offline support** with service workers
- [ ] **Better error handling** and user feedback
- [ ] **Accessibility improvements** for screen readers

## License

This project is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.

## Support

- **Documentation**: [Wiki](../../wiki)
- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)
- **Email**: support@spur.app

## Acknowledgments

- Built with [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Tested with [Vitest](https://vitest.dev/)
- Icons from [Lucide React](https://lucide.dev/)

---

Made with ❤️ by the Spur team