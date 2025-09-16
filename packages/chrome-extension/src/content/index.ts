import { MemoryNode } from '../types/spur';

interface ContentScriptConfig {
  gmailIntegration: boolean;
  autoCapture: boolean;
  voiceCommands: boolean;
}

interface EmailData {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  threadId: string;
  labels: string[];
}

class GmailIntegration {
  private config: ContentScriptConfig;
  private observer?: MutationObserver;
  private processedEmails = new Set<string>();

  constructor(config: ContentScriptConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.config.gmailIntegration) {
      return;
    }

    await this.injectStyles();
    this.setupMutationObserver();
    this.setupKeyboardShortcuts();
    this.setupMessageListener();
    
    console.log('Spur Gmail integration initialized');
  }

  private async injectStyles(): Promise<void> {
    const styles = `
      .spur-email-button {
        background: #1a73e8;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-left: 8px;
        transition: all 0.2s ease;
      }

      .spur-email-button:hover {
        background: #1557b0;
        transform: translateY(-1px);
      }

      .spur-highlight {
        background-color: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 3px;
        padding: 2px 4px;
        cursor: pointer;
      }

      .spur-highlight:hover {
        background-color: #ffeaa7;
      }

      .spur-context-menu {
        position: absolute;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 10000;
        padding: 4px 0;
      }

      .spur-context-menu-item {
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        color: #333;
      }

      .spur-context-menu-item:hover {
        background: #f5f5f5;
      }

      .spur-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10001;
        max-width: 300px;
        font-size: 14px;
        animation: slideIn 0.3s ease;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          this.handleDOMChanges(mutation.addedNodes);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  }

  private handleDOMChanges(addedNodes: NodeList): void {
    addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        // Check for email threads
        const emailThreads = node.querySelectorAll('[role="listitem"] .zA');
        emailThreads.forEach(this.processEmailThread.bind(this));

        // Check for open email view
        const emailView = node.querySelector('.h7');
        if (emailView) {
          this.processOpenEmail(emailView as HTMLElement);
        }

        // Check for compose window
        const composeWindow = node.querySelector('.AD');
        if (composeWindow) {
          this.addSpurButtonToCompose(composeWindow as HTMLElement);
        }
      }
    });
  }

  private processEmailThread(threadElement: Element): void {
    // Avoid processing the same thread multiple times
    const threadId = threadElement.getAttribute('data-thread-id');
    if (!threadId || this.processedEmails.has(threadId)) {
      return;
    }

    this.processedEmails.add(threadId);

    // Add Spur button to email thread
    const buttonContainer = threadElement.querySelector('.y6');
    if (buttonContainer) {
      const spurButton = this.createSpurButton('Save to Spur', () => {
        this.saveEmailThread(threadElement);
      });
      buttonContainer.appendChild(spurButton);
    }
  }

  private processOpenEmail(emailView: HTMLElement): void {
    // Add Spur button to open email
    const subjectElement = emailView.querySelector('h2.hP');
    if (subjectElement && !subjectElement.querySelector('.spur-email-button')) {
      const spurButton = this.createSpurButton('Save Email', () => {
        this.saveOpenEmail(emailView);
      });
      subjectElement.appendChild(spurButton);
    }

    // Highlight important content
    this.highlightImportantContent(emailView);
  }

  private addSpurButtonToCompose(composeWindow: HTMLElement): void {
    const toolbar = composeWindow.querySelector('.gU.Up');
    if (toolbar && !toolbar.querySelector('.spur-email-button')) {
      const spurButton = this.createSpurButton('🧠 Spur', () => {
        this.openSpurComposeHelper(composeWindow);
      });
      toolbar.appendChild(spurButton);
    }
  }

  private createSpurButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'spur-email-button';
    button.onclick = onClick;
    return button;
  }

  private async saveEmailThread(threadElement: Element): Promise<void> {
    try {
      const emailData = this.extractEmailData(threadElement);
      const memory = this.createMemoryFromEmail(emailData);
      
      await this.saveMemory(memory);
      this.showNotification('Email saved to Spur');
    } catch (error) {
      console.error('Failed to save email thread:', error);
      this.showNotification('Failed to save email', 'error');
    }
  }

  private async saveOpenEmail(emailView: HTMLElement): Promise<void> {
    try {
      const emailData = this.extractOpenEmailData(emailView);
      const memory = this.createMemoryFromEmail(emailData);
      
      await this.saveMemory(memory);
      this.showNotification('Email saved to Spur');
    } catch (error) {
      console.error('Failed to save open email:', error);
      this.showNotification('Failed to save email', 'error');
    }
  }

  private extractEmailData(threadElement: Element): EmailData {
    // Extract email data from thread element
    const subjectElement = threadElement.querySelector('.y6 .bog');
    const fromElement = threadElement.querySelector('.yW .yX');
    const dateElement = threadElement.querySelector('.y6 .xW');
    
    return {
      id: threadElement.getAttribute('data-thread-id') || '',
      subject: subjectElement?.textContent || 'No Subject',
      from: fromElement?.textContent || 'Unknown Sender',
      date: dateElement?.textContent || new Date().toISOString(),
      body: this.extractEmailBody(threadElement),
      threadId: threadElement.getAttribute('data-thread-id') || '',
      labels: this.extractEmailLabels(threadElement)
    };
  }

  private extractOpenEmailData(emailView: HTMLElement): EmailData {
    // Extract email data from open email view
    const subjectElement = emailView.querySelector('h2.hP');
    const fromElement = emailView.querySelector('.gD');
    const dateElement = emailView.querySelector('.I5');
    const bodyElement = emailView.querySelector('.a3s');
    
    return {
      id: this.generateEmailId(),
      subject: subjectElement?.textContent || 'No Subject',
      from: fromElement?.textContent || 'Unknown Sender',
      date: dateElement?.textContent || new Date().toISOString(),
      body: bodyElement?.textContent || '',
      threadId: this.generateThreadId(),
      labels: this.extractOpenEmailLabels(emailView)
    };
  }

  private extractEmailBody(element: Element): string {
    const bodyElement = element.querySelector('.y6 .y2');
    return bodyElement?.textContent || '';
  }

  private extractEmailLabels(element: Element): string[] {
    const labelElements = element.querySelectorAll('.ar.as');
    return Array.from(labelElements).map(el => el.textContent || '');
  }

  private extractOpenEmailLabels(emailView: HTMLElement): string[] {
    const labelElements = emailView.querySelectorAll('.ar.as');
    return Array.from(labelElements).map(el => el.textContent || '');
  }

  private createMemoryFromEmail(email: EmailData): MemoryNode {
    return {
      id: `email_${email.id}`,
      content: `Email: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\n${email.body}`,
      type: 'email',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'gmail',
        emailId: email.id,
        threadId: email.threadId,
        subject: email.subject,
        from: email.from,
        labels: email.labels
      },
      connections: [],
      tags: this.extractTagsFromEmail(email)
    };
  }

  private extractTagsFromEmail(email: EmailData): string[] {
    const text = `${email.subject} ${email.body}`.toLowerCase();
    const words = text.split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 're', 'fwd']);
    
    return words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 5);
  }

  private highlightImportantContent(emailView: HTMLElement): void {
    // Highlight important content in the email
    const content = emailView.textContent || '';
    const importantPhrases = [
      'action required', 'urgent', 'deadline', 'meeting', 'conference call',
      'payment', 'invoice', 'contract', 'agreement', 'important'
    ];

    importantPhrases.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      if (regex.test(content)) {
        // Add highlighting logic here
        this.highlightText(emailView, phrase);
      }
    });
  }

  private highlightText(element: HTMLElement, text: string): void {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    textNodes.forEach(textNode => {
      const textContent = textNode.textContent || '';
      if (textContent.toLowerCase().includes(text.toLowerCase())) {
        const highlightedText = textContent.replace(
          new RegExp(text, 'gi'),
          (match) => `<span class="spur-highlight" data-text="${match}">${match}</span>`
        );

        const wrapper = document.createElement('span');
        wrapper.innerHTML = highlightedText;
        textNode.parentNode?.replaceChild(wrapper, textNode);
      }
    });
  }

  private openSpurComposeHelper(composeWindow: HTMLElement): void {
    // Open Spur helper in compose window
    const helper = document.createElement('div');
    helper.innerHTML = `
      <div class="spur-compose-helper" style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 12px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Spur Assistant</h4>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="spur-helper-btn" data-action="summarize">Summarize</button>
          <button class="spur-helper-btn" data-action="extract-tasks">Extract Tasks</button>
          <button class="spur-helper-btn" data-action="find-similar">Find Similar</button>
          <button class="spur-helper-btn" data-action="add-context">Add Context</button>
        </div>
      </div>
    `;

    const firstElement = composeWindow.querySelector('.AD');
    if (firstElement) {
      firstElement.insertBefore(helper, firstElement.firstChild);
    }

    // Add event listeners to helper buttons
    helper.querySelectorAll('.spur-helper-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).getAttribute('data-action');
        this.handleSpurHelperAction(action, composeWindow);
      });
    });
  }

  private async handleSpurHelperAction(action: string, composeWindow: HTMLElement): Promise<void> {
    switch (action) {
      case 'summarize':
        await this.summarizeEmail(composeWindow);
        break;
      case 'extract-tasks':
        await this.extractTasksFromEmail(composeWindow);
        break;
      case 'find-similar':
        await this.findSimilarEmails(composeWindow);
        break;
      case 'add-context':
        await this.addSpurContext(composeWindow);
        break;
    }
  }

  private async summarizeEmail(composeWindow: HTMLElement): Promise<void> {
    // Extract email content and generate summary
    const bodyElement = composeWindow.querySelector('.Am.Al.editable');
    const emailContent = bodyElement?.textContent || '';
    
    if (emailContent.length > 100) {
      const summary = `Summary: ${emailContent.substring(0, 150)}...`;
      this.showNotification(summary);
    }
  }

  private async extractTasksFromEmail(composeWindow: HTMLElement): Promise<void> {
    // Extract tasks from email content
    const bodyElement = composeWindow.querySelector('.Am.Al.editable');
    const emailContent = bodyElement?.textContent || '';
    
    const taskKeywords = ['todo', 'task', 'action item', 'deadline', 'due', 'complete'];
    const foundTasks = taskKeywords.filter(keyword => 
      emailContent.toLowerCase().includes(keyword)
    );

    if (foundTasks.length > 0) {
      this.showNotification(`Found ${foundTasks.length} potential tasks in email`);
    }
  }

  private async findSimilarEmails(composeWindow: HTMLElement): Promise<void> {
    // Find similar emails in memory
    this.showNotification('Searching for similar emails...');
  }

  private async addSpurContext(composeWindow: HTMLElement): Promise<void> {
    // Add context from Spur memories
    this.showNotification('Adding context from Spur memories...');
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+S to save current email
      if (e.ctrlKey && e.shiftKey && e.key === 's') {
        e.preventDefault();
        const openEmail = document.querySelector('.h7');
        if (openEmail) {
          this.saveOpenEmail(openEmail as HTMLElement);
        }
      }

      // Ctrl+Shift+H to highlight content
      if (e.ctrlKey && e.shiftKey && e.key === 'h') {
        e.preventDefault();
        this.highlightImportantContent(document.body);
      }
    });
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SPUR_GMAIL_ACTION') {
        this.handleGmailAction(message.action, message.data).then(sendResponse);
        return true;
      }
    });
  }

  private async handleGmailAction(action: string, data: any): Promise<any> {
    switch (action) {
      case 'SAVE_EMAIL':
        return await this.saveEmailById(data.emailId);
      case 'SEARCH_EMAILS':
        return await this.searchEmails(data.query);
      case 'GET_CONTEXT':
        return await this.getEmailContext(data.emailId);
      default:
        throw new Error(`Unknown Gmail action: ${action}`);
    }
  }

  private async saveEmailById(emailId: string): Promise<void> {
    const emailElement = document.querySelector(`[data-thread-id="${emailId}"]`);
    if (emailElement) {
      await this.saveEmailThread(emailElement);
    }
  }

  private async searchEmails(query: string): Promise<EmailData[]> {
    // Search emails in Gmail
    // This would require Gmail API access
    return [];
  }

  private async getEmailContext(emailId: string): Promise<any> {
    // Get context for email from Spur memories
    // This would search through saved memories for related content
    return {};
  }

  private async saveMemory(memory: MemoryNode): Promise<void> {
    // Send memory to background script for storage
    chrome.runtime.sendMessage({
      type: 'ADD_MEMORY',
      payload: memory
    });
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    const notification = document.createElement('div');
    notification.className = 'spur-notification';
    notification.textContent = message;
    notification.style.background = type === 'success' ? '#4caf50' : '#f44336';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  private generateEmailId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods
  public updateConfig(config: Partial<ContentScriptConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.gmailIntegration === false) {
      this.disable();
    } else if (config.gmailIntegration === true) {
      this.enable();
    }
  }

  private enable(): void {
    if (!this.observer) {
      this.setupMutationObserver();
    }
  }

  private disable(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
    
    // Remove Spur buttons and highlights
    document.querySelectorAll('.spur-email-button, .spur-highlight').forEach(el => el.remove());
  }

  public destroy(): void {
    this.disable();
    this.processedEmails.clear();
  }
}

// Initialize Gmail integration when content script loads
const initializeGmailIntegration = async () => {
  try {
    // Get configuration from storage
    const result = await chrome.storage.local.get(['spurConfig']);
    const config = result.spurConfig || {
      gmailIntegration: true,
      autoCapture: true,
      voiceCommands: true
    };

    const gmailIntegration = new GmailIntegration(config);
    
    // Listen for config changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.spurConfig) {
        gmailIntegration.updateConfig(changes.spurConfig.newValue);
      }
    });

    // Make integration available globally for debugging
    (window as any).spurGmailIntegration = gmailIntegration;
    
    console.log('Spur Gmail integration loaded successfully');
  } catch (error) {
    console.error('Failed to initialize Gmail integration:', error);
  }
};

// Start the integration
initializeGmailIntegration();

export { GmailIntegration };

// Keep script alive
console.log('Spur content script loaded');