interface NotificationOptions {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  iconUrl?: string;
  duration?: number;
  actions?: Array<{
    title: string;
    action: string;
  }>;
  silent?: boolean;
  requireInteraction?: boolean;
}

interface QueuedNotification extends NotificationOptions {
  id: string;
  timestamp: number;
  priority: number;
}

class NotificationManager {
  private readonly NOTIFICATION_KEY = 'spur_notifications';
  private readonly MAX_NOTIFICATIONS = 50;
  private readonly DEFAULT_DURATION = 5000; // 5 seconds
  private readonly ICONS = {
    info: '/assets/icon-128.png',
    success: '/assets/icon-128.png',
    warning: '/assets/icon-128.png',
    error: '/assets/icon-128.png'
  };

  private queue: QueuedNotification[] = [];
  private activeNotifications: Set<string> = new Set();
  private isProcessing = false;

  async show(options: NotificationOptions): Promise<string> {
    try {
      const notificationId = this.generateNotificationId();
      
      // Add to queue
      this.queue.push({
        ...options,
        id: notificationId,
        timestamp: Date.now(),
        priority: this.calculatePriority(options.type)
      });

      // Sort queue by priority
      this.queue.sort((a, b) => b.priority - a.priority);

      // Process queue
      this.processQueue();

      return notificationId;
    } catch (error) {
      console.error('Failed to show notification:', error);
      throw error;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.activeNotifications.size < 5) {
        const notification = this.queue.shift()!;
        await this.showNotification(notification);
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async showNotification(notification: QueuedNotification): Promise<void> {
    try {
      // Check if notifications are available
      if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return;
      }

      // Request permission if needed
      if (Notification.permission === 'default') {
        await this.requestPermission();
      }

      if (Notification.permission !== 'granted') {
        console.warn('Notification permission denied');
        return;
      }

      // Create Chrome notification
      const chromeNotification: chrome.notifications.NotificationOptions = {
        type: 'basic',
        title: notification.title,
        message: notification.message,
        iconUrl: notification.iconUrl || this.ICONS[notification.type || 'info'],
        silent: notification.silent || false,
        requireInteraction: notification.requireInteraction || false
      };

      // Add buttons if provided
      if (notification.actions && notification.actions.length > 0) {
        chromeNotification.buttons = notification.actions.map(action => ({
          title: action.title,
          iconUrl: '/assets/icon-16.png'
        }));
      }

      // Show notification
      await chrome.notifications.create(notification.id, chromeNotification);
      this.activeNotifications.add(notification.id);

      // Auto-dismiss if not requiring interaction
      if (!notification.requireInteraction) {
        const duration = notification.duration || this.DEFAULT_DURATION;
        setTimeout(() => {
          this.dismiss(notification.id);
        }, duration);
      }

      console.log(`Notification shown: ${notification.id}`);

      // Setup notification click handler
      this.setupNotificationHandlers(notification);

    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  private setupNotificationHandlers(notification: QueuedNotification): void {
    // Click handler
    chrome.notifications.onClicked.addListener((id) => {
      if (id === notification.id) {
        this.handleNotificationClick(notification);
      }
    });

    // Button click handler
    chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
      if (id === notification.id && notification.actions) {
        const action = notification.actions[buttonIndex];
        this.handleNotificationAction(notification, action.action);
      }
    });

    // Closed handler
    chrome.notifications.onClosed.addListener((id, byUser) => {
      if (id === notification.id) {
        this.handleNotificationClosed(notification, byUser);
      }
    });
  }

  private handleNotificationClick(notification: QueuedNotification): void {
    console.log(`Notification clicked: ${notification.id}`);
    
    // Open relevant page based on notification type
    if (notification.type === 'success' && notification.message.includes('email')) {
      // Open Gmail
      chrome.tabs.create({ url: 'https://mail.google.com' });
    } else if (notification.type === 'info' && notification.message.includes('memory')) {
      // Open extension popup
      chrome.action.openPopup();
    }

    // Dismiss notification
    this.dismiss(notification.id);
  }

  private handleNotificationAction(notification: QueuedNotification, action: string): void {
    console.log(`Notification action triggered: ${action} for ${notification.id}`);
    
    switch (action) {
      case 'view':
        this.handleNotificationClick(notification);
        break;
      case 'dismiss':
        this.dismiss(notification.id);
        break;
      case 'snooze':
        this.snooze(notification);
        break;
      default:
        console.warn(`Unknown notification action: ${action}`);
    }
  }

  private handleNotificationClosed(notification: QueuedNotification, byUser: boolean): void {
    console.log(`Notification closed: ${notification.id} (by user: ${byUser})`);
    this.activeNotifications.delete(notification.id);
  }

  async dismiss(notificationId: string): Promise<void> {
    try {
      await chrome.notifications.clear(notificationId);
      this.activeNotifications.delete(notificationId);
      console.log(`Notification dismissed: ${notificationId}`);
    } catch (error) {
      console.error(`Failed to dismiss notification ${notificationId}:`, error);
    }
  }

  private async snooze(notification: QueuedNotification): Promise<void> {
    try {
      await this.dismiss(notification.id);
      
      // Re-add to queue with lower priority after 5 minutes
      setTimeout(() => {
        this.queue.push({
          ...notification,
          timestamp: Date.now(),
          priority: Math.max(1, notification.priority - 1)
        });
        this.processQueue();
      }, 5 * 60 * 1000); // 5 minutes
      
      console.log(`Notification snoozed: ${notification.id}`);
    } catch (error) {
      console.error(`Failed to snooze notification ${notificationId}:`, error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      // Clear all active notifications
      const activeIds = Array.from(this.activeNotifications);
      for (const id of activeIds) {
        await this.dismiss(id);
      }

      // Clear queue
      this.queue = [];
      
      console.log('All notifications cleared');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  async getActiveNotifications(): Promise<string[]> {
    return Array.from(this.activeNotifications);
  }

  async getQueueLength(): Promise<number> {
    return this.queue.length;
  }

  async requestPermission(): Promise<boolean> {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  async hasPermission(): Promise<boolean> {
    try {
      return Notification.permission === 'granted';
    } catch (error) {
      return false;
    }
  }

  private calculatePriority(type?: string): number {
    switch (type) {
      case 'error':
        return 5;
      case 'warning':
        return 4;
      case 'success':
        return 3;
      case 'info':
      default:
        return 2;
    }
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper methods for common notification types
  async success(title: string, message: string, options: Partial<NotificationOptions> = {}): Promise<string> {
    return this.show({ title, message, type: 'success', ...options });
  }

  async error(title: string, message: string, options: Partial<NotificationOptions> = {}): Promise<string> {
    return this.show({ title, message, type: 'error', ...options });
  }

  async warning(title: string, message: string, options: Partial<NotificationOptions> = {}): Promise<string> {
    return this.show({ title, message, type: 'warning', ...options });
  }

  async info(title: string, message: string, options: Partial<NotificationOptions> = {}): Promise<string> {
    return this.show({ title, message, type: 'info', ...options });
  }

  // Gmail-specific notifications
  async newEmail(subject: string, from: string): Promise<string> {
    return this.info('New Email', `${subject}\nFrom: ${from}`, {
      actions: [
        { title: 'View', action: 'view' },
        { title: 'Dismiss', action: 'dismiss' }
      ],
      requireInteraction: true
    });
  }

  // Voice recording notifications
  async recordingStarted(): Promise<string> {
    return this.info('Recording Started', 'Spur is now listening...', {
      duration: 2000
    });
  }

  async recordingStopped(transcript: string): Promise<string> {
    const message = transcript.length > 100 ? transcript.substring(0, 100) + '...' : transcript;
    return this.success('Voice Recording Saved', message, {
      actions: [
        { title: 'View', action: 'view' },
        { title: 'Dismiss', action: 'dismiss' }
      ]
    });
  }

  // Memory notifications
  async memorySaved(content: string): Promise<string> {
    const message = content.length > 100 ? content.substring(0, 100) + '...' : content;
    return this.success('Memory Saved', message);
  }

  // Sync notifications
  async syncStarted(): Promise<string> {
    return this.info('Sync Started', 'Synchronizing your data...', {
      duration: 3000
    });
  }

  async syncCompleted(count: number): Promise<string> {
    return this.success('Sync Completed', `${count} items synchronized`);
  }

  async syncFailed(error: string): Promise<string> {
    return this.error('Sync Failed', error);
  }

  // Integration status notifications
  async gmailConnected(): Promise<string> {
    return this.success('Gmail Connected', 'Your Gmail account is now connected to Spur');
  }

  async gmailDisconnected(): Promise<string> {
    return this.warning('Gmail Disconnected', 'Your Gmail account has been disconnected');
  }

  async voiceEnabled(): Promise<string> {
    return this.success('Voice Enabled', 'Voice recognition is now available');
  }

  async voiceDisabled(): Promise<string> {
    return this.warning('Voice Disabled', 'Voice recognition has been disabled');
  }

  // Error notifications
  async permissionDenied(feature: string): Promise<string> {
    return this.error('Permission Denied', `${feature} requires additional permissions`);
  }

  async networkError(): Promise<string> {
    return this.error('Network Error', 'Please check your internet connection');
  }

  async storageQuotaExceeded(): Promise<string> {
    return this.error('Storage Full', 'Please clear some old memories to continue');
  }

  // Welcome and onboarding notifications
  async welcome(): Promise<string> {
    return this.success(
      'Welcome to Spur',
      'Your mindful productivity companion is ready to help!',
      {
        actions: [
          { title: 'Get Started', action: 'view' },
          { title: 'Dismiss', action: 'dismiss' }
        ],
        requireInteraction: true
      }
    );
  }

  async featureHighlight(feature: string, description: string): Promise<string> {
    return this.info(`New Feature: ${feature}`, description, {
      actions: [
        { title: 'Learn More', action: 'view' },
        { title: 'Dismiss', action: 'dismiss' }
      ]
    });
  }

  // System notifications
  async updateAvailable(version: string): Promise<string> {
    return this.info(
      'Update Available',
      `Spur ${version} is ready to install`,
      {
        actions: [
          { title: 'Update Now', action: 'view' },
          { title: 'Later', action: 'dismiss' }
        ]
      }
    );
  }

  async maintenanceScheduled(time: string): Promise<string> {
    return this.warning(
      'Maintenance Scheduled',
      `Spur will be unavailable at ${time}`,
      {
        duration: 10000
      }
    );
  }
}

export const notificationManager = new NotificationManager();
export { NotificationManager, type NotificationOptions };