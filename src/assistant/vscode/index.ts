import { EventEmitter } from 'events';
import { AlwaysOnAssistant } from '../core';
import { NaturalLanguageProcessor } from '../nlp';

/**
 * VS Code Assistance Integration
 * Provides intelligent coding assistance integrated with VS Code
 */
export interface VSCodeConfig {
  enabled: boolean;
  autoSuggest: boolean;
  autoComplete: boolean;
  codeReview: boolean;
  errorDetection: boolean;
  documentation: boolean;
  refactoring: boolean;
  testing: boolean;
  performance: boolean;
  workspace: {
    rootPath: string;
    excludedPaths: string[];
    maxFileSize: number; // MB
  };
  suggestions: {
    maxResults: number;
    confidenceThreshold: number;
    includeContext: boolean;
  };
  integrations: {
    git: boolean;
    github: boolean;
    npm: boolean;
    docker: boolean;
    kubernetes: boolean;
  };
}

export interface CodeFile {
  uri: string;
  path: string;
  language: string;
  content: string;
  version: number;
  isDirty: boolean;
}

export interface CodePosition {
  line: number;
  character: number;
}

export interface CodeRange {
  start: CodePosition;
  end: CodePosition;
}

export interface CodeSuggestion {
  id: string;
  type: 'completion' | 'refactoring' | 'fix' | 'optimization' | 'documentation';
  title: string;
  description: string;
  code: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  range?: CodeRange;
  context: {
    file: string;
    position: CodePosition;
    surroundingCode?: string;
  };
  impact: {
    complexity?: 'decrease' | 'increase' | 'neutral';
    performance?: 'improve' | 'degrade' | 'neutral';
    readability?: 'improve' | 'degrade' | 'neutral';
  };
}

export interface CodeIssue {
  id: string;
  type: 'error' | 'warning' | 'info' | 'style';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  rule: string;
  range: CodeRange;
  suggestions: CodeSuggestion[];
  fixable: boolean;
  automatedFix?: CodeSuggestion;
}

export interface CodeReviewResult {
  file: string;
  issues: CodeIssue[];
  metrics: {
    complexity: number;
    maintainability: number;
    reliability: number;
    security: number;
  };
  suggestions: CodeSuggestion[];
  summary: string;
  timeReviewed: Date;
}

export interface RefactoringSuggestion {
  id: string;
  type: 'extract_function' | 'rename' | 'extract_variable' | 'inline' | 'change_signature';
  name: string;
  description: string;
  range: CodeRange;
  newCode: string;
  benefits: string[];
  risks: string[];
}

export interface DocumentationResult {
  filePath: string;
  documentation: {
    overview: string;
    parameters?: Array<{
      name: string;
      type: string;
      description: string;
      optional?: boolean;
      defaultValue?: string;
    }>;
    returns?: {
      type: string;
      description: string;
    };
    examples?: Array<{
      code: string;
      description: string;
    }>;
    dependencies?: string[];
    sideEffects?: string;
  };
  format: 'jsdoc' | 'tsdoc' | 'javadoc' | 'godoc';
}

export class VSCodeIntegration extends EventEmitter {
  private config: VSCodeConfig;
  private isInitialized = false;
  private isRunning = false;

  // Core dependencies
  private assistant: AlwaysOnAssistant | null = null;
  private nlp: NaturalLanguageProcessor | null = null;

  // VS Code state
  private workspace: Map<string, CodeFile> = new Map();
  private activeEditor: string | null = null;
  private diagnostics: Map<string, CodeIssue[]> = new Map();

  // Analysis cache
  private analysisCache: Map<string, {
    result: any;
    timestamp: Date;
  }> = new Map();

  // Performance metrics
  private metrics = {
    totalSuggestions: 0,
    acceptedSuggestions: 0,
    totalReviews: 0,
    fixedIssues: 0,
    averageResponseTime: 0,
    filesAnalyzed: 0,
    errors: 0
  };

  constructor(config: VSCodeConfig) {
    super();
    this.config = config;
  }

  async initialize(
    assistant: AlwaysOnAssistant,
    nlp: NaturalLanguageProcessor
  ): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[VSCodeIntegration] Initializing...');

      // Store dependencies
      this.assistant = assistant;
      this.nlp = nlp;

      // Initialize VS Code connection
      await this.initializeVSCodeConnection();

      // Set up event listeners
      this.setupEventListeners();

      // Initialize workspace analysis
      await this.analyzeWorkspace();

      this.isInitialized = true;
      console.log('[VSCodeIntegration] Initialized successfully');

      this.emit('initialized');

    } catch (error) {
      console.error('[VSCodeIntegration] Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.isInitialized) return;

    try {
      console.log('[VSCodeIntegration] Starting...');
      this.isRunning = true;
      console.log('[VSCodeIntegration] Started successfully');

      this.emit('started');

    } catch (error) {
      console.error('[VSCodeIntegration] Start failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[VSCodeIntegration] Stopping...');

      // Clean up resources
      this.workspace.clear();
      this.diagnostics.clear();
      this.analysisCache.clear();

      this.isRunning = false;
      console.log('[VSCodeIntegration] Stopped successfully');

      this.emit('stopped');

    } catch (error) {
      console.error('[VSCodeIntegration] Stop failed:', error);
      throw error;
    }
  }

  async updateFile(file: CodeFile): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.workspace.set(file.uri, file);
      
      // Analyze the file if it's the active editor
      if (file.uri === this.activeEditor) {
        await this.analyzeActiveFile();
      }

      // Clear cache for this file
      this.analysisCache.delete(file.uri);

      this.emit('fileUpdated', file);

    } catch (error) {
      console.error('[VSCodeIntegration] Error updating file:', error);
    }
  }

  async setActiveEditor(uri: string): Promise<void> {
    this.activeEditor = uri;
    
    if (this.workspace.has(uri)) {
      await this.analyzeActiveFile();
    }
  }

  async getCodeCompletions(
    position: CodePosition,
    context: {
      file: string;
      prefix: string;
      lineContent: string;
      surroundingCode: string;
    }
  ): Promise<CodeSuggestion[]> {
    if (!this.isInitialized || !this.isRunning || !this.config.autoSuggest) {
      return [];
    }

    const startTime = performance.now();
    this.metrics.totalSuggestions++;

    try {
      console.log('[VSCodeIntegration] Generating code completions');

      const suggestions: CodeSuggestion[] = [];

      // Get the file content
      const file = this.workspace.get(context.file);
      if (!file) {
        return [];
      }

      // Generate completions based on context
      const completions = await this.generateCompletions(file, position, context);

      // Filter by confidence threshold
      const filtered = completions.filter(c => c.confidence >= this.config.suggestions.confidenceThreshold);

      // Sort by priority and confidence
      filtered.sort((a, b) => {
        if (a.priority !== b.priority) {
          const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.confidence - a.confidence;
      });

      // Limit results
      const limited = filtered.slice(0, this.config.suggestions.maxResults);

      // Update metrics
      this.metrics.averageResponseTime = this.updateAverage(
        this.metrics.averageResponseTime,
        performance.now() - startTime,
        this.metrics.totalSuggestions
      );

      console.log(`[VSCodeIntegration] Generated ${limited.length} completions`);
      return limited;

    } catch (error) {
      this.metrics.errors++;
      console.error('[VSCodeIntegration] Error generating completions:', error);
      return [];
    }
  }

  async analyzeCode(fileUri: string): Promise<CodeReviewResult> {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('VS Code integration not initialized or running');
    }

    const file = this.workspace.get(fileUri);
    if (!file) {
      throw new Error(`File not found: ${fileUri}`);
    }

    const startTime = performance.now();
    this.metrics.totalReviews++;

    try {
      console.log(`[VSCodeIntegration] Analyzing code: ${file.path}`);

      // Check cache
      const cacheKey = `analysis-${fileUri}-${file.version}`;
      const cached = this.analysisCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp.getTime()) < 300000) { // 5 minutes
        return cached.result;
      }

      // Perform code analysis
      const issues = await this.detectIssues(file);
      const suggestions = await this.generateSuggestions(file, issues);
      const metrics = await this.calculateMetrics(file);

      const result: CodeReviewResult = {
        file: file.path,
        issues,
        metrics,
        suggestions,
        summary: this.generateSummary(issues, metrics),
        timeReviewed: new Date()
      };

      // Cache result
      this.analysisCache.set(cacheKey, {
        result,
        timestamp: new Date()
      });

      // Update metrics
      this.metrics.filesAnalyzed++;

      // Store diagnostics
      this.diagnostics.set(fileUri, issues);

      console.log(`[VSCodeIntegration] Analysis completed for ${file.path}`);
      this.emit('codeAnalyzed', result);

      return result;

    } catch (error) {
      this.metrics.errors++;
      console.error(`[VSCodeIntegration] Error analyzing code ${file.path}:`, error);
      throw error;
    }
  }

  async generateDocumentation(fileUri: string, range?: CodeRange): Promise<DocumentationResult> {
    if (!this.isInitialized || !this.config.documentation) {
      throw new Error('Documentation generation not enabled');
    }

    const file = this.workspace.get(fileUri);
    if (!file) {
      throw new Error(`File not found: ${fileUri}`);
    }

    try {
      console.log(`[VSCodeIntegration] Generating documentation for ${file.path}`);

      // Parse code structure
      const codeToDocument = range ? 
        this.extractRange(file.content, range) : 
        file.content;

      // Generate documentation based on language
      const documentation = await this.generateDocumentationForCode(
        codeToDocument,
        file.language,
        range
      );

      const result: DocumentationResult = {
        filePath: file.path,
        documentation,
        format: this.getDocumentationFormat(file.language)
      };

      console.log('[VSCodeIntegration] Documentation generated successfully');
      this.emit('documentationGenerated', result);

      return result;

    } catch (error) {
      console.error(`[VSCodeIntegration] Error generating documentation for ${file.path}:`, error);
      throw error;
    }
  }

  async suggestRefactoring(fileUri: string, range?: CodeRange): Promise<RefactoringSuggestion[]> {
    if (!this.isInitialized || !this.config.refactoring) {
      return [];
    }

    const file = this.workspace.get(fileUri);
    if (!file) {
      throw new Error(`File not found: ${fileUri}`);
    }

    try {
      console.log(`[VSCodeIntegration] Suggesting refactoring for ${file.path}`);

      const targetRange = range || {
        start: { line: 0, character: 0 },
        end: { line: file.content.split('\n').length, character: 0 }
      };

      const targetCode = this.extractRange(file.content, targetRange);

      // Analyze code for refactoring opportunities
      const suggestions = await this.analyzeRefactoringOpportunities(
        targetCode,
        file.language,
        targetRange,
        file.path
      );

      console.log(`[VSCodeIntegration] Generated ${suggestions.length} refactoring suggestions`);
      return suggestions;

    } catch (error) {
      console.error(`[VSCodeIntegration] Error suggesting refactoring for ${file.path}:`, error);
      return [];
    }
  }

  async acceptSuggestion(suggestionId: string): Promise<void> {
    // Find and apply the suggestion
    // This would integrate with VS Code's text editing APIs
    console.log(`[VSCodeIntegration] Applying suggestion: ${suggestionId}`);
    this.metrics.acceptedSuggestions++;
    this.emit('suggestionAccepted', suggestionId);
  }

  // Private helper methods
  private async initializeVSCodeConnection(): Promise<void> {
    // Initialize connection to VS Code extension
    // This would typically involve connecting to the VS Code extension API
    console.log('[VSCodeIntegration] Initializing VS Code connection...');
  }

  private async analyzeWorkspace(): Promise<void> {
    // Analyze the entire workspace
    console.log('[VSCodeIntegration] Analyzing workspace...');
    // This would scan files, understand project structure, etc.
  }

  private async analyzeActiveFile(): Promise<void> {
    if (!this.activeEditor) return;

    try {
      await this.analyzeCode(this.activeEditor);
    } catch (error) {
      console.error('[VSCodeIntegration] Error analyzing active file:', error);
    }
  }

  private async generateCompletions(
    file: CodeFile,
    position: CodePosition,
    context: {
      prefix: string;
      lineContent: string;
      surroundingCode: string;
    }
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    // Generate different types of completions based on context
    if (context.prefix) {
      // Text completion
      const textCompletions = await this.generateTextCompletions(file, position, context);
      suggestions.push(...textCompletions);
    }

    // Code-specific completions
    if (['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp'].includes(file.language)) {
      const codeCompletions = await this.generateCodeSpecificCompletions(file, position, context);
      suggestions.push(...codeCompletions);
    }

    // Smart completions based on context
    const smartCompletions = await this.generateSmartCompletions(file, position, context);
    suggestions.push(...smartCompletions);

    return suggestions;
  }

  private async generateTextCompletions(
    file: CodeFile,
    position: CodePosition,
    context: { prefix: string; lineContent: string; surroundingCode: string; }
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    // Basic text completion based on surrounding code
    const words = this.extractWords(context.surroundingCode);
    const uniqueWords = [...new Set(words)];
    
    for (const word of uniqueWords) {
      if (word.toLowerCase().startsWith(context.prefix.toLowerCase()) && word !== context.prefix) {
        suggestions.push({
          id: this.generateId('completion'),
          type: 'completion',
          title: word,
          description: `Text completion: ${word}`,
          code: word,
          confidence: 0.7,
          priority: 'medium',
          context: {
            file: file.uri,
            position,
            surroundingCode: context.surroundingCode
          },
          impact: { readability: 'improve' }
        });
      }
    }

    return suggestions;
  }

  private async generateCodeSpecificCompletions(
    file: CodeFile,
    position: CodePosition,
    context: { prefix: string; lineContent: string; surroundingCode: string; }
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    // Language-specific completions
    switch (file.language) {
      case 'javascript':
      case 'typescript':
        suggestions.push(...this.getJavaScriptCompletions(context));
        break;
      case 'python':
        suggestions.push(...this.getPythonCompletions(context));
        break;
      case 'java':
        suggestions.push(...this.getJavaCompletions(context));
        break;
      // Add more languages as needed
    }

    return suggestions;
  }

  private getJavaScriptCompletions(context: { prefix: string; lineContent: string; }): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const lowerPrefix = context.prefix.toLowerCase();

    // Common JavaScript patterns
    const patterns = [
      { prefix: 'con', completion: 'console.log()', description: 'Log to console' },
      { prefix: 'for', completion: 'for (let i = 0; i < array.length; i++) {\n  \n}', description: 'For loop' },
      { prefix: 'if', completion: 'if (condition) {\n  \n}', description: 'If statement' },
      { prefix: 'func', completion: 'function functionName(params) {\n  \n}', description: 'Function declaration' },
      { prefix: 'class', completion: 'class ClassName {\n  constructor() {\n    \n  }\n}', description: 'Class declaration' },
      { prefix: 'try', completion: 'try {\n  \n} catch (error) {\n  \n}', description: 'Try-catch block' },
      { prefix: 'imp', completion: 'import moduleName from \'module\';', description: 'Import statement' },
      { prefix: 'exp', completion: 'export default functionName;', description: 'Export default' },
      { prefix: 'arr', completion: 'Array.from()', description: 'Create array from iterable' },
      { prefix: 'obj', completion: 'Object.assign()', description: 'Merge objects' }
    ];

    for (const pattern of patterns) {
      if (lowerPrefix.startsWith(pattern.prefix)) {
        suggestions.push({
          id: this.generateId('completion'),
          type: 'completion',
          title: pattern.completion,
          description: pattern.description,
          code: pattern.completion,
          confidence: 0.9,
          priority: 'high',
          impact: { readability: 'improve', performance: 'neutral' }
        });
      }
    }

    return suggestions;
  }

  private getPythonCompletions(context: { prefix: string; lineContent: string; }): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const lowerPrefix = context.prefix.toLowerCase();

    const patterns = [
      { prefix: 'def', completion: 'def function_name(parameters):\n    """Function description"""\n    pass', description: 'Function definition' },
      { prefix: 'class', completion: 'class ClassName:\n    def __init__(self):\n        pass', description: 'Class definition' },
      { prefix: 'for', completion: 'for item in iterable:\n    pass', description: 'For loop' },
      { prefix: 'if', completion: 'if condition:\n    pass', description: 'If statement' },
      { prefix: 'try', completion: 'try:\n    pass\nexcept Exception as e:\n    pass', description: 'Try-except block' },
      { prefix: 'imp', completion: 'import module_name', description: 'Import statement' },
      { prefix: 'pri', completion: 'print()', description: 'Print statement' },
      { prefix: 'ret', completion: 'return ', description: 'Return statement' }
    ];

    for (const pattern of patterns) {
      if (lowerPrefix.startsWith(pattern.prefix)) {
        suggestions.push({
          id: this.generateId('completion'),
          type: 'completion',
          title: pattern.completion,
          description: pattern.description,
          code: pattern.completion,
          confidence: 0.9,
          priority: 'high',
          impact: { readability: 'improve' }
        });
      }
    }

    return suggestions;
  }

  private getJavaCompletions(context: { prefix: string; lineContent: string; }): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const lowerPrefix = context.prefix.toLowerCase();

    const patterns = [
      { prefix: 'pub', completion: 'public ', description: 'Public access modifier' },
      { prefix: 'pri', completion: 'private ', description: 'Private access modifier' },
      { prefix: 'pro', completion: 'protected ', description: 'Protected access modifier' },
      { prefix: 'cla', completion: 'class ClassName {\n  \n}', description: 'Class declaration' },
      { prefix: 'for', completion: 'for (int i = 0; i < array.length; i++) {\n  \n}', description: 'For loop' },
      { prefix: 'if', completion: 'if (condition) {\n  \n}', description: 'If statement' },
      { prefix: 'sys', completion: 'System.out.println()', description: 'Print to console' },
      { prefix: 'imp', completion: 'import ', description: 'Import statement' },
      { prefix: 'try', completion: 'try {\n  \n} catch (Exception e) {\n  \n}', description: 'Try-catch block' }
    ];

    for (const pattern of patterns) {
      if (lowerPrefix.startsWith(pattern.prefix)) {
        suggestions.push({
          id: this.generateId('completion'),
          type: 'completion',
          title: pattern.completion,
          description: pattern.description,
          code: pattern.completion,
          confidence: 0.9,
          priority: 'high',
          impact: { readability: 'improve' }
        });
      }
    }

    return suggestions;
  }

  private async generateSmartCompletions(
    file: CodeFile,
    position: CodePosition,
    context: { prefix: string; lineContent: string; surroundingCode: string; }
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    // Use NLP to understand context and generate intelligent completions
    if (this.nlp && this.assistant) {
      try {
        const nlpResult = this.nlp.process(context.surroundingCode);
        
        if (nlpResult.intent === 'create_function') {
          suggestions.push({
            id: this.generateId('completion'),
            type: 'completion',
            title: 'function template',
            description: 'Function template based on context',
            code: this.generateFunctionTemplate(file.language),
            confidence: 0.8,
            priority: 'high',
            impact: { readability: 'improve' }
          });
        }

        if (nlpResult.intent === 'handle_error') {
          suggestions.push({
            id: this.generateId('completion'),
            type: 'completion',
            title: 'error handling',
            description: 'Error handling pattern',
            code: this.generateErrorHandlingTemplate(file.language),
            confidence: 0.8,
            priority: 'high',
            impact: { reliability: 'improve' }
          });
        }

      } catch (error) {
        console.error('[VSCodeIntegration] Error in smart completions:', error);
      }
    }

    return suggestions;
  }

  private generateFunctionTemplate(language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 'function functionName(parameters) {\n  // Function implementation\n  return result;\n}';
      case 'python':
        return 'def function_name(parameters):\n    """Function description"""\n    # Function implementation\n    return result';
      case 'java':
        return 'public returnType methodName(parameters) {\n  // Method implementation\n  return result;\n}';
      default:
        return 'function functionName(parameters) {\n  // Function implementation\n}';
    }
  }

  private generateErrorHandlingTemplate(language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 'try {\n  // Code that might throw\n} catch (error) {\n  console.error(error);\n  // Handle error\n}';
      case 'python':
        return 'try:\n    # Code that might raise\nexcept Exception as e:\n    print(f"Error: {e}")\n    # Handle error';
      case 'java':
        return 'try {\n  // Code that might throw\n} catch (Exception e) {\n  e.printStackTrace();\n  // Handle error\n}';
      default:
        return 'try {\n  // Code that might throw\n} catch (error) {\n  // Handle error\n}';
    }
  }

  private async detectIssues(file: CodeFile): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];

    // Basic code analysis for common issues
    const lines = file.content.split('\n');

    // Check for common patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for unused variables (simplified)
      if (line.includes('const ') || line.includes('let ') || line.includes('var ')) {
        const varMatch = line.match(/(const|let|var)\s+(\w+)/);
        if (varMatch) {
          const variableName = varMatch[2];
          const isUsed = this.isVariableUsed(file.content, variableName, i);
          
          if (!isUsed) {
            issues.push({
              id: this.generateId('issue'),
              type: 'warning',
              severity: 'low',
              message: `Unused variable: ${variableName}`,
              rule: 'no-unused-vars',
              range: {
                start: { line: lineNum - 1, character: 0 },
                end: { line: lineNum - 1, character: line.length }
              },
              suggestions: [],
              fixable: true
            });
          }
        }
      }

      // Check for TODO comments
      if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
        issues.push({
          id: this.generateId('issue'),
          type: 'info',
          severity: 'medium',
          message: 'TODO comment found',
          rule: 'todo-comments',
          range: {
            start: { line: lineNum - 1, character: 0 },
            end: { line: lineNum - 1, character: line.length }
          },
          suggestions: [],
          fixable: false
        });
      }
    }

    return issues;
  }

  private isVariableUsed(content: string, variableName: string, declarationLine: number): boolean {
    const lines = content.split('\n');
    
    for (let i = declarationLine + 1; i < lines.length; i++) {
      if (lines[i].includes(variableName)) {
        // Simple check - in reality, this would be more sophisticated
        return true;
      }
    }
    
    return false;
  }

  private async generateSuggestions(file: CodeFile, issues: CodeIssue[]): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    for (const issue of issues) {
      if (issue.fixable) {
        const line = file.content.split('\n')[issue.range.start.line];
        
        switch (issue.rule) {
          case 'no-unused-vars':
            suggestions.push({
              id: this.generateId('suggestion'),
              type: 'fix',
              title: 'Remove unused variable',
              description: 'Remove the unused variable declaration',
              code: '',
              confidence: 0.95,
              priority: 'medium',
              range: issue.range,
              context: {
                file: file.uri,
                position: issue.range.start,
                surroundingCode: line
              },
              impact: { readability: 'improve' }
            });
            break;
        }
      }
    }

    return suggestions;
  }

  private async calculateMetrics(file: CodeFile): Promise<{
    complexity: number;
    maintainability: number;
    reliability: number;
    security: number;
  }> {
    // Simple metrics calculation
    const lines = file.content.split('\n');
    const complexity = Math.min(100, lines.length / 10);
    const maintainability = Math.max(0, 100 - complexity);
    const reliability = 95; // Placeholder
    const security = 90; // Placeholder

    return {
      complexity: Math.round(complexity),
      maintainability: Math.round(maintainability),
      reliability,
      security
    };
  }

  private generateSummary(issues: CodeIssue[], metrics: any): string {
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;
    
    return `Analysis complete. Found ${errorCount} errors and ${warningCount} warnings. ` +
           `Complexity: ${metrics.complexity}/100, Maintainability: ${metrics.maintainability}/100.`;
  }

  private async generateDocumentationForCode(
    code: string,
    language: string,
    range?: CodeRange
  ): Promise<any> {
    // Generate documentation based on code structure
    return {
      overview: 'Generated documentation for code block',
      parameters: [],
      returns: undefined,
      examples: [],
      dependencies: [],
      sideEffects: 'None documented'
    };
  }

  private getDocumentationFormat(language: string): 'jsdoc' | 'tsdoc' | 'javadoc' | 'godoc' {
    switch (language) {
      case 'javascript':
        return 'jsdoc';
      case 'typescript':
        return 'tsdoc';
      case 'java':
        return 'javadoc';
      case 'go':
        return 'godoc';
      default:
        return 'jsdoc';
    }
  }

  private async analyzeRefactoringOpportunities(
    code: string,
    language: string,
    range: CodeRange,
    filePath: string
  ): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];

    // Simple refactoring detection
    if (code.length > 500) {
      suggestions.push({
        id: this.generateId('refactoring'),
        type: 'extract_function',
        name: 'Extract Large Code Block',
        description: 'Extract this large code block into a separate function',
        range,
        newCode: '// Extracted function would go here',
        benefits: ['Improves readability', 'Makes code reusable'],
        risks: ['May require parameter passing']
      });
    }

    return suggestions;
  }

  private extractRange(content: string, range: CodeRange): string {
    const lines = content.split('\n');
    const startLine = range.start.line;
    const endLine = range.end.line;
    
    if (startLine >= lines.length || endLine >= lines.length) {
      return '';
    }
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private extractWords(text: string): string[] {
    // Extract words from text for completion
    return text.match(/\b\w+\b/g) || [];
  }

  private setupEventListeners(): void {
    if (!this.assistant) return;

    // Listen for assistant events
    this.assistant.on('actionExecuted', async (data) => {
      if (data.action.type === 'analyze_code') {
        try {
          const result = await this.analyzeCode(data.action.parameters.fileUri);
          // Send result back to assistant
        } catch (error) {
          console.error('[VSCodeIntegration] Error handling code analysis request:', error);
        }
      }
    });
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return current * (count - 1) / count + newValue / count;
  }

  // Public API methods
  getWorkspaceFiles(): CodeFile[] {
    return Array.from(this.workspace.values());
  }

  getDiagnostics(fileUri?: string): CodeIssue[] {
    if (fileUri) {
      return this.diagnostics.get(fileUri) || [];
    }
    return Array.from(this.diagnostics.values()).flat();
  }

  getStats() {
    return { ...this.metrics };
  }

  async updateConfig(newConfig: Partial<VSCodeConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    console.log('[VSCodeIntegration] Configuration updated');
  }

  getConfig(): VSCodeConfig {
    return { ...this.config };
  }

  isHealthy(): boolean {
    return this.isRunning && this.metrics.errors / Math.max(this.metrics.totalSuggestions + this.metrics.totalReviews, 1) < 0.1;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    
    try {
      // Clean up resources
      this.workspace.clear();
      this.diagnostics.clear();
      this.analysisCache.clear();

      this.assistant = null;
      this.nlp = null;

      console.log('[VSCodeIntegration] Cleanup completed');

    } catch (error) {
      console.error('[VSCodeIntegration] Cleanup failed:', error);
    }
  }
}