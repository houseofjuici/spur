/**
 * Accessibility Configuration for Spur Super App
 * WCAG 2.2 compliance settings and configuration
 */

export interface AccessibilityConfig {
  wcagVersion: '2.1' | '2.2';
  complianceLevel: 'A' | 'AA' | 'AAA';
  enabledRules: string[];
  disabledRules: string[];
  customChecks: AccessibilityCheck[];
  reporting: AccessibilityReporting;
}

export interface AccessibilityCheck {
  id: string;
  name: string;
  description: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  check: (element: Element) => boolean;
  metadata?: {
    tags: string[];
    help: string;
    helpUrl: string;
  };
}

export interface AccessibilityReporting {
  generateReports: boolean;
  exportFormats: ('json' | 'html' | 'xml')[];
  includeScreenshots: boolean;
  includeViolations: boolean;
  includePasses: boolean;
  threshold: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

/**
 * Spur Super App Accessibility Configuration
 * WCAG 2.2 AA compliance with enhanced requirements
 */
export const accessibilityConfig: AccessibilityConfig = {
  wcagVersion: '2.2',
  complianceLevel: 'AA',
  enabledRules: [
    // WCAG 2.2 Level A & AA Rules
    'wcag2a',
    'wcag2aa',
    'wcag21aa',
    'wcag22aa',
    
    // Enhanced best practices
    'best-practice'
  ],
  disabledRules: [
    // Rules that may not apply to all contexts
    'meta-viewport-large', // May conflict with responsive design requirements
    'landmark-complementary-is-top-level', // Some components may be nested
    'color-contrast-enhanced' // AAA level (4.5:1 is sufficient for AA)
  ],
  customChecks: [
    {
      id: 'spur-touch-target-size',
      name: 'Touch Target Size',
      description: 'Interactive elements must have minimum touch target size of 44x44 CSS pixels',
      impact: 'serious',
      check: (element: Element) => {
        if (element.matches('button, [href], input[type="checkbox"], input[type="radio"], [role="button"]')) {
          const rect = element.getBoundingClientRect();
          return rect.width >= 44 && rect.height >= 44;
        }
        return true;
      },
      metadata: {
        tags: ['wcag22aa', 'mobile', 'touch'],
        help: 'Ensure touch targets are at least 44x44 CSS pixels',
        helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html'
      }
    },
    {
      id: 'spur-assistant-focus-trap',
      name: 'Assistant Focus Trap',
      description: 'Assistant modal must trap focus when open',
      impact: 'critical',
      check: (element: Element) => {
        if (element.matches('[role="dialog"]')) {
          // Check if element has focus trap implementation
          return element.hasAttribute('data-focus-trap') || 
                 element.querySelector('[data-focus-trap]') !== null;
        }
        return true;
      },
      metadata: {
        tags: ['wcag2aa', 'keyboard', 'focus'],
        help: 'Modal dialogs must trap focus',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html'
      }
    },
    {
      id: 'spur-live-region-announcements',
      name: 'Live Region Announcements',
      description: 'Dynamic content changes must be announced to screen readers',
      impact: 'serious',
      check: (element: Element) => {
        if (element.matches('[data-updates="true"]')) {
          return element.hasAttribute('aria-live') || 
                 element.closest('[aria-live]') !== null;
        }
        return true;
      },
      metadata: {
        tags: ['wcag2aa', 'screen-reader', 'dynamic'],
        help: 'Dynamic content changes should use live regions',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html'
      }
    },
    {
      id: 'spur-memory-visualization-contrast',
      name: 'Memory Visualization Contrast',
      description: 'Memory graph visualizations must maintain sufficient contrast',
      impact: 'serious',
      check: (element: Element) => {
        if (element.matches('[data-memory-viz]')) {
          // Check if visualization has proper contrast settings
          return element.hasAttribute('data-high-contrast') ||
                 element.classList.contains('high-contrast');
        }
        return true;
      },
      metadata: {
        tags: ['wcag2aa', 'color-contrast', 'visualization'],
        help: 'Data visualizations must maintain sufficient contrast',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html'
      }
    },
    {
      id: 'spur-keyboard-shortcuts-announced',
      name: 'Keyboard Shortcuts Announced',
      description: 'Keyboard shortcuts must be visible and announced',
      impact: 'moderate',
      check: (element: Element) => {
        if (element.matches('[data-keyboard-shortcut]')) {
          return element.hasAttribute('aria-label') ||
                 element.hasAttribute('title') ||
                 element.querySelector('.sr-only') !== null;
        }
        return true;
      },
      metadata: {
        tags: ['wcag2aa', 'keyboard', 'screen-reader'],
        help: 'Keyboard shortcuts must be discoverable',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts.html'
      }
    },
    {
      id: 'spur-loading-indicator-accessible',
      name: 'Loading Indicator Accessible',
      description: 'Loading states must be accessible to screen readers',
      impact: 'moderate',
      check: (element: Element) => {
        if (element.matches('[data-loading="true"]')) {
          return element.hasAttribute('aria-busy') ||
                 element.getAttribute('role') === 'status' ||
                 element.getAttribute('aria-live') === 'polite';
        }
        return true;
      },
      metadata: {
        tags: ['wcag2aa', 'screen-reader', 'loading'],
        help: 'Loading states must be announced to screen readers',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html'
      }
    }
  ],
  reporting: {
    generateReports: true,
    exportFormats: ['json', 'html'],
    includeScreenshots: true,
    includeViolations: true,
    includePasses: true,
    threshold: {
      critical: 0,      // Zero critical violations allowed
      serious: 2,      // Maximum 2 serious violations
      moderate: 5,     // Maximum 5 moderate violations
      minor: 10        // Maximum 10 minor violations
    }
  }
};

/**
 * Component-specific accessibility configurations
 */
export const componentAccessibilityConfigs: Record<string, Partial<AccessibilityConfig>> = {
  assistant: {
    enabledRules: [
      'wcag2aa',
      'wcag22aa'
    ],
    customChecks: [
      'spur-assistant-focus-trap',
      'spur-live-region-announcements',
      'spur-keyboard-shortcuts-announced',
      'spur-loading-indicator-accessible'
    ],
    reporting: {
      ...accessibilityConfig.reporting,
      threshold: {
        critical: 0,
        serious: 1,
        moderate: 3,
        minor: 5
      }
    }
  },
  
  memoryExplorer: {
    enabledRules: [
      'wcag2aa',
      'wcag22aa'
    ],
    customChecks: [
      'spur-memory-visualization-contrast',
      'spur-touch-target-size'
    ],
    reporting: {
      ...accessibilityConfig.reporting,
      threshold: {
        critical: 0,
        serious: 0,
        moderate: 2,
        minor: 5
      }
    }
  },
  
  timeline: {
    enabledRules: [
      'wcag2aa',
      'wcag22aa'
    ],
    customChecks: [
      'spur-touch-target-size',
      'spur-live-region-announcements'
    ],
    reporting: {
      ...accessibilityConfig.reporting,
      threshold: {
        critical: 0,
        serious: 1,
        moderate: 3,
        minor: 5
      }
    }
  },
  
  navigation: {
    enabledRules: [
      'wcag2aa'
    ],
    disabledRules: [
      'color-contrast-enhanced'
    ],
    reporting: {
      ...accessibilityConfig.reporting,
      threshold: {
        critical: 0,
        serious: 0,
        moderate: 1,
        minor: 3
      }
    }
  },
  
  forms: {
    enabledRules: [
      'wcag2aa',
      'wcag22aa'
    ],
    customChecks: [
      'spur-loading-indicator-accessible'
    ],
    reporting: {
      ...accessibilityConfig.reporting,
      threshold: {
        critical: 0,
        serious: 0,
        moderate: 1,
        minor: 3
      }
    }
  }
};

/**
 * Axe-core configuration for different testing scenarios
 */
export const axeCoreConfigs = {
  // Default configuration for full accessibility audit
  default: {
    rules: {
      // Enable WCAG 2.2 rules
      'wcag22aa': { enabled: true },
      
      // Enhanced contrast requirements
      'color-contrast': { enabled: true },
      
      // Focus management
      'focus-visible': { enabled: true },
      'focus-order-semantics': { enabled: true },
      
      // ARIA requirements
      'aria-roles': { enabled: true },
      'aria-allowed-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-required-children': { enabled: true },
      
      // Form accessibility
      'label': { enabled: true },
      'form-field-multiple-labels': { enabled: true },
      
      // Image accessibility
      'image-alt': { enabled: true },
      'alt-text': { enabled: true },
      
      // Link accessibility
      'link-name': { enabled: true },
      'link-in-text-block': { enabled: true },
      
      // Button accessibility
      'button-name': { enabled: true },
      
      // Table accessibility
      'table-caption': { enabled: true },
      'th-has-data-cells': { enabled: true },
      'scope-attr-valid': { enabled: true },
      
      // List accessibility
      'list': { enabled: true },
      'listitem': { enabled: true },
      
      // Heading structure
      'heading-order': { enabled: true },
      
      // Language identification
      'html-has-lang': { enabled: true },
      'valid-lang': { enabled: true },
      
      // Page title
      'page-title': { enabled: true },
      
      // Frame titles
      'frame-title': { enabled: true },
      
      // Duplicate IDs
      'duplicate-id': { enabled: true },
      
      // HTML5 validation
      'html-lang-valid': { enabled: true },
      'doctype-html5': { enabled: true }
    }
  },
  
  // Fast CI/CD configuration (critical rules only)
  critical: {
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-accessibility': { enabled: true },
      'focus-visible': { enabled: true },
      'label': { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true },
      'image-alt': { enabled: true },
      'duplicate-id': { enabled: true },
      'aria-roles': { enabled: true }
    },
    resultTypes: ['violations']
  },
  
  // Mobile-focused configuration
  mobile: {
    rules: {
      'color-contrast': { enabled: true },
      'focus-visible': { enabled: true },
      'touch-target-size': { enabled: true },
      'target-size': { enabled: true },
      'label': { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true },
      'image-alt': { enabled: true }
    }
  },
  
  // Screen reader focused configuration
  screenReader: {
    rules: {
      'aria-roles': { enabled: true },
      'aria-allowed-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-required-children': { enabled: true },
      'label': { enabled: true },
      'image-alt': { enabled: true },
      'duplicate-id': { enabled: true },
      'html-has-lang': { enabled: true },
      'page-title': { enabled: true },
      'heading-order': { enabled: true },
      'list': { enabled: true },
      'listitem': { enabled: true }
    }
  }
};

/**
 * Accessibility testing thresholds and expectations
 */
export const accessibilityThresholds = {
  // Overall compliance scores
  minimumComplianceScore: 85, // AA compliance minimum
  excellentComplianceScore: 95, // AAA compliance
  
  // Component-specific minimum scores
  componentScores: {
    assistant: 90,
    memoryExplorer: 85,
    timeline: 85,
    navigation: 95,
    forms: 90,
    modals: 90,
    dataTable: 85
  },
  
  // Performance thresholds
  maxTestDuration: 30000, // 30 seconds max for accessibility tests
  maxReportGenerationTime: 5000, // 5 seconds max for report generation
  
  // CI/CD thresholds
  criticalViolationLimit: 0,
  seriousViolationLimit: 2,
  moderateViolationLimit: 5,
  minorViolationLimit: 10,
  
  // Regression testing
  maxScoreRegression: 10, // Maximum 10% score drop allowed
  violationIncreaseLimit: 3 // Maximum 3 new violations allowed
};

/**
 * WCAG 2.2 Success Criteria mapping
 */
export const wcag22SuccessCriteria = {
  Perceivable: [
    '1.1.1 Non-text Content',
    '1.2.1 Audio-only and Video-only',
    '1.2.2 Captions (Prerecorded)',
    '1.2.3 Audio Description or Media Alternative',
    '1.2.4 Captions (Live)',
    '1.2.5 Audio Description',
    '1.3.1 Info and Relationships',
    '1.3.2 Meaningful Sequence',
    '1.3.3 Sensory Characteristics',
    '1.3.4 Orientation',
    '1.3.5 Identify Input Purpose',
    '1.3.6 Identify Purpose',
    '1.4.1 Use of Color',
    '1.4.2 Audio Control',
    '1.4.3 Contrast (Minimum)',
    '1.4.4 Resize text',
    '1.4.5 Images of Text',
    '1.4.10 Reflow',
    '1.4.11 Contrast (Enhanced)',
    '1.4.12 Text Spacing',
    '1.4.13 Content on Hover or Focus'
  ],
  Operable: [
    '2.1.1 Keyboard',
    '2.1.2 No Keyboard Trap',
    '2.1.3 Keyboard (No Exception)',
    '2.1.4 Character Key Shortcuts',
    '2.2.1 Timing Adjustable',
    '2.2.2 Pause, Stop, Hide',
    '2.3.1 Three Flashes or Below Threshold',
    '2.4.1 Bypass Blocks',
    '2.4.2 Page Titled',
    '2.4.3 Focus Order',
    '2.4.4 Link Purpose (In Context)',
    '2.4.5 Multiple Ways',
    '2.4.6 Headings and Labels',
    '2.4.7 Focus Visible',
    '2.5.1 Pointer Gestures',
    '2.5.2 Pointer Cancellation',
    '2.5.3 Label in Name',
    '2.5.4 Motion Actuation',
    '2.5.5 Target Size',
    '2.5.6 Concurrent Input Mechanisms',
    '2.5.7 Dragging Movements',
    '2.5.8 Target Size (Enhanced)'
  ],
  Understandable: [
    '3.1.1 Language of Page',
    '3.1.2 Language of Parts',
    '3.2.1 On Focus',
    '3.2.2 On Input',
    '3.2.3 Consistent Navigation',
    '3.2.4 Consistent Identification',
    '3.2.5 Change on Request',
    '3.2.6 Consistent Help',
    '3.3.1 Error Identification',
    '3.3.2 Labels or Instructions',
    '3.3.3 Error Suggestion',
    '3.3.4 Error Prevention (Legal, Financial, Data)',
    '3.3.5 Help',
    '3.3.6 Error Prevention (All)',
    '3.3.7 Redundant Entry',
    '3.3.8 Accessible Authentication',
    '3.3.9 Accessible Name'
  ],
  Robust: [
    '4.1.1 Parsing',
    '4.1.2 Name, Role, Value',
    '4.1.3 Status Messages',
    '4.1.4 Values'
  ]
};

/**
 * Export configuration for external tools
 */
export const exportAccessibilityConfig = {
  // Storybook accessibility configuration
  storybook: {
    a11y: {
      config: {
        rules: axeCoreConfigs.default.rules,
        disableOtherRules: true
      }
    }
  },
  
  // ESLint accessibility rules
  eslint: {
    plugins: ['jsx-a11y'],
    extends: ['plugin:jsx-a11y/recommended'],
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/interactive-supports-focus': 'error'
    }
  },
  
  // VS Code accessibility extensions
  vscode: {
    recommendedExtensions: [
      'deque.vscode-axe-core',
      'ms-vscode.vscode-accessibility-insights',
      'formulahendry.auto-rename-tag'
    ]
  }
};