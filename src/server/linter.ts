/**
 * Linter for TypeScript code
 * Analyzes generated code for style and potential issues
 */

import { LintResult, LintIssue } from '../shared/types';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';

/**
 * Lint TypeScript code
 * 
 * @param code - The TypeScript code to lint
 * @returns Result of linting
 */
export async function lint(code: string): Promise<LintResult> {
  // Create a temporary file to hold the code
  const tempFileName = `temp-${randomUUID()}.ts`;
  const tempFilePath = join(process.cwd(), tempFileName);
  
  try {
    // Write the code to the temporary file
    writeFileSync(tempFilePath, code);
    
    // Run ESLint to check for style issues
    const eslintResult = spawnSync('npx', ['eslint', '--format', 'json', tempFilePath], {
      encoding: 'utf-8'
    });
    
    // Parse ESLint results
    let issues: LintIssue[] = [];
    
    if (eslintResult.stdout) {
      try {
        const eslintOutput = JSON.parse(eslintResult.stdout);
        if (Array.isArray(eslintOutput) && eslintOutput.length > 0) {
          // Transform ESLint issues to our format
          issues = eslintOutput[0].messages.map((message: any) => ({
            severity: message.severity === 2 ? 'error' : message.severity === 1 ? 'warning' : 'info',
            message: message.message,
            line: message.line,
            column: message.column,
            rule: message.ruleId || 'unknown'
          }));
        }
      } catch (parseError) {
        // If we can't parse the ESLint output, create a fallback issue
        issues.push({
          severity: 'error',
          message: 'Failed to parse ESLint output',
          line: 1,
          column: 1,
          rule: 'parse-error'
        });
      }
    }
    
    // If ESLint failed to run properly, perform basic linting ourselves
    if (eslintResult.status !== 0 && issues.length === 0) {
      issues = performBasicLinting(code);
    }
    
    return {
      success: issues.filter(issue => issue.severity === 'error').length === 0,
      issues
    };
  } catch (error) {
    // Fallback to basic linting if ESLint fails for any reason
    const issues = performBasicLinting(code);
    
    return {
      success: issues.filter(issue => issue.severity === 'error').length === 0,
      issues
    };
  } finally {
    // Clean up the temporary file
    try {
      unlinkSync(tempFilePath);
    } catch (e) {
      // Ignore errors when deleting the temporary file
    }
  }
}

/**
 * Perform basic linting checks without external tools
 * This is a fallback in case ESLint is not available
 * 
 * @param code - The TypeScript code to lint
 * @returns Array of lint issues
 */
function performBasicLinting(code: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = code.split('\n');
  
  // Check for lines that are too long
  lines.forEach((line, index) => {
    if (line.length > 100) {
      issues.push({
        severity: 'warning',
        message: 'Line is too long (exceeds 100 characters)',
        line: index + 1,
        column: 1,
        rule: 'max-len'
      });
    }
  });
  
  // Check for missing semicolons
  lines.forEach((line, index) => {
    // Skip comments, empty lines, and lines that end with { or }
    if (line.trim().startsWith('//') || line.trim() === '' || /[{}\[\]]$/.test(line.trim())) {
      return;
    }
    
    // Check if line should have a semicolon but doesn't
    if (!line.trim().endsWith(';') && 
        !line.trim().endsWith('{') && 
        !line.trim().endsWith('}') && 
        !line.trim().endsWith('*/') &&
        !line.trim().startsWith('import') &&
        !line.trim().startsWith('export') &&
        !line.trim().startsWith('function')) {
      issues.push({
        severity: 'warning',
        message: 'Missing semicolon',
        line: index + 1,
        column: line.length,
        rule: 'semi'
      });
    }
  });
  
  // Check for consistent indentation
  let expectedIndentation = 0;
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine === '') return;
    
    // Adjust expected indentation based on braces
    if (trimmedLine.endsWith('{')) {
      expectedIndentation += 2;
    } else if (trimmedLine.startsWith('}')) {
      expectedIndentation -= 2;
      // Check this line against the new indentation
      const actualIndentation = line.length - line.trimStart().length;
      if (actualIndentation !== expectedIndentation) {
        issues.push({
          severity: 'warning',
          message: `Incorrect indentation (expected ${expectedIndentation} spaces)`,
          line: index + 1,
          column: 1,
          rule: 'indent'
        });
      }
    } else {
      // Check indentation for non-brace lines
      const actualIndentation = line.length - line.trimStart().length;
      if (actualIndentation !== expectedIndentation) {
        issues.push({
          severity: 'warning',
          message: `Incorrect indentation (expected ${expectedIndentation} spaces)`,
          line: index + 1,
          column: 1,
          rule: 'indent'
        });
      }
    }
  });
  
  // Check for console.log statements
  lines.forEach((line, index) => {
    if (line.includes('console.log')) {
      issues.push({
        severity: 'warning',
        message: 'Unexpected console statement',
        line: index + 1,
        column: line.indexOf('console.log'),
        rule: 'no-console'
      });
    }
  });
  
  return issues;
}

/**
 * Format TypeScript code according to style guidelines
 * 
 * @param code - The TypeScript code to format
 * @returns Formatted code
 */
export async function formatCode(code: string): Promise<string> {
  // Create a temporary file to hold the code
  const tempFileName = `temp-${randomUUID()}.ts`;
  const tempFilePath = join(process.cwd(), tempFileName);
  
  try {
    // Write the code to the temporary file
    writeFileSync(tempFilePath, code);
    
    // Run Prettier to format the code
    const prettierResult = spawnSync('npx', ['prettier', '--write', tempFilePath], {
      encoding: 'utf-8'
    });
    
    if (prettierResult.status === 0) {
      // Read the formatted code
      const formattedCode = Bun.file(tempFilePath).text();
      return await formattedCode;
    } else {
      // If Prettier fails, return the original code
      return code;
    }
  } catch (error) {
    // If anything goes wrong, return the original code
    return code;
  } finally {
    // Clean up the temporary file
    try {
      unlinkSync(tempFilePath);
    } catch (e) {
      // Ignore errors when deleting the temporary file
    }
  }
}