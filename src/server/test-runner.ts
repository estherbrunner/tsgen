/**
 * Test runner for TypeScript functions
 * Executes tests against generated functions using two-pillar approach:
 * 1. Generic tests for type safety and edge cases
 * 2. LLM-enhanced specific tests for domain logic
 */

import { TestResult, TestCaseResult, LintResult } from '../shared/types';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { 
  extractFunctionSignature, 
  generateGenericTests,
  GenericTestCase,
  FunctionSignature 
} from './generic-test-generator';
import { 
  enhanceTestsWithLLM, 
  enhanceTestsWithLLMOrFallback,
  generateFallbackTests,
  LLMTestCase 
} from './llm-test-enhancer';
import { lint } from './linter';

/**
 * Run comprehensive tests on TypeScript code
 *
 * @param code - The TypeScript code to test
 * @param originalPrompt - The original user request for context
 * @param userTestCases - Optional user-provided test cases
 * @returns Result of running tests
 */
export async function runTests(
  code: string,
  originalPrompt: string = '',
  userTestCases: string[] = []
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // First, check for syntax errors by running the linter
    const lintResult = await lint(code);
    const hasSyntaxErrors = lintResult.issues.some(issue => 
      issue.severity === 'error' && (
        issue.message.includes('SyntaxError') ||
        issue.message.includes('Unexpected token') ||
        issue.message.includes('Missing semicolon') ||
        issue.message.includes('Unexpected end of input') ||
        issue.rule === 'parser-error'
      )
    );
    const lintWarnings = lintResult.issues.filter(issue => issue.severity === 'warning');
    
    // Only return early for actual syntax errors, not style or other linting errors
    if (hasSyntaxErrors) {
      const syntaxError = lintResult.issues.find(issue => issue.severity === 'error');
      return createSyntaxErrorResult(code, syntaxError?.message || 'Syntax error in generated code', Date.now() - startTime, lintWarnings);
    }
    
    // Extract function signature
    const signature = extractFunctionSignature(code);
    
    // Generate generic tests (Pillar 1)
    const genericTests = generateGenericTests(signature);
    
    // Enhance with LLM-specific tests (Pillar 2)
    let llmTests: LLMTestCase[] = [];
    if (originalPrompt) {
      llmTests = await enhanceTestsWithLLMOrFallback({
        originalPrompt,
        functionCode: code,
        functionSignature: signature,
        genericTests
      });
    }
    
    // Add user-provided test cases if any
    const userTests = parseUserTestCases(userTestCases, signature);
    
    // Create temporary files
    const tempFunctionFileName = `function-${randomUUID()}.ts`;
    const tempTestFileName = `test-${randomUUID()}.ts`;
    const tempFunctionPath = join(process.cwd(), tempFunctionFileName);
    const tempTestPath = join(process.cwd(), tempTestFileName);

    try {
      // Write the function code
      writeFileSync(tempFunctionPath, code);

      // Generate comprehensive test code
      const testCode = generateComprehensiveTestCode(
        code,
        signature,
        genericTests,
        llmTests,
        userTests,
        tempFunctionFileName
      );
      

      
      writeFileSync(tempTestPath, testCode);

      // Run the tests using Bun with minimal output
      const testResult = spawnSync('bun', ['test', tempTestPath], {
        encoding: 'utf-8',
        timeout: 10000 // 10 second timeout
      });



      // Parse test results
      const testResults = parseSimpleTestResults(
        testResult.stdout,
        testResult.stderr,
        [...genericTests, ...llmTests, ...userTests]
      );

      const totalExecutionTime = Date.now() - startTime;
      
      const passedTests = testResults.filter(test => test.status === 'passed').length;
      const totalTests = testResults.length;
      const successRate = passedTests / totalTests;
      
      return {
        success: successRate >= 0.6, // Consider success if 60% or more tests pass
        tests: testResults,
        label: `Test ${signature.name}`,
        totalExecutionTime,
        hasWarnings: lintWarnings.length > 0,
        linterWarnings: lintWarnings
      };
      
    } finally {
      // Clean up temporary files
      try {
        unlinkSync(tempFunctionPath);
        unlinkSync(tempTestPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
  } catch (error) {
    const totalExecutionTime = Date.now() - startTime;
    
    return {
      success: false,
      tests: [
        {
          name: 'test_setup',
          description: 'Test setup and preparation',
          passed: false,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error during test setup',
          executionTime: totalExecutionTime
        }
      ],
      label: 'Failed test suite',
      totalExecutionTime,
      hasWarnings: false
    };
  }
}

/**
 * Parse user-provided test cases into structured format
 */
function parseUserTestCases(testCases: string[], signature: FunctionSignature): LLMTestCase[] {
  return testCases.map((testCase, index) => {
    const parsed = parseSimpleTestCase(testCase, signature);
    return {
      name: `user_test_${index + 1}`,
      description: testCase,
      input: parsed.input,
      expectedOutput: parsed.expectedOutput,
      shouldThrow: parsed.shouldThrow,
      reasoning: 'User-provided test case'
    };
  });
}

/**
 * Parse simple test case string
 */
function parseSimpleTestCase(testCase: string, signature: FunctionSignature): {
  input: any[];
  expectedOutput?: any;
  shouldThrow: boolean;
} {
  // Extract input pattern
  const inputMatch = testCase.match(/input\s+(\[.*?\]|".*?"|'.*?'|\d+)/i);
  const expectedMatch = testCase.match(/(?:should\s+)?return\s+(\[.*?\]|".*?"|'.*?'|\d+|true|false)/i);
  
  let input: any[] = [];
  let expectedOutput: any;
  let shouldThrow = false;
  
  if (inputMatch) {
    try {
      const inputValue = eval(inputMatch[1]);
      input = Array.isArray(inputValue) ? inputValue : [inputValue];
    } catch {
      input = [inputMatch[1]];
    }
  } else {
    // Generate default inputs
    input = signature.parameters.map(p => getDefaultValueForType(p.type));
  }
  
  if (expectedMatch) {
    try {
      expectedOutput = eval(expectedMatch[1]);
    } catch {
      expectedOutput = expectedMatch[1];
    }
  }
  
  if (testCase.toLowerCase().includes('throw') || testCase.toLowerCase().includes('error')) {
    shouldThrow = true;
  }
  
  return { input, expectedOutput, shouldThrow };
}

/**
 * Generate comprehensive test code combining all test types
 */
function generateComprehensiveTestCode(
  code: string,
  signature: FunctionSignature,
  genericTests: GenericTestCase[],
  llmTests: LLMTestCase[],
  userTests: LLMTestCase[],
  functionFilePath: string
): string {
  const functionName = signature.name;
  
  let testCode = `
import { describe, test, expect } from 'bun:test';

// Function under test
${code}

describe('${functionName} tests', () => {
`;

  // Add generic tests
  for (let i = 0; i < genericTests.length; i++) {
    const test = genericTests[i];
    testCode += generateGenericTestCode(test, functionName, i);
  }

  // Add LLM-enhanced tests
  for (let i = 0; i < llmTests.length; i++) {
    const test = llmTests[i];
    testCode += generateLLMTestCode(test, functionName, i);
  }

  // Add user tests
  for (let i = 0; i < userTests.length; i++) {
    const test = userTests[i];
    testCode += generateUserTestCode(test, functionName, i);
  }

  testCode += `});
`;

  return testCode;
}

/**
 * Generate test code for generic test case
 */
function generateGenericTestCode(test: GenericTestCase, functionName: string, index: number): string {
  const testName = `${test.name}_${index}`;
  const inputStr = JSON.stringify(test.input);
  
  if (test.shouldThrow) {
    return `
  test('${testName}', () => {
    expect(() => ${functionName}(...${inputStr})).toThrow();
  });
`;
  } else {
    return `
  test('${testName}', () => {
    const result = ${functionName}(...${inputStr});
    expect(result).toBeDefined();
  });
`;
  }
}

/**
 * Generate test code for LLM test case
 */
function generateLLMTestCode(test: LLMTestCase, functionName: string, index: number): string {
  const testName = `${test.name}_${index}`;
  const inputStr = JSON.stringify(test.input);
  
  if (test.shouldThrow) {
    return `
  test('${testName}', () => {
    expect(() => ${functionName}(...${inputStr})).toThrow();
  });
`;
  } else if (test.expectedOutput !== undefined) {
    return `
  test('${testName}', () => {
    const result = ${functionName}(...${inputStr});
    expect(result).toEqual(${JSON.stringify(test.expectedOutput)});
  });
`;
  } else {
    return `
  test('${testName}', () => {
    const result = ${functionName}(...${inputStr});
    expect(result).toBeDefined();
  });
`;
  }
}

/**
 * Generate test code for user test case
 */
function generateUserTestCode(test: LLMTestCase, functionName: string, index: number): string {
  return generateLLMTestCode(test, functionName, index); // Same structure
}

/**
 * Parse simple test results from Bun output
 */
function parseSimpleTestResults(
  stdout: string,
  stderr: string,
  allTests: (GenericTestCase | LLMTestCase)[]
): TestCaseResult[] {
  const results: TestCaseResult[] = [];
  
  // Check for actual syntax or compilation errors (not runtime errors)
  const hasCompilationError = stderr.includes('SyntaxError') || 
                             stderr.includes('Unexpected token') ||
                             stderr.includes('Missing semicolon') ||
                             (stderr.includes('error:') && !stderr.includes('expect(') && !stderr.includes('(pass)') && !stderr.includes('(fail)'));
  
  if (hasCompilationError && !stderr.includes('pass')) {
    // All tests failed due to compilation error
    for (let i = 0; i < allTests.length; i++) {
      const test = allTests[i];
      results.push({
        name: test.name || `test_${i}`,
        description: test.description || 'Generated test',
        passed: false,
        status: 'error',
        message: 'Compilation error in generated code',
        executionTime: 0
      });
    }
    return results;
  }
  
  // Parse individual test results from stderr (where Bun outputs test results)
  const lines = stderr.split('\n');
  const testResultMap = new Map<string, { passed: boolean; message: string }>();
  
  // Look for test results in the format "(pass) describe > test_name" or "(fail) describe > test_name"
  for (const line of lines) {
    const passMatch = line.match(/\(pass\)\s+.*?>\s*(.+?)(?:\s+\[\d+(?:\.\d+)?ms\])?$/);
    const failMatch = line.match(/\(fail\)\s+.*?>\s*(.+?)(?:\s+\[\d+(?:\.\d+)?ms\])?$/);
    
    if (passMatch) {
      const testName = passMatch[1].trim();
      testResultMap.set(testName, { passed: true, message: 'Test passed' });
    } else if (failMatch) {
      const testName = failMatch[1].trim();
      testResultMap.set(testName, { passed: false, message: 'Test failed' });
    }
  }
  
  // Parse the summary line for overall counts (from stderr where Bun outputs)
  const summaryMatch = stderr.match(/(\d+)\s+pass\s+(\d+)\s+fail/);
  let totalPassCount = 0;
  let totalFailCount = 0;
  
  if (summaryMatch) {
    totalPassCount = parseInt(summaryMatch[1], 10);
    totalFailCount = parseInt(summaryMatch[2], 10);
  }
  
  // Create results for each test
  for (let i = 0; i < allTests.length; i++) {
    const test = allTests[i];
    const testName = `${test.name}_${i}`;
    
    // Try to find specific test result
    let testResult = testResultMap.get(testName);
    
    if (!testResult) {
      // Fallback: assign passed/failed based on proportional distribution
      const shouldPass = i < totalPassCount;
      testResult = {
        passed: shouldPass,
        message: shouldPass ? 'Test passed' : 'Test failed'
      };
    }
    
    results.push({
      name: test.name || `test_${i}`,
      description: test.description || 'Generated test',
      passed: testResult.passed,
      status: testResult.passed ? 'passed' : 'failed',
      message: testResult.message,
      executionTime: 1
    });
  }
  
  return results;
}



/**
 * Get default value for a type
 */
function getDefaultValueForType(type: string): any {
  const normalizedType = type.toLowerCase();
  
  if (normalizedType.includes('string')) return 'test';
  if (normalizedType.includes('number')) return 1;
  if (normalizedType.includes('boolean')) return true;
  if (normalizedType.includes('array') || normalizedType.includes('[]')) return [1];
  if (normalizedType.includes('object')) return {};
  
  return null;
}

/**
 * Create a test result when there are syntax errors in the generated code
 */
function createSyntaxErrorResult(
  code: string,
  errorMessage: string,
  totalExecutionTime: number,
  lintWarnings: any[]
): TestResult {
  const signature = extractFunctionSignature(code);
  const genericTests = generateGenericTests(signature);
  
  // Create failed tests for all that would have been generated
  const tests: TestCaseResult[] = genericTests.map((test, index) => ({
    name: test.name || `test_${index}`,
    description: test.description || 'Generated test',
    passed: false,
    status: 'error' as const,
    message: `Syntax error in generated code: ${errorMessage}`,
    executionTime: 0
  }));
  
  return {
    success: false,
    tests,
    label: `Test ${signature.name}`,
    totalExecutionTime,
    hasWarnings: lintWarnings.length > 0,
    linterWarnings: lintWarnings
  };
}