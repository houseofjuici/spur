/**
 * Alerting System for Spur Super App
 * Intelligent alerting with multiple channels and escalation policies
 */

import { PerformanceAlert } from './performance-monitor';

export interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'discord' | 'teams';
  enabled: boolean;
  config: any;
  send: (alert: PerformanceAlert, channel: AlertChannel) => Promise<void>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (metrics: any, context: any) => boolean;
  severity: 'info' | 'warning' | 'critical';
  channels: string[];
  cooldown: number; // milliseconds
  escalationPolicy?: EscalationPolicy;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  level: number;
  delay: number; // milliseconds
  channels: string[];
  message: string;
}

export interface AlertTemplate {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook';
  subject: string;
  content: string;
  variables: string[];
}

export interface AlertHistory {
  id: string;
  alertId: string;
  timestamp: number;
  action: 'created' | 'escalated' | 'resolved' | 'acknowledged';
  userId?: string;
  message?: string;
  data: any;
}

/**
 * Advanced Alerting System
 */
export class AlertingSystem {
  private channels: Map<string, AlertChannel> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private templates: Map<string, AlertTemplate> = new Map();
  private history: AlertHistory[] = [];
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultChannels();
    this.initializeDefaultRules();
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default alert channels
   */
  private initializeDefaultChannels() {
    // Email channel
    this.channels.set('email', {
      id: 'email',
      name: 'Email Notifications',
      type: 'email',
      enabled: true,
      config: {
        smtp: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        from: process.env.ALERT_EMAIL_FROM || 'alerts@spur.app',
        to: process.env.ALERT_EMAIL_TO?.split(',') || ['admin@spur.app'],
      },
      send: this.sendEmailAlert.bind(this),
    });

    // Slack channel
    this.channels.set('slack', {
      id: 'slack',
      name: 'Slack Notifications',
      type: 'slack',
      enabled: true,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#alerts',
        username: 'Spur Alerts',
        iconEmoji: ':warning:',
      },
      send: this.sendSlackAlert.bind(this),
    });

    // Webhook channel
    this.channels.set('webhook', {
      id: 'webhook',
      name: 'Webhook Notifications',
      type: 'webhook',
      enabled: false,
      config: {
        url: process.env.WEBHOOK_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      send: this.sendWebhookAlert.bind(this),
    });

    // PagerDuty channel
    this.channels.set('pagerduty', {
      id: 'pagerduty',
      name: 'PagerDuty',
      type: 'pagerduty',
      enabled: false,
      config: {
        integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
        serviceKey: process.env.PAGERDUTY_SERVICE_KEY,
      },
      send: this.sendPagerDutyAlert.bind(this),
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules() {
    // High response time rule
    this.rules.set('high-response-time', {
      id: 'high-response-time',
      name: 'High Response Time',
      description: 'Alert when average response time exceeds threshold',
      condition: (metrics, context) => {
        const responseTimes = metrics.filter(m => m.metric === 'response.time').map(m => m.value);
        if (responseTimes.length === 0) return false;
        
        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        return avgResponseTime > 1000; // 1 second threshold
      },
      severity: 'warning',
      channels: ['email', 'slack'],
      cooldown: 5 * 60 * 1000, // 5 minutes
    });

    // Critical response time rule
    this.rules.set('critical-response-time', {
      id: 'critical-response-time',
      name: 'Critical Response Time',
      description: 'Alert when response time is critically high',
      condition: (metrics, context) => {
        const responseTimes = metrics.filter(m => m.metric === 'response.time').map(m => m.value);
        if (responseTimes.length === 0) return false;
        
        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        return avgResponseTime > 2000; // 2 seconds threshold
      },
      severity: 'critical',
      channels: ['email', 'slack', 'pagerduty'],
      cooldown: 2 * 60 * 1000, // 2 minutes
      escalationPolicy: {
        id: 'response-time-escalation',
        name: 'Response Time Escalation',
        levels: [
          {
            level: 1,
            delay: 10 * 60 * 1000, // 10 minutes
            channels: ['slack'],
            message: 'Response time still elevated - please investigate',
          },
          {
            level: 2,
            delay: 30 * 60 * 1000, // 30 minutes
            channels: ['pagerduty'],
            message: 'Critical response time requiring immediate attention',
          },
        ],
      },
    });

    // High error rate rule
    this.rules.set('high-error-rate', {
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds threshold',
      condition: (metrics, context) => {
        const errorRates = metrics.filter(m => m.metric === 'errors.rate').map(m => m.value);
        if (errorRates.length === 0) return false;
        
        const avgErrorRate = errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;
        return avgErrorRate > 5; // 5% threshold
      },
      severity: 'critical',
      channels: ['email', 'slack', 'pagerduty'],
      cooldown: 3 * 60 * 1000, // 3 minutes
    });

    // Memory usage rule
    this.rules.set('high-memory-usage', {
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      description: 'Alert when memory usage exceeds threshold',
      condition: (metrics, context) => {
        const memoryMetrics = metrics.filter(m => m.metric === 'memory.percentage').map(m => m.value);
        if (memoryMetrics.length === 0) return false;
        
        const currentMemory = memoryMetrics[memoryMetrics.length - 1];
        return currentMemory > 90; // 90% threshold
      },
      severity: 'warning',
      channels: ['email', 'slack'],
      cooldown: 10 * 60 * 1000, // 10 minutes
    });

    // Critical memory usage rule
    this.rules.set('critical-memory-usage', {
      id: 'critical-memory-usage',
      name: 'Critical Memory Usage',
      description: 'Alert when memory usage is critically high',
      condition: (metrics, context) => {
        const memoryMetrics = metrics.filter(m => m.metric === 'memory.percentage').map(m => m.value);
        if (memoryMetrics.length === 0) return false;
        
        const currentMemory = memoryMetrics[memoryMetrics.length - 1];
        return currentMemory > 95; // 95% threshold
      },
      severity: 'critical',
      channels: ['email', 'slack', 'pagerduty'],
      cooldown: 2 * 60 * 1000, // 2 minutes
    });

    // Database performance rule
    this.rules.set('slow-database-queries', {
      id: 'slow-database-queries',
      name: 'Slow Database Queries',
      description: 'Alert when database query time exceeds threshold',
      condition: (metrics, context) => {
        const queryTimes = metrics.filter(m => m.metric === 'database.query.avg').map(m => m.value);
        if (queryTimes.length === 0) return false;
        
        const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
        return avgQueryTime > 500; // 500ms threshold
      },
      severity: 'warning',
      channels: ['email', 'slack'],
      cooldown: 5 * 60 * 1000, // 5 minutes
    });

    // Assistant performance rule
    this.rules.set('assistant-performance', {
      id: 'assistant-performance',
      name: 'Assistant Performance Degradation',
      description: 'Alert when assistant response time is elevated',
      condition: (metrics, context) => {
        const assistantMetrics = metrics.filter(m => m.metric === 'assistant.response.time').map(m => m.value);
        if (assistantMetrics.length === 0) return false;
        
        const avgResponseTime = assistantMetrics.reduce((sum, time) => sum + time, 0) / assistantMetrics.length;
        return avgResponseTime > 500; // 500ms threshold
      },
      severity: 'warning',
      channels: ['email', 'slack'],
      cooldown: 5 * 60 * 1000, // 5 minutes
    });

    // Capture engine performance rule
    this.rules.set('capture-performance', {
      id: 'capture-performance',
      name: 'Capture Engine Performance',
      description: 'Alert when capture engine processing time is elevated',
      condition: (metrics, context) => {
        const captureMetrics = metrics.filter(m => m.metric === 'capture.processing.time').map(m => m.value);
        if (captureMetrics.length === 0) return false;
        
        const avgProcessingTime = captureMetrics.reduce((sum, time) => sum + time, 0) / captureMetrics.length;
        return avgProcessingTime > 100; // 100ms threshold
      },
      severity: 'info',
      channels: ['email'],
      cooldown: 10 * 60 * 1000, // 10 minutes
    });
  }

  /**
   * Initialize default alert templates
   */
  private initializeDefaultTemplates() {
    // Email template
    this.templates.set('email-default', {
      id: 'email-default',
      name: 'Default Email Template',
      type: 'email',
      subject: '[{{severity|upper}}] {{metric}} Alert - {{serviceName}}',
      content: `
<h2>{{serviceName}} Performance Alert</h2>

<p><strong>Severity:</strong> {{severity|upper}}</p>
<p><strong>Metric:</strong> {{metric}}</p>
<p><strong>Current Value:</strong> {{currentValue}} {{unit}}</p>
<p><strong>Threshold:</strong> {{threshold}} {{unit}}</p>
<p><strong>Time:</strong> {{timestamp}}</p>

<p><strong>Message:</strong></p>
<p>{{message}}</p>

{{#if context}}
<h3>Additional Context:</h3>
<ul>
{{#each context}}
  <li><strong>{{@key}}:</strong> {{this}}</li>
{{/each}}
</ul>
{{/if}}

<hr>
<p>This alert was generated by the Spur Performance Monitoring System.</p>
<p>To manage alert preferences, visit the monitoring dashboard.</p>
      `,
      variables: ['severity', 'metric', 'currentValue', 'unit', 'threshold', 'timestamp', 'message', 'context', 'serviceName'],
    });

    // Slack template
    this.templates.set('slack-default', {
      id: 'slack-default',
      name: 'Default Slack Template',
      type: 'slack',
      subject: '',
      content: {
        text: '{{serviceName}} Performance Alert',
        attachments: [{
          color: '{{#eq severity "critical"}}danger{{else}}{{#eq severity "warning"}}warning{{else}}good{{/eq}}{{/eq}}',
          title: '{{metric}} Alert',
          text: '{{message}}',
          fields: [
            { title: 'Severity', value: '{{severity|upper}}', short: true },
            { title: 'Metric', value: '{{metric}}', short: true },
            { title: 'Current', value: '{{currentValue}} {{unit}}', short: true },
            { title: 'Threshold', value: '{{threshold}} {{unit}}', short: true },
            { title: 'Time', value: '{{timestamp}}', short: false },
          ],
          footer: 'Spur Monitoring System',
          ts: '{{timestampUnix}}',
        }],
      },
      variables: ['severity', 'metric', 'currentValue', 'unit', 'threshold', 'timestamp', 'message', 'serviceName', 'timestampUnix'],
    });

    // Webhook template
    this.templates.set('webhook-default', {
      id: 'webhook-default',
      name: 'Default Webhook Template',
      type: 'webhook',
      subject: '',
      content: {
        alertId: '{{alertId}}',
        severity: '{{severity}}',
        metric: '{{metric}}',
        currentValue: '{{currentValue}}',
        unit: '{{unit}}',
        threshold: '{{threshold}}',
        message: '{{message}}',
        timestamp: '{{timestamp}}',
        serviceName: '{{serviceName}}',
        context: '{{context}}',
      },
      variables: ['alertId', 'severity', 'metric', 'currentValue', 'unit', 'threshold', 'message', 'timestamp', 'serviceName', 'context'],
    });
  }

  /**
   * Evaluate metrics against alert rules
   */
  async evaluateMetrics(metrics: any[], context: any = {}): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.condition(metrics, context)) continue;

      // Check cooldown
      const recentAlerts = Array.from(this.activeAlerts.values()).filter(alert => 
        alert.metric.includes(rule.id.split('-')[0]) && 
        !alert.resolved &&
        alert.timestamp > Date.now() - rule.cooldown
      );

      if (recentAlerts.length > 0) continue;

      // Create alert
      const alert: PerformanceAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: rule.severity,
        metric: rule.name,
        current: this.extractMetricValue(metrics, rule.id),
        threshold: this.extractThreshold(rule.id),
        message: this.generateAlertMessage(rule, metrics),
        timestamp: Date.now(),
        resolved: false,
        context: { ruleId: rule.id, ...context },
      };

      alerts.push(alert);
      this.activeAlerts.set(alert.id, alert);
      
      // Add to history
      this.addToHistory({
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert.id,
        timestamp: Date.now(),
        action: 'created',
        data: { rule, alert },
      });

      // Send notifications
      await this.sendAlertNotifications(alert, rule);

      // Setup escalation if needed
      if (rule.escalationPolicy) {
        this.setupEscalation(alert, rule.escalationPolicy);
      }
    }

    return alerts;
  }

  /**
   * Extract metric value for rule
   */
  private extractMetricValue(metrics: any[], ruleId: string): number {
    switch (ruleId) {
      case 'high-response-time':
      case 'critical-response-time':
        const responseTimes = metrics.filter(m => m.metric === 'response.time').map(m => m.value);
        return responseTimes.length > 0 ? 
          responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
      
      case 'high-error-rate':
        const errorRates = metrics.filter(m => m.metric === 'errors.rate').map(m => m.value);
        return errorRates.length > 0 ? 
          errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length : 0;
      
      case 'high-memory-usage':
      case 'critical-memory-usage':
        const memoryMetrics = metrics.filter(m => m.metric === 'memory.percentage').map(m => m.value);
        return memoryMetrics.length > 0 ? memoryMetrics[memoryMetrics.length - 1] : 0;
      
      case 'slow-database-queries':
        const queryTimes = metrics.filter(m => m.metric === 'database.query.avg').map(m => m.value);
        return queryTimes.length > 0 ? 
          queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length : 0;
      
      case 'assistant-performance':
        const assistantMetrics = metrics.filter(m => m.metric === 'assistant.response.time').map(m => m.value);
        return assistantMetrics.length > 0 ? 
          assistantMetrics.reduce((sum, time) => sum + time, 0) / assistantMetrics.length : 0;
      
      case 'capture-performance':
        const captureMetrics = metrics.filter(m => m.metric === 'capture.processing.time').map(m => m.value);
        return captureMetrics.length > 0 ? 
          captureMetrics.reduce((sum, time) => sum + time, 0) / captureMetrics.length : 0;
      
      default:
        return 0;
    }
  }

  /**
   * Extract threshold for rule
   */
  private extractThreshold(ruleId: string): number {
    const thresholds: Record<string, number> = {
      'high-response-time': 1000,
      'critical-response-time': 2000,
      'high-error-rate': 5,
      'high-memory-usage': 90,
      'critical-memory-usage': 95,
      'slow-database-queries': 500,
      'assistant-performance': 500,
      'capture-performance': 100,
    };

    return thresholds[ruleId] || 0;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, metrics: any[]): string {
    const currentValue = this.extractMetricValue(metrics, rule.id);
    const threshold = this.extractThreshold(rule.id);

    switch (rule.id) {
      case 'high-response-time':
        return `Average response time is elevated: ${currentValue.toFixed(2)}ms (threshold: ${threshold}ms)`;
      
      case 'critical-response-time':
        return `CRITICAL: Response time is critically high: ${currentValue.toFixed(2)}ms (threshold: ${threshold}ms)`;
      
      case 'high-error-rate':
        return `High error rate detected: ${currentValue.toFixed(2)}% (threshold: ${threshold}%)`;
      
      case 'high-memory-usage':
        return `Memory usage is elevated: ${currentValue.toFixed(1)}% (threshold: ${threshold}%)`;
      
      case 'critical-memory-usage':
        return `CRITICAL: Memory usage is critically high: ${currentValue.toFixed(1)}% (threshold: ${threshold}%)`;
      
      case 'slow-database-queries':
        return `Database query performance degraded: ${currentValue.toFixed(2)}ms (threshold: ${threshold}ms)`;
      
      case 'assistant-performance':
        return `Assistant response time elevated: ${currentValue.toFixed(2)}ms (threshold: ${threshold}ms)`;
      
      case 'capture-performance':
        return `Capture engine processing time elevated: ${currentValue.toFixed(2)}ms (threshold: ${threshold}ms)`;
      
      default:
        return `${rule.name}: Current value ${currentValue} exceeds threshold ${threshold}`;
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: PerformanceAlert, rule: AlertRule): Promise<void> {
    for (const channelId of rule.channels) {
      const channel = this.channels.get(channelId);
      if (channel && channel.enabled) {
        try {
          await channel.send(alert, channel);
        } catch (error) {
          console.error(`Failed to send alert to ${channelId}:`, error);
        }
      }
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: PerformanceAlert, channel: AlertChannel): Promise<void> {
    const template = this.templates.get('email-default');
    if (!template) return;

    const renderedContent = this.renderTemplate(template, alert);
    
    // In a real implementation, use nodemailer or similar
    console.log(`[EMAIL] ${alert.message}`);
    console.log('Email content:', renderedContent);

    // Simulated email sending
    // await transporter.sendMail({
    //   from: channel.config.from,
    //   to: channel.config.to.join(','),
    //   subject: renderedContent.subject,
    //   html: renderedContent.content,
    // });
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: PerformanceAlert, channel: AlertChannel): Promise<void> {
    const template = this.templates.get('slack-default');
    if (!template) return;

    const renderedContent = this.renderTemplate(template, alert);
    
    // In a real implementation, send to Slack webhook
    console.log(`[SLACK] ${alert.message}`);
    console.log('Slack payload:', JSON.stringify(renderedContent.content, null, 2));

    // Simulated Slack webhook call
    // await fetch(channel.config.webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(renderedContent.content),
    // });
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: PerformanceAlert, channel: AlertChannel): Promise<void> {
    const template = this.templates.get('webhook-default');
    if (!template) return;

    const renderedContent = this.renderTemplate(template, alert);
    
    // In a real implementation, send to webhook
    console.log(`[WEBHOOK] ${alert.message}`);
    console.log('Webhook payload:', JSON.stringify(renderedContent.content, null, 2));

    // Simulated webhook call
    // await fetch(channel.config.url, {
    //   method: channel.config.method || 'POST',
    //   headers: channel.config.headers,
    //   body: JSON.stringify(renderedContent.content),
    // });
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(alert: PerformanceAlert, channel: AlertChannel): Promise<void> {
    // In a real implementation, send to PagerDuty API
    console.log(`[PAGERDUTY] ${alert.message}`);
    console.log('PagerDuty payload:', JSON.stringify({
      service_key: channel.config.serviceKey,
      incident_key: alert.id,
      event_type: 'trigger',
      description: alert.message,
      client: 'Spur Monitoring',
      client_url: process.env.DASHBOARD_URL || 'https://spur.app/monitoring',
      details: {
        alertId: alert.id,
        severity: alert.type,
        metric: alert.metric,
        current: alert.current,
        threshold: alert.threshold,
        timestamp: alert.timestamp,
      },
    }, null, 2));

    // Simulated PagerDuty API call
    // await fetch('https://events.pagerduty.com/v2/enqueue', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     routing_key: channel.config.integrationKey,
    //     event_action: 'trigger',
    //     payload: {
    //       summary: alert.message,
    //       source: 'spur-monitoring',
    //       severity: alert.type === 'critical' ? 'critical' : 'warning',
    //       custom_details: alert,
    //     },
    //   }),
    // });
  }

  /**
   * Render template with alert data
   */
  private renderTemplate(template: AlertTemplate, alert: PerformanceAlert): any {
    const context = {
      alertId: alert.id,
      severity: alert.type,
      metric: alert.metric,
      currentValue: alert.current,
      unit: this.getMetricUnit(alert.metric),
      threshold: alert.threshold,
      message: alert.message,
      timestamp: new Date(alert.timestamp).toISOString(),
      timestampUnix: Math.floor(alert.timestamp / 1000),
      serviceName: 'Spur Super App',
      context: alert.context,
    };

    if (template.type === 'email') {
      return {
        subject: this.interpolateString(template.subject, context),
        content: this.interpolateString(template.content, context),
      };
    } else {
      return {
        content: this.interpolateObject(template.content, context),
      };
    }
  }

  /**
   * Interpolate string with variables
   */
  private interpolateString(template: string, context: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const keys = key.split('|');
      let value = context;
      
      for (const k of keys) {
        if (k.trim() === 'upper') {
          value = typeof value === 'string' ? value.toUpperCase() : value;
        } else if (k.trim() === 'lower') {
          value = typeof value === 'string' ? value.toLowerCase() : value;
        } else if (k.trim().startsWith('eq ')) {
          const [, expected] = k.trim().split(' ');
          value = value === expected;
        } else if (k.trim().startsWith('#if ')) {
          // Handle conditional logic (simplified)
          return value ? '' : match;
        } else if (k.trim().startsWith('#each ')) {
          // Handle iteration (simplified)
          return JSON.stringify(value);
        } else {
          value = value?.[k.trim()];
        }
      }
      
      return value?.toString() || match;
    });
  }

  /**
   * Interpolate object with variables
   */
  private interpolateObject(obj: any, context: any): any {
    if (typeof obj === 'string') {
      return this.interpolateString(obj, context);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item, context));
    } else if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value, context);
      }
      return result;
    }
    return obj;
  }

  /**
   * Get unit for metric
   */
  private getMetricUnit(metric: string): string {
    const unitMap: Record<string, string> = {
      'High Response Time': 'ms',
      'Critical Response Time': 'ms',
      'High Error Rate': '%',
      'High Memory Usage': '%',
      'Critical Memory Usage': '%',
      'Slow Database Queries': 'ms',
      'Assistant Performance Degradation': 'ms',
      'Capture Engine Performance': 'ms',
    };

    return unitMap[metric] || '';
  }

  /**
   * Setup escalation for alert
   */
  private setupEscalation(alert: PerformanceAlert, policy: EscalationPolicy): void {
    for (const level of policy.levels) {
      const timer = setTimeout(async () => {
        await this.escalateAlert(alert, level, policy);
      }, level.delay);

      this.escalationTimers.set(`${alert.id}_level${level.level}`, timer);
    }
  }

  /**
   * Escalate alert
   */
  private async escalateAlert(alert: PerformanceAlert, level: EscalationLevel, policy: EscalationPolicy): Promise<void> {
    if (alert.resolved) return;

    const escalatedAlert: PerformanceAlert = {
      ...alert,
      id: `${alert.id}_escalated_${level.level}`,
      message: level.message,
      context: {
        ...alert.context,
        escalationLevel: level.level,
        originalAlertId: alert.id,
      },
    };

    // Send escalation notifications
    for (const channelId of level.channels) {
      const channel = this.channels.get(channelId);
      if (channel && channel.enabled) {
        try {
          await channel.send(escalatedAlert, channel);
        } catch (error) {
          console.error(`Failed to send escalation to ${channelId}:`, error);
        }
      }
    }

    // Add to history
    this.addToHistory({
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId: alert.id,
      timestamp: Date.now(),
      action: 'escalated',
      data: { level, policy, escalatedAlert },
    });
  }

  /**
   * Add entry to history
   */
  private addToHistory(entry: AlertHistory): void {
    this.history.push(entry);
    
    // Keep only last 1000 entries
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000);
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, userId?: string, message?: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    this.activeAlerts.delete(alertId);

    // Cancel escalation timers
    for (const [key, timer] of this.escalationTimers.entries()) {
      if (key.startsWith(alertId)) {
        clearTimeout(timer);
        this.escalationTimers.delete(key);
      }
    }

    // Add to history
    this.addToHistory({
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId,
      timestamp: Date.now(),
      action: 'resolved',
      userId,
      message,
      data: { alert },
    });

    // Send resolution notifications
    await this.sendResolutionNotifications(alert, userId, message);

    return true;
  }

  /**
   * Send resolution notifications
   */
  private async sendResolutionNotifications(alert: PerformanceAlert, userId?: string, message?: string): Promise<void> {
    // Send resolution notifications to all channels that received the original alert
    const rule = Array.from(this.rules.values()).find(r => 
      alert.metric.includes(r.id.split('-')[0])
    );

    if (rule) {
      for (const channelId of rule.channels) {
        const channel = this.channels.get(channelId);
        if (channel && channel.enabled) {
          try {
            const resolutionAlert: PerformanceAlert = {
              ...alert,
              message: `RESOLVED: ${alert.message}`,
              context: {
                ...alert.context,
                resolvedBy: userId,
                resolutionMessage: message,
                resolvedAt: Date.now(),
              },
            };

            await channel.send(resolutionAlert, channel);
          } catch (error) {
            console.error(`Failed to send resolution to ${channelId}:`, error);
          }
        }
      }
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): AlertHistory[] {
    return this.history.slice(-limit);
  }

  /**
   * Get alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get alert channels
   */
  getChannels(): AlertChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Add custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Update alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  /**
   * Add custom alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);
  }

  /**
   * Remove alert channel
   */
  removeChannel(channelId: string): boolean {
    return this.channels.delete(channelId);
  }

  /**
   * Update alert channel
   */
  updateChannel(channelId: string, updates: Partial<AlertChannel>): boolean {
    const channel = this.channels.get(channelId);
    if (channel) {
      Object.assign(channel, updates);
      return true;
    }
    return false;
  }

  /**
   * Add custom alert template
   */
  addTemplate(template: AlertTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    rulesCount: number;
    channelsCount: number;
    averageResolutionTime: number;
  } {
    const totalAlerts = this.history.filter(h => h.action === 'created').length;
    const resolvedAlerts = this.history.filter(h => h.action === 'resolved').length;
    
    // Calculate average resolution time
    const createdAlerts = this.history.filter(h => h.action === 'created');
    const resolutionTimes = createdAlerts.map(created => {
      const resolved = this.history.find(h => 
        h.action === 'resolved' && h.alertId === created.alertId
      );
      return resolved ? resolved.timestamp - created.timestamp : null;
    }).filter(time => time !== null) as number[];

    const averageResolutionTime = resolutionTimes.length > 0 ? 
      resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;

    return {
      totalAlerts,
      activeAlerts: this.activeAlerts.size,
      resolvedAlerts,
      rulesCount: this.rules.size,
      channelsCount: Array.from(this.channels.values()).filter(c => c.enabled).length,
      averageResolutionTime,
    };
  }

  /**
   * Export alerting configuration
   */
  exportConfig(): any {
    return {
      rules: Array.from(this.rules.values()),
      channels: Array.from(this.channels.values()).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        enabled: c.enabled,
        config: c.config,
      })),
      templates: Array.from(this.templates.values()),
    };
  }

  /**
   * Import alerting configuration
   */
  importConfig(config: any): void {
    if (config.rules) {
      config.rules.forEach((rule: AlertRule) => {
        this.rules.set(rule.id, rule);
      });
    }

    if (config.channels) {
      config.channels.forEach((channel: AlertChannel) => {
        const existingChannel = this.channels.get(channel.id);
        if (existingChannel) {
          Object.assign(existingChannel, channel);
        } else {
          this.channels.set(channel.id, channel);
        }
      });
    }

    if (config.templates) {
      config.templates.forEach((template: AlertTemplate) => {
        this.templates.set(template.id, template);
      });
    }
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    // Cancel all escalation timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();

    // Clear active alerts
    this.activeAlerts.clear();

    // Clear history
    this.history.length = 0;
  }
}