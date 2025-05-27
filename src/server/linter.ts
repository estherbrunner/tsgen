/**
 * Linter for TypeScript code
 * Analyzes generated code for style and potential issues
 */

import { LintResult, LintIssue } from '../shared/types';
import { ESLint } from 'eslint';

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
            parser: typescriptParser.default,
          },
          rules: {
            indent: ['warn', 2],
            quotes: ['warn', 'single'],
            semi: ['warn', 'always'],
            'no-console': 'warn',
            'no-unused-vars': 'warn',
          },
        },
        {
          files: ['**/*.js'],
          languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
          },
          rules: {
            indent: ['warn', 2],
            quotes: ['warn', 'single'],
            semi: ['warn', 'always'],
            'no-console': 'warn',
            'no-unused-vars': 'warn',
          },
        },
      ],
    });

    // Lint the code using lintText
    const results = await eslint.lintText(code, { filePath: 'temp.ts' });

    // Transform ESLint results to our format
    let issues: LintIssue[] = [];

    if (results.length > 0 && results[0].messages) {
      issues = results[0].messages.map(message => ({
        severity:
          message.severity === 2
            ? 'error'
            : message.severity === 1
              ? 'warning'
              : 'info',
        message: message.message,
        line: message.line || 1,
        column: message.column || 1,
        rule: message.ruleId || 'unknown',
      }));
    }

    return {
      success: issues.filter(issue => issue.severity === 'error').length === 0,
      issues,
    };
  } catch (error) {
    // Return an error if ESLint fails for any reason
    const issues: LintIssue[] = [
      {
        severity: 'error',
        message: `ESLint failed to initialize or run: ${error instanceof Error ? error.message : 'Unknown error'}`,
        line: 1,
        column: 1,
        rule: 'eslint-error',
      },
    ];

    return {
      success: false,
      issues,
    };
  }
}
