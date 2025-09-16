import { MemoryNode } from '../types/spur';

interface VSCodeFile {
  uri: string;
  language: string;
  content: string;
  lines: number;
  size: number;
  lastModified: string;
}

interface VSCodeWorkspace {
  name: string;
  path: string;
  files: VSCodeFile[];
  folders: string[];
  settings: any;
}

interface VSCodeActivity {
  type: 'edit' | 'save' | 'open' | 'close' | 'debug' | 'run';
  file?: string;
  timestamp: string;
  details?: any;
}

interface VSCodeExtension {
  id: string;
  name: string;
  enabled: boolean;
  version: string;
}

class VSCodeIntegration {
  private isConnected = false;
  private activeWorkspace: VSCodeWorkspace | null = null;
  private activityBuffer: VSCodeActivity[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private readonly VSCODE_PROTOCOL = 'vscode://';

  async initialize(): Promise<void> {
    try {
      // Check if VS Code is available through the extension protocol
      await this.checkVSCodeAvailability();
      
      // Set up listeners for VS Code events
      this.setupVSCodeListeners();
      
      console.log('VS Code integration initialized');
    } catch (error) {
      console.error('Failed to initialize VS Code integration:', error);
    }
  }

  private async checkVSCodeAvailability(): Promise<void> {
    try {
      // Try to detect if VS Code is running and has the Spur extension
      const isAvailable = await this.isVSCodeExtensionInstalled();
      
      if (isAvailable) {
        this.isConnected = true;
        await this.loadActiveWorkspace();
      } else {
        this.isConnected = false;
        console.log('VS Code extension not found');
      }
    } catch (error) {
      console.error('VS Code availability check failed:', error);
      this.isConnected = false;
    }
  }

  private async isVSCodeExtensionInstalled(): Promise<boolean> {
    try {
      // Check if we can communicate with VS Code extension
      // This would typically use a custom protocol or port
      const response = await this.sendVSCodeMessage({
        type: 'ping',
        timestamp: new Date().toISOString()
      });
      
      return response && response.type === 'pong';
    } catch (error) {
      return false;
    }
  }

  private setupVSCodeListeners(): void {
    // Listen for VS Code events through Chrome extension messaging
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.source === 'vscode') {
        this.handleVSCodeMessage(message, sender).then(sendResponse);
        return true;
      }
    });
  }

  private async handleVSCodeMessage(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      switch (message.type) {
        case 'vscode-activity':
          await this.recordActivity(message.payload);
          return { success: true };
        
        case 'vscode-file-changed':
          await this.handleFileChange(message.payload);
          return { success: true };
        
        case 'vscode-workspace-changed':
          await this.handleWorkspaceChange(message.payload);
          return { success: true };
        
        case 'vscode-extension-installed':
          await this.handleExtensionInstalled(message.payload);
          return { success: true };
        
        default:
          console.warn('Unknown VS Code message type:', message.type);
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Failed to handle VS Code message:', error);
      return { success: false, error: error.message };
    }
  }

  async isConnectedToVSCode(): Promise<boolean> {
    return this.isConnected;
  }

  async getActiveWorkspace(): Promise<VSCodeWorkspace | null> {
    return this.activeWorkspace;
  }

  async getWorkspaceFiles(): Promise<VSCodeFile[]> {
    if (!this.activeWorkspace) {
      return [];
    }

    return this.activeWorkspace.files;
  }

  async getCurrentFile(): Promise<VSCodeFile | null> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'get-current-file',
        timestamp: new Date().toISOString()
      });

      return response?.file || null;
    } catch (error) {
      console.error('Failed to get current file:', error);
      return null;
    }
  }

  async getOpenFiles(): Promise<VSCodeFile[]> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'get-open-files',
        timestamp: new Date().toISOString()
      });

      return response?.files || [];
    } catch (error) {
      console.error('Failed to get open files:', error);
      return [];
    }
  }

  async getFileContent(uri: string): Promise<string | null> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'get-file-content',
        payload: { uri },
        timestamp: new Date().toISOString()
      });

      return response?.content || null;
    } catch (error) {
      console.error('Failed to get file content:', error);
      return null;
    }
  }

  async saveFile(uri: string, content: string): Promise<boolean> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'save-file',
        payload: { uri, content },
        timestamp: new Date().toISOString()
      });

      return response?.success || false;
    } catch (error) {
      console.error('Failed to save file:', error);
      return false;
    }
  }

  async openFile(uri: string): Promise<boolean> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'open-file',
        payload: { uri },
        timestamp: new Date().toISOString()
      });

      return response?.success || false;
    } catch (error) {
      console.error('Failed to open file:', error);
      return false;
    }
  }

  async executeCommand(command: string, args?: any[]): Promise<any> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'execute-command',
        payload: { command, args },
        timestamp: new Date().toISOString()
      });

      return response?.result;
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw error;
    }
  }

  async searchInWorkspace(query: string): Promise<VSCodeFile[]> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'search-workspace',
        payload: { query },
        timestamp: new Date().toISOString()
      });

      return response?.files || [];
    } catch (error) {
      console.error('Failed to search workspace:', error);
      return [];
    }
  }

  async getInstalledExtensions(): Promise<VSCodeExtension[]> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'get-extensions',
        timestamp: new Date().toISOString()
      });

      return response?.extensions || [];
    } catch (error) {
      console.error('Failed to get installed extensions:', error);
      return [];
    }
  }

  async getWorkspaceSettings(): Promise<any> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'get-settings',
        timestamp: new Date().toISOString()
      });

      return response?.settings || {};
    } catch (error) {
      console.error('Failed to get workspace settings:', error);
      return {};
    }
  }

  async createMemoryFromCurrentFile(): Promise<MemoryNode | null> {
    try {
      const currentFile = await this.getCurrentFile();
      if (!currentFile) {
        return null;
      }

      const content = await this.getFileContent(currentFile.uri);
      if (!content) {
        return null;
      }

      const memory: MemoryNode = {
        id: `vscode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: this.formatFileContent(currentFile, content),
        type: 'code',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'vscode',
          fileUri: currentFile.uri,
          language: currentFile.language,
          fileName: this.getFileName(currentFile.uri),
          lines: currentFile.lines,
          size: currentFile.size,
          lastModified: currentFile.lastModified
        },
        connections: [],
        tags: this.extractTagsFromCode(content, currentFile.language)
      };

      return memory;
    } catch (error) {
      console.error('Failed to create memory from current file:', error);
      return null;
    }
  }

  async createMemoryFromSelection(): Promise<MemoryNode | null> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'get-selection',
        timestamp: new Date().toISOString()
      });

      if (!response?.selection) {
        return null;
      }

      const { text, uri, language } = response.selection;

      const memory: MemoryNode = {
        id: `vscode_selection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: text,
        type: 'code',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'vscode',
          fileUri: uri,
          language,
          fileName: this.getFileName(uri),
          selection: true
        },
        connections: [],
        tags: this.extractTagsFromCode(text, language)
      };

      return memory;
    } catch (error) {
      console.error('Failed to create memory from selection:', error);
      return null;
    }
  }

  async createMemoryFromTerminal(command: string, output: string): Promise<MemoryNode> {
    const memory: MemoryNode = {
      id: `vscode_terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `Command: ${command}\nOutput: ${output}`,
      type: 'terminal',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'vscode',
        command,
        workspace: this.activeWorkspace?.name
      },
      commands: [],
      tags: this.extractTagsFromTerminal(command, output)
    };

    return memory;
  }

  async createMemoryFromDebugSession(session: any): Promise<MemoryNode> {
    const memory: MemoryNode = {
      id: `vscode_debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `Debug session: ${session.name}\nType: ${session.type}\nConfiguration: ${session.configuration.name}`,
      type: 'debug',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'vscode',
        session: session.name,
        type: session.type,
        configuration: session.configuration.name,
        workspace: this.activeWorkspace?.name
      },
      connections: [],
      tags: ['debug', session.type, session.configuration.name]
    };

    return memory;
  }

  private formatFileContent(file: VSCodeFile, content: string): string {
    return `File: ${this.getFileName(file.uri)}\nLanguage: ${file.language}\nLines: ${file.lines}\nSize: ${file.size} bytes\nLast Modified: ${new Date(file.lastModified).toLocaleString()}\n\n${content}`;
  }

  private getFileName(uri: string): string {
    const parts = uri.split('/');
    return parts[parts.length - 1] || uri;
  }

  private extractTagsFromCode(content: string, language: string): string[] {
    const tags: string[] = [language];
    
    // Extract common patterns based on language
    if (language === 'javascript' || language === 'typescript') {
      // Extract function names, variable names, and common keywords
      const functionMatches = content.match(/function\s+(\w+)/g) || [];
      const constMatches = content.match(/const\s+(\w+)/g) || [];
      const letMatches = content.match(/let\s+(\w+)/g) || [];
      
      functionMatches.forEach(match => {
        const funcName = match.replace(/function\s+/, '');
        tags.push(funcName);
      });
      
      [...constMatches, ...letMatches].forEach(match => {
        const varName = match.replace(/const\s+|let\s+/, '');
        tags.push(varName);
      });
    } else if (language === 'python') {
      // Extract function names and class names
      const functionMatches = content.match(/def\s+(\w+)/g) || [];
      const classMatches = content.match(/class\s+(\w+)/g) || [];
      
      [...functionMatches, ...classMatches].forEach(match => {
        const name = match.replace(/def\s+|class\s+/, '');
        tags.push(name);
      });
    }
    
    // Add common programming keywords
    const keywords = ['import', 'export', 'function', 'class', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'try', 'catch'];
    keywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return [...new Set(tags)].slice(0, 10); // Limit to 10 tags
  }

  private extractTagsFromTerminal(command: string, output: string): string[] {
    const tags: string[] = [];
    const combined = `${command} ${output}`.toLowerCase();
    
    // Extract common commands and tools
    const commandPatterns = [
      /npm\s+(\w+)/,
      /git\s+(\w+)/,
      /yarn\s+(\w+)/,
      /docker\s+(\w+)/,
      /kubectl\s+(\w+)/,
      /python\s+(\w+)/,
      /node\s+(\w+)/,
      /npm\s+run\s+(\w+)/
    ];
    
    commandPatterns.forEach(pattern => {
      const match = combined.match(pattern);
      if (match) {
        tags.push(match[1]);
      }
    });
    
    // Extract common terminal keywords
    const keywords = ['error', 'warning', 'success', 'failed', 'build', 'test', 'deploy', 'install', 'update'];
    keywords.forEach(keyword => {
      if (combined.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return [...new Set(tags)];
  }

  private async recordActivity(activity: VSCodeActivity): Promise<void> {
    this.activityBuffer.push(activity);
    
    // Keep buffer size limited
    if (this.activityBuffer.length > this.MAX_BUFFER_SIZE) {
      this.activityBuffer = this.activityBuffer.slice(-this.MAX_BUFFER_SIZE);
    }
    
    // Create memory for significant activities
    if (this.shouldCreateMemoryForActivity(activity)) {
      const memory = await this.createMemoryFromActivity(activity);
      if (memory) {
        // Send memory to background service
        chrome.runtime.sendMessage({
          type: 'ADD_MEMORY',
          payload: memory
        });
      }
    }
  }

  private shouldCreateMemoryForActivity(activity: VSCodeActivity): boolean {
    // Create memory for significant activities
    switch (activity.type) {
      case 'save':
        return true; // Save important files
      case 'debug':
        return true; // Debug sessions are important
      case 'run':
        return true; // Running scripts/commands
      default:
        return false;
    }
  }

  private async createMemoryFromActivity(activity: VSCodeActivity): Promise<MemoryNode | null> {
    try {
      switch (activity.type) {
        case 'save':
          if (activity.file) {
            return await this.createMemoryFromCurrentFile();
          }
          break;
        
        case 'debug':
          if (activity.details) {
            return await this.createMemoryFromDebugSession(activity.details);
          }
          break;
        
        case 'run':
          if (activity.details) {
            return await this.createMemoryFromTerminal(
              activity.details.command || 'Unknown command',
              activity.details.output || 'No output'
            );
          }
          break;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to create memory from activity:', error);
      return null;
    }
  }

  private async handleFileChange(payload: any): Promise<void> {
    try {
      const { uri, changeType } = payload;
      
      // Update workspace files if needed
      if (this.activeWorkspace) {
        const fileIndex = this.activeWorkspace.files.findIndex(f => f.uri === uri);
        
        if (changeType === 'created' || changeType === 'modified') {
          // Get updated file info
          const fileInfo = await this.getFileInfo(uri);
          if (fileInfo) {
            if (fileIndex >= 0) {
              this.activeWorkspace.files[fileIndex] = fileInfo;
            } else {
              this.activeWorkspace.files.push(fileInfo);
            }
          }
        } else if (changeType === 'deleted' && fileIndex >= 0) {
          this.activeWorkspace.files.splice(fileIndex, 1);
        }
      }
      
      console.log(`File ${changeType}: ${uri}`);
    } catch (error) {
      console.error('Failed to handle file change:', error);
    }
  }

  private async handleWorkspaceChange(payload: any): Promise<void> {
    try {
      const { workspace } = payload;
      this.activeWorkspace = workspace;
      console.log(`Workspace changed: ${workspace.name}`);
    } catch (error) {
      console.error('Failed to handle workspace change:', error);
    }
  }

  private async handleExtensionInstalled(payload: any): Promise<void> {
    try {
      const { extension } = payload;
      console.log(`Extension installed: ${extension.name} v${extension.version}`);
      
      // Create memory for significant extension installations
      if (this.isSignificantExtension(extension.id)) {
        const memory: MemoryNode = {
          id: `vscode_extension_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: `Extension installed: ${extension.name} v${extension.version}`,
          type: 'extension',
          timestamp: new Date().toISOString(),
          metadata: {
            source: 'vscode',
            extensionId: extension.id,
            extensionName: extension.name,
            version: extension.version,
            workspace: this.activeWorkspace?.name
          },
          connections: [],
          tags: ['extension', extension.name.toLowerCase()]
        };
        
        // Send memory to background service
        chrome.runtime.sendMessage({
          type: 'ADD_MEMORY',
          payload: memory
        });
      }
    } catch (error) {
      console.error('Failed to handle extension installation:', error);
    }
  }

  private isSignificantExtension(extensionId: string): boolean {
    // Consider certain extensions as significant
    const significantPatterns = [
      'ms-python.python',
      'ms-vscode.vscode-typescript-next',
      'ms-vscode.javascript',
      'ms-vscode-remote.remote-containers',
      'ms-vscode-remote.remote-ssh',
      'ms-vscode-remote.remote-wsl',
      'esbenp.prettier-vscode',
      'dbaeumer.vscode-eslint',
      'ms-vscode.vscode-git'
    ];
    
    return significantPatterns.some(pattern => extensionId.includes(pattern));
  }

  private async loadActiveWorkspace(): Promise<void> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'get-workspace',
        timestamp: new Date().toISOString()
      });

      if (response?.workspace) {
        this.activeWorkspace = response.workspace;
        console.log(`Active workspace loaded: ${this.activeWorkspace.name}`);
      }
    } catch (error) {
      console.error('Failed to load active workspace:', error);
    }
  }

  private async getFileInfo(uri: string): Promise<VSCodeFile | null> {
    try {
      const response = await this.sendVSCodeMessage({
        type: 'get-file-info',
        payload: { uri },
        timestamp: new Date().toISOString()
      });

      return response?.file || null;
    } catch (error) {
      console.error('Failed to get file info:', error);
      return null;
    }
  }

  private async sendVSCodeMessage(message: any): Promise<any> {
    try {
      // Send message to VS Code extension
      // This would typically use a custom protocol or port communication
      const response = await chrome.runtime.sendMessage({
        type: 'VSCODE_MESSAGE',
        payload: message,
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error) {
      console.error('Failed to send VS Code message:', error);
      throw error;
    }
  }

  async getActivityHistory(limit: number = 50): Promise<VSCodeActivity[]> {
    return this.activityBuffer.slice(-limit);
  }

  async clearActivityHistory(): Promise<void> {
    this.activityBuffer = [];
  }

  async getStatistics(): Promise<any> {
    const activity = this.activityBuffer;
    
    const activityTypes = activity.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const fileActivity = activity.filter(a => a.file).length;
    const recentActivity = activity.filter(a => 
      Date.now() - new Date(a.timestamp).getTime() < 24 * 60 * 60 * 1000
    ).length;

    return {
      totalActivities: activity.length,
      activityTypes,
      fileActivity,
      recentActivity,
      activeWorkspace: this.activeWorkspace?.name || null,
      lastActivity: activity.length > 0 ? activity[activity.length - 1].timestamp : null,
      isConnected: this.isConnected
    };
  }

  async sync(): Promise<{ synced: number; errors: number }> {
    try {
      if (!this.isConnected) {
        return { synced: 0, errors: 0 };
      }

      let synced = 0;
      let errors = 0;

      // Sync active workspace
      if (this.activeWorkspace) {
        try {
          console.log(`Syncing VS Code workspace: ${this.activeWorkspace.name}`);
          synced++;
        } catch (error) {
          console.error('Failed to sync workspace:', error);
          errors++;
        }
      }

      // Sync recent activity
      const recentActivity = this.activityBuffer.slice(-10);
      for (const activity of recentActivity) {
        try {
          if (this.shouldCreateMemoryForActivity(activity)) {
            const memory = await this.createMemoryFromActivity(activity);
            if (memory) {
              synced++;
            }
          }
        } catch (error) {
          console.error('Failed to sync activity:', error);
          errors++;
        }
      }

      return { synced, errors };
    } catch (error) {
      console.error('VS Code sync failed:', error);
      return { synced: 0, errors: 1 };
    }
  }
}

export const vscodeIntegration = new VSCodeIntegration();
export { VSCodeIntegration, type VSCodeFile, type VSCodeWorkspace, type VSCodeActivity, type VSCodeExtension };