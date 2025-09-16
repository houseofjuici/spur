/**
 * Accessibility Test Configuration and Utilities
 * Provides shared utilities and configuration for accessibility testing
 */

import { test as base } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { AccessibilityTester } from '../../src/accessibility/tester';

export interface AccessibilityOptions {
  rules?: string[];
  runOnly?: {
    type: 'rules';
    values: string[];
  };
  disable?: string[];
  options?: any;
}

export interface AccessibilityFixture {
  runAxeTest: (selector?: string, options?: AccessibilityOptions) => Promise<any>;
  runComponentAudit: (componentName: string, selector: string) => Promise<any>;
  runFullAudit: () => Promise<any>;
  checkColorContrast: (element: string) => Promise<boolean>;
  checkKeyboardNavigation: () => Promise<boolean>;
  checkScreenReaderCompatibility: () => Promise<boolean>;
}

// Extend Playwright test with accessibility fixtures
export const test = base.extend<{
  accessibility: AccessibilityFixture;
}>({
  accessibility: async ({ page }, use) => {
    const accessibilityTester = new AccessibilityTester();

    const accessibilityFixture: AccessibilityFixture = {
      /**
       * Run axe-core accessibility test
       */
      async runAxeTest(selector?: string, options: AccessibilityOptions = {}) {
        let axeBuilder = new AxeBuilder({ page });

        if (selector) {
          axeBuilder = axeBuilder.include(selector);
        }

        if (options.rules) {
          axeBuilder = axeBuilder.withRules(options.rules);
        }

        if (options.runOnly) {
          axeBuilder = axeBuilder.withRules(options.runOnly.values);
        }

        if (options.disable) {
          axeBuilder = axeBuilder.disableRules(options.disable);
        }

        if (options.options) {
          axeBuilder = axeBuilder.withOptions(options.options);
        }

        const results = await axeBuilder.analyze();
        return results;
      },

      /**
       * Run component-specific accessibility audit
       */
      async runComponentAudit(componentName: string, selector: string) {
        return await accessibilityTester.auditComponent(componentName, selector, page);
      },

      /**
       * Run full accessibility audit
       */
      async runFullAudit() {
        return await accessibilityTester.runFullAudit(page.url());
      },

      /**
       * Check color contrast for specific element
       */
      async checkColorContrast(element: string) {
        const results = await new AxeBuilder({ page })
          .include(element)
          .withRules(['color-contrast'])
          .analyze();

        return results.violations.length === 0;
      },

      /**
       * Check keyboard navigation
       */
      async checkKeyboardNavigation() {
        // Get all focusable elements
        const focusableElements = await page.$$(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        // Test tab order
        let tabOrder = [];
        for (let i = 0; i < focusableElements.length; i++) {
          await focusableElements[i].focus();
          const focused = await page.evaluate(() => {
            const active = document.activeElement;
            return active ? active.tagName + (active.id ? `#${active.id}` : '') : '';
          });
          tabOrder.push(focused);
        }

        // Check that focus is visible
        await focusableElements[0]?.focus();
        const hasFocusStyle = await page.evaluate(() => {
          const active = document.activeElement;
          if (!active) return false;
          const style = window.getComputedStyle(active);
          return style.outline !== 'none' || style.boxShadow !== 'none';
        });

        return tabOrder.length > 0 && hasFocusStyle;
      },

      /**
       * Check screen reader compatibility
       */
      async checkScreenReaderCompatibility() {
        const issues = [];

        // Check for ARIA landmarks
        const landmarks = await page.$$('[role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]');
        if (landmarks.length === 0) {
          issues.push('No ARIA landmarks found');
        }

        // Check heading structure
        const headings = await page.$$('h1, h2, h3, h4, h5, h6');
        if (headings.length === 0) {
          issues.push('No headings found');
        }

        // Check for proper alt text
        const imagesWithoutAlt = await page.$$(`img:not([alt]), img[alt=""]`);
        if (imagesWithoutAlt.length > 0) {
          issues.push(`${imagesWithoutAlt.length} images missing alt text`);
        }

        // Check form labels
        const inputsWithoutLabels = await page.$$(
          'input:not([type="hidden"]):not([id]), input:not([type="hidden"]):not([aria-labelledby])'
        );
        if (inputsWithoutLabels.length > 0) {
          issues.push(`${inputsWithoutLabels.length} inputs without labels`);
        }

        return issues.length === 0;
      }
    };

    await use(accessibilityFixture);
  }
});

// Export commonly used accessibility test helpers
export const accessibilityHelpers = {
  /**
   * Test that an element has proper color contrast
   */
  async testColorContrast(page: any, selector: string) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const computedStyle = await element.evaluate(el => {
      return window.getComputedStyle(el);
    });

    // Extract RGB values
    const colorRgb = computedStyle.color.match(/\d+/g);
    const backgroundColorRgb = computedStyle.backgroundColor.match(/\d+/g);

    if (!colorRgb || !backgroundColorRgb) {
      return false;
    }

    // Convert to relative luminance
    const getLuminance = (r: number, g: number, b: number) => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(
      parseInt(colorRgb[0]),
      parseInt(colorRgb[1]),
      parseInt(colorRgb[2])
    );
    const l2 = getLuminance(
      parseInt(backgroundColorRgb[0]),
      parseInt(backgroundColorRgb[1]),
      parseInt(backgroundColorRgb[2])
    );

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    const contrastRatio = (lighter + 0.05) / (darker + 0.05);
    return contrastRatio >= 4.5;
  },

  /**
   * Test that an element is keyboard accessible
   */
  async testKeyboardAccessibility(page: any, selector: string) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    // Test if element can be focused
    await element.focus();
    const isFocused = await page.evaluate(() => {
      return document.activeElement === element;
    });

    if (!isFocused) {
      return false;
    }

    // Test if element can be activated with keyboard
    const tagName = await element.evaluate(el => el.tagName);
    if (['BUTTON', 'A'].includes(tagName)) {
      await page.keyboard.press('Enter');
      // Check if element was activated (this is a simplified test)
      return true;
    }

    return true;
  },

  /**
   * Test that an element has proper ARIA attributes
   */
  async testAriaAttributes(page: any, selector: string, requiredAttributes: string[]) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const missingAttributes = [];
    for (const attr of requiredAttributes) {
      const value = await element.getAttribute(attr);
      if (!value) {
        missingAttributes.push(attr);
      }
    }

    return missingAttributes.length === 0;
  },

  /**
   * Test that an element has visible focus indicator
   */
  async testFocusIndicator(page: any, selector: string) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    await element.focus();
    const computedStyle = await element.evaluate(el => {
      return window.getComputedStyle(el);
    });

    return (
      computedStyle.outline !== 'none' ||
      computedStyle.boxShadow !== 'none' ||
      computedStyle.border !== 'none'
    );
  },

  /**
   * Test touch target size (minimum 44x44 CSS pixels)
   */
  async testTouchTargetSize(page: any, selector: string) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const rect = await element.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height
      };
    });

    return rect.width >= 44 && rect.height >= 44;
  },

  /**
   * Test that content is accessible with reduced motion
   */
  async testReducedMotion(page: any, selector: string) {
    // Enable reduced motion
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {}
        })
      });
    });

    await page.reload();

    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const computedStyle = await element.evaluate(el => {
      return window.getComputedStyle(el);
    });

    // Check if animations are disabled or very fast
    const animationDuration = parseFloat(computedStyle.animationDuration);
    const transitionDuration = parseFloat(computedStyle.transitionDuration);

    return animationDuration === 0 || animationDuration <= 0.1 || 
           transitionDuration === 0 || transitionDuration <= 0.1;
  }
};

// Export commonly used test configurations
export const accessibilityConfig = {
  // WCAG 2.2 compliance rules
  wcag22Rules: [
    'wcag2a',
    'wcag2aa',
    'wcag21aa',
    'wcag22aa',
    'wcag2aaa'
  ],

  // Critical accessibility rules that must pass
  criticalRules: [
    'color-contrast',
    'keyboard-accessibility',
    'focus-visible',
    'aria-required-children',
    'aria-roles',
    'duplicate-id',
    'label',
    'link-name',
    'button-name',
    'image-alt',
    'form-field-label'
  ],

  // Common elements to exclude from scanning
  commonExcludes: [
    '.disabled',
    '[aria-hidden="true"]',
    '.sr-only',
    '[hidden]'
  ],

  // Custom axe-core configuration for different component types
  componentConfigs: {
    button: {
      include: 'button, [role="button"]',
      rules: ['button-name', 'focus-visible', 'color-contrast']
    },
    form: {
      include: 'form',
      rules: ['label', 'form-field-multiple-labels', 'color-contrast']
    },
    navigation: {
      include: 'nav, [role="navigation"]',
      rules: ['aria-allowed-attr', 'aria-required-attr']
    },
    modal: {
      include: '[role="dialog"]',
      rules: ['aria-required-children', 'focus-visible', 'keyboard-accessibility']
    },
    table: {
      include: 'table',
      rules: ['table-caption', 'th-has-data-cells', 'scope-attr-valid']
    }
  }
};

// Export custom matchers for accessibility testing
export const accessibilityMatchers = {
  toBeAccessible(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => 'Expected accessibility audit results',
        pass: false
      };
    }

    const violations = received.violations || [];
    const pass = violations.length === 0;

    return {
      message: () => 
        pass 
          ? 'Expected to have accessibility violations, but found none'
          : `Expected no accessibility violations, but found ${violations.length}:\n${violations.map((v: any) => `- ${v.id}: ${v.description}`).join('\n')}`,
      pass
    };
  },

  toHaveColorContrast(received: any, selector: string) {
    if (!received || typeof received.violations !== 'object') {
      return {
        message: () => 'Expected axe-core scan results',
        pass: false
      };
    }

    const contrastViolations = received.violations.filter(
      (v: any) => v.id === 'color-contrast' && 
      v.nodes.some((node: any) => 
        node.target.some((target: any) => 
          typeof target === 'string' && target.includes(selector)
        )
      )
    );

    const pass = contrastViolations.length === 0;

    return {
      message: () =>
        pass
          ? `Expected element "${selector}" to have poor contrast, but it has sufficient contrast`
          : `Expected element "${selector}" to have sufficient contrast, but it has poor contrast`,
      pass
    };
  },

  toBeKeyboardAccessible(received: any, selector: string) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => 'Expected accessibility audit results',
        pass: false
      };
    }

    const keyboardViolations = received.violations.filter(
      (v: any) => v.id === 'keyboard-accessibility' ||
      v.tags.includes('keyboard') ||
      v.nodes.some((node: any) =>
        node.target.some((target: any) =>
          typeof target === 'string' && target.includes(selector)
        )
      )
    );

    const pass = keyboardViolations.length === 0;

    return {
      message: () =>
        pass
          ? `Expected element "${selector}" to have keyboard accessibility issues, but it is accessible`
          : `Expected element "${selector}" to be keyboard accessible, but it has issues`,
      pass
    };
  }
};

// Add custom matchers to expect
if (typeof expect !== 'undefined') {
  expect.extend(accessibilityMatchers);
}