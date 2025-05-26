/**
 * Linter for TypeScript code
 * Analyzes generated code for style and potential issues
 */

import { LintResult, LintIssue } from '../shared/types';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';

/**
 * Lint TypeScript code using ESLint with TypeScript support
 * 
 * @param code - The TypeScript code to lint
 * @returns Result of linting
 */
export async function lint(code: string): Promise<LintResult> {
  try {
    // Import TypeScript parser
    const typescriptParser = await import('@typescript-eslint/parser');
    
    // Initialize ESLint with TypeScript configuration
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.ts'],
          languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: typescriptParser.default
          },
          rules: {
            'indent': ['error', 2],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'no-console': 'warn',
            'no-unused-vars': 'warn'
          }
        },
        {
          files: ['**/*.js'],
          languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module'
          },
          rules: {
            'indent': ['error', 2],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'no-console': 'warn',
            'no-unused-vars': 'warn'
          }
        }
      ]
    });
    
    // Lint the code using lintText
    const results = await eslint.lintText(code, { filePath: 'temp.ts' });
    
    // Transform ESLint results to our format
    let issues: LintIssue[] = [];
    
    if (results.length > 0 && results[0].messages) {
      issues = results[0].messages.map((message) => ({
        severity: message.severity === 2 ? 'error' : message.severity === 1 ? 'warning' : 'info',
        message: message.message,
        line: message.line || 1,
        column: message.column || 1,
        rule: message.ruleId || 'unknown'
      }));
    }
    
    return {
      success: issues.filter(issue => issue.severity === 'error').length === 0,
      issues
    };
  } catch (error) {
    // Return an error if ESLint fails for any reason
    const issues: LintIssue[] = [{
      severity: 'error',
      message: `ESLint failed to initialize or run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      line: 1,
      column: 1,
      rule: 'eslint-error'
    }];
    
    return {
      success: false,
      issues
    };
  }
}

/**
 * Format TypeScript code using Prettier
 * 
 * @param code - The TypeScript code to format
 * @returns Formatted code
 */
export async function formatCode(code: string): Promise<string> {
  try {
    // Basic validation - check for unclosed braces/brackets
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    
    // If obviously malformed, return original code
    if (Math.abs(openBraces - closeBraces) > 1 || Math.abs(openParens - closeParens) > 1) {
      console.warn('Code appears malformed, skipping Prettier formatting');
      return code;
    }

    // Get Prettier configuration (or use defaults)
    const config = await prettier.resolveConfig(process.cwd()) || {};
    
    // Set TypeScript-specific defaults
    const options = {
      ...config,
      parser: 'typescript',
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5' as const,
      printWidth: 80,
    };

    // Format the code with Prettier
    const formatted = await prettier.format(code, options);
    return formatted;
  } catch (error) {
    // If Prettier fails, return the original code
    console.warn('Prettier formatting failed:', error instanceof Error ? error.message : String(error));
    return code;
  }
}

/**
 * Format and lint TypeScript code in a single operation
 * 
 * @param code - The TypeScript code to lint (should already be formatted)
 * @returns Object containing both formatted code and lint results
 */
export async function formatAndLint(code: string): Promise<{ formattedCode: string; lintResult: LintResult }> {
  const lintResult = await lint(code);
  
  return {
    formattedCode: code, // Code is already formatted by function generator
    lintResult
  };
}