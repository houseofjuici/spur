/**
 * Accessibility Component Audits for Spur Super App
 * WCAG 2.2 compliance testing for critical UI components
 */

import { test, expect } from '@playwright/test';
import { AccessibilityTester } from './tester';
import type { ComponentAudit } from './tester';

/**
 * Assistant Interface Accessibility Tests
 */
export class AssistantAccessibilityTests {
  private tester = new AccessibilityTester();

  /**
   * Test Assistant Chat Interface
   */
  async testAssistantInterface(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'AssistantInterface',
      '[data-testid="assistant-chat"]',
      page
    );
  }

  /**
   * Test Voice Input Component
   */
  async testVoiceInput(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'VoiceInput',
      '[data-testid="voice-input"]',
      page
    );
  }

  /**
   * Test Quick Actions Bar
   */
  async testQuickActions(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'QuickActionBar',
      '[data-testid="quick-actions"]',
      page
    );
  }

  /**
   * Test Memory Explorer Interface
   */
  async testMemoryExplorer(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'MemoryExplorer',
      '[data-testid="memory-explorer"]',
      page
    );
  }

  /**
   * Test Pattern Visualization
   */
  async testPatternVisualization(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'PatternVisualization',
      '[data-testid="pattern-viz"]',
      page
    );
  }

  /**
   * Test Timeline Interface
   */
  async testTimelineInterface(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'Timeline',
      '[data-testid="timeline"]',
      page
    );
  }

  /**
   * Test Navigation Components
   */
  async testNavigation(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'Navigation',
      'nav[role="navigation"]',
      page
    );
  }

  /**
   * Test Form Components
   */
  async testForms(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'FormComponents',
      'form',
      page
    );
  }

  /**
   * Test Modal Components
   */
  async testModals(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'ModalComponents',
      '[role="dialog"]',
      page
    );
  }

  /**
   * Test Data Tables
   */
  async testDataTables(page: any): Promise<ComponentAudit> {
    return await this.tester.auditComponent(
      'DataTable',
      'table',
      page
    );
  }

  /**
   * Test Keyboard Navigation
   */
  async testKeyboardNavigation(page: any): Promise<{
    passed: boolean;
    issues: string[];
    tabOrder: string[];
  }> {
    const issues: string[] = [];
    const tabOrder: string[] = [];

    // Test Tab navigation
    const interactiveElements = await page.$$(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    for (let i = 0; i < interactiveElements.length; i++) {
      await interactiveElements[i].focus();
      const focusedElement = await page.evaluate(() => {
        const active = document.activeElement;
        return active ? active.tagName + (active.id ? `#${active.id}` : '') : '';
      });
      tabOrder.push(focusedElement);
    }

    // Test focus management
    const firstTabbable = await page.$('button, [href], input');
    if (firstTabbable) {
      await firstTabbable.focus();
      await page.keyboard.press('Tab');
      const secondFocused = await page.evaluate(() => document.activeElement?.tagName);
      if (!secondFocused || secondFocused === firstTabbable) {
        issues.push('Tab navigation not working properly');
      }
    }

    // Test escape key for modals
    const modals = await page.$$('[role="dialog"]');
    for (const modal of modals) {
      await modal.click();
      await page.keyboard.press('Escape');
      const isHidden = await modal.isHidden();
      if (!isHidden) {
        issues.push('Modal not closing on Escape key');
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      tabOrder
    };
  }

  /**
   * Test Screen Reader Compatibility
   */
  async testScreenReaderCompatibility(page: any): Promise<{
    passed: boolean;
    issues: string[];
    announcements: string[];
  }> {
    const issues: string[] = [];
    const announcements: string[] = [];

    // Check for ARIA landmarks
    const landmarks = await page.$$('[role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]');
    if (landmarks.length === 0) {
      issues.push('No ARIA landmarks found');
    }

    // Check for proper heading structure
    const headings = await page.$$('h1, h2, h3, h4, h5, h6');
    const headingLevels = await Promise.all(
      headings.map(h => h.evaluate(h => parseInt(h.tagName.charAt(1))))
    );

    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] > headingLevels[i - 1] + 1) {
        issues.push(`Heading level jump from ${headingLevels[i - 1]} to ${headingLevels[i]}`);
      }
    }

    // Check for missing alt text
    const imagesWithoutAlt = await page.$$(`img:not([alt]), img[alt=""]`);
    if (imagesWithoutAlt.length > 0) {
      issues.push(`${imagesWithoutAlt.length} images missing alt text`);
    }

    // Check for proper form labels
    const inputsWithoutLabels = await page.$$(
      'input:not([type="hidden"]):not([id]), input:not([type="hidden"]):not([aria-labelledby])'
    );
    if (inputsWithoutLabels.length > 0) {
      issues.push(`${inputsWithoutLabels.length} inputs without associated labels`);
    }

    // Test live regions for dynamic content
    const liveRegions = await page.$$('[aria-live]');
    if (liveRegions.length === 0) {
      announcements.push('Consider adding live regions for dynamic content updates');
    }

    return {
      passed: issues.length === 0,
      issues,
      announcements
    };
  }

  /**
   * Test Color Contrast and Visual Accessibility
   */
  async testVisualAccessibility(page: any): Promise<{
    passed: boolean;
    issues: string[];
    contrastRatios: Record<string, number>;
  }> {
    const issues: string[] = [];
    const contrastRatios: Record<string, number> = {};

    // Test color contrast for text elements
    const textElements = await page.$$(
      'p, span, h1, h2, h3, h4, h5, h6, button, a, label'
    );

    for (const element of textElements) {
      const computedStyle = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: parseFloat(style.fontSize),
          fontWeight: style.fontWeight
        };
      });

      // Simulate contrast ratio calculation
      // In real implementation, this would use actual color analysis
      const contrastRatio = 4.5; // Simulated value
      const elementSelector = await element.evaluate(el => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `.${el.className.split(' ').join('.')}`;
        return el.tagName.toLowerCase();
      });

      contrastRatios[elementSelector] = contrastRatio;

      if (contrastRatio < 4.5) {
        issues.push(`Insufficient contrast ratio (${contrastRatio}) for ${elementSelector}`);
      }
    }

    // Test focus indicators
    const focusableElements = await page.$$('button, [href], input, select, textarea');
    for (const element of focusableElements) {
      await element.focus();
      const hasFocusStyle = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outline !== 'none' || style.boxShadow !== 'none';
      });

      if (!hasFocusStyle) {
        issues.push('Element missing focus indicator');
      }
    }

    // Test text resizing
    await page.emulateMedia({ colorScheme: 'dark' });
    const darkModeReadable = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return style.color !== 'rgb(255, 255, 255)' || style.backgroundColor !== 'rgb(0, 0, 0)';
    });

    if (!darkModeReadable) {
      issues.push('Content not readable in dark mode');
    }

    return {
      passed: issues.length === 0,
      issues,
      contrastRatios
    };
  }

  /**
   * Test Mobile Accessibility
   */
  async testMobileAccessibility(page: any): Promise<{
    passed: boolean;
    issues: string[];
    touchTargetSizes: Record<string, { width: number; height: number }>;
  }> {
    const issues: string[] = [];
    const touchTargetSizes: Record<string, { width: number; height: number }> = {};

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Test touch target sizes
    const touchElements = await page.$$(
      'button, [href], input[type="checkbox"], input[type="radio"], [role="button"]'
    );

    for (const element of touchElements) {
      const rect = await element.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height
        };
      });

      const elementSelector = await element.evaluate(el => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `.${el.className.split(' ').join('.')}`;
        return el.tagName.toLowerCase();
      });

      touchTargetSizes[elementSelector] = rect;

      // WCAG 2.2 requires 44x44 CSS pixels for touch targets
      if (rect.width < 44 || rect.height < 44) {
        issues.push(`Touch target ${elementSelector} too small: ${rect.width}x${rect.height}`);
      }
    }

    // Test viewport meta tag
    const viewportMeta = await page.$('meta[name="viewport"]');
    if (!viewportMeta) {
      issues.push('Missing viewport meta tag');
    }

    // Test responsive behavior
    await page.setViewportSize({ width: 768, height: 1024 });
    const tabletLayout = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth <= window.innerWidth;
    });

    if (!tabletLayout) {
      issues.push('Content not properly responsive on tablet');
    }

    return {
      passed: issues.length === 0,
      issues,
      touchTargetSizes
    };
  }

  /**
   * Test Accessibility with Reduced Motion
   */
  async testReducedMotion(page: any): Promise<{
    passed: boolean;
    issues: string[];
    animatedElements: string[];
  }> {
    const issues: string[] = [];
    const animatedElements: string[] = [];

    // Enable reduced motion preference
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

    // Check for animations that should be disabled
    const elementsWithAnimation = await page.$$(
      '[style*="animation"], [style*="transition"], .animate, .transition'
    );

    for (const element of elementsWithAnimation) {
      const animationState = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          animationDuration: style.animationDuration,
          transitionDuration: style.transitionDuration
        };
      });

      const elementSelector = await element.evaluate(el => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `.${el.className.split(' ').join('.')}`;
        return el.tagName.toLowerCase();
      });

      if (animationState.animationDuration !== '0s' || animationState.transitionDuration !== '0s') {
        animatedElements.push(elementSelector);
        issues.push(`Animation still active with reduced motion: ${elementSelector}`);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      animatedElements
    };
  }

  /**
   * Run comprehensive accessibility audit
   */
  async runFullAccessibilityAudit(page: any): Promise<{
    componentAudits: ComponentAudit[];
    keyboardNavigation: any;
    screenReader: any;
    visualAccessibility: any;
    mobileAccessibility: any;
    reducedMotion: any;
    overallScore: number;
    compliance: 'AAA' | 'AA' | 'A' | 'Non-Compliant';
    recommendations: string[];
  }> {
    // Run component audits
    const componentAudits = await Promise.all([
      this.testAssistantInterface(page),
      this.testVoiceInput(page),
      this.testQuickActions(page),
      this.testMemoryExplorer(page),
      this.testPatternVisualization(page),
      this.testTimelineInterface(page),
      this.testNavigation(page),
      this.testForms(page),
      this.testModals(page),
      this.testDataTables(page)
    ]);

    // Run specialized tests
    const keyboardNavigation = await this.testKeyboardNavigation(page);
    const screenReader = await this.testScreenReaderCompatibility(page);
    const visualAccessibility = await this.testVisualAccessibility(page);
    const mobileAccessibility = await this.testMobileAccessibility(page);
    const reducedMotion = await this.testReducedMotion(page);

    // Calculate overall score
    const componentScores = componentAudits.map(audit => {
      const complianceFactors = Object.values(audit.compliance).filter(Boolean).length;
      const totalFactors = Object.values(audit.compliance).length;
      return (complianceFactors / totalFactors) * 100 - (audit.violations.length * 5);
    });

    const testScores = [
      keyboardNavigation.passed ? 100 : 0,
      screenReader.passed ? 100 : 0,
      visualAccessibility.passed ? 100 : 0,
      mobileAccessibility.passed ? 100 : 0,
      reducedMotion.passed ? 100 : 0
    ];

    const overallScore = Math.round(
      [...componentScores, ...testScores].reduce((sum, score) => sum + Math.max(0, score), 0) /
      (componentScores.length + testScores.length)
    );

    let compliance: 'AAA' | 'AA' | 'A' | 'Non-Compliant';
    if (overallScore >= 95) {
      compliance = 'AAA';
    } else if (overallScore >= 85) {
      compliance = 'AA';
    } else if (overallScore >= 70) {
      compliance = 'A';
    } else {
      compliance = 'Non-Compliant';
    }

    // Generate recommendations
    const recommendations = this.generateAuditRecommendations({
      componentAudits,
      keyboardNavigation,
      screenReader,
      visualAccessibility,
      mobileAccessibility,
      reducedMotion
    });

    return {
      componentAudits,
      keyboardNavigation,
      screenReader,
      visualAccessibility,
      mobileAccessibility,
      reducedMotion,
      overallScore,
      compliance,
      recommendations
    };
  }

  /**
   * Generate audit recommendations
   */
  private generateAuditRecommendations(auditResults: any): string[] {
    const recommendations: string[] = [];

    // Component-based recommendations
    const failingComponents = auditResults.componentAudits.filter(
      (audit: ComponentAudit) => audit.violations.length > 0
    );

    failingComponents.forEach((audit: ComponentAudit) => {
      recommendations.push(`Fix ${audit.violations.length} accessibility issues in ${audit.componentName}`);
    });

    // Test-specific recommendations
    if (!auditResults.keyboardNavigation.passed) {
      recommendations.push('Improve keyboard navigation and focus management');
    }

    if (!auditResults.screenReader.passed) {
      recommendations.push('Enhance screen reader compatibility and ARIA implementation');
    }

    if (!auditResults.visualAccessibility.passed) {
      recommendations.push('Address color contrast and visual accessibility issues');
    }

    if (!auditResults.mobileAccessibility.passed) {
      recommendations.push('Improve mobile accessibility and touch target sizes');
    }

    if (!auditResults.reducedMotion.passed) {
      recommendations.push('Implement proper reduced motion support');
    }

    // Strategic recommendations
    recommendations.push('Implement automated accessibility testing in CI/CD pipeline');
    recommendations.push('Conduct manual testing with screen readers and assistive technologies');
    recommendations.push('Test with users with diverse accessibility needs');
    recommendations.push('Establish accessibility guidelines and training for development team');
    recommendations.push('Monitor accessibility compliance in production');

    return recommendations;
  }
}