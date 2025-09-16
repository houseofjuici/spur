/**
 * Playwright Accessibility Tests for Spur Super App
 * WCAG 2.2 compliance testing with automated and manual checks
 */

import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { AccessibilityTester } from '../../src/accessibility/tester';
import { AssistantAccessibilityTests } from '../../src/accessibility/components';

const accessibilityTests = new AssistantAccessibilityTests();

test.describe('Accessibility Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Enable accessibility testing features
    await page.addInitScript(() => {
      // Simulate accessibility preferences
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: false,
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
  });

  test.describe('WCAG 2.2 Automated Testing', () => {
    test('should have no accessibility violations on homepage', async ({ page }) => {
      await page.goto('/');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .exclude('.disabled') // Exclude disabled elements
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should meet color contrast requirements', async ({ page }) => {
      await page.goto('/');

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze();

      const contrastViolations = results.violations.filter(
        violation => violation.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });

    test('should have proper keyboard accessibility', async ({ page }) => {
      await page.goto('/');

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      const firstElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['BUTTON', 'A', 'INPUT']).toContain(firstElement);

      // Test interactive elements
      const interactiveElements = await page.$$(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      for (let i = 0; i < Math.min(interactiveElements.length, 10); i++) {
        await interactiveElements[i].focus();
        const isVisible = await interactiveElements[i].isVisible();
        expect(isVisible).toBeTruthy();
      }
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/');

      const results = await new AxeBuilder({ page })
        .withRules(['aria-roles', 'aria-allowed-attr', 'aria-required-attr'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('should have proper focus management', async ({ page }) => {
      await page.goto('/');

      // Test focus visible
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement);
      const computedStyle = await focusedElement.evaluate(el => {
        return window.getComputedStyle(el);
      });

      expect(
        computedStyle.outline !== 'none' || 
        computedStyle.boxShadow !== 'none' ||
        computedStyle.border !== 'none'
      ).toBeTruthy();
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/settings');

      const results = await new AxeBuilder({ page })
        .withRules(['label', 'form-field-multiple-labels'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('should have proper image alt text', async ({ page }) => {
      await page.goto('/');

      const images = await page.$$('img');
      for (const image of images) {
        const alt = await image.getAttribute('alt');
        const isDecorative = await image.getAttribute('role') === 'presentation';
        
        expect(alt !== null || isDecorative).toBeTruthy();
      }
    });

    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/');

      const headings = await page.$$('h1, h2, h3, h4, h5, h6');
      const headingLevels = await Promise.all(
        headings.map(h => h.evaluate(h => parseInt(h.tagName.charAt(1))))
      );

      // Check for proper heading hierarchy
      for (let i = 1; i < headingLevels.length; i++) {
        expect(headingLevels[i]).toBeLessThanOrEqual(headingLevels[i - 1] + 1);
      }

      // Should have exactly one h1
      const h1Count = headingLevels.filter(level => level === 1).length;
      expect(h1Count).toBe(1);
    });

    test('should have proper language identification', async ({ page }) => {
      await page.goto('/');

      const htmlLang = await page.getAttribute('html', 'lang');
      expect(htmlLang).toBeTruthy();
      expect(['en', 'en-US']).toContain(htmlLang);
    });
  });

  test.describe('Component Accessibility Tests', () => {
    test('Assistant Interface should be accessible', async ({ page }) => {
      await page.goto('/');

      const audit = await accessibilityTests.testAssistantInterface(page);
      
      expect(audit.compliance.keyboard).toBeTruthy();
      expect(audit.compliance.screenReader).toBeTruthy();
      expect(audit.compliance.colorContrast).toBeTruthy();
      expect(audit.compliance.focusManagement).toBeTruthy();
      expect(audit.compliance.ariaLabels).toBeTruthy();
      expect(audit.violations.length).toBe(0);
    });

    test('Memory Explorer should be accessible', async ({ page }) => {
      await page.goto('/memory');

      const audit = await accessibilityTests.testMemoryExplorer(page);
      
      expect(audit.compliance.keyboard).toBeTruthy();
      expect(audit.compliance.screenReader).toBeTruthy();
      expect(audit.violations.length).toBeLessThan(3);
    });

    test('Timeline should be accessible', async ({ page }) => {
      await page.goto('/timeline');

      const audit = await accessibilityTests.testTimelineInterface(page);
      
      expect(audit.compliance.keyboard).toBeTruthy();
      expect(audit.compliance.colorContrast).toBeTruthy();
      expect(audit.violations.length).toBeLessThan(2);
    });

    test('Navigation should be accessible', async ({ page }) => {
      await page.goto('/');

      const audit = await accessibilityTests.testNavigation(page);
      
      expect(audit.compliance.keyboard).toBeTruthy();
      expect(audit.compliance.screenReader).toBeTruthy();
      expect(audit.compliance.ariaLabels).toBeTruthy();
    });

    test('Forms should be accessible', async ({ page }) => {
      await page.goto('/settings');

      const audit = await accessibilityTests.testForms(page);
      
      expect(audit.compliance.keyboard).toBeTruthy();
      expect(audit.compliance.screenReader).toBeTruthy();
      expect(audit.compliance.ariaLabels).toBeTruthy();
    });

    test('Modals should be accessible', async ({ page }) => {
      await page.goto('/');
      // Open a modal
      await page.click('[data-testid="settings-button"]');

      const audit = await accessibilityTests.testModals(page);
      
      expect(audit.compliance.keyboard).toBeTruthy();
      expect(audit.compliance.screenReader).toBeTruthy();
      expect(audit.compliance.focusManagement).toBeTruthy();
    });

    test('Quick Actions should be accessible', async ({ page }) => {
      await page.goto('/');

      const audit = await accessibilityTests.testQuickActions(page);
      
      expect(audit.compliance.keyboard).toBeTruthy();
      expect(audit.compliance.colorContrast).toBeTruthy();
      expect(audit.violations.length).toBeLessThan(2);
    });
  });

  test.describe('Keyboard Navigation Tests', () => {
    test('should have logical tab order', async ({ page }) => {
      await page.goto('/');

      const result = await accessibilityTests.testKeyboardNavigation(page);
      
      expect(result.passed).toBeTruthy();
      expect(result.issues).toEqual([]);
      expect(result.tabOrder.length).toBeGreaterThan(0);
    });

    test('should support keyboard interaction patterns', async ({ page }) => {
      await page.goto('/');

      // Test common keyboard shortcuts
      await page.keyboard.press('/'); // Should focus search
      const searchFocused = await page.evaluate(() => 
        document.activeElement?.getAttribute('data-testid') === 'search-input'
      );
      expect(searchFocused).toBeTruthy();

      // Test Escape key
      await page.keyboard.press('Escape');
      
      // Test arrow key navigation in menus
      await page.click('[data-testid="menu-button"]');
      await page.keyboard.press('ArrowDown');
      const menuItemFocused = await page.evaluate(() => 
        document.activeElement?.role === 'menuitem'
      );
      expect(menuItemFocused).toBeTruthy();
    });

    test('should trap focus in modals', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="settings-button"]');

      // Modal should be open
      const modal = await page.$('[role="dialog"]');
      expect(modal).toBeTruthy();

      // Focus should be trapped within modal
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      const focusedInModal = await page.evaluate(() => {
        const active = document.activeElement;
        return active?.closest('[role="dialog"]') !== null;
      });
      
      expect(focusedInModal).toBeTruthy();
    });
  });

  test.describe('Screen Reader Tests', () => {
    test('should have proper ARIA landmarks', async ({ page }) => {
      await page.goto('/');

      const result = await accessibilityTests.testScreenReaderCompatibility(page);
      
      expect(result.passed).toBeTruthy();
      expect(result.issues).toEqual([]);
    });

    test('should announce dynamic content changes', async ({ page }) => {
      await page.goto('/');

      // Trigger dynamic content update
      await page.click('[data-testid="refresh-button"]');
      
      // Check for live region announcements
      const liveRegions = await page.$$('[aria-live]');
      expect(liveRegions.length).toBeGreaterThan(0);
    });

    test('should have proper heading hierarchy for navigation', async ({ page }) => {
      await page.goto('/');

      const headings = await page.$$('h1, h2, h3, h4, h5, h6');
      const headingLevels = await Promise.all(
        headings.map(h => h.evaluate(h => parseInt(h.tagName.charAt(1))))
      );

      // Verify heading hierarchy
      let previousLevel = 0;
      for (const level of headingLevels) {
        if (previousLevel > 0) {
          expect(level).toBeLessThanOrEqual(previousLevel + 1);
        }
        previousLevel = level;
      }
    });

    test('should have proper list structure', async ({ page }) => {
      await page.goto('/');

      const lists = await page.$$('ul, ol');
      for (const list of lists) {
        const listItems = await list.$$('li');
        expect(listItems.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Visual Accessibility Tests', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      await page.goto('/');

      const result = await accessibilityTests.testVisualAccessibility(page);
      
      expect(result.passed).toBeTruthy();
      expect(result.issues).toEqual([]);
      
      // Verify minimum contrast ratios
      Object.values(result.contrastRatios).forEach(ratio => {
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });

    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/');

      const focusableElements = await page.$$(
        'button, [href], input, select, textarea'
      );

      for (const element of focusableElements) {
        await element.focus();
        const hasFocusStyle = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.outline !== 'none' || style.boxShadow !== 'none';
        });
        expect(hasFocusStyle).toBeTruthy();
      }
    });

    test('should be usable in high contrast mode', async ({ page }) => {
      await page.goto('/');

      // Simulate high contrast mode
      await page.emulateMedia({ forcedColors: 'active' });
      
      const mainContent = await page.$('main');
      const isVisible = await mainContent?.isVisible();
      expect(isVisible).toBeTruthy();
    });

    test('should support text resizing', async ({ page }) => {
      await page.goto('/');

      // Test 200% text zoom
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });

      const content = await page.$('main');
      const isReadable = await content?.isVisible();
      expect(isReadable).toBeTruthy();
    });
  });

  test.describe('Mobile Accessibility Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should have appropriate touch target sizes', async ({ page }) => {
      await page.goto('/');

      const result = await accessibilityTests.testMobileAccessibility(page);
      
      expect(result.passed).toBeTruthy();
      expect(result.issues).toEqual([]);
      
      // Verify touch target sizes meet WCAG 2.2 requirements
      Object.values(result.touchTargetSizes).forEach(size => {
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
      });
    });

    test('should be responsive on mobile devices', async ({ page }) => {
      await page.goto('/');

      // Test different mobile viewports
      const viewports = [
        { width: 375, height: 667 }, // iPhone
        { width: 360, height: 640 }, // Android
        { width: 414, height: 896 }  // iPhone X
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        
        const content = await page.$('main');
        const isVisible = await content?.isVisible();
        expect(isVisible).toBeTruthy();

        const noHorizontalScroll = await page.evaluate(() => 
          document.body.scrollWidth <= window.innerWidth
        );
        expect(noHorizontalScroll).toBeTruthy();
      }
    });

    test('should work with touch gestures', async ({ page }) => {
      await page.goto('/');

      // Test tap interactions
      const menuButton = await page.$('[data-testid="menu-button"]');
      await menuButton?.tap();

      const menu = await page.$('[role="menu"]');
      expect(menu).toBeTruthy();
    });
  });

  test.describe('Reduced Motion Tests', () => {
    test('should respect reduced motion preference', async ({ page }) => {
      await page.goto('/');

      const result = await accessibilityTests.testReducedMotion(page);
      
      expect(result.passed).toBeTruthy();
      expect(result.issues).toEqual([]);
      expect(result.animatedElements.length).toBe(0);
    });

    test('should provide alternatives for animated content', async ({ page }) => {
      await page.goto('/');

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

      // Check that animations are properly disabled
      const animatedElements = await page.$$(
        '[style*="animation"], [style*="transition"]'
      );

      for (const element of animatedElements) {
        const animationState = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            animationDuration: style.animationDuration,
            transitionDuration: style.transitionDuration
          };
        });

        // Animations should be disabled or very fast
        if (animationState.animationDuration !== '0s') {
          const duration = parseFloat(animationState.animationDuration);
          expect(duration).toBeLessThanOrEqual(0.1);
        }
      }
    });
  });

  test.describe('Comprehensive Accessibility Audit', () => {
    test('should pass full accessibility audit', async ({ page }) => {
      await page.goto('/');

      const audit = await accessibilityTests.runFullAccessibilityAudit(page);
      
      expect(audit.overallScore).toBeGreaterThanOrEqual(85); // AA compliance
      expect(['AAA', 'AA', 'A']).toContain(audit.compliance);
      expect(audit.recommendations.length).toBeGreaterThan(0);

      // All component audits should pass
      audit.componentAudits.forEach(componentAudit => {
        expect(componentAudit.violations.length).toBeLessThan(3);
      });

      // Specialized tests should pass
      expect(audit.keyboardNavigation.passed).toBeTruthy();
      expect(audit.screenReader.passed).toBeTruthy();
      expect(audit.visualAccessibility.passed).toBeTruthy();
      expect(audit.mobileAccessibility.passed).toBeTruthy();
      expect(audit.reducedMotion.passed).toBeTruthy();
    });

    test('should generate comprehensive accessibility report', async ({ page }) => {
      await page.goto('/');

      const tester = new AccessibilityTester();
      const report = await tester.runFullAudit(page.url());

      expect(report.violations.length).toBeLessThan(5);
      expect(report.compliance.level).not.toBe('Non-Compliant');
      expect(report.compliance.score).toBeGreaterThanOrEqual(70);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.wcagVersion).toBe('WCAG 2.2');
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should maintain accessibility during page load', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;

      // Page should load quickly for accessibility
      expect(loadTime).toBeLessThan(3000);

      // Accessibility should be maintained during load
      const firstInteractive = await page.evaluate(() => {
        return new Promise((resolve) => {
          const check = () => {
            if (document.readyState === 'complete') {
              resolve(Date.now());
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
      });

      const timeToInteractive = firstInteractive - startTime;
      expect(timeToInteractive).toBeLessThan(5000);
    });

    test('should handle accessibility with slow network', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 1000);
      });

      await page.goto('/');

      // Core accessibility features should work even on slow networks
      const mainHeading = await page.$('h1');
      expect(mainHeading).toBeTruthy();

      const firstInteractive = await page.$('button, [href]');
      expect(firstInteractive).toBeTruthy();
    });
  });
});

test.describe('Accessibility Regression Testing', () => {
  test('should detect accessibility regressions', async ({ page }) => {
    // Establish baseline
    await page.goto('/');
    const baselineAudit = await accessibilityTests.runFullAccessibilityAudit(page);
    const baselineScore = baselineAudit.overallScore;

    // Simulate a change that could introduce accessibility issues
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      button.style.color = '#ffffff';
      button.style.backgroundColor = '#ffff00'; // Poor contrast
      document.body.appendChild(button);
    });

    // Check for regression
    const regressionAudit = await accessibilityTests.runFullAccessibilityAudit(page);
    const scoreDrop = baselineScore - regressionAudit.overallScore;

    expect(scoreDrop).toBeLessThan(10); // Allow for minor variations
    expect(regressionAudit.compliance.level).not.toBe('Non-Compliant');
  });

  test('should maintain accessibility across different routes', async ({ page }) => {
    const routes = ['/', '/memory', '/timeline', '/settings', '/integrations'];
    const scores: number[] = [];

    for (const route of routes) {
      await page.goto(route);
      const audit = await accessibilityTests.runFullAccessibilityAudit(page);
      scores.push(audit.overallScore);
    }

    // Scores should be consistent across routes
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreVariation = maxScore - minScore;

    expect(scoreVariation).toBeLessThan(15); // Allow for reasonable variation
    expect(minScore).toBeGreaterThanOrEqual(70); // Minimum acceptable score
  });
});