/**
 * Test runner for TypeScript functions
 * Executes tests against generated functions
 */

import { TestResult, TestCaseResult } from '../shared/types';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';

/**
 * Run tests on TypeScript code
 *
 * @param code - The TypeScript code to test
 * @param testCases - Array of test case descriptions
 * @returns Result of running tests
 */
export async function runTests(
  code: string,
  testCases: string[] = []
): Promise<TestResult> {
  // If no test cases provided, generate some basic tests
  const effectiveTestCases =
    testCases.length > 0 ? testCases : generateBasicTests(code);

  // Create temporary files to hold the code and tests
  const tempFunctionFileName = `function-${randomUUID()}.ts`;
  const tempTestFileName = `test-${randomUUID()}.ts`;
  const tempFunctionPath = join(process.cwd(), tempFunctionFileName);
  const tempTestPath = join(process.cwd(), tempTestFileName);

  try {
    // Write the function code to the temporary file
    writeFileSync(tempFunctionPath, code);

    // Generate and write test code
    const testCode = generateTestCode(
      code,
      effectiveTestCases,
      tempFunctionFileName
    );
    writeFileSync(tempTestPath, testCode);

    // Run the tests using Bun
    const testResult = spawnSync('bun', ['test', tempTestPath], {
      encoding: 'utf-8',
    });

    // Parse test results
    const testResults = parseTestResults(
      testResult.stdout,
      testResult.stderr,
      effectiveTestCases
    );

    return {
      success: testResults.every(test => test.passed),
      tests: testResults,
    };
  } catch (error) {
    // If tests fail to run, return a single failed test
    return {
      success: false,
      tests: [
        {
          name: 'Test execution',
          passed: false,
          message:
            error instanceof Error
              ? error.message
              : 'Unknown error during test execution',
        },
      ],
    };
  } finally {
    // Clean up the temporary files
    try {
      unlinkSync(tempFunctionPath);
      unlinkSync(tempTestPath);
    } catch (e) {
      // Ignore errors when deleting the temporary files
    }
  }
}

/**
 * Extract function name from TypeScript code
 *
 * @param code - TypeScript code containing a function
 * @returns The function name
 */
function extractFunctionName(code: string): string {
  const functionMatch = code.match(/function\s+(\w+)/);
  return functionMatch ? functionMatch[1] : 'unknownFunction';
}

/**
 * Generate test code for a TypeScript function
 *
 * @param code - The TypeScript function code
 * @param testCases - Array of test case descriptions
 * @param functionFilePath - Path to the function file
 * @returns Generated test code
 */
function generateTestCode(
  code: string,
  testCases: string[],
  functionFilePath: string
): string {
  const functionName = extractFunctionName(code);

  // Start with imports and the function under test
  let testCode = `
import { describe, test, expect } from 'bun:test';
import { ${functionName} } from './${functionFilePath.replace('.ts', '')}';

// Append the function to the file directly for testing
${code}

describe('${functionName} tests', () => {
`;

  // Add test cases
  testCases.forEach((testCase, index) => {
    const testName = `Test case ${index + 1}`;
    // Parse the test case string to extract input, expected output
    const parsedTest = parseTestCase(testCase, functionName);

    testCode += `
  test('${testName}', () => {
    ${parsedTest}
  });
`;
  });

  // Close the describe block
  testCode += '});\n';

  return testCode;
}

/**
 * Parse a test case string to generate test code
 *
 * @param testCase - Description of the test case
 * @param functionName - Name of the function to test
 * @returns Test code for this case
 */
function parseTestCase(testCase: string, functionName: string): string {
  // This is a very basic implementation
  // In a real system, this would use more sophisticated parsing,
  // possibly involving an LLM to understand the test description

  // For simple cases like "input [1,2,3] should return 6"
  const inputMatch = testCase.match(/input\s+(\[.*?\]|".*?"|'.*?'|\d+)/i);
  const expectedMatch = testCase.match(
    /(?:should\s+)?return\s+(\[.*?\]|".*?"|'.*?'|\d+|true|false)/i
  );

  if (inputMatch && expectedMatch) {
    const input = inputMatch[1];
    const expected = expectedMatch[1];
    return `expect(${functionName}(${input})).toEqual(${expected});`;
  }

  // For equality tests like "2 + 2 = 4"
  const equalityMatch = testCase.match(/(\w+)\s*\+\s*(\w+)\s*=\s*(\w+)/);
  if (equalityMatch) {
    const a = equalityMatch[1];
    const b = equalityMatch[2];
    const expected = equalityMatch[3];
    return `expect(${functionName}(${a}, ${b})).toEqual(${expected});`;
  }

  // For array tests
  if (testCase.toLowerCase().includes('array') || testCase.includes('[]')) {
    return `const result = ${functionName}([1, 2, 3, 4]);
    expect(Array.isArray(result)).toBe(true);`;
  }

  // Default test case if we can't parse the description
  return `// Unable to parse test case: "${testCase}"
    const result = ${functionName}(42);
    expect(result).toBeDefined();`;
}

/**
 * Generate basic test cases for a function
 *
 * @param code - The TypeScript function code
 * @returns Array of basic test case descriptions
 */
function generateBasicTests(code: string): string[] {
  const functionName = extractFunctionName(code);

  // Check if the function works with arrays
  if (code.includes('Array') || code.includes('[]')) {
    return [
      `input [] should return expected value`,
      `input [1, 2, 3] should return expected value`,
      `input [0, 0, 0] should return expected value`,
    ];
  }

  // Check if the function works with strings
  if (code.includes('string') || code.includes('String')) {
    return [
      `input "" should return expected value`,
      `input "hello" should return expected value`,
      `input "test123" should return expected value`,
    ];
  }

  // Default tests
  return [
    `Basic functionality test`,
    `Edge case test`,
    `Typical use case test`,
  ];
}

/**
 * Parse test results from Bun test output
 *
 * @param stdout - Standard output from test run
 * @param stderr - Standard error from test run
 * @param testCases - Array of test case descriptions
 * @returns Array of test results
 */
function parseTestResults(
  stdout: string,
  stderr: string,
  testCases: string[]
): TestCaseResult[] {
  // This is a very simple parser for Bun test output
  // In a real system, you would want to use a more robust approach

  const results: TestCaseResult[] = [];

  // Check if there were any errors
  if (stderr && stderr.trim() !== '') {
    return [
      {
        name: 'Test execution',
        passed: false,
        message: stderr,
      },
    ];
  }

  // Look for test results in the output
  const testLines = stdout
    .split('\n')
    .filter(line => line.includes('PASS') || line.includes('FAIL'));

  // Map each test case to a result
  testCases.forEach((testCase, index) => {
    const testLine = testLines[index];
    const passed = Boolean(testLine && testLine.includes('PASS'));

    results.push({
      name: `Test case ${index + 1}`,
      passed,
      message: passed ? `Test passed: ${testCase}` : `Test failed: ${testCase}`,
    });
  });

  // If we didn't find enough test results, add generic ones
  while (results.length < testCases.length) {
    const index = results.length;
    results.push({
      name: `Test case ${index + 1}`,
      passed: false,
      message: `No output for test: ${testCases[index]}`,
    });
  }

  return results;
}
